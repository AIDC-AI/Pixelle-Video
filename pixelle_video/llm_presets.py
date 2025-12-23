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
LLM Presets - Predefined configurations for popular LLM providers

All providers support OpenAI SDK protocol.
"""

from typing import Dict, Any, List


LLM_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "Qwen",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-max",
        "api_key_url": "https://bailian.console.aliyun.com/?tab=model#/api-key",
        # Connection test and model discovery fields
        "supports_connection_test": True,
        "models_url": "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
        "models_response_path": "data",
        "model_id_field": "id",
        "requires_api_key": True,
    },
    {
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o",
        "api_key_url": "https://platform.openai.com/api-keys",
        # Connection test and model discovery fields
        "supports_connection_test": True,
        "models_url": "https://api.openai.com/v1/models",
        "models_response_path": "data",
        "model_id_field": "id",
        "requires_api_key": True,
    },
    {
        "name": "Claude",
        "base_url": "https://api.anthropic.com/v1/",
        "model": "claude-sonnet-4-5",
        "api_key_url": "https://console.anthropic.com/settings/keys",
        # Claude uses Anthropic's native API which is not OpenAI-compatible
        # Connection test and model discovery are NOT supported
        "supports_connection_test": False,
        "requires_api_key": True,
    },
    {
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com",
        "model": "deepseek-chat",
        "api_key_url": "https://platform.deepseek.com/api_keys",
        # Connection test and model discovery fields
        "supports_connection_test": True,
        "models_url": "https://api.deepseek.com/models",
        "models_response_path": "data",
        "model_id_field": "id",
        "requires_api_key": True,
    },
    {
        "name": "Ollama",
        "base_url": "http://localhost:11434/v1",
        "model": "llama3.2",
        "api_key_url": "https://ollama.com/download",
        # Ollama uses native API for model listing (not OpenAI-compatible endpoint)
        "supports_connection_test": True,
        "models_url": "http://localhost:11434/api/tags",
        "models_response_path": "models",
        "model_id_field": "name",
        "requires_api_key": False,  # Ollama doesn't need API key
    },
    {
        "name": "Moonshot",
        "base_url": "https://api.moonshot.cn/v1",
        "model": "moonshot-v1-8k",
        "api_key_url": "https://platform.moonshot.cn/console/api-keys",
        # Connection test and model discovery fields
        "supports_connection_test": True,
        "models_url": "https://api.moonshot.cn/v1/models",
        "models_response_path": "data",
        "model_id_field": "id",
        "requires_api_key": True,
    },
]


def get_preset_names() -> List[str]:
    """Get list of preset names"""
    return [preset["name"] for preset in LLM_PRESETS]


def get_preset(name: str) -> Dict[str, Any]:
    """Get preset configuration by name"""
    for preset in LLM_PRESETS:
        if preset["name"] == name:
            return preset
    return {}


def find_preset_by_base_url_and_model(base_url: str, model: str) -> str | None:
    """
    Find preset name by base_url and model

    Returns:
        Preset name if found, None otherwise
    """
    for preset in LLM_PRESETS:
        if preset["base_url"] == base_url and preset["model"] == model:
            return preset["name"]
    return None


def get_models_config(preset_name: str) -> Dict[str, Any]:
    """
    Get model listing endpoint configuration for a preset.

    Args:
        preset_name: Name of the LLM preset

    Returns:
        Dict with keys: models_url, models_response_path, model_id_field
        Falls back to standard OpenAI format for unknown presets
    """
    preset = get_preset(preset_name)
    if preset and preset.get("supports_connection_test"):
        return {
            "models_url": preset.get("models_url"),
            "models_response_path": preset.get("models_response_path", "data"),
            "model_id_field": preset.get("model_id_field", "id"),
        }
    # Default OpenAI-compatible format for unknown presets
    return {
        "models_url": None,
        "models_response_path": "data",
        "model_id_field": "id",
    }


def supports_connection_test(preset_name: str) -> bool:
    """
    Check if a preset supports connection testing.

    Args:
        preset_name: Name of the LLM preset

    Returns:
        True if connection test is supported, False otherwise
    """
    preset = get_preset(preset_name)
    return preset.get("supports_connection_test", False) if preset else False


def requires_api_key(preset_name: str) -> bool:
    """
    Check if a preset requires an API key.

    Args:
        preset_name: Name of the LLM preset

    Returns:
        True if API key is required, False otherwise (e.g., Ollama)
    """
    preset = get_preset(preset_name)
    # Default to True if not specified (most providers need API key)
    return preset.get("requires_api_key", True) if preset else True

