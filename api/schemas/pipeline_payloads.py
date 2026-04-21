# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Pipeline-specific request payloads
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class DigitalHumanAsyncRequest(BaseModel):
    portrait_url: str = Field(..., description="Portrait asset URL or path")
    narration: str = Field(..., description="Narration text")
    voice_workflow: Optional[str] = Field(None, description="Voice workflow key")
    project_id: Optional[str] = Field(None, description="Project ID")


class I2VAsyncRequest(BaseModel):
    source_image: str = Field(..., description="Source image path")
    motion_prompt: str = Field(..., description="Motion prompt")
    media_workflow: Optional[str] = Field(None, description="Media workflow key")
    project_id: Optional[str] = Field(None, description="Project ID")


class ActionTransferAsyncRequest(BaseModel):
    driver_video: str = Field(..., description="Driver video path")
    target_image: str = Field(..., description="Target image path")
    pose_workflow: Optional[str] = Field(None, description="Pose workflow key")
    project_id: Optional[str] = Field(None, description="Project ID")


class CustomScene(BaseModel):
    media: str = Field(..., description="Media asset path")
    narration: str = Field(..., description="Narration text")
    duration: int = Field(..., description="Scene duration in seconds")


class CustomAsyncRequest(BaseModel):
    scenes: List[CustomScene] = Field(..., description="Scene list")
    project_id: Optional[str] = Field(None, description="Project ID")
