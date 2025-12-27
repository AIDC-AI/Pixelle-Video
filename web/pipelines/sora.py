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
Sora Image-to-Video Pipeline UI

Expose Sora / I2V capabilities as a top-level pipeline tab, alongside:
- ⚡ Quick Create
- 🎨 Custom Media
"""

from typing import Any

import streamlit as st

from web.i18n import tr
from web.pipelines.base import PipelineUI, register_pipeline_ui

# Reuse existing components
from web.components.content_input import (
    render_content_input,
    render_bgm_section,
    render_version_info,
)
from web.components.style_config import render_style_config
from web.components.output_preview import render_output_preview


class SoraPipelineUI(PipelineUI):
    """
    UI for Sora Image-to-Video Pipeline.

    Reuses the standard 3-column layout but:
    - Prefers video templates by default
    - Prefers Sora I2V workflows when available
    """

    name = "sora"
    icon = "🎥"

    @property
    def display_name(self):
        return tr("pipeline.sora.name")

    @property
    def description(self):
        return tr("pipeline.sora.description")

    def _init_defaults(self, pixelle_video: Any):
        """
        Initialize Sora-specific defaults (run once per session).

        - Default template type: video
        - Default media workflow: selfhost/video_i2v_sora.json (or sorat2)
        """
        # Only initialize once to avoid overriding user's later choices
        if st.session_state.get("sora_pipeline_initialized"):
            return

        # Prefer video templates
        try:
            # Use Sora-specific key prefix to match style_config key
            st.session_state.setdefault("sora_template_type_selector", "video")
        except Exception:
            # Fail silently if Streamlit state is not ready
            pass

        # Prefer Sora I2V workflow if available
        try:
            workflows = pixelle_video.media.list_workflows()
            sora_display_name = None

            for wf in workflows:
                key = wf.get("key", "")
                if key in (
                    "selfhost/video_i2v_sora.json",
                    "selfhost/video_i2v_sorat2.json",
                ):
                    sora_display_name = wf.get("display_name")
                    break

            if sora_display_name:
                # This value matches the option string used in style_config selectbox
                # Use Sora-specific key prefix to avoid conflicts with other pipelines
                st.session_state["sora_media_workflow_select"] = sora_display_name
        except Exception:
            # If anything fails (e.g., media service not ready), just skip defaults
            pass

        st.session_state["sora_pipeline_initialized"] = True

    def render(self, pixelle_video: Any):
        # Initialize Sora-specific defaults before rendering style config
        self._init_defaults(pixelle_video)

        # Three-column layout (same structure as Standard pipeline)
        left_col, middle_col, right_col = st.columns([1, 1, 1])

        # ------------------------------------------------------------------
        # Left Column: Content Input & BGM
        # ------------------------------------------------------------------
        with left_col:
            content_params = render_content_input(key_prefix="sora_")
            bgm_params = render_bgm_section(key_prefix="sora_")
            render_version_info()

        # ------------------------------------------------------------------
        # Middle Column: Style / Sora Configuration
        # ------------------------------------------------------------------
        with middle_col:
            # Force template type to 'video' and hide TTS / storyboard template UI
            style_params = render_style_config(
                pixelle_video,
                key_prefix="sora_",
                force_template_type="video",
                show_tts=False,
            )

        # ------------------------------------------------------------------
        # Right Column: Output Preview
        # ------------------------------------------------------------------
        with right_col:
            video_params = {
                "pipeline": self.name,
                **content_params,
                **bgm_params,
                **style_params,
            }

            render_output_preview(pixelle_video, video_params, key_prefix="sora_")


# Register self so it shows up as a top-level pipeline tab
register_pipeline_ui(SoraPipelineUI)


