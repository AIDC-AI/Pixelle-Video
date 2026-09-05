"""MuAPI direct image and video provider clients.

The provider API is intentionally kept behind this small adapter so the rest of
Pixelle can use its existing local-file media contract. Requests submit an
asynchronous job, poll the prediction result, and download the returned media.
"""

from __future__ import annotations

import logging
import mimetypes
import os
import time
import uuid
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

MUAPI_DEFAULT_BASE_URL = "https://api.muapi.ai/api/v1"
MUAPI_POLL_INTERVAL = 5
MUAPI_MAX_POLLS = 120
MUAPI_REQUEST_TIMEOUT = 60
MUAPI_DOWNLOAD_TIMEOUT = 120


def _record(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _find_urls(value: Any, parent_key: str = "") -> list[str]:
    """Extract media URLs from the result envelopes used by MuAPI endpoints."""
    if isinstance(value, str):
        if parent_key in {
            "image_url",
            "video",
            "image",
            "output_url",
            "url",
            "outputs",
            "images",
            "output",
            "output_data",
        }:
            return [value]
        return []
    if isinstance(value, list):
        urls: list[str] = []
        for item in value:
            urls.extend(_find_urls(item, parent_key))
        return urls

    data = _record(value)
    if data is None:
        return []

    urls: list[str] = []
    for key in (
        "image_url",
        "video",
        "image",
        "output_url",
        "url",
        "outputs",
        "images",
        "output",
        "output_data",
    ):
        if key in data:
            urls.extend(_find_urls(data[key], key))

    # Preserve order while avoiding duplicate URLs returned in both an output
    # envelope and its convenience field.
    return list(dict.fromkeys(urls))


def _find_request_id(value: Any) -> str | None:
    data = _record(value)
    if data is None:
        return None
    for key in ("request_id", "id", "task_id"):
        candidate = data.get(key)
        if isinstance(candidate, str) and candidate:
            return candidate
    return _find_request_id(data.get("data")) or _find_request_id(data.get("output"))


def _find_status(value: Any) -> str | None:
    data = _record(value)
    if data is None:
        return None
    status = data.get("status")
    if isinstance(status, str):
        return status.lower()
    return _find_status(data.get("data")) or _find_status(data.get("output"))


def _find_error(value: Any) -> str | None:
    data = _record(value)
    if data is None:
        return None
    for key in ("error", "message", "detail"):
        candidate = data.get(key)
        if isinstance(candidate, str) and candidate:
            return candidate
    return _find_error(data.get("data")) or _find_error(data.get("output"))


def _https_url(value: str, label: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError(f"MuAPI returned an invalid {label} URL; HTTPS is required")
    return value


class MuapiMediaClient:
    """Shared authenticated submit/poll/download behavior for MuAPI media."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        local_proxy: Optional[str] = None,
        timeout: int = MUAPI_REQUEST_TIMEOUT,
        poll_interval: int = MUAPI_POLL_INTERVAL,
        max_polls: int = MUAPI_MAX_POLLS,
    ) -> None:
        self.api_key = api_key or os.getenv("MUAPI_API_KEY") or os.getenv("MU_API_KEY")
        self.base_url = (
            base_url or os.getenv("MUAPI_BASE_URL") or MUAPI_DEFAULT_BASE_URL
        ).rstrip("/")
        self.local_proxy = local_proxy
        self.timeout = timeout
        self.poll_interval = poll_interval
        self.max_polls = max_polls

    def _require_key(self) -> str:
        if not self.api_key:
            raise RuntimeError(
                "MUAPI_API_KEY or MU_API_KEY is required for direct MuAPI media generation"
            )
        return self.api_key

    def _proxies(self) -> Optional[dict[str, str]]:
        if not self.local_proxy:
            return None
        return {"http": self.local_proxy, "https": self.local_proxy}

    def _request_json(self, method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
        key = self._require_key()
        headers = {"x-api-key": key}
        if payload is not None:
            headers["Content-Type"] = "application/json"
        url = f"{self.base_url}/{path.lstrip('/')}"
        response = requests.request(
            method,
            url,
            headers=headers,
            json=payload,
            timeout=self.timeout,
            proxies=self._proxies(),
        )
        if not response.ok:
            raise RuntimeError(
                f"MuAPI {method} {path} failed ({response.status_code}): {response.text[:500]}"
            )
        try:
            return response.json()
        except ValueError as exc:
            raise RuntimeError(f"MuAPI {method} {path} returned invalid JSON") from exc

    def _upload_file(self, path: str) -> str:
        file_path = Path(path)
        if not file_path.is_file():
            raise FileNotFoundError(f"MuAPI input file not found: {path}")
        key = self._require_key()
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        with file_path.open("rb") as file_handle:
            response = requests.post(
                f"{self.base_url}/upload_file",
                headers={"x-api-key": key},
                files={"file": (file_path.name, file_handle, content_type)},
                timeout=self.timeout,
                proxies=self._proxies(),
            )
        if not response.ok:
            raise RuntimeError(
                f"MuAPI file upload failed ({response.status_code}): {response.text[:500]}"
            )
        try:
            data = response.json()
        except ValueError as exc:
            raise RuntimeError("MuAPI file upload returned invalid JSON") from exc
        urls = _find_urls(data)
        if not urls:
            raise RuntimeError("MuAPI file upload returned no file URL")
        return _https_url(urls[0], "uploaded file")

    def _poll(self, request_id: str) -> Any:
        in_progress = {"pending", "queued", "processing", "starting", "in_queue"}
        completed = {"completed", "succeeded", "success"}
        failed = {"failed", "error", "cancelled", "canceled"}

        for attempt in range(self.max_polls):
            result = self._request_json(
                "GET", f"predictions/{requests.utils.quote(request_id, safe='')}/result"
            )
            status = _find_status(result)
            if status in completed:
                return result
            if status in failed:
                raise RuntimeError(f"MuAPI generation failed: {_find_error(result) or 'unknown error'}")
            if status not in in_progress:
                raise RuntimeError(
                    f"MuAPI prediction {request_id} returned an unrecognized status: {status or '(none)'}"
                )
            if attempt + 1 < self.max_polls:
                time.sleep(self.poll_interval)

        raise TimeoutError(
            f"MuAPI prediction {request_id} timed out after {self.max_polls} polls"
        )

    def _download(self, url: str) -> bytes:
        safe_url = _https_url(url, "result")
        # Do not attach the API key to a returned media host. Redirects are
        # disabled so a provider response cannot silently move the download to
        # another host.
        response = requests.get(
            safe_url,
            timeout=self.timeout if self.timeout < MUAPI_DOWNLOAD_TIMEOUT else MUAPI_DOWNLOAD_TIMEOUT,
            stream=True,
            allow_redirects=False,
            proxies=self._proxies(),
        )
        if not response.ok:
            raise RuntimeError(
                f"MuAPI media download failed ({response.status_code}): {response.text[:300]}"
            )
        if hasattr(response, "iter_content"):
            content = b"".join(chunk for chunk in response.iter_content(chunk_size=8192) if chunk)
        else:
            content = response.content
        if not content:
            raise RuntimeError("MuAPI media download returned an empty response")
        return content

    @staticmethod
    def _image_extension(content: bytes) -> str | None:
        if content[:3] == b"\xff\xd8\xff":
            return "jpg"
        if content[:8] == b"\x89PNG\r\n\x1a\n":
            return "png"
        if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
            return "webp"
        return None

    @staticmethod
    def _looks_like_video(content: bytes) -> bool:
        return b"ftyp" in content[:32] or content[:4] == b"\x1a\x45\xdf\xa3"


class MuapiImageClient(MuapiMediaClient):
    """MuAPI Nano Banana image generation and editing client."""

    def generate_image(
        self,
        prompt: str,
        image_paths: Optional[list[str]] = None,
        model: str = "nano-banana-pro",
        save_dir: Optional[str] = None,
        session_id: Optional[str] = None,
        video_ratio: Optional[str] = "1:1",
        resolution: Optional[str] = "2K",
        **_: Any,
    ) -> list[str]:
        image_paths = image_paths or []
        image_urls = [self._upload_file(path) for path in image_paths]
        endpoint = "nano-banana-pro-edit" if image_urls else model
        if endpoint == "nano-banana-pro-edit" and not image_urls:
            raise ValueError("MuAPI image editing requires at least one reference image")

        payload: dict[str, Any] = {
            "prompt": prompt,
            "aspect_ratio": video_ratio or "1:1",
            "resolution": str(resolution or "2K").lower(),
        }
        if image_urls:
            payload["images_list"] = image_urls

        submitted = self._request_json("POST", endpoint, payload)
        request_id = _find_request_id(submitted)
        if not request_id:
            raise RuntimeError("MuAPI image request returned no prediction ID")
        result = self._poll(request_id)
        output_urls = _find_urls(result)
        if not output_urls:
            raise RuntimeError("MuAPI image request completed without an image URL")

        target_dir = Path(save_dir or (Path.cwd() / "muapi-output"))
        target_dir.mkdir(parents=True, exist_ok=True)
        saved: list[str] = []
        for index, output_url in enumerate(output_urls):
            content = self._download(output_url)
            extension = self._image_extension(content)
            if extension is None:
                raise RuntimeError("MuAPI image result was not a JPEG, PNG, or WebP image")
            filename = f"muapi_{session_id or 'image'}_{index}_{uuid.uuid4().hex[:8]}.{extension}"
            path = target_dir / filename
            path.write_bytes(content)
            saved.append(str(path))
        return saved


class MuapiVideoClient(MuapiMediaClient):
    """MuAPI Seedance text-to-video and first-frame image-to-video client."""

    def generate_video(
        self,
        prompt: str,
        image_path: Optional[str],
        save_path: str,
        model: str = "seedance-2.5-text-to-video",
        duration: int = 5,
        video_ratio: str = "16:9",
        resolution: Optional[str] = None,
        seed: Optional[int] = None,
        **_: Any,
    ) -> str:
        image_url: str | None = None
        if image_path:
            image_url = (
                _https_url(image_path, "input image")
                if image_path.startswith(("http://", "https://"))
                else self._upload_file(image_path)
            )

        endpoint = "seedance-2.5-image-to-video" if image_url else "seedance-2.5-text-to-video"
        payload: dict[str, Any] = {
            "prompt": prompt,
            "duration": min(max(int(duration or 5), 4), 30),
            "aspect_ratio": video_ratio or "16:9",
        }
        if image_url:
            payload["image_url"] = image_url
        if seed is not None:
            payload["seed"] = seed

        submitted = self._request_json("POST", endpoint, payload)
        request_id = _find_request_id(submitted)
        if not request_id:
            raise RuntimeError("MuAPI video request returned no prediction ID")
        result = self._poll(request_id)
        output_urls = _find_urls(result)
        if not output_urls:
            raise RuntimeError("MuAPI video request completed without a video URL")
        content = self._download(output_urls[0])
        if not self._looks_like_video(content):
            raise RuntimeError("MuAPI video result was not a recognized MP4 or WebM file")

        target = Path(save_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return output_urls[0]


__all__ = ["MuapiImageClient", "MuapiVideoClient"]
