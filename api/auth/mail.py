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
Mail delivery infrastructure.

Encapsulates SMTP communication so auth controllers never deal with
socket details. All sending is async (run-in-executor) while the rest
of the auth pipeline stays fully async.
"""

from __future__ import annotations

import asyncio
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from loguru import logger

from api.auth.config import load_auth_settings

RESET_EMAIL_SUBJECT = "Reset your Pixelle-Video password"


def _build_reset_email(to_email: str, reset_link: str) -> MIMEMultipart:
    settings = load_auth_settings()
    ttl_minutes = settings.password_reset_ttl_seconds // 60

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.mail_from_name} <{settings.mail_from_email}>"
    msg["To"] = to_email
    msg["Subject"] = RESET_EMAIL_SUBJECT

    plain = (
        f"Hello,\n\n"
        f"You requested a password reset for your Pixelle-Video account.\n\n"
        f"Click the link below to reset your password:\n"
        f"{reset_link}\n\n"
        f"This link expires in {ttl_minutes} minute{'s' if ttl_minutes != 1 else ''}.\n\n"
        f"If you did not request this, please ignore this email.\n\n"
        f"— Pixelle-Video"
    )

    msg.attach(MIMEText(plain, "plain"))
    return msg


def _do_send(msg: MIMEMultipart) -> None:
    """Synchronous SMTP send — called via ``asyncio.to_thread``."""
    settings = load_auth_settings()

    context = ssl.create_default_context()
    server = smtplib.SMTP(
        settings.mail_smtp_host,
        settings.mail_smtp_port,
        timeout=10,
    )
    try:
        if settings.mail_use_tls:
            server.starttls(context=context)
        if settings.mail_smtp_user:
            server.login(settings.mail_smtp_user, settings.mail_smtp_password)
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:  # pragma: no cover - best-effort
            pass


async def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    """Send a password-reset email via SMTP.

    Returns True on success, False on any delivery failure.
    Does NOT raise — callers handle the boolean result.
    """
    settings = load_auth_settings()
    if not settings.mail_configured:
        logger.debug("Mail not configured; skipping password-reset email")
        return False

    msg = _build_reset_email(to_email, reset_link)
    try:
        await asyncio.to_thread(_do_send, msg)
        logger.info(f"Password-reset email sent to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send password-reset email to {to_email}: {exc}")
        return False


__all__ = ["send_password_reset_email"]
