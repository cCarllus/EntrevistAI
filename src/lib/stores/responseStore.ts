import { get, writable } from 'svelte/store';
import { generateInterviewResponse } from '../services/responseService';
import type { InterviewContext } from '../types';

export type ResponseStatus = 'idle' | 'thinking' | 'ready' | 'skipped' | 'error';

export interface SuggestedResponse {
  id: string;
  question: string;
  answer: string;
  latencyMs: number;
  createdAt: string;
}

export interface ResponseState {
  status: ResponseStatus;
  statusMessage: string;
  current: SuggestedResponse | null;
  history: SuggestedResponse[];
  error: string | null;
  lastQuestion: string;
  lastConversationHistory: string;
}

export interface GenerateAutomaticResponseInput {
  apiKey: string;
  context: InterviewContext;
  question: string;
  conversationHistory: string;
  forceNewSuggestion?: boolean;
}

const maxResponseHistory = 6;
let requestSequence = 0;

const initialState: ResponseState = {
  status: 'idle',
  statusMessage: 'Aguardando pausa da entrevistadora',
  current: null,
  history: [],
  error: null,
  lastQuestion: '',
  lastConversationHistory: ''
};

export const responseStore = writable<ResponseState>(initialState);

export function resetResponses(): void {
  requestSequence += 1;
  responseStore.set(initialState);
}

export async function generateAutomaticResponse(input: GenerateAutomaticResponseInput): Promise<void> {
  const question = normalizeWhitespace(input.question);

  if (!input.forceNewSuggestion && countWords(question) < 4) {
    responseStore.update((state) => ({
      ...state,
      status: 'skipped',
      statusMessage: 'Turno curto demais para gerar resposta automática',
      error: null,
      lastQuestion: question,
      lastConversationHistory: input.conversationHistory
    }));
    return;
  }

  const requestId = ++requestSequence;
  const startedAt = performance.now();
  const previousResponses = input.forceNewSuggestion
    ? get(responseStore).history
        .filter((item) => item.question === question)
        .map((item) => item.answer)
    : [];

  responseStore.update((state) => ({
    ...state,
    status: 'thinking',
    statusMessage: 'Pensando...',
    error: null,
    lastQuestion: question,
    lastConversationHistory: input.conversationHistory
  }));

  try {
    const answer = await generateInterviewResponse({
      apiKey: input.apiKey,
      context: input.context,
      history: input.conversationHistory,
      question,
      previousResponses
    });

    if (requestId !== requestSequence) {
      return;
    }

    const nextResponse: SuggestedResponse = {
      id: crypto.randomUUID(),
      question,
      answer,
      latencyMs: Math.round(performance.now() - startedAt),
      createdAt: new Date().toISOString()
    };

    responseStore.update((state) => ({
      ...state,
      status: 'ready',
      statusMessage: `Resposta pronta em ${(nextResponse.latencyMs / 1000).toFixed(1)}s`,
      current: nextResponse,
      history: [nextResponse, ...state.history].slice(0, maxResponseHistory),
      error: null
    }));
  } catch (error) {
    if (requestId !== requestSequence) {
      return;
    }

    responseStore.update((state) => ({
      ...state,
      status: 'error',
      statusMessage: 'Não foi possível gerar a resposta automática',
      error: error instanceof Error ? error.message : 'Gemini precisa de conexão para responder.'
    }));
  }
}

export async function generateNewSuggestion(apiKey: string, context: InterviewContext): Promise<void> {
  const state = get(responseStore);
  const question = state.current?.question || state.lastQuestion;

  if (!question) {
    return;
  }

  await generateAutomaticResponse({
    apiKey,
    context,
    question,
    conversationHistory: state.lastConversationHistory,
    forceNewSuggestion: true
  });
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
