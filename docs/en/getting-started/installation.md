# Installation

This page will guide you through installing Pixelle-Video.

---

## System Requirements

### Required

- **Python**: 3.10 or higher
- **Operating System**: Windows, macOS, or Linux
- **Package Manager**: uv (recommended) or pip

### Optional

- **GPU**: NVIDIA GPU with 6GB+ VRAM recommended for local ComfyUI
- **Network**: Stable internet connection for LLM API and image generation services

---

## 🪟 Windows All-in-One Package (Recommended for Windows Users)

**No need to install Python, uv, or ffmpeg - ready to use out of the box!**

### Download and Install

1. Visit [GitHub Releases](https://github.com/AIDC-AI/Pixelle-Video/releases/latest) to download the latest version
2. Download the latest Windows All-in-One Package and extract it to any directory
3. Double-click `start.bat` to launch the Web interface
4. Your browser will automatically open the main app

!!! success "Installation Complete!"
    The package includes all dependencies, no need to manually install any environment. On first use, you only need to configure API keys in "⚙️ System Configuration" to get started.

!!! tip "Next Steps"
    After installation, check out the [Configuration Guide](configuration.md) to set up LLM and image generation services, then see [Quick Start](quick-start.md) to create your first video.

---

## Install from Source (For macOS / Linux Users or Users Who Need Customization)

### Step 1: Clone the Repository

```bash
git clone https://github.com/AIDC-AI/Pixelle-Video.git
cd Pixelle-Video
```

### Step 2: Install Dependencies

!!! tip "Recommended: Use uv"
    This project uses `uv` as the package manager, which is faster and more reliable than traditional pip.

#### Using uv (Recommended)

```bash
# Install uv if you haven't already
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install project dependencies (uv will create a virtual environment automatically)
uv sync
```

#### Using pip

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -e .
```

---

## Verify Installation

Run the following command to verify the installation:

```bash
# Terminal 1: start the API
uv run python api/app.py --host 0.0.0.0 --port 8000

# Terminal 2: start the Next.js workbench
pnpm install
pnpm -C frontend dev
```

Your browser should open `http://localhost:3000` and display the Pixelle-Video Next.js workbench.

!!! success "Installation Successful!"
    If you can see the web interface, the installation was successful! Next, check out the [Configuration Guide](configuration.md) to set up your services.

---

## Optional: Install ComfyUI (Local Deployment)

If you want to run image generation locally, you'll need to install ComfyUI:

### Quick Install

```bash
# Clone ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# Install dependencies
pip install -r requirements.txt
```

### Start ComfyUI

```bash
python main.py
```

ComfyUI runs on `http://127.0.0.1:8188` by default.

!!! info "ComfyUI Models"
    ComfyUI requires downloading model files to work. Please refer to the [ComfyUI documentation](https://github.com/comfyanonymous/ComfyUI) for information on downloading and configuring models.

---

## Next Steps

- [Configuration](configuration.md) - Configure LLM and image generation services
- [Quick Start](quick-start.md) - Create your first video
