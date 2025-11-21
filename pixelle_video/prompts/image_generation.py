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
Image prompt generation template

For generating image prompts from narrations.
"""

import json
from typing import List, Optional


# ==================== PRESET IMAGE STYLES ====================
# Predefined visual styles for different use cases

IMAGE_STYLE_PRESETS = {
    "stick_figure": {
        "name": "火柴人简笔画",
        "description": "stick figure style sketch, black and white lines, pure white background, minimalist hand-drawn feel",
        "use_case": "通用场景，简单直观"
    },
    
    "minimal": {
        "name": "极简抽象",
        "description": "minimalist abstract art, geometric shapes, clean composition, modern design, soft pastel colors",
        "use_case": "现代感、艺术感"
    },
    
    "concept": {
        "name": "概念化视觉",
        "description": "conceptual visual metaphors, symbolic elements, thought-provoking imagery, artistic interpretation",
        "use_case": "深度内容、哲学思考"
    },
}

# Default preset
DEFAULT_IMAGE_STYLE = "stick_figure"


IMAGE_PROMPT_GENERATION_PROMPT = """# 角色定位
你是一个专业的视觉创意设计师，擅长为视频脚本创作富有表现力和象征性的图像提示词，将抽象概念转化为具象的视觉画面。

# 核心任务
基于已有的视频脚本，为每个分镜的"旁白内容"创作对应的**英文**图像提示词，确保视觉画面与叙述内容完美配合，增强观众的理解和记忆。

**重要：输入包含 {narrations_count} 个旁白，你必须为每个旁白都生成一个对应的图像提示词，总共输出 {narrations_count} 个图像提示词。**

{ref_image_context}

# 输入内容
{narrations_json}

# 输出要求

## 图像提示词规范
- 语言：**必须使用英文**（用于 AI 图像生成模型）
- 描述结构：scene + character action + emotion + symbolic elements
- 描述长度：确保描述清晰完整且富有创意（建议 50-100 个英文单词）

## 视觉创意要求
- 每个图像都要准确反映对应旁白的具体内容和情感
- 使用象征手法将抽象概念视觉化（如用路径代表人生选择，用锁链代表束缚等）
- 画面要表现出丰富的情感和动作，增强视觉冲击力
- 通过构图和元素安排突出主题，避免过于直白的表现方式

## 关键英文词汇参考
- 象征元素：symbolic elements
- 表情：expression / facial expression
- 动作：action / gesture / movement
- 场景：scene / setting
- 氛围：atmosphere / mood

## 视觉与文案配合原则
- 图像要服务于文案，成为文案内容的视觉延伸
- 避免与文案内容无关或矛盾的视觉元素
- 选择最能增强文案说服力的视觉表现方式
- 确保观众能通过图像快速理解文案的核心观点

## 创意指导
1. **现象描述类文案**：用直观的场景表现社会现象
2. **原因分析类文案**：用因果关系的视觉比喻表现内在逻辑
3. **影响论证类文案**：用后果场景或对比手法表现影响程度
4. **深入探讨类文案**：用抽象概念的具象化表现深刻思考
5. **结论启发类文案**：用开放式场景或指引性元素表现启发性

# 输出格式
严格按照以下JSON格式输出，**图像提示词必须是英文**：

```json
{{
  "image_prompts": [
    "[detailed English image prompt following the style requirements]",
    "[detailed English image prompt following the style requirements]"
  ]
}}
```

# 重要提醒
1. 只输出JSON格式内容，不要添加任何解释说明
2. 确保JSON格式严格正确，可以被程序直接解析
3. 输入是 {{"narrations": [旁白数组]}} 格式，输出是 {{"image_prompts": [图像提示词数组]}} 格式
4. **输出的image_prompts数组必须恰好包含 {narrations_count} 个元素，与输入的narrations数组一一对应**
5. **图像提示词必须使用英文**（for AI image generation models）
6. 图像提示词必须准确反映对应旁白的具体内容和情感
7. 每个图像都要有创意性和视觉冲击力，避免千篇一律
8. 确保视觉画面能增强文案的说服力和观众的理解度

现在，请为上述 {narrations_count} 个旁白创作对应的 {narrations_count} 个**英文**图像提示词。只输出JSON，不要其他内容。
"""


# Reference image context template (when ref_image is provided)
REF_IMAGE_CONTEXT_TEMPLATE = """
# 参考图片信息
用户提供了一张参考图片，希望生成的所有图片都与之保持风格一致。参考图片的详细描述如下：

---
{ref_image_description}
---

## 关键要求
在生成每个image_prompt时，请务必：

1. **主体一致性**：使用参考图片中描述的主体人物/角色/物体的外貌特征和造型
2. **风格一致性**：严格保持参考图片的艺术风格、绘画手法、色调和视觉表现
3. **场景适配**：根据对应的旁白内容描述具体场景和动作，但始终用参考图片的主体来演绎
4. **特征融合**：自然地融入参考图片中提到的关键视觉元素、情感氛围和表现手法

## 反面示例
❌ 错误：如果参考图片是"老年男性，水墨画风格"，却生成"a young woman, digital art style"
✅ 正确：如果参考图片是"老年男性，水墨画风格"，应生成"an elderly man... ink wash painting style"

请确保所有image_prompt都遵循参考图片的核心特征，不要生成与之冲突的内容。
"""


def build_image_prompt_prompt(
    narrations: List[str],
    min_words: int,
    max_words: int,
    ref_image_description: Optional[str] = None
) -> str:
    """
    Build image prompt generation prompt
    
    Note: Style/prefix will be applied later via prompt_prefix in config.
    
    Args:
        narrations: List of narrations
        min_words: Minimum word count
        max_words: Maximum word count
        ref_image_description: Optional natural language description of reference image
                               from Vision API analysis
    
    Returns:
        Formatted prompt for LLM
    
    Example:
        >>> # Without reference image
        >>> build_image_prompt_prompt(narrations, 50, 100)
        
        >>> # With reference image
        >>> description = await analyze_ref_image("ref.jpg", llm)
        >>> build_image_prompt_prompt(narrations, 50, 100, description)
    """
    narrations_json = json.dumps(
        {"narrations": narrations},
        ensure_ascii=False,
        indent=2
    )
    
    # Add reference image context if available
    if ref_image_description:
        ref_context = REF_IMAGE_CONTEXT_TEMPLATE.format(
            ref_image_description=ref_image_description
        )
    else:
        ref_context = ""
    
    return IMAGE_PROMPT_GENERATION_PROMPT.format(
        narrations_json=narrations_json,
        narrations_count=len(narrations),
        min_words=min_words,
        max_words=max_words,
        ref_image_context=ref_context
    )

