"""
统一视频生成客户端
根据 model 名称自动路由到对应后端：
  - wan*      → DashscopeVideoClient (DashScope VideoSynthesis)
  - jimeng*   → JiMengClient (火山引擎即梦)
  - kling*    → KlingVideoClient (可灵 AI)
"""

import os
import logging
from typing import Optional
from .config import Config

try:
    from .video_dashscope import DashscopeVideoClient
    from .image_jimeng import JiMengClient
    from .video_kling import KlingVideoClient
    from .video_seedance import SeedanceVideoClient
except ImportError:
    from video_dashscope import DashscopeVideoClient
    from image_jimeng import JiMengClient
    from video_kling import KlingVideoClient
    from video_seedance import SeedanceVideoClient

logger = logging.getLogger(__name__)


class VideoClient:
    """
    统一视频生成客户端
    参照 ImageClient 模式，按模型名路由到不同后端
    """

    def __init__(
        self,
        dashscope_api_key: Optional[str] = None,
        dashscope_base_url: Optional[str] = None,
        jimeng_base_url: Optional[str] = None,
        jimeng_access_key: Optional[str] = None,
        jimeng_secret_key: Optional[str] = None,
        kling_access_key: Optional[str] = None,
        kling_secret_key: Optional[str] = None,
        kling_base_url: Optional[str] = None,
        ark_api_key: Optional[str] = None,
        ark_base_url: Optional[str] = None,
    ):
        # 万象客户端
        self.Dashscope_client = DashscopeVideoClient(
            api_key=dashscope_api_key or Config.DASHSCOPE_API_KEY,
            base_url=dashscope_base_url or Config.DASHSCOPE_BASE_URL,
        )

        # 即梦客户端（图片+视频共用 HMAC 鉴权）
        self.jimeng_client = JiMengClient(
            base_url=jimeng_base_url or Config.JIMENG_BASE_URL,
            access_key=jimeng_access_key or Config.JIMENG_ACCESS_KEY,
            secret_key=jimeng_secret_key or Config.JIMENG_SECRET_KEY,
        )

        # 可灵客户端
        self.kling_client = KlingVideoClient(
            access_key=kling_access_key or Config.KLING_ACCESS_KEY,
            secret_key=kling_secret_key or Config.KLING_SECRET_KEY,
            base_url=kling_base_url or Config.KLING_BASE_URL,
        )

        # Seedance 客户端
        self.seedance_client = SeedanceVideoClient(
            api_key=ark_api_key or Config.ARK_API_KEY or os.getenv("ARK_API_KEY"),
            base_url=ark_base_url or Config.ARK_BASE_URL or os.getenv("ARK_BASE_URL"),
        )

    def generate_video(
        self,
        prompt: str,
        image_path: str,
        save_path: str,
        model: str = "wan2.7-i2v",
        duration: int = 5,
        shot_type: str = "multi",
        sound: str = "",
        video_ratio: str = "16:9",
    ) -> str:
        """
        生成视频

        Args:
            prompt: 视频描述提示词
            image_path: 输入图片本地路径
            save_path: 输出视频保存路径
            model: 模型名，决定使用哪个后端
            duration: 视频时长（秒）
            shot_type: 镜头类型 "single" / "multi"

        Returns:
            video_url: 远端视频 URL（万象）或 task_id（即梦）

        Raises:
            FileNotFoundError: 输入图片不存在
            RuntimeError: 生成或下载失败
        """
        if not model:
            model = "wan2.7-i2v"

        if Config.PRINT_MODEL_INPUT:
            print("---- VIDEO GENERATION REQUEST ----")
            print(f"Prompt: {prompt}")
            if image_path and str(image_path).startswith("data:"):
                print(f"Image: [Base64图片]")
            else:
                print(f"Image: {image_path}")
            print(f"Model: {model}")
            print(f"Duration: {duration}s")
            print(f"Shot Type: {shot_type}")
            print(f"Save: {save_path}")
            print("-" * 30)

        model_lower = model.lower()

        if "jimeng" in model_lower:
            return self._generate_jimeng(prompt, image_path, save_path, model, video_ratio)
        elif "kling" in model_lower:
            return self._generate_kling(prompt, image_path, save_path, model, duration, sound)
        elif "seedance" in model_lower:
            return self._generate_seedance(prompt, image_path, save_path, model, duration)
        elif "wan" in model_lower or "happyhorse" in model_lower:
            return self._generate_wan(prompt, image_path, save_path, model, duration, shot_type)
        else:
            raise ValueError(f"未知的视频生成模型: {model}")

    def _generate_wan(
        self,
        prompt: str,
        image_path: str,
        save_path: str,
        model: str,
        duration: int,
        shot_type: str,
    ) -> str:
        """通过万象模型生成视频"""
        logger.info(f"VideoClient: 路由至万象 model={model}")
        return self.Dashscope_client.generate_video(
            prompt=prompt,
            image_path=image_path,
            save_path=save_path,
            model=model,
            duration=duration,
            shot_type=shot_type,
        )

    def _generate_jimeng(
        self,
        prompt: str,
        image_path: str,
        save_path: str,
        model: str,
        video_ratio: str = "16:9",
    ) -> str:
        """通过即梦模型生成视频"""
        logger.info(f"VideoClient: 路由至即梦 model={model}")
        task_id = self.jimeng_client.generate_video(
            prompt=prompt,
            image_path=image_path,
            aspect_ratio=video_ratio,
        )

        # 轮询获取结果
        result = self.jimeng_client.poll_task(model=model, task_id=task_id)

        # 即梦返回的视频数据可能是 URL 或 base64
        video_url = result.get("video_url", "")
        if video_url:
            import requests
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            resp = requests.get(video_url, stream=True, timeout=120)
            resp.raise_for_status()
            with open(save_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            return video_url

        raise RuntimeError(f"即梦视频生成未返回有效结果: {result}")

    def _generate_kling(
        self,
        prompt: str,
        image_path: str,
        save_path: str,
        model: str,
        duration: int = 5,
        sound: str = "",
    ) -> str:
        """通过可灵模型生成视频"""
        logger.info(f"VideoClient: 路由至可灵 model={model}")
        return self.kling_client.generate_video(
            prompt=prompt,
            image_path=image_path,
            save_path=save_path,
            model=model,
            duration=duration,
            sound=sound,
        )

    def _generate_seedance(
        self,
        prompt: str,
        image_path: str,
        save_path: str,
        model: str,
        duration: int = 5,
    ) -> str:
        """通过 Seedance 模型生成视频"""
        logger.info(f"VideoClient: 路由至 Seedance model={model}")
        return self.seedance_client.generate_video(
            prompt=prompt,
            image_path=image_path,
            save_path=save_path,
            model=model,
            duration=duration,
        )
