# 数字人口播 Pipeline 技术分析

> 本文档系统梳理 **数字人口播（digital_human）** 从前端 UI 到 RunningHub 云端 / DashScope 直连 API 的完整调用链路，并给出关键设计观察与风险点。
>
> 入口文件：`web/pipelines/digital_human.py`

---

## 一、整体定位

数字人口播要做的事：**人物形象 + (可选)商品图 + 文案 → 一段竖屏 9:16 的口播视频**。它不是单一调用，而是一个 **3 步流水线**：

```
 [人物图]+[商品图] ──► (Step1) 合图        ──► 数字人形象图
                                                     │
 文案/商品标题 ──► LLM 生成口播文案 ──► (Step2) TTS ──► 音频
                                                     │
                              ┌──────────────────────┘
                              ▼
                        (Step3) 音驱视频合成 ──► 视频URL ──► 本地 final.mp4
```

整条链路涉及 5 个层次：

```
UI 层 → Pipeline 编排层 → PixelleVideoCore 服务层 → ComfyKit 调度层 → RunningHub / DashScope / Edge-TTS 提供方
```

文件入口：`web/pipelines/digital_human.py:42` 的 `DigitalHumanPipelineUI.render()`。

---

## 二、UI 层：三栏 + 双服务源选择

`DigitalHumanPipelineUI.render()` 把界面分为三列：

| 列 | 内容 | 关键函数 |
|---|---|---|
| 左 | 人物素材上传 + TTS 风格配置 | `render_digital_human_input()` / `render_style_config()` |
| 中 | 工作流来源选择 + 模式选择 | `workflow_path_config()` / `render_digital_human_mode()` |
| 右 | 生成按钮 + 进度 + 预览 | `_render_output_preview()` |

### 2.1 工作流来源选择（核心）— `workflow_path_config()`

这里有 **两个独立的服务源选择**（`digital_human.py:185-307`）：

1. **前置图片生成服务**（合人物+商品图）
   - `runninghub` — 用 `workflows/runninghub/digital_image.json`（带商品标题）或 `digital_customize.json`（仅合图）
   - `selfhost` — 同名文件在 `workflows/selfhost/`
   - `api` — 直连 OpenAI / DashScope / ARK 等图像模型

2. **口播视频合成服务**（音驱图生视频）
   - `runninghub` — `workflows/runninghub/digital_*.json`（除 image/customize 外）
   - `selfhost` — 同上
   - `api` — 必须是 `required_adapter_abilities=["digital_human"]` 且 `verified_only=True` 的提供商（目前主要是 DashScope HappyHorse / Wan 系列）

最终拼出一份 `workflow_config` 字典：

```python
{
  "first_workflow_path":  "workflows/runninghub/digital_image.json",      # 合图+生文案
  "second_workflow_path": "workflows/runninghub/digital_combination.json",# 音驱视频
  "third_workflow_path":  "workflows/runninghub/digital_customize.json",  # 仅合图
  "api_image_workflow":   None | "api/<provider>/<model>",
  "api_video_workflow":   None | "api/<provider>/<model>",
  "api_video_params":     {video_ratio, duration, ...}
}
```

每个 wrapper JSON 里只是 `{"source": "runninghub", "workflow_id": "200..."}` —— 真正的节点定义在 RunningHub 云端。

### 2.2 模式选择 — `render_digital_human_mode()`

用户在中列下方选 `digital` 还是 `customize`：

| 模式 | 输入 | Step1 | Step2 | Step3 |
|---|---|---|---|---|
| **digital** | 人物 + 商品 + (文案 或 标题) | 合人物+商品图 | 文案/标题→口播文案→TTS | 数字人图+音频→视频 |
| **customize** | 只要人物图 + 文案 | **跳过** | 文案直接 TTS | 人物图+音频→视频 |

模式选择决定了执行哪条分支（`digital_human.py:610` 起）。

---

## 三、生成时刻：`_render_output_preview()` 主逻辑

点击生成按钮后（`digital_human.py:501`），整段都跑在一个嵌套的 `async generate_digital_human_video()` 里。先做了一组前置校验（人物图必传、digital 模式商品图必传等），然后按 **3 个互斥分支** 执行：

```
分支 A: api_video_workflow != None  → 单步 API 直连（最简）
分支 B: mode == "customize"        → ComfyKit 单 step（second_workflow）
分支 C: mode == "digital"          → ComfyKit 三步（first/third + tts + second）
```

### 分支 A：直连 API 提供商（`digital_human.py:592-606`）

走 `pixelle_video.media(...)`，跳过 RunningHub。流程：

1. **文案准备**：customize 模式直接用 `goods_text`；digital 模式有 `goods_text` 用之，否则用 LLM 给 `goods_title` 写文案：
   ```python
   await pixelle_video.llm(
       prompt=f"请为商品『{goods_title}』写一段...80字以内...",
       temperature=0.7, max_tokens=300,
   )
   ```
2. **TTS 生成 narration.mp3**（同 B/C 分支一致，见下）。
3. **构造 prompt**：把 `参考图1人物面对镜头自然口播` + `结合参考图2商品...` + 文案拼起来。
4. **一次性调用** `pixelle_video.media(media_type="video", reference_image_paths=[人物,商品], reference_audio_path=audio, audio=True, video_ratio="9:16", duration=5, ...)`。

**`media_type=video` 的实际路径**（`pixelle_video/services/api_media.py:426-467`）：

- 解析 `workflow="api/dashscope/wan2.2-..."` → `provider=dashscope`, `model=wan2.2-...`
- 路由到 `_generate_video()` → `VideoClient.generate_video()` → `_generate_wan()` → `Dashscope_client.generate_video()`
- DashScope 客户端 (`video_dashscope.py:225-260`) 识别为 reference-to-video（r2v）模型，构造 `media` 数组：
  ```python
  for index, ref in enumerate(image_refs):
      item = {"type": "reference_image", "url": _to_media_url(ref)}
      if index == 0 and reference_audio_path:
          item["reference_voice"] = _to_media_url(reference_audio_path)  # 关键：音频绑在第一张图上
      media.append(item)
  ```
- 调用阿里 `dashscope.VideoSynthesis.call(model, prompt, media, duration, audio=True, ...)`，再 `.wait()` 轮询，下载到 `save_path`。

返回 `MediaResult.url` 是**本地 final.mp4 路径**。

### 分支 B & C：ComfyKit / RunningHub 路径

这两支共用一个核心子流程 —— **second_workflow（音驱视频）**，差别只在于前面要不要先合图。

#### 3.1 拿 ComfyKit 实例

```python
kit = await pixelle_video._get_or_create_comfykit()
```

（`pixelle_video/service.py:147-180`）这是个**带配置哈希的懒加载单例**：每次根据当前 `comfyui_url`、`runninghub_api_key`、`runninghub_instance_type` 算 hash，配置变了就重建 `ComfyKit(**kit_config)`。

#### 3.2 ComfyKit.execute 的派发（关键）

`comfykit/executor.py:296-328`：

```python
workflow_str = str(workflow)
if self._is_runninghub_workflow_id(workflow_str):       # 纯数字串
    return await runninghub_executor.execute_by_id(workflow_str, params)
elif self._is_url(workflow_str):                        # http(s)://...
    ...下载到临时文件后用 local_executor...
elif self._is_file_path(workflow_str):
    if is_runninghub_workflow(file):                    # 文件里 source==runninghub
        return await runninghub_executor.execute_workflow(...)
    else:
        return await local_executor.execute_workflow(...)
```

**`digital_human.py` 里特意提前抠出 `workflow_id` 字符串再传**（765-770、834-836 行）：

```python
if workflow_config.get("source") == "runninghub" and "workflow_id" in workflow_config:
    workflow_input = workflow_config["workflow_id"]   # "2003717471859294210"
else:
    workflow_input = str(workflow_config)
```

所以 RunningHub 来源永远走 `_is_runninghub_workflow_id` 那一支，直接 `execute_by_id`。

#### 3.3 RunningHubExecutor.execute_by_id（云端真实调用链）

`comfykit/comfyui/runninghub_executor.py:65-128` 的核心 6 步：

```python
# (1) 拉真实工作流 JSON（云端的节点定义）
workflow_json = await client.get_workflow_json(workflow_id)
# ─► POST /api/openapi/getJsonApiFormat   body: {apiKey, workflowId}

# (2) 把所有 KSampler 节点的 seed 随机化（避免重复结果命中缓存）
workflow_json, seed_changes = self._randomize_seed_in_workflow(workflow_json)

# (3) 解析节点 _meta.title 中的 DSL 标记 ($name / $~name / $name.field)
metadata = WorkflowParser().parse_workflow(workflow_json, ...)

# (4) 把外部传入的 params dict 转换成 nodeInfoList，并在需要时上传媒体文件
node_info_list = await self._convert_params_to_node_info_list(metadata, params, seed_changes)

# (5) 创建任务
task_data = await client.create_task(workflow_id, node_info_list)
# ─► POST /task/openapi/create   body: {apiKey, workflowId, nodeInfoList, instanceType?}
task_id = task_data["taskId"]

# (6) 每 2 秒轮询直到结束
result = await self._wait_for_task_completion(task_id, output_id_2_var)
```

**参数 → 节点的映射（DSL）**（`workflow_parser.py:46-55`）

RunningHub 工作流的每个节点都有 `_meta.title`，里面写形如 `$~videoimage` 的标记：

| DSL 写法 | 含义 |
|---|---|
| `$videoimage` | 把 `params["videoimage"]` 填到这个节点的同名 input field |
| `$videoimage.field` | 填到指定 field |
| `$~videoimage` | 媒体类型，**先 upload** 再填 fileName |
| `$videoimage!` | 必填校验 |

`_convert_params_to_node_info_list` 还有兜底：节点 `class_type` 是 `LoadImage / LoadAudio / LoadVideo / VHS_LoadVideo / VHS_LoadAudioUpload` 的也强制走上传（`base_executor.py:19-26`）。

**媒体上传**（`runninghub_executor.py:263-286`）：

- 本地路径 → `POST /task/openapi/upload`（multipart）→ 返回 `fileName`
- http(s):// URL → 先下载再上传
- 已经是 fileName → 直接用

最终 `nodeInfoList` 里每条形如：

```json
{"nodeId": "37", "fieldName": "image", "fieldValue": "<uploaded-filename-or-string>"}
```

**轮询**（`runninghub_executor.py:317-382`）：

```python
while True:
    status = await client.query_task_status(task_id)   # POST /task/openapi/status
    if status == "SUCCESS":
        outputs = await client.query_task_result(task_id)  # POST /task/openapi/outputs
        return _process_task_result(...)
    elif status == "FAILED":
        return ExecuteResult(status="error", ...)
    elif status in ("QUEUED", "RUNNING"):
        await asyncio.sleep(2)
```

**结果对象**（`comfykit/comfyui/models.py:6-20`）—— `ExecuteResult`：

```python
status, prompt_id, duration, msg
images / audios / videos / texts          # 扁平 URL 列表
images_by_var / audios_by_var / ...       # 按变量名分组
outputs                                   # 原始 raw_data
```

`_process_task_result` 看 `fileType`：mp4/mov/avi/...→ `videos`；png/jpg/...→ `images`；mp3/wav→ `audios`。

#### 3.4 实例规格 & 并发

- `runninghub_instance_type` (UI 上是 24G/48G 二选一，48G 存为 `"plus"`)：在 `runninghub_client.py:249-252` 直接放进 `create_task` 的 body：
  ```python
  if self.instance_type:
      data["instanceType"] = self.instance_type
  ```
  从 `web/components/settings.py:442` → `service.py:126-130` → `ComfyKit` 构造 → client。
- `runninghub_concurrent_limit`：**只在 standard pipeline 里用过**（`pipelines/standard.py:299-313` 用 `asyncio.Semaphore` 控帧并发）。**digital_human 里没有用到这个限制** —— 因为它本来就是串行 3 步，单任务。

---

## 四、Step 详解（按分支 C — digital + RunningHub 完整路径）

这是最复杂的一支（`digital_human.py:684-909`），其它分支都是它的子集。

### Step 1：合图 + 文案（择一执行）

#### 1a. 用户给了 `goods_text`（已有完整文案）

- **API 图像**：`pixelle_video.media(media_type="image", workflow=api_image_workflow, image_paths=[人物,商品], width=1080, height=1920, prompt=...)` → 返回图片 URL
- **RunningHub 图像**：用 `third_workflow_path = digital_customize.json` (id `2010608838151507970`)，参数 `{firstimage: 人物, secondimage: 商品}` → `kit.execute()` → 返回图 URL

→ `generated_text = goods_text`，**跳过 LLM**。

#### 1b. 用户只给了 `goods_title`

- **图像**：API 同上；RunningHub 用 `first_workflow_path = digital_image.json` (id `2004120336125861890`)，参数 `{firstimage: 人物, secondimage: 商品, goodstype: 商品标题}`
- **文案**：API 路径再调一次 `pixelle_video.llm(...)` 写 80 字文案；RunningHub 路径里 `digital_image.json` 内部的 LLM 节点会同时输出文案，从 `synthesis_result.texts[0]` 取出

`digital_image.json` 比 `digital_customize.json` 多了 LLM 节点 —— 所以一次工作流出图 + 出文案。

### Step 2：TTS 生成 narration.mp3

`pixelle_video.tts(**tts_kwargs)` （`pixelle_video/services/tts_service.py:114-130`）：

| inference_mode | 路径 |
|---|---|
| `local` | `edge_tts(text, voice="zh-CN-YunjianNeural", rate=speed_to_rate(speed), output_path)` —— 直接用微软 Edge TTS 本地合成 |
| `comfyui` | 走 `kit.execute(tts_workflow, {text, voice?, speed?, ref_audio?})` —— 仍然可能落到 RunningHub。结果在 `result.audios[0]`，URL 的话再 httpx 下载到 `output_path` |

输出固定写到 `<task_dir>/narration.mp3`。

### Step 3：second_workflow（音驱视频，核心算力）

```python
second_workflow_params = {
    "videoimage": generated_image_url,   # Step1 的图（URL 或本地路径）
    "audio":      audio_path,            # Step2 的本地 mp3
}
second_result = await kit.execute(workflow_id_string, second_workflow_params)
```

`digital_combination.json` (`workflow_id="2003717471859294210"`) 是 RunningHub 上预置的"图+音 → 唇形同步视频"工作流。`execute_by_id` 内部：

1. RunningHub 拉到该 workflow 的真实 JSON
2. 找到带 `$~videoimage`、`$~audio` 标记的节点（或 `LoadImage`/`LoadAudio`），把本地路径上传，URL 替换成 `fileName`
3. 创建任务 → 轮询 → 拿输出
4. 视频 URL 进入 `result.videos`

#### Step 3.5：下载视频到本地

```python
generated_video_url = second_result.videos[0]  # 容错也看 outputs
final_video_path = os.path.join(task_dir, "final.mp4")
async with httpx.AsyncClient(timeout=300) as client:
    response = await client.get(generated_video_url)
    with open(final_video_path, 'wb') as f:
        f.write(response.content)
```

300 秒超时，单文件下载，**没有断点续传 / 流式写入** —— 大视频可能是潜在风险点。

---

## 五、收尾：历史记录 + 预览

```python
final_video_path = run_async(generate_digital_human_video())   # 同步等异步
run_async(save_web_generation_history(
    pixelle_video, task_id, video_path, pipeline="digital_human",
    title=..., input_params={text, mode, goods_title, goods_text,
                             character_assets, goods_assets,
                             workflow_path, tts_voice, tts_speed, tts_inference_mode}
))
```

随后 UI 显示：耗时 / 大小、`st.video()` 预览、下载按钮。**任何异常都被 `try/except` 捕获，调用 `st.error()` + `logger.exception()` + `st.stop()`**。

---

## 六、调用矩阵速查

| 模式 | 服务源 | 文案 | Step1 合图 | Step2 TTS | Step3 视频 | 出口 |
|---|---|---|---|---|---|---|
| customize | runninghub | 用户输入 | （不需要） | TTS | `digital_combination.json` (RH) | RH 视频 URL → 下载 |
| digital + 已有文案 | runninghub | 用户输入 | `digital_customize.json` (RH) | TTS | `digital_combination.json` (RH) | 同上 |
| digital + 只有标题 | runninghub | `digital_image.json` 内嵌 LLM 输出 | `digital_image.json` (RH) | TTS | `digital_combination.json` (RH) | 同上 |
| digital + 只有标题 | api 图像 + RH 视频 | `pixelle_video.llm()` 单独调 | `pixelle_video.media(image)` | TTS | `digital_combination.json` (RH) | 同上 |
| customize / digital | api 视频 | LLM (digital 无文案时) | （API 视频自带，靠 `reference_image_paths`） | TTS | `pixelle_video.media(video, reference_image_paths, reference_audio_path, audio=True)` —— DashScope r2v | 本地 save_path |

---

## 七、关键设计观察 & 风险点

1. **工作流 wrapper 的双层结构**：本地 JSON 只是 `{source, workflow_id}` 这种"指针"，真实节点在云端 —— 优点是发版快、缺点是节点变更感知不到（DSL 标记缺失就静默忽略，错误隐蔽）。

2. **DSL 标记是隐式契约**：UI 端硬编码键名 `firstimage`、`secondimage`、`goodstype`、`videoimage`、`audio`，**必须**和 RH 端节点 `_meta.title` 严格对应，否则参数静默丢失。建议加一层校验：parse 完 metadata 后比对 `params.keys()` vs `mapping_info.param_mappings`。

3. **`digital_human.py` 重复代码严重**：685-798 行（有 `goods_text`）和 800-909 行（无 `goods_text`）的 TTS + Step3 + 下载几乎一字不差，应抽 `_run_step2_tts(...)` / `_run_step3_video_synth(...)` / `_download_video(...)` 三个 helper。

4. **`task_dir` 在分支 C 里被创建了两次**：515 行和 686 行都调 `create_task_output_dir()`，第二次会覆盖第一次（task_id 也会变），导致 history 里记的 task_id 和 narration.mp3 实际所在目录可能不一致。

5. **`workflow_path` 变量在 719 行和 828 行被局部覆盖**：原本是 dict，被赋成 `Path`，**幸好仅作用域内使用**，但容易误读。建议改名 `current_step_workflow_path`。

6. **下载没有流式写入** + 默认 300s timeout —— 长视频/慢网下会失败而无法续传。

7. **`runninghub_concurrent_limit` 在数字人路径上未生效**：UI 让用户配了，但 `digital_human` 不读它。如果要批量或多任务并发，需要补 semaphore。

8. **RH 任务无超时**：`runninghub_executor._wait_for_task_completion` 无限轮询直到 SUCCESS/FAILED，云端长尾会让前端进度条卡死在 65%（前端只在 `progress_bar.progress(65)` 后等 `kit.execute`）。

9. **进度条只有 25/65/100 三档**：Step3（最耗时）期间 UI 看起来"卡住" —— 应在轮询期间给一个动画/计数。

---

## 附：关键文件索引

| 层级 | 文件 | 作用 |
|---|---|---|
| UI | `web/pipelines/digital_human.py` | Pipeline UI + 编排主流程 |
| UI 子组件 | `web/components/digital_tts_config.py` | TTS 模式与音色选择 |
| UI 子组件 | `web/pipelines/api_workflows.py` | API 媒体工作流列表与参数控件 |
| 服务 | `pixelle_video/service.py` | `PixelleVideoCore` 单例（llm/tts/media/_get_or_create_comfykit） |
| 服务 | `pixelle_video/services/tts_service.py` | TTS 路由（local/comfyui） |
| 服务 | `pixelle_video/services/media.py` | 媒体生成总入口（区分 ComfyKit / api 直连） |
| 服务 | `pixelle_video/services/api_media.py` | 直连 API 的媒体服务 |
| 服务 | `pixelle_video/services/api_services/video_client.py` | 视频提供商路由（kling/seedance/wan） |
| 服务 | `pixelle_video/services/api_services/video_dashscope.py` | DashScope 视频实现（含 r2v） |
| 调度 | `comfykit/executor.py` | `ComfyKit` 派发逻辑 |
| 调度 | `comfykit/comfyui/runninghub_executor.py` | RunningHub 执行器 |
| 调度 | `comfykit/comfyui/runninghub_client.py` | RunningHub HTTP 客户端 |
| 调度 | `comfykit/comfyui/workflow_parser.py` | 节点 `_meta.title` DSL 解析 |
| 工作流 | `workflows/runninghub/digital_image.json` | RH 工作流：合图+生文案（id `2004120336125861890`） |
| 工作流 | `workflows/runninghub/digital_customize.json` | RH 工作流：仅合图（id `2010608838151507970`） |
| 工作流 | `workflows/runninghub/digital_combination.json` | RH 工作流：音驱视频（id `2003717471859294210`） |
| 配置 | `pixelle_video/config/schema.py` | `runninghub_instance_type` / `runninghub_concurrent_limit` 等 |
| 配置 UI | `web/components/settings.py` | 系统配置页（含 RH/ComfyUI/API 提供商） |
