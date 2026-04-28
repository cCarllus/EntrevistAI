import { invoke } from '@tauri-apps/api/core';
import { emptyContext, emptySettings, type AppSettings, type InterviewContext } from '../types';

const contextKey = 'entrevistai.context';
const settingsKey = 'entrevistai.settings';

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

export async function loadContext(): Promise<InterviewContext> {
  if (isTauri()) {
    return invoke<InterviewContext>('load_context');
  }

  const saved = localStorage.getItem(contextKey);
  return saved ? { ...emptyContext(), ...JSON.parse(saved) } : emptyContext();
}

export async function saveContext(context: InterviewContext): Promise<void> {
  const payload = { ...context, updatedAt: new Date().toISOString() };

  if (isTauri()) {
    await invoke('save_context', { context: payload });
    return;
  }

  localStorage.setItem(contextKey, JSON.stringify(payload));
}

export async function loadSettings(): Promise<AppSettings> {
  if (isTauri()) {
    return invoke<AppSettings>('load_settings');
  }

  const saved = localStorage.getItem(settingsKey);
  return saved ? { ...emptySettings(), ...JSON.parse(saved) } : emptySettings();
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (isTauri()) {
    await invoke('save_settings', { settings });
    return;
  }

  localStorage.setItem(settingsKey, JSON.stringify(settings));
}
