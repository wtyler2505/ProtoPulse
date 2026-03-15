/**
 * BL-0542: Breadboard connectivity analysis.
 *
 * Analyzes which breadboard rows/columns share electrical connections
 * based on placed component pins, wires, and the breadboard's internal
 * tie-point connectivity rules. Produces a per-hole net assignment map
 * that the BreadboardConnectivityOverlay uses to color holes.
 */

import {
  BB,
  coordKey,
  coordToPixel,
  getConnectedPoints,
  pixelToCoord,
  type BreadboardCoord,
  type ColumnLetter,
  type RailId,
  type TiePoint,
  type RailPoint,
  type PixelPos,
} from './breadboard-model';
import type { CircuitNetRow, CircuitWireRow, CircuitInstanceRow } from '@shared/schema';
import type { ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Classification of a net for color-coding purposes */
export type NetType = 'power' | 'ground' | 'signal';

/** A single hole with its assigned net info for overlay rendering */
export interface ConnectedHole {
  coord: BreadboardCoord;
  pixel: PixelPos;
  netId: number;
  netName: string;
  netType: NetType;
  color: string;
}

/** The full connectivity map result */
export interface ConnectivityMap {
  /** All holes with net assignments, keyed by coordKey */
  holes: Map<string, ConnectedHole>;
  /** Unique nets found on the board */
  nets: Map<number, { name: string; type: NetType; color: string }>;
}

// ---------------------------------------------------------------------------
// Net type classification
// ---------------------------------------------------------------------------

const POWER_NAMES = new Set(['VCC', 'VDD', '5V', '3V3', '3.3V', '12V', '9V', 'VBAT', 'VIN', 'VBUS', 'V+']);
const GROUND_NAMES = new Set(['GND', 'VSS', 'AGND', 'DGND', 'GND0', 'PGND', 'V-']);

/**
 * Classify a net name into power, ground, or signal.
 */
export function classifyNet(name: string): NetType {
  const upper = name.toUpperCase().trim();
  if (POWER_NAMES.has(upper)) { return 'power'; }
  if (GROUND_NAMES.has(upper)) { return 'ground'; }
  // Also match patterns like "+5V", "+3.3V"
  if (/^\+?\d+\.?\d*V$/i.test(upper)) { return 'power'; }
  return 'signal';
}

// ---------------------------------------------------------------------------
// Signal color palette (deterministic hash-based)
// ---------------------------------------------------------------------------

const SIGNAL_COLORS = [
  '#00F0FF', // cyan (primary theme color)
  '#f59e0b', // amber
  '#a855f7', // purple
  '#22c55e', // green
  '#ec4899', // pink
  '#06b6d4', // sky
  '#f97316', // orange
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#eab308', // yellow
] as const;

/** Simple djb2 hash for deterministic color assignment */
function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Get a deterministic color for a net based on its type and name.
 */
export function getNetColor(name: string, type: NetType): string {
  if (type === 'power') { return '#ef4444'; } // red
  if (type === 'ground') { return '#1a1a2e'; } // black/dark
  return SIGNAL_COLORS[hashString(name) % SIGNAL_COLORS.length];
}

// ---------------------------------------------------------------------------
// Core analysis: build the connectivity map
// ---------------------------------------------------------------------------

/**
 * Build the connectivity map for a breadboard circuit.
 *
 * Walks every wire endpoint and component pin placement to determine
 * which holes belong to which net. Then expands each hole through the
 * breadboard's internal connectivity (same-row left/right group, or
 * same rail) to produce the full overlay map.
 *
 * @param nets      Circuit nets (provide name/id)
 * @param wires     Circuit wires (breadboard view only)
 * @param instances Circuit instances with breadboard placement
 * @param parts     Component parts (for pin info)
 */
export function buildConnectivityMap(
  nets: CircuitNetRow[],
  wires: CircuitWireRow[],
  instances: CircuitInstanceRow[],
  _parts: ComponentPart[],
): ConnectivityMap {
  const holes = new Map<string, ConnectedHole>();
  const netMap = new Map<number, { name: string; type: NetType; color: string }>();

  // Pre-build net info lookup
  for (const net of nets) {
    const type = classifyNet(net.name);
    const color = getNetColor(net.name, type);
    netMap.set(net.id, { name: net.name, type, color });
  }

  // Phase 1: Collect seed holes from wire endpoints
  const seedHoles = new Map<string, { coord: BreadboardCoord; netId: number }>();

  for (const wire of wires) {
    if (wire.view !== 'breadboard') { continue; }
    const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
    for (const pt of pts) {
      const coord = pixelToCoord(pt);
      if (!coord) { continue; }
      const key = coordKey(coord);
      // First-come wins for net assignment at a given hole
      if (!seedHoles.has(key)) {
        seedHoles.set(key, { coord, netId: wire.netId });
      }
    }
  }

  // Phase 2: Collect seed holes from component instance placements
  // Each instance placed on the breadboard occupies specific holes.
  // If the instance participates in a net (via wire connections), its
  // placement hole is assigned to that net.
  for (const inst of instances) {
    if (inst.breadboardX == null || inst.breadboardY == null) { continue; }
    const coord = pixelToCoord({ x: inst.breadboardX, y: inst.breadboardY });
    if (!coord) { continue; }

    // Find any net this instance belongs to by checking wire endpoints
    // that are close to this instance's position
    const key = coordKey(coord);
    // If this hole already has a net from wires, keep it
    if (seedHoles.has(key)) { continue; }

    // Check if any wire endpoint is at this position
    for (const wire of wires) {
      if (wire.view !== 'breadboard') { continue; }
      const wirePts = (wire.points as Array<{ x: number; y: number }>) ?? [];
      for (const pt of wirePts) {
        const wireCoord = pixelToCoord(pt);
        if (wireCoord && coordKey(wireCoord) === key) {
          seedHoles.set(key, { coord, netId: wire.netId });
          break;
        }
      }
      if (seedHoles.has(key)) { break; }
    }
  }

  // Phase 3: Expand each seed hole through breadboard internal connectivity
  for (const [_key, seed] of Array.from(seedHoles.entries())) {
    const netInfo = netMap.get(seed.netId);
    if (!netInfo) { continue; }

    const connected = getConnectedPoints(seed.coord);
    for (const connCoord of connected) {
      const connKey = coordKey(connCoord);
      // Don't overwrite an existing assignment (first net wins)
      if (holes.has(connKey)) { continue; }

      holes.set(connKey, {
        coord: connCoord,
        pixel: coordToPixel(connCoord),
        netId: seed.netId,
        netName: netInfo.name,
        netType: netInfo.type,
        color: netInfo.color,
      });
    }
  }

  return { holes, nets: netMap };
}

// ---------------------------------------------------------------------------
// Helpers for the overlay component
// ---------------------------------------------------------------------------

/**
 * Group connected holes by their net ID for batch rendering.
 */
export function groupHolesByNet(map: ConnectivityMap): Map<number, ConnectedHole[]> {
  const groups = new Map<number, ConnectedHole[]>();
  for (const hole of map.holes.values()) {
    let group = groups.get(hole.netId);
    if (!group) {
      group = [];
      groups.set(hole.netId, group);
    }
    group.push(hole);
  }
  return groups;
}

/**
 * Get a unique, compact label for a BreadboardCoord.
 */
export function getCoordLabel(coord: BreadboardCoord): string {
  if (coord.type === 'terminal') {
    return `${coord.col}${coord.row}`;
  }
  return `${coord.rail}[${coord.index}]`;
}
