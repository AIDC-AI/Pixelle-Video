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
OS utilities for file and path management

Provides utilities for managing paths and files in Pixelle-Video.
Inspired by Pixelle-MCP's os_util.py.
"""

import os
import random
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, Literal


def get_pixelle_video_root_path() -> str:
    """
    Get Pixelle-Video root path
    
    Uses PIXELLE_VIDEO_ROOT environment variable to determine project root.
    This ensures reliable path resolution in both development and packaged environments.
    
    Returns:
        Project root path as string
    """
    # Check environment variable (required for reliable operation)
    env_root = os.environ.get("PIXELLE_VIDEO_ROOT")
    if env_root and Path(env_root).exists():
        return str(Path(env_root).resolve())
    
    # Fallback to current working directory if environment variable not set
    # (for development environments where env var might not be set)
    return str(Path.cwd())


def ensure_pixelle_video_root_path() -> str:
    """
    Ensure Pixelle-Video root path exists and return the path
    
    Returns:
        Root path as string
    """
    root_path = get_pixelle_video_root_path()
    root_path_obj = Path(root_path)
    output_dir = root_path_obj / 'output'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    return root_path


def get_root_path(*paths: str) -> str:
    """
    Get path relative to Pixelle-Video root path
    
    Args:
        *paths: Path components to join
    
    Returns:
        Absolute path as string
    
    Example:
        get_root_path("temp", "audio.mp3")
        # Returns: "/path/to/project/temp/audio.mp3"
    """
    root_path = ensure_pixelle_video_root_path()
    if paths:
        return os.path.join(root_path, *paths)
    return root_path


def get_temp_path(*paths: str) -> str:
    """
    Get path relative to Pixelle-Video temp folder
    
    Ensures temp directory exists before returning path.
    
    Args:
        *paths: Path components to join
    
    Returns:
        Absolute path to temp directory or file
    
    Example:
        get_temp_path("audio.mp3")
        # Returns: "/path/to/project/temp/audio.mp3"
    """
    temp_path = get_root_path("temp")
    
    # Ensure temp directory exists
    os.makedirs(temp_path, exist_ok=True)
    
    if paths:
        return os.path.join(temp_path, *paths)
    return temp_path


def get_data_path(*paths: str) -> str:
    """
    Get path relative to Pixelle-Video data folder

    Ensures data directory exists before returning path.
    
    Args:
        *paths: Path components to join
    
    Returns:
        Absolute path to data directory or file
    
    Example:
        get_data_path("videos", "output.mp4")
        # Returns: "/path/to/project/data/videos/output.mp4"
    """
    data_path = get_root_path("data")

    # Ensure data directory exists
    os.makedirs(data_path, exist_ok=True)
    
    if paths:
        return os.path.join(data_path, *paths)
    return data_path


def get_output_path(*paths: str) -> str:
    """
    Get path relative to Pixelle-Video output folder

    Ensures output directory exists before returning path.
    
    Args:
        *paths: Path components to join
    
    Returns:
        Absolute path to output directory or file
    
    Example:
        get_output_path("video.mp4")
        # Returns: "/path/to/project/output/video.mp4"
    """
    output_path = get_root_path("output")

    # Ensure output directory exists
    os.makedirs(output_path, exist_ok=True)
    
    if paths:
        return os.path.join(output_path, *paths)
    return output_path


def save_bytes_to_file(data: bytes, file_path: str) -> str:
    """
    Save bytes data to file
    
    Creates parent directories if they don't exist.
    
    Args:
        data: Binary data to save
        file_path: Target file path
    
    Returns:
        Absolute path of saved file
    
    Example:
        save_bytes_to_file(audio_data, get_temp_path("audio.mp3"))
    """
    # Ensure parent directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    # Write binary data
    with open(file_path, "wb") as f:
        f.write(data)
    
    return os.path.abspath(file_path)


def ensure_dir(path: str) -> str:
    """
    Ensure directory exists, create if not
    
    Args:
        path: Directory path
    
    Returns:
        Absolute path of directory
    """
    os.makedirs(path, exist_ok=True)
    return os.path.abspath(path)


# ========== Task Directory Management ==========

def create_task_id() -> str:
    """
    Create unique task ID with timestamp + random suffix
    
    Format: {timestamp}_{random_hex}
    Example: "20251028_143052_ab3d"
    
    Collision probability: < 0.0001% (65536 combinations per second)
    
    Returns:
        Task ID string
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    random_suffix = f"{random.randint(0, 0xFFFF):04x}"  # 4-digit hex (0000-ffff)
    return f"{timestamp}_{random_suffix}"


def create_task_output_dir(task_id: Optional[str] = None) -> Tuple[str, str]:
    """
    Create isolated output directory for single video generation task
    
    Directory structure:
        output/{task_id}/
        ├── final.mp4           # Final video output
        ├── frames/             # All frame-related files
        │   ├── 01_audio.mp3
        │   ├── 01_image.png
        │   ├── 01_composed.png
        │   ├── 01_segment.mp4
        │   └── ...
        └── metadata.json       # Optional: task metadata
    
    Args:
        task_id: Optional task ID (auto-generated if None)
    
    Returns:
        (task_dir, task_id) tuple
        
    Example:
        >>> task_dir, task_id = create_task_output_dir()
        >>> # task_dir = "/path/to/project/output/20251028_143052_ab3d"
        >>> # task_id = "20251028_143052_ab3d"
    """
    if task_id is None:
        task_id = create_task_id()
    
    task_dir = get_output_path(task_id)
    frames_dir = os.path.join(task_dir, "frames")
    
    # Create directories
    os.makedirs(frames_dir, exist_ok=True)
    
    return task_dir, task_id


def get_task_path(task_id: str, *paths: str) -> str:
    """
    Get path within task directory
    
    Args:
        task_id: Task ID
        *paths: Path components to join
    
    Returns:
        Absolute path within task directory
        
    Example:
        >>> get_task_path("20251028_143052_ab3d", "final.mp4")
        >>> # Returns: "/path/to/project/output/20251028_143052_ab3d/final.mp4"
    """
    task_dir = get_output_path(task_id)
    if paths:
        return os.path.join(task_dir, *paths)
    return task_dir


def get_task_frame_path(
    task_id: str, 
    frame_index: int, 
    file_type: Literal["audio", "image", "video", "composed", "segment"]
) -> str:
    """
    Get frame file path within task directory
    
    Args:
        task_id: Task ID
        frame_index: Frame index (0-based internally, but filename starts from 01)
        file_type: File type (audio/image/video/composed/segment)
    
    Returns:
        Absolute path to frame file
        
    Example:
        >>> get_task_frame_path("20251028_143052_ab3d", 0, "audio")
        >>> # Returns: ".../output/20251028_143052_ab3d/frames/01_audio.mp3"
    """
    ext_map = {
        "audio": "mp3",
        "image": "png",
        "video": "mp4",
        "composed": "png",
        "segment": "mp4"
    }
    
    # Frame number starts from 01 for better human readability
    filename = f"{frame_index + 1:02d}_{file_type}.{ext_map[file_type]}"
    return get_task_path(task_id, "frames", filename)


def get_task_final_video_path(task_id: str) -> str:
    """
    Get final video path within task directory
    
    Args:
        task_id: Task ID
    
    Returns:
        Absolute path to final video
        
    Example:
        >>> get_task_final_video_path("20251028_143052_ab3d")
        >>> # Returns: ".../output/20251028_143052_ab3d/final.mp4"
    """
    return get_task_path(task_id, "final.mp4")


# ========== Resource Management (Templates/BGM/Workflows) ==========

def get_resource_path(resource_type: Literal["bgm", "templates", "workflows"], *paths: str) -> str:
    """
    Get resource file path with custom override support
    
    Search priority:
        1. data/{resource_type}/*paths  (custom, higher priority)
        2. {resource_type}/*paths       (default, fallback)
    
    Args:
        resource_type: Resource type ("bgm", "templates", "workflows")
        *paths: Path components relative to resource directory
    
    Returns:
        Absolute path to resource file (custom if exists, otherwise default)
    
    Raises:
        FileNotFoundError: If file not found in either location
        
    Examples:
        >>> get_resource_path("bgm", "happy.mp3")
        # Returns: "data/bgm/happy.mp3" (if exists) or "bgm/happy.mp3"
        
        >>> get_resource_path("templates", "1080x1920", "default.html")
        # Returns: "data/templates/1080x1920/default.html" or "templates/1080x1920/default.html"
        
        >>> get_resource_path("workflows", "selfhost", "image_flux.json")
        # Returns: "data/workflows/selfhost/image_flux.json" or "workflows/selfhost/image_flux.json"
    """
    # Build custom path (data/*)
    custom_path = get_data_path(resource_type, *paths)
    
    # Build default path (root/*)
    default_path = get_root_path(resource_type, *paths)
    
    # Priority: custom > default
    if os.path.exists(custom_path):
        return custom_path
    
    if os.path.exists(default_path):
        return default_path
    
    # Not found in either location
    raise FileNotFoundError(
        f"Resource not found: {os.path.join(resource_type, *paths)}\n"
        f"  Searched locations:\n"
        f"    1. {custom_path} (custom)\n"
        f"    2. {default_path} (default)"
    )


def list_resource_files(
    resource_type: Literal["bgm", "templates", "workflows"],
    subdir: str = ""
) -> list[str]:
    """
    List resource files with custom override support
    
    Merges files from both default and custom locations:
        - Files from data/{resource_type}/* (custom, higher priority)
        - Files from {resource_type}/* (default)
        - Duplicate names are deduplicated (custom takes precedence)
    
    Args:
        resource_type: Resource type ("bgm", "templates", "workflows")
        subdir: Optional subdirectory (e.g., "1080x1920" for templates)
    
    Returns:
        Sorted list of filenames (deduplicated, custom overrides default)
        
    Examples:
        >>> list_resource_files("bgm")
        # Returns: ["custom.mp3", "default.mp3", "happy.mp3"]
        # (merged from bgm/ and data/bgm/)
        
        >>> list_resource_files("templates", "1080x1920")
        # Returns: ["custom.html", "default.html", "modern.html"]
        # (merged from templates/1080x1920/ and data/templates/1080x1920/)
    """
    files = {}  # Use dict to track source priority: {filename: path}
    
    # Build directory paths
    default_dir = Path(get_root_path(resource_type, subdir)) if subdir else Path(get_root_path(resource_type))
    custom_dir = Path(get_data_path(resource_type, subdir)) if subdir else Path(get_data_path(resource_type))
    
    # Scan default directory first (lower priority)
    if default_dir.exists() and default_dir.is_dir():
        for item in default_dir.iterdir():
            if item.is_file():
                files[item.name] = str(item)
    
    # Scan custom directory (higher priority, overwrites)
    if custom_dir.exists() and custom_dir.is_dir():
        for item in custom_dir.iterdir():
            if item.is_file():
                files[item.name] = str(item)  # Overwrite if exists
    
    return sorted(files.keys())


def list_resource_dirs(
    resource_type: Literal["bgm", "templates", "workflows"]
) -> list[str]:
    """
    List subdirectories in resource directory
    
    Merges directories from both default and custom locations.
    
    Args:
        resource_type: Resource type ("bgm", "templates", "workflows")
    
    Returns:
        Sorted list of directory names (deduplicated)
        
    Examples:
        >>> list_resource_dirs("templates")
        # Returns: ["1080x1080", "1080x1920", "1920x1080"]
        
        >>> list_resource_dirs("workflows")
        # Returns: ["runninghub", "selfhost"]
    """
    dirs = set()
    
    # Build directory paths
    default_dir = Path(get_root_path(resource_type))
    custom_dir = Path(get_data_path(resource_type))
    
    # Scan default directory
    if default_dir.exists() and default_dir.is_dir():
        for item in default_dir.iterdir():
            if item.is_dir():
                dirs.add(item.name)
    
    # Scan custom directory
    if custom_dir.exists() and custom_dir.is_dir():
        for item in custom_dir.iterdir():
            if item.is_dir():
                dirs.add(item.name)
    
    return sorted(dirs)


def resource_exists(resource_type: Literal["bgm", "templates", "workflows"], *paths: str) -> bool:
    """
    Check if resource file exists (in custom or default location)
    
    Args:
        resource_type: Resource type ("bgm", "templates", "workflows")
        *paths: Path components relative to resource directory
    
    Returns:
        True if exists in either location, False otherwise
        
    Examples:
        >>> resource_exists("bgm", "happy.mp3")
        True
        
        >>> resource_exists("templates", "1080x1920", "default.html")
        True
    """
    custom_path = get_data_path(resource_type, *paths)
    default_path = get_root_path(resource_type, *paths)
    
    return os.path.exists(custom_path) or os.path.exists(default_path)

