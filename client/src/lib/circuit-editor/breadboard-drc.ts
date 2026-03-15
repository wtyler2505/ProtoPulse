/**
 * BL-0544: Breadboard DRC (Design Rule Check) engine.
 *
 * Analyzes a breadboard layout for common wiring and placement errors:
 *   - Short circuits: two different nets on the same internally-connected row
 *   - Unconnected pins: component pins that don't connect to any wire/net
 *   - Power rail polarity: positive rail wired to GND or negative rail wired to VCC
 *   - Floating components: placed components with zero net connections
 *   - Bus conflicts: multiple nets driving the same bus row (more than 2 nets)
 *
 * Pure logic — no React, no DOM. Returns violation descriptors consumed by
 * the BreadboardDrcOverlay SVG component.
 */

import {
  BB,
  coordKey,
  coordToPixel,
  pixelToCoord,
  getConnectedPoints,
  type BreadboardCoord,
  type ColumnLetter,
  type TiePoint,
  type RailPoint,
  type PixelPos,
} from './breadboard-model';
import type { CircuitNetRow, CircuitWireRow, CircuitInstanceRow, ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity of a breadboard DRC violation */
export type BreadboardDrcSeverity = 'error' | 'warning';

/** Violation types */
export type BreadboardDrcViolationType =
  | 'short_circuit'
  | 'unconnected_pin'
  | 'power_rail_polarity'
  | 'floating_component'
  | 'bus_conflict';

/** A single DRC violation */
export interface BreadboardDrcViolation {
  /** Unique violation type */
  type: BreadboardDrcViolationType;
  /** Error or warning */
  severity: BreadboardDrcSeverity;
  /** Human-readable message */
  message: string;
  /** Board coordinate where the violation occurs */
  coord: BreadboardCoord;
  /** Pixel position for SVG overlay rendering */
  pixel: PixelPos;
  /** Net IDs involved (for short circuits / bus conflicts) */
  netIds?: number[];
  /** Instance ID involved (for floating / unconnected) */
  instanceId?: number;
}

/** Result of a full breadboard DRC run */
export interface BreadboardDrcResult {
  violations: BreadboardDrcViolation[];
  errorCount: number;
  warningCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Classify net name as power, ground, or signal */
function classifyNetName(name: string): 'power' | 'ground' | 'signal' {
  const upper = name.toUpperCase().trim();
  const powerNames = ['VCC', 'VDD', '5V', '3V3', '3.3V', '12V', '9V', 'VBAT', 'VIN', 'VBUS', 'V+'];
  const groundNames = ['GND', 'VSS', 'AGND', 'DGND', 'GND0', 'PGND', 'V-'];
  if (powerNames.includes(upper)) { return 'power'; }
  if (groundNames.includes(upper)) { return 'ground'; }
  if (/^\+?\d+\.?\d*V$/i.test(upper)) { return 'power'; }
  return 'signal';
}

/**
 * Get a connectivity group key for a breadboard coordinate.
 * All holes in the same connectivity group are electrically connected
 * through the breadboard's internal wiring.
 *
 * Terminal strips: "left:<row>" or "right:<row>"
 * Rails: the rail ID itself (entire rail is one group)
 */
function connectivityGroupKey(coord: BreadboardCoord): string {
  if (coord.type === 'rail') {
    return `rail:${coord.rail}`;
  }
  const colIdx = BB.ALL_COLS.indexOf(coord.col as typeof BB.ALL_COLS[number]);
  const side = colIdx < 5 ? 'left' : 'right';
  return `${side}:${coord.row}`;
}

// ---------------------------------------------------------------------------
// Core DRC analysis
// ---------------------------------------------------------------------------

/**
 * Run a full breadboard DRC analysis.
 *
 * @param nets       Circuit nets
 * @param wires      All circuit wires (will be filtered to breadboard view)
 * @param instances  Circuit instances with breadboard placement
 * @param parts      Component parts (for pin count resolution)
 * @returns          DRC result with all violations
 */
export function runBreadboardDrc(
  nets: CircuitNetRow[],
  wires: CircuitWireRow[],
  instances: CircuitInstanceRow[],
  parts: ComponentPart[],
): BreadboardDrcResult {
  const violations: BreadboardDrcViolation[] = [];

  // Filter to breadboard wires only
  const bbWires = wires.filter(w => w.view === 'breadboard');

  // Build net name lookup
  const netNameById = new Map<number, string>();
  for (const net of nets) {
    netNameById.set(net.id, net.name);
  }

  // Build parts lookup
  const partsById = new Map<number, ComponentPart>();
  for (const part of parts) {
    partsById.set(part.id, part);
  }

  // Step 1: Build a map of connectivity-group → set of net IDs
  // This tells us which nets touch each breadboard row/rail group
  const groupNets = new Map<string, Set<number>>();
  // Also track per-hole → netId for pin checking
  const holeNetMap = new Map<string, number>();

  for (const wire of bbWires) {
    const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
    for (const pt of pts) {
      const coord = pixelToCoord(pt);
      if (!coord) { continue; }

      // Assign net to this hole
      const key = coordKey(coord);
      if (!holeNetMap.has(key)) {
        holeNetMap.set(key, wire.netId);
      }

      // Track net in the connectivity group
      const gk = connectivityGroupKey(coord);
      let netSet = groupNets.get(gk);
      if (!netSet) {
        netSet = new Set<number>();
        groupNets.set(gk, netSet);
      }
      netSet.add(wire.netId);

      // Expand through internal connectivity — all connected holes share the net
      const connected = getConnectedPoints(coord);
      for (const connCoord of connected) {
        const connKey = coordKey(connCoord);
        if (!holeNetMap.has(connKey)) {
          holeNetMap.set(connKey, wire.netId);
        }
      }
    }
  }

  // Step 2: Short circuit detection
  // If a connectivity group has more than one net, it's a short circuit
  for (const [gk, netSet] of Array.from(groupNets.entries())) {
    if (netSet.size < 2) { continue; }

    const netIds = Array.from(netSet);
    const netNames = netIds.map(id => netNameById.get(id) ?? `net${id}`);

    // Find a representative coordinate for this group
    const coord = parseGroupKey(gk);
    if (!coord) { continue; }

    violations.push({
      type: 'short_circuit',
      severity: 'error',
      message: `Short circuit: nets ${netNames.join(', ')} share row ${formatGroupKey(gk)}`,
      coord,
      pixel: coordToPixel(coord),
      netIds,
    });
  }

  // Step 3: Bus conflict detection
  // A bus conflict is when 3+ nets share the same row (more severe than a simple short)
  for (const [gk, netSet] of Array.from(groupNets.entries())) {
    if (netSet.size < 3) { continue; }

    const netIds = Array.from(netSet);
    const netNames = netIds.map(id => netNameById.get(id) ?? `net${id}`);

    const coord = parseGroupKey(gk);
    if (!coord) { continue; }

    violations.push({
      type: 'bus_conflict',
      severity: 'error',
      message: `Bus conflict: ${netSet.size} nets (${netNames.join(', ')}) on ${formatGroupKey(gk)}`,
      coord,
      pixel: coordToPixel(coord),
      netIds,
    });
  }

  // Step 4: Power rail polarity check
  for (const wire of bbWires) {
    const netName = netNameById.get(wire.netId);
    if (!netName) { continue; }
    const netClass = classifyNetName(netName);

    const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
    for (const pt of pts) {
      const coord = pixelToCoord(pt);
      if (!coord || coord.type !== 'rail') { continue; }

      const isPositiveRail = coord.rail.endsWith('pos');
      const isNegativeRail = coord.rail.endsWith('neg');

      // Power net on negative rail = polarity error
      if (netClass === 'power' && isNegativeRail) {
        violations.push({
          type: 'power_rail_polarity',
          severity: 'error',
          message: `Power net "${netName}" connected to negative rail (${coord.rail})`,
          coord,
          pixel: coordToPixel(coord),
          netIds: [wire.netId],
        });
      }

      // Ground net on positive rail = polarity error
      if (netClass === 'ground' && isPositiveRail) {
        violations.push({
          type: 'power_rail_polarity',
          severity: 'error',
          message: `Ground net "${netName}" connected to positive rail (${coord.rail})`,
          coord,
          pixel: coordToPixel(coord),
          netIds: [wire.netId],
        });
      }
    }
  }

  // Step 5: Floating components and unconnected pins
  const placedInstances = instances.filter(
    inst => inst.breadboardX != null && inst.breadboardY != null,
  );

  for (const inst of placedInstances) {
    const instCoord = pixelToCoord({ x: inst.breadboardX!, y: inst.breadboardY! });
    if (!instCoord || instCoord.type !== 'terminal') { continue; }

    const part = inst.partId ? partsById.get(inst.partId) : undefined;
    const pinCount = (part?.connectors as unknown[])?.length ?? 2;
    const compType = ((part?.meta as Record<string, unknown>)?.type as string)?.toLowerCase()
      ?? ((inst.properties as Record<string, unknown>)?.type as string)?.toLowerCase()
      ?? 'generic';

    const isDIP = compType === 'ic' || compType === 'mcu';
    const rowSpan = isDIP ? Math.ceil(pinCount / 2) : Math.max(1, Math.ceil(pinCount / 2));

    // Compute all pin positions
    const pinCoords: TiePoint[] = [];
    if (isDIP) {
      for (let r = 0; r < rowSpan; r++) {
        pinCoords.push({ type: 'terminal', col: 'e' as ColumnLetter, row: instCoord.row + r });
        pinCoords.push({ type: 'terminal', col: 'f' as ColumnLetter, row: instCoord.row + r });
      }
    } else {
      // Non-DIP: pins go down a single column
      for (let r = 0; r < rowSpan; r++) {
        pinCoords.push({ type: 'terminal', col: instCoord.col, row: instCoord.row + r });
      }
    }

    // Check how many pins are connected to a net
    let connectedPinCount = 0;
    const unconnectedPins: TiePoint[] = [];

    for (const pin of pinCoords) {
      if (pin.row < 1 || pin.row > BB.ROWS) { continue; }

      // A pin is "connected" if any hole in its connectivity group has a net
      const gk = connectivityGroupKey(pin);
      if (groupNets.has(gk)) {
        connectedPinCount++;
      } else {
        unconnectedPins.push(pin);
      }
    }

    // Floating component: zero pins connected
    if (connectedPinCount === 0 && pinCoords.length > 0) {
      violations.push({
        type: 'floating_component',
        severity: 'warning',
        message: `Floating component: ${inst.referenceDesignator} has no net connections`,
        coord: instCoord,
        pixel: coordToPixel(instCoord),
        instanceId: inst.id,
      });
    }

    // Unconnected pins (only report if component has some connections but not all)
    if (connectedPinCount > 0 && unconnectedPins.length > 0) {
      for (const pin of unconnectedPins) {
        violations.push({
          type: 'unconnected_pin',
          severity: 'warning',
          message: `Unconnected pin: ${inst.referenceDesignator} pin at ${pin.col}${pin.row}`,
          coord: pin,
          pixel: coordToPixel(pin),
          instanceId: inst.id,
        });
      }
    }
  }

  // Compute summary counts
  let errorCount = 0;
  let warningCount = 0;
  for (const v of violations) {
    if (v.severity === 'error') { errorCount++; }
    else { warningCount++; }
  }

  return { violations, errorCount, warningCount };
}

// ---------------------------------------------------------------------------
// Group key parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a connectivity group key back to a representative BreadboardCoord.
 */
function parseGroupKey(gk: string): BreadboardCoord | null {
  if (gk.startsWith('rail:')) {
    const railId = gk.slice(5) as RailPoint['rail'];
    return { type: 'rail', rail: railId, index: 0 };
  }
  const match = /^(left|right):(\d+)$/.exec(gk);
  if (!match) { return null; }
  const side = match[1];
  const row = parseInt(match[2], 10);
  const col: ColumnLetter = side === 'left' ? 'a' : 'f';
  return { type: 'terminal', col, row };
}

/**
 * Format a connectivity group key for display in violation messages.
 */
function formatGroupKey(gk: string): string {
  if (gk.startsWith('rail:')) {
    return gk.slice(5);
  }
  const match = /^(left|right):(\d+)$/.exec(gk);
  if (!match) { return gk; }
  const side = match[1];
  const row = match[2];
  return `${side} row ${row}`;
}
