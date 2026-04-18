/**
 * Bidirectional Synchronization Engine — Schematic <-> Breadboard
 *
 * Keeps schematic net connections and breadboard wires in sync.
 * When one view changes, this engine computes the delta (wires to
 * create, wires to delete, unresolvable conflicts) for the other view.
 *
 * Pure TypeScript — no React, no side effects.
 */

import type { CircuitNetRow, CircuitInstanceRow, CircuitWireRow, ComponentPart } from '@shared/schema';
import type { NetSegment } from '@shared/circuit-types';
import type { Connector, TerminalPosition } from '@shared/component-types';

// ===========================================================================
// Public types
// ===========================================================================

export interface SyncResult {
  /** Wires to create on the target view */
  wiresToCreate: Array<{
    netId: number;
    view: 'breadboard' | 'schematic' | 'pcb';
    points: { x: number; y: number }[];
    color?: string;
    /** Origin of the wire: 'manual' (user-drawn), 'synced' (engine-generated), 'coach', 'jumper' */
    provenance?: string;
  }>;
  /** Wire IDs to delete from the target view */
  wireIdsToDelete: number[];
  /** Conflicts where views disagree */
  conflicts: SyncConflict[];
}

export interface SyncConflict {
  netId: number;
  netName: string;
  description: string;
  sourceView: string;
  targetView: string;
}

// ===========================================================================
// Internal helpers
// ===========================================================================

/** Type-safe extraction of JSONB segments from a net row. */
function extractSegments(net: CircuitNetRow): NetSegment[] {
  const raw = net.segments;
  if (!Array.isArray(raw)) return [];
  return raw as NetSegment[];
}

/** Type-safe extraction of JSONB points from a wire row. */
function extractPoints(wire: CircuitWireRow): { x: number; y: number }[] {
  const raw = wire.points;
  if (!Array.isArray(raw)) return [];
  return raw as { x: number; y: number }[];
}

/**
 * Build a lookup from instance ID to its row data.
 * Excludes instances that lack breadboard placement (null coords).
 */
function buildInstanceMap(instances: CircuitInstanceRow[]): Map<number, CircuitInstanceRow> {
  const map = new Map<number, CircuitInstanceRow>();
  for (const inst of instances) {
    map.set(inst.id, inst);
  }
  return map;
}

/**
 * Resolve a pin reference (instance + pin ID) to a breadboard pixel position.
 *
 * Strategy:
 *   1. If the instance has breadboard placement (breadboardX/Y), use it as the
 *      base offset and look up the pin's terminal position from the part's
 *      connector definition under the "breadboard" view.
 *   2. If no part data is available, fall back to the instance's breadboard
 *      position as an approximation.
 *   3. Returns null if the instance has no breadboard placement.
 */
function pinToBreadboardPixel(
  instanceId: number,
  pinId: string,
  instanceMap: Map<number, CircuitInstanceRow>,
  partsMap?: Map<number, ComponentPart>,
): { x: number; y: number } | null {
  const inst = instanceMap.get(instanceId);
  if (!inst) return null;
  if (inst.breadboardX == null || inst.breadboardY == null) return null;

  const baseX = inst.breadboardX;
  const baseY = inst.breadboardY;

  // Attempt to find the pin's terminal offset from the part definition
  if (partsMap && inst.partId != null) {
    const part = partsMap.get(inst.partId);
    if (part) {
      const connectors = (part.connectors ?? []) as Connector[];
      const conn = connectors.find((c) => c.id === pinId || c.name === pinId);
      if (conn?.terminalPositions?.breadboard) {
        const tp: TerminalPosition = conn.terminalPositions.breadboard;
        return { x: baseX + tp.x, y: baseY + tp.y };
      }
    }
  }

  // Fallback: use instance origin as approximation
  return { x: baseX, y: baseY };
}

/**
 * Resolve a pin reference to a schematic pixel position.
 * Uses schematicX/Y from the instance plus the pin's schematic terminal offset.
 */
function pinToSchematicPixel(
  instanceId: number,
  pinId: string,
  instanceMap: Map<number, CircuitInstanceRow>,
  partsMap?: Map<number, ComponentPart>,
): { x: number; y: number } | null {
  const inst = instanceMap.get(instanceId);
  if (!inst) return null;

  const baseX = inst.schematicX;
  const baseY = inst.schematicY;

  if (partsMap && inst.partId != null) {
    const part = partsMap.get(inst.partId);
    if (part) {
      const connectors = (part.connectors ?? []) as Connector[];
      const conn = connectors.find((c) => c.id === pinId || c.name === pinId);
      if (conn?.terminalPositions?.schematic) {
        const tp: TerminalPosition = conn.terminalPositions.schematic;
        return { x: baseX + tp.x, y: baseY + tp.y };
      }
    }
  }

  return { x: baseX, y: baseY };
}

/**
 * Extract net style color, falling back to a default.
 */
function netColor(net: CircuitNetRow): string | undefined {
  const style = net.style as { color?: string } | null;
  return style?.color ?? undefined;
}

/**
 * Build a canonical "connection signature" for a net segment: a sorted pair
 * of instance:pin keys. This lets us compare connections across views
 * regardless of direction.
 */
function segmentSignature(seg: NetSegment): string {
  const a = `${seg.fromInstanceId}:${seg.fromPin}`;
  const b = `${seg.toInstanceId}:${seg.toPin}`;
  return a < b ? `${a}<>${b}` : `${b}<>${a}`;
}

/**
 * Given a breadboard wire's points, attempt to determine which instance
 * pins it connects by snapping endpoints to breadboard coordinates and
 * matching against instance placements.
 *
 * Returns an array of { instanceId, pinId } for each endpoint that
 * resolves to a known pin, or null entries for unresolved endpoints.
 */
interface ResolvedPin {
  instanceId: number;
  pinId: string;
}

function resolveWireEndpoints(
  wire: CircuitWireRow,
  instanceMap: Map<number, CircuitInstanceRow>,
  partsMap?: Map<number, ComponentPart>,
): { from: ResolvedPin | null; to: ResolvedPin | null } {
  const points = extractPoints(wire);
  if (points.length < 2) return { from: null, to: null };

  const startPx = points[0];
  const endPx = points[points.length - 1];

  return {
    from: resolvePixelToPin(startPx, instanceMap, partsMap),
    to: resolvePixelToPin(endPx, instanceMap, partsMap),
  };
}

/**
 * Given a pixel position on the breadboard, find the nearest instance pin.
 *
 * Strategy: iterate all instances with breadboard placement, compute
 * each pin's breadboard position, and find the closest one within a
 * tolerance threshold.
 */
const PIN_SNAP_TOLERANCE = 15; // pixels

function resolvePixelToPin(
  px: { x: number; y: number },
  instanceMap: Map<number, CircuitInstanceRow>,
  partsMap?: Map<number, ComponentPart>,
): ResolvedPin | null {
  let bestDist = Infinity;
  let bestPin: ResolvedPin | null = null;

  instanceMap.forEach((inst, instId) => {
    if (inst.breadboardX == null || inst.breadboardY == null) return;

    if (!partsMap) {
      // Without part data, we can only check distance to instance origin
      const d = Math.hypot(px.x - inst.breadboardX, px.y - inst.breadboardY);
      if (d < bestDist && d <= PIN_SNAP_TOLERANCE) {
        bestDist = d;
        // No pin info available — use empty string as generic pin
        bestPin = { instanceId: instId, pinId: '' };
      }
      return;
    }

    if (inst.partId == null) return;
    const part = partsMap.get(inst.partId);
    if (!part) return;

    const connectors = (part.connectors ?? []) as Connector[];
    for (const conn of connectors) {
      const tp = conn.terminalPositions?.breadboard;
      if (!tp) continue;

      const pinPx = {
        x: inst.breadboardX + tp.x,
        y: inst.breadboardY + tp.y,
      };
      const d = Math.hypot(px.x - pinPx.x, px.y - pinPx.y);
      if (d < bestDist && d <= PIN_SNAP_TOLERANCE) {
        bestDist = d;
        bestPin = { instanceId: instId, pinId: conn.id };
      }
    }
  });

  return bestPin;
}

/**
 * Build a set of connection signatures from breadboard wires by resolving
 * their endpoints to instance pins.
 */
function buildBreadboardConnectionSet(
  wires: CircuitWireRow[],
  instanceMap: Map<number, CircuitInstanceRow>,
  partsMap?: Map<number, ComponentPart>,
): Map<string, CircuitWireRow> {
  const sigMap = new Map<string, CircuitWireRow>();

  for (const wire of wires) {
    if (wire.view !== 'breadboard') continue;
    const { from, to } = resolveWireEndpoints(wire, instanceMap, partsMap);
    if (!from || !to) continue;
    if (from.pinId == null || to.pinId == null || from.pinId === '' || to.pinId === '') {
      // Silently-dropped wire visibility (audit #371). Empty-string pinId
      // typically means a part lacks proper connector definitions — worth
      // surfacing so the data issue is debuggable.
      // eslint-disable-next-line no-console
      console.warn(
        '[view-sync] dropping wire %s: empty endpoint pinId. from=%s to=%s',
        String(wire.id),
        `${from.instanceId}:${from.pinId ?? '<null>'}`,
        `${to.instanceId}:${to.pinId ?? '<null>'}`,
      );
      continue;
    }

    const a = `${from.instanceId}:${from.pinId}`;
    const b = `${to.instanceId}:${to.pinId}`;
    const sig = a < b ? `${a}<>${b}` : `${b}<>${a}`;
    sigMap.set(sig, wire);
  }

  return sigMap;
}

// ===========================================================================
// syncSchematicToBreadboard
// ===========================================================================

/**
 * When schematic nets change, compute what breadboard wires need to be
 * created or deleted to keep the breadboard view in sync.
 *
 * @param nets        All circuit nets (schematic truth)
 * @param existingWires  All existing wires (we filter to breadboard view)
 * @param instances   All circuit instances (provide placement data)
 * @param partsMap    Optional map of partId -> ComponentPart for pin resolution
 */
export function syncSchematicToBreadboard(
  nets: CircuitNetRow[],
  existingWires: CircuitWireRow[],
  instances: CircuitInstanceRow[],
  partsMap?: Map<number, ComponentPart>,
): SyncResult {
  const result: SyncResult = {
    wiresToCreate: [],
    wireIdsToDelete: [],
    conflicts: [],
  };

  const instanceMap = buildInstanceMap(instances);
  const breadboardWires = existingWires.filter((w) => w.view === 'breadboard');

  // Build a set of connection signatures that already exist on the breadboard
  const existingBBConnections = buildBreadboardConnectionSet(
    breadboardWires,
    instanceMap,
    partsMap,
  );

  // Track which existing breadboard wires are accounted for by schematic nets.
  // Any remaining ones are "orphaned" and should be flagged/deleted.
  const accountedWireIds = new Set<number>();

  // Also track net IDs that own existing breadboard wires, for conflict detection
  const netIdToWireIds = new Map<number, number[]>();
  for (const wire of breadboardWires) {
    const list = netIdToWireIds.get(wire.netId) ?? [];
    list.push(wire.id);
    netIdToWireIds.set(wire.netId, list);
  }

  // --- Step 1: For each schematic net, derive expected breadboard connections ---

  for (const net of nets) {
    const segments = extractSegments(net);
    if (segments.length === 0) continue;

    const bbWireIdsForNet = netIdToWireIds.get(net.id) ?? [];

    for (const seg of segments) {
      const sig = segmentSignature(seg);

      // Check if a matching breadboard wire already exists
      const existingWire = existingBBConnections.get(sig);
      if (existingWire) {
        accountedWireIds.add(existingWire.id);
        continue;
      }

      // No matching breadboard wire — need to create one.
      // Resolve pin positions to breadboard pixel coordinates.
      const fromPx = pinToBreadboardPixel(seg.fromInstanceId, seg.fromPin, instanceMap, partsMap);
      const toPx = pinToBreadboardPixel(seg.toInstanceId, seg.toPin, instanceMap, partsMap);

      if (!fromPx || !toPx) {
        // Cannot place this connection on the breadboard — instance(s) not placed
        result.conflicts.push({
          netId: net.id,
          netName: net.name,
          description:
            `Cannot create breadboard wire for segment ` +
            `${seg.fromInstanceId}:${seg.fromPin} -> ${seg.toInstanceId}:${seg.toPin}: ` +
            `one or both instances lack breadboard placement`,
          sourceView: 'schematic',
          targetView: 'breadboard',
        });
        continue;
      }

      // Create a simple two-point wire (straight line between pins).
      // A more sophisticated router could add intermediate waypoints to
      // avoid obstacles, but direct connection is correct for sync purposes.
      result.wiresToCreate.push({
        netId: net.id,
        view: 'breadboard',
        points: [fromPx, toPx],
        color: netColor(net),
        provenance: 'synced',
      });
    }

    // Mark all existing wires for this net as accounted for
    for (const wid of bbWireIdsForNet) {
      accountedWireIds.add(wid);
    }
  }

  // --- Step 2: Identify stale breadboard wires ---
  // Wires that exist on the breadboard but belong to nets that no longer
  // have matching schematic segments should be deleted.

  const schematicNetIds = new Set(nets.map((n) => n.id));

  for (const wire of breadboardWires) {
    if (accountedWireIds.has(wire.id)) continue;

    if (!schematicNetIds.has(wire.netId)) {
      // This wire's net no longer exists in the schematic — delete it
      result.wireIdsToDelete.push(wire.id);
    } else {
      // The net exists but this specific wire doesn't correspond to any
      // current segment. Could be a user-drawn shortcut or stale connection.
      // Flag as conflict rather than silently deleting, since the user may
      // have intentionally routed it differently on the breadboard.
      const net = nets.find((n) => n.id === wire.netId);
      result.conflicts.push({
        netId: wire.netId,
        netName: net?.name ?? `net-${wire.netId}`,
        description:
          `Breadboard wire ${wire.id} belongs to net "${net?.name ?? wire.netId}" ` +
          `but does not match any current schematic segment`,
        sourceView: 'schematic',
        targetView: 'breadboard',
      });
    }
  }

  return result;
}

// ===========================================================================
// syncBreadboardToSchematic
// ===========================================================================

/**
 * When breadboard wires are drawn or modified, compute what schematic net
 * updates are needed.
 *
 * @param wires         All circuit wires (we filter to breadboard view)
 * @param existingNets  All existing circuit nets (schematic truth)
 * @param instances     All circuit instances
 * @param partsMap      Optional map of partId -> ComponentPart for pin resolution
 */
export function syncBreadboardToSchematic(
  wires: CircuitWireRow[],
  existingNets: CircuitNetRow[],
  instances: CircuitInstanceRow[],
  partsMap?: Map<number, ComponentPart>,
): SyncResult {
  const result: SyncResult = {
    wiresToCreate: [],
    wireIdsToDelete: [],
    conflicts: [],
  };

  const instanceMap = buildInstanceMap(instances);
  const breadboardWires = wires.filter((w) => w.view === 'breadboard');

  // Build a lookup of existing schematic segment signatures per net
  const netSegmentSigs = new Map<number, Set<string>>();
  for (const net of existingNets) {
    const sigs = new Set<string>();
    for (const seg of extractSegments(net)) {
      sigs.add(segmentSignature(seg));
    }
    netSegmentSigs.set(net.id, sigs);
  }

  // Build reverse lookup: connection signature -> net
  const sigToNet = new Map<string, CircuitNetRow>();
  for (const net of existingNets) {
    for (const seg of extractSegments(net)) {
      sigToNet.set(segmentSignature(seg), net);
    }
  }

  // Track which schematic nets are accounted for
  const accountedNetIds = new Set<number>();

  for (const wire of breadboardWires) {
    const { from, to } = resolveWireEndpoints(wire, instanceMap, partsMap);

    if (!from || !to) {
      // Cannot resolve this wire's endpoints to specific pins
      result.conflicts.push({
        netId: wire.netId,
        netName: `net-${wire.netId}`,
        description:
          `Breadboard wire ${wire.id} endpoints could not be resolved to instance pins`,
        sourceView: 'breadboard',
        targetView: 'schematic',
      });
      continue;
    }
    if (from.pinId == null || to.pinId == null || from.pinId === '' || to.pinId === '') {
      // Silently-dropped wire visibility (audit #371). Empty-string pinId
      // typically means a part lacks proper connector definitions — worth
      // surfacing so the data issue is debuggable.
      // eslint-disable-next-line no-console
      console.warn(
        '[view-sync] dropping wire %s: empty endpoint pinId. from=%s to=%s',
        String(wire.id),
        `${from.instanceId}:${from.pinId ?? '<null>'}`,
        `${to.instanceId}:${to.pinId ?? '<null>'}`,
      );
      result.conflicts.push({
        netId: wire.netId,
        netName: `net-${wire.netId}`,
        description:
          `Breadboard wire ${wire.id} endpoints could not be resolved to instance pins`,
        sourceView: 'breadboard',
        targetView: 'schematic',
      });
      continue;
    }

    const a = `${from.instanceId}:${from.pinId}`;
    const b = `${to.instanceId}:${to.pinId}`;
    const sig = a < b ? `${a}<>${b}` : `${b}<>${a}`;

    // Check if a matching schematic net segment already exists
    const existingNet = sigToNet.get(sig);
    if (existingNet) {
      accountedNetIds.add(existingNet.id);
      continue;
    }

    // No matching schematic segment — need to create a schematic wire.
    // Resolve pin positions to schematic pixel coordinates for the new wire.
    const fromPx = pinToSchematicPixel(from.instanceId, from.pinId, instanceMap, partsMap);
    const toPx = pinToSchematicPixel(to.instanceId, to.pinId, instanceMap, partsMap);

    if (!fromPx || !toPx) {
      result.conflicts.push({
        netId: wire.netId,
        netName: `net-${wire.netId}`,
        description:
          `Cannot create schematic wire for breadboard connection ` +
          `${from.instanceId}:${from.pinId} -> ${to.instanceId}:${to.pinId}: ` +
          `instance schematic position unavailable`,
        sourceView: 'breadboard',
        targetView: 'schematic',
      });
      continue;
    }

    result.wiresToCreate.push({
      netId: wire.netId,
      view: 'schematic',
      points: [fromPx, toPx],
      provenance: 'synced',
    });
  }

  // Identify schematic nets that have no corresponding breadboard wires.
  // These represent connections the user has defined in the schematic but
  // not yet wired on the breadboard. We report them as informational
  // conflicts (not deletions) — the schematic is typically the source of
  // truth, so we don't delete schematic-only connections.
  const bbConnectionSigs = buildBreadboardConnectionSet(breadboardWires, instanceMap, partsMap);

  for (const net of existingNets) {
    if (accountedNetIds.has(net.id)) continue;

    const segments = extractSegments(net);
    for (const seg of segments) {
      const sig = segmentSignature(seg);
      if (!bbConnectionSigs.has(sig)) {
        // Check if both instances even have breadboard placement
        const inst1 = instanceMap.get(seg.fromInstanceId);
        const inst2 = instanceMap.get(seg.toInstanceId);
        const bothPlaced =
          inst1?.breadboardX != null &&
          inst1?.breadboardY != null &&
          inst2?.breadboardX != null &&
          inst2?.breadboardY != null;

        if (bothPlaced) {
          result.conflicts.push({
            netId: net.id,
            netName: net.name,
            description:
              `Schematic net "${net.name}" segment ` +
              `${seg.fromInstanceId}:${seg.fromPin} -> ${seg.toInstanceId}:${seg.toPin} ` +
              `has no corresponding breadboard wire`,
            sourceView: 'breadboard',
            targetView: 'schematic',
          });
        }
      }
    }
  }

  return result;
}

// ===========================================================================
// detectConflicts
// ===========================================================================

/**
 * Standalone conflict detection — compares schematic nets against
 * breadboard wires and reports any mismatches without attempting resolution.
 *
 * This is useful for UI indicators ("3 sync conflicts") without triggering
 * any create/delete operations.
 *
 * @param nets       All circuit nets
 * @param wires      All circuit wires
 * @param instances  All circuit instances
 * @param partsMap   Optional map of partId -> ComponentPart for pin resolution
 */
export function detectConflicts(
  nets: CircuitNetRow[],
  wires: CircuitWireRow[],
  instances?: CircuitInstanceRow[],
  partsMap?: Map<number, ComponentPart>,
): SyncConflict[] {
  const conflicts: SyncConflict[] = [];

  const insts = instances ?? [];
  const instanceMap = buildInstanceMap(insts);
  const breadboardWires = wires.filter((w) => w.view === 'breadboard');

  // --- Check 1: Net has schematic segments but no breadboard wires ---

  const netIdToBBWires = new Map<number, CircuitWireRow[]>();
  for (const wire of breadboardWires) {
    const list = netIdToBBWires.get(wire.netId) ?? [];
    list.push(wire);
    netIdToBBWires.set(wire.netId, list);
  }

  for (const net of nets) {
    const segments = extractSegments(net);
    if (segments.length === 0) continue;

    const bbWires = netIdToBBWires.get(net.id) ?? [];
    if (bbWires.length === 0) {
      // Check if any instances involved are placed on the breadboard
      const involvedInstanceIds = new Set<number>();
      for (const seg of segments) {
        involvedInstanceIds.add(seg.fromInstanceId);
        involvedInstanceIds.add(seg.toInstanceId);
      }

      const anyPlaced = Array.from(involvedInstanceIds).some((id) => {
        const inst = instanceMap.get(id);
        return inst?.breadboardX != null && inst?.breadboardY != null;
      });

      if (anyPlaced) {
        conflicts.push({
          netId: net.id,
          netName: net.name,
          description:
            `Net "${net.name}" has ${segments.length} schematic segment(s) ` +
            `but no breadboard wires`,
          sourceView: 'schematic',
          targetView: 'breadboard',
        });
      }
    }
  }

  // --- Check 2: Breadboard wires referencing non-existent nets ---

  const netIdSet = new Set(nets.map((n) => n.id));

  for (const wire of breadboardWires) {
    if (!netIdSet.has(wire.netId)) {
      conflicts.push({
        netId: wire.netId,
        netName: `net-${wire.netId}`,
        description:
          `Breadboard wire ${wire.id} references net ${wire.netId} ` +
          `which does not exist in the schematic`,
        sourceView: 'breadboard',
        targetView: 'schematic',
      });
    }
  }

  // --- Check 3: Segment-level mismatch (schematic has it, breadboard doesn't) ---

  if (insts.length > 0) {
    const bbSigs = buildBreadboardConnectionSet(breadboardWires, instanceMap, partsMap);

    for (const net of nets) {
      const segments = extractSegments(net);
      const bbWires = netIdToBBWires.get(net.id) ?? [];

      // Only check if the net has breadboard wires at all (otherwise
      // Check 1 already caught it at the net level)
      if (bbWires.length === 0) continue;

      for (const seg of segments) {
        const sig = segmentSignature(seg);
        if (!bbSigs.has(sig)) {
          // Both instances must be placed for this to be a real mismatch
          const inst1 = instanceMap.get(seg.fromInstanceId);
          const inst2 = instanceMap.get(seg.toInstanceId);
          if (
            inst1?.breadboardX != null &&
            inst1?.breadboardY != null &&
            inst2?.breadboardX != null &&
            inst2?.breadboardY != null
          ) {
            conflicts.push({
              netId: net.id,
              netName: net.name,
              description:
                `Schematic segment ${seg.fromInstanceId}:${seg.fromPin} -> ` +
                `${seg.toInstanceId}:${seg.toPin} on net "${net.name}" ` +
                `is missing from the breadboard`,
              sourceView: 'schematic',
              targetView: 'breadboard',
            });
          }
        }
      }
    }
  }

  // --- Check 4: Breadboard wire that doesn't match any schematic segment ---

  if (insts.length > 0) {
    const schematicSigs = new Set<string>();
    for (const net of nets) {
      for (const seg of extractSegments(net)) {
        schematicSigs.add(segmentSignature(seg));
      }
    }

    for (const wire of breadboardWires) {
      if (!netIdSet.has(wire.netId)) continue; // Already flagged in Check 2

      const { from, to } = resolveWireEndpoints(wire, instanceMap, partsMap);
      if (!from || !to) continue;
      if (from.pinId == null || to.pinId == null || from.pinId === '' || to.pinId === '') {
        // Silently-dropped wire visibility (audit #371). Empty-string pinId
        // typically means a part lacks proper connector definitions — worth
        // surfacing so the data issue is debuggable.
        // eslint-disable-next-line no-console
        console.warn(
          '[view-sync] dropping wire %s: empty endpoint pinId. from=%s to=%s',
          String(wire.id),
          `${from.instanceId}:${from.pinId ?? '<null>'}`,
          `${to.instanceId}:${to.pinId ?? '<null>'}`,
        );
        continue;
      }

      const a = `${from.instanceId}:${from.pinId}`;
      const b = `${to.instanceId}:${to.pinId}`;
      const sig = a < b ? `${a}<>${b}` : `${b}<>${a}`;

      if (!schematicSigs.has(sig)) {
        const net = nets.find((n) => n.id === wire.netId);
        conflicts.push({
          netId: wire.netId,
          netName: net?.name ?? `net-${wire.netId}`,
          description:
            `Breadboard wire ${wire.id} on net "${net?.name ?? wire.netId}" ` +
            `connects ${a} <-> ${b} which has no matching schematic segment`,
          sourceView: 'breadboard',
          targetView: 'schematic',
        });
      }
    }
  }

  return conflicts;
}
