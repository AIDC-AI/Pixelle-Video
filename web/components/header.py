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
Header components for web UI
"""

import json
import os
from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

import streamlit as st
from loguru import logger

from web.i18n import tr, get_available_languages, get_language, set_language
from web.utils.streamlit_helpers import safe_rerun

PROJECT_NONE_VALUE = "__none__"
DEFAULT_API_BASE_URL = "http://localhost:8000"


def render_header():
    """Render page header with title and language selector"""
    col1, col2, col3 = st.columns([3, 2, 1])
    with col1:
        st.markdown(f"<h3>{tr('app.title')}</h3>", unsafe_allow_html=True)
    with col2:
        render_project_selector()
    with col3:
        render_language_selector()


def render_language_selector():
    """Render language selector at the top"""
    languages = get_available_languages()
    lang_options = [f"{code} - {name}" for code, name in languages.items()]
    
    current_lang = st.session_state.get("language", "zh_CN")
    current_index = list(languages.keys()).index(current_lang) if current_lang in languages else 0
    
    selected = st.selectbox(
        tr("language.select"),
        options=lang_options,
        index=current_index,
        label_visibility="collapsed"
    )
    
    selected_code = selected.split(" - ")[0]
    if selected_code != current_lang:
        st.session_state.language = selected_code
        set_language(selected_code)
        safe_rerun()


def _project_selector_label() -> str:
    return "当前项目" if get_language() == "zh_CN" else "Current Project"


def _project_none_label() -> str:
    return "未选择项目" if get_language() == "zh_CN" else "No Project"


def _get_api_base_url() -> str:
    return os.getenv("PIXELLE_API_BASE_URL", DEFAULT_API_BASE_URL).rstrip("/")


@st.cache_data(ttl=30, show_spinner=False)
def _fetch_projects() -> List[Dict[str, Any]]:
    try:
        with urlopen(f"{_get_api_base_url()}/api/projects", timeout=3) as response:
            payload = json.load(response)
            items = payload.get("items", [])
            return [item for item in items if isinstance(item, dict)]
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        logger.warning(f"Failed to fetch projects for Streamlit header: {exc}")
        return []


def _apply_project_selection(selected_project_id: str, project_name: str | None) -> None:
    if selected_project_id == PROJECT_NONE_VALUE:
        st.session_state.current_project_id = None
        st.session_state.current_project_name = None
        if "project_id" in st.query_params:
            del st.query_params["project_id"]
        return

    st.session_state.current_project_id = selected_project_id
    st.session_state.current_project_name = project_name
    st.query_params["project_id"] = selected_project_id


def render_project_selector() -> None:
    projects = _fetch_projects()
    project_options = {PROJECT_NONE_VALUE: _project_none_label()}
    project_options.update({project["id"]: project["name"] for project in projects if "id" in project and "name" in project})

    query_param_project_id = st.query_params.get("project_id")
    if isinstance(query_param_project_id, list):
        query_param_project_id = query_param_project_id[0] if query_param_project_id else None

    selected_project_id = query_param_project_id or st.session_state.get("current_project_id") or PROJECT_NONE_VALUE
    if selected_project_id not in project_options:
        selected_project_id = PROJECT_NONE_VALUE

    selected_name = project_options.get(selected_project_id)
    current_session_project_id = st.session_state.get("current_project_id") or PROJECT_NONE_VALUE
    if selected_project_id != current_session_project_id:
        _apply_project_selection(
            selected_project_id,
            None if selected_project_id == PROJECT_NONE_VALUE else selected_name,
        )

    selected_index = list(project_options.keys()).index(selected_project_id)
    selected_value = st.selectbox(
        _project_selector_label(),
        options=list(project_options.keys()),
        index=selected_index,
        format_func=lambda option: project_options[option],
        key="header_project_selector",
    )

    if selected_value != selected_project_id:
        next_selected_name = project_options.get(selected_value)
        _apply_project_selection(selected_value, None if selected_value == PROJECT_NONE_VALUE else next_selected_name)
        safe_rerun()
