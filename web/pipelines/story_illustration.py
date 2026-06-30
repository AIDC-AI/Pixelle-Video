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
Story Illustration Pipeline UI — 4-step wizard.

Step 1: 故事输入 + 提取角色/场景/道具（仅描述）
Step 2: 资产库编辑 + 生成资产图（可单项重生）
Step 3: LLM 分镜预览（旁白可编辑）
Step 4: 生成视频（复用 render_output_preview）
"""

import json
from typing import Any

import streamlit as st
from loguru import logger

from web.i18n import tr
from web.pipelines.base import PipelineUI, register_pipeline_ui
from web.utils.async_helpers import run_async
from web.components.style_config import render_style_config
from web.components.output_preview import render_output_preview
from pixelle_video.prompts.story_prompts import (
    build_story_extraction_prompt,
    build_story_scenecut_prompt,
    assets_to_text,
)
from pixelle_video.utils.content_generators import _parse_json

# 向导步骤
_STORY_STEP = "story_step"  # session_state key: 1..4
_ASSET_LIB = "story_asset_lib"  # session_state key: asset library dict
_STYLE_PARAMS = "story_style_params"  # session_state key: style config from step1


def _ss(key, default=None):
    return st.session_state.get(key, default)


def _set_step(n: int):
    st.session_state[_STORY_STEP] = n


class StoryIllustrationPipelineUI(PipelineUI):
    """绘本故事插图视频 —— 分步向导 UI。"""

    name = "story_illustration"
    icon = "📖"

    @property
    def display_name(self):
        return tr("pipeline.story_illustration.name") if _has_tr("pipeline.story_illustration.name") else "故事插图视频"

    @property
    def description(self):
        return tr("pipeline.story_illustration.description") if _has_tr("pipeline.story_illustration.description") else "输入故事，AI 提取角色场景、分镜、生成一致性插图视频"

    def render(self, pixelle_video: Any):
        st.session_state.setdefault(_STORY_STEP, 1)
        step = _ss(_STORY_STEP, 1)

        # 顶部进度指示
        labels = ["1️⃣ 故事输入", "2️⃣ 资产库", "3️⃣ 分镜预览", "4️⃣ 生成视频"]
        cols = st.columns(4)
        for i, label in enumerate(labels):
            with cols[i]:
                if i + 1 == step:
                    st.markdown(f"**🟢 {label}**")
                elif i + 1 < step:
                    st.markdown(f"✅ {label}")
                else:
                    st.markdown(f"⚪ {label}")

        st.divider()

        if step == 1:
            self._step1_story(pixelle_video)
        elif step == 2:
            self._step2_assets(pixelle_video)
        elif step == 3:
            self._step3_scenecut(pixelle_video)
        else:
            self._step4_generate(pixelle_video)

    # ==================== Step 1: 故事输入 + 提取资产描述 ====================

    def _step1_story(self, pixelle_video):
        st.markdown(f"**{tr('section.story_input') if _has_tr('section.story_input') else '故事输入'}**")

        story = st.text_area(
            "故事文本",
            value=_ss("story_text", ""),
            height=200,
            key="story_text_input",
            placeholder="输入一段故事…例如：小兔子白白在森林里捡到一颗发光的种子…",
        )
        n_scenes = st.number_input("分镜数量", min_value=2, max_value=12, value=_ss("story_n_scenes", 6), key="story_n_scenes_input")

        # 画风与 provider（用于资产图 + 插图生成）
        from pixelle_video.prompts.image_generation import IMAGE_STYLE_PRESETS
        style_keys = list(IMAGE_STYLE_PRESETS.keys())
        col_a, col_b = st.columns(2)
        with col_a:
            art_style = st.selectbox("画风预设", style_keys, index=style_keys.index("watercolor") if "watercolor" in style_keys else 0, key="story_art_style")
        with col_b:
            provider = st.selectbox(
                "图片生成 Provider",
                ["api/gemini/gemini-3-pro-image", "api/seedream/doubao-seedream-5-0-260128", "api/dashscope/wan2.7-image"],
                key="story_provider",
                help="资产图与插图用同一 provider。Gemini 的 img2img 契约最干净。",
            )

        # 风格/TTS/模板配置（复用现有组件，存起来给 Step4 用）
        st.markdown("---")
        st.markdown(f"**{tr('section.style_config') if _has_tr('section.style_config') else '配音与模板'}**")
        style_params = render_style_config(pixelle_video)
        st.session_state[_STYLE_PARAMS] = style_params
        st.session_state["story_art_style"] = art_style
        st.session_state["story_provider"] = provider
        st.session_state["story_n_scenes"] = int(n_scenes)

        # 提取按钮
        if st.button("📝 提取角色与场景", type="primary", use_container_width=True):
            if not story.strip():
                st.error("请先输入故事文本")
                st.stop()
            with st.spinner("AI 正在从故事中提取角色/场景/道具…"):
                try:
                    resp = run_async(pixelle_video.llm(
                        build_story_extraction_prompt(story), temperature=0.7, max_tokens=3000
                    ))
                    lib = _parse_json(resp)
                    # 初始化 image_path=None
                    for kind in ("characters", "scenes", "props"):
                        for it in lib.get(kind, []):
                            it["image_path"] = None
                    st.session_state[_ASSET_LIB] = lib
                    st.session_state["story_text"] = story
                    _set_step(2)
                    st.success(f"✅ 提取完成：角色 {len(lib.get('characters', []))} / 场景 {len(lib.get('scenes', []))} / 道具 {len(lib.get('props', []))}")
                    st.rerun()
                except Exception as e:
                    logger.exception(e)
                    st.error(f"提取失败：{e}")

    # ==================== Step 2: 资产库编辑 + 生图 ====================

    def _step2_assets(self, pixelle_video):
        lib = _ss(_ASSET_LIB, {"characters": [], "scenes": [], "props": []})
        st.markdown(f"**{tr('section.asset_library') if _has_tr('section.asset_library') else '资产库编辑'}**")
        st.caption("可编辑名称/描述，生成参考图。单项可重新生成。资产图将作为插图生成的参考图，保证角色跨分镜一致。")

        kind_label = {"characters": "🧑 角色", "scenes": "🏞️ 场景", "props": "🎒 道具"}
        for kind in ("characters", "scenes", "props"):
            items = lib.setdefault(kind, [])
            if not items:
                continue
            with st.expander(f"{kind_label[kind]}（{len(items)}）", expanded=True):
                for idx, it in enumerate(items):
                    c1, c2, c3 = st.columns([2, 3, 1])
                    with c1:
                        it["name"] = st.text_input("名称", value=it.get("name", ""), key=f"asset_{kind}_{idx}_name")
                    with c2:
                        it["description"] = st.text_area("描述", value=it.get("description", ""), height=68, key=f"asset_{kind}_{idx}_desc")
                    with c3:
                        if it.get("image_path"):
                            st.image(it["image_path"], use_container_width=True)
                            if st.button("重生", key=f"asset_{kind}_{idx}_regen"):
                                self._gen_one_asset(pixelle_video, it)
                                st.rerun()
                        else:
                            st.write("—")
                            if st.button("生成", key=f"asset_{kind}_{idx}_gen"):
                                self._gen_one_asset(pixelle_video, it)
                                st.rerun()

        # 操作行
        st.markdown("---")
        col1, col2, col3 = st.columns([1, 1, 2])
        with col1:
            if st.button("⬅️ 上一步", use_container_width=True):
                _set_step(1)
                st.rerun()
        with col2:
            if st.button("🎨 生成全部资产图", type="primary", use_container_width=True):
                with st.spinner("正在生成资产图…"):
                    for kind in ("characters", "scenes", "props"):
                        for it in lib.get(kind, []):
                            if not it.get("image_path"):
                                self._gen_one_asset(pixelle_video, it)
                st.success("资产图生成完成")
                st.rerun()
        with col3:
            n_ready = sum(1 for k in ("characters", "scenes", "props") for it in lib.get(k, []) if it.get("image_path"))
            n_total = sum(len(lib.get(k, [])) for k in ("characters", "scenes", "props"))
            if st.button(f"下一步：分镜预览 ➡️  ({n_ready}/{n_total} 资产已生成)", use_container_width=True, type="primary" if n_ready else "secondary"):
                _set_step(3)
                st.rerun()

    def _gen_one_asset(self, pixelle_video, it: dict):
        """生成单项资产图，下载到临时文件，写回 image_path。失败标 None 不阻塞。"""
        try:
            import asyncio, tempfile, os
            import httpx
            from pixelle_video.utils.prompt_helper import build_image_prompt

            prefix = _ss("story_art_style", "")
            prompt = build_image_prompt(it.get("description", ""), prefix)
            provider = _ss("story_provider")
            media_result = run_async(pixelle_video.media(
                prompt=prompt,
                workflow=provider,
                media_type="image",
                width=_ss(_STYLE_PARAMS, {}).get("media_width"),
                height=_ss(_STYLE_PARAMS, {}).get("media_height"),
            ))
            if not media_result.is_image:
                it["image_path"] = None
                return
            url = media_result.url
            # file:// 或本地路径直接用
            if url.startswith("file://") or os.path.exists(url):
                it["image_path"] = url[7:] if url.startswith("file://") else url
                return
            # 远程 URL：下载到临时文件
            out = os.path.join(tempfile.gettempdir(), f"story_asset_{abs(hash(it.get('name','')))%999999}.png")
            async def _dl():
                async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as c:
                    r = await c.get(url)
                    r.raise_for_status()
                    with open(out, "wb") as f:
                        f.write(r.content)
            run_async(_dl())
            it["image_path"] = out
        except Exception as e:
            logger.warning(f"asset gen failed for {it.get('name')}: {e}")
            it["image_path"] = None

    # ==================== Step 3: 分镜预览 ====================

    def _step3_scenecut(self, pixelle_video):
        st.markdown(f"**{tr('section.scenecut') if _has_tr('section.scenecut') else '分镜预览'}**")
        story = _ss("story_text", "")
        n_scenes = _ss("story_n_scenes", 6)
        lib = _ss(_ASSET_LIB, {})

        if "story_scenes" not in st.session_state:
            with st.spinner("AI 正在分镜…"):
                try:
                    resp = run_async(pixelle_video.llm(
                        build_story_scenecut_prompt(story, n_scenes, assets_to_text(lib)),
                        temperature=0.8, max_tokens=4000,
                    ))
                    scenes = _parse_json(resp).get("scenes", [])
                    if not scenes:
                        st.error("分镜失败：返回为空")
                        return
                    st.session_state["story_scenes"] = scenes
                    st.rerun()
                except Exception as e:
                    logger.exception(e)
                    st.error(f"分镜失败：{e}")
                    return

        scenes = st.session_state["story_scenes"]
        edited_narrations = []
        for i, sc in enumerate(scenes):
            with st.container(border=True):
                st.markdown(f"**镜头 {i+1}**")
                comp = sc.get("composition", "")
                if comp:
                    st.caption(f"画面构图：{comp}")
                n = st.text_area("旁白（可编辑）", value=sc.get("narration", ""), height=68, key=f"scene_narr_{i}")
                edited_narrations.append(n)

        st.markdown("---")
        col1, col2 = st.columns([1, 2])
        with col1:
            if st.button("⬅️ 上一步", use_container_width=True):
                st.session_state.pop("story_scenes", None)
                _set_step(2)
                st.rerun()
        with col2:
            if st.button("✅ 确认并生成视频", type="primary", use_container_width=True):
                st.session_state["story_final_narrations"] = [n.strip() for n in edited_narrations if n.strip()]
                _set_step(4)
                st.rerun()

    # ==================== Step 4: 生成 ====================

    def _step4_generate(self, pixelle_video):
        st.markdown(f"**{tr('section.generate') if _has_tr('section.generate') else '生成视频'}**")
        style_params = _ss(_STYLE_PARAMS, {}) or {}
        lib = _ss(_ASSET_LIB, {})
        narrations = _ss("story_final_narrations", [])

        col1, col2 = st.columns([1, 2])
        with col1:
            if st.button("⬅️ 上一步", use_container_width=True):
                _set_step(3)
                st.rerun()
        with col2:
            st.caption(f"故事 {len(narrations)} 个分镜 · 资产库 {sum(len(lib.get(k,[])) for k in ('characters','scenes','props'))} 项 · 画风 {_ss('story_art_style','-')}")

        # 组装参数，复用 render_output_preview 的生成按钮/进度/预览
        video_params = {
            "pipeline": self.name,
            "text": _ss("story_text", ""),
            "mode": "generate",
            "n_scenes": _ss("story_n_scenes", 6),
            "narrations": narrations,
            "asset_library": lib,
            "asset_provider": _ss("story_provider"),
            "prompt_prefix": _ss("story_art_style", ""),
            **style_params,
        }
        # 确保模板默认走 image 类型（插图）
        if not video_params.get("frame_template"):
            video_params["frame_template"] = "1080x1920/image_story.html"
        if not video_params.get("media_workflow"):
            video_params["media_workflow"] = _ss("story_provider")

        render_output_preview(pixelle_video, video_params)


def _has_tr(key: str) -> bool:
    """检查 i18n key 是否存在，避免 KeyError。"""
    try:
        from web.i18n import _locales, _current_language
        return key in _locales.get(_current_language, {})
    except Exception:
        return False


# Register self
register_pipeline_ui(StoryIllustrationPipelineUI)
