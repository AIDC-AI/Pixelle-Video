'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { History, PenTool, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useDraft } from '@/lib/hooks/use-draft';
import { useBgmList } from '@/lib/hooks/use-resources';
import { useSubmitCustom } from '@/lib/hooks/use-create-video';
import { usePipelineTask } from '@/lib/hooks/use-pipeline-task';
import { useSettings } from '@/lib/hooks/use-settings';
import { useAppTranslations } from '@/lib/i18n';
import type { ConfigSummaryItem } from '@/lib/resource-display';
import { getBgmDescription, getBgmDisplayName, getBgmModeLabel } from '@/lib/resource-display';
import type { components } from '@/types/api';
import { CreatePipelineLayout } from '@/components/create/create-pipeline-layout';
import { FieldLabel } from '@/components/create/field-label';
import { ParamHintPopover } from '@/components/create/param-hint-popover';
import { ParamHistoryDrawer } from '@/components/create/param-history-drawer';
import { PipelineStatusPanel } from '@/components/create/pipeline-status-panel';
import { PreflightCheck } from '@/components/create/preflight-check';
import { PresetSelector } from '@/components/create/preset-selector';
import { ProjectRequiredDialog } from '@/components/create/project-required-dialog';
import { SubmitSuccessToast } from '@/components/create/submit-success-toast';
import { AiFeatureGates } from '@/components/create/ai-feature-gates';
import { MediaUploader } from '@/components/shared/media-uploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type CustomRequest = Omit<components['schemas']['CustomAsyncRequest'], 'project_id'>;
type CustomScene = components['schemas']['CustomScene'];

const CUSTOM_REQUEST_KEYS = [
  'bgm_mode',
  'bgm_path',
  'bgm_volume',
  'project_id',
  'scenes',
] as const satisfies readonly (keyof components['schemas']['CustomAsyncRequest'])[];

const CUSTOM_SCENE_KEYS = [
  'duration',
  'media',
  'narration',
] as const satisfies readonly (keyof CustomScene)[];

type CustomFormValues = {
  bgm_mode: 'default' | 'custom' | 'none';
  bgm_path: string;
  scenes: Array<{
    duration: number;
    media: string;
    narration: string;
  }>;
};

const EMPTY_SCENE: CustomFormValues['scenes'][number] = {
  duration: 5,
  media: '',
  narration: '',
};

function parseScenes(searchParam: string | null): CustomFormValues['scenes'] {
  if (!searchParam) {
    return [EMPTY_SCENE];
  }

  try {
    const parsed = JSON.parse(searchParam) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [EMPTY_SCENE];
    }

    const scenes = parsed
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return EMPTY_SCENE;
        }

        const candidate = item as Partial<CustomScene>;
        return {
          duration: typeof candidate.duration === 'number' ? candidate.duration : 5,
          media: typeof candidate.media === 'string' ? candidate.media : '',
          narration: typeof candidate.narration === 'string' ? candidate.narration : '',
        };
      })
      .filter((scene) => scene.media || scene.narration);

    return scenes.length > 0 ? scenes : [EMPTY_SCENE];
  } catch {
    return [EMPTY_SCENE];
  }
}

function buildCustomPayload(values: CustomFormValues): CustomRequest {
  return {
    bgm_mode: values.bgm_mode,
    bgm_path: values.bgm_mode === 'custom' ? values.bgm_path || null : null,
    bgm_volume: 0.3,
    scenes: values.scenes.map((scene) => ({
      duration: scene.duration,
      media: scene.media,
      narration: scene.narration.trim(),
    })),
  };
}

function toCustomFormValues(payload: Record<string, unknown>): Partial<CustomFormValues> {
  const scenes = Array.isArray(payload.scenes)
    ? payload.scenes.flatMap((scene) => {
        if (!scene || typeof scene !== 'object') {
          return [];
        }

        const candidate = scene as Record<string, unknown>;
        return [
          {
            duration: typeof candidate.duration === 'number' ? candidate.duration : Number(candidate.duration) || 5,
            media: typeof candidate.media === 'string' ? candidate.media : '',
            narration: typeof candidate.narration === 'string' ? candidate.narration : '',
          },
        ];
      })
    : [EMPTY_SCENE];

  return {
    bgm_mode: payload.bgm_mode === 'custom' ? 'custom' : 'none',
    bgm_path: typeof payload.bgm_path === 'string' ? payload.bgm_path : '',
    scenes: scenes.length > 0 ? scenes : [EMPTY_SCENE],
  };
}

function CustomPageContent() {
  const t = useAppTranslations('createRoutes');
  const quickT = useAppTranslations('quick');
  const searchParams = useSearchParams();
  const { data: bgmData } = useBgmList();
  const submitCustom = useSubmitCustom();
  useSettings();
  const pipelineTask = usePipelineTask(submitCustom, {
    initialTaskId: searchParams.get('task_id'),
  });
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const sceneSchema = z.object({
    duration: z.number().min(1, t('custom.validation.duration')),
    media: z.string().trim().min(1, t('custom.validation.media')),
    narration: z.string().trim().min(1, t('custom.validation.narration')),
  });

  const formSchema = z.object({
    bgm_mode: z.enum(['default', 'custom', 'none']),
    bgm_path: z.string(),
    scenes: z.array(sceneSchema).min(1, t('custom.validation.scenes')),
  });

  const form = useForm<CustomFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bgm_mode: searchParams.get('bgm_mode') === 'custom' ? 'custom' : 'none',
      bgm_path: searchParams.get('bgm_path') ?? '',
      scenes: parseScenes(searchParams.get('scenes')),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'scenes',
  });
  const configValues = useWatch({ control: form.control });
  const shouldEnableDraft = searchParams.toString().length === 0;
  const selectedBgmMode = useWatch({ control: form.control, name: 'bgm_mode' });
  const selectedBgmInfo = bgmData?.bgm_files.find((bgm) => bgm.path === configValues.bgm_path);
  const summaryItems = React.useMemo<ConfigSummaryItem[]>(() => {
    const sceneCount = configValues.scenes?.length ?? 0;
    return [
      {
        key: 'scenes',
        label: t('custom.sections.sceneBuilder'),
        value: t('custom.summary.sceneCount', { count: sceneCount }),
        detail: t('custom.summary.sceneDetail', { count: sceneCount }),
      },
      {
        key: 'bgm_mode',
        label: quickT('bgmModeLabel'),
        value: getBgmModeLabel(selectedBgmMode),
        detail:
          selectedBgmMode === 'custom'
            ? (selectedBgmInfo ? getBgmDescription(selectedBgmInfo) : quickT('bgmHelpCustom'))
            : quickT('bgmHelpNone'),
      },
      {
        key: 'bgm_path',
        label: quickT('bgmLabel'),
        value:
          selectedBgmMode === 'custom'
            ? (selectedBgmInfo ? getBgmDisplayName(selectedBgmInfo) : quickT('summary.notSelected'))
            : quickT('summary.bgmNone'),
      },
    ];
  }, [configValues.scenes, quickT, selectedBgmInfo, selectedBgmMode, t]);

  useEffect(() => {
    if (highlightedFields.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => setHighlightedFields([]), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [highlightedFields]);

  const { clearDraft } = useDraft('custom', pipelineTask.currentProject?.id, {
    enabled: shouldEnableDraft && pipelineTask.isHydrated && !searchParams.get('task_id'),
    onRestore: (draft) => {
      form.reset({
        ...form.getValues(),
        ...(draft as Partial<CustomFormValues>),
      });
    },
    params: (configValues ?? form.getValues()) as CustomFormValues,
  });

  const fieldHighlightClass = (keys: string[]) =>
    keys.some((key) => highlightedFields.includes(key)) ? 'animate-highlight rounded-xl' : '';

  const applyCustomParams = (params: Partial<CustomFormValues>, changedKeys?: string[]) => {
    form.reset({
      ...form.getValues(),
      ...params,
    });
    setHighlightedFields(changedKeys ?? Object.keys(params));
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const submitted = await pipelineTask.submit(buildCustomPayload(values));
    if (!submitted) {
      return;
    }

    await clearDraft();
    toast.success(
      <SubmitSuccessToast
        taskName={values.scenes[0]?.narration.trim().slice(0, 48) || `Custom scenes (${values.scenes.length})`}
      />
    );
  });

  return (
    <>
        <CreatePipelineLayout
        title={t('custom.title')}
        description={t('custom.description')}
        statusPanel={
          <PipelineStatusPanel
            config={{
              scenes: configValues.scenes ?? [],
            }}
            summaryItems={summaryItems}
            taskId={pipelineTask.taskId}
            viewState={pipelineTask.viewState}
            activeTaskStatus={pipelineTask.activeTaskStatus}
            progress={pipelineTask.progress}
            currentStep={pipelineTask.currentStep}
            statusMessage={pipelineTask.statusMessage}
            taskResult={pipelineTask.taskResult}
            onCancel={pipelineTask.cancel}
            onReset={pipelineTask.reset}
            aspectRatio="landscape"
          />
        }
      >
        <AiFeatureGates />
        <Form {...form}>
          <form className="space-y-6 pb-8" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <PresetSelector
                  pipeline="custom"
                  currentParams={(configValues ?? form.getValues()) as Record<string, unknown>}
                  savePayload={buildCustomPayload(form.getValues())}
                  mapPresetToParams={toCustomFormValues}
                  onApply={(params, changedKeys) => applyCustomParams(params as Partial<CustomFormValues>, changedKeys)}
                  disabled={pipelineTask.isSubmitting}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => setHistoryOpen(true)}>
                <History className="size-4" />
                历史记录
              </Button>
            </div>

            <Card className="border-border shadow-none">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <PenTool className="size-8" />
                    </div>
                    {t('custom.sections.sceneBuilder')}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => append({ ...EMPTY_SCENE })}
                  >
                    <Plus className="size-4" />
                    {t('custom.actions.addScene')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-4 rounded-xl border border-border/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-medium text-foreground">
                          {t('custom.sceneLabel', { index: index + 1 })}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {t('custom.sceneDescription')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="size-4" />
                        {t('custom.actions.removeScene')}
                      </Button>
                    </div>

                    <FormField
                      control={form.control}
                      name={`scenes.${index}.media`}
                      render={({ field: mediaField }) => (
                        <ParamHintPopover paramKey="custom.scene_media">
                          <FormItem className={fieldHighlightClass([`scenes.${index}.media`])}>
                          <FormLabel>
                            <FieldLabel label={t('custom.fields.sceneMedia')} required />
                          </FormLabel>
                          <MediaUploader
                            accept="image/*,video/*"
                            inputLabel={t('custom.sceneMediaLabel', { index: index + 1 })}
                            value={mediaField.value}
                            onChange={mediaField.onChange}
                          />
                          <FormMessage />
                          </FormItem>
                        </ParamHintPopover>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`scenes.${index}.narration`}
                      render={({ field: narrationField }) => (
                        <ParamHintPopover paramKey="custom.scene_narration">
                          <FormItem className={fieldHighlightClass([`scenes.${index}.narration`])}>
                          <FormLabel>
                            <FieldLabel label={t('custom.fields.sceneNarration')} required />
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...narrationField}
                              placeholder={t('custom.placeholders.sceneNarration')}
                              className="min-h-28"
                            />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                        </ParamHintPopover>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`scenes.${index}.duration`}
                      render={({ field: durationField }) => (
                        <ParamHintPopover paramKey="custom.scene_duration">
                          <FormItem className={fieldHighlightClass([`scenes.${index}.duration`])}>
                          <FormLabel>
                            <FieldLabel label={t('custom.fields.durationSeconds')} required />
                          </FormLabel>
                          <FormControl>
                            <Input
                              name={durationField.name}
                              type="number"
                              min={1}
                              step={1}
                              value={durationField.value}
                              onBlur={durationField.onBlur}
                              onChange={(event) => durationField.onChange(event.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                        </ParamHintPopover>
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border shadow-none">
              <CardHeader className="border-b">
                <CardTitle className="text-lg">{quickT('bgmLabel')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bgm_mode"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="custom.bgm_mode">
                      <FormItem className={fieldHighlightClass(['bgm_mode'])}>
                      <FormLabel>{quickT('bgmModeLabel')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger aria-label={quickT('bgmModeLabel')}>
                            <SelectValue placeholder={quickT('bgmModeLabel')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{quickT('bgmModes.none')}</SelectItem>
                          <SelectItem value="custom">{quickT('bgmModes.custom')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                    </ParamHintPopover>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bgm_path"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="custom.bgm_path">
                      <FormItem className={fieldHighlightClass(['bgm_path'])}>
                      <FormLabel>{quickT('bgmLabel')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={selectedBgmMode !== 'custom'}
                      >
                        <FormControl>
                          <SelectTrigger aria-label={quickT('bgmLabel')}>
                            <SelectValue placeholder={quickT('bgmPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(bgmData?.bgm_files ?? []).map((bgm) => (
                            <SelectItem key={bgm.path} value={bgm.path}>
                              {getBgmDisplayName(bgm)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                    </ParamHintPopover>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <PreflightCheck
                pipeline="custom"
                disabled={!pipelineTask.isHydrated || pipelineTask.isSubmitting}
                requiredFields={[
                  {
                    key: 'scenes',
                    label: t('custom.sections.sceneBuilder'),
                    value: form.getValues('scenes').every(
                      (scene) => scene.media.trim() && scene.narration.trim() && scene.duration > 0
                    )
                      ? 'ok'
                      : '',
                  },
                ]}
                onPass={() => form.handleSubmit(async (values) => {
                  const submitted = await pipelineTask.submit(buildCustomPayload(values));
                  if (!submitted) {
                    return;
                  }

                  await clearDraft();
                  toast.success(
                    <SubmitSuccessToast
                      taskName={
                        values.scenes[0]?.narration.trim().slice(0, 48) || `Custom scenes (${values.scenes.length})`
                      }
                    />
                  );
                })()}
              >
                {t('shared.generateVideo')}
              </PreflightCheck>
            </div>
          </form>
        </Form>
      </CreatePipelineLayout>

      <ProjectRequiredDialog
        open={pipelineTask.showProjectDialog}
        onOpenChange={pipelineTask.setShowProjectDialog}
      />

      <ParamHistoryDrawer
        pipeline="custom"
        projectId={pipelineTask.currentProject?.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        mapTaskToParams={(task) => toCustomFormValues((task.request_params ?? {}) as Record<string, unknown>)}
        onApply={(params) => applyCustomParams(params as Partial<CustomFormValues>)}
      />
    </>
  );
}

export default function CustomPage() {
  const common = useAppTranslations('common');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{common('loading')}</div>}>
      <CustomPageContent />
    </Suspense>
  );
}
