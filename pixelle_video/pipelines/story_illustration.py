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
Story Illustration Pipeline

绘本故事插图视频：故事文本 → 资产库(角色/场景/道具) → LLM 分镜 → 一致性插图(img2img) → TTS → 拼接。

继承 StandardPipeline，复用其 setup/resume/checkpoint/produce_assets/post_production/finalize 全部逻辑，
只覆写两步：
- generate_content: 故事 → 分镜（narration + composition），而非 topic 展开或正则切分。
- plan_visuals: 每场景插图 prompt + 选定该场景引用的资产图（写入 frame.reference_image_paths，
  FrameProcessor 透传 image_paths 给 img2img）。

资产库的提取与生图在 plan_visuals 内完成（若 UI 未预生成）。img2img 适配层已就绪，不改 provider。
"""

from pathlib import Path
from typing import List, Optional

from loguru import logger

from pixelle_video.pipelines.standard import StandardPipeline
from pixelle_video.pipelines.linear import PipelineContext
from pixelle_video.utils.content_generators import generate_image_prompts, _parse_json
from pixelle_video.utils.prompt_helper import build_image_prompt
from pixelle_video.prompts.story_prompts import (
    build_story_extraction_prompt,
    build_story_scenecut_prompt,
    assets_to_text,
)
from pixelle_video.utils.os_util import get_task_frame_path


class StoryIllustrationPipeline(StandardPipeline):
    """绘本故事插图视频管线。"""

    # ==================== Step 2: 分镜 ====================

    async def generate_content(self, ctx: PipelineContext):
        """故事 → 分镜（narration + composition）。"""
        # UI 预确认的旁白直接用（向导 Step 3 确认后传入）
        predefined = ctx.params.get("narrations")
        if predefined and isinstance(predefined, list) and predefined:
            ctx.narrations = predefined
            # 同步取 UI 编辑后的构图说明，供 plan_visuals 选资产参考图；
            # 缺失则补空串（保持索引对齐，避免 _select_refs 错位）
            comps = ctx.params.get("scene_compositions") or []
            ctx.params["_scene_compositions"] = (
                list(comps) + [""] * (len(predefined) - len(comps))
            )[:len(predefined)]
            logger.info(f"✅ Using {len(ctx.narrations)} pre-defined narrations")
            return

        self._report_progress(ctx.progress_callback, "story_scenecut", 0.05)
        story = ctx.input_text
        n_scenes = ctx.params.get("n_scenes", 6)
        asset_library = ctx.params.get("asset_library") or {}
        assets_text = assets_to_text(asset_library)

        prompt = build_story_scenecut_prompt(
            story=story,
            n_scenes=n_scenes,
            assets=assets_text,
            min_words=ctx.params.get("min_narration_words", 5),
            max_words=ctx.params.get("max_narration_words", 30),
        )
        response = await self.llm(prompt, temperature=0.8, max_tokens=4000)
        result = _parse_json(response)
        scenes = result.get("scenes", [])
        if not scenes:
            raise ValueError("story scenecut returned no scenes")

        # 旁白 + 构图说明都存到 ctx，构图说明在 plan_visuals 用于选资产
        ctx.narrations = [s.get("narration", "").strip() for s in scenes]
        ctx.params["_scene_compositions"] = [s.get("composition", "") for s in scenes]
        # n_scenes 指定时截断；None（AI 自动决定）则照单全收
        if n_scenes and len(ctx.narrations) > n_scenes:
            ctx.narrations = ctx.narrations[:n_scenes]
            ctx.params["_scene_compositions"] = ctx.params["_scene_compositions"][:n_scenes]
        logger.info(f"✅ Story split into {len(ctx.narrations)} scenes")

    # ==================== Step 4: 插图 prompt + 资产参考图 ====================

    async def plan_visuals(self, ctx: PipelineContext):
        """每场景：插图 prompt + 选定引用的资产图路径（img2img 参考）。"""
        frame_template = ctx.params.get("frame_template") or "1080x1920/image_story.html"
        template_name = Path(frame_template).name
        from pixelle_video.utils.template_util import get_template_type
        template_type = get_template_type(template_name)

        # 静态模板不需要媒体——退回基类行为
        if template_type not in ("image", "video"):
            ctx.image_prompts = [None] * len(ctx.narrations)
            return

        # 1. 资产库：若 UI 未预生成，在此提取 + 生图
        asset_library = await self._ensure_asset_library(ctx)

        # 2. 每场景插图 prompt（复用 image_generation，保证画风一致）
        self._report_progress(ctx.progress_callback, "generating_image_prompts", 0.15)
        prompt_prefix = ctx.params.get("prompt_prefix", "")
        from pixelle_video.prompts.image_generation import get_style_hint_by_prefix
        style_hint = get_style_hint_by_prefix(prompt_prefix)

        base_prompts = await generate_image_prompts(
            self.llm,
            narrations=ctx.narrations,
            min_words=ctx.params.get("min_image_prompt_words", 30),
            max_words=ctx.params.get("max_image_prompt_words", 60),
            style_hint=style_hint,
        )
        ctx.image_prompts = [build_image_prompt(p, prompt_prefix) for p in base_prompts]

        # 3. 每场景选定引用的资产图（composition + narration 提到的角色/场景/道具 → 对应 image_path）
        compositions = ctx.params.pop("_scene_compositions", [""] * len(ctx.narrations))
        ctx.params["_scene_refs"] = [
            self._select_refs(compositions[i], ctx.narrations[i] if i < len(ctx.narrations) else "", asset_library)
            for i in range(len(compositions))
        ]
        logger.info(f"✅ {len(ctx.image_prompts)} illustration prompts + reference images ready")

    # ==================== Step 5: 把参考图挂到 frame ====================

    async def initialize_storyboard(self, ctx: PipelineContext):
        """复用基类建 storyboard，再把每场景参考图挂到 frame.reference_image_paths。"""
        await super().initialize_storyboard(ctx)
        scene_refs = ctx.params.pop("_scene_refs", [])
        for i, frame in enumerate(ctx.storyboard.frames):
            if i < len(scene_refs):
                frame.reference_image_paths = scene_refs[i]
        # ponytail: 参考图路径已变化，重存一次 checkpoint
        await self._save_checkpoint(ctx, status="running")

    # ==================== 资产库辅助 ====================

    async def _ensure_asset_library(self, ctx: PipelineContext) -> dict:
        """若 UI 已传 asset_library（含 image_path）直接用；否则提取描述 + 生图。"""
        lib = ctx.params.get("asset_library")
        if lib and self._library_has_images(lib):
            logger.info("✅ Using pre-built asset library from UI")
            return lib

        self._report_progress(ctx.progress_callback, "extracting_assets", 0.08)
        story = ctx.input_text
        response = await self.llm(
            build_story_extraction_prompt(story), temperature=0.7, max_tokens=3000
        )
        lib = _parse_json(response)
        # 生图
        await self._generate_asset_images(ctx, lib)
        ctx.params["asset_library"] = lib
        return lib

    def _library_has_images(self, lib: dict) -> bool:
        for kind in ("characters", "scenes", "props"):
            for it in lib.get(kind, []):
                if it.get("image_path"):
                    return True
        return False

    async def _generate_asset_images(self, ctx: PipelineContext, lib: dict):
        """对资产库每项生成参考图，写回 image_path。失败不阻塞（标 None，该资产不入参考图）。

        角色：多视角参考图（正面大头特写 + 正面全身 + 侧身全身 + 背面全身，单图四宫格），
              便于 img2img 时角色跨分镜外观一致。
        场景/道具：1:1 参考图。
        """
        provider = ctx.params.get("asset_provider") or ctx.params.get("media_workflow")
        prompt_prefix = ctx.params.get("prompt_prefix", "")
        for kind in ("characters", "scenes", "props"):
            for it in lib.get(kind, []):
                if it.get("image_path"):
                    continue
                try:
                    base = it.get("description", "")
                    if kind == "characters":
                        # 多视角角色参考图：四视角同框，保证 img2img 一致性
                        base = (
                            f"{base}. Character reference sheet, single image with 4 views arranged in a 2x2 grid: "
                            "top-left front head close-up portrait, top-right front full-body, "
                            "bottom-left side profile full-body, bottom-right back full-body. "
                            "Same character, consistent appearance across all 4 views, plain neutral background, "
                            "no text, no labels."
                        )
                    desc = build_image_prompt(base, prompt_prefix)
                    out = get_task_frame_path(ctx.task_id, 0, "image")  # 临时，资产图复用 frame 0 目录
                    # 用 index 区分资产：kind+name 哈希进文件名
                    out = out.replace(f"_frame_0_", f"_asset_{kind}_{abs(hash(it.get('name','')))%99999}_", 1) \
                        if "_frame_0_" in out else out
                    # 资产图尺寸固定，不受帧模板尺寸影响：场景/道具 1:1，角色多视角 1:1 稍大保细节
                    asset_w = asset_h = 1280 if kind == "characters" else 1024
                    media_result = await self.core.media(
                        prompt=desc,
                        workflow=provider,
                        media_type="image",
                        width=asset_w,
                        height=asset_h,
                        output_path=out,
                    )
                    if media_result.is_image:
                        # media() 落盘到 out (api_media os.replace)，url 即本地路径；
                        # 不调 _download_media —— 它按 frame_index=0 生成路径会把所有资产图覆盖到 01_image.png
                        it["image_path"] = media_result.url
                        logger.info(f"  🖼️ asset {kind}/{it.get('name')} generated")
                except Exception as e:
                    logger.warning(f"  ⚠️ asset {kind}/{it.get('name')} gen failed (skip): {e}")
                    it["image_path"] = None

    def _select_refs(self, composition: str, narration: str, lib: dict) -> List[str]:
        """根据构图 + 旁白里提到的资产名，选出对应的 image_path（去重，过滤未生成的）。

        长名优先匹配，匹配后从文本中剔除，避免短名（如"白白"）误匹配到长名片段。
        composition 用代词/别名匹配不上时，narration 提到角色名的概率更高，作补充匹配。
        两者都匹配不上 → 回退全部角色资产图（角色一致性是首要目标，宁可多给参考图）。
        """
        if not lib:
            return []
        # 收集所有 (name, path)，按 name 长度降序
        items = []
        for kind in ("characters", "scenes", "props"):
            for it in lib.get(kind, []):
                name = it.get("name", "")
                path = it.get("image_path")
                if name and path:
                    items.append((name, path))
        items.sort(key=lambda x: len(x[0]), reverse=True)

        text = f"{composition}\n{narration}".lower()
        refs = []
        seen = set()
        for name, path in items:
            name_l = name.lower()
            if name_l in text and path not in seen:
                refs.append(path)
                seen.add(path)
                text = text.replace(name_l, "")  # 剔除已匹配，防短名误命中

        # ponytail: 回退——LLM 用代词/别名时匹配全空，此时给全部角色图保一致性，
        # 不给场景/道具（无关角色入参考图反而干扰）。上限 4 张防 provider 超限。
        if not refs:
            char_paths = [it["image_path"] for it in lib.get("characters", []) if it.get("image_path")]
            refs = char_paths[:4]
        return refs


if __name__ == "__main__":
    # Self-check: _select_refs 匹配 + 回退逻辑
    p = StoryIllustrationPipeline.__new__(StoryIllustrationPipeline)
    lib = {
        "characters": [
            {"name": "白白", "image_path": "/a.png"},
            {"name": "会唱歌的小树", "image_path": "/b.png"},
        ],
        "scenes": [{"name": "森林", "image_path": "/s.png"}],
        "props": [{"name": "发光种子", "image_path": "/p.png"}],
    }
    # composition 直接提到资产名
    r = p._select_refs("白白在森林里捡到种子", "", lib)
    assert "/a.png" in r and "/s.png" in r, f"direct match failed: {r}"
    # composition 用代词，narration 提到角色名
    r2 = p._select_refs("她看着那棵树", "白白每天都来浇水", lib)
    assert "/a.png" in r2, f"narration fallback failed: {r2}"
    # 全空匹配 → 回退全部角色图
    r3 = p._select_refs("一片祥和", "远处传来歌声", lib)
    assert r3 == ["/a.png", "/b.png"], f"char fallback failed: {r3}"
    # 长名优先：会唱歌的小树 不被 白白 抢占
    r4 = p._select_refs("会唱歌的小树长大了", "", lib)
    assert "/b.png" in r4 and "/a.png" not in r4, f"long-name priority failed: {r4}"
    print("story_illustration _select_refs self-check OK")
