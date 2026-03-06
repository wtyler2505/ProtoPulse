/**
 * Copper Pour / Zone Fill Engine
 *
 * Client-side copper pour engine for PCB ground and power planes.
 * Supports solid and hatched fills, thermal relief, obstacle subtraction,
 * keepout zones, priority-based filling, and zone conflict detection.
 *
 * Usage:
 *   const engine = CopperPourEngine.getInstance();
 *   const zone = engine.addZone({ name: 'GND', netName: 'GND', layer: 'F.Cu', ... });
 *   engine.addPadObstacle({ id: 'p1', center: { x: 100, y: 100 }, width: 60, height: 60, netName: 'VCC' });
 *   const result = engine.fillZone(zone.id);
 *
 * React hook:
 *   const { zones, addZone, fillAll, conflicts } = useCopperPour();
 */

import { useCallback, useEffect, useState } from 'react';

import type { PourObstacle } from '@/lib/pcb/copper-pour-bridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PourType = 'solid' | 'hatched' | 'none';
export type PourPriority = number; // lower = higher priority (filled first)
export type ThermalReliefStyle = 'direct' | '2-spoke' | '4-spoke' | 'none';

export interface Point {
  x: number;
  y: number;
}

export interface CopperZone {
  id: string;
  name: string;
  netName: string;
  layer: string;
  pourType: PourType;
  priority: PourPriority;
  boundary: Point[]; // polygon vertices (closed: first === last)
  clearance: number; // mils — gap around non-connected pads/traces
  minWidth: number; // mils — minimum copper strip width
  thermalRelief: ThermalReliefStyle;
  thermalReliefGap: number; // mils
  thermalReliefWidth: number; // mils — spoke width
  hatchWidth?: number; // mils — line width for hatched fill
  hatchGap?: number; // mils — gap between hatch lines
  isKeepout: boolean;
  filled: boolean; // has fill been computed?
}

export interface PadObstacle {
  id: string;
  center: Point;
  width: number;
  height: number;
  netName: string;
  rotation?: number;
}

export interface TraceObstacle {
  id: string;
  start: Point;
  end: Point;
  width: number;
  netName: string;
}

export interface ViaObstacle {
  id: string;
  center: Point;
  drillDiameter: number;
  outerDiameter: number;
  netName: string;
}

export interface FillResult {
  zoneId: string;
  polygons: Point[][]; // filled copper polygons (may be multiple after obstacle subtraction)
  area: number; // sq mils
  voidCount: number;
  thermalConnections: Array<{ padId: string; spokeCount: number }>;
  warnings: string[];
  fillTime: number; // ms
}

export interface ZoneConflict {
  zone1Id: string;
  zone2Id: string;
  overlapArea: number;
  resolution: 'priority' | 'error';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-copper-pour';
const DEFAULT_CIRCLE_SEGMENTS = 16;

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Geometry Helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Compute area of a polygon using the shoelace formula.
 * Returns absolute area (always positive).
 */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Determine if a point lies inside a polygon using ray casting.
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    // Check if point is on an edge (horizontal ray intersection)
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Offset a polygon inward (negative distance) or outward (positive distance).
 * Simplified approach: moves each vertex along the averaged normal of adjacent edges.
 * Detects winding direction to ensure correct normal orientation.
 */
export function offsetPolygon(polygon: Point[], distance: number): Point[] {
  if (polygon.length < 3 || distance === 0) {
    return polygon.map((p) => ({ ...p }));
  }

  const n = polygon.length;

  // Determine winding direction using signed area (shoelace)
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    signedArea += polygon[i].x * polygon[j].y;
    signedArea -= polygon[j].x * polygon[i].y;
  }
  // signedArea > 0 means CCW, < 0 means CW
  // We want outward normals to point away from interior
  // For CCW polygons, the outward normal of edge (dx,dy) is (dy, -dx)
  // For CW polygons, the outward normal of edge (dx,dy) is (-dy, dx)
  const windingSign = signedArea >= 0 ? 1 : -1;

  const result: Point[] = [];

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    // Edge vectors
    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;

    const len1 = Math.sqrt(e1x * e1x + e1y * e1y);
    const len2 = Math.sqrt(e2x * e2x + e2y * e2y);

    if (len1 === 0 || len2 === 0) {
      result.push({ ...curr });
      continue;
    }

    // Outward normals — direction depends on winding
    const n1x = (windingSign * e1y) / len1;
    const n1y = (-windingSign * e1x) / len1;
    const n2x = (windingSign * e2y) / len2;
    const n2y = (-windingSign * e2x) / len2;

    // Average normal
    let nx = (n1x + n2x) / 2;
    let ny = (n1y + n2y) / 2;
    const nLen = Math.sqrt(nx * nx + ny * ny);

    if (nLen === 0) {
      result.push({ ...curr });
      continue;
    }

    nx /= nLen;
    ny /= nLen;

    // Scale by distance / cos(half-angle) for miter-style offset
    const dot = n1x * nx + n1y * ny;
    const scale = dot > 0.1 ? distance / dot : distance;

    result.push({
      x: curr.x + nx * scale,
      y: curr.y + ny * scale,
    });
  }

  return result;
}

/**
 * Subtract a circle from a polygon. Returns the resulting polygon(s).
 * Simplified: approximates the circle as a polygon and performs subtraction.
 */
export function subtractCircle(
  polygon: Point[],
  center: Point,
  radius: number,
  segments: number = DEFAULT_CIRCLE_SEGMENTS,
): Point[][] {
  if (polygon.length < 3 || radius <= 0) {
    return [polygon.map((p) => ({ ...p }))];
  }

  // Generate circle polygon
  const circle: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    circle.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }

  return clipPolygons(polygon, circle);
}

/**
 * Boolean subtraction of clip polygon from subject polygon.
 * Returns the subject polygon with the clip region removed.
 * Uses a simplified approach: if the clip is fully inside the subject,
 * returns the subject with a void; if partially overlapping, clips vertices.
 */
export function clipPolygons(subject: Point[], clip: Point[]): Point[][] {
  if (subject.length < 3 || clip.length < 3) {
    return [subject.map((p) => ({ ...p }))];
  }

  // Check if clip polygon overlaps with subject at all
  const clipCenter = {
    x: clip.reduce((sum, p) => sum + p.x, 0) / clip.length,
    y: clip.reduce((sum, p) => sum + p.y, 0) / clip.length,
  };

  if (!pointInPolygon(clipCenter, subject)) {
    // Check if any clip vertices are inside subject
    const anyInside = clip.some((p) => pointInPolygon(p, subject));
    if (!anyInside) {
      // No overlap — return subject unchanged
      return [subject.map((p) => ({ ...p }))];
    }
  }

  // Filter subject vertices that are outside the clip polygon
  const outsideVertices = subject.filter((p) => !pointInPolygon(p, clip));

  if (outsideVertices.length === 0) {
    // Entire subject is inside clip — nothing remains
    return [];
  }

  if (outsideVertices.length === subject.length) {
    // Clip is fully contained — create subject with hole
    // Return two polygons: outer boundary and inner void edge
    const result: Point[][] = [];

    // Find the closest subject vertex to the clip
    let minDist = Infinity;
    let closestSubjectIdx = 0;
    subject.forEach((sp, si) => {
      const dist = Math.sqrt((sp.x - clip[0].x) ** 2 + (sp.y - clip[0].y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestSubjectIdx = si;
      }
    });

    // Create a polygon that traces the outer boundary, cuts to the hole,
    // traces the hole in reverse, and cuts back
    const combined: Point[] = [];
    for (let i = 0; i <= subject.length; i++) {
      combined.push({ ...subject[(closestSubjectIdx + i) % subject.length] });
    }
    // Bridge to clip
    const reversedClip = [...clip].reverse();
    reversedClip.forEach((p) => {
      combined.push({ ...p });
    });
    // Bridge back
    combined.push({ ...clip[clip.length - 1] });
    combined.push({ ...subject[closestSubjectIdx] });

    result.push(combined);
    return result;
  }

  // Partial overlap — return the outside vertices as a simplified polygon
  // plus intersection points on the clip boundary
  const result: Point[] = [];
  const n = subject.length;

  for (let i = 0; i < n; i++) {
    const curr = subject[i];
    const next = subject[(i + 1) % n];
    const currInside = pointInPolygon(curr, clip);
    const nextInside = pointInPolygon(next, clip);

    if (!currInside) {
      result.push({ ...curr });
    }

    // If crossing the clip boundary, add intersection point
    if (currInside !== nextInside) {
      const intersection = findEdgeClipIntersection(curr, next, clip);
      if (intersection) {
        result.push(intersection);
      }
    }
  }

  if (result.length < 3) {
    return [subject.map((p) => ({ ...p }))];
  }

  return [result];
}

/**
 * Find the intersection point of a line segment with a polygon boundary.
 */
function findEdgeClipIntersection(p1: Point, p2: Point, polygon: Point[]): Point | null {
  const n = polygon.length;
  let closest: Point | null = null;
  let closestDist = Infinity;

  for (let i = 0; i < n; i++) {
    const p3 = polygon[i];
    const p4 = polygon[(i + 1) % n];
    const intersection = lineSegmentIntersection(p1, p2, p3, p4);
    if (intersection) {
      const dist = (intersection.x - p1.x) ** 2 + (intersection.y - p1.y) ** 2;
      if (dist < closestDist) {
        closestDist = dist;
        closest = intersection;
      }
    }
  }

  return closest;
}

/**
 * Find the intersection point of two line segments, if they intersect.
 */
function lineSegmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) {
    return null; // parallel or coincident
  }

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * d1x,
      y: p1.y + t * d1y,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// CopperPourEngine
// ---------------------------------------------------------------------------

/**
 * Manages copper pour zones, obstacles, and fill computation.
 * Singleton per application. Notifies subscribers on state changes.
 * Persists to localStorage.
 */
export class CopperPourEngine {
  private static instance: CopperPourEngine | null = null;

  private zones: Map<string, CopperZone> = new Map();
  private padObstacles: Map<string, PadObstacle> = new Map();
  private traceObstacles: Map<string, TraceObstacle> = new Map();
  private viaObstacles: Map<string, ViaObstacle> = new Map();
  private fillResults: Map<string, FillResult> = new Map();
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): CopperPourEngine {
    if (!CopperPourEngine.instance) {
      CopperPourEngine.instance = new CopperPourEngine();
    }
    return CopperPourEngine.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    CopperPourEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
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

  /** Add a new copper zone. Returns the created zone. */
  addZone(input: Omit<CopperZone, 'id' | 'filled'>): CopperZone {
    const id = crypto.randomUUID();
    const zone: CopperZone = {
      ...input,
      id,
      filled: false,
    };
    this.zones.set(id, zone);
    this.save();
    this.notify();
    return { ...zone };
  }

  /** Remove a zone by ID. Returns true if removed. */
  removeZone(id: string): boolean {
    const existed = this.zones.delete(id);
    if (existed) {
      this.fillResults.delete(id);
      this.save();
      this.notify();
    }
    return existed;
  }

  /** Update a zone. Returns true if found and updated. */
  updateZone(id: string, updates: Partial<Omit<CopperZone, 'id'>>): boolean {
    const zone = this.zones.get(id);
    if (!zone) {
      return false;
    }

    const updatedZone = { ...zone, ...updates, id: zone.id };
    // If boundary or clearance or other fill-affecting properties changed, mark as unfilled
    if (
      updates.boundary !== undefined ||
      updates.clearance !== undefined ||
      updates.minWidth !== undefined ||
      updates.thermalRelief !== undefined ||
      updates.thermalReliefGap !== undefined ||
      updates.thermalReliefWidth !== undefined ||
      updates.pourType !== undefined ||
      updates.hatchWidth !== undefined ||
      updates.hatchGap !== undefined ||
      updates.isKeepout !== undefined
    ) {
      updatedZone.filled = false;
      this.fillResults.delete(id);
    }

    this.zones.set(id, updatedZone);
    this.save();
    this.notify();
    return true;
  }

  /** Get a zone by ID. Returns null if not found. */
  getZone(id: string): CopperZone | null {
    const zone = this.zones.get(id);
    return zone ? { ...zone } : null;
  }

  /** Get all zones. */
  getAllZones(): CopperZone[] {
    const result: CopperZone[] = [];
    this.zones.forEach((zone) => {
      result.push({ ...zone });
    });
    return result;
  }

  /** Get zones on a specific layer. */
  getZonesByLayer(layer: string): CopperZone[] {
    const result: CopperZone[] = [];
    this.zones.forEach((zone) => {
      if (zone.layer === layer) {
        result.push({ ...zone });
      }
    });
    return result;
  }

  /** Get zones connected to a specific net. */
  getZonesByNet(netName: string): CopperZone[] {
    const result: CopperZone[] = [];
    this.zones.forEach((zone) => {
      if (zone.netName === netName) {
        result.push({ ...zone });
      }
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Obstacle Management
  // -----------------------------------------------------------------------

  /** Add a pad obstacle. */
  addPadObstacle(pad: PadObstacle): void {
    this.padObstacles.set(pad.id, { ...pad });
  }

  /** Add a trace obstacle. */
  addTraceObstacle(trace: TraceObstacle): void {
    this.traceObstacles.set(trace.id, { ...trace });
  }

  /** Add a via obstacle. */
  addViaObstacle(via: ViaObstacle): void {
    this.viaObstacles.set(via.id, { ...via });
  }

  /** Clear all obstacles. */
  clearObstacles(): void {
    this.padObstacles.clear();
    this.traceObstacles.clear();
    this.viaObstacles.clear();
  }

  /**
   * Replace all routing obstacles from CopperPourBridge data.
   *
   * Clears existing obstacles and ingests PourObstacle[] from the bridge,
   * converting them into the engine's native PadObstacle / TraceObstacle /
   * ViaObstacle types. This is the primary integration point for feeding
   * live routing data into the pour engine.
   */
  setRoutingObstacles(obstacles: PourObstacle[]): void {
    this.clearObstacles();

    for (const obs of obstacles) {
      const id = crypto.randomUUID();

      if (obs.type === 'pad') {
        this.padObstacles.set(id, {
          id,
          center: { x: obs.x, y: obs.y },
          width: obs.width,
          height: obs.height,
          netName: obs.netId ?? '',
          rotation: obs.rotation,
        });
      } else if (obs.type === 'trace') {
        // Reconstruct segment endpoints from center + dimensions + rotation
        const halfLen = obs.width / 2;
        const angleRad = ((obs.rotation ?? 0) * Math.PI) / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        this.traceObstacles.set(id, {
          id,
          start: { x: obs.x - halfLen * cosA, y: obs.y - halfLen * sinA },
          end: { x: obs.x + halfLen * cosA, y: obs.y + halfLen * sinA },
          width: obs.height, // height = trace width in the bridge encoding
          netName: obs.netId ?? '',
        });
      } else if (obs.type === 'via') {
        this.viaObstacles.set(id, {
          id,
          center: { x: obs.x, y: obs.y },
          drillDiameter: obs.width * 0.5, // approximate drill as half outer
          outerDiameter: obs.width,
          netName: obs.netId ?? '',
        });
      }
    }
  }

  /** Get all obstacles. */
  getObstacles(): { pads: PadObstacle[]; traces: TraceObstacle[]; vias: ViaObstacle[] } {
    const pads: PadObstacle[] = [];
    const traces: TraceObstacle[] = [];
    const vias: ViaObstacle[] = [];
    this.padObstacles.forEach((p) => {
      pads.push({ ...p });
    });
    this.traceObstacles.forEach((t) => {
      traces.push({ ...t });
    });
    this.viaObstacles.forEach((v) => {
      vias.push({ ...v });
    });
    return { pads, traces, vias };
  }

  // -----------------------------------------------------------------------
  // Fill Computation
  // -----------------------------------------------------------------------

  /** Compute copper fill for a single zone. */
  fillZone(zoneId: string): FillResult {
    const startTime = performance.now();
    const zone = this.zones.get(zoneId);

    if (!zone) {
      return {
        zoneId,
        polygons: [],
        area: 0,
        voidCount: 0,
        thermalConnections: [],
        warnings: [`Zone ${zoneId} not found`],
        fillTime: performance.now() - startTime,
      };
    }

    if (zone.pourType === 'none') {
      const result: FillResult = {
        zoneId,
        polygons: [],
        area: 0,
        voidCount: 0,
        thermalConnections: [],
        warnings: ['Pour type is none — no fill generated'],
        fillTime: performance.now() - startTime,
      };
      this.fillResults.set(zoneId, result);
      zone.filled = true;
      this.zones.set(zoneId, zone);
      this.save();
      this.notify();
      return { ...result };
    }

    if (zone.isKeepout) {
      const result: FillResult = {
        zoneId,
        polygons: [],
        area: 0,
        voidCount: 0,
        thermalConnections: [],
        warnings: ['Keepout zone — no copper fill'],
        fillTime: performance.now() - startTime,
      };
      this.fillResults.set(zoneId, result);
      zone.filled = true;
      this.zones.set(zoneId, zone);
      this.save();
      this.notify();
      return { ...result };
    }

    const warnings: string[] = [];
    const thermalConnections: Array<{ padId: string; spokeCount: number }> = [];
    let fillPolygons: Point[][] = [zone.boundary.map((p) => ({ ...p }))];

    // Subtract keepout zones on the same layer
    this.zones.forEach((otherZone) => {
      if (otherZone.isKeepout && otherZone.layer === zone.layer && otherZone.id !== zone.id) {
        const expandedKeepout = offsetPolygon(otherZone.boundary, zone.clearance);
        const newPolygons: Point[][] = [];
        fillPolygons.forEach((poly) => {
          const clipped = clipPolygons(poly, expandedKeepout);
          clipped.forEach((cp) => {
            newPolygons.push(cp);
          });
        });
        fillPolygons = newPolygons;
      }
    });

    // Process pad obstacles
    this.padObstacles.forEach((pad) => {
      if (pad.netName === zone.netName) {
        // Same net — apply thermal relief
        if (zone.thermalRelief !== 'direct' && zone.thermalRelief !== 'none') {
          const spokeCount = zone.thermalRelief === '2-spoke' ? 2 : 4;
          thermalConnections.push({ padId: pad.id, spokeCount });

          // Create thermal relief gaps around the pad
          const gapPolygons = generateThermalReliefGaps(
            pad.center,
            Math.max(pad.width, pad.height) / 2,
            zone.thermalReliefGap,
            zone.thermalReliefWidth,
            spokeCount,
          );

          gapPolygons.forEach((gapPoly) => {
            const newPolygons: Point[][] = [];
            fillPolygons.forEach((poly) => {
              const clipped = clipPolygons(poly, gapPoly);
              clipped.forEach((cp) => {
                newPolygons.push(cp);
              });
            });
            fillPolygons = newPolygons;
          });
        } else if (zone.thermalRelief === 'direct') {
          thermalConnections.push({ padId: pad.id, spokeCount: 0 });
        }
        // 'none' thermal relief means no connection at all — treat as obstacle
        if (zone.thermalRelief === 'none') {
          const radius = Math.max(pad.width, pad.height) / 2 + zone.clearance;
          const newPolygons: Point[][] = [];
          fillPolygons.forEach((poly) => {
            const subtracted = subtractCircle(poly, pad.center, radius);
            subtracted.forEach((sp) => {
              newPolygons.push(sp);
            });
          });
          fillPolygons = newPolygons;
        }
      } else {
        // Different net — subtract with clearance
        const radius = Math.max(pad.width, pad.height) / 2 + zone.clearance;
        const newPolygons: Point[][] = [];
        fillPolygons.forEach((poly) => {
          const subtracted = subtractCircle(poly, pad.center, radius);
          subtracted.forEach((sp) => {
            newPolygons.push(sp);
          });
        });
        fillPolygons = newPolygons;
      }
    });

    // Process trace obstacles
    this.traceObstacles.forEach((trace) => {
      if (trace.netName !== zone.netName) {
        // Different net — subtract trace with clearance
        const traceRect = traceToRectangle(trace, zone.clearance);
        const newPolygons: Point[][] = [];
        fillPolygons.forEach((poly) => {
          const clipped = clipPolygons(poly, traceRect);
          clipped.forEach((cp) => {
            newPolygons.push(cp);
          });
        });
        fillPolygons = newPolygons;
      }
    });

    // Process via obstacles
    this.viaObstacles.forEach((via) => {
      if (via.netName !== zone.netName) {
        const radius = via.outerDiameter / 2 + zone.clearance;
        const newPolygons: Point[][] = [];
        fillPolygons.forEach((poly) => {
          const subtracted = subtractCircle(poly, via.center, radius);
          subtracted.forEach((sp) => {
            newPolygons.push(sp);
          });
        });
        fillPolygons = newPolygons;
      }
    });

    // Remove polygon strips narrower than minWidth
    fillPolygons = fillPolygons.filter((poly) => {
      if (poly.length < 3) {
        return false;
      }
      const area = polygonArea(poly);
      // Rough check: if area is too small relative to perimeter, strip is too narrow
      let perimeter = 0;
      for (let i = 0; i < poly.length; i++) {
        const next = poly[(i + 1) % poly.length];
        perimeter += Math.sqrt((next.x - poly[i].x) ** 2 + (next.y - poly[i].y) ** 2);
      }
      // Width approximation: area / (perimeter / 2)
      if (perimeter > 0) {
        const approxWidth = (2 * area) / perimeter;
        if (approxWidth < zone.minWidth) {
          warnings.push(`Removed thin fill strip (approx ${approxWidth.toFixed(1)} mils < ${zone.minWidth} mils min)`);
          return false;
        }
      }
      return true;
    });

    // Handle hatched fill
    if (zone.pourType === 'hatched' && fillPolygons.length > 0) {
      const hatchWidth = zone.hatchWidth ?? 10;
      const hatchGap = zone.hatchGap ?? 20;
      const hatchedPolygons: Point[][] = [];

      fillPolygons.forEach((poly) => {
        const hatched = generateHatchFill(poly, hatchWidth, hatchGap);
        hatched.forEach((hp) => {
          hatchedPolygons.push(hp);
        });
      });

      fillPolygons = hatchedPolygons;
    }

    // Calculate total area
    let totalArea = 0;
    fillPolygons.forEach((poly) => {
      totalArea += polygonArea(poly);
    });

    // Count voids (polygons subtracted from original)
    const voidCount = Math.max(0, fillPolygons.length - 1);

    const result: FillResult = {
      zoneId,
      polygons: fillPolygons,
      area: totalArea,
      voidCount,
      thermalConnections,
      warnings,
      fillTime: performance.now() - startTime,
    };

    this.fillResults.set(zoneId, result);
    zone.filled = true;
    this.zones.set(zoneId, zone);
    this.save();
    this.notify();

    return { ...result, polygons: result.polygons.map((p) => p.map((pt) => ({ ...pt }))) };
  }

  /** Fill all zones respecting priority order (lower number = filled first). */
  fillAllZones(): FillResult[] {
    const sortedZones: CopperZone[] = [];
    this.zones.forEach((zone) => {
      sortedZones.push(zone);
    });
    sortedZones.sort((a, b) => a.priority - b.priority);

    const results: FillResult[] = [];
    sortedZones.forEach((zone) => {
      results.push(this.fillZone(zone.id));
    });

    return results;
  }

  /** Clear fill results for a single zone. */
  unfillZone(zoneId: string): void {
    const zone = this.zones.get(zoneId);
    if (zone) {
      zone.filled = false;
      this.zones.set(zoneId, zone);
      this.fillResults.delete(zoneId);
      this.save();
      this.notify();
    }
  }

  /** Clear all fill results. */
  unfillAll(): void {
    this.zones.forEach((zone) => {
      zone.filled = false;
    });
    this.fillResults.clear();
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Zone Conflicts
  // -----------------------------------------------------------------------

  /** Detect overlapping zones on the same layer. */
  detectConflicts(): ZoneConflict[] {
    const conflicts: ZoneConflict[] = [];
    const zoneList: CopperZone[] = [];
    this.zones.forEach((zone) => {
      zoneList.push(zone);
    });

    for (let i = 0; i < zoneList.length; i++) {
      for (let j = i + 1; j < zoneList.length; j++) {
        const z1 = zoneList[i];
        const z2 = zoneList[j];

        if (z1.layer !== z2.layer) {
          continue;
        }

        // Check for overlap by testing if any vertices of one polygon are inside the other
        const overlap = computeOverlapArea(z1.boundary, z2.boundary);
        if (overlap > 0) {
          const samePriority = z1.priority === z2.priority;
          conflicts.push({
            zone1Id: z1.id,
            zone2Id: z2.id,
            overlapArea: overlap,
            resolution: samePriority ? 'error' : 'priority',
          });
        }
      }
    }

    return conflicts;
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export all zones as JSON string. */
  exportZones(): string {
    const zones: CopperZone[] = [];
    this.zones.forEach((zone) => {
      zones.push({ ...zone });
    });
    return JSON.stringify({ zones }, null, 2);
  }

  /** Import zones from JSON string. */
  importZones(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { imported: 0, errors: ['Invalid JSON'] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { imported: 0, errors: ['Invalid format: expected object'] };
    }

    const data = parsed as Record<string, unknown>;
    if (!Array.isArray(data.zones)) {
      return { imported: 0, errors: ['Invalid format: missing zones array'] };
    }

    (data.zones as unknown[]).forEach((z: unknown, index: number) => {
      if (typeof z !== 'object' || z === null) {
        errors.push(`Zone at index ${index}: invalid format`);
        return;
      }

      const zoneData = z as Record<string, unknown>;
      if (typeof zoneData.name !== 'string' || typeof zoneData.netName !== 'string' || typeof zoneData.layer !== 'string') {
        errors.push(`Zone at index ${index}: missing required fields (name, netName, layer)`);
        return;
      }

      if (!Array.isArray(zoneData.boundary)) {
        errors.push(`Zone at index ${index}: missing boundary array`);
        return;
      }

      const id = crypto.randomUUID();
      const zone: CopperZone = {
        id,
        name: zoneData.name as string,
        netName: zoneData.netName as string,
        layer: zoneData.layer as string,
        pourType: (zoneData.pourType as PourType) ?? 'solid',
        priority: (zoneData.priority as number) ?? 0,
        boundary: (zoneData.boundary as Point[]).map((p) => ({ x: Number(p.x), y: Number(p.y) })),
        clearance: (zoneData.clearance as number) ?? 10,
        minWidth: (zoneData.minWidth as number) ?? 5,
        thermalRelief: (zoneData.thermalRelief as ThermalReliefStyle) ?? '4-spoke',
        thermalReliefGap: (zoneData.thermalReliefGap as number) ?? 10,
        thermalReliefWidth: (zoneData.thermalReliefWidth as number) ?? 10,
        hatchWidth: zoneData.hatchWidth as number | undefined,
        hatchGap: zoneData.hatchGap as number | undefined,
        isKeepout: (zoneData.isKeepout as boolean) ?? false,
        filled: false,
      };

      this.zones.set(id, zone);
      imported++;
    });

    if (imported > 0) {
      this.save();
      this.notify();
    }

    return { imported, errors };
  }

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  /** Clear all zones, obstacles, and fill results. */
  clear(): void {
    this.zones.clear();
    this.padObstacles.clear();
    this.traceObstacles.clear();
    this.viaObstacles.clear();
    this.fillResults.clear();
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const zones: CopperZone[] = [];
      this.zones.forEach((zone) => {
        zones.push(zone);
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ zones }));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
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
        (data.zones as unknown[]).forEach((z: unknown) => {
          if (typeof z !== 'object' || z === null) {
            return;
          }
          const zoneData = z as CopperZone;
          if (typeof zoneData.id === 'string' && typeof zoneData.name === 'string' && Array.isArray(zoneData.boundary)) {
            this.zones.set(zoneData.id, { ...zoneData });
          }
        });
      }
    } catch {
      // Corrupt data — start fresh
    }
  }
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Generate thermal relief gap polygons around a pad.
 * Creates spoke-shaped gaps that leave copper spokes connecting the pad to the pour.
 */
function generateThermalReliefGaps(
  center: Point,
  padRadius: number,
  gap: number,
  spokeWidth: number,
  spokeCount: number,
): Point[][] {
  const gaps: Point[][] = [];
  const outerRadius = padRadius + gap * 2;
  const halfSpoke = spokeWidth / 2;
  const angleStep = (2 * Math.PI) / (spokeCount * 2); // gaps between spokes

  for (let i = 0; i < spokeCount; i++) {
    // Gap is between spokes
    const gapAngle = ((2 * Math.PI) / spokeCount) * i + Math.PI / spokeCount;
    const halfGapAngle = angleStep;

    // Create a wedge-shaped gap
    const a1 = gapAngle - halfGapAngle + 0.1; // small offset to leave spoke
    const a2 = gapAngle + halfGapAngle - 0.1;

    const innerR = padRadius + halfSpoke;

    const gapPoly: Point[] = [
      { x: center.x + innerR * Math.cos(a1), y: center.y + innerR * Math.sin(a1) },
      { x: center.x + outerRadius * Math.cos(a1), y: center.y + outerRadius * Math.sin(a1) },
      { x: center.x + outerRadius * Math.cos(a2), y: center.y + outerRadius * Math.sin(a2) },
      { x: center.x + innerR * Math.cos(a2), y: center.y + innerR * Math.sin(a2) },
    ];

    gaps.push(gapPoly);
  }

  return gaps;
}

/**
 * Convert a trace segment to a rectangle polygon (trace width + clearance).
 */
function traceToRectangle(trace: TraceObstacle, clearance: number): Point[] {
  const dx = trace.end.x - trace.start.x;
  const dy = trace.end.y - trace.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) {
    // Degenerate trace — create a small square
    const half = trace.width / 2 + clearance;
    return [
      { x: trace.start.x - half, y: trace.start.y - half },
      { x: trace.start.x + half, y: trace.start.y - half },
      { x: trace.start.x + half, y: trace.start.y + half },
      { x: trace.start.x - half, y: trace.start.y + half },
    ];
  }

  // Perpendicular unit vector
  const px = -dy / len;
  const py = dx / len;
  const halfWidth = trace.width / 2 + clearance;

  return [
    { x: trace.start.x + px * halfWidth, y: trace.start.y + py * halfWidth },
    { x: trace.end.x + px * halfWidth, y: trace.end.y + py * halfWidth },
    { x: trace.end.x - px * halfWidth, y: trace.end.y - py * halfWidth },
    { x: trace.start.x - px * halfWidth, y: trace.start.y - py * halfWidth },
  ];
}

/**
 * Generate hatch fill pattern for a polygon.
 * Creates a set of narrow rectangular strips across the polygon.
 */
function generateHatchFill(polygon: Point[], hatchWidth: number, hatchGap: number): Point[][] {
  if (polygon.length < 3) {
    return [];
  }

  // Find bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  polygon.forEach((p) => {
    if (p.x < minX) { minX = p.x; }
    if (p.y < minY) { minY = p.y; }
    if (p.x > maxX) { maxX = p.x; }
    if (p.y > maxY) { maxY = p.y; }
  });

  const strips: Point[][] = [];
  const step = hatchWidth + hatchGap;

  // Generate horizontal strips
  for (let y = minY; y < maxY; y += step) {
    const strip: Point[] = [
      { x: minX, y },
      { x: maxX, y },
      { x: maxX, y: y + hatchWidth },
      { x: minX, y: y + hatchWidth },
    ];

    // Check if strip center is inside polygon
    const centerY = y + hatchWidth / 2;
    const centerX = (minX + maxX) / 2;
    if (pointInPolygon({ x: centerX, y: centerY }, polygon)) {
      strips.push(strip);
    }
  }

  return strips;
}

/**
 * Compute approximate overlap area between two polygons.
 */
function computeOverlapArea(poly1: Point[], poly2: Point[]): number {
  if (poly1.length < 3 || poly2.length < 3) {
    return 0;
  }

  // Count vertices of poly1 inside poly2 and vice versa
  let insideCount = 0;
  let totalChecked = 0;

  poly1.forEach((p) => {
    if (pointInPolygon(p, poly2)) {
      insideCount++;
    }
    totalChecked++;
  });

  poly2.forEach((p) => {
    if (pointInPolygon(p, poly1)) {
      insideCount++;
    }
    totalChecked++;
  });

  if (insideCount === 0) {
    return 0;
  }

  // Approximate overlap as fraction of smaller polygon's area
  const area1 = polygonArea(poly1);
  const area2 = polygonArea(poly2);
  const smallerArea = Math.min(area1, area2);
  const overlapFraction = insideCount / totalChecked;

  return smallerArea * overlapFraction;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the copper pour engine in React components.
 * Subscribes to the CopperPourEngine singleton and triggers re-renders on state changes.
 */
export function useCopperPour(): {
  zones: CopperZone[];
  addZone: (input: Omit<CopperZone, 'id' | 'filled'>) => CopperZone;
  removeZone: (id: string) => boolean;
  updateZone: (id: string, updates: Partial<Omit<CopperZone, 'id'>>) => boolean;
  fillZone: (zoneId: string) => FillResult;
  fillAll: () => FillResult[];
  unfillAll: () => void;
  conflicts: ZoneConflict[];
  exportZones: () => string;
  importZones: (json: string) => { imported: number; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const engine = CopperPourEngine.getInstance();
    const unsubscribe = engine.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const addZone = useCallback((input: Omit<CopperZone, 'id' | 'filled'>) => {
    return CopperPourEngine.getInstance().addZone(input);
  }, []);

  const removeZone = useCallback((id: string) => {
    return CopperPourEngine.getInstance().removeZone(id);
  }, []);

  const updateZone = useCallback((id: string, updates: Partial<Omit<CopperZone, 'id'>>) => {
    return CopperPourEngine.getInstance().updateZone(id, updates);
  }, []);

  const fillZone = useCallback((zoneId: string) => {
    return CopperPourEngine.getInstance().fillZone(zoneId);
  }, []);

  const fillAll = useCallback(() => {
    return CopperPourEngine.getInstance().fillAllZones();
  }, []);

  const unfillAll = useCallback(() => {
    CopperPourEngine.getInstance().unfillAll();
  }, []);

  const exportZones = useCallback(() => {
    return CopperPourEngine.getInstance().exportZones();
  }, []);

  const importZones = useCallback((json: string) => {
    return CopperPourEngine.getInstance().importZones(json);
  }, []);

  const engine = typeof window !== 'undefined' ? CopperPourEngine.getInstance() : null;

  return {
    zones: engine?.getAllZones() ?? [],
    addZone,
    removeZone,
    updateZone,
    fillZone,
    fillAll,
    unfillAll,
    conflicts: engine?.detectConflicts() ?? [],
    exportZones,
    importZones,
  };
}
