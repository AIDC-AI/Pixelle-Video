"""Helpers for exposing direct API media models in Streamlit pipeline UIs."""

import os
from typing import Any

import streamlit as st
from loguru import logger

from web.i18n import get_language


def is_api_workflow(workflow_key: str | None) -> bool:
    """Return True for direct provider workflow keys such as api/dashscope/xxx."""
    return bool(workflow_key and workflow_key.startswith("api/"))


def is_source_workflow(workflow: dict, source: str) -> bool:
    """Return True when a workflow belongs to a concrete source namespace."""
    key = workflow.get("key") or workflow.get("path") or ""
    return key.startswith(f"{source}/") or workflow.get("source") == source


def workflow_source_label(source: str) -> str:
    """Human-facing label for workflow source selectors."""
    zh = get_language() == "zh_CN"
    labels = {
        "selfhost": "本地 ComfyUI" if zh else "Local ComfyUI",
        "runninghub": "RunningHub",
        "api": "API 模型" if zh else "API models",
    }
    return labels.get(source, source)


def workflow_source_help(subject: str | None = None) -> str:
    """Common help text for workflow/model source selectors."""
    zh = get_language() == "zh_CN"
    subject_text = subject or ("当前步骤" if zh else "this step")
    if zh:
        return (
            f"选择{subject_text}使用的模型服务来源："
            "RunningHub 使用云端工作流；本地 ComfyUI 使用 selfhost 工作流；"
            "API 调用直接请求模型供应商。选择后，下方列表只显示该来源下可用的工作流或模型。"
        )
    return (
        f"Choose the model service source for {subject_text}: "
        "RunningHub uses cloud workflows; Local ComfyUI uses selfhost workflows; "
        "API call directly requests model providers. The list below only shows workflows or models from the selected source."
    )


def workflow_select_help() -> str:
    """Common help text for workflow/model select boxes."""
    if get_language() == "zh_CN":
        return "这里只显示上方所选模型服务来源下可用的工作流或模型。"
    return "Only workflows or models from the selected model service source are shown here."


def list_local_media_workflows(
    pixelle_video: Any,
    media_type: str,
    source: str,
    key_contains: str | None = None,
    key_prefix: str | None = None,
) -> list[dict]:
    """List non-API media workflows by source without mixing provider models."""
    try:
        workflows = []
        seen_keys = set()
        for workflow in pixelle_video.media.list_workflows():
            key = workflow.get("key") or workflow.get("path") or ""
            if not key or key.startswith("api/"):
                continue
            if not is_source_workflow(workflow, source):
                continue
            if key_contains and key_contains.lower() not in key.lower():
                continue
            if key_prefix:
                fname = os.path.basename(key)
                if not fname.startswith(key_prefix):
                    continue
            workflow_media_type = workflow.get("media_type")
            if media_type == "video":
                if workflow_media_type and workflow_media_type != "video":
                    continue
                if not workflow_media_type and "video_" not in key.lower() and not (key_prefix and os.path.basename(key).startswith(key_prefix)):
                    continue
            elif workflow_media_type and workflow_media_type != media_type:
                continue
            elif media_type == "image" and "video_" in key.lower():
                continue
            seen_keys.add(key)
            workflows.append({
                "key": key,
                "display_name": workflow.get("display_name") or key,
                **workflow,
            })

        if key_prefix:
            try:
                from pixelle_video.utils.os_util import get_resource_path, list_resource_files

                for filename in list_resource_files("workflows", source):
                    if not filename.startswith(key_prefix) or not filename.endswith(".json"):
                        continue
                    key = f"{source}/{filename}"
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)
                    workflows.append({
                        "key": key,
                        "name": filename,
                        "display_name": f"{filename} - {source.title()}",
                        "source": source,
                        "path": get_resource_path("workflows", source, filename),
                        "media_type": media_type,
                    })
            except Exception as exc:
                logger.warning(f"Failed to list {source}/{key_prefix} workflows from files: {exc}")
        return workflows
    except Exception as exc:
        logger.warning(f"Failed to list {source} {media_type} workflows: {exc}")
        return []


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
    default_ratio: str | None = None,
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
        allowed_durations = sorted(duration_contract.get("allowed_values") or [])
        min_duration = int(duration_contract.get("min", 3))
        max_duration = int(duration_contract.get("max", 15))
        if show_duration:
            if allowed_durations:
                requested_duration = int(default_duration or allowed_durations[0])
                default_value = min(
                    allowed_durations,
                    key=lambda value: abs(value - requested_duration),
                )
                params["duration"] = st.selectbox(
                    "视频时长（秒）" if zh else "Duration (seconds)",
                    allowed_durations,
                    index=allowed_durations.index(default_value),
                    key=f"{key_prefix}_api_duration",
                )
            else:
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
            duration_description = (
                "/".join(str(value) for value in allowed_durations)
                if allowed_durations
                else f"{min_duration}-{max_duration}"
            )
            st.caption(
                f"视频时长将自动跟随每段旁白音频长度，并限制为模型支持的 {duration_description}s。"
                if zh
                else f"Duration follows each scene's narration audio and is clamped to the model-supported {duration_description}s."
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
            preferred_ratio = default_ratio or "9:16"
            default_ratio_index = ratios.index(preferred_ratio) if preferred_ratio in ratios else 0
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

        if workflow.get("provider") in {"seedance", "ssycloud"} and workflow.get("api_contract_verified", False):
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
