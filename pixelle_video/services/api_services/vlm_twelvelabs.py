# -*- coding: utf-8 -*-
"""
TwelveLabs Pegasus video-understanding API client.

Pegasus is a video-native model: it reasons over the full clip (motion, scene
changes, on-screen action) rather than a handful of sampled frames, which makes
it a strong fit for analysing uploaded footage before script/storyboard
generation in Pixelle-Video.

Notes / gotchas (verified against the official `twelvelabs` SDK, >=1.2.8):
- Pegasus does NOT accept a bare ``video_id`` here; it needs a public URL
  (``VideoContext_Url``) or an uploaded asset (``VideoContext_AssetId``).
- Local files are uploaded as a TwelveLabs asset first via
  ``assets.create(method="direct", ...)``. Direct upload is capped at 200MB;
  larger footage should be passed as a public URL (up to 4GB).
- The analysed window must be at least 4 seconds long.

Docs: https://docs.twelvelabs.io
"""

import os
import time
from typing import List, Optional

try:
    from twelvelabs import TwelveLabs
    from twelvelabs.types import VideoContext_AssetId, VideoContext_Url
except ImportError:  # pragma: no cover - exercised only when SDK is absent
    TwelveLabs = None
    VideoContext_Url = None
    VideoContext_AssetId = None

# Direct asset upload limit (bytes). Above this, callers must use a public URL.
DIRECT_UPLOAD_MAX_BYTES = 200 * 1024 * 1024

# Poll budget for an uploaded asset to become ready before analysis.
_ASSET_READY_TIMEOUT_SEC = 120
_ASSET_POLL_INTERVAL_SEC = 3

# Pegasus requires max_tokens >= 512.
_MIN_MAX_TOKENS = 512


class PegasusClient:
    """TwelveLabs Pegasus client for video-only asset analysis."""

    def __init__(self, api_key: Optional[str] = None):
        """
        :param api_key: TwelveLabs API key. Falls back to TWELVELABS_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("TWELVELABS_API_KEY")

    def analyze_video(
        self,
        text: str,
        videos: List[str],
        model: str,
        max_tokens: int = 2048,
        temperature: Optional[float] = None,
    ) -> str:
        """
        Analyze a single video with Pegasus and return the generated text.

        :param text: Analysis prompt.
        :param videos: List with exactly one video path or URL.
        :param model: Pegasus model name (e.g. ``pegasus1.5``).
        :param max_tokens: Max output tokens.
        :param temperature: Optional sampling temperature.
        :return: Generated text description.
        """
        if TwelveLabs is None:
            raise RuntimeError(
                "twelvelabs package not installed. Run: pip install twelvelabs"
            )
        if not self.api_key:
            raise RuntimeError("TwelveLabs API key is not configured.")
        if not videos:
            raise ValueError("Pegasus analysis requires a video path or URL.")
        if len(videos) > 1:
            raise ValueError("Pegasus analyzes one video at a time.")

        source = videos[0]
        client = TwelveLabs(api_key=self.api_key)

        try:
            video_context = self._build_video_context(client, source)
            kwargs = {"max_tokens": max(max_tokens, _MIN_MAX_TOKENS)}
            if temperature is not None:
                kwargs["temperature"] = temperature
            response = client.analyze(
                model_name=model,
                video=video_context,
                prompt=text,
                **kwargs,
            )
        except Exception as e:
            raise RuntimeError(f"TwelveLabs Pegasus error: {e}")

        return str(getattr(response, "data", "") or "").strip()

    def _build_video_context(self, client: "TwelveLabs", source: str):
        """Build a Pegasus video context from a URL or a local file."""
        if source.startswith("http://") or source.startswith("https://"):
            return VideoContext_Url(url=source)

        # Local file: must be uploaded as an asset (no bare video_id support).
        size = os.path.getsize(source)
        if size > DIRECT_UPLOAD_MAX_BYTES:
            raise ValueError(
                f"Video {os.path.basename(source)} is {size / 1024 / 1024:.0f}MB, "
                f"over the {DIRECT_UPLOAD_MAX_BYTES // 1024 // 1024}MB direct-upload "
                "limit. Provide a public URL for larger footage."
            )

        with open(source, "rb") as fh:
            asset = client.assets.create(method="direct", file=fh)

        asset_id = self._wait_for_asset(client, asset)
        return VideoContext_AssetId(asset_id=asset_id)

    def _wait_for_asset(self, client: "TwelveLabs", asset) -> str:
        """Poll an uploaded asset until it is ready for analysis."""
        asset_id = asset.id
        status = (asset.status or "").lower()
        deadline = time.time() + _ASSET_READY_TIMEOUT_SEC
        while status not in ("ready", "completed", "") and time.time() < deadline:
            if status in ("failed", "error"):
                raise RuntimeError(f"TwelveLabs asset upload failed: {asset_id}")
            time.sleep(_ASSET_POLL_INTERVAL_SEC)
            asset = client.assets.retrieve(asset_id)
            status = (asset.status or "").lower()
        return asset_id
