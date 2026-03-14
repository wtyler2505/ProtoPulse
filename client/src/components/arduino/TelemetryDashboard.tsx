/**
 * TelemetryDashboard — Multi-channel telemetry visualization for the Serial
 * Monitor. Renders sparklines with auto-scaling Y axis, current/min/max/avg
 * stats, and pause/resume/clear controls.
 *
 * Consumes data from TelemetryStore via useSyncExternalStore.
 */

import { useRef, useCallback, useSyncExternalStore } from 'react';
import type { TelemetryChannel, TelemetryDataPoint } from '@/lib/arduino/telemetry-parser';
import { TelemetryStore } from '@/lib/arduino/telemetry-parser';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Pause,
  Play,
  Trash2,
  Activity,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Sparkline SVG component
// ---------------------------------------------------------------------------

interface SparklineProps {
  data: TelemetryDataPoint[];
  color: string;
  width: number;
  height: number;
}

function Sparkline({ data, color, width, height }: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg
        data-testid="sparkline-empty"
        width={width}
        height={height}
        className="block"
        role="img"
        aria-label="No data for sparkline"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeOpacity={0.3}
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      </svg>
    );
  }

  // Compute Y range with a small padding
  let minVal = data[0].value;
  let maxVal = data[0].value;
  for (let i = 1; i < data.length; i++) {
    const v = data[i].value;
    if (v < minVal) {
      minVal = v;
    }
    if (v > maxVal) {
      maxVal = v;
    }
  }

  const range = maxVal - minVal;
  const padding = range === 0 ? 1 : range * 0.1;
  const yMin = minVal - padding;
  const yMax = maxVal + padding;
  const yRange = yMax - yMin;

  const xStep = width / (data.length - 1);

  const points = data.map((pt, i) => {
    const x = i * xStep;
    const y = height - ((pt.value - yMin) / yRange) * height;
    return `${String(x.toFixed(1))},${String(y.toFixed(1))}`;
  });

  return (
    <svg
      data-testid="sparkline"
      width={width}
      height={height}
      className="block"
      role="img"
      aria-label="Telemetry sparkline chart"
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Current value dot */}
      {data.length > 0 && (
        <circle
          cx={String(((data.length - 1) * xStep).toFixed(1))}
          cy={String((height - ((data[data.length - 1].value - yMin) / yRange) * height).toFixed(1))}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Channel card
// ---------------------------------------------------------------------------

interface ChannelCardProps {
  channel: TelemetryChannel;
}

function ChannelCard({ channel }: ChannelCardProps) {
  const { name, data, stats, color } = channel;

  return (
    <div
      data-testid={`telemetry-channel-${name}`}
      className="bg-card/60 border border-border rounded-lg p-3 space-y-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            data-testid={`telemetry-channel-color-${name}`}
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-medium text-foreground">{name}</span>
        </div>
        <span
          data-testid={`telemetry-channel-current-${name}`}
          className="text-sm font-mono tabular-nums text-foreground"
        >
          {stats.count > 0 ? formatValue(stats.current) : '--'}
        </span>
      </div>

      {/* Sparkline */}
      <Sparkline data={data} color={color} width={240} height={48} />

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono tabular-nums">
        <span data-testid={`telemetry-stat-min-${name}`}>
          min: {stats.count > 0 ? formatValue(stats.min) : '--'}
        </span>
        <span data-testid={`telemetry-stat-max-${name}`}>
          max: {stats.count > 0 ? formatValue(stats.max) : '--'}
        </span>
        <span data-testid={`telemetry-stat-avg-${name}`}>
          avg: {stats.count > 0 ? formatValue(stats.avg) : '--'}
        </span>
        <span data-testid={`telemetry-stat-count-${name}`} className="ml-auto">
          {String(stats.count)} pts
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(v: number): string {
  if (Number.isInteger(v)) {
    return String(v);
  }
  // Up to 3 decimal places, trim trailing zeros
  return v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

// ---------------------------------------------------------------------------
// TelemetryDashboard
// ---------------------------------------------------------------------------

export default function TelemetryDashboard() {
  const storeRef = useRef(TelemetryStore.getInstance());

  const snapshot = useSyncExternalStore(
    storeRef.current.subscribe,
    storeRef.current.getSnapshot,
  );

  const handleTogglePause = useCallback(() => {
    storeRef.current.togglePause();
  }, []);

  const handleClear = useCallback(() => {
    storeRef.current.clear();
  }, []);

  const hasChannels = snapshot.channels.length > 0;

  return (
    <div data-testid="telemetry-dashboard" className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card/40 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span className="text-xs font-semibold text-foreground">Telemetry</span>
          <span className="text-[10px] text-muted-foreground">
            {String(snapshot.channels.length)} ch &middot; {String(snapshot.totalSamples)} samples
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            data-testid="telemetry-pause-btn"
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 text-[10px] gap-1 px-2',
              snapshot.paused && 'text-yellow-400',
            )}
            onClick={handleTogglePause}
            title={snapshot.paused ? 'Resume telemetry' : 'Pause telemetry'}
          >
            {snapshot.paused ? (
              <>
                <Play className="w-3 h-3" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                Pause
              </>
            )}
          </Button>
          <Button
            data-testid="telemetry-clear-btn"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 px-2"
            onClick={handleClear}
            title="Clear all telemetry data"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </Button>
        </div>
      </div>

      {/* Channel grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {!hasChannels ? (
          <div
            data-testid="telemetry-empty"
            className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground"
          >
            <Activity className="w-8 h-8 opacity-50" />
            <span className="text-sm">No telemetry data yet</span>
            <span className="text-xs max-w-xs text-center">
              Send numeric data over serial (CSV, JSON, key=value, or tab-separated) to see live charts here.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {snapshot.channels.map((ch) => (
              <ChannelCard key={ch.name} channel={ch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
