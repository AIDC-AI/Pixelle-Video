"""
Seedream 图像生成 API 客户端
字节跳动 ARK - doubao-seedream-5-0-260128 模型
"""

import os
import time
import logging
from typing import Optional, List, Dict
from openai import OpenAI

# 模型名称映射表（旧名称 -> 新名称）
MODEL_NAME_MAP: Dict[str, str] = {
    # doubao-seedream-5-0 系列
    "doubao-seedream-5-0": "doubao-seedream-5-0-260128",
    # doubao-seedream-4-5 系列
    "doubao-seedream-4-5": "doubao-seedream-4-5-251128",
    # doubao-seedream-4-0 系列
    "doubao-seedream-4-0": "doubao-seedream-4-0-250828",
}


def normalize_model_name(model: str) -> str:
    """
    规范化模型名称

    Args:
        model: 传入的模型名称

    Returns:
        规范化后的模型名称
    """
    return MODEL_NAME_MAP.get(model, model)


class SeedreamClient:
    """
    Seedream 图像生成客户端（字节跳动 ARK）
    支持文生图功能
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 120,
    ) -> None:
        """
        初始化 Seedream 客户端

        Args:
            api_key: ARK API Key
            base_url: ARK API 基础 URL
            timeout: HTTP请求超时时间（秒）
        """
        self.api_key = api_key or os.getenv("ARK_API_KEY")
        self.base_url = base_url or "https://ark.cn-beijing.volces.com/api/v3"
        self.timeout = timeout

        if not self.api_key:
            logging.warning(
                "SeedreamClient missing api_key. Set ARK_API_KEY."
            )

        self.client = OpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=timeout,
        )

    def generate_image(
        self,
        prompt: str,
        session_id: str,
        model: str = "doubao-seedream-4-5-251128",
        size: str = "1920*1080",
        image_paths: Optional[List[str]] = None,
        **kwargs
    ) -> List[str]:
        """
        生成图片

        Args:
            prompt: 提示词
            session_id: 任务或会话ID，用于构建存储路径
            model: 模型名称
            size: 生成图片的分辨率，如 "1920*1080", "1024*1024"
            image_paths: 参考图路径或URL列表 (图生图)
            **kwargs: 其他生成参数

        Returns:
            生成的图片路径列表
        """
        if not self.api_key:
            raise RuntimeError("ARK_API_KEY not set.")

        # 规范化模型名称（旧名称 -> 新名称）
        model = normalize_model_name(model)

        # 处理分辨率 (Seedream 要求至少 3686400 像素)
        # 常用 2K/4K 分辨率
        size_map = {
            # 16:9
            "1920*1080": (1920, 1080),
            "2048*1080": (2048, 1080),  # 2K 电影
            "2560*1440": (2560, 1440),  # 2K QHD
            "3840*2160": (3840, 2160),  # 4K UHD
            "4096*2160": (4096, 2160),  # 4K 电影
            # 9:16
            "1080*1920": (1080, 1920),
            "1080*2048": (1080, 2048),
            "1440*2560": (1440, 2560),
            "2160*3840": (2160, 3840),
            "2160*4096": (2160, 4096),
            # 1:1
            "1024*1024": (1024, 1024),
            "2048*2048": (2048, 2048),  # 2K 正方
            # 4:3
            "1920*1440": (1920, 1440),
            "2560*1920": (2560, 1920),
            # 3:4
            "1440*1920": (1440, 1920),
            "1920*2560": (1920, 2560),
        }

        width, height = 1920, 1080  # 默认
        min_pixels = 3686400

        if size:
            parts = size.split("*")
            if len(parts) == 2:
                w, h = int(parts[0]), int(parts[1])
                width, height = w, h

        # 确保满足最小像素要求
        if width * height < min_pixels:
            # 查找相同宽高比的常用分辨率
            aspect_ratio = width / height
            for (w, h) in size_map.values():
                if abs(w / h - aspect_ratio) < 0.01 and w * h >= min_pixels:
                    width, height = w, h
                    break
            else:
                # 没有找到合适的，按比例放大
                scale = (min_pixels / (width * height)) ** 0.5
                width = int(width * scale)
                height = int(height * scale)
                width = width if width % 2 == 0 else width + 1
                height = height if height % 2 == 0 else height + 1

        # 构建 extra_body
        extra_body = {
            "watermark": False,
            "sequential_image_generation": "disabled",
        }

        # 添加其他参数
        if "seed" in kwargs:
            extra_body["seed"] = kwargs["seed"]
        if "quality" in kwargs:
            extra_body["quality"] = kwargs["quality"]
        if "style" in kwargs:
            extra_body["style"] = kwargs["style"]

        # 处理参考图 (图生图)
        image_urls = []
        if image_paths and len(image_paths) > 0:
            # 处理参考图：支持 URL 和本地文件
            ref_images = []
            for p in image_paths:
                if p.startswith("http"):
                    ref_images.append(p)
                elif os.path.exists(p):
                    # 转换为 base64 URL
                    import base64
                    with open(p, "rb") as f:
                        img_data = base64.b64encode(f.read()).decode("utf-8")
                    ext = os.path.splitext(p)[1].lower()
                    mime = "image/png" if ext == ".png" else "image/jpeg"
                    ref_images.append(f"data:{mime};base64,{img_data}")
            extra_body["image"] = ref_images

        # 调用 API
        if image_paths and len(image_paths) > 0:
            # 图生图 - image 放在 extra_body 中
            response = self.client.images.generate(
                model=model,
                prompt=prompt,
                size=f"{width}x{height}",
                response_format="url",
                extra_body=extra_body,
            )
        else:
            # 文生图
            response = self.client.images.generate(
                model=model,
                prompt=prompt,
                size=f"{width}x{height}",
                response_format="url",
                extra_body=extra_body,
            )

        # 下载图片到本地
        generated_paths = []
        if response.data:
            for idx, img_data in enumerate(response.data):
                if img_data.url:
                    local_path = self._download_image(
                        img_data.url, session_id, idx
                    )
                    if local_path:
                        generated_paths.append(local_path)

        return generated_paths

    def _download_image(self, url: str, session_id: str, idx: int) -> Optional[str]:
        """从URL下载图片到本地"""
        import requests

        # 构建存储路径
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        result_dir = os.path.join(base_dir, "code", "result", "image", str(session_id))
        os.makedirs(result_dir, exist_ok=True)

        file_name = f"seedream_{int(time.time())}_{idx}.png"
        file_path = os.path.join(result_dir, file_name)

        try:
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            with open(file_path, "wb") as f:
                f.write(response.content)
            return file_path
        except Exception as e:
            logging.error(f"Failed to download image from {url}: {e}")
            return None


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config  # 加载 .env

    print("=== Seedream 可用性测试 ===")
    api_key = os.getenv("ARK_API_KEY", "")
    base_url = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
    if not api_key:
        print("✗ ARK_API_KEY 未设置，跳过")
        sys.exit(1)
    print(f"  API Key: {api_key[:6]}***{api_key[-4:]}")
    print(f"  Base URL: {base_url}")

    client = SeedreamClient(api_key=api_key, base_url=base_url)

    # === 测试1: 文生图 ===
    prompt = "星际穿越，黑洞，黑洞里冲出一辆支离破碎的复古列车，视觉冲击力，电影大片，末日既视感"
    print(f"\n[测试1: 文生图] Prompt: {prompt}")
    t0 = time.time()
    try:
        paths = client.generate_image(
            prompt=prompt,
            session_id="test_avail",
            model="doubao-seedream-5-0-260128",
            size="1920*1080",
        )
        elapsed = time.time() - t0
        if paths:
            print(f"✓ 生成 {len(paths)} 张图片 ({elapsed:.1f}s): {paths}")
        else:
            print(f"✗ 返回空列表 ({elapsed:.1f}s)")
    except Exception as e:
        print(f"✗ 图片生成失败: {e}")

    # === 测试2: 图生图 ===
    # 需要一张已有的参考图路径
    ref_image_path = "code/result/image/test_avail/test_input.png"
    if os.path.exists(ref_image_path):
        prompt_i2i = "将这只猫变成赛博朋克风格"
        print(f"\n[测试2: 图生图] Prompt: {prompt_i2i}")
        print(f"  参考图: {ref_image_path}")
        t0 = time.time()
        try:
            paths = client.generate_image(
                prompt=prompt_i2i,
                session_id="test_avail",
                model="doubao-seedream-5-0-260128",
                size="1920*1080",
                image_paths=[ref_image_path],
            )
            elapsed = time.time() - t0
            if paths:
                print(f"✓ 生成 {len(paths)} 张图片 ({elapsed:.1f}s): {paths}")
            else:
                print(f"✗ 返回空列表 ({elapsed:.1f}s)")
        except Exception as e:
            print(f"✗ 图生图失败: {e}")
    else:
        print(f"\n[测试2: 图生图] ✗ 参考图不存在: {ref_image_path}")
        print("  跳过图生图测试，请先运行文生图测试生成参考图")
