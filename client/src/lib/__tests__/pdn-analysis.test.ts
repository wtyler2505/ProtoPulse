import { describe, expect, it } from 'vitest';

import { PDNAnalyzer } from '../simulation/pdn-analysis';
import type {
  DecouplingCap,
  PowerNet,
  PowerVia,
  VRM,
} from '../simulation/pdn-analysis';
import type { StackupLayer } from '../board-stackup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make3V3Net(overrides?: Partial<PowerNet>): PowerNet {
  return {
    name: 'VCC_3V3',
    voltage: 3.3,
    maxCurrent: 2,
    rippleTarget: 33, // mV (1% of 3.3V)
    ...overrides,
  };
}

function make1V8Net(overrides?: Partial<PowerNet>): PowerNet {
  return {
    name: 'VDD_1V8',
    voltage: 1.8,
    maxCurrent: 5,
    rippleTarget: 18, // mV (1% of 1.8V)
    ...overrides,
  };
}

function makeStackup(): StackupLayer[] {
  return [
    {
      id: 'top',
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
      id: 'gnd',
      name: 'Ground',
      type: 'ground',
      material: 'FR4',
      thickness: 1.4,
      copperWeight: '1oz',
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: 1,
    },
    {
      id: 'pwr',
      name: 'Power',
      type: 'power',
      material: 'FR4',
      thickness: 1.4,
      copperWeight: '1oz',
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: 2,
    },
    {
      id: 'bot',
      name: 'Bottom',
      type: 'signal',
      material: 'FR4',
      thickness: 1.4,
      copperWeight: '1oz',
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: 3,
    },
  ];
}

function makeVRM(overrides?: Partial<VRM>): VRM {
  return {
    id: 'vrm1',
    name: 'LDO_3V3',
    outputVoltage: 3.3,
    maxCurrent: 3,
    outputImpedance: 50, // milliohms
    bandwidth: 100e3, // 100 kHz
    position: { x: 10, y: 10 },
    ...overrides,
  };
}

function makeCap(value: number, id?: string, overrides?: Partial<DecouplingCap>): DecouplingCap {
  return {
    id: id ?? `cap_${value}`,
    value,
    esr: 0.01,
    esl: 0.5e-9,
    position: { x: 20, y: 20 },
    mountingInductance: 0.5, // nH
    tolerance: 0.1,
    ...overrides,
  };
}

function makeVia(overrides?: Partial<PowerVia>): PowerVia {
  return {
    position: { x: 15, y: 15 },
    diameter: 0.3,
    fromLayer: 'top',
    toLayer: 'pwr',
    inductance: 0.5, // nH
    resistance: 1.0, // milliohms
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Static utility tests
// ---------------------------------------------------------------------------

describe('PDNAnalyzer static methods', () => {
  describe('calculateViaInductance', () => {
    it('returns positive inductance for valid geometry', () => {
      const L = PDNAnalyzer.calculateViaInductance(1.6, 0.3, 0.6);
      expect(L).toBeGreaterThan(0);
    });

    it('returns zero for invalid inputs', () => {
      expect(PDNAnalyzer.calculateViaInductance(0, 0.3, 0.6)).toBe(0);
      expect(PDNAnalyzer.calculateViaInductance(1.6, 0, 0.6)).toBe(0);
      expect(PDNAnalyzer.calculateViaInductance(1.6, 0.3, 0.3)).toBe(0); // antipad <= via
      expect(PDNAnalyzer.calculateViaInductance(1.6, 0.3, 0.2)).toBe(0); // antipad < via
    });

    it('inductance increases with height', () => {
      const L1 = PDNAnalyzer.calculateViaInductance(1.0, 0.3, 0.6);
      const L2 = PDNAnalyzer.calculateViaInductance(2.0, 0.3, 0.6);
      expect(L2).toBeGreaterThan(L1);
      // Should be roughly 2x (linear with height)
      expect(L2 / L1).toBeCloseTo(2, 1);
    });

    it('inductance increases with antipad/via ratio', () => {
      const L1 = PDNAnalyzer.calculateViaInductance(1.6, 0.3, 0.5);
      const L2 = PDNAnalyzer.calculateViaInductance(1.6, 0.3, 1.0);
      expect(L2).toBeGreaterThan(L1);
    });

    it('produces values in reasonable nH range', () => {
      // Typical via: 1.6mm height, 0.3mm drill, 0.6mm antipad
      const L = PDNAnalyzer.calculateViaInductance(1.6, 0.3, 0.6);
      expect(L).toBeGreaterThan(0.05);
      expect(L).toBeLessThan(5);
    });
  });

  describe('calculateViaResistance', () => {
    it('returns positive resistance for valid geometry', () => {
      const R = PDNAnalyzer.calculateViaResistance(1.6, 0.3, 0.025);
      expect(R).toBeGreaterThan(0);
    });

    it('returns zero for invalid inputs', () => {
      expect(PDNAnalyzer.calculateViaResistance(0, 0.3, 0.025)).toBe(0);
      expect(PDNAnalyzer.calculateViaResistance(1.6, 0, 0.025)).toBe(0);
      expect(PDNAnalyzer.calculateViaResistance(1.6, 0.3, 0)).toBe(0);
    });

    it('resistance increases with height', () => {
      const R1 = PDNAnalyzer.calculateViaResistance(1.0, 0.3, 0.025);
      const R2 = PDNAnalyzer.calculateViaResistance(2.0, 0.3, 0.025);
      expect(R2).toBeGreaterThan(R1);
    });

    it('handles solid via (plating >= radius)', () => {
      // Plating thickness larger than radius = fully filled via
      const R = PDNAnalyzer.calculateViaResistance(1.6, 0.3, 0.2);
      expect(R).toBeGreaterThan(0);
    });

    it('produces values in reasonable milliohm range', () => {
      const R = PDNAnalyzer.calculateViaResistance(1.6, 0.3, 0.025);
      expect(R).toBeGreaterThan(0.01);
      expect(R).toBeLessThan(100);
    });
  });

  describe('calculatePlaneCapacitance', () => {
    it('returns positive capacitance for valid geometry', () => {
      const C = PDNAnalyzer.calculatePlaneCapacitance(2500, 0.1, 4.4); // 50x50mm, 0.1mm thick
      expect(C).toBeGreaterThan(0);
    });

    it('returns zero for invalid inputs', () => {
      expect(PDNAnalyzer.calculatePlaneCapacitance(0, 0.1, 4.4)).toBe(0);
      expect(PDNAnalyzer.calculatePlaneCapacitance(2500, 0, 4.4)).toBe(0);
      expect(PDNAnalyzer.calculatePlaneCapacitance(2500, 0.1, 0)).toBe(0);
    });

    it('capacitance scales linearly with area', () => {
      const C1 = PDNAnalyzer.calculatePlaneCapacitance(1000, 0.1, 4.4);
      const C2 = PDNAnalyzer.calculatePlaneCapacitance(2000, 0.1, 4.4);
      expect(C2 / C1).toBeCloseTo(2, 5);
    });

    it('capacitance inversely proportional to thickness', () => {
      const C1 = PDNAnalyzer.calculatePlaneCapacitance(2500, 0.1, 4.4);
      const C2 = PDNAnalyzer.calculatePlaneCapacitance(2500, 0.2, 4.4);
      expect(C1 / C2).toBeCloseTo(2, 5);
    });

    it('capacitance scales with dielectric constant', () => {
      const C1 = PDNAnalyzer.calculatePlaneCapacitance(2500, 0.1, 2.0);
      const C2 = PDNAnalyzer.calculatePlaneCapacitance(2500, 0.1, 4.0);
      expect(C2 / C1).toBeCloseTo(2, 5);
    });

    it('produces pF-range values for typical PCB geometry', () => {
      // 50x50mm board, 0.1mm (4mil) dielectric, FR4
      const C = PDNAnalyzer.calculatePlaneCapacitance(2500, 0.1, 4.4);
      // Expected: ~1 nF range
      expect(C).toBeGreaterThan(100e-12);
      expect(C).toBeLessThan(100e-9);
    });
  });

  describe('calculateTargetImpedance', () => {
    it('computes Z_target = V * ripple% / 100 / I_transient', () => {
      // 3.3V, 5%, 2A => 3.3 * 0.05 / 2 = 0.0825 ohms
      const Z = PDNAnalyzer.calculateTargetImpedance(3.3, 5, 2);
      expect(Z).toBeCloseTo(0.0825, 4);
    });

    it('returns zero for invalid inputs', () => {
      expect(PDNAnalyzer.calculateTargetImpedance(0, 5, 2)).toBe(0);
      expect(PDNAnalyzer.calculateTargetImpedance(3.3, 0, 2)).toBe(0);
      expect(PDNAnalyzer.calculateTargetImpedance(3.3, 5, 0)).toBe(0);
    });

    it('lower ripple target produces lower impedance', () => {
      const Z1 = PDNAnalyzer.calculateTargetImpedance(3.3, 5, 2);
      const Z2 = PDNAnalyzer.calculateTargetImpedance(3.3, 1, 2);
      expect(Z2).toBeLessThan(Z1);
    });

    it('higher current produces lower target impedance', () => {
      const Z1 = PDNAnalyzer.calculateTargetImpedance(3.3, 5, 1);
      const Z2 = PDNAnalyzer.calculateTargetImpedance(3.3, 5, 5);
      expect(Z2).toBeLessThan(Z1);
    });
  });

  describe('lookupDecapParams', () => {
    it('finds known cap values', () => {
      const result = PDNAnalyzer.lookupDecapParams(100e-9, '0402');
      expect(result).not.toBeNull();
      expect(result!.esr).toBe(0.01);
      expect(result!.esl).toBe(0.5e-9);
    });

    it('finds electrolytic caps', () => {
      const result = PDNAnalyzer.lookupDecapParams(100e-6, 'electrolytic');
      expect(result).not.toBeNull();
      expect(result!.esr).toBe(0.05);
    });

    it('returns null for unknown combinations', () => {
      expect(PDNAnalyzer.lookupDecapParams(47e-9, '0402')).toBeNull();
      expect(PDNAnalyzer.lookupDecapParams(100e-9, '0201')).toBeNull();
    });

    it('finds 100pF 0402', () => {
      const result = PDNAnalyzer.lookupDecapParams(100e-12, '0402');
      expect(result).not.toBeNull();
      expect(result!.esr).toBe(0.1);
    });

    it('finds 1uF 0603', () => {
      const result = PDNAnalyzer.lookupDecapParams(1e-6, '0603');
      expect(result).not.toBeNull();
    });

    it('finds 1000uF electrolytic', () => {
      const result = PDNAnalyzer.lookupDecapParams(1000e-6, 'electrolytic');
      expect(result).not.toBeNull();
      expect(result!.esl).toBe(10.0e-9);
    });
  });
});

// ---------------------------------------------------------------------------
// Single cap impedance tests
// ---------------------------------------------------------------------------

describe('Single cap impedance curve', () => {
  it('has V-shaped impedance with minimum at SRF', () => {
    const net = make3V3Net();
    const stackup = makeStackup();
    const analyzer = new PDNAnalyzer(net, stackup);

    // 100nF cap with known ESL
    const cap = makeCap(100e-9, 'c1', { esl: 0.5e-9, mountingInductance: 0 });
    analyzer.addDecouplingCap(cap);

    const result = analyzer.analyze(1e3, 1e9, 50);

    // Find minimum impedance point
    let minZ = Infinity;
    let srfFreq = 0;
    for (const pt of result.impedanceProfile) {
      if (pt.impedance < minZ) {
        minZ = pt.impedance;
        srfFreq = pt.frequency;
      }
    }

    // SRF = 1/(2*pi*sqrt(L*C)) = 1/(2*pi*sqrt(0.5e-9 * 100e-9)) ≈ 22.5 MHz
    const expectedSRF = 1 / (2 * Math.PI * Math.sqrt(0.5e-9 * 100e-9));
    expect(srfFreq).toBeGreaterThan(expectedSRF * 0.3);
    expect(srfFreq).toBeLessThan(expectedSRF * 3);

    // At SRF, impedance should be close to ESR
    expect(minZ).toBeCloseTo(cap.esr, 1);
  });

  it('impedance is capacitive below SRF and inductive above', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    const cap = makeCap(100e-9, 'c1', { esl: 0.5e-9, mountingInductance: 0 });
    analyzer.addDecouplingCap(cap);

    const result = analyzer.analyze(1e3, 1e9, 50);
    const profile = result.impedanceProfile;

    // At low frequency, phase should be negative (capacitive)
    const lowFreqPoint = profile.find((p) => p.frequency > 1e4)!;
    expect(lowFreqPoint.phase).toBeLessThan(0);

    // At high frequency, phase should be positive (inductive)
    const highFreqPoint = profile.find((p) => p.frequency > 500e6)!;
    expect(highFreqPoint.phase).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple cap parallel combination
// ---------------------------------------------------------------------------

describe('Multiple cap parallel combination', () => {
  it('parallel caps reduce impedance', () => {
    const net = make3V3Net();
    const stackup = makeStackup();

    // Single cap
    const single = new PDNAnalyzer(net, stackup);
    single.addDecouplingCap(makeCap(100e-9, 'c1'));
    const singleResult = single.analyze(1e3, 1e9, 20);

    // Two identical caps in parallel
    const dual = new PDNAnalyzer(net, stackup);
    dual.addDecouplingCap(makeCap(100e-9, 'c1'));
    dual.addDecouplingCap(makeCap(100e-9, 'c2'));
    const dualResult = dual.analyze(1e3, 1e9, 20);

    // At SRF, parallel combination should have ~half the impedance
    const singleMin = Math.min(...singleResult.impedanceProfile.map((p) => p.impedance));
    const dualMin = Math.min(...dualResult.impedanceProfile.map((p) => p.impedance));
    expect(dualMin).toBeLessThan(singleMin);
    expect(dualMin).toBeCloseTo(singleMin / 2, 2);
  });

  it('different value caps provide broader frequency coverage', () => {
    const net = make3V3Net();
    const stackup = makeStackup();

    // Single 100nF
    const singleAnalyzer = new PDNAnalyzer(net, stackup);
    singleAnalyzer.addDecouplingCap(makeCap(100e-9, 'c1'));
    const singleResult = singleAnalyzer.analyze(1e3, 1e9, 50);

    // 100nF + 10uF (covers low-freq) + 1nF (covers high-freq)
    const multiAnalyzer = new PDNAnalyzer(net, stackup);
    multiAnalyzer.addDecouplingCap(makeCap(100e-9, 'c1'));
    multiAnalyzer.addDecouplingCap(makeCap(10e-6, 'c2', { esr: 0.005, esl: 1.0e-9 }));
    multiAnalyzer.addDecouplingCap(makeCap(1e-9, 'c3', { esr: 0.05, esl: 0.4e-9 }));
    const multiResult = multiAnalyzer.analyze(1e3, 1e9, 50);

    // Multi-cap should have lower impedance at more frequency points
    const singleBelow1Ohm = singleResult.impedanceProfile.filter((p) => p.impedance < 1).length;
    const multiBelow1Ohm = multiResult.impedanceProfile.filter((p) => p.impedance < 1).length;
    expect(multiBelow1Ohm).toBeGreaterThanOrEqual(singleBelow1Ohm);
  });
});

// ---------------------------------------------------------------------------
// VRM impedance
// ---------------------------------------------------------------------------

describe('VRM impedance modeling', () => {
  it('VRM provides low impedance at DC/low frequency', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addVRM(makeVRM({ outputImpedance: 10, bandwidth: 100e3 }));

    const result = analyzer.analyze(100, 1e6, 20);
    const dcPoint = result.impedanceProfile[0];

    // At DC, impedance should be close to VRM output impedance (10 milliohm = 0.01 ohm)
    expect(dcPoint.impedance).toBeLessThan(0.1);
  });

  it('VRM impedance rises above bandwidth', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addVRM(makeVRM({ outputImpedance: 50, bandwidth: 100e3 }));

    const result = analyzer.analyze(1e3, 10e6, 20);
    const profile = result.impedanceProfile;

    const atBandwidth = profile.find((p) => p.frequency >= 100e3)!;
    const aboveBandwidth = profile.find((p) => p.frequency >= 1e6)!;
    expect(aboveBandwidth.impedance).toBeGreaterThan(atBandwidth.impedance);
  });
});

// ---------------------------------------------------------------------------
// Full PDN analysis
// ---------------------------------------------------------------------------

describe('Full PDN analysis', () => {
  function buildTypical3V3(): PDNAnalyzer {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addVRM(makeVRM());
    analyzer.addDecouplingCap(makeCap(10e-6, 'bulk', { esr: 0.005, esl: 1.0e-9 }));
    analyzer.addDecouplingCap(makeCap(100e-9, 'mid', { esr: 0.01, esl: 0.5e-9 }));
    analyzer.addDecouplingCap(makeCap(100e-9, 'mid2', { esr: 0.01, esl: 0.5e-9 }));
    analyzer.addDecouplingCap(makeCap(1e-9, 'hf', { esr: 0.05, esl: 0.4e-9 }));
    analyzer.addPowerVia(makeVia());
    analyzer.addPowerVia(makeVia({ position: { x: 25, y: 25 }, resistance: 1.5 }));
    analyzer.setPlaneArea(2500); // 50x50mm
    return analyzer;
  }

  it('returns complete result structure', () => {
    const analyzer = buildTypical3V3();
    const result = analyzer.analyze();

    expect(result.impedanceProfile.length).toBeGreaterThan(0);
    expect(result.irDrop).toBeDefined();
    expect(result.resonances).toBeDefined();
    expect(result.decapAnalysis).toBeDefined();
    expect(result.currentDistribution).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('impedance profile covers requested frequency range', () => {
    const analyzer = buildTypical3V3();
    const result = analyzer.analyze(1e3, 1e8, 50);

    const freqs = result.impedanceProfile.map((p) => p.frequency);
    expect(freqs[0]).toBeCloseTo(1e3, -1);
    expect(freqs[freqs.length - 1]).toBeCloseTo(1e8, -1);
  });

  it('impedance profile has correct number of points', () => {
    const analyzer = buildTypical3V3();
    const result = analyzer.analyze(100, 1e9, 10); // 7 decades * 10 points + 1

    expect(result.impedanceProfile.length).toBe(71);
  });

  it('all impedance values are positive', () => {
    const analyzer = buildTypical3V3();
    const result = analyzer.analyze();

    for (const pt of result.impedanceProfile) {
      expect(pt.impedance).toBeGreaterThan(0);
      expect(pt.frequency).toBeGreaterThan(0);
    }
  });

  it('summary risk is not critical for well-decoupled design', () => {
    const analyzer = buildTypical3V3();
    // Use a relaxed target to validate the PDN structure works
    analyzer.setTargetImpedance(5);
    const result = analyzer.analyze(1e3, 10e6, 50);

    // A well-decoupled design with a 5 ohm target should not be critical
    expect(['low', 'moderate', 'high']).toContain(result.summary.overallRisk);
  });
});

// ---------------------------------------------------------------------------
// Resonance detection
// ---------------------------------------------------------------------------

describe('Resonance detection', () => {
  it('detects anti-resonance between caps of different values', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());

    // Two caps with different SRFs will create anti-resonance between them
    analyzer.addDecouplingCap(makeCap(10e-6, 'bulk', { esr: 0.005, esl: 1.0e-9, mountingInductance: 0 }));
    analyzer.addDecouplingCap(makeCap(100e-9, 'mid', { esr: 0.01, esl: 0.5e-9, mountingInductance: 0 }));

    const result = analyzer.analyze(1e3, 1e9, 100);

    const parallelResonances = result.resonances.filter((r) => r.type === 'parallel');
    expect(parallelResonances.length).toBeGreaterThan(0);
  });

  it('detects series resonance (self-resonant frequency)', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addDecouplingCap(makeCap(100e-9, 'c1', { esr: 0.01, esl: 0.5e-9, mountingInductance: 0 }));
    analyzer.addDecouplingCap(makeCap(10e-6, 'c2', { esr: 0.005, esl: 1.0e-9, mountingInductance: 0 }));

    const result = analyzer.analyze(1e3, 1e9, 100);

    const seriesResonances = result.resonances.filter((r) => r.type === 'series');
    expect(seriesResonances.length).toBeGreaterThan(0);
  });

  it('resonance includes involved component IDs', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addDecouplingCap(makeCap(100e-9, 'cap_a'));
    analyzer.addDecouplingCap(makeCap(10e-6, 'cap_b', { esr: 0.005, esl: 1.0e-9 }));

    const result = analyzer.analyze(1e3, 1e9, 100);

    for (const res of result.resonances) {
      expect(res.involvedComponents.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// IR drop
// ---------------------------------------------------------------------------

describe('IR drop calculation', () => {
  it('returns zero drop when no VRM is defined', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addDecouplingCap(makeCap(100e-9));

    const result = analyzer.analyze();
    expect(result.irDrop.maxDrop).toBe(0);
    expect(result.irDrop.meetsTarget).toBe(false);
  });

  it('computes positive IR drop with VRM and caps', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addVRM(makeVRM());
    analyzer.addDecouplingCap(makeCap(100e-9, 'c1', { position: { x: 40, y: 40 } }));
    analyzer.setPlaneArea(2500);

    const result = analyzer.analyze();
    expect(result.irDrop.maxDrop).toBeGreaterThan(0);
    expect(result.irDrop.dropMap.length).toBeGreaterThan(0);
    expect(result.irDrop.worstPath.length).toBeGreaterThan(0);
  });

  it('higher current causes higher IR drop', () => {
    const lowCurrentNet = make3V3Net({ maxCurrent: 0.5 });
    const highCurrentNet = make3V3Net({ maxCurrent: 5 });
    const stackup = makeStackup();

    const lowAnalyzer = new PDNAnalyzer(lowCurrentNet, stackup);
    lowAnalyzer.addVRM(makeVRM());
    lowAnalyzer.addDecouplingCap(makeCap(100e-9, 'c1', { position: { x: 40, y: 40 } }));
    lowAnalyzer.setPlaneArea(2500);

    const highAnalyzer = new PDNAnalyzer(highCurrentNet, stackup);
    highAnalyzer.addVRM(makeVRM());
    highAnalyzer.addDecouplingCap(makeCap(100e-9, 'c1', { position: { x: 40, y: 40 } }));
    highAnalyzer.setPlaneArea(2500);

    const lowResult = lowAnalyzer.analyze();
    const highResult = highAnalyzer.analyze();

    expect(highResult.irDrop.maxDrop).toBeGreaterThan(lowResult.irDrop.maxDrop);
  });

  it('via resistance contributes to IR drop', () => {
    const net = make3V3Net();
    const stackup = makeStackup();

    // Without vias
    const noVia = new PDNAnalyzer(net, stackup);
    noVia.addVRM(makeVRM());
    noVia.addDecouplingCap(makeCap(100e-9, 'c1', { position: { x: 40, y: 40 } }));
    noVia.setPlaneArea(2500);
    const noViaResult = noVia.analyze();

    // With high-resistance vias
    const withVia = new PDNAnalyzer(net, stackup);
    withVia.addVRM(makeVRM());
    withVia.addDecouplingCap(makeCap(100e-9, 'c1', { position: { x: 40, y: 40 } }));
    withVia.addPowerVia(makeVia({ resistance: 10 }));
    withVia.setPlaneArea(2500);
    const withViaResult = withVia.analyze();

    expect(withViaResult.irDrop.maxDrop).toBeGreaterThan(noViaResult.irDrop.maxDrop);
  });
});

// ---------------------------------------------------------------------------
// Current distribution
// ---------------------------------------------------------------------------

describe('Current distribution', () => {
  it('returns empty for no vias', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    const result = analyzer.analyze();
    expect(result.currentDistribution).toEqual([]);
  });

  it('distributes current among vias inversely by resistance', () => {
    const analyzer = new PDNAnalyzer(make3V3Net({ maxCurrent: 4 }), makeStackup());
    analyzer.addPowerVia(makeVia({ resistance: 1.0 }));
    analyzer.addPowerVia(makeVia({ resistance: 3.0 }));

    const result = analyzer.analyze();
    const dist = result.currentDistribution;

    expect(dist.length).toBe(2);
    // Lower resistance via should carry more current
    expect(dist[0].current).toBeGreaterThan(dist[1].current);
    // Total should equal maxCurrent
    const totalI = dist.reduce((s, d) => s + d.current, 0);
    expect(totalI).toBeCloseTo(4, 5);
  });

  it('equal resistance vias share current equally', () => {
    const analyzer = new PDNAnalyzer(make3V3Net({ maxCurrent: 4 }), makeStackup());
    analyzer.addPowerVia(makeVia({ resistance: 2.0 }));
    analyzer.addPowerVia(makeVia({ resistance: 2.0 }));

    const result = analyzer.analyze();
    expect(result.currentDistribution[0].current).toBeCloseTo(2, 5);
    expect(result.currentDistribution[1].current).toBeCloseTo(2, 5);
  });

  it('utilization percent is bounded to 100%', () => {
    const analyzer = new PDNAnalyzer(make3V3Net({ maxCurrent: 100 }), makeStackup());
    analyzer.addPowerVia(makeVia({ diameter: 0.1 })); // tiny via, high utilization

    const result = analyzer.analyze();
    expect(result.currentDistribution[0].utilizationPercent).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Decap analysis & suggestions
// ---------------------------------------------------------------------------

describe('Decap analysis', () => {
  it('reports gaps when impedance exceeds target', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    // Only one cap — will have gaps at frequencies far from SRF
    analyzer.addDecouplingCap(makeCap(100e-9, 'c1'));
    analyzer.setTargetImpedance(0.01); // very aggressive target

    const result = analyzer.analyze();
    expect(result.decapAnalysis.gaps.length).toBeGreaterThan(0);
  });

  it('no gaps reported when impedance meets target everywhere', () => {
    const analyzer = new PDNAnalyzer(make3V3Net({ rippleTarget: 1000 }), makeStackup());
    analyzer.addVRM(makeVRM({ outputImpedance: 1 }));
    analyzer.addDecouplingCap(makeCap(100e-9, 'c1'));
    analyzer.addDecouplingCap(makeCap(10e-6, 'c2', { esr: 0.005, esl: 1.0e-9 }));
    analyzer.addDecouplingCap(makeCap(1e-9, 'c3', { esr: 0.05, esl: 0.4e-9 }));
    analyzer.setTargetImpedance(10); // very relaxed explicit target

    const result = analyzer.analyze();
    expect(result.decapAnalysis.gaps.length).toBe(0);
  });

  it('provides recommendations for no caps', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    const result = analyzer.analyze();

    expect(result.decapAnalysis.recommendations.length).toBeGreaterThan(0);
    expect(result.decapAnalysis.recommendations.some((r) => r.includes('No decoupling'))).toBe(true);
  });
});

describe('suggestDecouplingCaps', () => {
  it('suggests caps to fill frequency gaps', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addDecouplingCap(makeCap(10e-6, 'bulk', { esr: 0.005, esl: 1.0e-9 }));
    // Gap between bulk cap SRF and high frequencies

    const suggestions = analyzer.suggestDecouplingCaps(0.05);
    expect(suggestions.length).toBeGreaterThan(0);

    for (const s of suggestions) {
      expect(s.value).toBeGreaterThan(0);
      expect(s.esr).toBeGreaterThan(0);
      expect(s.esl).toBeGreaterThan(0);
    }
  });

  it('returns empty array when no gaps exist', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addVRM(makeVRM({ outputImpedance: 1 }));
    analyzer.addDecouplingCap(makeCap(100e-9, 'c1'));

    // Very relaxed target
    const suggestions = analyzer.suggestDecouplingCaps(100);
    expect(suggestions.length).toBe(0);
  });

  it('does not suggest duplicate cap values', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    const suggestions = analyzer.suggestDecouplingCaps(0.01);

    const keys = suggestions.map((s) => `${s.value}_${s.esl}`);
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });
});

// ---------------------------------------------------------------------------
// Target impedance override
// ---------------------------------------------------------------------------

describe('Target impedance', () => {
  it('uses calculated target by default', () => {
    // 3.3V, 33mV ripple, 2A => Z = 0.033/2 = 0.0165 ohm
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addDecouplingCap(makeCap(100e-9));
    const result = analyzer.analyze();

    // Summary critical frequency should reflect the auto-calculated target
    expect(result.summary.criticalFrequency).toBeGreaterThan(0);
  });

  it('respects manual target impedance override', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addVRM(makeVRM({ outputImpedance: 1 }));
    analyzer.addDecouplingCap(makeCap(100e-9));
    analyzer.addDecouplingCap(makeCap(10e-6, 'bulk', { esr: 0.005, esl: 1.0e-9 }));
    analyzer.setTargetImpedance(10); // relaxed target

    const result = analyzer.analyze();
    expect(result.summary.meetsTarget).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('handles no components (empty PDN)', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    const result = analyzer.analyze(1e3, 1e6, 10);

    expect(result.impedanceProfile.length).toBeGreaterThan(0);
    // All points should have very high impedance (open circuit)
    for (const pt of result.impedanceProfile) {
      expect(pt.impedance).toBeGreaterThan(1000);
    }
    expect(result.summary.overallRisk).toBe('critical');
  });

  it('handles single cap only', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addDecouplingCap(makeCap(100e-9));

    const result = analyzer.analyze();
    expect(result.impedanceProfile.length).toBeGreaterThan(0);
    expect(result.summary).toBeDefined();
  });

  it('handles VRM only (no caps)', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addVRM(makeVRM());

    const result = analyzer.analyze();
    expect(result.impedanceProfile.length).toBeGreaterThan(0);
    expect(result.summary.recommendations.some((r) => r.includes('decoupling'))).toBe(true);
  });

  it('handles very high frequency sweep', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addDecouplingCap(makeCap(100e-12, 'c1', { esr: 0.1, esl: 0.4e-9 }));

    const result = analyzer.analyze(1e6, 1e9, 10);
    expect(result.impedanceProfile.length).toBeGreaterThan(0);
    for (const pt of result.impedanceProfile) {
      expect(Number.isFinite(pt.impedance)).toBe(true);
      expect(Number.isFinite(pt.phase)).toBe(true);
    }
  });

  it('handles zero plane area', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addDecouplingCap(makeCap(100e-9));
    analyzer.setPlaneArea(0);

    const result = analyzer.analyze();
    expect(result.impedanceProfile.length).toBeGreaterThan(0);
  });

  it('handles empty stackup', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), []);
    analyzer.addDecouplingCap(makeCap(100e-9));

    const result = analyzer.analyze();
    expect(result.impedanceProfile.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Real-world scenarios
// ---------------------------------------------------------------------------

describe('Real-world scenario: 3.3V rail', () => {
  it('standard decoupling strategy for MCU power', () => {
    const net: PowerNet = {
      name: 'VCC_3V3',
      voltage: 3.3,
      maxCurrent: 0.5,
      rippleTarget: 50, // 50mV
    };

    const analyzer = new PDNAnalyzer(net, makeStackup());
    analyzer.addVRM(makeVRM({
      outputVoltage: 3.3,
      maxCurrent: 1,
      outputImpedance: 30,
      bandwidth: 200e3,
    }));

    // Typical MCU decoupling: 10uF bulk + 100nF per power pin + HF cap
    analyzer.addDecouplingCap(makeCap(10e-6, 'bulk', { esr: 0.005, esl: 1.0e-9 }));
    analyzer.addDecouplingCap(makeCap(100e-9, 'bypass1'));
    analyzer.addDecouplingCap(makeCap(100e-9, 'bypass2'));
    analyzer.addDecouplingCap(makeCap(100e-9, 'bypass3'));
    analyzer.addDecouplingCap(makeCap(1e-9, 'hf', { esr: 0.05, esl: 0.4e-9 }));

    analyzer.addPowerVia(makeVia({ inductance: 0.1, resistance: 0.3 }));
    analyzer.setPlaneArea(1600); // 40x40mm

    // Analyze practical MCU frequency range
    analyzer.setTargetImpedance(1.0); // 1 ohm target — relaxed for 0.5A MCU
    const result = analyzer.analyze(100, 10e6, 50);

    // A standard MCU decoupling strategy should meet 1 ohm target in low-MHz range
    expect(result.summary.overallRisk).not.toBe('critical');
    expect(result.impedanceProfile.length).toBeGreaterThan(0);
    expect(result.currentDistribution.length).toBe(1);
  });
});

describe('Real-world scenario: 1.8V FPGA rail', () => {
  it('high-current rail with aggressive decoupling', () => {
    const net = make1V8Net();

    const analyzer = new PDNAnalyzer(net, makeStackup());
    analyzer.addVRM(makeVRM({
      id: 'buck',
      name: 'Buck_1V8',
      outputVoltage: 1.8,
      maxCurrent: 10,
      outputImpedance: 5,
      bandwidth: 500e3,
    }));

    // Aggressive decoupling: bulk + mid + high-freq
    analyzer.addDecouplingCap(makeCap(100e-6, 'bulk1', { esr: 0.05, esl: 5.0e-9, mountingInductance: 2 }));
    analyzer.addDecouplingCap(makeCap(10e-6, 'bulk2', { esr: 0.005, esl: 1.0e-9 }));
    analyzer.addDecouplingCap(makeCap(10e-6, 'bulk3', { esr: 0.005, esl: 1.0e-9 }));
    analyzer.addDecouplingCap(makeCap(1e-6, 'mid1', { esr: 0.008, esl: 0.5e-9 }));
    analyzer.addDecouplingCap(makeCap(1e-6, 'mid2', { esr: 0.008, esl: 0.5e-9 }));
    analyzer.addDecouplingCap(makeCap(100e-9, 'hf1', { esr: 0.01, esl: 0.5e-9 }));
    analyzer.addDecouplingCap(makeCap(100e-9, 'hf2', { esr: 0.01, esl: 0.5e-9 }));
    analyzer.addDecouplingCap(makeCap(100e-9, 'hf3', { esr: 0.01, esl: 0.5e-9 }));
    analyzer.addDecouplingCap(makeCap(10e-9, 'vhf1', { esr: 0.02, esl: 0.5e-9 }));

    // Multiple vias for low inductance
    for (let i = 0; i < 8; i++) {
      analyzer.addPowerVia(makeVia({ resistance: 0.5, inductance: 0.3, position: { x: 10 + i * 3, y: 15 } }));
    }

    analyzer.setPlaneArea(5000); // 70x70mm
    const result = analyzer.analyze();

    // Target Z = 18mV / 5A = 0.0036 ohm — very aggressive
    expect(result.impedanceProfile.length).toBeGreaterThan(0);
    expect(result.currentDistribution.length).toBe(8);

    // All 8 vias should share current
    const totalViaCurrent = result.currentDistribution.reduce((s, d) => s + d.current, 0);
    expect(totalViaCurrent).toBeCloseTo(5, 1); // maxCurrent
  });
});

// ---------------------------------------------------------------------------
// Summary and recommendations
// ---------------------------------------------------------------------------

describe('Summary and recommendations', () => {
  it('meetsTarget is true when impedance stays below target', () => {
    const analyzer = new PDNAnalyzer(make3V3Net({ rippleTarget: 1000 }), makeStackup());
    analyzer.addVRM(makeVRM({ outputImpedance: 1 }));
    analyzer.addDecouplingCap(makeCap(100e-9));
    analyzer.setTargetImpedance(10); // very relaxed

    const result = analyzer.analyze();
    expect(result.summary.meetsTarget).toBe(true);
    expect(result.summary.lowestMargin).toBeGreaterThan(0);
  });

  it('meetsTarget is false when impedance exceeds target', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    // No VRM, single small cap — will exceed target at many frequencies
    analyzer.addDecouplingCap(makeCap(1e-9));
    analyzer.setTargetImpedance(0.001); // impossible target

    const result = analyzer.analyze();
    expect(result.summary.meetsTarget).toBe(false);
    expect(result.summary.lowestMargin).toBeLessThan(0);
  });

  it('criticalFrequency points to worst-case frequency', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    analyzer.addDecouplingCap(makeCap(100e-9));

    const result = analyzer.analyze();
    expect(result.summary.criticalFrequency).toBeGreaterThan(0);
  });

  it('overallRisk reflects margin severity', () => {
    // Critical: no components
    const critical = new PDNAnalyzer(make3V3Net(), makeStackup());
    const criticalResult = critical.analyze();
    expect(criticalResult.summary.overallRisk).toBe('critical');

    // Low: very relaxed target
    const low = new PDNAnalyzer(make3V3Net(), makeStackup());
    low.addVRM(makeVRM({ outputImpedance: 1 }));
    low.addDecouplingCap(makeCap(100e-9));
    low.setTargetImpedance(100);
    const lowResult = low.analyze();
    expect(lowResult.summary.overallRisk).toBe('low');
  });

  it('recommendations include actionable advice', () => {
    const analyzer = new PDNAnalyzer(make3V3Net(), makeStackup());
    const result = analyzer.analyze();

    expect(result.summary.recommendations.length).toBeGreaterThan(0);
    for (const rec of result.summary.recommendations) {
      expect(rec.length).toBeGreaterThan(10);
    }
  });
});
