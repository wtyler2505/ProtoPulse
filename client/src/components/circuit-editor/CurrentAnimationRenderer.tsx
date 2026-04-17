/**
 * CurrentAnimationRenderer — SVG overlay that renders EveryCircuit-style
 * animated current dots flowing along wire paths, with voltage-based
 * wire coloring. Also provides a control bar and toolbar toggle button.
 *
 * Renders inside an existing SVG context (not a standalone SVG).
 * Does NOT modify SchematicCanvas.tsx — it is composed in by the parent.
 *
 * BL-0128
 */

import { memo, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { CurrentAnimationManager } from '@/lib/simulation/current-animation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GLOW_FILTER_ID = 'current-anim-glow';
const ARROW_SIZE = 5;
const WIRE_HEATMAP_WIDTH = 3;
const CONTROL_BAR_HEIGHT = 36;

// ---------------------------------------------------------------------------
// SVG Glow filter definition
// ---------------------------------------------------------------------------

const GlowFilterDef = memo(function GlowFilterDef() {
  return (
    <defs>
      <filter id={GLOW_FILTER_ID} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
});

// ---------------------------------------------------------------------------
// Animated dot
// ---------------------------------------------------------------------------

interface AnimDotProps {
  x: number;
  y: number;
  radius: number;
  color: string;
  showArrow: boolean;
  angle: number;
  id: string;
}

const AnimDot = memo(function AnimDot({ x, y, radius, color, showArrow, angle, id }: AnimDotProps) {
  return (
    <g data-testid={`anim-dot-${id}`}>
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={color}
        filter={`url(#${GLOW_FILTER_ID})`}
        opacity={0.9}
      />
      {showArrow && (
        <polygon
          points={`0,${-ARROW_SIZE / 2} ${ARROW_SIZE},0 0,${ARROW_SIZE / 2}`}
          fill={color}
          opacity={0.8}
          transform={`translate(${String(x + radius + 1)}, ${String(y)}) rotate(${String((angle * 180) / Math.PI)})`}
          data-testid={`anim-arrow-${id}`}
        />
      )}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Voltage heatmap wire
// ---------------------------------------------------------------------------

interface HeatmapWireProps {
  wireId: string;
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  color: string;
  opacity: number;
}

const HeatmapWire = memo(function HeatmapWire({ wireId, segments, color, opacity }: HeatmapWireProps) {
  return (
    <g data-testid={`heatmap-wire-${wireId}`}>
      {segments.map((seg, i) => (
        <line
          key={`${wireId}-hm-${String(i)}`}
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          stroke={color}
          strokeWidth={WIRE_HEATMAP_WIDTH}
          strokeOpacity={opacity}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Main SVG overlay component
// ---------------------------------------------------------------------------

export interface CurrentAnimationRendererProps {
  manager: CurrentAnimationManager;
}

/**
 * SVG overlay that renders animated current dots and voltage heatmap wires.
 * Uses requestAnimationFrame for smooth 60fps animation.
 *
 * Place this as a child of the schematic SVG group.
 */
export const CurrentAnimationRenderer = memo(function CurrentAnimationRenderer({
  manager,
}: CurrentAnimationRendererProps) {
  const subscribe = useCallback(
    (cb: () => void) => manager.subscribe(cb),
    [manager],
  );
  const getSnapshot = useCallback(() => manager.getAnimationFrame(), [manager]);
  const frame = useSyncExternalStore(subscribe, getSnapshot);

  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Animation loop: tick the manager each frame
  useEffect(() => {
    if (frame.state !== 'playing') {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      lastTimeRef.current = 0;
      return;
    }

    const loop = (timestamp: number) => {
      if (lastTimeRef.current > 0) {
        const delta = timestamp - lastTimeRef.current;
        manager.tick(delta);
      }
      lastTimeRef.current = timestamp;
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      lastTimeRef.current = 0;
    };
  }, [frame.state, manager]);

  if (frame.state === 'idle' && frame.dots.length === 0 && frame.wires.length === 0) {
    return null;
  }

  return (
    <g data-testid="current-animation-overlay">
      <GlowFilterDef />

      {/* Voltage heatmap wires (behind dots) */}
      {frame.wires.map((wire) => (
        <HeatmapWire
          key={`hm-${wire.wireId}`}
          wireId={wire.wireId}
          segments={wire.segments}
          color={wire.color}
          opacity={wire.opacity}
        />
      ))}

      {/* Animated current dots */}
      {frame.dots.map((dot) => (
        <AnimDot
          key={dot.id}
          id={dot.id}
          x={dot.x}
          y={dot.y}
          radius={dot.radius}
          color={dot.color}
          showArrow={dot.showArrow}
          angle={dot.angle}
        />
      ))}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Control bar (HTML overlay, not SVG)
// ---------------------------------------------------------------------------

export interface CurrentAnimationControlBarProps {
  manager: CurrentAnimationManager;
}

/**
 * Control bar for the current animation overlay.
 * Renders as an HTML overlay positioned at the bottom of the canvas.
 *
 * Controls: Play/Pause, Stop, Speed slider, Voltage colors toggle.
 */
export const CurrentAnimationControlBar = memo(function CurrentAnimationControlBar({
  manager,
}: CurrentAnimationControlBarProps) {
  const subscribe = useCallback(
    (cb: () => void) => manager.subscribe(cb),
    [manager],
  );
  const getSnapshot = useCallback(
    () => ({
      state: manager.getState(),
      speed: manager.getSpeed(),
      showHeatmap: manager.getShowVoltageHeatmap(),
    }),
    [manager],
  );
  const status = useSyncExternalStore(subscribe, getSnapshot);

  const handlePlayPause = useCallback(() => {
    if (status.state === 'playing') {
      manager.pause();
    } else {
      manager.play();
    }
  }, [manager, status.state]);

  const handleStop = useCallback(() => {
    manager.stop();
  }, [manager]);

  const handleSpeedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      manager.setSpeed(parseFloat(e.target.value));
    },
    [manager],
  );

  const handleHeatmapToggle = useCallback(() => {
    manager.setShowVoltageHeatmap(!status.showHeatmap);
  }, [manager, status.showHeatmap]);

  return (
    <div
      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/80 border border-[var(--color-editor-accent)]/30 rounded-lg px-3 py-1.5 backdrop-blur-sm"
      style={{ height: CONTROL_BAR_HEIGHT }}
      data-testid="current-animation-control-bar"
    >
      {/* Play/Pause */}
      <button
        type="button"
        onClick={handlePlayPause}
        className="flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-700 text-[var(--color-editor-accent)] transition-colors"
        title={status.state === 'playing' ? 'Pause animation' : 'Play animation'}
        aria-label={status.state === 'playing' ? 'Pause animation' : 'Play animation'}
        data-testid="current-animation-play-pause"
      >
        {status.state === 'playing' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Stop */}
      <button
        type="button"
        onClick={handleStop}
        className="flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        title="Stop animation"
        aria-label="Stop animation"
        data-testid="current-animation-stop"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-zinc-600" />

      {/* Speed slider */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-zinc-400" data-testid="current-animation-speed-label">
          {status.speed.toFixed(2)}x
        </span>
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.25}
          value={status.speed}
          onChange={handleSpeedChange}
          className="w-16 h-1 accent-[var(--color-editor-accent)] cursor-pointer"
          title="Animation speed"
          aria-label="Animation speed"
          data-testid="current-animation-speed-slider"
        />
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-zinc-600" />

      {/* Voltage colors toggle */}
      <button
        type="button"
        onClick={handleHeatmapToggle}
        className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
          status.showHeatmap
            ? 'bg-[var(--color-editor-accent)]/20 text-[var(--color-editor-accent)] ring-1 ring-[var(--color-editor-accent)]/50'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
        }`}
        title={status.showHeatmap ? 'Hide voltage colors' : 'Show voltage colors'}
        aria-label="Toggle voltage colors"
        aria-pressed={status.showHeatmap}
        data-testid="current-animation-heatmap-toggle"
      >
        V Colors
      </button>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Toolbar toggle button
// ---------------------------------------------------------------------------

export interface CurrentAnimationToggleButtonProps {
  manager: CurrentAnimationManager;
  disabled?: boolean;
}

/**
 * Toolbar toggle button for the current animation overlay.
 * Uses Zap icon with cyan active state.
 */
export const CurrentAnimationToggleButton = memo(function CurrentAnimationToggleButton({
  manager,
  disabled = false,
}: CurrentAnimationToggleButtonProps) {
  const subscribe = useCallback(
    (cb: () => void) => manager.subscribe(cb),
    [manager],
  );
  const getSnapshot = useCallback(() => manager.getState(), [manager]);
  const state = useSyncExternalStore(subscribe, getSnapshot);

  const isActive = state !== 'idle';

  const handleClick = useCallback(() => {
    if (isActive) {
      manager.stop();
    } else {
      manager.play();
    }
  }, [manager, isActive]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
        isActive
          ? 'bg-[var(--color-editor-accent)]/20 text-[var(--color-editor-accent)] ring-1 ring-[var(--color-editor-accent)]/50'
          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      title={isActive ? 'Stop current animation' : 'Start current animation'}
      aria-pressed={isActive}
      aria-label="Toggle current animation"
      data-testid="current-animation-toggle-button"
    >
      {/* Zap icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      Animate
    </button>
  );
});
