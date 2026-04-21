# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Task data models
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """Task status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskType(str, Enum):
    """Task type"""
    VIDEO_GENERATION = "video_generation"


class TaskProgress(BaseModel):
    """Task progress information"""
    current: int = 0
    total: int = 0
    percentage: float = 0.0
    message: str = ""


class Task(BaseModel):
    """Task model"""
    task_id: str
    task_type: TaskType
    project_id: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    
    # Progress tracking
    progress: Optional[TaskProgress] = None
    
    # Result
    result: Optional[Any] = None
    error: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Request parameters (for reference)
    request_params: Optional[dict] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
