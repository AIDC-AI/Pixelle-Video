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
type WorkflowListResponse =
  paths['/api/resources/workflows/tts']['get']['responses'][200]['content']['application/json'];
type BgmListResponse =
  paths['/api/resources/bgm']['get']['responses'][200]['content']['application/json'];
type UploadResponse = paths['/api/uploads']['post']['responses'][201]['content']['application/json'];
type ApiErrorResponse = components['schemas']['ApiErrorResponse'];

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

const DEFAULT_TIME = '2026-04-22T00:00:00Z';
const DEFAULT_SUCCESS_TASK_ID = 'task-success';
const DEFAULT_CANCELLED_TASK_ID = 'task-cancelled';
const DEFAULT_FAILURE_TASK_ID = 'task-failed';

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

function setDefaultTaskScenarios(): void {
  taskScenarios.clear();
  Object.values(DEFAULT_NEXT_TASK_IDS).forEach((taskId) => {
    taskScenarios.set(taskId, defaultSuccessScenario(taskId));
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
  setDefaultTaskScenarios();
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

resetMockApiState();

const handlers = [
  createSubmitHandler('/api/video/generate/async'),
  createSubmitHandler('/api/video/digital-human/async'),
  createSubmitHandler('/api/video/i2v/async'),
  createSubmitHandler('/api/video/action-transfer/async'),
  createSubmitHandler('/api/video/custom/async'),

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
  buildTask,
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
  setAsyncSubmitScenario,
  setSubmitScenario,
  setTaskScenario,
};
