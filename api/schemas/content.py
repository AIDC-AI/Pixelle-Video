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
Content generation API schemas
"""

from typing import List, Optional
from pydantic import BaseModel, Field

from api.schemas.base import SuccessResponse


# ============================================================================
# Narration Generation
# ============================================================================

class NarrationGenerateRequest(BaseModel):
    """Narration generation request"""
    text: str = Field(..., description="Source text to generate narrations from")
    n_scenes: int = Field(5, ge=1, le=20, description="Number of scenes")
    min_words: int = Field(5, ge=1, le=100, description="Minimum words per narration")
    max_words: int = Field(20, ge=1, le=200, description="Maximum words per narration")
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Atomic Habits is about making small changes that lead to remarkable results.",
                "n_scenes": 5,
                "min_words": 5,
                "max_words": 20
            }
        }


class NarrationGenerateResponse(SuccessResponse):
    """Narration generation response"""
    narrations: List[str] = Field(..., description="Generated narrations")


# ============================================================================
# Image Prompt Generation
# ============================================================================

class ImagePromptGenerateRequest(BaseModel):
    """Image prompt generation request"""
    narrations: List[str] = Field(..., description="List of narrations")
    min_words: int = Field(30, ge=10, le=100, description="Minimum words per prompt")
    max_words: int = Field(60, ge=10, le=200, description="Maximum words per prompt")
    
    class Config:
        json_schema_extra = {
            "example": {
                "narrations": [
                    "Small habits compound over time",
                    "Focus on systems, not goals"
                ],
                "min_words": 30,
                "max_words": 60
            }
        }


class ImagePromptGenerateResponse(SuccessResponse):
    """Image prompt generation response"""
    image_prompts: List[str] = Field(..., description="Generated image prompts")


# ============================================================================
# Title Generation
# ============================================================================

class TitleGenerateRequest(BaseModel):
    """Title generation request"""
    text: str = Field(..., description="Source text")
    style: Optional[str] = Field(None, description="Title style (e.g., 'engaging', 'formal')")
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Atomic Habits is about making small changes that lead to remarkable results.",
                "style": "engaging"
            }
        }


class TitleGenerateResponse(SuccessResponse):
    """Title generation response"""
    title: str = Field(..., description="Generated title")
