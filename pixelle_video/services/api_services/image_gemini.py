import os
import time
import uuid
import base64
import logging
import httpx

try:
    from .image_processor import ImageProcessor
except ImportError:
    from image_processor import ImageProcessor

logger = logging.getLogger(__name__)

# Gemini 原生图像生成仅接受这几档比例，与内部 video_ratio 同档
_GEMINI_ASPECTS = {"1:1", "3:4", "4:3", "9:16", "16:9"}


class ImageGemini:
    """Gemini 原生图像生成客户端（generateContent REST）。

    支持 gemini-3-pro-image / gemini-3.1-flash-image 等图像模型，
    可走中转 base_url。文生图与图生图（参考图作为 inlineData 输入）。
    """
    def __init__(self, api_key: str = None, base_url: str = None,
                 local_proxy: str = None, timeout: float = 300.0):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.base_url = (base_url or "https://generativelanguage.googleapis.com").rstrip("/")
        self.timeout = timeout
        self.local_proxy = local_proxy
        self.image_processor = ImageProcessor(local_proxy=local_proxy)
        self.max_attempts = 4

    def _endpoint(self, model: str) -> str:
        return f"{self.base_url}/v1beta/models/{model}:generateContent"

    @staticmethod
    def _encode_image(image_path: str):
        """本地图片 → Gemini inlineData part，失败返回 None。"""
        # ponytail: 仅认本地文件，远程 URL（http）静默返回 None 被丢弃。
        # 当前 story-illustration 资产图均经 api_media 落盘为本地路径，不触发；
        # 若未来 provider 直接返回远程 URL 未落盘，参考图会无声丢失——届时在此加 httpx 下载。
        if not image_path or not os.path.exists(image_path):
            return None
        try:
            with open(image_path, "rb") as f:
                data = base64.b64encode(f.read()).decode("utf-8")
            ext = os.path.splitext(image_path)[1].lower().replace(".", "")
            mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                    "png": "image/png", "webp": "image/webp"}.get(ext, "image/png")
            return {"inlineData": {"mimeType": mime, "data": data}}
        except Exception as e:
            logging.warning(f"Encode reference image failed {image_path}: {e}")
            return None

    @staticmethod
    def _extract_image(data: dict):
        """从 generateContent 响应里取第一张图的 (base64, mimeType)。"""
        for cand in data.get("candidates", []):
            for part in cand.get("content", {}).get("parts", []):
                idata = part.get("inlineData") or part.get("inline_data")
                if idata and idata.get("data"):
                    return idata["data"], idata.get("mimeType", "image/png")
        return None, None

    def generate_image(self, prompt: str, model: str = "gemini-3-pro-image",
                       save_dir: str = None, image_urls: list = None,
                       aspect_ratio: str = None):
        """生成单张图，下载落盘并返回本地路径（无 save_dir 则返回 base64）。

        Args:
            prompt: 图像描述提示词
            model: Gemini 图像模型名
            save_dir: 保存目录
            image_urls: 参考图片本地路径列表（图生图）
            aspect_ratio: "9:16"/"1:1"/"16:9"/"3:4"/"4:3"，不在档则不传交由模型默认
        """
        parts = [{"text": prompt}]
        if image_urls:
            for p in image_urls[:6]:
                enc = self._encode_image(p)
                if enc:
                    parts.append(enc)

        generation_config = {"responseModalities": ["TEXT", "IMAGE"]}
        # ponytail: Gemini 仅接受固定几档比例，越界不传（模型默认），避免 400
        if aspect_ratio in _GEMINI_ASPECTS:
            generation_config["imageConfig"] = {"aspectRatio": aspect_ratio}

        body = {"contents": [{"parts": parts}], "generationConfig": generation_config}
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-goog-api-key"] = self.api_key
        # 中转站常以 ?key= 鉴权，原生亦支持，双保险
        params = {"key": self.api_key} if self.api_key else None

        last_error = None
        for attempt in range(self.max_attempts):
            try:
                with httpx.Client(proxy=self.local_proxy, timeout=self.timeout) as client:
                    resp = client.post(self._endpoint(model), headers=headers,
                                       params=params, json=body)
                resp.raise_for_status()
                data = resp.json()
                img_b64, img_mime = self._extract_image(data)
                if not img_b64:
                    raise RuntimeError(f"Gemini 响应未包含图像: {str(data)[:300]}")
                if save_dir:
                    os.makedirs(save_dir, exist_ok=True)
                    ext = "png" if "png" in (img_mime or "") else "jpg"
                    fname = f"gemini_{int(time.time())}_{uuid.uuid4().hex[:6]}.{ext}"
                    fpath = os.path.join(save_dir, fname)
                    with open(fpath, "wb") as f:
                        f.write(base64.b64decode(img_b64))
                    return fpath
                return img_b64
            except Exception as e:
                last_error = e
                logging.warning(f"Gemini image attempt {attempt + 1}/{self.max_attempts} failed: {e}")
                if attempt < self.max_attempts - 1:
                    time.sleep(min(4 * (2 ** attempt), 30))  # ponytail: exp backoff, max 30s
        raise Exception(f"Gemini image generation failed after {self.max_attempts} attempts. Last error: {last_error}")
