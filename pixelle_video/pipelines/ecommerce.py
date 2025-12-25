# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
E-commerce Video Pipeline

Generates promotional videos from product URLs. Given a Taobao/Tmall product URL,
this pipeline:
1. Scrapes product information (title, price, images, etc.)
2. Analyzes product images using LLM
3. Generates marketing-oriented video script
4. Produces a video suitable for product main image slot

Example:
    pipeline = EcommercePipeline(pixelle_video)
    result = await pipeline(
        product_url="https://item.taobao.com/item.htm?id=xxx",
        instruction="Highlight the product's premium quality and value",
        duration=15
    )
"""

import json
from typing import Optional, Callable, List
from pathlib import Path
from datetime import datetime

from loguru import logger
from pydantic import BaseModel, Field

from pixelle_video.pipelines.linear import LinearVideoPipeline, PipelineContext
from pixelle_video.models.progress import ProgressEvent
from pixelle_video.utils.os_util import create_task_output_dir, get_task_final_video_path
from pixelle_video.services.ecommerce.base import ScraperFactory
from pixelle_video.services.ecommerce.models import ProductInfo
# Import to register scrapers
import pixelle_video.services.ecommerce  # noqa: F401

# Type alias for progress callback
ProgressCallback = Optional[Callable[[ProgressEvent], None]]


# ==================== Structured Output Models ====================

class EcommerceScene(BaseModel):
    """Single scene in the e-commerce video"""
    scene_number: int = Field(description="Scene number starting from 1")
    image_index: int = Field(description="Index of the product image to use (0-based)")
    narration: str = Field(description="Narration text for this scene")
    duration: int = Field(description="Estimated duration in seconds")
    focus_point: str = Field(description="What aspect of the product this scene highlights")


class EcommerceScript(BaseModel):
    """Complete e-commerce video script"""
    opening_hook: str = Field(description="Attention-grabbing opening line")
    scenes: List[EcommerceScene] = Field(description="List of scenes in the video")
    closing_cta: str = Field(description="Call-to-action closing line")


class EcommercePipeline(LinearVideoPipeline):
    """
    E-commerce Video Pipeline
    
    Generates promotional videos from product URLs.
    """
    
    def __init__(self, core):
        """
        Initialize pipeline
        
        Args:
            core: PixelleVideoCore instance
        """
        super().__init__(core)
        self.product_info: Optional[ProductInfo] = None
        self.image_analyses: List[str] = []
        self._progress_callback: ProgressCallback = None
    
    async def __call__(
        self,
        product_url: str,
        instruction: str = "",
        duration: int = 15,
        source: str = "runninghub",
        bgm_path: Optional[str] = None,
        bgm_volume: float = 0.2,
        bgm_mode: str = "loop",
        progress_callback: ProgressCallback = None,
        **kwargs
    ) -> PipelineContext:
        """
        Execute pipeline with product URL
        
        Args:
            product_url: Taobao/Tmall product detail page URL
            instruction: User instruction for video style/focus
            duration: Target duration in seconds (default 15 for main image)
            source: Workflow source ("runninghub" or "selfhost")
            bgm_path: Path to background music file
            bgm_volume: BGM volume (0.0-1.0)
            bgm_mode: BGM mode ("loop" or "once")
            progress_callback: Optional callback for progress updates
            **kwargs: Additional parameters
        
        Returns:
            Pipeline context with generated video
        """
        # Store progress callback
        self._progress_callback = progress_callback
        
        # Create context
        ctx = PipelineContext(
            input_text=product_url,
            params={
                "product_url": product_url,
                "instruction": instruction,
                "duration": duration,
                "source": source,
                "bgm_path": bgm_path,
                "bgm_volume": bgm_volume,
                "bgm_mode": bgm_mode,
                **kwargs
            }
        )
        ctx.request = ctx.params
        
        try:
            # Execute pipeline lifecycle
            await self.setup_environment(ctx)
            await self.scrape_product(ctx)
            await self.analyze_product(ctx)
            await self.generate_content(ctx)
            await self.plan_visuals(ctx)
            await self.initialize_storyboard(ctx)
            await self.produce_assets(ctx)
            await self.post_production(ctx)
            await self.finalize(ctx)
            
            return ctx
            
        except Exception as e:
            await self.handle_exception(ctx, e)
            raise
    
    def _emit_progress(self, event: ProgressEvent):
        """Emit progress event to callback if available"""
        if self._progress_callback:
            self._progress_callback(event)
    
    async def setup_environment(self, ctx: PipelineContext) -> PipelineContext:
        """Create task directory and initialize environment"""
        task_dir, task_id = create_task_output_dir()
        ctx.task_id = task_id
        ctx.task_dir = Path(task_dir)
        ctx.final_video_path = get_task_final_video_path(task_id)
        
        logger.info(f"📁 Task directory: {task_dir}")
        
        self._emit_progress(ProgressEvent(
            event_type="setup",
            progress=0.01
        ))
        
        return ctx
    
    async def scrape_product(self, ctx: PipelineContext) -> PipelineContext:
        """
        Scrape product information from URL
        
        Progress: 1% - 20%
        """
        logger.info("🔍 Scraping product information...")
        
        self._emit_progress(ProgressEvent(
            event_type="scraping_product",
            progress=0.02,
            extra_info="start"
        ))
        
        product_url = ctx.request["product_url"]
        
        # Create scraper (uses persistent login state)
        scraper = ScraperFactory.from_url(product_url, headless=True)
        
        try:
            # Scrape product info
            result = await scraper.scrape(
                url=product_url,
                output_dir=str(ctx.task_dir / "product"),
                download_images=True,
                save_html=True,
                take_screenshot=True
            )
            
            if not result.success:
                raise ValueError(f"Failed to scrape product: {result.error}")
            
            self.product_info = result.product
            ctx.product_info = result.product
            
            logger.success(f"✅ Product scraped: {result.product.title[:50]}...")
            logger.info(f"   Price: ¥{result.product.price}")
            logger.info(f"   Images: {len(result.product.local_images)}")
            
        finally:
            await scraper.close()
        
        self._emit_progress(ProgressEvent(
            event_type="scraping_product",
            progress=0.20,
            extra_info="complete"
        ))
        
        return ctx
    
    async def analyze_product(self, ctx: PipelineContext) -> PipelineContext:
        """
        Analyze product images using LLM vision
        
        Progress: 20% - 35%
        """
        logger.info("🔬 Analyzing product images...")
        
        product = self.product_info
        local_images = product.local_images
        
        if not local_images:
            logger.warning("No images to analyze")
            return ctx
        
        total_images = len(local_images)
        self.image_analyses = []
        
        # Get product folder path (where images are saved)
        product_folder = None
        if local_images:
            product_folder = Path(local_images[0]).parent
        
        for i, image_path in enumerate(local_images, 1):
            self._emit_progress(ProgressEvent(
                event_type="analyzing_image",
                progress=0.20 + (i - 1) / total_images * 0.15,
                frame_current=i,
                frame_total=total_images,
                extra_info=Path(image_path).name
            ))
            
            try:
                # Use ImageAnalysis service to describe the image
                source = ctx.request.get("source", "runninghub")
                description = await self.core.image_analysis(image_path, source=source)
                self.image_analyses.append(description)
                
                logger.info(f"  Image {i}: {description[:60]}...")
                
                # Save image analysis to text file alongside the image
                if product_folder:
                    image_name = Path(image_path).stem  # e.g., main_01
                    analysis_file = product_folder / f"{image_name}.txt"
                    with open(analysis_file, "w", encoding="utf-8") as f:
                        f.write(f"Image: {Path(image_path).name}\n")
                        f.write(f"Analysis:\n{description}\n")
                    logger.debug(f"  Saved analysis: {analysis_file.name}")
                
            except Exception as e:
                logger.warning(f"  Failed to analyze image {i}: {e}")
                self.image_analyses.append("Product image")
        
        ctx.image_analyses = self.image_analyses
        
        self._emit_progress(ProgressEvent(
            event_type="analyzing_image",
            progress=0.35,
            frame_current=total_images,
            frame_total=total_images,
            extra_info="complete"
        ))
        
        return ctx
    
    async def generate_content(self, ctx: PipelineContext) -> PipelineContext:
        """
        Generate e-commerce video script using LLM
        
        Progress: 35% - 45%
        """
        logger.info("📝 Generating video script...")
        
        self._emit_progress(ProgressEvent(
            event_type="generating_script",
            progress=0.36
        ))
        
        product = self.product_info
        instruction = ctx.request.get("instruction", "")
        duration = ctx.request.get("duration", 15)
        
        # Build prompt for LLM
        prompt = self._build_script_prompt(product, instruction, duration)
        
        # Save prompt for debugging (parallel to product folder)
        prompt_file = ctx.task_dir / "script_prompt.txt"
        with open(prompt_file, "w", encoding="utf-8") as f:
            f.write("=" * 80 + "\n")
            f.write("E-commerce Video Script Generation Prompt\n")
            f.write("=" * 80 + "\n\n")
            f.write(prompt)
        logger.info(f"📄 Prompt saved: {prompt_file}")
        
        # Call LLM with structured output
        script: EcommerceScript = await self.core.llm(
            prompt=prompt,
            response_type=EcommerceScript,
            temperature=0.8,
            max_tokens=2000
        )
        
        # Save LLM response for debugging
        response_file = ctx.task_dir / "script_response.json"
        with open(response_file, "w", encoding="utf-8") as f:
            json.dump(script.model_dump(), f, ensure_ascii=False, indent=2)
        logger.info(f"📄 Response saved: {response_file}")
        
        ctx.script = script
        ctx.opening_hook = script.opening_hook
        ctx.closing_cta = script.closing_cta
        
        logger.success(f"✅ Generated script with {len(script.scenes)} scenes")
        logger.info(f"   Opening: {script.opening_hook[:50]}...")
        logger.info(f"   CTA: {script.closing_cta[:50]}...")
        
        self._emit_progress(ProgressEvent(
            event_type="generating_script",
            progress=0.45,
            extra_info="complete"
        ))
        
        return ctx
    
    def _build_script_prompt(
        self,
        product: ProductInfo,
        instruction: str,
        duration: int
    ) -> str:
        """Build prompt for script generation"""
        # Prepare image descriptions
        image_desc = []
        for i, desc in enumerate(self.image_analyses):
            image_desc.append(f"Image {i}: {desc}")
        images_text = "\n".join(image_desc)
        
        # Build highlights text
        highlights_text = ""
        if product.highlights:
            highlights_text = "\n- ".join([""] + product.highlights)
        
        # Build services text
        services_text = ""
        if product.services:
            services_text = "\n- ".join([""] + product.services)
        
        # Build promotions text
        promotions_text = ""
        if product.promotions:
            promotions_text = "\n- ".join([""] + product.promotions)
        
        # Build price display
        price_display = f"¥{product.price}" if product.price else "价格面议"
        if product.original_price and product.original_price != product.price:
            price_display += f" (原价: ¥{product.original_price})"
        
        prompt = f"""You are an expert e-commerce video scriptwriter. Create a compelling product video script.

## Product Information
- Title: {product.title}
- Price: {price_display}
- Shop: {product.shop_name or 'Unknown'}
- Description: {product.description or 'N/A'}
- Rating: {product.rating or 'N/A'}
- Sales: {product.sales or 'N/A'}
- Shipping: {product.shipping or 'Standard'}
- Freight: {product.freight or 'Free shipping'}

## Product Highlights (Selling Points)
{highlights_text if highlights_text else '- (No specific highlights extracted)'}

## Service Guarantees
{services_text if services_text else '- Standard service'}

## Current Promotions
{promotions_text if promotions_text else '- (No active promotions)'}

## Available Product Images
{images_text}

## User Instructions
{instruction if instruction else 'Create an engaging promotional video highlighting the product value'}

## Requirements
1. Target duration: {duration} seconds
2. Number of scenes: 2-4 (based on available images)
3. Each scene should use one product image (by index)
4. Opening hook: Grab attention in first 3 seconds
5. Closing CTA: Clear call-to-action

## Script Style Guidelines
- Use short, punchy sentences for narration
- Highlight product value and benefits
- Create urgency without being pushy
- Match tone to product type (professional for tech, warm for lifestyle, etc.)

## IMPORTANT: Language Requirement
- If the user explicitly specifies a language, use that language for all outputs.
- If no language is specified, use **Chinese** by default.
- Generate all script content (including opening_hook, narrations, and closing_cta) in the selected language.


Generate a video script that will make viewers want to purchase this product."""
        
        return prompt
    
    async def plan_visuals(self, ctx: PipelineContext) -> PipelineContext:
        """Prepare visual assets for each scene"""
        logger.info("🎯 Planning visual assets...")
        
        script = ctx.script
        product = self.product_info
        
        # Map scenes to local images
        matched_scenes = []
        for scene in script.scenes:
            image_idx = scene.image_index
            if image_idx < len(product.local_images):
                image_path = product.local_images[image_idx]
            else:
                image_path = product.local_images[0] if product.local_images else None
            
            matched_scenes.append({
                "scene_number": scene.scene_number,
                "narration": scene.narration,
                "duration": scene.duration,
                "focus_point": scene.focus_point,
                "image_path": image_path
            })
        
        ctx.matched_scenes = matched_scenes
        
        return ctx
    
    async def determine_title(self, ctx: PipelineContext) -> PipelineContext:
        """Use product title as video title"""
        ctx.title = self.product_info.title[:30] if self.product_info else ""
        return ctx
    
    async def initialize_storyboard(self, ctx: PipelineContext) -> PipelineContext:
        """Initialize storyboard from matched scenes"""
        from pixelle_video.models.storyboard import (
            Storyboard,
            StoryboardFrame,
            StoryboardConfig
        )
        
        # Collect narrations
        all_narrations = [scene["narration"] for scene in ctx.matched_scenes]
        ctx.narrations = all_narrations
        
        # Template for square video (e-commerce main image)
        template_name = "1080x1920/asset_default.html"
        media_width = 1080
        media_height = 1920
        
        # Create config
        ctx.config = StoryboardConfig(
            task_id=ctx.task_id,
            n_storyboard=len(ctx.matched_scenes),
            min_narration_words=5,
            max_narration_words=50,
            video_fps=30,
            tts_inference_mode="local",
            voice_id=ctx.params.get("voice_id", "zh-CN-YunjianNeural"),
            tts_speed=ctx.params.get("tts_speed", 1.2),
            media_width=media_width,
            media_height=media_height,
            frame_template=template_name,
            template_params=ctx.params.get("template_params")
        )
        
        # Create storyboard
        ctx.storyboard = Storyboard(
            title=self.product_info.title[:30] if self.product_info else "",
            config=ctx.config,
            created_at=datetime.now()
        )
        
        # Create frames
        for i, scene in enumerate(ctx.matched_scenes):
            frame = StoryboardFrame(
                index=i,
                narration=scene["narration"],
                image_prompt=None,
                created_at=datetime.now()
            )
            frame.media_type = "image"
            frame.image_path = scene["image_path"]
            frame._scene_data = scene
            
            ctx.storyboard.frames.append(frame)
        
        logger.info(f"✅ Created storyboard with {len(ctx.storyboard.frames)} frames")
        
        return ctx
    
    async def produce_assets(self, ctx: PipelineContext) -> PipelineContext:
        """
        Generate scene videos using FrameProcessor
        
        Progress: 45% - 85%
        """
        logger.info("🎬 Producing scene videos...")
        
        import subprocess
        
        storyboard = ctx.storyboard
        config = ctx.config
        total_frames = len(storyboard.frames)
        
        base_progress = 0.45
        progress_range = 0.40
        
        for i, frame in enumerate(storyboard.frames, 1):
            logger.info(f"Producing scene {i}/{total_frames}...")
            
            frame_progress = base_progress + (i - 1) / total_frames * progress_range
            self._emit_progress(ProgressEvent(
                event_type="frame_step",
                progress=frame_progress,
                frame_current=i,
                frame_total=total_frames,
                step=1,
                action="audio"
            ))
            
            # Generate audio
            audio_path = Path(ctx.task_dir) / "frames" / f"{i:02d}_audio.mp3"
            audio_path.parent.mkdir(parents=True, exist_ok=True)
            
            await self.core.tts(
                text=frame.narration,
                output_path=str(audio_path),
                voice_id=config.voice_id,
                speed=config.tts_speed
            )
            frame.audio_path = str(audio_path)
            
            # Get audio duration
            frame_progress = base_progress + ((i - 1) + 0.5) / total_frames * progress_range
            self._emit_progress(ProgressEvent(
                event_type="frame_step",
                progress=frame_progress,
                frame_current=i,
                frame_total=total_frames,
                step=2,
                action="compose"
            ))
            
            duration_cmd = [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                frame.audio_path
            ]
            duration_result = subprocess.run(duration_cmd, capture_output=True, text=True, check=True)
            frame.duration = float(duration_result.stdout.strip())
            
            # Compose frame video
            frame_progress = base_progress + ((i - 1) + 0.75) / total_frames * progress_range
            self._emit_progress(ProgressEvent(
                event_type="frame_step",
                progress=frame_progress,
                frame_current=i,
                frame_total=total_frames,
                step=3,
                action="video"
            ))
            
            await self.core.frame_processor(
                frame=frame,
                storyboard=storyboard,
                config=config,
                total_frames=total_frames
            )
            
            logger.success(f"✅ Scene {i} complete")
        
        self._emit_progress(ProgressEvent(
            event_type="processing_frame",
            progress=0.85,
            frame_current=total_frames,
            frame_total=total_frames
        ))
        
        return ctx
    
    async def post_production(self, ctx: PipelineContext) -> PipelineContext:
        """
        Concatenate scenes and add BGM
        
        Progress: 85% - 95%
        """
        logger.info("🎞️ Concatenating scenes...")
        
        self._emit_progress(ProgressEvent(
            event_type="concatenating",
            progress=0.86
        ))
        
        # Collect video segments
        scene_videos = [frame.video_segment_path for frame in ctx.storyboard.frames]
        
        # Generate filename
        product_name = self.product_info.title[:20] if self.product_info else ctx.task_id
        filename = f"{product_name}_promo.mp4"
        final_video_path = Path(ctx.task_dir) / filename
        
        # Get BGM parameters
        bgm_path = ctx.request.get("bgm_path")
        bgm_volume = ctx.request.get("bgm_volume", 0.2)
        bgm_mode = ctx.request.get("bgm_mode", "loop")
        
        self.core.video.concat_videos(
            videos=scene_videos,
            output=str(final_video_path),
            bgm_path=bgm_path,
            bgm_volume=bgm_volume,
            bgm_mode=bgm_mode
        )
        
        ctx.final_video_path = str(final_video_path)
        ctx.storyboard.final_video_path = str(final_video_path)
        
        logger.success(f"✅ Final video: {final_video_path}")
        
        self._emit_progress(ProgressEvent(
            event_type="concatenating",
            progress=0.95,
            extra_info="complete"
        ))
        
        return ctx
    
    async def finalize(self, ctx: PipelineContext) -> PipelineContext:
        """Finalize and save metadata"""
        logger.success(f"🎉 E-commerce video generation complete!")
        logger.info(f"Video: {ctx.final_video_path}")
        
        self._emit_progress(ProgressEvent(
            event_type="completed",
            progress=1.0
        ))
        
        # Persist metadata
        await self._persist_task_data(ctx)
        
        return ctx
    
    async def _persist_task_data(self, ctx: PipelineContext):
        """Persist task metadata"""
        try:
            storyboard = ctx.storyboard
            task_id = ctx.task_id
            
            if not task_id:
                return
            
            video_path_obj = Path(ctx.final_video_path)
            file_size = video_path_obj.stat().st_size if video_path_obj.exists() else 0
            
            metadata = {
                "task_id": task_id,
                "created_at": storyboard.created_at.isoformat() if storyboard and storyboard.created_at else None,
                "status": "completed",
                "mode": "ecommerce",
                
                "input": {
                    "product_url": ctx.request.get("product_url"),
                    "instruction": ctx.request.get("instruction"),
                    "duration": ctx.request.get("duration"),
                },
                
                "product": {
                    "title": self.product_info.title if self.product_info else None,
                    "price": self.product_info.price if self.product_info else None,
                    "shop_name": self.product_info.shop_name if self.product_info else None,
                },
                
                "result": {
                    "video_path": ctx.final_video_path,
                    "duration": storyboard.total_duration if storyboard else 0,
                    "file_size": file_size,
                    "n_frames": len(storyboard.frames) if storyboard else 0
                }
            }
            
            await self.core.persistence.save_task_metadata(task_id, metadata)
            logger.info(f"💾 Saved task metadata: {task_id}")
            
            if storyboard:
                await self.core.persistence.save_storyboard(task_id, storyboard)
                
        except Exception as e:
            logger.error(f"Failed to persist task data: {e}")

