"""
统一视频生成客户端
根据 model 名称自动路由到对应后端：
  - wan*      → DashscopeVideoClient (DashScope VideoSynthesis)
  - kling*    → KlingVideoClient (可灵 AI)
  - agnes*    → AgnesVideoClient
"""

import logging
import os
from typing import Optional

from .config import Config

try:
    from .video_agnes import AgnesVideoClient
    from .video_dashscope import DashscopeVideoClient
    from .video_kling import KlingVideoClient
    from .video_seedance import SeedanceVideoClient
except ImportError:
    from video_agnes import AgnesVideoClient
    from video_dashscope import DashscopeVideoClient
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
        dashscope_local_proxy: Optional[str] = None,
        kling_access_key: Optional[str] = None,
        kling_secret_key: Optional[str] = None,
        kling_base_url: Optional[str] = None,
        kling_local_proxy: Optional[str] = None,
        ark_api_key: Optional[str] = None,
        ark_base_url: Optional[str] = None,
        ark_local_proxy: Optional[str] = None,
        agnes_api_key: Optional[str] = None,
        agnes_base_url: Optional[str] = None,
        agnes_local_proxy: Optional[str] = None,
    ):
        self._dashscope_api_key = dashscope_api_key or Config.DASHSCOPE_API_KEY
        self._dashscope_base_url = dashscope_base_url or Config.DASHSCOPE_BASE_URL
        self._dashscope_local_proxy = dashscope_local_proxy

        self._kling_access_key = kling_access_key or Config.KLING_ACCESS_KEY
        self._kling_secret_key = kling_secret_key or Config.KLING_SECRET_KEY
        self._kling_base_url = kling_base_url or Config.KLING_BASE_URL
        self._kling_local_proxy = kling_local_proxy

        self._ark_api_key = ark_api_key or Config.ARK_API_KEY or os.getenv("ARK_API_KEY")
        self._ark_base_url = ark_base_url or Config.ARK_BASE_URL or os.getenv("ARK_BASE_URL")
        self._ark_local_proxy = ark_local_proxy

        self._agnes_api_key = agnes_api_key or Config.AGNES_API_KEY or os.getenv("AGNES_API_KEY")
        self._agnes_base_url = agnes_base_url or Config.AGNES_BASE_URL or os.getenv("AGNES_BASE_URL")
        self._agnes_local_proxy = agnes_local_proxy

        self._dashscope_client = None
        self._kling_client = None
        self._seedance_client = None
        self._agnes_client = None

    @property
    def Dashscope_client(self):
        """Create DashScope client only when a Wan/HappyHorse model is selected."""
        if self._dashscope_client is None:
            self._dashscope_client = DashscopeVideoClient(
                api_key=self._dashscope_api_key,
                base_url=self._dashscope_base_url,
                local_proxy=self._dashscope_local_proxy,
            )
        return self._dashscope_client

    @property
    def kling_client(self):
        """Create Kling client only when a Kling model is selected."""
        if self._kling_client is None:
            self._kling_client = KlingVideoClient(
                access_key=self._kling_access_key,
                secret_key=self._kling_secret_key,
                base_url=self._kling_base_url,
                local_proxy=self._kling_local_proxy,
            )
        return self._kling_client

    @property
    def seedance_client(self):
        """Create Seedance client only when a Seedance/ARK model is selected."""
        if self._seedance_client is None:
            self._seedance_client = SeedanceVideoClient(
                api_key=self._ark_api_key,
                base_url=self._ark_base_url,
                local_proxy=self._ark_local_proxy,
            )
        return self._seedance_client

    @property
    def agnes_client(self):
        """Create Agnes client only when an Agnes model is selected."""
        if self._agnes_client is None:
            self._agnes_client = AgnesVideoClient(
                api_key=self._agnes_api_key,
                base_url=self._agnes_base_url,
                local_proxy=self._agnes_local_proxy,
            )
        return self._agnes_client

    def generate_video(
        self,
        prompt: str,
        image_path: Optional[str],
        save_path: str,
        model: str = "wan2.7-i2v",
        duration: int = 5,
        shot_type: str = "multi",
        sound: str = "",
        video_ratio: str = "16:9",
        resolution: Optional[str] = None,
        last_image_path: Optional[str] = None,
        first_clip_path: Optional[str] = None,
        reference_image_path: Optional[str] = None,
        reference_image_paths: Optional[list[str]] = None,
        reference_video_paths: Optional[list[str]] = None,
        reference_audio_path: Optional[str] = None,
        audio_path: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        prompt_extend: Optional[bool] = None,
        watermark: Optional[bool] = None,
        seed: Optional[int] = None,
        mode: str = "pro",
        cfg_scale: float = 0.5,
        generate_audio: Optional[bool] = None,
        audio: Optional[bool] = None,
        frame_rate: Optional[int] = None,
        num_inference_steps: Optional[int] = None,
    ) -> str:
        """
        生成视频

        Args:
            prompt: 视频描述提示词
            image_path: 输入图片本地路径；DashScope wan2.7 视频续写可为空并使用 first_clip_path
            save_path: 输出视频保存路径
            model: 模型名，决定使用哪个后端
            duration: 视频时长（秒）
            shot_type: 镜头类型 "single" / "multi"

        Returns:
            video_url: 远端视频 URL

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
                print("Image: [Base64图片]")
            else:
                print(f"Image: {image_path}")
            print(f"Model: {model}")
            print(f"Duration: {duration}s")
            print(f"Shot Type: {shot_type}")
            print(f"Video Ratio: {video_ratio}")
            if resolution:
                print(f"Resolution: {resolution}")
            if last_image_path:
                print(f"Last Image: {last_image_path}")
            if first_clip_path:
                print(f"First Clip: {first_clip_path}")
            if reference_image_path:
                print(f"Reference Image: {reference_image_path}")
            if reference_image_paths:
                print(f"Reference Images: {reference_image_paths}")
            if reference_video_paths:
                print(f"Reference Videos: {reference_video_paths}")
            if reference_audio_path:
                print(f"Reference Audio: {reference_audio_path}")
            if audio_path:
                print(f"Audio: {audio_path}")
            if negative_prompt:
                print(f"Negative Prompt: {negative_prompt}")
            if sound:
                print(f"Sound: {sound}")
            print(f"Save: {save_path}")
            print("-" * 30)

        model_lower = model.lower()

        if "kling" in model_lower:
            return self._generate_kling(
                prompt,
                image_path,
                save_path,
                model,
                duration,
                sound,
                mode,
                cfg_scale,
                negative_prompt or "",
                video_ratio,
            )
        elif "seedance" in model_lower:
            return self._generate_seedance(
                prompt,
                image_path,
                save_path,
                model,
                duration,
                video_ratio,
                resolution,
                seed,
                watermark,
                generate_audio,
            )
        elif "agnes" in model_lower:
            return self._generate_agnes(
                prompt,
                image_path,
                save_path,
                model,
                duration,
                video_ratio,
                resolution,
                seed,
                negative_prompt,
                frame_rate,
                num_inference_steps,
            )
        elif "wan" in model_lower or "happyhorse" in model_lower:
            return self._generate_wan(
                prompt,
                image_path,
                save_path,
                model,
                duration,
                shot_type,
                video_ratio,
                last_image_path,
                first_clip_path,
                reference_image_path,
                reference_image_paths,
                reference_video_paths,
                reference_audio_path,
                audio_path,
                negative_prompt,
                resolution,
                prompt_extend,
                watermark if watermark is not None else False,
                seed,
                audio,
            )
        else:
            raise ValueError(f"未知的视频生成模型: {model}")

    def _generate_wan(
        self,
        prompt: str,
        image_path: Optional[str],
        save_path: str,
        model: str,
        duration: int,
        shot_type: str,
        video_ratio: str,
        last_image_path: Optional[str],
        first_clip_path: Optional[str],
        reference_image_path: Optional[str],
        reference_image_paths: Optional[list[str]],
        reference_video_paths: Optional[list[str]],
        reference_audio_path: Optional[str],
        audio_path: Optional[str],
        negative_prompt: Optional[str],
        resolution: Optional[str],
        prompt_extend: Optional[bool],
        watermark: bool,
        seed: Optional[int],
        audio: Optional[bool],
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
            video_ratio=video_ratio,
            last_image_path=last_image_path,
            first_clip_path=first_clip_path,
            reference_image_path=reference_image_path,
            reference_image_paths=reference_image_paths,
            reference_video_paths=reference_video_paths,
            reference_audio_path=reference_audio_path,
            audio_path=audio_path,
            negative_prompt=negative_prompt,
            resolution=resolution,
            prompt_extend=prompt_extend,
            watermark=watermark,
            seed=seed,
            audio=audio,
        )

    def _generate_kling(
        self,
        prompt: str,
        image_path: Optional[str],
        save_path: str,
        model: str,
        duration: int = 5,
        sound: str = "",
        mode: str = "pro",
        cfg_scale: float = 0.5,
        negative_prompt: str = "",
        video_ratio: str = "16:9",
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
            mode=mode,
            cfg_scale=cfg_scale,
            negative_prompt=negative_prompt,
            aspect_ratio=video_ratio,
        )

    def _generate_seedance(
        self,
        prompt: str,
        image_path: Optional[str],
        save_path: str,
        model: str,
        duration: int = 5,
        video_ratio: str = "16:9",
        resolution: Optional[str] = None,
        seed: Optional[int] = None,
        watermark: Optional[bool] = None,
        generate_audio: Optional[bool] = None,
    ) -> str:
        """通过 Seedance 模型生成视频"""
        logger.info(f"VideoClient: 路由至 Seedance model={model}")
        return self.seedance_client.generate_video(
            prompt=prompt,
            image_path=image_path,
            save_path=save_path,
            model=model,
            duration=duration,
            ratio=video_ratio,
            resolution=resolution or "720p",
            seed=seed,
            watermark=watermark,
            generate_audio=generate_audio,
        )

    def _generate_agnes(
        self,
        prompt: str,
        image_path: Optional[str],
        save_path: str,
        model: str,
        duration: int = 5,
        video_ratio: str = "16:9",
        resolution: Optional[str] = None,
        seed: Optional[int] = None,
        negative_prompt: Optional[str] = None,
        frame_rate: Optional[int] = None,
        num_inference_steps: Optional[int] = None,
    ) -> str:
        """通过 Agnes Video V2.0 生成视频"""
        logger.info(f"VideoClient: 路由至 Agnes model={model}")
        return self.agnes_client.generate_video(
            prompt=prompt,
            image_path=image_path,
            save_path=save_path,
            model=model,
            duration=duration,
            video_ratio=video_ratio,
            resolution=resolution,
            seed=seed,
            negative_prompt=negative_prompt,
            frame_rate=frame_rate or 24,
            num_inference_steps=num_inference_steps,
        )
