/**
 * The canonical design graph — Vol II §A.
 *
 * All geometry is integer nanometers. Floats accumulate drift across
 * thousands of operations and break diff determinism; integers never do.
 */

export type Nm = number; // integer nanometers, validated at every zod boundary
export interface Vec {
  x: Nm;
  y: Nm;
}
export type Rot = 0 | 90 | 180 | 270; // schematic/breadboard
export type RotMilli = number; // PCB: millidegrees (0..359999)

/** 1mm in nm — the only conversion constant. */
export const MM = 1_000_000;
/** Schematic hard grid: 1.27mm (50 mil). */
export const SCHEMATIC_GRID = 1_270_000;

export type Uuid = string;
export type ActorId = string;

/**
 * Ports are not free entities: a port ref is `componentId:pinKey`.
 * Ports exist iff their component exists — dangling-reference bugs
 * deleted by construction.
 */
export type PortRef = string;

export function makePortRef(componentId: Uuid, pinKey: string): PortRef {
  return `${componentId}:${pinKey}`;
}

export function parsePortRef(ref: PortRef): { componentId: Uuid; pinKey: string } {
  const idx = ref.indexOf(':');
  if (idx === -1) throw new Error(`Malformed PortRef: ${ref}`);
  return { componentId: ref.slice(0, idx), pinKey: ref.slice(idx + 1) };
}

// ── Entities ──────────────────────────────────────────────────────────

export interface Component {
  id: Uuid;
  /** "U3", "R12" — unique per design. */
  ref: string;
  /** Library part reference, resolved against the parts registry. */
  partId: Uuid;
  /** Pinned part revision — library updates never mutate designs silently. */
  partRev: number;
  /** "10k", "100nF" — SI-suffix parsed via value-parser. */
  value?: string;
  dnp: boolean;
  fields: Record<string, string>;
  /** Sheet this component lives on; undefined = the root sheet. */
  sheetId?: Uuid;
}

export interface Net {
  id: Uuid;
  /** Auto "N$417" or user/AI-named "VBAT". */
  name: string;
  /** THE connectivity. Order-irrelevant set, stored sorted for determinism. */
  ports: PortRef[];
  busId?: Uuid;
  netClass: string;
}

export type BusKind = 'SPI' | 'I2C' | 'UART' | 'USB' | 'CAN' | 'PWR' | 'GPIO' | 'custom';

export interface Bus {
  id: Uuid;
  name: string;
  kind: BusKind;
  /** Sorted for determinism; maintained by assign_to_bus / GC / merges. */
  memberNets: Uuid[];
}

/** A hierarchical port on a sheet's boundary: a named, directed
 *  binding to one of the design's nets. */
export interface SheetPort {
  name: string;
  direction: 'in' | 'out' | 'inout';
  netId: Uuid;
}

export interface Sheet {
  id: Uuid;
  name: string;
  /** null = a top-level sheet. */
  parentId: Uuid | null;
  interface: SheetPort[];
}

export type NetSelector = { kind: 'net'; netId: Uuid } | { kind: 'class'; netClass: string };

export type ConstraintBody =
  | { kind: 'current_max'; netId: Uuid; amps: number }
  | { kind: 'voltage_domain'; name: string; volts: number; netIds: Uuid[] }
  | { kind: 'diff_pair'; p: Uuid; n: Uuid; targetOhms: number; maxSkewNm: Nm }
  | { kind: 'length_match'; netIds: Uuid[]; toleranceNm: Nm }
  | { kind: 'keepout'; layerId: string; polygon: Vec[]; reason: string }
  | { kind: 'thermal_limit'; componentId: Uuid; maxC: number }
  | { kind: 'clearance_override'; a: NetSelector; b: NetSelector; nm: Nm };

/** Constraints carry their rationale — intent is documented at the source. */
export interface Constraint {
  id: Uuid;
  body: ConstraintBody;
  author?: ActorId;
  rationale?: string;
}

// ── View data ─────────────────────────────────────────────────────────
// Positions/geometry live in parallel maps keyed by entity ID. A view
// record without its entity is garbage; an entity without a view record
// renders in the "unplaced" tray. No view record can create a net.

export interface SymbolPlacement {
  at: Vec;
  rot: Rot;
  mirror: boolean;
  /** Multi-unit parts: U3A/U3B. */
  unit?: number;
}

/** Manhattan wire segment; pure geometry — the net pre-exists. */
export interface WireSegment {
  a: Vec;
  b: Vec;
}

export interface FootprintPlacement {
  at: Vec;
  rotMilli: RotMilli;
  side: 'top' | 'bottom';
  locked: boolean;
}

export interface Trace {
  /** Pre-allocated by the routing op — traces have identity so removal
   *  and inversion address them directly. */
  id: Uuid;
  netId: Uuid;
  layerId: string;
  widthNm: Nm;
  path: Vec[];
}

export interface Via {
  id: Uuid;
  netId: Uuid;
  at: Vec;
  drillNm: Nm;
  padNm: Nm;
  span: [string, string];
}

/** A copper zone: an outline polygon on one layer, poured for one net.
 *  The POUR (outline minus foreign copper at clearance) is a derived
 *  artifact computed by consumers — the graph stores intent only. */
export interface Zone {
  id: Uuid;
  netId: Uuid;
  layerId: string;
  /** Outline polygon, integer nm, ≥3 vertices, implicitly closed. */
  outline: Vec[];
  /** Pour clearance override; consumers default to the deck's. */
  clearanceNm?: Nm;
  /** How same-net pads join the pour; absent means 'solid'. Thermal =
   *  annular gap bridged by 4 orthogonal spokes (vias stay solid). */
  connect?: 'solid' | 'thermal';
}

export interface Annotation {
  anchor: Uuid  ;
  text: string;
}

// ── The materialized graph ────────────────────────────────────────────

export interface SchematicView {
  placements: Map<Uuid, SymbolPlacement>;
  /** Wire geometry keyed by netId. */
  wires: Map<Uuid, WireSegment[]>;
}

export interface PcbView {
  placements: Map<Uuid, FootprintPlacement>;
  traces: Map<Uuid, Trace>;
  vias: Map<Uuid, Via>;
  zones: Map<Uuid, Zone>;
  /** Board outline (Edge.Cuts), integer nm, ≥3 vertices, implicitly
   *  closed. Absent until set — a design without an outline is a
   *  schematic-stage truth, not an error. */
  outline?: Vec[];
}

export interface DesignGraph {
  components: Map<Uuid, Component>;
  nets: Map<Uuid, Net>;
  buses: Map<Uuid, Bus>;
  sheets: Map<Uuid, Sheet>;
  constraints: Map<Uuid, Constraint>;
  schematic: SchematicView;
  pcb: PcbView;
  annotations: Annotation[];
  meta: Record<string, string>;
  /** Deterministic counters (auto net names, ref suffixes). Replay-stable
   *  because materialization order is total. */
  counters: { net: number };
}

export function emptyGraph(): DesignGraph {
  return {
    components: new Map(),
    nets: new Map(),
    buses: new Map(),
    sheets: new Map(),
    constraints: new Map(),
    schematic: { placements: new Map(), wires: new Map() },
    pcb: { placements: new Map(), traces: new Map(), vias: new Map(), zones: new Map() },
    annotations: [],
    meta: {},
    counters: { net: 0 },
  };
}

export function cloneGraph(g: DesignGraph): DesignGraph {
  return structuredClone(g);
}

/** Insert a port into a net's sorted port list (idempotent). */
export function insertPortSorted(ports: PortRef[], port: PortRef): void {
  if (ports.includes(port)) return;
  let lo = 0;
  let hi = ports.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const probe = ports[mid];
    if (probe !== undefined && probe < port) lo = mid + 1;
    else hi = mid;
  }
  ports.splice(lo, 0, port);
}

/** Find the net containing a port, if any. */
export function netOfPort(graph: DesignGraph, port: PortRef): Net | undefined {
  for (const net of graph.nets.values()) {
    if (net.ports.includes(port)) return net;
  }
  return undefined;
}
