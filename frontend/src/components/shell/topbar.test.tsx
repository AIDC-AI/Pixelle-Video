import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Topbar } from './topbar';
import { AppIntlProvider } from '@/lib/i18n';

const mockSetTheme = vi.fn();
let mockTheme: 'dark' | 'light' | undefined = 'dark';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

function renderTopbar() {
  return render(
    <AppIntlProvider>
      <Topbar />
    </AppIntlProvider>
  );
}

describe('Topbar', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    mockTheme = 'dark';
    mockSetTheme.mockReset();
  });

  it('renders the 天幕 brand logo text', () => {
    renderTopbar();

    expect(screen.getByText('天幕')).toBeInTheDocument();
  });

  it('renders the search button', () => {
    renderTopbar();

    expect(screen.getByText('搜索或输入命令...')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('toggles theme from dark to light', async () => {
    const user = userEvent.setup();
    renderTopbar();

    await user.click(screen.getByRole('button', { name: '切换主题' }));

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('renders the notification button', () => {
    renderTopbar();

    expect(screen.getByRole('button', { name: '通知' })).toBeInTheDocument();
  });

  it('renders the user menu button', () => {
    renderTopbar();

    expect(screen.getByRole('button', { name: '用户菜单' })).toBeInTheDocument();
  });
});
