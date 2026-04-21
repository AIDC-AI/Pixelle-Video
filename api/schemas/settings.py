from __future__ import annotations

from typing import Any, Optional

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
