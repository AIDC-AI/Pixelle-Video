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
Storyboard data models for video generation
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any


@dataclass
class StoryboardConfig:
    """Storyboard configuration parameters"""
    
    # Required parameters (must come first in dataclass)
    media_width: int                           # Media width (image or video, required)
    media_height: int                          # Media height (image or video, required)
    
    # Task isolation
    task_id: Optional[str] = None              # Task ID for file isolation (auto-generated if None)
    
    n_storyboard: int = 5                      # Number of storyboard frames
    min_narration_words: int = 5               # Min narration word count
    max_narration_words: int = 20              # Max narration word count
    min_image_prompt_words: int = 30           # Min image prompt word count
    max_image_prompt_words: int = 60           # Max image prompt word count
    
    # Video parameters (fps only, size is determined by frame template)
    video_fps: int = 30                        # Frame rate
    
    # Audio parameters
    tts_inference_mode: str = "local"          # TTS inference mode: "local" or "comfyui"
    voice_id: Optional[str] = None             # Voice ID (for local: Edge TTS voice ID; for comfyui: workflow-specific)
    tts_workflow: Optional[str] = None         # TTS workflow filename (for ComfyUI mode, None = use default)
    tts_speed: Optional[float] = None          # TTS speed multiplier (0.5-2.0, 1.0 = normal)
    ref_audio: Optional[str] = None            # Reference audio for voice cloning (ComfyUI mode only)
    
    # Media workflow
    media_workflow: Optional[str] = None       # Media workflow filename (image or video, None = use default)
    
    # Frame template (includes size information in path)
    frame_template: str = "1080x1920/default.html"  # Template path with size (e.g., "1080x1920/default.html")
    template_params: Optional[Dict[str, Any]] = None  # Custom template parameters (e.g., {"accent_color": "#ff0000"})


@dataclass
class StoryboardFrame:
    """Single storyboard frame"""
    index: int                                 # Frame index (0-based)
    narration: str                             # Narration text
    image_prompt: str                          # Image generation prompt (can be None for text-only or video)
    
    # Generated resource paths
    audio_path: Optional[str] = None           # Audio file path (narration)
    media_type: Optional[str] = None           # Media type: "image" or "video" (None if no media)
    image_path: Optional[str] = None           # Original image path (for image type)
    video_path: Optional[str] = None           # Original video path (for video type, before composition)
    composed_image_path: Optional[str] = None  # Composed image path (with subtitles, for image type)
    video_segment_path: Optional[str] = None   # Final video segment path
    
    # Metadata
    duration: float = 0.0                      # Frame duration (seconds, from audio or video)
    created_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()


@dataclass
class ContentMetadata:
    """Content metadata for visual display and narration generation"""
    title: str                                 # Content title
    author: Optional[str] = None               # Author/creator
    subtitle: Optional[str] = None             # Subtitle
    genre: Optional[str] = None                # Genre/category
    summary: Optional[str] = None              # Content summary
    publication_year: Optional[str] = None     # Publication year
    cover_url: Optional[str] = None            # Cover/thumbnail image URL


@dataclass
class Storyboard:
    """Complete storyboard"""
    title: str                                 # Video title
    config: StoryboardConfig                   # Configuration
    frames: List[StoryboardFrame] = field(default_factory=list)
    
    # Content metadata (optional)
    content_metadata: Optional[ContentMetadata] = None
    
    # Final output
    final_video_path: Optional[str] = None
    total_duration: float = 0.0
    
    # Metadata
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
    
    @property
    def is_completed(self) -> bool:
        """Check if all frames are processed"""
        return all(
            frame.video_segment_path is not None
            for frame in self.frames
        )
    
    @property
    def progress(self) -> float:
        """Return processing progress (0.0-1.0)"""
        if not self.frames:
            return 0.0
        completed = sum(
            1 for frame in self.frames
            if frame.video_segment_path is not None
        )
        return completed / len(self.frames)


@dataclass
class VideoGenerationResult:
    """Video generation result"""
    video_path: str                            # Final video path
    storyboard: Storyboard                     # Complete storyboard
    duration: float                            # Total duration
    file_size: int                             # File size (bytes)
    created_at: datetime = field(default_factory=datetime.now)

