/**
 * Photorealistic glass-body diode SVG for breadboard view.
 *
 * Transparent glass body with a visible cathode band marking.
 * Wire leads extend from each end.
 */

import { memo } from 'react';

export interface DiodeSvgProps {
  cx: number;
  cy: number;
}

const DiodeSvg = memo(({ cx, cy }: DiodeSvgProps) => {
  const bodyW = 20;
  const bodyH = 5;
  const leadLen = 8;
  const bx = cx - bodyW / 2;
  const by = cy - bodyH / 2;

  return (
    <g data-testid="bb-diode-svg">
      {/* Wire leads */}
      <line x1={cx - bodyW / 2 - leadLen} y1={cy} x2={cx - bodyW / 2} y2={cy} stroke="#b0b0b0" strokeWidth={1} strokeLinecap="round" />
      <line x1={cx + bodyW / 2} y1={cy} x2={cx + bodyW / 2 + leadLen} y2={cy} stroke="#b0b0b0" strokeWidth={1} strokeLinecap="round" />

      {/* Glass body */}
      <defs>
        <linearGradient id={`diode-glass-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8c9a0" stopOpacity={0.6} />
          <stop offset="50%" stopColor="#d4a373" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#c08050" stopOpacity={0.5} />
        </linearGradient>
      </defs>
      <rect
        x={bx}
        y={by}
        width={bodyW}
        height={bodyH}
        rx={2}
        ry={2}
        fill={`url(#diode-glass-${cx}-${cy})`}
        stroke="#a07848"
        strokeWidth={0.4}
      />

      {/* Cathode band (silver/dark stripe near one end) */}
      <rect
        x={bx + bodyW - 5}
        y={by}
        width={3}
        height={bodyH}
        rx={0.5}
        fill="#2a2a2a"
        opacity={0.8}
      />

      {/* Inner element visible through glass */}
      <rect x={bx + 3} y={by + 1} width={bodyW - 9} height={bodyH - 2} rx={1} fill="#333" opacity={0.25} />

      {/* Glass highlight */}
      <rect x={bx + 1} y={by + 0.5} width={bodyW - 2} height={1.5} rx={0.8} fill="white" opacity={0.18} />
    </g>
  );
});

DiodeSvg.displayName = 'DiodeSvg';
export default DiodeSvg;
