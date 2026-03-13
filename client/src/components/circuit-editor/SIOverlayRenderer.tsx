/**
 * SIOverlayRenderer — SVG overlay for signal integrity annotations on the
 * PCB canvas. Renders stub-length markers, impedance warnings, and crosstalk
 * indicator lines.
 *
 * This component is a self-contained `<g>` group intended to be placed inside
 * the PCB's SVG viewport. It does NOT modify PCBLayoutView.tsx — the parent
 * is responsible for composing it.
 *
 * Toggle button (SIOverlayToggle) is exported separately for toolbar use.
 */

import { memo, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import type { SIAnnotation, SIOverlayManager } from '@/lib/pcb/si-overlay';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_IMPEDANCE_MARKER_SIZE = 8;
const CROSSTALK_LINE_WIDTH = 1.5;
const TOOLTIP_OFFSET_Y = -14;
const TOOLTIP_FONT_SIZE = 9;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Circle marker for stub-length advisories. */
const StubLengthMarker = memo(function StubLengthMarker({
  annotation,
}: {
  annotation: SIAnnotation;
}) {
  const [hovered, setHovered] = useState(false);
  const radius = annotation.radius ?? 6;

  return (
    <g
      data-testid={`si-stub-marker-${annotation.id}`}
      onMouseEnter={() => { setHovered(true); }}
      onMouseLeave={() => { setHovered(false); }}
    >
      <circle
        cx={annotation.x}
        cy={annotation.y}
        r={radius}
        fill={annotation.color}
        fillOpacity={0.25}
        stroke={annotation.color}
        strokeWidth={1}
        strokeDasharray="3,2"
      />
      {/* Inner dot */}
      <circle
        cx={annotation.x}
        cy={annotation.y}
        r={2}
        fill={annotation.color}
        fillOpacity={0.8}
      />
      {hovered && (
        <text
          x={annotation.x}
          y={annotation.y + TOOLTIP_OFFSET_Y}
          textAnchor="middle"
          fill={annotation.color}
          fontSize={TOOLTIP_FONT_SIZE}
          fontFamily="monospace"
          data-testid={`si-stub-tooltip-${annotation.id}`}
        >
          {annotation.tooltip}
        </text>
      )}
    </g>
  );
});

/** Diamond marker for impedance-mismatch advisories. */
const ImpedanceWarning = memo(function ImpedanceWarning({
  annotation,
}: {
  annotation: SIAnnotation;
}) {
  const [hovered, setHovered] = useState(false);
  const half = DEFAULT_IMPEDANCE_MARKER_SIZE / 2;
  const { x, y, color, label } = annotation;

  // Diamond path centred on (x, y)
  const diamond = `M ${x} ${y - half} L ${x + half} ${y} L ${x} ${y + half} L ${x - half} ${y} Z`;

  return (
    <g
      data-testid={`si-impedance-marker-${annotation.id}`}
      onMouseEnter={() => { setHovered(true); }}
      onMouseLeave={() => { setHovered(false); }}
    >
      <path
        d={diamond}
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={0.8}
      />
      {/* Deviation label below marker */}
      {label && (
        <text
          x={x}
          y={y + half + TOOLTIP_FONT_SIZE + 2}
          textAnchor="middle"
          fill={color}
          fontSize={TOOLTIP_FONT_SIZE}
          fontFamily="monospace"
          data-testid={`si-impedance-label-${annotation.id}`}
        >
          {label}
        </text>
      )}
      {hovered && (
        <text
          x={x}
          y={y + TOOLTIP_OFFSET_Y}
          textAnchor="middle"
          fill={color}
          fontSize={TOOLTIP_FONT_SIZE}
          fontFamily="monospace"
          data-testid={`si-impedance-tooltip-${annotation.id}`}
        >
          {annotation.tooltip}
        </text>
      )}
    </g>
  );
});

/** Line + glow between two coupled traces for crosstalk advisories. */
const CrosstalkIndicator = memo(function CrosstalkIndicator({
  annotation,
}: {
  annotation: SIAnnotation;
}) {
  const [hovered, setHovered] = useState(false);
  const { x, y, x2, y2, color } = annotation;

  // If no second point, render as a circle indicator
  if (x2 == null || y2 == null) {
    return (
      <g
        data-testid={`si-crosstalk-marker-${annotation.id}`}
        onMouseEnter={() => { setHovered(true); }}
        onMouseLeave={() => { setHovered(false); }}
      >
        <circle
          cx={x}
          cy={y}
          r={5}
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          strokeDasharray="2,2"
        />
        {hovered && (
          <text
            x={x}
            y={y + TOOLTIP_OFFSET_Y}
            textAnchor="middle"
            fill={color}
            fontSize={TOOLTIP_FONT_SIZE}
            fontFamily="monospace"
            data-testid={`si-crosstalk-tooltip-${annotation.id}`}
          >
            {annotation.tooltip}
          </text>
        )}
      </g>
    );
  }

  const midX = (x + x2) / 2;
  const midY = (y + y2) / 2;

  return (
    <g
      data-testid={`si-crosstalk-marker-${annotation.id}`}
      onMouseEnter={() => { setHovered(true); }}
      onMouseLeave={() => { setHovered(false); }}
    >
      {/* Glow behind the line */}
      <line
        x1={x}
        y1={y}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={CROSSTALK_LINE_WIDTH + 2}
        strokeOpacity={0.15}
        strokeLinecap="round"
      />
      {/* Main coupling line */}
      <line
        x1={x}
        y1={y}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={CROSSTALK_LINE_WIDTH}
        strokeOpacity={0.6}
        strokeDasharray="4,3"
        strokeLinecap="round"
      />
      {/* Endpoint dots */}
      <circle cx={x} cy={y} r={2} fill={color} fillOpacity={0.7} />
      <circle cx={x2} cy={y2} r={2} fill={color} fillOpacity={0.7} />
      {hovered && (
        <text
          x={midX}
          y={midY + TOOLTIP_OFFSET_Y}
          textAnchor="middle"
          fill={color}
          fontSize={TOOLTIP_FONT_SIZE}
          fontFamily="monospace"
          data-testid={`si-crosstalk-tooltip-${annotation.id}`}
        >
          {annotation.tooltip}
        </text>
      )}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Annotation dispatcher
// ---------------------------------------------------------------------------

const AnnotationRenderer = memo(function AnnotationRenderer({
  annotation,
}: {
  annotation: SIAnnotation;
}) {
  switch (annotation.type) {
    case 'stub-length':
      return <StubLengthMarker annotation={annotation} />;
    case 'impedance-mismatch':
      return <ImpedanceWarning annotation={annotation} />;
    case 'crosstalk':
      return <CrosstalkIndicator annotation={annotation} />;
  }
});

// ---------------------------------------------------------------------------
// Main overlay component
// ---------------------------------------------------------------------------

export interface SIOverlayRendererProps {
  /** The SIOverlayManager instance to read state from. */
  manager: SIOverlayManager;
}

/**
 * SVG `<g>` group rendering all SI annotations.
 * Returns null when the overlay is disabled or there are no annotations.
 */
const SIOverlayRenderer = memo(function SIOverlayRenderer({ manager }: SIOverlayRendererProps) {
  const state = useSyncExternalStore(
    useCallback((cb: () => void) => manager.subscribe(cb), [manager]),
    useCallback(() => manager.getSnapshot(), [manager]),
  );

  if (!state.enabled || state.annotations.length === 0) {
    return null;
  }

  return (
    <g data-testid="si-overlay" pointerEvents="all">
      {Array.from(state.annotations).map((annotation) => (
        <AnnotationRenderer key={annotation.id} annotation={annotation} />
      ))}
    </g>
  );
});

export { SIOverlayRenderer };

// ---------------------------------------------------------------------------
// Toggle button component
// ---------------------------------------------------------------------------

export interface SIOverlayToggleProps {
  /** The SIOverlayManager instance to toggle. */
  manager: SIOverlayManager;
  /** Optional CSS class name. */
  className?: string;
}

/**
 * Small toolbar button to toggle the SI overlay on/off.
 * Shows advisory count badge when annotations exist.
 */
const SIOverlayToggle = memo(function SIOverlayToggle({ manager, className }: SIOverlayToggleProps) {
  const state = useSyncExternalStore(
    useCallback((cb: () => void) => manager.subscribe(cb), [manager]),
    useCallback(() => manager.getSnapshot(), [manager]),
  );

  const advisoryCount = useMemo(() => manager.getAdvisoryCount(), [manager, state]);

  const handleClick = useCallback(() => {
    manager.toggle();
  }, [manager]);

  return (
    <button
      type="button"
      data-testid="si-overlay-toggle"
      className={className}
      onClick={handleClick}
      title={state.enabled ? 'Hide SI overlay' : 'Show SI overlay'}
      aria-pressed={state.enabled}
      aria-label="Toggle signal integrity overlay"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Simplified SI wave icon */}
        <path
          d="M2 8 Q5 2, 8 8 Q11 14, 14 8"
          stroke={state.enabled ? '#00F0FF' : 'currentColor'}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {advisoryCount > 0 && (
        <span
          data-testid="si-overlay-badge"
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            fontSize: 9,
            lineHeight: '14px',
            minWidth: 14,
            textAlign: 'center',
            borderRadius: 7,
            backgroundColor: state.enabled ? '#00F0FF' : '#6B7280',
            color: '#000',
            fontWeight: 600,
            padding: '0 3px',
          }}
        >
          {advisoryCount}
        </span>
      )}
    </button>
  );
});

export { SIOverlayToggle };
