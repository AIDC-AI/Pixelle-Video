import { beforeEach, describe, expect, it } from 'vitest';
import type { components } from '@/types/api';

import {
  batchPipelineLabel,
  batchStatusClassName,
  batchStatusLabel,
  buildBatchDefaultName,
  buildBatchTemplateCsv,
  getBatchChildProgressMessage,
  getBatchChildProgressPercent,
  getBatchFinishedCount,
  getBatchProgressPercent,
  getBatchRequestFields,
  isTerminalBatchStatus,
  PIPELINE_METADATA,
} from './batch-utils';

type Task = components['schemas']['Task'];

function buildTask(overrides: Partial<Task>): Task {
  return {
    task_id: 'task-1',
    task_type: 'video_generation',
    status: 'pending',
    progress: null,
    result: null,
    error: null,
    created_at: '2026-04-22T00:00:00Z',
    started_at: null,
    completed_at: null,
    request_params: null,
    project_id: null,
    ...overrides,
  };
}

describe('batch-utils', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  it('formats batch progress as finished over total', () => {
    expect(
      getBatchProgressPercent({
        total: 10,
        succeeded: 6,
        failed: 1,
        cancelled: 1,
      })
    ).toBe(80);
  });

  it('builds a deterministic default batch name', () => {
    expect(buildBatchDefaultName(new Date(2026, 3, 22, 3, 4, 5))).toBe('批处理-20260422-030405');
  });

  it('exposes pipeline labels from metadata and falls back for unknown pipelines', () => {
    expect(batchPipelineLabel('digital_human')).toBe('数字人');
    expect(batchPipelineLabel('quick')).toBe('快速创作');
    expect(PIPELINE_METADATA.asset_based.slug).toBe('custom');
    expect(batchPipelineLabel('legacy')).toBe('legacy');
  });

  it('localizes pipeline aliases and field labels for zh-CN', () => {
    expect(batchPipelineLabel('quick')).toBe('快速创作');
    expect(batchPipelineLabel('custom')).toBe('自定义资产');
    expect(buildBatchDefaultName(new Date(2026, 3, 22, 3, 4, 5))).toBe('批处理-20260422-030405');
    expect(getBatchRequestFields('standard').find((field) => field.key === 'tts_workflow')?.label).toBe('配音方案');
    expect(getBatchRequestFields('standard').find((field) => field.key === 'bgm_mode')?.label).toBe('背景音乐来源');
  });

  it('maps batch statuses to labels and classes', () => {
    expect(batchStatusLabel('pending')).toBe('排队中');
    expect(batchStatusLabel('running')).toBe('运行中');
    expect(batchStatusLabel('completed')).toBe('已完成');
    expect(batchStatusLabel('failed')).toBe('失败');
    expect(batchStatusLabel('cancelled')).toBe('已取消');
    expect(batchStatusLabel('partial')).toBe('部分完成');
    expect(batchStatusLabel('mystery')).toBe('未知');
    expect(batchStatusClassName('pending')).toContain('bg-[hsl(220,10%,38%)]');
    expect(batchStatusClassName('running')).toContain('bg-[hsl(215,95%,55%)]');
    expect(batchStatusClassName('completed')).toContain('bg-[hsl(145,70%,40%)]');
    expect(batchStatusClassName('failed')).toContain('bg-[hsl(3,80%,56%)]');
    expect(batchStatusClassName('cancelled')).toContain('bg-[hsl(32,85%,52%)]');
    expect(batchStatusClassName('partial')).toContain('bg-[hsl(48,95%,48%)]');
    expect(batchStatusClassName('mystery')).toContain('bg-muted');
  });

  it('identifies terminal statuses and computes finished counts', () => {
    expect(isTerminalBatchStatus('completed')).toBe(true);
    expect(isTerminalBatchStatus('failed')).toBe(true);
    expect(isTerminalBatchStatus('cancelled')).toBe(true);
    expect(isTerminalBatchStatus('partial')).toBe(true);
    expect(isTerminalBatchStatus('running')).toBe(false);
    expect(getBatchFinishedCount({ succeeded: 2, failed: 1, cancelled: 3 })).toBe(6);
    expect(getBatchProgressPercent({ total: 0, succeeded: 0, failed: 0, cancelled: 0 })).toBe(0);
  });

  it('builds a csv template with escaped values and 5 template rows', () => {
    const csv = buildBatchTemplateCsv('i2v');
    expect(csv).toContain('source_image,motion_prompt,media_workflow');
    expect(csv).toContain('https://example.com/source.png');

    const customCsv = buildBatchTemplateCsv('asset_based');
    expect(customCsv.split('\n')).toHaveLength(5);
    expect(customCsv).toContain('"[{""media"":""https://example.com/scene-1.png""');
  });

  it('derives child progress message and percent from task state', () => {
    expect(getBatchChildProgressMessage(buildTask({
      status: 'running',
      progress: { current: 20, total: 100, percentage: 20, message: 'Uploading' },
    }))).toBe('Uploading');
    expect(getBatchChildProgressMessage(buildTask({
      status: 'failed',
      progress: null,
    }))).toBe('失败');
    expect(getBatchChildProgressPercent(buildTask({
      status: 'running',
      progress: { current: 50, total: 100, percentage: 50, message: 'Halfway' },
    }))).toBe(50);
    expect(getBatchChildProgressPercent(buildTask({
      status: 'completed',
      progress: null,
    }))).toBe(100);
    expect(getBatchChildProgressPercent(buildTask({
      status: 'pending',
      progress: null,
    }))).toBe(0);
  });
});
