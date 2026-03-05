/**
 * VoiceInput — Voice AI interaction control for the chat panel.
 *
 * Provides a mic button with pulse animation, audio level visualization,
 * mode toggle (push-to-talk / hands-free), transcript preview, and
 * accessibility-friendly state indicators.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, Radio, Hand } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { VoiceAIManager } from '@/lib/voice-ai';
import { useVoiceAI } from '@/hooks/useVoiceAI';

import type { VoiceAIState } from '@/lib/voice-ai';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VoiceInputProps {
  /** Called when transcript text is available */
  onTranscript: (text: string) => void;
  /** Disable the voice input control */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// State label helpers
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<VoiceAIState, string> = {
  idle: 'Click to speak',
  requesting_permission: 'Requesting mic access...',
  ready: 'Click to speak',
  listening: 'Listening...',
  processing: 'Processing...',
  error: 'Voice input error',
};

function getStateLabel(state: VoiceAIState, error: string | null): string {
  if (state === 'error' && error) {
    return error;
  }
  return STATE_LABELS[state];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const {
    state,
    mode,
    isListening,
    transcript,
    startListening,
    stopListening,
    setMode,
    error,
    audioLevel,
  } = useVoiceAI();

  // Wire onTranscript callback to manager
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const manager = VoiceAIManager.getInstance();
    manager.onTranscript = (text: string) => {
      onTranscriptRef.current(text);
    };
    return () => {
      manager.onTranscript = null;
    };
  }, []);

  const handleMicClick = useCallback(async () => {
    if (disabled) {
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [disabled, isListening, startListening, stopListening]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        void handleMicClick();
      }
    },
    [handleMicClick],
  );

  const handleModeToggle = useCallback(() => {
    setMode(mode === 'push_to_talk' ? 'hands_free' : 'push_to_talk');
  }, [mode, setMode]);

  const isError = state === 'error';
  const isProcessing = state === 'processing';
  const isRequestingPermission = state === 'requesting_permission';
  const stateLabel = getStateLabel(state, error);
  const MicIcon = isError ? MicOff : Mic;

  // Audio level rings (3 concentric)
  const ringScales = [
    1 + audioLevel * 0.3,
    1 + audioLevel * 0.6,
    1 + audioLevel * 0.9,
  ];

  return (
    <div
      className="flex flex-col items-center gap-2"
      data-testid="voice-input-container"
    >
      {/* Mic button with audio level rings */}
      <div className="relative flex items-center justify-center">
        {/* Audio level indicator rings */}
        {isListening && ringScales.map((scale, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border border-primary/20 pointer-events-none"
            style={{
              transform: `scale(${scale})`,
              opacity: Math.max(0.1, 0.4 - i * 0.1),
              transition: 'transform 100ms ease-out, opacity 100ms ease-out',
            }}
            data-testid={`audio-level-ring-${i}`}
          />
        ))}

        <StyledTooltip content={stateLabel} side="top">
          <Button
            variant={isListening ? 'default' : 'ghost'}
            size="icon"
            className={cn(
              'relative z-10 h-10 w-10 rounded-full transition-all',
              isListening && 'bg-red-500/90 hover:bg-red-500 text-white animate-pulse',
              isError && 'text-destructive',
              isProcessing && 'text-yellow-400',
              isRequestingPermission && 'text-muted-foreground animate-pulse',
              !isListening && !isError && !isProcessing && !isRequestingPermission &&
                'text-muted-foreground hover:text-foreground',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
            onClick={() => void handleMicClick()}
            onKeyDown={handleKeyDown}
            disabled={disabled || isProcessing || isRequestingPermission}
            data-testid="voice-mic-button"
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            aria-pressed={isListening}
          >
            <MicIcon className="h-5 w-5" />
          </Button>
        </StyledTooltip>
      </div>

      {/* State label */}
      <span
        className={cn(
          'text-[10px] text-center max-w-[200px] truncate',
          isListening ? 'text-red-400' : 'text-muted-foreground/70',
          isError && 'text-destructive',
        )}
        data-testid="voice-state-label"
      >
        {stateLabel}
      </span>

      {/* Transcript preview */}
      {transcript && (
        <div
          className="text-xs text-foreground/80 text-center max-w-[240px] line-clamp-2 px-2"
          data-testid="voice-transcript"
        >
          {transcript}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex items-center gap-1.5" data-testid="voice-mode-toggle">
        <StyledTooltip
          content={mode === 'push_to_talk' ? 'Switch to hands-free' : 'Switch to push-to-talk'}
          side="bottom"
        >
          <button
            type="button"
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full border transition-colors',
              mode === 'push_to_talk'
                ? 'border-primary/30 text-primary/70 bg-primary/5'
                : 'border-green-500/30 text-green-400/70 bg-green-500/5',
            )}
            onClick={handleModeToggle}
            disabled={disabled}
            data-testid="voice-mode-button"
            aria-label={`Voice mode: ${mode === 'push_to_talk' ? 'push to talk' : 'hands-free'}`}
          >
            {mode === 'push_to_talk' ? (
              <>
                <Hand className="w-3 h-3" />
                <span>Push to talk</span>
              </>
            ) : (
              <>
                <Radio className="w-3 h-3" />
                <span>Hands-free</span>
              </>
            )}
          </button>
        </StyledTooltip>
      </div>

      {/* Permission error help */}
      {isError && error?.includes('denied') && (
        <p
          className="text-[10px] text-muted-foreground/60 text-center max-w-[200px]"
          data-testid="voice-permission-help"
        >
          Check browser address bar for microphone permission settings.
        </p>
      )}
    </div>
  );
}
