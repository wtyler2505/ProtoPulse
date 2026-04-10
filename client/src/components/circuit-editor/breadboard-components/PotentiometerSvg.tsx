/**
 * Photorealistic potentiometer SVG for breadboard view.
 *
 * Renders a trimmer-style potentiometer with an adjustable wiper knob.
 * The dial position reflects the `position` prop (0–1, left to right).
 * Three pins: pin 1 (left), wiper (center), pin 3 (right).
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo, useMemo } from 'react';

export interface PotentiometerSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Wiper position 0–1 (0 = full CCW, 1 = full CW) */
  position?: number;
  /** Resistance in ohms (for label) */
  ohms?: number;
}

/** Format resistance for label display */
function formatResistance(ohms: number): string {
  if (ohms >= 1e6) return `${+(ohms / 1e6).toPrecision(2)}M`;
  if (ohms >= 1e3) return `${+(ohms / 1e3).toPrecision(2)}k`;
  return `${ohms}`;
}

const PotentiometerSvg = memo(({ cx, cy, position = 0.5, ohms = 10_000 }: PotentiometerSvgProps) => {
  const clamped = Math.max(0, Math.min(1, position));
  const label = useMemo(() => formatResistance(ohms), [ohms]);

  const bodyR = 10; // body radius
  const leadLen = 8;
  const pinSpacing = 10; // 1 pitch between pins

  // Wiper angle: -135° (CCW) to +135° (CW)
  const wiperAngle = -135 + clamped * 270;
  const wiperLen = bodyR - 3;
  const wiperRad = (wiperAngle * Math.PI) / 180;
  const wiperX = cx + Math.cos(wiperRad) * wiperLen;
  const wiperY = cy + Math.sin(wiperRad) * wiperLen;

  return (
    <g data-testid="bb-potentiometer-svg">
      {/* Three leads — pin 1 (left), wiper (center), pin 3 (right) */}
      <line x1={cx - pinSpacing} y1={cy + bodyR} x2={cx - pinSpacing} y2={cy + bodyR + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx} y1={cy + bodyR} x2={cx} y2={cy + bodyR + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + pinSpacing} y1={cy + bodyR} x2={cx + pinSpacing} y2={cy + bodyR + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />

      {/* Body — blue trimmer housing */}
      <defs>
        <radialGradient id={`pot-body-${cx}-${cy}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#5b8abf" />
          <stop offset="70%" stopColor="#2d5a8e" />
          <stop offset="100%" stopColor="#1e3d5f" />
        </radialGradient>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={bodyR}
        fill={`url(#pot-body-${cx}-${cy})`}
        stroke="#1a3350"
        strokeWidth={0.5}
      />

      {/* Screw slot / wiper indicator */}
      <line
        x1={cx}
        y1={cy}
        x2={wiperX}
        y2={wiperY}
        stroke="#d4d4d4"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* Center knob */}
      <circle cx={cx} cy={cy} r={3} fill="#c0c0c0" stroke="#888" strokeWidth={0.4} />

      {/* Screw cross on knob */}
      <line x1={cx - 1.5} y1={cy} x2={cx + 1.5} y2={cy} stroke="#666" strokeWidth={0.6} strokeLinecap="round" />
      <line x1={cx} y1={cy - 1.5} x2={cx} y2={cy + 1.5} stroke="#666" strokeWidth={0.6} strokeLinecap="round" />

      {/* Value label */}
      <text
        x={cx}
        y={cy - bodyR - 2}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={3.5}
        fill="#94a3b8"
        className="font-mono select-none pointer-events-none"
      >
        {label}
      </text>

      {/* Specular highlight */}
      <circle cx={cx - 3} cy={cy - 3} r={2} fill="white" opacity={0.12} />
    </g>
  );
});

PotentiometerSvg.displayName = 'PotentiometerSvg';
export default PotentiometerSvg;
export { formatResistance };
