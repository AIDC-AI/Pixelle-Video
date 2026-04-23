# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Backend digital human pipeline runtime
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


def _resolve_workflow_input(workflow_path: Path) -> str:
    if not workflow_path.exists():
        raise FileNotFoundError(f"The workflow file does not exist: {workflow_path}")

    with workflow_path.open("r", encoding="utf-8") as fh:
        workflow_config = json.load(fh)

    if workflow_config.get("source") == "runninghub" and "workflow_id" in workflow_config:
        return workflow_config["workflow_id"]
    return str(workflow_config)


def _extract_first_value(result: Any, field: str) -> Optional[str]:
    if hasattr(result, field):
        values = getattr(result, field)
        if values:
            return values[0]
    if hasattr(result, "outputs") and result.outputs:
        for node_output in result.outputs.values():
            if isinstance(node_output, dict) and node_output.get(field):
                values = node_output[field]
                if values:
                    return values[0]
    return None


async def _download_to_path(source_url: str, destination: str) -> str:
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
        response = await client.get(source_url)
        response.raise_for_status()
        Path(destination).write_bytes(response.content)
    return destination


async def _synthesize_audio(
    core: Any,
    *,
    text: str,
    output_path: str,
    tts_inference_mode: str,
    tts_voice: Optional[str],
    tts_speed: Optional[float],
    tts_workflow: Optional[str],
    voice_workflow: Optional[str],
    ref_audio: Optional[str],
    runninghub_instance_type: Optional[str],
) -> None:
    kwargs: dict[str, Any] = {
        "text": text,
        "output_path": output_path,
        "inference_mode": tts_inference_mode,
    }
    if tts_inference_mode == "local":
        kwargs["voice"] = tts_voice
        kwargs["speed"] = tts_speed
    else:
        if tts_workflow or voice_workflow:
            kwargs["workflow"] = tts_workflow or voice_workflow
            if (tts_workflow or voice_workflow or "").startswith("runninghub/") and runninghub_instance_type:
                kwargs["runninghub_instance_type"] = runninghub_instance_type
        if ref_audio:
            kwargs["ref_audio"] = ref_audio
    await core.tts(**kwargs)


async def run(
    core: Any,
    *,
    portrait_url: str,
    narration: str,
    voice_workflow: Optional[str] = None,
    bgm_mode: str = "none",
    bgm_path: Optional[str] = None,
    bgm_volume: float = 0.3,
    project_id: Optional[str] = None,
    progress_callback: ProgressCallback = None,
    workflow_path: Optional[dict[str, str]] = None,
    mode: str = "customize",
    goods_assets: Optional[list[str]] = None,
    goods_title: str = "",
    tts_inference_mode: str = "local",
    tts_voice: Optional[str] = None,
    tts_speed: Optional[float] = None,
    tts_workflow: Optional[str] = None,
    ref_audio: Optional[str] = None,
    runninghub_instance_type: Optional[str] = None,
    task_id_override: Optional[str] = None,
    **_: Any,
) -> VideoGenerationResult:
    input_payload = {
        "portrait_url": portrait_url,
        "narration": narration,
        "voice_workflow": voice_workflow,
        "bgm_mode": bgm_mode,
        "bgm_path": bgm_path,
        "bgm_volume": bgm_volume,
        "project_id": project_id,
        "workflow_path": workflow_path,
        "mode": mode,
        "goods_assets": goods_assets or [],
        "goods_title": goods_title,
        "tts_inference_mode": tts_inference_mode,
        "tts_voice": tts_voice,
        "tts_speed": tts_speed,
        "tts_workflow": tts_workflow,
        "ref_audio": ref_audio,
        "runninghub_instance_type": runninghub_instance_type,
    }
    mock_result = await maybe_create_mock_result(
        core,
        "digital_human",
        input_payload,
        title=goods_title or "Digital Human",
        n_frames=1,
        task_id_override=task_id_override,
    )
    if mock_result is not None:
        return mock_result

    workflow_config = workflow_path or {
        "first_workflow_path": "workflows/runninghub/digital_image.json",
        "second_workflow_path": "workflows/runninghub/digital_combination.json",
        "third_workflow_path": "workflows/runninghub/digital_customize.json",
    }
    task_dir, task_id = create_task_output_dir()
    audio_path = os.path.join(task_dir, "narration.mp3")
    generated_image_path = portrait_url
    generated_text = narration
    async with core._comfykit_session(runninghub_instance_type=runninghub_instance_type) as kit:

        if mode == "customize":
            if progress_callback:
                progress_callback("progress.step_audio", 25)
            await _synthesize_audio(
                core,
                text=generated_text,
                output_path=audio_path,
                tts_inference_mode=tts_inference_mode,
                tts_voice=tts_voice,
                tts_speed=tts_speed,
                tts_workflow=tts_workflow,
                voice_workflow=voice_workflow,
                ref_audio=ref_audio,
                runninghub_instance_type=runninghub_instance_type,
            )
        else:
            if not goods_assets:
                raise ValueError("goods_assets is required for digital mode")

            goods_asset = goods_assets[0]
            if progress_callback:
                progress_callback("progress.step_image", 10)

            if narration and narration.strip():
                combine_image = await kit.execute(
                    _resolve_workflow_input(Path(workflow_config["third_workflow_path"])),
                    {"firstimage": portrait_url, "secondimage": goods_asset},
                )
                combined_image_path = _extract_first_value(combine_image, "images")
                if not combined_image_path:
                    raise ValueError("Digital human customize image workflow did not return an image")
                generated_image_path = combined_image_path
                generated_text = narration
            else:
                synthesis_result = await kit.execute(
                    _resolve_workflow_input(Path(workflow_config["first_workflow_path"])),
                    {
                        "firstimage": portrait_url,
                        "secondimage": goods_asset,
                        "goodstype": goods_title,
                    },
                )
                if hasattr(synthesis_result, "status") and synthesis_result.status != "completed":
                    raise ValueError(f"workflow execution failed: {getattr(synthesis_result, 'msg', 'unknown error')}")
                synthesized_image_path = _extract_first_value(synthesis_result, "images")
                if not synthesized_image_path:
                    raise ValueError("Digital human synthesis workflow did not return an image")
                generated_image_path = synthesized_image_path
                generated_text = _extract_first_value(synthesis_result, "texts") or goods_title

            if progress_callback:
                progress_callback("progress.step_audio", 25)
            await _synthesize_audio(
                core,
                text=generated_text,
                output_path=audio_path,
                tts_inference_mode=tts_inference_mode,
                tts_voice=tts_voice,
                tts_speed=tts_speed,
                tts_workflow=tts_workflow,
                voice_workflow=voice_workflow,
                ref_audio=ref_audio,
                runninghub_instance_type=runninghub_instance_type,
            )

        if progress_callback:
            progress_callback("progress.concatenating", 65)

        second_result = await kit.execute(
            _resolve_workflow_input(Path(workflow_config["second_workflow_path"])),
            {"videoimage": generated_image_path, "audio": audio_path},
        )
    generated_video_url = _extract_first_value(second_result, "videos")
    if not generated_video_url:
        raise ValueError("Digital human workflow did not return a video")

    final_video_path = os.path.join(task_dir, "final.mp4")
    await _download_to_path(generated_video_url, final_video_path)

    if bgm_mode in {"default", "custom"} and bgm_path:
        bgm_video_path = os.path.join(task_dir, "final_with_bgm.mp4")
        core.video.concat_videos(
            videos=[final_video_path],
            output=bgm_video_path,
            bgm_path=bgm_path,
            bgm_volume=bgm_volume,
            bgm_mode=bgm_mode,
        )
        final_video_path = bgm_video_path

    storyboard = Storyboard(
        title=goods_title or "Digital Human",
        config=StoryboardConfig(
            task_id=task_id,
            media_width=720,
            media_height=1280,
            frame_template="1080x1920/mock.html",
        ),
        frames=[
            StoryboardFrame(
                index=0,
                narration=generated_text,
                image_prompt=goods_title or generated_text,
                audio_path=audio_path,
                image_path=generated_image_path,
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
        "config": {"pipeline": "digital_human"},
    }
    await core.persistence.save_task_metadata(task_id, metadata)
    await core.persistence.save_storyboard(task_id, storyboard)
    if progress_callback:
        progress_callback("status.success", 100)
    return result
