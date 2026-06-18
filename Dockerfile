# Multi-stage Dockerfile for Pixelle-Video.
#
# Stage 1 (api) → FastAPI backend (Python 3.11).
# Stage 2 (web) → Next.js production build.

# ----------------------------------------------------------------------------
# Stage 1 — API
# ----------------------------------------------------------------------------
FROM python:3.11-slim AS api
ARG USE_CN_MIRROR=false

WORKDIR /app

RUN if [ "$USE_CN_MIRROR" = "true" ]; then \
      sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources && \
      sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    fi

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      ffmpeg \
      fonts-noto-cjk \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN if [ "$USE_CN_MIRROR" = "true" ]; then \
      pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple/ uv; \
    else \
      curl -LsSf https://astral.sh/uv/install.sh | sh; \
    fi
ENV PATH="/root/.local/bin:$PATH"

COPY pyproject.toml uv.lock README.md ./
COPY pixelle_video ./pixelle_video
RUN export UV_HTTP_TIMEOUT=300 && uv venv && \
    if [ "$USE_CN_MIRROR" = "true" ]; then \
      uv pip install -e . -i https://pypi.tuna.tsinghua.edu.cn/simple; \
    else \
      uv pip install -e .; \
    fi && \
    uv run playwright install --with-deps chromium

COPY api ./api
COPY bgm ./bgm
COPY templates ./templates
COPY workflows ./workflows
COPY resources ./resources
RUN mkdir -p /app/output /app/data /app/temp

EXPOSE 8001
CMD ["uv", "run", "python", "api/app.py", "--host", "0.0.0.0", "--port", "8001"]


# ----------------------------------------------------------------------------
# Stage 2 — Web (Next.js)
# ----------------------------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /app

# Install deps with deterministic output
COPY web-next/package.json web-next/pnpm-lock.yaml* web-next/pnpm-workspace.yaml web-next/.npmrc ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile || pnpm install

COPY web-next ./
# NEXT_PUBLIC_API_BASE_URL is injected at runtime via docker-compose
# environment (sourced from the project root .env). The `.env` file is no
# longer bundled, so Next.js falls back to the OS env var.
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 8501
CMD ["pnpm", "start"]
