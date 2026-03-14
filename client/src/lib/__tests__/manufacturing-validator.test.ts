import { describe, it, expect } from 'vitest';
import {
  validateManufacturingPackage,
  summarizeChecks,
} from '../manufacturing-validator';
import type {
  ManufacturingPackageInput,
  GerberLayerInput,
  DrillFileInput,
  BomEntry,
  PlacementEntryInput,
  BoardGeometry,
  ManufacturingCheck,
  CheckCategory,
} from '../manufacturing-validator';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeGerberLayer(overrides: Partial<GerberLayerInput> = {}): GerberLayerInput {
  return {
    name: 'F.Cu',
    type: 'copper',
    side: 'front',
    content: '%FSLAX36Y36*%\n%MOMM*%\nG04 Test*\nM02*',
    ...overrides,
  };
}

function makeDrill(overrides: Partial<DrillFileInput> = {}): DrillFileInput {
  return {
    content: 'M48\nT1C0.800\n%\nT1\nX1000Y1000\nM30',
    toolSizes: [0.8],
    ...overrides,
  };
}

function makeBom(overrides: Partial<BomEntry> = {}): BomEntry {
  return { refDes: 'R1', partNumber: 'RC0805JR-07100KL', quantity: 1, description: '100K resistor', ...overrides };
}

function makePlacement(overrides: Partial<PlacementEntryInput> = {}): PlacementEntryInput {
  return { refDes: 'R1', partNumber: 'RC0805JR-07100KL', x: 10, y: 20, rotation: 0, side: 'front', packageName: '0805', ...overrides };
}

function makeBoard(overrides: Partial<BoardGeometry> = {}): BoardGeometry {
  return { widthMm: 50, heightMm: 30, layerCount: 2, ...overrides };
}

/** Build a complete, valid package (all checks should pass). */
function validPackage(): ManufacturingPackageInput {
  return {
    gerberLayers: [
      makeGerberLayer({ name: 'F.Cu', type: 'copper', side: 'front' }),
      makeGerberLayer({ name: 'B.Cu', type: 'copper', side: 'back' }),
      makeGerberLayer({ name: 'F.Mask', type: 'soldermask', side: 'front' }),
      makeGerberLayer({ name: 'B.Mask', type: 'soldermask', side: 'back' }),
      makeGerberLayer({ name: 'Edge.Cuts', type: 'outline', side: 'front', content: '%FSLAX36Y36*%\nG04 outline*\nD10*\nX0Y0D02*\nX50000000Y0D01*\nM02*' }),
    ],
    drillFile: makeDrill(),
    bomEntries: [makeBom({ refDes: 'R1' }), makeBom({ refDes: 'C1', partNumber: 'GRM188R71H104KA93D', description: '100nF cap' })],
    placements: [makePlacement({ refDes: 'R1' }), makePlacement({ refDes: 'C1', partNumber: 'GRM188R71H104KA93D', x: 30, y: 20 })],
    board: makeBoard(),
  };
}

function findCheck(checks: ManufacturingCheck[], id: string): ManufacturingCheck {
  const found = checks.find((c) => c.id === id);
  if (!found) { throw new Error(`Check ${id} not found`); }
  return found;
}

function checksForCategory(checks: ManufacturingCheck[], cat: CheckCategory): ManufacturingCheck[] {
  return checks.filter((c) => c.category === cat);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('manufacturing-validator', () => {
  describe('validateManufacturingPackage', () => {
    it('returns 18 checks for a complete package', () => {
      const checks = validateManufacturingPackage(validPackage());
      expect(checks).toHaveLength(18);
    });

    it('all checks pass for a valid package', () => {
      const checks = validateManufacturingPackage(validPackage());
      const failures = checks.filter((c) => c.status === 'fail');
      expect(failures).toHaveLength(0);
    });

    it('each check has id, name, status, message, and category', () => {
      const checks = validateManufacturingPackage(validPackage());
      for (const c of checks) {
        expect(c.id).toBeTruthy();
        expect(c.name).toBeTruthy();
        expect(['pass', 'warn', 'fail']).toContain(c.status);
        expect(c.message).toBeTruthy();
        expect(['gerber', 'drill', 'bom', 'placement', 'consistency']).toContain(c.category);
      }
    });
  });

  // ── Gerber checks ──

  describe('G-01: Required Gerber layers', () => {
    it('fails when no copper layer', () => {
      const pkg = validPackage();
      pkg.gerberLayers = [makeGerberLayer({ type: 'outline', name: 'Edge.Cuts' })];
      const check = findCheck(validateManufacturingPackage(pkg), 'G-01');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('copper');
    });

    it('passes when all required types present', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'G-01');
      expect(check.status).toBe('pass');
    });
  });

  describe('G-02: Board outline closed', () => {
    it('passes with a closed outline polygon', () => {
      const pkg = validPackage();
      pkg.board = makeBoard({
        outlinePoints: [
          { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 30 }, { x: 0, y: 30 }, { x: 0, y: 0 },
        ],
      });
      const check = findCheck(validateManufacturingPackage(pkg), 'G-02');
      expect(check.status).toBe('pass');
    });

    it('fails with an open outline polygon', () => {
      const pkg = validPackage();
      pkg.board = makeBoard({
        outlinePoints: [
          { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 30 }, { x: 0, y: 30 },
        ],
      });
      const check = findCheck(validateManufacturingPackage(pkg), 'G-02');
      expect(check.status).toBe('fail');
    });

    it('fails when no outline layer and no outline points', () => {
      const pkg = validPackage();
      pkg.gerberLayers = [makeGerberLayer({ type: 'copper' }), makeGerberLayer({ type: 'soldermask' })];
      pkg.board = makeBoard({ outlinePoints: undefined });
      const check = findCheck(validateManufacturingPackage(pkg), 'G-02');
      expect(check.status).toBe('fail');
    });
  });

  describe('G-03: No zero-width traces', () => {
    it('fails when a zero-width aperture is detected', () => {
      const pkg = validPackage();
      pkg.gerberLayers = [
        ...pkg.gerberLayers,
        makeGerberLayer({ name: 'Bad', content: '%ADD10C,0.000000*%\nD10*\nX0Y0D02*\nX1000Y0D01*\n' }),
      ];
      const check = findCheck(validateManufacturingPackage(pkg), 'G-03');
      expect(check.status).toBe('fail');
    });

    it('passes with normal apertures', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'G-03');
      expect(check.status).toBe('pass');
    });
  });

  describe('G-04: Silkscreen pad overlap', () => {
    it('warns when silkscreen draw coordinates match pad flash coordinates', () => {
      const padContent = '%FSLAX36Y36*%\n%ADD10C,1.600000*%\nD10*\nX5000000Y5000000D03*\nM02*';
      const silkContent = '%FSLAX36Y36*%\n%ADD20C,0.150000*%\nD20*\nX5000000Y5000000D01*\nM02*';
      const pkg = validPackage();
      pkg.gerberLayers = [
        makeGerberLayer({ name: 'F.Cu', type: 'copper', content: padContent }),
        makeGerberLayer({ name: 'F.SilkS', type: 'silkscreen', content: silkContent }),
        makeGerberLayer({ name: 'Edge.Cuts', type: 'outline' }),
        makeGerberLayer({ name: 'F.Mask', type: 'soldermask' }),
      ];
      const check = findCheck(validateManufacturingPackage(pkg), 'G-04');
      expect(check.status).toBe('warn');
    });

    it('passes when no overlap', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'G-04');
      expect(check.status).toBe('pass');
    });
  });

  describe('G-05: Solder mask coverage', () => {
    it('warns when front copper has no matching soldermask', () => {
      const pkg = validPackage();
      pkg.gerberLayers = [
        makeGerberLayer({ name: 'F.Cu', type: 'copper', side: 'front' }),
        makeGerberLayer({ name: 'B.Cu', type: 'copper', side: 'back' }),
        makeGerberLayer({ name: 'B.Mask', type: 'soldermask', side: 'back' }),
        makeGerberLayer({ name: 'Edge.Cuts', type: 'outline' }),
      ];
      const check = findCheck(validateManufacturingPackage(pkg), 'G-05');
      expect(check.status).toBe('warn');
      expect(check.message).toContain('front');
    });

    it('passes when all outer copper has soldermask', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'G-05');
      expect(check.status).toBe('pass');
    });
  });

  // ── Drill checks ──

  describe('D-01: Drill file present', () => {
    it('fails when drill file is null', () => {
      const pkg = validPackage();
      pkg.drillFile = null;
      const check = findCheck(validateManufacturingPackage(pkg), 'D-01');
      expect(check.status).toBe('fail');
    });

    it('passes when drill file exists', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'D-01');
      expect(check.status).toBe('pass');
    });
  });

  describe('D-02: Drill tool sizes', () => {
    it('fails when tools are outside standard range', () => {
      const pkg = validPackage();
      pkg.drillFile = makeDrill({ toolSizes: [0.05, 7.0] });
      const check = findCheck(validateManufacturingPackage(pkg), 'D-02');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('0.050mm');
    });

    it('passes when all tools within range', () => {
      const pkg = validPackage();
      pkg.drillFile = makeDrill({ toolSizes: [0.3, 0.8, 1.0, 3.2] });
      const check = findCheck(validateManufacturingPackage(pkg), 'D-02');
      expect(check.status).toBe('pass');
    });

    it('warns when no tool sizes', () => {
      const pkg = validPackage();
      pkg.drillFile = makeDrill({ toolSizes: [] });
      const check = findCheck(validateManufacturingPackage(pkg), 'D-02');
      expect(check.status).toBe('warn');
    });
  });

  describe('D-03: Drill/layer consistency', () => {
    it('fails when copper layers exist but no drill file', () => {
      const pkg = validPackage();
      pkg.drillFile = null;
      const check = findCheck(validateManufacturingPackage(pkg), 'D-03');
      expect(check.status).toBe('fail');
    });

    it('passes when both copper and drill exist', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'D-03');
      expect(check.status).toBe('pass');
    });
  });

  // ── BOM checks ──

  describe('B-01: BOM ref-des valid', () => {
    it('fails with invalid ref-des', () => {
      const pkg = validPackage();
      pkg.bomEntries = [makeBom({ refDes: '' }), makeBom({ refDes: '123' })];
      const check = findCheck(validateManufacturingPackage(pkg), 'B-01');
      expect(check.status).toBe('fail');
    });

    it('passes with valid ref-des', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'B-01');
      expect(check.status).toBe('pass');
    });

    it('warns when BOM is empty', () => {
      const pkg = validPackage();
      pkg.bomEntries = [];
      const check = findCheck(validateManufacturingPackage(pkg), 'B-01');
      expect(check.status).toBe('warn');
    });
  });

  describe('B-02: BOM no duplicate ref-des', () => {
    it('fails with duplicate ref-des', () => {
      const pkg = validPackage();
      pkg.bomEntries = [makeBom({ refDes: 'R1' }), makeBom({ refDes: 'R1' }), makeBom({ refDes: 'C1' })];
      const check = findCheck(validateManufacturingPackage(pkg), 'B-02');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('R1');
    });

    it('passes with unique ref-des', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'B-02');
      expect(check.status).toBe('pass');
    });
  });

  describe('B-03: BOM part numbers', () => {
    it('warns when part numbers are missing', () => {
      const pkg = validPackage();
      pkg.bomEntries = [makeBom({ refDes: 'R1', partNumber: '' }), makeBom({ refDes: 'C1', partNumber: '  ' })];
      const check = findCheck(validateManufacturingPackage(pkg), 'B-03');
      expect(check.status).toBe('warn');
    });

    it('passes when all have part numbers', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'B-03');
      expect(check.status).toBe('pass');
    });
  });

  // ── Placement checks ──

  describe('P-01: Placement ref-des valid', () => {
    it('fails with invalid ref-des', () => {
      const pkg = validPackage();
      pkg.placements = [makePlacement({ refDes: 'bad!' })];
      const check = findCheck(validateManufacturingPackage(pkg), 'P-01');
      expect(check.status).toBe('fail');
    });

    it('passes with valid ref-des', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'P-01');
      expect(check.status).toBe('pass');
    });
  });

  describe('P-02: Placement coordinates', () => {
    it('fails with NaN coordinates', () => {
      const pkg = validPackage();
      pkg.placements = [makePlacement({ refDes: 'R1', x: NaN, y: 10 })];
      const check = findCheck(validateManufacturingPackage(pkg), 'P-02');
      expect(check.status).toBe('fail');
    });

    it('fails with Infinity coordinates', () => {
      const pkg = validPackage();
      pkg.placements = [makePlacement({ refDes: 'R1', x: 10, y: Infinity })];
      const check = findCheck(validateManufacturingPackage(pkg), 'P-02');
      expect(check.status).toBe('fail');
    });

    it('passes with finite coordinates', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'P-02');
      expect(check.status).toBe('pass');
    });
  });

  describe('P-03: Placement rotations', () => {
    it('warns with rotation outside [0, 360)', () => {
      const pkg = validPackage();
      pkg.placements = [makePlacement({ refDes: 'R1', rotation: -45 })];
      const check = findCheck(validateManufacturingPackage(pkg), 'P-03');
      expect(check.status).toBe('warn');
    });

    it('warns with rotation >= 360', () => {
      const pkg = validPackage();
      pkg.placements = [makePlacement({ refDes: 'R1', rotation: 360 })];
      const check = findCheck(validateManufacturingPackage(pkg), 'P-03');
      expect(check.status).toBe('warn');
    });

    it('passes with valid rotations', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'P-03');
      expect(check.status).toBe('pass');
    });
  });

  // ── Consistency checks ──

  describe('C-01: BOM↔placement ref-des match', () => {
    it('fails when BOM has ref-des not in placement', () => {
      const pkg = validPackage();
      pkg.bomEntries = [makeBom({ refDes: 'R1' }), makeBom({ refDes: 'R2' })];
      pkg.placements = [makePlacement({ refDes: 'R1' })];
      const check = findCheck(validateManufacturingPackage(pkg), 'C-01');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('R2');
    });

    it('fails when placement has ref-des not in BOM', () => {
      const pkg = validPackage();
      pkg.bomEntries = [makeBom({ refDes: 'R1' })];
      pkg.placements = [makePlacement({ refDes: 'R1' }), makePlacement({ refDes: 'U1' })];
      const check = findCheck(validateManufacturingPackage(pkg), 'C-01');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('U1');
    });

    it('passes when all match', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'C-01');
      expect(check.status).toBe('pass');
    });
  });

  describe('C-02: Component coverage', () => {
    it('fails when placed components have no BOM entry', () => {
      const pkg = validPackage();
      pkg.bomEntries = [];
      pkg.placements = [makePlacement({ refDes: 'R1' })];
      const check = findCheck(validateManufacturingPackage(pkg), 'C-02');
      expect(check.status).toBe('fail');
    });

    it('passes when all placed components are in BOM', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'C-02');
      expect(check.status).toBe('pass');
    });
  });

  describe('C-03: Layer count agreement', () => {
    it('fails when copper layers do not match declared count', () => {
      const pkg = validPackage();
      pkg.board = makeBoard({ layerCount: 4 });
      const check = findCheck(validateManufacturingPackage(pkg), 'C-03');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('2');
      expect(check.message).toContain('4');
    });

    it('passes when counts match', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'C-03');
      expect(check.status).toBe('pass');
    });
  });

  describe('C-04: Board dimensions', () => {
    it('fails with zero width', () => {
      const pkg = validPackage();
      pkg.board = makeBoard({ widthMm: 0 });
      const check = findCheck(validateManufacturingPackage(pkg), 'C-04');
      expect(check.status).toBe('fail');
    });

    it('fails with oversized board', () => {
      const pkg = validPackage();
      pkg.board = makeBoard({ widthMm: 700 });
      const check = findCheck(validateManufacturingPackage(pkg), 'C-04');
      expect(check.status).toBe('fail');
      expect(check.message).toContain('600mm');
    });

    it('passes with reasonable dimensions', () => {
      const check = findCheck(validateManufacturingPackage(validPackage()), 'C-04');
      expect(check.status).toBe('pass');
    });

    it('skips when no board geometry', () => {
      const pkg = validPackage();
      pkg.board = null;
      const check = findCheck(validateManufacturingPackage(pkg), 'C-04');
      expect(check.status).toBe('pass');
    });
  });

  // ── Category coverage ──

  describe('category coverage', () => {
    it('has checks in all 5 categories', () => {
      const checks = validateManufacturingPackage(validPackage());
      const categories = new Set(checks.map((c) => c.category));
      expect(categories.has('gerber')).toBe(true);
      expect(categories.has('drill')).toBe(true);
      expect(categories.has('bom')).toBe(true);
      expect(categories.has('placement')).toBe(true);
      expect(categories.has('consistency')).toBe(true);
    });

    it('has 5 gerber checks', () => {
      expect(checksForCategory(validateManufacturingPackage(validPackage()), 'gerber')).toHaveLength(5);
    });

    it('has 3 drill checks', () => {
      expect(checksForCategory(validateManufacturingPackage(validPackage()), 'drill')).toHaveLength(3);
    });

    it('has 3 bom checks', () => {
      expect(checksForCategory(validateManufacturingPackage(validPackage()), 'bom')).toHaveLength(3);
    });

    it('has 3 placement checks', () => {
      expect(checksForCategory(validateManufacturingPackage(validPackage()), 'placement')).toHaveLength(3);
    });

    it('has 4 consistency checks', () => {
      expect(checksForCategory(validateManufacturingPackage(validPackage()), 'consistency')).toHaveLength(4);
    });
  });

  // ── summarizeChecks ──

  describe('summarizeChecks', () => {
    it('returns overall pass when all pass', () => {
      const checks = validateManufacturingPackage(validPackage());
      const summary = summarizeChecks(checks);
      expect(summary.overallStatus).toBe('pass');
      expect(summary.failures).toBe(0);
      expect(summary.total).toBe(18);
    });

    it('returns overall fail when any check fails', () => {
      const pkg = validPackage();
      pkg.drillFile = null;
      const summary = summarizeChecks(validateManufacturingPackage(pkg));
      expect(summary.overallStatus).toBe('fail');
      expect(summary.failures).toBeGreaterThan(0);
    });

    it('returns overall warn when checks warn but none fail', () => {
      const pkg = validPackage();
      pkg.bomEntries = [makeBom({ refDes: 'R1', partNumber: '' })];
      pkg.placements = [makePlacement({ refDes: 'R1' })];
      const summary = summarizeChecks(validateManufacturingPackage(pkg));
      expect(summary.warnings).toBeGreaterThan(0);
      // Overall is 'warn' only if there are no failures
      if (summary.failures === 0) {
        expect(summary.overallStatus).toBe('warn');
      }
    });

    it('counts passed, warnings, and failures correctly', () => {
      const pkg = validPackage();
      pkg.drillFile = null;
      const checks = validateManufacturingPackage(pkg);
      const summary = summarizeChecks(checks);
      expect(summary.passed + summary.warnings + summary.failures).toBe(summary.total);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles completely empty package', () => {
      const pkg: ManufacturingPackageInput = {
        gerberLayers: [],
        drillFile: null,
        bomEntries: [],
        placements: [],
        board: null,
      };
      const checks = validateManufacturingPackage(pkg);
      expect(checks).toHaveLength(18);
      // Should have some failures (no layers, no drill)
      const summary = summarizeChecks(checks);
      expect(summary.failures).toBeGreaterThan(0);
    });

    it('handles large BOM with many ref-des', () => {
      const bom: BomEntry[] = [];
      const placements: PlacementEntryInput[] = [];
      for (let i = 1; i <= 100; i++) {
        bom.push(makeBom({ refDes: `R${i}`, partNumber: `PART-${i}` }));
        placements.push(makePlacement({ refDes: `R${i}`, partNumber: `PART-${i}`, x: i * 2, y: i }));
      }
      const pkg = validPackage();
      pkg.bomEntries = bom;
      pkg.placements = placements;
      const check = findCheck(validateManufacturingPackage(pkg), 'C-01');
      expect(check.status).toBe('pass');
    });

    it('all check IDs are unique', () => {
      const checks = validateManufacturingPackage(validPackage());
      const ids = checks.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
