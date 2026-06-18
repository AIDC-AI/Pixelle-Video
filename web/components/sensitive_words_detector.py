# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""Sensitive words AI detector component for web UI."""

from pathlib import Path

import streamlit as st

from pixelle_video.config import config_manager
from web.i18n import tr
from web.state.session import get_pixelle_video
from web.utils.async_helpers import run_async


def _get_sensitive_words_path() -> Path:
    """Get sensitive_words.md path from the active config manager."""
    path_getter = getattr(config_manager, "_sensitive_words_path", None)
    if callable(path_getter):
        return path_getter()

    config_path = Path(getattr(config_manager, "config_path", "config.yaml"))
    if not config_path.is_absolute():
        config_path = Path.cwd() / config_path
    return config_path.parent / "sensitive_words.md"


def read_sensitive_words_content(path: Path | None = None) -> str:
    """Read raw sensitive_words.md content for AI review."""
    words_path = path or _get_sensitive_words_path()
    if not words_path.exists():
        return ""
    return words_path.read_text(encoding="utf-8")


def build_sensitive_words_detection_prompt(document: str, sensitive_words_content: str) -> str:
    """Build the prompt used to ask the LLM for sensitive-word review."""
    rules_content = sensitive_words_content.strip()
    if not rules_content:
        rules_content = "sensitive_words.md 当前为空，请仅根据通用内容安全标准给出谨慎检测意见。"

    return f"""你是一个短视频脚本文案合规审核助手。请根据 sensitive_words.md 中的敏感词、说明和规则，对待检测文案进行审查。

审查要求：
1. 同时检查明确命中的敏感词、近义表达、变体表达和上下文风险。
2. 不要简单机械判定；如果词语在上下文中没有明显风险，请说明原因。
3. 给出可执行的修改建议，帮助用户将文案改成更稳妥的表达。
4. 只基于用户提供的文案输出检测结果，不要扩写无关内容。
5. 使用 Markdown 输出，并严格包含以下章节：

### 检测结论
- 风险等级：低/中/高
- 是否建议发布：是/否/修改后发布
- 简要结论：

### 命中/疑似风险点
| 原文片段 | 风险类型 | 原因 | 建议替换 |
| --- | --- | --- | --- |

### 检测意见
-

### 修改建议稿
如果需要修改，请给出一版更稳妥的改写；如果无需修改，请写“无需修改”。

<sensitive_words.md>
{rules_content}
</sensitive_words.md>

<待检测文案>
{document.strip()}
</待检测文案>
"""


async def detect_sensitive_words_with_ai(document: str, llm) -> str:
    """Detect sensitive words by sending document and rules to the configured LLM."""
    sensitive_words_content = read_sensitive_words_content()
    prompt = build_sensitive_words_detection_prompt(document, sensitive_words_content)
    return await llm(prompt=prompt, temperature=0.2, max_tokens=1600)


def render_sensitive_words_detector():
    """Render sensitive words AI detection panel."""
    with st.container(border=True):
        st.markdown(f"**{tr('sensitive_words_detector.card_title')}**")
        st.caption(tr("sensitive_words_detector.card_caption"))

        document = st.text_area(
            tr("sensitive_words_detector.input_label"),
            height=320,
            placeholder=tr("sensitive_words_detector.input_placeholder"),
            help=tr("sensitive_words_detector.input_help"),
            key="sensitive_words_detector_document",
        )

        if st.button(
            tr("sensitive_words_detector.detect_btn"),
            type="primary",
            key="sensitive_words_detector_detect_btn",
        ):
            if not document.strip():
                st.warning(tr("sensitive_words_detector.empty_input_warning"))
                return

            try:
                core = get_pixelle_video()
                with st.spinner(tr("sensitive_words_detector.detecting")):
                    result = run_async(detect_sensitive_words_with_ai(document, core.llm))
                st.session_state.sensitive_words_detector_result = result
            except Exception as e:
                st.error(f"{tr('sensitive_words_detector.detect_failed')}: {str(e)}")

        result = st.session_state.get("sensitive_words_detector_result")
        if result:
            st.divider()
            st.markdown(result)
