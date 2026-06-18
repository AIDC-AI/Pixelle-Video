# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""快速创造 — Standard pipeline as the hero entry."""

import streamlit as st

from web.utils.page_bootstrap import bootstrap, get_pipeline, get_core
from web.components.theme import render_section_title
from web.i18n import tr

bootstrap()

render_section_title(
    title=f"⚡ {tr('pipeline.quick_create.name', fallback='快速创造')}",
    subtitle=tr(
        "pipeline.quick_create.description",
        fallback="输入一个想法，AI 自动完成创意管线，一键产出完整视频。",
    ),
)

pipeline = get_pipeline("quick_create")
core = get_core()
pipeline.render(core)
