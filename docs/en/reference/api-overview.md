# API Overview

Pixelle-Video provides both Python SDK and HTTP REST API.

---

## Python SDK

### PixelleVideoCore

Main service class providing video generation functionality.

```python
from pixelle_video.service import PixelleVideoCore

pixelle = PixelleVideoCore()
await pixelle.initialize()
```

### generate_video()

Primary method for generating videos.

**Parameters**:

- `text` (str): Topic or complete script
- `mode` (str): Generation mode ("generate" or "fixed")
- `n_scenes` (int): Number of scenes
- `title` (str, optional): Video title
- `style_id` (str, optional): Style ID, for example `style-1014`
- `tts_workflow` (str): TTS workflow
- `media_workflow` (str): Media generation workflow (image or video)
- `frame_template` (str): Video template
- `template_params` (dict, optional): Custom template parameters
- `bgm_mode` (str, optional): BGM mode, `none | default | custom`
- `bgm_path` (str, optional): BGM file path
- `bgm_volume` (float): BGM volume (0.0-1.0)

**Returns**: `VideoResult` object

---

## HTTP REST API

Start the API server:

```bash
uv run uvicorn api.app:app --host 0.0.0.0 --port 8000
```

### Video Generation - Synchronous

`POST /api/video/generate/sync`

Generate video synchronously, waits until completion. Suitable for small videos (< 30 seconds).

**Request Body**:

```json
{
  "text": "Why you should develop a reading habit",
  "mode": "generate",
  "n_scenes": 5,
  "frame_template": "1080x1920/image_default.html",
  "template_params": {
    "accent_color": "#3498db",
    "background": "https://example.com/custom-bg.jpg"
  },
  "title": "The Power of Reading"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Success",
  "video_url": "http://localhost:8000/api/files/xxx/final.mp4",
  "duration": 45.5,
  "file_size": 12345678
}
```

### Video Generation - Asynchronous

`POST /api/video/generate/async`

Generate video asynchronously, returns task ID immediately. Suitable for large videos.

**Response**:

```json
{
  "success": true,
  "message": "Task created successfully",
  "task_id": "abc123"
}
```

### Query Task Status

`GET /api/tasks/{task_id}`

**Response**:

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

### Project Hub and Project Workbench

- `GET /api/projects`: List project summaries, now including `preview_url` and `preview_kind`
- `POST /api/projects`: Create a project
- `GET /api/projects/{project_id}`: Fetch one project
- `PATCH /api/projects/{project_id}`: Update project name, cover, or `pipeline_hint`
- `DELETE /api/projects/{project_id}`: Soft-delete a project; optionally pass `cascade=true` to remove linked task outputs
- `GET /api/projects/{project_id}/overview`: Fetch aggregated data for the project workbench

New public `Project` fields:

- `preview_url`: Derived preview URL, resolved with `cover_url > latest generated result`
- `preview_kind`: Preview resource type, currently `image | video`

`ProjectOverviewResponse` shape:

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

### Workbench Shell Support APIs

- `GET /api/notifications`: Return the workbench notification-center list; currently defaults to `{ "items": [] }`
- `POST /api/notifications/{notification_id}/read`: Mark one notification as read; currently an idempotent no-op
- `POST /api/notifications/read-all`: Mark all notifications as read; currently an idempotent no-op
- `DELETE /api/notifications`: Clear notifications; currently an idempotent no-op

These endpoints keep the Next.js Topbar/notification center contract stable. Even before persisted notifications are implemented, the shell should not produce 404 noise.

---

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Topic or complete script |
| `mode` | string | No | `"generate"` (AI generates) or `"fixed"` (use text as-is) |
| `n_scenes` | int | No | Number of scenes (1-20), only used in generate mode |
| `title` | string | No | Video title (auto-generated if not provided) |
| `style_id` | string | No | Style ID. Quick uses it to resolve runtime defaults |
| `frame_template` | string | No | Template path, e.g., `1080x1920/image_default.html` |
| `template_params` | object | No | Custom template parameters (colors, backgrounds, etc.) |
| `media_workflow` | string | No | Media workflow (image or video generation) |
| `tts_workflow` | string | No | TTS workflow |
| `ref_audio` | string | No | Reference audio path for voice cloning |
| `prompt_prefix` | string | No | Image style prefix |
| `bgm_mode` | string | No | `none` / `default` / `custom` |
| `bgm_path` | string | No | BGM file path |
| `bgm_volume` | float | No | BGM volume (0.0-1.0, default 0.3) |

---

## Style and Resource Endpoints

- `GET /api/resources/styles`: List built-in and custom style summaries
- `POST /api/resources/styles`: Create a custom style
- `GET /api/resources/styles/{style_id}`: Read full style detail
- `PUT /api/resources/styles/{style_id}`: Update a custom style
- `DELETE /api/resources/styles/{style_id}`: Delete a custom style
- `GET /api/resources/bgm`: List BGM files, enriched with `linked_style_id` / `linked_style_name`
- `GET /api/library/bgm?style_id=...`: Filter library BGM items by linked style

### Precedence

- BGM resolution follows: **explicit request value > style runtime default > current system default**
- `bgm_mode=none` explicitly disables default BGM injection
- Digital Human, I2V, Action Transfer, and Custom Async also accept task-level `bgm_mode`, `bgm_path`, and `bgm_volume`

## More Information

API documentation is also available via Swagger UI: `http://localhost:8000/docs`
