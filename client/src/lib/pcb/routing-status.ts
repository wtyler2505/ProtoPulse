/**
 * routing-status.ts — Calculate PCB routing completion status.
 *
 * Compares circuit nets against routed PCB wires to determine
 * how many connections are routed vs unrouted.
 *
 * Pure functions, no React/DOM dependencies.
 */

import type { CircuitNetRow, CircuitWireRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-net routing completion info. */
export interface NetRoutingInfo {
  netId: number;
  netName: string;
  routed: boolean;
}

/** Overall routing status summary. */
export interface RoutingStatus {
  /** Total number of nets that need routing. */
  total: number;
  /** Number of nets with at least one PCB wire. */
  routed: number;
  /** Number of nets with no PCB wires. */
  unrouted: number;
  /** Completion percentage (0-100). */
  percentComplete: number;
  /** Per-net routing info keyed by net ID. */
  perNet: Map<number, NetRoutingInfo>;
}

// ---------------------------------------------------------------------------
// calculateRoutingStatus
// ---------------------------------------------------------------------------

/**
 * Calculate routing completion status by comparing nets to PCB wires.
 *
 * A net is considered "routed" if at least one wire with `view === 'pcb'`
 * references it. Nets with no PCB wires are "unrouted".
 *
 * @param nets - All circuit nets for the design.
 * @param wires - All circuit wires for the design.
 * @returns Routing status summary with per-net breakdown.
 */
export function calculateRoutingStatus(
  nets: CircuitNetRow[],
  wires: CircuitWireRow[],
): RoutingStatus {
  // Build set of net IDs that have at least one PCB wire
  const routedNetIds = new Set<number>();
  for (const wire of wires) {
    if (wire.view === 'pcb' && wire.netId != null) {
      routedNetIds.add(wire.netId);
    }
  }

  const perNet = new Map<number, NetRoutingInfo>();

  for (const net of nets) {
    const routed = routedNetIds.has(net.id);
    perNet.set(net.id, {
      netId: net.id,
      netName: net.name,
      routed,
    });
  }

  const total = nets.length;
  const routed = routedNetIds.size > total ? total : routedNetIds.size;
  const unrouted = total - routed;
  const percentComplete = total === 0 ? 100 : Math.round((routed / total) * 100);

  return {
    total,
    routed,
    unrouted,
    percentComplete,
    perNet,
  };
}
