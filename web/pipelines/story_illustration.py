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
Step 4: 生成视频（直接调 story_illustration 管线，带进度与预览）
"""

import json
import os
from typing import Any

import streamlit as st
from loguru import logger

from web.i18n import tr, get_language
from web.pipelines.base import PipelineUI, register_pipeline_ui
from web.utils.async_helpers import run_async
# ponytail: 复用 digital_tts_config（命名空间 digital_* key），不与 standard tab 的
# style_config（tts_inference_mode 等裸 key）冲突 —— st.tabs 每次渲染所有 tab。
from web.components.digital_tts_config import render_style_config as render_tts_config
from pixelle_video.config import config_manager
from pixelle_video.models.progress import ProgressEvent
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
        title = st.text_input(
            "视频标题（可选，留空则 AI 自动生成）",
            value=_ss("story_title", ""),
            key="story_title_input",
        )

        # 分镜数量：AI 自动决定（默认）或手动指定
        auto_scenes = st.checkbox("🎨 AI 自动决定分镜数量（推荐）", value=_ss("story_auto_scenes", True), key="story_auto_scenes_input")
        if auto_scenes:
            n_scenes = None
            st.caption("将根据故事长度与节奏由 AI 推理分镜数。")
        else:
            n_scenes = st.number_input("分镜数量", min_value=2, max_value=12, value=_ss("story_n_scenes", 6), key="story_n_scenes_input")

        # 画风与 provider（用于资产图 + 插图生成）
        from pixelle_video.prompts.image_generation import IMAGE_STYLE_PRESETS
        from web.pipelines.api_workflows import list_api_media_workflows
        style_keys = list(IMAGE_STYLE_PRESETS.keys())
        # 画风用预设的中文 name 显示，key 不变（向后兼容已存 session_state）
        _style_zh = {k: IMAGE_STYLE_PRESETS[k].get("name", k) for k in style_keys}
        col_a, col_b = st.columns(2)
        with col_a:
            art_style_key = st.selectbox(
                "画风预设",
                style_keys,
                index=style_keys.index("watercolor") if "watercolor" in style_keys else 0,
                format_func=lambda k: _style_zh[k],
                key="story_art_style_key",
            )
        with col_b:
            # 复用已配置的 API 图片工作流，不再硬编码 3 个
            _img_wfs = list_api_media_workflows(pixelle_video, "image")
            _img_displays = [w["display_name"] for w in _img_wfs] or ["（未配置图片模型）"]
            _img_keys = [w["key"] for w in _img_wfs] or [None]
            _saved = _ss("story_provider")
            _def_idx = _img_keys.index(_saved) if _saved in _img_keys else (
                next((i for i, k in enumerate(_img_keys) if k and "gemini" in k), 0)
            )
            _sel_display = st.selectbox(
                "图片生成 Provider",
                _img_displays,
                index=_def_idx,
                key="story_provider_input",
                help="资产图与插图用同一 provider。Gemini 的 img2img 契约最干净。",
            )
            provider = _img_keys[_img_displays.index(_sel_display)]

        # 配音配置（复用 digital_tts_config，命名空间 key 不与 standard tab 冲突）
        st.markdown("---")
        st.markdown(f"**{tr('section.tts') if _has_tr('section.tts') else '🎤 配音合成'}**")
        style_params = render_tts_config(pixelle_video, key_prefix="story_")
        st.session_state[_STYLE_PARAMS] = style_params
        # prompt_prefix 用预设的完整 prefix 串（不是 key），prompt 才能拿到画风描述
        st.session_state["story_art_style"] = IMAGE_STYLE_PRESETS[art_style_key]["prefix"]
        st.session_state["story_provider"] = provider
        st.session_state["story_n_scenes"] = int(n_scenes) if n_scenes else None
        st.session_state["story_title"] = title.strip() or None

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
                    # T6: 清上一轮 Step2 的 widget key 残留，否则 text_input/text_area
                    # 因 key 绑定会显示旧故事的名称/描述
                    for k in list(st.session_state.keys()):
                        if k.startswith("asset_") and (k.endswith("_name") or k.endswith("_desc")):
                            del st.session_state[k]
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
        st.caption("可编辑名称/描述，可新增/删除，生成参考图。单项可重新生成。资产图将作为插图生成的参考图，保证角色跨分镜一致。")

        kind_label = {"characters": "🧑 角色", "scenes": "🏞️ 场景", "props": "🎒 道具"}
        for kind in ("characters", "scenes", "props"):
            items = lib.setdefault(kind, [])
            # T5: 仅角色类默认展开，其余折叠，避免首屏过长
            with st.expander(f"{kind_label[kind]}（{len(items)}）", expanded=(kind == "characters")):
                # 渲染时遍历副本，删除按 name 匹配（idx 在删除后会变）
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
                                with st.spinner(f"正在生成 {it.get('name') or '资产'}…"):
                                    self._gen_one_asset(pixelle_video, it, kind)
                                st.rerun()
                        else:
                            st.write("—")
                            if st.button("生成", key=f"asset_{kind}_{idx}_gen"):
                                with st.spinner(f"正在生成 {it.get('name') or '资产'}…"):
                                    self._gen_one_asset(pixelle_video, it, kind)
                                st.rerun()
                        # T3: 删除按钮
                        if st.button("🗑", key=f"asset_{kind}_{idx}_del", help="删除此项"):
                            items.pop(idx)
                            st.rerun()
                    # T1: 失败提示
                    if it.get("_error"):
                        st.error(f"❌ 生成失败：{it['_error']}")

                # T3: 新增按钮
                if st.button("➕ 新增", key=f"asset_{kind}_add"):
                    items.append({"name": "", "description": "", "image_path": None})
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
                pending = [(k, it) for k in ("characters", "scenes", "props") for it in lib.get(k, []) if not it.get("image_path")]
                n = len(pending)
                for i, (k, it) in enumerate(pending, 1):
                    with st.spinner(f"正在生成资产图… ({i}/{n})"):
                        self._gen_one_asset(pixelle_video, it, k)
                st.success("资产图生成完成" if n else "无待生成资产")
                st.rerun()
        with col3:
            n_ready = sum(1 for k in ("characters", "scenes", "props") for it in lib.get(k, []) if it.get("image_path"))
            n_total = sum(len(lib.get(k, [])) for k in ("characters", "scenes", "props"))
            # T7: 不强制生成全部，后端会自动补；文案明示可跳过
            if st.button(f"下一步：分镜预览 ➡️  ({n_ready}/{n_total} 已生成，可跳过)", use_container_width=True, type="secondary"):
                _set_step(3)
                st.rerun()

    def _gen_one_asset(self, pixelle_video, it: dict, kind: str = "props"):
        """生成单项资产图，下载到临时文件，写回 image_path。失败标 None 不阻塞。

        kind=characters 时生成多视角参考图；其余 1:1。与后端 _generate_asset_images 同策略。
        """
        try:
            import asyncio, tempfile, os
            import httpx
            from pixelle_video.utils.prompt_helper import build_image_prompt

            base = it.get("description", "")
            if kind == "characters":
                base = (
                    f"{base}. Character reference sheet, single image with 4 views arranged in a 2x2 grid: "
                    "top-left front head close-up portrait, top-right front full-body, "
                    "bottom-left side profile full-body, bottom-right back full-body. "
                    "Same character, consistent appearance across all 4 views, plain neutral background, "
                    "no text, no labels."
                )
            prefix = _ss("story_art_style", "")
            prompt = build_image_prompt(base, prefix)
            provider = _ss("story_provider")
            asset_w = asset_h = 1280 if kind == "characters" else 1024
            media_result = run_async(pixelle_video.media(
                prompt=prompt,
                workflow=provider,
                media_type="image",
                width=asset_w,
                height=asset_h,
            ))
            if not media_result.is_image:
                it["image_path"] = None
                it["_error"] = "provider 未返回图片（检查 provider 配置或额度）"
                return
            url = media_result.url
            # file:// 或本地路径直接用
            if url.startswith("file://") or os.path.exists(url):
                it["image_path"] = url[7:] if url.startswith("file://") else url
                it["_error"] = None  # 成功，清错误
                return
            # 远程 URL：下载到临时文件（T8: 用 kind+name slug 做文件名，弃 hash）
            import re
            _slug = re.sub(r"[^\w]+", "_", (it.get("name") or "asset")).strip("_")[:40] or "asset"
            out = os.path.join(tempfile.gettempdir(), f"story_asset_{kind}_{_slug}.png")
            async def _dl():
                async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as c:
                    r = await c.get(url)
                    r.raise_for_status()
                    with open(out, "wb") as f:
                        f.write(r.content)
            run_async(_dl())
            it["image_path"] = out
            it["_error"] = None
        except Exception as e:
            logger.warning(f"asset gen failed for {it.get('name')}: {e}")
            it["image_path"] = None
            it["_error"] = str(e)

    # ==================== Step 3: 分镜预览 ====================

    def _step3_scenecut(self, pixelle_video):
        st.markdown(f"**{tr('section.scenecut') if _has_tr('section.scenecut') else '分镜预览'}**")
        story = _ss("story_text", "")
        n_scenes = _ss("story_n_scenes")
        lib = _ss(_ASSET_LIB, {})

        def _run_scenecut():
            """调 LLM 分镜，成功写 story_scenes。返回 (ok, err)。"""
            try:
                resp = run_async(pixelle_video.llm(
                    build_story_scenecut_prompt(story, n_scenes, assets_to_text(lib)),
                    temperature=0.8, max_tokens=4000,
                ))
                scenes = _parse_json(resp).get("scenes", [])
                if not scenes:
                    return False, "分镜返回为空"
                st.session_state["story_scenes"] = scenes
                return True, None
            except Exception as e:
                logger.exception(e)
                return False, str(e)

        # 首次进入：自动分镜一次
        if "story_scenes" not in st.session_state:
            with st.spinner("AI 正在分镜…"):
                ok, err = _run_scenecut()
            if ok:
                st.rerun()
            else:
                # B3: 失败不静默死循环——显式重试按钮，不自动 rerun
                st.error(f"分镜失败：{err}")
                if st.button("🔄 重试分镜", type="primary"):
                    st.rerun()
                if st.button("⬅️ 返回上一步"):
                    _set_step(2)
                    st.rerun()
                return

        scenes = st.session_state["story_scenes"]
        # B2/B5: 旁白 + 构图都可编辑；确认时按索引原样保留（不过滤空串，避免与 composition 错位）
        edited = []
        for i, sc in enumerate(scenes):
            with st.container(border=True):
                st.markdown(f"**镜头 {i+1}**")
                n = st.text_area("旁白（可编辑）", value=sc.get("narration", ""), height=68, key=f"scene_narr_{i}")
                c = st.text_area("画面构图（可编辑，影响插图选资产）", value=sc.get("composition", ""), height=68, key=f"scene_comp_{i}")
                edited.append((n, c))

        st.markdown("---")
        col1, col2, col3 = st.columns([1, 1, 2])
        with col1:
            # B4: 上一步不清 story_scenes，回 Step2 改完资产再回来不必重分镜
            if st.button("⬅️ 上一步", use_container_width=True):
                _set_step(2)
                st.rerun()
        with col2:
            # B4: 显式重新分镜入口
            if st.button("🔄 重新分镜", use_container_width=True, help="丢弃当前分镜，重新调用 AI"):
                st.session_state.pop("story_scenes", None)
                st.rerun()
        with col3:
            if st.button("✅ 确认并生成视频", type="primary", use_container_width=True):
                # B1/B2: 旁白 + 构图都传后端，保留空串占位以维持索引对齐
                st.session_state["story_final_narrations"] = [n.strip() for n, _ in edited]
                st.session_state["story_final_compositions"] = [c.strip() for _, c in edited]
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
            if st.button("⬅️ 上一步", use_container_width=True, key="story_step4_back"):
                _set_step(3)
                st.rerun()
        with col2:
            st.caption(
                f"故事 {len(narrations)} 个分镜 · "
                f"资产库 {sum(len(lib.get(k, [])) for k in ('characters', 'scenes', 'props'))} 项 · "
                f"画风 {_ss('story_art_style_key', '-')}"
            )

        # 不复用 render_output_preview：它内置 standard 的脚本预览门 + 重建 video_params
        # 会丢掉 pipeline 参数（→ 跑成 standard），且 script_editor 等 key 与 standard tab 冲突。
        # 这里直接调 story_illustration 管线。
        with st.container(border=True):
            if not config_manager.validate():
                st.warning(tr("settings.not_configured") if _has_tr("settings.not_configured") else "系统未配置，请先在设置中完成 LLM/Provider 配置")

            if st.button(
                tr("btn.generate") if _has_tr("btn.generate") else "🎬 生成视频",
                type="primary", use_container_width=True, key="story_btn_generate",
            ):
                if not narrations:
                    st.error("没有分镜旁白，请返回上一步确认分镜")
                    st.stop()

                video_params = {
                    "pipeline": self.name,
                    "text": _ss("story_text", ""),
                    "mode": "generate",
                    "title": _ss("story_title"),  # None → pipeline auto-generates
                    "n_scenes": _ss("story_n_scenes") or len(narrations),
                    "narrations": narrations,
                    "scene_compositions": _ss("story_final_compositions") or [],
                    "asset_library": lib,
                    "asset_provider": _ss("story_provider"),
                    "prompt_prefix": _ss("story_art_style", ""),
                    "frame_template": "1080x1920/image_story.html",
                    "media_workflow": _ss("story_provider"),
                    **style_params,
                }

                progress_bar = st.progress(0)
                status_text = st.empty()

                def update_progress(event: ProgressEvent):
                    key = f"progress.{event.event_type}"
                    msg = tr(key) if _has_tr(key) else event.event_type
                    if event.frame_current and event.frame_total:
                        msg = f"{msg} ({event.frame_current}/{event.frame_total})"
                    status_text.text(msg)
                    progress_bar.progress(min(int(event.progress * 100), 99))

                video_params["progress_callback"] = update_progress
                try:
                    result = run_async(pixelle_video.generate_video(**video_params))
                    progress_bar.progress(100)
                    status_text.text(tr("status.success") if _has_tr("status.success") else "✅ 完成")
                    st.success(
                        tr("status.video_generated", path=result.video_path)
                        if _has_tr("status.video_generated")
                        else f"✅ 视频已生成：{result.video_path}"
                    )
                    if os.path.exists(result.video_path):
                        st.video(result.video_path)
                        with open(result.video_path, "rb") as vf:
                            st.download_button(
                                label="⬇️ 下载视频" if get_language() == "zh_CN" else "⬇️ Download",
                                data=vf.read(),
                                file_name=os.path.basename(result.video_path),
                                mime="video/mp4",
                                use_container_width=True,
                                key="story_dl_video",
                            )
                except Exception as e:
                    progress_bar.empty()
                    status_text.empty()
                    st.error(f"生成失败：{e}")
                    logger.exception(e)


def _has_tr(key: str) -> bool:
    """检查 i18n key 是否存在，避免 KeyError。"""
    try:
        from web.i18n import _locales, _current_language
        return key in _locales.get(_current_language, {}).get("t", {})
    except Exception:
        return False


# Register self
register_pipeline_ui(StoryIllustrationPipelineUI)
