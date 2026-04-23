# API 概览

Pixelle-Video 提供 Python SDK 和 HTTP REST API 两种方式。

---

## Python SDK

### PixelleVideoCore

主要服务类，提供视频生成功能。

```python
from pixelle_video.service import PixelleVideoCore

pixelle = PixelleVideoCore()
await pixelle.initialize()
```

### generate_video()

生成视频的主要方法。

**参数**:

- `text` (str): 主题或完整文案
- `mode` (str): 生成模式 ("generate" 或 "fixed")
- `n_scenes` (int): 分镜数量
- `title` (str, optional): 视频标题
- `style_id` (str, optional): 风格 ID，例如 `style-1014`
- `tts_workflow` (str): TTS 工作流
- `media_workflow` (str): 媒体生成工作流（图像或视频）
- `frame_template` (str): 视频模板
- `template_params` (dict, optional): 模板自定义参数
- `bgm_mode` (str, optional): BGM 模式，`none | default | custom`
- `bgm_path` (str, optional): BGM 文件路径
- `bgm_volume` (float): BGM 音量 (0.0-1.0)

**返回**: `VideoResult` 对象

---

## HTTP REST API

启动 API 服务器：

```bash
uv run uvicorn api.app:app --host 0.0.0.0 --port 8000
```

### 视频生成 - 同步

`POST /api/video/generate/sync`

同步生成视频，等待完成后返回结果。适合小视频（< 30 秒）。

**请求体**:

```json
{
  "text": "为什么要养成阅读习惯",
  "mode": "generate",
  "n_scenes": 5,
  "frame_template": "1080x1920/image_default.html",
  "template_params": {
    "accent_color": "#3498db",
    "background": "https://example.com/custom-bg.jpg"
  },
  "title": "阅读的力量"
}
```

**响应**:

```json
{
  "success": true,
  "message": "Success",
  "video_url": "http://localhost:8000/api/files/xxx/final.mp4",
  "duration": 45.5,
  "file_size": 12345678
}
```

### 视频生成 - 异步

`POST /api/video/generate/async`

异步生成视频，立即返回任务 ID。适合大视频。

**响应**:

```json
{
  "success": true,
  "message": "Task created successfully",
  "task_id": "abc123"
}
```

### 查询任务状态

`GET /api/tasks/{task_id}`

**响应**:

```json
{
  "task_id": "abc123",
  "status": "completed",
  "result": {
    "video_url": "http://localhost:8000/api/files/xxx/final.mp4",
    "duration": 45.5,
    "file_size": 12345678
  }
}
```

### 项目中心与项目工作台

- `GET /api/projects`：列出项目摘要，新增 `preview_url`、`preview_kind` 字段
- `POST /api/projects`：创建项目
- `GET /api/projects/{project_id}`：读取单个项目
- `PATCH /api/projects/{project_id}`：更新项目名称、封面或 `pipeline_hint`
- `DELETE /api/projects/{project_id}`：软删除项目；可选 `cascade=true` 联动删除关联任务输出
- `GET /api/projects/{project_id}/overview`：读取项目工作台总览聚合数据

`Project` 公开字段新增：

- `preview_url`：项目预览资源 URL，优先级为 `cover_url > 最近结果派生`
- `preview_kind`：预览资源类型，当前为 `image | video`

`ProjectOverviewResponse` 结构：

```json
{
  "project": {
    "id": "project-1",
    "name": "Launch Campaign",
    "preview_url": "http://localhost:8000/api/files/.../final.mp4",
    "preview_kind": "video"
  },
  "stats": {
    "batch_count": 2,
    "task_count": 6,
    "pending_task_count": 1,
    "running_task_count": 1,
    "completed_task_count": 3,
    "failed_task_count": 1,
    "cancelled_task_count": 0,
    "video_count": 3,
    "image_count": 4,
    "voice_count": 3,
    "bgm_count": 1,
    "script_count": 6
  },
  "recent": {
    "batches": [],
    "tasks": [],
    "videos": [],
    "images": [],
    "voices": [],
    "bgm": [],
    "scripts": []
  }
}
```

### 工作台 Shell 支撑接口

- `GET /api/notifications`：返回工作台通知中心列表；当前默认返回空列表 `{ "items": [] }`
- `POST /api/notifications/{notification_id}/read`：将单条通知标记为已读，当前为幂等 no-op
- `POST /api/notifications/read-all`：将全部通知标记为已读，当前为幂等 no-op
- `DELETE /api/notifications`：清空通知，当前为幂等 no-op

这些接口用于保证 Next.js 工作台的 Topbar/通知中心有稳定后端契约；即使暂未接入持久化通知，也不应返回 404。

---

## 请求参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | 是 | 主题或完整文案 |
| `mode` | string | 否 | `"generate"` (AI 生成) 或 `"fixed"` (固定文案) |
| `n_scenes` | int | 否 | 分镜数量 (1-20)，仅 generate 模式有效 |
| `title` | string | 否 | 视频标题（不填则自动生成） |
| `style_id` | string | 否 | 风格 ID，Quick 会据此解析运行时默认值 |
| `frame_template` | string | 否 | 模板路径，如 `1080x1920/image_default.html` |
| `template_params` | object | 否 | 模板自定义参数（颜色、背景等） |
| `media_workflow` | string | 否 | 媒体工作流（图像或视频生成） |
| `tts_workflow` | string | 否 | TTS 工作流 |
| `ref_audio` | string | 否 | 声音克隆参考音频路径 |
| `prompt_prefix` | string | 否 | 图像风格前缀 |
| `bgm_mode` | string | 否 | `none` / `default` / `custom` |
| `bgm_path` | string | 否 | BGM 文件路径 |
| `bgm_volume` | float | 否 | BGM 音量 (0.0-1.0，默认 0.3) |

---

## 风格与资源接口

- `GET /api/resources/styles`：列出内建 / 自定义风格摘要
- `POST /api/resources/styles`：创建自定义风格
- `GET /api/resources/styles/{style_id}`：读取风格详情
- `PUT /api/resources/styles/{style_id}`：更新自定义风格
- `DELETE /api/resources/styles/{style_id}`：删除自定义风格
- `GET /api/resources/bgm`：列出 BGM，并附带 `linked_style_id` / `linked_style_name`
- `GET /api/library/bgm?style_id=...`：按关联风格筛选资源库 BGM

### 优先级说明

- BGM 解析优先级为：**显式请求值 > 风格默认值 > 当前系统默认值**
- `bgm_mode=none` 会显式禁用默认 BGM
- Digital Human / I2V / Action Transfer / Custom Async 也支持任务级 `bgm_mode`、`bgm_path`、`bgm_volume`

## 更多信息

API 文档也可通过 Swagger UI 访问：`http://localhost:8000/docs`
