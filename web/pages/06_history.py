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

"""History Page - View generation history and manage tasks."""

import os
from datetime import datetime

import streamlit as st

from web.utils.page_bootstrap import bootstrap, get_core
from web.components.theme import render_section_title
from web.i18n import tr
from web.utils.async_helpers import run_async

bootstrap()


# ---------------------------------------------------------------------------
# Helpers (verbatim from previous History page — keep behavior identical)
# ---------------------------------------------------------------------------

def format_duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    if seconds < 3600:
        minutes = int(seconds / 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"
    hours = int(seconds / 3600)
    minutes = int((seconds % 3600) / 60)
    return f"{hours}h {minutes}m"


def format_file_size(bytes_size: int) -> str:
    if bytes_size < 1024:
        return f"{bytes_size}B"
    if bytes_size < 1024 * 1024:
        return f"{bytes_size / 1024:.1f}KB"
    if bytes_size < 1024 * 1024 * 1024:
        return f"{bytes_size / 1024 / 1024:.1f}MB"
    return f"{bytes_size / 1024 / 1024 / 1024:.2f}GB"


def format_datetime(iso_string: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_string)
        return dt.strftime("%m-%d %H:%M")
    except Exception:
        return iso_string


def truncate_text(text: str, max_length: int = 60) -> str:
    if len(text) <= max_length:
        return text
    return text[:max_length] + "..."


def render_page_toolbar(pixelle_video):
    """Render statistics + filters inline at the top of the page.

    Replaces the previous sidebar-only layout — keeps the sidebar dedicated
    to navigation, and gives the History page its own self-contained toolbar.
    """
    stats = run_async(pixelle_video.history.get_statistics())

    # ---- Stats row ----------------------------------------------------
    with st.container(border=True):
        st.markdown(f"**📊 {tr('history.total_tasks')}**")
        m1, m2, m3 = st.columns(3)
        with m1:
            st.metric(tr("history.total_tasks"), stats.get("total", 0))
        with m2:
            st.metric(tr("history.completed_count"), stats.get("completed", 0))
        with m3:
            st.metric(tr("history.failed_count"), stats.get("failed", 0))

    # ---- Filter / sort row -------------------------------------------
    status_options = {
        "all": tr("history.status_all"),
        "completed": tr("history.status_completed"),
        "failed": tr("history.status_failed"),
        "running": tr("history.status_running"),
        "pending": tr("history.status_pending"),
    }
    sort_options = {
        "created_at": tr("history.sort_created_at"),
        "completed_at": tr("history.sort_completed_at"),
        "title": tr("history.sort_title"),
        "duration": tr("history.sort_duration"),
    }
    sort_order_options = {
        "desc": tr("history.sort_order_desc"),
        "asc": tr("history.sort_order_asc"),
    }

    with st.container(border=True):
        c1, c2, c3, c4 = st.columns([1.2, 1.2, 1.2, 0.8])
        with c1:
            st.markdown(f"**🔍 {tr('history.filter_status')}**")
            selected_status = st.selectbox(
                tr("history.filter_status"),
                options=list(status_options.keys()),
                format_func=lambda x: status_options[x],
                key="filter_status",
                label_visibility="collapsed",
            )
        with c2:
            st.markdown(f"**🗂 {tr('history.sort_by')}**")
            sort_by = st.selectbox(
                tr("history.sort_by"),
                options=list(sort_options.keys()),
                format_func=lambda x: sort_options[x],
                key="sort_by",
                label_visibility="collapsed",
            )
        with c3:
            st.markdown(f"**↕ {tr('history.sort_by')}**")
            sort_order = st.radio(
                "Sort Order",
                options=list(sort_order_options.keys()),
                format_func=lambda x: sort_order_options[x],
                key="sort_order",
                label_visibility="collapsed",
                horizontal=True,
            )
        with c4:
            st.markdown(f"**📄 {tr('history.page_size')}**")
            page_size = st.selectbox(
                tr("history.page_size"),
                options=[15, 30, 60],
                index=0,
                key="page_size",
                label_visibility="collapsed",
            )

    filter_status = None if selected_status == "all" else selected_status
    return filter_status, sort_by, sort_order, page_size


def render_grid_task_card(task: dict, pixelle_video):
    task_id = task["task_id"]
    title = task.get("title", "Untitled")
    status = task.get("status", "unknown")
    created_at = task.get("created_at", "")
    duration = task.get("duration", 0)
    n_frames = task.get("n_frames", 0)
    video_path = task.get("video_path", "")

    status_map = {
        "completed": "✅",
        "failed": "❌",
        "running": "⏳",
        "pending": "⏸️",
    }
    status_icon = status_map.get(status, "❓")

    detail = run_async(pixelle_video.history.get_task_detail(task_id))
    input_text = ""
    if detail and detail.get("metadata"):
        input_params = detail["metadata"].get("input", {})
        input_text = input_params.get("text", "")

    with st.container(border=True):
        if video_path and os.path.exists(video_path):
            st.video(video_path, autoplay=False, loop=False, muted=False)
        else:
            st.markdown(
                "<div style='background:#f5f5f7;height:180px;display:flex;align-items:center;"
                "justify-content:center;border-radius:14px;font-size:48px;color:#a0a0a8;'>📹</div>",
                unsafe_allow_html=True,
            )

        st.markdown(f"**{status_icon} {truncate_text(title, 50)}**")

        if input_text:
            st.caption(truncate_text(input_text, 60))

        st.caption(f"🕒 {format_datetime(created_at)} · ⏱️ {format_duration(duration)} · 🎬 {n_frames}")

        col1, col2, col3 = st.columns(3)
        with col1:
            if st.button("👁️", key=f"view_{task_id}",
                         help=tr("history.task_card.view_detail"),
                         use_container_width=True):
                st.session_state[f"detail_{task_id}"] = True
                st.rerun()
        with col2:
            if video_path and os.path.exists(video_path):
                with open(video_path, "rb") as f:
                    st.download_button(
                        "⬇️", data=f, file_name=f"{title}.mp4", mime="video/mp4",
                        key=f"download_{task_id}",
                        help=tr("history.task_card.download"),
                        use_container_width=True,
                    )
            else:
                st.button("⬇️", key=f"download_disabled_{task_id}", disabled=True,
                          use_container_width=True)
        with col3:
            if st.button("🗑️", key=f"delete_{task_id}",
                         help=tr("history.task_card.delete"),
                         use_container_width=True):
                st.session_state[f"confirm_delete_{task_id}"] = True
                st.rerun()

        if st.session_state.get(f"confirm_delete_{task_id}", False):
            st.warning("⚠️ 确认删除?")
            c1, c2 = st.columns(2)
            with c1:
                if st.button("✅", key=f"confirm_yes_{task_id}", use_container_width=True):
                    try:
                        success = run_async(pixelle_video.history.delete_task(task_id))
                        if success:
                            st.success(tr("history.action.delete_success"))
                            st.session_state[f"confirm_delete_{task_id}"] = False
                            st.rerun()
                        else:
                            st.error("删除失败")
                    except Exception as e:
                        st.error(f"删除失败: {str(e)}")
            with c2:
                if st.button("❌", key=f"confirm_no_{task_id}", use_container_width=True):
                    st.session_state[f"confirm_delete_{task_id}"] = False
                    st.rerun()


def render_task_detail_modal(task_id: str, pixelle_video):
    detail = run_async(pixelle_video.history.get_task_detail(task_id))

    if not detail:
        st.error("Task not found")
        return

    metadata = detail["metadata"]
    storyboard = detail["storyboard"]

    if st.button("← " + tr("history.detail.close"),
                 key=f"close_detail_top_{task_id}"):
        st.session_state[f"detail_{task_id}"] = False
        st.rerun()

    st.markdown(f"### {tr('history.detail.modal_title')}")
    st.caption(f"{tr('history.detail.task_id')}: {task_id}")

    col_input, col_storyboard, col_video = st.columns([1, 1, 1])

    with col_input:
        with st.container(border=True):
            st.markdown(f"**📝 {tr('history.detail.input_params')}**")
            input_params = metadata.get("input", {})

            st.markdown(f"**{tr('history.detail.mode')}:** {input_params.get('mode', 'N/A')}")
            st.markdown(f"**{tr('history.detail.n_scenes')}:** {input_params.get('n_scenes', 'N/A')}")
            st.markdown(f"**{tr('history.detail.tts_mode')}:** {input_params.get('tts_inference_mode', 'N/A')}")
            st.markdown(f"**{tr('history.detail.voice')}:** {input_params.get('tts_voice', 'N/A')}")

            with st.expander(tr("history.detail.text"), expanded=True):
                st.text_area(
                    "Input Text",
                    value=input_params.get('text', 'N/A'),
                    height=200,
                    disabled=True,
                    label_visibility="collapsed",
                )

    with col_storyboard:
        with st.container(border=True):
            st.markdown(f"**🎬 {tr('history.detail.storyboard')}**")
            if storyboard and storyboard.frames:
                for frame in storyboard.frames:
                    with st.expander(f"{tr('history.detail.frame')} {frame.index + 1}", expanded=False):
                        st.markdown(f"**{tr('history.detail.narration')}:**")
                        st.caption(frame.narration)
                        if frame.image_prompt:
                            st.markdown(f"**{tr('history.detail.image_prompt')}:**")
                            st.caption(frame.image_prompt)
                        c1, c2 = st.columns(2)
                        with c1:
                            if frame.composed_image_path and os.path.exists(frame.composed_image_path):
                                st.image(frame.composed_image_path)
                            elif frame.image_path and os.path.exists(frame.image_path):
                                st.image(frame.image_path)
                        with c2:
                            if frame.video_segment_path and os.path.exists(frame.video_segment_path):
                                st.video(frame.video_segment_path)
                        if frame.audio_path and os.path.exists(frame.audio_path):
                            st.audio(frame.audio_path)
            else:
                st.info("No storyboard data")

    with col_video:
        with st.container(border=True):
            st.markdown(f"**🎥 {tr('info.video_information')}**")
            video_path = metadata.get("result", {}).get("video_path")
            if video_path and os.path.exists(video_path):
                st.video(video_path)
                result = metadata.get("result", {})
                st.markdown(f"**{tr('info.duration')}:** {format_duration(result.get('duration', 0))}")
                st.markdown(f"**{tr('info.frames')}:** {result.get('n_frames', 0)}")
                st.markdown(f"**{tr('info.file_size')}:** {format_file_size(result.get('file_size', 0))}")
                with open(video_path, "rb") as f:
                    title = metadata.get("input", {}).get("title", "video") or "video"
                    st.download_button(
                        tr("history.detail.download_video"),
                        data=f,
                        file_name=f"{title}.mp4",
                        mime="video/mp4",
                        use_container_width=True,
                        type="primary",
                    )
            else:
                st.warning("Video file not found")


# ---------------------------------------------------------------------------
# Main render
# ---------------------------------------------------------------------------

pixelle_video = get_core()

# detect detail mode
show_detail_for = None
for key in st.session_state.keys():
    if key.startswith("detail_") and st.session_state[key]:
        show_detail_for = key.replace("detail_", "")
        break

if show_detail_for:
    render_section_title(f"📚 {tr('history.page_title')}")
    render_task_detail_modal(show_detail_for, pixelle_video)
else:
    # Default sort: latest first by creation timestamp.
    st.session_state.setdefault("sort_by", "created_at")
    st.session_state.setdefault("sort_order", "desc")
    st.session_state.setdefault("filter_status", "all")
    st.session_state.setdefault("page_size", 15)

    if "history_page" not in st.session_state:
        st.session_state.history_page = 1

    render_section_title(
        title=f"📚 {tr('history.page_title')}",
        subtitle=tr("history.page_subtitle", fallback="按创建时间倒序展示历史生成任务"),
    )

    filter_status, sort_by, sort_order, page_size = render_page_toolbar(pixelle_video)

    result = run_async(pixelle_video.history.get_task_list(
        page=st.session_state.history_page,
        page_size=page_size,
        status=filter_status,
        sort_by=sort_by,
        sort_order=sort_order,
    ))

    tasks = result["tasks"]
    total = result["total"]
    total_pages = result["total_pages"]

    st.caption(f"{tr('history.total_tasks')}: {total}")

    if not tasks:
        st.info(tr("history.no_tasks"))
    else:
        CARDS_PER_ROW = 3
        for i in range(0, len(tasks), CARDS_PER_ROW):
            cols = st.columns(CARDS_PER_ROW)
            for j in range(CARDS_PER_ROW):
                idx = i + j
                if idx < len(tasks):
                    with cols[j]:
                        render_grid_task_card(tasks[idx], pixelle_video)

    if total_pages > 1:
        st.divider()
        c1, c2, c3 = st.columns([1, 2, 1])
        with c1:
            if st.button("← Previous",
                         disabled=st.session_state.history_page == 1,
                         use_container_width=True):
                st.session_state.history_page -= 1
                st.rerun()
        with c2:
            st.markdown(
                f"<div style='text-align:center;padding-top:8px;color:#6e6e73;'>"
                f"{tr('history.page_info').format(page=st.session_state.history_page, total_pages=total_pages)}"
                f"</div>",
                unsafe_allow_html=True,
            )
        with c3:
            if st.button("Next →",
                         disabled=st.session_state.history_page == total_pages,
                         use_container_width=True):
                st.session_state.history_page += 1
                st.rerun()
