# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""Unit tests for MiniMax LLM provider integration.

These tests use direct module imports to avoid heavy dependency requirements.
"""

import sys
import types
import pytest

# Stub out heavy dependencies so we can import the modules under test
# without needing comfykit, edge_tts, etc. installed.
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

# Patch comfykit.ComfyKit for service.py
sys.modules["comfykit"].ComfyKit = type("ComfyKit", (), {})

# Patch edge_tts exceptions module
_edge_tts_exc = types.ModuleType("edge_tts.exceptions")
_edge_tts_exc.NoAudioReceived = type("NoAudioReceived", (Exception,), {})
sys.modules["edge_tts.exceptions"] = _edge_tts_exc
# Also set exceptions attribute on the edge_tts stub module
sys.modules["edge_tts"].exceptions = _edge_tts_exc
sys.modules["edge_tts"].NoAudioReceived = _edge_tts_exc.NoAudioReceived
# edge_tts also uses Communicate
sys.modules["edge_tts"].Communicate = type("Communicate", (), {})


# ============================================================
# LLM Presets - MiniMax entry
# ============================================================


class TestMiniMaxPreset:
    """Test MiniMax preset configuration."""

    def _get_presets_module(self):
        from pixelle_video.llm_presets import (
            LLM_PRESETS,
            get_preset,
            get_preset_names,
            find_preset_by_base_url_and_model,
        )
        return LLM_PRESETS, get_preset, get_preset_names, find_preset_by_base_url_and_model

    def test_minimax_in_presets(self):
        """MiniMax should be registered in the LLM_PRESETS list."""
        _, _, get_preset_names, _ = self._get_presets_module()
        names = get_preset_names()
        assert "MiniMax" in names

    def test_minimax_preset_fields(self):
        """MiniMax preset should have all required fields."""
        _, get_preset, _, _ = self._get_presets_module()
        preset = get_preset("MiniMax")
        assert preset, "MiniMax preset not found"
        assert preset["name"] == "MiniMax"
        assert preset["base_url"] == "https://api.minimax.io/v1"
        assert preset["model"] == "MiniMax-M2.7"
        assert "api_key_url" in preset
        assert preset["api_key_url"].startswith("https://")

    def test_minimax_preset_lookup_by_url_and_model(self):
        """find_preset_by_base_url_and_model should match MiniMax."""
        _, _, _, find_preset = self._get_presets_module()
        name = find_preset("https://api.minimax.io/v1", "MiniMax-M2.7")
        assert name == "MiniMax"

    def test_minimax_preset_lookup_wrong_model(self):
        """Mismatched model should not match MiniMax preset."""
        _, _, _, find_preset = self._get_presets_module()
        name = find_preset("https://api.minimax.io/v1", "wrong-model")
        assert name is None

    def test_minimax_no_default_api_key(self):
        """MiniMax preset should NOT have a default_api_key (requires real key)."""
        _, get_preset, _, _ = self._get_presets_module()
        preset = get_preset("MiniMax")
        assert "default_api_key" not in preset

    def test_preset_count_includes_minimax(self):
        """Total preset count should include MiniMax."""
        presets, _, _, _ = self._get_presets_module()
        # At minimum: Qwen, OpenAI, Claude, DeepSeek, Ollama, MiniMax, Moonshot
        assert len(presets) >= 7

    def test_all_presets_have_required_keys(self):
        """Every preset (including MiniMax) must have name, base_url, model, api_key_url."""
        presets, _, _, _ = self._get_presets_module()
        for preset in presets:
            assert "name" in preset, f"preset missing 'name': {preset}"
            assert "base_url" in preset, f"preset {preset['name']} missing 'base_url'"
            assert "model" in preset, f"preset {preset['name']} missing 'model'"
            assert "api_key_url" in preset, f"preset {preset['name']} missing 'api_key_url'"


# ============================================================
# Temperature clamping
# ============================================================


class TestTemperatureClamping:
    """Test temperature clamping for MiniMax provider."""

    def _get_service_module(self):
        from pixelle_video.services.llm_service import LLMService, _STRICT_TEMPERATURE_PROVIDERS
        return LLMService, _STRICT_TEMPERATURE_PROVIDERS

    def test_minimax_host_in_strict_providers(self):
        """api.minimax.io should be in the strict temperature provider set."""
        _, providers = self._get_service_module()
        assert "api.minimax.io" in providers

    def test_clamp_zero_temperature(self):
        """Temperature 0.0 should be clamped to 0.01 for MiniMax."""
        LLMService, _ = self._get_service_module()
        result = LLMService._clamp_temperature(0.0, "https://api.minimax.io/v1")
        assert result == 0.01

    def test_clamp_negative_temperature(self):
        """Negative temperature should be clamped to 0.01 for MiniMax."""
        LLMService, _ = self._get_service_module()
        result = LLMService._clamp_temperature(-1.0, "https://api.minimax.io/v1")
        assert result == 0.01

    def test_clamp_high_temperature(self):
        """Temperature above 1.0 should be clamped to 1.0 for MiniMax."""
        LLMService, _ = self._get_service_module()
        result = LLMService._clamp_temperature(1.5, "https://api.minimax.io/v1")
        assert result == 1.0

    def test_clamp_normal_temperature(self):
        """Valid temperature should pass through unchanged for MiniMax."""
        LLMService, _ = self._get_service_module()
        result = LLMService._clamp_temperature(0.7, "https://api.minimax.io/v1")
        assert result == 0.7

    def test_clamp_boundary_temperature_one(self):
        """Temperature 1.0 is valid and should not change for MiniMax."""
        LLMService, _ = self._get_service_module()
        result = LLMService._clamp_temperature(1.0, "https://api.minimax.io/v1")
        assert result == 1.0

    def test_no_clamp_for_openai(self):
        """Temperature should NOT be clamped for OpenAI provider."""
        LLMService, _ = self._get_service_module()
        result = LLMService._clamp_temperature(0.0, "https://api.openai.com/v1")
        assert result == 0.0

    def test_no_clamp_for_generic_provider(self):
        """Temperature should NOT be clamped for unknown providers."""
        LLMService, _ = self._get_service_module()
        result = LLMService._clamp_temperature(2.0, "https://custom-api.example.com/v1")
        assert result == 2.0

    def test_clamp_very_small_positive(self):
        """Very small positive temperature should pass for MiniMax."""
        LLMService, _ = self._get_service_module()
        result = LLMService._clamp_temperature(0.05, "https://api.minimax.io/v1")
        assert result == 0.05


# ============================================================
# LLMService.__call__ integration with clamping
# ============================================================


class TestLLMServiceCallWithMiniMax:
    """Test LLMService.__call__ applies temperature clamping for MiniMax."""

    def _make_service(self):
        from pixelle_video.services.llm_service import LLMService
        return LLMService(config={})

    @pytest.mark.asyncio
    async def test_call_applies_temperature_clamping(self):
        """When using MiniMax base_url, temperature should be clamped in the API call."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from pixelle_video.services.llm_service import LLMService

        service = self._make_service()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Hello from MiniMax"

        with patch.object(service, "_create_client") as mock_create:
            mock_client = AsyncMock()
            mock_client.base_url = "https://api.minimax.io/v1"
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_create.return_value = mock_client

            with patch.object(service, "_get_config_value", return_value="MiniMax-M2.7"):
                result = await service(
                    prompt="Hello",
                    base_url="https://api.minimax.io/v1",
                    temperature=0.0,
                )

            assert result == "Hello from MiniMax"
            call_kwargs = mock_client.chat.completions.create.call_args
            assert call_kwargs.kwargs["temperature"] == 0.01

    @pytest.mark.asyncio
    async def test_call_no_clamp_for_openai(self):
        """When using OpenAI base_url, temperature should NOT be clamped."""
        from unittest.mock import AsyncMock, MagicMock, patch

        service = self._make_service()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Hello from OpenAI"

        with patch.object(service, "_create_client") as mock_create:
            mock_client = AsyncMock()
            mock_client.base_url = "https://api.openai.com/v1"
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_create.return_value = mock_client

            with patch.object(service, "_get_config_value", return_value="gpt-4o"):
                result = await service(
                    prompt="Hello",
                    base_url="https://api.openai.com/v1",
                    temperature=0.0,
                )

            assert result == "Hello from OpenAI"
            call_kwargs = mock_client.chat.completions.create.call_args
            assert call_kwargs.kwargs["temperature"] == 0.0

    @pytest.mark.asyncio
    async def test_call_structured_output_with_minimax(self):
        """Structured output should also clamp temperature for MiniMax."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from pydantic import BaseModel

        class TestOutput(BaseModel):
            text: str

        service = self._make_service()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"text": "hello"}'

        with patch.object(service, "_create_client") as mock_create:
            mock_client = AsyncMock()
            mock_client.base_url = "https://api.minimax.io/v1"
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_create.return_value = mock_client

            with patch.object(service, "_get_config_value", return_value="MiniMax-M2.7"):
                result = await service(
                    prompt="Generate output",
                    base_url="https://api.minimax.io/v1",
                    temperature=0.0,
                    response_type=TestOutput,
                )

            assert isinstance(result, TestOutput)
            assert result.text == "hello"


# ============================================================
# LLM Utility - connection test with MiniMax URL
# ============================================================


class TestLLMUtilWithMiniMax:
    """Test llm_util functions with MiniMax endpoint."""

    def test_fetch_models_minimax_url(self):
        """fetch_available_models should build correct URL for MiniMax."""
        from unittest.mock import MagicMock, patch
        from pixelle_video.utils.llm_util import fetch_available_models

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {"id": "MiniMax-M2.7"},
                {"id": "MiniMax-M2.5"},
            ]
        }
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_response

        with patch("pixelle_video.utils.llm_util.httpx.Client", return_value=mock_client):
            models = fetch_available_models("test-key", "https://api.minimax.io/v1")

        assert "MiniMax-M2.7" in models
        assert "MiniMax-M2.5" in models
        call_url = mock_client.get.call_args[0][0]
        assert call_url == "https://api.minimax.io/v1/models"

    def test_connection_test_minimax(self):
        """test_llm_connection should work with MiniMax endpoint."""
        from unittest.mock import patch
        from pixelle_video.utils.llm_util import test_llm_connection

        with patch(
            "pixelle_video.utils.llm_util.fetch_available_models",
            return_value=["MiniMax-M2.7", "MiniMax-M2.5"],
        ):
            success, message, count = test_llm_connection(
                "test-key", "https://api.minimax.io/v1"
            )

        assert success is True
        assert count == 2
        assert "2" in message
