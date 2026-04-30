"""
可灵（Kling AI）视频生成客户端
基于可灵 API 的图生视频功能 (image2video)
支持模型: kling-v3, kling-v2-6, kling-v2-5-turbo
"""

import os
import io
import ssl
import time
import base64
import logging
from typing import Optional

import jwt
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from PIL import Image

logger = logging.getLogger(__name__)

# 可灵 API 基础地址
KLING_BASE_URL = "https://api-beijing.klingai.com"


class _TLSAdapter(HTTPAdapter):
    """强制 TLS 1.2 的 HTTPS 适配器，兼容老版本 LibreSSL"""

    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_default_certs()
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


def _build_session(max_retries: int = 3) -> requests.Session:
    """创建带 TLS 适配器和自动重试的 requests Session"""
    session = requests.Session()
    retry = Retry(
        total=max_retries,
        backoff_factor=1,
        status_forcelist=[502, 503, 504],
        allowed_methods=["GET", "POST"],
    )
    adapter = _TLSAdapter(max_retries=retry)
    session.mount("https://", adapter)
    return session


class KlingVideoClient:
    """
    可灵 AI 图生视频客户端
    使用 JWT (HMAC-SHA256) 鉴权，调用 /v1/videos/image2video 接口
    """

    def __init__(
        self,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        base_url: Optional[str] = None,
        token_ttl: int = 1800,
        poll_interval: int = 5,
        max_polls: int = 120,
    ) -> None:
        """
        Args:
            access_key: 可灵 API Access Key
            secret_key: 可灵 API Secret Key
            base_url:   可灵 API 基础 URL (默认北京节点)
            token_ttl:  JWT 有效期（秒），默认 30 分钟
            poll_interval: 轮询间隔（秒）
            max_polls:  最大轮询次数
        """
        self.access_key = access_key or os.getenv("KLING_ACCESS_KEY", "")
        self.secret_key = secret_key or os.getenv("KLING_SECRET_KEY", "")
        self.base_url = (base_url or os.getenv("KLING_BASE_URL", "")).rstrip("/") or KLING_BASE_URL
        self.token_ttl = token_ttl
        self.poll_interval = poll_interval
        self.max_polls = max_polls

        if not self.access_key or not self.secret_key:
            logger.warning(
                "KlingVideoClient: KLING_ACCESS_KEY / KLING_SECRET_KEY 未设置，请检查配置"
            )

        # 使用强制 TLS 1.2 + 自动重试的 Session
        self._session = _build_session()

    # ─── JWT 鉴权 ───

    def _generate_token(self) -> str:
        """
        使用 Access Key / Secret Key 生成 JWT Token
        算法: HS256
        Payload:
          - iss: Access Key
          - iat: 签发时间
          - exp: 过期时间
          - nbf: 生效时间
        """
        now = int(time.time())
        payload = {
            "iss": self.access_key,
            "iat": now,
            "exp": now + self.token_ttl,
            "nbf": now - 5,  # 允许 5 秒时钟偏差
        }
        token = jwt.encode(payload, self.secret_key, algorithm="HS256")
        return token

    def _auth_headers(self) -> dict:
        """构建带 JWT 鉴权的请求头"""
        token = self._generate_token()
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }

    # ─── 图片处理 ───

    @staticmethod
    def _encode_image(image_path: str, quality: int = 85) -> str:
        """
        将本地图片编码为 Base64 字符串
        可灵要求：不添加 data:image/xxx;base64, 前缀，直接传 Base64 字符串
        图片大小 ≤ 10MB，宽高 ≥ 300px，宽高比 1:2.5 ~ 2.5:1
        """
        try:
            with Image.open(image_path) as img:
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=quality)
                return base64.b64encode(buf.getvalue()).decode("utf-8")
        except Exception as e:
            logger.warning(f"图片压缩失败 ({image_path})，使用原始文件: {e}")
            with open(image_path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")

    # ─── 创建任务 ───

    def _submit_task(
        self,
        image_path: str,
        prompt: str = "",
        negative_prompt: str = "",
        model_name: str = "kling-v3",
        mode: str = "pro",
        duration: str = "5",
        cfg_scale: float = 0.5,
        sound: str = "",
    ) -> str:
        """
        提交图生视频任务

        Args:
            image_path: 本地图片路径
            prompt: 正向提示词（≤2500字符）
            negative_prompt: 负向提示词（≤2500字符）
            model_name: 可灵模型名 (kling-v3 / kling-v2-6 / kling-v2-5-turbo)
            mode: 生成模式 std (标准) / pro (高品质)
            duration: 视频时长，v3: "3"~"15", v2: "5"或"10"
            cfg_scale: 自由度 [0,1]，越大越贴合提示词
            sound: 是否生成声音 "on"/"off"

        Returns:
            task_id: 任务 ID
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"输入图片不存在: {image_path}")

        # 根据模型系列确定 duration 范围
        model_lower = model_name.lower()
        is_v3 = "v3" in model_lower or "video-o1" in model_lower
        is_v26 = any(tag in model_lower for tag in ("v2-6", "v2.6"))

        if is_v3:
            # v3 系列支持 3~15s
            clamped = str(min(max(int(duration), 3), 15))
        else:
            # v2 系列仅支持 5 或 10
            clamped = str(min(max(int(duration), 5), 10))

        image_b64 = self._encode_image(image_path)

        body = {
            "model_name": model_name,
            "image": image_b64,
            "mode": mode,
            "duration": clamped,
        }

        # sound 参数处理
        # v3 / v2-6: 默认开启声音，除非显式 sound="off"
        # v2-6 的 sound=on 必须搭配 pro 模式
        # kling-v2-5-turbo 不支持 sound
        if is_v3 or is_v26:
            if sound == "off":
                body["sound"] = "off"
            else:
                body["sound"] = "on"
                # v2-6 的 sound=on 必须搭配 pro 模式; v3 无此限制
                if is_v26 and mode != "pro":
                    mode = "pro"
                    body["mode"] = mode
                    logger.info("KlingVideoClient: v2-6 sound=on 需要 pro 模式，已自动切换")
        elif sound == "on":
            logger.warning(f"KlingVideoClient: 模型 {model_name} 不支持 sound 参数，已忽略")

        if prompt:
            body["prompt"] = prompt
        if negative_prompt:
            body["negative_prompt"] = negative_prompt

        url = f"{self.base_url}/v1/videos/image2video"
        headers = self._auth_headers()

        logger.info(f"KlingVideoClient: 提交任务 model={model_name}, mode={mode}, duration={clamped}s, sound={body.get('sound', 'off')}")

        resp = self._session.post(url, json=body, headers=headers, timeout=300)
        if not resp.ok:
            try:
                err_body = resp.json()
            except Exception:
                err_body = resp.text
            logger.error(f"KlingVideoClient: HTTP {resp.status_code}, 响应: {err_body}")
            resp.raise_for_status()
        data = resp.json()

        if data.get("code") != 0:
            raise RuntimeError(
                f"可灵 API 错误: code={data.get('code')}, message={data.get('message')}"
            )

        task_id = data["data"]["task_id"]
        logger.info(f"KlingVideoClient: 任务已提交 task_id={task_id}")
        return task_id

    # ─── 查询任务 ───

    def _query_task(self, task_id: str) -> dict:
        """
        查询单个任务状态

        Returns:
            API 响应中的 data 字段
        """
        url = f"{self.base_url}/v1/videos/image2video/{task_id}"
        headers = self._auth_headers()

        resp = self._session.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") != 0:
            raise RuntimeError(
                f"可灵查询 API 错误: code={data.get('code')}, message={data.get('message')}"
            )

        return data["data"]

    # ─── 轮询等待 ───

    def _poll_until_done(self, task_id: str) -> dict:
        """
        轮询任务直到完成或失败

        Returns:
            任务结果数据

        Raises:
            RuntimeError: 任务失败
            TimeoutError: 超过最大轮询次数
        """
        for attempt in range(self.max_polls):
            result = self._query_task(task_id)
            status = result.get("task_status", "")

            if status == "succeed":
                logger.info(f"KlingVideoClient: 任务完成 task_id={task_id}")
                return result
            elif status == "failed":
                msg = result.get("task_status_msg", "未知错误")
                raise RuntimeError(f"可灵视频生成失败: {msg} (task_id={task_id})")
            else:
                # submitted / processing
                logger.debug(
                    f"KlingVideoClient: 任务进行中 task_id={task_id}, "
                    f"status={status}, attempt={attempt + 1}/{self.max_polls}"
                )
                time.sleep(self.poll_interval)

        raise TimeoutError(f"可灵视频生成超时 (task_id={task_id}, 已等待 {self.max_polls * self.poll_interval}s)")

    # ─── 下载视频 ───

    @staticmethod
    def _download_video(video_url: str, save_path: str) -> None:
        """从 URL 下载视频到本地"""
        save_dir = os.path.dirname(save_path)
        if save_dir:
            os.makedirs(save_dir, exist_ok=True)
        # 下载也用 TLS 安全 Session
        dl_session = _build_session(max_retries=2)
        resp = dl_session.get(video_url, stream=True, timeout=600)
        resp.raise_for_status()
        with open(save_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        logger.info(f"KlingVideoClient: 视频已保存: {save_path}")

    # ─── 主入口 ───

    def generate_video(
        self,
        prompt: str,
        image_path: str,
        save_path: str,
        model: str = "kling-v3",
        duration: int = 5,
        mode: str = "pro",
        cfg_scale: float = 0.5,
        negative_prompt: str = "",
        sound: str = "",
    ) -> str:
        """
        图生视频完整流程：提交任务 → 轮询等待 → 下载视频

        Args:
            prompt: 视频描述提示词
            image_path: 输入图片本地路径
            save_path: 输出视频保存路径
            model: 可灵模型名 (kling-v3 / kling-v2-6 / kling-v2-5-turbo)
            duration: 视频时长(秒)，v3: 3~15, v2: 5或10
            mode: 生成模式 "std" (标准) 或 "pro" (高品质)
            cfg_scale: 自由度 [0,1]
            negative_prompt: 负向提示词
            sound: 是否生成声音 "on"/"off"

        Returns:
            video_url: 远端视频 URL
        """
        # 1. 提交任务
        task_id = self._submit_task(
            image_path=image_path,
            prompt=prompt,
            negative_prompt=negative_prompt,
            model_name=model,
            mode=mode,
            duration=str(duration),
            cfg_scale=cfg_scale,
            sound=sound,
        )

        # 2. 轮询等待
        result = self._poll_until_done(task_id)

        # 3. 提取视频 URL
        videos = result.get("task_result", {}).get("videos", [])
        if not videos:
            raise RuntimeError(f"可灵任务成功但未返回视频数据 (task_id={task_id})")

        video_url = videos[0].get("url", "")
        if not video_url:
            raise RuntimeError(f"可灵任务成功但视频 URL 为空 (task_id={task_id})")

        # 4. 下载到本地
        self._download_video(video_url, save_path)

        return video_url


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    # ── 测试参数（按需修改） ──
    IMAGE_PATH = "code/result/image/test_avail/test_input.png"
    OUTPUT_PATH = "code/result/video/test_avail/kling_test_output.mp4"
    PROMPT = ""
    MODEL = "kling-v3"         # kling-v3 / kling-v2-6 / kling-v2-5-turbo
    DURATION = 5               # v3: 3~15, v2: 5 或 10
    MODE = "pro"               # std 或 pro
    SOUND = ""                 # "" = 自动开启, "on", "off"

    print("=== 可灵 (Kling) 图生视频测试 ===")
    ak = Config.KLING_ACCESS_KEY
    sk = Config.KLING_SECRET_KEY
    base_url = Config.KLING_BASE_URL
    if not ak or not sk:
        print("✗ KLING_ACCESS_KEY / KLING_SECRET_KEY 未设置，请检查 .env 配置")
        sys.exit(1)

    if not os.path.exists(IMAGE_PATH):
        print(f"✗ 输入图片不存在: {IMAGE_PATH}")
        sys.exit(1)

    print(f"  Access Key : {ak[:6]}***{ak[-4:]}")
    print(f"  Base URL   : {base_url}")
    print(f"  输入图片   : {IMAGE_PATH}")
    print(f"  输出路径   : {OUTPUT_PATH}")
    print(f"  模型       : {MODEL}")
    print(f"  时长       : {DURATION}s")
    print(f"  模式       : {MODE}")
    print(f"  声音       : {SOUND or '自动'}")
    if PROMPT:
        print(f"  提示词     : {PROMPT[:80]}")
    print("-" * 40)

    try:
        client = KlingVideoClient(access_key=ak, secret_key=sk, base_url=base_url)
        print("✓ 客户端初始化成功")

        start = time.time()
        video_url = client.generate_video(
            prompt=PROMPT,
            image_path=IMAGE_PATH,
            save_path=OUTPUT_PATH,
            model=MODEL,
            duration=DURATION,
            mode=MODE,
            sound=SOUND,
        )
        elapsed = time.time() - start

        print(f"✓ 视频生成完成！耗时 {elapsed:.1f}s")
        print(f"  远端 URL : {video_url}")
        print(f"  本地文件 : {os.path.abspath(OUTPUT_PATH)}")
        print(f"  文件大小 : {os.path.getsize(OUTPUT_PATH) / 1024 / 1024:.2f} MB")
    except Exception as e:
        print(f"✗ 失败: {e}")
        sys.exit(1)
