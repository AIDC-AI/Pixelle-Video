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
Pixelle-Video FastAPI Application

Main FastAPI app with all routers and middleware.

Run this script to start the FastAPI server:
    uv run python api/app.py
    
Or with custom settings:
    uv run python api/app.py --host 0.0.0.0 --port 8080 --reload
"""

import sys
from pathlib import Path

# Add project root to sys.path for module imports
# This ensures imports work correctly in both development and packaged environments
_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

import argparse
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from api.config import api_config
from api.tasks import task_manager
from api.dependencies import shutdown_pixelle_video

# Import routers
from api.routers import (
    health_router,
    llm_router,
    tts_router,
    image_router,
    content_router,
    video_router,
    tasks_router,
    files_router,
    resources_router,
    frame_router,
    script_extract_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("🚀 Starting Pixelle-Video API...")
    await task_manager.start()
    logger.info("✅ Pixelle-Video API started successfully\n")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Pixelle-Video API...")
    await task_manager.stop()
    await shutdown_pixelle_video()
    logger.info("✅ Pixelle-Video API shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Pixelle-Video API",
    description="""
    ## Pixelle-Video - AI Video Generation Platform API
    
    ### Features
    - 🤖 **LLM**: Large language model integration
    - 🔊 **TTS**: Text-to-speech synthesis
    - 🎨 **Image**: AI image generation
    - 📝 **Content**: Automated content generation
    - 🎬 **Video**: End-to-end video generation
    
    ### Video Generation Modes
    - **Sync**: `/api/video/generate/sync` - For small videos (< 30s)
    - **Async**: `/api/video/generate/async` - For large videos with task tracking
    
    ### Getting Started
    1. Check health: `GET /health`
    2. Generate narrations: `POST /api/content/narration`
    3. Generate video: `POST /api/video/generate/sync` or `/async`
    4. Track task progress: `GET /api/tasks/{task_id}`
    """,
    version="0.1.0",
    docs_url=api_config.docs_url,
    redoc_url=api_config.redoc_url,
    openapi_url=api_config.openapi_url,
    lifespan=lifespan,
)

# Add CORS middleware
if api_config.cors_enabled:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=api_config.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.info(f"CORS enabled for origins: {api_config.cors_origins}")

# Include routers
# Health check (no prefix)
app.include_router(health_router)

# API routers (with /api prefix)
app.include_router(llm_router, prefix=api_config.api_prefix)
app.include_router(tts_router, prefix=api_config.api_prefix)
app.include_router(image_router, prefix=api_config.api_prefix)
app.include_router(content_router, prefix=api_config.api_prefix)
app.include_router(video_router, prefix=api_config.api_prefix)
app.include_router(tasks_router, prefix=api_config.api_prefix)
app.include_router(files_router, prefix=api_config.api_prefix)
app.include_router(resources_router, prefix=api_config.api_prefix)
app.include_router(frame_router, prefix=api_config.api_prefix)
app.include_router(script_extract_router, prefix=api_config.api_prefix)


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Pixelle-Video API",
        "version": "0.1.0",
        "docs": api_config.docs_url,
        "health": "/health",
        "api": {
            "llm": f"{api_config.api_prefix}/llm",
            "tts": f"{api_config.api_prefix}/tts",
            "image": f"{api_config.api_prefix}/image",
            "content": f"{api_config.api_prefix}/content",
            "video": f"{api_config.api_prefix}/video",
            "tasks": f"{api_config.api_prefix}/tasks",
            "files": f"{api_config.api_prefix}/files",
            "resources": f"{api_config.api_prefix}/resources",
            "frame": f"{api_config.api_prefix}/frame",
            "script": f"{api_config.api_prefix}/script",
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Start Pixelle-Video API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    
    args = parser.parse_args()
    
    # Print startup banner
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║                    Pixelle-Video API Server                      ║
╚══════════════════════════════════════════════════════════════╝

Starting server at http://{args.host}:{args.port}
API Docs: http://{args.host}:{args.port}/docs
ReDoc: http://{args.host}:{args.port}/redoc

Press Ctrl+C to stop the server
""")
    
    # Start server
    uvicorn.run(
        "api.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )

