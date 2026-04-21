# Playwright E2E

These tests boot the real Next.js frontend and the real FastAPI backend with mock-safe runtime flags:

- `COMFY_MOCK=1`
- `COMFY_MOCK_DELAY_MS=4000`
- `TTS_MOCK=1`
- `LLM_MOCK=1`

The backend runs against an isolated Playwright runtime root under `frontend/.playwright-runtime/`, so generated output and project indexes do not pollute the main repo output.

## Local run

From `frontend/`:

```bash
pnpm test:e2e
```

If Chromium is not installed yet:

```bash
pnpm exec playwright install --with-deps chromium
```

## CI run

CI builds the frontend first, then `global-setup.ts` starts:

- FastAPI on `http://127.0.0.1:8000`
- Next.js on `http://127.0.0.1:3000`

Artifacts retained on failure:

- Playwright trace
- failure screenshots
- failure videos
