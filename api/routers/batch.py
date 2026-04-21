from __future__ import annotations

from fastapi import APIRouter

from api.routers._helpers import not_implemented
from api.schemas.batch import Batch, BatchCreateRequest, BatchListResponse

router = APIRouter(prefix="/batch", tags=["Batch"])


@router.post("", response_model=Batch)
async def create_batch(request_body: BatchCreateRequest):
    raise not_implemented("Batch creation is not implemented yet")


@router.get("", response_model=BatchListResponse)
async def list_batches():
    raise not_implemented("Batch listing is not implemented yet")


@router.get("/{batch_id}", response_model=Batch)
async def get_batch(batch_id: str):
    raise not_implemented(f"Batch detail for {batch_id} is not implemented yet")


@router.delete("/{batch_id}")
async def delete_batch(batch_id: str):
    raise not_implemented(f"Batch deletion for {batch_id} is not implemented yet")
