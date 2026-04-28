<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AudioCaptureStatus } from '../services/audioService';

  export let status: AudioCaptureStatus;
  export let amplitude = 0;
  export let disabled = false;
  export let isBusy = false;

  const dispatch = createEventDispatcher<{
    start: void;
    stop: void;
  }>();

  $: isListening = status.status === 'Listening';
  $: level = Math.min(100, Math.round((amplitude || status.lastAmplitude) * 240));
  $: statusLabel =
    status.status === 'Listening' ? 'Listening' : status.status === 'Error' ? 'Error' : 'Stopped';
  $: statusTone =
    status.status === 'Listening'
      ? 'border-focus/40 bg-focus/10 text-teal-100'
      : status.status === 'Error'
        ? 'border-red-400/30 bg-red-500/10 text-red-100'
        : 'border-white/10 bg-black/20 text-slate-300';
  $: hasPermissionLink = status.status === 'Error' && status.message.includes('x-apple.systempreferences');
</script>

<section class="rounded-lg border border-white/10 bg-graphite-900/80 p-5 shadow-2xl shadow-black/20">
  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold text-white">Captura de áudio</h2>
        <span class={`rounded-md border px-2.5 py-1 text-xs font-bold ${statusTone}`}>
          {statusLabel}
        </span>
      </div>
      <p class="mt-2 text-sm leading-6 text-slate-400">
        Sistema em PCM mono, 16 kHz, chunks de {(status.chunkSamples / status.sampleRate).toFixed(1)}s.
      </p>
    </div>

    <div class="flex gap-2">
      <button
        class="inline-flex min-h-11 items-center justify-center rounded-md bg-focus px-4 text-sm font-bold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        disabled={disabled || isBusy || isListening}
        on:click={() => dispatch('start')}
      >
        Iniciar captura
      </button>
      <button
        class="inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 bg-black/20 px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500"
        disabled={isBusy || !isListening}
        on:click={() => dispatch('stop')}
      >
        Parar
      </button>
    </div>
  </div>

  <div class="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
    <div>
      <div class="h-3 overflow-hidden rounded-sm bg-black/40">
        <div
          class="h-full rounded-sm bg-focus transition-[width]"
          style={`width: ${level}%`}
        ></div>
      </div>
      <p class="mt-2 text-xs text-slate-500">Amplitude: {(amplitude || status.lastAmplitude).toFixed(5)}</p>
    </div>

    <div class="grid grid-cols-2 gap-2 text-xs text-slate-400">
      <div class="rounded-md border border-white/10 bg-black/20 p-3">
        <p class="text-slate-500">Sample rate</p>
        <p class="mt-1 font-semibold text-white">{status.sampleRate} Hz</p>
      </div>
      <div class="rounded-md border border-white/10 bg-black/20 p-3">
        <p class="text-slate-500">Canais</p>
        <p class="mt-1 font-semibold text-white">{status.channels}</p>
      </div>
    </div>
  </div>

  {#if status.status === 'Error'}
    <div class="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
      {status.message}
      {#if hasPermissionLink}
        <a
          class="ml-1 font-semibold underline decoration-red-200/60 underline-offset-4"
          href="x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
        >
          Abrir ajustes.
        </a>
      {/if}
    </div>
  {/if}
</section>
