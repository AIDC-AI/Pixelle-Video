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
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Batch')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('highlights active link', () => {
    vi.mocked(usePathname).mockReturnValue('/create/quick');
    render(<Sidebar />);
    const activeLink = screen.getByText('Quick Create').closest('a');
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
