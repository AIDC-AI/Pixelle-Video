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
System settings component for web UI
"""

import streamlit as st

from web.i18n import tr, get_language
from web.utils.streamlit_helpers import safe_rerun
from pixelle_video.config import config_manager
from pixelle_video.utils.llm_connection import test_connection


def render_advanced_settings():
    """Render system configuration (required) with 2-column layout"""
    # Initialize session state for LLM connection test
    if "available_llm_models" not in st.session_state:
        st.session_state.available_llm_models = []
    if "llm_connection_tested" not in st.session_state:
        st.session_state.llm_connection_tested = False
    if "llm_connection_status" not in st.session_state:
        st.session_state.llm_connection_status = ""
    if "llm_manual_model_input" not in st.session_state:
        st.session_state.llm_manual_model_input = False

    # Check if system is configured
    is_configured = config_manager.validate()

    # Expand if not configured, collapse if configured
    with st.expander(tr("settings.title"), expanded=not is_configured):
        # 2-column layout: LLM | ComfyUI
        llm_col, comfyui_col = st.columns(2)

        # ====================================================================
        # Column 1: LLM Settings
        # ====================================================================
        with llm_col:
            with st.container(border=True):
                st.markdown(f"**{tr('settings.llm.title')}**")

                # Quick preset selection
                from pixelle_video.llm_presets import (
                    get_preset_names,
                    get_preset,
                    find_preset_by_base_url_and_model,
                    supports_connection_test,
                    requires_api_key,
                )
                
                # Custom at the end
                preset_names = get_preset_names() + ["Custom"]
                
                # Get current config
                current_llm = config_manager.get_llm_config()
                
                # Auto-detect which preset matches current config
                current_preset = find_preset_by_base_url_and_model(
                    current_llm["base_url"], 
                    current_llm["model"]
                )
                
                # Determine default index based on current config
                if current_preset:
                    # Current config matches a preset
                    default_index = preset_names.index(current_preset)
                else:
                    # Current config doesn't match any preset -> Custom
                    default_index = len(preset_names) - 1
                
                selected_preset = st.selectbox(
                    tr("settings.llm.quick_select"),
                    options=preset_names,
                    index=default_index,
                    help=tr("settings.llm.quick_select_help"),
                    key="llm_preset_select",
                )

                # Track preset changes to reset connection state
                if "llm_last_preset" not in st.session_state:
                    st.session_state.llm_last_preset = selected_preset
                elif st.session_state.llm_last_preset != selected_preset:
                    # Preset changed - reset connection state
                    st.session_state.llm_last_preset = selected_preset
                    st.session_state.available_llm_models = []
                    st.session_state.llm_connection_tested = False
                    st.session_state.llm_connection_status = ""
                    st.session_state.llm_manual_model_input = False

                # Auto-fill based on selected preset
                if selected_preset != "Custom":
                    # Preset selected
                    preset_config = get_preset(selected_preset)

                    # If user switched to a different preset (not current one), clear API key
                    # If it's the same as current config, keep API key
                    if selected_preset == current_preset:
                        # Same preset as saved config: keep API key
                        default_api_key = current_llm["api_key"]
                    else:
                        # Different preset: clear API key
                        default_api_key = ""

                    default_base_url = preset_config.get("base_url", "")
                    default_model = preset_config.get("model", "")
                    
                    # Show API key URL if available
                    if preset_config.get("api_key_url"):
                        st.markdown(f"🔑 [{tr('settings.llm.get_api_key')}]({preset_config['api_key_url']})")
                else:
                    # Custom: show current saved config (if any)
                    default_api_key = current_llm["api_key"]
                    default_base_url = current_llm["base_url"]
                    default_model = current_llm["model"]
                
                st.markdown("---")

                # Determine if API key is required for this preset
                api_key_required = requires_api_key(selected_preset)
                api_key_label = (
                    tr("settings.llm.api_key_optional")
                    if not api_key_required
                    else f"{tr('settings.llm.api_key')} *"
                )

                # API Key (use unique key to force refresh when switching preset)
                llm_api_key = st.text_input(
                    api_key_label,
                    value=default_api_key,
                    type="password",
                    help=tr("settings.llm.api_key_help"),
                    key=f"llm_api_key_input_{selected_preset}",
                )

                # Base URL (use unique key based on preset to force refresh)
                llm_base_url = st.text_input(
                    f"{tr('settings.llm.base_url')} *",
                    value=default_base_url,
                    help=tr("settings.llm.base_url_help"),
                    key=f"llm_base_url_input_{selected_preset}",
                )

                # Test Connection button for LLM
                # Show for: known presets that support it, OR Custom (assume OpenAI-compatible)
                show_test_button = supports_connection_test(selected_preset) or selected_preset == "Custom"
                if show_test_button:
                    if st.button(
                        tr("btn.test_connection"),
                        key="test_llm_connection",
                        use_container_width=True,
                    ):
                        # Reset previous state
                        st.session_state.available_llm_models = []
                        st.session_state.llm_connection_tested = False
                        st.session_state.llm_connection_status = ""
                        st.session_state.llm_manual_model_input = False

                        with st.spinner(tr("status.fetching_models")):
                            result = test_connection(
                                api_key=llm_api_key,
                                base_url=llm_base_url,
                                preset_name=selected_preset if selected_preset != "Custom" else None,
                            )

                        st.session_state.llm_connection_tested = True
                        if result.success:
                            st.session_state.available_llm_models = result.models
                            st.session_state.llm_connection_status = "success"
                            st.success(
                                tr("status.llm_connection_success").format(count=len(result.models))
                            )
                        else:
                            st.session_state.llm_connection_status = "failed"
                            st.error(f"{tr('status.llm_connection_failed')}: {result.message}")
                else:
                    # Claude or other non-supported presets
                    st.caption(f"ℹ️ {tr('settings.llm.test_not_supported')}")

                # Model selection: dropdown if models available, text input otherwise
                if (
                    st.session_state.llm_connection_tested
                    and st.session_state.llm_connection_status == "success"
                    and st.session_state.available_llm_models
                    and not st.session_state.llm_manual_model_input
                ):
                    # Show dropdown with fetched models
                    available_models = st.session_state.available_llm_models

                    # Determine default index: try to find current model in list
                    try:
                        default_idx = available_models.index(default_model)
                    except ValueError:
                        default_idx = 0

                    llm_model = st.selectbox(
                        f"{tr('settings.llm.select_model')} *",
                        options=available_models,
                        index=default_idx,
                        help=tr("settings.llm.model_help"),
                        key=f"llm_model_select_{selected_preset}",
                    )

                    # Option to switch to manual input
                    if st.checkbox(
                        tr("settings.llm.manual_model_input"),
                        value=False,
                        key="llm_switch_to_manual",
                    ):
                        st.session_state.llm_manual_model_input = True
                        safe_rerun()
                else:
                    # Default text input for model
                    llm_model = st.text_input(
                        f"{tr('settings.llm.model')} *",
                        value=default_model,
                        help=tr("settings.llm.model_help"),
                        key=f"llm_model_input_{selected_preset}",
                    )
        
        # ====================================================================
        # Column 2: ComfyUI Settings
        # ====================================================================
        with comfyui_col:
            with st.container(border=True):
                st.markdown(f"**{tr('settings.comfyui.title')}**")
                
                # Get current configuration
                comfyui_config = config_manager.get_comfyui_config()
                
                # Local/Self-hosted ComfyUI configuration
                st.markdown(f"**{tr('settings.comfyui.local_title')}**")
                comfyui_url = st.text_input(
                    tr("settings.comfyui.comfyui_url"),
                    value=comfyui_config.get("comfyui_url", "http://127.0.0.1:8188"),
                    help=tr("settings.comfyui.comfyui_url_help"),
                    key="comfyui_url_input"
                )
                
                # Test connection button
                if st.button(tr("btn.test_connection"), key="test_comfyui", use_container_width=True):
                    try:
                        import requests
                        response = requests.get(f"{comfyui_url}/system_stats", timeout=5)
                        if response.status_code == 200:
                            st.success(tr("status.connection_success"))
                        else:
                            st.error(tr("status.connection_failed"))
                    except Exception as e:
                        st.error(f"{tr('status.connection_failed')}: {str(e)}")
                
                st.markdown("---")
                
                # RunningHub cloud configuration
                st.markdown(f"**{tr('settings.comfyui.cloud_title')}**")
                runninghub_api_key = st.text_input(
                    tr("settings.comfyui.runninghub_api_key"),
                    value=comfyui_config.get("runninghub_api_key", ""),
                    type="password",
                    help=tr("settings.comfyui.runninghub_api_key_help"),
                    key="runninghub_api_key_input"
                )
                st.caption(
                    f"{tr('settings.comfyui.runninghub_hint')} "
                    f"[{tr('settings.comfyui.runninghub_get_api_key')}]"
                    f"(https://www.runninghub{'.cn' if get_language() == 'zh_CN' else '.ai'}/?inviteCode=bozpdlbj)"
                )
        
        # ====================================================================
        # Action Buttons (full width at bottom)
        # ====================================================================
        st.markdown("---")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button(tr("btn.save_config"), use_container_width=True, key="save_config_btn"):
                try:
                    # Save LLM configuration
                    # API key is optional for some providers (e.g., Ollama)
                    api_key_needed = requires_api_key(selected_preset)
                    can_save_llm = llm_base_url and llm_model and (llm_api_key or not api_key_needed)
                    if can_save_llm:
                        # Use empty string or "dummy-key" for providers that don't need API key
                        effective_api_key = llm_api_key if llm_api_key else "dummy-key"
                        config_manager.set_llm_config(effective_api_key, llm_base_url, llm_model)
                    
                    # Save ComfyUI configuration
                    config_manager.set_comfyui_config(
                        comfyui_url=comfyui_url if comfyui_url else None,
                        runninghub_api_key=runninghub_api_key if runninghub_api_key else None
                    )
                    
                    # Save to file
                    config_manager.save()
                    
                    st.success(tr("status.config_saved"))
                    safe_rerun()
                except Exception as e:
                    st.error(f"{tr('status.save_failed')}: {str(e)}")
        
        with col2:
            if st.button(tr("btn.reset_config"), use_container_width=True, key="reset_config_btn"):
                # Reset to default
                from pixelle_video.config.schema import PixelleVideoConfig
                config_manager.config = PixelleVideoConfig()
                config_manager.save()
                st.success(tr("status.config_reset"))
                safe_rerun()

