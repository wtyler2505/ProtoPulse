/**
 * Photorealistic tactile push-button SVG for breadboard view.
 *
 * Renders a 6mm tactile switch (4 pins spanning the center channel).
 * Button cap color reflects pressed/released state.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo } from 'react';

export interface ButtonSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Whether the button is currently pressed */
  pressed?: boolean;
}

const ButtonSvg = memo(({ cx, cy, pressed = false }: ButtonSvgProps) => {
  const bodyW = 12; // 6mm square
  const bodyH = 12;
  const leadLen = 6;
  const pinSpacing = 10; // 1 pitch

  return (
    <g data-testid="bb-button-svg">
      {/* Four leads — two on each side (typical 6mm tactile) */}
      <line x1={cx - pinSpacing / 2} y1={cy - bodyH / 2} x2={cx - pinSpacing / 2} y2={cy - bodyH / 2 - leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + pinSpacing / 2} y1={cy - bodyH / 2} x2={cx + pinSpacing / 2} y2={cy - bodyH / 2 - leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx - pinSpacing / 2} y1={cy + bodyH / 2} x2={cx - pinSpacing / 2} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + pinSpacing / 2} y1={cy + bodyH / 2} x2={cx + pinSpacing / 2} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />

      {/* Housing — dark plastic body */}
      <defs>
        <linearGradient id={`btn-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="50%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
      </defs>
      <rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2}
        width={bodyW}
        height={bodyH}
        rx={1}
        fill={`url(#btn-body-${cx}-${cy})`}
        stroke="#111"
        strokeWidth={0.5}
      />

      {/* Button cap — raised circle */}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={pressed ? '#666' : '#888'}
        stroke="#555"
        strokeWidth={0.4}
      />

      {/* Cap highlight (3D dome effect) */}
      {!pressed && (
        <circle cx={cx - 1} cy={cy - 1} r={1.8} fill="white" opacity={0.15} />
      )}

      {/* Pressed shadow — cap appears sunken */}
      {pressed && (
        <circle cx={cx} cy={cy} r={4} fill="none" stroke="#333" strokeWidth={0.6} />
      )}
    </g>
  );
});

ButtonSvg.displayName = 'ButtonSvg';
export default ButtonSvg;
