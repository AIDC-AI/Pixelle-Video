from __future__ import annotations

import asyncio
import threading
import time
from datetime import datetime
from pathlib import Path

from starlette.requests import Request

from api.routers.batch import create_batch as create_batch_endpoint
from api.schemas.batch import BatchCreateRequest, BatchPipeline
from api.schemas.video import VideoGenerateRequest
from api.tasks import task_manager
from pixelle_video.models.storyboard import Storyboard, StoryboardConfig, StoryboardFrame


def _write_bytes(path: Path, payload: bytes = b"payload") -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return str(path)


async def _seed_history_task(
    *,
    dummy_core,
    task_id: str,
    project_id: str | None,
    title: str,
    narration: str,
    prompt: str,
    include_bgm: bool = False,
) -> None:
    task_dir = dummy_core.persistence.get_task_dir(task_id)
    task_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = task_dir / "frames"
    image_path = _write_bytes(frames_dir / "01_image.png", b"image")
    audio_path = _write_bytes(frames_dir / "01_audio.mp3", b"audio")
    video_path = _write_bytes(task_dir / "final.mp4", b"video")
    bgm_path = _write_bytes(task_dir / "custom-bgm.mp3", b"bgm") if include_bgm else None

    metadata = {
        "task_id": task_id,
        "created_at": "2026-04-22T01:00:00",
        "completed_at": "2026-04-22T01:01:00",
        "status": "completed",
        "input": {
            "text": narration,
            "title": title,
            "project_id": project_id,
            "prompt_prefix": prompt,
            **({"bgm_path": bgm_path} if bgm_path else {}),
        },
        "result": {
            "video_path": video_path,
            "duration": 8.0,
            "file_size": Path(video_path).stat().st_size,
            "n_frames": 1,
        },
        "config": {
            "pipeline": "standard",
            "tts_workflow": "selfhost/tts_edge.json",
        },
    }
    storyboard = Storyboard(
        title=title,
        config=StoryboardConfig(
            task_id=task_id,
            media_width=720,
            media_height=1280,
            n_storyboard=1,
            frame_template="1080x1920/default.html",
            tts_workflow="selfhost/tts_edge.json",
        ),
        frames=[
            StoryboardFrame(
                index=0,
                narration=narration,
                image_prompt=prompt,
                image_path=image_path,
                audio_path=audio_path,
                video_segment_path=video_path,
                duration=2.5,
                created_at=datetime(2026, 4, 22, 1, 0, 0),
            )
        ],
        final_video_path=video_path,
        total_duration=2.5,
        created_at=datetime(2026, 4, 22, 1, 0, 0),
        completed_at=datetime(2026, 4, 22, 1, 1, 0),
    )

    await dummy_core.persistence.save_task_metadata(task_id, metadata)
    await dummy_core.persistence.save_storyboard(task_id, storyboard)


def test_batch_create_list_detail_and_delete_cascade(client, dummy_core):
    response = client.post(
        "/api/batch",
        json={
            "pipeline": "standard",
            "project_id": "project-batch",
            "name": "Batch Alpha",
            "rows": [
                {
                    "text": "Alpha script",
                    "title": "Alpha",
                    "mode": "generate",
                    "frame_template": "1080x1920/default.html",
                },
                {
                    "text": "Beta script",
                    "title": "Beta",
                    "mode": "generate",
                    "frame_template": "1080x1920/default.html",
                },
            ],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert len(body["task_ids"]) == 2

    for _ in range(50):
        if all(task_manager.get_task(task_id).status == "completed" for task_id in body["task_ids"]):
            break
        time.sleep(0.02)

    list_response = client.get("/api/batch", params={"project_id": "project-batch"})
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()["items"]] == [body["batch_id"]]
    assert list_response.json()["items"][0]["total"] == 2

    detail_response = client.get(f"/api/batch/{body['batch_id']}")
    assert detail_response.status_code == 200
    detail_body = detail_response.json()
    assert len(detail_body["children"]) == 2
    assert {child["batch_id"] for child in detail_body["children"]} == {body["batch_id"]}

    delete_response = client.delete(f"/api/batch/{body['batch_id']}", params={"cascade": "true"})
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted_at"] is not None


def test_batch_rejects_invalid_row_for_selected_pipeline(client):
    response = client.post(
        "/api/batch",
        json={
            "pipeline": "standard",
            "rows": [
                {
                    "source_image": "tests/fixtures/pipelines/source.png",
                    "motion_prompt": "move",
                    "media_workflow": "runninghub/video_wan2.1_fusionx.json",
                }
            ],
        },
    )
    assert response.status_code == 422


def test_batch_list_empty_state(client):
    response = client.get("/api/batch")
    assert response.status_code == 200
    assert response.json() == {"items": [], "next_cursor": None}


def test_batch_submission_is_thread_safe(dummy_core):
    barrier = threading.Barrier(10)
    errors: list[str] = []
    batch_ids: list[str] = []
    batch_ids_lock = threading.Lock()

    def worker(index: int) -> None:
        try:
            request = Request(
                {
                    "type": "http",
                    "method": "POST",
                    "scheme": "http",
                    "path": "/api/batch",
                    "root_path": "",
                    "query_string": b"",
                    "headers": [],
                    "client": ("testclient", 50000 + index),
                    "server": ("testserver", 80),
                }
            )
            payload = BatchCreateRequest(
                pipeline=BatchPipeline.STANDARD,
                name=None,
                project_id=f"project-{index}",
                rows=[
                    VideoGenerateRequest.model_validate(
                        {
                            "text": f"Batch {index}",
                            "title": f"Batch {index}",
                            "mode": "generate",
                            "frame_template": "1080x1920/default.html",
                        }
                    )
                ],
            )
            barrier.wait()
            response = asyncio.run(
                create_batch_endpoint(
                    request_body=payload,
                    request=request,
                    pixelle_video=dummy_core,
                )
            )
            with batch_ids_lock:
                batch_ids.append(response.batch_id)
        except Exception as exc:  # pragma: no cover - asserted below
            errors.append(str(exc))

    threads = [threading.Thread(target=worker, args=(index,)) for index in range(10)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    batches = asyncio.run(dummy_core.persistence.list_batches(limit=20))
    assert len(batches["items"]) == 10
    assert len(set(batch_ids)) == 10


def test_settings_get_masks_sensitive_values_and_put_persists_encoded(client):
    response = client.put(
        "/api/settings",
        json={
            "project_name": "Pixelle Test",
            "llm": {
                "api_key": "sk-testing-12345678",
                "base_url": "https://api.openai.com/v1",
                "model": "gpt-5.4",
            },
            "comfyui": {
                "comfyui_url": "http://127.0.0.1:8188",
                "runninghub_api_key": "rh-secret-87654321",
            },
            "template": {
                "default_template": "1080x1920/default.html",
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["llm"]["api_key"].startswith("sk-****")
    assert body["comfyui"]["runninghub_api_key"].startswith("rh-****")

    get_response = client.get("/api/settings")
    assert get_response.status_code == 200
    assert get_response.json()["project_name"] == "Pixelle Test"
    assert get_response.json()["llm"]["api_key"].startswith("sk-****")

    persisted = Path("config.yaml").read_text(encoding="utf-8")
    assert "sk-testing-12345678" not in persisted
    assert "rh-secret-87654321" not in persisted
    assert "ENC::" in persisted


def test_settings_reject_invalid_fields(client):
    response = client.put(
        "/api/settings",
        json={
            "llm": {
                "unsupported": "value",
            }
        },
    )
    assert response.status_code == 422


def test_settings_default_get_is_not_empty(client):
    response = client.get("/api/settings")
    assert response.status_code == 200
    assert response.json()["project_name"] == "Pixelle-Video"


def test_library_kinds_support_tri_state_filters(client, dummy_core):
    asyncio.run(
        _seed_history_task(
            dummy_core=dummy_core,
            task_id="task-project",
            project_id="project-a",
            title="Project Task",
            narration="Project narration",
            prompt="Project prompt",
            include_bgm=True,
        )
    )
    asyncio.run(
        _seed_history_task(
            dummy_core=dummy_core,
            task_id="task-unassigned",
            project_id=None,
            title="Unassigned Task",
            narration="Unassigned narration",
            prompt="Unassigned prompt",
            include_bgm=True,
        )
    )

    expected_item_keys = {
        "images": "image_path",
        "voices": "audio_path",
        "bgm": "audio_path",
        "scripts": "text",
    }
    for endpoint, key in expected_item_keys.items():
        project_response = client.get(f"/api/library/{endpoint}", params={"project_id": "project-a"})
        assert project_response.status_code == 200
        assert project_response.json()["items"]
        assert all(item["project_id"] == "project-a" for item in project_response.json()["items"])
        assert all(item[key] for item in project_response.json()["items"])

        unassigned_response = client.get(f"/api/library/{endpoint}", params={"project_id": "__unassigned__"})
        assert unassigned_response.status_code == 200
        assert unassigned_response.json()["items"]
        assert all(item["project_id"] is None for item in unassigned_response.json()["items"])

        empty_response = client.get(f"/api/library/{endpoint}", params={"project_id": "missing-project"})
        assert empty_response.status_code == 200
        assert empty_response.json()["items"] == []


def test_library_video_detail_returns_metadata_snapshot(client, dummy_core):
    asyncio.run(
        _seed_history_task(
            dummy_core=dummy_core,
            task_id="task-detail",
            project_id="project-detail",
            title="Detail Task",
            narration="Detail narration",
            prompt="Detail prompt",
        )
    )

    response = client.get("/api/library/videos/task-detail")
    assert response.status_code == 200
    body = response.json()
    assert body["task_id"] == "task-detail"
    assert body["metadata"]["input"]["project_id"] == "project-detail"
    assert body["storyboard"]["frames"][0]["narration"] == "Detail narration"

    missing_response = client.get("/api/library/videos/missing-task")
    assert missing_response.status_code == 404


def test_resources_workflow_detail_and_preset_listing(client):
    workflow_response = client.get("/api/resources/workflows/selfhost/tts_edge.json")
    assert workflow_response.status_code == 200
    workflow_body = workflow_response.json()
    assert workflow_body["key"] == "selfhost/tts_edge.json"
    assert workflow_body["editable"] is True
    assert workflow_body["metadata"]["node_count"] >= 0

    missing_response = client.get("/api/resources/workflows/missing-workflow.json")
    assert missing_response.status_code == 404

    presets_response = client.get("/api/resources/presets")
    assert presets_response.status_code == 200
    presets_body = presets_response.json()
    assert presets_body["presets"]
    assert any(item["source"] == "builtin" for item in presets_body["presets"])


def test_batch_list_supports_status_filter(client):
    response = client.post(
        "/api/batch",
        json={
            "pipeline": "standard",
            "rows": [
                {
                    "text": "Status filter",
                    "title": "Status filter",
                    "mode": "generate",
                    "frame_template": "1080x1920/default.html",
                }
            ],
        },
    )
    assert response.status_code == 201

    pending_or_running = client.get("/api/batch", params={"status": "pending"})
    if pending_or_running.json()["items"]:
        assert pending_or_running.status_code == 200
    else:
        completed = client.get("/api/batch", params={"status": "completed"})
        assert completed.status_code == 200
        assert completed.json()["items"]
