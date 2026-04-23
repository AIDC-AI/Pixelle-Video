import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AI_PREVIEW_STORAGE_KEY,
  AI_PROMPT_ASSIST_STORAGE_KEY,
  readAiFeatureFlags,
  useAiFeatures,
} from './use-ai-features';

describe('useAiFeatures', () => {
  it('defaults both AI features to off', () => {
    localStorage.removeItem(AI_PREVIEW_STORAGE_KEY);
    localStorage.removeItem(AI_PROMPT_ASSIST_STORAGE_KEY);

    expect(readAiFeatureFlags()).toEqual({ previewEnabled: false, promptAssistEnabled: false });
  });

  it('persists feature flags to localStorage', () => {
    const { result } = renderHook(() => useAiFeatures());

    act(() => {
      result.current.setPreviewEnabled(true);
      result.current.setPromptAssistEnabled(true);
    });

    expect(result.current.previewEnabled).toBe(true);
    expect(result.current.promptAssistEnabled).toBe(true);
    expect(localStorage.getItem(AI_PREVIEW_STORAGE_KEY)).toBe('true');
    expect(localStorage.getItem(AI_PROMPT_ASSIST_STORAGE_KEY)).toBe('true');
  });
});
