from __future__ import annotations

import os
import sys
import types
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

if "comfykit" not in sys.modules:
    mock_comfykit = types.ModuleType("comfykit")

    class MockComfyKit:
        async def close(self) -> None:
            return None

        async def execute(self, *args: Any, **kwargs: Any) -> Any:
            raise RuntimeError("MockComfyKit.execute should not be used in tests")

    mock_comfykit.ComfyKit = MockComfyKit
    sys.modules["comfykit"] = mock_comfykit

if "ffmpeg" not in sys.modules:
    sys.modules["ffmpeg"] = types.ModuleType("ffmpeg")

from api.app import app
from api.dependencies import get_pixelle_video
from api.tasks import task_manager
from pixelle_video.services.history_manager import HistoryManager
from pixelle_video.services.persistence import PersistenceService


class DummyTTS:
    async def __call__(self, **kwargs: Any) -> str:
        output_path = Path(kwargs["output_path"])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"mock-audio")
        return str(output_path)


class DummyCore:
    def __init__(self, output_dir: Path):
        self.config = {
            "llm": {"model": "mock-llm", "base_url": "http://mock-llm"},
            "comfyui": {"comfyui_url": "http://mock-comfyui", "runninghub_api_key": "mock-key"},
        }
        self.persistence = PersistenceService(output_dir=str(output_dir))
        self.history = HistoryManager(self.persistence)
        self.tts = DummyTTS()

    async def _get_or_create_comfykit(self) -> Any:
        raise RuntimeError("ComfyKit should not be used in tests when COMFY_MOCK=1")


@pytest.fixture(autouse=True)
def clear_task_manager() -> None:
    task_manager._tasks.clear()
    task_manager._task_futures.clear()


@pytest.fixture
def dummy_core(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> DummyCore:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("COMFY_MOCK", "1")
    monkeypatch.setenv("PIXELLE_VIDEO_ROOT", str(tmp_path))

    for directory in ("templates", "workflows", "bgm", "resources", "data"):
        target = PROJECT_ROOT / directory
        link = tmp_path / directory
        if target.exists() and not link.exists():
            link.symlink_to(target, target_is_directory=True)

    output_dir = tmp_path / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    return DummyCore(output_dir=output_dir)


@pytest.fixture
def client(dummy_core: DummyCore) -> TestClient:
    app.dependency_overrides[get_pixelle_video] = lambda: dummy_core
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
