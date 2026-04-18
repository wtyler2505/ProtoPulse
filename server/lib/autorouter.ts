/**
 * PCB Autorouter — A* grid-based pathfinder with optional 2-layer support.
 *
 * This is a pragmatic implementation for the `suggest_trace_path` AI tool.
 * It is intentionally scoped:
 *
 *   - Single net at a time (no rip-up-and-retry, no global optimization).
 *   - No length matching, no differential pairs, no impedance control.
 *   - No thermal relief / copper pour awareness.
 *   - Obstacle grid is a binary mask per layer. Existing traces inflate their
 *     footprint by `clearance + traceWidth/2` cells.
 *   - Layers: up to 2 by default (top/bottom). Changing layers pays a
 *     configurable `viaCost` penalty and requires a free cell on both layers.
 *
 * The algorithm is A* with a Manhattan + layer-change admissible heuristic.
 * It is O(N log N) in the number of visited cells.
 *
 * All coordinates are in millimetres. Grid resolution is configurable
 * (default 0.5 mm). The caller translates world coordinates into grid cells
 * and back.
 */

export type Layer = 'top' | 'bottom';

export interface Point {
  x: number;
  y: number;
}

export interface Waypoint extends Point {
  layer: Layer;
}

export interface RectObstacle {
  /** Top-left corner (mm). */
  x: number;
  y: number;
  /** Width & height in mm. */
  width: number;
  height: number;
  /** Which layer(s) this obstacle blocks. Defaults to both. */
  layers?: Layer[];
}

export interface AutorouteOptions {
  /** Grid bounds in mm (minX, minY, maxX, maxY). */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Grid resolution in mm per cell. Default 0.5. */
  resolutionMm?: number;
  /** Trace width in mm (used for obstacle inflation). Default 0.25. */
  traceWidthMm?: number;
  /** Minimum clearance in mm between copper features. Default 0.2. */
  clearanceMm?: number;
  /** Start point with layer. */
  start: Waypoint;
  /** End point with layer. */
  end: Waypoint;
  /** Rectangular obstacles (component footprints, existing traces, keepouts). */
  obstacles: RectObstacle[];
  /** Layers the router is allowed to use. Default ['top','bottom']. */
  layers?: Layer[];
  /** A* cost penalty for a layer change (via). Default 10. */
  viaCost?: number;
  /** Cap on visited cells (safety valve). Default 200_000. */
  maxVisited?: number;
}

export interface AutorouteSuccess {
  success: true;
  path: Waypoint[];
  visited: number;
  viaCount: number;
}

export interface AutorouteFailure {
  success: false;
  reason: 'no-path' | 'start-blocked' | 'end-blocked' | 'visited-cap' | 'invalid-bounds';
  visited: number;
}

export type AutorouteResult = AutorouteSuccess | AutorouteFailure;

interface InternalCell {
  cx: number;
  cy: number;
  layerIdx: number;
}

/** Convert world (mm) to grid cell coordinates. */
function worldToCell(x: number, originX: number, res: number): number {
  return Math.round((x - originX) / res);
}

function cellToWorld(c: number, originX: number, res: number): number {
  return originX + c * res;
}

function layerIndex(layers: Layer[], layer: Layer): number {
  const idx = layers.indexOf(layer);
  return idx < 0 ? 0 : idx;
}

/** Build a per-layer binary blocked mask. true = blocked. */
function buildBlockedMasks(
  obstacles: RectObstacle[],
  layers: Layer[],
  bounds: AutorouteOptions['bounds'],
  res: number,
  inflationMm: number,
  cols: number,
  rows: number,
): boolean[][] {
  const masks: boolean[][] = layers.map(() => new Array<boolean>(cols * rows).fill(false));
  for (const obs of obstacles) {
    const obsLayers = obs.layers ?? layers;
    const minX = obs.x - inflationMm;
    const minY = obs.y - inflationMm;
    const maxX = obs.x + obs.width + inflationMm;
    const maxY = obs.y + obs.height + inflationMm;
    const c0 = Math.max(0, worldToCell(minX, bounds.minX, res));
    const c1 = Math.min(cols - 1, worldToCell(maxX, bounds.minX, res));
    const r0 = Math.max(0, worldToCell(minY, bounds.minY, res));
    const r1 = Math.min(rows - 1, worldToCell(maxY, bounds.minY, res));
    for (const layer of obsLayers) {
      const li = layerIndex(layers, layer);
      const mask = masks[li];
      if (!mask) continue;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          mask[r * cols + c] = true;
        }
      }
    }
  }
  return masks;
}

/** Minimal binary heap (min-priority queue) keyed by f-score. */
class MinHeap<T> {
  private data: { key: number; value: T }[] = [];
  size(): number {
    return this.data.length;
  }
  push(key: number, value: T): void {
    this.data.push({ key, value });
    this.bubbleUp(this.data.length - 1);
  }
  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top?.value;
  }
  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i]!.key < this.data[parent]!.key) {
        [this.data[i], this.data[parent]] = [this.data[parent]!, this.data[i]!];
        i = parent;
      } else break;
    }
  }
  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.data[l]!.key < this.data[smallest]!.key) smallest = l;
      if (r < n && this.data[r]!.key < this.data[smallest]!.key) smallest = r;
      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [this.data[smallest]!, this.data[i]!];
        i = smallest;
      } else break;
    }
  }
}

/**
 * Run A* autorouter. Returns an ordered list of waypoints (mm, with layer) on
 * success, or a structured failure reason.
 */
export function autoroute(opts: AutorouteOptions): AutorouteResult {
  const res = opts.resolutionMm ?? 0.5;
  const traceW = opts.traceWidthMm ?? 0.25;
  const clearance = opts.clearanceMm ?? 0.2;
  const layers = opts.layers ?? ['top', 'bottom'];
  const viaCost = opts.viaCost ?? 10;
  const maxVisited = opts.maxVisited ?? 200_000;

  if (opts.bounds.maxX <= opts.bounds.minX || opts.bounds.maxY <= opts.bounds.minY) {
    return { success: false, reason: 'invalid-bounds', visited: 0 };
  }

  const cols = Math.max(1, Math.ceil((opts.bounds.maxX - opts.bounds.minX) / res) + 1);
  const rows = Math.max(1, Math.ceil((opts.bounds.maxY - opts.bounds.minY) / res) + 1);
  const inflation = traceW / 2 + clearance;

  const masks = buildBlockedMasks(opts.obstacles, layers, opts.bounds, res, inflation, cols, rows);

  const startCx = worldToCell(opts.start.x, opts.bounds.minX, res);
  const startCy = worldToCell(opts.start.y, opts.bounds.minY, res);
  const endCx = worldToCell(opts.end.x, opts.bounds.minX, res);
  const endCy = worldToCell(opts.end.y, opts.bounds.minY, res);
  const startLi = layerIndex(layers, opts.start.layer);
  const endLi = layerIndex(layers, opts.end.layer);

  const inBounds = (cx: number, cy: number): boolean =>
    cx >= 0 && cx < cols && cy >= 0 && cy < rows;

  const isBlocked = (cx: number, cy: number, li: number): boolean => {
    if (!inBounds(cx, cy)) return true;
    const mask = masks[li];
    if (!mask) return true;
    return mask[cy * cols + cx] === true;
  };

  if (isBlocked(startCx, startCy, startLi)) {
    return { success: false, reason: 'start-blocked', visited: 0 };
  }
  if (isBlocked(endCx, endCy, endLi)) {
    return { success: false, reason: 'end-blocked', visited: 0 };
  }

  // Encode a cell+layer as a single integer key: li * (rows*cols) + cy*cols + cx
  const layerStride = rows * cols;
  const encode = (cx: number, cy: number, li: number): number =>
    li * layerStride + cy * cols + cx;

  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const open = new MinHeap<InternalCell>();

  const heuristic = (cx: number, cy: number, li: number): number => {
    const manhattan = Math.abs(endCx - cx) + Math.abs(endCy - cy);
    const layerDiff = li === endLi ? 0 : viaCost;
    return manhattan + layerDiff;
  };

  const startKey = encode(startCx, startCy, startLi);
  gScore.set(startKey, 0);
  open.push(heuristic(startCx, startCy, startLi), { cx: startCx, cy: startCy, layerIdx: startLi });

  let visited = 0;
  const NEIGHBORS: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (open.size() > 0) {
    const current = open.pop()!;
    const curKey = encode(current.cx, current.cy, current.layerIdx);
    visited++;
    if (visited > maxVisited) {
      return { success: false, reason: 'visited-cap', visited };
    }
    if (current.cx === endCx && current.cy === endCy && current.layerIdx === endLi) {
      // Reconstruct path.
      const cellPath: InternalCell[] = [];
      let k = curKey;
      let cx = current.cx;
      let cy = current.cy;
      let li = current.layerIdx;
      cellPath.push({ cx, cy, layerIdx: li });
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k)!;
        cx = prev % cols;
        cy = Math.floor((prev % layerStride) / cols);
        li = Math.floor(prev / layerStride);
        cellPath.push({ cx, cy, layerIdx: li });
        k = prev;
      }
      cellPath.reverse();

      // Compress co-linear same-layer cells and count vias.
      const waypoints: Waypoint[] = [];
      let viaCount = 0;
      for (let i = 0; i < cellPath.length; i++) {
        const cell = cellPath[i]!;
        const prev = i > 0 ? cellPath[i - 1]! : undefined;
        const next = i < cellPath.length - 1 ? cellPath[i + 1]! : undefined;
        const isEndpoint = i === 0 || i === cellPath.length - 1;
        const isLayerChange =
          (prev && prev.layerIdx !== cell.layerIdx) || (next && next.layerIdx !== cell.layerIdx);
        let keep = isEndpoint || isLayerChange === true;
        if (!keep && prev && next) {
          const dxPrev = cell.cx - prev.cx;
          const dyPrev = cell.cy - prev.cy;
          const dxNext = next.cx - cell.cx;
          const dyNext = next.cy - cell.cy;
          if (dxPrev !== dxNext || dyPrev !== dyNext) keep = true;
        }
        if (keep) {
          waypoints.push({
            x: cellToWorld(cell.cx, opts.bounds.minX, res),
            y: cellToWorld(cell.cy, opts.bounds.minY, res),
            layer: layers[cell.layerIdx]!,
          });
          if (prev && prev.layerIdx !== cell.layerIdx) viaCount++;
        }
      }
      return { success: true, path: waypoints, visited, viaCount };
    }

    const curG = gScore.get(curKey) ?? Infinity;

    // Planar neighbors.
    for (const [dx, dy] of NEIGHBORS) {
      const nx = current.cx + dx;
      const ny = current.cy + dy;
      if (isBlocked(nx, ny, current.layerIdx)) continue;
      const nKey = encode(nx, ny, current.layerIdx);
      const tentative = curG + 1;
      if (tentative < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentative);
        cameFrom.set(nKey, curKey);
        open.push(tentative + heuristic(nx, ny, current.layerIdx), {
          cx: nx,
          cy: ny,
          layerIdx: current.layerIdx,
        });
      }
    }

    // Via to other layer(s).
    for (let li = 0; li < layers.length; li++) {
      if (li === current.layerIdx) continue;
      if (isBlocked(current.cx, current.cy, li)) continue;
      const nKey = encode(current.cx, current.cy, li);
      const tentative = curG + viaCost;
      if (tentative < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentative);
        cameFrom.set(nKey, curKey);
        open.push(tentative + heuristic(current.cx, current.cy, li), {
          cx: current.cx,
          cy: current.cy,
          layerIdx: li,
        });
      }
    }
  }

  return { success: false, reason: 'no-path', visited };
}

// ---------------------------------------------------------------------------
// Circuit-state adapter — translate ProtoPulse circuit types into obstacles.
// ---------------------------------------------------------------------------

/** Minimal ComponentInstance shape we care about for obstacle extraction. */
export interface InstanceLike {
  id: number;
  pcbPosition?: { x: number; y: number; rotation: number; side: 'front' | 'back' } | undefined;
  /** Approximate footprint size in mm. If unknown, caller passes a default. */
  footprintWidthMm?: number;
  footprintHeightMm?: number;
}

export interface NetLike {
  id: number;
  segments: { waypoints: { x: number; y: number }[] }[];
}

export interface ExtractObstaclesOptions {
  instances: InstanceLike[];
  otherNets: NetLike[];
  /** Default footprint size when an instance doesn't carry dimensions. */
  defaultFootprintMm?: { width: number; height: number };
  /** Inflation on trace waypoints (treat each waypoint as a small rect). */
  traceCellMm?: number;
}

/**
 * Extract rectangular obstacles from a set of placed instances and the
 * waypoints of other nets. This is intentionally conservative: instances on
 * `front` map to layer `top`, `back` maps to `bottom`. Trace waypoints block
 * only the layer they belong to if known, else both (safe default).
 */
export function extractObstaclesFromCircuit(
  opts: ExtractObstaclesOptions,
): RectObstacle[] {
  const def = opts.defaultFootprintMm ?? { width: 5, height: 5 };
  const traceCell = opts.traceCellMm ?? 0.5;
  const obstacles: RectObstacle[] = [];

  for (const inst of opts.instances) {
    if (!inst.pcbPosition) continue;
    const w = inst.footprintWidthMm ?? def.width;
    const h = inst.footprintHeightMm ?? def.height;
    obstacles.push({
      x: inst.pcbPosition.x - w / 2,
      y: inst.pcbPosition.y - h / 2,
      width: w,
      height: h,
      layers: [inst.pcbPosition.side === 'back' ? 'bottom' : 'top'],
    });
  }

  for (const net of opts.otherNets) {
    for (const seg of net.segments) {
      for (const wp of seg.waypoints) {
        obstacles.push({
          x: wp.x - traceCell / 2,
          y: wp.y - traceCell / 2,
          width: traceCell,
          height: traceCell,
        });
      }
    }
  }

  return obstacles;
}
