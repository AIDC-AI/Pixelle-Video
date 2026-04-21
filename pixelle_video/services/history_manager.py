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
History Manager Service

Business logic for history management (UI-agnostic).
Provides high-level operations on top of PersistenceService.
"""

from typing import List, Dict, Optional, Any
from pathlib import Path
from loguru import logger

from pixelle_video.services.persistence import PersistenceService


class HistoryManager:
    """
    History management service
    
    Provides business logic for:
    - Task listing and filtering
    - Task detail retrieval
    - Task duplication (for re-generation)
    - Task deletion
    - Future: Frame regeneration, export, etc.
    """
    
    def __init__(self, persistence: PersistenceService):
        """
        Initialize history manager
        
        Args:
            persistence: PersistenceService instance
        """
        self.persistence = persistence
    
    async def get_task_list(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """
        Get paginated task list
        
        Args:
            page: Page number (1-indexed)
            page_size: Items per page
            status: Filter by status (optional)
            sort_by: Sort field (created_at, completed_at, title, duration)
            sort_order: Sort order (asc, desc)
        
        Returns:
            {
                "tasks": [...],
                "total": 100,
                "page": 1,
                "page_size": 20,
                "total_pages": 5
            }
        """
        return await self.persistence.list_tasks_paginated(
            page=page,
            page_size=page_size,
            status=status,
            sort_by=sort_by,
            sort_order=sort_order
        )
    
    async def get_task_detail(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get full task detail including storyboard
        
        Args:
            task_id: Task ID
        
        Returns:
            {
                "metadata": {...},      # Task metadata
                "storyboard": {...}     # Storyboard data (if available)
            }
            or None if task not found
        """
        metadata = await self.persistence.load_task_metadata(task_id)
        if not metadata:
            return None
        
        storyboard = await self.persistence.load_storyboard(task_id)
        
        return {
            "metadata": metadata,
            "storyboard": storyboard,
        }
    
    async def get_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about all tasks
        
        Returns:
            {
                "total_tasks": 100,
                "completed": 95,
                "failed": 5,
                "total_duration": 3600.5,  # seconds
                "total_size": 1024000000,  # bytes
            }
        """
        return await self.persistence.get_statistics()
    
    async def delete_task(self, task_id: str) -> bool:
        """
        Delete a task and all its files
        
        Args:
            task_id: Task ID to delete
        
        Returns:
            True if successful, False otherwise
        """
        return await self.persistence.delete_task(task_id)
    
    async def duplicate_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Duplicate a task (get input parameters for new generation)
        
        This allows users to:
        1. Copy all generation parameters from a previous task
        2. Pre-fill the generation form
        3. Regenerate with same/modified parameters
        
        Args:
            task_id: Task ID to duplicate
        
        Returns:
            Input parameters dict or None if task not found
            {
                "text": "...",
                "mode": "generate",
                "title": "...",
                "n_scenes": 5,
                "tts_inference_mode": "local",
                "tts_voice": "...",
                ...
            }
        """
        metadata = await self.persistence.load_task_metadata(task_id)
        if not metadata:
            logger.warning(f"Task {task_id} not found for duplication")
            return None
        
        # Extract input parameters
        input_params = metadata.get("input", {})
        logger.info(f"Duplicated task {task_id} parameters")
        
        return input_params
    
    async def rebuild_index(self):
        """Rebuild task index (useful for maintenance or after manual changes)"""
        await self.persistence.rebuild_index()

    async def list_video_items(
        self,
        project_id: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> Dict[str, Any]:
        return await self.persistence.list_video_items(
            project_id=project_id,
            cursor=cursor,
            limit=limit,
        )
    
    # ========================================================================
    # Future Extensions (Phase 3)
    # ========================================================================
    
    async def regenerate_frame(
        self,
        task_id: str,
        frame_index: int,
        **override_params
    ) -> Optional[str]:
        """
        Regenerate a specific frame (FUTURE FEATURE)
        
        Args:
            task_id: Original task ID
            frame_index: Frame index to regenerate (0-based)
            **override_params: Parameters to override (image_prompt, style, etc.)
        
        Returns:
            New frame image path or None if failed
        
        TODO: Implement in Phase 3
        - Load original storyboard
        - Get frame parameters
        - Override with new parameters
        - Call image generation service
        - Update storyboard
        - Re-composite video
        """
        logger.warning("regenerate_frame is not implemented yet (Phase 3 feature)")
        return None
    
    async def export_task(self, task_id: str, export_path: str) -> Optional[str]:
        """
        Export task as a package (metadata + video + frames) (FUTURE FEATURE)
        
        Args:
            task_id: Task ID to export
            export_path: Export file path (e.g., "exports/task.zip")
        
        Returns:
            Export file path or None if failed
        
        TODO: Implement in Phase 3
        - Collect all task files
        - Create ZIP archive
        - Include metadata.json, storyboard.json, video, frames
        """
        logger.warning("export_task is not implemented yet (Phase 3 feature)")
        return None
