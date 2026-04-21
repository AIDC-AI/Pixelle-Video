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
Configuration loader - Pure YAML

Handles loading and saving configuration from/to YAML files.
"""

from __future__ import annotations

import base64
import os
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]
from loguru import logger

_CONFIG_LOCK = threading.RLock()
_ENC_PREFIX = "ENC::"
_SENSITIVE_FIELD_PATHS = (
    ("llm", "api_key"),
    ("comfyui", "comfyui_api_key"),
    ("comfyui", "runninghub_api_key"),
)


def _get_nested(config: dict[str, Any], path: tuple[str, ...]) -> Any:
    current: Any = config
    for key in path:
        if not isinstance(current, dict) or key not in current:
            return None
        current = current[key]
    return current


def _set_nested(config: dict[str, Any], path: tuple[str, ...], value: Any) -> None:
    current: dict[str, Any] = config
    for key in path[:-1]:
        next_value = current.get(key)
        if not isinstance(next_value, dict):
            next_value = {}
            current[key] = next_value
        current = next_value
    current[path[-1]] = value


def _encode_secret(value: Any) -> Any:
    if not isinstance(value, str) or not value:
        return value
    return f"{_ENC_PREFIX}{base64.b64encode(value.encode('utf-8')).decode('utf-8')}"


def _decode_secret(value: Any) -> Any:
    if not isinstance(value, str) or not value.startswith(_ENC_PREFIX):
        return value
    payload = value[len(_ENC_PREFIX) :]
    try:
        return base64.b64decode(payload.encode("utf-8")).decode("utf-8")
    except Exception:  # pragma: no cover - corrupt encoded config should fail soft
        logger.warning("Failed to decode masked config secret; returning raw stored value")
        return value


def _encode_sensitive_fields(config: dict[str, Any]) -> dict[str, Any]:
    encoded = deepcopy(config)
    for field_path in _SENSITIVE_FIELD_PATHS:
        current_value = _get_nested(encoded, field_path)
        if current_value:
            _set_nested(encoded, field_path, _encode_secret(current_value))
    return encoded


def _decode_sensitive_fields(config: dict[str, Any]) -> dict[str, Any]:
    decoded = deepcopy(config)
    for field_path in _SENSITIVE_FIELD_PATHS:
        current_value = _get_nested(decoded, field_path)
        if current_value is not None:
            _set_nested(decoded, field_path, _decode_secret(current_value))
    return decoded


def load_config_dict(config_path: str = "config.yaml") -> dict:
    """
    Load configuration from YAML file
    
    Args:
        config_path: Path to config file
        
    Returns:
        Configuration dictionary
    """
    config_file = Path(config_path)
    
    if not config_file.exists():
        logger.warning(f"Config file not found: {config_path}")
        logger.info("Using default configuration")
        return {}
    
    try:
        with _CONFIG_LOCK:
            with open(config_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
        logger.info(f"Configuration loaded from {config_path}")
        return _decode_sensitive_fields(data)
    except Exception as e:
        logger.error(f"Failed to load config: {e}")
        return {}


def save_config_dict(config: dict, config_path: str = "config.yaml"):
    """
    Save configuration to YAML file
    
    Args:
        config: Configuration dictionary
        config_path: Path to config file
    """
    config_file = Path(config_path)
    config_file.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = config_file.with_name(
        f"{config_file.name}.{os.getpid()}.{threading.get_ident()}.tmp"
    )
    payload = _encode_sensitive_fields(config)

    try:
        with _CONFIG_LOCK:
            with open(tmp_path, 'w', encoding='utf-8') as f:
                yaml.safe_dump(
                    payload,
                    f,
                    allow_unicode=True,
                    default_flow_style=False,
                    sort_keys=False,
                )
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, config_file)
        logger.info(f"Configuration saved to {config_path}")
    except Exception as e:
        logger.error(f"Failed to save config: {e}")
        raise
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def mask_sensitive_config(config: dict[str, Any]) -> dict[str, Any]:
    masked = deepcopy(config)
    for field_path in _SENSITIVE_FIELD_PATHS:
        current_value = _get_nested(masked, field_path)
        if not isinstance(current_value, str) or not current_value:
            continue
        visible_tail = current_value[-4:] if len(current_value) >= 4 else current_value
        prefix = current_value[:3] if len(current_value) >= 3 else ""
        _set_nested(masked, field_path, f"{prefix}****{visible_tail}")
    return masked


def sensitive_field_paths() -> tuple[tuple[str, ...], ...]:
    return _SENSITIVE_FIELD_PATHS
