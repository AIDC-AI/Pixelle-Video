import os
import time
from pathlib import Path
from typing import Any

import streamlit as st
from loguru import logger
from web.i18n import tr, get_language
from web.pipelines.base import PipelineUI, register_pipeline_ui
from web.components.content_input import render_version_info
from web.components.digital_tts_config import render_style_config
from web.utils.async_helpers import run_async
from web.utils.streamlit_helpers import check_and_warn_selfhost_workflow
from pixelle_video.config import config_manager
from pixelle_video.pipelines import digital_human as _impl

class DigitalHumanPipelineUI(PipelineUI):
    """
    UI for the Digital_Human Video Generation Pipeline.
    Generates videos from user-provided assets (images&videos&audio).
    """
    name = "digital_human"
    icon = "🤖"
    
    @property
    def display_name(self):
        return tr("pipeline.digital_human.name")
    
    @property
    def description(self):
        return tr("pipeline.digital_human.description")

    def render(self, pixelle_video: Any):
        # Three-column layout
        left_col, middle_col, right_col = st.columns([1, 1, 1])
        
        # ====================================================================
        # Left Column: Asset Upload
        # ====================================================================
        with left_col:
            asset_params = self.render_digital_human_input()
            style_params = render_style_config(pixelle_video)
            # bgm_params = render_bgm_section(key_prefix="asset_")
            render_version_info()
        
        # ====================================================================
        # Middle Column: Video Configuration
        # ====================================================================
        with middle_col:
            # Style configuration ()
            workflow_path = self.workflow_path_config()
            mode_params = self.render_digital_human_mode(asset_params["character_assets"])
        
        # ====================================================================
        # Right Column: Output Preview
        # ====================================================================
        with right_col:
            # Combine all parameters
            video_params = {
                **mode_params,
                **asset_params,
                **style_params,
                "workflow_path": workflow_path
            }
            
            self._render_output_preview(pixelle_video, video_params)

    def render_digital_human_input(self) -> dict:
        """Render digital human character image upload section"""
        with st.container(border=True):
            st.markdown(f"**{tr('digital_human.section.character_assets')}**")
            
            with st.expander(tr("help.feature_description"), expanded=False):
                st.markdown(f"**{tr('help.what')}**")
                st.markdown(tr("digital_human.assets.character_what"))
                st.markdown(f"**{tr('help.how')}**")
                st.markdown(tr("digital_human.assets.how"))
            
            # File uploader for multiple files
            uploaded_files = st.file_uploader(
                tr("digital_human.assets.upload"),
                type=["jpg", "jpeg", "png", "webp"],
                accept_multiple_files=True,
                help=tr("digital_human.assets.upload_help"),
                key="character_files"
            )
            
            # Save uploaded files to temp directory with unique session ID
            character_asset_paths = []
            if uploaded_files:
                import uuid
                session_id = str(uuid.uuid4()).replace('-', '')[:12]
                temp_dir = Path(f"temp/assets_{session_id}")
                temp_dir.mkdir(parents=True, exist_ok=True)
                
                for uploaded_file in uploaded_files:
                    file_path = temp_dir / uploaded_file.name
                    with open(file_path, "wb") as f:
                        f.write(uploaded_file.getbuffer())
                    character_asset_paths.append(str(file_path.absolute()))
                
                st.success(tr("digital_human.assets.character_sucess"))
                
                # Preview uploaded assets
                with st.expander(tr("digital_human.assets.preview"), expanded=True):
                    # Show in a grid (3 columns)
                    cols = st.columns(3)
                    for i, (file, path) in enumerate(zip(uploaded_files, character_asset_paths)):
                        with cols[i % 3]:
                            # Check if image
                            ext = Path(path).suffix.lower()
                            if ext in [".jpg", ".jpeg", ".png", ".webp"]:
                                st.image(file, caption=file.name, use_container_width=True)
            else:
                st.info(tr("digital_human.assets.character_empty_hint"))

            return {"character_assets": character_asset_paths}

    def workflow_path_config(self) -> dict:
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
            
            # Default to runninghub always
            default_source_index = 0
            
            source = st.radio(
                tr("asset_based.source.select"),
                options=list(source_options.keys()),
                format_func=lambda x: source_options[x],
                index=default_source_index,
                horizontal=True,
                key="digital_human_workflow_source",
                label_visibility="collapsed"
            )
            
            # Initialize workflow_config with default value based on source selection
            # This ensures the variable is always defined even if the backend is not configured
            if source == "runninghub":
                workflow_config = {
                    "first_workflow_path": "workflows/runninghub/digital_image.json",
                    "second_workflow_path": "workflows/runninghub/digital_combination.json",
                    "third_workflow_path": "workflows/runninghub/digital_customize.json"
                }
                if not has_runninghub:
                    st.warning(tr("asset_based.source.runninghub_not_configured"))
                else:
                    st.info(tr("asset_based.source.runninghub_hint"))
            else:
                workflow_config = {
                    "first_workflow_path": "workflows/selfhost/digital_image.json",
                    "second_workflow_path": "workflows/selfhost/digital_combination.json",
                    "third_workflow_path": "workflows/selfhost/digital_customize.json"
                }
                if not has_selfhost:
                    st.warning(tr("asset_based.source.selfhost_not_configured"))
                else:
                    st.info(tr("asset_based.source.selfhost_hint"))
                    
                    # Check and warn for selfhost workflows (auto popup if not confirmed)
                    # Warn for the first workflow as representative
                    # TODO: need to check if the workflow is valid
                    # check_and_warn_selfhost_workflow("selfhost/digital_image.json")
            return workflow_config

    def render_digital_human_mode(self, character_asset_paths: list) -> dict:
        with st.container(border=True):
            st.markdown(f"**{tr('digital_human.section.select_mode')}**")
            
            with st.expander(tr("help.feature_description"), expanded=False):
                st.markdown(f"**{tr('help.what')}**")
                st.markdown(tr("digital_human.assets.mode_what"))
                st.markdown(f"**{tr('help.how')}**")
                st.markdown(tr("digital_human.assets.select_how"))
            
            mode = st.radio(
                "Processing Mode",
                ["digital", "customize"],
                horizontal=True,
                format_func=lambda x: tr(f"mode.{x}"),
                label_visibility="collapsed",
                key="mode_selection"
                )
            
            # Text input (unified for both modes)
            text_placeholder = tr("digital_human.input.topic_placeholder") if mode == "digital" else tr("digital_human.input.content_placeholder")
            text_height = 120 if mode == "digital" else 200
            text_help = tr("input.text_help_digital") if mode == "digital" else tr("input.text_help_fixed")
            
            if mode == "digital":
                # File uploader for multiple files
                uploaded_files = st.file_uploader(
                    tr("digital_human.assets.upload"),
                    type=["jpg", "jpeg", "png", "webp"],
                    accept_multiple_files=True,
                    help=tr("digital_human.assets.upload_help"),
                    key="digital_files"
                )
                
                # Save uploaded files to temp directory with unique session ID
                goods_asset_paths = []
                if uploaded_files:
                    import uuid
                    session_id = str(uuid.uuid4()).replace('-', '')[:12]
                    temp_dir = Path(f"temp/assets_{session_id}")
                    temp_dir.mkdir(parents=True, exist_ok=True)
                
                    for uploaded_file in uploaded_files:
                        file_path = temp_dir / uploaded_file.name
                        with open(file_path, "wb") as f:
                            f.write(uploaded_file.getbuffer())
                        goods_asset_paths.append(str(file_path.absolute()))
                
                    st.success(tr("digital_human.assets.goods_sucess"))
                
                    # Preview uploaded assets
                    with st.expander(tr("digital_human.assets.preview"), expanded=True):
                        # Show in a grid (3 columns)
                        cols = st.columns(3)
                        for i, (file, path) in enumerate(zip(uploaded_files, goods_asset_paths)):
                            with cols[i % 3]:
                                # Check if image
                                ext = Path(path).suffix.lower()
                                if ext in [".jpg", ".jpeg", ".png", ".webp"]:
                                    st.image(file, caption=file.name, use_container_width=True)
                else:
                    st.info(tr("digital_human.assets.goods_empty_hint"))
                    # Text input
                goods_text = st.text_area(
                    tr("digital_human.input_text"),
                    placeholder=text_placeholder,
                    height=text_height,
                    help=text_help,
                    key="digital_box"
                    )

                goods_title = st.text_input(
                    tr("digital_human.goods_title"),
                    placeholder=tr("digital_human.goods_title_placeholder"),
                    help=tr("digital_human.goods_title_help"),
                    key="goods_title"
                )

                return {
                    "character_assets": character_asset_paths,
                    "goods_title": goods_title,
                    "goods_assets": goods_asset_paths,
                    "goods_text": goods_text,
                    "mode": mode
                    }

            else:
                goods_text = st.text_area(
                    tr("digital_human.customize_text"),
                    placeholder=text_placeholder,
                    height=text_height,
                    help=text_help,
                    key="customize_box"
                )

                return {
                    "character_assets": character_asset_paths,
                    "goods_text": goods_text,
                    "mode": mode
                    }
                    
    def _render_output_preview(self, pixelle_video: Any, video_params: dict):
        """Render output preview section"""
        with st.container(border=True):
            st.markdown(f"**{tr('section.video_generation')}**")
            
            # Check configuration
            if not config_manager.validate():
                st.warning(tr("settings.not_configured"))
            
            # Get input data
            character_assets = video_params.get("character_assets", [])
            goods_assets = video_params.get("goods_assets", [])
            goods_title = video_params.get("goods_title", "")
            goods_text = video_params.get("goods_text", "")
            mode = video_params.get("mode")
            tts_voice = video_params.get("tts_voice", "zh-CN-YunjianNeural")
            tts_speed = video_params.get("tts_speed", 1.2)
            
            logger.info(f"🔧 The obtained TTS parameters:")
            logger.info(f"  - tts_voice: {tts_voice}")
            logger.info(f"  - tts_speed: {tts_speed}")
            logger.info(f"  - video_params中的tts_voice: {video_params.get('tts_voice', 'NOT_FOUND')}")
            logger.info(f"  - video_params: {video_params}")
            
            # Validation
            if not character_assets:
                st.info(tr("digital_human.assets.character_warning"))
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="digital_human_generate_disabled"
                )
                return

            if mode == "digital" and not goods_assets:
                st.info(tr("digital_human.assets.goods_warning"))
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="digital_human_goods_vaiidation"
                )
                return

            if mode == "digital" and not (goods_text or goods_title):
                st.info(tr("digital_human.assets.digital_mode"))
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="digital_human_digital_disable"
                )
                return
            
            if mode == "digital" and (goods_text or goods_title):
                st.warning(tr("digital_human.assets.digital_mode_warning"))
            
            if mode == "customize" and not goods_text:
                st.info(tr("digital_human.assets.customize_mode"))
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="digital_human_customize_disable"
                )
                return
            
            # Generate button
            if st.button(tr("btn.generate"), type="primary", use_container_width=True, key="digital_human_generate"):
                # Validate
                if not config_manager.validate():
                    st.error(tr("settings.not_configured"))
                    st.stop()
                
                # Show progress
                progress_bar = st.progress(0)
                status_text = st.empty()
                
                start_time = time.time()
                
                try:
                    # Define async generation function
                    async def generate_digital_human_video():
                        result = await _impl.run(
                            pixelle_video,
                            portrait_url=character_assets[0],
                            narration=goods_text,
                            voice_workflow=video_params.get("tts_workflow"),
                            workflow_path=video_params["workflow_path"],
                            mode=mode,
                            goods_assets=goods_assets,
                            goods_title=goods_title,
                            tts_inference_mode=video_params.get("tts_inference_mode", "local"),
                            tts_voice=video_params.get("tts_voice"),
                            tts_speed=video_params.get("tts_speed"),
                            tts_workflow=video_params.get("tts_workflow"),
                            ref_audio=video_params.get("ref_audio"),
                            progress_callback=lambda key, progress: (
                                status_text.text(tr(key)),
                                progress_bar.progress(progress),
                            ),
                        )
                        return result.video_path
                                
                    # Execute async generation
                    final_video_path = run_async(generate_digital_human_video())
                    
                    total_time = time.time() - start_time
                    progress_bar.progress(100)
                    status_text.text(tr("status.success"))
                    
                    # Display result
                    st.success(tr("status.video_generated", path=final_video_path))
                    
                    st.markdown("---")
                    
                    # Video info
                    if os.path.exists(final_video_path):
                        file_size_mb = os.path.getsize(final_video_path) / (1024 * 1024)
                        
                        info_text = (
                            f"⏱️ {tr('info.generation_time')} {total_time:.1f}s   "
                            f"📦 {file_size_mb:.2f}MB"
                        )
                        st.caption(info_text)
                        
                        st.markdown("---")
                        
                        # Video preview
                        st.video(final_video_path)
                        
                        # Download button
                        with open(final_video_path, "rb") as video_file:
                            video_bytes = video_file.read()
                            video_filename = os.path.basename(final_video_path)
                            st.download_button(
                                label="⬇️ 下载视频" if get_language() == "zh_CN" else "⬇️ Download Video",
                                data=video_bytes,
                                file_name=video_filename,
                                mime="video/mp4",
                                use_container_width=True
                            )
                    else:
                        st.error(tr("status.video_not_found", path=final_video_path))
                
                except Exception as e:
                    status_text.text("")
                    progress_bar.empty()
                    st.error(tr("status.error", error=str(e)))
                    logger.exception(e)
                    st.stop()


# Register self
register_pipeline_ui(DigitalHumanPipelineUI)
