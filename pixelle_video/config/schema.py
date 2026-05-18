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
Configuration schema with Pydantic models

Single source of truth for all configuration defaults and validation.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field


class LLMConfig(BaseModel):
    """LLM configuration"""
    api_key: str = Field(default="", description="LLM API Key")
    base_url: str = Field(default="", description="LLM API Base URL")
    model: str = Field(default="", description="LLM Model Name")


class TTSLocalConfig(BaseModel):
    """Local TTS configuration (Edge TTS)"""
    voice: str = Field(default="zh-CN-YunjianNeural", description="Edge TTS voice ID")
    speed: float = Field(default=1.2, ge=0.5, le=2.0, description="Speech speed multiplier (0.5-2.0)")


class TTSComfyUIConfig(BaseModel):
    """ComfyUI TTS configuration"""
    default_workflow: Optional[str] = Field(default=None, description="Default TTS workflow (optional)")


class TTSSubConfig(BaseModel):
    """TTS-specific configuration (under comfyui.tts)"""
    inference_mode: str = Field(default="local", description="TTS inference mode: 'local' or 'comfyui'")
    local: TTSLocalConfig = Field(default_factory=TTSLocalConfig, description="Local TTS (Edge TTS) configuration")
    comfyui: TTSComfyUIConfig = Field(default_factory=TTSComfyUIConfig, description="ComfyUI TTS configuration")
    
    # Backward compatibility: keep default_workflow at top level
    @property
    def default_workflow(self) -> Optional[str]:
        """Get default workflow (for backward compatibility)"""
        return self.comfyui.default_workflow


class ImageSubConfig(BaseModel):
    """Image-specific configuration (under comfyui.image)"""
    default_workflow: Optional[str] = Field(default=None, description="Default image workflow (optional)")
    prompt_prefix: str = Field(
        default="Minimalist black-and-white matchstick figure style illustration, clean lines, simple sketch style",
        description="Prompt prefix for all image generation"
    )


class VideoSubConfig(BaseModel):
    """Video-specific configuration (under comfyui.video)"""
    default_workflow: Optional[str] = Field(default=None, description="Default video workflow (optional)")
    prompt_prefix: str = Field(
        default="Minimalist black-and-white matchstick figure style illustration, clean lines, simple sketch style",
        description="Prompt prefix for all video generation"
    )


class ComfyUIConfig(BaseModel):
    """ComfyUI configuration (includes global settings and service-specific configs)"""
    comfyui_url: str = Field(default="http://127.0.0.1:8188", description="ComfyUI Server URL")
    comfyui_api_key: Optional[str] = Field(default=None, description="ComfyUI API Key (optional)")
    runninghub_api_key: Optional[str] = Field(default=None, description="RunningHub API Key (optional)")
    runninghub_concurrent_limit: int = Field(default=1, ge=1, le=10, description="RunningHub concurrent execution limit (1-10)")
    runninghub_instance_type: Optional[str] = Field(default=None, description="RunningHub instance type (optional, set to 'plus' for 48GB VRAM)")
    tts: TTSSubConfig = Field(default_factory=TTSSubConfig, description="TTS-specific configuration")
    image: ImageSubConfig = Field(default_factory=ImageSubConfig, description="Image-specific configuration")
    video: VideoSubConfig = Field(default_factory=VideoSubConfig, description="Video-specific configuration")


# ==================== Azure OpenAI Configuration ====================

class AzureOpenAIImageConfig(BaseModel):
    """Azure OpenAI Image Generation configuration (GPT-image-2 / DALL-E 3)"""
    endpoint: Optional[str] = Field(default=None, description="Azure OpenAI endpoint URL")
    api_key: Optional[str] = Field(default=None, description="Azure OpenAI API key")
    deployment: str = Field(default="gpt-image-1", description="Deployment name (e.g., gpt-image-1, dall-e-3)")
    api_version: str = Field(default="2025-04-01-preview", description="API version")
    default_size: str = Field(default="1024x1024", description="Default image size")
    default_quality: str = Field(default="auto", description="Default quality: auto, high, medium, low")
    output_format: str = Field(default="png", description="Output format: png, jpeg, webp")
    output_dir: str = Field(default="output/images", description="Directory for saving generated images")


class AzureOpenAIConfig(BaseModel):
    """Azure OpenAI configuration (umbrella for all Azure OpenAI services)"""
    image: AzureOpenAIImageConfig = Field(
        default_factory=AzureOpenAIImageConfig, 
        description="Azure OpenAI Image Generation (GPT-image-2)"
    )


# ==================== Image Provider Selection ====================

class ImageProviderConfig(BaseModel):
    """
    Image provider selection configuration
    
    Allows switching between different image generation backends:
    - comfyui: Use ComfyUI workflows (default, existing behavior)
    - azure_openai: Use Azure OpenAI GPT-image-2 / DALL-E 3
    """
    provider: Literal["comfyui", "azure_openai"] = Field(
        default="comfyui",
        description="Image generation provider: 'comfyui' or 'azure_openai'"
    )


class TemplateConfig(BaseModel):
    """Template configuration"""
    default_template: str = Field(
        default="1080x1920/default.html",
        description="Default frame template path"
    )


class PixelleVideoConfig(BaseModel):
    """Pixelle-Video main configuration"""
    project_name: str = Field(default="Pixelle-Video", description="Project name")
    llm: LLMConfig = Field(default_factory=LLMConfig)
    comfyui: ComfyUIConfig = Field(default_factory=ComfyUIConfig)
    azure_openai: AzureOpenAIConfig = Field(default_factory=AzureOpenAIConfig)
    image_provider: ImageProviderConfig = Field(default_factory=ImageProviderConfig)
    template: TemplateConfig = Field(default_factory=TemplateConfig)
    
    def is_llm_configured(self) -> bool:
        """Check if LLM is properly configured"""
        return bool(
            self.llm.api_key and self.llm.api_key.strip() and
            self.llm.base_url and self.llm.base_url.strip() and
            self.llm.model and self.llm.model.strip()
        )
    
    def is_azure_image_configured(self) -> bool:
        """Check if Azure OpenAI Image is properly configured"""
        return bool(
            self.azure_openai.image.endpoint and 
            self.azure_openai.image.api_key and 
            self.azure_openai.image.deployment
        )
    
    def get_image_provider(self) -> str:
        """Get active image provider"""
        return self.image_provider.provider
    
    def validate_required(self) -> bool:
        """Validate required configuration"""
        return self.is_llm_configured()
    
    def to_dict(self) -> dict:
        """Convert to dictionary (for backward compatibility)"""
        return self.model_dump()
