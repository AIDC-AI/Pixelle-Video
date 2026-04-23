'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { usePresets } from '@/lib/hooks/use-resources';
import type { DraftPipeline } from '@/lib/draft-store';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PresetSaveDialog } from '@/components/create/preset-save-dialog';

interface PresetSelectorProps {
  currentParams: Record<string, unknown>;
  disabled?: boolean;
  mapPresetToParams: (payload: Record<string, unknown>) => Record<string, unknown>;
  onApply: (params: Record<string, unknown>, changedKeys: string[]) => void;
  pipeline: DraftPipeline;
  savePayload: Record<string, unknown>;
}

function matchesPipeline(presetPipeline: string, pipeline: DraftPipeline): boolean {
  if (pipeline === 'quick') {
    return presetPipeline === 'standard' || presetPipeline === 'quick';
  }
  if (pipeline === 'digital-human') {
    return presetPipeline === 'digital_human' || presetPipeline === 'digital-human';
  }
  if (pipeline === 'action-transfer') {
    return presetPipeline === 'action_transfer' || presetPipeline === 'action-transfer';
  }
  if (pipeline === 'custom') {
    return presetPipeline === 'asset_based' || presetPipeline === 'custom';
  }
  return presetPipeline === pipeline;
}

function isChanged(currentValue: unknown, nextValue: unknown): boolean {
  return JSON.stringify(currentValue) !== JSON.stringify(nextValue);
}

export function PresetSelector({
  currentParams,
  disabled = false,
  mapPresetToParams,
  onApply,
  pipeline,
  savePayload,
}: PresetSelectorProps) {
  const presetsQuery = usePresets();
  const [selectedName, setSelectedName] = useState<string>('');
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

  const presets = useMemo(
    () => (presetsQuery.data?.presets ?? []).filter((preset) => matchesPipeline(preset.pipeline, pipeline)),
    [pipeline, presetsQuery.data?.presets]
  );

  const handleApply = (presetName: string | null) => {
    if (!presetName) {
      return;
    }

    setSelectedName(presetName);
    const preset = presets.find((item) => item.name === presetName);
    if (!preset) {
      return;
    }

    const mappedParams = mapPresetToParams((preset.payload_template ?? {}) as Record<string, unknown>);
    const changedKeys = Object.keys(mappedParams).filter((key) => isChanged(currentParams[key], mappedParams[key]));

    onApply(mappedParams, changedKeys);
    toast.success(`已应用预设 ${preset.name}，${changedKeys.length} 个参数变更`);
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-none">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">预设</p>
          <p className="text-xs text-muted-foreground">
            一键套用已有参数组合，或把当前参数保存成新预设。
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={selectedName} onValueChange={handleApply} disabled={disabled || presets.length === 0}>
            <SelectTrigger aria-label="选择预设" className="min-w-56">
              <SelectValue
                placeholder={presets.length === 0
                  ? '当前 pipeline 暂无预设'
                  : '选择一个预设'}
              />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.name} value={preset.name}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setIsSaveDialogOpen(true)} disabled={disabled}>
            保存当前为预设
          </Button>
        </div>
      </div>

      <PresetSaveDialog
        pipeline={pipeline}
        currentParams={savePayload}
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
      />
    </div>
  );
}
