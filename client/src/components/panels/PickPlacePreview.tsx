import { useState, useMemo, useCallback, memo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  FlipHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  validatePlacements,
  groupBySide,
  computePlacementStats,
} from '@/lib/pick-place-preview';
import type {
  PlacementEntry,
  PlacementIssue,
} from '@/lib/pick-place-preview';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PickPlacePreviewProps {
  entries: PlacementEntry[];
  boardWidth?: number;
  boardHeight?: number;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SVG_PADDING = 20;
const DOT_RADIUS = 4;
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

// ---------------------------------------------------------------------------
// Severity icon map
// ---------------------------------------------------------------------------

function SeverityIcon({ severity }: { severity: 'error' | 'warning' }) {
  if (severity === 'error') {
    return <AlertCircle className="w-3 h-3 text-destructive shrink-0" />;
  }
  return <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PickPlacePreview({
  entries,
  boardWidth,
  boardHeight,
  onClose,
}: PickPlacePreviewProps) {
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [zoom, setZoom] = useState(1);
  const [hoveredRefDes, setHoveredRefDes] = useState<string | null>(null);

  // Validation
  const issues = useMemo(
    () => validatePlacements(entries, boardWidth, boardHeight),
    [entries, boardWidth, boardHeight],
  );

  const stats = useMemo(
    () => computePlacementStats(entries, issues),
    [entries, issues],
  );

  const sides = useMemo(() => groupBySide(entries), [entries]);

  const activePlacements = activeSide === 'front' ? sides.front : sides.back;

  // Compute board bounds from data if not provided
  const bounds = useMemo(() => {
    const bw = boardWidth ?? Math.max(100, ...entries.filter((e) => Number.isFinite(e.x)).map((e) => e.x + 10));
    const bh = boardHeight ?? Math.max(80, ...entries.filter((e) => Number.isFinite(e.y)).map((e) => e.y + 10));
    return { width: bw, height: bh };
  }, [entries, boardWidth, boardHeight]);

  // RefDes set with issues for highlighting
  const issueRefDesSet = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues) {
      if (issue.refDes) {
        set.add(issue.refDes);
      }
      if (issue.relatedRefDes) {
        set.add(issue.relatedRefDes);
      }
    }
    return set;
  }, [issues]);

  // Hovered entry details
  const hoveredEntry = useMemo(() => {
    if (!hoveredRefDes) {
      return null;
    }
    return entries.find((e) => e.refDes === hoveredRefDes) ?? null;
  }, [entries, hoveredRefDes]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const svgWidth = (bounds.width + SVG_PADDING * 2) * zoom;
  const svgHeight = (bounds.height + SVG_PADDING * 2) * zoom;

  return (
    <div
      className="border border-border/50 bg-card/40 backdrop-blur flex flex-col gap-2 p-3"
      data-testid="pick-place-preview"
    >
      {/* Header */}
      <div className="flex items-center justify-between" data-testid="pick-place-header">
        <span className="text-xs font-medium text-foreground">
          Pick-and-Place Preview
        </span>
        <button
          className="text-[10px] px-2 py-1 text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-colors focus-ring"
          onClick={onClose}
          data-testid="pick-place-close"
          aria-label="Close pick-and-place preview"
        >
          Close
        </button>
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground"
        data-testid="pick-place-stats"
      >
        <span>{stats.total} parts</span>
        <span>{stats.frontCount} front</span>
        <span>{stats.backCount} back</span>
        <span>{stats.uniquePackages} packages</span>
        {stats.errorCount > 0 && (
          <span className="text-destructive" data-testid="pick-place-error-count">
            {stats.errorCount} error{stats.errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {stats.warningCount > 0 && (
          <span className="text-amber-400" data-testid="pick-place-warning-count">
            {stats.warningCount} warning{stats.warningCount !== 1 ? 's' : ''}
          </span>
        )}
        {stats.errorCount === 0 && stats.warningCount === 0 && (
          <span className="text-green-400 flex items-center gap-1" data-testid="pick-place-all-valid">
            <CheckCircle2 className="w-3 h-3" /> Valid
          </span>
        )}
      </div>

      {/* Side toggle + zoom controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-border/50 bg-muted/20" data-testid="pick-place-side-toggle">
          <button
            className={cn(
              'px-2.5 py-1 text-[10px] font-medium transition-colors focus-ring',
              activeSide === 'front'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveSide('front')}
            data-testid="pick-place-side-front"
            aria-label="Show front side"
            aria-pressed={activeSide === 'front'}
          >
            <FlipHorizontal className="w-3 h-3 inline mr-1" />
            Front ({sides.front.length})
          </button>
          <button
            className={cn(
              'px-2.5 py-1 text-[10px] font-medium transition-colors focus-ring',
              activeSide === 'back'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveSide('back')}
            data-testid="pick-place-side-back"
            aria-label="Show back side"
            aria-pressed={activeSide === 'back'}
          >
            <RotateCw className="w-3 h-3 inline mr-1" />
            Back ({sides.back.length})
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            className="p-1 text-muted-foreground hover:text-foreground transition-colors focus-ring"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            data-testid="pick-place-zoom-out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-8 text-center" data-testid="pick-place-zoom-level">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="p-1 text-muted-foreground hover:text-foreground transition-colors focus-ring"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            data-testid="pick-place-zoom-in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG board preview */}
      <div
        className="overflow-auto border border-border/30 bg-black/20 max-h-60"
        data-testid="pick-place-board"
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${bounds.width + SVG_PADDING * 2} ${bounds.height + SVG_PADDING * 2}`}
          className="block"
          data-testid="pick-place-svg"
        >
          {/* Board outline */}
          <rect
            x={SVG_PADDING}
            y={SVG_PADDING}
            width={bounds.width}
            height={bounds.height}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-muted-foreground/40"
            data-testid="pick-place-board-outline"
          />

          {/* Component dots */}
          {activePlacements.map((entry) => {
            if (!Number.isFinite(entry.x) || !Number.isFinite(entry.y)) {
              return null;
            }
            const hasIssue = issueRefDesSet.has(entry.refDes);
            const isHovered = hoveredRefDes === entry.refDes;

            return (
              <g key={entry.refDes} data-testid={`pick-place-dot-${entry.refDes}`}>
                <circle
                  cx={entry.x + SVG_PADDING}
                  cy={bounds.height - entry.y + SVG_PADDING}
                  r={isHovered ? DOT_RADIUS * 1.5 : DOT_RADIUS}
                  className={cn(
                    'transition-all cursor-pointer',
                    hasIssue ? 'fill-destructive/80' : 'fill-primary/70',
                    isHovered && 'fill-primary stroke-white stroke-1',
                  )}
                  onMouseEnter={() => setHoveredRefDes(entry.refDes)}
                  onMouseLeave={() => setHoveredRefDes(null)}
                />
                {/* Rotation indicator */}
                {isHovered && (
                  <line
                    x1={entry.x + SVG_PADDING}
                    y1={bounds.height - entry.y + SVG_PADDING}
                    x2={entry.x + SVG_PADDING + Math.cos((entry.rotation * Math.PI) / 180) * DOT_RADIUS * 2.5}
                    y2={bounds.height - entry.y + SVG_PADDING - Math.sin((entry.rotation * Math.PI) / 180) * DOT_RADIUS * 2.5}
                    stroke="white"
                    strokeWidth={0.8}
                  />
                )}
                {/* Label on hover */}
                {isHovered && (
                  <text
                    x={entry.x + SVG_PADDING + DOT_RADIUS * 2}
                    y={bounds.height - entry.y + SVG_PADDING - DOT_RADIUS}
                    className="fill-foreground text-[8px] font-mono"
                  >
                    {entry.refDes}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hovered entry details */}
      {hoveredEntry && (
        <div
          className="text-[10px] font-mono text-muted-foreground bg-muted/20 px-2 py-1.5 border border-border/30 flex flex-wrap gap-x-3 gap-y-0.5"
          data-testid="pick-place-hover-details"
        >
          <span className="text-foreground font-medium">{hoveredEntry.refDes}</span>
          <span>{hoveredEntry.value}</span>
          <span>{hoveredEntry.packageName}</span>
          <span>X: {hoveredEntry.x.toFixed(2)}mm</span>
          <span>Y: {hoveredEntry.y.toFixed(2)}mm</span>
          <span>Rot: {hoveredEntry.rotation.toFixed(1)}&deg;</span>
          <span>{hoveredEntry.side}</span>
        </div>
      )}

      {/* Validation issues list */}
      {issues.length > 0 && (
        <div className="flex flex-col gap-1 max-h-32 overflow-auto" data-testid="pick-place-issues">
          <span className="text-[10px] font-medium text-muted-foreground">Validation Issues</span>
          {issues.map((issue, idx) => (
            <div
              key={`${issue.type}-${issue.refDes}-${idx}`}
              className="flex items-start gap-1.5 text-[10px] leading-tight"
              data-testid={`pick-place-issue-${idx}`}
            >
              <SeverityIcon severity={issue.severity} />
              <span className="text-muted-foreground">{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(PickPlacePreview);
