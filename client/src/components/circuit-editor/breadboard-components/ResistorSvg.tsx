/**
 * Photorealistic axial resistor SVG for breadboard view.
 *
 * Renders a ~6mm body with real 4-band or 5-band color code derived from
 * the resistor's ohm value.  Wire leads extend from each end.
 *
 * Scaled to breadboard pitch: BB.PITCH = 10px per 0.1″.
 */

import { memo, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Color-band lookup tables
// ---------------------------------------------------------------------------

/** Standard resistor color-band colors (index = digit 0–9) */
const BAND_COLORS: Record<number, string> = {
  0: '#1a1a1a', // black
  1: '#8B4513', // brown
  2: '#ef4444', // red
  3: '#f97316', // orange
  4: '#eab308', // yellow
  5: '#22c55e', // green
  6: '#3b82f6', // blue
  7: '#7c3aed', // violet
  8: '#6b7280', // grey
  9: '#f5f5f5', // white
};

/** Multiplier band colors (10^exp) */
const MULTIPLIER_COLORS: Record<number, string> = {
  0: '#1a1a1a', // ×1       black
  1: '#8B4513', // ×10      brown
  2: '#ef4444', // ×100     red
  3: '#f97316', // ×1k      orange
  4: '#eab308', // ×10k     yellow
  5: '#22c55e', // ×100k    green
  6: '#3b82f6', // ×1M      blue
  7: '#7c3aed', // ×10M     violet
  [-1]: '#FFD700', // ×0.1  gold
  [-2]: '#C0C0C0', // ×0.01 silver
};

/** Tolerance band colors */
const TOLERANCE_GOLD = '#FFD700';

// ---------------------------------------------------------------------------
// Value → band computation
// ---------------------------------------------------------------------------

interface ColorBands {
  band1: string;
  band2: string;
  band3: string; // multiplier for 4-band
  band4: string; // tolerance
}

/**
 * Derive 4-band color code from an ohm value.
 *
 * 4-band: digit1, digit2, multiplier, tolerance (±5% gold).
 */
function ohmsToBands(ohms: number): ColorBands {
  if (ohms <= 0 || !Number.isFinite(ohms)) {
    // Fallback: brown-black-red-gold = 1kΩ
    return { band1: BAND_COLORS[1], band2: BAND_COLORS[0], band3: MULTIPLIER_COLORS[2], band4: TOLERANCE_GOLD };
  }

  // Normalise to two significant digits
  let exp = 0;
  let sig = ohms;
  while (sig >= 100) {
    sig /= 10;
    exp++;
  }
  while (sig < 10 && exp > -2) {
    sig *= 10;
    exp--;
  }

  const d1 = Math.floor(sig / 10) % 10;
  const d2 = Math.round(sig) % 10;

  return {
    band1: BAND_COLORS[d1] ?? BAND_COLORS[0],
    band2: BAND_COLORS[d2] ?? BAND_COLORS[0],
    band3: MULTIPLIER_COLORS[exp] ?? MULTIPLIER_COLORS[0],
    band4: TOLERANCE_GOLD,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ResistorSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Resistance in ohms (used to compute color bands) */
  ohms?: number;
}

/**
 * Photorealistic axial resistor.
 *
 * Body: ~30px wide (3 BB pitches), ~7px tall.  Leads: ~8px each side.
 */
const ResistorSvg = memo(({ cx, cy, ohms = 10_000 }: ResistorSvgProps) => {
  const bands = useMemo(() => ohmsToBands(ohms), [ohms]);

  const bodyW = 30; // 6mm ≈ 3 pitches
  const bodyH = 7; // 2.5mm diameter
  const leadLen = 8;
  const bodyX = cx - bodyW / 2;
  const bodyY = cy - bodyH / 2;

  // Band positions (evenly spaced inside the body)
  const bandW = 3;
  const bandGap = 4;
  const bandStart = bodyX + 4;

  return (
    <g data-testid="bb-resistor-svg">
      {/* Wire leads */}
      <line
        x1={cx - bodyW / 2 - leadLen}
        y1={cy}
        x2={cx - bodyW / 2}
        y2={cy}
        stroke="#b0b0b0"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <line
        x1={cx + bodyW / 2}
        y1={cy}
        x2={cx + bodyW / 2 + leadLen}
        y2={cy}
        stroke="#b0b0b0"
        strokeWidth={1}
        strokeLinecap="round"
      />

      {/* Body — tan/beige ceramic with subtle 3D gradient */}
      <defs>
        <linearGradient id={`res-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8d5b7" />
          <stop offset="40%" stopColor="#d4a373" />
          <stop offset="100%" stopColor="#b08050" />
        </linearGradient>
      </defs>
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={2.5}
        ry={2.5}
        fill={`url(#res-body-${cx}-${cy})`}
        stroke="#8b5e34"
        strokeWidth={0.4}
      />

      {/* Color bands */}
      <rect x={bandStart} y={bodyY + 0.5} width={bandW} height={bodyH - 1} rx={0.5} fill={bands.band1} />
      <rect x={bandStart + bandGap} y={bodyY + 0.5} width={bandW} height={bodyH - 1} rx={0.5} fill={bands.band2} />
      <rect x={bandStart + bandGap * 2} y={bodyY + 0.5} width={bandW} height={bodyH - 1} rx={0.5} fill={bands.band3} />
      {/* Tolerance band — slightly offset toward the other end */}
      <rect
        x={bodyX + bodyW - bandW - 3}
        y={bodyY + 0.5}
        width={bandW}
        height={bodyH - 1}
        rx={0.5}
        fill={bands.band4}
      />

      {/* Subtle highlight for 3D effect */}
      <rect
        x={bodyX + 1}
        y={bodyY + 1}
        width={bodyW - 2}
        height={2}
        rx={1}
        fill="white"
        opacity={0.15}
      />
    </g>
  );
});

ResistorSvg.displayName = 'ResistorSvg';
export default ResistorSvg;
export { ohmsToBands, BAND_COLORS, MULTIPLIER_COLORS };
