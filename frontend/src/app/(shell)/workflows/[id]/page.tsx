'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Download, FileJson } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkflowDetail } from '@/lib/hooks/use-resources';

function downloadWorkflowDetail(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const workflowId = decodeURIComponent(params.id);
  const workflowQuery = useWorkflowDetail(workflowId);
  const workflow = workflowQuery.data;

  const metadataJson = useMemo(
    () => JSON.stringify(workflow?.metadata ?? {}, null, 2),
    [workflow?.metadata]
  );

  if (workflowQuery.isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading workflow detail…</div>;
  }

  if (!workflow) {
    return (
      <div className="p-4">
        <EmptyState
          icon={FileJson}
          title="Workflow not found"
          description="The requested workflow could not be loaded from the resources catalog."
          actionHref="/workflows"
          actionLabel="Back to Workflows"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{workflow.source === 'selfhost' ? 'Self-host' : 'RunningHub'}</Badge>
            <Badge variant="outline">{workflow.editable ? 'Editable' : 'Read-only'}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{workflow.display_name}</h1>
          <p className="text-sm text-muted-foreground">{workflow.path}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadWorkflowDetail(workflow, `${workflow.name}.json`)}
          >
            <Download className="size-4" />
            Download JSON
          </Button>
          {workflow.editable ? (
            <Button type="button" disabled>
              Edit (P4+)
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Key</span>
              <span className="text-right font-medium text-foreground">{workflow.key}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Workflow ID</span>
              <span className="text-right font-medium text-foreground">{workflow.workflow_id ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Source</span>
              <span className="text-right font-medium text-foreground">{workflow.source}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-none">
          <CardHeader>
            <CardTitle>Key Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(workflow.key_parameters ?? []).map((parameter) => (
                <Badge key={parameter} variant="outline">
                  {parameter}
                </Badge>
              ))}
              {(workflow.key_parameters ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No key parameters were exposed by the backend for this workflow.</p>
              ) : null}
            </div>

            <details className="rounded-2xl border border-border/70 bg-muted/10 p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Metadata JSON</summary>
              <pre className="mt-3 overflow-auto text-xs leading-6 text-foreground">{metadataJson}</pre>
            </details>
            <details className="rounded-2xl border border-border/70 bg-muted/10 p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Raw Node IDs</summary>
              <pre className="mt-3 overflow-auto text-xs leading-6 text-foreground">
                {JSON.stringify(workflow.raw_nodes ?? [], null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
