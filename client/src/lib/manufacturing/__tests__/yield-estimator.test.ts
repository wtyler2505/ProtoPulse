import { describe, expect, it } from 'vitest';

import {
  calculateCpk,
  classifyBoardComplexity,
  detectPlacementType,
  estimatePinCount,
  estimatePitch,
  estimateYield,
  generateYieldImprovements,
} from '../yield-estimator';
import type {
  BoardComplexity,
  CpkResult,
  YieldBoardParams,
  YieldComponent,
  YieldDfmViolation,
  YieldEstimate,
  YieldImprovement,
  YieldInput,
  YieldTestCoverage,
} from '../yield-estimator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoard(overrides: Partial<YieldBoardParams> = {}): YieldBoardParams {
  return {
    layers: 2,
    widthMm: 50,
    heightMm: 50,
    minTraceWidth: 0.2,
    minDrillSize: 0.3,
    hasImpedanceControl: false,
    hasBlindVias: false,
    hasViaInPad: false,
    ...overrides,
  };
}

function makeComponent(overrides: Partial<YieldComponent> = {}): YieldComponent {
  return {
    refDes: 'R1',
    partNumber: 'RC0402',
    placementType: 'smt',
    pinCount: 2,
    pitch: 0.8,
    isCritical: false,
    ...overrides,
  };
}

function makeTestCoverage(overrides: Partial<YieldTestCoverage> = {}): YieldTestCoverage {
  return {
    functionalTestPercent: 80,
    ictPercent: 50,
    aoi: true,
    xray: false,
    flyingProbe: false,
    ...overrides,
  };
}

function makeInput(overrides: Partial<YieldInput> = {}): YieldInput {
  return {
    components: [makeComponent()],
    board: makeBoard(),
    dfmViolations: [],
    testCoverage: makeTestCoverage(),
    productionVolume: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Board Complexity Classification
// ---------------------------------------------------------------------------

describe('classifyBoardComplexity', () => {
  it('classifies simple boards', () => {
    const input = makeInput({
      components: [makeComponent()],
      board: makeBoard({ layers: 2 }),
    });
    expect(classifyBoardComplexity(input)).toBe('simple');
  });

  it('classifies moderate boards', () => {
    const components = Array.from({ length: 50 }, (_, i) =>
      makeComponent({ refDes: `R${i}` }),
    );
    const input = makeInput({
      components,
      board: makeBoard({ layers: 4 }),
    });
    expect(classifyBoardComplexity(input)).toBe('moderate');
  });

  it('classifies complex boards', () => {
    const components = Array.from({ length: 150 }, (_, i) =>
      makeComponent({ refDes: `U${i}` }),
    );
    components.push(makeComponent({ refDes: 'U999', placementType: 'bga', pinCount: 256 }));
    const input = makeInput({
      components,
      board: makeBoard({ layers: 6 }),
    });
    expect(classifyBoardComplexity(input)).toBe('complex');
  });

  it('classifies extreme boards', () => {
    const components = Array.from({ length: 400 }, (_, i) =>
      makeComponent({ refDes: `C${i}` }),
    );
    Array.from({ length: 10 }, (_, i) =>
      components.push(makeComponent({ refDes: `BGA${i}`, placementType: 'bga', pinCount: 500 })),
    );
    const input = makeInput({
      components,
      board: makeBoard({ layers: 12 }),
    });
    expect(classifyBoardComplexity(input)).toBe('extreme');
  });

  it('considers advanced features for simple→moderate upgrade', () => {
    const input = makeInput({
      components: [makeComponent()],
      board: makeBoard({ layers: 2, hasImpedanceControl: true }),
    });
    // A 2-layer board with impedance control is not simple
    expect(classifyBoardComplexity(input)).toBe('moderate');
  });

  it('considers blind vias as advanced feature', () => {
    const input = makeInput({
      components: [makeComponent()],
      board: makeBoard({ layers: 2, hasBlindVias: true }),
    });
    expect(classifyBoardComplexity(input)).toBe('moderate');
  });

  it('considers via-in-pad as advanced feature', () => {
    const input = makeInput({
      components: [makeComponent()],
      board: makeBoard({ layers: 2, hasViaInPad: true }),
    });
    expect(classifyBoardComplexity(input)).toBe('moderate');
  });
});

// ---------------------------------------------------------------------------
// Core Yield Estimation
// ---------------------------------------------------------------------------

describe('estimateYield', () => {
  it('returns overall yield between 0 and 1', () => {
    const result = estimateYield(makeInput());
    expect(result.overallYield).toBeGreaterThan(0);
    expect(result.overallYield).toBeLessThanOrEqual(1);
  });

  it('returns overallYieldPercent matching overallYield * 100', () => {
    const result = estimateYield(makeInput());
    expect(result.overallYieldPercent).toBeCloseTo(result.overallYield * 100, 1);
  });

  it('includes all 10 yield factors', () => {
    const result = estimateYield(makeInput());
    expect(result.factors).toHaveLength(10);
    const ids = result.factors.map((f) => f.id);
    expect(ids).toContain('smt_placement');
    expect(ids).toContain('tht_placement');
    expect(ids).toContain('bga_placement');
    expect(ids).toContain('fine_pitch');
    expect(ids).toContain('solder_joint');
    expect(ids).toContain('pcb_fabrication');
    expect(ids).toContain('component_quality');
    expect(ids).toContain('dfm_compliance');
    expect(ids).toContain('test_coverage');
    expect(ids).toContain('board_complexity');
  });

  it('returns higher yield for simple boards than complex ones', () => {
    const simpleInput = makeInput({
      components: [makeComponent()],
      board: makeBoard({ layers: 2 }),
    });
    const complexComponents = Array.from({ length: 200 }, (_, i) =>
      makeComponent({ refDes: `U${i}`, pinCount: 20 }),
    );
    complexComponents.push(
      makeComponent({ refDes: 'BGA1', placementType: 'bga', pinCount: 400 }),
    );
    const complexInput = makeInput({
      components: complexComponents,
      board: makeBoard({ layers: 8, hasImpedanceControl: true, hasBlindVias: true }),
    });

    const simpleResult = estimateYield(simpleInput);
    const complexResult = estimateYield(complexInput);
    expect(simpleResult.overallYield).toBeGreaterThan(complexResult.overallYield);
  });

  it('returns DPMO consistent with overall yield', () => {
    const result = estimateYield(makeInput());
    const expectedDpmo = Math.round((1 - result.overallYield) * 1_000_000);
    expect(result.dpmo).toBe(expectedDpmo);
  });

  it('computes scrap and rework rates from defect rate', () => {
    const result = estimateYield(makeInput());
    const defectRate = 1 - result.overallYield;
    expect(result.estimatedScrapRate).toBeCloseTo(defectRate * 0.4, 4);
    expect(result.estimatedReworkRate).toBeCloseTo(defectRate * 0.6, 4);
  });

  it('computes cost impact multipliers', () => {
    const result = estimateYield(makeInput());
    expect(result.costImpact.scrapCostMultiplier).toBeGreaterThanOrEqual(1);
    expect(result.costImpact.reworkCostMultiplier).toBeGreaterThanOrEqual(1);
    expect(result.costImpact.effectiveCostMultiplier).toBeGreaterThanOrEqual(1);
    // effective = scrap * rework
    expect(result.costImpact.effectiveCostMultiplier).toBeCloseTo(
      result.costImpact.scrapCostMultiplier * result.costImpact.reworkCostMultiplier,
      3,
    );
  });

  it('returns breakdown by placement type', () => {
    const input = makeInput({
      components: [
        makeComponent({ refDes: 'R1', placementType: 'smt', pinCount: 2 }),
        makeComponent({ refDes: 'C1', placementType: 'tht', pinCount: 2 }),
        makeComponent({ refDes: 'U1', placementType: 'bga', pinCount: 100 }),
      ],
    });
    const result = estimateYield(input);
    expect(result.breakdownByType.smtYield).toBeLessThanOrEqual(1);
    expect(result.breakdownByType.thtYield).toBeLessThanOrEqual(1);
    expect(result.breakdownByType.bgaYield).toBeLessThanOrEqual(1);
    expect(result.breakdownByType.fabricationYield).toBeLessThanOrEqual(1);
    // BGA should have lower yield than SMT (higher ball count, hidden joints)
    expect(result.breakdownByType.bgaYield).toBeLessThan(result.breakdownByType.smtYield);
  });
});

// ---------------------------------------------------------------------------
// SMT/THT/BGA Yield Factors
// ---------------------------------------------------------------------------

describe('placement type yield factors', () => {
  it('SMT yield decreases with more solder joints', () => {
    const few = estimateYield(makeInput({
      components: [makeComponent({ pinCount: 4 })],
    }));
    const many = estimateYield(makeInput({
      components: [makeComponent({ pinCount: 400 })],
    }));
    expect(few.breakdownByType.smtYield).toBeGreaterThan(many.breakdownByType.smtYield);
  });

  it('THT yield decreases with more solder joints', () => {
    const few = estimateYield(makeInput({
      components: [makeComponent({ placementType: 'tht', pinCount: 4 })],
    }));
    const many = estimateYield(makeInput({
      components: [makeComponent({ placementType: 'tht', pinCount: 200 })],
    }));
    expect(few.breakdownByType.thtYield).toBeGreaterThan(many.breakdownByType.thtYield);
  });

  it('BGA yield is lower than SMT for same joint count', () => {
    const smt = estimateYield(makeInput({
      components: [makeComponent({ placementType: 'smt', pinCount: 100 })],
    }));
    const bga = estimateYield(makeInput({
      components: [makeComponent({ placementType: 'bga', pinCount: 100 })],
    }));
    expect(bga.breakdownByType.bgaYield).toBeLessThan(smt.breakdownByType.smtYield);
  });

  it('returns yield 1.0 for absent placement types', () => {
    const result = estimateYield(makeInput({
      components: [makeComponent({ placementType: 'smt' })],
    }));
    expect(result.breakdownByType.thtYield).toBe(1);
    expect(result.breakdownByType.bgaYield).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fine Pitch Factor
// ---------------------------------------------------------------------------

describe('fine pitch yield factor', () => {
  it('no penalty when no fine-pitch components', () => {
    const result = estimateYield(makeInput({
      components: [makeComponent({ pitch: 1.27 })],
    }));
    const finePitch = result.factors.find((f) => f.id === 'fine_pitch');
    expect(finePitch?.yield).toBe(1.0);
  });

  it('applies penalty for fine-pitch components', () => {
    const result = estimateYield(makeInput({
      components: [makeComponent({ pitch: 0.3 })],
    }));
    const finePitch = result.factors.find((f) => f.id === 'fine_pitch');
    expect(finePitch?.yield).toBeLessThan(1.0);
  });

  it('more fine-pitch components = lower yield', () => {
    const one = estimateYield(makeInput({
      components: [makeComponent({ pitch: 0.4 })],
    }));
    const three = estimateYield(makeInput({
      components: [
        makeComponent({ refDes: 'U1', pitch: 0.4 }),
        makeComponent({ refDes: 'U2', pitch: 0.4 }),
        makeComponent({ refDes: 'U3', pitch: 0.4 }),
      ],
    }));
    const oneFp = one.factors.find((f) => f.id === 'fine_pitch');
    const threeFp = three.factors.find((f) => f.id === 'fine_pitch');
    expect(threeFp!.yield).toBeLessThan(oneFp!.yield);
  });

  it('finer pitch = lower yield', () => {
    const coarser = estimateYield(makeInput({
      components: [makeComponent({ pitch: 0.45 })],
    }));
    const finer = estimateYield(makeInput({
      components: [makeComponent({ pitch: 0.2 })],
    }));
    const coarserFp = coarser.factors.find((f) => f.id === 'fine_pitch');
    const finerFp = finer.factors.find((f) => f.id === 'fine_pitch');
    expect(finerFp!.yield).toBeLessThan(coarserFp!.yield);
  });
});

// ---------------------------------------------------------------------------
// DFM Compliance Factor
// ---------------------------------------------------------------------------

describe('DFM compliance yield factor', () => {
  it('returns 1.0 with no violations', () => {
    const result = estimateYield(makeInput({ dfmViolations: [] }));
    const dfm = result.factors.find((f) => f.id === 'dfm_compliance');
    expect(dfm?.yield).toBe(1.0);
  });

  it('errors reduce yield more than warnings', () => {
    const withError = estimateYield(makeInput({
      dfmViolations: [{ severity: 'error', category: 'trace', ruleId: 'r1' }],
    }));
    const withWarning = estimateYield(makeInput({
      dfmViolations: [{ severity: 'warning', category: 'trace', ruleId: 'r2' }],
    }));
    const errorDfm = withError.factors.find((f) => f.id === 'dfm_compliance');
    const warningDfm = withWarning.factors.find((f) => f.id === 'dfm_compliance');
    expect(errorDfm!.yield).toBeLessThan(warningDfm!.yield);
  });

  it('more violations = lower yield', () => {
    const few = estimateYield(makeInput({
      dfmViolations: [{ severity: 'warning', category: 'trace', ruleId: 'r1' }],
    }));
    const many = estimateYield(makeInput({
      dfmViolations: Array.from({ length: 20 }, (_, i) => ({
        severity: 'warning' as const,
        category: 'trace',
        ruleId: `r${i}`,
      })),
    }));
    const fewDfm = few.factors.find((f) => f.id === 'dfm_compliance');
    const manyDfm = many.factors.find((f) => f.id === 'dfm_compliance');
    expect(manyDfm!.yield).toBeLessThan(fewDfm!.yield);
  });

  it('floors DFM yield at 0.5', () => {
    const catastrophic = estimateYield(makeInput({
      dfmViolations: Array.from({ length: 100 }, (_, i) => ({
        severity: 'error' as const,
        category: 'board',
        ruleId: `r${i}`,
      })),
    }));
    const dfm = catastrophic.factors.find((f) => f.id === 'dfm_compliance');
    expect(dfm!.yield).toBe(0.5);
  });

  it('info violations have minimal impact', () => {
    const result = estimateYield(makeInput({
      dfmViolations: [{ severity: 'info', category: 'trace', ruleId: 'r1' }],
    }));
    const dfm = result.factors.find((f) => f.id === 'dfm_compliance');
    expect(dfm!.yield).toBeGreaterThan(0.999);
  });
});

// ---------------------------------------------------------------------------
// Fabrication Yield Factor
// ---------------------------------------------------------------------------

describe('fabrication yield factor', () => {
  it('higher layer count = lower fabrication yield', () => {
    const twoLayer = estimateYield(makeInput({ board: makeBoard({ layers: 2 }) }));
    const eightLayer = estimateYield(makeInput({ board: makeBoard({ layers: 8 }) }));
    expect(twoLayer.breakdownByType.fabricationYield).toBeGreaterThan(
      eightLayer.breakdownByType.fabricationYield,
    );
  });

  it('impedance control reduces fabrication yield', () => {
    const without = estimateYield(makeInput({
      board: makeBoard({ hasImpedanceControl: false }),
    }));
    const with_ = estimateYield(makeInput({
      board: makeBoard({ hasImpedanceControl: true }),
    }));
    expect(without.breakdownByType.fabricationYield).toBeGreaterThan(
      with_.breakdownByType.fabricationYield,
    );
  });

  it('blind vias reduce fabrication yield', () => {
    const without = estimateYield(makeInput({
      board: makeBoard({ hasBlindVias: false }),
    }));
    const with_ = estimateYield(makeInput({
      board: makeBoard({ hasBlindVias: true }),
    }));
    expect(without.breakdownByType.fabricationYield).toBeGreaterThan(
      with_.breakdownByType.fabricationYield,
    );
  });

  it('very fine trace widths reduce fabrication yield', () => {
    const normal = estimateYield(makeInput({
      board: makeBoard({ minTraceWidth: 0.2 }),
    }));
    const fine = estimateYield(makeInput({
      board: makeBoard({ minTraceWidth: 0.08 }),
    }));
    expect(normal.breakdownByType.fabricationYield).toBeGreaterThan(
      fine.breakdownByType.fabricationYield,
    );
  });

  it('very small drills reduce fabrication yield', () => {
    const normal = estimateYield(makeInput({
      board: makeBoard({ minDrillSize: 0.4 }),
    }));
    const micro = estimateYield(makeInput({
      board: makeBoard({ minDrillSize: 0.15 }),
    }));
    expect(normal.breakdownByType.fabricationYield).toBeGreaterThan(
      micro.breakdownByType.fabricationYield,
    );
  });
});

// ---------------------------------------------------------------------------
// Test Coverage Factor
// ---------------------------------------------------------------------------

describe('test coverage yield factor', () => {
  it('full test coverage gives highest yield', () => {
    const full = estimateYield(makeInput({
      testCoverage: {
        functionalTestPercent: 100,
        ictPercent: 100,
        aoi: true,
        xray: true,
        flyingProbe: true,
      },
    }));
    const none = estimateYield(makeInput({
      testCoverage: {
        functionalTestPercent: 0,
        ictPercent: 0,
        aoi: false,
        xray: false,
        flyingProbe: false,
      },
    }));
    const fullTc = full.factors.find((f) => f.id === 'test_coverage');
    const noneTc = none.factors.find((f) => f.id === 'test_coverage');
    expect(fullTc!.yield).toBeGreaterThan(noneTc!.yield);
  });

  it('AOI adds to test coverage score', () => {
    const noAoi = estimateYield(makeInput({
      testCoverage: makeTestCoverage({ aoi: false }),
    }));
    const withAoi = estimateYield(makeInput({
      testCoverage: makeTestCoverage({ aoi: true }),
    }));
    const noTc = noAoi.factors.find((f) => f.id === 'test_coverage');
    const withTc = withAoi.factors.find((f) => f.id === 'test_coverage');
    expect(withTc!.yield).toBeGreaterThan(noTc!.yield);
  });
});

// ---------------------------------------------------------------------------
// Component Quality Factor
// ---------------------------------------------------------------------------

describe('component quality yield factor', () => {
  it('fewer critical components = higher quality yield', () => {
    const noCritical = estimateYield(makeInput({
      components: [
        makeComponent({ isCritical: false }),
        makeComponent({ refDes: 'R2', isCritical: false }),
      ],
    }));
    const allCritical = estimateYield(makeInput({
      components: [
        makeComponent({ isCritical: true }),
        makeComponent({ refDes: 'R2', isCritical: true }),
      ],
    }));
    const noCrit = noCritical.factors.find((f) => f.id === 'component_quality');
    const allCrit = allCritical.factors.find((f) => f.id === 'component_quality');
    expect(noCrit!.yield).toBeGreaterThanOrEqual(allCrit!.yield);
  });

  it('no components = yield 1.0', () => {
    const result = estimateYield(makeInput({ components: [] }));
    const cq = result.factors.find((f) => f.id === 'component_quality');
    expect(cq?.yield).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Volume Bonus
// ---------------------------------------------------------------------------

describe('volume bonus', () => {
  it('higher volume gives higher yield', () => {
    const low = estimateYield(makeInput({ productionVolume: 10 }));
    const high = estimateYield(makeInput({ productionVolume: 10000 }));
    expect(high.overallYield).toBeGreaterThan(low.overallYield);
  });

  it('yield capped at 0.9999', () => {
    const result = estimateYield(makeInput({
      components: [],
      productionVolume: 1_000_000,
    }));
    expect(result.overallYield).toBeLessThanOrEqual(0.9999);
  });
});

// ---------------------------------------------------------------------------
// Cpk Calculation
// ---------------------------------------------------------------------------

describe('calculateCpk', () => {
  it('high yield gives excellent Cpk', () => {
    const result = calculateCpk(0.9999);
    expect(result.rating).toBe('excellent');
    expect(result.cpk).toBeGreaterThanOrEqual(2.0);
  });

  it('moderate yield gives good Cpk', () => {
    const result = calculateCpk(0.999);
    expect(result.cpk).toBeGreaterThan(0.5);
  });

  it('low yield gives poor Cpk', () => {
    const result = calculateCpk(0.80);
    expect(result.rating).toBe('poor');
    expect(result.cpk).toBeLessThan(1.0);
  });

  it('Cp is greater than Cpk (centering offset)', () => {
    const result = calculateCpk(0.995);
    expect(result.cp).toBeGreaterThan(result.cpk);
  });

  it('returns description for each rating', () => {
    const excellent = calculateCpk(0.9999);
    const good = calculateCpk(0.9999 - 0.003);
    const poor = calculateCpk(0.7);
    expect(excellent.description).toContain('World-class');
    expect(good.description.length).toBeGreaterThan(0);
    expect(poor.description).toContain('Incapable');
  });

  it('handles edge case yield near 0', () => {
    const result = calculateCpk(0.001);
    expect(result.cpk).toBe(0);
    expect(result.rating).toBe('poor');
  });

  it('handles edge case yield near 1', () => {
    const result = calculateCpk(0.999999);
    expect(result.cpk).toBeGreaterThan(1.0);
  });
});

// ---------------------------------------------------------------------------
// Yield Improvements
// ---------------------------------------------------------------------------

describe('generateYieldImprovements', () => {
  it('suggests DFM fix when DFM yield is low', () => {
    const input = makeInput({
      dfmViolations: Array.from({ length: 10 }, (_, i) => ({
        severity: 'error' as const,
        category: 'trace',
        ruleId: `r${i}`,
      })),
    });
    const estimate = estimateYield(input);
    const improvements = generateYieldImprovements(estimate);
    const dfmFix = improvements.find((i) => i.title.includes('DFM'));
    expect(dfmFix).toBeDefined();
    expect(dfmFix!.priority).toBe('critical');
    expect(dfmFix!.category).toBe('design');
  });

  it('suggests X-ray for BGA when BGA yield is low', () => {
    const input = makeInput({
      components: [makeComponent({ placementType: 'bga', pinCount: 1000 })],
    });
    const estimate = estimateYield(input);
    const improvements = generateYieldImprovements(estimate);
    const bgaFix = improvements.find((i) => i.title.includes('X-ray'));
    expect(bgaFix).toBeDefined();
    expect(bgaFix!.category).toBe('process');
  });

  it('suggests test coverage increase when coverage yield is low', () => {
    const input = makeInput({
      testCoverage: {
        functionalTestPercent: 0,
        ictPercent: 0,
        aoi: false,
        xray: false,
        flyingProbe: false,
      },
    });
    const estimate = estimateYield(input);
    const improvements = generateYieldImprovements(estimate);
    const testFix = improvements.find((i) => i.title.includes('test coverage'));
    expect(testFix).toBeDefined();
    expect(testFix!.category).toBe('testing');
  });

  it('suggests fine-pitch optimization when fine-pitch yield is low', () => {
    const input = makeInput({
      components: Array.from({ length: 5 }, (_, i) =>
        makeComponent({ refDes: `U${i}`, pitch: 0.25 }),
      ),
    });
    const estimate = estimateYield(input);
    const improvements = generateYieldImprovements(estimate);
    const fpFix = improvements.find((i) => i.title.includes('fine-pitch'));
    expect(fpFix).toBeDefined();
  });

  it('returns no improvements when all factors are excellent', () => {
    const input = makeInput({
      components: [makeComponent({ pinCount: 2, pitch: 1.27 })],
      dfmViolations: [],
      testCoverage: {
        functionalTestPercent: 100,
        ictPercent: 100,
        aoi: true,
        xray: true,
        flyingProbe: true,
      },
      board: makeBoard({ layers: 2 }),
    });
    const estimate = estimateYield(input);
    const improvements = generateYieldImprovements(estimate);
    expect(improvements.length).toBe(0);
  });

  it('sorts by priority then by improvement delta', () => {
    const input = makeInput({
      components: [
        makeComponent({ placementType: 'bga', pinCount: 800 }),
        ...Array.from({ length: 5 }, (_, i) =>
          makeComponent({ refDes: `FP${i}`, pitch: 0.25 }),
        ),
      ],
      dfmViolations: Array.from({ length: 15 }, (_, i) => ({
        severity: 'error' as const,
        category: 'board',
        ruleId: `r${i}`,
      })),
      testCoverage: {
        functionalTestPercent: 0,
        ictPercent: 0,
        aoi: false,
        xray: false,
        flyingProbe: false,
      },
    });
    const estimate = estimateYield(input);
    const improvements = generateYieldImprovements(estimate);
    expect(improvements.length).toBeGreaterThan(0);
    // First item should be critical
    expect(improvements[0].priority).toBe('critical');
  });

  it('projected yield is always higher than current yield', () => {
    const input = makeInput({
      components: [makeComponent({ placementType: 'bga', pinCount: 500 })],
      dfmViolations: [{ severity: 'error', category: 'trace', ruleId: 'r1' }],
      testCoverage: makeTestCoverage({ functionalTestPercent: 10, ictPercent: 0 }),
    });
    const estimate = estimateYield(input);
    const improvements = generateYieldImprovements(estimate);
    improvements.forEach((imp) => {
      expect(imp.projectedYield).toBeGreaterThan(imp.currentYield);
    });
  });

  it('projected yield never exceeds 1.0', () => {
    const input = makeInput({
      dfmViolations: [{ severity: 'warning', category: 'trace', ruleId: 'r1' }],
    });
    const estimate = estimateYield(input);
    const improvements = generateYieldImprovements(estimate);
    improvements.forEach((imp) => {
      expect(imp.projectedYield).toBeLessThanOrEqual(1.0);
    });
  });
});

// ---------------------------------------------------------------------------
// detectPlacementType
// ---------------------------------------------------------------------------

describe('detectPlacementType', () => {
  it('detects BGA from description', () => {
    expect(detectPlacementType('256-ball BGA package')).toBe('bga');
    expect(detectPlacementType('FBGA 0.8mm pitch')).toBe('bga');
    expect(detectPlacementType('Ball Grid Array')).toBe('bga');
  });

  it('detects THT from description', () => {
    expect(detectPlacementType('DIP-16 through-hole')).toBe('tht');
    expect(detectPlacementType('TO-220 package')).toBe('tht');
    expect(detectPlacementType('PDIP THT')).toBe('tht');
  });

  it('detects SMT from description', () => {
    expect(detectPlacementType('0402 resistor')).toBe('smt');
    expect(detectPlacementType('SOIC-8 package')).toBe('smt');
    expect(detectPlacementType('QFN-32 surface mount')).toBe('smt');
    expect(detectPlacementType('TSSOP-20')).toBe('smt');
  });

  it('defaults to SMT for unknown descriptions', () => {
    expect(detectPlacementType('generic component')).toBe('smt');
    expect(detectPlacementType('')).toBe('smt');
  });
});

// ---------------------------------------------------------------------------
// estimatePinCount
// ---------------------------------------------------------------------------

describe('estimatePinCount', () => {
  it('extracts pin count from description', () => {
    expect(estimatePinCount('32-pin QFP')).toBe(32);
    expect(estimatePinCount('100 pin BGA')).toBe(100);
  });

  it('estimates from package type', () => {
    expect(estimatePinCount('0402 resistor')).toBe(2);
    expect(estimatePinCount('SOT-23 transistor')).toBe(3);
    expect(estimatePinCount('SOIC-8 op-amp')).toBe(8);
    expect(estimatePinCount('SOIC-16 buffer')).toBe(16);
  });

  it('estimates BGA at 256 pins', () => {
    expect(estimatePinCount('BGA package')).toBe(256);
  });

  it('returns 4 for unknown packages', () => {
    expect(estimatePinCount('something unknown')).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// estimatePitch
// ---------------------------------------------------------------------------

describe('estimatePitch', () => {
  it('extracts pitch from description', () => {
    expect(estimatePitch('0.5mm pitch QFN')).toBe(0.5);
    expect(estimatePitch('1.27mm pitch SOIC')).toBe(1.27);
  });

  it('estimates from package type', () => {
    expect(estimatePitch('QFN-32')).toBe(0.5);
    expect(estimatePitch('SOIC-8')).toBe(1.27);
    expect(estimatePitch('BGA')).toBe(0.8);
  });

  it('returns 0 for unknown', () => {
    expect(estimatePitch('unknown part')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty components array', () => {
    const result = estimateYield(makeInput({ components: [] }));
    expect(result.overallYield).toBeGreaterThan(0.9);
    expect(result.factors).toHaveLength(10);
  });

  it('handles zero pin count', () => {
    const result = estimateYield(makeInput({
      components: [makeComponent({ pinCount: 0 })],
    }));
    expect(result.overallYield).toBeGreaterThan(0);
  });

  it('handles 1-layer board', () => {
    const result = estimateYield(makeInput({
      board: makeBoard({ layers: 1 }),
    }));
    expect(result.breakdownByType.fabricationYield).toBeGreaterThan(0.99);
  });

  it('handles very high layer count', () => {
    const result = estimateYield(makeInput({
      board: makeBoard({ layers: 32 }),
    }));
    expect(result.breakdownByType.fabricationYield).toBeLessThan(0.92);
  });

  it('handles mixed placement types', () => {
    const result = estimateYield(makeInput({
      components: [
        makeComponent({ refDes: 'R1', placementType: 'smt', pinCount: 2 }),
        makeComponent({ refDes: 'J1', placementType: 'tht', pinCount: 10 }),
        makeComponent({ refDes: 'U1', placementType: 'bga', pinCount: 200 }),
      ],
    }));
    expect(result.overallYield).toBeGreaterThan(0);
    expect(result.overallYield).toBeLessThan(1);
  });

  it('handles very large component count', () => {
    const components = Array.from({ length: 1000 }, (_, i) =>
      makeComponent({ refDes: `R${i}`, pinCount: 2 }),
    );
    const result = estimateYield(makeInput({ components }));
    expect(result.overallYield).toBeGreaterThan(0);
    // 1000 components * 2 pins * 0.0002 defect rate = significant yield loss
    expect(result.overallYield).toBeLessThan(0.99);
  });

  it('handles production volume of 0', () => {
    const result = estimateYield(makeInput({ productionVolume: 0 }));
    expect(result.overallYield).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: full realistic scenario
// ---------------------------------------------------------------------------

describe('realistic scenario', () => {
  it('estimates yield for a typical IoT sensor board', () => {
    const components: YieldComponent[] = [
      // MCU
      { refDes: 'U1', partNumber: 'ESP32-S3', placementType: 'smt', pinCount: 48, pitch: 0.5, isCritical: true },
      // Power
      { refDes: 'U2', partNumber: 'LDO', placementType: 'smt', pinCount: 5, pitch: 0.65, isCritical: true },
      // Passives (20 resistors, 15 caps)
      ...Array.from({ length: 20 }, (_, i) => ({
        refDes: `R${i + 1}`,
        partNumber: 'RC0402',
        placementType: 'smt' as const,
        pinCount: 2,
        pitch: 0.8,
        isCritical: false,
      })),
      ...Array.from({ length: 15 }, (_, i) => ({
        refDes: `C${i + 1}`,
        partNumber: 'CC0402',
        placementType: 'smt' as const,
        pinCount: 2,
        pitch: 0.8,
        isCritical: false,
      })),
      // Connector (THT)
      { refDes: 'J1', partNumber: 'USB-C', placementType: 'tht', pinCount: 12, pitch: 0, isCritical: false },
      // Antenna
      { refDes: 'ANT1', partNumber: '2.4GHz', placementType: 'smt', pinCount: 2, pitch: 1.0, isCritical: false },
    ];

    const input: YieldInput = {
      components,
      board: makeBoard({ layers: 4, minTraceWidth: 0.15, minDrillSize: 0.3 }),
      dfmViolations: [
        { severity: 'warning', category: 'clearance', ruleId: 'r1' },
        { severity: 'info', category: 'silkscreen', ruleId: 'r2' },
      ],
      testCoverage: {
        functionalTestPercent: 70,
        ictPercent: 40,
        aoi: true,
        xray: false,
        flyingProbe: false,
      },
      productionVolume: 500,
    };

    const estimate = estimateYield(input);

    // Typical IoT board should have ~93-99% yield
    expect(estimate.overallYield).toBeGreaterThan(0.90);
    expect(estimate.overallYield).toBeLessThan(1.0);
    expect(estimate.boardComplexity).toBe('moderate');
    expect(estimate.dpmo).toBeGreaterThan(0);
    expect(estimate.cpk.rating).toBeDefined();

    const improvements = generateYieldImprovements(estimate);
    // Should have some suggestions but nothing critical
    improvements.forEach((imp) => {
      expect(imp.priority).not.toBe('critical');
    });
  });

  it('estimates yield for a high-complexity FPGA board', () => {
    const components: YieldComponent[] = [
      // FPGA (BGA)
      { refDes: 'U1', partNumber: 'XC7A100T', placementType: 'bga', pinCount: 676, pitch: 0.8, isCritical: true },
      // DDR3 (x4)
      ...Array.from({ length: 4 }, (_, i) => ({
        refDes: `U${i + 2}`,
        partNumber: 'MT41K256M16',
        placementType: 'bga' as const,
        pinCount: 96,
        pitch: 0.8,
        isCritical: true,
      })),
      // Power regulators
      ...Array.from({ length: 6 }, (_, i) => ({
        refDes: `VR${i + 1}`,
        partNumber: 'TPS54302',
        placementType: 'smt' as const,
        pinCount: 8,
        pitch: 0.5,
        isCritical: true,
      })),
      // Passives (200+)
      ...Array.from({ length: 200 }, (_, i) => ({
        refDes: `R${i + 1}`,
        partNumber: 'RC0402',
        placementType: 'smt' as const,
        pinCount: 2,
        pitch: 0.8,
        isCritical: false,
      })),
    ];

    const input: YieldInput = {
      components,
      board: makeBoard({
        layers: 8,
        minTraceWidth: 0.1,
        minDrillSize: 0.2,
        hasImpedanceControl: true,
        hasBlindVias: true,
        hasViaInPad: true,
      }),
      dfmViolations: [
        { severity: 'error', category: 'trace', ruleId: 'r1' },
        { severity: 'warning', category: 'drill', ruleId: 'r2' },
        { severity: 'warning', category: 'clearance', ruleId: 'r3' },
      ],
      testCoverage: {
        functionalTestPercent: 90,
        ictPercent: 80,
        aoi: true,
        xray: true,
        flyingProbe: false,
      },
      productionVolume: 50,
    };

    const estimate = estimateYield(input);

    // Complex FPGA board should have lower yield
    expect(estimate.overallYield).toBeLessThan(0.95);
    expect(estimate.boardComplexity).toBe('extreme');
    expect(estimate.breakdownByType.bgaYield).toBeLessThan(0.95);

    const improvements = generateYieldImprovements(estimate);
    expect(improvements.length).toBeGreaterThan(0);
  });
});
