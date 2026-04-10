/**
 * Photorealistic pin header SVG for breadboard view.
 *
 * Renders a single- or dual-row pin header strip (e.g., 1×6, 2×20).
 * Each pin is a gold square with a plastic housing. Pin count is configurable.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo, useMemo } from 'react';

export interface HeaderSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Number of pins (total — for dual row, must be even) */
  pinCount?: number;
  /** Number of rows (1 or 2) */
  rows?: 1 | 2;
}

const PIN_PITCH = 10; // 0.1″ per pin

const HeaderSvg = memo(({ cx, cy, pinCount = 6, rows = 1 }: HeaderSvgProps) => {
  const pinsPerRow = rows === 2 ? Math.ceil(pinCount / 2) : pinCount;

  const geometry = useMemo(() => {
    const bodyW = pinsPerRow * PIN_PITCH;
    const bodyH = rows === 2 ? 10 : 5;
    const leadLen = 6;

    const pins: Array<{ x: number; y: number }> = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < pinsPerRow; col++) {
        const px = cx - bodyW / 2 + PIN_PITCH / 2 + col * PIN_PITCH;
        const py = rows === 2 ? cy - 2.5 + row * 5 : cy;
        pins.push({ x: px, y: py });
      }
    }

    return { bodyW, bodyH, leadLen, pins };
  }, [cx, cy, pinsPerRow, rows]);

  const { bodyW, bodyH, leadLen, pins } = geometry;

  return (
    <g data-testid="bb-header-svg">
      {/* Pin leads extending below */}
      {pins.map((p, i) => (
        <line
          key={`lead-${String(i)}`}
          x1={p.x}
          y1={cy + bodyH / 2}
          x2={p.x}
          y2={cy + bodyH / 2 + leadLen}
          stroke="#b0b0b0"
          strokeWidth={0.6}
          strokeLinecap="round"
        />
      ))}

      {/* Plastic housing */}
      <defs>
        <linearGradient id={`hdr-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="50%" stopColor="#1e1e1e" />
          <stop offset="100%" stopColor="#111111" />
        </linearGradient>
      </defs>
      <rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2}
        width={bodyW}
        height={bodyH}
        rx={0.5}
        fill={`url(#hdr-body-${cx}-${cy})`}
        stroke="#333"
        strokeWidth={0.4}
      />

      {/* Gold pin squares */}
      {pins.map((p, i) => (
        <rect
          key={`pin-${String(i)}`}
          x={p.x - 1.5}
          y={p.y - 1.5}
          width={3}
          height={3}
          rx={0.3}
          fill="#d4a520"
          stroke="#b8860b"
          strokeWidth={0.2}
        />
      ))}

      {/* Top edge highlight */}
      <rect
        x={cx - bodyW / 2 + 0.5}
        y={cy - bodyH / 2 + 0.5}
        width={bodyW - 1}
        height={1}
        rx={0.3}
        fill="white"
        opacity={0.08}
      />
    </g>
  );
});

HeaderSvg.displayName = 'HeaderSvg';
export default HeaderSvg;
