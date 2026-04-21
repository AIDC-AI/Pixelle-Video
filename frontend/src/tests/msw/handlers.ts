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
type ImageItem = components['schemas']['ImageItem'];
type ImageListResponse = paths['/api/library/images']['get']['responses'][200]['content']['application/json'];
type VoiceItem = components['schemas']['VoiceItem'];
type VoiceListResponse = paths['/api/library/voices']['get']['responses'][200]['content']['application/json'];
type LibraryBGMItem = components['schemas']['LibraryBGMItem'];
type LibraryBGMListResponse =
  paths['/api/library/bgm']['get']['responses'][200]['content']['application/json'];
type ScriptItem = components['schemas']['ScriptItem'];
type ScriptListResponse = paths['/api/library/scripts']['get']['responses'][200]['content']['application/json'];
type WorkflowListResponse =
  paths['/api/resources/workflows/tts']['get']['responses'][200]['content']['application/json'];
type WorkflowDetailResponse =
  paths['/api/resources/workflows/{workflow_id}']['get']['responses'][200]['content']['application/json'];
type TemplateInfo = components['schemas']['TemplateInfo'];
type TemplateListResponse =
  paths['/api/resources/templates']['get']['responses'][200]['content']['application/json'];
type PresetItem = components['schemas']['PresetItem'];
type PresetListResponse =
  paths['/api/resources/presets']['get']['responses'][200]['content']['application/json'];
type WorkflowInfo = components['schemas']['WorkflowInfo'];
type BgmListResponse =
  paths['/api/resources/bgm']['get']['responses'][200]['content']['application/json'];
type UploadResponse = paths['/api/uploads']['post']['responses'][201]['content']['application/json'];
type ApiErrorResponse = components['schemas']['ApiErrorResponse'];
type HealthResponse = paths['/health']['get']['responses'][200]['content']['application/json'];
type BatchPipeline = components['schemas']['BatchPipeline'];
type BatchStatus = components['schemas']['BatchStatus'];
type SettingsPayload = components['schemas']['SettingsPayload'];
type SettingsUpdatePayload = components['schemas']['SettingsUpdatePayload'];

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
let libraryImages: ImageItem[] = [];
let libraryVoices: VoiceItem[] = [];
let libraryBgmItems: LibraryBGMItem[] = [];
let libraryScripts: ScriptItem[] = [];
let batches: StoredBatch[] = [];
let templates: TemplateInfo[] = [];
let presets: PresetItem[] = [];
let settingsPayload: SettingsPayload = {
  project_name: 'Pixelle-Video',
  llm: {
    api_key: 'sk-****demo',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-5.4',
  },
  comfyui: {
    comfyui_url: 'http://127.0.0.1:8188',
    comfyui_api_key: 'cf-****demo',
    runninghub_api_key: 'rh-****demo',
    runninghub_concurrent_limit: 2,
    runninghub_instance_type: 'plus',
  },
  template: {
    default_template: '1080x1920/default.html',
  },
};
let settingsWriteShouldFail = false;
let healthShouldFail = false;
const libraryVideoDetails = new Map<string, LibraryVideoDetailMode>();
const workflowDetails = new Map<string, WorkflowDetailResponse>();

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
    {
      name: 'tts_cloud.json',
      display_name: 'TTS Cloud',
      source: 'runninghub',
      path: '/workflows/runninghub/tts_cloud.json',
      key: 'runninghub/tts_cloud.json',
      workflow_id: 'rh-tts-cloud',
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
    {
      name: 'video_cloud.json',
      display_name: 'RunningHub Motion',
      source: 'runninghub',
      path: '/workflows/runninghub/video_cloud.json',
      key: 'runninghub/video_cloud.json',
      workflow_id: 'rh-video-cloud',
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
    {
      name: 'image_flux.json',
      display_name: 'Image Flux',
      source: 'runninghub',
      path: '/workflows/runninghub/image_flux.json',
      key: 'runninghub/image_flux.json',
      workflow_id: 'rh-image-flux',
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

function buildImageItem(id: string, overrides: Partial<ImageItem> = {}): ImageItem {
  return {
    id,
    task_id: DEFAULT_LIBRARY_VIDEO_ID,
    image_path: `/output/${id}/image.png`,
    image_url: `${baseURL}/api/files/output/${id}/image.png`,
    thumbnail_url: `${baseURL}/api/files/output/${id}/thumb.png`,
    created_at: DEFAULT_TIME,
    file_size: 512 * 1024,
    prompt_used: 'Sunlit portrait with soft cinematic lighting',
    project_id: 'project-1',
    batch_id: null,
    ...overrides,
  };
}

function buildVoiceItem(id: string, overrides: Partial<VoiceItem> = {}): VoiceItem {
  return {
    id,
    task_id: DEFAULT_LIBRARY_VIDEO_ID,
    audio_path: `/output/${id}/voice.mp3`,
    audio_url: `${baseURL}/api/files/output/${id}/voice.mp3`,
    created_at: DEFAULT_TIME,
    duration: 12,
    tts_voice: 'selfhost/tts_edge.json',
    text: 'Launch week narration ready for review.',
    file_size: 256 * 1024,
    project_id: 'project-1',
    batch_id: null,
    ...overrides,
  };
}

function buildLibraryBgmItem(id: string, overrides: Partial<LibraryBGMItem> = {}): LibraryBGMItem {
  return {
    id,
    name: `BGM ${id}`,
    audio_path: `/bgm/${id}.mp3`,
    audio_url: `${baseURL}/api/files/bgm/${id}.mp3`,
    created_at: DEFAULT_TIME,
    duration: 42,
    file_size: 1.2 * 1024 * 1024,
    source: 'builtin',
    project_id: null,
    batch_id: null,
    ...overrides,
  };
}

function buildScriptItem(id: string, overrides: Partial<ScriptItem> = {}): ScriptItem {
  return {
    id,
    task_id: DEFAULT_LIBRARY_VIDEO_ID,
    created_at: DEFAULT_TIME,
    project_id: 'project-1',
    batch_id: null,
    text: 'Small habits compound into major creative momentum over time.',
    script_type: 'narration',
    prompt_used: 'Narration generated from the launch concept.',
    ...overrides,
  };
}

function buildTemplateInfo(key: string, overrides: Partial<TemplateInfo> = {}): TemplateInfo {
  return {
    name: key.split('/').pop() ?? key,
    display_name: key.split('/').pop() ?? key,
    size: '1080x1920',
    width: 1080,
    height: 1920,
    orientation: 'portrait',
    path: `/templates/${key}`,
    key,
    ...overrides,
  };
}

function buildPresetItem(name: string, overrides: Partial<PresetItem> = {}): PresetItem {
  return {
    name,
    description: 'Reusable Quick pipeline preset.',
    pipeline: 'standard',
    payload_template: {
      title: `${name} Title`,
      text: 'Preset-based narration',
      mode: 'generate',
      n_scenes: 5,
      min_narration_words: 5,
      max_narration_words: 20,
      min_image_prompt_words: 30,
      max_image_prompt_words: 60,
      media_workflow: 'selfhost/media_default.json',
      video_fps: 30,
      frame_template: '1080x1920/image_default.html',
      bgm_volume: 0.3,
    },
    created_at: DEFAULT_TIME,
    source: 'user',
    ...overrides,
  };
}

function buildWorkflowInfo(key: string, overrides: Partial<WorkflowInfo> = {}): WorkflowInfo {
  return {
    name: key.split('/').pop() ?? key,
    display_name: key,
    source: key.startsWith('runninghub/') ? 'runninghub' : 'selfhost',
    path: `/workflows/${key}`,
    key,
    workflow_id: null,
    ...overrides,
  };
}

function buildWorkflowDetail(workflow: WorkflowInfo, overrides: Partial<WorkflowDetailResponse> = {}): WorkflowDetailResponse {
  return {
    ...workflow,
    editable: workflow.source === 'selfhost',
    metadata: {
      node_count: 5,
      source_path: workflow.path,
    },
    key_parameters: ['loader', 'sampler', 'save'],
    raw_nodes: ['1', '2', '3'],
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

function setDefaultLibraryAssets(): void {
  libraryImages = [
    buildImageItem('image-project-1'),
    buildImageItem('image-unassigned', {
      project_id: null,
      created_at: '2026-04-21T10:00:00Z',
      prompt_used: 'Unassigned portrait frame',
    }),
  ];
  libraryVoices = [
    buildVoiceItem('voice-project-1'),
    buildVoiceItem('voice-project-2', {
      id: 'voice-project-2',
      project_id: 'project-2',
      tts_voice: 'selfhost/tts_cloud.json',
      text: 'Alternate campaign narration',
      created_at: '2026-04-21T08:00:00Z',
    }),
  ];
  libraryBgmItems = [
    buildLibraryBgmItem('bgm-built-in-1', { source: 'builtin', project_id: null }),
    buildLibraryBgmItem('bgm-history-1', { source: 'history', project_id: 'project-1' }),
  ];
  libraryScripts = [
    buildScriptItem('script-project-1'),
    buildScriptItem('script-project-2', {
      id: 'script-project-2',
      task_id: 'task-batch-running',
      project_id: 'project-2',
      script_type: 'prompt',
      text: 'Animate the portrait with a slow cinematic push-in.',
      prompt_used: 'Image animation prompt',
      created_at: '2026-04-21T06:00:00Z',
    }),
  ];
}

function setDefaultAdvancedResources(): void {
  templates = [
    buildTemplateInfo('1080x1920/image_default.html'),
    buildTemplateInfo('1920x1080/landscape_default.html', {
      size: '1920x1080',
      width: 1920,
      height: 1080,
      orientation: 'landscape',
    }),
  ];
  presets = [
    buildPresetItem('Launch Quick Preset'),
    buildPresetItem('Creative LLM Preset', {
      source: 'builtin',
      pipeline: 'llm',
      payload_template: {
        llm: {
          base_url: 'https://api.example.com',
          model: 'gpt-4.1-mini',
        },
      },
    }),
  ];

  workflowDetails.clear();
  [...ttsWorkflowResponse.workflows, ...mediaWorkflowResponse.workflows, ...imageWorkflowResponse.workflows].forEach(
    (workflow) => {
      const detail = buildWorkflowDetail(workflow);
      workflowDetails.set(workflow.key, detail);
      if (workflow.workflow_id) {
        workflowDetails.set(workflow.workflow_id, detail);
      }
    }
  );
}

function mergeSettings(
  current: SettingsPayload,
  updates: SettingsUpdatePayload
): SettingsPayload {
  const currentLlm = current.llm ?? {
    api_key: '',
    base_url: '',
    model: '',
  };
  const currentComfyui = current.comfyui ?? {
    comfyui_url: '',
    comfyui_api_key: null,
    runninghub_api_key: null,
    runninghub_concurrent_limit: 1,
    runninghub_instance_type: null,
    tts: {
      inference_mode: 'local',
      local: {
        voice: 'zh-CN-YunjianNeural',
        speed: 1.0,
      },
      comfyui: {
        default_workflow: null,
      },
    },
    image: {
      default_workflow: null,
      prompt_prefix: '',
    },
    video: {
      default_workflow: null,
      prompt_prefix: '',
    },
  };
  const currentTemplate = current.template ?? {
    default_template: '',
  };

  return {
    project_name: updates.project_name ?? current.project_name,
    llm: {
      api_key: updates.llm?.api_key ?? currentLlm.api_key,
      base_url: updates.llm?.base_url ?? currentLlm.base_url,
      model: updates.llm?.model ?? currentLlm.model,
    },
    comfyui: {
      ...currentComfyui,
      comfyui_url: updates.comfyui?.comfyui_url ?? currentComfyui.comfyui_url,
      comfyui_api_key:
        updates.comfyui?.comfyui_api_key === undefined
          ? currentComfyui.comfyui_api_key
          : updates.comfyui.comfyui_api_key,
      runninghub_api_key:
        updates.comfyui?.runninghub_api_key === undefined
          ? currentComfyui.runninghub_api_key
          : updates.comfyui.runninghub_api_key,
      runninghub_concurrent_limit:
        updates.comfyui?.runninghub_concurrent_limit ?? currentComfyui.runninghub_concurrent_limit,
      runninghub_instance_type:
        updates.comfyui?.runninghub_instance_type === undefined
          ? currentComfyui.runninghub_instance_type
          : updates.comfyui.runninghub_instance_type,
      tts: updates.comfyui?.tts
        ? {
            inference_mode:
              updates.comfyui.tts.inference_mode ?? currentComfyui.tts?.inference_mode ?? 'local',
            local: updates.comfyui.tts.local
              ? {
                  voice:
                    updates.comfyui.tts.local.voice ?? currentComfyui.tts?.local?.voice ?? 'zh-CN-YunjianNeural',
                  speed: updates.comfyui.tts.local.speed ?? currentComfyui.tts?.local?.speed ?? 1.0,
                }
              : currentComfyui.tts?.local,
            comfyui: updates.comfyui.tts.comfyui
              ? {
                  default_workflow:
                    updates.comfyui.tts.comfyui.default_workflow ??
                    currentComfyui.tts?.comfyui?.default_workflow ??
                    null,
                }
              : currentComfyui.tts?.comfyui,
          }
        : currentComfyui.tts,
      image: updates.comfyui?.image
        ? {
            default_workflow:
              updates.comfyui.image.default_workflow ?? currentComfyui.image?.default_workflow ?? null,
            prompt_prefix: updates.comfyui.image.prompt_prefix ?? currentComfyui.image?.prompt_prefix ?? '',
          }
        : currentComfyui.image,
      video: updates.comfyui?.video
        ? {
            default_workflow:
              updates.comfyui.video.default_workflow ?? currentComfyui.video?.default_workflow ?? null,
            prompt_prefix: updates.comfyui.video.prompt_prefix ?? currentComfyui.video?.prompt_prefix ?? '',
          }
        : currentComfyui.video,
    },
    template: {
      default_template: updates.template?.default_template ?? currentTemplate.default_template,
    },
  };
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
  setDefaultLibraryAssets();
  setDefaultAdvancedResources();
  setDefaultTaskScenarios();
  setDefaultBatches();
  settingsPayload = {
    project_name: 'Pixelle-Video',
    llm: {
      api_key: 'sk-****demo',
      base_url: 'https://api.openai.com/v1',
      model: 'gpt-5.4',
    },
    comfyui: {
      comfyui_url: 'http://127.0.0.1:8188',
      comfyui_api_key: 'cf-****demo',
      runninghub_api_key: 'rh-****demo',
      runninghub_concurrent_limit: 2,
      runninghub_instance_type: 'plus',
    },
    template: {
      default_template: '1080x1920/default.html',
    },
  };
  settingsWriteShouldFail = false;
  healthShouldFail = false;
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

function setSettings(nextSettings: SettingsPayload): void {
  settingsPayload = structuredClone(nextSettings);
}

function setSettingsWriteShouldFail(value: boolean): void {
  settingsWriteShouldFail = value;
}

function setHealthShouldFail(value: boolean): void {
  healthShouldFail = value;
}

function setLibraryVideos(items: VideoItem[]): void {
  libraryVideos = structuredClone(items);
}

function setLibraryImages(items: ImageItem[]): void {
  libraryImages = structuredClone(items);
}

function setLibraryVoices(items: VoiceItem[]): void {
  libraryVoices = structuredClone(items);
}

function setLibraryBgm(items: LibraryBGMItem[]): void {
  libraryBgmItems = structuredClone(items);
}

function setLibraryScripts(items: ScriptItem[]): void {
  libraryScripts = structuredClone(items);
}

function setTemplates(items: TemplateInfo[]): void {
  templates = structuredClone(items);
}

function setPresets(items: PresetItem[]): void {
  presets = structuredClone(items);
}

function setLibraryVideoDetail(videoId: string, detailMode: LibraryVideoDetailMode): void {
  libraryVideoDetails.set(videoId, structuredClone(detailMode));
}

function applyProjectFilter<T extends { project_id?: string | null }>(items: T[], projectId: string | null): T[] {
  if (projectId === '__unassigned__' || projectId === 'null') {
    return items.filter((item) => item.project_id === null);
  }

  if (projectId && projectId !== 'all') {
    return items.filter((item) => item.project_id === projectId);
  }

  return items;
}

function paginateItems<T>(items: T[], cursorParam: string | null, limitParam: string | null): { pageItems: T[]; nextCursor: string | null } {
  const cursor = Number.parseInt(cursorParam ?? '0', 10);
  const limit = Number.parseInt(limitParam ?? '20', 10);
  const pageItems = items.slice(cursor, cursor + limit);

  return {
    pageItems,
    nextCursor: cursor + limit < items.length ? String(cursor + limit) : null,
  };
}

resetMockApiState();

const handlers = [
  http.get(`${baseURL}/health`, () => {
    if (healthShouldFail) {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: { code: 'HEALTH_UNAVAILABLE', message: 'Health endpoint unavailable' } },
        { status: 503 }
      );
    }

    const response: HealthResponse = {
      status: 'healthy',
      version: '0.1.0',
      service: 'Pixelle-Video API',
    };
    return HttpResponse.json(response);
  }),

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

  http.delete(`${baseURL}/api/projects/:projectId`, ({ params }) => {
    const projectId = String(params.projectId);
    const index = projects.findIndex((project) => project.id === projectId);

    if (index === -1) {
      return HttpResponse.json<ApiErrorResponse>({ detail: 'Not found' }, { status: 404 });
    }

    const deletedProject = {
      ...projects[index],
      deleted_at: DEFAULT_TIME,
    };
    projects = projects.filter((project) => project.id !== projectId);
    return HttpResponse.json(deletedProject);
  }),

  http.get(`${baseURL}/api/settings`, () => HttpResponse.json(structuredClone(settingsPayload))),

  http.put(`${baseURL}/api/settings`, async ({ request }) => {
    if (settingsWriteShouldFail) {
      return HttpResponse.json<ApiErrorResponse>(
        { detail: { code: 'SETTINGS_WRITE_FAILED', message: 'Failed to update settings.' } },
        { status: 500 }
      );
    }

    const body = (await request.json()) as SettingsUpdatePayload;
    settingsPayload = mergeSettings(settingsPayload, body);
    return HttpResponse.json(structuredClone(settingsPayload));
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

    const items = applyProjectFilter([...libraryVideos], projectId);

    items.sort((left, right) => (right.created_at ?? '').localeCompare(left.created_at ?? ''));

    const { pageItems, nextCursor } = paginateItems(
      items,
      url.searchParams.get('cursor'),
      url.searchParams.get('limit')
    );
    const response: VideoListResponse = {
      items: structuredClone(pageItems),
      next_cursor: nextCursor,
    };

    return HttpResponse.json(response);
  }),

  http.get(`${baseURL}/api/library/images`, ({ request }) => {
    const url = new URL(request.url);
    const items = applyProjectFilter([...libraryImages], url.searchParams.get('project_id')).sort((left, right) =>
      (right.created_at ?? '').localeCompare(left.created_at ?? '')
    );
    const { pageItems, nextCursor } = paginateItems(
      items,
      url.searchParams.get('cursor'),
      url.searchParams.get('limit')
    );
    const response: ImageListResponse = {
      items: structuredClone(pageItems),
      next_cursor: nextCursor,
    };
    return HttpResponse.json(response);
  }),

  http.get(`${baseURL}/api/library/voices`, ({ request }) => {
    const url = new URL(request.url);
    const items = applyProjectFilter([...libraryVoices], url.searchParams.get('project_id')).sort((left, right) =>
      (right.created_at ?? '').localeCompare(left.created_at ?? '')
    );
    const { pageItems, nextCursor } = paginateItems(
      items,
      url.searchParams.get('cursor'),
      url.searchParams.get('limit')
    );
    const response: VoiceListResponse = {
      items: structuredClone(pageItems),
      next_cursor: nextCursor,
    };
    return HttpResponse.json(response);
  }),

  http.get(`${baseURL}/api/library/bgm`, ({ request }) => {
    const url = new URL(request.url);
    const items = applyProjectFilter([...libraryBgmItems], url.searchParams.get('project_id')).sort((left, right) =>
      (right.created_at ?? '').localeCompare(left.created_at ?? '')
    );
    const { pageItems, nextCursor } = paginateItems(
      items,
      url.searchParams.get('cursor'),
      url.searchParams.get('limit')
    );
    const response: LibraryBGMListResponse = {
      items: structuredClone(pageItems),
      next_cursor: nextCursor,
    };
    return HttpResponse.json(response);
  }),

  http.get(`${baseURL}/api/library/scripts`, ({ request }) => {
    const url = new URL(request.url);
    const items = applyProjectFilter([...libraryScripts], url.searchParams.get('project_id')).sort((left, right) =>
      (right.created_at ?? '').localeCompare(left.created_at ?? '')
    );
    const { pageItems, nextCursor } = paginateItems(
      items,
      url.searchParams.get('cursor'),
      url.searchParams.get('limit')
    );
    const response: ScriptListResponse = {
      items: structuredClone(pageItems),
      next_cursor: nextCursor,
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
  http.get(`${baseURL}/api/resources/workflows/:workflowId`, ({ params }) => {
    const workflowId = decodeURIComponent(String(params.workflowId));
    const workflow = workflowDetails.get(workflowId);

    if (!workflow) {
      return HttpResponse.json<ApiErrorResponse>({ detail: 'Not found' }, { status: 404 });
    }

    return HttpResponse.json(workflow);
  }),
  http.get(`${baseURL}/api/resources/templates`, () => {
    const response: TemplateListResponse = {
      success: true,
      message: 'Success',
      templates: structuredClone(templates),
    };
    return HttpResponse.json(response);
  }),
  http.get(`${baseURL}/api/resources/presets`, () => {
    const response: PresetListResponse = {
      success: true,
      message: 'Success',
      presets: structuredClone(presets),
    };
    return HttpResponse.json(response);
  }),
  http.get(`${baseURL}/api/resources/bgm`, () => HttpResponse.json(bgmListResponse)),
];

export {
  ASYNC_VIDEO_ENDPOINTS,
  buildBatch,
  buildImageItem,
  buildLibraryBgmItem,
  buildProject,
  buildPresetItem,
  buildScriptItem,
  buildTask,
  buildTemplateInfo,
  buildVideoItem,
  buildVoiceItem,
  buildWorkflowDetail,
  buildWorkflowInfo,
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
  setLibraryBgm,
  setLibraryImages,
  setLibraryScripts,
  setLibraryVideoDetail,
  setLibraryVideos,
  setLibraryVoices,
  setPresets,
  setProjects,
  setSettings,
  setSettingsWriteShouldFail,
  setAsyncSubmitScenario,
  setHealthShouldFail,
  setSubmitScenario,
  setTemplates,
  setTaskScenario,
};
