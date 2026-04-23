import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickIntentInput } from './quick-intent-input';
import { AppIntlProvider } from '@/lib/i18n';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('QuickIntentInput', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  it('renders input and button', () => {
    render(
      <AppIntlProvider>
        <QuickIntentInput />
      </AppIntlProvider>
    );
    expect(screen.getByPlaceholderText(/描述你的创意/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /生成/i })).toBeInTheDocument();
  });

  it('disables button when empty', () => {
    render(
      <AppIntlProvider>
        <QuickIntentInput />
      </AppIntlProvider>
    );
    const btn = screen.getByRole('button', { name: /生成/i });
    expect(btn).toBeDisabled();
  });

  it('navigates with url encoded topic on submit', () => {
    render(
      <AppIntlProvider>
        <QuickIntentInput />
      </AppIntlProvider>
    );
    const input = screen.getByPlaceholderText(/描述你的创意/i);
    const btn = screen.getByRole('button', { name: /生成/i });

    fireEvent.change(input, { target: { value: 'test topic 123' } });
    expect(btn).not.toBeDisabled();
    
    fireEvent.click(btn);
    expect(mockPush).toHaveBeenCalledWith('/create/quick?topic=test%20topic%20123');
  });

  it('does not navigate on empty submit', () => {
    mockPush.mockClear();
    render(
      <AppIntlProvider>
        <QuickIntentInput />
      </AppIntlProvider>
    );
    const form = screen.getByRole('button', { name: /生成/i }).closest('form');
    fireEvent.submit(form!);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('submits on Enter key from the input', async () => {
    const user = userEvent.setup();
    mockPush.mockClear();
    render(
      <AppIntlProvider>
        <QuickIntentInput />
      </AppIntlProvider>
    );

    const input = screen.getByPlaceholderText(/描述你的创意/i);
    await user.type(input, 'planet explainer{enter}');

    expect(mockPush).toHaveBeenCalledWith('/create/quick?topic=planet%20explainer');
  });

  it('renders a compact workbench input', () => {
    render(
      <AppIntlProvider>
        <QuickIntentInput variant="compact" />
      </AppIntlProvider>
    );

    expect(screen.getByPlaceholderText(/描述你的创意/i)).toHaveClass('h-10');
    expect(screen.getByRole('button', { name: /生成/i })).toHaveClass('h-7');
  });
});
