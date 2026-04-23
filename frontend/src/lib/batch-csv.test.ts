import { beforeEach, describe, expect, it } from 'vitest';

import { buildEmptyRow, coerceBatchRow, MAX_BATCH_CSV_ROWS, parseBatchCsv, updateParsedCsvRow } from './batch-csv';

describe('batch-csv', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
  });

  it('parses a valid i2v csv file', () => {
    const parsed = parseBatchCsv(
      'i2v',
      ['source_image,motion_prompt,media_workflow', 'https://example.com/source.png,Slow push-in,selfhost/media_default.json'].join('\n')
    );

    expect(parsed.fileErrors).toEqual([]);
    expect(parsed.rows[0]?.errors).toEqual([]);
    expect(parsed.rows[0]?.payload).toMatchObject({
      source_image: 'https://example.com/source.png',
      motion_prompt: 'Slow push-in',
      media_workflow: 'selfhost/media_default.json',
    });
  });

  it('fails on an empty csv file', () => {
    const parsed = parseBatchCsv('digital_human', '');
    expect(parsed.fileErrors).toContain('CSV 文件为空。');
  });

  it('reports missing and unexpected headers', () => {
    const parsed = parseBatchCsv('digital_human', 'portrait_url,wrong_header\nhttps://example.com/p.png,value');
    expect(parsed.fileErrors.join(' ')).toContain('缺少表头：narration');
    expect(parsed.fileErrors.join(' ')).toContain('存在多余表头：wrong_header');
  });

  it('reports invalid field types', () => {
    const parsed = parseBatchCsv(
      'standard',
      ['text,mode,title,n_scenes,tts_workflow,ref_audio,voice_id,min_narration_words,max_narration_words,min_image_prompt_words,max_image_prompt_words,media_workflow,video_fps,frame_template,prompt_prefix,bgm_path,bgm_volume',
        'Batch text,generate,Title,not-a-number,,,,5,20,30,60,selfhost/media_default.json,30,1080x1920/image_default.html,,,0.3'].join('\n')
    );

    expect(parsed.rows[0]?.errors).toContain('场景数必须是有效数字。');
    expect(parsed.rows[0]?.payload).toBeNull();
  });

  it('coerces a valid standard row with numeric defaults', () => {
    const row = coerceBatchRow('standard', {
      text: 'A batch-ready story',
      mode: 'fixed',
      title: 'Story',
      n_scenes: '',
      tts_workflow: '',
      ref_audio: '',
      voice_id: '',
      min_narration_words: '',
      max_narration_words: '',
      min_image_prompt_words: '',
      max_image_prompt_words: '',
      media_workflow: '',
      video_fps: '',
      frame_template: '',
      prompt_prefix: '',
      bgm_path: '',
      bgm_volume: '',
    });

    expect(row.errors).toEqual([]);
    expect(row.payload).toMatchObject({
      text: 'A batch-ready story',
      mode: 'fixed',
      n_scenes: 5,
      bgm_volume: 0.3,
    });
  });

  it('coerces a valid digital human row and preserves optional nulls', () => {
    const row = coerceBatchRow('digital_human', {
      portrait_url: 'https://example.com/portrait.png',
      narration: 'Hello from the presenter.',
      voice_workflow: '',
    });

    expect(row.errors).toEqual([]);
    expect(row.payload).toMatchObject({
      portrait_url: 'https://example.com/portrait.png',
      narration: 'Hello from the presenter.',
      voice_workflow: null,
    });
  });

  it('reports missing required digital human fields', () => {
    const row = coerceBatchRow('digital_human', {
      portrait_url: '',
      narration: '',
      voice_workflow: '',
    });

    expect(row.errors).toContain('人像图片 URL为必填项。');
    expect(row.errors).toContain('旁白为必填项。');
    expect(row.payload).toBeNull();
  });

  it('enforces the maximum row count', () => {
    const rows = Array.from({ length: MAX_BATCH_CSV_ROWS + 1 }, () => 'https://example.com/source.png,Move,selfhost/media_default.json');
    const parsed = parseBatchCsv('i2v', ['source_image,motion_prompt,media_workflow', ...rows].join('\n'));
    expect(parsed.fileErrors).toContain(`CSV 超过最大 ${MAX_BATCH_CSV_ROWS} 行限制。`);
    expect(parsed.rows).toHaveLength(MAX_BATCH_CSV_ROWS);
  });

  it('revalidates a row after inline edits', () => {
    const row = parseBatchCsv('action_transfer', 'driver_video,target_image,pose_workflow\ninvalid-url,https://example.com/target.png,selfhost/pose.json').rows[0];
    expect(row?.errors[0]).toContain('舞蹈视频 URL');

    const updated = updateParsedCsvRow('action_transfer', row!, 'driver_video', 'https://example.com/driver.mp4');
    expect(updated.errors).toEqual([]);
  });

  it('parses a valid custom asset scenes array', () => {
    const scenes = JSON.stringify([
      { media: 'https://example.com/scene-1.png', narration: 'Scene one', duration: 4 },
      { media: 'https://example.com/scene-2.mp4', narration: 'Scene two', duration: 6 },
    ]);
    const parsed = parseBatchCsv('asset_based', `scenes\n"${scenes.replaceAll('"', '""')}"`);

    expect(parsed.fileErrors).toEqual([]);
    expect(parsed.rows[0]?.errors).toEqual([]);
    expect(parsed.rows[0]?.payload?.scenes).toHaveLength(2);
  });

  it('reports invalid custom asset scenes content', () => {
    const row = coerceBatchRow('asset_based', {
      scenes: JSON.stringify([{ media: 'not-a-url', narration: '', duration: 'oops' }]),
    });

    expect(row.errors).toContain('场景 1 的媒体必须是有效 URL。');
    expect(row.errors).toContain('场景 1 的旁白为必填项。');
    expect(row.errors).toContain('场景 1 的时长必须是有效数字。');
    expect(row.payload).toBeNull();
  });

  it('reports malformed custom asset scenes json', () => {
    const row = coerceBatchRow('asset_based', {
      scenes: '{"broken":',
    });

    expect(row.errors).toContain('场景必须是有效 JSON。');
    expect(row.payload).toBeNull();
  });

  it('requires custom asset scenes to be a JSON array of objects', () => {
    const notArray = coerceBatchRow('asset_based', {
      scenes: JSON.stringify({ media: 'https://example.com/scene.png' }),
    });
    const notObject = coerceBatchRow('asset_based', {
      scenes: JSON.stringify(['oops']),
    });

    expect(notArray.errors).toContain('场景必须是 JSON 数组。');
    expect(notObject.errors).toContain('场景 1 必须是对象。');
  });

  it('requires media to be present in each custom asset scene', () => {
    const row = coerceBatchRow('asset_based', {
      scenes: JSON.stringify([{ media: '', narration: 'Scene one', duration: 4 }]),
    });

    expect(row.errors).toContain('场景 1 的媒体为必填项。');
    expect(row.payload).toBeNull();
  });

  it('surfaces CSV parser errors for malformed quoted input', () => {
    const parsed = parseBatchCsv('i2v', 'source_image,motion_prompt,media_workflow\n"https://example.com/source.png,Move,selfhost/media_default.json');
    expect(parsed.fileErrors.length).toBeGreaterThan(0);
    expect(parsed.rows).toEqual([]);
  });

  it('builds empty rows from the pipeline schema metadata', () => {
    expect(buildEmptyRow('asset_based')).toEqual({ scenes: '' });
  });

  it('uses chinese business labels for bgm mode validation', () => {
    const row = coerceBatchRow('standard', {
      text: 'A batch-ready story',
      mode: 'generate',
      title: 'Story',
      n_scenes: '5',
      tts_workflow: '',
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
      bgm_mode: 'custom',
      bgm_path: '',
      bgm_volume: '0.3',
    });

    expect(row.errors).toContain('当背景音乐来源为“从资源库选择”时，必须提供背景音乐文件。');
    expect(row.errors.join(' ')).not.toContain('custom');
  });
});
