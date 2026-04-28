# -*- coding: utf-8 -*-
"""
Google Gemini 多模态大模型 API 客户端 (OpenAI 兼容格式)
支持 gemini-2.5-flash-image, gemini-2.5-pro 等视觉模型

可用模型:
    - gemini-2.5-flash-image (性价比最高)
    - gemini-2.5-pro (效果最好)
    - gemini-3-pro-preview
    - gemini-3-pro-image-preview
"""

import os
import time
import base64
from openai import OpenAI
from typing import Dict, List, Optional

class GeminiVLClient:
    """
    Gemini VLM 客户端，使用 OpenAI 兼容格式调用
    """
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        """
        Gemini 多模态客户端
        :param api_key: Gemini API Key
        :param base_url: 自定义 Base URL（可选，用于代理）
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        default_url = "https://generativelanguage.googleapis.com/v1beta"
        self.base_url = base_url or os.getenv("GOOGLE_GEMINI_BASE_URL", default_url)
        if self.base_url and not self.base_url.endswith("/v1"):
            self.base_url = self.base_url.rstrip("/") + "/v1"
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        self.max_attempts = 10
        self.max_tokens = 8000

    def _encode_image(self, image_path: str) -> str:
        """将本地图片编码为 base64"""
        abs_path = os.path.abspath(image_path)
        with open(abs_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def _get_mime_type(self, image_path: str) -> str:
        """根据文件扩展名获取 MIME 类型"""
        ext = os.path.splitext(image_path)[1].lower()
        mime_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif"
        }
        return mime_types.get(ext, "image/jpeg")

    def chat(self, text: str, images: List[str], model: str = "gemini-2.5-flash-image",
             parameters: Optional[Dict] = None) -> str:
        """
        使用 Gemini 进行多模态对话（文本+图片）
        :param text: 文本内容
        :param images: 图片路径列表（支持本地路径或URL）
        :param model: 模型名（如 gemini-2.5-flash-image, gemini-2.5-pro）
        :param parameters: 其他API参数
        :return: API响应内容
        """
        # 构建消息格式
        content: list = [{"type": "text", "text": text}]

        # 处理图片
        if images:
            for img_path in images:
                if img_path.startswith("data:"):
                    # Base64 数据 URL，直接使用
                    content.append({
                        "type": "image_url",
                        "image_url": {"url": img_path}
                    })
                elif img_path.startswith("http"):
                    # URL 图片
                    content.append({
                        "type": "image_url",
                        "image_url": {"url": img_path}
                    })
                else:
                    # 本地图片 - 转为 base64
                    mime_type = self._get_mime_type(img_path)
                    base64_data = self._encode_image(img_path)
                    data_url = f"data:{mime_type};base64,{base64_data}"
                    content.append({
                        "type": "image_url",
                        "image_url": {"url": data_url}
                    })

        messages = [{"role": "user", "content": content}]

        attempts = 0
        while attempts < self.max_attempts:
            try:
                # 直接使用模型名
                response = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=self.max_tokens,
                    temperature=parameters.get("temperature", 0.7) if parameters else 0.7
                )

                if response.choices and len(response.choices) > 0:
                    return response.choices[0].message.content

            except Exception as e:
                print(f"GeminiVL 请求错误: {e}")
                attempts += 1
                if attempts < self.max_attempts:
                    time.sleep(10)

        raise Exception("GeminiVL: 达到最大重试次数，仍未获得有效响应。")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config

    # 支持的 VLM 模型列表
    MODELS = ["gemini-2.5-flash-image", "gemini-2.0-flash"]

    print("=== Gemini VL 多模态可用性测试 ===")
    api_key = Config.GEMINI_API_KEY
    if not api_key:
        print("✗ GEMINI_API_KEY 未设置，跳过")
        sys.exit(1)
    print(f"  API Key: {api_key[:6]}***")
    client = GeminiVLClient(api_key=api_key)

    # 测试图片（使用示例图片）
    img_path = ""
    if not os.path.exists(img_path):
        print(f"✗ 测试图片不存在: {img_path}")
        img_path = "backend/code/result/image/test_avail/test_input.png"
        if not os.path.exists(img_path):
            print("✗ 跳过图片测试（无测试图片）")
            sys.exit(0)

    text = "请描述这张图片的内容"
    print(f"\n[多模态] Prompt: {text}")
    print(f"  图片: {img_path}")

    for model in MODELS:
        print(f"\n--- 测试模型: {model} ---")
        t0 = time.time()
        try:
            result = client.chat(text=text, images=[img_path], model=model)
            elapsed = time.time() - t0
            if result:
                print(f"✓ 返回结果 ({elapsed:.1f}s): {result[:200]}")
            else:
                print(f"✗ 返回空结果 ({elapsed:.1f}s)")
        except Exception as e:
            print(f"✗ 失败: {e}")
