"""
Seedance 视频生成 API 客户端 (字节跳动 ARK)

"""

import os
import time
import logging
import requests
import base64
from typing import Optional

logger = logging.getLogger(__name__)

class SeedanceVideoClient:
    """
    Seedance 视频生成客户端（字节跳动 ARK）
    支持图生视频功能，采用 提交任务 -> 轮询 -> 下载 的异步流程
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        local_proxy: Optional[str] = None,
        timeout: int = 120,
    ) -> None:
        self.api_key = api_key or os.getenv("ARK_API_KEY")
        self.base_url = (base_url or os.getenv("ARK_BASE_URL") or "https://ark.cn-beijing.volces.com/api/v3").rstrip("/")
        self.local_proxy = local_proxy
        self.timeout = timeout

        if not self.api_key:
            logger.warning("SeedanceVideoClient: ARK_API_KEY 未设置")

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _proxies(self) -> Optional[dict]:
        if not self.local_proxy:
            return None
        return {"http": self.local_proxy, "https": self.local_proxy}

    def generate_video(
        self,
        prompt: str,
        image_path: Optional[str],
        save_path: str,
        model: str = "doubao-seedance-2-0-260128",
        duration: int = 5,
        **kwargs
    ) -> str:
        """
        图生视频完整流程

        Args:
            prompt: 提示词
            image_path: 输入图片本地路径；为空时走文生视频
            save_path: 输出视频保存路径
            model: 模型名称
            duration: 视频时长
        """
        if not self.api_key:
            raise RuntimeError("ARK_API_KEY not set.")

        # 1. 提交任务
        task_id = self._submit_task(prompt, image_path, model, duration, **kwargs)
        
        # 2. 轮询等待
        video_url = self._poll_until_done(task_id)
        
        # 3. 下载视频
        self._download_video(video_url, save_path)
        
        return video_url

    def _submit_task(self, prompt: str, image_path: Optional[str], model: str, duration: int, **kwargs) -> str:
        # 根据 Seedance 2.0 文档更新接口路径
        url = f"{self.base_url}/contents/generations/tasks"

        # 构建 content 数组
        content = []
        if prompt:
            content.append({
                "type": "text",
                "text": prompt
            })

        if image_path:
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"输入图片不存在: {image_path}")

            with open(image_path, "rb") as f:
                img_data = base64.b64encode(f.read()).decode("utf-8")
            ext = os.path.splitext(image_path)[1].lower()
            mime = "image/png" if ext == ".png" else "image/jpeg"
            image_base64 = f"data:{mime};base64,{img_data}"

            # 图生视频-首帧
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": image_base64
                },
                "role": "first_frame"
            })

        payload = {
            "model": model,
            "content": content,
            "duration": duration,
            "ratio": kwargs.get("ratio", "adaptive"),
            "resolution": kwargs.get("resolution", "720p")
        }

        # 合并其他可选参数 (如 seed, watermark)
        for key in ["seed", "watermark", "generate_audio"]:
            if key in kwargs and kwargs[key] is not None:
                payload[key] = kwargs[key]

        logger.info(f"SeedanceVideoClient: 提交任务 model={model}, duration={duration}s")
        resp = requests.post(
            url,
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
            proxies=self._proxies(),
        )
        
        if not resp.ok:
            logger.error(f"Seedance 提交失败: {resp.text}")
            resp.raise_for_status()
            
        data = resp.json()
        task_id = data.get("id")
        if not task_id:
            raise RuntimeError(f"Seedance API 未返回任务 ID: {data}")
            
        return task_id

    def _poll_until_done(self, task_id: str, max_polls: int = 120, interval: int = 5) -> str:
        # 同步更新查询接口路径
        url = f"{self.base_url}/contents/generations/tasks/{task_id}"
        
        for i in range(max_polls):
            resp = requests.get(url, headers=self._headers(), timeout=30, proxies=self._proxies())
            resp.raise_for_status()
            data = resp.json()
            
            status = data.get("status")
            if status == "succeeded":
                # 根据实际返回体，URL 位于 content.video_url 或 video_url
                video_url = data.get("content", {}).get("video_url") or data.get("video_url")
                if not video_url:
                    raise RuntimeError(f"Seedance 任务成功但未返回视频 URL: {data}")
                return video_url
            elif status in ("failed", "expired"):
                error_msg = data.get("error", {}).get("message") or data.get("status_msg") or "未知错误"
                raise RuntimeError(f"Seedance 视频生成{status}: {error_msg}")
            
            logger.debug(f"SeedanceVideoClient: 任务进行中 {task_id}, status={status}, poll={i+1}")
            time.sleep(interval)
            
        raise TimeoutError(f"Seedance 视频生成超时 (task_id={task_id})")

    def _download_video(self, url: str, save_path: str):
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        resp = requests.get(url, stream=True, timeout=120, proxies=self._proxies())
        resp.raise_for_status()
        with open(save_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        logger.info(f"SeedanceVideoClient: 视频已保存: {save_path}")
