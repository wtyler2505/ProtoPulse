import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

vi.stubGlobal('crypto', {
  randomUUID: vi.fn<() => string>(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

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

// Must import after mocks so BoardStackup picks up the stubbed localStorage
// eslint-disable-next-line import-x/first
import { BoardStackup } from '../board-stackup';
// eslint-disable-next-line import-x/first
import {
  NetClassManager,
  DEFAULT_NET_CLASSES,
  createDefaultNetClassManager,
} from '../pcb/net-class-rules';
// eslint-disable-next-line import-x/first
import type { NetClass } from '../pcb/net-class-rules';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshManager(): NetClassManager {
  return createDefaultNetClassManager();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NetClassManager', () => {
  let mgr: NetClassManager;

  beforeEach(() => {
    mgr = freshManager();
    // Reset BoardStackup so impedance tests have a clean slate
    BoardStackup.resetForTesting();
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  });

  // -----------------------------------------------------------------------
  // Default classes
  // -----------------------------------------------------------------------

  describe('default classes', () => {
    it('should have 3 built-in net classes', () => {
      expect(mgr.getNetClasses()).toHaveLength(3);
    });

    it('should include Default, Power, and High-Speed classes', () => {
      const names = mgr.getNetClasses().map((c) => c.name);
      expect(names).toContain('Default');
      expect(names).toContain('Power');
      expect(names).toContain('High-Speed');
    });

    it('should always have a Default class', () => {
      const def = mgr.getNetClass('Default');
      expect(def).toBeDefined();
      expect(def!.traceWidth).toBe(0.254);
      expect(def!.clearance).toBe(0.2);
      expect(def!.viaDrill).toBe(0.3);
      expect(def!.viaOuter).toBe(0.6);
    });

    it('should match exported DEFAULT_NET_CLASSES values', () => {
      for (const [name, expected] of Object.entries(DEFAULT_NET_CLASSES)) {
        const actual = mgr.getNetClass(name);
        expect(actual).toBeDefined();
        expect(actual!.traceWidth).toBe(expected.traceWidth);
        expect(actual!.clearance).toBe(expected.clearance);
        expect(actual!.viaDrill).toBe(expected.viaDrill);
        expect(actual!.viaOuter).toBe(expected.viaOuter);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Add class
  // -----------------------------------------------------------------------

  describe('addNetClass', () => {
    it('should add a new net class', () => {
      mgr.addNetClass({
        name: 'Analog',
        traceWidth: 0.3,
        clearance: 0.25,
        viaDrill: 0.35,
        viaOuter: 0.7,
      });
      expect(mgr.getNetClasses()).toHaveLength(4);
      expect(mgr.getNetClass('Analog')).toBeDefined();
    });

    it('should reject duplicate name', () => {
      expect(() =>
        mgr.addNetClass({
          name: 'Default',
          traceWidth: 0.3,
          clearance: 0.25,
          viaDrill: 0.35,
          viaOuter: 0.7,
        }),
      ).toThrow(/already exists/i);
    });

    it('should validate the class before adding', () => {
      expect(() =>
        mgr.addNetClass({
          name: 'Bad',
          traceWidth: -1,
          clearance: 0.2,
          viaDrill: 0.3,
          viaOuter: 0.6,
        }),
      ).toThrow();
    });

    it('should add class with differential pair properties', () => {
      mgr.addNetClass({
        name: 'USB',
        traceWidth: 0.15,
        clearance: 0.15,
        viaDrill: 0.2,
        viaOuter: 0.45,
        diffPairWidth: 0.1,
        diffPairGap: 0.15,
      });
      const usb = mgr.getNetClass('USB');
      expect(usb).toBeDefined();
      expect(usb!.diffPairWidth).toBe(0.1);
      expect(usb!.diffPairGap).toBe(0.15);
    });
  });

  // -----------------------------------------------------------------------
  // Remove class
  // -----------------------------------------------------------------------

  describe('removeNetClass', () => {
    it('should remove a non-Default class', () => {
      mgr.removeNetClass('Power');
      expect(mgr.getNetClass('Power')).toBeUndefined();
      expect(mgr.getNetClasses()).toHaveLength(2);
    });

    it('should throw when removing Default class', () => {
      expect(() => mgr.removeNetClass('Default')).toThrow(/cannot remove/i);
    });

    it('should throw for non-existent class', () => {
      expect(() => mgr.removeNetClass('NonExistent')).toThrow(/not found/i);
    });

    it('should unassign nets when their class is removed', () => {
      mgr.assignNetToClass('net-1', 'Power');
      expect(mgr.getClassForNet('net-1').name).toBe('Power');

      mgr.removeNetClass('Power');
      // Falls back to Default
      expect(mgr.getClassForNet('net-1').name).toBe('Default');
    });
  });

  // -----------------------------------------------------------------------
  // Update class
  // -----------------------------------------------------------------------

  describe('updateNetClass', () => {
    it('should partially update a class', () => {
      mgr.updateNetClass('Power', { traceWidth: 0.75 });
      const power = mgr.getNetClass('Power');
      expect(power!.traceWidth).toBe(0.75);
      // Other fields unchanged
      expect(power!.clearance).toBe(0.3);
    });

    it('should throw for non-existent class', () => {
      expect(() => mgr.updateNetClass('Nope', { traceWidth: 1 })).toThrow(/not found/i);
    });

    it('should validate updated values', () => {
      expect(() => mgr.updateNetClass('Power', { traceWidth: 0 })).toThrow();
    });

    it('should not allow renaming to an existing class name', () => {
      expect(() => mgr.updateNetClass('Power', { name: 'Default' })).toThrow(/already exists/i);
    });

    it('should allow renaming to a new unique name', () => {
      mgr.updateNetClass('Power', { name: 'Heavy Power' });
      expect(mgr.getNetClass('Power')).toBeUndefined();
      expect(mgr.getNetClass('Heavy Power')).toBeDefined();
    });

    it('should update net assignments when class is renamed', () => {
      mgr.assignNetToClass('net-1', 'Power');
      mgr.updateNetClass('Power', { name: 'Heavy Power' });
      expect(mgr.getClassForNet('net-1').name).toBe('Heavy Power');
    });
  });

  // -----------------------------------------------------------------------
  // Net-to-class assignment
  // -----------------------------------------------------------------------

  describe('assignment', () => {
    it('should assign a net to a class', () => {
      mgr.assignNetToClass('net-1', 'Power');
      expect(mgr.getClassForNet('net-1').name).toBe('Power');
    });

    it('should return Default for unassigned nets', () => {
      expect(mgr.getClassForNet('unassigned-net').name).toBe('Default');
    });

    it('should unassign a net', () => {
      mgr.assignNetToClass('net-1', 'Power');
      mgr.unassignNet('net-1');
      expect(mgr.getClassForNet('net-1').name).toBe('Default');
    });

    it('should throw when assigning to non-existent class', () => {
      expect(() => mgr.assignNetToClass('net-1', 'NonExistent')).toThrow(/not found/i);
    });

    it('should allow reassigning a net to a different class', () => {
      mgr.assignNetToClass('net-1', 'Power');
      mgr.assignNetToClass('net-1', 'High-Speed');
      expect(mgr.getClassForNet('net-1').name).toBe('High-Speed');
    });

    it('should unassign gracefully for already-unassigned net', () => {
      // Should not throw
      mgr.unassignNet('never-assigned');
      expect(mgr.getClassForNet('never-assigned').name).toBe('Default');
    });
  });

  // -----------------------------------------------------------------------
  // Convenience getters
  // -----------------------------------------------------------------------

  describe('convenience getters', () => {
    it('getTraceWidth returns correct width for assigned net', () => {
      mgr.assignNetToClass('net-1', 'Power');
      expect(mgr.getTraceWidth('net-1')).toBe(0.5);
    });

    it('getTraceWidth returns Default width for unassigned net', () => {
      expect(mgr.getTraceWidth('unassigned')).toBe(0.254);
    });

    it('getClearance returns correct clearance for assigned net', () => {
      mgr.assignNetToClass('net-1', 'High-Speed');
      expect(mgr.getClearance('net-1')).toBe(0.15);
    });

    it('getClearance returns Default clearance for unassigned net', () => {
      expect(mgr.getClearance('unassigned')).toBe(0.2);
    });

    it('getViaRules returns correct via dimensions for assigned net', () => {
      mgr.assignNetToClass('net-1', 'Power');
      const rules = mgr.getViaRules('net-1');
      expect(rules.drill).toBe(0.4);
      expect(rules.outer).toBe(0.8);
    });

    it('getViaRules returns Default via dimensions for unassigned net', () => {
      const rules = mgr.getViaRules('unassigned');
      expect(rules.drill).toBe(0.3);
      expect(rules.outer).toBe(0.6);
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  describe('validateNetClass', () => {
    it('should accept a valid net class', () => {
      const result = mgr.validateNetClass({
        name: 'Good',
        traceWidth: 0.3,
        clearance: 0.2,
        viaDrill: 0.3,
        viaOuter: 0.6,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty name', () => {
      const result = mgr.validateNetClass({
        name: '',
        traceWidth: 0.3,
        clearance: 0.2,
        viaDrill: 0.3,
        viaOuter: 0.6,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /name/i.test(e))).toBe(true);
    });

    it('should reject negative traceWidth', () => {
      const result = mgr.validateNetClass({
        name: 'Bad',
        traceWidth: -0.1,
        clearance: 0.2,
        viaDrill: 0.3,
        viaOuter: 0.6,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /traceWidth/i.test(e))).toBe(true);
    });

    it('should reject zero traceWidth', () => {
      const result = mgr.validateNetClass({
        name: 'Bad',
        traceWidth: 0,
        clearance: 0.2,
        viaDrill: 0.3,
        viaOuter: 0.6,
      });
      expect(result.valid).toBe(false);
    });

    it('should reject zero clearance', () => {
      const result = mgr.validateNetClass({
        name: 'Bad',
        traceWidth: 0.3,
        clearance: 0,
        viaDrill: 0.3,
        viaOuter: 0.6,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /clearance/i.test(e))).toBe(true);
    });

    it('should reject zero viaDrill', () => {
      const result = mgr.validateNetClass({
        name: 'Bad',
        traceWidth: 0.3,
        clearance: 0.2,
        viaDrill: 0,
        viaOuter: 0.6,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /viaDrill/i.test(e))).toBe(true);
    });

    it('should reject viaOuter <= viaDrill', () => {
      const result = mgr.validateNetClass({
        name: 'Bad',
        traceWidth: 0.3,
        clearance: 0.2,
        viaDrill: 0.6,
        viaOuter: 0.6,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /viaOuter.*viaDrill/i.test(e))).toBe(true);
    });

    it('should reject viaOuter less than viaDrill', () => {
      const result = mgr.validateNetClass({
        name: 'Bad',
        traceWidth: 0.3,
        clearance: 0.2,
        viaDrill: 0.6,
        viaOuter: 0.4,
      });
      expect(result.valid).toBe(false);
    });

    it('should reject diffPairGap <= 0 when diffPairWidth is set', () => {
      const result = mgr.validateNetClass({
        name: 'Bad',
        traceWidth: 0.15,
        clearance: 0.15,
        viaDrill: 0.2,
        viaOuter: 0.45,
        diffPairWidth: 0.1,
        diffPairGap: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /diffPairGap/i.test(e))).toBe(true);
    });

    it('should accept valid differential pair settings', () => {
      const result = mgr.validateNetClass({
        name: 'USB',
        traceWidth: 0.15,
        clearance: 0.15,
        viaDrill: 0.2,
        viaOuter: 0.45,
        diffPairWidth: 0.1,
        diffPairGap: 0.15,
      });
      expect(result.valid).toBe(true);
    });

    it('should validate partial net class (missing optional fields)', () => {
      const result = mgr.validateNetClass({
        name: 'Partial',
        traceWidth: 0.3,
        clearance: 0.2,
        viaDrill: 0.3,
        viaOuter: 0.6,
      });
      expect(result.valid).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Impedance-aware width calculation
  // -----------------------------------------------------------------------

  describe('calculateImpedanceWidth', () => {
    it('should return null when no stackup is configured', () => {
      // BoardStackup has no layers by default after reset
      const width = mgr.calculateImpedanceWidth(50, 'front');
      expect(width).toBeNull();
    });

    it('should return a positive width for a valid target impedance with stackup', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('2-layer');

      const width = mgr.calculateImpedanceWidth(50, 'Top');
      expect(width).not.toBeNull();
      expect(width!).toBeGreaterThan(0);
    });

    it('should return wider trace for lower impedance', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('2-layer');

      const w50 = mgr.calculateImpedanceWidth(50, 'Top');
      const w75 = mgr.calculateImpedanceWidth(75, 'Top');

      expect(w50).not.toBeNull();
      expect(w75).not.toBeNull();
      // Lower impedance requires wider trace
      expect(w50!).toBeGreaterThan(w75!);
    });

    it('should return null for invalid layer name', () => {
      const stackup = BoardStackup.getInstance();
      stackup.applyPreset('2-layer');

      const width = mgr.calculateImpedanceWidth(50, 'NonExistentLayer');
      expect(width).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  describe('serialization', () => {
    it('should round-trip with toJSON/fromJSON', () => {
      mgr.addNetClass({
        name: 'Custom',
        traceWidth: 0.35,
        clearance: 0.22,
        viaDrill: 0.28,
        viaOuter: 0.55,
      });
      mgr.assignNetToClass('net-1', 'Power');
      mgr.assignNetToClass('net-2', 'Custom');

      const json = mgr.toJSON();
      const restored = NetClassManager.fromJSON(json);

      // Classes preserved
      expect(restored.getNetClasses()).toHaveLength(4);
      expect(restored.getNetClass('Custom')).toBeDefined();
      expect(restored.getNetClass('Custom')!.traceWidth).toBe(0.35);

      // Assignments preserved
      expect(restored.getClassForNet('net-1').name).toBe('Power');
      expect(restored.getClassForNet('net-2').name).toBe('Custom');
      expect(restored.getClassForNet('net-3').name).toBe('Default');
    });

    it('should handle fromJSON with invalid data gracefully', () => {
      expect(() => NetClassManager.fromJSON(null)).toThrow();
      expect(() => NetClassManager.fromJSON('bad data')).toThrow();
    });

    it('should preserve differential pair properties in round-trip', () => {
      mgr.addNetClass({
        name: 'USB',
        traceWidth: 0.15,
        clearance: 0.15,
        viaDrill: 0.2,
        viaOuter: 0.45,
        diffPairWidth: 0.1,
        diffPairGap: 0.15,
      });

      const json = mgr.toJSON();
      const restored = NetClassManager.fromJSON(json);

      const usb = restored.getNetClass('USB');
      expect(usb).toBeDefined();
      expect(usb!.diffPairWidth).toBe(0.1);
      expect(usb!.diffPairGap).toBe(0.15);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('getNetClass returns undefined for non-existent class', () => {
      expect(mgr.getNetClass('DoesNotExist')).toBeUndefined();
    });

    it('should handle many net assignments efficiently', () => {
      for (let i = 0; i < 100; i++) {
        mgr.assignNetToClass(`net-${String(i)}`, 'Power');
      }
      expect(mgr.getClassForNet('net-50').name).toBe('Power');
      expect(mgr.getClassForNet('net-99').name).toBe('Power');
    });

    it('should handle creating a class with name containing special characters', () => {
      mgr.addNetClass({
        name: 'USB 3.0 (High-Speed)',
        traceWidth: 0.15,
        clearance: 0.15,
        viaDrill: 0.2,
        viaOuter: 0.45,
      });
      expect(mgr.getNetClass('USB 3.0 (High-Speed)')).toBeDefined();
    });

    it('should not rename Default class', () => {
      expect(() => mgr.updateNetClass('Default', { name: 'Changed' })).toThrow(/cannot rename.*default/i);
    });
  });
});
