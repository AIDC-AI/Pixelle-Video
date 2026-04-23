import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMultiSelect } from './use-multi-select';

const items = [
  { id: 'a' },
  { id: 'b' },
  { id: 'c' },
  { id: 'd' },
];

describe('useMultiSelect', () => {
  it('toggles individual items and clears selection', () => {
    const { result } = renderHook(() => useMultiSelect(items));

    act(() => result.current.toggle(items[0], { index: 0 }));
    expect(result.current.selectedIds).toEqual(['a']);

    act(() => result.current.toggle(items[0], { index: 0 }));
    expect(result.current.selectedIds).toEqual([]);
  });

  it('supports shift range selection and toggle all', () => {
    const { result } = renderHook(() => useMultiSelect(items));

    act(() => result.current.toggle(items[0], { index: 0 }));
    act(() => result.current.toggle(items[2], { index: 2, shiftKey: true }));
    expect(result.current.selectedIds).toEqual(['a', 'b', 'c']);

    act(() => result.current.toggleAll());
    expect(result.current.selectedIds).toEqual(['a', 'b', 'c', 'd']);

    act(() => result.current.clear());
    expect(result.current.selectedIds).toEqual([]);
  });
});
