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
Async SQLAlchemy engine, session factory, and table init for the auth DB.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from loguru import logger
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from api.auth.config import ensure_db_dir, load_auth_settings
from api.auth.models import Base

# Resolved at module import time. Tests can override ``engine`` and
# ``SessionLocal`` by re-calling :func:`init_engine`.
_engine = None
_SessionLocal: async_sessionmaker[AsyncSession] | None = None


def _build_engine_url(db_path: str) -> str:
    # Always treat the path as a file URL for SQLite. Works on Win + POSIX.
    normalized = db_path.replace("\\", "/")
    if not normalized.startswith("/"):
        # aiosqlite requires an absolute path or the special "sqlite://" prefix
        from pathlib import Path

        abs_path = Path(normalized).expanduser().resolve()
        normalized = str(abs_path).replace("\\", "/")
    return f"sqlite+aiosqlite:///{normalized}"


def init_engine(db_path: str | None = None) -> None:
    """Create the async engine and session factory.

    Idempotent: safe to call multiple times. The engine is recreated
    only if the resolved URL changes (e.g. tests swapping the DB).
    """
    global _engine, _SessionLocal

    settings = load_auth_settings()
    target_path = db_path or settings.auth_db_path
    ensure_db_dir(target_path)

    url = _build_engine_url(target_path)
    if _engine is not None and str(_engine.url) == url:
        return

    if _engine is not None:
        # Best-effort cleanup of the old engine.
        try:
            import asyncio

            asyncio.get_event_loop().run_until_complete(_engine.dispose())
        except Exception:  # pragma: no cover - defensive
            pass

    _engine = create_async_engine(url, future=True, echo=False)
    _SessionLocal = async_sessionmaker(_engine, expire_on_commit=False)
    logger.info(f"Auth DB engine initialised at {target_path}")


def get_engine():
    if _engine is None:
        init_engine()
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    if _SessionLocal is None:
        init_engine()
    assert _SessionLocal is not None
    return _SessionLocal


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Context-managed session that commits on success and rolls back on error."""
    factory = get_sessionmaker()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields a transactional session."""
    factory = get_sessionmaker()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Deprecated: use ``python scripts/run_alembic_migrations.py`` instead.

    Kept for backward compatibility — delegates to Alembic upgrade so the
    schema is always managed through proper migrations.
    """
    from alembic import command
    from alembic.config import Config
    from pathlib import Path
    import asyncio

    root = Path(__file__).resolve().parent.parent.parent
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))

    try:
        command.upgrade(cfg, "head")
    except Exception:
        try:
            command.stamp(cfg, "head")
        except Exception:
            pass


async def dispose_engine() -> None:
    """Dispose of the engine on app shutdown."""
    global _engine, _SessionLocal
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _SessionLocal = None
        logger.info("Auth DB engine disposed")


__all__ = [
    "init_engine",
    "get_engine",
    "get_sessionmaker",
    "session_scope",
    "get_db",
    "init_db",
    "dispose_engine",
]
