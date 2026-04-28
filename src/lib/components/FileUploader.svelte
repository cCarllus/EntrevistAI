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

<div class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p class="text-sm font-semibold text-white">{label}</p>
      <p class="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      {#if fileName}
        <p class="mt-2 text-xs text-focus">Arquivo carregado: {fileName}</p>
      {/if}
    </div>

    <label
      class="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-focus/40 px-4 text-sm font-semibold text-focus transition hover:border-focus hover:bg-focus/10"
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
