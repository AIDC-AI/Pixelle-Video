# Pixelle-Video Migration Guide / 迁移指南

## 1. Entry Points / 主入口

- Default UI / 默认界面: `Next.js Workbench` on `http://localhost:3000`
- Shared backend / 共享后端: `FastAPI` on `http://localhost:8000`
- Legacy Streamlit / 旧版 Streamlit: removed in `v1.0.0-rc.1`

当前仓库默认只保留 Next.js 工作台与 FastAPI API。

This repository now ships only the Next.js workbench and the FastAPI API by default.

## 2. Feature Mapping / 功能映射

| Legacy Streamlit | New Next.js Workbench | Notes / 说明 |
|---|---|---|
| 首页生成入口 | `/create` | 保留 5 个 pipeline 显式入口 |
| 快速生成 | `/create/quick` | 主题到视频主流程 |
| 数字人口播 | `/create/digital-human` | 复用同一后端任务系统 |
| 图生视频 | `/create/i2v` | 支持图片上传与重生成回流 |
| 动作迁移 | `/create/action-transfer` | 支持视频+图片输入 |
| 自定义素材 | `/create/custom` | 支持多 scene 素材批量配置 |
| 历史记录 | `/library/videos` | 新版支持项目筛选、详情和重生成 |
| 批量队列 | `/batch/queue` | 新版补充了批量总览、列表、新建、详情 |
| 系统配置 | `/settings` | 统一为 Tabs 容器 |
| 工作流/模板/预设 | `/workflows` `/templates` `/presets` | 新版为独立页面 |

## 3. FAQ / 常见问题

### 我的 Project、任务和历史数据会丢吗？

不会。

新版 Next.js 与旧版 Streamlit 在移除前一直共用同一个 FastAPI 后端、同一个任务/项目元数据索引，以及同一个输出目录。升级到 `v1.0.0-rc.1` 不会清空这些数据。

No. Before Streamlit removal, both UIs shared the same FastAPI backend, task/project metadata index, and output directories. Upgrading to `v1.0.0-rc.1` does not delete your data.

### 旧版 Streamlit 去哪了？

旧版已在 `v1.0.0-rc.1` 从主分支移除。最后一个安全回滚点已经打成 annotated tag：`pre-streamlit-removal`。

The Streamlit UI was removed from the main branch in `v1.0.0-rc.1`. The final safe rollback point is available as the annotated tag `pre-streamlit-removal`.

### 我应该从哪个入口开始？

默认从 `http://localhost:3000` 的 Next.js 工作台开始。

Use the Next.js workbench at `http://localhost:3000` as the primary entrypoint.

## 4. Rollback / 回滚方法

### 回滚到移除 Streamlit 之前

```bash
git checkout pre-streamlit-removal
```

这会回到删除 `web/` 之前的最后安全状态。

### 回滚到任意 Phase 4 之前的 commit

```bash
git log --oneline
git checkout <commit-sha>
```

Any commit before the final Streamlit removal remains a valid rollback point.

## 5. Current Runtime / 当前运行方式

```bash
# Terminal 1
uv run python api/app.py --host 0.0.0.0 --port 8000

# Terminal 2
pnpm install
pnpm -C frontend dev
```

访问：

- `http://localhost:3000` - Next.js 工作台
- `http://localhost:8000/docs` - FastAPI OpenAPI 文档
