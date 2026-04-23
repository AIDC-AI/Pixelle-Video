'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Activity, History } from 'lucide-react';
import { toast } from 'sonner';

import { useDraft } from '@/lib/hooks/use-draft';
import { useBgmList, useMediaWorkflows } from '@/lib/hooks/use-resources';
import { useSubmitActionTransfer } from '@/lib/hooks/use-create-video';
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

type ActionTransferRequest = Omit<components['schemas']['ActionTransferAsyncRequest'], 'project_id'>;

const ACTION_TRANSFER_REQUEST_KEYS = [
  'bgm_mode',
  'bgm_path',
  'bgm_volume',
  'driver_video',
  'pose_workflow',
  'project_id',
  'runninghub_instance_type',
  'target_image',
] as const satisfies readonly (keyof components['schemas']['ActionTransferAsyncRequest'])[];

type ActionTransferFormValues = {
  bgm_mode: 'default' | 'custom' | 'none';
  bgm_path: string;
  driver_video: string;
  pose_workflow: string;
  runninghub_instance_type: 'auto' | 'plus';
  target_image: string;
};

function buildActionTransferPayload(
  values: ActionTransferFormValues
): ActionTransferRequest {
  return {
    bgm_mode: values.bgm_mode,
    bgm_path: values.bgm_mode === 'custom' ? values.bgm_path || null : null,
    bgm_volume: 0.3,
    driver_video: values.driver_video,
    pose_workflow: values.pose_workflow,
    runninghub_instance_type: values.runninghub_instance_type,
    target_image: values.target_image,
  };
}

function toActionTransferFormValues(payload: Record<string, unknown>): Partial<ActionTransferFormValues> {
  return {
    bgm_mode: payload.bgm_mode === 'custom' ? 'custom' : 'none',
    bgm_path: typeof payload.bgm_path === 'string' ? payload.bgm_path : '',
    driver_video: typeof payload.driver_video === 'string' ? payload.driver_video : '',
    pose_workflow: typeof payload.pose_workflow === 'string' ? payload.pose_workflow : '',
    runninghub_instance_type: normalizeRunningHubInstanceType(
      typeof payload.runninghub_instance_type === 'string' ? payload.runninghub_instance_type : null
    ),
    target_image: typeof payload.target_image === 'string' ? payload.target_image : '',
  };
}

function ActionTransferPageContent() {
  const t = useAppTranslations('createRoutes');
  const quickT = useAppTranslations('quick');
  const searchParams = useSearchParams();
  const submitActionTransfer = useSubmitActionTransfer();
  const pipelineTask = usePipelineTask(submitActionTransfer, {
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
    driver_video: z.string().trim().min(1, t('actionTransfer.validation.driverVideo')),
    pose_workflow: z.string().trim().min(1, t('actionTransfer.validation.poseWorkflow')),
    runninghub_instance_type: z.enum(['auto', 'plus']),
    target_image: z.string().trim().min(1, t('actionTransfer.validation.targetImage')),
  });

  const form = useForm<ActionTransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bgm_mode: searchParams.get('bgm_mode') === 'custom' ? 'custom' : 'none',
      bgm_path: searchParams.get('bgm_path') ?? '',
      driver_video: searchParams.get('driver_video') ?? '',
      pose_workflow: searchParams.get('pose_workflow') ?? '',
      runninghub_instance_type: normalizeRunningHubInstanceType(initialRunningHubInstanceType),
      target_image: searchParams.get('target_image') ?? '',
    },
  });

  const configValues = useWatch({ control: form.control });
  const shouldEnableDraft = searchParams.toString().length === 0;
  const selectedBgmMode = useWatch({ control: form.control, name: 'bgm_mode' });
  const selectedPoseWorkflow = useWatch({ control: form.control, name: 'pose_workflow' });
  const selectedPoseWorkflowInfo = mediaData?.workflows.find((workflow) => workflow.key === selectedPoseWorkflow);
  const selectedBgmInfo = bgmData?.bgm_files.find((bgm) => bgm.path === configValues.bgm_path);
  const shouldShowRunningHubInstanceType = isRunningHubWorkflow(mediaData?.workflows, selectedPoseWorkflow);
  const summaryItems = useMemo<ConfigSummaryItem[]>(() => {
    const items: ConfigSummaryItem[] = [
      {
        key: 'driver_video',
        label: t('actionTransfer.fields.driverVideo'),
        value: configValues.driver_video ? t('shared.uploaded') : t('shared.missing'),
      },
      {
        key: 'target_image',
        label: t('actionTransfer.fields.targetImage'),
        value: configValues.target_image ? t('shared.uploaded') : t('shared.missing'),
      },
      {
        key: 'pose_workflow',
        label: t('actionTransfer.fields.poseWorkflow'),
        value: selectedPoseWorkflowInfo ? getWorkflowDisplayName(selectedPoseWorkflowInfo) : t('shared.notSelected'),
        detail: selectedPoseWorkflowInfo ? getWorkflowDescription(selectedPoseWorkflowInfo) : quickT('mediaHelp'),
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
    configValues.driver_video,
    configValues.runninghub_instance_type,
    configValues.target_image,
    quickT,
    selectedBgmInfo,
    selectedBgmMode,
    selectedPoseWorkflowInfo,
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

  const { clearDraft } = useDraft('action-transfer', pipelineTask.currentProject?.id, {
    enabled: shouldEnableDraft && pipelineTask.isHydrated && !searchParams.get('task_id'),
    onRestore: (draft) => {
      form.reset({
        ...form.getValues(),
        ...(draft as Partial<ActionTransferFormValues>),
      });
    },
    params: (configValues ?? form.getValues()) as ActionTransferFormValues,
  });

  const fieldHighlightClass = (keys: string[]) =>
    keys.some((key) => highlightedFields.includes(key)) ? 'animate-highlight rounded-xl' : '';

  const applyActionTransferParams = (params: Partial<ActionTransferFormValues>, changedKeys?: string[]) => {
    form.reset({
      ...form.getValues(),
      ...params,
    });
    setHighlightedFields(changedKeys ?? Object.keys(params));
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const submitted = await pipelineTask.submit(buildActionTransferPayload(values));
    if (!submitted) {
      return;
    }

    await clearDraft();
    toast.success(
      <SubmitSuccessToast taskName={values.pose_workflow.trim() || values.driver_video.trim().slice(0, 48) || t('actionTransfer.title')} />
    );
  });

  return (
    <>
        <CreatePipelineLayout
        title={t('actionTransfer.title')}
        description={t('actionTransfer.description')}
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
                  pipeline="action-transfer"
                  currentParams={(configValues ?? form.getValues()) as Record<string, unknown>}
                  savePayload={buildActionTransferPayload(form.getValues())}
                  mapPresetToParams={toActionTransferFormValues}
                  onApply={(params, changedKeys) =>
                    applyActionTransferParams(params as Partial<ActionTransferFormValues>, changedKeys)
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
                    <Activity className="size-8" />
                  </div>
                  {t('actionTransfer.sections.motionInputs')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <FormField
                  control={form.control}
                  name="driver_video"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="action-transfer.driver_video">
                      <FormItem className={fieldHighlightClass(['driver_video'])}>
                      <FormLabel>
                        <FieldLabel label={t('actionTransfer.fields.driverVideo')} required />
                      </FormLabel>
                      <MediaUploader
                        accept="video/*"
                        inputLabel={t('actionTransfer.fields.driverVideo')}
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
                  name="target_image"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="action-transfer.target_image">
                      <FormItem className={fieldHighlightClass(['target_image'])}>
                      <FormLabel>
                        <FieldLabel label={t('actionTransfer.fields.targetImage')} required />
                      </FormLabel>
                      <MediaUploader
                        accept="image/*"
                        inputLabel={t('actionTransfer.fields.targetImage')}
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
                  name="pose_workflow"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="action-transfer.pose_workflow">
                      <FormItem className={fieldHighlightClass(['pose_workflow'])}>
                      <FormLabel>
                        <FieldLabel label={t('actionTransfer.fields.poseWorkflow')} required />
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger aria-label={t('actionTransfer.fields.poseWorkflow')}>
                            <SelectValue placeholder={t('actionTransfer.placeholders.poseWorkflow')} />
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
                          {selectedPoseWorkflowInfo ? getWorkflowDescription(selectedPoseWorkflowInfo) : quickT('mediaHelp')}
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
                      <ParamHintPopover paramKey="action-transfer.bgm_mode">
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
                      <ParamHintPopover paramKey="action-transfer.bgm_path">
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
                      <ParamHintPopover paramKey="action-transfer.runninghub_instance_type">
                        <div className={fieldHighlightClass(['runninghub_instance_type'])}>
                          <RunningHubInstanceTypeField
                            value={field.value}
                            onChange={field.onChange}
                            disabled={pipelineTask.isSubmitting}
                            testId="action-transfer-runninghub-instance-type"
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
                pipeline="action-transfer"
                disabled={!pipelineTask.isHydrated || pipelineTask.isSubmitting}
                requiredFields={[
                  { key: 'driver_video', label: t('actionTransfer.fields.driverVideo'), value: form.getValues('driver_video') },
                  { key: 'target_image', label: t('actionTransfer.fields.targetImage'), value: form.getValues('target_image') },
                  { key: 'pose_workflow', label: t('actionTransfer.fields.poseWorkflow'), value: form.getValues('pose_workflow') },
                ]}
                onPass={() => form.handleSubmit(async (values) => {
                  const submitted = await pipelineTask.submit(buildActionTransferPayload(values));
                  if (!submitted) {
                    return;
                  }

                  await clearDraft();
                  toast.success(
                    <SubmitSuccessToast
                      taskName={
                        values.pose_workflow.trim() || values.driver_video.trim().slice(0, 48) || t('actionTransfer.title')
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
        pipeline="action-transfer"
        projectId={pipelineTask.currentProject?.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        mapTaskToParams={(task) => toActionTransferFormValues((task.request_params ?? {}) as Record<string, unknown>)}
        onApply={(params) => applyActionTransferParams(params as Partial<ActionTransferFormValues>)}
      />
    </>
  );
}

export default function ActionTransferPage() {
  const common = useAppTranslations('common');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{common('loading')}</div>}>
      <ActionTransferPageContent />
    </Suspense>
  );
}
