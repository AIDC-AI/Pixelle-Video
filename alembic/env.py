"""Alembic migration environment for the auth subsystem.

Run from project root::

    alembic -c alembic.ini upgrade head

Or via the convenience script::

    python scripts/run_alembic_migrations.py
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from api.auth.models import Base
from api.auth.config import load_auth_settings, ensure_db_dir

alembic_cfg = context.config

if alembic_cfg.config_file_name is not None:
    fileConfig(alembic_cfg.config_file_name)

target_metadata = Base.metadata


def _get_db_url() -> str:
    """Resolve the auth DB path into a SQLAlchemy URL."""
    settings = load_auth_settings()
    ensure_db_dir(settings.auth_db_path)
    normalized = settings.auth_db_path.replace("\\", "/")
    from pathlib import Path
    abs_path = str(Path(normalized).expanduser().resolve()).replace("\\", "/")
    return f"sqlite+aiosqlite:///{abs_path}"


def run_migrations_offline() -> None:
    url = _get_db_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = alembic_cfg.get_section(alembic_cfg.config_ini_section, {})
    configuration["sqlalchemy.url"] = _get_db_url()
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    connectable = context.config.attributes.get("connection")
    if connectable is not None:
        do_run_migrations(connectable)
    else:
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
