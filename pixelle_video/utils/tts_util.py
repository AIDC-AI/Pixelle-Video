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
Edge TTS Utility - Temporarily not used

This is the original edge-tts implementation, kept here for potential future use.
Currently, TTS service uses ComfyUI workflows only.
"""

import asyncio
import ssl
import random
import certifi
import edge_tts as edge_tts_sdk
from edge_tts.exceptions import NoAudioReceived
from loguru import logger
from aiohttp import WSServerHandshakeError, ClientResponseError


# Use certifi bundle for SSL verification instead of disabling it
_USE_CERTIFI_SSL = True

# Retry configuration for Edge TTS (to handle 401 errors and NoAudioReceived)
_RETRY_COUNT = 5           # Default retry count
_RETRY_BASE_DELAY = 1.0     # Base retry delay in seconds (for exponential backoff)
_MAX_RETRY_DELAY = 10.0     # Maximum retry delay in seconds

# Rate limiting configuration
_REQUEST_DELAY = 0.5        # Minimum delay before each request (seconds)
_MAX_CONCURRENT_REQUESTS = 3  # Maximum concurrent requests

# Global semaphore for rate limiting (created per event loop)
_request_semaphore = None
_semaphore_loop = None


def _get_request_semaphore():
    """Get or create request semaphore for current event loop"""
    global _request_semaphore, _semaphore_loop
    
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running loop
        return asyncio.Semaphore(_MAX_CONCURRENT_REQUESTS)
    
    # If semaphore doesn't exist or belongs to different loop, create new one
    if _request_semaphore is None or _semaphore_loop != current_loop:
        _request_semaphore = asyncio.Semaphore(_MAX_CONCURRENT_REQUESTS)
        _semaphore_loop = current_loop
    
    return _request_semaphore


async def edge_tts(
    text: str,
    voice: str = "[Chinese] zh-CN Yunjian",
    rate: str = "+0%",
    volume: str = "+0%",
    pitch: str = "+0Hz",
    output_path: str = None,
    retry_count: int = _RETRY_COUNT,
    retry_base_delay: float = _RETRY_BASE_DELAY,
    proxy: str = None,
) -> bytes:
    """
    Convert text to speech using Microsoft Edge TTS
    
    This service is free and requires no API key.
    Supports 400+ voices across 100+ languages.
    
    Returns audio data as bytes (MP3 format).
    
    Includes automatic retry mechanism with exponential backoff and jitter
    to handle 401 authentication errors and temporary network issues.
    Also includes concurrent request limiting and rate limiting.
    
    Args:
        text: Text to convert to speech
        voice: Voice ID (e.g., [Chinese] zh-CN Yunjian, [English] en-US Jenny)
        rate: Speech rate (e.g., +0%, +50%, -20%)
        volume: Speech volume (e.g., +0%, +50%, -20%)
        pitch: Speech pitch (e.g., +0Hz, +10Hz, -5Hz)
        output_path: Optional output file path to save audio
        retry_count: Number of retries on failure (default: 5)
        retry_base_delay: Base delay for exponential backoff (default: 1.0s)
    
    Returns:
        Audio data as bytes (MP3 format)
    
    Popular Chinese voices:
    - [Chinese] zh-CN Yunjian (male, default)
    - [Chinese] zh-CN Xiaoxiao (female)
    - [Chinese] zh-CN Yunxi (male)
    - [Chinese] zh-CN Xiaoyi (female)
    
    Popular English voices:
    - [English] en-US Jenny (female)
    - [English] en-US Guy (male)
    - [English] en-GB Sonia (female, British)
    
    Example:
        audio_bytes = await edge_tts(
            text="你好，世界！",
            voice="[Chinese] zh-CN Yunjian",
            rate="+20%"
        )
    """
    logger.debug(f"Calling Edge TTS with voice: {voice}, rate: {rate}, retry_count: {retry_count}")
    
    # Use semaphore to limit concurrent requests
    request_semaphore = _get_request_semaphore()
    async with request_semaphore:
        # Add a small random delay before each request to avoid rate limiting
        pre_delay = _REQUEST_DELAY + random.uniform(0, 0.3)
        logger.debug(f"Waiting {pre_delay:.2f}s before request (rate limiting)")
        await asyncio.sleep(pre_delay)
        
        last_error = None
        
        # Retry loop
        for attempt in range(retry_count + 1):  # +1 because first attempt is not a retry
            if attempt > 0:
                # Exponential backoff with jitter
                # delay = base * (2 ^ attempt) + random jitter
                exponential_delay = retry_base_delay * (2 ** (attempt - 1))
                jitter = random.uniform(0, retry_base_delay)
                retry_delay = min(exponential_delay + jitter, _MAX_RETRY_DELAY)
                
                logger.info(f"🔄 Retrying Edge TTS (attempt {attempt + 1}/{retry_count + 1}) after {retry_delay:.2f}s delay...")
                await asyncio.sleep(retry_delay)
            
            try:
                # Create communicate instance with certifi SSL context
                if _USE_CERTIFI_SSL:
                    if attempt == 0:  # Only log info once
                        logger.debug("Using certifi SSL certificates for secure Edge TTS connection")
                    # Create SSL context with certifi bundle
                    import certifi
                    ssl_context = ssl.create_default_context(cafile=certifi.where())
                else:
                    ssl_context = None
                
                # Create communicate instance
                communicate = edge_tts_sdk.Communicate(
                    text=text,
                    voice=voice,
                    rate=rate,
                    volume=volume,
                    pitch=pitch,
                    proxy=proxy,
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
            
            except (WSServerHandshakeError, ClientResponseError) as e:
                # Network/authentication errors - retry
                last_error = e
                error_code = getattr(e, 'status', 'unknown')
                error_msg = str(e)
                
                # Log more detailed information for 401 errors
                if error_code == 401 or '401' in error_msg:
                    logger.warning(f"⚠️  Edge TTS 401 Authentication Error (attempt {attempt + 1}/{retry_count + 1})")
                    logger.debug(f"Error details: {error_msg}")
                    logger.debug(f"This is usually caused by rate limiting. Will retry with exponential backoff...")
                else:
                    logger.warning(f"⚠️  Edge TTS error (attempt {attempt + 1}/{retry_count + 1}): {error_code} - {e}")
                
                if attempt >= retry_count:
                    # Last attempt failed
                    logger.error(f"❌ All {retry_count + 1} attempts failed. Last error: {error_code}")
                    raise
                # Otherwise, continue to next retry
            
            except NoAudioReceived as e:
                # NoAudioReceived is often a temporary issue - retry with longer delay
                last_error = e
                logger.warning(f"⚠️  Edge TTS NoAudioReceived (attempt {attempt + 1}/{retry_count + 1})")
                logger.debug(f"This is usually a temporary Microsoft service issue. Will retry with longer delay...")
                
                if attempt >= retry_count:
                    logger.error(f"❌ All {retry_count + 1} attempts failed due to NoAudioReceived")
                    raise
                # Add extra delay for NoAudioReceived errors
                await asyncio.sleep(2.0)
            
            except Exception as e:
                # Other errors - don't retry, raise immediately
                logger.error(f"Edge TTS error (non-retryable): {type(e).__name__} - {e}")
                raise
        
        # Should not reach here, but just in case
        if last_error:
            raise last_error
        else:
            raise RuntimeError("Edge TTS failed without error (unexpected)")


def get_audio_duration(audio_path: str) -> float:
    """
    Get audio file duration in seconds
    
    Args:
        audio_path: Path to audio file
    
    Returns:
        Duration in seconds
    """
    try:
        # Try using ffmpeg-python
        import ffmpeg
        probe = ffmpeg.probe(audio_path)
        duration = float(probe['format']['duration'])
        return duration
    except Exception as e:
        logger.warning(f"Failed to get audio duration: {e}, using estimate")
        # Fallback: estimate based on file size (very rough)
        import os
        file_size = os.path.getsize(audio_path)
        # Assume ~16kbps for MP3, so 2KB per second
        estimated_duration = file_size / 2000
        return max(1.0, estimated_duration)  # At least 1 second


async def list_voices(locale: str = None, retry_count: int = _RETRY_COUNT, retry_base_delay: float = _RETRY_BASE_DELAY) -> list[str]:
    """
    List all available voices for Edge TTS
    
    Returns a list of voice IDs (ShortName).
    Optionally filter by locale.
    
    Includes automatic retry mechanism with exponential backoff and jitter
    to handle network errors and rate limiting.
    
    Args:
        locale: Filter by locale (e.g., zh-CN, en-US, ja-JP)
        retry_count: Number of retries on failure (default: 5)
        retry_base_delay: Base delay for exponential backoff (default: 1.0s)
    
    Returns:
        List of voice IDs
    
    Example:
        # List all voices
        voices = await list_voices()
        # Returns: ['[Chinese] zh-CN Yunjian', '[Chinese] zh-CN Xiaoxiao', ...]
        
        # List Chinese voices only
        voices = await list_voices(locale="zh-CN")
        # Returns: ['[Chinese] zh-CN Yunjian', '[Chinese] zh-CN Xiaoxiao', ...]
    """
    logger.debug(f"Fetching Edge TTS voices, locale filter: {locale}, retry_count: {retry_count}")
    
    # Use semaphore to limit concurrent requests
    request_semaphore = _get_request_semaphore()
    async with request_semaphore:
        # Add a small random delay before each request to avoid rate limiting
        pre_delay = _REQUEST_DELAY + random.uniform(0, 0.3)
        logger.debug(f"Waiting {pre_delay:.2f}s before request (rate limiting)")
        await asyncio.sleep(pre_delay)
        
        last_error = None
        
        # Retry loop
        for attempt in range(retry_count + 1):
            if attempt > 0:
                # Exponential backoff with jitter
                exponential_delay = retry_base_delay * (2 ** (attempt - 1))
                jitter = random.uniform(0, retry_base_delay)
                retry_delay = min(exponential_delay + jitter, _MAX_RETRY_DELAY)
                
                logger.info(f"🔄 Retrying list voices (attempt {attempt + 1}/{retry_count + 1}) after {retry_delay:.2f}s delay...")
                await asyncio.sleep(retry_delay)
            
            try:
                # Get all voices (edge-tts handles SSL internally)
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
            
            except (WSServerHandshakeError, ClientResponseError) as e:
                # Network/authentication errors - retry
                last_error = e
                error_code = getattr(e, 'status', 'unknown')
                error_msg = str(e)
                
                # Log more detailed information for 401 errors
                if error_code == 401 or '401' in error_msg:
                    logger.warning(f"⚠️  Edge TTS 401 Authentication Error (list_voices attempt {attempt + 1}/{retry_count + 1})")
                    logger.debug(f"Error details: {error_msg}")
                    logger.debug(f"This is usually caused by rate limiting. Will retry with exponential backoff...")
                else:
                    logger.warning(f"⚠️  List voices error (attempt {attempt + 1}/{retry_count + 1}): {error_code} - {e}")
                
                if attempt >= retry_count:
                    logger.error(f"❌ All {retry_count + 1} attempts failed. Last error: {error_code}")
                    raise
            
            except Exception as e:
                # Other errors - don't retry, raise immediately
                logger.error(f"List voices error (non-retryable): {type(e).__name__} - {e}")
                raise
        
        # Should not reach here, but just in case
        if last_error:
            raise last_error
        else:
            raise RuntimeError("List voices failed without error (unexpected)")

