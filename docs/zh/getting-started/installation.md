# 安装

本页面将指导你完成 Pixelle-Video 的安装。

---

## 系统要求

### 必需条件

- **Python**: 3.10 或更高版本
- **操作系统**: Windows、macOS 或 Linux
- **包管理器**: uv（推荐）或 pip

### 可选条件

- **GPU**: 如需本地运行 ComfyUI，建议配备 NVIDIA 显卡（6GB+ 显存）
- **网络**: 稳定的网络连接（用于调用 LLM API 和图像生成服务）

---

## 🪟 Windows 一键整合包（推荐 Windows 用户使用）

**无需安装 Python、uv 或 ffmpeg，一键开箱即用！**

### 下载和安装

1. 访问 [GitHub Releases](https://github.com/AIDC-AI/Pixelle-Video/releases/latest) 下载最新版本
2. 下载最新的 Windows 一键整合包并解压到任意目录
3. 双击运行 `start.bat` 启动 Web 界面
4. 浏览器会自动打开主界面

!!! success "安装完成！"
    整合包已包含所有依赖，无需手动安装任何环境。首次使用只需在「⚙️ 系统配置」中配置 API 密钥即可开始使用。

!!! tip "下一步"
    安装完成后，请查看 [配置说明](configuration.md) 来设置 LLM 和图像生成服务，然后查看 [快速开始](quick-start.md) 生成第一个视频。

---

## 从源码安装（适合 macOS / Linux 用户或需要自定义的用户）

### 第一步：克隆项目

```bash
git clone https://github.com/AIDC-AI/Pixelle-Video.git
cd Pixelle-Video
```

### 第二步：安装依赖

!!! tip "推荐使用 uv"
    本项目使用 `uv` 作为包管理器，它比传统的 pip 更快、更可靠。

#### 使用 uv（推荐）

```bash
# 如果还没有安装 uv，先安装它
curl -LsSf https://astral.sh/uv/install.sh | sh

# 安装项目依赖（uv 会自动创建虚拟环境）
uv sync
```

#### 使用 pip

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -e .
```

---

## 验证安装

运行以下命令验证安装是否成功：

```bash
# 终端 1：启动 API
uv run python api/app.py --host 0.0.0.0 --port 8000

# 终端 2：启动 Next.js 工作台
pnpm install
pnpm -C frontend dev
```

浏览器应该打开 `http://localhost:3000`，显示 Pixelle-Video 的 Next.js 工作台。

!!! success "安装成功！"
    如果能看到 Web 界面，说明安装成功了！接下来请查看 [配置说明](configuration.md) 来设置服务。

---

## 可选：安装 ComfyUI（本地部署）

如果希望本地运行图像生成服务，需要安装 ComfyUI：

### 快速安装

```bash
# 克隆 ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# 安装依赖
pip install -r requirements.txt
```

### 启动 ComfyUI

```bash
python main.py
```

ComfyUI 默认运行在 `http://127.0.0.1:8188`

!!! info "ComfyUI 模型"
    ComfyUI 需要下载对应的模型文件才能工作。请参考 [ComfyUI 官方文档](https://github.com/comfyanonymous/ComfyUI) 了解如何下载和配置模型。

---

## 下一步

- [配置服务](configuration.md) - 配置 LLM 和图像生成服务
- [快速开始](quick-start.md) - 生成第一个视频
