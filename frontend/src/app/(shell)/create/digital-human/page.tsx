'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mic2 } from 'lucide-react';

import { useTtsWorkflows } from '@/lib/hooks/use-resources';
import { useSubmitDigitalHuman } from '@/lib/hooks/use-create-video';
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

type DigitalHumanRequest = Omit<components['schemas']['DigitalHumanAsyncRequest'], 'project_id'>;

const DIGITAL_HUMAN_REQUEST_KEYS = [
  'narration',
  'portrait_url',
  'project_id',
  'voice_workflow',
] as const satisfies readonly (keyof components['schemas']['DigitalHumanAsyncRequest'])[];

const formSchema = z.object({
  narration: z.string().trim().min(2, 'Narration is required.'),
  portrait_url: z.string().trim().min(1, 'Portrait image is required.'),
  voice_workflow: z.string(),
});

type DigitalHumanFormValues = z.infer<typeof formSchema>;

function buildDigitalHumanPayload(values: DigitalHumanFormValues): DigitalHumanRequest {
  return {
    narration: values.narration.trim(),
    portrait_url: values.portrait_url,
    voice_workflow: values.voice_workflow === '__none__' ? null : values.voice_workflow,
  };
}

function DigitalHumanPageContent() {
  const searchParams = useSearchParams();
  const submitDigitalHuman = useSubmitDigitalHuman();
  const pipelineTask = usePipelineTask(submitDigitalHuman);
  const { data: ttsData } = useTtsWorkflows();

  const form = useForm<DigitalHumanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      narration: searchParams.get('narration') ?? '',
      portrait_url: searchParams.get('portrait_url') ?? '',
      voice_workflow: searchParams.get('voice_workflow') ?? '__none__',
    },
  });

  const configValues = useWatch({ control: form.control });

  const handleSubmit = form.handleSubmit(async (values) => {
    await pipelineTask.submit(buildDigitalHumanPayload(values));
  });

  return (
    <>
      <CreatePipelineLayout
        title="Digital Human"
        description="Upload a portrait, choose an optional voice workflow, and generate a presenter-style video."
        statusPanel={
          <PipelineStatusPanel
            config={{
              portrait: configValues.portrait_url ? 'Uploaded' : 'Missing',
              narration: configValues.narration || 'Waiting for narration',
              voice_workflow:
                configValues.voice_workflow && configValues.voice_workflow !== '__none__'
                  ? configValues.voice_workflow
                  : 'Default voice',
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
                    <Mic2 className="size-8" />
                  </div>
                  Presenter Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <FormField
                  control={form.control}
                  name="portrait_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <FieldLabel label="Portrait Image" required />
                      </FormLabel>
                      <MediaUploader
                        accept="image/*"
                        inputLabel="Portrait image"
                        value={field.value}
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="narration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <FieldLabel label="Narration" required />
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Write the narration that the digital presenter should speak."
                          className="min-h-40"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="voice_workflow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <FieldLabel label="Voice Workflow" />
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger aria-label="Voice workflow">
                            <SelectValue placeholder="Use the default voice workflow" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Use default workflow</SelectItem>
                          {(ttsData?.workflows ?? []).map((workflow) => (
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

export { DIGITAL_HUMAN_REQUEST_KEYS };

export default function DigitalHumanPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading Digital Human...</div>}>
      <DigitalHumanPageContent />
    </Suspense>
  );
}
