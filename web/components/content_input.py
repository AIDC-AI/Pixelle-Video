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
Content input components for web UI (left column)
"""

import shutil
import subprocess
from pathlib import Path

import httpx
import streamlit as st
from loguru import logger

from pixelle_video import __version__
from web.i18n import tr
from web.utils.async_helpers import get_project_version
from web.utils.streamlit_helpers import persistent_widget

# ponytail: single source of truth for the repo URL used by the version
# badge + update check. Bump this if the fork moves.
REPO_SLUG = "woaiACE/Pixelle-Video"


def _parse_version(v: str):
    """'v0.10.3' -> (0, 10, 3); unparseable segments become 0."""
    parts = []
    for x in (v or "").strip().lstrip("vV").split("."):
        try:
            parts.append(int(x))
        except ValueError:
            parts.append(0)
    return tuple(parts)


def check_for_update():
    """Query the fork's latest release tag, compare to local __version__.

    Returns (latest_tag, is_newer) or None on failure. Cached in
    session_state so the GitHub API is hit once per session, not per rerun.
    """
    cached = st.session_state.get("update_check")
    if cached is not None:
        return cached
    try:
        r = httpx.get(
            f"https://api.github.com/repos/{REPO_SLUG}/releases/latest",
            timeout=5,
            headers={"Accept": "application/vnd.github+json"},
        )
        r.raise_for_status()
        latest = r.json().get("tag_name", "")
        cached = (latest, _parse_version(latest) > _parse_version(__version__)) if latest else None
    except Exception as e:
        logger.debug(f"Update check failed: {e}")
        cached = None
    st.session_state["update_check"] = cached
    return cached


def _git(args, cwd, timeout=120):
    """Run a git command. Returns (returncode, combined_output)."""
    try:
        r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout + r.stderr).strip()
    except FileNotFoundError:
        return -1, "git not found"
    except subprocess.TimeoutExpired:
        return -1, "git timed out"


def _update_remote(root):
    """Resolve the git remote pointing at this fork (by URL substring).
    Returns remote name or None. Robust to origin/fork naming differences."""
    rc, out = _git(["remote", "-v"], root)
    if rc != 0:
        return None
    for line in out.splitlines():
        if REPO_SLUG in line:
            return line.split()[0]
    return None


def perform_update():
    """Source-install update: git fetch + ff-only merge + uv sync.

    Returns (ok: bool, message: str, log: list[str]).
    Refuses to touch a dirty working tree (data-loss guard); never resets.
    """
    root = Path(__file__).resolve().parents[2]
    log = []

    rc, _ = _git(["rev-parse", "--is-inside-work-tree"], root)
    if rc != 0:
        return False, tr("update.not_git"), log

    rc, out = _git(["status", "--porcelain"], root)
    if rc == 0 and out:
        return False, tr("update.dirty"), log

    remote = _update_remote(root)
    if not remote:
        return False, tr("update.no_remote").replace("{repo}", REPO_SLUG), log

    rc, branch = _git(["rev-parse", "--abbrev-ref", "HEAD"], root)
    if rc != 0 or branch in ("HEAD", ""):
        return False, tr("update.detached"), log

    log.append(f"$ git fetch {remote}")
    rc, out = _git(["fetch", remote], root)
    log.append(out)
    if rc != 0:
        return False, tr("update.fetch_failed"), log

    log.append(f"$ git merge --ff-only {remote}/{branch}")
    rc, out = _git(["merge", "--ff-only", f"{remote}/{branch}"], root)
    log.append(out)
    if rc != 0:
        return False, tr("update.diverged"), log

    already_new = "Already up to date" in out

    if shutil.which("uv"):
        log.append("$ uv sync")
        r = subprocess.run(["uv", "sync"], cwd=root, capture_output=True, text=True, timeout=600)
        log.append((r.stdout + r.stderr).strip())
        if r.returncode != 0:
            return False, tr("update.sync_failed"), log
    else:
        log.append("uv not in PATH, skipped uv sync")

    return True, (tr("update.already_latest") if already_new else tr("update.success")), log


def render_content_input():
    """Render content input section (left column) with batch support"""
    with st.container(border=True):
        st.markdown(f"**{tr('section.content_input')}**")
        
        # ====================================================================
        # Step 1: Batch mode toggle (highest priority)
        # ====================================================================
        batch_mode = persistent_widget(
            st.checkbox,
            "qc_batch_mode",
            False,
            label=tr("batch.mode_label"),
            help=tr("batch.mode_help"),
        )
        
        if not batch_mode:
            # ================================================================
            # Single task mode (original logic, unchanged)
            # ================================================================
            # Processing mode selection
            mode = persistent_widget(
                st.radio,
                "qc_mode",
                "generate",
                label="Processing Mode",
                options=["generate", "fixed"],
                horizontal=True,
                format_func=lambda x: tr(f"mode.{x}"),
                label_visibility="collapsed",
            )
            
            # Text input (unified for both modes)
            text_placeholder = tr("input.topic_placeholder") if mode == "generate" else tr("input.content_placeholder")
            text_height = 120 if mode == "generate" else 200
            text_help = tr("input.text_help_generate") if mode == "generate" else tr("input.text_help_fixed")
            
            text = persistent_widget(
                st.text_area,
                "qc_text",
                "",
                label=tr("input.text"),
                placeholder=text_placeholder,
                height=text_height,
                help=text_help,
            )
            
            # Split mode selector (only show in fixed mode)
            if mode == "fixed":
                split_mode_options = {
                    "paragraph": tr("split.mode_paragraph"),
                    "line": tr("split.mode_line"),
                    "sentence": tr("split.mode_sentence"),
                }
                split_mode = persistent_widget(
                    st.selectbox,
                    "qc_split_mode",
                    "paragraph",
                    label=tr("split.mode_label"),
                    options=list(split_mode_options.keys()),
                    format_func=lambda x: split_mode_options[x],
                    help=tr("split.mode_help"),
                )
            else:
                split_mode = "paragraph"  # Default for generate mode (not used)
            
            # Title input (optional for both modes)
            title = persistent_widget(
                st.text_input,
                "qc_title",
                "",
                label=tr("input.title"),
                placeholder=tr("input.title_placeholder"),
                help=tr("input.title_help"),
            )
            
            # Number of scenes (only show in generate mode)
            if mode == "generate":
                n_scenes = persistent_widget(
                    st.slider,
                    "qc_n_scenes",
                    5,
                    label=tr("video.frames"),
                    min_value=3,
                    max_value=30,
                    help=tr("video.frames_help"),
                    label_visibility="collapsed",
                )
                st.caption(tr("video.frames_label", n=n_scenes))
            else:
                # Fixed mode: n_scenes is ignored, set default value
                n_scenes = 5
                st.info(tr("video.frames_fixed_mode_hint"))
            
            return {
                "batch_mode": False,
                "mode": mode,
                "text": text,
                "title": title,
                "n_scenes": n_scenes,
                "split_mode": split_mode
            }
        
        else:
            # ================================================================
            # Batch mode (simplified YAGNI version)
            # ================================================================
            st.markdown(f"**{tr('batch.section_title')}**")
            
            # Batch rules info
            st.info(f"""
**{tr('batch.rules_title')}**
- ✅ {tr('batch.rule_1')}
- ✅ {tr('batch.rule_2')}
- ✅ {tr('batch.rule_3')}
            """)
            
            # Batch topics input
            text_input = persistent_widget(
                st.text_area,
                "qc_batch_topics",
                "",
                label=tr("batch.topics_label"),
                height=300,
                placeholder=tr("batch.topics_placeholder"),
                help=tr("batch.topics_help"),
            )
            
            # Split topics by newline
            if text_input:
                # Simple split by newline, filter empty lines
                topics = [
                    line.strip() 
                    for line in text_input.strip().split('\n') 
                    if line.strip()
                ]
                
                if topics:
                    # Check count limit
                    if len(topics) > 100:
                        st.error(tr("batch.count_error", count=len(topics)))
                        topics = []
                    else:
                        st.success(tr("batch.count_success", count=len(topics)))
                        
                        # Preview topics list
                        with st.expander(tr("batch.preview_title"), expanded=False):
                            for i, topic in enumerate(topics, 1):
                                st.markdown(f"`{i}.` {topic}")
                else:
                    topics = []
            else:
                topics = []
            
            st.markdown("---")
            
            # Title prefix (optional)
            title_prefix = persistent_widget(
                st.text_input,
                "qc_title_prefix",
                "",
                label=tr("batch.title_prefix_label"),
                placeholder=tr("batch.title_prefix_placeholder"),
                help=tr("batch.title_prefix_help"),
            )
            
            # Number of scenes (unified for all videos)
            n_scenes = persistent_widget(
                st.slider,
                "qc_batch_n_scenes",
                5,
                label=tr("batch.n_scenes_label"),
                min_value=3,
                max_value=30,
                help=tr("batch.n_scenes_help"),
            )
            st.caption(tr("batch.n_scenes_caption", n=n_scenes))
            
            # Config info
            st.info(f"📌 {tr('batch.config_info')}")
            
            return {
                "batch_mode": True,
                "topics": topics,
                "mode": "generate",  # Fixed to AI generate content
                "title_prefix": title_prefix,
                "n_scenes": n_scenes,
            }


def render_bgm_section(key_prefix=""):
    """Render BGM selection section"""
    with st.container(border=True):
        st.markdown(f"**{tr('section.bgm')}**")
        
        with st.expander(tr("help.feature_description"), expanded=False):
            st.markdown(f"**{tr('help.what')}**")
            st.markdown(tr("bgm.what"))
            st.markdown(f"**{tr('help.how')}**")
            st.markdown(tr("bgm.how"))
        
        # Dynamically scan bgm folder for music files (merged from bgm/ and data/bgm/)
        from pixelle_video.utils.os_util import list_resource_files
        
        try:
            all_files = list_resource_files("bgm")
            # Filter to audio files only
            audio_extensions = ('.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg')
            bgm_files = sorted([f for f in all_files if f.lower().endswith(audio_extensions)])
        except Exception as e:
            st.warning(f"Failed to load BGM files: {e}")
            bgm_files = []
        
        # Add special "None" option
        bgm_options = [tr("bgm.none")] + bgm_files
        
        # Default to "default.mp3" if exists, otherwise first option
        default_index = 0
        if "default.mp3" in bgm_files:
            default_index = bgm_options.index("default.mp3")
        
        bgm_choice = st.selectbox(
            "BGM",
            bgm_options,
            index=default_index,
            label_visibility="collapsed",
            key=f"{key_prefix}bgm_selector"
        )
        
        # BGM volume slider (only show when BGM is selected)
        if bgm_choice != tr("bgm.none"):
            bgm_volume = st.slider(
                tr("bgm.volume"),
                min_value=0.0,
                max_value=0.5,
                value=0.2,
                step=0.01,
                format="%.2f",
                key=f"{key_prefix}bgm_volume_slider",
                help=tr("bgm.volume_help")
            )
        else:
            bgm_volume = 0.2  # Default value when no BGM selected
        
        # BGM preview button (only if BGM is not "None")
        if bgm_choice != tr("bgm.none"):
            if st.button(tr("bgm.preview"), key=f"{key_prefix}preview_bgm", use_container_width=True):
                from pixelle_video.utils.os_util import get_resource_path, resource_exists
                try:
                    if resource_exists("bgm", bgm_choice):
                        bgm_file_path = get_resource_path("bgm", bgm_choice)
                        st.audio(bgm_file_path)
                    else:
                        st.error(tr("bgm.preview_failed", file=bgm_choice))
                except Exception as e:
                    st.error(f"{tr('bgm.preview_failed', file=bgm_choice)}: {e}")
        
        # Use full filename for bgm_path (including extension)
        bgm_path = None if bgm_choice == tr("bgm.none") else bgm_choice
    
    return {
        "bgm_path": bgm_path,
        "bgm_volume": bgm_volume
    }


def render_version_info(key_prefix: str = ""):
    """Render version info and GitHub link.

    key_prefix disambiguates widget keys because the Home page renders every
    pipeline tab in one script run, and each tab calls this function.
    """
    with st.container(border=True):
        st.markdown(f"**{tr('version.title')}**")
        version = get_project_version()
        github_url = f"https://github.com/{REPO_SLUG}"
        badge_url = f"https://img.shields.io/github/stars/{REPO_SLUG}"

        st.markdown(
            f'{tr("version.current")}: `{version}` &nbsp;&nbsp; '
            f'<a href="{github_url}" target="_blank">'
            f'<img src="{badge_url}" alt="GitHub stars" style="vertical-align: middle;">'
            f'</a>',
            unsafe_allow_html=True)

        update = check_for_update()
        if update and update[1]:
            latest = update[0]
            st.markdown(
                f'🆕 {tr("version.update_available")}: `{latest}` &nbsp; '
                f'<a href="https://github.com/{REPO_SLUG}/releases/latest" target="_blank">Download</a>',
                unsafe_allow_html=True)

        if st.button(tr("update.button"), key=f"{key_prefix}btn_check_update", use_container_width=True):
            with st.status(tr("update.running"), expanded=True) as status:
                ok, msg, log = perform_update()
                for line in log:
                    if line:
                        st.code(line)
                status.update(
                    label=tr("update.done") if ok else tr("update.failed"),
                    state="complete" if ok else "error",
                )
            if ok:
                st.success(msg)
            else:
                st.error(msg)

