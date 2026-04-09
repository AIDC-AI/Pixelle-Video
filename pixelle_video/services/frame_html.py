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
HTML-based Frame Generator Service

Renders HTML templates to frame images with variable substitution

Linux Environment Requirements:
    - fontconfig package must be installed
    - Basic fonts (e.g., fonts-liberation, fonts-noto) recommended
    
    Ubuntu/Debian: sudo apt-get install -y fontconfig fonts-liberation fonts-noto-cjk
    CentOS/RHEL: sudo yum install -y fontconfig liberation-fonts google-noto-cjk-fonts
"""

from math import log
import os
import re
import sys
import uuid
from typing import Dict, Any, Optional
from pathlib import Path
from html2image import Html2Image
from loguru import logger
from PIL import Image

from pixelle_video.utils.template_util import parse_template_size


class HTMLFrameGenerator:
    """
    HTML-based frame generator
    
    Renders HTML templates to frame images with variable substitution.
    Users can create custom templates using any HTML/CSS.
    
    Usage:
        >>> generator = HTMLFrameGenerator("templates/modern.html")
        >>> frame_path = await generator.generate_frame(
        ...     topic="Why reading matters",
        ...     text="Reading builds new neural pathways...",
        ...     image="/path/to/image.png",
        ...     ext={"content_title": "Sample Title", "content_author": "Author Name"}
        ... )
    """
    
    # Workaround for Chromium screenshot height issue
    # Due to a Chromium bug that causes screenshots to be cropped at the bottom,
    # we temporarily render with extra height and then crop it back.
    # See: https://issues.chromium.org/issues/405165895
    # This is a temporary workaround until the issue is fixed in Chromium.
    CHROMIUM_HEIGHT_OFFSET = 87
    
    def __init__(self, template_path: str):
        """
        Initialize HTML frame generator
        
        Args:
            template_path: Path to HTML template file (e.g., "templates/1080x1920/default.html")
        """
        self.template_path = template_path
        self.template = self._load_template(template_path)
        
        # Parse video size from template path
        self.width, self.height = parse_template_size(template_path)
        
        self.hti = None  # Lazy init to avoid overhead
        self._check_linux_dependencies()
        logger.debug(f"Loaded HTML template: {template_path} (size: {self.width}x{self.height})")
    
    
    def _check_linux_dependencies(self):
        """Check Linux system dependencies and warn if missing"""
        if os.name != 'posix':
            return
        
        try:
            import subprocess
            
            # Check fontconfig
            result = subprocess.run(
                ['fc-list'], 
                capture_output=True, 
                timeout=2
            )
            
            if result.returncode != 0:
                logger.warning(
                    "⚠️  fontconfig not found or not working properly. "
                    "Install with: sudo apt-get install -y fontconfig fonts-liberation fonts-noto-cjk"
                )
            elif not result.stdout:
                logger.warning(
                    "⚠️  No fonts detected by fontconfig. "
                    "Install fonts with: sudo apt-get install -y fonts-liberation fonts-noto-cjk"
                )
            else:
                logger.debug(f"✓ Fontconfig detected {len(result.stdout.splitlines())} fonts")
                
        except FileNotFoundError:
            logger.warning(
                "⚠️  fontconfig (fc-list) not found on system. "
                "Install with: sudo apt-get install -y fontconfig"
            )
        except Exception as e:
            logger.debug(f"Could not check fontconfig status: {e}")
    
    def _load_template(self, template_path: str) -> str:
        """Load HTML template from file"""
        path = Path(template_path)
        if not path.exists():
            raise FileNotFoundError(f"Template not found: {template_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        logger.debug(f"Template loaded: {len(content)} chars")
        return content
    
    def _parse_media_size_from_meta(self) -> tuple[Optional[int], Optional[int]]:
        """
        Parse media size from meta tags in template
        
        Looks for meta tags:
        - <meta name="template:media-width" content="1024">
        - <meta name="template:media-height" content="1024">
        
        Returns:
            Tuple of (width, height) or (None, None) if not found
        """
        from bs4 import BeautifulSoup
        
        try:
            soup = BeautifulSoup(self.template, 'html.parser')
            
            # Find width and height meta tags
            width_meta = soup.find('meta', attrs={'name': 'template:media-width'})
            height_meta = soup.find('meta', attrs={'name': 'template:media-height'})
            
            if width_meta and height_meta:
                width = int(width_meta.get('content', 0))
                height = int(height_meta.get('content', 0))
                
                if width > 0 and height > 0:
                    logger.debug(f"Found media size in meta tags: {width}x{height}")
                    return width, height
            
            return None, None
            
        except Exception as e:
            logger.warning(f"Failed to parse media size from meta tags: {e}")
            return None, None
    
    def get_media_size(self) -> tuple[int, int]:
        """
        Get media size for image/video generation
        
        Returns media size specified in template meta tags.
        
        Returns:
            Tuple of (width, height)
        """
        media_width, media_height = self._parse_media_size_from_meta()
        
        if media_width and media_height:
            return media_width, media_height
        
        # Fallback to default if not specified (should not happen with properly configured templates)
        logger.warning(f"No media size meta tags found in template {self.template_path}, using fallback 1024x1024")
        return 1024, 1024
    
    def parse_template_parameters(self) -> Dict[str, Dict[str, Any]]:
        """
        Parse custom parameters from HTML template
        
        Supports syntax: {{param:type=default}}
        - {{param}} -> text type, no default
        - {{param=value}} -> text type, with default
        - {{param:type}} -> specified type, no default
        - {{param:type=value}} -> specified type, with default
        
        Supported types: text, number, color, bool
        
        Returns:
            Dictionary of custom parameters with their configurations:
            {
                'param_name': {
                    'type': 'text' | 'number' | 'color' | 'bool',
                    'default': Any,
                    'label': str  # same as param_name
                }
            }
        """
        # Preset parameters that should be ignored (auto-injected by system)
        PRESET_PARAMS = {'title', 'text', 'image', 'index'}
        
        # Pattern: {{param_name:type=default}} or {{param_name=default}} or {{param_name:type}} or {{param_name}}
        # Param name: must start with letter or underscore, can contain letters, digits, underscores
        PARAM_PATTERN = r'\{\{([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-z]+))?(?:=([^}]+))?\}\}'
        
        params = {}
        
        for match in re.finditer(PARAM_PATTERN, self.template):
            param_name = match.group(1)
            param_type = match.group(2) or 'text'  # Default to text
            default_value = match.group(3)
            
            # Skip preset parameters
            if param_name in PRESET_PARAMS:
                continue
            
            # Skip if already parsed (use first occurrence)
            if param_name in params:
                continue
            
            # Validate type
            if param_type not in {'text', 'number', 'color', 'bool'}:
                logger.warning(f"Unknown parameter type '{param_type}' for '{param_name}', defaulting to 'text'")
                param_type = 'text'
            
            # Parse default value based on type
            parsed_default = self._parse_default_value(param_type, default_value)
            
            params[param_name] = {
                'type': param_type,
                'default': parsed_default,
                'label': param_name,  # Use param name as label
            }
        
        if params:
            logger.debug(f"Parsed {len(params)} custom parameter(s) from template: {list(params.keys())}")
        
        return params
    
    def _parse_default_value(self, param_type: str, value_str: Optional[str]) -> Any:
        """
        Parse default value based on parameter type
        
        Args:
            param_type: Type of parameter (text, number, color, bool)
            value_str: String value to parse (can be None)
        
        Returns:
            Parsed value with appropriate type
        """
        if value_str is None:
            # No default value specified, return type-specific defaults
            return {
                'text': '',
                'number': 0,
                'color': '#000000',
                'bool': False,
            }.get(param_type, '')
        
        if param_type == 'number':
            try:
                # Try int first, then float
                if '.' in value_str:
                    return float(value_str)
                else:
                    return int(value_str)
            except ValueError:
                logger.warning(f"Invalid number value '{value_str}', using 0")
                return 0
        
        elif param_type == 'bool':
            # Accept: true/false, 1/0, yes/no, on/off (case-insensitive)
            return value_str.lower() in {'true', '1', 'yes', 'on'}
        
        elif param_type == 'color':
            # Auto-add # if missing
            if value_str.startswith('#'):
                return value_str
            else:
                return f'#{value_str}'
        
        else:  # text
            return value_str
    
    def _replace_parameters(self, html: str, values: Dict[str, Any]) -> str:
        """
        Replace parameter placeholders with actual values
        
        Supports DSL syntax: {{param:type=default}}
        - If value provided in values dict, use it
        - Otherwise, use default value from placeholder
        - If no default, use empty string
        
        Args:
            html: HTML template content
            values: Dictionary of parameter values
        
        Returns:
            HTML with placeholders replaced
        """
        PARAM_PATTERN = r'\{\{([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-z]+))?(?:=([^}]+))?\}\}'
        
        def replacer(match):
            param_name = match.group(1)
            param_type = match.group(2) or 'text'
            default_value_str = match.group(3)
            
            # Check if value is provided
            if param_name in values:
                value = values[param_name]
                # Convert bool to string for HTML
                if isinstance(value, bool):
                    return 'true' if value else 'false'
                return str(value) if value is not None else ''
            
            # Use default value from placeholder if available
            elif default_value_str:
                return default_value_str
            
            # No value and no default
            else:
                return ''
        
        return re.sub(PARAM_PATTERN, replacer, html)
    
    def _find_chrome_executable(self) -> Optional[str]:
        """
        Find suitable Chrome/Chromium/Edge executable, preferring non-snap versions on Linux

        Returns:
            Path to browser executable or None to use default
        """
        if os.name == 'posix' and sys.platform != 'darwin':
            import subprocess
            candidates = [
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium',
                '/usr/bin/chromium-browser',
                '/usr/local/bin/chrome',
                '/usr/local/bin/chromium',
            ]

            for path in candidates:
                if os.path.exists(path) and os.access(path, os.X_OK):
                    try:
                        result = subprocess.run(
                            ['readlink', '-f', path],
                            capture_output=True,
                            text=True,
                            timeout=1
                        )
                        real_path = result.stdout.strip()

                        if '/snap/' not in real_path:
                            logger.info(f"✓ Found non-snap browser: {path} -> {real_path}")
                            return path
                        else:
                            logger.debug(f"✗ Skipping snap browser: {path}")
                    except Exception as e:
                        logger.debug(f"Error checking {path}: {e}")

            logger.warning(
                "⚠️  No non-snap Chrome/Chromium found. Snap browsers have AppArmor restrictions.\n"
                "   Install system Chrome with:\n"
                "   wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb\n"
                "   sudo dpkg -i google-chrome-stable_current_amd64.deb\n"
                "   Or install Chromium: sudo apt-get install -y chromium-browser"
            )
            return None

        if os.name == 'nt':
            import winreg
            browser_registry_keys = [
                ("Chrome", r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"),
                ("Edge", r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"),
            ]
            browser_paths = [
                ("Chrome", r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
                ("Chrome", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
                ("Edge", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
                ("Edge", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
            ]

            for browser_name, reg_key in browser_registry_keys:
                try:
                    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, reg_key) as key:
                        reg_path = winreg.QueryValue(key, None)
                        if reg_path and os.path.exists(reg_path) and os.access(reg_path, os.X_OK):
                            logger.info(f"✓ Found {browser_name} from registry: {reg_path}")
                            return reg_path
                except Exception as e:
                    logger.debug(f"Registry lookup for {browser_name} failed: {e}")

            for browser_name, path in browser_paths:
                if os.path.exists(path) and os.access(path, os.X_OK):
                    logger.info(f"✓ Found {browser_name}: {path}")
                    return path

            logger.warning("⚠️ Chrome/Edge executable not found on Windows")
            return None

        if os.name == 'posix' and sys.platform == 'darwin':
            candidates = [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
            ]
            for path in candidates:
                if os.path.exists(path) and os.access(path, os.X_OK):
                    logger.info(f"✓ Found browser: {path}")
                    return path
            logger.warning("⚠️ Chrome/Chromium not found on macOS")
            return None

        return None
    
    def _ensure_hti(self, width: int, height: int):
        """Lazily initialize Html2Image instance"""
        if self.hti is None:
            # Configure Chrome flags for Linux headless environment
            custom_flags = [
                '--default-background-color=00000000',
                '--no-sandbox',  # Bypass AppArmor/sandbox restrictions
                '--disable-dev-shm-usage',  # Avoid shared memory issues
                '--disable-gpu',  # Disable GPU acceleration
                '--disable-software-rasterizer',  # Disable software rasterizer
                '--disable-extensions',  # Disable extensions
                '--disable-setuid-sandbox',  # Additional sandbox bypass
                '--disable-dbus',  # Disable DBus to avoid permission errors
                '--hide-scrollbars',  # Hide scrollbars for cleaner output
                '--mute-audio',  # Mute audio
                '--disable-background-networking',  # Disable background networking
                '--disable-features=TranslateUI',  # Disable translate UI
                '--disable-ipc-flooding-protection',  # Improve performance
                '--no-first-run',  # Skip first run dialogs
                '--no-default-browser-check',  # Skip default browser check
                '--disable-backgrounding-occluded-windows',  # Improve performance
                '--disable-renderer-backgrounding',  # Improve performance
            ]
            
            # Try to find non-snap browser
            browser_path = self._find_chrome_executable()
            
            # Workaround: Add extra height to compensate for Chromium screenshot cropping bug
            # The extra pixels will be cropped back in generate_frame() after rendering
            # See CHROMIUM_HEIGHT_OFFSET constant for details
            kwargs = {
                'size': (width, height + self.CHROMIUM_HEIGHT_OFFSET),
                'custom_flags': custom_flags
            }
            
            if browser_path:
                kwargs['browser_executable'] = browser_path
            
            self.hti = Html2Image(**kwargs)
            
            if browser_path:
                logger.debug(f"Initialized Html2Image with size ({width}, {height}), {len(custom_flags)} custom flags, using browser: {browser_path}")
            else:
                logger.debug(f"Initialized Html2Image with size ({width}, {height}) and {len(custom_flags)} custom flags")
    
    async def generate_frame(
        self,
        title: str,
        text: str,
        image: str,
        ext: Optional[Dict[str, Any]] = None,
        output_path: Optional[str] = None
    ) -> str:
        """
        Generate frame from HTML template
        
        Video size is automatically determined from template path during initialization.
        
        Args:
            title: Video title
            text: Narration text for this frame
            image: Path to AI-generated image (supports relative path, absolute path, or HTTP URL)
            ext: Additional data (content_title, content_author, etc.)
            output_path: Custom output path (auto-generated if None)
        
        Returns:
            Path to generated frame image
        """
        # Convert image path to absolute path or file:// URL for html2image
        if image and not image.startswith(('http://', 'https://', 'data:', 'file://')):
            # Local file path - convert to absolute path and file:// URL
            image_path = Path(image)
            if not image_path.is_absolute():
                # Relative to current working directory (project root)
                image_path = Path.cwd() / image
            
            # Ensure the file exists
            if not image_path.exists():
                logger.warning(f"Image file not found: {image_path}")
            else:
                # Convert to file:// URL for html2image compatibility
                image = image_path.as_uri()
                logger.debug(f"Converted image path to: {image}")
        
        # Build variable context
        context = {
            # Required variables
            "title": title,
            "text": text,
            "image": image,
        }
        
        # Add all ext fields
        if ext:
            context.update(ext)
        
        # Replace variables in HTML (supports DSL syntax: {{param:type=default}})
        html = self._replace_parameters(self.template, context)
        # Use provided output path or auto-generate
        if output_path is None:
            # Fallback: auto-generate (for backward compatibility)
            from pixelle_video.utils.os_util import get_output_path
            output_filename = f"frame_{uuid.uuid4().hex[:16]}.png"
            output_path = get_output_path(output_filename)
        else:
            # Ensure parent directory exists
            import os
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Extract filename from output_path for html2image
        import os
        output_filename = os.path.basename(output_path)
        output_dir = os.path.dirname(output_path)
        
        # Ensure Html2Image is initialized with template's size
        self._ensure_hti(self.width, self.height)
        
        # Render HTML to image
        logger.debug(f"Rendering HTML template to {output_path} (size: {self.width}x{self.height})")
        try:
            self.hti.screenshot(
                html_str=html,
                save_as=output_filename
            )
            
            # html2image saves to current directory by default, move to target directory
            import shutil
            temp_file = os.path.join(os.getcwd(), output_filename)
            if os.path.exists(temp_file) and temp_file != output_path:
                shutil.move(temp_file, output_path)
            
            # Workaround: Crop image to remove extra height added to compensate for Chromium bug
            # Chromium screenshots are cropped at the bottom, so we render with extra height
            # and then crop it back to the desired size. See CHROMIUM_HEIGHT_OFFSET constant.
            # Reference: https://issues.chromium.org/issues/405165895
            if os.path.exists(output_path):
                with Image.open(output_path) as img:
                    # Crop from (0, 0) to (originWidth, originHeight)
                    # This removes the extra CHROMIUM_HEIGHT_OFFSET pixels added during rendering
                    cropped_img = img.crop((0, 0, self.width, self.height))
                    cropped_img.save(output_path)
                    logger.debug(f"Cropped image to size: {self.width}x{self.height} (removed {self.CHROMIUM_HEIGHT_OFFSET}px workaround offset)")
            
            logger.info(f"✅ Frame generated: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Failed to render HTML template: {e}")
            raise RuntimeError(f"HTML rendering failed: {e}")

