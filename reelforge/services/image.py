"""
Image Generation Service - ComfyUI Workflow-based implementation
"""

from typing import Optional

from comfykit import ComfyKit
from loguru import logger

from reelforge.services.comfy_base_service import ComfyBaseService


class ImageService(ComfyBaseService):
    """
    Image generation service - Workflow-based
    
    Uses ComfyKit to execute image generation workflows.
    
    Usage:
        # Use default workflow (workflows/image_default.json)
        image_url = await reelforge.image(prompt="a cat")
        
        # Use specific workflow
        image_url = await reelforge.image(
            prompt="a cat",
            workflow="image_flux.json"
        )
        
        # List available workflows
        workflows = reelforge.image.list_workflows()
    """
    
    WORKFLOW_PREFIX = "image_"
    DEFAULT_WORKFLOW = "image_default.json"
    WORKFLOWS_DIR = "workflows"
    
    def __init__(self, config: dict):
        """
        Initialize image service
        
        Args:
            config: Full application config dict
        """
        super().__init__(config, service_name="image")
    
    async def __call__(
        self,
        prompt: str,
        workflow: Optional[str] = None,
        # ComfyUI connection (optional overrides)
        comfyui_url: Optional[str] = None,
        runninghub_api_key: Optional[str] = None,
        # Common workflow parameters
        width: Optional[int] = None,
        height: Optional[int] = None,
        negative_prompt: Optional[str] = None,
        steps: Optional[int] = None,
        seed: Optional[int] = None,
        cfg: Optional[float] = None,
        sampler: Optional[str] = None,
        **params
    ) -> str:
        """
        Generate image using workflow
        
        Args:
            prompt: Image generation prompt
            workflow: Workflow filename (default: from config or "image_default.json")
            comfyui_url: ComfyUI URL (optional, overrides config)
            runninghub_api_key: RunningHub API key (optional, overrides config)
            width: Image width
            height: Image height
            negative_prompt: Negative prompt
            steps: Sampling steps
            seed: Random seed
            cfg: CFG scale
            sampler: Sampler name
            **params: Additional workflow parameters
        
        Returns:
            Generated image URL/path
        
        Examples:
            # Simplest: use default workflow (workflows/image_default.json)
            image_url = await reelforge.image(prompt="a beautiful cat")
            
            # Use specific workflow
            image_url = await reelforge.image(
                prompt="a cat",
                workflow="image_flux.json"
            )
            
            # With additional parameters
            image_url = await reelforge.image(
                prompt="a cat",
                workflow="image_flux.json",
                width=1024,
                height=1024,
                steps=20,
                seed=42
            )
            
            # With absolute path
            image_url = await reelforge.image(
                prompt="a cat",
                workflow="/path/to/custom.json"
            )
            
            # With custom ComfyUI server
            image_url = await reelforge.image(
                prompt="a cat",
                comfyui_url="http://192.168.1.100:8188"
            )
        """
        # 1. Resolve workflow path
        workflow_path = self._resolve_workflow(workflow=workflow)
        
        # 2. Prepare ComfyKit config
        kit_config = self._prepare_comfykit_config(
            comfyui_url=comfyui_url,
            runninghub_api_key=runninghub_api_key
        )
        
        # 3. Build workflow parameters
        workflow_params = {"prompt": prompt}
        
        # Add optional parameters
        if width is not None:
            workflow_params["width"] = width
        if height is not None:
            workflow_params["height"] = height
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
        
        # 4. Execute workflow
        try:
            kit = ComfyKit(**kit_config)
            
            logger.info(f"Executing workflow: {workflow_path}")
            result = await kit.execute(workflow_path, workflow_params)
            
            # 5. Handle result
            if result.status != "completed":
                error_msg = result.msg or "Unknown error"
                logger.error(f"Image generation failed: {error_msg}")
                raise Exception(f"Image generation failed: {error_msg}")
            
            if not result.images:
                logger.error("No images generated")
                raise Exception("No images generated")
            
            image_url = result.images[0]
            logger.info(f"✅ Generated image: {image_url}")
            return image_url
        
        except Exception as e:
            logger.error(f"Image generation error: {e}")
            raise
