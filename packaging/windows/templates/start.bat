@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Pixelle-Video - Windows Launcher
echo ========================================
echo.

:: Set environment variables
set "PYTHON_HOME=%~dp0python\python311"
set "PATH=%PYTHON_HOME%;%PYTHON_HOME%\Scripts;%~dp0tools\ffmpeg\bin;%PATH%"
set "PROJECT_ROOT=%~dp0Pixelle-Video"

:: Change to project directory
cd /d "%PROJECT_ROOT%"

:: Set PYTHONPATH to project root for module imports
set "PYTHONPATH=%PROJECT_ROOT%"

:: Set PIXELLE_VIDEO_ROOT environment variable for reliable path resolution
set "PIXELLE_VIDEO_ROOT=%PROJECT_ROOT%"

:: Start FastAPI backend in a separate window.
echo [Starting] Launching Pixelle-Video API on port 8001...
start "Pixelle-Video API" cmd /k ""%PYTHON_HOME%\python.exe" -m pip install --quiet -e . 2>nul && "%PYTHON_HOME%\python.exe" api\app.py --host 0.0.0.0 --port 8001"

:: Give the API a moment to bind.
timeout /t 3 /nobreak >nul

:: Start Next.js frontend in the current window.
echo [Starting] Launching Pixelle-Video Web UI on port 8501...
echo Browser will open automatically.
echo.
echo Note: Configure API keys and settings in the Web UI.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

:: TODO(manual-review): this Windows packaging template previously launched
:: the legacy Python UI directly. The web UI has moved to Next.js (web-next/).
:: The packaging needs Node.js + pnpm bundled before this template can be
:: updated. For now, run `pnpm --dir web-next dev` manually after the API
:: window opens.
echo [ERROR] Windows packaging template has not been updated for the
echo         Next.js frontend yet. Please launch it manually:
echo.
echo     cd web-next ^&^& pnpm install ^&^& pnpm dev
echo.
pause
