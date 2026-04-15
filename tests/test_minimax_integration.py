# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
Integration tests for MiniMax LLM provider.

These tests call the live MiniMax API and require MINIMAX_API_KEY to be set.
Skip automatically when the key is not available.
"""

import os
import sys
import types

# Stub out heavy dependencies
for mod_name in (
    "comfykit",
    "edge_tts",
    "edge_tts.exceptions",
    "moviepy",
    "moviepy.editor",
    "html2image",
    "streamlit",
    "fastapi",
    "uvicorn",
    "beautifulsoup4",
    "bs4",
    "ffmpeg",
    "PIL",
    "PIL.Image",
    "fastmcp",
    "certifi",
):
    if mod_name not in sys.modules:
        sys.modules[mod_name] = types.ModuleType(mod_name)

sys.modules["comfykit"].ComfyKit = type("ComfyKit", (), {})
_edge_tts_exc = types.ModuleType("edge_tts.exceptions")
_edge_tts_exc.NoAudioReceived = type("NoAudioReceived", (Exception,), {})
sys.modules["edge_tts.exceptions"] = _edge_tts_exc
sys.modules["edge_tts"].exceptions = _edge_tts_exc
sys.modules["edge_tts"].NoAudioReceived = _edge_tts_exc.NoAudioReceived
sys.modules["edge_tts"].Communicate = type("Communicate", (), {})

import pytest

from pixelle_video.services.llm_service import LLMService

MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "")
MINIMAX_BASE_URL = "https://api.minimax.io/v1"
MINIMAX_MODEL = "MiniMax-M2.7"

skip_no_key = pytest.mark.skipif(
    not MINIMAX_API_KEY,
    reason="MINIMAX_API_KEY not set, skipping live integration tests",
)


@skip_no_key
class TestMiniMaxIntegration:
    """Live integration tests against MiniMax API."""

    @pytest.mark.asyncio
    async def test_llm_call_basic(self):
        """Test a basic LLM call via MiniMax API."""
        service = LLMService(config={})
        result = await service(
            prompt="Say hello in one sentence.",
            api_key=MINIMAX_API_KEY,
            base_url=MINIMAX_BASE_URL,
            model=MINIMAX_MODEL,
            temperature=0.7,
            max_tokens=100,
        )
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_llm_call_with_temperature_clamping(self):
        """Test LLM call with temperature=0 (should be clamped to 0.01)."""
        service = LLMService(config={})
        result = await service(
            prompt="What is 2+2? Answer with just the number.",
            api_key=MINIMAX_API_KEY,
            base_url=MINIMAX_BASE_URL,
            model=MINIMAX_MODEL,
            temperature=0.0,  # Will be clamped to 0.01
            max_tokens=50,
        )
        assert isinstance(result, str)
        assert "4" in result

    @pytest.mark.asyncio
    async def test_llm_call_structured_output(self):
        """Test structured output with MiniMax."""
        from pydantic import BaseModel

        class SimpleAnswer(BaseModel):
            answer: str

        service = LLMService(config={})
        result = await service(
            prompt="What is the capital of France?",
            api_key=MINIMAX_API_KEY,
            base_url=MINIMAX_BASE_URL,
            model=MINIMAX_MODEL,
            temperature=0.5,
            max_tokens=200,
            response_type=SimpleAnswer,
        )
        assert isinstance(result, SimpleAnswer)
        assert len(result.answer) > 0
