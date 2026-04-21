# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Library API schemas
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

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


class VideoListResponse(BaseModel):
    items: List[VideoItem] = Field(default_factory=list, description="Videos")
    next_cursor: Optional[str] = Field(None, description="Pagination cursor")


class PlaceholderListResponse(BaseModel):
    items: List[dict] = Field(default_factory=list, description="Placeholder items")
    next_cursor: Optional[str] = Field(None, description="Pagination cursor")

