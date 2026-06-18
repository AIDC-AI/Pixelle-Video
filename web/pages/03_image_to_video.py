# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""图生视频 page."""

import streamlit as st

from web.utils.page_bootstrap import bootstrap, get_pipeline, get_core
from web.components.theme import render_section_title
from web.i18n import tr

bootstrap()

render_section_title(
    title=f"🎥 {tr('pipeline.i2v.name', fallback='图生视频')}",
    subtitle=tr(
        "pipeline.i2v.description",
        fallback="输入图片和提示词，AI 即刻生成视频。",
    ),
)

pipeline = get_pipeline("image_to_video")
core = get_core()
pipeline.render(core)
