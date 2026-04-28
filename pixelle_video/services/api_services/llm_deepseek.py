import os
import time
from openai import OpenAI

class DeepSeek:
    """
    deepseek-chat: DeepSeek-V3.2 非思考模式
    deepseek-reasoner: DeepSeek-V3.2 思考模式
    deepseek-v4-flash: DeepSeek-V4 Flash
    deepseek-v4-pro: DeepSeek-V4 Pro
    """
    def __init__(self, base_url="", api_key=""):
        self.base_url = base_url or os.getenv("DEEPSEEK_BASE_URL") or "https://api.deepseek.com/v1"
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        
        if not self.api_key:
            print("Warning: DEEPSEEK_API_KEY is not set.")

        self.client = OpenAI(
            api_key=self.api_key, 
            base_url=self.base_url
        )
        self.max_attempts = 3
        self.max_tokens = 8000

    def query(self, prompt, image_urls=[], model="deepseek-chat", web_search=False):
        """
        Query DeepSeek model.

        :param web_search: If True, adds enable_web_search: True to API call
        """
        if not model:
            model = "deepseek-chat"

        messages = [{"role": "system", "content": "You are a helpful assistant."}]
        messages.append({"role": "user", "content": prompt})

        attempts = 0
        while attempts < self.max_attempts:
            try:
                # Build request parameters
                request_params = {
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "max_tokens": self.max_tokens
                }

                response = self.client.chat.completions.create(**request_params)
                
                # DeepSeek might return reasoning_content for reasoner models, 
                # but standard content is what we return conform to other interfaces.
                if response.choices and response.choices[0].message.content:
                    return response.choices[0].message.content
                else:
                    print("Received an empty response from DeepSeek. Retrying.")
                    time.sleep(2)
            except Exception as e:
                print(f"Error occurred with DeepSeek: {e}. Retrying.")
                time.sleep(5)
            attempts += 1
                
        raise Exception("Max attempts reached, failed to get a response from DeepSeek.")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config

    # 支持的模型列表
    MODELS = ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-flash", "deepseek-v4-pro"]

    print("=== DeepSeek 可用性测试 ===")
    api_key = os.getenv("DEEPSEEK_API_KEY")
    base_url = os.getenv("DEEPSEEK_BASE_URL", "")
    if not api_key:
        print("✗ DEEPSEEK_API_KEY 未设置，跳过")
        sys.exit(1)
    print(f"  API Key: {api_key[:6]}***{api_key[-4:]}")
    if base_url:
        print(f"  Base URL: {base_url}")

    client = DeepSeek(api_key=api_key, base_url=base_url)
    prompt = "用一句话介绍你自己。"
    print(f"  Prompt: {prompt}")

    for model in MODELS:
        print(f"\n--- 测试模型: {model} ---")
        t0 = time.time()
        try:
            resp = client.query(prompt, model=model)
            elapsed = time.time() - t0
            print(f"✓ 响应 ({elapsed:.1f}s): {resp.strip()[:200]}")
        except Exception as e:
            print(f"✗ 失败: {e}")
