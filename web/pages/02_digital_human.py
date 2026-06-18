# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""数字人口播 page."""

import streamlit as st

from web.utils.page_bootstrap import bootstrap, get_pipeline, get_core
from web.components.theme import render_section_title
from web.i18n import tr

bootstrap()

render_section_title(
    title=f"👤 {tr('pipeline.digital_human.name', fallback='数字人口播')}",
    subtitle=tr(
        "pipeline.digital_human.description",
        fallback="用文本 + 两张图 + 一段音频，生成一段数字人视频。",
    ),
)

pipeline = get_pipeline("digital_human")
core = get_core()
pipeline.render(core)
