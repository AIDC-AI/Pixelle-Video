# Phase E Spec: Settings 深化 + 全站打磨 + 性能优化

> **Traceability**: master-enhancement-plan.md §8.1-8.5, Phase E
> **Phase**: E (1-2 周)
> **Gate 入口**: Phase D 完成
> **Gate 出口**: 全站 Lighthouse perf ≥ 90 + a11y ≥ 95 + 全量测试绿
> **执行者**: codex

---

## 前置说明

Settings 已有 1334 行 `settings-shell.tsx`，包含 Keys（3 provider 连接测试）/ Appearance（主题+语言+AI 开关）/ Storage（统计+清理）/ About（版本信息）四个完整 tab。Phase E 是增量打磨，不重写。

---

## E1. Settings / Keys 向导增强

### E1.1 连接状态卡片化

**文件**: `src/components/settings/provider-status-card.tsx` (新建)

```tsx
interface ProviderStatusCardProps {
  name: string;           // "OpenAI" / "ComfyUI" / "RunningHub"
  logo?: React.ReactNode; // icon
  status: 'valid' | 'invalid' | 'unknown' | 'checking';
  maskedKey: string;      // "sk-***abc"
  onTest: () => void;
  onEdit: () => void;
}
```

- 卡片布局：logo + 名称 + 状态 chip + 掩码 key + 操作按钮
- 状态 chip 颜色：valid=绿 / invalid=红 / unknown=灰 / checking=蓝+脉冲
- "测试连接" 按钮（复用已有 check hooks）
- "编辑" 按钮展开 inline 编辑

### E1.2 Key 掩码显示

**文件**: `src/lib/mask-key.ts` (新建)

```typescript
function maskApiKey(key: string): string {
  if (key.length <= 8) return '***';
  return key.slice(0, 3) + '***' + key.slice(-3);
}
```

### E1.3 集成到 settings-shell

**文件**: `src/components/settings/settings-shell.tsx` (修改)

在 Keys tab 中，将现有的 input 表单改为 3 个 ProviderStatusCard 排列：
- LLM (OpenAI/兼容)
- ComfyUI
- RunningHub

每个卡片展开后显示已有的编辑字段。

### E1.4 验收

- [ ] 3 个 provider 卡片渲染
- [ ] 状态 chip 颜色正确
- [ ] 掩码显示
- [ ] 测试连接复用已有 hook
- [ ] 展开编辑 + 保存
- [ ] 单元测试

---

## E2. Settings / Storage 增强

### E2.1 使用量饼图

**文件**: `src/components/settings/storage-usage-chart.tsx` (新建)

- 饼图（recharts PieChart）：按类型分布（video/image/voice/bgm/script）
- 数据源：已有 `GET /api/settings/storage/stats`
- dynamic import 避免 SSR

### E2.2 清理策略说明

在 Storage tab 的清理按钮旁增加说明文字：
- "清理将删除失败任务的临时文件和超过 30 天的回收站内容"
- 清理前确认 dialog

### E2.3 验收

- [ ] 饼图渲染
- [ ] 清理确认 dialog
- [ ] 单元测试

---

## E3. Settings / About 增强

### E3.1 系统信息

**文件**: `src/components/settings/settings-shell.tsx` (修改)

在 About tab 增加：
- 前端版本号（从 package.json 读取，已有）
- 后端版本号（从已有 `GET /health` 的 version 字段）
- Node.js 版本（`process.version`，SSR only）
- 许可证链接
- GitHub 仓库链接
- "检查更新" 按钮（比较当前版本与 latest tag，前端逻辑）

### E3.2 验收

- [ ] 版本信息显示
- [ ] 后端版本从 health 端点获取
- [ ] 单元测试

---

## E4. 全站文案审计

### E4.1 无效文案扫描

**文件**: `src/tests/audit/text-audit.test.ts` (新建)

```typescript
// 扫描所有页面组件，确认无以下无效文案：
// - "暂无数据" / "No data" / "Error:" / "Loading..."
// - 未翻译的硬编码中文（在 en-US locale 下）
// - 未翻译的硬编码英文（在 zh-CN locale 下）
```

### E4.2 验收

- [ ] 审计测试通过
- [ ] 无裸 "暂无数据" / "No data"

---

## E5. 全站 A11y 复审

### E5.1 axe-core 全页面扫描

**文件**: `src/tests/audit/a11y-audit.test.ts` (新建)

对以下关键页面做 axe 扫描：
- `/create/quick`
- `/batch/queue`
- `/library/videos`
- `/settings`
- `/projects`

每页 `expect(await axe(container)).toHaveNoViolations()`

### E5.2 icon-only button 审计

扫描所有 `<Button>` 组件，确认 icon-only 的都有 `aria-label`。

### E5.3 验收

- [ ] 5 页 axe 无 critical/serious
- [ ] icon-only button 全有 aria-label

---

## E6. 性能优化

### E6.1 图片懒加载

**文件**: 全局检查

确认所有 `<img>` / `<Image>` 非首屏的都有 `loading="lazy"`。Next.js Image 默认 lazy，确认无 `priority` 误用。

### E6.2 大列表虚拟化

**文件**: `src/components/library/virtual-list.tsx` (新建，如需要)

如果 Library 列表 > 100 项有性能问题，引入 `@tanstack/react-virtual`。

**判断标准**：先跑 Lighthouse，如果 perf < 90 再加虚拟化。如果 ≥ 90 则跳过。

### E6.3 Bundle 分析

运行 `ANALYZE=true npm run build`（如果 next-bundle-analyzer 已配置），检查：
- 无意外大依赖
- recharts / wavesurfer / exifr 都是 dynamic import
- cmdk 体积合理

### E6.4 验收

- [ ] 非首屏图片 lazy
- [ ] Lighthouse perf ≥ 90（在 `/create/quick` 和 `/library/videos` 测）
- [ ] 无意外大 bundle

---

## E7. 动效一致性检查

### E7.1 动效 Token 使用审计

**文件**: `src/tests/audit/motion-audit.test.ts` (新建)

扫描 globals.css 和组件，确认：
- 所有 `transition-duration` 使用 `var(--duration-*)` token
- 所有 `animation-duration` 使用 token
- 无硬编码 `300ms` / `200ms`（除 tailwind 默认）

### E7.2 prefers-reduced-motion

确认 globals.css 的 `prefers-reduced-motion` 媒体查询生效。

### E7.3 验收

- [ ] 动效 token 使用率 > 80%
- [ ] reduced-motion 生效

---

## 依赖

可能需要：`@tanstack/react-virtual`（仅在 E6.2 判断需要时安装）。

---

## 新建文件清单 (~8 个)

```
src/components/settings/provider-status-card.tsx
src/components/settings/provider-status-card.test.tsx
src/components/settings/storage-usage-chart.tsx
src/components/settings/storage-usage-chart.test.tsx
src/lib/mask-key.ts
src/lib/mask-key.test.ts
src/tests/audit/text-audit.test.ts
src/tests/audit/a11y-audit.test.ts
src/tests/audit/motion-audit.test.ts
```

## 修改文件清单 (~2 个)

```
src/components/settings/settings-shell.tsx    — Keys 卡片化 + Storage 饼图 + About 增强
src/tests/msw/handlers.ts                    — 如需补充 mock
```

---

## 执行顺序

1. 基础工具 (mask-key)
2. Settings 组件 (provider-status-card, storage-usage-chart)
3. settings-shell 集成 (Keys 卡片化 + Storage 饼图 + About 增强)
4. 审计测试 (text-audit, a11y-audit, motion-audit)
5. 性能检查 (lazy load 确认, bundle 检查)
6. 全量测试 `npm run test`
7. 构建验证 `rm -rf .next && npm run build`

---

**END — Phase E Spec v1.0**
