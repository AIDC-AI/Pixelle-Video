"""
ReelForge Core - Service Layer

Provides unified access to all capabilities (LLM, TTS, Image, etc.)
"""

from typing import Optional

from loguru import logger

from reelforge.config import load_config
from reelforge.services.llm_service import LLMService
from reelforge.services.tts_service import TTSService
from reelforge.services.image import ImageService
from reelforge.services.narration_generator import NarrationGeneratorService
from reelforge.services.image_prompt_generator import ImagePromptGeneratorService
from reelforge.services.frame_composer import FrameComposerService
from reelforge.services.storyboard_processor import StoryboardProcessorService
from reelforge.services.video_generator import VideoGeneratorService


class ReelForgeCore:
    """
    ReelForge Core - Service Layer
    
    Provides unified access to all capabilities.
    
    Usage:
        from reelforge import reelforge
        
        # Initialize
        await reelforge.initialize()
        
        # Use capabilities directly
        answer = await reelforge.llm("Explain atomic habits")
        audio = await reelforge.tts("Hello world")
        image = await reelforge.image(prompt="a cat")
        
        # Check active capabilities
        print(f"Using LLM: {reelforge.llm.active}")
        print(f"Available TTS: {reelforge.tts.available}")
    
    Architecture (Simplified):
        ReelForgeCore (this class)
          ├── config (configuration)
          ├── llm (LLM service - direct OpenAI SDK)
          ├── tts (TTS service - ComfyKit workflows)
          └── image (Image service - ComfyKit workflows)
    """
    
    def __init__(self, config_path: str = "config.yaml"):
        """
        Initialize ReelForge Core
        
        Args:
            config_path: Path to configuration file
        """
        self.config = load_config(config_path)
        self._initialized = False
        
        # Core services (initialized in initialize())
        self.llm: Optional[LLMService] = None
        self.tts: Optional[TTSService] = None
        self.image: Optional[ImageService] = None
        
        # Content generation services
        self.narration_generator: Optional[NarrationGeneratorService] = None
        self.image_prompt_generator: Optional[ImagePromptGeneratorService] = None
        
        # Frame processing services
        self.frame_composer: Optional[FrameComposerService] = None
        self.storyboard_processor: Optional[StoryboardProcessorService] = None
        
        # Video generation service (named as verb for direct calling)
        self.generate_video: Optional[VideoGeneratorService] = None
    
    async def initialize(self):
        """
        Initialize core capabilities
        
        This initializes all services and must be called before using any capabilities.
        
        Example:
            await reelforge.initialize()
        """
        if self._initialized:
            logger.warning("ReelForge already initialized")
            return
        
        logger.info("🚀 Initializing ReelForge...")
        
        # 1. Initialize core services (no capability layer)
        self.llm = LLMService(self.config)
        self.tts = TTSService(self.config)
        self.image = ImageService(self.config)
        
        # 2. Initialize content generation services
        self.narration_generator = NarrationGeneratorService(self)
        self.image_prompt_generator = ImagePromptGeneratorService(self)
        
        # 3. Initialize frame processing services
        self.frame_composer = FrameComposerService()
        self.storyboard_processor = StoryboardProcessorService(self)
        
        # 4. Initialize video generation service
        self.generate_video = VideoGeneratorService(self)
        
        self._initialized = True
        logger.info("✅ ReelForge initialized successfully\n")
    
    @property
    def project_name(self) -> str:
        """Get project name from config"""
        return self.config.get("project_name", "ReelForge")
    
    def __repr__(self) -> str:
        """String representation"""
        status = "initialized" if self._initialized else "not initialized"
        return f"<ReelForgeCore project={self.project_name!r} status={status}>"


# Global instance
reelforge = ReelForgeCore()
