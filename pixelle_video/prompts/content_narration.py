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
Content narration generation prompt

For extracting/refining narrations from user-provided content.
"""


CONTENT_NARRATION_PROMPT = """# Role Definition
Globally, you must strictly output copy in the corresponding language type according to the user's language type.
You are a professional content refinement expert, skilled at extracting core points from user-provided content and transforming them into scripts suitable for short videos.

# Core Task
The user will provide content (which may be long or short), and you need to extract narrations for {n_storyboard} video storyboards (for TTS to generate video audio).

# User-Provided Content
{content}

# Output Requirements

## Narration Specifications
- Language consistency requirement: Strictly output copy according to the user's input language type - if input is English, output must be English, and so on
- Purpose: For TTS to generate short video audio
- Word count limit: Strictly control to {min_words}~{max_words} words (minimum not less than {min_words} words)
- Ending format: Do not use punctuation at the end
- Refinement strategy:
  * If user content is long: Extract {n_storyboard} core points, remove redundant information
  * If user content is short: Appropriately expand while retaining core viewpoints, add examples or explanations
  * If user content is just right: Optimize expression to make it more suitable for voice narration
- Style requirement: Maintain the core viewpoint of user content, but express it in a more colloquial way suitable for TTS
- Opening suggestion: The first storyboard can use a question or scene introduction to attract audience attention
- Core content: Middle storyboards expand on the core points of user content
- Ending suggestion: The last storyboard provides a summary or inspiration
- Emotion and tone: Gentle, sincere, natural, like sharing viewpoints with a friend
- Prohibitions: No URLs, emojis, numeric numbering, no empty talk or clichés
- Word count check: After generation, must self-verify that each segment is not less than {min_words} words

## Storyboard Coherence Requirements
- {n_storyboard} storyboards should expand based on the core viewpoint of user content, forming a complete expression
- Maintain logical coherence and natural transitions
- Each storyboard should sound like the same person narrating, with consistent tone
- Ensure the refined content is faithful to the user's original meaning, but more suitable for short video presentation

# Output Format
Strictly output in the following JSON format, do not add any additional text explanations:

```json
{{
  "narrations": [
    "First {min_words}~{max_words} word narration",
    "Second {min_words}~{max_words} word narration",
    "Third {min_words}~{max_words} word narration"
  ]
}}
```

# Important Reminders
1. Only output JSON format content, do not add any explanations
2. Ensure JSON format is strictly correct and can be directly parsed by the program
3. Narrations must be strictly controlled between {min_words}~{max_words} words
4. Must output exactly {n_storyboard} storyboard narrations
5. Content must be faithful to the user's original meaning, but optimized for voice narration expression
6. Output format is {{"narrations": [narration array]}} JSON object

Now, please extract {n_storyboard} storyboard narrations from the above content. Only output JSON, no other content.
"""


def build_content_narration_prompt(
    content: str,
    n_storyboard: int,
    min_words: int,
    max_words: int,
    creative_guidance: str | None = None,
) -> str:
    """
    Build content refinement narration prompt
    
    Args:
        content: User-provided content
        n_storyboard: Number of storyboard frames
        min_words: Minimum word count
        max_words: Maximum word count
    
    Returns:
        Formatted prompt
    """
    prompt = CONTENT_NARRATION_PROMPT.format(
        content=content,
        n_storyboard=n_storyboard,
        min_words=min_words,
        max_words=max_words
    )
    if creative_guidance:
        prompt += f"\n\n# Additional Style Guidance\n{creative_guidance.strip()}\n"
    return prompt
