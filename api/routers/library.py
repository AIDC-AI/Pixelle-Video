from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.routers._helpers import (
    api_error,
    normalize_project_filter_query,
    not_implemented,
    path_to_url,
)
from api.schemas.library import PlaceholderListResponse, VideoItem, VideoListResponse

router = APIRouter(prefix="/library", tags=["Library"])


@router.get("/videos", response_model=VideoListResponse)
async def list_videos(
    request: Request,
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    *,
    pixelle_video: PixelleVideoDep,
):
    try:
        history = pixelle_video.history
        if history is None:
            raise RuntimeError("History manager is not initialized")

        normalized_project_id, unassigned_only = normalize_project_filter_query(project_id)
        payload = await history.list_video_items(
            project_id=normalized_project_id,
            unassigned_only=unassigned_only,
            cursor=cursor,
            limit=limit,
        )
        items = []
        for item in payload["items"]:
            video_path = item.get("video_path")
            items.append(
                VideoItem(
                    task_id=item["task_id"],
                    title=item.get("title") or item["task_id"],
                    created_at=item.get("created_at"),
                    completed_at=item.get("completed_at"),
                    duration=item.get("duration", 0.0),
                    file_size=item.get("file_size", 0),
                    n_frames=item.get("n_frames", 0),
                    video_path=video_path,
                    video_url=path_to_url(request, video_path) if video_path else None,
                    thumbnail_url=None,
                    project_id=item.get("project_id"),
                )
            )
        return VideoListResponse(items=items, next_cursor=payload.get("next_cursor"))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"List videos error: {exc}")
        raise api_error(
            status_code=500,
            code="LIBRARY_LIST_FAILED",
            message="Failed to list library videos.",
        ) from exc


@router.get("/videos/{video_id}")
async def get_video_detail(video_id: str):
    raise not_implemented(f"Library video detail for {video_id} is not implemented yet")


@router.get("/images", response_model=PlaceholderListResponse)
async def list_images(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
):
    raise not_implemented("Library images listing is not implemented yet")


@router.get("/voices", response_model=PlaceholderListResponse)
async def list_voices(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
):
    raise not_implemented("Library voices listing is not implemented yet")


@router.get("/bgm", response_model=PlaceholderListResponse)
async def list_library_bgm(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
):
    raise not_implemented("Library BGM listing is not implemented yet")


@router.get("/scripts", response_model=PlaceholderListResponse)
async def list_scripts(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
):
    raise not_implemented("Library scripts listing is not implemented yet")
