import Papa from 'papaparse';

import { getPipelineMetadata, type BatchPayloadByPipeline, type BatchPipeline } from '@/lib/batch-utils';

export const MAX_BATCH_CSV_ROWS = 100;
const DEFAULT_BGM_VOLUME = 0.3;
const OPTIONAL_BATCH_HEADERS = new Set(['style_id', 'bgm_mode', 'bgm_path', 'bgm_volume']);

type RawCsvRow = Record<string, string>;
export type BatchCsvRow<TPipeline extends BatchPipeline = BatchPipeline> = {
  errors: string[];
  id: string;
  payload: BatchPayloadByPipeline[TPipeline] | null;
  raw: RawCsvRow;
};

export interface ParsedCsvImport<TPipeline extends BatchPipeline = BatchPipeline> {
  fileErrors: string[];
  headers: string[];
  rows: BatchCsvRow<TPipeline>[];
}

function csvLabel(key: string): string {
  return {
    text: '文本',
    style_id: '风格预设',
    n_scenes: '场景数',
    min_narration_words: '旁白最少词数',
    max_narration_words: '旁白最多词数',
    min_image_prompt_words: '提示词最少词数',
    max_image_prompt_words: '提示词最多词数',
    bgm_mode: '背景音乐来源',
    bgm_path: '背景音乐文件',
    video_fps: '视频 FPS',
    bgm_volume: '背景音乐音量',
    portrait_url: '人像图片 URL',
    narration: '旁白',
    source_image: '源图片 URL',
    motion_prompt: '运动提示词',
    media_workflow: '画面方案',
    driver_video: '驱动视频 URL',
    target_image: '目标图片 URL',
    pose_workflow: '动作方案',
    scenes: '场景列表',
  }[key] ?? key;
}

function parseBgmMode(
  raw: RawCsvRow,
  allowedModes: Array<'default' | 'custom' | 'none'>,
  errors: string[]
): 'default' | 'custom' | 'none' | null {
  const value = (raw.bgm_mode?.trim().toLowerCase() ?? '') as 'default' | 'custom' | 'none' | '';
  if (!value) {
    return null;
  }

  if (allowedModes.includes(value)) {
    return value;
  }

  errors.push(
    `背景音乐来源必须是 ${allowedModes
      .map((mode) =>
        mode === 'default' ? '使用风格默认曲目' : mode === 'custom' ? '从资源库选择' : '不使用背景音乐'
      )
      .join(' / ')}。`
  );
  return null;
}

function parseBgmConfig(
  raw: RawCsvRow,
  errors: string[],
  allowedModes: Array<'default' | 'custom' | 'none'>
): {
  bgm_mode: 'default' | 'custom' | 'none';
  bgm_path: string | null;
  bgm_volume: number;
} {
  const bgmPath = optionalString(raw, 'bgm_path');
  const requestedMode = parseBgmMode(raw, allowedModes, errors);
  const derivedMode = requestedMode ?? (bgmPath ? 'custom' : 'none');

  if (derivedMode === 'custom' && !bgmPath) {
    errors.push('当背景音乐来源为“从资源库选择”时，必须提供背景音乐文件。');
  }

  return {
    bgm_mode: derivedMode,
    bgm_path: bgmPath,
    bgm_volume: parseNumber(raw, 'bgm_volume', csvLabel('bgm_volume'), errors, DEFAULT_BGM_VOLUME),
  };
}

function normalizeRawRow(row: Record<string, unknown>): RawCsvRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : ''])
  );
}

function requiredString(raw: RawCsvRow, key: string, label: string, errors: string[]): string {
  const value = raw[key]?.trim() ?? '';
  if (!value) {
    errors.push(`${label}为必填项。`);
  }
  return value;
}

function optionalString(raw: RawCsvRow, key: string): string | null {
  const value = raw[key]?.trim() ?? '';
  return value ? value : null;
}

function parseNumber(
  raw: RawCsvRow,
  key: string,
  label: string,
  errors: string[],
  fallback: number
): number {
  const value = raw[key]?.trim() ?? '';
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    errors.push(`${label}必须是有效数字。`);
    return fallback;
  }

  return parsed;
}

function requireUrl(raw: RawCsvRow, key: string, label: string, errors: string[]): string {
  const value = requiredString(raw, key, label, errors);
  if (!value) {
    return value;
  }

  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    errors.push(`${label}必须是有效 URL。`);
    return value;
  }
}

function parseScenes(raw: RawCsvRow, errors: string[]): BatchPayloadByPipeline['asset_based']['scenes'] {
  const value = requiredString(raw, 'scenes', '场景', errors);
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      errors.push('场景必须是 JSON 数组。');
      return [];
    }

    return parsed.flatMap((scene, index) => {
      if (typeof scene !== 'object' || scene === null) {
        errors.push(`场景 ${index + 1} 必须是对象。`);
        return [];
      }

      const media = typeof scene.media === 'string' ? scene.media.trim() : '';
      const narration = typeof scene.narration === 'string' ? scene.narration.trim() : '';
      const duration = typeof scene.duration === 'number' ? scene.duration : Number(scene.duration);

      if (!media) {
        errors.push(`场景 ${index + 1} 的媒体为必填项。`);
      } else {
        try {
          void new URL(media);
        } catch {
          errors.push(`场景 ${index + 1} 的媒体必须是有效 URL。`);
        }
      }

      if (!narration) {
        errors.push(`场景 ${index + 1} 的旁白为必填项。`);
      }

      if (!Number.isFinite(duration)) {
        errors.push(`场景 ${index + 1} 的时长必须是有效数字。`);
      }

      return media && narration && Number.isFinite(duration)
        ? [{ media, narration, duration }]
        : [];
    });
  } catch {
    errors.push('场景必须是有效 JSON。');
    return [];
  }
}

export function buildEmptyRow<TPipeline extends BatchPipeline>(pipeline: TPipeline): RawCsvRow {
  const metadata = getPipelineMetadata(pipeline);
  return Object.fromEntries(
    metadata.fields
      .filter((field) => !OPTIONAL_BATCH_HEADERS.has(field.key))
      .map((field) => [field.key, ''])
  );
}

export function coerceBatchRow<TPipeline extends BatchPipeline>(
  pipeline: TPipeline,
  raw: RawCsvRow
): BatchCsvRow<TPipeline> {
  const errors: string[] = [];

  if (pipeline === 'standard') {
    const bgmConfig = parseBgmConfig(raw, errors, ['default', 'custom', 'none']);
    const payload: BatchPayloadByPipeline['standard'] = {
      text: requiredString(raw, 'text', csvLabel('text'), errors),
      mode: raw.mode === 'fixed' ? 'fixed' : 'generate',
      title: optionalString(raw, 'title'),
      style_id: optionalString(raw, 'style_id'),
      n_scenes: parseNumber(raw, 'n_scenes', csvLabel('n_scenes'), errors, 5),
      tts_workflow: optionalString(raw, 'tts_workflow'),
      ref_audio: optionalString(raw, 'ref_audio'),
      voice_id: optionalString(raw, 'voice_id'),
      min_narration_words: parseNumber(raw, 'min_narration_words', csvLabel('min_narration_words'), errors, 5),
      max_narration_words: parseNumber(raw, 'max_narration_words', csvLabel('max_narration_words'), errors, 20),
      min_image_prompt_words: parseNumber(raw, 'min_image_prompt_words', csvLabel('min_image_prompt_words'), errors, 30),
      max_image_prompt_words: parseNumber(raw, 'max_image_prompt_words', csvLabel('max_image_prompt_words'), errors, 60),
      media_workflow: optionalString(raw, 'media_workflow'),
      video_fps: parseNumber(raw, 'video_fps', csvLabel('video_fps'), errors, 30),
      frame_template: optionalString(raw, 'frame_template'),
      template_params: null,
      prompt_prefix: optionalString(raw, 'prompt_prefix'),
      ...bgmConfig,
      project_id: null,
    };

    return {
      id: crypto.randomUUID(),
      raw,
      payload: errors.length === 0 ? (payload as BatchPayloadByPipeline[TPipeline]) : null,
      errors,
    };
  }

  if (pipeline === 'digital_human') {
    const bgmConfig = parseBgmConfig(raw, errors, ['custom', 'none']);
    const payload: BatchPayloadByPipeline['digital_human'] = {
      ...bgmConfig,
      portrait_url: requireUrl(raw, 'portrait_url', csvLabel('portrait_url'), errors),
      narration: requiredString(raw, 'narration', csvLabel('narration'), errors),
      voice_workflow: optionalString(raw, 'voice_workflow'),
      project_id: null,
    };

    return {
      id: crypto.randomUUID(),
      raw,
      payload: errors.length === 0 ? (payload as BatchPayloadByPipeline[TPipeline]) : null,
      errors,
    };
  }

  if (pipeline === 'i2v') {
    const bgmConfig = parseBgmConfig(raw, errors, ['custom', 'none']);
    const payload: BatchPayloadByPipeline['i2v'] = {
      ...bgmConfig,
      source_image: requireUrl(raw, 'source_image', csvLabel('source_image'), errors),
      motion_prompt: requiredString(raw, 'motion_prompt', csvLabel('motion_prompt'), errors),
      media_workflow: requiredString(raw, 'media_workflow', csvLabel('media_workflow'), errors),
      project_id: null,
    };

    return {
      id: crypto.randomUUID(),
      raw,
      payload: errors.length === 0 ? (payload as BatchPayloadByPipeline[TPipeline]) : null,
      errors,
    };
  }

  if (pipeline === 'action_transfer') {
    const bgmConfig = parseBgmConfig(raw, errors, ['custom', 'none']);
    const payload: BatchPayloadByPipeline['action_transfer'] = {
      ...bgmConfig,
      driver_video: requireUrl(raw, 'driver_video', csvLabel('driver_video'), errors),
      target_image: requireUrl(raw, 'target_image', csvLabel('target_image'), errors),
      pose_workflow: requiredString(raw, 'pose_workflow', csvLabel('pose_workflow'), errors),
      project_id: null,
    };

    return {
      id: crypto.randomUUID(),
      raw,
      payload: errors.length === 0 ? (payload as BatchPayloadByPipeline[TPipeline]) : null,
      errors,
    };
  }

  const scenes = parseScenes(raw, errors);
  const bgmConfig = parseBgmConfig(raw, errors, ['custom', 'none']);
  const payload: BatchPayloadByPipeline['asset_based'] = {
    ...bgmConfig,
    scenes,
    project_id: null,
  };

  return {
    id: crypto.randomUUID(),
    raw,
    payload: errors.length === 0 ? (payload as BatchPayloadByPipeline[TPipeline]) : null,
    errors,
  };
}

export function parseBatchCsv<TPipeline extends BatchPipeline>(
  pipeline: TPipeline,
  fileText: string
): ParsedCsvImport<TPipeline> {
  if (!fileText.trim()) {
    return {
      headers: [],
      rows: [],
      fileErrors: ['CSV 文件为空。'],
    };
  }

  const metadata = getPipelineMetadata(pipeline);
  const allowedHeaders = metadata.fields.map((field) => field.key);
  const expectedHeaders = metadata.fields
    .map((field) => field.key)
    .filter((field) => !OPTIONAL_BATCH_HEADERS.has(field));
  const parsed = Papa.parse<Record<string, unknown>>(fileText, {
    delimiter: ',',
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    return {
      headers: [],
      rows: [],
      fileErrors: parsed.errors.map((error) => error.message),
    };
  }

  const headers = parsed.meta.fields ?? [];
  const missingHeaders = expectedHeaders.filter((header) => !headers.includes(header));
  const extraHeaders = headers.filter((header) => !allowedHeaders.includes(header));
  const fileErrors: string[] = [];

  if (missingHeaders.length > 0) {
    fileErrors.push(`缺少表头：${missingHeaders.join(', ')}`);
  }
  if (extraHeaders.length > 0) {
    fileErrors.push(`存在多余表头：${extraHeaders.join(', ')}`);
  }
  if (parsed.data.length > MAX_BATCH_CSV_ROWS) {
    fileErrors.push(`CSV 超过最大 ${MAX_BATCH_CSV_ROWS} 行限制。`);
  }

  const rows = parsed.data.slice(0, MAX_BATCH_CSV_ROWS).map((row) => coerceBatchRow(pipeline, normalizeRawRow(row)));

  return {
    fileErrors,
    headers,
    rows,
  };
}

export function updateParsedCsvRow<TPipeline extends BatchPipeline>(
  pipeline: TPipeline,
  row: BatchCsvRow<TPipeline>,
  key: string,
  value: string
): BatchCsvRow<TPipeline> {
  return coerceBatchRow(pipeline, {
    ...row.raw,
    [key]: value,
  });
}
