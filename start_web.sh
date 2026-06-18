#!/bin/bash
# Start Pixelle-Video: FastAPI backend + Next.js web client.
#
# The Next.js dev server binds to 8501 so existing bookmarks / reverse
# proxies keep working.

set -e

echo "🚀 Starting Pixelle-Video (API + Next.js)..."
echo ""

# Make sure deps are installed for the Next.js app.
if [ ! -d "web-next/node_modules" ]; then
  echo "📦 Installing web-next dependencies (first run)..."
  (cd web-next && pnpm install --silent)
fi

# Start the FastAPI backend on 8001 in the background.
echo "🔧 Starting FastAPI on http://localhost:8001 ..."
uv run python api/app.py --host 0.0.0.0 --port 8001 &
API_PID=$!

trap "kill $API_PID 2>/dev/null || true" EXIT INT TERM

# Start the Next.js dev server on 8501 in the foreground.
echo "🌐 Starting Next.js on http://localhost:8501 ..."
cd web-next
pnpm dev
