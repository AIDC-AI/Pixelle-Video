"""
通义万象（Wan）视频生成客户端
基于 DashScope SDK (dashscope.VideoSynthesis)
支持 wan2.7-i2v, wan2.6-i2v-flash 等模型的图生视频功能
"""

import os
import logging
import time
from typing import Optional
from http import HTTPStatus

try:
    import dashscope
    from dashscope import VideoSynthesis
except ImportError:
    dashscope = None
    VideoSynthesis = None
import requests
from requests import exceptions as requests_exceptions

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

    _RETRYABLE_EXCEPTIONS = (
        requests_exceptions.ConnectionError,
        requests_exceptions.Timeout,
        requests_exceptions.SSLError,
        requests_exceptions.ChunkedEncodingError,
        requests_exceptions.ContentDecodingError,
        TimeoutError,
        ConnectionError,
    )

    def _with_network_retry(self, action_name: str, func, max_attempts: int = 5, base_delay: float = 3.0):
        """Retry transient network failures without hiding provider-side task failures."""
        last_error = None
        for attempt in range(1, max_attempts + 1):
            try:
                return func()
            except self._RETRYABLE_EXCEPTIONS as exc:
                last_error = exc
            except Exception as exc:
                if not self._is_retryable_error(exc):
                    raise
                last_error = exc

            if attempt >= max_attempts:
                break
            delay = min(base_delay * attempt, 20)
            logger.warning(
                "DashscopeVideoClient: %s network error, retrying %s/%s in %.1fs: %s",
                action_name,
                attempt,
                max_attempts,
                delay,
                last_error,
            )
            time.sleep(delay)

        raise RuntimeError(
            f"DashScope {action_name} failed after {max_attempts} attempts due to network error: {last_error}"
        ) from last_error

    def _is_retryable_error(self, exc: Exception) -> bool:
        message = str(exc).lower()
        retry_markers = (
            "ssleoferror",
            "unexpected_eof",
            "eof occurred in violation of protocol",
            "connection reset",
            "connection aborted",
            "remote disconnected",
            "max retries exceeded",
            "read timed out",
            "connect timed out",
            "temporarily unavailable",
        )
        return any(marker in message for marker in retry_markers)

    def generate_video(
        self,
        prompt: str,
        image_path: Optional[str],
        save_path: str,
        model: str = "wan2.7-i2v",
        duration: int = 10,
        shot_type: str = "multi",
        video_ratio: Optional[str] = None,
        last_image_path: Optional[str] = None,
        first_clip_path: Optional[str] = None,
        reference_image_path: Optional[str] = None,
        reference_image_paths: Optional[list[str]] = None,
        reference_video_paths: Optional[list[str]] = None,
        reference_audio_path: Optional[str] = None,
        audio_path: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        resolution: Optional[str] = None,
        prompt_extend: Optional[bool] = None,
        watermark: bool = False,
        seed: Optional[int] = None,
        audio: Optional[bool] = None,
    ) -> str:
        """
        图生视频：提交任务 → 等待完成 → 下载到本地

        Args:
            prompt: 视频描述提示词
            image_path: 输入首帧图片本地路径
            save_path: 输出视频保存路径
            model: 万象视频模型名
            duration: 视频时长（秒）
            shot_type: 镜头类型，"single" 或 "multi"
            video_ratio: 输出画幅比例，如 9:16 / 16:9
            last_image_path: 可选尾帧图片本地路径（wan2.7）
            first_clip_path: 可选首段视频本地路径（wan2.7 视频续写）
            reference_image_path: 可选参考图片路径（videoedit）
            reference_image_paths: 可选参考图片列表（r2v）
            reference_video_paths: 可选参考视频列表（r2v）
            reference_audio_path: 可选参考音频/音色路径（r2v）
            audio_path: 可选驱动音频本地路径（wan2.7）

        Returns:
            video_url: 远端视频 URL

        Raises:
            FileNotFoundError: 输入图片不存在
            RuntimeError: API 调用或下载失败
        """
        if VideoSynthesis is None:
            raise RuntimeError("dashscope package not installed. Run: pip install dashscope")

        if image_path and not os.path.exists(image_path):
            raise FileNotFoundError(f"输入图片不存在: {image_path}")
        if last_image_path and not os.path.exists(last_image_path):
            raise FileNotFoundError(f"尾帧图片不存在: {last_image_path}")
        if first_clip_path and not os.path.exists(first_clip_path):
            raise FileNotFoundError(f"输入视频片段不存在: {first_clip_path}")
        if reference_image_path and not os.path.exists(reference_image_path):
            raise FileNotFoundError(f"参考图片不存在: {reference_image_path}")
        for ref_image_path in reference_image_paths or []:
            if ref_image_path and not os.path.exists(ref_image_path):
                raise FileNotFoundError(f"参考图片不存在: {ref_image_path}")
        for ref_video_path in reference_video_paths or []:
            if ref_video_path and not os.path.exists(ref_video_path):
                raise FileNotFoundError(f"参考视频不存在: {ref_video_path}")
        if reference_audio_path and not os.path.exists(reference_audio_path):
            raise FileNotFoundError(f"参考音频不存在: {reference_audio_path}")
        if audio_path and not os.path.exists(audio_path):
            raise FileNotFoundError(f"驱动音频不存在: {audio_path}")

        logger.info(f"DashscopeVideoClient: model={model}, prompt={prompt[:60]}...")

        if self._is_reference_to_video_model(model):
            media = self._build_reference_to_video_media(
                image_path=image_path,
                reference_image_path=reference_image_path,
                reference_image_paths=reference_image_paths,
                reference_video_paths=reference_video_paths,
                reference_audio_path=None if "happyhorse" in model.lower() else reference_audio_path,
            )
            if not media:
                raise ValueError("DashScope reference-to-video models require at least one reference_image or reference_video input.")

            call_kwargs = {
                "api_key": self.api_key,
                "model": model,
                "prompt": prompt,
                "media": media,
                "duration": duration,
                "watermark": watermark,
            }
            if audio is not None:
                call_kwargs["audio"] = audio
            if negative_prompt:
                call_kwargs["negative_prompt"] = negative_prompt
            if resolution:
                call_kwargs["resolution"] = resolution
            if video_ratio:
                call_kwargs["ratio"] = video_ratio
            if prompt_extend is not None:
                call_kwargs["prompt_extend"] = prompt_extend
            if seed is not None:
                call_kwargs["seed"] = seed

            rsp = self._with_network_retry(
                "submit task",
                lambda: VideoSynthesis.call(**call_kwargs),
            )
        elif self._is_video_edit_model(model):
            media = self._build_video_edit_media(
                video_path=first_clip_path,
                reference_image_path=reference_image_path or last_image_path or image_path,
            )
            if not media:
                raise ValueError("DashScope video edit models require video input and may use reference_image input.")

            call_kwargs = {
                "api_key": self.api_key,
                "model": model,
                "prompt": prompt,
                "media": media,
                "duration": duration,
                "watermark": watermark,
            }
            if negative_prompt:
                call_kwargs["negative_prompt"] = negative_prompt
            if resolution:
                call_kwargs["resolution"] = resolution
            if video_ratio:
                call_kwargs["ratio"] = video_ratio
            if prompt_extend is not None:
                call_kwargs["prompt_extend"] = prompt_extend
            if seed is not None:
                call_kwargs["seed"] = seed

            rsp = self._with_network_retry(
                "submit task",
                lambda: VideoSynthesis.call(**call_kwargs),
            )
        elif model.startswith("wan2.7") or "happyhorse" in model:
            # wan2.7 series use the new API format with 'media'
            media = self._build_media(
                image_path=image_path,
                last_image_path=last_image_path,
                first_clip_path=first_clip_path,
                audio_path=audio_path,
            )
            if not media:
                raise ValueError("DashScope wan2.7 video generation requires first_frame or first_clip input.")
            self._validate_media_combination(media)

            call_kwargs = {
                "api_key": self.api_key,
                "model": model,
                "prompt": prompt,
                "media": media,
                "duration": duration,
                "watermark": watermark,
            }
            if negative_prompt:
                call_kwargs["negative_prompt"] = negative_prompt
            if resolution:
                call_kwargs["resolution"] = resolution
            if video_ratio:
                call_kwargs["ratio"] = video_ratio
            if prompt_extend is not None:
                call_kwargs["prompt_extend"] = prompt_extend
            if seed is not None:
                call_kwargs["seed"] = seed

            rsp = self._with_network_retry(
                "submit task",
                lambda: VideoSynthesis.call(**call_kwargs),
            )
        else:
            # Older models (wan2.1, wan2.6 etc.) use 'img_url' and 'shot_type'
            if not image_path:
                raise ValueError("DashScope legacy video models require image_path.")

            call_kwargs = {
                "api_key": self.api_key,
                "model": model,
                "prompt": prompt,
                "img_url": self._to_media_url(image_path),
                "duration": duration,
                "shot_type": shot_type,
            }
            if negative_prompt:
                call_kwargs["negative_prompt"] = negative_prompt
            if resolution:
                call_kwargs["resolution"] = resolution
            if video_ratio:
                call_kwargs["ratio"] = video_ratio
            if prompt_extend is not None:
                call_kwargs["prompt_extend"] = prompt_extend
            if watermark is not None:
                call_kwargs["watermark"] = watermark
            if seed is not None:
                call_kwargs["seed"] = seed

            rsp = self._with_network_retry(
                "submit task",
                lambda: VideoSynthesis.call(**call_kwargs),
            )

        if rsp.status_code != HTTPStatus.OK:
            raise RuntimeError(
                f"万象视频 API 错误: status={rsp.status_code}, "
                f"code={rsp.code}, message={rsp.message}"
            )

        video_url = self._extract_video_url(rsp)
        if not video_url:
            task_id = self._extract_task_id(rsp)
            task_status = self._extract_task_status(rsp)
            if not task_id:
                raise RuntimeError(
                    "万象视频 API 未返回 video_url 或 task_id，无法查询结果: "
                    f"status={rsp.status_code}, code={rsp.code}, message={rsp.message}, "
                    f"task_status={task_status}"
                )

            logger.info(f"DashscopeVideoClient: 任务已提交 task_id={task_id}, status={task_status}; 等待生成完成...")
            rsp = self._with_network_retry(
                f"wait task {task_id}",
                lambda: VideoSynthesis.wait(task=rsp, api_key=self.api_key),
                max_attempts=8,
                base_delay=5.0,
            )
            if rsp.status_code != HTTPStatus.OK:
                raise RuntimeError(
                    f"万象视频任务查询失败: status={rsp.status_code}, "
                    f"code={rsp.code}, message={rsp.message}, task_id={task_id}"
                )

            video_url = self._extract_video_url(rsp)
            task_status = self._extract_task_status(rsp)
            if not video_url:
                raise RuntimeError(
                    "万象视频任务完成后仍未返回 video_url: "
                    f"code={rsp.code}, message={rsp.message}, task_id={task_id}, task_status={task_status}, "
                    f"output={self._safe_output_repr(rsp)}"
                )

        logger.info(f"DashscopeVideoClient: 视频生成成功: {video_url}")

        # 确保输出目录存在
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        # 下载视频
        resp = self._with_network_retry(
            "download video",
            lambda: requests.get(video_url, stream=True, timeout=120),
            max_attempts=5,
            base_delay=3.0,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"视频下载失败: HTTP {resp.status_code}")

        with open(save_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        logger.info(f"DashscopeVideoClient: 视频已保存: {save_path}")
        return video_url

    def _is_video_edit_model(self, model: str) -> bool:
        """Return True for DashScope video-edit model IDs."""
        model_lower = model.lower()
        return "videoedit" in model_lower or "video-edit" in model_lower

    def _is_reference_to_video_model(self, model: str) -> bool:
        """Return True for DashScope reference-to-video model IDs."""
        return "r2v" in model.lower()

    def _extract_video_url(self, rsp) -> Optional[str]:
        """Extract video_url from DashScope SDK response variants."""
        output = getattr(rsp, "output", None)
        if output is None:
            return None
        if isinstance(output, dict):
            return output.get("video_url")
        return getattr(output, "video_url", None)

    def _extract_task_id(self, rsp) -> Optional[str]:
        """Extract async task_id from DashScope SDK response variants."""
        output = getattr(rsp, "output", None)
        if output is None:
            return None
        if isinstance(output, dict):
            return output.get("task_id")
        return getattr(output, "task_id", None)

    def _extract_task_status(self, rsp) -> Optional[str]:
        """Extract async task status from DashScope SDK response variants."""
        output = getattr(rsp, "output", None)
        if output is None:
            return None
        if isinstance(output, dict):
            return output.get("task_status")
        return getattr(output, "task_status", None)

    def _safe_output_repr(self, rsp) -> str:
        """Best-effort output representation for provider-side task failures."""
        output = getattr(rsp, "output", None)
        try:
            if isinstance(output, dict):
                return str(output)
            if hasattr(output, "__dict__"):
                return str(output.__dict__)
            return str(output)
        except Exception:
            return "<unprintable output>"

    def _build_media(
        self,
        image_path: Optional[str],
        last_image_path: Optional[str],
        first_clip_path: Optional[str],
        audio_path: Optional[str],
    ) -> list[dict[str, str]]:
        """Build DashScope wan2.7 media array using official media types."""
        media = []
        if first_clip_path:
            media.append({"type": "first_clip", "url": self._to_media_url(first_clip_path)})
        elif image_path:
            media.append({"type": "first_frame", "url": self._to_media_url(image_path)})

        if last_image_path:
            media.append({"type": "last_frame", "url": self._to_media_url(last_image_path)})
        if audio_path:
            media.append({"type": "driving_audio", "url": self._to_media_url(audio_path)})
        return media

    def _build_video_edit_media(
        self,
        video_path: Optional[str],
        reference_image_path: Optional[str],
    ) -> list[dict[str, str]]:
        """Build DashScope video-edit media array using official media types."""
        media = []
        if video_path:
            media.append({"type": "video", "url": self._to_media_url(video_path)})
        if reference_image_path:
            media.append({"type": "reference_image", "url": self._to_media_url(reference_image_path)})
        return media

    def _build_reference_to_video_media(
        self,
        image_path: Optional[str],
        reference_image_path: Optional[str],
        reference_image_paths: Optional[list[str]],
        reference_video_paths: Optional[list[str]],
        reference_audio_path: Optional[str],
    ) -> list[dict[str, str]]:
        """Build DashScope r2v media array using reference_image/reference_video items."""
        media = []
        image_refs = []
        if reference_image_paths:
            image_refs.extend(reference_image_paths)
        if reference_image_path:
            image_refs.append(reference_image_path)
        if image_path:
            image_refs.append(image_path)

        seen = set()
        for index, ref_path in enumerate(image_refs):
            if not ref_path or ref_path in seen:
                continue
            seen.add(ref_path)
            item = {"type": "reference_image", "url": self._to_media_url(ref_path)}
            if index == 0 and reference_audio_path:
                item["reference_voice"] = self._to_media_url(reference_audio_path)
            media.append(item)

        for ref_video_path in reference_video_paths or []:
            if ref_video_path:
                media.append({"type": "reference_video", "url": self._to_media_url(ref_video_path)})

        return media

    def _validate_media_combination(self, media: list[dict[str, str]]) -> None:
        """Validate combinations documented by DashScope wan2.7 i2v."""
        media_types = {item["type"] for item in media}
        allowed = [
            {"first_frame"},
            {"first_frame", "driving_audio"},
            {"first_frame", "last_frame"},
            {"first_frame", "last_frame", "driving_audio"},
            {"first_clip"},
            {"first_clip", "last_frame"},
        ]
        if media_types not in allowed:
            raise ValueError(
                "Invalid DashScope media combination: "
                f"{'+'.join(sorted(media_types))}. "
                "Allowed: first_frame, first_frame+driving_audio, first_frame+last_frame, "
                "first_frame+last_frame+driving_audio, first_clip, first_clip+last_frame."
            )

    def _to_media_url(self, path_or_url: str) -> str:
        """Convert a local path to file:// while preserving URL/data/OSS inputs."""
        if path_or_url.startswith(("http://", "https://", "file://", "oss://", "data:")):
            return path_or_url
        return f"file://{os.path.abspath(path_or_url)}"


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
