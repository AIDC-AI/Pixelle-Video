import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './page';
import { renderWithQueryClient } from '@/tests/pipeline-page-test-utils';

describe('UsageSettingsPage', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  it('renders usage metrics and switches period', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<Page />);

    expect(await screen.findByRole('heading', { name: 'Usage' })).toBeInTheDocument();
    expect(await screen.findByText('API calls')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'This month' }));
    await waitFor(() => expect(screen.getByText('756')).toBeInTheDocument());
  });

  it('exports usage CSV', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:usage');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return {
          click,
          set download(value: string) {},
          set href(value: string) {},
        } as unknown as HTMLAnchorElement;
      }

      return originalCreateElement(tagName);
    });

    renderWithQueryClient(<Page />);
    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

    expect(click).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:usage');

    createElement.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});
