/**
 * ComponentPlacer — Component placement logic, position validation,
 * and ratsnest network construction for the PCB layout canvas.
 *
 * Pure functions — no React, no side effects.
 */

import type { CircuitInstanceRow } from '@shared/schema';
import type { RatsnestNet, RatsnestPin } from '@/components/circuit-editor/RatsnestOverlay';
import { WIRE_COLORS } from './LayerManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A net segment as stored in the database JSON. */
export interface NetSegment {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
}

/** Minimal net shape needed for ratsnest construction. */
export interface NetRecord {
  id: number;
  name: string;
  segments: unknown;
}

// ---------------------------------------------------------------------------
// Ratsnest construction
// ---------------------------------------------------------------------------

/**
 * Build ratsnest net data from circuit nets and placed instances.
 *
 * Extracts pin positions from instances that have PCB coordinates,
 * and maps each net's segments to pin pairs for rendering the
 * unrouted connection overlay.
 */
export function buildRatsnestNets(
  nets: NetRecord[],
  instances: CircuitInstanceRow[],
): RatsnestNet[] {
  return nets.map((net, idx) => {
    const pins: RatsnestPin[] = [];
    const segments = (net.segments ?? []) as NetSegment[];

    for (const seg of segments) {
      const fromInst = instances.find((i) => i.id === seg.fromInstanceId);
      const toInst = instances.find((i) => i.id === seg.toInstanceId);

      if (fromInst?.pcbX != null && fromInst?.pcbY != null) {
        pins.push({
          instanceId: fromInst.id,
          pinId: seg.fromPin,
          x: fromInst.pcbX,
          y: fromInst.pcbY,
        });
      }

      if (toInst?.pcbX != null && toInst?.pcbY != null) {
        pins.push({
          instanceId: toInst.id,
          pinId: seg.toPin,
          x: toInst.pcbX,
          y: toInst.pcbY,
        });
      }
    }

    return {
      netId: net.id,
      name: net.name,
      color: WIRE_COLORS[idx % WIRE_COLORS.length],
      pins,
      routedPairs: new Set<string>(),
    };
  });
}

// ---------------------------------------------------------------------------
// Placement validation
// ---------------------------------------------------------------------------

/**
 * Check whether an instance has been placed on the PCB (has pcb coordinates).
 */
export function isInstancePlaced(instance: CircuitInstanceRow): boolean {
  return instance.pcbX != null && instance.pcbY != null;
}

/**
 * Count the number of placed instances (those with PCB coordinates).
 */
export function countPlacedInstances(instances: CircuitInstanceRow[]): number {
  return instances.filter(isInstancePlaced).length;
}

/**
 * Determine the footprint color fill based on the component's PCB side.
 */
export function footprintFill(side: string | null): string {
  return side === 'back' ? '#2563eb20' : '#dc262620';
}

/**
 * Determine the footprint stroke color based on selection state and PCB side.
 */
export function footprintStroke(side: string | null, isSelected: boolean): string {
  if (isSelected) {
    return '#facc15';
  }
  return side === 'back' ? '#3b82f6' : '#ef4444';
}

/**
 * Determine the footprint stroke width based on selection state.
 */
export function footprintStrokeWidth(isSelected: boolean): number {
  return isSelected ? 0.8 : 0.4;
}
