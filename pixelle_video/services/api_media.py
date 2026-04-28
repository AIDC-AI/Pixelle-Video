# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0

"""Direct API provider media generation adapter."""

import asyncio
import os
from pathlib import Path
from typing import Optional

from loguru import logger

from pixelle_video.config import config_manager
from pixelle_video.models.media import MediaResult
from pixelle_video.utils.os_util import get_output_path


class APIProviderMediaService:
    """Adapter from Pixelle media calls to direct provider API clients."""

    IMAGE_MODELS = {
        "dashscope": [
            "wan2.7-image",
            "wan2.7-image-pro",
            "wan2.6-t2i",
        ],
        "openai": [
            "gpt-image-2",
        ],
        "seedream": [
            "doubao-seedream-5-0-260128",
            "doubao-seedream-4-5-251128",
            "doubao-seedream-4-0-250828",
        ],
        "jimeng": [
            "jimeng-3.1",
        ],
    }

    VIDEO_MODELS = {
        "dashscope": [
            "wan2.7-i2v",
            "wan2.6-i2v-flash",
            "happyhorse-1.0-i2v",
        ],
        "kling": [
            "kling-v3",
            "kling-v2-6",
            "kling-v2-5-turbo",
        ],
        "seedance": [
            "doubao-seedance-2-0-260128",
            "doubao-seedance-2-0-fast-260128",
            "seedance-1-0-pro",
            "seedance-1-0-lite",
        ],
        "jimeng": [
            "jimeng-video",
        ],
    }

    def __init__(self, config: dict, core=None):
        self.config = config
        self.core = core

    def list_workflows(self) -> list[dict]:
        """Return API models in the same shape as Comfy workflow metadata."""
        workflows = []

        for provider, models in self.IMAGE_MODELS.items():
            for model in models:
                workflows.append(self._workflow_info(provider, model, "image"))

        for provider, models in self.VIDEO_MODELS.items():
            for model in models:
                workflows.append(self._workflow_info(provider, model, "video"))

        return workflows

    def _workflow_info(self, provider: str, model: str, media_type: str) -> dict:
        key = f"api/{provider}/{model}"
        return {
            "name": model,
            "display_name": f"{model} - API {provider.title()}",
            "source": "api",
            "provider": provider,
            "model": model,
            "media_type": media_type,
            "path": key,
            "key": key,
        }

    def resolve_workflow(self, workflow: str) -> dict:
        """Resolve an api/provider/model key to model metadata."""
        for info in self.list_workflows():
            if info["key"] == workflow:
                return info
        available = ", ".join(info["key"] for info in self.list_workflows())
        raise ValueError(f"API workflow '{workflow}' not found. Available API workflows: {available}")

    async def __call__(
        self,
        prompt: str,
        workflow: str,
        media_type: str = "image",
        width: Optional[int] = None,
        height: Optional[int] = None,
        duration: Optional[float] = None,
        output_path: Optional[str] = None,
        image_path: Optional[str] = None,
        **params,
    ) -> MediaResult:
        info = self.resolve_workflow(workflow)
        provider = info["provider"]
        model = info["model"]
        resolved_media_type = info.get("media_type") or media_type

        if resolved_media_type == "image":
            image_paths = params.pop("image_paths", None)
            return await self._generate_image(
                provider=provider,
                model=model,
                prompt=prompt,
                width=width,
                height=height,
                output_path=output_path,
                image_paths=image_paths,
                **params,
            )

        resolved_image_path = image_path or params.pop("image_path", None)
        return await self._generate_video(
            provider=provider,
            model=model,
            prompt=prompt,
            image_path=resolved_image_path,
            output_path=output_path,
            duration=duration,
            width=width,
            height=height,
            **params,
        )

    async def _generate_image(
        self,
        provider: str,
        model: str,
        prompt: str,
        width: Optional[int],
        height: Optional[int],
        output_path: Optional[str],
        image_paths: Optional[list[str]] = None,
        **params,
    ) -> MediaResult:
        from pixelle_video.services.api_services.image_client import ImageClient

        client = self._create_image_client()
        save_dir = self._save_dir(output_path, "api_images")
        ratio = self._ratio(width, height)
        resolution = self._resolution(width, height)
        session_id = params.get("session_id") or "pixelle"

        logger.info(f"Generating image via API provider={provider}, model={model}")
        paths = await asyncio.to_thread(
            client.generate_image,
            prompt=prompt,
            image_paths=image_paths,
            model=model,
            save_dir=save_dir,
            session_id=session_id,
            video_ratio=ratio,
            resolution=resolution,
        )

        if not paths:
            raise RuntimeError(f"API image generation returned no result: provider={provider}, model={model}")

        result_path = paths[0]
        if output_path and os.path.exists(result_path) and os.path.abspath(result_path) != os.path.abspath(output_path):
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            os.replace(result_path, output_path)
            result_path = output_path

        return MediaResult(media_type="image", url=result_path)

    async def _generate_video(
        self,
        provider: str,
        model: str,
        prompt: str,
        image_path: Optional[str],
        output_path: Optional[str],
        duration: Optional[float],
        width: Optional[int],
        height: Optional[int],
        **params,
    ) -> MediaResult:
        from pixelle_video.services.api_services.video_client import VideoClient

        if not image_path:
            raise ValueError(
                "API video models require an input image_path. "
                "Use an image template first or pass image_path when calling media generation."
            )

        client = self._create_video_client()
        save_path = output_path or os.path.join(self._save_dir(None, "api_videos"), "video.mp4")
        ratio = self._ratio(width, height)
        requested_duration = int(duration or params.get("duration") or 5)
        safe_duration = self._video_duration(provider, model, requested_duration)

        logger.info(f"Generating video via API provider={provider}, model={model}")
        await asyncio.to_thread(
            client.generate_video,
            prompt=prompt,
            image_path=image_path,
            save_path=save_path,
            model=model,
            duration=safe_duration,
            video_ratio=ratio,
        )

        if not os.path.exists(save_path):
            raise RuntimeError(f"API video generation did not create file: {save_path}")

        return MediaResult(media_type="video", url=save_path, duration=safe_duration)

    def _create_image_client(self):
        from pixelle_video.services.api_services.image_client import ImageClient

        cfg = config_manager.get_api_providers_config()
        return ImageClient(
            dashscope_api_key=cfg["dashscope"].get("api_key") or None,
            dashscope_base_url=cfg["dashscope"].get("base_url") or None,
            jimeng_base_url=cfg["jimeng"].get("base_url") or None,
            jimeng_access_key=cfg["jimeng"].get("access_key") or None,
            jimeng_secret_key=cfg["jimeng"].get("secret_key") or None,
            gpt_api_key=cfg["openai"].get("api_key") or None,
            gpt_base_url=cfg["openai"].get("base_url") or None,
            local_proxy=cfg["common"].get("local_proxy") or None,
            ark_api_key=cfg["ark"].get("api_key") or None,
            ark_base_url=cfg["ark"].get("base_url") or None,
        )

    def _create_video_client(self):
        from pixelle_video.services.api_services.video_client import VideoClient

        cfg = config_manager.get_api_providers_config()
        return VideoClient(
            dashscope_api_key=cfg["dashscope"].get("api_key") or None,
            dashscope_base_url=cfg["dashscope"].get("base_url") or None,
            jimeng_base_url=cfg["jimeng"].get("base_url") or None,
            jimeng_access_key=cfg["jimeng"].get("access_key") or None,
            jimeng_secret_key=cfg["jimeng"].get("secret_key") or None,
            kling_access_key=cfg["kling"].get("access_key") or None,
            kling_secret_key=cfg["kling"].get("secret_key") or None,
            kling_base_url=cfg["kling"].get("base_url") or None,
            ark_api_key=cfg["ark"].get("api_key") or None,
            ark_base_url=cfg["ark"].get("base_url") or None,
        )

    def _save_dir(self, output_path: Optional[str], fallback_name: str) -> str:
        if output_path:
            return str(Path(output_path).parent)
        return get_output_path(fallback_name)

    def _ratio(self, width: Optional[int], height: Optional[int]) -> str:
        if not width or not height:
            return "16:9"
        if width == height:
            return "1:1"
        return "9:16" if height > width else "16:9"

    def _resolution(self, width: Optional[int], height: Optional[int]) -> str:
        largest = max(width or 0, height or 0)
        if largest >= 3600:
            return "4K"
        if largest >= 2000:
            return "2K"
        return "1080P"

    def _video_duration(self, provider: str, model: str, duration: int) -> int:
        """Normalize requested duration to ranges accepted by common providers."""
        model_lower = model.lower()

        if provider == "dashscope":
            return 10 if duration >= 8 else 5

        if provider == "kling":
            if "v3" in model_lower:
                return min(max(duration, 3), 15)
            return 10 if duration >= 8 else 5

        if provider == "seedance":
            return min(max(duration, 5), 10)

        return max(duration, 1)
