import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectRequiredDialog } from './project-required-dialog';
import { AppIntlProvider } from '@/lib/i18n';

const mockMutate = vi.fn();
const mockSetCurrentProject = vi.fn();

vi.mock('@/lib/hooks/use-projects', () => ({
  useCreateProject: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
}));

vi.mock('@/lib/hooks/use-current-project', () => ({
  useCurrentProjectHydration: vi.fn(() => ({
    setCurrentProject: mockSetCurrentProject,
  })),
}));

function renderDialog(onOpenChange = vi.fn<(open: boolean) => void>()) {
  return {
    onOpenChange,
    ...render(
      <AppIntlProvider>
        <ProjectRequiredDialog open onOpenChange={onOpenChange} />
      </AppIntlProvider>
    ),
  };
}

describe('ProjectRequiredDialog', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockMutate.mockReset();
    mockSetCurrentProject.mockReset();
  });

  it('renders the dialog title and description', () => {
    renderDialog();

    expect(screen.getByText('未选择项目')).toBeInTheDocument();
    expect(screen.getByText('这个流水线需要归属于某个项目。请先前往项目中心选择或创建项目，然后再试一次。')).toBeInTheDocument();
  });

  it('renders the input field for inline project creation', () => {
    renderDialog();

    expect(screen.getByPlaceholderText('项目名称')).toBeInTheDocument();
  });

  it('closes the dialog when clicking the close button', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: '关闭' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
