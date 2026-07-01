# 故事插图视频 资产库卡点修复 — Task List

Status: ☐ pending · ▶ in-progress · ☑ done · ✗ blocked

## P1 — 卡死型
- ☐ T1 生成失败不再静默 (_gen_one_asset 写 _error + Step2 红色提示)
- ☐ T2 单项生成/重生加 spinner
- ☐ T3 新增/删除资产项

## P2 — 体验劣化
- ☐ T4 生成全部加 (i/n) 进度文案
- ☐ T5 expander 默认折叠非首类
- ☐ T6 Step1 重新提取后清旧 widget key

## P3 — 低优先
- ☐ T7 下一步文案修正 (可跳过)
- ☐ T8 资产图临时文件名用稳定 key (弃 hash)

## 验证
- ☐ 语法 ast.parse
- ☐ AppTest 无头跑 web/app.py 9 tab 无异常
