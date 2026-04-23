from __future__ import annotations

import asyncio
import shutil
import time
from typing import Any
from pathlib import Path

import httpx

from fastapi import APIRouter, HTTPException
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.routers._helpers import api_error
from api.schemas.settings import (
    ComfyUICheckRequest,
    ComfyUICheckResponse,
    LLMConnectionCheckRequest,
    LLMConnectionCheckResponse,
    ProviderConnectionCheckResponse,
    ProviderConnectionDiagnosticsPayload,
    RunningHubConnectionCheckRequest,
    RunningHubConnectionCheckResponse,
    SettingsPayload,
    SettingsUpdatePayload,
    StorageCleanupRequest,
    StorageCleanupResponse,
    StoragePathStatsPayload,
    StorageStatsResponse,
)
from pixelle_video.config import config_manager
from pixelle_video.config.loader import mask_sensitive_config, sensitive_field_paths
from pixelle_video.llm_presets import find_preset_by_base_url_and_model, get_preset
from pixelle_video.utils.llm_util import fetch_available_models
from pixelle_video.utils.os_util import get_output_path, get_root_path, get_temp_path

router = APIRouter(prefix="/settings", tags=["Settings"])

RUNNINGHUB_ACCOUNT_STATUS_URL = "https://www.runninghub.cn/uc/openapi/accountStatus"


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


def _storage_roots() -> list[tuple[str, Path]]:
    return [
        ("output", Path(get_output_path())),
        ("temp", Path(get_temp_path())),
        ("uploads", Path(get_output_path("uploads"))),
    ]


def _directory_stats(directory: Path) -> tuple[int, int]:
    if not directory.exists():
        return (0, 0)

    file_count = 0
    total_size = 0
    for candidate in directory.rglob("*"):
        if not candidate.is_file():
            continue
        file_count += 1
        total_size += candidate.stat().st_size

    return (file_count, total_size)


def _get_nested(config: dict[str, Any], path: tuple[str, ...]) -> Any:
    current: Any = config
    for key in path:
        if not isinstance(current, dict) or key not in current:
            return None
        current = current[key]
    return current


def _is_masked_secret(value: Any) -> bool:
    return isinstance(value, str) and "****" in value


def _resolve_setting_value(candidate: Any, path: tuple[str, ...]) -> Any:
    current = config_manager.config.to_dict()
    fallback = _get_nested(current, path)
    if candidate is None:
        return fallback
    if isinstance(candidate, str) and candidate == "":
        return fallback
    if _is_masked_secret(candidate):
        return fallback
    return candidate


def _error_code_for_http_status(status_code: int) -> str:
    if status_code in (401, 403):
        return "AUTH_INVALID"
    if status_code == 404:
        return "ENDPOINT_NOT_FOUND"
    return f"HTTP_{status_code}"


def _provider_check_response(
    *,
    provider: str,
    status: str,
    reachable: bool,
    authenticated: bool,
    message: str,
    endpoint: str | None,
    status_code: int | None,
    response_time_ms: int | None,
    diagnostics: ProviderConnectionDiagnosticsPayload | None = None,
) -> dict[str, Any]:
    return ProviderConnectionCheckResponse(
        provider=provider,
        status=status,
        success=status == "success",
        reachable=reachable,
        authenticated=authenticated,
        message=message,
        endpoint=endpoint,
        status_code=status_code,
        response_time_ms=response_time_ms,
        diagnostics=diagnostics or ProviderConnectionDiagnosticsPayload(),
    ).model_dump()


def _require_setting_value(value: Any, *, code: str, message: str):
    if value in (None, ""):
        raise api_error(status_code=400, code=code, message=message)


def _coerce_runninghub_count(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


async def _timed_request(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    json_body: dict[str, Any] | None = None,
    timeout: float = 10.0,
) -> tuple[httpx.Response, int]:
    start = time.perf_counter()
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=min(timeout, 5.0)), follow_redirects=True) as client:
        response = await client.request(method, url, headers=headers, json=json_body)
    response_time_ms = int((time.perf_counter() - start) * 1000)
    return response, response_time_ms


def _resolve_llm_api_key(api_key: str | None, base_url: str, model: str | None) -> str | None:
    if api_key:
        return api_key

    if model:
        preset_name = find_preset_by_base_url_and_model(base_url, model)
        if preset_name:
            preset = get_preset(preset_name)
            default_api_key = preset.get("default_api_key")
            if isinstance(default_api_key, str) and default_api_key:
                return default_api_key

    return api_key


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


@router.post("/comfyui/check", response_model=ComfyUICheckResponse)
async def check_comfyui_connection(request_body: ComfyUICheckRequest):
    try:
        config_manager.reload()
        endpoint = request_body.comfyui_url or config_manager.config.comfyui.comfyui_url
        api_key = _resolve_setting_value(request_body.comfyui_api_key, ("comfyui", "comfyui_api_key"))

        _require_setting_value(
            endpoint,
            code="SETTINGS_COMFYUI_CHECK_CONFIG_MISSING",
            message="ComfyUI endpoint is required for validation.",
        )

        headers: dict[str, str] = {}
        auth_applied = bool(api_key)
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
            headers["X-API-Key"] = api_key

        response, response_time_ms = await _timed_request(
            "GET",
            str(endpoint),
            headers=headers,
            timeout=5.0,
        )
        status_code = response.status_code

        if status_code in (401, 403):
            return ComfyUICheckResponse.model_validate(
                _provider_check_response(
                    provider="comfyui",
                    status="error",
                    reachable=True,
                    authenticated=False,
                    message=(
                        "ComfyUI endpoint rejected the supplied credentials."
                        if auth_applied
                        else "ComfyUI endpoint requires authentication."
                    ),
                    endpoint=str(endpoint),
                    status_code=status_code,
                    response_time_ms=response_time_ms,
                    diagnostics=ProviderConnectionDiagnosticsPayload(
                        auth_applied=auth_applied,
                        auth_required=True,
                        error_code=_error_code_for_http_status(status_code),
                    ),
                )
            )

        if status_code >= 400:
            return ComfyUICheckResponse.model_validate(
                _provider_check_response(
                    provider="comfyui",
                    status="error",
                    reachable=True,
                    authenticated=auth_applied,
                    message=f"ComfyUI endpoint responded with HTTP {status_code}.",
                    endpoint=str(endpoint),
                    status_code=status_code,
                    response_time_ms=response_time_ms,
                    diagnostics=ProviderConnectionDiagnosticsPayload(
                        auth_applied=auth_applied,
                        auth_required=False,
                        error_code=_error_code_for_http_status(status_code),
                    ),
                )
            )

        return ComfyUICheckResponse.model_validate(
            _provider_check_response(
                provider="comfyui",
                status="success",
                reachable=True,
                authenticated=True,
                message="ComfyUI endpoint responded.",
                endpoint=str(endpoint),
                status_code=status_code,
                response_time_ms=response_time_ms,
                diagnostics=ProviderConnectionDiagnosticsPayload(
                    auth_applied=auth_applied,
                    auth_required=False,
                ),
            )
        )
    except httpx.RequestError as exc:
        logger.warning(f"ComfyUI connection check failed: {exc}")
        return ComfyUICheckResponse.model_validate(
            _provider_check_response(
                provider="comfyui",
                status="error",
                reachable=False,
                authenticated=False,
                message="ComfyUI endpoint is unreachable.",
                endpoint=str(request_body.comfyui_url) if request_body.comfyui_url else config_manager.config.comfyui.comfyui_url,
                status_code=None,
                response_time_ms=None,
                diagnostics=ProviderConnectionDiagnosticsPayload(
                    auth_applied=bool(request_body.comfyui_api_key),
                    auth_required=None,
                    error_code="NETWORK_UNREACHABLE",
                ),
            )
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"ComfyUI connection check error: {exc}")
        raise api_error(
            status_code=500,
            code="SETTINGS_COMFYUI_CHECK_FAILED",
            message="Failed to check the ComfyUI connection.",
        ) from exc


@router.post("/llm/check", response_model=LLMConnectionCheckResponse)
async def check_llm_connection(request_body: LLMConnectionCheckRequest):
    try:
        config_manager.reload()
        base_url = request_body.base_url or config_manager.config.llm.base_url
        model = request_body.model or config_manager.config.llm.model or None
        api_key = _resolve_setting_value(request_body.api_key, ("llm", "api_key"))
        api_key = _resolve_llm_api_key(api_key, str(base_url or ""), model)

        _require_setting_value(
            base_url,
            code="SETTINGS_LLM_CHECK_CONFIG_MISSING",
            message="LLM base URL is required for validation.",
        )
        _require_setting_value(
            api_key,
            code="SETTINGS_LLM_CHECK_CONFIG_MISSING",
            message="LLM API key is required for validation.",
        )

        start = time.perf_counter()
        models = await asyncio.to_thread(fetch_available_models, str(api_key), str(base_url), 10.0)
        response_time_ms = int((time.perf_counter() - start) * 1000)
        selected_model_available = None if not model else model in models
        status = "success" if selected_model_available is not False else "warning"
        message = (
            "LLM credentials verified."
            if selected_model_available is not False
            else f"Configured model '{model}' is not available from the provider."
        )

        return LLMConnectionCheckResponse.model_validate(
            _provider_check_response(
                provider="llm",
                status=status,
                reachable=True,
                authenticated=True,
                message=message,
                endpoint=str(base_url),
                status_code=200,
                response_time_ms=response_time_ms,
                diagnostics=ProviderConnectionDiagnosticsPayload(
                    model_count=len(models),
                    selected_model=model,
                    selected_model_available=selected_model_available,
                    error_code=None if selected_model_available is not False else "MODEL_NOT_FOUND",
                ),
            )
        )
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        logger.warning(f"LLM connection check returned HTTP {status_code}: {exc}")
        return LLMConnectionCheckResponse.model_validate(
            _provider_check_response(
                provider="llm",
                status="error",
                reachable=True,
                authenticated=status_code not in (401, 403),
                message=(
                    "LLM provider rejected the supplied API key."
                    if status_code == 401
                    else "LLM provider denied access for the supplied API key."
                    if status_code == 403
                    else "LLM models endpoint was not found. Check the base URL."
                    if status_code == 404
                    else f"LLM provider responded with HTTP {status_code}."
                ),
                endpoint=request_body.base_url or config_manager.config.llm.base_url,
                status_code=status_code,
                response_time_ms=None,
                diagnostics=ProviderConnectionDiagnosticsPayload(
                    model_count=0,
                    selected_model=request_body.model or config_manager.config.llm.model or None,
                    selected_model_available=False,
                    error_code=_error_code_for_http_status(status_code),
                ),
            )
        )
    except httpx.TimeoutException as exc:
        logger.warning(f"LLM connection check timed out: {exc}")
        return LLMConnectionCheckResponse.model_validate(
            _provider_check_response(
                provider="llm",
                status="error",
                reachable=False,
                authenticated=False,
                message="LLM validation timed out.",
                endpoint=request_body.base_url or config_manager.config.llm.base_url,
                status_code=None,
                response_time_ms=None,
                diagnostics=ProviderConnectionDiagnosticsPayload(
                    model_count=0,
                    selected_model=request_body.model or config_manager.config.llm.model or None,
                    selected_model_available=False,
                    error_code="TIMEOUT",
                ),
            )
        )
    except httpx.RequestError as exc:
        logger.warning(f"LLM connection check failed: {exc}")
        return LLMConnectionCheckResponse.model_validate(
            _provider_check_response(
                provider="llm",
                status="error",
                reachable=False,
                authenticated=False,
                message="LLM provider is unreachable.",
                endpoint=request_body.base_url or config_manager.config.llm.base_url,
                status_code=None,
                response_time_ms=None,
                diagnostics=ProviderConnectionDiagnosticsPayload(
                    model_count=0,
                    selected_model=request_body.model or config_manager.config.llm.model or None,
                    selected_model_available=False,
                    error_code="NETWORK_UNREACHABLE",
                ),
            )
        )
    except Exception as exc:
        logger.error(f"LLM connection check error: {exc}")
        raise api_error(
            status_code=500,
            code="SETTINGS_LLM_CHECK_FAILED",
            message="Failed to check the LLM connection.",
        ) from exc


@router.post("/runninghub/check", response_model=RunningHubConnectionCheckResponse)
async def check_runninghub_connection(request_body: RunningHubConnectionCheckRequest):
    try:
        config_manager.reload()
        api_key = _resolve_setting_value(request_body.runninghub_api_key, ("comfyui", "runninghub_api_key"))

        _require_setting_value(
            api_key,
            code="SETTINGS_RUNNINGHUB_CHECK_CONFIG_MISSING",
            message="RunningHub API key is required for validation.",
        )

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        response, response_time_ms = await _timed_request(
            "POST",
            RUNNINGHUB_ACCOUNT_STATUS_URL,
            headers=headers,
            json_body={"apikey": api_key},
            timeout=10.0,
        )

        if response.status_code in (401, 403):
            return RunningHubConnectionCheckResponse.model_validate(
                _provider_check_response(
                    provider="runninghub",
                    status="error",
                    reachable=True,
                    authenticated=False,
                    message="RunningHub rejected the supplied API key.",
                    endpoint=RUNNINGHUB_ACCOUNT_STATUS_URL,
                    status_code=response.status_code,
                    response_time_ms=response_time_ms,
                    diagnostics=ProviderConnectionDiagnosticsPayload(
                        error_code=_error_code_for_http_status(response.status_code),
                    ),
                )
            )

        payload = response.json()
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        upstream_code = payload.get("code")
        upstream_message = str(payload.get("msg") or "RunningHub validation failed.")
        current_task_nums = _coerce_runninghub_count(
            data.get("currentTaskCounts", data.get("currentTaskNums"))
        )
        remain_num = data.get("remainCoins", data.get("remainNum"))
        remain_money = data.get("remainMoney")
        api_type = data.get("apiType")
        currency = data.get("currency")

        if response.status_code >= 400:
            return RunningHubConnectionCheckResponse.model_validate(
                _provider_check_response(
                    provider="runninghub",
                    status="error",
                    reachable=True,
                    authenticated=False,
                    message=f"RunningHub endpoint responded with HTTP {response.status_code}.",
                    endpoint=RUNNINGHUB_ACCOUNT_STATUS_URL,
                    status_code=response.status_code,
                    response_time_ms=response_time_ms,
                    diagnostics=ProviderConnectionDiagnosticsPayload(
                        error_code=_error_code_for_http_status(response.status_code),
                        api_type=api_type,
                        current_task_nums=current_task_nums,
                        remain_num=None if remain_num is None else str(remain_num),
                        remain_money=None if remain_money is None else str(remain_money),
                        currency=None if currency is None else str(currency),
                    ),
                )
            )

        if upstream_code != 0:
            return RunningHubConnectionCheckResponse.model_validate(
                _provider_check_response(
                    provider="runninghub",
                    status="error",
                    reachable=True,
                    authenticated=False,
                    message=upstream_message,
                    endpoint=RUNNINGHUB_ACCOUNT_STATUS_URL,
                    status_code=response.status_code,
                    response_time_ms=response_time_ms,
                    diagnostics=ProviderConnectionDiagnosticsPayload(
                        error_code=f"RUNNINGHUB_{upstream_code}",
                        api_type=api_type,
                        current_task_nums=current_task_nums,
                        remain_num=None if remain_num is None else str(remain_num),
                        remain_money=None if remain_money is None else str(remain_money),
                        currency=None if currency is None else str(currency),
                    ),
                )
            )

        return RunningHubConnectionCheckResponse.model_validate(
            _provider_check_response(
                provider="runninghub",
                status="success",
                reachable=True,
                authenticated=True,
                message="RunningHub credentials verified.",
                endpoint=RUNNINGHUB_ACCOUNT_STATUS_URL,
                status_code=response.status_code,
                response_time_ms=response_time_ms,
                diagnostics=ProviderConnectionDiagnosticsPayload(
                    api_type=None if api_type is None else str(api_type),
                    current_task_nums=current_task_nums,
                    remain_num=None if remain_num is None else str(remain_num),
                    remain_money=None if remain_money is None else str(remain_money),
                    currency=None if currency is None else str(currency),
                ),
            )
        )
    except HTTPException:
        raise
    except httpx.RequestError as exc:
        logger.warning(f"RunningHub connection check failed: {exc}")
        return RunningHubConnectionCheckResponse.model_validate(
            _provider_check_response(
                provider="runninghub",
                status="error",
                reachable=False,
                authenticated=False,
                message="RunningHub endpoint is unreachable.",
                endpoint=RUNNINGHUB_ACCOUNT_STATUS_URL,
                status_code=None,
                response_time_ms=None,
                diagnostics=ProviderConnectionDiagnosticsPayload(
                    error_code="NETWORK_UNREACHABLE",
                ),
            )
        )
    except Exception as exc:
        logger.error(f"RunningHub connection check error: {exc}")
        raise api_error(
            status_code=500,
            code="SETTINGS_RUNNINGHUB_CHECK_FAILED",
            message="Failed to check the RunningHub connection.",
        ) from exc


@router.get("/storage/stats", response_model=StorageStatsResponse)
async def get_storage_stats():
    try:
        path_stats: list[StoragePathStatsPayload] = []
        total_size_bytes = 0
        for key, directory in _storage_roots():
            file_count, directory_size = _directory_stats(directory)
            total_size_bytes += directory_size
            try:
                runtime_path = str(directory.relative_to(Path(get_root_path())))
            except ValueError:
                runtime_path = str(directory)
            path_stats.append(
                StoragePathStatsPayload(
                    key=key,
                    path=runtime_path.replace("\\", "/"),
                    exists=directory.exists(),
                    file_count=file_count,
                    total_size_bytes=directory_size,
                )
            )

        return StorageStatsResponse(total_size_bytes=total_size_bytes, paths=path_stats)
    except Exception as exc:
        logger.error(f"Storage stats error: {exc}")
        raise api_error(
            status_code=500,
            code="SETTINGS_STORAGE_STATS_FAILED",
            message="Failed to collect storage statistics.",
        ) from exc


@router.post("/storage/cleanup", response_model=StorageCleanupResponse)
async def cleanup_storage(request_body: StorageCleanupRequest):
    try:
        if request_body.target != "temp":
            raise api_error(
                status_code=400,
                code="SETTINGS_STORAGE_TARGET_INVALID",
                message="Only the temp storage target is currently supported.",
            )

        temp_root = Path(get_temp_path())
        temp_root.mkdir(parents=True, exist_ok=True)

        deleted_files = 0
        deleted_directories = 0
        reclaimed_bytes = 0
        for candidate in temp_root.iterdir():
            if candidate.is_file():
                reclaimed_bytes += candidate.stat().st_size
                candidate.unlink()
                deleted_files += 1
                continue
            if candidate.is_dir():
                for nested in candidate.rglob("*"):
                    if nested.is_file():
                        reclaimed_bytes += nested.stat().st_size
                        deleted_files += 1
                shutil.rmtree(candidate)
                deleted_directories += 1

        return StorageCleanupResponse(
            target=request_body.target,
            deleted_files=deleted_files,
            deleted_directories=deleted_directories,
            reclaimed_bytes=reclaimed_bytes,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Storage cleanup error: {exc}")
        raise api_error(
            status_code=500,
            code="SETTINGS_STORAGE_CLEANUP_FAILED",
            message="Failed to clean temporary storage.",
        ) from exc
