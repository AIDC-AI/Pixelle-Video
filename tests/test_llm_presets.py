from pixelle_video.llm_presets import find_preset_by_base_url_and_model, get_preset


def test_ssycloud_preset_uses_openai_compatible_endpoint():
    preset = get_preset("SSYCloud")

    assert preset == {
        "name": "SSYCloud",
        "base_url": "https://router.shengsuanyun.com/api/v1",
        "model": "deepseek/deepseek-v4-flash",
        "api_key_url": "https://console.shengsuanyun.com",
    }


def test_preset_matching_ignores_trailing_slash():
    assert (
        find_preset_by_base_url_and_model(
            "https://router.shengsuanyun.com/api/v1/",
            "deepseek/deepseek-v4-flash",
        )
        == "SSYCloud"
    )


def test_preset_matching_normalizes_concrete_chat_endpoint():
    assert (
        find_preset_by_base_url_and_model(
            "https://router.shengsuanyun.com/api/v1/chat/completions",
            "deepseek/deepseek-v4-flash",
        )
        == "SSYCloud"
    )
