"""Helpers for exposing direct API media models in Streamlit pipeline UIs."""

from typing import Any

from loguru import logger


def is_api_workflow(workflow_key: str | None) -> bool:
    """Return True for direct provider workflow keys such as api/dashscope/xxx."""
    return bool(workflow_key and workflow_key.startswith("api/"))


def list_api_media_workflows(pixelle_video: Any, media_type: str) -> list[dict]:
    """List API-backed media workflows in the same option shape used by UIs."""
    api_media = getattr(pixelle_video, "api_media", None)
    if api_media is None:
        return []

    try:
        return [
            {
                "key": workflow["key"],
                "display_name": workflow.get("display_name") or workflow["key"],
                **workflow,
            }
            for workflow in api_media.list_workflows()
            if workflow.get("media_type") == media_type
        ]
    except Exception as exc:
        logger.warning(f"Failed to list API {media_type} workflows: {exc}")
        return []
