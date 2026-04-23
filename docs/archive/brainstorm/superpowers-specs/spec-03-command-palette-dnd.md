# Phase B2 Spec: 命令面板 ⌘K + 拖拽交互

> **Traceability**: master-enhancement-plan.md §1.1, §1.7
> **Phase**: B2 (1-2 周)
> **Gate 入口**: Phase B1 完成（Create/Batch 增强全绿）
> **Gate 出口**: Playwright `command-palette.spec.ts` PASS + SR 脚本 #cmd-palette 手动 PASS
> **执行者**: codex

---

## B2.1 命令面板 ⌘K

### B2.1.1 依赖

```bash
npm install cmdk
```

### B2.1.2 Command 组件

**文件**: `src/components/ui/command.tsx` (新建)

基于 `cmdk` 封装 shadcn 风格 Command 组件：

```tsx
import { Command as CommandPrimitive } from 'cmdk';

// 导出：Command, CommandDialog, CommandInput, CommandList,
//       CommandEmpty, CommandGroup, CommandItem, CommandSeparator,
//       CommandShortcut
```

样式对齐已有设计系统（bg-popover, border, shadow-2xl, radius-xl）。

### B2.1.3 CommandPalette 业务组件

**文件**: `src/components/shell/command-palette.tsx` (新建)

```tsx
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**功能**：

1. **页面跳转**（默认模式）
   - 数据源：sidebar 的 25 个路由（从 sidebar.tsx 的 NAV_GROUPS 导出复用）
   - 每项：icon + 标题（i18n） + 右侧 Kbd（如有快捷键）
   - 分组：Create / Batch / Library / Advanced / System

2. **命令模式**（输入 `>` 前缀）
   - 切换主题 (Light/Dark/System)
   - 切换语言
   - 打开快捷键帮助

3. **项目切换**（输入 `@` 前缀）
   - 数据源：`GET /api/projects`（复用 `use-projects.ts`）
   - 选择后切换当前项目

4. **最近使用**
   - localStorage `pixelle-recent-commands` per-project
   - 最近 10 条，置顶显示

**搜索**：cmdk 内置 fuzzy search，无需额外 Fuse.js。

**键盘**：
- ↑↓ 导航
- Enter 执行
- Esc 关闭
- Tab 无特殊行为（cmdk 默认）

**A11y**：
- cmdk 自带 role="combobox" + aria-expanded + aria-activedescendant
- 关闭后 focus 回到触发元素

**UI**：
- 居中浮层 640px（≥md）/ 全屏（<md）
- 背景 backdrop-blur + black/40
- 输入框 56px 高，左 Search icon，右 Esc Kbd
- 列表区 max-height 400px 滚动
- 分组 header：text-xs uppercase tracking-wider text-muted-foreground
- 选中行 bg-accent
- 打开/关闭 200ms fade（cmdk Dialog 自带动画）

### B2.1.4 Topbar 集成

**文件**: `src/components/shell/topbar.tsx` (修改)

- 搜索按钮 onClick → 打开 CommandPalette（替换原来的 onOpenShortcuts）
- 新增 state: `commandPaletteOpen`
- 渲染 `<CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />`

### B2.1.5 快捷键集成

**文件**: `src/lib/hooks/use-keyboard-shortcuts.ts` (修改)

- ⌘K 触发命令面板（替换原来的快捷键帮助）
- 快捷键帮助改为 ⌘/ 或 ? 触发（Phase A 已有）

### B2.1.6 Sidebar 路由数据导出

**文件**: `src/components/shell/sidebar.tsx` (修改)

将 `NAV_GROUPS` 数组 export，供 CommandPalette 复用：

```typescript
export const NAV_GROUPS = [ ... ]; // 已有，改为 export
```

### B2.1.7 最近使用持久化

**文件**: `src/lib/recent-commands.ts` (新建)

```typescript
const STORAGE_KEY = 'pixelle-recent-commands';
const MAX_RECENT = 10;

export function getRecentCommands(projectId: string): RecentCommand[];
export function addRecentCommand(projectId: string, command: RecentCommand): void;
export function clearRecentCommands(projectId: string): void;

interface RecentCommand {
  type: 'page' | 'command' | 'project';
  label: string;
  value: string;  // href or command id
  timestamp: number;
}
```

### B2.1.8 验收

- [ ] ⌘K 任意页面 200ms 内弹出
- [ ] 默认显示最近使用 + 全部页面分组
- [ ] 输入文字 fuzzy 搜索正确
- [ ] `>` 前缀切换到命令模式
- [ ] `@` 前缀切换到项目模式
- [ ] Enter 执行跳转/命令
- [ ] Esc 关闭，focus 回到触发元素
- [ ] 最近使用跨会话持久化 + per-project 隔离
- [ ] 移动端全屏
- [ ] A11y: role="combobox" aria-activedescendant
- [ ] 单元测试覆盖 CommandPalette + recent-commands

---

## B2.2 全局文件拖拽上传

### B2.2.1 依赖

不使用 @dnd-kit（过重）。用原生 HTML5 Drag & Drop API 实现全局文件拖入检测。

### B2.2.2 全局 Drop Overlay

**文件**: `src/components/shared/global-drop-overlay.tsx` (新建)

```tsx
interface GlobalDropOverlayProps {
  children: React.ReactNode;
}
```

- 包裹在 `(shell)/layout.tsx` 最外层
- 监听 `dragenter` / `dragleave` / `dragover` / `drop`
- 拖入文件时显示全屏半透明 overlay：
  - bg-primary/10 + border-2 border-dashed border-primary
  - 居中文字 "松手上传文件"
  - 200ms fade-in
- 松手后：
  - 如果当前页面是 Create → 传递文件给表单
  - 如果当前页面是 Library → 触发上传
  - 其他页面 → toast "请在创建或素材页面上传"
- 拖入非文件（如文本）→ 不触发

### B2.2.3 路由感知

**文件**: `src/lib/hooks/use-drop-target.ts` (新建)

```typescript
function useDropTarget() {
  // 返回 { isDragging, files }
  // 基于 usePathname() 判断当前页面类型
  // 返回 targetType: 'create' | 'library' | 'other'
}
```

### B2.2.4 验收

- [ ] 拖文件到任意页面显示 overlay
- [ ] 拖非文件不触发
- [ ] Create 页面松手传递文件
- [ ] Library 页面松手触发上传
- [ ] 其他页面松手显示 toast
- [ ] 200ms fade 动画
- [ ] 单元测试

---

## B2.3 列表拖拽排序（Batch Queue）

### B2.3.1 说明

当前后端无优先级字段（§3.4 OUT-OF-SCOPE-v1.1），因此 Phase B2 **不实现** Batch Queue 拖拽排序。

仅预留 hook 接口，Phase D+ 后端 scheduler ship 后启用。

---

## 依赖安装

```bash
cd frontend
npm install cmdk
```

---

## 新建文件清单 (约 8 个)

```
src/components/ui/command.tsx
src/components/ui/command.test.tsx
src/components/shell/command-palette.tsx
src/components/shell/command-palette.test.tsx
src/components/shared/global-drop-overlay.tsx
src/components/shared/global-drop-overlay.test.tsx
src/lib/recent-commands.ts
src/lib/recent-commands.test.ts
src/lib/hooks/use-drop-target.ts
src/lib/hooks/use-drop-target.test.ts
```

## 修改文件清单 (约 3 个)

```
src/components/shell/topbar.tsx              — 集成 CommandPalette
src/components/shell/sidebar.tsx             — export NAV_GROUPS
src/lib/hooks/use-keyboard-shortcuts.ts      — ⌘K → 命令面板
src/app/(shell)/layout.tsx                   — 包裹 GlobalDropOverlay
```

---

## 执行顺序

1. 安装依赖 (cmdk)
2. 基础组件 (ui/command.tsx — shadcn 封装)
3. 数据层 (recent-commands.ts)
4. sidebar.tsx 导出 NAV_GROUPS
5. CommandPalette 业务组件
6. Topbar 集成 + 快捷键修改
7. GlobalDropOverlay + use-drop-target
8. layout.tsx 集成
9. 全量测试 `npm run test`
10. 构建验证 `rm -rf .next && npm run build`

---

**END — Phase B2 Spec v1.0**
