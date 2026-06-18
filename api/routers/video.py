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
Video generation endpoints

Supports both synchronous and asynchronous video generation.
"""

import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger

from api.auth.dependencies import require_capability
from api.auth.policy import VIDEO_GENERATE
from api.dependencies import PixelleVideoDep
from api.schemas.video import (
    VideoGenerateRequest,
    VideoGenerateResponse,
    VideoGenerateAsyncResponse,
)
from api.tasks import task_manager, TaskType


# Map pipeline ProgressEvent event_type to a user-facing label.
_EVENT_LABELS: dict[str, str] = {
    "generating_narrations": "Generating narrations via LLM…",
    "splitting_script": "Splitting script into segments…",
    "generating_title": "Generating video title…",
    "generating_image_prompts": "Generating image prompts…",
    "processing_frame": "Rendering frame {frame_current}/{frame_total}…",
    "concatenating": "Composing final video…",
    "completed": "Done",
}


def _progress_message(event) -> str:
    """Derive a user-facing progress label from a pipeline ProgressEvent."""
    label = _EVENT_LABELS.get(event.event_type, event.event_type)
    if event.event_type == "processing_frame" and event.frame_current is not None:
        return f"Rendering frame {event.frame_current}/{event.frame_total}…"
    if event.action:
        return f"{label} ({event.action})"
    if event.extra_info:
        return f"{label} {event.extra_info}"
    return label


def _make_progress_bridge(task_id: str):
    """Return a sync progress callback that forwards a pipeline event to
    `task_manager.update_progress`. Wrapping the lambda in a named
    helper keeps the call site clean and gives us a stable place to add
    logging / metrics in the future."""

    def _on_progress(event) -> None:
        logger.debug(
            f"pipeline progress event_type={event.event_type} "
            f"progress={event.progress:.3f} message={getattr(event, 'message', '')}"
        )
        task_manager.update_progress(
            task_id=task_id,
            current=int(event.progress * 100),
            total=100,
            message=_progress_message(event),
        )

    return _on_progress


router = APIRouter(prefix="/video", tags=["Video Generation"])

VideoGuard = Annotated[None, Depends(require_capability(VIDEO_GENERATE))]


def path_to_url(request: Request, file_path: str) -> str:
    """
    Convert file path to accessible URL
    
    Handles both absolute and relative paths, extracting the path relative
    to the output directory for URL construction.
    
    Args:
        request: FastAPI Request object (provides base_url from actual request)
        file_path: Absolute or relative file path
    
    Returns:
        Full URL to access the file
    
    Examples:
        Windows: G:\\...\\output\\20251205_233630_c939\\final.mp4
              -> http://localhost:8001/api/files/20251205_233630_c939/final.mp4
        
        Linux:   /home/user/.../output/20251205_233630_c939/final.mp4
              -> http://localhost:8001/api/files/20251205_233630_c939/final.mp4
        
        Domain:  With domain request -> https://your-domain.com/api/files/...
    """
    from pathlib import Path
    import os
    
    # Normalize path separators to forward slashes first (for cross-platform compatibility)
    file_path = file_path.replace("\\", "/")
    
    # Check if it's an absolute path (works for both Windows and Linux)
    is_absolute = os.path.isabs(file_path) or Path(file_path).is_absolute()
    
    if is_absolute:
        # Find "output" in the path and get everything after it
        # Split by / to work with normalized paths
        parts = file_path.split("/")
        try:
            output_idx = parts.index("output")
            # Get all parts after "output" and join them
            relative_parts = parts[output_idx + 1:]
            file_path = "/".join(relative_parts)
        except ValueError:
            # If "output" not in path, use the filename only
            file_path = Path(file_path).name
    else:
        # If relative path starting with "output/", remove it
        if file_path.startswith("output/"):
            file_path = file_path[7:]  # Remove "output/"
    
    # Build URL using request's base_url (automatically matches the request host)
    base_url = str(request.base_url).rstrip('/')
    return f"{base_url}/api/files/{file_path}"


@router.post("/generate/sync", response_model=VideoGenerateResponse)
async def generate_video_sync(
    request_body: VideoGenerateRequest,
    pixelle_video: PixelleVideoDep,
    request: Request,
    _guard: VideoGuard,
):
    """
    Generate video synchronously
    
    This endpoint blocks until video generation is complete.
    Suitable for small videos (< 30 seconds).
    
    **Note**: May timeout for large videos. Use `/generate/async` instead.
    
    Request body includes all video generation parameters.
    See VideoGenerateRequest schema for details.
    
    Returns path to generated video, duration, and file size.
    """
    try:
        logger.info(f"Sync video generation: {request_body.text[:50]}...")
        
        # Auto-determine media_width and media_height from template meta tags (required)
        if not request_body.frame_template:
            raise ValueError("frame_template is required to determine media size")
        
        from pixelle_video.services.frame_html import HTMLFrameGenerator
        from pixelle_video.utils.template_util import resolve_template_path
        template_path = resolve_template_path(request_body.frame_template)
        generator = HTMLFrameGenerator(template_path)
        media_width, media_height = generator.get_media_size()
        logger.debug(f"Auto-determined media size from template: {media_width}x{media_height}")
        
        # Build video generation parameters
        video_params = {
            "text": request_body.text,
            "mode": request_body.mode,
            "title": request_body.title,
            "n_scenes": request_body.n_scenes,
            "min_narration_words": request_body.min_narration_words,
            "max_narration_words": request_body.max_narration_words,
            "min_image_prompt_words": request_body.min_image_prompt_words,
            "max_image_prompt_words": request_body.max_image_prompt_words,
            "media_width": media_width,
            "media_height": media_height,
            "media_workflow": request_body.media_workflow,
            "video_fps": request_body.video_fps,
            "frame_template": request_body.frame_template,
            "prompt_prefix": request_body.prompt_prefix,
            "bgm_path": request_body.bgm_path,
            "bgm_volume": request_body.bgm_volume,
        }
        
        # Add TTS workflow if specified
        if request_body.tts_workflow:
            video_params["tts_workflow"] = request_body.tts_workflow
        
        # Add ref_audio if specified
        if request_body.ref_audio:
            video_params["ref_audio"] = request_body.ref_audio
        
        # Legacy voice_id support (deprecated)
        if request_body.voice_id:
            logger.warning("voice_id parameter is deprecated, please use tts_workflow instead")
            video_params["voice_id"] = request_body.voice_id
        
        # Add custom template parameters if specified
        if request_body.template_params:
            video_params["template_params"] = request_body.template_params
        
        # Call video generator service
        result = await pixelle_video.generate_video(**video_params)
        
        # Get file size
        file_size = os.path.getsize(result.video_path) if os.path.exists(result.video_path) else 0
        
        # Convert path to URL
        video_url = path_to_url(request, result.video_path)
        
        return VideoGenerateResponse(
            video_url=video_url,
            duration=result.duration,
            file_size=file_size
        )
        
    except Exception as e:
        logger.error(f"Sync video generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/async", response_model=VideoGenerateAsyncResponse)
async def generate_video_async(
    request_body: VideoGenerateRequest,
    pixelle_video: PixelleVideoDep,
    request: Request,
    _guard: VideoGuard,
):
    """
    Generate video asynchronously
    
    Creates a background task for video generation.
    Returns immediately with a task_id for tracking progress.
    
    **Workflow:**
    1. Submit video generation request
    2. Receive task_id in response
    3. Poll `/api/tasks/{task_id}` to check status
    4. When status is "completed", retrieve video from result
    
    Request body includes all video generation parameters.
    See VideoGenerateRequest schema for details.
    
    Returns task_id for tracking progress.
    """
    try:
        logger.info(f"Async video generation: {request_body.text[:50]}...")
        
        # Create task
        task = task_manager.create_task(
            task_type=TaskType.VIDEO_GENERATION,
            request_params=request_body.model_dump()
        )
        
        # Define async execution function
        async def execute_video_generation():
            """Execute video generation in background"""
            # Auto-determine media_width and media_height from template meta tags (required)
            if not request_body.frame_template:
                raise ValueError("frame_template is required to determine media size")
            
            from pixelle_video.services.frame_html import HTMLFrameGenerator
            from pixelle_video.utils.template_util import resolve_template_path
            template_path = resolve_template_path(request_body.frame_template)
            generator = HTMLFrameGenerator(template_path)
            media_width, media_height = generator.get_media_size()
            logger.debug(f"Auto-determined media size from template: {media_width}x{media_height}")
            
            # Build video generation parameters
            video_params = {
                "text": request_body.text,
                "mode": request_body.mode,
                "title": request_body.title,
                "n_scenes": request_body.n_scenes,
                "min_narration_words": request_body.min_narration_words,
                "max_narration_words": request_body.max_narration_words,
                "min_image_prompt_words": request_body.min_image_prompt_words,
                "max_image_prompt_words": request_body.max_image_prompt_words,
                "media_width": media_width,
                "media_height": media_height,
                "media_workflow": request_body.media_workflow,
                "video_fps": request_body.video_fps,
                "frame_template": request_body.frame_template,
                "prompt_prefix": request_body.prompt_prefix,
                "bgm_path": request_body.bgm_path,
                "bgm_volume": request_body.bgm_volume,
                # Bridge pipeline progress events -> task manager -> SSE stream
                "progress_callback": _make_progress_bridge(task.task_id),
            }
            
            # Add TTS workflow if specified
            if request_body.tts_workflow:
                video_params["tts_workflow"] = request_body.tts_workflow
            
            # Add ref_audio if specified
            if request_body.ref_audio:
                video_params["ref_audio"] = request_body.ref_audio
            
            # Legacy voice_id support (deprecated)
            if request_body.voice_id:
                logger.warning("voice_id parameter is deprecated, please use tts_workflow instead")
                video_params["voice_id"] = request_body.voice_id
            
            # Add custom template parameters if specified
            if request_body.template_params:
                video_params["template_params"] = request_body.template_params
            
            result = await pixelle_video.generate_video(**video_params)
            
            # Get file size
            file_size = os.path.getsize(result.video_path) if os.path.exists(result.video_path) else 0
            
            # Convert path to URL
            video_url = path_to_url(request, result.video_path)
            
            return {
                "video_url": video_url,
                "duration": result.duration,
                "file_size": file_size
            }
        
        # Start execution
        await task_manager.execute_task(
            task_id=task.task_id,
            coro_func=execute_video_generation
        )
        
        return VideoGenerateAsyncResponse(
            task_id=task.task_id
        )
        
    except Exception as e:
        logger.error(f"Async video generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

