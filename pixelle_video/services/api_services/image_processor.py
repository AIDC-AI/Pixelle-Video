import requests


class ImageProcessor:
    """图片下载器（带重试与 SSL 回退）。"""

    def __init__(self, local_proxy: str | None = None):
        self.local_proxy = local_proxy

    def _proxies(self):
        if not self.local_proxy:
            return None
        return {"http": self.local_proxy, "https": self.local_proxy}

    def download_image(self, image_url, save_path, max_retries=3):
        """
        下载图片，带有重试机制和SSL错误处理

        Args:
            image_url: 图片URL
            save_path: 本地保存路径
            max_retries: 最大重试次数
        """
        import time
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        for attempt in range(max_retries):
            try:
                response = requests.get(
                    image_url,
                    timeout=(10, 30),
                    stream=True,
                    verify=True,
                    proxies=self._proxies(),
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                )

                if response.status_code == 200:
                    with open(save_path, 'wb') as file:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                file.write(chunk)
                    print(f"✓ 图片下载成功: {save_path}")
                    return True
                else:
                    print(f"下载失败，状态码: {response.status_code}")

            except requests.exceptions.SSLError as e:
                print(f"SSL错误 (尝试 {attempt + 1}/{max_retries}): {str(e)[:100]}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2
                    print(f"等待 {wait_time} 秒后重试...")
                    time.sleep(wait_time)
                else:
                    print("尝试禁用SSL验证重新下载...")
                    try:
                        response = requests.get(
                            image_url,
                            timeout=(10, 30),
                            stream=True,
                            verify=False,
                            proxies=self._proxies(),
                            headers={
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        )
                        if response.status_code == 200:
                            with open(save_path, 'wb') as file:
                                for chunk in response.iter_content(chunk_size=8192):
                                    if chunk:
                                        file.write(chunk)
                            print(f"✓ 图片下载成功(已禁用SSL验证): {save_path}")
                            return True
                    except Exception as fallback_error:
                        print(f"禁用SSL验证后仍然失败: {fallback_error}")
                        raise

            except requests.exceptions.Timeout as e:
                print(f"超时错误 (尝试 {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep((attempt + 1) * 2)
                else:
                    raise

            except Exception as e:
                print(f"下载错误 (尝试 {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep((attempt + 1) * 2)
                else:
                    raise

        return False
