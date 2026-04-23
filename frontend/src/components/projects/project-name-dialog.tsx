'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppTranslations } from '@/lib/i18n';

interface ProjectNameDialogProps {
  open: boolean;
  title: string;
  submitLabel: string;
  initialValue?: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => Promise<void> | void;
}

export function ProjectNameDialog({
  open,
  title,
  submitLabel,
  initialValue = '',
  pending = false,
  onOpenChange,
  onSubmit,
}: ProjectNameDialogProps) {
  const common = useAppTranslations('common');
  const inputId = 'project-name-dialog-input';
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
    }
  }, [initialValue, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor={inputId} className="sr-only">
            {title}
          </Label>
          <Input id={inputId} value={value} onChange={(event) => setValue(event.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {common('cancel')}
          </Button>
          <Button
            type="button"
            onClick={async () => {
              const nextValue = value.trim();
              if (!nextValue) {
                return;
              }
              await onSubmit(nextValue);
            }}
            disabled={pending || !value.trim()}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
