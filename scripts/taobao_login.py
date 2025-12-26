# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
Taobao login and scraper utility script.

Usage:
    # First time: login and save state
    uv run python scripts/taobao_login.py --login
    
    # After login: test scraping with saved state
    uv run python scripts/taobao_login.py
"""

import asyncio
import sys
from pathlib import Path

from pixelle_video.services.ecommerce.taobao import TaobaoScraper


TEST_URL = "https://item.taobao.com/item.htm?id=730338739838"


async def do_login():
    """Interactive login to save login state"""
    print("=" * 60)
    print("Taobao Login - First Time Setup")
    print("=" * 60)
    print("\nThis will open a browser window for you to login.")
    print("After login, your session will be saved for future use.\n")
    
    scraper = TaobaoScraper(headless=False)
    
    try:
        await scraper.login_interactive()
    finally:
        await scraper.close()
    
    print("\n✅ Login complete! You can now run scraper without --login flag.")


async def test_scraper():
    """Test the TaobaoScraper"""
    print("=" * 60)
    print("Testing E-commerce Scraper Module")
    print("=" * 60)
    
    # Check for headless flag
    headless = "--no-headless" not in sys.argv
    
    if not headless:
        print("\n👁️  Running in visible mode (non-headless)\n")
    
    # Create scraper with persistent login state
    scraper = TaobaoScraper(headless=headless)
    
    print(f"\n🔐 Browser data: {scraper.user_data_dir}")
    
    try:
        # Scrape product
        output_dir = "output/ecommerce_test"
        result = await scraper.scrape(
            url=TEST_URL,
            output_dir=output_dir,
            download_images=True,
            save_html=True,
            take_screenshot=True
        )
        
        if result.success:
            product = result.product
            print("\n✅ Scraping successful!")
            print(f"   Elapsed: {result.elapsed_seconds:.2f}s")
            print(f"\n--- Product Info ---")
            print(f"   Title: {product.title}")
            print(f"   Price: {product.price}")
            print(f"   Shop: {product.shop_name}")
            print(f"   Shipping: {product.shipping}")
            print(f"   Freight: {product.freight}")
            print(f"   Main Images: {len(product.main_images)}")
            print(f"   Local Images: {len(product.local_images)}")
            
            # Show downloaded images
            if product.local_images:
                print("\n--- Downloaded Images ---")
                for path in product.local_images:
                    size = Path(path).stat().st_size // 1024
                    print(f"   {Path(path).name}: {size}KB")
        else:
            print(f"\n❌ Scraping failed: {result.error}")
            
    finally:
        await scraper.close()


async def main():
    if "--login" in sys.argv:
        await do_login()
    else:
        await test_scraper()


if __name__ == "__main__":
    asyncio.run(main())

