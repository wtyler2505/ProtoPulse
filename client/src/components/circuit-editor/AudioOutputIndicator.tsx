/**
 * AudioOutputIndicator — compact UI widget for buzzer/speaker audio output (BL-0623).
 *
 * Shows speaker icon with sound wave animation, mute toggle, frequency display,
 * and volume slider. Subscribes to the SimulationAudioOutput singleton via
 * useSyncExternalStore.
 */

import { useSyncExternalStore, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Volume2, VolumeX } from 'lucide-react';
import type { AudioOutputState } from '@/lib/simulation/audio-output';
import { getSimulationAudioOutput } from '@/lib/simulation/audio-output';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AudioOutputIndicatorProps {
  /** Optional className for the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Hook: subscribe to SimulationAudioOutput singleton
// ---------------------------------------------------------------------------

function useAudioOutputState(): Readonly<AudioOutputState> {
  const audio = getSimulationAudioOutput();

  const subscribe = useCallback(
    (cb: () => void) => audio.subscribe(cb),
    [audio],
  );

  const getSnapshot = useCallback(() => audio.getState(), [audio]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

// ---------------------------------------------------------------------------
// Frequency formatter
// ---------------------------------------------------------------------------

function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    const khz = hz / 1000;
    return `${khz % 1 === 0 ? String(khz) : khz.toFixed(1)} kHz`;
  }
  return `${hz % 1 === 0 ? String(hz) : hz.toFixed(1)} Hz`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AudioOutputIndicator({ className }: AudioOutputIndicatorProps) {
  const state = useAudioOutputState();
  const audio = getSimulationAudioOutput();

  const handleMuteToggle = useCallback(() => {
    audio.toggleMute();
  }, [audio]);

  const handleVolumeChange = useCallback(
    (values: number[]) => {
      const value = values[0];
      if (value !== undefined) {
        audio.setVolume(value);
      }
    },
    [audio],
  );

  if (!state.available) {
    return null;
  }

  const isSounding = state.playing && !state.muted;

  return (
    <div
      data-testid="audio-output-indicator"
      className={cn(
        'flex items-center gap-2 rounded-md border border-border/40 bg-gray-900/60 px-3 py-1.5',
        className,
      )}
    >
      {/* Mute toggle button with speaker icon */}
      <Button
        data-testid="audio-mute-toggle"
        variant="ghost"
        size="sm"
        className={cn(
          'relative h-7 w-7 p-0',
          isSounding && 'text-[#00F0FF]',
          state.muted && 'text-muted-foreground',
        )}
        onClick={handleMuteToggle}
        aria-label={state.muted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={state.muted}
      >
        {state.muted ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}

        {/* Sound wave animation rings */}
        {isSounding && (
          <span
            data-testid="audio-wave-animation"
            className="absolute -right-0.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <span className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-[#00F0FF]/40" />
            <span
              className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-[#00F0FF]/30"
              style={{ animationDelay: '150ms' }}
            />
          </span>
        )}
      </Button>

      {/* Frequency display */}
      <span
        data-testid="audio-frequency-display"
        className={cn(
          'min-w-[4.5rem] text-right font-mono text-xs tabular-nums',
          isSounding ? 'text-[#00F0FF]' : 'text-muted-foreground',
        )}
      >
        {state.playing ? formatFrequency(state.frequency) : '--'}
      </span>

      {/* Volume slider */}
      <Slider
        data-testid="audio-volume-slider"
        min={0}
        max={1}
        step={0.05}
        value={[state.volume]}
        onValueChange={handleVolumeChange}
        className="w-16"
        aria-label="Audio volume"
      />
    </div>
  );
}
