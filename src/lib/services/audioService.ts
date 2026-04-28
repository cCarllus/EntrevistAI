import { invoke } from '@tauri-apps/api/core';

export type AudioStatusKind = 'Listening' | 'Stopped' | 'Error';

export interface AudioCaptureStatus {
  status: AudioStatusKind;
  message: string;
  lastAmplitude: number;
  sampleRate: number;
  channels: number;
  chunkSamples: number;
}

const stoppedStatus: AudioCaptureStatus = {
  status: 'Stopped',
  message: 'Stopped',
  lastAmplitude: 0,
  sampleRate: 16000,
  channels: 1,
  chunkSamples: 8000
};

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

export async function startAudioCapture(): Promise<string> {
  if (!isTauri()) {
    throw new Error('Captura de áudio do sistema está disponível no app desktop Tauri.');
  }

  return invoke<string>('start_audio_capture');
}

export async function stopAudioCapture(): Promise<string> {
  if (!isTauri()) {
    return 'Captura de áudio parada.';
  }

  return invoke<string>('stop_audio_capture');
}

export async function getAudioChunk(): Promise<number[]> {
  if (!isTauri()) {
    return [];
  }

  return invoke<number[]>('get_audio_chunk');
}

export async function getAudioCaptureStatus(): Promise<AudioCaptureStatus> {
  if (!isTauri()) {
    return stoppedStatus;
  }

  return invoke<AudioCaptureStatus>('get_audio_capture_status');
}

export function startAudioChunkPolling(
  onChunk: (chunk: number[], amplitude: number) => void,
  onError: (error: Error) => void
): () => void {
  let isPolling = false;

  const timer = window.setInterval(async () => {
    if (isPolling) {
      return;
    }

    isPolling = true;

    try {
      const chunk = await getAudioChunk();
      const amplitude = calculateAmplitude(chunk);

      if (chunk.length > 0) {
        console.log('EntrevistAI audio amplitude', amplitude.toFixed(5), 'samples', chunk.length);
      }

      onChunk(chunk, amplitude);
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Erro ao ler chunk de áudio.'));
    } finally {
      isPolling = false;
    }
  }, 500);

  return () => window.clearInterval(timer);
}

function calculateAmplitude(chunk: number[]): number {
  if (chunk.length === 0) {
    return 0;
  }

  const sum = chunk.reduce((total, sample) => total + Math.min(1, Math.abs(sample)) ** 2, 0);
  return Math.sqrt(sum / chunk.length);
}
