# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0

"""Direct API provider media generation adapter."""

import asyncio
from copy import deepcopy
import os
from pathlib import Path
from typing import Any, Optional

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
    }

    VIDEO_MODELS = {
        "dashscope": [
            "wan2.7-i2v",
            "wan2.7-r2v",
            "wan2.7-videoedit",
            "wan2.6-i2v-flash",
            "happyhorse-1.0-i2v",
            "happyhorse-1.0-r2v",
            "happyhorse-1.0-video-edit",
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
    }

    VIDEO_MODEL_CAPABILITIES: dict[tuple[str, str], dict[str, Any]] = {
        ("dashscope", "wan2.7-i2v"): {
            "ability_type": "image_to_video",
            "ability_types": [
                "first_frame_i2v",
                "start_end_frame_i2v",
                "video_continuation",
                "audio_driven_i2v",
                "multi_shot",
            ],
            "adapter_ability_types": ["first_frame_i2v", "audio_driven_i2v"],
            "input_modalities": ["text", "image", "audio", "video"],
            "adapter_input_modalities": ["text", "image"],
            "duration": {"min": 2, "max": 15, "integer": True, "verified": True},
            "resolutions": ["720P", "1080P"],
            "ratios": ["16:9", "9:16", "1:1", "4:3", "3:4"],
            "fps": 30,
            "format": "mp4",
            "api_contract_verified": True,
            "source_urls": [
                "https://help.aliyun.com/zh/model-studio/video-generate-edit-model/",
                "https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference",
            ],
            "contract_issues": [
                "Pixelle UI exposes first-frame image-to-video; asset-based workflow can optionally pass narration audio as driving_audio.",
                "last_frame and first_clip are supported by the adapter for continuation, not character replacement.",
            ],
        },
        ("dashscope", "wan2.7-videoedit"): {
            "ability_type": "video_editing",
            "ability_types": ["video_editing", "action_transfer", "instruction_editing", "video_transfer"],
            "adapter_ability_types": ["action_transfer", "video_editing"],
            "input_modalities": ["text", "image", "video"],
            "adapter_input_modalities": ["text", "image", "video"],
            "duration": {"min": 2, "max": 10, "integer": True, "verified": True},
            "resolutions": ["720P", "1080P"],
            "ratios": ["16:9", "9:16", "1:1", "4:3", "3:4"],
            "fps": 30,
            "format": "mp4",
            "api_contract_verified": True,
            "source_urls": [
                "https://help.aliyun.com/zh/model-studio/wan-video-editing-api-reference",
                "https://help.aliyun.com/zh/model-studio/video-generate-edit-model/",
            ],
            "contract_issues": [
                "Action transfer is mapped to video plus reference_image media, following the DashScope video-edit API contract.",
            ],
        },
        ("dashscope", "wan2.7-r2v"): {
            "ability_type": "reference_to_video",
            "ability_types": [
                "reference_to_video",
                "digital_human",
                "multi_character",
                "native_audio",
                "voice_reference",
                "multi_shot",
            ],
            "adapter_ability_types": ["reference_to_video", "digital_human", "voice_reference"],
            "input_modalities": ["text", "image", "audio", "video"],
            "adapter_input_modalities": ["text", "image", "audio"],
            "duration": {"min": 2, "max": 10, "integer": True, "verified": True},
            "resolutions": ["720P", "1080P"],
            "ratios": ["16:9", "9:16", "1:1", "4:3", "3:4"],
            "fps": 30,
            "format": "mp4",
            "api_contract_verified": True,
            "source_urls": [
                "https://www.alibabacloud.com/help/doc-detail/3001146.html",
            ],
            "contract_issues": [
                "Digital human uses reference_image media and optionally attaches a TTS audio file as reference_voice for the first character.",
            ],
        },
        ("dashscope", "wan2.6-i2v-flash"): {
            "ability_type": "image_to_video",
            "ability_types": ["first_frame_i2v", "audio_driven_i2v", "multi_shot", "fast_generation"],
            "adapter_ability_types": ["first_frame_i2v"],
            "input_modalities": ["text", "image", "audio"],
            "adapter_input_modalities": ["text", "image"],
            "duration": {"min": 2, "max": 15, "integer": True, "verified": True},
            "resolutions": ["720P", "1080P"],
            "ratios": ["16:9", "9:16", "1:1", "4:3", "3:4"],
            "fps": 30,
            "format": "mp4",
            "api_contract_verified": True,
            "source_urls": [
                "https://help.aliyun.com/zh/model-studio/image-to-video-guide",
                "https://help.aliyun.com/zh/model-studio/video-generate-edit-model/",
            ],
            "contract_issues": [
                "Official model supports audio input and audio sync, but the current DashScope legacy SDK call path only passes first-frame image parameters.",
            ],
        },
        ("dashscope", "happyhorse-1.0-i2v"): {
            "ability_type": "image_to_video",
            "ability_types": ["first_frame_i2v", "native_audio"],
            "adapter_ability_types": ["first_frame_i2v", "native_audio"],
            "input_modalities": ["text", "image"],
            "adapter_input_modalities": ["text", "image"],
            "duration": {"min": 3, "max": 15, "integer": True, "verified": True},
            "resolutions": ["720P", "1080P"],
            "fps": 24,
            "format": "mp4",
            "api_contract_verified": True,
            "source_urls": [
                "https://help.aliyun.com/zh/model-studio/video-generate-edit-model/",
            ],
            "contract_issues": [],
        },
        ("dashscope", "happyhorse-1.0-video-edit"): {
            "ability_type": "video_editing",
            "ability_types": ["video_editing", "action_transfer", "instruction_editing", "native_audio"],
            "adapter_ability_types": ["action_transfer", "video_editing"],
            "input_modalities": ["text", "image", "video"],
            "adapter_input_modalities": ["text", "image", "video"],
            "duration": {"min": 3, "max": 15, "integer": True, "verified": True},
            "resolutions": ["720P", "1080P"],
            "fps": 24,
            "format": "mp4",
            "api_contract_verified": True,
            "source_urls": [
                "https://help.aliyun.com/zh/model-studio/video-generate-edit-model/",
                "https://help.aliyun.com/zh/model-studio/wan-video-editing-api-reference",
            ],
            "contract_issues": [
                "Model capability is documented in the model list; adapter uses the same video + reference_image media contract as DashScope video-edit models.",
            ],
        },
        ("dashscope", "happyhorse-1.0-r2v"): {
            "ability_type": "reference_to_video",
            "ability_types": [
                "reference_to_video",
                "digital_human",
                "multi_character",
                "native_audio",
                "multi_shot",
            ],
            "adapter_ability_types": ["reference_to_video", "digital_human"],
            "input_modalities": ["text", "image"],
            "adapter_input_modalities": ["text", "image"],
            "duration": {"min": 3, "max": 15, "integer": True, "verified": True},
            "resolutions": ["720P", "1080P"],
            "ratios": ["16:9", "9:16", "3:4", "4:3", "1:1"],
            "fps": 24,
            "format": "mp4",
            "api_contract_verified": True,
            "source_urls": [
                "https://www.alibabacloud.com/help/doc-detail/3030778.html",
            ],
            "contract_issues": [
                "HappyHorse reference-to-video supports reference_image media. The public contract does not expose reference_voice in this API.",
            ],
        },
        ("kling", "kling-v3"): {
            "ability_type": "image_to_video",
            "ability_types": [
                "text_to_video",
                "image_to_video",
                "start_end_frame_i2v",
                "native_audio",
                "multi_shot",
                "element_reference",
            ],
            "adapter_ability_types": ["first_frame_i2v", "native_audio"],
            "input_modalities": ["text", "image"],
            "adapter_input_modalities": ["text", "image"],
            "duration": {"min": 3, "max": 15, "integer": True, "verified": True},
            "resolutions": ["720P", "1080P"],
            "api_contract_verified": False,
            "source_urls": [
                "https://app.klingai.com/cn/quickstart/klingai-video-3-model-user-guide",
            ],
            "contract_issues": [
                "Official product guide confirms model capabilities, but the public API parameter contract was not found in accessible official docs.",
                "Current adapter only calls /v1/videos/image2video with one base64 image; start/end frames, element references and native audio are not exposed.",
            ],
        },
        ("kling", "kling-v2-6"): {
            "ability_type": "image_to_video",
            "ability_types": ["text_to_video", "image_to_video", "start_end_frame_i2v", "native_audio"],
            "adapter_ability_types": ["first_frame_i2v", "native_audio"],
            "input_modalities": ["text", "image"],
            "adapter_input_modalities": ["text", "image"],
            "api_contract_verified": False,
            "source_urls": [
                "https://app.klingai.com/cn/quickstart/klingai-video-3-model-user-guide",
            ],
            "contract_issues": [
                "Official product guide lists capabilities, but accessible official API parameters for duration/mode/sound were not found.",
            ],
        },
        ("kling", "kling-v2-5-turbo"): {
            "ability_type": "image_to_video",
            "ability_types": ["image_to_video"],
            "adapter_ability_types": ["first_frame_i2v", "native_audio"],
            "input_modalities": ["text", "image"],
            "adapter_input_modalities": ["text", "image"],
            "api_contract_verified": False,
            "source_urls": [],
            "contract_issues": [
                "Official accessible API/model contract was not found. Keep this model unverified until provider docs are supplied.",
            ],
        },
        ("seedance", "doubao-seedance-2-0-260128"): {
            "ability_type": "image_to_video",
            "ability_types": ["text_to_video", "image_to_video"],
            "adapter_ability_types": ["first_frame_i2v", "native_audio"],
            "input_modalities": ["text", "image"],
            "adapter_input_modalities": ["text", "image"],
            "duration": {"min": 2, "max": 12, "integer": True, "verified": True},
            "resolutions": ["720p", "1080p"],
            "ratios": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"],
            "api_contract_verified": True,
            "source_urls": [
                "https://www.volcengine.com/docs/82379/1520757",
                "https://www.volcengine.com/docs/6492/2165104?lang=zh",
            ],
            "contract_issues": [
                "Current adapter supports first_frame image-to-video plus ratio, resolution, seed, watermark and generate_audio. Additional multi-image/video roles are not exposed.",
            ],
        },
        ("seedance", "doubao-seedance-2-0-fast-260128"): {
            "ability_type": "image_to_video",
            "ability_types": ["text_to_video", "image_to_video", "fast_generation"],
            "adapter_ability_types": ["first_frame_i2v", "native_audio"],
            "input_modalities": ["text", "image"],
            "adapter_input_modalities": ["text", "image"],
            "duration": {"min": 2, "max": 12, "integer": True, "verified": True},
            "resolutions": ["720p", "1080p"],
            "ratios": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"],
            "api_contract_verified": True,
            "source_urls": [
                "https://www.volcengine.com/docs/82379/1520757",
                "https://www.volcengine.com/docs/6492/2165104?lang=zh",
            ],
            "contract_issues": [
                "Current adapter supports first_frame image-to-video plus ratio, resolution, seed, watermark and generate_audio. Additional multi-image/video roles are not exposed.",
            ],
        },
        ("seedance", "seedance-1-0-pro"): {
            "ability_type": "image_to_video",
            "ability_types": [],
            "adapter_ability_types": ["first_frame_i2v"],
            "api_contract_verified": False,
            "source_urls": [],
            "contract_issues": [
                "Exact official model ID was not found. Volcengine docs refer to doubao-seedance model IDs, so this alias must be confirmed before relying on it.",
            ],
        },
        ("seedance", "seedance-1-0-lite"): {
            "ability_type": "image_to_video",
            "ability_types": [],
            "adapter_ability_types": ["first_frame_i2v"],
            "api_contract_verified": False,
            "source_urls": [],
            "contract_issues": [
                "Exact official model ID was not found. Volcengine docs refer to doubao-seedance model IDs, so this alias must be confirmed before relying on it.",
            ],
        },
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
        info = {
            "name": model,
            "display_name": f"{model} - API {provider.title()}",
            "source": "api",
            "provider": provider,
            "model": model,
            "media_type": media_type,
            "path": key,
            "key": key,
        }
        if media_type == "video":
            capabilities = self._video_capabilities(provider, model)
            info["capabilities"] = capabilities
            info["ability_type"] = capabilities.get("ability_type")
            info["ability_types"] = capabilities.get("ability_types", [])
            info["adapter_ability_types"] = capabilities.get("adapter_ability_types", [])
            info["api_contract_verified"] = capabilities.get("api_contract_verified", False)
            info["contract_issues"] = capabilities.get("contract_issues", [])
        return info

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

        first_clip_path = params.get("first_clip_path") or params.get("first_video_path")
        reference_image_path = params.get("reference_image_path")
        reference_image_paths = params.get("reference_image_paths") or []
        reference_video_paths = params.get("reference_video_paths") or []
        has_reference_inputs = bool(reference_image_path or reference_image_paths or reference_video_paths)
        if not image_path and not first_clip_path and not has_reference_inputs:
            raise ValueError(
                "API video models require image_path, first_clip_path, or reference media inputs. "
                "Use an image template first or pass input image/video/reference media when calling media generation."
            )
        if first_clip_path and not image_path and provider != "dashscope":
            raise ValueError(f"first_clip_path is only supported for DashScope wan2.7 models, not provider={provider}.")

        client = self._create_video_client()
        save_path = output_path or os.path.join(self._save_dir(None, "api_videos"), "video.mp4")
        ratio = params.get("video_ratio") or params.get("ratio") or self._ratio(width, height)
        requested_duration = int(duration or params.get("duration") or 5)
        safe_duration = self._video_duration(provider, model, requested_duration)
        resolution = params.get("resolution") or self._video_resolution(provider, width, height)
        video_options = self._video_options(provider, model, params, resolution)

        prompt_to_use = prompt
        max_safety_retries = int(params.get("prompt_safety_retries", 1))
        for attempt in range(max_safety_retries + 1):
            try:
                logger.info(
                    f"Generating video via API provider={provider}, model={model}"
                    + (f" (safety retry {attempt})" if attempt else "")
                )
                await asyncio.to_thread(
                    client.generate_video,
                    prompt=prompt_to_use,
                    image_path=image_path,
                    save_path=save_path,
                    model=model,
                    duration=safe_duration,
                    video_ratio=ratio,
                    **video_options,
                )
                break
            except Exception as exc:
                if attempt >= max_safety_retries or not self._is_content_inspection_error(exc):
                    raise

                logger.warning(
                    "API video generation failed content inspection; "
                    f"neutralizing prompt and retrying once. provider={provider}, model={model}, error={exc}"
                )
                prompt_to_use = await self._neutralize_video_prompt(prompt_to_use)

        if not os.path.exists(save_path):
            raise RuntimeError(f"API video generation did not create file: {save_path}")

        return MediaResult(media_type="video", url=save_path, duration=safe_duration)

    def _is_content_inspection_error(self, exc: Exception) -> bool:
        """Return True when a provider rejects input because of content inspection."""
        message = str(exc).lower()
        return any(
            marker in message
            for marker in (
                "datainspectionfailed",
                "inappropriate content",
                "green net check failed",
                "content inspection",
                "safety inspection",
                "risk control",
            )
        )

    async def _neutralize_video_prompt(self, prompt: str) -> str:
        """Use the configured LLM to rewrite a video prompt into a safer neutral prompt."""
        if not prompt or not prompt.strip():
            return prompt

        rewrite_instruction = f"""
请将下面的视频生成提示词改写为更中性、安全、适合公开视频生成模型审核的画面描述。

要求：
1. 保留原本的积极含义、画面主题和视觉风格。
2. 去掉可能触发审核的暴力、危险、恐惧、政治、成人、歧视、极端情绪、自伤、违法、攻击性表达。
3. 不要提及“审核”“违规”“敏感词”等元信息。
4. 只输出改写后的提示词，不要解释。
5. 输出优先使用英文，画面描述要具体、平和、正向。

原提示词：
{prompt}
""".strip()

        try:
            from pixelle_video.services.llm_service import LLMService

            llm = LLMService(config_manager.config.model_dump())
            rewritten = await llm(
                rewrite_instruction,
                temperature=0.2,
                max_tokens=500,
            )
            rewritten = self._clean_rewritten_prompt(str(rewritten))
            if rewritten:
                logger.info(f"Neutralized API video prompt: {rewritten[:200]}")
                return rewritten
        except Exception as exc:
            logger.warning(f"Failed to neutralize video prompt with LLM; using fallback sanitizer: {exc}")

        return self._fallback_neutralize_prompt(prompt)

    def _clean_rewritten_prompt(self, text: str) -> str:
        """Clean common LLM formatting around a rewritten prompt."""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").strip()
            if cleaned.lower().startswith(("text", "prompt", "english")):
                cleaned = cleaned.split("\n", 1)[-1].strip()
        for prefix in ("改写后的提示词：", "改写后：", "Prompt:", "Rewritten prompt:"):
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
        return cleaned.strip().strip('"').strip("'")

    def _fallback_neutralize_prompt(self, prompt: str) -> str:
        """Conservative fallback if the configured LLM is unavailable."""
        sanitized = prompt
        replacements = {
            "害怕": "平静",
            "恐惧": "沉思",
            "危险": "未知",
            "挣脱": "走向",
            "崩溃": "调整",
            "压迫": "压力",
            "攻击": "互动",
            "血": "红色",
            "死亡": "离别",
        }
        for source, target in replacements.items():
            sanitized = sanitized.replace(source, target)
        return (
            "A calm, positive, cinematic scene with gentle natural light, peaceful atmosphere, "
            "safe public setting, no violence, no danger, no sensitive content. "
            f"Original theme adapted neutrally: {sanitized}"
        )

    def _create_image_client(self):
        from pixelle_video.services.api_services.image_client import ImageClient

        cfg = config_manager.get_api_providers_config()
        return ImageClient(
            dashscope_api_key=cfg["dashscope"].get("api_key") or None,
            dashscope_base_url=cfg["dashscope"].get("base_url") or None,
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

    def _video_resolution(self, provider: str, width: Optional[int], height: Optional[int]) -> str:
        resolution = self._resolution(width, height)
        if provider == "seedance":
            return "1080p" if resolution in {"1080P", "2K", "4K"} else "720p"
        return "1080P" if resolution in {"1080P", "2K", "4K"} else "720P"

    def _video_duration(self, provider: str, model: str, duration: int) -> int:
        """Normalize requested duration to ranges accepted by common providers."""
        capabilities = self._video_capabilities(provider, model)
        duration_contract = capabilities.get("duration") or {}

        if duration_contract.get("verified"):
            if duration_contract.get("allowed_values"):
                allowed = sorted(duration_contract["allowed_values"])
                return min(allowed, key=lambda value: abs(value - duration))

            min_duration = int(duration_contract.get("min", duration))
            max_duration = int(duration_contract.get("max", duration))
            return min(max(duration, min_duration), max_duration)

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

    def _video_capabilities(self, provider: str, model: str) -> dict[str, Any]:
        """Return provider/model capability metadata backed by official docs when available."""
        default = {
            "ability_type": "image_to_video",
            "ability_types": [],
            "adapter_ability_types": ["first_frame_i2v"],
            "api_contract_verified": False,
            "source_urls": [],
            "contract_issues": ["No official API contract metadata has been added for this model."],
        }
        return deepcopy(self.VIDEO_MODEL_CAPABILITIES.get((provider, model), default))

    def _video_options(
        self,
        provider: str,
        model: str,
        params: dict[str, Any],
        resolution: str,
    ) -> dict[str, Any]:
        """Map Pixelle's generic video params to provider client options."""
        options: dict[str, Any] = {
            "resolution": resolution,
            "negative_prompt": params.get("negative_prompt"),
            "watermark": params.get("watermark"),
            "seed": params.get("seed"),
        }

        if provider == "dashscope":
            options.update(
                {
                    "last_image_path": params.get("last_image_path") or params.get("last_frame_path"),
                    "first_clip_path": params.get("first_clip_path") or params.get("first_video_path"),
                    "reference_image_path": params.get("reference_image_path"),
                    "reference_image_paths": params.get("reference_image_paths"),
                    "reference_video_paths": params.get("reference_video_paths"),
                    "reference_audio_path": params.get("reference_audio_path") or params.get("reference_voice_path"),
                    "audio": params.get("audio"),
                    "audio_path": params.get("audio_path") or params.get("driving_audio_path"),
                    "prompt_extend": params.get("prompt_extend"),
                    "shot_type": params.get("shot_type", "multi"),
                }
            )
        elif provider == "kling":
            options.update(
                {
                    "sound": params.get("sound", ""),
                    "mode": params.get("mode", "pro"),
                    "cfg_scale": params.get("cfg_scale", 0.5),
                }
            )
        elif provider == "seedance":
            options.update(
                {
                    "generate_audio": params.get("generate_audio"),
                }
            )

        return {key: value for key, value in options.items() if value is not None}
