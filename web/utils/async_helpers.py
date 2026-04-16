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
Async helper functions for web UI
"""

import asyncio
import sys
import threading
import tomllib
from pathlib import Path

from loguru import logger

_loop: asyncio.AbstractEventLoop | None = None
_lock = threading.Lock()


def _get_event_loop() -> asyncio.AbstractEventLoop:
    """Return a persistent event loop (never closed between calls).

    Unlike ``asyncio.run()`` which creates **and closes** a loop each time,
    this keeps the loop alive so that long-lived objects bound to it (e.g.
    Playwright browser instances) remain valid across consecutive calls.

    On Windows we use ProactorEventLoop because SelectorEventLoop (the
    default in Python 3.14) does not support subprocesses.
    """
    global _loop
    if _loop is not None and not _loop.is_closed():
        return _loop
    with _lock:
        if _loop is not None and not _loop.is_closed():
            return _loop
        if sys.platform == "win32":
            _loop = asyncio.ProactorEventLoop()
        else:
            _loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_loop)
    return _loop


def run_async(coro):
    """Run async coroutine in sync context (same thread, preserves Streamlit session)"""
    loop = _get_event_loop()
    return loop.run_until_complete(coro)


def get_project_version():
    """Get project version from pyproject.toml"""
    try:
        # Get project root (web parent directory)
        web_dir = Path(__file__).resolve().parent.parent
        project_root = web_dir.parent
        pyproject_path = project_root / "pyproject.toml"
        
        if pyproject_path.exists():
            with open(pyproject_path, "rb") as f:
                pyproject_data = tomllib.load(f)
                return pyproject_data.get("project", {}).get("version", "Unknown")
    except Exception as e:
        logger.warning(f"Failed to read version from pyproject.toml: {e}")
    return "Unknown"

