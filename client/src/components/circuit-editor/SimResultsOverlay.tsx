/**
 * SimResultsOverlay — SVG overlay that renders DC operating point results
 * directly on the schematic canvas. Shows:
 *   - Voltage labels: rounded rect badges at node positions
 *   - Current arrows: small arrow indicators on wire segments
 *   - Probe indicators: crosshair/circle markers at probe positions
 *   - Color legend: gradient bar showing voltage/current scale
 *
 * Different from CurrentAnimationRenderer (BL-0128) which renders animated
 * moving dots. This overlay shows static value labels and badges.
 *
 * BL-0560
 */

import { memo, useCallback, useSyncExternalStore } from 'react';
import type { SimResultsOverlayManager, ProbeType, SimOverlayData } from '@/lib/simulation/sim-results-overlay';
import { formatValue } from '@/lib/simulation/sim-results-overlay';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BADGE_HEIGHT = 20;
const BADGE_PADDING_X = 8;
const BADGE_FONT_SIZE = 11;
const BADGE_BORDER_RADIUS = 4;
const PROBE_RADIUS = 8;
const PROBE_CROSSHAIR_SIZE = 12;
const ARROW_SIZE = 6;
const LEGEND_WIDTH = 120;
const LEGEND_HEIGHT = 14;
const LEGEND_MARGIN = 8;
const GLOW_FILTER_ID = 'sim-overlay-glow';

// ---------------------------------------------------------------------------
// SVG Glow filter definition
// ---------------------------------------------------------------------------

const GlowFilterDef = memo(function GlowFilterDef() {
  return (
    <defs>
      <filter id={GLOW_FILTER_ID} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
});

// ---------------------------------------------------------------------------
// Voltage badge
// ---------------------------------------------------------------------------

interface VoltageBadgeProps {
  nodeId: string;
  voltage: number;
  x: number;
  y: number;
  color: string;
}

const VoltageBadge = memo(function VoltageBadge({ nodeId, voltage, x, y, color }: VoltageBadgeProps) {
  const text = formatValue(voltage, 'V');
  // Estimate text width from character count
  const textWidth = text.length * (BADGE_FONT_SIZE * 0.6);
  const badgeWidth = textWidth + BADGE_PADDING_X * 2;

  return (
    <g
      data-testid={`sim-voltage-badge-${nodeId}`}
      transform={`translate(${String(x)}, ${String(y)})`}
    >
      {/* Badge background */}
      <rect
        x={-badgeWidth / 2}
        y={-BADGE_HEIGHT / 2}
        width={badgeWidth}
        height={BADGE_HEIGHT}
        rx={BADGE_BORDER_RADIUS}
        ry={BADGE_BORDER_RADIUS}
        fill={color}
        fillOpacity={0.85}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={0.5}
      />
      {/* Voltage text */}
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={BADGE_FONT_SIZE}
        fontFamily="monospace"
        fill="white"
        fontWeight="bold"
      >
        {text}
      </text>
    </g>
  );
});

// ---------------------------------------------------------------------------
// Current arrow indicator
// ---------------------------------------------------------------------------

interface CurrentArrowProps {
  componentId: string;
  current: number;
  x: number;
  y: number;
  angle: number;
  color: string;
  direction: 'forward' | 'reverse';
}

const CurrentArrow = memo(function CurrentArrow({
  componentId,
  current,
  x,
  y,
  angle,
  color,
  direction,
}: CurrentArrowProps) {
  const text = formatValue(current, 'A');
  const arrowAngle = direction === 'reverse' ? angle + 180 : angle;

  return (
    <g
      data-testid={`sim-current-arrow-${componentId}`}
      transform={`translate(${String(x)}, ${String(y)})`}
    >
      {/* Arrow head */}
      <polygon
        points={`0,${-ARROW_SIZE / 2} ${ARROW_SIZE},0 0,${ARROW_SIZE / 2}`}
        fill={color}
        opacity={0.9}
        transform={`rotate(${String(arrowAngle)})`}
      />
      {/* Current label — offset to the right of the arrow */}
      <text
        x={ARROW_SIZE + 4}
        y={0}
        textAnchor="start"
        dominantBaseline="central"
        fontSize={10}
        fontFamily="monospace"
        fill={color}
        fontWeight="600"
      >
        {text}
      </text>
    </g>
  );
});

// ---------------------------------------------------------------------------
// Probe indicator
// ---------------------------------------------------------------------------

interface ProbeIndicatorProps {
  id: string;
  type: ProbeType;
  label: string;
  x: number;
  y: number;
}

const ProbeIndicator = memo(function ProbeIndicator({ id, type, label, x, y }: ProbeIndicatorProps) {
  const probeColor = type === 'voltage' ? 'var(--color-editor-accent)' : '#FFD700';

  return (
    <g
      data-testid={`sim-probe-${id}`}
      transform={`translate(${String(x)}, ${String(y)})`}
    >
      {/* Outer circle */}
      <circle
        cx={0}
        cy={0}
        r={PROBE_RADIUS}
        fill="none"
        stroke={probeColor}
        strokeWidth={1.5}
        opacity={0.8}
        filter={`url(#${GLOW_FILTER_ID})`}
      />
      {/* Crosshair */}
      <line
        x1={-PROBE_CROSSHAIR_SIZE / 2}
        y1={0}
        x2={PROBE_CROSSHAIR_SIZE / 2}
        y2={0}
        stroke={probeColor}
        strokeWidth={1}
        opacity={0.6}
      />
      <line
        x1={0}
        y1={-PROBE_CROSSHAIR_SIZE / 2}
        x2={0}
        y2={PROBE_CROSSHAIR_SIZE / 2}
        stroke={probeColor}
        strokeWidth={1}
        opacity={0.6}
      />
      {/* Center dot */}
      <circle
        cx={0}
        cy={0}
        r={2}
        fill={probeColor}
        opacity={0.9}
      />
      {/* Label below the probe */}
      <text
        x={0}
        y={PROBE_RADIUS + 12}
        textAnchor="middle"
        fontSize={10}
        fontFamily="monospace"
        fill={probeColor}
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  );
});

// ---------------------------------------------------------------------------
// Color legend
// ---------------------------------------------------------------------------

interface ColorLegendProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftColor: string;
  midColor: string;
  rightColor: string;
  x: number;
  y: number;
}

const ColorLegend = memo(function ColorLegend({
  label,
  leftLabel,
  rightLabel,
  leftColor,
  midColor,
  rightColor,
  x,
  y,
}: ColorLegendProps) {
  const gradientId = `sim-legend-grad-${label.toLowerCase().replace(/\s/g, '-')}`;

  return (
    <g transform={`translate(${String(x)}, ${String(y)})`} data-testid={`sim-legend-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={leftColor} />
          <stop offset="50%" stopColor={midColor} />
          <stop offset="100%" stopColor={rightColor} />
        </linearGradient>
      </defs>
      {/* Label */}
      <text
        x={0}
        y={-4}
        fontSize={9}
        fontFamily="sans-serif"
        fill="rgba(255,255,255,0.7)"
      >
        {label}
      </text>
      {/* Gradient bar */}
      <rect
        x={0}
        y={0}
        width={LEGEND_WIDTH}
        height={LEGEND_HEIGHT}
        rx={2}
        ry={2}
        fill={`url(#${gradientId})`}
        opacity={0.8}
      />
      {/* Min/max labels */}
      <text
        x={0}
        y={LEGEND_HEIGHT + 10}
        fontSize={8}
        fontFamily="monospace"
        fill="rgba(255,255,255,0.6)"
      >
        {leftLabel}
      </text>
      <text
        x={LEGEND_WIDTH}
        y={LEGEND_HEIGHT + 10}
        textAnchor="end"
        fontSize={8}
        fontFamily="monospace"
        fill="rgba(255,255,255,0.6)"
      >
        {rightLabel}
      </text>
    </g>
  );
});

// ---------------------------------------------------------------------------
// Main SVG overlay component
// ---------------------------------------------------------------------------

export interface SimResultsOverlayProps {
  overlayData: SimOverlayData;
  manager: SimResultsOverlayManager;
  /** Positions of nodes on the canvas: nodeId → { x, y }. */
  nodePositions?: Map<string, { x: number; y: number }>;
  /** Positions of wire midpoints for current arrows: componentId → { x, y, angle }. */
  wirePositions?: Map<string, { x: number; y: number; angle: number }>;
  /** Called when user clicks to toggle a probe. */
  onToggleProbe?: (nodeId: string, type: ProbeType, pos: { x: number; y: number }) => void;
}

/**
 * SVG overlay that renders simulation result badges, arrows, and probes
 * on top of the schematic canvas.
 */
export const SimResultsOverlay = memo(function SimResultsOverlay({
  overlayData,
  manager,
  nodePositions,
  wirePositions,
  onToggleProbe: _onToggleProbe,
}: SimResultsOverlayProps) {
  if (!overlayData.visible) {
    return null;
  }

  const voltageEntries = Array.from(overlayData.nodeVoltages.entries());
  const currentEntries = Array.from(overlayData.branchCurrents.entries());

  return (
    <g data-testid="sim-results-overlay">
      <GlowFilterDef />

      {/* Voltage badges at node positions */}
      {nodePositions && voltageEntries.map(([nodeId, voltage]) => {
        const pos = nodePositions.get(nodeId);
        if (!pos) {
          return null;
        }
        return (
          <VoltageBadge
            key={`vbadge-${nodeId}`}
            nodeId={nodeId}
            voltage={voltage}
            x={pos.x}
            y={pos.y - 20}
            color={manager.getVoltageColor(voltage)}
          />
        );
      })}

      {/* Current arrows at wire positions */}
      {wirePositions && currentEntries.map(([compId, current]) => {
        const pos = wirePositions.get(compId);
        if (!pos) {
          return null;
        }
        return (
          <CurrentArrow
            key={`carrow-${compId}`}
            componentId={compId}
            current={current}
            x={pos.x}
            y={pos.y}
            angle={pos.angle}
            color={manager.getCurrentColor(current)}
            direction={manager.getCurrentArrowDirection(current)}
          />
        );
      })}

      {/* Probe indicators */}
      {overlayData.probes.map((probe) => (
        <ProbeIndicator
          key={probe.id}
          id={probe.id}
          type={probe.type}
          label={probe.label}
          x={probe.position.x}
          y={probe.position.y}
        />
      ))}

      {/* Color legends (positioned in bottom-left of the SVG viewport) */}
      <ColorLegend
        label="Voltage"
        leftLabel="0V"
        rightLabel="High"
        leftColor="hsl(0, 0%, 50%)"
        midColor="hsl(180, 90%, 50%)"
        rightColor="hsl(0, 90%, 50%)"
        x={LEGEND_MARGIN}
        y={LEGEND_MARGIN}
      />
      <ColorLegend
        label="Current"
        leftLabel="0A"
        rightLabel="High"
        leftColor="hsl(0, 0%, 50%)"
        midColor="hsl(120, 80%, 45%)"
        rightColor="hsl(30, 100%, 45%)"
        x={LEGEND_MARGIN}
        y={LEGEND_MARGIN + LEGEND_HEIGHT + 30}
      />
    </g>
  );
});

// ---------------------------------------------------------------------------
// Toggle button for toolbar
// ---------------------------------------------------------------------------

export interface SimResultsToggleButtonProps {
  manager: SimResultsOverlayManager;
  disabled?: boolean;
}

/**
 * Toolbar toggle button for the simulation results overlay.
 * Uses Activity icon with cyan active state.
 */
export const SimResultsToggleButton = memo(function SimResultsToggleButton({
  manager,
  disabled = false,
}: SimResultsToggleButtonProps) {
  const subscribe = useCallback(
    (cb: () => void) => manager.subscribe(cb),
    [manager],
  );
  const getSnapshot = useCallback(() => manager.getSnapshot(), [manager]);
  useSyncExternalStore(subscribe, getSnapshot);

  const { visible } = manager.getOverlayData();

  const handleClick = useCallback(() => {
    manager.toggleVisible();
  }, [manager]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
        visible
          ? 'bg-[var(--color-editor-accent)]/20 text-[var(--color-editor-accent)] ring-1 ring-[var(--color-editor-accent)]/50'
          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      title={visible ? 'Hide simulation results' : 'Show simulation results'}
      aria-pressed={visible}
      aria-label="Toggle simulation results overlay"
      data-testid="sim-results-toggle-button"
    >
      {/* Activity icon */}
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
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      Sim Results
    </button>
  );
});
