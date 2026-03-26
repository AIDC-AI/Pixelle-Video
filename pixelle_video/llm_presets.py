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
    },
    {
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o",
        "api_key_url": "https://platform.openai.com/api-keys",
    },
    {
        "name": "Claude",
        "base_url": "https://api.anthropic.com/v1/",
        "model": "claude-sonnet-4-5",
        "api_key_url": "https://console.anthropic.com/settings/keys",
    },
    {
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com",
        "model": "deepseek-chat",
        "api_key_url": "https://platform.deepseek.com/api_keys",
    },
    {
        "name": "Ollama",
        "base_url": "http://localhost:11434/v1",
        "model": "llama3.2",
        "api_key_url": "https://ollama.com/download",
        "default_api_key": "ollama",  # Required by OpenAI SDK but ignored by Ollama
    },
    {
        "name": "MiniMax",
        "base_url": "https://api.minimax.io/v1",
        "model": "MiniMax-M2.7",
        "api_key_url": "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    },
    {
        "name": "Moonshot",
        "base_url": "https://api.moonshot.cn/v1",
        "model": "moonshot-v1-8k",
        "api_key_url": "https://platform.moonshot.cn/console/api-keys",
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

