# FAQ

Frequently Asked Questions.

---

## Installation

### Q: How to install uv?

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Q: Can I use something other than uv?

Yes, you can use traditional pip + venv approach.

---

## Configuration

### Q: Do I need to configure ComfyUI?

**Not necessarily** - it depends on your template choice:

| Template Type | ComfyUI | Best For | Speed |
|--------------|---------|----------|-------|
| Text-only<br/>(e.g., `simple.html`) | ❌ Not needed | Quotes, announcements, reading prompts | ⚡⚡⚡ Very fast |
| AI Images<br/>(e.g., `default.html`) | ✅ Required | Rich visual content | ⚡ Standard |

**Tip**: Beginners can start with text-only templates for instant zero-barrier experience!

**Alternative**: If you need AI images but don't want local ComfyUI, use RunningHub cloud service.

### Q: Which LLMs are supported?

All OpenAI-compatible LLMs, including:
- Qianwen
- GPT-4o
- DeepSeek
- Ollama (local)

---

## Usage

### Q: How long does first-time usage take?

Generating a 3-5 scene video takes approximately 2-5 minutes.

### Q: What if I'm not satisfied with the video?

Try:
1. Change LLM model
2. Adjust image dimensions and prompt prefix
3. Change TTS workflow
4. Try different video templates

### Q: What are the costs?

- **Completely Free**: Ollama + Local ComfyUI = $0
- **Recommended**: Qianwen + Local ComfyUI ≈ $0.01-0.05/video
- **Cloud Solution**: OpenAI + RunningHub (higher cost)

---

## Troubleshooting

### Q: ComfyUI connection failed

1. Confirm ComfyUI is running
2. Check if URL is correct
3. Click "Test Connection" in Web interface

### Q: LLM API call failed

1. Check if API Key is correct
2. Check network connection
3. Review error messages

---

## Other Questions

Have other questions? Check [Troubleshooting](troubleshooting.md) or submit an [Issue](https://github.com/woaiACE/Pixelle-Video/issues).

