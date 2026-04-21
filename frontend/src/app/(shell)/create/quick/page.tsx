'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

import { useSubmitQuick, useTaskPolling, useCancelTask } from '@/lib/hooks/use-create-video';
import { useTtsWorkflows, useMediaWorkflows, useImageWorkflows, useBgmList } from '@/lib/hooks/use-resources';
import { useCurrentProjectStore } from '@/stores/current-project';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';

import { ConfigSummary } from '@/components/create/config-summary';
import { TaskProgress } from '@/components/create/task-progress';
import { VideoResult } from '@/components/create/video-result';

const formSchema = z.object({
  title: z.string().min(2, '标题至少2个字符').max(100, '标题最多100个字符'),
  topic: z.string().min(10, '主题描述至少10个字符').max(2000, '主题描述最多2000个字符'),
  language: z.string().min(1, '请选择语言'),
  duration: z.coerce.number().min(5, '最短5秒').max(300, '最长300秒'),
  tts_voice: z.string().min(1, '请选择配音'),
  media_workflow: z.string().min(1, '请选择媒体工作流'),
  image_workflow: z.string().optional(),
  bgm: z.string().optional(),
  narration: z.string().optional(),
  image_prompt: z.string().optional(),
  style_preset: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function QuickCreateContent() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get('topic') || '';
  
  const [appState, setAppState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const [taskId, setTaskId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string>('');

  const currentProject = useCurrentProjectStore((state) => state.currentProject);
  const isHydrated = useCurrentProjectStore.persist.hasHydrated();

  const { data: ttsData } = useTtsWorkflows();
  const { data: mediaData } = useMediaWorkflows();
  const { data: imageData } = useImageWorkflows();
  const { data: bgmData } = useBgmList();

  const submitQuick = useSubmitQuick();
  const cancelTask = useCancelTask();

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: '',
      topic: initialTopic,
      language: 'zh-CN',
      duration: 30,
      tts_voice: '',
      media_workflow: '',
      image_workflow: '',
      bgm: '',
      narration: '',
      image_prompt: '',
      style_preset: '',
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configValues = useWatch({ control: form.control as any });

  const polling = useTaskPolling(taskId);
  const taskData = polling.data;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (taskData) {
      if (taskData.status === 'completed') {
        setAppState('done');
      } else if (taskData.status === 'failed') {
        setAppState('failed');
        setErrorMessage(taskData.error_message || '生成失败');
      } else {
        setAppState('running');
      }
    }
  }, [taskData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onSubmit = async (values: FormValues) => {
    if (!currentProject) {
      toast.error('请先在顶部选择或创建一个项目');
      return;
    }

    setAppState('running');
    setErrorMessage('');

    try {
      const payload = {
        title: values.title,
        text: values.narration ? values.narration : values.topic,
        mode: values.narration ? 'fixed' : 'generate',
        tts_workflow: values.tts_voice,
        media_workflow: values.media_workflow,
        prompt_prefix: values.image_prompt,
        bgm_path: values.bgm,
        language: values.language,
        duration: values.duration,
        image_workflow: values.image_workflow,
        style_preset: values.style_preset,
      };

      const res = await submitQuick.mutateAsync(payload);
      setTaskId(res.id);
    } catch (err: unknown) {
      setAppState('failed');
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  };

  const handleCancel = async () => {
    if (taskId) {
      await cancelTask.mutateAsync(taskId);
      setAppState('failed');
      setErrorMessage('任务已取消');
    }
  };

  const handleRegenerate = () => {
    setTaskId(undefined);
    setAppState('idle');
  };

  if (!isHydrated) return null;

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 max-w-7xl mx-auto p-4 md:p-0 text-foreground">
      <div className="flex-1 min-w-0 md:w-7/10 md:pr-4">
        <h1 className="text-2xl font-bold mb-2">Quick Pipeline</h1>
        <p className="text-muted-foreground text-sm mb-6">最快速的视频生成方式，AI自动为您完成文案、配音与画面。</p>
        
        <ScrollArea className="h-[calc(100vh-160px)] pr-4">
          <Form {...form}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <form onSubmit={form.handleSubmit(onSubmit) as any} className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-lg border-b pb-2">基础配置</h3>
                <FormField
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  control={form.control as any}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>视频标题</FormLabel>
                      <FormControl>
                        <Input placeholder="输入一个吸引人的标题..." disabled={appState === 'running'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  control={form.control as any}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>创意描述 (Topic)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="描述您想生成的视频主题或创意细节..." 
                          className="min-h-[100px]" 
                          disabled={appState === 'running'}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    control={form.control as any}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>语言</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={appState === 'running'}>
                          <FormControl>
                            <SelectTrigger aria-label="语言">
                              <SelectValue placeholder="选择语言" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="zh-CN">中文 (zh-CN)</SelectItem>
                            <SelectItem value="en-US">英文 (en-US)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    control={form.control as any}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>目标时长 (秒)</FormLabel>
                        <FormControl>
                          <Input type="number" disabled={appState === 'running'} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    control={form.control as any}
                    name="tts_voice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>配音 (TTS)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={appState === 'running'}>
                          <FormControl>
                            <SelectTrigger aria-label="配音 (TTS)">
                              <SelectValue placeholder="选择配音" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(ttsData as { items?: { id: string; name: string }[] })?.items?.map((item) => (
                              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    control={form.control as any}
                    name="media_workflow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>媒体流 (Media)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={appState === 'running'}>
                          <FormControl>
                            <SelectTrigger aria-label="媒体流 (Media)">
                              <SelectValue placeholder="选择媒体工作流" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(mediaData as { items?: { id: string; name: string }[] })?.items?.map((item) => (
                              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    control={form.control as any}
                    name="image_workflow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>图片流 (Image)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={appState === 'running'}>
                          <FormControl>
                            <SelectTrigger aria-label="图片流 (Image)">
                              <SelectValue placeholder="选择图片工作流 (可选)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(imageData as { items?: { id: string; name: string }[] })?.items?.map((item) => (
                              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    control={form.control as any}
                    name="bgm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>背景音乐 (BGM)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={appState === 'running'}>
                          <FormControl>
                            <SelectTrigger aria-label="背景音乐 (BGM)">
                              <SelectValue placeholder="选择 BGM (可选)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(bgmData as { items?: { id: string; name: string }[] })?.items?.map((item) => (
                              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Accordion className="w-full">
                <AccordionItem value="advanced">
                  <AccordionTrigger className="text-lg font-medium text-foreground hover:no-underline">高级配置</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <FormField
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      control={form.control as any}
                      name="narration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>自定义旁白</FormLabel>
                          <FormControl>
                            <Textarea placeholder="留空则由 AI 自动生成文案..." disabled={appState === 'running'} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      control={form.control as any}
                      name="image_prompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>图像提示词词缀</FormLabel>
                          <FormControl>
                            <Textarea placeholder="附加给所有画面生成的 Prompt..." disabled={appState === 'running'} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      control={form.control as any}
                      name="style_preset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>风格预设</FormLabel>
                          <FormControl>
                            <Input placeholder="输入风格描述..." disabled={appState === 'running'} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base" 
                  disabled={appState === 'running'}
                >
                  {appState === 'running' ? '生成中...' : '生成视频'}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </div>

      <div className="w-full md:w-3/10 flex flex-col gap-4">
        {appState === 'idle' && <ConfigSummary config={configValues} />}
        
        {(appState === 'running' || (appState === 'done' && !taskData?.result)) && taskId && (
          <TaskProgress 
            taskId={taskId} 
            status={taskData?.status || 'pending'} 
            progress={taskData?.progress || 0} 
            currentStep={taskData?.current_step}
            onCancel={handleCancel}
          />
        )}

        {appState === 'done' && taskData?.result && (
          <VideoResult 
            videoUrl={taskData.result.video_url} 
            duration={taskData.result.duration}
            fileSize={taskData.result.file_size}
            onRegenerate={handleRegenerate}
          />
        )}

        {appState === 'failed' && (
          <Card className="bg-destructive/10 border-destructive shadow-none">
            <CardContent className="pt-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="text-destructive font-medium text-lg">生成失败</div>
              <p className="text-sm text-destructive/80">{errorMessage}</p>
              <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={handleRegenerate}>
                重新配置
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
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
