/**
 * FlexZoneManager — Rigid-Flex PCB zone definitions, flex-specific DRC,
 * material properties, and design constraints per IPC-2223.
 *
 * All dimensions are in millimeters. Pure class, no React dependencies.
 * Singleton + subscribe pattern for UI integration.
 * Persists to localStorage.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlexMaterial = 'polyimide_hn' | 'polyimide_fn' | 'coverlay' | 'adhesive';
export type BendType = 'static' | 'dynamic';
export type FlexViolationType =
  | 'bend-radius'
  | 'via-in-flex'
  | 'solid-copper'
  | 'component-height'
  | 'trace-direction'
  | 'transition-stress';

export interface FlexZone {
  id: string;
  name: string;
  type: 'flex' | 'rigid-flex-transition';
  polygon: Array<{ x: number; y: number }>; // mm, closed polygon (CCW winding)
  minBendRadius: number; // mm
  bendType: BendType; // static=6x, dynamic=12x thickness multiplier
  maxCopperLayers: number; // typically 1-2 for flex
  material: FlexMaterial;
  restrictions: FlexRestrictions;
}

export interface FlexRestrictions {
  noSolidCopper: boolean; // default true — use hatched copper only
  noPTHVias: boolean; // default true — no plated through-hole vias in flex
  noHeavyComponents: boolean; // default true
  maxComponentHeight: number; // mm (default 2.0)
  preferredTraceDirection: 'perpendicular-to-bend' | 'any';
  minTraceSpacing: number; // mm (wider spacing for flex, default 0.2)
}

export interface FlexMaterialProperties {
  name: string;
  displayName: string;
  er: number; // dielectric constant
  tanD: number; // loss tangent
  thicknessRange: { min: number; max: number }; // mm
  maxElongation: number; // percent
  youngsModulus: number; // GPa
  bendCycles: number; // rated dynamic bend cycles
  tg: number; // glass transition temperature (Celsius)
}

export interface FlexDrcViolation {
  type: FlexViolationType;
  severity: 'error' | 'warning';
  message: string;
  location: { x: number; y: number };
  zoneId: string;
  ruleRef: string; // e.g. "IPC-2223-3.2.1"
}

// For DRC checking inputs
export interface TraceSegment {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  width: number;
  layer: string;
  netId: string;
}

export interface ViaPosition {
  x: number;
  y: number;
  type: 'through' | 'blind' | 'buried';
}

export interface ComponentPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  componentHeight: number; // mm (Z-axis height)
  refDes: string;
}

export interface PourPolygon {
  polygon: Array<{ x: number; y: number }>;
  isSolid: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-flex-zones';

/** Bend radius multiplier for static bends (IPC-2223). */
const STATIC_BEND_MULTIPLIER = 6;

/** Bend radius multiplier for dynamic bends (IPC-2223). */
const DYNAMIC_BEND_MULTIPLIER = 12;

/**
 * Maximum angle (in radians) between a trace and the bend axis before
 * flagging a trace-direction warning. 30 degrees — traces within 30 deg
 * of the bend axis are considered "parallel."
 */
const TRACE_DIRECTION_THRESHOLD_RAD = Math.PI / 6; // 30 degrees

/**
 * Maximum angle (in radians) between a trace crossing a transition edge
 * and that edge before flagging a transition-stress warning.
 * Traces within 15 degrees of parallel to the edge are risky.
 */
const TRANSITION_ANGLE_THRESHOLD_RAD = Math.PI / 12; // 15 degrees

/** Floating-point epsilon for boundary comparisons. */
const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// Material Database
// ---------------------------------------------------------------------------

export const FLEX_MATERIAL_DATABASE: Record<FlexMaterial, FlexMaterialProperties> = {
  polyimide_hn: {
    name: 'polyimide_hn',
    displayName: 'Kapton HN',
    er: 3.4,
    tanD: 0.003,
    thicknessRange: { min: 0.025, max: 0.125 },
    maxElongation: 70,
    youngsModulus: 2.5,
    bendCycles: 100000,
    tg: 385,
  },
  polyimide_fn: {
    name: 'polyimide_fn',
    displayName: 'Kapton FN',
    er: 3.4,
    tanD: 0.003,
    thicknessRange: { min: 0.025, max: 0.125 },
    maxElongation: 70,
    youngsModulus: 2.5,
    bendCycles: 100000,
    tg: 385,
  },
  coverlay: {
    name: 'coverlay',
    displayName: 'Coverlay',
    er: 3.4,
    tanD: 0.003,
    thicknessRange: { min: 0.0125, max: 0.075 },
    maxElongation: 60,
    youngsModulus: 2.5,
    bendCycles: 50000,
    tg: 385,
  },
  adhesive: {
    name: 'adhesive',
    displayName: 'Adhesive',
    er: 4.0,
    tanD: 0.02,
    thicknessRange: { min: 0.025, max: 0.050 },
    maxElongation: 40,
    youngsModulus: 0.5,
    bendCycles: 30000,
    tg: 150,
  },
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Ray-casting point-in-polygon test.
 * Handles convex and concave polygons. Polygon is treated as closed.
 */
function pointInPolygon(px: number, py: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Signed area of a polygon using the shoelace formula.
 * Positive for CCW winding, negative for CW.
 */
function signedPolygonArea(polygon: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return area / 2;
}

/**
 * Compute the centroid of a polygon.
 */
function polygonCentroid(polygon: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (polygon.length === 0) {
    return { x: 0, y: 0 };
  }
  let cx = 0;
  let cy = 0;
  for (const p of polygon) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / polygon.length, y: cy / polygon.length };
}

/**
 * Check if two 2D line segments intersect.
 * Returns the intersection point if they do, null otherwise.
 */
function segmentIntersection(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): { x: number; y: number } | null {
  const dax = ax2 - ax1;
  const day = ay2 - ay1;
  const dbx = bx2 - bx1;
  const dby = by2 - by1;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < EPSILON) {
    return null; // parallel or collinear
  }
  const t = ((bx1 - ax1) * dby - (by1 - ay1) * dbx) / denom;
  const u = ((bx1 - ax1) * day - (by1 - ay1) * dax) / denom;
  if (t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON) {
    return { x: ax1 + t * dax, y: ay1 + t * day };
  }
  return null;
}

/**
 * Check if any vertex of polygon B is inside polygon A (simple overlap test).
 */
function polygonsOverlap(
  polygonA: Array<{ x: number; y: number }>,
  polygonB: Array<{ x: number; y: number }>,
): boolean {
  // Check if any vertex of B is inside A
  for (const p of polygonB) {
    if (pointInPolygon(p.x, p.y, polygonA)) {
      return true;
    }
  }
  // Check if any vertex of A is inside B
  for (const p of polygonA) {
    if (pointInPolygon(p.x, p.y, polygonB)) {
      return true;
    }
  }
  // Check if any edges intersect
  for (let i = 0; i < polygonA.length; i++) {
    const j = (i + 1) % polygonA.length;
    for (let k = 0; k < polygonB.length; k++) {
      const l = (k + 1) % polygonB.length;
      if (segmentIntersection(
        polygonA[i].x, polygonA[i].y, polygonA[j].x, polygonA[j].y,
        polygonB[k].x, polygonB[k].y, polygonB[l].x, polygonB[l].y,
      )) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if a rectangle (defined by x,y,width,height) overlaps a polygon.
 */
function rectOverlapsPolygon(
  rx: number, ry: number, rw: number, rh: number,
  polygon: Array<{ x: number; y: number }>,
): boolean {
  const rectPoly = [
    { x: rx, y: ry },
    { x: rx + rw, y: ry },
    { x: rx + rw, y: ry + rh },
    { x: rx, y: ry + rh },
  ];
  return polygonsOverlap(polygon, rectPoly);
}

/**
 * Check if a trace segment has any portion inside a polygon.
 * Tests both endpoints and edge intersections.
 */
function traceInZone(
  trace: TraceSegment,
  polygon: Array<{ x: number; y: number }>,
): boolean {
  // Check endpoints
  if (pointInPolygon(trace.p1.x, trace.p1.y, polygon)) {
    return true;
  }
  if (pointInPolygon(trace.p2.x, trace.p2.y, polygon)) {
    return true;
  }
  // Check if trace segment crosses any polygon edge
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    if (segmentIntersection(
      trace.p1.x, trace.p1.y, trace.p2.x, trace.p2.y,
      polygon[i].x, polygon[i].y, polygon[j].x, polygon[j].y,
    )) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate angle between two 2D vectors in radians [0, PI].
 */
function angleBetweenVectors(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dot = ax * bx + ay * by;
  const magA = Math.sqrt(ax * ax + ay * ay);
  const magB = Math.sqrt(bx * bx + by * by);
  if (magA < EPSILON || magB < EPSILON) {
    return 0;
  }
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cosAngle);
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Serialized shape for localStorage / export
// ---------------------------------------------------------------------------

interface SerializedFlexZones {
  zones: FlexZone[];
}

// ---------------------------------------------------------------------------
// FlexZoneManager
// ---------------------------------------------------------------------------

/**
 * Manages rigid-flex PCB zone definitions, flex-specific DRC,
 * material properties, and design constraints per IPC-2223.
 *
 * Singleton per application. Persists to localStorage.
 */
export class FlexZoneManager {
  private static instance: FlexZoneManager | null = null;

  private zones: FlexZone[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): FlexZoneManager {
    if (!FlexZoneManager.instance) {
      FlexZoneManager.instance = new FlexZoneManager();
    }
    return FlexZoneManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    FlexZoneManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Zone CRUD
  // -----------------------------------------------------------------------

  addZone(input: Omit<FlexZone, 'id'>): string {
    const id = crypto.randomUUID();
    const zone: FlexZone = { ...input, id };
    this.zones.push(zone);
    this.save();
    this.notify();
    return id;
  }

  removeZone(id: string): boolean {
    const index = this.zones.findIndex((z) => z.id === id);
    if (index === -1) {
      return false;
    }
    this.zones.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  updateZone(id: string, updates: Partial<Omit<FlexZone, 'id'>>): boolean {
    const zone = this.zones.find((z) => z.id === id);
    if (!zone) {
      return false;
    }

    if (updates.name !== undefined) {
      zone.name = updates.name;
    }
    if (updates.type !== undefined) {
      zone.type = updates.type;
    }
    if (updates.polygon !== undefined) {
      zone.polygon = updates.polygon;
    }
    if (updates.minBendRadius !== undefined) {
      zone.minBendRadius = updates.minBendRadius;
    }
    if (updates.bendType !== undefined) {
      zone.bendType = updates.bendType;
    }
    if (updates.maxCopperLayers !== undefined) {
      zone.maxCopperLayers = updates.maxCopperLayers;
    }
    if (updates.material !== undefined) {
      zone.material = updates.material;
    }
    if (updates.restrictions !== undefined) {
      zone.restrictions = updates.restrictions;
    }

    this.save();
    this.notify();
    return true;
  }

  getZone(id: string): FlexZone | null {
    const zone = this.zones.find((z) => z.id === id);
    if (!zone) {
      return null;
    }
    return { ...zone, polygon: zone.polygon.map((p) => ({ ...p })), restrictions: { ...zone.restrictions } };
  }

  getAllZones(): FlexZone[] {
    return this.zones.map((z) => ({
      ...z,
      polygon: z.polygon.map((p) => ({ ...p })),
      restrictions: { ...z.restrictions },
    }));
  }

  // -----------------------------------------------------------------------
  // Geometry
  // -----------------------------------------------------------------------

  isPointInZone(x: number, y: number, zoneId: string): boolean {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return false;
    }
    return pointInPolygon(x, y, zone.polygon);
  }

  getZoneAtPoint(x: number, y: number): FlexZone | null {
    for (const zone of this.zones) {
      if (pointInPolygon(x, y, zone.polygon)) {
        return { ...zone, polygon: zone.polygon.map((p) => ({ ...p })), restrictions: { ...zone.restrictions } };
      }
    }
    return null;
  }

  getZoneArea(zoneId: string): number {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return 0;
    }
    return Math.abs(signedPolygonArea(zone.polygon));
  }

  isPolygonValid(polygon: Array<{ x: number; y: number }>): boolean {
    if (polygon.length < 3) {
      return false;
    }
    const area = Math.abs(signedPolygonArea(polygon));
    return area > EPSILON;
  }

  // -----------------------------------------------------------------------
  // Bend Radius
  // -----------------------------------------------------------------------

  /**
   * Calculate the minimum allowed bend radius for a zone given the total
   * flex layer thickness. Per IPC-2223:
   *   Static: 6x total flex thickness
   *   Dynamic: 12x total flex thickness
   */
  calculateMinBendRadius(zoneId: string, flexThickness: number): number {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return 0;
    }
    const multiplier = zone.bendType === 'dynamic' ? DYNAMIC_BEND_MULTIPLIER : STATIC_BEND_MULTIPLIER;
    return multiplier * flexThickness;
  }

  /**
   * Validate that a zone's configured bend radius meets the IPC-2223 minimum.
   */
  validateBendRadius(
    zoneId: string,
    flexThickness: number,
  ): { valid: boolean; violations: FlexDrcViolation[] } {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return { valid: true, violations: [] };
    }
    const minRequired = this.calculateMinBendRadius(zoneId, flexThickness);
    if (zone.minBendRadius >= minRequired - EPSILON) {
      return { valid: true, violations: [] };
    }
    const centroid = polygonCentroid(zone.polygon);
    const bendTypeLabel = zone.bendType === 'dynamic' ? 'dynamic (12x)' : 'static (6x)';
    return {
      valid: false,
      violations: [{
        type: 'bend-radius',
        severity: 'error',
        message: `Bend radius ${String(zone.minBendRadius.toFixed(2))}mm is below IPC-2223 minimum ${String(minRequired.toFixed(2))}mm for ${bendTypeLabel} bend with ${String(flexThickness.toFixed(3))}mm thickness`,
        location: centroid,
        zoneId: zone.id,
        ruleRef: 'IPC-2223-3.2.1',
      }],
    };
  }

  // -----------------------------------------------------------------------
  // DRC Rules
  // -----------------------------------------------------------------------

  /**
   * Check for PTH vias inside a flex zone (IPC-2223 prohibits PTH in flex).
   */
  checkViaExclusion(zoneId: string, vias: ViaPosition[]): FlexDrcViolation[] {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return [];
    }
    if (!zone.restrictions.noPTHVias) {
      return [];
    }
    const violations: FlexDrcViolation[] = [];
    for (const via of vias) {
      if (via.type !== 'through') {
        continue;
      }
      if (pointInPolygon(via.x, via.y, zone.polygon)) {
        violations.push({
          type: 'via-in-flex',
          severity: 'error',
          message: `Plated through-hole via at (${String(via.x.toFixed(2))}, ${String(via.y.toFixed(2))}) is inside flex zone "${zone.name}"`,
          location: { x: via.x, y: via.y },
          zoneId: zone.id,
          ruleRef: 'IPC-2223-3.4.2',
        });
      }
    }
    return violations;
  }

  /**
   * Check for solid copper pours overlapping a flex zone.
   * IPC-2223 recommends hatched copper only in flex areas.
   */
  checkCopperRestrictions(zoneId: string, pours: PourPolygon[]): FlexDrcViolation[] {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return [];
    }
    if (!zone.restrictions.noSolidCopper) {
      return [];
    }
    const violations: FlexDrcViolation[] = [];
    for (const pour of pours) {
      if (!pour.isSolid) {
        continue;
      }
      if (polygonsOverlap(zone.polygon, pour.polygon)) {
        const centroid = polygonCentroid(pour.polygon);
        violations.push({
          type: 'solid-copper',
          severity: 'error',
          message: `Solid copper pour overlaps flex zone "${zone.name}" — use hatched copper per IPC-2223`,
          location: centroid,
          zoneId: zone.id,
          ruleRef: 'IPC-2223-3.3.4',
        });
      }
    }
    return violations;
  }

  /**
   * Check components placed inside a flex zone for height restrictions.
   */
  checkComponentPlacement(zoneId: string, components: ComponentPlacement[]): FlexDrcViolation[] {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return [];
    }
    if (!zone.restrictions.noHeavyComponents) {
      return [];
    }
    const violations: FlexDrcViolation[] = [];
    for (const comp of components) {
      // Check if the component's bounding rectangle overlaps the zone polygon
      if (!rectOverlapsPolygon(comp.x, comp.y, comp.width, comp.height, zone.polygon)) {
        continue;
      }
      if (comp.componentHeight > zone.restrictions.maxComponentHeight + EPSILON) {
        violations.push({
          type: 'component-height',
          severity: 'error',
          message: `Component ${comp.refDes} (height ${String(comp.componentHeight.toFixed(1))}mm) exceeds max ${String(zone.restrictions.maxComponentHeight.toFixed(1))}mm in flex zone "${zone.name}"`,
          location: { x: comp.x + comp.width / 2, y: comp.y + comp.height / 2 },
          zoneId: zone.id,
          ruleRef: 'IPC-2223-3.5.1',
        });
      }
    }
    return violations;
  }

  /**
   * Check that traces inside a flex zone run perpendicular to the bend axis.
   * Traces parallel to the bend axis are prone to cracking.
   */
  checkTraceDirection(
    zoneId: string,
    traces: TraceSegment[],
    bendAxis: { x: number; y: number },
  ): FlexDrcViolation[] {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return [];
    }
    if (zone.restrictions.preferredTraceDirection === 'any') {
      return [];
    }
    const violations: FlexDrcViolation[] = [];
    for (const trace of traces) {
      if (!traceInZone(trace, zone.polygon)) {
        continue;
      }
      const traceDir = { x: trace.p2.x - trace.p1.x, y: trace.p2.y - trace.p1.y };
      const angle = angleBetweenVectors(traceDir.x, traceDir.y, bendAxis.x, bendAxis.y);
      // Normalize angle to [0, PI/2] — we care about the acute angle
      const acuteAngle = angle > Math.PI / 2 ? Math.PI - angle : angle;
      if (acuteAngle < TRACE_DIRECTION_THRESHOLD_RAD) {
        const midX = (trace.p1.x + trace.p2.x) / 2;
        const midY = (trace.p1.y + trace.p2.y) / 2;
        violations.push({
          type: 'trace-direction',
          severity: 'warning',
          message: `Trace on ${trace.layer} runs parallel to bend axis (${String(((acuteAngle * 180) / Math.PI).toFixed(1))}° — prefer perpendicular) in flex zone "${zone.name}"`,
          location: { x: midX, y: midY },
          zoneId: zone.id,
          ruleRef: 'IPC-2223-3.3.2',
        });
      }
    }
    return violations;
  }

  /**
   * Check traces crossing a rigid-flex transition boundary for stress issues.
   * Traces should cross the transition perpendicularly to minimize stress.
   */
  checkTransitionStress(zoneId: string, traces: TraceSegment[]): FlexDrcViolation[] {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return [];
    }
    // Only relevant for rigid-flex-transition zones
    if (zone.type !== 'rigid-flex-transition') {
      return [];
    }
    const violations: FlexDrcViolation[] = [];
    const polygon = zone.polygon;

    for (const trace of traces) {
      const traceDir = { x: trace.p2.x - trace.p1.x, y: trace.p2.y - trace.p1.y };
      const traceMag = Math.sqrt(traceDir.x * traceDir.x + traceDir.y * traceDir.y);
      if (traceMag < EPSILON) {
        continue;
      }

      // Check if the trace crosses any edge of the transition zone polygon
      for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        const intersection = segmentIntersection(
          trace.p1.x, trace.p1.y, trace.p2.x, trace.p2.y,
          polygon[i].x, polygon[i].y, polygon[j].x, polygon[j].y,
        );
        if (!intersection) {
          continue;
        }

        // Compute angle between trace direction and edge direction
        const edgeDir = {
          x: polygon[j].x - polygon[i].x,
          y: polygon[j].y - polygon[i].y,
        };
        const angle = angleBetweenVectors(traceDir.x, traceDir.y, edgeDir.x, edgeDir.y);
        // Normalize to [0, PI/2]
        const acuteAngle = angle > Math.PI / 2 ? Math.PI - angle : angle;

        // We want traces to be perpendicular to the edge (acuteAngle near PI/2).
        // If acuteAngle is small, the trace is nearly parallel to the edge — bad.
        if (acuteAngle < TRANSITION_ANGLE_THRESHOLD_RAD) {
          violations.push({
            type: 'transition-stress',
            severity: 'error',
            message: `Trace crosses rigid-flex transition at shallow angle (${String(((acuteAngle * 180) / Math.PI).toFixed(1))}°) in zone "${zone.name}" — risk of stress fracture`,
            location: intersection,
            zoneId: zone.id,
            ruleRef: 'IPC-2223-3.6.1',
          });
          // Only flag once per trace per zone
          break;
        }
      }
    }
    return violations;
  }

  // -----------------------------------------------------------------------
  // Full Flex DRC
  // -----------------------------------------------------------------------

  /**
   * Run all flex DRC checks across the given zones and return all violations.
   */
  runFlexDRC(
    zoneIds: string[],
    vias: ViaPosition[],
    traces: TraceSegment[],
    pours: PourPolygon[],
    components: ComponentPlacement[],
    bendAxis: { x: number; y: number },
    flexThickness: number,
  ): FlexDrcViolation[] {
    const allViolations: FlexDrcViolation[] = [];

    for (const zoneId of zoneIds) {
      // Bend radius validation
      const bendResult = this.validateBendRadius(zoneId, flexThickness);
      allViolations.push(...bendResult.violations);

      // Via exclusion
      allViolations.push(...this.checkViaExclusion(zoneId, vias));

      // Copper restrictions
      allViolations.push(...this.checkCopperRestrictions(zoneId, pours));

      // Component placement
      allViolations.push(...this.checkComponentPlacement(zoneId, components));

      // Trace direction
      allViolations.push(...this.checkTraceDirection(zoneId, traces, bendAxis));

      // Transition stress
      allViolations.push(...this.checkTransitionStress(zoneId, traces));
    }

    return allViolations;
  }

  // -----------------------------------------------------------------------
  // Material
  // -----------------------------------------------------------------------

  getMaterial(name: FlexMaterial): FlexMaterialProperties | null {
    const mat = FLEX_MATERIAL_DATABASE[name];
    if (!mat) {
      return null;
    }
    return { ...mat };
  }

  getAllMaterials(): FlexMaterialProperties[] {
    return Array.from(Object.values(FLEX_MATERIAL_DATABASE)).map((m) => ({ ...m }));
  }

  getFlexThickness(zoneId: string): number {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return 0;
    }
    const mat = FLEX_MATERIAL_DATABASE[zone.material];
    if (!mat) {
      return 0;
    }
    // Return the midpoint of the thickness range as default
    return (mat.thicknessRange.min + mat.thicknessRange.max) / 2;
  }

  // -----------------------------------------------------------------------
  // Persistence (export / import)
  // -----------------------------------------------------------------------

  exportZones(): string {
    const data: SerializedFlexZones = {
      zones: this.getAllZones(),
    };
    return JSON.stringify(data, null, 2);
  }

  importZones(json: string): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { success: false, errors: ['Invalid JSON'] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, errors: ['Data must be an object'] };
    }

    const data = parsed as Record<string, unknown>;

    if (!Array.isArray(data.zones)) {
      errors.push('Missing or invalid "zones" array');
      return { success: false, errors };
    }

    const zonesArr = data.zones as unknown[];

    for (let i = 0; i < zonesArr.length; i++) {
      const z = zonesArr[i];
      if (typeof z !== 'object' || z === null) {
        errors.push(`Zone ${String(i)}: must be an object`);
        continue;
      }
      const zone = z as Record<string, unknown>;
      if (typeof zone.name !== 'string') {
        errors.push(`Zone ${String(i)}: missing name`);
      }
      if (!Array.isArray(zone.polygon)) {
        errors.push(`Zone ${String(i)}: missing polygon`);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    this.zones = (zonesArr as FlexZone[]).map((z) => ({
      ...z,
      id: z.id ?? crypto.randomUUID(),
    }));

    this.save();
    this.notify();
    return { success: true, errors: [] };
  }

  // -----------------------------------------------------------------------
  // Persistence (localStorage)
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      const data: SerializedFlexZones = {
        zones: this.zones,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      if (Array.isArray(data.zones)) {
        const validZones = (data.zones as unknown[]).filter(
          (z: unknown): z is FlexZone =>
            typeof z === 'object' &&
            z !== null &&
            typeof (z as FlexZone).id === 'string' &&
            typeof (z as FlexZone).name === 'string' &&
            Array.isArray((z as FlexZone).polygon),
        );
        this.zones = validZones;
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}
