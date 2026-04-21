from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class VideoItem(BaseModel):
    task_id: str = Field(..., description="Task ID")
    title: str = Field(..., description="Video title")
    created_at: Optional[datetime] = Field(None, description="Creation time")
    completed_at: Optional[datetime] = Field(None, description="Completion time")
    duration: float = Field(0.0, description="Video duration")
    file_size: int = Field(0, description="File size in bytes")
    n_frames: int = Field(0, description="Number of frames/scenes")
    video_path: Optional[str] = Field(None, description="Stored video path")
    video_url: Optional[str] = Field(None, description="Accessible video URL")
    thumbnail_url: Optional[str] = Field(None, description="Thumbnail URL")
    project_id: Optional[str] = Field(None, description="Linked project ID")
    batch_id: Optional[str] = Field(None, description="Linked batch ID")
    pipeline: Optional[str] = Field(None, description="Pipeline identifier")


class VideoDetailResponse(VideoItem):
    audio_duration: Optional[float] = Field(None, description="Total narration audio duration")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Raw metadata snapshot")
    snapshot: dict[str, Any] = Field(default_factory=dict, description="Compatibility alias for metadata")
    storyboard: Optional[dict[str, Any]] = Field(None, description="Storyboard snapshot")


class VideoListResponse(BaseModel):
    items: List[VideoItem] = Field(default_factory=list, description="Videos")
    next_cursor: Optional[str] = Field(None, description="Pagination cursor")


class ImageItem(BaseModel):
    id: str = Field(..., description="Image record ID")
    task_id: Optional[str] = Field(None, description="Related task ID")
    image_path: str = Field(..., description="Stored image path")
    image_url: Optional[str] = Field(None, description="Accessible image URL")
    thumbnail_url: Optional[str] = Field(None, description="Thumbnail URL")
    created_at: Optional[datetime] = Field(None, description="Creation time")
    file_size: int = Field(0, description="File size in bytes")
    prompt_used: Optional[str] = Field(None, description="Image prompt")
    project_id: Optional[str] = Field(None, description="Linked project ID")
    batch_id: Optional[str] = Field(None, description="Linked batch ID")


class ImageListResponse(BaseModel):
    items: List[ImageItem] = Field(default_factory=list, description="Images")
    next_cursor: Optional[str] = Field(None, description="Pagination cursor")


class VoiceItem(BaseModel):
    id: str = Field(..., description="Voice record ID")
    task_id: Optional[str] = Field(None, description="Related task ID")
    audio_path: str = Field(..., description="Stored audio path")
    audio_url: Optional[str] = Field(None, description="Accessible audio URL")
    created_at: Optional[datetime] = Field(None, description="Creation time")
    duration: float = Field(0.0, description="Audio duration")
    tts_voice: Optional[str] = Field(None, description="Voice identifier or workflow")
    text: Optional[str] = Field(None, description="Synthesized text")
    file_size: int = Field(0, description="File size in bytes")
    project_id: Optional[str] = Field(None, description="Linked project ID")
    batch_id: Optional[str] = Field(None, description="Linked batch ID")


class VoiceListResponse(BaseModel):
    items: List[VoiceItem] = Field(default_factory=list, description="Voice assets")
    next_cursor: Optional[str] = Field(None, description="Pagination cursor")


class LibraryBGMItem(BaseModel):
    id: str = Field(..., description="BGM record ID")
    name: str = Field(..., description="BGM display name")
    audio_path: str = Field(..., description="BGM path")
    audio_url: Optional[str] = Field(None, description="Accessible BGM URL")
    created_at: Optional[datetime] = Field(None, description="Creation time")
    duration: Optional[float] = Field(None, description="Audio duration")
    file_size: int = Field(0, description="File size in bytes")
    source: str = Field(..., description="builtin or history")
    project_id: Optional[str] = Field(None, description="Linked project ID")
    batch_id: Optional[str] = Field(None, description="Linked batch ID")


class LibraryBGMListResponse(BaseModel):
    items: List[LibraryBGMItem] = Field(default_factory=list, description="BGM assets")
    next_cursor: Optional[str] = Field(None, description="Pagination cursor")


class ScriptItem(BaseModel):
    id: str = Field(..., description="Script record ID")
    task_id: Optional[str] = Field(None, description="Related task ID")
    created_at: Optional[datetime] = Field(None, description="Creation time")
    project_id: Optional[str] = Field(None, description="Linked project ID")
    batch_id: Optional[str] = Field(None, description="Linked batch ID")
    text: str = Field(..., description="Script or narration text")
    script_type: str = Field(..., description="script, narration, or prompt")
    prompt_used: Optional[str] = Field(None, description="Associated prompt")


class ScriptListResponse(BaseModel):
    items: List[ScriptItem] = Field(default_factory=list, description="Script records")
    next_cursor: Optional[str] = Field(None, description="Pagination cursor")
