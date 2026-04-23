# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Inspired by MoneyPrinterPlus (https://github.com/ddean2009/MoneyPrinterPlus)

"""
Selenium-based video publisher for Chinese social media platforms.

Attaches to an already logged-in browser session via DevTools debugger,
then automates the upload flow for each platform.
"""

import os
import re
import socket
import subprocess
import sys
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from loguru import logger

try:
    import pyperclip
    from selenium import webdriver
    from selenium.webdriver import Keys, ActionChains
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.wait import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    _HAS_SELENIUM = True
except ImportError:
    _HAS_SELENIUM = False

PLATFORM_SITES = {
    "douyin": "https://creator.douyin.com/creator-micro/content/upload",
    "kuaishou": "https://cp.kuaishou.com/article/publish/video",
    "xiaohongshu": "https://creator.xiaohongshu.com/publish/publish",
    "bilibili": "https://member.bilibili.com/platform/upload/video/frame",
    "shipinhao": "https://channels.weixin.qq.com/platform/post/create",
}


@dataclass
class PlatformConfig:
    enabled: bool = True
    title_prefix: str = ""
    collection: str = ""
    tags: str = ""


@dataclass
class PublishParams:
    video_path: str
    title: str = ""
    description: str = ""
    cover_path: str = ""
    auto_publish: bool = False
    use_common_config: bool = True
    common: PlatformConfig = field(default_factory=PlatformConfig)
    douyin: PlatformConfig = field(default_factory=PlatformConfig)
    kuaishou: PlatformConfig = field(default_factory=PlatformConfig)
    xiaohongshu: PlatformConfig = field(default_factory=PlatformConfig)
    bilibili: PlatformConfig = field(default_factory=PlatformConfig)
    shipinhao: PlatformConfig = field(default_factory=PlatformConfig)
    kuaishou_domain_enabled: bool = False
    kuaishou_domain_level1: str = ""
    kuaishou_domain_level2: str = ""
    bilibili_section_enabled: bool = False
    bilibili_section_level1: str = ""
    bilibili_section_level2: str = ""
    shipinhao_original: bool = False

    def get_config(self, platform: str) -> PlatformConfig:
        if self.use_common_config:
            return self.common
        return getattr(self, platform, self.common)


class PublisherService:

    _CHROME_PATHS_WIN = [
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files"))
        / "Google" / "Chrome" / "Application" / "chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)"))
        / "Google" / "Chrome" / "Application" / "chrome.exe",
        Path(os.environ.get("LOCALAPPDATA", ""))
        / "Google" / "Chrome" / "Application" / "chrome.exe",
        # Microsoft Edge as fallback
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files"))
        / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)"))
        / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        Path(os.environ.get("LOCALAPPDATA", ""))
        / "Microsoft" / "Edge" / "Application" / "msedge.exe",
    ]

    def __init__(
        self,
        driver_type: str = "chrome",
        driver_path: str = "",
        debugger_address: str = "127.0.0.1:9222",
    ):
        if not _HAS_SELENIUM:
            raise ImportError(
                "selenium and pyperclip are required. "
                "Install: pip install selenium pyperclip"
            )
        self.driver_type = driver_type
        self.driver_path = driver_path
        self.debugger_address = debugger_address
        self._driver: Optional[webdriver.Chrome] = None

    @staticmethod
    def find_chrome() -> Optional[str]:
        if sys.platform == "win32":
            for p in PublisherService._CHROME_PATHS_WIN:
                if p.exists():
                    return str(p)
        elif sys.platform == "darwin":
            mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            if os.path.exists(mac):
                return mac
        else:
            for name in ("google-chrome", "google-chrome-stable", "chromium-browser"):
                import shutil
                found = shutil.which(name)
                if found:
                    return found
        return None

    @staticmethod
    def is_debug_port_open(host: str = "127.0.0.1", port: int = 9222) -> bool:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except (OSError, ConnectionRefusedError):
            return False

    @staticmethod
    def parse_address(addr: str) -> tuple:
        parts = addr.rsplit(":", 1)
        host = parts[0] if len(parts) == 2 else "127.0.0.1"
        port = int(parts[1]) if len(parts) == 2 else 9222
        return host, port

    @classmethod
    def _make_manual_cmd(cls, exe: str, port: int) -> str:
        user_data_dir = str(Path(os.environ.get("TEMP", os.getcwd())) / "pixelle_chrome_debug")
        return (
            f'"{exe}" --remote-debugging-port={port} '
            f'--user-data-dir="{user_data_dir}" '
            f'--no-first-run --no-default-browser-check'
        )

    @classmethod
    def launch_chrome_debug(cls, port: int = 9222, chrome_path: str = "") -> str:
        exe = chrome_path or cls.find_chrome()
        if not exe or not os.path.exists(exe):
            raise FileNotFoundError(
                "未找到 Chrome/Edge 浏览器。请在「浏览器路径」中填写 chrome.exe 或 msedge.exe 的完整路径。"
            )

        # If port is already open, nothing to do
        if cls.is_debug_port_open("127.0.0.1", port):
            return exe

        user_data_dir = str(Path(os.environ.get("TEMP", os.getcwd())) / "pixelle_chrome_debug")
        cmd = [
            exe,
            f"--remote-debugging-port={port}",
            f"--user-data-dir={user_data_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-popup-blocking",
        ]
        if sys.platform == "win32":
            # Use PowerShell Start-Process so Chrome is fully detached from the
            # Python/Streamlit process tree and can bind the debug port properly.
            # -ArgumentList must be comma-separated quoted strings, NOT a single
            # space-joined string, otherwise all flags arrive as one argument.
            args_ps = ",".join(f'"{a}"' for a in cmd[1:])
            ps_cmd = f'Start-Process -FilePath "{exe}" -ArgumentList {args_ps}'
            subprocess.Popen(
                ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps_cmd],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        else:
            subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        # Give Chrome time to bind the debug port before returning.
        for _ in range(10):
            time.sleep(0.5)
            if cls.is_debug_port_open("127.0.0.1", port):
                return exe
        return exe

    def init_driver(self):
        if self._driver:
            return self._driver

        if self.driver_type == "chrome":
            options = webdriver.chrome.options.Options()
            options.page_load_strategy = "normal"
            options.add_experimental_option("debuggerAddress", self.debugger_address)
            if self.driver_path:
                service = webdriver.chrome.service.Service(self.driver_path)
                self._driver = webdriver.Chrome(service=service, options=options)
            else:
                self._driver = webdriver.Chrome(options=options)
        elif self.driver_type == "firefox":
            options = webdriver.firefox.options.Options()
            options.page_load_strategy = "normal"
            if self.driver_path:
                service = webdriver.firefox.service.Service(
                    self.driver_path,
                    service_args=["--marionette-port", "2828", "--connect-existing"],
                )
                self._driver = webdriver.Firefox(service=service, options=options)
            else:
                self._driver = webdriver.Firefox(options=options)
        else:
            raise ValueError(f"Unsupported driver: {self.driver_type}")

        self._driver.implicitly_wait(10)
        return self._driver

    def test_connection(self):
        """Open a test page to verify the driver works."""
        driver = self.init_driver()
        driver.switch_to.new_window("tab")
        driver.get("https://www.baidu.com")
        time.sleep(2)
        title = driver.title
        driver.close()
        driver.switch_to.window(driver.window_handles[-1])
        return title

    def publish(self, params: PublishParams, progress_callback=None):
        driver = self.init_driver()
        results = {}

        platforms = [
            p for p in ["douyin", "kuaishou", "xiaohongshu", "bilibili", "shipinhao"]
            if params.get_config(p).enabled
        ]
        total = len(platforms)

        for idx, platform in enumerate(platforms):
            if progress_callback:
                progress_callback(platform, idx, total, "publishing")
            try:
                handler = getattr(self, f"_publish_{platform}", None)
                if handler is None:
                    results[platform] = {"success": False, "error": f"Unknown: {platform}"}
                    continue
                handler(driver, params)
                results[platform] = {"success": True}
            except Exception as e:
                logger.error(f"Publish to {platform} failed: {e}")
                traceback.print_exc()
                results[platform] = {"success": False, "error": str(e)}
            if progress_callback:
                progress_callback(platform, idx + 1, total, "done")

        return results

    # ── 抖音 ──────────────────────────────────────────────────────

    def _publish_douyin(self, driver, params: PublishParams):
        cfg = params.get_config("douyin")
        driver.switch_to.new_window("tab")
        driver.get(PLATFORM_SITES["douyin"])
        time.sleep(3)

        driver.find_element(By.XPATH, '//input[@type="file"]').send_keys(
            params.video_path
        )
        time.sleep(10)

        try:
            title_el = driver.find_element(
                By.XPATH, '//input[@class="semi-input semi-input-default"]'
            )
            title_text = cfg.title_prefix + (params.title or "")
            title_el.send_keys(title_text[:30])
            time.sleep(1)
        except Exception:
            logger.warning("Douyin: title not found")

        try:
            content = driver.find_element(
                By.XPATH, '//div[@data-placeholder="添加作品简介"]'
            )
            content.click()
            time.sleep(1)
            self._paste_text(driver, params.description or params.title or "")
            time.sleep(1)
            self._send_tags_space(content, driver, cfg.tags)
        except Exception:
            logger.warning("Douyin: content not found")

        if cfg.collection:
            try:
                driver.find_element(
                    By.XPATH, '//div[contains(text(),"选择合集")]'
                ).click()
                time.sleep(1)
                driver.find_element(
                    By.XPATH,
                    f'//div[@class="semi-select-option collection-option"]'
                    f'//span[text()="{cfg.collection}"]',
                ).click()
                time.sleep(1)
            except Exception:
                logger.warning("Douyin: collection not found")

        try:
            driver.find_element(
                By.XPATH,
                '//*[@id="root"]/div/div/div[1]/div[11]/div/label[2]',
            ).click()
            time.sleep(1)
        except Exception:
            pass

        if params.auto_publish:
            self._click_publish(driver, '//button[text()="发布"]')

    # ── 快手 ──────────────────────────────────────────────────────

    def _publish_kuaishou(self, driver, params: PublishParams):
        cfg = params.get_config("kuaishou")
        driver.switch_to.new_window("tab")
        driver.get(PLATFORM_SITES["kuaishou"])
        time.sleep(3)

        driver.find_element(By.XPATH, '//input[@type="file"]').send_keys(
            params.video_path
        )
        time.sleep(10)

        wait = WebDriverWait(driver, 30)
        try:
            wait.until(
                EC.presence_of_element_located(
                    (By.XPATH, '//div[contains(@placeholder, "添加合适的话题和描述")]')
                )
            )
        except Exception:
            pass

        try:
            content = driver.find_element(
                By.XPATH, '//div[contains(@placeholder, "添加合适的话题和描述")]'
            )
            content.click()
            time.sleep(1)
            text = cfg.title_prefix + (params.description or params.title or "")
            self._paste_text(driver, text[:450])
            time.sleep(1)
            self._send_tags_space(content, driver, cfg.tags, max_tags=3)
        except Exception:
            logger.warning("Kuaishou: content not found")

        if cfg.collection:
            try:
                el = driver.find_element(
                    By.XPATH, '//span[contains(text(),"选择要加入到的合集")]'
                )
                ActionChains(driver).move_to_element(el).click().perform()
                time.sleep(1)
                driver.find_element(
                    By.XPATH, f'//div[@label="{cfg.collection}"]'
                ).click()
                time.sleep(1)
            except Exception:
                logger.warning("Kuaishou: collection not found")

        if params.kuaishou_domain_enabled:
            try:
                el = driver.find_element(
                    By.XPATH, '//span[contains(text(),"请选择")]'
                )
                ActionChains(driver).move_to_element(el).click().perform()
                time.sleep(1)
                lv1 = driver.find_element(
                    By.XPATH, f'//div[@title="{params.kuaishou_domain_level1}"]'
                )
                ActionChains(driver).move_to_element(lv1).click().perform()
                time.sleep(1)
                el2 = driver.find_element(
                    By.XPATH, '//span[contains(text(),"请选择")]'
                )
                ActionChains(driver).move_to_element(el2).click().perform()
                time.sleep(1)
                lv2 = driver.find_element(
                    By.XPATH, f'//div[@title="{params.kuaishou_domain_level2}"]'
                )
                ActionChains(driver).move_to_element(lv2).click().perform()
                time.sleep(1)
            except Exception:
                logger.warning("Kuaishou: domain selection failed")

        try:
            driver.find_element(
                By.XPATH, '//*[@id="setting-tours"]/div[2]/div/label[2]'
            ).click()
            time.sleep(1)
        except Exception:
            pass

        if params.auto_publish:
            self._click_publish(driver, None, class_name="_button-primary_si04s_60")

    # ── 小红书 ────────────────────────────────────────────────────

    def _publish_xiaohongshu(self, driver, params: PublishParams):
        cfg = params.get_config("xiaohongshu")
        driver.switch_to.new_window("tab")
        driver.get(PLATFORM_SITES["xiaohongshu"])
        time.sleep(3)

        try:
            fi = driver.find_element(By.CLASS_NAME, "upload-input")
        except Exception:
            fi = driver.find_element(By.XPATH, '//input[@type="file"]')
        fi.send_keys(params.video_path)
        time.sleep(10)

        wait = WebDriverWait(driver, 30)
        try:
            wait.until(EC.presence_of_element_located((By.CLASS_NAME, "c-input_inner")))
        except Exception:
            pass

        try:
            title_el = driver.find_element(By.CLASS_NAME, "d-text")
            title_text = cfg.title_prefix + (params.title or "")
            title_el.send_keys(title_text[:20])
            time.sleep(1)
        except Exception:
            logger.warning("Xiaohongshu: title not found")

        try:
            content = driver.find_element(By.XPATH, '//*[@id="quillEditor"]/div')
            content.send_keys(params.description or "")
            time.sleep(1)
            self._send_tags_space(content, driver, cfg.tags)
        except Exception:
            logger.warning("Xiaohongshu: content not found")

        if params.auto_publish:
            self._click_publish(
                driver, '//button[contains(@class, "publishBtn")]'
            )

    # ── B站 ───────────────────────────────────────────────────────

    def _publish_bilibili(self, driver, params: PublishParams):
        cfg = params.get_config("bilibili")
        driver.switch_to.new_window("tab")
        driver.get(PLATFORM_SITES["bilibili"])
        time.sleep(3)

        try:
            fi = driver.find_element(
                By.XPATH, '//*[@id="video-up-app"]//input[@type="file"]'
            )
        except Exception:
            fi = driver.find_element(By.XPATH, '//input[@type="file"]')
        fi.send_keys(params.video_path)
        time.sleep(10)

        try:
            title_el = driver.find_element(
                By.XPATH,
                '//*[@id="video-up-app"]/div[2]/div[1]/div[2]/div[3]'
                '/div/div[2]/div[1]/div/input',
            )
            title_el.clear()
            time.sleep(1)
            title_text = cfg.title_prefix + (params.title or "")
            title_el.send_keys(title_text[:80])
            time.sleep(1)
        except Exception:
            logger.warning("Bilibili: title not found")

        if params.bilibili_section_enabled:
            try:
                sec = driver.find_element(By.CLASS_NAME, "select-controller")
                ActionChains(driver).move_to_element(sec).click().perform()
                time.sleep(2)
                lv1 = driver.find_element(
                    By.XPATH,
                    f'//p[@class="f-item-content" and text()="{params.bilibili_section_level1}"]',
                )
                ActionChains(driver).move_to_element(lv1).click().perform()
                time.sleep(1)
                lv2 = driver.find_element(
                    By.XPATH,
                    f'//p[@class="item-main" and text()="{params.bilibili_section_level2}"]',
                )
                ActionChains(driver).move_to_element(lv2).click().perform()
                time.sleep(1)
            except Exception:
                logger.warning("Bilibili: section selection failed")

        try:
            tags_input = driver.find_element(
                By.XPATH, '//input[@placeholder="按回车键Enter创建标签"]'
            )
            for _ in range(10):
                tags_input.send_keys(Keys.BACK_SPACE)
            time.sleep(1)
            for i, tag in enumerate(cfg.tags.split()):
                if i >= 10:
                    break
                tags_input.send_keys(tag)
                time.sleep(1)
                tags_input.send_keys(Keys.ENTER)
                time.sleep(0.5)
        except Exception:
            logger.warning("Bilibili: tags not found")

        try:
            content = driver.find_element(
                By.XPATH,
                '//*[@id="video-up-app"]/div[2]/div[1]/div[2]/div[7]'
                '/div/div[2]/div/div[1]/div[1]',
            )
            content.click()
            time.sleep(1)
            self._paste_text(driver, params.description or "")
        except Exception:
            logger.warning("Bilibili: content not found")

        if params.auto_publish:
            self._click_publish(driver, None, class_name="submit-add")

    # ── 视频号 ────────────────────────────────────────────────────

    def _publish_shipinhao(self, driver, params: PublishParams):
        cfg = params.get_config("shipinhao")
        driver.switch_to.new_window("tab")
        driver.get(PLATFORM_SITES["shipinhao"])
        time.sleep(3)

        driver.find_element(By.XPATH, '//input[@type="file"]').send_keys(
            params.video_path
        )
        time.sleep(10)

        try:
            title_el = driver.find_element(
                By.XPATH,
                '//input[@placeholder="概括视频主要内容，字数建议6-16个字符"]',
            )
            clean = re.sub(
                r'[.!?,:;"\'\-\(\)。！？，：、；"\'（）]',
                "",
                cfg.title_prefix + (params.title or ""),
            )
            title_el.send_keys(clean[:20])
            time.sleep(1)
        except Exception:
            logger.warning("Shipinhao: title not found")

        try:
            content = driver.find_element(
                By.XPATH, '//div[@class="input-editor"]'
            )
            content.click()
            time.sleep(1)
            self._paste_text(driver, params.description or "")
            time.sleep(1)
            self._send_tags_space(content, driver, cfg.tags)
        except Exception:
            logger.warning("Shipinhao: content not found")

        try:
            loc = driver.find_element(By.CLASS_NAME, "location-name")
            ActionChains(driver).move_to_element(loc).click().perform()
            time.sleep(1)
            no_loc = driver.find_element(
                By.XPATH,
                '//div[@class="location-item-info"]/div[text()="不显示位置"]',
            )
            ActionChains(driver).move_to_element(no_loc).click().perform()
            time.sleep(1)
        except Exception:
            pass

        if cfg.collection:
            try:
                col = driver.find_element(
                    By.XPATH,
                    '//div[@class="post-album-display-wrap"]/div[text()="选择合集"]',
                )
                ActionChains(driver).move_to_element(col).click().perform()
                time.sleep(1)
                sel = driver.find_element(
                    By.XPATH,
                    f'//div[@class="post-album-wrap"]//div[text()="{cfg.collection}"]',
                )
                ActionChains(driver).move_to_element(sel).click().perform()
                time.sleep(1)
            except Exception:
                logger.warning("Shipinhao: collection not found")

        if params.shipinhao_original:
            try:
                cb = driver.find_element(
                    By.XPATH,
                    '//div[@class="declare-original-checkbox"]//input[@type="checkbox"]',
                )
                cb.click()
                time.sleep(1)
                agree = driver.find_element(
                    By.XPATH,
                    '//div[@class="original-proto-wrapper"]//input[@type="checkbox"]',
                )
                agree.click()
                time.sleep(1)
                driver.find_element(
                    By.XPATH,
                    '//button[@type="button" and text()="声明原创"]',
                ).click()
                time.sleep(1)
            except Exception:
                logger.warning("Shipinhao: original marking failed")

        if params.auto_publish:
            self._click_publish(driver, '//button[text()="发表"]')

    # ── Utilities ─────────────────────────────────────────────────

    @staticmethod
    def _paste_text(driver, text: str):
        cmd = Keys.COMMAND if sys.platform == "darwin" else Keys.CONTROL
        pyperclip.copy(text)
        ActionChains(driver).key_down(cmd).send_keys("v").key_up(cmd).perform()

    @staticmethod
    def _send_tags_space(element, driver, tags_str: str, max_tags: int = 20):
        if not tags_str:
            return
        for i, tag in enumerate(tags_str.split()):
            if i >= max_tags:
                break
            element.send_keys(" ")
            element.send_keys(tag)
            time.sleep(1)
            element.send_keys(Keys.ENTER)
            time.sleep(0.5)
            element.send_keys(" ")
            time.sleep(0.5)

    @staticmethod
    def _click_publish(driver, xpath=None, class_name=None):
        try:
            if xpath:
                btn = driver.find_element(By.XPATH, xpath)
            else:
                btn = driver.find_element(By.CLASS_NAME, class_name)
            btn.click()
        except Exception:
            logger.warning("Publish button not found")
