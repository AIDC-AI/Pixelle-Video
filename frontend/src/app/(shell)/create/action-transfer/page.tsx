'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Activity } from 'lucide-react';

import { useMediaWorkflows } from '@/lib/hooks/use-resources';
import { useSubmitActionTransfer } from '@/lib/hooks/use-create-video';
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

type ActionTransferRequest = Omit<components['schemas']['ActionTransferAsyncRequest'], 'project_id'>;

const ACTION_TRANSFER_REQUEST_KEYS = [
  'driver_video',
  'pose_workflow',
  'project_id',
  'target_image',
] as const satisfies readonly (keyof components['schemas']['ActionTransferAsyncRequest'])[];

const formSchema = z.object({
  driver_video: z.string().trim().min(1, 'Driver video is required.'),
  pose_workflow: z.string().trim().min(1, 'Pose workflow is required.'),
  target_image: z.string().trim().min(1, 'Target image is required.'),
});

type ActionTransferFormValues = z.infer<typeof formSchema>;

function buildActionTransferPayload(values: ActionTransferFormValues): ActionTransferRequest {
  return {
    driver_video: values.driver_video,
    pose_workflow: values.pose_workflow,
    target_image: values.target_image,
  };
}

function ActionTransferPageContent() {
  const searchParams = useSearchParams();
  const submitActionTransfer = useSubmitActionTransfer();
  const pipelineTask = usePipelineTask(submitActionTransfer, {
    initialTaskId: searchParams.get('task_id'),
  });
  const { data: mediaData } = useMediaWorkflows();

  const form = useForm<ActionTransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      driver_video: searchParams.get('driver_video') ?? '',
      pose_workflow: searchParams.get('pose_workflow') ?? '',
      target_image: searchParams.get('target_image') ?? '',
    },
  });

  const configValues = useWatch({ control: form.control });

  const handleSubmit = form.handleSubmit(async (values) => {
    await pipelineTask.submit(buildActionTransferPayload(values));
  });

  return (
    <>
      <CreatePipelineLayout
        title="Action Transfer"
        description="Pair a driver video with a target image and transfer the motion into a new generated clip."
        statusPanel={
          <PipelineStatusPanel
            config={{
              driver_video: configValues.driver_video ? 'Uploaded' : 'Missing',
              target_image: configValues.target_image ? 'Uploaded' : 'Missing',
              pose_workflow: configValues.pose_workflow || 'Not selected',
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
                    <Activity className="size-8" />
                  </div>
                  Motion Inputs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <FormField
                  control={form.control}
                  name="driver_video"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <FieldLabel label="Driver Video" required />
                      </FormLabel>
                      <MediaUploader
                        accept="video/*"
                        inputLabel="Driver video"
                        value={field.value}
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target_image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <FieldLabel label="Target Image" required />
                      </FormLabel>
                      <MediaUploader
                        accept="image/*"
                        inputLabel="Target image"
                        value={field.value}
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pose_workflow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <FieldLabel label="Pose Workflow" required />
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger aria-label="Pose workflow">
                            <SelectValue placeholder="Select a pose workflow" />
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

export { ACTION_TRANSFER_REQUEST_KEYS };

export default function ActionTransferPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading Action Transfer...</div>}>
      <ActionTransferPageContent />
    </Suspense>
  );
}
