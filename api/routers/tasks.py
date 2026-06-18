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
Task management endpoints

Endpoints for managing async tasks (checking status, canceling, etc.)
"""

import asyncio
import json
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from loguru import logger
from sse_starlette.sse import EventSourceResponse

from api.auth.dependencies import require_capability
from api.auth.policy import TASKS_MANAGE
from api.tasks import task_manager, Task, TaskStatus

router = APIRouter(prefix="/tasks", tags=["Tasks"])


# Statuses that mean "no more events will arrive" — we close the stream.
_TERMINAL_STATUSES = {
    TaskStatus.COMPLETED,
    TaskStatus.FAILED,
    TaskStatus.CANCELLED,
}

TasksGuard = Annotated[None, Depends(require_capability(TASKS_MANAGE))]


@router.get("/{task_id}/stream")
async def stream_task(task_id: str, request: Request, _guard: TasksGuard):
    """
    Server-Sent Events stream for a task.

    Emits `status` and `progress` events as the task advances. Sends a final
    `done` event when the task reaches a terminal state, then closes the
    stream. The first event is the current state, so a client reconnecting
    after a network blip is brought up to date.

    Events:
        - `status`  — { status, started_at?, result?, error?, completed_at?, progress? }
        - `progress`— { current, total, percentage, message }
        - `done`    — {} (terminal marker; client should close the source)
    """
    task = task_manager.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    queue = task_manager.subscribe(task_id)

    async def event_publisher():
        try:
            # Replay current state so a late subscriber / reconnect is current.
            current = task_manager.get_task(task_id)
            if current is not None:
                payload: dict = {"status": current.status.value}
                if current.progress is not None:
                    payload["progress"] = current.progress.model_dump()
                if current.started_at is not None:
                    payload["started_at"] = current.started_at.isoformat()
                if current.completed_at is not None:
                    payload["completed_at"] = current.completed_at.isoformat()
                if current.result is not None:
                    payload["result"] = current.result
                if current.error is not None:
                    payload["error"] = current.error
                if current.error_detail is not None:
                    payload["error_detail"] = current.error_detail.model_dump()
                yield {"event": "status", "data": json.dumps(payload)}

                if current.status in _TERMINAL_STATUSES:
                    yield {"event": "done", "data": json.dumps({})}
                    return

            # Stream new events until terminal or client disconnect.
            terminal_seen = False
            terminal_values = {s.value for s in _TERMINAL_STATUSES}
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Short timeout so we can detect client disconnect without busy-waiting.
                    event = await asyncio.wait_for(queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue

                yield {
                    "event": event["event"],
                    "data": json.dumps(event["data"]),
                }

                if event["event"] == "status" and event["data"].get("status") in terminal_values:
                    terminal_seen = True
                if terminal_seen:
                    # Let the terminal status event flush before closing.
                    await asyncio.sleep(0.05)
                    yield {"event": "done", "data": json.dumps({})}
                    break
        finally:
            task_manager.unsubscribe(task_id, queue)

    return EventSourceResponse(event_publisher())


@router.get("", response_model=List[Task])
async def list_tasks(
    _guard: TasksGuard,
    status: Optional[TaskStatus] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of tasks"),
):
    """
    List tasks
    
    Retrieve list of tasks with optional filtering.
    
    - **status**: Optional filter by status (pending/running/completed/failed/cancelled)
    - **limit**: Maximum number of tasks to return (default 100)
    
    Returns list of tasks sorted by creation time (newest first).
    """
    try:
        tasks = task_manager.list_tasks(status=status, limit=limit)
        return tasks
        
    except Exception as e:
        logger.error(f"List tasks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{task_id}", response_model=Task)
async def get_task(task_id: str, _guard: TasksGuard):
    """
    Get task details
    
    Retrieve detailed information about a specific task.
    
    - **task_id**: Task ID
    
    Returns task details including status, progress, and result (if completed).
    """
    try:
        task = task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        return task
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get task error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}")
async def cancel_task(task_id: str, _guard: TasksGuard):
    """
    Cancel task
    
    Cancel a running or pending task.
    
    - **task_id**: Task ID
    
    Returns success status.
    """
    try:
        success = task_manager.cancel_task(task_id)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        return {
            "success": True,
            "message": f"Task {task_id} cancelled successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cancel task error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

