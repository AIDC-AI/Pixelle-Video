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
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from loguru import logger


class APIAssetAnalysisService:
    """Analyze image/video assets with a direct VLM API provider."""

    IMAGE_PROMPT = """请分析这张素材图片，用中文给出适合短视频脚本创作的简洁描述。

请重点说明：
1. 画面主体、人物/商品/场景
2. 可用于营销或叙事的关键信息
3. 画面风格、氛围、颜色和构图

输出 2-5 句话，不要编造图片中不存在的信息。"""

    VIDEO_PROMPT = """请基于这些从同一个视频素材中抽取的关键帧，用中文概括视频内容。

请重点说明：
1. 视频中的主体、场景和动作变化
2. 可用于短视频脚本的卖点或叙事信息
3. 整体风格、节奏和氛围

输出 3-6 句话，不要编造关键帧中看不到的信息。"""

    def __init__(self, config: dict, core=None):
        self.config = config
        self.core = core

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
        max_frames: int = 6,
        **_: object,
    ) -> str:
        video_file = Path(video_path)
        if not video_file.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        with tempfile.TemporaryDirectory(prefix="pixelle_vlm_frames_") as tmpdir:
            frame_paths = await asyncio.to_thread(
                self._extract_video_frames,
                video_file,
                Path(tmpdir),
                max_frames,
            )
            if not frame_paths:
                logger.warning(f"No frames extracted from video: {video_path}")
                return "Video asset (frame extraction failed)"

            return await self._query_vlm(
                prompt=prompt or self.VIDEO_PROMPT,
                image_paths=[str(path) for path in frame_paths],
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

    async def _query_vlm(self, prompt: str, image_paths: list[str], model: Optional[str]) -> str:
        from pixelle_video.services.api_services.vlm_client import VLM

        selected_model = model or self._default_vlm_model()
        logger.info(f"Analyzing asset via API VLM model={selected_model}, images={len(image_paths)}")

        providers = self.config.get("api_providers", {}) or {}
        common = providers.get("common", {}) or {}
        dashscope = providers.get("dashscope", {}) or {}
        gemini = providers.get("gemini", {}) or {}
        openai = providers.get("openai", {}) or {}

        client = VLM(
            dashscope_api_key=dashscope.get("api_key"),
            dashscope_base_url=dashscope.get("base_url"),
            gemini_api_key=gemini.get("api_key"),
            gemini_base_url=gemini.get("base_url"),
            gpt_api_key=openai.get("api_key"),
            gpt_base_url=openai.get("base_url"),
            local_proxy=common.get("local_proxy"),
        )
        result = await asyncio.to_thread(
            client.query,
            prompt,
            image_paths,
            selected_model,
        )
        description = str(result or "").strip()
        if not description:
            raise RuntimeError("API VLM analysis returned empty description")
        return description

    def _default_vlm_model(self) -> str:
        llm_model = (self.config.get("llm", {}) or {}).get("model", "")
        model_lower = llm_model.lower()
        if any(marker in model_lower for marker in ("qwen", "kimi", "gpt", "gemini")):
            return llm_model

        providers = self.config.get("api_providers", {}) or {}
        if (providers.get("dashscope", {}) or {}).get("api_key"):
            return "qwen3.6-plus"
        if (providers.get("openai", {}) or {}).get("api_key"):
            return "gpt-5.4"
        if (providers.get("gemini", {}) or {}).get("api_key"):
            return "gemini-2.5-pro"
        return "qwen3.6-plus"

    def _extract_video_frames(self, video_file: Path, output_dir: Path, max_frames: int) -> list[Path]:
        output_pattern = output_dir / "frame_%02d.jpg"
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(video_file),
            "-vf",
            f"fps=1,scale=512:-1",
            "-frames:v",
            str(max_frames),
            "-q:v",
            "3",
            "-y",
            str(output_pattern),
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
        except Exception as exc:
            logger.warning(f"Failed to extract frames from {video_file}: {exc}")
            return []
        return sorted(output_dir.glob("frame_*.jpg"))

    def _get_asset_type(self, path: Path) -> str:
        image_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        video_exts = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
        ext = path.suffix.lower()
        if ext in image_exts:
            return "image"
        if ext in video_exts:
            return "video"
        return "unknown"
