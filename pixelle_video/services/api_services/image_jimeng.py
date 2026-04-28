"""
即梦 Ti2V (Text+Image to Video) API 客户端
火山引擎视觉智能服务 - jimeng_ti2v_v30_pro 模型
"""

import os
import time
import base64
import json
import logging
import io
from typing import Optional, Dict, Any
import requests
from PIL import Image


class JiMengClient:
    """
    即梦图生视频客户端（火山引擎）
    支持基于文本+图片生成视频的功能
    """

    # API操作类型
    SUBMIT_ACTION = "CVSync2AsyncSubmitTask"  # 提交异步任务
    RESULT_ACTION = "CVSync2AsyncGetResult"    # 获取异步任务结果
    API_VERSION = "2022-08-31"                 # API版本号

    def __init__(
        self,
        base_url: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        timeout: int = 120,
        poll_interval: int = 2,
        max_polls: int = 60,
    ) -> None:
        """
        初始化即梦客户端

        Args:
            timeout: HTTP请求超时时间（秒）
            poll_interval: 轮询间隔（秒）
            max_polls: 最大轮询次数
        """
        self.base_url = base_url or os.getenv("VOLC_BASE_URL")
        self.access_key = access_key or os.getenv("VOLC_ACCESS_KEY")
        self.secret_key = secret_key or os.getenv("VOLC_SECRET_KEY")
        self.timeout = timeout
        self.poll_interval = poll_interval
        self.max_polls = max_polls
        self.region = "cn-north-1"  # 火山引擎区域
        self.service = "cv"          # 服务名称：计算机视觉

        if not self.access_key or not self.secret_key:
            logging.warning(
                "JiMengClient missing access_key/secret_key. Set VOLC_ACCESS_KEY and VOLC_SECRET_KEY."
            )

    def _headers(self, method: str, path: str, query: str, body: str) -> Dict[str, str]:
        """
        生成带火山引擎签名v4的请求头
        
        Args:
            method: HTTP方法（如 POST）
            path: 请求路径
            query: 查询字符串
            body: 请求体
            
        Returns:
            包含认证信息的请求头字典
        """
        import hashlib
        import hmac
        from datetime import datetime, timezone
        
        if not self.access_key or not self.secret_key:
            return {"Content-Type": "application/json"}
            
        # 生成时间戳
        now = datetime.now(timezone.utc)
        timestamp = now.strftime('%Y%m%dT%H%M%SZ')
        date_stamp = now.strftime('%Y%m%d')
        
        # 计算请求体的SHA256哈希
        payload_hash = hashlib.sha256(body.encode('utf-8')).hexdigest()
        
        # 构建规范请求（Canonical Request）
        canonical_uri = path
        canonical_querystring = query
        host = self.base_url.split("//")[1]
        signed_headers = 'content-type;host;x-content-sha256;x-date'
        canonical_headers = (
            f'content-type:application/json\n'
            f'host:{host}\n'
            f'x-content-sha256:{payload_hash}\n'
            f'x-date:{timestamp}\n'
        )
        
        canonical_request = (
            f'{method}\n{canonical_uri}\n{canonical_querystring}\n'
            f'{canonical_headers}\n{signed_headers}\n{payload_hash}'
        )
        
        # 构建待签名字符串（String to Sign）
        algorithm = 'HMAC-SHA256'
        credential_scope = f'{date_stamp}/{self.region}/{self.service}/request'
        string_to_sign = (
            f'{algorithm}\n{timestamp}\n{credential_scope}\n'
            f'{hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()}'
        )
        
        # 生成签名密钥（Signing Key）
        def sign(key, msg):
            return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()
        
        k_date = sign(self.secret_key.encode('utf-8'), date_stamp)
        k_region = sign(k_date, self.region)
        k_service = sign(k_region, self.service)
        k_signing = sign(k_service, 'request')
        
        # 计算签名
        signature = hmac.new(k_signing, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
        
        # 构建Authorization请求头
        authorization_header = (
            f'{algorithm} Credential={self.access_key}/{credential_scope}, '
            f'SignedHeaders={signed_headers}, Signature={signature}'
        )
        
        return {
            'Content-Type': 'application/json',
            'X-Date': timestamp,
            'X-Content-Sha256': payload_hash,
            'Authorization': authorization_header
        }

    def _submit_url(self) -> str:
        """构建提交任务的URL"""
        return f"{self.base_url}?Action={self.SUBMIT_ACTION}&Version={self.API_VERSION}"

    def _result_url(self) -> str:
        """构建查询结果的URL"""
        return f"{self.base_url}?Action={self.RESULT_ACTION}&Version={self.API_VERSION}"

    @staticmethod
    def _encode_image_to_base64(image_path: str, quality: int = 80) -> str:
        """
        将本地图片压缩并编码为base64字符串（仅转换格式和压缩质量，不调整尺寸）
        
        Args:
            image_path: 图片文件路径
            quality: JPEG压缩质量
            
        Returns:
            base64编码的图片字符串
        """
        try:
            with Image.open(image_path) as img:
                # 转换为RGB（去除PNG的Alpha通道，兼容JPEG）
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                    
                # 保存为JPEG字节流
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG", quality=quality)
                return base64.b64encode(buffer.getvalue()).decode("utf-8")
        except Exception as e:
            logging.warning(f"Image compression failed for {image_path}, falling back to raw read: {e}")
            # 降级方案：直接读取原文件
            with open(image_path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
        
    @staticmethod
    def download_video(video_url: str, save_path: str, timeout: int = 60) -> None:
        """
        从URL下载视频文件到本地
        
        Args:
            video_url: 视频文件URL
            save_path: 本地保存路径
            timeout: 下载超时时间（秒）
        """
        with requests.get(video_url, stream=True, timeout=timeout) as r:
            r.raise_for_status()
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            with open(save_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
        
    def poll_task(self, model: str, task_id: str) -> Dict[str, Any]:
        """
        轮询任务直到完成或失败
        
        Args:
            model: 模型key
            task_id: 任务ID
            
        Returns:
            任务结果数据字典，包含 video_url 等信息
            
        Raises:
            RuntimeError: 当API Key未设置或任务失败时
            TimeoutError: 当超过最大轮询次数时
        """
        if not self.access_key or not self.secret_key:
            raise RuntimeError("VOLC_ACCESS_KEY and VOLC_SECRET_KEY not set; cannot call JiMeng Ti2V API.")

        for attempt in range(self.max_polls):
            payload = {"req_key": model, "task_id": task_id}
            body = json.dumps(payload)
            query = f"Action={self.RESULT_ACTION}&Version={self.API_VERSION}"
            headers = self._headers("POST", "/", query, body)
            
            # 查询任务状态
            response = requests.post(
                self._result_url(),
                data=body,
                headers=headers,
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            
            # 检查返回码
            if data.get("code") != 10000:
                raise RuntimeError(f"GetResult failed: {data}")

            status = data.get("data", {}).get("status")
            
            # 任务完成
            if status == "done":
                return data["data"]
            
            # 任务进行中，继续等待
            if status in {"in_queue", "generating"}:
                time.sleep(self.poll_interval)
                continue
            
            # 任务失败或过期
            if status in {"not_found", "expired"}:
                raise RuntimeError(f"Task {task_id} {status}")

        raise TimeoutError(f"Polling timeout for task {task_id}")

    def generate_video(
        self,
        prompt: Optional[str],
        image_path: Optional[str],
        seed: int = -1,
        frames: int = 121,
        aspect_ratio: str = "16:9",
    ) -> str:
        """
        提交视频生成任务
        
        Args:
            prompt: 文本提示词（最多800字符）
            image_path: 输入图片的本地路径
            seed: 随机种子，-1表示随机
            frames: 生成视频的帧数，默认121帧
            aspect_ratio: 视频宽高比，默认 "16:9"
            
        Returns:
            task_id: 任务ID，用于后续查询结果
            
        Raises:
            RuntimeError: 当API Key未设置或任务提交失败时
        """
        if not self.access_key or not self.secret_key:
            raise RuntimeError("VOLC_ACCESS_KEY and VOLC_SECRET_KEY not set; cannot call JiMeng Ti2V API.")

        # 构建请求载荷
        payload: Dict[str, Any] = {
            "req_key": self.req_key,
            "seed": seed,
            "frames": frames,
            "aspect_ratio": aspect_ratio,
        }

        # 添加文本提示词
        if prompt:
            payload["prompt"] = prompt

        # 添加base64编码的图片数据
        if image_path:
            payload["binary_data_base64"] = [self._encode_image_to_base64(image_path)]

        body = json.dumps(payload)
        query = f"Action={self.SUBMIT_ACTION}&Version={self.API_VERSION}"
        headers = self._headers("POST", "/", query, body)
        
        # 发送请求
        response = requests.post(
            self._submit_url(),
            data=body,
            headers=headers,
            timeout=self.timeout,
        )
        response.raise_for_status()
        data = response.json()
        
        # 检查返回码
        if data.get("code") != 10000:
            raise RuntimeError(f"Submit failed: {data}")
            
        task_id = data["data"]["task_id"]
        return task_id

    def _save_base64_images(self, b64_list: list, session_id: str) -> list:
        """保存Base64图片到本地"""
        image_urls = []
        # 定位到 backend/code/result
        # 当前文件在 backend/tool/jimeng_api.py
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # 直接使用 session_id 构建路径
        result_dir = os.path.join(base_dir, "code", "result", "image", str(session_id))
        os.makedirs(result_dir, exist_ok=True)

        for idx, b64_str in enumerate(b64_list):
            file_name = f"jimeng_{int(time.time())}_{idx}.png"
            file_path = os.path.join(result_dir, file_name)
            
            try:
                with open(file_path, "wb") as f:
                    f.write(base64.b64decode(b64_str))
                image_urls.append(file_path)
            except Exception as e:
                logging.error(f"Failed to save base64 image: {e}")
        
        return image_urls

    def generate_image(self,
                       prompt: str,
                       session_id: str,
                       image_paths: list = [],
                       model: str = "jimeng_t2i_v40",
                       size: str = "1920*1080",
                       **kwargs) -> list:
        """
        生成图片
        
        Args:
            prompt: 提示词
            session_id: 任务或会话ID，用于构建存储路径
            image_paths: 参考图路径或URL列表 (最多10张)
            model: 模型 req_key
            size: 生成图片的分辨率 "1024*1024" or "1920*1080".
            **kwargs: 其他生成参数 (size, width, height, scale, force_single, min_ratio, max_ratio)
            
        Returns:
            生成的图片路径或URL列表
        """
        if not self.access_key or not self.secret_key:
            raise RuntimeError("VOLC_ACCESS_KEY and VOLC_SECRET_KEY not set.")
        
        # 处理图片分辨率，长宽比
        width = int(size.split("*")[0]) if size else None
        height = int(size.split("*")[1]) if size else None
        size = width * height if width and height else None

        # 1. 构造请求参数
        payload = {
            "req_key": model,
            "prompt": prompt,
            "size": size,
            "width": width,
            "height": height,
        }
        
        # 处理可选参数
        valid_keys = ["width", "height", "scale", "force_single", "min_ratio", "max_ratio"]
        for key in valid_keys:
            if key in kwargs:
                payload[key] = kwargs[key]
                
        # 处理参考图
        if image_paths:
            img_urls = []
            img_b64s = []
            for p in image_paths:
                if p.startswith("http") or p.startswith("https"):
                    img_urls.append(p)
                elif os.path.exists(p):
                    img_b64s.append(self._encode_image_to_base64(p))
            
            if img_urls:
                payload["image_urls"] = img_urls
            if img_b64s:
                payload["binary_data_base64"] = img_b64s

        body = json.dumps(payload)
        query = f"Action={self.SUBMIT_ACTION}&Version={self.API_VERSION}"
        headers = self._headers("POST", "/", query, body)
        
        # 2. 提交任务
        response = requests.post(
            self._submit_url(),
            data=body,
            headers=headers,
            timeout=self.timeout,
        )
        response.raise_for_status()
        response = response.json()
        if response.get("code") != 10000:
            raise RuntimeError(f"Jimeng Generate Failed: {response}")
        data = response.get("data", {})
            
        # 3. 处理异步任务
        task_id = data.get("task_id", None)
        if not task_id:
             raise RuntimeError(f"No task_id or binary data returned: {data}")
        logging.info(f"Jimeng image task submitted: {task_id}, waiting for result...")
        # 复用 poll_task
        result = self.poll_task(model=model, task_id=task_id)
        return self._save_base64_images(result.get("binary_data_base64", []), session_id=session_id)
    
if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config  # 加载 .env

    print("=== 即梦 (JiMeng) 可用性测试 ===")
    ak = os.getenv("VOLC_ACCESS_KEY", "")
    sk = os.getenv("VOLC_SECRET_KEY", "")
    base_url = os.getenv("VOLC_BASE_URL", "")
    if not ak or not sk:
        print("✗ VOLC_ACCESS_KEY / VOLC_SECRET_KEY 未设置，跳过")
        sys.exit(1)
    print(f"  Access Key: {ak[:6]}***{ak[-4:]}")
    if base_url:
        print(f"  Base URL: {base_url}")
    client = JiMengClient(access_key=ak, secret_key=sk, base_url=base_url)
    prompt = "一只橘猫躺在阳光下的窗台上，水彩画风格"
    print(f"\n[图片] Prompt: {prompt}")
    t0 = time.time()
    try:
        paths = client.generate_image(
            prompt=prompt, session_id="test_avail",
            model="jimeng_t2i_v40", size="1024*1024",
        )
        elapsed = time.time() - t0
        if paths:
            print(f"✓ 生成 {len(paths)} 张图片 ({elapsed:.1f}s): {paths}")
        else:
            print(f"✗ 返回空列表 ({elapsed:.1f}s)")
    except Exception as e:
        print(f"✗ 图片生成失败: {e}")
    