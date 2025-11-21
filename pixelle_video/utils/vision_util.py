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
Vision utilities for analyzing images using LLM vision capabilities
"""

import base64
from pathlib import Path
from typing import Optional

from loguru import logger


async def analyze_ref_image(image_path: str, llm_client) -> Optional[str]:
    """
    Analyze reference image using Vision API to extract visual features
    
    This function uses LLM's vision capability to understand the reference image
    and generate a natural language description that can be used to guide
    image prompt generation for maintaining consistency.
    
    Args:
        image_path: Path to the reference image
        llm_client: LLM client (LLMService instance)
    
    Returns:
        Natural language description of the image, or None if analysis fails
    
    Example:
        >>> description = await analyze_ref_image("ref.jpg", llm)
        >>> print(description)
        "An elderly man with white beard wearing traditional clothes, 
         holding a hoe in a determined pose, ink wash painting style..."
    """
    try:
        # Read and encode image
        image_file = Path(image_path)
        if not image_file.exists():
            logger.warning(f"Reference image not found: {image_path}")
            return None
        
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode()
        
        # Determine image format
        suffix = image_file.suffix.lower()
        mime_type_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif"
        }
        mime_type = mime_type_map.get(suffix, "image/jpeg")
        
        # Prepare vision analysis prompt
        analysis_prompt = """Please analyze this reference image in detail. Describe:

1. Main subject (person, object, character, etc.) and their appearance/features
2. Actions, poses, gestures, or expressions
3. Art style (e.g., watercolor, cartoon, realistic, ink wash, minimalist, etc.)
4. Color tone and atmosphere
5. Any other important visual elements

Provide a natural, flowing description that an AI can use to generate similar styled images.
Keep it concise but comprehensive (around 100-150 words)."""
        
        # Call LLM with vision using messages format
        logger.debug(f"Analyzing reference image: {image_path}")
        
        description = await llm_client(
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": analysis_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_data}"
                        }
                    }
                ]
            }],
        )
        
        description = description.strip()
        logger.info(f"✅ Reference image analyzed: {len(description)} characters")
        logger.debug(f"Description preview: {description[:100]}...")
        
        return description
        
    except Exception as e:
        logger.error(f"Failed to analyze reference image: {e}")
        logger.warning("Continuing without reference image analysis...")
        return None

