'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { History, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import { useDraft } from '@/lib/hooks/use-draft';
import { useBgmList, useMediaWorkflows } from '@/lib/hooks/use-resources';
import { useSubmitI2V } from '@/lib/hooks/use-create-video';
import { useSettings } from '@/lib/hooks/use-settings';
import { usePipelineTask } from '@/lib/hooks/use-pipeline-task';
import { useAppTranslations } from '@/lib/i18n';
import type { components } from '@/types/api';
import { CreatePipelineLayout } from '@/components/create/create-pipeline-layout';
import { FieldLabel } from '@/components/create/field-label';
import { ParamHintPopover } from '@/components/create/param-hint-popover';
import { ParamHistoryDrawer } from '@/components/create/param-history-drawer';
import { PipelineStatusPanel } from '@/components/create/pipeline-status-panel';
import { PreflightCheck } from '@/components/create/preflight-check';
import { PresetSelector } from '@/components/create/preset-selector';
import { ProjectRequiredDialog } from '@/components/create/project-required-dialog';
import { RunningHubInstanceTypeField } from '@/components/create/runninghub-instance-type-field';
import { SubmitSuccessToast } from '@/components/create/submit-success-toast';
import { AiFeatureGates } from '@/components/create/ai-feature-gates';
import { MediaUploader } from '@/components/shared/media-uploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { isRunningHubWorkflow, normalizeRunningHubInstanceType } from '@/lib/runninghub-instance-type';
import {
  type ConfigSummaryItem,
  getBgmDescription,
  getBgmDisplayName,
  getBgmOptionLabel,
  getWorkflowDescription,
  getWorkflowDisplayName,
  getWorkflowOptionLabel,
} from '@/lib/resource-display';

type I2VRequest = Omit<components['schemas']['I2VAsyncRequest'], 'project_id'>;

const I2V_REQUEST_KEYS = [
  'bgm_mode',
  'bgm_path',
  'bgm_volume',
  'media_workflow',
  'motion_prompt',
  'project_id',
  'runninghub_instance_type',
  'source_image',
] as const satisfies readonly (keyof components['schemas']['I2VAsyncRequest'])[];

type I2VFormValues = {
  bgm_mode: 'default' | 'custom' | 'none';
  bgm_path: string;
  media_workflow: string;
  motion_prompt: string;
  runninghub_instance_type: 'auto' | 'plus';
  source_image: string;
};

function buildI2VPayload(values: I2VFormValues): I2VRequest {
  return {
    bgm_mode: values.bgm_mode,
    bgm_path: values.bgm_mode === 'custom' ? values.bgm_path || null : null,
    bgm_volume: 0.3,
    media_workflow: values.media_workflow,
    motion_prompt: values.motion_prompt.trim(),
    runninghub_instance_type: values.runninghub_instance_type,
    source_image: values.source_image,
  };
}

function toI2VFormValues(payload: Record<string, unknown>): Partial<I2VFormValues> {
  return {
    bgm_mode: payload.bgm_mode === 'custom' ? 'custom' : 'none',
    bgm_path: typeof payload.bgm_path === 'string' ? payload.bgm_path : '',
    media_workflow: typeof payload.media_workflow === 'string' ? payload.media_workflow : '',
    motion_prompt: typeof payload.motion_prompt === 'string' ? payload.motion_prompt : '',
    runninghub_instance_type: normalizeRunningHubInstanceType(
      typeof payload.runninghub_instance_type === 'string' ? payload.runninghub_instance_type : null
    ),
    source_image: typeof payload.source_image === 'string' ? payload.source_image : '',
  };
}

function I2VPageContent() {
  const t = useAppTranslations('createRoutes');
  const quickT = useAppTranslations('quick');
  const searchParams = useSearchParams();
  const submitI2V = useSubmitI2V();
  const pipelineTask = usePipelineTask(submitI2V, {
    initialTaskId: searchParams.get('task_id'),
  });
  const { data: settingsData } = useSettings();
  const { data: mediaData } = useMediaWorkflows();
  const { data: bgmData } = useBgmList();
  const initialRunningHubInstanceType = searchParams.get('runninghub_instance_type');
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const formSchema = z.object({
    bgm_mode: z.enum(['default', 'custom', 'none']),
    bgm_path: z.string(),
    media_workflow: z.string().trim().min(1, t('i2v.validation.mediaWorkflow')),
    motion_prompt: z.string().trim().min(2, t('i2v.validation.motionPrompt')),
    runninghub_instance_type: z.enum(['auto', 'plus']),
    source_image: z.string().trim().min(1, t('i2v.validation.sourceImage')),
  });

  const form = useForm<I2VFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bgm_mode: searchParams.get('bgm_mode') === 'custom' ? 'custom' : 'none',
      bgm_path: searchParams.get('bgm_path') ?? '',
      media_workflow: searchParams.get('media_workflow') ?? '',
      motion_prompt: searchParams.get('motion_prompt') ?? '',
      runninghub_instance_type: normalizeRunningHubInstanceType(initialRunningHubInstanceType),
      source_image: searchParams.get('source_image') ?? '',
    },
  });

  const configValues = useWatch({ control: form.control });
  const shouldEnableDraft = searchParams.toString().length === 0;
  const selectedBgmMode = useWatch({ control: form.control, name: 'bgm_mode' });
  const selectedMediaWorkflow = useWatch({ control: form.control, name: 'media_workflow' });
  const selectedMediaWorkflowInfo = mediaData?.workflows.find((workflow) => workflow.key === selectedMediaWorkflow);
  const selectedBgmInfo = bgmData?.bgm_files.find((bgm) => bgm.path === configValues.bgm_path);
  const shouldShowRunningHubInstanceType = isRunningHubWorkflow(mediaData?.workflows, selectedMediaWorkflow);
  const summaryItems = useMemo<ConfigSummaryItem[]>(() => {
    const items: ConfigSummaryItem[] = [
      {
        key: 'source_image',
        label: t('i2v.fields.sourceImage'),
        value: configValues.source_image ? t('shared.uploaded') : t('shared.missing'),
      },
      {
        key: 'motion_prompt',
        label: t('i2v.fields.motionPrompt'),
        value: configValues.motion_prompt || t('i2v.status.waitingMotionPrompt'),
      },
      {
        key: 'media_workflow',
        label: t('i2v.fields.mediaWorkflow'),
        value: selectedMediaWorkflowInfo ? getWorkflowDisplayName(selectedMediaWorkflowInfo) : t('shared.notSelected'),
        detail: selectedMediaWorkflowInfo ? getWorkflowDescription(selectedMediaWorkflowInfo) : quickT('mediaHelp'),
      },
      {
        key: 'bgm',
        label: quickT('bgmLabel'),
        value:
          selectedBgmMode === 'custom'
            ? (selectedBgmInfo ? getBgmDisplayName(selectedBgmInfo) : quickT('bgmModes.custom'))
            : quickT('bgmModes.none'),
        detail:
          selectedBgmMode === 'custom'
            ? (selectedBgmInfo ? getBgmDescription(selectedBgmInfo) : quickT('bgmHelpCustom'))
            : quickT('bgmHelpNone'),
      },
    ];

    if (shouldShowRunningHubInstanceType) {
      items.push({
        key: 'runninghub_instance_type',
        label: quickT('summary.runninghubInstanceType'),
        value:
          configValues.runninghub_instance_type === 'plus'
            ? quickT('runninghubInstancePlus')
            : quickT('runninghubInstanceAuto'),
      });
    }

    return items;
  }, [
    configValues.bgm_path,
    configValues.motion_prompt,
    configValues.runninghub_instance_type,
    configValues.source_image,
    quickT,
    selectedBgmInfo,
    selectedBgmMode,
    selectedMediaWorkflowInfo,
    shouldShowRunningHubInstanceType,
    t,
  ]);

  useEffect(() => {
    if (initialRunningHubInstanceType !== null || !settingsData) {
      return;
    }

    if (form.getFieldState('runninghub_instance_type').isDirty) {
      return;
    }

    form.setValue(
      'runninghub_instance_type',
      normalizeRunningHubInstanceType(settingsData.comfyui?.runninghub_instance_type),
      { shouldDirty: false, shouldTouch: false }
    );
  }, [form, initialRunningHubInstanceType, settingsData]);

  useEffect(() => {
    if (highlightedFields.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => setHighlightedFields([]), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [highlightedFields]);

  const { clearDraft } = useDraft('i2v', pipelineTask.currentProject?.id, {
    enabled: shouldEnableDraft && pipelineTask.isHydrated && !searchParams.get('task_id'),
    onRestore: (draft) => {
      form.reset({
        ...form.getValues(),
        ...(draft as Partial<I2VFormValues>),
      });
    },
    params: (configValues ?? form.getValues()) as I2VFormValues,
  });

  const fieldHighlightClass = (keys: string[]) =>
    keys.some((key) => highlightedFields.includes(key)) ? 'animate-highlight rounded-xl' : '';

  const applyI2VParams = (params: Partial<I2VFormValues>, changedKeys?: string[]) => {
    form.reset({
      ...form.getValues(),
      ...params,
    });
    setHighlightedFields(changedKeys ?? Object.keys(params));
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const submitted = await pipelineTask.submit(buildI2VPayload(values));
    if (!submitted) {
      return;
    }

    await clearDraft();
    toast.success(<SubmitSuccessToast taskName={values.motion_prompt.trim().slice(0, 48) || 'Image to Video'} />);
  });

  return (
    <>
        <CreatePipelineLayout
        title={t('i2v.title')}
        description={t('i2v.description')}
        statusPanel={
          <PipelineStatusPanel
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
                  pipeline="i2v"
                  currentParams={(configValues ?? form.getValues()) as Record<string, unknown>}
                  savePayload={buildI2VPayload(form.getValues())}
                  mapPresetToParams={toI2VFormValues}
                  onApply={(params, changedKeys) => applyI2VParams(params as Partial<I2VFormValues>, changedKeys)}
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
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ImageIcon className="size-8" />
                  </div>
                  {t('i2v.sections.motionSetup')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <FormField
                  control={form.control}
                  name="source_image"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="i2v.source_image">
                      <FormItem className={fieldHighlightClass(['source_image'])}>
                      <FormLabel>
                        <FieldLabel label={t('i2v.fields.sourceImage')} required />
                      </FormLabel>
                      <MediaUploader
                        accept="image/*"
                        inputLabel={t('i2v.fields.sourceImage')}
                        value={field.value}
                        onChange={field.onChange}
                      />
                      <FormMessage />
                      </FormItem>
                    </ParamHintPopover>
                  )}
                />

                <FormField
                  control={form.control}
                  name="motion_prompt"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="i2v.motion_prompt">
                      <FormItem className={fieldHighlightClass(['motion_prompt'])}>
                      <FormLabel>
                        <FieldLabel label={t('i2v.fields.motionPrompt')} required />
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={t('i2v.placeholders.motionPrompt')}
                          className="min-h-40"
                        />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                    </ParamHintPopover>
                  )}
                />

                <FormField
                  control={form.control}
                  name="media_workflow"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="i2v.media_workflow">
                      <FormItem className={fieldHighlightClass(['media_workflow'])}>
                      <FormLabel>
                        <FieldLabel label={t('i2v.fields.mediaWorkflow')} required />
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger aria-label={t('i2v.fields.mediaWorkflow')}>
                            <SelectValue placeholder={t('i2v.placeholders.mediaWorkflow')} />
                          </SelectTrigger>
                        </FormControl>
                          <SelectContent>
                            {(mediaData?.workflows ?? []).map((workflow) => (
                              <SelectItem key={workflow.key} value={workflow.key}>
                                {getWorkflowDisplayName(workflow)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {selectedMediaWorkflowInfo ? getWorkflowDescription(selectedMediaWorkflowInfo) : quickT('mediaHelp')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    </ParamHintPopover>
                    )}
                  />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="bgm_mode"
                    render={({ field }) => (
                      <ParamHintPopover paramKey="i2v.bgm_mode">
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
                        <FormDescription>
                          {selectedBgmMode === 'custom' ? quickT('bgmModeHelpCustom') : quickT('bgmModeHelpNone')}
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                      </ParamHintPopover>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bgm_path"
                    render={({ field }) => (
                      <ParamHintPopover paramKey="i2v.bgm_path">
                        <FormItem className={fieldHighlightClass(['bgm_path'])}>
                        <FormLabel>{quickT('bgmLabel')}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={selectedBgmMode !== 'custom'}>
                          <FormControl>
                            <SelectTrigger aria-label={quickT('bgmLabel')}>
                              <SelectValue placeholder={quickT('bgmPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(bgmData?.bgm_files ?? []).map((bgm) => (
                              <SelectItem key={bgm.path} value={bgm.path}>
                                {getBgmOptionLabel(bgm)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {selectedBgmMode === 'custom'
                            ? (selectedBgmInfo ? getBgmDescription(selectedBgmInfo) : quickT('bgmHelpCustom'))
                            : quickT('bgmHelpNone')}
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                      </ParamHintPopover>
                    )}
                  />
                </div>

                {shouldShowRunningHubInstanceType ? (
                  <FormField
                    control={form.control}
                    name="runninghub_instance_type"
                    render={({ field }) => (
                      <ParamHintPopover paramKey="i2v.runninghub_instance_type">
                        <div className={fieldHighlightClass(['runninghub_instance_type'])}>
                          <RunningHubInstanceTypeField
                            value={field.value}
                            onChange={field.onChange}
                            disabled={pipelineTask.isSubmitting}
                            testId="i2v-runninghub-instance-type"
                          />
                        </div>
                      </ParamHintPopover>
                    )}
                  />
                ) : null}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <PreflightCheck
                pipeline="i2v"
                disabled={!pipelineTask.isHydrated || pipelineTask.isSubmitting}
                requiredFields={[
                  { key: 'source_image', label: t('i2v.fields.sourceImage'), value: form.getValues('source_image') },
                  { key: 'motion_prompt', label: t('i2v.fields.motionPrompt'), value: form.getValues('motion_prompt') },
                  { key: 'media_workflow', label: t('i2v.fields.mediaWorkflow'), value: form.getValues('media_workflow') },
                ]}
                onPass={() => form.handleSubmit(async (values) => {
                  const submitted = await pipelineTask.submit(buildI2VPayload(values));
                  if (!submitted) {
                    return;
                  }

                  await clearDraft();
                  toast.success(
                    <SubmitSuccessToast taskName={values.motion_prompt.trim().slice(0, 48) || 'Image to Video'} />
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
        pipeline="i2v"
        projectId={pipelineTask.currentProject?.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        mapTaskToParams={(task) => toI2VFormValues((task.request_params ?? {}) as Record<string, unknown>)}
        onApply={(params) => applyI2VParams(params as Partial<I2VFormValues>)}
      />
    </>
  );
}

export default function I2VPage() {
  const common = useAppTranslations('common');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{common('loading')}</div>}>
      <I2VPageContent />
    </Suspense>
  );
}
