'use client';

import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUT_ITEMS, getShortcutKeys, type ShortcutGroupId } from '@/lib/hooks/use-keyboard-shortcuts';

const GROUP_LABELS: Record<ShortcutGroupId, string> = {
  navigation: 'Navigation',
  actions: 'Actions',
  general: 'General',
};

export interface ShortcutHelpDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function ShortcutHelpDialog({ onOpenChange, open }: ShortcutHelpDialogProps) {
  const [query, setQuery] = useState('');
  const searchId = useId();

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return (Object.keys(GROUP_LABELS) as ShortcutGroupId[])
      .map((group) => ({
        group,
        items: SHORTCUT_ITEMS.filter((item) => item.group === group).filter((item) => {
          if (!normalizedQuery) {
            return true;
          }

          return (
            item.description.toLowerCase().includes(normalizedQuery) ||
            item.shortcut.toLowerCase().includes(normalizedQuery)
          );
        }),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Quick navigation and shell actions for Phase A.</DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/70 px-6 py-4">
          <Label htmlFor={searchId} className="sr-only">
            Search shortcuts
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              value={query}
              placeholder="Search shortcuts"
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="max-h-[calc(85vh-9rem)] overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {filteredGroups.map(({ group, items }) => (
              <section key={group} className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{GROUP_LABELS[group]}</h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card px-4 py-3"
                    >
                      <p className="text-sm text-foreground">{item.description}</p>
                      <Kbd keys={getShortcutKeys(item)} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
