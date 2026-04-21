'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Image as ImageIcon } from 'lucide-react';

import { useMediaWorkflows } from '@/lib/hooks/use-resources';
import { useSubmitI2V } from '@/lib/hooks/use-create-video';
import { usePipelineTask } from '@/lib/hooks/use-pipeline-task';
import type { components } from '@/types/api';
import { CreatePipelineLayout } from '@/components/create/create-pipeline-layout';
import { FieldLabel } from '@/components/create/field-label';
import { PipelineStatusPanel } from '@/components/create/pipeline-status-panel';
import { ProjectRequiredDialog } from '@/components/create/project-required-dialog';
import { MediaUploader } from '@/components/shared/media-uploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type I2VRequest = Omit<components['schemas']['I2VAsyncRequest'], 'project_id'>;

const I2V_REQUEST_KEYS = [
  'media_workflow',
  'motion_prompt',
  'project_id',
  'source_image',
] as const satisfies readonly (keyof components['schemas']['I2VAsyncRequest'])[];

const formSchema = z.object({
  media_workflow: z.string().trim().min(1, 'Media workflow is required.'),
  motion_prompt: z.string().trim().min(2, 'Motion prompt is required.'),
  source_image: z.string().trim().min(1, 'Source image is required.'),
});

type I2VFormValues = z.infer<typeof formSchema>;

function buildI2VPayload(values: I2VFormValues): I2VRequest {
  return {
    media_workflow: values.media_workflow,
    motion_prompt: values.motion_prompt.trim(),
    source_image: values.source_image,
  };
}

function I2VPageContent() {
  const searchParams = useSearchParams();
  const submitI2V = useSubmitI2V();
  const pipelineTask = usePipelineTask(submitI2V, {
    initialTaskId: searchParams.get('task_id'),
  });
  const { data: mediaData } = useMediaWorkflows();

  const form = useForm<I2VFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      media_workflow: searchParams.get('media_workflow') ?? '',
      motion_prompt: searchParams.get('motion_prompt') ?? '',
      source_image: searchParams.get('source_image') ?? '',
    },
  });

  const configValues = useWatch({ control: form.control });

  const handleSubmit = form.handleSubmit(async (values) => {
    await pipelineTask.submit(buildI2VPayload(values));
  });

  return (
    <>
      <CreatePipelineLayout
        title="Image → Video"
        description="Upload a source image, define the motion, and render a short animated video clip."
        statusPanel={
          <PipelineStatusPanel
            config={{
              source_image: configValues.source_image ? 'Uploaded' : 'Missing',
              motion_prompt: configValues.motion_prompt || 'Waiting for motion prompt',
              media_workflow: configValues.media_workflow || 'Not selected',
            }}
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
        <Form {...form}>
          <form className="space-y-6 pb-8" onSubmit={handleSubmit}>
            <Card className="border-border shadow-none">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ImageIcon className="size-8" />
                  </div>
                  Motion Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <FormField
                  control={form.control}
                  name="source_image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <FieldLabel label="Source Image" required />
                      </FormLabel>
                      <MediaUploader
                        accept="image/*"
                        inputLabel="Source image"
                        value={field.value}
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="motion_prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <FieldLabel label="Motion Prompt" required />
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describe the motion, camera movement, or transformation to apply."
                          className="min-h-40"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="media_workflow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <FieldLabel label="Media Workflow" required />
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger aria-label="Media workflow">
                            <SelectValue placeholder="Select a media workflow" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(mediaData?.workflows ?? []).map((workflow) => (
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
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={!pipelineTask.isHydrated || pipelineTask.isSubmitting}>
                Generate Video
              </Button>
            </div>
          </form>
        </Form>
      </CreatePipelineLayout>

      <ProjectRequiredDialog
        open={pipelineTask.showProjectDialog}
        onOpenChange={pipelineTask.setShowProjectDialog}
      />
    </>
  );
}

export { I2V_REQUEST_KEYS };

export default function I2VPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading Image → Video...</div>}>
      <I2VPageContent />
    </Suspense>
  );
}
