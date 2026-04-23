'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CopyPlus, Download, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { PipelineSelector } from '@/components/batch/pipeline-selector';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MAX_BATCH_CSV_ROWS,
  buildEmptyRow,
  coerceBatchRow,
  parseBatchCsv,
  updateParsedCsvRow,
  type ParsedCsvImport,
} from '@/lib/batch-csv';
import {
  buildBatchDefaultName,
  buildBatchTemplateCsv,
  getPipelineMetadata,
  getBatchRequestFields,
  type BatchPipeline,
  type BatchRowPayload,
} from '@/lib/batch-utils';
import { decodeCSV } from '@/lib/csv-encoding';
import { useCreateBatch } from '@/lib/hooks/use-batches';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useProjects } from '@/lib/hooks/use-projects';
import { useAppTranslations } from '@/lib/i18n';
import { projectFilterLabel } from '@/lib/pipeline-utils';
import { cn } from '@/lib/utils';

type ManualRow = ReturnType<typeof buildEmptyRow>;
type ManualRowsState = Record<BatchPipeline, ManualRow[]>;
type CsvRowsState = Record<BatchPipeline, ParsedCsvImport<BatchPipeline> | null>;

function createInitialManualRows(): ManualRowsState {
  return {
    standard: [buildEmptyRow('standard')],
    digital_human: [buildEmptyRow('digital_human')],
    i2v: [buildEmptyRow('i2v')],
    action_transfer: [buildEmptyRow('action_transfer')],
    asset_based: [buildEmptyRow('asset_based')],
  };
}

function createInitialCsvRows(): CsvRowsState {
  return {
    standard: null,
    digital_human: null,
    i2v: null,
    action_transfer: null,
    asset_based: null,
  };
}

function updateManualRowSet(
  rows: ManualRowsState,
  pipeline: BatchPipeline,
  updater: (currentRows: ManualRow[]) => ManualRow[]
): ManualRowsState {
  return {
    ...rows,
    [pipeline]: updater(rows[pipeline]),
  };
}

function normalizeProjectSelection(value: string): string | null | undefined {
  if (value === '__unassigned__') {
    return null;
  }

  return value.trim() ? value : undefined;
}

function BatchSourceTab({
  active,
  onSelect,
}: {
  active: 'manual' | 'csv';
  onSelect: (next: 'manual' | 'csv') => void;
}) {
  const t = useAppTranslations('batch');
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={active === 'manual' ? 'default' : 'outline'} onClick={() => onSelect('manual')}>
        {t('new.source.manual')}
      </Button>
      <Button variant={active === 'csv' ? 'default' : 'outline'} onClick={() => onSelect('csv')}>
        {t('new.source.csv')}
      </Button>
    </div>
  );
}

function FieldInput({
  helperText,
  label,
  onChange,
  type,
  value,
  options,
  placeholder,
}: {
  helperText?: string;
  label: string;
  onChange: (value: string) => void;
  options?: readonly { label: string; value: string }[];
  placeholder?: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'json';
  value: string;
}) {
  if (type === 'select' && options) {
    return (
      <div className="space-y-1.5">
        <Select value={value} onValueChange={(nextValue) => onChange(nextValue ?? '')}>
          <SelectTrigger aria-label={label}>
            <SelectValue placeholder={placeholder ?? label} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {helperText ? <p className="text-[11px] leading-4 text-muted-foreground">{helperText}</p> : null}
      </div>
    );
  }

  if (type === 'textarea' || type === 'json') {
    return (
      <div className="space-y-1.5">
        <Textarea
          aria-label={label}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-24"
        />
        {helperText ? <p className="text-[11px] leading-4 text-muted-foreground">{helperText}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Input
        aria-label={label}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {helperText ? <p className="text-[11px] leading-4 text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}

function BatchNewPageContent() {
  const t = useAppTranslations('batch');
  const router = useRouter();
  const { currentProject, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const createBatch = useCreateBatch();

  const [pipeline, setPipeline] = useState<BatchPipeline>('standard');
  const [sourceMode, setSourceMode] = useState<'manual' | 'csv'>('manual');
  const [batchName, setBatchName] = useState('');
  const [projectSelection, setProjectSelection] = useState<string | null>(null);
  const [manualRows, setManualRows] = useState<ManualRowsState>(() => createInitialManualRows());
  const [csvImports, setCsvImports] = useState<CsvRowsState>(() => createInitialCsvRows());

  const metadata = getPipelineMetadata(pipeline);
  const fields = getBatchRequestFields(pipeline);
  const projectOptions = projectsData?.items ?? [];
  const currentManualRows = manualRows[pipeline];
  const currentCsvImport = csvImports[pipeline];
  const effectiveProjectSelection = projectSelection ?? currentProject?.id ?? '__unassigned__';

  const parsedRows = useMemo(() => {
    if (sourceMode === 'manual') {
      return currentManualRows.map((row) => coerceBatchRow(pipeline, row));
    }
    return currentCsvImport?.rows ?? [];
  }, [currentCsvImport?.rows, currentManualRows, pipeline, sourceMode]);

  const validRows = useMemo(
    () => parsedRows.flatMap((row) => (row.payload ? [row.payload as BatchRowPayload] : [])),
    [parsedRows]
  );
  const csvErrorRows = useMemo(
    () => currentCsvImport?.rows.filter((row) => row.errors.length > 0) ?? [],
    [currentCsvImport?.rows]
  );

  const hasBlockingErrors =
    (sourceMode === 'csv' && (currentCsvImport?.fileErrors.length ?? 0) > 0) ||
    parsedRows.some((row) => row.errors.length > 0);

  const handleDownloadTemplate = () => {
    const csv = buildBatchTemplateCsv(pipeline);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${metadata.slug}-batch-template.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const text = decodeCSV(buffer);
    const parsed = parseBatchCsv(pipeline, text);
    setCsvImports((current) => ({
      ...current,
      [pipeline]: parsed,
    }));
    setSourceMode('csv');
  };

  const handleSubmit = async () => {
    if (pipeline === 'asset_based' && sourceMode === 'manual') {
      toast.error(t('new.toasts.customRequiresCsv'));
      return;
    }

    if (validRows.length === 0) {
      toast.error(t('new.toasts.needValidRows'));
      return;
    }

    if (hasBlockingErrors) {
      toast.error(t('new.toasts.resolveInvalidRows'));
      return;
    }

    const normalizedProjectId = normalizeProjectSelection(effectiveProjectSelection);

    try {
      const response = await createBatch.mutateAsync({
        pipeline,
        name: batchName.trim() || buildBatchDefaultName(),
        project_id: normalizedProjectId,
        rows: validRows,
      });

      if (normalizedProjectId) {
        const selectedProject = (projectsData?.items ?? []).find((project) => project.id === normalizedProjectId);
        if (selectedProject) {
          setCurrentProject({ id: selectedProject.id, name: selectedProject.name });
        }
      }

      toast.success(t('new.toasts.submitted'));
      router.push(`/batch/${response.batch_id}`);
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : t('new.toasts.submitFailed');
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">{t('new.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t('new.description')}
        </p>
      </div>

      <Card className="border-border/70 bg-card shadow-none">
        <CardHeader>
          <CardTitle>{t('new.steps.pipelineTitle')}</CardTitle>
          <CardDescription>{t('new.steps.pipelineDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <PipelineSelector value={pipeline} onChange={setPipeline} />
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-none">
        <CardHeader>
          <CardTitle>{t('new.steps.settingsTitle')}</CardTitle>
          <CardDescription>{t('new.steps.settingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="batch-name">
              {t('new.fields.batchName')}
            </label>
            <Input
              id="batch-name"
              aria-label={t('new.fields.batchName')}
              value={batchName}
              placeholder={buildBatchDefaultName()}
              onChange={(event) => setBatchName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="batch-project">
              {t('new.fields.targetProject')}
            </label>
            <Select value={effectiveProjectSelection} onValueChange={(value) => setProjectSelection(value ?? '__unassigned__')}>
              <SelectTrigger id="batch-project" aria-label={t('new.fields.targetProject')}>
                <span data-slot="select-value" className="flex flex-1 text-left">
                  {projectFilterLabel(effectiveProjectSelection, projectOptions)}
                </span>
              </SelectTrigger>
              <SelectContent>
                {projectOptions.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
                <SelectItem value="__unassigned__">{t('shared.filters.unassigned')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-none">
        <CardHeader className="flex flex-col gap-3 border-b md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>{t('new.steps.rowsTitle')}</CardTitle>
            <CardDescription>
              {t('new.steps.rowsDescription', {
                pipeline: metadata.label,
                limit: MAX_BATCH_CSV_ROWS,
              })}
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <BatchSourceTab active={sourceMode} onSelect={setSourceMode} />
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="size-4" />
              {t('new.actions.downloadTemplate')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {sourceMode === 'manual' && pipeline !== 'asset_based' ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setManualRows((current) =>
                      updateManualRowSet(current, pipeline, (rows) => [...rows, buildEmptyRow(pipeline)])
                    )
                  }
                >
                  <Plus className="size-4" />
                  {t('new.actions.addRow')}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border/70">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/20">
                    <tr>
                      {fields.map((field) => (
                        <th key={field.key} className="min-w-48 px-3 py-3 text-left font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{field.label}</span>
                            <span className={cn('size-2 rounded-full bg-muted-foreground/30', field.required ? 'bg-primary' : '')} />
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-right font-semibold text-foreground">{t('new.columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentManualRows.map((row, rowIndex) => {
                      const validation = coerceBatchRow(pipeline, row);
                      return (
                        <tr key={`manual-row-${rowIndex}`} className="border-t border-border/60 align-top">
                          {fields.map((field) => (
                            <td key={`${rowIndex}-${field.key}`} className="min-w-48 px-3 py-3">
                              <FieldInput
                                label={field.label}
                                type={field.input}
                                value={row[field.key] ?? ''}
                                options={field.options}
                                placeholder={field.placeholder}
                                helperText={field.helperText}
                                onChange={(value) =>
                                  setManualRows((current) =>
                                    updateManualRowSet(current, pipeline, (rows) =>
                                      rows.map((existingRow, existingIndex) =>
                                        existingIndex === rowIndex
                                          ? { ...existingRow, [field.key]: value }
                                          : existingRow
                                      )
                                    )
                                  )
                                }
                              />
                            </td>
                          ))}
                          <td className="space-y-2 px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setManualRows((current) =>
                                    updateManualRowSet(current, pipeline, (rows) => [
                                      ...rows.slice(0, rowIndex + 1),
                                      { ...row },
                                      ...rows.slice(rowIndex + 1),
                                    ])
                                  )
                                }
                              >
                                <CopyPlus className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-destructive/40 text-destructive"
                                onClick={() =>
                                  setManualRows((current) =>
                                    updateManualRowSet(current, pipeline, (rows) =>
                                      rows.length === 1 ? [buildEmptyRow(pipeline)] : rows.filter((_, index) => index !== rowIndex)
                                    )
                                  )
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                            {validation.errors.length > 0 ? (
                              <div className="space-y-1 text-xs text-[hsl(3,80%,56%)]">
                                {validation.errors.map((error) => (
                                  <p key={`${rowIndex}-${error}`}>{error}</p>
                                ))}
                              </div>
                            ) : (
                              <Badge className="border-transparent bg-[hsl(145,70%,40%)] text-white">{t('new.validation.valid')}</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {sourceMode === 'manual' && pipeline === 'asset_based' ? (
            <Card className="border-border/70 bg-muted/10 shadow-none">
              <CardContent className="space-y-3 py-8 text-sm text-muted-foreground">
                <p>{t('new.customCsvOnly')}</p>
                <Button variant="outline" onClick={() => setSourceMode('csv')}>
                  {t('new.actions.switchToCsv')}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {sourceMode === 'csv' ? (
            <div className="space-y-4">
              <label
                htmlFor="batch-csv-file"
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center"
              >
                <Upload className="size-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{t('new.csv.uploadTitle')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('new.csv.uploadDescription', { pipeline: metadata.label })}
                  </p>
                </div>
              </label>
              <Input
                id="batch-csv-file"
                aria-label={t('new.csv.fileLabel')}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  void handleCsvFile(file);
                }}
              />

              {currentCsvImport?.fileErrors.length ? (
                <div className="rounded-2xl border border-[hsl(3,80%,56%)]/40 bg-[hsl(3,80%,56%)]/10 p-4 text-sm text-[hsl(3,80%,56%)]">
                  {currentCsvImport.fileErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}

              {csvErrorRows.length > 0 ? (
                <div className="rounded-2xl border border-[hsl(3,80%,56%)]/30 bg-[hsl(3,80%,56%)]/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-transparent bg-[hsl(3,80%,56%)] text-white">
                      {t('new.columns.validation')} {csvErrorRows.length}
                    </Badge>
                    {csvErrorRows.map((row, index) => (
                      <Button
                        key={row.id}
                        variant="outline"
                        size="sm"
                        className="border-[hsl(3,80%,56%)]/30"
                        onClick={() => {
                          document.getElementById(`csv-row-${row.id}`)?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                        }}
                      >
                        {`#${index + 1}`}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {currentCsvImport ? (
                <div className="overflow-x-auto rounded-2xl border border-border/70">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/20">
                      <tr>
                        {fields.map((field) => (
                          <th key={field.key} className="min-w-44 px-3 py-3 text-left font-semibold text-foreground">
                            {field.label}
                          </th>
                        ))}
                        <th className="px-3 py-3 text-left font-semibold text-foreground">{t('new.columns.validation')}</th>
                        <th className="px-3 py-3 text-right font-semibold text-foreground">{t('new.columns.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCsvImport.rows.map((row) => (
                        <tr
                          key={row.id}
                          id={`csv-row-${row.id}`}
                          className={cn(
                            'border-t border-border/60 align-top',
                            row.errors.length > 0 ? 'bg-[hsl(3,80%,56%)]/5' : undefined
                          )}
                        >
                          {fields.map((field) => (
                            <td key={`${row.id}-${field.key}`} className="min-w-44 px-3 py-3">
                              <FieldInput
                                label={field.label}
                                type={field.input}
                                value={row.raw[field.key] ?? ''}
                                options={field.options}
                                placeholder={field.placeholder}
                                helperText={field.helperText}
                                onChange={(value) =>
                                  setCsvImports((current) => ({
                                    ...current,
                                    [pipeline]: current[pipeline]
                                      ? {
                                          ...current[pipeline],
                                          rows: current[pipeline]!.rows.map((existingRow) =>
                                            existingRow.id === row.id
                                              ? updateParsedCsvRow(pipeline, existingRow, field.key, value)
                                              : existingRow
                                          ),
                                        }
                                      : current[pipeline],
                                  }))
                                }
                              />
                            </td>
                          ))}
                          <td className="space-y-1 px-3 py-3">
                            {row.errors.length === 0 ? (
                              <Badge className="border-transparent bg-[hsl(145,70%,40%)] text-white">{t('new.validation.valid')}</Badge>
                            ) : (
                              row.errors.map((error) => (
                                <p key={`${row.id}-${error}`} className="text-xs text-[hsl(3,80%,56%)]">
                                  {error}
                                </p>
                              ))
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-destructive/40 text-destructive"
                              onClick={() =>
                                setCsvImports((current) => ({
                                  ...current,
                                  [pipeline]: current[pipeline]
                                    ? {
                                        ...current[pipeline],
                                        rows: current[pipeline]!.rows.filter((existingRow) => existingRow.id !== row.id),
                                      }
                                    : current[pipeline],
                                }))
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
                  {t('new.csv.emptyState')}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-none">
        <CardHeader>
          <CardTitle>{t('new.summary.title')}</CardTitle>
          <CardDescription>
            {hasBlockingErrors
              ? t('new.summary.invalidDescription', { count: validRows.length, pipeline: metadata.label })
              : t('new.summary.readyDescription', { count: validRows.length, pipeline: metadata.label })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{metadata.label}</Badge>
            <Badge variant="outline">{sourceMode === 'manual' ? t('new.source.manual') : t('new.source.csv')}</Badge>
            <Badge variant="outline">{t('new.summary.validRows', { count: validRows.length })}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/batch" className={cn(buttonVariants({ variant: 'outline' }))}>
              {t('actions.cancel')}
            </Link>
            <Button onClick={() => void handleSubmit()} disabled={createBatch.isPending || validRows.length === 0}>
              <FileSpreadsheet className="size-4" />
              {createBatch.isPending ? t('new.actions.submitting') : t('new.actions.submitBatch')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BatchNewPage() {
  const t = useAppTranslations('batch');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('fallback.loadingBatchBuilder')}</div>}>
      <BatchNewPageContent />
    </Suspense>
  );
}
