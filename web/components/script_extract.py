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
Script extraction component for web UI

Step 1: 学习对标 - Extract script from reference video URL using LLM.
"""

import streamlit as st
from loguru import logger

from web.i18n import tr
from web.utils.async_helpers import run_async


def render_script_extract() -> dict:
    """
    Render the script extraction UI block (学习对标).
    
    Returns:
        dict with keys: extracted_script, video_url
    """
    with st.container(border=True):
        st.markdown(f"**{tr('script_extract.title')}**")
        
        with st.expander(tr("help.feature_description"), expanded=False):
            st.markdown(f"**{tr('help.what')}**")
            st.markdown(tr("script_extract.what"))
            st.markdown(f"**{tr('help.how')}**")
            st.markdown(tr("script_extract.how"))
        
        video_url = st.text_input(
            tr("script_extract.url_label"),
            placeholder=tr("script_extract.url_placeholder"),
            help=tr("script_extract.url_help"),
            key="script_extract_url",
        )
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            extract_btn = st.button(
                tr("script_extract.extract_btn"),
                use_container_width=True,
                type="primary",
                disabled=not video_url.strip(),
                key="script_extract_btn",
            )
        
        with col2:
            clear_btn = st.button(
                tr("script_extract.clear_btn"),
                use_container_width=True,
                key="script_extract_clear_btn",
            )
        
        if clear_btn:
            st.session_state.pop("extracted_script", None)
            st.session_state.pop("extracted_video_info", None)
            st.rerun()
        
        if extract_btn and video_url.strip():
            _do_extract(video_url.strip())
        
        extracted_script = st.session_state.get("extracted_script", "")
        
        if extracted_script:
            st.markdown(f"**{tr('script_extract.result_label')}**")
            
            video_info = st.session_state.get("extracted_video_info", {})
            if video_info.get("title"):
                duration = video_info.get("duration", 0)
                minutes = duration // 60
                seconds = duration % 60
                info_text = f"📹 {video_info['title']}"
                if duration:
                    info_text += f"  |  ⏱️ {minutes}:{seconds:02d}"
                st.caption(info_text)
            
            edited_script = st.text_area(
                tr("script_extract.script_label"),
                value=extracted_script,
                height=200,
                key="script_extract_result_area",
                label_visibility="collapsed",
            )
            
            st.caption(tr("script_extract.char_count", count=len(edited_script)))
            
            return {
                "extracted_script": edited_script,
                "video_url": video_url,
            }
    
    return {
        "extracted_script": "",
        "video_url": video_url if video_url else "",
    }


def _do_extract(url: str):
    """Run script extraction: download → LLM analysis."""
    from pixelle_video.services.script_extractor import ScriptExtractorService
    
    extractor = ScriptExtractorService()
    
    status = st.status(tr("script_extract.extracting"), expanded=True)
    
    try:
        # Step 1: Get video info
        status.write(tr("script_extract.step_info"))
        try:
            video_info = extractor.get_video_info(url)
            st.session_state["extracted_video_info"] = video_info
            if video_info.get("title"):
                status.write(f"📹 {video_info['title']}")
        except Exception as e:
            logger.warning(f"Could not get video info: {e}")
            st.session_state["extracted_video_info"] = {}
        
        # Step 2: Download video
        status.write(tr("script_extract.step_download"))
        video_path = extractor.download_video(url)
        size_mb = video_path.stat().st_size / (1024 * 1024)
        status.write(f"✅ {size_mb:.1f} MB")
        
        # Step 3: LLM analysis
        status.write(tr("script_extract.step_llm"))
        script = run_async(extractor.extract_script(url=url))
        
        st.session_state["extracted_script"] = script
        status.update(label=tr("script_extract.success"), state="complete")
        st.rerun()
        
    except Exception as e:
        logger.error(f"Script extraction failed: {e}")
        status.update(label=tr("script_extract.error", error=""), state="error")
        st.error(str(e))
