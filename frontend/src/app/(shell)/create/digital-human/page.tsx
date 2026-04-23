'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { History, Mic2 } from 'lucide-react';
import { toast } from 'sonner';

import { useDraft } from '@/lib/hooks/use-draft';
import { useBgmList, useTtsWorkflows } from '@/lib/hooks/use-resources';
import { useSubmitDigitalHuman } from '@/lib/hooks/use-create-video';
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

type DigitalHumanRequest = Omit<components['schemas']['DigitalHumanAsyncRequest'], 'project_id'>;

const DIGITAL_HUMAN_REQUEST_KEYS = [
  'bgm_mode',
  'bgm_path',
  'bgm_volume',
  'narration',
  'portrait_url',
  'project_id',
  'runninghub_instance_type',
  'voice_workflow',
] as const satisfies readonly (keyof components['schemas']['DigitalHumanAsyncRequest'])[];

type DigitalHumanFormValues = {
  bgm_mode: 'default' | 'custom' | 'none';
  bgm_path: string;
  narration: string;
  portrait_url: string;
  runninghub_instance_type: 'auto' | 'plus';
  voice_workflow: string;
};

function buildDigitalHumanPayload(
  values: DigitalHumanFormValues
): DigitalHumanRequest {
  return {
    bgm_mode: values.bgm_mode,
    bgm_path: values.bgm_mode === 'custom' ? values.bgm_path || null : null,
    bgm_volume: 0.3,
    narration: values.narration.trim(),
    portrait_url: values.portrait_url,
    runninghub_instance_type: values.runninghub_instance_type,
    voice_workflow: values.voice_workflow === '__none__' ? null : values.voice_workflow,
  };
}

function toDigitalHumanFormValues(payload: Record<string, unknown>): Partial<DigitalHumanFormValues> {
  return {
    bgm_mode: payload.bgm_mode === 'custom' ? 'custom' : 'none',
    bgm_path: typeof payload.bgm_path === 'string' ? payload.bgm_path : '',
    narration: typeof payload.narration === 'string' ? payload.narration : '',
    portrait_url: typeof payload.portrait_url === 'string' ? payload.portrait_url : '',
    runninghub_instance_type: normalizeRunningHubInstanceType(
      typeof payload.runninghub_instance_type === 'string' ? payload.runninghub_instance_type : null
    ),
    voice_workflow:
      typeof payload.voice_workflow === 'string' && payload.voice_workflow.trim()
        ? payload.voice_workflow
        : '__none__',
  };
}

function DigitalHumanPageContent() {
  const t = useAppTranslations('createRoutes');
  const quickT = useAppTranslations('quick');
  const searchParams = useSearchParams();
  const submitDigitalHuman = useSubmitDigitalHuman();
  const pipelineTask = usePipelineTask(submitDigitalHuman, {
    initialTaskId: searchParams.get('task_id'),
  });
  const { data: settingsData } = useSettings();
  const { data: ttsData } = useTtsWorkflows();
  const { data: bgmData } = useBgmList();
  const initialRunningHubInstanceType = searchParams.get('runninghub_instance_type');
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const formSchema = z.object({
    bgm_mode: z.enum(['default', 'custom', 'none']),
    bgm_path: z.string(),
    narration: z.string().trim().min(2, t('digitalHuman.validation.narration')),
    portrait_url: z.string().trim().min(1, t('digitalHuman.validation.portrait')),
    runninghub_instance_type: z.enum(['auto', 'plus']),
    voice_workflow: z.string(),
  });

  const form = useForm<DigitalHumanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bgm_mode: searchParams.get('bgm_mode') === 'custom' ? 'custom' : 'none',
      bgm_path: searchParams.get('bgm_path') ?? '',
      narration: searchParams.get('narration') ?? '',
      portrait_url: searchParams.get('portrait_url') ?? '',
      runninghub_instance_type: normalizeRunningHubInstanceType(initialRunningHubInstanceType),
      voice_workflow: searchParams.get('voice_workflow') ?? '__none__',
    },
  });

  const configValues = useWatch({ control: form.control });
  const shouldEnableDraft = searchParams.toString().length === 0;
  const selectedBgmMode = useWatch({ control: form.control, name: 'bgm_mode' });
  const selectedVoiceWorkflow = useWatch({ control: form.control, name: 'voice_workflow' });
  const selectedVoiceWorkflowInfo = ttsData?.workflows.find((workflow) => workflow.key === selectedVoiceWorkflow);
  const selectedBgmInfo = bgmData?.bgm_files.find((bgm) => bgm.path === configValues.bgm_path);
  const shouldShowRunningHubInstanceType =
    selectedVoiceWorkflow !== '__none__' && isRunningHubWorkflow(ttsData?.workflows, selectedVoiceWorkflow);
  const summaryItems = useMemo<ConfigSummaryItem[]>(() => {
    const items: ConfigSummaryItem[] = [
      {
        key: 'portrait',
        label: t('digitalHuman.fields.portraitImage'),
        value: configValues.portrait_url ? t('shared.uploaded') : t('shared.missing'),
      },
      {
        key: 'narration',
        label: t('digitalHuman.fields.narration'),
        value: configValues.narration || t('digitalHuman.status.waitingNarration'),
      },
      {
        key: 'voice_workflow',
        label: t('digitalHuman.fields.voiceWorkflow'),
        value:
          configValues.voice_workflow && configValues.voice_workflow !== '__none__'
            ? (selectedVoiceWorkflowInfo ? getWorkflowDisplayName(selectedVoiceWorkflowInfo) : configValues.voice_workflow)
            : t('digitalHuman.actions.useDefaultWorkflow'),
        detail:
          configValues.voice_workflow && configValues.voice_workflow !== '__none__'
            ? (selectedVoiceWorkflowInfo ? getWorkflowDescription(selectedVoiceWorkflowInfo) : quickT('ttsHelp'))
            : quickT('ttsHelp'),
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
    configValues.narration,
    configValues.portrait_url,
    configValues.runninghub_instance_type,
    configValues.voice_workflow,
    quickT,
    selectedBgmInfo,
    selectedBgmMode,
    selectedVoiceWorkflowInfo,
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

  const { clearDraft } = useDraft('digital-human', pipelineTask.currentProject?.id, {
    enabled: shouldEnableDraft && pipelineTask.isHydrated && !searchParams.get('task_id'),
    onRestore: (draft) => {
      form.reset({
        ...form.getValues(),
        ...(draft as Partial<DigitalHumanFormValues>),
      });
    },
    params: (configValues ?? form.getValues()) as DigitalHumanFormValues,
  });

  const fieldHighlightClass = (keys: string[]) =>
    keys.some((key) => highlightedFields.includes(key)) ? 'animate-highlight rounded-xl' : '';

  const applyDigitalHumanParams = (params: Partial<DigitalHumanFormValues>, changedKeys?: string[]) => {
    form.reset({
      ...form.getValues(),
      ...params,
    });
    setHighlightedFields(changedKeys ?? Object.keys(params));
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const submitted = await pipelineTask.submit(buildDigitalHumanPayload(values));
    if (!submitted) {
      return;
    }

    await clearDraft();
    toast.success(<SubmitSuccessToast taskName={values.narration.trim().slice(0, 48) || 'Digital Human'} />);
  });

  return (
    <>
        <CreatePipelineLayout
        title={t('digitalHuman.title')}
        description={t('digitalHuman.description')}
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
                  pipeline="digital-human"
                  currentParams={(configValues ?? form.getValues()) as Record<string, unknown>}
                  savePayload={buildDigitalHumanPayload(form.getValues())}
                  mapPresetToParams={toDigitalHumanFormValues}
                  onApply={(params, changedKeys) =>
                    applyDigitalHumanParams(params as Partial<DigitalHumanFormValues>, changedKeys)
                  }
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
                    <Mic2 className="size-8" />
                  </div>
                  {t('digitalHuman.sections.presenterSetup')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <FormField
                  control={form.control}
                  name="portrait_url"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="digital-human.portrait_url">
                      <FormItem className={fieldHighlightClass(['portrait_url'])}>
                      <FormLabel>
                        <FieldLabel label={t('digitalHuman.fields.portraitImage')} required />
                      </FormLabel>
                      <MediaUploader
                        accept="image/*"
                        inputLabel={t('digitalHuman.fields.portraitImage')}
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
                  name="narration"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="digital-human.narration">
                      <FormItem className={fieldHighlightClass(['narration'])}>
                      <FormLabel>
                        <FieldLabel label={t('digitalHuman.fields.narration')} required />
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={t('digitalHuman.placeholders.narration')}
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
                  name="voice_workflow"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="digital-human.voice_workflow">
                      <FormItem className={fieldHighlightClass(['voice_workflow'])}>
                      <FormLabel>
                        <FieldLabel label={t('digitalHuman.fields.voiceWorkflow')} />
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger aria-label={t('digitalHuman.fields.voiceWorkflow')}>
                            <SelectValue placeholder={t('digitalHuman.placeholders.voiceWorkflow')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">{t('digitalHuman.actions.useDefaultWorkflow')}</SelectItem>
                          {(ttsData?.workflows ?? []).map((workflow) => (
                            <SelectItem key={workflow.key} value={workflow.key}>
                              {getWorkflowDisplayName(workflow)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {selectedVoiceWorkflowInfo ? getWorkflowDescription(selectedVoiceWorkflowInfo) : quickT('ttsHelp')}
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
                      <ParamHintPopover paramKey="digital-human.bgm_mode">
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
                      <ParamHintPopover paramKey="digital-human.bgm_path">
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
                      <ParamHintPopover paramKey="digital-human.runninghub_instance_type">
                        <div className={fieldHighlightClass(['runninghub_instance_type'])}>
                          <RunningHubInstanceTypeField
                            value={field.value}
                            onChange={field.onChange}
                            disabled={pipelineTask.isSubmitting}
                            testId="digital-human-runninghub-instance-type"
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
                pipeline="digital-human"
                disabled={!pipelineTask.isHydrated || pipelineTask.isSubmitting}
                requiredFields={[
                  { key: 'portrait_url', label: t('digitalHuman.fields.portraitImage'), value: form.getValues('portrait_url') },
                  { key: 'narration', label: t('digitalHuman.fields.narration'), value: form.getValues('narration') },
                ]}
                onPass={() => form.handleSubmit(async (values) => {
                  const submitted = await pipelineTask.submit(buildDigitalHumanPayload(values));
                  if (!submitted) {
                    return;
                  }

                  await clearDraft();
                  toast.success(
                    <SubmitSuccessToast taskName={values.narration.trim().slice(0, 48) || 'Digital Human'} />
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
        pipeline="digital-human"
        projectId={pipelineTask.currentProject?.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        mapTaskToParams={(task) => toDigitalHumanFormValues((task.request_params ?? {}) as Record<string, unknown>)}
        onApply={(params) => applyDigitalHumanParams(params as Partial<DigitalHumanFormValues>)}
      />
    </>
  );
}

export default function DigitalHumanPage() {
  const common = useAppTranslations('common');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{common('loading')}</div>}>
      <DigitalHumanPageContent />
    </Suspense>
  );
}
