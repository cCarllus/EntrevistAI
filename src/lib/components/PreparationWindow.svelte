<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import FileUploader from './FileUploader.svelte';
  import ResponsePanel from './ResponsePanel.svelte';
  import TranscriptionPanel from './TranscriptionPanel.svelte';
  import {
    getAudioCaptureStatus,
    startAudioCapture,
    startAudioChunkPolling,
    stopAudioCapture,
    type AudioCaptureStatus
  } from '../services/audioService';
  import { loadContext, loadSettings, saveContext, saveSettings } from '../services/contextStore';
  import { geminiLiveService } from '../services/geminiLiveService';
  import { sendPreparationMessage } from '../services/geminiService';
  import {
    completeCurrentTurn,
    resetTranscription,
    transcriptionStore,
    type TranscriptionTurn
  } from '../stores/transcriptionStore';
  import { generateAutomaticResponse, resetResponses } from '../stores/responseStore';
  import { emptyContext, emptySettings, type AppSettings, type InterviewContext } from '../types';

  const defaultAudioStatus: AudioCaptureStatus = {
    status: 'Stopped',
    message: 'Stopped',
    lastAmplitude: 0,
    sampleRate: 16000,
    channels: 1,
    chunkSamples: 6400
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
  let shortcutUnlisten: UnlistenFn | undefined;
  let lastShortcutAction = '';
  let lastShortcutAt = 0;
  let hasLoaded = false;
  let activeView: 'interview' | 'context' | 'api' = 'interview';
  let topBarMessage = '';
  let toast: { type: 'error' | 'success'; message: string } | null = null;
  let toastTimer: number | undefined;
  let lastNotificationKey = '';

  type ShortcutPayload = {
    action: 'toggle_interview' | 'new_suggestion' | 'copy_response' | 'toggle_window';
  };

  $: canStartInterview = Boolean(context.cvText.trim() && context.jobText.trim());
  $: isAudioListening = audioStatus.status === 'Listening';
  $: contextSummary = [
    { label: 'Currículo', value: context.cvText.trim() ? 'Carregado' : 'Pendente' },
    { label: 'Vaga', value: context.jobText.trim() ? 'Carregada' : 'Pendente' },
    { label: 'Chat', value: `${context.chatMessages.length} mensagens` }
  ];
  $: notificationMessage = errorMessage || successMessage;
  $: notificationKey = notificationMessage ? `${errorMessage ? 'error' : 'success'}:${notificationMessage}` : '';
  $: if (notificationKey && notificationKey !== lastNotificationKey) {
    lastNotificationKey = notificationKey;
    showToast(errorMessage ? 'error' : 'success', notificationMessage);
  } else if (!notificationKey) {
    lastNotificationKey = '';
  }

  loadInitialData();

  onMount(() => {
    void setupGlobalShortcutListener();
    window.addEventListener('keydown', handleLocalShortcut);

    refreshAudioStatus().then(() => {
      if (audioStatus.status === 'Listening') {
        beginAudioPolling();
      }
    });
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleLocalShortcut);
    shortcutUnlisten?.();
    stopAudioPolling?.();
    window.clearTimeout(toastTimer);
    geminiLiveService.stop();
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
          geminiLiveService.sendAudioSamples(chunk);
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

  async function saveContextNow() {
    errorMessage = '';
    successMessage = '';

    try {
      await saveContext(context);
      successMessage = 'Contexto da conversa salvo.';
      topBarMessage = 'Saved';
      clearTopBarMessage();
    } catch {
      errorMessage = 'Não foi possível salvar o contexto localmente.';
    }
  }

  async function saveSettingsNow() {
    errorMessage = '';
    successMessage = '';

    try {
      await saveSettings(settings);
      successMessage = 'Configurações do Gemini salvas.';
      topBarMessage = 'Saved';
      clearTopBarMessage();
    } catch {
      errorMessage = 'Não foi possível salvar as configurações.';
    }
  }

  function clearTopBarMessage() {
    window.setTimeout(() => {
      topBarMessage = '';
    }, 1600);
  }

  function showToast(type: 'error' | 'success', message: string) {
    window.clearTimeout(toastTimer);
    toast = { type, message };
    toastTimer = window.setTimeout(() => {
      toast = null;
    }, 4200);
  }

  function dismissToast() {
    window.clearTimeout(toastTimer);
    toast = null;
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
      resetTranscription();
      resetResponses();
      await geminiLiveService.start(settings.geminiApiKey, {
        onTurnFinalized: handleInterviewTurnFinalized
      });
      const message = await startAudioCapture();
      await refreshAudioStatus();
      beginAudioPolling();
      successMessage = `${message} Contexto salvo para o modo entrevista.`;
      activeView = 'interview';
    } catch (error) {
      geminiLiveService.stop();
      const message =
        error instanceof Error ? error.message : 'Não foi possível iniciar a captura de áudio.';
      errorMessage = friendlyGeminiError(message);
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
      completeCurrentTurn();
      geminiLiveService.stop();
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

  async function handleInterviewTurnFinalized(turn: TranscriptionTurn) {
    await generateAutomaticResponse({
      apiKey: settings.geminiApiKey,
      context,
      question: turn.english,
      conversationHistory: buildConversationHistory(turn)
    });
  }

  function buildConversationHistory(latestTurn: TranscriptionTurn): string {
    const previousTurns = $transcriptionStore.turns.filter((turn) => turn.id !== latestTurn.id);
    const recentTurns = [...previousTurns, latestTurn].slice(-5);

    if (recentTurns.length === 0) {
      return 'Sem histórico anterior.';
    }

    return recentTurns
      .map((turn, index) => {
        const portuguese = turn.portuguese ? `\nTradução PT-BR: ${turn.portuguese}` : '';
        return `Turno ${index + 1} - Entrevistadora: ${turn.english}${portuguese}`;
      })
      .join('\n\n');
  }

  async function openInterviewInterface() {
    if (!canStartInterview) {
      activeView = 'context';
      return;
    }

    if (isAudioListening) {
      activeView = 'interview';
      return;
    }

    errorMessage = '';
    successMessage = '';

    try {
      await saveContext(context);
      successMessage = 'Contexto salvo para o modo entrevista.';
      activeView = 'interview';
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Não foi possível salvar o contexto localmente.';
    }
  }

  async function minimizeWindow() {
    if (!isTauri()) {
      return;
    }

    try {
      await getCurrentWindow().minimize();
    } catch {
      errorMessage = 'Não foi possível minimizar a janela.';
    }
  }

  async function closeWindow() {
    if (!isTauri()) {
      window.close();
      return;
    }

    try {
      await getCurrentWindow().close();
    } catch {
      errorMessage = 'Não foi possível fechar a janela.';
    }
  }

  async function startWindowDrag(event: MouseEvent) {
    if (!isTauri() || event.button !== 0) {
      return;
    }

    const target = event.target;
    const isDragLayer =
      target instanceof HTMLElement && target.closest('[data-window-drag-layer]');

    if (
      !isDragLayer &&
      target instanceof HTMLElement &&
      target.closest('button, input, textarea, label, a, [role="button"]')
    ) {
      return;
    }

    try {
      await getCurrentWindow().startDragging();
    } catch {
      // The data-tauri-drag-region attribute remains as a fallback.
    }
  }

  async function setupGlobalShortcutListener() {
    if (!isTauri()) {
      return;
    }

    try {
      shortcutUnlisten = await listen<ShortcutPayload>('entrevistai://shortcut', (event) => {
        void handleShortcutAction(event.payload.action);
      });
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Não foi possível ativar atalhos globais.';
    }
  }

  function handleLocalShortcut(event: KeyboardEvent) {
    if (isTauri()) {
      return;
    }

    const key = event.key.toLowerCase();

    if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'i') {
      event.preventDefault();
      void handleShortcutAction('toggle_interview');
    }
  }

  async function handleShortcutAction(action: ShortcutPayload['action']) {
    if (isDuplicateShortcut(action)) {
      return;
    }

    if (action !== 'toggle_interview') {
      return;
    }

    if (isAudioListening) {
      await stopInterviewMode();
      return;
    }

    if (!canStartInterview) {
      errorMessage = 'Carregue currículo e vaga antes de iniciar o modo entrevista.';
      return;
    }

    await startInterviewMode();
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

  function friendlyGeminiError(message: string): string {
    const normalized = message.toLowerCase();

    if (
      normalized.includes('gemini') &&
      (normalized.includes('conex') ||
        normalized.includes('websocket') ||
        normalized.includes('network') ||
        normalized.includes('internet'))
    ) {
      return 'Gemini desconectado. Verifique sua internet/API Key e tente iniciar novamente.';
    }

    return message;
  }

  function isTauri(): boolean {
    return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
  }
</script>

<main class="relative flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-200 antialiased">
  <section
    class="glass-highlight relative flex h-full w-full flex-col overflow-hidden border border-zinc-800/60 bg-zinc-950/60 shadow-2xl shadow-black backdrop-blur-3xl"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <header
      class="relative z-20 flex h-12 flex-none items-center justify-between border-b border-zinc-800/40 bg-zinc-900/20 px-4"
      data-tauri-drag-region
      on:mousedown={startWindowDrag}
      role="banner"
    >
      <button
        class="absolute inset-0 z-0 cursor-default appearance-none border-0 bg-transparent p-0"
        aria-label="Arrastar janela"
        data-tauri-drag-region
        data-window-drag-layer
        tabindex="-1"
        type="button"
        on:mousedown={startWindowDrag}
      ></button>

      <div class="relative z-10 flex items-center gap-4">
        <div class="flex items-center gap-2">
          <button
            class="h-3 w-3 rounded-full bg-red-500/80 transition hover:bg-red-400"
            aria-label="Fechar janela"
            on:click={closeWindow}
            type="button"
          ></button>
          <button
            class="h-3 w-3 rounded-full bg-yellow-500/80 transition hover:bg-yellow-400"
            aria-label="Minimizar janela"
            on:click={minimizeWindow}
            type="button"
          ></button>
        </div>
        <h1 class="text-sm font-medium uppercase tracking-tight text-zinc-100">EntrevistAI</h1>
        <div class="h-3 w-px bg-zinc-700/50"></div>
        <div class="flex items-center gap-2">
          <div
            class={`h-2 w-2 rounded-full ${
              isAudioListening ? 'animate-pulse-ring bg-green-500' : canStartInterview ? 'bg-green-500' : 'bg-zinc-600'
            }`}
          ></div>
          <span class="mt-px text-xs font-normal uppercase tracking-wide text-zinc-400">
            {isAudioListening ? 'Listening' : canStartInterview ? 'Ready' : 'Setup'}
          </span>
        </div>
      </div>

      <nav class="relative z-10 flex min-w-0 items-center gap-1">
        <button
          class={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            activeView === 'interview'
              ? 'bg-zinc-800/70 text-zinc-100'
              : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200'
          }`}
          on:click={() => (activeView = 'interview')}
          type="button"
        >
          <iconify-icon icon="solar:chat-round-dots-linear" width="14" height="14"></iconify-icon>
          Entrevista IA
        </button>
        <button
          class={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            activeView === 'context'
              ? 'bg-zinc-800/70 text-zinc-100'
              : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200'
          }`}
          on:click={() => (activeView = 'context')}
          type="button"
        >
          <iconify-icon icon="solar:folder-with-files-linear" width="14" height="14"></iconify-icon>
          Contexto da conversa
        </button>
        <button
          class={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            activeView === 'api'
              ? 'bg-zinc-800/70 text-zinc-100'
              : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200'
          }`}
          on:click={() => (activeView = 'api')}
          type="button"
        >
          <iconify-icon icon="solar:key-minimalistic-2-linear" width="14" height="14"></iconify-icon>
          Gemini API
        </button>
      </nav>

      <div class="relative z-10 flex items-center gap-1.5 text-zinc-400">
        {#if topBarMessage}
          <span class="hidden pr-2 text-xs font-medium uppercase tracking-wide text-emerald-400 sm:inline">
            {topBarMessage}
          </span>
        {/if}
        <button
          class="flex items-center justify-center rounded-md p-1.5 transition-colors duration-200 hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none disabled:cursor-not-allowed disabled:text-zinc-700"
          disabled={!canStartInterview || isBooting || isAudioBusy || isAudioListening}
          on:click={startInterviewMode}
          title="Start listening"
          type="button"
        >
          <iconify-icon icon="solar:play-circle-linear" width="16" height="16"></iconify-icon>
        </button>
        <button
          class="flex items-center justify-center rounded-md p-1.5 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-400 focus:outline-none disabled:cursor-not-allowed disabled:text-zinc-700"
          disabled={isAudioBusy || !isAudioListening}
          on:click={stopInterviewMode}
          title="Stop listening"
          type="button"
        >
          <iconify-icon icon="solar:stop-circle-linear" width="16" height="16"></iconify-icon>
        </button>
      </div>
    </header>

    <div class="relative z-10 flex min-h-0 flex-1 overflow-hidden">
      {#if activeView === 'interview'}
        <TranscriptionPanel interviewMode {audioAmplitude} isListening={isAudioListening} />
        <ResponsePanel {context} {settings} interviewMode />
      {:else if activeView === 'context'}
      <section class="relative flex h-full w-[38%] min-w-[310px] flex-col border-r border-zinc-800/40 bg-zinc-950/30">
        <div
          class="flex items-center justify-between border-b border-zinc-800/20 bg-zinc-950/40 px-5 py-3"
        >
          <span class="text-xs tracking-wide text-zinc-500">Contexto da conversa</span>
          <div class="flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
            {#each contextSummary as item}
              <span class={item.value === 'Pendente' ? 'text-zinc-600' : 'text-green-500/80'}>
                {item.label}
              </span>
            {/each}
          </div>
        </div>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 pb-24">
          <FileUploader
            label="Currículo"
            description="PDF, DOCX ou TXT até 5MB."
            fileName={context.cvFileName}
            on:extracted={(event) => handleExtracted('cv', event)}
            on:error={handleError}
          />

          <label class="block">
            <span class="mb-2 block text-xs uppercase tracking-wider text-zinc-500">
              Texto do currículo
            </span>
            <textarea
              class="min-h-36 w-full resize-none rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3 text-xs leading-5 text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
              placeholder="Cole o texto do currículo aqui."
              value={context.cvText}
              on:input={(event) => updateContext({ cvText: event.currentTarget.value })}
            ></textarea>
          </label>

          <FileUploader
            label="Descrição da vaga"
            description="Anexe arquivo ou cole o texto abaixo."
            fileName={context.jobFileName}
            on:extracted={(event) => handleExtracted('job', event)}
            on:error={handleError}
          />

          <label class="block">
            <span class="mb-2 block text-xs uppercase tracking-wider text-zinc-500">
              Descrição da vaga
            </span>
            <textarea
              class="min-h-32 w-full resize-none rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3 text-xs leading-5 text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
              placeholder="Cole a descrição da vaga aqui."
              value={context.jobText}
              on:input={(event) => updateContext({ jobText: event.currentTarget.value })}
            ></textarea>
          </label>
        </div>

        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950/90 to-transparent"></div>
      </section>

      <section class="relative flex h-full min-w-0 flex-1 flex-col bg-zinc-950/10">
        <div class="flex items-end justify-between border-b border-zinc-800/20 bg-zinc-950/10 px-8 py-4">
          <div>
            <h2 class="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Chat de contexto
            </h2>
            <p class="text-xs text-zinc-500">Perguntas de preparação também entram no contexto da conversa.</p>
          </div>

          <div class="flex items-center gap-2">
            <button
              class="inline-flex min-h-9 items-center gap-2 rounded-md bg-white px-3 text-xs font-medium text-zinc-950 transition hover:bg-zinc-200"
              on:click={saveContextNow}
              type="button"
            >
              <iconify-icon icon="solar:diskette-linear" width="15" height="15"></iconify-icon>
              Salvar contexto
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 space-y-6 overflow-y-auto p-8 pb-28">
          <section class="flex min-h-[320px] flex-col rounded-xl border border-zinc-800/60 bg-zinc-950/30">
            <div class="border-b border-zinc-800/40 px-4 py-3">
              <h3 class="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Mini Chat de Preparação
              </h3>
            </div>

            <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {#if context.chatMessages.length === 0}
                <div class="rounded-xl border border-dashed border-zinc-800/70 p-4 text-sm leading-6 text-zinc-500">
                  Faça uma pergunta como “Me ajude a preparar respostas sobre minha experiência”.
                </div>
              {/if}

              {#each context.chatMessages as message}
                <article
                  class={`rounded-xl p-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'ml-8 border border-emerald-900/30 bg-emerald-950/20 text-emerald-50'
                      : 'mr-8 border border-zinc-800 bg-black/20 text-zinc-100'
                  }`}
                >
                  <p class="mb-1 text-xs uppercase tracking-wider text-zinc-500">
                    {message.role === 'user' ? 'Você' : 'Gemini'}
                  </p>
                  <p class="whitespace-pre-wrap">{message.content}</p>
                </article>
              {/each}

              {#if isChatLoading}
                <div class="flex gap-1 p-2">
                  <div class="dot-typing h-1.5 w-1.5 rounded-full bg-zinc-700"></div>
                  <div class="dot-typing h-1.5 w-1.5 rounded-full bg-zinc-700"></div>
                  <div class="dot-typing h-1.5 w-1.5 rounded-full bg-zinc-700"></div>
                </div>
              {/if}
            </div>

            <form class="border-t border-zinc-800/40 p-4" on:submit|preventDefault={sendMessage}>
              <label class="block">
                <span class="sr-only">Mensagem para o Gemini</span>
                <textarea
                  class="min-h-20 w-full resize-none rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3 text-sm leading-6 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
                  placeholder="Digite sua pergunta de preparação..."
                  bind:value={userMessage}
                ></textarea>
              </label>

              <button
                class="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-white px-4 text-xs font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                disabled={!userMessage.trim() || isChatLoading}
                type="submit"
              >
                Enviar para Gemini
              </button>
            </form>
          </section>
        </div>

        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-zinc-950/95 via-zinc-950/80 to-transparent"></div>
      </section>
      {:else}
        <section class="relative flex h-full w-full flex-col bg-zinc-950/10">
          <div class="flex items-end justify-between border-b border-zinc-800/20 bg-zinc-950/10 px-8 py-4">
            <div>
              <h2 class="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Gemini API
              </h2>
              <p class="text-xs text-zinc-500">
                Configure a chave usada nas respostas e no live transcription.
              </p>
            </div>

            <button
              class="inline-flex min-h-9 items-center gap-2 rounded-md bg-white px-3 text-xs font-medium text-zinc-950 transition hover:bg-zinc-200"
              on:click={saveSettingsNow}
              type="button"
            >
              <iconify-icon icon="solar:diskette-linear" width="15" height="15"></iconify-icon>
              Salvar chave
            </button>
          </div>

          <div class="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-8">
            <div class="w-full max-w-xl rounded-2xl border border-zinc-800/70 bg-zinc-950/30 p-6">
              <label class="block">
                <span class="mb-2 block text-xs uppercase tracking-wider text-zinc-500">
                  API Key do Gemini
                </span>
                <input
                  class="h-12 w-full rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
                  type="password"
                  placeholder="Cole sua API Key"
                  value={settings.geminiApiKey}
                  on:input={(event) => updateSettings({ geminiApiKey: event.currentTarget.value })}
                />
              </label>
              <p class="mt-3 text-xs leading-5 text-zinc-500">
                A chave fica salva localmente e é usada para o Gemini Live e para gerar respostas sugeridas.
              </p>
            </div>
          </div>
        </section>
      {/if}
    </div>
  </section>

  {#if toast}
    <div
      class={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-2xl ${
        toast.type === 'error'
          ? 'border-red-400/20 bg-red-950/80 text-red-100'
          : 'border-emerald-400/20 bg-emerald-950/80 text-emerald-100'
      }`}
      transition:fly={{ x: 24, duration: 180 }}
    >
      <div
        class={`mt-1 h-2 w-2 flex-none rounded-full ${
          toast.type === 'error' ? 'bg-red-400' : 'bg-emerald-400'
        }`}
      ></div>
      <p class="min-w-0 flex-1 leading-5">{toast.message}</p>
      <button
        class="flex h-6 w-6 flex-none items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
        aria-label="Fechar notificação"
        on:click={dismissToast}
        type="button"
      >
        <iconify-icon icon="solar:close-circle-linear" width="15" height="15"></iconify-icon>
      </button>
    </div>
  {/if}
</main>
