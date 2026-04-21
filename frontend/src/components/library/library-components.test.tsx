import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LibraryFilterBar } from './library-filter-bar';
import { LibraryTable } from './library-table';

describe('Library shared components', () => {
  it('renders the shared filter bar with project options and extra controls', () => {
    render(
      <LibraryFilterBar
        title="Images"
        description="Browse"
        projectFilter="project-1"
        projects={[{ id: 'project-1', name: 'Launch', created_at: '', updated_at: '', task_count: 0 } as never]}
        selectId="test-project-filter"
        onProjectFilterChange={vi.fn()}
      >
        <div>Extra filters</div>
      </LibraryFilterBar>
    );

    expect(screen.getByRole('heading', { name: 'Images' })).toBeInTheDocument();
    expect(screen.getByText('Extra filters')).toBeInTheDocument();
  });

  it('renders the table header and body slots', () => {
    render(
      <LibraryTable
        gridClassName="grid grid-cols-2"
        columns={['Name', 'Actions']}
        body={<div className="grid grid-cols-2 px-4 py-3"><span>Row</span><span>Open</span></div>}
      />
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Row')).toBeInTheDocument();
  });
});
