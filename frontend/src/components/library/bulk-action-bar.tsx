'use client';

import { Download, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  onClearSelection: () => void;
  onDelete: () => void;
  onDownload: () => void;
  selectedCount: number;
}

export function BulkActionBar({
  onClearSelection,
  onDelete,
  onDownload,
  selectedCount,
}: BulkActionBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const visible = selectedCount > 0;

  return (
    <>
      <div
        className={cn(
          'sticky bottom-4 z-20 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-border/70 bg-popover px-4 py-3 shadow-2xl transition-all duration-200',
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0'
        )}
        aria-hidden={!visible}
      >
        <div className="flex items-center gap-2">
          <Badge>{selectedCount}</Badge>
          <span className="text-sm font-medium text-foreground">selected</span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDownload}>
            <Download className="size-4" />
            Download
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" />
            Delete
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
            <X className="size-4" />
            Clear
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected assets?</DialogTitle>
            <DialogDescription>
              This will delete {selectedCount} selected {selectedCount === 1 ? 'asset' : 'assets'} when the backend API is available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onDelete();
                setConfirmOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
