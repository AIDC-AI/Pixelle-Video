#!/usr/bin/env python3
"""
Unit tests for Azure Image Service adapter

Tests config validation and mock responses without actual API calls.
Note: Uses isolated imports to avoid loading full pixelle_video package.
"""
import pytest
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def load_azure_image_service():
    """Helper to load AzureImageService with mocked dependencies"""
    import importlib.util
    import types
    
    # Mock the models.media import
    mock_models = types.ModuleType('pixelle_video.models')
    mock_media = types.ModuleType('pixelle_video.models.media')
    mock_media.MediaResult = type('MediaResult', (), {'__init__': lambda self, **kw: None})
    sys.modules['pixelle_video.models'] = mock_models
    sys.modules['pixelle_video.models.media'] = mock_media
    
    spec = importlib.util.spec_from_file_location(
        "azure_image_service", 
        project_root / "pixelle_video/services/azure_image_service.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.AzureImageService


class TestAzureImageServiceConfig:
    """Tests for Azure Image Service configuration"""
    
    def test_service_not_configured_when_empty(self):
        """Service should report not configured when config is empty"""
        AzureImageService = load_azure_image_service()
        
        empty_config = {}
        service = AzureImageService(empty_config)
        
        assert service.is_configured() is False
    
    def test_service_not_configured_missing_endpoint(self):
        """Service should report not configured when endpoint is missing"""
        AzureImageService = load_azure_image_service()
        
        config = {
            "azure_openai": {
                "image": {
                    "api_key": "test-key",
                    "deployment": "gpt-image-1",
                }
            }
        }
        service = AzureImageService(config)
        
        assert service.is_configured() is False
    
    def test_service_not_configured_missing_api_key(self):
        """Service should report not configured when api_key is missing"""
        AzureImageService = load_azure_image_service()
        
        config = {
            "azure_openai": {
                "image": {
                    "endpoint": "https://test.openai.azure.com",
                    "deployment": "gpt-image-1",
                }
            }
        }
        service = AzureImageService(config)
        
        assert service.is_configured() is False
    
    def test_service_configured_with_all_required(self):
        """Service should report configured when all required fields present"""
        AzureImageService = load_azure_image_service()
        
        config = {
            "azure_openai": {
                "image": {
                    "endpoint": "https://test.openai.azure.com",
                    "api_key": "test-key",
                    "deployment": "gpt-image-1",
                }
            }
        }
        service = AzureImageService(config)
        
        assert service.is_configured() is True
    
    def test_service_uses_defaults(self):
        """Service should use default values for optional fields"""
        AzureImageService = load_azure_image_service()
        
        config = {
            "azure_openai": {
                "image": {
                    "endpoint": "https://test.openai.azure.com",
                    "api_key": "test-key",
                    "deployment": "gpt-image-1",
                }
            }
        }
        service = AzureImageService(config)
        
        assert service.default_size == "1024x1024"
        assert service.default_quality == "auto"
        assert service.output_format == "png"
        assert service.api_version == "2025-04-01-preview"
    
    def test_service_custom_values(self):
        """Service should use custom values when provided"""
        AzureImageService = load_azure_image_service()
        
        config = {
            "azure_openai": {
                "image": {
                    "endpoint": "https://custom.openai.azure.com",
                    "api_key": "custom-key",
                    "deployment": "dall-e-3",
                    "api_version": "2025-05-01",
                    "default_size": "1024x1536",
                    "default_quality": "high",
                    "output_format": "jpeg",
                    "output_dir": "output/custom",
                }
            }
        }
        service = AzureImageService(config)
        
        assert service.endpoint == "https://custom.openai.azure.com"
        assert service.deployment == "dall-e-3"
        assert service.api_version == "2025-05-01"
        assert service.default_size == "1024x1536"
        assert service.default_quality == "high"
        assert service.output_format == "jpeg"
        assert service.output_dir == "output/custom"
    
    def test_supported_sizes_gpt_image_1(self):
        """GPT-image-1 should have correct supported sizes"""
        AzureImageService = load_azure_image_service()
        
        expected_sizes = ["1024x1024", "1024x1536", "1536x1024"]
        assert AzureImageService.SUPPORTED_SIZES.get("gpt-image-1") == expected_sizes
    
    def test_supported_sizes_dalle_3(self):
        """DALL-E 3 should have correct supported sizes"""
        AzureImageService = load_azure_image_service()
        
        expected_sizes = ["1024x1024", "1024x1792", "1792x1024"]
        assert AzureImageService.SUPPORTED_SIZES.get("dall-e-3") == expected_sizes


class TestAzureImageServiceRepr:
    """Tests for Azure Image Service string representation"""
    
    def test_repr_configured(self):
        """repr should show configured status"""
        AzureImageService = load_azure_image_service()
        
        config = {
            "azure_openai": {
                "image": {
                    "endpoint": "https://test.openai.azure.com",
                    "api_key": "test-key",
                    "deployment": "gpt-image-1",
                }
            }
        }
        service = AzureImageService(config)
        
        assert "configured" in repr(service)
        assert "gpt-image-1" in repr(service)
    
    def test_repr_not_configured(self):
        """repr should show not configured status"""
        AzureImageService = load_azure_image_service()
        
        service = AzureImageService({})
        
        assert "not configured" in repr(service)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


class TestAzureImageServiceRetry:
    """Tests for Azure Image Service retry behavior on 429/EngineOverloaded"""

    def test_retry_config_defaults(self):
        """Service should have correct default retry config"""
        AzureImageService = load_azure_image_service()
        
        config = {
            "azure_openai": {
                "image": {
                    "endpoint": "https://test.openai.azure.com",
                    "api_key": "test-key",
                    "deployment": "gpt-image-1",
                }
            }
        }
        service = AzureImageService(config)
        
        assert service.max_retry_attempts == 7
        assert service.retry_initial_seconds == 30.0
        assert service.retry_max_seconds == 300.0

    def test_retry_config_custom_values(self):
        """Service should use custom retry config when provided"""
        AzureImageService = load_azure_image_service()
        
        config = {
            "azure_openai": {
                "image": {
                    "endpoint": "https://test.openai.azure.com",
                    "api_key": "test-key",
                    "deployment": "gpt-image-1",
                    "max_retry_attempts": 5,
                    "retry_initial_seconds": 15.0,
                    "retry_max_seconds": 120.0,
                }
            }
        }
        service = AzureImageService(config)
        
        assert service.max_retry_attempts == 5
        assert service.retry_initial_seconds == 15.0
        assert service.retry_max_seconds == 120.0

    def test_is_retryable_429_status_code(self):
        """429 status code should be retryable"""
        AzureImageService = load_azure_image_service()
        service = AzureImageService({})
        
        class MockException(Exception):
            status_code = 429
        
        assert service._is_retryable_provider_error(MockException("rate limited")) is True

    def test_is_retryable_engine_overloaded_message(self):
        """EngineOverloaded in message should be retryable"""
        AzureImageService = load_azure_image_service()
        service = AzureImageService({})
        
        exc = Exception("Error code: 429 - EngineOverloaded")
        assert service._is_retryable_provider_error(exc) is True

    def test_is_retryable_too_many_requests(self):
        """'too many requests' in message should be retryable"""
        AzureImageService = load_azure_image_service()
        service = AzureImageService({})
        
        exc = Exception("Too Many Requests")
        assert service._is_retryable_provider_error(exc) is True

    def test_is_retryable_rate_limit(self):
        """'rate limit' in message should be retryable"""
        AzureImageService = load_azure_image_service()
        service = AzureImageService({})
        
        exc = Exception("Rate limit exceeded")
        assert service._is_retryable_provider_error(exc) is True

    def test_is_not_retryable_other_error(self):
        """Other errors should not be retryable"""
        AzureImageService = load_azure_image_service()
        service = AzureImageService({})
        
        exc = Exception("Invalid API key")
        assert service._is_retryable_provider_error(exc) is False

    def test_is_not_retryable_400_error(self):
        """400 status code should not be retryable"""
        AzureImageService = load_azure_image_service()
        service = AzureImageService({})
        
        class MockException(Exception):
            status_code = 400
        
        assert service._is_retryable_provider_error(MockException("bad request")) is False

    def test_retry_after_extracts_header(self):
        """Should extract Retry-After header when present"""
        AzureImageService = load_azure_image_service()
        service = AzureImageService({})
        
        class MockResponse:
            headers = {"Retry-After": "60"}
        
        class MockException(Exception):
            response = MockResponse()
        
        assert service._retry_after_seconds(MockException("rate limited")) == 60.0

    def test_retry_after_returns_none_when_missing(self):
        """Should return None when Retry-After header is missing"""
        AzureImageService = load_azure_image_service()
        service = AzureImageService({})
        
        exc = Exception("no retry-after")
        assert service._retry_after_seconds(exc) is None

    def test_retry_after_handles_invalid_value(self):
        """Should return None for invalid Retry-After value"""
        AzureImageService = load_azure_image_service()
        service = AzureImageService({})
        
        class MockResponse:
            headers = {"Retry-After": "not-a-number"}
        
        class MockException(Exception):
            response = MockResponse()
        
        assert service._retry_after_seconds(MockException("rate limited")) is None
