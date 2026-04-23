export interface RecentCommand {
  label: string;
  timestamp: number;
  type: 'page' | 'command' | 'project';
  value: string;
}

const STORAGE_KEY = 'pixelle-recent-commands';
const MAX_RECENT = 10;

type RecentCommandStore = Record<string, RecentCommand[]>;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function isRecentCommand(value: unknown): value is RecentCommand {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const command = value as Partial<RecentCommand>;
  return (
    typeof command.label === 'string' &&
    typeof command.value === 'string' &&
    typeof command.timestamp === 'number' &&
    (command.type === 'page' || command.type === 'command' || command.type === 'project')
  );
}

function readStore(): RecentCommandStore {
  if (!isBrowser()) {
    return {};
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const entries: Array<[string, RecentCommand[]]> = [];
    Object.entries(parsed).forEach(([projectId, commands]) => {
      if (!Array.isArray(commands)) {
        return;
      }

      entries.push([
        projectId,
        commands
          .filter(isRecentCommand)
          .sort((left: RecentCommand, right: RecentCommand) => right.timestamp - left.timestamp)
          .slice(0, MAX_RECENT),
      ]);
    });

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function writeStore(store: RecentCommandStore): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function normalizeProjectId(projectId: string): string {
  return projectId.trim() || 'global';
}

export function getRecentCommands(projectId: string): RecentCommand[] {
  const store = readStore();
  return [...(store[normalizeProjectId(projectId)] ?? [])]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, MAX_RECENT);
}

export function addRecentCommand(projectId: string, command: RecentCommand): void {
  const normalizedProjectId = normalizeProjectId(projectId);
  const store = readStore();
  const existingCommands = store[normalizedProjectId] ?? [];
  const dedupedCommands = existingCommands.filter(
    (item) => item.type !== command.type || item.value !== command.value
  );

  store[normalizedProjectId] = [
    { ...command, timestamp: command.timestamp },
    ...dedupedCommands,
  ].slice(0, MAX_RECENT);
  writeStore(store);
}

export function clearRecentCommands(projectId: string): void {
  const normalizedProjectId = normalizeProjectId(projectId);
  const store = readStore();
  delete store[normalizedProjectId];
  writeStore(store);
}

export { MAX_RECENT, STORAGE_KEY };
