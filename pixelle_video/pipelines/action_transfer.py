# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Backend action-transfer pipeline runtime
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Callable, Optional

import httpx

from pixelle_video.models.storyboard import (
    Storyboard,
    StoryboardConfig,
    StoryboardFrame,
    VideoGenerationResult,
)
from pixelle_video.pipelines.mock_runtime import maybe_create_mock_result
from pixelle_video.utils.os_util import create_task_output_dir

ProgressCallback = Optional[Callable[[str, int], None]]


async def run(
    core: Any,
    *,
    driver_video: str,
    target_image: str,
    pose_workflow: str,
    project_id: Optional[str] = None,
    motion_prompt: str = "",
    duration: int = 0,
    progress_callback: ProgressCallback = None,
    task_id_override: Optional[str] = None,
    **_: Any,
) -> VideoGenerationResult:
    input_payload = {
        "driver_video": driver_video,
        "target_image": target_image,
        "pose_workflow": pose_workflow,
        "project_id": project_id,
        "motion_prompt": motion_prompt,
        "duration": duration,
    }
    mock_result = await maybe_create_mock_result(
        core,
        "action_transfer",
        input_payload,
        title="Action Transfer",
        n_frames=1,
        task_id_override=task_id_override,
    )
    if mock_result is not None:
        return mock_result

    if progress_callback:
        progress_callback("progress.generation", 10)

    task_dir, task_id = create_task_output_dir()
    workflow_path = Path("workflows") / pose_workflow
    with open(workflow_path, "r", encoding="utf-8") as f:
        workflow_config = json.load(f)

    workflow_input = (
        workflow_config["workflow_id"]
        if workflow_config.get("source") == "runninghub" and "workflow_id" in workflow_config
        else str(workflow_path)
    )

    kit = await core._get_or_create_comfykit()
    video_result = await kit.execute(
        workflow_input,
        {
            "video": driver_video,
            "image": target_image,
            "prompt": motion_prompt,
            "second": duration,
        },
    )

    generated_video_url = None
    if hasattr(video_result, "videos") and video_result.videos:
        generated_video_url = video_result.videos[0]
    elif hasattr(video_result, "outputs") and video_result.outputs:
        for node_output in video_result.outputs.values():
            if isinstance(node_output, dict) and node_output.get("videos"):
                generated_video_url = node_output["videos"][0]
                break

    if not generated_video_url:
        raise ValueError("Action transfer workflow did not return a video")

    final_video_path = os.path.join(task_dir, "final.mp4")
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
        response = await client.get(generated_video_url)
        response.raise_for_status()
        Path(final_video_path).write_bytes(response.content)

    storyboard = Storyboard(
        title="Action Transfer",
        config=StoryboardConfig(
            task_id=task_id,
            media_width=720,
            media_height=1280,
            frame_template="1080x1920/mock.html",
        ),
        frames=[
            StoryboardFrame(
                index=0,
                narration=motion_prompt,
                image_prompt=motion_prompt,
                image_path=target_image,
                video_path=driver_video,
                video_segment_path=final_video_path,
                duration=0.0,
            )
        ],
        final_video_path=final_video_path,
        total_duration=0.0,
    )
    result = VideoGenerationResult(
        video_path=final_video_path,
        storyboard=storyboard,
        duration=0.0,
        file_size=Path(final_video_path).stat().st_size,
    )
    created_at = storyboard.created_at or result.created_at
    metadata = {
        "task_id": task_id,
        "created_at": created_at.isoformat(),
        "completed_at": storyboard.completed_at.isoformat() if storyboard.completed_at else None,
        "status": "completed",
        "input": input_payload,
        "result": {
            "video_path": final_video_path,
            "duration": result.duration,
            "file_size": result.file_size,
            "n_frames": 1,
        },
        "config": {"pipeline": "action_transfer"},
    }
    await core.persistence.save_task_metadata(task_id, metadata)
    await core.persistence.save_storyboard(task_id, storyboard)
    if progress_callback:
        progress_callback("status.success", 100)
    return result
