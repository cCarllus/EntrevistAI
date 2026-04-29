import { derived, get, writable } from 'svelte/store';

export type GeminiLiveStatus = 'stopped' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface TranscriptionTurn {
  id: string;
  english: string;
  portuguese: string;
  isFinal: boolean;
  startedAt: string;
  updatedAt: string;
}

export interface TranscriptionState {
  status: GeminiLiveStatus;
  statusMessage: string;
  turns: TranscriptionTurn[];
  currentTurn: TranscriptionTurn | null;
  error: string | null;
}

const maxHistoryTurns = 5;

const initialState: TranscriptionState = {
  status: 'stopped',
  statusMessage: 'Gemini Live parado',
  turns: [],
  currentTurn: null,
  error: null
};

export const transcriptionStore = writable<TranscriptionState>(initialState);

export const visibleTranscriptionTurns = derived(transcriptionStore, ($state) => {
  const turns = [...$state.turns];

  if ($state.currentTurn) {
    turns.push($state.currentTurn);
  }

  return turns.slice(-maxHistoryTurns);
});

export function resetTranscription(): void {
  transcriptionStore.set(initialState);
}

export function setTranscriptionStatus(
  status: GeminiLiveStatus,
  statusMessage: string,
  error: string | null = null
): void {
  transcriptionStore.update((state) => ({
    ...state,
    status,
    statusMessage,
    error
  }));
}

export function appendInputTranscription(text: string): void {
  appendToCurrentTurn('english', text);
}

export function appendTranslation(text: string): void {
  appendToCurrentTurn('portuguese', text);
}

export function setTurnTranslation(turnId: string, portuguese: string): void {
  const nextPortuguese = portuguese.trim();

  if (!nextPortuguese) {
    return;
  }

  transcriptionStore.update((state) => ({
    ...state,
    currentTurn:
      state.currentTurn?.id === turnId
        ? { ...state.currentTurn, portuguese: nextPortuguese, updatedAt: new Date().toISOString() }
        : state.currentTurn,
    turns: state.turns.map((turn) =>
      turn.id === turnId
        ? { ...turn, portuguese: nextPortuguese, updatedAt: new Date().toISOString() }
        : turn
    )
  }));
}

export function completeCurrentTurn(): void {
  transcriptionStore.update((state) => {
    if (!state.currentTurn) {
      return state;
    }

    const hasContent =
      state.currentTurn.english.trim().length > 0 || state.currentTurn.portuguese.trim().length > 0;

    if (!hasContent) {
      return { ...state, currentTurn: null };
    }

    const completedTurn = {
      ...state.currentTurn,
      isFinal: true,
      updatedAt: new Date().toISOString()
    };

    return {
      ...state,
      turns: [...state.turns, completedTurn].slice(-maxHistoryTurns),
      currentTurn: null
    };
  });
}

export function getCurrentTurn(): TranscriptionTurn | null {
  return get(transcriptionStore).currentTurn;
}

function appendToCurrentTurn(field: 'english' | 'portuguese', text: string): void {
  const nextText = field === 'english' ? text : text.trim();

  if (!nextText.trim()) {
    return;
  }

  transcriptionStore.update((state) => {
    const currentTurn = state.currentTurn ?? createTurn();
    const updatedTurn = {
      ...currentTurn,
      [field]:
        field === 'english'
          ? joinInputTranscriptionText(currentTurn[field], nextText)
          : joinTranslationText(currentTurn[field], nextText),
      updatedAt: new Date().toISOString()
    };

    return {
      ...state,
      currentTurn: updatedTurn
    };
  });
}

function createTurn(): TranscriptionTurn {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    english: '',
    portuguese: '',
    isFinal: false,
    startedAt: now,
    updatedAt: now
  };
}

function joinInputTranscriptionText(current: string, delta: string): string {
  if (!current) {
    return delta.trimStart();
  }

  if (/^[A-Za-z0-9]/.test(delta) && /[.!?]$/.test(current)) {
    return `${current} ${delta}`;
  }

  return `${current}${delta}`;
}

function joinTranslationText(current: string, delta: string): string {
  if (!current) {
    return delta;
  }

  if (/^[,.;:!?)]/.test(delta) || current.endsWith(' ') || delta.startsWith(' ')) {
    return `${current}${delta}`;
  }

  return `${current} ${delta}`;
}
