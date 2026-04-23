from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class WorkflowInfo(BaseModel):
    name: str = Field(..., description="Workflow filename")
    display_name: str = Field(..., description="Display name with source info")
    display_name_zh: Optional[str] = Field(None, description="Chinese-first display name for users")
    description_zh: Optional[str] = Field(None, description="Chinese user-facing description")
    display_category: Optional[str] = Field(None, description="Workflow display category")
    display_category_zh: Optional[str] = Field(None, description="Chinese workflow display category")
    display_tags: List[str] = Field(default_factory=list, description="User-facing workflow tags")
    technical_name: Optional[str] = Field(None, description="Original workflow filename for debugging")
    technical_path: Optional[str] = Field(None, description="Original workflow path for debugging")
    source: str = Field(..., description="Source (runninghub or selfhost)")
    path: str = Field(..., description="Full path to workflow file")
    key: str = Field(..., description="Workflow key (source/name)")
    workflow_id: Optional[str] = Field(None, description="RunningHub workflow ID (if applicable)")


class WorkflowDetailResponse(WorkflowInfo):
    editable: bool = Field(..., description="Whether the workflow file is editable")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Workflow metadata summary")
    key_parameters: List[str] = Field(default_factory=list, description="Important node parameter identifiers")
    raw_nodes: List[str] = Field(default_factory=list, description="Top-level workflow node IDs")
    workflow_json: dict[str, Any] = Field(default_factory=dict, description="Complete workflow JSON content")


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
    preview_image_url: Optional[str] = Field(None, description="Template preview image URL")
    preview_available: bool = Field(False, description="Whether a static preview image exists")


class TemplateListResponse(BaseModel):
    success: bool = True
    message: str = "Success"
    templates: List[TemplateInfo] = Field(..., description="List of available templates")


class BGMInfo(BaseModel):
    name: str = Field(..., description="BGM filename")
    path: str = Field(..., description="Full path to BGM file")
    source: str = Field(..., description="Source (default or custom)")
    display_name_zh: Optional[str] = Field(None, description="Chinese-first BGM display name")
    description_zh: Optional[str] = Field(None, description="Chinese BGM description")
    source_label: Optional[str] = Field(None, description="Chinese source label")
    linked_style_display_name_zh: Optional[str] = Field(None, description="Chinese linked style name")
    technical_name: Optional[str] = Field(None, description="Original BGM filename for debugging")
    linked_style_id: Optional[str] = Field(None, description="Linked style id when this BGM is style-specific")
    linked_style_name: Optional[str] = Field(None, description="Linked style name when this BGM is style-specific")


class BGMListResponse(BaseModel):
    success: bool = True
    message: str = "Success"
    bgm_files: List[BGMInfo] = Field(..., description="List of available BGM files")


class StyleSummary(BaseModel):
    id: str = Field(..., description="Style id")
    name: str = Field(..., description="Style name")
    display_name_zh: Optional[str] = Field(None, description="Chinese-first style name")
    short_description_zh: Optional[str] = Field(None, description="Short Chinese style description")
    description: Optional[str] = Field(None, description="Style description")
    scene: Optional[str] = Field(None, description="Primary use-case scene")
    tone: Optional[str] = Field(None, description="Narration or visual tone")
    is_builtin: bool = Field(..., description="Whether the style is built-in")
    preview_bgm_url: Optional[str] = Field(None, description="Preview audio URL for the linked BGM")


class StyleDetail(StyleSummary):
    analysis_creative_layer: str = Field(..., description="High-level style guidance for script generation")
    audio_sync_creative_layer: str = Field(..., description="Style guidance for narration refinement")
    reference_config: dict[str, Any] = Field(default_factory=dict, description="Imported reference style metadata")
    runtime_config: dict[str, Any] = Field(default_factory=dict, description="Normalized runtime config used by Pixelle")


class StyleListResponse(BaseModel):
    success: bool = True
    message: str = "Success"
    styles: List[StyleSummary] = Field(default_factory=list, description="List of available styles")


class StyleUpsertRequest(BaseModel):
    id: str = Field(..., description="Style id")
    name: str = Field(..., description="Style name")
    description: Optional[str] = Field(None, description="Style description")
    scene: Optional[str] = Field(None, description="Primary use-case scene")
    tone: Optional[str] = Field(None, description="Narration or visual tone")
    analysis_creative_layer: str = Field("", description="High-level style guidance for script generation")
    audio_sync_creative_layer: str = Field("", description="Style guidance for narration refinement")
    reference_config: dict[str, Any] = Field(default_factory=dict, description="Imported reference style metadata")
    runtime_config: dict[str, Any] = Field(default_factory=dict, description="Normalized runtime config used by Pixelle")


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


class PresetUpsertRequest(BaseModel):
    name: str = Field(..., description="Preset name")
    description: Optional[str] = Field(None, description="Preset description")
    pipeline: str = Field(..., description="Preset scope or pipeline")
    payload_template: dict[str, Any] = Field(default_factory=dict, description="Preset payload template")


class WorkflowUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
