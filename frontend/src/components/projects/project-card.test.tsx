import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { axe } from '@/tests/setup-axe';
import { buildProject } from '@/tests/msw/handlers';
import { ProjectCard } from './project-card';

describe('ProjectCard', () => {
  it('renders project metadata and exposes edit/delete actions', async () => {
    const user = userEvent.setup();
    const rename = vi.fn();
    const remove = vi.fn();
    const project = buildProject('project-1', 'Launch Campaign', {
      pipeline_hint: 'quick',
      task_count: 3,
    });
    const { container } = render(
      <ProjectCard project={project} isCurrent onRename={rename} onDelete={remove} />
    );

    expect(screen.getByText('Launch Campaign')).toBeInTheDocument();
    expect(screen.getByText('当前项目')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '编辑' }));
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(rename).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });
});
