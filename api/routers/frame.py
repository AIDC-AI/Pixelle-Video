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
Frame/Template rendering endpoints
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from api.auth.dependencies import require_capability
from api.auth.policy import FRAME_RENDER
from api.dependencies import PixelleVideoDep
from api.schemas.frame import FrameRenderRequest, FrameRenderResponse, TemplateParamsResponse
from pixelle_video.services.frame_html import HTMLFrameGenerator
from pixelle_video.utils.template_util import parse_template_size, resolve_template_path

router = APIRouter(prefix="/frame", tags=["Frame Rendering"])

FrameGuard = Annotated[None, Depends(require_capability(FRAME_RENDER))]


@router.post("/render", response_model=FrameRenderResponse)
async def render_frame(
    request: FrameRenderRequest,
    pixelle_video: PixelleVideoDep,
    _guard: FrameGuard,
):
    """
    Render a single frame using HTML template
    
    Generates a frame image by combining template, title, text, and image.
    This is useful for previewing templates or generating custom frames.
    
    - **template**: Template key (e.g., '1080x1920/default.html')
    - **title**: Optional title text
    - **text**: Frame text content
    - **image**: Image path (can be local path or URL)
    
    Returns path to generated frame image.
    
    Example:
    ```json
    {
        "template": "1080x1920/modern.html",
        "title": "Welcome",
        "text": "This is a beautiful frame with custom styling",
        "image": "resources/example.png"
    }
    ```
    """
    try:
        logger.info(f"Frame render request: template={request.template}")
        
        # Resolve template path (returns absolute path with "templates/" or "data/templates/" prefix)
        template_path = resolve_template_path(request.template)
        
        # Parse template size
        width, height = parse_template_size(template_path)
        
        # Create HTML frame generator
        generator = HTMLFrameGenerator(template_path)
        
        # Generate frame
        frame_path = await generator.generate_frame(
            title=request.title,
            text=request.text,
            image=request.image
        )
        
        return FrameRenderResponse(
            frame_path=frame_path,
            width=width,
            height=height
        )
        
    except Exception as e:
        logger.error(f"Frame render error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/template/params", response_model=TemplateParamsResponse)
async def get_template_params(
    template: str
):
    """
    Get custom parameters for a template
    
    Returns the custom parameters defined in the template HTML file.
    These parameters can be passed via `template_params` in video generation requests.
    
    Template parameters are defined using syntax: `{{param_name:type=default}}`
    
    Supported types:
    - `text`: String input
    - `number`: Numeric input
    - `color`: Color picker (hex format)
    - `bool`: Boolean checkbox
    
    Example template syntax:
    ```html
    <div style="color: {{accent_color:color=#ff0000}}">
        {{custom_text:text=Hello World}}
    </div>
    ```
    
    Args:
        template: Template path (e.g., '1080x1920/image_default.html')
    
    Returns:
        Template parameters with their types, defaults, and labels
    
    Example response:
    ```json
    {
        "template": "1080x1920/image_default.html",
        "media_width": 1080,
        "media_height": 1440,
        "params": {
            "accent_color": {
                "type": "color",
                "default": "#ff0000",
                "label": "accent_color"
            },
            "background": {
                "type": "text", 
                "default": "https://example.com/bg.jpg",
                "label": "background"
            }
        }
    }
    ```
    """
    try:
        logger.info(f"Get template params: {template}")
        
        # Resolve template path
        template_path = resolve_template_path(template)
        
        # Create generator and parse parameters
        generator = HTMLFrameGenerator(template_path)
        params = generator.parse_template_parameters()
        media_width, media_height = generator.get_media_size()
        
        return TemplateParamsResponse(
            template=template,
            media_width=media_width,
            media_height=media_height,
            params=params
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Template not found: {template}")
    except Exception as e:
        logger.error(f"Get template params error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

