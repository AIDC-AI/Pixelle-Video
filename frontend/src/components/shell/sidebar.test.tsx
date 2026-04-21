/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './sidebar';
import { usePathname } from 'next/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className, title }: any) => (
    <a href={href} className={className} title={title}>{children}</a>
  ),
}));

describe('Sidebar', () => {
  it('renders 5 groups', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<Sidebar />);
    expect(screen.getByText('Quick')).toBeInTheDocument();
    expect(screen.getByText('All Batches')).toBeInTheDocument();
    expect(screen.getByText('Videos')).toBeInTheDocument();
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    expect(screen.getByText('API Keys')).toBeInTheDocument();
  });

  it('highlights active link exactly', () => {
    vi.mocked(usePathname).mockReturnValue('/create/quick');
    render(<Sidebar />);
    const activeLink = screen.getByText('Quick').closest('a');
    expect(activeLink?.className).toContain('bg-accent');
  });

  it('highlights active link by longest prefix (batch)', () => {
    vi.mocked(usePathname).mockReturnValue('/batch/abc123');
    render(<Sidebar />);
    const activeLink = screen.getByText('Batches').closest('a');
    expect(activeLink?.className).toContain('bg-accent');
  });

  it('highlights active link by longest prefix (library)', () => {
    vi.mocked(usePathname).mockReturnValue('/library/videos/xyz');
    render(<Sidebar />);
    const activeLink = screen.getByText('Videos').closest('a');
    expect(activeLink?.className).toContain('bg-accent');
  });

  it('can collapse', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<Sidebar />);
    const collapseBtn = screen.getByTitle('Collapse sidebar');
    fireEvent.click(collapseBtn);
    expect(screen.queryByText('Create')).not.toBeInTheDocument();
  });
});
