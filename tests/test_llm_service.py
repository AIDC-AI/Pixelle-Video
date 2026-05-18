#!/usr/bin/env python3
"""
Unit tests for LLM Service

Tests config validation, API style selection, and response parsing.
"""
import pytest
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def load_llm_service_with_mock_config(api_style="chat_completions", model="test-model", 
                                       azure_deployment="gpt-55", azure_endpoint="https://test.openai.azure.com",
                                       base_url="https://api.openai.com/v1"):
    """Helper to load LLMService with mocked config_manager"""
    import importlib.util
    import types
    
    # Mock config_manager
    mock_config = types.ModuleType('pixelle_video.config')
    mock_manager = types.SimpleNamespace()
    mock_llm = types.SimpleNamespace(
        api_style=api_style,
        model=model,
        azure_deployment=azure_deployment,
        azure_endpoint=azure_endpoint,
        base_url=base_url,
        api_key="test-key",
        azure_api_key="azure-key",
        azure_api_version="2025-03-01-preview"
    )
    mock_manager.config = types.SimpleNamespace(llm=mock_llm)
    mock_config.config_manager = mock_manager
    sys.modules['pixelle_video.config'] = mock_config
    
    spec = importlib.util.spec_from_file_location(
        "llm_service", 
        project_root / "pixelle_video/services/llm_service.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.LLMService


class TestLLMServiceApiStyle:
    """Tests for LLM API style selection"""
    
    def test_api_style_chat_completions(self):
        """API style should return chat_completions when configured"""
        LLMService = load_llm_service_with_mock_config(api_style="chat_completions")
        
        service = LLMService({})
        
        assert service.api_style == "chat_completions"
    
    def test_api_style_azure_responses(self):
        """API style should return azure_responses when configured"""
        LLMService = load_llm_service_with_mock_config(api_style="azure_responses")
        
        service = LLMService({})
        
        assert service.api_style == "azure_responses"


class TestLLMServiceActive:
    """Tests for active model property"""
    
    def test_active_model_chat_completions(self):
        """Active model should return model for chat_completions"""
        LLMService = load_llm_service_with_mock_config(
            api_style="chat_completions",
            model="gpt-4o"
        )
        
        service = LLMService({})
        
        assert service.active == "gpt-4o"
    
    def test_active_model_azure_responses(self):
        """Active model should return azure_deployment for azure_responses"""
        LLMService = load_llm_service_with_mock_config(
            api_style="azure_responses",
            azure_deployment="gpt-55",
            model="gpt-4o"  # Should be ignored
        )
        
        service = LLMService({})
        
        assert service.active == "gpt-55"


class TestLLMServiceJsonParsing:
    """Tests for JSON response parsing"""
    
    def test_parse_direct_json(self):
        """Should parse direct JSON response"""
        from pydantic import BaseModel
        
        LLMService = load_llm_service_with_mock_config()
        
        class TestModel(BaseModel):
            name: str
            value: int
        
        service = LLMService({})
        content = '{"name": "test", "value": 42}'
        
        result = service._parse_response_as_model(content, TestModel)
        
        assert result.name == "test"
        assert result.value == 42
    
    def test_parse_json_in_markdown_block(self):
        """Should parse JSON from markdown code block"""
        from pydantic import BaseModel
        
        LLMService = load_llm_service_with_mock_config()
        
        class TestModel(BaseModel):
            name: str
            value: int
        
        service = LLMService({})
        content = '''Here is the result:
```json
{"name": "test", "value": 42}
```
'''
        
        result = service._parse_response_as_model(content, TestModel)
        
        assert result.name == "test"
        assert result.value == 42
    
    def test_parse_json_embedded_in_text(self):
        """Should extract JSON from surrounding text"""
        from pydantic import BaseModel
        
        LLMService = load_llm_service_with_mock_config()
        
        class TestModel(BaseModel):
            name: str
            value: int
        
        service = LLMService({})
        content = 'Here is the output: {"name": "test", "value": 42} as requested.'
        
        result = service._parse_response_as_model(content, TestModel)
        
        assert result.name == "test"
        assert result.value == 42
    
    def test_parse_invalid_json_raises(self):
        """Should raise ValueError for unparseable content"""
        from pydantic import BaseModel
        
        LLMService = load_llm_service_with_mock_config()
        
        class TestModel(BaseModel):
            name: str
            value: int
        
        service = LLMService({})
        content = 'This is not JSON at all'
        
        with pytest.raises(ValueError) as exc_info:
            service._parse_response_as_model(content, TestModel)
        
        assert "Failed to parse" in str(exc_info.value)


class TestLLMServiceRepr:
    """Tests for LLM Service string representation"""
    
    def test_repr_chat_completions(self):
        """repr should show chat_completions info"""
        LLMService = load_llm_service_with_mock_config(
            api_style="chat_completions",
            model="gpt-4o",
            base_url="https://api.openai.com/v1"
        )
        
        service = LLMService({})
        repr_str = repr(service)
        
        assert "chat_completions" in repr_str
        assert "gpt-4o" in repr_str
    
    def test_repr_azure_responses(self):
        """repr should show azure_responses info"""
        LLMService = load_llm_service_with_mock_config(
            api_style="azure_responses",
            azure_deployment="gpt-55",
            azure_endpoint="https://test.openai.azure.com"
        )
        
        service = LLMService({})
        repr_str = repr(service)
        
        assert "azure_responses" in repr_str
        assert "gpt-55" in repr_str


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
