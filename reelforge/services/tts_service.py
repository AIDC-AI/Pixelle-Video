"""
TTS (Text-to-Speech) Service - Dual implementation (Edge TTS + ComfyUI)
"""

import uuid
from typing import Optional

from comfykit import ComfyKit
from loguru import logger

from reelforge.services.comfy_base_service import ComfyBaseService
from reelforge.utils.os_util import get_temp_path


class TTSService(ComfyBaseService):
    """
    TTS (Text-to-Speech) service - Dual implementation
    
    Supports two TTS methods:
    1. Edge TTS (default) - Free, local SDK, no workflow needed
    2. ComfyUI Workflow - Workflow-based, requires ComfyUI setup
    
    Usage:
        # Use default (edge-tts)
        audio_path = await reelforge.tts(text="Hello, world!")
        
        # Explicitly use edge-tts
        audio_path = await reelforge.tts(
            text="你好，世界！",
            workflow="edge"
        )
        
        # Use ComfyUI workflow
        audio_path = await reelforge.tts(
            text="Hello",
            workflow="tts_comfyui.json"
        )
        
        # List available workflows
        workflows = reelforge.tts.list_workflows()
    """
    
    WORKFLOW_PREFIX = "tts_"
    DEFAULT_WORKFLOW = "edge"  # Default to edge-tts
    WORKFLOWS_DIR = "workflows"
    
    # Built-in providers (not workflow files)
    BUILTIN_PROVIDERS = ["edge", "edge-tts"]
    
    def __init__(self, config: dict):
        """
        Initialize TTS service
        
        Args:
            config: Full application config dict
        """
        super().__init__(config, service_name="tts")
    
    def _resolve_workflow(self, workflow: Optional[str] = None) -> str:
        """
        Resolve workflow to actual workflow path or provider name
        
        Args:
            workflow: Workflow filename or provider name (e.g., "edge", "tts_default.json")
        
        Returns:
            Workflow file path or provider name
        """
        # 1. If not specified, use default
        if workflow is None:
            workflow = self._get_default_workflow()
        
        # 2. If it's a built-in provider, return as-is
        if workflow in self.BUILTIN_PROVIDERS:
            logger.debug(f"Using built-in TTS provider: {workflow}")
            return workflow
        
        # 3. Otherwise, treat as workflow file (use parent logic)
        return super()._resolve_workflow(workflow)
    
    async def __call__(
        self,
        text: str,
        workflow: Optional[str] = None,
        # ComfyUI connection (optional overrides, only for workflow mode)
        comfyui_url: Optional[str] = None,
        runninghub_api_key: Optional[str] = None,
        # Common TTS parameters (work for both edge-tts and workflows)
        voice: Optional[str] = None,
        rate: Optional[str] = None,
        volume: Optional[str] = None,
        pitch: Optional[str] = None,
        **params
    ) -> str:
        """
        Generate speech using edge-tts or ComfyUI workflow
        
        Args:
            text: Text to convert to speech
            workflow: Workflow filename or provider name (default: "edge")
                     - "edge" or "edge-tts": Use local edge-tts SDK
                     - "tts_xxx.json": Use ComfyUI workflow
                     - Absolute path/URL/RunningHub ID: Also supported
            comfyui_url: ComfyUI URL (only for workflow mode)
            runninghub_api_key: RunningHub API key (only for workflow mode)
            voice: Voice ID
            rate: Speech rate (e.g., "+0%", "+50%", "-20%")
            volume: Speech volume (e.g., "+0%")
            pitch: Speech pitch (e.g., "+0Hz")
            **params: Additional parameters
        
        Returns:
            Generated audio file path
        
        Examples:
            # Simplest: use default (edge-tts)
            audio_path = await reelforge.tts(text="Hello, world!")
            
            # Explicitly use edge-tts with parameters
            audio_path = await reelforge.tts(
                text="你好，世界！",
                workflow="edge",
                voice="zh-CN-XiaoxiaoNeural",
                rate="+20%"
            )
            
            # Use ComfyUI workflow
            audio_path = await reelforge.tts(
                text="Hello",
                workflow="tts_default.json"
            )
            
            # With absolute path
            audio_path = await reelforge.tts(
                text="Hello",
                workflow="/path/to/custom_tts.json"
            )
        """
        # 1. Resolve workflow path or provider
        workflow_or_provider = self._resolve_workflow(workflow=workflow)
        
        # 2. Determine execution path
        if workflow_or_provider in self.BUILTIN_PROVIDERS:
            # Use edge-tts
            return await self._call_edge_tts(
                text=text,
                voice=voice,
                rate=rate,
                volume=volume,
                pitch=pitch,
                **params
            )
        else:
            # Use ComfyUI workflow
            return await self._call_comfyui_workflow(
                workflow_path=workflow_or_provider,
                text=text,
                comfyui_url=comfyui_url,
                runninghub_api_key=runninghub_api_key,
                voice=voice,
                rate=rate,
                volume=volume,
                pitch=pitch,
                **params
            )
    
    async def _call_edge_tts(
        self,
        text: str,
        voice: Optional[str] = None,
        rate: Optional[str] = None,
        volume: Optional[str] = None,
        pitch: Optional[str] = None,
        **params
    ) -> str:
        """
        Generate speech using edge-tts SDK
        
        Args:
            text: Text to convert to speech
            voice: Voice ID (default: zh-CN-YunjianNeural)
            rate: Speech rate (default: +0%)
            volume: Speech volume (default: +0%)
            pitch: Speech pitch (default: +0Hz)
            **params: Additional parameters (e.g., retry_count, retry_delay)
        
        Returns:
            Generated audio file path
        """
        from reelforge.utils.tts_util import edge_tts
        
        logger.info(f"🎙️  Using edge-tts (local SDK)")
        
        # Generate temp file path
        output_path = get_temp_path(f"{uuid.uuid4().hex}.mp3")
        
        # Call edge-tts with output_path to save directly
        try:
            audio_bytes = await edge_tts(
                text=text,
                voice=voice or "zh-CN-YunjianNeural",
                rate=rate or "+0%",
                volume=volume or "+0%",
                pitch=pitch or "+0Hz",
                output_path=output_path,
                **params
            )
            
            logger.info(f"✅ Generated audio (edge-tts): {output_path}")
            return output_path
        
        except Exception as e:
            logger.error(f"Edge TTS generation error: {e}")
            raise
    
    async def _call_comfyui_workflow(
        self,
        workflow_path: str,
        text: str,
        comfyui_url: Optional[str] = None,
        runninghub_api_key: Optional[str] = None,
        voice: Optional[str] = None,
        rate: Optional[str] = None,
        volume: Optional[str] = None,
        pitch: Optional[str] = None,
        **params
    ) -> str:
        """
        Generate speech using ComfyUI workflow
        
        Args:
            workflow_path: Path to workflow file
            text: Text to convert to speech
            comfyui_url: ComfyUI URL
            runninghub_api_key: RunningHub API key
            voice: Voice ID (workflow-specific)
            rate: Speech rate (workflow-specific)
            volume: Speech volume (workflow-specific)
            pitch: Speech pitch (workflow-specific)
            **params: Additional workflow parameters
        
        Returns:
            Generated audio file path/URL
        """
        logger.info(f"🎙️  Using ComfyUI workflow: {workflow_path}")
        
        # 1. Prepare ComfyKit config
        kit_config = self._prepare_comfykit_config(
            comfyui_url=comfyui_url,
            runninghub_api_key=runninghub_api_key
        )
        
        # 2. Build workflow parameters
        workflow_params = {"text": text}
        
        # Add optional TTS parameters
        if voice is not None:
            workflow_params["voice"] = voice
        if rate is not None:
            workflow_params["rate"] = rate
        if volume is not None:
            workflow_params["volume"] = volume
        if pitch is not None:
            workflow_params["pitch"] = pitch
        
        # Add any additional parameters
        workflow_params.update(params)
        
        logger.debug(f"Workflow parameters: {workflow_params}")
        
        # 3. Execute workflow
        try:
            kit = ComfyKit(**kit_config)
            
            logger.info(f"Executing TTS workflow: {workflow_path}")
            result = await kit.execute(workflow_path, workflow_params)
            
            # 4. Handle result
            if result.status != "completed":
                error_msg = result.msg or "Unknown error"
                logger.error(f"TTS generation failed: {error_msg}")
                raise Exception(f"TTS generation failed: {error_msg}")
            
            # ComfyKit result can have audio files in different output types
            # Try to get audio file path from result
            audio_path = None
            
            # Check for audio files in result.audios (if available)
            if hasattr(result, 'audios') and result.audios:
                audio_path = result.audios[0]
            # Check for files in result.files
            elif hasattr(result, 'files') and result.files:
                audio_path = result.files[0]
            # Check in outputs dictionary
            elif hasattr(result, 'outputs') and result.outputs:
                # Try to find audio file in outputs
                for key, value in result.outputs.items():
                    if isinstance(value, str) and any(value.endswith(ext) for ext in ['.mp3', '.wav', '.flac']):
                        audio_path = value
                        break
            
            if not audio_path:
                logger.error("No audio file generated")
                raise Exception("No audio file generated by workflow")
            
            logger.info(f"✅ Generated audio (ComfyUI): {audio_path}")
            return audio_path
        
        except Exception as e:
            logger.error(f"TTS generation error: {e}")
            raise
