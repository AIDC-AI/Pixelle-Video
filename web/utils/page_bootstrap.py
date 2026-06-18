# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
Page bootstrap — shared setup used by every page entry under web/pages/.

Responsibilities:
- Ensure project root is on sys.path
- Initialize session / i18n
- Inject the global theme CSS
- Render the sidebar header (brand + language)
- Provide a helper to fetch a registered pipeline by name
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional


def bootstrap() -> None:
    """Idempotent module-init logic for every page."""
    project_root = Path(__file__).resolve().parent.parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    # Imports deferred until path is set
    import streamlit as st  # noqa: F401
    from web.state.session import init_session_state, init_i18n
    from web.components.theme import inject_theme, render_topbar

    init_session_state()
    init_i18n()
    inject_theme()
    render_topbar(
        brand_name="ZPL",
        brand_suffix="Video 创作平台",
        logo_text="Z",
        tag="",
        meta="",
    )
    _render_topbar_lang_selector()


def _render_topbar_lang_selector() -> None:
    """Render the language selector and physically move it into the topbar.

    Streamlit can't render real widgets inside our static HTML topbar, so we:
      1. Render a normal selectbox inside a uniquely-marked container.
      2. Use a small JS snippet (in a components iframe so it's never
         sanitized) to grab that container's element and append it into
         `.pv-topbar` on the right-hand side.
    The DOM move is idempotent — re-runs reuse the existing slot.

    NOTE: every multi-line string we pass to st.markdown() MUST be dedented.
    CommonMark treats lines indented by ≥4 spaces as a fenced code block,
    which Streamlit renders as a black <pre> tile (StyledPre / .evr5gns2).
    """
    import textwrap
    import streamlit as st
    from web.i18n import get_available_languages, set_language
    from web.utils.streamlit_helpers import safe_rerun

    languages = get_available_languages()
    if not languages:
        return

    current_lang = st.session_state.get("language", next(iter(languages.keys())))
    keys = list(languages.keys())
    try:
        current_index = keys.index(current_lang)
    except ValueError:
        current_index = 0

    # Render the widget inside a uniquely-keyed container so the JS can
    # locate it precisely. We use a very visible marker DOM node so the
    # script can find the surrounding stElementContainer reliably.
    with st.container():
        st.markdown(
            '<span class="pv-lang-marker" style="display:none"></span>',
            unsafe_allow_html=True,
        )
        selected = st.selectbox(
            "Language",
            options=[f"{c} - {n}" for c, n in languages.items()],
            index=current_index,
            key="__pv_lang_selector",
            label_visibility="collapsed",
        )
    selected_code = selected.split(" - ")[0]
    if selected_code != current_lang:
        st.session_state.language = selected_code
        set_language(selected_code)
        safe_rerun()

    # CSS — must be dedented so CommonMark doesn't render it as a code block.
    lang_slot_css = textwrap.dedent("""\
    <style>
    /* Slot inside the topbar that hosts the language widget — pinned
       to the far right via margin-left:auto (flex auto-margin). */
    .pv-topbar .pv-lang-slot {
        display: inline-flex;
        align-items: center;
        margin-left: auto !important;
        margin-right: 4px;
        height: 100%;
        order: 999;
    }
    .pv-topbar .pv-lang-slot [data-testid="stElementContainer"],
    .pv-topbar .pv-lang-slot [data-testid="stVerticalBlock"] {
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        min-width: 160px !important;
        width: 160px !important;
        gap: 0 !important;
    }
    .pv-topbar .pv-panel,
    .pv-topbar [data-testid="stVerticalBlock"].pv-panel,
    .pv-topbar .pv-lang-slot * {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
    }
    .pv-topbar .pv-panel::before,
    .pv-topbar .pv-panel::after,
    .pv-topbar .pv-lang-slot *::before,
    .pv-topbar .pv-lang-slot *::after {
        display: none !important;
        content: none !important;
    }
    .pv-topbar .pv-lang-slot [data-baseweb="select"] > div {
        min-height: 36px !important;
        background: rgba(255, 255, 255, 0.92) !important;
        border: 1px solid #e3e8f2 !important;
        border-radius: 8px !important;
        font-size: 0.88rem !important;
        box-shadow: none !important;
    }
    .pv-topbar .pv-lang-slot label { display: none !important; }
    .pv-topbar .pv-lang-slot .pv-lang-marker { display: none !important; }
    .pv-topbar .pv-lang-slot pre,
    .pv-topbar .pv-lang-slot code,
    .pv-topbar pre,
    .pv-topbar [data-testid="stMarkdown"] pre {
        display: none !important;
    }
    </style>
    """)
    st.markdown(lang_slot_css, unsafe_allow_html=True)

    # JS — components.html guarantees execution; markdown may strip <script>.
    move_script = textwrap.dedent("""\
    <script>
    (function() {
      var DOC = window.parent.document;

      function moveLangIntoTopbar() {
        var topbar = DOC.querySelector('.pv-topbar');
        if (!topbar) return false;

        var marker = DOC.querySelector('.pv-lang-marker');
        if (!marker) return false;

        var block = marker.closest('[data-testid="stVerticalBlock"]')
                 || marker.closest('[data-testid="stElementContainer"]');
        if (!block) return false;

        if (topbar.contains(block)) {
          stripPanelClass(block);
          hideNonSelect(block);
          return true;
        }

        var slot = topbar.querySelector('.pv-lang-slot');
        if (!slot) {
          slot = DOC.createElement('div');
          slot.className = 'pv-lang-slot';
          topbar.appendChild(slot);
        }
        slot.appendChild(block);
        stripPanelClass(block);
        hideNonSelect(block);
        return true;
      }

      function stripPanelClass(root) {
        if (root.classList) root.classList.remove('pv-panel');
        root.querySelectorAll('.pv-panel').forEach(function(el) {
          el.classList.remove('pv-panel');
        });
      }

      function hideNonSelect(root) {
        var children = root.querySelectorAll(
          ':scope > [data-testid="stElementContainer"], ' +
          ':scope > [data-testid="stMarkdown"], ' +
          ':scope > pre, ' +
          ':scope > iframe'
        );
        children.forEach(function(el) {
          if (el.querySelector('[data-baseweb="select"]')) return;
          el.style.display = 'none';
          el.style.width = '0';
          el.style.height = '0';
          el.style.margin = '0';
          el.style.padding = '0';
          el.style.border = '0';
        });
      }

      if (moveLangIntoTopbar()) return;
      var attempts = 0;
      var iv = setInterval(function() {
        attempts += 1;
        if (moveLangIntoTopbar() || attempts > 60) clearInterval(iv);
      }, 80);

      if (!window.__pv_lang_observer__) {
        var obs = new MutationObserver(function() { moveLangIntoTopbar(); });
        obs.observe(DOC.body, { childList: true, subtree: true });
        window.__pv_lang_observer__ = obs;
      }
    })();
    </script>
    """)
    try:
        from streamlit.components.v1 import html as _components_html
        _components_html(move_script, height=0, width=0)
    except Exception:
        st.markdown(move_script, unsafe_allow_html=True)


def get_pipeline(name: str):
    """Fetch a registered pipeline UI instance by its `name` attribute."""
    from web.pipelines import get_pipeline_ui  # triggers registration
    pipeline = get_pipeline_ui(name)
    if pipeline is None:
        import streamlit as st
        st.error(f"Pipeline '{name}' not registered.")
        st.stop()
    return pipeline


def get_core():
    """Lazy-init of the PixelleVideoCore singleton bound to this session."""
    from web.state.session import get_pixelle_video
    return get_pixelle_video()
