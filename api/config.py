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
API Configuration
"""

from typing import Optional
from pydantic import BaseModel


class APIConfig(BaseModel):
    """API configuration"""
    
    # Server settings
    # (host/port/reload come from argparse in api/app.py; max_concurrent_tasks
    #  and max_upload_size were never enforced — removed.)

    # CORS settings
    cors_enabled: bool = True
    cors_origins: list[str] = ["*"]

    # Task settings
    task_cleanup_interval: int = 3600  # Clean completed tasks every hour
    task_retention_time: int = 86400   # Keep task results for 24 hours

    # API settings
    api_prefix: str = "/api"
    docs_url: Optional[str] = "/docs"
    redoc_url: Optional[str] = "/redoc"
    openapi_url: Optional[str] = "/openapi.json"


# Global config instance
api_config = APIConfig()

