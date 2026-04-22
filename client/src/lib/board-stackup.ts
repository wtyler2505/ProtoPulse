/**
 * Board Stackup Manager
 *
 * Multi-layer PCB stackup management with impedance calculation for
 * controlled-impedance design. Supports standard and high-frequency
 * dielectric materials, preset stackups, and validation.
 *
 * Usage:
 *   const stackup = BoardStackup.getInstance();
 *   stackup.applyPreset('4-layer');
 *   const z = stackup.calculateImpedance(layerId, 8, 5);
 *
 * React hook:
 *   const { layers, calculateImpedance, applyPreset } = useBoardStackup();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayerType = 'signal' | 'power' | 'ground' | 'mixed';
export type DielectricMaterial = 'FR4' | 'Rogers4350B' | 'Rogers3003' | 'Isola370HR' | 'Megtron6' | 'custom';
export type CopperWeight = '0.5oz' | '1oz' | '2oz' | '3oz' | '4oz';
export type SurfaceFinish = 'HASL' | 'ENIG' | 'OSP' | 'ENEPIG' | 'Immersion_Tin' | 'Immersion_Silver';

export interface StackupLayer {
  id: string;
  name: string;
  type: LayerType;
  material: DielectricMaterial;
  thickness: number; // mils
  copperWeight: CopperWeight;
  dielectricConstant: number;
  lossTangent: number;
  order: number;
}

export interface DielectricLayer {
  id: string;
  name: string;
  material: DielectricMaterial;
  thickness: number; // mils
  dielectricConstant: number;
  lossTangent: number;
  order: number;
}

export interface ImpedanceResult {
  microstrip: number; // ohms
  stripline: number; // ohms
  differentialMicrostrip: number;
  differentialStripline: number;
  valid: boolean;
  warnings: string[];
}

export interface StackupPreset {
  name: string;
  description: string;
  layers: Array<Omit<StackupLayer, 'id'>>;
  dielectrics: Array<Omit<DielectricLayer, 'id'>>;
}

export interface AddLayerInput {
  name: string;
  type: LayerType;
  material?: DielectricMaterial;
  thickness?: number;
  copperWeight?: CopperWeight;
  dielectricConstant?: number;
  lossTangent?: number;
}

export interface AddDielectricInput {
  name: string;
  material?: DielectricMaterial;
  thickness?: number;
  dielectricConstant?: number;
  lossTangent?: number;
}

export interface StackupValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-board-stackup';

/** Copper thickness in mils by weight. */
const COPPER_THICKNESS: Record<CopperWeight, number> = {
  '0.5oz': 0.7,
  '1oz': 1.4,
  '2oz': 2.8,
  '3oz': 4.2,
  '4oz': 5.6,
};

/** Material database with dielectric constant and loss tangent. */
export const MATERIAL_DATABASE: Record<DielectricMaterial, { dielectricConstant: number; lossTangent: number }> = {
  FR4: { dielectricConstant: 4.4, lossTangent: 0.02 },
  Rogers4350B: { dielectricConstant: 3.66, lossTangent: 0.0037 },
  Rogers3003: { dielectricConstant: 3.0, lossTangent: 0.0013 },
  Isola370HR: { dielectricConstant: 3.92, lossTangent: 0.025 },
  Megtron6: { dielectricConstant: 3.71, lossTangent: 0.002 },
  custom: { dielectricConstant: 4.0, lossTangent: 0.02 },
};

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** Helper to generate a symmetric high-layer-count stackup preset. */
function generateHighLayerPreset(
  name: string,
  description: string,
  count: number,
): StackupPreset {
  const layers: Array<Omit<StackupLayer, 'id'>> = [];
  const dielectrics: Array<Omit<DielectricLayer, 'id'>> = [];

  // Typical pattern: Sig-Gnd-Sig-Pwr repeating, symmetric
  const layerTypes: LayerType[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0 || i === count - 1) {
      layerTypes.push('signal');
    } else if (i % 2 === 1) {
      layerTypes.push(i < count / 2 ? 'ground' : 'power');
    } else {
      layerTypes.push('signal');
    }
  }

  for (let i = 0; i < count; i++) {
    const layerName = i === 0
      ? 'Top (Signal)'
      : i === count - 1
        ? 'Bottom (Signal)'
        : `Inner ${String(i)} (${layerTypes[i].charAt(0).toUpperCase() + layerTypes[i].slice(1)})`;

    layers.push({
      name: layerName,
      type: layerTypes[i],
      material: 'FR4',
      thickness: 1.4,
      copperWeight: '1oz',
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: i * 2,
    });

    // Add dielectric between layers (not after the last)
    if (i < count - 1) {
      const isCore = i % 2 === 1;
      dielectrics.push({
        name: isCore ? `Core ${String(Math.floor(i / 2) + 1)}` : `Prepreg ${String(Math.ceil(i / 2))}`,
        material: 'FR4',
        thickness: isCore ? 10 : 5,
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: i * 2 + 1,
      });
    }
  }

  return { name, description, layers, dielectrics };
}

const PRESETS: StackupPreset[] = [
  {
    name: '2-layer',
    description: 'Standard 2-layer FR4 board (62 mil)',
    layers: [
      {
        name: 'Top',
        type: 'signal',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 0,
      },
      {
        name: 'Bottom',
        type: 'signal',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 2,
      },
    ],
    dielectrics: [
      {
        name: 'Core',
        material: 'FR4',
        thickness: 59.2,
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 1,
      },
    ],
  },
  {
    name: '4-layer',
    description: 'Standard 4-layer: Signal-Ground-Power-Signal',
    layers: [
      {
        name: 'Top (Signal)',
        type: 'signal',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 0,
      },
      {
        name: 'Inner 1 (Ground)',
        type: 'ground',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 2,
      },
      {
        name: 'Inner 2 (Power)',
        type: 'power',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 4,
      },
      {
        name: 'Bottom (Signal)',
        type: 'signal',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 6,
      },
    ],
    dielectrics: [
      {
        name: 'Prepreg 1',
        material: 'FR4',
        thickness: 8,
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 1,
      },
      {
        name: 'Core',
        material: 'FR4',
        thickness: 40,
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 3,
      },
      {
        name: 'Prepreg 2',
        material: 'FR4',
        thickness: 8,
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 5,
      },
    ],
  },
  {
    name: '6-layer',
    description: 'High-performance 6-layer: Sig-Gnd-Sig-Sig-Pwr-Sig',
    layers: [
      {
        name: 'Top (Signal)',
        type: 'signal',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 0,
      },
      {
        name: 'Inner 1 (Ground)',
        type: 'ground',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 2,
      },
      {
        name: 'Inner 2 (Signal)',
        type: 'signal',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 4,
      },
      {
        name: 'Inner 3 (Signal)',
        type: 'signal',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 6,
      },
      {
        name: 'Inner 4 (Power)',
        type: 'power',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 8,
      },
      {
        name: 'Bottom (Signal)',
        type: 'signal',
        material: 'FR4',
        thickness: 1.4,
        copperWeight: '1oz',
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 10,
      },
    ],
    dielectrics: [
      {
        name: 'Prepreg 1',
        material: 'FR4',
        thickness: 5,
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 1,
      },
      {
        name: 'Core 1',
        material: 'FR4',
        thickness: 10,
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 3,
      },
      {
        name: 'Prepreg 2',
        material: 'FR4',
        thickness: 10,
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 5,
      },
      {
        name: 'Core 2',
        material: 'FR4',
        thickness: 10,
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 7,
      },
      {
        name: 'Prepreg 3',
        material: 'FR4',
        thickness: 5,
        dielectricConstant: 4.4,
        lossTangent: 0.02,
        order: 9,
      },
    ],
  },
  generateHighLayerPreset('8-layer', '8-layer: Sig-Gnd-Sig-Pwr-Pwr-Sig-Gnd-Sig', 8),
  generateHighLayerPreset('10-layer', '10-layer high-density design', 10),
  generateHighLayerPreset('16-layer', '16-layer high-density design', 16),
  generateHighLayerPreset('32-layer', '32-layer ultra-dense design', 32),
];

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Serialized shape for localStorage / export
// ---------------------------------------------------------------------------

interface SerializedStackup {
  layers: StackupLayer[];
  dielectrics: DielectricLayer[];
  surfaceFinish: SurfaceFinish;
}

// ---------------------------------------------------------------------------
// BoardStackup
// ---------------------------------------------------------------------------

/**
 * Manages PCB board stackup state with layers, dielectrics, impedance
 * calculation, presets, and validation. Singleton per application.
 * Persists to localStorage.
 */
export class BoardStackup {
  private static instance: BoardStackup | null = null;

  private layers: StackupLayer[] = [];
  private dielectrics: DielectricLayer[] = [];
  private surfaceFinish: SurfaceFinish = 'HASL';
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): BoardStackup {
    if (!BoardStackup.instance) {
      BoardStackup.instance = new BoardStackup();
    }
    return BoardStackup.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    BoardStackup.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

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
  // Layer CRUD
  // -----------------------------------------------------------------------

  addLayer(input: AddLayerInput): string {
    const material = input.material ?? 'FR4';
    const matProps = MATERIAL_DATABASE[material];
    const id = crypto.randomUUID();
    const maxOrder = this.layers.length > 0 ? Math.max(...this.layers.map((l) => l.order)) : -1;

    const layer: StackupLayer = {
      id,
      name: input.name,
      type: input.type,
      material,
      thickness: input.thickness ?? 1.4,
      copperWeight: input.copperWeight ?? '1oz',
      dielectricConstant: input.dielectricConstant ?? matProps.dielectricConstant,
      lossTangent: input.lossTangent ?? matProps.lossTangent,
      order: maxOrder + 1,
    };

    this.layers.push(layer);
    this.save();
    this.notify();
    return id;
  }

  removeLayer(id: string): boolean {
    const index = this.layers.findIndex((l) => l.id === id);
    if (index === -1) {
      return false;
    }
    this.layers.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  updateLayer(id: string, updates: Partial<Omit<StackupLayer, 'id'>>): boolean {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) {
      return false;
    }

    if (updates.name !== undefined) {
      layer.name = updates.name;
    }
    if (updates.type !== undefined) {
      layer.type = updates.type;
    }
    if (updates.material !== undefined) {
      layer.material = updates.material;
    }
    if (updates.thickness !== undefined) {
      layer.thickness = updates.thickness;
    }
    if (updates.copperWeight !== undefined) {
      layer.copperWeight = updates.copperWeight;
    }
    if (updates.dielectricConstant !== undefined) {
      layer.dielectricConstant = updates.dielectricConstant;
    }
    if (updates.lossTangent !== undefined) {
      layer.lossTangent = updates.lossTangent;
    }
    if (updates.order !== undefined) {
      layer.order = updates.order;
    }

    this.save();
    this.notify();
    return true;
  }

  getLayer(id: string): StackupLayer | null {
    return this.layers.find((l) => l.id === id) ?? null;
  }

  getAllLayers(): StackupLayer[] {
    return [...this.layers].sort((a, b) => a.order - b.order);
  }

  reorderLayer(id: string, newOrder: number): boolean {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) {
      return false;
    }
    layer.order = newOrder;
    this.save();
    this.notify();
    return true;
  }

  getLayerCount(): number {
    return this.layers.length;
  }

  // -----------------------------------------------------------------------
  // Dielectric CRUD
  // -----------------------------------------------------------------------

  addDielectric(input: AddDielectricInput): string {
    const material = input.material ?? 'FR4';
    const matProps = MATERIAL_DATABASE[material];
    const id = crypto.randomUUID();
    const maxOrder = this.dielectrics.length > 0 ? Math.max(...this.dielectrics.map((d) => d.order)) : -1;

    const dielectric: DielectricLayer = {
      id,
      name: input.name,
      material,
      thickness: input.thickness ?? 10,
      dielectricConstant: input.dielectricConstant ?? matProps.dielectricConstant,
      lossTangent: input.lossTangent ?? matProps.lossTangent,
      order: maxOrder + 1,
    };

    this.dielectrics.push(dielectric);
    this.save();
    this.notify();
    return id;
  }

  removeDielectric(id: string): boolean {
    const index = this.dielectrics.findIndex((d) => d.id === id);
    if (index === -1) {
      return false;
    }
    this.dielectrics.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  getDielectrics(): DielectricLayer[] {
    return [...this.dielectrics].sort((a, b) => a.order - b.order);
  }

  // -----------------------------------------------------------------------
  // Thickness
  // -----------------------------------------------------------------------

  getTotalThickness(): number {
    let total = 0;
    this.layers.forEach((l) => {
      total += l.thickness;
    });
    this.dielectrics.forEach((d) => {
      total += d.thickness;
    });
    return Math.round(total * 1000) / 1000;
  }

  // -----------------------------------------------------------------------
  // Impedance Calculation
  // -----------------------------------------------------------------------

  calculateImpedance(layerId: string, traceWidth: number, spacing?: number): ImpedanceResult {
    const layer = this.layers.find((l) => l.id === layerId);
    const warnings: string[] = [];

    if (!layer) {
      return {
        microstrip: 0,
        stripline: 0,
        differentialMicrostrip: 0,
        differentialStripline: 0,
        valid: false,
        warnings: ['Layer not found'],
      };
    }

    if (traceWidth <= 0) {
      return {
        microstrip: 0,
        stripline: 0,
        differentialMicrostrip: 0,
        differentialStripline: 0,
        valid: false,
        warnings: ['Trace width must be greater than zero'],
      };
    }

    const W = traceWidth; // mils
    const Er = layer.dielectricConstant;
    const T = COPPER_THICKNESS[layer.copperWeight]; // mils

    // Find the nearest dielectric layer below (next higher order)
    const allOrdered = [...this.layers, ...this.dielectrics].sort((a, b) => a.order - b.order);
    const layerIndex = allOrdered.findIndex((item) => 'copperWeight' in item && item.id === layerId);

    // Height to ground plane (H) — use nearest dielectric thickness
    let H = 10; // default 10 mils if no dielectric found
    if (layerIndex >= 0) {
      // Search below for a dielectric
      for (let i = layerIndex + 1; i < allOrdered.length; i++) {
        const item = allOrdered[i];
        if (!('copperWeight' in item)) {
          H = item.thickness;
          break;
        }
      }
      // If no dielectric below, search above
      if (H === 10 && layerIndex > 0) {
        for (let i = layerIndex - 1; i >= 0; i--) {
          const item = allOrdered[i];
          if (!('copperWeight' in item)) {
            H = item.thickness;
            break;
          }
        }
      }
    }

    // Microstrip: Z0 = (87 / sqrt(Er + 1.41)) * ln(5.98 * H / (0.8 * W + T))
    const microstripArg = (5.98 * H) / (0.8 * W + T);
    let microstrip = 0;
    if (microstripArg > 0) {
      const lnArg = Math.log(microstripArg);
      if (lnArg > 0) {
        microstrip = (87 / Math.sqrt(Er + 1.41)) * lnArg;
      } else {
        warnings.push('Trace too wide for microstrip calculation — ratio below 1');
      }
    }

    // Stripline: Z0 = (60 / sqrt(Er)) * ln(4 * H / (0.67 * pi * (0.8 * W + T)))
    const striplineArg = (4 * H) / (0.67 * Math.PI * (0.8 * W + T));
    let stripline = 0;
    if (striplineArg > 0) {
      const lnArg = Math.log(striplineArg);
      if (lnArg > 0) {
        stripline = (60 / Math.sqrt(Er)) * lnArg;
      } else {
        warnings.push('Trace too wide for stripline calculation — ratio below 1');
      }
    }

    // Differential impedance — coupling factor based on spacing
    const S = spacing ?? W * 2; // default spacing = 2x trace width
    const couplingFactor = 1 - 0.48 * Math.exp(-0.96 * (S / H));
    const differentialMicrostrip = 2 * microstrip * couplingFactor;
    const differentialStripline = 2 * stripline * couplingFactor;

    if (microstrip > 150) {
      warnings.push('Microstrip impedance is unusually high (>150 ohms)');
    }
    if (microstrip > 0 && microstrip < 20) {
      warnings.push('Microstrip impedance is unusually low (<20 ohms)');
    }

    return {
      microstrip: Math.round(microstrip * 100) / 100,
      stripline: Math.round(stripline * 100) / 100,
      differentialMicrostrip: Math.round(differentialMicrostrip * 100) / 100,
      differentialStripline: Math.round(differentialStripline * 100) / 100,
      valid: microstrip > 0 || stripline > 0,
      warnings,
    };
  }

  // -----------------------------------------------------------------------
  // Presets
  // -----------------------------------------------------------------------

  applyPreset(presetName: string): void {
    const preset = PRESETS.find((p) => p.name === presetName);
    if (!preset) {
      throw new Error(`Preset "${presetName}" not found`);
    }

    this.layers = preset.layers.map((l) => ({
      ...l,
      id: crypto.randomUUID(),
    }));

    this.dielectrics = preset.dielectrics.map((d) => ({
      ...d,
      id: crypto.randomUUID(),
    }));

    this.save();
    this.notify();
  }

  /**
   * Sync the stackup to a target copper-layer count (E2E-233, Plan 02 Phase 6).
   *
   * When the shared project board (`boards.layers`, Plan 02 Phase 4) changes,
   * the stackup must reflect the new layer count so the layer-visibility
   * panel renders one toggle row per copper layer — not just top/bottom.
   *
   * If a named preset (`${n}-layer`) exists, applies it verbatim so the user
   * keeps the curated material + thickness choices. Otherwise builds a
   * symmetric stackup programmatically via the same generator the presets
   * use. No-op if the stackup already has exactly `n` copper layers.
   */
  applyLayerCount(n: number): void {
    const target = Math.max(2, Math.min(32, Math.round(n)));
    if (this.layers.length === target) {
      return;
    }

    const namedPreset = PRESETS.find((p) => p.name === `${String(target)}-layer`);
    const preset = namedPreset ?? generateHighLayerPreset(
      `${String(target)}-layer`,
      `Auto-generated ${String(target)}-layer stackup`,
      target,
    );

    this.layers = preset.layers.map((l) => ({
      ...l,
      id: crypto.randomUUID(),
    }));
    this.dielectrics = preset.dielectrics.map((d) => ({
      ...d,
      id: crypto.randomUUID(),
    }));

    this.save();
    this.notify();
  }

  getAvailablePresets(): StackupPreset[] {
    return PRESETS.map((p) => ({ ...p }));
  }

  // -----------------------------------------------------------------------
  // Surface Finish
  // -----------------------------------------------------------------------

  getSurfaceFinish(): SurfaceFinish {
    return this.surfaceFinish;
  }

  setSurfaceFinish(finish: SurfaceFinish): void {
    this.surfaceFinish = finish;
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Export / Import
  // -----------------------------------------------------------------------

  exportStackup(): string {
    const data: SerializedStackup = {
      layers: this.getAllLayers(),
      dielectrics: this.getDielectrics(),
      surfaceFinish: this.surfaceFinish,
    };
    return JSON.stringify(data, null, 2);
  }

  importStackup(json: string): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { success: false, errors: ['Invalid JSON'] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, errors: ['Data must be an object'] };
    }

    const data = parsed as Record<string, unknown>;

    if (!Array.isArray(data.layers)) {
      errors.push('Missing or invalid "layers" array');
    }
    if (!Array.isArray(data.dielectrics)) {
      errors.push('Missing or invalid "dielectrics" array');
    }
    if (errors.length > 0) {
      return { success: false, errors };
    }

    const layersArr = data.layers as unknown[];
    const dielectricsArr = data.dielectrics as unknown[];

    // Validate each layer
    for (let i = 0; i < layersArr.length; i++) {
      const l = layersArr[i];
      if (typeof l !== 'object' || l === null) {
        errors.push(`Layer ${i}: must be an object`);
        continue;
      }
      const layer = l as Record<string, unknown>;
      if (typeof layer.name !== 'string') {
        errors.push(`Layer ${i}: missing name`);
      }
      if (typeof layer.type !== 'string') {
        errors.push(`Layer ${i}: missing type`);
      }
      if (typeof layer.thickness !== 'number' || layer.thickness <= 0) {
        errors.push(`Layer ${i}: invalid thickness`);
      }
    }

    // Validate each dielectric
    for (let i = 0; i < dielectricsArr.length; i++) {
      const d = dielectricsArr[i];
      if (typeof d !== 'object' || d === null) {
        errors.push(`Dielectric ${i}: must be an object`);
        continue;
      }
      const diel = d as Record<string, unknown>;
      if (typeof diel.name !== 'string') {
        errors.push(`Dielectric ${i}: missing name`);
      }
      if (typeof diel.thickness !== 'number' || diel.thickness <= 0) {
        errors.push(`Dielectric ${i}: invalid thickness`);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    this.layers = (layersArr as StackupLayer[]).map((l) => ({
      ...l,
      id: l.id ?? crypto.randomUUID(),
    }));
    this.dielectrics = (dielectricsArr as DielectricLayer[]).map((d) => ({
      ...d,
      id: d.id ?? crypto.randomUUID(),
    }));
    if (typeof data.surfaceFinish === 'string') {
      this.surfaceFinish = data.surfaceFinish as SurfaceFinish;
    }

    this.save();
    this.notify();
    return { success: true, errors: [] };
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  validateStackup(): StackupValidation {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Minimum layers
    if (this.layers.length === 0) {
      errors.push('Stackup has no copper layers');
      return { valid: false, warnings, errors };
    }

    if (this.layers.length === 1) {
      warnings.push('Single-layer boards have limited routing options');
    }

    // Even layer count (standard manufacturing)
    if (this.layers.length % 2 !== 0) {
      warnings.push('Odd layer count may increase manufacturing cost — even layer counts are standard');
    }

    // Symmetry check — compare top half to bottom half
    const sorted = [...this.layers].sort((a, b) => a.order - b.order);
    if (sorted.length >= 4) {
      const half = Math.floor(sorted.length / 2);
      let symmetric = true;
      for (let i = 0; i < half; i++) {
        const top = sorted[i];
        const bottom = sorted[sorted.length - 1 - i];
        if (top.type !== bottom.type || top.copperWeight !== bottom.copperWeight) {
          symmetric = false;
          break;
        }
      }
      if (!symmetric) {
        warnings.push('Stackup is not symmetric — may cause board warping during manufacturing');
      }
    }

    // Check for adjacent power/ground planes (good practice)
    if (sorted.length >= 4) {
      let hasAdjacentPowerGround = false;
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (
          (a.type === 'power' && b.type === 'ground') ||
          (a.type === 'ground' && b.type === 'power')
        ) {
          hasAdjacentPowerGround = true;
          break;
        }
      }
      if (!hasAdjacentPowerGround) {
        warnings.push('No adjacent power/ground plane pair found — consider adding one for better decoupling');
      }
    }

    // Check total thickness is reasonable (20-150 mils typical)
    const totalThickness = this.getTotalThickness();
    if (totalThickness > 0 && totalThickness < 20) {
      warnings.push('Total board thickness is very thin (<20 mils)');
    }
    if (totalThickness > 150) {
      warnings.push('Total board thickness is very thick (>150 mils)');
    }

    // Check for signal layers without nearby reference planes
    const signalLayers = sorted.filter((l) => l.type === 'signal');
    const refLayers = sorted.filter((l) => l.type === 'ground' || l.type === 'power');
    if (signalLayers.length > 0 && refLayers.length === 0 && sorted.length >= 3) {
      warnings.push('No reference planes (ground/power) — signal integrity may be poor');
    }

    return { valid: errors.length === 0, warnings, errors };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      const data: SerializedStackup = {
        layers: this.layers,
        dielectrics: this.dielectrics,
        surfaceFinish: this.surfaceFinish,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      if (Array.isArray(data.layers)) {
        const validLayers = (data.layers as unknown[]).filter(
          (l: unknown): l is StackupLayer =>
            typeof l === 'object' &&
            l !== null &&
            typeof (l as StackupLayer).id === 'string' &&
            typeof (l as StackupLayer).name === 'string' &&
            typeof (l as StackupLayer).thickness === 'number',
        );
        this.layers = validLayers;
      }

      if (Array.isArray(data.dielectrics)) {
        const validDielectrics = (data.dielectrics as unknown[]).filter(
          (d: unknown): d is DielectricLayer =>
            typeof d === 'object' &&
            d !== null &&
            typeof (d as DielectricLayer).id === 'string' &&
            typeof (d as DielectricLayer).name === 'string' &&
            typeof (d as DielectricLayer).thickness === 'number',
        );
        this.dielectrics = validDielectrics;
      }

      if (typeof data.surfaceFinish === 'string') {
        this.surfaceFinish = data.surfaceFinish as SurfaceFinish;
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useBoardStackup(): {
  layers: StackupLayer[];
  dielectrics: DielectricLayer[];
  addLayer: (input: AddLayerInput) => string;
  removeLayer: (id: string) => boolean;
  updateLayer: (id: string, updates: Partial<Omit<StackupLayer, 'id'>>) => boolean;
  reorderLayer: (id: string, newOrder: number) => boolean;
  calculateImpedance: (layerId: string, traceWidth: number, spacing?: number) => ImpedanceResult;
  applyPreset: (presetName: string) => void;
  applyLayerCount: (n: number) => void;
  presets: StackupPreset[];
  totalThickness: number;
  surfaceFinish: SurfaceFinish;
  setSurfaceFinish: (finish: SurfaceFinish) => void;
  validate: () => StackupValidation;
  exportStackup: () => string;
  importStackup: (json: string) => { success: boolean; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const stackup = BoardStackup.getInstance();
    const unsubscribe = stackup.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const addLayer = useCallback((input: AddLayerInput) => {
    return BoardStackup.getInstance().addLayer(input);
  }, []);

  const removeLayer = useCallback((id: string) => {
    return BoardStackup.getInstance().removeLayer(id);
  }, []);

  const updateLayer = useCallback((id: string, updates: Partial<Omit<StackupLayer, 'id'>>) => {
    return BoardStackup.getInstance().updateLayer(id, updates);
  }, []);

  const reorderLayer = useCallback((id: string, newOrder: number) => {
    return BoardStackup.getInstance().reorderLayer(id, newOrder);
  }, []);

  const calculateImpedance = useCallback((layerId: string, traceWidth: number, spacing?: number) => {
    return BoardStackup.getInstance().calculateImpedance(layerId, traceWidth, spacing);
  }, []);

  const applyPreset = useCallback((presetName: string) => {
    BoardStackup.getInstance().applyPreset(presetName);
  }, []);

  const applyLayerCount = useCallback((n: number) => {
    BoardStackup.getInstance().applyLayerCount(n);
  }, []);

  const setSurfaceFinish = useCallback((finish: SurfaceFinish) => {
    BoardStackup.getInstance().setSurfaceFinish(finish);
  }, []);

  const validate = useCallback(() => {
    return BoardStackup.getInstance().validateStackup();
  }, []);

  const exportStackup = useCallback(() => {
    return BoardStackup.getInstance().exportStackup();
  }, []);

  const importStackup = useCallback((json: string) => {
    return BoardStackup.getInstance().importStackup(json);
  }, []);

  const stackup = BoardStackup.getInstance();

  return {
    layers: stackup.getAllLayers(),
    dielectrics: stackup.getDielectrics(),
    addLayer,
    removeLayer,
    updateLayer,
    reorderLayer,
    calculateImpedance,
    applyPreset,
    applyLayerCount,
    presets: stackup.getAvailablePresets(),
    totalThickness: stackup.getTotalThickness(),
    surfaceFinish: stackup.getSurfaceFinish(),
    setSurfaceFinish,
    validate,
    exportStackup,
    importStackup,
  };
}
