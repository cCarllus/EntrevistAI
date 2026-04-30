<script lang="ts">
  import {
    transcriptionStore,
    visibleTranscriptionTurns,
    type GeminiLiveStatus
  } from '../stores/transcriptionStore';

  const statusLabels: Record<GeminiLiveStatus, string> = {
    stopped: 'Parado',
    connecting: 'Conectando',
    connected: 'Conectado',
    reconnecting: 'Reconectando',
    error: 'Erro'
  };

  export let interviewMode = false;
  export let audioAmplitude = 0;
  export let isListening = false;

  $: status = $transcriptionStore.status;
  $: displayTurns = $visibleTranscriptionTurns.slice(-4);
  $: activeTurn = displayTurns[displayTurns.length - 1];
  $: pastTurns = displayTurns.slice(0, -1);
  $: isLive = status === 'connected';
  $: isAudioActive = isListening || isLive;
  $: amplitudeTone = Math.min(1, Math.max(0.22, audioAmplitude * 12));
  $: statusTone =
    status === 'connected'
      ? 'border-focus/40 bg-focus/10 text-teal-100'
      : status === 'error'
        ? 'border-red-400/30 bg-red-500/10 text-red-100'
        : status === 'reconnecting' || status === 'connecting'
          ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
        : 'border-white/10 bg-black/20 text-slate-300';
</script>

{#if interviewMode}
  <section class="floating-surface relative flex h-full w-[38%] min-w-0 flex-col overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-950/95 backdrop-blur-2xl">
    <div
      class="flex items-center justify-between border-b border-zinc-800/50 bg-zinc-950/80 px-5 py-3"
    >
      <span class="text-xs tracking-wide text-zinc-500">Live Feed</span>
      <div class="flex h-4 items-end gap-0.5" style={`opacity: ${isAudioActive ? amplitudeTone : 0.22}`}>
        {#each Array(6) as _}
          <div class:wave-bar={isAudioActive} class="h-3 w-0.5 rounded-t-sm bg-green-500/70"></div>
        {/each}
      </div>
    </div>

    {#if $transcriptionStore.error}
      <div class="mx-5 mt-4 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
        {$transcriptionStore.error}
      </div>
    {/if}

    <div class="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 pb-24">
      {#if displayTurns.length === 0}
        <div class="floating-card rounded-2xl border border-dashed border-zinc-800/70 bg-black/10 p-4">
          <p class="text-xs uppercase tracking-wider text-zinc-500">English:</p>
          <p class="mt-2 text-xs leading-relaxed text-zinc-500">
            Waiting for live transcription.
          </p>
          <p class="mt-4 text-xs uppercase tracking-wider text-green-700">PT-BR:</p>
          <p class="mt-2 text-sm leading-relaxed text-green-700/70">
            Aguardando tradução em tempo real.
          </p>
        </div>
      {/if}

      {#each pastTurns as turn (turn.id)}
        <article class="space-y-2 opacity-40 transition-opacity duration-300 hover:opacity-100">
          <div class="flex flex-col gap-0.5">
            <span class="text-xs tracking-wider text-zinc-500">English:</span>
            <p class="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
              {turn.english || 'Capturing English audio...'}
            </p>
          </div>
          <div class="flex flex-col gap-0.5 pt-1">
            <span class="text-xs tracking-wider text-green-700">PT-BR:</span>
            <p class="whitespace-pre-wrap text-sm leading-relaxed text-green-600/70">
              {turn.portuguese || 'Traduzindo...'}
            </p>
          </div>
        </article>
      {/each}

      {#if activeTurn}
        <article class="relative space-y-3">
          <div class="absolute bottom-2 left-[3px] top-4 w-px bg-zinc-800"></div>

          <div class="relative flex flex-col gap-1 pl-4">
            <div class="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full border border-zinc-950 bg-zinc-600"></div>
            <div class="flex items-center gap-2">
              <span class="text-xs tracking-wider text-zinc-400">English:</span>
              <iconify-icon icon="solar:volume-small-linear" class="text-zinc-500" width="12" height="12"></iconify-icon>
            </div>
            <p class="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
              {activeTurn.english || 'Capturing English audio...'}
            </p>
          </div>

          <div class="floating-card relative ml-4 flex flex-col gap-1 rounded-2xl border border-green-900/25 bg-green-950/14 p-3">
            <div class="absolute -left-4 top-4 h-1.5 w-1.5 rounded-full border border-zinc-950 bg-green-500"></div>
            <span class="text-xs tracking-wider text-green-500/80">PT-BR:</span>
            <p class="whitespace-pre-wrap text-sm font-normal leading-relaxed text-green-400">
              {activeTurn.portuguese || 'Traduzindo...'}
            </p>
          </div>
        </article>
      {/if}

      {#if isLive && (!activeTurn || !activeTurn.isFinal)}
        <div class="flex gap-1 pl-4 pt-2">
          <div class="dot-typing h-1.5 w-1.5 rounded-full bg-zinc-700"></div>
          <div class="dot-typing h-1.5 w-1.5 rounded-full bg-zinc-700"></div>
          <div class="dot-typing h-1.5 w-1.5 rounded-full bg-zinc-700"></div>
        </div>
      {/if}
    </div>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-3xl bg-gradient-to-t from-zinc-950/90 to-transparent"></div>
  </section>
{:else}
<section
  class={`flex min-h-0 flex-col rounded-lg border border-white/10 bg-zinc-900/95 ${
    interviewMode ? 'h-full p-5' : 'p-5 shadow-2xl shadow-black/20'
  }`}
>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-white">Transcrição ao vivo</h2>
      <p class="mt-2 text-sm leading-6 text-slate-400">
        Inglês original e tradução PT-BR dos últimos turnos da entrevistadora.
      </p>
    </div>

    <span class={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${statusTone}`}>
      {statusLabels[status]}
    </span>
  </div>

  <p class="mt-4 text-xs text-slate-500">{$transcriptionStore.statusMessage}</p>

  {#if $transcriptionStore.error}
    <div class="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      {$transcriptionStore.error}
    </div>
  {/if}

  <div class="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto scroll-smooth pr-1">
    {#if displayTurns.length === 0}
      <div class="rounded-lg border border-dashed border-white/15 p-5 text-sm leading-6 text-slate-400">
        A transcrição aparece aqui quando o modo entrevista receber áudio em inglês.
      </div>
    {/if}

    {#each displayTurns as turn (turn.id)}
      <article
        class={`rounded-lg border p-4 transition-colors ${
          turn.isFinal ? 'border-white/10 bg-black/25' : 'border-emerald-400/30 bg-emerald-500/10'
        }`}
      >
        <p class="whitespace-pre-wrap text-sm leading-6 text-slate-400">
          {turn.english || 'Captando fala em inglês...'}
        </p>
        <p class="mt-2 whitespace-pre-wrap text-xl font-semibold leading-8 text-emerald-400">
          {turn.portuguese || 'Traduzindo...'}
        </p>
      </article>
    {/each}
  </div>
</section>
{/if}
