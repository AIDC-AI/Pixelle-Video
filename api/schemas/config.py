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
Config management API schemas.

Mirrors the surface of `pixelle_video.config.config_manager` and the
shape the new web-next Settings UI expects. Secrets are returned as-is so
the same operator that already saved them can view and rotate them.
"""

from typing import Optional
from pydantic import BaseModel, Field


# === LLM ===

class LLMConfig(BaseModel):
    """Current LLM configuration."""
    api_key: str = ""
    base_url: str = ""
    model: str = ""


class LLMConfigUpdate(BaseModel):
    """LLM config update — any subset of fields."""
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


class LLMTestRequest(BaseModel):
    api_key: str
    base_url: str
    model: Optional[str] = None


class LLMTestResponse(BaseModel):
    success: bool
    message: str
    model_count: int = 0


# === ComfyUI / RunningHub ===

class ComfyUIConfig(BaseModel):
    """Current ComfyUI + RunningHub configuration."""
    comfyui_url: str = "http://127.0.0.1:8188"
    comfyui_api_key: str = ""
    runninghub_api_key: str = ""
    runninghub_concurrent_limit: int = 1
    runninghub_instance_type: Optional[str] = None  # "" or "plus"


class ComfyUIConfigUpdate(BaseModel):
    """ComfyUI config update — any subset of fields."""
    comfyui_url: Optional[str] = None
    comfyui_api_key: Optional[str] = None
    runninghub_api_key: Optional[str] = None
    runninghub_concurrent_limit: Optional[int] = None
    runninghub_instance_type: Optional[str] = None


class ComfyUITestRequest(BaseModel):
    url: str


class ComfyUITestResponse(BaseModel):
    success: bool
    message: str


class RunningHubTestRequest(BaseModel):
    api_key: str
    instance_type: Optional[str] = None


class RunningHubTestResponse(BaseModel):
    success: bool
    message: str


# === Direct API media providers ===

class APIProviderConfig(BaseModel):
    """Per-provider config. Fields are all optional because not every
    provider uses every field (e.g. Kling uses access/secret keys, not api_key)."""
    api_key: str = ""
    base_url: str = ""
    access_key: str = ""
    secret_key: str = ""
    use_proxy: bool = False


class APIProvidersCommonConfig(BaseModel):
    print_model_input: bool = False
    local_proxy: str = ""


class APIProvidersConfig(BaseModel):
    common: APIProvidersCommonConfig
    openai: APIProviderConfig
    dashscope: APIProviderConfig
    ark: APIProviderConfig
    kling: APIProviderConfig


class APIProvidersCommonUpdate(BaseModel):
    print_model_input: Optional[bool] = None
    local_proxy: Optional[str] = None


# === Aggregate ===

class FullConfig(BaseModel):
    """Aggregate config returned by GET /api/config."""
    llm: LLMConfig
    comfyui: ComfyUIConfig
    api_providers: APIProvidersConfig
