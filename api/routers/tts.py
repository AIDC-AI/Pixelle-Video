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
TTS (Text-to-Speech) endpoints
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from api.auth.dependencies import require_capability
from api.auth.policy import TTS_SYNTHESIZE
from api.dependencies import PixelleVideoDep
from api.schemas.tts import TTSSynthesizeRequest, TTSSynthesizeResponse
from pixelle_video.utils.tts_util import get_audio_duration

router = APIRouter(prefix="/tts", tags=["Basic Services"])

TtsGuard = Annotated[None, Depends(require_capability(TTS_SYNTHESIZE))]


@router.post("/synthesize", response_model=TTSSynthesizeResponse)
async def tts_synthesize(
    request: TTSSynthesizeRequest,
    pixelle_video: PixelleVideoDep,
    _guard: TtsGuard,
):
    """
    Text-to-Speech synthesis endpoint
    
    Convert text to speech audio using ComfyUI workflows.
    
    - **text**: Text to synthesize
    - **workflow**: TTS workflow key (optional, uses default if not specified)
    - **ref_audio**: Reference audio for voice cloning (optional)
    - **voice_id**: (Deprecated) Voice ID for legacy compatibility
    
    Returns path to generated audio file and duration.
    
    Examples:
    ```json
    {
        "text": "Hello, welcome to Pixelle-Video!",
        "workflow": "runninghub/tts_edge.json"
    }
    ```
    
    With voice cloning:
    ```json
    {
        "text": "Hello, this is a cloned voice",
        "workflow": "runninghub/tts_index2.json",
        "ref_audio": "path/to/reference.wav"
    }
    ```
    """
    try:
        logger.info(f"TTS synthesis request: {request.text[:50]}...")
        
        # Build TTS parameters
        tts_params = {"text": request.text}
        
        # Add workflow if specified
        if request.workflow:
            tts_params["workflow"] = request.workflow
        
        # Add ref_audio if specified
        if request.ref_audio:
            tts_params["ref_audio"] = request.ref_audio
        
        # Legacy voice_id support (deprecated)
        if request.voice_id and not request.workflow:
            logger.warning("voice_id parameter is deprecated, please use workflow instead")
            tts_params["voice"] = request.voice_id
        
        # Call TTS service
        audio_path = await pixelle_video.tts(**tts_params)
        
        # Get audio duration
        duration = get_audio_duration(audio_path)
        
        return TTSSynthesizeResponse(
            audio_path=audio_path,
            duration=duration
        )
        
    except Exception as e:
        logger.error(f"TTS synthesis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

