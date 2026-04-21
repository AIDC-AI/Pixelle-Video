from __future__ import annotations

import asyncio
import io
import json
import threading
import time
from pathlib import Path

import pytest

from api.routers import uploads as uploads_router
from api.tasks import task_manager


def test_projects_crud_persists_to_projects_index(client, dummy_core):
    create_response = client.post(
        "/api/projects",
        json={"name": "Project Alpha", "pipeline_hint": "standard"},
    )
    assert create_response.status_code == 201
    project = create_response.json()
    project_id = project["id"]
    assert project["name"] == "Project Alpha"
    assert project["task_count"] == 0

    list_response = client.get("/api/projects")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()["items"]] == [project_id]

    get_response = client.get(f"/api/projects/{project_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == project_id

    patch_response = client.patch(f"/api/projects/{project_id}", json={"name": "Project Beta"})
    assert patch_response.status_code == 200
    assert patch_response.json()["name"] == "Project Beta"

    delete_response = client.delete(f"/api/projects/{project_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted_at"] is not None

    hidden_list = client.get("/api/projects")
    assert hidden_list.status_code == 200
    assert hidden_list.json()["items"] == []

    projects_index = json.loads(dummy_core.persistence.projects_file.read_text(encoding="utf-8"))
    assert projects_index["projects"][0]["id"] == project_id


def test_library_videos_uses_history_index_and_project_filter(client, dummy_core):
    asyncio.run(
        dummy_core.persistence.save_task_metadata(
            "task-alpha",
            {
                "task_id": "task-alpha",
                "created_at": "2026-04-21T10:00:00",
                "completed_at": "2026-04-21T10:01:00",
                "status": "completed",
                "input": {"text": "alpha", "title": "Alpha", "project_id": "project-a"},
                "result": {
                    "video_path": "output/task-alpha/final.mp4",
                    "duration": 12.5,
                    "file_size": 1024,
                    "n_frames": 3,
                },
                "config": {},
            },
        )
    )
    asyncio.run(
        dummy_core.persistence.save_task_metadata(
            "task-beta",
            {
                "task_id": "task-beta",
                "created_at": "2026-04-21T11:00:00",
                "completed_at": "2026-04-21T11:01:00",
                "status": "completed",
                "input": {"text": "beta", "title": "Beta", "project_id": "project-b"},
                "result": {
                    "video_path": "output/task-beta/final.mp4",
                    "duration": 9.0,
                    "file_size": 2048,
                    "n_frames": 2,
                },
                "config": {},
            },
        )
    )
    asyncio.run(
        dummy_core.persistence.save_task_metadata(
            "task-unassigned",
            {
                "task_id": "task-unassigned",
                "created_at": "2026-04-21T12:00:00",
                "completed_at": "2026-04-21T12:01:00",
                "status": "completed",
                "input": {"text": "orphan", "title": "Orphan"},
                "result": {
                    "video_path": "output/task-unassigned/final.mp4",
                    "duration": 6.0,
                    "file_size": 512,
                    "n_frames": 1,
                },
                "config": {},
            },
        )
    )

    all_response = client.get("/api/library/videos")
    assert all_response.status_code == 200
    assert [item["task_id"] for item in all_response.json()["items"]] == [
        "task-unassigned",
        "task-beta",
        "task-alpha",
    ]

    explicit_all_response = client.get("/api/library/videos", params={"project_id": "all"})
    assert explicit_all_response.status_code == 200
    assert [item["task_id"] for item in explicit_all_response.json()["items"]] == [
        "task-unassigned",
        "task-beta",
        "task-alpha",
    ]

    filtered_response = client.get("/api/library/videos", params={"project_id": "project-a"})
    assert filtered_response.status_code == 200
    items = filtered_response.json()["items"]
    assert [item["task_id"] for item in items] == ["task-alpha"]
    assert items[0]["project_id"] == "project-a"

    null_response = client.get("/api/library/videos", params={"project_id": "null"})
    assert null_response.status_code == 200
    assert [item["task_id"] for item in null_response.json()["items"]] == ["task-unassigned"]
    assert null_response.json()["items"][0]["project_id"] is None

    alias_response = client.get("/api/library/videos", params={"project_id": "__unassigned__"})
    assert alias_response.status_code == 200
    assert [item["task_id"] for item in alias_response.json()["items"]] == ["task-unassigned"]


def test_uploads_saves_file_under_output_uploads(client):
    response = client.post(
        "/api/uploads",
        files={"file": ("sample.png", io.BytesIO(b"payload"), "image/png")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["file_url"].startswith("http://testserver/api/files/uploads/")
    assert body["path"].startswith("output/uploads/")
    assert Path(body["path"]).exists()


def test_uploads_reject_oversize_files(client, monkeypatch):
    monkeypatch.setenv("PIXELLE_MAX_UPLOAD_MB", "1")

    response = client.post(
        "/api/uploads",
        files={"file": ("huge.png", io.BytesIO(b"x" * (2 * 1024 * 1024)), "image/png")},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == {
        "code": "file_too_large",
        "message": "Uploaded file exceeds the configured size limit.",
    }


def test_uploads_reject_unsupported_content_type(client):
    response = client.post(
        "/api/uploads",
        files={"file": ("sample.txt", io.BytesIO(b"payload"), "text/plain")},
    )

    assert response.status_code == 415
    assert response.json()["detail"] == {
        "code": "unsupported_media_type",
        "message": "Only image, video, and audio uploads are allowed.",
    }


def test_uploads_hide_internal_io_errors(client, monkeypatch):
    def raise_io_error(self, *args, **kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(uploads_router.Path, "open", raise_io_error)

    response = client.post(
        "/api/uploads",
        files={"file": ("sample.png", io.BytesIO(b"payload"), "image/png")},
    )

    assert response.status_code == 500
    assert response.json()["detail"] == {
        "code": "upload_failed",
        "message": "Upload failed.",
    }


def test_tasks_filter_by_project_id(client):
    task_manager.create_task(
        task_type="video_generation",
        request_params={"title": "Alpha"},
        project_id="project-a",
    )
    task_manager.create_task(
        task_type="video_generation",
        request_params={"title": "Beta"},
        project_id="project-b",
    )
    task_manager.create_task(
        task_type="video_generation",
        request_params={"title": "Orphan"},
        project_id=None,
    )

    response = client.get("/api/tasks", params={"project_id": "project-a"})
    assert response.status_code == 200
    tasks = response.json()
    assert len(tasks) == 1
    assert tasks[0]["project_id"] == "project-a"

    all_response = client.get("/api/tasks")
    assert all_response.status_code == 200
    assert len(all_response.json()) == 3

    explicit_all_response = client.get("/api/tasks", params={"project_id": "all"})
    assert explicit_all_response.status_code == 200
    assert len(explicit_all_response.json()) == 3

    null_response = client.get("/api/tasks", params={"project_id": "null"})
    assert null_response.status_code == 200
    assert len(null_response.json()) == 1
    assert null_response.json()[0]["project_id"] is None

    alias_response = client.get("/api/tasks", params={"project_id": "__unassigned__"})
    assert alias_response.status_code == 200
    assert len(alias_response.json()) == 1
    assert alias_response.json()[0]["project_id"] is None

@pytest.mark.parametrize(
    ("path", "payload"),
    [
        (
            "/api/video/digital-human/async",
            {
                "portrait_url": "tests/fixtures/pipelines/portrait.png",
                "narration": "mock narration",
                "voice_workflow": "runninghub/tts_edge.json",
                "project_id": "project-1",
            },
        ),
        (
            "/api/video/i2v/async",
            {
                "source_image": "tests/fixtures/pipelines/source.png",
                "motion_prompt": "make it move",
                "media_workflow": "selfhost/i2v_mock.json",
                "project_id": "project-1",
            },
        ),
        (
            "/api/video/action-transfer/async",
            {
                "driver_video": "tests/fixtures/pipelines/driver.mp4",
                "target_image": "tests/fixtures/pipelines/source.png",
                "pose_workflow": "selfhost/af_mock.json",
                "project_id": "project-1",
            },
        ),
        (
            "/api/video/custom/async",
            {
                "scenes": [
                    {
                        "media": "tests/fixtures/pipelines/source.png",
                        "narration": "scene narration",
                        "duration": 2,
                    }
                ],
                "project_id": "project-1",
            },
        ),
    ],
)
def test_new_pipeline_endpoints_submit_and_complete_tasks(client, path, payload):
    response = client.post(path, json=payload)
    assert response.status_code == 200
    task_id = response.json()["task_id"]

    for _ in range(20):
        task = task_manager.get_task(task_id)
        if task and task.status == "completed":
            break
        time.sleep(0.01)

    task = task_manager.get_task(task_id)
    assert task is not None
    assert task.status == "completed"
    assert task.project_id == "project-1"
    assert task.result["video_url"].startswith("http://testserver/api/files/")


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        (
            "/api/video/i2v/async",
            {
                "source_image": "tests/fixtures/pipelines/source.png",
                "motion_prompt": "make it move",
                "project_id": "project-1",
            },
        ),
        (
            "/api/video/action-transfer/async",
            {
                "driver_video": "tests/fixtures/pipelines/driver.mp4",
                "target_image": "tests/fixtures/pipelines/source.png",
                "project_id": "project-1",
            },
        ),
    ],
)
def test_pipeline_endpoints_require_explicit_workflow_fields(client, path, payload):
    response = client.post(path, json=payload)

    assert response.status_code == 422


def test_project_index_updates_are_thread_safe(dummy_core):
    persistence = dummy_core.persistence
    create_barrier = threading.Barrier(10)
    create_errors: list[str] = []
    created_ids: list[str] = []
    created_ids_lock = threading.Lock()

    def create_worker(index: int) -> None:
        try:
            create_barrier.wait()
            project = asyncio.run(persistence.create_project(name=f"Project {index}"))
            with created_ids_lock:
                created_ids.append(project["id"])
        except Exception as exc:  # pragma: no cover - failure path asserted below
            create_errors.append(str(exc))

    create_threads = [threading.Thread(target=create_worker, args=(index,)) for index in range(10)]
    for thread in create_threads:
        thread.start()
    for thread in create_threads:
        thread.join()

    assert create_errors == []
    projects = asyncio.run(persistence.list_projects(include_deleted=True))
    assert len(projects) == 10
    assert {project["id"] for project in projects} == set(created_ids)

    counter_project = asyncio.run(persistence.create_project(name="Counter Project"))
    update_barrier = threading.Barrier(10)
    update_errors: list[str] = []

    def update_worker(index: int) -> None:
        metadata = {
            "task_id": f"counter-task-{index}",
            "created_at": f"2026-04-21T13:00:{index:02d}",
            "completed_at": f"2026-04-21T13:01:{index:02d}",
            "status": "completed",
            "input": {
                "text": f"counter-{index}",
                "title": f"Counter {index}",
                "project_id": counter_project["id"],
            },
            "result": {
                "video_path": f"output/counter-task-{index}/final.mp4",
                "duration": 1.0,
                "file_size": 128,
                "n_frames": 1,
            },
            "config": {},
        }
        try:
            update_barrier.wait()
            asyncio.run(persistence.save_task_metadata(metadata["task_id"], metadata))
        except Exception as exc:  # pragma: no cover - failure path asserted below
            update_errors.append(str(exc))

    update_threads = [threading.Thread(target=update_worker, args=(index,)) for index in range(10)]
    for thread in update_threads:
        thread.start()
    for thread in update_threads:
        thread.join()

    assert update_errors == []
    counter_state = asyncio.run(persistence.get_project(counter_project["id"]))
    assert counter_state is not None
    assert counter_state["task_count"] == 10
    assert counter_state["last_task_id"] in {f"counter-task-{index}" for index in range(10)}
