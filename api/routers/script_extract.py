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
Script extraction endpoints

Extract scripts from video URLs using LLM multimodal capabilities.
"""

from fastapi import APIRouter, HTTPException
from loguru import logger

from api.schemas.script_extract import (
    ScriptExtractRequest,
    ScriptExtractResponse,
)
from pixelle_video.services.script_extractor import ScriptExtractorService

router = APIRouter(prefix="/script", tags=["Script Extraction"])

_extractor = ScriptExtractorService()


@router.post("/extract", response_model=ScriptExtractResponse)
async def extract_script(request: ScriptExtractRequest):
    """
    Extract script from a video URL using LLM.
    
    Sends the video URL directly to a multimodal LLM for analysis.
    Requires a model that supports video input (Qwen-VL, Gemini, GPT-4o, etc.)
    """
    try:
        logger.info(f"Script extraction requested for: {request.url}")
        script = await _extractor.extract_script(url=request.url)
        
        return ScriptExtractResponse(
            script=script,
            url=request.url,
        )
    except Exception as e:
        logger.error(f"Script extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
