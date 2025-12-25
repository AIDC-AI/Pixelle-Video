# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
Taobao/Tmall product scraper using Playwright.

This scraper can extract product information from Taobao and Tmall
product detail pages without requiring login.
"""

import re
import time
from pathlib import Path
from typing import Optional, List
from urllib.parse import urlparse, parse_qs

from loguru import logger
from playwright.async_api import async_playwright, Browser, Page, BrowserContext

from pixelle_video.services.ecommerce.base import ProductScraper, ScraperFactory
from pixelle_video.services.ecommerce.models import ProductInfo, ScrapeResult


class TaobaoScraper(ProductScraper):
    """
    Playwright-based scraper for Taobao/Tmall.
    
    Features:
    - Persistent login state (login once, reuse forever)
    - Extracts title, price, images, shop info
    - Downloads high-resolution product images
    - Handles dynamic content loading
    """
    
    # Default directory for persistent browser data
    DEFAULT_USER_DATA_DIR = Path.home() / ".pixelle" / "browser_data"
    
    def __init__(
        self,
        headless: bool = True,
        user_agent: Optional[str] = None,
        timeout: int = 30000,
        user_data_dir: Optional[str] = None
    ):
        """
        Initialize scraper.
        
        Args:
            headless: Run browser in headless mode
            user_agent: Custom user agent string
            timeout: Default timeout in milliseconds
            user_data_dir: Directory to store persistent browser data (cookies, login state)
                          If None, uses ~/.pixelle/browser_data
        """
        self.headless = headless
        self.user_agent = user_agent or (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        self.timeout = timeout
        self.user_data_dir = Path(user_data_dir) if user_data_dir else self.DEFAULT_USER_DATA_DIR
        
        self._context: Optional[BrowserContext] = None
        self._playwright = None
    
    async def _ensure_browser(self):
        """Ensure browser context is launched with persistent storage"""
        if self._context is None:
            self._playwright = await async_playwright().start()
            
            # Ensure user data directory exists
            self.user_data_dir.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"🔐 Using persistent browser data: {self.user_data_dir}")
            
            # Launch persistent context - this saves cookies, localStorage, etc.
            self._context = await self._playwright.chromium.launch_persistent_context(
                user_data_dir=str(self.user_data_dir),
                headless=self.headless,
                user_agent=self.user_agent,
                viewport={"width": 1920, "height": 1080},
                # Use Chrome instead of Chromium for better compatibility
                channel="chrome" if not self.headless else None
            )
            
            logger.success(f"✅ Browser launched with persistent context")
    
    async def close(self):
        """Close browser and clean up (login state is automatically saved)"""
        if self._context:
            await self._context.close()
            self._context = None
            logger.debug("Browser closed (login state preserved)")
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
    
    async def login_interactive(self, url: str = "https://login.taobao.com"):
        """
        Open browser for manual login. Call this once to save login state.
        
        Args:
            url: Login page URL
        """
        # Force non-headless for interactive login
        original_headless = self.headless
        self.headless = False
        
        try:
            await self._ensure_browser()
            page = await self._context.new_page()
            await page.goto(url)
            
            logger.info("🔐 Please login in the browser window...")
            logger.info("   After login, press Enter in this terminal to continue.")
            
            # Wait for user to login
            input("\n>>> Press Enter after you have logged in... ")
            
            # Navigate to a product page to verify login
            await page.goto("https://www.taobao.com")
            await page.wait_for_timeout(2000)
            
            logger.success("✅ Login state saved! You can now run scraper in headless mode.")
            
            await page.close()
            
        finally:
            self.headless = original_headless
    
    def _extract_product_id(self, url: str) -> Optional[str]:
        """Extract product ID from URL"""
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        return params.get("id", [None])[0]
    
    def _detect_platform(self, url: str) -> str:
        """Detect platform from URL"""
        if "tmall.com" in url:
            return "tmall"
        return "taobao"
    
    async def scrape(
        self,
        url: str,
        output_dir: Optional[str] = None,
        download_images: bool = True,
        save_html: bool = False,
        take_screenshot: bool = False
    ) -> ScrapeResult:
        """
        Scrape product information from Taobao/Tmall URL.
        
        Args:
            url: Product detail page URL
            output_dir: Directory to save downloaded files
            download_images: Whether to download product images
            save_html: Whether to save page HTML
            take_screenshot: Whether to take page screenshot
        
        Returns:
            ScrapeResult with product info or error
        """
        start_time = time.time()
        
        try:
            await self._ensure_browser()
            
            # Prepare output directory
            if output_dir:
                output_path = Path(output_dir)
                output_path.mkdir(parents=True, exist_ok=True)
            else:
                output_path = None
            
            # Create new page
            page = await self._context.new_page()
            
            # Container for API response data
            api_images = []
            
            async def intercept_response(response):
                """Intercept mtop API responses to extract image data"""
                try:
                    url_str = response.url
                    # Look for mtop.taobao.detail.getdesc or similar APIs
                    if 'mtop.' in url_str and ('getdesc' in url_str.lower() or 'detail' in url_str.lower() or 'item' in url_str.lower()):
                        try:
                            text = await response.text()
                            # Extract image URLs from the response
                            # Find all alicdn image URLs with O1CN01 pattern (product images)
                            found_urls = re.findall(r'https?://[^\s"\'\\]*O1CN01[^\s"\'\\]*(?:jpg|png|webp)', text)
                            if found_urls:
                                logger.debug(f"Captured {len(found_urls)} images from API: {url_str[:80]}...")
                                api_images.extend(found_urls)
                        except Exception as e:
                            logger.debug(f"Failed to parse API response: {e}")
                except Exception:
                    pass
            
            # Add response listener BEFORE navigation
            page.on("response", intercept_response)
            
            try:
                # Navigate to product page
                logger.info(f"Navigating to: {url}")
                await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout)
                
                # Wait for dynamic content to load
                # Taobao uses heavy JavaScript rendering, need sufficient wait time
                await page.wait_for_timeout(3000)
                
                # Wait for main pic gallery to be visible
                try:
                    await page.wait_for_selector("#picGalleryEle", timeout=10000)
                    logger.debug("Main pic gallery loaded")
                except Exception:
                    logger.debug("Main pic gallery selector timeout, continuing...")
                
                # Additional wait for thumbnails and API responses
                await page.wait_for_timeout(2000)
                
                # Log API captured images count
                if api_images:
                    logger.debug(f"Captured {len(api_images)} images from API responses")
                    for i, img_url in enumerate(api_images[:5]):
                        logger.debug(f"  API image {i+1}: {img_url[:100]}...")
                
                # Extract product info (pass API images for enhancement)
                product = await self._extract_product_info(page, url, api_images=api_images)
                
                # Optional: Take screenshot
                if take_screenshot and output_path:
                    screenshot_path = output_path / "screenshot.png"
                    await page.screenshot(path=str(screenshot_path), full_page=True)
                    product.screenshot_path = str(screenshot_path)
                    logger.info(f"Screenshot saved: {screenshot_path}")
                
                # Optional: Save HTML
                if save_html and output_path:
                    html_path = output_path / "page.html"
                    content = await page.content()
                    with open(html_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    product.raw_html_path = str(html_path)
                    logger.info(f"HTML saved: {html_path}")
                
                # Always save product info as JSON for debugging and reference
                if output_path:
                    import json
                    json_path = output_path / "product_info.json"
                    with open(json_path, "w", encoding="utf-8") as f:
                        json.dump(product.model_dump(), f, ensure_ascii=False, indent=2)
                    product.raw_json_path = str(json_path)
                    logger.info(f"JSON saved: {json_path}")
                
                # Optional: Download images
                if download_images and output_path:
                    await self._download_images(page, product, output_path)
                
                elapsed = time.time() - start_time
                logger.success(f"Scraping complete in {elapsed:.2f}s")
                
                return ScrapeResult(
                    success=True,
                    product=product,
                    elapsed_seconds=elapsed
                )
                
            finally:
                await page.close()
                
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"Scraping failed: {e}")
            return ScrapeResult(
                success=False,
                error=str(e),
                elapsed_seconds=elapsed
            )
    
    async def _extract_product_info(
        self, 
        page: Page, 
        url: str,
        api_images: List[str] = None
    ) -> ProductInfo:
        """Extract all product information from page"""
        product = ProductInfo(
            url=url,
            platform=self._detect_platform(url),
            product_id=self._extract_product_id(url),
            title=""  # Will be filled below
        )
        
        # Extract title
        product.title = await self._extract_title(page)
        
        # Extract price
        product.price = await self._extract_price(page)
        
        # Extract original price (for discount display)
        product.original_price = await self._extract_text(page, "[class*='originPrice'], [class*='originalPrice']")
        
        # Extract shop name
        product.shop_name = await self._extract_shop_name(page)
        
        # Extract shipping info
        product.shipping = await self._extract_text(page, "[class*='shipping']")
        product.freight = await self._extract_text(page, "[class*='freight']")
        
        # Extract sales count
        product.sales = await self._extract_text(page, "[class*='sales'], [class*='sold']")
        
        # Extract rating
        product.rating = await self._extract_text(page, "[class*='rating'], [class*='starNum']")
        
        # Extract description/subtitle
        product.description = await self._extract_text(page, "[class*='subTitle'], [class*='subtitle'], [class*='desc']")
        
        # Extract highlights/selling points
        product.highlights = await self._extract_highlights(page)
        
        # Extract service guarantees
        product.services = await self._extract_services(page)
        
        # Extract promotions
        product.promotions = await self._extract_promotions(page)
        
        # Extract main images (include API captured images)
        product.main_images = await self._extract_main_images(page, api_images=api_images)
        
        return product
    
    async def _extract_title(self, page: Page) -> str:
        """Extract product title"""
        selectors = [
            "h1",
            ".tb-main-title",
            "[class*='mainTitle']",
            "[class*='MainTitle']",
            "#J_Title h3",
        ]
        
        for selector in selectors:
            try:
                el = await page.query_selector(selector)
                if el:
                    text = await el.inner_text()
                    if text.strip() and len(text.strip()) > 5:
                        return text.strip()
            except Exception:
                pass
        
        # Fallback: extract from page title
        page_title = await page.title()
        if page_title:
            # Remove suffix like "-淘宝网"
            return page_title.split("-")[0].strip()
        
        return ""
    
    async def _extract_price(self, page: Page) -> Optional[str]:
        """Extract product price"""
        # Try different selectors
        selectors = [
            "span[class*='text--']",
            "[class*='block2'] span[class*='text']",
        ]
        
        for selector in selectors:
            try:
                elements = await page.query_selector_all(selector)
                for el in elements:
                    text = await el.inner_text()
                    if text.strip():
                        # Match price pattern (digits with optional decimal)
                        if re.match(r'^[\d,]+\.?\d*$', text.strip()):
                            return text.strip()
            except Exception:
                pass
        
        # Fallback: extract from orange color container
        try:
            container = await page.query_selector("div[style*='rgb(255, 79, 0)']")
            if container:
                text = await container.inner_text()
                match = re.search(r'￥?([\d,]+\.?\d*)', text)
                if match:
                    return match.group(1)
        except Exception:
            pass
        
        return None
    
    async def _extract_shop_name(self, page: Page) -> Optional[str]:
        """Extract shop name"""
        selectors = [
            "[class*='shopName']",
            "[class*='ShopName']",
            ".tb-shop-name",
            "[class*='ShopHeader'] a",
        ]
        
        for selector in selectors:
            try:
                el = await page.query_selector(selector)
                if el:
                    text = await el.inner_text()
                    if text.strip():
                        # Take first line only (avoid extra info)
                        return text.strip().split('\n')[0].strip()
            except Exception:
                pass
        
        return None
    
    async def _extract_text(self, page: Page, selector: str) -> Optional[str]:
        """Generic text extraction helper"""
        try:
            el = await page.query_selector(selector)
            if el:
                text = await el.inner_text()
                return text.strip() if text else None
        except Exception:
            pass
        return None
    
    async def _extract_highlights(self, page: Page) -> List[str]:
        """Extract product highlights/selling points"""
        highlights = []
        selectors = [
            "[class*='highlight'] span",
            "[class*='Highlight'] span", 
            "[class*='sellPoint']",
            "[class*='feature']",
            "[class*='tag']",
            "[class*='label']"
        ]
        
        for selector in selectors:
            try:
                elements = await page.query_selector_all(selector)
                for el in elements[:10]:  # Limit to 10
                    text = await el.inner_text()
                    if text and len(text.strip()) > 2 and len(text.strip()) < 50:
                        highlights.append(text.strip())
            except Exception:
                pass
        
        # Deduplicate
        return list(dict.fromkeys(highlights))[:8]
    
    async def _extract_services(self, page: Page) -> List[str]:
        """Extract service guarantees"""
        services = []
        selectors = [
            "[class*='service'] span",
            "[class*='guarantee']",
            "[class*='policy']",
            "[class*='storeLabel']"
        ]
        
        for selector in selectors:
            try:
                elements = await page.query_selector_all(selector)
                for el in elements[:10]:
                    text = await el.inner_text()
                    if text and len(text.strip()) > 2 and len(text.strip()) < 50:
                        services.append(text.strip())
            except Exception:
                pass
        
        return list(dict.fromkeys(services))[:6]
    
    async def _extract_promotions(self, page: Page) -> List[str]:
        """Extract current promotions/discounts"""
        promotions = []
        selectors = [
            "[class*='promotion']",
            "[class*='Promotion']",
            "[class*='discount']",
            "[class*='coupon']",
            "[class*='activity']"
        ]
        
        for selector in selectors:
            try:
                elements = await page.query_selector_all(selector)
                for el in elements[:5]:
                    text = await el.inner_text()
                    if text and len(text.strip()) > 3 and len(text.strip()) < 100:
                        promotions.append(text.strip())
            except Exception:
                pass
        
        return list(dict.fromkeys(promotions))[:5]
    
    async def _extract_main_images(
        self, 
        page: Page, 
        api_images: List[str] = None
    ) -> List[str]:
        """
        Extract main product image URLs.
        
        Key insight: Real product main images contain the seller ID (e.g., 2211714949103)
        in the URL pattern: _!!{seller_id}
        
        UI elements and platform images use _!!6000000* pattern.
        """
        # First, try to trigger loading of all thumbnails by hovering/clicking
        await self._trigger_thumbnail_loading(page)
        
        # Extract seller ID from current page
        seller_id = await self._extract_seller_id(page)
        logger.debug(f"Detected seller ID: {seller_id}")
        
        main_images = []
        
        # ONLY extract from thumbnail images in gallery area
        # This ensures we get the real main product images, not detail/description images
        gallery = await page.query_selector("#picGalleryEle")
        if gallery:
            # Get thumbnail images specifically - these are the real main product images
            thumbnail_imgs = await gallery.query_selector_all("img[class*='thumbnailPic']")
            logger.debug(f"Found {len(thumbnail_imgs)} thumbnail images in gallery")
            
            for img in thumbnail_imgs:
                src = await img.get_attribute("src")
                if src:
                    main_images.append(src)
        
        # Fallback: if no thumbnails found, try API images
        if not main_images and api_images:
            logger.debug("No thumbnails found, using API images as fallback")
            main_images.extend(api_images)
        
        # Deduplicate and convert to high-res URLs
        cleaned_images = []
        seen_ids = set()
        
        for url in main_images:
            # Only keep images with seller ID (filter out placeholder images)
            if seller_id and f"_!!{seller_id}" not in url:
                continue
            
            # Extract unique image ID
            match = re.search(r'(O1CN01[a-zA-Z0-9]+)', url)
            if match:
                img_id = match.group(1)
                
                if img_id not in seen_ids:
                    seen_ids.add(img_id)
                    
                    # Convert to high-res URL
                    # Original format: xxx.jpg_q50.jpg_.webp -> xxx.jpg_.webp
                    # Pattern: remove the _q50.jpg part (quality suffix)
                    clean_url = re.sub(r'\.jpg_q\d+\.jpg_\.webp$', '.jpg_.webp', url)
                    # Also handle: xxx.jpg_q50.jpg -> xxx.jpg
                    clean_url = re.sub(r'\.jpg_q\d+\.jpg$', '.jpg', clean_url)
                    # Handle size suffixes: xxx.jpg_400x400q90.jpg_.webp -> xxx.jpg_.webp
                    clean_url = re.sub(r'\.jpg_\d+x\d+[^.]*\.jpg_\.webp$', '.jpg_.webp', clean_url)
                    
                    cleaned_images.append(clean_url)
        
        logger.info(f"Found {len(cleaned_images)} main images (seller ID: {seller_id})")
        return cleaned_images
    
    async def _extract_shop_icon_ids(self, page: Page) -> set:
        """Extract image IDs used for shop icons (to exclude from main images)"""
        shop_icon_ids = set()
        try:
            # Find shop icon images
            selectors = [
                "[class*='shopIcon'] img",
                "[class*='ShopIcon'] img",
                "[class*='shop-icon'] img",
                ".shopIconImg--YdJniOBM",
            ]
            for selector in selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    for el in elements:
                        src = await el.get_attribute("src") or ""
                        match = re.search(r'(O1CN01[a-zA-Z0-9]+)', src)
                        if match:
                            shop_icon_ids.add(match.group(1))
                            logger.debug(f"Found shop icon ID: {match.group(1)}")
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"Failed to extract shop icon IDs: {e}")
        
        return shop_icon_ids
    
    async def _trigger_thumbnail_loading(self, page: Page):
        """
        Trigger loading of all thumbnail images.
        
        Taobao uses lazy loading for thumbnails. We need to:
        1. Click on each thumbnail to trigger loading
        2. Scroll the thumbnail container
        3. Wait for network requests to complete
        """
        try:
            # Wait for initial thumbnails to render
            await page.wait_for_timeout(1000)
            
            # Find thumbnail container
            thumbnail_container = await page.query_selector("[class*='thumbnails']")
            if not thumbnail_container:
                logger.debug("No thumbnail container found")
                return
            
            # Get all thumbnail elements
            thumbnails = await page.query_selector_all("[class*='thumbnail--']")
            logger.debug(f"Found {len(thumbnails)} thumbnail elements")
            
            # Click on each thumbnail to trigger image loading
            for i, thumb in enumerate(thumbnails[:10]):
                try:
                    await thumb.click()
                    await page.wait_for_timeout(500)  # Wait for image to load
                    logger.debug(f"Clicked thumbnail {i+1}")
                except Exception as e:
                    logger.debug(f"Failed to click thumbnail {i+1}: {e}")
            
            # Click back to first thumbnail
            if thumbnails:
                try:
                    await thumbnails[0].click()
                    await page.wait_for_timeout(500)
                except Exception:
                    pass
            
            # Scroll thumbnail container to load any lazy-loaded images
            await page.evaluate("""
                const container = document.querySelector('[class*="thumbnails"]');
                if (container) {
                    // Scroll to end and back
                    container.scrollLeft = container.scrollWidth;
                    container.scrollLeft = 0;
                }
            """)
            
            await page.wait_for_timeout(1000)
            
        except Exception as e:
            logger.debug(f"Thumbnail loading trigger failed: {e}")
    
    async def _extract_seller_id(self, page: Page) -> Optional[str]:
        """
        Extract seller ID from page content.
        
        Key insight: Real seller IDs are NOT 6000000* (those are platform generic IDs).
        Real seller IDs are typically 10-13 digit numbers like 2211714949103.
        """
        try:
            content = await page.content()
            
            # Find all seller ID candidates from image URLs
            # Pattern: _!!{seller_id} where seller_id is the real seller ID
            all_ids = re.findall(r'_!!(\d{10,13})', content)
            
            # Filter out platform generic IDs (6000000*)
            real_ids = [id for id in all_ids if not id.startswith('6000000')]
            
            if real_ids:
                # Return the most common real seller ID
                from collections import Counter
                id_counts = Counter(real_ids)
                most_common = id_counts.most_common(1)
                if most_common:
                    seller_id = most_common[0][0]
                    logger.debug(f"Found seller ID: {seller_id} (count: {most_common[0][1]})")
                    return seller_id
            
            # Fallback: look for sellerId in page data
            match = re.search(r'seller[Ii]d["\s:=]+["\']?(\d{10,13})', content)
            if match:
                sid = match.group(1)
                if not sid.startswith('6000000'):
                    return sid
            
        except Exception as e:
            logger.debug(f"Seller ID extraction error: {e}")
        
        return None
    
    async def _download_images(
        self,
        page: Page,
        product: ProductInfo,
        output_dir: Path
    ):
        """Download product images to local directory"""
        images_dir = output_dir / "images"
        images_dir.mkdir(exist_ok=True)
        
        local_images = []
        
        for i, url in enumerate(product.main_images, 1):
            # Fix protocol-relative URLs
            if url.startswith("//"):
                url = "https:" + url
            
            try:
                logger.debug(f"Downloading image {i}: {url[:60]}...")
                
                # Use Playwright to fetch (bypasses anti-crawl)
                response = await page.goto(url)
                if response and response.status == 200:
                    content = await response.body()
                    
                    # Determine extension
                    ext = ".jpg"
                    if ".png" in url:
                        ext = ".png"
                    
                    filename = f"main_{i:02d}{ext}"
                    filepath = images_dir / filename
                    
                    with open(filepath, "wb") as f:
                        f.write(content)
                    
                    local_images.append(str(filepath))
                    logger.debug(f"  Saved: {filepath} ({len(content) // 1024}KB)")
                else:
                    status = response.status if response else "No response"
                    logger.warning(f"  Failed to download: HTTP {status}")
                    
            except Exception as e:
                logger.warning(f"  Error downloading image: {e}")
        
        product.local_images = local_images
        logger.info(f"Downloaded {len(local_images)} images")


# Register with factory
ScraperFactory.register("taobao", TaobaoScraper)
ScraperFactory.register("tmall", TaobaoScraper)

