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
Azure OpenAI Image Service - GPT-image-2 (gpt-image-1, DALL-E 3) support

Direct image generation via Azure OpenAI without ComfyUI workflows.
"""

import asyncio
import os
import random
import uuid
from pathlib import Path
from typing import Optional

import httpx
from loguru import logger
from openai import AsyncAzureOpenAI

from pixelle_video.models.media import MediaResult


class AzureImageService:
    """
    Azure OpenAI Image Generation Service
    
    Supports Azure OpenAI image generation models:
    - gpt-image-1 (GPT-image-2 in Azure)
    - dall-e-3
    
    Usage:
        media = await azure_image_service(
            prompt="A beautiful sunset over mountains",
            size="1024x1024"
        )
        print(f"Generated image: {media.url}")
    """
    
    # Supported sizes per model
    SUPPORTED_SIZES = {
        "gpt-image-1": ["1024x1024", "1024x1536", "1536x1024"],  # GPT-image-2
        "dall-e-3": ["1024x1024", "1024x1792", "1792x1024"],
    }
    
    def __init__(self, config: dict, core=None):
        """
        Initialize Azure Image Service
        
        Args:
            config: Full application config dict
            core: PixelleVideoCore instance (for future extensions)
        """
        self.core = core
        azure_config = config.get("azure_openai", {}).get("image", {})
        
        # Azure OpenAI configuration
        self.endpoint = azure_config.get("endpoint") or os.getenv("AZURE_OPENAI_IMAGE_ENDPOINT")
        self.api_key = azure_config.get("api_key") or os.getenv("AZURE_OPENAI_IMAGE_API_KEY")
        self.deployment = azure_config.get("deployment") or os.getenv("AZURE_OPENAI_IMAGE_DEPLOYMENT", "gpt-image-1")
        self.api_version = azure_config.get("api_version") or os.getenv("AZURE_OPENAI_IMAGE_API_VERSION", "2025-04-01-preview")
        
        # Generation defaults
        self.default_size = azure_config.get("default_size", "1024x1024")
        self.default_quality = azure_config.get("default_quality", "auto")  # auto, high, medium, low
        self.output_format = azure_config.get("output_format", "png")  # png, jpeg, webp
        
        # Output directory for saving generated images
        self.output_dir = azure_config.get("output_dir", "output/images")

        # Provider overload / rate-limit retry policy. Azure image generation can
        # return transient 429 EngineOverloaded responses even after the OpenAI
        # SDK's short built-in retry window. Keep the video task alive and wait.
        self.max_retry_attempts = int(
            azure_config.get("max_retry_attempts")
            or os.getenv("AZURE_OPENAI_IMAGE_MAX_RETRY_ATTEMPTS", "7")
        )
        self.retry_initial_seconds = float(
            azure_config.get("retry_initial_seconds")
            or os.getenv("AZURE_OPENAI_IMAGE_RETRY_INITIAL_SECONDS", "30")
        )
        self.retry_max_seconds = float(
            azure_config.get("retry_max_seconds")
            or os.getenv("AZURE_OPENAI_IMAGE_RETRY_MAX_SECONDS", "300")
        )
        
        self._client: Optional[AsyncAzureOpenAI] = None
    
    def is_configured(self) -> bool:
        """Check if Azure Image service is properly configured"""
        return bool(self.endpoint and self.api_key and self.deployment)
    
    async def _get_client(self) -> AsyncAzureOpenAI:
        """Get or create Azure OpenAI client"""
        if self._client is None:
            if not self.is_configured():
                raise ValueError(
                    "Azure OpenAI Image service not configured. "
                    "Please set endpoint, api_key, and deployment in config.yaml "
                    "under azure_openai.image section, or via environment variables: "
                    "AZURE_OPENAI_IMAGE_ENDPOINT, AZURE_OPENAI_IMAGE_API_KEY, AZURE_OPENAI_IMAGE_DEPLOYMENT"
                )
            
            self._client = AsyncAzureOpenAI(
                azure_endpoint=self.endpoint,
                api_key=self.api_key,
                api_version=self.api_version,
            )
        return self._client
    
    async def __call__(
        self,
        prompt: str,
        size: Optional[str] = None,
        quality: Optional[str] = None,
        n: int = 1,
        style: Optional[str] = None,  # for DALL-E 3: "vivid" or "natural"
        output_path: Optional[str] = None,
        save_locally: bool = True,
        **kwargs
    ) -> MediaResult:
        """
        Generate image using Azure OpenAI
        
        Args:
            prompt: Image generation prompt
            size: Image size (e.g., "1024x1024", "1024x1536")
            quality: Image quality ("auto", "high", "medium", "low")
            n: Number of images to generate (default: 1)
            style: Style for DALL-E 3 ("vivid" or "natural")
            output_path: Custom output path (auto-generated if None)
            save_locally: Whether to download and save image locally (default: True)
            **kwargs: Additional parameters passed to API
        
        Returns:
            MediaResult with image URL (and local path if saved)
        
        Examples:
            # Basic generation
            media = await azure_image(prompt="A cat in a garden")
            
            # With custom size
            media = await azure_image(
                prompt="Portrait of a scientist",
                size="1024x1536"
            )
            
            # High quality
            media = await azure_image(
                prompt="Detailed landscape",
                quality="high"
            )
        """
        client = await self._get_client()
        
        # Resolve parameters
        final_size = size or self.default_size
        final_quality = quality or self.default_quality
        
        # Validate size for model
        model_name = self.deployment.lower()
        if model_name in self.SUPPORTED_SIZES:
            if final_size not in self.SUPPORTED_SIZES[model_name]:
                supported = ", ".join(self.SUPPORTED_SIZES[model_name])
                logger.warning(
                    f"Size '{final_size}' may not be supported by {model_name}. "
                    f"Supported sizes: {supported}"
                )
        
        logger.info(f"🎨 Generating image via Azure OpenAI: model={self.deployment}, size={final_size}, quality={final_quality}")
        logger.debug(f"Prompt: {prompt[:100]}{'...' if len(prompt) > 100 else ''}")
        
        try:
            # Build request parameters
            request_params = {
                "model": self.deployment,
                "prompt": prompt,
                "size": final_size,
                "n": n,
            }
            
            # Add quality if supported (gpt-image-1 supports it)
            if "gpt-image" in model_name or "dall-e-3" in model_name:
                request_params["quality"] = final_quality
            
            # Add style for DALL-E 3
            if style and "dall-e-3" in model_name:
                request_params["style"] = style
            
            # Make API call. Azure image generation may intermittently return
            # 429 EngineOverloaded for several minutes. Retry with exponential
            # backoff + jitter and honour Retry-After when present.
            response = await self._generate_with_retry(client, request_params)
            
            if not response.data:
                raise Exception("No images returned from Azure OpenAI")
            
            image_data = response.data[0]
            
            # Handle response - could be URL or base64
            if hasattr(image_data, 'url') and image_data.url:
                image_url = image_data.url
                logger.info(f"✅ Image generated (URL): {image_url[:80]}...")
            elif hasattr(image_data, 'b64_json') and image_data.b64_json:
                # Base64 response - need to decode and save
                import base64
                image_bytes = base64.b64decode(image_data.b64_json)
                
                # Generate output path
                if not output_path:
                    Path(self.output_dir).mkdir(parents=True, exist_ok=True)
                    unique_id = uuid.uuid4().hex[:8]
                    output_path = f"{self.output_dir}/azure_{unique_id}.{self.output_format}"
                
                with open(output_path, 'wb') as f:
                    f.write(image_bytes)
                
                logger.info(f"✅ Image generated and saved: {output_path}")
                return MediaResult(
                    media_type="image",
                    url=output_path,
                    local_path=output_path
                )
            else:
                raise Exception("Unexpected response format from Azure OpenAI")
            
            # Download and save locally if requested
            if save_locally and image_url:
                if not output_path:
                    Path(self.output_dir).mkdir(parents=True, exist_ok=True)
                    unique_id = uuid.uuid4().hex[:8]
                    output_path = f"{self.output_dir}/azure_{unique_id}.{self.output_format}"
                
                async with httpx.AsyncClient() as http_client:
                    img_response = await http_client.get(image_url)
                    img_response.raise_for_status()
                    
                    with open(output_path, 'wb') as f:
                        f.write(img_response.content)
                
                logger.info(f"✅ Image downloaded to: {output_path}")
                return MediaResult(
                    media_type="image",
                    url=image_url,
                    local_path=output_path
                )
            
            return MediaResult(
                media_type="image",
                url=image_url
            )
        
        except Exception as e:
            logger.error(f"Azure OpenAI image generation failed: {e}")
            raise
    
    def _is_retryable_provider_error(self, exc: Exception) -> bool:
        """Return True for transient Azure/OpenAI provider overload errors."""
        status_code = getattr(exc, "status_code", None)
        response = getattr(exc, "response", None)
        if status_code is None and response is not None:
            status_code = getattr(response, "status_code", None)

        message = str(exc)
        return (
            status_code == 429
            or "EngineOverloaded" in message
            or "too many requests" in message.lower()
            or "rate limit" in message.lower()
        )

    def _retry_after_seconds(self, exc: Exception) -> Optional[float]:
        """Extract Retry-After header if the provider supplied one."""
        response = getattr(exc, "response", None)
        headers = getattr(response, "headers", None) if response is not None else None
        if not headers:
            return None

        value = headers.get("retry-after") or headers.get("Retry-After")
        if not value:
            return None

        try:
            return max(0.0, float(value))
        except (TypeError, ValueError):
            return None

    async def _generate_with_retry(self, client: AsyncAzureOpenAI, request_params: dict):
        """Generate an image with extended retry for transient provider overload."""
        last_error = None

        for attempt in range(1, self.max_retry_attempts + 1):
            try:
                return await client.images.generate(**request_params)
            except Exception as exc:
                last_error = exc
                if not self._is_retryable_provider_error(exc) or attempt >= self.max_retry_attempts:
                    raise

                retry_after = self._retry_after_seconds(exc)
                if retry_after is None:
                    base_delay = min(
                        self.retry_max_seconds,
                        self.retry_initial_seconds * (2 ** (attempt - 1))
                    )
                    jitter = random.uniform(0, min(10.0, base_delay * 0.2))
                    delay = base_delay + jitter
                else:
                    delay = min(self.retry_max_seconds, retry_after)

                logger.warning(
                    "Azure OpenAI image generation overloaded/rate-limited "
                    f"(attempt {attempt}/{self.max_retry_attempts}); "
                    f"retrying in {delay:.1f}s: {exc}"
                )
                await asyncio.sleep(delay)

        raise last_error

    @property
    def available(self) -> bool:
        """Check if service is available (configured)"""
        return self.is_configured()
    
    def __repr__(self) -> str:
        """String representation"""
        status = "configured" if self.is_configured() else "not configured"
        return f"<AzureImageService deployment={self.deployment!r} status={status}>"
