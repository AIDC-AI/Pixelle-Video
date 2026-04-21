from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.routers._helpers import api_error, path_to_url
from api.schemas.base import ApiErrorResponse
from api.schemas.uploads import UploadResponse

router = APIRouter(prefix="/uploads", tags=["Uploads"])

DEFAULT_MAX_UPLOAD_MB = 500
ALLOWED_UPLOAD_PREFIXES = ("image/", "video/", "audio/")
if hasattr(status, "HTTP_413_CONTENT_TOO_LARGE"):
    PAYLOAD_TOO_LARGE_STATUS = status.HTTP_413_CONTENT_TOO_LARGE
else:  # pragma: no cover - compatibility for older Starlette/FastAPI
    PAYLOAD_TOO_LARGE_STATUS = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE


def _get_max_upload_bytes() -> int:
    raw_value = os.getenv("PIXELLE_MAX_UPLOAD_MB", str(DEFAULT_MAX_UPLOAD_MB))
    try:
        max_upload_mb = max(int(raw_value), 1)
    except ValueError:
        max_upload_mb = DEFAULT_MAX_UPLOAD_MB
    return max_upload_mb * 1024 * 1024


def _validate_upload(file: UploadFile) -> None:
    content_type = (file.content_type or "").lower()
    if not any(content_type.startswith(prefix) for prefix in ALLOWED_UPLOAD_PREFIXES):
        raise api_error(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            code="unsupported_media_type",
            message="Only image, video, and audio uploads are allowed.",
        )

    file.file.seek(0, os.SEEK_END)
    size_bytes = file.file.tell()
    file.file.seek(0)
    if size_bytes > _get_max_upload_bytes():
        raise api_error(
            status_code=PAYLOAD_TOO_LARGE_STATUS,
            code="file_too_large",
            message="Uploaded file exceeds the configured size limit.",
        )


@router.post(
    "",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        413: {"model": ApiErrorResponse},
        415: {"model": ApiErrorResponse},
        500: {"model": ApiErrorResponse},
    },
)
async def upload_file(
    request: Request,
    *,
    file: UploadFile = File(...),
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise api_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="upload_failed",
                message="Upload failed.",
            )

        _validate_upload(file)

        uploads_root = Path(persistence.output_dir) / "uploads" / str(uuid.uuid4())
        uploads_root.mkdir(parents=True, exist_ok=True)

        filename = Path(file.filename or "upload.bin").name or "upload.bin"
        destination = uploads_root / filename
        with destination.open("wb") as fh:
            shutil.copyfileobj(file.file, fh)

        relative_path = destination.relative_to(Path(persistence.output_dir).parent)
        return UploadResponse(
            file_url=path_to_url(request, str(relative_path)),
            path=str(relative_path),
            filename=filename,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Upload error")
        raise api_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="upload_failed",
            message="Upload failed.",
        )
    finally:
        await file.close()
