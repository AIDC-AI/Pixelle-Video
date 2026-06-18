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
from web.pipelines.api_workflows import (
    list_api_media_workflows,
    render_api_video_controls,
    workflow_select_help,
    workflow_source_help,
    workflow_source_label,
)
from web.components.content_input import render_bgm_section
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

        # ====================================================================
        # Middle Column: Video Configuration
        # ====================================================================
        with middle_col:
            config_params = self._render_video_config(pixelle_video, asset_params)
        
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
    
    def _render_video_config(self, pixelle_video: Any, asset_params: dict | None = None) -> dict:
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
                "selfhost": tr("asset_based.source.selfhost"),
                "api": "API 调用" if get_language() == "zh_CN" else "API call",
            }
            
            # Check if RunningHub API key is configured
            comfyui_config = config_manager.get_comfyui_config()
            api_asset_analysis = getattr(pixelle_video, "api_asset_analysis", None)
            api_vlm_models = (
                api_asset_analysis.list_models(configured_only=True)
                if api_asset_analysis is not None
                else []
            )
            has_runninghub = bool(comfyui_config.get("runninghub_api_key"))
            has_selfhost = bool(comfyui_config.get("comfyui_url"))
            has_api_analysis = bool(api_vlm_models)

            asset_paths = (asset_params or {}).get("assets") or []
            image_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
            video_exts = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
            has_image_assets = any(Path(path).suffix.lower() in image_exts for path in asset_paths)
            has_video_assets = any(Path(path).suffix.lower() in video_exts for path in asset_paths)

            def analysis_source_available(source_name: str) -> bool:
                source_dir = Path("workflows") / source_name
                image_available = (source_dir / "analyse_image.json").exists()
                video_available = (source_dir / "analyse_video.json").exists()
                if has_image_assets and not image_available:
                    return False
                if has_video_assets and not video_available:
                    return False
                return image_available or video_available
            
            # Prefer API VLM when configured, so API media workflows do not depend on RunningHub.
            source_keys = []
            if analysis_source_available("runninghub"):
                source_keys.append("runninghub")
            if analysis_source_available("selfhost"):
                source_keys.append("selfhost")
            if has_api_analysis:
                source_keys.append("api")
            if not source_keys:
                source_keys = ["runninghub"]

            if has_api_analysis and "api" in source_keys:
                default_source = "api"
            elif has_runninghub and "runninghub" in source_keys:
                default_source = "runninghub"
            elif "selfhost" in source_keys:
                default_source = "selfhost"
            else:
                default_source = source_keys[0]
            default_source_index = source_keys.index(default_source)
            
            if st.session_state.get("asset_source") not in source_keys:
                st.session_state.pop("asset_source", None)

            source = st.radio(
                "素材分析服务" if get_language() == "zh_CN" else "Asset analysis service",
                options=source_keys,
                format_func=lambda x: source_options[x],
                index=default_source_index,
                horizontal=True,
                key="asset_source",
                label_visibility="visible",
                help=workflow_source_help("素材分析" if get_language() == "zh_CN" else "asset analysis"),
            )

            def build_analysis_workflows(source_name: str) -> list[dict]:
                if source_name == "api":
                    return [
                        {
                            "display_name": model_info["display_name"],
                            "image_workflow": None,
                            "video_workflow": None,
                            "model": model_info["model"],
                        }
                        for model_info in api_vlm_models
                    ]

                source_dir = Path("workflows") / source_name
                needs_image = has_image_assets or not asset_paths
                needs_video = has_video_assets or not asset_paths
                image_workflow = None
                video_workflow = None
                workflow_names = []

                if needs_image and (source_dir / "analyse_image.json").exists():
                    image_workflow = f"{source_name}/analyse_image.json"
                    workflow_names.append("analyse_image.json")
                if needs_video and (source_dir / "analyse_video.json").exists():
                    video_workflow = f"{source_name}/analyse_video.json"
                    workflow_names.append("analyse_video.json")

                if not workflow_names:
                    return []

                return [{
                    "display_name": f"{' + '.join(workflow_names)} - {workflow_source_label(source_name)}",
                    "image_workflow": image_workflow,
                    "video_workflow": video_workflow,
                    "model": None,
                }]

            analysis_workflows = build_analysis_workflows(source)
            analysis_options = [workflow["display_name"] for workflow in analysis_workflows]
            selected_analysis_workflow = {}

            if st.session_state.get("asset_analysis_workflow") not in analysis_options:
                st.session_state.pop("asset_analysis_workflow", None)

            if analysis_options:
                selected_analysis = st.selectbox(
                    "素材分析工作流/模型" if get_language() == "zh_CN" else "Asset analysis workflow/model",
                    analysis_options,
                    index=0,
                    key="asset_analysis_workflow",
                    help=workflow_select_help(),
                )
                selected_analysis_workflow = analysis_workflows[analysis_options.index(selected_analysis)]
            else:
                st.warning(
                    "当前服务没有可用的素材分析工作流/模型。"
                    if get_language() == "zh_CN"
                    else "No asset analysis workflow/model is available for the selected service."
                )
            
            # Show hint based on selection
            if source == "api":
                if not has_api_analysis:
                    st.warning(
                        "未配置可用于 VLM 素材分析的 API Key（DashScope/OpenAI/Gemini）。"
                        if get_language() == "zh_CN"
                        else "No API key configured for VLM asset analysis (DashScope/OpenAI/Gemini)."
                    )
                else:
                    st.info(
                        "使用上方选择的 API VLM 模型分析上传素材，不依赖 RunningHub/ComfyUI。"
                        if get_language() == "zh_CN"
                        else "Use the selected API VLM model to analyze uploaded assets without RunningHub/ComfyUI."
                    )
            elif source == "runninghub":
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
                    workflow_for_warning = (
                        selected_analysis_workflow.get("image_workflow")
                        or selected_analysis_workflow.get("video_workflow")
                    )
                    if workflow_for_warning:
                        check_and_warn_selfhost_workflow(workflow_for_warning)

            api_video_workflow = None
            api_video_params = {}
            api_video_workflows = list_api_media_workflows(
                pixelle_video,
                "video",
                required_adapter_abilities=["first_frame_i2v"],
                verified_only=True,
            )
            animation_source_options = ["none"]
            if api_video_workflows:
                animation_source_options.append("api")

            if st.session_state.get("asset_animation_source") not in animation_source_options:
                st.session_state.pop("asset_animation_source", None)

            def animation_source_label(value: str) -> str:
                if value == "none":
                    return "不启用" if get_language() == "zh_CN" else "Disabled"
                return workflow_source_label(value)

            animation_source = st.radio(
                "素材动画服务" if get_language() == "zh_CN" else "Asset animation service",
                animation_source_options,
                format_func=animation_source_label,
                horizontal=True,
                key="asset_animation_source",
                help=(
                    "选择是否把匹配到的图片素材动画化。不启用时保留原素材静态合成；API 模型会调用已验证的图生视频模型。"
                    if get_language() == "zh_CN"
                    else "Choose whether to animate matched image assets. Disabled keeps the original static asset composition; API models call verified image-to-video providers."
                ),
            )

            if animation_source == "api":
                animation_workflows = api_video_workflows
                animation_options = [wf["display_name"] for wf in animation_workflows]
                selected_animation = st.selectbox(
                    "素材动画工作流/模型" if get_language() == "zh_CN" else "Asset animation workflow/model",
                    animation_options,
                    index=0,
                    key="asset_animation_workflow",
                    help=workflow_select_help(),
                )
                selected_index = animation_options.index(selected_animation)
                selected_workflow = animation_workflows[selected_index]
                api_video_workflow = selected_workflow["key"]
                api_video_params = render_api_video_controls(
                    selected_workflow,
                    key_prefix="asset",
                    default_duration=5,
                    allow_audio_driven=True,
                    show_duration=False,
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
            "analysis_image_workflow": selected_analysis_workflow.get("image_workflow"),
            "analysis_video_workflow": selected_analysis_workflow.get("video_workflow"),
            "analysis_vlm_model": selected_analysis_workflow.get("model"),
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
                    if video_params.get("source") == "api" and not video_params.get("analysis_vlm_model"):
                        raise RuntimeError(
                            "请先在素材分析服务中选择 API VLM 模型。"
                            if get_language() == "zh_CN"
                            else "Please select an API VLM model in the asset analysis service settings."
                        )

                    ctx = run_async(pipeline(
                        assets=video_params["assets"],
                        video_title=video_params.get("video_title", ""),
                        intent=video_params.get("intent"),
                        duration=video_params.get("duration", 30),
                        source=video_params.get("source", "runninghub"),
                        analysis_image_workflow=video_params.get("analysis_image_workflow"),
                        analysis_video_workflow=video_params.get("analysis_video_workflow"),
                        analysis_vlm_model=video_params.get("analysis_vlm_model"),
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
