# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
Base interface for e-commerce product scrapers.

This module defines the abstract interface that all scrapers must implement.
The abstraction allows for different implementations (Playwright, Selenium, etc.)
without changing the calling code.
"""

from abc import ABC, abstractmethod
from typing import Optional
from pathlib import Path

from pixelle_video.services.ecommerce.models import ProductInfo, ScrapeResult


class ProductScraper(ABC):
    """
    Abstract base class for product scrapers.
    
    Implementations can use different browser automation tools
    (Playwright, Selenium, Puppeteer, etc.) while maintaining
    a consistent interface.
    """
    
    @abstractmethod
    async def scrape(
        self,
        url: str,
        output_dir: Optional[str] = None,
        download_images: bool = True,
        save_html: bool = False,
        take_screenshot: bool = False
    ) -> ScrapeResult:
        """
        Scrape product information from the given URL.
        
        Args:
            url: Product detail page URL
            output_dir: Directory to save downloaded files (images, HTML, etc.)
            download_images: Whether to download product images
            save_html: Whether to save page HTML for debugging
            take_screenshot: Whether to take page screenshot
        
        Returns:
            ScrapeResult with product info or error
        """
        pass
    
    @abstractmethod
    async def close(self):
        """
        Clean up resources (close browser, etc.)
        """
        pass
    
    def __del__(self):
        """Ensure cleanup on garbage collection"""
        pass


class ScraperFactory:
    """
    Factory for creating product scrapers.
    
    Usage:
        scraper = ScraperFactory.create("taobao")
        result = await scraper.scrape(url)
    """
    
    _scrapers = {}
    
    @classmethod
    def register(cls, platform: str, scraper_class: type):
        """Register a scraper class for a platform"""
        cls._scrapers[platform.lower()] = scraper_class
    
    @classmethod
    def create(cls, platform: str, **kwargs) -> ProductScraper:
        """
        Create a scraper for the specified platform.
        
        Args:
            platform: Platform name (e.g., "taobao", "tmall")
            **kwargs: Additional arguments for scraper initialization
        
        Returns:
            ProductScraper instance
        
        Raises:
            ValueError: If platform is not supported
        """
        platform = platform.lower()
        
        # Auto-detect platform from URL if needed
        if platform.startswith("http"):
            url = platform
            if "taobao.com" in url or "tmall.com" in url:
                platform = "taobao"
            else:
                raise ValueError(f"Cannot detect platform from URL: {url}")
        
        if platform not in cls._scrapers:
            raise ValueError(f"Unsupported platform: {platform}. Available: {list(cls._scrapers.keys())}")
        
        return cls._scrapers[platform](**kwargs)
    
    @classmethod
    def from_url(cls, url: str, **kwargs) -> ProductScraper:
        """
        Create a scraper based on the URL.
        
        Args:
            url: Product page URL
            **kwargs: Additional arguments for scraper initialization
        
        Returns:
            ProductScraper instance for the detected platform
        """
        return cls.create(url, **kwargs)

