from pathlib import Path

from web.components.sensitive_words_detector import (
    build_sensitive_words_detection_prompt,
    detect_sensitive_words_with_ai,
    read_sensitive_words_content,
)


def test_build_prompt_contains_document_and_sensitive_words():
    prompt = build_sensitive_words_detection_prompt(
        document="这是一段包含养生建议的短视频文案。",
        sensitive_words_content="# Sensitive Words\n\n养生\n长生不老\n",
    )

    assert "这是一段包含养生建议的短视频文案。" in prompt
    assert "# Sensitive Words" in prompt
    assert "养生" in prompt
    assert "长生不老" in prompt
    assert "检测结论" in prompt
    assert "检测意见" in prompt


def test_build_prompt_handles_empty_sensitive_words_content():
    prompt = build_sensitive_words_detection_prompt(
        document="普通文案",
        sensitive_words_content="",
    )

    assert "普通文案" in prompt
    assert "sensitive_words.md 当前为空" in prompt


def test_read_sensitive_words_content_reads_existing_file(tmp_path: Path):
    words_file = tmp_path / "sensitive_words.md"
    words_file.write_text("# Sensitive Words\n\n养生\n", encoding="utf-8")

    assert read_sensitive_words_content(words_file) == "# Sensitive Words\n\n养生\n"


def test_read_sensitive_words_content_returns_empty_for_missing_file(tmp_path: Path):
    assert read_sensitive_words_content(tmp_path / "missing.md") == ""


async def test_detect_sensitive_words_uses_preinitialized_llm(monkeypatch):
    captured = {}

    async def fake_llm(**kwargs):
        captured.update(kwargs)
        return "检测通过"

    monkeypatch.setattr(
        "web.components.sensitive_words_detector.read_sensitive_words_content",
        lambda: "# Sensitive Words\n\n养生\n",
    )

    result = await detect_sensitive_words_with_ai("这是一段养生文案", fake_llm)

    assert result == "检测通过"
    assert "这是一段养生文案" in captured["prompt"]
    assert "养生" in captured["prompt"]
    assert captured["temperature"] == 0.2
    assert captured["max_tokens"] == 1600
