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
Pixelle-Video Auth Backend

Real authentication for the Next.js web UI. Provides:

- Email + password signup and login with bcrypt hashing.
- Short-lived access tokens (JWT) and rotating refresh tokens stored
  in the database so they can be revoked.
- Password reset via short-lived stateless JWT.
- Optional Google OAuth (id_token verification) when configured.
- Role-based dependencies (require_role) compatible with FastAPI
  Depends injection.

The auth subsystem owns its own SQLite database at ``data/auth.db``
(default) and never touches the video generation core.
"""

from api.auth import service
from api.auth.config import AuthSettings, load_auth_settings
from api.auth.db import (
    dispose_engine,
    get_db,
    get_engine,
    get_sessionmaker,
    init_db,
    init_engine,
    session_scope,
)
from api.auth.dependencies import (
    AdminUser,
    CurrentUser,
    OptionalCurrentUser,
    get_current_user,
    get_optional_current_user,
    require_admin,
    require_capability,
)
from api.auth.policy import (
    ADMIN_VIEW,
    ALL_CAPABILITIES,
    CONTENT_GENERATE,
    DEFAULT_SELF_SIGNUP_ROLE,
    FRAME_RENDER,
    IMAGE_GENERATE,
    LLM_CHAT,
    ROLE_CAPABILITIES,
    SETTINGS_MANAGE,
    TASKS_MANAGE,
    TTS_SYNTHESIZE,
    VIDEO_GENERATE,
    capabilities_for_role,
    has_capability,
    role_capabilities_dict,
)
from api.auth.models import (
    ROLE_ADMIN,
    ROLE_USER,
    VALID_ROLES,
    Base,
    RefreshToken,
    User,
)
from api.auth.schemas import (
    AuthError,
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleLoginRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenPair,
    UserPublic,
)
from api.auth.security import (
    decode_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    is_dev_jwt_secret,
    issue_access_token,
    issue_password_reset_token,
    password_meets_policy,
    verify_password,
)

__all__ = [
    # config
    "AuthSettings",
    "load_auth_settings",
    # db
    "init_engine",
    "get_engine",
    "get_sessionmaker",
    "session_scope",
    "get_db",
    "init_db",
    "dispose_engine",
    # service
    "service",
    # dependencies
    "get_current_user",
    "get_optional_current_user",
    "require_admin",
    "require_capability",
    "CurrentUser",
    "OptionalCurrentUser",
    "AdminUser",
    # policy
    "ROLE_CAPABILITIES",
    "ALL_CAPABILITIES",
    "DEFAULT_SELF_SIGNUP_ROLE",
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
    # models
    "Base",
    "User",
    "RefreshToken",
    "ROLE_USER",
    "ROLE_ADMIN",
    "VALID_ROLES",
    # schemas
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
    # security
    "hash_password",
    "verify_password",
    "password_meets_policy",
    "generate_refresh_token",
    "hash_refresh_token",
    "issue_access_token",
    "issue_password_reset_token",
    "decode_token",
    "is_dev_jwt_secret",
]
