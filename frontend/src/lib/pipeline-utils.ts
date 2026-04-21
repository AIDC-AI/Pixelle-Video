import type { components } from '@/types/api';

type Task = components['schemas']['Task'];
type TaskStatus = components['schemas']['TaskStatus'];

type PipelineSlug = 'quick' | 'digital-human' | 'i2v' | 'action-transfer' | 'custom';

type PipelineDescriptor = {
  label: string;
  slug: PipelineSlug;
};

type RequestParamsRecord = Record<string, unknown>;

const PIPELINES: Record<PipelineSlug, PipelineDescriptor> = {
  quick: { slug: 'quick', label: 'Quick' },
  'digital-human': { slug: 'digital-human', label: 'Digital Human' },
  i2v: { slug: 'i2v', label: 'Image → Video' },
  'action-transfer': { slug: 'action-transfer', label: 'Action Transfer' },
  custom: { slug: 'custom', label: 'Custom Asset' },
};

const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ['completed', 'failed', 'cancelled'];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isTerminalTaskStatus(status: TaskStatus | undefined | null): boolean {
  return status ? TERMINAL_TASK_STATUSES.includes(status) : false;
}

export function normalizeProjectFilterValue(
  value: string | null | undefined,
  fallbackProjectId?: string | null
): string {
  if (value && value.trim()) {
    return value;
  }

  if (fallbackProjectId && fallbackProjectId.trim()) {
    return fallbackProjectId;
  }

  return 'all';
}

export function toProjectFilterQuery(
  value: string | null | undefined
): string | undefined {
  if (!value || value === 'all') {
    return undefined;
  }

  return value;
}

export function projectFilterLabel(
  value: string,
  projects: Array<{ id: string; name: string }>
): string {
  if (value === 'all') {
    return 'All Projects';
  }

  if (value === '__unassigned__' || value === 'null') {
    return 'Unassigned';
  }

  return projects.find((project) => project.id === value)?.name ?? value;
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) {
    return 'Unknown time';
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (deltaSeconds < 60) {
    return 'Just now';
  }
  if (deltaSeconds < 3_600) {
    return `${Math.floor(deltaSeconds / 60)}m ago`;
  }
  if (deltaSeconds < 86_400) {
    return `${Math.floor(deltaSeconds / 3_600)}h ago`;
  }
  return `${Math.floor(deltaSeconds / 86_400)}d ago`;
}

export function formatDurationClock(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return '00:00';
  }

  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function formatFileSize(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return '—';
  }

  if (value < 1_024) {
    return `${value} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1_024;
  let unitIndex = 0;

  while (size >= 1_024 && unitIndex < units.length - 1) {
    size /= 1_024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function statusBadgeClassName(status: TaskStatus | 'unknown'): string {
  switch (status) {
    case 'pending':
      return 'border-transparent bg-[hsl(220,10%,38%)] text-white';
    case 'running':
      return 'border-transparent bg-[hsl(215,95%,55%)] text-white';
    case 'completed':
      return 'border-transparent bg-[hsl(145,70%,40%)] text-white';
    case 'failed':
      return 'border-transparent bg-[hsl(3,80%,56%)] text-white';
    case 'cancelled':
      return 'border-transparent bg-[hsl(32,85%,52%)] text-white';
    default:
      return 'border-border bg-muted text-foreground';
  }
}

export function statusLabel(status: TaskStatus | 'unknown'): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

function getRequestParams(task: Pick<Task, 'request_params'> | null | undefined): RequestParamsRecord | null {
  return isRecord(task?.request_params) ? task.request_params : null;
}

export function inferPipeline(task: Pick<Task, 'request_params'> | null | undefined): PipelineDescriptor {
  const params = getRequestParams(task);

  if (params) {
    if (Array.isArray(params.scenes)) {
      return PIPELINES.custom;
    }
    if (typeof params.portrait_url === 'string' && typeof params.narration === 'string') {
      return PIPELINES['digital-human'];
    }
    if (typeof params.driver_video === 'string' && typeof params.target_image === 'string') {
      return PIPELINES['action-transfer'];
    }
    if (typeof params.source_image === 'string' && typeof params.motion_prompt === 'string') {
      return PIPELINES.i2v;
    }
  }

  return PIPELINES.quick;
}

function appendOptionalSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: unknown
): void {
  if (typeof value === 'string' && value.trim()) {
    searchParams.set(key, value);
  }
}

export function buildRegenerateHref(task: Task): string {
  const pipeline = inferPipeline(task);
  const searchParams = new URLSearchParams();
  const params = getRequestParams(task);

  if (!params) {
    return `/create/${pipeline.slug}`;
  }

  switch (pipeline.slug) {
    case 'digital-human':
      appendOptionalSearchParam(searchParams, 'portrait_url', params.portrait_url);
      appendOptionalSearchParam(searchParams, 'narration', params.narration);
      appendOptionalSearchParam(searchParams, 'voice_workflow', params.voice_workflow);
      break;
    case 'i2v':
      appendOptionalSearchParam(searchParams, 'source_image', params.source_image);
      appendOptionalSearchParam(searchParams, 'motion_prompt', params.motion_prompt);
      appendOptionalSearchParam(searchParams, 'media_workflow', params.media_workflow);
      break;
    case 'action-transfer':
      appendOptionalSearchParam(searchParams, 'driver_video', params.driver_video);
      appendOptionalSearchParam(searchParams, 'target_image', params.target_image);
      appendOptionalSearchParam(searchParams, 'pose_workflow', params.pose_workflow);
      break;
    case 'custom':
      if (Array.isArray(params.scenes)) {
        searchParams.set('scenes', JSON.stringify(params.scenes));
      }
      break;
    case 'quick':
    default:
      appendOptionalSearchParam(searchParams, 'title', params.title);
      appendOptionalSearchParam(searchParams, 'topic', params.mode === 'generate' ? params.text : params.text);
      if (params.mode === 'fixed') {
        appendOptionalSearchParam(searchParams, 'narration', params.text);
      }
      appendOptionalSearchParam(searchParams, 'tts_workflow', params.tts_workflow);
      appendOptionalSearchParam(searchParams, 'media_workflow', params.media_workflow);
      appendOptionalSearchParam(searchParams, 'bgm_path', params.bgm_path);
      appendOptionalSearchParam(searchParams, 'prompt_prefix', params.prompt_prefix);
      break;
  }

  return searchParams.size > 0
    ? `/create/${pipeline.slug}?${searchParams.toString()}`
    : `/create/${pipeline.slug}`;
}

export function buildResumeHref(task: Task): string {
  const pipeline = inferPipeline(task);
  const searchParams = new URLSearchParams({ task_id: task.task_id });
  return `/create/${pipeline.slug}?${searchParams.toString()}`;
}

type VideoTaskResult = {
  duration?: number;
  file_size?: number;
  video_url?: string;
  video_path?: string;
};

export function getTaskResult(task: Pick<Task, 'result'> | null | undefined): VideoTaskResult | null {
  if (!isRecord(task?.result)) {
    return null;
  }

  const result = task.result;

  return {
    duration: typeof result.duration === 'number' ? result.duration : undefined,
    file_size: typeof result.file_size === 'number' ? result.file_size : undefined,
    video_url: typeof result.video_url === 'string' ? result.video_url : undefined,
    video_path: typeof result.video_path === 'string' ? result.video_path : undefined,
  };
}

