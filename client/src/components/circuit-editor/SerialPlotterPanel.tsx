/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { useState, useCallback, useMemo, useSyncExternalStore, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getSerialPlotterManager } from '@/lib/serial/serial-plotter';
import type { ChannelInfo, YRange, TimeRange } from '@/lib/serial/serial-plotter';
import { Pause, Play, Trash2, Download } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_WINDOW_OPTIONS = [
  { value: '1', label: '1s' },
  { value: '5', label: '5s' },
  { value: '10', label: '10s' },
  { value: '30', label: '30s' },
  { value: '60', label: '60s' },
];

const CHART_HEIGHT = 300;
const CHART_PADDING = { top: 20, right: 20, bottom: 30, left: 60 };
const Y_GRID_LINES = 5;
const X_GRID_LINES = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toFixed(0);
  }
  if (Math.abs(value) >= 1) {
    return value.toFixed(2);
  }
  return value.toPrecision(3);
}

function formatTimeLabel(ms: number, windowMs: number): string {
  const seconds = ms / 1000;
  if (windowMs <= 5000) {
    return `${seconds.toFixed(1)}s`;
  }
  return `${seconds.toFixed(0)}s`;
}

// ---------------------------------------------------------------------------
// SVG Chart sub-component
// ---------------------------------------------------------------------------

interface ChartProps {
  channels: ChannelInfo[];
  yRange: YRange;
  timeRange: TimeRange;
  width: number;
}

function PlotChart({ channels, yRange, timeRange, width }: ChartProps) {
  const plotWidth = width - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  if (plotWidth <= 0 || plotHeight <= 0) {
    return null;
  }

  const xScale = (timestamp: number): number => {
    const t = (timestamp - timeRange.start) / (timeRange.end - timeRange.start);
    return CHART_PADDING.left + t * plotWidth;
  };

  const yScale = (value: number): number => {
    const t = (value - yRange.min) / (yRange.max - yRange.min);
    return CHART_PADDING.top + plotHeight - t * plotHeight;
  };

  // Y gridlines
  const yGridValues: number[] = [];
  for (let i = 0; i <= Y_GRID_LINES; i++) {
    const value = yRange.min + (i / Y_GRID_LINES) * (yRange.max - yRange.min);
    yGridValues.push(value);
  }

  // X gridlines
  const xGridValues: number[] = [];
  const windowMs = timeRange.end - timeRange.start;
  for (let i = 0; i <= X_GRID_LINES; i++) {
    const ts = timeRange.start + (i / X_GRID_LINES) * windowMs;
    xGridValues.push(ts);
  }

  return (
    <svg
      width={width}
      height={CHART_HEIGHT}
      data-testid="serial-plotter-chart"
      className="block"
    >
      {/* Background */}
      <rect x={0} y={0} width={width} height={CHART_HEIGHT} fill="#1a1a2e" rx={4} />

      {/* Plot area clip */}
      <defs>
        <clipPath id="plot-clip">
          <rect
            x={CHART_PADDING.left}
            y={CHART_PADDING.top}
            width={plotWidth}
            height={plotHeight}
          />
        </clipPath>
      </defs>

      {/* Y gridlines + labels */}
      {yGridValues.map((v, i) => {
        const y = yScale(v);
        return (
          <g key={`ygrid-${String(i)}`}>
            <line
              x1={CHART_PADDING.left}
              y1={y}
              x2={CHART_PADDING.left + plotWidth}
              y2={y}
              stroke="#333"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={CHART_PADDING.left - 8}
              y={y + 4}
              textAnchor="end"
              fill="#888"
              fontSize={10}
              fontFamily="monospace"
            >
              {formatValue(v)}
            </text>
          </g>
        );
      })}

      {/* X gridlines + labels */}
      {xGridValues.map((ts, i) => {
        const x = xScale(ts);
        const relativeMs = ts - timeRange.start;
        return (
          <g key={`xgrid-${String(i)}`}>
            <line
              x1={x}
              y1={CHART_PADDING.top}
              x2={x}
              y2={CHART_PADDING.top + plotHeight}
              stroke="#333"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={x}
              y={CHART_HEIGHT - 5}
              textAnchor="middle"
              fill="#888"
              fontSize={10}
              fontFamily="monospace"
            >
              {formatTimeLabel(relativeMs, windowMs)}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line
        x1={CHART_PADDING.left}
        y1={CHART_PADDING.top}
        x2={CHART_PADDING.left}
        y2={CHART_PADDING.top + plotHeight}
        stroke="#555"
        strokeWidth={1}
      />
      <line
        x1={CHART_PADDING.left}
        y1={CHART_PADDING.top + plotHeight}
        x2={CHART_PADDING.left + plotWidth}
        y2={CHART_PADDING.top + plotHeight}
        stroke="#555"
        strokeWidth={1}
      />

      {/* Data lines */}
      <g clipPath="url(#plot-clip)">
        {channels
          .filter((ch) => ch.visible && ch.data.length > 1)
          .map((ch) => {
            const points = ch.data
              .filter((p) => Number.isFinite(p.value))
              .map((p) => `${String(xScale(p.timestamp))},${String(yScale(p.value))}`)
              .join(' ');
            return (
              <polyline
                key={`line-${String(ch.index)}`}
                points={points}
                fill="none"
                stroke={ch.color}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                data-testid={`channel-line-${String(ch.index)}`}
              />
            );
          })}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SerialPlotterPanel
// ---------------------------------------------------------------------------

export function SerialPlotterPanel() {
  const manager = getSerialPlotterManager();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [editingChannel, setEditingChannel] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  // useSyncExternalStore for reactive updates
  const snapshot = useSyncExternalStore(
    useCallback((cb: () => void) => manager.subscribe(cb), [manager]),
    useCallback(() => {
      return {
        channels: manager.getAllChannels(),
        yRange: manager.getYRange(),
        timeRange: manager.getVisibleTimeRange(),
        isPaused: manager.isPaused(),
        timeWindow: manager.getTimeWindow(),
      };
    }, [manager]),
  );

  // Observe container width for responsive chart
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  const handleTimeWindowChange = useCallback(
    (value: string) => {
      manager.setTimeWindow(Number(value));
    },
    [manager],
  );

  const handlePauseResume = useCallback(() => {
    if (manager.isPaused()) {
      manager.resume();
    } else {
      manager.pause();
    }
  }, [manager]);

  const handleClear = useCallback(() => {
    manager.clear();
  }, [manager]);

  const handleExportCSV = useCallback(() => {
    const csv = manager.exportCSV();
    if (!csv) {
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'serial-plotter-data.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [manager]);

  const handleToggleChannel = useCallback(
    (index: number) => {
      manager.setChannelVisible(index, !manager.isChannelVisible(index));
    },
    [manager],
  );

  const handleStartRename = useCallback(
    (index: number) => {
      setEditingChannel(index);
      setEditName(manager.getChannelName(index));
    },
    [manager],
  );

  const handleFinishRename = useCallback(() => {
    if (editingChannel !== null && editName.trim()) {
      manager.setChannelName(editingChannel, editName.trim());
    }
    setEditingChannel(null);
    setEditName('');
  }, [editingChannel, editName, manager]);

  const defaultYRange: YRange = useMemo(() => ({ min: -1, max: 1 }), []);
  const yRange = snapshot.yRange ?? defaultYRange;

  return (
    <div ref={containerRef} className="flex flex-col gap-2 p-2" data-testid="serial-plotter-panel">
      {/* Controls bar */}
      <div className="flex items-center gap-2 flex-wrap" data-testid="serial-plotter-controls">
        {/* Time window */}
        <Select
          value={String(snapshot.timeWindow)}
          onValueChange={handleTimeWindowChange}
        >
          <SelectTrigger className="w-20 h-8 text-xs" data-testid="time-window-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_WINDOW_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Pause / Resume */}
        <Button
          size="sm"
          variant={snapshot.isPaused ? 'default' : 'secondary'}
          onClick={handlePauseResume}
          data-testid="pause-resume-button"
          className="h-8"
        >
          {snapshot.isPaused ? (
            <>
              <Play className="h-3.5 w-3.5 mr-1" />
              Resume
            </>
          ) : (
            <>
              <Pause className="h-3.5 w-3.5 mr-1" />
              Pause
            </>
          )}
        </Button>

        {/* Clear */}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleClear}
          data-testid="clear-button"
          className="h-8"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>

        {/* Export CSV */}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleExportCSV}
          data-testid="export-csv-button"
          className="h-8"
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          CSV
        </Button>
      </div>

      {/* Chart */}
      {snapshot.channels.length > 0 ? (
        <PlotChart
          channels={snapshot.channels}
          yRange={yRange}
          timeRange={snapshot.timeRange}
          width={containerWidth}
        />
      ) : (
        <div
          className="flex items-center justify-center bg-[#1a1a2e] rounded text-muted-foreground text-sm"
          style={{ height: CHART_HEIGHT }}
          data-testid="serial-plotter-empty"
        >
          No data — connect a serial device and send numeric values
        </div>
      )}

      {/* Channel legend */}
      {snapshot.channels.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="channel-legend">
          {snapshot.channels.map((ch) => (
            <div
              key={ch.index}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none',
                'border border-transparent hover:border-[var(--color-editor-accent)]/30',
                !ch.visible && 'opacity-40',
              )}
              onClick={() => {
                handleToggleChannel(ch.index);
              }}
              data-testid={`channel-legend-${String(ch.index)}`}
            >
              {/* Color swatch */}
              <span
                className="inline-block w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: ch.color }}
                data-testid={`channel-color-${String(ch.index)}`}
              />

              {/* Name (editable on double-click) */}
              {editingChannel === ch.index ? (
                <Input
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                  }}
                  onBlur={handleFinishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleFinishRename();
                    }
                    if (e.key === 'Escape') {
                      setEditingChannel(null);
                    }
                  }}
                  className="h-5 w-24 text-xs px-1"
                  autoFocus
                  data-testid={`channel-name-input-${String(ch.index)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                />
              ) : (
                <span
                  className="text-muted-foreground hover:text-foreground"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(ch.index);
                  }}
                  data-testid={`channel-name-${String(ch.index)}`}
                >
                  {ch.name}
                </span>
              )}

              {/* Latest value */}
              <span className="text-muted-foreground font-mono" data-testid={`channel-value-${String(ch.index)}`}>
                {ch.data.length > 0 && Number.isFinite(ch.data[ch.data.length - 1].value)
                  ? formatValue(ch.data[ch.data.length - 1].value)
                  : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
