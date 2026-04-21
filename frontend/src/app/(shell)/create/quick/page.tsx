'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useSubmitQuick, useTaskPolling, useCancelTask, type QuickSubmitRequest } from '@/lib/hooks/use-create-video';
import { useTtsWorkflows, useMediaWorkflows, useBgmList } from '@/lib/hooks/use-resources';
import { useCurrentProjectStore } from '@/stores/current-project';
import type { components } from '@/types/api';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertCircle, Ban } from 'lucide-react';

import { ConfigSummary } from '@/components/create/config-summary';
import { TaskProgress } from '@/components/create/task-progress';
import { VideoResult } from '@/components/create/video-result';
type Task = components['schemas']['Task'];
type TaskStatus = components['schemas']['TaskStatus'];

type VideoTaskResult = {
  video_url: string;
  video_path?: string;
  duration?: number;
  file_size?: number;
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
  frame_template: null,
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

export const QUICK_SUBMIT_REQUEST_KEYS = [
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
  media_workflow: z.string().min(1, '请选择媒体工作流'),
  bgm_path: z.string().optional(),
  narration: z.string().optional(),
  prompt_prefix: z.string().optional(),
});

type QuickFormValues = z.infer<typeof formSchema>;

function toOptionalString(value: string | undefined): string | undefined {
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

function buildQuickSubmitPayload(values: QuickFormValues): QuickSubmitRequest {
  const narration = toOptionalString(values.narration);

  return {
    ...QUICK_CREATE_DEFAULTS,
    title: values.title.trim(),
    text: narration ?? values.topic.trim(),
    mode: narration ? 'fixed' : 'generate',
    tts_workflow: values.tts_workflow,
    media_workflow: values.media_workflow,
    prompt_prefix: toOptionalString(values.prompt_prefix) ?? null,
    bgm_path: toOptionalString(values.bgm_path) ?? null,
  };
}

function QuickCreateContent() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get('topic') ?? '';
  const initialTitle = searchParams.get('title') ?? '';
  const initialNarration = searchParams.get('narration') ?? '';
  const initialPromptPrefix = searchParams.get('prompt_prefix') ?? '';
  const initialTtsWorkflow = searchParams.get('tts_workflow') ?? '';
  const initialMediaWorkflow = searchParams.get('media_workflow') ?? '';
  const initialBgmPath = searchParams.get('bgm_path') ?? '';
  const initialTaskId = searchParams.get('task_id');

  const [taskId, setTaskId] = useState<string>();
  const [localState, setLocalState] = useState<'idle' | 'failed' | 'cancelled'>('idle');
  const [localMessage, setLocalMessage] = useState('');
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [isHydrated, setIsHydrated] = useState(useCurrentProjectStore.persist.hasHydrated());
  const [isPollingEnabled, setIsPollingEnabled] = useState(false);
  const [consumedInitialTaskId, setConsumedInitialTaskId] = useState<string | null>(null);

  const currentProject = useCurrentProjectStore((state) => state.currentProject);

  const { data: ttsData } = useTtsWorkflows();
  const { data: mediaData } = useMediaWorkflows();
  const { data: bgmData } = useBgmList();

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
    },
  });

  const configValues = useWatch({ control: form.control });
  const polling = useTaskPolling(taskId, isPollingEnabled);
  const taskData = polling.data;
  const taskResult = isVideoTaskResult(taskData?.result) ? taskData.result : undefined;
  const remoteState = taskData?.status;
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
          ? taskData?.error ?? '生成失败'
          : remoteState === 'cancelled'
            ? '任务已取消'
            : taskData?.progress?.message ?? '';

  useEffect(() => {
    const persistApi = useCurrentProjectStore.persist;
    const unsubscribe = persistApi.onFinishHydration(() => {
      setIsHydrated(true);
    });

    if (!persistApi.hasHydrated()) {
      void persistApi.rehydrate();
    }

    return () => unsubscribe();
  }, []);

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

  const onSubmit = async (values: QuickFormValues) => {
    if (!currentProject) {
      setShowProjectDialog(true);
      return;
    }

    setLocalState('idle');
    setLocalMessage('');
    setTaskId(undefined);
    setIsPollingEnabled(true);

    try {
      const response = await submitQuick.mutateAsync(buildQuickSubmitPayload(values));
      setTaskId(response.task_id);
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
    setLocalMessage('任务已取消');
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
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading quick create...</div>;
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
        <h1 className="mb-2 text-2xl font-bold">Quick</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          最快的视频生成方式，AI 自动完成文案、配音与画面。
        </p>

        <ScrollArea className="h-[calc(100vh-160px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <h3 className="border-b pb-2 text-lg font-medium">基础配置</h3>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>视频标题</FormLabel>
                      <FormControl>
                        <Input placeholder="输入一个吸引人的标题..." disabled={viewState === 'running'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>创意描述 (Topic)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="描述您想生成的视频主题或创意细节..."
                          className="min-h-[100px]"
                          disabled={viewState === 'running'}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="tts_workflow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>配音 (TTS)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={viewState === 'running'}>
                          <FormControl>
                            <SelectTrigger aria-label="配音 (TTS)">
                              <SelectValue placeholder="选择配音" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ttsData?.workflows.map((workflow) => (
                              <SelectItem key={workflow.key} value={workflow.key}>
                                {workflow.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="media_workflow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>媒体流 (Media)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={viewState === 'running'}>
                          <FormControl>
                            <SelectTrigger aria-label="媒体流 (Media)">
                              <SelectValue placeholder="选择媒体工作流" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mediaData?.workflows.map((workflow) => (
                              <SelectItem key={workflow.key} value={workflow.key}>
                                {workflow.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bgm_path"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>背景音乐 (BGM)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={viewState === 'running'}>
                        <FormControl>
                          <SelectTrigger aria-label="背景音乐 (BGM)">
                            <SelectValue placeholder="选择 BGM (可选)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bgmData?.bgm_files.map((bgm) => (
                            <SelectItem key={bgm.path} value={bgm.path}>
                              {bgm.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Accordion className="w-full">
                <AccordionItem value="advanced">
                  <AccordionTrigger className="text-lg font-medium text-foreground hover:no-underline">
                    高级配置
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <FormField
                      control={form.control}
                      name="narration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>自定义旁白</FormLabel>
                          <FormControl>
                            <Textarea placeholder="留空则由 AI 自动生成文案..." disabled={viewState === 'running'} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="prompt_prefix"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>图像提示词词缀</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="附加给所有画面生成的 Prompt..."
                              disabled={viewState === 'running'}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="pt-4">
                <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={viewState === 'running'}>
                  {viewState === 'running' || viewState === 'pending' ? '生成中...' : '生成视频'}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </div>

      <div className="w-full md:basis-[30%]">
        <div className="flex flex-col gap-4">
          {viewState === 'idle' && <ConfigSummary config={configValues} />}

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
                <div className="text-lg font-medium text-destructive">生成失败</div>
                <p className="text-sm text-destructive/80">{statusMessage}</p>
                <Button
                  variant="outline"
                  className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={handleRegenerate}
                >
                  重新配置
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
                <div className="text-lg font-medium text-foreground">任务已取消</div>
                <p className="text-sm text-muted-foreground">{statusMessage || '生成任务已停止。'}</p>
                <Button variant="outline" className="w-full" onClick={handleRegenerate}>
                  重新开始
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
            <DialogTitle className="text-center">未选择项目</DialogTitle>
            <DialogDescription className="text-center">
              视频生成需要归属于一个项目。请在页面顶部的项目切换器中选择或创建一个项目后再重试。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onClick={() => setShowProjectDialog(false)}>
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function QuickCreatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground animate-pulse">加载中...</div>}>
      <QuickCreateContent />
    </Suspense>
  );
}
