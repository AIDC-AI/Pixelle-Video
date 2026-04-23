import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PresetSaveDialog } from '@/components/create/preset-save-dialog';

const mutateAsync = vi.fn().mockResolvedValue({});

vi.mock('@/lib/hooks/use-resources', () => ({
  useCreatePreset: () => ({
    isPending: false,
    mutateAsync,
  }),
}));

describe('PresetSaveDialog', () => {
  it('saves the current payload using the preset resource endpoint', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <PresetSaveDialog
        open
        onOpenChange={onOpenChange}
        pipeline="quick"
        currentParams={{ title: 'Launch clip' }}
      />
    );

    await user.type(screen.getByLabelText('预设名称'), 'Launch preset');
    await user.click(screen.getByRole('button', { name: '保存预设' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        description: null,
        name: 'Launch preset',
        payload_template: { title: 'Launch clip' },
        pipeline: 'standard',
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
