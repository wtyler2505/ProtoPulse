/**
 * Photorealistic capacitor SVG for breadboard view.
 *
 * Small values (< 1µF): ceramic disc capacitor — flat round body, marking text.
 * Large values (≥ 1µF): electrolytic barrel — aluminium cylinder with polarity stripe.
 */

import { memo } from 'react';

export interface CapacitorSvgProps {
  cx: number;
  cy: number;
  /** Capacitance in farads */
  farads?: number;
}

/** Format farads into a short marking string (e.g. "104", "10µ") */
function capMarking(f: number): string {
  if (f >= 1e-3) return `${+(f * 1e3).toPrecision(2)}m`;
  if (f >= 1e-6) return `${+(f * 1e6).toPrecision(2)}µ`;
  if (f >= 1e-9) return `${+(f * 1e9).toPrecision(2)}n`;
  if (f >= 1e-12) return `${+(f * 1e12).toPrecision(2)}p`;
  return String(f);
}

const CapacitorSvg = memo(({ cx, cy, farads = 100e-9 }: CapacitorSvgProps) => {
  const isElectrolytic = farads >= 1e-6;

  if (isElectrolytic) {
    // Electrolytic barrel capacitor — vertical cylinder
    const barrelW = 14;
    const barrelH = 18;
    const bx = cx - barrelW / 2;
    const by = cy - barrelH / 2;
    const leadLen = 6;

    return (
      <g data-testid="bb-capacitor-svg">
        {/* Leads */}
        <line x1={cx - 3} y1={cy + barrelH / 2} x2={cx - 3} y2={cy + barrelH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={1} strokeLinecap="round" />
        <line x1={cx + 3} y1={cy + barrelH / 2} x2={cx + 3} y2={cy + barrelH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={1} strokeLinecap="round" />

        {/* Barrel body */}
        <defs>
          <linearGradient id={`ecap-body-${cx}-${cy}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a1a3e" />
            <stop offset="30%" stopColor="#2d2d5e" />
            <stop offset="70%" stopColor="#2d2d5e" />
            <stop offset="100%" stopColor="#1a1a3e" />
          </linearGradient>
        </defs>
        <rect x={bx} y={by} width={barrelW} height={barrelH} rx={3} ry={3} fill={`url(#ecap-body-${cx}-${cy})`} stroke="#333355" strokeWidth={0.5} />

        {/* Polarity stripe (negative side, left) */}
        <rect x={bx} y={by} width={4} height={barrelH} rx={3} ry={0} fill="#4a4a7a" opacity={0.6} />

        {/* Minus symbol on stripe */}
        <line x1={bx + 1} y1={cy} x2={bx + 3.5} y2={cy} stroke="#9999cc" strokeWidth={0.8} />

        {/* Top circle (aluminium cap) */}
        <ellipse cx={cx} cy={by + 2} rx={barrelW / 2 - 1} ry={2} fill="#3a3a6a" stroke="#555588" strokeWidth={0.3} />

        {/* Value marking */}
        <text x={cx + 1} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontSize={4} fill="#9999dd" className="font-mono select-none">
          {capMarking(farads)}
        </text>

        {/* Highlight */}
        <rect x={bx + 5} y={by + 1} width={2} height={barrelH - 2} rx={1} fill="white" opacity={0.08} />
      </g>
    );
  }

  // Ceramic disc capacitor — small flat disc
  const discR = 6;
  const leadLen = 6;

  return (
    <g data-testid="bb-capacitor-svg">
      {/* Leads */}
      <line x1={cx - 3} y1={cy + discR} x2={cx - 3} y2={cy + discR + leadLen} stroke="#b0b0b0" strokeWidth={1} strokeLinecap="round" />
      <line x1={cx + 3} y1={cy + discR} x2={cx + 3} y2={cy + discR + leadLen} stroke="#b0b0b0" strokeWidth={1} strokeLinecap="round" />

      {/* Disc body */}
      <defs>
        <radialGradient id={`cdisk-${cx}-${cy}`} cx="40%" cy="35%">
          <stop offset="0%" stopColor="#d4a060" />
          <stop offset="70%" stopColor="#c48840" />
          <stop offset="100%" stopColor="#a06828" />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={discR} ry={discR - 1} fill={`url(#cdisk-${cx}-${cy})`} stroke="#8b6020" strokeWidth={0.4} />

      {/* Marking text */}
      <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={3.5} fill="#5a3a10" className="font-mono select-none">
        {capMarking(farads)}
      </text>

      {/* Highlight */}
      <ellipse cx={cx - 1} cy={cy - 1.5} rx={3} ry={2} fill="white" opacity={0.12} />
    </g>
  );
});

CapacitorSvg.displayName = 'CapacitorSvg';
export default CapacitorSvg;
