"""
Edge TTS Utility - Temporarily not used

This is the original edge-tts implementation, kept here for potential future use.
Currently, TTS service uses ComfyUI workflows only.
"""

import asyncio
import ssl
import edge_tts as edge_tts_sdk
from loguru import logger
from aiohttp import WSServerHandshakeError, ClientResponseError


# Global flag for SSL verification (set to False for development only)
_SSL_VERIFY_ENABLED = False

# Retry configuration for Edge TTS (to handle 401 errors)
_RETRY_COUNT = 3       # Default retry count
_RETRY_DELAY = 2.0     # Retry delay in seconds


async def edge_tts(
    text: str,
    voice: str = "zh-CN-YunjianNeural",
    rate: str = "+0%",
    volume: str = "+0%",
    pitch: str = "+0Hz",
    output_path: str = None,
    retry_count: int = _RETRY_COUNT,
    retry_delay: float = _RETRY_DELAY,
) -> bytes:
    """
    Convert text to speech using Microsoft Edge TTS
    
    This service is free and requires no API key.
    Supports 400+ voices across 100+ languages.
    
    Returns audio data as bytes (MP3 format).
    
    Includes automatic retry mechanism to handle 401 authentication errors
    and temporary network issues (default: 3 retries with 2s delay).
    
    Args:
        text: Text to convert to speech
        voice: Voice ID (e.g., zh-CN-YunjianNeural, en-US-JennyNeural)
        rate: Speech rate (e.g., +0%, +50%, -20%)
        volume: Speech volume (e.g., +0%, +50%, -20%)
        pitch: Speech pitch (e.g., +0Hz, +10Hz, -5Hz)
        output_path: Optional output file path to save audio
        retry_count: Number of retries on failure (default: 3)
        retry_delay: Delay between retries in seconds (default: 2.0)
    
    Returns:
        Audio data as bytes (MP3 format)
    
    Popular Chinese voices:
    - zh-CN-YunjianNeural (male, default)
    - zh-CN-XiaoxiaoNeural (female)
    - zh-CN-YunxiNeural (male)
    - zh-CN-XiaoyiNeural (female)
    
    Popular English voices:
    - en-US-JennyNeural (female)
    - en-US-GuyNeural (male)
    - en-GB-SoniaNeural (female, British)
    
    Example:
        audio_bytes = await edge_tts(
            text="你好，世界！",
            voice="zh-CN-YunjianNeural",
            rate="+20%"
        )
    """
    logger.debug(f"Calling Edge TTS with voice: {voice}, rate: {rate}, retry_count: {retry_count}")
    
    last_error = None
    
    # Retry loop
    for attempt in range(retry_count + 1):  # +1 because first attempt is not a retry
        try:
            if attempt > 0:
                logger.info(f"🔄 Retrying Edge TTS (attempt {attempt + 1}/{retry_count + 1}) after {retry_delay}s delay...")
                await asyncio.sleep(retry_delay)
            
            # Monkey patch ssl.create_default_context if SSL verification is disabled
            if not _SSL_VERIFY_ENABLED:
                if attempt == 0:  # Only log warning once
                    logger.warning("SSL verification is disabled for development. This is NOT recommended for production!")
                original_create_default_context = ssl.create_default_context
                
                def create_unverified_context(*args, **kwargs):
                    ctx = original_create_default_context(*args, **kwargs)
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    return ctx
                
                # Temporarily replace the function
                ssl.create_default_context = create_unverified_context
            
            try:
                # Create communicate instance
                communicate = edge_tts_sdk.Communicate(
                    text=text,
                    voice=voice,
                    rate=rate,
                    volume=volume,
                    pitch=pitch,
                )
                
                # Collect audio chunks
                audio_chunks = []
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio_chunks.append(chunk["data"])
                
                audio_data = b"".join(audio_chunks)
                
                if attempt > 0:
                    logger.success(f"✅ Retry succeeded on attempt {attempt + 1}")
                
                logger.info(f"Generated {len(audio_data)} bytes of audio data")
                
                # Save to file if output_path is provided
                if output_path:
                    with open(output_path, "wb") as f:
                        f.write(audio_data)
                    logger.info(f"Audio saved to: {output_path}")
                
                return audio_data
            
            finally:
                # Restore original function if we patched it
                if not _SSL_VERIFY_ENABLED:
                    ssl.create_default_context = original_create_default_context
        
        except (WSServerHandshakeError, ClientResponseError) as e:
            # Network/authentication errors - retry
            last_error = e
            error_code = getattr(e, 'status', 'unknown')
            logger.warning(f"⚠️  Edge TTS error (attempt {attempt + 1}/{retry_count + 1}): {error_code} - {e}")
            
            if attempt >= retry_count:
                # Last attempt failed
                logger.error(f"❌ All {retry_count + 1} attempts failed. Giving up.")
                raise
            # Otherwise, continue to next retry
        
        except Exception as e:
            # Other errors - don't retry, raise immediately
            logger.error(f"Edge TTS error (non-retryable): {e}")
            raise
    
    # Should not reach here, but just in case
    if last_error:
        raise last_error
    else:
        raise RuntimeError("Edge TTS failed without error (unexpected)")


async def list_voices(locale: str = None, retry_count: int = _RETRY_COUNT, retry_delay: float = _RETRY_DELAY) -> list[str]:
    """
    List all available voices for Edge TTS
    
    Returns a list of voice IDs (ShortName).
    Optionally filter by locale.
    
    Includes automatic retry mechanism to handle network errors
    (default: 3 retries with 2s delay).
    
    Args:
        locale: Filter by locale (e.g., zh-CN, en-US, ja-JP)
        retry_count: Number of retries on failure (default: 3)
        retry_delay: Delay between retries in seconds (default: 2.0)
    
    Returns:
        List of voice IDs
    
    Example:
        # List all voices
        voices = await list_voices()
        # Returns: ['zh-CN-YunjianNeural', 'zh-CN-XiaoxiaoNeural', ...]
        
        # List Chinese voices only
        voices = await list_voices(locale="zh-CN")
        # Returns: ['zh-CN-YunjianNeural', 'zh-CN-XiaoxiaoNeural', ...]
    """
    logger.debug(f"Fetching Edge TTS voices, locale filter: {locale}, retry_count: {retry_count}")
    
    last_error = None
    
    # Retry loop
    for attempt in range(retry_count + 1):
        try:
            if attempt > 0:
                logger.info(f"🔄 Retrying list voices (attempt {attempt + 1}/{retry_count + 1}) after {retry_delay}s delay...")
                await asyncio.sleep(retry_delay)
            
            # Monkey patch SSL if verification is disabled
            if not _SSL_VERIFY_ENABLED:
                if attempt == 0:  # Only log warning once
                    logger.warning("SSL verification is disabled for development. This is NOT recommended for production!")
                original_create_default_context = ssl.create_default_context
                
                def create_unverified_context(*args, **kwargs):
                    ctx = original_create_default_context(*args, **kwargs)
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    return ctx
                
                ssl.create_default_context = create_unverified_context
            
            try:
                # Get all voices
                voices = await edge_tts_sdk.list_voices()
                
                # Filter by locale if specified
                if locale:
                    voices = [v for v in voices if v["Locale"].startswith(locale)]
                
                # Extract voice IDs (ShortName)
                voice_ids = [voice["ShortName"] for voice in voices]
                
                if attempt > 0:
                    logger.success(f"✅ Retry succeeded on attempt {attempt + 1}")
                
                logger.info(f"Found {len(voice_ids)} voices" + (f" for locale '{locale}'" if locale else ""))
                return voice_ids
            
            finally:
                # Restore original function if we patched it
                if not _SSL_VERIFY_ENABLED:
                    ssl.create_default_context = original_create_default_context
        
        except (WSServerHandshakeError, ClientResponseError) as e:
            # Network/authentication errors - retry
            last_error = e
            error_code = getattr(e, 'status', 'unknown')
            logger.warning(f"⚠️  List voices error (attempt {attempt + 1}/{retry_count + 1}): {error_code} - {e}")
            
            if attempt >= retry_count:
                logger.error(f"❌ All {retry_count + 1} attempts failed. Giving up.")
                raise
        
        except Exception as e:
            # Other errors - don't retry, raise immediately
            logger.error(f"List voices error (non-retryable): {e}")
            raise
    
    # Should not reach here, but just in case
    if last_error:
        raise last_error
    else:
        raise RuntimeError("List voices failed without error (unexpected)")

