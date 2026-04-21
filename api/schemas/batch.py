from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional, Union

from pydantic import BaseModel, Field

from api.schemas.pipeline_payloads import (
    ActionTransferAsyncRequest,
    CustomAsyncRequest,
    DigitalHumanAsyncRequest,
    I2VAsyncRequest,
)
from api.schemas.video import VideoGenerateRequest
from api.tasks.models import Task


class BatchPipeline(str, Enum):
    STANDARD = "standard"
    DIGITAL_HUMAN = "digital_human"
    I2V = "i2v"
    ACTION_TRANSFER = "action_transfer"
    ASSET_BASED = "asset_based"


class BatchStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PARTIAL = "partial"


BatchRowPayload = Union[
    VideoGenerateRequest,
    DigitalHumanAsyncRequest,
    I2VAsyncRequest,
    ActionTransferAsyncRequest,
    CustomAsyncRequest,
]


class BatchBase(BaseModel):
    id: str = Field(..., description="Batch ID")
    name: Optional[str] = Field(None, description="Batch name")
    pipeline: BatchPipeline = Field(..., description="Pipeline name")
    project_id: Optional[str] = Field(None, description="Linked project ID")
    status: BatchStatus = Field(..., description="Batch status")
    total: int = Field(0, description="Total number of child tasks")
    succeeded: int = Field(0, description="Completed child tasks")
    failed: int = Field(0, description="Failed child tasks")
    cancelled: int = Field(0, description="Cancelled child tasks")
    created_at: datetime = Field(..., description="Creation time")
    updated_at: datetime = Field(..., description="Last update time")
    cover_url: Optional[str] = Field(None, description="Representative cover URL")
    deleted_at: Optional[datetime] = Field(None, description="Soft delete timestamp")


class Batch(BatchBase):
    task_ids: List[str] = Field(default_factory=list, description="Child task IDs")


class BatchCreateRequest(BaseModel):
    pipeline: BatchPipeline = Field(..., description="Pipeline to fan out over all rows")
    rows: List[BatchRowPayload] = Field(..., min_length=1, description="Pipeline-specific request rows")
    project_id: Optional[str] = Field(None, description="Shared project ID applied to rows")
    name: Optional[str] = Field(None, description="Batch display name")


class BatchCreateResponse(BaseModel):
    batch_id: str = Field(..., description="Created batch ID")
    task_ids: List[str] = Field(default_factory=list, description="Created child task IDs")


class BatchListResponse(BaseModel):
    items: List[Batch] = Field(default_factory=list, description="Batches")
    next_cursor: Optional[str] = Field(None, description="Pagination cursor")


class BatchDetailResponse(Batch):
    children: List[Task] = Field(default_factory=list, description="Child tasks")
