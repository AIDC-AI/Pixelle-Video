# Phase C Spec: Library 六类素材增强 + 通知中心 + Batch Dashboard

> **Traceability**: master-enhancement-plan.md §1.2, §3.5, §4.0-4.6
> **Phase**: C (3 周)
> **Gate 入口**: Phase B2 完成（命令面板 + 拖拽）
> **Gate 出口**: Playwright `library-videos-grid` + `library-images-masonry` + `notification-center` 3 个 e2e PASS
> **执行者**: codex

---

## 前置说明

Library 六类页面已有完整实现（236-526 行），已有共享组件 `library-filter-bar` / `library-grid` / `library-table`，已有 hooks `use-library-assets` / `use-library-videos`。本 spec 在已有基础上增强。

通知中心后端端点（§12.2-N1..N4）**未 ship**，Phase C 前端先用 MSW mock 开发，后端 ship 后切换。

Batch Dashboard 已有 `/batch/page.tsx`（151 行），增强为指标卡 + 图表。

---

## C1. Library 跨类型公共增强

### C1.1 视图切换 (Grid / List)

**文件**: `src/components/library/view-toggle.tsx` (新建)

```tsx
interface ViewToggleProps {
  view: 'grid' | 'list';
  onViewChange: (view: 'grid' | 'list') => void;
}
```

- 两个 icon button（Grid / List），active 态 bg-accent
- 状态持久化 localStorage `pixelle-library-view-${type}`
- 集成到 6 个 library 页面的 filter bar 右侧

### C1.2 标签筛选增强

**文件**: `src/components/library/tag-filter.tsx` (新建)

```tsx
interface TagFilterProps {
  tags: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}
```

- 水平 chip 列表，可多选
- 选中态 bg-primary text-primary-foreground
- "清除" 按钮
- 数据源：从已有 library 响应中提取 unique tags（前端聚合，无新端点）

### C1.3 收藏 Star

**文件**: `src/components/library/star-button.tsx` (新建)

```tsx
interface StarButtonProps {
  starred: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}
```

- Star icon（Lucide Star），filled = starred
- 点击 toggle
- 后端 §12.2-L-new-3 未 ship → **v1 用 localStorage mock**：`pixelle-starred-${type}-${id}`
- 后端 ship 后切换为 API 调用

### C1.4 批量操作 Toolbar

**文件**: `src/components/library/bulk-action-bar.tsx` (新建)

```tsx
interface BulkActionBarProps {
  selectedCount: number;
  onDownload: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}
```

- 底部 sticky bar，选中 > 0 时 slide-up 显示
- 操作：下载 / 删除 / 清除选择
- 删除需确认 dialog
- 选中计数 badge

### C1.5 多选机制

**文件**: `src/lib/hooks/use-multi-select.ts` (新建)

```typescript
function useMultiSelect<T extends { id: string }>() {
  // 返回 { selected, toggle, toggleAll, clear, isSelected }
  // 支持 Shift+click 区间选
  // 支持 X 键 toggle（Phase A 快捷键）
}
```

### C1.6 对比视图

**文件**: `src/components/library/compare-view.tsx` (新建)

- 选中 2-4 项后顶部出现 "对比" 按钮
- 点击打开全屏 Dialog
- 并排展示（视频同步播放 / 图片并排 / 音频波形并排）
- 底部参数 diff 表格

### C1.7 验收

- [ ] Grid/List 视图切换 + 持久化
- [ ] 标签筛选多选
- [ ] Star 收藏 toggle（localStorage）
- [ ] 批量选择 + 下载/删除
- [ ] Shift+click 区间选
- [ ] 对比视图 2-4 项
- [ ] 单元测试

---

## C2. Library / Videos 增强

### C2.1 时间轴缩略图 Hover

**文件**: `src/components/library/video-hover-preview.tsx` (新建)

- Grid 卡片 hover 时在视频上方浮出缩略图条
- 鼠标 X 位置映射到视频时间点
- 实现：`<video>` 元素 `currentTime` 设置 + canvas 截帧
- 性能：throttle 100ms

### C2.2 播放器快捷键

在 `/library/videos/[id]/page.tsx` 已有播放器基础上增加：

| 键 | 功能 |
|----|------|
| Space / K | 播放/暂停 |
| J | 倒退 10s |
| L | 快进 10s |
| , | 逐帧后退 |
| . | 逐帧前进 |
| F | 全屏 |
| M | 静音 |

**文件**: `src/lib/hooks/use-video-shortcuts.ts` (新建)

### C2.3 验收

- [ ] hover 缩略图跟随鼠标
- [ ] 7 个播放器快捷键
- [ ] 单元测试

---

## C3. Library / Images 增强

### C3.1 Masonry 布局

替换当前 Grid 为 CSS columns masonry：

```css
.masonry-grid {
  columns: 4 240px;
  column-gap: 1rem;
}
.masonry-grid > * {
  break-inside: avoid;
  margin-bottom: 1rem;
}
```

**文件**: `src/components/library/masonry-grid.tsx` (新建)

### C3.2 Lightbox

**文件**: `src/components/library/lightbox.tsx` (新建)

- 点击图片 → 全屏 Lightbox
- 左右翻页（←/→ 键 + 按钮）
- 缩放（滚轮 + ⌘+/-）
- Esc 关闭
- 底部工具栏：下载 / 删除 / 收藏

### C3.3 EXIF 展示

**依赖**: `exifr` (需安装)

**文件**: `src/components/library/exif-panel.tsx` (新建)

- 图片详情侧栏展示 EXIF（如有）
- 字段：相机 / 镜头 / ISO / 光圈 / 快门 / 焦距

### C3.4 验收

- [ ] Masonry 布局响应式
- [ ] Lightbox 键盘导航
- [ ] EXIF 正确展示
- [ ] 单元测试

---

## C4. Library / Voices 增强

### C4.1 波形可视化

**依赖**: `wavesurfer.js` (需安装)

**文件**: `src/components/library/waveform-player.tsx` (新建)

```tsx
interface WaveformPlayerProps {
  src: string;
  height?: number;
}
```

- 卡片内小波形（height 48）
- 详情页大波形（height 128）
- 空格播放/暂停
- 进度条拖拽

### C4.2 验收

- [ ] 波形渲染
- [ ] 播放/暂停/拖拽
- [ ] 单元测试

---

## C5. Library / BGM 增强

### C5.1 行内播放器

**文件**: `src/components/library/inline-audio-player.tsx` (新建)

- List view 每行：迷你播放按钮 + 进度条 + 时长
- 空格 play/pause（当前聚焦行）
- 同时只能播放一个

### C5.2 验收

- [ ] 行内播放器
- [ ] 同时只播一个
- [ ] 单元测试

---

## C6. Library / Scripts 增强

### C6.1 Markdown 预览

**文件**: `src/components/library/markdown-preview.tsx` (新建)

- 详情页左编辑右预览（或 tab 切换）
- 字数统计 + 预计口播时长（180 字/分）
- 使用 `react-markdown`（已有或需安装）

### C6.2 验收

- [ ] MD 预览渲染
- [ ] 字数 + 时长统计
- [ ] 单元测试

---

## C7. Library / Styles 增强

已有 526 行完整页面。增强点：

### C7.1 风格卡引用计数

在风格卡片上显示 "被 N 个任务使用"（从 tasks 列表前端统计）。

### C7.2 验收

- [ ] 引用计数显示
- [ ] 单元测试

---

## C8. 通知中心

### C8.1 后端 Mock (MSW)

**文件**: `src/tests/msw/notification-handlers.ts` (新建)

Mock §12.2-N1..N4：
- `GET /api/notifications` → 返回 mock 通知列表
- `POST /api/notifications/:id/read` → 标已读
- `POST /api/notifications/read-all` → 全部已读
- `DELETE /api/notifications` → 清空

### C8.2 通知 Hook

**文件**: `src/lib/hooks/use-notifications.ts` (新建)

```typescript
function useNotifications() {
  // Polling 10s (use-polling hook 复用)
  // 返回 { notifications, unreadCount, markRead, markAllRead, clear, isLoading }
}
```

### C8.3 通知中心 Drawer

**文件**: `src/components/shell/notification-center.tsx` (新建)

```tsx
interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

- 右侧 Drawer 400px
- Tab: All / Tasks / System
- 每条：type-icon + 标题 + 摘要 + 时间 + action-link
- 未读：左 2px primary 竖条
- 失败任务置顶红色
- 分组：今天 / 昨天 / 更早
- 操作：标已读 / 全部已读 / 清空
- 空态："暂时没有通知"

A11y: `role="log"` `aria-live="polite"`

### C8.4 Topbar 集成

**文件**: `src/components/shell/topbar.tsx` (修改)

- Bell icon 加未读 badge（红点 + 数字）
- 点击打开 NotificationCenter Drawer

### C8.5 验收

- [ ] Polling 10s 正确
- [ ] Tab 切换
- [ ] 标已读 / 全部已读 / 清空
- [ ] 未读 badge 实时
- [ ] 失败置顶
- [ ] 空态
- [ ] A11y role="log"
- [ ] 单元测试
- [ ] MSW mock 覆盖

---

## C9. Batch Dashboard 增强

### C9.1 指标卡

**文件**: `src/app/(shell)/batch/page.tsx` (修改)

在已有 151 行基础上增加顶部 4 个指标卡：
- 今日完成数
- 今日失败数
- 队列中数
- 平均耗时

数据源：`GET /api/tasks`（已有）+ `GET /api/batch`（已有），前端聚合。

### C9.2 图表

**依赖**: `recharts` (需安装)

- 成功率环图（PieChart）
- 耗时分布柱图（BarChart）
- 时间选择器 1d / 7d / 30d

**文件**: `src/components/batch/dashboard-charts.tsx` (新建)

### C9.3 验收

- [ ] 4 指标卡数据正确
- [ ] 环图 + 柱图渲染
- [ ] 时间选择器切换
- [ ] 单元测试

---

## 依赖安装

```bash
cd frontend
npm install exifr wavesurfer.js recharts
```

注意：`react-markdown` 检查是否已有，没有则安装。

---

## 新建文件清单 (~25 个)

```
src/components/library/view-toggle.tsx
src/components/library/view-toggle.test.tsx
src/components/library/tag-filter.tsx
src/components/library/tag-filter.test.tsx
src/components/library/star-button.tsx
src/components/library/star-button.test.tsx
src/components/library/bulk-action-bar.tsx
src/components/library/bulk-action-bar.test.tsx
src/components/library/compare-view.tsx
src/components/library/compare-view.test.tsx
src/components/library/video-hover-preview.tsx
src/components/library/masonry-grid.tsx
src/components/library/lightbox.tsx
src/components/library/lightbox.test.tsx
src/components/library/exif-panel.tsx
src/components/library/waveform-player.tsx
src/components/library/waveform-player.test.tsx
src/components/library/inline-audio-player.tsx
src/components/library/inline-audio-player.test.tsx
src/components/library/markdown-preview.tsx
src/components/shell/notification-center.tsx
src/components/shell/notification-center.test.tsx
src/components/batch/dashboard-charts.tsx
src/components/batch/dashboard-charts.test.tsx
src/lib/hooks/use-multi-select.ts
src/lib/hooks/use-multi-select.test.ts
src/lib/hooks/use-video-shortcuts.ts
src/lib/hooks/use-notifications.ts
src/lib/hooks/use-notifications.test.ts
src/tests/msw/notification-handlers.ts
```

## 修改文件清单 (~8 个)

```
src/app/(shell)/library/videos/page.tsx      — 视图切换 + tag + star + 批量 + hover
src/app/(shell)/library/images/page.tsx      — masonry + lightbox + exif
src/app/(shell)/library/voices/page.tsx      — 波形播放器
src/app/(shell)/library/bgm/page.tsx         — 行内播放器
src/app/(shell)/library/scripts/page.tsx     — MD 预览
src/app/(shell)/library/styles/page.tsx      — 引用计数
src/app/(shell)/batch/page.tsx               — dashboard 指标卡 + 图表
src/components/shell/topbar.tsx              — 通知 badge + drawer
src/tests/msw/handlers.ts                   — 注册 notification handlers
```

---

## 执行顺序

1. 安装依赖 (exifr, wavesurfer.js, recharts)
2. 公共组件 (view-toggle, tag-filter, star-button, bulk-action-bar, use-multi-select, compare-view)
3. Videos 增强 (hover-preview, video-shortcuts)
4. Images 增强 (masonry-grid, lightbox, exif-panel)
5. Voices 增强 (waveform-player)
6. BGM 增强 (inline-audio-player)
7. Scripts 增强 (markdown-preview)
8. Styles 增强 (引用计数)
9. 通知中心 (MSW mock → hook → drawer → topbar 集成)
10. Batch Dashboard (指标卡 + 图表)
11. 集成到 6 个 Library 页面
12. 全量测试 `npm run test`
13. 构建验证 `rm -rf .next && npm run build`

---

**END — Phase C Spec v1.0**
