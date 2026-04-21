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
_loop_thread: threading.Thread | None = None
_lock = threading.Lock()


def _get_event_loop() -> asyncio.AbstractEventLoop:
    """Return a persistent event loop running in a background daemon thread.

    Unlike ``asyncio.run()`` which creates **and closes** a loop each time,
    this keeps the loop alive so that long-lived objects bound to it (e.g.
    Playwright browser instances) remain valid across consecutive calls.

    Running in a background thread avoids ``RuntimeError: This event loop is
    already running`` when called from Streamlit's async execution context.

    On Windows we use ProactorEventLoop because SelectorEventLoop (the
    default in Python 3.14) does not support subprocesses.
    """
    global _loop, _loop_thread
    if _loop is not None and not _loop.is_closed() and _loop.is_running():
        return _loop
    with _lock:
        if _loop is not None and not _loop.is_closed() and _loop.is_running():
            return _loop
        if sys.platform == "win32":
            loop = asyncio.ProactorEventLoop()
        else:
            loop = asyncio.new_event_loop()

        def _run_forever():
            asyncio.set_event_loop(loop)
            loop.run_forever()

        t = threading.Thread(target=_run_forever, daemon=True, name="pixelle-async-loop")
        t.start()
        # Wait until the loop is actually running before returning
        while not loop.is_running():
            pass
        _loop = loop
        _loop_thread = t
    return _loop


def run_async(coro):
    """Run async coroutine from any context, including Streamlit's async pages."""
    loop = _get_event_loop()
    future = asyncio.run_coroutine_threadsafe(coro, loop)
    return future.result()


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

