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
Super Agent Pipeline UI

Full workflow: Reference Study → Rewrite Script → Voice Generation →
Video Generation → One-click Assembly.
"""

import asyncio
import json
import os
import re as _re
import time
from pathlib import Path
from typing import Any

import httpx
import streamlit as st
from loguru import logger

from web.i18n import tr, get_language
from web.pipelines.base import PipelineUI, register_pipeline_ui
from web.components.content_input import render_bgm_section, render_version_info
from web.components.script_extract import render_script_extract
from web.utils.async_helpers import run_async
from pixelle_video.config import config_manager
from pixelle_video.utils.os_util import create_task_output_dir


# ── SRT helper ───────────────────────────────────────────────────────


def _get_audio_duration(audio_path: str) -> float | None:
    """Return duration in seconds via ffprobe, or None on failure."""
    if not audio_path or not os.path.exists(audio_path):
        return None
    try:
        import subprocess as _sp
        r = _sp.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                audio_path,
            ],
            capture_output=True, text=True, timeout=10,
        )
        return float(r.stdout.strip())
    except Exception:
        return None


def _fmt_srt_time(sec: float) -> str:
    h = int(sec) // 3600
    m = (int(sec) % 3600) // 60
    s = int(sec) % 60
    ms = int(round((sec - int(sec)) * 1000))
    if ms >= 1000:
        ms = 999
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _split_line_to_chunks(line: str, max_chars: int = 22) -> list[str]:
    """Split a paragraph into short subtitle chunks at punctuation boundaries."""
    if len(line) <= max_chars:
        return [line]
    # Split at sentence-ending punctuation first
    sentences = _re.split(r'(?<=[。！？!?])', line)
    chunks: list[str] = []
    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        if len(sent) <= max_chars:
            chunks.append(sent)
        else:
            # Further split at clause punctuation
            parts = _re.split(r'(?<=[，；、,;])', sent)
            buf = ""
            for part in parts:
                if len(buf) + len(part) <= max_chars:
                    buf += part
                else:
                    if buf.strip():
                        chunks.append(buf.strip())
                    buf = part
            if buf.strip():
                chunks.append(buf.strip())
    return chunks if chunks else [line]


def _build_srt_from_lines(lines: list[str], audio_path: str = "") -> str:
    """Build SRT: split paragraphs into short chunks, distribute audio time evenly."""
    if not lines:
        return ""
    all_chunks: list[str] = []
    for line in lines:
        all_chunks.extend(_split_line_to_chunks(line))
    if not all_chunks:
        all_chunks = lines
    duration = _get_audio_duration(audio_path) or len(all_chunks) * 3.0
    per_chunk = duration / len(all_chunks)
    parts = []
    for i, chunk in enumerate(all_chunks, 1):
        s = (i - 1) * per_chunk
        e = i * per_chunk
        parts.append(f"{i}\n{_fmt_srt_time(s)} --> {_fmt_srt_time(e)}\n{chunk}")
    return "\n\n".join(parts)


# ── LLM prompt templates for script rewriting ────────────────────────

_REWRITE_TEMPLATES = {
    "default": (
        "请将以下文案进行改写润色，保持原意但让表达更流畅自然、更有感染力，"
        "适合短视频口播。字数控制在{word_limit}字左右。\n\n原文案：\n{script}"
    ),
    "hook": (
        "请将以下文案改写为爆款短视频风格，开头必须用一个强有力的钩子吸引观众停留，"
        "语言口语化、节奏感强。字数控制在{word_limit}字左右。\n\n原文案：\n{script}"
    ),
    "story": (
        "请将以下文案改写为故事型风格，用讲故事的方式娓娓道来，"
        "引起观众共鸣。字数控制在{word_limit}字左右。\n\n原文案：\n{script}"
    ),
    "list": (
        "请将以下文案改写为清单型风格，条理清晰、重点突出，"
        "用数字列表呈现核心要点。字数控制在{word_limit}字左右。\n\n原文案：\n{script}"
    ),
}

_LEGAL_PROMPT = (
    "你是一名专业的内容合规审核员。请审核以下短视频文案是否存在以下法律风险：\n"
    "1. 虚假宣传或夸大功效\n2. 侵犯知识产权\n3. 涉及敏感政治内容\n"
    "4. 违反广告法（如使用绝对化用语）\n5. 其他潜在法律风险\n\n"
    "请给出审核结论和修改建议。\n\n文案内容：\n{script}"
)

_IP_PROMPT = (
    "你是一名专业的 IP 内容创作者。根据以下 IP 人设描述，"
    "创作一段适合短视频口播的文案，风格必须贴合人设特点。\n\n"
    "IP 人设：\n{persona}"
)

_MARKETING_PROMPT = (
    "你是一名顶级短视频营销文案策划师。根据以下产品/品牌信息，"
    "创作一段有吸引力、有转化力的短视频营销文案。\n\n"
    "产品信息：\n{product_info}"
)


class SuperAgentPipelineUI(PipelineUI):
    """
    Super Agent Pipeline UI.

    Full 5-step workflow matching the reference screenshot layout.
    """
    name = "super_agent"
    icon = "🧠"

    @property
    def display_name(self):
        return tr("pipeline.super_agent.name")

    @property
    def description(self):
        return tr("pipeline.super_agent.description")

    def render(self, pixelle_video: Any):
        left_col, middle_col, right_col = st.columns([1, 1, 1])

        with left_col:
            self._render_step1_reference(pixelle_video)
            self._render_step2_rewrite(pixelle_video)

        with middle_col:
            self._render_step3_voice(pixelle_video)
            self._render_step4_video(pixelle_video)

        with right_col:
            self._render_step5_assembly(pixelle_video)
            self._render_step6_cover(pixelle_video)
            self._render_step7_publish(pixelle_video)

    # ══════════════════════════════════════════════════════════════════
    # Step 1: 学习对标
    # ══════════════════════════════════════════════════════════════════
    def _render_step1_reference(self, pixelle_video: Any):
        with st.container(border=True):
            st.markdown(f"**{tr('super_agent.step1.title')}**")

            tab_extract, tab_ip, tab_marketing = st.tabs([
                tr("super_agent.step1.tab_extract"),
                tr("super_agent.step1.tab_ip"),
                tr("super_agent.step1.tab_marketing"),
            ])

            with tab_extract:
                script_params = render_script_extract(key_prefix="sa_")
                if script_params.get("extracted_script"):
                    st.session_state["sa_original_script"] = script_params["extracted_script"]

            with tab_ip:
                ip_text = st.text_area(
                    "IP",
                    placeholder=tr("super_agent.step1.ip_placeholder"),
                    height=120,
                    help=tr("super_agent.step1.ip_help"),
                    key="sa_ip_input",
                    label_visibility="collapsed",
                )
                if st.button(
                    tr("super_agent.step1.generate_btn"),
                    key="sa_ip_generate",
                    width="stretch",
                    disabled=not ip_text.strip(),
                ):
                    self._call_llm(
                        pixelle_video,
                        _IP_PROMPT.format(persona=ip_text.strip()),
                        target_key="sa_original_script",
                    )

            with tab_marketing:
                marketing_text = st.text_area(
                    "Marketing",
                    placeholder=tr("super_agent.step1.marketing_placeholder"),
                    height=120,
                    help=tr("super_agent.step1.marketing_help"),
                    key="sa_marketing_input",
                    label_visibility="collapsed",
                )
                if st.button(
                    tr("super_agent.step1.generate_btn"),
                    key="sa_marketing_generate",
                    width="stretch",
                    disabled=not marketing_text.strip(),
                ):
                    self._call_llm(
                        pixelle_video,
                        _MARKETING_PROMPT.format(product_info=marketing_text.strip()),
                        target_key="sa_original_script",
                    )

            st.markdown(f"**{tr('super_agent.step1.original_script')}**")
            st.text_area(
                "script_display",
                placeholder=tr("script_extract.url_placeholder"),
                height=150,
                key="sa_original_script",
                label_visibility="collapsed",
            )

    # ══════════════════════════════════════════════════════════════════
    # Step 2: 改写文案
    # ══════════════════════════════════════════════════════════════════
    def _render_step2_rewrite(self, pixelle_video: Any):
        with st.container(border=True):
            st.markdown(f"**{tr('super_agent.step2.title')}**")

            template_options = {
                "default": tr("super_agent.step2.template_default"),
                "hook": tr("super_agent.step2.template_hook"),
                "story": tr("super_agent.step2.template_story"),
                "list": tr("super_agent.step2.template_list"),
            }

            t_col, w_col = st.columns(2)
            with t_col:
                template_key = st.selectbox(
                    tr("super_agent.step2.template_label"),
                    options=list(template_options.keys()),
                    format_func=lambda x: template_options[x],
                    key="sa_rewrite_template",
                )
            with w_col:
                word_limit = st.selectbox(
                    tr("super_agent.step2.word_limit_label"),
                    options=[100, 200, 300, 500, 800],
                    index=2,
                    format_func=lambda x: f"{x}字",
                    key="sa_word_limit",
                )

            btn_col1, btn_col2 = st.columns(2)
            with btn_col1:
                rewrite_clicked = st.button(
                    tr("super_agent.step2.rewrite_btn"),
                    width="stretch",
                    type="primary",
                    key="sa_rewrite_btn",
                )
            with btn_col2:
                legal_clicked = st.button(
                    tr("super_agent.step2.legal_btn"),
                    width="stretch",
                    key="sa_legal_btn",
                )

            if rewrite_clicked:
                original = st.session_state.get("sa_original_script", "")
                if not original.strip():
                    st.warning(tr("super_agent.step2.no_script"))
                else:
                    prompt = _REWRITE_TEMPLATES[template_key].format(
                        word_limit=word_limit, script=original
                    )
                    self._call_llm(pixelle_video, prompt, target_key="sa_rewritten_script")

            if legal_clicked:
                text_to_check = st.session_state.get(
                    "sa_rewritten_script",
                    st.session_state.get("sa_original_script", ""),
                )
                if not text_to_check.strip():
                    st.warning(tr("super_agent.step2.no_script"))
                else:
                    with st.spinner(tr("super_agent.step2.legal_checking")):
                        try:
                            result = run_async(
                                pixelle_video.llm(
                                    _LEGAL_PROMPT.format(script=text_to_check)
                                )
                            )
                            st.session_state["sa_legal_result"] = result
                        except Exception as e:
                            st.error(tr("super_agent.step2.legal_error", error=str(e)))

            st.markdown(f"**{tr('super_agent.step2.rewrite_result')}**")
            if "_pending_sa_rewritten_script" in st.session_state:
                st.session_state["sa_rewritten_script"] = st.session_state.pop("_pending_sa_rewritten_script")
            st.text_area(
                "rewrite_display",
                placeholder=tr("super_agent.step2.rewrite_placeholder"),
                height=150,
                key="sa_rewritten_script",
                label_visibility="collapsed",
            )

            legal_result = st.session_state.get("sa_legal_result")
            if legal_result:
                with st.expander(tr("super_agent.step2.legal_result"), expanded=False):
                    st.markdown(legal_result)

    # ══════════════════════════════════════════════════════════════════
    # Step 3: 声音生成
    # ══════════════════════════════════════════════════════════════════
    def _render_step3_voice(self, pixelle_video: Any):
        with st.container(border=True):
            st.markdown(f"**{tr('super_agent.step3.title')}**")

            from pixelle_video.tts_voices import EDGE_TTS_VOICES, get_voice_display_name

            comfyui_config = config_manager.get_comfyui_config()
            tts_config = comfyui_config["tts"]
            local_config = tts_config.get("local", {})
            saved_voice = local_config.get("voice", "zh-CN-YunjianNeural")
            saved_speed = local_config.get("speed", 1.2)

            voice_options = []
            voice_ids = []
            default_voice_index = 0
            for idx, vc in enumerate(EDGE_TTS_VOICES):
                vid = vc["id"]
                voice_options.append(get_voice_display_name(vid, tr, get_language()))
                voice_ids.append(vid)
                if vid == saved_voice:
                    default_voice_index = idx

            selected_display = st.selectbox(
                tr("super_agent.step3.voice_label"),
                voice_options,
                index=default_voice_index,
                key="sa_voice_select",
            )
            selected_voice = voice_ids[voice_options.index(selected_display)]

            speed_col, emotion_col = st.columns(2)
            with speed_col:
                tts_speed = st.slider(
                    tr("super_agent.step3.speed_label"),
                    min_value=0.5, max_value=2.0,
                    value=saved_speed, step=0.1,
                    format="%.1f",
                    key="sa_tts_speed",
                )
            with emotion_col:
                emotion_options = {
                    "normal": tr("super_agent.step3.emotion_normal"),
                    "happy": tr("super_agent.step3.emotion_happy"),
                    "sad": tr("super_agent.step3.emotion_sad"),
                    "angry": tr("super_agent.step3.emotion_angry"),
                    "gentle": tr("super_agent.step3.emotion_gentle"),
                }
                st.selectbox(
                    tr("super_agent.step3.emotion_label"),
                    options=list(emotion_options.keys()),
                    format_func=lambda x: emotion_options[x],
                    key="sa_emotion",
                )

            ref_audio_file = st.file_uploader(
                tr("super_agent.step3.upload_ref"),
                type=["mp3", "wav", "flac", "m4a", "aac", "ogg"],
                help=tr("super_agent.step3.upload_ref_help"),
                key="sa_ref_audio",
            )
            ref_audio_path = None
            if ref_audio_file is not None:
                st.audio(ref_audio_file)
                temp_dir = Path("temp")
                temp_dir.mkdir(exist_ok=True)
                ref_audio_path = temp_dir / f"sa_ref_{ref_audio_file.name}"
                with open(ref_audio_path, "wb") as f:
                    f.write(ref_audio_file.getbuffer())

            if st.button(
                tr("super_agent.step3.generate_btn"),
                type="primary",
                width="stretch",
                key="sa_tts_generate",
            ):
                script_text = st.session_state.get(
                    "sa_rewritten_script",
                    st.session_state.get("sa_original_script", ""),
                )
                if not script_text.strip():
                    st.warning(tr("super_agent.step3.no_text"))
                else:
                    with st.spinner(tr("super_agent.step3.generating")):
                        try:
                            task_dir, _ = create_task_output_dir()
                            audio_output = os.path.join(task_dir, "narration.mp3")

                            tts_kwargs = {
                                "text": script_text,
                                "output_path": audio_output,
                                "inference_mode": "local",
                                "voice": selected_voice,
                                "speed": tts_speed,
                            }
                            if ref_audio_path:
                                tts_kwargs["inference_mode"] = "comfyui"
                                tts_kwargs["workflow"] = "runninghub/tts_index2.json"
                                tts_kwargs["ref_audio"] = str(ref_audio_path)
                                tts_kwargs.pop("voice", None)
                                tts_kwargs.pop("speed", None)

                            result_path = run_async(pixelle_video.tts(**tts_kwargs))
                            st.session_state["sa_audio_path"] = result_path or audio_output
                            st.session_state["sa_task_dir"] = task_dir
                            st.success(tr("super_agent.step3.success"))
                            st.rerun()
                        except Exception as e:
                            st.error(tr("super_agent.step3.error", error=str(e)))
                            logger.exception(e)

            st.markdown(f"**{tr('super_agent.step3.clone_result')}**")
            audio_path = st.session_state.get("sa_audio_path")
            if audio_path and os.path.exists(str(audio_path)):
                st.audio(str(audio_path))
            else:
                st.caption(tr("super_agent.step3.clone_placeholder"))

            vol_col1, vol_col2 = st.columns(2)
            with vol_col1:
                st.slider(
                    tr("super_agent.step3.voice_volume"),
                    min_value=0.0, max_value=1.0, value=1.0, step=0.1,
                    key="sa_voice_volume",
                )
            with vol_col2:
                st.slider(
                    tr("super_agent.step3.bgm_volume"),
                    min_value=0.0, max_value=1.0, value=0.3, step=0.1,
                    key="sa_bgm_volume",
                )

    # ══════════════════════════════════════════════════════════════════
    # Step 4: 视频生成
    # ══════════════════════════════════════════════════════════════════
    def _render_step4_video(self, pixelle_video: Any):
        with st.container(border=True):
            st.markdown(f"**{tr('super_agent.step4.title')}**")

            char_col, upload_col = st.columns([3, 1])
            with char_col:
                character_options = {
                    "young_male": tr("super_agent.step4.character_young_male"),
                    "young_female": tr("super_agent.step4.character_young_female"),
                    "middle_male": tr("super_agent.step4.character_middle_male"),
                    "middle_female": tr("super_agent.step4.character_middle_female"),
                    "custom": tr("super_agent.step4.character_custom"),
                }
                character_key = st.selectbox(
                    tr("super_agent.step4.character_label"),
                    options=list(character_options.keys()),
                    format_func=lambda x: character_options[x],
                    key="sa_character_select",
                )
            with upload_col:
                st.markdown("<br>", unsafe_allow_html=True)
                uploaded_char = st.file_uploader(
                    tr("super_agent.step4.upload_character"),
                    type=["jpg", "jpeg", "png", "webp"],
                    key="sa_char_upload",
                    label_visibility="collapsed",
                )

            custom_char_path = None
            if uploaded_char:
                import uuid
                temp_dir = Path(f"temp/sa_char_{uuid.uuid4().hex[:8]}")
                temp_dir.mkdir(parents=True, exist_ok=True)
                custom_char_path = str(temp_dir / uploaded_char.name)
                with open(custom_char_path, "wb") as f:
                    f.write(uploaded_char.getbuffer())
                st.image(uploaded_char, width=120)

            audio_col, model_col = st.columns(2)
            with audio_col:
                driving_options = {
                    "auto": tr("super_agent.step4.driving_auto"),
                }
                st.selectbox(
                    tr("super_agent.step4.driving_audio"),
                    options=list(driving_options.keys()),
                    format_func=lambda x: driving_options[x],
                    key="sa_driving_audio",
                )
            with model_col:
                model_options = {
                    "v1": tr("super_agent.step4.model_v1"),
                    "v2": tr("super_agent.step4.model_v2"),
                }
                st.selectbox(
                    tr("super_agent.step4.model_version"),
                    options=list(model_options.keys()),
                    format_func=lambda x: model_options[x],
                    index=1,
                    key="sa_model_version",
                )

            if st.button(
                tr("super_agent.step4.generate_btn"),
                type="primary",
                width="stretch",
                key="sa_video_generate",
            ):
                audio_path = st.session_state.get("sa_audio_path")
                if not audio_path or not os.path.exists(str(audio_path)):
                    st.warning(tr("super_agent.step4.no_audio"))
                else:
                    self._do_generate_video(
                        pixelle_video,
                        audio_path=str(audio_path),
                        character_key=character_key,
                        custom_char_path=custom_char_path,
                        model_version=st.session_state.get("sa_model_version", "v2"),
                    )

            st.markdown(f"**{tr('super_agent.step4.video_result')}**")
            video_path = st.session_state.get("sa_video_path")
            if video_path and os.path.exists(str(video_path)):
                st.video(str(video_path))
            else:
                st.caption(tr("super_agent.step4.preview_placeholder"))

    # ══════════════════════════════════════════════════════════════════
    # Step 5: 一键成片
    # ══════════════════════════════════════════════════════════════════
    def _render_step5_assembly(self, pixelle_video: Any):
        with st.container(border=True):
            st.markdown(f"**{tr('super_agent.step5.title')}**")

            auto_video = st.session_state.get("sa_video_path", "")
            manual_video_path = st.session_state.get("sa_manual_video_path", "")

            src_col, preview_col = st.columns([1, 1])
            with src_col:
                st.markdown(f"**{tr('super_agent.step5.video_source')}**")
                if manual_video_path and os.path.exists(str(manual_video_path)):
                    display_text = os.path.basename(str(manual_video_path))
                elif auto_video and os.path.exists(str(auto_video)):
                    display_text = tr("super_agent.step5.video_source_auto")
                else:
                    display_text = tr("super_agent.step5.video_source_auto")
                st.session_state["sa_video_source_display"] = display_text
                st.text_input(
                    "video_source_display",
                    disabled=True,
                    key="sa_video_source_display",
                    label_visibility="collapsed",
                )
                uploaded_video = st.file_uploader(
                    tr("super_agent.step5.upload_video"),
                    type=["mp4", "mov", "avi", "mkv", "webm"],
                    key="sa_manual_video_upload",
                )

                if uploaded_video is not None:
                    task_dir = st.session_state.get("sa_task_dir", "temp")
                    Path(task_dir).mkdir(parents=True, exist_ok=True)
                    manual_path = os.path.join(task_dir, f"manual_{uploaded_video.name}")
                    with open(manual_path, "wb") as f:
                        f.write(uploaded_video.getbuffer())
                    st.session_state["sa_manual_video_path"] = manual_path

            with preview_col:
                st.markdown(f"**{tr('super_agent.step5.video_preview')}**")
                final_path = st.session_state.get("sa_final_video")
                preview_video = final_path
                if not preview_video or not os.path.exists(str(preview_video)):
                    preview_video = st.session_state.get("sa_manual_video_path")
                if not preview_video or not os.path.exists(str(preview_video)):
                    preview_video = st.session_state.get("sa_video_path")
                if preview_video and os.path.exists(str(preview_video)):
                    st.video(str(preview_video))
                else:
                    st.caption(tr("super_agent.step5.preview_placeholder"))

            st.markdown(f"**{tr('super_agent.step5.subtitle_settings')}**")
            sub_col1, sub_col2, sub_col3 = st.columns([1, 2, 1])
            with sub_col1:
                subtitle_enabled = st.toggle(
                    tr("super_agent.step5.subtitle_enable"),
                    value=True,
                    key="sa_subtitle_toggle",
                )
            with sub_col2:
                if subtitle_enabled:
                    st.button(
                        "A " + tr("super_agent.step5.subtitle_config"),
                        key="sa_subtitle_config",
                        width="stretch",
                    )
            with sub_col3:
                if subtitle_enabled:
                    st.button(
                        tr("super_agent.step5.subtitle_align"),
                        key="sa_subtitle_align",
                        width="stretch",
                    )

            if subtitle_enabled:
                st.checkbox(
                    tr("super_agent.step5.subtitle_no_template"),
                    value=True,
                    key="sa_subtitle_no_tpl",
                )

            tab_clip, tab_material, tab_bgm = st.tabs([
                tr("super_agent.step5.tab_clip"),
                tr("super_agent.step5.tab_material"),
                tr("super_agent.step5.tab_bgm"),
            ])

            with tab_clip:
                clip_col1, clip_col2 = st.columns(2)
                with clip_col1:
                    st.selectbox(
                        tr("super_agent.step5.tab_clip"),
                        [tr("super_agent.step5.clip_layout")],
                        key="sa_clip_layout",
                        label_visibility="collapsed",
                    )
                with clip_col2:
                    st.button(
                        tr("super_agent.step5.clip_select_bg"),
                        key="sa_clip_bg",
                        width="stretch",
                    )

            with tab_material:
                st.file_uploader(
                    tr("super_agent.step5.tab_material"),
                    type=["jpg", "jpeg", "png", "webp", "mp4", "mov"],
                    accept_multiple_files=True,
                    key="sa_extra_materials",
                    label_visibility="collapsed",
                )

            with tab_bgm:
                bgm_col1, bgm_col2 = st.columns([3, 1])
                with bgm_col1:
                    bgm_params = render_bgm_section(key_prefix="sa_")
                with bgm_col2:
                    st.markdown("<br>", unsafe_allow_html=True)
                    st.button(
                        tr("super_agent.step5.ai_bgm"),
                        key="sa_ai_bgm",
                        width="stretch",
                    )

            vol_col1, vol_col2 = st.columns(2)
            with vol_col1:
                st.slider(
                    tr("super_agent.step3.voice_volume"),
                    min_value=0.0, max_value=1.0, value=1.0, step=0.1,
                    key="sa_assemble_voice_vol",
                )
            with vol_col2:
                st.slider(
                    tr("super_agent.step3.bgm_volume"),
                    min_value=0.0, max_value=1.0, value=0.3, step=0.1,
                    key="sa_assemble_bgm_vol",
                )

            st.toggle(
                tr("super_agent.step5.breath_enable"),
                value=False,
                key="sa_breath_removal",
            )

            # ── Subtitle editor ──
            if subtitle_enabled:
                with st.expander(tr("super_agent.step5.edit_subtitle"), expanded=False):
                    if "sa_srt_content" not in st.session_state:
                        script_text = st.session_state.get(
                            "sa_rewritten_script",
                            st.session_state.get("sa_original_script", ""),
                        )
                        if script_text.strip():
                            lines = [ln.strip() for ln in script_text.strip().splitlines() if ln.strip()]
                            st.session_state["sa_srt_content"] = _build_srt_from_lines(
                                lines,
                                audio_path=st.session_state.get("sa_audio_path", ""),
                            )

                    if st.button(
                        tr("super_agent.step5.generate_srt"),
                        key="sa_gen_srt_btn",
                        width="stretch",
                    ):
                        self._generate_srt_from_video(pixelle_video)

                    st.text_area(
                        tr("super_agent.step5.srt_editor_label"),
                        height=200,
                        key="sa_srt_content",
                        placeholder=tr("super_agent.step5.srt_placeholder"),
                    )

            assemble_clicked = st.button(
                tr("super_agent.step5.start_btn"),
                type="primary",
                width="stretch",
                key="sa_assemble_btn",
            )

            if assemble_clicked:
                video_path = (
                    st.session_state.get("sa_manual_video_path")
                    or st.session_state.get("sa_video_path")
                )
                if not video_path or not os.path.exists(str(video_path)):
                    st.warning(tr("super_agent.step5.no_video"))
                else:
                    srt_text = st.session_state.get("sa_srt_content", "") if subtitle_enabled else ""
                    self._do_assemble(
                        pixelle_video,
                        video_path=str(video_path),
                        bgm_params=bgm_params,
                        subtitle_enabled=subtitle_enabled,
                        srt_content=srt_text,
                    )

            if final_path and os.path.exists(str(final_path)):
                with open(str(final_path), "rb") as vf:
                    st.download_button(
                        label=tr("super_agent.step5.download_btn"),
                        data=vf.read(),
                        file_name=os.path.basename(str(final_path)),
                        mime="video/mp4",
                        width="stretch",
                    )

    # ══════════════════════════════════════════════════════════════════
    # Step 6: 标题封面
    # ══════════════════════════════════════════════════════════════════
    def _render_step6_cover(self, pixelle_video: Any):
        with st.container(border=True):
            st.markdown(f"**{tr('super_agent.step6.title')}**")

            st.markdown(f"**{tr('super_agent.step6.video_title_label')}**")
            if "_pending_sa_video_title" in st.session_state:
                st.session_state["sa_video_title"] = st.session_state.pop("_pending_sa_video_title")
            title_col, gen_col = st.columns([3, 1])
            with title_col:
                st.text_input(
                    "title_input",
                    placeholder=tr("super_agent.step6.title_placeholder"),
                    key="sa_video_title",
                    label_visibility="collapsed",
                )
            with gen_col:
                if st.button(
                    tr("super_agent.step6.auto_generate"),
                    key="sa_title_generate",
                    width="stretch",
                ):
                    script = st.session_state.get(
                        "sa_rewritten_script",
                        st.session_state.get("sa_original_script", ""),
                    )
                    if script.strip():
                        self._call_llm(
                            pixelle_video,
                            f"根据以下短视频文案，生成一个吸引人的标题（不超过30字，不带引号）：\n\n{script}",
                            target_key="sa_video_title",
                        )
                    else:
                        st.warning(tr("super_agent.step2.no_script"))

            st.markdown(f"**{tr('super_agent.step6.cover_label')}**")
            cover_upload = st.file_uploader(
                tr("super_agent.step6.cover_upload"),
                type=["jpg", "jpeg", "png", "webp"],
                key="sa_cover_upload",
                label_visibility="collapsed",
            )

            cover_path = st.session_state.get("sa_cover_path")
            if cover_upload:
                task_dir = st.session_state.get("sa_task_dir", "temp")
                Path(task_dir).mkdir(parents=True, exist_ok=True)
                cover_path = os.path.join(task_dir, f"cover_{cover_upload.name}")
                with open(cover_path, "wb") as f:
                    f.write(cover_upload.getbuffer())
                st.session_state["sa_cover_path"] = cover_path

            if st.button(
                tr("super_agent.step6.extract_cover"),
                key="sa_extract_cover",
                width="stretch",
            ):
                final_video = st.session_state.get(
                    "sa_final_video", st.session_state.get("sa_video_path")
                )
                if final_video and os.path.exists(str(final_video)):
                    try:
                        import subprocess
                        task_dir = st.session_state.get("sa_task_dir", "temp")
                        Path(task_dir).mkdir(parents=True, exist_ok=True)
                        cover_out = os.path.join(task_dir, "cover_frame.jpg")
                        subprocess.run(
                            ["ffmpeg", "-i", str(final_video), "-ss", "00:00:01",
                             "-vframes", "1", "-y", cover_out],
                            capture_output=True, timeout=30,
                        )
                        if os.path.exists(cover_out):
                            st.session_state["sa_cover_path"] = cover_out
                            cover_path = cover_out
                            st.rerun()
                    except Exception as e:
                        st.error(str(e))
                else:
                    st.warning(tr("super_agent.step5.no_video"))

            if cover_path and os.path.exists(str(cover_path)):
                st.image(str(cover_path), width=200)

    # ══════════════════════════════════════════════════════════════════
    # Step 7: 视频发布
    # ══════════════════════════════════════════════════════════════════
    def _render_step7_publish(self, pixelle_video: Any):
        with st.container(border=True):
            st.markdown(f"**{tr('super_agent.step7.title')}**")

            # ── 视频文件 ──
            video_display = (
                st.session_state.get("sa_final_video", "")
                or st.session_state.get("sa_video_path", "")
            )
            st.session_state["sa_publish_video_display"] = (
                str(video_display) if video_display else ""
            )
            st.text_input(
                tr("super_agent.step7.video_address"),
                disabled=True,
                key="sa_publish_video_display",
            )

            # ── 浏览器连接 ──
            from pixelle_video.services.publisher import PublisherService

            default_addr = (
                "127.0.0.1:9222"
                if st.session_state.get("sa_driver_type", "chrome") == "chrome"
                else "127.0.0.1:2828"
            )
            st.session_state.setdefault("sa_debugger_address", default_addr)
            addr = st.session_state.get("sa_debugger_address", default_addr)
            host, port = PublisherService.parse_address(addr)
            port_open = PublisherService.is_debug_port_open(host, port)

            if port_open:
                st.success(tr("super_agent.step7.chrome_connected", address=addr))
            else:
                st.warning(tr("super_agent.step7.chrome_not_connected", address=addr))
                if st.button(
                    tr("super_agent.step7.launch_chrome"),
                    key="sa_launch_chrome_btn",
                ):
                    self._do_launch_chrome()

            with st.expander(tr("super_agent.step7.driver_config"), expanded=False):
                st.selectbox(
                    tr("super_agent.step7.driver_type"),
                    options=["chrome", "firefox"],
                    key="sa_driver_type",
                )
                drv_c1, drv_c2 = st.columns(2)
                with drv_c1:
                    st.text_input(
                        tr("super_agent.step7.driver_path"),
                        placeholder=tr("super_agent.step7.driver_path_placeholder"),
                        key="sa_driver_path",
                    )
                with drv_c2:
                    st.text_input(
                        tr("super_agent.step7.debugger_address"),
                        key="sa_debugger_address",
                    )

            # ── 发布总控 ──
            st.checkbox(
                tr("super_agent.step7.auto_publish"),
                key="sa_auto_publish",
            )
            st.checkbox(
                tr("super_agent.step7.use_common_config"),
                value=True,
                key="sa_use_common_config",
            )

            use_common = st.session_state.get("sa_use_common_config", True)

            if use_common:
                c1, c2, c3 = st.columns(3)
                with c1:
                    st.text_input(
                        tr("super_agent.step7.title_prefix"),
                        key="sa_pub_common_title_prefix",
                    )
                with c2:
                    st.text_input(
                        tr("super_agent.step7.collection"),
                        key="sa_pub_common_collection",
                    )
                with c3:
                    st.text_input(
                        tr("super_agent.step7.tags"),
                        placeholder=tr("super_agent.step7.tags_placeholder"),
                        key="sa_pub_common_tags",
                    )

            # ── 抖音 ──
            st.checkbox(
                tr("super_agent.step7.enable_douyin"),
                value=True,
                key="sa_pub_enable_douyin",
            )
            if not use_common and st.session_state.get("sa_pub_enable_douyin"):
                c1, c2, c3 = st.columns(3)
                with c1:
                    st.text_input(tr("super_agent.step7.title_prefix"), key="sa_pub_douyin_title_prefix")
                with c2:
                    st.text_input(tr("super_agent.step7.collection"), key="sa_pub_douyin_collection")
                with c3:
                    st.text_input(tr("super_agent.step7.tags"), key="sa_pub_douyin_tags")

            # ── 快手 ──
            st.checkbox(
                tr("super_agent.step7.enable_kuaishou"),
                value=True,
                key="sa_pub_enable_kuaishou",
            )
            if not use_common and st.session_state.get("sa_pub_enable_kuaishou"):
                c1, c2, c3 = st.columns(3)
                with c1:
                    st.text_input(tr("super_agent.step7.title_prefix"), key="sa_pub_kuaishou_title_prefix")
                with c2:
                    st.text_input(tr("super_agent.step7.collection"), key="sa_pub_kuaishou_collection")
                with c3:
                    st.text_input(tr("super_agent.step7.tags"), key="sa_pub_kuaishou_tags")
                st.checkbox(
                    tr("super_agent.step7.enable_kuaishou_domain"),
                    key="sa_pub_kuaishou_domain_enable",
                )
                if st.session_state.get("sa_pub_kuaishou_domain_enable"):
                    d1, d2 = st.columns(2)
                    with d1:
                        st.text_input(tr("super_agent.step7.domain_level1"), key="sa_pub_kuaishou_domain_lv1")
                    with d2:
                        st.text_input(tr("super_agent.step7.domain_level2"), key="sa_pub_kuaishou_domain_lv2")

            # ── 视频号 ──
            st.checkbox(
                tr("super_agent.step7.enable_shipinhao"),
                value=True,
                key="sa_pub_enable_shipinhao",
            )
            st.checkbox(
                tr("super_agent.step7.enable_original"),
                key="sa_pub_shipinhao_original",
            )
            if not use_common and st.session_state.get("sa_pub_enable_shipinhao"):
                c1, c2, c3 = st.columns(3)
                with c1:
                    st.text_input(tr("super_agent.step7.title_prefix"), key="sa_pub_shipinhao_title_prefix")
                with c2:
                    st.text_input(tr("super_agent.step7.collection"), key="sa_pub_shipinhao_collection")
                with c3:
                    st.text_input(tr("super_agent.step7.tags"), key="sa_pub_shipinhao_tags")

            # ── 小红书 ──
            st.checkbox(
                tr("super_agent.step7.enable_xiaohongshu"),
                value=True,
                key="sa_pub_enable_xiaohongshu",
            )
            if not use_common and st.session_state.get("sa_pub_enable_xiaohongshu"):
                c1, c2, c3 = st.columns(3)
                with c1:
                    st.text_input(tr("super_agent.step7.title_prefix"), key="sa_pub_xiaohongshu_title_prefix")
                with c2:
                    st.text_input(tr("super_agent.step7.collection"), key="sa_pub_xiaohongshu_collection")
                with c3:
                    st.text_input(tr("super_agent.step7.tags"), key="sa_pub_xiaohongshu_tags")

            # ── B站 ──
            st.checkbox(
                tr("super_agent.step7.enable_bilibili"),
                value=True,
                key="sa_pub_enable_bilibili",
            )
            if not use_common and st.session_state.get("sa_pub_enable_bilibili"):
                c1, c2, c3 = st.columns(3)
                with c1:
                    st.text_input(tr("super_agent.step7.title_prefix"), key="sa_pub_bilibili_title_prefix")
                with c2:
                    st.text_input(tr("super_agent.step7.collection"), key="sa_pub_bilibili_collection")
                with c3:
                    st.text_input(tr("super_agent.step7.tags"), key="sa_pub_bilibili_tags")
                st.checkbox(
                    tr("super_agent.step7.enable_bilibili_section"),
                    key="sa_pub_bilibili_section_enable",
                )
                if st.session_state.get("sa_pub_bilibili_section_enable"):
                    s1, s2 = st.columns(2)
                    with s1:
                        st.text_input(tr("super_agent.step7.section_level1"), key="sa_pub_bilibili_section_lv1")
                    with s2:
                        st.text_input(tr("super_agent.step7.section_level2"), key="sa_pub_bilibili_section_lv2")

            # ── 操作按钮 ──
            btn_c1, btn_c2 = st.columns(2)
            with btn_c1:
                test_clicked = st.button(
                    tr("super_agent.step7.test_btn"),
                    width="stretch",
                    key="sa_pub_test_btn",
                    disabled=not port_open,
                )
            with btn_c2:
                publish_clicked = st.button(
                    tr("super_agent.step7.publish_btn"),
                    type="primary",
                    width="stretch",
                    key="sa_publish_btn",
                    disabled=not port_open,
                )

            if test_clicked:
                self._do_test_publish()
            if publish_clicked:
                self._do_publish()

            pub_results = st.session_state.get("sa_publish_results")
            if pub_results:
                for plat, res in pub_results.items():
                    plat_label = tr(f"super_agent.step7.platform_{plat}")
                    if res.get("success"):
                        st.success(f"{plat_label}: {tr('super_agent.step7.publish_success')}")
                    else:
                        st.error(
                            f"{plat_label}: {tr('super_agent.step7.publish_failed', error=res.get('error', ''))}"
                        )

        render_version_info()

    # ══════════════════════════════════════════════════════════════════
    # Helpers
    # ══════════════════════════════════════════════════════════════════

    def _generate_srt_from_video(self, pixelle_video: Any):
        """Generate SRT subtitles from the effective video using whisper/LLM."""
        effective_video = (
            st.session_state.get("sa_manual_video_path")
            or st.session_state.get("sa_video_path")
        )
        if not effective_video or not os.path.exists(str(effective_video)):
            st.warning(tr("super_agent.step5.no_video"))
            return

        with st.spinner(tr("super_agent.step5.generating_srt")):
            try:
                import subprocess

                task_dir = st.session_state.get("sa_task_dir", "temp")
                Path(task_dir).mkdir(parents=True, exist_ok=True)
                audio_tmp = os.path.join(task_dir, "extracted_audio.wav")
                subprocess.run(
                    [
                        "ffmpeg", "-i", str(effective_video),
                        "-vn", "-acodec", "pcm_s16le",
                        "-ar", "16000", "-ac", "1",
                        "-y", audio_tmp,
                    ],
                    capture_output=True, timeout=60,
                )

                if not os.path.exists(audio_tmp):
                    st.error(tr("super_agent.step5.srt_extract_audio_failed"))
                    return

                srt_prompt = (
                    "请根据这段音频内容，生成对应的 SRT 格式字幕。"
                    "严格按照 SRT 格式输出（序号、时间轴、文本），不要添加其他内容。"
                )
                try:
                    result = run_async(
                        pixelle_video.llm(srt_prompt, max_tokens=4096)
                    )
                    if result and result.strip():
                        st.session_state["sa_srt_content"] = result.strip()
                        st.rerun()
                except Exception:
                    script_text = st.session_state.get(
                        "sa_rewritten_script",
                        st.session_state.get("sa_original_script", ""),
                    )
                    if script_text.strip():
                        lines = [
                            ln.strip()
                            for ln in script_text.strip().splitlines()
                            if ln.strip()
                        ]
                        st.session_state["sa_srt_content"] = _build_srt_from_lines(
                            lines,
                            audio_path=st.session_state.get("sa_audio_path", ""),
                        )
                        st.rerun()
                    else:
                        st.warning(tr("super_agent.step5.srt_no_script"))

            except Exception as e:
                st.error(tr("super_agent.step5.error", error=str(e)))
                logger.exception(e)

    def _build_publish_params(self) -> "PublishParams":
        """Collect all publish config from session state into PublishParams."""
        from pixelle_video.services.publisher import PublishParams, PlatformConfig

        use_common = st.session_state.get("sa_use_common_config", True)

        def _cfg(prefix: str) -> PlatformConfig:
            return PlatformConfig(
                enabled=st.session_state.get(f"sa_pub_enable_{prefix}", True),
                title_prefix=st.session_state.get(f"sa_pub_{prefix}_title_prefix", ""),
                collection=st.session_state.get(f"sa_pub_{prefix}_collection", ""),
                tags=st.session_state.get(f"sa_pub_{prefix}_tags", ""),
            )

        common_cfg = PlatformConfig(
            enabled=True,
            title_prefix=st.session_state.get("sa_pub_common_title_prefix", ""),
            collection=st.session_state.get("sa_pub_common_collection", ""),
            tags=st.session_state.get("sa_pub_common_tags", ""),
        )

        final_video = (
            st.session_state.get("sa_final_video", "")
            or st.session_state.get("sa_video_path", "")
        )

        return PublishParams(
            video_path=str(final_video) if final_video else "",
            title=st.session_state.get("sa_video_title", ""),
            description=st.session_state.get("sa_publish_desc", ""),
            cover_path=st.session_state.get("sa_cover_path", ""),
            auto_publish=st.session_state.get("sa_auto_publish", False),
            use_common_config=use_common,
            common=common_cfg,
            douyin=_cfg("douyin"),
            kuaishou=_cfg("kuaishou"),
            xiaohongshu=_cfg("xiaohongshu"),
            bilibili=_cfg("bilibili"),
            shipinhao=_cfg("shipinhao"),
            kuaishou_domain_enabled=st.session_state.get("sa_pub_kuaishou_domain_enable", False),
            kuaishou_domain_level1=st.session_state.get("sa_pub_kuaishou_domain_lv1", ""),
            kuaishou_domain_level2=st.session_state.get("sa_pub_kuaishou_domain_lv2", ""),
            bilibili_section_enabled=st.session_state.get("sa_pub_bilibili_section_enable", False),
            bilibili_section_level1=st.session_state.get("sa_pub_bilibili_section_lv1", ""),
            bilibili_section_level2=st.session_state.get("sa_pub_bilibili_section_lv2", ""),
            shipinhao_original=st.session_state.get("sa_pub_shipinhao_original", False),
        )

    def _get_publisher_service(self):
        from pixelle_video.services.publisher import PublisherService
        return PublisherService(
            driver_type=st.session_state.get("sa_driver_type", "chrome"),
            driver_path=st.session_state.get("sa_driver_path", ""),
            debugger_address=st.session_state.get("sa_debugger_address", "127.0.0.1:9222"),
        )

    def _do_launch_chrome(self):
        from pixelle_video.services.publisher import PublisherService
        addr = st.session_state.get("sa_debugger_address", "127.0.0.1:9222")
        _, port = PublisherService.parse_address(addr)
        driver_path = st.session_state.get("sa_driver_path", "") or ""
        try:
            exe = PublisherService.launch_chrome_debug(port=port, chrome_path=driver_path)
            if PublisherService.is_debug_port_open("127.0.0.1", port):
                st.success(tr("super_agent.step7.launch_success", path=exe))
            else:
                manual_cmd = PublisherService._make_manual_cmd(exe, port)
                st.warning(
                    f"Chrome 已启动，正在等待调试端口就绪…\n\n"
                    f"如果仍未连接，请手动在 CMD 中运行：\n```\n{manual_cmd}\n```"
                )
            st.rerun()
        except FileNotFoundError:
            st.error(tr("super_agent.step7.chrome_not_found"))
        except Exception as e:
            st.error(str(e))

    def _do_test_publish(self):
        """Test browser driver connection."""
        try:
            svc = self._get_publisher_service()
            title = svc.test_connection()
            st.success(tr("super_agent.step7.test_success", title=title))
        except ImportError:
            st.error(tr("super_agent.step7.selenium_missing"))
        except Exception as e:
            st.error(tr("super_agent.step7.test_failed", error=str(e)))
            logger.exception(e)

    def _do_publish(self):
        """Publish video to all enabled platforms via Selenium."""
        params = self._build_publish_params()

        if not params.video_path or not os.path.exists(params.video_path):
            st.warning(tr("super_agent.step5.no_video"))
            return

        progress_bar = st.progress(0)
        status_text = st.empty()

        try:
            svc = self._get_publisher_service()

            def _progress(plat, idx, total, state):
                pct = int((idx / total) * 100) if total else 0
                progress_bar.progress(min(pct, 100))
                plat_label = tr(f"super_agent.step7.platform_{plat}")
                status_text.text(
                    tr("super_agent.step7.publishing_to", platform=plat_label)
                )

            status_text.text(tr("super_agent.step7.publishing"))
            results = svc.publish(params, progress_callback=_progress)

            progress_bar.progress(100)
            status_text.text(tr("super_agent.step7.publish_done"))
            st.session_state["sa_publish_results"] = results

        except ImportError:
            progress_bar.empty()
            status_text.empty()
            st.error(tr("super_agent.step7.selenium_missing"))
        except Exception as e:
            progress_bar.empty()
            status_text.empty()
            st.error(tr("super_agent.step7.publish_error", error=str(e)))
            logger.exception(e)

    @staticmethod
    def _call_llm(pixelle_video: Any, prompt: str, target_key: str):
        """Call LLM via pixelle_video.llm() and store result in session state.

        Uses a _pending_ intermediate key so the value is applied BEFORE the
        target widget is instantiated on the next rerun (Streamlit forbids
        modifying a widget's session-state key after it has been rendered).
        """
        with st.spinner(tr("super_agent.step2.rewriting")):
            try:
                result = run_async(pixelle_video.llm(prompt, max_tokens=4096))
                st.session_state[f"_pending_{target_key}"] = result
                st.rerun()
            except Exception as e:
                st.error(tr("super_agent.step2.rewrite_error", error=str(e)))
                logger.exception(e)

    def _do_generate_video(
        self,
        pixelle_video: Any,
        audio_path: str,
        character_key: str,
        custom_char_path: str | None,
        model_version: str = "v2",
    ):
        """Generate digital human video using ComfyKit workflows."""
        progress_bar = st.progress(0)
        status_text = st.empty()
        start_time = time.time()

        try:
            # Resolve task_dir and character_image in the main thread before entering async
            task_dir = st.session_state.get("sa_task_dir")
            if not task_dir:
                task_dir, _ = create_task_output_dir()
                st.session_state["sa_task_dir"] = task_dir

            character_image = custom_char_path
            if not character_image:
                from pixelle_video.utils.os_util import get_resource_path, resource_exists
                char_map = {
                    "young_male": "characters/young_male.png",
                    "young_female": "characters/young_female.png",
                    "middle_male": "characters/middle_male.png",
                    "middle_female": "characters/middle_female.png",
                }
                char_file = char_map.get(character_key, "characters/young_male.png")
                if resource_exists("", char_file):
                    character_image = get_resource_path("", char_file)
                else:
                    character_image = None

            wf_map = {
                "v1": "workflows/runninghub/digital_combination.json",
                "v2": "workflows/runninghub/digital_customize.json",
            }
            workflow_path = Path(wf_map.get(model_version, wf_map["v2"]))
            if not workflow_path.exists():
                raise FileNotFoundError(
                    f"Digital human workflow not found: {workflow_path}"
                )

            with open(workflow_path, "r", encoding="utf-8") as f:
                wf_config = json.load(f)

            wf_params = {
                "videoimage": character_image or "",
                "audio": audio_path,
            }

            if wf_config.get("source") == "runninghub" and "workflow_id" in wf_config:
                wf_input = wf_config["workflow_id"]
            else:
                wf_input = str(workflow_path)

            # Update UI in main thread before entering background async
            status_text.text(tr("super_agent.step4.generating"))
            progress_bar.progress(20)

            async def _generate(_wf_input, _wf_params, _task_dir):
                """Pure async computation — no Streamlit calls inside (runs in background thread)."""
                kit = await pixelle_video._get_or_create_comfykit()

                max_attempts = 5
                retry_wait = 30
                result = None
                for attempt in range(1, max_attempts + 1):
                    result = await kit.execute(_wf_input, _wf_params)
                    status = getattr(result, "status", "")
                    msg = getattr(result, "msg", "") or ""
                    if status == "completed":
                        break
                    if "TASK_QUEUE_MAXED" in msg and attempt < max_attempts:
                        logger.warning(
                            f"RunningHub queue full (attempt {attempt}/{max_attempts}), "
                            f"retrying in {retry_wait}s..."
                        )
                        await asyncio.sleep(retry_wait)
                        continue
                    break

                logger.info(
                    f"Workflow result: status={getattr(result, 'status', 'N/A')}, "
                    f"msg={getattr(result, 'msg', 'N/A')}, "
                    f"videos={getattr(result, 'videos', None)}, "
                    f"videos_by_var={getattr(result, 'videos_by_var', None)}, "
                    f"images={getattr(result, 'images', None)}, "
                    f"images_by_var={getattr(result, 'images_by_var', None)}, "
                    f"audios={getattr(result, 'audios', None)}, "
                    f"audios_by_var={getattr(result, 'audios_by_var', None)}, "
                    f"texts={getattr(result, 'texts', None)}, "
                    f"outputs={getattr(result, 'outputs', None)}, "
                    f"duration={getattr(result, 'duration', None)}"
                )

                if getattr(result, "status", "") != "completed":
                    raise RuntimeError(
                        f"Workflow execution failed: "
                        f"status={getattr(result, 'status', 'N/A')}, "
                        f"msg={getattr(result, 'msg', 'N/A')}"
                    )

                generated_url = None
                for attr in ("videos", "videos_by_var", "images", "images_by_var"):
                    val = getattr(result, attr, None)
                    if val:
                        if isinstance(val, dict):
                            for k, v in val.items():
                                if v:
                                    generated_url = v[0] if isinstance(v, list) else v
                                    logger.info(f"Found media in result.{attr}[{k}]: {generated_url}")
                                    break
                        elif isinstance(val, list) and val:
                            generated_url = val[0]
                            logger.info(f"Found media in result.{attr}: {generated_url}")
                    if generated_url:
                        break

                if not generated_url and hasattr(result, "outputs") and result.outputs:
                    for node_id, node_out in result.outputs.items():
                        if isinstance(node_out, dict):
                            for key in ("videos", "gifs", "images"):
                                items = node_out.get(key)
                                if items:
                                    generated_url = items[0]
                                    logger.info(f"Found media in outputs[{node_id}][{key}]: {generated_url}")
                                    break
                        if generated_url:
                            break

                if not generated_url:
                    raise RuntimeError(
                        f"Workflow completed but no media found in result. "
                        f"Dump: {result.model_dump() if hasattr(result, 'model_dump') else str(result)}"
                    )

                logger.info(f"Downloading generated media from: {generated_url}")
                final_path = os.path.join(_task_dir, "digital_human.mp4")
                timeout = httpx.Timeout(300.0)
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    resp = await client.get(generated_url)
                    resp.raise_for_status()
                    content_type = resp.headers.get("content-type", "")
                    content = resp.content
                    logger.info(
                        f"Download complete: {len(content)} bytes, "
                        f"Content-Type: {content_type}"
                    )
                    if len(content) == 0:
                        raise RuntimeError(
                            f"Downloaded file is empty (0 bytes). URL: {generated_url}"
                        )
                    with open(final_path, "wb") as f:
                        f.write(content)

                return final_path

            video_path = run_async(_generate(wf_input, wf_params, task_dir))
            progress_bar.progress(100)
            status_text.text(tr("super_agent.step4.success"))
            st.session_state["sa_video_path"] = video_path

            total_time = time.time() - start_time
            if os.path.exists(video_path):
                size_mb = os.path.getsize(video_path) / (1024 * 1024)
                st.caption(
                    f"⏱️ {tr('info.generation_time')} {total_time:.1f}s   "
                    f"📦 {size_mb:.2f}MB"
                )
            st.rerun()

        except Exception as e:
            status_text.text("")
            progress_bar.empty()
            error_detail = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
            st.error(tr("super_agent.step4.error", error=error_detail))
            logger.exception(e)

    def _do_assemble(
        self,
        pixelle_video: Any,
        video_path: str,
        bgm_params: dict,
        subtitle_enabled: bool,
        srt_content: str = "",
    ):
        """Assemble final video with BGM, subtitles, etc."""
        progress_bar = st.progress(0)
        status_text = st.empty()
        start_time = time.time()

        try:
            import subprocess

            task_dir = st.session_state.get("sa_task_dir")
            if not task_dir:
                task_dir, _ = create_task_output_dir()
                st.session_state["sa_task_dir"] = task_dir

            status_text.text(tr("super_agent.step5.assembling"))
            progress_bar.progress(10)

            current_video = video_path
            bgm_path = bgm_params.get("bgm_path")
            bgm_volume = bgm_params.get("bgm_volume", 0.2)

            # ── 1. Burn subtitles via FFmpeg ──
            if subtitle_enabled and srt_content.strip():
                srt_path = os.path.join(task_dir, "subtitles.srt")
                with open(srt_path, "w", encoding="utf-8") as f:
                    f.write(srt_content)

                status_text.text(tr("super_agent.step5.burning_subtitles"))
                progress_bar.progress(30)

                subtitled_path = os.path.join(task_dir, "with_subtitles.mp4")
                srt_escaped = srt_path.replace("\\", "/").replace(":", "\\:")
                cmd = [
                    "ffmpeg", "-i", current_video,
                    "-vf", f"subtitles='{srt_escaped}':force_style='FontSize=18,PrimaryColour=&HFFFFFF&'",
                    "-c:a", "copy", "-y", subtitled_path,
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                if result.returncode == 0 and os.path.exists(subtitled_path):
                    current_video = subtitled_path
                else:
                    logger.warning(f"Subtitle burn failed: {result.stderr[:300]}")

            # ── 2. Add BGM ──
            progress_bar.progress(50)
            resolved_bgm = None
            if bgm_path:
                from pixelle_video.utils.os_util import get_resource_path, resource_exists
                if resource_exists("bgm", bgm_path):
                    resolved_bgm = get_resource_path("bgm", bgm_path)

            final_path = os.path.join(task_dir, "final.mp4")

            if resolved_bgm:
                status_text.text(tr("super_agent.step5.adding_bgm"))
                progress_bar.progress(70)
                from pixelle_video.services.video import VideoService
                video_svc = VideoService()
                video_svc.concat_videos(
                    videos=[current_video],
                    output=final_path,
                    bgm_path=resolved_bgm,
                    bgm_volume=bgm_volume,
                )
            else:
                import shutil
                shutil.copy2(current_video, final_path)

            progress_bar.progress(100)
            status_text.text(tr("super_agent.step5.success"))
            st.session_state["sa_final_video"] = final_path

            total_time = time.time() - start_time
            if os.path.exists(final_path):
                size_mb = os.path.getsize(final_path) / (1024 * 1024)
                st.caption(
                    f"⏱️ {tr('info.generation_time')} {total_time:.1f}s   "
                    f"📦 {size_mb:.2f}MB"
                )
            st.rerun()

        except Exception as e:
            status_text.text("")
            progress_bar.empty()
            st.error(tr("super_agent.step5.error", error=str(e)))
            logger.exception(e)


register_pipeline_ui(SuperAgentPipelineUI)
