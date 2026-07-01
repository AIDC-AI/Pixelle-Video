# 故事插图视频 — 资产库环节卡点修复

## Context

`/ponytail-review` 审查向导 Step2（资产库编辑 + 生图）发现 8 个卡点。3 个卡死型（失败静默、单项无反馈、不能增删），5 个体验劣化。资产库质量直接决定后续分镜与 img2img 一致性插图能否成立。

涉及文件：`web/pipelines/story_illustration.py`（Step2 `_step2_assets`、`_gen_one_asset`、Step1 提取入口）。后端 `_generate_asset_images` 已验证，不动。

## 任务（按优先级）

- **T1** 生成失败不再静默：`_gen_one_asset` 异常/is_image=False 时写 `it["_error"]`，Step2 渲染红色提示，成功后清除。
- **T2** 单项生成/重生包 `st.spinner`。
- **T3** 新增/删除资产项：每类 expander 末尾加"➕ 新增"；每行加"🗑 删除"。
- **T4** "生成全部"spinner 文案带 `(i/n)` 进度。
- **T5** 仅 characters expander 默认展开，scenes/props 折叠。
- **T6** Step1 提取成功后清旧 `asset_{kind}_{idx}_*` widget key。
- **T7** "下一步"文案改 `(n_ready/n_total 已生成，可跳过)`，始终 secondary。
- **T8** 资产图临时文件名用 `kind_idx` slug，弃 hash。

## 不做

并发资产生成（限流风险）/ 改后端 / 资产库持久化。

## 验证

1. `ast.parse` 语法
2. AppTest 无头跑 `web/app.py`：9 tab 无异常
3. 手动（需 provider）：Step1→Step2 测增删、失败提示、进度、重提取清 key、0 资产下一步
