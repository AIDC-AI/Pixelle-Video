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
Publish API schemas
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class PublishVideoRequest(BaseModel):
    """Publish a rendered video to social platforms"""
    video_path: str = Field(..., description="Path to the rendered video file")
    title: str = Field(..., description="Caption / title. Required for YouTube and Reddit")
    platforms: Optional[List[str]] = Field(
        None,
        description="Target platforms (e.g. ['tiktok', 'instagram']). Defaults to publish.platforms in config.",
    )
    description: Optional[str] = Field(
        None,
        description="Longer text, used by YouTube, LinkedIn, Facebook and Pinterest",
    )
    scheduled_date: Optional[str] = Field(
        None,
        description="ISO-8601 timestamp to schedule the post instead of publishing now",
    )
    timezone: Optional[str] = Field(
        None,
        description="IANA timezone the scheduled_date is expressed in (default UTC)",
    )
    async_upload: bool = Field(
        True,
        description="Return as soon as the upload is accepted and process in the background",
    )
    extra_params: Optional[dict] = Field(
        None,
        description="Additional Upload-Post parameters, e.g. {'privacy_level': 'SELF_ONLY'}",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "video_path": "output/20260101_120000/final.mp4",
                "title": "How to build better habits",
                "platforms": ["tiktok", "instagram", "youtube"],
            }
        }


class PublishVideoResponse(BaseModel):
    """Publish response"""
    success: bool = True
    message: str = "Success"
    request_id: Optional[str] = Field(None, description="Use it to poll the publish status")
    result: dict = Field(default_factory=dict, description="Raw Upload-Post API response")


class PublishStatusResponse(BaseModel):
    """Publish status response"""
    success: bool = True
    message: str = "Success"
    status: Optional[str] = Field(None, description="Current status of the upload")
    result: dict = Field(default_factory=dict, description="Raw Upload-Post status response")
