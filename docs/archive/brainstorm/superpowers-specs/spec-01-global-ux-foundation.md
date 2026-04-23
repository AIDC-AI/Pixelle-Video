# Phase A Spec: 全局 UX 基础 + Projects 详情 + Appearance

> **Traceability**: master-enhancement-plan.md §1.3-1.9, §6.1-6.2, §8.3, §9.1-9.2
> **Phase**: A (2 周)
> **Gate 入口**: PRE-A 完成（TaskManager 持久化 + Projects archive/restore）
> **Gate 出口**: Lighthouse a11y ≥ 90 on 4 页 + Projects 详情 ship + 6 组件 test PASS
> **执行者**: codex

---

## 前置条件

以下必须在 Phase A 开始前由 backend 完成（PRE-A）：

- [ ] `POST /api/projects/{id}/archive` + `/restore` 端点 ship
- [ ] TaskManager 持久化 ship
- [ ] `openapi-typescript` 类型生成流水线 ship → `frontend/types/api.d.ts` 存在

---

## A1. 快捷键最小集合

**文件**: `frontend/src/lib/hooks/use-keyboard-shortcuts.ts` (新建)

**依赖**: `tinykeys` (需 `npm install tinykeys`)

### A1.1 实现清单

```typescript
// 最小集合 — Phase A
const SHORTCUTS = {
  'Meta+Slash': () => toggleShortcutHelp(),    // ⌘/ 快捷键帮助
  'Escape': () => closeTopLayer(),              // 关闭最上层 modal/drawer
  'g h': () => router.push('/'),                // 导航首页
  'g c': () => router.push('/create'),
  'g b': () => router.push('/batch'),
  'g l': () => router.push('/library/videos'),
  'g w': () => router.push('/workflows'),
  'g s': () => router.push('/settings'),
} as const;
```

### A1.2 快捷键帮助浮层

**文件**: `frontend/src/components/shared/shortcut-help-dialog.tsx` (新建)

- Dialog 720px，分 3 组：Navigation / Actions / General
- 每行：描述 + `<Kbd>` 组件
- 右上角搜索框实时过滤
- 平台适配：`navigator.platform` 检测 → ⌘ vs Ctrl

### A1.3 Kbd 组件

**文件**: `frontend/src/components/ui/kbd.tsx` (新建)

```tsx
// 键帽样式：inline-flex items-center rounded border border-border
// bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground
interface KbdProps { keys: string[] }
```

### A1.4 约束

- 输入框 (input/textarea/contenteditable) 内禁用全局键（除 Escape）
- G+letter 连击窗口 500ms
- Hook 在 `(shell)/layout.tsx` 挂载

### A1.5 验收

- [ ] `⌘/` 弹出帮助浮层
- [ ] `Esc` 关闭浮层
- [ ] `g h` / `g c` / `g b` / `g l` / `g w` / `g s` 导航正确
- [ ] 输入框内 `g h` 不触发
- [ ] 帮助浮层搜索过滤正常
- [ ] 平台键位自动适配
- [ ] 单元测试覆盖 hook + Kbd 组件

---

## A2. 加载 / 空 / 错误状态规范

### A2.1 EmptyState 升级

**文件**: `frontend/src/components/shared/empty-state.tsx` (已有，需升级)

当前 empty-state 已存在。升级要求：

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode;        // 新增：自定义 icon (96x96)
  title: string;                 // 已有
  description?: string;          // 已有
  action?: {                     // 升级：支持 primary + secondary
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline';
  };
  secondaryAction?: {            // 新增
    label: string;
    onClick: () => void;
  };
}
```

**文案规范**：
- title: 无歧义事实 ("素材库里还没有视频")
- description: 下一步指引
- 禁止: "暂无数据" "No data"

### A2.2 ErrorState 组件

**文件**: `frontend/src/components/shared/error-state.tsx` (新建)

三级：
- `variant="inline"`: 红色下边框 + 12px 红字
- `variant="card"`: 卡片 border-l-4 destructive + icon + 错误 + Retry
- `variant="page"`: 居中插画 + 人话 + Retry + 联系支持

```tsx
interface ErrorStateProps {
  variant: 'inline' | 'card' | 'page';
  title: string;
  description?: string;
  error?: Error;                 // 技术细节折叠
  onRetry?: () => void;
  retryLabel?: string;
}
```

A11y: `role="alert"` on card/page variants.

### A2.3 骨架屏升级

**文件**: 已有 `skeleton-card.tsx` / `skeleton-row.tsx` / `skeleton-table.tsx`

新增 2 个：
- `frontend/src/components/shared/skeleton-form.tsx` — 表单骨架 (N 个 label+input 行)
- `frontend/src/components/shared/skeleton-detail.tsx` — 详情页骨架 (左内容+右侧栏)

所有骨架统一 shimmer 动画：
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
/* bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-shimmer */
```

### A2.4 加载延迟策略

在 `frontend/src/lib/hooks/use-delayed-loading.ts` (新建):

```typescript
function useDelayedLoading(isLoading: boolean, delay = 200): boolean {
  // < 200ms 不显示 loader（避免闪烁）
  // ≥ 200ms 显示骨架
}
```

### A2.5 验收

- [ ] EmptyState 支持 icon + primary + secondary action
- [ ] ErrorState 三级 variant 渲染正确
- [ ] ErrorState card/page 有 `role="alert"`
- [ ] 5 个骨架模板 shimmer 动画统一
- [ ] useDelayedLoading < 200ms 不闪
- [ ] 全项目 grep 无 "暂无数据" / "No data" / "Error:" 裸文案
- [ ] 单元测试覆盖

---

## A3. 键盘导航 & Focus 管理

### A3.1 Focus Ring

**文件**: `frontend/src/app/globals.css` 追加

```css
/* 全局 focus ring — 仅 :focus-visible */
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
/* 移除默认 outline 仅在 :focus (非 visible) */
:focus:not(:focus-visible) {
  outline: none;
}
```

### A3.2 Skip Nav

**文件**: `frontend/src/components/shared/skip-nav.tsx` (新建)

```tsx
// 页面顶部隐藏链接，Tab 第一下聚焦显示
// "Skip to main content" → focus 到 <main id="main-content">
```

挂载在 `(shell)/layout.tsx` 的 `<body>` 最前。

### A3.3 Focus Trap

已有 Dialog 组件（Radix）自带 focus trap。确认 Drawer 也有。

### A3.4 Focus Restore

所有 Dialog/Drawer 关闭后 focus 回到触发元素。Radix 默认支持，确认无覆盖。

### A3.5 验收

- [ ] Focus ring 在所有可交互元素上可见 (`:focus-visible`)
- [ ] Skip Nav Tab 第一下可见 + 跳转正确
- [ ] Dialog/Drawer 关闭后 focus 回到触发器
- [ ] 从首页到任一深层页面 Tab 路径 100% 可达

---

## A4. A11y 基线

### A4.1 全局修复

- 所有 icon-only Button 加 `aria-label`
- 所有表单 Input 关联 `<Label htmlFor>`
- Toast (toaster.tsx) 加 `role="status"`
- 颜色不作为唯一信息载体（错误字段除红色外加 ✕ icon）

### A4.2 SR 脚本骨架

在 `frontend/src/tests/a11y/` 目录新建 4 个文件（Phase A 只写骨架，后续 Phase 填充）：

- `sr-create.spec.ts` — Create 表单 label + 提交反馈
- `sr-queue.spec.ts` — Queue 状态变化 live region
- `sr-library.spec.ts` — 播放器快捷键读音
- `sr-settings.spec.ts` — 保存成功读音

### A4.3 axe-core 集成

**文件**: `frontend/src/tests/setup-axe.ts` (新建)

```typescript
import { configureAxe } from 'jest-axe';
export const axe = configureAxe({ rules: { region: { enabled: false } } });
```

每个页面组件测试加 `expect(await axe(container)).toHaveNoViolations()`.

### A4.4 验收

- [ ] 所有 icon-only button 有 aria-label
- [ ] 所有 input 有 label
- [ ] Toast role="status"
- [ ] axe 无 critical (在已有页面测试中)
- [ ] 4 个 SR 脚本骨架文件存在

---

## A5. 动效 Token

### A5.1 CSS 变量

**文件**: `frontend/src/app/globals.css` 追加

```css
:root {
  --duration-instant: 100ms;
  --duration-fast: 200ms;
  --duration-base: 300ms;
  --duration-slow: 500ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### A5.2 验收

- [ ] 6 个 CSS 变量可用
- [ ] `prefers-reduced-motion` 禁用动画
- [ ] 现有组件 (Dialog/Drawer/Accordion) 使用 token 而非硬编码

---

## A6. 响应式基线

### A6.1 断点确认

Tailwind v4 默认断点已满足：sm(640) md(768) lg(1024) xl(1280) 2xl(1536)。

### A6.2 AppShell 响应式

**文件**: `frontend/src/components/shell/app-shell.tsx` (已有，需升级)

- `< md`: sidebar 隐藏，hamburger 按钮触发 Drawer
- `md-lg`: sidebar 浮层（overlay）
- `≥ lg`: sidebar 持久化

### A6.3 验收

- [ ] `< md` sidebar 变 drawer
- [ ] `≥ lg` sidebar 持久化
- [ ] 无横向滚动 (200% 缩放)

---

## A7. Projects 详情页 (ship 缺失页面)

### A7.1 Projects 列表页

**文件**: `frontend/src/app/(shell)/projects/page.tsx` (新建，当前只有 test)

基于 `GET /api/projects` (§12.1-P2)。

```tsx
// Grid 卡片列表
// 每卡：封面 + 名称 + 任务数 + 更新时间
// 顶部：搜索 + "新建项目" 按钮
// 空态：EmptyState "还没有项目" + "创建第一个项目"
```

### A7.2 Projects 详情页

**文件**: `frontend/src/app/(shell)/projects/[id]/page.tsx` (新建，当前只有 test)

基于 `GET /api/projects/{id}/overview` (§12.1-P3)。

3 个 Tab:

**Tab 1: Overview (默认)**
- 指标卡 (4 个): 任务数 / 成功率 / 素材数 / 最近更新
- 项目描述 + 封面
- 近期任务列表 (5 条)
- 快捷入口: 创建 / 批量 / 素材

**Tab 2: Tasks**
- DataTable: `GET /api/tasks?project_id={id}`
- 列: 名称 / pipeline / 状态 / 创建时间
- 筛选: 状态
- 空态: "该项目还没有任务"

**Tab 3: Settings**
- 名称 / 描述 / 封面编辑 (`PATCH /api/projects/{id}`)
- 归档按钮 (`POST /api/projects/{id}/archive`)
  - 确认 dialog: "归档后项目将从列表隐藏，30 天后永久删除"
  - 输入项目名确认
- 删除按钮 (仅已归档项目显示)

### A7.3 组件

- `frontend/src/components/projects/project-card.tsx` (新建)
- `frontend/src/components/projects/project-overview-tab.tsx` (新建)
- `frontend/src/components/projects/project-tasks-tab.tsx` (新建)
- `frontend/src/components/projects/project-settings-tab.tsx` (新建)

### A7.4 验收

- [ ] `/projects` 列表渲染 + 搜索 + 空态
- [ ] `/projects/[id]` 3 tab 切换正常
- [ ] Overview 指标卡数据正确
- [ ] Tasks tab 筛选正常
- [ ] Settings 编辑保存成功
- [ ] 归档确认 dialog + 输入校验
- [ ] 单元测试覆盖 4 个新组件
- [ ] 已有 test 文件 (`page.test.tsx`) 通过

---

## A8. Appearance 设置

### A8.1 主题切换

**文件**: `frontend/src/app/(shell)/settings/appearance/page.tsx` (已有，需升级)

**依赖**: `next-themes` (需 `npm install next-themes`)

选项:
- 主题: Light / Dark / System (radio group)
- 语言: 中文简 / English (select，已有 `preferences.ts` 基础)

### A8.2 主题 Provider

**文件**: `frontend/src/app/layout.tsx` 或 providers 文件

```tsx
import { ThemeProvider } from 'next-themes';
// attribute="class" defaultTheme="system" enableSystem
```

### A8.3 验收

- [ ] Light/Dark/System 三选切换 < 200ms 无闪烁
- [ ] 刷新后主题持久化
- [ ] 语言切换全局生效
- [ ] `prefers-color-scheme` 跟随系统

---

## A9. 颜色 Token 扩充

### A9.1 语义色补充

**文件**: `frontend/src/app/globals.css` 追加

当前已有: background/foreground/card/popover/primary/secondary/muted/accent/destructive/border/input/ring/pending/running/success

需补充:
```css
:root {
  --warning: 38 92% 50%;
  --warning-foreground: 38 92% 15%;
  --info: 210 80% 52%;
  --info-foreground: 210 80% 15%;
}
.dark {
  --warning: 38 92% 60%;
  --warning-foreground: 38 92% 95%;
  --info: 210 80% 65%;
  --info-foreground: 210 80% 95%;
}
```

Tailwind v4 `@theme inline` 追加:
```css
--color-warning: hsl(var(--warning));
--color-warning-foreground: hsl(var(--warning-foreground));
--color-info: hsl(var(--info));
--color-info-foreground: hsl(var(--info-foreground));
```

### A9.2 验收

- [ ] warning / info 色在 light + dark 下对比度 ≥ 4.5:1
- [ ] Tailwind class `text-warning` `bg-info` 可用

---

## A10. Phase A 组件库批次

### A10.1 新增组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| Kbd | `ui/kbd.tsx` | 见 A1.3 |
| ShortcutHelpDialog | `shared/shortcut-help-dialog.tsx` | 见 A1.2 |
| ErrorState | `shared/error-state.tsx` | 见 A2.2 |
| SkeletonForm | `shared/skeleton-form.tsx` | 见 A2.3 |
| SkeletonDetail | `shared/skeleton-detail.tsx` | 见 A2.3 |
| SkipNav | `shared/skip-nav.tsx` | 见 A3.2 |

### A10.2 升级组件

| 组件 | 文件 | 变更 |
|------|------|------|
| EmptyState | `shared/empty-state.tsx` | 加 icon + secondaryAction |
| Drawer | `ui/dialog.tsx` 或独立 | 确认 focus trap + restore |

### A10.3 验收

- [ ] 6 个新组件各有 unit test
- [ ] 2 个升级组件 test 更新
- [ ] 所有组件 axe 无 violation

---

## 依赖安装

```bash
cd frontend
npm install tinykeys next-themes
npm install -D jest-axe @types/jest-axe
```

---

## 文件变更汇总

### 新建文件 (14)

```
src/lib/hooks/use-keyboard-shortcuts.ts
src/lib/hooks/use-keyboard-shortcuts.test.ts
src/lib/hooks/use-delayed-loading.ts
src/lib/hooks/use-delayed-loading.test.ts
src/components/ui/kbd.tsx
src/components/ui/kbd.test.tsx
src/components/shared/shortcut-help-dialog.tsx
src/components/shared/shortcut-help-dialog.test.tsx
src/components/shared/error-state.tsx
src/components/shared/error-state.test.tsx
src/components/shared/skeleton-form.tsx
src/components/shared/skeleton-detail.tsx
src/components/shared/skip-nav.tsx
src/components/shared/skip-nav.test.tsx
src/tests/a11y/sr-create.spec.ts          (骨架)
src/tests/a11y/sr-queue.spec.ts           (骨架)
src/tests/a11y/sr-library.spec.ts         (骨架)
src/tests/a11y/sr-settings.spec.ts        (骨架)
src/tests/setup-axe.ts
src/app/(shell)/projects/page.tsx
src/app/(shell)/projects/[id]/page.tsx
src/components/projects/project-card.tsx
src/components/projects/project-card.test.tsx
src/components/projects/project-overview-tab.tsx
src/components/projects/project-overview-tab.test.tsx
src/components/projects/project-tasks-tab.tsx
src/components/projects/project-tasks-tab.test.tsx
src/components/projects/project-settings-tab.tsx
src/components/projects/project-settings-tab.test.tsx
```

### 修改文件 (5)

```
src/app/globals.css                        — 动效 token + focus ring + 语义色 + shimmer
src/app/(shell)/layout.tsx                 — 挂载 use-keyboard-shortcuts + SkipNav
src/app/layout.tsx                         — ThemeProvider
src/components/shared/empty-state.tsx      — 升级 props
src/components/shell/app-shell.tsx         — 响应式 sidebar
```

### 依赖 (3)

```
tinykeys
next-themes
jest-axe (devDep)
```

---

## 执行顺序建议

1. 依赖安装
2. globals.css 变更（动效 token + focus ring + 语义色 + shimmer）
3. 基础组件（Kbd → SkipNav → ErrorState → SkeletonForm/Detail → EmptyState 升级）
4. 快捷键 hook + 帮助浮层
5. AppShell 响应式
6. ThemeProvider + Appearance 页面升级
7. Projects 列表页 + 详情页 (4 组件)
8. axe 集成 + SR 脚本骨架
9. 全量测试

---

**END — Phase A Spec v1.0**
