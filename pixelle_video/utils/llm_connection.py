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
LLM Connection Test and Model Discovery Utilities

This module provides functions for testing LLM API connections and
discovering available models from OpenAI-compatible providers.
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple

import requests
from loguru import logger

from pixelle_video.llm_presets import get_models_config, get_preset


@dataclass
class ConnectionTestResult:
    """Result of a connection test."""

    success: bool
    message: str
    models: List[str] = None  # Populated on success if models were fetched

    def __post_init__(self):
        if self.models is None:
            self.models = []


def determine_provider_type(base_url: str, preset_name: str | None = None) -> str:
    """
    Determine the provider type based on base_url or preset name.

    Args:
        base_url: The API base URL
        preset_name: Optional preset name for direct lookup

    Returns:
        Provider type string (e.g., "openai", "ollama", "custom")
    """
    if preset_name:
        preset = get_preset(preset_name)
        if preset:
            return preset_name.lower()

    # Detect based on URL patterns
    base_url_lower = base_url.lower()
    if "ollama" in base_url_lower or "localhost:11434" in base_url_lower:
        return "ollama"
    if "openai.com" in base_url_lower:
        return "openai"
    if "dashscope.aliyuncs.com" in base_url_lower:
        return "qwen"
    if "deepseek.com" in base_url_lower:
        return "deepseek"
    if "moonshot.cn" in base_url_lower:
        return "moonshot"
    if "anthropic.com" in base_url_lower:
        return "claude"

    return "custom"


def _build_models_url(base_url: str, preset_name: str | None = None) -> Tuple[str, str, str]:
    """
    Build the models endpoint URL and response parsing config.

    Args:
        base_url: The API base URL
        preset_name: Optional preset name for config lookup

    Returns:
        Tuple of (models_url, response_path, id_field)
    """
    if preset_name:
        config = get_models_config(preset_name)
        if config.get("models_url"):
            return (
                config["models_url"],
                config["models_response_path"],
                config["model_id_field"],
            )

    # Fall back to URL-based detection
    provider_type = determine_provider_type(base_url, preset_name)

    if provider_type == "ollama":
        # Ollama has a special endpoint for model listing
        # Extract host from base_url
        if "localhost:11434" in base_url or "127.0.0.1:11434" in base_url:
            host = base_url.split("/v1")[0] if "/v1" in base_url else base_url.rstrip("/")
            return f"{host}/api/tags", "models", "name"

    # Default: OpenAI-compatible /models endpoint
    # Remove trailing /v1 if present, then add /v1/models
    clean_url = base_url.rstrip("/")
    if clean_url.endswith("/v1"):
        models_url = f"{clean_url}/models"
    else:
        models_url = f"{clean_url}/v1/models"

    return models_url, "data", "id"


def test_connection(
    api_key: str,
    base_url: str,
    preset_name: str | None = None,
    timeout: int = 5,
) -> ConnectionTestResult:
    """
    Test connection to an LLM API and fetch available models.

    Args:
        api_key: The API key for authentication
        base_url: The API base URL
        preset_name: Optional preset name for endpoint config
        timeout: Request timeout in seconds (default: 5)

    Returns:
        ConnectionTestResult with success status, message, and model list
    """
    models_url, response_path, id_field = _build_models_url(base_url, preset_name)

    headers = {}

    # Determine if API key is required
    provider_type = determine_provider_type(base_url, preset_name)
    needs_api_key = provider_type != "ollama"

    if needs_api_key:
        if not api_key:
            return ConnectionTestResult(
                success=False,
                message="API key is required for this provider",
            )
        headers["Authorization"] = f"Bearer {api_key}"

    logger.debug(f"Testing LLM connection: {models_url}")

    try:
        response = requests.get(models_url, headers=headers, timeout=timeout)

        if response.status_code == 401:
            return ConnectionTestResult(
                success=False,
                message="Authentication failed: Invalid API key",
            )

        if response.status_code == 403:
            return ConnectionTestResult(
                success=False,
                message="Access denied: Check API key permissions",
            )

        if response.status_code != 200:
            return ConnectionTestResult(
                success=False,
                message=f"Request failed with status {response.status_code}",
            )

        # Parse models from response
        models = _parse_models_response(response.json(), response_path, id_field, provider_type)

        if not models:
            return ConnectionTestResult(
                success=True,
                message="Connection successful, but no models found",
                models=[],
            )

        return ConnectionTestResult(
            success=True,
            message=f"Connection successful! Found {len(models)} models",
            models=models,
        )

    except requests.exceptions.Timeout:
        return ConnectionTestResult(
            success=False,
            message=f"Connection timed out after {timeout} seconds",
        )
    except requests.exceptions.ConnectionError as e:
        # Provide more helpful message for Ollama
        if provider_type == "ollama":
            return ConnectionTestResult(
                success=False,
                message="Cannot connect to Ollama. Is the server running?",
            )
        return ConnectionTestResult(
            success=False,
            message=f"Connection error: {str(e)}",
        )
    except requests.exceptions.RequestException as e:
        return ConnectionTestResult(
            success=False,
            message=f"Request failed: {str(e)}",
        )
    except Exception as e:
        logger.exception("Unexpected error during connection test")
        return ConnectionTestResult(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


def _parse_models_response(
    data: dict,
    response_path: str,
    id_field: str,
    provider_type: str,
) -> List[str]:
    """
    Parse the models list from API response.

    Args:
        data: The JSON response data
        response_path: The path to the models list (e.g., "data" or "models")
        id_field: The field containing model ID (e.g., "id" or "name")
        provider_type: The provider type for filtering logic

    Returns:
        List of model names/IDs
    """
    models_list = data.get(response_path, [])
    if not isinstance(models_list, list):
        return []

    models = []
    for model in models_list:
        if isinstance(model, dict):
            model_id = model.get(id_field)
            if model_id:
                models.append(model_id)
        elif isinstance(model, str):
            models.append(model)

    # Filter models based on provider type
    models = _filter_chat_models(models, provider_type)

    # Sort models for consistent display
    models.sort()

    return models


def _filter_chat_models(models: List[str], provider_type: str) -> List[str]:
    """
    Filter models to show only chat-capable models where possible.

    Args:
        models: List of all model IDs
        provider_type: The provider type

    Returns:
        Filtered list of chat-capable models
    """
    if provider_type == "openai":
        # Filter to models that support chat completions
        # Exclude embedding, whisper, dall-e, and other non-chat models
        chat_patterns = ["gpt-", "o1-", "o3-", "chatgpt-"]
        exclude_patterns = ["embedding", "whisper", "dall-e", "tts", "davinci", "babbage"]

        filtered = []
        for model in models:
            model_lower = model.lower()
            if any(p in model_lower for p in chat_patterns):
                if not any(e in model_lower for e in exclude_patterns):
                    filtered.append(model)
        return filtered if filtered else models

    # For other providers, return all models
    # Ollama models are all chat-capable
    # Other providers may have different model types
    return models


def fetch_models(
    api_key: str,
    base_url: str,
    preset_name: str | None = None,
    timeout: int = 5,
) -> Tuple[List[str], Optional[str]]:
    """
    Fetch available models from an LLM provider.

    This is a convenience function that wraps test_connection for
    cases where you only need the model list.

    Args:
        api_key: The API key for authentication
        base_url: The API base URL
        preset_name: Optional preset name for endpoint config
        timeout: Request timeout in seconds (default: 5)

    Returns:
        Tuple of (models_list, error_message)
        On success: (["model1", "model2", ...], None)
        On failure: ([], "error message")
    """
    result = test_connection(api_key, base_url, preset_name, timeout)
    if result.success:
        return result.models, None
    return [], result.message
