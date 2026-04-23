import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupStaleDrafts,
  getDraftDatabase,
  getDraftId,
  loadDraft,
  resetDraftStore,
  saveDraft,
} from '@/lib/draft-store';

describe('draft-store', () => {
  afterEach(async () => {
    await resetDraftStore();
  });

  it('saves and loads a draft by project and pipeline', async () => {
    await saveDraft('project-1', 'quick', { title: 'Launch clip' });

    const draft = await loadDraft('project-1', 'quick');

    expect(draft?.params).toEqual({ title: 'Launch clip' });
    expect(draft?.id).toBe(getDraftId('project-1', 'quick'));
  });

  it('cleans up drafts older than seven days', async () => {
    const db = getDraftDatabase();
    expect(db).not.toBeNull();

    await db!.drafts.put({
      id: 'project-1:quick',
      pipeline: 'quick',
      project_id: 'project-1',
      params: { title: 'Stale draft' },
      updated_at: '2026-04-01T00:00:00.000Z',
    });

    const deleted = await cleanupStaleDrafts(new Date('2026-04-10T00:00:00.000Z'));

    expect(deleted).toBe(1);
    expect(await loadDraft('project-1', 'quick')).toBeNull();
  });
});
