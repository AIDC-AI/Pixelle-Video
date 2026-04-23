import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDropTargetType, hasFileTransfer, useDropTarget } from './use-drop-target';

let mockPathname = '/create/quick';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function createTransfer(types: string[]): DataTransfer {
  return { types } as unknown as DataTransfer;
}

describe('use-drop-target', () => {
  beforeEach(() => {
    mockPathname = '/create/quick';
  });

  it('classifies shell routes', () => {
    expect(getDropTargetType('/create/i2v')).toBe('create');
    expect(getDropTargetType('/library/videos')).toBe('library');
    expect(getDropTargetType('/settings')).toBe('other');
  });

  it('detects file drags by DataTransfer types', () => {
    expect(hasFileTransfer(createTransfer(['Files']))).toBe(true);
    expect(hasFileTransfer(createTransfer(['text/plain']))).toBe(false);
  });

  it('returns the current route target and drag state setters', () => {
    mockPathname = '/library/images';
    const { result } = renderHook(() => useDropTarget());

    expect(result.current.targetType).toBe('library');
    expect(result.current.isDragging).toBe(false);
    expect(result.current.files).toEqual([]);
  });
});
