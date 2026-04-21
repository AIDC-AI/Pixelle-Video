# Pixelle-Video 前端重构实施方案

**版本**: v1 Draft · **作者**: Claude (designer) · **日期**: 2026-04-21
**上游决策**: `.superpowers/brainstorm/41091-1776732105/`（产品形态 B + 5 pipeline 保留 + shadcn/ui + IA 5 组 29 页）

---

## 1. 目标与范围

### 1.1 目标
把现有 Streamlit 前端替换为 **Next.js 16 (App Router) + shadcn/ui** 的"创作工作台"形态（brainstorm 决策 B），使项目具备独立页路由、资产复用、批量运营能力，同时**原封不动保留** 5 个 pipeline（standard / digital_human / i2v / action_transfer / asset_based）作为显式入口。

### 1.2 不做的事
- 不改后端 FastAPI 接口语义（只新增辅助端点，详见 §5.3）
- 不改 ComfyUI workflow 与 pipeline 内部逻辑
- 不做节点编辑器（brainstorm 明确放弃 D 形态）
- 本方案**不涉及**账号矩阵、云部署、多租户 —— 属于后续版本

### 1.3 成功标准（可验收）
| # | 指标 | 验收方式 |
|---|------|---------|
| G1 | 29 个页面可路由访问，五大 pipeline 可单独运行生成 | Playwright E2E：每个 `/create/*` 可提交任务并拿到 `task_id` |
| G2 | Streamlit 与 Next.js 可并存运行，同一 FastAPI 后端 | 同时启动两端，任务列表同步可见 |
| G3 | 生成流全程有进度反馈，失败可重试 | 手测：故意触发失败 → 在 `/batch/queue` 看到失败态并可重跑 |
| G4 | 资产库可复用：历史视频的文案/图/声可一键"基于此重生成" | E2E：`/library/videos/[id]` → 复用 → 回到对应 pipeline 并预填参数 |
| G5 | 80%+ 前端单元测试覆盖，Lighthouse 性能 ≥ 85 | `pnpm test --coverage` + Lighthouse CI |
| G6 | **Project 贯穿全生命周期**：每次生成挂载到 project_id，可在 Library 按项目回溯/复用 | E2E：`/create/quick` 提交 → 自动生成或选定 project → `/library/videos?project_id=X` 可筛出 |

---

## 2. 技术栈与架构

### 2.1 前端技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | **Next.js 16 App Router** | SSR/流式渲染、文件路由天然匹配 29 页 IA；Tailwind v4 + Turbopack 默认 |
| 组件 | **shadcn/ui + Radix** | brainstorm 已定，复制式而非依赖式，可深度定制 |
| 样式 | **Tailwind CSS v4** | shadcn 标配，Next 16 内置支持 |
| 状态 | **Zustand**（全局）+ **TanStack Query v5**（服务端缓存） | 避免 Redux 过度工程；Query 处理 task 轮询、列表缓存 |
| 表单 | **React Hook Form + Zod** | 10 个 Form 页统一校验范式 |
| 图标 | **lucide-react** | shadcn 默认 |
| 国际化 | **next-intl** | 沿用现有 zh/en（`web/i18n/`）词条 |
| 测试 | **Vitest**（单元）+ **Playwright**（E2E） | Vitest 与 Next 生态兼容更好 |
| 包管理 | **pnpm** | workspace 友好，便于前后端同仓 |

### 2.2 目录结构（新增 `frontend/`，与后端同仓）
```
Pixelle-Video/
├── api/                    # 后端 FastAPI (不动)
├── pixelle_video/          # 后端服务层 (不动)
├── web/                    # 现有 Streamlit (保留到 Phase 3 末才删)
├── frontend/               # 新增 Next.js 应用
│   ├── app/
│   │   ├── (shell)/        # 带侧栏的 route group
│   │   │   ├── create/
│   │   │   │   ├── page.tsx                  # /create Hero
│   │   │   │   ├── quick/page.tsx
│   │   │   │   ├── digital-human/page.tsx
│   │   │   │   ├── i2v/page.tsx
│   │   │   │   ├── action-transfer/page.tsx
│   │   │   │   └── custom/page.tsx
│   │   │   ├── batch/
│   │   │   ├── library/
│   │   │   ├── workflows/
│   │   │   ├── templates/
│   │   │   ├── presets/
│   │   │   └── settings/
│   │   ├── api/            # 仅 BFF 代理，必要时才加
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/             # shadcn 生成
│   │   ├── shell/          # AppShell / Sidebar / Topbar
│   │   ├── pipelines/      # 5 个 pipeline 共用零件（MediaUploader 等）
│   │   └── domain/         # Task/Batch/Asset 业务组件
│   ├── lib/
│   │   ├── api-client.ts   # fetch 封装 + 类型
│   │   ├── schemas/        # Zod schemas 镜像后端 Pydantic
│   │   └── hooks/          # useTask / useBatch / useTasksSubscription
│   ├── stores/             # Zustand store（主题、语言、currentProject）
│   ├── types/              # 由 openapi-typescript 生成
│   ├── tests/
│   └── package.json
├── pixelle_video/pipelines/
│   ├── standard.py / asset_based.py / custom.py / linear.py   # 已有
│   ├── digital_human.py / i2v.py / action_transfer.py         # Phase 1 从 web/pipelines 下沉
│   └── __init__.py         # PIPELINE_REGISTRY（后端 SSOT）
├── docker-compose.yml       # 新增 frontend 服务
└── pyproject.toml
```

### 2.3 部署拓扑（并存期）
```
         ┌────────────────┐
         │   用户浏览器    │
         └───────┬────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
┌───▼─────────┐     ┌─────────▼─────┐
│ Next.js 3000 │    │ Streamlit 8501 │   (旧端口保留兼容)
└───┬─────────┘     └─────────┬─────┘
    │                         │
    └──────────┬──────────────┘
               │
       ┌───────▼────────┐
       │ FastAPI  8000  │  (唯一数据源，不动)
       └───────┬────────┘
               │
       ┌───────▼────────┐
       │ ComfyUI / 云   │
       └────────────────┘
```

---

## 3. IA 与路由落地

### 3.1 五大一级分组（照 `menu-detailed.html`）

| 分组 | 一级项 | 二级/详情页 | 模板分布 |
|------|--------|-------------|---------|
| **Create** | Quick / Digital Human / I2V / Action Transfer / Custom + `/create` Hero | 6 页 | 1 Hero + 5 Form |
| **Batch** | Batches (list/new/[id]) + Task Queue | 5 页 | 1 Dashboard + 2 List + 1 Form + 1 Detail |
| **Library** | Videos(+[id]) / Images / Voices / BGM / Scripts | 6 页 | 5 List + 1 Detail |
| **Advanced** | Workflows(self-host/runninghub/[id]) / Templates / Presets | 6 页 | 5 List + 1 Detail |
| **System** | Settings (keys/appearance/storage/about) Tabs 容器 | 5 页（1 Tabs + 4 Form/Detail） |
| **合计** | | **29 页** | Form 10 · List 10 · Detail 5 · Dashboard 1 · Hero/Tabs 2 · 其他 1 |

### 3.2 命名对齐（代码层 pipeline vs UI 路由）

> 后端代码里的 pipeline 名与菜单 UI 名不同，必须在"映射层"固定，避免误解。
> 当前仓库现状：`pixelle_video/pipelines/` 已有 `asset_based/custom/linear/standard`；`web/pipelines/` 独有 `digital_human/i2v/action_transfer`。Phase 1 会把后 3 者**下沉**到 `pixelle_video/pipelines/`（不新建 `services/pipelines/` 层），保持单一 pipeline 目录。

| 后端归位（目标） | UI 路由 | 菜单显示名 | 当前状态 |
|---|---|---|---|
| `pixelle_video/pipelines/standard.py` | `/create/quick` | Quick 快速生成 | 已在 |
| `pixelle_video/pipelines/digital_human.py` | `/create/digital-human` | 数字人口播 | **Phase 1 从 `web/` 下沉** |
| `pixelle_video/pipelines/i2v.py` | `/create/i2v` | 图生视频 | **Phase 1 从 `web/` 下沉** |
| `pixelle_video/pipelines/action_transfer.py` | `/create/action-transfer` | 动作迁移 | **Phase 1 从 `web/` 下沉** |
| `pixelle_video/pipelines/asset_based.py` | `/create/custom` | 自定义素材 | 已在 |

映射表固化于 `frontend/lib/pipelines.ts` 作为 UI 侧 SSOT；后端侧 SSOT 为 `pixelle_video/pipelines/__init__.py` 的 `PIPELINE_REGISTRY`。

### 3.3 Project 一等公民（贯穿模型）

> brainstorm 决策 B 的核心：**项目 (Project) 是贯穿"创作—编辑—发布"闭环的基础单元**。本方案不新增 `/library/projects` 页（保留 menu-detailed.html 的 29 页 IA 不变），而是把 Project 作为**隐式贯穿实体**落到数据层 + 状态层。

**数据模型**（后端补，见 §5.2）：
- 新增 `Project` 实体：`{ id, name, created_at, updated_at, cover_url, pipeline_hint, task_count, last_task_id }`
- 持久化落到**现有** `pixelle_video/services/persistence.py` + `history_manager.py`，不引入独立数据库；Project 作为 history 索引的新顶层分组字段
- 所有 `Task` / `VideoItem` / `Batch` 在元数据中增加可选字段 `project_id`（在 `task_manager` 下发时带入，写入 history 记录）

**生命周期规则**（闭合现有 TaskManager / filesystem 语义）：
| 事件 | 行为 |
|---|---|
| 用户进入 `/create/*` 未选 project | 前端调 `POST /api/projects`（name=`Untitled-{yyyyMMdd-HHmm}`）→ 绑定到 `currentProject` |
| 用户提交 task | body 携带 `project_id`；后端写 task 元数据 + history 索引 |
| 空项目（task_count=0）存在 > 24h | `POST /api/projects/cleanup`（幂等，可被定时任务或管理员手动触发）自动 soft-delete |
| `DELETE /api/projects/{id}` | **默认 soft delete**（`deleted_at` 打标，task/video 保留但从 library 默认视图隐藏）；`?cascade=true` 才物理删产物 |
| Batch 下发 | 子 task 继承父 batch 的 `project_id` |
| 现有历史数据（存量 task） | `project_id` 允许 NULL，Library 用 `project_id IS NULL` 归入"未分组"桶，不做强制 backfill |

**前端状态**：
- `stores/currentProject.ts`（Zustand）持有 `{ id, name } | null`；从 localStorage 恢复
- Topbar 显示当前项目名，可点击切换 / 新建 / 重命名（下拉 + 搜索）
- 进入任意 `/create/*` 表单：若 `currentProject` 为空则 lazy 创建并绑定；提交 task 时 `project_id` 必带

**Library 过滤**：
- `/library/videos`、`/library/images`、`/library/voices`、`/library/bgm`、`/library/scripts` 全部支持 `?project_id=X` URL 参数筛选（`null` / `all` / 具体 id 三态）
- 视频详情 `/library/videos/[id]` 显示所属 project 芯片；"基于此重生成"时继承 `project_id` 到新 task
- `/batch`、`/batch/list` 同样支持 `?project_id=X`

**不做的事**：
- 不新增顶层 "Projects" 菜单项（保持 29 页 IA 不变）
- 不做项目级权限/协作（后续版本）
- 不做 Project 导出/归档包（后续版本）

### 3.4 29 路由全量映射矩阵（IA 契约）

> 每条路由 = 文件 + Phase + 后端依赖 + 验收测试，消除"哪些页分到哪个 Phase"的歧义。

| # | 路由 | 文件路径 | Phase | 后端依赖 | 验收 E2E |
|---|------|---------|-------|---------|---------|
| 1 | `/create` | `app/(shell)/create/page.tsx` | P2 | — | 能跳转到 5 个子页 |
| 2 | `/create/quick` | `create/quick/page.tsx` | P2 | `/api/video/generate/async` | 提交 → 拿 task_id |
| 3 | `/create/digital-human` | `create/digital-human/page.tsx` | P2 | `/api/video/digital-human/async`（新） | 提交 → 拿 task_id |
| 4 | `/create/i2v` | `create/i2v/page.tsx` | P2 | `/api/video/i2v/async`（新） | 提交 → 拿 task_id |
| 5 | `/create/action-transfer` | `create/action-transfer/page.tsx` | P2 | `/api/video/action-transfer/async`（新） | 提交 → 拿 task_id |
| 6 | `/create/custom` | `create/custom/page.tsx` | P2 | `/api/video/custom/async`（新） | 提交 → 拿 task_id |
| 7 | `/batch` | `batch/page.tsx` | P3 | `/api/batch` `/api/tasks` | Dashboard 显示批次数 |
| 8 | `/batch/list` | `batch/list/page.tsx` | P3 | `GET /api/batch` | 列表分页、筛 project |
| 9 | `/batch/new` | `batch/new/page.tsx` | P3 | `POST /api/batch` | CSV 导入 → 批次创建 |
| 10 | `/batch/[id]` | `batch/[id]/page.tsx` | P3 | `GET /api/batch/{id}` | 子 task 实时进度 |
| 11 | `/batch/queue` | `batch/queue/page.tsx` | P2 | `GET /api/tasks` | 任务总队列看板 |
| 12 | `/library/videos` | `library/videos/page.tsx` | P2 | `GET /api/library/videos`（新） | 列表 + project 筛选 |
| 13 | `/library/videos/[id]` | `library/videos/[id]/page.tsx` | P2 | `GET /api/library/videos/{id}`（新） | 详情 + 重生成 |
| 14 | `/library/images` | `library/images/page.tsx` | P3 | `GET /api/library/images`（新） | 列表 |
| 15 | `/library/voices` | `library/voices/page.tsx` | P3 | `GET /api/library/voices`（新） | 列表 + 试听 |
| 16 | `/library/bgm` | `library/bgm/page.tsx` | P3 | `GET /api/library/bgm`（新，或复用现有 `/api/resources/bgm`） | 列表 |
| 17 | `/library/scripts` | `library/scripts/page.tsx` | P3 | `GET /api/library/scripts`（新） | 列表 + 复制 |
| 18 | `/workflows` | `workflows/page.tsx` | P3 | `GET /api/resources/workflows/*` | 列表 |
| 19 | `/workflows/self-host` | `workflows/self-host/page.tsx` | P3 | 同上 | 分组过滤 |
| 20 | `/workflows/runninghub` | `workflows/runninghub/page.tsx` | P3 | 同上 | 分组过滤 |
| 21 | `/workflows/[id]` | `workflows/[id]/page.tsx` | P3 | `GET /api/resources/workflows/{id}`（新） | 详情 |
| 22 | `/templates` | `templates/page.tsx` | P3 | `GET /api/resources/templates` | 列表 |
| 23 | `/presets` | `presets/page.tsx` | P3 | `GET /api/resources/presets`（新） | 列表 |
| 24 | `/settings` | `settings/page.tsx`（Tabs 容器） | P3 | `GET/PUT /api/settings`（新） | 切换 Tab |
| 25 | `/settings/keys` | `settings/keys/page.tsx`（Tab 内容） | P3 | 同上 | 读写 API key |
| 26 | `/settings/appearance` | `settings/appearance/page.tsx` | P3 | localStorage + `PUT /api/settings` | 主题/语言切换 |
| 27 | `/settings/storage` | `settings/storage/page.tsx` | P3 | `GET /api/settings` | 显示存储路径 |
| 28 | `/settings/about` | `settings/about/page.tsx` | P3 | `GET /health` | 版本信息 |
| 29 | `/` | `app/(shell)/page.tsx` | P1 | — | **根路由重定向到 `/create`**（menu-detailed.html 只列 28 个可见菜单项，第 29 条是 app root） |

> 合计 29 条路由均有对应 Phase 与后端依赖，Phase 2 交付 13 条（核心闭环），Phase 3 交付 15 条，Phase 1 占 1 条（根路由）。

---

## 4. 渐进并存策略（核心风险控制）

**原则**: 任何 Phase 的 end 状态都必须是**可发布可回滚**的，不在半成品上堆东西。

### 4.1 并存模式与每阶段回滚契约

| 阶段 | Streamlit | Next.js | 主入口 | 回滚触发器 | 回滚路径（< 5 min） |
|------|-----------|--------|--------|-----------|---------------------|
| P0 | ✅ 生产 | – | `:8501` | N/A | N/A |
| P1 | ✅ 生产 | 🛠 内部 | `:8501` | 新 API 契约破坏 Streamlit（parity test fail） | `git revert` Phase 1 commits；CI parity test 为红线 |
| P2 | ✅ 生产 | ✅ 核心 13 页 | 双端口；Streamlit 顶栏挂"切换到新版" Banner | 新版 E2E 失败率 > 5% / Project 元数据写入错误 / task 轮询风暴 | Banner 下线 + Docker compose `frontend` 服务 `scale=0`；Streamlit 保持主入口 |
| P3 | 🟡 只读 | ✅ 全 29 页 | `:3000` 主入口；Streamlit 保留只读 History 面板 | Lighthouse < 80 / Library 数据对不齐 / Project cascade 删错数据 | Nginx 把 `/` 路由切回 Streamlit `:8501`；Next.js 降级只读模式（read-only env flag） |
| P4 | ❌ 删除 | ✅ 唯一 | `:3000` | 生产发现 regression | Revert 到 P3 的最后一个 tag；恢复 `web/` 目录（保留 tag `pre-streamlit-removal`） |

**Parity Gate（P1→P2 通过条件）**：同一 task input（3 个预录制 fixture：standard / digital-human / asset-based）走 Streamlit 和 Next.js 分别提交，校验最终 `VideoItem` 的 `output_path / duration / frames_count` 一致（允许 ±1 frame）。不通过不得进 P2。

### 4.2 共存期的数据一致性保证
- **唯一真源**: 所有数据只来自 FastAPI，前后端不直连数据库/文件系统
- **Library 单一索引**: `GET /api/library/*` 所有查询走 `history_manager` 的索引，**不做即时 `output/` 目录扫描**（索引在 task 完成回调中更新）
- **任务对齐**: Streamlit 提交的任务 Next.js 也能看到（反之亦然），靠同一 `task_manager`
- **配置对齐**: `config.yaml` 与 `.env` 由后端读取，前端通过 `GET /api/settings` 拉取；写接口 Phase 3 加（Phase 1-2 只读）
- **资源 URL**: 沿用 `path_to_url()`，前端用相对路径引用，浏览器自动补域
- **Project 一致性**: 两端提交时都必须带 `project_id`；Streamlit 侧在 Phase 2 加一个"项目选择"下拉（复用 `GET /api/projects`），保证双端创建的 task 都挂到正确 project 下

---

## 5. 后端调整（最小改动）

### 5.1 零改动
已有端点全部复用：
- `POST /api/video/generate/async` → 主生成入口
- `GET /api/tasks` / `GET /api/tasks/{id}` / `DELETE /api/tasks/{id}` → 任务生命周期
- `POST /api/content/narration|image-prompt|title` → 文案辅助
- `POST /api/image/generate` / `POST /api/tts/synthesize` / `POST /api/frame/render` → 原子能力
- `GET /api/resources/workflows/{tts,media,image}` / `/templates` / `/bgm` → 下拉选项
- `GET /api/files/{path}` → 静态输出

### 5.2 需要按 pipeline 拆分的新增接口

目前 `/video/generate/async` 只接受"standard"流程的参数。其他 4 个 pipeline 在 Streamlit 里走的是 `web/pipelines/*.py` 直接调用，**API 层缺对应端点**。这是重构前必须补的。

| 新增端点 | 方法 | 对应后端 | 说明 |
|---------|------|---------|------|
| `POST /api/video/digital-human/async` | POST | `pipelines/digital_human.py`（下沉到 `pixelle_video/pipelines/`） | body 含 `portrait_url`, `narration`, `voice_workflow`, `project_id?` |
| `POST /api/video/i2v/async` | POST | `pipelines/i2v.py`（下沉） | body 含 `source_image`, `motion_prompt`, `media_workflow`, `project_id?` |
| `POST /api/video/action-transfer/async` | POST | `pipelines/action_transfer.py`（下沉） | body 含 `driver_video`, `target_image`, `pose_workflow`, `project_id?` |
| `POST /api/video/custom/async` | POST | `pipelines/asset_based.py` | body 含 `scenes[]`, `project_id?` |
| `POST /api/uploads` | POST | 新建 `api/routers/uploads.py` | multipart，返回可复用的 `file_url` |
| `GET /api/library/videos?project_id&cursor&limit` | GET | 新建 `api/routers/library.py`，查询 `history_manager` 索引 | 不扫目录；返回 `{ items: VideoItem[], next_cursor }` |
| `GET /api/library/videos/{id}` | GET | 同上 | 返回生成时用到的 prompt/image/audio 链接 |
| `GET /api/library/images?project_id&cursor&limit` | GET | 同上 | 聚合 image 产物 |
| `GET /api/library/voices?project_id&cursor&limit` | GET | 同上 | 聚合 tts 产物，附试听 URL |
| `GET /api/library/bgm` | GET | **迁移**现有 `api/routers/resources.py` 中 BGM 逻辑到 `library.py`，保持响应 schema 兼容 | 列表（与其他 library 端点同风格，支持分页） |
| `GET /api/library/scripts?project_id&cursor&limit` | GET | 新建 | 聚合 narration/prompt 历史 |
| `POST /api/batch` | POST | 新建 `api/routers/batch.py` | body 含 `pipeline`, `rows[]`, `project_id?`；扇出 N 个 task |
| `GET /api/batch?project_id&status` / `GET /api/batch/{id}` / `DELETE /api/batch/{id}` | | 同上 | 批次管理，支持按 project 过滤 |
| `GET /api/tasks?project_id&status` | GET | **扩展**现有 `api/routers/tasks.py` | 在现有 list 端点加 `project_id` query 过滤 |
| `POST /api/projects` / `GET /api/projects` / `GET /api/projects/{id}` / `PATCH /api/projects/{id}` / `DELETE /api/projects/{id}?cascade` | | 新建 `api/routers/projects.py` | Project CRUD；持久化到现有 `persistence.py`，索引与 history 共享 |
| `GET /api/resources/workflows/{id}` | GET | **扩展** `resources.py` | 单个 workflow 详情（供 `/workflows/[id]`） |
| `GET /api/resources/presets` | GET | 新建 | Preset 列表（供 `/presets`） |
| `GET /api/settings` / `PUT /api/settings` | | 新建 `api/routers/settings.py` | 读写 `config.yaml`（敏感字段掩码；PUT 仅 Phase 3 启用） |

**数据源 SSOT**：
- 所有 Library 查询 → `pixelle_video/services/history_manager.py` 的索引
- Project / Task 元数据 → `pixelle_video/services/persistence.py`
- 文件产物路径 → 继续用 `path_to_url()`，不直接暴露文件系统

**所有新端点**：
- 复用现有 `TaskManager`
- Pydantic schema 放 `api/schemas/`，与现有文件风格一致
- pytest 覆盖率 ≥ 80%（pytest-asyncio）
- 加到 OpenAPI docs，前端通过 `openapi-typescript` 一键出类型

### 5.3 OpenAPI 契约先行与 pipeline 下沉策略
- **Phase 1.1**: 先写 Pydantic schema + 空实现（返回 501）+ 测试 → 前端可用契约 Mock（MSW）开发
- **Phase 1.2**: `web/pipelines/{digital_human,i2v,action_transfer}.py` 目前是 Streamlit UI 模块（含 `import streamlit`），**不能**整体搬到 `pixelle_video/pipelines/`。正确做法：**抽取**纯业务逻辑（ComfyUI 调用、参数组装、产物落盘）到新建的 `pixelle_video/pipelines/{digital_human,i2v,action_transfer}.py`（backend-callable，无 streamlit 依赖）；`web/pipelines/*` 保留为**薄 UI 包装**，`from pixelle_video.pipelines import ... as _impl` 调用底层。
- **不新增** `pixelle_video/services/pipelines/` 层；API router 直接调用 `pixelle_video/pipelines/*.run(...)`，避免过度抽象
- Parity Gate（§4.1）确保下沉前后 Streamlit 行为不变

---

## 6. 分阶段实施（可验收里程碑）

### Phase 0 — 准备（1 天）
- [ ] 确认方案评审通过（本文件 + Codex 评分）
- [ ] 拉分支 `feature/frontend-nextjs`（基于 `using-git-worktrees` 开 worktree）
- [ ] 新增 `frontend/` 脚手架：`pnpm create next-app` + `pnpm dlx shadcn@latest init`
- [ ] 在 CI 加 `frontend` 的 lint/test/build job
- **出口**: 空 Next.js 页可访问 `:3000`，CI 绿
- **回滚**: 删除 `frontend/` + 撤回 CI yaml 即可

### Phase 1 — 契约、地基、pipeline 下沉（5–6 天）
- [ ] **1.1 后端-schema**: 按 §5.2 写全部新端点的 Pydantic schema + 空实现（返回 501）+ 单测框架（RED）；**含 `Project` 实体 + CRUD**，`Task`/`VideoItem`/`Batch` 元数据加 `project_id`
- [ ] **1.2 后端-下沉**: `web/pipelines/{digital_human,i2v,action_transfer}.py` 移到 `pixelle_video/pipelines/`；Streamlit 改 import；写 golden test（Parity Gate 基线）
- [ ] **1.3 后端-实现**: 4 个新 pipeline API 端点接上下沉后的 pipeline；library/projects/uploads/tasks?project_id 端点最小实现；全部 ≥ 80% pytest
- [ ] **1.4 前端-类型**: `openapi-typescript` 生成 `types/api.d.ts`；`lib/api-client.ts` 封装；`hooks/useTask.ts` 轮询
- [ ] **1.5 前端-骨架**: AppShell（Topbar + Sidebar + ThemeProvider）；29 个空路由占位；`stores/currentProject.ts` + Topbar 项目切换组件
- [ ] **1.6 i18n**: 从 `web/i18n/` 迁 zh/en 词条到 `frontend/messages/`（next-intl）
- **出口**: 29 个路由全部可导航到空占位页；后端新端点全部 pytest 通过；Parity Gate 的 3 个 fixture 绿
- **回滚**: `git revert` Phase 1 commits；Streamlit 不受影响（pipeline 下沉保留了 import 兼容）

### Phase 2 — Create + Library 核心闭环（7–8 天）
- [ ] **2.1**: `/create` Hero + `/create/quick` Form（提交 → 进度 → 结果）
- [ ] **2.2**: 其他 4 个 pipeline 页（digital-human / i2v / action-transfer / custom），每页独立 Form + Schema
- [ ] **2.3**: `MediaUploader` 共用组件（拖拽、预览；大文件分片放 Phase 3）
- [ ] **2.4**: `/library/videos` 列表（`project_id` 筛选三态）+ `/library/videos/[id]` 详情 + "基于此重生成"回流到对应 pipeline（继承 `project_id`）
- [ ] **2.5**: `/batch/queue` 任务总队列（复用 `/api/tasks?project_id=`）
- [ ] **2.6**: Streamlit 顶栏加"切换到新版"Banner + 项目选择下拉；确保双端 task 都挂 project
- [ ] **2.7**: Playwright E2E：5 个 pipeline 各跑 1 个短素材（用 mock workflow 或 stub ComfyUI）；Project 贯穿 E2E（G6 验收）
- **出口**: 对齐 **G1/G4/G6**；13 页上线；Parity Gate 绿
- **回滚**: Docker compose `frontend` `scale=0`，Banner 下线，Streamlit 保持主入口

### Phase 3 — Batch + 剩余 Library + Advanced + Settings（6–7 天）
- [ ] **3.1 后端**: `/api/batch` 全套 + `/api/settings`（PUT 启用）+ `/api/library/{images,voices,scripts}` + `/api/resources/{presets, workflows/{id}}`
- [ ] **3.2 前端**: `/batch`（Dashboard）/ `/batch/list` / `/batch/new`（CSV 导入）/ `/batch/[id]`（子任务监控）
- [ ] **3.3 前端**: Library 剩余 4 类页面（images/voices/bgm/scripts），统一分页 + project 筛选
- [ ] **3.4 前端**: Advanced（workflows 列表 + self-host/runninghub 分组 + `[id]` 详情 + templates + presets）
- [ ] **3.5 前端**: Settings Tabs 容器 + 4 个子 Tab（keys/appearance/storage/about）
- [ ] **3.6**: 统一错误边界、Toast、空态、骨架屏；空项目 cleanup 定时任务
- [ ] **3.7 性能**: Lighthouse CI 对 `/create`、`/library/videos`、`/batch`、`/settings` 4 个页门槛 Performance ≥ 85
- **出口**: 对齐 **G3**；全部 29 页可用；Streamlit 切只读；Lighthouse 绿
- **回滚**: Nginx 根路由切回 Streamlit；Next.js 设 `READ_ONLY=1` 降级（Library + 详情可看，提交按钮禁用）

### Phase 4 — 切换与清理（2–3 天）
- [ ] **4.1**: README / 部署文档把主入口切到 `:3000`；加中英迁移指南
- [ ] **4.2**: Docker compose 默认启 Next.js，Streamlit 做成 opt-in profile
- [ ] **4.3**: 打 tag `pre-streamlit-removal`；删 `web/` 目录
- [ ] **4.4**: 最终回归 E2E + 性能基线 + 视觉 screenshot diff
- **出口**: 对齐 **G2/G5**；新版独立发布
- **回滚**: Revert 到 `pre-streamlit-removal` tag

### 总工期
**约 21–25 工作日**（单人口径，含 Parity Gate、29 页铺开、Lighthouse 调优）。可并行：后端 schema 与前端脚手架同时推；Phase 2 后端/前端交错；Phase 3 Batch/Library/Advanced 三路可并行给不同 provider。

---

## 7. 测试策略（对齐 80% 覆盖）

### 7.1 覆盖率口径（明确）
- **前端**: 覆盖率针对 `frontend/src/**` 改动行（changed-lines），主分支全量门槛 ≥ 80% 行覆盖，PR 门槛 ≥ 80% diff 覆盖
- **后端**: 新增端点 pytest ≥ 80% 行覆盖；已有代码保底不低于当前水平（CI 禁止退化）

### 7.2 前端
| 层级 | 工具 | 覆盖重点 | 门槛 | CI 阶段 |
|------|------|---------|------|---------|
| 单元 | Vitest + RTL | hooks / schemas / 领域组件 | ≥ 80% | 每 PR |
| 契约 | MSW | API client 对 `types/api.d.ts` 的绑定 | 所有端点 mock | 每 PR |
| E2E | Playwright | 5 pipeline + Project 贯穿 + 批量 + 主题/语言 | Phase 2/3 各一轮；P4 全量 | PR（changed areas）+ main（全量） |
| 视觉 | Playwright screenshot diff | AppShell / `/create` / `/library/videos` | 容差 1% | P4 启用 |
| 性能 | Lighthouse CI | `/create`、`/library/videos`、`/batch`、`/settings` | Performance ≥ 85 | P3 起每 PR |

### 7.3 E2E 在 CI 的 mock 策略
- **ComfyUI 不在 CI 启动**：`pixelle_video/services/comfy_base_service.py` 通过环境变量 `COMFY_MOCK=1` 切成 stub，返回预录 fixture（3 个短视频 + 1 张图）
- **TTS mock**：`pixelle_video/services/tts_service.py` 同样支持 `TTS_MOCK=1`，返回 2 秒静音 wav
- **upload mock**：`/api/uploads` CI 下写 `tmpfs`，跳过持久化
- **LLM mock**：`pixelle_video/services/llm_service.py` 通过 `LLM_MOCK=1` 返回 deterministic stub

### 7.4 TDD 工作节奏
每个新端点 / 每个新 hook：先写失败测试 → 最小实现 → 重构。强制走 `tdd-guide` agent / `/tdd` skill。

### 7.5 Parity 测试（P1→P2 门槛）
- 3 个 fixture input → Streamlit 跑一次 + Next.js 跑一次 → 对比输出
- 校验字段: `output_path`（相对路径）、`duration`（±0.1s）、`frames_count`（±1）、`audio_duration`（±0.1s）
- 不通过不得进 Phase 2

---

## 8. 风险与应对

| # | 风险 | 概率 | 影响 | 应对 |
|---|------|------|------|------|
| R1 | `digital_human / action_transfer` 在 Streamlit 里是直接调 ComfyUI，抽 API 时发现隐性耦合 | 中 | 高 | Phase 1.2 预留 2 天缓冲；先写 golden test（同输入 Streamlit vs API 应得同输出） |
| R2 | 大文件上传（人像、驱动视频）走 `multipart` 超时 | 中 | 中 | `/api/uploads` 直接写 `output/uploads/{uuid}/`；前端用 `tus-js-client` 或分片（Phase 3 再加） |
| R3 | 并存期 `output/` 被两端同时读写造成不一致 | 低 | 中 | 所有写操作只经 FastAPI；前端禁止直接读文件系统 |
| R4 | shadcn 主题与现有 i18n 深色/浅色切换冲突 | 低 | 低 | Phase 1.4 做主题 + i18n 冒烟测试先于业务 |
| R5 | 5 个 pipeline 参数差异大，复用组件过早抽象 | 中 | 中 | Phase 2 先**全部复制粘贴**写完，Phase 3 再抽共用（三处相似才抽）|
| R6 | CI 构建时间超长（Next build + pytest + Playwright） | 中 | 低 | 前端 `--turbo` / 缓存 `.next/cache`；E2E 只在 main 前跑 |
| R7 | 用户习惯 Streamlit，切到新 UI 有阻力 | 中 | 低 | Phase 2/3 双端口并存；README 给迁移指南 |
| R8 | 现有 `TaskManager` 为 **in-memory**，API 重启后活跃任务状态丢失（`/batch/queue` 看不到重启前未完成的 task） | 中 | 中 | Phase 2 前把 task 元数据写入 `history_manager` 持久化索引（恢复时能看到历史，进行中态置为 `unknown`）；长期看 Phase 4 后评估换 Redis/SQLite 任务队列 |

---

## 9. 方案不做的变种（已显式否决）

1. **～直接改造 Streamlit~** —— 页面路由、动态交互、组件生态都是硬伤，brainstorm 已定切 Next.js
2. **～顶部横向导航~**（shadcn-layout 选项 B）—— 29 页放不下，用户选了 A（侧栏）
3. **～节点编辑器~**（product-shape 选项 D）—— 明确"普通用户不做"
4. **～AI 自动选 pipeline~** —— 用户硬约束要求 5 个显式选择
5. **～抽统一 pipeline 配置 DSL~** —— 过度抽象，每个 pipeline 独立表单更清晰（§8 R5）

---

## 10. 交付物清单

| 类别 | 交付物 | 存放位置 |
|------|--------|---------|
| 代码 | `frontend/` Next.js 应用 | 同仓 |
| 代码 | `api/routers/uploads.py` `batch.py` `settings.py` `library.py` `projects.py` + 4 个 pipeline 端点 + `tasks.py`/`resources.py` 扩展 | `api/routers/` |
| 代码 | 3 个 pipeline 下沉：`digital_human.py` `i2v.py` `action_transfer.py` | `pixelle_video/pipelines/` |
| 类型 | `frontend/types/api.d.ts`（OpenAPI 生成） | 同仓 |
| 测试 | Vitest 单元 + Playwright E2E + pytest 扩展 | `frontend/tests/`、`tests/` |
| 文档 | 更新 README（英中） + 部署指南 + 迁移指南 | 根 + `docs/` |
| CI | GitHub Actions 工作流（build / test / lighthouse） | `.github/workflows/` |
| 镜像 | `docker-compose.yml` 新增 `frontend` 服务 | 根 |

---

## 11. 审批与下一步

- **本文件**: `docs/superpowers/plans/frontend-rebuild.md`
- **发布状态**: 已发布（Phase 4 Step 1）
- **审批流**: designer (Claude) → reviewer (Codex) [PLAN REVIEW REQUEST] → 按评分修订（最多 3 轮）→ 过 7.0 且无单项 ≤ 3 → 执行
- **执行入口**: 评审通过后，走 `superpowers:executing-plans` skill，Phase 0 起以 git worktree 隔离
- **监控**: 每 Phase 末提交阶段性 PR，CI 绿 + 人工 UI 验收 + Codex [CODE REVIEW REQUEST]
