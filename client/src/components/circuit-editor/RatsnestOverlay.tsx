/**
 * RatsnestOverlay — renders unrouted net connections as straight lines
 * between pins. As wires are routed, the ratsnest lines disappear.
 * Used in both breadboard and PCB views.
 */

import { memo, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RatsnestPin {
  instanceId: number;
  pinId: string;
  x: number;
  y: number;
}

export interface RatsnestNet {
  netId: number;
  name: string;
  color: string;
  pins: RatsnestPin[];
  /** Pin pairs that are already routed (fully connected) */
  routedPairs: Set<string>;
}

interface RatsnestOverlayProps {
  nets: RatsnestNet[];
  /** Opacity of ratsnest lines (0-1) */
  opacity?: number;
  /** Whether to show net labels at midpoints */
  showLabels?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Canonical key for a pin pair (order-independent) */
function pairKey(a: RatsnestPin, b: RatsnestPin): string {
  const ka = `${a.instanceId}:${a.pinId}`;
  const kb = `${b.instanceId}:${b.pinId}`;
  return ka < kb ? `${ka}-${kb}` : `${kb}-${ka}`;
}

/**
 * Compute minimum spanning tree edges for a set of pins using Prim's algorithm.
 * Returns pairs of pin indices that form the MST.
 */
function computeMST(pins: RatsnestPin[]): [number, number][] {
  if (pins.length < 2) return [];

  const n = pins.length;
  const inTree = new Array<boolean>(n).fill(false);
  inTree[0] = true;
  let treeSize = 1;
  const edges: [number, number][] = [];

  while (treeSize < n) {
    let bestDist = Infinity;
    let bestFrom = -1;
    let bestTo = -1;

    for (let from = 0; from < n; from++) {
      if (!inTree[from]) continue;
      for (let to = 0; to < n; to++) {
        if (inTree[to]) continue;
        const dx = pins[from].x - pins[to].x;
        const dy = pins[from].y - pins[to].y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestFrom = from;
          bestTo = to;
        }
      }
    }

    if (bestTo === -1) break;
    inTree[bestTo] = true;
    treeSize++;
    edges.push([bestFrom, bestTo]);
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function RatsnestOverlayInner({ nets, opacity = 0.6, showLabels = false }: RatsnestOverlayProps) {
  const lines = useMemo(() => {
    const result: Array<{
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      netName: string;
    }> = [];

    for (const net of nets) {
      if (net.pins.length < 2) continue;

      // Compute MST to get minimal connection set
      const mstEdges = computeMST(net.pins);

      for (const [fromIdx, toIdx] of mstEdges) {
        const from = net.pins[fromIdx];
        const to = net.pins[toIdx];
        const pk = pairKey(from, to);

        // Skip already-routed pairs
        if (net.routedPairs.has(pk)) continue;

        result.push({
          key: `${net.netId}-${pk}`,
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          color: net.color,
          netName: net.name,
        });
      }
    }

    return result;
  }, [nets]);

  if (lines.length === 0) return null;

  return (
    <g data-testid="ratsnest-overlay" opacity={opacity}>
      {lines.map((line) => (
        <g key={line.key}>
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth={0.5}
            strokeDasharray="3,2"
            pointerEvents="none"
          />
          {showLabels && (
            <text
              x={(line.x1 + line.x2) / 2}
              y={(line.y1 + line.y2) / 2 - 2}
              fontSize={3}
              fill={line.color}
              textAnchor="middle"
              pointerEvents="none"
              opacity={0.8}
            >
              {line.netName}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

const RatsnestOverlay = memo(RatsnestOverlayInner);
export default RatsnestOverlay;
