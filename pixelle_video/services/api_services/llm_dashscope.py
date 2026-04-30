# -*- coding: utf-8 -*-
"""
Qwen LLM API 客户端（DashScope Generation API）
支持 qwen3.5-plus, qwen3.5-max 等模型
"""

import os
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import dashscope
    from dashscope import Generation
except ImportError:
    dashscope = None
    Generation = None


class QwenLLM:
    """
    Qwen LLM 客户端，使用 DashScope Generation API
    支持纯文本生成（可作为 LLM 使用）
    """
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        """
        :param api_key: DashScope API Key
        :param base_url: DashScope API Base URL (可选)
        """
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY")
        self.base_url = base_url or os.getenv("DASHSCOPE_BASE_URL")

        if not self.api_key:
            print("Warning: DASHSCOPE_API_KEY is not set.")

        if dashscope:
            dashscope.api_key = self.api_key
            if self.base_url:
                dashscope.base_http_api_url = self.base_url

        self.max_attempts = 3
        self.max_tokens = 8000

    def query(self, prompt: str, image_urls: list = None, model: str = "qwen3.5-vl", web_search: bool = False):
        """
        Query Qwen model for text generation.
        Note: This is for text-only LLM use. For image+text, use VLM client.

        :param prompt: Text prompt
        :param image_urls: Ignored in this LLM implementation (use VLM for multimodal)
        :param model: Model name (e.g., qwen3.5-vl, qwen3.5-plus, qwen3.5-max)
        :param web_search: If True, adds enable_search: True to API call
        """
        if dashscope is None:
            raise RuntimeError("dashscope package not installed. Run: pip install dashscope")

        if not model:
            model = "qwen3.5-plus"

        messages = [{"role": "system", "content": "You are a helpful assistant."}]
        messages.append({"role": "user", "content": prompt})

        attempts = 0
        while attempts < self.max_attempts:
            try:
                # Build request parameters
                request_params = {
                    "model": model,
                    "messages": messages,
                    "result_format": "message",
                    "stream": False,
                    "max_tokens": self.max_tokens
                }
                # Add web search if enabled
                if web_search:
                    request_params["enable_search"] = True

                response = Generation.call(api_key=self.api_key, **request_params)

                if response.status_code == 200:
                    choice = response.output.choices[0]
                    if choice.message.content:
                        return choice.message.content
                    elif hasattr(choice.message, 'reasoning_content') and choice.message.reasoning_content:
                        return choice.message.reasoning_content
                    else:
                        print("Received an empty response from Qwen. Retrying.")
                        time.sleep(2)
                else:
                    error_msg = f"Qwen API error: {response.code} - {response.message}"
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)

            except Exception as e:
                logger.error(f"Error occurred with Qwen: {e}. Retrying.")
                time.sleep(5)

            attempts += 1

        raise Exception("Max attempts reached, failed to get a response from Qwen.")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config

    # 支持的模型列表

    MODELS = ["qwen3.6-max-preview", "qwen3-max", "deepseek-v3.2"]

    print("=== DashScope LLM 可用性测试 ===")
    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        print("✗ DASHSCOPE_API_KEY 未设置，跳过")
        sys.exit(1)
    print(f"  API Key: {api_key[:6]}***{api_key[-4:]}")

    client = QwenLLM(api_key=api_key)
    prompt = "用一句话介绍你自己。"
    print(f"  Prompt: {prompt}")

    for model in MODELS:
        print(f"\n--- 测试模型: {model} ---")
        t0 = time.time()
        try:
            resp = client.query(prompt, model=model)
            elapsed = time.time() - t0
            print(f"✓ 响应 ({elapsed:.1f}s): {resp.strip()[:200]}")
        except Exception as e:
            print(f"✗ 失败: {e}")
