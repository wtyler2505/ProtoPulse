// =============================================================================
// Gerber Pad Geometry Resolution
// =============================================================================

import { rotatePoint } from './coordinates';
import type { GerberConnector, GerberInstance, ResolvedPad } from './types';
import {
  DEFAULT_BODY_HEIGHT,
  DEFAULT_BODY_WIDTH,
  DEFAULT_SMD_PAD_HEIGHT,
  DEFAULT_SMD_PAD_WIDTH,
  DEFAULT_THT_DRILL,
  DEFAULT_THT_PAD_HEIGHT,
  DEFAULT_THT_PAD_WIDTH,
} from './types';

/**
 * Determine whether a connector is THT based on explicit padType
 * or footprint heuristic.
 */
export function determinePadType(connector: GerberConnector, footprint: string): 'tht' | 'smd' {
  if (connector.padType === 'tht') return 'tht';
  if (connector.padType === 'smd') return 'smd';
  // No explicit type: infer from footprint
  return isSmallPitch(footprint) ? 'smd' : 'tht';
}

/**
 * Determine pad dimensions (width, height, drill) based on pad type
 * and any explicit connector overrides.
 */
export function determinePadDimensions(
  connector: GerberConnector,
  padType: 'tht' | 'smd',
): { width: number; height: number; drill: number } {
  const isTht = padType === 'tht';
  return {
    width: connector.padWidth ?? (isTht ? DEFAULT_THT_PAD_WIDTH : DEFAULT_SMD_PAD_WIDTH),
    height: connector.padHeight ?? (isTht ? DEFAULT_THT_PAD_HEIGHT : DEFAULT_SMD_PAD_HEIGHT),
    drill: isTht ? (connector.drill ?? DEFAULT_THT_DRILL) : 0,
  };
}

/**
 * Determine pad shape. Explicit padShape takes priority. Otherwise:
 * - THT pin 1 → square, other THT → circle
 * - SMD → rect
 */
export function determinePadShape(
  connector: GerberConnector,
  padType: 'tht' | 'smd',
  connectorIndex: number,
): 'circle' | 'rect' | 'oblong' | 'square' {
  if (connector.padShape) {
    return connector.padShape as 'circle' | 'rect' | 'oblong' | 'square';
  }
  if (padType === 'tht') {
    return connectorIndex === 0 ? 'square' : 'circle';
  }
  return 'rect';
}

/**
 * Calculate the local (pre-rotation) offset of a connector relative
 * to its instance center. Uses explicit offsets when provided, otherwise
 * auto-distributes connectors in a DIP-like layout.
 */
export function calculateConnectorOffset(
  connector: GerberConnector,
  connectorIndex: number,
  totalConnectors: number,
  bodyWidth: number,
  bodyHeight: number,
): { x: number; y: number } {
  if (connector.offsetX !== undefined && connector.offsetY !== undefined) {
    return { x: connector.offsetX, y: connector.offsetY };
  }

  // Auto-layout: distribute connectors evenly.
  // For DIP-like packages, split connectors between two sides.
  const half = Math.ceil(totalConnectors / 2);

  if (connectorIndex < half) {
    // Left side / top row
    const step = half > 1 ? bodyHeight / (half - 1) : 0;
    return {
      x: -bodyWidth / 2,
      y: -bodyHeight / 2 + step * connectorIndex,
    };
  }

  // Right side / bottom row
  const idx = connectorIndex - half;
  const rightCount = totalConnectors - half;
  const step = rightCount > 1 ? bodyHeight / (rightCount - 1) : 0;
  return {
    x: bodyWidth / 2,
    y: bodyHeight / 2 - step * idx,
  };
}

/**
 * Resolve a connector to its absolute pad position and dimensions,
 * accounting for instance position, rotation, and side.
 */
export function resolvePad(
  instance: GerberInstance,
  connector: GerberConnector,
  connectorIndex: number,
  totalConnectors: number,
): ResolvedPad {
  const padType = determinePadType(connector, instance.footprint);
  const { width, height, drill } = determinePadDimensions(connector, padType);
  const padShape = determinePadShape(connector, padType, connectorIndex);

  const bodyW = instance.bodyWidth ?? DEFAULT_BODY_WIDTH;
  const bodyH = instance.bodyHeight ?? DEFAULT_BODY_HEIGHT;
  const local = calculateConnectorOffset(connector, connectorIndex, totalConnectors, bodyW, bodyH);

  // Apply instance rotation
  const rotated = rotatePoint(local.x, local.y, 0, 0, instance.pcbRotation);

  // Apply instance position
  const absX = instance.pcbX + rotated.x;
  const absY = instance.pcbY + rotated.y;

  const side: 'front' | 'back' = instance.pcbSide === 'back' ? 'back' : 'front';

  return {
    x: absX,
    y: absY,
    width,
    height,
    padType,
    padShape,
    drill,
    side,
    refDes: instance.referenceDesignator,
    pinName: connector.name,
  };
}

/**
 * Heuristic: footprints with "SMD" in the name or small-pitch packages
 * are assumed to have SMD pads by default.
 */
export function isSmallPitch(footprint: string): boolean {
  const fp = footprint.toUpperCase();
  return (
    fp.includes('SMD') ||
    fp.includes('SOIC') ||
    fp.includes('QFP') ||
    fp.includes('QFN') ||
    fp.includes('BGA') ||
    fp.includes('SOT') ||
    fp.includes('0402') ||
    fp.includes('0603') ||
    fp.includes('0805') ||
    fp.includes('1206') ||
    fp.includes('1210') ||
    fp.includes('2512')
  );
}

/**
 * Resolve all pads from all instances.
 */
export function resolveAllPads(instances: GerberInstance[]): ResolvedPad[] {
  const pads: ResolvedPad[] = [];
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const connectors = inst.connectors;
    for (let j = 0; j < connectors.length; j++) {
      pads.push(resolvePad(inst, connectors[j], j, connectors.length));
    }
  }
  return pads;
}
