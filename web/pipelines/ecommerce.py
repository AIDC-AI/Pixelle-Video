# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
E-commerce Video Pipeline UI

Implements the UI for generating promotional videos from product URLs.
"""

import os
import time
from pathlib import Path
from typing import Any

import streamlit as st
from loguru import logger

from web.i18n import tr, get_language
from web.pipelines.base import PipelineUI, register_pipeline_ui
from web.components.content_input import render_bgm_section
from web.utils.async_helpers import run_async
from pixelle_video.config import config_manager
from pixelle_video.models.progress import ProgressEvent


class EcommercePipelineUI(PipelineUI):
    """
    UI for the E-commerce Video Generation Pipeline.
    Generates promotional videos from Taobao/Tmall product URLs.
    """
    name = "ecommerce"
    icon = "🛒"
    
    @property
    def display_name(self):
        lang = get_language()
        return "电商视频" if lang == "zh_CN" else "E-commerce Video"
    
    @property
    def description(self):
        lang = get_language()
        if lang == "zh_CN":
            return "输入淘宝/天猫商品链接，自动生成商品宣传视频"
        return "Generate promotional videos from Taobao/Tmall product URLs"
    
    def render(self, pixelle_video: Any):
        # Two-column layout
        left_col, right_col = st.columns([1, 1])
        
        # ====================================================================
        # Left Column: Input Configuration
        # ====================================================================
        with left_col:
            input_params = self._render_input_section()
            tts_params = self._render_tts_section()
            bgm_params = render_bgm_section(key_prefix="ecom_")
        
        # ====================================================================
        # Right Column: Output Preview
        # ====================================================================
        with right_col:
            video_params = {
                "pipeline": self.name,
                **input_params,
                **tts_params,
                **bgm_params
            }
            
            self._render_output_preview(pixelle_video, video_params)
    
    def _render_input_section(self) -> dict:
        """Render product URL and instruction input section"""
        lang = get_language()
        
        with st.container(border=True):
            st.markdown(f"**{'商品信息' if lang == 'zh_CN' else 'Product Info'}**")
            
            # Product URL input
            product_url = st.text_input(
                "商品链接" if lang == "zh_CN" else "Product URL",
                placeholder="https://item.taobao.com/item.htm?id=...",
                help="支持淘宝/天猫商品详情页链接" if lang == "zh_CN" else "Supports Taobao/Tmall product detail page URLs",
                key="ecom_product_url"
            )
            
            # Instruction input
            instruction = st.text_area(
                "视频指令" if lang == "zh_CN" else "Video Instruction",
                placeholder="例如：突出性价比，强调专业品质" if lang == "zh_CN" else "e.g., Highlight value for money, emphasize professional quality",
                help="告诉AI你希望视频重点突出什么" if lang == "zh_CN" else "Tell AI what you want the video to focus on",
                height=100,
                key="ecom_instruction"
            )
            
            # Duration setting
            duration = st.slider(
                "视频时长 (秒)" if lang == "zh_CN" else "Video Duration (seconds)",
                min_value=10,
                max_value=60,
                value=15,
                step=5,
                help="目标视频时长，实际时长可能因内容有所调整" if lang == "zh_CN" else "Target video duration, actual may vary based on content",
                key="ecom_duration"
            )
        
        # ComfyUI source selection
        with st.container(border=True):
            st.markdown(f"**{'运行环境' if lang == 'zh_CN' else 'Execution Environment'}**")
            
            # Check available sources
            comfyui_config = config_manager.get_comfyui_config()
            has_selfhost = bool(comfyui_config.get("comfyui_url"))
            has_runninghub = bool(comfyui_config.get("runninghub_api_key"))
            
            source_options = {
                "selfhost": "🖥️ 本地 ComfyUI" if lang == "zh_CN" else "🖥️ Self-hosted ComfyUI",
                "runninghub": "☁️ RunningHub 云端" if lang == "zh_CN" else "☁️ RunningHub Cloud"
            }
            
            # Default to selfhost
            default_source_index = 0
            
            source = st.radio(
                "选择运行环境" if lang == "zh_CN" else "Select Environment",
                options=list(source_options.keys()),
                format_func=lambda x: source_options[x],
                index=default_source_index,
                horizontal=True,
                key="ecom_source",
                label_visibility="collapsed"
            )
            
            # Show configuration status
            if source == "selfhost":
                if has_selfhost:
                    st.success(f"✅ 已配置: {comfyui_config.get('comfyui_url', '')[:50]}..." if lang == "zh_CN" else f"✅ Configured: {comfyui_config.get('comfyui_url', '')[:50]}...")
                else:
                    st.warning("⚠️ 未配置本地 ComfyUI，请在设置中配置" if lang == "zh_CN" else "⚠️ Self-hosted ComfyUI not configured")
            else:
                if has_runninghub:
                    st.success("✅ RunningHub API 已配置" if lang == "zh_CN" else "✅ RunningHub API configured")
                else:
                    st.warning("⚠️ RunningHub API Key 未配置" if lang == "zh_CN" else "⚠️ RunningHub API Key not configured")
        
        return {
            "product_url": product_url,
            "instruction": instruction,
            "duration": duration,
            "source": source
        }
    
    def _render_tts_section(self) -> dict:
        """Render TTS configuration section"""
        lang = get_language()
        
        with st.container(border=True):
            st.markdown(f"**{'语音配置' if lang == 'zh_CN' else 'Voice Configuration'}**")
            
            # Import voice configuration
            from pixelle_video.tts_voices import EDGE_TTS_VOICES, get_voice_display_name
            
            # Get saved voice from config
            comfyui_config = config_manager.get_comfyui_config()
            tts_config = comfyui_config.get("tts", {})
            local_config = tts_config.get("local", {})
            saved_voice = local_config.get("voice", "zh-CN-YunjianNeural")
            saved_speed = local_config.get("speed", 1.2)
            
            # Build voice options
            voice_options = []
            voice_ids = []
            default_voice_index = 0
            
            for idx, voice_config in enumerate(EDGE_TTS_VOICES):
                voice_id = voice_config["id"]
                display_name = get_voice_display_name(voice_id, tr, lang)
                voice_options.append(display_name)
                voice_ids.append(voice_id)
                
                if voice_id == saved_voice:
                    default_voice_index = idx
            
            # Two-column layout
            voice_col, speed_col = st.columns([1, 1])
            
            with voice_col:
                selected_voice_display = st.selectbox(
                    "语音" if lang == "zh_CN" else "Voice",
                    voice_options,
                    index=default_voice_index,
                    key="ecom_tts_voice"
                )
                selected_voice_index = voice_options.index(selected_voice_display)
                voice_id = voice_ids[selected_voice_index]
            
            with speed_col:
                tts_speed = st.slider(
                    "语速" if lang == "zh_CN" else "Speed",
                    min_value=0.5,
                    max_value=2.0,
                    value=saved_speed,
                    step=0.1,
                    format="%.1fx",
                    key="ecom_tts_speed"
                )
        
        return {
            "voice_id": voice_id,
            "tts_speed": tts_speed
        }
    
    def _render_output_preview(self, pixelle_video: Any, video_params: dict):
        """Render output preview section"""
        lang = get_language()
        
        with st.container(border=True):
            st.markdown(f"**{'视频生成' if lang == 'zh_CN' else 'Video Generation'}**")
            
            # Check configuration
            if not config_manager.validate():
                st.warning(tr("settings.not_configured"))
            
            # Check if URL is provided
            product_url = video_params.get("product_url", "").strip()
            if not product_url:
                st.info("请输入商品链接" if lang == "zh_CN" else "Please enter a product URL")
                st.button(
                    "🎬 生成视频" if lang == "zh_CN" else "🎬 Generate Video",
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="ecom_generate_disabled"
                )
                return
            
            # Validate URL format
            if not ("taobao.com" in product_url or "tmall.com" in product_url):
                st.warning("请输入有效的淘宝/天猫商品链接" if lang == "zh_CN" else "Please enter a valid Taobao/Tmall product URL")
                st.button(
                    "🎬 生成视频" if lang == "zh_CN" else "🎬 Generate Video",
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                    key="ecom_generate_invalid"
                )
                return
            
            # Show ready status
            st.success("✅ 已准备就绪，点击生成视频" if lang == "zh_CN" else "✅ Ready to generate video")
            
            # Generate button
            if st.button(
                "🎬 生成视频" if lang == "zh_CN" else "🎬 Generate Video",
                type="primary",
                use_container_width=True,
                key="ecom_generate"
            ):
                # Validate config
                if not config_manager.validate():
                    st.error(tr("settings.not_configured"))
                    st.stop()
                
                # Check login state
                browser_data = Path.home() / ".pixelle" / "browser_data"
                if not browser_data.exists():
                    st.warning(
                        "⚠️ 首次使用需要登录淘宝。请在终端运行：\n"
                        "`uv run python tests/test_ecommerce_scraper.py --login`"
                        if lang == "zh_CN" else
                        "⚠️ First time use requires Taobao login. Run in terminal:\n"
                        "`uv run python tests/test_ecommerce_scraper.py --login`"
                    )
                    st.stop()
                
                # Show progress
                progress_bar = st.progress(0)
                status_text = st.empty()
                
                start_time = time.time()
                
                try:
                    # Import pipeline
                    from pixelle_video.pipelines.ecommerce import EcommercePipeline
                    
                    # Create pipeline
                    pipeline = EcommercePipeline(pixelle_video)
                    
                    # Progress callback
                    def update_progress(event: ProgressEvent):
                        if event.event_type == "setup":
                            message = "初始化..." if lang == "zh_CN" else "Initializing..."
                        elif event.event_type == "scraping_product":
                            message = "🔍 抓取商品信息..." if lang == "zh_CN" else "🔍 Scraping product info..."
                        elif event.event_type == "analyzing_image":
                            message = f"🔬 分析图片 ({event.frame_current}/{event.frame_total})..." if lang == "zh_CN" else f"🔬 Analyzing image ({event.frame_current}/{event.frame_total})..."
                        elif event.event_type == "generating_script":
                            message = "📝 生成脚本..." if lang == "zh_CN" else "📝 Generating script..."
                        elif event.event_type == "frame_step":
                            message = f"🎬 制作场景 ({event.frame_current}/{event.frame_total})..." if lang == "zh_CN" else f"🎬 Producing scene ({event.frame_current}/{event.frame_total})..."
                        elif event.event_type == "processing_frame":
                            message = f"🖼️ 处理帧 ({event.frame_current}/{event.frame_total})..." if lang == "zh_CN" else f"🖼️ Processing frame ({event.frame_current}/{event.frame_total})..."
                        elif event.event_type == "concatenating":
                            message = "🎞️ 合成视频..." if lang == "zh_CN" else "🎞️ Concatenating video..."
                        elif event.event_type == "completed":
                            message = "✅ 完成!" if lang == "zh_CN" else "✅ Completed!"
                        else:
                            message = f"{event.event_type}..."
                        
                        status_text.text(message)
                        progress_bar.progress(min(int(event.progress * 100), 99))
                    
                    # Execute pipeline
                    ctx = run_async(pipeline(
                        product_url=video_params["product_url"],
                        instruction=video_params.get("instruction", ""),
                        duration=video_params.get("duration", 15),
                        source=video_params.get("source", "selfhost"),
                        bgm_path=video_params.get("bgm_path"),
                        bgm_volume=video_params.get("bgm_volume", 0.2),
                        bgm_mode=video_params.get("bgm_mode", "loop"),
                        voice_id=video_params.get("voice_id", "zh-CN-YunjianNeural"),
                        tts_speed=video_params.get("tts_speed", 1.2),
                        progress_callback=update_progress
                    ))
                    
                    total_time = time.time() - start_time
                    
                    progress_bar.progress(100)
                    status_text.text("✅ 视频生成完成!" if lang == "zh_CN" else "✅ Video generated!")
                    
                    # Display result
                    st.success(
                        f"视频已生成: {ctx.final_video_path}" if lang == "zh_CN"
                        else f"Video generated: {ctx.final_video_path}"
                    )
                    
                    st.markdown("---")
                    
                    # Product info
                    if hasattr(ctx, 'product_info') and ctx.product_info:
                        product = ctx.product_info
                        st.markdown(f"**{product.title[:50]}...**")
                        st.caption(f"💰 ¥{product.price} | 🏪 {product.shop_name}")
                    
                    # Video info
                    if os.path.exists(ctx.final_video_path):
                        file_size_mb = os.path.getsize(ctx.final_video_path) / (1024 * 1024)
                        n_scenes = len(ctx.storyboard.frames) if ctx.storyboard else 0
                        
                        info_text = (
                            f"⏱️ 耗时 {total_time:.1f}s   "
                            f"📦 {file_size_mb:.2f}MB   "
                            f"🎬 {n_scenes}个场景"
                            if lang == "zh_CN" else
                            f"⏱️ Time {total_time:.1f}s   "
                            f"📦 {file_size_mb:.2f}MB   "
                            f"🎬 {n_scenes} scenes"
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
                                label="⬇️ 下载视频" if lang == "zh_CN" else "⬇️ Download Video",
                                data=video_bytes,
                                file_name=video_filename,
                                mime="video/mp4",
                                use_container_width=True
                            )
                    else:
                        st.error(
                            f"视频文件未找到: {ctx.final_video_path}" if lang == "zh_CN"
                            else f"Video file not found: {ctx.final_video_path}"
                        )
                
                except Exception as e:
                    status_text.text("")
                    progress_bar.empty()
                    st.error(f"❌ 生成失败: {str(e)}" if lang == "zh_CN" else f"❌ Generation failed: {str(e)}")
                    logger.exception(e)
                    st.stop()


# Register self
register_pipeline_ui(EcommercePipelineUI)

