from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.routers._display_metadata import bgm_display_metadata, script_display_metadata, style_display_metadata
from api.routers._helpers import api_error, normalize_project_filter_query, path_to_url
from api.schemas.base import BaseResponse
from api.schemas.library import (
    ImageItem,
    ImageListResponse,
    LibraryBGMItem,
    LibraryBGMListResponse,
    ScriptItem,
    ScriptListResponse,
    VideoDetailResponse,
    VideoItem,
    VideoListResponse,
    VoiceItem,
    VoiceListResponse,
)
from pixelle_video.utils.os_util import get_data_path, get_root_path

router = APIRouter(prefix="/library", tags=["Library"])

_AUDIO_EXTENSIONS = (".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg")


def _artifact_url(request: Request, file_path: Optional[str]) -> Optional[str]:
    if not file_path:
        return None
    return path_to_url(request, file_path)


def _paginate_items(items: list[dict], cursor: Optional[str], limit: int) -> tuple[list[dict], Optional[str]]:
    offset = int(cursor or 0)
    page_items = items[offset:offset + limit]
    next_cursor = str(offset + limit) if offset + limit < len(items) else None
    return page_items, next_cursor


def _style_bgm_links(pixelle_video: PixelleVideoDep) -> dict[str, dict[str, str]]:
    registry = getattr(pixelle_video, "styles", None)
    if registry is None:
        return {}

    links: dict[str, dict[str, str]] = {}
    for style in registry.list_styles():
        bgm_name = style.get("runtime_config", {}).get("bgm")
        if not bgm_name:
            continue
        style_display = style_display_metadata(
            style.get("id"),
            style.get("name"),
            style.get("description"),
            style.get("scene"),
            style.get("tone"),
        )
        links[str(bgm_name)] = {
            "linked_style_id": style["id"],
            "linked_style_name": style["name"],
            "linked_style_display_name_zh": style_display.get("display_name_zh") or style["name"],
        }
    return links


def _builtin_bgm_items(request: Request, pixelle_video: PixelleVideoDep) -> list[dict]:
    bgm_files_dict: dict[str, dict[str, object]] = {}
    linked_styles = _style_bgm_links(pixelle_video)
    for root_dir, source, prefix in (
        (Path(get_root_path("bgm")), "builtin", "bgm"),
        (Path(get_data_path("bgm")), "history", "data/bgm"),
    ):
        if not root_dir.exists() or not root_dir.is_dir():
            continue
        for bgm_file in root_dir.iterdir():
            if not bgm_file.is_file() or bgm_file.suffix.lower() not in _AUDIO_EXTENSIONS:
                continue
            bgm_files_dict[bgm_file.name] = {
                "name": bgm_file.name,
                "audio_path": f"{prefix}/{bgm_file.name}",
                "source": source,
                "created_at": bgm_file.stat().st_mtime,
                "file_size": bgm_file.stat().st_size,
            }

    builtin_items: list[dict] = []
    for entry in bgm_files_dict.values():
        builtin_items.append(
            {
                "id": f"builtin-bgm:{entry['name']}",
                "name": entry["name"],
                "audio_path": entry["audio_path"],
                "audio_url": path_to_url(request, str(entry["audio_path"])),
                "created_at": None,
                "duration": None,
                "file_size": entry["file_size"],
                "source": entry["source"],
                "linked_style_id": linked_styles.get(str(entry["name"]), {}).get("linked_style_id"),
                "linked_style_name": linked_styles.get(str(entry["name"]), {}).get("linked_style_name"),
                "linked_style_display_name_zh": linked_styles.get(str(entry["name"]), {}).get("linked_style_display_name_zh"),
                "project_id": None,
                "batch_id": None,
            }
        )
    return builtin_items


def _library_bgm_item_from_payload(request: Request, item: dict[str, object]) -> LibraryBGMItem:
    display = bgm_display_metadata(
        name=item.get("name") or Path(str(item["audio_path"])).name,
        source=str(item.get("source", "history")),
        linked_style_id=item.get("linked_style_id"),
        linked_style_name=item.get("linked_style_display_name_zh") or item.get("linked_style_name"),
    )
    return LibraryBGMItem(
        id=str(item["id"]),
        name=str(item.get("name") or Path(str(item["audio_path"])).name),
        audio_path=str(item["audio_path"]),
        audio_url=item.get("audio_url") or _artifact_url(request, str(item.get("audio_path"))),
        created_at=item.get("created_at"),
        duration=item.get("duration"),
        file_size=int(item.get("file_size", 0) or 0),
        source=str(item.get("source", "history")),
        display_name_zh=display.get("display_name_zh"),
        description_zh=display.get("description_zh"),
        source_label=display.get("source_label"),
        linked_style_display_name_zh=display.get("linked_style_display_name_zh"),
        technical_name=display.get("technical_name"),
        linked_style_id=item.get("linked_style_id"),
        linked_style_name=item.get("linked_style_name"),
        project_id=item.get("project_id"),
        batch_id=item.get("batch_id"),
    )


def _script_item_from_payload(item: dict[str, object]) -> ScriptItem:
    display = script_display_metadata(
        item.get("script_type", "script"),
        item.get("pipeline"),
    )
    return ScriptItem(
        id=str(item["id"]),
        task_id=item.get("task_id"),
        created_at=item.get("created_at"),
        project_id=item.get("project_id"),
        batch_id=item.get("batch_id"),
        pipeline=item.get("pipeline"),
        text=str(item["text"]),
        script_type=str(item.get("script_type", "script")),
        prompt_used=item.get("prompt_used"),
        type_label_zh=display.get("type_label_zh"),
        pipeline_label_zh=display.get("pipeline_label_zh"),
        summary_zh=display.get("summary_zh"),
    )


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
        items = [
            VideoItem(
                task_id=item["task_id"],
                title=item.get("title") or item["task_id"],
                created_at=item.get("created_at"),
                completed_at=item.get("completed_at"),
                duration=item.get("duration", 0.0),
                file_size=item.get("file_size", 0),
                n_frames=item.get("n_frames", 0),
                video_path=item.get("video_path"),
                video_url=_artifact_url(request, item.get("video_path")),
                thumbnail_url=None,
                project_id=item.get("project_id"),
                batch_id=item.get("batch_id"),
                pipeline=item.get("pipeline"),
            )
            for item in payload["items"]
        ]
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


@router.get("/videos/{video_id}", response_model=VideoDetailResponse)
async def get_video_detail(
    video_id: str,
    request: Request,
    *,
    pixelle_video: PixelleVideoDep,
):
    try:
        history = pixelle_video.history
        if history is None:
            raise RuntimeError("History manager is not initialized")

        payload = await history.get_video_item(video_id)
        if payload is None:
            raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

        return VideoDetailResponse(
            task_id=payload["task_id"],
            title=payload.get("title") or payload["task_id"],
            created_at=payload.get("created_at"),
            completed_at=payload.get("completed_at"),
            duration=payload.get("duration", 0.0),
            file_size=payload.get("file_size", 0),
            n_frames=payload.get("n_frames", 0),
            video_path=payload.get("video_path"),
            video_url=_artifact_url(request, payload.get("video_path")),
            thumbnail_url=None,
            project_id=payload.get("project_id"),
            batch_id=payload.get("batch_id"),
            pipeline=payload.get("pipeline"),
            audio_duration=payload.get("audio_duration"),
            metadata=payload.get("metadata", {}),
            snapshot=payload.get("metadata", {}),
            storyboard=payload.get("storyboard"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Get video detail error: {exc}")
        raise api_error(
            status_code=500,
            code="LIBRARY_FETCH_FAILED",
            message="Failed to fetch library video detail.",
        ) from exc


@router.delete("/videos/{video_id}", response_model=BaseResponse)
async def delete_video(
    video_id: str,
    *,
    pixelle_video: PixelleVideoDep,
):
    try:
        history = pixelle_video.history
        if history is None:
            raise RuntimeError("History manager is not initialized")

        payload = await history.get_video_item(video_id)
        if payload is None:
            raise api_error(
                status_code=404,
                code="LIBRARY_VIDEO_NOT_FOUND",
                message="Video not found.",
            )

        if payload.get("status") not in {"completed", "failed", "cancelled"}:
            raise api_error(
                status_code=409,
                code="LIBRARY_VIDEO_DELETE_NOT_ALLOWED",
                message="Only completed, failed, or cancelled videos can be deleted.",
            )

        deleted = await history.delete_task(video_id)
        if not deleted:
            raise api_error(
                status_code=500,
                code="LIBRARY_VIDEO_DELETE_FAILED",
                message="Failed to delete the video history entry.",
            )
        return BaseResponse(message="Video deleted.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Delete video error: {exc}")
        raise api_error(
            status_code=500,
            code="LIBRARY_VIDEO_DELETE_FAILED",
            message="Failed to delete the video history entry.",
        ) from exc


@router.get("/images", response_model=ImageListResponse)
async def list_images(
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
        payload = await history.list_library_items(
            kind="image",
            project_id=normalized_project_id,
            unassigned_only=unassigned_only,
            cursor=cursor,
            limit=limit,
        )
        return ImageListResponse(
            items=[
                ImageItem(
                    id=item["id"],
                    task_id=item.get("task_id"),
                    image_path=item["image_path"],
                    image_url=_artifact_url(request, item.get("image_path")),
                    thumbnail_url=_artifact_url(request, item.get("image_path")),
                    created_at=item.get("created_at"),
                    file_size=item.get("file_size", 0),
                    prompt_used=item.get("prompt_used"),
                    project_id=item.get("project_id"),
                    batch_id=item.get("batch_id"),
                )
                for item in payload["items"]
                if item.get("image_path")
            ],
            next_cursor=payload.get("next_cursor"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"List images error: {exc}")
        raise api_error(
            status_code=500,
            code="LIBRARY_IMAGES_FAILED",
            message="Failed to list library images.",
        ) from exc


@router.get("/voices", response_model=VoiceListResponse)
async def list_voices(
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
        payload = await history.list_library_items(
            kind="voice",
            project_id=normalized_project_id,
            unassigned_only=unassigned_only,
            cursor=cursor,
            limit=limit,
        )
        return VoiceListResponse(
            items=[
                VoiceItem(
                    id=item["id"],
                    task_id=item.get("task_id"),
                    audio_path=item["audio_path"],
                    audio_url=_artifact_url(request, item.get("audio_path")),
                    created_at=item.get("created_at"),
                    duration=item.get("duration", 0.0),
                    tts_voice=item.get("tts_voice"),
                    text=item.get("text"),
                    file_size=item.get("file_size", 0),
                    project_id=item.get("project_id"),
                    batch_id=item.get("batch_id"),
                )
                for item in payload["items"]
                if item.get("audio_path")
            ],
            next_cursor=payload.get("next_cursor"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"List voices error: {exc}")
        raise api_error(
            status_code=500,
            code="LIBRARY_VOICES_FAILED",
            message="Failed to list library voices.",
        ) from exc


@router.get("/bgm", response_model=LibraryBGMListResponse)
async def list_library_bgm(
    request: Request,
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    style_id: Optional[str] = Query(None, description="Filter by linked style id"),
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
        payload = await history.list_library_items(
            kind="bgm",
            project_id=normalized_project_id,
            unassigned_only=unassigned_only,
            cursor=None,
            limit=1000,
        )
        items = list(payload["items"])
        if unassigned_only or normalized_project_id is None:
            items.extend(_builtin_bgm_items(request, pixelle_video))
        if style_id:
            items = [item for item in items if item.get("linked_style_id") == style_id]
        items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        page_items, next_cursor = _paginate_items(items, cursor, limit)
        return LibraryBGMListResponse(
            items=[
                _library_bgm_item_from_payload(request, item)
                for item in page_items
                if item.get("audio_path")
            ],
            next_cursor=next_cursor,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"List library BGM error: {exc}")
        raise api_error(
            status_code=500,
            code="LIBRARY_BGM_FAILED",
            message="Failed to list library BGM.",
        ) from exc


@router.get("/scripts", response_model=ScriptListResponse)
async def list_scripts(
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
        payload = await history.list_library_items(
            kind="script",
            project_id=normalized_project_id,
            unassigned_only=unassigned_only,
            cursor=cursor,
            limit=limit,
        )
        return ScriptListResponse(
            items=[
                _script_item_from_payload(item)
                for item in payload["items"]
                if item.get("text")
            ],
            next_cursor=payload.get("next_cursor"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"List scripts error: {exc}")
        raise api_error(
            status_code=500,
            code="LIBRARY_SCRIPTS_FAILED",
            message="Failed to list library scripts.",
        ) from exc
