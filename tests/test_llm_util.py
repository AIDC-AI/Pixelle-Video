from pixelle_video.utils.llm_util import _build_models_url, normalize_openai_base_url


def test_ssycloud_models_url():
    assert (
        _build_models_url("https://router.shengsuanyun.com/api/v1")
        == "https://router.shengsuanyun.com/api/v1/models"
    )


def test_ssycloud_chat_endpoint_is_normalized_to_sdk_base_url():
    assert (
        normalize_openai_base_url(
            "https://router.shengsuanyun.com/api/v1/chat/completions"
        )
        == "https://router.shengsuanyun.com/api/v1"
    )
