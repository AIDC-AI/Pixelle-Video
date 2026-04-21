import { http, HttpResponse } from 'msw';
import type { components, paths } from '@/types/api';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type GenerateVideoRequest =
  paths['/api/video/generate/async']['post']['requestBody']['content']['application/json'];
type GenerateVideoAsyncResponse =
  paths['/api/video/generate/async']['post']['responses'][200]['content']['application/json'];
type Task = paths['/api/tasks/{task_id}']['get']['responses'][200]['content']['application/json'];
type WorkflowListResponse =
  paths['/api/resources/workflows/tts']['get']['responses'][200]['content']['application/json'];
type BgmListResponse =
  paths['/api/resources/bgm']['get']['responses'][200]['content']['application/json'];
type ApiErrorResponse = components['schemas']['ApiErrorResponse'];
type TaskStatus = components['schemas']['TaskStatus'];

type SubmitScenario = 'success' | 'http-502' | 'network-error';

interface TaskScenario {
  states: Task[];
  index: number;
  cancelledState?: Task;
}

const DEFAULT_TIME = '2026-04-22T00:00:00Z';

let submitScenario: SubmitScenario = 'success';
let nextTaskId = 'task-success';
let lastGeneratePayload: GenerateVideoRequest | null = null;
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

function buildTask(
  taskId: string,
  status: TaskStatus,
  overrides: Partial<Task> = {}
): Task {
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

const DEFAULT_SUCCESS_TASK_ID = 'task-success';
const DEFAULT_CANCELLED_TASK_ID = 'task-cancelled';
const DEFAULT_FAILURE_TASK_ID = 'task-failed';

function cloneTask(task: Task): Task {
  return structuredClone(task);
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

export function resetMockApiState(): void {
  submitScenario = 'success';
  nextTaskId = DEFAULT_SUCCESS_TASK_ID;
  lastGeneratePayload = null;
  taskScenarios.clear();
  pollCounts.clear();
  taskScenarios.set(DEFAULT_SUCCESS_TASK_ID, defaultSuccessScenario(DEFAULT_SUCCESS_TASK_ID));
}

export function setSubmitScenario(scenario: SubmitScenario, taskId = DEFAULT_SUCCESS_TASK_ID): void {
  submitScenario = scenario;
  nextTaskId = taskId;
  if (!taskScenarios.has(taskId) && scenario === 'success') {
    taskScenarios.set(taskId, defaultSuccessScenario(taskId));
  }
}

export function setTaskScenario(taskId: string, states: Task[], cancelledState?: Task): void {
  taskScenarios.set(taskId, {
    states: states.map(cloneTask),
    index: 0,
    cancelledState: cancelledState ? cloneTask(cancelledState) : undefined,
  });
}

export function getLastGeneratePayload(): GenerateVideoRequest | null {
  return lastGeneratePayload ? structuredClone(lastGeneratePayload) : null;
}

export function getTaskPollCount(taskId: string): number {
  return pollCounts.get(taskId) ?? 0;
}

resetMockApiState();

export const handlers = [
  http.post(`${baseURL}/api/video/generate/async`, async ({ request }) => {
    if (submitScenario === 'network-error') {
      return HttpResponse.error();
    }

    if (submitScenario === 'http-502') {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: { code: 'UPSTREAM_502', message: 'Upstream unavailable' } },
        { status: 502 }
      );
    }

    const body = (await request.json()) as GenerateVideoRequest;
    lastGeneratePayload = body;

    if (!body.project_id) {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: { code: 'NO_PROJECT', message: 'No project_id' } },
        { status: 400 }
      );
    }

    if (!taskScenarios.has(nextTaskId)) {
      taskScenarios.set(nextTaskId, defaultSuccessScenario(nextTaskId));
    }

    const responseBody: GenerateVideoAsyncResponse = {
      success: true,
      message: 'Task created successfully',
      task_id: nextTaskId,
    };

    return HttpResponse.json(responseBody);
  }),

  http.get(`${baseURL}/api/tasks/:taskId`, ({ params }) => {
    const taskId = String(params.taskId);
    const scenario = taskScenarios.get(taskId);

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
    const scenario = taskScenarios.get(taskId);
    if (scenario?.cancelledState) {
      scenario.states = [cloneTask(scenario.cancelledState)];
      scenario.index = 0;
    }

    return HttpResponse.json({
      success: true,
      message: `Task ${taskId} cancelled successfully`,
    });
  }),

  http.get(`${baseURL}/api/resources/workflows/tts`, () => HttpResponse.json(ttsWorkflowResponse)),
  http.get(`${baseURL}/api/resources/workflows/media`, () => HttpResponse.json(mediaWorkflowResponse)),
  http.get(`${baseURL}/api/resources/workflows/image`, () => HttpResponse.json(imageWorkflowResponse)),
  http.get(`${baseURL}/api/resources/bgm`, () => HttpResponse.json(bgmListResponse)),
];

export {
  buildTask,
  DEFAULT_CANCELLED_TASK_ID,
  DEFAULT_FAILURE_TASK_ID,
  DEFAULT_SUCCESS_TASK_ID,
};
