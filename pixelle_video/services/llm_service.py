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

API Styles:
- chat_completions: Standard OpenAI chat.completions.create() (default)
- azure_responses: Azure OpenAI Responses API for GPT-5.5, o3, etc.
"""

import json
import re
from typing import Optional, Type, TypeVar, Union

from loguru import logger
from openai import AsyncAzureOpenAI, AsyncOpenAI
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


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
    - Azure OpenAI Responses API (gpt-5.5, o3) - via api_style: azure_responses
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
            config: Full application config dict (kept for backward compatibility)
        """
        # Note: We no longer cache config here to support hot reload
        # Config is read dynamically from config_manager in _get_config_value()
        self._client: Optional[AsyncOpenAI] = None
        self._azure_client: Optional[AsyncAzureOpenAI] = None
    
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
    
    def _get_api_style(self) -> str:
        """Get the configured API style"""
        return self._get_config_value("api_style", "chat_completions")
    
    def _create_client(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> AsyncOpenAI:
        """
        Create OpenAI client for chat_completions style
        
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
    
    def _create_azure_client(self) -> AsyncAzureOpenAI:
        """
        Create Azure OpenAI client for azure_responses style
        
        Returns:
            AsyncAzureOpenAI client instance
        """
        endpoint = self._get_config_value("azure_endpoint")
        api_key = self._get_config_value("azure_api_key")
        api_version = self._get_config_value("azure_api_version", "2025-03-01-preview")
        
        if not endpoint or not api_key:
            raise ValueError(
                "Azure Responses API requires azure_endpoint and azure_api_key in config. "
                "Set llm.azure_endpoint and llm.azure_api_key, or use api_style: chat_completions"
            )
        
        return AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
        )
    
    async def __call__(
        self,
        prompt: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_type: Optional[Type[T]] = None,
        api_style: Optional[str] = None,  # Override config api_style
        **kwargs
    ) -> Union[str, T]:
        """
        Generate text using LLM
        
        Args:
            prompt: The prompt to generate from
            api_key: API key (optional, uses config if not provided)
            base_url: Base URL (optional, uses config if not provided)
            model: Model name (optional, uses config if not provided)
            temperature: Sampling temperature (0.0-2.0). Lower is more deterministic.
            max_tokens: Maximum tokens to generate
            response_type: Optional Pydantic model class for structured output.
                          If provided, returns parsed model instance instead of string.
            api_style: Override API style ("chat_completions" or "azure_responses")
            **kwargs: Additional provider-specific parameters
        
        Returns:
            Generated text (str) or parsed Pydantic model instance (if response_type provided)
        
        Examples:
            # Basic text generation
            answer = await pixelle_video.llm("Explain atomic habits")
            
            # Structured output with Pydantic model
            class MovieReview(BaseModel):
                title: str
                rating: int
                summary: str
            
            review = await pixelle_video.llm(
                prompt="Review the movie Inception",
                response_type=MovieReview
            )
            print(review.title)  # Structured access
        """
        # Determine API style
        effective_api_style = api_style or self._get_api_style()
        
        if effective_api_style == "azure_responses":
            return await self._call_azure_responses(
                prompt=prompt,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_type=response_type,
                **kwargs
            )
        else:
            return await self._call_chat_completions(
                prompt=prompt,
                api_key=api_key,
                base_url=base_url,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_type=response_type,
                **kwargs
            )
    
    async def _call_chat_completions(
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
        Call LLM using standard chat.completions API
        """
        # Create client (new instance each time to support parameter overrides)
        client = self._create_client(api_key=api_key, base_url=base_url)
        
        # Get model (priority: parameter > config)
        final_model = (
            model
            or self._get_config_value("model")
            or "gpt-3.5-turbo"  # Default fallback
        )
        
        logger.debug(f"LLM call (chat_completions): model={final_model}, base_url={client.base_url}, response_type={response_type}")
        
        try:
            if response_type is not None:
                # Structured output mode
                return await self._call_with_structured_output(
                    client=client,
                    model=final_model,
                    prompt=prompt,
                    response_type=response_type,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs
                )
            else:
                # Standard text output mode
                response = await client.chat.completions.create(
                    model=final_model,
                    messages=[{"role": "user", "content": prompt}],
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
    
    async def _call_azure_responses(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_type: Optional[Type[T]] = None,
        **kwargs
    ) -> Union[str, T]:
        """
        Call LLM using Azure OpenAI Responses API
        
        The Responses API uses a different format:
        - responses.create() instead of chat.completions.create()
        - input: str instead of messages: list
        - Returns response.output_text instead of choices[0].message.content
        """
        client = self._create_azure_client()
        
        # Get deployment (model) name
        final_model = (
            model
            or self._get_config_value("azure_deployment")
            or self._get_config_value("model")
            or "gpt-55"  # Default fallback for Azure
        )
        
        logger.debug(f"LLM call (azure_responses): deployment={final_model}, endpoint={client._azure_endpoint}")
        
        try:
            # For structured output, enhance the prompt with JSON schema instructions
            effective_prompt = prompt
            if response_type is not None:
                json_instruction = self._get_json_schema_instruction(response_type)
                effective_prompt = f"{prompt}\n\n{json_instruction}"
            
            # Azure Responses API call
            # Note: GPT-5.5/o3 via Azure Responses API does NOT support temperature
            # Remove temperature from kwargs if present to avoid 400 errors
            kwargs.pop("temperature", None)
            
            response = await client.responses.create(
                model=final_model,
                input=effective_prompt,
                max_output_tokens=max_tokens,
                # temperature not supported by GPT-5.5 Responses API
                **kwargs
            )
            
            # Extract text from response
            # The Responses API returns output_text directly
            if hasattr(response, 'output_text'):
                result = response.output_text
            elif hasattr(response, 'output') and isinstance(response.output, list):
                # Handle array output format
                result = "".join(
                    item.content[0].text if hasattr(item, 'content') else str(item)
                    for item in response.output
                    if hasattr(item, 'type') and item.type == 'message'
                )
            else:
                # Fallback: try to get content from first choice if available
                result = str(response)
            
            logger.debug(f"Azure Responses API response length: {len(result)} chars")
            
            if response_type is not None:
                return self._parse_response_as_model(result, response_type)
            
            return result
        
        except Exception as e:
            logger.error(f"Azure Responses API error (deployment={final_model}): {e}")
            raise
    
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
        Call LLM with structured output support (chat_completions style)
        
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
        api_style = self._get_api_style()
        if api_style == "azure_responses":
            return self._get_config_value("azure_deployment") or self._get_config_value("model", "gpt-55")
        return self._get_config_value("model", "gpt-3.5-turbo")
    
    @property
    def api_style(self) -> str:
        """
        Get active API style
        
        Returns:
            API style ("chat_completions" or "azure_responses")
        """
        return self._get_api_style()
    
    def __repr__(self) -> str:
        """String representation"""
        model = self.active
        api_style = self._get_api_style()
        if api_style == "azure_responses":
            endpoint = self._get_config_value("azure_endpoint", "not configured")
            return f"<LLMService api_style={api_style!r} model={model!r} endpoint={endpoint!r}>"
        else:
            base_url = self._get_config_value("base_url", "default")
            return f"<LLMService api_style={api_style!r} model={model!r} base_url={base_url!r}>"
