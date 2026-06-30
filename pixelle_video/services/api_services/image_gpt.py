import os
import time
import uuid
import base64
import logging
import httpx
from openai import OpenAI
try:
    from .image_processor import ImageProcessor
except ImportError:
    from image_processor import ImageProcessor


class ImageGPT:
    """
    OpenAI 图片生成客户端
    支持模型：
        - sora_image → Images API
        - gpt-image-2 → Responses API
    """
    def __init__(self,
                 api_key: str = None,
                 base_url: str = None,
                 local_proxy: str = None,
                 timeout: float = 300.0):
        """
        OpenAI 图片生成客户端
        :param api_key: API Key
        :param base_url: 自定义 Base URL（如果传入，则不使用本地代理）
        :param timeout: 超时时间
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.timeout = timeout
        
        kwargs = {"api_key": self.api_key, "timeout": max(self.timeout, 600.0)}
        
        self.base_url = base_url
        if local_proxy:
            kwargs["http_client"] = httpx.Client(
                proxy=local_proxy,
                timeout=self.timeout,
            )
        if self.base_url:
            kwargs["base_url"] = self.base_url
            
        self.client = OpenAI(**kwargs)
        self.max_attempts = 10
        self.image_processor = ImageProcessor(local_proxy=local_proxy)

    def _encode_image_to_base64(self, image_path: str) -> str:
        """将本地图片转换为 Base64 编码"""
        if not image_path or not os.path.exists(image_path):
            return image_path
        
        try:
            with open(image_path, "rb") as f:
                img_data = base64.b64encode(f.read()).decode("utf-8")
            ext = os.path.splitext(image_path)[1].lower().replace(".", "")
            if ext not in ["png", "jpg", "jpeg", "webp"]:
                ext = "png"
            return f"data:image/{ext};base64,{img_data}"
        except Exception as e:
            print(f"Error encoding image {image_path}: {e}")
            return image_path

    def generate_image(self, prompt, size="1024x1024", quality="high", model="gpt-image-2",
                       save_dir=None, image_urls=None):
        """Generate a single image, download it, and return the local file path.

        Args:
            prompt: 图片描述提示词
            size: 图片尺寸
            quality: 图片质量
            model: 模型名称 (sora_image / gpt-image-2)
            save_dir: 保存目录（不传则返回 URL 或 base64）
            image_urls: 参考图片 URL 列表（仅 gpt-image-2 支持）
        """

        attempts = 0
        last_error = None
        
        # 处理参考图片
        extra_body = {}
        if image_urls and isinstance(image_urls, list) and len(image_urls) > 0:
            # 中转站通常支持通过 extra_body 传递 image_url 或 ref_image
            # 这里我们将第一张图作为参考图
            ref_images = [self._encode_image_to_base64(image_urls[i]) for i in range(min(len(image_urls), 6))]
            extra_body = {"image_url": ref_images}

        while attempts < self.max_attempts:
            try:
                response = self.client.images.generate(
                    model=model,
                    prompt=prompt,
                    size=size,
                    quality=quality,
                    n=1,
                    extra_body=extra_body
                )
                
                if not response or not response.data:
                    raise RuntimeError("OpenAI API 返回数据为空")

                img_data = response.data[0]
                file_path = None

                # 1. 处理 Base64 格式 (中转站常用)
                if hasattr(img_data, 'b64_json') and img_data.b64_json:
                    if save_dir:
                        os.makedirs(save_dir, exist_ok=True)
                        file_name = f"gpt_{int(time.time())}_{uuid.uuid4().hex[:6]}.png"
                        file_path = os.path.join(save_dir, file_name)
                        with open(file_path, "wb") as f:
                            f.write(base64.b64decode(img_data.b64_json))
                        return file_path
                    return img_data.b64_json

                # 2. 处理 URL 格式
                elif hasattr(img_data, 'url') and img_data.url:
                    url = img_data.url
                    if save_dir:
                        os.makedirs(save_dir, exist_ok=True)
                        file_name = f"gpt_{int(time.time())}_{uuid.uuid4().hex[:6]}.png"
                        file_path = os.path.join(save_dir, file_name)
                        if self.image_processor.download_image(url, file_path):
                            return file_path
                        return url
                
                raise RuntimeError("未在响应中找到 url 或 b64_json")
            except Exception as e:
                last_error = e
                logging.warning(f"Image generation attempt {attempts + 1}/{self.max_attempts} failed: {e}")
                if attempts < self.max_attempts - 1:
                    wait = min(10 * (2 ** attempts), 120)  # ponytail: exp backoff, max 2min
                    logging.info(f"Retrying in {wait}s...")
                    time.sleep(wait)
            attempts += 1
        raise Exception(f"Max attempts reached, failed to generate image. Last error: {last_error}")

    def generate_images(self, prompt, count=4, size="1024x1024", quality="standard", model=None):
        """Generate multiple image URLs by calling Images API 'count' times."""
        urls = []
        for _ in range(count):
            url = self.generate_image(prompt=prompt, size=size, quality=quality, model=model)
            urls.append(url)
        return urls
