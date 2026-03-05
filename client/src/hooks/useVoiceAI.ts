/**
 * React hook for the VoiceAI system.
 * Wraps the VoiceAIManager singleton and provides reactive state.
 */

import { useCallback, useEffect, useState } from 'react';

import { VoiceAIManager } from '@/lib/voice-ai';

import type { VoiceAISnapshot, VoiceMode } from '@/lib/voice-ai';

export interface UseVoiceAIReturn {
  /** Current state machine state */
  state: VoiceAISnapshot['state'];
  /** Current interaction mode */
  mode: VoiceMode;
  /** Whether actively listening for audio */
  isListening: boolean;
  /** Transcript text from speech-to-text */
  transcript: string;
  /** Start recording audio */
  startListening: () => Promise<void>;
  /** Stop recording audio */
  stopListening: () => void;
  /** Switch between push-to-talk and hands-free */
  setMode: (mode: VoiceMode) => void;
  /** Current error message, if any */
  error: string | null;
  /** Audio level 0-1 for visualization */
  audioLevel: number;
  /** Full cleanup (release mic, reset state) */
  cleanup: () => void;
}

export function useVoiceAI(): UseVoiceAIReturn {
  const [snapshot, setSnapshot] = useState<VoiceAISnapshot>(() =>
    VoiceAIManager.getInstance().getSnapshot(),
  );

  useEffect(() => {
    const manager = VoiceAIManager.getInstance();
    // Sync initial state
    setSnapshot(manager.getSnapshot());

    const unsubscribe = manager.subscribe(() => {
      setSnapshot(manager.getSnapshot());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const startListening = useCallback(async () => {
    await VoiceAIManager.getInstance().startListening();
  }, []);

  const stopListening = useCallback(() => {
    VoiceAIManager.getInstance().stopListening();
  }, []);

  const setMode = useCallback((mode: VoiceMode) => {
    VoiceAIManager.getInstance().setMode(mode);
  }, []);

  const cleanup = useCallback(() => {
    VoiceAIManager.getInstance().cleanup();
  }, []);

  return {
    state: snapshot.state,
    mode: snapshot.mode,
    isListening: snapshot.state === 'listening',
    transcript: snapshot.transcript,
    startListening,
    stopListening,
    setMode,
    error: snapshot.error,
    audioLevel: snapshot.audioLevel,
    cleanup,
  };
}
