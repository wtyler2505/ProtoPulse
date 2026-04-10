/**
 * Photorealistic DC motor SVG for breadboard view.
 *
 * Renders a small DC hobby motor (FA-130 style) with a cylindrical body,
 * shaft, and two wire leads. The `spinning` prop shows rotation indicator.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo } from 'react';

export interface MotorSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Whether the motor is spinning */
  spinning?: boolean;
  /** Voltage rating (for label) */
  voltage?: number;
}

const MotorSvg = memo(({ cx, cy, spinning = false, voltage = 6 }: MotorSvgProps) => {
  const bodyR = 10; // motor can radius
  const bodyW = 20; // length (side view rendered as oval)
  const leadLen = 8;

  return (
    <g data-testid="bb-motor-svg">
      {/* Two leads — terminals at bottom */}
      <line x1={cx - 4} y1={cy + bodyR} x2={cx - 4} y2={cy + bodyR + leadLen} stroke="#ef4444" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + 4} y1={cy + bodyR} x2={cx + 4} y2={cy + bodyR + leadLen} stroke="#1a1a1a" strokeWidth={0.8} strokeLinecap="round" />

      {/* Motor body — silver cylindrical can */}
      <defs>
        <radialGradient id={`mot-body-${cx}-${cy}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#d0d0d0" />
          <stop offset="50%" stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#808080" />
        </radialGradient>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={bodyR}
        fill={`url(#mot-body-${cx}-${cy})`}
        stroke="#666"
        strokeWidth={0.5}
      />

      {/* End cap / back plate */}
      <circle cx={cx} cy={cy} r={bodyR - 2} fill="none" stroke="#999" strokeWidth={0.3} />

      {/* Shaft — protruding from top */}
      <line x1={cx} y1={cy - bodyR} x2={cx} y2={cy - bodyR - 6} stroke="#c0c0c0" strokeWidth={1.5} strokeLinecap="round" />

      {/* Shaft flats (D-shape indicator) */}
      <rect
        x={cx - 0.5}
        y={cy - bodyR - 5}
        width={1}
        height={3}
        fill="#aaa"
      />

      {/* Terminal dots */}
      <circle cx={cx - 4} cy={cy + bodyR - 2} r={1} fill="#ef4444" stroke="#cc3333" strokeWidth={0.2} />
      <circle cx={cx + 4} cy={cy + bodyR - 2} r={1} fill="#333" stroke="#222" strokeWidth={0.2} />

      {/* "M" marking */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={6}
        fill="#666"
        className="font-mono select-none pointer-events-none"
        fontWeight="bold"
      >
        M
      </text>

      {/* Voltage label */}
      <text
        x={cx}
        y={cy + bodyR + leadLen + 4}
        textAnchor="middle"
        fontSize={3}
        fill="#94a3b8"
        className="font-mono select-none pointer-events-none"
      >
        {voltage}V
      </text>

      {/* Spinning indicator — rotation arc */}
      {spinning && (
        <>
          <path
            d={`M${cx - 3},${cy - bodyR - 8} A3,3 0 0,1 ${cx + 3},${cy - bodyR - 8}`}
            fill="none"
            stroke="#4a90d9"
            strokeWidth={0.6}
            opacity={0.6}
          />
          <path
            d={`M${cx + 2},${cy - bodyR - 9} L${cx + 3},${cy - bodyR - 8} L${cx + 2},${cy - bodyR - 7}`}
            fill="none"
            stroke="#4a90d9"
            strokeWidth={0.5}
            opacity={0.6}
          />
        </>
      )}

      {/* Specular highlight */}
      <circle cx={cx - 3} cy={cy - 3} r={3} fill="white" opacity={0.1} />
    </g>
  );
});

MotorSvg.displayName = 'MotorSvg';
export default MotorSvg;
