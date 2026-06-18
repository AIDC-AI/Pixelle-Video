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
FastAPI dependencies for the auth subsystem.
"""

from __future__ import annotations

from typing import Annotated, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth.db import get_db
from api.auth.models import ROLE_ADMIN, User
from api.auth.security import decode_token

# tokenUrl is the OpenAPI hint for the Swagger UI's "Authorize" button.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if not token:
        raise _unauthorized("missing bearer token")
    try:
        claims = decode_token(token, expected_kind="access")
    except jwt.ExpiredSignatureError:
        raise _unauthorized("token expired")
    except jwt.PyJWTError as exc:
        logger.info(f"get_current_user: invalid token ({exc})")
        raise _unauthorized("invalid token")

    user = await db.get(User, int(claims["sub"]))
    if user is None or not user.is_active:
        raise _unauthorized("user not found or inactive")
    return user


async def get_optional_current_user(
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Optional[User]:
    """Return the user when a valid token is provided, else None."""
    if not token:
        return None
    try:
        return await get_current_user(token=token, db=db)
    except HTTPException:
        return None


async def require_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin role required",
        )
    return user


def require_capability(capability: str):
    """Factory that returns a FastAPI dependency requiring a specific capability.

    Usage::

        from api.auth import SETTINGS_MANAGE, require_capability

        router = APIRouter()

        @router.get("/config")
        async def get_config(
            _user: Annotated[User, Depends(require_capability(SETTINGS_MANAGE))],
        ):
            ...

    This is the primary guard for API endpoints — it checks the user's role
    against the centralized policy in ``api.auth.policy`` rather than
    hard-coding role comparisons per endpoint (AC12).
    """
    from api.auth.policy import has_capability

    async def _guard(user: Annotated[User, Depends(get_current_user)]) -> User:
        if not has_capability(user.role, capability):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"missing capability: {capability}",
            )
        return user

    return _guard


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalCurrentUser = Annotated[Optional[User], Depends(get_optional_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]


__all__ = [
    "get_current_user",
    "get_optional_current_user",
    "require_admin",
    "require_capability",
    "CurrentUser",
    "OptionalCurrentUser",
    "AdminUser",
    "oauth2_scheme",
]
