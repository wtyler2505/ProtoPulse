import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DesignData, FabCapabilities, DfmCheckResult, BomItemLike } from '../dfm-checker';

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
import { DfmChecker, inferPackageType, bomToDfmInput } from '../dfm-checker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCleanDesign(): DesignData {
  return {
    traces: [{ id: 't1', width: 10, spacing: 10, layer: 'F.Cu', x: 500, y: 500 }],
    drills: [{ id: 'd1', diameter: 20, x: 500, y: 500, type: 'through' }],
    vias: [{ id: 'v1', drillDiameter: 12, outerDiameter: 30, x: 600, y: 600 }],
    pads: [{ id: 'p1', width: 50, height: 50, x: 700, y: 700 }],
    board: { width: 4000, height: 3000, thickness: 63, layerCount: 2 },
    silkscreen: [{ id: 's1', lineWidth: 10, x: 400, y: 400 }],
    solderMask: [{ id: 'sm1', bridgeWidth: 8, x: 300, y: 300 }],
    copperWeight: '1oz',
    surfaceFinish: 'HASL',
  };
}

function makeGenericCaps(): FabCapabilities {
  return {
    name: 'TestFab',
    minTraceWidth: 5,
    minTraceSpacing: 5,
    minDrillSize: 10,
    maxDrillSize: 250,
    minAnnularRing: 5,
    minViaDrill: 8,
    minViaOuterDiameter: 20,
    maxLayerCount: 4,
    minBoardThickness: 20,
    maxBoardThickness: 100,
    minBoardWidth: 200,
    maxBoardWidth: 20000,
    minBoardHeight: 200,
    maxBoardHeight: 20000,
    minSilkscreenWidth: 6,
    minSolderMaskBridge: 3,
    surfaceFinishes: ['HASL', 'ENIG'],
    minHoleToHoleSpacing: 8,
    minHoleToBoardEdge: 10,
    copperWeights: ['1oz', '2oz'],
  };
}

function makeEmptyDesign(): DesignData {
  return {
    traces: [],
    drills: [],
    vias: [],
    pads: [],
    board: { width: 4000, height: 3000, thickness: 63, layerCount: 2 },
    silkscreen: [],
    solderMask: [],
    copperWeight: '1oz',
    surfaceFinish: 'HASL',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DfmChecker', () => {
  let checker: InstanceType<typeof DfmChecker>;

  beforeEach(() => {
    DfmChecker.resetForTesting();
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    checker = DfmChecker.getInstance();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = DfmChecker.getInstance();
      const b = DfmChecker.getInstance();
      expect(a).toBe(b);
    });

    it('resets on resetForTesting', () => {
      const a = DfmChecker.getInstance();
      DfmChecker.resetForTesting();
      const b = DfmChecker.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe / Notify
  // -------------------------------------------------------------------------

  describe('subscribe/notify', () => {
    it('notifies listeners on runCheck', () => {
      const cb = vi.fn();
      checker.subscribe(cb);
      checker.runCheck(makeCleanDesign(), makeGenericCaps());
      expect(cb).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const cb = vi.fn();
      const unsub = checker.subscribe(cb);
      unsub();
      checker.runCheck(makeCleanDesign(), makeGenericCaps());
      expect(cb).not.toHaveBeenCalled();
    });

    it('notifies on addCustomFab', () => {
      const cb = vi.fn();
      checker.subscribe(cb);
      checker.addCustomFab('MyFab', makeGenericCaps());
      expect(cb).toHaveBeenCalled();
    });

    it('notifies on clearHistory', () => {
      const cb = vi.fn();
      checker.runCheck(makeCleanDesign(), makeGenericCaps());
      checker.subscribe(cb);
      checker.clearHistory();
      expect(cb).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Fab Management
  // -------------------------------------------------------------------------

  describe('fab management', () => {
    it('lists built-in fabs', () => {
      const fabs = checker.getAvailableFabs();
      expect(fabs).toContain('JLCPCB');
      expect(fabs).toContain('PCBWay');
      expect(fabs).toContain('OSHPark');
      expect(fabs).toContain('Generic_Budget');
    });

    it('getFabCapabilities returns built-in fab', () => {
      const caps = checker.getFabCapabilities('JLCPCB');
      expect(caps).toBeDefined();
      expect(caps!.name).toBe('JLCPCB');
      expect(caps!.minTraceWidth).toBe(3.5);
    });

    it('getFabCapabilities returns undefined for unknown', () => {
      expect(checker.getFabCapabilities('Nonexistent')).toBeUndefined();
    });

    it('addCustomFab makes fab available', () => {
      const custom = makeGenericCaps();
      custom.name = 'CustomFab';
      checker.addCustomFab('CustomFab', custom);
      expect(checker.getAvailableFabs()).toContain('CustomFab');
      expect(checker.getFabCapabilities('CustomFab')).toBeDefined();
    });

    it('removeCustomFab removes fab', () => {
      checker.addCustomFab('Temp', makeGenericCaps());
      expect(checker.removeCustomFab('Temp')).toBe(true);
      expect(checker.getAvailableFabs()).not.toContain('Temp');
    });

    it('removeCustomFab returns false for built-in', () => {
      expect(checker.removeCustomFab('JLCPCB')).toBe(false);
    });

    it('removeCustomFab returns false for nonexistent', () => {
      expect(checker.removeCustomFab('NoSuchFab')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 1: Trace Width
  // -------------------------------------------------------------------------

  describe('DFM-001: Minimum Trace Width', () => {
    it('passes when width >= minTraceWidth', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 10, spacing: 10, layer: 'F.Cu' }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-001');
      expect(v).toHaveLength(0);
    });

    it('fails when width < minTraceWidth', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 3, spacing: 10, layer: 'F.Cu', x: 100, y: 200 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-001');
      expect(v).toHaveLength(1);
      expect(v[0].severity).toBe('error');
      expect(v[0].category).toBe('trace');
      expect(v[0].actual).toBe(3);
      expect(v[0].required).toBe(5);
      expect(v[0].elementId).toBe('t1');
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 2: Trace Spacing
  // -------------------------------------------------------------------------

  describe('DFM-002: Minimum Trace Spacing', () => {
    it('passes when spacing >= minTraceSpacing', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 10, spacing: 10, layer: 'F.Cu' }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-002');
      expect(v).toHaveLength(0);
    });

    it('fails when spacing < minTraceSpacing', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 10, spacing: 2, layer: 'F.Cu', x: 50, y: 60 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-002');
      expect(v).toHaveLength(1);
      expect(v[0].severity).toBe('error');
      expect(v[0].actual).toBe(2);
      expect(v[0].required).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 3: Drill Size
  // -------------------------------------------------------------------------

  describe('DFM-003: Drill Size', () => {
    it('passes when drill size within range', () => {
      const design = makeCleanDesign();
      design.drills = [{ id: 'd1', diameter: 20, x: 500, y: 500, type: 'through' }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-003');
      expect(v).toHaveLength(0);
    });

    it('fails when drill too small', () => {
      const design = makeCleanDesign();
      design.drills = [{ id: 'd1', diameter: 5, x: 500, y: 500, type: 'through' }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-003');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].message).toContain('below minimum');
    });

    it('fails when drill too large', () => {
      const design = makeCleanDesign();
      design.drills = [{ id: 'd1', diameter: 300, x: 500, y: 500, type: 'through' }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-003');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v.some((viol) => viol.message.includes('exceeds maximum'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 4: Via Drill
  // -------------------------------------------------------------------------

  describe('DFM-004: Minimum Via Drill', () => {
    it('passes when via drill >= minViaDrill', () => {
      const design = makeCleanDesign();
      design.vias = [{ id: 'v1', drillDiameter: 12, outerDiameter: 30, x: 600, y: 600 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-004');
      expect(v).toHaveLength(0);
    });

    it('fails when via drill < minViaDrill', () => {
      const design = makeCleanDesign();
      design.vias = [{ id: 'v1', drillDiameter: 5, outerDiameter: 30, x: 600, y: 600 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-004');
      expect(v).toHaveLength(1);
      expect(v[0].actual).toBe(5);
      expect(v[0].required).toBe(8);
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 5: Via Outer Diameter
  // -------------------------------------------------------------------------

  describe('DFM-005: Minimum Via Outer Diameter', () => {
    it('passes when outer diameter >= minViaOuterDiameter', () => {
      const design = makeCleanDesign();
      design.vias = [{ id: 'v1', drillDiameter: 12, outerDiameter: 30, x: 600, y: 600 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-005');
      expect(v).toHaveLength(0);
    });

    it('fails when outer diameter < minViaOuterDiameter', () => {
      const design = makeCleanDesign();
      design.vias = [{ id: 'v1', drillDiameter: 12, outerDiameter: 15, x: 600, y: 600 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-005');
      expect(v).toHaveLength(1);
      expect(v[0].actual).toBe(15);
      expect(v[0].required).toBe(20);
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 6: Annular Ring
  // -------------------------------------------------------------------------

  describe('DFM-006: Minimum Annular Ring', () => {
    it('passes when annular ring >= minAnnularRing', () => {
      // (30 - 12) / 2 = 9 >= 5
      const design = makeCleanDesign();
      design.vias = [{ id: 'v1', drillDiameter: 12, outerDiameter: 30, x: 600, y: 600 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-006');
      expect(v).toHaveLength(0);
    });

    it('fails when annular ring < minAnnularRing', () => {
      // (16 - 12) / 2 = 2 < 5
      const design = makeCleanDesign();
      design.vias = [{ id: 'v1', drillDiameter: 12, outerDiameter: 16, x: 600, y: 600 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-006');
      expect(v).toHaveLength(1);
      expect(v[0].actual).toBe(2);
      expect(v[0].required).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 7: Board Dimensions
  // -------------------------------------------------------------------------

  describe('DFM-007: Board Dimensions', () => {
    it('passes with valid board dimensions', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-007');
      expect(v).toHaveLength(0);
    });

    it('fails when board width too small', () => {
      const design = makeCleanDesign();
      design.board.width = 100;
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-007' && v.message.includes('width'));
      expect(v.length).toBeGreaterThanOrEqual(1);
    });

    it('fails when board width too large', () => {
      const design = makeCleanDesign();
      design.board.width = 30000;
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-007' && v.message.includes('width'));
      expect(v.length).toBeGreaterThanOrEqual(1);
    });

    it('fails when board height too small', () => {
      const design = makeCleanDesign();
      design.board.height = 50;
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-007' && v.message.includes('height'));
      expect(v.length).toBeGreaterThanOrEqual(1);
    });

    it('fails when board height too large', () => {
      const design = makeCleanDesign();
      design.board.height = 25000;
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-007' && v.message.includes('height'));
      expect(v.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 8: Board Thickness
  // -------------------------------------------------------------------------

  describe('DFM-008: Board Thickness', () => {
    it('passes with valid thickness', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-008');
      expect(v).toHaveLength(0);
    });

    it('fails when thickness too thin', () => {
      const design = makeCleanDesign();
      design.board.thickness = 10;
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-008');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].message).toContain('below minimum');
    });

    it('fails when thickness too thick', () => {
      const design = makeCleanDesign();
      design.board.thickness = 200;
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-008');
      expect(v.length).toBeGreaterThanOrEqual(1);
      expect(v[0].message).toContain('exceeds maximum');
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 9: Layer Count
  // -------------------------------------------------------------------------

  describe('DFM-009: Maximum Layer Count', () => {
    it('passes when layer count <= max', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-009');
      expect(v).toHaveLength(0);
    });

    it('fails when layer count > max', () => {
      const design = makeCleanDesign();
      design.board.layerCount = 8;
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-009');
      expect(v).toHaveLength(1);
      expect(v[0].actual).toBe(8);
      expect(v[0].required).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 10: Silkscreen Width
  // -------------------------------------------------------------------------

  describe('DFM-010: Minimum Silkscreen Width', () => {
    it('passes when silkscreen width >= min', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-010');
      expect(v).toHaveLength(0);
    });

    it('fails when silkscreen width < min', () => {
      const design = makeCleanDesign();
      design.silkscreen = [{ id: 's1', lineWidth: 3, x: 100, y: 100 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-010');
      expect(v).toHaveLength(1);
      expect(v[0].severity).toBe('warning');
      expect(v[0].category).toBe('silkscreen');
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 11: Solder Mask Bridge
  // -------------------------------------------------------------------------

  describe('DFM-011: Minimum Solder Mask Bridge', () => {
    it('passes when bridge width >= min', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-011');
      expect(v).toHaveLength(0);
    });

    it('fails when bridge width < min', () => {
      const design = makeCleanDesign();
      design.solderMask = [{ id: 'sm1', bridgeWidth: 1, x: 100, y: 100 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-011');
      expect(v).toHaveLength(1);
      expect(v[0].severity).toBe('warning');
      expect(v[0].category).toBe('solder-mask');
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 12: Surface Finish
  // -------------------------------------------------------------------------

  describe('DFM-012: Surface Finish Supported', () => {
    it('passes when surface finish is supported', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-012');
      expect(v).toHaveLength(0);
    });

    it('fails when surface finish is not supported', () => {
      const design = makeCleanDesign();
      design.surfaceFinish = 'Gold Plating';
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-012');
      expect(v).toHaveLength(1);
      expect(v[0].severity).toBe('error');
      expect(v[0].message).toContain('Gold Plating');
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 13: Copper Weight
  // -------------------------------------------------------------------------

  describe('DFM-013: Copper Weight Supported', () => {
    it('passes when copper weight is supported', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-013');
      expect(v).toHaveLength(0);
    });

    it('fails when copper weight is not supported', () => {
      const design = makeCleanDesign();
      design.copperWeight = '4oz';
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-013');
      expect(v).toHaveLength(1);
      expect(v[0].severity).toBe('error');
      expect(v[0].category).toBe('copper');
      expect(v[0].message).toContain('4oz');
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 14: Hole-to-Hole Spacing
  // -------------------------------------------------------------------------

  describe('DFM-014: Minimum Hole-to-Hole Spacing', () => {
    it('passes when holes are far apart', () => {
      const design = makeCleanDesign();
      design.drills = [
        { id: 'd1', diameter: 20, x: 100, y: 100, type: 'through' },
        { id: 'd2', diameter: 20, x: 200, y: 100, type: 'through' },
      ];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-014');
      expect(v).toHaveLength(0);
    });

    it('fails when holes are too close', () => {
      const design = makeCleanDesign();
      design.drills = [
        { id: 'd1', diameter: 20, x: 100, y: 100, type: 'through' },
        { id: 'd2', diameter: 20, x: 104, y: 100, type: 'through' },
      ];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-014');
      expect(v).toHaveLength(1);
      expect(v[0].severity).toBe('error');
      expect(v[0].category).toBe('clearance');
    });
  });

  // -------------------------------------------------------------------------
  // DFM Rule 15: Hole-to-Board-Edge
  // -------------------------------------------------------------------------

  describe('DFM-015: Minimum Hole-to-Board-Edge Clearance', () => {
    it('passes when holes are far from edge', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-015');
      expect(v).toHaveLength(0);
    });

    it('fails when hole is too close to edge', () => {
      const design = makeCleanDesign();
      design.drills = [{ id: 'd1', diameter: 20, x: 5, y: 500, type: 'through' }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-015');
      expect(v).toHaveLength(1);
      expect(v[0].severity).toBe('error');
      expect(v[0].category).toBe('clearance');
      expect(v[0].actual).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // runCheck: Clean design
  // -------------------------------------------------------------------------

  describe('runCheck with clean design', () => {
    it('returns passed=true with zero violations', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.summary.errors).toBe(0);
      expect(result.summary.warnings).toBe(0);
      expect(result.summary.infos).toBe(0);
      expect(result.summary.passRate).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // runCheck: Multiple violations
  // -------------------------------------------------------------------------

  describe('runCheck with multiple violations', () => {
    it('returns multiple violations for a bad design', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 2, spacing: 2, layer: 'F.Cu', x: 100, y: 100 }];
      design.board.layerCount = 8;
      design.surfaceFinish = 'Unknown';
      const result = checker.runCheck(design, makeGenericCaps());
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
      expect(result.summary.errors).toBeGreaterThanOrEqual(3);
    });
  });

  // -------------------------------------------------------------------------
  // runCheckAgainstFab
  // -------------------------------------------------------------------------

  describe('runCheckAgainstFab', () => {
    it('checks against built-in fab by name', () => {
      const result = checker.runCheckAgainstFab(makeCleanDesign(), 'JLCPCB');
      expect(result.fabName).toBe('JLCPCB');
    });

    it('checks against custom fab by name', () => {
      checker.addCustomFab('MyFab', makeGenericCaps());
      const result = checker.runCheckAgainstFab(makeCleanDesign(), 'MyFab');
      expect(result.fabName).toBe('MyFab');
    });

    it('throws for unknown fab name', () => {
      expect(() => checker.runCheckAgainstFab(makeCleanDesign(), 'NoSuchFab')).toThrow('Fab "NoSuchFab" not found');
    });
  });

  // -------------------------------------------------------------------------
  // Fab preset validation
  // -------------------------------------------------------------------------

  describe('fab presets', () => {
    it('JLCPCB has expected capabilities', () => {
      const caps = checker.getFabCapabilities('JLCPCB');
      expect(caps).toBeDefined();
      expect(caps!.minTraceWidth).toBe(3.5);
      expect(caps!.maxLayerCount).toBe(32);
    });

    it('PCBWay has expected capabilities', () => {
      const caps = checker.getFabCapabilities('PCBWay');
      expect(caps).toBeDefined();
      expect(caps!.maxLayerCount).toBe(14);
    });

    it('OSHPark has expected capabilities', () => {
      const caps = checker.getFabCapabilities('OSHPark');
      expect(caps).toBeDefined();
      expect(caps!.minTraceWidth).toBe(5);
      expect(caps!.maxLayerCount).toBe(4);
    });

    it('Generic_Budget has expected capabilities', () => {
      const caps = checker.getFabCapabilities('Generic_Budget');
      expect(caps).toBeDefined();
      expect(caps!.minTraceWidth).toBe(6);
      expect(caps!.maxLayerCount).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Result summary
  // -------------------------------------------------------------------------

  describe('result summary', () => {
    it('counts errors, warnings, infos correctly', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 2, spacing: 2, layer: 'F.Cu' }]; // 2 errors
      design.silkscreen = [{ id: 's1', lineWidth: 2, x: 100, y: 100 }]; // 1 warning
      const result = checker.runCheck(design, makeGenericCaps());
      expect(result.summary.errors).toBeGreaterThanOrEqual(2);
      expect(result.summary.warnings).toBeGreaterThanOrEqual(1);
      expect(result.summary.totalChecks).toBeGreaterThan(0);
    });

    it('passRate is 100 for clean design', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      expect(result.summary.passRate).toBe(100);
    });

    it('passRate decreases with violations', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 2, spacing: 2, layer: 'F.Cu' }];
      const result = checker.runCheck(design, makeGenericCaps());
      expect(result.summary.passRate).toBeLessThan(100);
    });
  });

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  describe('check history', () => {
    it('stores check results', () => {
      checker.runCheck(makeCleanDesign(), makeGenericCaps());
      expect(checker.getCheckHistory()).toHaveLength(1);
    });

    it('accumulates history', () => {
      checker.runCheck(makeCleanDesign(), makeGenericCaps());
      checker.runCheck(makeCleanDesign(), makeGenericCaps());
      checker.runCheck(makeCleanDesign(), makeGenericCaps());
      expect(checker.getCheckHistory()).toHaveLength(3);
    });

    it('clears history', () => {
      checker.runCheck(makeCleanDesign(), makeGenericCaps());
      checker.clearHistory();
      expect(checker.getCheckHistory()).toHaveLength(0);
    });

    it('limits history to MAX_HISTORY entries', () => {
      for (let i = 0; i < 25; i++) {
        checker.runCheck(makeCleanDesign(), makeGenericCaps());
      }
      expect(checker.getCheckHistory().length).toBeLessThanOrEqual(20);
    });

    it('returns a copy (not reference)', () => {
      checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const h1 = checker.getCheckHistory();
      const h2 = checker.getCheckHistory();
      expect(h1).not.toBe(h2);
      expect(h1).toEqual(h2);
    });
  });

  // -------------------------------------------------------------------------
  // Compare results
  // -------------------------------------------------------------------------

  describe('compareResults', () => {
    it('detects added violations', () => {
      const a = checker.runCheck(makeCleanDesign(), makeGenericCaps());

      const badDesign = makeCleanDesign();
      badDesign.traces = [{ id: 't1', width: 2, spacing: 10, layer: 'F.Cu' }];
      const b = checker.runCheck(badDesign, makeGenericCaps());

      const diff = checker.compareResults(a, b);
      expect(diff.added.length).toBeGreaterThan(0);
      expect(diff.removed).toHaveLength(0);
    });

    it('detects removed violations', () => {
      const badDesign = makeCleanDesign();
      badDesign.traces = [{ id: 't1', width: 2, spacing: 10, layer: 'F.Cu' }];
      const a = checker.runCheck(badDesign, makeGenericCaps());
      const b = checker.runCheck(makeCleanDesign(), makeGenericCaps());

      const diff = checker.compareResults(a, b);
      expect(diff.removed.length).toBeGreaterThan(0);
      expect(diff.added).toHaveLength(0);
    });

    it('counts unchanged violations', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 2, spacing: 10, layer: 'F.Cu' }];
      const a = checker.runCheck(design, makeGenericCaps());
      const b = checker.runCheck(design, makeGenericCaps());

      const diff = checker.compareResults(a, b);
      expect(diff.unchanged).toBeGreaterThan(0);
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
    });

    it('handles two clean results', () => {
      const a = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const b = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const diff = checker.compareResults(a, b);
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.unchanged).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Export report
  // -------------------------------------------------------------------------

  describe('exportReport', () => {
    it('generates markdown report for clean design', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const report = checker.exportReport(result);
      expect(report).toContain('# DFM Check Report');
      expect(report).toContain('TestFab');
      expect(report).toContain('PASSED');
      expect(report).toContain('No violations found');
    });

    it('generates markdown report with violations', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 2, spacing: 2, layer: 'F.Cu' }];
      const result = checker.runCheck(design, makeGenericCaps());
      const report = checker.exportReport(result);
      expect(report).toContain('FAILED');
      expect(report).toContain('## Violations');
      expect(report).toContain('DFM-001');
      expect(report).toContain('ERROR');
    });

    it('includes summary table', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const report = checker.exportReport(result);
      expect(report).toContain('Total Checks');
      expect(report).toContain('Errors');
      expect(report).toContain('Warnings');
      expect(report).toContain('Pass Rate');
    });

    it('includes date in ISO format', () => {
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const report = checker.exportReport(result);
      expect(report).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty design (no traces/drills/vias/etc)', () => {
      const result = checker.runCheck(makeEmptyDesign(), makeGenericCaps());
      expect(result).toBeDefined();
      expect(result.summary.totalChecks).toBeGreaterThan(0);
      // Empty design still checks board dims, thickness, layers, surface, copper
    });

    it('handles design with zero board dimensions', () => {
      const design = makeEmptyDesign();
      design.board.width = 0;
      design.board.height = 0;
      const result = checker.runCheck(design, makeGenericCaps());
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('handles design with zero board thickness', () => {
      const design = makeEmptyDesign();
      design.board.thickness = 0;
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.filter((v) => v.ruleId === 'DFM-008');
      expect(v.length).toBeGreaterThanOrEqual(1);
    });

    it('each violation has a unique id', () => {
      const design = makeCleanDesign();
      design.traces = [
        { id: 't1', width: 2, spacing: 2, layer: 'F.Cu' },
        { id: 't2', width: 1, spacing: 1, layer: 'F.Cu' },
      ];
      const result = checker.runCheck(design, makeGenericCaps());
      const ids = result.violations.map((v) => v.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('violation has location when element provides coordinates', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 2, spacing: 10, layer: 'F.Cu', x: 42, y: 84 }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.find((v) => v.ruleId === 'DFM-001');
      expect(v).toBeDefined();
      expect(v!.location).toEqual({ x: 42, y: 84 });
    });

    it('violation has no location when element lacks coordinates', () => {
      const design = makeCleanDesign();
      design.traces = [{ id: 't1', width: 2, spacing: 10, layer: 'F.Cu' }];
      const result = checker.runCheck(design, makeGenericCaps());
      const v = result.violations.find((v) => v.ruleId === 'DFM-001');
      expect(v).toBeDefined();
      expect(v!.location).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // localStorage persistence
  // -------------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('persists custom fabs across instances', () => {
      checker.addCustomFab('PersistFab', makeGenericCaps());
      DfmChecker.resetForTesting();
      const newChecker = DfmChecker.getInstance();
      expect(newChecker.getAvailableFabs()).toContain('PersistFab');
    });

    it('persists history across instances', () => {
      checker.runCheck(makeCleanDesign(), makeGenericCaps());
      DfmChecker.resetForTesting();
      const newChecker = DfmChecker.getInstance();
      expect(newChecker.getCheckHistory().length).toBeGreaterThanOrEqual(1);
    });

    it('handles corrupt localStorage gracefully', () => {
      store['protopulse-dfm-checker'] = '{invalid json!!!';
      DfmChecker.resetForTesting();
      const newChecker = DfmChecker.getInstance();
      expect(newChecker.getAvailableFabs().length).toBeGreaterThanOrEqual(4); // built-ins
    });

    it('handles missing localStorage gracefully', () => {
      DfmChecker.resetForTesting();
      const newChecker = DfmChecker.getInstance();
      expect(newChecker.getCheckHistory()).toHaveLength(0);
      expect(newChecker.getAvailableFabs().length).toBeGreaterThanOrEqual(4);
    });
  });

  // -------------------------------------------------------------------------
  // Hook shape validation
  // -------------------------------------------------------------------------

  describe('useDfmChecker hook', () => {
    it('module exports useDfmChecker function', async () => {
      const mod = await import('../dfm-checker');
      expect(typeof mod.useDfmChecker).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // Additional coverage: timestamp and fabName
  // -------------------------------------------------------------------------

  describe('result metadata', () => {
    it('result has timestamp', () => {
      const before = Date.now();
      const result = checker.runCheck(makeCleanDesign(), makeGenericCaps());
      const after = Date.now();
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    it('result has fabName from capabilities', () => {
      const caps = makeGenericCaps();
      caps.name = 'SpecialFab';
      const result = checker.runCheck(makeCleanDesign(), caps);
      expect(result.fabName).toBe('SpecialFab');
    });
  });
});

// ---------------------------------------------------------------------------
// inferPackageType
// ---------------------------------------------------------------------------

describe('inferPackageType', () => {
  it('detects SOIC package from description', () => {
    expect(inferPackageType('IC SOIC-8 Package')).toBe('SOIC-8');
  });

  it('detects QFP package from description', () => {
    expect(inferPackageType('MCU TQFP-48')).toBe('TQFP-48');
  });

  it('detects QFN package', () => {
    expect(inferPackageType('LDO Regulator QFN-16')).toBe('QFN-16');
  });

  it('detects BGA package', () => {
    expect(inferPackageType('FPGA BGA-256')).toBe('BGA-256');
  });

  it('detects SOT-23 package', () => {
    expect(inferPackageType('Transistor SOT-23')).toBe('SOT-23');
  });

  it('detects SOT-223 package', () => {
    expect(inferPackageType('Regulator SOT-223')).toBe('SOT-223');
  });

  it('detects TO-220 package', () => {
    expect(inferPackageType('MOSFET TO-220')).toBe('TO-220');
  });

  it('detects TO-92 package', () => {
    expect(inferPackageType('Transistor TO-92')).toBe('TO-92');
  });

  it('detects DIP package', () => {
    expect(inferPackageType('IC DIP-16')).toBe('DIP-16');
  });

  it('detects chip package 0805', () => {
    expect(inferPackageType('Resistor 10K 0805')).toBe('0805');
  });

  it('detects chip package 0603', () => {
    expect(inferPackageType('Capacitor 100nF 0603')).toBe('0603');
  });

  it('detects chip package 0402', () => {
    expect(inferPackageType('Cap 0402')).toBe('0402');
  });

  it('detects chip package 0201', () => {
    expect(inferPackageType('Resistor 0201 1%')).toBe('0201');
  });

  it('detects chip package 1206', () => {
    expect(inferPackageType('Inductor 1206')).toBe('1206');
  });

  it('detects chip package 2512', () => {
    expect(inferPackageType('Power Resistor 2512')).toBe('2512');
  });

  it('detects chip package 1210', () => {
    expect(inferPackageType('Cap 1210 X7R')).toBe('1210');
  });

  it('detects TSSOP package', () => {
    expect(inferPackageType('ADC TSSOP-20')).toBe('TSSOP-20');
  });

  it('detects LQFP package', () => {
    expect(inferPackageType('STM32 LQFP-64')).toBe('LQFP-64');
  });

  it('detects MSOP package', () => {
    expect(inferPackageType('Op-amp MSOP-8')).toBe('MSOP-8');
  });

  it('detects package from partNumber when description has none', () => {
    expect(inferPackageType('Generic IC', 'ATMEGA328P-AU-QFP-32')).toBe('QFP-32');
  });

  it('detects 0805 from part number like RC0805JR', () => {
    expect(inferPackageType('Resistor', 'RC0805JR-0710KL')).toBe('0805');
  });

  it('returns unknown for unrecognized description', () => {
    expect(inferPackageType('Some random component')).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(inferPackageType('')).toBe('unknown');
  });

  it('case insensitive matching', () => {
    expect(inferPackageType('soic-8 package')).toBe('SOIC-8');
    expect(inferPackageType('SOIC-8 Package')).toBe('SOIC-8');
  });

  it('detects SOP package', () => {
    expect(inferPackageType('IC SOP-16')).toBe('SOP-16');
  });

  it('detects DFN package', () => {
    expect(inferPackageType('Sensor DFN-8')).toBe('DFN-8');
  });

  it('detects LGA package', () => {
    expect(inferPackageType('Accelerometer LGA-12')).toBe('LGA-12');
  });

  it('detects SIP package', () => {
    expect(inferPackageType('Resistor network SIP-8')).toBe('SIP-8');
  });

  it('detects TO-252 package', () => {
    expect(inferPackageType('Regulator TO-252')).toBe('TO-252');
  });

  it('detects SOT-89 package', () => {
    expect(inferPackageType('Voltage regulator SOT-89')).toBe('SOT-89');
  });
});

// ---------------------------------------------------------------------------
// bomToDfmInput
// ---------------------------------------------------------------------------

describe('bomToDfmInput', () => {
  function makeBomItem(overrides: Partial<BomItemLike> = {}): BomItemLike {
    return {
      partNumber: 'PART-001',
      description: 'Test component SOIC-8',
      manufacturer: 'TestCo',
      quantity: 1,
      ...overrides,
    };
  }

  it('returns valid DesignData with empty BOM', () => {
    const result = bomToDfmInput([]);
    expect(result.traces).toEqual([]);
    expect(result.vias).toEqual([]);
    expect(result.pads).toEqual([]);
    expect(result.drills).toEqual([]);
    expect(result.board.width).toBeGreaterThanOrEqual(1000);
    expect(result.board.height).toBeGreaterThanOrEqual(1000);
    expect(result.copperWeight).toBe('1oz');
    expect(result.surfaceFinish).toBe('HASL');
  });

  it('generates pads for SMD component (SOIC-8)', () => {
    const result = bomToDfmInput([makeBomItem({ description: 'IC SOIC-8', quantity: 1 })]);
    // SOIC-8 has 8 pins => 8 pads
    expect(result.pads.length).toBe(8);
    // No drills for SMD
    expect(result.drills.length).toBe(0);
  });

  it('generates pads and drills for THT component (DIP-16)', () => {
    const result = bomToDfmInput([makeBomItem({ description: 'IC DIP-16', quantity: 1 })]);
    // DIP-16 has 16 pins => 16 pads + 16 drills
    expect(result.pads.length).toBe(16);
    expect(result.drills.length).toBe(16);
    expect(result.drills[0].type).toBe('through');
    expect(result.drills[0].diameter).toBe(35);
  });

  it('generates drills for TO-220 component', () => {
    const result = bomToDfmInput([makeBomItem({ description: 'MOSFET TO-220', quantity: 1 })]);
    // TO-220 has 3 pins => 3 pads + 3 drills
    expect(result.pads.length).toBe(3);
    expect(result.drills.length).toBe(3);
    expect(result.drills[0].diameter).toBe(43);
  });

  it('generates drills for TO-92 component', () => {
    const result = bomToDfmInput([makeBomItem({ description: 'Transistor TO-92', quantity: 1 })]);
    expect(result.pads.length).toBe(3);
    expect(result.drills.length).toBe(3);
    expect(result.drills[0].diameter).toBe(30);
  });

  it('multiplies pads by quantity', () => {
    const result = bomToDfmInput([makeBomItem({ description: 'Cap 0805', quantity: 3 })]);
    // 0805 has 2 pins, quantity 3 => 6 pads
    expect(result.pads.length).toBe(6);
  });

  it('handles multiple BOM items', () => {
    const items: BomItemLike[] = [
      makeBomItem({ description: 'Resistor 0603', quantity: 2 }),
      makeBomItem({ description: 'IC DIP-8', quantity: 1 }),
    ];
    const result = bomToDfmInput(items);
    // 0603: 2 pins * 2 qty = 4 pads, DIP-8: 8 pins * 1 qty = 8 pads
    expect(result.pads.length).toBe(12);
    // DIP-8 generates drills: 8 drills
    expect(result.drills.length).toBe(8);
  });

  it('handles unknown package type with default 2 pins', () => {
    const result = bomToDfmInput([makeBomItem({ description: 'Mystery component', quantity: 1 })]);
    expect(result.pads.length).toBe(2);
    expect(result.drills.length).toBe(0);
  });

  it('handles missing description gracefully', () => {
    const result = bomToDfmInput([makeBomItem({ description: '', quantity: 1 })]);
    expect(result.pads.length).toBe(2); // Default 2 pads for unknown
    expect(result.drills.length).toBe(0);
  });

  it('pads have unique IDs', () => {
    const result = bomToDfmInput([
      makeBomItem({ description: 'IC SOIC-8', quantity: 2 }),
    ]);
    const ids = result.pads.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('drills have unique IDs', () => {
    const result = bomToDfmInput([
      makeBomItem({ description: 'IC DIP-16', quantity: 2 }),
    ]);
    const ids = result.drills.map((d) => d.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('board dimensions grow to fit components', () => {
    const smallResult = bomToDfmInput([makeBomItem({ description: 'Cap 0805', quantity: 1 })]);
    const largeResult = bomToDfmInput([makeBomItem({ description: 'Cap 0805', quantity: 50 })]);
    // More components should result in a larger board
    expect(largeResult.board.width).toBeGreaterThanOrEqual(smallResult.board.width);
    expect(largeResult.board.height).toBeGreaterThan(smallResult.board.height);
  });

  it('all pads have positive dimensions', () => {
    const result = bomToDfmInput([
      makeBomItem({ description: 'IC QFN-32', quantity: 1 }),
      makeBomItem({ description: 'Resistor 0402', quantity: 5 }),
      makeBomItem({ description: 'Transistor TO-220', quantity: 2 }),
    ]);
    for (const pad of result.pads) {
      expect(pad.width).toBeGreaterThan(0);
      expect(pad.height).toBeGreaterThan(0);
    }
  });

  it('all drills have positive diameter', () => {
    const result = bomToDfmInput([
      makeBomItem({ description: 'IC DIP-8', quantity: 2 }),
    ]);
    for (const drill of result.drills) {
      expect(drill.diameter).toBeGreaterThan(0);
    }
  });

  it('infers package from partNumber when description lacks package info', () => {
    const result = bomToDfmInput([makeBomItem({ description: 'Resistor 10K', partNumber: 'RC0805JR-0710KL', quantity: 1 })]);
    // Should detect 0805 from part number => 2 pads
    expect(result.pads.length).toBe(2);
  });

  it('generates correct pad sizes for BGA', () => {
    const result = bomToDfmInput([makeBomItem({ description: 'FPGA BGA-256', quantity: 1 })]);
    expect(result.pads.length).toBe(256);
    // BGA pads are small squares
    expect(result.pads[0].width).toBe(12);
    expect(result.pads[0].height).toBe(12);
  });

  it('generates SOT-23 with 3 pads', () => {
    const result = bomToDfmInput([makeBomItem({ description: 'Transistor SOT-23', quantity: 1 })]);
    expect(result.pads.length).toBe(3);
    expect(result.drills.length).toBe(0); // SMD
  });

  it('generates SOT-223 with 4 pads', () => {
    const result = bomToDfmInput([makeBomItem({ description: 'Regulator SOT-223', quantity: 1 })]);
    expect(result.pads.length).toBe(4);
    expect(result.drills.length).toBe(0); // SMD
  });

  it('result can be used directly with DfmChecker', () => {
    const items = [
      makeBomItem({ description: 'IC DIP-8', quantity: 1 }),
      makeBomItem({ description: 'Cap 0805', quantity: 5 }),
    ];
    const designData = bomToDfmInput(items);
    DfmChecker.resetForTesting();
    const checker = DfmChecker.getInstance();
    const result = checker.runCheckAgainstFab(designData, 'JLCPCB');
    expect(result).toBeDefined();
    expect(result.fabName).toBe('JLCPCB');
    expect(typeof result.passed).toBe('boolean');
    expect(result.summary.totalChecks).toBeGreaterThan(0);
  });
});
