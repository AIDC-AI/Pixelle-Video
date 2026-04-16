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
Script extraction API schemas
"""

from pydantic import BaseModel, Field


class ScriptExtractRequest(BaseModel):
    """Script extraction request"""
    url: str = Field(..., description="Video URL (YouTube, Bilibili, Douyin, etc.)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://www.bilibili.com/video/BV1xx411c7mD"
            }
        }


class ScriptExtractResponse(BaseModel):
    """Script extraction response"""
    success: bool = True
    message: str = "Success"
    script: str = Field(..., description="Extracted script text")
    url: str = Field(default="", description="Original video URL")
