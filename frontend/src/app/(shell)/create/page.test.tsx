import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CreateHeroPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('Create Hero Page', () => {
  it('renders hero title and description', () => {
    render(<CreateHeroPage />);
    expect(screen.getByRole('heading', { name: /你想创作什么视频？/i })).toBeInTheDocument();
  });

  it('renders quick intent input', () => {
    render(<CreateHeroPage />);
    expect(screen.getByPlaceholderText(/描述你的创意/i)).toBeInTheDocument();
  });

  it('renders 5 pipeline cards', () => {
    render(<CreateHeroPage />);
    expect(screen.getByText('Quick')).toBeInTheDocument();
    expect(screen.getByText('Digital Human')).toBeInTheDocument();
    expect(screen.getByText('Image → Video')).toBeInTheDocument();
    expect(screen.getByText('Action Transfer')).toBeInTheDocument();
    expect(screen.getByText('Custom Asset')).toBeInTheDocument();
  });
});
