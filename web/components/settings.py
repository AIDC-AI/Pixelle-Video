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

from web.components.read_only import is_streamlit_read_only, read_only_notice
from web.i18n import tr, get_language
from web.utils.streamlit_helpers import safe_rerun
from pixelle_video.config import config_manager


def render_advanced_settings():
    """Render system configuration (required) with 2-column layout"""
    # Check if system is configured
    is_configured = config_manager.validate()
    is_read_only = is_streamlit_read_only()
    
    # Expand if not configured, collapse if configured
    with st.expander(tr("settings.title"), expanded=not is_configured):
        if is_read_only:
            st.info(read_only_notice())

        # 2-column layout: LLM | ComfyUI
        llm_col, comfyui_col = st.columns(2)
        
        # ====================================================================
        # Column 1: LLM Settings
        # ====================================================================
        with llm_col:
            with st.container(border=True):
                st.markdown(f"**{tr('settings.llm.title')}**")
                
                # Quick preset selection
                from pixelle_video.llm_presets import get_preset_names, get_preset, find_preset_by_base_url_and_model
                
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
                    disabled=is_read_only,
                )
                
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
                        # Different preset: use default_api_key if provided (e.g., Ollama), otherwise clear
                        default_api_key = preset_config.get("default_api_key", "")
                    
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
                
                # API Key (use unique key to force refresh when switching preset)
                llm_api_key = st.text_input(
                    f"{tr('settings.llm.api_key')} *",
                    value=default_api_key,
                    type="password",
                    help=tr("settings.llm.api_key_help"),
                    key=f"llm_api_key_input_{selected_preset}",
                    disabled=is_read_only,
                )
                
                # Base URL (use unique key based on preset to force refresh)
                llm_base_url = st.text_input(
                    f"{tr('settings.llm.base_url')} *",
                    value=default_base_url,
                    help=tr("settings.llm.base_url_help"),
                    key=f"llm_base_url_input_{selected_preset}",
                    disabled=is_read_only,
                )
                
                # Model selection with dropdown and load button
                # Initialize session state for loaded models
                if "llm_loaded_models" not in st.session_state:
                    st.session_state.llm_loaded_models = []
                
                # Build model options: Custom option + loaded models
                CUSTOM_MODEL_OPTION = f"✏️ {tr('settings.llm.custom_model')}"
                model_options = [CUSTOM_MODEL_OPTION] + st.session_state.llm_loaded_models
                
                # Determine default selection
                if default_model in st.session_state.llm_loaded_models:
                    default_model_index = model_options.index(default_model)
                else:
                    # Default model not in loaded list, use custom
                    default_model_index = 0
                
                # Model dropdown with load button on the right
                model_col, load_col, test_col = st.columns([3, 1, 1])
                
                with model_col:
                    selected_model_option = st.selectbox(
                        f"{tr('settings.llm.model')} *",
                        options=model_options,
                        index=default_model_index,
                        help=tr("settings.llm.model_help"),
                        key=f"llm_model_select_{selected_preset}",
                        disabled=is_read_only,
                    )
                
                with load_col:
                    st.markdown("<div style='height: 28px'></div>", unsafe_allow_html=True)
                    load_clicked = st.button(
                        f"🔄 {tr('settings.llm.load_models')}",
                        help=tr("settings.llm.load_models_help"),
                        key="load_models_btn",
                        use_container_width=True,
                        disabled=is_read_only,
                    )
                
                with test_col:
                    st.markdown("<div style='height: 28px'></div>", unsafe_allow_html=True)
                    test_clicked = st.button(
                        f"🔌 {tr('settings.llm.test_connection')}",
                        help=tr("settings.llm.test_connection_help"),
                        key="test_llm_connection_btn",
                        use_container_width=True,
                        disabled=is_read_only,
                    )
                
                # Handle load models button click
                if load_clicked:
                    if llm_api_key and llm_base_url:
                        try:
                            from pixelle_video.utils.llm_util import fetch_available_models
                            with st.spinner(tr("settings.llm.loading_models")):
                                models = fetch_available_models(llm_api_key, llm_base_url)
                                st.session_state.llm_loaded_models = models
                                st.success(tr("settings.llm.models_loaded").replace("{count}", str(len(models))))
                                safe_rerun()
                        except Exception as e:
                            st.error(tr("settings.llm.models_load_failed").replace("{error}", str(e)))
                    else:
                        st.warning(tr("status.llm_config_incomplete"))
                
                # Handle test connection button click
                if test_clicked:
                    if llm_api_key and llm_base_url:
                        try:
                            from pixelle_video.utils.llm_util import test_llm_connection
                            with st.spinner(tr("settings.llm.loading_models")):
                                success, message, model_count = test_llm_connection(llm_api_key, llm_base_url)
                                if success:
                                    st.success(tr("settings.llm.connection_success").replace("{count}", str(model_count)))
                                else:
                                    st.error(tr("settings.llm.connection_failed").replace("{error}", message))
                        except Exception as e:
                            st.error(tr("settings.llm.connection_failed").replace("{error}", str(e)))
                    else:
                        st.warning(tr("status.llm_config_incomplete"))
                
                # If custom option selected, show text input for custom model name
                if selected_model_option == CUSTOM_MODEL_OPTION:
                    llm_model = st.text_input(
                        tr("settings.llm.custom_model_input"),
                        value=default_model,
                        help=tr("settings.llm.model_help"),
                        key=f"llm_custom_model_input_{selected_preset}",
                        disabled=is_read_only,
                    )
                else:
                    llm_model = selected_model_option
        
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
                url_col, key_col = st.columns(2)
                with url_col:
                    comfyui_url = st.text_input(
                        tr("settings.comfyui.comfyui_url"),
                        value=comfyui_config.get("comfyui_url", "http://127.0.0.1:8188"),
                        help=tr("settings.comfyui.comfyui_url_help"),
                        key="comfyui_url_input",
                        disabled=is_read_only,
                    )
                with key_col:
                    comfyui_api_key = st.text_input(
                        tr("settings.comfyui.comfyui_api_key"),
                        value=comfyui_config.get("comfyui_api_key", ""),
                        type="password",
                        help=tr("settings.comfyui.comfyui_api_key_help"),
                        key="comfyui_api_key_input",
                        disabled=is_read_only,
                    )
                
                # Test connection button
                if st.button(
                    tr("btn.test_connection"),
                    key="test_comfyui",
                    use_container_width=True,
                    disabled=is_read_only,
                ):
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
                    key="runninghub_api_key_input",
                    disabled=is_read_only,
                )
                st.caption(
                    f"{tr('settings.comfyui.runninghub_hint')} "
                    f"[{tr('settings.comfyui.runninghub_get_api_key')}]"
                    f"(https://www.runninghub{'.cn' if get_language() == 'zh_CN' else '.ai'}/?inviteCode=bozpdlbj)"
                )
                
                # RunningHub concurrent limit and instance type (in one row)
                limit_col, instance_col = st.columns(2)
                with limit_col:
                    runninghub_concurrent_limit = st.number_input(
                        tr("settings.comfyui.runninghub_concurrent_limit"),
                        min_value=1,
                        max_value=10,
                        value=comfyui_config.get("runninghub_concurrent_limit", 1),
                        help=tr("settings.comfyui.runninghub_concurrent_limit_help"),
                        key="runninghub_concurrent_limit_input",
                        disabled=is_read_only,
                    )
                with instance_col:
                    # Check if instance type is "plus" (48G VRAM enabled)
                    current_instance_type = comfyui_config.get("runninghub_instance_type") or ""
                    is_plus_enabled = current_instance_type == "plus"
                    # Instance type options with i18n
                    instance_options = [
                        tr("settings.comfyui.runninghub_instance_24g"),
                        tr("settings.comfyui.runninghub_instance_48g"),
                    ]
                    runninghub_instance_type_display = st.selectbox(
                        tr("settings.comfyui.runninghub_instance_type"),
                        options=instance_options,
                        index=1 if is_plus_enabled else 0,
                        help=tr("settings.comfyui.runninghub_instance_type_help"),
                        key="runninghub_instance_type_input",
                        disabled=is_read_only,
                    )
                    # Convert display value back to actual value
                    runninghub_48g_enabled = runninghub_instance_type_display == tr("settings.comfyui.runninghub_instance_48g")
        
        # ====================================================================
        # Action Buttons (full width at bottom)
        # ====================================================================
        st.markdown("---")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button(
                tr("btn.save_config"),
                use_container_width=True,
                key="save_config_btn",
                disabled=is_read_only,
            ):
                try:
                    # Validate and save LLM configuration
                    if not (llm_api_key and llm_base_url and llm_model):
                        st.error(tr("status.llm_config_incomplete"))
                    else:
                        config_manager.set_llm_config(llm_api_key, llm_base_url, llm_model)
                    
                    # Save ComfyUI configuration (optional fields, always save what's provided)
                    # Convert checkbox to instance type: True -> "plus", False -> ""
                    instance_type = "plus" if runninghub_48g_enabled else ""
                    config_manager.set_comfyui_config(
                        comfyui_url=comfyui_url if comfyui_url else None,
                        comfyui_api_key=comfyui_api_key if comfyui_api_key else None,
                        runninghub_api_key=runninghub_api_key if runninghub_api_key else None,
                        runninghub_concurrent_limit=int(runninghub_concurrent_limit),
                        runninghub_instance_type=instance_type
                    )
                    
                    # Only save to file if LLM config is valid
                    if llm_api_key and llm_base_url and llm_model:
                        config_manager.save()
                        st.success(tr("status.config_saved"))
                        safe_rerun()
                except Exception as e:
                    st.error(f"{tr('status.save_failed')}: {str(e)}")
        
        with col2:
            if st.button(
                tr("btn.reset_config"),
                use_container_width=True,
                key="reset_config_btn",
                disabled=is_read_only,
            ):
                # Reset to default
                from pixelle_video.config.schema import PixelleVideoConfig
                config_manager.config = PixelleVideoConfig()
                config_manager.save()
                st.success(tr("status.config_reset"))
                safe_rerun()
