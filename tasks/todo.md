# Ponytail Cleanup — Task List

Status: ☐ pending · ▶ in-progress · ☑ done · ✗ blocked

## Phase 1 — Pure dead code

- ☐ 1.1 Delete dead ImageProcessor methods (keep `__init__`/`_proxies`/`download_image`) — `image_processor.py`
- ☐ 1.2 Delete `__main__` blocks from 8 provider modules — `services/api_services/*`
- ☐ 1.3 Delete `TaskManager.update_progress` method (KEEP `TaskProgress` model); remove comment in `video.py:243`
- ☐ 1.4 Delete dead `_custom_content_analysis` / `_custom_prompt_generation` (KEEP CustomPipeline class)
- ☐ 1.5 Delete unused `APIConfig` fields: `host`/`port`/`reload`/`max_concurrent_tasks`/`max_upload_size` (verify cleanup/retention first)
- ☐ 1.6 Delete `BaseResponse`/`ErrorResponse` + remove from `api/schemas/__init__.py` exports
- ☐ 1.7 Delete dead `get_pipeline_ui` (singular) + `get_language_name`; fix exports
- ☐ 1.8 Dedupe `is_api_workflow`: import from `api_workflows.py`, remove `style_config.py:38` redef
- ☐ **C1** Checkpoint 1: `ruff check .` · `import pixelle_video, api, web` · app boots

## Phase 2 — Duplicate-code consolidation

- ☐ 2.1 Extract `download_to_file(url, path)`; replace 6 chunked-GET blocks
- ☐ 2.2 Extract web helpers `save_uploads_to_temp` / `extract_video_url` / `download_to_file` / `render_video_result`; replace 6×/5×/5× clusters
- ☐ 2.3 Extract shared `_proxy_env` ctx mgr; dedupe DashScope image+video clients
- ☐ 2.4 Extract shared path→`file://` converter; dedupe 3 sites
- ☐ **C2** Checkpoint 2: C1 gate + manual image-gen + video-gen flow in web UI

## Phase 3 — stdlib / native swaps

- ☐ 3.1 `dataclasses.asdict()` + isoformat hooks replace 8 hand-rolled `_xxx_to_dict` — `persistence.py`
- ☐ 3.2 OpenAI SDK `response_format`/`beta.parse` replace hand-rolled JSON extraction — `llm_service.py`
- ☐ 3.3 `uuid.uuid4().hex[:12]` replace `str(uuid4()).replace('-','')[:12]` ×6
- ☐ 3.4 Direct `st.rerun()` replace `safe_rerun()` ×14; delete helper
- ☐ 3.5 `locale.getdefaultlocale()` + env fallback replace ~100-line `detect_system_language`
- ☐ 3.6 Drop `requests` dep; move 7 callers to `httpx.Client`; update `pyproject.toml`
- ☐ **C3** Checkpoint 3: ruff · imports · app boot · end-to-end video gen · `pip check`

## Out of scope (deferred)

- loguru→logging · Linear template-method collapse · VLM seam · ConfigManager singleton/to_dict/_ConfigMeta/loader inlining · self.image alias
