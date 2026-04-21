from __future__ import annotations


def test_openapi_lists_phase1_paths(client):
    paths = client.get("/openapi.json").json()["paths"]

    expected_paths = {
        "/api/video/digital-human/async",
        "/api/video/i2v/async",
        "/api/video/action-transfer/async",
        "/api/video/custom/async",
        "/api/uploads",
        "/api/library/videos",
        "/api/library/videos/{video_id}",
        "/api/library/images",
        "/api/library/voices",
        "/api/library/bgm",
        "/api/library/scripts",
        "/api/batch",
        "/api/batch/{batch_id}",
        "/api/projects",
        "/api/projects/{project_id}",
        "/api/settings",
        "/api/resources/workflows/{workflow_id}",
        "/api/resources/presets",
    }

    assert expected_paths.issubset(paths.keys())
