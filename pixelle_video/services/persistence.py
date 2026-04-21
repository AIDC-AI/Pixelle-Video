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
Persistence Service

Handles task metadata and storyboard persistence to filesystem.
"""

import json
import os
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger

from pixelle_video.models.storyboard import (
    ContentMetadata,
    Storyboard,
    StoryboardConfig,
    StoryboardFrame,
)


class PersistenceService:
    """
    Task persistence service using filesystem (JSON)
    
    File structure:
        output/
        └── {task_id}/
            ├── metadata.json          # Task metadata (input, result, config)
            ├── storyboard.json        # Storyboard data (frames, prompts)
            ├── final.mp4
            └── frames/
                ├── 01_audio.mp3
                ├── 01_image.png
                └── ...
    
    Usage:
        persistence = PersistenceService()
        
        # Save metadata
        await persistence.save_task_metadata(task_id, metadata)
        
        # Save storyboard
        await persistence.save_storyboard(task_id, storyboard)
        
        # Load task
        metadata = await persistence.load_task_metadata(task_id)
        storyboard = await persistence.load_storyboard(task_id)
        
        # List all tasks
        tasks = await persistence.list_tasks(status="completed", limit=50)
    """
    
    def __init__(self, output_dir: str = "output"):
        """
        Initialize persistence service
        
        Args:
            output_dir: Base output directory (default: "output")
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Index files for fast listing
        self.index_file = self.output_dir / ".index.json"
        self.projects_file = self.output_dir / ".projects.json"
        self.batches_file = self.output_dir / ".batches.json"
        self.presets_file = self.output_dir / ".presets.json"
        self._state_lock = threading.RLock()
        self._ensure_index()
        self._ensure_projects_index()
        self._ensure_batches_index()
        self._ensure_presets_index()
    
    def get_task_dir(self, task_id: str) -> Path:
        """Get task directory path"""
        return self.output_dir / task_id
    
    def get_metadata_path(self, task_id: str) -> Path:
        """Get metadata.json path"""
        return self.get_task_dir(task_id) / "metadata.json"
    
    def get_storyboard_path(self, task_id: str) -> Path:
        """Get storyboard.json path"""
        return self.get_task_dir(task_id) / "storyboard.json"
    
    # ========================================================================
    # Metadata Operations
    # ========================================================================
    
    async def save_task_metadata(
        self,
        task_id: str,
        metadata: Dict[str, Any]
    ):
        """
        Save task metadata to filesystem
        
        Args:
            task_id: Task ID
            metadata: Metadata dict with structure:
                {
                    "task_id": str,
                    "created_at": str,
                    "completed_at": str (optional),
                    "status": str,
                    "input": dict,
                    "result": dict (optional),
                    "config": dict
                }
        """
        try:
            task_dir = self.get_task_dir(task_id)
            task_dir.mkdir(parents=True, exist_ok=True)
            
            metadata_path = self.get_metadata_path(task_id)
            
            # Ensure task_id is set
            metadata["task_id"] = task_id
            
            # Convert datetime objects to ISO format strings
            if "created_at" in metadata and isinstance(metadata["created_at"], datetime):
                metadata["created_at"] = metadata["created_at"].isoformat()
            if "completed_at" in metadata and isinstance(metadata["completed_at"], datetime):
                metadata["completed_at"] = metadata["completed_at"].isoformat()
            
            with open(metadata_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            logger.debug(f"Saved task metadata: {task_id}")
            
            # Update index
            await self._update_index_for_task(task_id, metadata)
            await self._sync_project_from_metadata(task_id, metadata)
            
        except Exception as e:
            logger.error(f"Failed to save task metadata {task_id}: {e}")
            raise
    
    async def load_task_metadata(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Load task metadata from filesystem
        
        Args:
            task_id: Task ID
            
        Returns:
            Metadata dict or None if not found
        """
        try:
            metadata_path = self.get_metadata_path(task_id)
            
            if not metadata_path.exists():
                return None
            
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
            
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to load task metadata {task_id}: {e}")
            return None
    
    async def update_task_status(
        self,
        task_id: str,
        status: str,
        error: Optional[str] = None
    ):
        """
        Update task status in metadata
        
        Args:
            task_id: Task ID
            status: New status (pending, running, completed, failed, cancelled)
            error: Error message (optional, for failed status)
        """
        try:
            metadata = await self.load_task_metadata(task_id)
            if not metadata:
                logger.warning(f"Cannot update status: task {task_id} not found")
                return
            
            metadata["status"] = status
            
            if status in ["completed", "failed", "cancelled"]:
                metadata["completed_at"] = datetime.now().isoformat()
            
            if error:
                metadata["error"] = error
            
            await self.save_task_metadata(task_id, metadata)
            
        except Exception as e:
            logger.error(f"Failed to update task status {task_id}: {e}")
    
    # ========================================================================
    # Storyboard Operations
    # ========================================================================
    
    async def save_storyboard(
        self,
        task_id: str,
        storyboard: Storyboard
    ):
        """
        Save storyboard to filesystem
        
        Args:
            task_id: Task ID
            storyboard: Storyboard instance
        """
        try:
            task_dir = self.get_task_dir(task_id)
            task_dir.mkdir(parents=True, exist_ok=True)
            
            storyboard_path = self.get_storyboard_path(task_id)
            
            # Convert storyboard to dict
            storyboard_dict = self._storyboard_to_dict(storyboard)
            
            with open(storyboard_path, "w", encoding="utf-8") as f:
                json.dump(storyboard_dict, f, indent=2, ensure_ascii=False)
            
            logger.debug(f"Saved storyboard: {task_id}")

            metadata = await self.load_task_metadata(task_id)
            if metadata:
                await self._update_index_for_task(task_id, metadata)
            
        except Exception as e:
            logger.error(f"Failed to save storyboard {task_id}: {e}")
            raise
    
    async def load_storyboard(self, task_id: str) -> Optional[Storyboard]:
        """
        Load storyboard from filesystem
        
        Args:
            task_id: Task ID
            
        Returns:
            Storyboard instance or None if not found
        """
        try:
            storyboard_path = self.get_storyboard_path(task_id)
            
            if not storyboard_path.exists():
                return None
            
            with open(storyboard_path, "r", encoding="utf-8") as f:
                storyboard_dict = json.load(f)
            
            # Convert dict to storyboard
            storyboard = self._dict_to_storyboard(storyboard_dict)
            
            return storyboard
            
        except Exception as e:
            logger.error(f"Failed to load storyboard {task_id}: {e}")
            return None
    
    # ========================================================================
    # Task Listing & Querying
    # ========================================================================
    
    async def list_tasks(
        self,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List tasks with optional filtering
        
        Args:
            status: Filter by status (pending, running, completed, failed, cancelled)
            limit: Maximum number of tasks to return
            offset: Number of tasks to skip
            
        Returns:
            List of metadata dicts, sorted by created_at descending
        """
        try:
            tasks = []
            
            # Scan all task directories
            for task_dir in self.output_dir.iterdir():
                if not task_dir.is_dir():
                    continue
                
                metadata_path = task_dir / "metadata.json"
                if not metadata_path.exists():
                    continue
                
                try:
                    with open(metadata_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                    
                    # Filter by status
                    if status and metadata.get("status") != status:
                        continue
                    
                    tasks.append(metadata)
                    
                except Exception as e:
                    logger.warning(f"Failed to load metadata from {task_dir}: {e}")
                    continue
            
            # Sort by created_at descending
            tasks.sort(key=lambda t: t.get("created_at", ""), reverse=True)
            
            # Apply pagination
            return tasks[offset:offset + limit]
            
        except Exception as e:
            logger.error(f"Failed to list tasks: {e}")
            return []
    
    async def task_exists(self, task_id: str) -> bool:
        """Check if task exists"""
        return self.get_task_dir(task_id).exists()
    
    # ========================================================================
    # Serialization Helpers
    # ========================================================================
    
    def _storyboard_to_dict(self, storyboard: Storyboard) -> Dict[str, Any]:
        """Convert Storyboard to dict for JSON serialization"""
        return {
            "title": storyboard.title,
            "config": self._config_to_dict(storyboard.config),
            "frames": [self._frame_to_dict(frame) for frame in storyboard.frames],
            "content_metadata": self._content_metadata_to_dict(storyboard.content_metadata) if storyboard.content_metadata else None,
            "final_video_path": storyboard.final_video_path,
            "total_duration": storyboard.total_duration,
            "created_at": storyboard.created_at.isoformat() if storyboard.created_at else None,
            "completed_at": storyboard.completed_at.isoformat() if storyboard.completed_at else None,
        }
    
    def _dict_to_storyboard(self, data: Dict[str, Any]) -> Storyboard:
        """Convert dict to Storyboard instance"""
        return Storyboard(
            title=data["title"],
            config=self._dict_to_config(data["config"]),
            frames=[self._dict_to_frame(frame_data) for frame_data in data["frames"]],
            content_metadata=self._dict_to_content_metadata(data["content_metadata"]) if data.get("content_metadata") else None,
            final_video_path=data.get("final_video_path"),
            total_duration=data.get("total_duration", 0.0),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
        )
    
    def _config_to_dict(self, config: StoryboardConfig) -> Dict[str, Any]:
        """Convert StoryboardConfig to dict"""
        return {
            "task_id": config.task_id,
            "n_storyboard": config.n_storyboard,
            "min_narration_words": config.min_narration_words,
            "max_narration_words": config.max_narration_words,
            "min_image_prompt_words": config.min_image_prompt_words,
            "max_image_prompt_words": config.max_image_prompt_words,
            "video_fps": config.video_fps,
            "tts_inference_mode": config.tts_inference_mode,
            "voice_id": config.voice_id,
            "tts_workflow": config.tts_workflow,
            "tts_speed": config.tts_speed,
            "ref_audio": config.ref_audio,
            "media_width": config.media_width,
            "media_height": config.media_height,
            "media_workflow": config.media_workflow,
            "frame_template": config.frame_template,
            "template_params": config.template_params,
        }
    
    def _dict_to_config(self, data: Dict[str, Any]) -> StoryboardConfig:
        """Convert dict to StoryboardConfig"""
        return StoryboardConfig(
            task_id=data.get("task_id"),
            n_storyboard=data.get("n_storyboard", 5),
            min_narration_words=data.get("min_narration_words", 5),
            max_narration_words=data.get("max_narration_words", 20),
            min_image_prompt_words=data.get("min_image_prompt_words", 30),
            max_image_prompt_words=data.get("max_image_prompt_words", 60),
            video_fps=data.get("video_fps", 30),
            tts_inference_mode=data.get("tts_inference_mode", "local"),
            voice_id=data.get("voice_id"),
            tts_workflow=data.get("tts_workflow"),
            tts_speed=data.get("tts_speed"),
            ref_audio=data.get("ref_audio"),
            media_width=data.get("media_width", data.get("image_width", 1024)),  # Backward compatibility
            media_height=data.get("media_height", data.get("image_height", 1024)),  # Backward compatibility
            media_workflow=data.get("media_workflow", data.get("image_workflow")),  # Backward compatibility
            frame_template=data.get("frame_template", "1080x1920/default.html"),
            template_params=data.get("template_params"),
        )
    
    def _frame_to_dict(self, frame: StoryboardFrame) -> Dict[str, Any]:
        """Convert StoryboardFrame to dict"""
        return {
            "index": frame.index,
            "narration": frame.narration,
            "image_prompt": frame.image_prompt,
            "audio_path": frame.audio_path,
            "media_type": frame.media_type,
            "image_path": frame.image_path,
            "video_path": frame.video_path,
            "composed_image_path": frame.composed_image_path,
            "video_segment_path": frame.video_segment_path,
            "duration": frame.duration,
            "created_at": frame.created_at.isoformat() if frame.created_at else None,
        }
    
    def _dict_to_frame(self, data: Dict[str, Any]) -> StoryboardFrame:
        """Convert dict to StoryboardFrame"""
        return StoryboardFrame(
            index=data["index"],
            narration=data["narration"],
            image_prompt=data["image_prompt"],
            audio_path=data.get("audio_path"),
            media_type=data.get("media_type"),
            image_path=data.get("image_path"),
            video_path=data.get("video_path"),
            composed_image_path=data.get("composed_image_path"),
            video_segment_path=data.get("video_segment_path"),
            duration=data.get("duration", 0.0),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
        )
    
    def _content_metadata_to_dict(self, metadata: ContentMetadata) -> Dict[str, Any]:
        """Convert ContentMetadata to dict"""
        return {
            "title": metadata.title,
            "author": metadata.author,
            "subtitle": metadata.subtitle,
            "genre": metadata.genre,
            "summary": metadata.summary,
            "publication_year": metadata.publication_year,
            "cover_url": metadata.cover_url,
        }
    
    def _dict_to_content_metadata(self, data: Dict[str, Any]) -> ContentMetadata:
        """Convert dict to ContentMetadata"""
        return ContentMetadata(
            title=data["title"],
            author=data.get("author"),
            subtitle=data.get("subtitle"),
            genre=data.get("genre"),
            summary=data.get("summary"),
            publication_year=data.get("publication_year"),
            cover_url=data.get("cover_url"),
        )
    
    # ========================================================================
    # Index Management (for fast listing)
    # ========================================================================
    
    def _ensure_index(self):
        """Ensure index file exists, create if not"""
        with self._state_lock:
            if not self.index_file.exists():
                self._save_index({"version": "2.0", "tasks": [], "artifacts": []})

    def _ensure_projects_index(self):
        with self._state_lock:
            if not self.projects_file.exists():
                self._save_projects_index({"version": "1.0", "projects": []})

    def _ensure_batches_index(self):
        with self._state_lock:
            if not self.batches_file.exists():
                self._save_batches_index({"version": "1.0", "batches": []})

    def _ensure_presets_index(self):
        with self._state_lock:
            if not self.presets_file.exists():
                self._save_presets_index({"version": "1.0", "presets": []})

    def _atomic_write_json(self, target_path: Path, payload: Dict[str, Any]):
        tmp_path = target_path.with_name(
            f"{target_path.name}.{os.getpid()}.{threading.get_ident()}.tmp"
        )
        try:
            with tmp_path.open("w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, target_path)
        finally:
            if tmp_path.exists():
                tmp_path.unlink(missing_ok=True)
    
    def _load_index(self) -> Dict[str, Any]:
        """Load index from file"""
        with self._state_lock:
            try:
                with open(self.index_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    data.setdefault("tasks", [])
                    data.setdefault("artifacts", [])
                    data.setdefault("version", "2.0")
                    return data
            except Exception as e:
                logger.error(f"Failed to load index: {e}")
                return {"version": "2.0", "tasks": [], "artifacts": []}
    
    def _save_index(self, index_data: Dict[str, Any]):
        """Save index to file"""
        with self._state_lock:
            try:
                index_data.setdefault("tasks", [])
                index_data.setdefault("artifacts", [])
                index_data["last_updated"] = datetime.now().isoformat()
                self._atomic_write_json(self.index_file, index_data)
            except Exception as e:
                logger.error(f"Failed to save index: {e}")

    def _load_projects_index(self) -> Dict[str, Any]:
        with self._state_lock:
            try:
                with open(self.projects_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load projects index: {e}")
                return {"version": "1.0", "projects": []}

    def _save_projects_index(self, projects_data: Dict[str, Any]):
        with self._state_lock:
            try:
                projects_data["last_updated"] = datetime.now().isoformat()
                self._atomic_write_json(self.projects_file, projects_data)
            except Exception as e:
                logger.error(f"Failed to save projects index: {e}")

    def _load_batches_index(self) -> Dict[str, Any]:
        with self._state_lock:
            try:
                with open(self.batches_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    data.setdefault("batches", [])
                    data.setdefault("version", "1.0")
                    return data
            except Exception as e:
                logger.error(f"Failed to load batches index: {e}")
                return {"version": "1.0", "batches": []}

    def _save_batches_index(self, batches_data: Dict[str, Any]):
        with self._state_lock:
            try:
                batches_data["last_updated"] = datetime.now().isoformat()
                self._atomic_write_json(self.batches_file, batches_data)
            except Exception as e:
                logger.error(f"Failed to save batches index: {e}")

    def _load_presets_index(self) -> Dict[str, Any]:
        with self._state_lock:
            try:
                with open(self.presets_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    data.setdefault("presets", [])
                    data.setdefault("version", "1.0")
                    return data
            except Exception as e:
                logger.error(f"Failed to load presets index: {e}")
                return {"version": "1.0", "presets": []}

    def _save_presets_index(self, presets_data: Dict[str, Any]):
        with self._state_lock:
            try:
                presets_data["last_updated"] = datetime.now().isoformat()
                self._atomic_write_json(self.presets_file, presets_data)
            except Exception as e:
                logger.error(f"Failed to save presets index: {e}")

    async def create_project(
        self,
        name: str,
        cover_url: Optional[str] = None,
        pipeline_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = datetime.now().isoformat()
        project = {
            "id": str(uuid.uuid4()),
            "name": name,
            "created_at": now,
            "updated_at": now,
            "cover_url": cover_url,
            "pipeline_hint": pipeline_hint,
            "task_count": 0,
            "last_task_id": None,
            "deleted_at": None,
        }
        with self._state_lock:
            data = self._load_projects_index()
            data.setdefault("projects", []).append(project)
            self._save_projects_index(data)
        return project

    async def list_projects(self, include_deleted: bool = False) -> List[Dict[str, Any]]:
        projects = self._load_projects_index().get("projects", [])
        if not include_deleted:
            projects = [item for item in projects if item.get("deleted_at") is None]
        projects.sort(key=lambda item: item.get("updated_at") or "", reverse=True)
        return projects

    async def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        projects = self._load_projects_index().get("projects", [])
        return next((item for item in projects if item["id"] == project_id), None)

    async def update_project(self, project_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._state_lock:
            data = self._load_projects_index()
            for project in data.get("projects", []):
                if project["id"] != project_id:
                    continue
                for key, value in updates.items():
                    if value is not None:
                        project[key] = value
                project["updated_at"] = datetime.now().isoformat()
                self._save_projects_index(data)
                return project
        return None

    async def delete_project(self, project_id: str, cascade: bool = False) -> Optional[Dict[str, Any]]:
        cascade_task_ids: List[str] = []
        with self._state_lock:
            data = self._load_projects_index()
            for project in data.get("projects", []):
                if project["id"] != project_id:
                    continue
                project["deleted_at"] = datetime.now().isoformat()
                project["updated_at"] = project["deleted_at"]
                self._save_projects_index(data)
                if cascade:
                    index = self._load_index()
                    cascade_task_ids = [
                        task["task_id"]
                        for task in list(index.get("tasks", []))
                        if task.get("project_id") == project_id
                    ]
                deleted_project = dict(project)
                break
            else:
                return None

        for task_id in cascade_task_ids:
            await self.delete_task(task_id)

        return deleted_project

    async def create_batch(
        self,
        *,
        pipeline: str,
        task_ids: List[str],
        project_id: Optional[str] = None,
        name: Optional[str] = None,
        batch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = datetime.now().isoformat()
        batch = {
            "id": batch_id or str(uuid.uuid4()),
            "name": name,
            "pipeline": pipeline,
            "project_id": project_id,
            "status": "pending",
            "total": len(task_ids),
            "succeeded": 0,
            "failed": 0,
            "cancelled": 0,
            "created_at": now,
            "updated_at": now,
            "cover_url": None,
            "deleted_at": None,
            "task_ids": list(task_ids),
        }
        with self._state_lock:
            data = self._load_batches_index()
            data.setdefault("batches", []).append(batch)
            self._save_batches_index(data)
        return batch

    async def get_batch(self, batch_id: str) -> Optional[Dict[str, Any]]:
        batches = self._load_batches_index().get("batches", [])
        return next((item for item in batches if item["id"] == batch_id), None)

    async def update_batch(self, batch_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._state_lock:
            data = self._load_batches_index()
            for batch in data.get("batches", []):
                if batch["id"] != batch_id:
                    continue
                for key, value in updates.items():
                    if value is not None:
                        batch[key] = value
                batch["updated_at"] = datetime.now().isoformat()
                self._save_batches_index(data)
                return batch
        return None

    async def delete_batch(self, batch_id: str) -> Optional[Dict[str, Any]]:
        with self._state_lock:
            data = self._load_batches_index()
            for batch in data.get("batches", []):
                if batch["id"] != batch_id:
                    continue
                batch["deleted_at"] = datetime.now().isoformat()
                batch["updated_at"] = batch["deleted_at"]
                self._save_batches_index(data)
                return dict(batch)
        return None

    async def list_batches(
        self,
        *,
        project_id: Optional[str] = None,
        unassigned_only: bool = False,
        status: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> Dict[str, Any]:
        batches = [
            batch
            for batch in self._load_batches_index().get("batches", [])
            if batch.get("deleted_at") is None
        ]
        if unassigned_only:
            batches = [batch for batch in batches if batch.get("project_id") is None]
        elif project_id is not None:
            batches = [batch for batch in batches if batch.get("project_id") == project_id]

        hydrated = [await self._hydrate_batch(batch) for batch in batches]
        if status:
            hydrated = [batch for batch in hydrated if batch.get("status") == status]

        hydrated.sort(key=lambda item: item.get("updated_at") or "", reverse=True)
        offset = int(cursor or 0)
        page_items = hydrated[offset:offset + limit]
        next_cursor = str(offset + limit) if offset + limit < len(hydrated) else None
        return {"items": page_items, "next_cursor": next_cursor}

    async def list_presets(self) -> List[Dict[str, Any]]:
        presets = self._load_presets_index().get("presets", [])
        presets.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return presets

    async def upsert_preset(self, preset: Dict[str, Any]) -> Dict[str, Any]:
        with self._state_lock:
            data = self._load_presets_index()
            presets = data.setdefault("presets", [])
            existing_idx = next(
                (index for index, item in enumerate(presets) if item.get("name") == preset.get("name")),
                None,
            )
            if existing_idx is not None:
                presets[existing_idx] = preset
            else:
                presets.append(preset)
            self._save_presets_index(data)
        return preset

    async def _load_task_snapshot(self, task_id: str) -> Optional[Dict[str, Any]]:
        from api.tasks import TaskType, task_manager

        live_task = task_manager.get_task(task_id)
        if live_task is not None:
            return live_task.model_dump(mode="json")

        metadata = await self.load_task_metadata(task_id)
        if metadata is None:
            return None

        input_payload = metadata.get("input", {})
        return {
            "task_id": task_id,
            "task_type": TaskType.VIDEO_GENERATION.value,
            "project_id": input_payload.get("project_id"),
            "batch_id": input_payload.get("batch_id"),
            "status": metadata.get("status", "pending"),
            "progress": None,
            "result": metadata.get("result"),
            "error": metadata.get("error"),
            "created_at": metadata.get("created_at"),
            "started_at": metadata.get("created_at"),
            "completed_at": metadata.get("completed_at"),
            "request_params": input_payload,
        }

    async def _hydrate_batch(self, batch: Dict[str, Any]) -> Dict[str, Any]:
        children = [
            child
            for task_id in batch.get("task_ids", [])
            if (child := await self._load_task_snapshot(task_id)) is not None
        ]
        statuses = [child.get("status") for child in children]
        succeeded = sum(1 for status in statuses if status == "completed")
        failed = sum(1 for status in statuses if status == "failed")
        cancelled = sum(1 for status in statuses if status == "cancelled")
        total = len(batch.get("task_ids", []))
        if total == 0:
            status = "pending"
        elif succeeded == total:
            status = "completed"
        elif cancelled == total:
            status = "cancelled"
        elif failed == total:
            status = "failed"
        elif any(status == "running" for status in statuses):
            status = "running"
        elif any(status == "pending" for status in statuses):
            status = "pending"
        else:
            status = "partial"

        latest_ts = batch.get("updated_at")
        cover_url = batch.get("cover_url")
        for child in children:
            child_result = child.get("result") or {}
            if cover_url is None and child_result.get("video_path"):
                cover_url = child_result.get("video_path")
            completed_at = child.get("completed_at") or child.get("created_at")
            if completed_at and (latest_ts is None or completed_at > latest_ts):
                latest_ts = completed_at

        hydrated = dict(batch)
        hydrated.update(
            {
                "status": status,
                "total": total,
                "succeeded": succeeded,
                "failed": failed,
                "cancelled": cancelled,
                "updated_at": latest_ts or batch.get("updated_at"),
                "cover_url": cover_url,
                "children": children,
            }
        )
        return hydrated

    def _derive_task_title(
        self,
        metadata: Dict[str, Any],
        storyboard: Optional[Storyboard] = None,
    ) -> str:
        title = metadata.get("input", {}).get("title")
        if title:
            return title
        if storyboard and storyboard.title:
            return storyboard.title
        input_text = metadata.get("input", {}).get("text", "")
        if input_text:
            return input_text[:30] + ("..." if len(input_text) > 30 else "")
        return "Untitled"

    def _build_artifacts_for_task(
        self,
        task_id: str,
        metadata: Dict[str, Any],
        storyboard: Optional[Storyboard],
    ) -> List[Dict[str, Any]]:
        created_at = metadata.get("completed_at") or metadata.get("created_at")
        input_payload = metadata.get("input", {})
        project_id = input_payload.get("project_id")
        batch_id = input_payload.get("batch_id")
        artifacts: List[Dict[str, Any]] = []

        def add_artifact(kind: str, artifact_id: str, **fields: Any) -> None:
            artifact = {
                "id": artifact_id,
                "kind": kind,
                "task_id": task_id,
                "project_id": project_id,
                "batch_id": batch_id,
                "created_at": created_at,
            }
            artifact.update(fields)
            artifacts.append(artifact)

        for key, prompt_key in (
            ("portrait_url", None),
            ("source_image", "motion_prompt"),
            ("target_image", "pose_workflow"),
        ):
            if input_payload.get(key):
                add_artifact(
                    "image",
                    f"{task_id}:{key}",
                    image_path=input_payload[key],
                    file_size=Path(input_payload[key]).stat().st_size if Path(input_payload[key]).exists() else 0,
                    prompt_used=input_payload.get(prompt_key) if prompt_key else input_payload.get("narration"),
                )

        if storyboard:
            for frame in storyboard.frames:
                if frame.image_path:
                    image_path = frame.composed_image_path or frame.image_path
                    add_artifact(
                        "image",
                        f"{task_id}:frame-image:{frame.index}",
                        image_path=image_path,
                        file_size=Path(image_path).stat().st_size if Path(image_path).exists() else 0,
                        prompt_used=frame.image_prompt,
                    )
                if frame.audio_path:
                    add_artifact(
                        "voice",
                        f"{task_id}:frame-audio:{frame.index}",
                        audio_path=frame.audio_path,
                        duration=frame.duration,
                        tts_voice=(
                            metadata.get("config", {}).get("tts_workflow")
                            or input_payload.get("tts_workflow")
                            or input_payload.get("voice_id")
                        ),
                        text=frame.narration,
                        file_size=Path(frame.audio_path).stat().st_size if Path(frame.audio_path).exists() else 0,
                    )
                if frame.narration:
                    add_artifact(
                        "script",
                        f"{task_id}:narration:{frame.index}",
                        text=frame.narration,
                        script_type="narration",
                        prompt_used=frame.image_prompt,
                    )
                if frame.image_prompt:
                    add_artifact(
                        "script",
                        f"{task_id}:prompt:{frame.index}",
                        text=frame.image_prompt,
                        script_type="prompt",
                        prompt_used=frame.image_prompt,
                    )

        if input_payload.get("text"):
            add_artifact(
                "script",
                f"{task_id}:script:input",
                text=input_payload["text"],
                script_type="script",
                prompt_used=input_payload.get("prompt_prefix"),
            )
        if input_payload.get("narration"):
            add_artifact(
                "script",
                f"{task_id}:script:narration",
                text=input_payload["narration"],
                script_type="narration",
                prompt_used=input_payload.get("prompt_prefix"),
            )
        if input_payload.get("motion_prompt"):
            add_artifact(
                "script",
                f"{task_id}:script:motion",
                text=input_payload["motion_prompt"],
                script_type="prompt",
                prompt_used=input_payload["motion_prompt"],
            )
        if input_payload.get("scenes"):
            for index, scene in enumerate(input_payload["scenes"]):
                media_path = scene.get("media")
                if media_path:
                    suffix = Path(media_path).suffix.lower()
                    if suffix not in {".mp4", ".mov", ".mkv", ".avi"}:
                        add_artifact(
                            "image",
                            f"{task_id}:scene-media:{index}",
                            image_path=media_path,
                            file_size=Path(media_path).stat().st_size if Path(media_path).exists() else 0,
                            prompt_used=scene.get("narration"),
                        )
                if scene.get("narration"):
                    add_artifact(
                        "script",
                        f"{task_id}:scene-script:{index}",
                        text=scene["narration"],
                        script_type="narration",
                        prompt_used=scene.get("narration"),
                    )
        if input_payload.get("bgm_path"):
            bgm_path = input_payload["bgm_path"]
            add_artifact(
                "bgm",
                f"{task_id}:bgm",
                name=Path(bgm_path).name,
                audio_path=bgm_path,
                source="history",
                duration=metadata.get("result", {}).get("duration"),
                file_size=Path(bgm_path).stat().st_size if Path(bgm_path).exists() else 0,
            )

        return artifacts

    async def _sync_project_from_metadata(self, task_id: str, metadata: Dict[str, Any]):
        project_id = metadata.get("input", {}).get("project_id")
        if not project_id:
            return

        with self._state_lock:
            data = self._load_projects_index()
            linked_tasks = [
                item for item in self._load_index().get("tasks", [])
                if item.get("project_id") == project_id and item.get("status") == "completed"
            ]

            for project in data.get("projects", []):
                if project["id"] != project_id:
                    continue
                project["task_count"] = len(linked_tasks)
                project["last_task_id"] = task_id
                project["updated_at"] = datetime.now().isoformat()
                break
            else:
                return

            self._save_projects_index(data)
    
    async def _update_index_for_task(self, task_id: str, metadata: Dict[str, Any]):
        """Update index entry for a specific task"""
        storyboard = await self.load_storyboard(task_id)
        title = self._derive_task_title(metadata, storyboard)

        with self._state_lock:
            index = self._load_index()

            # Extract key info for index
            index_entry = {
                "task_id": task_id,
                "created_at": metadata.get("created_at"),
                "completed_at": metadata.get("completed_at"),
                "status": metadata.get("status", "unknown"),
                "title": title,
                "duration": metadata.get("result", {}).get("duration", 0),
                "n_frames": metadata.get("result", {}).get("n_frames", 0),
                "file_size": metadata.get("result", {}).get("file_size", 0),
                "video_path": metadata.get("result", {}).get("video_path"),
                "project_id": metadata.get("input", {}).get("project_id"),
                "batch_id": metadata.get("input", {}).get("batch_id"),
                "pipeline": metadata.get("config", {}).get("pipeline"),
            }

            # Update or append
            tasks = index.get("tasks", [])
            existing_idx = next((i for i, t in enumerate(tasks) if t["task_id"] == task_id), None)

            if existing_idx is not None:
                tasks[existing_idx] = index_entry
            else:
                tasks.append(index_entry)

            index["tasks"] = tasks
            artifacts = [
                artifact
                for artifact in index.get("artifacts", [])
                if artifact.get("task_id") != task_id
            ]
            artifacts.extend(self._build_artifacts_for_task(task_id, metadata, storyboard))
            index["artifacts"] = artifacts
            self._save_index(index)
    
    async def rebuild_index(self):
        """Rebuild index by scanning all task directories"""
        logger.info("Rebuilding task index...")
        index = {"version": "2.0", "tasks": [], "artifacts": []}
        
        # Scan all directories
        for task_dir in self.output_dir.iterdir():
            if not task_dir.is_dir() or task_dir.name.startswith("."):
                continue
            
            task_id = task_dir.name
            metadata = await self.load_task_metadata(task_id)
            
            if metadata:
                storyboard = await self.load_storyboard(task_id)
                title = self._derive_task_title(metadata, storyboard)

                # Add to index
                index["tasks"].append({
                    "task_id": task_id,
                    "created_at": metadata.get("created_at"),
                    "completed_at": metadata.get("completed_at"),
                    "status": metadata.get("status", "unknown"),
                    "title": title,
                    "duration": metadata.get("result", {}).get("duration", 0),
                    "n_frames": metadata.get("result", {}).get("n_frames", 0),
                    "file_size": metadata.get("result", {}).get("file_size", 0),
                    "video_path": metadata.get("result", {}).get("video_path"),
                    "project_id": metadata.get("input", {}).get("project_id"),
                    "batch_id": metadata.get("input", {}).get("batch_id"),
                    "pipeline": metadata.get("config", {}).get("pipeline"),
                })
                index["artifacts"].extend(
                    self._build_artifacts_for_task(task_id, metadata, storyboard)
                )
        
        self._save_index(index)
        logger.info(f"Index rebuilt: {len(index['tasks'])} tasks")
    
    # ========================================================================
    # Paginated Listing
    # ========================================================================
    
    async def list_tasks_paginated(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """
        List tasks with pagination
        
        Args:
            page: Page number (1-indexed)
            page_size: Items per page
            status: Filter by status (optional)
            sort_by: Sort field (created_at, completed_at, title, duration)
            sort_order: Sort order (asc, desc)
        
        Returns:
            {
                "tasks": [...],          # List of task summaries
                "total": 100,            # Total matching tasks
                "page": 1,               # Current page
                "page_size": 20,         # Items per page
                "total_pages": 5         # Total pages
            }
        """
        index = self._load_index()
        tasks = index.get("tasks", [])
        
        # Filter by status
        if status:
            tasks = [t for t in tasks if t.get("status") == status]
        
        # Sort
        reverse = (sort_order == "desc")
        if sort_by in ["created_at", "completed_at"]:
            tasks.sort(
                key=lambda t: datetime.fromisoformat(t.get(sort_by, "1970-01-01T00:00:00")),
                reverse=reverse
            )
        elif sort_by in ["title", "duration", "n_frames"]:
            tasks.sort(key=lambda t: t.get(sort_by, ""), reverse=reverse)
        
        # Paginate
        total = len(tasks)
        total_pages = (total + page_size - 1) // page_size
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_tasks = tasks[start_idx:end_idx]
        
        return {
            "tasks": page_tasks,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

    async def list_video_items(
        self,
        project_id: Optional[str] = None,
        unassigned_only: bool = False,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> Dict[str, Any]:
        index = self._load_index()
        items = list(index.get("tasks", []))

        if unassigned_only:
            items = [item for item in items if item.get("project_id") is None]
        elif project_id is not None:
            items = [item for item in items if item.get("project_id") == project_id]

        items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        offset = int(cursor or 0)
        page_items = items[offset:offset + limit]
        next_cursor = str(offset + limit) if offset + limit < len(items) else None

        return {
            "items": page_items,
            "next_cursor": next_cursor,
        }

    async def get_video_item(self, task_id: str) -> Optional[Dict[str, Any]]:
        index = self._load_index()
        task_entry = next(
            (item for item in index.get("tasks", []) if item.get("task_id") == task_id),
            None,
        )
        metadata = await self.load_task_metadata(task_id)
        if task_entry is None or metadata is None:
            return None

        storyboard = await self.load_storyboard(task_id)
        audio_duration = None
        if storyboard is not None:
            audio_duration = sum(frame.duration for frame in storyboard.frames)

        detail = dict(task_entry)
        detail["audio_duration"] = audio_duration
        detail["metadata"] = metadata
        detail["storyboard"] = self._storyboard_to_dict(storyboard) if storyboard else None
        return detail

    async def list_library_items(
        self,
        *,
        kind: str,
        project_id: Optional[str] = None,
        unassigned_only: bool = False,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> Dict[str, Any]:
        index = self._load_index()
        items = [
            item for item in index.get("artifacts", [])
            if item.get("kind") == kind
        ]

        if unassigned_only:
            items = [item for item in items if item.get("project_id") is None]
        elif project_id is not None:
            items = [item for item in items if item.get("project_id") == project_id]

        items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        offset = int(cursor or 0)
        page_items = items[offset:offset + limit]
        next_cursor = str(offset + limit) if offset + limit < len(items) else None
        return {"items": page_items, "next_cursor": next_cursor}
    
    # ========================================================================
    # Statistics
    # ========================================================================
    
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
        index = self._load_index()
        tasks = index.get("tasks", [])
        
        stats = {
            "total_tasks": len(tasks),
            "completed": len([t for t in tasks if t.get("status") == "completed"]),
            "failed": len([t for t in tasks if t.get("status") == "failed"]),
            "total_duration": sum(t.get("duration", 0) for t in tasks),
            "total_size": sum(t.get("file_size", 0) for t in tasks),
        }
        
        return stats
    
    # ========================================================================
    # Delete Task
    # ========================================================================
    
    async def delete_task(self, task_id: str) -> bool:
        """
        Delete a task and all its files
        
        Args:
            task_id: Task ID to delete
        
        Returns:
            True if successful, False otherwise
        """
        try:
            import shutil
            
            task_dir = self.get_task_dir(task_id)
            if task_dir.exists():
                shutil.rmtree(task_dir)
                logger.info(f"Deleted task directory: {task_dir}")
            
            # Update index
            index = self._load_index()
            tasks = index.get("tasks", [])
            tasks = [t for t in tasks if t["task_id"] != task_id]
            index["tasks"] = tasks
            artifacts = index.get("artifacts", [])
            index["artifacts"] = [
                artifact for artifact in artifacts if artifact.get("task_id") != task_id
            ]
            self._save_index(index)
            
            return True
        except Exception as e:
            logger.error(f"Failed to delete task {task_id}: {e}")
            return False
