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
Frame/Template rendering API schemas
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

from api.schemas.base import SuccessResponse


class FrameRenderRequest(BaseModel):
    """Frame rendering request"""
    template: str = Field(
        ..., 
        description="Template key (e.g., '1080x1920/default.html'). Can also be just filename (e.g., 'default.html') to use default size."
    )
    title: Optional[str] = Field(None, description="Frame title (optional)")
    text: str = Field(..., description="Frame text content")
    image: Optional[str] = Field(None, description="Image path or URL (optional)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "template": "1080x1920/default.html",
                "title": "Sample Title",
                "text": "This is a sample text for the frame.",
                "image": "resources/example.png"
            }
        }


class FrameRenderResponse(SuccessResponse):
    """Frame rendering response"""
    frame_path: str = Field(..., description="Path to generated frame image")
    width: int = Field(..., description="Frame width in pixels")
    height: int = Field(..., description="Frame height in pixels")


class TemplateParamConfig(BaseModel):
    """Single template parameter configuration"""
    type: str = Field(..., description="Parameter type: 'text', 'number', 'color', 'bool'")
    default: Any = Field(..., description="Default value")
    label: str = Field(..., description="Display label for the parameter")


class TemplateParamsResponse(SuccessResponse):
    """Template parameters response"""
    template: str = Field(..., description="Template path")
    media_width: int = Field(..., description="Media width from template meta tags")
    media_height: int = Field(..., description="Media height from template meta tags")
    params: Dict[str, TemplateParamConfig] = Field(
        default_factory=dict,
        description="Custom parameters defined in template. Key is parameter name, value is config."
    )
