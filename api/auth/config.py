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
Auth configuration loader.

Reads from the project-level ``config.yaml`` (via ``pixelle_video.config``)
and applies environment variable overrides for deployment convenience.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from loguru import logger

try:
    from pixelle_video.config import config_manager
except Exception:  # pragma: no cover - keep import tolerant
    config_manager = None  # type: ignore[assignment]


def _resolve_auth_section() -> dict:
    """Return the ``auth`` section of config.yaml, or ``{}`` if missing."""
    if config_manager is None:
        return {}
    try:
        cfg = config_manager.config.to_dict()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(f"Auth config: failed to read config_manager: {exc}")
        return {}
    return cfg.get("auth", {}) or {}


@dataclass(frozen=True)
class AuthSettings:
    """Resolved auth settings with env-var overrides applied."""

    jwt_secret: str
    jwt_algorithm: str
    access_token_ttl_seconds: int
    refresh_token_ttl_seconds: int
    password_reset_ttl_seconds: int
    auth_db_path: str
    default_admin_email: str
    default_admin_password: str
    google_client_id: str
    google_enabled: bool
    # Mail / SMTP
    mail_smtp_host: str
    mail_smtp_port: int
    mail_use_tls: bool
    mail_smtp_user: str
    mail_smtp_password: str
    mail_from_email: str
    mail_from_name: str
    password_reset_url_base: str

    @property
    def google_configured(self) -> bool:
        return bool(self.google_enabled and self.google_client_id.strip())

    @property
    def mail_configured(self) -> bool:
        return bool(self.mail_smtp_host.strip() and self.mail_from_email.strip())


def load_auth_settings() -> AuthSettings:
    """Build an :class:`AuthSettings` from config + env vars."""
    section = _resolve_auth_section()
    default_admin = section.get("default_admin", {}) or {}
    google = section.get("google", {}) or {}

    mail = section.get("mail", {}) or {}

    return AuthSettings(
        jwt_secret=os.environ.get("JWT_SECRET", section.get("jwt_secret", "change-me")),
        jwt_algorithm=os.environ.get("JWT_ALGORITHM", section.get("jwt_algorithm", "HS256")),
        access_token_ttl_seconds=int(
            os.environ.get("ACCESS_TOKEN_TTL", section.get("access_token_ttl_seconds", 3600))
        ),
        refresh_token_ttl_seconds=int(
            os.environ.get("REFRESH_TOKEN_TTL", section.get("refresh_token_ttl_seconds", 2592000))
        ),
        password_reset_ttl_seconds=int(
            os.environ.get("PASSWORD_RESET_TTL", section.get("password_reset_ttl_seconds", 600))
        ),
        auth_db_path=os.environ.get("AUTH_DB_PATH", section.get("auth_db_path", "data/auth.db")),
        default_admin_email=os.environ.get(
            "DEFAULT_ADMIN_EMAIL", default_admin.get("email", "admin@pixelle.ai")
        ),
        default_admin_password=os.environ.get(
            "DEFAULT_ADMIN_PASSWORD", default_admin.get("password", "Admin1234")
        ),
        google_client_id=os.environ.get("GOOGLE_CLIENT_ID", google.get("client_id", "")),
        google_enabled=bool(
            os.environ.get("GOOGLE_ENABLED", str(google.get("enabled", False))).lower()
            in ("1", "true", "yes", "on")
        ),
        mail_smtp_host=os.environ.get("MAIL_SMTP_HOST", mail.get("smtp_host", "")),
        mail_smtp_port=int(os.environ.get("MAIL_SMTP_PORT", mail.get("smtp_port", 587))),
        mail_use_tls=os.environ.get("MAIL_USE_TLS", str(mail.get("use_tls", True))).lower() in ("1", "true", "yes", "on"),
        mail_smtp_user=os.environ.get("MAIL_SMTP_USER", mail.get("smtp_user", "")),
        mail_smtp_password=os.environ.get("MAIL_SMTP_PASSWORD", mail.get("smtp_password", "")),
        mail_from_email=os.environ.get("MAIL_FROM_EMAIL", mail.get("from_email", "")),
        mail_from_name=os.environ.get("MAIL_FROM_NAME", mail.get("from_name", "Pixelle-Video")),
        password_reset_url_base=os.environ.get(
            "PASSWORD_RESET_URL_BASE", section.get("password_reset_url_base", "")
        ),
    )


def ensure_db_dir(db_path: str) -> None:
    """Create the parent directory for the SQLite file if needed."""
    Path(db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)


__all__ = ["AuthSettings", "load_auth_settings", "ensure_db_dir"]
