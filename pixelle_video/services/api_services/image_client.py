import os
import time
import uuid
import logging
from typing import List, Optional
from .config import Config

try:
    from .image_dashscope import DashScopeClient
    from .image_seedream import SeedreamClient
    from .image_gpt import ImageGPT
    from .image_processor import ImageProcessor
except ImportError:
    from .image_dashscope import DashScopeClient
    from .image_seedream import SeedreamClient
    from .image_gpt import ImageGPT
    from .image_processor import ImageProcessor

class ImageClient:
    def __init__(self,
                 dashscope_api_key: Optional[str] = None,
                 dashscope_base_url: Optional[str] = None,
                 gpt_api_key: Optional[str] = None,
                 gpt_base_url: Optional[str] = None,
                 local_proxy: Optional[str] = None,
                 ark_api_key: Optional[str] = None,
                 ark_base_url: Optional[str] = None):
        """
        Unified Image Generation Client
        Routes requests to DashScope, Seedream, or GPT based on model name.
        """
        # Initialize DashScope Client
        self.dashscope_client = DashScopeClient(
            api_key=dashscope_api_key or Config.DASHSCOPE_API_KEY,
            base_url=dashscope_base_url or Config.DASHSCOPE_BASE_URL
        )

        # Initialize Seedream Client
        self.seedream_client = SeedreamClient(
            api_key=ark_api_key or Config.ARK_API_KEY,
            base_url=ark_base_url or Config.ARK_BASE_URL
        )

        # Initialize GPT Image Client
        self.gpt_client = ImageGPT(
            api_key=gpt_api_key or Config.OPENAI_API_KEY,
            base_url=gpt_base_url or Config.OPENAI_BASE_URL,
            local_proxy=local_proxy or Config.LOCAL_PROXY
        )

        # Initialize Image Processor for downloads
        self.image_processor = ImageProcessor()

        # Default save directory
        self.base_save_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "code", "result", "image_client")

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
                        print(f" - [Base64图片]")
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
        
        # Prepare save directory
        if not save_dir:
            if session_id:
                save_dir = os.path.join(self.base_save_dir, session_id)
            else:
                save_dir = self.base_save_dir
        os.makedirs(save_dir, exist_ok=True)
        
        generated_local_paths = []

        if is_seedream:
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
