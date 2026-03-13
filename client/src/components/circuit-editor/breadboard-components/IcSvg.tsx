/**
 * Photorealistic DIP IC package SVG for breadboard view.
 *
 * Black rectangular body with pin-1 notch/dot, part number text,
 * and metallic pin legs.  Width spans the DIP gap (columns e–f).
 */

import { memo, useMemo } from 'react';
import { BB } from '@/lib/circuit-editor/breadboard-model';

export interface IcSvgProps {
  cx: number;
  cy: number;
  /** Total pin count (must be even — DIP packages) */
  pinCount?: number;
  /** Part number label (e.g. "ATmega328P") */
  partNumber?: string;
}

const IcSvg = memo(({ cx, cy, pinCount = 8, partNumber }: IcSvgProps) => {
  const pinsPerSide = Math.max(2, Math.ceil(pinCount / 2));
  const bodyW = 24; // spans DIP gap (~7.62mm)
  const bodyH = useMemo(() => pinsPerSide * BB.PITCH, [pinsPerSide]);
  const bx = cx - bodyW / 2;
  const by = cy - 5; // top aligned near pin 1 position
  const pinW = 4;
  const pinH = 1.8;

  // Truncate long part numbers
  const label = partNumber
    ? partNumber.length > 8 ? partNumber.slice(0, 7) + '…' : partNumber
    : '';

  return (
    <g data-testid="bb-ic-svg">
      {/* Body */}
      <defs>
        <linearGradient id={`ic-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="50%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#111111" />
        </linearGradient>
      </defs>
      <rect
        x={bx}
        y={by}
        width={bodyW}
        height={bodyH}
        rx={1.5}
        ry={1.5}
        fill={`url(#ic-body-${cx}-${cy})`}
        stroke="#3a3a3a"
        strokeWidth={0.6}
      />

      {/* Pin-1 notch (semicircular indent at top center) */}
      <path
        d={`M ${cx - 3} ${by} A 3 3 0 0 1 ${cx + 3} ${by}`}
        fill="#111111"
        stroke="#3a3a3a"
        strokeWidth={0.4}
      />

      {/* Pin-1 dot */}
      <circle cx={bx + 4} cy={by + 4} r={1.2} fill="#555" />

      {/* Pins — left side (odd pins: 1, 3, 5 …) */}
      {Array.from({ length: pinsPerSide }, (_, i) => (
        <rect
          key={`lp-${i}`}
          x={bx - pinW}
          y={by + i * BB.PITCH + BB.PITCH / 2 - pinH / 2}
          width={pinW}
          height={pinH}
          rx={0.3}
          fill="#c0c0c0"
          stroke="#888"
          strokeWidth={0.2}
        />
      ))}

      {/* Pins — right side (even pins: 2, 4, 6 …) */}
      {Array.from({ length: pinsPerSide }, (_, i) => (
        <rect
          key={`rp-${i}`}
          x={bx + bodyW}
          y={by + i * BB.PITCH + BB.PITCH / 2 - pinH / 2}
          width={pinW}
          height={pinH}
          rx={0.3}
          fill="#c0c0c0"
          stroke="#888"
          strokeWidth={0.2}
        />
      ))}

      {/* Part number text */}
      {label && (
        <text
          x={cx}
          y={by + bodyH / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={4.5}
          fill="#777"
          className="font-mono select-none"
        >
          {label}
        </text>
      )}

      {/* Subtle highlight along left edge */}
      <rect x={bx + 1} y={by + 2} width={1.5} height={bodyH - 4} rx={0.5} fill="white" opacity={0.06} />
    </g>
  );
});

IcSvg.displayName = 'IcSvg';
export default IcSvg;
