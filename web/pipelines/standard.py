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
Standard Pipeline UI

Implements the classic 3-column layout for the Standard Pipeline.
"""

import streamlit as st
from typing import Any
from web.i18n import tr

from web.pipelines.base import PipelineUI, register_pipeline_ui

# Import components
from web.components.content_input import render_content_input, render_bgm_section
from web.components.style_config import render_style_config, render_tts_section
from web.components.output_preview import render_output_preview


class StandardPipelineUI(PipelineUI):
    """
    UI for the Standard Video Generation Pipeline.
    Implements the classic 3-column layout.
    """
    name = "quick_create"
    icon = "⚡"

    @property
    def display_name(self):
        return tr("pipeline.quick_create.name")

    @property
    def description(self):
        return tr("pipeline.quick_create.description")

    def render(self, pixelle_video: Any):
        # Three-column layout
        left_col, middle_col, right_col = st.columns([1, 1, 1])

        # ====================================================================
        # Left Column: Content Input / BGM / TTS (voice synthesis)
        # ====================================================================
        with left_col:
            # Content input (mode, text, title, n_scenes)
            content_params = render_content_input()

            # BGM selection (bgm_path, bgm_volume)
            bgm_params = render_bgm_section()

            # TTS / voice synthesis (moved here from the middle column so it
            # sits with the other audio-related controls).
            tts_params = render_tts_section(pixelle_video)

        # ====================================================================
        # Middle Column: Style Configuration (template + media workflow)
        # ====================================================================
        with middle_col:
            # Style configuration (template, workflow, etc.) — TTS values
            # produced in the left column are threaded back in.
            style_params = render_style_config(pixelle_video, tts_params=tts_params)

        # ====================================================================
        # Right Column: Output Preview
        # ====================================================================
        with right_col:
            # Combine all parameters
            video_params = {
                "pipeline": self.name,
                **content_params,
                **bgm_params,
                **style_params
            }

            # Render output preview (generate button, progress, video preview)
            render_output_preview(pixelle_video, video_params)


# Register self
register_pipeline_ui(StandardPipelineUI)
