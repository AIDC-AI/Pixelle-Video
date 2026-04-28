"""
通义万象（Wan）视频生成客户端
基于 DashScope SDK (dashscope.VideoSynthesis)
支持 wan2.7-i2v, wan2.6-i2v-flash 等模型的图生视频功能
"""

import os
import logging
from typing import Optional
from http import HTTPStatus

try:
    import dashscope
    from dashscope import VideoSynthesis
except ImportError:
    dashscope = None
    VideoSynthesis = None
import requests

logger = logging.getLogger(__name__)


class DashscopeVideoClient:
    """
    阿里云通义万象视频生成客户端
    使用 dashscope SDK 的 VideoSynthesis 接口
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY")
        self.base_url = base_url or os.getenv("DASHSCOPE_BASE_URL")

        if dashscope and self.api_key:
            dashscope.api_key = self.api_key
        if dashscope and self.base_url:
            dashscope.base_http_api_url = self.base_url

    def generate_video(
        self,
        prompt: str,
        image_path: str,
        save_path: str,
        model: str = "wan2.7-i2v",
        duration: int = 10,
        shot_type: str = "multi",
    ) -> str:
        """
        图生视频：提交任务 → 等待完成 → 下载到本地

        Args:
            prompt: 视频描述提示词
            image_path: 输入图片本地路径
            save_path: 输出视频保存路径
            model: 万象视频模型名
            duration: 视频时长（秒），5-10
            shot_type: 镜头类型，"single" 或 "multi"

        Returns:
            video_url: 远端视频 URL

        Raises:
            FileNotFoundError: 输入图片不存在
            RuntimeError: API 调用或下载失败
        """
        if VideoSynthesis is None:
            raise RuntimeError("dashscope package not installed. Run: pip install dashscope")

        if not os.path.exists(image_path):
            raise FileNotFoundError(f"输入图片不存在: {image_path}")

        abs_img = os.path.abspath(image_path)
        img_url = f"file://{abs_img}"

        logger.info(f"DashscopeVideoClient: model={model}, prompt={prompt[:60]}...")

        if model.startswith("wan2.7") or "happyhorse" in model:
            # wan2.7 series use the new API format with 'media'
            media = [{"type": "first_frame", "url": img_url}]
            rsp = VideoSynthesis.call(
                api_key=self.api_key,
                model=model,
                prompt=prompt,
                media=media,
                duration=duration,
                watermark=False,
            )
        else:
            # Older models (wan2.1, wan2.6 etc.) use 'img_url' and 'shot_type'
            rsp = VideoSynthesis.call(
                api_key=self.api_key,
                model=model,
                prompt=prompt,
                img_url=img_url,
                duration=duration,
                shot_type=shot_type,
            )

        if rsp.status_code != HTTPStatus.OK:
            raise RuntimeError(
                f"万象视频 API 错误: status={rsp.status_code}, "
                f"code={rsp.code}, message={rsp.message}"
            )

        video_url = rsp.output.video_url
        # 检查是否返回了有效的视频URL
        if not video_url:
            raise RuntimeError(f"万象视频 API 返回空URL，可能生成失败: code={rsp.code}, message={rsp.message}")

        logger.info(f"DashscopeVideoClient: 视频生成成功: {video_url}")

        # 确保输出目录存在
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        # 下载视频
        resp = requests.get(video_url, stream=True, timeout=120)
        if resp.status_code != 200:
            raise RuntimeError(f"视频下载失败: HTTP {resp.status_code}")

        with open(save_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        logger.info(f"DashscopeVideoClient: 视频已保存: {save_path}")
        return video_url


if __name__ == "__main__":
    import sys
    import time
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    # ── 测试参数（按需修改） ──
    IMAGE_PATH = "code/result/image/test_avail/test_input_human.jpg"
    OUTPUT_DIR = "code/result/video/test_avail"
    PROMPT = "女人把报表交给男人，男人看清楚报表上的数据，露出满意的微笑，办公室背景，写实风格，高清细节。背景音乐：轻快的电子乐，节奏感强，适合办公环境。"
    # MODELS = ["wan2.7-i2v", "wan2.6-i2v-flash", "happyhorse-1.0-i2v"]
    MODELS = ["happyhorse-1.0-i2v"]
    DURATION = 5               # 5 / 10
    SHOT_TYPE = "multi"        # single / multi

    print("=== Dashscope 视频客户端可用性测试 ===")
    ak = Config.DASHSCOPE_API_KEY
    base_url = Config.DASHSCOPE_BASE_URL
    if not ak:
        print("✗ DASHSCOPE_API_KEY 未设置，请检查 .env 配置")
        sys.exit(1)

    if not os.path.exists(IMAGE_PATH):
        print(f"✗ 输入图片不存在: {IMAGE_PATH}")
        sys.exit(1)

    for model in MODELS:
        output_path = os.path.join(OUTPUT_DIR, f"{model}.mp4")
        print(f"\n测试模型: {model}")
        print(f"  API Key    : {ak[:6]}***{ak[-4:]}")
        print(f"  Base URL   : {base_url}")
        print(f"  输入图片   : {IMAGE_PATH}")
        print(f"  输出路径   : {output_path}")
        print(f"  模型       : {model}")
        print(f"  时长       : {DURATION}s")
        print(f"  镜头类型   : {SHOT_TYPE}")
        if PROMPT:
            print(f"  提示词     : {PROMPT[:80]}")
        print("-" * 40)

        try:
            client = DashscopeVideoClient(api_key=ak, base_url=base_url)
            print("✓ 客户端初始化成功")
            
            start = time.time()
            video_url = client.generate_video(
                prompt=PROMPT,
                image_path=IMAGE_PATH,
                save_path=output_path,
                model=model,
                duration=DURATION,
                shot_type=SHOT_TYPE,
            )
            elapsed = time.time() - start

            print(f"✓ 视频生成完成！耗时 {elapsed:.1f}s")
            print(f"  远端 URL : {video_url}")
            print(f"  本地文件 : {os.path.abspath(output_path)}")
            print(f"  文件大小 : {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
        except Exception as e:
            print(f"✗ 失败: {e}")
            sys.exit(1)
