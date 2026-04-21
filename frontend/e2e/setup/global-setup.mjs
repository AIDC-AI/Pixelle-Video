import { spawn, spawnSync } from "node:child_process";
import { openSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 8000;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const HEALTH_URL = `${BACKEND_URL}/health`;
const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(CURRENT_DIR, ".server-state.json");

async function ensureSymlink(targetPath, linkPath) {
  await fs.rm(linkPath, { recursive: true, force: true });
  await fs.symlink(targetPath, linkPath, process.platform === "win32" ? "junction" : "dir");
}

async function prepareRuntimeRoot(repoRoot, frontendRoot) {
  const runtimeRoot = path.join(frontendRoot, ".playwright-runtime", "pixelle-root");
  await fs.rm(runtimeRoot, { recursive: true, force: true });
  await fs.mkdir(runtimeRoot, { recursive: true });

  for (const directory of ["workflows", "templates", "bgm", "resources", "data"]) {
    await ensureSymlink(path.join(repoRoot, directory), path.join(runtimeRoot, directory));
  }

  return runtimeRoot;
}

function spawnDetachedProcess(name, command, args, cwd, env, logFilePath) {
  const logDescriptor = openSync(logFilePath, "a");
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", logDescriptor, logDescriptor],
  });

  if (!child.pid) {
    throw new Error(`Failed to start ${name}.`);
  }

  child.unref();

  return {
    name,
    pid: child.pid,
    detached: true,
  };
}

function ensureFrontendBuild(frontendRoot, frontendEnv) {
  const buildIdPath = path.join(frontendRoot, ".next", "BUILD_ID");
  return fs
    .access(buildIdPath)
    .catch(() => {
      const result = spawnSync("pnpm", ["build"], {
        cwd: frontendRoot,
        env: frontendEnv,
        stdio: "inherit",
      });

      if (result.status !== 0) {
        throw new Error("Failed to build the frontend before Playwright startup.");
      }
    });
}

async function waitForHttp(url, timeoutMs, label) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`${label} responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${label}: ${String(lastError)}`);
}

export default async function globalSetup() {
  const frontendRoot = path.resolve(CURRENT_DIR, "..", "..");
  const repoRoot = path.resolve(frontendRoot, "..");
  const runtimeRoot = await prepareRuntimeRoot(repoRoot, frontendRoot);
  const logsRoot = path.join(frontendRoot, ".playwright-runtime", "logs");
  await fs.mkdir(logsRoot, { recursive: true });

  const backendEnv = {
    ...process.env,
    COMFY_MOCK: "1",
    COMFY_MOCK_DELAY_MS: process.env.COMFY_MOCK_DELAY_MS ?? "4000",
    LLM_MOCK: "1",
    PIXELLE_VIDEO_ROOT: runtimeRoot,
    TTS_MOCK: "1",
  };

  const frontendEnv = {
    ...process.env,
    NEXT_PUBLIC_API_BASE_URL: BACKEND_URL,
    NEXT_PUBLIC_TASK_POLL_INTERVAL_MS: "500",
  };

  await ensureFrontendBuild(frontendRoot, frontendEnv);

  const backend = spawnDetachedProcess(
    "backend",
    "uv",
    ["run", "python", "api/app.py", "--host", "127.0.0.1", "--port", `${BACKEND_PORT}`],
    repoRoot,
    backendEnv,
    path.join(logsRoot, "backend.log")
  );
  await waitForHttp(HEALTH_URL, 120_000, "FastAPI health endpoint");

  const frontendArgs = ["start", "--hostname", "127.0.0.1", "--port", `${FRONTEND_PORT}`];

  const frontend = spawnDetachedProcess(
    "frontend",
    "pnpm",
    frontendArgs,
    frontendRoot,
    frontendEnv,
    path.join(logsRoot, "frontend.log")
  );
  await waitForHttp(FRONTEND_URL, 180_000, "Next.js frontend");

  await fs.writeFile(STATE_FILE, JSON.stringify({ backend, frontend }, null, 2), "utf-8");
}
