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
Asset-Based Pipeline UI

Implements the UI for generating videos from user-provided assets.
"""

import os
import time
from pathlib import Path
from typing import Any

import streamlit as st
from loguru import logger

from web.i18n import tr, get_language
from web.pipelines.base import PipelineUI, register_pipeline_ui
from web.pipelines.api_workflows import list_api_media_workflows, render_api_video_controls
from web.components.content_input import render_bgm_section, render_version_info
from web.utils.async_helpers import run_async
from web.utils.streamlit_helpers import check_and_warn_selfhost_workflow
from pixelle_video.config import config_manager
from pixelle_video.models.progress import ProgressEvent


class AssetBasedPipelineUI(PipelineUI):
    """
    UI for the Asset-Based Video Generation Pipeline.
    Generates videos from user-provided assets (images/videos).
    """
    name = "custom_media"
    icon = "🎨"
    
    @property
    def display_name(self):
        return tr("pipeline.custom_media.name")
    
    @property
    def description(self):
        return tr("pipeline.custom_media.description")
    
    def render(self, pixelle_video: Any):
        # Three-column layout
        left_col, middle_col, right_col = st.columns([1, 1, 1])
        
        # ====================================================================
        # Left Column: Asset Upload & Video Info
        # ====================================================================
        with left_col:
            asset_params = self._render_asset_input()
            bgm_params = render_bgm_section(key_prefix="asset_")
            render_version_info()
        
        # ====================================================================
        # Middle Column: Video Configuration
        # ====================================================================
        with middle_col:
            config_params = self._render_video_config(pixelle_video)
        
        # ====================================================================
        # Right Column: Output Preview
        # ====================================================================
        with right_col:
            # Combine all parameters
            video_params = {
                "pipeline": self.name,
                **asset_params,
                **bgm_params,
                **config_params
            }
            
            self._render_output_preview(pixelle_video, video_params)
    
    def _render_asset_input(self) -> dict:
        """Render asset upload section"""
        with st.container(border=True):
            st.markdown(f"**{tr('asset_based.section.assets')}**")
            
            with st.expander(tr("help.feature_description"), expanded=False):
                st.markdown(f"**{tr('help.what')}**")
                st.markdown(tr("asset_based.assets.what"))
                st.markdown(f"**{tr('help.how')}**")
                st.markdown(tr("asset_based.assets.how"))
            
            # File uploader for multiple files
            uploaded_files = st.file_uploader(
                tr("asset_based.assets.upload"),
                type=["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "avi", "mkv", "webm"],
                accept_multiple_files=True,
                help=tr("asset_based.assets.upload_help"),
                key="asset_files"
            )
            
            # Save uploaded files to temp directory with unique session ID
            asset_paths = []
            if uploaded_files:
                import uuid
                session_id = str(uuid.uuid4()).replace('-', '')[:12]
                temp_dir = Path(f"temp/assets_{session_id}")
                temp_dir.mkdir(parents=True, exist_ok=True)
                
                for uploaded_file in uploaded_files:
                    file_path = temp_dir / uploaded_file.name
                    with open(file_path, "wb") as f:
                        f.write(uploaded_file.getbuffer())
                    asset_paths.append(str(file_path.absolute()))
                
                st.success(tr("asset_based.assets.count", count=len(asset_paths)))
                
                # Preview uploaded assets
                with st.expander(tr("asset_based.assets.preview"), expanded=True):
                    # Show in a grid (3 columns)
                    cols = st.columns(3)
                    for i, (file, path) in enumerate(zip(uploaded_files, asset_paths)):
                        with cols[i % 3]:
                            # Check if image or video
                            ext = Path(path).suffix.lower()
                            if ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
                                st.image(file, caption=file.name, use_container_width=True)
                            elif ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
                                st.video(file)
                                st.caption(file.name)
            else:
                st.info(tr("asset_based.assets.empty_hint"))
        
        # Video title & intent
        with st.container(border=True):
            st.markdown(f"**{tr('asset_based.section.video_info')}**")
            
            video_title = st.text_input(
                tr("asset_based.video_title"),
                placeholder=tr("asset_based.video_title_placeholder"),
                help=tr("asset_based.video_title_help"),
                key="asset_video_title"
            )
            
            intent = st.text_area(
                tr("asset_based.intent"),
                placeholder=tr("asset_based.intent_placeholder"),
                help=tr("asset_based.intent_help"),
                height=100,
                key="asset_intent"
            )
        
        return {
            "assets": asset_paths,
            "video_title": video_title,
            "intent": intent if intent else None
        }
    
    def _render_video_config(self, pixelle_video: Any) -> dict:
        """Render video configuration section"""
        # Duration configuration
        with st.container(border=True):
            st.markdown(f"**{tr('video.title')}**")
            
            # Duration slider
            duration = st.slider(
                tr("asset_based.duration"),
                min_value=15,
                max_value=120,
                value=30,
                step=5,
                help=tr("asset_based.duration_help"),
                key="asset_duration"
            )
            st.caption(tr("asset_based.duration_label", seconds=duration))
        
        # Workflow source selection
        with st.container(border=True):
            st.markdown(f"**{tr('asset_based.section.source')}**")
            
            with st.expander(tr("help.feature_description"), expanded=False):
                st.markdown(f"**{tr('help.what')}**")
                st.markdown(tr("asset_based.source.what"))
                st.markdown(f"**{tr('help.how')}**")
                st.markdown(tr("asset_based.source.how"))
            
            source_options = {
                "runninghub": tr("asset_based.source.runninghub"),
                "selfhost": tr("asset_based.source.selfhost")
            }
            
            # Check if RunningHub API key is configured
            comfyui_config = config_manager.get_comfyui_config()
            has_runninghub = bool(comfyui_config.get("runninghub_api_key"))
            has_selfhost = bool(comfyui_config.get("comfyui_url"))
            
            # Prefer the configured analysis backend; API video generation is independent of this choice.
            default_source_index = 0 if has_runninghub else 1
            
            source = st.radio(
                tr("asset_based.source.select"),
                options=list(source_options.keys()),
                format_func=lambda x: source_options[x],
                index=default_source_index,
                horizontal=True,
                key="asset_source",
                label_visibility="collapsed"
            )
            
            # Show hint based on selection
            if source == "runninghub":
                if not has_runninghub:
                    st.warning(tr("asset_based.source.runninghub_not_configured"))
                else:
                    st.info(tr("asset_based.source.runninghub_hint"))
            else:
                if not has_selfhost:
                    st.warning(tr("asset_based.source.selfhost_not_configured"))
                else:
                    st.info(tr("asset_based.source.selfhost_hint"))
                    # Check and warn for selfhost mode (auto popup if not confirmed)
                    # Use analyse_image.json as representative workflow
                    check_and_warn_selfhost_workflow("selfhost/analyse_image.json")

            api_video_workflows = list_api_media_workflows(
                pixelle_video,
                "video",
                required_adapter_abilities=["first_frame_i2v"],
                verified_only=True,
            )
            api_video_options = ["使用原工作流生成图片" if get_language() == "zh_CN" else "Use original image workflow"]
            api_video_options.extend([wf["display_name"] for wf in api_video_workflows])

            selected_api_video = st.selectbox(
                "API 图生视频模型" if get_language() == "zh_CN" else "API image-to-video model",
                api_video_options,
                index=0,
                help=(
                    "可选：将匹配到的图片素材先用 API 图生视频模型动画化，再进入后续字幕和合成。"
                    if get_language() == "zh_CN"
                    else "Optional: animate matched image assets with an API image-to-video model before subtitles and composition."
                ),
                key="asset_api_video_workflow",
            )

            api_video_workflow = None
            api_video_params = {}
            if selected_api_video != api_video_options[0] and api_video_workflows:
                selected_index = api_video_options.index(selected_api_video) - 1
                selected_workflow = api_video_workflows[selected_index]
                api_video_workflow = selected_workflow["key"]
                api_video_params = render_api_video_controls(
                    selected_workflow,
                    key_prefix="asset",
                    default_duration=5,
                    allow_audio_driven=True,
                )
                if source == "runninghub" and not has_runninghub:
                    st.info(
                        "已选择 API 视频模型；素材分析不会使用 RunningHub。请改选 Selfhost，或配置 RunningHub API Key。"
                        if get_language() == "zh_CN"
                        else "API video generation is selected; asset analysis does not use RunningHub. Please switch to Selfhost or configure a RunningHub API key."
                    )
        
        # TTS configuration
        with st.container(border=True):
            st.markdown(f"**{tr('section.tts')}**")
            
            # Import voice configuration
            from pixelle_video.tts_voices import EDGE_TTS_VOICES, get_voice_display_name
            
            # Get saved voice from config
            comfyui_config = config_manager.get_comfyui_config()
            tts_config = comfyui_config.get("tts", {})
            local_config = tts_config.get("local", {})
            saved_voice = local_config.get("voice", "zh-CN-YunjianNeural")
            saved_speed = local_config.get("speed", 1.2)
            
            # Build voice options with i18n
            voice_options = []
            voice_ids = []
            default_voice_index = 0
            
            for idx, voice_config in enumerate(EDGE_TTS_VOICES):
                voice_id = voice_config["id"]
                display_name = get_voice_display_name(voice_id, tr, get_language())
                voice_options.append(display_name)
                voice_ids.append(voice_id)
                
                if voice_id == saved_voice:
                    default_voice_index = idx
            
            # Two-column layout
            voice_col, speed_col = st.columns([1, 1])
            
            with voice_col:
                selected_voice_display = st.selectbox(
                    tr("tts.voice_selector"),
                    voice_options,
                    index=default_voice_index,
                    key="asset_tts_voice"
                )
                selected_voice_index = voice_options.index(selected_voice_display)
                voice_id = voice_ids[selected_voice_index]
            
            with speed_col:
                tts_speed = st.slider(
                    tr("tts.speed"),
                    min_value=0.5,
                    max_value=2.0,
                    value=saved_speed,
                    step=0.1,
                    format="%.1fx",
                    key="asset_tts_speed"
                )
                st.caption(tr("tts.speed_label", speed=f"{tts_speed:.1f}"))
        
        return {
            "duration": duration,
            "source": source,
            "api_video_workflow": api_video_workflow,
            "api_video_params": api_video_params,
            "voice_id": voice_id,
            "tts_speed": tts_speed
        }
    
    def _render_output_preview(self, pixelle_video: Any, video_params: dict):
        """Render output preview section"""
        with st.container(border=True):
            st.markdown(f"**{tr('section.video_generation')}**")
            
            # Check configuration
            if not config_manager.validate():
                st.warning(tr("settings.not_configured"))
            
            # Check if assets are provided
            assets = video_params.get("assets", [])
            if not assets:
                st.info(tr("asset_based.output.no_assets"))
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="asset_generate_disabled"
                )
                return
            
            # Show asset summary
            st.info(tr("asset_based.output.ready", count=len(assets)))
            
            # Generate button
            if st.button(tr("btn.generate"), type="primary", use_container_width=True, key="asset_generate"):
                # Validate
                if not config_manager.validate():
                    st.error(tr("settings.not_configured"))
                    st.stop()
                
                # Show progress
                progress_bar = st.progress(0)
                status_text = st.empty()
                
                start_time = time.time()
                
                try:
                    # Import pipeline
                    from pixelle_video.pipelines.asset_based import AssetBasedPipeline
                    
                    # Create pipeline
                    pipeline = AssetBasedPipeline(pixelle_video)
                    
                    # Progress callback
                    def update_progress(event: ProgressEvent):
                        if event.event_type == "analyzing_assets":
                            if event.extra_info == "start":
                                message = tr("asset_based.progress.analyzing_start", total=event.frame_total)
                            else:
                                message = tr("asset_based.progress.analyzing_complete", count=event.frame_total)
                        elif event.event_type == "analyzing_asset":
                            message = tr(
                                "asset_based.progress.analyzing_asset",
                                current=event.frame_current,
                                total=event.frame_total,
                                name=event.extra_info or ""
                            )
                        elif event.event_type == "generating_script":
                            if event.extra_info == "complete":
                                message = tr("asset_based.progress.script_complete")
                            else:
                                message = tr("asset_based.progress.generating_script")
                        elif event.event_type == "frame_step":
                            action_key = f"progress.step_{event.action}"
                            action_text = tr(action_key)
                            message = tr(
                                "progress.frame_step",
                                current=event.frame_current,
                                total=event.frame_total,
                                step=event.step,
                                action=action_text
                            )
                        elif event.event_type == "processing_frame":
                            message = tr(
                                "progress.frame",
                                current=event.frame_current,
                                total=event.frame_total
                            )
                        elif event.event_type == "concatenating":
                            if event.extra_info == "complete":
                                message = tr("asset_based.progress.concat_complete")
                            else:
                                message = tr("progress.concatenating")
                        elif event.event_type == "completed":
                            message = tr("progress.completed")
                        else:
                            message = tr(f"progress.{event.event_type}")
                        
                        status_text.text(message)
                        progress_bar.progress(min(int(event.progress * 100), 99))
                    
                    # Execute pipeline with progress callback
                    ctx = run_async(pipeline(
                        assets=video_params["assets"],
                        video_title=video_params.get("video_title", ""),
                        intent=video_params.get("intent"),
                        duration=video_params.get("duration", 30),
                        source=video_params.get("source", "runninghub"),
                        bgm_path=video_params.get("bgm_path"),
                        bgm_volume=video_params.get("bgm_volume", 0.2),
                        bgm_mode=video_params.get("bgm_mode", "loop"),
                        api_video_workflow=video_params.get("api_video_workflow"),
                        api_video_params=video_params.get("api_video_params"),
                        voice_id=video_params.get("voice_id", "zh-CN-YunjianNeural"),
                        tts_speed=video_params.get("tts_speed", 1.2),
                        progress_callback=update_progress
                    ))
                    
                    total_time = time.time() - start_time
                    
                    progress_bar.progress(100)
                    status_text.text(tr("status.success"))
                    
                    # Display result
                    st.success(tr("status.video_generated", path=ctx.final_video_path))
                    
                    st.markdown("---")
                    
                    # Video info
                    if os.path.exists(ctx.final_video_path):
                        file_size_mb = os.path.getsize(ctx.final_video_path) / (1024 * 1024)
                        n_scenes = len(ctx.storyboard.frames) if ctx.storyboard else 0
                        
                        info_text = (
                            f"⏱️ {tr('info.generation_time')} {total_time:.1f}s   "
                            f"📦 {file_size_mb:.2f}MB   "
                            f"🎬 {n_scenes}{tr('info.scenes_unit')}"
                        )
                        st.caption(info_text)
                        
                        st.markdown("---")
                        
                        # Video preview
                        st.video(ctx.final_video_path)
                        
                        # Download button
                        with open(ctx.final_video_path, "rb") as video_file:
                            video_bytes = video_file.read()
                            video_filename = os.path.basename(ctx.final_video_path)
                            st.download_button(
                                label="⬇️ 下载视频" if get_language() == "zh_CN" else "⬇️ Download Video",
                                data=video_bytes,
                                file_name=video_filename,
                                mime="video/mp4",
                                use_container_width=True
                            )
                    else:
                        st.error(tr("status.video_not_found", path=ctx.final_video_path))
                
                except Exception as e:
                    status_text.text("")
                    progress_bar.empty()
                    st.error(tr("status.error", error=str(e)))
                    logger.exception(e)
                    st.stop()


# Register self
register_pipeline_ui(AssetBasedPipelineUI)
