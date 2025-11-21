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
Video generation API schemas
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field


class VideoGenerateRequest(BaseModel):
    """Video generation request"""
    
    # === Input ===
    text: str = Field(..., description="Source text for video generation")
    
    # === Processing Mode ===
    mode: Literal["generate", "fixed"] = Field(
        "generate",
        description="Processing mode: 'generate' (AI generates narrations) or 'fixed' (use text as-is)"
    )
    
    # === Optional Title ===
    title: Optional[str] = Field(None, description="Video title (auto-generated if not provided)")
    
    # === Basic Config ===
    n_scenes: int = Field(5, ge=1, le=20, description="Number of scenes (generate mode only)")
    
    # === TTS Parameters ===
    tts_workflow: Optional[str] = Field(
        None, 
        description="TTS workflow key (e.g., 'runninghub/tts_edge.json'). If not specified, uses default workflow from config."
    )
    ref_audio: Optional[str] = Field(
        None, 
        description="Reference audio path for voice cloning (optional)"
    )
    voice_id: Optional[str] = Field(
        None, 
        description="(Deprecated) TTS voice ID for legacy compatibility"
    )
    
    # === LLM Parameters ===
    min_narration_words: int = Field(5, ge=1, le=100, description="Min narration words")
    max_narration_words: int = Field(20, ge=1, le=200, description="Max narration words")
    min_image_prompt_words: int = Field(30, ge=10, le=100, description="Min image prompt words")
    max_image_prompt_words: int = Field(60, ge=10, le=200, description="Max image prompt words")
    
    # === Media Parameters ===
    # Note: media_width and media_height are auto-determined from template meta tags
    media_workflow: Optional[str] = Field(None, description="Custom media workflow (image or video)")
    
    # === Video Parameters ===
    video_fps: int = Field(30, ge=15, le=60, description="Video FPS")
    
    # === Frame Template (determines video size) ===
    frame_template: Optional[str] = Field(
        None, 
        description="HTML template path with size (e.g., '1080x1920/default.html'). Video size is auto-determined from template."
    )
    
    # === Image Style ===
    prompt_prefix: Optional[str] = Field(None, description="Image style prefix")
    
    # === BGM ===
    bgm_path: Optional[str] = Field(None, description="Background music path")
    bgm_volume: float = Field(0.3, ge=0.0, le=1.0, description="BGM volume (0.0-1.0)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Atomic Habits teaches us that small changes compound over time to produce remarkable results.",
                "mode": "generate",
                "n_scenes": 5,
                "voice_id": "[Chinese] zh-CN Yunjian",
                "title": "The Power of Atomic Habits"
            }
        }


class VideoGenerateResponse(BaseModel):
    """Video generation response (synchronous)"""
    success: bool = True
    message: str = "Success"
    video_url: str = Field(..., description="URL to access generated video")
    duration: float = Field(..., description="Video duration in seconds")
    file_size: int = Field(..., description="File size in bytes")


class VideoGenerateAsyncResponse(BaseModel):
    """Video generation async response"""
    success: bool = True
    message: str = "Task created successfully"
    task_id: str = Field(..., description="Task ID for tracking progress")

