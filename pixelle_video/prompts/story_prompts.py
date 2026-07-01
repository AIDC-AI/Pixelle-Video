# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Story illustration prompts.

Two structured-JSON prompts for the story-illustration pipeline:
- build_story_extraction_prompt: 故事 → 角色/场景/道具描述（中文），用于建立资产库
- build_story_scenecut_prompt: 故事 → N 个分镜（旁白 + 画面构图说明）
"""

STORY_EXTRACTION_PROMPT = """# 角色任务
你是一位绘本故事拆解专家。用户会输入一段故事文本，你需要从中提取出用于绘本插图创作的"角色""场景""道具"三类要素，并给出每项的中文视觉描述（可直接作为图片生成 prompt 的基础）。

# 输入故事
{story}

# 提取要求
- 角色（characters）：故事中出场的人物/动物拟人形象，给出名称 + 外貌视觉描述（性别、年龄感、发型发色、服饰、显著特征）。
- 场景（scenes）：故事发生的地点/环境，给出名称 + 视觉描述（时间、天气、地形、建筑、氛围）。
- 道具（props）：对剧情有关键作用的物品，给出名称 + 视觉描述（形状、材质、颜色、特征）。
- 描述用中文，具体可画，避免抽象抒情；不出现故事文本之外杜撰的关键设定。
- 若某类没有，返回空数组。控制每类不超过 5 项，挑最重要的。

# 输出格式
严格输出以下 JSON，不要任何解释文字：

```json
{{
  "characters": [{{"name": "角色名", "description": "中文视觉描述"}}],
  "scenes": [{{"name": "场景名", "description": "中文视觉描述"}}],
  "props": [{{"name": "道具名", "description": "中文视觉描述"}}]
}}
```
"""


STORY_SCENECUT_PROMPT = """# 角色任务
你是一位绘本分镜师。用户会输入一段故事文本，你需要把它拆成{count_hint}，每个分镜包含一段旁白（供 TTS 生成配音）和一段画面构图说明（供插图生成参考）。

# 输入故事
{story}

# 已知资产库（角色/场景/道具清单，供构图说明引用）
{assets}

# 分镜要求
- 旁白（narration）：中文，口语化，像给小朋友讲故事，{min_words}~{max_words} 字，句末不加标点，句中用中文标点表停顿。
- 画面构图（composition）：中文，说明本镜出场的角色/场景/道具名称（必须从上方资产库中选），并简述构图（谁在做什么、镜头景别、氛围）。便于后续插图 prompt 引用正确的资产。
- {count_hint}连起来要讲完整故事，节奏自然；每个分镜信息量均衡，不要过长或过短。
- 资产库为空时，composition 自由描述画面。

# 输出格式
严格输出以下 JSON，不要任何解释文字：

```json
{{
  "scenes": [
    {{"narration": "旁白文本", "composition": "画面构图说明"}}
  ]
}}
```
"""


def build_story_extraction_prompt(story: str) -> str:
    """故事 → 资产库提取 prompt（结构化 JSON）。"""
    return STORY_EXTRACTION_PROMPT.format(story=story)


def build_story_scenecut_prompt(
    story: str,
    n_scenes: int | None,
    assets: str,
    min_words: int = 5,
    max_words: int = 30,
) -> str:
    """故事 → 分镜 prompt（结构化 JSON：narration + composition）。

    Args:
        story: 故事原文
        n_scenes: 期望分镜数；None 时由 AI 根据故事长度自行决定（建议 4~8）
        assets: 资产库文本清单（角色/场景/道具），可为空串
    """
    if n_scenes:
        count_hint = f" {n_scenes} 个分镜"
    else:
        count_hint = " 若干分镜（请你根据故事长度与节奏自行决定，建议 4~8 个，短故事取下限、长故事取上限）"
    return STORY_SCENECUT_PROMPT.format(
        story=story,
        count_hint=count_hint,
        assets=assets or "（无）",
        min_words=min_words,
        max_words=max_words,
    )


def assets_to_text(asset_library: dict) -> str:
    """把资产库 dict 渲染成给 LLM 看的文本清单。"""
    if not asset_library:
        return ""
    lines = []
    for kind in ("characters", "scenes", "props"):
        items = asset_library.get(kind, [])
        if not items:
            continue
        label = {"characters": "角色", "scenes": "场景", "props": "道具"}[kind]
        lines.append(f"【{label}】")
        for it in items:
            lines.append(f"- {it.get('name', '')}：{it.get('description', '')}")
    return "\n".join(lines)


if __name__ == "__main__":
    # Self-check: prompt builders format without error and embed inputs.
    story = "小兔子白白在森林里捡到一颗发光的种子，把它种在院子里。"
    p1 = build_story_extraction_prompt(story)
    assert "小兔子" in p1 and "characters" in p1, "extraction prompt broken"

    lib = {
        "characters": [{"name": "白白", "description": "白色小兔子，长耳朵"}],
        "scenes": [{"name": "森林", "description": "阳光森林"}],
        "props": [{"name": "发光种子", "description": "发金光的种子"}],
    }
    p2 = build_story_scenecut_prompt(story, n_scenes=4, assets=assets_to_text(lib))
    assert "4 个分镜" in p2 and "白白" in p2 and "narration" in p2, "scenecut prompt broken"
    p3 = build_story_scenecut_prompt(story, n_scenes=None, assets=assets_to_text(lib))
    assert "自行决定" in p3 and "narration" in p3, "auto-scenecut prompt broken"
    print("story_prompts self-check OK")
