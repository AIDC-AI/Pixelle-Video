# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Project API schemas
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class Project(BaseModel):
    id: str = Field(..., description="Project ID")
    name: str = Field(..., description="Project name")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    cover_url: Optional[str] = Field(None, description="Cover image URL")
    pipeline_hint: Optional[str] = Field(None, description="Last or default pipeline")
    task_count: int = Field(0, description="Number of linked tasks")
    last_task_id: Optional[str] = Field(None, description="Most recent task ID")
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

