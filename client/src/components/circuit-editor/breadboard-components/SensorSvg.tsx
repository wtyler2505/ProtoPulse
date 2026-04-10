/**
 * Photorealistic sensor module SVG for breadboard view.
 *
 * Renders a generic sensor breakout with a sensing element, PCB, and pin header.
 * The `sensorType` prop changes the sensing element icon.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo, useMemo } from 'react';

export type SensorType = 'temperature' | 'light' | 'motion' | 'humidity' | 'pressure' | 'proximity' | 'generic';

export interface SensorSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Type of sensor for icon variant */
  sensorType?: SensorType;
  /** Number of pins (3 or 4 typical) */
  pinCount?: number;
}

/** Sensor type icon paths */
function getSensorIcon(type: SensorType, cx: number, cy: number): React.ReactElement {
  switch (type) {
    case 'temperature':
      // Thermometer icon
      return (
        <g>
          <rect x={cx - 1} y={cy - 5} width={2} height={7} rx={1} fill="#ef4444" />
          <circle cx={cx} cy={cy + 3} r={2.5} fill="#ef4444" stroke="#dc2626" strokeWidth={0.3} />
        </g>
      );
    case 'light':
      // Photodiode/LDR eye
      return (
        <>
          <circle cx={cx} cy={cy} r={3} fill="#eab308" opacity={0.4} />
          <circle cx={cx} cy={cy} r={1.5} fill="#eab308" />
        </>
      );
    case 'motion':
      // PIR dome
      return (
        <path
          d={`M${cx - 4},${cy + 2} Q${cx},${cy - 5} ${cx + 4},${cy + 2}`}
          fill="#f5f5f5"
          stroke="#ccc"
          strokeWidth={0.3}
          opacity={0.7}
        />
      );
    case 'humidity':
      // Water drop
      return (
        <path
          d={`M${cx},${cy - 4} Q${cx - 3},${cy} ${cx},${cy + 3} Q${cx + 3},${cy} ${cx},${cy - 4}`}
          fill="#3b82f6"
          opacity={0.5}
        />
      );
    case 'pressure':
      // Gauge lines
      return (
        <>
          <circle cx={cx} cy={cy} r={3} fill="none" stroke="#94a3b8" strokeWidth={0.4} />
          <line x1={cx} y1={cy} x2={cx + 2} y2={cy - 1.5} stroke="#94a3b8" strokeWidth={0.5} />
        </>
      );
    case 'proximity':
      // IR beam
      return (
        <>
          <rect x={cx - 2} y={cy - 1.5} width={4} height={3} rx={0.5} fill="#1a1a1a" />
          <line x1={cx + 2} y1={cy} x2={cx + 5} y2={cy} stroke="#ef4444" strokeWidth={0.4} strokeDasharray="1,1" />
        </>
      );
    default:
      // Generic chip icon
      return <rect x={cx - 2.5} y={cy - 2.5} width={5} height={5} rx={0.5} fill="#555" stroke="#444" strokeWidth={0.3} />;
  }
}

const SensorSvg = memo(({ cx, cy, sensorType = 'generic', pinCount = 3 }: SensorSvgProps) => {
  const bodyW = 16;
  const bodyH = 20;
  const leadLen = 7;
  const pinSpacing = 10;

  const pins = useMemo(() => {
    const result: Array<{ x: number; y: number }> = [];
    const startX = cx - ((pinCount - 1) * pinSpacing) / 2;
    for (let i = 0; i < pinCount; i++) {
      result.push({ x: startX + i * pinSpacing, y: cy + bodyH / 2 });
    }
    return result;
  }, [cx, cy, pinCount, bodyH, pinSpacing]);

  return (
    <g data-testid="bb-sensor-svg">
      {/* Pin leads */}
      {pins.map((p, i) => (
        <line
          key={`lead-${String(i)}`}
          x1={p.x}
          y1={p.y}
          x2={p.x}
          y2={p.y + leadLen}
          stroke="#b0b0b0"
          strokeWidth={0.6}
          strokeLinecap="round"
        />
      ))}

      {/* PCB body — green soldermask */}
      <defs>
        <linearGradient id={`sens-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d6e2d" />
          <stop offset="50%" stopColor="#1a5c1a" />
          <stop offset="100%" stopColor="#104510" />
        </linearGradient>
      </defs>
      <rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2}
        width={bodyW}
        height={bodyH}
        rx={1}
        fill={`url(#sens-body-${cx}-${cy})`}
        stroke="#0f3a0f"
        strokeWidth={0.4}
      />

      {/* Sensing element area — centered white silkscreen region */}
      <rect
        x={cx - 5}
        y={cy - 5}
        width={10}
        height={10}
        rx={1}
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={0.3}
      />

      {/* Sensor type icon */}
      {getSensorIcon(sensorType, cx, cy)}

      {/* Pin pads on PCB */}
      {pins.map((p, i) => (
        <circle key={`pad-${String(i)}`} cx={p.x} cy={p.y} r={1.2} fill="#d4a520" stroke="#b8860b" strokeWidth={0.2} />
      ))}

      {/* Board edge highlight */}
      <rect
        x={cx - bodyW / 2 + 0.5}
        y={cy - bodyH / 2 + 0.5}
        width={bodyW - 1}
        height={1}
        rx={0.3}
        fill="white"
        opacity={0.06}
      />
    </g>
  );
});

SensorSvg.displayName = 'SensorSvg';
export default SensorSvg;
