from pixelle_video.config.schema import APIProvidersConfig
from pixelle_video.services.api_media import APIProviderMediaService
from pixelle_video.services.api_services.ssycloud_media import SSYCloudMediaClient


def test_ssycloud_media_config_defaults():
    config = APIProvidersConfig()

    assert config.ssycloud.api_key == ""
    assert config.ssycloud.base_url == ""
    assert config.ssycloud.use_proxy is False


def test_ssycloud_base_url_normalization():
    assert SSYCloudMediaClient.DEFAULT_BASE_URL.endswith("/v1/tasks/generations")
    assert (
        SSYCloudMediaClient._normalize_base_url(
            "https://router.shengsuanyun.com/api/v1/tasks/generations"
        )
        == "https://router.shengsuanyun.com/api/v1"
    )
    assert (
        SSYCloudMediaClient._normalize_base_url("https://router.shengsuanyun.com/api")
        == "https://router.shengsuanyun.com/api/v1"
    )


def test_ssycloud_gpt_image_payload_stays_minimal():
    payload = SSYCloudMediaClient._build_image_payload(
        prompt="A calm lake",
        model="openai/gpt-image-2",
        aspect_ratio="16:9",
        seed=None,
    )

    assert payload == {"model": "openai/gpt-image-2", "prompt": "A calm lake"}


def test_ssycloud_seedance_payload_uses_content_array():
    payload = SSYCloudMediaClient._build_video_payload(
        prompt="A calm lake",
        model="bytedance/doubao-seedance-2-0",
        duration=5,
        video_ratio="16:9",
        resolution="720p",
        negative_prompt=None,
        seed=7,
        watermark=False,
        generate_audio=True,
    )

    assert payload["content"] == [{"type": "text", "text": "A calm lake"}]
    assert payload["duration"] == 5
    assert payload["seed"] == 7
    assert payload["generate_audio"] is True


def test_ssycloud_extracts_nested_video_url():
    data = {
        "status": "COMPLETED",
        "data": {"url": ["https://oss.shengsuanyun.com/output/video.mp4"]},
    }

    assert (
        SSYCloudMediaClient._extract_output_url(data, "video")
        == "https://oss.shengsuanyun.com/output/video.mp4"
    )


def test_ssycloud_output_download_client_does_not_send_api_key():
    client = SSYCloudMediaClient(api_key="secret-test-key")._download_client()

    try:
        assert "Authorization" not in client.headers
        assert "secret-test-key" not in str(client.headers)
    finally:
        client.close()


def test_ssycloud_workflows_are_exposed_as_api_media_models():
    workflows = APIProviderMediaService({}).list_workflows()
    by_key = {workflow["key"]: workflow for workflow in workflows}

    assert {
        workflow["model"]
        for workflow in workflows
        if workflow["provider"] == "ssycloud" and workflow["media_type"] == "image"
    } == {
        "openai/gpt-image-2",
        "bytedance/doubao-seedream-5-0-pro",
        "google/gemini-3.1-flash-image",
    }
    assert {
        workflow["model"]
        for workflow in workflows
        if workflow["provider"] == "ssycloud" and workflow["media_type"] == "video"
    } == APIProviderMediaService.SSYCLOUD_SEEDANCE_MODELS

    expected_display_names = {
        "api/ssycloud/openai/gpt-image-2": "gpt-image-2-API-SSYCloud",
        "api/ssycloud/bytedance/doubao-seedream-5-0-pro": "doubao-seedream-5-0-Pro-API-SSYCloud",
        "api/ssycloud/google/gemini-3.1-flash-image": "gemini-3-1-image-flash SSYCloud",
        "api/ssycloud/bytedance/doubao-seedance-2-5": "doubao-seedance-2-5-SSYCloud",
        "api/ssycloud/bytedance/doubao-seedance-2-0": "doubao-seedance-2-0-SSYCloud",
        "api/ssycloud/bytedance/doubao-seedance-2-0-fast": "doubao-seedance-2-0-fast-SSYCloud",
    }
    for key, display_name in expected_display_names.items():
        assert by_key[key]["display_name"] == display_name

    assert "api/ssycloud/black-forest-labs/flux-1.1-pro-ultra" not in by_key
    assert "api/ssycloud/google/veo3" not in by_key

    for model in APIProviderMediaService.SSYCLOUD_SEEDANCE_MODELS:
        workflow = by_key[f"api/ssycloud/{model}"]
        assert workflow["media_type"] == "video"
        assert set(workflow["adapter_ability_types"]) >= {
            "text_to_video",
            "first_frame_i2v",
            "reference_to_video",
            "action_transfer",
            "digital_human",
        }

    assert all(
        workflow["display_name"].endswith("SSYCloud")
        for workflow in workflows
        if workflow["provider"] == "ssycloud"
    )


def test_ssycloud_seedance_models_reuse_the_same_payload_shape():
    for model in APIProviderMediaService.SSYCLOUD_SEEDANCE_MODELS:
        payload = SSYCloudMediaClient._build_video_payload(
            prompt="A calm lake",
            model=model,
            duration=5,
            video_ratio="16:9",
            resolution="720p",
            negative_prompt=None,
            seed=7,
            watermark=False,
            generate_audio=True,
        )

        assert payload["model"] == model
        assert payload["content"] == [{"type": "text", "text": "A calm lake"}]
        assert payload["duration"] == 5
        assert payload["resolution"] == "720p"


def test_ssycloud_seedance_payload_reuses_existing_media_inputs(tmp_path):
    image_path = tmp_path / "person.png"
    video_path = tmp_path / "motion.mp4"
    audio_path = tmp_path / "speech.mp3"
    image_path.write_bytes(b"image")
    video_path.write_bytes(b"video")
    audio_path.write_bytes(b"audio")

    payload = SSYCloudMediaClient._build_video_payload(
        prompt="Make the person speak and follow the reference motion",
        model="bytedance/doubao-seedance-2-5",
        duration=5,
        video_ratio="9:16",
        resolution="720p",
        negative_prompt=None,
        seed=None,
        watermark=False,
        generate_audio=True,
        image_path=str(image_path),
        first_clip_path=str(video_path),
        reference_audio_path=str(audio_path),
    )

    content = payload["content"]
    assert content[1]["image_url"]["role"] == "first_frame"
    assert content[1]["image_url"]["url"].startswith("data:image/png;base64,")
    assert content[2]["video_url"]["role"] == "reference_video"
    assert content[2]["video_url"]["url"].startswith("data:video/mp4;base64,")
    assert content[3]["audio_url"]["role"] == "reference_audio"
    assert content[3]["audio_url"]["url"].startswith("data:audio/mpeg;base64,")
