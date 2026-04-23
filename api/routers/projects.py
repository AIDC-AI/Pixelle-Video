from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, status
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.routers._helpers import api_error, path_to_url
from api.schemas.batch import Batch
from api.schemas.library import ImageItem, LibraryBGMItem, ScriptItem, VideoItem, VoiceItem
from api.schemas.projects import (
    Project,
    ProjectCreateRequest,
    ProjectListResponse,
    ProjectOverviewRecent,
    ProjectOverviewResponse,
    ProjectOverviewStats,
    ProjectUpdateRequest,
)
from api.tasks.models import Task

router = APIRouter(prefix="/projects", tags=["Projects"])


def _maybe_url(request: Request, value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value)
    if not text:
        return None
    if text.startswith(("http://", "https://", "/api/files/", "/")):
        return text
    return path_to_url(request, text)


def _project_response_from_payload(request: Request, payload: dict[str, object]) -> Project:
    return Project(
        id=str(payload["id"]),
        name=str(payload["name"]),
        created_at=payload["created_at"],
        updated_at=payload["updated_at"],
        cover_url=_maybe_url(request, payload.get("cover_url")),
        pipeline_hint=payload.get("pipeline_hint"),
        task_count=int(payload.get("task_count", 0) or 0),
        last_task_id=payload.get("last_task_id"),
        preview_url=_maybe_url(request, payload.get("preview_url")),
        preview_kind=payload.get("preview_kind"),
        deleted_at=payload.get("deleted_at"),
    )


def _batch_response_from_payload(request: Request, payload: dict[str, object]) -> Batch:
    return Batch(
        id=str(payload["id"]),
        name=payload.get("name"),
        pipeline=payload["pipeline"],
        project_id=payload.get("project_id"),
        status=payload["status"],
        total=int(payload.get("total", 0) or 0),
        succeeded=int(payload.get("succeeded", 0) or 0),
        failed=int(payload.get("failed", 0) or 0),
        cancelled=int(payload.get("cancelled", 0) or 0),
        created_at=payload.get("created_at"),
        updated_at=payload.get("updated_at"),
        cover_url=_maybe_url(request, payload.get("cover_url")),
        deleted_at=payload.get("deleted_at"),
        task_ids=list(payload.get("task_ids", []) or []),
    )


def _video_response_from_payload(request: Request, payload: dict[str, object]) -> VideoItem:
    return VideoItem(
        task_id=str(payload["task_id"]),
        title=str(payload.get("title") or payload["task_id"]),
        created_at=payload.get("created_at"),
        completed_at=payload.get("completed_at"),
        duration=float(payload.get("duration", 0.0) or 0.0),
        file_size=int(payload.get("file_size", 0) or 0),
        n_frames=int(payload.get("n_frames", 0) or 0),
        video_path=payload.get("video_path"),
        video_url=_maybe_url(request, payload.get("video_path")),
        thumbnail_url=None,
        project_id=payload.get("project_id"),
        batch_id=payload.get("batch_id"),
        pipeline=payload.get("pipeline"),
    )


def _image_response_from_payload(request: Request, payload: dict[str, object]) -> ImageItem:
    return ImageItem(
        id=str(payload["id"]),
        task_id=payload.get("task_id"),
        image_path=str(payload["image_path"]),
        image_url=_maybe_url(request, payload.get("image_path")),
        thumbnail_url=_maybe_url(request, payload.get("image_path")),
        created_at=payload.get("created_at"),
        file_size=int(payload.get("file_size", 0) or 0),
        prompt_used=payload.get("prompt_used"),
        project_id=payload.get("project_id"),
        batch_id=payload.get("batch_id"),
    )


def _voice_response_from_payload(request: Request, payload: dict[str, object]) -> VoiceItem:
    return VoiceItem(
        id=str(payload["id"]),
        task_id=payload.get("task_id"),
        audio_path=str(payload["audio_path"]),
        audio_url=_maybe_url(request, payload.get("audio_path")),
        created_at=payload.get("created_at"),
        duration=float(payload.get("duration", 0.0) or 0.0),
        tts_voice=payload.get("tts_voice"),
        text=payload.get("text"),
        file_size=int(payload.get("file_size", 0) or 0),
        project_id=payload.get("project_id"),
        batch_id=payload.get("batch_id"),
    )


def _bgm_response_from_payload(request: Request, payload: dict[str, object]) -> LibraryBGMItem:
    return LibraryBGMItem(
        id=str(payload["id"]),
        name=str(payload.get("name") or payload.get("audio_path") or payload["id"]),
        audio_path=str(payload["audio_path"]),
        audio_url=_maybe_url(request, payload.get("audio_path")),
        created_at=payload.get("created_at"),
        duration=payload.get("duration"),
        file_size=int(payload.get("file_size", 0) or 0),
        source=str(payload.get("source", "history")),
        display_name_zh=payload.get("display_name_zh"),
        description_zh=payload.get("description_zh"),
        source_label=payload.get("source_label"),
        linked_style_display_name_zh=payload.get("linked_style_display_name_zh"),
        technical_name=payload.get("technical_name"),
        linked_style_id=payload.get("linked_style_id"),
        linked_style_name=payload.get("linked_style_name"),
        project_id=payload.get("project_id"),
        batch_id=payload.get("batch_id"),
    )


def _script_response_from_payload(payload: dict[str, object]) -> ScriptItem:
    return ScriptItem(
        id=str(payload["id"]),
        task_id=payload.get("task_id"),
        created_at=payload.get("created_at"),
        project_id=payload.get("project_id"),
        batch_id=payload.get("batch_id"),
        pipeline=payload.get("pipeline"),
        text=str(payload["text"]),
        script_type=str(payload.get("script_type", "script")),
        prompt_used=payload.get("prompt_used"),
        type_label_zh=payload.get("type_label_zh"),
        pipeline_label_zh=payload.get("pipeline_label_zh"),
        summary_zh=payload.get("summary_zh"),
    )


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(
    request: Request,
    request_body: ProjectCreateRequest,
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        project = await persistence.create_project(
            name=request_body.name,
            cover_url=request_body.cover_url,
            pipeline_hint=request_body.pipeline_hint,
        )
        return _project_response_from_payload(request, project)
    except Exception as exc:
        logger.error(f"Create project error: {exc}")
        raise api_error(
            status_code=500,
            code="PROJECT_CREATE_FAILED",
            message="Failed to create project.",
        ) from exc


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    request: Request,
    include_deleted: bool = Query(False, description="Include soft-deleted projects"),
    *,
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        projects = await persistence.list_projects(include_deleted=include_deleted)
        return ProjectListResponse(items=[_project_response_from_payload(request, project) for project in projects])
    except Exception as exc:
        logger.error(f"List projects error: {exc}")
        raise api_error(
            status_code=500,
            code="PROJECT_LIST_FAILED",
            message="Failed to list projects.",
        ) from exc


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, request: Request, pixelle_video: PixelleVideoDep):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        project = await persistence.get_project(project_id)
        if project is None:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        return _project_response_from_payload(request, project)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Get project error: {exc}")
        raise api_error(
            status_code=500,
            code="PROJECT_FETCH_FAILED",
            message="Failed to fetch project.",
        ) from exc


@router.get("/{project_id}/overview", response_model=ProjectOverviewResponse)
async def get_project_overview(
    project_id: str,
    request: Request,
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        payload = await persistence.get_project_overview(project_id)
        if payload is None:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

        recent = payload.get("recent", {})
        return ProjectOverviewResponse(
            project=_project_response_from_payload(request, payload["project"]),
            stats=ProjectOverviewStats(**payload.get("stats", {})),
            recent=ProjectOverviewRecent(
                batches=[_batch_response_from_payload(request, batch) for batch in recent.get("batches", [])],
                tasks=[Task(**task) for task in recent.get("tasks", [])],
                videos=[_video_response_from_payload(request, video) for video in recent.get("videos", [])],
                images=[_image_response_from_payload(request, image) for image in recent.get("images", [])],
                voices=[_voice_response_from_payload(request, voice) for voice in recent.get("voices", [])],
                bgm=[_bgm_response_from_payload(request, item) for item in recent.get("bgm", [])],
                scripts=[_script_response_from_payload(script) for script in recent.get("scripts", [])],
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Get project overview error: {exc}")
        raise api_error(
            status_code=500,
            code="PROJECT_OVERVIEW_FAILED",
            message="Failed to fetch project overview.",
        ) from exc


@router.patch("/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    request: Request,
    request_body: ProjectUpdateRequest,
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        project = await persistence.update_project(
            project_id,
            request_body.model_dump(exclude_none=True),
        )
        if project is None:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        return _project_response_from_payload(request, project)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Update project error: {exc}")
        raise api_error(
            status_code=500,
            code="PROJECT_UPDATE_FAILED",
            message="Failed to update project.",
        ) from exc


@router.delete("/{project_id}", response_model=Project)
async def delete_project(
    project_id: str,
    request: Request,
    cascade: bool = Query(False, description="Also delete linked task outputs"),
    *,
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        project = await persistence.delete_project(project_id, cascade=cascade)
        if project is None:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        return _project_response_from_payload(request, project)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Delete project error: {exc}")
        raise api_error(
            status_code=500,
            code="PROJECT_DELETE_FAILED",
            message="Failed to delete project.",
        ) from exc
