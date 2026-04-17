import { useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatFrequency } from '@/lib/simulation/frequency-analysis';
import type { FrequencyPoint } from '@/lib/simulation/frequency-analysis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BodePlotProps {
  /** Array of frequency-domain data points */
  data: FrequencyPoint[];
  /** Optional chart title */
  title?: string;
  /** Optional CSS class for the container */
  className?: string;
  /** Optional -3 dB cutoff frequency to mark on the plot */
  cutoffFrequencyHz?: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_MAGNITUDE = 'var(--color-editor-accent)'; // Neon cyan (project primary)
const COLOR_PHASE = '#F472B6';     // Pink-400
const COLOR_GRID = '#27272a';      // Zinc-800
const COLOR_AXIS = '#a1a1aa';      // Zinc-400
const COLOR_CUTOFF = '#FBBF24';    // Amber-400
const COLOR_TOOLTIP_BG = '#18181b';
const COLOR_TOOLTIP_BORDER = '#3f3f46';

const CHART_HEIGHT = 250;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a log-scale tick label for the X axis (frequency).
 * Shows values like "1", "10", "100", "1k", "10k", "100k", "1M", "10M".
 */
function formatLogTick(value: number): string {
  if (value >= 1e9) {
    return `${value / 1e9}G`;
  }
  if (value >= 1e6) {
    return `${value / 1e6}M`;
  }
  if (value >= 1e3) {
    return `${value / 1e3}k`;
  }
  return String(value);
}

/**
 * Generate logarithmic tick values from data range.
 * Returns decade values (1, 10, 100, ...) within the data range.
 */
function generateLogTicks(data: FrequencyPoint[]): number[] {
  if (data.length === 0) {
    return [];
  }

  const fMin = data[0].frequency;
  const fMax = data[data.length - 1].frequency;

  const logMin = Math.floor(Math.log10(fMin));
  const logMax = Math.ceil(Math.log10(fMax));

  const ticks: number[] = [];
  for (let exp = logMin; exp <= logMax; exp++) {
    const val = Math.pow(10, exp);
    if (val >= fMin * 0.9 && val <= fMax * 1.1) {
      ticks.push(val);
    }
  }

  return ticks;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
}

function BodeTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || label === undefined) {
    return null;
  }

  return (
    <div
      className="text-xs border shadow-xl px-3 py-2"
      style={{
        backgroundColor: COLOR_TOOLTIP_BG,
        borderColor: COLOR_TOOLTIP_BORDER,
      }}
      data-testid="bode-tooltip"
    >
      <div className="font-medium text-foreground mb-1">
        {formatFrequency(label)}
      </div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {entry.dataKey === 'magnitudeDb' ? 'Magnitude' : 'Phase'}:
          </span>
          <span className="font-mono text-foreground">
            {entry.value.toFixed(2)}
            {entry.dataKey === 'magnitudeDb' ? ' dB' : '\u00B0'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BodePlot component
// ---------------------------------------------------------------------------

export default function BodePlot({
  data,
  title,
  className,
  cutoffFrequencyHz,
}: BodePlotProps) {
  // Prepare log-scale data: recharts LineChart uses a linear scale by default,
  // so we map frequency to log10(frequency) for uniform spacing and use
  // custom tick formatters to display the original Hz values.
  const chartData = useMemo(
    () =>
      data.map((pt) => ({
        logFreq: Math.log10(pt.frequency),
        frequency: pt.frequency,
        magnitudeDb: pt.magnitudeDb,
        phaseDegrees: pt.phaseDegrees,
      })),
    [data],
  );

  const logTicks = useMemo(() => {
    const raw = generateLogTicks(data);
    return raw.map((f) => Math.log10(f));
  }, [data]);

  const logTickFormatter = useCallback(
    (logVal: number) => formatLogTick(Math.pow(10, logVal)),
    [],
  );

  // Compute Y-axis domains
  const magnitudeDomain = useMemo((): [number, number] => {
    if (data.length === 0) {
      return [-60, 10];
    }
    const mags = data.map((d) => d.magnitudeDb);
    const min = Math.floor(Math.min(...mags) / 10) * 10 - 10;
    const max = Math.ceil(Math.max(...mags) / 10) * 10 + 10;
    return [min, max];
  }, [data]);

  const phaseDomain: [number, number] = [-180, 180];

  // Log-scale cutoff marker
  const cutoffLogFreq = cutoffFrequencyHz != null && cutoffFrequencyHz > 0
    ? Math.log10(cutoffFrequencyHz)
    : null;

  if (data.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center h-[300px] text-muted-foreground text-sm', className)}
        data-testid="bode-plot-empty"
      >
        No frequency data to display. Run an analysis first.
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="bode-plot">
      {title && (
        <h3
          className="text-sm font-semibold text-foreground px-1"
          data-testid="bode-plot-title"
        >
          {title}
        </h3>
      )}

      {/* Magnitude plot */}
      <div data-testid="bode-magnitude-chart">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1">
          Magnitude (dB)
        </div>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
          >
            <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" />
            <XAxis
              dataKey="logFreq"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={logTicks}
              tickFormatter={logTickFormatter}
              stroke={COLOR_AXIS}
              tick={{ fontSize: 10 }}
              label={{
                value: 'Frequency (Hz)',
                position: 'insideBottom',
                offset: -10,
                fontSize: 10,
                fill: COLOR_AXIS,
              }}
            />
            <YAxis
              domain={magnitudeDomain}
              stroke={COLOR_AXIS}
              tick={{ fontSize: 10 }}
              label={{
                value: 'dB',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fontSize: 10,
                fill: COLOR_AXIS,
              }}
            />
            <Tooltip content={<BodeTooltip />} />
            <Line
              type="monotone"
              dataKey="magnitudeDb"
              stroke={COLOR_MAGNITUDE}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: COLOR_MAGNITUDE }}
              isAnimationActive={false}
            />
            {/* -3 dB reference line */}
            {cutoffLogFreq !== null && (
              <ReferenceLine
                x={cutoffLogFreq}
                stroke={COLOR_CUTOFF}
                strokeDasharray="6 3"
                label={{
                  value: '-3 dB',
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: COLOR_CUTOFF,
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Phase plot */}
      <div data-testid="bode-phase-chart">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1">
          Phase (degrees)
        </div>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
          >
            <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" />
            <XAxis
              dataKey="logFreq"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={logTicks}
              tickFormatter={logTickFormatter}
              stroke={COLOR_AXIS}
              tick={{ fontSize: 10 }}
              label={{
                value: 'Frequency (Hz)',
                position: 'insideBottom',
                offset: -10,
                fontSize: 10,
                fill: COLOR_AXIS,
              }}
            />
            <YAxis
              domain={phaseDomain}
              ticks={[-180, -135, -90, -45, 0, 45, 90, 135, 180]}
              stroke={COLOR_AXIS}
              tick={{ fontSize: 10 }}
              label={{
                value: 'deg',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fontSize: 10,
                fill: COLOR_AXIS,
              }}
            />
            <Tooltip content={<BodeTooltip />} />
            <Line
              type="monotone"
              dataKey="phaseDegrees"
              stroke={COLOR_PHASE}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: COLOR_PHASE }}
              isAnimationActive={false}
            />
            {/* Cutoff frequency marker on phase plot too */}
            {cutoffLogFreq !== null && (
              <ReferenceLine
                x={cutoffLogFreq}
                stroke={COLOR_CUTOFF}
                strokeDasharray="6 3"
              />
            )}
            {/* -90 degree reference for first-order, -180 for second-order */}
            <ReferenceLine
              y={-90}
              stroke={COLOR_GRID}
              strokeDasharray="4 4"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
