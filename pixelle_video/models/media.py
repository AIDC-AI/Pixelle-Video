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
Media generation result models
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class MediaResult(BaseModel):
    """
    Media generation result from workflow execution
    
    Supports both image and video outputs from ComfyUI workflows and Azure OpenAI.
    The media_type indicates what kind of media was generated.
    
    Attributes:
        media_type: Type of media generated ("image" or "video")
        url: URL or path to the generated media
        local_path: Local file path if media was downloaded/saved locally
        duration: Duration in seconds (only for video, None for image)
    
    Examples:
        # Image result (URL only)
        MediaResult(media_type="image", url="http://example.com/image.png")
        
        # Image result (with local path)
        MediaResult(
            media_type="image", 
            url="http://example.com/image.png",
            local_path="output/images/azure_abc123.png"
        )
        
        # Video result
        MediaResult(media_type="video", url="http://example.com/video.mp4", duration=5.2)
    """
    
    media_type: Literal["image", "video"] = Field(
        description="Type of generated media"
    )
    url: str = Field(
        description="URL or path to the generated media file"
    )
    local_path: Optional[str] = Field(
        None,
        description="Local file path if media was downloaded/saved locally"
    )
    duration: Optional[float] = Field(
        None,
        description="Duration in seconds (only applicable for video)"
    )
    
    @property
    def is_image(self) -> bool:
        """Check if this is an image result"""
        return self.media_type == "image"
    
    @property
    def is_video(self) -> bool:
        """Check if this is a video result"""
        return self.media_type == "video"
    
    @property
    def path(self) -> str:
        """Get best available path (local preferred, fallback to url)"""
        return self.local_path or self.url
