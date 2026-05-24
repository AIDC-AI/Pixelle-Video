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
File service endpoints

Provides access to generated files (videos, images, audio) and resource files.
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from loguru import logger

router = APIRouter(prefix="/files", tags=["Files"])


@router.get("/{file_path:path}")
async def get_file(file_path: str):
    """
    Get file by path
    
    Serves files from allowed directories:
    - output/ - Generated files (videos, images, audio)
    - workflows/ - ComfyUI workflow files
    - templates/ - HTML templates
    - bgm/ - Background music
    - data/bgm/ - Custom background music
    - data/templates/ - Custom templates
    - resources/ - Other resources (images, fonts, etc.)
    
    - **file_path**: File path relative to allowed directories
    
    Examples:
    - "abc123.mp4" → output/abc123.mp4
    - "workflows/runninghub/image_flux.json" → workflows/runninghub/image_flux.json
    - "templates/1080x1920/default.html" → templates/1080x1920/default.html
    - "bgm/default.mp3" → bgm/default.mp3
    - "resources/example.png" → resources/example.png
    
    Returns file for download or preview.
    """
    try:
        # Define allowed directories (in priority order)
        allowed_prefixes = [
            "output/",
            "workflows/",
            "templates/",
            "bgm/",
            "data/bgm/",
            "data/templates/",
            "resources/",
        ]
        
        # Check if path starts with allowed prefix, otherwise try output/
        full_path = None
        for prefix in allowed_prefixes:
            if file_path.startswith(prefix):
                full_path = file_path
                break
        
        # If no prefix matched, assume it's in output/ (backward compatibility)
        if full_path is None:
            full_path = f"output/{file_path}"
        
        # Resolve to absolute path, following symlinks and normalizing ../
        cwd = Path.cwd().resolve()
        abs_path = (cwd / full_path).resolve()
        
        if not abs_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
        
        if not abs_path.is_file():
            raise HTTPException(status_code=400, detail=f"Path is not a file: {file_path}")
        
        # Security: only allow access to specified directories
        # Build resolved allowed directory paths and check containment
        allowed_dirs = [cwd / prefix.rstrip('/') for prefix in allowed_prefixes]
        is_allowed = any(
            abs_path == allowed_dir or abs_path.is_relative_to(allowed_dir)
            for allowed_dir in allowed_dirs
        )
        
        if not is_allowed:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied: only {', '.join(p.rstrip('/') for p in allowed_prefixes)} directories are accessible"
            )
        
        # Determine media type
        suffix = abs_path.suffix.lower()
        media_types = {
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.html': 'text/html',
            '.json': 'application/json',
        }
        media_type = media_types.get(suffix, 'application/octet-stream')
        
        # Use inline disposition for browser preview
        return FileResponse(
            path=str(abs_path),
            media_type=media_type,
            headers={
                "Content-Disposition": f'inline; filename="{abs_path.name}"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File access error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
