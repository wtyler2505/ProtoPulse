/**
 * BreadboardConnectivityExplainer — S6-07
 *
 * Togglable SVG overlay that visualizes internal breadboard bus
 * connections for first-time users:
 *   - 5-hole row group highlights (left a-e, right f-j)
 *   - Power rail path indicators with +/- labels
 *   - Center channel (DIP gap) annotation
 *
 * Renders behind components at reduced opacity so it doesn't
 * obscure the actual circuit.
 */

import { memo } from 'react';
import { BB, coordToPixel } from '@/lib/circuit-editor/breadboard-model';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BreadboardConnectivityExplainerProps {
  /** Whether the overlay is visible (default: true). */
  visible?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEFT_GROUP_COLOR = '#3b82f6';   // blue
const RIGHT_GROUP_COLOR = '#8b5cf6';  // purple
const POS_RAIL_COLOR = '#ef4444';     // red
const NEG_RAIL_COLOR = '#1e293b';     // dark
const CHANNEL_COLOR = '#475569';      // slate
const LABEL_COLOR = '#94a3b8';        // slate-400
const VISIBLE_OPACITY = 0.4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function BreadboardConnectivityExplainerInner({
  visible = true,
}: BreadboardConnectivityExplainerProps) {
  const opacity = visible ? VISIBLE_OPACITY : 0;

  // Pre-compute row group rectangles
  const rowGroups: Array<{
    side: 'left' | 'right';
    row: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  for (let row = 1; row <= BB.ROWS; row++) {
    // Left group: columns a-e
    const leftStart = coordToPixel({ type: 'terminal', col: 'a', row });
    const leftEnd = coordToPixel({ type: 'terminal', col: 'e', row });
    rowGroups.push({
      side: 'left',
      row,
      x: leftStart.x - 3,
      y: leftStart.y - 3,
      width: leftEnd.x - leftStart.x + 6,
      height: 6,
    });

    // Right group: columns f-j
    const rightStart = coordToPixel({ type: 'terminal', col: 'f', row });
    const rightEnd = coordToPixel({ type: 'terminal', col: 'j', row });
    rowGroups.push({
      side: 'right',
      row,
      x: rightStart.x - 3,
      y: rightStart.y - 3,
      width: rightEnd.x - rightStart.x + 6,
      height: 6,
    });
  }

  // Power rail extents
  const topPosStart = coordToPixel({ type: 'rail', rail: 'top_pos', index: 0 });
  const topPosEnd = coordToPixel({ type: 'rail', rail: 'top_pos', index: BB.ROWS - 1 });
  const topNegStart = coordToPixel({ type: 'rail', rail: 'top_neg', index: 0 });
  const topNegEnd = coordToPixel({ type: 'rail', rail: 'top_neg', index: BB.ROWS - 1 });
  const botPosStart = coordToPixel({ type: 'rail', rail: 'bottom_pos', index: 0 });
  const botPosEnd = coordToPixel({ type: 'rail', rail: 'bottom_pos', index: BB.ROWS - 1 });
  const botNegStart = coordToPixel({ type: 'rail', rail: 'bottom_neg', index: 0 });
  const botNegEnd = coordToPixel({ type: 'rail', rail: 'bottom_neg', index: BB.ROWS - 1 });

  // Center channel coordinates (gap between columns e and f)
  const channelTopLeft = coordToPixel({ type: 'terminal', col: 'e', row: 1 });
  const channelTopRight = coordToPixel({ type: 'terminal', col: 'f', row: 1 });
  const channelBottomLeft = coordToPixel({ type: 'terminal', col: 'e', row: BB.ROWS });

  return (
    <g
      data-testid="connectivity-explainer"
      opacity={opacity}
      pointerEvents="none"
    >
      {/* Row group highlights */}
      {rowGroups.map((rg) => (
        <rect
          key={`${rg.side}-${rg.row}`}
          data-testid={`row-group-${rg.side}-${rg.row}`}
          x={rg.x}
          y={rg.y}
          width={rg.width}
          height={rg.height}
          rx={2}
          fill={rg.side === 'left' ? LEFT_GROUP_COLOR : RIGHT_GROUP_COLOR}
          opacity={0.3}
        />
      ))}

      {/* Power rail lines */}
      <line
        data-testid="power-rail-top-pos"
        x1={topPosStart.x} y1={topPosStart.y}
        x2={topPosEnd.x} y2={topPosEnd.y}
        stroke={POS_RAIL_COLOR}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.5}
      />
      <line
        data-testid="power-rail-top-neg"
        x1={topNegStart.x} y1={topNegStart.y}
        x2={topNegEnd.x} y2={topNegEnd.y}
        stroke={NEG_RAIL_COLOR}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.5}
      />
      <line
        data-testid="power-rail-bottom-pos"
        x1={botPosStart.x} y1={botPosStart.y}
        x2={botPosEnd.x} y2={botPosEnd.y}
        stroke={POS_RAIL_COLOR}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.5}
      />
      <line
        data-testid="power-rail-bottom-neg"
        x1={botNegStart.x} y1={botNegStart.y}
        x2={botNegEnd.x} y2={botNegEnd.y}
        stroke={NEG_RAIL_COLOR}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.5}
      />

      {/* Power rail +/- labels */}
      <text
        x={topPosStart.x} y={topPosStart.y - 8}
        fill={POS_RAIL_COLOR} fontSize={8} fontWeight="bold" textAnchor="middle"
      >
        +
      </text>
      <text
        x={topNegStart.x} y={topNegStart.y - 8}
        fill={LABEL_COLOR} fontSize={8} fontWeight="bold" textAnchor="middle"
      >
        -
      </text>
      <text
        x={botPosStart.x} y={botPosStart.y - 8}
        fill={POS_RAIL_COLOR} fontSize={8} fontWeight="bold" textAnchor="middle"
      >
        +
      </text>
      <text
        x={botNegStart.x} y={botNegStart.y - 8}
        fill={LABEL_COLOR} fontSize={8} fontWeight="bold" textAnchor="middle"
      >
        -
      </text>

      {/* Center channel annotation */}
      <rect
        data-testid="center-channel"
        x={channelTopLeft.x + 4}
        y={channelTopLeft.y - 2}
        width={channelTopRight.x - channelTopLeft.x - 8}
        height={channelBottomLeft.y - channelTopLeft.y + 4}
        rx={2}
        fill={CHANNEL_COLOR}
        opacity={0.15}
        stroke={CHANNEL_COLOR}
        strokeWidth={0.5}
        strokeDasharray="4 2"
      />

      {/* Center channel label */}
      <text
        x={(channelTopLeft.x + channelTopRight.x) / 2}
        y={channelTopLeft.y - 6}
        fill={LABEL_COLOR}
        fontSize={6}
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        DIP Channel
      </text>
    </g>
  );
}

const BreadboardConnectivityExplainer = memo(BreadboardConnectivityExplainerInner);
export default BreadboardConnectivityExplainer;
