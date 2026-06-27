# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
API VLM-based asset analysis service.

This service mirrors the text description contract of ImageAnalysisService and
VideoAnalysisService, but uses direct provider VLM APIs instead of ComfyUI or
RunningHub workflows.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Optional

from loguru import logger


class APIAssetAnalysisService:
    """Analyze image/video assets with a direct VLM API provider."""

    VLM_MODELS = {
        "dashscope": [
            "qwen3.7-plus",
            "qwen3.6-plus",
            "qwen3.6-flash",
            "qwen3.5-omni-plus",
        ],
        # TwelveLabs Pegasus is a video-native understanding model: it reasons
        # over the whole clip (motion, scene changes, action) rather than a few
        # sampled frames, so it only handles video assets — not images.
        "twelvelabs": [
            "pegasus1.5",
            "pegasus1.2",
        ],
    }

    VLM_PROVIDER_LABELS = {
        "dashscope": "DashScope",
        "twelvelabs": "TwelveLabs",
    }

    # Providers whose models can only analyze video assets (not images).
    VIDEO_ONLY_PROVIDERS = {"twelvelabs"}

    IMAGE_PROMPT = """请分析这张素材图片，用中文给出适合短视频脚本创作的简洁描述。

请重点说明：
1. 画面主体、人物/商品/场景
2. 可用于营销或叙事的关键信息
3. 画面风格、氛围、颜色和构图

输出 2-5 句话，不要编造图片中不存在的信息。"""

    VIDEO_PROMPT = """请分析这个上传的视频素材，用中文概括视频内容。

请重点说明：
1. 视频中的主体、场景和动作变化
2. 可用于短视频脚本的卖点或叙事信息
3. 整体风格、节奏和氛围

输出 3-6 句话，不要编造关键帧中看不到的信息。"""

    def __init__(self, config: dict, core=None):
        self.config = config
        self.core = core

    def list_models(self, configured_only: bool = True) -> list[dict]:
        """Return VLM models available for API-backed asset analysis."""
        providers = self.config.get("api_providers", {}) or {}
        models = []

        for provider, provider_models in self.VLM_MODELS.items():
            provider_config = providers.get(provider, {}) or {}
            if configured_only and not provider_config.get("api_key"):
                continue

            provider_label = self.VLM_PROVIDER_LABELS.get(provider, provider.title())
            video_only = provider in self.VIDEO_ONLY_PROVIDERS
            supported_assets = ["video"] if video_only else ["image", "video"]
            for model in provider_models:
                key = f"api/vlm/{provider}/{model}"
                models.append({
                    "key": key,
                    "name": model,
                    "display_name": f"{model} - API {provider_label}",
                    "source": "api",
                    "provider": provider,
                    "model": model,
                    "media_type": "asset_analysis",
                    "ability_type": "vlm_asset_analysis",
                    "ability_types": ["vlm_asset_analysis"],
                    "supported_assets": supported_assets,
                })

        return models

    async def analyze_image(
        self,
        image_path: str,
        model: Optional[str] = None,
        prompt: Optional[str] = None,
        **_: object,
    ) -> str:
        image_file = Path(image_path)
        if not image_file.exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")

        if self._provider_of(model) in self.VIDEO_ONLY_PROVIDERS:
            raise ValueError(
                f"Model '{model}' is video-only and cannot analyze images. "
                "Select a vision model that supports images for image assets."
            )

        return await self._query_vlm(
            prompt=prompt or self.IMAGE_PROMPT,
            image_paths=[str(image_file)],
            model=model,
        )

    async def analyze_video(
        self,
        video_path: str,
        model: Optional[str] = None,
        prompt: Optional[str] = None,
        **_: object,
    ) -> str:
        video_file = Path(video_path)
        if not video_file.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        return await self._query_vlm(
            prompt=prompt or self.VIDEO_PROMPT,
            image_paths=[],
            video_paths=[str(video_file)],
            model=model,
        )

    async def __call__(self, asset_path: str, asset_type: Optional[str] = None, **kwargs) -> str:
        path = Path(asset_path)
        resolved_type = asset_type or self._get_asset_type(path)
        if resolved_type == "image":
            return await self.analyze_image(asset_path, **kwargs)
        if resolved_type == "video":
            return await self.analyze_video(asset_path, **kwargs)
        raise ValueError(f"Unsupported asset type for VLM analysis: {asset_path}")

    async def _query_vlm(
        self,
        prompt: str,
        image_paths: list[str],
        model: Optional[str],
        video_paths: Optional[list[str]] = None,
    ) -> str:
        from pixelle_video.services.api_services.vlm_client import VLM

        selected_model = (model or "").strip()
        if not selected_model:
            raise RuntimeError(
                "API VLM analysis requires an explicitly selected VLM model. "
                "Please choose one in the asset analysis service settings."
            )

        logger.info(
            f"Analyzing asset via API VLM model={selected_model}, "
            f"images={len(image_paths)}, videos={len(video_paths or [])}"
        )

        providers = self.config.get("api_providers", {}) or {}
        dashscope = providers.get("dashscope", {}) or {}
        twelvelabs = providers.get("twelvelabs", {}) or {}

        client = VLM(
            dashscope_api_key=dashscope.get("api_key"),
            dashscope_base_url=dashscope.get("base_url"),
            twelvelabs_api_key=twelvelabs.get("api_key"),
        )
        result = await asyncio.to_thread(
            client.query,
            prompt,
            image_paths,
            selected_model,
            None,
            video_paths,
        )
        description = str(result or "").strip()
        if not description:
            raise RuntimeError("API VLM analysis returned empty description")
        return description

    def _provider_of(self, model: Optional[str]) -> Optional[str]:
        """Resolve which provider a bare model name belongs to."""
        name = (model or "").strip()
        for provider, provider_models in self.VLM_MODELS.items():
            if name in provider_models:
                return provider
        return None

    def _get_asset_type(self, path: Path) -> str:
        image_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        video_exts = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
        ext = path.suffix.lower()
        if ext in image_exts:
            return "image"
        if ext in video_exts:
            return "video"
        return "unknown"
