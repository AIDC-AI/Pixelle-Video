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
from typing import Any, Awaitable, Callable

from fastapi import APIRouter, HTTPException, Request
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.routers._helpers import path_to_url
from api.schemas.pipeline_payloads import (
    ActionTransferAsyncRequest,
    CustomAsyncRequest,
    DigitalHumanAsyncRequest,
    I2VAsyncRequest,
)
from api.schemas.video import (
    VideoGenerateAsyncResponse,
    VideoGenerateRequest,
    VideoGenerateResponse,
)
from api.tasks import TaskType, task_manager
from pixelle_video.pipelines import action_transfer, asset_based, digital_human, i2v, standard

router = APIRouter(prefix="/video", tags=["Video Generation"])

PipelineRunner = Callable[[str], Awaitable[Any]]


def _build_standard_video_params(request_body: VideoGenerateRequest) -> dict[str, Any]:
    if not request_body.frame_template:
        raise ValueError("frame_template is required to determine media size")

    if os.getenv("COMFY_MOCK") == "1":
        media_width, media_height = 1024, 1024
        logger.debug("COMFY_MOCK enabled, skipping template media size inspection")
    else:
        from pixelle_video.services.frame_html import HTMLFrameGenerator
        from pixelle_video.utils.template_util import resolve_template_path

        template_path = resolve_template_path(request_body.frame_template)
        generator = HTMLFrameGenerator(template_path)
        media_width, media_height = generator.get_media_size()
        logger.debug(f"Auto-determined media size from template: {media_width}x{media_height}")

    video_params: dict[str, Any] = {
        "text": request_body.text,
        "mode": request_body.mode,
        "title": request_body.title,
        "project_id": request_body.project_id,
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
    if request_body.tts_workflow:
        video_params["tts_workflow"] = request_body.tts_workflow
    if request_body.ref_audio:
        video_params["ref_audio"] = request_body.ref_audio
    if request_body.voice_id:
        logger.warning("voice_id parameter is deprecated, please use tts_workflow instead")
        video_params["voice_id"] = request_body.voice_id
    if request_body.template_params:
        video_params["template_params"] = request_body.template_params
    return video_params


def _build_task_result(request: Request, result: Any) -> dict[str, Any]:
    file_size = os.path.getsize(result.video_path) if os.path.exists(result.video_path) else 0
    return {
        "video_url": path_to_url(request, result.video_path),
        "video_path": result.video_path,
        "duration": result.duration,
        "file_size": file_size,
    }


async def _schedule_pipeline_task(
    *,
    request: Request,
    request_params: dict[str, Any],
    project_id: str | None,
    runner: PipelineRunner,
) -> VideoGenerateAsyncResponse:
    task = task_manager.create_task(
        task_type=TaskType.VIDEO_GENERATION,
        request_params=request_params,
        project_id=project_id,
    )

    async def execute_pipeline() -> dict[str, Any]:
        result = await runner(task.task_id)
        return _build_task_result(request, result)

    await task_manager.execute_task(task_id=task.task_id, coro_func=execute_pipeline)
    return VideoGenerateAsyncResponse(task_id=task.task_id)


@router.post("/generate/sync", response_model=VideoGenerateResponse)
async def generate_video_sync(
    request_body: VideoGenerateRequest,
    pixelle_video: PixelleVideoDep,
    request: Request
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
        video_params = _build_standard_video_params(request_body)
        result = await standard.run(pixelle_video, **video_params)
        payload = _build_task_result(request, result)
        
        return VideoGenerateResponse(
            video_url=payload["video_url"],
            duration=payload["duration"],
            file_size=payload["file_size"],
        )
        
    except Exception as e:
        logger.error(f"Sync video generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/async", response_model=VideoGenerateAsyncResponse)
async def generate_video_async(
    request_body: VideoGenerateRequest,
    pixelle_video: PixelleVideoDep,
    request: Request
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
        video_params = _build_standard_video_params(request_body)
        return await _schedule_pipeline_task(
            request=request,
            request_params=request_body.model_dump(),
            project_id=request_body.project_id,
            runner=lambda task_id: standard.run(pixelle_video, task_id_override=task_id, **video_params),
        )
    except Exception as e:
        logger.error(f"Async video generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/digital-human/async", response_model=VideoGenerateAsyncResponse)
async def generate_digital_human_async(
    request_body: DigitalHumanAsyncRequest,
    pixelle_video: PixelleVideoDep,
    request: Request,
):
    try:
        logger.info("Async digital human generation request received")
        return await _schedule_pipeline_task(
            request=request,
            request_params=request_body.model_dump(),
            project_id=request_body.project_id,
            runner=lambda task_id: digital_human.run(
                pixelle_video,
                task_id_override=task_id,
                **request_body.model_dump(),
            ),
        )
    except Exception as exc:
        logger.error(f"Async digital human generation error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/i2v/async", response_model=VideoGenerateAsyncResponse)
async def generate_i2v_async(
    request_body: I2VAsyncRequest,
    pixelle_video: PixelleVideoDep,
    request: Request,
):
    try:
        logger.info("Async i2v generation request received")
        return await _schedule_pipeline_task(
            request=request,
            request_params=request_body.model_dump(),
            project_id=request_body.project_id,
            runner=lambda task_id: i2v.run(pixelle_video, task_id_override=task_id, **request_body.model_dump()),
        )
    except Exception as exc:
        logger.error(f"Async i2v generation error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/action-transfer/async", response_model=VideoGenerateAsyncResponse)
async def generate_action_transfer_async(
    request_body: ActionTransferAsyncRequest,
    pixelle_video: PixelleVideoDep,
    request: Request,
):
    try:
        logger.info("Async action transfer generation request received")
        return await _schedule_pipeline_task(
            request=request,
            request_params=request_body.model_dump(),
            project_id=request_body.project_id,
            runner=lambda task_id: action_transfer.run(
                pixelle_video,
                task_id_override=task_id,
                **request_body.model_dump(),
            ),
        )
    except Exception as exc:
        logger.error(f"Async action transfer generation error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/custom/async", response_model=VideoGenerateAsyncResponse)
async def generate_custom_async(
    request_body: CustomAsyncRequest,
    pixelle_video: PixelleVideoDep,
    request: Request,
):
    try:
        logger.info("Async custom asset pipeline generation request received")
        return await _schedule_pipeline_task(
            request=request,
            request_params=request_body.model_dump(),
            project_id=request_body.project_id,
            runner=lambda task_id: asset_based.run(
                pixelle_video,
                task_id_override=task_id,
                **request_body.model_dump(),
            ),
        )
    except Exception as exc:
        logger.error(f"Async custom generation error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
