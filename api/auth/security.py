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
Password hashing and JWT helpers.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
from loguru import logger
from passlib.context import CryptContext

from api.auth.config import load_auth_settings

# bcrypt is the default; argon2 would be a future-proof alternative.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ============================================================================
# Password hashing
# ============================================================================


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return _pwd_context.verify(plain, hashed)
    except Exception:  # pragma: no cover - malformed hash
        return False


# ============================================================================
# Password policy
# ============================================================================


def password_meets_policy(password: str) -> bool:
    """Minimum 8 chars with at least one letter and one digit."""
    if not isinstance(password, str):
        return False
    if len(password) < 8 or len(password) > 128:
        return False
    has_letter = any(c.isalpha() for c in password)
    has_digit = any(c.isdigit() for c in password)
    return has_letter and has_digit


# ============================================================================
# Refresh-token helpers
# ============================================================================


def generate_refresh_token() -> str:
    """Return a 256-bit URL-safe opaque token."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password_reset_token(token: str) -> str:
    """Hash a password-reset JWT for single-use tracking."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ============================================================================
# JWT
# ============================================================================


TokenKind = Literal["access", "refresh_jwt", "password_reset"]


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _build_claims(
    *,
    sub: str,
    kind: TokenKind,
    ttl_seconds: int,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    issued = _now()
    expires = issued + timedelta(seconds=ttl_seconds)
    claims: dict[str, Any] = {
        "sub": sub,
        "kind": kind,
        "iat": int(issued.timestamp()),
        "exp": int(expires.timestamp()),
    }
    if extra:
        claims.update(extra)
    return claims


def issue_access_token(user_id: int, email: str, role: str) -> tuple[str, int]:
    """Return (token, ttl_seconds)."""
    settings = load_auth_settings()
    claims = _build_claims(
        sub=str(user_id),
        kind="access",
        ttl_seconds=settings.access_token_ttl_seconds,
        extra={"email": email, "role": role},
    )
    token = jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, settings.access_token_ttl_seconds


def issue_password_reset_token(user_id: int, email: str) -> str:
    settings = load_auth_settings()
    claims = _build_claims(
        sub=str(user_id),
        kind="password_reset",
        ttl_seconds=settings.password_reset_ttl_seconds,
        extra={"email": email},
    )
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, *, expected_kind: TokenKind) -> dict[str, Any]:
    """Decode and verify a JWT, raising :class:`jwt.PyJWTError` on failure."""
    settings = load_auth_settings()
    claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if claims.get("kind") != expected_kind:
        raise jwt.InvalidTokenError(f"unexpected token kind: {claims.get('kind')}")
    return claims


# ============================================================================
# Dev-mode token surface
# ============================================================================


def is_dev_jwt_secret() -> bool:
    """Return True when the configured secret is the development default.

    Used to expose reset tokens in dev for the front-end team to test
    the reset flow end-to-end without a real email gateway.
    """
    return load_auth_settings().jwt_secret == "change-me"


__all__ = [
    "hash_password",
    "verify_password",
    "password_meets_policy",
    "generate_refresh_token",
    "hash_refresh_token",
    "hash_password_reset_token",
    "issue_access_token",
    "issue_password_reset_token",
    "decode_token",
    "is_dev_jwt_secret",
    "TokenKind",
]


# Quiet down a noisy loguru import (placeholder for future audit logs).
_ = logger
