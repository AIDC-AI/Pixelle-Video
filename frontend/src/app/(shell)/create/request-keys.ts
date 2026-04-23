import type { components } from '@/types/api';

export const QUICK_SUBMIT_REQUEST_KEYS = [
  'bgm_mode',
  'bgm_path',
  'bgm_volume',
  'max_image_prompt_words',
  'max_narration_words',
  'media_workflow',
  'min_image_prompt_words',
  'min_narration_words',
  'mode',
  'n_scenes',
  'project_id',
  'prompt_prefix',
  'ref_audio',
  'frame_template',
  'runninghub_instance_type',
  'style_id',
  'template_params',
  'text',
  'title',
  'tts_workflow',
  'video_fps',
  'voice_id',
] as const satisfies readonly (keyof components['schemas']['VideoGenerateRequest'])[];

export const DIGITAL_HUMAN_REQUEST_KEYS = [
  'bgm_mode',
  'bgm_path',
  'bgm_volume',
  'narration',
  'portrait_url',
  'project_id',
  'runninghub_instance_type',
  'voice_workflow',
] as const satisfies readonly (keyof components['schemas']['DigitalHumanAsyncRequest'])[];

export const I2V_REQUEST_KEYS = [
  'bgm_mode',
  'bgm_path',
  'bgm_volume',
  'media_workflow',
  'motion_prompt',
  'project_id',
  'runninghub_instance_type',
  'source_image',
] as const satisfies readonly (keyof components['schemas']['I2VAsyncRequest'])[];

export const ACTION_TRANSFER_REQUEST_KEYS = [
  'bgm_mode',
  'bgm_path',
  'bgm_volume',
  'driver_video',
  'pose_workflow',
  'project_id',
  'runninghub_instance_type',
  'target_image',
] as const satisfies readonly (keyof components['schemas']['ActionTransferAsyncRequest'])[];

export const CUSTOM_REQUEST_KEYS = [
  'bgm_mode',
  'bgm_path',
  'bgm_volume',
  'project_id',
  'scenes',
] as const satisfies readonly (keyof components['schemas']['CustomAsyncRequest'])[];

export const CUSTOM_SCENE_KEYS = [
  'duration',
  'media',
  'narration',
] as const satisfies readonly (keyof components['schemas']['CustomScene'])[];
