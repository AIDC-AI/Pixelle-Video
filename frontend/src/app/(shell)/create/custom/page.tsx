'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PenTool, Plus, Trash2 } from 'lucide-react';

import { useSubmitCustom } from '@/lib/hooks/use-create-video';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type CustomRequest = Omit<components['schemas']['CustomAsyncRequest'], 'project_id'>;
type CustomScene = components['schemas']['CustomScene'];

const CUSTOM_REQUEST_KEYS = [
  'project_id',
  'scenes',
] as const satisfies readonly (keyof components['schemas']['CustomAsyncRequest'])[];

const CUSTOM_SCENE_KEYS = [
  'duration',
  'media',
  'narration',
] as const satisfies readonly (keyof CustomScene)[];

const sceneSchema = z.object({
  duration: z.number().min(1, 'Duration must be at least 1 second.'),
  media: z.string().trim().min(1, 'Scene media is required.'),
  narration: z.string().trim().min(1, 'Scene narration is required.'),
});

const formSchema = z.object({
  scenes: z.array(sceneSchema).min(1, 'At least one scene is required.'),
});

type CustomFormValues = z.infer<typeof formSchema>;

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
    scenes: values.scenes.map((scene) => ({
      duration: scene.duration,
      media: scene.media,
      narration: scene.narration.trim(),
    })),
  };
}

function CustomPageContent() {
  const searchParams = useSearchParams();
  const submitCustom = useSubmitCustom();
  const pipelineTask = usePipelineTask(submitCustom, {
    initialTaskId: searchParams.get('task_id'),
  });

  const form = useForm<CustomFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scenes: parseScenes(searchParams.get('scenes')),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'scenes',
  });
  const configValues = useWatch({ control: form.control });

  const handleSubmit = form.handleSubmit(async (values) => {
    await pipelineTask.submit(buildCustomPayload(values));
  });

  return (
    <>
      <CreatePipelineLayout
        title="Custom Asset"
        description="Build a multi-scene asset run with independent media, narration, and duration for each scene."
        statusPanel={
          <PipelineStatusPanel
            config={{
              scenes: configValues.scenes ?? [],
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
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <PenTool className="size-8" />
                    </div>
                    Scene Builder
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => append({ ...EMPTY_SCENE })}
                  >
                    <Plus className="size-4" />
                    Add Scene
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-4 rounded-xl border border-border/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-medium text-foreground">Scene {index + 1}</h2>
                        <p className="text-sm text-muted-foreground">
                          Upload media, add narration, and set the duration for this scene.
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
                        Remove
                      </Button>
                    </div>

                    <FormField
                      control={form.control}
                      name={`scenes.${index}.media`}
                      render={({ field: mediaField }) => (
                        <FormItem>
                          <FormLabel>
                            <FieldLabel label="Scene Media" required />
                          </FormLabel>
                          <MediaUploader
                            accept="image/*,video/*"
                            inputLabel={`Scene ${index + 1} media`}
                            value={mediaField.value}
                            onChange={mediaField.onChange}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`scenes.${index}.narration`}
                      render={({ field: narrationField }) => (
                        <FormItem>
                          <FormLabel>
                            <FieldLabel label="Scene Narration" required />
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...narrationField}
                              placeholder="Describe the narration or voiceover for this scene."
                              className="min-h-28"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`scenes.${index}.duration`}
                      render={({ field: durationField }) => (
                        <FormItem>
                          <FormLabel>
                            <FieldLabel label="Duration (seconds)" required />
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
                      )}
                    />
                  </div>
                ))}
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

export { CUSTOM_REQUEST_KEYS, CUSTOM_SCENE_KEYS };

export default function CustomPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading Custom Asset...</div>}>
      <CustomPageContent />
    </Suspense>
  );
}
