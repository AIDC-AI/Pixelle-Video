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
Publish endpoints - distribute generated videos to social platforms
"""

from fastapi import APIRouter, HTTPException
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.schemas.publish import (
    PublishStatusResponse,
    PublishVideoRequest,
    PublishVideoResponse,
)
from pixelle_video.services.publish_service import (
    SUPPORTED_PLATFORMS,
    PublishError,
)

router = APIRouter(prefix="/publish", tags=["Publish"])


@router.get("/platforms")
async def publish_platforms(pixelle_video: PixelleVideoDep):
    """
    List supported platforms and whether publishing is configured

    Publishing is optional. It is enabled by setting `publish.enabled`,
    `publish.api_key` and `publish.user` in config.yaml.
    """
    return {
        "success": True,
        "configured": pixelle_video.publish.is_configured(),
        "platforms": list(SUPPORTED_PLATFORMS),
        "default_platforms": pixelle_video.publish.platforms,
    }


@router.post("/video", response_model=PublishVideoResponse)
async def publish_video(
    request: PublishVideoRequest,
    pixelle_video: PixelleVideoDep,
):
    """
    Publish a rendered video to one or more social platforms

    - **video_path**: Path to the rendered video file
    - **title**: Caption / title (required for YouTube and Reddit)
    - **platforms**: Target platforms (defaults to config)
    - **scheduled_date**: Optional ISO-8601 timestamp to schedule instead of publishing now

    Returns a `request_id` that can be polled with `GET /api/publish/status/{request_id}`.

    Example:
    ```json
    {
        "video_path": "output/20260101_120000/final.mp4",
        "title": "How to build better habits",
        "platforms": ["tiktok", "instagram", "youtube"]
    }
    ```
    """
    try:
        logger.info(f"Publish request: {request.video_path}")

        result = await pixelle_video.publish.upload_video(
            video_path=request.video_path,
            title=request.title,
            platforms=request.platforms,
            description=request.description,
            scheduled_date=request.scheduled_date,
            timezone=request.timezone,
            async_upload=request.async_upload,
            extra_params=request.extra_params,
        )

        return PublishVideoResponse(
            success=bool(result.get("success", True)),
            message=result.get("message", "Success"),
            request_id=result.get("request_id"),
            result=result,
        )

    except PublishError as e:
        logger.error(f"Publish error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Publish error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{request_id}", response_model=PublishStatusResponse)
async def publish_status(
    request_id: str,
    pixelle_video: PixelleVideoDep,
):
    """
    Check the status of a previous publish request

    - **request_id**: Identifier returned by `POST /api/publish/video`
    """
    try:
        result = await pixelle_video.publish.check_status(request_id)
        return PublishStatusResponse(
            success=bool(result.get("success", True)),
            message=result.get("message", "Success"),
            status=result.get("status"),
            result=result,
        )
    except PublishError as e:
        logger.error(f"Publish status error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Publish status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
