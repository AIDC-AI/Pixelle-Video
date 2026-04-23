# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Project API schemas
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from api.schemas.batch import Batch
from api.schemas.library import (
    ImageItem,
    LibraryBGMItem,
    ScriptItem,
    VideoItem,
    VoiceItem,
)
from api.tasks.models import Task


class Project(BaseModel):
    id: str = Field(..., description="Project ID")
    name: str = Field(..., description="Project name")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    cover_url: Optional[str] = Field(None, description="Cover image URL")
    pipeline_hint: Optional[str] = Field(None, description="Last or default pipeline")
    task_count: int = Field(0, description="Number of linked tasks")
    last_task_id: Optional[str] = Field(None, description="Most recent task ID")
    preview_url: Optional[str] = Field(None, description="Derived preview URL")
    preview_kind: Optional[Literal["image", "video"]] = Field(None, description="Derived preview kind")
    deleted_at: Optional[datetime] = Field(None, description="Soft delete timestamp")


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., description="Project name")
    cover_url: Optional[str] = Field(None, description="Cover image URL")
    pipeline_hint: Optional[str] = Field(None, description="Pipeline hint")


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, description="Updated project name")
    cover_url: Optional[str] = Field(None, description="Updated cover image URL")
    pipeline_hint: Optional[str] = Field(None, description="Updated pipeline hint")


class ProjectListResponse(BaseModel):
    items: List[Project] = Field(default_factory=list, description="Projects")


class ProjectOverviewStats(BaseModel):
    batch_count: int = Field(0, description="Number of linked batches")
    task_count: int = Field(0, description="Number of linked tasks")
    pending_task_count: int = Field(0, description="Number of pending tasks")
    running_task_count: int = Field(0, description="Number of running tasks")
    completed_task_count: int = Field(0, description="Number of completed tasks")
    failed_task_count: int = Field(0, description="Number of failed tasks")
    cancelled_task_count: int = Field(0, description="Number of cancelled tasks")
    video_count: int = Field(0, description="Number of linked videos")
    image_count: int = Field(0, description="Number of linked images")
    voice_count: int = Field(0, description="Number of linked voices")
    bgm_count: int = Field(0, description="Number of linked bgm items")
    script_count: int = Field(0, description="Number of linked scripts")


class ProjectOverviewRecent(BaseModel):
    batches: List[Batch] = Field(default_factory=list, description="Recent batches")
    tasks: List[Task] = Field(default_factory=list, description="Recent tasks")
    videos: List[VideoItem] = Field(default_factory=list, description="Recent videos")
    images: List[ImageItem] = Field(default_factory=list, description="Recent images")
    voices: List[VoiceItem] = Field(default_factory=list, description="Recent voices")
    bgm: List[LibraryBGMItem] = Field(default_factory=list, description="Recent bgm")
    scripts: List[ScriptItem] = Field(default_factory=list, description="Recent scripts")


class ProjectOverviewResponse(BaseModel):
    project: Project = Field(..., description="Project summary")
    stats: ProjectOverviewStats = Field(default_factory=ProjectOverviewStats, description="Aggregated project stats")
    recent: ProjectOverviewRecent = Field(default_factory=ProjectOverviewRecent, description="Recent project content")
