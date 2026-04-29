<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { responseStore, generateNewSuggestion } from '../stores/responseStore';
  import type { AppSettings, InterviewContext } from '../types';

  export let context: InterviewContext;
  export let settings: AppSettings;
  export let interviewMode = false;

  let copyStatus = '';

  $: canCopy = Boolean($responseStore.current?.answer);
  $: canRequestNewSuggestion =
    Boolean($responseStore.current || $responseStore.lastQuestion) &&
    $responseStore.status !== 'thinking';

  onMount(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      if (key === 'c') {
        if (!canCopy || hasSelectedText() || isTypingTarget(event.target)) {
          return;
        }

        event.preventDefault();
        void copyResponse();
        return;
      }

      if (key === 'k') {
        if (!canRequestNewSuggestion || isTypingTarget(event.target)) {
          return;
        }

        event.preventDefault();
        void requestNewSuggestion();
      }
    };

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  });

  async function copyResponse() {
    const answer = $responseStore.current?.answer;

    if (!answer) {
      return;
    }

    try {
      await navigator.clipboard.writeText(answer);
      copyStatus = 'Resposta copiada';
    } catch {
      copyStatus = 'Não foi possível copiar automaticamente';
    }
  }

  async function requestNewSuggestion() {
    copyStatus = '';
    await generateNewSuggestion(settings.geminiApiKey, context);
  }

  function hasSelectedText(): boolean {
    return Boolean(window.getSelection()?.toString());
  }

  function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  }
</script>

<section
  class={`flex min-h-0 flex-col rounded-lg border border-white/10 bg-zinc-900/95 ${
    interviewMode ? 'h-full' : 'min-h-[320px] shadow-2xl shadow-black/20'
  }`}
>
  <div class="border-b border-white/10 p-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold text-white">Resposta Sugerida</h2>
        <p class="mt-2 text-sm leading-6 text-slate-400">
          Aparece automaticamente após a pausa da entrevistadora.
        </p>
      </div>

      <span
        class={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${
          $responseStore.status === 'ready'
            ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
            : $responseStore.status === 'thinking'
              ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
              : $responseStore.status === 'error'
                ? 'border-red-400/30 bg-red-500/10 text-red-100'
                : 'border-white/10 bg-black/20 text-slate-300'
        }`}
      >
        {$responseStore.status === 'thinking' ? 'Pensando...' : $responseStore.statusMessage}
      </span>
    </div>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto p-5 scroll-smooth">
    {#if $responseStore.status === 'thinking'}
      <div class="rounded-lg border border-amber-300/20 bg-amber-400/10 p-5 text-sm font-semibold text-amber-100">
        Pensando...
      </div>
    {:else if $responseStore.error}
      <div class="rounded-lg border border-red-400/30 bg-red-500/10 p-5 text-sm leading-6 text-red-100">
        {$responseStore.error}
      </div>
    {:else if $responseStore.current}
      <article class="space-y-4" in:fade={{ duration: 160 }}>
        <div class="rounded-md border border-white/10 bg-black/20 p-4">
          <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">
            Última pergunta
          </p>
          <p class="mt-2 text-sm leading-6 text-slate-300">
            {$responseStore.current.question}
          </p>
        </div>

        <p class="whitespace-pre-wrap text-xl font-semibold leading-8 text-white transition-opacity duration-200">
          {$responseStore.current.answer}
        </p>
      </article>
    {:else}
      <div class="rounded-lg border border-dashed border-white/15 p-5 text-sm leading-6 text-slate-400">
        A resposta em inglês aparece aqui após uma pergunta com pelo menos quatro palavras.
      </div>
    {/if}
  </div>

  <div class="space-y-3 border-t border-white/10 p-5">
    {#if copyStatus}
      <p class="text-xs font-semibold text-focus">{copyStatus}</p>
    {/if}

    <button
      class="inline-flex min-h-14 w-full items-center justify-center rounded-md bg-emerald-600 px-5 text-base font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      disabled={!canCopy}
      on:click={copyResponse}
      type="button"
    >
      Copiar Resposta (Cmd/Ctrl + C)
    </button>

    <button
      class="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-white/15 bg-black/20 px-4 text-sm font-bold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500"
      disabled={!canRequestNewSuggestion}
      on:click={requestNewSuggestion}
      type="button"
    >
      Nova Sugestão (Cmd/Ctrl + K)
    </button>
  </div>
</section>
