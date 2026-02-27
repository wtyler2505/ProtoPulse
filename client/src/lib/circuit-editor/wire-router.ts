/**
 * A* pathfinding engine for auto-routing wires on the breadboard grid.
 *
 * Routes wires between tie-points, respecting:
 *   - The center channel (e↔f is not adjacent)
 *   - Terminal-strip / power-rail boundary (no crossing)
 *   - Occupied tie-points (obstacles)
 *   - Turn penalty for cleaner, more readable routes
 *
 * Uses A* with Manhattan-distance heuristic on grid coordinates.
 * Multi-net routing connects pins in a Steiner-tree-like manner,
 * adding each routed net's points to the obstacle set for subsequent nets.
 */

import {
  type BreadboardCoord,
  type TiePoint,
  type ColumnLetter,
  BB,
  coordKey,
} from './breadboard-model';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Column letter to zero-based index. */
const colIndex: Record<ColumnLetter, number> = {
  a: 0, b: 1, c: 2, d: 3, e: 4,
  f: 5, g: 6, h: 7, i: 8, j: 9,
};

/** Index back to column letter. */
const indexToCol: ColumnLetter[] = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
];

/**
 * Represent a terminal tie-point as a compact numeric triple for fast
 * arithmetic inside the pathfinder.  We only route across terminal strips
 * (not power rails), so the grid coordinates are (colIdx, row).
 */
interface GridPos {
  col: number; // 0..9
  row: number; // 1..63
}

function toGridPos(coord: TiePoint): GridPos {
  return { col: colIndex[coord.col], row: coord.row };
}

function toCoord(gp: GridPos): TiePoint {
  return { type: 'terminal', col: indexToCol[gp.col], row: gp.row };
}

function gridKey(gp: GridPos): string {
  return `${gp.col},${gp.row}`;
}

/**
 * Return the valid neighboring grid positions for a given position.
 *
 * Adjacency rules:
 *   - Same row, column ±1 (but never across the center channel: 4↔5)
 *   - Same column, row ±1
 *   - Rows stay within 1..ROWS
 *   - Columns stay within 0..9
 */
function getNeighbors(gp: GridPos): GridPos[] {
  const neighbors: GridPos[] = [];
  const { col, row } = gp;

  // Left neighbor — blocked across the center channel (col 5 → col 4)
  const left = col - 1;
  if (left >= 0 && !(col === 5 && left === 4)) {
    neighbors.push({ col: left, row });
  }

  // Right neighbor — blocked across the center channel (col 4 → col 5)
  const right = col + 1;
  if (right <= 9 && !(col === 4 && right === 5)) {
    neighbors.push({ col: right, row });
  }

  // Up neighbor (row - 1)
  if (row - 1 >= 1) {
    neighbors.push({ col, row: row - 1 });
  }

  // Down neighbor (row + 1)
  if (row + 1 <= BB.ROWS) {
    neighbors.push({ col, row: row + 1 });
  }

  return neighbors;
}

/**
 * Manhattan distance on the grid between two positions.
 *
 * Note: columns 4 (e) and 5 (f) are adjacent by index but not by graph
 * edge — the center channel blocks direct traversal.  Points on opposite
 * sides of the channel are unreachable through terminal strips alone, and
 * `routeWire` will correctly return `[]` in those cases.  Simple Manhattan
 * is still an admissible heuristic (it never overestimates).
 */
function manhattan(a: GridPos, b: GridPos): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

// ---------------------------------------------------------------------------
// Direction tracking for turn penalty
// ---------------------------------------------------------------------------

/** Direction of travel between two adjacent grid cells. */
type Direction = 'horizontal' | 'vertical' | 'none';

function directionBetween(from: GridPos, to: GridPos): Direction {
  if (from.row === to.row) return 'horizontal';
  if (from.col === to.col) return 'vertical';
  return 'none'; // shouldn't happen for adjacent cells
}

// ---------------------------------------------------------------------------
// A* priority queue (binary min-heap)
// ---------------------------------------------------------------------------

interface HeapEntry {
  key: string;
  f: number;
}

class MinHeap {
  private data: HeapEntry[] = [];

  get size(): number {
    return this.data.length;
  }

  push(entry: HeapEntry): void {
    this.data.push(entry);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapEntry | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f >= this.data[parent].f) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < n && this.data[right].f < this.data[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * A* pathfinding between two terminal-strip tie-points.
 *
 * @param from      Start coordinate (must be a terminal tie-point)
 * @param to        End coordinate (must be a terminal tie-point)
 * @param obstacles Set of `coordKey()` strings for blocked tie-points
 * @returns         Ordered path from `from` to `to` inclusive, or `[]` if
 *                  no path exists. Start and end are always included.
 */
export function routeWire(
  from: BreadboardCoord,
  to: BreadboardCoord,
  obstacles: Set<string>,
): BreadboardCoord[] {
  // Only terminal tie-points are routable on the grid
  if (from.type !== 'terminal' || to.type !== 'terminal') return [];

  const startGp = toGridPos(from);
  const goalGp = toGridPos(to);
  const startKey = gridKey(startGp);
  const goalKey = gridKey(goalGp);

  // Trivial: same point
  if (startKey === goalKey) return [from];

  // If goal is blocked, no path
  const goalCoordKey = coordKey(to);
  if (obstacles.has(goalCoordKey)) return [];

  // --- A* search ---

  // g-score: best known cost from start to node
  const gScore = new Map<string, number>();
  gScore.set(startKey, 0);

  // Parent pointers for path reconstruction
  const cameFrom = new Map<string, string>();

  // Direction arriving at each node (for turn penalty)
  const arrivalDir = new Map<string, Direction>();
  arrivalDir.set(startKey, 'none');

  // Store GridPos by key for reconstruction
  const posMap = new Map<string, GridPos>();
  posMap.set(startKey, startGp);
  posMap.set(goalKey, goalGp);

  // Open set (min-heap ordered by f = g + h)
  const openSet = new MinHeap();
  openSet.push({ key: startKey, f: manhattan(startGp, goalGp) });

  // Closed set
  const closedSet = new Set<string>();

  while (openSet.size > 0) {
    const current = openSet.pop()!;
    const currentKey = current.key;

    if (currentKey === goalKey) {
      // Reconstruct path
      return reconstructPath(cameFrom, posMap, startKey, goalKey);
    }

    if (closedSet.has(currentKey)) continue;
    closedSet.add(currentKey);

    const currentGp = posMap.get(currentKey)!;
    const currentG = gScore.get(currentKey)!;
    const currentDir = arrivalDir.get(currentKey)!;

    for (const neighborGp of getNeighbors(currentGp)) {
      const neighborKey = gridKey(neighborGp);

      if (closedSet.has(neighborKey)) continue;

      // Check obstacle (convert to BreadboardCoord key format)
      const neighborCoord = toCoord(neighborGp);
      const neighborCoordKey = coordKey(neighborCoord);
      if (obstacles.has(neighborCoordKey) && neighborKey !== goalKey) continue;

      // Store position
      if (!posMap.has(neighborKey)) {
        posMap.set(neighborKey, neighborGp);
      }

      // Compute move cost with turn penalty
      const moveDir = directionBetween(currentGp, neighborGp);
      const isTurn = currentDir !== 'none' && moveDir !== currentDir;
      const moveCost = isTurn ? 1.5 : 1.0;

      const tentativeG = currentG + moveCost;
      const existingG = gScore.get(neighborKey);

      if (existingG === undefined || tentativeG < existingG) {
        gScore.set(neighborKey, tentativeG);
        cameFrom.set(neighborKey, currentKey);
        arrivalDir.set(neighborKey, moveDir);

        const f = tentativeG + manhattan(neighborGp, goalGp);
        openSet.push({ key: neighborKey, f });
      }
    }
  }

  // No path found
  return [];
}

/**
 * Reconstruct the path from A* parent pointers.
 */
function reconstructPath(
  cameFrom: Map<string, string>,
  posMap: Map<string, GridPos>,
  startKey: string,
  goalKey: string,
): BreadboardCoord[] {
  const path: BreadboardCoord[] = [];
  let currentKey: string | undefined = goalKey;

  while (currentKey !== undefined) {
    const gp = posMap.get(currentKey)!;
    path.push(toCoord(gp));
    if (currentKey === startKey) break;
    currentKey = cameFrom.get(currentKey);
  }

  path.reverse();
  return path;
}

// ---------------------------------------------------------------------------
// Multi-net routing
// ---------------------------------------------------------------------------

/**
 * Request to route a single net (a set of pins that must be connected).
 */
export interface NetRouteRequest {
  netId: number;
  /** All pins belonging to this net that need to be connected. */
  pins: BreadboardCoord[];
}

/**
 * Route multiple nets across the breadboard.
 *
 * For each net, pins are connected in a Steiner-tree-like fashion:
 *   1. Route pin[0] → pin[1], adding all path points to a "routed" set.
 *   2. For each subsequent pin, find the nearest already-routed point
 *      and route to it.
 *   3. After completing a net, add its routed points to the global
 *      obstacle set so subsequent nets route around it.
 *
 * @param nets      Array of net route requests
 * @param obstacles Initial set of `coordKey()` strings for blocked points
 * @returns         Map from netId → array of wire segments (each a path)
 */
export function routeAllNets(
  nets: NetRouteRequest[],
  obstacles: Set<string>,
): Map<number, BreadboardCoord[][]> {
  // Work on a mutable copy of obstacles so we don't mutate the caller's set
  const globalObstacles = new Set(Array.from(obstacles));
  const result = new Map<number, BreadboardCoord[][]>();

  for (const net of nets) {
    const segments: BreadboardCoord[][] = [];

    if (net.pins.length < 2) {
      // Nothing to route: zero or one pin
      result.set(net.netId, segments);
      continue;
    }

    // Set of coordKeys that have been routed for this net (acts as
    // potential connection targets for subsequent pins)
    const routedKeys = new Set<string>();
    // Parallel array of coords for distance computation
    const routedCoords: BreadboardCoord[] = [];

    // Route first pair: pin[0] → pin[1]
    const firstPath = routeWire(net.pins[0], net.pins[1], globalObstacles);
    segments.push(firstPath);

    for (const coord of firstPath) {
      const key = coordKey(coord);
      routedKeys.add(key);
      routedCoords.push(coord);
    }

    // Route remaining pins to the nearest already-routed point
    for (let i = 2; i < net.pins.length; i++) {
      const pin = net.pins[i];

      // Skip if this pin is already on the routed set
      if (routedKeys.has(coordKey(pin))) {
        continue;
      }

      // Find the nearest routed point to this pin (by Manhattan distance
      // in grid coordinates, for terminal points only)
      const target = findNearestRouted(pin, routedCoords);
      if (target === null) {
        // Can't find a routable target — push empty segment
        segments.push([]);
        continue;
      }

      const path = routeWire(pin, target, globalObstacles);
      segments.push(path);

      for (const coord of path) {
        const key = coordKey(coord);
        if (!routedKeys.has(key)) {
          routedKeys.add(key);
          routedCoords.push(coord);
        }
      }
    }

    // Add this net's routed points to global obstacles for subsequent nets
    for (const coord of routedCoords) {
      globalObstacles.add(coordKey(coord));
    }

    result.set(net.netId, segments);
  }

  return result;
}

/**
 * Find the nearest already-routed coordinate to a given pin.
 * Uses Manhattan distance in grid coordinates for terminal points.
 */
function findNearestRouted(
  pin: BreadboardCoord,
  routedCoords: BreadboardCoord[],
): BreadboardCoord | null {
  if (pin.type !== 'terminal') return null;

  const pinGp = toGridPos(pin);
  let bestDist = Infinity;
  let bestCoord: BreadboardCoord | null = null;

  for (const rc of routedCoords) {
    if (rc.type !== 'terminal') continue;
    const rcGp = toGridPos(rc);
    const dist = manhattan(pinGp, rcGp);
    if (dist < bestDist) {
      bestDist = dist;
      bestCoord = rc;
    }
  }

  return bestCoord;
}

// ---------------------------------------------------------------------------
// Wire color assignment
// ---------------------------------------------------------------------------

/**
 * Preset palette of 12 visually distinct colors commonly used for
 * breadboard wires.
 */
const WIRE_PALETTE: readonly string[] = [
  '#e74c3c', // red
  '#3498db', // blue
  '#2ecc71', // green
  '#f39c12', // amber
  '#9b59b6', // purple
  '#1abc9c', // teal
  '#e67e22', // orange
  '#34495e', // dark slate
  '#e91e63', // pink
  '#00bcd4', // cyan
  '#8bc34a', // light green
  '#ff5722', // deep orange
] as const;

/**
 * Assign visually distinct colors to `netCount` nets.
 *
 * Cycles through the 12-color palette if more nets are needed.
 *
 * @param netCount Number of nets to assign colors for
 * @returns        Array of hex color strings, one per net
 */
export function assignWireColors(netCount: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < netCount; i++) {
    colors.push(WIRE_PALETTE[i % WIRE_PALETTE.length]);
  }
  return colors;
}
