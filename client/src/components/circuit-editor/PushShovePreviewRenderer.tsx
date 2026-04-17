/**
 * PushShovePreviewRenderer — SVG overlay for push-shove routing preview.
 *
 * Renders ghost traces (original positions), highlighted pushed traces,
 * the active routing trace, and displacement arrows.
 *
 * Designed to be placed as a child of the PCB SVG canvas <g> element.
 * Does NOT modify PCBLayoutView.tsx.
 */

import { useSyncExternalStore, useCallback, memo } from 'react';

import type { PreviewSegment, PushShovePreviewState } from '@/lib/pcb/push-shove-preview';
import { getPushShovePreviewManager } from '@/lib/pcb/push-shove-preview';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STROKE_WIDTH_TRACE = 0.3; // mm
const STROKE_WIDTH_ARROW = 0.15; // mm
const ARROW_MARKER_SIZE = 3;
const ARROW_MARKER_ID = 'push-shove-arrow-marker';

// ---------------------------------------------------------------------------
// Hook: usePushShovePreview
// ---------------------------------------------------------------------------

function usePushShovePreview(): PushShovePreviewState {
  const mgr = getPushShovePreviewManager();

  const subscribe = useCallback(
    (onStoreChange: () => void) => mgr.subscribe(onStoreChange),
    [mgr],
  );

  const getSnapshot = useCallback(
    () => mgr.getSnapshot(),
    [mgr],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SegmentLineProps {
  segment: PreviewSegment;
}

const SegmentLine = memo(function SegmentLine({ segment }: SegmentLineProps) {
  if (segment.points.length < 2) {
    return null;
  }

  const [p1, p2] = segment.points;

  return (
    <line
      data-testid={`push-shove-segment-${segment.id}`}
      x1={p1.x}
      y1={p1.y}
      x2={p2.x}
      y2={p2.y}
      stroke={segment.color}
      strokeOpacity={segment.opacity}
      strokeWidth={segment.type === 'displacement_arrow' ? STROKE_WIDTH_ARROW : STROKE_WIDTH_TRACE}
      strokeDasharray={segment.dashArray}
      strokeLinecap="round"
      markerEnd={segment.type === 'displacement_arrow' ? `url(#${ARROW_MARKER_ID})` : undefined}
      pointerEvents="none"
    />
  );
});

// ---------------------------------------------------------------------------
// Arrow marker definition
// ---------------------------------------------------------------------------

function ArrowMarkerDef() {
  return (
    <defs>
      <marker
        id={ARROW_MARKER_ID}
        data-testid="push-shove-arrow-marker"
        viewBox={`0 0 ${String(ARROW_MARKER_SIZE)} ${String(ARROW_MARKER_SIZE)}`}
        refX={ARROW_MARKER_SIZE}
        refY={ARROW_MARKER_SIZE / 2}
        markerWidth={ARROW_MARKER_SIZE}
        markerHeight={ARROW_MARKER_SIZE}
        orient="auto-start-reverse"
      >
        <path
          d={`M 0 0 L ${String(ARROW_MARKER_SIZE)} ${String(ARROW_MARKER_SIZE / 2)} L 0 ${String(ARROW_MARKER_SIZE)} Z`}
          fill="#F97316"
          fillOpacity={0.7}
        />
      </marker>
    </defs>
  );
}

// ---------------------------------------------------------------------------
// Toggle button
// ---------------------------------------------------------------------------

export interface PushShovePreviewToggleProps {
  className?: string;
}

export const PushShovePreviewToggle = memo(function PushShovePreviewToggle({
  className,
}: PushShovePreviewToggleProps) {
  const { active } = usePushShovePreview();
  const mgr = getPushShovePreviewManager();

  const handleClick = useCallback(() => {
    mgr.toggle();
  }, [mgr]);

  return (
    <button
      data-testid="push-shove-preview-toggle"
      type="button"
      className={className}
      onClick={handleClick}
      title={active ? 'Hide push-shove preview' : 'Show push-shove preview'}
      aria-pressed={active}
      aria-label="Toggle push-shove preview"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Two parallel traces with arrows showing displacement */}
        <line x1="3" y1="7" x2="17" y2="7" stroke={active ? '#FACC15' : '#6B7280'} strokeWidth="2" strokeLinecap="round" />
        <line x1="3" y1="13" x2="17" y2="13" stroke={active ? 'var(--color-editor-accent)' : '#6B7280'} strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="8" x2="10" y2="12" stroke={active ? '#F97316' : '#6B7280'} strokeWidth="1" markerEnd="url(#toggle-arrow)" />
        <defs>
          <marker id="toggle-arrow" viewBox="0 0 4 4" refX="4" refY="2" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M 0 0 L 4 2 L 0 4 Z" fill={active ? '#F97316' : '#6B7280'} />
          </marker>
        </defs>
      </svg>
    </button>
  );
});

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export interface PushShovePreviewRendererProps {
  className?: string;
}

/**
 * SVG group that renders all push-shove preview segments.
 *
 * Place this inside the PCB canvas SVG. When the preview manager is
 * inactive or has no data, this renders nothing (just an empty <g>).
 */
export const PushShovePreviewRenderer = memo(function PushShovePreviewRenderer({
  className,
}: PushShovePreviewRendererProps) {
  const { active, segments } = usePushShovePreview();

  if (!active || segments.length === 0) {
    return (
      <g
        data-testid="push-shove-preview-overlay"
        className={className}
      />
    );
  }

  return (
    <g
      data-testid="push-shove-preview-overlay"
      className={className}
      pointerEvents="none"
    >
      <ArrowMarkerDef />
      {segments.map((seg) => (
        <SegmentLine key={seg.id} segment={seg} />
      ))}
    </g>
  );
});

export default PushShovePreviewRenderer;
