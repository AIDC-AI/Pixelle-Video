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
Sensitive words configuration component for web UI
"""

import time
from pathlib import Path

import streamlit as st

from pixelle_video.config import config_manager
from web.i18n import tr


def _parse_sensitive_words(raw_words: str) -> list[str]:
    """Parse newline-delimited sensitive words, preserving input order."""
    words = []
    seen = set()
    for line in raw_words.splitlines():
        word = line.strip()
        if not word or word.startswith("#") or word in seen:
            continue
        words.append(word)
        seen.add(word)
    return words


def _get_sensitive_words_path() -> Path:
    """Get sensitive words file path, compatible with hot-reloaded managers."""
    path_getter = getattr(config_manager, "_sensitive_words_path", None)
    if callable(path_getter):
        return path_getter()

    config_path = Path(getattr(config_manager, "config_path", "config.yaml"))
    if not config_path.is_absolute():
        config_path = Path.cwd() / config_path
    return config_path.parent / "sensitive_words.md"


def _read_sensitive_words_file() -> list[str]:
    """Read sensitive words directly from sensitive_words.md."""
    words_path = _get_sensitive_words_path()
    if not words_path.exists():
        return []
    return _parse_sensitive_words(words_path.read_text(encoding="utf-8"))


def _write_sensitive_words_file(words: list[str]):
    """Write sensitive words directly to sensitive_words.md."""
    words_path = _get_sensitive_words_path()
    words_path.parent.mkdir(parents=True, exist_ok=True)
    normalized_words = _parse_sensitive_words("\n".join(words))
    content_lines = ["# Sensitive Words", "# One word per line", ""] + normalized_words
    words_path.write_text("\n".join(content_lines).rstrip() + "\n", encoding="utf-8")


def _get_sensitive_words() -> list[str]:
    """Get sensitive words."""
    getter = getattr(config_manager, "get_sensitive_words", None)
    if callable(getter):
        return getter()

    words = _read_sensitive_words_file()
    if words:
        return words

    config_dict = config_manager.config.to_dict()
    security_config = config_dict.get("security", {}) or {}
    return _parse_sensitive_words("\n".join(security_config.get("sensitive_words", []) or []))


def _set_sensitive_words(words: list[str]):
    """Persist sensitive words."""
    setter = getattr(config_manager, "set_sensitive_words", None)
    if callable(setter):
        setter(words)
    else:
        _write_sensitive_words_file(words)


def render_sensitive_words():
    """Render sensitive words edit panel."""
    words = _get_sensitive_words()

    with st.container(border=True):
        st.markdown(f"**{tr('sensitive_words.card_title')}**")
        st.caption(tr("sensitive_words.card_caption"))
        st.caption(tr("sensitive_words.file_hint"))

        saved_at = st.session_state.get("sensitive_words_saved_at")
        if saved_at:
            elapsed = time.time() - saved_at
            if elapsed < 2:
                st.success(tr("sensitive_words.status.saved"))
            else:
                st.session_state.sensitive_words_saved_at = None

        sensitive_words_text = st.text_area(
            tr("sensitive_words.input_label"),
            value="\n".join(words),
            height=420,
            placeholder=tr("sensitive_words.input_placeholder"),
            help=tr("sensitive_words.input_help"),
            key="sensitive_words_editor_text_area",
        )

        parsed_words = _parse_sensitive_words(sensitive_words_text)
        st.caption(tr("sensitive_words.count_hint", count=len(parsed_words)))

        if st.button(
            tr("sensitive_words.save_btn"),
            use_container_width=True,
            type="primary",
            key="save_sensitive_words_editor_btn",
        ):
            try:
                _set_sensitive_words(parsed_words)
                st.session_state.sensitive_words_saved_at = time.time()
                st.success(tr("sensitive_words.status.saved"))
                time.sleep(2)
                st.session_state.sensitive_words_saved_at = None
                st.rerun()
            except Exception as e:
                st.error(f"{tr('status.save_failed')}: {str(e)}")
