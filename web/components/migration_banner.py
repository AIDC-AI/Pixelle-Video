# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Migration banner for Streamlit users.
"""

from __future__ import annotations

import html
import os
from datetime import UTC, datetime, timedelta
from typing import Optional

import streamlit as st
import streamlit.components.v1 as components

from web.utils.streamlit_helpers import safe_rerun

BANNER_COOKIE_NAME = "pixelle_new_frontend_banner_hide_until"
BANNER_SESSION_KEY = "migration_banner_hide_until"
DEFAULT_NEW_FRONTEND_URL = "http://localhost:3000"


def get_new_frontend_url() -> str:
    return os.getenv("PIXELLE_NEW_FRONTEND_URL", DEFAULT_NEW_FRONTEND_URL).strip() or DEFAULT_NEW_FRONTEND_URL


def compute_hide_until(now: Optional[datetime] = None) -> datetime:
    base_time = now or datetime.now(UTC)
    if base_time.tzinfo is None:
        base_time = base_time.replace(tzinfo=UTC)
    return base_time.astimezone(UTC) + timedelta(hours=24)


def parse_hide_until(raw_value: Optional[str]) -> Optional[datetime]:
    if not raw_value:
        return None

    try:
        parsed = datetime.fromisoformat(raw_value)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)

    return parsed.astimezone(UTC)


def should_show_banner(
    now: Optional[datetime] = None,
    *,
    session_value: Optional[str] = None,
    cookie_value: Optional[str] = None,
) -> bool:
    current_time = now or datetime.now(UTC)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=UTC)
    current_time = current_time.astimezone(UTC)

    session_hide_until = parse_hide_until(session_value)
    cookie_hide_until = parse_hide_until(cookie_value)

    return not any(
        hide_until is not None and hide_until > current_time
        for hide_until in (session_hide_until, cookie_hide_until)
    )


def hide_banner_for_24_hours(now: Optional[datetime] = None) -> str:
    hide_until = compute_hide_until(now)
    return hide_until.isoformat()


def _persist_banner_hide_until(hide_until_iso: str) -> None:
    hide_until = parse_hide_until(hide_until_iso)
    if hide_until is None:
        return

    st.session_state[BANNER_SESSION_KEY] = hide_until_iso
    expires = hide_until.strftime("%a, %d %b %Y %H:%M:%S GMT")
    safe_cookie_value = html.escape(hide_until_iso, quote=True)
    components.html(
        f"""
        <script>
          document.cookie = "{BANNER_COOKIE_NAME}={safe_cookie_value}; expires={expires}; path=/; SameSite=Lax";
        </script>
        """,
        height=0,
    )


def render_migration_banner() -> None:
    session_value = st.session_state.get(BANNER_SESSION_KEY)
    cookie_value = getattr(st.context, "cookies", {}).get(BANNER_COOKIE_NAME)

    if not should_show_banner(session_value=session_value, cookie_value=cookie_value):
        return

    with st.container(border=True):
        content_col, action_col, dismiss_col = st.columns([5, 1.4, 1.4])
        with content_col:
            st.markdown("#### 🆕 新版工作台已上线，点击切换")
            st.caption("新工作台支持项目化管理、历史视频库与批量任务队列。")
        with action_col:
            st.link_button("切换到新版", get_new_frontend_url(), use_container_width=True)
        with dismiss_col:
            if st.button("稍后提醒我", key="dismiss_migration_banner", use_container_width=True):
                _persist_banner_hide_until(hide_banner_for_24_hours())
                safe_rerun()

