'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { useCreatePreset } from '@/lib/hooks/use-resources';
import type { DraftPipeline } from '@/lib/draft-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface PresetSaveDialogProps {
  currentParams: Record<string, unknown>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pipeline: DraftPipeline;
}

function toPresetPipeline(pipeline: DraftPipeline): string {
  switch (pipeline) {
    case 'quick':
      return 'standard';
    case 'digital-human':
      return 'digital_human';
    case 'action-transfer':
      return 'action_transfer';
    case 'custom':
      return 'asset_based';
    default:
      return pipeline;
  }
}

export function PresetSaveDialog({
  currentParams,
  onOpenChange,
  open,
  pipeline,
}: PresetSaveDialogProps) {
  const createPreset = useCreatePreset();
  const [name, setName] = useState('');

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('请输入预设名称。');
      return;
    }

    await createPreset.mutateAsync({
      name: trimmedName,
      pipeline: toPresetPipeline(pipeline),
      description: null,
      payload_template: currentParams,
    });

    toast.success('已保存为新预设。');
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setName('');
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>保存当前为预设</DialogTitle>
          <DialogDescription>
            将当前参数快照保存为可复用预设。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="preset-name" className="text-sm font-medium text-foreground">
            预设名称
          </label>
          <Input
            id="preset-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：新品发布快剪"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} disabled={createPreset.isPending}>
            {createPreset.isPending ? '保存中…' : '保存预设'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
