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
Video prompt generation template

For generating video prompts from narrations.
"""

import json
from typing import List


VIDEO_PROMPT_GENERATION_PROMPT = """# Role Definition
You are a professional video creative designer, skilled at creating dynamic and expressive video generation prompts for video scripts, transforming narrative content into vivid video scenes.

# Core Task
Based on the existing video script, create corresponding **English** video generation prompts for each storyboard's "narration content", ensuring video scenes perfectly match the narrative content and enhance audience understanding and memory through dynamic visuals.

**Important: The input contains {narrations_count} narrations. You must generate one corresponding video prompt for each narration, totaling {narrations_count} video prompts.**

# Input Content
{narrations_json}

# Output Requirements

## Video Prompt Specifications
- Language: **Must use English** (for AI video generation models)
- Description structure: scene + character action + camera movement + emotion + atmosphere
- Description length: Ensure clear, complete, and creative descriptions (recommended 50-100 English words)
- Dynamic elements: Emphasize actions, movements, changes, and other dynamic effects

## Visual Creative Requirements
- Each video must accurately reflect the specific content and emotion of the corresponding narration
- Highlight visual dynamics: character actions, object movements, camera movements, scene transitions, etc.
- Use symbolic techniques to visualize abstract concepts (e.g., use flowing water to represent the passage of time, rising stairs to represent progress, etc.)
- Scenes should express rich emotions and actions to enhance visual impact
- Enhance expressiveness through camera language (push, pull, pan, tilt) and editing rhythm

## Key English Vocabulary Reference
- Actions: moving, running, flowing, transforming, growing, falling
- Camera: camera pan, zoom in, zoom out, tracking shot, aerial view
- Transitions: transition, fade in, fade out, dissolve
- Atmosphere: dynamic, energetic, peaceful, dramatic, mysterious
- Lighting: lighting changes, shadows moving, sunlight streaming

## Video and Copy Coordination Principles
- Videos should serve the copy, becoming a visual extension of the copy content
- Avoid visual elements unrelated to or contradicting the copy content
- Choose dynamic presentation methods that best enhance the persuasiveness of the copy
- Ensure the audience can quickly understand the core viewpoint of the copy through video dynamics

## Creative Guidance
1. **Phenomenon Description Copy**: Use dynamic scenes to represent the occurrence process of social phenomena
2. **Cause Analysis Copy**: Use dynamic evolution of cause-and-effect relationships to represent internal logic
3. **Impact Argumentation Copy**: Use dynamic unfolding of consequence scenes or contrasts to represent the degree of impact
4. **In-depth Discussion Copy**: Use dynamic concretization of abstract concepts to represent deep thinking
5. **Conclusion Inspiration Copy**: Use open-ended dynamic scenes or guiding movements to represent inspiration

## Video-Specific Considerations
- Emphasize dynamics: Each video should include obvious actions or movements
- Camera language: Appropriately use camera techniques such as push, pull, pan, tilt to enhance expressiveness
- Duration consideration: Videos should be a coherent dynamic process, not static images
- Fluidity: Pay attention to the fluidity and naturalness of actions

# Output Format
Strictly output in the following JSON format, **video prompts must be in English**:

```json
{{
  "video_prompts": [
    "[detailed English video prompt with dynamic elements and camera movements]",
    "[detailed English video prompt with dynamic elements and camera movements]"
  ]
}}
```

# Important Reminders
1. Only output JSON format content, do not add any explanations
2. Ensure JSON format is strictly correct and can be directly parsed by the program
3. Input is {{"narrations": [narration array]}} format, output is {{"video_prompts": [video prompt array]}} format
4. **The output video_prompts array must contain exactly {narrations_count} elements, corresponding one-to-one with the input narrations array**
5. **Video prompts must use English** (for AI video generation models)
6. Video prompts must accurately reflect the specific content and emotion of the corresponding narration
7. Each video must emphasize dynamics and sense of movement, avoid static descriptions
8. Appropriately use camera language to enhance expressiveness
9. Ensure video scenes can enhance the persuasiveness of the copy and audience understanding

Now, please create {narrations_count} corresponding **English** video prompts for the above {narrations_count} narrations. Only output JSON, no other content.
"""


SCENE_BASED_VIDEO_PROMPT_GENERATION_PROMPT = """# Role Definition
You are a professional video creative director, skilled at creating detailed visual scene descriptions for video generation based on video titles, creative styles, and narration scripts.

# Core Task
Based on the video title, creative style, and narration scripts, create corresponding **English** video generation prompts for each storyboard scene. Each prompt should describe the specific visual content of that scene, including what should appear in the frame, camera angles, lighting, composition, and dynamic elements.

**Important: The input contains {narrations_count} narrations. You must generate one corresponding video prompt for each narration, totaling {narrations_count} video prompts.**

# Video Information
- **Title**: {video_title}
- **Creative Style**: {scene_mode_name} ({scene_mode_description})

# Input Content
{narrations_json}

# Output Requirements

## Video Prompt Specifications
- Language: **Must use English** (for AI video generation models like Sora)
- Description structure: specific visual content + camera angle + lighting + composition + dynamic elements
- Description length: Detailed and complete (recommended 60-120 English words per prompt)
- Content focus: Describe what should appear in each scene, not just abstract concepts

## Visual Content Requirements
- Each video prompt must describe the **specific visual content** of that scene
- For example, if the narration is about "product features", the prompt should describe: "Close-up shot of the product, highlighting key features, professional studio lighting, clean white background, product rotating slowly to show all angles"
- Include camera movements: zoom in, pan, tracking shot, etc.
- Include lighting: natural light, studio lighting, dramatic shadows, etc.
- Include composition: close-up, wide shot, medium shot, etc.
- Include dynamic elements: movements, transitions, effects

## Creative Style Guidance
Based on the creative style "{scene_mode_name}", adjust the visual approach:
{scene_mode_guidance}

## Scene-by-Scene Requirements
1. **Scene 1 (Opening)**: Should grab attention, match the opening narration
2. **Middle Scenes**: Should develop the narrative, show progression
3. **Final Scene**: Should provide closure or call-to-action, match the ending narration

## Key English Vocabulary Reference
- Camera angles: close-up, wide shot, medium shot, bird's eye view, low angle
- Camera movements: zoom in, zoom out, pan left, pan right, tracking shot, dolly shot
- Lighting: natural lighting, studio lighting, dramatic lighting, soft lighting, harsh shadows
- Composition: centered, rule of thirds, leading lines, symmetry
- Dynamics: slow motion, fast motion, smooth transition, abrupt cut

# Output Format
Strictly output in the following JSON format, **video prompts must be in English**:

```json
{{
  "video_prompts": [
    "[detailed English video prompt describing specific visual content of scene 1]",
    "[detailed English video prompt describing specific visual content of scene 2]",
    "[detailed English video prompt describing specific visual content of scene 3]"
  ]
}}
```

# Important Reminders
1. Only output JSON format content, do not add any explanations
2. Ensure JSON format is strictly correct and can be directly parsed by the program
3. **The output video_prompts array must contain exactly {narrations_count} elements, corresponding one-to-one with the input narrations array**
4. **Video prompts must use English** (for AI video generation models)
5. Each prompt should describe **specific visual content**, not abstract concepts
6. Each prompt should be detailed enough for AI video generation models to understand what to create
7. Consider the creative style when generating prompts to ensure visual consistency

Now, please create {narrations_count} corresponding **English** video prompts for the above {narrations_count} narrations. Only output JSON, no other content.
"""


def build_video_prompt_prompt(
    narrations: List[str],
    min_words: int,
    max_words: int
) -> str:
    """
    Build video prompt generation prompt
    
    Args:
        narrations: List of narrations
        min_words: Minimum word count
        max_words: Maximum word count
    
    Returns:
        Formatted prompt for LLM
    
    Example:
        >>> build_video_prompt_prompt(narrations, 50, 100)
    """
    narrations_json = json.dumps(
        {"narrations": narrations},
        ensure_ascii=False,
        indent=2
    )
    
    return VIDEO_PROMPT_GENERATION_PROMPT.format(
        narrations_json=narrations_json,
        narrations_count=len(narrations),
        min_words=min_words,
        max_words=max_words
    )


def build_scene_based_video_prompt_prompt(
    video_title: str,
    scene_mode_key: str,
    scene_mode_name: str,
    scene_mode_description: str,
    narrations: List[str],
    min_words: int = 60,
    max_words: int = 120
) -> str:
    """
    Build scene-based video prompt generation prompt
    
    This generates detailed visual descriptions for each scene based on:
    - Video title (e.g., "给这张图片做一个宣传视频")
    - Creative style (e.g., "广告营销")
    - Each narration script
    
    Args:
        video_title: Video title or theme
        scene_mode_key: Scene mode key (e.g., "advertisement", "marketing")
        scene_mode_name: Scene mode display name
        scene_mode_description: Scene mode description
        narrations: List of narrations for each scene
        min_words: Minimum word count per prompt
        max_words: Maximum word count per prompt
    
    Returns:
        Formatted prompt for LLM
    
    Example:
        >>> build_scene_based_video_prompt_prompt(
        ...     "给这张图片做一个宣传视频",
        ...     "advertisement",
        ...     "广告营销",
        ...     "适合产品推广、品牌宣传、促销活动",
        ...     ["第一段旁白", "第二段旁白"],
        ...     60, 120
        ... )
    """
    narrations_json = json.dumps(
        {"narrations": narrations},
        ensure_ascii=False,
        indent=2
    )
    
    # Generate style-specific guidance
    scene_mode_guidance_map = {
        "marketing": "- Use clean, simple visuals with clear focus\n- Prefer educational or informative visual style\n- Use diagrams, icons, or illustrative elements when appropriate",
        "advertisement": "- Use high-quality product shots with professional lighting\n- Emphasize product features and benefits visually\n- Use dynamic camera movements to create excitement\n- Include call-to-action visual elements",
        "storytelling": "- Use cinematic lighting and composition\n- Create emotional atmosphere through visual elements\n- Use camera movements to enhance narrative flow\n- Focus on character expressions and interactions",
        "tutorial": "- Use clear, instructional visual style\n- Show step-by-step processes visually\n- Use close-ups for important details\n- Keep backgrounds simple to avoid distraction"
    }
    
    scene_mode_guidance = scene_mode_guidance_map.get(
        scene_mode_key,
        "- Use appropriate visual style matching the creative direction\n- Ensure visuals support the narrative content"
    )
    
    return SCENE_BASED_VIDEO_PROMPT_GENERATION_PROMPT.format(
        video_title=video_title,
        scene_mode_name=scene_mode_name,
        scene_mode_description=scene_mode_description,
        narrations_json=narrations_json,
        narrations_count=len(narrations),
        scene_mode_guidance=scene_mode_guidance,
        min_words=min_words,
        max_words=max_words
    )

