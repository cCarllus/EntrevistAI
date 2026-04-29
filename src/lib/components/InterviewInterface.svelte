<script lang="ts">
  import { LogicalSize, getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
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

  let opacityPercent = 90;
  let isAlwaysOnTop = true;
  let windowMessage = '';

  $: isAudioListening = audioStatus.status === 'Listening';
  $: canToggleInterview = canStartInterview && !isAudioBusy;
  $: amplitudePercent = Math.min(100, Math.round(audioAmplitude * 900));
  $: panelOpacity = opacityPercent / 100;

  onMount(() => {
    void configureFloatingWindow();
    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  });

  async function configureFloatingWindow() {
    if (!isTauri()) {
      return;
    }

    try {
      const currentWindow = getCurrentWindow();
      await currentWindow.setMinSize(new LogicalSize(900, 600));
      await currentWindow.setAlwaysOnTop(true);
      await currentWindow.setVisibleOnAllWorkspaces(true);
      await currentWindow.setTitle('EntrevistAI - Entrevista');
    } catch (error) {
      windowMessage =
        error instanceof Error ? error.message : 'Não foi possível configurar a janela flutuante.';
    }
  }

  async function toggleAlwaysOnTop() {
    isAlwaysOnTop = !isAlwaysOnTop;

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

  async function minimizeStealth() {
    if (!isTauri()) {
      windowMessage = 'Minimizar está disponível no app desktop Tauri.';
      return;
    }

    try {
      const currentWindow = getCurrentWindow();
      await currentWindow.setSkipTaskbar(true);
      await currentWindow.minimize();
    } catch (error) {
      windowMessage =
        error instanceof Error ? error.message : 'Não foi possível minimizar a janela.';
    }
  }

  function handleShortcut(event: KeyboardEvent) {
    const key = event.key.toLowerCase();

    if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'i') {
      event.preventDefault();
      void toggleInterview();
    }
  }

  function isTauri(): boolean {
    return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
  }
</script>

<main
  class="min-h-screen min-w-[900px] bg-zinc-950 text-slate-100"
  style={`opacity: ${panelOpacity}`}
>
  <section class="flex h-screen min-h-[600px] flex-col gap-4 p-4">
    <header class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-zinc-900/95 px-4 py-3 shadow-2xl shadow-black/30">
      <div>
        <h1 class="text-xl font-semibold tracking-normal text-white">EntrevistAI</h1>
        <p class="mt-1 text-xs font-medium text-slate-400">
          Interface flutuante para entrevista real
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="min-w-36">
          <div class="mb-1 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Áudio</span>
            <span>{amplitudePercent}%</span>
          </div>
          <div class="h-2 rounded-full bg-black/50">
            <div
              class="h-2 rounded-full bg-emerald-400 transition-all"
              style={`width: ${amplitudePercent}%`}
            ></div>
          </div>
        </div>

        <label class="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <span>Opacidade</span>
          <input
            class="h-2 w-28 accent-emerald-500"
            type="range"
            min="75"
            max="100"
            step="5"
            bind:value={opacityPercent}
            aria-label="Opacidade da interface"
          />
          <span class="tabular-nums">{opacityPercent}%</span>
        </label>

        <button
          class={`inline-flex min-h-12 items-center justify-center rounded-md px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 ${
            isAudioListening
              ? 'bg-red-500 text-white hover:bg-red-400'
              : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
          disabled={!canToggleInterview}
          on:click={toggleInterview}
          type="button"
        >
          {isAudioBusy
            ? 'Aguarde...'
            : isAudioListening
              ? 'Parar Entrevista'
              : 'Iniciar Entrevista'}
        </button>

        <button
          class="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/5 px-3 text-xs font-bold text-slate-100 transition hover:bg-white/10"
          on:click={toggleAlwaysOnTop}
          type="button"
        >
          {isAlwaysOnTop ? 'Sempre no topo' : 'Topo desligado'}
        </button>

        <button
          class="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/5 px-3 text-xs font-bold text-slate-100 transition hover:bg-white/10"
          on:click={clearInterviewHistory}
          type="button"
        >
          Limpar Histórico
        </button>

        <button
          class="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/5 px-3 text-xs font-bold text-slate-100 transition hover:bg-white/10"
          on:click={minimizeStealth}
          type="button"
        >
          Stealth
        </button>

        <button
          class="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/5 px-3 text-xs font-bold text-slate-100 transition hover:bg-white/10"
          on:click={closeInterviewInterface}
          type="button"
        >
          Preparação
        </button>
      </div>
    </header>

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
