# 快速创造（Standard）Pipeline 技术分析

> 本文档系统梳理 **快速创造（Quick Create / Standard Pipeline）** 从前端 UI 到 ComfyKit / RunningHub / API 直连 / Edge-TTS 的完整调用链路，并给出关键设计观察与风险点。
>
> 入口文件：`web/pages/01_quick_create.py` → `web/pipelines/standard.py:StandardPipelineUI` → `pixelle_video/pipelines/standard.py:StandardPipeline`
>
> 行文格式与同目录下 [`digital_human_pipeline.md`](./digital_human_pipeline.md) 对齐，便于交叉对照。

---

## 一、整体定位

快速创造要做的事：**一个想法（话题或固定文案）→ 一段带配音、字幕、可选转场和 BGM 的短视频**。它是项目里**最长的流水线**——一次 generate 涉及 N 帧并发处理，每帧又是 4 步串行子流程：

```
 想法/文案 ──► (Step1) LLM 拆分镜旁白 ──┐
                                         │
                ┌── narration[i] ────────┴── (per-frame, 并行 N 帧) ──┐
                │                                                       │
                │  Step1 TTS  ──►  audio[i].mp3                          │
                │  Step2 Media ──► image[i] / video[i]   (可选)          │
                │  Step3 Compose HTML ──► composed[i].png                │
                │  Step4 ffmpeg pack  ──► segment[i].mp4                 │
                │                                                       │
                └─────────────────────────► segment 列表 ◄──────────────┘
                                                  │
                                       (Step5) ffmpeg 拼接（可加 xfade）
                                                  │
                                          (可选 Step6) 加 BGM
                                                  │
                                              final.mp4
```

涉及 5 个层次：

```
UI 层 → Pipeline 编排层（Linear template-method）→ 服务层（LLM/TTS/Media/HTML/Video）
      → ComfyKit 调度层 → ComfyUI / RunningHub / API 提供方 / Edge-TTS / Playwright / FFmpeg
```

文件入口：`web/pipelines/standard.py:31` 的 `StandardPipelineUI.render()`，最终落到 `pixelle_video/pipelines/standard.py:55` 的 `StandardPipeline`。

---

## 二、UI 层：三栏 + 单/批量双模式

`StandardPipelineUI.render()`（`web/pipelines/standard.py:47-86`）把界面切成三列，组件全部复用：

| 列 | 内容 | 关键函数 |
|---|---|---|
| 左 | 内容输入 + BGM + TTS | `render_content_input()` / `render_bgm_section()` / `render_tts_section()` |
| 中 | 模板 + 媒体工作流 | `render_style_config()` |
| 右 | 视频设置（字幕/转场）+ 生成按钮 + 进度 + 预览 | `render_output_preview()` |

中列产出的 `style_params` 在右列被 dict-merge 进 `video_params`，最终调用 `pixelle_video.generate_video(**video_params)`。**这是整个 UI 与后端唯一的交接点**（`output_preview.py:257`）。

### 2.1 左列：内容输入 — `render_content_input()`

`web/components/content_input.py:23-187`。**单 / 批量** 一个 checkbox 切：

#### 2.1.1 单任务模式（默认）

- **Processing Mode（horizontal radio）**：`generate` vs `fixed`
  - `generate`：**话题模式** — 用户给一句话，LLM 生成 N 个分镜旁白
  - `fixed`：**剧本模式** — 用户给完整文案，按 `paragraph / line / sentence` 切分（参数 `split_mode`）
- **text_area**：内容主体，placeholder 和高度随 mode 切换
- **title**：可选标题（留空则后端自动生成）
- **n_scenes** slider：3–30（**fixed 模式下被忽略**，UI 上有提示）

返回：
```python
{
  "batch_mode": False, "mode": "generate"|"fixed",
  "text": "...", "title": "...",
  "n_scenes": 5, "split_mode": "paragraph"|"line"|"sentence"
}
```

#### 2.1.2 批量模式

按行拆分多个 topic（最多 100 个），统一共享 `n_scenes` 和后续所有配置，在右列由 `web/utils/batch_manager.py:SimpleBatchManager` 串行调度。批量模式**强制 mode=generate**，不支持固定文案。

返回：
```python
{
  "batch_mode": True, "topics": [...], "mode": "generate",
  "title_prefix": "...", "n_scenes": 5
}
```

### 2.2 左列：BGM — `render_bgm_section()`

- 扫 `bgm/` + `data/bgm/`（`list_resource_files`）下所有 audio 文件
- 默认选中 `default.mp3`（如果存在）
- 选了 BGM 才显示 `bgm_volume` slider（0.0–0.5，默认 0.2）
- 提供"试听"按钮（`st.audio()`）

返回 `{bgm_path, bgm_volume}`。`bgm_path` 是**文件名**，由后端 `_resolve_bgm_path` 二次解析。

### 2.3 左列：TTS — `render_tts_section()`

`web/components/style_config.py:783+`。两种 inference_mode：

| Mode | 说明 | 关键参数 |
|---|---|---|
| `local` | **Edge TTS**（微软在线服务，无依赖） | `tts_voice`（默认 `zh-CN-YunjianNeural`）+ `tts_speed`（0.5–2.0） |
| `comfyui` | ComfyUI / RunningHub / Selfhost TTS workflow | `tts_workflow`（如 `runninghub/tts_xxx.json`）+ 可选 `ref_audio` |

注意：local 模式下需要联网访问 Edge TTS（`pixelle_video/utils/tts_util.py:edge_tts`），不是真正的"本地推理"。

### 2.4 中列：模板 + 媒体工作流 — `render_style_config()`

#### 2.4.1 模板选择

`web/components/style_config.py:117-318`。两层选择：

1. **模板类型 radio**：`static / image / video`
   - `static`：纯文字模板，**不调用任何媒体生成**（最快、零成本）
   - `image`：模板里有 `{{image}}` 占位符，需要 AI 出图
   - `video`：模板里有视频占位符，需要 AI 出视频
2. **模板尺寸 tab**（如 `1080x1920`）+ **缩略图九宫格**（`docs/images/{size}/{name}.jpg`）

模板路径形如 `1080x1920/image_default.html`，关键约定：

| 元数据 | 来源 | 用途 |
|---|---|---|
| **画面尺寸** `(width, height)` | 解析路径目录名（`parse_template_size`） | Playwright viewport |
| **媒体尺寸** `(media_width, media_height)` | 模板内 `<meta name="template:media-width/height">` | 喂给图像/视频模型的目标分辨率 |
| **自定义参数** | 模板里 `{{name:type=default}}` DSL | 渲染前再开一组 streamlit 控件 |

`HTMLFrameGenerator(template_path).get_media_size()`（`pixelle_video/services/frame_html.py:159-174`）会先看 meta，缺失则 fallback 到 1024×1024 并打 warning。

#### 2.4.2 媒体生成工作流（`image` / `video` 模板才显示）

源选择和数字人 pipeline 一致，三选一：

| Source | 说明 | 工作流文件 |
|---|---|---|
| `runninghub` | 云端付费，最快上手 | `workflows/runninghub/image_*.json` 或 `video_*.json`（内部只有 `{source, workflow_id}` 指针） |
| `selfhost` | 自建 ComfyUI | `workflows/selfhost/*.json`（完整 workflow JSON） |
| `api` | 直连 API 提供商 | `api/<provider>/<model>` 形式的虚拟 key |

`api` 模式 **video 还要求** `required_adapter_abilities=["text_to_video"]` 且 `verified_only=True`（`web/components/style_config.py:557-560`）—— 即只列出"已校验过 text-to-video 能力"的提供商（DashScope wan2.2-t2v、Volcengine Seedance 等）。

`prompt_prefix` 文本框：拼到每个分镜 prompt 前面（`build_image_prompt(prefix, prompt) → "prefix, prompt"`），用来锁定整体画面风格。**不写盘**（不会写回 config，仅本次生效）。

### 2.5 右列：视频设置（字幕 + 转场）— `render_output_preview()` 上半段

`web/components/output_preview.py:79-151`。两个折叠面板：

- **字幕**：单个 `show_subtitle` selectbox（默认 OFF），合并进 `template_params["show_subtitle"]`
- **转场**：从 14 种 ffmpeg xfade 预设中选 + 0.2-2.0s 的 `transition_duration`
  - `none`（默认）：硬切，走 ffmpeg `concat demuxer` 零编码快速通道
  - 其它值：触发 `_concat_with_xfade`（**全段重编码**，详见 §4.5）

### 2.6 右列：生成按钮 → 后端

最终 `video_params` 大约长这样（`output_preview.py:225-256`）：

```python
{
  "text": "...", "mode": "generate", "title": None,
  "n_scenes": 5, "split_mode": "paragraph",
  "media_workflow": "runninghub/image_flux.json" | "api/dashscope/...",
  "api_video_params": None | {"video_ratio":"9:16", ...},
  "frame_template": "1080x1920/image_default.html",
  "prompt_prefix": "anime style",
  "bgm_path": "default.mp3", "bgm_volume": 0.2,
  "transition": None | "fade", "transition_duration": 0.5,
  "media_width": 1024, "media_height": 1024,
  "tts_inference_mode": "local",
  "tts_voice": "zh-CN-YunjianNeural", "tts_speed": 1.2,
  # 或：tts_workflow / ref_audio（comfyui 模式）
  "template_params": {"show_subtitle": False, "<custom>": "..."},
  "progress_callback": <fn>,
}
```

```python
result = run_async(pixelle_video.generate_video(**video_params))
# 默认 pipeline="standard"，路由到 StandardPipeline（service.py:297）
```

---

## 三、Pipeline 编排：Linear Template-Method

### 3.1 LinearVideoPipeline（基类）

`pixelle_video/pipelines/linear.py:84-122`。把视频生成拆成 **8 个 lifecycle 方法**，由基类 `__call__` 串起来执行。所有状态都装在 `PipelineContext` 数据类里（`linear.py:34-63`），跨步骤透传。

```
1. setup_environment      ─► 建 task_dir、task_id、final_video_path
2. generate_content       ─► narrations
3. determine_title        ─► title
4. plan_visuals           ─► image_prompts
5. initialize_storyboard  ─► StoryboardConfig + Storyboard + 帧列表
6. produce_assets         ─► 每帧并行/串行跑 FrameProcessor
7. post_production        ─► concat 拼接 + 可选 BGM
8. finalize               ─► 落盘 metadata + storyboard.json
```

异常会落到 `handle_exception`，仅 logger.error，**不做回滚**（任务目录会留下半成品）。

### 3.2 StandardPipeline（具体实现）

`pixelle_video/pipelines/standard.py:55+`，逐步说明。

#### Step 1：`setup_environment` (`:78-104`)

```python
task_dir, task_id = create_task_output_dir()
# data/output/<YYYY-MM-DD>/<task_id>/
ctx.final_video_path = get_task_final_video_path(task_id)
# data/output/<...>/<task_id>/final.mp4
```

支持 `output_path` 参数自定义目标位置（`post_production` 阶段会再 `shutil.copy2` 一份过去）。

#### Step 2：`generate_content` (`:106-129`)

进度上报：`generating_narrations` / `splitting_script`，5%。

| Mode | 实现 | 关键文件 |
|---|---|---|
| `generate` | 调 LLM 生成 N 个 narration | `utils/content_generators.py:generate_narrations_from_topic` + `prompts/topic_narration.py` |
| `fixed` | 按 `split_mode` 切分用户脚本 | `utils/content_generators.py:split_narration_script`（**不调 LLM**，纯字符串处理） |

`generate` 模式的 prompt（`prompts/topic_narration.py:20`）—— **整段 system prompt 是英文写的**，仅靠"按用户输入语言输出"的软性指令约束语言。这是导致**有时 narration 出现英文**的根因（参见 §6 风险点）。

`fixed` 模式三种 split_mode：
- `paragraph`：按 `\n\s*\n` 双空行切，**保留段内单换行**（适合带韵律的口播稿）
- `line`：每行一个分镜
- `sentence`：按 `[。.!?！？]` 切，自动合并多余空白

#### Step 3：`determine_title` (`:131-152`)

策略由 mode 决定：
- `generate` 模式：调 `generate_title(strategy="auto")` —— 内容 ≤15 字直接用，否则走 LLM
- `fixed` 模式：强制 `strategy="llm"`，因为完整脚本作为标题不合适

用户 UI 上填了 `title` 就直接覆盖，不调 LLM。

#### Step 4：`plan_visuals` (`:154-227`)

先解析 `frame_template` 的 type：

```python
template_type = get_template_type(template_name)
template_requires_media = template_type in ["image", "video"]
```

- **`static`**：跳过整段 image prompt 生成，`ctx.image_prompts = [None] * N`（**这是关键的成本优化点** —— 一次 generate 省掉 N 次 LLM 调用 + N 次媒体生成）
- **`image` / `video`**：调 `generate_image_prompts` 拿 base prompts → 套上 `prompt_prefix` → 写回 ctx

`generate_image_prompts`（`content_generators.py:269+`）有 **batch + retry 机制**：默认 10 个 narration 一批，最多重试 3 次。每批失败会拆成更小的批次再试。

进度回调精细到批级（0.15 → 0.30）。

`prompt_prefix` 用 try/finally **临时覆写** `core.config["comfyui"]["image"]["prompt_prefix"]`，结束后恢复 —— 防止漏写回的污染（`:217-220`）。

#### Step 5：`initialize_storyboard` (`:229-292`)

把所有上下文打包成 `StoryboardConfig` + `Storyboard` 对象，**这是 produce_assets 的唯一参数**。

TTS 参数有兼容老 API 的兜底（`:240-252`）：
- 新 API：`tts_inference_mode + tts_voice + tts_workflow`
- 老 API：`voice_id + tts_workflow`
- 默认音色：`zh-CN-YunjianNeural`

每帧创建一个 `StoryboardFrame(index, narration, image_prompt, ...)`，**填好待加工的元数据，但所有产出路径还是空**。

#### Step 6：`produce_assets` (`:294-407`) — 核心耗时

按是否走 RunningHub 分两条路：

```python
is_runninghub = (
    config.tts_workflow.startswith("runninghub/") or
    config.media_workflow.startswith("runninghub/")
)
runninghub_concurrent_limit = config.comfyui.runninghub_concurrent_limit or 1
```

**两条路对照**：

| 条件 | 处理方式 | 进度区间 |
|---|---|---|
| `is_runninghub` 且 limit > 1 | `asyncio.Semaphore(limit)` + `asyncio.gather()` 并发处理所有帧 | `0.20 + (0.60 * completed_count / N)` |
| 其他 | 串行 for 循环 | 同公式但 `completed_count` 换成 `i` |

**两条路都走 `core.frame_processor(frame, storyboard, config, ...)`** —— 真正的活在那里干。

并行逻辑里有个**闭包陷阱预防**：每个 task 内部 `nonlocal completed_count`，进度回调用的是 `completed_count` 而不是 `i`，否则进度会乱跳（先完成的小帧会让进度先涨）。

并行完成后按 `(idx, frame)` 排序写回 `storyboard.frames`，保证最终拼接顺序与 narration 顺序一致。

#### Step 7：`post_production` (`:409-440`)

调用 `VideoService.concat_videos`（`pixelle_video/services/video.py:108+`）：

```python
final_video_path = video_service.concat_videos(
    videos=[frame.video_segment_path for frame in storyboard.frames],
    output=ctx.final_video_path,
    bgm_path=ctx.params.get("bgm_path"),
    bgm_volume=ctx.params.get("bgm_volume", 0.2),
    bgm_mode=ctx.params.get("bgm_mode", "loop"),
    transition=ctx.params.get("transition"),
    transition_duration=ctx.params.get("transition_duration", 0.5),
)
```

拼接策略选择见 §4.5。

如果用户传了 `output_path`，最终再 `shutil.copy2` 一份过去（`:432-438`）。

#### Step 8：`finalize` (`:442-466`)

构造 `VideoGenerationResult(video_path, storyboard, duration, file_size)` 并落盘：

```python
await self.core.persistence.save_task_metadata(task_id, metadata)
await self.core.persistence.save_storyboard(task_id, storyboard)
```

**持久化失败不抛异常**（`:518-520`），只是 logger.error，避免拖累已生成的视频。

---

## 四、单帧加工：`FrameProcessor`（关键路径）

`pixelle_video/services/frame_processor.py:32+`，每帧四步串行。

### 4.1 Step 1：TTS 生成 audio

`_step_generate_audio`（`:151-195`）：

```python
output_path = get_task_frame_path(task_id, frame.index, "audio")
# data/output/<...>/<task_id>/frame_<i>_audio.mp3
audio_path = await self.core.tts(
    text=frame.narration,
    inference_mode=config.tts_inference_mode,
    voice=config.voice_id, speed=config.tts_speed,
    workflow=config.tts_workflow, ref_audio=config.ref_audio,
    output_path=output_path, index=frame.index + 1,
)
frame.audio_path = audio_path
frame.duration = await self._get_audio_duration(audio_path)  # ffprobe
```

`TTSService.__call__`（`services/tts_service.py:65-139`）按 mode 分流：

- **local**：`edge_tts(text, voice, rate=speed_to_rate(speed), output_path)`（`utils/tts_util.py`）—— 走微软 Edge TTS WSS 通道，**需联网**
- **comfyui**：`kit.execute(workflow_id_or_path, {"text", "voice", "speed", "ref_audio"})` —— 内部派发到 RunningHub / Selfhost / 本地 ComfyUI

**重要副作用**：`frame.duration = audio_duration`，后续视频步骤会用这个时长来对齐画面（见 4.2）。

### 4.2 Step 2：媒体生成 image / video（可选）

`_step_generate_media`（`:197-278`）：

判断 media_type：
```python
workflow_name = config.media_workflow or ""
template_type = get_template_type(config.frame_template)
is_video_workflow = "video_" in workflow_name.lower() or template_type == "video"
media_type = "video" if is_video_workflow else "image"
```

构造参数：
```python
media_params = {
    "prompt": frame.image_prompt,           # 已带 prefix
    "workflow": config.media_workflow,
    "media_type": "video" | "image",
    "width": config.media_width,             # 来自模板 meta
    "height": config.media_height,
    "output_path": output_path,
    "image_path": frame.image_path,          # 通常 None，asset_based 才有
    "index": frame.index + 1,
}
if is_video_workflow and frame.duration:
    media_params["duration"] = frame.duration   # ★ 关键：把音频时长喂给视频模型
media_params.update(api_video_params)            # video_ratio 等
media_result = await self.core.media(**media_params)
```

**`MediaService.__call__`**（`services/media.py:118+`）的派发：

```python
if workflow.startswith("api/"):
    return await self.core.api_media(...)        # services/api_media.py（直连 DashScope/Seedance/...）
else:
    kit = await self.core._get_or_create_comfykit()
    workflow_input = workflow_id if runninghub else workflow_path
    result = await kit.execute(workflow_input, params)
    # 返回 ExecuteResult.images / .videos / ...
```

返回值处理：
- `media_result.is_image` → `_download_media` 下载到本地 → `frame.image_path`
- `media_result.is_video` → 下载视频 → `frame.video_path` → `frame.duration` 用视频实际时长**覆盖音频时长**（视频模型实际产出可能略偏离请求时长）

**video 工作流的 `duration` 参数**：UI 上没有显式控件，是隐式由 audio 时长喂给视频模型的（`:237-239`）。如果模型不支持 duration（例如某些固定 5s 的 API 模型），就会被忽略，下游靠 `merge_audio_video` 的 freeze/trim 逻辑兜底。

### 4.3 Step 3：HTML 合成 — `_compose_frame_html`

`_step_compose_frame`（`:317-386`）。这是把"AI 出的图/视频"和"HTML 模板"结合的关键：

```python
template_path = resolve_template_path(config.frame_template)
generator = HTMLFrameGenerator(template_path)
ext = {"index": frame.index + 1, **custom_template_params}
show_subtitle = template_params.pop("show_subtitle", True)  # ★ 不进 HTML
media_path = frame.video_path if frame.media_type == "video" else frame.image_path

composed_path = await generator.generate_frame(
    title=storyboard.title,
    text=frame.narration if show_subtitle else "",
    image=media_path,
    ext=ext,
    output_path=output_path,
)
frame.composed_image_path = composed_path
```

**`HTMLFrameGenerator.generate_frame`** (`services/frame_html.py:399+`)：

1. 把 `image` 路径转成 `file://` URI（如果是本地）
2. 把 `{{title}}/{{text}}/{{image}}/{{index}}/<custom>` 等占位符替换进模板字符串
3. 写到 tmp html 文件
4. **Playwright launch**（懒初始化的 chromium 单例，跨事件循环会自动重建 — `_browser_loop` 校验，`:312-340`）
5. `page = browser.new_page(viewport=(width,height), device_scale_factor=_SUPERSAMPLE=2)` ← **2× 超采样**
6. `page.goto(file://..., wait_until='networkidle')`
7. `page.screenshot(path=output, type='png', omit_background=True)` ← omit_background 给 video 模板用透明 PNG
8. **PIL Lanczos 降采样**回模板声明尺寸（`_downsample_to_template_size`），保证下游契约不变

> 注：超采样和降采样是 P0 优化（commit pending），目的是消除文字/边框边缘的 1× 抗锯齿模糊。详见 [`docs/tech-analysis/quick_create_pipeline.md` §6 P0 改动](#)。

`omit_background=True` + 模板里 `body { background: transparent }` 是 video 模板的**核心约定** —— composed PNG 透明，后面 ffmpeg overlay 才能露出真视频。

### 4.4 Step 4：合成 segment.mp4 — `_step_create_video_segment`

`:388-451`，按 media_type 分两支：

#### 4.4.1 image 分支

```python
segment_path = video_service.create_video_from_image(
    image=frame.composed_image_path,
    audio=frame.audio_path,
    output=output_path,
    fps=config.video_fps,  # 30
)
```

`create_video_from_image`（`services/video.py:743+`）的核心 ffmpeg 调用（**P0 优化后**）：

```python
ffmpeg.input(image, loop=1, framerate=fps)
ffmpeg.input(audio)
.output(
    output, t=audio_duration,            # 强制视频时长 = 音频时长
    vcodec='libx264', acodec='aac',
    pix_fmt='yuv420p', audio_bitrate='192k',
    preset='medium', crf=18,             # P0：原 crf=23 + b:v=2M
)
```

`crf=18` 让 libx264 按质量自由分配比特率，渐变背景不再色块化。

#### 4.4.2 video 分支

两步 ffmpeg：

**Step A — overlay HTML on video**：
```python
video_service.overlay_image_on_video(
    video=frame.video_path,
    overlay_image=frame.composed_image_path,  # 透明 PNG
    output=temp_video_with_overlay,
    scale_mode="contain",   # AI 视频 letterbox 进模板尺寸
)
```

`scale_mode` 三档（`services/video.py:656-741`）：
- `contain`：保持宽高比 + 黑边填充
- `cover`：保持宽高比 + 裁剪
- `stretch`：拉伸

**Step B — 替换音频为旁白**：
```python
segment_path = video_service.merge_audio_video(
    video=temp_video_with_overlay,
    audio=frame.audio_path,
    output=output_path,
    replace_audio=True,
    audio_volume=1.0,
)
```

`merge_audio_video`（`video.py:442+`）有**智能时长对齐**：
- video < audio：用 `tpad` freeze 最后一帧补齐（默认）或填黑
- video > audio + tolerance：trim 视频
- 差值在 `duration_tolerance=0.3s` 内：keep as-is

完成后删除 `temp_video_with_overlay.mp4`。

---

## 五、最终拼接与 BGM

### 5.1 `concat_videos` 三种策略

`services/video.py:108-193`：

```python
use_xfade = bool(transition) and transition != "none" and transition_duration > 0
if use_xfade:
    return _concat_with_xfade(...)             # 慢，全段重编码
elif method == "demuxer":  # 默认
    return _concat_demuxer(...)                # 极快，stream copy
else:
    return _concat_filter(...)                 # 中等，concat filter
```

**默认走 demuxer**（`-f concat -c copy`）：因为所有 segment 都来自同一模板，宽高、帧率、像素格式天然一致，可以直接 stream-copy 到一起，**零编码**。

启用转场后只能 `_concat_with_xfade`（`:281-396`），用 `xfade` filter 做视频过渡 + `acrossfade` 做音频淡入淡出。每个 clip 必须长于 `transition_duration`，代码里自动 clamp 到 `min(duration, min_clip_duration * 0.4)` 防止越界（`:329-335`）。

xfade 路径强制重编码：`libx264 -preset medium -crf 23 -pix_fmt yuv420p`。

### 5.2 BGM 注入

如果有 `bgm_path`：先 `_raw_concat()` 到 temp 文件 → `_add_bgm_to_video()` 混音 → 删 temp。

`_add_bgm_to_video`（`:906+`）调 `add_bgm`（`:819+`）：
- BGM `volume` 滤波到 0.0–1.0
- `mode == "loop"` → `stream_loop=-1` 让 BGM 循环
- `amix` 滤波器混合 narration 和 BGM，`duration='first'` 用主视频时长封顶
- **视频 stream-copy**（`vcodec='copy'`），只重编码音频 → 快

### 5.3 资源文件解析

`_resolve_bgm_path`（`video.py:964-1008`）三级 fallback：
1. 直接路径（绝对或相对）
2. `data/bgm/<filename>`
3. `bgm/<filename>`

UI 选择列表也是这两个目录的合并（`bgm_section` 里的 `list_resource_files("bgm")`），**用户自己往 `data/bgm/` 丢 mp3 即可热加载**。

---

## 六、关键设计观察 & 风险点

### 6.1 设计亮点

1. **Template Method + Context dataclass**（`linear.py`）让流水线步骤清晰可测试，并且 `PipelineContext` 把所有跨步状态收口在一个对象里，便于 debug 和后续衍生新 pipeline（custom / asset_based / digital_human 都继承同一基类）。

2. **TTS 时长驱动视频时长**（`frame_processor.py:237`）—— 让"画面长度永远等于配音长度"，避免最常见的"视频结尾配音被吞 / 黑屏" 问题。这是相对其他视频生成开源项目的明显差异点。

3. **静态模板的成本优化路径**（`standard.py:223-227`）：识别 `static_*.html` 后**完全跳过** `generate_image_prompts` + `media` 调用，N 次 LLM + N 次 ComfyUI 全省。

4. **共享 ComfyKit 实例 + 配置哈希**（`service.py:_get_or_create_comfykit`）：每次生成视频不重建客户端，但配置变了会自动重建。**digital_human 没用 concurrent_limit、standard 用了** —— 是因为 standard 是按帧并行，需要节流。

5. **HTMLFrameGenerator 的 viewport meta 双层设计**：模板路径决定**画面尺寸**，模板内 meta 决定**AI 媒体尺寸**。这样同一套 1080×1920 画面可以喂给 1024×1024 的 SD 或 1080×1920 的 wan 视频模型，**两者解耦**。

### 6.2 风险点 / 待改进

1. **🔴 LLM 文案 prompt 是英文写的**（`prompts/topic_narration.py:20`）：当用户输入语言信号弱（短输入、含英文产品名）时，模型有概率把 narration 输出成英文。中文 TTS 音色（`zh-CN-YunjianNeural`）拿到英文文本会按字母拼读，听感是"英文配音"。**修复**：要么把 prompt 改成中文优先的硬约束，要么 UI 加显式 `output_language` 开关并联动 TTS 默认音色。

2. **🔴 失败不回滚**（`linear.py:159-161`）：任意一步抛异常，task_dir 留下半成品（部分音频/图片/segment），且 metadata 不会落盘 → 后续 history 页看不到这次失败。建议改成"标记 status=failed 并落盘 partial metadata"，至少能调试。

3. **🟡 RunningHub 任务无超时**（与 digital_human 同问题）：`_wait_for_task_completion` 无限轮询。当 RH 端长尾或队列堵塞时，前端进度条卡死在某帧 80% 不动。

4. **🟡 静态模板模式仍调 LLM 生成 narration 和 title**：虽然媒体生成跳了，但 `generate_content` + `determine_title` 还是要打 LLM。**特别在 fixed 模式 + static 模板下**，title 仍走一次 LLM（`standard.py:151`），这一步其实可以从首段截字。

5. **🟡 `prompt_prefix` 临时覆写不是线程安全的**（`standard.py:182-220`）：`image_config["prompt_prefix"] = prompt_prefix` 直接改的是 `core.config` 的内层 dict，如果 batch 模式下并发跑多个 pipeline（目前是串行所以暂时安全），prefix 会互相污染。建议改成 dataclass 传参。

6. **🟡 进度模型只有"帧粒度"**（`standard.py:319-356`）：单帧内部的 4 步（audio/media/compose/segment）虽然有 `frame_step` 事件，但 UI 上只是一行文字 + 一根总进度条，看不出"卡在哪一步"。Step 2 是耗时大头，建议每帧拆 4 段子进度条。

7. **🟢 `device_scale_factor=2` 后 PNG 临时文件 4× 体积**（`frame_html.py`）：渲染期间内存占用上涨。Playwright 截图后立刻 PIL 降采样回原尺寸覆盖，最终留盘体积不变，但**渲染瞬间峰值** 4× —— 高分辨率（4K）模板上要小心 OOM。

8. **🟢 xfade 路径双重压缩**：`create_video_from_image` 用 `crf=18` 输出，再被 `_concat_with_xfade` 用 `crf=23` 重编码，启用转场时画质明显回退。建议把 xfade 也调到 `crf=18-20`。

9. **🟢 batch 模式无错误隔离测试**：`SimpleBatchManager` 串行，单个失败不会终止后续 —— 但失败 task 的 partial 文件不会清，长 batch 下磁盘占用会涨。

---

## 七、调用矩阵速查

按用户配置组合的实际路径：

| 模板类型 | 媒体源 | LLM 调用 | 媒体调用 | TTS | 拼接 | 典型耗时 (5 帧) |
|---|---|---|---|---|---|---|
| `static` | — | 仅 narration + title | **跳过** | edge / comfyui | demuxer copy | ~30-60s |
| `image` | runninghub | narration + title + N image_prompts | RH N 张图 | edge | demuxer copy | ~3-5min |
| `image` | selfhost | 同上 | local ComfyUI | edge | demuxer copy | 视显卡 |
| `image` | api | 同上 | DashScope / etc. | edge | demuxer copy | ~2-3min |
| `video` | runninghub | 同上 | RH N 个视频 | edge | demuxer copy | ~6-12min |
| `video` | api (text-to-video) | 同上 | wan2.2 / Seedance | edge | demuxer copy | ~5-8min |
| 任意 + 转场 | 任意 | 同上 | 同上 | edge | **xfade 全重编码** | +30-60s |
| 任意 + BGM | 任意 | 同上 | 同上 | edge | concat + 音频 amix | +5-10s |

---

## 附：关键文件索引

| 层级 | 文件 | 作用 |
|---|---|---|
| UI 入口 | `web/pages/01_quick_create.py` | Streamlit 多页路由入口 |
| UI Pipeline | `web/pipelines/standard.py` | `StandardPipelineUI` 三栏布局 |
| UI 子组件 | `web/components/content_input.py` | 内容输入 + 批量 + BGM |
| UI 子组件 | `web/components/style_config.py` | 模板 + 媒体工作流 + TTS |
| UI 子组件 | `web/components/output_preview.py` | 字幕/转场设置 + 生成 + 预览 |
| UI 工具 | `web/utils/batch_manager.py` | 批量任务串行调度 |
| 核心服务 | `pixelle_video/service.py` | `PixelleVideoCore` 单例 + pipeline 注册 |
| 编排基类 | `pixelle_video/pipelines/linear.py` | `LinearVideoPipeline` + `PipelineContext` |
| **本文主角** | `pixelle_video/pipelines/standard.py` | `StandardPipeline` 8 步实现 |
| 单帧加工 | `pixelle_video/services/frame_processor.py` | `FrameProcessor` 4 步实现 |
| LLM 文案 | `pixelle_video/utils/content_generators.py` | `generate_narrations_*` / `split_narration_script` / `generate_image_prompts` |
| Prompts | `pixelle_video/prompts/topic_narration.py` 等 | 内部 LLM prompt 模板 |
| TTS | `pixelle_video/services/tts_service.py` | local / comfyui 双模式分流 |
| TTS 工具 | `pixelle_video/utils/tts_util.py` | Edge TTS WSS 实现 |
| 媒体生成 | `pixelle_video/services/media.py` | ComfyKit / API 派发 |
| 媒体 (API) | `pixelle_video/services/api_media.py` | 直连 DashScope/Seedance/Volcengine |
| HTML 渲染 | `pixelle_video/services/frame_html.py` | Playwright + PIL 降采样 |
| 视频处理 | `pixelle_video/services/video.py` | concat / overlay / merge / BGM (ffmpeg) |
| 数据模型 | `pixelle_video/models/storyboard.py` | `Storyboard` / `StoryboardFrame` / `StoryboardConfig` |
| 模板工具 | `pixelle_video/utils/template_util.py` | 路径解析 / 类型识别 / 尺寸解析 |
| 资源 | `templates/<size>/*.html` | HTML 帧模板（25 个 1080×1920） |
| 资源 | `bgm/` + `data/bgm/` | BGM 音频 |
| 配置 | `pixelle_video/config/schema.py` | `runninghub_concurrent_limit` / TTS 默认音色 等 |
