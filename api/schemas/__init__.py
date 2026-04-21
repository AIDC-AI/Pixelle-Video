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
from api.schemas.projects import (
    Project,
    ProjectCreateRequest,
    ProjectUpdateRequest,
    ProjectListResponse,
)
from api.schemas.library import (
    VideoItem,
    VideoListResponse,
    PlaceholderListResponse,
)
from api.schemas.batch import (
    Batch,
    BatchCreateRequest,
    BatchListResponse,
)
from api.schemas.settings import SettingsPayload
from api.schemas.uploads import UploadResponse
from api.schemas.pipeline_payloads import (
    DigitalHumanAsyncRequest,
    I2VAsyncRequest,
    ActionTransferAsyncRequest,
    CustomScene,
    CustomAsyncRequest,
)
from api.schemas.resources import (
    WorkflowInfo,
    WorkflowListResponse,
    TemplateInfo,
    TemplateListResponse,
    BGMInfo,
    BGMListResponse,
    PresetInfo,
    PresetListResponse,
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
    # Projects
    "Project",
    "ProjectCreateRequest",
    "ProjectUpdateRequest",
    "ProjectListResponse",
    # Library
    "VideoItem",
    "VideoListResponse",
    "PlaceholderListResponse",
    # Batch
    "Batch",
    "BatchCreateRequest",
    "BatchListResponse",
    # Settings
    "SettingsPayload",
    # Uploads
    "UploadResponse",
    # Pipeline payloads
    "DigitalHumanAsyncRequest",
    "I2VAsyncRequest",
    "ActionTransferAsyncRequest",
    "CustomScene",
    "CustomAsyncRequest",
    # Resources
    "WorkflowInfo",
    "WorkflowListResponse",
    "TemplateInfo",
    "TemplateListResponse",
    "BGMInfo",
    "BGMListResponse",
    "PresetInfo",
    "PresetListResponse",
]
