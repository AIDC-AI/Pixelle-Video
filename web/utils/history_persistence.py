"""Persistence helpers for Web-only generation workflows."""

from __future__ import annotations

import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from loguru import logger


def _probe_video_duration(video_path: str) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except Exception as exc:
        logger.warning(f"Failed to probe video duration for {video_path}: {exc}")
        return 0.0


async def save_web_generation_history(
    pixelle_video: Any,
    *,
    task_id: str,
    video_path: str,
    pipeline: str,
    input_params: dict,
    title: str | None = None,
    n_frames: int = 1,
) -> None:
    """Save a minimal history record for workflows implemented directly in Web UI."""
    if not getattr(pixelle_video, "persistence", None):
        logger.warning("Pixelle persistence service is not initialized; skipping history save")
        return

    path = Path(video_path)
    if not task_id:
        task_id = path.parent.name
    if not path.exists():
        logger.warning(f"Cannot save history; video file does not exist: {video_path}")
        return

    created_at = datetime.fromtimestamp(path.parent.stat().st_ctime).isoformat()
    completed_at = datetime.fromtimestamp(path.stat().st_mtime).isoformat()
    duration = _probe_video_duration(str(path))

    normalized_input = dict(input_params)
    normalized_input.setdefault("mode", pipeline)
    normalized_input.setdefault("title", title or pipeline)
    if title:
        normalized_input["title"] = title

    metadata = {
        "task_id": task_id,
        "created_at": created_at,
        "completed_at": completed_at,
        "status": "completed",
        "input": normalized_input,
        "result": {
            "video_path": str(path),
            "duration": duration,
            "file_size": path.stat().st_size,
            "n_frames": n_frames,
        },
        "config": {
            "llm_model": pixelle_video.config.get("llm", {}).get("model", "unknown"),
            "llm_base_url": pixelle_video.config.get("llm", {}).get("base_url", "unknown"),
            "source": "web",
        },
    }

    await pixelle_video.persistence.save_task_metadata(task_id, metadata)
    logger.info(f"Saved web workflow history: {task_id}")
