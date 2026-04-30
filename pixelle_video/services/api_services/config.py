"""Compatibility config for migrated API provider clients.

This module keeps the old ``Config.X`` access pattern used by the copied
clients, while sourcing values from Pixelle's config manager first and
environment variables as a fallback.
"""

import os
from typing import Any


def _provider_config(provider: str) -> dict:
    try:
        from pixelle_video.config import config_manager

        config = config_manager.config.to_dict()
        return config.get("api_providers", {}).get(provider, {}) or {}
    except Exception:
        return {}


class _ConfigMeta(type):
    def __getattr__(cls, name: str) -> Any:
        mapping = {
            "PRINT_MODEL_INPUT": ("common", "print_model_input", False),
            "LOCAL_PROXY": ("common", "local_proxy", ""),
            "OPENAI_API_KEY": ("openai", "api_key", ""),
            "OPENAI_BASE_URL": ("openai", "base_url", ""),
            "DASHSCOPE_API_KEY": ("dashscope", "api_key", ""),
            "DASHSCOPE_BASE_URL": ("dashscope", "base_url", ""),
            "DEEPSEEK_API_KEY": ("deepseek", "api_key", ""),
            "DEEPSEEK_BASE_URL": ("deepseek", "base_url", ""),
            "GEMINI_API_KEY": ("gemini", "api_key", ""),
            "GOOGLE_GEMINI_BASE_URL": ("gemini", "base_url", ""),
            "ARK_API_KEY": ("ark", "api_key", ""),
            "ARK_BASE_URL": ("ark", "base_url", ""),
            "KLING_BASE_URL": ("kling", "base_url", ""),
            "KLING_ACCESS_KEY": ("kling", "access_key", ""),
            "KLING_SECRET_KEY": ("kling", "secret_key", ""),
        }

        if name not in mapping:
            raise AttributeError(name)

        provider, key, default = mapping[name]
        value = _provider_config(provider).get(key, default)
        env_value = os.getenv(name)
        if env_value is not None and env_value != "":
            return env_value
        return value


class Config(metaclass=_ConfigMeta):
    """Old-style config facade for migrated provider clients."""
