/**
 * ComponentPlacer — Component placement logic, position validation,
 * and ratsnest network construction for the PCB layout canvas.
 *
 * Pure functions — no React, no side effects.
 */

import type { CircuitInstanceRow } from '@shared/schema';
import type { RatsnestNet, RatsnestPin } from '@/components/circuit-editor/RatsnestOverlay';
import { WIRE_COLORS } from './LayerManager';
import { FootprintLibrary } from '@/lib/pcb/footprint-library';

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
/**
 * Resolve a pin's absolute board position for an instance.
 * If a footprint is available, maps the pin number to the pad's position
 * offset from the instance origin. Falls back to the component center.
 */
function resolvePinPosition(
  inst: CircuitInstanceRow,
  pinId: string,
): { x: number; y: number } {
  const instX = inst.pcbX ?? 0;
  const instY = inst.pcbY ?? 0;
  const rotation = inst.pcbRotation ?? 0;

  const props = (inst.properties ?? {}) as Record<string, unknown>;
  const packageType = (props.packageType as string) ?? null;

  if (packageType) {
    const fp = FootprintLibrary.getFootprint(packageType);
    if (fp) {
      const padNum = parseInt(pinId, 10);
      const pad = fp.pads.find((p) => p.number === padNum);
      if (pad) {
        // Apply rotation to pad offset
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = pad.position.x * cos - pad.position.y * sin;
        const ry = pad.position.x * sin + pad.position.y * cos;
        return { x: instX + rx, y: instY + ry };
      }
    }
  }

  return { x: instX, y: instY };
}

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
        const pos = resolvePinPosition(fromInst, seg.fromPin);
        pins.push({
          instanceId: fromInst.id,
          pinId: seg.fromPin,
          x: pos.x,
          y: pos.y,
        });
      }

      if (toInst?.pcbX != null && toInst?.pcbY != null) {
        const pos = resolvePinPosition(toInst, seg.toPin);
        pins.push({
          instanceId: toInst.id,
          pinId: seg.toPin,
          x: pos.x,
          y: pos.y,
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

// ---------------------------------------------------------------------------
// Footprint-aware placement helpers
// ---------------------------------------------------------------------------

/** Default fallback bounding box when no footprint is available (8x12 placeholder). */
const DEFAULT_BOUNDING_BOX = { x: -4, y: -6, width: 8, height: 12 };

/**
 * Get the bounding box for an instance's footprint.
 * Looks up real footprint geometry from FootprintLibrary; falls back to 8x12 placeholder.
 */
export function getFootprintBoundingBox(instance: CircuitInstanceRow): { x: number; y: number; width: number; height: number } {
  const props = (instance.properties ?? {}) as Record<string, unknown>;
  const packageType = (props.packageType as string) ?? null;

  if (packageType) {
    const fp = FootprintLibrary.getFootprint(packageType);
    if (fp) {
      return { ...fp.courtyard };
    }
  }

  return { ...DEFAULT_BOUNDING_BOX };
}

/**
 * Check whether an instance's courtyard overlaps any other placed instance's courtyard.
 * Uses AABB overlap check. Excludes self from collision check.
 */
export function checkCourtyardCollision(
  instance: CircuitInstanceRow,
  allInstances: CircuitInstanceRow[],
): boolean {
  if (instance.pcbX == null || instance.pcbY == null) {
    return false;
  }

  const bb = getFootprintBoundingBox(instance);
  const ax1 = instance.pcbX + bb.x;
  const ay1 = instance.pcbY + bb.y;
  const ax2 = ax1 + bb.width;
  const ay2 = ay1 + bb.height;

  for (const other of allInstances) {
    if (other.id === instance.id || other.pcbX == null || other.pcbY == null) {
      continue;
    }

    const obb = getFootprintBoundingBox(other);
    const bx1 = other.pcbX + obb.x;
    const by1 = other.pcbY + obb.y;
    const bx2 = bx1 + obb.width;
    const by2 = by1 + obb.height;

    // AABB overlap check
    if (ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1) {
      return true;
    }
  }

  return false;
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
