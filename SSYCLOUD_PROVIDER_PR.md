# feat: add Shengsuanyun LLM & media provider preset

## Summary

- Add SSYCloud/Shengsuanyun as an LLM preset:
  - Base URL: `https://router.shengsuanyun.com/api/v1`
  - Default model: `deepseek/deepseek-v4-flash`
- Add SSYCloud as a direct image/video provider:
  - Media endpoint: `https://router.shengsuanyun.com/api/v1/tasks/generations`
  - Submit asynchronous generation tasks, poll task status, and download outputs
- Add image models:
  - `openai/gpt-image-2`
  - `bytedance/doubao-seedream-5-0-pro`
  - `google/gemini-3.1-flash-image`
- Add video models:
  - `bytedance/doubao-seedance-2-5`
  - `bytedance/doubao-seedance-2-0`
  - `bytedance/doubao-seedance-2-0-fast`
- Reuse common media parameters instead of maintaining per-model UI configuration
- Support text, image, video, and audio reference inputs for SSYCloud Seedance models
- Expose SSYCloud models in Quick Create, Image-to-Video, Custom Assets, Digital Human, and Action Transfer workflows
- Keep Quick Create API models limited to image generation; video models are exposed through video workflows
- Add a half-width SSYCloud configuration section in API Media Models

## How to Use

1. Open **System Settings**.
2. For LLM generation:
   - Select `SSYCloud`
   - Set Base URL to `https://router.shengsuanyun.com/api/v1`
   - Paste the API key
   - Select or enter a supported LLM model
3. For image/video generation:
   - Open **API Media Models → SSYCloud / Shengsuanyun**
   - Set Base URL to `https://router.shengsuanyun.com/api/v1/tasks/generations`
   - Paste the same SSYCloud API key
   - Optionally enable the configured local proxy
4. Save the configuration.
5. Select **API Models** in the relevant workflow:
   - Quick Create with an image template: SSYCloud image models
   - Image-to-Video, Custom Assets, Digital Human, or Action Transfer: SSYCloud Seedance models

Register/Get API Key: [Shengsuanyun](https://www.shengsuanyun.com/?from=CH_KTDNQP32)

## Files Changed

- `pixelle_video/llm_presets.py`
- `pixelle_video/config/schema.py`
- `pixelle_video/services/api_services/ssycloud_media.py`
- `pixelle_video/services/api_media.py`
- `web/components/settings.py`
- `web/components/style_config.py`
- `web/pipelines/api_workflows.py`
- `config.example.yaml`
- `README.md`
- `README_EN.md`
- `docs/en/getting-started/configuration.md`
- `docs/en/reference/config-schema.md`
- `docs/zh/getting-started/configuration.md`
- `docs/zh/reference/config-schema.md`
- `tests/test_llm_presets.py`
- `tests/test_llm_util.py`
- `tests/test_ssycloud_media.py`
- `.gitignore`

## Notes

- LLM and media configurations are independent:
  - LLM: `/api/v1`
  - Media: `/api/v1/tasks/generations`
- The current media implementation sends both image and video generation through the unified asynchronous task API; it does not use `/v1/images/generations`.
- Authentication currently uses `Authorization: Bearer <API_KEY>`. The current implementation does not add an `X-Title` header.
- Local reference images, videos, and audio are converted to data URLs before submission.
- Tests pass: `14 passed`.
- Documentation: [Shengsuanyun API Docs](https://lean.shengsuanyun.com/apidocs)
