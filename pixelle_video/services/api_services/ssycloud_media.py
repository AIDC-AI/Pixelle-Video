"""SSYCloud asynchronous image and video generation client."""

from __future__ import annotations

import base64
import mimetypes
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from loguru import logger


class SSYCloudMediaClient:
    """Call SSYCloud's unified ``tasks/generations`` media endpoint."""

    DEFAULT_BASE_URL = "https://router.shengsuanyun.com/api/v1/tasks/generations"
    SEEDANCE_MODELS = {
        "bytedance/doubao-seedance-2-5",
        "bytedance/doubao-seedance-2-0",
        "bytedance/doubao-seedance-2-0-fast",
    }
    SUCCESS_STATUSES = {"COMPLETED", "SUCCESS", "SUCCEEDED"}
    FAILURE_STATUSES = {"FAILED", "ERROR", "CANCELED", "CANCELLED", "EXPIRED"}

    def __init__(
        self,
        api_key: str,
        base_url: str | None = None,
        local_proxy: str | None = None,
        poll_interval: float = 3.0,
        max_poll_seconds: float = 1800.0,
    ):
        if not api_key or not api_key.strip():
            raise RuntimeError("SSYCloud API Key 未配置，请在 API 媒体模型区域填写。")

        self.api_key = api_key.strip()
        self.base_url = self._normalize_base_url(base_url or self.DEFAULT_BASE_URL)
        self.local_proxy = local_proxy or None
        self.poll_interval = poll_interval
        self.max_poll_seconds = max_poll_seconds

    @staticmethod
    def _normalize_base_url(base_url: str) -> str:
        normalized = (base_url or "").strip().rstrip("/")
        for suffix in ("/tasks/generations", "/v1/tasks/generations"):
            if normalized.endswith(suffix):
                normalized = normalized[: -len(suffix)].rstrip("/")
                if suffix.startswith("/v1"):
                    normalized = f"{normalized}/v1"
                break
        if normalized.endswith("/api"):
            normalized = f"{normalized}/v1"
        return normalized

    def _client(self, timeout: float = 60.0) -> httpx.Client:
        kwargs: dict[str, Any] = {
            "headers": {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            "timeout": timeout,
            "follow_redirects": True,
        }
        if self.local_proxy:
            kwargs["proxy"] = self.local_proxy
        return httpx.Client(**kwargs)

    def _download_client(self, timeout: float = 180.0) -> httpx.Client:
        """Create a client without API credentials for provider-owned output URLs."""
        kwargs: dict[str, Any] = {
            "timeout": timeout,
            "follow_redirects": True,
        }
        if self.local_proxy:
            kwargs["proxy"] = self.local_proxy
        return httpx.Client(**kwargs)

    def generate_image(
        self,
        *,
        prompt: str,
        model: str,
        save_path: str,
        aspect_ratio: str = "16:9",
        seed: int | None = None,
    ) -> str:
        payload = self._build_image_payload(
            prompt=prompt,
            model=model,
            aspect_ratio=aspect_ratio,
            seed=seed,
        )
        output_url = self._run_task(payload, media_type="image")
        return self._download(output_url, save_path, default_suffix=".png")

    def generate_video(
        self,
        *,
        prompt: str,
        model: str,
        save_path: str,
        image_path: str | None = None,
        duration: int = 5,
        video_ratio: str = "16:9",
        resolution: str = "720p",
        negative_prompt: str | None = None,
        seed: int | None = None,
        watermark: bool | None = None,
        generate_audio: bool | None = None,
        last_image_path: str | None = None,
        first_clip_path: str | None = None,
        reference_image_path: str | None = None,
        reference_image_paths: list[str] | None = None,
        reference_video_paths: list[str] | None = None,
        reference_audio_path: str | None = None,
        audio_path: str | None = None,
    ) -> str:
        payload = self._build_video_payload(
            prompt=prompt,
            model=model,
            duration=duration,
            video_ratio=video_ratio,
            resolution=resolution,
            negative_prompt=negative_prompt,
            seed=seed,
            watermark=watermark,
            generate_audio=generate_audio,
            image_path=image_path,
            last_image_path=last_image_path,
            first_clip_path=first_clip_path,
            reference_image_path=reference_image_path,
            reference_image_paths=reference_image_paths,
            reference_video_paths=reference_video_paths,
            reference_audio_path=reference_audio_path,
            audio_path=audio_path,
        )
        output_url = self._run_task(payload, media_type="video")
        return self._download(output_url, save_path, default_suffix=".mp4")

    @staticmethod
    def _build_image_payload(
        *,
        prompt: str,
        model: str,
        aspect_ratio: str,
        seed: int | None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
        }
        if seed is not None:
            payload["seed"] = seed
        return payload

    @classmethod
    def _build_video_payload(
        cls,
        *,
        prompt: str,
        model: str,
        duration: int,
        video_ratio: str,
        resolution: str,
        negative_prompt: str | None,
        seed: int | None,
        watermark: bool | None,
        generate_audio: bool | None,
        image_path: str | None = None,
        last_image_path: str | None = None,
        first_clip_path: str | None = None,
        reference_image_path: str | None = None,
        reference_image_paths: list[str] | None = None,
        reference_video_paths: list[str] | None = None,
        reference_audio_path: str | None = None,
        audio_path: str | None = None,
    ) -> dict[str, Any]:
        normalized_resolution = resolution.lower()
        if model in cls.SEEDANCE_MODELS:
            content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
            cls._append_media_content(content, "image_url", image_path, "first_frame")
            cls._append_media_content(content, "image_url", last_image_path, "last_frame")
            cls._append_media_content(content, "image_url", reference_image_path, "reference_image")
            for path in reference_image_paths or []:
                cls._append_media_content(content, "image_url", path, "reference_image")
            cls._append_media_content(content, "video_url", first_clip_path, "reference_video")
            for path in reference_video_paths or []:
                cls._append_media_content(content, "video_url", path, "reference_video")
            cls._append_media_content(
                content,
                "audio_url",
                reference_audio_path or audio_path,
                "reference_audio",
            )

            payload = {
                "model": model,
                "content": content,
                "resolution": normalized_resolution,
                "ratio": video_ratio,
                "duration": duration,
                "generate_audio": False if generate_audio is None else generate_audio,
                "watermark": False if watermark is None else watermark,
                "return_last_frame": False,
                "tools": [],
            }
            if seed is not None:
                payload["seed"] = seed
            return payload

        raise ValueError(f"暂不支持的 SSYCloud 视频模型: {model}")

    @classmethod
    def _append_media_content(
        cls,
        content: list[dict[str, Any]],
        media_type: str,
        path_or_url: str | None,
        role: str,
    ) -> None:
        if not path_or_url:
            return
        content.append(
            {
                "type": media_type,
                media_type: {
                    "url": cls._to_media_url(path_or_url),
                    "role": role,
                },
            }
        )

    @staticmethod
    def _to_media_url(path_or_url: str) -> str:
        value = str(path_or_url).strip()
        if value.startswith(("http://", "https://", "data:")):
            return value

        path = Path(value)
        if not path.is_file():
            raise FileNotFoundError(f"SSYCloud 参考素材不存在: {value}")

        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:{mime_type};base64,{encoded}"

    def _run_task(self, payload: dict[str, Any], media_type: str) -> str:
        endpoint = f"{self.base_url}/tasks/generations"
        logger.info(f"SSYCloud: submitting {media_type} task model={payload.get('model')}")
        with self._client() as client:
            response = client.post(endpoint, json=payload)
            response.raise_for_status()
            body = response.json()

        task_data = body.get("data") if isinstance(body, dict) else None
        task_data = task_data if isinstance(task_data, dict) else {}
        request_id = task_data.get("request_id") or task_data.get("task_id")
        if not request_id:
            raise RuntimeError(f"SSYCloud 未返回 request_id: {body}")

        return self._poll_task(str(request_id), media_type)

    def _poll_task(self, request_id: str, media_type: str) -> str:
        endpoint = f"{self.base_url}/tasks/generations/{request_id}"
        deadline = time.monotonic() + self.max_poll_seconds

        with self._client() as client:
            while time.monotonic() < deadline:
                response = client.get(endpoint)
                response.raise_for_status()
                body = response.json()
                task_data = body.get("data") if isinstance(body, dict) else None
                task_data = task_data if isinstance(task_data, dict) else {}
                status = str(task_data.get("status") or "").upper()
                output_url = self._extract_output_url(task_data, media_type)

                if output_url and (status in self.SUCCESS_STATUSES or not status):
                    return output_url
                if status in self.SUCCESS_STATUSES:
                    raise RuntimeError(
                        f"SSYCloud 任务已完成但未返回 {media_type} 产物 URL: {body}"
                    )
                if status in self.FAILURE_STATUSES:
                    message = task_data.get("message") or body.get("message") or body
                    raise RuntimeError(f"SSYCloud 任务失败 ({status}): {message}")

                logger.debug(f"SSYCloud task {request_id}: status={status or 'UNKNOWN'}")
                time.sleep(self.poll_interval)

        raise TimeoutError(f"SSYCloud 任务轮询超时: request_id={request_id}")

    @classmethod
    def _extract_output_url(cls, data: Any, media_type: str) -> str | None:
        if not isinstance(data, dict):
            return None

        preferred_keys = {
            "image": ("image_urls", "images", "url", "urls", "file_urls"),
            "video": ("video_urls", "videos", "url", "urls", "file_urls"),
        }.get(media_type, ("url", "urls", "file_urls"))

        for key in preferred_keys:
            value = data.get(key)
            if isinstance(value, str) and value.startswith(("http://", "https://")):
                return value
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, str) and item.startswith(("http://", "https://")):
                        return item
                    if isinstance(item, dict):
                        nested = cls._extract_output_url(item, media_type)
                        if nested:
                            return nested

        for value in data.values():
            if isinstance(value, dict):
                nested = cls._extract_output_url(value, media_type)
                if nested:
                    return nested
        return None

    def _download(self, url: str, save_path: str, default_suffix: str) -> str:
        target = Path(save_path)
        if not target.suffix:
            remote_suffix = Path(urlparse(url).path).suffix
            target = target.with_suffix(remote_suffix or default_suffix)
        target.parent.mkdir(parents=True, exist_ok=True)

        with self._download_client() as client:
            response = client.get(url)
            response.raise_for_status()
            target.write_bytes(response.content)

        if not os.path.exists(target):
            raise RuntimeError(f"SSYCloud 产物下载失败: {target}")
        logger.info(f"SSYCloud output saved: {target}")
        return str(target)
