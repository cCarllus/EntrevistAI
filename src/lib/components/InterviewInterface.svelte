<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { LogicalSize, getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import MenuBar from './MenuBar.svelte';
  import ResponsePanel from './ResponsePanel.svelte';
  import TranscriptionPanel from './TranscriptionPanel.svelte';
  import type { AudioCaptureStatus } from '../services/audioService';
  import type { AppSettings, InterviewContext } from '../types';

  export let context: InterviewContext;
  export let settings: AppSettings;
  export let audioStatus: AudioCaptureStatus;
  export let audioAmplitude = 0;
  export let errorMessage = '';
  export let successMessage = '';
  export let canStartInterview = false;
  export let isAudioBusy = false;
  export let startInterviewMode: () => Promise<void>;
  export let stopInterviewMode: () => Promise<void>;
  export let clearInterviewHistory: () => void;
  export let closeInterviewInterface: () => void;
  export let updateSettings: (update: Partial<AppSettings>) => void;

  let opacityPercent = settings.opacityPercent;
  let isAlwaysOnTop = true;
  let windowMessage = '';

  $: isAudioListening = audioStatus.status === 'Listening';
  $: canToggleInterview = canStartInterview && !isAudioBusy;
  $: panelOpacity = opacityPercent / 100;

  onMount(() => {
    opacityPercent = settings.opacityPercent;
    isAlwaysOnTop = settings.alwaysOnTop;
    void configureFloatingWindow();
  });

  async function configureFloatingWindow() {
    if (!isTauri()) {
      return;
    }

    try {
      const currentWindow = getCurrentWindow();
      await currentWindow.setMinSize(new LogicalSize(760, 500));
      await currentWindow.setAlwaysOnTop(isAlwaysOnTop);
      await currentWindow.setVisibleOnAllWorkspaces(true);
      await currentWindow.setTitle('EntrevistAI - Entrevista');
    } catch (error) {
      windowMessage =
        error instanceof Error ? error.message : 'Não foi possível configurar a janela flutuante.';
    }
  }

  async function toggleAlwaysOnTop() {
    isAlwaysOnTop = !isAlwaysOnTop;
    updateSettings({ alwaysOnTop: isAlwaysOnTop });

    if (!isTauri()) {
      return;
    }

    try {
      await getCurrentWindow().setAlwaysOnTop(isAlwaysOnTop);
    } catch (error) {
      windowMessage =
        error instanceof Error ? error.message : 'Não foi possível alterar sempre no topo.';
    }
  }

  function handleOpacityChange(nextOpacityPercent: number) {
    opacityPercent = Math.min(100, Math.max(65, Math.round(nextOpacityPercent)));
    updateSettings({ opacityPercent });
  }

  async function toggleInterview() {
    if (!canToggleInterview) {
      return;
    }

    if (isAudioListening) {
      await stopInterviewMode();
      return;
    }

    await startInterviewMode();
  }

  async function hideStealth() {
    if (!isTauri()) {
      windowMessage = 'Stealth está disponível no app desktop Tauri.';
      return;
    }

    try {
      const currentWindow = getCurrentWindow();
      await currentWindow.setSkipTaskbar(true);
      await invoke('hide_main_window');
    } catch (error) {
      windowMessage =
        error instanceof Error ? error.message : 'Não foi possível esconder a janela.';
    }
  }

  function isTauri(): boolean {
    return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
  }
</script>

<main
  class="min-h-screen min-w-[760px] bg-zinc-950 text-slate-100"
  style={`opacity: ${panelOpacity}`}
>
  <section class="flex h-screen min-h-[500px] flex-col gap-4 p-4">
    <MenuBar
      {audioStatus}
      {audioAmplitude}
      {opacityPercent}
      {isAlwaysOnTop}
      {canToggleInterview}
      {isAudioBusy}
      onOpacityChange={handleOpacityChange}
      onToggleInterview={toggleInterview}
      onToggleAlwaysOnTop={toggleAlwaysOnTop}
      onClearInterviewHistory={clearInterviewHistory}
      onHideWindow={hideStealth}
      onCloseInterviewInterface={closeInterviewInterface}
    />

    {#if errorMessage || successMessage || windowMessage}
      <div
        class={`rounded-md border px-4 py-3 text-sm ${
          errorMessage || windowMessage
            ? 'border-red-400/30 bg-red-500/10 text-red-100'
            : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
        }`}
      >
        {errorMessage || windowMessage || successMessage}
      </div>
    {/if}

    <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
      <TranscriptionPanel interviewMode />
      <ResponsePanel {context} {settings} interviewMode />
    </div>
  </section>
</main>
