'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LibraryTable } from '@/components/library/library-table';
import { PresetDiffView } from '@/components/presets/preset-diff-view';
import { batchPipelineLabel } from '@/lib/batch-utils';
import { formatRelativeTime } from '@/lib/pipeline-utils';
import {
  useCreatePreset,
  useDeletePreset,
  usePresets,
  useUpdatePreset,
} from '@/lib/hooks/use-resources';
import { useAppTranslations } from '@/lib/i18n';
import { getPresetDescription, getPresetDisplayName } from '@/lib/resource-display';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type PresetItem = components['schemas']['PresetItem'];
type PresetSourceTab = 'builtin' | 'user';

const TABLE_GRID_CLASS = 'grid grid-cols-[1fr_10rem_1.2fr_9rem_16rem]';
const PIPELINE_OPTIONS = ['quick', 'digital-human', 'i2v', 'action-transfer', 'custom'] as const;

function presetSourceLabel(source: PresetItem['source'], t: ReturnType<typeof useAppTranslations>): string {
  return source === 'builtin' ? t('builtinSourceBadge') : t('userSourceBadge');
}

function presetPipelineLabel(pipeline: string): string {
  if (pipeline === 'llm') {
    return '模型配置';
  }

  return batchPipelineLabel(pipeline);
}

function PresetField({
  children,
  description,
  label,
}: {
  children: React.ReactNode;
  description?: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function toCreateHref(preset: PresetItem): string | null {
  const pipelineMap: Record<string, string> = {
    standard: '/create/quick',
    quick: '/create/quick',
    digital_human: '/create/digital-human',
    'digital-human': '/create/digital-human',
    i2v: '/create/i2v',
    action_transfer: '/create/action-transfer',
    'action-transfer': '/create/action-transfer',
    asset_based: '/create/custom',
    custom: '/create/custom',
  };

  const basePath = pipelineMap[preset.pipeline];
  if (!basePath) {
    return null;
  }

  const params = new URLSearchParams();
  Object.entries(preset.payload_template ?? {}).forEach(([key, value]) => {
    if (key === '__metadata') {
      return;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params.set(key, String(value));
      return;
    }

    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      params.set(key, JSON.stringify(value));
    }
  });

  return params.size > 0 ? `${basePath}?${params.toString()}` : basePath;
}

function stringifyPayload(payload: unknown): string {
  return JSON.stringify(payload ?? {}, null, 2);
}

function getPresetParentName(preset: PresetItem): string | null {
  const metadata = preset.payload_template?.__metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata) && 'parent_name' in metadata) {
    const parentName = (metadata as { parent_name?: unknown }).parent_name;
    return typeof parentName === 'string' && parentName.trim() ? parentName : null;
  }

  return null;
}

export default function PresetsPage() {
  const t = useAppTranslations('presets');
  const common = useAppTranslations('common');
  const presetsQuery = usePresets();
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();

  const [activeTab, setActiveTab] = useState<PresetSourceTab>('builtin');
  const [selectedPreset, setSelectedPreset] = useState<PresetItem | null>(null);
  const [editingPreset, setEditingPreset] = useState<PresetItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PresetItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedPresetNames, setSelectedPresetNames] = useState<string[]>([]);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    pipeline: 'quick',
    description: '',
    parentName: '',
    payloadTemplateText: '{}',
  });

  const items = useMemo(
    () => (presetsQuery.data?.presets ?? []).filter((preset) => preset.source === activeTab),
    [activeTab, presetsQuery.data?.presets]
  );
  const selectedDiffPresets = items.filter((preset) => selectedPresetNames.includes(preset.name)).slice(0, 2);
  const allPresets = presetsQuery.data?.presets ?? [];

  const openCreateDialog = () => {
    setEditingPreset(null);
    setIsEditorOpen(true);
    setFormState({
      name: '',
      pipeline: 'quick',
      description: '',
      parentName: '',
      payloadTemplateText: '{}',
    });
  };

  const openEditDialog = (preset: PresetItem) => {
    setEditingPreset(preset);
    setIsEditorOpen(true);
    setFormState({
      name: preset.name,
      pipeline: preset.pipeline,
      description: preset.description ?? '',
      parentName: getPresetParentName(preset) ?? '',
      payloadTemplateText: stringifyPayload(preset.payload_template),
    });
  };

  const togglePresetSelection = (name: string) => {
    setSelectedPresetNames((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name].slice(-2)
    );
  };

  const applyParentPreset = (name: string) => {
    const parent = allPresets.find((preset) => preset.name === name);
    if (!parent) {
      setFormState((current) => ({ ...current, parentName: '' }));
      return;
    }

    setFormState((current) => ({
      ...current,
      description: current.description || parent.description || '',
      parentName: parent.name,
      payloadTemplateText: stringifyPayload(parent.payload_template),
      pipeline: parent.pipeline,
    }));
  };

  const submitPreset = async () => {
    let payloadTemplate: Record<string, unknown>;
    try {
      const parsedValue = JSON.parse(formState.payloadTemplateText);
      if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
        throw new Error('Payload must be a JSON object.');
      }
      payloadTemplate = parsedValue as Record<string, unknown>;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payload must be valid JSON.');
      return;
    }

    const existingMetadata = payloadTemplate.__metadata;
    const nextMetadata =
      existingMetadata && typeof existingMetadata === 'object' && !Array.isArray(existingMetadata)
        ? existingMetadata
        : {};
    const payloadTemplateWithMetadata = formState.parentName
      ? {
          ...payloadTemplate,
          __metadata: {
            ...nextMetadata,
            parent_name: formState.parentName,
          },
        }
      : payloadTemplate;
    const payload = {
      name: formState.name.trim(),
      pipeline: formState.pipeline,
      description: formState.description.trim() || null,
      payload_template: payloadTemplateWithMetadata,
    };

    try {
      if (editingPreset) {
        await updatePreset.mutateAsync({ name: editingPreset.name, payload });
      } else {
        await createPreset.mutateAsync(payload);
      }
      toast.success(t('saveSuccess'));
      setEditingPreset(null);
      setIsEditorOpen(false);
      setFormState({
        name: '',
        pipeline: 'quick',
        description: '',
        parentName: '',
        payloadTemplateText: '{}',
      });
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Failed to save preset.';
      toast.error(message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deletePreset.mutateAsync(deleteTarget.name);
      toast.success(t('deleteSuccess'));
      setDeleteTarget(null);
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Failed to delete preset.';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          {t('createPreset')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={activeTab === 'builtin' ? 'default' : 'outline'}
          onClick={() => {
            setActiveTab('builtin');
            setSelectedPresetNames([]);
          }}
        >
          {t('builtinTab')}
        </Button>
        <Button
          type="button"
          variant={activeTab === 'user' ? 'default' : 'outline'}
          onClick={() => {
            setActiveTab('user');
            setSelectedPresetNames([]);
          }}
        >
          {t('userTab')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={selectedDiffPresets.length !== 2}
          onClick={() => setIsDiffOpen(true)}
        >
          Compare
        </Button>
      </div>

      {presetsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`preset-skeleton-${index}`} className="h-20 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          ))}
        </div>
      ) : null}

      {!presetsQuery.isLoading && items.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title={activeTab === 'builtin' ? t('emptyBuiltin') : t('emptyUser')}
          description={t('emptyDescription')}
        />
      ) : null}

      {!presetsQuery.isLoading && items.length > 0 ? (
        <LibraryTable
          gridClassName={TABLE_GRID_CLASS}
          columns={[t('name'), t('pipeline'), t('descriptionLabel'), t('created'), t('actions')]}
          body={
            <>
              {items.map((preset) => {
                const createHref = toCreateHref(preset);

                return (
                  <div
                    key={`${preset.source}-${preset.name}`}
                    className={`${TABLE_GRID_CLASS} gap-4 border-b border-border/60 px-4 py-4 last:border-none`}
                  >
                    <div className="space-y-1">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${getPresetDisplayName(preset)}`}
                          checked={selectedPresetNames.includes(preset.name)}
                          onChange={() => togglePresetSelection(preset.name)}
                        />
                        <span className="text-sm font-medium text-foreground">{getPresetDisplayName(preset)}</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{presetSourceLabel(preset.source, t)}</Badge>
                        {getPresetParentName(preset) ? (
                          <Badge variant="secondary">Based on {getPresetParentName(preset)}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-sm text-foreground">{presetPipelineLabel(preset.pipeline)}</div>
                    <div className="text-sm text-muted-foreground">
                      {getPresetDescription(preset) ?? t('noDescription')}
                    </div>
                    <div className="text-sm text-muted-foreground">{formatRelativeTime(preset.created_at)}</div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedPreset(preset)}>
                        {common('viewJson')}
                      </Button>
                      {createHref ? (
                        <Link href={createHref} className={cn(buttonVariants({ size: 'sm' }))}>
                          {common('create')}
                        </Link>
                      ) : null}
                      {preset.source === 'user' ? (
                        <>
                          <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(preset)}>
                            {common('edit')}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(preset)}>
                            <Trash2 className="size-4" />
                            {common('delete')}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </>
          }
        />
      ) : null}

      <Dialog open={Boolean(selectedPreset)} onOpenChange={(open) => !open && setSelectedPreset(null)}>
        <DialogContent className="max-w-3xl bg-background">
          <DialogHeader>
            <DialogTitle>{selectedPreset ? getPresetDisplayName(selectedPreset) : t('presetJsonTitle')}</DialogTitle>
            <DialogDescription>{t('presetJsonDescription')}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[70vh] overflow-auto rounded-2xl border border-border/70 bg-muted/10 p-4 text-xs leading-6 text-foreground">
            {JSON.stringify(selectedPreset?.payload_template ?? {}, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={isDiffOpen} onOpenChange={setIsDiffOpen}>
        <DialogContent className="max-w-5xl bg-background">
          <DialogHeader>
            <DialogTitle>Compare presets</DialogTitle>
            <DialogDescription>Simple key-value diff for the two selected preset payloads.</DialogDescription>
          </DialogHeader>
          {selectedDiffPresets.length === 2 ? (
            <PresetDiffView
              presetA={selectedDiffPresets[0].payload_template ?? {}}
              presetB={selectedDiffPresets[1].payload_template ?? {}}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditorOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditorOpen(false);
          setEditingPreset(null);
          setFormState({
            name: '',
            pipeline: 'quick',
            description: '',
            parentName: '',
            payloadTemplateText: '{}',
          });
        }
      }}>
        <DialogContent className="max-w-3xl bg-background">
          <DialogHeader>
            <DialogTitle>{editingPreset ? t('editPreset') : t('createPreset')}</DialogTitle>
            <DialogDescription>{t('presetJsonDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editingPreset ? (
              <PresetField
                label="Based on existing preset"
                description="Optional. Copies payload values and stores the parent reference in preset metadata."
              >
                <Select
                  value={formState.parentName || '__none__'}
                  onValueChange={(value) => applyParentPreset(value ?? '__none__')}
                >
                  <SelectTrigger aria-label="Based on existing preset">
                    <SelectValue placeholder="No parent preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No parent preset</SelectItem>
                    {allPresets.map((preset) => (
                      <SelectItem key={`${preset.source}-${preset.name}`} value={preset.name}>
                        {getPresetDisplayName(preset)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PresetField>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <PresetField
                label={t('fields.name')}
                description={t('fieldDescriptions.name')}
              >
                <Input
                  placeholder={t('namePlaceholder')}
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  disabled={Boolean(editingPreset)}
                />
              </PresetField>
              <PresetField
                label={t('fields.pipeline')}
                description={t('fieldDescriptions.pipeline')}
              >
                <Select
                  value={formState.pipeline}
                  onValueChange={(value) => setFormState((current) => ({ ...current, pipeline: value ?? 'quick' }))}
                >
                  <SelectTrigger aria-label={t('pipelinePlaceholder')}>
                    <SelectValue placeholder={t('pipelinePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {batchPipelineLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PresetField>
            </div>

            <PresetField
              label={t('fields.description')}
              description={t('fieldDescriptions.description')}
            >
              <Textarea
                placeholder={t('descriptionPlaceholder')}
                value={formState.description}
                onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                className="min-h-24"
              />
            </PresetField>

            <PresetField
              label={t('fields.payloadTemplate')}
              description={t('fieldDescriptions.payloadTemplate')}
            >
              <Textarea
                placeholder={t('payloadPlaceholder')}
                value={formState.payloadTemplateText}
                onChange={(event) => setFormState((current) => ({ ...current, payloadTemplateText: event.target.value }))}
                className="min-h-[20rem] font-mono text-xs"
              />
            </PresetField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditorOpen(false)}>
              {common('close')}
            </Button>
            <Button
              type="button"
              onClick={() => void submitPreset()}
              disabled={createPreset.isPending || updatePreset.isPending || !formState.name.trim()}
            >
              {common('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>{t('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              {common('cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deletePreset.isPending}>
              {common('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
