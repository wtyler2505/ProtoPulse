/**
 * ViaModel — PCB via entity model with DFM validation.
 *
 * Provides types, factory, and validation for through, blind, buried, and micro
 * vias per IPC standards. All dimensions are in millimeters.
 *
 * Pure functions — no React, no side effects.
 */

import {
  getLayerIndex,
  getLayerName,
  isOuterLayer,
} from '@/lib/pcb/layer-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViaType = 'through' | 'blind' | 'buried' | 'micro';

export interface Via {
  id: string;
  position: { x: number; y: number }; // mm (board coordinates)
  drillDiameter: number; // mm
  outerDiameter: number; // mm (drill + 2 * annular ring)
  type: ViaType;
  fromLayer: string; // layer name, e.g. 'F.Cu', 'In1.Cu', 'B.Cu'
  toLayer: string;
  netId?: number; // associated net
  tented: boolean; // solder mask covers via
}

export interface ViaRules {
  minDrill: number; // mm
  minAnnularRing: number; // mm (IPC Class 2: 0.1, Class 3: 0.15)
  minDrillToTraceClr: number; // mm
  minDrillToDrillClr: number; // mm
  allowBlind: boolean;
  allowBuried: boolean;
  allowMicro: boolean;
}

export interface ViaValidationResult {
  valid: boolean;
  violations: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default rules for a standard 2-layer FR4 board. */
export const DEFAULT_VIA_RULES: ViaRules = {
  minDrill: 0.3,
  minAnnularRing: 0.125, // between IPC Class 2 (0.1) and Class 3 (0.15)
  minDrillToTraceClr: 0.2,
  minDrillToDrillClr: 0.5,
  allowBlind: false,
  allowBuried: false,
  allowMicro: false,
};

/** Common via size presets (drill + outer diameter in mm). */
export const VIA_SIZE_PRESETS = [
  { name: 'Standard', drill: 0.3, outer: 0.6 },
  { name: 'Small', drill: 0.2, outer: 0.45 },
  { name: 'Large', drill: 0.4, outer: 0.8 },
  { name: 'Micro', drill: 0.1, outer: 0.25 },
] as const;

/** Default via preset (Standard). */
export const DEFAULT_VIA_PRESET = VIA_SIZE_PRESETS[0];

/** Default grid step for via snapping (2.54mm = 100 mil). */
const DEFAULT_GRID_STEP = 2.54;

/**
 * Floating-point comparison epsilon (1 nanometer).
 * Used to avoid false violations from IEEE 754 rounding at exact boundaries.
 */
const EPSILON = 1e-6;

// ---------------------------------------------------------------------------
// Layer opposite mapping
// ---------------------------------------------------------------------------

const LAYER_OPPOSITES: Record<string, string> = {
  'F.Cu': 'B.Cu',
  'B.Cu': 'F.Cu',
  // Legacy aliases for backward compatibility
  front: 'back',
  back: 'front',
};

// ---------------------------------------------------------------------------
// ViaModel
// ---------------------------------------------------------------------------

export class ViaModel {
  /**
   * Create a new via with sensible defaults.
   *
   * Defaults: through via, 0.3mm drill, 0.6mm outer, F.Cu→B.Cu, tented.
   */
  static create(
    position: { x: number; y: number },
    options?: {
      type?: ViaType;
      drillDiameter?: number;
      outerDiameter?: number;
      fromLayer?: string;
      toLayer?: string;
      netId?: number;
      tented?: boolean;
    },
  ): Via {
    return {
      id: crypto.randomUUID(),
      position: { x: position.x, y: position.y },
      drillDiameter: options?.drillDiameter ?? DEFAULT_VIA_PRESET.drill,
      outerDiameter: options?.outerDiameter ?? DEFAULT_VIA_PRESET.outer,
      type: options?.type ?? 'through',
      fromLayer: options?.fromLayer ?? 'F.Cu',
      toLayer: options?.toLayer ?? 'B.Cu',
      netId: options?.netId,
      tented: options?.tented ?? true,
    };
  }

  /**
   * Validate a via against DFM rules.
   *
   * Checks drill diameter, annular ring, via type permissions, and layer
   * assignment. Returns all violations found (does not short-circuit).
   */
  static validate(via: Via, rules: ViaRules = DEFAULT_VIA_RULES): ViaValidationResult {
    const violations: string[] = [];

    // Check outer > drill
    if (via.outerDiameter <= via.drillDiameter) {
      violations.push(
        `Outer diameter (${String(via.outerDiameter)}mm) must be greater than drill diameter (${String(via.drillDiameter)}mm)`,
      );
    }

    // Check drill diameter minimum
    if (via.drillDiameter < rules.minDrill - EPSILON) {
      violations.push(
        `Drill diameter ${String(via.drillDiameter)}mm is below minimum ${String(rules.minDrill)}mm`,
      );
    }

    // Check annular ring
    const annularRing = this.calculateAnnularRing(via);
    if (annularRing < rules.minAnnularRing - EPSILON) {
      violations.push(
        `Annular ring ${String(annularRing.toFixed(3))}mm is below minimum ${String(rules.minAnnularRing)}mm`,
      );
    }

    // Check fromLayer !== toLayer
    if (via.fromLayer === via.toLayer) {
      violations.push(
        `Via fromLayer and toLayer are the same layer ("${via.fromLayer}")`,
      );
    }

    // Check via type permissions
    if (via.type === 'blind' && !rules.allowBlind) {
      violations.push('Blind vias are not allowed by current design rules');
    }
    if (via.type === 'buried' && !rules.allowBuried) {
      violations.push('Buried vias are not allowed by current design rules');
    }
    if (via.type === 'micro' && !rules.allowMicro) {
      violations.push('Micro vias are not allowed by current design rules');
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Calculate the annular ring width from a via's dimensions.
   *
   * The annular ring is the copper area between the drill hole edge and
   * the outer edge of the pad: `(outerDiameter - drillDiameter) / 2`.
   */
  static calculateAnnularRing(via: Via): number {
    return (via.outerDiameter - via.drillDiameter) / 2;
  }

  /**
   * Check if two vias satisfy drill-to-drill clearance requirements.
   *
   * Returns `true` if clearance is sufficient, `false` if violated.
   *
   * The clearance is measured from the outer edge of one via to the outer
   * edge of the other: `distance - radius1 - radius2 >= minClearance`.
   */
  static checkDrillToDrillClearance(
    via1: Via,
    via2: Via,
    minClearance: number = DEFAULT_VIA_RULES.minDrillToDrillClr,
  ): boolean {
    const dx = via1.position.x - via2.position.x;
    const dy = via1.position.y - via2.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const radius1 = via1.outerDiameter / 2;
    const radius2 = via2.outerDiameter / 2;

    const edgeToEdge = distance - radius1 - radius2;

    // Use a small epsilon for floating-point comparison at the boundary
    return edgeToEdge >= minClearance - 1e-9;
  }

  /**
   * Get the opposite layer for a through via (front/back shortcut).
   *
   * Maps: F.Cu↔B.Cu, front↔back (legacy). Unknown layers return themselves.
   */
  static getOppositeLayer(layer: string): string {
    return LAYER_OPPOSITES[layer] ?? layer;
  }

  /**
   * Snap a via position to the nearest grid point.
   *
   * @param position - Position to snap (mm)
   * @param gridStep - Grid spacing in mm (default: 2.54mm = 100 mil)
   * @returns Snapped position
   */
  static snapToGrid(
    position: { x: number; y: number },
    gridStep: number = DEFAULT_GRID_STEP,
  ): { x: number; y: number } {
    return {
      x: Math.round(position.x / gridStep) * gridStep,
      y: Math.round(position.y / gridStep) * gridStep,
    };
  }

  /**
   * Get the default opposite layer for multi-layer via placement.
   *
   * - Outer layers map to the opposite outer layer.
   * - Inner layers map to the next layer in the stackup.
   */
  static getOppositeLayerMulti(layer: string, layerCount: number = 2): string {
    const idx = getLayerIndex(layer, layerCount);
    if (idx === 0) { return getLayerName(layerCount - 1, layerCount); }
    if (idx === layerCount - 1) { return getLayerName(0, layerCount); }
    // For inner layers, go to the next layer
    return getLayerName(idx + 1, layerCount);
  }

  /**
   * Classify a via type based on its from/to layers and total layer count.
   *
   * - through: spans from front to back (both outer layers)
   * - blind: one outer layer + one or more inner layers
   * - buried: both layers are inner
   */
  static classifyViaType(fromLayer: string, toLayer: string, layerCount: number = 2): ViaType {
    const fromOuter = isOuterLayer(fromLayer, layerCount);
    const toOuter = isOuterLayer(toLayer, layerCount);

    if (fromOuter && toOuter) { return 'through'; }
    if (fromOuter || toOuter) { return 'blind'; }
    return 'buried';
  }

  /**
   * Return the default ViaRules. Useful when callers need to override specific fields.
   */
  static getDefaultRules(): ViaRules {
    return { ...DEFAULT_VIA_RULES };
  }
}
