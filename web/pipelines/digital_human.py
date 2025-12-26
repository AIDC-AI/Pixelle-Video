import os
import time
import uuid
from pathlib import Path
from typing import Any

import streamlit as st
from loguru import logger
import httpx

from web.i18n import tr, get_language
from web.pipelines.base import PipelineUI, register_pipeline_ui
from web.components.content_input import render_bgm_section, render_version_info
from web.components.digital_tts_config import render_style_config
from web.utils.async_helpers import run_async
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
            # bgm_params = render_bgm_section(key_prefix="asset_")
            render_version_info()
        
        # ====================================================================
        # Middle Column: Video Configuration
        # ====================================================================
        with middle_col:
            # Style configuration (TTS, template, workflow, etc.)
            style_params = render_style_config(pixelle_video)
        
        # # ====================================================================
        # # Right Column: Output Preview
        # # ====================================================================
        with right_col:
            # Combine all parameters
            video_params = {
                **asset_params,
                **style_params
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
    
        with st.container(border=True):
            st.markdown(f"**{tr('digital_human.section.goods_assets')}**")
            
            with st.expander(tr("help.feature_description"), expanded=False):
                st.markdown(f"**{tr('help.what')}**")
                st.markdown(tr("digital_human.assets.goods_what"))
                st.markdown(f"**{tr('help.how')}**")
                st.markdown(tr("digital_human.assets.how"))
            
            # File uploader for multiple files
            uploaded_files = st.file_uploader(
                tr("digital_human.assets.upload"),
                type=["jpg", "jpeg", "png", "webp"],
                accept_multiple_files=True,
                help=tr("digital_human.assets.upload_help"),
                key="goods_files"
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

        # Goods Name or Description
        with st.container(border=True):
            st.markdown(f"**{tr('digital_human.section.goods_info')}**")
            
            goods_title = st.text_input(
                tr("digital_human.goods_title"),
                placeholder=tr("digital_human.goods_title_placeholder"),
                help=tr("digital_human.goods_title_help"),
                key="goods_title"
            )

        return {
            "character_assets": character_asset_paths,
            "goods_title": goods_title,
            "goods_assets": goods_asset_paths
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
            first_workflow = video_params.get("first_workflow")
            second_workflow = video_params.get("second_workflow")
            tts_voice = video_params.get("tts_voice", "zh-CN-YunjianNeural")
            tts_speed = video_params.get("tts_speed", 1.2)
            
            # Debug: 显示获取到的TTS参数
            logger.info(f"🔧 获取到的TTS参数:")
            logger.info(f"  - tts_voice: {tts_voice}")
            logger.info(f"  - tts_speed: {tts_speed}")
            logger.info(f"  - video_params中的tts_voice: {video_params.get('tts_voice', 'NOT_FOUND')}")
            logger.info(f"  - 所有video_params: {video_params}")
            
            # Validation
            if not character_assets or not goods_assets:
                st.info("请上传人物形象图片和商品图片")
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="digital_human_generate_disabled"
                )
                return
            
            if not goods_title:
                st.warning("请输入商品名称")
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="digital_human_generate_disabled_no_title"
                )
                return
            
            # Workflow validation
            if not first_workflow or not second_workflow:
                st.warning("请选择工作流配置")
                st.button(
                    tr("btn.generate"),
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="digital_human_generate_disabled_no_workflow"
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
                        # Create task directory
                        task_dir, task_id = create_task_output_dir()
                        logger.info(f"📁 Task directory created: {task_dir}")
                        
                        # ============================================================
                        # Step 1: Call first workflow (character_image + goods_image + goods_title)
                        # ============================================================
                        status_text.text("步骤 1/3: 调用第一步工作流生成拼图和文案...")
                        progress_bar.progress(10)
                        
                        # Directly load first workflow file
                        import json
                        from pathlib import Path
                        
                        first_workflow_path = Path("workflows/runninghub/digital_image.json")
                        if not first_workflow_path.exists():
                            raise Exception(f"第一步工作流文件不存在: {first_workflow_path}")
                        
                        with open(first_workflow_path, 'r', encoding='utf-8') as f:
                            first_workflow_config = json.load(f)
                        
                        # Build workflow parameters for first workflow
                        # 注意：参数名需要根据你的 workflow 实际参数来调整
                        # 尝试多种可能的参数名
                        first_workflow_params = {
                            # 根据之前的日志尝试的参数名
                            "firstimage": character_assets[0],
                            "secondimage": goods_assets[0],
                            "goodstype": goods_title
                        }
                        
                        logger.info(f"🔧 传递给第一步工作流的参数:")
                        for key, value in first_workflow_params.items():
                            if isinstance(value, str) and len(value) > 100:
                                logger.info(f"  - {key}: {value[:100]}... (文件路径)")
                            else:
                                logger.info(f"  - {key}: {value}")
                        
                        # Execute first workflow
                        kit = await pixelle_video._get_or_create_comfykit()
                        
                        # Use workflow_id for runninghub workflows
                        if first_workflow_config.get("source") == "runninghub" and "workflow_id" in first_workflow_config:
                            workflow_input = first_workflow_config["workflow_id"]
                        else:
                            workflow_input = str(first_workflow_path)
                        
                        logger.info(f"执行第一步工作流: {workflow_input}")
                        first_result = await kit.execute(workflow_input, first_workflow_params)
                        
                        if first_result.status != "completed":
                            raise Exception(f"第一步工作流执行失败: {first_result.msg}")
                        
                        # Debug: Log the actual result structure
                        logger.info(f"🔍 第一步工作流返回结果调试:")
                        logger.info(f"- result type: {type(first_result)}")
                        logger.info(f"- result.__dict__: {first_result.__dict__}")
                        
                        if hasattr(first_result, 'images'):
                            logger.info(f"- images: {first_result.images}")
                        if hasattr(first_result, 'texts'):
                            logger.info(f"- texts: {first_result.texts}")
                        if hasattr(first_result, 'videos'):
                            logger.info(f"- videos: {first_result.videos}")
                        if hasattr(first_result, 'outputs'):
                            logger.info(f"- outputs keys: {list(first_result.outputs.keys()) if first_result.outputs else 'None'}")
                            if first_result.outputs:
                                for node_id, node_output in first_result.outputs.items():
                                    logger.info(f"  - 节点 {node_id}: {node_output}")
                        
                        # 尝试获取所有可能的属性
                        for attr in dir(first_result):
                            if not attr.startswith('_'):
                                try:
                                    value = getattr(first_result, attr)
                                    if not callable(value):
                                        logger.info(f"- {attr}: {value}")
                                except:
                                    pass
                        
                        # Extract results from first workflow
                        generated_image_url = None
                        generated_text = None
                        generated_video_url = None
                        
                        # 检查是否直接返回了视频（一步到位的工作流）
                        if hasattr(first_result, 'videos') and first_result.videos:
                            generated_video_url = first_result.videos[0]
                            logger.info(f"✅ 第一步工作流直接生成了视频: {generated_video_url}")
                            
                            # 如果直接生成了视频，跳过后续步骤
                            progress_bar.progress(100)
                            status_text.text(tr("status.success"))
                            
                            # Download video to local
                            final_video_path = os.path.join(task_dir, "final.mp4")
                            timeout = httpx.Timeout(300.0)  # 简化timeout设置
                            async with httpx.AsyncClient(timeout=timeout) as client:
                                response = await client.get(generated_video_url)
                                response.raise_for_status()
                                with open(final_video_path, 'wb') as f:
                                    f.write(response.content)
                            
                            return final_video_path
                        
                        # 如果没有直接返回视频，尝试提取图片和文本（原来的逻辑）
                        # Extract image - try direct access first
                        if hasattr(first_result, 'images') and first_result.images:
                            generated_image_url = first_result.images[0]
                            logger.info(f"✅ 从 result.images 获取图片: {generated_image_url}")
                        elif hasattr(first_result, 'outputs') and first_result.outputs:
                            # Try to find image in outputs
                            for node_id, node_output in first_result.outputs.items():
                                logger.info(f"- 检查节点 {node_id}: {list(node_output.keys()) if isinstance(node_output, dict) else type(node_output)}")
                                if isinstance(node_output, dict) and 'images' in node_output:
                                    images = node_output['images']
                                    if images and len(images) > 0:
                                        generated_image_url = images[0]
                                        logger.info(f"✅ 从 outputs[{node_id}].images 获取图片: {generated_image_url}")
                                        break
                        
                        # Extract text - try direct access first
                        if hasattr(first_result, 'texts') and first_result.texts:
                            generated_text = first_result.texts[0]
                            logger.info(f"✅ 从 result.texts 获取文本: {generated_text[:50]}...")
                        elif hasattr(first_result, 'outputs') and first_result.outputs:
                            # Try to find text in outputs
                            for node_id, node_output in first_result.outputs.items():
                                if isinstance(node_output, dict) and 'text' in node_output:
                                    text_list = node_output['text']
                                    if text_list and len(text_list) > 0:
                                        generated_text = text_list[0]
                                        logger.info(f"✅ 从 outputs[{node_id}].text 获取文本: {generated_text[:50]}...")
                                        break
                        
                        if not generated_image_url:
                            # 如果没有找到图片，尝试查看是否有其他类型的输出
                            logger.error("❌ 第一步工作流未返回图片，尝试查找其他输出...")
                            if hasattr(first_result, 'outputs') and first_result.outputs:
                                for node_id, node_output in first_result.outputs.items():
                                    logger.info(f"- 节点 {node_id} 输出: {node_output}")
                            
                            # 尝试使用第一个可用的图片输出（如果有的话）
                            if hasattr(first_result, 'outputs') and first_result.outputs:
                                for node_id, node_output in first_result.outputs.items():
                                    if isinstance(node_output, dict):
                                        # 检查所有可能的图片字段
                                        for key in ['images', 'image', 'output_image', 'result_image']:
                                            if key in node_output and node_output[key]:
                                                if isinstance(node_output[key], list) and len(node_output[key]) > 0:
                                                    generated_image_url = node_output[key][0]
                                                    logger.info(f"✅ 从 outputs[{node_id}].{key} 获取图片: {generated_image_url}")
                                                    break
                                                elif isinstance(node_output[key], str):
                                                    generated_image_url = node_output[key]
                                                    logger.info(f"✅ 从 outputs[{node_id}].{key} 获取图片: {generated_image_url}")
                                                    break
                                        if generated_image_url:
                                            break
                            
                            if not generated_image_url:
                                raise Exception("第一步工作流未返回图片，请检查工作流配置")
                        
                        if not generated_text:
                            # 如果没有找到文本，尝试查找其他文本输出
                            logger.warning("⚠️ 第一步工作流未返回文本，尝试查找其他文本输出...")
                            if hasattr(first_result, 'outputs') and first_result.outputs:
                                for node_id, node_output in first_result.outputs.items():
                                    if isinstance(node_output, dict):
                                        # 检查所有可能的文本字段
                                        for key in ['text', 'texts', 'output_text', 'result_text', 'description', 'caption']:
                                            if key in node_output and node_output[key]:
                                                if isinstance(node_output[key], list) and len(node_output[key]) > 0:
                                                    generated_text = node_output[key][0]
                                                    logger.info(f"✅ 从 outputs[{node_id}].{key} 获取文本: {generated_text[:50]}...")
                                                    break
                                                elif isinstance(node_output[key], str):
                                                    generated_text = node_output[key]
                                                    logger.info(f"✅ 从 outputs[{node_id}].{key} 获取文本: {generated_text[:50]}...")
                                                    break
                                        if generated_text:
                                            break
                            
                            # 如果还是没有文本，使用默认文本
                            if not generated_text:
                                generated_text = f"为您推荐这款{goods_title}，品质优良，值得拥有！"
                                logger.warning(f"⚠️ 使用默认文本: {generated_text}")
                        
                        logger.info(f"✅ 第一步完成: 图片={generated_image_url}, 文本={generated_text[:50]}...")
                        
                        # Download generated image to local
                        generated_image_path = os.path.join(task_dir, "generated_image.png")
                        timeout = httpx.Timeout(10.0)  # 简化timeout设置
                        async with httpx.AsyncClient(timeout=timeout) as client:
                            response = await client.get(generated_image_url)
                            response.raise_for_status()
                            with open(generated_image_path, 'wb') as f:
                                f.write(response.content)
                        
                        progress_bar.progress(40)
                        status_text.text("步骤 2/3: 将文案转换为语音...")
                        
                        # ============================================================
                        # Step 2: TTS conversion (text -> audio)
                        # ============================================================
                        audio_path = os.path.join(task_dir, "narration.mp3")
                        await pixelle_video.tts(
                            text=generated_text,
                            output_path=audio_path,
                            inference_mode="local",  # 明确指定推理模式
                            voice=tts_voice,  # 使用voice而不是voice_id
                            speed=tts_speed
                        )
                        
                        logger.info(f"✅ 第二步完成: 语音={audio_path}")
                        progress_bar.progress(70)
                        status_text.text("步骤 3/3: 调用第二步工作流生成最终视频...")
                        
                        # ============================================================
                        # Step 3: Call second workflow (generated_image + audio)
                        # ============================================================
                        # Directly load second workflow file
                        second_workflow_path = Path("workflows/runninghub/digital_combination.json")
                        if not second_workflow_path.exists():
                            raise Exception(f"第二步工作流文件不存在: {second_workflow_path}")
                        
                        with open(second_workflow_path, 'r', encoding='utf-8') as f:
                            second_workflow_config = json.load(f)
                        
                        # Build workflow parameters for second workflow
                        # 注意：参数名需要根据你的 workflow 实际参数来调整
                        # 尝试多种可能的参数名
                        second_workflow_params = {
                            # 尝试常见的参数名
                            "videoimage": generated_image_path,  # 生成的图片路径
                            "audio": audio_path,  # 音频路径
                        }
                        
                        logger.info(f"🔧 传递给第二步工作流的参数:")
                        for key, value in second_workflow_params.items():
                            logger.info(f"  - {key}: {value}")
                        
                        # Execute second workflow
                        if second_workflow_config.get("source") == "runninghub" and "workflow_id" in second_workflow_config:
                            workflow_input = second_workflow_config["workflow_id"]
                        else:
                            workflow_input = str(second_workflow_path)
                        
                        logger.info(f"执行第二步工作流: {workflow_input}")
                        second_result = await kit.execute(workflow_input, second_workflow_params)
                        
                        if second_result.status != "completed":
                            raise Exception(f"第二步工作流执行失败: {second_result.msg}")
                        
                        # Debug: Log the second workflow result structure
                        logger.info(f"🔍 第二步工作流返回结果调试:")
                        logger.info(f"- result type: {type(second_result)}")
                        logger.info(f"- result.__dict__: {second_result.__dict__}")
                        
                        if hasattr(second_result, 'videos'):
                            logger.info(f"- videos: {second_result.videos}")
                        if hasattr(second_result, 'images'):
                            logger.info(f"- images: {second_result.images}")
                        if hasattr(second_result, 'texts'):
                            logger.info(f"- texts: {second_result.texts}")
                        if hasattr(second_result, 'outputs'):
                            logger.info(f"- outputs keys: {list(second_result.outputs.keys()) if second_result.outputs else 'None'}")
                            if second_result.outputs:
                                for node_id, node_output in second_result.outputs.items():
                                    logger.info(f"  - 节点 {node_id}: {node_output}")
                        
                        # 尝试获取所有可能的属性
                        for attr in dir(second_result):
                            if not attr.startswith('_'):
                                try:
                                    value = getattr(second_result, attr)
                                    if not callable(value):
                                        logger.info(f"- {attr}: {value}")
                                except:
                                    pass
                        
                        # Extract video from second workflow result
                        generated_video_url = None
                        
                        if hasattr(second_result, 'videos') and second_result.videos:
                            generated_video_url = second_result.videos[0]
                            logger.info(f"✅ 从 result.videos 获取视频: {generated_video_url}")
                        elif hasattr(second_result, 'outputs') and second_result.outputs:
                            for node_id, node_output in second_result.outputs.items():
                                logger.info(f"- 检查节点 {node_id}: {list(node_output.keys()) if isinstance(node_output, dict) else type(node_output)}")
                                if isinstance(node_output, dict) and 'videos' in node_output:
                                    videos = node_output['videos']
                                    if videos and len(videos) > 0:
                                        generated_video_url = videos[0]
                                        logger.info(f"✅ 从 outputs[{node_id}].videos 获取视频: {generated_video_url}")
                                        break
                        
                        if not generated_video_url:
                            # 如果没有找到视频，尝试查看是否有其他类型的输出
                            logger.error("❌ 第二步工作流未返回视频，尝试查找其他输出...")
                            if hasattr(second_result, 'outputs') and second_result.outputs:
                                for node_id, node_output in second_result.outputs.items():
                                    logger.info(f"- 节点 {node_id} 输出: {node_output}")
                            
                            # 尝试使用第一个可用的视频输出（如果有的话）
                            if hasattr(second_result, 'outputs') and second_result.outputs:
                                for node_id, node_output in second_result.outputs.items():
                                    if isinstance(node_output, dict):
                                        # 检查所有可能的视频字段
                                        for key in ['videos', 'video', 'output_video', 'result_video', 'mp4']:
                                            if key in node_output and node_output[key]:
                                                if isinstance(node_output[key], list) and len(node_output[key]) > 0:
                                                    generated_video_url = node_output[key][0]
                                                    logger.info(f"✅ 从 outputs[{node_id}].{key} 获取视频: {generated_video_url}")
                                                    break
                                                elif isinstance(node_output[key], str):
                                                    generated_video_url = node_output[key]
                                                    logger.info(f"✅ 从 outputs[{node_id}].{key} 获取视频: {generated_video_url}")
                                                    break
                                        if generated_video_url:
                                            break
                            
                            if not generated_video_url:
                                raise Exception("第二步工作流未返回视频，请检查工作流配置")
                        
                        logger.info(f"✅ 第三步完成: 视频={generated_video_url}")
                        
                        # Download video to local
                        final_video_path = os.path.join(task_dir, "final.mp4")
                        timeout = httpx.Timeout(300.0)  # 简化timeout设置
                        async with httpx.AsyncClient(timeout=timeout) as client:
                            response = await client.get(generated_video_url)
                            response.raise_for_status()
                            with open(final_video_path, 'wb') as f:
                                f.write(response.content)
                        
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

