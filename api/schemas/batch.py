# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Batch API schemas
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class BatchRow(BaseModel):
    value: str = Field(..., description="Row content")


class Batch(BaseModel):
    id: str = Field(..., description="Batch ID")
    pipeline: str = Field(..., description="Pipeline name")
    rows: List[BatchRow] = Field(default_factory=list, description="Batch rows")
    created_at: Optional[datetime] = Field(None, description="Creation time")
    updated_at: Optional[datetime] = Field(None, description="Update time")
    project_id: Optional[str] = Field(None, description="Linked project ID")


class BatchCreateRequest(BaseModel):
    pipeline: str = Field(..., description="Pipeline name")
    rows: List[BatchRow] = Field(default_factory=list, description="Rows")
    project_id: Optional[str] = Field(None, description="Project ID")


class BatchListResponse(BaseModel):
    items: List[Batch] = Field(default_factory=list, description="Batches")

