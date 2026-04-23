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

"""Resource discovery and editing endpoints."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request, status
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.routers._display_metadata import (
    bgm_display_metadata,
    enrich_workflow_display,
    style_display_metadata,
)
from api.routers._helpers import api_error, path_to_url
from api.schemas.base import BaseResponse
from api.schemas.resources import (
    BGMInfo,
    BGMListResponse,
    PresetItem,
    PresetListResponse,
    PresetUpsertRequest,
    StyleDetail,
    StyleListResponse,
    StyleSummary,
    StyleUpsertRequest,
    TemplateInfo,
    TemplateListResponse,
    WorkflowDetailResponse,
    WorkflowInfo,
    WorkflowListResponse,
)
from pixelle_video.llm_presets import LLM_PRESETS
from pixelle_video.utils.os_util import get_data_path, get_root_path
from pixelle_video.utils.template_util import get_all_templates_with_info

router = APIRouter(prefix="/resources", tags=["Resources"])
_TEMPLATE_PREVIEW_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")


@router.get("/workflows/tts", response_model=WorkflowListResponse)
async def list_tts_workflows(pixelle_video: PixelleVideoDep):
    """
    List available TTS workflows
    
    Returns list of TTS workflows from both RunningHub and self-hosted sources.
    
    Example response:
    ```json
    {
        "workflows": [
            {
                "name": "tts_edge.json",
                "display_name": "tts_edge.json - Runninghub",
                "source": "runninghub",
                "path": "workflows/runninghub/tts_edge.json",
                "key": "runninghub/tts_edge.json",
                "workflow_id": "123456"
            }
        ]
    }
    ```
    """
    try:
        # Get all workflows from TTS service
        if pixelle_video.tts is None:
            raise RuntimeError("TTS service is not initialized")
        all_workflows = pixelle_video.tts.list_workflows()
        
        # Filter to TTS workflows only (filename starts with "tts_")
        tts_workflows = [
            WorkflowInfo(**enrich_workflow_display(wf))
            for wf in all_workflows
            if wf["name"].startswith("tts_")
        ]
        
        return WorkflowListResponse(workflows=tts_workflows)
        
    except Exception as e:
        logger.error(f"List TTS workflows error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows/media", response_model=WorkflowListResponse)
async def list_media_workflows(pixelle_video: PixelleVideoDep):
    """
    List available media workflows (both image and video)
    
    Returns list of all media workflows from both RunningHub and self-hosted sources.
    
    Example response:
    ```json
    {
        "workflows": [
            {
                "name": "image_flux.json",
                "display_name": "image_flux.json - Runninghub",
                "source": "runninghub",
                "path": "workflows/runninghub/image_flux.json",
                "key": "runninghub/image_flux.json",
                "workflow_id": "123456"
            },
            {
                "name": "video_wan2.1.json",
                "display_name": "video_wan2.1.json - Runninghub",
                "source": "runninghub",
                "path": "workflows/runninghub/video_wan2.1.json",
                "key": "runninghub/video_wan2.1.json",
                "workflow_id": "123457"
            }
        ]
    }
    ```
    """
    try:
        # Get all workflows from media service (includes both image and video)
        if pixelle_video.media is None:
            raise RuntimeError("Media service is not initialized")
        all_workflows = pixelle_video.media.list_workflows()
        
        media_workflows = [WorkflowInfo(**enrich_workflow_display(wf)) for wf in all_workflows]
        
        return WorkflowListResponse(workflows=media_workflows)
        
    except Exception as e:
        logger.error(f"List media workflows error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Keep old endpoint for backward compatibility
@router.get("/workflows/image", response_model=WorkflowListResponse)
async def list_image_workflows(pixelle_video: PixelleVideoDep):
    """
    List available image workflows (deprecated, use /workflows/media instead)
    
    This endpoint is kept for backward compatibility but will filter to image_ workflows only.
    """
    try:
        if pixelle_video.media is None:
            raise RuntimeError("Media service is not initialized")
        all_workflows = pixelle_video.media.list_workflows()
        
        # Filter to image workflows only (filename starts with "image_")
        image_workflows = [
            WorkflowInfo(**enrich_workflow_display(wf))
            for wf in all_workflows
            if wf["name"].startswith("image_")
        ]
        
        return WorkflowListResponse(workflows=image_workflows)
        
    except Exception as e:
        logger.error(f"List image workflows error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _template_preview_relative_path(template_key: str) -> str | None:
    template_path = Path(template_key)
    preview_dir = Path(get_root_path("resources", "template_previews", template_path.parent.name))
    if not preview_dir.exists():
        return None

    for extension in _TEMPLATE_PREVIEW_EXTENSIONS:
        candidate = preview_dir / f"{template_path.stem}{extension}"
        if candidate.exists():
            return f"resources/template_previews/{template_path.parent.name}/{candidate.name}"

    return None


def _resolve_workflow(pixelle_video: PixelleVideoDep, workflow_id: str) -> dict[str, Any] | None:
    return next(
        (
            item
            for item in _list_all_workflows(pixelle_video)
            if workflow_id in {item.get("key"), item.get("workflow_id"), item.get("name"), item.get("path")}
        ),
        None,
    )


def _workflow_disk_path(workflow: dict[str, Any]) -> Path:
    return Path(get_root_path(workflow["path"]))


def _workflow_detail_response(workflow: dict[str, Any], workflow_json: dict[str, Any]) -> WorkflowDetailResponse:
    raw_nodes = list(workflow_json.keys()) if isinstance(workflow_json, dict) else []
    workflow_path = _workflow_disk_path(workflow)
    return WorkflowDetailResponse(
        **WorkflowInfo(**enrich_workflow_display(workflow)).model_dump(),
        editable=workflow.get("source") == "selfhost",
        metadata={
            "node_count": len(raw_nodes),
            "path_exists": workflow_path.exists(),
            "source_path": workflow["path"],
        },
        key_parameters=raw_nodes[:20],
        raw_nodes=raw_nodes,
        workflow_json=workflow_json if isinstance(workflow_json, dict) else {},
    )


def _builtin_preset_items() -> list[PresetItem]:
    return [
        PresetItem(
            name=preset["name"],
            description=f"Built-in LLM preset for {preset['name']}",
            pipeline="llm",
            payload_template={
                "llm": {
                    "base_url": preset.get("base_url"),
                    "model": preset.get("model"),
                    "api_key": preset.get("default_api_key", ""),
                }
            },
            created_at=None,
            source="builtin",
        )
        for preset in LLM_PRESETS
    ]


def _builtin_preset_names() -> set[str]:
    return {preset["name"] for preset in LLM_PRESETS}


async def _get_user_preset(pixelle_video: PixelleVideoDep, name: str) -> dict[str, Any] | None:
    if pixelle_video.persistence is None:
        return None
    presets = await pixelle_video.persistence.list_presets()
    return next((preset for preset in presets if preset.get("name") == name), None)


def _resolve_bgm_style_links(pixelle_video: PixelleVideoDep) -> dict[str, dict[str, str]]:
    registry = getattr(pixelle_video, "styles", None)
    if registry is None:
        return {}

    linked: dict[str, dict[str, str]] = {}
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
        linked[str(bgm_name)] = {
            "linked_style_id": style["id"],
            "linked_style_name": style["name"],
            "linked_style_display_name_zh": style_display.get("display_name_zh") or style["name"],
        }
    return linked


def _style_to_summary(request: Request, style: dict[str, Any]) -> StyleSummary:
    bgm_name = style.get("runtime_config", {}).get("bgm")
    preview_bgm_url = path_to_url(request, f"bgm/{bgm_name}") if bgm_name else None
    display = style_display_metadata(
        style.get("id"),
        style.get("name"),
        style.get("description"),
        style.get("scene"),
        style.get("tone"),
    )
    return StyleSummary(
        id=style["id"],
        name=style["name"],
        display_name_zh=display.get("display_name_zh"),
        short_description_zh=display.get("short_description_zh"),
        description=style.get("description"),
        scene=style.get("scene"),
        tone=style.get("tone"),
        is_builtin=style.get("is_builtin", False),
        preview_bgm_url=preview_bgm_url,
    )


def _style_to_detail(request: Request, style: dict[str, Any]) -> StyleDetail:
    summary = _style_to_summary(request, style)
    return StyleDetail(
        **summary.model_dump(),
        analysis_creative_layer=style.get("analysis_creative_layer") or "",
        audio_sync_creative_layer=style.get("audio_sync_creative_layer") or "",
        reference_config=style.get("reference_config") or {},
        runtime_config=style.get("runtime_config") or {},
    )


def _bgm_to_info(name: str, info: dict[str, str], linked_style: dict[str, str] | None) -> BGMInfo:
    display = bgm_display_metadata(
        name=name,
        source=info["source"],
        linked_style_id=linked_style.get("linked_style_id") if linked_style else None,
        linked_style_name=linked_style.get("linked_style_display_name_zh") if linked_style else None,
    )
    return BGMInfo(
        name=name,
        path=info["path"],
        source=info["source"],
        display_name_zh=display.get("display_name_zh"),
        description_zh=display.get("description_zh"),
        source_label=display.get("source_label"),
        linked_style_display_name_zh=display.get("linked_style_display_name_zh"),
        technical_name=display.get("technical_name"),
        linked_style_id=linked_style.get("linked_style_id") if linked_style else None,
        linked_style_name=linked_style.get("linked_style_name") if linked_style else None,
    )


@router.get("/templates", response_model=TemplateListResponse)
async def list_templates(request: Request):
    """
    List available video templates
    
    Returns list of HTML templates grouped by size (portrait, landscape, square).
    Templates are merged from both default (templates/) and custom (data/templates/) directories.
    
    Example response:
    ```json
    {
        "templates": [
            {
                "name": "default.html",
                "display_name": "default.html",
                "size": "1080x1920",
                "width": 1080,
                "height": 1920,
                "orientation": "portrait",
                "path": "templates/1080x1920/default.html",
                "key": "1080x1920/default.html"
            }
        ]
    }
    ```
    """
    try:
        # Get all templates with info
        all_templates = get_all_templates_with_info()
        
        # Convert to API response format
        templates = []
        for t in all_templates:
            preview_path = _template_preview_relative_path(t.template_path)
            templates.append(TemplateInfo(
                name=t.display_info.name,
                display_name=t.display_info.name,
                size=t.display_info.size,
                width=t.display_info.width,
                height=t.display_info.height,
                orientation=t.display_info.orientation,
                path=t.template_path,
                key=t.template_path,
                preview_image_url=path_to_url(request, preview_path) if preview_path else None,
                preview_available=preview_path is not None,
            ))
        
        return TemplateListResponse(templates=templates)
        
    except Exception as e:
        logger.error(f"List templates error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bgm", response_model=BGMListResponse)
async def list_bgm(
    request: Request,
    pixelle_video: PixelleVideoDep,
):
    """
    List available background music files
    
    Returns list of BGM files merged from both default (bgm/) and custom (data/bgm/) directories.
    Custom files take precedence over default files with the same name.
    
    Supported formats: mp3, wav, flac, m4a, aac, ogg
    
    Example response:
    ```json
    {
        "bgm_files": [
            {
                "name": "default.mp3",
                "path": "bgm/default.mp3",
                "source": "default"
            },
            {
                "name": "happy.mp3",
                "path": "data/bgm/happy.mp3",
                "source": "custom"
            }
        ]
    }
    ```
    """
    try:
        # Supported audio extensions
        audio_extensions = ('.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg')
        
        # Collect BGM files from both locations
        bgm_files_dict = {}  # {filename: {"path": str, "source": str}}
        
        # Scan default bgm/ directory
        default_bgm_dir = Path(get_root_path("bgm"))
        if default_bgm_dir.exists() and default_bgm_dir.is_dir():
            for item in default_bgm_dir.iterdir():
                if item.is_file() and item.suffix.lower() in audio_extensions:
                    bgm_files_dict[item.name] = {
                        "path": f"bgm/{item.name}",
                        "source": "default"
                    }
        
        # Scan custom data/bgm/ directory (overrides default)
        custom_bgm_dir = Path(get_data_path("bgm"))
        if custom_bgm_dir.exists() and custom_bgm_dir.is_dir():
            for item in custom_bgm_dir.iterdir():
                if item.is_file() and item.suffix.lower() in audio_extensions:
                    bgm_files_dict[item.name] = {
                        "path": f"data/bgm/{item.name}",
                        "source": "custom"
                    }
        
        linked_styles = _resolve_bgm_style_links(pixelle_video)

        # Convert to response format
        bgm_files = [
            _bgm_to_info(name, info, linked_styles.get(name))
            for name, info in sorted(bgm_files_dict.items())
        ]
        
        return BGMListResponse(bgm_files=bgm_files)
        
    except Exception as e:
        logger.error(f"List BGM error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/styles", response_model=StyleListResponse)
async def list_styles(
    request: Request,
    pixelle_video: PixelleVideoDep,
):
    try:
        registry = getattr(pixelle_video, "styles", None)
        if registry is None:
            raise RuntimeError("Style registry is not initialized")
        return StyleListResponse(styles=[_style_to_summary(request, style) for style in registry.list_styles()])
    except Exception as exc:
        logger.error(f"Style listing error: {exc}")
        raise api_error(
            status_code=500,
            code="STYLE_LIST_FAILED",
            message="Failed to list styles.",
        ) from exc


@router.post("/styles", response_model=StyleDetail, status_code=status.HTTP_201_CREATED)
async def create_style(
    request_body: StyleUpsertRequest,
    request: Request,
    pixelle_video: PixelleVideoDep,
):
    try:
        registry = getattr(pixelle_video, "styles", None)
        if registry is None:
            raise RuntimeError("Style registry is not initialized")
        created = registry.upsert_style(request_body.model_dump())
        return _style_to_detail(request, created)
    except PermissionError as exc:
        raise api_error(status_code=403, code="STYLE_READ_ONLY", message=str(exc)) from exc
    except ValueError as exc:
        raise api_error(status_code=400, code="STYLE_INVALID", message=str(exc)) from exc
    except Exception as exc:
        logger.error(f"Style create error: {exc}")
        raise api_error(
            status_code=500,
            code="STYLE_CREATE_FAILED",
            message="Failed to create style.",
        ) from exc


@router.get("/styles/{style_id}", response_model=StyleDetail)
async def get_style_detail(
    style_id: str,
    request: Request,
    pixelle_video: PixelleVideoDep,
):
    try:
        registry = getattr(pixelle_video, "styles", None)
        if registry is None:
            raise RuntimeError("Style registry is not initialized")
        style = registry.get_style(style_id)
        if style is None:
            raise api_error(status_code=404, code="STYLE_NOT_FOUND", message="Style not found.")
        return _style_to_detail(request, style)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Style detail error: {exc}")
        raise api_error(
            status_code=500,
            code="STYLE_FETCH_FAILED",
            message="Failed to fetch style detail.",
        ) from exc


@router.put("/styles/{style_id}", response_model=StyleDetail)
async def update_style(
    style_id: str,
    request_body: StyleUpsertRequest,
    request: Request,
    pixelle_video: PixelleVideoDep,
):
    try:
        registry = getattr(pixelle_video, "styles", None)
        if registry is None:
            raise RuntimeError("Style registry is not initialized")
        updated = registry.upsert_style(request_body.model_dump(), existing_id=style_id)
        return _style_to_detail(request, updated)
    except PermissionError as exc:
        raise api_error(status_code=403, code="STYLE_READ_ONLY", message=str(exc)) from exc
    except ValueError as exc:
        raise api_error(status_code=400, code="STYLE_INVALID", message=str(exc)) from exc
    except Exception as exc:
        logger.error(f"Style update error: {exc}")
        raise api_error(
            status_code=500,
            code="STYLE_UPDATE_FAILED",
            message="Failed to update style.",
        ) from exc


@router.delete("/styles/{style_id}", response_model=BaseResponse)
async def delete_style(
    style_id: str,
    pixelle_video: PixelleVideoDep,
):
    try:
        registry = getattr(pixelle_video, "styles", None)
        if registry is None:
            raise RuntimeError("Style registry is not initialized")
        deleted = registry.delete_style(style_id)
        if not deleted:
            raise api_error(status_code=404, code="STYLE_NOT_FOUND", message="Style not found.")
        return BaseResponse(message="Style deleted.")
    except PermissionError as exc:
        raise api_error(status_code=403, code="STYLE_READ_ONLY", message=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Style delete error: {exc}")
        raise api_error(
            status_code=500,
            code="STYLE_DELETE_FAILED",
            message="Failed to delete style.",
        ) from exc


def _list_all_workflows(pixelle_video) -> list[dict]:
    if pixelle_video.tts is None or pixelle_video.media is None:
        raise RuntimeError("Workflow services are not initialized")
    all_workflows = pixelle_video.tts.list_workflows() + pixelle_video.media.list_workflows()
    deduped: dict[str, dict] = {}
    for workflow in all_workflows:
        deduped[workflow["key"]] = enrich_workflow_display(workflow)
    return list(deduped.values())


@router.get("/workflows/{workflow_id:path}", response_model=WorkflowDetailResponse)
async def get_workflow_detail(workflow_id: str, pixelle_video: PixelleVideoDep):
    try:
        workflow = _resolve_workflow(pixelle_video, workflow_id)
        if workflow is None:
            raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")

        workflow_path = _workflow_disk_path(workflow)
        if not workflow_path.exists():
            raise HTTPException(status_code=404, detail=f"Workflow file missing: {workflow['path']}")

        workflow_json = json.loads(workflow_path.read_text(encoding="utf-8"))
        return _workflow_detail_response(workflow, workflow_json)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Workflow detail error: {exc}")
        raise api_error(
            status_code=500,
            code="WORKFLOW_FETCH_FAILED",
            message="Failed to fetch workflow detail.",
        ) from exc


@router.put("/workflows/{workflow_id:path}", response_model=WorkflowDetailResponse)
async def update_workflow_detail(
    workflow_id: str,
    pixelle_video: PixelleVideoDep,
    workflow_json: dict[str, Any] = Body(..., description="Full workflow JSON"),
):
    try:
        workflow = _resolve_workflow(pixelle_video, workflow_id)
        if workflow is None:
            raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")
        if workflow.get("source") != "selfhost":
            raise api_error(
                status_code=403,
                code="WORKFLOW_READ_ONLY",
                message="Only selfhost workflows can be edited.",
            )

        workflow_path_value = str(workflow["path"]).replace("\\", "/")
        if not workflow_path_value.startswith(("workflows/selfhost/", "data/workflows/selfhost/")):
            raise api_error(
                status_code=403,
                code="WORKFLOW_INVALID_TARGET",
                message="Workflow path is outside the editable selfhost directories.",
            )

        workflow_path = _workflow_disk_path(workflow)
        workflow_path.parent.mkdir(parents=True, exist_ok=True)
        resolved_path = workflow_path.resolve(strict=False)
        allowed_roots = (
            Path(get_root_path("workflows", "selfhost")).resolve(strict=False),
            Path(get_root_path("data", "workflows", "selfhost")).resolve(strict=False),
        )
        if not any(resolved_path.is_relative_to(root) for root in allowed_roots):
            raise api_error(
                status_code=403,
                code="WORKFLOW_INVALID_TARGET",
                message="Workflow path is outside the editable selfhost directories.",
            )

        workflow_path.write_text(
            json.dumps(workflow_json, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        return _workflow_detail_response(workflow, workflow_json)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Workflow update error: {exc}")
        raise api_error(
            status_code=500,
            code="WORKFLOW_UPDATE_FAILED",
            message="Failed to update workflow detail.",
        ) from exc


@router.get("/presets", response_model=PresetListResponse)
async def list_presets(pixelle_video: PixelleVideoDep):
    try:
        builtin_presets = _builtin_preset_items()
        user_presets = []
        if pixelle_video.persistence is not None:
            user_presets = [
                PresetItem(**preset)
                for preset in await pixelle_video.persistence.list_presets()
            ]
        return PresetListResponse(presets=[*builtin_presets, *user_presets])
    except Exception as exc:
        logger.error(f"Preset listing error: {exc}")
        raise api_error(
            status_code=500,
            code="PRESET_LIST_FAILED",
            message="Failed to list presets.",
        ) from exc


@router.post("/presets", response_model=PresetItem, status_code=status.HTTP_201_CREATED)
async def create_preset(
    request_body: PresetUpsertRequest,
    pixelle_video: PixelleVideoDep,
):
    try:
        if pixelle_video.persistence is None:
            raise RuntimeError("Persistence service is not initialized")
        if request_body.name in _builtin_preset_names():
            raise api_error(
                status_code=403,
                code="PRESET_READ_ONLY",
                message="Built-in presets cannot be overwritten.",
            )
        if await _get_user_preset(pixelle_video, request_body.name) is not None:
            raise api_error(
                status_code=409,
                code="PRESET_ALREADY_EXISTS",
                message="A user preset with that name already exists.",
            )

        now = datetime.now().isoformat()
        preset = PresetItem(
            name=request_body.name,
            description=request_body.description,
            pipeline=request_body.pipeline,
            payload_template=request_body.payload_template,
            created_at=now,
            source="user",
        )
        await pixelle_video.persistence.upsert_preset(preset.model_dump(mode="json"))
        return preset
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Preset create error: {exc}")
        raise api_error(
            status_code=500,
            code="PRESET_CREATE_FAILED",
            message="Failed to create preset.",
        ) from exc


@router.put("/presets/{name}", response_model=PresetItem)
async def update_preset(
    name: str,
    request_body: PresetUpsertRequest,
    pixelle_video: PixelleVideoDep,
):
    try:
        if pixelle_video.persistence is None:
            raise RuntimeError("Persistence service is not initialized")
        if name in _builtin_preset_names():
            raise api_error(
                status_code=403,
                code="PRESET_READ_ONLY",
                message="Built-in presets cannot be edited.",
            )
        if request_body.name != name:
            raise api_error(
                status_code=400,
                code="PRESET_NAME_MISMATCH",
                message="Preset name in the request body must match the route parameter.",
            )

        existing = await _get_user_preset(pixelle_video, name)
        if existing is None:
            raise api_error(
                status_code=404,
                code="PRESET_NOT_FOUND",
                message="Preset not found.",
            )

        preset = PresetItem(
            name=name,
            description=request_body.description,
            pipeline=request_body.pipeline,
            payload_template=request_body.payload_template,
            created_at=existing.get("created_at"),
            source="user",
        )
        await pixelle_video.persistence.upsert_preset(preset.model_dump(mode="json"))
        return preset
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Preset update error: {exc}")
        raise api_error(
            status_code=500,
            code="PRESET_UPDATE_FAILED",
            message="Failed to update preset.",
        ) from exc


@router.delete("/presets/{name}", response_model=BaseResponse)
async def delete_preset(
    name: str,
    pixelle_video: PixelleVideoDep,
):
    try:
        if pixelle_video.persistence is None:
            raise RuntimeError("Persistence service is not initialized")
        if name in _builtin_preset_names():
            raise api_error(
                status_code=403,
                code="PRESET_READ_ONLY",
                message="Built-in presets cannot be deleted.",
            )

        deleted = await pixelle_video.persistence.delete_preset(name)
        if not deleted:
            raise api_error(
                status_code=404,
                code="PRESET_NOT_FOUND",
                message="Preset not found.",
            )
        return BaseResponse(message="Preset deleted.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Preset delete error: {exc}")
        raise api_error(
            status_code=500,
            code="PRESET_DELETE_FAILED",
            message="Failed to delete preset.",
        ) from exc
