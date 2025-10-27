"""
ComfyUI Base Service - Common logic for ComfyUI-based services
"""

import os
from pathlib import Path
from typing import Optional, List, Dict, Any

from comfykit import ComfyKit
from loguru import logger


class ComfyBaseService:
    """
    Base service for ComfyUI workflow-based capabilities
    
    Provides common functionality for TTS, Image, and other ComfyUI-based services.
    
    Subclasses should define:
    - WORKFLOW_PREFIX: Prefix for workflow files (e.g., "image_", "tts_")
    - DEFAULT_WORKFLOW: Default workflow filename (e.g., "image_default.json")
    - WORKFLOWS_DIR: Directory containing workflows (default: "workflows")
    """
    
    WORKFLOW_PREFIX: str = ""  # Must be overridden by subclass
    DEFAULT_WORKFLOW: str = ""  # Must be overridden by subclass
    WORKFLOWS_DIR: str = "workflows"
    
    def __init__(self, config: dict, service_name: str):
        """
        Initialize ComfyUI base service
        
        Args:
            config: Full application config dict
            service_name: Service name in config (e.g., "tts", "image")
        """
        self.config = config.get(service_name, {})
        self.service_name = service_name
        self._workflows_cache: Optional[List[str]] = None
    
    def _scan_workflows(self) -> List[str]:
        """
        Scan workflows/{prefix}*.json files
        
        Returns:
            List of workflow filenames
            Example: ["image_default.json", "image_flux.json"]
        """
        workflows = []
        workflows_dir = Path(self.WORKFLOWS_DIR)
        
        if not workflows_dir.exists():
            logger.warning(f"Workflows directory not found: {workflows_dir}")
            return workflows
        
        # Scan for {prefix}_*.json files
        for file in workflows_dir.glob(f"{self.WORKFLOW_PREFIX}*.json"):
            workflows.append(file.name)
            logger.debug(f"Found {self.service_name} workflow: {file.name}")
        
        return sorted(workflows)
    
    def _get_default_workflow(self) -> str:
        """
        Get default workflow name from config or use DEFAULT_WORKFLOW
        
        Returns:
            Default workflow filename
        """
        return self.config.get("default_workflow", self.DEFAULT_WORKFLOW)
    
    def _resolve_workflow(self, workflow: Optional[str] = None) -> str:
        """
        Resolve workflow to actual workflow path
        
        Args:
            workflow: Workflow filename (e.g., "image_default.json")
                     Can also be:
                     - Absolute path: "/path/to/workflow.json"
                     - Relative path: "custom/workflow.json"
                     - URL: "http://..."
                     - RunningHub ID: "12345"
        
        Returns:
            Workflow file path or identifier
        
        Raises:
            ValueError: If workflow not found
        """
        # 1. If not specified, use default
        if workflow is None:
            workflow = self._get_default_workflow()
        
        # 2. If it's an absolute path, URL, or looks like RunningHub ID, use as-is
        if (workflow.startswith("/") or 
            workflow.startswith("http://") or 
            workflow.startswith("https://") or
            workflow.isdigit()):
            logger.debug(f"Using workflow identifier: {workflow}")
            return workflow
        
        # 3. If it's just a filename, look in workflows/ directory
        workflow_path = Path(self.WORKFLOWS_DIR) / workflow
        
        if not workflow_path.exists():
            # List available workflows for error message
            available = self._scan_workflows()
            available_str = ", ".join(available) if available else "none"
            raise ValueError(
                f"Workflow '{workflow}' not found at {workflow_path}. "
                f"Available workflows: {available_str}\n"
                f"Please create: {workflow_path}"
            )
        
        logger.info(f"🎬 Using {self.service_name} workflow: {workflow}")
        return str(workflow_path)
    
    def _prepare_comfykit_config(
        self,
        comfyui_url: Optional[str] = None,
        runninghub_api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Prepare ComfyKit configuration
        
        Args:
            comfyui_url: ComfyUI URL (optional, overrides config)
            runninghub_api_key: RunningHub API key (optional, overrides config)
        
        Returns:
            ComfyKit configuration dict
        """
        kit_config = {}
        
        # ComfyUI URL (priority: param > config > env > default)
        final_comfyui_url = (
            comfyui_url 
            or self.config.get("comfyui_url")
            or os.getenv("COMFYUI_BASE_URL")
            or "http://127.0.0.1:8188"
        )
        kit_config["comfyui_url"] = final_comfyui_url
        
        # RunningHub API key (priority: param > config > env)
        final_rh_key = (
            runninghub_api_key
            or self.config.get("runninghub_api_key")
            or os.getenv("RUNNINGHUB_API_KEY")
        )
        if final_rh_key:
            kit_config["runninghub_api_key"] = final_rh_key
        
        logger.debug(f"ComfyKit config: {kit_config}")
        return kit_config
    
    def list_workflows(self) -> List[str]:
        """
        List all available workflows
        
        Returns:
            List of workflow filenames (sorted alphabetically)
        
        Example:
            workflows = service.list_workflows()
            # ['image_default.json', 'image_flux.json']
        """
        return self._scan_workflows()
    
    @property
    def available(self) -> List[str]:
        """
        List available workflows
        
        Returns:
            List of available workflow filenames
        
        Example:
            print(f"Available workflows: {service.available}")
        """
        return self.list_workflows()
    
    def __repr__(self) -> str:
        """String representation"""
        default = self._get_default_workflow()
        available = ", ".join(self.available) if self.available else "none"
        return (
            f"<{self.__class__.__name__} "
            f"default={default!r} "
            f"available=[{available}]>"
        )

