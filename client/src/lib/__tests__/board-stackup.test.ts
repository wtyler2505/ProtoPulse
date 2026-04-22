import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AddLayerInput, SurfaceFinish, StackupValidation } from '../board-stackup';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

vi.stubGlobal('crypto', { randomUUID: vi.fn<() => string>(() => `uuid-${Math.random().toString(36).slice(2, 10)}`) });

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn<(key: string) => string | null>((key: string) => store[key] ?? null),
  setItem: vi.fn<(key: string, val: string) => void>((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn<(key: string) => void>((key: string) => {
    delete store[key];
  }),
  clear: vi.fn<() => void>(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

// Must import after mocks
// eslint-disable-next-line import-x/first
import { BoardStackup, MATERIAL_DATABASE, useBoardStackup } from '../board-stackup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshStackup(): BoardStackup {
  BoardStackup.resetForTesting();
  for (const k of Object.keys(store)) {
    delete store[k];
  }
  return BoardStackup.getInstance();
}

function addSignalLayer(stackup: BoardStackup, name = 'Signal'): string {
  return stackup.addLayer({ name, type: 'signal' });
}

function addGroundLayer(stackup: BoardStackup, name = 'Ground'): string {
  return stackup.addLayer({ name, type: 'ground' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoardStackup', () => {
  beforeEach(() => {
    freshStackup();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = BoardStackup.getInstance();
      const b = BoardStackup.getInstance();
      expect(a).toBe(b);
    });

    it('resetForTesting creates a new instance', () => {
      const a = BoardStackup.getInstance();
      BoardStackup.resetForTesting();
      const b = BoardStackup.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Layer CRUD
  // -----------------------------------------------------------------------

  describe('layer CRUD', () => {
    it('adds a layer and retrieves it', () => {
      const stackup = BoardStackup.getInstance();
      const id = addSignalLayer(stackup, 'Top');
      const layer = stackup.getLayer(id);
      expect(layer).not.toBeNull();
      expect(layer!.name).toBe('Top');
      expect(layer!.type).toBe('signal');
    });

    it('adds a layer with defaults from material database', () => {
      const stackup = BoardStackup.getInstance();
      const id = stackup.addLayer({ name: 'HF', type: 'signal', material: 'Rogers4350B' });
      const layer = stackup.getLayer(id);
      expect(layer!.dielectricConstant).toBe(3.66);
      expect(layer!.lossTangent).toBe(0.0037);
    });

    it('adds a layer with custom properties', () => {
      const stackup = BoardStackup.getInstance();
      const id = stackup.addLayer({
        name: 'Custom',
        type: 'signal',
        material: 'custom',
        thickness: 2.0,
        copperWeight: '2oz',
        dielectricConstant: 3.5,
        lossTangent: 0.015,
      });
      const layer = stackup.getLayer(id);
      expect(layer!.thickness).toBe(2.0);
      expect(layer!.copperWeight).toBe('2oz');
      expect(layer!.dielectricConstant).toBe(3.5);
    });

    it('returns all layers sorted by order', () => {
      const stackup = BoardStackup.getInstance();
      addSignalLayer(stackup, 'First');
      addGroundLayer(stackup, 'Second');
      addSignalLayer(stackup, 'Third');
      const layers = stackup.getAllLayers();
      expect(layers).toHaveLength(3);
      expect(layers[0].name).toBe('First');
      expect(layers[1].name).toBe('Second');
      expect(layers[2].name).toBe('Third');
    });

    it('getLayer returns null for unknown id', () => {
      const stackup = BoardStackup.getInstance();
      expect(stackup.getLayer('nonexistent')).toBeNull();
    });

    it('updates a layer', () => {
      const stackup = BoardStackup.getInstance();
      const id = addSignalLayer(stackup, 'Original');
      const result = stackup.updateLayer(id, { name: 'Updated', type: 'power', thickness: 3.0 });
      expect(result).toBe(true);
      const layer = stackup.getLayer(id);
      expect(layer!.name).toBe('Updated');
      expect(layer!.type).toBe('power');
      expect(layer!.thickness).toBe(3.0);
    });

    it('updateLayer returns false for unknown id', () => {
      const stackup = BoardStackup.getInstance();
      expect(stackup.updateLayer('nonexistent', { name: 'X' })).toBe(false);
    });

    it('removes a layer', () => {
      const stackup = BoardStackup.getInstance();
      const id = addSignalLayer(stackup);
      expect(stackup.removeLayer(id)).toBe(true);
      expect(stackup.getLayer(id)).toBeNull();
      expect(stackup.getLayerCount()).toBe(0);
    });

    it('removeLayer returns false for unknown id', () => {
      const stackup = BoardStackup.getInstance();
      expect(stackup.removeLayer('nonexistent')).toBe(false);
    });

    it('reorders a layer', () => {
      const stackup = BoardStackup.getInstance();
      const id1 = addSignalLayer(stackup, 'A');
      const id2 = addGroundLayer(stackup, 'B');
      stackup.reorderLayer(id1, 10);
      const layers = stackup.getAllLayers();
      expect(layers[0].id).toBe(id2);
      expect(layers[1].id).toBe(id1);
    });

    it('reorderLayer returns false for unknown id', () => {
      const stackup = BoardStackup.getInstance();
      expect(stackup.reorderLayer('nonexistent', 0)).toBe(false);
    });

    it('getLayerCount returns correct count', () => {
      const stackup = BoardStackup.getInstance();
      expect(stackup.getLayerCount()).toBe(0);
      addSignalLayer(stackup);
      addGroundLayer(stackup);
      expect(stackup.getLayerCount()).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Dielectric Management
  // -----------------------------------------------------------------------

  describe('dielectric management', () => {
    it('adds and retrieves dielectrics', () => {
      const stackup = BoardStackup.getInstance();
      stackup.addDielectric({ name: 'Core' });
      const dielectrics = stackup.getDielectrics();
      expect(dielectrics).toHaveLength(1);
      expect(dielectrics[0].name).toBe('Core');
    });

    it('adds dielectric with material properties', () => {
      const stackup = BoardStackup.getInstance();
      stackup.addDielectric({ name: 'HF Core', material: 'Rogers4350B', thickness: 20 });
      const dielectrics = stackup.getDielectrics();
      expect(dielectrics[0].dielectricConstant).toBe(3.66);
      expect(dielectrics[0].thickness).toBe(20);
    });

    it('removes a dielectric', () => {
      const stackup = BoardStackup.getInstance();
      const id = stackup.addDielectric({ name: 'Core' });
      expect(stackup.removeDielectric(id)).toBe(true);
      expect(stackup.getDielectrics()).toHaveLength(0);
    });

    it('removeDielectric returns false for unknown id', () => {
      const stackup = BoardStackup.getInstance();
      expect(stackup.removeDielectric('nonexistent')).toBe(false);
    });

    it('getDielectrics returns sorted by order', () => {
      const stackup = BoardStackup.getInstance();
      stackup.addDielectric({ name: 'A' });
      stackup.addDielectric({ name: 'B' });
      stackup.addDielectric({ name: 'C' });
      const dielectrics = stackup.getDielectrics();
      expect(dielectrics[0].name).toBe('A');
      expect(dielectrics[2].name).toBe('C');
    });
  });

  // -----------------------------------------------------------------------
  // Total Thickness
  // -----------------------------------------------------------------------

  describe('total thickness', () => {
    it('returns 0 for empty stackup', () => {
      const stackup = BoardStackup.getInstance();
      expect(stackup.getTotalThickness()).toBe(0);
    });

    it('sums layer and dielectric thicknesses', () => {
      const stackup = BoardStackup.getInstance();
      stackup.addLayer({ name: 'Top', type: 'signal', thickness: 1.4 });
      stackup.addDielectric({ name: 'Core', thickness: 59.2 });
      stackup.addLayer({ name: 'Bottom', type: 'signal', thickness: 1.4 });
      expect(stackup.getTotalThickness()).toBe(62);
    });

    it('handles floating point precision', () => {
      const stackup = BoardStackup.getInstance();
      stackup.addLayer({ name: 'L1', type: 'signal', thickness: 0.1 });
      stackup.addLayer({ name: 'L2', type: 'signal', thickness: 0.2 });
      // 0.1 + 0.2 === 0.30000000000000004 without rounding
      expect(stackup.getTotalThickness()).toBe(0.3);
    });
  });

  // -----------------------------------------------------------------------
  // Impedance Calculation
  // -----------------------------------------------------------------------

  describe('impedance calculation', () => {
    it('calculates microstrip impedance for a basic layer', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const layers = stackup.getAllLayers();
      const topLayerId = layers[0].id;
      const result = stackup.calculateImpedance(topLayerId, 8);
      expect(result.valid).toBe(true);
      expect(result.microstrip).toBeGreaterThan(0);
      expect(result.stripline).toBeGreaterThan(0);
    });

    it('calculates stripline impedance', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const layers = stackup.getAllLayers();
      const innerLayerId = layers[1].id; // Ground layer
      const result = stackup.calculateImpedance(innerLayerId, 5);
      expect(result.stripline).toBeGreaterThan(0);
    });

    it('calculates differential impedance with spacing', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const layers = stackup.getAllLayers();
      const result = stackup.calculateImpedance(layers[0].id, 5, 5);
      expect(result.differentialMicrostrip).toBeGreaterThan(0);
      expect(result.differentialStripline).toBeGreaterThan(0);
    });

    it('differential impedance roughly 2x single-ended', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const layers = stackup.getAllLayers();
      const result = stackup.calculateImpedance(layers[0].id, 5, 20);
      // With large spacing, coupling factor approaches 1, so diff ~ 2x single
      expect(result.differentialMicrostrip).toBeGreaterThan(result.microstrip * 1.5);
      expect(result.differentialMicrostrip).toBeLessThan(result.microstrip * 2.1);
    });

    it('returns invalid for unknown layer', () => {
      const stackup = BoardStackup.getInstance();
      const result = stackup.calculateImpedance('nonexistent', 8);
      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Layer not found');
    });

    it('returns invalid for zero trace width', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('2-layer');
      const layers = stackup.getAllLayers();
      const result = stackup.calculateImpedance(layers[0].id, 0);
      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Trace width must be greater than zero');
    });

    it('returns invalid for negative trace width', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('2-layer');
      const layers = stackup.getAllLayers();
      const result = stackup.calculateImpedance(layers[0].id, -5);
      expect(result.valid).toBe(false);
    });

    it('warns for very narrow trace (high impedance)', () => {
      const stackup = BoardStackup.getInstance();
      stackup.addLayer({ name: 'Top', type: 'signal', thickness: 1.4 });
      stackup.addDielectric({ name: 'Core', thickness: 60 });
      stackup.addLayer({ name: 'Bot', type: 'signal', thickness: 1.4 });
      const layers = stackup.getAllLayers();
      // Very narrow trace with thick dielectric = high impedance
      const result = stackup.calculateImpedance(layers[0].id, 0.5);
      if (result.microstrip > 150) {
        expect(result.warnings).toContain('Microstrip impedance is unusually high (>150 ohms)');
      }
      expect(result.valid).toBe(true);
    });

    it('impedance decreases with wider traces', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const layers = stackup.getAllLayers();
      const narrow = stackup.calculateImpedance(layers[0].id, 4);
      const wide = stackup.calculateImpedance(layers[0].id, 12);
      expect(narrow.microstrip).toBeGreaterThan(wide.microstrip);
    });

    it('uses default spacing when not provided', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const layers = stackup.getAllLayers();
      const result = stackup.calculateImpedance(layers[0].id, 5);
      expect(result.differentialMicrostrip).toBeGreaterThan(0);
    });

    it('impedance varies with dielectric constant', () => {
      // FR4 (Er=4.4) vs Rogers3003 (Er=3.0)
      const stackup1 = freshStackup();
      stackup1.addLayer({ name: 'Top', type: 'signal', material: 'FR4' });
      stackup1.addDielectric({ name: 'Core', thickness: 40 });
      const layers1 = stackup1.getAllLayers();
      const z1 = stackup1.calculateImpedance(layers1[0].id, 6);

      const stackup2 = freshStackup();
      stackup2.addLayer({ name: 'Top', type: 'signal', material: 'Rogers3003', dielectricConstant: 3.0 });
      stackup2.addDielectric({ name: 'Core', thickness: 40 });
      const layers2 = stackup2.getAllLayers();
      const z2 = stackup2.calculateImpedance(layers2[0].id, 6);

      // Lower Er → higher impedance
      expect(z2.microstrip).toBeGreaterThan(z1.microstrip);
    });
  });

  // -----------------------------------------------------------------------
  // Presets
  // -----------------------------------------------------------------------

  describe('presets', () => {
    it('lists available presets', () => {
      const stackup = BoardStackup.getInstance();
      const presets = stackup.getAvailablePresets();
      expect(presets.length).toBeGreaterThanOrEqual(3);
      const names = presets.map((p) => p.name);
      expect(names).toContain('2-layer');
      expect(names).toContain('4-layer');
      expect(names).toContain('6-layer');
    });

    it('applies 2-layer preset', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('2-layer');
      expect(stackup.getLayerCount()).toBe(2);
      expect(stackup.getDielectrics()).toHaveLength(1);
    });

    it('applies 4-layer preset', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      expect(stackup.getLayerCount()).toBe(4);
      expect(stackup.getDielectrics()).toHaveLength(3);
      const layers = stackup.getAllLayers();
      expect(layers[0].type).toBe('signal');
      expect(layers[1].type).toBe('ground');
      expect(layers[2].type).toBe('power');
      expect(layers[3].type).toBe('signal');
    });

    it('applies 6-layer preset', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('6-layer');
      expect(stackup.getLayerCount()).toBe(6);
      expect(stackup.getDielectrics()).toHaveLength(5);
    });

    it('preset replaces existing layers', () => {
      const stackup = BoardStackup.getInstance();
      addSignalLayer(stackup, 'Old');
      addSignalLayer(stackup, 'Old2');
      stackup.applyPreset('2-layer');
      expect(stackup.getLayerCount()).toBe(2);
      const layers = stackup.getAllLayers();
      expect(layers[0].name).toBe('Top');
    });

    it('throws for unknown preset', () => {
      const stackup = BoardStackup.getInstance();
      expect(() => stackup.applyPreset('99-layer')).toThrow('Preset "99-layer" not found');
    });

    // -----------------------------------------------------------------------
    // applyLayerCount — E2E-233, Plan 02 Phase 6
    // -----------------------------------------------------------------------

    it('applyLayerCount(4) yields exactly 4 copper layers', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyLayerCount(4);
      expect(stackup.getLayerCount()).toBe(4);
    });

    it('applyLayerCount(6) yields 6 copper layers', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyLayerCount(6);
      expect(stackup.getLayerCount()).toBe(6);
    });

    it('applyLayerCount matches preset output for 4-layer when preset exists', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyLayerCount(4);
      const layers = stackup.getAllLayers();
      // 4-layer preset is Signal-Ground-Power-Signal
      expect(layers[0].type).toBe('signal');
      expect(layers[1].type).toBe('ground');
      expect(layers[2].type).toBe('power');
      expect(layers[3].type).toBe('signal');
    });

    it('applyLayerCount(5) falls back to programmatic build when no preset exists', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyLayerCount(5);
      expect(stackup.getLayerCount()).toBe(5);
    });

    it('applyLayerCount clamps below 2 and above 32', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyLayerCount(0);
      expect(stackup.getLayerCount()).toBe(2);
      stackup.applyLayerCount(999);
      expect(stackup.getLayerCount()).toBe(32);
    });

    it('applyLayerCount is a no-op when layer count already matches', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const originalIds = stackup.getAllLayers().map((l) => l.id);
      stackup.applyLayerCount(4);
      const nextIds = stackup.getAllLayers().map((l) => l.id);
      // No reassignment — ids preserved, which means the stackup was not
      // rebuilt (rebuilds mint new crypto.randomUUID ids).
      expect(nextIds).toEqual(originalIds);
    });

    it('presets have descriptions', () => {
      const stackup = BoardStackup.getInstance();
      const presets = stackup.getAvailablePresets();
      presets.forEach((p) => {
        expect(p.description.length).toBeGreaterThan(0);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  describe('validation', () => {
    it('errors on empty stackup', () => {
      const stackup = BoardStackup.getInstance();
      const result = stackup.validateStackup();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stackup has no copper layers');
    });

    it('warns on single layer', () => {
      const stackup = BoardStackup.getInstance();
      addSignalLayer(stackup);
      const result = stackup.validateStackup();
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('Single-layer'))).toBe(true);
    });

    it('warns on odd layer count', () => {
      const stackup = BoardStackup.getInstance();
      addSignalLayer(stackup);
      addGroundLayer(stackup);
      addSignalLayer(stackup);
      const result = stackup.validateStackup();
      expect(result.warnings.some((w) => w.includes('Odd layer count'))).toBe(true);
    });

    it('validates symmetric 4-layer preset', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const result = stackup.validateStackup();
      expect(result.valid).toBe(true);
      // 4-layer preset is signal-ground-power-signal (symmetric types)
      expect(result.errors).toHaveLength(0);
    });

    it('warns on asymmetric stackup', () => {
      const stackup = BoardStackup.getInstance();
      stackup.addLayer({ name: 'Top', type: 'signal', copperWeight: '1oz' });
      stackup.addLayer({ name: 'Inner1', type: 'ground', copperWeight: '1oz' });
      stackup.addLayer({ name: 'Inner2', type: 'power', copperWeight: '2oz' });
      stackup.addLayer({ name: 'Bottom', type: 'ground', copperWeight: '1oz' });
      const result = stackup.validateStackup();
      expect(result.warnings.some((w) => w.includes('not symmetric'))).toBe(true);
    });

    it('warns when no adjacent power/ground planes', () => {
      const stackup = BoardStackup.getInstance();
      stackup.addLayer({ name: 'L1', type: 'signal' });
      stackup.addLayer({ name: 'L2', type: 'signal' });
      stackup.addLayer({ name: 'L3', type: 'signal' });
      stackup.addLayer({ name: 'L4', type: 'signal' });
      const result = stackup.validateStackup();
      expect(result.warnings.some((w) => w.includes('No adjacent power/ground'))).toBe(true);
    });

    it('does not warn about adjacent planes when present', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const result = stackup.validateStackup();
      expect(result.warnings.some((w) => w.includes('No adjacent power/ground'))).toBe(false);
    });

    it('returns StackupValidation shape', () => {
      const stackup = BoardStackup.getInstance();
      addSignalLayer(stackup);
      const result: StackupValidation = stackup.validateStackup();
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Surface Finish
  // -----------------------------------------------------------------------

  describe('surface finish', () => {
    it('defaults to HASL', () => {
      const stackup = BoardStackup.getInstance();
      expect(stackup.getSurfaceFinish()).toBe('HASL');
    });

    it('sets and gets surface finish', () => {
      const stackup = BoardStackup.getInstance();
      stackup.setSurfaceFinish('ENIG');
      expect(stackup.getSurfaceFinish()).toBe('ENIG');
    });

    it('supports all surface finish types', () => {
      const stackup = BoardStackup.getInstance();
      const finishes: SurfaceFinish[] = ['HASL', 'ENIG', 'OSP', 'ENEPIG', 'Immersion_Tin', 'Immersion_Silver'];
      finishes.forEach((finish) => {
        stackup.setSurfaceFinish(finish);
        expect(stackup.getSurfaceFinish()).toBe(finish);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Export / Import
  // -----------------------------------------------------------------------

  describe('export / import', () => {
    it('exports stackup as valid JSON', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const json = stackup.exportStackup();
      const parsed = JSON.parse(json) as Record<string, unknown>;
      expect(parsed.layers).toBeDefined();
      expect(parsed.dielectrics).toBeDefined();
      expect(parsed.surfaceFinish).toBeDefined();
    });

    it('round-trips export and import', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      stackup.setSurfaceFinish('ENIG');
      const exported = stackup.exportStackup();

      // Reset and reimport
      const stackup2 = freshStackup();
      const result = stackup2.importStackup(exported);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(stackup2.getLayerCount()).toBe(4);
      expect(stackup2.getSurfaceFinish()).toBe('ENIG');
    });

    it('import fails on invalid JSON', () => {
      const stackup = BoardStackup.getInstance();
      const result = stackup.importStackup('not valid json {{{');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid JSON');
    });

    it('import fails on non-object', () => {
      const stackup = BoardStackup.getInstance();
      const result = stackup.importStackup('"just a string"');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Data must be an object');
    });

    it('import fails on missing layers array', () => {
      const stackup = BoardStackup.getInstance();
      const result = stackup.importStackup(JSON.stringify({ dielectrics: [] }));
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('layers'))).toBe(true);
    });

    it('import fails on missing dielectrics array', () => {
      const stackup = BoardStackup.getInstance();
      const result = stackup.importStackup(JSON.stringify({ layers: [] }));
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('dielectrics'))).toBe(true);
    });

    it('import fails on layer with invalid thickness', () => {
      const stackup = BoardStackup.getInstance();
      const result = stackup.importStackup(
        JSON.stringify({
          layers: [{ name: 'Bad', type: 'signal', thickness: -1 }],
          dielectrics: [],
        }),
      );
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid thickness'))).toBe(true);
    });

    it('import fails on layer missing name', () => {
      const stackup = BoardStackup.getInstance();
      const result = stackup.importStackup(
        JSON.stringify({
          layers: [{ type: 'signal', thickness: 1.4 }],
          dielectrics: [],
        }),
      );
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('missing name'))).toBe(true);
    });

    it('import succeeds with valid minimal data', () => {
      const stackup = BoardStackup.getInstance();
      const result = stackup.importStackup(
        JSON.stringify({
          layers: [{ name: 'Top', type: 'signal', thickness: 1.4, order: 0 }],
          dielectrics: [{ name: 'Core', thickness: 60, order: 1 }],
        }),
      );
      expect(result.success).toBe(true);
      expect(stackup.getLayerCount()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Material Database
  // -----------------------------------------------------------------------

  describe('material database', () => {
    it('contains FR4 with standard properties', () => {
      expect(MATERIAL_DATABASE.FR4.dielectricConstant).toBe(4.4);
      expect(MATERIAL_DATABASE.FR4.lossTangent).toBe(0.02);
    });

    it('contains Rogers4350B', () => {
      expect(MATERIAL_DATABASE.Rogers4350B.dielectricConstant).toBe(3.66);
      expect(MATERIAL_DATABASE.Rogers4350B.lossTangent).toBe(0.0037);
    });

    it('contains Rogers3003', () => {
      expect(MATERIAL_DATABASE.Rogers3003.dielectricConstant).toBe(3.0);
    });

    it('contains Isola370HR', () => {
      expect(MATERIAL_DATABASE.Isola370HR.dielectricConstant).toBe(3.92);
    });

    it('contains Megtron6', () => {
      expect(MATERIAL_DATABASE.Megtron6.dielectricConstant).toBe(3.71);
      expect(MATERIAL_DATABASE.Megtron6.lossTangent).toBe(0.002);
    });

    it('contains custom material', () => {
      expect(MATERIAL_DATABASE.custom).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // localStorage Persistence
  // -----------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('saves layers to localStorage on add', () => {
      const stackup = BoardStackup.getInstance();
      addSignalLayer(stackup, 'Persisted');
      expect(localStorage.setItem).toHaveBeenCalled();
      const saved = store['protopulse-board-stackup'];
      expect(saved).toBeDefined();
      expect(saved).toContain('Persisted');
    });

    it('loads layers from localStorage on init', () => {
      const stackup = BoardStackup.getInstance();
      addSignalLayer(stackup, 'SavedLayer');
      stackup.addDielectric({ name: 'SavedCore' });

      // Create new instance (simulating reload)
      BoardStackup.resetForTesting();
      const loaded = BoardStackup.getInstance();
      expect(loaded.getLayerCount()).toBe(1);
      expect(loaded.getAllLayers()[0].name).toBe('SavedLayer');
      expect(loaded.getDielectrics()[0].name).toBe('SavedCore');
    });

    it('persists surface finish', () => {
      const stackup = BoardStackup.getInstance();
      stackup.setSurfaceFinish('ENEPIG');

      BoardStackup.resetForTesting();
      const loaded = BoardStackup.getInstance();
      expect(loaded.getSurfaceFinish()).toBe('ENEPIG');
    });

    it('handles corrupt localStorage gracefully', () => {
      store['protopulse-board-stackup'] = 'not valid json!!!';
      BoardStackup.resetForTesting();
      const stackup = BoardStackup.getInstance();
      expect(stackup.getLayerCount()).toBe(0);
    });

    it('handles null localStorage value', () => {
      delete store['protopulse-board-stackup'];
      BoardStackup.resetForTesting();
      const stackup = BoardStackup.getInstance();
      expect(stackup.getLayerCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / Notify
  // -----------------------------------------------------------------------

  describe('subscribe / notify', () => {
    it('notifies listeners on addLayer', () => {
      const stackup = BoardStackup.getInstance();
      const listener = vi.fn();
      stackup.subscribe(listener);
      addSignalLayer(stackup);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on removeLayer', () => {
      const stackup = BoardStackup.getInstance();
      const id = addSignalLayer(stackup);
      const listener = vi.fn();
      stackup.subscribe(listener);
      stackup.removeLayer(id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on updateLayer', () => {
      const stackup = BoardStackup.getInstance();
      const id = addSignalLayer(stackup);
      const listener = vi.fn();
      stackup.subscribe(listener);
      stackup.updateLayer(id, { name: 'Changed' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on applyPreset', () => {
      const stackup = BoardStackup.getInstance();
      const listener = vi.fn();
      stackup.subscribe(listener);
      stackup.applyPreset('2-layer');
      expect(listener).toHaveBeenCalled();
    });

    it('notifies on setSurfaceFinish', () => {
      const stackup = BoardStackup.getInstance();
      const listener = vi.fn();
      stackup.subscribe(listener);
      stackup.setSurfaceFinish('OSP');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const stackup = BoardStackup.getInstance();
      const listener = vi.fn();
      const unsubscribe = stackup.subscribe(listener);
      unsubscribe();
      addSignalLayer(stackup);
      expect(listener).not.toHaveBeenCalled();
    });

    it('multiple listeners receive notifications', () => {
      const stackup = BoardStackup.getInstance();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      stackup.subscribe(listener1);
      stackup.subscribe(listener2);
      addSignalLayer(stackup);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('empty stackup has zero thickness', () => {
      const stackup = BoardStackup.getInstance();
      expect(stackup.getTotalThickness()).toBe(0);
      expect(stackup.getLayerCount()).toBe(0);
    });

    it('single layer stackup works', () => {
      const stackup = BoardStackup.getInstance();
      const id = addSignalLayer(stackup, 'Solo');
      expect(stackup.getLayerCount()).toBe(1);
      const result = stackup.calculateImpedance(id, 8);
      // Even without dielectric, should return some result
      expect(typeof result.microstrip).toBe('number');
    });

    it('handles many layers', () => {
      const stackup = BoardStackup.getInstance();
      const ids: string[] = [];
      for (let i = 0; i < 20; i++) {
        ids.push(stackup.addLayer({ name: `Layer ${i}`, type: i % 2 === 0 ? 'signal' : 'ground' }));
      }
      expect(stackup.getLayerCount()).toBe(20);
      expect(stackup.getAllLayers()).toHaveLength(20);
    });

    it('layer order auto-increments', () => {
      const stackup = BoardStackup.getInstance();
      addSignalLayer(stackup, 'A');
      addSignalLayer(stackup, 'B');
      addSignalLayer(stackup, 'C');
      const layers = stackup.getAllLayers();
      expect(layers[0].order).toBe(0);
      expect(layers[1].order).toBe(1);
      expect(layers[2].order).toBe(2);
    });

    it('dielectric order auto-increments', () => {
      const stackup = BoardStackup.getInstance();
      stackup.addDielectric({ name: 'D1' });
      stackup.addDielectric({ name: 'D2' });
      const dielectrics = stackup.getDielectrics();
      expect(dielectrics[0].order).toBe(0);
      expect(dielectrics[1].order).toBe(1);
    });

    it('default material is FR4', () => {
      const stackup = BoardStackup.getInstance();
      const id = addSignalLayer(stackup);
      const layer = stackup.getLayer(id);
      expect(layer!.material).toBe('FR4');
      expect(layer!.dielectricConstant).toBe(4.4);
    });

    it('default copper weight is 1oz', () => {
      const stackup = BoardStackup.getInstance();
      const id = addSignalLayer(stackup);
      const layer = stackup.getLayer(id);
      expect(layer!.copperWeight).toBe('1oz');
    });

    it('update only changes specified fields', () => {
      const stackup = BoardStackup.getInstance();
      const id = stackup.addLayer({
        name: 'Original',
        type: 'signal',
        material: 'Rogers4350B',
        thickness: 2.0,
        copperWeight: '2oz',
      });
      stackup.updateLayer(id, { name: 'Renamed' });
      const layer = stackup.getLayer(id);
      expect(layer!.name).toBe('Renamed');
      expect(layer!.material).toBe('Rogers4350B');
      expect(layer!.thickness).toBe(2.0);
      expect(layer!.copperWeight).toBe('2oz');
    });
  });

  // -----------------------------------------------------------------------
  // Hook shape
  // -----------------------------------------------------------------------

  describe('useBoardStackup hook', () => {
    it('exports the hook function', () => {
      expect(typeof useBoardStackup).toBe('function');
    });

    it('hook has correct return type shape', () => {
      // Verify the hook type signature exists and is a function
      // (Cannot call hooks outside React components, but we verify the export)
      const hookFn = useBoardStackup;
      expect(hookFn.length).toBe(0); // no required args
    });
  });

  // -----------------------------------------------------------------------
  // Additional impedance edge cases
  // -----------------------------------------------------------------------

  describe('impedance edge cases', () => {
    it('very thick dielectric produces higher impedance', () => {
      const stackup1 = freshStackup();
      stackup1.addLayer({ name: 'Top', type: 'signal' });
      stackup1.addDielectric({ name: 'Thin', thickness: 5 });
      stackup1.addLayer({ name: 'Bot', type: 'ground' });
      const layers1 = stackup1.getAllLayers();
      const z1 = stackup1.calculateImpedance(layers1[0].id, 6);

      const stackup2 = freshStackup();
      stackup2.addLayer({ name: 'Top', type: 'signal' });
      stackup2.addDielectric({ name: 'Thick', thickness: 40 });
      stackup2.addLayer({ name: 'Bot', type: 'ground' });
      const layers2 = stackup2.getAllLayers();
      const z2 = stackup2.calculateImpedance(layers2[0].id, 6);

      expect(z2.microstrip).toBeGreaterThan(z1.microstrip);
    });

    it('heavier copper weight slightly affects impedance', () => {
      const stackup1 = freshStackup();
      stackup1.addLayer({ name: 'Top', type: 'signal', copperWeight: '0.5oz' });
      stackup1.addDielectric({ name: 'Core', thickness: 20 });
      stackup1.addLayer({ name: 'Bot', type: 'ground' });
      const z1 = stackup1.calculateImpedance(stackup1.getAllLayers()[0].id, 6);

      const stackup2 = freshStackup();
      stackup2.addLayer({ name: 'Top', type: 'signal', copperWeight: '4oz' });
      stackup2.addDielectric({ name: 'Core', thickness: 20 });
      stackup2.addLayer({ name: 'Bot', type: 'ground' });
      const z2 = stackup2.calculateImpedance(stackup2.getAllLayers()[0].id, 6);

      // Thicker copper (T) reduces impedance slightly
      expect(z1.microstrip).toBeGreaterThan(z2.microstrip);
    });

    it('results are rounded to 2 decimal places', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('4-layer');
      const layers = stackup.getAllLayers();
      const result = stackup.calculateImpedance(layers[0].id, 7.3);
      const decimals = (n: number) => {
        const str = n.toString();
        const dot = str.indexOf('.');
        return dot === -1 ? 0 : str.length - dot - 1;
      };
      expect(decimals(result.microstrip)).toBeLessThanOrEqual(2);
      expect(decimals(result.stripline)).toBeLessThanOrEqual(2);
    });
  });

  // -----------------------------------------------------------------------
  // Validation additional cases
  // -----------------------------------------------------------------------

  describe('validation additional', () => {
    it('2-layer preset passes validation', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('2-layer');
      const result = stackup.validateStackup();
      expect(result.valid).toBe(true);
    });

    it('6-layer preset passes validation', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('6-layer');
      const result = stackup.validateStackup();
      expect(result.valid).toBe(true);
    });

    it('warns about no reference planes in multi-layer signal-only board', () => {
      const stackup = BoardStackup.getInstance();
      stackup.addLayer({ name: 'L1', type: 'signal' });
      stackup.addLayer({ name: 'L2', type: 'signal' });
      stackup.addLayer({ name: 'L3', type: 'signal' });
      const result = stackup.validateStackup();
      expect(result.warnings.some((w) => w.includes('No reference planes'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // addLayer input variations
  // -----------------------------------------------------------------------

  describe('addLayer input variations', () => {
    it('accepts minimal input', () => {
      const stackup = BoardStackup.getInstance();
      const input: AddLayerInput = { name: 'Minimal', type: 'ground' };
      const id = stackup.addLayer(input);
      const layer = stackup.getLayer(id);
      expect(layer).not.toBeNull();
      expect(layer!.material).toBe('FR4');
      expect(layer!.thickness).toBe(1.4);
    });

    it('accepts all layer types', () => {
      const stackup = BoardStackup.getInstance();
      const types = ['signal', 'power', 'ground', 'mixed'] as const;
      types.forEach((type) => {
        const id = stackup.addLayer({ name: `Layer-${type}`, type });
        expect(stackup.getLayer(id)!.type).toBe(type);
      });
    });

    it('accepts all copper weights', () => {
      const stackup = BoardStackup.getInstance();
      const weights = ['0.5oz', '1oz', '2oz', '3oz', '4oz'] as const;
      weights.forEach((cw) => {
        const id = stackup.addLayer({ name: `CW-${cw}`, type: 'signal', copperWeight: cw });
        expect(stackup.getLayer(id)!.copperWeight).toBe(cw);
      });
    });
  });
});
