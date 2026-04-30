<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { extractTextFromFile } from '../services/fileExtractor';

  export let label: string;
  export let description: string;
  export let fileName: string | null = null;

  const dispatch = createEventDispatcher<{
    extracted: { fileName: string; text: string };
    error: string;
  }>();

  let isLoading = false;
  let inputId = `file-${Math.random().toString(36).slice(2)}`;

  async function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    isLoading = true;

    try {
      dispatch('extracted', await extractTextFromFile(file));
    } catch (error) {
      dispatch('error', error instanceof Error ? error.message : 'Não foi possível ler o arquivo.');
    } finally {
      isLoading = false;
      input.value = '';
    }
  }
</script>

<div class="floating-card rounded-2xl border border-zinc-800/70 bg-zinc-950/90 p-3 backdrop-blur-xl">
  <div class="flex min-w-0 flex-col gap-3">
    <div class="min-w-0">
      <p class="text-sm font-medium text-zinc-100">{label}</p>
      <p class="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
      {#if fileName}
        <p class="mt-2 min-w-0 break-words text-xs leading-5 text-emerald-400">
          <span class="block text-emerald-500/80">Arquivo carregado:</span>
          <span class="break-all">{fileName}</span>
        </p>
      {/if}
    </div>

    <label
      class="inline-flex min-h-9 w-fit max-w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border border-zinc-700 px-3 text-xs font-medium text-zinc-300 transition hover:border-emerald-500/50 hover:bg-emerald-950/20 hover:text-emerald-400"
      for={inputId}
    >
      {isLoading ? 'Extraindo...' : 'Anexar arquivo'}
    </label>
  </div>

  <input
    id={inputId}
    class="sr-only"
    type="file"
    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
    on:change={handleFileChange}
  />
</div>
