from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.routers._helpers import path_to_url
from api.schemas.media import MediaGenerateRequest, MediaGenerateResponse

router = APIRouter(prefix="/media", tags=["Basic Services"])


def _file_url(request: Request, file_path: str) -> str:
    if file_path.startswith(("http://", "https://")):
        return file_path
    return path_to_url(request, file_path)


def _file_size(file_path: str) -> int | None:
    if file_path.startswith(("http://", "https://")):
        return None
    candidate = Path(file_path)
    if not candidate.is_absolute():
        candidate = Path.cwd() / file_path
    if not candidate.exists() or not candidate.is_file():
        return None
    return os.path.getsize(candidate)


@router.post("/generate", response_model=MediaGenerateResponse)
async def media_generate(
    request_body: MediaGenerateRequest,
    pixelle_video: PixelleVideoDep,
    request: Request,
):
    """Generate an image or short video preview using the shared media service."""
    try:
        if pixelle_video.media is None:
            raise RuntimeError("Media service is not initialized")

        media_result = await pixelle_video.media(
            prompt=request_body.prompt,
            workflow=request_body.workflow,
            media_type=request_body.media_type,
            width=request_body.width,
            height=request_body.height,
            duration=request_body.duration,
            negative_prompt=request_body.negative_prompt,
            steps=request_body.steps,
            seed=request_body.seed,
            cfg=request_body.cfg,
            sampler=request_body.sampler,
        )

        return MediaGenerateResponse(
            media_type=media_result.media_type,
            file_url=_file_url(request, media_result.url),
            file_path=media_result.url,
            duration=media_result.duration,
            file_size=_file_size(media_result.url),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Media generation error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
