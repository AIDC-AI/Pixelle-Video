# Publishing

Pixelle-Video can publish a finished video straight to your social accounts, so a run
goes from a topic to a live post without a manual upload step.

Publishing is handled by [Upload-Post](https://upload-post.com): one API key covers
every platform, so there is no per-platform developer app, OAuth flow or token refresh
to maintain inside Pixelle-Video. It is entirely optional — with `publish.enabled: false`
(the default) nothing changes.

**Supported platforms:** TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter),
Threads, Pinterest, Bluesky, Reddit, Telegram, Discord and Google Business Profile.

## Setup

1. Create an account at [upload-post.com](https://upload-post.com) (free tier: 10 uploads/month).
2. Connect your social accounts in the dashboard.
3. Copy your API key and profile name into `config.yaml`:

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

## From Python

```python
from pixelle_video import pixelle_video

await pixelle_video.initialize()

result = await pixelle_video.generate_video(text="How to build better habits")
await pixelle_video.publish(video_path=result.video_path, title="How to build better habits")
```

Schedule instead of publishing immediately:

```python
await pixelle_video.publish(
    video_path=result.video_path,
    title="How to build better habits",
    platforms=["tiktok", "youtube"],
    scheduled_date="2026-12-31T18:00:00Z",
    timezone="Europe/Madrid",
)
```

Platform-specific options go through `extra_params`, e.g. TikTok privacy or the
AI-generated content label:

```python
await pixelle_video.publish(
    video_path=result.video_path,
    title="How to build better habits",
    extra_params={"privacy_level": "SELF_ONLY", "is_ai_generated": True},
)
```

## From the API

```bash
# List platforms and check whether publishing is configured
curl http://localhost:8000/api/publish/platforms

# Publish
curl -X POST http://localhost:8000/api/publish/video \
  -H "Content-Type: application/json" \
  -d '{
    "video_path": "output/20260101_120000/final.mp4",
    "title": "How to build better habits",
    "platforms": ["tiktok", "instagram", "youtube"]
  }'

# Check status
curl http://localhost:8000/api/publish/status/{request_id}
```

## Notes

- A `title` is **required** for YouTube and Reddit; it is optional everywhere else.
- Long uploads are processed in the background. `POST /api/publish/video` returns a
  `request_id` — poll `GET /api/publish/status/{request_id}` for per-platform results.
- Full parameter reference: [docs.upload-post.com](https://docs.upload-post.com).
