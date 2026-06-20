import logging
import os
from typing import List, Optional

from .config import Config

try:
    from .image_agnes import AgnesImageClient
    from .image_dashscope import DashScopeClient
    from .image_gpt import ImageGPT
    from .image_processor import ImageProcessor
    from .image_seedream import SeedreamClient
except ImportError:
    from .image_agnes import AgnesImageClient
    from .image_dashscope import DashScopeClient
    from .image_gpt import ImageGPT
    from .image_processor import ImageProcessor
    from .image_seedream import SeedreamClient

class ImageClient:
    def __init__(self,
                 dashscope_api_key: Optional[str] = None,
                 dashscope_base_url: Optional[str] = None,
                 dashscope_local_proxy: Optional[str] = None,
                 gpt_api_key: Optional[str] = None,
                 gpt_base_url: Optional[str] = None,
                 local_proxy: Optional[str] = None,
                 ark_api_key: Optional[str] = None,
                 ark_base_url: Optional[str] = None,
                 ark_local_proxy: Optional[str] = None,
                 agnes_api_key: Optional[str] = None,
                 agnes_base_url: Optional[str] = None,
                 agnes_local_proxy: Optional[str] = None):
        """
        Unified Image Generation Client
        Routes requests to DashScope, Seedream, or GPT based on model name.
        """
        self._dashscope_api_key = dashscope_api_key or Config.DASHSCOPE_API_KEY
        self._dashscope_base_url = dashscope_base_url or Config.DASHSCOPE_BASE_URL
        self._dashscope_local_proxy = dashscope_local_proxy

        self._gpt_api_key = gpt_api_key or Config.OPENAI_API_KEY
        self._gpt_base_url = gpt_base_url or Config.OPENAI_BASE_URL
        self._gpt_local_proxy = local_proxy or Config.LOCAL_PROXY

        self._ark_api_key = ark_api_key or Config.ARK_API_KEY
        self._ark_base_url = ark_base_url or Config.ARK_BASE_URL
        self._ark_local_proxy = ark_local_proxy

        self._agnes_api_key = agnes_api_key or Config.AGNES_API_KEY
        self._agnes_base_url = agnes_base_url or Config.AGNES_BASE_URL
        self._agnes_local_proxy = agnes_local_proxy

        self._dashscope_client = None
        self._seedream_client = None
        self._gpt_client = None
        self._agnes_client = None

        # Initialize Image Processor for downloads
        self.image_processor = ImageProcessor()

        # Default save directory
        self.base_save_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "code", "result", "image_client")

    @property
    def dashscope_client(self):
        """Create DashScope client only when a DashScope model is selected."""
        if self._dashscope_client is None:
            self._dashscope_client = DashScopeClient(
                api_key=self._dashscope_api_key,
                base_url=self._dashscope_base_url,
                local_proxy=self._dashscope_local_proxy,
            )
        return self._dashscope_client

    @property
    def seedream_client(self):
        """Create Seedream client only when a Seedream/ARK model is selected."""
        if not self._ark_api_key:
            raise RuntimeError("ARK_API_KEY not set. Configure ARK only when using Seedream image models.")
        if self._seedream_client is None:
            self._seedream_client = SeedreamClient(
                api_key=self._ark_api_key,
                base_url=self._ark_base_url,
                local_proxy=self._ark_local_proxy,
            )
        return self._seedream_client

    @property
    def gpt_client(self):
        """Create OpenAI image client only when a GPT/OpenAI image model is selected."""
        if not self._gpt_api_key:
            raise RuntimeError("OPENAI_API_KEY not set. Configure OpenAI only when using GPT image models.")
        if self._gpt_client is None:
            self._gpt_client = ImageGPT(
                api_key=self._gpt_api_key,
                base_url=self._gpt_base_url,
                local_proxy=self._gpt_local_proxy,
            )
        return self._gpt_client

    @property
    def agnes_client(self):
        """Create Agnes image client only when an Agnes image model is selected."""
        if not self._agnes_api_key:
            raise RuntimeError("AGNES_API_KEY not set. Configure Agnes only when using Agnes image models.")
        if self._agnes_client is None:
            self._agnes_client = AgnesImageClient(
                api_key=self._agnes_api_key,
                base_url=self._agnes_base_url,
                local_proxy=self._agnes_local_proxy,
            )
        return self._agnes_client

    def generate_image(self,
                       prompt: str,
                       image_paths: Optional[List[str]] = None,
                       model: str = "wan2.7-image",
                       save_dir: Optional[str] = None,
                       session_id: Optional[str] = None,
                       video_ratio: Optional[str] = "16:9",
                       resolution: Optional[str] = "2K") -> List[str]:
        """
        Generate images based on prompt and optional reference images.

        Args:
            prompt: Text prompt for generation.
            image_paths: List of local file paths or URLs for reference images.
            model: Model name to determine which provider to use.
            save_dir: Custom directory to save downloaded images.
            session_id: Session ID for organizing saved files.
            video_ratio: Aspect ratio of the video, e.g., "16:9", "9:16", "4:3", "3:4", "1:1".
            resolution: Resolution string, e.g., "720P", "1080P", "2K", "4K".

        Returns:
            List of absolute file paths of the generated images.
        """
        # Determine size from video_ratio and resolution
        size_map = {
            "16:9": {
                "720P": "1280*720",
                "1080P": "1920*1080",
                "2K": "2560*1440",
                "4K": "3840*2160"
            },
            "9:16": {
                "720P": "720*1280",
                "1080P": "1080*1920",
                "2K": "1440*2560",
                "4K": "2160*3840"
            },
            "4:3": {
                "720P": "960*720",
                "1080P": "1440*1080",
                "2K": "2560*1920",
                "4K": "3840*2880"
            },
            "3:4": {
                "720P": "720*960",
                "1080P": "1080*1440",
                "2K": "1920*2560",
                "4K": "2880*3840"
            },
            "1:1": {
                "720P": "720*720",
                "1080P": "1080*1080",
                "2K": "2560*2560",
                "4K": "3840*3840"
            }
        }
        
        # Default fallback if ratio or resolution is not found
        size = size_map.get(video_ratio, size_map["16:9"]).get(resolution, "1920*1080")

        if not model:
            model = "wan2.7-image"  # Default model

        if Config.PRINT_MODEL_INPUT:
            print("---- IMAGE GENERATION REQUEST ----")
            print(f"Prompt: {prompt}")
            if image_paths:
                print(f"Refs: {len(image_paths)}")
                for p in image_paths:
                    if str(p).startswith("data:"):
                        print(" - [Base64图片]")
                    else:
                        print(f" - {p}")
            print(f"Model: {model}")
            print(f"Video Ratio: {video_ratio}")
            print(f"Resolution: {resolution}")
            print(f"Final Size: {size}")
            if session_id:
                print(f"Session ID: {session_id}")
            print("-" * 30)
            
        # Determine backend provider
        is_seedream = "seedream" in model.lower()
        is_sora = "sora" in model.lower() or "gpt" in model.lower()
        is_agnes = "agnes-image" in model.lower()
        
        # Prepare save directory
        if not save_dir:
            if session_id:
                save_dir = os.path.join(self.base_save_dir, session_id)
            else:
                save_dir = self.base_save_dir
        os.makedirs(save_dir, exist_ok=True)
        
        generated_local_paths = []

        if is_agnes:
            try:
                logging.info(f"ImageClient requesting Agnes: {model}")
                agnes_size = size.replace("*", "x") if size else "1024x1024"
                agnes_model = model
                if image_paths and "2.1" in agnes_model:
                    logging.info("Agnes image-to-image is optimized for 2.0 Flash; switching model.")
                    agnes_model = "agnes-image-2.0-flash"

                paths = self.agnes_client.generate_image(
                    prompt=prompt,
                    model=agnes_model,
                    session_id=session_id or "default",
                    size=agnes_size,
                    image_paths=image_paths,
                    save_dir=save_dir,
                )
                if paths:
                    generated_local_paths.extend(paths)

            except Exception as e:
                logging.error(f"Agnes image generation failed: {e}")
                raise RuntimeError(f"Agnes image generation failed: {e}") from e

        elif is_seedream:
            # --- Seedream Logic ---
            try:
                logging.info(f"ImageClient requesting Seedream: {model}")

                paths = self.seedream_client.generate_image(
                    prompt=prompt,
                    model=model,
                    session_id=session_id or "default",
                    size=size or "2048*2048",
                    image_paths=image_paths
                )

                if paths:
                    generated_local_paths.extend(paths)

            except Exception as e:
                logging.error(f"Seedream generation failed: {e}")

        elif is_sora:
            # --- GPT/Sora Logic ---
            try:
                logging.info(f"ImageClient requesting GPT/Sora: {model}")
                if image_paths:
                    logging.warning("Sora/GPT model only supports Text-to-Image. Ignoring reference images.")
                
                # OpenAI uses 'x' separator, e.g. 1024x1024
                # Attempt to map size if needed or just replace '*'
                gpt_size = size.replace('*', 'x') if size else "1024x1024"

                path = self.gpt_client.generate_image(
                    prompt=prompt,
                    size=gpt_size,
                    model=model,
                    save_dir=save_dir
                )
                
                if path and os.path.exists(path):
                    generated_local_paths.append(path)
                else:
                    logging.error(f"GPT/Sora returned invalid path or download failed: {path}")

            except Exception as e:
                logging.error(f"GPT/Sora generation failed: {e}")

        else:
            # --- DashScope Logic ---
            try:
                logging.info(f"ImageClient requesting DashScope: {model}")

                if image_paths and len(image_paths) > 0:
                    # Pre-process image paths for DashScope
                    # Convert local paths to file:// URIs if they aren't already URLs
                    # DashScope SDK (via MultiModalConversation) handles file://
                    formatted_urls = []
                    for p in image_paths:
                        if p.startswith("http") or p.startswith("file://"):
                            formatted_urls.append(p)
                        else:
                            abs_path = os.path.abspath(p)
                            formatted_urls.append(f"file://{abs_path}")
                    
                    paths = self.dashscope_client.edit_image(
                        prompt=prompt,
                        image_urls=formatted_urls,
                        model=model,
                        size=size,
                        session_id=session_id,
                        save_dir=save_dir
                    )
                else:
                    # Text to Image
                    # Assuming default size 1024*1024 or similar
                    paths = self.dashscope_client.generate_image(
                        prompt=prompt,
                        model=model,
                        size=size,
                        session_id=session_id,
                        save_dir=save_dir
                    )
                
                if paths:
                    generated_local_paths.extend(paths)
                            
            except Exception as e:
                logging.error(f"DashScope generation failed: {e}")
                raise RuntimeError(f"DashScope generation failed: {e}") from e

        return generated_local_paths
