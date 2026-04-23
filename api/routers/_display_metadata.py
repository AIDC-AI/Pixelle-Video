from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from pixelle_video.utils.os_util import get_data_path, get_root_path

_DISPLAY_METADATA_PATHS = (
    Path(get_root_path("resources", "display-metadata.json")),
    Path(get_data_path("resources", "display-metadata.json")),
)
_STYLE_OPTIONS_PATH = Path(get_root_path("styles", "style-options.json"))
_TOKEN_MAP = {
    "af": "动作迁移",
    "banana": "Banana",
    "cartoon": "卡通",
    "chinese": "中文",
    "cloud": "云端",
    "combination": "组合",
    "customize": "自定义",
    "default": "默认",
    "digital": "数字人",
    "edge": "Edge",
    "flux": "Flux",
    "fusionx": "FusionX",
    "image": "画面",
    "index2": "IndexTTS 2",
    "ltx2": "LTX 2",
    "motion": "动态",
    "nano": "Nano",
    "pose": "姿态",
    "qwen": "Qwen",
    "scail": "Scail",
    "sd3.5": "SD 3.5",
    "sdxl": "SDXL",
    "selfhost": "本地",
    "spark": "Spark",
    "tts": "配音",
    "understanding": "理解",
    "video": "视频",
    "wan2.1": "Wan 2.1",
    "wan2.2": "Wan 2.2",
    "z": "Z",
}
_PIPELINE_LABELS_ZH = {
    "action-transfer": "动作迁移",
    "custom": "自定义资产",
    "digital-human": "数字人",
    "i2v": "图片转视频",
    "quick": "快速创作",
    "standard": "快速创作",
}
_SCRIPT_TYPE_LABELS_ZH = {
    "narration": "旁白草稿",
    "prompt": "提示词草稿",
    "script": "完整脚本",
}
_WORKFLOW_CATEGORY_LABELS_ZH = {
    "analysis": "分析方案",
    "image": "图像处理",
    "media": "画面方案",
    "tts": "配音方案",
    "video": "视频方案",
    "workflow": "生成方案",
}


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


@lru_cache(maxsize=1)
def load_display_metadata() -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for path in _DISPLAY_METADATA_PATHS:
        if not path.exists():
            continue
        loaded = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            payload = _deep_merge(payload, loaded)
    return payload


@lru_cache(maxsize=1)
def load_style_options() -> dict[str, dict[str, Any]]:
    if not _STYLE_OPTIONS_PATH.exists():
        return {}

    loaded = json.loads(_STYLE_OPTIONS_PATH.read_text(encoding="utf-8"))
    if not isinstance(loaded, list):
        return {}

    options: dict[str, dict[str, Any]] = {}
    for item in loaded:
        if not isinstance(item, dict):
            continue
        raw_id = item.get("id") or item.get("value")
        if raw_id is None:
            continue
        style_id = normalize_style_id(str(raw_id))
        options[style_id] = item
    return options


def normalize_style_id(style_id: str | None) -> str | None:
    if style_id is None:
        return None
    value = str(style_id).strip()
    if not value:
        return None
    if value.isdigit():
        return f"style-{value}"
    return value


def _clean_style_label(label: str | None, normalized_id: str | None) -> str | None:
    if not label:
        return None

    cleaned = str(label).strip()
    if not cleaned:
        return None

    if normalized_id:
        numeric_id = normalized_id.removeprefix("style-")
        patterns = (
            rf"^style[-_ ]*{re.escape(numeric_id)}\s+",
            rf"^{re.escape(numeric_id)}\s+",
        )
        for pattern in patterns:
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    return cleaned.strip() or None


def _source_label_zh(source: str | None) -> str:
    if source in {"builtin", "default"}:
        return "内建资源"
    if source in {"history", "custom"}:
        return "我的资源"
    if source == "runninghub":
        return "RunningHub"
    if source == "selfhost":
        return "本地"
    return str(source or "未知来源")


def _workflow_category(name: str) -> str:
    lowered = name.lower()
    if lowered.startswith("tts_"):
        return "tts"
    if lowered.startswith("image_"):
        return "image"
    if lowered.startswith("video_") or lowered.startswith("i2v_") or lowered.startswith("af_"):
        return "media"
    if lowered.startswith("analyse_"):
        return "analysis"
    return "workflow"


def _workflow_suffix(category: str) -> str:
    return {
        "analysis": "分析方案",
        "image": "画面方案",
        "media": "画面方案",
        "tts": "配音方案",
        "video": "视频方案",
        "workflow": "生成方案",
    }.get(category, "生成方案")


def _humanize_tokens(raw: str) -> str:
    normalized = raw.replace(".json", "").replace("-", "_")
    normalized = re.sub(r"([a-z])([A-Z])", r"\1_\2", normalized)
    tokens = [token for token in normalized.split("_") if token]
    pretty_tokens = [_TOKEN_MAP.get(token.lower(), token.upper() if token.isupper() else token.title()) for token in tokens]
    return " ".join(pretty_tokens).strip()


def _workflow_fallback_name_zh(name: str) -> str:
    stem = Path(name).stem
    category = _workflow_category(name)

    if stem.startswith("tts_"):
        base = stem[len("tts_"):]
    elif stem.startswith("image_"):
        base = stem[len("image_"):]
    elif stem.startswith("video_"):
        base = stem[len("video_"):]
    elif stem.startswith("analyse_"):
        base = stem[len("analyse_"):]
    else:
        base = stem

    humanized = _humanize_tokens(base)
    suffix = _workflow_suffix(category)
    if not humanized:
        return suffix
    return f"{humanized} {suffix}"


def _workflow_fallback_description_zh(name: str, source: str | None) -> str:
    category = _workflow_category(name)
    source_label = _source_label_zh(source)
    if category == "tts":
        return f"用于生成旁白与配音，当前运行来源为{source_label}。"
    if category == "image":
        return f"用于生成单张画面或封面图，当前运行来源为{source_label}。"
    if category == "media":
        return f"用于生成画面或短视频镜头，当前运行来源为{source_label}。"
    if category == "analysis":
        return f"用于理解或分析输入素材，当前运行来源为{source_label}。"
    return f"用于 Pixelle 的生成流程，当前运行来源为{source_label}。"


def enrich_workflow_display(workflow: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(workflow)
    metadata = load_display_metadata().get("workflow_defaults", {})
    option = metadata.get(workflow.get("key")) or metadata.get(workflow.get("name")) or {}
    category = option.get("display_category") or _workflow_category(str(workflow.get("name", "")))
    fallback_name = _workflow_fallback_name_zh(str(workflow.get("name", "")))

    enriched.update(
        {
            "display_name_zh": option.get("display_name_zh") or fallback_name,
            "description_zh": option.get("description_zh") or _workflow_fallback_description_zh(
                str(workflow.get("name", "")),
                workflow.get("source"),
            ),
            "display_category": category,
            "display_category_zh": option.get("display_category_zh") or _WORKFLOW_CATEGORY_LABELS_ZH.get(category, "生成方案"),
            "display_tags": option.get("display_tags") or [source_label_zh(workflow.get("source")), _WORKFLOW_CATEGORY_LABELS_ZH.get(category, "生成方案")],
            "technical_name": workflow.get("name"),
            "technical_path": workflow.get("path"),
        }
    )
    return enriched


def style_display_metadata(style_id: str | None, style_name: str | None, description: str | None, scene: str | None, tone: str | None) -> dict[str, str | None]:
    normalized_id = normalize_style_id(style_id)
    option = load_style_options().get(normalized_id or "", {})
    display_name = _clean_style_label(option.get("label"), normalized_id) or style_name or normalized_id
    short_description = description or " · ".join(part for part in [scene or option.get("scene"), tone or option.get("tone")] if part) or None
    return {
        "display_name_zh": display_name,
        "short_description_zh": short_description,
    }


def source_label_zh(source: str | None) -> str:
    return _source_label_zh(source)


def bgm_display_metadata(
    *,
    name: str | None,
    source: str | None,
    linked_style_id: str | None = None,
    linked_style_name: str | None = None,
) -> dict[str, str | None]:
    style_meta = style_display_metadata(linked_style_id, linked_style_name, None, None, None)
    style_name = style_meta.get("display_name_zh")
    technical_name = name or None
    source_label = source_label_zh(source)

    if style_name:
        return {
            "display_name_zh": f"{style_name} 默认背景音乐",
            "description_zh": f"跟随“{style_name}”风格一起使用的默认曲目。",
            "source_label": source_label,
            "linked_style_display_name_zh": style_name,
            "technical_name": technical_name,
        }

    if source in {"history", "custom"}:
        return {
            "display_name_zh": "个人背景音乐",
            "description_zh": "来自你的资源库，可在创建流程里直接复用。",
            "source_label": source_label,
            "linked_style_display_name_zh": None,
            "technical_name": technical_name,
        }

    return {
        "display_name_zh": "内建背景音乐",
        "description_zh": "系统内置的背景音乐，可直接用于快速创作。",
        "source_label": source_label,
        "linked_style_display_name_zh": None,
        "technical_name": technical_name,
    }


def pipeline_label_zh(pipeline: str | None) -> str | None:
    if not pipeline:
        return None
    return _PIPELINE_LABELS_ZH.get(str(pipeline), str(pipeline))


def script_display_metadata(script_type: str | None, pipeline: str | None = None) -> dict[str, str | None]:
    normalized_type = str(script_type or "script")
    type_label = _SCRIPT_TYPE_LABELS_ZH.get(normalized_type, "内容草稿")
    pipeline_label = pipeline_label_zh(pipeline)
    summary = f"{type_label} · {pipeline_label}" if pipeline_label else type_label
    return {
        "type_label_zh": type_label,
        "pipeline_label_zh": pipeline_label,
        "summary_zh": summary,
    }
