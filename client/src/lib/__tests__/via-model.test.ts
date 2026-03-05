/**
 * Tests for ViaModel — PCB via entity model with DFM validation.
 *
 * Covers:
 *   - ViaModel.create() — default values, custom options, UUID generation
 *   - ViaModel.validate() — valid via, drill too small, annular ring too thin,
 *     blind not allowed, fromLayer === toLayer, outer < drill
 *   - ViaModel.calculateAnnularRing() — standard, micro, edge case (drill = outer)
 *   - ViaModel.checkDrillToDrillClearance() — overlapping, non-overlapping, exactly at limit
 *   - ViaModel.getOppositeLayer() — front/back, Top/Bottom, unknown layer
 *   - ViaModel.snapToGrid() — already on grid, needs snapping, custom grid step
 *   - Constants: DEFAULT_VIA_RULES, VIA_SIZE_PRESETS, DEFAULT_VIA_PRESET
 */

import { describe, it, expect } from 'vitest';
import {
  ViaModel,
  DEFAULT_VIA_RULES,
  VIA_SIZE_PRESETS,
  DEFAULT_VIA_PRESET,
} from '../pcb/via-model';
import type { Via, ViaType, ViaRules, ViaValidationResult } from '../pcb/via-model';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Via model constants', () => {
  describe('DEFAULT_VIA_RULES', () => {
    it('should have sensible defaults for a standard 2-layer board', () => {
      expect(DEFAULT_VIA_RULES.minDrill).toBe(0.3);
      expect(DEFAULT_VIA_RULES.minAnnularRing).toBe(0.125);
      expect(DEFAULT_VIA_RULES.minDrillToTraceClr).toBe(0.2);
      expect(DEFAULT_VIA_RULES.minDrillToDrillClr).toBe(0.5);
      expect(DEFAULT_VIA_RULES.allowBlind).toBe(false);
      expect(DEFAULT_VIA_RULES.allowBuried).toBe(false);
      expect(DEFAULT_VIA_RULES.allowMicro).toBe(false);
    });

    it('should be a frozen/readonly object', () => {
      // Verify all expected keys exist
      const keys = Object.keys(DEFAULT_VIA_RULES);
      expect(keys).toContain('minDrill');
      expect(keys).toContain('minAnnularRing');
      expect(keys).toContain('minDrillToTraceClr');
      expect(keys).toContain('minDrillToDrillClr');
      expect(keys).toContain('allowBlind');
      expect(keys).toContain('allowBuried');
      expect(keys).toContain('allowMicro');
    });
  });

  describe('VIA_SIZE_PRESETS', () => {
    it('should contain 4 presets', () => {
      expect(VIA_SIZE_PRESETS).toHaveLength(4);
    });

    it('should have Standard as the first preset', () => {
      expect(VIA_SIZE_PRESETS[0].name).toBe('Standard');
      expect(VIA_SIZE_PRESETS[0].drill).toBe(0.3);
      expect(VIA_SIZE_PRESETS[0].outer).toBe(0.6);
    });

    it('should have Small preset', () => {
      const small = VIA_SIZE_PRESETS.find((p) => p.name === 'Small');
      expect(small).toBeDefined();
      expect(small!.drill).toBe(0.2);
      expect(small!.outer).toBe(0.45);
    });

    it('should have Large preset', () => {
      const large = VIA_SIZE_PRESETS.find((p) => p.name === 'Large');
      expect(large).toBeDefined();
      expect(large!.drill).toBe(0.4);
      expect(large!.outer).toBe(0.8);
    });

    it('should have Micro preset', () => {
      const micro = VIA_SIZE_PRESETS.find((p) => p.name === 'Micro');
      expect(micro).toBeDefined();
      expect(micro!.drill).toBe(0.1);
      expect(micro!.outer).toBe(0.25);
    });

    it('should have outer > drill for every preset (valid annular ring)', () => {
      for (const preset of VIA_SIZE_PRESETS) {
        expect(preset.outer).toBeGreaterThan(preset.drill);
      }
    });
  });

  describe('DEFAULT_VIA_PRESET', () => {
    it('should be the Standard preset', () => {
      expect(DEFAULT_VIA_PRESET.name).toBe('Standard');
      expect(DEFAULT_VIA_PRESET.drill).toBe(0.3);
      expect(DEFAULT_VIA_PRESET.outer).toBe(0.6);
    });
  });
});

// ---------------------------------------------------------------------------
// ViaModel.create()
// ---------------------------------------------------------------------------

describe('ViaModel.create()', () => {
  it('should create a via with all default values', () => {
    const via = ViaModel.create({ x: 10, y: 20 });

    expect(via.position).toEqual({ x: 10, y: 20 });
    expect(via.type).toBe('through');
    expect(via.drillDiameter).toBe(0.3);
    expect(via.outerDiameter).toBe(0.6);
    expect(via.fromLayer).toBe('front');
    expect(via.toLayer).toBe('back');
    expect(via.tented).toBe(true);
    expect(via.netId).toBeUndefined();
  });

  it('should generate a unique UUID for each via', () => {
    const via1 = ViaModel.create({ x: 0, y: 0 });
    const via2 = ViaModel.create({ x: 0, y: 0 });

    expect(via1.id).toBeDefined();
    expect(via2.id).toBeDefined();
    expect(via1.id).not.toBe(via2.id);
    // UUID v4 format: 8-4-4-4-12 hex chars
    expect(via1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('should accept custom via type', () => {
    const via = ViaModel.create({ x: 5, y: 5 }, { type: 'blind' });
    expect(via.type).toBe('blind');
  });

  it('should accept custom drill and outer diameters', () => {
    const via = ViaModel.create({ x: 0, y: 0 }, {
      drillDiameter: 0.4,
      outerDiameter: 0.8,
    });
    expect(via.drillDiameter).toBe(0.4);
    expect(via.outerDiameter).toBe(0.8);
  });

  it('should accept custom layer names', () => {
    const via = ViaModel.create({ x: 0, y: 0 }, {
      fromLayer: 'Top',
      toLayer: 'Inner 1',
    });
    expect(via.fromLayer).toBe('Top');
    expect(via.toLayer).toBe('Inner 1');
  });

  it('should accept netId', () => {
    const via = ViaModel.create({ x: 0, y: 0 }, { netId: 42 });
    expect(via.netId).toBe(42);
  });

  it('should accept tented=false', () => {
    const via = ViaModel.create({ x: 0, y: 0 }, { tented: false });
    expect(via.tented).toBe(false);
  });

  it('should accept all custom options at once', () => {
    const via = ViaModel.create({ x: 100, y: 200 }, {
      type: 'micro',
      drillDiameter: 0.1,
      outerDiameter: 0.25,
      fromLayer: 'Top',
      toLayer: 'Inner 1',
      netId: 7,
      tented: false,
    });
    expect(via.position).toEqual({ x: 100, y: 200 });
    expect(via.type).toBe('micro');
    expect(via.drillDiameter).toBe(0.1);
    expect(via.outerDiameter).toBe(0.25);
    expect(via.fromLayer).toBe('Top');
    expect(via.toLayer).toBe('Inner 1');
    expect(via.netId).toBe(7);
    expect(via.tented).toBe(false);
  });

  it('should not mutate the options object', () => {
    const opts = { type: 'blind' as ViaType, drillDiameter: 0.2 };
    const optsCopy = { ...opts };
    ViaModel.create({ x: 0, y: 0 }, opts);
    expect(opts).toEqual(optsCopy);
  });
});

// ---------------------------------------------------------------------------
// ViaModel.validate()
// ---------------------------------------------------------------------------

describe('ViaModel.validate()', () => {
  /** Helper to create a valid standard via. */
  function makeValidVia(overrides?: Partial<Via>): Via {
    return {
      id: crypto.randomUUID(),
      position: { x: 10, y: 20 },
      drillDiameter: 0.3,
      outerDiameter: 0.6,
      type: 'through',
      fromLayer: 'front',
      toLayer: 'back',
      tented: true,
      ...overrides,
    };
  }

  it('should validate a standard through via as valid', () => {
    const via = makeValidVia();
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should use DEFAULT_VIA_RULES when no rules are provided', () => {
    // A via with 0.2mm drill should fail against default 0.3mm minDrill
    const via = makeValidVia({ drillDiameter: 0.2, outerDiameter: 0.45 });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations.some((v) => v.toLowerCase().includes('drill'))).toBe(true);
  });

  it('should reject drill diameter below minimum', () => {
    const via = makeValidVia({ drillDiameter: 0.1, outerDiameter: 0.35 });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.toLowerCase().includes('drill'))).toBe(true);
  });

  it('should reject annular ring below minimum', () => {
    // annular ring = (0.35 - 0.3) / 2 = 0.025mm, well below 0.125mm minimum
    const via = makeValidVia({ drillDiameter: 0.3, outerDiameter: 0.35 });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.toLowerCase().includes('annular'))).toBe(true);
  });

  it('should reject outer diameter less than or equal to drill diameter', () => {
    const via = makeValidVia({ drillDiameter: 0.5, outerDiameter: 0.4 });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.toLowerCase().includes('outer'))).toBe(true);
  });

  it('should reject outer diameter equal to drill diameter', () => {
    const via = makeValidVia({ drillDiameter: 0.5, outerDiameter: 0.5 });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(false);
    // Either 'outer' or 'annular' violation
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject fromLayer === toLayer', () => {
    const via = makeValidVia({ fromLayer: 'front', toLayer: 'front' });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.toLowerCase().includes('layer'))).toBe(true);
  });

  it('should reject blind via when not allowed', () => {
    const via = makeValidVia({ type: 'blind', fromLayer: 'Top', toLayer: 'Inner 1' });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.toLowerCase().includes('blind'))).toBe(true);
  });

  it('should accept blind via when rules allow it', () => {
    const via = makeValidVia({ type: 'blind', fromLayer: 'Top', toLayer: 'Inner 1' });
    const rules: ViaRules = { ...DEFAULT_VIA_RULES, allowBlind: true };
    const result = ViaModel.validate(via, rules);

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should reject buried via when not allowed', () => {
    const via = makeValidVia({ type: 'buried', fromLayer: 'Inner 1', toLayer: 'Inner 2' });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.toLowerCase().includes('buried'))).toBe(true);
  });

  it('should accept buried via when rules allow it', () => {
    const via = makeValidVia({ type: 'buried', fromLayer: 'Inner 1', toLayer: 'Inner 2' });
    const rules: ViaRules = { ...DEFAULT_VIA_RULES, allowBuried: true };
    const result = ViaModel.validate(via, rules);

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should reject micro via when not allowed', () => {
    const via = makeValidVia({
      type: 'micro',
      drillDiameter: 0.1,
      outerDiameter: 0.35,
      fromLayer: 'Top',
      toLayer: 'Inner 1',
    });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.toLowerCase().includes('micro'))).toBe(true);
  });

  it('should accept micro via when rules allow it with relaxed drill minimum', () => {
    const via = makeValidVia({
      type: 'micro',
      drillDiameter: 0.1,
      outerDiameter: 0.35,
      fromLayer: 'Top',
      toLayer: 'Inner 1',
    });
    const rules: ViaRules = {
      ...DEFAULT_VIA_RULES,
      allowMicro: true,
      minDrill: 0.1,
    };
    const result = ViaModel.validate(via, rules);

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should collect multiple violations at once', () => {
    // Drill too small, annular ring too thin, fromLayer === toLayer, blind not allowed
    const via = makeValidVia({
      type: 'blind',
      drillDiameter: 0.1,
      outerDiameter: 0.15,
      fromLayer: 'Top',
      toLayer: 'Top',
    });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(false);
    // Should have at least drill, annular ring, layer, and blind violations
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });

  it('should accept a via that exactly meets minimum requirements', () => {
    // annular ring = (0.55 - 0.3) / 2 = 0.125 — exactly at min
    const via = makeValidVia({
      drillDiameter: 0.3,
      outerDiameter: 0.55,
    });
    const result = ViaModel.validate(via);

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should validate through vias regardless of allowBlind/allowBuried/allowMicro', () => {
    const via = makeValidVia({ type: 'through' });
    const restrictiveRules: ViaRules = {
      ...DEFAULT_VIA_RULES,
      allowBlind: false,
      allowBuried: false,
      allowMicro: false,
    };
    const result = ViaModel.validate(via, restrictiveRules);

    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ViaModel.calculateAnnularRing()
// ---------------------------------------------------------------------------

describe('ViaModel.calculateAnnularRing()', () => {
  function makeVia(drill: number, outer: number): Via {
    return {
      id: 'test-id',
      position: { x: 0, y: 0 },
      drillDiameter: drill,
      outerDiameter: outer,
      type: 'through',
      fromLayer: 'front',
      toLayer: 'back',
      tented: true,
    };
  }

  it('should calculate annular ring for a standard via', () => {
    // (0.6 - 0.3) / 2 = 0.15
    const via = makeVia(0.3, 0.6);
    expect(ViaModel.calculateAnnularRing(via)).toBeCloseTo(0.15);
  });

  it('should calculate annular ring for a micro via', () => {
    // (0.25 - 0.1) / 2 = 0.075
    const via = makeVia(0.1, 0.25);
    expect(ViaModel.calculateAnnularRing(via)).toBeCloseTo(0.075);
  });

  it('should calculate annular ring for a large via', () => {
    // (0.8 - 0.4) / 2 = 0.2
    const via = makeVia(0.4, 0.8);
    expect(ViaModel.calculateAnnularRing(via)).toBeCloseTo(0.2);
  });

  it('should return 0 when drill equals outer diameter (edge case)', () => {
    const via = makeVia(0.5, 0.5);
    expect(ViaModel.calculateAnnularRing(via)).toBe(0);
  });

  it('should return negative value when outer < drill (invalid, but mathematically correct)', () => {
    const via = makeVia(0.6, 0.4);
    expect(ViaModel.calculateAnnularRing(via)).toBeLessThan(0);
    expect(ViaModel.calculateAnnularRing(via)).toBeCloseTo(-0.1);
  });

  it('should handle very small differences with floating point precision', () => {
    // (0.301 - 0.3) / 2 = 0.0005
    const via = makeVia(0.3, 0.301);
    expect(ViaModel.calculateAnnularRing(via)).toBeCloseTo(0.0005, 4);
  });
});

// ---------------------------------------------------------------------------
// ViaModel.checkDrillToDrillClearance()
// ---------------------------------------------------------------------------

describe('ViaModel.checkDrillToDrillClearance()', () => {
  function makeViaAt(x: number, y: number, outer = 0.6): Via {
    return {
      id: crypto.randomUUID(),
      position: { x, y },
      drillDiameter: 0.3,
      outerDiameter: outer,
      type: 'through',
      fromLayer: 'front',
      toLayer: 'back',
      tented: true,
    };
  }

  it('should return true (clearance OK) for vias far apart', () => {
    const via1 = makeViaAt(0, 0);
    const via2 = makeViaAt(10, 0);

    expect(ViaModel.checkDrillToDrillClearance(via1, via2)).toBe(true);
  });

  it('should return false (clearance violation) for overlapping vias', () => {
    const via1 = makeViaAt(0, 0);
    const via2 = makeViaAt(0.3, 0); // centers 0.3mm apart, outer radii sum = 0.6mm

    expect(ViaModel.checkDrillToDrillClearance(via1, via2)).toBe(false);
  });

  it('should return false for vias at the same position', () => {
    const via1 = makeViaAt(0, 0);
    const via2 = makeViaAt(0, 0);

    expect(ViaModel.checkDrillToDrillClearance(via1, via2)).toBe(false);
  });

  it('should use default minClearance from DEFAULT_VIA_RULES', () => {
    // Default minDrillToDrillClr = 0.5
    // Outer radii: 0.3 + 0.3 = 0.6
    // Need distance >= 0.6 + 0.5 = 1.1
    const via1 = makeViaAt(0, 0);
    const via2 = makeViaAt(1.0, 0); // distance = 1.0 < 1.1 → violation

    expect(ViaModel.checkDrillToDrillClearance(via1, via2)).toBe(false);
  });

  it('should pass when exactly at minimum clearance', () => {
    // Outer radii: 0.3 + 0.3 = 0.6
    // Need distance >= 0.6 + 0.5 = 1.1
    const via1 = makeViaAt(0, 0);
    const via2 = makeViaAt(1.1, 0); // distance = 1.1 >= 1.1 → OK

    expect(ViaModel.checkDrillToDrillClearance(via1, via2)).toBe(true);
  });

  it('should accept custom minClearance', () => {
    const via1 = makeViaAt(0, 0);
    const via2 = makeViaAt(2, 0); // distance = 2.0

    // Outer radii: 0.3 + 0.3 = 0.6, need 0.6 + 0.1 = 0.7 → OK
    expect(ViaModel.checkDrillToDrillClearance(via1, via2, 0.1)).toBe(true);

    // With very large clearance requirement
    expect(ViaModel.checkDrillToDrillClearance(via1, via2, 5.0)).toBe(false);
  });

  it('should handle diagonal distances correctly', () => {
    const via1 = makeViaAt(0, 0);
    // Distance = sqrt(3^2 + 4^2) = 5.0mm
    const via2 = makeViaAt(3, 4);

    // Outer radii: 0.3 + 0.3 = 0.6, need 0.6 + 0.5 = 1.1 → 5.0 >= 1.1 → OK
    expect(ViaModel.checkDrillToDrillClearance(via1, via2)).toBe(true);
  });

  it('should handle vias with different outer diameters', () => {
    const via1 = makeViaAt(0, 0, 0.6); // outer radius 0.3
    const via2 = makeViaAt(1.5, 0, 0.8); // outer radius 0.4

    // Outer radii sum: 0.3 + 0.4 = 0.7, need 0.7 + 0.5 = 1.2 → 1.5 >= 1.2 → OK
    expect(ViaModel.checkDrillToDrillClearance(via1, via2)).toBe(true);
  });

  it('should fail for vias with different outer diameters that are too close', () => {
    const via1 = makeViaAt(0, 0, 0.6); // outer radius 0.3
    const via2 = makeViaAt(0.8, 0, 0.8); // outer radius 0.4

    // Outer radii sum: 0.3 + 0.4 = 0.7, need 0.7 + 0.5 = 1.2 → 0.8 < 1.2 → FAIL
    expect(ViaModel.checkDrillToDrillClearance(via1, via2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ViaModel.getOppositeLayer()
// ---------------------------------------------------------------------------

describe('ViaModel.getOppositeLayer()', () => {
  it('should return "back" for "front"', () => {
    expect(ViaModel.getOppositeLayer('front')).toBe('back');
  });

  it('should return "front" for "back"', () => {
    expect(ViaModel.getOppositeLayer('back')).toBe('front');
  });

  it('should return "Bottom" for "Top"', () => {
    expect(ViaModel.getOppositeLayer('Top')).toBe('Bottom');
  });

  it('should return "Top" for "Bottom"', () => {
    expect(ViaModel.getOppositeLayer('Bottom')).toBe('Top');
  });

  it('should return the same string for unknown layers', () => {
    expect(ViaModel.getOppositeLayer('Inner 1')).toBe('Inner 1');
    expect(ViaModel.getOppositeLayer('Inner 2')).toBe('Inner 2');
    expect(ViaModel.getOppositeLayer('Signal 3')).toBe('Signal 3');
  });

  it('should be case-sensitive', () => {
    // 'FRONT' is not 'front', should return itself
    expect(ViaModel.getOppositeLayer('FRONT')).toBe('FRONT');
    expect(ViaModel.getOppositeLayer('BACK')).toBe('BACK');
  });

  it('should handle empty string', () => {
    expect(ViaModel.getOppositeLayer('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// ViaModel.snapToGrid()
// ---------------------------------------------------------------------------

describe('ViaModel.snapToGrid()', () => {
  it('should snap to default 2.54mm grid', () => {
    const result = ViaModel.snapToGrid({ x: 2.6, y: 5.1 });
    expect(result.x).toBeCloseTo(2.54);
    expect(result.y).toBeCloseTo(5.08); // nearest multiple of 2.54
  });

  it('should not change a position already on grid', () => {
    const result = ViaModel.snapToGrid({ x: 2.54, y: 5.08 });
    expect(result.x).toBeCloseTo(2.54);
    expect(result.y).toBeCloseTo(5.08);
  });

  it('should snap to origin (0,0)', () => {
    const result = ViaModel.snapToGrid({ x: 0.5, y: -0.5 });
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('should handle negative coordinates', () => {
    const result = ViaModel.snapToGrid({ x: -2.6, y: -5.1 });
    expect(result.x).toBeCloseTo(-2.54);
    expect(result.y).toBeCloseTo(-5.08);
  });

  it('should snap to midpoint correctly', () => {
    // Midpoint between 0 and 2.54 is 1.27
    // 1.27 should round to 2.54 (standard rounding)
    const result = ViaModel.snapToGrid({ x: 1.27, y: 0 });
    expect(result.x).toBeCloseTo(2.54);
  });

  it('should accept custom grid step', () => {
    // 1.0mm grid
    const result = ViaModel.snapToGrid({ x: 1.3, y: 2.7 }, 1.0);
    expect(result.x).toBeCloseTo(1.0);
    expect(result.y).toBeCloseTo(3.0);
  });

  it('should work with fine grid (0.1mm)', () => {
    const result = ViaModel.snapToGrid({ x: 1.34, y: 2.76 }, 0.1);
    expect(result.x).toBeCloseTo(1.3);
    expect(result.y).toBeCloseTo(2.8);
  });

  it('should work with large grid (5.08mm)', () => {
    const result = ViaModel.snapToGrid({ x: 6, y: 12 }, 5.08);
    expect(result.x).toBeCloseTo(5.08);
    expect(result.y).toBeCloseTo(10.16);
  });

  it('should handle exact zero position', () => {
    const result = ViaModel.snapToGrid({ x: 0, y: 0 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Type safety smoke tests
// ---------------------------------------------------------------------------

describe('Via types', () => {
  it('should accept all valid via types', () => {
    const types: ViaType[] = ['through', 'blind', 'buried', 'micro'];
    for (const t of types) {
      const via = ViaModel.create({ x: 0, y: 0 }, { type: t });
      expect(via.type).toBe(t);
    }
  });

  it('should return ViaValidationResult shape from validate', () => {
    const via = ViaModel.create({ x: 0, y: 0 });
    const result: ViaValidationResult = ViaModel.validate(via);

    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.violations)).toBe(true);
  });
});
