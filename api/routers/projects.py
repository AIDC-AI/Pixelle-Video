from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.schemas.projects import (
    Project,
    ProjectCreateRequest,
    ProjectListResponse,
    ProjectUpdateRequest,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(
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
        return Project(**project)
    except Exception as exc:
        logger.error(f"Create project error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    include_deleted: bool = Query(False, description="Include soft-deleted projects"),
    *,
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        projects = await persistence.list_projects(include_deleted=include_deleted)
        return ProjectListResponse(items=[Project(**project) for project in projects])
    except Exception as exc:
        logger.error(f"List projects error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, pixelle_video: PixelleVideoDep):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        project = await persistence.get_project(project_id)
        if project is None:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
        return Project(**project)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Get project error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
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
        return Project(**project)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Update project error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{project_id}", response_model=Project)
async def delete_project(
    project_id: str,
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
        return Project(**project)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Delete project error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
