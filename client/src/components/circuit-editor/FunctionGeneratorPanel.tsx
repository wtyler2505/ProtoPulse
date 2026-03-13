/**
 * FunctionGeneratorPanel — UI panel for the virtual function generator (BL-0626).
 *
 * Waveform selector, frequency/amplitude/offset controls, duty cycle slider,
 * SVG waveform preview, and net connection management. Subscribes to the
 * FunctionGenerator singleton via useSyncExternalStore.
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Unplug, Power, PowerOff } from 'lucide-react';
import type { WaveformType, FunctionGeneratorState } from '@/lib/simulation/function-generator';
import { getFunctionGenerator, formatFrequency, formatAmplitude } from '@/lib/simulation/function-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FunctionGeneratorPanelProps {
  /** Available net IDs for the connection dropdown. */
  availableNets: string[];
  /** Optional className for the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WAVEFORM_LABELS: Record<WaveformType, string> = {
  SINE: 'Sine',
  SQUARE: 'Square',
  TRIANGLE: 'Triangle',
  SAWTOOTH: 'Sawtooth',
};

const ALL_WAVEFORMS: WaveformType[] = ['SINE', 'SQUARE', 'TRIANGLE', 'SAWTOOTH'];

/** Frequency unit multipliers for the SI prefix selector. */
const FREQ_UNITS = [
  { label: 'Hz', multiplier: 1 },
  { label: 'kHz', multiplier: 1e3 },
  { label: 'MHz', multiplier: 1e6 },
] as const;

// ---------------------------------------------------------------------------
// Hook: subscribe to FunctionGenerator singleton
// ---------------------------------------------------------------------------

function useFunctionGeneratorState(): Readonly<FunctionGeneratorState> {
  const gen = getFunctionGenerator();

  const subscribe = useCallback(
    (cb: () => void) => gen.subscribe(cb),
    [gen],
  );

  const getSnapshot = useCallback(() => gen.getState(), [gen]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

// ---------------------------------------------------------------------------
// SVG Waveform Preview
// ---------------------------------------------------------------------------

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 48;
const PREVIEW_PADDING = 4;
const PREVIEW_SAMPLES = 200;

function WaveformPreview({
  waveform,
  dutyCycle,
}: {
  waveform: WaveformType;
  dutyCycle: number;
}) {
  const points = useMemo(() => {
    const gen = getFunctionGenerator();
    const state = gen.getState();
    const freq = state.frequency > 0 ? state.frequency : 1;
    const period = 1 / freq;
    const innerW = PREVIEW_WIDTH - PREVIEW_PADDING * 2;
    const innerH = PREVIEW_HEIGHT - PREVIEW_PADDING * 2;

    const pts: string[] = [];
    for (let i = 0; i <= PREVIEW_SAMPLES; i++) {
      const t = (i / PREVIEW_SAMPLES) * period;
      const phase = ((t % period) + period) % period / period;

      let value: number;
      switch (waveform) {
        case 'SINE':
          value = Math.sin(2 * Math.PI * phase);
          break;
        case 'SQUARE':
          value = phase < dutyCycle ? 1 : -1;
          break;
        case 'TRIANGLE':
          value = phase < 0.5 ? -1 + 4 * phase : 3 - 4 * phase;
          break;
        case 'SAWTOOTH':
          value = 2 * phase - 1;
          break;
      }

      const x = PREVIEW_PADDING + (i / PREVIEW_SAMPLES) * innerW;
      // Invert y because SVG y increases downward
      const y = PREVIEW_PADDING + ((1 - value) / 2) * innerH;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return pts.join(' ');
  }, [waveform, dutyCycle]);

  return (
    <svg
      data-testid="funcgen-waveform-preview"
      width={PREVIEW_WIDTH}
      height={PREVIEW_HEIGHT}
      viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
      className="w-full rounded border border-[#00F0FF]/20 bg-gray-950"
      aria-label={`${WAVEFORM_LABELS[waveform]} waveform preview`}
    >
      {/* Zero line */}
      <line
        x1={PREVIEW_PADDING}
        y1={PREVIEW_HEIGHT / 2}
        x2={PREVIEW_WIDTH - PREVIEW_PADDING}
        y2={PREVIEW_HEIGHT / 2}
        stroke="rgba(0, 240, 255, 0.15)"
        strokeWidth={0.5}
        strokeDasharray="2,2"
      />
      {/* Waveform */}
      <polyline
        points={points}
        fill="none"
        stroke="#00F0FF"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Frequency input with unit selector
// ---------------------------------------------------------------------------

function FrequencyControl({
  frequency,
}: {
  frequency: number;
}) {
  const gen = getFunctionGenerator();

  // Determine best display unit
  const formatted = formatFrequency(frequency);
  const currentUnit = FREQ_UNITS.find((u) => u.label === formatted.unit) ?? FREQ_UNITS[0];
  const displayValue = frequency / currentUnit.multiplier;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="funcgen-frequency" className="text-xs text-muted-foreground">
        Frequency
      </Label>
      <div className="flex gap-1">
        <Input
          id="funcgen-frequency"
          data-testid="funcgen-frequency-input"
          type="number"
          min={0}
          step="any"
          value={displayValue}
          className="h-7 flex-1 text-xs tabular-nums"
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
              gen.setFrequency(val * currentUnit.multiplier);
            }
          }}
        />
        <Select
          value={currentUnit.label}
          onValueChange={(label) => {
            const unit = FREQ_UNITS.find((u) => u.label === label);
            if (unit) {
              gen.setFrequency(displayValue * unit.multiplier);
            }
          }}
        >
          <SelectTrigger
            data-testid="funcgen-frequency-unit"
            className="h-7 w-[4.5rem] text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQ_UNITS.map((u) => (
              <SelectItem key={u.label} value={u.label} className="text-xs">
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FunctionGeneratorPanel({
  availableNets,
  className,
}: FunctionGeneratorPanelProps) {
  const state = useFunctionGeneratorState();
  const gen = getFunctionGenerator();

  const { waveform, frequency, amplitude, dcOffset, dutyCycle, connectedNet, enabled } = state;

  const formattedAmplitude = formatAmplitude(amplitude);

  return (
    <div
      data-testid="funcgen-panel"
      className={cn('flex flex-col gap-3 rounded-lg border bg-card p-3', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Function Generator</span>
        <Button
          data-testid="funcgen-enable-toggle"
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7',
            enabled ? 'text-[#00F0FF]' : 'text-muted-foreground',
          )}
          onClick={() => { gen.setEnabled(!enabled); }}
          aria-label={enabled ? 'Disable generator' : 'Enable generator'}
          aria-pressed={enabled}
        >
          {enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
        </Button>
      </div>

      {/* Waveform preview */}
      <WaveformPreview waveform={waveform} dutyCycle={dutyCycle} />

      {/* Waveform selector */}
      <div
        data-testid="funcgen-waveform-selector"
        className="flex flex-wrap gap-1"
        role="group"
        aria-label="Waveform type"
      >
        {ALL_WAVEFORMS.map((w) => (
          <Button
            key={w}
            data-testid={`funcgen-waveform-${w.toLowerCase()}`}
            variant={waveform === w ? 'default' : 'secondary'}
            size="sm"
            className={cn(
              'min-w-[3.5rem] flex-1 px-2 text-xs',
              waveform === w && 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/40',
            )}
            onClick={() => { gen.setWaveform(w); }}
            aria-pressed={waveform === w}
          >
            {WAVEFORM_LABELS[w]}
          </Button>
        ))}
      </div>

      {/* Frequency */}
      <FrequencyControl frequency={frequency} />

      {/* Amplitude */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="funcgen-amplitude" className="text-xs text-muted-foreground">
          Amplitude ({formattedAmplitude.unit})
        </Label>
        <Input
          id="funcgen-amplitude"
          data-testid="funcgen-amplitude-input"
          type="number"
          min={0}
          step="any"
          value={amplitude}
          className="h-7 text-xs tabular-nums"
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
              gen.setAmplitude(val);
            }
          }}
        />
      </div>

      {/* DC Offset */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="funcgen-dc-offset" className="text-xs text-muted-foreground">
          DC Offset (V)
        </Label>
        <Input
          id="funcgen-dc-offset"
          data-testid="funcgen-dc-offset-input"
          type="number"
          step="any"
          value={dcOffset}
          className="h-7 text-xs tabular-nums"
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
              gen.setDcOffset(val);
            }
          }}
        />
      </div>

      {/* Duty Cycle — only visible for SQUARE */}
      {waveform === 'SQUARE' && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Duty Cycle
            </Label>
            <span
              data-testid="funcgen-duty-cycle-value"
              className="text-xs tabular-nums text-muted-foreground"
            >
              {Math.round(dutyCycle * 100)}%
            </span>
          </div>
          <Slider
            data-testid="funcgen-duty-cycle-slider"
            min={0}
            max={100}
            step={1}
            value={[Math.round(dutyCycle * 100)]}
            onValueChange={([v]) => {
              if (v !== undefined) {
                gen.setDutyCycle(v / 100);
              }
            }}
            aria-label="Duty cycle"
          />
        </div>
      )}

      {/* Net Connection */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Output Net</Label>
        <div className="flex items-center gap-1">
          <Select
            value={connectedNet ?? ''}
            onValueChange={(v) => {
              if (v) {
                gen.connect(v);
              }
            }}
          >
            <SelectTrigger
              data-testid="funcgen-net-select"
              className="h-7 flex-1 text-xs"
            >
              <SelectValue placeholder="Select net..." />
            </SelectTrigger>
            <SelectContent>
              {availableNets.map((net) => (
                <SelectItem key={net} value={net} className="text-xs">
                  {net}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {connectedNet && (
            <Button
              data-testid="funcgen-disconnect"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => { gen.disconnect(); }}
              aria-label="Disconnect from net"
            >
              <Unplug className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
