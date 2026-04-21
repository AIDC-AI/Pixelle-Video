import { describe, it, expect, beforeEach } from 'vitest';
import { useCurrentProjectStore } from './current-project';

describe('useCurrentProjectStore', () => {
  beforeEach(() => {
    useCurrentProjectStore.getState().reset();
  });

  it('initializes with null', () => {
    expect(useCurrentProjectStore.getState().currentProject).toBeNull();
  });

  it('can set current project', () => {
    useCurrentProjectStore.getState().setCurrentProject({ id: '1', name: 'Test' });
    expect(useCurrentProjectStore.getState().currentProject).toEqual({ id: '1', name: 'Test' });
  });

  it('can reset current project', () => {
    useCurrentProjectStore.getState().setCurrentProject({ id: '1', name: 'Test' });
    useCurrentProjectStore.getState().reset();
    expect(useCurrentProjectStore.getState().currentProject).toBeNull();
  });
});
