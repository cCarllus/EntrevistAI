<script lang="ts">
  import type { AudioCaptureStatus } from '../services/audioService';

  export let audioStatus: AudioCaptureStatus;
  export let audioAmplitude = 0;
  export let opacityPercent = 90;
  export let isAlwaysOnTop = true;
  export let canToggleInterview = false;
  export let isAudioBusy = false;
  export let onOpacityChange: (opacityPercent: number) => void;
  export let onToggleInterview: () => void | Promise<void>;
  export let onToggleAlwaysOnTop: () => void | Promise<void>;
  export let onClearInterviewHistory: () => void;
  export let onHideWindow: () => void | Promise<void>;
  export let onCloseInterviewInterface: () => void;

  $: isAudioListening = audioStatus.status === 'Listening';
  $: amplitudePercent = Math.min(100, Math.round(audioAmplitude * 900));
</script>

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
        min="65"
        max="100"
        step="5"
        value={opacityPercent}
        aria-label="Opacidade da interface"
        on:input={(event) => onOpacityChange(event.currentTarget.valueAsNumber)}
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
      on:click={onToggleInterview}
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
      on:click={onToggleAlwaysOnTop}
      type="button"
    >
      {isAlwaysOnTop ? 'Sempre no topo' : 'Topo desligado'}
    </button>

    <button
      class="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/5 px-3 text-xs font-bold text-slate-100 transition hover:bg-white/10"
      on:click={onClearInterviewHistory}
      type="button"
    >
      Limpar Histórico
    </button>

    <button
      class="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/5 px-3 text-xs font-bold text-slate-100 transition hover:bg-white/10"
      on:click={onHideWindow}
      type="button"
    >
      Stealth
    </button>

    <button
      class="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/5 px-3 text-xs font-bold text-slate-100 transition hover:bg-white/10"
      on:click={onCloseInterviewInterface}
      type="button"
    >
      Preparação
    </button>
  </div>
</header>
