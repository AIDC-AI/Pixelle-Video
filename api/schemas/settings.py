from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_optional_url(value: Any) -> Any:
    if value in (None, ""):
        return value
    if isinstance(value, str) and value.startswith(("http://", "https://")):
        return value
    raise ValueError("Must be a valid http(s) URL.")


def _validate_optional_path(value: Any) -> Any:
    if value in (None, ""):
        return value
    if isinstance(value, str) and "/" in value and value.endswith(".html"):
        return value
    raise ValueError("Must be a template path ending with .html.")


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _default_tts_local_settings() -> "TTSLocalSettingsPayload":
    return TTSLocalSettingsPayload(voice="zh-CN-YunjianNeural", speed=1.2)


def _default_tts_comfy_settings() -> "TTSComfySettingsPayload":
    return TTSComfySettingsPayload(default_workflow=None)


def _default_tts_settings() -> "TTSSettingsPayload":
    return TTSSettingsPayload(
        inference_mode="local",
        local=_default_tts_local_settings(),
        comfyui=_default_tts_comfy_settings(),
    )


def _default_image_settings() -> "ImageSettingsPayload":
    return ImageSettingsPayload(default_workflow=None, prompt_prefix="")


def _default_video_settings() -> "VideoSettingsPayload":
    return VideoSettingsPayload(default_workflow=None, prompt_prefix="")


def _default_llm_settings() -> "LLMSettingsPayload":
    return LLMSettingsPayload(api_key="", base_url="", model="")


def _default_comfyui_settings() -> "ComfyUISettingsPayload":
    return ComfyUISettingsPayload(
        comfyui_url="http://127.0.0.1:8188",
        comfyui_api_key=None,
        runninghub_api_key=None,
        runninghub_concurrent_limit=1,
        runninghub_instance_type=None,
        tts=_default_tts_settings(),
        image=_default_image_settings(),
        video=_default_video_settings(),
    )


def _default_template_settings() -> "TemplateSettingsPayload":
    return TemplateSettingsPayload(default_template="1080x1920/default.html")


class LLMSettingsPayload(StrictModel):
    api_key: str = Field("", description="LLM API key (masked on read)")
    base_url: str = Field("", description="LLM API base URL")
    model: str = Field("", description="LLM model name")

    _base_url_validator = field_validator("base_url", mode="before")(_validate_optional_url)


class TTSLocalSettingsPayload(StrictModel):
    voice: str = Field("zh-CN-YunjianNeural", description="Local TTS voice")
    speed: float = Field(1.2, ge=0.5, le=2.0, description="Speech speed")


class TTSComfySettingsPayload(StrictModel):
    default_workflow: Optional[str] = Field(None, description="Default TTS workflow")


class TTSSettingsPayload(StrictModel):
    inference_mode: str = Field("local", description="TTS mode")
    local: TTSLocalSettingsPayload = Field(default_factory=_default_tts_local_settings)
    comfyui: TTSComfySettingsPayload = Field(default_factory=_default_tts_comfy_settings)


class ImageSettingsPayload(StrictModel):
    default_workflow: Optional[str] = Field(None, description="Default image workflow")
    prompt_prefix: str = Field("", description="Image prompt prefix")


class VideoSettingsPayload(StrictModel):
    default_workflow: Optional[str] = Field(None, description="Default video workflow")
    prompt_prefix: str = Field("", description="Video prompt prefix")


class ComfyUISettingsPayload(StrictModel):
    comfyui_url: str = Field("http://127.0.0.1:8188", description="ComfyUI endpoint")
    comfyui_api_key: Optional[str] = Field(None, description="ComfyUI API key (masked on read)")
    runninghub_api_key: Optional[str] = Field(None, description="RunningHub API key (masked on read)")
    runninghub_concurrent_limit: int = Field(1, ge=1, le=10, description="RunningHub concurrent limit")
    runninghub_instance_type: Optional[str] = Field(None, description="RunningHub instance type")
    tts: TTSSettingsPayload = Field(default_factory=_default_tts_settings)
    image: ImageSettingsPayload = Field(default_factory=_default_image_settings)
    video: VideoSettingsPayload = Field(default_factory=_default_video_settings)

    _comfyui_url_validator = field_validator("comfyui_url", mode="before")(_validate_optional_url)


class TemplateSettingsPayload(StrictModel):
    default_template: str = Field("1080x1920/default.html", description="Default template path")

    _default_template_validator = field_validator("default_template", mode="before")(_validate_optional_path)


class SettingsPayload(StrictModel):
    project_name: str = Field("Pixelle-Video", description="Project name")
    llm: LLMSettingsPayload = Field(default_factory=_default_llm_settings, description="LLM settings")
    comfyui: ComfyUISettingsPayload = Field(
        default_factory=_default_comfyui_settings,
        description="ComfyUI settings",
    )
    template: TemplateSettingsPayload = Field(
        default_factory=_default_template_settings,
        description="Template settings",
    )


class LLMSettingsUpdatePayload(StrictModel):
    api_key: Optional[str] = Field(None, description="LLM API key")
    base_url: Optional[str] = Field(None, description="LLM API base URL")
    model: Optional[str] = Field(None, description="LLM model name")

    _base_url_validator = field_validator("base_url", mode="before")(_validate_optional_url)


class TTSLocalSettingsUpdatePayload(StrictModel):
    voice: Optional[str] = Field(None, description="Local TTS voice")
    speed: Optional[float] = Field(None, ge=0.5, le=2.0, description="Speech speed")


class TTSComfySettingsUpdatePayload(StrictModel):
    default_workflow: Optional[str] = Field(None, description="Default TTS workflow")


class TTSSettingsUpdatePayload(StrictModel):
    inference_mode: Optional[str] = Field(None, description="TTS mode")
    local: Optional[TTSLocalSettingsUpdatePayload] = Field(None, description="Local TTS settings")
    comfyui: Optional[TTSComfySettingsUpdatePayload] = Field(None, description="ComfyUI TTS settings")


class ImageSettingsUpdatePayload(StrictModel):
    default_workflow: Optional[str] = Field(None, description="Default image workflow")
    prompt_prefix: Optional[str] = Field(None, description="Image prompt prefix")


class VideoSettingsUpdatePayload(StrictModel):
    default_workflow: Optional[str] = Field(None, description="Default video workflow")
    prompt_prefix: Optional[str] = Field(None, description="Video prompt prefix")


class ComfyUISettingsUpdatePayload(StrictModel):
    comfyui_url: Optional[str] = Field(None, description="ComfyUI endpoint")
    comfyui_api_key: Optional[str] = Field(None, description="ComfyUI API key")
    runninghub_api_key: Optional[str] = Field(None, description="RunningHub API key")
    runninghub_concurrent_limit: Optional[int] = Field(None, ge=1, le=10, description="RunningHub concurrent limit")
    runninghub_instance_type: Optional[str] = Field(None, description="RunningHub instance type")
    tts: Optional[TTSSettingsUpdatePayload] = Field(None, description="TTS settings")
    image: Optional[ImageSettingsUpdatePayload] = Field(None, description="Image settings")
    video: Optional[VideoSettingsUpdatePayload] = Field(None, description="Video settings")

    _comfyui_url_validator = field_validator("comfyui_url", mode="before")(_validate_optional_url)


class TemplateSettingsUpdatePayload(StrictModel):
    default_template: Optional[str] = Field(None, description="Default template path")

    _default_template_validator = field_validator("default_template", mode="before")(_validate_optional_path)


class SettingsUpdatePayload(StrictModel):
    project_name: Optional[str] = Field(None, description="Project name")
    llm: Optional[LLMSettingsUpdatePayload] = Field(None, description="LLM settings")
    comfyui: Optional[ComfyUISettingsUpdatePayload] = Field(None, description="ComfyUI settings")
    template: Optional[TemplateSettingsUpdatePayload] = Field(None, description="Template settings")


class ComfyUICheckRequest(StrictModel):
    comfyui_url: Optional[str] = Field(None, description="ComfyUI endpoint override")
    comfyui_api_key: Optional[str] = Field(None, description="ComfyUI API key override")

    _comfyui_url_validator = field_validator("comfyui_url", mode="before")(_validate_optional_url)


class LLMConnectionCheckRequest(StrictModel):
    api_key: Optional[str] = Field(None, description="LLM API key override")
    base_url: Optional[str] = Field(None, description="LLM API base URL override")
    model: Optional[str] = Field(None, description="LLM model override")

    _base_url_validator = field_validator("base_url", mode="before")(_validate_optional_url)


class RunningHubConnectionCheckRequest(StrictModel):
    runninghub_api_key: Optional[str] = Field(None, description="RunningHub API key override")
    runninghub_instance_type: Optional[str] = Field(None, description="RunningHub instance type override")


class ProviderConnectionDiagnosticsPayload(StrictModel):
    error_code: Optional[str] = Field(None, description="Normalized validation error code")
    model_count: Optional[int] = Field(None, description="Available model count for LLM providers")
    selected_model: Optional[str] = Field(None, description="Currently selected model")
    selected_model_available: Optional[bool] = Field(None, description="Whether the selected model is available")
    auth_applied: Optional[bool] = Field(None, description="Whether credentials were attached to the probe request")
    auth_required: Optional[bool] = Field(None, description="Whether the upstream reported authentication as required")
    api_type: Optional[str] = Field(None, description="RunningHub API account type")
    current_task_nums: Optional[int] = Field(None, description="RunningHub current task count")
    remain_num: Optional[str] = Field(None, description="Remaining RunningHub credits or quota")
    remain_money: Optional[str] = Field(None, description="Remaining RunningHub balance")
    currency: Optional[str] = Field(None, description="RunningHub balance currency")


class ProviderConnectionCheckResponse(StrictModel):
    provider: Literal["llm", "comfyui", "runninghub"] = Field(..., description="Validated provider")
    status: Literal["success", "warning", "error"] = Field(..., description="Validation status")
    success: bool = Field(..., description="Whether the validation fully succeeded")
    reachable: bool = Field(..., description="Whether the upstream endpoint responded")
    authenticated: bool = Field(..., description="Whether authentication succeeded")
    message: str = Field(..., description="Human-readable validation result")
    endpoint: Optional[str] = Field(None, description="Checked endpoint URL")
    status_code: Optional[int] = Field(None, description="HTTP status code when available")
    response_time_ms: Optional[int] = Field(None, description="Response time in milliseconds")
    diagnostics: ProviderConnectionDiagnosticsPayload = Field(
        default_factory=ProviderConnectionDiagnosticsPayload,
        description="Provider-specific diagnostics",
    )


class ComfyUICheckResponse(ProviderConnectionCheckResponse):
    provider: Literal["comfyui"] = Field("comfyui", description="Validated provider")


class LLMConnectionCheckResponse(ProviderConnectionCheckResponse):
    provider: Literal["llm"] = Field("llm", description="Validated provider")


class RunningHubConnectionCheckResponse(ProviderConnectionCheckResponse):
    provider: Literal["runninghub"] = Field("runninghub", description="Validated provider")


class StoragePathStatsPayload(StrictModel):
    key: str = Field(..., description="Storage bucket identifier")
    path: str = Field(..., description="Runtime path")
    exists: bool = Field(..., description="Whether the path exists")
    file_count: int = Field(..., description="Total files under the path")
    total_size_bytes: int = Field(..., description="Total storage size in bytes")


class StorageStatsResponse(StrictModel):
    success: bool = Field(True, description="Whether stats were collected")
    message: str = Field("Storage statistics loaded", description="Human-readable result")
    total_size_bytes: int = Field(..., description="Combined storage size")
    paths: list[StoragePathStatsPayload] = Field(default_factory=list, description="Per-path storage stats")


class StorageCleanupRequest(StrictModel):
    target: str = Field("temp", description="Cleanup target, currently only temp is supported")


class StorageCleanupResponse(StrictModel):
    success: bool = Field(True, description="Whether cleanup completed")
    message: str = Field("Cleanup completed", description="Human-readable result")
    target: str = Field(..., description="Cleanup target")
    deleted_files: int = Field(..., description="Number of deleted files")
    deleted_directories: int = Field(..., description="Number of deleted directories")
    reclaimed_bytes: int = Field(..., description="Disk space reclaimed in bytes")
