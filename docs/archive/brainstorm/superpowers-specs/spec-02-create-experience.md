# Phase B1 Spec: Create 体验升级 + Batch 增强 + Preset 套用

> **Traceability**: master-enhancement-plan.md §2.0-2.5, §3.1-3.3, §7.3
> **Phase**: B1 (3 周)
> **Gate 入口**: Phase A 完成（Projects ship + A11y ≥ 90 + 组件库）
> **Gate 出口**: Playwright `create-quick-happy-path` + `create-digital-human-happy-path` + `batch-new-csv-wizard` + `batch-queue-table` 4 个 e2e PASS
> **执行者**: codex

---

## 前置说明

Phase B1 是在已有页面上增强，不是重写。所有 Create 页面（400-727 行）和 Batch 页面（323-643 行）已有完整表单和基础功能。本 spec 只添加增量能力。

**原则**：
- 不改已有表单字段的 API 契约
- 不改已有组件的 public API（除非明确标注）
- 新功能用 feature flag 或独立组件，不侵入已有逻辑
- 所有新组件必须有 unit test

---

## B1.1 参数引导 — Hover 卡片

**文件**: `src/components/create/param-hint-popover.tsx` (新建)

```tsx
interface ParamHintPopoverProps {
  paramKey: string;
  children: React.ReactNode;  // 包裹的表单字段
}
```

- 基于 Radix Popover（已有 `ui/popover.tsx`）
- hover 300ms 延迟触发（非 click）
- 内容从静态 JSON 读取：`src/data/param-hints.json`
- 每条：`{ key, title, description, range, recommended, tip }`
- 卡片宽 280px，bg-popover，shadow-lg

**数据文件**: `src/data/param-hints.json` (新建)

为 5 个 pipeline 的关键参数提供 hint（每 pipeline 5-8 个参数，共约 30 条）。

**集成方式**：在各 Create 页面的关键字段外包一层 `<ParamHintPopover paramKey="quick.duration">`。

**验收**:
- [ ] hover 300ms 弹出，移开消失
- [ ] 5 pipeline 各至少 5 个参数有 hint
- [ ] 移动端 touch 不触发（仅 hover 设备）
- [ ] 单元测试

---

## B1.2 Draft 自动保存 (IndexedDB)

**依赖**: `dexie` (需安装 `npm install dexie`)

**文件**: `src/lib/draft-store.ts` (新建)

```typescript
import Dexie from 'dexie';

class DraftDB extends Dexie {
  drafts!: Dexie.Table<Draft, string>;

  constructor() {
    super('pixelle-drafts');
    this.version(1).stores({
      drafts: 'id, project_id, pipeline, updated_at',
    });
  }
}

interface Draft {
  id: string;
  project_id: string;
  pipeline: 'quick' | 'digital-human' | 'i2v' | 'action-transfer' | 'custom';
  params: Record<string, unknown>;
  updated_at: string;
}
```

**文件**: `src/lib/hooks/use-draft.ts` (新建)

```typescript
function useDraft(pipeline: string, projectId: string) {
  // 返回 { draft, saveDraft, clearDraft, hasDraft }
  // 每字段 change 后 500ms debounce 自动保存
  // 页面加载时自动恢复（如有）
  // 7 天未触碰自动清理
}
```

**集成方式**：在 5 个 Create 页面的表单 state 初始化处调用 `useDraft`，恢复时显示 toast "已恢复上次草稿"。

**验收**:
- [ ] 表单修改 500ms 后 IndexedDB 有记录
- [ ] 刷新页面自动恢复
- [ ] 切换项目隔离
- [ ] 7 天清理逻辑
- [ ] Dexie schema version = 1
- [ ] 单元测试（mock IndexedDB 用 fake-indexeddb）

---

## B1.3 历史参数复用

**文件**: `src/components/create/param-history-drawer.tsx` (新建)

- 右侧 Drawer 400px
- 基于已有 `GET /api/tasks`（按 pipeline + project_id 筛选最近 20 条）
- 每条卡片：缩略图（如有）+ 时间 + 关键参数摘要（3-4 个字段）
- 点击 → 确认 dialog "覆盖当前参数？" → 回填表单
- 入口：Create 页面右上角 History icon button

**文件**: `src/lib/hooks/use-task-history.ts` (新建)

```typescript
function useTaskHistory(pipeline: string, projectId: string, limit = 20) {
  // 调用 GET /api/tasks?project_id=&limit=20 (已有 use-task-list.ts 可复用)
  // 返回 { tasks, isLoading }
}
```

**验收**:
- [ ] Drawer 打开显示最近 20 条
- [ ] 点击回填参数正确
- [ ] 确认 dialog 可取消
- [ ] 空态 "还没有历史记录"
- [ ] 单元测试

---

## B1.4 Preset 套用

**文件**: `src/components/create/preset-selector.tsx` (新建)

- 顶部 dropdown（基于已有 `ui/select.tsx`）
- 数据源：`GET /api/resources/presets`（已有 `use-resources.ts`）
- 选择 preset → 参数回填 + toast "已应用预设 XXX，N 个参数变更"
- 被变更字段短暂高亮（primary bg fade 1.5s，CSS animation）
- "保存当前为预设" 按钮 → dialog 输入名称 → `POST /api/resources/presets`

**文件**: `src/components/create/preset-save-dialog.tsx` (新建)

```tsx
interface PresetSaveDialogProps {
  pipeline: string;
  currentParams: Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**验收**:
- [ ] Preset dropdown 列出已有预设
- [ ] 套用后参数正确回填
- [ ] 变更字段高亮 1.5s
- [ ] 保存新预设成功
- [ ] 单元测试

---

## B1.5 提交前预检

**文件**: `src/components/create/preflight-check.tsx` (新建)

提交按钮点击后先走预检：

```tsx
interface PreflightResult {
  passed: boolean;
  checks: Array<{
    key: string;
    label: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
  }>;
}
```

检查项（全部前端本地，不调新端点）：
- ✓ 必填项完整（前端校验）
- ✓ API key 已配置（读 `GET /api/settings` 缓存）
- ✓ 存储空间（读 `GET /api/settings/storage/stats` 缓存）
- ⚠ 预计耗时提示（基于 pipeline 类型的静态估算）

任一 fail → 阻止提交，显示 checklist dialog。全 pass → 直接提交。

**验收**:
- [ ] 必填缺失时阻止提交 + 显示具体缺失字段
- [ ] API key 未配置时提示 + 跳转 Settings 链接
- [ ] 全 pass 时直接提交（无额外 dialog）
- [ ] 单元测试

---

## B1.6 提交后体验增强

**文件**: `src/components/create/submit-success-toast.tsx` (新建)

当前提交后已有 toast。增强为：
- toast 内容："已加入队列" + 任务名 + "查看队列" 链接
- 链接跳转 `/batch/queue`

**集成**：修改 5 个 Create 页面的 onSubmit 成功回调，替换现有 toast。

**验收**:
- [ ] toast 显示任务名
- [ ] "查看队列" 链接跳转正确
- [ ] 单元测试

---

## B1.7 Create 页面集成（5 pipeline）

以上 B1.1-B1.6 的组件需要集成到 5 个 Create 页面。每个页面的改动模式相同：

```diff
+ import { ParamHintPopover } from '@/components/create/param-hint-popover';
+ import { useDraft } from '@/lib/hooks/use-draft';
+ import { PresetSelector } from '@/components/create/preset-selector';
+ import { PreflightCheck } from '@/components/create/preflight-check';

// 在表单顶部加 PresetSelector
// 在关键字段外包 ParamHintPopover
// 在表单 state 初始化处调用 useDraft
// 在提交按钮处加 PreflightCheck
// 在右上角加 History icon → ParamHistoryDrawer
```

**约束**：
- 不改已有字段逻辑
- 不改已有 API 调用
- 新增组件用条件渲染，不影响已有测试

**验收**:
- [ ] 5 个 Create 页面各有：Preset / Draft / History / Hint / Preflight
- [ ] 已有测试全部通过（不破坏）
- [ ] 新增功能各有独立 unit test

---

## B1.8 Batch / New CSV 向导增强

**现状**: `batch/new/page.tsx` 已有 643 行 CSV 向导。

**增强点**（不重写，只加功能）：

### B1.8.1 模板下载

在 Step 1 顶部加 "下载 CSV 模板" 按钮。

**实现**：前端生成（已有 `batch-utils.ts` 的 `buildCsvTemplate`），不需要新端点。

```tsx
// 在 batch/new 的 Step 1 dropzone 上方
<Button variant="outline" onClick={downloadTemplate}>
  下载 {pipeline} CSV 模板
</Button>
```

### B1.8.2 编码检测

在 CSV 解析前自动检测编码（UTF-8 / GBK）。

**文件**: `src/lib/csv-encoding.ts` (新建)

```typescript
function detectEncoding(buffer: ArrayBuffer): 'utf-8' | 'gbk' {
  // BOM 检测 + 启发式
}
function decodeCSV(buffer: ArrayBuffer): string {
  const encoding = detectEncoding(buffer);
  return new TextDecoder(encoding).decode(buffer);
}
```

### B1.8.3 校验增强

在已有校验基础上，增加错误定位：
- 错误行高亮（红色背景）
- 点击错误跳到该行
- 错误汇总 badge

**验收**:
- [ ] 模板下载按钮可用
- [ ] GBK 编码 CSV 正确解析
- [ ] 错误行高亮 + 点击定位
- [ ] 已有测试不破坏

---

## B1.9 Batch / Queue 增强

**现状**: `batch/queue/page.tsx` 已有 Table view + 筛选 + 状态 badge。

**增强点**：

### B1.9.1 Polling 优化

当前可能已有 polling。确认 5s 间隔，加 `visibilitychange` 暂停（tab 不可见时停止 polling）。

**文件**: `src/lib/hooks/use-polling.ts` (新建)

```typescript
function usePolling(callback: () => void, interval: number) {
  // visibilitychange 暂停
  // unmount 清理
}
```

### B1.9.2 失败重试按钮

在 Queue 表格的失败任务行加 "重试" 按钮。

**实现**：调用 `DELETE /api/tasks/{id}` 删除失败任务 + 重新提交（复用原参数）。

注意：当前后端没有 `POST /api/batch/{id}/retry` 端点（§12.2-B-new-2 未 ship）。v1 用 "删除 + 重新提交" 的 workaround。

### B1.9.3 单任务详情 Drawer

点击任务行 → 右侧 Drawer 展示详情。

**文件**: `src/components/batch/task-detail-drawer.tsx` (新建)

```tsx
interface TaskDetailDrawerProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

内容：
- 预览输出（success 时显示视频/图片）
- 参数摘要（折叠展开）
- 状态 + 进度
- 错误信息（failed 时）
- 操作：重试 / 删除 / 复制参数

**验收**:
- [ ] Polling 5s + tab 不可见暂停
- [ ] 失败任务有重试按钮
- [ ] 点击行打开详情 Drawer
- [ ] Drawer 内容完整
- [ ] 已有测试不破坏

---

## B1.10 Preset 一键套用 (§7.3)

已在 B1.4 实现。此处确认跨页面一致性：
- 5 个 Create 页面都有 PresetSelector
- Preset 数据按 pipeline 筛选

---

## 依赖安装

```bash
cd frontend
npm install dexie
npm install -D fake-indexeddb
```

---

## 新建文件清单 (约 16 个)

```
src/components/create/param-hint-popover.tsx
src/components/create/param-hint-popover.test.tsx
src/components/create/param-history-drawer.tsx
src/components/create/param-history-drawer.test.tsx
src/components/create/preset-selector.tsx
src/components/create/preset-selector.test.tsx
src/components/create/preset-save-dialog.tsx
src/components/create/preset-save-dialog.test.tsx
src/components/create/preflight-check.tsx
src/components/create/preflight-check.test.tsx
src/components/create/submit-success-toast.tsx
src/components/batch/task-detail-drawer.tsx
src/components/batch/task-detail-drawer.test.tsx
src/data/param-hints.json
src/lib/draft-store.ts
src/lib/draft-store.test.ts
src/lib/hooks/use-draft.ts
src/lib/hooks/use-draft.test.ts
src/lib/hooks/use-task-history.ts
src/lib/hooks/use-polling.ts
src/lib/hooks/use-polling.test.ts
src/lib/csv-encoding.ts
src/lib/csv-encoding.test.ts
```

## 修改文件清单 (约 7 个)

```
src/app/(shell)/create/quick/page.tsx          — 集成 B1.1-B1.6
src/app/(shell)/create/digital-human/page.tsx  — 同上
src/app/(shell)/create/i2v/page.tsx            — 同上
src/app/(shell)/create/action-transfer/page.tsx — 同上
src/app/(shell)/create/custom/page.tsx         — 同上
src/app/(shell)/batch/new/page.tsx             — B1.8 增强
src/app/(shell)/batch/queue/page.tsx           — B1.9 增强
```

---

## 执行顺序

1. 安装依赖 (dexie, fake-indexeddb)
2. 基础 hooks (use-polling, use-draft, draft-store, use-task-history, csv-encoding)
3. 独立组件 (param-hint-popover, preset-selector, preset-save-dialog, preflight-check, param-history-drawer, submit-success-toast, task-detail-drawer)
4. 数据文件 (param-hints.json)
5. 集成到 5 个 Create 页面
6. 集成到 Batch/new 和 Batch/queue
7. 全量测试 `npm run test`
8. 构建验证 `npm run build`

---

**END — Phase B1 Spec v1.0**
