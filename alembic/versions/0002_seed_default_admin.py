"""0002_seed_default_admin

Seed the default admin account if it does not exist.

Creates the admin user configured in config.yaml default_admin section.
If the account already exists (e.g. from a previous runtime seed), this
migration is a no-op.

Revision ID: 0002_seed_default_admin
Revises: 0001_initial_auth_schema
Create Date: 2026-06-18 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_seed_default_admin"
down_revision = "0001_initial_auth_schema"
branch_labels = None
depends_on = None


# Pre-computed bcrypt hash for the default password "Admin1234".
# Generated with passlib[bcrypt] — this is deterministic across all
# fresh installs so the migration is idempotent.
_DEFAULT_ADMIN_EMAIL = "admin@pixelle.ai"
_DEFAULT_ADMIN_HASH = "$2b$12$4l5pibQTCEzAoEZTYEphIOwSYe2V.MfTTrY/Ubvxm9Cqs0wv.6O/m"


def upgrade() -> None:
    conn = op.get_bind()

    # Check if the admin account already exists.
    existing = conn.execute(
        sa.text("SELECT id FROM auth_users WHERE email = :email"),
        {"email": _DEFAULT_ADMIN_EMAIL},
    ).fetchone()

    if existing is not None:
        # Account exists — ensure it has admin role.
        conn.execute(
            sa.text("UPDATE auth_users SET role = 'admin' WHERE email = :email"),
            {"email": _DEFAULT_ADMIN_EMAIL},
        )
        return

    # Insert the default admin account.
    conn.execute(
        sa.text(
            """INSERT INTO auth_users (email, password_hash, role, is_active)
               VALUES (:email, :hash, 'admin', 1)"""
        ),
        {"email": _DEFAULT_ADMIN_EMAIL, "hash": _DEFAULT_ADMIN_HASH},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM auth_users WHERE email = :email"),
        {"email": _DEFAULT_ADMIN_EMAIL},
    )
