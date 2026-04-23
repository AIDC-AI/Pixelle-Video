# Phase D Spec: Workflows 增强 + Templates/Presets + Usage 计量 + AI 开关

> **Traceability**: master-enhancement-plan.md §5.1-5.4, §7.1-7.2, §8.4, §2.0.2, §2.0.6
> **Phase**: D (3 周)
> **Gate 入口**: Phase C 完成（Library + 通知中心）
> **Gate 出口**: §12.2-U1/U4 端点 200 OK + kill switch 测试 + AI preview staging 验证
> **执行者**: codex

---

## 前置说明

- Workflows 页面已有完整浏览+JSON 编辑（69-231 行），不做节点 IDE（§5.0 硬约束）
- Presets 已有完整 CRUD（438 行），Templates 已有浏览+套用（78 行）
- Usage 后端端点（§12.2-U1..U4）**未 ship**，用 MSW mock 开发
- AI 预览/改写后端端点**未 ship**，Phase D 只做前端开关 UI + gate 逻辑

---

## D1. Workflows / Self-host 增强

### D1.1 节点图只读预览

**文件**: `src/components/workflows/workflow-graph-preview.tsx` (新建)

```tsx
interface WorkflowGraphPreviewProps {
  workflowJson: Record<string, unknown>;
}
```

- 从 workflow JSON 提取节点列表 + 连线
- 渲染为简单的 SVG 流程图（节点 = 圆角矩形，连线 = 箭头）
- **只读**，不可编辑、不可拖拽（§5.0 硬约束）
- 缩放：滚轮 zoom 0.5-2x
- 平移：拖拽画布
- 如果 JSON 无法解析为节点图 → fallback 到语法高亮 JSON 预览

**实现**：纯 SVG + CSS transform，不引入 React Flow。

### D1.2 参数表单自动生成

**文件**: `src/components/workflows/workflow-param-form.tsx` (新建)

```tsx
interface WorkflowParamFormProps {
  schema: Record<string, unknown>;  // workflow 的 input 节点 schema
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}
```

- 从 workflow JSON 的 input 节点提取参数 schema
- 自动生成表单：string → Input, number → Input[type=number], boolean → Switch, enum → Select
- 编辑后可保存（走已有 `PUT /api/resources/workflows/{id}`）

### D1.3 集成到 workflows/[id] 详情页

**文件**: `src/app/(shell)/workflows/[id]/page.tsx` (修改)

在已有 JSON 编辑器上方增加两个 Tab：
- **Preview** (默认): 节点图只读预览 + 参数表单
- **JSON**: 已有 JSON 编辑器（保持不变）

### D1.4 验收

- [ ] 节点图 SVG 渲染
- [ ] 缩放 + 平移
- [ ] JSON 无法解析时 fallback
- [ ] 参数表单自动生成
- [ ] 表单编辑 + 保存
- [ ] Tab 切换不丢状态
- [ ] 单元测试

---

## D2. Workflows / RunningHub 增强

### D2.1 同步状态指示

**文件**: `src/app/(shell)/workflows/runninghub/page.tsx` (修改)

在已有列表基础上增加：
- 每个 workflow 卡片加 sync 状态 chip：`synced` / `outdated` / `error`
- 状态基于 `updated_at` 与本地缓存时间对比（前端逻辑）

### D2.2 验收

- [ ] sync 状态 chip 显示
- [ ] 单元测试

---

## D3. Workflows / Templates 保存

### D3.1 "保存为模板" 按钮

**文件**: `src/components/workflows/save-as-template-dialog.tsx` (新建)

在 workflows/[id] 详情页加 "保存为模板" 按钮：
- Dialog: 输入名称 + 描述 + 选择要暴露的参数
- 保存走已有 `PUT /api/resources/workflows/{id}`（在 metadata 中标记 is_template）

### D3.2 验收

- [ ] Dialog 完整流程
- [ ] 保存成功 toast
- [ ] 单元测试

---

## D4. Templates 页面增强

### D4.1 分类筛选

**文件**: `src/app/(shell)/templates/page.tsx` (修改)

在已有 78 行基础上增加：
- 顶部 Tab: All / By Pipeline (quick/digital-human/i2v/action-transfer/custom)
- 搜索框
- 卡片增加：使用次数 badge（前端从 tasks 统计）

### D4.2 验收

- [ ] Tab 筛选
- [ ] 搜索
- [ ] 使用次数 badge
- [ ] 单元测试

---

## D5. Presets 管理增强

### D5.1 Diff View

**文件**: `src/components/presets/preset-diff-view.tsx` (新建)

```tsx
interface PresetDiffViewProps {
  presetA: Record<string, unknown>;
  presetB: Record<string, unknown>;
}
```

- 选中 2 个 preset → "对比" 按钮
- Dialog 左右并排，参数 diff 高亮（绿=新增，红=删除，黄=变更）

### D5.2 继承

在已有 Presets 页面增加：
- 创建 preset 时可选 "基于现有 preset"
- 显示 parent 引用 badge

**实现**：在 preset metadata 中存 `parent_name` 字段（走已有 PUT）。

### D5.3 验收

- [ ] Diff view 高亮正确
- [ ] 继承创建流程
- [ ] parent badge 显示
- [ ] 单元测试

---

## D6. Usage 计量页面

### D6.1 后端 Mock (MSW)

**文件**: `src/tests/msw/usage-handlers.ts` (新建)

Mock §12.2-U1/U4：
- `GET /api/usage?period=today|month&group_by=pipeline|model` → mock 用量数据
- `GET /api/usage/export?format=csv&period=` → mock CSV 下载

### D6.2 Usage Hook

**文件**: `src/lib/hooks/use-usage.ts` (新建)

```typescript
function useUsage(period: 'today' | 'month', groupBy: 'pipeline' | 'model') {
  // TanStack Query
  // 返回 { data, isLoading }
}
```

### D6.3 Usage 页面

**文件**: `src/app/(shell)/settings/usage/page.tsx` (新建)

- 顶部 4 指标卡：API 调用数 / 生成数 / 存储用量 / 下载流量
- 中间：折线图（日趋势）+ 饼图（按 pipeline 分布）
- 时间选择器：今日 / 本月
- 导出 CSV 按钮
- 图表用 recharts（Phase C 已安装）

### D6.4 Sidebar 路由

**文件**: `src/components/shell/sidebar.tsx` (修改)

在 system 组中 settings 下增加 usage 入口：
```typescript
{ href: '/settings/usage', icon: BarChart3, itemKey: 'usage' }
```

### D6.5 验收

- [ ] 4 指标卡
- [ ] 折线图 + 饼图
- [ ] 时间选择器切换
- [ ] CSV 导出
- [ ] MSW mock 覆盖
- [ ] 单元测试

---

## D7. AI 预览/改写开关 UI

### D7.1 Settings 开关

**文件**: `src/app/(shell)/settings/appearance/page.tsx` (修改)

在 Appearance 设置页增加 "高级" 分区：
- AI 实时预览：Switch（默认 OFF）
- AI Prompt 辅助：Switch（默认 OFF）
- 说明文字："开启后在创建页面可用实时预览和 AI 改写功能。需要后端支持。"

状态持久化：localStorage `pixelle-ai-preview-enabled` / `pixelle-ai-prompt-assist-enabled`

### D7.2 Create 页面 Gate

**文件**: `src/lib/hooks/use-ai-features.ts` (新建)

```typescript
function useAiFeatures() {
  // 读 localStorage 开关
  // 返回 { previewEnabled, promptAssistEnabled }
}
```

在 5 个 Create 页面中：
- 如果 `previewEnabled` → 显示预览面板占位（"后端未就绪，敬请期待"）
- 如果 `promptAssistEnabled` → 显示 AI 改写按钮占位（同上）

**不调后端**（端点未 ship），仅 UI 占位 + 开关。

### D7.3 验收

- [ ] Settings 开关默认 OFF
- [ ] 开启后 Create 页面显示占位
- [ ] 关闭后占位消失
- [ ] 单元测试

---

## 依赖

无新依赖（recharts 已在 Phase C 安装）。

---

## 新建文件清单 (~18 个)

```
src/components/workflows/workflow-graph-preview.tsx
src/components/workflows/workflow-graph-preview.test.tsx
src/components/workflows/workflow-param-form.tsx
src/components/workflows/workflow-param-form.test.tsx
src/components/workflows/save-as-template-dialog.tsx
src/components/workflows/save-as-template-dialog.test.tsx
src/components/presets/preset-diff-view.tsx
src/components/presets/preset-diff-view.test.tsx
src/app/(shell)/settings/usage/page.tsx
src/app/(shell)/settings/usage/page.test.tsx
src/lib/hooks/use-usage.ts
src/lib/hooks/use-usage.test.ts
src/lib/hooks/use-ai-features.ts
src/lib/hooks/use-ai-features.test.ts
src/tests/msw/usage-handlers.ts
```

## 修改文件清单 (~8 个)

```
src/app/(shell)/workflows/[id]/page.tsx          — Tab + 节点预览 + 参数表单
src/app/(shell)/workflows/runninghub/page.tsx     — sync 状态
src/app/(shell)/templates/page.tsx                — 分类筛选 + 搜索
src/app/(shell)/presets/page.tsx                  — diff + 继承
src/app/(shell)/settings/appearance/page.tsx      — AI 开关
src/components/shell/sidebar.tsx                  — usage 路由
src/tests/msw/handlers.ts                        — 注册 usage handlers
src/app/(shell)/create/*/page.tsx (5 个)          — AI 占位 gate
```

---

## 执行顺序

1. Workflows 组件 (graph-preview, param-form, save-as-template-dialog)
2. Workflows 页面集成 ([id] Tab + runninghub sync)
3. Templates 页面增强
4. Presets diff + 继承
5. Usage MSW mock + hook + 页面
6. Sidebar 路由 + Settings AI 开关
7. Create 页面 AI gate 占位
8. 全量测试 `npm run test`
9. 构建验证 `rm -rf .next && npm run build`

---

**END — Phase D Spec v1.0**
