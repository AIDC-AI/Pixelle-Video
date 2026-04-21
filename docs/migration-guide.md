# Pixelle-Video Migration Guide / 迁移指南

## 1. Entry Points / 主入口

- New default UI / 新默认界面: `Next.js Workbench` on `http://localhost:3000`
- Shared backend / 共享后端: `FastAPI` on `http://localhost:8000`
- Legacy UI / 旧版界面: `Streamlit` on `http://localhost:8501`

新版与旧版共享同一个后端、同一个输出目录和同一套任务数据。

The new workbench and the legacy UI share the same backend, output directory, and task data.

## 2. Feature Mapping / 功能映射

| Legacy Streamlit | New Next.js Workbench | Notes / 说明 |
|---|---|---|
| 首页生成入口 | `/create` | 保留 5 个 pipeline 显式入口 |
| 快速生成 | `/create/quick` | 主题到视频主流程 |
| 数字人口播 | `/create/digital-human` | 复用同一后端任务系统 |
| 图生视频 | `/create/i2v` | 支持图片上传与重生成回流 |
| 动作迁移 | `/create/action-transfer` | 支持视频+图片输入 |
| 自定义素材 | `/create/custom` | 支持多 scene 素材批量配置 |
| 历史记录 | `/library/videos` | 新版支持项目筛选、详情和重生成 |
| 批量队列 | `/batch/queue` | 新版补充了批量总览、列表、新建、详情 |
| 系统配置 | `/settings` | 统一为 Tabs 容器 |
| 工作流/模板/预设 | `/workflows` `/templates` `/presets` | 新版为独立页面 |

## 3. FAQ / 常见问题

### 我的 Project、任务和历史数据会丢吗？

不会。

新版 Next.js 与旧版 Streamlit 共用同一个 FastAPI 后端，以及同一个任务、项目、历史索引与输出目录。

No. The Next.js workbench and the Streamlit legacy UI share the same FastAPI backend, task/project metadata, history index, and output directories.

### 为什么旧版还在？

旧版现在定位为 `Legacy UI`，主要用于：

- 查看旧历史
- 兼容性验证
- 切换期间的只读回看

The Streamlit app remains as a legacy fallback for history viewing, compatibility checks, and read-only access during rollout.

### 我应该从哪个入口开始？

默认从 `http://localhost:3000` 的 Next.js 工作台开始。

Use the Next.js workbench at `http://localhost:3000` as the primary entrypoint.

## 4. Rollback / 回滚方法

### 回滚到移除 Streamlit 之前

仓库在正式删除 `web/` 之前会打一个安全 tag：

```bash
git checkout pre-streamlit-removal
```

这会回到删除 Streamlit 前的最后安全状态。

### 回滚到任意 Phase 4 之前的 commit

你也可以直接切回任意一个切换前 commit：

```bash
git log --oneline
git checkout <commit-sha>
```

Any commit before the final Streamlit removal remains a valid rollback point.

## 5. Legacy UI / 旧版界面

如需继续启动旧版：

```bash
uv run streamlit run web/app.py
```

只读模式：

```bash
PIXELLE_STREAMLIT_READ_ONLY=1 uv run streamlit run web/app.py
```
