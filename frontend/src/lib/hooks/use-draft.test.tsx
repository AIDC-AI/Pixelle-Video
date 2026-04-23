import 'fake-indexeddb/auto';

import React, { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { loadDraft, resetDraftStore } from '@/lib/draft-store';
import { useDraft } from '@/lib/hooks/use-draft';

function DraftHarness({ projectId = 'project-1' }: { projectId?: string }) {
  const [params, setParams] = useState({ title: 'Initial title' });
  const [restored, setRestored] = useState<string>('');

  const draft = useDraft('quick', projectId, {
    onRestore: (nextParams) => {
      const value = nextParams as { title?: string };
      setParams({ title: value.title ?? '' });
      setRestored(value.title ?? '');
    },
    params,
  });

  return (
    <div>
      <p data-testid="title">{params.title}</p>
      <p data-testid="restored">{restored}</p>
      <button type="button" onClick={() => setParams({ title: 'Updated title' })}>
        update
      </button>
      <button type="button" onClick={() => void draft.clearDraft()}>
        clear
      </button>
    </div>
  );
}

async function waitForDraftParams(expected: { title: string }, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const draft = await loadDraft('project-1', 'quick');
    if (draft?.params && JSON.stringify(draft.params) === JSON.stringify(expected)) {
      return draft;
    }

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });
  }

  return loadDraft('project-1', 'quick');
}

describe('useDraft', () => {
  afterEach(async () => {
    cleanup();
    await resetDraftStore();
  });

  it('persists params after the debounce window', async () => {
    const user = userEvent.setup();
    render(<DraftHarness />);

    await user.click(screen.getByRole('button', { name: 'update' }));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
    });

    await waitFor(() => {
      expect(screen.getByTestId('title')).toHaveTextContent('Updated title');
    });

    const draft = await waitForDraftParams({ title: 'Updated title' });

    expect(draft?.params).toEqual({ title: 'Updated title' });
  });

  it('restores the last saved draft on a new mount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DraftHarness />);

    await user.click(screen.getByRole('button', { name: 'update' }));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
    });

    const draft = await waitForDraftParams({ title: 'Updated title' });
    expect(draft?.params).toEqual({ title: 'Updated title' });

    unmount();
    render(<DraftHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('restored')).toHaveTextContent('Updated title');
      expect(screen.getByTestId('title')).toHaveTextContent('Updated title');
    });
  });
});
