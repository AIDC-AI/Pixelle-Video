from __future__ import annotations

from pathlib import Path

import requests

from pixelle_video.services.api_services.muapi import MuapiImageClient, MuapiVideoClient


class FakeResponse:
    def __init__(self, payload=None, content: bytes = b"", status_code: int = 200):
        self._payload = payload
        self.content = content
        self.status_code = status_code
        self.ok = status_code < 400
        self.text = ""

    def json(self):
        if isinstance(self._payload, BaseException):
            raise self._payload
        return self._payload

    def iter_content(self, chunk_size=8192):
        yield self.content


def test_image_client_submits_polls_and_downloads_without_auth_on_media(monkeypatch, tmp_path: Path):
    api_calls = []

    def fake_request(method, url, **kwargs):
        api_calls.append((method, url, kwargs))
        if url.endswith("/nano-banana-pro"):
            return FakeResponse({"request_id": "image-1", "status": "processing"})
        return FakeResponse({"status": "completed", "output": {"image_url": "https://cdn.example/image.jpg"}})

    downloads = []

    def fake_get(url, **kwargs):
        downloads.append((url, kwargs))
        return FakeResponse(content=b"\xff\xd8\xff\xe0test")

    monkeypatch.setattr(requests, "request", fake_request)
    monkeypatch.setattr(requests, "get", fake_get)
    client = MuapiImageClient(api_key="test-key", poll_interval=0, max_polls=2)

    paths = client.generate_image("a calm landscape", save_dir=str(tmp_path), video_ratio="16:9", resolution="2K")

    assert len(paths) == 1
    assert Path(paths[0]).suffix == ".jpg"
    assert api_calls[0][2]["headers"]["x-api-key"] == "test-key"
    assert api_calls[1][2]["headers"]["x-api-key"] == "test-key"
    assert "headers" not in downloads[0][1]
    assert "test-key" not in str(downloads[0][1])
    assert api_calls[0][2]["json"] == {
        "prompt": "a calm landscape",
        "aspect_ratio": "16:9",
        "resolution": "2k",
    }


def test_video_client_uploads_first_frame_and_writes_mp4(monkeypatch, tmp_path: Path):
    input_path = tmp_path / "frame.png"
    input_path.write_bytes(b"fake image")
    api_calls = []

    def fake_post(url, **kwargs):
        assert url.endswith("/upload_file")
        assert kwargs["headers"]["x-api-key"] == "test-key"
        return FakeResponse({"url": "https://cdn.example/frame.png"})

    def fake_request(method, url, **kwargs):
        api_calls.append((method, url, kwargs))
        if url.endswith("/seedance-2.5-image-to-video"):
            return FakeResponse({"request_id": "video-1", "status": "processing"})
        return FakeResponse({"status": "completed", "output": {"video": "https://cdn.example/video.mp4"}})

    def fake_get(url, **kwargs):
        assert url == "https://cdn.example/video.mp4"
        assert "headers" not in kwargs
        return FakeResponse(content=b"\x00\x00\x00\x18ftypisom")

    monkeypatch.setattr(requests, "post", fake_post)
    monkeypatch.setattr(requests, "request", fake_request)
    monkeypatch.setattr(requests, "get", fake_get)
    client = MuapiVideoClient(api_key="test-key", poll_interval=0, max_polls=2)
    output_path = tmp_path / "out" / "video.mp4"

    url = client.generate_video(
        "A gentle camera move",
        str(input_path),
        str(output_path),
        duration=3,
        video_ratio="9:16",
    )

    assert url == "https://cdn.example/video.mp4"
    assert output_path.read_bytes().startswith(b"\x00\x00\x00\x18ftyp")
    assert api_calls[0][2]["json"]["image_url"] == "https://cdn.example/frame.png"
    assert api_calls[0][2]["json"]["duration"] == 4
    assert api_calls[0][2]["json"]["aspect_ratio"] == "9:16"
