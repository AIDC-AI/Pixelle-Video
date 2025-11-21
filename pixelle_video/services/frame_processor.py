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
Frame processor - Process single frame through complete pipeline

Orchestrates: TTS → Image Generation → Frame Composition → Video Segment

Key Feature:
- TTS-driven video duration: Audio duration from TTS is passed to video generation workflows
  to ensure perfect sync between audio and video (no padding, no trimming needed)
"""

from typing import Callable, Optional

import httpx
from loguru import logger

from pixelle_video.models.progress import ProgressEvent
from pixelle_video.models.storyboard import Storyboard, StoryboardFrame, StoryboardConfig


class FrameProcessor:
    """Frame processor"""
    
    def __init__(self, pixelle_video_core):
        """
        Initialize
        
        Args:
            pixelle_video_core: PixelleVideoCore instance
        """
        self.core = pixelle_video_core
    
    async def __call__(
        self,
        frame: StoryboardFrame,
        storyboard: 'Storyboard',
        config: StoryboardConfig,
        total_frames: int = 1,
        progress_callback: Optional[Callable[[ProgressEvent], None]] = None
    ) -> StoryboardFrame:
        """
        Process single frame through complete pipeline
        
        Steps:
        1. Generate audio (TTS)
        2. Generate image (ComfyKit)
        3. Compose frame (add subtitle)
        4. Create video segment (image + audio)
        
        Args:
            frame: Storyboard frame to process
            storyboard: Storyboard instance
            config: Storyboard configuration
            total_frames: Total number of frames in storyboard
            progress_callback: Optional callback for progress updates (receives ProgressEvent)
            
        Returns:
            Processed frame with all paths filled
        """
        logger.info(f"Processing frame {frame.index}...")
        
        frame_num = frame.index + 1
        
        # Determine if this frame needs image generation
        needs_image = frame.image_prompt is not None
        
        try:
            # Step 1: Generate audio (TTS)
            if progress_callback:
                progress_callback(ProgressEvent(
                    event_type="frame_step",
                    progress=0.0,
                    frame_current=frame_num,
                    frame_total=total_frames,
                    step=1,
                    action="audio"
                ))
            await self._step_generate_audio(frame, config)
            
            # Step 2: Generate media (image or video, conditional)
            if needs_image:
                if progress_callback:
                    progress_callback(ProgressEvent(
                        event_type="frame_step",
                        progress=0.25,
                        frame_current=frame_num,
                        frame_total=total_frames,
                        step=2,
                        action="media"
                    ))
                await self._step_generate_media(frame, config)
            else:
                frame.image_path = None
                frame.media_type = None
                logger.debug(f"  2/4: Skipped media generation (not required by template)")
            
            # Step 3: Compose frame (add subtitle)
            if progress_callback:
                progress_callback(ProgressEvent(
                    event_type="frame_step",
                    progress=0.50 if needs_image else 0.33,
                    frame_current=frame_num,
                    frame_total=total_frames,
                    step=3,
                    action="compose"
                ))
            await self._step_compose_frame(frame, storyboard, config)
            
            # Step 4: Create video segment
            if progress_callback:
                progress_callback(ProgressEvent(
                    event_type="frame_step",
                    progress=0.75 if needs_image else 0.67,
                    frame_current=frame_num,
                    frame_total=total_frames,
                    step=4,
                    action="video"
                ))
            await self._step_create_video_segment(frame, config)
            
            logger.info(f"✅ Frame {frame.index} completed")
            return frame
            
        except Exception as e:
            logger.error(f"❌ Failed to process frame {frame.index}: {e}")
            raise
    
    async def _step_generate_audio(
        self,
        frame: StoryboardFrame,
        config: StoryboardConfig
    ):
        """Step 1: Generate audio using TTS"""
        logger.debug(f"  1/4: Generating audio for frame {frame.index}...")
        
        # Generate output path using task_id
        from pixelle_video.utils.os_util import get_task_frame_path
        output_path = get_task_frame_path(config.task_id, frame.index, "audio")
        
        # Build TTS params based on inference mode
        tts_params = {
            "text": frame.narration,
            "inference_mode": config.tts_inference_mode,
            "output_path": output_path,
        }
        
        if config.tts_inference_mode == "local":
            # Local mode: pass voice and speed
            if config.voice_id:
                tts_params["voice"] = config.voice_id
            if config.tts_speed is not None:
                tts_params["speed"] = config.tts_speed
        else:  # comfyui
            # ComfyUI mode: pass workflow, voice, speed, and ref_audio
            if config.tts_workflow:
                tts_params["workflow"] = config.tts_workflow
            if config.voice_id:
                tts_params["voice"] = config.voice_id
            if config.tts_speed is not None:
                tts_params["speed"] = config.tts_speed
            if config.ref_audio:
                tts_params["ref_audio"] = config.ref_audio
        
        audio_path = await self.core.tts(**tts_params)
        
        frame.audio_path = audio_path
        
        # Get audio duration
        frame.duration = await self._get_audio_duration(audio_path)
        
        logger.debug(f"  ✓ Audio generated: {audio_path} ({frame.duration:.2f}s)")
    
    async def _step_generate_media(
        self,
        frame: StoryboardFrame,
        config: StoryboardConfig
    ):
        """Step 2: Generate media (image or video) using ComfyKit"""
        logger.debug(f"  2/4: Generating media for frame {frame.index}...")
        
        # Determine media type based on workflow
        # video_ prefix in workflow name indicates video generation
        workflow_name = config.media_workflow or ""
        is_video_workflow = "video_" in workflow_name.lower()
        media_type = "video" if is_video_workflow else "image"
        
        logger.debug(f"  → Media type: {media_type} (workflow: {workflow_name})")
        
        # Build media generation parameters
        media_params = {
            "prompt": frame.image_prompt,
            "workflow": config.media_workflow,  # Pass workflow from config (None = use default)
            "media_type": media_type,
            "width": config.media_width,
            "height": config.media_height
        }
        
        # For video workflows: pass audio duration as target video duration
        # This ensures video length matches audio length from the source
        if is_video_workflow and frame.duration:
            media_params["duration"] = frame.duration
            logger.info(f"  → Generating video with target duration: {frame.duration:.2f}s (from TTS audio)")
        
        # Call Media generation
        media_result = await self.core.media(**media_params)
        
        # Store media type
        frame.media_type = media_result.media_type
        
        if media_result.is_image:
            # Download image to local (pass task_id)
            local_path = await self._download_media(
                media_result.url,
                frame.index,
                config.task_id,
                media_type="image"
            )
            frame.image_path = local_path
            logger.debug(f"  ✓ Image generated: {local_path}")
        
        elif media_result.is_video:
            # Download video to local (pass task_id)
            local_path = await self._download_media(
                media_result.url,
                frame.index,
                config.task_id,
                media_type="video"
            )
            frame.video_path = local_path
            
            # Update duration from video if available
            if media_result.duration:
                frame.duration = media_result.duration
                logger.debug(f"  ✓ Video generated: {local_path} (duration: {frame.duration:.2f}s)")
            else:
                # Get video duration from file
                frame.duration = await self._get_video_duration(local_path)
                logger.debug(f"  ✓ Video generated: {local_path} (duration: {frame.duration:.2f}s)")
        
        else:
            raise ValueError(f"Unknown media type: {media_result.media_type}")
    
    async def _step_compose_frame(
        self,
        frame: StoryboardFrame,
        storyboard: 'Storyboard',
        config: StoryboardConfig
    ):
        """Step 3: Compose frame with subtitle using HTML template"""
        logger.debug(f"  3/4: Composing frame {frame.index}...")
        
        # Generate output path using task_id
        from pixelle_video.utils.os_util import get_task_frame_path
        output_path = get_task_frame_path(config.task_id, frame.index, "composed")
        
        # For video type: render HTML as transparent overlay image
        # For image type: render HTML with image background
        # In both cases, we need the composed image
        composed_path = await self._compose_frame_html(frame, storyboard, config, output_path)
        
        frame.composed_image_path = composed_path
        
        logger.debug(f"  ✓ Frame composed: {composed_path}")
    
    async def _compose_frame_html(
        self,
        frame: StoryboardFrame,
        storyboard: 'Storyboard',
        config: StoryboardConfig,
        output_path: str
    ) -> str:
        """Compose frame using HTML template"""
        from pixelle_video.services.frame_html import HTMLFrameGenerator
        from pixelle_video.utils.template_util import resolve_template_path
        
        # Resolve template path (handles various input formats)
        template_path = resolve_template_path(config.frame_template)
        
        # Get content metadata from storyboard
        content_metadata = storyboard.content_metadata if storyboard else None
        
        # Build ext data
        ext = {}
        if content_metadata:
            ext["content_title"] = content_metadata.title or ""
            ext["content_author"] = content_metadata.author or ""
            ext["content_subtitle"] = content_metadata.subtitle or ""
            ext["content_genre"] = content_metadata.genre or ""
        
        # Add custom template parameters
        if config.template_params:
            ext.update(config.template_params)
        
        # Generate frame using HTML (size is auto-parsed from template path)
        generator = HTMLFrameGenerator(template_path)
        composed_path = await generator.generate_frame(
            title=storyboard.title,
            text=frame.narration,
            image=frame.image_path,
            ext=ext,
            output_path=output_path
        )
        
        return composed_path
    
    async def _step_create_video_segment(
        self,
        frame: StoryboardFrame,
        config: StoryboardConfig
    ):
        """Step 4: Create video segment from media + audio"""
        logger.debug(f"  4/4: Creating video segment for frame {frame.index}...")
        
        # Generate output path using task_id
        from pixelle_video.utils.os_util import get_task_frame_path
        output_path = get_task_frame_path(config.task_id, frame.index, "segment")
        
        from pixelle_video.services.video import VideoService
        video_service = VideoService()
        
        # Branch based on media type
        if frame.media_type == "video":
            # Video workflow: overlay HTML template on video, then add audio
            logger.debug(f"  → Using video-based composition with HTML overlay")
            
            # Step 1: Overlay transparent HTML image on video
            # The composed_image_path contains the rendered HTML with transparent background
            temp_video_with_overlay = get_task_frame_path(config.task_id, frame.index, "video") + "_overlay.mp4"
            
            video_service.overlay_image_on_video(
                video=frame.video_path,
                overlay_image=frame.composed_image_path,
                output=temp_video_with_overlay,
                scale_mode="contain"  # Scale video to fit template size (contain mode)
            )
            
            # Step 2: Add narration audio to the overlaid video
            # Note: The video might have audio (replaced) or be silent (audio added)
            segment_path = video_service.merge_audio_video(
                video=temp_video_with_overlay,
                audio=frame.audio_path,
                output=output_path,
                replace_audio=True,  # Replace video audio with narration
                audio_volume=1.0
            )
            
            # Clean up temp file
            import os
            if os.path.exists(temp_video_with_overlay):
                os.unlink(temp_video_with_overlay)
        
        elif frame.media_type == "image" or frame.media_type is None:
            # Image workflow: create video from image + audio
            logger.debug(f"  → Using image-based composition")
            
            segment_path = video_service.create_video_from_image(
                image=frame.composed_image_path,
                audio=frame.audio_path,
                output=output_path,
                fps=config.video_fps
            )
        
        else:
            raise ValueError(f"Unknown media type: {frame.media_type}")
        
        frame.video_segment_path = segment_path
        
        logger.debug(f"  ✓ Video segment created: {segment_path}")
    
    async def _get_audio_duration(self, audio_path: str) -> float:
        """Get audio duration in seconds"""
        try:
            # Try using ffmpeg-python
            import ffmpeg
            probe = ffmpeg.probe(audio_path)
            duration = float(probe['format']['duration'])
            return duration
        except Exception as e:
            logger.warning(f"Failed to get audio duration: {e}, using estimate")
            # Fallback: estimate based on file size (very rough)
            import os
            file_size = os.path.getsize(audio_path)
            # Assume ~16kbps for MP3, so 2KB per second
            estimated_duration = file_size / 2000
            return max(1.0, estimated_duration)  # At least 1 second
    
    async def _download_media(
        self,
        url: str,
        frame_index: int,
        task_id: str,
        media_type: str
    ) -> str:
        """Download media (image or video) from URL to local file"""
        from pixelle_video.utils.os_util import get_task_frame_path
        output_path = get_task_frame_path(task_id, frame_index, media_type)
        
        timeout = httpx.Timeout(connect=10.0, read=60, write=60, pool=60)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            with open(output_path, 'wb') as f:
                f.write(response.content)
        
        return output_path
    
    async def _get_video_duration(self, video_path: str) -> float:
        """Get video duration in seconds"""
        try:
            import ffmpeg
            probe = ffmpeg.probe(video_path)
            duration = float(probe['format']['duration'])
            return duration
        except Exception as e:
            logger.warning(f"Failed to get video duration: {e}, using audio duration")
            # Fallback: use audio duration if available
            return 1.0  # Default to 1 second if unable to determine

