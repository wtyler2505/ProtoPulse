/**
 * NetPadMapper — Resolves circuit nets to physical pad positions on placed footprints.
 *
 * This is the bridge between the schematic world (nets connecting logical pins)
 * and the PCB world (physical pad coordinates on placed footprints).
 */

import type { CircuitInstanceRow } from '@shared/schema';
import type { Footprint, Pad } from '@/lib/pcb/footprint-library';
import type { NetSegment } from '@/components/views/pcb-layout/ComponentPlacer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlacedPad {
  instanceId: number;
  padNumber: number;
  netId: number;
  position: { x: number; y: number };
  pad: Pad;
}

export interface RatsnestPair {
  from: PlacedPad;
  to: PlacedPad;
  distance: number;
  netId: number;
}

export interface NetPadResult {
  netPads: Map<number, PlacedPad[]>;
  ratsnestPairs: RatsnestPair[];
  unmappedPins: Array<{ instanceId: number; pinName: string; netId: number }>;
}

/** Minimal net shape (matches ComponentPlacer.NetRecord). */
interface NetRecord {
  id: number;
  name: string;
  segments: unknown;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Rotate a point (px, py) by angleDeg degrees around the origin. */
function rotatePad(px: number, py: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: px * Math.cos(rad) - py * Math.sin(rad),
    y: px * Math.sin(rad) + py * Math.cos(rad),
  };
}

/** Euclidean distance between two 2D points. */
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// Prim's MST
// ---------------------------------------------------------------------------

/**
 * Compute a minimum spanning tree over a set of placed pads using Prim's algorithm.
 * Returns N-1 pairs for N pads (or fewer if N < 2).
 */
function computeMST(pads: PlacedPad[], netId: number): RatsnestPair[] {
  const n = pads.length;
  if (n < 2) { return []; }

  const inTree = new Array<boolean>(n).fill(false);
  const minDist = new Array<number>(n).fill(Infinity);
  const minFrom = new Array<number>(n).fill(-1);
  const pairs: RatsnestPair[] = [];

  // Start from node 0
  minDist[0] = 0;

  for (let added = 0; added < n; added++) {
    // Find the unvisited node with minimum distance
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && (u === -1 || minDist[i] < minDist[u])) {
        u = i;
      }
    }

    inTree[u] = true;

    // Record the edge (skip the first node which has no parent)
    if (minFrom[u] !== -1) {
      const dist = distance(pads[minFrom[u]].position, pads[u].position);
      pairs.push({
        from: pads[minFrom[u]],
        to: pads[u],
        distance: dist,
        netId,
      });
    }

    // Update distances for neighbors
    for (let v = 0; v < n; v++) {
      if (!inTree[v]) {
        const d = distance(pads[u].position, pads[v].position);
        if (d < minDist[v]) {
          minDist[v] = d;
          minFrom[v] = u;
        }
      }
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Package type extraction
// ---------------------------------------------------------------------------

/** Extract the package type string from a circuit instance's properties. */
function getPackageType(instance: CircuitInstanceRow): string | null {
  const props = instance.properties as Record<string, unknown> | null;
  if (!props) { return null; }
  const pkg = props['package'] ?? props['packageType'];
  return typeof pkg === 'string' ? pkg : null;
}

// ---------------------------------------------------------------------------
// NetPadMapper
// ---------------------------------------------------------------------------

export class NetPadMapper {
  /**
   * Resolve circuit nets to physical pad positions on placed footprints.
   *
   * @param nets      Array of net records with segments
   * @param instances Array of circuit instances (some may have PCB coordinates)
   * @param getFootprint Callback to look up a Footprint by package type string
   */
  static resolve(
    nets: NetRecord[],
    instances: CircuitInstanceRow[],
    getFootprint: (packageType: string) => Footprint | null,
  ): NetPadResult {
    const netPads = new Map<number, PlacedPad[]>();
    const unmappedPins: NetPadResult['unmappedPins'] = [];
    const allRatsnestPairs: RatsnestPair[] = [];

    // Build instance lookup for fast access
    const instanceMap = new Map<number, CircuitInstanceRow>();
    for (const inst of instances) {
      instanceMap.set(inst.id, inst);
    }

    // Cache footprint lookups per instance
    const footprintCache = new Map<number, Footprint | null>();
    function lookupFootprint(inst: CircuitInstanceRow): Footprint | null {
      if (footprintCache.has(inst.id)) {
        return footprintCache.get(inst.id)!;
      }
      const pkgType = getPackageType(inst);
      const fp = pkgType ? getFootprint(pkgType) : null;
      footprintCache.set(inst.id, fp);
      return fp;
    }

    for (const net of nets) {
      const segments = (net.segments ?? []) as NetSegment[];
      if (segments.length === 0) { continue; }

      // Dedup key: "instanceId:padNumber"
      const seen = new Set<string>();
      const pads: PlacedPad[] = [];

      for (const seg of segments) {
        // Process from side
        this.resolvePin(
          seg.fromInstanceId, seg.fromPin, net.id,
          instanceMap, lookupFootprint, getFootprint,
          seen, pads, unmappedPins,
        );

        // Process to side
        this.resolvePin(
          seg.toInstanceId, seg.toPin, net.id,
          instanceMap, lookupFootprint, getFootprint,
          seen, pads, unmappedPins,
        );
      }

      if (pads.length > 0) {
        netPads.set(net.id, pads);
      }

      // Generate MST ratsnest pairs
      const mstPairs = computeMST(pads, net.id);
      allRatsnestPairs.push(...mstPairs);
    }

    return { netPads, ratsnestPairs: allRatsnestPairs, unmappedPins };
  }

  /**
   * Resolve a single pin reference to a PlacedPad, or add it to unmappedPins.
   */
  private static resolvePin(
    instanceId: number,
    pinName: string,
    netId: number,
    instanceMap: Map<number, CircuitInstanceRow>,
    lookupFootprint: (inst: CircuitInstanceRow) => Footprint | null,
    getFootprint: (packageType: string) => Footprint | null,
    seen: Set<string>,
    pads: PlacedPad[],
    unmappedPins: NetPadResult['unmappedPins'],
  ): void {
    const inst = instanceMap.get(instanceId);

    // Instance not found → unmapped
    if (!inst) {
      unmappedPins.push({ instanceId, pinName, netId });
      return;
    }

    // Instance not placed on PCB → unmapped
    if (inst.pcbX == null || inst.pcbY == null) {
      unmappedPins.push({ instanceId, pinName, netId });
      return;
    }

    // Look up footprint
    const fp = lookupFootprint(inst);
    if (!fp) {
      unmappedPins.push({ instanceId, pinName, netId });
      return;
    }

    // Find matching pad: try numeric match first (pin name "1" → pad number 1)
    const pinNum = parseInt(pinName, 10);
    let matchedPad: Pad | undefined;
    if (!isNaN(pinNum)) {
      matchedPad = fp.pads.find((p) => p.number === pinNum);
    }

    if (!matchedPad) {
      unmappedPins.push({ instanceId, pinName, netId });
      return;
    }

    // Dedup check
    const key = `${String(instanceId)}:${String(matchedPad.number)}`;
    if (seen.has(key)) { return; }
    seen.add(key);

    // Compute absolute position: rotate pad position, then translate by instance position
    const rotation = inst.pcbRotation ?? 0;
    const rotated = rotatePad(matchedPad.position.x, matchedPad.position.y, rotation);
    const absPos = {
      x: inst.pcbX + rotated.x,
      y: inst.pcbY + rotated.y,
    };

    pads.push({
      instanceId: inst.id,
      padNumber: matchedPad.number,
      netId,
      position: absPos,
      pad: matchedPad,
    });
  }
}
