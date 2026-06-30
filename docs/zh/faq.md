# 常见问题

常见问题解答。

---

## 安装相关

### Q: 如何安装 uv？

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Q: 可以不用 uv 吗？

可以，你也可以使用传统的 pip + venv 方式。

---

## 配置相关

### Q: 必须要配置 ComfyUI 吗？

**不一定**，取决于您选择的模板类型：

| 模板类型 | ComfyUI | 适用场景 | 生成速度 |
|---------|---------|---------|----------|
| 纯文本模板<br/>（如 `simple.html`） | ❌ 不需要 | 文字金句、公告、阅读提示 | ⚡⚡⚡ 极快 |
| AI 配图模板<br/>（如 `default.html`） | ✅ 需要 | 图文并茂的丰富内容 | ⚡ 标准 |

**推荐**：新手可以从纯文本模板开始，零门槛快速体验！

**其他选项**：如果需要 AI 配图但不想本地部署 ComfyUI，可以使用 RunningHub 云端服务。

### Q: 支持哪些 LLM？

支持所有 OpenAI 兼容接口的 LLM，包括：
- 通义千问
- GPT-4o
- DeepSeek
- Ollama（本地）

---

## 使用相关

### Q: 第一次使用需要多久？

生成一个 3-5 分镜的视频大约需要 2-5 分钟。

### Q: 视频效果不满意怎么办？

可以尝试：
1. 更换 LLM 模型
2. 调整图像尺寸和提示词前缀
3. 更换 TTS 工作流
4. 尝试不同的视频模板

### Q: 费用大概多少？

- **完全免费**: Ollama + 本地 ComfyUI = 0 元
- **推荐方案**: 通义千问 + 本地 ComfyUI ≈ 0.01-0.05 元/视频
- **云端方案**: OpenAI + RunningHub（费用较高）

---

## 故障排查

### Q: ComfyUI 连接失败

1. 确认 ComfyUI 正在运行
2. 检查 URL 是否正确
3. 在 Web 界面点击「测试连接」

### Q: LLM API 调用失败

1. 检查 API Key 是否正确
2. 检查网络连接
3. 查看错误提示

---

## 其他问题

有其他问题？请查看 [故障排查](troubleshooting.md) 或提交 [Issue](https://github.com/woaiACE/Pixelle-Video/issues)。

