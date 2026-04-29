import {
  appendInputTranscription,
  appendTranslation,
  completeCurrentTurn,
  getCurrentTurn,
  setTurnTranslation,
  setTranscriptionStatus
} from '../stores/transcriptionStore';

const liveEndpoint =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const liveModelCandidates = [
  { model: 'models/gemini-2.5-flash-native-audio', responseModality: 'AUDIO' },
  { model: 'models/gemini-2.5-flash-live-preview', responseModality: 'TEXT' },
  { model: 'models/gemini-2.5-flash-native-audio-preview-12-2025', responseModality: 'AUDIO' },
  { model: 'models/gemini-2.0-flash-live-preview-04-09', responseModality: 'TEXT' },
  { model: 'models/gemini-2.0-flash-live-001', responseModality: 'TEXT' }
] as const;
const maxQueuedChunks = 30;
const reconnectDelayMs = 3000;
const setupTimeoutMs = 6000;
const turnSilenceMs = 2500;
const transcriptionWatchdogMs = 20000;
const voiceAmplitudeThreshold = 0.01;

const systemInstruction =
  'Você é um assistente de entrevistas em tempo real.\n' +
  'Transcreva o áudio em inglês com precisão.\n' +
  'IMEDIATAMENTE após cada transcrição, forneça a tradução para português brasileiro (PT-BR) de forma clara e natural.\n' +
  'Trabalhe de forma incremental: não espere o fim de uma resposta longa para traduzir o trecho já entendido.\n' +
  'Formato exato de resposta:\n' +
  'Inglês: [transcrição]\n' +
  'Português: [tradução completa]\n' +
  'Nunca explique seu processo, nunca use markdown e nunca diga que está iniciando, analisando ou transcrevendo.';

type ServerPart = {
  text?: string;
};

type GeminiLiveServerMessage = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  setupComplete?: Record<string, never>;
  serverContent?: {
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: {
      parts?: ServerPart[];
    };
    generationComplete?: boolean;
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  goAway?: { timeLeft?: string };
  usageMetadata?: unknown;
};

class GeminiLiveService {
  private socket: WebSocket | null = null;
  private apiKey = '';
  private isManuallyClosed = true;
  private isSetupComplete = false;
  private setupTimer: number | undefined;
  private pendingAudioChunks: string[] = [];
  private reconnectTimer: number | undefined;
  private turnCompletionTimer: number | undefined;
  private transcriptionWatchdogTimer: number | undefined;
  private liveModelIndex = 0;
  private lastAudioSentAt = 0;
  private lastVoiceAudioSentAt = 0;
  private lastTranscriptionAt = 0;

  async start(apiKey: string): Promise<void> {
    const trimmedApiKey = apiKey.trim();

    if (!trimmedApiKey) {
      throw new Error('Configure sua API Key do Gemini antes de iniciar o modo entrevista.');
    }

    if (!navigator.onLine) {
      throw new Error('Gemini Live precisa de conexão com a internet.');
    }

    this.stop();
    this.apiKey = trimmedApiKey;
    this.isManuallyClosed = false;
    this.liveModelIndex = 0;
    this.openSocket('connecting');
  }

  stop(): void {
    this.isManuallyClosed = true;
    this.isSetupComplete = false;
    this.pendingAudioChunks = [];
    window.clearTimeout(this.setupTimer);
    window.clearTimeout(this.reconnectTimer);
    window.clearTimeout(this.turnCompletionTimer);
    window.clearTimeout(this.transcriptionWatchdogTimer);

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN && this.isSetupComplete) {
        this.socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      }

      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;

      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
    }

    this.socket = null;
    this.lastAudioSentAt = 0;
    this.lastVoiceAudioSentAt = 0;
    this.lastTranscriptionAt = 0;
    setTranscriptionStatus('stopped', 'Gemini Live parado');
  }

  sendAudioSamples(samples: number[]): void {
    if (!samples.length || this.isManuallyClosed) {
      return;
    }

    const base64Audio = floatSamplesToPcm16Base64(samples);
    this.lastAudioSentAt = Date.now();

    if (calculateAmplitude(samples) >= voiceAmplitudeThreshold) {
      this.lastVoiceAudioSentAt = this.lastAudioSentAt;
      this.armTranscriptionWatchdog();
    }

    if (!this.isReady()) {
      this.pendingAudioChunks.push(base64Audio);
      this.pendingAudioChunks = this.pendingAudioChunks.slice(-maxQueuedChunks);
      return;
    }

    this.sendAudioChunk(base64Audio);
  }

  private openSocket(status: 'connecting' | 'reconnecting'): void {
    this.isSetupComplete = false;
    window.clearTimeout(this.setupTimer);
    setTranscriptionStatus(
      status,
      status === 'connecting' ? 'Conectando ao Gemini Live...' : 'Reconectando ao Gemini Live...'
    );

    const url = `${liveEndpoint}?key=${encodeURIComponent(this.apiKey)}`;
    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;

    socket.onopen = () => {
      setTranscriptionStatus(status, 'WebSocket conectado. Configurando Gemini Live...');
      this.sendSetupMessage();
      this.armSetupTimeout();
    };

    socket.onmessage = (event) => {
      void this.handleMessage(event.data);
    };

    socket.onerror = () => {
      setTranscriptionStatus('error', 'Erro na conexão com Gemini Live.', 'Falha no WebSocket.');
    };

    socket.onclose = (event) => {
      this.socket = null;
      this.isSetupComplete = false;
      window.clearTimeout(this.setupTimer);

      if (this.isManuallyClosed) {
        return;
      }

      const reason = formatCloseReason(event);

      if (!this.isSetupComplete && this.tryNextModel(reason)) {
        return;
      }

      if (this.isFatalSetupClose(event)) {
        this.isManuallyClosed = true;
        setTranscriptionStatus(
          'error',
          `Gemini Live rejeitou a configuração: ${reason}`,
          `A conexão foi fechada antes do setupComplete. Detalhe: ${reason}. Verifique API key, modelo e disponibilidade do Live API para sua conta.`
        );
        return;
      }

      setTranscriptionStatus('reconnecting', `Gemini Live caiu: ${reason}. Reconectando...`);
      this.reconnectTimer = window.setTimeout(() => {
        this.openSocket('reconnecting');
      }, reconnectDelayMs);
    };
  }

  private sendSetupMessage(): void {
    const candidate = this.currentModelCandidate();
    const setup = {
      model: candidate.model,
      generationConfig: {
        responseModalities: [candidate.responseModality],
        temperature: 0.1,
        maxOutputTokens: 1000
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      inputAudioTranscription: {},
      ...(candidate.responseModality === 'AUDIO' ? { outputAudioTranscription: {} } : {}),
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          silenceDurationMs: 900
        }
      }
    };

    this.socket?.send(JSON.stringify({ setup }));
  }

  private async handleMessage(rawMessage: unknown): Promise<void> {
    const text = await decodeWebSocketPayload(rawMessage);

    if (!text) {
      return;
    }

    let message: GeminiLiveServerMessage;

    try {
      message = JSON.parse(text) as GeminiLiveServerMessage;
    } catch {
      setTranscriptionStatus('error', 'Gemini Live retornou uma mensagem inválida.', text);
      return;
    }

    if (message.error) {
      const errorMessage = message.error.message || message.error.status || 'Erro retornado pelo Gemini Live.';

      if (this.tryNextModel(errorMessage)) {
        return;
      }

      this.isManuallyClosed = true;
      setTranscriptionStatus('error', `Gemini Live rejeitou a configuração: ${errorMessage}`, errorMessage);
      this.socket?.close();
      return;
    }

    if (message.setupComplete) {
      window.clearTimeout(this.setupTimer);
      this.isSetupComplete = true;
      setTranscriptionStatus('connected', 'Gemini Live conectado');
      this.flushPendingAudio();
      return;
    }

    if (message.goAway) {
      setTranscriptionStatus('reconnecting', 'Gemini Live solicitou nova conexão. Reconectando...');
      this.reconnectNow();
      return;
    }

    const serverContent = message.serverContent;

    if (!serverContent) {
      return;
    }

    const transcriptionText = serverContent.inputTranscription?.text;
    if (transcriptionText) {
      appendInputTranscription(transcriptionText);
      this.lastTranscriptionAt = Date.now();
      this.scheduleTurnCompletion();
    }

    const modelTurnText = serverContent.modelTurn?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (modelTurnText && !looksLikeProcessLog(modelTurnText)) {
      appendTranslatedResponse(modelTurnText);
    }

    const outputTranscriptionText = serverContent.outputTranscription?.text;
    if (outputTranscriptionText && !looksLikeProcessLog(outputTranscriptionText)) {
      appendTranslatedResponse(outputTranscriptionText);
    }
  }

  private flushPendingAudio(): void {
    if (!this.isReady()) {
      return;
    }

    const chunks = this.pendingAudioChunks;
    this.pendingAudioChunks = [];
    chunks.forEach((chunk) => this.sendAudioChunk(chunk));
  }

  private reconnectNow(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
      return;
    }

    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      this.openSocket('reconnecting');
    }, reconnectDelayMs);
  }

  private scheduleTurnCompletion(): void {
    window.clearTimeout(this.turnCompletionTimer);
    this.turnCompletionTimer = window.setTimeout(() => {
      void this.finalizeCurrentTurn();
    }, turnSilenceMs);
  }

  private async finalizeCurrentTurn(): Promise<void> {
    window.clearTimeout(this.turnCompletionTimer);
    if (getCurrentTurn()) {
      completeCurrentTurn();
    }
  }

  private armTranscriptionWatchdog(): void {
    if (!this.isReady()) {
      return;
    }

    if (this.transcriptionWatchdogTimer) {
      return;
    }

    this.transcriptionWatchdogTimer = window.setTimeout(() => {
      this.transcriptionWatchdogTimer = undefined;

      if (this.isManuallyClosed || !this.isReady()) {
        return;
      }

      const now = Date.now();
      const voiceAudioIsFlowing = now - this.lastVoiceAudioSentAt < 1500;
      const transcriptionIsStale =
        this.lastTranscriptionAt === 0 || now - this.lastTranscriptionAt >= transcriptionWatchdogMs;

      if (voiceAudioIsFlowing && transcriptionIsStale) {
        setTranscriptionStatus(
          'reconnecting',
          'Gemini Live parou de enviar transcrição. Reconectando...'
        );
        this.reconnectNow();
        return;
      }

      if (voiceAudioIsFlowing) {
        this.armTranscriptionWatchdog();
      }
    }, transcriptionWatchdogMs);
  }

  private armSetupTimeout(): void {
    window.clearTimeout(this.setupTimer);
    this.setupTimer = window.setTimeout(() => {
      if (this.isSetupComplete || this.isManuallyClosed) {
        return;
      }

      this.isManuallyClosed = true;
      setTranscriptionStatus(
        'error',
        'Gemini Live abriu o WebSocket, mas não confirmou a configuração.',
        'Timeout aguardando setupComplete. Verifique se a API key tem acesso ao Live API e se o modelo está disponível na sua conta.'
      );

      this.socket?.close();
      this.socket = null;
    }, setupTimeoutMs);
  }

  private currentModelCandidate(): (typeof liveModelCandidates)[number] {
    return liveModelCandidates[this.liveModelIndex] ?? liveModelCandidates[0];
  }

  private tryNextModel(reason: string): boolean {
    if (!isModelSetupFailure(reason) || this.liveModelIndex >= liveModelCandidates.length - 1) {
      return false;
    }

    const failedModel = this.currentModelCandidate().model.replace(/^models\//, '');
    this.liveModelIndex += 1;
    const nextModel = this.currentModelCandidate().model.replace(/^models\//, '');
    setTranscriptionStatus(
      'reconnecting',
      `Modelo ${failedModel} indisponível. Tentando ${nextModel}...`
    );
    this.reopenSocketForCurrentModel();
    return true;
  }

  private reopenSocketForCurrentModel(): void {
    window.clearTimeout(this.setupTimer);
    window.clearTimeout(this.reconnectTimer);

    const socket = this.socket;

    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }

    this.socket = null;
    this.isSetupComplete = false;
    this.openSocket('reconnecting');
  }

  private isFatalSetupClose(event: CloseEvent): boolean {
    if (this.isSetupComplete) {
      return false;
    }

    const reason = event.reason.toLowerCase();

    return (
      event.code === 1007 ||
      event.code === 1008 ||
      reason.includes('invalid json payload') ||
      reason.includes('invalid argument') ||
      reason.includes('api key') ||
      reason.includes('permission') ||
      reason.includes('not found')
    );
  }

  private sendAudioChunk(base64Audio: string): void {
    this.socket?.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio
          }
        }
      })
    );
  }

  private isReady(): boolean {
    return this.socket?.readyState === WebSocket.OPEN && this.isSetupComplete;
  }
}

export const geminiLiveService = new GeminiLiveService();

function formatCloseReason(event: CloseEvent): string {
  return event.reason || `conexão encerrada com código ${event.code}`;
}

function looksLikeProcessLog(text: string): boolean {
  const normalized = text.toLowerCase();

  return (
    normalized.includes('initiating') ||
    normalized.includes('commencing') ||
    normalized.includes('transcribing') ||
    normalized.includes('transcription') ||
    normalized.includes('translation') ||
    normalized.includes('analysis') ||
    normalized.includes('i will') ||
    normalized.includes("i'll")
  );
}

function appendTranslatedResponse(text: string): void {
  const parsed = parseBilingualResponse(text);

  if (!parsed.hasFormat) {
    appendTranslation(text);
    return;
  }

  if (!parsed.portuguese) {
    return;
  }

  const currentTurn = getCurrentTurn();

  if (currentTurn) {
    setTurnTranslation(currentTurn.id, parsed.portuguese);
    return;
  }

  appendTranslation(parsed.portuguese);
}

function parseBilingualResponse(text: string): { hasFormat: boolean; portuguese: string } {
  const portugueseMatch = text.match(/(?:^|\n)\s*Portugu[eê]s:\s*([\s\S]*)$/i);

  if (portugueseMatch) {
    return { hasFormat: true, portuguese: (portugueseMatch[1] ?? '').trim() };
  }

  return { hasFormat: /(?:^|\n)\s*Ingl[eê]s:/i.test(text), portuguese: '' };
}

function isModelSetupFailure(reason: string): boolean {
  const normalized = reason.toLowerCase();

  return (
    normalized.includes('not found') ||
    normalized.includes('not supported') ||
    normalized.includes('cannot extract voices') ||
    normalized.includes('non-audio request') ||
    normalized.includes('model')
  );
}

async function decodeWebSocketPayload(rawMessage: unknown): Promise<string> {
  if (typeof rawMessage === 'string') {
    return rawMessage;
  }

  if (rawMessage instanceof ArrayBuffer) {
    return new TextDecoder().decode(rawMessage);
  }

  if (rawMessage instanceof Blob) {
    return rawMessage.text();
  }

  if (ArrayBuffer.isView(rawMessage)) {
    return new TextDecoder().decode(rawMessage);
  }

  return '';
}

function floatSamplesToPcm16Base64(samples: number[]): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(index * 2, Math.round(pcm), true);
  });

  let binary = '';
  const batchSize = 0x8000;

  for (let index = 0; index < bytes.length; index += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + batchSize));
  }

  return btoa(binary);
}

function calculateAmplitude(samples: number[]): number {
  if (samples.length === 0) {
    return 0;
  }

  const sum = samples.reduce((total, sample) => total + Math.min(1, Math.abs(sample)) ** 2, 0);
  return Math.sqrt(sum / samples.length);
}
