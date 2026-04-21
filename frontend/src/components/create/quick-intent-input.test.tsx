import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickIntentInput } from './quick-intent-input';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('QuickIntentInput', () => {
  it('renders input and button', () => {
    render(<QuickIntentInput />);
    expect(screen.getByPlaceholderText(/描述你的创意/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /生成/i })).toBeInTheDocument();
  });

  it('disables button when empty', () => {
    render(<QuickIntentInput />);
    const btn = screen.getByRole('button', { name: /生成/i });
    expect(btn).toBeDisabled();
  });

  it('navigates with url encoded topic on submit', () => {
    render(<QuickIntentInput />);
    const input = screen.getByPlaceholderText(/描述你的创意/i);
    const btn = screen.getByRole('button', { name: /生成/i });

    fireEvent.change(input, { target: { value: 'test topic 123' } });
    expect(btn).not.toBeDisabled();
    
    fireEvent.click(btn);
    expect(mockPush).toHaveBeenCalledWith('/create/quick?topic=test%20topic%20123');
  });

  it('does not navigate on empty submit', () => {
    mockPush.mockClear();
    render(<QuickIntentInput />);
    const form = screen.getByRole('button', { name: /生成/i }).closest('form');
    fireEvent.submit(form!);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('submits on Enter key from the input', async () => {
    const user = userEvent.setup();
    mockPush.mockClear();
    render(<QuickIntentInput />);

    const input = screen.getByPlaceholderText(/描述你的创意/i);
    await user.type(input, 'planet explainer{enter}');

    expect(mockPush).toHaveBeenCalledWith('/create/quick?topic=planet%20explainer');
  });
});
