/**
 * Photorealistic jumper wire SVG for breadboard view.
 *
 * Colored insulation with exposed copper ends.
 */

import { memo } from 'react';

export interface WireSvgProps {
  /** Start point */
  x1: number;
  y1: number;
  /** End point */
  x2: number;
  y2: number;
  /** Insulation color */
  color?: string;
}

const WireSvg = memo(({ x1, y1, x2, y2, color = '#e74c3c' }: WireSvgProps) => {
  const exposeLen = 3; // exposed copper length at each end

  // Direction vector (normalised)
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.1) return null;

  const nx = dx / len;
  const ny = dy / len;

  // Exposed copper endpoints
  const insX1 = x1 + nx * exposeLen;
  const insY1 = y1 + ny * exposeLen;
  const insX2 = x2 - nx * exposeLen;
  const insY2 = y2 - ny * exposeLen;

  return (
    <g data-testid="bb-wire-svg">
      {/* Exposed copper ends */}
      <line x1={x1} y1={y1} x2={insX1} y2={insY1} stroke="#d4a060" strokeWidth={1.8} strokeLinecap="round" />
      <line x1={insX2} y1={insY2} x2={x2} y2={y2} stroke="#d4a060" strokeWidth={1.8} strokeLinecap="round" />

      {/* Insulated wire body */}
      <line x1={insX1} y1={insY1} x2={insX2} y2={insY2} stroke={color} strokeWidth={2.2} strokeLinecap="round" />

      {/* Highlight along the wire for 3D */}
      <line x1={insX1} y1={insY1} x2={insX2} y2={insY2} stroke="white" strokeWidth={0.5} strokeLinecap="round" opacity={0.15} />
    </g>
  );
});

WireSvg.displayName = 'WireSvg';
export default WireSvg;
