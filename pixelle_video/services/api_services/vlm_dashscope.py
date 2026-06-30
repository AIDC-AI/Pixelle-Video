# -*- coding: utf-8 -*-
"""
Qwen3.5-VL 多模态大模型 API 客户端（DashScope 多模态接口专用）
只支持 Qwen3.5-VL 及兼容 DashScope 多模态对话接口
参考官方文档：https://help.aliyun.com/zh/model-studio/qwen-api-reference
"""

import os

try:
    import dashscope
    from dashscope import MultiModalConversation
except ImportError:
    dashscope = None
    MultiModalConversation = None
import logging

logger = logging.getLogger(__name__)
from typing import Any, Dict, List, Optional

class QwenVLClient:
    def __init__(self,
                 api_key: Optional[str] = None, 
                 base_url: Optional[str] = None):
        """
        Qwen3.5-VL 多模态客户端
        :param api_key: DashScope/Qwen3.5 API Key
        :param model: 模型名（如 qwen3.5-plus/qwen3.5-max 等）
        """
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY")

    def chat(
        self,
        text: str,
        images: List[str],
        model: str,
        stream: bool = False,
        parameters: Optional[Dict] = None,
        videos: Optional[List[str]] = None,
        **kwargs
    ) -> Any:
        """
        使用阿里云 dashscope SDK 进行多模态对话（文本+图片/视频），风格与 image_dashscope.py 一致。
        :param text: 文本内容
        :param images: 图片路径列表（支持本地路径或URL，内部会转换为file://绝对路径）
        :param videos: 视频路径列表（支持本地路径或URL，内部会转换为file://绝对路径）
        :param model: 模型名（支持qwen3.5-plus, qwen3-vl-plus）
        :param stream: 是否流式输出（暂不支持流式）
        :param parameters: 其他API参数
        :return: API响应内容 dict
        """
        if dashscope is None or MultiModalConversation is None:
            raise RuntimeError("dashscope package not installed. Run: pip install dashscope")

        dashscope.api_key = self.api_key
        # 只支持非流式
        try:
            content = [
                {"text": text},
                *({"image": p} for p in images),
                *({"video": p} for p in videos or []),
            ]
            messages = [{"role": "user", "content": content}]
            response = MultiModalConversation.call(
                model=model,
                messages=messages,
                api_key=self.api_key,
                enable_thinking=False,
                **(parameters or {})
            )
            if hasattr(response, 'status_code') and response.status_code == 200:
                # qwen3.5-plus 的返回格式为 { choices: [ { message: { content: [...] } } ] }
                resp = response.output.choices[0].message.content[0]
                if resp.get('text'):
                    return resp['text']
                return resp
            else:
                raise RuntimeError(f"DashScope QwenVLClient failed: {getattr(response, 'message', response)}")
        except Exception as e:
            raise RuntimeError(f"DashScope QwenVLClient error: {e}")
