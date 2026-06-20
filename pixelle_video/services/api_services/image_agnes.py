"""Agnes image generation client."""

import base64
import mimetypes
import os
import time
import uuid
from typing import Optional

import requests
from loguru import logger

AGNES_BASE_URL = "https://apihub.agnes-ai.com/v1"


def _proxy_dict(local_proxy: Optional[str]) -> Optional[dict]:
    if not local_proxy:
        return None
    return {"http": local_proxy, "https": local_proxy}


class AgnesImageClient:
    """Client for Agnes Image 2.x Flash models."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        local_proxy: Optional[str] = None,
        timeout: int = 300,
    ) -> None:
        self.api_key = api_key or os.getenv("AGNES_API_KEY", "")
        self.base_url = (base_url or os.getenv("AGNES_BASE_URL") or AGNES_BASE_URL).rstrip("/")
        self.local_proxy = local_proxy
        self.timeout = timeout

        if not self.api_key:
            logger.warning("AgnesImageClient: AGNES_API_KEY 未设置")

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _proxies(self) -> Optional[dict]:
        return _proxy_dict(self.local_proxy)

    @staticmethod
    def _image_to_url(image_path: str) -> str:
        if image_path.startswith(("http://", "https://", "data:")):
            return image_path

        if not os.path.exists(image_path):
            raise FileNotFoundError(f"输入图片不存在: {image_path}")

        mime = mimetypes.guess_type(image_path)[0] or "image/jpeg"
        with open(image_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
        return f"data:{mime};base64,{encoded}"

    @staticmethod
    def _normalize_size(size: str) -> str:
        normalized = (size or "1024x1024").replace("*", "x")
        allowed = {"1024x1024", "1792x1024", "1024x1792"}
        if normalized in allowed:
            return normalized

        try:
            width, height = [int(part) for part in normalized.split("x", 1)]
        except Exception:
            return "1024x1024"

        if width == height:
            return "1024x1024"
        return "1024x1792" if height > width else "1792x1024"

    def generate_image(
        self,
        prompt: str,
        session_id: str,
        model: str = "agnes-image-2.1-flash",
        size: str = "1024x1024",
        image_paths: Optional[list[str]] = None,
        save_dir: Optional[str] = None,
        n: int = 1,
        **kwargs,
    ) -> list[str]:
        """Generate images and return local file paths."""
        if not self.api_key:
            raise RuntimeError("AGNES_API_KEY not set.")

        image_urls = [self._image_to_url(path) for path in (image_paths or [])]
        selected_model = model or ("agnes-image-2.0-flash" if image_urls else "agnes-image-2.1-flash")
        payload: dict = {
            "model": selected_model,
            "prompt": prompt,
            "size": self._normalize_size(size),
            "n": max(1, int(n)),
        }
        if image_urls:
            payload["tags"] = ["img2img"]
            payload["extra_body"] = {
                "image": image_urls,
                "response_format": "url",
            }
        elif kwargs.get("response_format"):
            payload["response_format"] = kwargs["response_format"]

        logger.info(
            f"AgnesImageClient: 提交图片任务 model={selected_model}, "
            f"size={payload['size']}, refs={len(image_urls)}"
        )
        resp = requests.post(
            f"{self.base_url}/images/generations",
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
            proxies=self._proxies(),
        )
        if not resp.ok:
            logger.error(f"Agnes 图片生成失败: HTTP {resp.status_code}, 响应: {resp.text}")
            resp.raise_for_status()

        data = resp.json()
        return self._save_response_images(data, save_dir, session_id)

    def _save_response_images(self, data: dict, save_dir: Optional[str], session_id: str) -> list[str]:
        items = data.get("data")
        if not isinstance(items, list) or not items:
            raise RuntimeError(f"Agnes 图片 API 未返回图片数据: {data}")

        target_dir = save_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "code",
            "result",
            "image",
            str(session_id),
        )
        os.makedirs(target_dir, exist_ok=True)

        paths = []
        for item in items:
            if not isinstance(item, dict):
                continue
            path = self._save_one_image(item, target_dir)
            if path:
                paths.append(path)

        if not paths:
            raise RuntimeError(f"Agnes 图片 API 响应中未找到 url 或 b64_json: {data}")
        return paths

    def _save_one_image(self, item: dict, save_dir: str) -> Optional[str]:
        image_url = item.get("url")
        if isinstance(image_url, str) and image_url.startswith(("http://", "https://")):
            return image_url

        file_path = os.path.join(save_dir, f"agnes_{int(time.time())}_{uuid.uuid4().hex[:6]}.png")
        if item.get("b64_json"):
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(item["b64_json"]))
            return file_path

        return None
