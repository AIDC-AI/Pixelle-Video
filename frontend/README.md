# Frontend - Pixelle-Video Creator Workspace

Next.js 16 App Router + shadcn/ui + Tailwind v4 的创作者工作台前端。

方案权威来源：`../docs/superpowers/plans/frontend-rebuild.md`

## 开发

```bash
pnpm install
pnpm dev              # http://localhost:3000
pnpm test             # Vitest 单元测试
pnpm test:coverage    # 含覆盖率（门槛 80%）
pnpm test:e2e         # Playwright E2E
pnpm typecheck
pnpm build
```

## 后端联调

```bash
# 后端 FastAPI 在 :8000 跑起来后
pnpm gen:api-types    # 从 OpenAPI 生成 src/types/api.d.ts
```

工作台 Shell 默认依赖 `/api/projects`、`/api/settings`、`/api/tasks` 与 `/api/notifications`。通知接口当前可以返回空列表，但后端必须提供该契约，避免 Topbar 在所有页面产生 404。

Phase D 新增的 Usage 页面位于 `/settings/usage`，前端通过 `src/lib/hooks/use-usage.ts` 读取 `/api/usage` 与 `/api/usage/export`。后端端点未交付前，Vitest/MSW 使用 `src/tests/msw/usage-handlers.ts` 提供 mock 数据和 CSV 导出。

Phase E 对 Settings 做增量打磨：Keys tab 使用 Provider 状态卡片与掩码展示，Storage tab 增加按类型拆分的 recharts 动态加载图表与清理确认弹窗，About tab 增加 Node.js 版本、许可证链接和前端更新检查占位。全站新增扫描式 text/a11y/motion audit tests，并确认非首屏原生 `<img>` 使用 lazy loading。

## 目录约定（见方案 §2.2）

- `src/app/(shell)/` — 带 Sidebar 的主路由组
- `src/components/ui/` — shadcn 生成组件
- `src/components/shell/` — AppShell / Sidebar / Topbar
- `src/components/workflows/` — 工作流只读 SVG 预览、参数表单、保存为模板 Dialog
- `src/components/presets/` — Preset diff 展示
- `src/components/pipelines/` — 5 pipeline 共用零件
- `src/lib/api-client.ts` — API 封装
- `src/lib/schemas/` — Zod schemas
- `src/lib/hooks/` — useTask / useBatch / useProjects
- `src/stores/` — Zustand store（currentProject 等）
- `src/types/api.d.ts` — openapi-typescript 生成

## 状态

- Phase 0 ✅ 脚手架就绪（Next 16 / shadcn / Tailwind v4 / Vitest / Playwright / CI）
- Phase 1 🔄 契约层 + AppShell 骨架
- Phase D ✅ Workflows 只读预览、Templates/Presets 增强、Usage mock 页面、AI 功能开关占位
- Phase E ✅ Settings 深化、全站审计测试、性能懒加载检查
