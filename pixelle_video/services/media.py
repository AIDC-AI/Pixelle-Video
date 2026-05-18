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
Media Generation Service - Multi-provider implementation

Supports multiple image generation backends:
- ComfyUI workflows (default)
- Azure OpenAI GPT-image-2 / DALL-E 3

Automatically routes to configured provider based on config.
"""

from typing import Optional

from loguru import logger

from pixelle_video.models.media import MediaResult
from pixelle_video.services.azure_image_service import AzureImageService
from pixelle_video.services.comfy_base_service import ComfyBaseService


class MediaService(ComfyBaseService):
    """
    Media generation service - Multi-provider
    
    Routes image generation to configured provider:
    - comfyui: Uses ComfyKit workflows (default, existing behavior)
    - azure_openai: Uses Azure OpenAI GPT-image-2 / DALL-E 3
    
    Video generation always uses ComfyUI workflows.
    
    Usage:
        # Use configured provider (from config.yaml)
        media = await pixelle_video.media(prompt="a cat")
        if media.is_image:
            print(f"Generated image: {media.url}")
        
        # Force specific provider
        media = await pixelle_video.media(
            prompt="a cat",
            provider="azure_openai"  # Override config
        )
        
        # List available workflows (ComfyUI only)
        workflows = pixelle_video.media.list_workflows()
    """
    
    WORKFLOW_PREFIX = ""  # Will be overridden by _scan_workflows
    DEFAULT_WORKFLOW = None  # No hardcoded default, must be configured
    WORKFLOWS_DIR = "workflows"
    
    def __init__(self, config: dict, core=None):
        """
        Initialize media service
        
        Args:
            config: Full application config dict
            core: PixelleVideoCore instance (for accessing shared ComfyKit)
        """
        super().__init__(config, service_name="image", core=core)
        
        # Store full config for provider routing
        self._full_config = config
        
        # Initialize Azure Image Service (lazy - only if configured)
        self._azure_service: Optional[AzureImageService] = None
        
        # Get default provider from config
        image_provider_config = config.get("image_provider", {})
        self._default_provider = image_provider_config.get("provider", "comfyui")
        
        logger.info(f"MediaService initialized with default provider: {self._default_provider}")
    
    def _get_azure_service(self) -> AzureImageService:
        """Get or create Azure Image Service"""
        if self._azure_service is None:
            self._azure_service = AzureImageService(self._full_config, core=self.core)
        return self._azure_service
    
    def _scan_workflows(self):
        """
        Scan workflows for both image_ and video_ prefixes
        
        Override parent method to support multiple prefixes
        """
        from pathlib import Path

        from pixelle_video.utils.os_util import (
            get_resource_path,
            list_resource_dirs,
            list_resource_files,
        )
        
        workflows = []
        
        # Get all workflow source directories
        source_dirs = list_resource_dirs("workflows")
        
        if not source_dirs:
            logger.warning("No workflow source directories found")
            return workflows
        
        # Scan each source directory for workflow files
        for source_name in source_dirs:
            # Get all JSON files for this source
            workflow_files = list_resource_files("workflows", source_name)
            
            # Filter to only files matching image_ or video_ prefix
            matching_files = [
                f for f in workflow_files 
                if (f.startswith("image_") or f.startswith("video_")) and f.endswith('.json')
            ]
            
            for filename in matching_files:
                try:
                    # Get actual file path
                    file_path = Path(get_resource_path("workflows", source_name, filename))
                    workflow_info = self._parse_workflow_file(file_path, source_name)
                    workflows.append(workflow_info)
                    logger.debug(f"Found workflow: {workflow_info['key']}")
                except Exception as e:
                    logger.error(f"Failed to parse workflow {source_name}/{filename}: {e}")
        
        # Sort by key (source/name)
        return sorted(workflows, key=lambda w: w["key"])
    
    async def __call__(
        self,
        prompt: str,
        workflow: Optional[str] = None,
        # Provider selection
        provider: Optional[str] = None,  # "comfyui" or "azure_openai" - overrides config
        # Media type specification (required for proper handling)
        media_type: str = "image",  # "image" or "video"
        # ComfyUI connection (optional overrides)
        comfyui_url: Optional[str] = None,
        runninghub_api_key: Optional[str] = None,
        # Common workflow parameters
        width: Optional[int] = None,
        height: Optional[int] = None,
        duration: Optional[float] = None,  # Video duration in seconds (for video workflows)
        negative_prompt: Optional[str] = None,
        steps: Optional[int] = None,
        seed: Optional[int] = None,
        cfg: Optional[float] = None,
        sampler: Optional[str] = None,
        # Azure-specific parameters
        size: Optional[str] = None,  # e.g., "1024x1024"
        quality: Optional[str] = None,  # "auto", "high", "medium", "low"
        **params
    ) -> MediaResult:
        """
        Generate media (image or video) using configured provider
        
        For images: Routes to ComfyUI or Azure OpenAI based on config/provider param.
        For videos: Always uses ComfyUI workflows.
        
        Args:
            prompt: Media generation prompt
            workflow: Workflow filename (ComfyUI only)
            provider: Override provider ("comfyui" or "azure_openai")
            media_type: Type of media to generate - "image" or "video" (default: "image")
            comfyui_url: ComfyUI URL (optional, overrides config)
            runninghub_api_key: RunningHub API key (optional, overrides config)
            width: Media width (ComfyUI) or converted to size (Azure)
            height: Media height (ComfyUI) or converted to size (Azure)
            duration: Target video duration in seconds (only for video workflows)
            negative_prompt: Negative prompt (ComfyUI only)
            steps: Sampling steps (ComfyUI only)
            seed: Random seed (ComfyUI only)
            cfg: CFG scale (ComfyUI only)
            sampler: Sampler name (ComfyUI only)
            size: Image size for Azure (e.g., "1024x1024")
            quality: Image quality for Azure ("auto", "high", "medium", "low")
            **params: Additional provider-specific parameters
        
        Returns:
            MediaResult object with media_type ("image" or "video") and url
        
        Examples:
            # Use default provider from config
            media = await pixelle_video.media(prompt="a beautiful cat")
            
            # Force Azure OpenAI
            media = await pixelle_video.media(
                prompt="a cat",
                provider="azure_openai",
                size="1024x1024",
                quality="high"
            )
            
            # Force ComfyUI workflow
            media = await pixelle_video.media(
                prompt="a cat",
                provider="comfyui",
                workflow="runninghub/image_flux.json"
            )
            
            # Video (always ComfyUI)
            media = await pixelle_video.media(
                prompt="a cat running",
                media_type="video",
                workflow="runninghub/video_wan2.1_fusionx.json"
            )
        """
        # Determine effective provider
        effective_provider = provider or self._default_provider
        
        # Video always uses ComfyUI
        if media_type == "video":
            effective_provider = "comfyui"
            logger.debug("Video generation - forcing ComfyUI provider")
        
        # Route to appropriate provider
        if effective_provider == "azure_openai":
            return await self._generate_with_azure(
                prompt=prompt,
                width=width,
                height=height,
                size=size,
                quality=quality,
                **params
            )
        else:
            return await self._generate_with_comfyui(
                prompt=prompt,
                workflow=workflow,
                media_type=media_type,
                comfyui_url=comfyui_url,
                runninghub_api_key=runninghub_api_key,
                width=width,
                height=height,
                duration=duration,
                negative_prompt=negative_prompt,
                steps=steps,
                seed=seed,
                cfg=cfg,
                sampler=sampler,
                **params
            )
    
    async def _generate_with_azure(
        self,
        prompt: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        size: Optional[str] = None,
        quality: Optional[str] = None,
        **params
    ) -> MediaResult:
        """Generate image using Azure OpenAI"""
        azure_service = self._get_azure_service()
        
        # Convert width/height to size if provided and size not specified
        if size is None and width and height:
            size = f"{width}x{height}"
            logger.debug(f"Converted width={width}, height={height} to size={size}")
        
        logger.info("🎨 Routing to Azure OpenAI for image generation")
        
        return await azure_service(
            prompt=prompt,
            size=size,
            quality=quality,
            **params
        )
    
    async def _generate_with_comfyui(
        self,
        prompt: str,
        workflow: Optional[str] = None,
        media_type: str = "image",
        comfyui_url: Optional[str] = None,
        runninghub_api_key: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        duration: Optional[float] = None,
        negative_prompt: Optional[str] = None,
        steps: Optional[int] = None,
        seed: Optional[int] = None,
        cfg: Optional[float] = None,
        sampler: Optional[str] = None,
        **params
    ) -> MediaResult:
        """Generate media using ComfyUI workflow (original implementation)"""
        # 1. Resolve workflow (returns structured info)
        workflow_info = self._resolve_workflow(workflow=workflow)
        
        logger.info(f"🎨 Routing to ComfyUI for {media_type} generation")
        
        # 2. Build workflow parameters (ComfyKit config is now managed by core)
        workflow_params = {"prompt": prompt}
        
        # Add optional parameters
        if width is not None:
            workflow_params["width"] = width
        if height is not None:
            workflow_params["height"] = height
        if duration is not None:
            workflow_params["duration"] = duration
            if media_type == "video":
                logger.info(f"📏 Target video duration: {duration:.2f}s (from TTS audio)")
        if negative_prompt is not None:
            workflow_params["negative_prompt"] = negative_prompt
        if steps is not None:
            workflow_params["steps"] = steps
        if seed is not None:
            workflow_params["seed"] = seed
        if cfg is not None:
            workflow_params["cfg"] = cfg
        if sampler is not None:
            workflow_params["sampler"] = sampler
        
        # Add any additional parameters
        workflow_params.update(params)
        
        logger.debug(f"Workflow parameters: {workflow_params}")
        
        # 4. Execute workflow using shared ComfyKit instance from core
        try:
            # Get shared ComfyKit instance (lazy initialization + config hot-reload)
            kit = await self.core._get_or_create_comfykit()
            
            # Determine what to pass to ComfyKit based on source
            if workflow_info["source"] == "runninghub" and "workflow_id" in workflow_info:
                # RunningHub: pass workflow_id (ComfyKit will use runninghub backend)
                workflow_input = workflow_info["workflow_id"]
                logger.info(f"Executing RunningHub workflow: {workflow_input}")
            else:
                # Selfhost: pass file path (ComfyKit will use local ComfyUI)
                workflow_input = workflow_info["path"]
                logger.info(f"Executing selfhost workflow: {workflow_input}")
            
            result = await kit.execute(workflow_input, workflow_params)
            
            # 5. Handle result based on specified media_type
            if result.status != "completed":
                error_msg = result.msg or "Unknown error"
                logger.error(f"Media generation failed: {error_msg}")
                raise Exception(f"Media generation failed: {error_msg}")
            
            # Extract media based on specified type
            if media_type == "video":
                # Video workflow - get video from result
                if not result.videos:
                    logger.error("No video generated (workflow returned no videos)")
                    raise Exception("No video generated")
                
                video_url = result.videos[0]
                logger.info(f"✅ Generated video: {video_url}")
                
                # Try to extract duration from result (if available)
                duration = None
                if hasattr(result, 'duration') and result.duration:
                    duration = result.duration
                
                return MediaResult(
                    media_type="video",
                    url=video_url,
                    duration=duration
                )
            else:  # image
                # Image workflow - get image from result
                if not result.images:
                    logger.error("No image generated (workflow returned no images)")
                    raise Exception("No image generated")
                
                image_url = result.images[0]
                logger.info(f"✅ Generated image: {image_url}")
                
                return MediaResult(
                    media_type="image",
                    url=image_url
                )
        
        except Exception as e:
            logger.error(f"Media generation error: {e}")
            raise
    
    @property
    def active_provider(self) -> str:
        """Get currently active image provider"""
        return self._default_provider
    
    @property
    def azure_available(self) -> bool:
        """Check if Azure OpenAI is configured and available"""
        azure_service = self._get_azure_service()
        return azure_service.is_configured()
    
    def __repr__(self) -> str:
        """String representation"""
        providers = [self._default_provider]
        if self._default_provider == "comfyui" and self.azure_available:
            providers.append("azure_openai (available)")
        return f"<MediaService provider={self._default_provider!r} workflows={len(self.available)}>"
