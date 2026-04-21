from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.routers._helpers import api_error
from api.schemas.settings import SettingsPayload, SettingsUpdatePayload
from pixelle_video.config import config_manager
from pixelle_video.config.loader import mask_sensitive_config, sensitive_field_paths

router = APIRouter(prefix="/settings", tags=["Settings"])


def _merge_settings_updates(
    current: dict[str, Any],
    updates: dict[str, Any],
    path: tuple[str, ...] = (),
) -> dict[str, Any]:
    merged = dict(current)
    sensitive_paths = set(sensitive_field_paths())
    for key, value in updates.items():
        next_path = path + (key,)
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_settings_updates(merged[key], value, next_path)
            continue
        if (
            next_path in sensitive_paths
            and isinstance(value, str)
            and "****" in value
        ):
            continue
        merged[key] = value
    return merged


def _masked_settings_payload() -> SettingsPayload:
    config_manager.reload()
    return SettingsPayload.model_validate(mask_sensitive_config(config_manager.config.to_dict()))


@router.get("", response_model=SettingsPayload)
async def get_settings():
    try:
        return _masked_settings_payload()
    except Exception as exc:
        logger.error(f"Settings read error: {exc}")
        raise api_error(
            status_code=500,
            code="SETTINGS_READ_FAILED",
            message="Failed to read settings.",
        ) from exc


@router.put("", response_model=SettingsPayload)
async def update_settings(
    request_body: SettingsUpdatePayload,
    pixelle_video: PixelleVideoDep,
):
    try:
        current = config_manager.config.to_dict()
        updates = request_body.model_dump(exclude_unset=True, exclude_none=True)
        merged = _merge_settings_updates(current, updates)
        config_manager.update(merged)
        config_manager.save()
        config_manager.reload()
        pixelle_video.config = config_manager.config.to_dict()
        return SettingsPayload.model_validate(mask_sensitive_config(pixelle_video.config))
    except Exception as exc:
        logger.error(f"Settings write error: {exc}")
        raise api_error(
            status_code=500,
            code="SETTINGS_WRITE_FAILED",
            message="Failed to update settings.",
        ) from exc
