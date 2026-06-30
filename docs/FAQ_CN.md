# 🙋‍♀️ Pixelle-Video 常见问题解答 (FAQ)


### 本地自己开发的工作流如何集成使用？

如果您想集成自己开发的 ComfyUI 工作流，请遵循以下规范：

1. **本地跑通**：首先确保工作流在您的本地 ComfyUI 中能正常运行。
2. **参数绑定**：找到需要由程序动态传入提示词的 Text 节点（CLIP Text Encode 或类似文本输入节点）。
   - 编辑该节点的**标题 (Title)**。
   - 修改标题为 `$prompt.text!` 或 `$prompt.value!`（根据节点接受的输入类型决定）。
     <img src="https://github.com/user-attachments/assets/ddb1962c-9272-486f-84ab-8019c3fb5bf4" width="600" alt="参数绑定示例" />

   - *参考示例：可以查看 `workflows/selfhost/` 目录下现有 JSON 文件的编辑方式。*
3. **导出格式**：将修改好的工作流导出为 **API 格式** (Save (API Format))。
4. **文件命名**：将导出的 JSON 文件放入 `workflows/` 目录，并遵守以下命名前缀：
   - **图片类工作流**：前缀必须是 `image_` (例如 `image_my_style.json`)
   - **视频类工作流**：前缀必须是 `video_`
   - **语音合成类**：前缀必须是 `tts_`

### 如何在本地调试项目中的 RunningHub 工作流？

如果您想在本地测试项目中原本用于 RunningHub 云端的工作流：

1. **获取 ID**：打开runninghub工作流文件，找到id
2. **加载工作流**：将 ID 粘贴到 RunningHub 网站 URL 后缀上，如：https://www.runninghub.cn/workflow/1983513964837543938 进入该工作流页面。
  <img src="https://github.com/user-attachments/assets/e5330b3a-5475-44f2-81e4-057d33fdf71b" width="600" alt="参数绑定示例" />


4. **下载到本地**：在工作台中将工作流下载为 JSON 文件。
5. **本地测试**：将下载的文件拖入您本地的 ComfyUI 画布进行测试和调试。
   

### 常见的报错及解决方案

#### 1. TTS (语音合成) 报错
- **原因**：默认的 Edge-TTS 是调用微软的免费接口，可能会受网络波动影响，导致失败频率较高。
- **解决方案**：
  - 检查网络连接。
  - 建议切换使用 **ComfyUI 合成 TTS** 的工作流（选择前缀为 `tts_` 的工作流），稳定性更高。

#### 2. LLM (大模型) 报错
- **排查步骤**：
  1. 检查 **Base URL** 是否正确（不要多出空格或错误的后缀）。
  2. 检查 **API Key** 是否有效且有余额。
  3. 检查 **Model Name** 是否拼写正确。
  - *提示：请查阅您所使用的模型服务商（如 OpenAI、DeepSeek、阿里云等）的官方 API 文档获取准确配置。*

#### 3. 错误提示 "Could not find a Chrome executable..."
- **原因**：您的电脑系统中缺少 Chrome 浏览器内核，导致部分依赖浏览器的功能无法运行。
- **解决方案**：请下载并安装 Google Chrome 浏览器。


### 生成的视频保存在哪里？

所有生成的视频自动保存到项目目录的 `output/` 文件夹中。生成完成后，界面会显示视频时长、文件大小、分镜数量及下载链接。

### 有哪些社区资源？

- **GitHub 仓库**：https://github.com/woaiACE/Pixelle-Video
- **问题反馈**：通过 GitHub Issues 提交 bug 或功能请求
- **社区支持**：加入讨论群组获取帮助和分享经验
- **贡献代码**：项目在 MIT 许可证下欢迎贡献

💡 **提示**：如果在此 FAQ 中找不到您需要的答案，请在 GitHub 提交 issue 或加入社区讨论。我们会根据用户反馈持续更新此 FAQ！
