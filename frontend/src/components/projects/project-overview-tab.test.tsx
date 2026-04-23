import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axe } from '@/tests/setup-axe';
import { buildProject, buildTask, buildVideoItem } from '@/tests/msw/handlers';
import { ProjectOverviewTab } from './project-overview-tab';

describe('ProjectOverviewTab', () => {
  it('renders summary cards, recent sections, and continue link', async () => {
    const overview = {
      project: buildProject('project-1', 'Launch Campaign', { pipeline_hint: 'quick' }),
      stats: {
        batch_count: 1,
        task_count: 2,
        pending_task_count: 0,
        running_task_count: 0,
        completed_task_count: 2,
        failed_task_count: 0,
        cancelled_task_count: 0,
        video_count: 1,
        image_count: 0,
        voice_count: 0,
        bgm_count: 0,
        script_count: 0,
      },
      recent: {
        batches: [],
        tasks: [buildTask('task-1', 'completed')],
        videos: [buildVideoItem('task-1', { title: 'Library Video' })],
        images: [],
        voices: [],
        bgm: [],
        scripts: [],
      },
    };
    const { container } = render(<ProjectOverviewTab overview={overview} continueHref="/create/quick" />);

    expect(screen.getByText('最近批处理')).toBeInTheDocument();
    expect(screen.getByText('最近任务')).toBeInTheDocument();
    expect(screen.getByText('最近视频')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '继续创作' })).toHaveAttribute('href', '/create/quick');
    expect(await axe(container)).toHaveNoViolations();
  });
});
