<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import AudioStatus from './AudioStatus.svelte';
  import FileUploader from './FileUploader.svelte';
  import {
    getAudioCaptureStatus,
    startAudioCapture,
    startAudioChunkPolling,
    stopAudioCapture,
    type AudioCaptureStatus
  } from '../services/audioService';
  import { loadContext, loadSettings, saveContext, saveSettings } from '../services/contextStore';
  import { sendPreparationMessage } from '../services/geminiService';
  import { emptyContext, emptySettings, type AppSettings, type InterviewContext } from '../types';

  const defaultAudioStatus: AudioCaptureStatus = {
    status: 'Stopped',
    message: 'Stopped',
    lastAmplitude: 0,
    sampleRate: 16000,
    channels: 1,
    chunkSamples: 8000
  };

  let context: InterviewContext = emptyContext();
  let settings: AppSettings = emptySettings();
  let audioStatus: AudioCaptureStatus = defaultAudioStatus;
  let audioAmplitude = 0;
  let userMessage = '';
  let errorMessage = '';
  let successMessage = '';
  let isBooting = true;
  let isChatLoading = false;
  let isAudioBusy = false;
  let saveTimer: number | undefined;
  let settingsSaveTimer: number | undefined;
  let stopAudioPolling: (() => void) | undefined;
  let hasLoaded = false;

  $: canStartInterview = Boolean(context.cvText.trim() && context.jobText.trim());
  $: isAudioListening = audioStatus.status === 'Listening';
  $: contextSummary = [
    { label: 'Currículo', value: context.cvText.trim() ? 'Carregado' : 'Pendente' },
    { label: 'Vaga', value: context.jobText.trim() ? 'Carregada' : 'Pendente' },
    { label: 'Chat', value: `${context.chatMessages.length} mensagens` }
  ];

  loadInitialData();

  onMount(() => {
    refreshAudioStatus().then(() => {
      if (audioStatus.status === 'Listening') {
        beginAudioPolling();
      }
    });
  });

  onDestroy(() => {
    stopAudioPolling?.();
  });

  async function loadInitialData() {
    try {
      const [savedContext, savedSettings] = await Promise.all([loadContext(), loadSettings()]);
      context = { ...emptyContext(), ...savedContext };
      settings = { ...emptySettings(), ...savedSettings };
    } catch (error) {
      errorMessage = 'Não foi possível carregar o contexto salvo.';
    } finally {
      isBooting = false;
      hasLoaded = true;
    }
  }

  async function refreshAudioStatus() {
    try {
      audioStatus = await getAudioCaptureStatus();
      audioAmplitude = audioStatus.lastAmplitude;
    } catch (error) {
      audioStatus = {
        ...defaultAudioStatus,
        status: 'Error',
        message: error instanceof Error ? error.message : 'Não foi possível ler o status do áudio.'
      };
    }
  }

  function beginAudioPolling() {
    stopAudioPolling?.();
    stopAudioPolling = startAudioChunkPolling(
      (chunk, amplitude) => {
        audioAmplitude = amplitude;

        if (chunk.length > 0 && audioStatus.status === 'Listening') {
          audioStatus = { ...audioStatus, lastAmplitude: amplitude };
        }
      },
      (error) => {
        errorMessage = error.message;
        refreshAudioStatus();
      }
    );
  }

  function stopPolling() {
    stopAudioPolling?.();
    stopAudioPolling = undefined;
    audioAmplitude = 0;
  }

  function updateContext(update: Partial<InterviewContext>) {
    context = { ...context, ...update, updatedAt: new Date().toISOString() };
    queueContextSave();
  }

  function updateSettings(update: Partial<AppSettings>) {
    settings = { ...settings, ...update };
    queueSettingsSave();
  }

  function queueContextSave() {
    if (!hasLoaded) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveContext(context).catch(() => {
        errorMessage = 'Não foi possível salvar o contexto localmente.';
      });
    }, 350);
  }

  function queueSettingsSave() {
    if (!hasLoaded) return;
    window.clearTimeout(settingsSaveTimer);
    settingsSaveTimer = window.setTimeout(() => {
      saveSettings(settings).catch(() => {
        errorMessage = 'Não foi possível salvar as configurações.';
      });
    }, 350);
  }

  function handleExtracted(kind: 'cv' | 'job', event: CustomEvent<{ fileName: string; text: string }>) {
    errorMessage = '';
    successMessage = '';

    if (kind === 'cv') {
      updateContext({ cvText: event.detail.text, cvFileName: event.detail.fileName });
      return;
    }

    updateContext({ jobText: event.detail.text, jobFileName: event.detail.fileName });
  }

  function handleError(event: CustomEvent<string>) {
    errorMessage = event.detail;
    successMessage = '';
  }

  async function sendMessage() {
    const content = userMessage.trim();

    if (!content || isChatLoading) {
      return;
    }

    errorMessage = '';
    successMessage = '';
    isChatLoading = true;
    userMessage = '';

    const nextMessages = [
      ...context.chatMessages,
      { role: 'user' as const, content, createdAt: new Date().toISOString() }
    ];
    updateContext({ chatMessages: nextMessages });

    try {
      const answer = await sendPreparationMessage(settings.geminiApiKey, {
        ...context,
        chatMessages: nextMessages
      }, content);

      updateContext({
        chatMessages: [
          ...nextMessages,
          { role: 'assistant', content: answer, createdAt: new Date().toISOString() }
        ]
      });
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Gemini precisa de conexão para responder.';
    } finally {
      isChatLoading = false;
    }
  }

  async function startInterviewMode() {
    if (!canStartInterview) {
      return;
    }

    isAudioBusy = true;
    errorMessage = '';
    successMessage = '';

    try {
      await saveContext(context);
      const message = await startAudioCapture();
      await refreshAudioStatus();
      beginAudioPolling();
      successMessage = `${message} Contexto salvo para o modo entrevista.`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível iniciar a captura de áudio.';
      errorMessage = message;
      audioStatus = { ...defaultAudioStatus, status: 'Error', message };
    } finally {
      isAudioBusy = false;
    }
  }

  async function stopInterviewMode() {
    isAudioBusy = true;
    errorMessage = '';
    successMessage = '';

    try {
      const message = await stopAudioCapture();
      stopPolling();
      await refreshAudioStatus();
      successMessage = message;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Não foi possível parar a captura de áudio.';
    } finally {
      isAudioBusy = false;
    }
  }
</script>

<main class="min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
  <section class="mx-auto flex max-w-7xl flex-col gap-6">
    <header class="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-semibold text-focus">EntrevistAI</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
          Preparar Entrevista
        </h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Carregue seu currículo e a descrição da vaga para montar o contexto que será usado na
          entrevista.
        </p>
      </div>

      <button
        class="inline-flex min-h-12 items-center justify-center rounded-md bg-focus px-5 text-sm font-bold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        disabled={!canStartInterview || isBooting || isAudioBusy || isAudioListening}
        on:click={startInterviewMode}
      >
        Iniciar Modo Entrevista
      </button>
    </header>

    {#if errorMessage}
      <div class="rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
        {errorMessage}
      </div>
    {/if}

    {#if successMessage}
      <div class="rounded-md border border-focus/30 bg-focus/10 px-4 py-3 text-sm text-teal-100">
        {successMessage}
      </div>
    {/if}

    <AudioStatus
      status={audioStatus}
      amplitude={audioAmplitude}
      disabled={!canStartInterview || isBooting}
      isBusy={isAudioBusy}
      on:start={startInterviewMode}
      on:stop={stopInterviewMode}
    />

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
      <section class="space-y-5">
        <div class="rounded-lg border border-white/10 bg-graphite-900/80 p-5 shadow-2xl shadow-black/20">
          <h2 class="text-lg font-semibold text-white">Contexto da entrevista</h2>
          <div class="mt-4 grid gap-3 sm:grid-cols-3">
            {#each contextSummary as item}
              <div class="rounded-md border border-white/10 bg-black/20 p-3">
                <p class="text-xs text-slate-500">{item.label}</p>
                <p class="mt-1 text-sm font-semibold text-white">{item.value}</p>
              </div>
            {/each}
          </div>
        </div>

        <FileUploader
          label="Currículo"
          description="Aceita PDF, DOCX ou TXT com até 5MB."
          fileName={context.cvFileName}
          on:extracted={(event) => handleExtracted('cv', event)}
          on:error={handleError}
        />

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-white">Texto do currículo</span>
          <textarea
            class="min-h-52 w-full resize-y rounded-lg border border-white/10 bg-graphite-900/80 p-4 text-sm leading-6 text-slate-100 placeholder:text-slate-600"
            placeholder="Cole o texto do currículo aqui se o arquivo não puder ser lido."
            value={context.cvText}
            on:input={(event) => updateContext({ cvText: event.currentTarget.value })}
          ></textarea>
        </label>

        <FileUploader
          label="Descrição da vaga"
          description="Anexe PDF, DOCX ou TXT ou cole o texto abaixo."
          fileName={context.jobFileName}
          on:extracted={(event) => handleExtracted('job', event)}
          on:error={handleError}
        />

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-white">Descrição da vaga</span>
          <textarea
            class="min-h-44 w-full resize-y rounded-lg border border-white/10 bg-graphite-900/80 p-4 text-sm leading-6 text-slate-100 placeholder:text-slate-600"
            placeholder="Cole a descrição da vaga aqui."
            value={context.jobText}
            on:input={(event) => updateContext({ jobText: event.currentTarget.value })}
          ></textarea>
        </label>
      </section>

      <aside class="flex min-h-[680px] flex-col rounded-lg border border-white/10 bg-graphite-900/80 shadow-2xl shadow-black/20">
        <div class="border-b border-white/10 p-5">
          <h2 class="text-lg font-semibold text-white">Mini chat de preparação</h2>
          <p class="mt-2 text-sm leading-6 text-slate-400">
            O Gemini recebe o currículo e a vaga em todas as mensagens.
          </p>
        </div>

        <div class="border-b border-white/10 p-5">
          <label class="block">
            <span class="mb-2 block text-sm font-semibold text-white">API Key do Gemini</span>
            <input
              class="min-h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-slate-100 placeholder:text-slate-600"
              type="password"
              placeholder="Cole sua API Key"
              value={settings.geminiApiKey}
              on:input={(event) => updateSettings({ geminiApiKey: event.currentTarget.value })}
            />
          </label>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto p-5">
          {#if context.chatMessages.length === 0}
            <div class="rounded-lg border border-dashed border-white/15 p-5 text-sm leading-6 text-slate-400">
              Faça uma pergunta como “Me ajude a preparar respostas sobre minha experiência”.
            </div>
          {/if}

          {#each context.chatMessages as message}
            <article
              class={`rounded-lg p-4 text-sm leading-6 ${
                message.role === 'user'
                  ? 'ml-8 bg-focus/10 text-teal-50'
                  : 'mr-8 border border-white/10 bg-black/20 text-slate-100'
              }`}
            >
              <p class="mb-1 text-xs font-semibold uppercase tracking-normal text-slate-500">
                {message.role === 'user' ? 'Você' : 'Gemini'}
              </p>
              <p class="whitespace-pre-wrap">{message.content}</p>
            </article>
          {/each}

          {#if isChatLoading}
            <div class="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
              Gemini está preparando a resposta...
            </div>
          {/if}
        </div>

        <form class="border-t border-white/10 p-5" on:submit|preventDefault={sendMessage}>
          <label class="block">
            <span class="sr-only">Mensagem para o Gemini</span>
            <textarea
              class="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-100 placeholder:text-slate-600"
              placeholder="Digite sua pergunta de preparação..."
              bind:value={userMessage}
            ></textarea>
          </label>

          <button
            class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-white px-4 text-sm font-bold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={!userMessage.trim() || isChatLoading}
            type="submit"
          >
            Enviar para Gemini
          </button>
        </form>
      </aside>
    </div>
  </section>
</main>
