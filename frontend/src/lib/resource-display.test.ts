import { describe, expect, it } from 'vitest';

import type { components } from '@/types/api';
import {
  getBgmDescription,
  getBgmDisplayName,
  getBgmModeLabel,
  getBgmOptionLabel,
  getBgmSourceLabel,
  getPresetDescription,
  getPresetDisplayName,
  getScriptPipelineLabel,
  getScriptPromptLabel,
  getScriptSummaryLabel,
  getScriptTypeLabel,
  getStyleDisplayName,
  getStyleOptionLabel,
  getStyleReferenceDisplayName,
  getStyleSummary,
  getWorkflowCategoryLabel,
  getWorkflowDescription,
  getWorkflowDisplayName,
  getWorkflowOptionLabel,
  getWorkflowReferenceDescription,
  getWorkflowReferenceDisplayName,
  getWorkflowSourceLabel,
  getWorkflowTagLabels,
} from './resource-display';

type WorkflowInfo = components['schemas']['WorkflowInfo'];
type BGMInfo = components['schemas']['BGMInfo'];
type PresetItem = components['schemas']['PresetItem'];
type ScriptItem = components['schemas']['ScriptItem'];
type StyleSummary = components['schemas']['StyleSummary'];

const workflow: WorkflowInfo = {
  display_category: 'Workflow',
  display_category_zh: '视频方案',
  display_name: 'Wan workflow',
  display_name_zh: 'Wan 视频方案',
  display_tags: [],
  key: 'selfhost/video_wan2.2.json',
  name: 'video_wan2.2.json',
  path: '/workflows/video_wan2.2.json',
  source: 'selfhost',
  technical_name: 'video_wan2.2.json',
};

const bgm: BGMInfo = {
  description_zh: '节奏明快的背景音乐',
  display_name_zh: '发布会配乐',
  name: 'launch.mp3',
  path: '/bgm/launch.mp3',
  source: 'default',
  technical_name: 'launch.mp3',
};

describe('resource-display Chinese labels', () => {
  it('formats workflow labels and fallbacks in Chinese', () => {
    expect(getWorkflowDisplayName(workflow)).toBe('Wan 视频方案');
    expect(getWorkflowSourceLabel(workflow)).toBe('本地');
    expect(getWorkflowSourceLabel({ ...workflow, source: 'runninghub' })).toBe('RunningHub');
    expect(getWorkflowSourceLabel({ ...workflow, source: 'builtin' })).toBe('内建资源');
    expect(getWorkflowSourceLabel({ ...workflow, source: 'history' })).toBe('我的资源');
    expect(getWorkflowSourceLabel({ ...workflow, source: '' })).toBe('未知来源');
    expect(getWorkflowDescription(workflow)).toBe('视频方案 · 本地');
    expect(getWorkflowCategoryLabel(workflow)).toBe('视频方案');
    expect(getWorkflowOptionLabel(workflow)).toBe('Wan 视频方案 · 本地');
    expect(getWorkflowTagLabels(workflow)).toEqual(['视频方案', '本地']);
  });

  it('humanizes workflow references and descriptions in Chinese', () => {
    expect(getWorkflowReferenceDisplayName(null)).toBe('未命名方案');
    expect(getWorkflowReferenceDisplayName('/')).toBe('/');
    expect(getWorkflowReferenceDisplayName('selfhost/video_wan2.2.json')).toBe('Wan 2.2 视频方案');
    expect(getWorkflowReferenceDisplayName('selfhost/tts_spark.json')).toBe('Spark 配音方案');
    expect(getWorkflowReferenceDisplayName('selfhost/image_custom.json')).toBe('自定义 画面方案');
    expect(getWorkflowReferenceDescription('selfhost/tts_edge.json')).toBe('用于生成旁白与配音，可直接复用同一套音色或语音服务。');
    expect(getWorkflowReferenceDescription('selfhost/image_flux.json')).toBe('用于生成单张画面、封面图或静态素材。');
    expect(getWorkflowReferenceDescription('selfhost/video_wan2.2.json')).toBe('用于生成短视频镜头或动态片段。');
    expect(getWorkflowReferenceDescription('selfhost/i2v_ltx2.json')).toBe('用于把单张图片转换为短视频动态镜头。');
    expect(getWorkflowReferenceDescription('selfhost/af_scail.json')).toBe('用于动作迁移、姿态驱动或镜头动作重定向。');
    expect(getWorkflowReferenceDescription('unknown.json')).toBe('用于像影 Pixelle 的生成流程。');
  });

  it('formats style, BGM, script, and preset labels in Chinese', () => {
    const style: StyleSummary = {
      description: 'fallback description',
      display_name_zh: '赛博夜景',
      id: 'style-42',
      is_builtin: true,
      name: 'Cyber Night',
      short_description_zh: '霓虹城市镜头',
    };
    const script: ScriptItem = {
      id: 'script-1',
      pipeline_label_zh: '快速创作',
      script_type: 'prompt',
      summary_zh: '画面提示词',
      text: 'text',
      type_label_zh: '提示词',
    };
    const preset: PresetItem = {
      description: 'Reusable preset',
      name: 'Launch Quick Preset',
      pipeline: 'quick',
      source: 'builtin',
    };

    expect(getStyleDisplayName(style)).toBe('赛博夜景');
    expect(getStyleSummary(style)).toBe('霓虹城市镜头');
    expect(getStyleOptionLabel(style)).toBe('赛博夜景 · 霓虹城市镜头');
    expect(getStyleReferenceDisplayName(null)).toBe('未使用风格方案');
    expect(getStyleReferenceDisplayName('style-42')).toBe('风格 42');
    expect(getStyleReferenceDisplayName('custom-style')).toBe('custom-style');
    expect(getBgmDisplayName(bgm)).toBe('发布会配乐');
    expect(getBgmDescription(bgm)).toBe('节奏明快的背景音乐');
    expect(getBgmOptionLabel(bgm)).toBe('发布会配乐 · 内建资源');
    expect(getBgmSourceLabel({ ...bgm, source_label: '资源库' })).toBe('资源库');
    expect(getScriptTypeLabel(script)).toBe('提示词');
    expect(getScriptSummaryLabel(script)).toBe('画面提示词');
    expect(getScriptPipelineLabel(script, 'fallback')).toBe('快速创作');
    expect(getScriptPromptLabel('写一个开场')).toBe('关联提示：写一个开场');
    expect(getPresetDisplayName(preset)).toBe('快速创作预设');
    expect(getPresetDisplayName({ ...preset, name: 'Image to Video Preset', pipeline: 'i2v' })).toBe('图片转视频预设');
    expect(getPresetDisplayName({ ...preset, name: '已有中文预设' })).toBe('已有中文预设');
    expect(getPresetDisplayName({ ...preset, name: '' })).toBe('快速创作预设');
    expect(getPresetDescription(preset)).toBe('适用于快速创作的复用配置。');
    expect(getPresetDescription({ ...preset, description: '中文描述' })).toBe('中文描述');
  });

  it('formats BGM modes in Chinese', () => {
    expect(getBgmModeLabel('default')).toBe('使用风格默认曲目');
    expect(getBgmModeLabel('custom')).toBe('从资源库选择');
    expect(getBgmModeLabel('none')).toBe('不使用背景音乐');
    expect(getBgmModeLabel(null)).toBe('不使用背景音乐');
  });
});
