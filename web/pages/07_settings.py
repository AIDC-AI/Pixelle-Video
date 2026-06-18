# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""系统配置 page — wraps the existing render_advanced_settings()."""

import streamlit as st

from web.utils.page_bootstrap import bootstrap
from web.components.theme import render_section_title
from web.components.settings import render_advanced_settings
from web.i18n import tr

bootstrap()

render_section_title(
    title=tr('settings.title', fallback='⚙️ 系统配置'),
    subtitle=tr(
        "settings.subtitle",
        fallback="配置 LLM、ComfyUI、API 提供商等参数。",
    ),
)

# The existing component already renders inside an expander; the page-level
# title above gives users clear context. Keep behavior 100% identical.
render_advanced_settings()
