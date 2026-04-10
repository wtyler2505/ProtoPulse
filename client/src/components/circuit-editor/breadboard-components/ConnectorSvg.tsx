/**
 * Photorealistic connector SVG for breadboard view.
 *
 * Renders various connector types: screw terminal, barrel jack, JST, or
 * generic. The `connectorType` prop selects the visual variant.
 *
 * Scaled to breadboard pitch: 10px per 0.1″.
 */

import { memo } from 'react';

export type ConnectorType = 'screw-terminal' | 'barrel-jack' | 'jst' | 'generic';

export interface ConnectorSvgProps {
  /** Center X in breadboard pixel coords */
  cx: number;
  /** Center Y in breadboard pixel coords */
  cy: number;
  /** Connector variant */
  connectorType?: ConnectorType;
  /** Number of pins/positions (for screw terminal / JST) */
  pinCount?: number;
}

const ConnectorSvg = memo(({ cx, cy, connectorType = 'generic', pinCount = 2 }: ConnectorSvgProps) => {
  const leadLen = 7;

  switch (connectorType) {
    case 'screw-terminal': {
      const termW = pinCount * 10; // 1 pitch per position
      const termH = 10;
      return (
        <g data-testid="bb-connector-svg">
          {/* Pin leads */}
          {Array.from({ length: pinCount }, (_, i) => (
            <line
              key={`lead-${String(i)}`}
              x1={cx - termW / 2 + 5 + i * 10}
              y1={cy + termH / 2}
              x2={cx - termW / 2 + 5 + i * 10}
              y2={cy + termH / 2 + leadLen}
              stroke="#b0b0b0"
              strokeWidth={0.8}
              strokeLinecap="round"
            />
          ))}
          {/* Housing — green or blue plastic */}
          <defs>
            <linearGradient id={`conn-body-${cx}-${cy}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2d8e2d" />
              <stop offset="50%" stopColor="#1a6e1a" />
              <stop offset="100%" stopColor="#0f4f0f" />
            </linearGradient>
          </defs>
          <rect
            x={cx - termW / 2}
            y={cy - termH / 2}
            width={termW}
            height={termH}
            rx={1}
            fill={`url(#conn-body-${cx}-${cy})`}
            stroke="#0a3a0a"
            strokeWidth={0.5}
          />
          {/* Screw heads */}
          {Array.from({ length: pinCount }, (_, i) => (
            <g key={`screw-${String(i)}`}>
              <circle
                cx={cx - termW / 2 + 5 + i * 10}
                cy={cy}
                r={2.5}
                fill="#c0c0c0"
                stroke="#999"
                strokeWidth={0.3}
              />
              {/* Cross slot */}
              <line
                x1={cx - termW / 2 + 5 + i * 10 - 1.5}
                y1={cy}
                x2={cx - termW / 2 + 5 + i * 10 + 1.5}
                y2={cy}
                stroke="#777"
                strokeWidth={0.5}
              />
              <line
                x1={cx - termW / 2 + 5 + i * 10}
                y1={cy - 1.5}
                x2={cx - termW / 2 + 5 + i * 10}
                y2={cy + 1.5}
                stroke="#777"
                strokeWidth={0.5}
              />
            </g>
          ))}
          {/* Wire entry openings */}
          {Array.from({ length: pinCount }, (_, i) => (
            <rect
              key={`opening-${String(i)}`}
              x={cx - termW / 2 + 2.5 + i * 10}
              y={cy - termH / 2 + 0.5}
              width={5}
              height={2}
              rx={0.3}
              fill="#0a3a0a"
            />
          ))}
        </g>
      );
    }
    case 'barrel-jack': {
      const bodyW = 14;
      const bodyH = 10;
      const barrelR = 3;
      return (
        <g data-testid="bb-connector-svg">
          {/* 3 pins: center, sleeve, switch */}
          <line x1={cx - 5} y1={cy + bodyH / 2} x2={cx - 5} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
          <line x1={cx} y1={cy + bodyH / 2} x2={cx} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
          <line x1={cx + 5} y1={cy + bodyH / 2} x2={cx + 5} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
          {/* Metal body */}
          <rect
            x={cx - bodyW / 2}
            y={cy - bodyH / 2}
            width={bodyW}
            height={bodyH}
            rx={1}
            fill="#888"
            stroke="#666"
            strokeWidth={0.4}
          />
          {/* Barrel opening */}
          <circle cx={cx - bodyW / 2 + barrelR + 1} cy={cy} r={barrelR} fill="#333" stroke="#555" strokeWidth={0.3} />
          {/* Center pin */}
          <circle cx={cx - bodyW / 2 + barrelR + 1} cy={cy} r={1} fill="#d4a520" />
        </g>
      );
    }
    case 'jst': {
      const bodyW = pinCount * 8;
      const bodyH = 6;
      return (
        <g data-testid="bb-connector-svg">
          {/* Pin leads */}
          {Array.from({ length: pinCount }, (_, i) => (
            <line
              key={`lead-${String(i)}`}
              x1={cx - bodyW / 2 + 4 + i * 8}
              y1={cy + bodyH / 2}
              x2={cx - bodyW / 2 + 4 + i * 8}
              y2={cy + bodyH / 2 + leadLen}
              stroke="#b0b0b0"
              strokeWidth={0.6}
              strokeLinecap="round"
            />
          ))}
          {/* White plastic housing */}
          <rect
            x={cx - bodyW / 2}
            y={cy - bodyH / 2}
            width={bodyW}
            height={bodyH}
            rx={0.8}
            fill="#f0ede8"
            stroke="#ccc"
            strokeWidth={0.4}
          />
          {/* Internal contacts */}
          {Array.from({ length: pinCount }, (_, i) => (
            <rect
              key={`contact-${String(i)}`}
              x={cx - bodyW / 2 + 2.5 + i * 8}
              y={cy - 1.5}
              width={3}
              height={3}
              rx={0.3}
              fill="#d4a520"
              stroke="#b8860b"
              strokeWidth={0.2}
            />
          ))}
          {/* Locking tab */}
          <rect
            x={cx - 2}
            y={cy - bodyH / 2 - 2}
            width={4}
            height={2}
            rx={0.5}
            fill="#e0ddd8"
            stroke="#bbb"
            strokeWidth={0.3}
          />
        </g>
      );
    }
    default: {
      // Generic 2-pin connector
      const bodyW = 12;
      const bodyH = 8;
      return (
        <g data-testid="bb-connector-svg">
          <line x1={cx - 5} y1={cy + bodyH / 2} x2={cx - 5} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
          <line x1={cx + 5} y1={cy + bodyH / 2} x2={cx + 5} y2={cy + bodyH / 2 + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
          <rect
            x={cx - bodyW / 2}
            y={cy - bodyH / 2}
            width={bodyW}
            height={bodyH}
            rx={1}
            fill="#555"
            stroke="#444"
            strokeWidth={0.4}
          />
          {/* Pin contacts */}
          <rect x={cx - 6} y={cy - 1.5} width={3} height={3} rx={0.3} fill="#d4a520" />
          <rect x={cx + 3} y={cy - 1.5} width={3} height={3} rx={0.3} fill="#d4a520" />
        </g>
      );
    }
  }
});

ConnectorSvg.displayName = 'ConnectorSvg';
export default ConnectorSvg;
