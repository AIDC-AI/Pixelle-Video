import { describe, it, expect, beforeEach } from 'vitest';
import { useCurrentProjectStore } from './current-project';

describe('useCurrentProjectStore', () => {
  beforeEach(() => {
    useCurrentProjectStore.getState().reset();
  });

  it('initializes with null', () => {
    expect(useCurrentProjectStore.getState().currentProjectId).toBeNull();
  });

  it('can set current project', () => {
    useCurrentProjectStore.getState().setCurrentProjectId('1');
    expect(useCurrentProjectStore.getState().currentProjectId).toBe('1');
  });

  it('can reset current project', () => {
    useCurrentProjectStore.getState().setCurrentProjectId('1');
    useCurrentProjectStore.getState().reset();
    expect(useCurrentProjectStore.getState().currentProjectId).toBeNull();
  });
});
