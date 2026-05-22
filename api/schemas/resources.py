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
Resource discovery API schemas
"""

from typing import List, Optional
from pydantic import BaseModel, Field

from api.schemas.base import SuccessResponse


class WorkflowInfo(BaseModel):
    """Workflow information"""
    name: str = Field(..., description="Workflow filename")
    display_name: str = Field(..., description="Display name with source info")
    source: str = Field(..., description="Source (runninghub or selfhost)")
    path: str = Field(..., description="Full path to workflow file")
    key: str = Field(..., description="Workflow key (source/name)")
    workflow_id: Optional[str] = Field(None, description="RunningHub workflow ID (if applicable)")


class WorkflowListResponse(SuccessResponse):
    """Workflow list response"""
    workflows: List[WorkflowInfo] = Field(..., description="List of available workflows")


class TemplateInfo(BaseModel):
    """Template information"""
    name: str = Field(..., description="Template filename")
    display_name: str = Field(..., description="Display name")
    size: str = Field(..., description="Size (e.g., 1080x1920)")
    width: int = Field(..., description="Width in pixels")
    height: int = Field(..., description="Height in pixels")
    orientation: str = Field(..., description="Orientation (portrait/landscape/square)")
    path: str = Field(..., description="Full path to template file")
    key: str = Field(..., description="Template key (size/name)")


class TemplateListResponse(SuccessResponse):
    """Template list response"""
    templates: List[TemplateInfo] = Field(..., description="List of available templates")


class BGMInfo(BaseModel):
    """BGM information"""
    name: str = Field(..., description="BGM filename")
    path: str = Field(..., description="Full path to BGM file")
    source: str = Field(..., description="Source (default or custom)")


class BGMListResponse(SuccessResponse):
    """BGM list response"""
    bgm_files: List[BGMInfo] = Field(..., description="List of available BGM files")
