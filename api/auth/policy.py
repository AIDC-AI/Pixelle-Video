# Copyright (C) 2025 AIDC-AI
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Centralized Authorization Policy

Defines capabilities and maps roles to capabilities. This is the single source
of truth for authorization decisions — both the API dependency layer and the
Next.js web client should derive their behavior from this module.

Architecture:
- **Capabilities** are granular, named permissions (e.g. ``video:generate``).
- **Roles** are collections of capabilities. A role is just a label assigned
  to a user; the actual access decisions are capability-based.
- Adding a new role requires only adding an entry to ``ROLE_CAPABILITIES``
  — no guard logic changes anywhere in the codebase.

See :ref:`docs/ai/specs/auth-authorization-foundation.md` for the product
requirements this module fulfills (AC12, AC13, AC14).
"""

from __future__ import annotations

from typing import Dict, FrozenSet

# ============================================================================
# Capability constants
# ============================================================================

# Core video generation flows
VIDEO_GENERATE = "video:generate"

# Content generation (narrations, prompts, titles)
CONTENT_GENERATE = "content:generate"

# Frame/template rendering
FRAME_RENDER = "frame:render"

# Standalone image generation
IMAGE_GENERATE = "image:generate"

# Text-to-speech
TTS_SYNTHESIZE = "tts:synthesize"

# LLM chat
LLM_CHAT = "llm:chat"

# Task lifecycle management
TASKS_MANAGE = "tasks:manage"

# Config / settings management (LLM keys, ComfyUI, API providers)
SETTINGS_MANAGE = "settings:manage"

# Admin area (user listing, future admin features)
ADMIN_VIEW = "admin:view"

ALL_CAPABILITIES: FrozenSet[str] = frozenset(
    {
        VIDEO_GENERATE,
        CONTENT_GENERATE,
        FRAME_RENDER,
        IMAGE_GENERATE,
        TTS_SYNTHESIZE,
        LLM_CHAT,
        TASKS_MANAGE,
        SETTINGS_MANAGE,
        ADMIN_VIEW,
    }
)

# ============================================================================
# Role → Capability mapping
# ============================================================================

# Default role assigned on self-registration. Must exist in ROLE_CAPABILITIES.
DEFAULT_SELF_SIGNUP_ROLE = "user"

ROLE_CAPABILITIES: Dict[str, FrozenSet[str]] = {
    # Regular user: can generate content but not manage system config
    # or view admin data.
    "user": frozenset(
        {
            VIDEO_GENERATE,
            CONTENT_GENERATE,
            FRAME_RENDER,
            IMAGE_GENERATE,
            TTS_SYNTHESIZE,
            LLM_CHAT,
            TASKS_MANAGE,
        }
    ),
    # Admin: full access, including settings and admin views.
    "admin": frozenset(ALL_CAPABILITIES),
}

# ============================================================================
# Policy query functions
# ============================================================================


def has_capability(role: str, capability: str) -> bool:
    """Return True if *role* possesses *capability*."""
    caps = ROLE_CAPABILITIES.get(role)
    if caps is None:
        return False
    return capability in caps


def capabilities_for_role(role: str) -> FrozenSet[str]:
    """Return the full set of capabilities granted to *role*."""
    return ROLE_CAPABILITIES.get(role, frozenset())


def role_capabilities_dict() -> Dict[str, list[str]]:
    """Return a JSON-serialisable dict mapping role → sorted capability list.

    Useful for exposing the policy to the frontend (e.g. via an
    ``/api/auth/capabilities`` endpoint) so the Next.js client and the API
    share the same conceptual authorization surface (AC14).
    """
    return {
        role: sorted(caps) for role, caps in ROLE_CAPABILITIES.items()
    }


# ============================================================================
# Exports
# ============================================================================

__all__ = [
    "ALL_CAPABILITIES",
    "DEFAULT_SELF_SIGNUP_ROLE",
    "ROLE_CAPABILITIES",
    "VIDEO_GENERATE",
    "CONTENT_GENERATE",
    "FRAME_RENDER",
    "IMAGE_GENERATE",
    "TTS_SYNTHESIZE",
    "LLM_CHAT",
    "TASKS_MANAGE",
    "SETTINGS_MANAGE",
    "ADMIN_VIEW",
    "has_capability",
    "capabilities_for_role",
    "role_capabilities_dict",
]
