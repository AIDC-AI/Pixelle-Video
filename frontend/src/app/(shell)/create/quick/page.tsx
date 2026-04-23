'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { History } from 'lucide-react';
import { toast } from 'sonner';

import { useSubmitQuick, useTaskPolling, useCancelTask, type QuickSubmitRequest } from '@/lib/hooks/use-create-video';
import { useDraft } from '@/lib/hooks/use-draft';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useBgmList, useMediaWorkflows, useStyleDetail, useTtsWorkflows } from '@/lib/hooks/use-resources';
import { useSettings } from '@/lib/hooks/use-settings';
import { useAppTranslations } from '@/lib/i18n';
import {
  getBgmDisplayName,
  getBgmOptionLabel,
  getWorkflowOptionLabel,
} from '@/lib/resource-display';
import { isRunningHubWorkflow, normalizeRunningHubInstanceType } from '@/lib/runninghub-instance-type';
import type { components } from '@/types/api';

import { ParamHintPopover } from '@/components/create/param-hint-popover';
import { ParamHistoryDrawer } from '@/components/create/param-history-drawer';
import { PreflightCheck } from '@/components/create/preflight-check';
import { PresetSelector } from '@/components/create/preset-selector';
import { RunningHubInstanceTypeField } from '@/components/create/runninghub-instance-type-field';
import { SubmitSuccessToast } from '@/components/create/submit-success-toast';
import { AiFeatureGates } from '@/components/create/ai-feature-gates';
import { ConfigSummary } from '@/components/create/config-summary';
import { TaskProgress } from '@/components/create/task-progress';
import { VideoResult } from '@/components/create/video-result';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Ban } from 'lucide-react';

type Task = components['schemas']['Task'];
type TaskStatus = components['schemas']['TaskStatus'];

type VideoTaskResult = {
  video_url: string;
  video_path?: string;
  duration?: number;
  file_size?: number;
};

type QuickCreateHiddenDefaults = Pick<
  QuickSubmitRequest,
  | 'bgm_volume'
  | 'frame_template'
  | 'max_image_prompt_words'
  | 'max_narration_words'
  | 'min_image_prompt_words'
  | 'min_narration_words'
  | 'n_scenes'
  | 'ref_audio'
  | 'style_id'
  | 'template_params'
  | 'video_fps'
  | 'voice_id'
> & {
  default_prompt_prefix: string | null;
};

type QuickCreateViewState = 'idle' | TaskStatus;

const QUICK_CREATE_DEFAULTS = {
  n_scenes: 5,
  ref_audio: null,
  voice_id: null,
  min_narration_words: 5,
  max_narration_words: 20,
  min_image_prompt_words: 30,
  max_image_prompt_words: 60,
  video_fps: 30,
  frame_template: '1080x1920/image_default.html',
  template_params: null,
  bgm_volume: 0.3,
} satisfies Pick<
  QuickSubmitRequest,
  | 'n_scenes'
  | 'ref_audio'
  | 'voice_id'
  | 'min_narration_words'
  | 'max_narration_words'
  | 'min_image_prompt_words'
  | 'max_image_prompt_words'
  | 'video_fps'
  | 'frame_template'
  | 'template_params'
  | 'bgm_volume'
>;

const QUICK_SUBMIT_REQUEST_KEYS = [
  'bgm_mode',
  'bgm_path',
  'bgm_volume',
  'max_image_prompt_words',
  'max_narration_words',
  'media_workflow',
  'min_image_prompt_words',
  'min_narration_words',
  'mode',
  'n_scenes',
  'project_id',
  'prompt_prefix',
  'ref_audio',
  'frame_template',
  'runninghub_instance_type',
  'style_id',
  'template_params',
  'text',
  'title',
  'tts_workflow',
  'video_fps',
  'voice_id',
] as const satisfies readonly (keyof components['schemas']['VideoGenerateRequest'])[];

const formSchema = z.object({
  title: z.string().min(2, '标题至少2个字符').max(100, '标题最多100个字符'),
  topic: z.string().min(10, '主题描述至少10个字符').max(2000, '主题描述最多2000个字符'),
  tts_workflow: z.string().min(1, '请选择配音'),
  media_workflow: z.string().min(1, '请选择画面方案'),
  bgm_path: z.string().optional(),
  narration: z.string().optional(),
  prompt_prefix: z.string().optional(),
  runninghub_instance_type: z.enum(['auto', 'plus']),
});

type QuickFormValues = z.infer<typeof formSchema>;

function toOptionalString(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return '请求失败，请稍后再试。';
}

function isVideoTaskResult(result: Task['result']): result is VideoTaskResult {
  if (!result || typeof result !== 'object') {
    return false;
  }

  const candidate = result as Record<string, unknown>;
  return typeof candidate.video_url === 'string';
}

function toOptionalNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function toQuickFormValuesFromPayload(payload: Record<string, unknown>): Partial<QuickFormValues> {
  const mode = payload.mode === 'fixed' ? 'fixed' : 'generate';

  return {
    title: typeof payload.title === 'string' ? payload.title : '',
    topic: typeof payload.text === 'string' && mode !== 'fixed' ? payload.text : '',
    tts_workflow: typeof payload.tts_workflow === 'string' ? payload.tts_workflow : '',
    media_workflow: typeof payload.media_workflow === 'string' ? payload.media_workflow : '',
    bgm_path: typeof payload.bgm_path === 'string' ? payload.bgm_path : '',
    narration: typeof payload.text === 'string' && mode === 'fixed' ? payload.text : '',
    prompt_prefix: typeof payload.prompt_prefix === 'string' ? payload.prompt_prefix : '',
    runninghub_instance_type: normalizeRunningHubInstanceType(
      typeof payload.runninghub_instance_type === 'string' ? payload.runninghub_instance_type : null
    ),
  };
}

function parseTemplateParams(value: string | null): QuickSubmitRequest['template_params'] {
  if (!value) {
    return QUICK_CREATE_DEFAULTS.template_params;
  }

  try {
    const parsedValue = JSON.parse(value);
    return parsedValue && typeof parsedValue === 'object'
      ? (parsedValue as Record<string, unknown>)
      : QUICK_CREATE_DEFAULTS.template_params;
  } catch {
    return QUICK_CREATE_DEFAULTS.template_params;
  }
}

function buildQuickSubmitPayload(
  values: QuickFormValues,
  hiddenDefaults: QuickCreateHiddenDefaults
): QuickSubmitRequest {
  const narration = toOptionalString(values.narration);
  const bgmPath = toOptionalString(values.bgm_path) ?? null;
  const promptPrefix = toOptionalString(values.prompt_prefix) ?? hiddenDefaults.default_prompt_prefix ?? null;
  const { default_prompt_prefix: _defaultPromptPrefix, ...requestDefaults } = hiddenDefaults;

  return {
    ...requestDefaults,
    title: values.title.trim(),
    text: narration ?? values.topic.trim(),
    mode: narration ? 'fixed' : 'generate',
    tts_workflow: values.tts_workflow,
    media_workflow: values.media_workflow,
    prompt_prefix: promptPrefix,
    bgm_path: bgmPath,
    bgm_mode: bgmPath ? 'custom' : hiddenDefaults.style_id ? 'default' : 'none',
    runninghub_instance_type: values.runninghub_instance_type,
  };
}

function QuickCreateContent() {
  const t = useAppTranslations('quick');
  const common = useAppTranslations('common');
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get('topic') ?? '';
  const initialTitle = searchParams.get('title') ?? '';
  const initialNarration = searchParams.get('narration') ?? '';
  const initialPromptPrefix = searchParams.get('prompt_prefix') ?? '';
  const initialTtsWorkflow = searchParams.get('tts_workflow') ?? '';
  const initialMediaWorkflow = searchParams.get('media_workflow') ?? '';
  const initialBgmPath = searchParams.get('bgm_path') ?? '';
  const initialRunningHubInstanceType = searchParams.get('runninghub_instance_type');
  const initialStyleId = searchParams.get('style_id');
  const initialTaskId = searchParams.get('task_id');
  const [taskId, setTaskId] = useState<string>();
  const [localState, setLocalState] = useState<'idle' | 'failed' | 'cancelled'>('idle');
  const [localMessage, setLocalMessage] = useState('');
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [isPollingEnabled, setIsPollingEnabled] = useState(false);
  const [consumedInitialTaskId, setConsumedInitialTaskId] = useState<string | null>(null);
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { currentProject, isHydrated } = useCurrentProjectHydration();
  const currentProjectId = currentProject?.id ?? null;

  const { data: ttsData } = useTtsWorkflows();
  const { data: mediaData } = useMediaWorkflows();
  const { data: bgmData } = useBgmList();
  const { data: styleDetail } = useStyleDetail(initialStyleId);
  const { data: settingsData } = useSettings();

  const styleDefaultBgm = useMemo(
    () => bgmData?.bgm_files.find((bgm) => bgm.linked_style_id === initialStyleId) ?? null,
    [bgmData?.bgm_files, initialStyleId]
  );

  const hiddenDefaults = useMemo<QuickCreateHiddenDefaults>(() => {
    const runtimeConfig = styleDetail?.runtime_config ?? null;
    const stylePromptPrefix =
      runtimeConfig &&
      typeof runtimeConfig === 'object' &&
      'prompt_prefix' in runtimeConfig &&
      typeof runtimeConfig.prompt_prefix === 'string'
        ? runtimeConfig.prompt_prefix
        : null;
    const styleFrameTemplate =
      runtimeConfig &&
      typeof runtimeConfig === 'object' &&
      'template' in runtimeConfig &&
      typeof runtimeConfig.template === 'string'
        ? runtimeConfig.template
        : null;

    return {
      n_scenes: toOptionalNumber(searchParams.get('n_scenes'), QUICK_CREATE_DEFAULTS.n_scenes),
      ref_audio: searchParams.get('ref_audio') ?? QUICK_CREATE_DEFAULTS.ref_audio,
      voice_id: searchParams.get('voice_id') ?? QUICK_CREATE_DEFAULTS.voice_id,
      min_narration_words: toOptionalNumber(
        searchParams.get('min_narration_words'),
        QUICK_CREATE_DEFAULTS.min_narration_words
      ),
      max_narration_words: toOptionalNumber(
        searchParams.get('max_narration_words'),
        QUICK_CREATE_DEFAULTS.max_narration_words
      ),
      min_image_prompt_words: toOptionalNumber(
        searchParams.get('min_image_prompt_words'),
        QUICK_CREATE_DEFAULTS.min_image_prompt_words
      ),
      max_image_prompt_words: toOptionalNumber(
        searchParams.get('max_image_prompt_words'),
        QUICK_CREATE_DEFAULTS.max_image_prompt_words
      ),
      video_fps: toOptionalNumber(searchParams.get('video_fps'), QUICK_CREATE_DEFAULTS.video_fps),
      frame_template: searchParams.get('frame_template') ?? styleFrameTemplate ?? QUICK_CREATE_DEFAULTS.frame_template,
      template_params: parseTemplateParams(searchParams.get('template_params')),
      bgm_volume: toOptionalNumber(searchParams.get('bgm_volume'), QUICK_CREATE_DEFAULTS.bgm_volume),
      style_id: initialStyleId,
      default_prompt_prefix: toOptionalString(initialPromptPrefix) ?? stylePromptPrefix ?? null,
    };
  }, [initialPromptPrefix, initialStyleId, searchParams, styleDetail?.runtime_config]);

  const submitQuick = useSubmitQuick();
  const cancelTask = useCancelTask();

  const form = useForm<QuickFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialTitle,
      topic: initialTopic,
      tts_workflow: initialTtsWorkflow,
      media_workflow: initialMediaWorkflow,
      bgm_path: initialBgmPath,
      narration: initialNarration,
      prompt_prefix: initialPromptPrefix,
      runninghub_instance_type: normalizeRunningHubInstanceType(initialRunningHubInstanceType),
    },
  });

  const configValues = useWatch({ control: form.control });
  const selectedTtsWorkflow = useWatch({ control: form.control, name: 'tts_workflow' });
  const selectedMediaWorkflow = useWatch({ control: form.control, name: 'media_workflow' });
  const shouldEnableDraft = searchParams.toString().length === 0;
  const polling = useTaskPolling(taskId, isPollingEnabled);
  const taskData = polling.data;
  const taskResult = isVideoTaskResult(taskData?.result) ? taskData.result : undefined;
  const remoteState = taskData?.status;
  const shouldShowRunningHubInstanceType =
    isRunningHubWorkflow(ttsData?.workflows, selectedTtsWorkflow) ||
    isRunningHubWorkflow(mediaData?.workflows, selectedMediaWorkflow);
  const viewState: QuickCreateViewState = (() => {
    if (localState !== 'idle') {
      return localState;
    }

    if (remoteState) {
      return remoteState;
    }

    if (taskId) {
      return 'pending';
    }

    return 'idle';
  })();
  const statusMessage =
    localState === 'failed'
      ? localMessage
      : localState === 'cancelled'
        ? localMessage
        : remoteState === 'failed'
          ? taskData?.error ?? t('failedTitle')
          : remoteState === 'cancelled'
            ? t('cancelledTitle')
            : taskData?.progress?.message ?? '';

  useEffect(() => {
    if (!initialTaskId) {
      return;
    }

    if (consumedInitialTaskId === initialTaskId || taskId === initialTaskId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setTaskId(initialTaskId);
      setLocalState('idle');
      setLocalMessage('');
      setIsPollingEnabled(true);
      setConsumedInitialTaskId(initialTaskId);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [consumedInitialTaskId, initialTaskId, taskId]);

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

  const { clearDraft } = useDraft('quick', currentProjectId, {
    enabled: shouldEnableDraft && isHydrated && !initialTaskId,
    onRestore: (draft) => {
      form.reset({
        ...form.getValues(),
        ...(draft as Partial<QuickFormValues>),
      });
    },
    params: (configValues ?? form.getValues()) as QuickFormValues,
  });

  const applyQuickParams = (params: Partial<QuickFormValues>, changedKeys: string[] = []) => {
    form.reset({
      ...form.getValues(),
      ...params,
    });
    setHighlightedFields(changedKeys);
  };

  const fieldHighlightClass = (keys: string[]) =>
    keys.some((key) => highlightedFields.includes(key)) ? 'animate-highlight rounded-xl' : '';

  const onSubmit = async (values: QuickFormValues) => {
    if (!currentProjectId) {
      setShowProjectDialog(true);
      return;
    }

    setLocalState('idle');
    setLocalMessage('');
    setTaskId(undefined);
    setIsPollingEnabled(true);

    try {
      const response = await submitQuick.mutateAsync(buildQuickSubmitPayload(values, hiddenDefaults));
      setTaskId(response.task_id);
      await clearDraft();
      toast.success(
        <SubmitSuccessToast taskName={values.title.trim() || values.topic.trim().slice(0, 48) || 'Quick task'} />
      );
    } catch (error: unknown) {
      setLocalState('failed');
      setLocalMessage(getErrorMessage(error));
      setIsPollingEnabled(false);
    }
  };

  const handleCancel = async () => {
    if (!taskId) {
      return;
    }

    setLocalState('cancelled');
    setLocalMessage(t('cancelledTitle'));
    setIsPollingEnabled(false);

    try {
      await cancelTask.mutateAsync(taskId);
    } catch (error: unknown) {
      setLocalState('failed');
      setLocalMessage(getErrorMessage(error));
    }
  };

  const handleRegenerate = () => {
    setTaskId(undefined);
    setLocalState('idle');
    setLocalMessage('');
    setIsPollingEnabled(false);
  };

  if (!isHydrated) {
    return <div className="animate-pulse p-8 text-center text-muted-foreground">{common('loading')}</div>;
  }

  const progressPercentage = taskData?.progress?.percentage ?? (viewState === 'completed' ? 100 : 0);
  const progressMessage = taskData?.progress?.message ?? undefined;
  const activeTaskStatus: Extract<TaskStatus, 'pending' | 'running' | 'completed' | 'failed'> =
    taskData?.status && taskData.status !== 'cancelled'
      ? taskData.status
      : viewState === 'running' || viewState === 'completed' || viewState === 'failed'
        ? viewState
        : 'pending';

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 p-4 text-foreground md:flex-row md:flex-nowrap md:p-0">
      <div className="min-w-0 md:basis-[70%] md:pr-4">
        <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t('description')}</p>
        <AiFeatureGates className="mb-4" />

        <ScrollArea className="h-[calc(100vh-160px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <PresetSelector
                    pipeline="quick"
                    currentParams={(configValues ?? form.getValues()) as Record<string, unknown>}
                    savePayload={buildQuickSubmitPayload(form.getValues(), hiddenDefaults)}
                    mapPresetToParams={toQuickFormValuesFromPayload}
                    onApply={(params, changedKeys) => applyQuickParams(params as Partial<QuickFormValues>, changedKeys)}
                    disabled={viewState === 'running'}
                  />
                </div>
                <Button variant="outline" type="button" onClick={() => setHistoryOpen(true)}>
                  <History className="size-4" />
                  历史记录
                </Button>
              </div>

              <div className="space-y-4">
                <h3 className="border-b pb-2 text-lg font-medium">{t('basicConfig')}</h3>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="quick.title">
                      <FormItem className={fieldHighlightClass(['title'])}>
                      <FormLabel>{t('titleLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('titlePlaceholder')} disabled={viewState === 'running'} {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                    </ParamHintPopover>
                  )}
                />

                <FormField
                  control={form.control}
                  name="topic"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="quick.topic">
                      <FormItem className={fieldHighlightClass(['topic'])}>
                      <FormLabel>{t('topicLabel')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('topicPlaceholder')}
                          className="min-h-[100px]"
                          disabled={viewState === 'running'}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                    </ParamHintPopover>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="tts_workflow"
                    render={({ field }) => (
                      <ParamHintPopover paramKey="quick.tts_workflow">
                        <FormItem className={fieldHighlightClass(['tts_workflow'])}>
                        <FormLabel>{t('ttsLabel')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={viewState === 'running'}>
                          <FormControl>
                            <SelectTrigger aria-label={t('ttsLabel')}>
                              <SelectValue placeholder={t('ttsPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ttsData?.workflows.map((workflow) => (
                              <SelectItem key={workflow.key} value={workflow.key}>
                                {getWorkflowOptionLabel(workflow)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                      </ParamHintPopover>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="media_workflow"
                    render={({ field }) => (
                      <ParamHintPopover paramKey="quick.media_workflow">
                        <FormItem className={fieldHighlightClass(['media_workflow'])}>
                        <FormLabel>{t('mediaLabel')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={viewState === 'running'}>
                          <FormControl>
                            <SelectTrigger aria-label={t('mediaLabel')}>
                              <SelectValue placeholder={t('mediaPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mediaData?.workflows.map((workflow) => (
                              <SelectItem key={workflow.key} value={workflow.key}>
                                {getWorkflowOptionLabel(workflow)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                      </ParamHintPopover>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bgm_path"
                  render={({ field }) => (
                    <ParamHintPopover paramKey="quick.bgm_path">
                      <FormItem className={fieldHighlightClass(['bgm_path'])}>
                      <FormLabel>{t('bgmLabel')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={viewState === 'running'}>
                        <FormControl>
                          <SelectTrigger aria-label={t('bgmLabel')}>
                            <SelectValue placeholder={t('bgmPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bgmData?.bgm_files.map((bgm) => (
                            <SelectItem key={bgm.path} value={bgm.path}>
                              {getBgmOptionLabel(bgm)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {styleDefaultBgm && !field.value ? (
                        <p className="text-xs text-muted-foreground">
                          {t('bgmDefaultHint', { name: getBgmDisplayName(styleDefaultBgm) })}
                        </p>
                      ) : null}
                      <FormMessage />
                      </FormItem>
                    </ParamHintPopover>
                  )}
                />

                {shouldShowRunningHubInstanceType ? (
                  <RunningHubInstanceTypeField
                    disabled={viewState === 'running'}
                    testId="quick-runninghub-instance-type"
                    value={configValues.runninghub_instance_type ?? 'auto'}
                    onChange={(value) => {
                      form.setValue('runninghub_instance_type', value, { shouldDirty: true });
                    }}
                  />
                ) : null}
              </div>

              <Accordion className="w-full">
                <AccordionItem value="advanced">
                  <AccordionTrigger className="text-lg font-medium text-foreground hover:no-underline">
                    {t('advancedConfig')}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <FormField
                      control={form.control}
                      name="narration"
                      render={({ field }) => (
                        <ParamHintPopover paramKey="quick.narration">
                          <FormItem className={fieldHighlightClass(['narration'])}>
                          <FormLabel>{t('narrationLabel')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('narrationPlaceholder')}
                              disabled={viewState === 'running'}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                        </ParamHintPopover>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="prompt_prefix"
                      render={({ field }) => (
                        <ParamHintPopover paramKey="quick.prompt_prefix">
                          <FormItem className={fieldHighlightClass(['prompt_prefix'])}>
                          <FormLabel>{t('promptPrefixLabel')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('promptPrefixPlaceholder')}
                              disabled={viewState === 'running'}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                        </ParamHintPopover>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="pt-4">
                <PreflightCheck
                  pipeline="quick"
                  className="h-12 w-full text-base font-semibold"
                  disabled={viewState === 'running'}
                  requiredFields={[
                    { key: 'title', label: t('titleLabel'), value: form.getValues('title') },
                    { key: 'topic', label: t('topicLabel'), value: form.getValues('topic') },
                    { key: 'tts_workflow', label: t('ttsLabel'), value: form.getValues('tts_workflow') },
                    { key: 'media_workflow', label: t('mediaLabel'), value: form.getValues('media_workflow') },
                  ]}
                  onPass={() => form.handleSubmit(onSubmit)()}
                >
                  {viewState === 'running' || viewState === 'pending' ? t('generating') : t('generate')}
                </PreflightCheck>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </div>

      <div className="w-full md:basis-[30%]">
        <div className="flex flex-col gap-4">
          {viewState === 'idle' ? <ConfigSummary config={configValues} /> : null}

          {(viewState === 'pending' || viewState === 'running' || (viewState === 'completed' && !taskResult)) && taskId ? (
            <TaskProgress
              taskId={taskId}
              status={activeTaskStatus}
              progress={progressPercentage}
              currentStep={progressMessage}
              onCancel={handleCancel}
            />
          ) : null}

          {viewState === 'completed' && taskResult ? (
            <VideoResult
              videoUrl={taskResult.video_url}
              duration={taskResult.duration}
              fileSize={taskResult.file_size}
              onRegenerate={handleRegenerate}
            />
          ) : null}

          {viewState === 'failed' ? (
            <Card className="border-destructive bg-destructive/10 shadow-none">
              <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6 text-center">
                <div className="text-lg font-medium text-destructive">{t('failedTitle')}</div>
                <p className="text-sm text-destructive/80">{statusMessage}</p>
                <Button
                  variant="outline"
                  className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={handleRegenerate}
                >
                  {t('reconfigure')}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {viewState === 'cancelled' ? (
            <Card className="border-border bg-card shadow-none">
              <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Ban className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-lg font-medium text-foreground">{t('cancelledTitle')}</div>
                <p className="text-sm text-muted-foreground">{statusMessage || t('cancelledMessage')}</p>
                <Button variant="outline" className="w-full" onClick={handleRegenerate}>
                  {t('restart')}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">{t('projectRequiredTitle')}</DialogTitle>
            <DialogDescription className="text-center">{t('projectRequiredDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onClick={() => setShowProjectDialog(false)}>
              {t('projectRequiredConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParamHistoryDrawer
        pipeline="quick"
        projectId={currentProjectId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        mapTaskToParams={(task) => toQuickFormValuesFromPayload((task.request_params ?? {}) as Record<string, unknown>)}
        onApply={(params) => applyQuickParams(params as Partial<QuickFormValues>)}
      />
    </div>
  );
}

export default function QuickCreatePage() {
  const common = useAppTranslations('common');

  return (
    <Suspense fallback={<div className="animate-pulse p-8 text-center text-muted-foreground">{common('loading')}</div>}>
      <QuickCreateContent />
    </Suspense>
  );
}
