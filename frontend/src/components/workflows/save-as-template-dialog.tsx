'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface SaveAsTemplateDialogProps {
  disabled?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void> | void;
  parameters: string[];
  workflowJson: Record<string, unknown>;
  workflowName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildTemplateWorkflowPayload({
  description,
  name,
  parameters,
  workflowJson,
}: {
  description: string;
  name: string;
  parameters: string[];
  workflowJson: Record<string, unknown>;
}): Record<string, unknown> {
  const existingMetadata = isRecord(workflowJson.metadata) ? workflowJson.metadata : {};

  return {
    ...workflowJson,
    metadata: {
      ...existingMetadata,
      exposed_parameters: parameters,
      is_template: true,
      template_description: description.trim(),
      template_name: name.trim(),
    },
  };
}

export function SaveAsTemplateDialog({
  disabled = false,
  onSave,
  parameters,
  workflowJson,
  workflowName,
}: SaveAsTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${workflowName} template`);
  const [description, setDescription] = useState('');
  const [selectedParameters, setSelectedParameters] = useState<string[]>(parameters);
  const uniqueParameters = useMemo(() => Array.from(new Set(parameters)), [parameters]);

  const toggleParameter = (parameter: string) => {
    setSelectedParameters((current) =>
      current.includes(parameter) ? current.filter((item) => item !== parameter) : [...current, parameter]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Template name is required.');
      return;
    }

    await onSave(
      buildTemplateWorkflowPayload({
        description,
        name,
        parameters: selectedParameters,
        workflowJson,
      })
    );
    toast.success('Template metadata saved.');
    setOpen(false);
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
        Save as Template
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl bg-background">
          <DialogHeader>
            <DialogTitle>Save workflow as template</DialogTitle>
            <DialogDescription>
              Store template metadata in this workflow JSON. Backend template publishing is not required for this phase.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Template name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Description</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Exposed parameters</p>
              {uniqueParameters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No parameters were detected.</p>
              ) : (
                <div className="grid gap-2">
                  {uniqueParameters.map((parameter) => (
                    <label key={parameter} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedParameters.includes(parameter)}
                        onChange={() => toggleParameter(parameter)}
                      />
                      {parameter}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
