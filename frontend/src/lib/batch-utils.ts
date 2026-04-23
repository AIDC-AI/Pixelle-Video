import type { components } from '@/types/api';

export type Batch = components['schemas']['Batch'];
export type BatchCreateRequest = components['schemas']['BatchCreateRequest'];
export type BatchDetailResponse = components['schemas']['BatchDetailResponse'];
export type BatchPipeline = components['schemas']['BatchPipeline'];
export type BatchRowPayload = BatchCreateRequest['rows'][number];
export type BatchStatus = components['schemas']['BatchStatus'];
export type Task = components['schemas']['Task'];

export type BatchPayloadByPipeline = {
  standard: components['schemas']['VideoGenerateRequest'];
  digital_human: components['schemas']['DigitalHumanAsyncRequest'];
  i2v: components['schemas']['I2VAsyncRequest'];
  action_transfer: components['schemas']['ActionTransferAsyncRequest'];
  asset_based: components['schemas']['CustomAsyncRequest'];
};

export type CreatePipelineSlug = 'quick' | 'digital-human' | 'i2v' | 'action-transfer' | 'custom';
export type FieldInputType = 'text' | 'number' | 'select' | 'textarea' | 'json';

export interface PipelineFieldDefinition {
  key: string;
  label: string;
  input: FieldInputType;
  helperText?: string;
  options?: readonly { label: string; value: string }[];
  placeholder?: string;
  required: boolean;
}

export interface PipelineMetadata {
  createHref: `/create/${CreatePipelineSlug}`;
  description: string;
  exampleRow: Record<string, string>;
  fields: readonly PipelineFieldDefinition[];
  label: string;
  slug: CreatePipelineSlug;
}

const STANDARD_FIELDS = [
  { key: 'text', label: 'Text', input: 'textarea', required: true, placeholder: 'Source text or fixed narration' },
  {
    key: 'mode',
    label: 'Mode',
    input: 'select',
    required: true,
    options: [
      { label: 'Generate', value: 'generate' },
      { label: 'Fixed', value: 'fixed' },
    ] as const,
  },
  { key: 'title', label: 'Title', input: 'text', required: false, placeholder: 'Optional title' },
  {
    key: 'style_id',
    label: 'Style ID',
    input: 'text',
    required: false,
    placeholder: 'style-1014',
    helperText: 'Optional style preset. When set, it can bring in a matching visual tone and default music.',
  },
  { key: 'n_scenes', label: 'Scenes', input: 'number', required: true, placeholder: '5' },
  {
    key: 'tts_workflow',
    label: 'TTS Workflow',
    input: 'text',
    required: false,
    placeholder: 'selfhost/tts_edge.json',
    helperText: 'Optional voice plan for narration generation.',
  },
  { key: 'ref_audio', label: 'Ref Audio', input: 'text', required: false, placeholder: 'Optional audio URL/path' },
  { key: 'voice_id', label: 'Voice ID', input: 'text', required: false, placeholder: 'Legacy voice id' },
  { key: 'min_narration_words', label: 'Min Narration Words', input: 'number', required: true, placeholder: '5' },
  { key: 'max_narration_words', label: 'Max Narration Words', input: 'number', required: true, placeholder: '20' },
  { key: 'min_image_prompt_words', label: 'Min Prompt Words', input: 'number', required: true, placeholder: '30' },
  { key: 'max_image_prompt_words', label: 'Max Prompt Words', input: 'number', required: true, placeholder: '60' },
  {
    key: 'media_workflow',
    label: 'Media Workflow',
    input: 'text',
    required: false,
    placeholder: 'selfhost/media_default.json',
    helperText: 'Optional visual plan for image and video generation.',
  },
  { key: 'video_fps', label: 'Video FPS', input: 'number', required: true, placeholder: '30' },
  { key: 'frame_template', label: 'Frame Template', input: 'text', required: false, placeholder: '1080x1920/image_default.html' },
  { key: 'prompt_prefix', label: 'Prompt Prefix', input: 'text', required: false, placeholder: 'Optional prompt style prefix' },
  {
    key: 'bgm_mode',
    label: 'BGM Mode',
    input: 'select',
    required: false,
    helperText: 'Choose whether to skip music, use the style default, or point to a specific track.',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Style Default', value: 'default' },
      { label: 'Custom', value: 'custom' },
    ] as const,
  },
  {
    key: 'bgm_path',
    label: 'BGM Path',
    input: 'text',
    required: false,
    placeholder: 'Optional background music path',
    helperText: 'Used only when the music source is set to a specific track.',
  },
  { key: 'bgm_volume', label: 'BGM Volume', input: 'number', required: true, placeholder: '0.3' },
] as const satisfies readonly PipelineFieldDefinition[];

const DIGITAL_HUMAN_FIELDS = [
  { key: 'portrait_url', label: 'Portrait URL', input: 'text', required: true, placeholder: 'https://example.com/portrait.png' },
  { key: 'narration', label: 'Narration', input: 'textarea', required: true, placeholder: 'Narration for the digital human video' },
  {
    key: 'voice_workflow',
    label: 'Voice Workflow',
    input: 'text',
    required: false,
    placeholder: 'selfhost/tts_edge.json',
    helperText: 'Optional voice plan used for narration synthesis.',
  },
  {
    key: 'bgm_mode',
    label: 'BGM Mode',
    input: 'select',
    required: false,
    helperText: 'Choose whether to skip music or point to a specific track.',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Custom', value: 'custom' },
    ] as const,
  },
  {
    key: 'bgm_path',
    label: 'BGM Path',
    input: 'text',
    required: false,
    placeholder: 'Optional background music path',
    helperText: 'Used only when the music source is set to a specific track.',
  },
  { key: 'bgm_volume', label: 'BGM Volume', input: 'number', required: true, placeholder: '0.3' },
] as const satisfies readonly PipelineFieldDefinition[];

const I2V_FIELDS = [
  { key: 'source_image', label: 'Source Image URL', input: 'text', required: true, placeholder: 'https://example.com/source.png' },
  { key: 'motion_prompt', label: 'Motion Prompt', input: 'textarea', required: true, placeholder: 'Describe the desired movement' },
  {
    key: 'media_workflow',
    label: 'Media Workflow',
    input: 'text',
    required: true,
    placeholder: 'selfhost/media_default.json',
    helperText: 'Required visual plan for turning images into motion clips.',
  },
  {
    key: 'bgm_mode',
    label: 'BGM Mode',
    input: 'select',
    required: false,
    helperText: 'Choose whether to skip music or point to a specific track.',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Custom', value: 'custom' },
    ] as const,
  },
  {
    key: 'bgm_path',
    label: 'BGM Path',
    input: 'text',
    required: false,
    placeholder: 'Optional background music path',
    helperText: 'Used only when the music source is set to a specific track.',
  },
  { key: 'bgm_volume', label: 'BGM Volume', input: 'number', required: true, placeholder: '0.3' },
] as const satisfies readonly PipelineFieldDefinition[];

const ACTION_TRANSFER_FIELDS = [
  { key: 'driver_video', label: 'Driver Video URL', input: 'text', required: true, placeholder: 'https://example.com/driver.mp4' },
  { key: 'target_image', label: 'Target Image URL', input: 'text', required: true, placeholder: 'https://example.com/target.png' },
  {
    key: 'pose_workflow',
    label: 'Pose Workflow',
    input: 'text',
    required: true,
    placeholder: 'selfhost/pose_default.json',
    helperText: 'Required motion plan that decides how the target image should move.',
  },
  {
    key: 'bgm_mode',
    label: 'BGM Mode',
    input: 'select',
    required: false,
    helperText: 'Choose whether to skip music or point to a specific track.',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Custom', value: 'custom' },
    ] as const,
  },
  {
    key: 'bgm_path',
    label: 'BGM Path',
    input: 'text',
    required: false,
    placeholder: 'Optional background music path',
    helperText: 'Used only when the music source is set to a specific track.',
  },
  { key: 'bgm_volume', label: 'BGM Volume', input: 'number', required: true, placeholder: '0.3' },
] as const satisfies readonly PipelineFieldDefinition[];

const CUSTOM_FIELDS = [
  {
    key: 'scenes',
    label: 'Scenes',
    input: 'json',
    required: true,
    helperText: 'Provide a JSON array of scenes with media, narration, and duration.',
    placeholder:
      '[{"media":"https://example.com/scene-1.png","narration":"Scene one narration","duration":4}]',
  },
  {
    key: 'bgm_mode',
    label: 'BGM Mode',
    input: 'select',
    required: false,
    helperText: 'Choose whether to skip music or point to a specific track.',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Custom', value: 'custom' },
    ] as const,
  },
  {
    key: 'bgm_path',
    label: 'BGM Path',
    input: 'text',
    required: false,
    placeholder: 'Optional background music path',
    helperText: 'Used only when the music source is set to a specific track.',
  },
  { key: 'bgm_volume', label: 'BGM Volume', input: 'number', required: true, placeholder: '0.3' },
] as const satisfies readonly PipelineFieldDefinition[];

const BASE_PIPELINE_METADATA: Record<BatchPipeline, PipelineMetadata> = {
  standard: {
    slug: 'quick',
    label: 'Quick',
    createHref: '/create/quick',
    description: 'Bulk-generate narrated short videos from text prompts and optional workflow overrides.',
    fields: STANDARD_FIELDS,
    exampleRow: {
      text: 'Write a concise batch-ready short video script.',
      mode: 'generate',
      title: 'Batch Quick Example',
      style_id: 'style-1014',
      n_scenes: '5',
      tts_workflow: 'selfhost/tts_edge.json',
      ref_audio: '',
      voice_id: '',
      min_narration_words: '5',
      max_narration_words: '20',
      min_image_prompt_words: '30',
      max_image_prompt_words: '60',
      media_workflow: 'selfhost/media_default.json',
      video_fps: '30',
      frame_template: '1080x1920/image_default.html',
      prompt_prefix: '',
      bgm_mode: 'default',
      bgm_path: '',
      bgm_volume: '0.3',
    },
  },
  digital_human: {
    slug: 'digital-human',
    label: 'Digital Human',
    createHref: '/create/digital-human',
    description: 'Batch-generate digital human videos with a portrait, narration, and optional voice workflow.',
    fields: DIGITAL_HUMAN_FIELDS,
    exampleRow: {
      portrait_url: 'https://example.com/portrait.png',
      narration: 'Welcome to the launch update.',
      voice_workflow: 'selfhost/tts_edge.json',
      bgm_mode: 'custom',
      bgm_path: '/bgm/history-track.mp3',
      bgm_volume: '0.3',
    },
  },
  i2v: {
    slug: 'i2v',
    label: 'Image → Video',
    createHref: '/create/i2v',
    description: 'Animate images into short motion clips using a required media workflow.',
    fields: I2V_FIELDS,
    exampleRow: {
      source_image: 'https://example.com/source.png',
      motion_prompt: 'Slow cinematic push-in with subtle head turn.',
      media_workflow: 'selfhost/media_default.json',
      bgm_mode: 'custom',
      bgm_path: '/bgm/history-track.mp3',
      bgm_volume: '0.3',
    },
  },
  action_transfer: {
    slug: 'action-transfer',
    label: '舞蹈复刻',
    createHref: '/create/action-transfer',
    description: '批量把舞蹈视频的动作复刻到目标图片上。',
    fields: ACTION_TRANSFER_FIELDS,
    exampleRow: {
      driver_video: 'https://example.com/driver.mp4',
      target_image: 'https://example.com/target.png',
      pose_workflow: 'selfhost/pose_default.json',
      bgm_mode: 'custom',
      bgm_path: '/bgm/history-track.mp3',
      bgm_volume: '0.3',
    },
  },
  asset_based: {
    slug: 'custom',
    label: 'Custom Asset',
    createHref: '/create/custom',
    description: 'Batch custom scene packages. Manual entry is disabled; import scenes JSON via CSV.',
    fields: CUSTOM_FIELDS,
    exampleRow: {
      scenes:
        '[{"media":"https://example.com/scene-1.png","narration":"Scene one narration","duration":4},{"media":"https://example.com/scene-2.mp4","narration":"Scene two narration","duration":6}]',
      bgm_mode: 'custom',
      bgm_path: '/bgm/history-track.mp3',
      bgm_volume: '0.3',
    },
  },
};

export const PIPELINE_METADATA = BASE_PIPELINE_METADATA;

function localizeFieldDefinition(field: PipelineFieldDefinition): PipelineFieldDefinition {
  switch (field.key) {
    case 'text':
      return { ...field, label: '文本', placeholder: '源文本或固定旁白' };
    case 'mode':
      return {
        ...field,
        label: '模式',
        options: [
          { label: '生成', value: 'generate' },
          { label: '固定', value: 'fixed' },
        ],
      };
    case 'title':
      return { ...field, label: '标题', placeholder: '可选标题' };
    case 'style_id':
      return {
        ...field,
        label: '风格预设',
        placeholder: '例如：style-1014',
        helperText: '可选。填写后会带入对应风格的视觉倾向和默认配乐。',
      };
    case 'n_scenes':
      return { ...field, label: '场景数', placeholder: '5' };
    case 'tts_workflow':
      return {
        ...field,
        label: '配音方案',
        placeholder: '例如：selfhost/tts_edge.json',
        helperText: '决定旁白如何生成。可填写本地或云端方案 key。',
      };
    case 'ref_audio':
      return { ...field, label: '参考配音', placeholder: '可选音频 URL/路径' };
    case 'voice_id':
      return { ...field, label: '语音 ID', placeholder: '兼容旧版 voice id' };
    case 'min_narration_words':
      return { ...field, label: '旁白最少词数', placeholder: '5' };
    case 'max_narration_words':
      return { ...field, label: '旁白最多词数', placeholder: '20' };
    case 'min_image_prompt_words':
      return { ...field, label: '提示词最少词数', placeholder: '30' };
    case 'max_image_prompt_words':
      return { ...field, label: '提示词最多词数', placeholder: '60' };
    case 'media_workflow':
      return {
        ...field,
        label: '画面方案',
        placeholder: '例如：selfhost/media_default.json',
        helperText: '决定图片或视频如何生成。',
      };
    case 'video_fps':
      return { ...field, label: '视频 FPS', placeholder: '30' };
    case 'frame_template':
      return { ...field, label: '画面模板', placeholder: '1080x1920/image_default.html' };
    case 'prompt_prefix':
      return { ...field, label: '提示词前缀', placeholder: '可选画面提示词前缀' };
    case 'bgm_mode':
      return {
        ...field,
        label: '背景音乐来源',
        helperText: '决定是否不使用背景音乐、沿用风格默认，或手动指定一条曲目。',
        options:
          field.options?.map((option) => ({
            value: option.value,
            label:
              option.value === 'none'
                ? '不使用'
                : option.value === 'default'
                  ? '风格默认'
                  : '从资源库选择',
          })) ?? field.options,
      };
    case 'bgm_path':
      return {
        ...field,
        label: '背景音乐文件',
        placeholder: '可选背景音乐 URL/路径',
        helperText: '仅在“从资源库选择”时使用。',
      };
    case 'bgm_volume':
      return { ...field, label: 'BGM 音量', placeholder: '0.3' };
    case 'portrait_url':
      return { ...field, label: '人像图片 URL', placeholder: 'https://example.com/portrait.png' };
    case 'narration':
      return { ...field, label: '旁白', placeholder: '数字人播报内容' };
    case 'voice_workflow':
      return {
        ...field,
        label: '配音方案',
        placeholder: '例如：selfhost/tts_edge.json',
        helperText: '决定数字人口播里的声音如何生成。',
      };
    case 'source_image':
      return { ...field, label: '源图片 URL', placeholder: 'https://example.com/source.png' };
    case 'motion_prompt':
      return { ...field, label: '运动提示词', placeholder: '描述希望出现的运动效果' };
    case 'driver_video':
      return { ...field, label: '驱动视频 URL', placeholder: 'https://example.com/driver.mp4' };
    case 'target_image':
      return { ...field, label: '目标图片 URL', placeholder: 'https://example.com/target.png' };
    case 'pose_workflow':
      return {
        ...field,
        label: '舞蹈复刻方案',
        placeholder: '例如：selfhost/pose_default.json',
        helperText: '决定舞蹈视频里的动作如何复刻到目标图片。',
      };
    case 'scenes':
      return {
        ...field,
        label: '场景列表',
        helperText: '提供一个 JSON 数组，包含每个场景的媒体、旁白和时长。',
        placeholder:
          '[{"media":"https://example.com/scene-1.png","narration":"场景一旁白","duration":4}]',
      };
    default:
      return field;
  }
}

export function getPipelineMetadata(pipeline: BatchPipeline): PipelineMetadata {
  const metadata = BASE_PIPELINE_METADATA[pipeline];
  const localizedDescriptions: Record<BatchPipeline, string> = {
    standard: '批量生成带旁白的短视频。适合把多个选题或脚本一次性跑完。',
    digital_human: '批量生成人像口播视频。每一行填写一个人像和对应旁白。',
    i2v: '批量把静态图片做成短视频。适合封面动画和镜头动效。',
    action_transfer: '批量做舞蹈复刻，让目标图片跟随舞蹈视频动起来。',
    asset_based: '批量提交自定义场景包。请通过 CSV 导入场景 JSON，不支持手动逐格填写。',
  };
  const localizedLabels: Record<BatchPipeline, string> = {
    standard: '快速创作',
    digital_human: '数字人',
    i2v: '图片转视频',
    action_transfer: '舞蹈复刻',
    asset_based: '自定义资产',
  };

  return {
    ...metadata,
    label: localizedLabels[pipeline],
    description: localizedDescriptions[pipeline],
    fields: metadata.fields.map(localizeFieldDefinition),
  };
}

const TERMINAL_BATCH_STATUSES: readonly BatchStatus[] = ['completed', 'failed', 'cancelled', 'partial'];

const PIPELINE_ALIASES: Record<string, BatchPipeline> = {
  standard: 'standard',
  quick: 'standard',
  digital_human: 'digital_human',
  'digital-human': 'digital_human',
  i2v: 'i2v',
  action_transfer: 'action_transfer',
  'action-transfer': 'action_transfer',
  asset_based: 'asset_based',
  custom: 'asset_based',
};

export function batchPipelineLabel(pipeline: BatchPipeline | string | null | undefined): string {
  if (!pipeline) {
    return '未知';
  }

  const normalized = PIPELINE_ALIASES[pipeline];
  if (normalized) {
    return getPipelineMetadata(normalized).label;
  }

  return pipeline;
}

export function batchStatusLabel(status: BatchStatus | string | null | undefined): string {
  switch (status) {
    case 'pending':
      return '排队中';
    case 'running':
      return '运行中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '已取消';
    case 'partial':
      return '部分完成';
    default:
      return '未知';
  }
}

export function batchStatusClassName(status: BatchStatus | string | null | undefined): string {
  switch (status) {
    case 'pending':
      return 'bg-[hsl(220,10%,38%)] text-white';
    case 'running':
      return 'bg-[hsl(215,95%,55%)] text-white';
    case 'completed':
      return 'bg-[hsl(145,70%,40%)] text-white';
    case 'failed':
      return 'bg-[hsl(3,80%,56%)] text-white';
    case 'cancelled':
      return 'bg-[hsl(32,85%,52%)] text-white';
    case 'partial':
      return 'bg-[hsl(48,95%,48%)] text-black';
    default:
      return 'border-border bg-muted text-foreground';
  }
}

export function isTerminalBatchStatus(status: BatchStatus | string | null | undefined): boolean {
  return status ? TERMINAL_BATCH_STATUSES.includes(status as BatchStatus) : false;
}

export function getBatchFinishedCount(batch: Pick<Batch, 'succeeded' | 'failed' | 'cancelled'>): number {
  return batch.succeeded + batch.failed + batch.cancelled;
}

export function getBatchProgressPercent(
  batch: Pick<Batch, 'total' | 'succeeded' | 'failed' | 'cancelled'>
): number {
  if (!batch.total) {
    return 0;
  }

  return Math.min(100, Math.round((getBatchFinishedCount(batch) / batch.total) * 100));
}

export function buildBatchDefaultName(timestamp = new Date()): string {
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hours = String(timestamp.getHours()).padStart(2, '0');
  const minutes = String(timestamp.getMinutes()).padStart(2, '0');
  const seconds = String(timestamp.getSeconds()).padStart(2, '0');
  return `批处理-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export function getBatchRequestFields(pipeline: BatchPipeline): readonly PipelineFieldDefinition[] {
  return getPipelineMetadata(pipeline).fields;
}

function escapeCsvCell(value: string): string {
  if (value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  if (value.includes(',') || value.includes('\n')) {
    return `"${value}"`;
  }

  return value;
}

export function buildBatchTemplateCsv(pipeline: BatchPipeline): string {
  const metadata = PIPELINE_METADATA[pipeline];
  const headers = metadata.fields.map((field) => field.key);
  const exampleValues = headers.map((header) => metadata.exampleRow[header] ?? '');
  const emptyValues = headers.map(() => '');
  const rows = [
    headers,
    exampleValues,
    emptyValues,
    [...emptyValues],
    [...emptyValues],
  ];

  return rows
    .map((row) => row.map((value) => escapeCsvCell(value)).join(','))
    .join('\n');
}

export function getBatchChildProgressMessage(task: Task): string {
  return task.progress?.message ?? batchStatusLabel(task.status);
}

export function getBatchChildProgressPercent(task: Task): number {
  if (typeof task.progress?.percentage === 'number') {
    return task.progress.percentage;
  }

  return task.status === 'completed' ? 100 : 0;
}
