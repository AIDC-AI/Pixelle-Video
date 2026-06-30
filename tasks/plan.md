# Ponytail Cleanup Plan — Dead Code & Over-Engineering

> Scope: over-engineering only (delete/shrink/stdlib/native). Correctness, security, perf out of scope.
> Source: `/ponytail-audit` run 2026-06-30, then **verified against the actual code**.
> Several audit findings were corrected during verification — see "Corrections" below.

## Verification Corrections (read before executing)

The audit over-claimed on three items. These are the verified truths:

1. **ImageProcessor** — the class IS instantiated in `image_client.py`, `image_dashscope.py`, `image_gemini.py`, `image_gpt.py`. But the **only method ever called is `download_image`** (3 call sites, all `image_processor.download_image(url, path)`). So: keep `__init__` / `_proxies` / `download_image`; the image-manip methods AND the OSS upload chain are dead. (Audit was right on the methods, wrong to imply the class is unused.)

2. **TaskProgress is NOT dead.** It is a field on the `Task` model (`api/tasks/models.py:52`: `progress: Optional[TaskProgress] = None`). Only `TaskManager.update_progress` (the *method* at `manager.py:181`) is dead — its sole reference is a **comment** in `api/routers/video.py:243`. Delete the method, **keep the model**.

3. **CustomPipeline is wired in.** Registered in `service.py:216` (`"custom": CustomPipeline(self)`) and exported from `pipelines/__init__.py`. Only its two private methods `_custom_content_analysis` (custom.py:469) and `_custom_prompt_generation` (custom.py:482) are never called. Delete those two methods; **keep the class** (it's a user-facing example pipeline).

Everything else in the audit checked out.

---

## Phased Plan

### Phase 1 — Pure dead code (zero behavior change, safest)

Vertical slices; each task is independently deletable and revertable.

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| 1.1 | Delete dead ImageProcessor methods: `check_column_white`, `find_white_section`, `split_image`, `stitch_images`, `resize_image`, `has_black_borders`, `collage_images`, `get_upload_policy`, `upload_file_to_oss`, `upload`. Keep `__init__`, `_proxies`, `download_image`. | `pixelle_video/services/api_services/image_processor.py` | Module imports; `download_image` still callable from the 3 sites; `grep` for deleted names returns 0 repo hits |
| 1.2 | Delete `__main__` self-test blocks from 8 provider modules | `image_dashscope.py`, `image_gemini.py`, `image_gpt.py`, `image_seedream.py`, `video_dashscope.py`, `video_kling.py`, `video_seedance.py`, `vlm_dashscope.py` | No `if __name__ == "__main__"` remains in `services/api_services/`; modules still import clean |
| 1.3 | Delete `TaskManager.update_progress` method. **Keep `TaskProgress` model.** Remove the commented reference in video.py:243. | `api/tasks/manager.py`, `api/routers/video.py` | `Task` model still has `progress` field; `TaskProgress` import still resolves |
| 1.4 | Delete dead `_custom_content_analysis` and `_custom_prompt_generation` from CustomPipeline. **Keep the class + registration.** | `pixelle_video/pipelines/custom.py` | `service.py:216` registration intact; `pipelines/__init__.py` export intact |
| 1.5 | Delete unused `APIConfig` fields: `host`, `port`, `reload` (overridden by argparse), `max_concurrent_tasks`, `max_upload_size`. Verify `task_cleanup_interval` / `task_retention_time` usage first — keep if referenced. | `api/config.py` | No repo reads of deleted fields; `api/app.py` still starts (uses argparse values + remaining fields) |
| 1.6 | Delete `BaseResponse` / `ErrorResponse` + remove from `api/schemas/__init__.py` exports | `api/schemas/base.py`, `api/schemas/__init__.py` | `grep BaseResponse ErrorResponse` returns 0 repo hits |
| 1.7 | Delete dead web functions: `get_pipeline_ui` (singular) + remove from `web/pipelines/__init__.py` exports; `get_language_name` | `web/pipelines/base.py`, `web/pipelines/__init__.py`, `web/i18n/__init__.py` | Only `get_all_pipeline_uis` remains; `get_language_name` gone |
| 1.8 | Deduplicate `is_api_workflow`: remove the redefinition in `style_config.py:38`, import from `api_workflows.py` instead | `web/components/style_config.py` | One definition remains (in `api_workflows.py`); all call sites still resolve |

**Checkpoint 1:** `ruff check .` clean; `python -c "import pixelle_video, api, web"` succeeds; app boots (`python -m api.app` or `streamlit run web/app.py`). No green unless all three pass.

---

### Phase 2 — Duplicate-code consolidation (shrink, behavior-preserving)

Higher touch — multiple call sites per change. One PR-worthy slice each.

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| 2.1 | Extract one `download_to_file(url, path, proxies=...)` helper; replace 6 copy-pasted chunked-GET blocks | `image_processor.py:140`, `image_seedream.py:223`, `video_dashscope.py:400`, `video_kling.py:326`, `video_seedance.py:169`, `tts_qwen.py:113` | All 6 sites call the helper; identical download behavior |
| 2.2 | Extract web helpers `save_uploads_to_temp()`, `extract_video_url()`, `download_to_file()`, `render_video_result()`; replace the 6×/5×/5× copy-paste clusters | `web/pipelines/asset_based.py`, `digital_human.py`, `i2v.py`, `action_transfer.py` | Each cluster has one definition; UI behavior unchanged |
| 2.3 | Extract shared `_proxy_env` context manager; dedupe between `DashScopeClient` and `DashscopeVideoClient` | `image_dashscope.py`, `video_dashscope.py` | One shared helper, two consumers |
| 2.4 | Extract shared local-path→`file://` URL converter; dedupe `_to_dashscope_file_url` / `_to_media_url` / inline | `vlm_client.py`, `video_dashscope.py`, `image_client.py` | One converter, all sites use it |

**Checkpoint 2:** same gate as Checkpoint 1, plus manually run one image-gen + one video-gen flow in the web UI to confirm no regression in the consolidated paths.

---

### Phase 3 — stdlib / native swaps (behavior-preserving, but logic-changing)

Do these last and individually — each changes how work is done, not just where.

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| 3.1 | Replace 8 hand-rolled `_xxx_to_dict` / `_dict_to_xxx` with `dataclasses.asdict()` + isoformat hooks | `pixelle_video/services/persistence.py:305-431` | Round-trip (to-dict → from-dict) equals original for storyboard/config/frame/content_metadata |
| 3.2 | Replace hand-rolled JSON extraction in llm_service with OpenAI SDK `response_format` / `beta.parse`, single `json.loads` fallback | `pixelle_video/services/llm_service.py:210-330` | Structured-output call returns same typed result on the same prompts |
| 3.3 | Replace `str(uuid.uuid4()).replace('-','')[:12]` ×6 with `uuid.uuid4().hex[:12]` | `web/pipelines/asset_based.py:115` + 5 sites | Same output length/charset; IDs still unique |
| 3.4 | Replace `safe_rerun()` calls with direct `st.rerun()`; delete `safe_rerun` | `web/utils/streamlit_helpers.py` + 14 call sites | UI reroutes behave identically |
| 3.5 | Simplify `detect_system_language` to `locale.getdefaultlocale()` + one env fallback | `web/i18n/__init__.py:128` | Detects the same language on this Windows box |
| 3.6 | Drop `requests` dep: move 7 callers onto `httpx.Client`; remove from `pyproject.toml` | `image_processor.py`, `image_seedream.py`, `video_dashscope.py`, `video_kling.py`, `video_seedance.py`, `tts_qwen.py`, settings, `pyproject.toml` | `grep -rn "^import requests\|^from requests" --exclude-dir=.venv` returns 0; `pip check` clean |

**Checkpoint 3:** full gate — ruff, imports, app boot, one end-to-end video generation, `pip check`.

---

## Out of scope (deferred — noted, not planned)

- `loguru`→`logging` (borderline; ergonomics are a real win — skip unless actively consolidating deps)
- Collapse `LinearVideoPipeline` template-method layer (#14) — touches pipeline architecture, separate decision
- `VLM` single-backend pass-through (#10) — may gain a second backend; leave the seam
- `ConfigManager` singleton dance, `to_dict`/`model_dump` alias, `_ConfigMeta` metaclass, `loader.py` inlining — low-value churn, batch later if desired
- `self.image` backward-compat alias — only used inside CustomPipeline's example docstring; leave with the example

## Execution order

Phase 1 → Checkpoint 1 → (review) → Phase 2 → Checkpoint 2 → (review) → Phase 3 → Checkpoint 3.

Each phase lands as its own commit. Stop for human review at each checkpoint.
