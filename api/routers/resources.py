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
Resource discovery endpoints

Provides endpoints to discover available workflows, templates, and BGM.
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.schemas.resources import (
    WorkflowInfo,
    WorkflowListResponse,
    TemplateInfo,
    TemplateListResponse,
    BGMInfo,
    BGMListResponse,
)
from pixelle_video.utils.os_util import list_resource_files, get_root_path, get_data_path
from pixelle_video.utils.template_util import get_all_templates_with_info

router = APIRouter(prefix="/resources", tags=["Resources"])


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
        all_workflows = pixelle_video.tts.list_workflows()
        
        # Filter to TTS workflows only (filename starts with "tts_")
        tts_workflows = [
            WorkflowInfo(**wf) 
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
        all_workflows = pixelle_video.media.list_workflows()
        
        media_workflows = [WorkflowInfo(**wf) for wf in all_workflows]
        
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
        all_workflows = pixelle_video.media.list_workflows()
        
        # Filter to image workflows only (filename starts with "image_")
        image_workflows = [
            WorkflowInfo(**wf) 
            for wf in all_workflows 
            if wf["name"].startswith("image_")
        ]
        
        return WorkflowListResponse(workflows=image_workflows)
        
    except Exception as e:
        logger.error(f"List image workflows error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates", response_model=TemplateListResponse)
async def list_templates():
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
            templates.append(TemplateInfo(
                name=t.display_info.name,
                display_name=t.display_info.name,
                size=t.display_info.size,
                width=t.display_info.width,
                height=t.display_info.height,
                orientation=t.display_info.orientation,
                path=t.template_path,
                key=t.template_path
            ))
        
        return TemplateListResponse(templates=templates)
        
    except Exception as e:
        logger.error(f"List templates error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bgm", response_model=BGMListResponse)
async def list_bgm():
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
        
        # Convert to response format
        bgm_files = [
            BGMInfo(
                name=name,
                path=info["path"],
                source=info["source"]
            )
            for name, info in sorted(bgm_files_dict.items())
        ]
        
        return BGMListResponse(bgm_files=bgm_files)
        
    except Exception as e:
        logger.error(f"List BGM error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

