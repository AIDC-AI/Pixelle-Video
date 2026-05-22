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
LLM API schemas
"""

from typing import Optional
from pydantic import BaseModel, Field

from api.schemas.base import SuccessResponse


class LLMChatRequest(BaseModel):
    """LLM chat request"""
    prompt: str = Field(..., description="User prompt")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="Temperature (0.0-2.0)")
    max_tokens: int = Field(2000, ge=1, le=32000, description="Maximum tokens")
    
    class Config:
        json_schema_extra = {
            "example": {
                "prompt": "Explain the concept of atomic habits in 3 sentences",
                "temperature": 0.7,
                "max_tokens": 2000
            }
        }


class LLMChatResponse(SuccessResponse):
    """LLM chat response"""
    content: str = Field(..., description="Generated response")
    tokens_used: Optional[int] = Field(None, description="Tokens used (if available)")
