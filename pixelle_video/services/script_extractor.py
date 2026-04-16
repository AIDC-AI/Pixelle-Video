# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Script Extractor Service

Downloads video from platform URLs (Bilibili, YouTube, Douyin, etc.) via yt-dlp,
then sends to LLM multimodal model for script extraction.
"""

import base64
import hashlib
import subprocess
import tempfile
from pathlib import Path

from loguru import logger
from openai import AsyncOpenAI

from pixelle_video.config import config_manager


EXTRACT_PROMPT = """请仔细观看这个视频，提取视频中所有的口播文案/旁白/解说词。

要求：
1. 完整提取视频中说话人的所有内容，不要遗漏
2. 保持原始语言，不要翻译
3. 按说话顺序排列，用换行分段
4. 只输出文案内容本身，不要加任何标注、时间戳或额外说明"""

MAX_VIDEO_SIZE_MB = 20
MAX_DURATION_SEC = 600


class ScriptExtractorService:
    """
    Extract script from video platform URLs using LLM.

    Pipeline: platform URL → yt-dlp download → base64 encode → LLM multimodal → text
    """

    def __init__(self):
        self._cache_dir = Path(tempfile.gettempdir()) / "pixelle_video_cache"
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    def _create_client(self) -> tuple[AsyncOpenAI, str]:
        llm_config = config_manager.get_llm_config()
        api_key = llm_config["api_key"] or "dummy-key"
        base_url = llm_config["base_url"] or None
        model = llm_config["model"] or "gpt-4o"

        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url

        return AsyncOpenAI(**client_kwargs), model

    def _url_hash(self, url: str) -> str:
        return hashlib.md5(url.encode()).hexdigest()[:12]

    def download_video(self, url: str) -> Path:
        """Download video from platform URL using yt-dlp."""
        import yt_dlp

        url_hash = self._url_hash(url)
        output_path = self._cache_dir / f"video_{url_hash}.mp4"

        if output_path.exists():
            logger.info(f"Using cached video: {output_path}")
            return output_path

        logger.info(f"Downloading video: {url}")

        ydl_opts = {
            "format": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
            "outtmpl": str(output_path),
            "merge_output_format": "mp4",
            "quiet": True,
            "no_warnings": True,
            "socket_timeout": 30,
            "retries": 3,
            "max_filesize": MAX_VIDEO_SIZE_MB * 1024 * 1024,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception as e:
            if output_path.exists():
                output_path.unlink()
            raise RuntimeError(f"视频下载失败：{e}") from e

        if not output_path.exists():
            raise RuntimeError("下载完成但文件不存在")

        size_mb = output_path.stat().st_size / (1024 * 1024)
        logger.info(f"Downloaded: {size_mb:.1f} MB")

        if size_mb > MAX_VIDEO_SIZE_MB:
            output_path = self._compress_video(output_path)

        return output_path

    def _compress_video(self, video_path: Path) -> Path:
        """Compress video to fit LLM API size limits."""
        compressed = video_path.with_name(video_path.stem + "_small.mp4")
        if compressed.exists():
            return compressed

        logger.info("Compressing video for LLM input...")
        cmd = [
            "ffmpeg", "-i", str(video_path),
            "-vf", "scale=-2:480",
            "-c:v", "libx264", "-crf", "28",
            "-c:a", "aac", "-b:a", "64k",
            "-t", str(MAX_DURATION_SEC),
            "-y", str(compressed),
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            logger.warning(f"Compression failed, using original: {result.stderr[:200]}")
            return video_path

        size_mb = compressed.stat().st_size / (1024 * 1024)
        logger.info(f"Compressed: {size_mb:.1f} MB")
        return compressed

    def _video_to_base64(self, video_path: Path) -> str:
        with open(video_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    async def extract_script(self, url: str) -> str:
        """
        Extract script from a video platform URL.

        Steps: yt-dlp download → base64 → LLM multimodal analysis → text
        """
        logger.info(f"Extracting script from: {url}")

        video_path = self.download_video(url)
        video_b64 = self._video_to_base64(video_path)
        data_uri = f"data:video/mp4;base64,{video_b64}"

        client, model = self._create_client()

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "video_url", "video_url": {"url": data_uri}},
                    {"type": "text", "text": EXTRACT_PROMPT},
                ],
            }
        ]

        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=4096,
                temperature=0.3,
            )

            script = (response.choices[0].message.content or "").strip()
            logger.info(f"Script extracted: {len(script)} chars")
            return script

        except Exception as e:
            logger.error(f"Script extraction failed: {e}")
            raise RuntimeError(
                f"文案提取失败：{e}\n\n"
                "请确认 LLM 配置使用的是支持视频输入的多模态模型（如 Qwen-VL、Gemini、GPT-4o）"
            ) from e

    def get_video_info(self, url: str) -> dict:
        """Get video metadata without downloading."""
        import yt_dlp

        ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True}

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        return {
            "title": info.get("title", ""),
            "duration": info.get("duration", 0),
            "uploader": info.get("uploader", ""),
        }
