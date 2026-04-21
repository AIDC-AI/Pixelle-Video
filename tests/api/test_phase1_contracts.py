from __future__ import annotations

import io

import pytest


@pytest.mark.parametrize(
    ("method", "path", "payload", "files"),
    [
        ("get", "/api/library/videos/mock-video", None, None),
        ("get", "/api/library/images", None, None),
        ("get", "/api/library/voices", None, None),
        ("get", "/api/library/bgm", None, None),
        ("get", "/api/library/scripts", None, None),
        ("post", "/api/batch", {"pipeline": "standard", "rows": []}, None),
        ("get", "/api/batch", None, None),
        ("get", "/api/batch/mock-batch", None, None),
        ("delete", "/api/batch/mock-batch", None, None),
        ("get", "/api/settings", None, None),
        ("put", "/api/settings", {"llm": {"model": "mock"}}, None),
        ("get", "/api/resources/workflows/mock-workflow", None, None),
        ("get", "/api/resources/presets", None, None),
    ],
)
def test_phase1_stubs_return_not_implemented(client, method, path, payload, files):
    kwargs = {}
    if payload is not None:
        kwargs["json"] = payload
    if files is not None:
        kwargs["files"] = files
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == 501


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


def test_upload_stub_is_replaced_in_green_phase(client):
    response = client.post(
        "/api/uploads",
        files={"file": ("sample.png", io.BytesIO(b"payload"), "image/png")},
    )
    assert response.status_code != 404
