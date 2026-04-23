from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class MediaGenerateRequest(BaseModel):
    prompt: str = Field(..., description="Media generation prompt")
    media_type: Literal["image", "video"] = Field(..., description="Requested media type")
    workflow: Optional[str] = Field(None, description="Workflow key or filename override")
    width: Optional[int] = Field(None, ge=256, le=4096, description="Media width")
    height: Optional[int] = Field(None, ge=256, le=4096, description="Media height")
    duration: Optional[float] = Field(None, ge=0.1, le=30.0, description="Preview duration in seconds")
    negative_prompt: Optional[str] = Field(None, description="Negative prompt")
    steps: Optional[int] = Field(None, ge=1, le=200, description="Sampler steps")
    seed: Optional[int] = Field(None, description="Random seed")
    cfg: Optional[float] = Field(None, ge=0.0, le=50.0, description="CFG scale")
    sampler: Optional[str] = Field(None, description="Sampler name")


class MediaGenerateResponse(BaseModel):
    success: bool = True
    message: str = "Success"
    media_type: Literal["image", "video"] = Field(..., description="Generated media type")
    file_url: str = Field(..., description="Accessible media URL")
    file_path: str = Field(..., description="Stored path or upstream URL")
    duration: Optional[float] = Field(None, description="Duration in seconds for video previews")
    file_size: Optional[int] = Field(None, description="File size in bytes when available")
