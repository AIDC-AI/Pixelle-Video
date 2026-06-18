# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""敏感词配置 page — configures sensitive words persisted to config.yaml."""

from web.components.sensitive_words import render_sensitive_words
from web.components.theme import render_section_title
from web.i18n import tr
from web.utils.page_bootstrap import bootstrap

bootstrap()

render_section_title(
    title=tr("sensitive_words.title", fallback="🛡️ 敏感词配置"),
    subtitle=tr(
        "sensitive_words.subtitle",
        fallback="配置需要过滤的敏感词列表，每行一个。",
    ),
)

render_sensitive_words()
