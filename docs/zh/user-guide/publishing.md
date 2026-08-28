# 视频发布

Pixelle-Video 可以把生成好的视频直接发布到你的社交账号，让「输入主题 → 视频上线」一步到位，
不需要手动上传。

发布通过 [Upload-Post](https://upload-post.com) 完成：一个 API Key 覆盖所有平台，
因此 Pixelle-Video 内部无需为每个平台申请开发者应用、走 OAuth 流程或维护 token 刷新。
该功能完全可选 —— 默认 `publish.enabled: false`，不影响现有流程。

**支持平台：** TikTok、Instagram、YouTube、Facebook、LinkedIn、X (Twitter)、
Threads、Pinterest、Bluesky、Reddit、Telegram、Discord、Google Business Profile。

## 配置

1. 在 [upload-post.com](https://upload-post.com) 注册账号（免费额度：每月 10 次上传）。
2. 在控制台绑定你的社交账号。
3. 把 API Key 和 profile 名称填入 `config.yaml`：

```yaml
publish:
  enabled: true
  api_key: "your-upload-post-api-key"
  user: "your-profile-name"
  platforms:
    - tiktok
    - instagram
    - youtube
```

## Python 调用

```python
from pixelle_video import pixelle_video

await pixelle_video.initialize()

result = await pixelle_video.generate_video(text="如何养成好习惯")
await pixelle_video.publish(video_path=result.video_path, title="如何养成好习惯")
```

定时发布：

```python
await pixelle_video.publish(
    video_path=result.video_path,
    title="如何养成好习惯",
    platforms=["tiktok", "youtube"],
    scheduled_date="2026-12-31T18:00:00Z",
    timezone="Asia/Shanghai",
)
```

平台专属参数通过 `extra_params` 传入，例如 TikTok 的隐私级别或 AI 生成内容标签：

```python
await pixelle_video.publish(
    video_path=result.video_path,
    title="如何养成好习惯",
    extra_params={"privacy_level": "SELF_ONLY", "is_ai_generated": True},
)
```

## API 调用

```bash
# 查看支持的平台，以及发布功能是否已配置
curl http://localhost:8000/api/publish/platforms

# 发布
curl -X POST http://localhost:8000/api/publish/video \
  -H "Content-Type: application/json" \
  -d '{
    "video_path": "output/20260101_120000/final.mp4",
    "title": "如何养成好习惯",
    "platforms": ["tiktok", "instagram", "youtube"]
  }'

# 查询状态
curl http://localhost:8000/api/publish/status/{request_id}
```

## 注意事项

- YouTube 和 Reddit **必须**提供 `title`，其他平台可选。
- 大文件会在后台处理：`POST /api/publish/video` 返回 `request_id`，
  用 `GET /api/publish/status/{request_id}` 查询各平台的发布结果。
- 完整参数说明见 [docs.upload-post.com](https://docs.upload-post.com)。
