/* eslint-disable jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
/**
 * VirtualOscilloscope — draggable virtual oscilloscope instrument that shows
 * live waveforms during simulation (BL-0624).
 *
 * Features:
 *   - SVG-based waveform display with graticule grid
 *   - Per-channel enable/disable and probe connection dropdowns
 *   - Adjustable time/div and voltage/div
 *   - Rising/falling edge trigger with level control
 *   - Auto-scale voltage
 *   - Cursor measurements
 */

import { memo, useCallback, useRef, useState, useSyncExternalStore, useEffect, type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import {
  OscilloscopeEngine,
  TIMEBASE_TO_SECONDS,
  TIMEBASE_VALUES,
  HORIZONTAL_DIVS,
  VERTICAL_DIVS,
  VOLTS_PER_DIV_VALUES,
} from '@/lib/simulation/oscilloscope-engine';
import { formatSIValue } from '@/lib/simulation/visual-state';
import type { TimebaseValue, TriggerEdge } from '@/lib/simulation/oscilloscope-engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPE_WIDTH = 500;
const SCOPE_HEIGHT = 320;
const PADDING = { top: 8, right: 8, bottom: 8, left: 8 };
const PLOT_WIDTH = SCOPE_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = SCOPE_HEIGHT - PADDING.top - PADDING.bottom;

// ---------------------------------------------------------------------------
// Hook: subscribe to engine state
// ---------------------------------------------------------------------------

function useOscilloscopeState(engine: OscilloscopeEngine) {
  const subscribe = useCallback(
    (cb: () => void) => engine.subscribe(cb),
    [engine],
  );
  const getSnapshot = useCallback(
    () => engine.getState(),
    [engine],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

// ---------------------------------------------------------------------------
// Graticule grid
// ---------------------------------------------------------------------------

const Graticule = memo(function Graticule() {
  const lines: ReactElement[] = [];

  // Vertical division lines
  for (let i = 0; i <= HORIZONTAL_DIVS; i++) {
    const x = PADDING.left + (i / HORIZONTAL_DIVS) * PLOT_WIDTH;
    lines.push(
      <line
        key={`v-${i}`}
        x1={x} y1={PADDING.top}
        x2={x} y2={PADDING.top + PLOT_HEIGHT}
        stroke="#333"
        strokeWidth={i === HORIZONTAL_DIVS / 2 ? 0.8 : 0.3}
        strokeDasharray={i === HORIZONTAL_DIVS / 2 ? undefined : '2,4'}
      />,
    );
  }

  // Horizontal division lines
  for (let j = 0; j <= VERTICAL_DIVS; j++) {
    const y = PADDING.top + (j / VERTICAL_DIVS) * PLOT_HEIGHT;
    lines.push(
      <line
        key={`h-${j}`}
        x1={PADDING.left} y1={y}
        x2={PADDING.left + PLOT_WIDTH} y2={y}
        stroke="#333"
        strokeWidth={j === VERTICAL_DIVS / 2 ? 0.8 : 0.3}
        strokeDasharray={j === VERTICAL_DIVS / 2 ? undefined : '2,4'}
      />,
    );
  }

  return <g data-testid="scope-graticule">{lines}</g>;
});

// ---------------------------------------------------------------------------
// Waveform trace
// ---------------------------------------------------------------------------

interface WaveformTraceProps {
  engine: OscilloscopeEngine;
  channelIndex: number;
  color: string;
  voltsPerDiv: number;
  offset: number;
}

const WaveformTrace = memo(function WaveformTrace({
  engine,
  channelIndex,
  color,
  voltsPerDiv,
  offset,
}: WaveformTraceProps) {
  const samples = engine.getDisplaySamples(channelIndex);
  if (samples.length < 2) { return null; }

  const timePerDiv = TIMEBASE_TO_SECONDS[engine.getState().timebase] ?? 0.001;
  const totalTime = timePerDiv * HORIZONTAL_DIVS;
  const totalVoltage = voltsPerDiv * VERTICAL_DIVS;
  const midY = PADDING.top + PLOT_HEIGHT / 2;

  const points = samples.map((s) => {
    const x = PADDING.left + (s.time / totalTime) * PLOT_WIDTH;
    const normalizedV = (s.voltage + offset) / totalVoltage;
    const y = midY - normalizedV * PLOT_HEIGHT;
    return `${x},${Math.max(PADDING.top, Math.min(PADDING.top + PLOT_HEIGHT, y))}`;
  });

  return (
    <polyline
      points={points.join(' ')}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      data-testid={`scope-trace-ch${channelIndex}`}
    />
  );
});

// ---------------------------------------------------------------------------
// Channel control row
// ---------------------------------------------------------------------------

interface ChannelControlProps {
  channelIndex: number;
  enabled: boolean;
  color: string;
  voltsPerDiv: number;
  probeNodeId: string | null;
  availableNodes: string[];
  engine: OscilloscopeEngine;
}

function ChannelControl({
  channelIndex,
  enabled,
  color,
  voltsPerDiv,
  probeNodeId,
  availableNodes,
  engine,
}: ChannelControlProps) {
  const handleToggle = useCallback(() => {
    engine.setChannelEnabled(channelIndex, !enabled);
  }, [engine, channelIndex, enabled]);

  const handleProbeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      engine.setProbeConnection(channelIndex, val === '' ? null : val);
    },
    [engine, channelIndex],
  );

  const handleVoltUp = useCallback(() => {
    const idx = VOLTS_PER_DIV_VALUES.indexOf(voltsPerDiv);
    if (idx < VOLTS_PER_DIV_VALUES.length - 1) {
      engine.setVoltsPerDiv(channelIndex, VOLTS_PER_DIV_VALUES[idx + 1] ?? voltsPerDiv);
    }
  }, [engine, channelIndex, voltsPerDiv]);

  const handleVoltDown = useCallback(() => {
    const idx = VOLTS_PER_DIV_VALUES.indexOf(voltsPerDiv);
    if (idx > 0) {
      engine.setVoltsPerDiv(channelIndex, VOLTS_PER_DIV_VALUES[idx - 1] ?? voltsPerDiv);
    }
  }, [engine, channelIndex, voltsPerDiv]);

  const handleAutoScale = useCallback(() => {
    engine.autoScaleVoltage(channelIndex);
  }, [engine, channelIndex]);

  return (
    <div className="flex items-center gap-1.5 text-[10px]" data-testid={`scope-channel-${channelIndex}`}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'w-5 h-5 rounded text-[9px] font-bold border cursor-pointer transition-colors',
          enabled ? 'border-current' : 'border-zinc-600 text-zinc-600',
        )}
        style={{ color: enabled ? color : undefined }}
        data-testid={`scope-ch${channelIndex}-toggle`}
      >
        {channelIndex + 1}
      </button>

      <select
        value={probeNodeId ?? ''}
        onChange={handleProbeChange}
        disabled={!enabled}
        className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[9px] w-20 disabled:opacity-40"
        data-testid={`scope-ch${channelIndex}-probe`}
      >
        <option value="">-- Probe --</option>
        {availableNodes.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={handleVoltDown}
          disabled={!enabled}
          className="w-4 h-4 bg-zinc-800 border border-zinc-700 rounded text-[8px] cursor-pointer disabled:opacity-40 hover:bg-zinc-700"
          data-testid={`scope-ch${channelIndex}-vdiv-down`}
        >
          -
        </button>
        <span className="w-12 text-center font-mono" style={{ color }} data-testid={`scope-ch${channelIndex}-vdiv-label`}>
          {formatSIValue(voltsPerDiv, 'V')}/d
        </span>
        <button
          type="button"
          onClick={handleVoltUp}
          disabled={!enabled}
          className="w-4 h-4 bg-zinc-800 border border-zinc-700 rounded text-[8px] cursor-pointer disabled:opacity-40 hover:bg-zinc-700"
          data-testid={`scope-ch${channelIndex}-vdiv-up`}
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={handleAutoScale}
        disabled={!enabled}
        className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[8px] cursor-pointer disabled:opacity-40 hover:bg-zinc-700"
        data-testid={`scope-ch${channelIndex}-auto`}
      >
        Auto
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface VirtualOscilloscopeProps {
  /** The oscilloscope engine instance to render. */
  engine: OscilloscopeEngine;
  /** Available net/node IDs for probe connections. */
  availableNodes?: string[];
  /** Initial position for dragging. */
  initialPosition?: { x: number; y: number };
  /** Called when the oscilloscope is closed. */
  onClose?: () => void;
}

const VirtualOscilloscope = memo(function VirtualOscilloscope({
  engine,
  availableNodes = [],
  initialPosition,
  onClose,
}: VirtualOscilloscopeProps) {
  const state = useOscilloscopeState(engine);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [position, setPosition] = useState(initialPosition ?? { x: 20, y: 20 });
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input')) { return; }
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) { return; }
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.posX + dx,
        y: dragRef.current.posY + dy,
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Timebase controls
  const handleTimebaseFaster = useCallback(() => { engine.timebaseFaster(); }, [engine]);
  const handleTimebaseSlower = useCallback(() => { engine.timebaseSlower(); }, [engine]);

  // Run/stop
  const handleRunStop = useCallback(() => {
    engine.setRunning(!state.running);
  }, [engine, state.running]);

  // Clear
  const handleClear = useCallback(() => { engine.clearBuffers(); }, [engine]);

  // Trigger edge toggle
  const handleTriggerEdge = useCallback(() => {
    const newEdge: TriggerEdge = state.trigger.edge === 'rising' ? 'falling' : 'rising';
    engine.setTrigger({ edge: newEdge });
  }, [engine, state.trigger.edge]);

  // Trigger enable toggle
  const handleTriggerToggle = useCallback(() => {
    engine.setTrigger({ enabled: !state.trigger.enabled });
  }, [engine, state.trigger.enabled]);

  const timePerDiv = TIMEBASE_TO_SECONDS[state.timebase] ?? 0.001;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl select-none"
      style={{ left: position.x, top: position.y, width: SCOPE_WIDTH + 16 }}
      onMouseDown={handleMouseDown}
      data-testid="virtual-oscilloscope"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 cursor-grab">
        <span className="text-[10px] font-bold text-[var(--color-editor-accent)] tracking-wide" data-testid="scope-title">
          OSCILLOSCOPE
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunStop}
            className={cn(
              'px-2 py-0.5 rounded text-[9px] font-bold border cursor-pointer transition-colors',
              state.running
                ? 'border-emerald-400 text-emerald-400 hover:bg-emerald-500/20'
                : 'border-red-400 text-red-400 hover:bg-red-500/20',
            )}
            data-testid="scope-run-stop"
          >
            {state.running ? 'RUN' : 'STOP'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-2 py-0.5 rounded text-[9px] border border-zinc-600 text-zinc-400 hover:bg-zinc-800 cursor-pointer"
            data-testid="scope-clear"
          >
            CLR
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-700 cursor-pointer text-[12px]"
              data-testid="scope-close"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      {/* Waveform display */}
      <div className="px-2 pt-1">
        <svg
          width={SCOPE_WIDTH}
          height={SCOPE_HEIGHT}
          className="bg-black rounded border border-zinc-800"
          data-testid="scope-display"
        >
          {/* Background */}
          <rect x={0} y={0} width={SCOPE_WIDTH} height={SCOPE_HEIGHT} fill="#0a0a0a" rx={4} />

          <Graticule />

          {/* Waveform traces */}
          {state.channels.map((ch) =>
            ch.enabled ? (
              <WaveformTrace
                key={ch.index}
                engine={engine}
                channelIndex={ch.index}
                color={ch.color}
                voltsPerDiv={ch.voltsPerDiv}
                offset={ch.offset}
              />
            ) : null,
          )}

          {/* Trigger level indicator */}
          {state.trigger.enabled ? (
            <line
              x1={PADDING.left}
              y1={PADDING.top + PLOT_HEIGHT / 2 - (state.trigger.level / ((state.channels[state.trigger.channelIndex]?.voltsPerDiv ?? 1) * VERTICAL_DIVS)) * PLOT_HEIGHT}
              x2={PADDING.left + 12}
              y2={PADDING.top + PLOT_HEIGHT / 2 - (state.trigger.level / ((state.channels[state.trigger.channelIndex]?.voltsPerDiv ?? 1) * VERTICAL_DIVS)) * PLOT_HEIGHT}
              stroke="#f59e0b"
              strokeWidth={1.5}
              data-testid="scope-trigger-level"
            />
          ) : null}
        </svg>
      </div>

      {/* Timebase controls */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800">
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-zinc-400">Time:</span>
          <button
            type="button"
            onClick={handleTimebaseFaster}
            className="w-4 h-4 bg-zinc-800 border border-zinc-700 rounded text-[8px] cursor-pointer hover:bg-zinc-700"
            data-testid="scope-timebase-faster"
          >
            -
          </button>
          <span className="w-16 text-center font-mono text-[var(--color-editor-accent)]" data-testid="scope-timebase-label">
            {formatSIValue(timePerDiv, 's')}/d
          </span>
          <button
            type="button"
            onClick={handleTimebaseSlower}
            className="w-4 h-4 bg-zinc-800 border border-zinc-700 rounded text-[8px] cursor-pointer hover:bg-zinc-700"
            data-testid="scope-timebase-slower"
          >
            +
          </button>
        </div>

        {/* Trigger controls */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-zinc-400">Trig:</span>
          <button
            type="button"
            onClick={handleTriggerToggle}
            className={cn(
              'px-1.5 py-0.5 rounded text-[8px] border cursor-pointer',
              state.trigger.enabled
                ? 'border-amber-400/50 text-amber-400'
                : 'border-zinc-600 text-zinc-400',
            )}
            data-testid="scope-trigger-toggle"
          >
            {state.trigger.enabled ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={handleTriggerEdge}
            className="px-1.5 py-0.5 rounded text-[8px] border border-zinc-700 text-zinc-300 cursor-pointer hover:bg-zinc-800"
            data-testid="scope-trigger-edge"
          >
            {state.trigger.edge === 'rising' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Channel controls */}
      <div className="px-3 py-1.5 space-y-1">
        {state.channels.map((ch) => (
          <ChannelControl
            key={ch.index}
            channelIndex={ch.index}
            enabled={ch.enabled}
            color={ch.color}
            voltsPerDiv={ch.voltsPerDiv}
            probeNodeId={ch.probeNodeId}
            availableNodes={availableNodes}
            engine={engine}
          />
        ))}
      </div>
    </div>
  );
});

export default VirtualOscilloscope;
