/**
 * ThermalHeatmapRenderer — SVG overlay that renders a thermal heatmap
 * on top of the PCB layout. Color-codes cells by temperature using the
 * blue→green→yellow→orange→red gradient.
 *
 * Renders inside an existing SVG context (not a standalone SVG).
 * Does NOT modify PCBLayoutView.tsx — it is composed in by the parent.
 */

import { memo, useCallback, useSyncExternalStore } from 'react';
import type { ThermalOverlayManager, Hotspot, LegendStop } from '@/lib/pcb/thermal-overlay';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_OPACITY = 0.55;
const HOTSPOT_ICON_SIZE = 3; // mm
const HOTSPOT_STROKE_COLOR = '#ff2200';
const HOTSPOT_FILL = '#ff220033';
const HOTSPOT_PULSE_COLOR = '#ff220066';
const LEGEND_WIDTH = 14; // px (in SVG user units = mm)
const LEGEND_HEIGHT = 60; // px
const LEGEND_OFFSET_X = 4; // mm from right edge
const LEGEND_OFFSET_Y = 4; // mm from top
const LABEL_FONT_SIZE = 2; // mm
const TEMP_LABEL_FONT_SIZE = 1.6; // mm

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface HeatmapCellsProps {
  manager: ThermalOverlayManager;
}

const HeatmapCells = memo(function HeatmapCells({ manager }: HeatmapCellsProps) {
  const cells = manager.getHeatmapCells();

  return (
    <g data-testid="thermal-heatmap-cells">
      {cells.map((cell) => (
        <rect
          key={`${String(cell.col)}-${String(cell.row)}`}
          x={cell.x}
          y={cell.y}
          width={cell.width}
          height={cell.height}
          fill={cell.color}
          opacity={CELL_OPACITY}
          data-testid={`thermal-cell-${String(cell.col)}-${String(cell.row)}`}
        />
      ))}
    </g>
  );
});

// ---------------------------------------------------------------------------

interface HotspotMarkersProps {
  hotspots: Hotspot[];
}

const HotspotMarkers = memo(function HotspotMarkers({ hotspots }: HotspotMarkersProps) {
  if (hotspots.length === 0) {
    return null;
  }

  return (
    <g data-testid="thermal-hotspot-markers">
      {hotspots.map((hs) => {
        const half = HOTSPOT_ICON_SIZE / 2;
        return (
          <g
            key={hs.componentId}
            transform={`translate(${String(hs.position.x)}, ${String(hs.position.y)})`}
            data-testid={`thermal-hotspot-${hs.componentId}`}
          >
            {/* Pulsing background circle */}
            <circle
              r={hs.boundingBox.width / 2 + 1}
              fill={HOTSPOT_PULSE_COLOR}
              data-testid={`thermal-hotspot-pulse-${hs.componentId}`}
            >
              <animate
                attributeName="r"
                values={`${String(hs.boundingBox.width / 2 + 0.5)};${String(hs.boundingBox.width / 2 + 2)};${String(hs.boundingBox.width / 2 + 0.5)}`}
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

            {/* Warning triangle icon */}
            <polygon
              points={`0,${String(-half)} ${String(half)},${String(half)} ${String(-half)},${String(half)}`}
              fill={HOTSPOT_FILL}
              stroke={HOTSPOT_STROKE_COLOR}
              strokeWidth={0.3}
              data-testid={`thermal-hotspot-icon-${hs.componentId}`}
            />

            {/* Exclamation mark */}
            <line
              x1={0}
              y1={-half * 0.5}
              x2={0}
              y2={half * 0.2}
              stroke={HOTSPOT_STROKE_COLOR}
              strokeWidth={0.35}
              strokeLinecap="round"
            />
            <circle
              cx={0}
              cy={half * 0.55}
              r={0.2}
              fill={HOTSPOT_STROKE_COLOR}
            />

            {/* Temperature label */}
            <text
              x={half + 1}
              y={0}
              fontSize={TEMP_LABEL_FONT_SIZE}
              fill={HOTSPOT_STROKE_COLOR}
              fontWeight="bold"
              dominantBaseline="central"
              data-testid={`thermal-hotspot-temp-${hs.componentId}`}
            >
              {`${String(Math.round(hs.temperature))}°C`}
            </text>
          </g>
        );
      })}
    </g>
  );
});

// ---------------------------------------------------------------------------

interface ThermalLegendProps {
  stops: LegendStop[];
  boardWidth: number;
}

const ThermalLegend = memo(function ThermalLegend({ stops, boardWidth }: ThermalLegendProps) {
  if (stops.length < 2) {
    return null;
  }

  const x = boardWidth - LEGEND_WIDTH - LEGEND_OFFSET_X;
  const y = LEGEND_OFFSET_Y;

  return (
    <g data-testid="thermal-legend" transform={`translate(${String(x)}, ${String(y)})`}>
      {/* Background */}
      <rect
        x={-1}
        y={-3}
        width={LEGEND_WIDTH + 2}
        height={LEGEND_HEIGHT + 8}
        fill="#1a1a2ecc"
        rx={1}
        data-testid="thermal-legend-bg"
      />

      {/* Title */}
      <text
        x={LEGEND_WIDTH / 2}
        y={-0.5}
        fontSize={LABEL_FONT_SIZE}
        fill="#e0e0e0"
        textAnchor="middle"
        fontWeight="bold"
        data-testid="thermal-legend-title"
      >
        °C
      </text>

      {/* Gradient bar using individual stop rects */}
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
            data-testid={`thermal-legend-seg-${String(i)}`}
          />
        );
      })}

      {/* Temperature labels */}
      {stops.map((stop, i) => {
        // Show label on first, last, and middle stops
        if (i > 0 && i < stops.length - 1 && i !== Math.floor(stops.length / 2)) {
          return null;
        }
        const labelY = LEGEND_HEIGHT * (1 - stop.position);
        return (
          <text
            key={`label-${String(i)}`}
            x={6}
            y={labelY + 0.5}
            fontSize={TEMP_LABEL_FONT_SIZE}
            fill="#cccccc"
            dominantBaseline="central"
            data-testid={`thermal-legend-label-${String(i)}`}
          >
            {String(Math.round(stop.temperature))}
          </text>
        );
      })}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ThermalHeatmapRendererProps {
  manager: ThermalOverlayManager;
  boardWidth: number;
  boardHeight: number;
}

/**
 * SVG overlay that renders a thermal heatmap on the PCB.
 * Subscribes to the ThermalOverlayManager for reactive updates.
 *
 * Place this as a child of the PCB SVG group, after traces/pads but
 * before interactive overlay elements.
 */
export const ThermalHeatmapRenderer = memo(function ThermalHeatmapRenderer({
  manager,
  boardWidth,
  boardHeight,
}: ThermalHeatmapRendererProps) {
  const subscribe = useCallback(
    (cb: () => void) => manager.subscribe(cb),
    [manager],
  );
  const getSnapshot = useCallback(() => manager.isEnabled(), [manager]);

  const enabled = useSyncExternalStore(subscribe, getSnapshot);

  if (!enabled || !manager.getThermalData()) {
    return null;
  }

  const hotspots = manager.getHotspots();
  const legendStops = manager.getLegendStops();

  return (
    <g data-testid="thermal-heatmap-overlay">
      {/* Clip to board area */}
      <defs>
        <clipPath id="thermal-clip">
          <rect x={0} y={0} width={boardWidth} height={boardHeight} />
        </clipPath>
      </defs>

      <g clipPath="url(#thermal-clip)">
        <HeatmapCells manager={manager} />
      </g>

      <HotspotMarkers hotspots={hotspots} />
      <ThermalLegend stops={legendStops} boardWidth={boardWidth} />
    </g>
  );
});

// ---------------------------------------------------------------------------
// Toggle button (for toolbar integration)
// ---------------------------------------------------------------------------

export interface ThermalToggleButtonProps {
  manager: ThermalOverlayManager;
  disabled?: boolean;
}

/**
 * Toolbar toggle button for the thermal heatmap overlay.
 * Uses useSyncExternalStore for reactive enable/disable state.
 */
export const ThermalToggleButton = memo(function ThermalToggleButton({
  manager,
  disabled = false,
}: ThermalToggleButtonProps) {
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
          ? 'bg-orange-600/30 text-orange-400 ring-1 ring-orange-500/50'
          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      title={enabled ? 'Hide thermal heatmap' : 'Show thermal heatmap'}
      data-testid="thermal-toggle-button"
    >
      {/* Thermometer icon (inline SVG) */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
      </svg>
      Thermal
    </button>
  );
});
