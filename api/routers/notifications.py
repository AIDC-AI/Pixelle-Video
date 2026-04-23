"""Notification endpoints used by the Next.js workbench shell."""

from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from api.schemas.base import BaseResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationItem(BaseModel):
    """User-facing shell notification."""

    id: str
    title: str
    summary: str
    severity: Literal["error", "info", "success", "warning"]
    type: Literal["system", "task"]
    created_at: str
    action_href: Optional[str] = None
    read_at: Optional[str] = None


class NotificationListResponse(BaseModel):
    """List response consumed by the notification center."""

    items: list[NotificationItem] = Field(default_factory=list)


@router.get("", response_model=NotificationListResponse)
async def list_notifications() -> NotificationListResponse:
    """Return current shell notifications.

    The workbench currently does not persist notifications server-side. Returning
    a stable empty list keeps the shell contract explicit and avoids frontend 404
    noise while task-level notifications are implemented.
    """

    return NotificationListResponse()


@router.post("/{notification_id}/read", response_model=BaseResponse)
async def mark_notification_read(notification_id: str) -> BaseResponse:
    """Mark one notification as read.

    This is intentionally idempotent: unknown IDs are accepted because the
    current backend has no persisted notification store.
    """

    return BaseResponse(message="Notification marked as read.")


@router.post("/read-all", response_model=BaseResponse)
async def mark_all_notifications_read() -> BaseResponse:
    """Mark all notifications as read."""

    return BaseResponse(message="Notifications marked as read.")


@router.delete("", response_model=BaseResponse)
async def clear_notifications() -> BaseResponse:
    """Clear all notifications."""

    return BaseResponse(message="Notifications cleared.")
