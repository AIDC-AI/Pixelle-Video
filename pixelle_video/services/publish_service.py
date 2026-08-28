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
Publish Service - one-click distribution of generated videos to social platforms

Pixelle-Video renders the video; this service delivers it. Publishing goes through
the Upload-Post API, so a single API key covers every platform and no per-platform
OAuth app, review process or access token has to be maintained here.

Supported platforms: TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter),
Threads, Pinterest, Bluesky, Reddit, Telegram, Discord, Google Business Profile.

Docs: https://docs.upload-post.com

Usage:
    result = await pixelle_video.publish(
        video_path="output/xxx/final.mp4",
        title="How to build better habits",
    )
"""

import asyncio
import os
from typing import Optional

import httpx
from loguru import logger

from pixelle_video.config import config_manager

# Platforms accepted by the Upload-Post `platform[]` parameter.
SUPPORTED_PLATFORMS = (
    "tiktok",
    "instagram",
    "youtube",
    "facebook",
    "linkedin",
    "x",
    "threads",
    "pinterest",
    "bluesky",
    "reddit",
    "telegram",
    "discord",
    "google_business",
)

# Platforms that reject an upload without a title.
TITLE_REQUIRED_PLATFORMS = ("youtube", "reddit")


class PublishError(Exception):
    """Raised when a publish request cannot be completed"""


class PublishService:
    """
    Publish generated videos to social platforms via Upload-Post.

    The service is optional: when `publish.enabled` is false or no API key is
    configured, `is_configured()` returns False and callers can skip publishing
    without any of the generation pipeline changing behaviour.
    """

    API_BASE = "https://api.upload-post.com"

    def __init__(self, config: dict, core=None):
        """
        Initialize publish service

        Args:
            config: Configuration dict (kept for symmetry with other services)
            core: PixelleVideoCore instance (optional)
        """
        self.config = config
        self.core = core

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    @property
    def _settings(self):
        """Read publish settings from the global config (supports hot reload)"""
        return config_manager.config.publish

    @property
    def enabled(self) -> bool:
        return bool(self._settings.enabled)

    @property
    def api_key(self) -> str:
        return (self._settings.api_key or "").strip()

    @property
    def user(self) -> str:
        """Upload-Post profile name that owns the connected social accounts"""
        return (self._settings.user or "").strip()

    @property
    def platforms(self) -> list:
        return list(self._settings.platforms or [])

    def is_configured(self) -> bool:
        """Check whether publishing is enabled and usable"""
        return bool(self.enabled and self.api_key and self.user)

    def _headers(self) -> dict:
        # Upload-Post API keys use the `Apikey` scheme, not `Bearer`.
        return {"Authorization": f"Apikey {self.api_key}"}

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

    async def upload_video(
        self,
        video_path: str,
        title: str,
        platforms: Optional[list] = None,
        description: Optional[str] = None,
        scheduled_date: Optional[str] = None,
        timezone: Optional[str] = None,
        async_upload: bool = True,
        extra_params: Optional[dict] = None,
    ) -> dict:
        """
        Publish a rendered video to one or more social platforms

        Args:
            video_path: Path to the rendered video file
            title: Caption / title. Required for YouTube and Reddit
            platforms: Target platforms (defaults to `publish.platforms` in config)
            description: Longer text, used by YouTube, LinkedIn, Facebook and Pinterest
            scheduled_date: ISO-8601 timestamp to schedule the post instead of
                publishing immediately (e.g. "2026-01-31T18:00:00Z")
            timezone: IANA timezone that `scheduled_date` is expressed in (default UTC)
            async_upload: Return as soon as the upload is accepted and let the
                platforms process in the background (recommended for long videos)
            extra_params: Any additional Upload-Post parameter, e.g.
                {"privacy_level": "SELF_ONLY", "youtube_title": "...", "is_ai_generated": True}

        Returns:
            API response dict. On success it carries a `request_id` that can be
            passed to `check_status()` / `wait_for_completion()`.

        Raises:
            PublishError: if publishing is not configured or the file is missing
        """
        if not self.is_configured():
            raise PublishError(
                "Publishing is not configured. Set publish.enabled, publish.api_key "
                "and publish.user in config.yaml (see https://upload-post.com)."
            )

        if not os.path.exists(video_path):
            raise PublishError(f"Video file not found: {video_path}")

        targets = [p.strip().lower() for p in (platforms or self.platforms) if p and p.strip()]
        if not targets:
            raise PublishError("No target platforms configured for publishing")

        unknown = [p for p in targets if p not in SUPPORTED_PLATFORMS]
        if unknown:
            raise PublishError(
                f"Unsupported platform(s): {', '.join(unknown)}. "
                f"Supported: {', '.join(SUPPORTED_PLATFORMS)}"
            )

        title = (title or "").strip()
        if not title and any(p in TITLE_REQUIRED_PLATFORMS for p in targets):
            raise PublishError(
                f"A title is required when publishing to {', '.join(TITLE_REQUIRED_PLATFORMS)}"
            )

        # httpx encodes repeated multipart fields from a dict with list values;
        # a list of tuples would be treated as a raw body and silently drop the form.
        data = {
            "user": self.user,
            "title": title[:2200],
            "platform[]": targets,
        }

        if description:
            data["description"] = description
        if scheduled_date:
            data["scheduled_date"] = scheduled_date
            if timezone:
                data["timezone"] = timezone
        if async_upload:
            data["async_upload"] = "true"

        for key, value in (extra_params or {}).items():
            if value is None:
                continue
            if isinstance(value, bool):
                value = "true" if value else "false"
            data[key] = value if isinstance(value, (list, tuple)) else str(value)

        logger.info(f"📤 Publishing video to {', '.join(targets)} via Upload-Post...")

        try:
            with open(video_path, "rb") as video_file:
                files = {"video": (os.path.basename(video_path), video_file, "video/mp4")}
                async with httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0)) as client:
                    response = await client.post(
                        f"{self.API_BASE}/api/upload",
                        headers=self._headers(),
                        data=data,
                        files=files,
                    )
        except httpx.HTTPError as e:
            logger.error(f"Publish request failed: {e}")
            raise PublishError(f"Publish request failed: {e}") from e

        result = self._parse(response)

        if result.get("success") is False:
            logger.warning(f"Publish failed: {result.get('message') or result.get('error')}")
        else:
            request_id = result.get("request_id")
            if scheduled_date:
                logger.info(f"🗓️  Scheduled for {scheduled_date} (request_id={request_id})")
            else:
                logger.info(f"✅ Video accepted for publishing (request_id={request_id})")

        return result

    async def check_status(self, request_id: str) -> dict:
        """
        Check the status of a previous upload

        Args:
            request_id: Identifier returned by `upload_video()`

        Returns:
            Status dict with per-platform results
        """
        if not self.is_configured():
            raise PublishError("Publishing is not configured")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.API_BASE}/api/uploadposts/status",
                    headers=self._headers(),
                    params={"request_id": request_id},
                )
        except httpx.HTTPError as e:
            logger.error(f"Status check failed: {e}")
            raise PublishError(f"Status check failed: {e}") from e

        return self._parse(response)

    async def wait_for_completion(
        self,
        request_id: str,
        timeout: float = 900.0,
        poll_interval: float = 10.0,
    ) -> dict:
        """
        Poll `check_status()` until the upload reaches a terminal state

        Args:
            request_id: Identifier returned by `upload_video()`
            timeout: Maximum seconds to wait
            poll_interval: Seconds between polls

        Returns:
            The final status dict (also returned as-is if the timeout is hit)
        """
        deadline = asyncio.get_event_loop().time() + timeout
        status = {}

        while asyncio.get_event_loop().time() < deadline:
            status = await self.check_status(request_id)
            state = str(status.get("status", "")).lower()
            if state in ("completed", "finished", "success", "failed", "error", "scheduled"):
                logger.info(f"Publish {request_id} finished with status: {state}")
                return status
            await asyncio.sleep(poll_interval)

        logger.warning(f"Timed out waiting for publish {request_id} after {timeout}s")
        return status

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse(response: httpx.Response) -> dict:
        """Parse an API response, keeping error bodies readable"""
        try:
            payload = response.json()
        except ValueError:
            payload = {"success": False, "message": response.text[:500]}

        if response.status_code >= 400 and isinstance(payload, dict):
            payload.setdefault("success", False)
            payload.setdefault("status_code", response.status_code)

        return payload

    async def __call__(self, video_path: str, title: str, **kwargs) -> dict:
        """Allow `await pixelle_video.publish(video_path=..., title=...)`"""
        return await self.upload_video(video_path=video_path, title=title, **kwargs)
