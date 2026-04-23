'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, FileJson } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SaveAsTemplateDialog } from '@/components/workflows/save-as-template-dialog';
import { WorkflowGraphPreview } from '@/components/workflows/workflow-graph-preview';
import { extractWorkflowInputSchema, WorkflowParamForm } from '@/components/workflows/workflow-param-form';
import { useAppTranslations } from '@/lib/i18n';
import { useUpdateWorkflowDetail, useWorkflowDetail } from '@/lib/hooks/use-resources';
import {
  getWorkflowCategoryLabel,
  getWorkflowDescription,
  getWorkflowDisplayName,
  getWorkflowSourceLabel,
  getWorkflowTagLabels,
  getWorkflowTechnicalLabel,
} from '@/lib/resource-display';

type WorkflowTab = 'json' | 'preview';

function downloadWorkflowDetail(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readWorkflowJson(editorValue: string, fallback: Record<string, unknown>): Record<string, unknown> {
  try {
    const parsed = JSON.parse(editorValue);
    return isRecord(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function deriveParamValues(schema: Record<string, unknown>): Record<string, unknown> {
  const source = isRecord(schema.properties) ? schema.properties : schema;

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => {
      if (isRecord(value)) {
        if ('default' in value) {
          return [key, value.default];
        }

        if (Array.isArray(value.enum) && value.enum.length > 0) {
          return [key, value.enum[0]];
        }
      }

      return [key, value];
    })
  );
}

function applyParamValuesToWorkflowJson(
  workflowJson: Record<string, unknown>,
  values: Record<string, unknown>
): Record<string, unknown> {
  for (const [nodeId, node] of Object.entries(workflowJson)) {
    if (!isRecord(node)) {
      continue;
    }

    const classType = String(node.class_type ?? node.type ?? '').toLowerCase();
    if ((classType.includes('input') || classType.includes('load')) && isRecord(node.inputs)) {
      return {
        ...workflowJson,
        [nodeId]: {
          ...node,
          inputs: {
            ...node.inputs,
            ...values,
          },
        },
      };
    }
  }

  return { ...workflowJson, input_values: values };
}

export default function WorkflowDetailPage() {
  const t = useAppTranslations('workflowDetail');
  const common = useAppTranslations('common');
  const params = useParams<{ id: string }>();
  const workflowId = decodeURIComponent(params.id);
  const workflowQuery = useWorkflowDetail(workflowId);
  const updateWorkflow = useUpdateWorkflowDetail();
  const workflow = workflowQuery.data;
  const [editorValue, setEditorValue] = useState('{}');
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<WorkflowTab>('preview');
  const technicalPath = workflow?.technical_path || workflow?.path || '—';
  const technicalName = workflow ? getWorkflowTechnicalLabel(workflow) ?? '—' : '—';
  const sourceLabel = workflow ? getWorkflowSourceLabel(workflow) : '';
  const categoryLabel = workflow ? getWorkflowCategoryLabel(workflow) : '';
  const displayName = workflow ? getWorkflowDisplayName(workflow) : '';
  const description = workflow ? getWorkflowDescription(workflow) : null;
  const tags = workflow ? getWorkflowTagLabels(workflow) : [];

  useEffect(() => {
    if (workflow) {
      setEditorValue(JSON.stringify(workflow.workflow_json ?? {}, null, 2));
      setParamValues(deriveParamValues(extractWorkflowInputSchema(workflow.workflow_json ?? {})));
    }
  }, [workflow]);

  const metadataJson = useMemo(
    () => JSON.stringify(workflow?.metadata ?? {}, null, 2),
    [workflow?.metadata]
  );
  const parsedWorkflowJson = useMemo(
    () => readWorkflowJson(editorValue, workflow?.workflow_json ?? {}),
    [editorValue, workflow?.workflow_json]
  );
  const paramSchema = useMemo(() => extractWorkflowInputSchema(parsedWorkflowJson), [parsedWorkflowJson]);

  const handleSave = async (payloadOverride?: Record<string, unknown>, includeParamValues = false) => {
    try {
      const parsed = payloadOverride ?? JSON.parse(editorValue);
      if (!isRecord(parsed)) {
        throw new SyntaxError('Workflow JSON must be an object.');
      }
      const payload = includeParamValues ? applyParamValuesToWorkflowJson(parsed, paramValues) : parsed;
      await updateWorkflow.mutateAsync({ workflowId, payload });
      setEditorValue(JSON.stringify(payload, null, 2));
      toast.success(t('saveSuccess'));
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? 'Workflow JSON is invalid.'
          : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
            ? error.message
            : 'Failed to save workflow.';
      toast.error(message);
    }
  };

  if (workflowQuery.isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">{t('loading')}</div>;
  }

  if (!workflow) {
    return (
      <div className="p-4">
        <EmptyState
          icon={FileJson}
          title={t('notFoundTitle')}
          description={t('notFoundDescription')}
          actionHref="/workflows"
          actionLabel={t('backToWorkflows')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{sourceLabel}</Badge>
            <Badge variant="outline">{workflow.editable ? t('editable') : t('readonly')}</Badge>
            <Badge variant="outline">{categoryLabel}</Badge>
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
          <p className="text-sm text-muted-foreground">{description ?? t('descriptionFallback')}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadWorkflowDetail(JSON.parse(editorValue || '{}'), `${workflow.name}.json`)}
          >
            <Download className="size-4" />
            {t('downloadJson')}
          </Button>
          {workflow.editable ? (
            <>
              <SaveAsTemplateDialog
                workflowName={displayName}
                workflowJson={parsedWorkflowJson}
                parameters={workflow.key_parameters ?? []}
                disabled={updateWorkflow.isPending}
                onSave={(payload) => handleSave(payload)}
              />
              <Button type="button" onClick={() => void handleSave()} disabled={updateWorkflow.isPending}>
                {t('saveJson')}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader>
              <CardTitle>{t('usage')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{displayName}</p>
                <p className="mt-1 text-muted-foreground">{description ?? t('descriptionFallback')}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('whenToUse')}</p>
                <p className="mt-2 text-sm text-foreground">{description ?? t('descriptionFallback')}</p>
              </div>
            </CardContent>
          </Card>

          <details className="rounded-2xl border border-border/70 bg-card p-4 text-sm shadow-none">
            <summary className="cursor-pointer list-none font-medium text-foreground">
              {t('developerInfo')}
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">{t('developerInfoDescription')}</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t('technicalName')}</span>
                <span className="text-right font-medium text-foreground">{technicalName}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">{t('technicalPath')}</span>
                <span className="max-w-[60%] break-all text-right font-medium text-foreground">{technicalPath}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t('key')}</span>
                <span className="text-right font-medium text-foreground">{workflow.key}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t('workflowId')}</span>
                <span className="text-right font-medium text-foreground">{workflow.workflow_id ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t('source')}</span>
                <span className="text-right font-medium text-foreground">{sourceLabel}</span>
              </div>
            </div>
          </details>
        </div>

        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader>
            <CardTitle>{t('keyParameters')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(workflow.key_parameters ?? []).map((parameter) => (
                <Badge key={parameter} variant="outline">
                  {parameter}
                </Badge>
              ))}
              {(workflow.key_parameters ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noParameters')}</p>
              ) : null}
            </div>

            <details className="rounded-2xl border border-border/70 bg-muted/10 p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">{t('metadataJson')}</summary>
              <pre className="mt-3 overflow-auto text-xs leading-6 text-foreground">{metadataJson}</pre>
            </details>
            <details className="rounded-2xl border border-border/70 bg-muted/10 p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">{t('rawNodeIds')}</summary>
              <pre className="mt-3 overflow-auto text-xs leading-6 text-foreground">
                {JSON.stringify(workflow.raw_nodes ?? [], null, 2)}
              </pre>
            </details>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkflowTab)}>
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="space-y-4 pt-4">
                <WorkflowGraphPreview workflowJson={parsedWorkflowJson} />
                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Input parameters</p>
                    <p className="text-xs text-muted-foreground">
                      Generated from the workflow input schema. Saving writes values back to the workflow JSON.
                    </p>
                  </div>
                  <WorkflowParamForm schema={paramSchema} values={paramValues} onChange={setParamValues} />
                  {workflow.editable ? (
                    <Button type="button" onClick={() => void handleSave(undefined, true)} disabled={updateWorkflow.isPending}>
                      Save Parameters
                    </Button>
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent value="json" className="space-y-3 pt-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{t('editJson')}</p>
                  <p className="text-xs text-muted-foreground">{t('editJsonDescription')}</p>
                </div>
                <Textarea
                  value={editorValue}
                  onChange={(event) => setEditorValue(event.target.value)}
                  className="min-h-[22rem] font-mono text-xs"
                  disabled={!workflow.editable}
                  placeholder={t('editorPlaceholder')}
                />
                {!workflow.editable ? (
                  <p className="text-sm text-muted-foreground">{t('readonly')}</p>
                ) : (
                  <Button type="button" onClick={() => void handleSave()} disabled={updateWorkflow.isPending}>
                    {common('save')}
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
