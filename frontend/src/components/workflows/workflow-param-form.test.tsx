import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  extractWorkflowInputSchema,
  normalizeWorkflowParamSchema,
  WorkflowParamForm,
} from './workflow-param-form';

describe('WorkflowParamForm', () => {
  it('normalizes schema fields', () => {
    expect(
      normalizeWorkflowParamSchema({
        properties: {
          prompt: { type: 'string', title: 'Prompt' },
          steps: { type: 'number' },
          mode: { enum: ['fast', 'quality'] },
          enabled: { type: 'boolean' },
        },
      })
    ).toEqual([
      { key: 'prompt', label: 'Prompt', type: 'string' },
      { key: 'steps', label: 'steps', type: 'number' },
      { enumValues: ['fast', 'quality'], key: 'mode', label: 'mode', type: 'enum' },
      { key: 'enabled', label: 'enabled', type: 'boolean' },
    ]);
  });

  it('extracts inputs from workflow nodes', () => {
    expect(
      extractWorkflowInputSchema({
        '1': { class_type: 'LoadImage', inputs: { image: 'sample.png' } },
      })
    ).toEqual({ image: 'sample.png' });
  });

  it('emits updated values for generated controls', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <WorkflowParamForm
        schema={{ prompt: { type: 'string' }, steps: { type: 'number' }, enabled: { type: 'boolean' } }}
        values={{ prompt: 'old', steps: 4, enabled: false }}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByDisplayValue('old'), { target: { value: 'new' } });
    expect(onChange).toHaveBeenLastCalledWith({ prompt: 'new', steps: 4, enabled: false });

    await user.click(screen.getByRole('switch', { name: /enabled/i }));
    expect(onChange).toHaveBeenLastCalledWith({ prompt: 'old', steps: 4, enabled: true });
  });
});
