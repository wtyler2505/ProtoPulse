/**
 * ViaRenderer — Pure SVG component that renders PCB vias as concentric
 * circles: outer copper annular ring, drill hole, optional tented overlay,
 * optional selection highlight, and cross marker for visibility.
 *
 * Supports through, blind, buried, and micro via types with distinct
 * color coding. React.memo wrapped for render performance.
 */

import { memo } from 'react';
import type { Via, ViaType } from '@/lib/pcb/via-model';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOARD_BACKGROUND = '#1a1a1a';
const TENTED_OVERLAY = '#22c55e40';
const HIGHLIGHT_COLOR = '#00F0FF';
const HIGHLIGHT_STROKE_WIDTH = 0.3;
const HIGHLIGHT_EXPANSION = 0.15; // mm beyond outer radius
const CROSS_STROKE = '#555';
const CROSS_STROKE_WIDTH = 0.1;

/** Round to 6 decimal places to avoid IEEE 754 floating-point artifacts in SVG attributes. */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

// ---------------------------------------------------------------------------
// Via color by type
// ---------------------------------------------------------------------------

function getViaColor(type: ViaType): string {
  switch (type) {
    case 'through':
      return '#c8a832';
    case 'blind':
      return '#9370DB';
    case 'buried':
      return '#2F4F4F';
    case 'micro':
      return '#20B2AA';
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViaRendererProps {
  via: Via;
  selected: boolean;
  onViaClick?: (viaId: string, e: React.MouseEvent) => void;
}

export interface ViaOverlayProps {
  vias: Via[];
  selectedViaId: string | null;
  onViaClick?: (viaId: string, e: React.MouseEvent) => void;
}

// ---------------------------------------------------------------------------
// ViaRenderer — single via
// ---------------------------------------------------------------------------

export const ViaRenderer = memo(function ViaRenderer({
  via,
  selected,
  onViaClick,
}: ViaRendererProps) {
  const outerR = via.outerDiameter / 2;
  const drillR = via.drillDiameter / 2;
  const crossHalf = via.drillDiameter / 4;
  const color = getViaColor(via.type);

  const handleClick = onViaClick
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onViaClick(via.id, e);
      }
    : undefined;

  return (
    <g
      transform={`translate(${via.position.x}, ${via.position.y})`}
      data-testid={`via-${via.id}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Outer copper annular ring */}
      <circle
        r={outerR}
        fill={color}
        data-testid={`via-copper-${via.id}`}
      />

      {/* Drill hole */}
      <circle
        r={drillR}
        fill={BOARD_BACKGROUND}
        data-testid={`via-drill-${via.id}`}
      />

      {/* Tented solder mask overlay */}
      {via.tented && (
        <circle
          r={outerR}
          fill={TENTED_OVERLAY}
          data-testid={`via-tent-${via.id}`}
        />
      )}

      {/* Selection highlight */}
      {selected && (
        <circle
          r={round6(outerR + HIGHLIGHT_EXPANSION)}
          fill="none"
          stroke={HIGHLIGHT_COLOR}
          strokeWidth={HIGHLIGHT_STROKE_WIDTH}
          data-testid={`via-highlight-${via.id}`}
        />
      )}

      {/* Cross marker in drill hole for visibility */}
      <line
        x1={-crossHalf}
        y1={0}
        x2={crossHalf}
        y2={0}
        stroke={CROSS_STROKE}
        strokeWidth={CROSS_STROKE_WIDTH}
      />
      <line
        x1={0}
        y1={-crossHalf}
        x2={0}
        y2={crossHalf}
        stroke={CROSS_STROKE}
        strokeWidth={CROSS_STROKE_WIDTH}
      />
    </g>
  );
});

// ---------------------------------------------------------------------------
// ViaOverlay — renders all vias
// ---------------------------------------------------------------------------

export const ViaOverlay = memo(function ViaOverlay({
  vias,
  selectedViaId,
  onViaClick,
}: ViaOverlayProps) {
  return (
    <g data-testid="via-overlay">
      {vias.map((via) => (
        <ViaRenderer
          key={via.id}
          via={via}
          selected={via.id === selectedViaId}
          onViaClick={onViaClick}
        />
      ))}
    </g>
  );
});
