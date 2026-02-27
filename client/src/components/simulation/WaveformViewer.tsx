import { useState, useCallback, useRef, useMemo, useEffect, memo } from 'react';
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import { cn } from '@/lib/utils';
import { Download, Image, Eye, EyeOff, ZoomIn, RotateCcw } from 'lucide-react';
import {
  serializeSvg,
  rasterizeSvgToPng,
  downloadSvg,
  downloadPng,
} from '@/lib/circuit-editor/svg-export';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WaveformTrace {
  id: string;
  label: string;
  data: Array<{ x: number; y: number }>;
  color: string;
  unit: string;         // 'V', 'A', 'dB', 'deg', 'W'
  visible: boolean;
  yAxisId?: 'left' | 'right';  // for dual-axis (Bode)
}

export type PlotType = 'time' | 'bode' | 'xy' | 'dc-sweep';

export interface WaveformViewerProps {
  traces: WaveformTrace[];
  plotType: PlotType;
  xLabel?: string;
  xUnit?: string;
  yLabel?: string;
  y2Label?: string;
  title?: string;
  onCursorChange?: (x: number, values: Record<string, number>) => void;
  onTraceVisibilityChange?: (traceId: string, visible: boolean) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SVG_WIDTH = 800;
const SVG_HEIGHT = 500;

const MARGIN = { top: 40, right: 60, bottom: 50, left: 70 };
const BODE_MARGIN_RIGHT = 70; // extra space for right Y-axis labels

const TICK_COUNT_TARGET = 8;
const MINOR_TICK_SUBDIVISIONS = 5;
const Y_PADDING_RATIO = 0.10;
const ZOOM_FACTOR = 0.12;
const MIN_DRAG_PX = 4;

// Colors for dark theme (match shadcn zinc-based dark)
const COLOR_BG = '#09090b';          // bg-background (zinc-950)
const COLOR_GRID_MAJOR = '#27272a';  // zinc-800
const COLOR_GRID_MINOR = '#18181b';  // zinc-900
const COLOR_AXIS = '#3f3f46';        // zinc-700
const COLOR_TICK_TEXT = '#a1a1aa';    // zinc-400  (text-muted-foreground)
const COLOR_LABEL_TEXT = '#d4d4d8';   // zinc-300
const COLOR_TITLE_TEXT = '#fafafa';   // zinc-50
const COLOR_CURSOR = '#f4f4f5';      // zinc-100
const COLOR_TOOLTIP_BG = '#18181b';  // zinc-900
const COLOR_TOOLTIP_BORDER = '#3f3f46'; // zinc-700

// ---------------------------------------------------------------------------
// SI prefix formatting — engineering notation
// ---------------------------------------------------------------------------

const SI_PREFIX_TABLE: Array<{ exp: number; symbol: string }> = [
  { exp: 12,  symbol: 'T' },
  { exp: 9,   symbol: 'G' },
  { exp: 6,   symbol: 'M' },
  { exp: 3,   symbol: 'k' },
  { exp: 0,   symbol: '' },
  { exp: -3,  symbol: 'm' },
  { exp: -6,  symbol: '\u03BC' }, // μ
  { exp: -9,  symbol: 'n' },
  { exp: -12, symbol: 'p' },
];

/**
 * Format a number with SI prefix and unit in engineering notation.
 * Examples: 1.5 kHz, 220 mV, 4.7 μF
 */
export function formatEngineering(value: number, unit: string): string {
  if (value === 0) return `0 ${unit}`;
  if (!isFinite(value)) return `${value}`;

  const absVal = Math.abs(value);

  for (const { exp, symbol } of SI_PREFIX_TABLE) {
    const threshold = Math.pow(10, exp);
    // Use 0.9999 multiplier to handle floating-point rounding near boundaries
    if (absVal >= threshold * 0.9999) {
      const scaled = value / threshold;
      const formatted = Number(scaled.toPrecision(4));
      return `${formatted} ${symbol}${unit}`;
    }
  }

  // Below pico — use scientific notation
  return `${value.toExponential(2)} ${unit}`;
}

/**
 * Format a tick label: number scaled by a given divisor, no unit suffix.
 */
function formatTickLabel(value: number, divisor: number): string {
  if (value === 0) return '0';
  const scaled = value / divisor;
  return Number(scaled.toPrecision(4)).toString();
}

/**
 * Pick the best SI prefix divisor for a range of values.
 */
function pickDivisor(maxAbs: number): { symbol: string; divisor: number } {
  if (maxAbs === 0) return { symbol: '', divisor: 1 };
  for (const { exp, symbol } of SI_PREFIX_TABLE) {
    const threshold = Math.pow(10, exp);
    if (maxAbs >= threshold * 0.9999) {
      return { symbol, divisor: threshold };
    }
  }
  return { symbol: 'p', divisor: 1e-12 };
}

// ---------------------------------------------------------------------------
// Nice-numbers tick generation (linear axis)
// ---------------------------------------------------------------------------

function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

interface TickResult {
  major: number[];
  minor: number[];
  niceMin: number;
  niceMax: number;
}

function generateLinearTicks(dataMin: number, dataMax: number, targetCount: number): TickResult {
  if (dataMin === dataMax) {
    const delta = dataMin === 0 ? 1 : Math.abs(dataMin) * 0.1;
    return generateLinearTicks(dataMin - delta, dataMax + delta, targetCount);
  }

  const range = niceNum(dataMax - dataMin, false);
  const tickSpacing = niceNum(range / (targetCount - 1), true);
  const niceMin = Math.floor(dataMin / tickSpacing) * tickSpacing;
  const niceMax = Math.ceil(dataMax / tickSpacing) * tickSpacing;

  const major: number[] = [];
  const count = Math.round((niceMax - niceMin) / tickSpacing) + 1;
  for (let i = 0; i < count; i++) {
    const v = niceMin + i * tickSpacing;
    major.push(parseFloat(v.toPrecision(12)));
  }

  // Minor ticks: subdivide each major interval
  const minor: number[] = [];
  const minorSpacing = tickSpacing / MINOR_TICK_SUBDIVISIONS;
  for (let i = 0; i < count - 1; i++) {
    for (let j = 1; j < MINOR_TICK_SUBDIVISIONS; j++) {
      const v = major[i] + j * minorSpacing;
      if (v > niceMin && v < niceMax) {
        minor.push(parseFloat(v.toPrecision(12)));
      }
    }
  }

  return { major, minor, niceMin, niceMax };
}

// ---------------------------------------------------------------------------
// Logarithmic tick generation (for Bode X-axis — frequency decades)
// ---------------------------------------------------------------------------

interface LogTickResult {
  major: number[];
  minor: number[];
  logMin: number; // log10(min)
  logMax: number; // log10(max)
}

function generateLogTicks(dataMin: number, dataMax: number): LogTickResult {
  // Clamp to positive for log scale
  const clampedMin = Math.max(dataMin, 1e-15);
  const clampedMax = Math.max(dataMax, clampedMin * 10);

  const logMin = Math.floor(Math.log10(clampedMin));
  const logMax = Math.ceil(Math.log10(clampedMax));

  const major: number[] = [];
  const minor: number[] = [];

  for (let decade = logMin; decade <= logMax; decade++) {
    const base = Math.pow(10, decade);
    major.push(base);
    // Minor ticks at 2x, 3x, ... 9x within the decade
    for (let m = 2; m <= 9; m++) {
      const val = base * m;
      if (val >= clampedMin && val <= clampedMax) {
        minor.push(val);
      }
    }
  }

  return { major, minor, logMin, logMax };
}

// ---------------------------------------------------------------------------
// Data bounds computation
// ---------------------------------------------------------------------------

interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function computeBounds(
  traces: WaveformTrace[],
  filterAxisId?: 'left' | 'right',
): Bounds {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (const trace of traces) {
    if (!trace.visible) continue;
    if (filterAxisId !== undefined && (trace.yAxisId ?? 'left') !== filterAxisId) continue;

    for (const pt of trace.data) {
      if (pt.x < xMin) xMin = pt.x;
      if (pt.x > xMax) xMax = pt.x;
      if (pt.y < yMin) yMin = pt.y;
      if (pt.y > yMax) yMax = pt.y;
    }
  }

  if (!isFinite(xMin)) {
    return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  }

  // Add Y padding (10% margin)
  const yPad = (yMax - yMin) * Y_PADDING_RATIO || 0.5;

  return {
    xMin,
    xMax,
    yMin: yMin - yPad,
    yMax: yMax + yPad,
  };
}

// ---------------------------------------------------------------------------
// Binary-search interpolation for cursor snap
// ---------------------------------------------------------------------------

function interpolateAtX(data: Array<{ x: number; y: number }>, xTarget: number): number | null {
  if (data.length === 0) return null;
  if (xTarget <= data[0].x) return data[0].y;
  if (xTarget >= data[data.length - 1].x) return data[data.length - 1].y;

  let lo = 0;
  let hi = data.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (data[mid].x <= xTarget) lo = mid;
    else hi = mid;
  }

  const p0 = data[lo];
  const p1 = data[hi];
  if (p1.x === p0.x) return p0.y;

  const ratio = (xTarget - p0.x) / (p1.x - p0.x);
  return p0.y + ratio * (p1.y - p0.y);
}

// ---------------------------------------------------------------------------
// View state types
// ---------------------------------------------------------------------------

interface ViewBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  y2Min?: number;
  y2Max?: number;
}

interface DragRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// ---------------------------------------------------------------------------
// Plot type default labels
// ---------------------------------------------------------------------------

const PLOT_TYPE_LABELS: Record<PlotType, string> = {
  time: 'Transient Analysis',
  bode: 'Bode Plot',
  xy: 'X-Y Plot',
  'dc-sweep': 'DC Sweep',
};

const PLOT_TYPE_DEFAULT_X_UNIT: Record<PlotType, string> = {
  time: 's',
  bode: 'Hz',
  xy: 'V',
  'dc-sweep': 'V',
};

// ---------------------------------------------------------------------------
// Memoized sub-components
// ---------------------------------------------------------------------------

/** Major grid line */
const MajorGridLine = memo(function MajorGridLine({
  x1, y1, x2, y2,
}: {
  x1: number; y1: number; x2: number; y2: number;
}) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={COLOR_GRID_MAJOR}
      strokeWidth={0.5}
      strokeDasharray="4,4"
      strokeOpacity={0.8}
    />
  );
});

/** Minor grid line */
const MinorGridLine = memo(function MinorGridLine({
  x1, y1, x2, y2,
}: {
  x1: number; y1: number; x2: number; y2: number;
}) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={COLOR_GRID_MINOR}
      strokeWidth={0.5}
      strokeDasharray="2,4"
      strokeOpacity={0.5}
    />
  );
});

/** Trace polyline */
const TraceLine = memo(function TraceLine({
  points,
  color,
  traceId,
}: {
  points: string;
  color: string;
  traceId: string;
}) {
  return (
    <polyline
      data-testid={`trace-line-${traceId}`}
      points={points}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
});

/** Legend item */
const LegendItem = memo(function LegendItem({
  trace,
  onToggle,
}: {
  trace: WaveformTrace;
  onToggle: (id: string) => void;
}) {
  const handleClick = useCallback(() => onToggle(trace.id), [trace.id, onToggle]);

  return (
    <button
      type="button"
      data-testid={`trace-legend-${trace.id}`}
      className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors',
        trace.visible
          ? 'text-foreground/90 hover:bg-white/10'
          : 'text-muted-foreground/50 hover:bg-white/5 line-through',
      )}
      onClick={handleClick}
      title={trace.visible ? `Hide ${trace.label}` : `Show ${trace.label}`}
    >
      <span
        className="inline-block w-3 h-0.5 rounded-full shrink-0"
        style={{ backgroundColor: trace.visible ? trace.color : '#52525b' }}
      />
      <span className="font-mono text-[11px]">{trace.label}</span>
      {trace.visible ? (
        <Eye className="w-3 h-3 text-muted-foreground" />
      ) : (
        <EyeOff className="w-3 h-3 text-muted-foreground/40" />
      )}
    </button>
  );
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function WaveformViewerInner({
  traces,
  plotType,
  xLabel,
  xUnit,
  yLabel,
  y2Label,
  title,
  onCursorChange,
  onTraceVisibilityChange,
}: WaveformViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Local trace visibility state (seeded from prop) ----
  const [localVisibility, setLocalVisibility] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const t of traces) map[t.id] = t.visible;
    return map;
  });

  // Sync when traces prop changes
  useEffect(() => {
    setLocalVisibility((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;
      for (const t of traces) {
        if (prev[t.id] !== undefined) {
          next[t.id] = prev[t.id];
        } else {
          next[t.id] = t.visible;
          changed = true;
        }
      }
      if (Object.keys(prev).length !== Object.keys(next).length) changed = true;
      return changed ? next : prev;
    });
  }, [traces]);

  // Build "effective traces" that merge prop + local visibility
  const effectiveTraces = useMemo(
    () => traces.map((t) => ({ ...t, visible: localVisibility[t.id] ?? t.visible })),
    [traces, localVisibility],
  );

  // ---- Zoom/pan state ----
  const [viewBounds, setViewBounds] = useState<ViewBounds | null>(null);
  const [cursorSvgX, setCursorSvgX] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragRect | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; bounds: ViewBounds } | null>(null);

  // ---- Responsive dimensions via ResizeObserver ----
  const [dimensions, setDimensions] = useState({ width: SVG_WIDTH, height: SVG_HEIGHT });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---- Shift key tracking for pan mode ----
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsPanning(true); };
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsPanning(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // ---- Derived layout ----
  const isBode = plotType === 'bode';
  const isLogX = isBode;

  const margin = useMemo(() => ({
    ...MARGIN,
    right: isBode ? BODE_MARGIN_RIGHT : MARGIN.right,
  }), [isBode]);

  const plotWidth = Math.max(dimensions.width - margin.left - margin.right, 1);
  const plotHeight = Math.max(dimensions.height - margin.top - margin.bottom, 1);

  // ---- Separate left/right axis traces for Bode ----
  const leftTraces = useMemo(
    () => effectiveTraces.filter((t) => (t.yAxisId ?? 'left') === 'left'),
    [effectiveTraces],
  );
  const rightTraces = useMemo(
    () => effectiveTraces.filter((t) => t.yAxisId === 'right'),
    [effectiveTraces],
  );

  // ---- Auto-scale bounds ----
  const autoBounds = useMemo((): ViewBounds => {
    const primary = computeBounds(effectiveTraces, 'left');

    // For X bounds, include all visible traces (not just left-axis)
    const allBounds = computeBounds(effectiveTraces);

    const result: ViewBounds = {
      xMin: allBounds.xMin,
      xMax: allBounds.xMax,
      yMin: primary.yMin,
      yMax: primary.yMax,
    };

    if (isBode && rightTraces.length > 0) {
      const secondary = computeBounds(effectiveTraces, 'right');
      result.y2Min = secondary.yMin;
      result.y2Max = secondary.yMax;
    }

    return result;
  }, [effectiveTraces, isBode, rightTraces.length]);

  const bounds = viewBounds ?? autoBounds;

  // ---- Tick generation ----
  const xTickData = useMemo(() => {
    if (isLogX) {
      return generateLogTicks(
        Math.max(bounds.xMin, 1e-15),
        Math.max(bounds.xMax, 1e-14),
      );
    }
    return null;
  }, [isLogX, bounds.xMin, bounds.xMax]);

  const xLinearTicks = useMemo(() => {
    if (isLogX) return null;
    return generateLinearTicks(bounds.xMin, bounds.xMax, TICK_COUNT_TARGET);
  }, [isLogX, bounds.xMin, bounds.xMax]);

  const yTicks = useMemo(
    () => generateLinearTicks(bounds.yMin, bounds.yMax, TICK_COUNT_TARGET),
    [bounds.yMin, bounds.yMax],
  );

  const y2Ticks = useMemo(() => {
    if (!isBode || bounds.y2Min === undefined || bounds.y2Max === undefined) return null;
    return generateLinearTicks(bounds.y2Min, bounds.y2Max, TICK_COUNT_TARGET);
  }, [isBode, bounds.y2Min, bounds.y2Max]);

  // ---- SI prefix for axis labels ----
  const resolvedXUnit = xUnit ?? PLOT_TYPE_DEFAULT_X_UNIT[plotType];

  const xSI = useMemo(() => {
    if (isLogX) return { symbol: '', divisor: 1 }; // log axis: label with Hz directly
    const maxAbs = Math.max(Math.abs(bounds.xMin), Math.abs(bounds.xMax));
    return pickDivisor(maxAbs);
  }, [isLogX, bounds.xMin, bounds.xMax]);

  const ySI = useMemo(() => {
    const maxAbs = Math.max(Math.abs(bounds.yMin), Math.abs(bounds.yMax));
    return pickDivisor(maxAbs);
  }, [bounds.yMin, bounds.yMax]);

  const y2SI = useMemo(() => {
    if (bounds.y2Min === undefined || bounds.y2Max === undefined) return { symbol: '', divisor: 1 };
    const maxAbs = Math.max(Math.abs(bounds.y2Min), Math.abs(bounds.y2Max));
    return pickDivisor(maxAbs);
  }, [bounds.y2Min, bounds.y2Max]);

  // ---- Coordinate transforms ----
  const dataToSvgX = useCallback(
    (dataX: number) => {
      if (isLogX) {
        if (!xTickData) return margin.left;
        const logVal = Math.log10(Math.max(dataX, 1e-15));
        const ratio = (logVal - xTickData.logMin) / (xTickData.logMax - xTickData.logMin);
        return margin.left + ratio * plotWidth;
      }
      return margin.left + ((dataX - bounds.xMin) / (bounds.xMax - bounds.xMin || 1)) * plotWidth;
    },
    [isLogX, bounds.xMin, bounds.xMax, plotWidth, margin.left, xTickData],
  );

  const dataToSvgY = useCallback(
    (dataY: number) =>
      margin.top + plotHeight - ((dataY - bounds.yMin) / (bounds.yMax - bounds.yMin || 1)) * plotHeight,
    [bounds.yMin, bounds.yMax, plotHeight, margin.top],
  );

  const dataToSvgY2 = useCallback(
    (dataY: number) => {
      const y2Min = bounds.y2Min ?? 0;
      const y2Max = bounds.y2Max ?? 1;
      return margin.top + plotHeight - ((dataY - y2Min) / (y2Max - y2Min || 1)) * plotHeight;
    },
    [bounds.y2Min, bounds.y2Max, plotHeight, margin.top],
  );

  const svgXToData = useCallback(
    (svgX: number) => {
      const ratio = (svgX - margin.left) / plotWidth;
      if (isLogX && xTickData) {
        const logVal = xTickData.logMin + ratio * (xTickData.logMax - xTickData.logMin);
        return Math.pow(10, logVal);
      }
      return bounds.xMin + ratio * (bounds.xMax - bounds.xMin);
    },
    [isLogX, bounds.xMin, bounds.xMax, plotWidth, margin.left, xTickData],
  );

  const svgYToData = useCallback(
    (svgY: number) =>
      bounds.yMax - ((svgY - margin.top) / plotHeight) * (bounds.yMax - bounds.yMin),
    [bounds.yMin, bounds.yMax, plotHeight, margin.top],
  );

  // ---- Build polyline points string ----
  const buildPolylinePoints = useCallback(
    (trace: WaveformTrace, useY2: boolean): string => {
      const toY = useY2 ? dataToSvgY2 : dataToSvgY;
      const parts: string[] = [];
      for (const pt of trace.data) {
        const sx = dataToSvgX(pt.x);
        const sy = toY(pt.y);
        // Skip NaN/Infinity (can occur with log of zero)
        if (isFinite(sx) && isFinite(sy)) {
          parts.push(`${sx},${sy}`);
        }
      }
      return parts.join(' ');
    },
    [dataToSvgX, dataToSvgY, dataToSvgY2],
  );

  // ---- Cursor readout computation ----
  const cursorData = useMemo(() => {
    if (cursorSvgX === null) return null;
    const dataX = svgXToData(cursorSvgX);

    const readings: Array<{
      traceId: string;
      label: string;
      color: string;
      yValue: number;
      unit: string;
      svgY: number;
    }> = [];

    for (const trace of effectiveTraces) {
      if (!trace.visible) continue;
      const yVal = interpolateAtX(trace.data, dataX);
      if (yVal === null) continue;

      const isRight = trace.yAxisId === 'right';
      const sy = isRight ? dataToSvgY2(yVal) : dataToSvgY(yVal);

      readings.push({
        traceId: trace.id,
        label: trace.label,
        color: trace.color,
        yValue: yVal,
        unit: trace.unit,
        svgY: sy,
      });
    }

    return { dataX, svgX: cursorSvgX, readings };
  }, [cursorSvgX, svgXToData, effectiveTraces, dataToSvgY, dataToSvgY2]);

  // Fire onCursorChange callback
  useEffect(() => {
    if (!onCursorChange || !cursorData) return;
    const values: Record<string, number> = {};
    for (const r of cursorData.readings) {
      values[r.traceId] = r.yValue;
    }
    onCursorChange(cursorData.dataX, values);
  }, [cursorData, onCursorChange]);

  // ---- Mouse interaction helpers ----
  const getSvgPoint = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      // Scale from DOM coords to SVG viewBox coords
      const scaleX = SVG_WIDTH / rect.width;
      const scaleY = SVG_HEIGHT / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const isInsidePlot = useCallback(
    (svgX: number, svgY: number) =>
      svgX >= margin.left &&
      svgX <= margin.left + plotWidth &&
      svgY >= margin.top &&
      svgY <= margin.top + plotHeight,
    [margin, plotWidth, plotHeight],
  );

  // ---- Mouse handlers ----
  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      const pt = getSvgPoint(e);

      if (isInsidePlot(pt.x, pt.y)) {
        setCursorSvgX(pt.x);
      } else {
        setCursorSvgX(null);
      }

      if (drag) {
        if (isPanning && panStartRef.current) {
          const dx = pt.x - panStartRef.current.x;
          const dy = pt.y - panStartRef.current.y;
          const sb = panStartRef.current.bounds;

          if (isLogX && xTickData) {
            const logPerPx = (xTickData.logMax - xTickData.logMin) / plotWidth;
            const dataPerPxY = (sb.yMax - sb.yMin) / plotHeight;
            const logShift = -dx * logPerPx;

            setViewBounds({
              ...sb,
              xMin: Math.pow(10, Math.log10(Math.max(sb.xMin, 1e-15)) + logShift),
              xMax: Math.pow(10, Math.log10(Math.max(sb.xMax, 1e-14)) + logShift),
              yMin: sb.yMin + dy * dataPerPxY,
              yMax: sb.yMax + dy * dataPerPxY,
            });
          } else {
            const dataPerPxX = (sb.xMax - sb.xMin) / plotWidth;
            const dataPerPxY = (sb.yMax - sb.yMin) / plotHeight;
            setViewBounds({
              ...sb,
              xMin: sb.xMin - dx * dataPerPxX,
              xMax: sb.xMax - dx * dataPerPxX,
              yMin: sb.yMin + dy * dataPerPxY,
              yMax: sb.yMax + dy * dataPerPxY,
            });
          }
        } else {
          setDrag((prev) => prev ? { ...prev, currentX: pt.x, currentY: pt.y } : null);
        }
      }
    },
    [drag, getSvgPoint, isInsidePlot, isPanning, plotWidth, plotHeight, isLogX, xTickData],
  );

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      const pt = getSvgPoint(e);
      if (!isInsidePlot(pt.x, pt.y)) return;

      if (isPanning) {
        panStartRef.current = { x: pt.x, y: pt.y, bounds: { ...bounds } };
      }
      setDrag({ startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y });
    },
    [getSvgPoint, isInsidePlot, isPanning, bounds],
  );

  const handleMouseUp = useCallback(
    () => {
      if (drag && !isPanning) {
        const dx = Math.abs(drag.currentX - drag.startX);
        const dy = Math.abs(drag.currentY - drag.startY);

        if (dx > MIN_DRAG_PX && dy > MIN_DRAG_PX) {
          const left = Math.min(drag.startX, drag.currentX);
          const right = Math.max(drag.startX, drag.currentX);
          const top = Math.min(drag.startY, drag.currentY);
          const bottom = Math.max(drag.startY, drag.currentY);

          const newXMin = svgXToData(left);
          const newXMax = svgXToData(right);
          const newYMax = svgYToData(top);
          const newYMin = svgYToData(bottom);

          setViewBounds((prev) => ({
            xMin: newXMin,
            xMax: newXMax,
            yMin: newYMin,
            yMax: newYMax,
            y2Min: prev?.y2Min ?? bounds.y2Min,
            y2Max: prev?.y2Max ?? bounds.y2Max,
          }));
        }
      }
      setDrag(null);
      panStartRef.current = null;
    },
    [drag, isPanning, svgXToData, svgYToData, bounds.y2Min, bounds.y2Max],
  );

  const handleMouseLeave = useCallback(() => {
    setCursorSvgX(null);
    if (drag) {
      setDrag(null);
      panStartRef.current = null;
    }
  }, [drag]);

  const handleWheel = useCallback(
    (e: ReactWheelEvent<SVGSVGElement>) => {
      const pt = getSvgPoint(e as unknown as ReactMouseEvent<SVGSVGElement>);
      if (!isInsidePlot(pt.x, pt.y)) return;
      e.preventDefault();

      const direction = e.deltaY > 0 ? 1 : -1;
      const factor = 1 + ZOOM_FACTOR * direction;
      const current = viewBounds ?? autoBounds;

      if (isLogX && xTickData) {
        // Zoom in log-space
        const logX = xTickData.logMin + ((pt.x - margin.left) / plotWidth) * (xTickData.logMax - xTickData.logMin);
        const logMin = Math.log10(Math.max(current.xMin, 1e-15));
        const logMax = Math.log10(Math.max(current.xMax, 1e-14));

        const newLogMin = logX - (logX - logMin) * factor;
        const newLogMax = logX + (logMax - logX) * factor;

        const dataY = svgYToData(pt.y);
        setViewBounds({
          xMin: Math.pow(10, newLogMin),
          xMax: Math.pow(10, newLogMax),
          yMin: dataY - (dataY - current.yMin) * factor,
          yMax: dataY + (current.yMax - dataY) * factor,
          y2Min: current.y2Min,
          y2Max: current.y2Max,
        });
      } else {
        const dataX = svgXToData(pt.x);
        const dataY = svgYToData(pt.y);
        setViewBounds({
          xMin: dataX - (dataX - current.xMin) * factor,
          xMax: dataX + (current.xMax - dataX) * factor,
          yMin: dataY - (dataY - current.yMin) * factor,
          yMax: dataY + (current.yMax - dataY) * factor,
          y2Min: current.y2Min,
          y2Max: current.y2Max,
        });
      }
    },
    [getSvgPoint, isInsidePlot, viewBounds, autoBounds, svgXToData, svgYToData, isLogX, xTickData, plotWidth, margin.left],
  );

  const handleDoubleClick = useCallback(() => {
    setViewBounds(null);
  }, []);

  // ---- Visibility toggle ----
  const toggleVisibility = useCallback(
    (traceId: string) => {
      setLocalVisibility((prev) => {
        const next = { ...prev, [traceId]: !prev[traceId] };
        onTraceVisibilityChange?.(traceId, next[traceId]);
        return next;
      });
    },
    [onTraceVisibilityChange],
  );

  const resetZoom = useCallback(() => setViewBounds(null), []);

  // ---- Export handlers ----
  const handleExportSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const svgString = serializeSvg(svg);
    downloadSvg(svgString, `${title ?? 'waveform'}.svg`);
  }, [title]);

  const handleExportPng = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    const svgString = serializeSvg(svg);
    const pngBlob = await rasterizeSvgToPng(svgString, {
      scale: 2,
      background: COLOR_BG,
    });
    downloadPng(pngBlob, `${title ?? 'waveform'}.png`);
  }, [title]);

  // ---- Computed axis label strings ----
  const xAxisLabelText = useMemo(() => {
    if (xLabel) return xLabel;
    if (isLogX) return `Frequency (${resolvedXUnit})`;
    if (xSI.symbol) return `${xSI.symbol}${resolvedXUnit}`;
    return resolvedXUnit;
  }, [xLabel, isLogX, resolvedXUnit, xSI.symbol]);

  const yAxisLabelText = useMemo(() => {
    if (yLabel) return yLabel;
    if (leftTraces.length === 0) return '';
    const unit = leftTraces[0].unit;
    if (ySI.symbol) return `${ySI.symbol}${unit}`;
    return unit;
  }, [yLabel, leftTraces, ySI.symbol]);

  const y2AxisLabelText = useMemo(() => {
    if (y2Label) return y2Label;
    if (!isBode || rightTraces.length === 0) return '';
    const unit = rightTraces[0].unit;
    if (y2SI.symbol) return `${y2SI.symbol}${unit}`;
    return unit;
  }, [y2Label, isBode, rightTraces, y2SI.symbol]);

  // ---- Unique clip-path ID (avoid collisions if multiple viewers on page) ----
  const clipId = useMemo(() => `wfv-clip-${Math.random().toString(36).slice(2, 8)}`, []);

  // ---- Precompute polyline points for all visible traces ----
  const tracePolylines = useMemo(() => {
    const result: Array<{ id: string; points: string; color: string }> = [];
    for (const trace of effectiveTraces) {
      if (!trace.visible || trace.data.length === 0) continue;
      const useY2 = trace.yAxisId === 'right';
      result.push({
        id: trace.id,
        points: buildPolylinePoints(trace, useY2),
        color: trace.color,
      });
    }
    return result;
  }, [effectiveTraces, buildPolylinePoints]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      data-testid="waveform-viewer"
      className="flex flex-col h-full w-full bg-background/80 backdrop-blur select-none"
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/40 backdrop-blur shrink-0"
        data-testid="waveform-titlebar"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {PLOT_TYPE_LABELS[plotType]}
          </span>
          {title && (
            <span className="text-sm font-medium text-foreground/90">{title}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {viewBounds && (
            <button
              type="button"
              data-testid="reset-zoom"
              onClick={resetZoom}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors rounded"
              title="Reset zoom (double-click plot)"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
          <button
            type="button"
            data-testid="export-svg"
            onClick={handleExportSvg}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors rounded"
            title="Export as SVG"
          >
            <Download className="w-3 h-3" />
            SVG
          </button>
          <button
            type="button"
            data-testid="export-png"
            onClick={handleExportPng}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors rounded"
            title="Export as PNG"
          >
            <Image className="w-3 h-3" />
            PNG
          </button>
        </div>
      </div>

      {/* Plot area */}
      <div
        ref={containerRef}
        data-testid="waveform-plot-area"
        className="flex-1 min-h-0 relative"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full h-full"
          data-testid="waveform-svg"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: isPanning ? 'grab' : 'crosshair' }}
        >
          {/* Background */}
          <rect x={0} y={0} width={SVG_WIDTH} height={SVG_HEIGHT} fill={COLOR_BG} />

          {/* Clip path for plot region */}
          <defs>
            <clipPath id={clipId}>
              <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} />
            </clipPath>
          </defs>

          {/* ---- Grid: Minor lines ---- */}
          {/* Minor X grid */}
          {isLogX && xTickData
            ? xTickData.minor.map((val, idx) => {
                const sx = dataToSvgX(val);
                if (sx < margin.left || sx > margin.left + plotWidth) return null;
                return (
                  <MinorGridLine
                    key={`xminor-${idx}`}
                    x1={sx} y1={margin.top} x2={sx} y2={margin.top + plotHeight}
                  />
                );
              })
            : xLinearTicks?.minor.map((val, idx) => {
                const sx = dataToSvgX(val);
                if (sx < margin.left || sx > margin.left + plotWidth) return null;
                return (
                  <MinorGridLine
                    key={`xminor-${idx}`}
                    x1={sx} y1={margin.top} x2={sx} y2={margin.top + plotHeight}
                  />
                );
              })
          }

          {/* Minor Y grid */}
          {yTicks.minor.map((val, idx) => {
            const sy = dataToSvgY(val);
            if (sy < margin.top || sy > margin.top + plotHeight) return null;
            return (
              <MinorGridLine
                key={`yminor-${idx}`}
                x1={margin.left} y1={sy} x2={margin.left + plotWidth} y2={sy}
              />
            );
          })}

          {/* ---- Grid: Major lines ---- */}
          {/* Major X grid */}
          {isLogX && xTickData
            ? xTickData.major.map((val, idx) => {
                const sx = dataToSvgX(val);
                if (sx < margin.left || sx > margin.left + plotWidth) return null;
                return (
                  <MajorGridLine
                    key={`xmaj-${idx}`}
                    x1={sx} y1={margin.top} x2={sx} y2={margin.top + plotHeight}
                  />
                );
              })
            : xLinearTicks?.major.map((val, idx) => {
                const sx = dataToSvgX(val);
                if (sx < margin.left || sx > margin.left + plotWidth) return null;
                return (
                  <MajorGridLine
                    key={`xmaj-${idx}`}
                    x1={sx} y1={margin.top} x2={sx} y2={margin.top + plotHeight}
                  />
                );
              })
          }

          {/* Major Y grid */}
          {yTicks.major.map((val, idx) => {
            const sy = dataToSvgY(val);
            if (sy < margin.top || sy > margin.top + plotHeight) return null;
            return (
              <MajorGridLine
                key={`ymaj-${idx}`}
                x1={margin.left} y1={sy} x2={margin.left + plotWidth} y2={sy}
              />
            );
          })}

          {/* Plot border */}
          <rect
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
            fill="none"
            stroke={COLOR_AXIS}
            strokeWidth={1}
          />

          {/* ---- X-axis ticks + labels ---- */}
          {isLogX && xTickData
            ? xTickData.major.map((val, idx) => {
                const sx = dataToSvgX(val);
                if (sx < margin.left - 1 || sx > margin.left + plotWidth + 1) return null;
                // Log tick label: e.g. "1k", "10M"
                const label = formatEngineering(val, '').trim();
                return (
                  <g key={`xtick-${idx}`}>
                    <line
                      x1={sx} y1={margin.top + plotHeight}
                      x2={sx} y2={margin.top + plotHeight + 5}
                      stroke={COLOR_AXIS} strokeWidth={1}
                    />
                    <text
                      x={sx} y={margin.top + plotHeight + 18}
                      textAnchor="middle"
                      fill={COLOR_TICK_TEXT} fontSize={10} fontFamily="monospace"
                    >
                      {label}
                    </text>
                  </g>
                );
              })
            : xLinearTicks?.major.map((val, idx) => {
                const sx = dataToSvgX(val);
                if (sx < margin.left - 1 || sx > margin.left + plotWidth + 1) return null;
                return (
                  <g key={`xtick-${idx}`}>
                    <line
                      x1={sx} y1={margin.top + plotHeight}
                      x2={sx} y2={margin.top + plotHeight + 5}
                      stroke={COLOR_AXIS} strokeWidth={1}
                    />
                    <text
                      x={sx} y={margin.top + plotHeight + 18}
                      textAnchor="middle"
                      fill={COLOR_TICK_TEXT} fontSize={10} fontFamily="monospace"
                    >
                      {formatTickLabel(val, xSI.divisor)}
                    </text>
                  </g>
                );
              })
          }

          {/* X-axis label */}
          <text
            x={margin.left + plotWidth / 2}
            y={SVG_HEIGHT - 6}
            textAnchor="middle"
            fill={COLOR_LABEL_TEXT}
            fontSize={12}
            fontFamily="monospace"
            data-testid="x-axis-label"
          >
            {xAxisLabelText}
          </text>

          {/* ---- Y-axis (left) ticks + labels ---- */}
          {yTicks.major.map((val, idx) => {
            const sy = dataToSvgY(val);
            if (sy < margin.top - 1 || sy > margin.top + plotHeight + 1) return null;
            return (
              <g key={`ytick-${idx}`}>
                <line
                  x1={margin.left - 5} y1={sy}
                  x2={margin.left} y2={sy}
                  stroke={COLOR_AXIS} strokeWidth={1}
                />
                <text
                  x={margin.left - 8} y={sy + 3}
                  textAnchor="end"
                  fill={COLOR_TICK_TEXT} fontSize={10} fontFamily="monospace"
                >
                  {formatTickLabel(val, ySI.divisor)}
                </text>
              </g>
            );
          })}

          {/* Y-axis label (left, rotated) */}
          <text
            x={16}
            y={margin.top + plotHeight / 2}
            textAnchor="middle"
            fill={COLOR_LABEL_TEXT}
            fontSize={12}
            fontFamily="monospace"
            transform={`rotate(-90, 16, ${margin.top + plotHeight / 2})`}
            data-testid="y-axis-label"
          >
            {yAxisLabelText}
          </text>

          {/* ---- Y2-axis (right, Bode phase) ticks + labels ---- */}
          {isBode && y2Ticks && (
            <>
              {y2Ticks.major.map((val, idx) => {
                const sy = dataToSvgY2(val);
                if (sy < margin.top - 1 || sy > margin.top + plotHeight + 1) return null;
                return (
                  <g key={`y2tick-${idx}`}>
                    <line
                      x1={margin.left + plotWidth} y1={sy}
                      x2={margin.left + plotWidth + 5} y2={sy}
                      stroke={COLOR_AXIS} strokeWidth={1}
                    />
                    <text
                      x={margin.left + plotWidth + 8} y={sy + 3}
                      textAnchor="start"
                      fill={COLOR_TICK_TEXT} fontSize={10} fontFamily="monospace"
                    >
                      {formatTickLabel(val, y2SI.divisor)}
                    </text>
                  </g>
                );
              })}
              {/* Y2-axis label (right, rotated) */}
              <text
                x={SVG_WIDTH - 10}
                y={margin.top + plotHeight / 2}
                textAnchor="middle"
                fill={COLOR_LABEL_TEXT}
                fontSize={12}
                fontFamily="monospace"
                transform={`rotate(90, ${SVG_WIDTH - 10}, ${margin.top + plotHeight / 2})`}
                data-testid="y2-axis-label"
              >
                {y2AxisLabelText}
              </text>
            </>
          )}

          {/* ---- Title ---- */}
          {title && (
            <text
              x={SVG_WIDTH / 2}
              y={22}
              textAnchor="middle"
              fill={COLOR_TITLE_TEXT}
              fontSize={14}
              fontWeight="600"
              fontFamily="system-ui, sans-serif"
              data-testid="plot-title"
            >
              {title}
            </text>
          )}

          {/* ---- Traces (clipped to plot area) ---- */}
          <g clipPath={`url(#${clipId})`}>
            {tracePolylines.map((tp) => (
              <TraceLine key={tp.id} traceId={tp.id} points={tp.points} color={tp.color} />
            ))}
          </g>

          {/* ---- Cursor crosshair ---- */}
          {cursorData && (
            <g data-testid="cursor-crosshair" pointerEvents="none">
              {/* Vertical line */}
              <line
                x1={cursorData.svgX} y1={margin.top}
                x2={cursorData.svgX} y2={margin.top + plotHeight}
                stroke={COLOR_CURSOR}
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="4,4"
              />

              {/* Dots on each trace */}
              {cursorData.readings.map((r) => (
                <circle
                  key={`cdot-${r.traceId}`}
                  cx={cursorData.svgX}
                  cy={r.svgY}
                  r={3.5}
                  fill={r.color}
                  stroke={COLOR_BG}
                  strokeWidth={1.5}
                />
              ))}
            </g>
          )}

          {/* ---- Cursor readout tooltip ---- */}
          {cursorData && cursorData.readings.length > 0 && (
            <g data-testid="cursor-readout" pointerEvents="none">
              {(() => {
                const tooltipW = 170;
                const lineH = 15;
                const pad = 8;
                const headerH = lineH + 2;
                const contentH = headerH + cursorData.readings.length * lineH + pad * 2;

                // Position: prefer right of cursor, flip if near right edge
                let tx = cursorData.svgX + 14;
                if (tx + tooltipW > margin.left + plotWidth) {
                  tx = cursorData.svgX - tooltipW - 14;
                }
                const ty = margin.top + 8;

                return (
                  <>
                    <rect
                      x={tx} y={ty}
                      width={tooltipW} height={contentH}
                      rx={4}
                      fill={COLOR_TOOLTIP_BG}
                      fillOpacity={0.94}
                      stroke={COLOR_TOOLTIP_BORDER}
                      strokeWidth={1}
                    />
                    {/* X value header */}
                    <text
                      x={tx + pad} y={ty + pad + 11}
                      fill={COLOR_TITLE_TEXT}
                      fontSize={10}
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      x = {formatEngineering(cursorData.dataX, resolvedXUnit)}
                    </text>
                    {/* Per-trace readings */}
                    {cursorData.readings.map((r, idx) => (
                      <g key={`rd-${r.traceId}`}>
                        <rect
                          x={tx + pad}
                          y={ty + pad + headerH + idx * lineH}
                          width={8} height={8} rx={1}
                          fill={r.color}
                        />
                        <text
                          x={tx + pad + 12}
                          y={ty + pad + headerH + idx * lineH + 9}
                          fill={COLOR_TICK_TEXT}
                          fontSize={9}
                          fontFamily="monospace"
                        >
                          {r.label}: {formatEngineering(r.yValue, r.unit)}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </g>
          )}

          {/* ---- Zoom selection rectangle ---- */}
          {drag && !isPanning && (() => {
            const dx = Math.abs(drag.currentX - drag.startX);
            const dy = Math.abs(drag.currentY - drag.startY);
            if (dx <= MIN_DRAG_PX || dy <= MIN_DRAG_PX) return null;
            return (
              <rect
                x={Math.min(drag.startX, drag.currentX)}
                y={Math.min(drag.startY, drag.currentY)}
                width={dx}
                height={dy}
                fill="#3b82f6"
                fillOpacity={0.1}
                stroke="#3b82f6"
                strokeWidth={1}
                strokeDasharray="4,4"
                pointerEvents="none"
              />
            );
          })()}
        </svg>

        {/* Zoom indicator badge */}
        {viewBounds && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 border border-border rounded text-[10px] text-muted-foreground"
            data-testid="zoom-indicator"
          >
            <ZoomIn className="w-3 h-3" />
            Zoomed
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-t border-border/50 bg-card/40 backdrop-blur shrink-0 flex-wrap"
        data-testid="waveform-legend"
      >
        {effectiveTraces.map((trace) => (
          <LegendItem key={trace.id} trace={trace} onToggle={toggleVisibility} />
        ))}
        {effectiveTraces.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No traces</span>
        )}
      </div>
    </div>
  );
}

const WaveformViewer = memo(WaveformViewerInner);
export default WaveformViewer;
