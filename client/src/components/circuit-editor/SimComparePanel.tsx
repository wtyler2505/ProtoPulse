/**
 * SimComparePanel — UI for simulation compare mode (BL-0125).
 *
 * Displays captured simulation snapshots, allows side-by-side comparison
 * with statistical analysis, and renders an SVG overlay chart.
 */

import { useState, useSyncExternalStore, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera, Trash2, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { simCompareManager } from '@/lib/simulation/sim-compare';
import type { SimulationData, CompareResult, OverlayData } from '@/lib/simulation/sim-compare';

// ---------------------------------------------------------------------------
// Subscribe hook
// ---------------------------------------------------------------------------

function useSimCompare() {
  const subscribe = useCallback((cb: () => void) => simCompareManager.subscribe(cb), []);
  const getSnapshot = useCallback(() => simCompareManager.version, []);
  useSyncExternalStore(subscribe, getSnapshot);

  return {
    snapshots: simCompareManager.listSnapshots(),
    count: simCompareManager.count,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SimComparePanelProps {
  /** Current simulation data to snapshot (undefined if no sim has run yet). */
  currentSimData?: SimulationData;
}

// ---------------------------------------------------------------------------
// Overlay Chart (SVG)
// ---------------------------------------------------------------------------

const CHART_W = 400;
const CHART_H = 180;
const CHART_PAD = { top: 12, right: 12, bottom: 24, left: 48 };

interface OverlayChartProps {
  overlay: OverlayData;
  signalIndex: number;
}

function OverlayChart({ overlay, signalIndex }: OverlayChartProps) {
  const series = overlay.series[signalIndex];
  if (!series) {
    return null;
  }

  const allX = [...series.xA, ...series.xB];
  const allY = [...series.yA, ...series.yB];

  if (allX.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4" data-testid="overlay-empty">
        No data points to display.
      </div>
    );
  }

  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);
  const yMin = Math.min(...allY);
  const yMax = Math.max(...allY);

  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const plotW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

  const toSvgX = (x: number) => CHART_PAD.left + ((x - xMin) / xRange) * plotW;
  const toSvgY = (y: number) => CHART_PAD.top + plotH - ((y - yMin) / yRange) * plotH;

  const buildPath = (xs: number[], ys: number[]): string => {
    if (xs.length === 0) {
      return '';
    }
    const parts: string[] = [`M ${toSvgX(xs[0]).toFixed(2)} ${toSvgY(ys[0]).toFixed(2)}`];
    for (let i = 1; i < xs.length; i++) {
      parts.push(`L ${toSvgX(xs[i]).toFixed(2)} ${toSvgY(ys[i]).toFixed(2)}`);
    }
    return parts.join(' ');
  };

  const pathA = buildPath(series.xA, series.yA);
  const pathB = buildPath(series.xB, series.yB);

  return (
    <div data-testid="overlay-chart">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Overlay chart for ${series.signalName}`}
      >
        {/* Grid lines */}
        <line
          x1={CHART_PAD.left} y1={CHART_PAD.top}
          x2={CHART_PAD.left} y2={CHART_PAD.top + plotH}
          stroke="currentColor" strokeOpacity={0.15} strokeWidth={1}
        />
        <line
          x1={CHART_PAD.left} y1={CHART_PAD.top + plotH}
          x2={CHART_PAD.left + plotW} y2={CHART_PAD.top + plotH}
          stroke="currentColor" strokeOpacity={0.15} strokeWidth={1}
        />

        {/* Axis labels */}
        <text
          x={CHART_PAD.left - 4} y={CHART_PAD.top + 4}
          textAnchor="end" fontSize={9} fill="currentColor" opacity={0.5}
        >
          {yMax.toPrecision(3)}
        </text>
        <text
          x={CHART_PAD.left - 4} y={CHART_PAD.top + plotH}
          textAnchor="end" fontSize={9} fill="currentColor" opacity={0.5}
        >
          {yMin.toPrecision(3)}
        </text>
        <text
          x={CHART_PAD.left} y={CHART_H - 2}
          textAnchor="start" fontSize={9} fill="currentColor" opacity={0.5}
        >
          {xMin.toPrecision(3)} {series.xUnit ?? ''}
        </text>
        <text
          x={CHART_PAD.left + plotW} y={CHART_H - 2}
          textAnchor="end" fontSize={9} fill="currentColor" opacity={0.5}
        >
          {xMax.toPrecision(3)} {series.xUnit ?? ''}
        </text>

        {/* Signal A — cyan */}
        {pathA && (
          <path d={pathA} fill="none" stroke="var(--color-editor-accent)" strokeWidth={1.5} opacity={0.9} />
        )}
        {/* Signal B — magenta */}
        {pathB && (
          <path d={pathB} fill="none" stroke="#FF00FF" strokeWidth={1.5} opacity={0.9} />
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] mt-1" data-testid="overlay-legend">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-[var(--color-editor-accent)]" />
          Snapshot A
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-[#FF00FF]" />
          Snapshot B
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export function SimComparePanel({ currentSimData }: SimComparePanelProps) {
  const { snapshots, count } = useSimCompare();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [overlaySignalIdx, setOverlaySignalIdx] = useState(0);

  // Derive comparison results
  const compareResult: CompareResult | undefined =
    selectedA && selectedB ? simCompareManager.compare(selectedA, selectedB) : undefined;

  const overlayData: OverlayData | undefined =
    selectedA && selectedB ? simCompareManager.getOverlayData(selectedA, selectedB) : undefined;

  const handleCapture = () => {
    if (!currentSimData) {
      return;
    }
    const label = `Run ${count + 1}`;
    simCompareManager.captureSnapshot(label, currentSimData);
  };

  const handleDelete = (id: string) => {
    simCompareManager.deleteSnapshot(id);
    if (selectedA === id) {
      setSelectedA(null);
    }
    if (selectedB === id) {
      setSelectedB(null);
    }
  };

  return (
    <Card
      className="border-border/50 bg-background/95 backdrop-blur"
      data-testid="sim-compare-panel"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[var(--color-editor-accent)]" />
          Compare Simulations
          {count > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {count}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleCapture}
            disabled={!currentSimData}
            data-testid="capture-snapshot-btn"
            aria-label="Capture current simulation"
          >
            <Camera className="mr-1 h-3 w-3" />
            Capture
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => { setCollapsed((c) => !c); }}
            aria-label={collapsed ? 'Expand compare panel' : 'Collapse compare panel'}
            data-testid="toggle-collapse-btn"
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          {/* Snapshot list */}
          {count === 0 ? (
            <p className="text-xs text-muted-foreground py-2" data-testid="empty-snapshots">
              No snapshots yet. Run a simulation and click Capture to save a snapshot.
            </p>
          ) : (
            <ScrollArea className="max-h-32">
              <div className="space-y-1" data-testid="snapshot-list">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-muted/50"
                    data-testid={`snapshot-item-${snap.id}`}
                  >
                    <div className="truncate flex-1 mr-2">
                      <span className="font-medium">{snap.label}</span>
                      <span className="text-muted-foreground ml-2">
                        {snap.data.signals.length} signal{snap.data.signals.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      onClick={() => { handleDelete(snap.id); }}
                      aria-label={`Delete snapshot ${snap.label}`}
                      data-testid={`delete-snapshot-${snap.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Comparison selectors */}
          {count >= 2 && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-2" data-testid="compare-selectors">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                    Snapshot A
                  </label>
                  <Select
                    value={selectedA ?? ''}
                    onValueChange={(v) => { setSelectedA(v || null); setOverlaySignalIdx(0); }}
                  >
                    <SelectTrigger className="h-7 text-xs" data-testid="select-snapshot-a">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshots.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                    Snapshot B
                  </label>
                  <Select
                    value={selectedB ?? ''}
                    onValueChange={(v) => { setSelectedB(v || null); setOverlaySignalIdx(0); }}
                  >
                    <SelectTrigger className="h-7 text-xs" data-testid="select-snapshot-b">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshots.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Comparison results */}
          {compareResult && (
            <>
              <Separator />

              {/* Overall stats */}
              <div
                className="grid grid-cols-2 gap-2 rounded-md border border-[var(--color-editor-accent)]/20 bg-[var(--color-editor-accent)]/5 p-2"
                data-testid="compare-overall-stats"
              >
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    RMS Error
                  </div>
                  <div className="text-sm font-mono font-semibold text-[var(--color-editor-accent)]">
                    {compareResult.overallRmsError.toPrecision(4)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Peak Deviation
                  </div>
                  <div className="text-sm font-mono font-semibold text-[var(--color-editor-accent)]">
                    {compareResult.overallPeakDeviation.toPrecision(4)}
                  </div>
                </div>
              </div>

              {/* Per-signal diff table */}
              <div className="space-y-1" data-testid="signal-diff-table">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Per-Signal Comparison
                </div>
                <div className="text-[10px] grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-0.5 font-mono">
                  <div className="text-muted-foreground font-sans font-medium">Signal</div>
                  <div className="text-muted-foreground font-sans font-medium text-right">RMS</div>
                  <div className="text-muted-foreground font-sans font-medium text-right">Peak</div>
                  <div className="text-muted-foreground font-sans font-medium text-right">Corr</div>
                  {compareResult.signalDiffs.map((diff) => (
                    <div key={diff.signalName} className="contents">
                      <div className="truncate">
                        {diff.signalName}
                        {!diff.inA && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">B only</Badge>}
                        {!diff.inB && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">A only</Badge>}
                      </div>
                      <div className="text-right">{diff.inA && diff.inB ? diff.rmsError.toPrecision(3) : '—'}</div>
                      <div className="text-right">{diff.inA && diff.inB ? diff.peakDeviation.toPrecision(3) : '—'}</div>
                      <div className="text-right">{diff.inA && diff.inB ? diff.correlation.toFixed(3) : '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Overlay chart */}
          {overlayData && overlayData.series.length > 0 && (
            <>
              <Separator />
              <div data-testid="overlay-section">
                {overlayData.series.length > 1 && (
                  <div className="mb-2">
                    <Select
                      value={String(overlaySignalIdx)}
                      onValueChange={(v) => { setOverlaySignalIdx(Number(v)); }}
                    >
                      <SelectTrigger className="h-7 text-xs" data-testid="select-overlay-signal">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {overlayData.series.map((s, i) => (
                          <SelectItem key={s.signalName} value={String(i)} className="text-xs">
                            {s.signalName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <OverlayChart overlay={overlayData} signalIndex={overlaySignalIdx} />
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
