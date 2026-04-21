import { http, HttpResponse } from 'msw';
import type { components, paths } from '@/types/api';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type AsyncVideoEndpoint =
  | '/api/video/generate/async'
  | '/api/video/digital-human/async'
  | '/api/video/i2v/async'
  | '/api/video/action-transfer/async'
  | '/api/video/custom/async';
type SubmitScenario = 'success' | 'http-502' | 'network-error';
type Task = paths['/api/tasks/{task_id}']['get']['responses'][200]['content']['application/json'];
type TaskStatus = components['schemas']['TaskStatus'];
type Project = components['schemas']['Project'];
type BatchDetailResponse = paths['/api/batch/{batch_id}']['get']['responses'][200]['content']['application/json'];
type BatchListResponse = paths['/api/batch']['get']['responses'][200]['content']['application/json'];
type BatchCreateRequest = paths['/api/batch']['post']['requestBody']['content']['application/json'];
type BatchCreateResponse = paths['/api/batch']['post']['responses'][201]['content']['application/json'];
type BatchDeleteResponse = paths['/api/batch/{batch_id}']['delete']['responses'][200]['content']['application/json'];
type ProjectListResponse = paths['/api/projects']['get']['responses'][200]['content']['application/json'];
type VideoItem = components['schemas']['VideoItem'];
type VideoListResponse = paths['/api/library/videos']['get']['responses'][200]['content']['application/json'];
type WorkflowListResponse =
  paths['/api/resources/workflows/tts']['get']['responses'][200]['content']['application/json'];
type BgmListResponse =
  paths['/api/resources/bgm']['get']['responses'][200]['content']['application/json'];
type UploadResponse = paths['/api/uploads']['post']['responses'][201]['content']['application/json'];
type ApiErrorResponse = components['schemas']['ApiErrorResponse'];
type BatchPipeline = components['schemas']['BatchPipeline'];
type BatchStatus = components['schemas']['BatchStatus'];

type SubmitRequestByEndpoint = {
  '/api/video/generate/async': paths['/api/video/generate/async']['post']['requestBody']['content']['application/json'];
  '/api/video/digital-human/async': paths['/api/video/digital-human/async']['post']['requestBody']['content']['application/json'];
  '/api/video/i2v/async': paths['/api/video/i2v/async']['post']['requestBody']['content']['application/json'];
  '/api/video/action-transfer/async': paths['/api/video/action-transfer/async']['post']['requestBody']['content']['application/json'];
  '/api/video/custom/async': paths['/api/video/custom/async']['post']['requestBody']['content']['application/json'];
};

type SubmitResponseByEndpoint = {
  '/api/video/generate/async': paths['/api/video/generate/async']['post']['responses'][200]['content']['application/json'];
  '/api/video/digital-human/async': paths['/api/video/digital-human/async']['post']['responses'][200]['content']['application/json'];
  '/api/video/i2v/async': paths['/api/video/i2v/async']['post']['responses'][200]['content']['application/json'];
  '/api/video/action-transfer/async': paths['/api/video/action-transfer/async']['post']['responses'][200]['content']['application/json'];
  '/api/video/custom/async': paths['/api/video/custom/async']['post']['responses'][200]['content']['application/json'];
};

interface TaskScenario {
  cancelledState?: Task;
  index: number;
  states: Task[];
}

interface StoredBatch {
  cover_url?: string | null;
  created_at: string;
  deleted_at?: string | null;
  id: string;
  name?: string | null;
  pipeline: BatchPipeline;
  project_id?: string | null;
  task_ids: string[];
  updated_at: string;
}

const DEFAULT_TIME = '2026-04-22T00:00:00Z';
const DEFAULT_SUCCESS_TASK_ID = 'task-success';
const DEFAULT_CANCELLED_TASK_ID = 'task-cancelled';
const DEFAULT_FAILURE_TASK_ID = 'task-failed';
const DEFAULT_LIBRARY_VIDEO_ID = 'task-library-video-1';

type LibraryVideoDetailMode =
  | { kind: 'success'; payload: unknown }
  | { kind: 'not-implemented' }
  | { kind: 'not-found' };

const ASYNC_VIDEO_ENDPOINTS: readonly AsyncVideoEndpoint[] = [
  '/api/video/generate/async',
  '/api/video/digital-human/async',
  '/api/video/i2v/async',
  '/api/video/action-transfer/async',
  '/api/video/custom/async',
];

const DEFAULT_SUBMIT_SCENARIOS: Record<AsyncVideoEndpoint, SubmitScenario> = {
  '/api/video/generate/async': 'success',
  '/api/video/digital-human/async': 'success',
  '/api/video/i2v/async': 'success',
  '/api/video/action-transfer/async': 'success',
  '/api/video/custom/async': 'success',
};

const DEFAULT_NEXT_TASK_IDS: Record<AsyncVideoEndpoint, string> = {
  '/api/video/generate/async': DEFAULT_SUCCESS_TASK_ID,
  '/api/video/digital-human/async': 'task-digital-human-success',
  '/api/video/i2v/async': 'task-i2v-success',
  '/api/video/action-transfer/async': 'task-action-transfer-success',
  '/api/video/custom/async': 'task-custom-success',
};

let submitScenarios: Record<AsyncVideoEndpoint, SubmitScenario> = { ...DEFAULT_SUBMIT_SCENARIOS };
let nextTaskIds: Record<AsyncVideoEndpoint, string> = { ...DEFAULT_NEXT_TASK_IDS };
const lastSubmitPayloads = new Map<AsyncVideoEndpoint, SubmitRequestByEndpoint[AsyncVideoEndpoint]>();
const taskScenarios = new Map<string, TaskScenario>();
const pollCounts = new Map<string, number>();
let projects: Project[] = [];
let libraryVideos: VideoItem[] = [];
let batches: StoredBatch[] = [];
const libraryVideoDetails = new Map<string, LibraryVideoDetailMode>();

const ttsWorkflowResponse: WorkflowListResponse = {
  success: true,
  message: 'Success',
  workflows: [
    {
      name: 'tts_edge.json',
      display_name: 'TTS 1',
      source: 'selfhost',
      path: '/workflows/tts/tts_edge.json',
      key: 'selfhost/tts_edge.json',
      workflow_id: null,
    },
  ],
};

const mediaWorkflowResponse: WorkflowListResponse = {
  success: true,
  message: 'Success',
  workflows: [
    {
      name: 'media_default.json',
      display_name: 'Media 1',
      source: 'selfhost',
      path: '/workflows/media/media_default.json',
      key: 'selfhost/media_default.json',
      workflow_id: null,
    },
    {
      name: 'pose_default.json',
      display_name: 'Pose 1',
      source: 'selfhost',
      path: '/workflows/media/pose_default.json',
      key: 'selfhost/pose_default.json',
      workflow_id: null,
    },
  ],
};

const imageWorkflowResponse: WorkflowListResponse = {
  success: true,
  message: 'Success',
  workflows: [
    {
      name: 'image_default.json',
      display_name: 'Image 1',
      source: 'selfhost',
      path: '/workflows/image/image_default.json',
      key: 'selfhost/image_default.json',
      workflow_id: null,
    },
  ],
};

const bgmListResponse: BgmListResponse = {
  success: true,
  message: 'Success',
  bgm_files: [
    {
      name: 'BGM 1',
      path: '/bgm/default/bgm-1.mp3',
      source: 'default',
    },
  ],
};

function cloneTask(task: Task): Task {
  return structuredClone(task);
}

function buildTask(taskId: string, status: TaskStatus, overrides: Partial<Task> = {}): Task {
  const progress = (() => {
    if (status === 'pending') {
      return { current: 0, total: 100, percentage: 0, message: 'Queued' };
    }
    if (status === 'running') {
      return { current: 50, total: 100, percentage: 50, message: 'Generating video' };
    }
    if (status === 'completed') {
      return { current: 100, total: 100, percentage: 100, message: 'Completed' };
    }
    if (status === 'cancelled') {
      return { current: 50, total: 100, percentage: 50, message: 'Cancelled' };
    }
    return { current: 50, total: 100, percentage: 50, message: 'Failed' };
  })();

  return {
    task_id: taskId,
    task_type: 'video_generation',
    project_id: 'project-1',
    status,
    progress,
    result:
      status === 'completed'
        ? {
            video_url: 'http://localhost:8000/api/files/output/video.mp4',
            video_path: '/output/video.mp4',
            duration: 12.5,
            file_size: 2 * 1024 * 1024,
          }
        : null,
    error: status === 'failed' ? 'Generation failed' : null,
    created_at: DEFAULT_TIME,
    started_at: DEFAULT_TIME,
    completed_at: status === 'pending' || status === 'running' ? null : DEFAULT_TIME,
    request_params: null,
    ...overrides,
  };
}

function getCurrentTaskState(taskId: string): Task | null {
  const scenario = taskScenarios.get(taskId);
  if (!scenario) {
    return null;
  }

  const stateIndex = Math.min(scenario.index, scenario.states.length - 1);
  return cloneTask(scenario.states[stateIndex]);
}

function deriveBatchStatus(children: Task[]): BatchStatus {
  if (children.length === 0) {
    return 'pending';
  }

  const counts = {
    cancelled: children.filter((task) => task.status === 'cancelled').length,
    completed: children.filter((task) => task.status === 'completed').length,
    failed: children.filter((task) => task.status === 'failed').length,
    pending: children.filter((task) => task.status === 'pending').length,
    running: children.filter((task) => task.status === 'running').length,
  };
  const terminalCount = counts.completed + counts.failed + counts.cancelled;

  if (counts.cancelled === children.length) {
    return 'cancelled';
  }
  if (counts.completed === children.length) {
    return 'completed';
  }
  if (counts.failed === children.length) {
    return 'failed';
  }
  if (terminalCount === children.length) {
    return 'partial';
  }
  if (counts.running > 0) {
    return 'running';
  }
  if (counts.pending > 0) {
    return 'pending';
  }
  return 'partial';
}

function hydrateBatch(batch: StoredBatch): BatchDetailResponse {
  const children = batch.task_ids.flatMap((taskId) => {
    const task = getCurrentTaskState(taskId);
    return task ? [task] : [];
  });

  return {
    id: batch.id,
    name: batch.name ?? null,
    pipeline: batch.pipeline,
    project_id: batch.project_id ?? null,
    status: deriveBatchStatus(children),
    total: batch.task_ids.length,
    succeeded: children.filter((task) => task.status === 'completed').length,
    failed: children.filter((task) => task.status === 'failed').length,
    cancelled: children.filter((task) => task.status === 'cancelled').length,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
    cover_url: batch.cover_url ?? null,
    deleted_at: batch.deleted_at ?? null,
    task_ids: [...batch.task_ids],
    children,
  };
}

function buildStoredBatch(batchId: string, overrides: Partial<StoredBatch> = {}): StoredBatch {
  return {
    id: batchId,
    name: `Batch ${batchId}`,
    pipeline: 'standard',
    project_id: 'project-1',
    created_at: DEFAULT_TIME,
    updated_at: DEFAULT_TIME,
    cover_url: null,
    deleted_at: null,
    task_ids: [DEFAULT_LIBRARY_VIDEO_ID],
    ...overrides,
  };
}

function defaultSuccessScenario(taskId: string): TaskScenario {
  return {
    states: [
      buildTask(taskId, 'pending'),
      buildTask(taskId, 'running'),
      buildTask(taskId, 'completed'),
    ],
    index: 0,
    cancelledState: buildTask(taskId, 'cancelled', {
      error: 'Task cancelled',
      result: null,
    }),
  };
}

function buildProject(id: string, name: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name,
    created_at: DEFAULT_TIME,
    updated_at: DEFAULT_TIME,
    cover_url: null,
    pipeline_hint: null,
    task_count: 1,
    last_task_id: null,
    deleted_at: null,
    ...overrides,
  };
}

function buildVideoItem(taskId: string, overrides: Partial<VideoItem> = {}): VideoItem {
  return {
    task_id: taskId,
    title: `Video ${taskId}`,
    created_at: DEFAULT_TIME,
    completed_at: DEFAULT_TIME,
    duration: 15,
    file_size: 5 * 1024 * 1024,
    n_frames: 8,
    video_path: `/output/${taskId}/final.mp4`,
    video_url: `${baseURL}/api/files/output/${taskId}/final.mp4`,
    thumbnail_url: `${baseURL}/api/files/output/${taskId}/thumb.jpg`,
    project_id: 'project-1',
    ...overrides,
  };
}

function buildLibraryVideoDetail(videoId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    task_id: videoId,
    project_id: 'project-1',
    title: 'Library Video',
    duration: 15,
    file_size: 5 * 1024 * 1024,
    n_frames: 8,
    created_at: DEFAULT_TIME,
    completed_at: DEFAULT_TIME,
    pipeline: 'quick',
    video_url: `${baseURL}/api/files/output/${videoId}/final.mp4`,
    video_path: `/output/${videoId}/final.mp4`,
    snapshot: {
      title: 'Library Video',
      text: 'A generated library video',
      media_workflow: 'selfhost/media_default.json',
      tts_workflow: 'selfhost/tts_edge.json',
    },
    ...overrides,
  };
}

function setDefaultTaskScenarios(): void {
  taskScenarios.clear();
  Object.values(DEFAULT_NEXT_TASK_IDS).forEach((taskId) => {
    taskScenarios.set(taskId, defaultSuccessScenario(taskId));
  });
  taskScenarios.set(
    DEFAULT_LIBRARY_VIDEO_ID,
    {
      states: [
        buildTask(DEFAULT_LIBRARY_VIDEO_ID, 'completed', {
          project_id: 'project-1',
          request_params: {
            title: 'Library Video',
            text: 'A generated library video',
            mode: 'generate',
            media_workflow: 'selfhost/media_default.json',
            tts_workflow: 'selfhost/tts_edge.json',
            project_id: 'project-1',
          },
          result: {
            video_url: `${baseURL}/api/files/output/${DEFAULT_LIBRARY_VIDEO_ID}/final.mp4`,
            video_path: `/output/${DEFAULT_LIBRARY_VIDEO_ID}/final.mp4`,
            duration: 15,
            file_size: 5 * 1024 * 1024,
          },
        }),
      ],
      index: 0,
      cancelledState: buildTask(DEFAULT_LIBRARY_VIDEO_ID, 'cancelled'),
    }
  );
  taskScenarios.set(
    'task-batch-running',
    {
      states: [
        buildTask('task-batch-running', 'running', {
          project_id: 'project-2',
          batch_id: 'batch-running',
          request_params: {
            source_image: 'https://example.com/source.png',
            motion_prompt: 'Subtle motion',
            media_workflow: 'selfhost/media_default.json',
            project_id: 'project-2',
          },
        }),
      ],
      index: 0,
      cancelledState: buildTask('task-batch-running', 'cancelled', {
        project_id: 'project-2',
        batch_id: 'batch-running',
      }),
    }
  );
}

function setDefaultProjects(): void {
  projects = [
    buildProject('project-1', 'Launch Campaign', { pipeline_hint: 'quick', last_task_id: DEFAULT_LIBRARY_VIDEO_ID }),
    buildProject('project-2', 'Unreleased Experiments', { pipeline_hint: 'action-transfer', task_count: 0 }),
  ];
}

function setDefaultBatches(): void {
  batches = [
    buildStoredBatch('batch-launch-complete', {
      name: 'Launch Batch',
      pipeline: 'standard',
      project_id: 'project-1',
      task_ids: [DEFAULT_LIBRARY_VIDEO_ID],
    }),
    buildStoredBatch('batch-running', {
      name: 'Motion Batch',
      pipeline: 'i2v',
      project_id: 'project-2',
      task_ids: ['task-batch-running'],
      created_at: '2026-04-22T02:00:00Z',
      updated_at: '2026-04-22T02:05:00Z',
    }),
  ];
}

function setDefaultLibraryVideos(): void {
  libraryVideos = [
    buildVideoItem(DEFAULT_LIBRARY_VIDEO_ID, { title: 'Library Video', project_id: 'project-1' }),
    buildVideoItem('task-library-unassigned', {
      title: 'Unassigned Clip',
      project_id: null,
      created_at: '2026-04-21T12:00:00Z',
      completed_at: '2026-04-21T12:02:00Z',
    }),
  ];
  libraryVideoDetails.clear();
  libraryVideoDetails.set(DEFAULT_LIBRARY_VIDEO_ID, {
    kind: 'success',
    payload: buildLibraryVideoDetail(DEFAULT_LIBRARY_VIDEO_ID),
  });
  libraryVideoDetails.set('task-library-unassigned', {
    kind: 'not-implemented',
  });
}

function getScenario(taskId: string): TaskScenario | undefined {
  return taskScenarios.get(taskId);
}

function createSubmitHandler<Path extends AsyncVideoEndpoint>(endpoint: Path) {
  return http.post(`${baseURL}${endpoint}`, async ({ request }) => {
    if (submitScenarios[endpoint] === 'network-error') {
      return HttpResponse.error();
    }

    if (submitScenarios[endpoint] === 'http-502') {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: { code: 'UPSTREAM_502', message: 'Upstream unavailable' } },
        { status: 502 }
      );
    }

    const body = (await request.json()) as SubmitRequestByEndpoint[Path];
    lastSubmitPayloads.set(endpoint, body);

    if (!body.project_id) {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: { code: 'NO_PROJECT', message: 'No project_id' } },
        { status: 400 }
      );
    }

    const taskId = nextTaskIds[endpoint];
    if (!taskScenarios.has(taskId)) {
      taskScenarios.set(taskId, defaultSuccessScenario(taskId));
    }

    const responseBody: SubmitResponseByEndpoint[Path] = {
      success: true,
      message: 'Task created successfully',
      task_id: taskId,
    };

    return HttpResponse.json(responseBody);
  });
}

function getLastPayload<Path extends AsyncVideoEndpoint>(endpoint: Path): SubmitRequestByEndpoint[Path] | null {
  const payload = lastSubmitPayloads.get(endpoint);
  return payload ? structuredClone(payload as SubmitRequestByEndpoint[Path]) : null;
}

function setScenario(endpoint: AsyncVideoEndpoint, scenario: SubmitScenario, taskId?: string): void {
  submitScenarios[endpoint] = scenario;
  if (taskId) {
    nextTaskIds[endpoint] = taskId;
    if (scenario === 'success' && !taskScenarios.has(taskId)) {
      taskScenarios.set(taskId, defaultSuccessScenario(taskId));
    }
  }
}

function resetMockApiState(): void {
  submitScenarios = { ...DEFAULT_SUBMIT_SCENARIOS };
  nextTaskIds = { ...DEFAULT_NEXT_TASK_IDS };
  lastSubmitPayloads.clear();
  pollCounts.clear();
  setDefaultProjects();
  setDefaultLibraryVideos();
  setDefaultTaskScenarios();
  setDefaultBatches();
}

function setSubmitScenario(scenario: SubmitScenario, taskId = DEFAULT_SUCCESS_TASK_ID): void {
  setScenario('/api/video/generate/async', scenario, taskId);
}

function setAsyncSubmitScenario(
  endpoint: Exclude<AsyncVideoEndpoint, '/api/video/generate/async'>,
  scenario: SubmitScenario,
  taskId?: string
): void {
  setScenario(endpoint, scenario, taskId);
}

function setTaskScenario(taskId: string, states: Task[], cancelledState?: Task): void {
  taskScenarios.set(taskId, {
    states: states.map(cloneTask),
    index: 0,
    cancelledState: cancelledState ? cloneTask(cancelledState) : undefined,
  });
}

function setBatches(nextBatches: StoredBatch[]): void {
  batches = structuredClone(nextBatches);
}

function buildBatch(taskIds: string[], overrides: Partial<StoredBatch> = {}): StoredBatch {
  const batchId = overrides.id ?? `batch-${crypto.randomUUID()}`;
  return buildStoredBatch(batchId, {
    task_ids: taskIds,
    ...overrides,
  });
}

function getTaskPollCount(taskId: string): number {
  return pollCounts.get(taskId) ?? 0;
}

function getLastGeneratePayload() {
  return getLastPayload('/api/video/generate/async');
}

function getLastDigitalHumanPayload() {
  return getLastPayload('/api/video/digital-human/async');
}

function getLastI2VPayload() {
  return getLastPayload('/api/video/i2v/async');
}

function getLastActionTransferPayload() {
  return getLastPayload('/api/video/action-transfer/async');
}

function getLastCustomPayload() {
  return getLastPayload('/api/video/custom/async');
}

function setProjects(nextProjects: Project[]): void {
  projects = structuredClone(nextProjects);
}

function setLibraryVideos(items: VideoItem[]): void {
  libraryVideos = structuredClone(items);
}

function setLibraryVideoDetail(videoId: string, detailMode: LibraryVideoDetailMode): void {
  libraryVideoDetails.set(videoId, structuredClone(detailMode));
}

resetMockApiState();

const handlers = [
  createSubmitHandler('/api/video/generate/async'),
  createSubmitHandler('/api/video/digital-human/async'),
  createSubmitHandler('/api/video/i2v/async'),
  createSubmitHandler('/api/video/action-transfer/async'),
  createSubmitHandler('/api/video/custom/async'),

  http.get(`${baseURL}/api/projects`, () => {
    const response: ProjectListResponse = {
      items: structuredClone(projects),
    };
    return HttpResponse.json(response);
  }),

  http.get(`${baseURL}/api/batch`, ({ request }) => {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('project_id');
    const status = url.searchParams.get('status');
    const cursor = Number.parseInt(url.searchParams.get('cursor') ?? '0', 10);
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);

    let items = batches
      .filter((batch) => !batch.deleted_at)
      .map((batch) => hydrateBatch(batch));

    if (projectId === '__unassigned__' || projectId === 'null') {
      items = items.filter((batch) => batch.project_id === null);
    } else if (projectId && projectId !== 'all') {
      items = items.filter((batch) => batch.project_id === projectId);
    }

    if (status && status !== 'all') {
      items = items.filter((batch) => batch.status === status);
    }

    items.sort((left, right) => right.created_at.localeCompare(left.created_at));

    const pageItems = items.slice(cursor, cursor + limit);
    const response: BatchListResponse = {
      items: pageItems.map((batch) => ({
        id: batch.id,
        name: batch.name,
        pipeline: batch.pipeline,
        project_id: batch.project_id,
        status: batch.status,
        total: batch.total,
        succeeded: batch.succeeded,
        failed: batch.failed,
        cancelled: batch.cancelled,
        created_at: batch.created_at,
        updated_at: batch.updated_at,
        cover_url: batch.cover_url,
        deleted_at: batch.deleted_at,
        task_ids: batch.task_ids,
      })),
      next_cursor: cursor + limit < items.length ? String(cursor + limit) : null,
    };

    return HttpResponse.json(response);
  }),

  http.post(`${baseURL}/api/batch`, async ({ request }) => {
    const body = (await request.json()) as BatchCreateRequest;

    if (!body.rows || body.rows.length === 0) {
      return HttpResponse.json(
        { detail: [{ loc: ['body', 'rows'], msg: 'Rows are required', type: 'value_error' }] },
        { status: 422 }
      );
    }

    const batchId = `batch-${crypto.randomUUID()}`;
    const taskIds = body.rows.map((_, index) => `${batchId}-task-${index + 1}`);
    const createdAt = new Date().toISOString();

    taskIds.forEach((taskId, index) => {
      const row = body.rows[index];
      const requestParams = {
        ...row,
        project_id: body.project_id ?? null,
      };

      taskScenarios.set(taskId, {
        states: [
          buildTask(taskId, 'pending', {
            batch_id: batchId,
            project_id: body.project_id ?? null,
            request_params: requestParams,
          }),
          buildTask(taskId, 'running', {
            batch_id: batchId,
            project_id: body.project_id ?? null,
            request_params: requestParams,
          }),
          buildTask(taskId, 'completed', {
            batch_id: batchId,
            project_id: body.project_id ?? null,
            request_params: requestParams,
            result: {
              video_url: `${baseURL}/api/files/output/${taskId}/final.mp4`,
              video_path: `/output/${taskId}/final.mp4`,
              duration: 12,
              file_size: 4 * 1024 * 1024,
            },
          }),
        ],
        index: 0,
        cancelledState: buildTask(taskId, 'cancelled', {
          batch_id: batchId,
          project_id: body.project_id ?? null,
          request_params: requestParams,
        }),
      });
    });

    batches.unshift(
      buildStoredBatch(batchId, {
        name: body.name ?? null,
        pipeline: body.pipeline,
        project_id: body.project_id ?? null,
        task_ids: taskIds,
        created_at: createdAt,
        updated_at: createdAt,
      })
    );

    const response: BatchCreateResponse = {
      batch_id: batchId,
      task_ids: taskIds,
    };

    return HttpResponse.json(response, { status: 201 });
  }),

  http.get(`${baseURL}/api/batch/:batchId`, ({ params }) => {
    const batchId = String(params.batchId);
    const batch = batches.find((entry) => entry.id === batchId && !entry.deleted_at);

    if (!batch) {
      return HttpResponse.json<ApiErrorResponse>({ detail: 'Not found' }, { status: 404 });
    }

    return HttpResponse.json(hydrateBatch(batch));
  }),

  http.delete(`${baseURL}/api/batch/:batchId`, ({ params, request }) => {
    const batchId = String(params.batchId);
    const batchIndex = batches.findIndex((entry) => entry.id === batchId && !entry.deleted_at);

    if (batchIndex < 0) {
      return HttpResponse.json<ApiErrorResponse>({ detail: 'Not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const cascade = url.searchParams.get('cascade') === 'true';
    const batch = batches[batchIndex];

    if (cascade) {
      batch.task_ids.forEach((taskId) => {
        const scenario = taskScenarios.get(taskId);
        if (scenario?.cancelledState) {
          scenario.states = [cloneTask(scenario.cancelledState)];
          scenario.index = 0;
        }
      });
    }

    const deletedAt = new Date().toISOString();
    batches[batchIndex] = {
      ...batch,
      deleted_at: deletedAt,
      updated_at: deletedAt,
    };

    const hydrated = hydrateBatch(batches[batchIndex]);
    const response: BatchDeleteResponse = {
      id: hydrated.id,
      name: hydrated.name,
      pipeline: hydrated.pipeline,
      project_id: hydrated.project_id,
      status: hydrated.status,
      total: hydrated.total,
      succeeded: hydrated.succeeded,
      failed: hydrated.failed,
      cancelled: hydrated.cancelled,
      created_at: hydrated.created_at,
      updated_at: hydrated.updated_at,
      cover_url: hydrated.cover_url,
      deleted_at: hydrated.deleted_at,
      task_ids: hydrated.task_ids,
    };

    return HttpResponse.json(response);
  }),

  http.get(`${baseURL}/api/library/videos`, ({ request }) => {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('project_id');
    const cursor = Number.parseInt(url.searchParams.get('cursor') ?? '0', 10);
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);

    let items = [...libraryVideos];

    if (projectId === '__unassigned__' || projectId === 'null') {
      items = items.filter((item) => item.project_id === null);
    } else if (projectId && projectId !== 'all') {
      items = items.filter((item) => item.project_id === projectId);
    }

    items.sort((left, right) => (right.created_at ?? '').localeCompare(left.created_at ?? ''));

    const pageItems = items.slice(cursor, cursor + limit);
    const response: VideoListResponse = {
      items: structuredClone(pageItems),
      next_cursor: cursor + limit < items.length ? String(cursor + limit) : null,
    };

    return HttpResponse.json(response);
  }),

  http.get(`${baseURL}/api/library/videos/:videoId`, ({ params }) => {
    const videoId = String(params.videoId);
    const detailMode = libraryVideoDetails.get(videoId) ?? { kind: 'not-implemented' as const };

    if (detailMode.kind === 'not-found') {
      return HttpResponse.json<ApiErrorResponse>({ detail: 'Not found' }, { status: 404 });
    }

    if (detailMode.kind === 'not-implemented') {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: { code: 'NOT_IMPLEMENTED', message: 'Library detail is not implemented yet.' } },
        { status: 501 }
      );
    }

    return HttpResponse.json(detailMode.payload as Record<string, unknown>);
  }),

  http.get(`${baseURL}/api/tasks/:taskId`, ({ params }) => {
    const taskId = String(params.taskId);
    const scenario = getScenario(taskId);

    if (!scenario) {
      return HttpResponse.json<ApiErrorResponse>({ detail: 'Not found' }, { status: 404 });
    }

    pollCounts.set(taskId, (pollCounts.get(taskId) ?? 0) + 1);

    const stateIndex = Math.min(scenario.index, scenario.states.length - 1);
    const task = cloneTask(scenario.states[stateIndex]);

    if (scenario.index < scenario.states.length - 1) {
      scenario.index += 1;
    }

    return HttpResponse.json(task);
  }),

  http.get(`${baseURL}/api/tasks`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const projectId = url.searchParams.get('project_id');
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);

    let items = Array.from(taskScenarios.values()).map((scenario) => {
      const index = Math.min(scenario.index, scenario.states.length - 1);
      return cloneTask(scenario.states[index]);
    });

    if (status && status !== 'all') {
      items = items.filter((task) => task.status === status);
    }

    if (projectId === '__unassigned__' || projectId === 'null') {
      items = items.filter((task) => task.project_id === null);
    } else if (projectId && projectId !== 'all') {
      items = items.filter((task) => task.project_id === projectId);
    }

    items.sort((left, right) => (right.created_at ?? '').localeCompare(left.created_at ?? ''));
    return HttpResponse.json(items.slice(0, limit));
  }),

  http.delete(`${baseURL}/api/tasks/:taskId`, ({ params }) => {
    const taskId = String(params.taskId);
    const scenario = getScenario(taskId);

    if (scenario?.cancelledState) {
      scenario.states = [cloneTask(scenario.cancelledState)];
      scenario.index = 0;
    }

    return HttpResponse.json({
      success: true,
      message: `Task ${taskId} cancelled successfully`,
    });
  }),

  http.post(`${baseURL}/api/uploads`, () => {
    const response: UploadResponse = {
      file_url: `${baseURL}/api/files/output/uploads/mock-upload.png`,
      filename: 'mock-upload.png',
      path: '/output/uploads/mock-upload.png',
    };

    return HttpResponse.json(response, { status: 201 });
  }),

  http.get(`${baseURL}/api/resources/workflows/tts`, () => HttpResponse.json(ttsWorkflowResponse)),
  http.get(`${baseURL}/api/resources/workflows/media`, () => HttpResponse.json(mediaWorkflowResponse)),
  http.get(`${baseURL}/api/resources/workflows/image`, () => HttpResponse.json(imageWorkflowResponse)),
  http.get(`${baseURL}/api/resources/bgm`, () => HttpResponse.json(bgmListResponse)),
];

export {
  ASYNC_VIDEO_ENDPOINTS,
  buildBatch,
  buildProject,
  buildTask,
  buildVideoItem,
  DEFAULT_CANCELLED_TASK_ID,
  DEFAULT_FAILURE_TASK_ID,
  DEFAULT_SUCCESS_TASK_ID,
  getLastActionTransferPayload,
  getLastCustomPayload,
  getLastDigitalHumanPayload,
  getLastGeneratePayload,
  getLastI2VPayload,
  getTaskPollCount,
  handlers,
  resetMockApiState,
  setBatches,
  setLibraryVideoDetail,
  setLibraryVideos,
  setProjects,
  setAsyncSubmitScenario,
  setSubmitScenario,
  setTaskScenario,
};
