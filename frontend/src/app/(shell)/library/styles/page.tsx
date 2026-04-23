'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { CopyPlus, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/empty-state';
import { LibraryTable } from '@/components/library/library-table';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
import {
  useCreateStyle,
  useDeleteStyle,
  useStyleDetail,
  useStyles,
  useUpdateStyle,
} from '@/lib/hooks/use-resources';
import { useTaskList } from '@/lib/hooks/use-task-list';
import { useAppTranslations } from '@/lib/i18n';
import { getStyleDisplayName, getStyleSummary } from '@/lib/resource-display';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type StyleSummary = components['schemas']['StyleSummary'];

const TABLE_GRID_CLASS = 'grid grid-cols-[1.4fr_10rem_8rem_8rem_11rem_18rem]';
const EMPTY_EDITOR_STATE = {
  id: '',
  name: '',
  description: '',
  scene: '',
  tone: '',
  analysisCreativeLayer: '',
  audioSyncCreativeLayer: '',
  referenceConfigText: '{}',
  runtimeConfigText: '{}',
};

type StyleSourceTab = 'builtin' | 'custom';
type EditorMode = 'create' | 'edit' | 'clone';

function buildQuickHref(styleId: string) {
  return `/create/quick?${new URLSearchParams({ style_id: styleId, bgm_mode: 'default' }).toString()}`;
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function LibraryStylesPageContent() {
  const t = useAppTranslations('library');
  const common = useAppTranslations('common');
  const searchParams = useSearchParams();
  const stylesQuery = useStyles();
  const tasksQuery = useTaskList({ limit: 1000, projectFilter: 'all' });
  const createStyle = useCreateStyle();
  const updateStyle = useUpdateStyle();
  const deleteStyle = useDeleteStyle();

  const [activeTab, setActiveTab] = useState<StyleSourceTab>('builtin');
  const [search, setSearch] = useState('');
  const [sceneFilter, setSceneFilter] = useState('__all__');
  const [detailStyleId, setDetailStyleId] = useState<string | null>(null);
  const [editorStyleId, setEditorStyleId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [deleteTarget, setDeleteTarget] = useState<StyleSummary | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorState, setEditorState] = useState(EMPTY_EDITOR_STATE);

  const detailQuery = useStyleDetail(detailStyleId);
  const editorQuery = useStyleDetail(editorStyleId);

  const items = useMemo(() => {
    const allItems = stylesQuery.data?.styles ?? [];
    const normalizedSearch = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if ((activeTab === 'builtin') !== item.is_builtin) {
        return false;
      }
      if (sceneFilter !== '__all__' && item.scene !== sceneFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return [item.id, item.name, item.display_name_zh, item.description, item.short_description_zh, item.scene, item.tone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [activeTab, sceneFilter, search, stylesQuery.data?.styles]);

  const scenes = useMemo(() => {
    const values = new Set(
      (stylesQuery.data?.styles ?? [])
        .map((style) => style.scene)
        .filter((scene): scene is string => Boolean(scene))
    );
    return Array.from(values).sort((left, right) =>
      String(left ?? '').localeCompare(String(right ?? ''))
    );
  }, [stylesQuery.data?.styles]);

  const styleReferenceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (tasksQuery.data ?? []).forEach((task) => {
      const styleId = typeof task.request_params?.style_id === 'string' ? task.request_params.style_id : null;
      if (styleId) {
        counts.set(styleId, (counts.get(styleId) ?? 0) + 1);
      }
    });
    return counts;
  }, [tasksQuery.data]);

  useEffect(() => {
    if (!editorQuery.data) {
      return;
    }

    const detail = editorQuery.data;
    const nextId = editorMode === 'clone' ? `${detail.id}-copy` : detail.id;
    setEditorState({
      id: nextId,
      name: editorMode === 'clone' ? `${detail.name} Copy` : detail.name,
      description: detail.description ?? '',
      scene: detail.scene ?? '',
      tone: detail.tone ?? '',
      analysisCreativeLayer: detail.analysis_creative_layer ?? '',
      audioSyncCreativeLayer: detail.audio_sync_creative_layer ?? '',
      referenceConfigText: stringifyJson(detail.reference_config),
      runtimeConfigText: stringifyJson(detail.runtime_config),
    });
  }, [editorMode, editorQuery.data]);

  useEffect(() => {
    const selectedStyleId = searchParams.get('style_id');
    if (!selectedStyleId || !stylesQuery.data?.styles) {
      return;
    }

    const matchedStyle = stylesQuery.data.styles.find((style) => style.id === selectedStyleId);
    if (!matchedStyle) {
      return;
    }

    setActiveTab(matchedStyle.is_builtin ? 'builtin' : 'custom');
    setDetailStyleId(matchedStyle.id);
  }, [searchParams, stylesQuery.data?.styles]);

  const openCreateDialog = () => {
    setEditorMode('create');
    setEditorStyleId(null);
    setEditorState(EMPTY_EDITOR_STATE);
    setIsEditorOpen(true);
  };

  const openEditDialog = (styleId: string) => {
    setEditorMode('edit');
    setEditorStyleId(styleId);
    setIsEditorOpen(true);
  };

  const openCloneDialog = (styleId: string) => {
    setEditorMode('clone');
    setEditorStyleId(styleId);
    setIsEditorOpen(true);
  };

  const submitStyle = async () => {
    let referenceConfig: Record<string, unknown>;
    let runtimeConfig: Record<string, unknown>;
    try {
      referenceConfig = JSON.parse(editorState.referenceConfigText);
      runtimeConfig = JSON.parse(editorState.runtimeConfigText);
    } catch {
      toast.error(t('styles.invalidJson'));
      return;
    }

    const payload = {
      id: editorState.id.trim(),
      name: editorState.name.trim(),
      description: editorState.description.trim() || null,
      scene: editorState.scene.trim() || null,
      tone: editorState.tone.trim() || null,
      analysis_creative_layer: editorState.analysisCreativeLayer,
      audio_sync_creative_layer: editorState.audioSyncCreativeLayer,
      reference_config: referenceConfig,
      runtime_config: runtimeConfig,
    };

    try {
      if (editorMode === 'edit' && editorStyleId) {
        await updateStyle.mutateAsync({ styleId: editorStyleId, payload });
      } else {
        await createStyle.mutateAsync(payload);
      }
      toast.success(t('styles.saveSuccess'));
      setIsEditorOpen(false);
      setEditorStyleId(null);
      setEditorState(EMPTY_EDITOR_STATE);
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : t('styles.saveFailed');
      toast.error(message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteStyle.mutateAsync(deleteTarget.id);
      toast.success(t('styles.deleteSuccess'));
      setDeleteTarget(null);
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : t('styles.deleteFailed');
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{t('styles.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('styles.description')}</p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          {t('styles.createStyle')}
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex gap-2">
          <Button type="button" variant={activeTab === 'builtin' ? 'default' : 'outline'} onClick={() => setActiveTab('builtin')}>
            {t('styles.builtinTab')}
          </Button>
          <Button type="button" variant={activeTab === 'custom' ? 'default' : 'outline'} onClick={() => setActiveTab('custom')}>
            {t('styles.customTab')}
          </Button>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('styles.searchPlaceholder')}
          className="md:max-w-sm"
        />
        <select
          aria-label={t('styles.sceneFilterLabel')}
          value={sceneFilter ?? '__all__'}
          onChange={(event) => setSceneFilter(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="__all__">{t('styles.allScenes')}</option>
          {scenes.map((scene) => (
            <option key={scene} value={scene}>
              {scene}
            </option>
          ))}
        </select>
      </div>

      {stylesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`style-skeleton-${index}`} className="h-24 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          ))}
        </div>
      ) : null}

      {!stylesQuery.isLoading && items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={activeTab === 'builtin' ? t('styles.emptyBuiltin') : t('styles.emptyCustom')}
          description={t('styles.emptyDescription')}
        />
      ) : null}

      {!stylesQuery.isLoading && items.length > 0 ? (
        <LibraryTable
          gridClassName={TABLE_GRID_CLASS}
          columns={[
            t('styles.columns.name'),
            t('styles.columns.scene'),
            t('styles.columns.tone'),
            'Used',
            t('styles.columns.preview'),
            t('styles.columns.actions'),
          ]}
          body={
            <>
              {items.map((style) => (
                <div
                  key={style.id}
                  className={`${TABLE_GRID_CLASS} gap-4 border-b border-border/60 px-4 py-4 last:border-none`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{getStyleDisplayName(style)}</p>
                      <Badge variant="outline">{style.is_builtin ? t('styles.builtinBadge') : t('styles.customBadge')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{getStyleSummary(style) || t('styles.noDescription')}</p>
                  </div>
                  <div className="text-sm text-foreground">{style.scene || t('shared.unknown')}</div>
                  <div className="text-sm text-muted-foreground">{style.tone || t('shared.unknown')}</div>
                  <div className="text-sm text-muted-foreground">
                    Used by {styleReferenceCounts.get(style.id) ?? 0} tasks
                  </div>
                  <div>
                    {style.preview_bgm_url ? (
                      <audio controls preload="none" className="w-full max-w-xs" src={style.preview_bgm_url}>
                        <track kind="captions" />
                      </audio>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t('styles.noPreview')}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setDetailStyleId(style.id)}>
                      {common('preview')}
                    </Button>
                    <Link href={buildQuickHref(style.id)} className={cn(buttonVariants({ size: 'sm' }))}>
                      <Sparkles className="size-4" />
                      {t('styles.useInQuick')}
                    </Link>
                    <Button type="button" variant="outline" size="sm" onClick={() => openCloneDialog(style.id)}>
                      <CopyPlus className="size-4" />
                      {t('styles.clone')}
                    </Button>
                    {!style.is_builtin ? (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(style.id)}>
                          <Pencil className="size-4" />
                          {common('edit')}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(style)}>
                          <Trash2 className="size-4" />
                          {common('delete')}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </>
          }
        />
      ) : null}

      <Dialog open={Boolean(detailStyleId)} onOpenChange={(open) => !open && setDetailStyleId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{detailQuery.data ? getStyleDisplayName(detailQuery.data) : t('styles.detailTitle')}</DialogTitle>
            <DialogDescription>
              {detailQuery.data
                ? getStyleSummary(detailQuery.data) ?? detailQuery.data.description ?? t('styles.detailDescription')
                : t('styles.detailDescription')}
            </DialogDescription>
          </DialogHeader>
          {detailQuery.data ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('styles.columns.scene')}</p>
                  <p className="mt-1 text-sm text-foreground">{detailQuery.data.scene || t('shared.unknown')}</p>
                </div>
                <div className="rounded-lg border border-border/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('styles.columns.tone')}</p>
                  <p className="mt-1 text-sm text-foreground">{detailQuery.data.tone || t('shared.unknown')}</p>
                </div>
                <div className="rounded-lg border border-border/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('styles.previewBgm')}</p>
                  {detailQuery.data.preview_bgm_url ? (
                    <audio controls preload="none" className="mt-2 w-full" src={detailQuery.data.preview_bgm_url}>
                      <track kind="captions" />
                    </audio>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">{t('styles.noPreview')}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground">{t('styles.analysisLayer')}</h3>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                    {detailQuery.data.analysis_creative_layer || t('styles.emptyLayer')}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{t('styles.audioLayer')}</h3>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                    {detailQuery.data.audio_sync_creative_layer || t('styles.emptyLayer')}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{t('styles.referenceConfig')}</h3>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                    {stringifyJson(detailQuery.data.reference_config)}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{t('styles.runtimeConfig')}</h3>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                    {stringifyJson(detailQuery.data.runtime_config)}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editorMode === 'edit' ? t('styles.editTitle') : editorMode === 'clone' ? t('styles.cloneTitle') : t('styles.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('styles.editorDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              aria-label={t('styles.fields.id')}
              value={editorState.id}
              onChange={(event) => setEditorState((current) => ({ ...current, id: event.target.value }))}
              placeholder={t('styles.fields.id')}
              disabled={editorMode === 'edit'}
            />
            <Input
              aria-label={t('styles.fields.name')}
              value={editorState.name}
              onChange={(event) => setEditorState((current) => ({ ...current, name: event.target.value }))}
              placeholder={t('styles.fields.name')}
            />
            <Input
              aria-label={t('styles.fields.scene')}
              value={editorState.scene}
              onChange={(event) => setEditorState((current) => ({ ...current, scene: event.target.value }))}
              placeholder={t('styles.fields.scene')}
            />
            <Input
              aria-label={t('styles.fields.tone')}
              value={editorState.tone}
              onChange={(event) => setEditorState((current) => ({ ...current, tone: event.target.value }))}
              placeholder={t('styles.fields.tone')}
            />
          </div>
          <Textarea
            aria-label={t('styles.fields.description')}
            value={editorState.description}
            onChange={(event) => setEditorState((current) => ({ ...current, description: event.target.value }))}
            placeholder={t('styles.fields.description')}
            className="min-h-24"
          />
          <Textarea
            aria-label={t('styles.fields.analysis')}
            value={editorState.analysisCreativeLayer}
            onChange={(event) => setEditorState((current) => ({ ...current, analysisCreativeLayer: event.target.value }))}
            placeholder={t('styles.fields.analysis')}
            className="min-h-32"
          />
          <Textarea
            aria-label={t('styles.fields.audio')}
            value={editorState.audioSyncCreativeLayer}
            onChange={(event) => setEditorState((current) => ({ ...current, audioSyncCreativeLayer: event.target.value }))}
            placeholder={t('styles.fields.audio')}
            className="min-h-32"
          />
          <Textarea
            aria-label={t('styles.fields.referenceConfig')}
            value={editorState.referenceConfigText}
            onChange={(event) => setEditorState((current) => ({ ...current, referenceConfigText: event.target.value }))}
            placeholder={t('styles.fields.referenceConfig')}
            className="min-h-32 font-mono text-xs"
          />
          <Textarea
            aria-label={t('styles.fields.runtimeConfig')}
            value={editorState.runtimeConfigText}
            onChange={(event) => setEditorState((current) => ({ ...current, runtimeConfigText: event.target.value }))}
            placeholder={t('styles.fields.runtimeConfig')}
            className="min-h-32 font-mono text-xs"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditorOpen(false)}>
              {common('cancel')}
            </Button>
            <Button type="button" onClick={() => void submitStyle()}>
              {common('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('styles.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('styles.deleteDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              {common('cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()}>
              {common('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LibraryStylesPage() {
  const t = useAppTranslations('library');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('fallback.loadingStyles')}</div>}>
      <LibraryStylesPageContent />
    </Suspense>
  );
}
