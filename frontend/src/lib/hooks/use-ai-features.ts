'use client';

import { useEffect, useState } from 'react';

export const AI_PREVIEW_STORAGE_KEY = 'pixelle-ai-preview-enabled';
export const AI_PROMPT_ASSIST_STORAGE_KEY = 'pixelle-ai-prompt-assist-enabled';
export const AI_FEATURES_EVENT = 'pixelle-ai-features-change';

function readBooleanPreference(key: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(key) === 'true';
}

function writeBooleanPreference(key: string, value: boolean): void {
  window.localStorage.setItem(key, String(value));
  window.dispatchEvent(new CustomEvent(AI_FEATURES_EVENT));
}

export function readAiFeatureFlags() {
  return {
    previewEnabled: readBooleanPreference(AI_PREVIEW_STORAGE_KEY),
    promptAssistEnabled: readBooleanPreference(AI_PROMPT_ASSIST_STORAGE_KEY),
  };
}

export function useAiFeatures() {
  const [flags, setFlags] = useState(readAiFeatureFlags);

  useEffect(() => {
    const sync = () => setFlags(readAiFeatureFlags());

    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(AI_FEATURES_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(AI_FEATURES_EVENT, sync);
    };
  }, []);

  return {
    ...flags,
    setPreviewEnabled: (value: boolean) => {
      writeBooleanPreference(AI_PREVIEW_STORAGE_KEY, value);
      setFlags(readAiFeatureFlags());
    },
    setPromptAssistEnabled: (value: boolean) => {
      writeBooleanPreference(AI_PROMPT_ASSIST_STORAGE_KEY, value);
      setFlags(readAiFeatureFlags());
    },
  };
}
