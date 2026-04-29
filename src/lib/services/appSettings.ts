import { invoke } from '@tauri-apps/api/core';
import { emptySettings, type AppSettings } from '../types';

const settingsKey = 'entrevistai.settings';
const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

export async function loadSettings(): Promise<AppSettings> {
  if (isTauri()) {
    return normalizeSettings(await invoke<Partial<AppSettings>>('load_settings'));
  }

  const saved = localStorage.getItem(settingsKey);
  return saved ? normalizeSettings(JSON.parse(saved) as Partial<AppSettings>) : emptySettings();
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const payload = normalizeSettings(settings);

  if (isTauri()) {
    await invoke('save_settings', { settings: payload });
    return;
  }

  localStorage.setItem(settingsKey, JSON.stringify(payload));
}

function normalizeSettings(settings: Partial<AppSettings>): AppSettings {
  const fallback = emptySettings();
  const opacityPercent = Number(settings.opacityPercent ?? fallback.opacityPercent);

  return {
    ...fallback,
    ...settings,
    opacityPercent: Number.isFinite(opacityPercent)
      ? Math.min(100, Math.max(65, Math.round(opacityPercent)))
      : fallback.opacityPercent,
    alwaysOnTop: settings.alwaysOnTop ?? fallback.alwaysOnTop,
    hasSeenInterviewIntro: settings.hasSeenInterviewIntro ?? fallback.hasSeenInterviewIntro
  };
}
