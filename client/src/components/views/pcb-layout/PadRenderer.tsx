/**
 * PadRenderer -- Pure SVG component that renders a single PCB pad.
 *
 * Renders inside an <svg> element. Handles SMD (rect/circle) and THT
 * (circle/oblong with drill hole) pads, layer-aware coloring, selection
 * highlights, solder mask outlines, and rotation transforms.
 */

import { memo } from 'react';
import type { Pad } from '@/lib/pcb/footprint-library';

// ---------------------------------------------------------------------------
// Layer colors — consistent with ComponentPlacer.ts
// ---------------------------------------------------------------------------

const LAYER_COLORS = {
  front: '#ef4444',
  back: '#3b82f6',
  both: '#c8a832', // copper/THT color
} as const;

const BOARD_COLOR = '#1a1a2e';
const HIGHLIGHT_COLOR = '#00F0FF';
const SOLDER_MASK_COLOR = '#22c55e40';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PadRendererProps {
  pad: Pad;
  componentX: number; // mm, component center
  componentY: number; // mm, component center
  rotation: number; // degrees
  scale: number; // px per mm
  selected: boolean;
  activeLayer: string;
  onPadClick?: (padNumber: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLayerColor(layer: string): string {
  if (layer === 'front') {
    return LAYER_COLORS.front;
  }
  if (layer === 'back') {
    return LAYER_COLORS.back;
  }
  return LAYER_COLORS.both;
}

function getPadOpacity(padLayer: string, activeLayer: string): number {
  if (padLayer === 'both') {
    return 1;
  }
  return padLayer === activeLayer ? 1 : 0.3;
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

interface PadShapeProps {
  pad: Pad;
  cx: number;
  cy: number;
  scale: number;
  color: string;
}

function SmdRectPad({ pad, cx, cy, scale, color }: PadShapeProps) {
  const w = pad.width * scale;
  const h = pad.height * scale;
  const rx = pad.cornerRadius ? pad.cornerRadius * scale : 0;

  return (
    <rect
      data-testid={`pad-${pad.number}`}
      x={cx - w / 2}
      y={cy - h / 2}
      width={w}
      height={h}
      rx={rx}
      fill={`${color}40`}
      stroke={color}
      strokeWidth={0.5}
    />
  );
}

function SmdCirclePad({ pad, cx, cy, scale, color }: PadShapeProps) {
  const r = (Math.min(pad.width, pad.height) / 2) * scale;

  return (
    <circle
      data-testid={`pad-${pad.number}`}
      cx={cx}
      cy={cy}
      r={r}
      fill={`${color}40`}
      stroke={color}
      strokeWidth={0.5}
    />
  );
}

function ThtCirclePad({ pad, cx, cy, scale, color }: PadShapeProps) {
  const outerR = (Math.min(pad.width, pad.height) / 2) * scale;
  const drillR = ((pad.drill ?? 0.8) / 2) * scale;

  return (
    <>
      <circle
        data-testid={`pad-${pad.number}`}
        cx={cx}
        cy={cy}
        r={outerR}
        fill={`${color}60`}
        stroke={color}
        strokeWidth={0.5}
      />
      <circle
        data-testid={`pad-drill-${pad.number}`}
        cx={cx}
        cy={cy}
        r={drillR}
        fill={BOARD_COLOR}
        stroke={`${color}80`}
        strokeWidth={0.3}
      />
    </>
  );
}

function ThtOblongPad({ pad, cx, cy, scale, color }: PadShapeProps) {
  const w = pad.width * scale;
  const h = pad.height * scale;
  const rx = (Math.min(pad.width, pad.height) / 2) * scale;
  const drillR = ((pad.drill ?? 0.8) / 2) * scale;

  return (
    <>
      <rect
        data-testid={`pad-${pad.number}`}
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        rx={rx}
        fill={`${color}60`}
        stroke={color}
        strokeWidth={0.5}
      />
      <circle
        data-testid={`pad-drill-${pad.number}`}
        cx={cx}
        cy={cy}
        r={drillR}
        fill={BOARD_COLOR}
        stroke={`${color}80`}
        strokeWidth={0.3}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Selection highlight
// ---------------------------------------------------------------------------

interface HighlightProps {
  pad: Pad;
  cx: number;
  cy: number;
  scale: number;
}

function SelectionHighlight({ pad, cx, cy, scale }: HighlightProps) {
  const expand = 0.15 * scale; // 0.15mm highlight expansion
  const isCircular = pad.shape === 'circle';

  if (isCircular) {
    const r = (Math.min(pad.width, pad.height) / 2) * scale + expand;
    return (
      <circle
        data-testid={`pad-highlight-${pad.number}`}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={HIGHLIGHT_COLOR}
        strokeWidth={0.8}
        strokeDasharray="2,1"
      />
    );
  }

  const w = pad.width * scale + expand * 2;
  const h = pad.height * scale + expand * 2;

  return (
    <rect
      data-testid={`pad-highlight-${pad.number}`}
      x={cx - w / 2}
      y={cy - h / 2}
      width={w}
      height={h}
      rx={pad.cornerRadius ? pad.cornerRadius * scale : 0}
      fill="none"
      stroke={HIGHLIGHT_COLOR}
      strokeWidth={0.8}
      strokeDasharray="2,1"
    />
  );
}

// ---------------------------------------------------------------------------
// Solder mask outline
// ---------------------------------------------------------------------------

interface SolderMaskProps {
  pad: Pad;
  cx: number;
  cy: number;
  scale: number;
}

function SolderMaskOutline({ pad, cx, cy, scale }: SolderMaskProps) {
  const expansion = (pad.solderMaskExpansion ?? 0) * scale;
  if (expansion <= 0) {
    return null;
  }

  const isCircular = pad.shape === 'circle';

  if (isCircular) {
    const r = (Math.min(pad.width, pad.height) / 2) * scale + expansion;
    return (
      <circle
        data-testid={`pad-mask-${pad.number}`}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={SOLDER_MASK_COLOR}
        strokeWidth={0.4}
      />
    );
  }

  const w = pad.width * scale + expansion * 2;
  const h = pad.height * scale + expansion * 2;

  return (
    <rect
      data-testid={`pad-mask-${pad.number}`}
      x={cx - w / 2}
      y={cy - h / 2}
      width={w}
      height={h}
      rx={pad.cornerRadius ? pad.cornerRadius * scale : 0}
      fill="none"
      stroke={SOLDER_MASK_COLOR}
      strokeWidth={0.4}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const PadRenderer = memo(function PadRenderer({
  pad,
  componentX,
  componentY,
  rotation,
  scale,
  selected,
  activeLayer,
  onPadClick,
}: PadRendererProps) {
  const cx = (componentX + pad.position.x) * scale;
  const cy = (componentY + pad.position.y) * scale;
  const opacity = getPadOpacity(pad.layer, activeLayer);
  const color = getLayerColor(pad.layer);

  const rotationCenter = { x: componentX * scale, y: componentY * scale };
  const hasRotation = rotation !== 0;

  const shapeProps: PadShapeProps = { pad, cx, cy, scale, color };

  const handleClick = onPadClick
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onPadClick(pad.number);
      }
    : undefined;

  let padShape: React.ReactNode;

  if (pad.type === 'tht') {
    if (pad.shape === 'oblong' || pad.shape === 'rect' || pad.shape === 'roundrect') {
      padShape = <ThtOblongPad {...shapeProps} />;
    } else {
      padShape = <ThtCirclePad {...shapeProps} />;
    }
  } else {
    if (pad.shape === 'circle') {
      padShape = <SmdCirclePad {...shapeProps} />;
    } else {
      padShape = <SmdRectPad {...shapeProps} />;
    }
  }

  return (
    <g
      data-testid={`pad-group-${pad.number}`}
      opacity={opacity}
      transform={hasRotation ? `rotate(${rotation}, ${rotationCenter.x}, ${rotationCenter.y})` : undefined}
      onClick={handleClick}
      style={onPadClick ? { cursor: 'pointer' } : undefined}
    >
      {pad.solderMaskExpansion != null && pad.solderMaskExpansion > 0 && (
        <SolderMaskOutline pad={pad} cx={cx} cy={cy} scale={scale} />
      )}
      {padShape}
      {selected && <SelectionHighlight pad={pad} cx={cx} cy={cy} scale={scale} />}
    </g>
  );
});
