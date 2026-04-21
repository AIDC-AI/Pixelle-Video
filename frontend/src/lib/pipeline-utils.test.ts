import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildRegenerateHref,
  buildResumeHref,
  formatDurationClock,
  formatFileSize,
  formatRelativeTime,
  getTaskResult,
  inferPipeline,
  isTerminalTaskStatus,
  normalizeProjectFilterValue,
  projectFilterLabel,
  statusBadgeClassName,
  statusLabel,
  toProjectFilterQuery,
} from './pipeline-utils';
import { buildTask } from '@/tests/msw/handlers';

describe('pipeline-utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes project filters and labels', () => {
    expect(normalizeProjectFilterValue('project-1', 'project-2')).toBe('project-1');
    expect(normalizeProjectFilterValue('', 'project-2')).toBe('project-2');
    expect(normalizeProjectFilterValue(null, null)).toBe('all');
    expect(toProjectFilterQuery('all')).toBeUndefined();
    expect(toProjectFilterQuery('__unassigned__')).toBe('__unassigned__');
    expect(projectFilterLabel('all', [])).toBe('All Projects');
    expect(projectFilterLabel('__unassigned__', [])).toBe('Unassigned');
    expect(projectFilterLabel('project-1', [{ id: 'project-1', name: 'Launch Campaign' }])).toBe('Launch Campaign');
  });

  it('formats relative time, duration, and file size', () => {
    expect(formatRelativeTime('2026-04-22T11:59:30Z')).toBe('Just now');
    expect(formatRelativeTime('2026-04-22T11:30:00Z')).toBe('30m ago');
    expect(formatRelativeTime('2026-04-22T09:00:00Z')).toBe('3h ago');
    expect(formatRelativeTime(undefined)).toBe('Unknown time');
    expect(formatDurationClock(15)).toBe('00:15');
    expect(formatDurationClock(90)).toBe('01:30');
    expect(formatDurationClock(undefined)).toBe('00:00');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatFileSize(undefined)).toBe('—');
  });

  it('maps status labels, badge classes, and terminal states', () => {
    expect(statusLabel('pending')).toBe('Pending');
    expect(statusLabel('running')).toBe('Running');
    expect(statusLabel('completed')).toBe('Completed');
    expect(statusLabel('failed')).toBe('Failed');
    expect(statusLabel('cancelled')).toBe('Cancelled');
    expect(statusLabel('unknown')).toBe('Unknown');
    expect(statusBadgeClassName('pending')).toContain('bg-[hsl(220,10%,38%)]');
    expect(statusBadgeClassName('running')).toContain('bg-[hsl(215,95%,55%)]');
    expect(statusBadgeClassName('completed')).toContain('bg-[hsl(145,70%,40%)]');
    expect(statusBadgeClassName('failed')).toContain('bg-[hsl(3,80%,56%)]');
    expect(statusBadgeClassName('cancelled')).toContain('bg-[hsl(32,85%,52%)]');
    expect(statusBadgeClassName('unknown')).toContain('bg-muted');
    expect(isTerminalTaskStatus('completed')).toBe(true);
    expect(isTerminalTaskStatus('cancelled')).toBe(true);
    expect(isTerminalTaskStatus('running')).toBe(false);
    expect(isTerminalTaskStatus(undefined)).toBe(false);
  });

  it('infers pipeline metadata and regenerate URLs from task request params', () => {
    const quickTask = buildTask('task-quick', 'completed', {
      request_params: {
        title: 'Quick Title',
        text: 'Quick Topic',
        mode: 'generate',
        media_workflow: 'selfhost/media.json',
        tts_workflow: 'selfhost/tts.json',
        bgm_path: '/bgm/theme.mp3',
      },
    });
    const digitalHumanTask = buildTask('task-dh', 'completed', {
      request_params: {
        portrait_url: '/portrait.png',
        narration: 'Narration',
        voice_workflow: 'selfhost/voice.json',
      },
    });
    const i2vTask = buildTask('task-i2v', 'completed', {
      request_params: {
        source_image: '/source.png',
        motion_prompt: 'Animate this',
        media_workflow: 'selfhost/media.json',
      },
    });
    const actionTransferTask = buildTask('task-action', 'completed', {
      request_params: {
        driver_video: '/driver.mp4',
        target_image: '/target.png',
        pose_workflow: 'selfhost/pose.json',
      },
    });
    const customTask = buildTask('task-custom', 'completed', {
      request_params: {
        scenes: [{ media: '/scene.png', narration: 'Scene', duration: 5 }],
      },
    });

    expect(inferPipeline(quickTask)).toMatchObject({ slug: 'quick', label: 'Quick' });
    expect(inferPipeline(digitalHumanTask)).toMatchObject({ slug: 'digital-human' });
    expect(inferPipeline(i2vTask)).toMatchObject({ slug: 'i2v' });
    expect(inferPipeline(actionTransferTask)).toMatchObject({ slug: 'action-transfer' });
    expect(inferPipeline(customTask)).toMatchObject({ slug: 'custom' });

    expect(buildRegenerateHref(quickTask)).toContain('/create/quick?');
    expect(buildRegenerateHref(digitalHumanTask)).toContain('/create/digital-human?');
    expect(buildRegenerateHref(i2vTask)).toContain('/create/i2v?');
    expect(buildRegenerateHref(actionTransferTask)).toContain('/create/action-transfer?');
    expect(buildRegenerateHref(customTask)).toContain('/create/custom?');
    expect(buildResumeHref(quickTask)).toBe('/create/quick?task_id=task-quick');
    expect(buildRegenerateHref(buildTask('task-empty', 'failed', { request_params: null }))).toBe('/create/quick');
  });

  it('extracts typed task results when a video payload exists', () => {
    const task = buildTask('task-result', 'completed', {
      result: {
        video_url: 'http://localhost:8000/api/files/output/task-result/final.mp4',
        video_path: '/output/task-result/final.mp4',
        duration: 12.5,
        file_size: 1024,
      },
    });

    expect(getTaskResult(task)).toEqual({
      video_url: 'http://localhost:8000/api/files/output/task-result/final.mp4',
      video_path: '/output/task-result/final.mp4',
      duration: 12.5,
      file_size: 1024,
    });
    expect(getTaskResult(buildTask('task-empty', 'failed', { result: null }))).toBeNull();
  });
});
