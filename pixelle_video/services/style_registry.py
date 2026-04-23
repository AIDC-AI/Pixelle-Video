# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Style registry for built-in and user-defined video styles.
"""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import re
from typing import Any

import yaml

from pixelle_video.utils.os_util import get_data_path, get_root_path

_STYLE_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$")
_DEFAULT_TEMPLATE = "1080x1920/image_default.html"
_DEFAULT_LANGUAGE = "zh-CN"
_DEFAULT_STYLE_ID = "style-1000"
_DEFAULT_BGM_MIX = {
    "loop": True,
    "fade_in_seconds": 1.2,
    "fade_out_seconds": 1.2,
    "ducking_enabled": False,
    "ducking_db": 7.0,
}


class StyleRegistry:
    """Unified registry for built-in and custom styles."""

    def __init__(
        self,
        builtin_dir: str | None = None,
        custom_dir: str | None = None,
        options_path: str | None = None,
    ) -> None:
        self.builtin_dir = Path(builtin_dir or get_root_path("styles"))
        self.custom_dir = Path(custom_dir or get_data_path("styles"))
        self.options_path = Path(options_path or get_root_path("styles", "style-options.json"))
        self.default_style_id = _DEFAULT_STYLE_ID

    def list_styles(self) -> list[dict[str, Any]]:
        styles: dict[str, dict[str, Any]] = {}

        for source_dir, is_builtin in ((self.builtin_dir, True), (self.custom_dir, False)):
            for path in self._iter_style_files(source_dir):
                normalized = self._normalize_style_payload(
                    raw=self._load_yaml(path),
                    source_path=path,
                    is_builtin=is_builtin,
                )
                styles[normalized["id"]] = normalized

        return sorted(
            (deepcopy(style) for style in styles.values()),
            key=lambda item: (not item["is_builtin"], item["id"]),
        )

    def get_style(self, style_id: str | None) -> dict[str, Any] | None:
        normalized_id = self.normalize_style_id(style_id)
        if not normalized_id:
            return None

        for style in self.list_styles():
            if style["id"] == normalized_id:
                return style
        return None

    def upsert_style(self, payload: dict[str, Any], *, existing_id: str | None = None) -> dict[str, Any]:
        style_id = self.normalize_style_id(payload.get("id"))
        if not style_id:
            raise ValueError("Style id is required.")
        if existing_id and style_id != self.normalize_style_id(existing_id):
            raise ValueError("Style id in the payload must match the target style.")

        if not _STYLE_ID_RE.match(style_id):
            raise ValueError("Style id may only contain letters, numbers, hyphens, and underscores.")

        existing = self.get_style(style_id)
        if existing and existing["is_builtin"]:
            raise PermissionError("Built-in styles are read-only.")

        raw_payload = {
            "id": style_id,
            "name": payload.get("name") or style_id,
            "description": payload.get("description") or "",
            "scene": payload.get("scene") or "",
            "tone": payload.get("tone") or "",
            "analysis_creative_layer": payload.get("analysis_creative_layer") or "",
            "audio_sync_creative_layer": payload.get("audio_sync_creative_layer") or "",
            "reference_config": deepcopy(payload.get("reference_config") or {}),
            "runtime_config": deepcopy(payload.get("runtime_config") or {}),
        }

        target_path = self.custom_dir / f"{style_id}.yaml"
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(
            yaml.safe_dump(raw_payload, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        return self.get_style(style_id) or self._normalize_style_payload(raw_payload, source_path=target_path, is_builtin=False)

    def delete_style(self, style_id: str) -> bool:
        normalized_id = self.normalize_style_id(style_id)
        existing = self.get_style(normalized_id)
        if existing is None:
            return False
        if existing["is_builtin"]:
            raise PermissionError("Built-in styles cannot be deleted.")

        path = Path(existing["source_path"]).resolve(strict=False)
        custom_root = self.custom_dir.resolve(strict=False)
        if not path.is_relative_to(custom_root):
            raise PermissionError("Custom styles must live under data/styles.")
        if not path.exists():
            return False
        path.unlink()
        return True

    def normalize_style_id(self, style_id: str | None) -> str | None:
        if style_id is None:
            return None
        value = str(style_id).strip()
        if not value:
            return None
        if value.isdigit():
            return f"style-{value}"
        if value.startswith("style-"):
            return value
        return value

    def _iter_style_files(self, source_dir: Path) -> list[Path]:
        if not source_dir.exists() or not source_dir.is_dir():
            return []
        return sorted(
            path
            for path in source_dir.iterdir()
            if path.is_file() and path.suffix.lower() in {".yaml", ".yml"}
        )

    def _load_yaml(self, path: Path) -> dict[str, Any]:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if not isinstance(data, dict):
            raise ValueError(f"Style file must contain a mapping: {path}")
        return data

    def _load_style_options(self) -> dict[str, dict[str, Any]]:
        if not self.options_path.exists():
            return {}
        raw = yaml.safe_load(self.options_path.read_text(encoding="utf-8")) or []
        if not isinstance(raw, list):
            return {}
        options: dict[str, dict[str, Any]] = {}
        for item in raw:
            if not isinstance(item, dict):
                continue
            option_id = self.normalize_style_id(item.get("id") or item.get("value"))
            if option_id:
                options[option_id] = item
        return options

    def _normalize_style_payload(
        self,
        *,
        raw: dict[str, Any],
        source_path: Path,
        is_builtin: bool,
    ) -> dict[str, Any]:
        style_options = self._load_style_options()
        normalized_id = self.normalize_style_id(raw.get("id") or source_path.stem)
        if not normalized_id:
            raise ValueError(f"Could not determine style id for {source_path}")

        option_meta = style_options.get(normalized_id, {})
        legacy_config = deepcopy(raw.get("config") or {})
        reference_config = deepcopy(raw.get("reference_config") or {})
        runtime_config = deepcopy(raw.get("runtime_config") or {})

        if legacy_config:
            reference_config = {
                **legacy_config,
                **reference_config,
            }

        bgm_name = (
            runtime_config.get("bgm")
            or reference_config.get("bgm")
            or option_meta.get("bgm")
        )
        template = runtime_config.get("template") or _DEFAULT_TEMPLATE
        language = runtime_config.get("language") or self._infer_language(normalized_id, raw, option_meta)
        prompt_prefix = runtime_config.get("prompt_prefix") or self._build_prompt_prefix(
            name=raw.get("name"),
            scene=raw.get("scene") or option_meta.get("scene"),
            tone=raw.get("tone") or option_meta.get("tone"),
            language=language,
        )

        runtime_config = {
            "template": template,
            "prompt_prefix": prompt_prefix,
            "tts_binding": self._normalize_tts_binding(runtime_config.get("tts_binding")),
            "bgm": bgm_name,
            "bgm_mix": self._normalize_bgm_mix(runtime_config.get("bgm_mix")),
            "language": language,
            "narration_guidance": runtime_config.get("narration_guidance") or raw.get("description") or "",
            **{key: value for key, value in runtime_config.items() if key not in {"template", "prompt_prefix", "tts_binding", "bgm", "bgm_mix", "language", "narration_guidance"}},
        }

        reference_config = {
            **reference_config,
            "voice_id": reference_config.get("voice_id"),
            "speech_rate": reference_config.get("speech_rate"),
            "original_audio_scene_count": reference_config.get("original_audio_scene_count"),
        }

        return {
            "id": normalized_id,
            "name": raw.get("name") or option_meta.get("label") or normalized_id,
            "description": raw.get("description") or "",
            "scene": raw.get("scene") or option_meta.get("scene") or "",
            "tone": raw.get("tone") or option_meta.get("tone") or "",
            "is_builtin": is_builtin,
            "analysis_creative_layer": raw.get("analysis_creative_layer") or "",
            "audio_sync_creative_layer": raw.get("audio_sync_creative_layer") or "",
            "reference_config": reference_config,
            "runtime_config": runtime_config,
            "source_path": str(source_path),
        }

    def _build_prompt_prefix(
        self,
        *,
        name: Any,
        scene: Any,
        tone: Any,
        language: str,
    ) -> str:
        scene_text = str(scene or "").strip()
        tone_text = str(tone or "").strip()
        name_text = str(name or "").strip()
        if language == "en-US":
            parts = [f"style={name_text}" if name_text else "", f"scene={scene_text}" if scene_text else "", f"tone={tone_text}" if tone_text else ""]
            compact = ", ".join(part for part in parts if part)
            return compact or "cinematic visual storytelling"
        parts = [name_text, scene_text, tone_text]
        compact = "，".join(part for part in parts if part)
        return compact or "电影感镜头，统一视觉语言，强叙事表达"

    def _infer_language(self, style_id: str, raw: dict[str, Any], option_meta: dict[str, Any]) -> str:
        for candidate in (
            raw.get("language"),
            raw.get("config", {}).get("language") if isinstance(raw.get("config"), dict) else None,
            option_meta.get("label"),
            raw.get("name"),
        ):
            text = str(candidate or "").lower()
            if "english" in text or "en-us" in text or style_id == "style-1020":
                return "en-US"
        return _DEFAULT_LANGUAGE

    def _normalize_tts_binding(self, binding: Any) -> dict[str, Any] | None:
        if not isinstance(binding, dict):
            return None
        binding_type = str(binding.get("type") or "").strip()
        binding_value = str(binding.get("value") or "").strip()
        if binding_type not in {"workflow", "edge_voice"} or not binding_value:
            return None
        return {"type": binding_type, "value": binding_value}

    def _normalize_bgm_mix(self, bgm_mix: Any) -> dict[str, Any]:
        if not isinstance(bgm_mix, dict):
            return deepcopy(_DEFAULT_BGM_MIX)
        merged = deepcopy(_DEFAULT_BGM_MIX)
        merged.update({key: value for key, value in bgm_mix.items() if value is not None})
        return merged
