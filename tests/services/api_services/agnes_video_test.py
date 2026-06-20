from pixelle_video.services.api_services import video_agnes
from pixelle_video.services.api_services.video_agnes import AgnesVideoClient


class DummyResponse:
    def __init__(self, data=None, content=b"video", ok=True, status_code=200):
        self._data = data or {}
        self._content = content
        self.ok = ok
        self.status_code = status_code
        self.text = str(self._data)

    def json(self):
        return self._data

    def raise_for_status(self):
        if not self.ok:
            raise RuntimeError(f"HTTP {self.status_code}")

    def iter_content(self, chunk_size=8192):
        yield self._content


def test_submit_task_builds_agnes_payload(monkeypatch):
    captured = {}

    def fake_post(url, headers, json, timeout, proxies):
        captured.update(
            {
                "url": url,
                "headers": headers,
                "json": json,
                "timeout": timeout,
                "proxies": proxies,
            }
        )
        return DummyResponse({"id": "task_123", "status": "queued"})

    monkeypatch.setattr(video_agnes.requests, "post", fake_post)

    client = AgnesVideoClient(
        api_key="key",
        base_url="https://apihub.agnes-ai.com/v1",
        local_proxy="http://127.0.0.1:9090",
    )
    task_id = client._submit_task(
        prompt="A calm cinematic shot",
        image_path="https://cdn.example/frame.png",
        model="agnes-video-v2.0",
        duration=5,
        video_ratio="9:16",
        resolution="720P",
        negative_prompt="blur",
        seed=7,
        frame_rate=24,
        num_inference_steps=32,
        mode=None,
    )

    assert task_id == "task_123"
    assert captured["url"] == "https://apihub.agnes-ai.com/v1/videos"
    assert captured["headers"]["Authorization"] == "Bearer key"
    assert captured["proxies"] == {
        "http": "http://127.0.0.1:9090",
        "https": "http://127.0.0.1:9090",
    }
    payload = captured["json"]
    assert payload["model"] == "agnes-video-v2.0"
    assert payload["prompt"] == "A calm cinematic shot"
    assert "mode" not in payload
    assert payload["width"] == 720
    assert payload["height"] == 1280
    assert payload["num_frames"] == 121
    assert payload["frame_rate"] == 24
    assert payload["negative_prompt"] == "blur"
    assert payload["seed"] == 7
    assert payload["num_inference_steps"] == 32
    assert payload["image"] == "https://cdn.example/frame.png"


def test_submit_task_rejects_local_image(monkeypatch, tmp_path):
    image_path = tmp_path / "frame.png"
    image_path.write_bytes(b"png")

    client = AgnesVideoClient(api_key="key")

    try:
        client._submit_task(
            prompt="A calm cinematic shot",
            image_path=str(image_path),
            model="agnes-video-v2.0",
            duration=5,
            video_ratio="9:16",
            resolution="720P",
            negative_prompt=None,
            seed=None,
            frame_rate=24,
            num_inference_steps=None,
            mode=None,
        )
    except ValueError as exc:
        assert "public image URL" in str(exc)
    else:
        raise AssertionError("Expected local Agnes video image input to be rejected")


def test_generate_video_polls_and_downloads(monkeypatch, tmp_path):
    calls = []

    def fake_post(url, headers, json, timeout, proxies):
        return DummyResponse({"task_id": "task_abc", "status": "queued"})

    def fake_get(url, **kwargs):
        calls.append(url)
        if url.endswith("/videos/task_abc"):
            return DummyResponse({"status": "succeeded", "data": {"url": "https://cdn.example/video.mp4"}})
        return DummyResponse(content=b"mp4-bytes")

    monkeypatch.setattr(video_agnes.requests, "post", fake_post)
    monkeypatch.setattr(video_agnes.requests, "get", fake_get)

    output_path = tmp_path / "out.mp4"
    client = AgnesVideoClient(
        api_key="key",
        base_url="https://apihub.agnes-ai.com/v1",
        poll_interval=0,
    )
    video_url = client.generate_video(
        prompt="A short scene",
        image_path=None,
        save_path=str(output_path),
        model="agnes-video-v2.0",
        duration=3,
    )

    assert video_url == "https://cdn.example/video.mp4"
    assert output_path.read_bytes() == b"mp4-bytes"
    assert calls == ["https://apihub.agnes-ai.com/v1/videos/task_abc", "https://cdn.example/video.mp4"]


def test_generate_video_uses_content_endpoint_when_status_has_no_url(monkeypatch, tmp_path):
    captured_download_headers = {}

    def fake_post(url, headers, json, timeout, proxies):
        return DummyResponse({"task_id": "task_content", "status": "queued"})

    def fake_get(url, **kwargs):
        if url.endswith("/videos/task_content"):
            return DummyResponse({"status": "succeeded"})
        captured_download_headers.update(kwargs.get("headers") or {})
        return DummyResponse(content=b"content-bytes")

    monkeypatch.setattr(video_agnes.requests, "post", fake_post)
    monkeypatch.setattr(video_agnes.requests, "get", fake_get)

    output_path = tmp_path / "content.mp4"
    client = AgnesVideoClient(
        api_key="key",
        base_url="https://apihub.agnes-ai.com/v1",
        poll_interval=0,
    )
    video_url = client.generate_video(
        prompt="A short scene",
        image_path=None,
        save_path=str(output_path),
        model="agnes-video-v2.0",
        duration=3,
    )

    assert video_url == "https://apihub.agnes-ai.com/v1/videos/task_content/content"
    assert output_path.read_bytes() == b"content-bytes"
    assert captured_download_headers["Authorization"] == "Bearer key"


def test_extract_video_url_accepts_common_response_shapes():
    client = AgnesVideoClient(api_key="key")

    assert client._extract_video_url({"url": "https://cdn.example/a.mp4"}).endswith("a.mp4")
    assert client._extract_video_url({"remixed_from_video_id": "https://cdn.example/r.mp4"}).endswith(
        "r.mp4"
    )
    assert client._extract_video_url({"data": [{"url": "https://cdn.example/b.mp4"}]}).endswith(
        "b.mp4"
    )
    assert client._extract_video_url({"output": {"video_url": "https://cdn.example/c.mp4"}}).endswith(
        "c.mp4"
    )


def test_poll_uses_recommended_video_id_endpoint(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return DummyResponse(
            {
                "status": "completed",
                "remixed_from_video_id": "https://cdn.example/final.mp4",
            }
        )

    monkeypatch.setattr(video_agnes.requests, "get", fake_get)

    client = AgnesVideoClient(api_key="key", base_url="https://apihub.agnes-ai.com/v1")

    assert (
        client._poll_until_done("video_123", "agnes-video-v2.0")
        == "https://cdn.example/final.mp4"
    )
    assert calls == [
        "https://apihub.agnes-ai.com/agnesapi?video_id=video_123&model_name=agnes-video-v2.0"
    ]
