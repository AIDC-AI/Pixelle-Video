# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""敏感词检测 page — checks scripts against sensitive_words.md with AI."""

from web.components.sensitive_words_detector import render_sensitive_words_detector
from web.components.theme import render_section_title
from web.i18n import tr
from web.utils.page_bootstrap import bootstrap

bootstrap()

render_section_title(
    title=tr("sensitive_words_detector.title", fallback="🧪 敏感词检测"),
    subtitle=tr(
        "sensitive_words_detector.subtitle",
        fallback="输入文案后，AI 将结合 sensitive_words.md 给出检测结果和修改意见。",
    ),
)

render_sensitive_words_detector()
