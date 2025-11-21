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
LLM (Large Language Model) Service - Direct OpenAI SDK implementation
"""

import os
from typing import Optional

from openai import AsyncOpenAI
from loguru import logger


class LLMService:
    """
    LLM (Large Language Model) service
    
    Direct implementation using OpenAI SDK. No capability layer needed.
    
    Supports all OpenAI SDK compatible providers:
    - OpenAI (gpt-4o, gpt-4o-mini, gpt-3.5-turbo)
    - Alibaba Qwen (qwen-max, qwen-plus, qwen-turbo)
    - Anthropic Claude (claude-sonnet-4-5, claude-opus-4, claude-haiku-4)
    - DeepSeek (deepseek-chat)
    - Moonshot Kimi (moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k)
    - Ollama (llama3.2, qwen2.5, mistral, codellama) - FREE & LOCAL!
    - Any custom provider with OpenAI-compatible API
    
    Usage:
        # Direct call
        answer = await pixelle_video.llm("Explain atomic habits")
        
        # With parameters
        answer = await pixelle_video.llm(
            prompt="Explain atomic habits in 3 sentences",
            temperature=0.7,
            max_tokens=2000
        )
    """
    
    def __init__(self, config: dict):
        """
        Initialize LLM service
        
        Args:
            config: Full application config dict
        """
        self.config = config.get("llm", {})
        self._client: Optional[AsyncOpenAI] = None
    
    def _get_config_value(self, key: str, default=None):
        """
        Get config value from config file
        
        Args:
            key: Config key name
            default: Default value if not found
        
        Returns:
            Config value
        """
        return self.config.get(key, default)
    
    def _create_client(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> AsyncOpenAI:
        """
        Create OpenAI client
        
        Args:
            api_key: API key (optional, uses config if not provided)
            base_url: Base URL (optional, uses config if not provided)
        
        Returns:
            AsyncOpenAI client instance
        """
        # Get API key (priority: parameter > config)
        final_api_key = (
            api_key
            or self._get_config_value("api_key")
            or "dummy-key"  # Ollama doesn't need real key
        )
        
        # Get base URL (priority: parameter > config)
        final_base_url = (
            base_url
            or self._get_config_value("base_url")
        )
        
        # Create client
        client_kwargs = {"api_key": final_api_key}
        if final_base_url:
            client_kwargs["base_url"] = final_base_url
        
        return AsyncOpenAI(**client_kwargs)
    
    async def __call__(
        self,
        prompt: Optional[str] = None,
        messages: Optional[list] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs
    ) -> str:
        """
        Generate text using LLM
        
        Supports both simple prompt and messages format (for vision, multi-turn chat, etc.)
        
        Args:
            prompt: Simple text prompt (for basic text generation)
            messages: OpenAI messages format (for vision, multi-turn chat)
                     Example: [{"role": "user", "content": [
                         {"type": "text", "text": "..."},
                         {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
                     ]}]
            api_key: API key (optional, uses config if not provided)
            base_url: Base URL (optional, uses config if not provided)
            model: Model name (optional, uses config if not provided)
            temperature: Sampling temperature (0.0-2.0). Lower is more deterministic.
            max_tokens: Maximum tokens to generate
            **kwargs: Additional provider-specific parameters
        
        Returns:
            Generated text
        
        Examples:
            # Simple text prompt
            answer = await pixelle_video.llm("Explain atomic habits")
            
            # Vision with messages format
            answer = await pixelle_video.llm(
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What's in this image?"},
                        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
                    ]
                }]
            )
            
            # Override with custom parameters
            answer = await pixelle_video.llm(
                prompt="Explain atomic habits in 3 sentences",
                api_key="sk-custom-key",
                base_url="https://api.custom.com/v1",
                model="custom-model",
                temperature=0.7,
                max_tokens=500
            )
        """
        # Validate input: must provide either prompt or messages
        if prompt is None and messages is None:
            raise ValueError("Either 'prompt' or 'messages' must be provided")
        if prompt is not None and messages is not None:
            raise ValueError("Cannot provide both 'prompt' and 'messages', choose one")
        
        # Create client (new instance each time to support parameter overrides)
        client = self._create_client(api_key=api_key, base_url=base_url)
        
        # Get model (priority: parameter > config)
        final_model = (
            model
            or self._get_config_value("model")
            or "gpt-3.5-turbo"  # Default fallback
        )
        
        logger.debug(f"LLM call: model={final_model}, base_url={client.base_url}")
        
        try:
            # Convert simple prompt to messages format if needed
            if prompt is not None:
                final_messages = [{"role": "user", "content": prompt}]
            else:
                final_messages = messages
            
            response = await client.chat.completions.create(
                model=final_model,
                messages=final_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            result = response.choices[0].message.content
            logger.debug(f"LLM response length: {len(result)} chars")
            
            return result
        
        except Exception as e:
            logger.error(f"LLM call error (model={final_model}, base_url={client.base_url}): {e}")
            raise
    
    @property
    def active(self) -> str:
        """
        Get active model name
        
        Returns:
            Active model name
        
        Example:
            print(f"Using model: {pixelle_video.llm.active}")
        """
        return self._get_config_value("model", "gpt-3.5-turbo")
    
    def __repr__(self) -> str:
        """String representation"""
        model = self.active
        base_url = self._get_config_value("base_url", "default")
        return f"<LLMService model={model!r} base_url={base_url!r}>"

