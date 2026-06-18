========================================
  Pixelle-Video - Windows Portable
========================================

AI-powered video creation platform

Version: {VERSION}
Build Date: {BUILD_DATE}

========================================
  Quick Start
========================================

1. Double-click "start.bat" to launch the Web UI
2. Browser will open automatically
3. Configure your API keys in the Web UI (Settings section)

That's it! Just one click to start.
You can launch multiple instances - each will use a different port automatically.

========================================
  First-Time Setup
========================================

1. On first run, the Web UI will start with default configuration
2. Click on "Settings" in the Web UI to configure:
   - LLM API Key (OpenAI/Qwen/DeepSeek/etc)
   - LLM Base URL and Model
   - ComfyUI settings (use RunningHub or local ComfyUI)
3. Click "Save Config" to save your settings
4. Configuration will be automatically saved to config.yaml

========================================
  Configuration
========================================

Configuration is done through the Web UI:

1. Launch the application using start.bat
2. Click on "Settings" in the Web UI
3. Fill in the required fields:
   - LLM API Key: Your LLM provider API key
   - LLM Base URL: LLM API endpoint
   - LLM Model: Model name (e.g., gpt-4o, qwen-max)
   - ComfyUI URL: For local ComfyUI (default: http://127.0.0.1:8188)
   - RunningHub API Key: For cloud image generation (optional)
4. Click "Save Config" to save

The configuration will be automatically saved to Pixelle-Video/config.yaml.

Note: You can also manually edit config.yaml if needed, but the Web UI is recommended.

========================================
  Folder Structure
========================================

python/           - Python 3.11 embedded runtime
tools/            - FFmpeg and other utilities
Pixelle-Video/    - Main application
data/             - User data (BGM, templates, workflows)
output/           - Generated videos

========================================
  System Requirements
========================================

- Windows 10/11 (64-bit)
- 4GB RAM minimum (8GB recommended)
- Internet connection (for API calls and ComfyUI cloud)
- Modern web browser (Chrome/Edge/Firefox)

========================================
  Troubleshooting
========================================

Problem: "Python not found"
Solution: Ensure python/ folder exists and is not corrupted

Problem: "Failed to start"
Solution: Check if Python and dependencies are installed correctly

Problem: "Port already in use"
Solution: Next.js automatically uses the next available port. You can run multiple instances simultaneously.

Problem: "Module not found"
Solution: Re-extract the package completely, don't move files

========================================
  Support
========================================

GitHub: https://github.com/AIDC-AI/Pixelle-Video
Documentation: https://aidc-ai.github.io/Pixelle-Video
Issues: https://github.com/AIDC-AI/Pixelle-Video/issues

========================================
  License
========================================

See LICENSE file in Pixelle-Video/ folder

Copyright (c) 2025 Pixelle.AI

