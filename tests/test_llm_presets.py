from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "pixelle_video" / "llm_presets.py"
SPEC = spec_from_file_location("llm_presets", MODULE_PATH)
assert SPEC and SPEC.loader
llm_presets = module_from_spec(SPEC)
SPEC.loader.exec_module(llm_presets)


def test_atlas_cloud_preset() -> None:
    preset = llm_presets.get_preset("Atlas Cloud")

    assert preset == {
        "name": "Atlas Cloud",
        "base_url": "https://api.atlascloud.ai/v1",
        "model": "deepseek-ai/deepseek-v4-pro",
        "api_key_url": "https://www.atlascloud.ai/console/api-keys",
    }
    assert "Atlas Cloud" in llm_presets.get_preset_names()
    assert (
        llm_presets.find_preset_by_base_url_and_model(
            preset["base_url"], preset["model"]
        )
        == "Atlas Cloud"
    )
