/**
 * Photorealistic crystal oscillator SVG for breadboard view.
 *
 * Renders a quartz crystal in HC-49 package — silver metal can with
 * two leads. Frequency marking displayed on the body.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo, useMemo } from 'react';

export interface CrystalSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Frequency in Hz (e.g., 16_000_000 for 16MHz) */
  frequency?: number;
}

/** Format frequency for display */
function formatFrequency(hz: number): string {
  if (hz >= 1e6) return `${+(hz / 1e6).toPrecision(3)}MHz`;
  if (hz >= 1e3) return `${+(hz / 1e3).toPrecision(3)}kHz`;
  return `${hz}Hz`;
}

const CrystalSvg = memo(({ cx, cy, frequency = 16_000_000 }: CrystalSvgProps) => {
  const label = useMemo(() => formatFrequency(frequency), [frequency]);

  const bodyW = 22; // HC-49 ~11mm
  const bodyH = 8;
  const leadLen = 8;
  const pinSpacing = 10; // 2 pins, 1 pitch apart

  return (
    <g data-testid="bb-crystal-svg">
      {/* Two leads */}
      <line x1={cx - pinSpacing / 2} y1={cy + bodyH / 2} x2={cx - pinSpacing / 2} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + pinSpacing / 2} y1={cy + bodyH / 2} x2={cx + pinSpacing / 2} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />

      {/* Metal can body — silver with rounded ends */}
      <defs>
        <linearGradient id={`xtal-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0e0e0" />
          <stop offset="30%" stopColor="#c8c8c8" />
          <stop offset="70%" stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#909090" />
        </linearGradient>
      </defs>
      <rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2}
        width={bodyW}
        height={bodyH}
        rx={bodyH / 2}
        ry={bodyH / 2}
        fill={`url(#xtal-body-${cx}-${cy})`}
        stroke="#888"
        strokeWidth={0.4}
      />

      {/* Crimp seams on ends */}
      <line x1={cx - bodyW / 2 + 4} y1={cy - bodyH / 2 + 0.5} x2={cx - bodyW / 2 + 4} y2={cy + bodyH / 2 - 0.5} stroke="#999" strokeWidth={0.3} />
      <line x1={cx + bodyW / 2 - 4} y1={cy - bodyH / 2 + 0.5} x2={cx + bodyW / 2 - 4} y2={cy + bodyH / 2 - 0.5} stroke="#999" strokeWidth={0.3} />

      {/* Frequency marking */}
      <text
        x={cx}
        y={cy + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={3}
        fill="#555"
        className="font-mono select-none pointer-events-none"
      >
        {label}
      </text>

      {/* Specular highlight */}
      <rect
        x={cx - bodyW / 2 + 5}
        y={cy - bodyH / 2 + 1}
        width={bodyW - 10}
        height={1.5}
        rx={0.5}
        fill="white"
        opacity={0.25}
      />
    </g>
  );
});

CrystalSvg.displayName = 'CrystalSvg';
export default CrystalSvg;
export { formatFrequency };
