"""
Agnes Video V2.0 API client.

Implements the OpenAI-compatible Agnes video flow:
POST /v1/videos -> GET /v1/videos/{task_id} -> download result.
"""

import os
import time
from typing import Optional

import requests
from loguru import logger

AGNES_BASE_URL = "https://apihub.agnes-ai.com/v1"


def _proxy_dict(local_proxy: Optional[str]) -> Optional[dict]:
    if not local_proxy:
        return None
    return {"http": local_proxy, "https": local_proxy}


class AgnesVideoClient:
    """Agnes Video V2.0 asynchronous video generation client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        local_proxy: Optional[str] = None,
        timeout: int = 120,
        poll_interval: int = 5,
        max_polls: int = 180,
    ) -> None:
        self.api_key = api_key or os.getenv("AGNES_API_KEY", "")
        self.base_url = (base_url or os.getenv("AGNES_BASE_URL") or AGNES_BASE_URL).rstrip("/")
        self.local_proxy = local_proxy
        self.timeout = timeout
        self.poll_interval = poll_interval
        self.max_polls = max_polls

        if not self.api_key:
            logger.warning("AgnesVideoClient: AGNES_API_KEY 未设置")

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _proxies(self) -> Optional[dict]:
        return _proxy_dict(self.local_proxy)

    @staticmethod
    def _image_url(image_path: str) -> str:
        if image_path.startswith(("http://", "https://")):
            return image_path
        if image_path.startswith("data:"):
            raise ValueError("Agnes Video requires a public image URL; data URLs are not supported.")
        if os.path.exists(image_path):
            raise ValueError("Agnes Video requires a public image URL; local image files are not supported.")
        raise FileNotFoundError(f"输入图片不存在: {image_path}")

    @staticmethod
    def _num_frames(duration: int, frame_rate: int) -> int:
        target_frames = max(1, int(round(float(duration) * float(frame_rate))))
        normalized = 8 * max(0, round((target_frames - 1) / 8)) + 1
        return min(max(normalized, 1), 441)

    @staticmethod
    def _dimensions(video_ratio: str, resolution: Optional[str]) -> tuple[int, int]:
        high_res = str(resolution or "").lower() == "1080p"
        if high_res:
            sizes = {
                "16:9": (1920, 1080),
                "9:16": (1080, 1920),
                "1:1": (1080, 1080),
                "4:3": (1440, 1080),
                "3:4": (1080, 1440),
                "21:9": (1920, 824),
            }
        else:
            sizes = {
                "16:9": (1280, 720),
                "9:16": (720, 1280),
                "1:1": (1024, 1024),
                "4:3": (1024, 768),
                "3:4": (768, 1024),
                "21:9": (1344, 576),
            }
        return sizes.get(video_ratio, sizes["16:9"])

    def generate_video(
        self,
        prompt: str,
        image_path: Optional[str],
        save_path: str,
        model: str = "agnes-video-v2.0",
        duration: int = 5,
        video_ratio: str = "16:9",
        resolution: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
        frame_rate: int = 24,
        num_inference_steps: Optional[int] = None,
        mode: Optional[str] = None,
        **kwargs,
    ) -> str:
        """Generate a video, download it to save_path, and return the remote URL."""
        if not self.api_key:
            raise RuntimeError("AGNES_API_KEY not set.")

        task_id_or_url = self._submit_task(
            prompt=prompt,
            image_path=image_path,
            model=model,
            duration=duration,
            video_ratio=video_ratio,
            resolution=resolution,
            negative_prompt=negative_prompt,
            seed=seed,
            frame_rate=frame_rate,
            num_inference_steps=num_inference_steps,
            mode=mode,
        )

        video_url = (
            task_id_or_url
            if task_id_or_url.startswith(("http://", "https://"))
            else self._poll_until_done(task_id_or_url, model)
        )
        self._download_video(video_url, save_path)
        return video_url

    def _submit_task(
        self,
        prompt: str,
        image_path: Optional[str],
        model: str,
        duration: int,
        video_ratio: str,
        resolution: Optional[str],
        negative_prompt: Optional[str],
        seed: Optional[int],
        frame_rate: int,
        num_inference_steps: Optional[int],
        mode: Optional[str],
    ) -> str:
        width, height = self._dimensions(video_ratio, resolution)
        num_frames = self._num_frames(duration, frame_rate)
        payload: dict = {
            "model": model,
            "prompt": prompt,
            "width": width,
            "height": height,
            "num_frames": num_frames,
            "frame_rate": frame_rate,
        }
        if mode:
            payload["mode"] = mode
        if image_path:
            payload["image"] = self._image_url(image_path)
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        if seed is not None:
            payload["seed"] = seed
        if num_inference_steps is not None:
            payload["num_inference_steps"] = num_inference_steps

        url = f"{self.base_url}/videos"
        logger.info(
            f"AgnesVideoClient: 提交任务 model={model}, duration={duration}s, "
            f"size={width}x{height}, frames={num_frames}, image={bool(image_path)}"
        )
        resp = requests.post(
            url,
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
            proxies=self._proxies(),
        )
        if not resp.ok:
            logger.error(f"Agnes 提交失败: HTTP {resp.status_code}, 响应: {resp.text}")
            resp.raise_for_status()

        data = resp.json()
        video_url = self._extract_video_url(data)
        if video_url:
            return video_url

        task_id = data.get("video_id") or data.get("task_id") or data.get("id")
        if not task_id:
            raise RuntimeError(f"Agnes API 未返回任务 ID 或视频 URL: {data}")
        return str(task_id)

    def _poll_url(self, task_id: str, model: str) -> str:
        if task_id.startswith("video_"):
            root_url = self.base_url.removesuffix("/v1")
            return f"{root_url}/agnesapi?video_id={task_id}&model_name={model}"
        return f"{self.base_url}/videos/{task_id}"

    def _poll_until_done(self, task_id: str, model: str = "agnes-video-v2.0") -> str:
        url = self._poll_url(task_id, model)
        for i in range(self.max_polls):
            resp = requests.get(
                url,
                headers=self._headers(),
                timeout=30,
                proxies=self._proxies(),
            )
            resp.raise_for_status()
            data = resp.json()
            video_url = self._extract_video_url(data)
            if video_url:
                return video_url

            status = str(data.get("status") or data.get("task_status") or "").lower()
            if status in {"succeeded", "succeed", "completed", "complete", "done"}:
                if task_id.startswith("video_"):
                    raise RuntimeError(f"Agnes API completed without video URL: {data}")
                return f"{self.base_url}/videos/{task_id}/content"

            if status in {"failed", "error", "cancelled", "canceled", "expired"}:
                message = (
                    data.get("error", {}).get("message")
                    if isinstance(data.get("error"), dict)
                    else data.get("error")
                ) or data.get("message") or data.get("status_msg") or "未知错误"
                raise RuntimeError(f"Agnes 视频生成失败: {message} (task_id={task_id})")

            logger.debug(
                f"AgnesVideoClient: 任务进行中 {task_id}, status={status}, poll={i + 1}"
            )
            time.sleep(self.poll_interval)

        raise TimeoutError(f"Agnes 视频生成超时 (task_id={task_id})")

    def _extract_video_url(self, data: dict) -> str:
        candidates = [
            data.get("url"),
            data.get("video_url"),
            data.get("download_url"),
            data.get("remixed_from_video_id"),
            data.get("content", {}).get("video_url") if isinstance(data.get("content"), dict) else None,
            data.get("output", {}).get("video_url") if isinstance(data.get("output"), dict) else None,
            data.get("output", {}).get("url") if isinstance(data.get("output"), dict) else None,
        ]
        data_items = data.get("data")
        if isinstance(data_items, list):
            for item in data_items:
                if isinstance(item, dict):
                    candidates.extend([item.get("url"), item.get("video_url")])
        elif isinstance(data_items, dict):
            candidates.extend([data_items.get("url"), data_items.get("video_url")])

        for value in candidates:
            if isinstance(value, str) and value.startswith(("http://", "https://")):
                return value
        return ""

    def _download_video(self, video_url: str, save_path: str) -> None:
        save_dir = os.path.dirname(save_path)
        if save_dir:
            os.makedirs(save_dir, exist_ok=True)
        headers = self._headers() if video_url.startswith(self.base_url) else None
        resp = requests.get(
            video_url,
            headers=headers,
            stream=True,
            timeout=600,
            proxies=self._proxies(),
        )
        resp.raise_for_status()
        with open(save_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        logger.info(f"AgnesVideoClient: 视频已保存: {save_path}")
