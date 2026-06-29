import os
import time
import uuid
import base64
import re
import httpx
from typing import Optional

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
                 image_api_mode: str = "images",
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
        self.image_api_mode = (image_api_mode or "images").strip().lower()
        if self.image_api_mode not in {"images", "responses"}:
            self.image_api_mode = "images"
        
        kwargs = {"api_key": self.api_key, "timeout": self.timeout}
        
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

    def _save_base64_image(self, b64_value: str, save_dir: Optional[str] = None):
        """Decode an image base64 string and save it when save_dir is provided."""
        raw = base64.b64decode(b64_value, validate=False)
        if raw.startswith(b"\x89PNG"):
            ext = "png"
        elif raw.startswith(b"\xff\xd8"):
            ext = "jpg"
        elif raw.startswith(b"RIFF"):
            ext = "webp"
        else:
            ext = "png"

        if save_dir:
            os.makedirs(save_dir, exist_ok=True)
            file_name = f"gpt_{int(time.time())}_{uuid.uuid4().hex[:6]}.{ext}"
            file_path = os.path.join(save_dir, file_name)
            with open(file_path, "wb") as f:
                f.write(raw)
            return file_path
        return b64_value

    def _extract_image_from_obj(self, obj, save_dir: Optional[str] = None):
        """Find the first image URL or base64 payload in OpenAI-compatible responses."""
        if isinstance(obj, dict):
            # Common image-generation output field names used by Responses API and proxies.
            for key in ("b64_json", "base64", "image_base64", "result"):
                value = obj.get(key)
                if isinstance(value, str) and value:
                    try:
                        return self._save_base64_image(value, save_dir)
                    except Exception:
                        pass

            for key in ("url", "image_url"):
                value = obj.get(key)
                if isinstance(value, str) and value.startswith(("http://", "https://")):
                    if save_dir:
                        os.makedirs(save_dir, exist_ok=True)
                        file_name = f"gpt_{int(time.time())}_{uuid.uuid4().hex[:6]}.png"
                        file_path = os.path.join(save_dir, file_name)
                        if self.image_processor.download_image(value, file_path):
                            return file_path
                    return value
                if isinstance(value, dict):
                    found = self._extract_image_from_obj(value, save_dir)
                    if found:
                        return found

            for value in obj.values():
                found = self._extract_image_from_obj(value, save_dir)
                if found:
                    return found

        elif isinstance(obj, list):
            for item in obj:
                found = self._extract_image_from_obj(item, save_dir)
                if found:
                    return found

        elif isinstance(obj, str):
            if obj.startswith(("http://", "https://")) and (
                re.search(r"\.(png|jpe?g|webp)(\?|$)", obj, re.I) or "image" in obj.lower()
            ):
                return obj
            if len(obj) > 1000 and re.fullmatch(r"[A-Za-z0-9+/=\n\r]+", obj[:2000]):
                try:
                    return self._save_base64_image(obj, save_dir)
                except Exception:
                    return None
        return None

    def _generate_with_responses_api(self, prompt, size="1024x1024", quality="high", model="gpt-image-2",
                                     save_dir=None, image_urls=None):
        """Generate an image through /v1/responses image_generation tool."""
        content = prompt
        if size:
            content = f"{content}\n\nImage size/aspect request: {size}. Quality: {quality}."

        input_payload = content
        if image_urls:
            parts = [{"type": "input_text", "text": content}]
            for image_url in image_urls[:6]:
                parts.append({"type": "input_image", "image_url": self._encode_image_to_base64(image_url)})
            input_payload = [{"role": "user", "content": parts}]

        response = self.client.responses.create(  # type: ignore[arg-type]
            model=model,
            input=input_payload,
            tools=[{"type": "image_generation"}],
        )

        # The OpenAI SDK returns pydantic objects; model_dump preserves nested tool output.
        data = response.model_dump() if hasattr(response, "model_dump") else response
        result = self._extract_image_from_obj(data, save_dir=save_dir)
        if not result:
            raise RuntimeError("未在 Responses API 响应中找到图片 url 或 base64")
        return result

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
                if self.image_api_mode == "responses":
                    return self._generate_with_responses_api(
                        prompt=prompt,
                        size=size,
                        quality=quality,
                        model=model,
                        save_dir=save_dir,
                        image_urls=image_urls,
                    )

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
                msg = str(e)
                # Other errors: wait before retry
                print(f"Image generation error: {e}. Retrying in 10 seconds.")
                time.sleep(10)
                break  # Break inner loop to retry all models
            attempts += 1
        raise Exception(f"Max attempts reached, failed to generate image. Last error: {last_error}")

    def generate_images(self, prompt, count=4, size="1024x1024", quality="standard", model=None):
        """Generate multiple image URLs by calling Images API 'count' times."""
        urls = []
        for _ in range(count):
            url = self.generate_image(prompt=prompt, size=size, quality=quality, model=model)
            urls.append(url)
        return urls


if __name__ == "__main__":
    import sys
    import tempfile
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config

    MODELS = ["gpt-image-2"]
    save_dir = "code/result/image/test_avail"
    api_key = Config.OPENAI_API_KEY
    base_url = Config.OPENAI_BASE_URL
    if not api_key:
        print("✗ OPENAI_API_KEY 未设置，跳过")
        sys.exit(1)
    print("=== GPT 图片生成测试 ===")
    print(f"  API Key: {api_key[:6]}***")
    print(f"  Base URL: {base_url}")


    # 文生图
    print("\n=== GPT 文生图可用性测试 ===")
    img_prompt = "A cute orange cat lying on a sunny windowsill, watercolor style"
    img_path = ""
    client = ImageGPT(api_key=api_key, base_url=Config.OPENAI_BASE_URL, local_proxy=Config.LOCAL_PROXY)
    for model in MODELS:
        print(f"\nTesting model: {model}")
        print(f"Prompt: {img_prompt}")
        print(f"Image path: {img_path}")
        client.max_attempts = 1
        t0 = time.time()
        os.makedirs(save_dir, exist_ok=True)
        try:
            path = client.generate_image(prompt=img_prompt, size="1024x1024",
                                                model=model, save_dir=save_dir)
            elapsed = time.time() - t0
            print(f"✓ 生成成功 ({elapsed:.1f}s): {path}")
        except Exception as e:
            elapsed = time.time() - t0
            print(f"✗ 失败 ({elapsed:.1f}s): {e}")

    # 图生图
    print("\n=== GPT 图生图可用性测试 ===")
    img_prompt = "Turn this cat into a cute cartoon character with big eyes and a playful expression"
    img_path = "code/result/image/test_avail/test_input.jpg"
    for model in MODELS:
        print(f"\nTesting model: {model}")
        print(f"Prompt: {img_prompt}")
        print(f"Image path: {img_path}")
        client.max_attempts = 1
        t0 = time.time()
        os.makedirs(save_dir, exist_ok=True)
        try:
            path = client.generate_image(prompt=img_prompt, size="1024x1024",
                                                model=model, save_dir=save_dir, image_urls=[img_path])
            elapsed = time.time() - t0
            print(f"✓ 生成成功 ({elapsed:.1f}s): {path}")
        except Exception as e:
            elapsed = time.time() - t0
            print(f"✗ 失败 ({elapsed:.1f}s): {e}") 
