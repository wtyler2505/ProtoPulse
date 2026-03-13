/**
 * Photorealistic TO-92 transistor SVG for breadboard view.
 *
 * Flat face with rounded back, 3 leads (E/B/C), part number text.
 */

import { memo } from 'react';

export interface TransistorSvgProps {
  cx: number;
  cy: number;
  /** Part number label (e.g. "2N2222") */
  partNumber?: string;
}

const TransistorSvg = memo(({ cx, cy, partNumber }: TransistorSvgProps) => {
  const bodyR = 6;
  const leadLen = 8;
  const leadSpacing = 5;

  return (
    <g data-testid="bb-transistor-svg">
      {/* 3 leads — E, B, C spaced evenly */}
      <line x1={cx - leadSpacing} y1={cy + bodyR} x2={cx - leadSpacing} y2={cy + bodyR + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx} y1={cy + bodyR} x2={cx} y2={cy + bodyR + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />
      <line x1={cx + leadSpacing} y1={cy + bodyR} x2={cx + leadSpacing} y2={cy + bodyR + leadLen} stroke="#b0b0b0" strokeWidth={0.8} strokeLinecap="round" />

      {/* TO-92 body — flat face (bottom) + rounded back (top) */}
      <defs>
        <linearGradient id={`to92-${cx}-${cy}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#222" />
          <stop offset="40%" stopColor="#333" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
      </defs>

      {/* Rounded back */}
      <path
        d={`M ${cx - bodyR} ${cy + bodyR * 0.3} A ${bodyR} ${bodyR} 0 0 1 ${cx + bodyR} ${cy + bodyR * 0.3} L ${cx + bodyR} ${cy + bodyR} L ${cx - bodyR} ${cy + bodyR} Z`}
        fill={`url(#to92-${cx}-${cy})`}
        stroke="#444"
        strokeWidth={0.5}
      />

      {/* Flat face (bottom flat portion) */}
      <rect
        x={cx - bodyR}
        y={cy + bodyR * 0.3}
        width={bodyR * 2}
        height={bodyR * 0.7}
        fill="#1a1a1a"
        stroke="#444"
        strokeWidth={0.5}
      />

      {/* Part number */}
      {partNumber && (
        <text
          x={cx}
          y={cy + bodyR * 0.7}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={3}
          fill="#888"
          className="font-mono select-none"
        >
          {partNumber.length > 7 ? partNumber.slice(0, 6) + '…' : partNumber}
        </text>
      )}

      {/* Subtle highlight on rounded part */}
      <path
        d={`M ${cx - bodyR + 2} ${cy + bodyR * 0.3} A ${bodyR - 2} ${bodyR - 2} 0 0 1 ${cx} ${cy - bodyR * 0.2}`}
        fill="none"
        stroke="white"
        strokeWidth={0.6}
        opacity={0.1}
      />
    </g>
  );
});

TransistorSvg.displayName = 'TransistorSvg';
export default TransistorSvg;
