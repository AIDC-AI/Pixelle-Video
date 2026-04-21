# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Upload API schemas
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    file_url: str = Field(..., description="Accessible file URL")
    path: str = Field(..., description="Stored file path")
    filename: str = Field(..., description="Original filename")

