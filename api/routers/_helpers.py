from __future__ import annotations

import os
from pathlib import Path

from fastapi import HTTPException, Request


def path_to_url(request: Request, file_path: str) -> str:
    """
    Convert a stored output path into an API file URL.
    """
    normalized = file_path.replace("\\", "/")
    is_absolute = os.path.isabs(normalized) or Path(normalized).is_absolute()

    if is_absolute:
        parts = normalized.split("/")
        try:
            output_idx = parts.index("output")
        except ValueError:
            normalized = Path(normalized).name
        else:
            normalized = "/".join(parts[output_idx + 1 :])
    elif normalized.startswith("output/"):
        normalized = normalized[7:]

    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/api/files/{normalized}"


def not_implemented(detail: str = "Not Implemented") -> HTTPException:
    return HTTPException(status_code=501, detail=detail)
