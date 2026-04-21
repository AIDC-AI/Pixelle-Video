from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Any, cast

from api.tasks.manager import TaskManager
from api.tasks.models import TaskStatus, TaskType
from pixelle_video.models.storyboard import (
    ContentMetadata,
    Storyboard,
    StoryboardConfig,
    StoryboardFrame,
)


def test_persistence_round_trips_storyboards_and_indexes(dummy_core, tmp_path):
    persistence = dummy_core.persistence

    asyncio.run(
        persistence.save_task_metadata(
            "task-one",
            {
                "task_id": "task-one",
                "created_at": "2026-04-21T09:00:00",
                "completed_at": "2026-04-21T09:01:00",
                "status": "completed",
                "input": {"text": "alpha", "title": "Alpha", "project_id": "project-a"},
                "result": {
                    "video_path": "output/task-one/final.mp4",
                    "duration": 4.5,
                    "file_size": 512,
                    "n_frames": 2,
                },
                "config": {},
            },
        )
    )
    asyncio.run(
        persistence.save_task_metadata(
            "task-two",
            {
                "task_id": "task-two",
                "created_at": "2026-04-21T10:00:00",
                "completed_at": "2026-04-21T10:01:00",
                "status": "completed",
                "input": {"text": "beta", "title": "Beta"},
                "result": {
                    "video_path": "output/task-two/final.mp4",
                    "duration": 6.0,
                    "file_size": 1024,
                    "n_frames": 3,
                },
                "config": {},
            },
        )
    )

    storyboard = Storyboard(
        title="Storyboard Alpha",
        config=StoryboardConfig(
            task_id="task-one",
            n_storyboard=1,
            min_narration_words=3,
            max_narration_words=9,
            min_image_prompt_words=10,
            max_image_prompt_words=30,
            video_fps=24,
            tts_inference_mode="local",
            voice_id="voice-a",
            tts_workflow="tts/mock.json",
            tts_speed=1.2,
            ref_audio="ref.mp3",
            media_width=720,
            media_height=1280,
            media_workflow="media/mock.json",
            frame_template="1080x1920/default.html",
            template_params={"accent": "blue"},
        ),
        frames=[
            StoryboardFrame(
                index=0,
                narration="Narration",
                image_prompt="Prompt",
                audio_path="audio.mp3",
                media_type="image",
                image_path="image.png",
                video_path="clip.mp4",
                composed_image_path="composed.png",
                video_segment_path="segment.mp4",
                duration=1.5,
                created_at=datetime(2026, 4, 21, 9, 0, 0),
            )
        ],
        content_metadata=ContentMetadata(
            title="Alpha",
            author="AIDC",
            subtitle="Subtitle",
            genre="Promo",
            summary="Summary",
            publication_year=2026,
            cover_url="cover.png",
        ),
        final_video_path="output/task-one/final.mp4",
        total_duration=1.5,
        created_at=datetime(2026, 4, 21, 9, 0, 0),
        completed_at=datetime(2026, 4, 21, 9, 1, 0),
    )
    asyncio.run(persistence.save_storyboard("task-one", storyboard))

    loaded_storyboard = asyncio.run(persistence.load_storyboard("task-one"))
    assert loaded_storyboard is not None
    assert loaded_storyboard.config.media_workflow == "media/mock.json"
    assert loaded_storyboard.frames[0].video_segment_path == "segment.mp4"
    assert loaded_storyboard.content_metadata is not None
    assert loaded_storyboard.content_metadata.title == "Alpha"

    asyncio.run(persistence.update_task_status("task-one", "failed", error="boom"))
    updated_metadata = asyncio.run(persistence.load_task_metadata("task-one"))
    assert updated_metadata["status"] == "failed"
    assert updated_metadata["error"] == "boom"
    assert updated_metadata["completed_at"] is not None
    asyncio.run(persistence.update_task_status("missing-task", "completed"))

    broken_task_dir = persistence.output_dir / "broken-task"
    broken_task_dir.mkdir(parents=True, exist_ok=True)
    (broken_task_dir / "metadata.json").write_text("{invalid", encoding="utf-8")

    listed_tasks = asyncio.run(persistence.list_tasks(status="failed", limit=10, offset=0))
    assert [task["task_id"] for task in listed_tasks] == ["task-one"]
    assert asyncio.run(persistence.task_exists("task-one")) is True

    paginated = asyncio.run(
        persistence.list_tasks_paginated(
            page=1,
            page_size=1,
            sort_by="title",
            sort_order="asc",
        )
    )
    assert paginated["total"] >= 2
    assert paginated["page_size"] == 1
    assert paginated["tasks"][0]["title"] == "Alpha"

    video_items = asyncio.run(persistence.list_video_items(project_id="project-a"))
    assert [item["task_id"] for item in video_items["items"]] == ["task-one"]

    stats = asyncio.run(persistence.get_statistics())
    assert stats["total_tasks"] >= 2
    assert stats["failed"] >= 1
    assert stats["total_size"] >= 1536

    persistence.index_file.unlink()
    asyncio.run(persistence.rebuild_index())
    rebuilt_index = persistence._load_index()
    assert {item["task_id"] for item in rebuilt_index["tasks"]} >= {"task-one", "task-two"}

    persistence.index_file.write_text("{invalid", encoding="utf-8")
    assert persistence._load_index()["tasks"] == []
    persistence.projects_file.write_text("{invalid", encoding="utf-8")
    assert persistence._load_projects_index()["projects"] == []

    task_two_dir = persistence.get_task_dir("task-two")
    task_two_dir.mkdir(parents=True, exist_ok=True)
    assert asyncio.run(persistence.delete_task("task-two")) is True
    assert not task_two_dir.exists()


def test_history_manager_public_wrappers(dummy_core):
    persistence = dummy_core.persistence
    history = dummy_core.history

    asyncio.run(
        persistence.save_task_metadata(
            "task-history",
            {
                "task_id": "task-history",
                "created_at": "2026-04-21T11:00:00",
                "completed_at": "2026-04-21T11:01:00",
                "status": "completed",
                "input": {"text": "history", "title": "History Task", "project_id": "project-h"},
                "result": {
                    "video_path": "output/task-history/final.mp4",
                    "duration": 7.5,
                    "file_size": 2048,
                    "n_frames": 4,
                },
                "config": {},
            },
        )
    )

    detail = asyncio.run(history.get_task_detail("task-history"))
    assert detail is not None
    assert detail["metadata"]["task_id"] == "task-history"
    assert asyncio.run(history.get_task_detail("missing-task")) is None

    task_list = asyncio.run(history.get_task_list(page=1, page_size=10))
    assert task_list["total"] >= 1
    assert task_list["tasks"][0]["task_id"] == "task-history"

    duplicated = asyncio.run(history.duplicate_task("task-history"))
    assert duplicated["project_id"] == "project-h"
    assert asyncio.run(history.duplicate_task("missing-task")) is None

    video_items = asyncio.run(history.list_video_items(project_id="project-h"))
    assert [item["task_id"] for item in video_items["items"]] == ["task-history"]
    unassigned_items = asyncio.run(history.list_video_items(unassigned_only=True))
    assert unassigned_items["items"] == []

    stats = asyncio.run(history.get_statistics())
    assert stats["total_tasks"] >= 1

    asyncio.run(history.rebuild_index())
    assert asyncio.run(history.regenerate_frame("task-history", 0)) is None
    assert asyncio.run(history.export_task("task-history", "exports/task-history.zip")) is None

    assert asyncio.run(history.delete_task("task-history")) is True
    assert asyncio.run(history.get_task_detail("task-history")) is None


def test_task_manager_lifecycle_and_cleanup_paths():
    class FakeFuture:
        def __init__(self) -> None:
            self.cancelled = False

        def done(self) -> bool:
            return False

        def cancel(self) -> None:
            self.cancelled = True

    async def exercise_manager() -> None:
        manager = TaskManager()

        await manager.start()
        await manager.start()
        assert manager._running is True

        async def successful_job():
            return {"status": "ok"}

        async def failing_job():
            raise RuntimeError("boom")

        await manager.execute_task("missing-task", successful_job)

        completed_task = manager.create_task(TaskType.VIDEO_GENERATION, project_id="project-a")
        await manager.execute_task(completed_task.task_id, successful_job)
        for _ in range(20):
            task_state = manager.get_task(completed_task.task_id)
            assert task_state is not None
            if task_state.status == TaskStatus.COMPLETED:
                break
            await asyncio.sleep(0.01)
        completed_state = manager.get_task(completed_task.task_id)
        assert completed_state is not None
        assert completed_state.result == {"status": "ok"}

        failed_task = manager.create_task(TaskType.VIDEO_GENERATION)
        await manager.execute_task(failed_task.task_id, failing_job)
        for _ in range(20):
            task_state = manager.get_task(failed_task.task_id)
            assert task_state is not None
            if task_state.status == TaskStatus.FAILED:
                break
            await asyncio.sleep(0.01)
        failed_state = manager.get_task(failed_task.task_id)
        assert failed_state is not None
        assert failed_state.error == "boom"

        manager.update_progress(completed_task.task_id, current=2, total=4, message="halfway")
        completed_state = manager.get_task(completed_task.task_id)
        assert completed_state is not None
        assert completed_state.progress is not None
        assert completed_state.progress.percentage == 50.0
        manager.update_progress("missing-task", current=1, total=2, message="ignored")

        cancellable_task = manager.create_task(TaskType.VIDEO_GENERATION)
        cancellable_future = FakeFuture()
        manager._task_futures[cancellable_task.task_id] = cast(Any, cancellable_future)
        assert manager.cancel_task("missing-task") is False
        assert manager.cancel_task(cancellable_task.task_id) is True
        assert cancellable_future.cancelled is True
        cancelled_state = manager.get_task(cancellable_task.task_id)
        assert cancelled_state is not None
        assert cancelled_state.status == TaskStatus.CANCELLED

        old_task = manager.create_task(TaskType.VIDEO_GENERATION)
        old_task.status = TaskStatus.COMPLETED
        old_task.completed_at = datetime.now() - timedelta(seconds=999999)
        manager._cleanup_old_tasks()
        assert old_task.task_id not in manager._tasks

        await manager.stop()
        assert manager._tasks == {}
        assert manager._task_futures == {}

    asyncio.run(exercise_manager())
