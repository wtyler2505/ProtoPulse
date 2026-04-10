/**
 * Photorealistic relay module SVG for breadboard view.
 *
 * Renders a sugar-cube relay (SRD-05VDC) with coil marking, contact
 * terminals, and an indicator LED. The `energized` prop controls state.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo } from 'react';

export interface RelaySvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Whether the relay coil is energized */
  energized?: boolean;
  /** Coil voltage rating (for label) */
  voltage?: number;
}

const RelaySvg = memo(({ cx, cy, energized = false, voltage = 5 }: RelaySvgProps) => {
  const bodyW = 24;
  const bodyH = 18;
  const leadLen = 7;

  // 5 pins: coil+ coil- NO COM NC
  const pinPositions = [-8, -4, 4, 8, 0]; // relative X offsets

  return (
    <g data-testid="bb-relay-svg">
      {/* Pin leads */}
      {pinPositions.map((offset, i) => (
        <line
          key={`lead-${String(i)}`}
          x1={cx + offset}
          y1={cy + bodyH / 2}
          x2={cx + offset}
          y2={cy + bodyH / 2 + leadLen}
          stroke="#b0b0b0"
          strokeWidth={0.8}
          strokeLinecap="round"
        />
      ))}

      {/* Relay body — blue plastic housing */}
      <defs>
        <linearGradient id={`relay-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3060a0" />
          <stop offset="50%" stopColor="#204080" />
          <stop offset="100%" stopColor="#183060" />
        </linearGradient>
      </defs>
      <rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2}
        width={bodyW}
        height={bodyH}
        rx={1.5}
        fill={`url(#relay-body-${cx}-${cy})`}
        stroke="#102040"
        strokeWidth={0.5}
      />

      {/* Voltage/part marking */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={3.5}
        fill="#a0c0e0"
        className="font-mono select-none pointer-events-none"
      >
        SRD-{String(voltage < 10 ? '0' : '')}{String(voltage)}V
      </text>

      {/* Coil symbol — simplified */}
      <path
        d={`M${cx - 5},${cy + 3} C${cx - 3},${cy + 1} ${cx - 1},${cy + 5} ${cx + 1},${cy + 3} C${cx + 3},${cy + 1} ${cx + 5},${cy + 5} ${cx + 5},${cy + 3}`}
        fill="none"
        stroke="#80a0c0"
        strokeWidth={0.5}
      />

      {/* Indicator LED — glows when energized */}
      <circle
        cx={cx - bodyW / 2 + 4}
        cy={cy - bodyH / 2 + 4}
        r={1.5}
        fill={energized ? '#ef4444' : '#3a2020'}
        stroke={energized ? '#ff6666' : '#444'}
        strokeWidth={0.3}
      />
      {energized && (
        <circle
          cx={cx - bodyW / 2 + 4}
          cy={cy - bodyH / 2 + 4}
          r={3}
          fill="#ef4444"
          opacity={0.2}
        />
      )}

      {/* Top edge highlight */}
      <rect
        x={cx - bodyW / 2 + 1}
        y={cy - bodyH / 2 + 0.5}
        width={bodyW - 2}
        height={1.2}
        rx={0.5}
        fill="white"
        opacity={0.08}
      />
    </g>
  );
});

RelaySvg.displayName = 'RelaySvg';
export default RelaySvg;
