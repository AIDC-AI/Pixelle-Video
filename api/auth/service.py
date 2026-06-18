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
Business logic for the auth subsystem: signup, login, refresh, password
reset, and Google OAuth. The router delegates all of these to functions
in this module so the rules live in one place.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import jwt
from loguru import logger
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth.config import load_auth_settings
from api.auth.mail import send_password_reset_email
from api.auth.models import ROLE_ADMIN, ROLE_USER, PasswordResetToken, RefreshToken, User
from api.auth.schemas import AuthResponse, TokenPair, UserPublic
from api.auth.security import (
    decode_token,
    generate_refresh_token,
    hash_password,
    hash_password_reset_token,
    hash_refresh_token,
    issue_access_token,
    issue_password_reset_token,
    password_meets_policy,
    verify_password,
)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Result codes — kept as plain strings so the Next.js client can map them.
CODE_OK = "ok"
CODE_INVALID_INPUT = "invalid_input"
CODE_INVALID_CREDENTIALS = "invalid_credentials"
CODE_EMAIL_EXISTS = "email_exists"
CODE_USER_INACTIVE = "user_inactive"
CODE_TOKEN_INVALID = "token_invalid"
CODE_TOKEN_REVOKED = "token_revoked"
CODE_TOKEN_EXPIRED = "token_expired"
CODE_NOT_CONFIGURED = "not_configured"
CODE_GOOGLE_INVALID = "google_invalid"
CODE_PROVIDER_ERROR = "provider_error"


@dataclass(frozen=True)
class AuthResult:
    """Uniform return shape for every service entry point.

    Attributes:
        code: One of the CODE_* constants. ``ok`` on success.
        response: Fully-built :class:`AuthResponse` on success.
        message: Optional human-readable detail; safe to surface to users.
        access_token / refresh_token: Set on the few flows that only need
            a token (e.g. refresh). ``None`` otherwise.
    """

    code: str
    response: Optional[AuthResponse] = None
    message: Optional[str] = None
    access_token: Optional[str] = None
    expires_in: Optional[int] = None
    refresh_token: Optional[str] = None

    @property
    def ok(self) -> bool:
        return self.code == CODE_OK


# ============================================================================
# Helpers
# ============================================================================


def _to_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        role=user.role if user.role in (ROLE_USER, ROLE_ADMIN) else ROLE_USER,
        is_active=user.is_active,
        created_at=user.created_at,
    )


async def _issue_token_pair(
    db: AsyncSession, user: User
) -> tuple[TokenPair, str, str]:
    """Create an access JWT, persist a refresh token, and return both."""
    settings = load_auth_settings()
    access_token, ttl = issue_access_token(user.id, user.email, user.role)
    raw_refresh = generate_refresh_token()
    refresh = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=datetime.now(tz=timezone.utc)
        + timedelta_from_seconds(settings.refresh_token_ttl_seconds),
    )
    db.add(refresh)
    await db.flush()
    pair = TokenPair(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=ttl,
    )
    return pair, access_token, raw_refresh


def timedelta_from_seconds(seconds: int):
    from datetime import timedelta

    return timedelta(seconds=seconds)


def reset_base_url_param(token: str) -> str:
    """URL-safe percent-encoding for the reset token in a query string."""
    from urllib.parse import quote

    return quote(token, safe="")


# ============================================================================
# Signup
# ============================================================================


async def signup(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    confirm_password: str,
) -> AuthResult:
    email_norm = email.strip().lower()
    if not EMAIL_REGEX.match(email_norm):
        return AuthResult(code=CODE_INVALID_INPUT, message="email_invalid")
    if not password_meets_policy(password):
        return AuthResult(code=CODE_INVALID_INPUT, message="password_policy")
    if password != confirm_password:
        return AuthResult(code=CODE_INVALID_INPUT, message="password_mismatch")

    existing = await db.scalar(select(User).where(User.email == email_norm))
    if existing is not None:
        return AuthResult(code=CODE_EMAIL_EXISTS)

    user = User(
        email=email_norm,
        password_hash=hash_password(password),
        role=ROLE_USER,
        is_active=True,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return AuthResult(code=CODE_EMAIL_EXISTS)

    pair, _access, _refresh = await _issue_token_pair(db, user)
    return AuthResult(
        code=CODE_OK,
        response=AuthResponse(user=_to_public(user), tokens=pair),
    )


# ============================================================================
# Login
# ============================================================================


async def login(db: AsyncSession, *, email: str, password: str) -> AuthResult:
    email_norm = email.strip().lower()
    if not EMAIL_REGEX.match(email_norm) or not password:
        return AuthResult(code=CODE_INVALID_INPUT)

    user = await db.scalar(select(User).where(User.email == email_norm))
    if user is None or not verify_password(password, user.password_hash or ""):
        return AuthResult(code=CODE_INVALID_CREDENTIALS)
    if not user.is_active:
        return AuthResult(code=CODE_USER_INACTIVE)

    pair, _access, _refresh = await _issue_token_pair(db, user)
    return AuthResult(
        code=CODE_OK,
        response=AuthResponse(user=_to_public(user), tokens=pair),
    )


# ============================================================================
# Refresh
# ============================================================================


async def refresh_tokens(db: AsyncSession, *, refresh_token: str) -> AuthResult:
    if not refresh_token or len(refresh_token) < 8:
        return AuthResult(code=CODE_INVALID_INPUT)

    token_hash = hash_refresh_token(refresh_token)
    record = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if record is None:
        return AuthResult(code=CODE_TOKEN_INVALID)
    if record.revoked:
        return AuthResult(code=CODE_TOKEN_REVOKED)
    # SQLite strips timezone info from datetimes, so we normalise both
    # sides to naive UTC before comparing.
    expires_at = record.expires_at
    if expires_at.tzinfo is not None:
        expires_at = expires_at.replace(tzinfo=None)
    if expires_at <= datetime.now(tz=timezone.utc).replace(tzinfo=None):
        return AuthResult(code=CODE_TOKEN_EXPIRED)

    user = await db.get(User, record.user_id)
    if user is None or not user.is_active:
        return AuthResult(code=CODE_USER_INACTIVE)

    # Rotate: revoke the old token, issue a fresh pair.
    record.revoked = True
    pair, _access, _refresh = await _issue_token_pair(db, user)
    return AuthResult(
        code=CODE_OK,
        response=AuthResponse(user=_to_public(user), tokens=pair),
    )


# ============================================================================
# Logout
# ============================================================================


async def logout(db: AsyncSession, *, refresh_token: Optional[str]) -> AuthResult:
    if not refresh_token:
        return AuthResult(code=CODE_OK)
    token_hash = hash_refresh_token(refresh_token)
    record = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if record is not None and not record.revoked:
        record.revoked = True
    return AuthResult(code=CODE_OK)


# ============================================================================
# Password reset
# ============================================================================


async def forgot_password(
    db: AsyncSession,
    *,
    email: str,
    reset_base_url: str = "",
) -> tuple[AuthResult, Optional[str]]:
    """Process a forgot-password request.

    Returns ``(AuthResult, dev_reset_token_or_none)``.

    When a matching active account with a password exists:
      - A JWT reset token is issued and its hash is recorded for single-use.
      - An email is sent via the mail delivery layer.
      - On mail failure, the caller receives a ``CODE_PROVIDER_ERROR``
        result so the UI can show a retry prompt.

    When no matching account exists the response is still ``CODE_OK`` to
    avoid email enumeration. The dev token is surfaced only when the JWT
    secret is the dev default.
    """
    email_norm = email.strip().lower()
    if not EMAIL_REGEX.match(email_norm):
        return AuthResult(code=CODE_INVALID_INPUT, message="email_invalid"), None

    user = await db.scalar(select(User).where(User.email == email_norm))

    # Only issue + send if the account is active and has a password.
    # Accounts created via Google (password_hash is None) cannot reset via email.
    if user is not None and user.is_active and user.password_hash is not None:
        reset_token = issue_password_reset_token(user.id, user.email)

        # Record token hash for single-use enforcement.
        record = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_password_reset_token(reset_token),
        )
        db.add(record)
        await db.flush()

        # Build the reset link.
        if reset_base_url:
            link = f"{reset_base_url.rstrip('/')}/reset-password?token={reset_base_url_param(reset_token)}"
        else:
            link = ""

        # Send email.
        mail_ok = await send_password_reset_email(user.email, link)
        if not mail_ok:
            # Clean up the token record — no email went out.
            await db.delete(record)
            await db.flush()
            return AuthResult(
                code=CODE_PROVIDER_ERROR,
                message="mail_send_failed",
            ), None

        # In dev mode, surface the token for testing without real email.
        from api.auth.security import is_dev_jwt_secret

        dev_token: Optional[str] = reset_token if is_dev_jwt_secret() else None
        return AuthResult(code=CODE_OK), dev_token

    # No matching user — still return ok to avoid enumeration.
    return AuthResult(code=CODE_OK), None


async def reset_password(
    db: AsyncSession,
    *,
    reset_token: str,
    new_password: str,
    confirm_password: str,
) -> AuthResult:
    if new_password != confirm_password:
        return AuthResult(code=CODE_INVALID_INPUT, message="password_mismatch")
    if not password_meets_policy(new_password):
        return AuthResult(code=CODE_INVALID_INPUT, message="password_policy")

    # Validate the JWT first.
    try:
        claims = decode_token(reset_token, expected_kind="password_reset")
    except jwt.ExpiredSignatureError:
        return AuthResult(code=CODE_TOKEN_EXPIRED)
    except jwt.PyJWTError as exc:
        logger.info(f"reset_password: invalid token ({exc})")
        return AuthResult(code=CODE_TOKEN_INVALID)

    user_id = int(claims["sub"])
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        return AuthResult(code=CODE_USER_INACTIVE)

    # Single-use check: if the token hash is already marked used, reject.
    token_hash = hash_password_reset_token(reset_token)
    existing = await db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    if existing is None:
        # Token was never issued (or was cleaned up after email failure).
        return AuthResult(code=CODE_TOKEN_INVALID)
    if existing.used:
        return AuthResult(code=CODE_TOKEN_INVALID, message="token_already_used")

    existing.used = True
    user.password_hash = hash_password(new_password)

    # Revoke all outstanding refresh tokens for safety — old sessions die.
    rtokens = await db.scalars(
        select(RefreshToken).where(RefreshToken.user_id == user.id)
    )
    for t in rtokens:
        t.revoked = True

    return AuthResult(code=CODE_OK)


# ============================================================================
# Google OAuth
# ============================================================================


async def google_login(db: AsyncSession, *, id_token: str) -> AuthResult:
    settings = load_auth_settings()
    if not settings.google_configured:
        return AuthResult(code=CODE_NOT_CONFIGURED)

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token
    except ImportError:  # pragma: no cover - optional dep
        logger.error("google-auth is not installed but Google login was attempted")
        return AuthResult(code=CODE_NOT_CONFIGURED)

    try:
        idinfo = google_id_token.verify_oauth2_token(
            id_token, google_requests.Request(), settings.google_client_id
        )
    except Exception as exc:
        logger.info(f"google_login: token verification failed: {exc}")
        return AuthResult(code=CODE_GOOGLE_INVALID)

    email = (idinfo.get("email") or "").strip().lower()
    sub = idinfo.get("sub") or ""
    if not email or not sub or not idinfo.get("email_verified", False):
        return AuthResult(code=CODE_GOOGLE_INVALID)

    user = await db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            password_hash=None,
            google_sub=sub,
            role=ROLE_USER,
            is_active=True,
        )
        db.add(user)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            return AuthResult(code=CODE_PROVIDER_ERROR)
    else:
        # Link the Google subject if it was not linked before.
        if not user.google_sub:
            user.google_sub = sub
        if not user.is_active:
            return AuthResult(code=CODE_USER_INACTIVE)

    pair, _access, _refresh = await _issue_token_pair(db, user)
    return AuthResult(
        code=CODE_OK,
        response=AuthResponse(user=_to_public(user), tokens=pair),
    )


# ============================================================================
# Admin helpers
# ============================================================================


async def list_users(db: AsyncSession) -> list[UserPublic]:
    """Return all users ordered by creation date (newest first)."""
    users = (await db.scalars(select(User).order_by(User.created_at.desc()))).all()
    return [
        UserPublic(
            id=u.id,
            email=u.email,
            role=u.role if u.role in (ROLE_USER, ROLE_ADMIN) else ROLE_USER,
            is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in users
    ]


# ============================================================================
# Admin seeding
# ============================================================================


async def seed_default_admin(db: AsyncSession) -> None:
    """Create the configured default admin if it does not exist."""
    settings = load_auth_settings()
    email_norm = settings.default_admin_email.strip().lower()
    if not email_norm:
        return

    user = await db.scalar(select(User).where(User.email == email_norm))
    if user is not None:
        # Promote to admin if the seed says so.
        if user.role != ROLE_ADMIN:
            user.role = ROLE_ADMIN
            logger.info(f"Promoted existing user {email_norm} to admin")
        return

    user = User(
        email=email_norm,
        password_hash=hash_password(settings.default_admin_password),
        role=ROLE_ADMIN,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    logger.info(f"Seeded default admin user {email_norm}")


__all__ = [
    "AuthResult",
    "CODE_OK",
    "CODE_INVALID_INPUT",
    "CODE_INVALID_CREDENTIALS",
    "CODE_EMAIL_EXISTS",
    "CODE_USER_INACTIVE",
    "CODE_TOKEN_INVALID",
    "CODE_TOKEN_REVOKED",
    "CODE_TOKEN_EXPIRED",
    "CODE_NOT_CONFIGURED",
    "CODE_GOOGLE_INVALID",
    "CODE_PROVIDER_ERROR",
    "signup",
    "login",
    "refresh_tokens",
    "logout",
    "forgot_password",
    "reset_password",
    "google_login",
    "seed_default_admin",
    "list_users",
    "is_dev_jwt_secret",
]
