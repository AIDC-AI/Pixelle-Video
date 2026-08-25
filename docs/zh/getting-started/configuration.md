# 配置说明

完成安装后，需要配置服务才能使用 Pixelle-Video。

---

## LLM 配置

LLM（大语言模型）用于生成视频文案。

### 快速选择预设

1. 从下拉菜单选择预设模型：
   - 通义千问（推荐，性价比高）
   - GPT-4o
   - DeepSeek
   - SSYCloud（胜算云，多模型统一入口）
   - Ollama（本地运行，完全免费）

2. 系统会自动填充 `base_url` 和 `model`

3. 点击「🔑 获取 API Key」链接，注册并获取密钥

4. 填入 API Key

### SSYCloud（胜算云）

选择 `SSYCloud` 预设后，系统会使用以下默认配置：

- Base URL：`https://router.shengsuanyun.com/api/v1`
- 默认模型：`deepseek/deepseek-v4-flash`
- API Key：[胜算云控制台](https://console.shengsuanyun.com)

胜算云模型 ID 包含供应商前缀，例如 `openai/gpt-5.4` 或
`anthropic/claude-sonnet-4.6`。可以点击模型旁的「加载」按钮获取当前账号可用的模型，
也可以手动填写完整模型 ID。

---

## 图像/视频生成配置

支持两种方式：

### SSYCloud API 媒体模型

如果需要通过胜算云直接生成图片或视频，在「🧩 API 媒体模型」中的
`SSYCloud / 胜算云` 区域填写 API Key，并保持默认 Base URL：
`https://router.shengsuanyun.com/api/v1/tasks/generations`。

保存后，在图像或视频模型来源中选择「API 模型」，再选择 `API SSYCloud` 模型。
图片模型支持 GPT Image 2、Doubao Seedream 5.0 Pro 和 Gemini 3.1 Flash Image；
视频模型支持 Doubao Seedance 2.5、2.0 和 2.0 Fast，并共用已有的视频参数。

### 本地部署

使用本地 ComfyUI 服务：

1. 安装并启动 ComfyUI
2. 填写 ComfyUI URL（默认 `http://127.0.0.1:8188`）
3. 点击「测试连接」确认服务可用
4. （可选）填写 ComfyUI API Key（从 [Comfy Platform](https://platform.comfy.org/profile/api-keys) 获取）

### 云端部署（推荐）

使用 RunningHub 云端服务，无需本地 GPU：

1. 注册 RunningHub 账号
2. 获取 API Key
3. 在配置中填写 API Key
4. 配置高级选项（可选）：
   - **并发限制**: 设置同时执行的任务数（1-10，普通会员默认为 1）
   - **实例类型**: 选择 24GB 或 48GB 显存机器（48GB 适合大尺寸视频生成）

---

## 保存配置

填写完所有必需的配置后，点击「保存配置」按钮。

配置会保存到 `config.yaml` 文件中。

---

## 下一步

- [快速开始](quick-start.md) - 生成你的第一个视频
