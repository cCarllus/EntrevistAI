export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface InterviewContext {
  cvText: string;
  cvFileName: string | null;
  jobText: string;
  jobFileName: string | null;
  chatMessages: ChatMessage[];
  updatedAt: string;
}

export interface AppSettings {
  geminiApiKey: string;
  opacityPercent: number;
  alwaysOnTop: boolean;
  hasSeenInterviewIntro: boolean;
}

export const emptyContext = (): InterviewContext => ({
  cvText: '',
  cvFileName: null,
  jobText: '',
  jobFileName: null,
  chatMessages: [],
  updatedAt: new Date().toISOString()
});

export const emptySettings = (): AppSettings => ({
  geminiApiKey: '',
  opacityPercent: 90,
  alwaysOnTop: true,
  hasSeenInterviewIntro: false
});
