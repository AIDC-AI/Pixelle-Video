import os
import time
from pathlib import Path
from typing import Any

import streamlit as st
from loguru import logger
import httpx
from web.i18n import tr, get_language
from web.pipelines.base import PipelineUI, register_pipeline_ui
from web.pipelines.api_workflows import list_api_media_workflows, render_api_video_controls
from web.components.content_input import render_version_info
from web.components.digital_tts_config import render_style_config
from web.utils.async_helpers import run_async
from web.utils.streamlit_helpers import check_and_warn_selfhost_workflow
from pixelle_video.config import config_manager
from pixelle_video.utils.os_util import create_task_output_dir

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
            workflow_path = self.workflow_path_config(pixelle_video)
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

    def workflow_path_config(self, pixelle_video: Any) -> dict:
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

            api_image_workflows = list_api_media_workflows(pixelle_video, "image")
            api_image_options = ["使用原工作流生成图片" if get_language() == "zh_CN" else "Use original image workflow"]
            api_image_options.extend([wf["display_name"] for wf in api_image_workflows])

            selected_api_image = st.selectbox(
                "API 图片生成模型" if get_language() == "zh_CN" else "API image generation model",
                api_image_options,
                index=0,
                help=(
                    "可选：在 digital 模式下用 API 图像模型替代前置商品/人物图片生成，后续数字人视频合成仍使用原工作流。"
                    if get_language() == "zh_CN"
                    else "Optional: replace the first digital-mode image generation step with an API image model. The talking-video synthesis still uses the original workflow."
                ),
                key="digital_human_api_image_workflow",
            )

            workflow_config["api_image_workflow"] = None
            if selected_api_image != api_image_options[0] and api_image_workflows:
                selected_index = api_image_options.index(selected_api_image) - 1
                workflow_config["api_image_workflow"] = api_image_workflows[selected_index]["key"]

            api_video_workflows = list_api_media_workflows(
                pixelle_video,
                "video",
                required_adapter_abilities=["digital_human"],
                verified_only=True,
            )
            api_video_options = ["使用原工作流合成口播视频" if get_language() == "zh_CN" else "Use original talking-video workflow"]
            api_video_options.extend([wf["display_name"] for wf in api_video_workflows])

            selected_api_video = st.selectbox(
                "API 参考生视频模型" if get_language() == "zh_CN" else "API reference-to-video model",
                api_video_options,
                index=0,
                help=(
                    "可选：用 DashScope 参考生视频模型直接生成数字人口播成片，跳过原第二步数字人视频合成 workflow。"
                    if get_language() == "zh_CN"
                    else "Optional: use a DashScope reference-to-video model to generate the talking video directly, bypassing the original second-step talking-video workflow."
                ),
                key="digital_human_api_video_workflow",
            )

            workflow_config["api_video_workflow"] = None
            workflow_config["api_video_params"] = {}
            if selected_api_video != api_video_options[0] and api_video_workflows:
                selected_index = api_video_options.index(selected_api_video) - 1
                selected_workflow = api_video_workflows[selected_index]
                workflow_config["api_video_workflow"] = selected_workflow["key"]
                workflow_config["api_video_params"] = render_api_video_controls(
                    selected_workflow,
                    key_prefix="digital_human",
                    default_duration=5,
                )

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
                        task_dir, task_id = create_task_output_dir()
                        workflow_path = video_params["workflow_path"]
                        api_video_workflow = workflow_path.get("api_video_workflow")
                        api_video_params = dict(workflow_path.get("api_video_params") or {})

                        import json
                        from pathlib import Path

                        async def generate_tts_reference(text: str) -> str:
                            audio_path = os.path.join(task_dir, "narration.mp3")
                            tts_inference_mode = video_params.get("tts_inference_mode", "local")
                            tts_voice = video_params.get("tts_voice")
                            tts_speed = video_params.get("tts_speed")
                            tts_workflow = video_params.get("tts_workflow")
                            ref_audio = video_params.get("ref_audio")

                            tts_kwargs = {
                                "text": text,
                                "output_path": audio_path,
                                "inference_mode": tts_inference_mode,
                            }
                            if tts_inference_mode == "local":
                                tts_kwargs["voice"] = tts_voice
                                tts_kwargs["speed"] = tts_speed
                            elif tts_inference_mode == "comfyui":
                                if tts_workflow:
                                    tts_kwargs["workflow"] = tts_workflow
                                if ref_audio:
                                    tts_kwargs["ref_audio"] = ref_audio

                            await pixelle_video.tts(**tts_kwargs)
                            return audio_path

                        async def generate_api_digital_human(text: str) -> str:
                            status_text.text(tr("progress.step_audio"))
                            progress_bar.progress(25)
                            audio_path = await generate_tts_reference(text)

                            reference_image_paths = [character_assets[0]]
                            if mode == "digital" and goods_assets:
                                reference_image_paths.append(goods_assets[0])

                            subject_prompt = (
                                "参考图1中的人物面对镜头自然口播。"
                                if get_language() == "zh_CN"
                                else "The person in reference image 1 speaks naturally to camera."
                            )
                            if mode == "digital" and goods_assets:
                                subject_prompt += (
                                    "结合参考图2中的商品，生成竖屏商业口播视频。"
                                    if get_language() == "zh_CN"
                                    else "Use the product in reference image 2 and create a vertical product-promotion talking video."
                                )
                            prompt = f"{subject_prompt} 口播文案：{text}"

                            final_video_path = os.path.join(task_dir, "final.mp4")
                            duration = int(api_video_params.pop("duration", 5))
                            media_params = {
                                **api_video_params,
                                "prompt": prompt,
                                "workflow": api_video_workflow,
                                "media_type": "video",
                                "output_path": final_video_path,
                                "duration": duration,
                                "reference_image_paths": reference_image_paths,
                                "reference_audio_path": audio_path,
                                "audio": True,
                                "video_ratio": api_video_params.get("video_ratio", "9:16"),
                            }
                            progress_bar.progress(60)
                            status_text.text(tr("progress.generation"))
                            media_result = await pixelle_video.media(**media_params)
                            progress_bar.progress(100)
                            status_text.text(tr("status.success"))
                            return media_result.url

                        if api_video_workflow:
                            if mode == "customize":
                                generated_text = goods_text
                            elif goods_text and goods_text.strip():
                                generated_text = goods_text
                            else:
                                generated_text = await pixelle_video.llm(
                                    prompt=(
                                        f"请为商品“{goods_title}”写一段适合数字人口播短视频的中文推广文案。"
                                        "要求自然、有吸引力，控制在80字以内，只输出文案正文。"
                                    ),
                                    temperature=0.7,
                                    max_tokens=300,
                                )
                            return await generate_api_digital_human(generated_text)

                        kit = await pixelle_video._get_or_create_comfykit()

                        if mode == "customize":
                            status_text.text(tr("progress.step_audio"))
                            progress_bar.progress(25)
                            generated_image_path = character_assets[0]   
                            generated_text = goods_text                 

                            # TTS
                            audio_path = os.path.join(task_dir, "narration.mp3")
                            tts_inference_mode = video_params.get("tts_inference_mode", "local")
                            tts_voice = video_params.get("tts_voice")
                            tts_speed = video_params.get("tts_speed")
                            tts_workflow = video_params.get("tts_workflow")
                            ref_audio = video_params.get("ref_audio")

                            tts_kwargs = {
                                "text": generated_text,
                                "output_path": audio_path,
                                "inference_mode": tts_inference_mode
                            }
                            if tts_inference_mode == "local":
                                tts_kwargs["voice"] = tts_voice
                                tts_kwargs["speed"] = tts_speed
                            elif tts_inference_mode == "comfyui":
                                if tts_workflow:
                                    tts_kwargs["workflow"] = tts_workflow
                                if ref_audio:
                                    tts_kwargs["ref_audio"] = ref_audio

                            await pixelle_video.tts(**tts_kwargs)
                            progress_bar.progress(65)
                            status_text.text(tr("progress.concatenating"))

                            # Directly call the second workflow
                            second_workflow_path = Path(workflow_path.get("second_workflow_path"))
                            if not second_workflow_path.exists():
                                raise Exception(f"The second step workflow file does not exist:{second_workflow_path}")
                            with open(second_workflow_path, 'r', encoding='utf-8') as f:
                                second_workflow_config = json.load(f)
                            second_workflow_params = {
                                "videoimage": generated_image_path,
                                "audio": audio_path
                            }
                            if second_workflow_config.get("source") == "runninghub" and "workflow_id" in second_workflow_config:
                                workflow_input = second_workflow_config["workflow_id"]
                            else:
                                workflow_input = str(second_workflow_config)
                            second_result = await kit.execute(workflow_input, second_workflow_params)
                            # Video Link Extraction
                            generated_video_url = None
                            if hasattr(second_result, 'videos') and second_result.videos:
                                generated_video_url = second_result.videos[0]
                            elif hasattr(second_result, 'outputs') and second_result.outputs:
                                for node_id, node_output in second_result.outputs.items():
                                    if isinstance(node_output, dict) and 'videos' in node_output:
                                        videos = node_output['videos']
                                        if videos and len(videos) > 0:
                                            generated_video_url = videos[0]
                                            break
                            if not generated_video_url:
                                raise Exception("The second step of the workflow did not return a video. Please check the workflow configuration.")
                                        
                            final_video_path = os.path.join(task_dir, "final.mp4")
                            timeout = httpx.Timeout(300.0)
                            async with httpx.AsyncClient(timeout=timeout) as client:
                                response = await client.get(generated_video_url)
                                response.raise_for_status()
                                with open(final_video_path, 'wb') as f:
                                    f.write(response.content)
                            progress_bar.progress(100)
                            status_text.text(tr("status.success"))
                            return final_video_path
                        
                        else:
                            #Initialization and parameter preparation
                            task_dir, task_id = create_task_output_dir()
                            logger.info(f"[Initialization] Task Directory: {task_dir}")

                            first_workflow_path = Path(workflow_path.get("first_workflow_path"))
                            third_workflow_path = Path(workflow_path.get("third_workflow_path"))
                            second_workflow_path = Path(workflow_path.get("second_workflow_path"))
                            api_image_workflow = workflow_path.get("api_image_workflow")
                            assert first_workflow_path.exists(), "The first_workflow file does not exist."
                            assert third_workflow_path.exists(), "The third_workflow file does not exist."
                            assert second_workflow_path.exists(), "The  second_workflow file does not exist."

                            if goods_text and goods_text.strip():
                                generated_text = goods_text

                                status_text.text(tr("progress.step_image"))
                                if api_image_workflow:
                                    image_prompt = (
                                        f"Create a polished digital-human product promotion image. "
                                        f"Use the first reference image as the person/character, the second reference image as the product, "
                                        f"and make the scene suitable for a short spoken ad. Script: {goods_text}"
                                    )
                                    generated_image_path = os.path.join(task_dir, "generated_digital_image.png")
                                    media_result = await pixelle_video.media(
                                        prompt=image_prompt,
                                        workflow=api_image_workflow,
                                        media_type="image",
                                        image_paths=[character_assets[0], goods_assets[0]],
                                        output_path=generated_image_path,
                                        width=1080,
                                        height=1920,
                                    )
                                    generated_image_url = media_result.url
                                else:
                                    workflow_path = third_workflow_path
                                    workflow_params = {"firstimage": character_assets[0], "secondimage": goods_assets[0]}
                                    kit = await pixelle_video._get_or_create_comfykit()
                                    workflow_config = json.load(open(workflow_path, 'r', encoding='utf8'))
                                    if workflow_config.get("source") == "runninghub" and "workflow_id" in workflow_config:
                                        workflow_input = workflow_config["workflow_id"]
                                    else:
                                        workflow_input = str(workflow_config)
                                    combine_image = await kit.execute(workflow_input, workflow_params)
                                    if combine_image.status != "completed":
                                        raise Exception(f"workflow execution failed: {combine_image.msg}")
                                    generated_image_url = getattr(combine_image, "images", [None])[0]
                                status_text.text(tr("progress.step_audio"))
                                audio_path = os.path.join(task_dir, "narration.mp3")
                                tts_inference_mode = video_params.get("tts_inference_mode", "local")
                                tts_voice = video_params.get("tts_voice")
                                tts_speed = video_params.get("tts_speed")
                                tts_workflow = video_params.get("tts_workflow")
                                ref_audio = video_params.get("ref_audio")

                                tts_kwargs = {
                                    "text": generated_text,
                                    "output_path": audio_path,
                                    "inference_mode": tts_inference_mode
                                }
                                if tts_inference_mode == "local":
                                    tts_kwargs["voice"] = tts_voice
                                    tts_kwargs["speed"] = tts_speed
                                elif tts_inference_mode == "comfyui":
                                    if tts_workflow:
                                        tts_kwargs["workflow"] = tts_workflow
                                    if ref_audio:
                                        tts_kwargs["ref_audio"] = ref_audio

                                await pixelle_video.tts(**tts_kwargs)
                                progress_bar.progress(65)
                                status_text.text(tr("progress.concatenating"))

                                if not second_workflow_path.exists():
                                    raise Exception(f"The second step workflow file does not exist:{second_workflow_path}")
                                with open(second_workflow_path, 'r', encoding='utf-8') as f:
                                    second_workflow_config = json.load(f)
                                second_workflow_params = {
                                    "videoimage": generated_image_url,
                                    "audio": audio_path
                                }
                                if second_workflow_config.get("source") == "runninghub" and "workflow_id" in second_workflow_config:
                                    workflow_input = second_workflow_config["workflow_id"]
                                else:
                                    workflow_input = str(second_workflow_config)
                                second_result = await kit.execute(workflow_input, second_workflow_params)
                                # Video Link Extraction
                                generated_video_url = None
                                if hasattr(second_result, 'videos') and second_result.videos:
                                    generated_video_url = second_result.videos[0]
                                elif hasattr(second_result, 'outputs') and second_result.outputs:
                                    for node_id, node_output in second_result.outputs.items():
                                        if isinstance(node_output, dict) and 'videos' in node_output:
                                            videos = node_output['videos']
                                            if videos and len(videos) > 0:
                                                generated_video_url = videos[0]
                                                break
                                if not generated_video_url:
                                    raise Exception("The second step of the workflow did not return a video. Please check the workflow configuration.")
                                            
                                final_video_path = os.path.join(task_dir, "final.mp4")
                                timeout = httpx.Timeout(300.0)
                                async with httpx.AsyncClient(timeout=timeout) as client:
                                    response = await client.get(generated_video_url)
                                    response.raise_for_status()
                                    with open(final_video_path, 'wb') as f:
                                        f.write(response.content)
                                progress_bar.progress(100)
                                status_text.text(tr("status.success"))
                                return final_video_path
                                
                            else:
                                status_text.text(tr("progress.step_image"))
                                if api_image_workflow:
                                    image_prompt = (
                                        f"Create a polished digital-human product promotion image for '{goods_title}'. "
                                        f"Use the first reference image as the person/character and the second reference image as the product. "
                                        f"Make it vertical, clean, commercial, and suitable for a spoken short video."
                                    )
                                    generated_image_path = os.path.join(task_dir, "generated_digital_image.png")
                                    media_result = await pixelle_video.media(
                                        prompt=image_prompt,
                                        workflow=api_image_workflow,
                                        media_type="image",
                                        image_paths=[character_assets[0], goods_assets[0]],
                                        output_path=generated_image_path,
                                        width=1080,
                                        height=1920,
                                    )
                                    generated_image_url = media_result.url
                                    generated_text = await pixelle_video.llm(
                                        prompt=(
                                            f"请为商品“{goods_title}”写一段适合数字人口播短视频的中文推广文案。"
                                            "要求自然、有吸引力，控制在80字以内，只输出文案正文。"
                                        ),
                                        temperature=0.7,
                                        max_tokens=300,
                                    )
                                else:
                                    workflow_path = first_workflow_path
                                    workflow_params = {"firstimage": character_assets[0], "secondimage": goods_assets[0], "goodstype": goods_title}
                                    kit = await pixelle_video._get_or_create_comfykit()
                                    workflow_config = json.load(open(workflow_path, 'r', encoding='utf8'))
                                    if workflow_config.get("source") == "runninghub" and "workflow_id" in workflow_config:
                                        workflow_input = workflow_config["workflow_id"]
                                    else:
                                        workflow_input = str(workflow_config)
                                    synthesis_result = await kit.execute(workflow_input, workflow_params)
                                    if synthesis_result.status != "completed":
                                        raise Exception(f"workflow execution failed: {synthesis_result.msg}")
                                    generated_image_url = getattr(synthesis_result, "images", [None])[0]
                                    generated_text = getattr(synthesis_result, "texts", [None])[0]
                                
                                status_text.text(tr("progress.step_audio"))
                                audio_path = os.path.join(task_dir, "narration.mp3")
                                tts_inference_mode = video_params.get("tts_inference_mode", "local")
                                tts_voice = video_params.get("tts_voice")
                                tts_speed = video_params.get("tts_speed")
                                tts_workflow = video_params.get("tts_workflow")
                                ref_audio = video_params.get("ref_audio")

                                tts_kwargs = {
                                    "text": generated_text,
                                    "output_path": audio_path,
                                    "inference_mode": tts_inference_mode
                                }
                                if tts_inference_mode == "local":
                                    tts_kwargs["voice"] = tts_voice
                                    tts_kwargs["speed"] = tts_speed
                                elif tts_inference_mode == "comfyui":
                                    if tts_workflow:
                                        tts_kwargs["workflow"] = tts_workflow
                                    if ref_audio:
                                        tts_kwargs["ref_audio"] = ref_audio

                                await pixelle_video.tts(**tts_kwargs)
                                progress_bar.progress(65)
                                status_text.text(tr("progress.concatenating"))

                                if not second_workflow_path.exists():
                                    raise Exception(f"The second step workflow file does not exist:{second_workflow_path}")
                                with open(second_workflow_path, 'r', encoding='utf-8') as f:
                                    second_workflow_config = json.load(f)
                                second_workflow_params = {
                                    "videoimage": generated_image_url,
                                    "audio": audio_path
                                }
                                if second_workflow_config.get("source") == "runninghub" and "workflow_id" in second_workflow_config:
                                    workflow_input = second_workflow_config["workflow_id"]
                                else:
                                    workflow_input = str(second_workflow_config)
                                second_result = await kit.execute(workflow_input, second_workflow_params)
                                # Video Link Extraction
                                generated_video_url = None
                                if hasattr(second_result, 'videos') and second_result.videos:
                                    generated_video_url = second_result.videos[0]
                                elif hasattr(second_result, 'outputs') and second_result.outputs:
                                    for node_id, node_output in second_result.outputs.items():
                                        if isinstance(node_output, dict) and 'videos' in node_output:
                                            videos = node_output['videos']
                                            if videos and len(videos) > 0:
                                                generated_video_url = videos[0]
                                                break
                                if not generated_video_url:
                                    raise Exception("The second step of the workflow did not return a video. Please check the workflow configuration.")
                                            
                                final_video_path = os.path.join(task_dir, "final.mp4")
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
