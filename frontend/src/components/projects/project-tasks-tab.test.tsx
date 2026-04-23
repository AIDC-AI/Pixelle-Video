import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { axe } from '@/tests/setup-axe';
import { ProjectTasksTab } from './project-tasks-tab';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ProjectTasksTab', () => {
  it('renders project tasks for the given project', async () => {
    const { container } = render(<ProjectTasksTab projectId="project-1" />, { wrapper: createWrapper() });

    expect(await screen.findByText('task-library-video-1')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders an empty state when the project has no tasks', async () => {
    render(<ProjectTasksTab projectId="project-missing" />, { wrapper: createWrapper() });

    expect(await screen.findByText('该项目还没有任务')).toBeInTheDocument();
  });
});
