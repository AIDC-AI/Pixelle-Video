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
Pydantic request/response schemas for the auth router.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

# ============================================================================
# Shared
# ============================================================================


class TokenPair(BaseModel):
    """Access + refresh token pair returned to the client."""

    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(..., description="Access token lifetime in seconds")


class UserPublic(BaseModel):
    """Public-facing user representation (no password material)."""

    id: int
    email: EmailStr
    role: Literal["user", "admin"]
    is_active: bool
    created_at: datetime


class AuthResponse(BaseModel):
    """Standard auth response: token pair + user profile."""

    user: UserPublic
    tokens: TokenPair


# ============================================================================
# Signup / Login
# ============================================================================


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=8)


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


# ============================================================================
# Password reset
# ============================================================================


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Always returns ok when the email is well-formed to avoid enumeration.

    When mail delivery fails the endpoint returns a 502 with
    code=mail_send_failed instead of this response, so the caller can
    surface a retry prompt.  On success (including when no matching
    account exists) this envelope is returned.

    The ``reset_token`` is only populated in development mode (when the
    configured JWT secret is the dev default) so the front-end team can
    exercise the reset flow without setting up an email gateway.
    """

    success: bool = True
    message: str = "If the account exists, a reset link has been sent."
    reset_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    reset_token: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


# ============================================================================
# Google OAuth
# ============================================================================


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(..., min_length=10)


# ============================================================================
# Error codes (mirrored in the Next.js client)
# ============================================================================


class AuthError(BaseModel):
    """Structured error payload for auth failures."""

    code: str
    message: str


__all__ = [
    "TokenPair",
    "UserPublic",
    "AuthResponse",
    "SignupRequest",
    "LoginRequest",
    "RefreshRequest",
    "LogoutRequest",
    "ForgotPasswordRequest",
    "ForgotPasswordResponse",
    "ResetPasswordRequest",
    "GoogleLoginRequest",
    "AuthError",
]
