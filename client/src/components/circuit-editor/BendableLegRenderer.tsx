/**
 * BendableLegRenderer — SVG renderer for bendable component legs (BL-0593).
 *
 * Renders curved metallic wire legs from component body pins to breadboard
 * holes using quadratic bezier paths. Each leg has a metallic gradient,
 * hover highlight, and an insertion dot at the hole end.
 */

import { memo, useMemo, useState, useCallback } from 'react';
import {
  computeComponentLegs,
  legPathToSvgD,
} from '@/lib/circuit-editor/bendable-legs';
import { pixelToCoord } from '@/lib/circuit-editor/breadboard-model';
import { detectExtendedType } from './BreadboardComponentRenderer';
import type { LegPath, LegComponentType } from '@/lib/circuit-editor/bendable-legs';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import type { ColumnLetter } from '@/lib/circuit-editor/breadboard-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BendableLegRendererProps {
  instances: CircuitInstanceRow[];
  parts: ComponentPart[];
}

// ---------------------------------------------------------------------------
// SVG gradient definitions (shared across all legs)
// ---------------------------------------------------------------------------

/** Shared SVG defs for metallic leg gradients. Render once per SVG root. */
export const LegGradientDefs = memo(() => (
  <defs>
    {/* Silver metallic gradient for IC/transistor/generic */}
    <linearGradient id="leg-grad-silver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#d4d4d4" />
      <stop offset="40%" stopColor="#b0b0b0" />
      <stop offset="100%" stopColor="#8a8a8a" />
    </linearGradient>
    {/* Tinned copper for resistor/diode */}
    <linearGradient id="leg-grad-copper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#d8c0a0" />
      <stop offset="40%" stopColor="#c0a080" />
      <stop offset="100%" stopColor="#a08060" />
    </linearGradient>
    {/* Gold tint for capacitor */}
    <linearGradient id="leg-grad-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#d8c870" />
      <stop offset="40%" stopColor="#c8b060" />
      <stop offset="100%" stopColor="#a89840" />
    </linearGradient>
    {/* LED cathode (darker) */}
    <linearGradient id="leg-grad-cathode" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#b0b0b0" />
      <stop offset="40%" stopColor="#909090" />
      <stop offset="100%" stopColor="#707070" />
    </linearGradient>
    {/* LED anode (lighter) */}
    <linearGradient id="leg-grad-anode" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#d0d0d0" />
      <stop offset="40%" stopColor="#b8b8b8" />
      <stop offset="100%" stopColor="#999999" />
    </linearGradient>
  </defs>
));
LegGradientDefs.displayName = 'LegGradientDefs';

/** Map component type + pin index to gradient ID */
function getGradientId(componentType: LegComponentType, pinIndex: number): string {
  switch (componentType) {
    case 'resistor':
    case 'diode':
      return 'url(#leg-grad-copper)';
    case 'capacitor':
      return 'url(#leg-grad-gold)';
    case 'led':
      return pinIndex === 0 ? 'url(#leg-grad-cathode)' : 'url(#leg-grad-anode)';
    case 'ic':
    case 'transistor':
    case 'generic':
    default:
      return 'url(#leg-grad-silver)';
  }
}

// ---------------------------------------------------------------------------
// Single Leg component
// ---------------------------------------------------------------------------

interface LegSvgProps {
  leg: LegPath;
  componentType: LegComponentType;
  pinIndex: number;
}

const LegSvg = memo(({ leg, componentType, pinIndex }: LegSvgProps) => {
  const [hovered, setHovered] = useState(false);
  const d = useMemo(() => legPathToSvgD(leg), [leg]);
  const gradientFill = getGradientId(componentType, pinIndex);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  return (
    <g
      data-testid={`bendable-leg-${leg.legId}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover highlight glow */}
      {hovered && (
        <path
          d={d}
          stroke="var(--color-editor-accent)"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.3}
          style={{ filter: 'blur(1px)' }}
          pointerEvents="none"
        />
      )}

      {/* Main leg wire */}
      <path
        d={d}
        stroke={gradientFill}
        strokeWidth={hovered ? 1.4 : 1}
        strokeLinecap="round"
        fill="none"
        className="transition-all duration-150"
        style={{ cursor: 'default' }}
      />

      {/* Insertion dot at hole end */}
      <circle
        cx={leg.endHole.x}
        cy={leg.endHole.y}
        r={hovered ? 1.5 : 1}
        fill={leg.legColor}
        opacity={hovered ? 1 : 0.6}
        className="transition-all duration-150"
      />
    </g>
  );
});
LegSvg.displayName = 'LegSvg';

// ---------------------------------------------------------------------------
// Instance Legs (all legs for one component)
// ---------------------------------------------------------------------------

interface InstanceLegsProps {
  instance: CircuitInstanceRow;
  part?: ComponentPart;
}

const InstanceLegs = memo(({ instance, part }: InstanceLegsProps) => {
  const legs = useMemo(() => {
    if (instance.breadboardX == null || instance.breadboardY == null) return [];

    // Determine component type
    const type = (part?.meta as Record<string, unknown>)?.type as string | undefined
      ?? (instance.properties as Record<string, unknown>)?.type as string | undefined;
    const extType = detectExtendedType(type);
    const componentType: LegComponentType = (extType as LegComponentType | null) ?? 'generic';

    // Determine pin count
    const pinCount = (part?.connectors as unknown[])?.length ?? 2;

    // Resolve anchor coordinate from pixel position
    const anchorPixel = { x: instance.breadboardX, y: instance.breadboardY };
    const coord = pixelToCoord(anchorPixel);
    if (!coord || coord.type !== 'terminal') return [];

    return computeComponentLegs(
      instance.breadboardX,
      instance.breadboardY,
      coord.col as ColumnLetter,
      coord.row,
      componentType,
      pinCount,
      instance.id,
    );
  }, [instance.breadboardX, instance.breadboardY, instance.id, instance.properties, part]);

  if (legs.length === 0) return null;

  // Determine component type for gradient lookup
  const type = (part?.meta as Record<string, unknown>)?.type as string | undefined
    ?? (instance.properties as Record<string, unknown>)?.type as string | undefined;
  const extType = detectExtendedType(type);
  const componentType: LegComponentType = (extType as LegComponentType | null) ?? 'generic';

  return (
    <g data-testid={`bb-legs-${instance.id}`}>
      {legs.map((leg, idx) => (
        <LegSvg
          key={leg.legId}
          leg={leg}
          componentType={componentType}
          pinIndex={idx}
        />
      ))}
    </g>
  );
});
InstanceLegs.displayName = 'InstanceLegs';

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

/**
 * Renders bendable legs for all through-hole component instances on the
 * breadboard. Should be rendered as a sibling layer beneath the component
 * overlay so legs appear behind component bodies.
 */
const BendableLegRenderer = memo(({ instances, parts }: BendableLegRendererProps) => {
  const partsMap = useMemo(() => new Map(parts.map(p => [p.id, p])), [parts]);

  // Only render legs for instances that are placed on the breadboard
  const placedInstances = useMemo(
    () => instances.filter(i => i.breadboardX != null && i.breadboardY != null),
    [instances],
  );

  if (placedInstances.length === 0) return null;

  return (
    <g data-testid="bb-bendable-legs-overlay">
      <LegGradientDefs />
      {placedInstances.map(inst => (
        <InstanceLegs
          key={inst.id}
          instance={inst}
          part={inst.partId ? partsMap.get(inst.partId) : undefined}
        />
      ))}
    </g>
  );
});
BendableLegRenderer.displayName = 'BendableLegRenderer';

export default BendableLegRenderer;
