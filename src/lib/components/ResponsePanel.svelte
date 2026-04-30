<script lang="ts">
  import { onMount } from 'svelte';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { fade } from 'svelte/transition';
  import { responseStore, generateNewSuggestion } from '../stores/responseStore';
  import type { AppSettings, InterviewContext } from '../types';

  export let context: InterviewContext;
  export let settings: AppSettings;
  export let interviewMode = false;

  let copyStatus = '';
  let shortcutUnlisten: UnlistenFn | undefined;
  let lastShortcutAction = '';
  let lastShortcutAt = 0;
  let answeredStatus = '';

  type ShortcutPayload = {
    action: 'toggle_interview' | 'new_suggestion' | 'copy_response' | 'toggle_window';
  };

  $: canCopy = Boolean($responseStore.current?.answer);
  $: canRequestNewSuggestion =
    Boolean($responseStore.current || $responseStore.lastQuestion) &&
    $responseStore.status !== 'thinking';
  $: currentAnswer = $responseStore.current?.answer ?? '';
  $: answerParagraphs = currentAnswer
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  $: responseKeywords = extractKeywords(currentAnswer);

  onMount(() => {
    void setupGlobalShortcutListener();

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
        void handleShortcutAction('copy_response');
        return;
      }

      if (key === 'k') {
        if (!canRequestNewSuggestion || isTypingTarget(event.target)) {
          return;
        }

        event.preventDefault();
        void handleShortcutAction('new_suggestion');
      }
    };

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
      shortcutUnlisten?.();
    };
  });

  async function setupGlobalShortcutListener() {
    if (!isTauri()) {
      return;
    }

    try {
      shortcutUnlisten = await listen<ShortcutPayload>('entrevistai://shortcut', (event) => {
        void handleShortcutAction(event.payload.action);
      });
    } catch {
      copyStatus = 'Atalhos globais indisponíveis';
    }
  }

  async function handleShortcutAction(action: ShortcutPayload['action']) {
    if (isDuplicateShortcut(action)) {
      return;
    }

    if (action === 'copy_response') {
      await copyResponse(true);
      return;
    }

    if (action === 'new_suggestion') {
      await requestNewSuggestion();
    }
  }

  async function copyResponse(requireVisible = false) {
    const answer = $responseStore.current?.answer;

    if (!answer) {
      return;
    }

    try {
      if (requireVisible && isTauri() && !(await getCurrentWindow().isVisible())) {
        return;
      }

      await navigator.clipboard.writeText(answer);
      copyStatus = 'Resposta copiada';
    } catch {
      copyStatus = 'Não foi possível copiar automaticamente';
    }
  }

  async function requestNewSuggestion() {
    copyStatus = '';
    answeredStatus = '';
    await generateNewSuggestion(settings.geminiApiKey, context);
  }

  function markAnswered() {
    answeredStatus = 'Marcado como respondido';
    window.setTimeout(() => {
      answeredStatus = '';
    }, 1800);
  }

  function extractKeywords(answer: string): string[] {
    const stopWords = new Set([
      'about',
      'after',
      'along',
      'also',
      'because',
      'before',
      'could',
      'during',
      'from',
      'into',
      'that',
      'their',
      'then',
      'there',
      'this',
      'through',
      'under',
      'with',
      'would'
    ]);

    const unique = new Map<string, string>();

    for (const match of answer.matchAll(/[A-Za-z][A-Za-z0-9+.#-]{3,}/g)) {
      const word = match[0];
      const key = word.toLowerCase();

      if (stopWords.has(key) || unique.has(key)) {
        continue;
      }

      unique.set(key, word);

      if (unique.size === 4) {
        break;
      }
    }

    return [...unique.values()];
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

  function isDuplicateShortcut(action: string): boolean {
    const now = performance.now();

    if (lastShortcutAction === action && now - lastShortcutAt < 250) {
      return true;
    }

    lastShortcutAction = action;
    lastShortcutAt = now;
    return false;
  }

  function isTauri(): boolean {
    return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
  }
</script>

{#if interviewMode}
  <section class="floating-surface relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-950/95 backdrop-blur-2xl">
    <div class="flex items-end justify-between border-b border-zinc-800/50 bg-zinc-950/80 px-8 py-4">
      <div>
        <h2 class="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Suggested Answer
        </h2>
        <p class="text-xs text-zinc-500">Read naturally. Pause at punctuation.</p>
      </div>

      <button
        class="flex items-center gap-1.5 rounded-xl border border-transparent px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700/50 hover:bg-zinc-800/50 hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
        on:click={requestNewSuggestion}
        type="button"
      >
        <iconify-icon icon="solar:refresh-linear" width="14" height="14"></iconify-icon>
        Regenerate
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-8 pb-24">
      {#if $responseStore.status === 'thinking'}
        <div class="floating-card flex min-h-44 flex-col justify-center rounded-3xl border border-zinc-800/70 bg-zinc-950/90 p-6">
          <p class="text-xs font-medium uppercase tracking-wide text-amber-300/80">Thinking</p>
          <div class="mt-4 flex gap-1">
            <div class="dot-typing h-2 w-2 rounded-full bg-zinc-500"></div>
            <div class="dot-typing h-2 w-2 rounded-full bg-zinc-500"></div>
            <div class="dot-typing h-2 w-2 rounded-full bg-zinc-500"></div>
          </div>
        </div>
      {:else if $responseStore.error}
        <div class="floating-card rounded-3xl border border-red-400/20 bg-red-500/10 p-5 text-sm leading-6 text-red-100">
          {$responseStore.error}
        </div>
      {:else if $responseStore.current}
        <article class="max-w-none" in:fade={{ duration: 160 }}>
          {#each answerParagraphs as paragraph}
            <p class="mb-5 whitespace-pre-wrap text-sm font-normal leading-loose tracking-wide text-zinc-100 sm:text-base">
              {paragraph}
            </p>
          {/each}
        </article>

        <div class="mt-10 border-t border-zinc-800/40 pt-6">
          <span class="mb-3 block text-xs uppercase tracking-wider text-zinc-500">
            Key Metrics to Hit
          </span>
          <div class="flex flex-wrap gap-2">
            {#each responseKeywords as keyword}
              <span
                class="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300"
              >
                {keyword}
              </span>
            {/each}
            {#if responseKeywords.length === 0}
              <span
                class="rounded border border-emerald-900/50 bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-400"
              >
                Answer ready
              </span>
            {/if}
          </div>
        </div>
      {:else}
        <div class="floating-card rounded-3xl border border-dashed border-zinc-800/70 bg-black/10 p-6">
          <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Suggested Answer</p>
          <p class="mt-3 text-sm leading-7 text-zinc-500">
            Waiting for a real interview question before generating a suggested answer.
          </p>
        </div>
      {/if}

      {#if $responseStore.current?.question}
        <div class="floating-card mt-8 rounded-2xl border border-zinc-800/50 bg-black/20 p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Last Question</p>
          <p class="mt-2 text-sm leading-6 text-zinc-300">{$responseStore.current.question}</p>
        </div>
      {/if}

      {#if copyStatus || answeredStatus}
        <p class="mt-4 text-xs font-medium text-emerald-400">{copyStatus || answeredStatus}</p>
      {/if}
    </div>

    {#if $responseStore.current}
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 flex h-24 items-end justify-center rounded-b-3xl bg-gradient-to-t from-zinc-950/95 via-zinc-950/80 to-transparent pb-6"
      >
        <button
          class="pointer-events-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:scale-[1.02] hover:bg-zinc-200 active:scale-[0.98]"
          on:click={markAnswered}
          type="button"
        >
          <iconify-icon icon="solar:check-read-linear" width="16" height="16"></iconify-icon>
          Mark as Answered
        </button>
      </div>
    {/if}
  </section>
{:else}
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
      on:click={() => copyResponse()}
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
{/if}
