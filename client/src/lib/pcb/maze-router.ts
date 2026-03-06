/**
 * MazeRouter — A* maze router for PCB autorouting.
 *
 * Discretizes the board into a grid and uses A* pathfinding with 8-directional
 * movement to route copper traces between pads. Supports multi-layer routing
 * with via insertion, obstacle inflation for clearance, progressive blocking,
 * and net ordering by shortest-first or explicit priority.
 *
 * Pure class — no React, no DOM, no side effects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GridCell {
  x: number;
  y: number;
  blocked: boolean;
  netId?: string;
  layer: string;
}

export interface RouteRequest {
  netId: string;
  sourcePad: { x: number; y: number; layer: string };
  targetPad: { x: number; y: number; layer: string };
  traceWidth: number;
  clearance: number;
  priority?: number;
}

export interface RoutedNet {
  netId: string;
  points: Array<{ x: number; y: number }>;
  layer: string;
  width: number;
  vias: Array<{ x: number; y: number }>;
}

export interface RouteResult {
  routed: RoutedNet[];
  unrouted: string[];
  stats: {
    routedCount: number;
    unroutedCount: number;
    viaCount: number;
    totalLengthMm: number;
    timeMs: number;
  };
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface MazeRouterConfig {
  gridSizeMm?: number;
  viaCost?: number;
  layerChangeCost?: number;
  layerCount?: number;
}

interface AStarNode {
  gx: number; // grid x
  gy: number; // grid y
  layer: number; // 0 = front, 1 = back
  g: number; // cost from start
  f: number; // g + h
  parentIdx: number; // index into closed list, -1 for start
}

// 8-directional movement: [dx, dy, cost multiplier]
const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],    // E
  [-1, 0, 1],   // W
  [0, 1, 1],    // S
  [0, -1, 1],   // N
  [1, 1, Math.SQRT2],   // SE
  [-1, 1, Math.SQRT2],  // SW
  [1, -1, Math.SQRT2],  // NE
  [-1, -1, Math.SQRT2], // NW
];

import { getLayerIndex, getLayerName, normalizeLegacyLayer } from '@/lib/pcb/layer-utils';

const LAYER_FRONT = 0;

function layerNameToIndex(name: string, layerCount: number): number {
  return getLayerIndex(name, layerCount);
}

function layerIndexToName(idx: number, layerCount: number): string {
  return getLayerName(idx, layerCount);
}

// ---------------------------------------------------------------------------
// Binary min-heap for A* open set
// ---------------------------------------------------------------------------

class MinHeap {
  private data: AStarNode[] = [];

  get size(): number {
    return this.data.length;
  }

  push(node: AStarNode): void {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): AStarNode | undefined {
    if (this.data.length === 0) {
      return undefined;
    }
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.data[idx].f < this.data[parent].f) {
        const tmp = this.data[idx];
        this.data[idx] = this.data[parent];
        this.data[parent] = tmp;
        idx = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(idx: number): void {
    const len = this.data.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;

      if (left < len && this.data[left].f < this.data[smallest].f) {
        smallest = left;
      }
      if (right < len && this.data[right].f < this.data[smallest].f) {
        smallest = right;
      }

      if (smallest !== idx) {
        const tmp = this.data[idx];
        this.data[idx] = this.data[smallest];
        this.data[smallest] = tmp;
        idx = smallest;
      } else {
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// MazeRouter
// ---------------------------------------------------------------------------

export class MazeRouter {
  private gridSizeMm: number;
  private viaCost: number;
  private layerChangeCost: number;
  private layerCount: number;

  private cols = 0;
  private rows = 0;

  // N flat Uint8Arrays, one per layer (0 = unblocked, 1 = blocked)
  private blockedLayers: Uint8Array[] = [];

  // Track which net occupies each cell per layer (for rip-up). '' = unoccupied.
  private netOccLayers: string[][] = [];

  constructor(config?: MazeRouterConfig) {
    this.gridSizeMm = config?.gridSizeMm ?? 0.25;
    this.viaCost = config?.viaCost ?? 50;
    this.layerChangeCost = config?.layerChangeCost ?? 50;
    this.layerCount = config?.layerCount ?? 2;
  }

  // -----------------------------------------------------------------------
  // Grid setup
  // -----------------------------------------------------------------------

  initGrid(boardWidthMm: number, boardHeightMm: number): void {
    this.cols = Math.ceil(boardWidthMm / this.gridSizeMm);
    this.rows = Math.ceil(boardHeightMm / this.gridSizeMm);
    const total = this.cols * this.rows;

    this.blockedLayers = [];
    this.netOccLayers = [];
    for (let i = 0; i < this.layerCount; i++) {
      this.blockedLayers.push(new Uint8Array(total));
      this.netOccLayers.push(new Array<string>(total).fill(''));
    }
  }

  addObstacle(obstacle: {
    x: number;
    y: number;
    width: number;
    height: number;
    layer: string;
    netId?: string;
  }): void {
    const grid = this.getBlockedGrid(obstacle.layer);
    const netGrid = this.getNetGrid(obstacle.layer);
    if (!grid || !netGrid) {
      return;
    }

    // Convert obstacle rectangle to grid coordinates
    const gx0 = Math.floor(obstacle.x / this.gridSizeMm);
    const gy0 = Math.floor(obstacle.y / this.gridSizeMm);
    const gx1 = Math.ceil((obstacle.x + obstacle.width) / this.gridSizeMm);
    const gy1 = Math.ceil((obstacle.y + obstacle.height) / this.gridSizeMm);

    for (let gy = Math.max(0, gy0); gy < Math.min(this.rows, gy1); gy++) {
      for (let gx = Math.max(0, gx0); gx < Math.min(this.cols, gx1); gx++) {
        const idx = gy * this.cols + gx;
        grid[idx] = 1;
        if (obstacle.netId) {
          netGrid[idx] = obstacle.netId;
        }
      }
    }
  }

  addCircularObstacle(obstacle: {
    cx: number;
    cy: number;
    radius: number;
    layer: string;
    netId?: string;
  }): void {
    const grid = this.getBlockedGrid(obstacle.layer);
    const netGrid = this.getNetGrid(obstacle.layer);
    if (!grid || !netGrid) {
      return;
    }

    const gcx = obstacle.cx / this.gridSizeMm;
    const gcy = obstacle.cy / this.gridSizeMm;
    const gr = obstacle.radius / this.gridSizeMm;

    const gx0 = Math.max(0, Math.floor(gcx - gr));
    const gx1 = Math.min(this.cols - 1, Math.ceil(gcx + gr));
    const gy0 = Math.max(0, Math.floor(gcy - gr));
    const gy1 = Math.min(this.rows - 1, Math.ceil(gcy + gr));

    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const dx = gx - gcx;
        const dy = gy - gcy;
        if (dx * dx + dy * dy <= gr * gr) {
          const idx = gy * this.cols + gx;
          grid[idx] = 1;
          if (obstacle.netId) {
            netGrid[idx] = obstacle.netId;
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Routing
  // -----------------------------------------------------------------------

  routeNet(request: RouteRequest): RoutedNet | null {
    const srcGx = this.mmToGrid(request.sourcePad.x);
    const srcGy = this.mmToGrid(request.sourcePad.y);
    const tgtGx = this.mmToGrid(request.targetPad.x);
    const tgtGy = this.mmToGrid(request.targetPad.y);
    const srcLayer = layerNameToIndex(request.sourcePad.layer, this.layerCount);
    const tgtLayer = layerNameToIndex(request.targetPad.layer, this.layerCount);

    // Same cell — trivial route
    if (srcGx === tgtGx && srcGy === tgtGy && srcLayer === tgtLayer) {
      return {
        netId: request.netId,
        points: [
          { x: request.sourcePad.x, y: request.sourcePad.y },
        ],
        layer: request.sourcePad.layer,
        width: request.traceWidth,
        vias: [],
      };
    }

    // Run A*
    const path = this.astar(
      srcGx, srcGy, srcLayer,
      tgtGx, tgtGy, tgtLayer,
      request.netId,
    );

    if (!path) {
      return null;
    }

    // Convert grid path to mm coordinates, split by layer, collect vias
    return this.buildRoutedNet(path, request);
  }

  routeAll(requests: RouteRequest[]): RouteResult {
    const startTime = performance.now();

    // Sort: by explicit priority first (lower = first), then by Euclidean distance
    const sorted = [...requests].sort((a, b) => {
      if (a.priority !== undefined && b.priority !== undefined) {
        return a.priority - b.priority;
      }
      if (a.priority !== undefined) {
        return -1;
      }
      if (b.priority !== undefined) {
        return 1;
      }
      const distA = Math.sqrt(
        (a.sourcePad.x - a.targetPad.x) ** 2 + (a.sourcePad.y - a.targetPad.y) ** 2,
      );
      const distB = Math.sqrt(
        (b.sourcePad.x - b.targetPad.x) ** 2 + (b.sourcePad.y - b.targetPad.y) ** 2,
      );
      return distA - distB;
    });

    const routed: RoutedNet[] = [];
    const unrouted: string[] = [];
    let viaCount = 0;
    let totalLengthMm = 0;

    for (const req of sorted) {
      const result = this.routeNet(req);
      if (result) {
        routed.push(result);
        viaCount += result.vias.length;
        totalLengthMm += this.computePathLength(result.points);

        // Progressive blocking — mark path cells as occupied
        this.blockPath(result, req.traceWidth, req.clearance);
      } else {
        unrouted.push(req.netId);
      }
    }

    const elapsed = performance.now() - startTime;

    return {
      routed,
      unrouted,
      stats: {
        routedCount: routed.length,
        unroutedCount: unrouted.length,
        viaCount,
        totalLengthMm,
        timeMs: elapsed,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Rip-up and reroute
  // -----------------------------------------------------------------------

  /**
   * Remove all cells occupied by the given net, unblocking them for other nets.
   */
  ripUpNet(netId: string): void {
    const total = this.cols * this.rows;
    for (let li = 0; li < this.layerCount; li++) {
      const blocked = this.blockedLayers[li];
      const netOcc = this.netOccLayers[li];
      for (let i = 0; i < total; i++) {
        if (netOcc[i] === netId) {
          blocked[i] = 0;
          netOcc[i] = '';
        }
      }
    }
  }

  /**
   * Sort nets by criticality: explicit priority first (lower = first),
   * then by Euclidean distance (shorter = first).
   *
   * Does not mutate the input array.
   */
  sortNetsByCriticality(requests: RouteRequest[]): RouteRequest[] {
    return [...requests].sort((a, b) => {
      if (a.priority !== undefined && b.priority !== undefined) {
        return a.priority - b.priority;
      }
      if (a.priority !== undefined) {
        return -1;
      }
      if (b.priority !== undefined) {
        return 1;
      }
      const distA = Math.sqrt(
        (a.sourcePad.x - a.targetPad.x) ** 2 + (a.sourcePad.y - a.targetPad.y) ** 2,
      );
      const distB = Math.sqrt(
        (b.sourcePad.x - b.targetPad.x) ** 2 + (b.sourcePad.y - b.targetPad.y) ** 2,
      );
      return distA - distB;
    });
  }

  /**
   * Route all nets with iterative rip-up and reroute.
   *
   * Strategy:
   * 1. Sort nets by criticality and route all.
   * 2. For each failed net, rip up conflicting nets, route the failed net,
   *    then reroute the ripped-up nets.
   * 3. Repeat up to maxIterations times (default 3).
   */
  routeWithRipUp(requests: RouteRequest[], maxIterations = 3): RouteResult {
    const startTime = performance.now();

    if (requests.length === 0) {
      return {
        routed: [],
        unrouted: [],
        stats: { routedCount: 0, unroutedCount: 0, viaCount: 0, totalLengthMm: 0, timeMs: 0 },
      };
    }

    const sorted = this.sortNetsByCriticality(requests);
    const requestMap = new Map<string, RouteRequest>();
    for (const req of sorted) {
      requestMap.set(req.netId, req);
    }

    // Initial routing pass
    let routedMap = new Map<string, RoutedNet>();
    let unroutedIds: string[] = [];

    for (const req of sorted) {
      const result = this.routeNet(req);
      if (result) {
        routedMap.set(req.netId, result);
        this.blockPath(result, req.traceWidth, req.clearance);
      } else {
        unroutedIds.push(req.netId);
      }
    }

    // Rip-up iterations
    for (let iter = 0; iter < maxIterations && unroutedIds.length > 0; iter++) {
      const stillUnrouted: string[] = [];

      for (const failedNetId of unroutedIds) {
        const failedReq = requestMap.get(failedNetId);
        if (!failedReq) {
          continue;
        }

        // Find which nets are blocking this one by checking cells along
        // the direct path between source and target
        const conflictingNets = this.findConflictingNets(failedReq);

        if (conflictingNets.length === 0) {
          // No identifiable conflicts — truly unroutable
          stillUnrouted.push(failedNetId);
          continue;
        }

        // Rip up conflicting nets
        const rippedUp: string[] = [];
        for (const conflictId of conflictingNets) {
          if (routedMap.has(conflictId)) {
            this.ripUpNet(conflictId);
            routedMap.delete(conflictId);
            rippedUp.push(conflictId);
          }
        }

        // Try to route the failed net
        const result = this.routeNet(failedReq);
        if (result) {
          routedMap.set(failedNetId, result);
          this.blockPath(result, failedReq.traceWidth, failedReq.clearance);
        } else {
          stillUnrouted.push(failedNetId);
        }

        // Reroute the ripped-up nets
        for (const rippedId of rippedUp) {
          if (routedMap.has(rippedId)) {
            continue; // Already re-routed somehow
          }
          const rippedReq = requestMap.get(rippedId);
          if (!rippedReq) {
            continue;
          }
          const rerouted = this.routeNet(rippedReq);
          if (rerouted) {
            routedMap.set(rippedId, rerouted);
            this.blockPath(rerouted, rippedReq.traceWidth, rippedReq.clearance);
          } else {
            stillUnrouted.push(rippedId);
          }
        }
      }

      // Deduplicate unrouted list
      const unroutedSet = new Set(stillUnrouted);
      // Remove any that got routed during this iteration
      for (const id of Array.from(unroutedSet)) {
        if (routedMap.has(id)) {
          unroutedSet.delete(id);
        }
      }
      unroutedIds = Array.from(unroutedSet);
    }

    // Build final result
    const routed = Array.from(routedMap.values());
    let viaCount = 0;
    let totalLengthMm = 0;
    for (const r of routed) {
      viaCount += r.vias.length;
      totalLengthMm += this.computePathLength(r.points);
    }

    const elapsed = performance.now() - startTime;

    return {
      routed,
      unrouted: unroutedIds,
      stats: {
        routedCount: routed.length,
        unroutedCount: unroutedIds.length,
        viaCount,
        totalLengthMm,
        timeMs: elapsed,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Grid queries
  // -----------------------------------------------------------------------

  isBlocked(gridX: number, gridY: number, layer: string): boolean {
    if (gridX < 0 || gridY < 0 || gridX >= this.cols || gridY >= this.rows) {
      return true; // Out of bounds = blocked
    }
    const grid = this.getBlockedGrid(layer);
    if (!grid) {
      return true;
    }
    return grid[gridY * this.cols + gridX] === 1;
  }

  getGridSize(): { cols: number; rows: number } {
    return { cols: this.cols, rows: this.rows };
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  mmToGrid(mm: number): number {
    return Math.round(mm / this.gridSizeMm);
  }

  gridToMm(grid: number): number {
    return grid * this.gridSizeMm;
  }

  simplifyPath(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (points.length <= 2) {
      return points.map((p) => ({ ...p }));
    }

    const result: Array<{ x: number; y: number }> = [{ ...points[0] }];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      // Direction from prev to curr
      const dx1 = Math.sign(curr.x - prev.x);
      const dy1 = Math.sign(curr.y - prev.y);
      // Direction from curr to next
      const dx2 = Math.sign(next.x - curr.x);
      const dy2 = Math.sign(next.y - curr.y);

      if (dx1 !== dx2 || dy1 !== dy2) {
        result.push({ ...curr });
      }
    }

    result.push({ ...points[points.length - 1] });
    return result;
  }

  // -----------------------------------------------------------------------
  // A* implementation
  // -----------------------------------------------------------------------

  private astar(
    srcGx: number, srcGy: number, srcLayer: number,
    tgtGx: number, tgtGy: number, tgtLayer: number,
    netId: string,
  ): Array<{ gx: number; gy: number; layer: number }> | null {
    // Clamp to grid bounds
    const sx = Math.max(0, Math.min(this.cols - 1, srcGx));
    const sy = Math.max(0, Math.min(this.rows - 1, srcGy));
    const tx = Math.max(0, Math.min(this.cols - 1, tgtGx));
    const ty = Math.max(0, Math.min(this.rows - 1, tgtGy));

    // Visited set: flat array indexed by (layer * rows * cols + gy * cols + gx)
    const totalCells = this.layerCount * this.rows * this.cols;
    const visited = new Uint8Array(totalCells);
    // Best-g tracking for duplicate detection
    const bestG = new Float32Array(totalCells);
    bestG.fill(Infinity);

    const closedList: AStarNode[] = [];

    const heuristic = (gx: number, gy: number, layer: number): number => {
      const dx = Math.abs(gx - tx);
      const dy = Math.abs(gy - ty);
      // Octile distance (consistent heuristic for 8-directional)
      const h = Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
      // Add via cost if on wrong layer
      if (layer !== tgtLayer) {
        return h + this.viaCost;
      }
      return h;
    };

    const open = new MinHeap();

    const startH = heuristic(sx, sy, srcLayer);
    const startNode: AStarNode = {
      gx: sx, gy: sy, layer: srcLayer,
      g: 0, f: startH, parentIdx: -1,
    };
    open.push(startNode);
    bestG[srcLayer * this.rows * this.cols + sy * this.cols + sx] = 0;

    while (open.size > 0) {
      const current = open.pop()!;
      const flatIdx = current.layer * this.rows * this.cols + current.gy * this.cols + current.gx;

      // Skip if already visited with better or equal cost
      if (visited[flatIdx]) {
        continue;
      }
      visited[flatIdx] = 1;

      // Store in closed list for path reconstruction
      const currentIdx = closedList.length;
      closedList.push(current);

      // Goal check
      if (current.gx === tx && current.gy === ty && current.layer === tgtLayer) {
        return this.reconstructPath(closedList, currentIdx);
      }

      // Expand neighbors — 8 directional movement on same layer
      for (const dir of DIRS) {
        const nx = current.gx + dir[0];
        const ny = current.gy + dir[1];

        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) {
          continue;
        }

        const nFlatIdx = current.layer * this.rows * this.cols + ny * this.cols + nx;
        if (visited[nFlatIdx]) {
          continue;
        }

        // Check if cell is blocked (considering same-net passthrough)
        if (this.isCellBlockedForNet(nx, ny, current.layer, netId)) {
          continue;
        }

        const ng = current.g + dir[2];
        if (ng < bestG[nFlatIdx]) {
          bestG[nFlatIdx] = ng;
          const nh = heuristic(nx, ny, current.layer);
          open.push({
            gx: nx, gy: ny, layer: current.layer,
            g: ng, f: ng + nh, parentIdx: currentIdx,
          });
        }
      }

      // Layer change (via) at current position — try all other layers
      for (let otherLayer = 0; otherLayer < this.layerCount; otherLayer++) {
        if (otherLayer === current.layer) {
          continue;
        }
        const viaFlatIdx = otherLayer * this.rows * this.cols + current.gy * this.cols + current.gx;

        if (!visited[viaFlatIdx] && !this.isCellBlockedForNet(current.gx, current.gy, otherLayer, netId)) {
          const viaG = current.g + this.viaCost;
          if (viaG < bestG[viaFlatIdx]) {
            bestG[viaFlatIdx] = viaG;
            const viaH = heuristic(current.gx, current.gy, otherLayer);
            open.push({
              gx: current.gx, gy: current.gy, layer: otherLayer,
              g: viaG, f: viaG + viaH, parentIdx: currentIdx,
            });
          }
        }
      }
    }

    return null; // No path found
  }

  private reconstructPath(
    closedList: AStarNode[],
    endIdx: number,
  ): Array<{ gx: number; gy: number; layer: number }> {
    const path: Array<{ gx: number; gy: number; layer: number }> = [];
    let idx = endIdx;
    while (idx !== -1) {
      const node = closedList[idx];
      path.push({ gx: node.gx, gy: node.gy, layer: node.layer });
      idx = node.parentIdx;
    }
    path.reverse();
    return path;
  }

  // -----------------------------------------------------------------------
  // Route building
  // -----------------------------------------------------------------------

  private buildRoutedNet(
    path: Array<{ gx: number; gy: number; layer: number }>,
    request: RouteRequest,
  ): RoutedNet {
    const vias: Array<{ x: number; y: number }> = [];
    const mmPoints: Array<{ x: number; y: number }> = [];

    // Convert grid coordinates to mm
    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      const mmX = this.gridToMm(step.gx);
      const mmY = this.gridToMm(step.gy);

      // Detect layer change (via)
      if (i > 0 && path[i - 1].layer !== step.layer) {
        vias.push({ x: mmX, y: mmY });
      }

      mmPoints.push({ x: mmX, y: mmY });
    }

    // Simplify path
    const simplified = this.simplifyPath(mmPoints);

    // Override first and last point with exact pad coordinates
    if (simplified.length >= 1) {
      simplified[0] = { x: request.sourcePad.x, y: request.sourcePad.y };
    }
    if (simplified.length >= 2) {
      simplified[simplified.length - 1] = { x: request.targetPad.x, y: request.targetPad.y };
    }

    // Use the primary layer (the layer with the most steps)
    const layerCounts = new Array<number>(this.layerCount).fill(0);
    for (const step of path) {
      layerCounts[step.layer]++;
    }
    let maxCount = 0;
    let primaryLayerIdx = LAYER_FRONT;
    for (let i = 0; i < this.layerCount; i++) {
      if (layerCounts[i] > maxCount) {
        maxCount = layerCounts[i];
        primaryLayerIdx = i;
      }
    }
    const primaryLayer = layerIndexToName(primaryLayerIdx, this.layerCount);

    return {
      netId: request.netId,
      points: simplified,
      layer: primaryLayer,
      width: request.traceWidth,
      vias,
    };
  }

  // -----------------------------------------------------------------------
  // Progressive blocking
  // -----------------------------------------------------------------------

  private blockPath(routed: RoutedNet, traceWidth: number, clearance: number): void {
    // Convert routed path back to grid and block cells with inflation
    const inflationMm = clearance + traceWidth / 2;
    const inflationGrid = Math.ceil(inflationMm / this.gridSizeMm);

    // Walk the simplified path, marking cells along each segment
    for (let i = 0; i < routed.points.length - 1; i++) {
      const p0 = routed.points[i];
      const p1 = routed.points[i + 1];

      this.blockSegment(
        p0.x, p0.y, p1.x, p1.y,
        routed.layer, routed.netId,
        inflationGrid,
      );
    }

    // Block via positions on both layers
    for (const via of routed.vias) {
      this.blockViaPosition(via.x, via.y, routed.netId, inflationGrid);
    }
  }

  private blockSegment(
    x0: number, y0: number, x1: number, y1: number,
    layer: string, netId: string,
    inflation: number,
  ): void {
    const gx0 = this.mmToGrid(x0);
    const gy0 = this.mmToGrid(y0);
    const gx1 = this.mmToGrid(x1);
    const gy1 = this.mmToGrid(y1);

    // Bresenham-like walk along the segment, blocking cells with inflation
    const dx = Math.abs(gx1 - gx0);
    const dy = Math.abs(gy1 - gy0);
    const sx = gx0 < gx1 ? 1 : -1;
    const sy = gy0 < gy1 ? 1 : -1;
    let err = dx - dy;
    let cx = gx0;
    let cy = gy0;

    const grid = this.getBlockedGrid(layer);
    const netGrid = this.getNetGrid(layer);
    if (!grid || !netGrid) {
      return;
    }

    while (true) {
      // Block cells within inflation radius around current cell
      for (let iy = -inflation; iy <= inflation; iy++) {
        for (let ix = -inflation; ix <= inflation; ix++) {
          const bx = cx + ix;
          const by = cy + iy;
          if (bx >= 0 && bx < this.cols && by >= 0 && by < this.rows) {
            const idx = by * this.cols + bx;
            grid[idx] = 1;
            netGrid[idx] = netId;
          }
        }
      }

      if (cx === gx1 && cy === gy1) {
        break;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  private blockViaPosition(x: number, y: number, netId: string, inflation: number): void {
    const gx = this.mmToGrid(x);
    const gy = this.mmToGrid(y);

    // Vias block on all layers
    for (let li = 0; li < this.layerCount; li++) {
      const grid = this.blockedLayers[li];
      const netGrid = this.netOccLayers[li];

      for (let iy = -inflation; iy <= inflation; iy++) {
        for (let ix = -inflation; ix <= inflation; ix++) {
          const bx = gx + ix;
          const by = gy + iy;
          if (bx >= 0 && bx < this.cols && by >= 0 && by < this.rows) {
            const idx = by * this.cols + bx;
            grid[idx] = 1;
            netGrid[idx] = netId;
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Grid helpers
  // -----------------------------------------------------------------------

  private getBlockedGrid(layer: string): Uint8Array | null {
    const idx = getLayerIndex(layer, this.layerCount);
    return this.blockedLayers[idx] ?? null;
  }

  private getNetGrid(layer: string): string[] | null {
    const idx = getLayerIndex(layer, this.layerCount);
    return this.netOccLayers[idx] ?? null;
  }

  private isCellBlockedForNet(gx: number, gy: number, layer: number, netId: string): boolean {
    const grid = this.blockedLayers[layer];
    const netGrid = this.netOccLayers[layer];
    if (!grid || !netGrid) {
      return true;
    }
    const idx = gy * this.cols + gx;

    if (grid[idx] === 0) {
      return false;
    }

    // If the cell is occupied by the same net, it's passable
    if (netGrid[idx] === netId && netId !== '') {
      return false;
    }

    return true;
  }

  private computePathLength(points: Array<{ x: number; y: number }>): number {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  /**
   * Find nets that are blocking a route request by sampling cells along
   * the direct path between source and target.
   */
  private findConflictingNets(request: RouteRequest): string[] {
    const sx = this.mmToGrid(request.sourcePad.x);
    const sy = this.mmToGrid(request.sourcePad.y);
    const tx = this.mmToGrid(request.targetPad.x);
    const ty = this.mmToGrid(request.targetPad.y);

    const conflicts = new Set<string>();

    // Sample cells along the Bresenham line from source to target
    const dx = Math.abs(tx - sx);
    const dy = Math.abs(ty - sy);
    const stepX = sx < tx ? 1 : -1;
    const stepY = sy < ty ? 1 : -1;
    let err = dx - dy;
    let cx = sx;
    let cy = sy;

    while (true) {
      if (cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows) {
        const idx = cy * this.cols + cx;
        // Check all layers
        for (let li = 0; li < this.layerCount; li++) {
          const netOcc = this.netOccLayers[li];
          if (netOcc[idx] !== '' && netOcc[idx] !== request.netId) {
            conflicts.add(netOcc[idx]);
          }
        }
      }

      if (cx === tx && cy === ty) {
        break;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += stepX;
      }
      if (e2 < dx) {
        err += dx;
        cy += stepY;
      }
    }

    return Array.from(conflicts);
  }
}
