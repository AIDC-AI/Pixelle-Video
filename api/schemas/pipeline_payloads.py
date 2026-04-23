# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Pipeline-specific request payloads
"""

from __future__ import annotations

from typing import List, Optional, Literal

from pydantic import BaseModel, Field


class BGMConfigMixin(BaseModel):
    bgm_mode: Literal["default", "custom", "none"] = Field(
        "none",
        description="BGM source mode: default=use runtime default, custom=use bgm_path, none=disable background music",
    )
    bgm_path: Optional[str] = Field(None, description="Optional BGM path")
    bgm_volume: float = Field(0.3, ge=0.0, le=1.0, description="BGM volume")


class DigitalHumanAsyncRequest(BGMConfigMixin):
    portrait_url: str = Field(..., description="Portrait asset URL or path")
    narration: str = Field(..., description="Narration text")
    voice_workflow: Optional[str] = Field(None, description="Voice workflow key")
    runninghub_instance_type: Optional[str] = Field(
        None,
        description="Optional RunningHub instance type override for this job."
    )
    project_id: Optional[str] = Field(None, description="Project ID")


class I2VAsyncRequest(BGMConfigMixin):
    source_image: str = Field(..., description="Source image path")
    motion_prompt: str = Field(..., description="Motion prompt")
    media_workflow: str = Field(..., description="Media workflow key")
    runninghub_instance_type: Optional[str] = Field(
        None,
        description="Optional RunningHub instance type override for this job."
    )
    project_id: Optional[str] = Field(None, description="Project ID")


class ActionTransferAsyncRequest(BGMConfigMixin):
    driver_video: str = Field(..., description="Driver video path")
    target_image: str = Field(..., description="Target image path")
    pose_workflow: str = Field(..., description="Pose workflow key")
    runninghub_instance_type: Optional[str] = Field(
        None,
        description="Optional RunningHub instance type override for this job."
    )
    project_id: Optional[str] = Field(None, description="Project ID")


class CustomScene(BaseModel):
    media: str = Field(..., description="Media asset path")
    narration: str = Field(..., description="Narration text")
    duration: int = Field(..., description="Scene duration in seconds")


class CustomAsyncRequest(BGMConfigMixin):
    scenes: List[CustomScene] = Field(..., description="Scene list")
    project_id: Optional[str] = Field(None, description="Project ID")
