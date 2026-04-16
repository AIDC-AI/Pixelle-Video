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
API Routers
"""

from api.routers.health import router as health_router
from api.routers.llm import router as llm_router
from api.routers.tts import router as tts_router
from api.routers.image import router as image_router
from api.routers.content import router as content_router
from api.routers.video import router as video_router
from api.routers.tasks import router as tasks_router
from api.routers.files import router as files_router
from api.routers.resources import router as resources_router
from api.routers.frame import router as frame_router
from api.routers.script_extract import router as script_extract_router

__all__ = [
    "health_router",
    "llm_router",
    "tts_router",
    "image_router",
    "content_router",
    "video_router",
    "tasks_router",
    "files_router",
    "resources_router",
    "frame_router",
    "script_extract_router",
]

