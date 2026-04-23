import { beforeEach, describe, expect, it } from 'vitest';

import {
  addRecentCommand,
  clearRecentCommands,
  getRecentCommands,
  STORAGE_KEY,
  type RecentCommand,
} from './recent-commands';

function makeCommand(value: string, timestamp: number): RecentCommand {
  return {
    label: value,
    timestamp,
    type: 'page',
    value,
  };
}

describe('recent-commands', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores commands per project newest first', () => {
    addRecentCommand('project-a', makeCommand('/create', 100));
    addRecentCommand('project-a', makeCommand('/batch', 200));
    addRecentCommand('project-b', makeCommand('/settings', 300));

    expect(getRecentCommands('project-a')).toEqual([
      expect.objectContaining({ value: '/batch' }),
      expect.objectContaining({ value: '/create' }),
    ]);
    expect(getRecentCommands('project-b')).toEqual([
      expect.objectContaining({ value: '/settings' }),
    ]);
  });

  it('deduplicates commands by type and value', () => {
    addRecentCommand('project-a', makeCommand('/create', 100));
    addRecentCommand('project-a', { ...makeCommand('/create', 200), label: 'Create page' });

    expect(getRecentCommands('project-a')).toEqual([
      expect.objectContaining({ label: 'Create page', value: '/create', timestamp: 200 }),
    ]);
  });

  it('keeps only the ten most recent commands', () => {
    for (let index = 0; index < 12; index += 1) {
      addRecentCommand('project-a', makeCommand(`/page-${index}`, index));
    }

    const commands = getRecentCommands('project-a');

    expect(commands).toHaveLength(10);
    expect(commands[0]?.value).toBe('/page-11');
    expect(commands.at(-1)?.value).toBe('/page-2');
  });

  it('clears one project without touching the others', () => {
    addRecentCommand('project-a', makeCommand('/create', 100));
    addRecentCommand('project-b', makeCommand('/batch', 200));

    clearRecentCommands('project-a');

    expect(getRecentCommands('project-a')).toEqual([]);
    expect(getRecentCommands('project-b')).toHaveLength(1);
  });

  it('recovers from corrupt localStorage payloads', () => {
    localStorage.setItem(STORAGE_KEY, '{bad');

    expect(getRecentCommands('project-a')).toEqual([]);
  });
});
