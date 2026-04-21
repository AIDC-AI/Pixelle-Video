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

from api.schemas.base import ApiErrorDetail, ApiErrorResponse, BaseResponse, ErrorResponse
from api.schemas.batch import (
    Batch,
    BatchCreateRequest,
    BatchCreateResponse,
    BatchDetailResponse,
    BatchListResponse,
)
from api.schemas.content import (
    ImagePromptGenerateRequest,
    ImagePromptGenerateResponse,
    NarrationGenerateRequest,
    NarrationGenerateResponse,
    TitleGenerateRequest,
    TitleGenerateResponse,
)
from api.schemas.image import ImageGenerateRequest, ImageGenerateResponse
from api.schemas.library import (
    ImageItem,
    ImageListResponse,
    LibraryBGMItem,
    LibraryBGMListResponse,
    ScriptItem,
    ScriptListResponse,
    VideoDetailResponse,
    VideoItem,
    VideoListResponse,
    VoiceItem,
    VoiceListResponse,
)
from api.schemas.llm import LLMChatRequest, LLMChatResponse
from api.schemas.pipeline_payloads import (
    ActionTransferAsyncRequest,
    CustomAsyncRequest,
    CustomScene,
    DigitalHumanAsyncRequest,
    I2VAsyncRequest,
)
from api.schemas.projects import (
    Project,
    ProjectCreateRequest,
    ProjectListResponse,
    ProjectUpdateRequest,
)
from api.schemas.resources import (
    BGMInfo,
    BGMListResponse,
    PresetItem,
    PresetListResponse,
    TemplateInfo,
    TemplateListResponse,
    WorkflowDetailResponse,
    WorkflowInfo,
    WorkflowListResponse,
)
from api.schemas.settings import SettingsPayload, SettingsUpdatePayload
from api.schemas.tts import TTSSynthesizeRequest, TTSSynthesizeResponse
from api.schemas.uploads import UploadResponse
from api.schemas.video import (
    VideoGenerateAsyncResponse,
    VideoGenerateRequest,
    VideoGenerateResponse,
)

__all__ = [
    # Base
    "BaseResponse",
    "ErrorResponse",
    "ApiErrorDetail",
    "ApiErrorResponse",
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
    "VideoDetailResponse",
    "VideoListResponse",
    "ImageItem",
    "ImageListResponse",
    "VoiceItem",
    "VoiceListResponse",
    "LibraryBGMItem",
    "LibraryBGMListResponse",
    "ScriptItem",
    "ScriptListResponse",
    # Batch
    "Batch",
    "BatchCreateRequest",
    "BatchCreateResponse",
    "BatchDetailResponse",
    "BatchListResponse",
    # Settings
    "SettingsPayload",
    "SettingsUpdatePayload",
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
    "WorkflowDetailResponse",
    "WorkflowListResponse",
    "TemplateInfo",
    "TemplateListResponse",
    "BGMInfo",
    "BGMListResponse",
    "PresetItem",
    "PresetListResponse",
]
