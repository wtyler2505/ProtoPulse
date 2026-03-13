/**
 * VirtualMultimeterPanel — compact UI panel for the virtual multimeter instrument (BL-0625).
 *
 * LCD-style digital display with mode selector, probe connection controls,
 * and auto-range indicator. Subscribes to the VirtualMultimeter singleton
 * via useSyncExternalStore.
 */

import { useSyncExternalStore, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Unplug } from 'lucide-react';
import type { MultimeterMode, MultimeterState } from '@/lib/simulation/virtual-multimeter';
import { getVirtualMultimeter } from '@/lib/simulation/virtual-multimeter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VirtualMultimeterPanelProps {
  /** Available net IDs for probe connection dropdowns. */
  availableNets: string[];
  /** Optional className for the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<MultimeterMode, string> = {
  DC_VOLTAGE: 'V DC',
  AC_VOLTAGE: 'V AC',
  DC_CURRENT: 'A DC',
  AC_CURRENT: 'A AC',
  RESISTANCE: '\u03A9',
};

const MODE_TEST_IDS: Record<MultimeterMode, string> = {
  DC_VOLTAGE: 'multimeter-mode-dc-voltage',
  AC_VOLTAGE: 'multimeter-mode-ac-voltage',
  DC_CURRENT: 'multimeter-mode-dc-current',
  AC_CURRENT: 'multimeter-mode-ac-current',
  RESISTANCE: 'multimeter-mode-resistance',
};

const ALL_MODES: MultimeterMode[] = [
  'DC_VOLTAGE',
  'AC_VOLTAGE',
  'DC_CURRENT',
  'AC_CURRENT',
  'RESISTANCE',
];

// ---------------------------------------------------------------------------
// Hook: subscribe to VirtualMultimeter singleton
// ---------------------------------------------------------------------------

function useMultimeterState(): Readonly<MultimeterState> {
  const meter = getVirtualMultimeter();

  const subscribe = useCallback(
    (cb: () => void) => meter.subscribe(cb),
    [meter],
  );

  const getSnapshot = useCallback(() => meter.getState(), [meter]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** LCD-style digital readout. */
function MultimeterDisplay({
  displayValue,
  displayUnit,
  overloaded,
  valid,
}: {
  displayValue: number;
  displayUnit: string;
  overloaded: boolean;
  valid: boolean;
}) {
  let text: string;
  if (!valid) {
    text = '---';
  } else if (overloaded) {
    text = 'OL';
  } else {
    // Format to 4 significant digits max, trimming trailing zeros
    text = displayValue.toPrecision(4).replace(/\.?0+$/, '');
  }

  return (
    <div
      data-testid="multimeter-display"
      className={cn(
        'flex items-baseline justify-end gap-2 rounded-md border border-[#00F0FF]/30 bg-gray-950 px-4 py-3',
        'font-mono tabular-nums',
      )}
    >
      <span
        data-testid="multimeter-display-value"
        className={cn(
          'text-3xl font-bold tracking-wider',
          overloaded ? 'text-red-400' : 'text-[#00F0FF]',
          !valid && 'text-[#00F0FF]/40',
        )}
      >
        {text}
      </span>
      {valid && !overloaded && (
        <span
          data-testid="multimeter-display-unit"
          className="text-sm text-[#00F0FF]/70"
        >
          {displayUnit}
        </span>
      )}
    </div>
  );
}

/** Mode selector — segmented button group. */
function ModeSelector({
  currentMode,
  onModeChange,
}: {
  currentMode: MultimeterMode;
  onModeChange: (mode: MultimeterMode) => void;
}) {
  return (
    <div
      data-testid="multimeter-mode-selector"
      className="flex flex-wrap gap-1"
      role="group"
      aria-label="Measurement mode"
    >
      {ALL_MODES.map((mode) => (
        <Button
          key={mode}
          data-testid={MODE_TEST_IDS[mode]}
          variant={currentMode === mode ? 'default' : 'secondary'}
          size="sm"
          className={cn(
            'min-w-[3rem] px-2 text-xs',
            currentMode === mode && 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/40',
          )}
          onClick={() => { onModeChange(mode); }}
          aria-pressed={currentMode === mode}
        >
          {MODE_LABELS[mode]}
        </Button>
      ))}
    </div>
  );
}

/** Single probe connection row. */
function ProbeRow({
  label,
  color,
  connectedNodeId,
  availableNets,
  onConnect,
  onDisconnect,
  testIdPrefix,
}: {
  label: string;
  color: 'red' | 'black';
  connectedNodeId: string | null;
  availableNets: string[];
  onConnect: (netId: string) => void;
  onDisconnect: () => void;
  testIdPrefix: string;
}) {
  const dotColor = color === 'red' ? 'bg-red-500' : 'bg-gray-400';

  return (
    <div
      data-testid={`${testIdPrefix}-row`}
      className="flex items-center gap-2"
    >
      <div
        className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotColor)}
        aria-hidden="true"
      />
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <Select
        value={connectedNodeId ?? ''}
        onValueChange={(v) => {
          if (v) {
            onConnect(v);
          }
        }}
      >
        <SelectTrigger
          data-testid={`${testIdPrefix}-select`}
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
      {connectedNodeId && (
        <Button
          data-testid={`${testIdPrefix}-disconnect`}
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onDisconnect}
          aria-label={`Disconnect ${label.toLowerCase()} probe`}
        >
          <Unplug className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VirtualMultimeterPanel({
  availableNets,
  className,
}: VirtualMultimeterPanelProps) {
  const state = useMultimeterState();
  const meter = getVirtualMultimeter();

  const { mode, positiveProbe, negativeProbe, reading, autoRange } = state;

  return (
    <div
      data-testid="multimeter-panel"
      className={cn('flex flex-col gap-3 rounded-lg border bg-card p-3', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Multimeter</span>
        {autoRange && (
          <Badge
            data-testid="multimeter-auto-range"
            variant="outline"
            className="text-[10px] px-1.5 py-0 text-[#00F0FF] border-[#00F0FF]/30"
          >
            AUTO
          </Badge>
        )}
      </div>

      {/* LCD Display */}
      <MultimeterDisplay
        displayValue={reading.displayValue}
        displayUnit={reading.displayUnit}
        overloaded={reading.overloaded}
        valid={reading.valid}
      />

      {/* Mode Selector */}
      <ModeSelector
        currentMode={mode}
        onModeChange={(m) => { meter.setMode(m); }}
      />

      {/* Probe Connections */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Probes</span>
        <ProbeRow
          label="V+"
          color="red"
          connectedNodeId={positiveProbe?.nodeId ?? null}
          availableNets={availableNets}
          onConnect={(netId) => { meter.connectPositiveProbe(netId); }}
          onDisconnect={() => { meter.disconnectPositiveProbe(); }}
          testIdPrefix="multimeter-probe-positive"
        />
        <ProbeRow
          label="COM"
          color="black"
          connectedNodeId={negativeProbe?.nodeId ?? null}
          availableNets={availableNets}
          onConnect={(netId) => { meter.connectNegativeProbe(netId); }}
          onDisconnect={() => { meter.disconnectNegativeProbe(); }}
          testIdPrefix="multimeter-probe-negative"
        />
      </div>

      {/* Disconnect All */}
      {(positiveProbe || negativeProbe) && (
        <Button
          data-testid="multimeter-disconnect-all"
          variant="secondary"
          size="sm"
          className="w-full text-xs"
          onClick={() => { meter.disconnectAllProbes(); }}
        >
          <Unplug className="mr-1.5 h-3.5 w-3.5" />
          Disconnect Probes
        </Button>
      )}
    </div>
  );
}
