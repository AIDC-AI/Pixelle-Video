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
LLM utility functions for model discovery and connection testing.

Uses the standard OpenAI-compatible /v1/models endpoint.
"""

from typing import List, Tuple
import httpx
from loguru import logger


def fetch_available_models(api_key: str, base_url: str, timeout: float = 10.0) -> List[str]:
    """
    Fetch available models from an OpenAI-compatible API endpoint.
    
    Uses the standard GET /v1/models endpoint with Bearer token authentication.
    
    Args:
        api_key: The API key for authentication
        base_url: The base URL of the API (e.g., https://api.openai.com/v1)
        timeout: Request timeout in seconds
    
    Returns:
        List of model IDs available from the API
    
    Raises:
        httpx.HTTPStatusError: If the API returns an error status code
        httpx.RequestError: If there's a network error
    """
    # Normalize base_url - ensure it ends with /v1 or similar
    base_url = base_url.rstrip("/")
    
    # Build the models endpoint URL
    models_url = f"{base_url}/models"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    logger.debug(f"Fetching models from: {models_url}")
    
    with httpx.Client(timeout=timeout) as client:
        response = client.get(models_url, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        models = [model["id"] for model in data.get("data", [])]
        
        # Sort models alphabetically for better UX
        models.sort()
        
        logger.debug(f"Fetched {len(models)} models")
        return models


def test_llm_connection(api_key: str, base_url: str, timeout: float = 10.0) -> Tuple[bool, str, int]:
    """
    Test the LLM API connection by attempting to fetch the models list.
    
    Args:
        api_key: The API key for authentication
        base_url: The base URL of the API
        timeout: Request timeout in seconds
    
    Returns:
        Tuple of (success: bool, message: str, model_count: int)
        - success: True if connection succeeded
        - message: Human-readable status message
        - model_count: Number of models available (0 if failed)
    """
    try:
        models = fetch_available_models(api_key, base_url, timeout)
        return True, f"Connection successful! {len(models)} models available.", len(models)
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        if status_code == 401:
            return False, "Authentication failed: Invalid API Key", 0
        elif status_code == 403:
            return False, "Access forbidden: Check your API Key permissions", 0
        elif status_code == 404:
            return False, "API endpoint not found: Check your Base URL", 0
        else:
            return False, f"API error: HTTP {status_code}", 0
    except httpx.ConnectError:
        return False, "Connection failed: Cannot reach the server", 0
    except httpx.TimeoutException:
        return False, "Connection timeout: Server did not respond in time", 0
    except Exception as e:
        logger.error(f"LLM connection test error: {e}")
        return False, f"Error: {str(e)}", 0
