/**
 * Photorealistic slide/toggle switch SVG for breadboard view.
 *
 * Renders a SPDT slide switch with three inline pins and a sliding actuator.
 * The `on` prop controls actuator position (left = off, right = on).
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo } from 'react';

export interface SwitchSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Whether the switch is in the ON position */
  on?: boolean;
}

const SwitchSvg = memo(({ cx, cy, on = false }: SwitchSvgProps) => {
  const bodyW = 18; // slide switch body width
  const bodyH = 8;
  const leadLen = 7;
  const pinSpacing = 8;

  // Actuator slides left (off) or right (on)
  const actuatorX = on ? cx + 4 : cx - 4;

  return (
    <g data-testid="bb-switch-svg">
      {/* Three pins — COM (center), NO (right), NC (left) */}
      <line x1={cx - pinSpacing} y1={cy + bodyH / 2} x2={cx - pinSpacing} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx} y1={cy + bodyH / 2} x2={cx} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + pinSpacing} y1={cy + bodyH / 2} x2={cx + pinSpacing} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />

      {/* Body — white/cream plastic housing */}
      <defs>
        <linearGradient id={`sw-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0ede8" />
          <stop offset="50%" stopColor="#ddd8d0" />
          <stop offset="100%" stopColor="#c8c0b8" />
        </linearGradient>
      </defs>
      <rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2}
        width={bodyW}
        height={bodyH}
        rx={1.5}
        fill={`url(#sw-body-${cx}-${cy})`}
        stroke="#999"
        strokeWidth={0.4}
      />

      {/* Slide channel */}
      <rect
        x={cx - 6}
        y={cy - 2}
        width={12}
        height={4}
        rx={1}
        fill="#aaa"
        stroke="#888"
        strokeWidth={0.3}
      />

      {/* Actuator knob */}
      <rect
        x={actuatorX - 3}
        y={cy - 3}
        width={6}
        height={6}
        rx={1}
        fill={on ? '#4a90d9' : '#777'}
        stroke={on ? '#3570b0' : '#555'}
        strokeWidth={0.5}
      />

      {/* Knob grip lines */}
      <line x1={actuatorX - 1.5} y1={cy - 1} x2={actuatorX - 1.5} y2={cy + 1} stroke="rgba(255,255,255,0.3)" strokeWidth={0.4} />
      <line x1={actuatorX} y1={cy - 1} x2={actuatorX} y2={cy + 1} stroke="rgba(255,255,255,0.3)" strokeWidth={0.4} />
      <line x1={actuatorX + 1.5} y1={cy - 1} x2={actuatorX + 1.5} y2={cy + 1} stroke="rgba(255,255,255,0.3)" strokeWidth={0.4} />

      {/* ON/OFF indicators */}
      <text
        x={cx + 6}
        y={cy - bodyH / 2 - 1.5}
        textAnchor="middle"
        fontSize={2.5}
        fill={on ? '#4a90d9' : '#666'}
        className="font-mono select-none pointer-events-none"
      >
        ON
      </text>
      <text
        x={cx - 6}
        y={cy - bodyH / 2 - 1.5}
        textAnchor="middle"
        fontSize={2.5}
        fill={on ? '#666' : '#999'}
        className="font-mono select-none pointer-events-none"
      >
        OFF
      </text>
    </g>
  );
});

SwitchSvg.displayName = 'SwitchSvg';
export default SwitchSvg;
