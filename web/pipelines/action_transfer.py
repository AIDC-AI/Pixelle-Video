import os
import time
from pathlib import Path
from typing import Any
from moviepy.editor import VideoFileClip

import streamlit as st
from loguru import logger
import httpx
from web.i18n import tr, get_language
from web.pipelines.base import PipelineUI, register_pipeline_ui
from web.pipelines.api_workflows import is_api_workflow, list_api_media_workflows
from web.components.content_input import render_version_info
from web.utils.async_helpers import run_async
from web.utils.streamlit_helpers import check_and_warn_selfhost_workflow
from pixelle_video.config import config_manager
from pixelle_video.utils.os_util import create_task_output_dir

class ActionTransferPipelineUI(PipelineUI):
    """
    UI for the Action transfer Video Generation Pipeline.
    Generates videos from user-provided assets (images&text&video).
    """
    name = "action_transfer"
    icon = "💃"
    
    @property
    def display_name(self):
        return tr("pipeline.action_transfer.name")
    
    @property
    def description(self):
        return tr("pipeline.action_transfer.description")

    def render(self, pixelle_video: Any):
        # Three-column layout
        left_col,middle_col,right_col = st.columns([1, 1, 1])

        # ====================================================================
        # Left Column: Video Upload
        # ====================================================================
        with left_col:
            video_params = self.render_action_transfer_video_input(pixelle_video)
            render_version_info()
        
        # ====================================================================
        # Middle Column: Image Upload & Prompt
        # ====================================================================
        with middle_col:
            assets_params = self.render_action_transfer_assets_input(pixelle_video)


        # ====================================================================
        # Right Column: Output Preview
        # ====================================================================
        with right_col:
            video_params = {
                **video_params,
                **assets_params
            }

            self._render_output_preview(pixelle_video, video_params)

    def render_action_transfer_video_input(self, pixelle_video) -> dict:
        with st.container(border=True):
            st.markdown(f"**{tr('action_transfer.video_upload')}**")

            with st.expander(tr("help.feature_description"), expanded=False):
                st.markdown(f"**{tr('help.what')}**")
                st.markdown(tr("action_transfer.assets.video_what"))
                st.markdown(f"**{tr('help.how')}**")
                st.markdown(tr("action_transfer.assets.video_how"))

            # File uploader for multiple files
            uploaded_files = st.file_uploader(
                tr("action_transfer.assets.video_upload"),
                type=["mp4","mkv","mov"],
                accept_multiple_files=True,
                help=tr("action_transfer.assets.video_upload_help"),
                key="action_reference_files"
            )

            # Save uploaded files to temp directory with unique session ID
            video_asset_paths = []
            if uploaded_files:
                import uuid
                session_id = str(uuid.uuid4()).replace('-', '')[:12]
                temp_dir = Path(f"temp/assets_{session_id}")
                temp_dir.mkdir(parents=True, exist_ok=True)
                
                for uploaded_file in uploaded_files:
                    file_path = temp_dir / uploaded_file.name
                    with open(file_path, "wb") as f:
                        f.write(uploaded_file.getbuffer())
                    video_asset_paths.append(str(file_path.absolute()))
                
                st.success(tr("action_transfer.assets.video_sucess"))
                
                # Preview uploaded assets
                with st.expander(tr("action_transfer.assets.preview"), expanded=True):
                    # Show in a grid (3 columns)
                    cols = st.columns(3)
                    for i, (file, path) in enumerate(zip(uploaded_files, video_asset_paths)):
                        with cols[i % 3]:
                            # Check if image
                            ext = Path(path).suffix.lower()
                            if ext in [".mp4", ".mkv", ".mov"]:
                                st.video(file)
            else:
                st.info(tr("action_transfer.assets.video_empty_hint"))
            
            # Get the video length (rounded down).
            if video_asset_paths:
                clip = VideoFileClip(video_asset_paths[0])
                int_duration = int(clip.duration)
                duration = min(int_duration, 30)
            else:
                duration = 0

            return {
                "video_assets": video_asset_paths,
                "duration": duration
                }

    def render_action_transfer_assets_input(self, pixelle_video) -> dict:
        with st.container(border=True):
            st.markdown(f"**{tr('action_transfer.image_upload')}**")

            with st.expander(tr("help.feature_description"), expanded=False):
                st.markdown(f"**{tr('help.what')}**")
                st.markdown(tr("action_transfer.assets.image_what"))
                st.markdown(f"**{tr('help.how')}**")
                st.markdown(tr("action_transfer.assets.image_how"))

            # File uploader for multiple files
            uploaded_files = st.file_uploader(
                tr("action_transfer.assets.image_upload"),
                type=["jpg", "jpeg", "png", "webp"],
                accept_multiple_files=True,
                help=tr("action_transfer.assets.image_upload_help"),
                key="image_files"
                )

             # Save uploaded files to temp directory with unique session ID
            image_asset_paths = []
            if uploaded_files:
                import uuid
                session_id = str(uuid.uuid4()).replace('-', '')[:12]
                temp_dir = Path(f"temp/assets_{session_id}")
                temp_dir.mkdir(parents=True, exist_ok=True)
                
                for uploaded_file in uploaded_files:
                    file_path = temp_dir / uploaded_file.name
                    with open(file_path, "wb") as f:
                        f.write(uploaded_file.getbuffer())
                    image_asset_paths.append(str(file_path.absolute()))
                
                st.success(tr("action_transfer.assets.image_sucess"))
                
                # Preview uploaded assets
                with st.expander(tr("action_transfer.assets.preview"), expanded=True):
                    # Show in a grid (3 columns)
                    cols = st.columns(3)
                    for i, (file, path) in enumerate(zip(uploaded_files, image_asset_paths)):
                        with cols[i % 3]:
                            # Check if image
                            ext = Path(path).suffix.lower()
                            if ext in [".jpg", ".jpeg", ".png", ".webp"]:
                                st.image(file, caption=file.name, use_container_width=True)
            else:
                st.info(tr("action_transfer.assets.image_empty_hint"))
            
            def list_action_transfer_workflows():
                result = []
                for source in ("runninghub", "selfhost"):
                    dir_path = os.path.join("workflows", source)
                    if not os.path.isdir(dir_path):
                        continue
                    for fname in os.listdir(dir_path):
                        if fname.startswith("af_") and fname.endswith(".json"):
                            display = f"{fname} - {'Runninghub' if source == 'runninghub' else 'Selfhost'}"
                            result.append({
                                "key": f"{source}/{fname}",
                                "display_name": display
                            })
                result.extend(list_api_media_workflows(pixelle_video, "video"))
                return result
            
            prompt_text = st.text_area(
                        tr("action_transfer.input_text"),
                        placeholder=tr("action_transfer.input.topic_placeholder"),
                        height=200,
                        help=tr("input.text_help_audio"),
                        key="prompt_box"
                        )
            
            transfer_workflows = list_action_transfer_workflows()
            workflow_options = [wf["display_name"] for wf in transfer_workflows] 
            workflow_keys = [wf["key"] for wf in transfer_workflows]               
            default_workflow_index = 0

            workflow_display = st.selectbox(
                tr("action_transfer.workflow_select"),
                workflow_options if workflow_options else ["No workflow found"],
                index=default_workflow_index,
                label_visibility="collapsed",
                key="action_transfer_workflow_select"
            )

            if workflow_options:
                workflow_selected_index = workflow_options.index(workflow_display)
                workflow_key = workflow_keys[workflow_selected_index]
            else:
                workflow_key = None
            
            # Check and warn for selfhost workflow (auto popup if not confirmed)
            if not is_api_workflow(workflow_key):
                check_and_warn_selfhost_workflow(workflow_key)
            
            return {
                "image_assets": image_asset_paths,
                "prompt_text": prompt_text,
                "workflow_key": workflow_key
                }

    def _render_output_preview(self, pixelle_video: Any, video_params: dict):
        """Render output preview section"""
        with st.container(border=True):
            st.markdown(f"**{tr('section.video_generation')}**")

            # Check configuration
            if not config_manager.validate():
                st.warning(tr("settings.not_configured"))
            
            image_assets = video_params.get("image_assets", [])
            video_assets = video_params.get("video_assets", [])
            prompt_text = video_params.get("prompt_text", "")
            duration = video_params.get("duration")
            workflow_key = video_params.get("workflow_key")

            logger.info(f"  - video_params: {video_params}")

            if not video_assets:
                st.info(tr("action_transfer.assets.video_warning"))
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="action_transfer_generate_video_disabled"
                )
                return

            if not image_assets:
                st.info(tr("action_transfer.assets.image_warning"))
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="action_transfer_generate_image_disabled"
                )
                return

            if not prompt_text:
                st.info(tr("action_transfer.assets.prompt_warning"))
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="action_transfer_generate"
                )
                return

            # Generate button
            if st.button(tr("btn.generate"), type="primary", use_container_width=True, key="transfer_generate"):
                if not config_manager.validate():
                    st.error(tr("settings.not_configured"))
                    st.stop()
                
                progress_bar = st.progress(0)
                status_text = st.empty()

                start_time = time.time()

                try:
                    async def generate_audio_visual_video():
                        task_dir, task_id = create_task_output_dir()
                        logger.info(f"[Initialization] Task Directory: {task_dir}")
                        
                        import json
                        from pathlib import Path

                        status_text.text(tr("progress.generation"))
                        progress_bar.progress(10)
                        image_path = image_assets[0]
                        video_path = video_assets[0]
                        second = duration
                        prompt = prompt_text
                        final_video_path = os.path.join(task_dir, "final.mp4")

                        if is_api_workflow(workflow_key):
                            media_result = await pixelle_video.media(
                                prompt=prompt,
                                workflow=workflow_key,
                                media_type="video",
                                image_path=image_path,
                                output_path=final_video_path,
                                duration=second,
                            )
                            progress_bar.progress(100)
                            status_text.text(tr("status.success"))
                            return media_result.url

                        kit = await pixelle_video._get_or_create_comfykit()

                        workflow_path = Path("workflows") / workflow_key

                        if not workflow_path.exists():
                            raise Exception(f"The workflow file does not exist: {workflow_path}")

                        with open(workflow_path, 'r', encoding='utf-8') as f:
                            workflow_config = json.load(f)

                        workflow_params = {
                            "video": video_path,
                            "image": image_path,
                            "prompt": prompt,
                            "second": second
                        }

                        if workflow_config.get("source") == "runninghub" and "workflow_id" in workflow_config:
                            workflow_input = workflow_config["workflow_id"]
                        else:
                            workflow_input = str(workflow_path)

                        video_result = await kit.execute(workflow_input, workflow_params)

                        generated_video_url = None
                        if hasattr(video_result, 'videos') and video_result.videos:
                            generated_video_url = video_result.videos[0]
                        elif hasattr(video_result, 'outputs') and video_result.outputs:
                            for node_id, node_output in video_result.outputs.items():
                                if isinstance(node_output, dict) and 'videos' in node_output:
                                    videos = node_output['videos']
                                    if videos and len(videos) > 0:
                                        generated_video_url = videos[0]
                                        break

                        if not generated_video_url:
                            raise Exception("The workflow did not return a video. Please check the workflow configuration.")

                        timeout = httpx.Timeout(300.0)
                        async with httpx.AsyncClient(timeout=timeout) as client:
                            response = await client.get(generated_video_url)
                            response.raise_for_status()
                            with open(final_video_path, 'wb') as f:
                                f.write(response.content)
                        progress_bar.progress(100)
                        status_text.text(tr("status.success"))
                        return final_video_path
                    
                    # Execute async generation
                    final_video_path = run_async(generate_audio_visual_video())

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
                    logger.exception(e)
                    status_text.text("")
                    progress_bar.empty()
                    st.error(tr("status.error", error=str(e)))
                    st.stop()

register_pipeline_ui(ActionTransferPipelineUI)
