# 🙋‍♀️ Pixelle-Video FAQ

### How to integrate custom local workflows?

If you want to integrate your own ComfyUI workflows, please follow these specifications:

1.  **Run Locally First**: Ensure the workflow runs correctly in your local ComfyUI.
2.  **Parameter Binding**: Find the Text node (CLIP Text Encode or similar text input node) where prompt words need to be dynamically passed by the program.
    -   Edit the **Title** of that node.
    -   Change the title to `$prompt.text!` or `$prompt.value!` (depending on the input type accepted by the node).
     <img src="https://github.com/user-attachments/assets/ddb1962c-9272-486f-84ab-8019c3fb5bf4" width="600" alt="参数绑定示例" />

    -   *Reference Example: Check the editing method of existing JSON files in the `workflows/selfhost/` directory.*
3.  **Export Format**: Export the modified workflow as **API Format** (Save (API Format)).
4.  **File Naming**: Place the exported JSON file into the `workflows/` directory and adhere to the following naming prefixes:
    -   **Image Workflows**: Prefix must be `image_` (e.g., `image_my_style.json`)
    -   **Video Workflows**: Prefix must be `video_`
    -   **TTS Workflows**: Prefix must be `tts_`

### How to debug RunningHub workflows locally?

If you want to test workflows locally that were originally intended for RunningHub cloud usage:

1.  **Get ID**: Open the RunningHub workflow file and find the ID.
2.  **Load Workflow**: Paste the ID onto the end of the RunningHub URL (e.g., https://www.runninghub.cn/workflow/1983513964837543938) to enter the workflow page.
  <img src="https://github.com/user-attachments/assets/e5330b3a-5475-44f2-81e4-057d33fdf71b" width="600" alt="参数绑定示例" />


3.  **Download to Local**: Download the workflow as a JSON file from the workbench.
4.  **Local Testing**: Drag the downloaded file into your local ComfyUI canvas for testing and debugging.

### Common Errors and Solutions

#### 1. TTS (Text-to-Speech) Errors
-   **Reason**: The default Edge-TTS calls Microsoft's free interface, which may fail frequently due to network instability.
-   **Solution**:
    -   Check your network connection.
    -   It is recommended to switch to **ComfyUI TTS** workflows (select workflows with the `tts_` prefix) for higher stability.

#### 2. LLM (Large Language Model) Errors
-   **Troubleshooting Steps**:
    1.  Check if the **Base URL** is correct (ensure no extra spaces or incorrect suffixes).
    2.  Check if the **API Key** is valid and has sufficient balance.
    3.  Check if the **Model Name** is spelled correctly.
    -   *Tip: Please consult the official API documentation of your model provider (e.g., OpenAI, DeepSeek, Alibaba Cloud, etc.) for accurate configuration.*

#### 3. Error Message "Could not find a Chrome executable..."
-   **Reason**: Your computer system lacks the Chrome browser core, causing features dependent on the browser to fail.
-   **Solution**: Please download and install the Google Chrome browser.

### Where are generated videos saved?

All generated videos are automatically saved in the `output/` folder within the project directory. Upon completion, the interface will display the video duration, file size, number of shots, and a download link.

### Community Resources

-   **GitHub Repository**: https://github.com/woaiACE/Pixelle-Video
-   **Issue Reporting**: Submit bugs or feature requests via GitHub Issues.
-   **Community Support**: Join discussion groups for help and experience sharing.
-   **Contribution**: The project is under the MIT license and welcomes contributions.

💡 **Tip**: If you cannot find the answer you need in this FAQ, please submit an issue on GitHub or join the community discussion. We will continue to update this FAQ based on user feedback!
