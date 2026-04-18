/**
 * Breadboard3DEngine — 3D spatial breadboard model with component placement,
 * wire routing (A* pathfinding to avoid clipping), internal row connections,
 * power rails, auto-route from netlist, and standard wire colors.
 *
 * Standard 830-point layout: 2 groups of 5×63 terminal strips + 4 power rails.
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM/Three.js dependencies (geometry only).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type ColumnLetter = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j';
export type RailId = 'top_pos' | 'top_neg' | 'bottom_pos' | 'bottom_neg';

export interface TerminalPoint {
  type: 'terminal';
  col: ColumnLetter;
  row: number; // 1..63
}

export interface RailPoint {
  type: 'rail';
  rail: RailId;
  index: number; // 0..62
}

export type BreadboardPoint = TerminalPoint | RailPoint;

export interface PlacedComponent {
  id: string;
  name: string;
  startPoint: TerminalPoint;
  endPoint: TerminalPoint;
  pins: BreadboardPoint[];
  height: number; // component height in mm above board surface
  color: string;
  rotation: 0 | 90 | 180 | 270;
}

export interface Wire3D {
  id: string;
  netId: string;
  from: BreadboardPoint;
  to: BreadboardPoint;
  path: Point3D[];
  color: string;
  gauge: number; // AWG
}

export interface NetConnection {
  netId: string;
  points: BreadboardPoint[];
}

export type WireColor =
  | 'red'
  | 'black'
  | 'green'
  | 'blue'
  | 'yellow'
  | 'orange'
  | 'white'
  | 'purple'
  | 'brown'
  | 'gray';

export interface Breadboard3DSnapshot {
  components: PlacedComponent[];
  wires: Wire3D[];
  occupiedPoints: string[];
  boardDimensions: BoardDimensions;
}

export interface BoardDimensions {
  /** Board width in mm */
  width: number;
  /** Board length in mm */
  length: number;
  /** Board thickness in mm */
  thickness: number;
  /** Pitch between holes in mm (2.54mm = 0.1 inch) */
  pitch: number;
  /** Number of terminal rows */
  rows: number;
  /** Total tie points */
  totalPoints: number;
}

// ---------------------------------------------------------------------------
// A* pathfinder types
// ---------------------------------------------------------------------------

interface AStarNode {
  pos: Point3D;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
  key: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROWS = 63;
const LEFT_COLS: readonly ColumnLetter[] = ['a', 'b', 'c', 'd', 'e'];
const RIGHT_COLS: readonly ColumnLetter[] = ['f', 'g', 'h', 'i', 'j'];
const ALL_COLS: readonly ColumnLetter[] = [...LEFT_COLS, ...RIGHT_COLS];

const PITCH_MM = 2.54; // 0.1 inch standard
const CHANNEL_GAP_MM = 7.62; // 0.3 inch DIP straddle — physical e-to-f center distance
const BOARD_THICKNESS = 8.5;
const WIRE_HEIGHT_MM = 5; // default wire routing height above board
const COMPONENT_BASE_HEIGHT = 3; // minimum component protrusion height

/** Logical column indices 0-9 (a=0 … j=9). Physical X is computed in toPoint3D,
 *  which adds CHANNEL_GAP_MM for right-group columns (ci >= 5). */
const COL_INDEX: Record<ColumnLetter, number> = {
  a: 0, b: 1, c: 2, d: 3, e: 4,
  f: 5, g: 6, h: 7, i: 8, j: 9,
};

const RAIL_X: Record<RailId, number> = {
  top_neg: -2,
  top_pos: -1,
  bottom_pos: 12,
  bottom_neg: 13,
};

/** Standard wire color assignments by net function. */
export const WIRE_COLORS: Record<string, WireColor> = {
  VCC: 'red',
  '5V': 'red',
  '3V3': 'orange',
  '3.3V': 'orange',
  GND: 'black',
  ground: 'black',
  SDA: 'blue',
  SCL: 'yellow',
  TX: 'green',
  RX: 'white',
  MOSI: 'purple',
  MISO: 'brown',
  SCK: 'gray',
  default: 'green',
};

const SIGNAL_COLOR_CYCLE: WireColor[] = [
  'green', 'blue', 'yellow', 'orange', 'white', 'purple', 'brown', 'gray',
];

// BusBoard BB830 datasheet: 6.5 × 2.2 × 0.3 in = 165.1 × 54.6 × 8.5 mm
// Source verified: https://www.busboard.com/BB830
// width = short axis (54.6 mm); length = long axis (165.1 mm, rows run along this)
const BOARD_DIMS: BoardDimensions = {
  width: 54.6,   // BB830 short axis (mm) — 9-col span + rails + margins
  length: 165.1, // BB830 long axis (mm)  — 63 rows × 2.54 mm = 160.02 mm + end margins
  thickness: BOARD_THICKNESS, // 8.5 mm (unchanged — already correct)
  pitch: PITCH_MM,
  rows: ROWS,
  totalPoints: 2 * 5 * ROWS + 4 * ROWS, // 630 + 252 = 882
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pointKey(p: BreadboardPoint): string {
  if (p.type === 'terminal') {
    return `t:${p.col}:${p.row}`;
  }
  return `r:${p.rail}:${p.index}`;
}

function point3DKey(p: Point3D): string {
  return `${Math.round(p.x * 10)},${Math.round(p.y * 10)},${Math.round(p.z * 10)}`;
}

/** Convert a breadboard point to 3D coordinates (mm).
 *  Right-group columns (f-j, ci >= 5) are offset by CHANNEL_GAP_MM so
 *  the e-to-f spacing equals the physical 7.62 mm (0.3") DIP straddle.
 *  Formula: x = ci * PITCH_MM + (ci >= 5 ? CHANNEL_GAP_MM - PITCH_MM : 0)
 *  which simplifies to: left group → ci*PITCH, right group → ci*PITCH + 5.08
 *  giving e(ci=4)=10.16mm, f(ci=5)=17.78mm, spacing = 7.62mm ✓
 */
export function toPoint3D(p: BreadboardPoint, z?: number): Point3D {
  if (p.type === 'terminal') {
    const ci = COL_INDEX[p.col];
    const channelOffset = ci >= 5 ? CHANNEL_GAP_MM - PITCH_MM : 0;
    return {
      x: ci * PITCH_MM + channelOffset,
      y: (p.row - 1) * PITCH_MM,
      z: z ?? 0,
    };
  }
  return {
    x: RAIL_X[p.rail] * PITCH_MM,
    y: p.index * PITCH_MM,
    z: z ?? 0,
  };
}

/** Get the internal connection group for a point (points in same group are connected). */
export function getConnectionGroup(p: BreadboardPoint): string {
  if (p.type === 'rail') {
    return `rail:${p.rail}`;
  }
  const isLeft = LEFT_COLS.includes(p.col);
  return `row:${p.row}:${isLeft ? 'L' : 'R'}`;
}

/** Check if two points are internally connected on the breadboard. */
export function areConnected(a: BreadboardPoint, b: BreadboardPoint): boolean {
  return getConnectionGroup(a) === getConnectionGroup(b);
}

/** Manhattan distance in 3D. */
function manhattan3D(a: Point3D, b: Point3D): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}

/** Euclidean distance in 3D. */
function euclidean3D(a: Point3D, b: Point3D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/** Validate a terminal point. */
function isValidTerminal(p: TerminalPoint): boolean {
  return ALL_COLS.includes(p.col) && p.row >= 1 && p.row <= ROWS;
}

/** Validate a rail point. */
function isValidRail(p: RailPoint): boolean {
  const validRails: RailId[] = ['top_pos', 'top_neg', 'bottom_pos', 'bottom_neg'];
  return validRails.includes(p.rail) && p.index >= 0 && p.index < ROWS;
}

/** Validate any breadboard point. */
export function isValidPoint(p: BreadboardPoint): boolean {
  if (p.type === 'terminal') { return isValidTerminal(p); }
  return isValidRail(p);
}

/** Pick a wire color for a net based on its name/function. */
export function getWireColor(netId: string, index: number): WireColor {
  const upper = netId.toUpperCase();
  for (const [key, color] of Object.entries(WIRE_COLORS)) {
    if (upper === key.toUpperCase()) {
      return color;
    }
  }
  return SIGNAL_COLOR_CYCLE[index % SIGNAL_COLOR_CYCLE.length];
}

// ---------------------------------------------------------------------------
// A* 3D pathfinder
// ---------------------------------------------------------------------------

/**
 * Find a 3D wire path from `from` to `to`, avoiding occupied cells.
 * Routes at WIRE_HEIGHT_MM above the board, then drops down at endpoints.
 */
export function findWirePath(
  from: Point3D,
  to: Point3D,
  obstacles: Set<string>,
  resolution: number = PITCH_MM,
): Point3D[] {
  const startGround = { x: from.x, y: from.y, z: 0 };
  const startAir = { x: from.x, y: from.y, z: WIRE_HEIGHT_MM };
  const endAir = { x: to.x, y: to.y, z: WIRE_HEIGHT_MM };
  const endGround = { x: to.x, y: to.y, z: 0 };

  // If from === to, trivial path
  if (Math.abs(from.x - to.x) < 0.01 && Math.abs(from.y - to.y) < 0.01) {
    return [startGround];
  }

  // A* in 2D grid at wire height, then add vertical segments
  const openMap = new Map<string, AStarNode>();
  const closedSet = new Set<string>();

  const startKey = point3DKey(startAir);
  const startNode: AStarNode = {
    pos: startAir,
    g: 0,
    h: manhattan3D(startAir, endAir),
    f: manhattan3D(startAir, endAir),
    parent: null,
    key: startKey,
  };
  openMap.set(startKey, startNode);

  const endKey = point3DKey(endAir);
  let maxIterations = 5000;

  // 6-direction neighbors (±x, ±y at wire height; no vertical movement during routing)
  const dirs: Point3D[] = [
    { x: resolution, y: 0, z: 0 },
    { x: -resolution, y: 0, z: 0 },
    { x: 0, y: resolution, z: 0 },
    { x: 0, y: -resolution, z: 0 },
    // Diagonal for shorter paths
    { x: resolution, y: resolution, z: 0 },
    { x: -resolution, y: resolution, z: 0 },
    { x: resolution, y: -resolution, z: 0 },
    { x: -resolution, y: -resolution, z: 0 },
  ];

  while (openMap.size > 0 && maxIterations-- > 0) {
    // Find node with lowest f
    let current: AStarNode | null = null;
    let lowestF = Infinity;
    openMap.forEach((node) => {
      if (node.f < lowestF) {
        lowestF = node.f;
        current = node;
      }
    });

    if (!current) { break; }

    const cur = current as AStarNode;

    if (cur.key === endKey) {
      // Reconstruct path
      const airPath: Point3D[] = [];
      let n: AStarNode | null = cur;
      while (n) {
        airPath.unshift(n.pos);
        n = n.parent;
      }
      // Add vertical segments
      return [startGround, ...airPath, endGround];
    }

    openMap.delete(cur.key);
    closedSet.add(cur.key);

    for (const dir of dirs) {
      const neighbor: Point3D = {
        x: cur.pos.x + dir.x,
        y: cur.pos.y + dir.y,
        z: cur.pos.z + dir.z,
      };
      const nKey = point3DKey(neighbor);

      if (closedSet.has(nKey)) { continue; }
      if (obstacles.has(nKey)) { continue; }

      // Diagonal cost is sqrt(2) * resolution
      const moveCost = (dir.x !== 0 && dir.y !== 0) ? resolution * 1.414 : resolution;
      const tentativeG = cur.g + moveCost;
      const h = euclidean3D(neighbor, endAir);

      const existing = openMap.get(nKey);
      if (existing && tentativeG >= existing.g) { continue; }

      openMap.set(nKey, {
        pos: neighbor,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: cur,
        key: nKey,
      });
    }
  }

  // Fallback: direct path (straight line at wire height)
  return [startGround, startAir, endAir, endGround];
}

// ---------------------------------------------------------------------------
// Breadboard3DEngine — singleton
// ---------------------------------------------------------------------------

export class Breadboard3DEngine {
  private static _instance: Breadboard3DEngine | null = null;

  private _components = new Map<string, PlacedComponent>();
  private _wires = new Map<string, Wire3D>();
  private _occupiedPoints = new Set<string>();
  private _obstacleSet = new Set<string>(); // 3D obstacle keys for pathfinding
  private _netColorIndex = 0;

  // Subscribe
  private _listeners = new Set<Listener>();
  private _version = 0;

  private constructor() {}

  static getInstance(): Breadboard3DEngine {
    if (!Breadboard3DEngine._instance) {
      Breadboard3DEngine._instance = new Breadboard3DEngine();
    }
    return Breadboard3DEngine._instance;
  }

  static resetInstance(): void {
    Breadboard3DEngine._instance = null;
  }

  // ---------------------------------------------------------------------------
  // Subscribe pattern
  // ---------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  getSnapshot(): Breadboard3DSnapshot {
    return {
      components: Array.from(this._components.values()),
      wires: Array.from(this._wires.values()),
      occupiedPoints: Array.from(this._occupiedPoints),
      boardDimensions: { ...BOARD_DIMS },
    };
  }

  private _notify(): void {
    this._version++;
    this._listeners.forEach((l) => l());
  }

  // ---------------------------------------------------------------------------
  // Component placement
  // ---------------------------------------------------------------------------

  placeComponent(component: Omit<PlacedComponent, 'pins'> & { pins?: BreadboardPoint[] }): PlacedComponent {
    const { startPoint, endPoint } = component;

    if (!isValidTerminal(startPoint)) {
      throw new Error(`Invalid start point: ${pointKey(startPoint)}`);
    }
    if (!isValidTerminal(endPoint)) {
      throw new Error(`Invalid end point: ${pointKey(endPoint)}`);
    }

    // Generate pin list if not provided
    const pins = component.pins ?? this._generatePins(startPoint, endPoint);

    // Check for conflicts
    for (const pin of pins) {
      const key = pointKey(pin);
      if (this._occupiedPoints.has(key)) {
        throw new Error(`Point ${key} is already occupied`);
      }
    }

    const placed: PlacedComponent = {
      ...component,
      pins,
      height: component.height || COMPONENT_BASE_HEIGHT,
    };

    // Mark points as occupied
    for (const pin of pins) {
      this._occupiedPoints.add(pointKey(pin));
      const p3d = toPoint3D(pin, placed.height);
      this._obstacleSet.add(point3DKey(p3d));
    }

    this._components.set(placed.id, placed);
    this._notify();
    return placed;
  }

  removeComponent(id: string): boolean {
    const comp = this._components.get(id);
    if (!comp) { return false; }

    // Free occupied points
    for (const pin of comp.pins) {
      this._occupiedPoints.delete(pointKey(pin));
      const p3d = toPoint3D(pin, comp.height);
      this._obstacleSet.delete(point3DKey(p3d));
    }

    this._components.delete(id);
    this._notify();
    return true;
  }

  getComponent(id: string): PlacedComponent | undefined {
    return this._components.get(id);
  }

  getAllComponents(): PlacedComponent[] {
    return Array.from(this._components.values());
  }

  /** Generate pin points for a component spanning from start to end. */
  private _generatePins(start: TerminalPoint, end: TerminalPoint): BreadboardPoint[] {
    const pins: BreadboardPoint[] = [];
    const startRow = Math.min(start.row, end.row);
    const endRow = Math.max(start.row, end.row);

    // A DIP component spans across the channel: pins on left (a-e) and right (f-j)
    const leftCol = start.col;
    const rightCol = end.col;

    for (let row = startRow; row <= endRow; row++) {
      pins.push({ type: 'terminal', col: leftCol, row });
      if (leftCol !== rightCol) {
        pins.push({ type: 'terminal', col: rightCol, row });
      }
    }

    return pins;
  }

  // ---------------------------------------------------------------------------
  // Wire routing
  // ---------------------------------------------------------------------------

  addWire(
    id: string,
    netId: string,
    from: BreadboardPoint,
    to: BreadboardPoint,
    color?: WireColor,
  ): Wire3D {
    if (!isValidPoint(from)) {
      throw new Error(`Invalid from point: ${pointKey(from)}`);
    }
    if (!isValidPoint(to)) {
      throw new Error(`Invalid to point: ${pointKey(to)}`);
    }

    const from3D = toPoint3D(from);
    const to3D = toPoint3D(to);
    const path = findWirePath(from3D, to3D, this._obstacleSet);
    const wireColor = color ?? getWireColor(netId, this._netColorIndex++);

    const wire: Wire3D = {
      id,
      netId,
      from,
      to,
      path,
      color: wireColor,
      gauge: 22,
    };

    this._wires.set(id, wire);
    this._notify();
    return wire;
  }

  removeWire(id: string): boolean {
    const existed = this._wires.delete(id);
    if (existed) {
      this._notify();
    }
    return existed;
  }

  getWire(id: string): Wire3D | undefined {
    return this._wires.get(id);
  }

  getAllWires(): Wire3D[] {
    return Array.from(this._wires.values());
  }

  /** Get all wires belonging to a specific net. */
  getWiresByNet(netId: string): Wire3D[] {
    return Array.from(this._wires.values()).filter((w) => w.netId === netId);
  }

  // ---------------------------------------------------------------------------
  // Auto-route from netlist
  // ---------------------------------------------------------------------------

  /**
   * Auto-route a list of net connections. Creates wires between all points
   * in each net using minimum spanning tree (MST) ordering.
   * Returns the created wires.
   */
  autoRoute(nets: NetConnection[]): Wire3D[] {
    const createdWires: Wire3D[] = [];
    let wireCounter = 0;

    for (const net of nets) {
      if (net.points.length < 2) { continue; }

      // Build MST using Prim's algorithm on the net points
      const mstEdges = this._buildMST(net.points);

      for (const [fromIdx, toIdx] of mstEdges) {
        const wireId = `auto_${net.netId}_${wireCounter++}`;
        const wire = this.addWire(wireId, net.netId, net.points[fromIdx], net.points[toIdx]);
        createdWires.push(wire);
      }
    }

    return createdWires;
  }

  /** Build MST edges using Prim's algorithm. Returns pairs of indices. */
  private _buildMST(points: BreadboardPoint[]): [number, number][] {
    if (points.length < 2) { return []; }

    const edges: [number, number][] = [];
    const inMST = new Set<number>([0]);
    const remaining = new Set<number>();
    for (let i = 1; i < points.length; i++) {
      remaining.add(i);
    }

    while (remaining.size > 0) {
      let bestFrom = -1;
      let bestTo = -1;
      let bestDist = Infinity;

      inMST.forEach((fromIdx) => {
        remaining.forEach((toIdx) => {
          const d = manhattan3D(toPoint3D(points[fromIdx]), toPoint3D(points[toIdx]));
          if (d < bestDist) {
            bestDist = d;
            bestFrom = fromIdx;
            bestTo = toIdx;
          }
        });
      });

      if (bestTo === -1) { break; }

      edges.push([bestFrom, bestTo]);
      inMST.add(bestTo);
      remaining.delete(bestTo);
    }

    return edges;
  }

  // ---------------------------------------------------------------------------
  // Connectivity queries
  // ---------------------------------------------------------------------------

  /** Get all points electrically connected to a given point (via breadboard internal connections). */
  getConnectedPoints(p: BreadboardPoint): BreadboardPoint[] {
    const group = getConnectionGroup(p);
    const result: BreadboardPoint[] = [];

    if (p.type === 'rail') {
      // Entire rail is connected
      for (let i = 0; i < ROWS; i++) {
        result.push({ type: 'rail', rail: p.rail, index: i });
      }
    } else {
      // Same row, same side (left or right)
      const isLeft = LEFT_COLS.includes(p.col);
      const cols = isLeft ? LEFT_COLS : RIGHT_COLS;
      for (const col of cols) {
        result.push({ type: 'terminal', col, row: p.row });
      }
    }

    return result;
  }

  /** Check if a point is occupied by a component. */
  isOccupied(p: BreadboardPoint): boolean {
    return this._occupiedPoints.has(pointKey(p));
  }

  /** Get all occupied point keys. */
  getOccupiedPoints(): string[] {
    return Array.from(this._occupiedPoints);
  }

  // ---------------------------------------------------------------------------
  // Board info
  // ---------------------------------------------------------------------------

  getBoardDimensions(): BoardDimensions {
    return { ...BOARD_DIMS };
  }

  /** Get the 3D position of any breadboard point. */
  getPosition(p: BreadboardPoint): Point3D {
    return toPoint3D(p);
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  clear(): void {
    this._components.clear();
    this._wires.clear();
    this._occupiedPoints.clear();
    this._obstacleSet.clear();
    this._netColorIndex = 0;
    this._notify();
  }
}
