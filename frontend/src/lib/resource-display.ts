import type { components } from '@/types/api';
import { getCurrentLocale, isZhLocale } from '@/lib/locale';

type WorkflowInfo = components['schemas']['WorkflowInfo'];
type BGMInfo = components['schemas']['BGMInfo'];
type LibraryBGMItem = components['schemas']['LibraryBGMItem'];
type StyleSummary = components['schemas']['StyleSummary'];
type ScriptItem = components['schemas']['ScriptItem'];
type PresetItem = components['schemas']['PresetItem'];

const WORKFLOW_REFERENCE_LABELS_ZH: Record<string, string> = {
  'tts_edge.json': 'Edge 配音方案',
  'tts_index2.json': 'IndexTTS 2 配音方案',
  'tts_spark.json': 'Spark 配音方案',
  'image_flux.json': 'Flux 画面方案',
  'image_flux2.json': 'Flux 2 画面方案',
  'image_qwen.json': 'Qwen 画面方案',
  'image_qwen_chinese_cartoon.json': 'Qwen 中文卡通画面方案',
  'image_sd3.5.json': 'SD 3.5 画面方案',
  'image_sdxl.json': 'SDXL 画面方案',
  'image_z-image.json': 'Z-Image 画面方案',
  'image_nano_banana.json': 'Nano Banana 画面方案',
  'video_wan2.1_fusionx.json': 'Wan 2.1 FusionX 视频方案',
  'video_wan2.2.json': 'Wan 2.2 视频方案',
  'video_qwen_wan2.2.json': 'Qwen Wan 2.2 视频方案',
  'video_z_image_wan2.2.json': 'Z-Image Wan 2.2 视频方案',
  'i2v_ltx2.json': 'LTX 2 图片转视频方案',
  'af_scail.json': 'Scail 动作迁移方案',
  'af_mock.json': '动作迁移测试方案',
};

const TOKEN_LABELS_ZH: Record<string, string> = {
  action: '动作',
  af: '动作',
  banana: 'Banana',
  cartoon: '卡通',
  chinese: '中文',
  creative: '创意',
  custom: '自定义',
  default: '默认',
  digital: '数字人',
  edge: 'Edge',
  flux: 'Flux',
  fusionx: 'FusionX',
  human: '数字人',
  i2v: '图片转视频',
  image: '画面',
  index2: 'IndexTTS 2',
  launch: '发布',
  llm: '模型',
  ltx2: 'LTX 2',
  media: '画面',
  nano: 'Nano',
  pose: '动作',
  preset: '预设',
  qwen: 'Qwen',
  quick: '快速创作',
  scail: 'Scail',
  'sd3.5': 'SD 3.5',
  sdxl: 'SDXL',
  spark: 'Spark',
  story: '故事',
  tts: '配音',
  video: '视频',
  voice: '配音',
  'wan2.1': 'Wan 2.1',
  'wan2.2': 'Wan 2.2',
  z: 'Z',
};

const PRESET_DISPLAY_NAMES_ZH: Record<string, string> = {
  'Creative LLM Preset': '创意模型预设',
  'Launch Quick Preset': '快速创作预设',
};

export interface ConfigSummaryItem {
  key: string;
  label: string;
  value: string;
  detail?: string | null;
}

function getLeafName(value: string | null | undefined): string {
  return value?.split('/').pop()?.trim() ?? '';
}

function humanizeTokensZh(raw: string): string {
  const normalized = raw
    .replace(/\.json$/i, '')
    .replace(/\.mp3$/i, '')
    .replace(/\.wav$/i, '')
    .replace(/-/g, '_');
  const tokens = normalized.split('_').filter(Boolean);
  return tokens
    .map((token) => TOKEN_LABELS_ZH[token.toLowerCase()] ?? token.replace(/\b\w/g, (char) => char.toUpperCase()))
    .filter(Boolean)
    .join(' ')
    .trim();
}

function workflowSuffixZh(reference: string): string {
  const lowered = reference.toLowerCase();
  if (lowered.startsWith('tts_')) {
    return '配音方案';
  }
  if (lowered.startsWith('image_')) {
    return '画面方案';
  }
  if (lowered.startsWith('video_')) {
    return '视频方案';
  }
  if (lowered.startsWith('i2v_')) {
    return '图片转视频方案';
  }
  if (lowered.startsWith('af_')) {
    return '动作迁移方案';
  }
  return '生成方案';
}

function pipelineLabelZh(pipeline: string | null | undefined): string {
  switch (pipeline) {
    case 'quick':
    case 'standard':
      return '快速创作';
    case 'digital-human':
    case 'digital_human':
      return '数字人';
    case 'i2v':
      return '图片转视频';
    case 'action-transfer':
    case 'action_transfer':
      return '动作迁移';
    case 'custom':
    case 'asset_based':
      return '自定义资产';
    case 'llm':
      return '模型配置';
    default:
      return '创作流程';
  }
}

function sourceLabel(source: string | null | undefined, locale = getCurrentLocale()): string {
  const zh = isZhLocale(locale);
  if (source === 'runninghub') {
    return 'RunningHub';
  }
  if (source === 'selfhost') {
    return zh ? '本地' : 'Self-host';
  }
  if (source === 'builtin' || source === 'default') {
    return zh ? '内建资源' : 'Built-in';
  }
  if (source === 'history' || source === 'custom') {
    return zh ? '我的资源' : 'My Library';
  }
  return source || (zh ? '未知来源' : 'Unknown source');
}

export function getWorkflowDisplayName(workflow: WorkflowInfo, locale = getCurrentLocale()): string {
  if (isZhLocale(locale)) {
    return workflow.display_name_zh || workflow.display_name || workflow.name;
  }
  return workflow.display_name || workflow.technical_name || workflow.name;
}

export function getWorkflowSourceLabel(workflow: WorkflowInfo, locale = getCurrentLocale()): string {
  return sourceLabel(workflow.source, locale);
}

export function getWorkflowDescription(workflow: WorkflowInfo, locale = getCurrentLocale()): string | null {
  if (isZhLocale(locale)) {
    return workflow.description_zh || `${getWorkflowCategoryLabel(workflow, locale)} · ${getWorkflowSourceLabel(workflow, locale)}`;
  }
  return workflow.display_name || workflow.technical_name || null;
}

export function getWorkflowCategoryLabel(workflow: WorkflowInfo, locale = getCurrentLocale()): string {
  if (isZhLocale(locale)) {
    return workflow.display_category_zh || workflow.display_category || '生成方案';
  }
  return workflow.display_category || 'Workflow';
}

export function getWorkflowOptionLabel(workflow: WorkflowInfo, locale = getCurrentLocale()): string {
  return `${getWorkflowDisplayName(workflow, locale)} · ${getWorkflowSourceLabel(workflow, locale)}`;
}

export function getWorkflowTechnicalLabel(workflow: WorkflowInfo): string | null {
  return workflow.technical_name || workflow.name || null;
}

export function getWorkflowReferenceDisplayName(
  reference: string | null | undefined,
  locale = getCurrentLocale()
): string {
  if (!reference) {
    return isZhLocale(locale) ? '未命名方案' : 'Unknown plan';
  }

  const leafName = getLeafName(reference);
  if (!leafName) {
    return reference;
  }

  if (!isZhLocale(locale)) {
    return leafName;
  }

  const exactMatch = WORKFLOW_REFERENCE_LABELS_ZH[leafName.toLowerCase()];
  if (exactMatch) {
    return exactMatch;
  }

  const stem = leafName.replace(/\.json$/i, '');
  const withoutPrefix = stem
    .replace(/^tts_/i, '')
    .replace(/^image_/i, '')
    .replace(/^video_/i, '')
    .replace(/^i2v_/i, '')
    .replace(/^af_/i, '');
  const baseLabel = humanizeTokensZh(withoutPrefix) || humanizeTokensZh(stem);
  const suffix = workflowSuffixZh(stem);

  return baseLabel.endsWith(suffix) ? baseLabel : `${baseLabel} ${suffix}`.trim();
}

export function getWorkflowReferenceDescription(
  reference: string | null | undefined,
  locale = getCurrentLocale()
): string | null {
  if (!reference) {
    return null;
  }
  if (!isZhLocale(locale)) {
    return getLeafName(reference) || reference;
  }

  const lowered = getLeafName(reference).toLowerCase();
  if (lowered.startsWith('tts_')) {
    return '用于生成旁白与配音，可直接复用同一套音色或语音服务。';
  }
  if (lowered.startsWith('image_')) {
    return '用于生成单张画面、封面图或静态素材。';
  }
  if (lowered.startsWith('video_')) {
    return '用于生成短视频镜头或动态片段。';
  }
  if (lowered.startsWith('i2v_')) {
    return '用于把单张图片转换为短视频动态镜头。';
  }
  if (lowered.startsWith('af_')) {
    return '用于动作迁移、姿态驱动或镜头动作重定向。';
  }
  return '用于像影 Pixelle 的生成流程。';
}

export function getWorkflowTagLabels(workflow: WorkflowInfo, locale = getCurrentLocale()): string[] {
  const tags = workflow.display_tags?.filter(Boolean) ?? [];
  if (tags.length > 0) {
    return tags;
  }

  return [getWorkflowCategoryLabel(workflow, locale), getWorkflowSourceLabel(workflow, locale)];
}

export function getStyleDisplayName(style: StyleSummary, locale = getCurrentLocale()): string {
  if (isZhLocale(locale)) {
    return style.display_name_zh || style.name;
  }
  return style.name;
}

export function getStyleSummary(style: StyleSummary, locale = getCurrentLocale()): string | null {
  if (isZhLocale(locale)) {
    return style.short_description_zh || style.description || null;
  }
  return style.description || [style.scene, style.tone].filter(Boolean).join(' · ') || null;
}

export function getStyleOptionLabel(style: StyleSummary, locale = getCurrentLocale()): string {
  const summary = getStyleSummary(style, locale);
  return summary ? `${getStyleDisplayName(style, locale)} · ${summary}` : getStyleDisplayName(style, locale);
}

type BgmLike = BGMInfo | LibraryBGMItem;

export function getBgmDisplayName(bgm: BgmLike, locale = getCurrentLocale()): string {
  if (isZhLocale(locale)) {
    return bgm.display_name_zh || bgm.linked_style_display_name_zh || bgm.linked_style_name || bgm.name;
  }
  return bgm.name;
}

export function getBgmDescription(bgm: BgmLike, locale = getCurrentLocale()): string | null {
  if (isZhLocale(locale)) {
    return bgm.description_zh || bgm.technical_name || bgm.name;
  }
  return bgm.technical_name || bgm.name;
}

export function getBgmOptionLabel(bgm: BgmLike, locale = getCurrentLocale()): string {
  const source = bgm.source_label || sourceLabel(bgm.source, locale);
  return `${getBgmDisplayName(bgm, locale)} · ${source}`;
}

export function getBgmTechnicalName(bgm: BgmLike): string | null {
  return bgm.technical_name || bgm.name || null;
}

export function getBgmModeLabel(
  mode: 'default' | 'custom' | 'none' | null | undefined,
  locale = getCurrentLocale()
): string {
  if (!isZhLocale(locale)) {
    if (mode === 'default') {
      return 'Use the style default track';
    }
    if (mode === 'custom') {
      return 'Pick from the library';
    }
    return 'No background music';
  }

  if (mode === 'default') {
    return '使用风格默认曲目';
  }
  if (mode === 'custom') {
    return '从资源库选择';
  }
  return '不使用背景音乐';
}

export function getScriptTypeLabel(script: ScriptItem, locale = getCurrentLocale()): string {
  if (isZhLocale(locale)) {
    return script.type_label_zh || script.script_type;
  }
  return script.script_type;
}

export function getScriptSummaryLabel(script: ScriptItem, locale = getCurrentLocale()): string {
  if (isZhLocale(locale)) {
    return script.summary_zh || script.type_label_zh || '内容草稿';
  }
  return script.script_type;
}

export function getScriptPipelineLabel(script: ScriptItem, fallback: string, locale = getCurrentLocale()): string {
  if (isZhLocale(locale)) {
    return script.pipeline_label_zh || fallback;
  }
  return fallback;
}

export function getScriptPromptLabel(promptUsed: string | null | undefined, locale = getCurrentLocale()): string | null {
  if (!promptUsed) {
    return null;
  }
  return isZhLocale(locale) ? `关联提示：${promptUsed}` : `Prompt: ${promptUsed}`;
}

export function getBgmSourceLabel(bgm: BgmLike, locale = getCurrentLocale()): string {
  return bgm.source_label || sourceLabel(bgm.source, locale);
}

export function getPresetDisplayName(
  preset: Pick<PresetItem, 'name' | 'pipeline'>,
  locale = getCurrentLocale()
): string {
  if (!isZhLocale(locale)) {
    return preset.name;
  }

  const original = preset.name.trim();
  if (!original) {
    return `${pipelineLabelZh(preset.pipeline)}预设`;
  }
  if (/[\u4e00-\u9fff]/.test(original)) {
    return original;
  }
  if (PRESET_DISPLAY_NAMES_ZH[original]) {
    return PRESET_DISPLAY_NAMES_ZH[original];
  }

  const normalized = original
    .replace(/Image\s*(→|to)\s*Video/gi, '图片转视频')
    .replace(/Action\s*Transfer/gi, '动作迁移')
    .replace(/Digital\s*Human/gi, '数字人')
    .replace(/\bQuick\b/gi, '快速创作')
    .replace(/\bLaunch\b/gi, '发布')
    .replace(/\bCreative\b/gi, '创意')
    .replace(/\bLLM\b/gi, '模型')
    .replace(/\bPreset\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const fallback = normalized || pipelineLabelZh(preset.pipeline);
  return fallback.endsWith('预设') ? fallback : `${fallback}预设`;
}

export function getPresetDescription(
  preset: Pick<PresetItem, 'description' | 'pipeline'>,
  locale = getCurrentLocale()
): string | null {
  if (!isZhLocale(locale)) {
    return preset.description ?? null;
  }

  if (preset.description && /[\u4e00-\u9fff]/.test(preset.description)) {
    return preset.description;
  }

  return `适用于${pipelineLabelZh(preset.pipeline)}的复用配置。`;
}

export function getStyleReferenceDisplayName(
  styleId: string | null | undefined,
  locale = getCurrentLocale()
): string {
  if (!styleId || styleId === '__none__') {
    return isZhLocale(locale) ? '未使用风格方案' : 'No style plan';
  }
  if (!isZhLocale(locale)) {
    return styleId;
  }

  const numericId = /^style-(.+)$/i.exec(styleId)?.[1];
  if (numericId) {
    return `风格 ${numericId}`;
  }
  return styleId;
}
