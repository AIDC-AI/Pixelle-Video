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
Style configuration components for web UI (middle column)
"""

import os
from pathlib import Path

import streamlit as st
from loguru import logger

from web.i18n import tr, get_language
from web.utils.async_helpers import run_async
from pixelle_video.config import config_manager


def render_style_config(pixelle_video):
    """Render style configuration section (middle column)"""
    # TTS Section (moved from left column)
    # ====================================================================
    with st.container(border=True):
        st.markdown(f"**{tr('section.tts')}**")
        
        with st.expander(tr("help.feature_description"), expanded=False):
            st.markdown(f"**{tr('help.what')}**")
            st.markdown(tr("tts.what"))
            st.markdown(f"**{tr('help.how')}**")
            st.markdown(tr("tts.how"))
        
        # Get TTS config
        comfyui_config = config_manager.get_comfyui_config()
        tts_config = comfyui_config["tts"]
        
        # Inference mode selection
        tts_mode = st.radio(
            tr("tts.inference_mode"),
            ["local", "comfyui"],
            horizontal=True,
            format_func=lambda x: tr(f"tts.mode.{x}"),
            index=0 if tts_config.get("inference_mode", "local") == "local" else 1,
            key="tts_inference_mode"
        )
        
        # Show hint based on mode
        if tts_mode == "local":
            st.caption(tr("tts.mode.local_hint"))
        else:
            st.caption(tr("tts.mode.comfyui_hint"))
        
        # ================================================================
        # Local Mode UI
        # ================================================================
        if tts_mode == "local":
            # Import voice configuration
            from pixelle_video.tts_voices import EDGE_TTS_VOICES, get_voice_display_name
            
            # Get saved voice from config
            local_config = tts_config.get("local", {})
            saved_voice = local_config.get("voice", "zh-CN-YunjianNeural")
            saved_speed = local_config.get("speed", 1.2)
            
            # Build voice options with i18n
            voice_options = []
            voice_ids = []
            default_voice_index = 0
            
            for idx, voice_config in enumerate(EDGE_TTS_VOICES):
                voice_id = voice_config["id"]
                display_name = get_voice_display_name(voice_id, tr, get_language())
                voice_options.append(display_name)
                voice_ids.append(voice_id)
                
                # Set default index if matches saved voice
                if voice_id == saved_voice:
                    default_voice_index = idx
            
            # Two-column layout: Voice | Speed
            voice_col, speed_col = st.columns([1, 1])
            
            with voice_col:
                # Voice selector
                selected_voice_display = st.selectbox(
                    tr("tts.voice_selector"),
                    voice_options,
                    index=default_voice_index,
                    key="tts_local_voice"
                )
                
                # Get actual voice ID
                selected_voice_index = voice_options.index(selected_voice_display)
                selected_voice = voice_ids[selected_voice_index]
            
            with speed_col:
                # Speed slider
                tts_speed = st.slider(
                    tr("tts.speed"),
                    min_value=0.5,
                    max_value=2.0,
                    value=saved_speed,
                    step=0.1,
                    format="%.1fx",
                    key="tts_local_speed"
                )
                st.caption(tr("tts.speed_label", speed=f"{tts_speed:.1f}"))
            
            # Variables for video generation
            tts_workflow_key = None
            ref_audio_path = None
        
        # ================================================================
        # ComfyUI Mode UI
        # ================================================================
        else:  # comfyui mode
            # Get available TTS workflows
            tts_workflows = pixelle_video.tts.list_workflows()
            
            # Build options for selectbox
            tts_workflow_options = [wf["display_name"] for wf in tts_workflows]
            tts_workflow_keys = [wf["key"] for wf in tts_workflows]
            
            # Default to saved workflow if exists
            default_tts_index = 0
            saved_tts_workflow = tts_config.get("comfyui", {}).get("default_workflow")
            if saved_tts_workflow and saved_tts_workflow in tts_workflow_keys:
                default_tts_index = tts_workflow_keys.index(saved_tts_workflow)
            
            tts_workflow_display = st.selectbox(
                "TTS Workflow",
                tts_workflow_options if tts_workflow_options else ["No TTS workflows found"],
                index=default_tts_index,
                label_visibility="collapsed",
                key="tts_workflow_select"
            )
            
            # Get the actual workflow key
            if tts_workflow_options:
                tts_selected_index = tts_workflow_options.index(tts_workflow_display)
                tts_workflow_key = tts_workflow_keys[tts_selected_index]
            else:
                tts_workflow_key = "selfhost/tts_edge.json"  # fallback
            
            # Reference audio upload (optional, for voice cloning)
            ref_audio_file = st.file_uploader(
                tr("tts.ref_audio"),
                type=["mp3", "wav", "flac", "m4a", "aac", "ogg"],
                help=tr("tts.ref_audio_help"),
                key="ref_audio_upload"
            )
            
            # Save uploaded ref_audio to temp file if provided
            ref_audio_path = None
            if ref_audio_file is not None:
                # Audio preview player (directly play uploaded file)
                st.audio(ref_audio_file)
                
                # Save to temp directory
                temp_dir = Path("temp")
                temp_dir.mkdir(exist_ok=True)
                ref_audio_path = temp_dir / f"ref_audio_{ref_audio_file.name}"
                with open(ref_audio_path, "wb") as f:
                    f.write(ref_audio_file.getbuffer())
            
            # Variables for video generation
            selected_voice = None
            tts_speed = None
        
        # ================================================================
        # TTS Preview (works for both modes)
        # ================================================================
        with st.expander(tr("tts.preview_title"), expanded=False):
            # Preview text input
            preview_text = st.text_input(
                tr("tts.preview_text"),
                value="大家好，这是一段测试语音。",
                placeholder=tr("tts.preview_text_placeholder"),
                key="tts_preview_text"
            )
            
            # Preview button
            if st.button(tr("tts.preview_button"), key="preview_tts", use_container_width=True):
                with st.spinner(tr("tts.previewing")):
                    try:
                        # Build TTS params based on mode
                        tts_params = {
                            "text": preview_text,
                            "inference_mode": tts_mode
                        }
                        
                        if tts_mode == "local":
                            tts_params["voice"] = selected_voice
                            tts_params["speed"] = tts_speed
                        else:  # comfyui
                            tts_params["workflow"] = tts_workflow_key
                            if ref_audio_path:
                                tts_params["ref_audio"] = str(ref_audio_path)
                        
                        audio_path = run_async(pixelle_video.tts(**tts_params))
                        
                        # Play the audio
                        if audio_path:
                            st.success(tr("tts.preview_success"))
                            if os.path.exists(audio_path):
                                st.audio(audio_path, format="audio/mp3")
                            elif audio_path.startswith('http'):
                                st.audio(audio_path)
                            else:
                                st.error("Failed to generate preview audio")
                            
                            # Show file path
                            st.caption(f"📁 {audio_path}")
                        else:
                            st.error("Failed to generate preview audio")
                    except Exception as e:
                        st.error(tr("tts.preview_failed", error=str(e)))
                        logger.exception(e)
    
    # ====================================================================
    # Storyboard Template Section
    # ====================================================================
    with st.container(border=True):
        st.markdown(f"**{tr('section.template')}**")
        
        with st.expander(tr("help.feature_description"), expanded=False):
            st.markdown(f"**{tr('help.what')}**")
            st.markdown(tr("template.what"))
            st.markdown(f"**{tr('help.how')}**")
            st.markdown(tr("template.how"))
        
        # Template preview link (based on language)
        current_lang = get_language()
        if current_lang == "zh_CN":
            template_docs_url = "https://aidc-ai.github.io/Pixelle-Video/zh/user-guide/templates/#_3"
        else:
            template_docs_url = "https://aidc-ai.github.io/Pixelle-Video/user-guide/templates/#built-in-template-preview"
        
        st.markdown(f"🔗 [{tr('template.preview_link')}]({template_docs_url})")
        
        # Import template utilities
        from pixelle_video.utils.template_util import get_templates_grouped_by_size_and_type, get_template_type
        
        # Template type selector
        st.markdown(f"**{tr('template.type_selector')}**")
        
        template_type_options = {
            'static': tr('template.type.static'),
            'image': tr('template.type.image'),
            'video': tr('template.type.video')
        }
        
        # Radio buttons in horizontal layout
        selected_template_type = st.radio(
            tr('template.type_selector'),
            options=list(template_type_options.keys()),
            format_func=lambda x: template_type_options[x],
            index=1,  # Default to 'image'
            key="template_type_selector",
            label_visibility="collapsed",
            horizontal=True
        )
        
        # Display hint based on selected type (below radio buttons)
        if selected_template_type == 'static':
            st.info(tr('template.type.static_hint'))
        elif selected_template_type == 'image':
            st.info(tr('template.type.image_hint'))
        elif selected_template_type == 'video':
            st.info(tr('template.type.video_hint'))
        
        # Get templates grouped by size, filtered by selected type
        grouped_templates = get_templates_grouped_by_size_and_type(selected_template_type)
        
        if not grouped_templates:
            st.warning(f"No {template_type_options[selected_template_type]} templates found. Please select a different type or add templates.")
            st.stop()
        
        # Build display options with group separators
        ORIENTATION_I18N = {
            'portrait': tr('orientation.portrait'),
            'landscape': tr('orientation.landscape'),
            'square': tr('orientation.square')
        }
        
        display_options = []
        template_paths_ordered = []  # Use ordered list instead of dict to avoid key conflicts
        default_index = 0
        current_index = 0
        
        # Get default template from config
        template_config = pixelle_video.config.get("template", {})
        config_default_template = template_config.get("default_template", "1080x1920/image_default.html")

        # Backward compatibility
        if config_default_template == "1080x1920/default.html":
            config_default_template = "1080x1920/image_default.html"
        
        # Determine type-specific default template
        type_default_templates = {
            'static': '1080x1920/static_default.html',
            'image': '1080x1920/image_default.html',
            'video': '1080x1920/video_default.html'
        }
        type_specific_default = type_default_templates.get(selected_template_type, config_default_template)
        
        for size, templates in grouped_templates.items():
            if not templates:
                continue
            
            # Get orientation from first template in group
            orientation = ORIENTATION_I18N.get(
                templates[0].display_info.orientation, 
                templates[0].display_info.orientation
            )
            width = templates[0].display_info.width
            height = templates[0].display_info.height
            
            # Add group separator
            separator = f"─── {orientation} {width}×{height} ───"
            display_options.append(separator)
            template_paths_ordered.append(None)  # Separator has no template path
            current_index += 1
            
            # Add templates in this group
            for t in templates:
                display_name = f"  {t.display_info.name}"
                display_options.append(display_name)
                template_paths_ordered.append(t.template_path)  # Add to ordered list
                
                # Set default: priority is config > type-specific default > first in portrait
                if t.template_path == config_default_template:
                    default_index = current_index
                elif default_index == 0 and t.template_path == type_specific_default:
                    default_index = current_index
                elif default_index == 0 and t.display_info.orientation == 'portrait':
                    default_index = current_index
                
                current_index += 1
        
        # Dropdown with grouped display
        # Create unique display strings by appending hidden unique identifier
        # This ensures Streamlit doesn't confuse templates with same name in different groups
        unique_display_options = []
        for i, option in enumerate(display_options):
            # Add zero-width space characters as unique identifier (invisible to users)
            unique_option = option + ("\u200B" * i)  # \u200B is zero-width space
            unique_display_options.append(unique_option)
        
        selected_unique_option = st.selectbox(
            tr("template.select"),
            unique_display_options,
            index=default_index,
            label_visibility="collapsed",
            help=tr("template.select_help")
        )
        
        # Get index from selected unique option
        selected_index = unique_display_options.index(selected_unique_option)
        
        # Check if separator is selected (shouldn't happen, but handle it)
        if display_options[selected_index].startswith("───"):
            st.warning(tr("template.separator_selected"))
            st.stop()
        
        # Get full template path directly by index
        frame_template = template_paths_ordered[selected_index]
        
        # Display video size from template
        from pixelle_video.utils.template_util import parse_template_size
        video_width, video_height = parse_template_size(frame_template)
        st.caption(tr("template.video_size_info", width=video_width, height=video_height))
        
        # Custom template parameters (for video generation)
        from pixelle_video.services.frame_html import HTMLFrameGenerator
        # Resolve template path to support both data/templates/ and templates/
        from pixelle_video.utils.template_util import resolve_template_path
        template_path_for_params = resolve_template_path(frame_template)
        generator_for_params = HTMLFrameGenerator(template_path_for_params)
        custom_params_for_video = generator_for_params.parse_template_parameters()
        
        # Get media size from template (for image/video generation)
        media_width, media_height = generator_for_params.get_media_size()
        st.session_state['template_media_width'] = media_width
        st.session_state['template_media_height'] = media_height
        
        # Detect template media type
        from pixelle_video.utils.template_util import get_template_type
        
        template_name = Path(frame_template).name
        template_media_type = get_template_type(template_name)
        template_requires_media = (template_media_type in ["image", "video"])
        
        # Store in session state for workflow filtering
        st.session_state['template_media_type'] = template_media_type
        st.session_state['template_requires_media'] = template_requires_media
        
        # Backward compatibility
        st.session_state['template_requires_image'] = (template_media_type == "image")
        
        custom_values_for_video = {}
        if custom_params_for_video:
            st.markdown("📝 " + tr("template.custom_parameters"))
            
            # Render custom parameter inputs in 2 columns
            video_custom_col1, video_custom_col2 = st.columns(2)
            
            param_items = list(custom_params_for_video.items())
            mid_point = (len(param_items) + 1) // 2
            
            # Left column parameters
            with video_custom_col1:
                for param_name, config in param_items[:mid_point]:
                    param_type = config['type']
                    default = config['default']
                    label = config['label']
                    
                    if param_type == 'text':
                        custom_values_for_video[param_name] = st.text_input(
                            label,
                            value=default,
                            key=f"video_custom_{param_name}"
                        )
                    elif param_type == 'number':
                        custom_values_for_video[param_name] = st.number_input(
                            label,
                            value=default,
                            key=f"video_custom_{param_name}"
                        )
                    elif param_type == 'color':
                        custom_values_for_video[param_name] = st.color_picker(
                            label,
                            value=default,
                            key=f"video_custom_{param_name}"
                        )
                    elif param_type == 'bool':
                        custom_values_for_video[param_name] = st.checkbox(
                            label,
                            value=default,
                            key=f"video_custom_{param_name}"
                        )
            
            # Right column parameters
            with video_custom_col2:
                for param_name, config in param_items[mid_point:]:
                    param_type = config['type']
                    default = config['default']
                    label = config['label']
                    
                    if param_type == 'text':
                        custom_values_for_video[param_name] = st.text_input(
                            label,
                            value=default,
                            key=f"video_custom_{param_name}"
                        )
                    elif param_type == 'number':
                        custom_values_for_video[param_name] = st.number_input(
                            label,
                            value=default,
                            key=f"video_custom_{param_name}"
                        )
                    elif param_type == 'color':
                        custom_values_for_video[param_name] = st.color_picker(
                            label,
                            value=default,
                            key=f"video_custom_{param_name}"
                        )
                    elif param_type == 'bool':
                        custom_values_for_video[param_name] = st.checkbox(
                            label,
                            value=default,
                            key=f"video_custom_{param_name}"
                        )
        
        # Template preview expander
        with st.expander(tr("template.preview_title"), expanded=False):
            col1, col2 = st.columns(2)
            
            with col1:
                preview_title = st.text_input(
                    tr("template.preview_param_title"), 
                    value=tr("template.preview_default_title"),
                    key="preview_title"
                )
                preview_image = st.text_input(
                    tr("template.preview_param_image"), 
                    value="resources/example.png",
                    help=tr("template.preview_image_help"),
                    key="preview_image"
                )
            
            with col2:
                preview_text = st.text_area(
                    tr("template.preview_param_text"), 
                    value=tr("template.preview_default_text"),
                    height=100,
                    key="preview_text"
                )
            
            # Info: Size is auto-determined from template
            from pixelle_video.utils.template_util import parse_template_size, resolve_template_path
            template_width, template_height = parse_template_size(resolve_template_path(frame_template))
            st.info(f"📐 {tr('template.size_info')}: {template_width} × {template_height}")
            
            # Preview button
            if st.button(tr("template.preview_button"), key="btn_preview_template", use_container_width=True):
                with st.spinner(tr("template.preview_generating")):
                    try:
                        from pixelle_video.services.frame_html import HTMLFrameGenerator

                        # Use the currently selected template (size is auto-parsed)
                        from pixelle_video.utils.template_util import resolve_template_path
                        template_path = resolve_template_path(frame_template)
                        generator = HTMLFrameGenerator(template_path)
                        
                        # Generate preview (use custom parameters from video generation section)
                        preview_path = run_async(generator.generate_frame(
                            title=preview_title,
                            text=preview_text,
                            image=preview_image,
                            ext=custom_values_for_video if custom_values_for_video else None
                        ))
                        
                        # Display preview
                        if preview_path:
                            st.success(tr("template.preview_success"))
                            st.image(
                                preview_path, 
                                caption=tr("template.preview_caption", template=frame_template),
                            )
                            
                            # Show file path
                            st.caption(f"📁 {preview_path}")
                        else:
                            st.error("Failed to generate preview")
                            
                    except Exception as e:
                        st.error(tr("template.preview_failed", error=str(e)))
                        logger.exception(e)
    
    # ====================================================================
    # Media Generation Section (conditional based on template)
    # ====================================================================
    # Check if current template requires media generation
    template_media_type = st.session_state.get('template_media_type', 'image')
    template_requires_media = st.session_state.get('template_requires_media', True)
    
    if template_requires_media:
        # Template requires media - show Media Generation Section
        with st.container(border=True):
            # Dynamic section title based on template type
            if template_media_type == "video":
                section_title = tr('section.video')
            else:
                section_title = tr('section.image')
            
            st.markdown(f"**{section_title}**")
        
            # 1. ComfyUI Workflow selection
            with st.expander(tr("help.feature_description"), expanded=False):
                st.markdown(f"**{tr('help.what')}**")
                if template_media_type == "video":
                    st.markdown(tr('style.video_workflow_what'))
                else:
                    st.markdown(tr("style.workflow_what"))
                st.markdown(f"**{tr('help.how')}**")
                if template_media_type == "video":
                    st.markdown(tr('style.video_workflow_how'))
                else:
                    st.markdown(tr("style.workflow_how"))
        
            # Get available workflows and filter by template type
            all_workflows = pixelle_video.media.list_workflows()
            
            # Filter workflows based on template media type
            if template_media_type == "video":
                # Only show video_ workflows
                workflows = [wf for wf in all_workflows if "video_" in wf["key"].lower()]
            else:
                # Only show image_ workflows (exclude video_)
                workflows = [wf for wf in all_workflows if "video_" not in wf["key"].lower()]
        
            # Build options for selectbox
            # Display: "image_flux.json - Runninghub"
            # Value: "runninghub/image_flux.json"
            workflow_options = [wf["display_name"] for wf in workflows]
            workflow_keys = [wf["key"] for wf in workflows]
        
            # Default to first option (should be runninghub by sorting)
            default_workflow_index = 0
        
            # If user has a saved preference in config, try to match it
            comfyui_config = config_manager.get_comfyui_config()
            # Select config based on template type (image or video)
            media_config_key = "video" if template_media_type == "video" else "image"
            saved_workflow = comfyui_config.get(media_config_key, {}).get("default_workflow", "")
            if saved_workflow and saved_workflow in workflow_keys:
                default_workflow_index = workflow_keys.index(saved_workflow)
        
            workflow_display = st.selectbox(
                "Workflow",
                workflow_options if workflow_options else ["No workflows found"],
                index=default_workflow_index,
                label_visibility="collapsed",
                key="media_workflow_select"
            )
        
            # Get the actual workflow key (e.g., "runninghub/image_flux.json")
            if workflow_options:
                workflow_selected_index = workflow_options.index(workflow_display)
                workflow_key = workflow_keys[workflow_selected_index]
            else:
                workflow_key = "runninghub/image_flux.json"  # fallback
        
            # Get media size from template
            media_width = st.session_state.get('template_media_width')
            media_height = st.session_state.get('template_media_height')
            
            # Display media size info (read-only)
            if template_media_type == "video":
                size_info_text = tr('style.video_size_info', width=media_width, height=media_height)
            else:
                size_info_text = tr('style.image_size_info', width=media_width, height=media_height)
            st.info(f"📐 {size_info_text}")
        
            # Prompt prefix input
            # Get current prompt_prefix from config (based on media type)
            current_prefix = comfyui_config.get(media_config_key, {}).get("prompt_prefix", "")
        
            # Prompt prefix input (temporary, not saved to config)
            prompt_prefix = st.text_area(
                tr('style.prompt_prefix'),
                value=current_prefix,
                placeholder=tr("style.prompt_prefix_placeholder"),
                height=80,
                label_visibility="visible",
                help=tr("style.prompt_prefix_help")
            )
        
            # Media preview expander
            preview_title = tr("style.video_preview_title") if template_media_type == "video" else tr("style.preview_title")
            with st.expander(preview_title, expanded=False):
                # Test prompt input
                if template_media_type == "video":
                    test_prompt_label = tr("style.test_video_prompt")
                    test_prompt_value = "a dog running in the park"
                else:
                    test_prompt_label = tr("style.test_prompt")
                    test_prompt_value = "a dog"
                
                test_prompt = st.text_input(
                    test_prompt_label,
                    value=test_prompt_value,
                    help=tr("style.test_prompt_help"),
                    key="style_test_prompt"
                )
            
                # Preview button
                preview_button_label = tr("style.video_preview") if template_media_type == "video" else tr("style.preview")
                if st.button(preview_button_label, key="preview_style", use_container_width=True):
                    previewing_text = tr("style.video_previewing") if template_media_type == "video" else tr("style.previewing")
                    with st.spinner(previewing_text):
                        try:
                            from pixelle_video.utils.prompt_helper import build_image_prompt
                        
                            # Build final prompt with prefix
                            final_prompt = build_image_prompt(test_prompt, prompt_prefix)
                        
                            # Generate preview media (use user-specified size and media type)
                            media_result = run_async(pixelle_video.media(
                                prompt=final_prompt,
                                workflow=workflow_key,
                                media_type=template_media_type,
                                width=int(media_width),
                                height=int(media_height)
                            ))
                            preview_media_path = media_result.url
                        
                            # Display preview (support both URL and local path)
                            if preview_media_path:
                                success_text = tr("style.video_preview_success") if template_media_type == "video" else tr("style.preview_success")
                                st.success(success_text)
                            
                                if template_media_type == "video":
                                    # Display video
                                    st.video(preview_media_path)
                                else:
                                    # Display image
                                    if preview_media_path.startswith('http'):
                                        # URL - use directly
                                        img_html = f'<div class="preview-image"><img src="{preview_media_path}" alt="Style Preview"/></div>'
                                    else:
                                        # Local file - encode as base64
                                        with open(preview_media_path, 'rb') as f:
                                            img_data = base64.b64encode(f.read()).decode()
                                        img_html = f'<div class="preview-image"><img src="data:image/png;base64,{img_data}" alt="Style Preview"/></div>'
                                    
                                    st.markdown(img_html, unsafe_allow_html=True)
                            
                                # Show the final prompt used
                                st.info(f"**{tr('style.final_prompt_label')}**\n{final_prompt}")
                            
                                # Show file path
                                st.caption(f"📁 {preview_media_path}")
                            else:
                                st.error(tr("style.preview_failed_general"))
                        except Exception as e:
                            st.error(tr("style.preview_failed", error=str(e)))
                            logger.exception(e)
        
    
    else:
        # Template doesn't need images - show simplified message
        with st.container(border=True):
            st.markdown(f"**{tr('section.image')}**")
            st.info("ℹ️ " + tr("image.not_required"))
            st.caption(tr("image.not_required_hint"))
            
            # Get media size from template (even though not used, for consistency)
            media_width = st.session_state.get('template_media_width')
            media_height = st.session_state.get('template_media_height')
            
            # Set default values for later use
            workflow_key = None
            prompt_prefix = ""
    
    # Return all style configuration parameters
    return {
        "tts_inference_mode": tts_mode,
        "tts_voice": selected_voice if tts_mode == "local" else None,
        "tts_speed": tts_speed if tts_mode == "local" else None,
        "tts_workflow": tts_workflow_key if tts_mode == "comfyui" else None,
        "ref_audio": str(ref_audio_path) if ref_audio_path else None,
        "frame_template": frame_template,
        "template_params": custom_values_for_video if custom_values_for_video else None,
        "media_workflow": workflow_key,
        "prompt_prefix": prompt_prefix if prompt_prefix else "",
        "media_width": media_width,
        "media_height": media_height
    }
