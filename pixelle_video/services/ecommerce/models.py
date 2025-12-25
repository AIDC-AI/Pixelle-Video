# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0

"""
Data models for e-commerce product information.
"""

from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class ProductImage(BaseModel):
    """Product image with metadata"""
    url: str = Field(description="Original image URL")
    local_path: Optional[str] = Field(default=None, description="Local file path after download")
    width: Optional[int] = Field(default=None, description="Image width in pixels")
    height: Optional[int] = Field(default=None, description="Image height in pixels")
    is_main: bool = Field(default=False, description="Whether this is a main product image")


class ProductInfo(BaseModel):
    """
    Product information extracted from e-commerce platform.
    
    This model represents the structured data we can extract from
    a product detail page.
    """
    # Source information
    url: str = Field(description="Original product page URL")
    platform: str = Field(default="taobao", description="E-commerce platform (taobao, tmall, etc.)")
    product_id: Optional[str] = Field(default=None, description="Platform-specific product ID")
    
    # Basic product info
    title: str = Field(description="Product title")
    price: Optional[str] = Field(default=None, description="Current price")
    original_price: Optional[str] = Field(default=None, description="Original price before discount")
    
    # Shop info
    shop_name: Optional[str] = Field(default=None, description="Shop/store name")
    shop_url: Optional[str] = Field(default=None, description="Shop URL")
    
    # Images
    main_images: List[str] = Field(default_factory=list, description="Main product image URLs")
    detail_images: List[str] = Field(default_factory=list, description="Detail/description image URLs")
    local_images: List[str] = Field(default_factory=list, description="Downloaded local image paths")
    
    # Additional info
    shipping: Optional[str] = Field(default=None, description="Shipping info (e.g., delivery time)")
    freight: Optional[str] = Field(default=None, description="Freight/shipping cost")
    sales: Optional[str] = Field(default=None, description="Sales count")
    rating: Optional[str] = Field(default=None, description="Product rating")
    review_count: Optional[str] = Field(default=None, description="Number of reviews")
    
    # Product details
    description: Optional[str] = Field(default=None, description="Product description/subtitle")
    highlights: List[str] = Field(default_factory=list, description="Product highlights/selling points")
    specifications: Dict[str, str] = Field(default_factory=dict, description="Product specifications")
    services: List[str] = Field(default_factory=list, description="Service guarantees (e.g., 7-day return)")
    promotions: List[str] = Field(default_factory=list, description="Current promotions/discounts")
    
    # SKU options (may be empty without login)
    sku_options: Dict[str, List[str]] = Field(
        default_factory=dict, 
        description="SKU options like color, size. Key is category name, value is list of options"
    )
    
    # Analysis results (filled by LLM later)
    image_descriptions: List[str] = Field(
        default_factory=list,
        description="LLM-generated descriptions for each main image"
    )
    
    # Raw data for debugging
    raw_html_path: Optional[str] = Field(default=None, description="Path to saved HTML file")
    raw_json_path: Optional[str] = Field(default=None, description="Path to saved JSON file")
    screenshot_path: Optional[str] = Field(default=None, description="Path to page screenshot")


class ScrapeResult(BaseModel):
    """Result of a scraping operation"""
    success: bool = Field(description="Whether scraping was successful")
    product: Optional[ProductInfo] = Field(default=None, description="Extracted product info")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    elapsed_seconds: float = Field(default=0.0, description="Time taken for scraping")

