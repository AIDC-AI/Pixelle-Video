const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sidebar-collapsed';
const SIDEBAR_EXPANDED_GROUP_STORAGE_KEY = 'sidebar-expanded-group';
const LANGUAGE_PREFERENCE_STORAGE_KEY = 'skyframe-language-preference';
const SIDEBAR_PREFERENCE_EVENT = 'skyframe:sidebar-preference-changed';
const LANGUAGE_PREFERENCE_EVENT = 'skyframe:language-preference-changed';

const SIDEBAR_GROUP_PREFERENCES = ['projects', 'create', 'batch', 'library', 'advanced', 'system'] as const;

export type SidebarExpandedGroupPreference = (typeof SIDEBAR_GROUP_PREFERENCES)[number];

function normalizeSidebarExpandedGroups(groups: readonly string[]): SidebarExpandedGroupPreference[] {
  const unique = new Set(groups);
  return SIDEBAR_GROUP_PREFERENCES.filter((group) => unique.has(group));
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function readSidebarCollapsedPreference(): boolean {
  if (!isBrowser()) {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
}

export function writeSidebarCollapsedPreference(collapsed: boolean): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  window.dispatchEvent(new CustomEvent(SIDEBAR_PREFERENCE_EVENT, { detail: { collapsed } }));
}

export function readSidebarExpandedGroupPreference(): SidebarExpandedGroupPreference[] {
  if (!isBrowser()) {
    return [];
  }

  const value = window.localStorage.getItem(SIDEBAR_EXPANDED_GROUP_STORAGE_KEY);
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return normalizeSidebarExpandedGroups(parsed.filter((item): item is string => typeof item === 'string'));
    }
  } catch {
    // Backward compatibility with the previous single-group string value.
  }

  if (SIDEBAR_GROUP_PREFERENCES.includes(value as SidebarExpandedGroupPreference)) {
    return [value as SidebarExpandedGroupPreference];
  }

  return [];
}

export function writeSidebarExpandedGroupPreference(groups: SidebarExpandedGroupPreference[]): void {
  if (!isBrowser()) {
    return;
  }

  const normalizedGroups = normalizeSidebarExpandedGroups(groups);
  if (normalizedGroups.length === 0) {
    window.localStorage.removeItem(SIDEBAR_EXPANDED_GROUP_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SIDEBAR_EXPANDED_GROUP_STORAGE_KEY, JSON.stringify(normalizedGroups));
}

export function readLanguagePreference(): 'zh-CN' {
  return 'zh-CN';
}

export function writeLanguagePreference(_value: 'zh-CN'): void {
  // Chinese-only frontend: keep the API as a compatibility no-op.
}

export {
  LANGUAGE_PREFERENCE_EVENT,
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_EXPANDED_GROUP_STORAGE_KEY,
  SIDEBAR_PREFERENCE_EVENT,
};
