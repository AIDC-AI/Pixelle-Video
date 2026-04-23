'use client';

import { useEffect, useMemo, useState } from 'react';

interface MultiSelectItem {
  id: string;
}

export function useMultiSelect<T extends MultiSelectItem>(items: T[] = []) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((id) => itemIds.includes(id));
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [itemIds]);

  const isSelected = (id: string) => selectedIds.includes(id);

  const clear = () => {
    setSelectedIds([]);
    setLastSelectedIndex(null);
  };

  const toggle = (itemOrId: T | string, options: { index?: number; shiftKey?: boolean } = {}) => {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    const index = options.index ?? itemIds.indexOf(id);

    setSelectedIds((current) => {
      if (options.shiftKey && lastSelectedIndex !== null && index >= 0) {
        const [start, end] = [lastSelectedIndex, index].sort((left, right) => left - right);
        const rangeIds = itemIds.slice(start, end + 1);
        return Array.from(new Set([...current, ...rangeIds]));
      }

      return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    });

    if (index >= 0) {
      setLastSelectedIndex(index);
    }
  };

  const toggleAll = (nextItems: T[] = items) => {
    const nextIds = nextItems.map((item) => item.id);
    setSelectedIds((current) => (nextIds.every((id) => current.includes(id)) ? [] : nextIds));
  };

  const selected = items.filter((item) => selectedIds.includes(item.id));

  return {
    clear,
    isSelected,
    selected,
    selectedIds,
    toggle,
    toggleAll,
  };
}
