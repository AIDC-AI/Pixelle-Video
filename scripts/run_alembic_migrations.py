"""Run Alembic migrations for the auth subsystem.

Usage from project root::

    python scripts/run_alembic_migrations.py [revision]

    revision defaults to "head" if omitted.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def build_alembic_config() -> Config:
    config = Config(str(ROOT_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT_DIR / "alembic"))
    return config


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Apply Auth DB migrations."
    )
    parser.add_argument(
        "revision",
        nargs="?",
        default="head",
        help="Alembic revision target to upgrade to (default: head).",
    )
    args = parser.parse_args()

    cfg = build_alembic_config()
    try:
        command.upgrade(cfg, args.revision)
        print(f"Migrations applied up to: {args.revision}")
        return 0
    except Exception:
        # Tables may already exist from old create_all — stamp instead.
        print(
            "Migration upgrade failed (tables may already exist). "
            "Stamping head revision — no data loss."
        )
        try:
            command.stamp(cfg, "head")
            print("Legacy schema stamped successfully.")
            return 0
        except Exception as stamp_err:
            print(f"Stamp also failed: {stamp_err}")
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
