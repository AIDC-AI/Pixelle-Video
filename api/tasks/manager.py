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
Task Manager

In-memory task management for video generation jobs.
"""

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable
from loguru import logger

from api.tasks.models import (
    Task,
    TaskErrorDetail,
    TaskStatus,
    TaskType,
    TaskProgress,
)
from api.config import api_config


def _friendly_error_detail(error_text: str) -> TaskErrorDetail:
    """Map a raw exception/message to a user-friendly error detail.

    The raw `error` field stays in the stream for debugging; this detail is
    what the web UI surfaces to end users.
    """
    lower = error_text.lower()
    if "task_create_failed_by_not_enough_power_value" in lower or "not_enough_power" in lower:
        return TaskErrorDetail(
            code="SERVICE_UNAVAILABLE",
            message="Service is temporarily unavailable. Please try again later.",
            details=error_text,
        )
    if "runninghub" in lower and ("api error" in lower or "execution failed" in lower):
        return TaskErrorDetail(
            code="MEDIA_SERVICE_ERROR",
            message="The media generation service encountered a problem. Please try again later.",
            details=error_text,
        )
    if "server disconnected" in lower or "remoteprotocolerror" in lower:
        return TaskErrorDetail(
            code="NETWORK_ERROR",
            message="Network connection interrupted. Please retry.",
            details=error_text,
        )
    if "llm" in lower or "deepseek" in lower or "openai" in lower:
        return TaskErrorDetail(
            code="AI_SERVICE_ERROR",
            message="The AI service failed to respond. Please try again later.",
            details=error_text,
        )
    return TaskErrorDetail(
        code="GENERATION_FAILED",
        message="Video generation failed. Please try again.",
        details=error_text,
    )


class TaskManager:
    """
    Task manager for handling async video generation tasks
    
    Features:
    - In-memory storage (can be replaced with Redis later)
    - Task lifecycle management
    - Progress tracking
    - Auto cleanup of old tasks
    """
    
    def __init__(self):
        self._tasks: Dict[str, Task] = {}
        self._task_futures: Dict[str, asyncio.Task] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False
        # Per-task subscriber queues. SSE streams consume from these to push
        # state changes to clients in real time. Use a small maxsize and
        # put_nowait so a slow client never blocks the producer.
        self._subscribers: Dict[str, List[asyncio.Queue]] = {}

    def _publish(self, task_id: str, event: str, data: dict) -> None:
        """Fan-out an event to every active subscriber of a task.

        Events for unknown tasks or with no subscribers are silently dropped.
        Slow subscribers have events dropped (queue full) — better to skip
        a frame than to block the async loop.
        """
        queues = self._subscribers.get(task_id)
        if not queues:
            return
        for q in list(queues):
            try:
                q.put_nowait({"event": event, "data": data})
            except asyncio.QueueFull:
                logger.warning(f"Subscriber queue full for task {task_id}, dropping event")

    def subscribe(self, task_id: str) -> asyncio.Queue:
        """Register a new SSE subscriber queue for the given task."""
        q: asyncio.Queue = asyncio.Queue(maxsize=64)
        self._subscribers.setdefault(task_id, []).append(q)
        return q

    def unsubscribe(self, task_id: str, queue: asyncio.Queue) -> None:
        """Remove a subscriber queue; safe to call on unknown ids."""
        queues = self._subscribers.get(task_id)
        if not queues:
            return
        try:
            queues.remove(queue)
        except ValueError:
            return
        if not queues:
            del self._subscribers[task_id]
    
    async def start(self):
        """Start task manager and cleanup scheduler"""
        if self._running:
            logger.warning("Task manager already running")
            return
        
        self._running = True
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("✅ Task manager started")
    
    async def stop(self):
        """Stop task manager and cancel all tasks"""
        self._running = False
        
        # Cancel cleanup task
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Cancel all running tasks
        for task_id, future in self._task_futures.items():
            if not future.done():
                future.cancel()
                logger.info(f"Cancelled task: {task_id}")
        
        self._tasks.clear()
        self._task_futures.clear()
        logger.info("✅ Task manager stopped")
    
    def create_task(
        self,
        task_type: TaskType,
        request_params: Optional[dict] = None
    ) -> Task:
        """
        Create a new task
        
        Args:
            task_type: Type of task
            request_params: Original request parameters
            
        Returns:
            Created task
        """
        task_id = str(uuid.uuid4())
        task = Task(
            task_id=task_id,
            task_type=task_type,
            status=TaskStatus.PENDING,
            request_params=request_params,
        )
        
        self._tasks[task_id] = task
        logger.info(f"Created task {task_id} ({task_type})")
        self._publish(task_id, "status", {
            "status": task.status.value,
            "created_at": task.created_at.isoformat(),
        })
        return task
    
    async def execute_task(
        self,
        task_id: str,
        coro_func: Callable,
        *args,
        **kwargs
    ):
        """
        Execute task asynchronously
        
        Args:
            task_id: Task ID
            coro_func: Async function to execute
            *args: Positional arguments
            **kwargs: Keyword arguments
        """
        task = self._tasks.get(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return
        
        # Create async task
        async def _execute():
            try:
                task.status = TaskStatus.RUNNING
                task.started_at = datetime.now()
                logger.info(f"Task {task_id} started")
                self._publish(task_id, "status", {
                    "status": task.status.value,
                    "started_at": task.started_at.isoformat(),
                })

                # Execute the actual work
                result = await coro_func(*args, **kwargs)

                # Update task with result
                task.status = TaskStatus.COMPLETED
                task.result = result
                task.completed_at = datetime.now()
                logger.info(f"Task {task_id} completed")
                self._publish(task_id, "status", {
                    "status": task.status.value,
                    "result": result,
                    "completed_at": task.completed_at.isoformat(),
                })

            except asyncio.CancelledError:
                task.status = TaskStatus.CANCELLED
                task.completed_at = datetime.now()
                logger.info(f"Task {task_id} cancelled")
                self._publish(task_id, "status", {
                    "status": task.status.value,
                    "completed_at": task.completed_at.isoformat(),
                })
                raise
            except Exception as e:
                task.status = TaskStatus.FAILED
                task.error = str(e)
                task.error_detail = _friendly_error_detail(task.error)
                task.completed_at = datetime.now()
                logger.error(f"Task {task_id} failed: {e}")
                self._publish(task_id, "status", {
                    "status": task.status.value,
                    "error": task.error,
                    "error_detail": task.error_detail.model_dump(),
                    "completed_at": task.completed_at.isoformat(),
                })
        
        # Start execution
        future = asyncio.create_task(_execute())
        self._task_futures[task_id] = future
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID"""
        return self._tasks.get(task_id)
    
    def list_tasks(
        self,
        status: Optional[TaskStatus] = None,
        limit: int = 100
    ) -> List[Task]:
        """
        List tasks with optional filtering
        
        Args:
            status: Filter by status
            limit: Maximum number of tasks to return
            
        Returns:
            List of tasks
        """
        tasks = list(self._tasks.values())
        
        if status:
            tasks = [t for t in tasks if t.status == status]
        
        # Sort by created_at descending
        tasks.sort(key=lambda t: t.created_at, reverse=True)
        
        return tasks[:limit]
    
    def update_progress(
        self,
        task_id: str,
        current: int,
        total: int,
        message: str = ""
    ):
        """
        Update task progress
        
        Args:
            task_id: Task ID
            current: Current progress
            total: Total steps
            message: Progress message
        """
        task = self._tasks.get(task_id)
        if not task:
            return
        
        percentage = (current / total * 100) if total > 0 else 0
        task.progress = TaskProgress(
            current=current,
            total=total,
            percentage=percentage,
            message=message
        )
        self._publish(task_id, "progress", {
            "current": current,
            "total": total,
            "percentage": percentage,
            "message": message,
        })
    
    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a running task
        
        Args:
            task_id: Task ID
            
        Returns:
            True if cancelled, False otherwise
        """
        task = self._tasks.get(task_id)
        if not task:
            return False
        
        # Do not cancel already-terminal tasks
        if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
            return False

        # Cancel future if running
        future = self._task_futures.get(task_id)
        if future and not future.done():
            future.cancel()
        
        # Update task status
        task.status = TaskStatus.CANCELLED
        task.completed_at = datetime.now()
        logger.info(f"Cancelled task {task_id}")
        self._publish(task_id, "status", {
            "status": task.status.value,
            "completed_at": task.completed_at.isoformat(),
        })
        return True
    
    async def _cleanup_loop(self):
        """Periodically clean up old completed tasks"""
        while self._running:
            try:
                await asyncio.sleep(api_config.task_cleanup_interval)
                self._cleanup_old_tasks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
    
    def _cleanup_old_tasks(self):
        """Remove old completed/failed tasks"""
        cutoff_time = datetime.now() - timedelta(seconds=api_config.task_retention_time)
        
        tasks_to_remove = []
        for task_id, task in self._tasks.items():
            if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
                if task.completed_at and task.completed_at < cutoff_time:
                    tasks_to_remove.append(task_id)
        
        for task_id in tasks_to_remove:
            del self._tasks[task_id]
            if task_id in self._task_futures:
                del self._task_futures[task_id]
            # Drop any lingering subscribers; their streams will end.
            self._subscribers.pop(task_id, None)
        
        if tasks_to_remove:
            logger.info(f"Cleaned up {len(tasks_to_remove)} old tasks")


# Global task manager instance
task_manager = TaskManager()

