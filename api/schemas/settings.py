# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");

"""
Settings API schemas
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class SettingsPayload(BaseModel):
    llm: Optional[Dict[str, Any]] = Field(None, description="LLM settings")
    comfyui: Optional[Dict[str, Any]] = Field(None, description="ComfyUI settings")
    appearance: Optional[Dict[str, Any]] = Field(None, description="Appearance settings")
    storage: Optional[Dict[str, Any]] = Field(None, description="Storage settings")

