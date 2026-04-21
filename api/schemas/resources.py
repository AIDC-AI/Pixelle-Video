from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class WorkflowInfo(BaseModel):
    name: str = Field(..., description="Workflow filename")
    display_name: str = Field(..., description="Display name with source info")
    source: str = Field(..., description="Source (runninghub or selfhost)")
    path: str = Field(..., description="Full path to workflow file")
    key: str = Field(..., description="Workflow key (source/name)")
    workflow_id: Optional[str] = Field(None, description="RunningHub workflow ID (if applicable)")


class WorkflowDetailResponse(WorkflowInfo):
    editable: bool = Field(..., description="Whether the workflow file is editable")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Workflow metadata summary")
    key_parameters: List[str] = Field(default_factory=list, description="Important node parameter identifiers")
    raw_nodes: List[str] = Field(default_factory=list, description="Top-level workflow node IDs")


class WorkflowListResponse(BaseModel):
    success: bool = True
    message: str = "Success"
    workflows: List[WorkflowInfo] = Field(..., description="List of available workflows")


class TemplateInfo(BaseModel):
    name: str = Field(..., description="Template filename")
    display_name: str = Field(..., description="Display name")
    size: str = Field(..., description="Size (e.g., 1080x1920)")
    width: int = Field(..., description="Width in pixels")
    height: int = Field(..., description="Height in pixels")
    orientation: str = Field(..., description="Orientation (portrait/landscape/square)")
    path: str = Field(..., description="Full path to template file")
    key: str = Field(..., description="Template key (size/name)")


class TemplateListResponse(BaseModel):
    success: bool = True
    message: str = "Success"
    templates: List[TemplateInfo] = Field(..., description="List of available templates")


class BGMInfo(BaseModel):
    name: str = Field(..., description="BGM filename")
    path: str = Field(..., description="Full path to BGM file")
    source: str = Field(..., description="Source (default or custom)")


class BGMListResponse(BaseModel):
    success: bool = True
    message: str = "Success"
    bgm_files: List[BGMInfo] = Field(..., description="List of available BGM files")


class PresetItem(BaseModel):
    name: str = Field(..., description="Preset name")
    description: Optional[str] = Field(None, description="Preset description")
    pipeline: str = Field(..., description="Preset scope or pipeline")
    payload_template: dict[str, Any] = Field(default_factory=dict, description="Preset payload template")
    created_at: Optional[datetime] = Field(None, description="Creation time")
    source: str = Field(..., description="builtin or user")


class PresetListResponse(BaseModel):
    success: bool = True
    message: str = "Success"
    presets: List[PresetItem] = Field(default_factory=list, description="List of presets")
