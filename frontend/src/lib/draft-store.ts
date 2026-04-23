'use client';

import Dexie, { type Table } from 'dexie';

export type DraftPipeline = 'quick' | 'digital-human' | 'i2v' | 'action-transfer' | 'custom';

export interface DraftRecord {
  id: string;
  project_id: string;
  pipeline: DraftPipeline;
  params: Record<string, unknown>;
  updated_at: string;
}

class DraftDatabase extends Dexie {
  drafts!: Table<DraftRecord, string>;

  constructor() {
    super('pixelle-drafts');
    this.version(1).stores({
      drafts: 'id, project_id, pipeline, updated_at',
    });
  }
}

let draftDb: DraftDatabase | null = null;

export function hasDraftStoreSupport(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function getDraftId(projectId: string, pipeline: DraftPipeline): string {
  return `${projectId}:${pipeline}`;
}

export function getDraftDatabase(): DraftDatabase | null {
  if (!hasDraftStoreSupport()) {
    return null;
  }

  if (!draftDb) {
    draftDb = new DraftDatabase();
  }

  return draftDb;
}

export async function loadDraft(projectId: string, pipeline: DraftPipeline): Promise<DraftRecord | null> {
  const db = getDraftDatabase();
  if (!db) {
    return null;
  }

  return (await db.drafts.get(getDraftId(projectId, pipeline))) ?? null;
}

export async function saveDraft(
  projectId: string,
  pipeline: DraftPipeline,
  params: Record<string, unknown>
): Promise<DraftRecord | null> {
  const db = getDraftDatabase();
  if (!db) {
    return null;
  }

  const draft: DraftRecord = {
    id: getDraftId(projectId, pipeline),
    project_id: projectId,
    pipeline,
    params,
    updated_at: new Date().toISOString(),
  };

  await db.drafts.put(draft);
  return draft;
}

export async function clearDraft(projectId: string, pipeline: DraftPipeline): Promise<void> {
  const db = getDraftDatabase();
  if (!db) {
    return;
  }

  await db.drafts.delete(getDraftId(projectId, pipeline));
}

export async function cleanupStaleDrafts(now = new Date()): Promise<number> {
  const db = getDraftDatabase();
  if (!db) {
    return 0;
  }

  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const staleIds = await db.drafts.where('updated_at').below(cutoff).primaryKeys();

  if (staleIds.length === 0) {
    return 0;
  }

  await db.drafts.bulkDelete(staleIds as string[]);
  return staleIds.length;
}

export async function resetDraftStore(): Promise<void> {
  const db = getDraftDatabase();
  if (!db) {
    return;
  }

  await db.drafts.clear();
}
