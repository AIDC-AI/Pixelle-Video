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

## 目录约定（见方案 §2.2）

- `src/app/(shell)/` — 带 Sidebar 的主路由组
- `src/components/ui/` — shadcn 生成组件
- `src/components/shell/` — AppShell / Sidebar / Topbar
- `src/components/pipelines/` — 5 pipeline 共用零件
- `src/lib/api-client.ts` — API 封装
- `src/lib/schemas/` — Zod schemas
- `src/lib/hooks/` — useTask / useBatch / useProjects
- `src/stores/` — Zustand store（currentProject 等）
- `src/types/api.d.ts` — openapi-typescript 生成

## 状态

- Phase 0 ✅ 脚手架就绪（Next 16 / shadcn / Tailwind v4 / Vitest / Playwright / CI）
- Phase 1 🔄 契约层 + AppShell 骨架
