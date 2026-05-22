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
Image generation API schemas
"""

from typing import Optional
from pydantic import BaseModel, Field

from api.schemas.base import SuccessResponse


class ImageGenerateRequest(BaseModel):
    """Image generation request"""
    prompt: str = Field(..., description="Image generation prompt")
    width: int = Field(1024, ge=512, le=2048, description="Image width")
    height: int = Field(1024, ge=512, le=2048, description="Image height")
    workflow: Optional[str] = Field(None, description="Custom workflow filename")
    
    class Config:
        json_schema_extra = {
            "example": {
                "prompt": "A serene mountain landscape at sunset, photorealistic style",
                "width": 1024,
                "height": 1024
            }
        }


class ImageGenerateResponse(SuccessResponse):
    """Image generation response"""
    image_path: str = Field(..., description="Path to generated image")
