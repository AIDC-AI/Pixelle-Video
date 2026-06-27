import os
from typing import List, Optional
from .config import Config

try:
    from .vlm_dashscope import QwenVLClient
    from .vlm_twelvelabs import PegasusClient
except ImportError:
    from vlm_dashscope import QwenVLClient
    from vlm_twelvelabs import PegasusClient

# Pegasus is video-only; models are routed to TwelveLabs by name prefix.
_TWELVELABS_MODEL_PREFIX = "pegasus"

class VLM:
    def __init__(self,
                 dashscope_api_key: Optional[str] = None,
                 dashscope_base_url: Optional[str] = None,
                 twelvelabs_api_key: Optional[str] = None):
        """
        Unified VLM (Vision Language Model) Client.

        Routes asset-analysis VLM requests by model name:
        - ``pegasus*`` -> TwelveLabs Pegasus (video-only understanding)
        - everything else -> DashScope (Qwen/Qwen-Omni)
        """
        dashscope_key = dashscope_api_key or Config.DASHSCOPE_API_KEY
        twelvelabs_key = twelvelabs_api_key or Config.TWELVELABS_API_KEY

        self.dashscope_client = (
            QwenVLClient(
                api_key=dashscope_key,
                base_url=dashscope_base_url or Config.DASHSCOPE_BASE_URL
            )
            if dashscope_key else None
        )
        self.twelvelabs_client = (
            PegasusClient(api_key=twelvelabs_key) if twelvelabs_key else None
        )

    def query(self,
             prompt: str,
             image_paths: Optional[List[str]] = None,
             model: Optional[str] = None,
             session_id: Optional[str] = None,
             video_paths: Optional[List[str]] = None) -> str:
        selected_model = (model or "").strip()
        if not selected_model:
            raise RuntimeError("DashScope VLM model must be explicitly selected.")

        if Config.PRINT_MODEL_INPUT:
            print("---- VLM REQUEST ----")
            print(f"Prompt: {prompt}")
            if image_paths:
                print(f"Images: {len(image_paths)}")
                for p in image_paths:
                    if p.startswith("data:"):
                        print(f" - [Base64图片]")
                    else:
                        print(f" - {p}")
            if video_paths:
                print(f"Videos: {len(video_paths)}")
                for p in video_paths:
                    print(f" - {p}")
            print(f"Model: {selected_model}")
            if session_id:
                print(f"Session ID: {session_id}")
            print("-" * 30)

        # Route Pegasus (video understanding) to TwelveLabs.
        if selected_model.lower().startswith(_TWELVELABS_MODEL_PREFIX):
            if self.twelvelabs_client is None:
                raise RuntimeError("TwelveLabs VLM API key is not configured.")
            if image_paths and not video_paths:
                raise ValueError(
                    "TwelveLabs Pegasus is video-only and cannot analyze images."
                )
            if not video_paths:
                raise ValueError("TwelveLabs Pegasus requires a video input.")
            return self.twelvelabs_client.analyze_video(
                text=prompt,
                videos=video_paths,
                model=selected_model,
            )

        if self.dashscope_client is None:
            raise RuntimeError("DashScope VLM API key is not configured.")

        image_urls = [self._to_dashscope_file_url(path, allow_data_url=True) for path in image_paths or []]
        video_urls = [self._to_dashscope_file_url(path, allow_data_url=False) for path in video_paths or []]
        return self.dashscope_client.chat(
            text=prompt,
            images=image_urls,
            videos=video_urls,
            model=selected_model,
            stream=False,
        )

    def _to_dashscope_file_url(self, path: str, allow_data_url: bool) -> str:
        if path.startswith("data:"):
            if not allow_data_url:
                raise ValueError("DashScope video input does not support data URLs in this adapter.")

            import base64 as b64
            import tempfile

            try:
                header, b64_data = path.split(",", 1)
                mime_type = header.split(";")[0].replace("data:", "")
                image_data = b64.b64decode(b64_data)
                suffix = f".{mime_type.split('/')[-1]}" if "/" in mime_type else ".png"
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    tmp.write(image_data)
                    temp_path = tmp.name
                return f"file://{os.path.abspath(temp_path)}"
            except Exception as e:
                print(f"Error processing base64 image: {e}")
                raise ValueError(f"无法解析 base64 图片: {e}")

        if path.startswith("http") or path.startswith("file://"):
            return path

        return f"file://{os.path.abspath(path)}"
