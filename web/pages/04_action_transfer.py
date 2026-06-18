# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""动作迁移 page."""

import streamlit as st

from web.utils.page_bootstrap import bootstrap, get_pipeline, get_core
from web.components.theme import render_section_title
from web.i18n import tr

bootstrap()

render_section_title(
    title=f"🤸 {tr('pipeline.action_transfer.name', fallback='动作迁移')}",
    subtitle=tr(
        "pipeline.action_transfer.description",
        fallback="一张图、一段视频，复刻精彩动作。",
    ),
)

pipeline = get_pipeline("action_transfer")
core = get_core()
pipeline.render(core)
