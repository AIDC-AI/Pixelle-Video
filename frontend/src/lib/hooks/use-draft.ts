'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  clearDraft as clearStoredDraft,
  cleanupStaleDrafts,
  hasDraftStoreSupport,
  loadDraft,
  saveDraft as persistDraft,
  type DraftPipeline,
  type DraftRecord,
} from '@/lib/draft-store';

interface UseDraftOptions<TParams extends Record<string, unknown>> {
  debounceMs?: number;
  enabled?: boolean;
  onRestore?: (params: TParams) => void;
  params: TParams;
}

interface UseDraftResult {
  clearDraft: () => Promise<void>;
  draft: DraftRecord | null;
  hasDraft: boolean;
  restoreDraft: () => Promise<void>;
  saveDraft: () => Promise<void>;
}

export function useDraft<TParams extends Record<string, unknown>>(
  pipeline: DraftPipeline,
  projectId: string | null | undefined,
  {
    debounceMs = 500,
    enabled = true,
    onRestore,
    params,
  }: UseDraftOptions<TParams>
): UseDraftResult {
  const [draft, setDraft] = useState<DraftRecord | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const serializedParams = useMemo(() => JSON.stringify(params), [params]);
  const lastSavedRef = useRef<string | null>(serializedParams);
  const onRestoreRef = useRef<typeof onRestore>(onRestore);
  const serializedParamsRef = useRef<string>(serializedParams);
  const restoreLockRef = useRef(false);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    serializedParamsRef.current = serializedParams;
  }, [serializedParams]);

  const restoreDraft = useCallback(async () => {
    const baselineSerializedParams = serializedParamsRef.current;

    if (!enabled || !projectId || !hasDraftStoreSupport()) {
      setDraft(null);
      setHasDraft(false);
      setIsInitialized(true);
      return;
    }

    await cleanupStaleDrafts();
    const storedDraft = await loadDraft(projectId, pipeline);

    if (!storedDraft) {
      setDraft(null);
      setHasDraft(false);
      lastSavedRef.current = baselineSerializedParams;
      setIsInitialized(true);
      return;
    }

    setDraft(storedDraft);
    setHasDraft(true);
    lastSavedRef.current = JSON.stringify(storedDraft.params ?? {});
    restoreLockRef.current = true;
    onRestoreRef.current?.(storedDraft.params as TParams);
    toast.success('已恢复上次草稿');
    window.setTimeout(() => {
      restoreLockRef.current = false;
    }, 0);
    setIsInitialized(true);
  }, [enabled, pipeline, projectId]);

  const clearDraft = useCallback(async () => {
    if (!projectId || !hasDraftStoreSupport()) {
      setDraft(null);
      setHasDraft(false);
      lastSavedRef.current = serializedParams;
      return;
    }

    await clearStoredDraft(projectId, pipeline);
    setDraft(null);
    setHasDraft(false);
    lastSavedRef.current = serializedParams;
  }, [pipeline, projectId, serializedParams]);

  const saveDraft = useCallback(async () => {
    if (!enabled || !projectId || !hasDraftStoreSupport()) {
      return;
    }

    const nextDraft = await persistDraft(projectId, pipeline, params);
    if (!nextDraft) {
      return;
    }

    setDraft(nextDraft);
    setHasDraft(true);
    lastSavedRef.current = serializedParams;
  }, [enabled, params, pipeline, projectId, serializedParams]);

  useEffect(() => {
    void restoreDraft();
  }, [restoreDraft]);

  useEffect(() => {
    if (!isInitialized || !enabled || !projectId || !hasDraftStoreSupport()) {
      return;
    }

    if (restoreLockRef.current || lastSavedRef.current === serializedParams) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveDraft();
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [debounceMs, enabled, isInitialized, projectId, saveDraft, serializedParams]);

  return {
    clearDraft,
    draft,
    hasDraft,
    restoreDraft,
    saveDraft,
  };
}
