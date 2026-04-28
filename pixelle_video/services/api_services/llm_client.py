import os
import logging

try:
    from .llm_gpt import GPT
    from .llm_gemini import Gemini
    from .llm_deepseek import DeepSeek
    from .llm_dashscope import QwenLLM
    from .vlm_dashscope import QwenVLClient
except ImportError:
    from llm_gpt import GPT
    from llm_gemini import Gemini
    from llm_deepseek import DeepSeek
    from llm_dashscope import QwenLLM
    from vlm_dashscope import QwenVLClient

from .config import Config

logger = logging.getLogger(__name__)

class LLM:
    def __init__(self, gemini_base_url="", gemini_api_key="", gpt_base_url="", gpt_api_key="", deepseek_base_url="", deepseek_api_key="", dashscope_api_key=""):
        self.gemini_base_url = gemini_base_url or Config.GOOGLE_GEMINI_BASE_URL or os.getenv("GOOGLE_GEMINI_BASE_URL", "")
        self.gemini_api_key = gemini_api_key or Config.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        self.gpt_base_url = gpt_base_url or Config.OPENAI_BASE_URL or os.getenv("OPENAI_BASE_URL", "")
        self.gpt_api_key = gpt_api_key or Config.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
        self.deepseek_base_url = deepseek_base_url or Config.DEEPSEEK_BASE_URL or os.getenv("DEEPSEEK_BASE_URL", "")
        self.deepseek_api_key = deepseek_api_key or Config.DEEPSEEK_API_KEY or os.getenv("DEEPSEEK_API_KEY", "")
        self.dashscope_api_key = dashscope_api_key or Config.DASHSCOPE_API_KEY or os.getenv("DASHSCOPE_API_KEY", "")

    def full_to_half(self, text):
        if not isinstance(text, str):
            return text
        
        translation_table = {0x3000: 0x0020}
        for i in range(65281, 65375):
            translation_table[i] = i - 65248
            
        return text.translate(translation_table)

    def query(self, prompt, image_urls=[], model="qwen3.6-max-preview", safe_content=True, task_id=None, web_search=False):
        """
        Query the LLM with a prompt and optional image URLs.
        Selects the backend (GPT or Gemini) based on the model name.

        :param web_search: Enable web search for supported providers
        """
        if safe_content:
            prompt = self.full_to_half(prompt)

        if not model:
            model = "qwen3.6-max-preview"
            
        if Config.PRINT_MODEL_INPUT:
            print("---- LLM QUERY REQUEST ----")
            print(f"Model: {model}")
            if task_id:
                print(f"Task ID: {task_id}")
            if image_urls:
                print(f"Images: {len(image_urls)}")
                for u in image_urls:
                    print(f"  - {u}")
            print(f"Prompt: {prompt[:200]}{'...' if len(prompt) > 200 else ''}")
            print("-" * 30)
            
        result = ""
        model_lower = model.lower()
        if model_lower.startswith("gemini"):
            client = Gemini(base_url=self.gemini_base_url, api_key=self.gemini_api_key)
            result = client.query(prompt, image_urls=image_urls, model=model)
        elif "gpt" in model_lower:
            # OpenAI series models
            client = GPT(
                base_url=self.gpt_base_url, 
                api_key=self.gpt_api_key, 
                local_proxy=Config.LOCAL_PROXY
            )
            result = client.query(prompt, image_urls=image_urls, model=model, web_search=web_search)
        elif "kimi" in model_lower or "qwen3.6-plus" in model_lower or "qwen3.6-flash" in model_lower:
            # DashScope VLM models (using MultiModalConversation API)
            dashscope_vl_client = QwenVLClient(api_key=self.dashscope_api_key)
            result = dashscope_vl_client.chat(text=prompt, images=[], model=model, stream=False)
        elif "deepseek-v3.2" in model_lower:
            # DeepSeek v3.2 (通过 DashScope Generation API)
            client = QwenLLM(api_key=self.dashscope_api_key)
            result = client.query(prompt, image_urls=image_urls, model=model, web_search=web_search)
        elif model_lower.startswith("deepseek") and "v3.2" not in model_lower:
            # Original DeepSeek provider
            client = DeepSeek(base_url=self.deepseek_base_url, api_key=self.deepseek_api_key)
            result = client.query(prompt, image_urls=image_urls, model=model, web_search=web_search)
        else:
            # Default to Qwen models / deepseek-v3.2 via DashScope Generation API
            client = QwenLLM(api_key=self.dashscope_api_key)
            result = client.query(prompt, image_urls=image_urls, model=model, web_search=web_search)

        if safe_content:
            result = self.full_to_half(result)
        
        # Remove empty lines
        return '\n'.join([line for line in result.split('\n') if line.strip() != ''])
