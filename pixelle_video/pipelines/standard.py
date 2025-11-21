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
Standard Video Generation Pipeline

Standard workflow for generating short videos from topic or fixed script.
This is the default pipeline for general-purpose video generation.
"""

from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, Literal

from loguru import logger
import asyncio

from pixelle_video.pipelines.base import BasePipeline
from pixelle_video.models.progress import ProgressEvent
from pixelle_video.models.storyboard import (
    Storyboard,
    StoryboardFrame,
    StoryboardConfig,
    ContentMetadata,
    VideoGenerationResult
)
from pixelle_video.utils.content_generators import (
    generate_title,
    generate_narrations_from_topic,
    split_narration_script,
    generate_image_prompts,
)


# Parallel limit for RunningHub workflows (Call by sequential if set to 1)
RUNNING_HUB_PARALLEL_LIMIT = 1


class StandardPipeline(BasePipeline):
    """
    Standard video generation pipeline
    
    Workflow:
    1. Generate/determine title
    2. Generate narrations (from topic or split fixed script)
    3. Generate image prompts for each narration
    4. For each frame:
       - Generate audio (TTS)
       - Generate image
       - Compose frame with template
       - Create video segment
    5. Concatenate all segments
    6. Add BGM (optional)
    
    Supports two modes:
    - "generate": LLM generates narrations from topic
    - "fixed": Use provided script as-is (each line = one narration)
    """
    
    async def __call__(
        self,
        # === Input (Required) ===
        text: str,
        media_width: int,  # Required: Media width (from template)
        media_height: int,  # Required: Media height (from template)
        
        # === Processing Mode ===
        mode: Literal["generate", "fixed"] = "generate",
        
        # === Optional Title ===
        title: Optional[str] = None,
        
        # === Basic Config ===
        n_scenes: int = 5,  # Only used in generate mode; ignored in fixed mode
        
        # === TTS Parameters (supports both old and new parameter names) ===
        tts_inference_mode: Optional[str] = None,  # "local" or "comfyui" (web UI)
        voice_id: Optional[str] = None,  # For backward compatibility (deprecated)
        tts_voice: Optional[str] = None,  # Voice ID for local mode (web UI)
        tts_workflow: Optional[str] = None,
        tts_speed: float = 1.2,
        ref_audio: Optional[str] = None,  # Reference audio for voice cloning
        output_path: Optional[str] = None,
        
        # === LLM Parameters ===
        min_narration_words: int = 5,
        max_narration_words: int = 20,
        min_image_prompt_words: int = 30,
        max_image_prompt_words: int = 60,
        
        # === Media Workflow ===
        media_workflow: Optional[str] = None,
        
        # === Video Parameters ===
        video_fps: int = 30,
        
        # === Frame Template (determines video size) ===
        frame_template: Optional[str] = None,
        
        # === Template Custom Parameters ===
        template_params: Optional[dict] = None,  # Custom template parameters
        
        # === Image Style ===
        prompt_prefix: Optional[str] = None,
        
        # === BGM Parameters ===
        bgm_path: Optional[str] = None,
        bgm_volume: float = 0.2,
        bgm_mode: Literal["once", "loop"] = "loop",
        
        # === Advanced Options ===
        content_metadata: Optional[ContentMetadata] = None,
        progress_callback: Optional[Callable[[ProgressEvent], None]] = None,
    ) -> VideoGenerationResult:
        """
        Generate short video from text input
        
        Args:
            text: Text input (required)
                  - For generate mode: topic/theme (e.g., "如何提高学习效率")
                  - For fixed mode: complete narration script (each line is a narration)
            
            mode: Processing mode (default "generate")
                  - "generate": LLM generates narrations from topic, creates n_scenes
                  - "fixed": Use existing script as-is, each line becomes a narration
                  
                  Note: In fixed mode, n_scenes is ignored (uses actual line count)
            
            title: Video title (optional)
                   - If provided, use it as the video title
                   - If not provided:
                     * generate mode → use text as title
                     * fixed mode → LLM generates title from script
            
            n_scenes: Number of storyboard scenes (default 5)
                      Only effective in generate mode; ignored in fixed mode
            
            voice_id: TTS voice ID (default "[Chinese] zh-CN Yunjian")
            tts_workflow: TTS workflow filename (e.g., "tts_edge.json", None = use default)
            tts_speed: TTS speed multiplier (1.0 = normal, 1.2 = 20% faster, default 1.2)
            ref_audio: Reference audio path for voice cloning (optional)
            output_path: Output video path (auto-generated if None)
            
            min_narration_words: Min narration length (generate mode only)
            max_narration_words: Max narration length (generate mode only)
            min_image_prompt_words: Min image prompt length
            max_image_prompt_words: Max image prompt length
            
            media_width: Media width (image or video, required)
            media_height: Media height (image or video, required)
            media_workflow: Media workflow filename (image or video, e.g., "image_flux.json", "video_wan.json", None = use default)
            
            video_fps: Video frame rate (default 30)
            
            frame_template: HTML template path with size (None = use default "1080x1920/default.html")
                           Format: "SIZExSIZE/template.html" (e.g., "1080x1920/default.html", "1920x1080/modern.html")
                           Video size is automatically determined from template path
            
            template_params: Custom template parameters (optional dict)
                            e.g., {"accent_color": "#ff0000", "author": "John Doe"}
            
            prompt_prefix: Image prompt prefix (overrides config.yaml if provided)
                          e.g., "anime style, vibrant colors" or "" for no prefix
            
            bgm_path: BGM path (filename like "default.mp3", custom path, or None)
            bgm_volume: BGM volume 0.0-1.0 (default 0.2)
            bgm_mode: BGM mode "once" or "loop" (default "loop")
            
            content_metadata: Content metadata (optional, for display)
            progress_callback: Progress callback function(ProgressEvent)
        
        Returns:
            VideoGenerationResult with video path and metadata
        """
        # ========== Step 0: Process text and determine title ==========
        logger.info(f"🚀 Starting StandardPipeline in '{mode}' mode")
        logger.info(f"   Text length: {len(text)} chars")
        
        # === Handle TTS parameter compatibility ===
        # Support both old API (voice_id) and new API (tts_inference_mode + tts_voice)
        final_voice_id = None
        final_tts_workflow = tts_workflow
        
        if tts_inference_mode:
            # New API from web UI
            if tts_inference_mode == "local":
                # Local Edge TTS mode - use tts_voice
                final_voice_id = tts_voice or "zh-CN-YunjianNeural"
                final_tts_workflow = None  # Don't use workflow in local mode
                logger.debug(f"TTS Mode: local (voice={final_voice_id})")
            elif tts_inference_mode == "comfyui":
                # ComfyUI workflow mode
                final_voice_id = None  # Don't use voice_id in ComfyUI mode
                # tts_workflow already set from parameter
                logger.debug(f"TTS Mode: comfyui (workflow={final_tts_workflow})")
        else:
            # Old API (backward compatibility)
            final_voice_id = voice_id or tts_voice or "zh-CN-YunjianNeural"
            # tts_workflow already set from parameter
            logger.debug(f"TTS Mode: legacy (voice_id={final_voice_id}, workflow={final_tts_workflow})")
        
        # Determine final title
        if title:
            final_title = title
            logger.info(f"   Title: '{title}' (user-specified)")
        else:
            self._report_progress(progress_callback, "generating_title", 0.01)
            if mode == "generate":
                final_title = await generate_title(self.llm, text, strategy="auto")
                logger.info(f"   Title: '{final_title}' (auto-generated)")
            else:  # fixed
                final_title = await generate_title(self.llm, text, strategy="llm")
                logger.info(f"   Title: '{final_title}' (LLM-generated)")
        
        # ========== Step 0.5: Create isolated task directory ==========
        from pixelle_video.utils.os_util import (
            create_task_output_dir,
            get_task_final_video_path
        )
        
        task_dir, task_id = create_task_output_dir()
        logger.info(f"📁 Task directory created: {task_dir}")
        logger.info(f"   Task ID: {task_id}")
        
        # Determine final video path
        user_specified_output = None
        if output_path is None:
            output_path = get_task_final_video_path(task_id)
        else:
            user_specified_output = output_path
            output_path = get_task_final_video_path(task_id)
            logger.info(f"   Will copy final video to: {user_specified_output}")
        
        # Create storyboard config
        config = StoryboardConfig(
            task_id=task_id,
            n_storyboard=n_scenes,
            min_narration_words=min_narration_words,
            max_narration_words=max_narration_words,
            min_image_prompt_words=min_image_prompt_words,
            max_image_prompt_words=max_image_prompt_words,
            video_fps=video_fps,
            tts_inference_mode=tts_inference_mode or "local",  # TTS inference mode (CRITICAL FIX)
            voice_id=final_voice_id,  # Use processed voice_id
            tts_workflow=final_tts_workflow,  # Use processed workflow
            tts_speed=tts_speed,
            ref_audio=ref_audio,
            media_width=media_width,
            media_height=media_height,
            media_workflow=media_workflow,
            frame_template=frame_template or "1080x1920/default.html",
            template_params=template_params  # Custom template parameters
        )
        
        # Create storyboard
        storyboard = Storyboard(
            title=final_title,
            config=config,
            content_metadata=content_metadata,
            created_at=datetime.now()
        )
        
        try:
            # ========== Step 1: Generate/Split narrations ==========
            if mode == "generate":
                self._report_progress(progress_callback, "generating_narrations", 0.05)
                narrations = await generate_narrations_from_topic(
                    self.llm,
                    topic=text,
                    n_scenes=n_scenes,
                    min_words=min_narration_words,
                    max_words=max_narration_words
                )
                logger.info(f"✅ Generated {len(narrations)} narrations")
            else:  # fixed
                self._report_progress(progress_callback, "splitting_script", 0.05)
                narrations = await split_narration_script(text)
                logger.info(f"✅ Split script into {len(narrations)} segments (by lines)")
                logger.info(f"   Note: n_scenes={n_scenes} is ignored in fixed mode")
            
            # ========== Step 2: Check template type and conditionally generate image prompts ==========
            # Detect template type to determine if media generation is needed
            from pathlib import Path
            from pixelle_video.utils.template_util import get_template_type
            
            template_name = Path(config.frame_template).name
            template_type = get_template_type(template_name)
            template_requires_media = (template_type in ["image", "video"])
            
            if template_type == "image":
                logger.info(f"📸 Template requires image generation")
            elif template_type == "video":
                logger.info(f"🎬 Template requires video generation")
            else:  # static
                logger.info(f"⚡ Static template - skipping media generation pipeline")
                logger.info(f"   💡 Benefits: Faster generation + Lower cost + No ComfyUI dependency")
            
            # Only generate image prompts if template requires media
            if template_requires_media:
                self._report_progress(progress_callback, "generating_image_prompts", 0.15)
                
                # Override prompt_prefix if provided
                original_prefix = None
                if prompt_prefix is not None:
                    image_config = self.core.config.get("comfyui", {}).get("image", {})
                    original_prefix = image_config.get("prompt_prefix")
                    image_config["prompt_prefix"] = prompt_prefix
                    logger.info(f"Using custom prompt_prefix: '{prompt_prefix}'")
                
                try:
                    # Create progress callback wrapper for image prompt generation
                    def image_prompt_progress(completed: int, total: int, message: str):
                        batch_progress = completed / total if total > 0 else 0
                        overall_progress = 0.15 + (batch_progress * 0.15)
                        self._report_progress(
                            progress_callback,
                            "generating_image_prompts",
                            overall_progress,
                            extra_info=message
                        )
                    
                    # Generate base image prompts
                    base_image_prompts = await generate_image_prompts(
                        self.llm,
                        narrations=narrations,
                        min_words=min_image_prompt_words,
                        max_words=max_image_prompt_words,
                        progress_callback=image_prompt_progress
                    )
                    
                    # Apply prompt prefix
                    from pixelle_video.utils.prompt_helper import build_image_prompt
                    image_config = self.core.config.get("comfyui", {}).get("image", {})
                    prompt_prefix_to_use = prompt_prefix if prompt_prefix is not None else image_config.get("prompt_prefix", "")
                    
                    image_prompts = []
                    for base_prompt in base_image_prompts:
                        final_prompt = build_image_prompt(base_prompt, prompt_prefix_to_use)
                        image_prompts.append(final_prompt)
                    
                finally:
                    # Restore original prompt_prefix
                    if original_prefix is not None:
                        image_config["prompt_prefix"] = original_prefix
                
                logger.info(f"✅ Generated {len(image_prompts)} image prompts")
            else:
                # Static template - skip image prompt generation entirely
                image_prompts = [None] * len(narrations)
                logger.info(f"⚡ Skipped image prompt generation (static template)")
                logger.info(f"   💡 Savings: {len(narrations)} LLM calls + {len(narrations)} media generations")
            
            # ========== Step 3: Create frames ==========
            for i, (narration, image_prompt) in enumerate(zip(narrations, image_prompts)):
                frame = StoryboardFrame(
                    index=i,
                    narration=narration,
                    image_prompt=image_prompt,
                    created_at=datetime.now()
                )
                storyboard.frames.append(frame)
            
            # ========== Step 4: Process each frame ==========
            # Check if using RunningHub workflows for parallel processing
            # Enable parallel if either TTS or Image uses RunningHub (most time-consuming parts)
            is_runninghub = (
                (config.tts_workflow and config.tts_workflow.startswith("runninghub/")) or
                (config.media_workflow and config.media_workflow.startswith("runninghub/"))
            )
            
            if is_runninghub and RUNNING_HUB_PARALLEL_LIMIT > 1:
                logger.info(f"🚀 Using parallel processing for RunningHub workflows (max {RUNNING_HUB_PARALLEL_LIMIT} concurrent)")
                logger.info(f"   TTS: {'runninghub' if config.tts_workflow and config.tts_workflow.startswith('runninghub/') else 'local'}")
                logger.info(f"   Media: {'runninghub' if config.media_workflow and config.media_workflow.startswith('runninghub/') else 'local'}")
                
                semaphore = asyncio.Semaphore(RUNNING_HUB_PARALLEL_LIMIT)
                completed_count = 0
                
                async def process_frame_with_semaphore(i: int, frame: StoryboardFrame):
                    nonlocal completed_count
                    async with semaphore:
                        base_progress = 0.2
                        frame_range = 0.6
                        per_frame_progress = frame_range / len(storyboard.frames)
                        
                        # Create frame-specific progress callback
                        def frame_progress_callback(event: ProgressEvent):
                            overall_progress = base_progress + (per_frame_progress * completed_count) + (per_frame_progress * event.progress)
                            if progress_callback:
                                adjusted_event = ProgressEvent(
                                    event_type=event.event_type,
                                    progress=overall_progress,
                                    frame_current=i+1,
                                    frame_total=len(storyboard.frames),
                                    step=event.step,
                                    action=event.action
                                )
                                progress_callback(adjusted_event)
                        
                        # Report frame start
                        self._report_progress(
                            progress_callback,
                            "processing_frame",
                            base_progress + (per_frame_progress * completed_count),
                            frame_current=i+1,
                            frame_total=len(storyboard.frames)
                        )
                        
                        processed_frame = await self.core.frame_processor(
                            frame=frame,
                            storyboard=storyboard,
                            config=config,
                            total_frames=len(storyboard.frames),
                            progress_callback=frame_progress_callback
                        )
                        
                        completed_count += 1
                        logger.info(f"✅ Frame {i+1} completed ({processed_frame.duration:.2f}s) [{completed_count}/{len(storyboard.frames)}]")
                        return i, processed_frame
                
                # Create all tasks and execute in parallel
                tasks = [process_frame_with_semaphore(i, frame) for i, frame in enumerate(storyboard.frames)]
                results = await asyncio.gather(*tasks)
                
                # Update frames in order and calculate total duration
                for idx, processed_frame in sorted(results, key=lambda x: x[0]):
                    storyboard.frames[idx] = processed_frame
                    storyboard.total_duration += processed_frame.duration
                
                logger.info(f"✅ All frames processed in parallel (total duration: {storyboard.total_duration:.2f}s)")
            else:
                # Serial processing for non-RunningHub workflows
                logger.info("⚙️ Using serial processing (non-RunningHub workflow)")
                
                for i, frame in enumerate(storyboard.frames):
                    base_progress = 0.2
                    frame_range = 0.6
                    per_frame_progress = frame_range / len(storyboard.frames)
                    
                    # Create frame-specific progress callback
                    def frame_progress_callback(event: ProgressEvent):
                        overall_progress = base_progress + (per_frame_progress * i) + (per_frame_progress * event.progress)
                        if progress_callback:
                            adjusted_event = ProgressEvent(
                                event_type=event.event_type,
                                progress=overall_progress,
                                frame_current=event.frame_current,
                                frame_total=event.frame_total,
                                step=event.step,
                                action=event.action
                            )
                            progress_callback(adjusted_event)
                    
                    # Report frame start
                    self._report_progress(
                        progress_callback,
                        "processing_frame",
                        base_progress + (per_frame_progress * i),
                        frame_current=i+1,
                        frame_total=len(storyboard.frames)
                    )
                    
                    processed_frame = await self.core.frame_processor(
                        frame=frame,
                        storyboard=storyboard,
                        config=config,
                        total_frames=len(storyboard.frames),
                        progress_callback=frame_progress_callback
                    )
                    storyboard.total_duration += processed_frame.duration
                    logger.info(f"✅ Frame {i+1} completed ({processed_frame.duration:.2f}s)")
            
            # ========== Step 5: Concatenate videos ==========
            self._report_progress(progress_callback, "concatenating", 0.85)
            segment_paths = [frame.video_segment_path for frame in storyboard.frames]
            
            from pixelle_video.services.video import VideoService
            video_service = VideoService()
            
            final_video_path = video_service.concat_videos(
                videos=segment_paths,
                output=output_path,
                bgm_path=bgm_path,
                bgm_volume=bgm_volume,
                bgm_mode=bgm_mode
            )
            
            storyboard.final_video_path = final_video_path
            storyboard.completed_at = datetime.now()
            
            # Copy to user-specified path if provided
            if user_specified_output:
                import shutil
                Path(user_specified_output).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(final_video_path, user_specified_output)
                logger.info(f"📹 Final video copied to: {user_specified_output}")
                final_video_path = user_specified_output
                storyboard.final_video_path = user_specified_output
            
            logger.success(f"🎬 Video generation completed: {final_video_path}")
            
            # ========== Step 6: Create result ==========
            self._report_progress(progress_callback, "completed", 1.0)
            
            video_path_obj = Path(final_video_path)
            file_size = video_path_obj.stat().st_size
            
            result = VideoGenerationResult(
                video_path=final_video_path,
                storyboard=storyboard,
                duration=storyboard.total_duration,
                file_size=file_size
            )
            
            logger.info(f"✅ Generated video: {final_video_path}")
            logger.info(f"   Duration: {storyboard.total_duration:.2f}s")
            logger.info(f"   Size: {file_size / (1024*1024):.2f} MB")
            logger.info(f"   Frames: {len(storyboard.frames)}")
            
            # ========== Step 7: Persist metadata and storyboard ==========
            await self._persist_task_data(
                storyboard=storyboard,
                result=result,
                input_params={
                    "text": text,
                    "mode": mode,
                    "title": title,
                    "n_scenes": n_scenes,
                    "tts_inference_mode": tts_inference_mode,
                    "tts_voice": tts_voice,
                    "voice_id": voice_id,
                    "tts_workflow": tts_workflow,
                    "tts_speed": tts_speed,
                    "ref_audio": ref_audio,
                    "media_workflow": media_workflow,
                    "prompt_prefix": prompt_prefix,
                    "frame_template": frame_template,
                    "template_params": template_params,
                    "bgm_path": bgm_path,
                    "bgm_volume": bgm_volume,
                    "bgm_mode": bgm_mode,
                }
            )
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Video generation failed: {e}")
            raise
    
    async def _persist_task_data(
        self,
        storyboard: Storyboard,
        result: VideoGenerationResult,
        input_params: dict
    ):
        """
        Persist task metadata and storyboard to filesystem
        
        Args:
            storyboard: Complete storyboard
            result: Video generation result
            input_params: Input parameters used for generation
        """
        try:
            task_id = storyboard.config.task_id
            if not task_id:
                logger.warning("No task_id in storyboard, skipping persistence")
                return
            
            # Build metadata
            # If user didn't provide a title, use the generated one from storyboard
            input_with_title = input_params.copy()
            if not input_with_title.get("title"):
                input_with_title["title"] = storyboard.title
            
            metadata = {
                "task_id": task_id,
                "created_at": storyboard.created_at.isoformat() if storyboard.created_at else None,
                "completed_at": storyboard.completed_at.isoformat() if storyboard.completed_at else None,
                "status": "completed",
                
                "input": input_with_title,
                
                "result": {
                    "video_path": result.video_path,
                    "duration": result.duration,
                    "file_size": result.file_size,
                    "n_frames": len(storyboard.frames)
                },
                
                "config": {
                    "llm_model": self.core.config.get("llm", {}).get("model", "unknown"),
                    "llm_base_url": self.core.config.get("llm", {}).get("base_url", "unknown"),
                    "comfyui_url": self.core.config.get("comfyui", {}).get("comfyui_url", "unknown"),
                    "runninghub_enabled": bool(self.core.config.get("comfyui", {}).get("runninghub_api_key")),
                }
            }
            
            # Save metadata
            await self.core.persistence.save_task_metadata(task_id, metadata)
            logger.info(f"💾 Saved task metadata: {task_id}")
            
            # Save storyboard
            await self.core.persistence.save_storyboard(task_id, storyboard)
            logger.info(f"💾 Saved storyboard: {task_id}")
            
        except Exception as e:
            logger.error(f"Failed to persist task data: {e}")
            # Don't raise - persistence failure shouldn't break video generation

