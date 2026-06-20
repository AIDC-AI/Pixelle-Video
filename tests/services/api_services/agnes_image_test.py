from pixelle_video.services.api_services import image_agnes
from pixelle_video.services.api_services.image_agnes import AgnesImageClient
from pixelle_video.services.api_services.image_client import ImageClient


class DummyResponse:
    def __init__(self, data=None, content=b"image", ok=True, status_code=200):
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


def test_generate_text_to_image_builds_agnes_payload(monkeypatch, tmp_path):
    captured = {}

    def fake_post(url, headers, json, timeout, proxies):
        captured.update({"url": url, "headers": headers, "json": json, "proxies": proxies})
        return DummyResponse({"data": [{"url": "https://cdn.example/image.png"}]})

    monkeypatch.setattr(image_agnes.requests, "post", fake_post)

    client = AgnesImageClient(
        api_key="key",
        base_url="https://apihub.agnes-ai.com/v1",
        local_proxy="http://127.0.0.1:9090",
    )
    paths = client.generate_image(
        prompt="A floating city",
        session_id="session",
        model="agnes-image-2.1-flash",
        size="1792x1024",
        save_dir=str(tmp_path),
    )

    assert paths == ["https://cdn.example/image.png"]
    assert captured["url"] == "https://apihub.agnes-ai.com/v1/images/generations"
    assert captured["headers"]["Authorization"] == "Bearer key"
    assert captured["proxies"] == {
        "http": "http://127.0.0.1:9090",
        "https": "http://127.0.0.1:9090",
    }
    assert captured["json"] == {
        "model": "agnes-image-2.1-flash",
        "prompt": "A floating city",
        "size": "1792x1024",
        "n": 1,
    }


def test_generate_image_to_image_builds_extra_body(monkeypatch, tmp_path):
    image_path = tmp_path / "input.jpg"
    image_path.write_bytes(b"jpg")
    captured = {}

    def fake_post(url, headers, json, timeout, proxies):
        captured.update({"json": json})
        return DummyResponse({"data": [{"b64_json": "cG5nLWJ5dGVz"}]})

    monkeypatch.setattr(image_agnes.requests, "post", fake_post)

    client = AgnesImageClient(api_key="key")
    paths = client.generate_image(
        prompt="Make it neon",
        session_id="session",
        model="agnes-image-2.0-flash",
        size="1920*1080",
        image_paths=[str(image_path)],
        save_dir=str(tmp_path),
    )

    assert len(paths) == 1
    assert captured["json"]["model"] == "agnes-image-2.0-flash"
    assert captured["json"]["size"] == "1792x1024"
    assert captured["json"]["tags"] == ["img2img"]
    assert captured["json"]["extra_body"]["response_format"] == "url"
    assert captured["json"]["extra_body"]["image"][0].startswith("data:image/jpeg;base64,")


def test_image_client_routes_agnes_models(monkeypatch, tmp_path):
    captured = {}

    class FakeAgnesClient:
        def generate_image(self, **kwargs):
            captured.update(kwargs)
            output = tmp_path / "result.png"
            output.write_bytes(b"png")
            return [str(output)]

    client = ImageClient(agnes_api_key="key", agnes_base_url="https://apihub.agnes-ai.com/v1")
    client._agnes_client = FakeAgnesClient()

    paths = client.generate_image(
        prompt="A clean poster",
        model="agnes-image-2.1-flash",
        save_dir=str(tmp_path),
        session_id="sid",
        video_ratio="16:9",
        resolution="1080P",
    )

    assert paths == [str(tmp_path / "result.png")]
    assert captured["prompt"] == "A clean poster"
    assert captured["model"] == "agnes-image-2.1-flash"
    assert captured["session_id"] == "sid"
    assert captured["size"] == "1920x1080"
    assert captured["image_paths"] is None
    assert captured["save_dir"] == str(tmp_path)
