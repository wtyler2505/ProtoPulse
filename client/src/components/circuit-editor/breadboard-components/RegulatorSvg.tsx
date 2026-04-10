/**
 * Photorealistic voltage regulator SVG for breadboard view.
 *
 * Renders a TO-220 package (e.g., LM7805, LM1117) with a metal heatsink tab,
 * three pins, and a voltage marking on the face.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo, useMemo } from 'react';

export interface RegulatorSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Output voltage for marking (e.g., 5, 3.3, 12) */
  voltage?: number;
  /** Part number label (e.g., "7805") */
  partNumber?: string;
}

/** Format voltage for display */
function formatVoltage(v: number): string {
  if (Number.isInteger(v)) return `${String(v)}V`;
  return `${v.toFixed(1)}V`;
}

const RegulatorSvg = memo(({ cx, cy, voltage = 5, partNumber }: RegulatorSvgProps) => {
  const label = useMemo(
    () => partNumber ?? `78${String(voltage < 10 ? '0' : '')}${String(Math.round(voltage))}`,
    [partNumber, voltage],
  );
  const voltageLabel = useMemo(() => formatVoltage(voltage), [voltage]);

  const bodyW = 16;
  const bodyH = 20;
  const tabH = 4; // heatsink tab height
  const leadLen = 8;
  const pinSpacing = 5; // ~0.05″ between pins (TO-220 tight)

  return (
    <g data-testid="bb-regulator-svg">
      {/* Three leads — IN, GND, OUT */}
      <line x1={cx - pinSpacing} y1={cy + bodyH / 2} x2={cx - pinSpacing} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx} y1={cy + bodyH / 2} x2={cx} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + pinSpacing} y1={cy + bodyH / 2} x2={cx + pinSpacing} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />

      {/* Metal heatsink tab */}
      <rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2 - tabH}
        width={bodyW}
        height={tabH}
        rx={0.5}
        fill="#c0c0c0"
        stroke="#999"
        strokeWidth={0.4}
      />
      {/* Tab mounting hole */}
      <circle cx={cx} cy={cy - bodyH / 2 - tabH / 2} r={1.5} fill="#999" stroke="#777" strokeWidth={0.3} />

      {/* Plastic body — dark epoxy */}
      <defs>
        <linearGradient id={`reg-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#333" />
          <stop offset="50%" stopColor="#222" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
      </defs>
      <rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2}
        width={bodyW}
        height={bodyH}
        rx={1}
        fill={`url(#reg-body-${cx}-${cy})`}
        stroke="#111"
        strokeWidth={0.5}
      />

      {/* Part number marking */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={3.5}
        fill="#c0c0c0"
        className="font-mono select-none pointer-events-none"
      >
        {label}
      </text>

      {/* Voltage marking */}
      <text
        x={cx}
        y={cy + 3}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={3}
        fill="#94a3b8"
        className="font-mono select-none pointer-events-none"
      >
        {voltageLabel}
      </text>

      {/* Highlight strip on top edge */}
      <rect
        x={cx - bodyW / 2 + 1}
        y={cy - bodyH / 2 + 0.5}
        width={bodyW - 2}
        height={1.5}
        rx={0.5}
        fill="white"
        opacity={0.08}
      />
    </g>
  );
});

RegulatorSvg.displayName = 'RegulatorSvg';
export default RegulatorSvg;
export { formatVoltage };
