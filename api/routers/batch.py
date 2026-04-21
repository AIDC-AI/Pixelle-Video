from __future__ import annotations

import uuid
from typing import Any, Mapping, Optional, cast

from fastapi import APIRouter, HTTPException, Query, Request, status
from loguru import logger
from pydantic import ValidationError

from api.dependencies import PixelleVideoDep
from api.routers._helpers import api_error, normalize_project_filter_query
from api.routers.video import (
    submit_action_transfer_async_request,
    submit_custom_async_request,
    submit_digital_human_async_request,
    submit_i2v_async_request,
    submit_standard_async_request,
)
from api.schemas.batch import (
    Batch,
    BatchCreateRequest,
    BatchCreateResponse,
    BatchDetailResponse,
    BatchListResponse,
    BatchPipeline,
    BatchRowPayload,
)
from api.schemas.pipeline_payloads import (
    ActionTransferAsyncRequest,
    CustomAsyncRequest,
    DigitalHumanAsyncRequest,
    I2VAsyncRequest,
)
from api.schemas.video import VideoGenerateRequest
from api.tasks import Task, TaskStatus, task_manager

router = APIRouter(prefix="/batch", tags=["Batch"])


def _coerce_batch_row(
    pipeline: BatchPipeline,
    row_payload: BatchRowPayload,
    shared_project_id: Optional[str],
) -> BatchRowPayload:
    payload: dict[str, Any]
    if hasattr(row_payload, "model_dump"):
        payload = cast(Any, row_payload).model_dump()
    elif isinstance(row_payload, Mapping):
        payload = dict(row_payload)
    else:
        raise TypeError("Batch row payload must be a mapping or Pydantic model")
    if shared_project_id is not None:
        payload["project_id"] = shared_project_id

    if pipeline == BatchPipeline.STANDARD:
        return VideoGenerateRequest(**payload)
    if pipeline == BatchPipeline.DIGITAL_HUMAN:
        return DigitalHumanAsyncRequest(**payload)
    if pipeline == BatchPipeline.I2V:
        return I2VAsyncRequest(**payload)
    if pipeline == BatchPipeline.ACTION_TRANSFER:
        return ActionTransferAsyncRequest(**payload)
    if pipeline == BatchPipeline.ASSET_BASED:
        return CustomAsyncRequest(**payload)
    raise ValueError(f"Unsupported pipeline: {pipeline}")


async def _submit_batch_row(
    *,
    pipeline: BatchPipeline,
    row_request: BatchRowPayload,
    pixelle_video: PixelleVideoDep,
    request: Request,
    batch_id: str,
):
    if pipeline == BatchPipeline.STANDARD:
        return await submit_standard_async_request(
            request_body=cast(VideoGenerateRequest, row_request),
            pixelle_video=pixelle_video,
            request=request,
            batch_id=batch_id,
        )
    if pipeline == BatchPipeline.DIGITAL_HUMAN:
        return await submit_digital_human_async_request(
            request_body=cast(DigitalHumanAsyncRequest, row_request),
            pixelle_video=pixelle_video,
            request=request,
            batch_id=batch_id,
        )
    if pipeline == BatchPipeline.I2V:
        return await submit_i2v_async_request(
            request_body=cast(I2VAsyncRequest, row_request),
            pixelle_video=pixelle_video,
            request=request,
            batch_id=batch_id,
        )
    if pipeline == BatchPipeline.ACTION_TRANSFER:
        return await submit_action_transfer_async_request(
            request_body=cast(ActionTransferAsyncRequest, row_request),
            pixelle_video=pixelle_video,
            request=request,
            batch_id=batch_id,
        )
    if pipeline == BatchPipeline.ASSET_BASED:
        return await submit_custom_async_request(
            request_body=cast(CustomAsyncRequest, row_request),
            pixelle_video=pixelle_video,
            request=request,
            batch_id=batch_id,
        )
    raise ValueError(f"Unsupported pipeline: {pipeline}")


def _task_from_snapshot(snapshot: dict) -> Task:
    return Task.model_validate(snapshot)


@router.post("", response_model=BatchCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(
    request_body: BatchCreateRequest,
    request: Request,
    *,
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        batch_id = str(uuid.uuid4())
        await persistence.create_batch(
            batch_id=batch_id,
            pipeline=request_body.pipeline.value,
            task_ids=[],
            project_id=request_body.project_id,
            name=request_body.name,
        )

        created_task_ids: list[str] = []
        try:
            for row in request_body.rows:
                coerced_row = _coerce_batch_row(
                    request_body.pipeline,
                    row,
                    request_body.project_id,
                )
                response = await _submit_batch_row(
                    pipeline=request_body.pipeline,
                    row_request=coerced_row,
                    pixelle_video=pixelle_video,
                    request=request,
                    batch_id=batch_id,
                )
                created_task_ids.append(response.task_id)
        except Exception as exc:
            for task_id in created_task_ids:
                task_manager.cancel_task(task_id)
            await persistence.update_batch(
                batch_id,
                {
                    "task_ids": created_task_ids,
                    "total": len(created_task_ids),
                    "cancelled": len(created_task_ids),
                    "status": "cancelled",
                },
            )
            await persistence.delete_batch(batch_id)
            raise exc

        await persistence.update_batch(
            batch_id,
            {
                "task_ids": created_task_ids,
                "total": len(created_task_ids),
                "status": "pending",
            },
        )
        return BatchCreateResponse(batch_id=batch_id, task_ids=created_task_ids)
    except HTTPException:
        raise
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    except Exception as exc:
        logger.error(f"Create batch error: {exc}")
        raise api_error(
            status_code=500,
            code="BATCH_CREATE_FAILED",
            message="Failed to create batch.",
        ) from exc


@router.get("", response_model=BatchListResponse)
async def list_batches(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by batch status"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    *,
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        normalized_project_id, unassigned_only = normalize_project_filter_query(project_id)
        payload = await persistence.list_batches(
            project_id=normalized_project_id,
            unassigned_only=unassigned_only,
            status=status_filter,
            cursor=cursor,
            limit=limit,
        )
        return BatchListResponse(
            items=[Batch(**item) for item in payload["items"]],
            next_cursor=payload.get("next_cursor"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"List batches error: {exc}")
        raise api_error(
            status_code=500,
            code="BATCH_LIST_FAILED",
            message="Failed to list batches.",
        ) from exc


@router.get("/{batch_id}", response_model=BatchDetailResponse)
async def get_batch(batch_id: str, pixelle_video: PixelleVideoDep):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        batch = await persistence.get_batch(batch_id)
        if batch is None or batch.get("deleted_at") is not None:
            raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")

        hydrated = await persistence._hydrate_batch(batch)
        children = [_task_from_snapshot(child) for child in hydrated.pop("children", [])]
        return BatchDetailResponse(children=children, **hydrated)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Get batch error: {exc}")
        raise api_error(
            status_code=500,
            code="BATCH_FETCH_FAILED",
            message="Failed to fetch batch.",
        ) from exc


@router.delete("/{batch_id}", response_model=Batch)
async def delete_batch(
    batch_id: str,
    cascade: bool = Query(False, description="Cancel unfinished child tasks and delete their outputs"),
    *,
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        batch = await persistence.get_batch(batch_id)
        if batch is None or batch.get("deleted_at") is not None:
            raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")

        hydrated = await persistence._hydrate_batch(batch)
        if cascade:
            for child in hydrated.get("children", []):
                child_status = child.get("status")
                task_id = child.get("task_id")
                if task_id is None:
                    continue
                if child_status in {TaskStatus.PENDING.value, TaskStatus.RUNNING.value}:
                    task_manager.cancel_task(task_id)
                await persistence.delete_task(task_id)

        deleted_batch = await persistence.delete_batch(batch_id)
        if deleted_batch is None:
            raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")
        refreshed = await persistence._hydrate_batch(deleted_batch)
        refreshed.pop("children", None)
        return Batch(**refreshed)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Delete batch error: {exc}")
        raise api_error(
            status_code=500,
            code="BATCH_DELETE_FAILED",
            message="Failed to delete batch.",
        ) from exc
