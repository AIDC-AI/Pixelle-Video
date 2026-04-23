import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { buildTemplateWorkflowPayload, SaveAsTemplateDialog } from './save-as-template-dialog';

describe('SaveAsTemplateDialog', () => {
  it('builds template metadata inside workflow JSON', () => {
    expect(
      buildTemplateWorkflowPayload({
        description: 'Reusable',
        name: 'Launch template',
        parameters: ['prompt'],
        workflowJson: { metadata: { owner: 'local' }, '1': { class_type: 'LoadImage' } },
      })
    ).toMatchObject({
      metadata: {
        exposed_parameters: ['prompt'],
        is_template: true,
        owner: 'local',
        template_description: 'Reusable',
        template_name: 'Launch template',
      },
    });
  });

  it('opens the dialog and saves selected parameters', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <SaveAsTemplateDialog
        workflowName="Media"
        workflowJson={{}}
        parameters={['loader', 'sampler']}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Save as Template' }));
    await user.click(screen.getByLabelText('sampler'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          exposed_parameters: ['loader'],
          is_template: true,
        }),
      })
    );
  });
});
