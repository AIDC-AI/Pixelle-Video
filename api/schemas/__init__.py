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
API Schemas (Pydantic models)
"""

from api.schemas.base import BaseResponse, ErrorResponse
from api.schemas.llm import LLMChatRequest, LLMChatResponse
from api.schemas.tts import TTSSynthesizeRequest, TTSSynthesizeResponse
from api.schemas.image import ImageGenerateRequest, ImageGenerateResponse
from api.schemas.content import (
    NarrationGenerateRequest,
    NarrationGenerateResponse,
    ImagePromptGenerateRequest,
    ImagePromptGenerateResponse,
    TitleGenerateRequest,
    TitleGenerateResponse,
)
from api.schemas.video import (
    VideoGenerateRequest,
    VideoGenerateResponse,
    VideoGenerateAsyncResponse,
)
from api.schemas.config import (
    LLMConfig,
    LLMConfigUpdate,
    LLMTestRequest,
    LLMTestResponse,
    ComfyUIConfig,
    ComfyUIConfigUpdate,
    ComfyUITestRequest,
    ComfyUITestResponse,
    APIProviderConfig,
    APIProvidersCommonConfig,
    APIProvidersCommonUpdate,
    APIProvidersConfig,
    FullConfig,
)

__all__ = [
    # Base
    "BaseResponse",
    "ErrorResponse",
    # LLM
    "LLMChatRequest",
    "LLMChatResponse",
    # TTS
    "TTSSynthesizeRequest",
    "TTSSynthesizeResponse",
    # Image
    "ImageGenerateRequest",
    "ImageGenerateResponse",
    # Content
    "NarrationGenerateRequest",
    "NarrationGenerateResponse",
    "ImagePromptGenerateRequest",
    "ImagePromptGenerateResponse",
    "TitleGenerateRequest",
    "TitleGenerateResponse",
    # Video
    "VideoGenerateRequest",
    "VideoGenerateResponse",
    "VideoGenerateAsyncResponse",
    # Config
    "LLMConfig",
    "LLMConfigUpdate",
    "LLMTestRequest",
    "LLMTestResponse",
    "ComfyUIConfig",
    "ComfyUIConfigUpdate",
    "ComfyUITestRequest",
    "ComfyUITestResponse",
    "APIProviderConfig",
    "APIProvidersCommonConfig",
    "APIProvidersCommonUpdate",
    "APIProvidersConfig",
    "FullConfig",
]

