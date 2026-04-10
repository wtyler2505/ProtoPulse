/**
 * Photorealistic piezo buzzer SVG for breadboard view.
 *
 * Renders a cylindrical piezo buzzer with two pins and a sound hole pattern.
 * The `active` prop shows vibration lines when sounding.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo } from 'react';

export interface BuzzerSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Whether the buzzer is actively sounding */
  active?: boolean;
}

const BuzzerSvg = memo(({ cx, cy, active = false }: BuzzerSvgProps) => {
  const bodyR = 9; // ~9mm diameter
  const leadLen = 8;
  const pinSpacing = 8;

  return (
    <g data-testid="bb-buzzer-svg">
      {/* Two leads */}
      <line x1={cx - pinSpacing / 2} y1={cy + bodyR} x2={cx - pinSpacing / 2} y2={cy + bodyR + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + pinSpacing / 2} y1={cy + bodyR} x2={cx + pinSpacing / 2} y2={cy + bodyR + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />

      {/* Body — dark cylinder */}
      <defs>
        <radialGradient id={`buz-body-${cx}-${cy}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="70%" stopColor="#222" />
          <stop offset="100%" stopColor="#111" />
        </radialGradient>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={bodyR}
        fill={`url(#buz-body-${cx}-${cy})`}
        stroke="#333"
        strokeWidth={0.5}
      />

      {/* Sound hole — center opening */}
      <circle cx={cx} cy={cy} r={2} fill="#1a1a1a" stroke="#333" strokeWidth={0.3} />

      {/* Concentric ring pattern */}
      <circle cx={cx} cy={cy} r={4.5} fill="none" stroke="#2a2a2a" strokeWidth={0.3} />
      <circle cx={cx} cy={cy} r={6.5} fill="none" stroke="#2a2a2a" strokeWidth={0.3} />

      {/* Polarity marking (+) */}
      <text
        x={cx + pinSpacing / 2}
        y={cy + bodyR - 2}
        textAnchor="middle"
        fontSize={3}
        fill="#999"
        className="font-mono select-none pointer-events-none"
      >
        +
      </text>

      {/* Sound waves when active */}
      {active && (
        <>
          <path d={`M${cx + bodyR + 2},${cy - 3} Q${cx + bodyR + 5},${cy} ${cx + bodyR + 2},${cy + 3}`} fill="none" stroke="#4a90d9" strokeWidth={0.6} opacity={0.6} />
          <path d={`M${cx + bodyR + 4},${cy - 5} Q${cx + bodyR + 8},${cy} ${cx + bodyR + 4},${cy + 5}`} fill="none" stroke="#4a90d9" strokeWidth={0.5} opacity={0.4} />
        </>
      )}

      {/* Specular highlight */}
      <circle cx={cx - 3} cy={cy - 3} r={2.5} fill="white" opacity={0.08} />
    </g>
  );
});

BuzzerSvg.displayName = 'BuzzerSvg';
export default BuzzerSvg;
