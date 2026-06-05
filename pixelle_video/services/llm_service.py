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

Supports structured output via response_type parameter (Pydantic model).
Also supports Anthropic-compatible APIs (e.g., BigModel GLM Coding Plan).
"""

import asyncio
import json
import random
import re
from typing import Optional, Type, TypeVar, Union

import httpx
from openai import AsyncOpenAI
from pydantic import BaseModel
from loguru import logger


T = TypeVar("T", bound=BaseModel)

# Retry configuration for LLM API calls
_LLM_RETRY_COUNT = 3           # Max retries for transient errors
_LLM_RETRY_BASE_DELAY = 2.0    # Base delay in seconds
_LLM_RETRY_MAX_DELAY = 15.0    # Max delay in seconds


class LLMService:
    """
    LLM (Large Language Model) service

    Direct implementation using OpenAI SDK. Also supports Anthropic-compatible
    providers via direct HTTP calls when llm.provider is set to "anthropic".

    Supports all OpenAI SDK compatible providers:
    - OpenAI (gpt-4o, gpt-4o-mini, gpt-3.5-turbo)
    - Alibaba Qwen (qwen-max, qwen-plus, qwen-turbo)
    - DeepSeek (deepseek-chat)
    - Moonshot Kimi (moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k)
    - Ollama (llama3.2, qwen2.5, mistral, codellama) - FREE & LOCAL!
    - Any custom provider with OpenAI-compatible API

    Also supports Anthropic-compatible providers:
    - BigModel GLM (GLM-5.1, etc.) via Anthropic API
    - Anthropic Claude

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
            config: Full application config dict (kept for backward compatibility)
        """
        # Note: We no longer cache config here to support hot reload
        # Config is read dynamically from config_manager in _get_config_value()
        self._client: Optional[AsyncOpenAI] = None

    def _get_config_value(self, key: str, default=None):
        """
        Get config value dynamically from config_manager (supports hot reload)

        Args:
            key: Config key name
            default: Default value if not found

        Returns:
            Config value
        """
        from pixelle_video.config import config_manager
        return getattr(config_manager.config.llm, key, default)

    def _is_anthropic_provider(self) -> bool:
        """Check if the configured base_url points to an Anthropic-compatible API."""
        base_url = self._get_config_value("base_url") or ""
        provider = self._get_config_value("provider") or ""
        return provider.lower() == "anthropic" or "/anthropic" in base_url.lower()
    
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
        prompt: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_type: Optional[Type[T]] = None,
        **kwargs
    ) -> Union[str, T]:
        """
        Generate text using LLM

        Automatically detects whether to use OpenAI SDK or Anthropic HTTP API
        based on the configured base_url.

        Args:
            prompt: The prompt to generate from
            api_key: API key (optional, uses config if not provided)
            base_url: Base URL (optional, uses config if not provided)
            model: Model name (optional, uses config if not provided)
            temperature: Sampling temperature (0.0-2.0). Lower is more deterministic.
            max_tokens: Maximum tokens to generate
            response_type: Optional Pydantic model class for structured output.
                          If provided, returns parsed model instance instead of string.
            **kwargs: Additional provider-specific parameters

        Returns:
            Generated text (str) or parsed Pydantic model instance (if response_type provided)
        """
        # Get final config values
        final_api_key = api_key or self._get_config_value("api_key") or "dummy-key"
        final_base_url = base_url or self._get_config_value("base_url")
        final_model = model or self._get_config_value("model") or "gpt-3.5-turbo"

        # Build enhanced prompt for structured output
        enhanced_prompt = prompt
        if response_type is not None:
            json_schema_instruction = self._get_json_schema_instruction(response_type)
            enhanced_prompt = f"{prompt}\n\n{json_schema_instruction}"

        logger.debug(f"LLM call: model={final_model}, base_url={final_base_url}, anthropic={self._is_anthropic_provider()}")

        try:
            return await self._call_with_retry(
                api_key=final_api_key,
                base_url=final_base_url,
                model=final_model,
                enhanced_prompt=enhanced_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                response_type=response_type,
                api_key_param=api_key,
                base_url_param=base_url,
                kwargs=kwargs,
            )

        except Exception as e:
            logger.error(f"LLM call error (model={final_model}, base_url={final_base_url}): {e}")
            raise

    async def _call_with_retry(
        self,
        api_key: str,
        base_url: str,
        model: str,
        enhanced_prompt: str,
        temperature: float,
        max_tokens: int,
        response_type: Optional[Type[T]],
        api_key_param: Optional[str],
        base_url_param: Optional[str],
        kwargs: dict,
    ) -> Union[str, T]:
        """Call LLM with retry for transient errors (5xx, network timeouts)."""
        last_error = None

        for attempt in range(_LLM_RETRY_COUNT + 1):
            try:
                if self._is_anthropic_provider():
                    content = await self._call_anthropic(
                        api_key=api_key,
                        base_url=base_url,
                        model=model,
                        prompt=enhanced_prompt,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                else:
                    client = self._create_client(api_key=api_key_param, base_url=base_url_param)
                    response = await client.chat.completions.create(
                        model=model,
                        messages=[{"role": "user", "content": enhanced_prompt}],
                        temperature=temperature,
                        max_tokens=max_tokens,
                        **kwargs
                    )
                    content = response.choices[0].message.content

                if attempt > 0:
                    logger.success(f"✅ LLM retry succeeded on attempt {attempt + 1}")

                if response_type is not None:
                    return self._parse_response_as_model(content, response_type)
                return content

            except Exception as e:
                last_error = e
                is_retryable = self._is_retryable_error(e)

                if is_retryable and attempt < _LLM_RETRY_COUNT:
                    delay = min(
                        _LLM_RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, 1),
                        _LLM_RETRY_MAX_DELAY,
                    )
                    logger.warning(
                        f"⚠️ LLM transient error (attempt {attempt + 1}/{_LLM_RETRY_COUNT + 1}): {e}. "
                        f"Retrying in {delay:.1f}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    raise

    @staticmethod
    def _is_retryable_error(e: Exception) -> bool:
        """Check if the error is transient and worth retrying."""
        error_str = str(e).lower()
        # 5xx server errors
        if "status=5" in error_str or "500" in error_str or "502" in error_str or "503" in error_str:
            return True
        # Network / timeout errors
        if any(kw in error_str for kw in ["timeout", "network", "connection", "网络错误", "1234"]):
            return True
        # httpx network errors
        if isinstance(e, (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError)):
            return True
        return False

    async def _call_anthropic(
        self,
        api_key: str,
        base_url: str,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """
        Call Anthropic-compatible Messages API via HTTP.

        Supports providers like BigModel GLM Coding Plan that expose
        an Anthropic-compatible endpoint.

        Args:
            api_key: API key
            base_url: Anthropic-compatible base URL (e.g., https://open.bigmodel.cn/api/anthropic)
            model: Model name (e.g., GLM-5.1)
            prompt: The prompt text
            temperature: Sampling temperature
            max_tokens: Max tokens to generate

        Returns:
            Generated text content
        """
        # Normalize base_url: ensure it ends with /v1/messages path
        url = base_url.rstrip("/")
        if not url.endswith("/v1/messages"):
            if url.endswith("/v1"):
                url += "/messages"
            elif url.endswith("/anthropic"):
                url += "/v1/messages"
            else:
                url += "/v1/messages"

        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if temperature is not None:
            payload["temperature"] = temperature

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                error_detail = response.text[:500]
                raise Exception(f"Anthropic API error (status={response.status_code}): {error_detail}")
            data = response.json()
            # Extract text from Anthropic Messages response format
            content_blocks = data.get("content", [])
            texts = [block.get("text", "") for block in content_blocks if block.get("type") == "text"]
            return "".join(texts)
    
    async def _call_with_structured_output(
        self,
        client: AsyncOpenAI,
        model: str,
        prompt: str,
        response_type: Type[T],
        temperature: float,
        max_tokens: int,
        **kwargs
    ) -> T:
        """
        Call LLM with structured output support
        
        Uses JSON schema instruction appended to prompt for maximum compatibility
        across all OpenAI-compatible providers (Qwen, DeepSeek, etc.).
        
        Args:
            client: OpenAI client
            model: Model name
            prompt: The prompt
            response_type: Pydantic model class
            temperature: Sampling temperature
            max_tokens: Max tokens
            **kwargs: Additional parameters
        
        Returns:
            Parsed Pydantic model instance
        """
        # Build JSON schema instruction and append to prompt
        json_schema_instruction = self._get_json_schema_instruction(response_type)
        enhanced_prompt = f"{prompt}\n\n{json_schema_instruction}"
        
        # Call LLM with enhanced prompt
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": enhanced_prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        content = response.choices[0].message.content
        
        logger.debug(f"Structured output response length: {len(content)} chars")
        
        # Parse JSON from response content
        return self._parse_response_as_model(content, response_type)
    
    def _get_json_schema_instruction(self, response_type: Type[T]) -> str:
        """
        Generate JSON schema instruction for LLM fallback mode
        
        Args:
            response_type: Pydantic model class
        
        Returns:
            Formatted instruction string with JSON schema
        """
        try:
            # Get JSON schema from Pydantic model
            schema = response_type.model_json_schema()
            schema_str = json.dumps(schema, indent=2, ensure_ascii=False)
            
            return f"""## IMPORTANT: JSON Output Format Required
You MUST respond with ONLY a valid JSON object (no markdown, no extra text).
The JSON must strictly follow this schema:

```json
{schema_str}
```

Output ONLY the JSON object, nothing else."""
        except Exception as e:
            logger.warning(f"Failed to generate JSON schema: {e}")
            return """## IMPORTANT: JSON Output Format Required
You MUST respond with ONLY a valid JSON object (no markdown, no extra text)."""
    
    def _parse_response_as_model(self, content: str, response_type: Type[T]) -> T:
        """
        Parse LLM response content as Pydantic model
        
        Args:
            content: Raw LLM response text
            response_type: Target Pydantic model class
        
        Returns:
            Parsed model instance
        """
        # Try direct JSON parsing first
        try:
            data = json.loads(content)
            return response_type.model_validate(data)
        except json.JSONDecodeError:
            pass
        
        # Try extracting from markdown code block
        json_pattern = r'```(?:json)?\s*([\s\S]+?)\s*```'
        match = re.search(json_pattern, content, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1))
                return response_type.model_validate(data)
            except json.JSONDecodeError:
                pass
        
        # Try to find any JSON object in the text
        brace_start = content.find('{')
        brace_end = content.rfind('}')
        if brace_start != -1 and brace_end > brace_start:
            try:
                json_str = content[brace_start:brace_end + 1]
                data = json.loads(json_str)
                return response_type.model_validate(data)
            except json.JSONDecodeError:
                pass
        
        raise ValueError(f"Failed to parse LLM response as {response_type.__name__}: {content[:200]}...")
    
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
