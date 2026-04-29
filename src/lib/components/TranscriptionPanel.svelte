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

  $: status = $transcriptionStore.status;
  $: displayTurns = $visibleTranscriptionTurns.slice(-4);
  $: statusTone =
    status === 'connected'
      ? 'border-focus/40 bg-focus/10 text-teal-100'
      : status === 'error'
        ? 'border-red-400/30 bg-red-500/10 text-red-100'
        : status === 'reconnecting' || status === 'connecting'
          ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
          : 'border-white/10 bg-black/20 text-slate-300';
</script>

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
