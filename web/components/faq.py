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
FAQ component for displaying frequently asked questions
"""

import re
from pathlib import Path
from typing import Optional

import streamlit as st
from loguru import logger

from web.i18n import get_language, tr


def load_faq_content(language: str) -> Optional[str]:
    """
    Load FAQ content based on current language
    
    Args:
        language: Current language code (e.g., "zh_CN", "en_US")
    
    Returns:
        FAQ content as markdown string, or None if file not found
    """
    # Determine which FAQ file to load based on language
    # For Chinese (zh_CN), use FAQ_CN.md
    # For all other languages, use FAQ.md (English)
    project_root = Path(__file__).resolve().parent.parent.parent
    
    if language.startswith("zh"):
        faq_file = project_root / "docs" / "FAQ_CN.md"
    else:
        faq_file = project_root / "docs" / "FAQ.md"
    
    try:
        if faq_file.exists():
            with open(faq_file, "r", encoding="utf-8") as f:
                content = f.read()
            logger.debug(f"Loaded FAQ from: {faq_file}")
            return content
        else:
            logger.warning(f"FAQ file not found: {faq_file}")
            return None
    except Exception as e:
        logger.error(f"Failed to load FAQ file {faq_file}: {e}")
        return None


def parse_faq_sections(content: str) -> list[tuple[str, str]]:
    """
    Parse FAQ content into sections by ### headings
    
    Args:
        content: Raw markdown content
    
    Returns:
        List of (question, answer) tuples
    """
    # Remove the first main heading (starts with #, not ###)
    lines = content.split('\n')
    if lines and lines[0].startswith('#') and not lines[0].startswith('##'):
        content = '\n'.join(lines[1:])
    
    # Split by ### headings (top-level questions)
    # Pattern matches ### at start of line followed by question text
    pattern = r'^###\s+(.+?)$'
    
    sections = []
    current_question = None
    current_answer_lines = []
    
    for line in content.split('\n'):
        match = re.match(pattern, line)
        if match:
            # Save previous section if exists
            if current_question is not None:
                answer = '\n'.join(current_answer_lines).strip()
                sections.append((current_question, answer))
            # Start new section
            current_question = match.group(1).strip()
            current_answer_lines = []
        else:
            current_answer_lines.append(line)
    
    # Save last section
    if current_question is not None:
        answer = '\n'.join(current_answer_lines).strip()
        sections.append((current_question, answer))
    
    return sections


def render_faq_sidebar():
    """
    Render FAQ in the sidebar
    
    This component displays frequently asked questions in the sidebar,
    allowing users to quickly find answers without leaving the main interface.
    """
    with st.sidebar:
        # FAQ header with icon
        # st.markdown(f"### 🙋‍♀️ {tr('faq.title', fallback='FAQ')}")
        
        # Get current language
        current_language = get_language()
        
        # Load FAQ content
        faq_content = load_faq_content(current_language)
        
        if faq_content:
            # Display FAQ in an expander, expanded by default
            with st.expander(tr('faq.expand_to_view', fallback='FAQ'), expanded=True):
                # Parse FAQ into sections
                sections = parse_faq_sections(faq_content)
                
                # Display each question in its own collapsible expander
                for question, answer in sections:
                    with st.expander(question, expanded=False):
                        st.markdown(answer, unsafe_allow_html=True)
            
            # Add a link to GitHub issues for more help
            st.markdown(
                f"💡 {tr('faq.more_help', fallback='Need more help?')} "
                f"[GitHub Issues](https://github.com/woaiACE/Pixelle-Video/issues)"
            )
        else:
            # If FAQ cannot be loaded, only show the GitHub link
            st.markdown(f"### 💡 {tr('faq.more_help', fallback='Need help?')}")
            st.markdown(
                f"[GitHub Issues](https://github.com/woaiACE/Pixelle-Video/issues) | "
                f"[Documentation](https://aidc-ai.github.io/Pixelle-Video)"
            )
