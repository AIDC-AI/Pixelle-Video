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


def render_style_config(
    pixelle_video,
    key_prefix: str = "",
    force_template_type: str | None = None,
    show_tts: bool = True,
):
    """Render style configuration section (middle column)

    Args:
        pixelle_video: Pixelle core instance
        key_prefix: Prefix for Streamlit widget keys (to avoid conflicts across pipelines)
        force_template_type: If provided, can be used to lock template type (e.g. "video")
        show_tts: Whether to render the TTS configuration panel.
                  For Sora pipeline we hide it and rely on default config.
    """
    # Helper for namespacing widget keys across different pipelines
    def kp(name: str) -> str:
        return f"{key_prefix}{name}" if key_prefix else name
    # ================================================================
    # TTS Section (can be hidden for Sora pipeline)
    # ================================================================
    comfyui_config = config_manager.get_comfyui_config()
    tts_config = comfyui_config["tts"]
    # Defaults in case we don't render any widgets
    # If show_tts=False, set tts_mode to None to skip TTS generation
    tts_mode = None if not show_tts else tts_config.get("inference_mode", "local")
    selected_voice = None
    tts_speed = None
    tts_workflow_key = None
    ref_audio_path = None

    if show_tts:
        with st.container(border=True):
            st.markdown(f"**{tr('section.tts')}**")
            
            with st.expander(tr("help.feature_description"), expanded=False):
                st.markdown(f"**{tr('help.what')}**")
                st.markdown(tr("tts.what"))
                st.markdown(f"**{tr('help.how')}**")
                st.markdown(tr("tts.how"))
            
            # Inference mode selection
            tts_mode = st.radio(
                tr("tts.inference_mode"),
                ["local", "comfyui"],
                horizontal=True,
                format_func=lambda x: tr(f"tts.mode.{x}"),
                index=0 if tts_config.get("inference_mode", "local") == "local" else 1,
                key=kp("tts_inference_mode"),
            )
            
            # Show hint based on mode
            if tts_mode == "local":
                st.caption(tr("tts.mode.local_hint"))
            else:
                st.caption(tr("tts.mode.comfyui_hint"))
            
            # ============================================================
            # Local Mode UI
            # ============================================================
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
                        key=kp("tts_local_voice"),
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
                        key=kp("tts_local_speed"),
                    )
                    st.caption(tr("tts.speed_label", speed=f"{tts_speed:.1f}"))
                
                # Variables for video generation
                tts_workflow_key = None
                ref_audio_path = None
            
            # ============================================================
            # ComfyUI Mode UI
            # ============================================================
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
                    key=kp("tts_workflow_select"),
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
                    key=kp("ref_audio_upload"),
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
                key=kp("tts_preview_text"),
            )
            
            # Preview button
            if st.button(tr("tts.preview_button"), key=kp("preview_tts"), use_container_width=True):
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
    
    def get_template_preview_path(template_path: str, language: str = "zh_CN") -> str:
        """
        Get the preview image path for a template based on language.
        
        Args:
            template_path: Template path like "1080x1920/image_default.html"
            language: Language code, either "zh_CN" or "en"
            
        Returns:
            Path to preview image in docs/images/
        """
        # Extract size and template name from path
        # e.g., "1080x1920/image_default.html" -> size="1080x1920", name="image_default"
        path_parts = template_path.split('/')
        if len(path_parts) >= 2:
            size = path_parts[0]  # e.g., "1080x1920"
            template_file = path_parts[1]  # e.g., "image_default.html"
            template_name = template_file.replace('.html', '')  # e.g., "image_default"
            
            # Build preview image path
            # Format: docs/images/{size}/{template_name}.jpg or {template_name}_en.jpg
            # Chinese uses Chinese preview, all other languages use English preview for better i18n
            suffix = "" if language == "zh_CN" else "_en"
            
            # Try different image extensions
            for ext in ['.jpg', '.png']:
                preview_path = f"docs/images/{size}/{template_name}{suffix}{ext}"
                if os.path.exists(preview_path):
                    return preview_path
            
            # Fallback: try without language suffix (for templates with only one version)
            for ext in ['.jpg', '.png']:
                preview_path = f"docs/images/{size}/{template_name}{ext}"
                if os.path.exists(preview_path):
                    return preview_path
        
        # If no preview found, return empty string
        return ""
    
    # Sora pipeline: skip storyboard UI and use no template (no subtitles, no overlay)
    if force_template_type is not None and key_prefix == "sora_":
        # For Sora I2V, we don't want templates, subtitles, or overlays
        # Just use the raw video from I2V workflow
        frame_template = None
        custom_params_for_video = {}
        # Use default media size (will be determined from workflow or config)
        media_width = None
        media_height = None
        st.session_state["template_media_width"] = media_width
        st.session_state["template_media_height"] = media_height
        # Media type: video (since we're using I2V workflow)
        template_media_type = "video"
        template_requires_media = True
        st.session_state["template_media_type"] = template_media_type
        st.session_state["template_requires_media"] = template_requires_media
        st.session_state["template_requires_image"] = False
        # Do not expose custom params in Sora UI
        custom_values_for_video = {}
        selected_template_name = None
    else:
        # Default pipelines: full storyboard template UI
        with st.container(border=True):
            st.markdown(f"**{tr('section.template')}**")
        
        with st.expander(tr("help.feature_description"), expanded=False):
            st.markdown(f"**{tr('help.what')}**")
            st.markdown(tr("template.what"))
            st.markdown(f"**{tr('help.how')}**")
            st.markdown(tr("template.how"))
        
        # Template preview link (based on language)
        current_lang = get_language()
        
        # Import template utilities
        from pixelle_video.utils.template_util import get_templates_grouped_by_size_and_type, get_template_type
        
        # Template type selector
        st.markdown(f"**{tr('template.type_selector')}**")
        
        template_type_options = {
            'static': tr('template.type.static'),
            'image': tr('template.type.image'),
            'video': tr('template.type.video')
        }
        
        # For Sora pipeline we force video type and hide the switch,
        # while for other pipelines we keep the full selector.
        if force_template_type is not None:
            selected_template_type = force_template_type
            # Show read-only label instead of interactive radio
            label = template_type_options.get(force_template_type, force_template_type)
            st.markdown(f"✅ {label}")
        else:
            # Radio buttons in horizontal layout
            selected_template_type = st.radio(
                tr('template.type_selector'),
                options=list(template_type_options.keys()),
                format_func=lambda x: template_type_options[x],
                index=1,  # Default to 'image'
                key=kp("template_type_selector"),
                label_visibility="collapsed",
                horizontal=True,
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
        
        # Build orientation i18n mapping
        ORIENTATION_I18N = {
            'portrait': tr('orientation.portrait'),
            'landscape': tr('orientation.landscape'),
            'square': tr('orientation.square')
        }
        
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
        
        # Initialize selected template in session state if not exists
        if 'selected_template' not in st.session_state:
            st.session_state['selected_template'] = type_specific_default
        
        # Track last selected template type to detect type changes
        last_template_type = st.session_state.get('last_template_type', None)
        if last_template_type != selected_template_type:
            # Template type changed, reset to type-specific default
            st.session_state['selected_template'] = type_specific_default
            st.session_state['last_template_type'] = selected_template_type
        
        # Collect size groups and prepare tabs
        size_groups = []
        size_labels = []
        
        for size, templates in grouped_templates.items():
            if not templates:
                continue
            
            # Filter templates to only include those with proper naming convention
            # Only show templates starting with static_, image_, or video_
            valid_templates = []
            for template in templates:
                template_name = template.display_info.name
                if template_name.startswith(('static_', 'image_', 'video_')):
                    valid_templates.append(template)
            
            # Skip if no valid templates after filtering
            if not valid_templates:
                continue
            
            # Separate templates into two groups: with preview and without preview
            templates_with_preview = []
            templates_without_preview = []
            
            for template in valid_templates:
                preview_path = get_template_preview_path(template.template_path, current_lang)
                if preview_path and os.path.exists(preview_path):
                    templates_with_preview.append(template)
                else:
                    templates_without_preview.append(template)
            
            # Skip this group if no templates at all
            if not templates_with_preview and not templates_without_preview:
                continue
            
            # Combine: templates with preview first, then without preview
            all_templates = templates_with_preview + templates_without_preview
            
            # Get orientation from first template in group
            orientation = ORIENTATION_I18N.get(
                all_templates[0].display_info.orientation, 
                all_templates[0].display_info.orientation
            )
            width = all_templates[0].display_info.width
            height = all_templates[0].display_info.height
            
            # Create tab label
            tab_label = f"{orientation} {width}×{height}"
            size_labels.append(tab_label)
            size_groups.append(all_templates)
        
        # Create tabs for each size group (wrapped in expander)
        with st.expander(tr("template.gallery_view"), expanded=True):
            if size_groups:
                tabs = st.tabs(size_labels)
                
                for tab, all_templates in zip(tabs, size_groups):
                    with tab:
                        # Create grid layout (5 columns)
                        num_cols = 5
                        cols = st.columns(num_cols)
                        
                        for idx, template in enumerate(all_templates):
                            col_idx = idx % num_cols
                            with cols[col_idx]:
                                # Get preview image path
                                preview_path = get_template_preview_path(template.template_path, current_lang)
                                
                                # Display preview image or placeholder
                                if preview_path and os.path.exists(preview_path):
                                    st.image(preview_path, use_container_width=True)
                                else:
                                    # Placeholder for templates without preview (fixed height, compact layout)
                                    st.markdown(
                                        f"""
                                        <div style="
                                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                            height: 150px;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            text-align: center;
                                            border-radius: 8px;
                                            color: white;
                                            margin-bottom: 15px;
                                            padding: 10px;
                                        ">
                                            <div style="
                                                font-size: 14px; 
                                                opacity: 0.95;
                                                overflow: hidden;
                                                text-overflow: ellipsis;
                                                display: -webkit-box;
                                                -webkit-line-clamp: 5;
                                                -webkit-box-orient: vertical;
                                                word-break: break-all;
                                            ">{template.display_info.name}</div>
                                        </div>
                                        """,
                                        unsafe_allow_html=True
                                    )
                                
                                # Select button (unified label)
                                is_selected = (st.session_state['selected_template'] == template.template_path)
                                button_label = f"{tr('template.selected')}" if is_selected else tr('template.select_button')
                                button_type = "primary" if is_selected else "secondary"
                                
                                if st.button(
                                    button_label,
                                    key=kp(f"template_{template.template_path}"),
                                    use_container_width=True,
                                    type=button_type,
                                ):
                                    st.session_state['selected_template'] = template.template_path
                                    st.rerun()
            else:
                st.warning(tr("template.no_templates_with_preview"))
            
            # Display selected template name (inside expander, below tabs)
            frame_template = st.session_state['selected_template']
            
            # Find the selected template's display name
            selected_template_name = None
            for size, templates in grouped_templates.items():
                for template in templates:
                    if template.template_path == frame_template:
                        selected_template_name = template.display_info.name
                        break
                if selected_template_name:
                    break
            
        if selected_template_name:
            st.info(f"📋 {tr('template.selected_template')}: **{selected_template_name}**")
        

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
                            key=kp(f"video_custom_{param_name}"),
                        )
                    elif param_type == 'number':
                        custom_values_for_video[param_name] = st.number_input(
                            label,
                            value=default,
                            key=kp(f"video_custom_{param_name}"),
                        )
                    elif param_type == 'color':
                        custom_values_for_video[param_name] = st.color_picker(
                            label,
                            value=default,
                            key=kp(f"video_custom_{param_name}"),
                        )
                    elif param_type == 'bool':
                        custom_values_for_video[param_name] = st.checkbox(
                            label,
                            value=default,
                            key=kp(f"video_custom_{param_name}"),
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
                            key=kp(f"video_custom_{param_name}"),
                        )
                    elif param_type == 'number':
                        custom_values_for_video[param_name] = st.number_input(
                            label,
                            value=default,
                            key=kp(f"video_custom_{param_name}"),
                        )
                    elif param_type == 'color':
                        custom_values_for_video[param_name] = st.color_picker(
                            label,
                            value=default,
                            key=kp(f"video_custom_{param_name}"),
                        )
                    elif param_type == 'bool':
                        custom_values_for_video[param_name] = st.checkbox(
                            label,
                            value=default,
                            key=kp(f"video_custom_{param_name}"),
                        )
        
        # Template preview expander
        with st.expander(tr("template.preview_title"), expanded=False):
            col1, col2 = st.columns(2)
            
            with col1:
                preview_title = st.text_input(
                    tr("template.preview_param_title"), 
                    value=tr("template.preview_default_title"),
                    key=kp("preview_title"),
                )
                preview_image = st.text_input(
                    tr("template.preview_param_image"), 
                    value="resources/example.png",
                    help=tr("template.preview_image_help"),
                    key=kp("preview_image"),
                )
            
            with col2:
                preview_text = st.text_area(
                    tr("template.preview_param_text"), 
                    value=tr("template.preview_default_text"),
                    height=100,
                    key=kp("preview_text"),
                )
            
            # Info: Size is auto-determined from template
            from pixelle_video.utils.template_util import parse_template_size, resolve_template_path
            template_width, template_height = parse_template_size(resolve_template_path(frame_template))
            st.info(f"📐 {tr('template.size_info')}: {template_width} × {template_height}")
            
            # Preview button
            if st.button(tr("template.preview_button"), key=kp("btn_preview_template"), use_container_width=True):
                with st.spinner(tr("template.preview_generating")):
                    try:
                        from pixelle_video.services.frame_html import HTMLFrameGenerator

                        # Use the currently selected template (size is auto-parsed)
                        from pixelle_video.utils.template_util import resolve_template_path
                        template_path = resolve_template_path(frame_template)
                        generator = HTMLFrameGenerator(template_path)
                        
                        # Build ext dict with auto-injected parameters (same as FrameProcessor)
                        ext = {
                            "index": 1,  # Preview uses index 1
                        }
                        
                        # Add custom parameters from user input
                        if custom_values_for_video:
                            ext.update(custom_values_for_video)
                        
                        # Generate preview
                        preview_path = run_async(generator.generate_frame(
                            title=preview_title,
                            text=preview_text,
                            image=preview_image,
                            ext=ext
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
                # Only show video_ and i2v_ workflows
                workflows = [wf for wf in all_workflows if "video_" in wf["key"].lower() or "i2v_" in wf["key"].lower()]
            else:
                # Only show image_ workflows (exclude video_ and i2v_)
                workflows = [wf for wf in all_workflows if "video_" not in wf["key"].lower() and "i2v_" not in wf["key"].lower()]
        
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
                key=kp("media_workflow_select"),
            )
        
            # Get the actual workflow key (e.g., "runninghub/image_flux.json")
            if workflow_options:
                # Guard against inconsistent session state where the stored
                # selection is not in the current options list.
                if workflow_display not in workflow_options:
                    workflow_selected_index = 0
                    workflow_display = workflow_options[0]
                else:
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
        
            # Check if selected workflow is I2V (image-to-video)
            is_i2v_workflow = "i2v_" in workflow_key.lower() if workflow_key else False
            
            # I2V: Show source image URL input
            source_image_url = None
            if is_i2v_workflow:
                st.markdown(f"**🖼️ {tr('style.source_image')}**")
                # Get existing value from session_state to preserve user input
                existing_url = st.session_state.get(kp("i2v_source_image_url"), "")
                source_image_url = st.text_input(
                    tr('style.source_image_url'),
                    value=existing_url,  # Use existing value to preserve user input
                    placeholder="https://example.com/image.jpg",
                    help=tr('style.source_image_help'),
                    key=kp("i2v_source_image_url"),
                )
                
                # Show preview if URL provided
                if source_image_url:
                    try:
                        st.image(source_image_url, use_container_width=True)
                    except Exception:
                        st.caption(tr('style.source_image_preview_failed'))
                else:
                    st.warning(tr('style.source_image_required'))
            
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
                help=tr("style.prompt_prefix_help"),
                key=kp("prompt_prefix"),
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
                    key=kp("style_test_prompt"),
                )
            
                # Preview button
                preview_button_label = tr("style.video_preview") if template_media_type == "video" else tr("style.preview")
                if st.button(preview_button_label, key=kp("preview_style"), use_container_width=True):
                    previewing_text = tr("style.video_previewing") if template_media_type == "video" else tr("style.previewing")
                    with st.spinner(previewing_text):
                        try:
                            from pixelle_video.utils.prompt_helper import build_image_prompt
                        
                            # Build final prompt with prefix
                            final_prompt = build_image_prompt(test_prompt, prompt_prefix)
                        
                            # Prepare media call parameters
                            media_params = {
                                "prompt": final_prompt,
                                "workflow": workflow_key,
                                "media_type": template_media_type,
                                "width": int(media_width),
                                "height": int(media_height)
                            }
                            
                            # Add image_url for I2V workflows
                            # Use current input value first, then fallback to session state
                            current_source_url = source_image_url if source_image_url else st.session_state.get(kp('i2v_source_image_url'), None)
                            if is_i2v_workflow and current_source_url:
                                media_params["image_url"] = current_source_url
                            
                            # Generate preview media (use user-specified size and media type)
                            media_result = run_async(pixelle_video.media(**media_params))
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
    
    # Get source_image_url from session state
    # st.text_input automatically saves to session_state, so we can always read from there
    session_key = kp('i2v_source_image_url')
    current_source_url = st.session_state.get(session_key, None)
    # Normalize empty string to None
    if current_source_url == "":
        current_source_url = None
    
    # Debug: Log the source_image_url value
    if current_source_url:
        logger.info(f"📸 Retrieved source_image_url from session state (key={session_key}): {current_source_url}")
    else:
        logger.warning(f"📸 No source_image_url in session state (key={session_key}). Available keys with 'i2v': {[k for k in st.session_state.keys() if 'i2v' in k.lower()]}")
    
    # Return all style configuration parameters
    return {
        "tts_inference_mode": tts_mode,  # None if show_tts=False, otherwise "local" or "comfyui"
        "tts_voice": selected_voice if tts_mode == "local" else None,
        "tts_speed": tts_speed if tts_mode == "local" else None,
        "tts_workflow": tts_workflow_key if tts_mode == "comfyui" else None,
        "ref_audio": str(ref_audio_path) if ref_audio_path else None,
        "frame_template": frame_template,
        "template_params": custom_values_for_video if custom_values_for_video else None,
        "media_workflow": workflow_key,
        "prompt_prefix": prompt_prefix if prompt_prefix else "",
        "media_width": media_width,
        "media_height": media_height,
        "source_image_url": current_source_url  # Already normalized to None if empty
    }
