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
International language support for Pixelle-Video Web UI
"""

import json
import locale
from pathlib import Path
from typing import Dict, Optional

from loguru import logger

_locales: Dict[str, dict] = {}
_current_language: str = "en_US"  # Default fallback to English


def load_locales() -> Dict[str, dict]:
    """Load all locale files from locales directory"""
    global _locales
    
    locales_dir = Path(__file__).parent / "locales"
    
    if not locales_dir.exists():
        logger.warning(f"Locales directory not found: {locales_dir}")
        return _locales
    
    for json_file in locales_dir.glob("*.json"):
        lang_code = json_file.stem
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                _locales[lang_code] = json.load(f)
            logger.debug(f"Loaded locale: {lang_code}")
        except Exception as e:
            logger.error(f"Failed to load locale {lang_code}: {e}")
    
    logger.info(f"Loaded {len(_locales)} locales: {list(_locales.keys())}")
    return _locales


def set_language(lang_code: str):
    """Set current language"""
    global _current_language
    if lang_code in _locales:
        _current_language = lang_code
        logger.debug(f"Language set to: {lang_code}")
    else:
        logger.warning(f"Language {lang_code} not found, keeping {_current_language}")


def get_language() -> str:
    """Get current language"""
    return _current_language


def tr(key: str, fallback: Optional[str] = None, **kwargs) -> str:
    """
    Translate a key to current language
    
    Args:
        key: Translation key (e.g., "app.title")
        fallback: Fallback text if key not found
        **kwargs: Format parameters for string interpolation
    
    Returns:
        Translated text
    
    Example:
        tr("app.title")  # => "Pixelle-Video"
        tr("error.missing_field", field="API Key")  # => "请填写 API Key"
    """
    locale = _locales.get(_current_language, {})
    translations = locale.get("t", {})
    
    result = translations.get(key)
    
    if result is None:
        # Try fallback parameter
        if fallback is not None:
            result = fallback
        # Try English fallback
        elif _current_language != "en_US" and "en_US" in _locales:
            en_locale = _locales["en_US"]
            result = en_locale.get("t", {}).get(key)
        
        # Last resort: return the key itself
        if result is None:
            result = key
            logger.debug(f"Translation missing: {key}")
    
    # Apply string interpolation if kwargs provided
    if kwargs:
        try:
            result = result.format(**kwargs)
        except (KeyError, ValueError) as e:
            logger.warning(f"Failed to format translation '{key}': {e}")
    
    return result


def get_available_languages() -> Dict[str, str]:
    """Get all available languages with their display names"""
    return {
        code: locale.get("language_name", code)
        for code, locale in _locales.items()
    }


def detect_system_language() -> str:
    """
    Detect system/OS language and return the best matching locale code.
    Falls back to English if no match found.
    
    This is designed for self-hosted scenarios where the server and browser
    are typically on the same machine.
    
    Returns:
        Language code (e.g., "zh_CN", "en_US")
    """
    try:
        import os
        import platform
        import subprocess
        
        system_locale = None
        
        # Method 1: macOS-specific detection (most reliable for macOS)
        if platform.system() == "Darwin":  # macOS
            try:
                # Get AppleLocale which reflects system language preference
                result = subprocess.run(
                    ["defaults", "read", "-g", "AppleLocale"],
                    capture_output=True,
                    text=True,
                    timeout=2
                )
                if result.returncode == 0:
                    system_locale = result.stdout.strip()
                    logger.debug(f"System locale from macOS AppleLocale: {system_locale}")
            except Exception as e:
                logger.debug(f"macOS AppleLocale detection failed: {e}")
            
            # Fallback: try AppleLanguages
            if not system_locale:
                try:
                    result = subprocess.run(
                        ["defaults", "read", "-g", "AppleLanguages"],
                        capture_output=True,
                        text=True,
                        timeout=2
                    )
                    if result.returncode == 0:
                        # Parse array output like: ( "zh-Hans-CN", "en-CN" )
                        output = result.stdout.strip()
                        # Extract first language
                        import re
                        match = re.search(r'"([^"]+)"', output)
                        if match:
                            lang = match.group(1)
                            # Convert zh-Hans-CN to zh_CN
                            if lang.startswith("zh-Hans"):
                                system_locale = "zh_CN"
                            elif lang.startswith("zh-Hant"):
                                system_locale = "zh_TW"
                            else:
                                system_locale = lang.replace("-", "_")
                            logger.debug(f"System locale from macOS AppleLanguages: {system_locale}")
                except Exception as e:
                    logger.debug(f"macOS AppleLanguages detection failed: {e}")
        
        # Method 2: Get from environment locale (cross-platform)
        if not system_locale:
            try:
                system_locale = locale.getdefaultlocale()[0]
                logger.debug(f"System locale from getdefaultlocale(): {system_locale}")
            except Exception as e:
                logger.debug(f"getdefaultlocale() failed: {e}")
        
        # Method 3: Get from current locale
        if not system_locale:
            try:
                system_locale = locale.getlocale()[0]
                logger.debug(f"System locale from getlocale(): {system_locale}")
            except Exception as e:
                logger.debug(f"getlocale() failed: {e}")
        
        # Method 4: Try to get from environment variables
        if not system_locale:
            for env_var in ['LC_ALL', 'LC_MESSAGES', 'LANG', 'LANGUAGE']:
                env_value = os.environ.get(env_var)
                if env_value:
                    # Extract language code from formats like "zh_CN.UTF-8"
                    system_locale = env_value.split('.')[0]
                    logger.debug(f"System locale from {env_var}: {system_locale}")
                    break
        
        if system_locale:
            # Normalize the locale string
            # Handle formats: zh_CN, zh-CN, zh_CN.UTF-8, etc.
            system_locale = system_locale.replace('-', '_').split('.')[0]
            
            # Direct match (e.g., "zh_CN")
            for locale_code in _locales.keys():
                if locale_code.lower() == system_locale.lower():
                    logger.info(f"System language matched: {locale_code}")
                    return locale_code
            
            # Partial match (e.g., "zh" matches "zh_CN")
            lang_prefix = system_locale.split('_')[0].lower()
            for locale_code in _locales.keys():
                if locale_code.lower().startswith(lang_prefix):
                    logger.info(f"System language partially matched: {locale_code} (from {system_locale})")
                    return locale_code
        
        logger.info("No system language detected, using fallback")
    except Exception as e:
        logger.warning(f"Failed to detect system language: {e}")
    
    # Fallback to English
    return "en_US"


# Auto-load locales on import
load_locales()

# Auto-detect and set system language
_detected_language = detect_system_language()
_current_language = _detected_language
logger.info(f"Default language initialized to: {_current_language}")

