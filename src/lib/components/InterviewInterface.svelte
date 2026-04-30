<script lang="ts">
  import {
    LogicalPosition,
    LogicalSize,
    currentMonitor,
    getCurrentWindow
  } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import ResponsePanel from './ResponsePanel.svelte';
  import TranscriptionPanel from './TranscriptionPanel.svelte';
  import type { AudioCaptureStatus } from '../services/audioService';
  import { responseStore } from '../stores/responseStore';
  import type { AppSettings, InterviewContext } from '../types';

  export let context: InterviewContext;
  export let settings: AppSettings;
  export let audioStatus: AudioCaptureStatus;
  export let audioAmplitude = 0;
  export let errorMessage = '';
  export let canStartInterview = false;
  export let isAudioBusy = false;
  export let startInterviewMode: () => Promise<void>;
  export let stopInterviewMode: () => Promise<void>;
  export let closeInterviewInterface: () => void;

  let opacityPercent = settings.opacityPercent;
  let isAlwaysOnTop = true;
  let windowMessage = '';
  let topBarMessage = '';

  $: isAudioListening = audioStatus.status === 'Listening';
  $: canToggleInterview = canStartInterview && !isAudioBusy;
  $: panelOpacity = opacityPercent / 100;
  $: canCopyResponse = Boolean($responseStore.current?.answer);
  $: listeningLabel = isAudioBusy ? 'Syncing' : 'Listening';

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
      const overlaySize = new LogicalSize(960, 540);
      await currentWindow.setMinSize(new LogicalSize(840, 472));
      await currentWindow.setSize(overlaySize);
      await currentWindow.setAlwaysOnTop(isAlwaysOnTop);
      await currentWindow.setVisibleOnAllWorkspaces(true);
      await currentWindow.setTitle('EntrevistAI - Overlay');
      await positionWindowOnRight(overlaySize);
    } catch (error) {
      windowMessage =
        error instanceof Error ? error.message : 'Não foi possível configurar a janela flutuante.';
    }
  }

  async function positionWindowOnRight(size: LogicalSize) {
    const monitor = await currentMonitor();

    if (!monitor) {
      return;
    }

    const margin = 32;
    const scaleFactor = monitor.scaleFactor || 1;
    const workAreaWidth = monitor.workArea.size.width / scaleFactor;
    const workAreaHeight = monitor.workArea.size.height / scaleFactor;
    const workAreaX = monitor.workArea.position.x / scaleFactor;
    const workAreaY = monitor.workArea.position.y / scaleFactor;
    const x = Math.max(workAreaX + margin, workAreaX + workAreaWidth - size.width - margin);
    const y = Math.max(workAreaY + margin, workAreaY + (workAreaHeight - size.height) / 2);

    await getCurrentWindow().setPosition(new LogicalPosition(Math.round(x), Math.round(y)));
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

  async function copySuggestedAnswer() {
    const answer = $responseStore.current?.answer;

    if (!answer) {
      return;
    }

    try {
      await navigator.clipboard.writeText(answer);
      topBarMessage = 'Copied';
      window.setTimeout(() => {
        topBarMessage = '';
      }, 1600);
    } catch {
      topBarMessage = 'Copy failed';
    }
  }

  function isTauri(): boolean {
    return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
  }
</script>

<main
  class="relative flex h-screen min-h-[472px] min-w-0 items-center justify-end overflow-hidden bg-zinc-950 p-6 text-zinc-200 antialiased sm:p-12"
  style={`opacity: ${panelOpacity}`}
>
  <section
    class="glass-highlight relative flex aspect-video max-h-[600px] w-full max-w-[840px] transform flex-col overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950/60 shadow-2xl shadow-black backdrop-blur-3xl transition-all"
  >
    <header
      class="z-20 flex h-12 flex-none items-center justify-between border-b border-zinc-800/40 bg-zinc-900/20 px-4"
    >
      <div class="flex min-w-0 items-center gap-4">
        <h1 class="text-sm font-medium uppercase tracking-normal text-zinc-100">EntrevistAI</h1>

        <div class="h-3 w-px bg-zinc-700/50"></div>

        <div class="flex items-center gap-2">
          <div class="h-2 w-2 rounded-full bg-green-500 animate-pulse-ring"></div>
          <span class="mt-px text-xs font-normal uppercase tracking-wide text-zinc-400">
            {isAudioBusy ? 'Syncing' : listeningLabel}
          </span>
        </div>

        {#if topBarMessage}
          <span class="hidden text-xs font-medium uppercase tracking-wide text-emerald-400 sm:inline">
            {topBarMessage}
          </span>
        {/if}
      </div>

      <div class="flex items-center gap-1.5 text-zinc-400">
        <button
          class="flex items-center justify-center rounded-md p-1.5 transition-colors duration-200 hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none disabled:cursor-not-allowed disabled:text-zinc-700"
          disabled={!canToggleInterview}
          on:click={toggleInterview}
          title={isAudioListening ? 'Stop' : 'Start'}
          type="button"
        >
          <iconify-icon
            icon={isAudioListening ? 'solar:stop-circle-linear' : 'solar:record-minimalistic-linear'}
            width="16"
            height="16"
          ></iconify-icon>
        </button>

        <button
          class="flex items-center justify-center rounded-md p-1.5 transition-colors duration-200 hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none disabled:cursor-not-allowed disabled:text-zinc-700"
          disabled={!canCopyResponse}
          on:click={copySuggestedAnswer}
          title="Copy suggested answer"
          type="button"
        >
          <iconify-icon icon="solar:copy-linear" width="16" height="16"></iconify-icon>
        </button>

        <button
          class="ml-1 flex items-center justify-center rounded-md p-1.5 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-400 focus:outline-none"
          on:click={closeInterviewInterface}
          title="Back to preparation"
          type="button"
        >
          <iconify-icon icon="solar:close-circle-linear" width="16" height="16"></iconify-icon>
        </button>
      </div>
    </header>

    {#if errorMessage || windowMessage}
      <div
        class={`border-b px-4 py-2 text-xs ${
          errorMessage || windowMessage
            ? 'border-red-400/20 bg-red-500/10 text-red-100'
            : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
        }`}
      >
        {errorMessage || windowMessage}
      </div>
    {/if}

    <div class="relative z-10 flex min-h-0 flex-1 overflow-hidden">
      <TranscriptionPanel interviewMode {audioAmplitude} />
      <ResponsePanel {context} {settings} interviewMode />
    </div>
  </section>
</main>
