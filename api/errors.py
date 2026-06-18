"""
Centralised error handling for the FastAPI application.

Register a single exception handler that normalises all unhandled exceptions
into a consistent JSON envelope. The goal is not a full refactor of every
router — it's to guarantee that even endpoints that still use bare ``500``
don't leak raw exception messages to the client.

Strategy:
- ``HTTPException`` with ``detail`` already in ``{"code": ..., "message": ...}``
  format (auth router) → pass through unchanged.
- ``ValueError`` → 400 with the message (input validation).
- ``RuntimeError`` and everything else → 500 with an opaque message; the real
  error is logged with full traceback server-side.

Usage::

    from api.errors import register_error_handler
    register_error_handler(app)
"""

from __future__ import annotations

import traceback
from typing import Union

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from loguru import logger


def register_error_handler(app: FastAPI) -> None:
    """Install a catch-all exception handler on *app*."""

    @app.exception_handler(ValueError)
    async def _value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        logger.warning(f"ValueError @ {request.method} {request.url.path}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "detail": {
                    "code": "invalid_input",
                    "message": str(exc),
                }
            },
        )

    @app.exception_handler(Exception)
    async def _catch_all_handler(request: Request, exc: Exception) -> JSONResponse:
        # HTTPException that the caller already formatted as a detail dict
        # is re-raised as-is so FastAPI's default handler takes it.
        from fastapi.exceptions import HTTPException as FastAPIHttpException

        if isinstance(exc, FastAPIHttpException):
            # FastAPI's own handler can deal with this — just re-raise.
            raise

        logger.opt(exception=exc).error(
            f"Unhandled error @ {request.method} {request.url.path}: {exc}"
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": {
                    "code": "internal_error",
                    "message": "An unexpected error occurred. Please try again later.",
                }
            },
        )


__all__ = ["register_error_handler"]
