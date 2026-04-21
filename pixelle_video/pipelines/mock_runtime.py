# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Mock helpers for pipeline parity tests
"""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from pixelle_video.models.storyboard import (
    Storyboard,
    StoryboardConfig,
    StoryboardFrame,
    VideoGenerationResult,
)
from pixelle_video.utils.os_util import create_task_output_dir, get_task_final_video_path


async def maybe_create_mock_result(
    core: Any,
    pipeline_name: str,
    input_payload: Dict[str, Any],
    *,
    title: str,
    n_frames: int = 1,
    duration: float = 2.0,
) -> Optional[VideoGenerationResult]:
    if os.getenv("COMFY_MOCK") != "1":
        return None

    task_dir, task_id = create_task_output_dir()
    final_video_path = Path(get_task_final_video_path(task_id))
    final_video_path.parent.mkdir(parents=True, exist_ok=True)
    final_video_path.write_bytes(f"mock-{pipeline_name}".encode("utf-8"))

    storyboard = Storyboard(
        title=title,
        config=StoryboardConfig(
            task_id=task_id,
            media_width=720,
            media_height=1280,
            n_storyboard=n_frames,
            frame_template="1080x1920/mock.html",
        ),
        frames=[
            StoryboardFrame(
                index=index,
                narration=input_payload.get("narration", input_payload.get("text", title)),
                image_prompt=input_payload.get("motion_prompt", title),
                duration=duration / max(n_frames, 1),
                image_path=input_payload.get("source_image") or input_payload.get("portrait_url"),
                video_segment_path=str(final_video_path),
            )
            for index in range(n_frames)
        ],
        final_video_path=str(final_video_path),
        total_duration=duration,
        created_at=datetime.now(),
        completed_at=datetime.now(),
    )

    result = VideoGenerationResult(
        video_path=str(final_video_path),
        storyboard=storyboard,
        duration=duration,
        file_size=final_video_path.stat().st_size,
    )

    if hasattr(core, "persistence"):
        created_at = storyboard.created_at or datetime.now()
        completed_at = storyboard.completed_at or created_at
        metadata = {
            "task_id": task_id,
            "created_at": created_at.isoformat(),
            "completed_at": completed_at.isoformat(),
            "status": "completed",
            "input": input_payload,
            "result": {
                "video_path": str(final_video_path),
                "duration": duration,
                "file_size": result.file_size,
                "n_frames": n_frames,
            },
            "config": {"pipeline": pipeline_name},
        }
        await core.persistence.save_task_metadata(task_id, metadata)
        await core.persistence.save_storyboard(task_id, storyboard)

    return result
