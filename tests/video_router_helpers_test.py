import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

try:
    from api.routers import video
    from api.schemas.video import VideoGenerateRequest
except ModuleNotFoundError as exc:
    if exc.name == "fastapi":
        raise unittest.SkipTest("fastapi is not installed") from exc
    raise


class DummyRequest:
    base_url = "http://testserver/"


class VideoRouterHelperTest(unittest.TestCase):
    def test_build_video_params_centralizes_optional_fields(self):
        with patch.object(video, "get_template_media_size", return_value=(1080, 1440)):
            request = VideoGenerateRequest(
                text="source text",
                mode="generate",
                frame_template="1080x1920/image_default.html",
                tts_workflow="runninghub/tts_edge.json",
                ref_audio="voice.wav",
                voice_id="legacy",
                template_params={"accent_color": "#fff"},
            )

            params = video.build_video_params(request)

        self.assertEqual(
            params,
            {
                "text": "source text",
                "mode": "generate",
                "title": None,
                "n_scenes": 5,
                "min_narration_words": 5,
                "max_narration_words": 20,
                "min_image_prompt_words": 30,
                "max_image_prompt_words": 60,
                "media_width": 1080,
                "media_height": 1440,
                "media_workflow": None,
                "video_fps": 30,
                "frame_template": "1080x1920/image_default.html",
                "prompt_prefix": None,
                "bgm_path": None,
                "bgm_volume": 0.3,
                "tts_workflow": "runninghub/tts_edge.json",
                "ref_audio": "voice.wav",
                "voice_id": "legacy",
                "template_params": {"accent_color": "#fff"},
            },
        )

    def test_video_result_payload_uses_existing_path_url_conversion(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            output_dir = Path(tmp_dir) / "output" / "task-1"
            output_dir.mkdir(parents=True)
            video_path = output_dir / "final.mp4"
            video_path.write_bytes(b"1234")

            payload = video.video_result_payload(
                DummyRequest(),
                SimpleNamespace(video_path=str(video_path), duration=1.5),
            )

        self.assertEqual(
            payload,
            {
                "video_url": "http://testserver/api/files/task-1/final.mp4",
                "duration": 1.5,
                "file_size": 4,
            },
        )


if __name__ == "__main__":
    unittest.main()
