from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status
from loguru import logger

from api.dependencies import PixelleVideoDep
from api.routers._helpers import path_to_url
from api.schemas.uploads import UploadResponse

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    *,
    file: UploadFile = File(...),
    pixelle_video: PixelleVideoDep,
):
    try:
        persistence = pixelle_video.persistence
        if persistence is None:
            raise RuntimeError("Persistence service is not initialized")

        uploads_root = Path(persistence.output_dir) / "uploads" / str(uuid.uuid4())
        uploads_root.mkdir(parents=True, exist_ok=True)

        filename = Path(file.filename or "upload.bin").name
        destination = uploads_root / filename
        with destination.open("wb") as fh:
            shutil.copyfileobj(file.file, fh)

        relative_path = destination.relative_to(Path(persistence.output_dir).parent)
        return UploadResponse(
            file_url=path_to_url(request, str(relative_path)),
            path=str(relative_path),
            filename=filename,
        )
    except Exception as exc:
        logger.error(f"Upload error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        await file.close()
