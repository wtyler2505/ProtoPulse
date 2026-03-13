/**
 * Photorealistic LED SVG for breadboard view.
 *
 * Colored translucent dome with radial gradient for 3D appearance.
 * Flat cathode side indicated by a cut.  Optional glow filter when active.
 */

import { memo } from 'react';

// LED color hex lookup
const LED_HEX: Record<string, string> = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  white: '#f5f5f5',
  orange: '#f97316',
};

export interface LedSvgProps {
  cx: number;
  cy: number;
  color?: string;
  /** 0–1 brightness (0 = off, >0 = on with glow) */
  brightness?: number;
}

const LedSvg = memo(({ cx, cy, color = 'red', brightness = 0 }: LedSvgProps) => {
  const hex = LED_HEX[color.toLowerCase()] ?? color;
  const isOn = brightness > 0.1;
  const domeR = 5;
  const leadLen = 8;

  // Lighter tint for gradient center
  const lightHex = hex === '#f5f5f5' ? '#ffffff' : hex;

  return (
    <g data-testid="bb-led-svg">
      {/* Leads — anode (longer, right) and cathode (shorter, left) */}
      <line x1={cx - 2} y1={cy + domeR} x2={cx - 2} y2={cy + domeR + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + 2} y1={cy + domeR} x2={cx + 2} y2={cy + domeR + leadLen + 2} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />

      {/* Glow when active */}
      {isOn && (
        <>
          <defs>
            <filter id={`led-glow-${cx}-${cy}`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={4 * brightness} />
            </filter>
          </defs>
          <circle
            cx={cx}
            cy={cy}
            r={domeR * 2.5}
            fill={hex}
            opacity={0.25 * brightness}
            filter={`url(#led-glow-${cx}-${cy})`}
          />
        </>
      )}

      {/* Dome body — radial gradient for 3D */}
      <defs>
        <radialGradient id={`led-dome-${cx}-${cy}`} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor={lightHex} stopOpacity={isOn ? 1 : 0.7} />
          <stop offset="60%" stopColor={hex} stopOpacity={isOn ? 0.9 : 0.5} />
          <stop offset="100%" stopColor={hex} stopOpacity={isOn ? 0.7 : 0.35} />
        </radialGradient>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={domeR}
        fill={`url(#led-dome-${cx}-${cy})`}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={0.5}
      />

      {/* Cathode flat cut indicator */}
      <line
        x1={cx - domeR + 1}
        y1={cy + domeR - 1.5}
        x2={cx + domeR - 1}
        y2={cy + domeR - 1.5}
        stroke="rgba(0,0,0,0.15)"
        strokeWidth={0.8}
      />

      {/* Specular highlight */}
      <circle cx={cx - 1.5} cy={cy - 1.5} r={1.5} fill="white" opacity={0.45} />
    </g>
  );
});

LedSvg.displayName = 'LedSvg';
export default LedSvg;
