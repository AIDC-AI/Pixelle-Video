@echo off
chcp 65001 >nul 2>&1

echo 🚀 Starting Pixelle-Video (API + Next.js)...
echo.

REM Install web-next deps on first run.
if not exist "web-next\node_modules" (
  echo 📦 Installing web-next dependencies ^(first run^)...
  pushd web-next
  call pnpm install --silent
  popd
)

REM Start FastAPI in a new window.
echo 🔧 Starting FastAPI on http://localhost:8001 ...
start "Pixelle-Video API" cmd /k "uv run python api/app.py --host 0.0.0.0 --port 8001"

REM Give the API a moment to bind.
timeout /t 3 /nobreak >nul

REM Start Next.js in the current window on 8501 so existing
REM bookmarks keep working.
echo 🌐 Starting Next.js on http://localhost:8501 ...
pushd web-next
pnpm dev
popd
