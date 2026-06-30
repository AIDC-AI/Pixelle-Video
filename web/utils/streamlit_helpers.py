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
Streamlit helper functions
"""

import streamlit as st
import streamlit.components.v1 as components

from web.i18n import tr
from pixelle_video.config import config_manager


def safe_rerun():
    """Safe rerun that works with both old and new Streamlit versions"""
    if hasattr(st, 'rerun'):
        st.rerun()
    else:
        st.experimental_rerun()


def persistent_widget(widget_func, key, default, **kwargs):
    """Render a widget whose value survives navigation to other pages.

    Streamlit drops widget state for any widget not rendered during a script
    run (SessionState._remove_stale_widgets). In a multipage app the Home
    widgets aren't rendered while the user is on History / Voice Designer, so
    their values are wiped and reset to defaults on return — which empties the
    script text and breaks generation.

    We mirror the value into a plain (non-widget) ``_persist:<key>`` entry,
    which Streamlit never drops, and reinstate it before the widget renders.
    ``default`` is used only on the very first render.
    """
    bak = f"_persist:{key}"
    if key not in st.session_state:
        candidate = st.session_state.get(bak, default)
        # selectbox/radio: a stale backup (e.g. a deleted voice design) that's
        # no longer in options would crash the widget — fall back to default.
        options = kwargs.get("options")
        if options is not None and candidate not in options:
            candidate = default
        st.session_state[key] = candidate
    # value=/index= conflict with a session_state-backed key; the widget reads
    # its initial value from session_state instead.
    kwargs.pop("value", None)
    kwargs.pop("index", None)
    value = widget_func(key=key, **kwargs)
    st.session_state[bak] = st.session_state[key]
    return value


# ============================================================================
# SelfHost Workflow Warning - Using Native JavaScript Alert
# ============================================================================
# Uses native browser alert() to avoid Streamlit's dialog limitations.
# This is simple, reliable, and works across all browsers.

def check_and_warn_selfhost_workflow(workflow_path: str):
    """
    Check if user just switched to a selfhost workflow and show JS alert.
    
    Uses native JavaScript alert() which bypasses all Streamlit dialog limitations.
    The alert is shown immediately when user switches to a selfhost workflow.
    
    Args:
        workflow_path: The workflow path (e.g., "selfhost/image_flux.json")
    """
    if not workflow_path:
        return
    
    # Check if this is a transition TO selfhost
    is_selfhost = workflow_path.startswith("selfhost/")
    
    # Only show alert when transitioning TO selfhost
    if is_selfhost:
        _show_js_alert(workflow_path)


def _show_js_alert(workflow_path: str):
    """
    Show a native JavaScript alert with selfhost workflow warning.
    
    Args:
        workflow_path: The workflow path to display in the alert
    """
    # Get ComfyUI URL from config
    comfyui_config = config_manager.get_comfyui_config()
    comfyui_url = comfyui_config.get("comfyui_url", "http://localhost:8188")
    
    # Build alert message
    title = tr("selfhost.warning.title")
    message = tr("selfhost.warning.message", 
                 comfyui_url=comfyui_url, 
                 workflow_path=f"workflows/{workflow_path}")
    hint = tr("selfhost.warning.hint")
    
    # Clean up markdown formatting for plain text alert
    # Remove ** (bold markers) and other markdown
    message = message.replace("**", "").replace("*", "")
    hint = hint.replace("**", "").replace("*", "")
    
    # Combine into single alert message
    full_message = f"{title}\\n\\n{message}\\n\\n{hint}"
    
    # Escape for JavaScript string
    full_message = full_message.replace("'", "\\'").replace('"', '\\"')
    full_message = full_message.replace("\n", "\\n")
    
    # Inject JavaScript alert
    js_code = f"""
    <script>
        alert("{full_message}");
    </script>
    """
    
    components.html(js_code, height=0, width=0)

