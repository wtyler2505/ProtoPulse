/**
 * Photorealistic 7-segment display SVG for breadboard view.
 *
 * Renders a single-digit 7-segment LED display with a plastic housing.
 * The `digit` prop (0–9 or null for blank) controls which segments light.
 * The `color` prop controls segment LED color.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo, useMemo } from 'react';

export interface DisplaySvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Digit to display (0–9, null/undefined = blank) */
  digit?: number | null;
  /** Segment color */
  color?: string;
  /** Number of pins (typically 10 for single-digit) */
  pinCount?: number;
}

/**
 * 7-segment truth table — which segments (a–g) are on for each digit.
 * Segment layout:
 *    aaa
 *   f   b
 *    ggg
 *   e   c
 *    ddd
 */
const SEGMENT_MAP: Record<number, boolean[]> = {
  // [a,  b,  c,  d,  e,  f,  g]
  0: [true, true, true, true, true, true, false],
  1: [false, true, true, false, false, false, false],
  2: [true, true, false, true, true, false, true],
  3: [true, true, true, true, false, false, true],
  4: [false, true, true, false, false, true, true],
  5: [true, false, true, true, false, true, true],
  6: [true, false, true, true, true, true, true],
  7: [true, true, true, false, false, false, false],
  8: [true, true, true, true, true, true, true],
  9: [true, true, true, true, false, true, true],
};

/** Segment geometry relative to digit center */
interface SegDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getSegments(dcx: number, dcy: number): SegDef[] {
  const sw = 6; // horizontal segment width
  const sh = 1.2; // segment thickness
  const sv = 5; // vertical segment height
  return [
    { x: dcx - sw / 2, y: dcy - sv - sh / 2, w: sw, h: sh },     // a (top horizontal)
    { x: dcx + sw / 2 - sh, y: dcy - sv, w: sh, h: sv },          // b (top-right vertical)
    { x: dcx + sw / 2 - sh, y: dcy, w: sh, h: sv },               // c (bottom-right vertical)
    { x: dcx - sw / 2, y: dcy + sv - sh / 2, w: sw, h: sh },     // d (bottom horizontal)
    { x: dcx - sw / 2, y: dcy, w: sh, h: sv },                    // e (bottom-left vertical)
    { x: dcx - sw / 2, y: dcy - sv, w: sh, h: sv },               // f (top-left vertical)
    { x: dcx - sw / 2, y: dcy - sh / 2, w: sw, h: sh },          // g (middle horizontal)
  ];
}

const DisplaySvg = memo(({ cx, cy, digit, color = '#ef4444', pinCount = 10 }: DisplaySvgProps) => {
  const bodyW = 20;
  const bodyH = 24;
  const leadLen = 6;

  const segOn = digit != null && digit >= 0 && digit <= 9 ? SEGMENT_MAP[digit] : null;
  const segs = useMemo(() => getSegments(cx, cy - 1), [cx, cy]);

  // Pins — 5 on each side
  const pinsPerSide = Math.ceil(pinCount / 2);
  const pinSpacing = bodyW / (pinsPerSide + 1);

  return (
    <g data-testid="bb-display-svg">
      {/* Bottom pins */}
      {Array.from({ length: pinsPerSide }, (_, i) => (
        <line
          key={`bpin-${String(i)}`}
          x1={cx - bodyW / 2 + pinSpacing * (i + 1)}
          y1={cy + bodyH / 2}
          x2={cx - bodyW / 2 + pinSpacing * (i + 1)}
          y2={cy + bodyH / 2 + leadLen}
          stroke="#b0b0b0"
          strokeWidth={0.6}
          strokeLinecap="round"
        />
      ))}
      {/* Top pins */}
      {Array.from({ length: pinCount - pinsPerSide }, (_, i) => (
        <line
          key={`tpin-${String(i)}`}
          x1={cx - bodyW / 2 + pinSpacing * (i + 1)}
          y1={cy - bodyH / 2}
          x2={cx - bodyW / 2 + pinSpacing * (i + 1)}
          y2={cy - bodyH / 2 - leadLen}
          stroke="#b0b0b0"
          strokeWidth={0.6}
          strokeLinecap="round"
        />
      ))}

      {/* Plastic housing */}
      <defs>
        <linearGradient id={`disp-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="50%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#111" />
        </linearGradient>
      </defs>
      <rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2}
        width={bodyW}
        height={bodyH}
        rx={1}
        fill={`url(#disp-body-${cx}-${cy})`}
        stroke="#333"
        strokeWidth={0.5}
      />

      {/* Display window — slightly lighter area */}
      <rect
        x={cx - 8}
        y={cy - 9}
        width={16}
        height={18}
        rx={0.5}
        fill="#0a0a0a"
        stroke="#222"
        strokeWidth={0.3}
      />

      {/* Segments */}
      {segs.map((seg, i) => (
        <rect
          key={`seg-${String(i)}`}
          x={seg.x}
          y={seg.y}
          width={seg.w}
          height={seg.h}
          rx={0.3}
          fill={segOn?.[i] ? color : '#1a1a1a'}
          opacity={segOn?.[i] ? 0.9 : 0.15}
        />
      ))}

      {/* Decimal point */}
      <circle cx={cx + 5} cy={cy + 5} r={0.8} fill="#1a1a1a" opacity={0.15} />

      {/* Pin 1 indicator dot */}
      <circle cx={cx - bodyW / 2 + 2} cy={cy + bodyH / 2 - 2} r={0.8} fill="#666" />
    </g>
  );
});

DisplaySvg.displayName = 'DisplaySvg';
export default DisplaySvg;
export { SEGMENT_MAP };
