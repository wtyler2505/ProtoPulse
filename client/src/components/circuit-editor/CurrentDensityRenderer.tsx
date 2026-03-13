/**
 * CurrentDensityRenderer — SVG overlay that color-codes PCB traces and copper
 * pours by current density (A/mm²). Highlights traces at risk of overheating
 * or fusing using IPC-2152 reference thresholds.
 *
 * Renders inside an existing SVG context (not a standalone SVG).
 * Does NOT modify PCBLayoutView.tsx — it is composed in by the parent.
 */

import { memo, useCallback, useState, useSyncExternalStore } from 'react';
import type { CurrentDensityOverlayManager, DensitySegment, HotTrace, LegendStop } from '@/lib/pcb/current-density-overlay';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEGMENT_OPACITY = 0.75;
const SEGMENT_HOVER_OPACITY = 0.95;
const HOT_TRACE_ICON_SIZE = 3; // mm
const LEGEND_WIDTH = 16; // mm
const LEGEND_HEIGHT = 60; // mm
const LEGEND_OFFSET_X = 4; // mm from right edge
const LEGEND_OFFSET_Y = 4; // mm from top
const LABEL_FONT_SIZE = 2; // mm
const TOOLTIP_FONT_SIZE = 1.6; // mm
const WARNING_STROKE = '#EF4444';
const WARNING_FILL = '#EF444433';
const WARNING_PULSE = '#EF444466';

// ---------------------------------------------------------------------------
// Severity labels
// ---------------------------------------------------------------------------

const SEVERITY_LABELS: Record<string, string> = {
  safe: 'Safe',
  caution: 'Caution',
  danger: 'Danger',
  critical: 'CRITICAL',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DensitySegmentLineProps {
  segment: DensitySegment;
}

const DensitySegmentLine = memo(function DensitySegmentLine({ segment }: DensitySegmentLineProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <g
      data-testid={`density-segment-${segment.id}`}
      onMouseEnter={() => { setHovered(true); }}
      onMouseLeave={() => { setHovered(false); }}
    >
      {/* Glow behind for visibility */}
      <line
        x1={segment.start.x}
        y1={segment.start.y}
        x2={segment.end.x}
        y2={segment.end.y}
        stroke={segment.color}
        strokeWidth={segment.width + 1}
        strokeOpacity={0.2}
        strokeLinecap="round"
      />
      {/* Main colored trace */}
      <line
        x1={segment.start.x}
        y1={segment.start.y}
        x2={segment.end.x}
        y2={segment.end.y}
        stroke={segment.color}
        strokeWidth={segment.width}
        strokeOpacity={hovered ? SEGMENT_HOVER_OPACITY : SEGMENT_OPACITY}
        strokeLinecap="round"
      />
      {hovered && (
        <text
          x={(segment.start.x + segment.end.x) / 2}
          y={(segment.start.y + segment.end.y) / 2 - segment.width - 1}
          textAnchor="middle"
          fill={segment.color}
          fontSize={TOOLTIP_FONT_SIZE}
          fontFamily="monospace"
          fontWeight="bold"
          data-testid={`density-tooltip-${segment.id}`}
        >
          {`${segment.density.toFixed(1)} A/mm² (${SEVERITY_LABELS[segment.severity] ?? segment.severity})`}
        </text>
      )}
    </g>
  );
});

// ---------------------------------------------------------------------------

interface HotTraceMarkersProps {
  hotTraces: HotTrace[];
  segments: DensitySegment[];
}

const HotTraceMarkers = memo(function HotTraceMarkers({ hotTraces, segments }: HotTraceMarkersProps) {
  if (hotTraces.length === 0) {
    return null;
  }

  return (
    <g data-testid="density-hot-trace-markers">
      {hotTraces.map((ht) => {
        // Find first segment of this trace to get position
        const seg = segments.find((s) => s.id.startsWith(`${ht.traceId}-`));
        if (!seg) {
          return null;
        }

        const cx = (seg.start.x + seg.end.x) / 2;
        const cy = (seg.start.y + seg.end.y) / 2;
        const half = HOT_TRACE_ICON_SIZE / 2;

        return (
          <g
            key={ht.traceId}
            transform={`translate(${String(cx)}, ${String(cy)})`}
            data-testid={`density-hot-marker-${ht.traceId}`}
          >
            {/* Pulsing circle */}
            <circle
              r={HOT_TRACE_ICON_SIZE}
              fill={WARNING_PULSE}
              data-testid={`density-hot-pulse-${ht.traceId}`}
            >
              <animate
                attributeName="r"
                values={`${String(HOT_TRACE_ICON_SIZE - 0.5)};${String(HOT_TRACE_ICON_SIZE + 1)};${String(HOT_TRACE_ICON_SIZE - 0.5)}`}
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.6;0.2;0.6"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Warning triangle */}
            <polygon
              points={`0,${String(-half)} ${String(half)},${String(half)} ${String(-half)},${String(half)}`}
              fill={WARNING_FILL}
              stroke={WARNING_STROKE}
              strokeWidth={0.3}
              data-testid={`density-hot-icon-${ht.traceId}`}
            />

            {/* Exclamation mark */}
            <line
              x1={0}
              y1={-half * 0.5}
              x2={0}
              y2={half * 0.2}
              stroke={WARNING_STROKE}
              strokeWidth={0.35}
              strokeLinecap="round"
            />
            <circle cx={0} cy={half * 0.55} r={0.2} fill={WARNING_STROKE} />

            {/* Label */}
            <text
              x={half + 1}
              y={0}
              fontSize={TOOLTIP_FONT_SIZE}
              fill={WARNING_STROKE}
              fontWeight="bold"
              dominantBaseline="central"
              fontFamily="monospace"
              data-testid={`density-hot-label-${ht.traceId}`}
            >
              {`${ht.maxDensity.toFixed(0)} A/mm²`}
            </text>
          </g>
        );
      })}
    </g>
  );
});

// ---------------------------------------------------------------------------

interface DensityLegendProps {
  stops: LegendStop[];
  boardWidth: number;
}

const DensityLegend = memo(function DensityLegend({ stops, boardWidth }: DensityLegendProps) {
  if (stops.length < 2) {
    return null;
  }

  const x = boardWidth - LEGEND_WIDTH - LEGEND_OFFSET_X;
  const y = LEGEND_OFFSET_Y;

  return (
    <g data-testid="density-legend" transform={`translate(${String(x)}, ${String(y)})`}>
      {/* Background */}
      <rect
        x={-1}
        y={-3}
        width={LEGEND_WIDTH + 2}
        height={LEGEND_HEIGHT + 8}
        fill="#1a1a2ecc"
        rx={1}
        data-testid="density-legend-bg"
      />

      {/* Title */}
      <text
        x={LEGEND_WIDTH / 2}
        y={-0.5}
        fontSize={LABEL_FONT_SIZE}
        fill="#e0e0e0"
        textAnchor="middle"
        fontWeight="bold"
        data-testid="density-legend-title"
      >
        A/mm²
      </text>

      {/* Gradient segments */}
      {stops.map((stop, i) => {
        if (i === stops.length - 1) {
          return null;
        }
        const nextStop = stops[i + 1];
        const segY = LEGEND_HEIGHT * (1 - nextStop.position);
        const segH = LEGEND_HEIGHT * (nextStop.position - stop.position);
        return (
          <rect
            key={`seg-${String(i)}`}
            x={0}
            y={segY}
            width={4}
            height={segH}
            fill={stop.color}
            data-testid={`density-legend-seg-${String(i)}`}
          />
        );
      })}

      {/* Labels */}
      {stops.map((stop, i) => {
        const labelY = LEGEND_HEIGHT * (1 - stop.position);
        return (
          <text
            key={`label-${String(i)}`}
            x={6}
            y={labelY + 0.5}
            fontSize={TOOLTIP_FONT_SIZE}
            fill="#cccccc"
            dominantBaseline="central"
            fontFamily="monospace"
            data-testid={`density-legend-label-${String(i)}`}
          >
            {stop.label}
          </text>
        );
      })}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface CurrentDensityRendererProps {
  manager: CurrentDensityOverlayManager;
  boardWidth: number;
  boardHeight: number;
}

/**
 * SVG overlay that renders current density visualization on the PCB.
 * Subscribes to the CurrentDensityOverlayManager for reactive updates.
 *
 * Place this as a child of the PCB SVG group, after traces/pads but
 * before interactive overlay elements.
 */
export const CurrentDensityRenderer = memo(function CurrentDensityRenderer({
  manager,
  boardWidth,
  boardHeight,
}: CurrentDensityRendererProps) {
  const subscribe = useCallback(
    (cb: () => void) => manager.subscribe(cb),
    [manager],
  );
  const getSnapshot = useCallback(() => manager.isEnabled(), [manager]);

  const enabled = useSyncExternalStore(subscribe, getSnapshot);

  if (!enabled || manager.getCurrentData().length === 0) {
    return null;
  }

  const segments = manager.getDensitySegments();
  const hotTraces = manager.getHotTraces();
  const legendStops = manager.getLegendStops();

  return (
    <g data-testid="current-density-overlay">
      {/* Clip to board area */}
      <defs>
        <clipPath id="current-density-clip">
          <rect x={0} y={0} width={boardWidth} height={boardHeight} />
        </clipPath>
      </defs>

      <g clipPath="url(#current-density-clip)">
        {segments.map((segment) => (
          <DensitySegmentLine key={segment.id} segment={segment} />
        ))}
      </g>

      <HotTraceMarkers hotTraces={hotTraces} segments={segments} />
      <DensityLegend stops={legendStops} boardWidth={boardWidth} />
    </g>
  );
});

// ---------------------------------------------------------------------------
// Toggle button (for toolbar integration)
// ---------------------------------------------------------------------------

export interface CurrentDensityToggleButtonProps {
  manager: CurrentDensityOverlayManager;
  disabled?: boolean;
}

/**
 * Toolbar toggle button for the current density overlay.
 * Uses useSyncExternalStore for reactive enable/disable state.
 */
export const CurrentDensityToggleButton = memo(function CurrentDensityToggleButton({
  manager,
  disabled = false,
}: CurrentDensityToggleButtonProps) {
  const subscribe = useCallback(
    (cb: () => void) => manager.subscribe(cb),
    [manager],
  );
  const getSnapshot = useCallback(() => manager.isEnabled(), [manager]);

  const enabled = useSyncExternalStore(subscribe, getSnapshot);

  const handleClick = useCallback(() => {
    manager.setEnabled(!enabled);
  }, [manager, enabled]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
        enabled
          ? 'bg-yellow-600/30 text-yellow-400 ring-1 ring-yellow-500/50'
          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      title={enabled ? 'Hide current density overlay' : 'Show current density overlay'}
      aria-pressed={enabled}
      aria-label="Toggle current density overlay"
      data-testid="current-density-toggle-button"
    >
      {/* Lightning bolt icon */}
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
      Density
    </button>
  );
});
