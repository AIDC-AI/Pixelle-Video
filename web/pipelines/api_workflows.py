"""Helpers for exposing direct API media models in Streamlit pipeline UIs."""

from typing import Any

import streamlit as st
from loguru import logger

from web.i18n import get_language


def is_api_workflow(workflow_key: str | None) -> bool:
    """Return True for direct provider workflow keys such as api/dashscope/xxx."""
    return bool(workflow_key and workflow_key.startswith("api/"))


def list_api_media_workflows(
    pixelle_video: Any,
    media_type: str,
    required_adapter_abilities: list[str] | tuple[str, ...] | set[str] | None = None,
    verified_only: bool = False,
) -> list[dict]:
    """List API-backed media workflows in the same option shape used by UIs."""
    api_media = getattr(pixelle_video, "api_media", None)
    if api_media is None:
        return []

    required = set(required_adapter_abilities or [])

    try:
        workflows = []
        for workflow in api_media.list_workflows():
            if workflow.get("media_type") != media_type:
                continue

            if verified_only and not workflow.get("api_contract_verified", True):
                continue

            adapter_abilities = set(workflow.get("adapter_ability_types") or [])
            if required and not required.intersection(adapter_abilities):
                continue

            workflows.append({
                "key": workflow["key"],
                "display_name": workflow.get("display_name") or workflow["key"],
                **workflow,
            })

        return workflows
    except Exception as exc:
        logger.warning(f"Failed to list API {media_type} workflows: {exc}")
        return []


def render_api_video_controls(
    workflow: dict | None,
    key_prefix: str,
    default_duration: int = 5,
    allow_audio_driven: bool = False,
    show_duration: bool = True,
) -> dict:
    """Render common API video controls based on verified adapter capability metadata."""
    if not workflow or not is_api_workflow(workflow.get("key")):
        return {}

    zh = get_language() == "zh_CN"
    capabilities = workflow.get("capabilities") or {}
    adapter_abilities = set(workflow.get("adapter_ability_types") or [])
    params: dict[str, Any] = {}

    title = "API 视频模型参数" if zh else "API video model options"
    with st.expander(title, expanded=False):
        ability_text = ", ".join(sorted(adapter_abilities)) or ("未标注" if zh else "unknown")
        st.caption(("已接入能力：" if zh else "Adapter abilities: ") + ability_text)

        if not workflow.get("api_contract_verified", False):
            st.warning(
                "这个模型的公开 API 数据契约尚未完全确认，只会传递最基础的图生视频参数。"
                if zh
                else "This model's public API contract is not fully verified; only basic image-to-video parameters will be passed."
            )

        duration_contract = capabilities.get("duration") or {}
        min_duration = int(duration_contract.get("min", 3))
        max_duration = int(duration_contract.get("max", 15))
        if show_duration:
            default_value = min(max(int(default_duration or min_duration), min_duration), max_duration)
            params["duration"] = st.slider(
                "视频时长（秒）" if zh else "Duration (seconds)",
                min_value=min_duration,
                max_value=max_duration,
                value=default_value,
                step=1,
                key=f"{key_prefix}_api_duration",
            )
        else:
            st.caption(
                f"视频时长将自动跟随每段旁白音频长度，并限制在模型支持范围 {min_duration}-{max_duration}s。"
                if zh
                else f"Duration follows each scene's narration audio and is clamped to the model range {min_duration}-{max_duration}s."
            )

        resolutions = capabilities.get("resolutions") or []
        if resolutions:
            params["resolution"] = st.selectbox(
                "分辨率" if zh else "Resolution",
                resolutions,
                index=0,
                key=f"{key_prefix}_api_resolution",
            )

        ratios = capabilities.get("ratios") or []
        if ratios:
            default_ratio_index = ratios.index("9:16") if "9:16" in ratios else 0
            params["video_ratio"] = st.selectbox(
                "画幅比例" if zh else "Aspect ratio",
                ratios,
                index=default_ratio_index,
                key=f"{key_prefix}_api_ratio",
            )

        negative_prompt = st.text_area(
            "负向提示词（可选）" if zh else "Negative prompt (optional)",
            value="",
            height=70,
            key=f"{key_prefix}_api_negative_prompt",
        )
        if negative_prompt.strip():
            params["negative_prompt"] = negative_prompt.strip()

        if workflow.get("api_contract_verified", False):
            params["watermark"] = st.checkbox(
                "添加水印" if zh else "Add watermark",
                value=False,
                key=f"{key_prefix}_api_watermark",
            )

        if workflow.get("provider") == "seedance" and workflow.get("api_contract_verified", False):
            params["generate_audio"] = st.checkbox(
                "让模型生成原生音频" if zh else "Generate native audio",
                value=False,
                key=f"{key_prefix}_api_generate_audio",
            )

        if workflow.get("provider") == "kling" and workflow.get("api_contract_verified", False):
            params["sound"] = "on" if st.checkbox(
                "让模型生成原生音频" if zh else "Generate native audio",
                value=False,
                key=f"{key_prefix}_api_kling_sound",
            ) else "off"

        if allow_audio_driven and "audio_driven_i2v" in adapter_abilities:
            params["use_narration_audio_as_driving_audio"] = st.checkbox(
                "使用本场景旁白音频驱动画面" if zh else "Use narration audio as driving audio",
                value=False,
                help=(
                    "仅对已验证支持 driving_audio 的 API 模型生效。"
                    if zh
                    else "Only applies to verified API models that support driving_audio."
                ),
                key=f"{key_prefix}_api_audio_driven",
            )

    return {key: value for key, value in params.items() if value not in (None, "")}
