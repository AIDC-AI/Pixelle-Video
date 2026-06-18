# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""素材成片 (asset-based / custom_media) page."""

import streamlit as st

from web.utils.page_bootstrap import bootstrap, get_pipeline, get_core
from web.components.theme import render_section_title
from web.i18n import tr

bootstrap()

render_section_title(
    title=f"🖼 {tr('pipeline.custom_media.name', fallback='素材成片')}",
    subtitle=tr(
        "pipeline.custom_media.description",
        fallback="上传你的图片或视频素材，AI 自动生成视频脚本与成片。",
    ),
)

pipeline = get_pipeline("custom_media")
core = get_core()
pipeline.render(core)
