import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(CURRENT_DIR, ".server-state.json");

function killManagedProcess(processInfo) {
  try {
    if (processInfo.detached && process.platform !== "win32") {
      process.kill(-processInfo.pid, "SIGTERM");
    } else {
      process.kill(processInfo.pid, "SIGTERM");
    }
  } catch {
    return;
  }
}

export default async function globalTeardown() {
  try {
    const rawState = await fs.readFile(STATE_FILE, "utf-8");
    const state = JSON.parse(rawState);

    killManagedProcess(state.frontend);
    killManagedProcess(state.backend);
  } catch {
    return;
  } finally {
    await fs.rm(STATE_FILE, { force: true });
  }
}
