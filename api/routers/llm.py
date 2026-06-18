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
LLM (Large Language Model) endpoints
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from api.auth.dependencies import require_capability
from api.auth.policy import LLM_CHAT
from api.dependencies import PixelleVideoDep
from api.schemas.llm import LLMChatRequest, LLMChatResponse

router = APIRouter(prefix="/llm", tags=["Basic Services"])

LlmGuard = Annotated[None, Depends(require_capability(LLM_CHAT))]


@router.post("/chat", response_model=LLMChatResponse)
async def llm_chat(
    request: LLMChatRequest,
    pixelle_video: PixelleVideoDep,
    _guard: LlmGuard,
):
    """
    LLM chat endpoint
    
    Generate text response using configured LLM.
    
    - **prompt**: User prompt/question
    - **temperature**: Creativity level (0.0-2.0, lower = more deterministic)
    - **max_tokens**: Maximum response length
    
    Returns generated text response.
    """
    try:
        logger.info(f"LLM chat request: {request.prompt[:50]}...")
        
        # Call LLM service
        response = await pixelle_video.llm(
            prompt=request.prompt,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        
        return LLMChatResponse(
            content=response,
            tokens_used=None  # Can add token counting if needed
        )
        
    except Exception as e:
        logger.error(f"LLM chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

