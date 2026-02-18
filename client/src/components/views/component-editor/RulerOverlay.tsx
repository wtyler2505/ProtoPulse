interface MeasurementPoint {
  x: number;
  y: number;
}

export interface Measurement {
  start: MeasurementPoint;
  end: MeasurementPoint;
  distance: number;
}

interface RulerOverlayProps {
  measurements: Measurement[];
  pendingStart: MeasurementPoint | null;
  cursorPos: MeasurementPoint | null;
  zoom: number;
}

const MAGENTA = '#FF00FF';

export default function RulerOverlay({ measurements, pendingStart, cursorPos, zoom }: RulerOverlayProps) {
  const sw = 1.5 / zoom;
  const r = 2 / zoom;
  const fontSize = 11 / zoom;
  const padX = 4 / zoom;
  const padY = 2 / zoom;

  const renderMeasurement = (m: Measurement, idx: number) => {
    const mx = (m.start.x + m.end.x) / 2;
    const my = (m.start.y + m.end.y) / 2;
    const label = m.distance.toFixed(1);
    const textW = label.length * fontSize * 0.6;

    return (
      <g key={idx} data-testid={`measurement-${idx}`}>
        <line x1={m.start.x} y1={m.start.y} x2={m.end.x} y2={m.end.y}
          stroke={MAGENTA} strokeWidth={sw} />
        <circle cx={m.start.x} cy={m.start.y} r={r} fill={MAGENTA} />
        <circle cx={m.end.x} cy={m.end.y} r={r} fill={MAGENTA} />
        <rect x={mx - textW / 2 - padX} y={my - fontSize / 2 - padY}
          width={textW + padX * 2} height={fontSize + padY * 2}
          fill="white" rx={2 / zoom} />
        <text x={mx} y={my + fontSize * 0.35} textAnchor="middle"
          fontSize={fontSize} fill="#000" fontFamily="sans-serif">
          {label}
        </text>
      </g>
    );
  };

  const pendingLine = pendingStart && cursorPos ? (() => {
    const dx = cursorPos.x - pendingStart.x;
    const dy = cursorPos.y - pendingStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const mx = (pendingStart.x + cursorPos.x) / 2;
    const my = (pendingStart.y + cursorPos.y) / 2;
    const label = dist.toFixed(1);
    const textW = label.length * fontSize * 0.6;

    return (
      <g data-testid="measurement-pending">
        <line x1={pendingStart.x} y1={pendingStart.y} x2={cursorPos.x} y2={cursorPos.y}
          stroke={MAGENTA} strokeWidth={sw} strokeDasharray={`${4 / zoom} ${2 / zoom}`} />
        <circle cx={pendingStart.x} cy={pendingStart.y} r={r} fill={MAGENTA} />
        <circle cx={cursorPos.x} cy={cursorPos.y} r={r} fill={MAGENTA} opacity={0.6} />
        <rect x={mx - textW / 2 - padX} y={my - fontSize / 2 - padY}
          width={textW + padX * 2} height={fontSize + padY * 2}
          fill="white" rx={2 / zoom} opacity={0.85} />
        <text x={mx} y={my + fontSize * 0.35} textAnchor="middle"
          fontSize={fontSize} fill="#000" fontFamily="sans-serif">
          {label}
        </text>
      </g>
    );
  })() : null;

  return (
    <g data-testid="ruler-overlay" pointerEvents="none">
      {measurements.map(renderMeasurement)}
      {pendingLine}
    </g>
  );
}
