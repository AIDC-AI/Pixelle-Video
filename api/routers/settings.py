from __future__ import annotations

from fastapi import APIRouter

from api.routers._helpers import not_implemented
from api.schemas.settings import SettingsPayload

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsPayload)
async def get_settings():
    raise not_implemented("Settings read API is not implemented yet")


@router.put("", response_model=SettingsPayload)
async def update_settings(request_body: SettingsPayload):
    raise not_implemented("Settings write API is not implemented yet")
