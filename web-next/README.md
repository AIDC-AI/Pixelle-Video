# Pixelle-Video Web (Next.js)

The new web client for Pixelle-Video, built on Next.js 15 (App Router)
+ TailwindCSS + TypeScript.

## Quick start

```bash
# from this directory
cp .env.example .env
# Edit .env: set NEXT_PUBLIC_API_BASE_URL to where the API runs
# (e.g. http://localhost:8001 for local dev).
pnpm install
pnpm dev
```

The dev server runs on `http://localhost:8501` and the browser calls
the FastAPI backend directly at `NEXT_PUBLIC_API_BASE_URL`. We don't
proxy `/api/*` through Next.js because the dev server buffers SSE
responses — see the comments in `next.config.mjs`.

## Directory map

```
app/                 # App Router pages
  layout.tsx         # Root layout: next-intl, React Query, font
  page.tsx           # Home (workspace hub)
  (app)/             # Authenticated routes wrapped in <AppShell>
    page.tsx
    history/
    settings/
    admin/
    generate/
      standard/
      asset-based/
      digital-human/
      i2v/
      action-transfer/
    403/
  login/             # Auth screens (no AppShell)
  signup/
  forgot-password/
  reset-password/
  not-found.tsx

components/
  ui/                # Base components: Button, Input, Card, Badge, …
  layout/            # AppShell, sidebar, header, nav config
  states/            # Loading, Empty, Error, Success, AccessDenied
  generate/          # Shared generate-form scaffold

lib/
  design/            # Tokens, className helper
  api/               # axios client, React Query hooks, SSE hook
  auth/              # Zustand store, token storage, route guards

i18n/                # next-intl config
messages/            # en.json, zh.json

docs/
  theme-audit.md     # Maps the theme spec checklist to code
```

## Design system

Tokens live in `lib/design/tokens.ts` and `tailwind.config.ts`. They
mirror `docs/ai/specs/theme-ui-moi-pixelle-motion-brand.md` one-to-one.
See `docs/theme-audit.md` for the current state of the theme checklist.

## API

`lib/api/client.ts` exposes an axios instance with two interceptors:

- **Request** — attach the bearer token from `localStorage`.
- **Response** — on 401, refresh via `/api/auth/refresh` and retry
  the original request; on hard failure, clear tokens and bounce to
  `/login`. Single-flight queue prevents thundering-herd refresh.

The SSE `/api/tasks/{id}/stream` endpoint uses the native
`EventSource` (axios/fetch don't handle `text/event-stream`
incrementally). Server-Sent Events hooks are the only place that
deliberately does not use axios.

## Auth

Real JWT + refresh tokens backed by the FastAPI `api/auth/` package
(Phase 1 of the rebuild plan). Tokens are kept in `localStorage`;
`useAuthBootstrap()` and `useRouteGuard()` wrap the rest of the app.
