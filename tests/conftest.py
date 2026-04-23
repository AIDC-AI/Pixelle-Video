from __future__ import annotations

import sys
import types
from pathlib import Path
from typing import Any, Generator, cast

import pytest
from fastapi.testclient import TestClient

# ruff: noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

if "comfykit" not in sys.modules:
    mock_comfykit = cast(Any, types.ModuleType("comfykit"))

    class MockComfyKit:
        async def close(self) -> None:
            return None

        async def execute(self, *args: Any, **kwargs: Any) -> Any:
            raise RuntimeError("MockComfyKit.execute should not be used in tests")

    setattr(mock_comfykit, "ComfyKit", MockComfyKit)
    sys.modules["comfykit"] = mock_comfykit

if "ffmpeg" not in sys.modules:
    sys.modules["ffmpeg"] = types.ModuleType("ffmpeg")

from api.app import app
from api.dependencies import get_pixelle_video
from api.tasks import task_manager
from pixelle_video.config import config_manager
from pixelle_video.models.media import MediaResult
from pixelle_video.services.history_manager import HistoryManager
from pixelle_video.services.persistence import PersistenceService
from pixelle_video.services.style_registry import StyleRegistry


class DummyTTS:
    async def __call__(self, **kwargs: Any) -> str:
        output_path = Path(kwargs["output_path"])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"mock-audio")
        return str(output_path)

    def list_workflows(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "tts_edge.json",
                "display_name": "tts_edge.json - selfhost",
                "source": "selfhost",
                "path": "workflows/selfhost/tts_edge.json",
                "key": "selfhost/tts_edge.json",
                "workflow_id": None,
            },
            {
                "name": "tts_edge.json",
                "display_name": "tts_edge.json - runninghub",
                "source": "runninghub",
                "path": "workflows/runninghub/tts_edge.json",
                "key": "runninghub/tts_edge.json",
                "workflow_id": "tts-edge-runninghub",
            },
        ]


class DummyMedia:
    async def __call__(self, **kwargs: Any) -> MediaResult:
        media_type = kwargs.get("media_type", "image")
        if media_type == "video":
            return MediaResult(
                media_type="video",
                url="output/previews/mock-preview.mp4",
                duration=kwargs.get("duration", 4.0),
            )
        return MediaResult(media_type="image", url="output/previews/mock-preview.png")

    def list_workflows(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "image_flux.json",
                "display_name": "image_flux.json - selfhost",
                "source": "selfhost",
                "path": "workflows/selfhost/image_flux.json",
                "key": "selfhost/image_flux.json",
                "workflow_id": None,
            },
            {
                "name": "video_wan2.1_fusionx.json",
                "display_name": "video_wan2.1_fusionx.json - runninghub",
                "source": "runninghub",
                "path": "workflows/runninghub/video_wan2.1_fusionx.json",
                "key": "runninghub/video_wan2.1_fusionx.json",
                "workflow_id": "video-wan-runninghub",
            },
            {
                "name": "af_scail.json",
                "display_name": "af_scail.json - runninghub",
                "source": "runninghub",
                "path": "workflows/runninghub/af_scail.json",
                "key": "runninghub/af_scail.json",
                "workflow_id": "af-scail-runninghub",
            },
        ]


class DummyCore:
    def __init__(self, output_dir: Path):
        self.config = {
            "llm": {"model": "mock-llm", "base_url": "http://mock-llm"},
            "comfyui": {"comfyui_url": "http://mock-comfyui", "runninghub_api_key": "mock-key"},
        }
        self.persistence = PersistenceService(output_dir=str(output_dir))
        self.history = HistoryManager(self.persistence)
        self.tts = DummyTTS()
        self.media = DummyMedia()
        self.styles = StyleRegistry()

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

    for directory in ("templates", "workflows", "bgm", "resources", "data", "styles"):
        target = PROJECT_ROOT / directory
        link = tmp_path / directory
        if target.exists() and not link.exists():
            link.symlink_to(target, target_is_directory=True)

    output_dir = tmp_path / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        (PROJECT_ROOT / "config.example.yaml").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    monkeypatch.setattr(config_manager, "config_path", config_path, raising=False)
    config_manager.reload()
    return DummyCore(output_dir=output_dir)


@pytest.fixture
def client(dummy_core: DummyCore) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_pixelle_video] = lambda: dummy_core
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
