# Config Schema

Detailed explanation of the `config.yaml` configuration file.

---

## Configuration Structure

```yaml
llm:
  api_key: "your-api-key"
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  model: "qwen-plus"

api_providers:
  ssycloud:
    api_key: "your-ssycloud-api-key"
    base_url: "https://router.shengsuanyun.com/api/v1/tasks/generations"
    use_proxy: false

comfyui:
  comfyui_url: "http://127.0.0.1:8188"
  comfyui_api_key: ""  # ComfyUI API key (optional)
  runninghub_api_key: ""
  runninghub_concurrent_limit: 1  # Concurrent limit (1-10)
  runninghub_instance_type: ""  # Instance type (optional, set to "plus" for 48GB VRAM)
  
  image:
    default_workflow: "runninghub/image_flux.json"
    prompt_prefix: "Minimalist illustration style"
  
  video:
    default_workflow: "runninghub/video_wan2.1_fusionx.json"
    prompt_prefix: "Minimalist illustration style"
  
  tts:
    default_workflow: "selfhost/tts_edge.json"

template:
  default_template: "1080x1920/image_default.html"
```

---

## LLM Configuration

- `api_key`: API key
- `base_url`: API service address (supports any OpenAI-compatible interface)
- `model`: Model name

## SSYCloud Media Provider Configuration

- `api_providers.ssycloud.api_key`: SSYCloud API key
- `api_providers.ssycloud.base_url`: SSYCloud unified API base URL
- `api_providers.ssycloud.use_proxy`: whether to use `api_providers.common.local_proxy`

SSYCloud media configuration is independent from the LLM configuration above. After
selecting the `API models` source in the WebUI, use an `api/ssycloud/...` image or
video model. Models of the same media type reuse the existing project parameters.

---

## ComfyUI Configuration

### Basic Configuration

- `comfyui_url`: Local ComfyUI address (default `http://127.0.0.1:8188`)
- `comfyui_api_key`: ComfyUI API key (optional, for [Comfy Platform](https://platform.comfy.org/profile/api-keys))

### RunningHub Cloud Configuration

- `runninghub_api_key`: RunningHub API key (required for cloud workflows)
- `runninghub_concurrent_limit`: Concurrent execution limit (1-10, default 1 for regular members)
- `runninghub_instance_type`: Instance type (optional)
  - Empty or unset: Use 24GB VRAM machine
  - `"plus"`: Use 48GB VRAM machine (suitable for large video generation)

### Image Configuration

- `default_workflow`: Default image generation workflow
- `prompt_prefix`: Prompt prefix

### Video Configuration

- `default_workflow`: Default video generation workflow
  - `runninghub/video_wan2.1_fusionx.json`: Cloud workflow (recommended, no local setup required)
  - `selfhost/video_wan2.1_fusionx.json`: Local workflow (requires local ComfyUI support)
- `prompt_prefix`: Video prompt prefix (controls video generation style)

### TTS Configuration

- `default_workflow`: Default TTS workflow

---

## Template Configuration

- `default_template`: Default frame template path (e.g., `1080x1920/image_default.html`)

---

## More Information

The configuration file is automatically created on first run.
