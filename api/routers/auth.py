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
Auth router — exposes the real authentication endpoints that the
Next.js web UI calls. Result codes mirror ``web/auth_client.py`` so
the existing front-end semantics can be reused during the cutover.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import service
from api.auth.db import get_db
from api.auth.dependencies import AdminUser, CurrentUser, OptionalCurrentUser
from api.auth.policy import role_capabilities_dict
from api.auth.schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleLoginRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    UserPublic,
)
from api.auth.security import is_dev_jwt_secret
from api.auth.config import load_auth_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


DbDep = Annotated[AsyncSession, Depends(get_db)]


# ============================================================================
# Result-code → HTTP-status mapping
# ============================================================================

# Operations that return AuthResponse on success vs those that return
# just an envelope. The mapping is centralised so the router stays thin.
_AUTH_CODES_TO_HTTP = {
    service.CODE_INVALID_INPUT: status.HTTP_400_BAD_REQUEST,
    service.CODE_INVALID_CREDENTIALS: status.HTTP_401_UNAUTHORIZED,
    service.CODE_EMAIL_EXISTS: status.HTTP_409_CONFLICT,
    service.CODE_USER_INACTIVE: status.HTTP_403_FORBIDDEN,
    service.CODE_TOKEN_INVALID: status.HTTP_401_UNAUTHORIZED,
    service.CODE_TOKEN_REVOKED: status.HTTP_401_UNAUTHORIZED,
    service.CODE_TOKEN_EXPIRED: status.HTTP_401_UNAUTHORIZED,
    service.CODE_GOOGLE_INVALID: status.HTTP_401_UNAUTHORIZED,
    service.CODE_PROVIDER_ERROR: status.HTTP_502_BAD_GATEWAY,
    service.CODE_NOT_CONFIGURED: status.HTTP_503_SERVICE_UNAVAILABLE,
}


def _raise_for_code(result: service.AuthResult) -> None:
    if result.ok:
        return
    http_status = _AUTH_CODES_TO_HTTP.get(result.code, status.HTTP_400_BAD_REQUEST)
    detail = {"code": result.code, "message": result.message or result.code}
    raise HTTPException(status_code=http_status, detail=detail)


def _resolve_reset_base_url(request: Request) -> str:
    """Derive the web client's base URL from request headers.

    Tries (in order):
      1. Config override ``password_reset_url_base`` in config.yaml auth section.
      2. ``Referer`` header (e.g. ``https://pixelle.ai/forgot-password``)
      3. ``Origin`` header (e.g. ``https://pixelle.ai``)
      4. Fallback to ``{scheme}://{host}`` (dev-mode localhost).
    """
    from urllib.parse import urlparse, urlunparse

    # Config override takes precedence (set in production for custom domains).
    settings = load_auth_settings()
    if settings.password_reset_url_base:
        return settings.password_reset_url_base.rstrip("/")

    for header in ("referer", "origin"):
        value = request.headers.get(header, "")
        if value:
            parsed = urlparse(value)
            base = urlunparse((parsed.scheme, parsed.netloc, "", "", "", ""))
            if base and parsed.scheme:
                return base

    # Last-resort fallback: the request's own URL components.
    scheme = request.url.scheme or "http"
    host = request.headers.get("host", "localhost:8501")
    return f"{scheme}://{host}"


# ============================================================================
# Endpoints
# ============================================================================


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new account",
)
async def signup_endpoint(payload: SignupRequest, db: DbDep) -> AuthResponse:
    result = await service.signup(
        db,
        email=payload.email,
        password=payload.password,
        confirm_password=payload.confirm_password,
    )
    _raise_for_code(result)
    assert result.response is not None
    logger.info(f"Signup OK: {result.response.user.email}")
    return result.response


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Sign in with email + password",
)
async def login_endpoint(payload: LoginRequest, db: DbDep) -> AuthResponse:
    result = await service.login(db, email=payload.email, password=payload.password)
    _raise_for_code(result)
    assert result.response is not None
    logger.info(f"Login OK: {result.response.user.email}")
    return result.response


@router.post(
    "/refresh",
    response_model=AuthResponse,
    summary="Rotate the refresh token and return a fresh pair",
)
async def refresh_endpoint(payload: RefreshRequest, db: DbDep) -> AuthResponse:
    result = await service.refresh_tokens(db, refresh_token=payload.refresh_token)
    _raise_for_code(result)
    assert result.response is not None
    return result.response


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Revoke the supplied refresh token (idempotent)",
)
async def logout_endpoint(payload: LogoutRequest, db: DbDep) -> Response:
    await service.logout(db, refresh_token=payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=UserPublic,
    summary="Return the profile of the currently signed-in user",
)
async def me_endpoint(user: CurrentUser) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        role=user.role if user.role in ("user", "admin") else "user",
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    summary="Request a password reset link",
)
async def forgot_password_endpoint(
    payload: ForgotPasswordRequest,
    db: DbDep,
    request: Request,
) -> ForgotPasswordResponse:
    # Derive the reset base URL from the incoming request's origin so
    # the email link points back to the same web client. The referer or
    # origin header tells us where the web client lives.
    reset_base_url = _resolve_reset_base_url(request)
    result, dev_token = await service.forgot_password(
        db, email=payload.email, reset_base_url=reset_base_url
    )
    if not result.ok:
        _raise_for_code(result)
    response = ForgotPasswordResponse()
    # Only surface the token in dev mode (default secret).
    if dev_token and is_dev_jwt_secret():
        response.reset_token = dev_token
    return response


@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Apply a new password using a valid reset token",
)
async def reset_password_endpoint(payload: ResetPasswordRequest, db: DbDep) -> Response:
    result = await service.reset_password(
        db,
        reset_token=payload.reset_token,
        new_password=payload.new_password,
        confirm_password=payload.confirm_password,
    )
    _raise_for_code(result)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/google",
    response_model=AuthResponse,
    summary="Sign in with a Google id_token (requires Google OAuth configuration)",
)
async def google_endpoint(payload: GoogleLoginRequest, db: DbDep) -> AuthResponse:
    result = await service.google_login(db, id_token=payload.id_token)
    _raise_for_code(result)
    assert result.response is not None
    return result.response


# ============================================================================
# Admin-only helpers (used by the /admin page in the Next.js client)
# ============================================================================


@router.get(
    "/admin/users",
    response_model=list[UserPublic],
    summary="[admin] List all users",
)
async def list_users_endpoint(
    _admin: AdminUser, db: DbDep
) -> list[UserPublic]:
    return await service.list_users(db)


# Quiet down the unused-import warning from the typing-only alias above.
_ = OptionalCurrentUser


# ============================================================================
# Capabilities endpoint — expose the centralised policy to the web client
# ============================================================================


@router.get(
    "/capabilities",
    response_model=dict,
    summary="Return the role→capability mapping used by the API",
)
async def capabilities_endpoint() -> dict:
    """Expose the centralised authorization policy (AC13, AC14).

    The Next.js client can use this to derive visible navigation items,
    route guards, and feature flags from the same capability names the
    API enforces.
    """
    from api.auth.policy import DEFAULT_SELF_SIGNUP_ROLE, role_capabilities_dict

    return {
        "default_signup_role": DEFAULT_SELF_SIGNUP_ROLE,
        "role_capabilities": role_capabilities_dict(),
    }
