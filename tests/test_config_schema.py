#!/usr/bin/env python3
"""
Unit tests for Config Schema

Tests config validation directly without loading full package.
"""
import pytest
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class TestLLMConfig:
    """Tests for LLMConfig schema"""
    
    def test_llm_config_defaults(self):
        """LLM config should have correct defaults"""
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "schema", 
            project_root / "pixelle_video/config/schema.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        LLMConfig = module.LLMConfig
        
        config = LLMConfig()
        
        assert config.api_style == "chat_completions"
        assert config.api_key == ""
        assert config.base_url == ""
        assert config.model == ""
        assert config.azure_endpoint == ""
        assert config.azure_api_key == ""
        assert config.azure_deployment == ""
        assert config.azure_api_version == "2025-03-01-preview"
    
    def test_llm_config_chat_completions(self):
        """LLM config should accept chat_completions values"""
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "schema", 
            project_root / "pixelle_video/config/schema.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        LLMConfig = module.LLMConfig
        
        config = LLMConfig(
            api_key="test-key",
            base_url="https://api.openai.com/v1",
            model="gpt-4o",
            api_style="chat_completions"
        )
        
        assert config.api_style == "chat_completions"
        assert config.api_key == "test-key"
    
    def test_llm_config_azure_responses(self):
        """LLM config should accept azure_responses values"""
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "schema", 
            project_root / "pixelle_video/config/schema.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        LLMConfig = module.LLMConfig
        
        config = LLMConfig(
            api_style="azure_responses",
            azure_endpoint="https://test.openai.azure.com",
            azure_api_key="azure-key",
            azure_deployment="gpt-55",
            azure_api_version="2025-03-01-preview"
        )
        
        assert config.api_style == "azure_responses"
        assert config.azure_endpoint == "https://test.openai.azure.com"
        assert config.azure_deployment == "gpt-55"


class TestPixelleVideoConfigLLMValidation:
    """Tests for PixelleVideoConfig LLM validation"""
    
    def test_is_llm_configured_chat_completions_complete(self):
        """Should return True when chat_completions fully configured"""
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "schema", 
            project_root / "pixelle_video/config/schema.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        PixelleVideoConfig = module.PixelleVideoConfig
        LLMConfig = module.LLMConfig
        
        config = PixelleVideoConfig(
            llm=LLMConfig(
                api_style="chat_completions",
                api_key="test-key",
                base_url="https://api.openai.com/v1",
                model="gpt-4o"
            )
        )
        
        assert config.is_llm_configured() is True
    
    def test_is_llm_configured_chat_completions_missing_key(self):
        """Should return False when chat_completions missing api_key"""
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "schema", 
            project_root / "pixelle_video/config/schema.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        PixelleVideoConfig = module.PixelleVideoConfig
        LLMConfig = module.LLMConfig
        
        config = PixelleVideoConfig(
            llm=LLMConfig(
                api_style="chat_completions",
                base_url="https://api.openai.com/v1",
                model="gpt-4o"
            )
        )
        
        assert config.is_llm_configured() is False
    
    def test_is_llm_configured_azure_responses_complete(self):
        """Should return True when azure_responses fully configured"""
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "schema", 
            project_root / "pixelle_video/config/schema.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        PixelleVideoConfig = module.PixelleVideoConfig
        LLMConfig = module.LLMConfig
        
        config = PixelleVideoConfig(
            llm=LLMConfig(
                api_style="azure_responses",
                azure_endpoint="https://test.openai.azure.com",
                azure_api_key="azure-key",
                azure_deployment="gpt-55"
            )
        )
        
        assert config.is_llm_configured() is True
    
    def test_is_llm_configured_azure_responses_missing_endpoint(self):
        """Should return False when azure_responses missing endpoint"""
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "schema", 
            project_root / "pixelle_video/config/schema.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        PixelleVideoConfig = module.PixelleVideoConfig
        LLMConfig = module.LLMConfig
        
        config = PixelleVideoConfig(
            llm=LLMConfig(
                api_style="azure_responses",
                azure_api_key="azure-key",
                azure_deployment="gpt-55"
            )
        )
        
        assert config.is_llm_configured() is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
