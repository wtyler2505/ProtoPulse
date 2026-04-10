/**
 * Photorealistic glass fuse SVG for breadboard view.
 *
 * Renders a 5×20mm glass cartridge fuse with metal end caps and
 * a visible fuse wire inside. The `blown` prop shows a broken wire.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo, useMemo } from 'react';

export interface FuseSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Current rating in amps (for label) */
  amps?: number;
  /** Whether the fuse is blown */
  blown?: boolean;
}

/** Format amp rating for display */
function formatAmps(a: number): string {
  if (a >= 1) return `${a}A`;
  return `${a * 1000}mA`;
}

const FuseSvg = memo(({ cx, cy, amps = 1, blown = false }: FuseSvgProps) => {
  const label = useMemo(() => formatAmps(amps), [amps]);

  const bodyW = 28; // ~20mm tube length
  const bodyH = 6;
  const capW = 4; // metal end caps
  const leadLen = 6;

  return (
    <g data-testid="bb-fuse-svg">
      {/* Leads */}
      <line x1={cx - bodyW / 2 - leadLen} y1={cy} x2={cx - bodyW / 2} y2={cy} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + bodyW / 2} y1={cy} x2={cx + bodyW / 2 + leadLen} y2={cy} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />

      {/* Glass tube body */}
      <defs>
        <linearGradient id={`fuse-glass-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(200,220,240,0.6)" />
          <stop offset="50%" stopColor="rgba(180,200,220,0.4)" />
          <stop offset="100%" stopColor="rgba(160,180,200,0.5)" />
        </linearGradient>
      </defs>
      <rect
        x={cx - bodyW / 2 + capW}
        y={cy - bodyH / 2}
        width={bodyW - capW * 2}
        height={bodyH}
        rx={bodyH / 2}
        fill={`url(#fuse-glass-${cx}-${cy})`}
        stroke="rgba(150,170,190,0.6)"
        strokeWidth={0.3}
      />

      {/* Metal end caps */}
      <rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2}
        width={capW}
        height={bodyH}
        rx={0.5}
        fill="#c0c0c0"
        stroke="#999"
        strokeWidth={0.3}
      />
      <rect
        x={cx + bodyW / 2 - capW}
        y={cy - bodyH / 2}
        width={capW}
        height={bodyH}
        rx={0.5}
        fill="#c0c0c0"
        stroke="#999"
        strokeWidth={0.3}
      />

      {/* Internal fuse wire */}
      {!blown ? (
        <line
          x1={cx - bodyW / 2 + capW + 1}
          y1={cy}
          x2={cx + bodyW / 2 - capW - 1}
          y2={cy}
          stroke="#999"
          strokeWidth={0.5}
        />
      ) : (
        <>
          {/* Broken wire — two stubs with gap */}
          <line x1={cx - bodyW / 2 + capW + 1} y1={cy} x2={cx - 3} y2={cy} stroke="#666" strokeWidth={0.5} />
          <line x1={cx + 3} y1={cy} x2={cx + bodyW / 2 - capW - 1} y2={cy} stroke="#666" strokeWidth={0.5} />
          {/* Scorch mark at break point */}
          <circle cx={cx} cy={cy} r={1.5} fill="rgba(80,60,40,0.4)" />
        </>
      )}

      {/* Rating label */}
      <text
        x={cx}
        y={cy - bodyH / 2 - 2}
        textAnchor="middle"
        fontSize={3}
        fill="#94a3b8"
        className="font-mono select-none pointer-events-none"
      >
        {label}
      </text>

      {/* Glass highlight */}
      <rect
        x={cx - bodyW / 2 + capW + 2}
        y={cy - bodyH / 2 + 0.5}
        width={bodyW - capW * 2 - 4}
        height={1.5}
        rx={0.5}
        fill="white"
        opacity={0.2}
      />
    </g>
  );
});

FuseSvg.displayName = 'FuseSvg';
export default FuseSvg;
export { formatAmps };
