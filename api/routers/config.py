# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Config management endpoints.

Exposes `pixelle_video.config.config_manager` over HTTP for the web-next
Settings UI. All endpoints are thin wrappers around the existing manager
methods — no business logic is duplicated.
"""

import os
from typing import Annotated

import requests
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from api.auth.dependencies import require_capability
from api.auth.models import User
from api.auth.policy import SETTINGS_MANAGE
from pixelle_video.config import config_manager
from api.schemas.config import (
    APIProvidersCommonUpdate,
    APIProviderConfig,
    ComfyUIConfig,
    ComfyUIConfigUpdate,
    ComfyUITestRequest,
    ComfyUITestResponse,
    FullConfig,
    LLMConfig,
    LLMConfigUpdate,
    LLMTestRequest,
    LLMTestResponse,
    RunningHubTestRequest,
    RunningHubTestResponse,
)

router = APIRouter(prefix="/config", tags=["Config"])

SettingsGuard = Annotated[None, Depends(require_capability(SETTINGS_MANAGE))]


# === Helpers ===

_PROVIDER_NAMES = ("openai", "dashscope", "ark", "kling")


def _build_full_config() -> FullConfig:
    """Snapshot the current config into the API shape."""
    llm = config_manager.get_llm_config()
    comfyui = config_manager.get_comfyui_config()
    providers = config_manager.get_api_providers_config()
    return FullConfig(
        llm=LLMConfig(**llm),
        comfyui=ComfyUIConfig(
            comfyui_url=comfyui.get("comfyui_url", "http://127.0.0.1:8188") or "http://127.0.0.1:8188",
            comfyui_api_key=comfyui.get("comfyui_api_key", "") or "",
            runninghub_api_key=comfyui.get("runninghub_api_key", "") or "",
            runninghub_concurrent_limit=int(comfyui.get("runninghub_concurrent_limit", 1) or 1),
            runninghub_instance_type=comfyui.get("runninghub_instance_type") or None,
        ),
        api_providers=providers,  # Pydantic will coerce via model_validate
    )


# === Endpoints ===

@router.get("", response_model=FullConfig)
async def get_config(_guard: SettingsGuard):
    """Return the current full config (LLM + ComfyUI + 4 API providers)."""
    return _build_full_config()


@router.put("/llm", response_model=LLMConfig)
async def update_llm(body: LLMConfigUpdate, _guard: SettingsGuard):
    """Update LLM config. Empty values are stored as empty strings so the
    user can clear a previously-saved key. Saving persists to disk."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    current = config_manager.get_llm_config()
    merged = {**current, **updates}
    config_manager.set_llm_config(
        api_key=merged.get("api_key", ""),
        base_url=merged.get("base_url", ""),
        model=merged.get("model", ""),
    )
    config_manager.save()
    logger.info("LLM config updated")
    return config_manager.get_llm_config()


@router.put("/comfyui", response_model=ComfyUIConfig)
async def update_comfyui(body: ComfyUIConfigUpdate, _guard: SettingsGuard):
    """Update ComfyUI + RunningHub config and persist."""
    config_manager.set_comfyui_config(
        comfyui_url=body.comfyui_url,
        comfyui_api_key=body.comfyui_api_key,
        runninghub_api_key=body.runninghub_api_key,
        runninghub_concurrent_limit=body.runninghub_concurrent_limit,
        runninghub_instance_type=body.runninghub_instance_type or "",
    )
    config_manager.save()
    logger.info("ComfyUI config updated")
    saved = config_manager.get_comfyui_config()
    return ComfyUIConfig(
        comfyui_url=saved.get("comfyui_url", "http://127.0.0.1:8188") or "http://127.0.0.1:8188",
        comfyui_api_key=saved.get("comfyui_api_key", "") or "",
        runninghub_api_key=saved.get("runninghub_api_key", "") or "",
        runninghub_concurrent_limit=int(saved.get("runninghub_concurrent_limit", 1) or 1),
        runninghub_instance_type=saved.get("runninghub_instance_type") or None,
    )


@router.put("/api-providers/common", response_model=APIProvidersCommonUpdate)
async def update_api_providers_common(body: APIProvidersCommonUpdate, _guard: SettingsGuard):
    """Update shared media-provider settings (proxy + debug)."""
    current = config_manager.get_api_providers_config().get("common", {})
    merged = {**current, **body.model_dump(exclude_none=True)}
    config_manager.set_api_provider_config("common", merged)
    config_manager.save()
    logger.info("API providers common config updated")
    return merged


@router.put("/api-providers/{name}", response_model=APIProviderConfig)
async def update_api_provider(name: str, body: APIProviderConfig, _guard: SettingsGuard):
    """Update a single API provider (openai / dashscope / ark / kling)."""
    if name not in _PROVIDER_NAMES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown provider '{name}'. Valid: {', '.join(_PROVIDER_NAMES)}",
        )
    payload = body.model_dump()
    config_manager.set_api_provider_config(name, payload)
    config_manager.save()
    logger.info(f"API provider '{name}' config updated")
    return payload


@router.post("/test-llm", response_model=LLMTestResponse)
async def test_llm(body: LLMTestRequest, _guard: SettingsGuard):
    """Probe the LLM endpoint by listing models. Mirrors the old Streamlit
    `test_llm_connection` helper."""
    from pixelle_video.utils.llm_util import test_llm_connection
    try:
        ok, message, model_count = test_llm_connection(body.api_key, body.base_url)
    except Exception as e:
        logger.warning(f"LLM test failed: {e}")
        return LLMTestResponse(success=False, message=str(e))
    return LLMTestResponse(success=ok, message=message, model_count=model_count)


@router.post("/test-comfyui", response_model=ComfyUITestResponse)
async def test_comfyui(body: ComfyUITestRequest, _guard: SettingsGuard):
    """Ping ComfyUI /system_stats to verify reachability."""
    url = (body.url or "").rstrip("/")
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    try:
        response = requests.get(f"{url}/system_stats", timeout=5)
        if response.status_code == 200:
            return ComfyUITestResponse(success=True, message="Reachable")
        return ComfyUITestResponse(
            success=False,
            message=f"HTTP {response.status_code}",
        )
    except Exception as e:
        return ComfyUITestResponse(success=False, message=str(e))


@router.post("/test-runninghub", response_model=RunningHubTestResponse)
async def test_runninghub(body: RunningHubTestRequest, _guard: SettingsGuard):
    """Verify RunningHub API key by attempting authentication.

    Uses the create task endpoint with a non-existent workflow ID.
    A valid key will return a workflow-level error (e.g. WORKFLOW_NOT_EXISTS).
    An invalid key will return an auth-level error (code 1001).
    """
    api_key = body.api_key.strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key is required")
    base_url = (os.getenv("RUNNINGHUB_BASE_URL") or "https://www.runninghub.ai").rstrip("/")

    # Call the RunningHub create task endpoint — this validates the API key
    # before checking workflow parameters. A valid key gets past auth even
    # with a fake workflow ID.
    try:
        response = requests.post(
            f"{base_url}/task/openapi/create",
            json={"apiKey": api_key, "workflowId": "0"},
            timeout=15,
        )
        data = response.json()
        code = data.get("code")
        msg = data.get("msg", "Unknown response")

        # code 0 / 1001+ — different error tiers
        if code == 0:
            return RunningHubTestResponse(success=True, message="API key valid")
        elif code == 1001:
            return RunningHubTestResponse(success=False, message=f"Invalid API key: {msg}")
        else:
            # Any other code means the key *passed* auth but the request
            # failed for another reason (e.g. workflow not found).
            # That's still a success for key validation.
            return RunningHubTestResponse(
                success=True,
                message=f"API key valid (response: {msg})",
            )
    except requests.exceptions.JSONDecodeError:
        return RunningHubTestResponse(
            success=False,
            message=f"Non-JSON response (HTTP {response.status_code}): {response.text[:200]}",
        )
    except requests.exceptions.ConnectionError as e:
        return RunningHubTestResponse(
            success=False,
            message=f"Cannot reach {base_url}: {e}",
        )
    except Exception as e:
        return RunningHubTestResponse(success=False, message=str(e))


@router.post("/reset", response_model=FullConfig)
async def reset_config(_guard: SettingsGuard):
    """Reset all config to defaults and persist."""
    from pixelle_video.config.schema import PixelleVideoConfig
    config_manager.config = PixelleVideoConfig()
    config_manager.save()
    logger.info("Config reset to defaults")
    return _build_full_config()
