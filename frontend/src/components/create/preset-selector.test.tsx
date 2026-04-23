import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PresetSelector } from '@/components/create/preset-selector';

vi.mock('@/lib/hooks/use-resources', () => ({
  useCreatePreset: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  usePresets: () => ({
    data: {
      presets: [
        {
          name: 'Launch preset',
          pipeline: 'standard',
          payload_template: {
            title: 'Preset title',
            text: 'Preset topic',
          },
        },
      ],
    },
  }),
}));

describe('PresetSelector', () => {
  it('filters presets by pipeline and applies mapped params', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const onApply = vi.fn();

    render(
      <PresetSelector
        pipeline="quick"
        currentParams={{ title: '', topic: '' }}
        savePayload={{ title: '' }}
        mapPresetToParams={(payload) => ({
          title: payload.title,
          topic: payload.text,
        })}
        onApply={onApply}
      />
    );

    await user.click(screen.getByRole('combobox', { name: '选择预设' }));
    await user.click(await screen.findByText('Launch preset'));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(
        { title: 'Preset title', topic: 'Preset topic' },
        ['title', 'topic']
      );
    });
  });
});
