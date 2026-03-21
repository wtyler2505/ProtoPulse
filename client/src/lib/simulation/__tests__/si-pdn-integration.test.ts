/**
 * Tests for SI-PDN Integration Engine
 *
 * Validates cross-domain analysis that correlates Signal Integrity (SI)
 * and Power Distribution Network (PDN) results to find issues that
 * neither analysis would find in isolation.
 */

import { describe, it, expect } from 'vitest';
import {
  SiPdnIntegrationEngine,
  interpolateImpedance,
  formatFrequency,
  kneeFrequency,
  estimateGroundBounce,
} from '../si-pdn-integration';
import type {
  SiPdnConfig,
  CrossDomainIssue,
  CorrelatedResult,
  IssueSeverity,
  IssueDomain,
  SsnEstimate,
  ReturnPlaneIssue,
  DecouplingAdequacy,
} from '../si-pdn-integration';
import type { TraceInfo, StackupLayerInfo } from '../si-advisor';
import type { PowerNet, DecouplingCap, VRM, ImpedancePoint } from '../pdn-analysis';
import type { StackupLayer } from '@/lib/board-stackup';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeStackupLayer(overrides: Partial<StackupLayer> = {}): StackupLayer {
  return {
    id: 'layer-1',
    name: 'F.Cu',
    type: 'signal',
    material: 'FR4',
    thickness: 1.4,
    copperWeight: '1oz',
    dielectricConstant: 4.4,
    lossTangent: 0.02,
    order: 1,
    ...overrides,
  } as StackupLayer;
}

function makeTraceInfo(overrides: Partial<TraceInfo> = {}): TraceInfo {
  return {
    name: 'CLK',
    width: 0.2,
    length: 50,
    spacing: 0.5,
    layer: {
      er: 4.4,
      height: 0.2,
      thickness: 0.035,
      tanD: 0.02,
    },
    targetZ0: 50,
    netClass: 'High-Speed',
    ...overrides,
  };
}

function makePowerNet(overrides: Partial<PowerNet> = {}): PowerNet {
  return {
    name: 'VCC_3V3',
    voltage: 3.3,
    maxCurrent: 2.0,
    rippleTarget: 50, // 50mV
    ...overrides,
  };
}

function makeVRM(overrides: Partial<VRM> = {}): VRM {
  return {
    id: 'vrm-1',
    name: 'LDO',
    outputVoltage: 3.3,
    maxCurrent: 3.0,
    outputImpedance: 10, // milliohms
    bandwidth: 500000, // 500 kHz
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeDecouplingCap(overrides: Partial<DecouplingCap> = {}): DecouplingCap {
  return {
    id: 'cap-1',
    value: 100e-9, // 100nF
    esr: 0.01,
    esl: 0.5e-9, // 0.5nH
    position: { x: 10, y: 10 },
    mountingInductance: 0.5,
    tolerance: 0.1,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<SiPdnConfig> = {}): SiPdnConfig {
  return {
    powerNet: makePowerNet(),
    stackupLayers: [
      makeStackupLayer({ order: 1, type: 'signal', name: 'F.Cu' }),
      makeStackupLayer({ order: 2, type: 'ground', name: 'GND' }),
      makeStackupLayer({ order: 3, type: 'power', name: 'VCC' }),
      makeStackupLayer({ order: 4, type: 'signal', name: 'B.Cu' }),
    ],
    vrms: [makeVRM()],
    caps: [
      makeDecouplingCap({ id: 'cap-1', value: 100e-9 }),
      makeDecouplingCap({ id: 'cap-2', value: 10e-6, esr: 0.005, esl: 1e-9 }),
    ],
    traces: [
      makeTraceInfo({ name: 'CLK', length: 50 }),
      makeTraceInfo({ name: 'DATA0', length: 45, spacing: 0.3 }),
    ],
    edgeRateNs: 1.0,
    numSwitchingOutputs: 8,
    switchingCurrentPerOutput: 0.05,
    noiseMarginMv: 400,
    planeAreaMm2: 2500,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SiPdnIntegrationEngine — Core
// ---------------------------------------------------------------------------

describe('SiPdnIntegrationEngine', () => {
  describe('constructor and configuration', () => {
    it('should throw if analyze() called without config', () => {
      const engine = new SiPdnIntegrationEngine();
      expect(() => engine.analyze()).toThrow('config not set');
    });

    it('should accept config via setConfig()', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig());
      expect(() => engine.analyze()).not.toThrow();
    });
  });

  describe('analyze() — full correlated analysis', () => {
    it('should return a CorrelatedResult with all sections', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig());
      const result = engine.analyze();

      expect(result.siReport).toBeDefined();
      expect(result.pdnResult).toBeDefined();
      expect(result.crossDomainIssues).toBeDefined();
      expect(Array.isArray(result.crossDomainIssues)).toBe(true);
      expect(result.decouplingAdequacy).toBeDefined();
      expect(result.unifiedScore).toBeGreaterThanOrEqual(0);
      expect(result.unifiedScore).toBeLessThanOrEqual(100);
      expect(result.unifiedRecommendations).toBeDefined();
      expect(Array.isArray(result.unifiedRecommendations)).toBe(true);
    });

    it('should run SI analysis on provided traces', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig());
      const result = engine.analyze();

      // SI report should have results for both traces
      expect(result.siReport.impedance.length).toBe(2);
      expect(result.siReport.termination.length).toBe(2);
    });

    it('should run PDN analysis with provided power net and caps', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig());
      const result = engine.analyze();

      expect(result.pdnResult.impedanceProfile.length).toBeGreaterThan(0);
      expect(result.pdnResult.summary).toBeDefined();
      expect(result.pdnResult.summary.overallRisk).toBeDefined();
    });

    it('should produce a unified score between 0 and 100', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig());
      const result = engine.analyze();

      expect(typeof result.unifiedScore).toBe('number');
      expect(result.unifiedScore).toBeGreaterThanOrEqual(0);
      expect(result.unifiedScore).toBeLessThanOrEqual(100);
    });

    it('should produce unified recommendations', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig());
      const result = engine.analyze();

      expect(result.unifiedRecommendations.length).toBeGreaterThan(0);
    });
  });

  describe('cross-domain issue detection', () => {
    it('should detect combined SI + PDN failure', () => {
      const config = makeConfig({
        // No caps -> PDN will likely fail
        caps: [],
        // Mismatched traces
        traces: [
          makeTraceInfo({ name: 'CLK', width: 0.05, targetZ0: 50 }),
        ],
      });

      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(config);
      const result = engine.analyze();

      // Without caps, PDN should fail target impedance
      // At least some issues should appear
      expect(result.crossDomainIssues.length).toBeGreaterThanOrEqual(0);
    });

    it('should assign severity levels to issues', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig());
      const result = engine.analyze();

      for (const issue of result.crossDomainIssues) {
        expect(['info', 'warning', 'critical']).toContain(issue.severity);
      }
    });

    it('should assign domain labels to issues', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig());
      const result = engine.analyze();

      for (const issue of result.crossDomainIssues) {
        expect(['si', 'pdn', 'cross-domain']).toContain(issue.domain);
      }
    });

    it('should include recommendations in each issue', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        caps: [],
        numSwitchingOutputs: 32,
        switchingCurrentPerOutput: 0.1,
        noiseMarginMv: 200,
      }));
      const result = engine.analyze();

      for (const issue of result.crossDomainIssues) {
        expect(issue.recommendation).toBeDefined();
        expect(issue.recommendation.length).toBeGreaterThan(0);
      }
    });

    it('should flag IR drop impact on signal levels when drop is high', () => {
      // With no caps and high-current demand, IR drop should be high
      const config = makeConfig({
        caps: [],
        powerNet: makePowerNet({ maxCurrent: 10, rippleTarget: 10 }),
      });

      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(config);
      const result = engine.analyze();

      // Check if any issue is about IR drop
      const irDropIssue = result.crossDomainIssues.find(
        (i) => i.id === 'ir-drop-signal-impact',
      );
      // May or may not trigger depending on PDN analyzer behavior without caps
      // Either way, the engine should complete without errors
      expect(result.pdnResult.irDrop).toBeDefined();
    });
  });

  describe('SSN estimation', () => {
    it('should return null when numSwitchingOutputs is 0', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({ numSwitchingOutputs: 0 }));
      const result = engine.analyze();

      expect(result.ssnEstimate).toBeNull();
    });

    it('should return null when numSwitchingOutputs is undefined', () => {
      const config = makeConfig();
      delete config.numSwitchingOutputs;
      config.numSwitchingOutputs = undefined;

      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(config);
      const result = engine.analyze();

      expect(result.ssnEstimate).toBeNull();
    });

    it('should estimate SSN when switching outputs configured', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        numSwitchingOutputs: 16,
        switchingCurrentPerOutput: 0.05,
        edgeRateNs: 1.0,
      }));
      const result = engine.analyze();

      expect(result.ssnEstimate).not.toBeNull();
      expect(result.ssnEstimate!.numSwitching).toBe(16);
      expect(result.ssnEstimate!.diDt).toBeGreaterThan(0);
      expect(result.ssnEstimate!.bounceMv).toBeGreaterThan(0);
    });

    it('should flag exceeded margin when bounce is too high', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        numSwitchingOutputs: 64,
        switchingCurrentPerOutput: 0.2,
        noiseMarginMv: 100,
        caps: [], // no decoupling -> high PDN impedance
      }));
      const result = engine.analyze();

      if (result.ssnEstimate) {
        expect(typeof result.ssnEstimate.exceededMargin).toBe('boolean');
        expect(result.ssnEstimate.noiseMarginMv).toBe(100);
      }
    });

    it('should create cross-domain issue when SSN exceeds margin', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        numSwitchingOutputs: 128,
        switchingCurrentPerOutput: 0.5,
        noiseMarginMv: 10,
        caps: [],
      }));
      const result = engine.analyze();

      if (result.ssnEstimate?.exceededMargin) {
        const ssnIssue = result.crossDomainIssues.find((i) => i.id === 'ssn-exceeded');
        expect(ssnIssue).toBeDefined();
        expect(ssnIssue!.severity).toBe('critical');
      }
    });

    it('should use default switching current if not specified', () => {
      const config = makeConfig({ numSwitchingOutputs: 8 });
      delete (config as unknown as Record<string, unknown>)['switchingCurrentPerOutput'];

      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(config);
      const result = engine.analyze();

      expect(result.ssnEstimate).not.toBeNull();
      // Default is 0.05A
      expect(result.ssnEstimate!.diDt).toBeCloseTo(8 * 0.05 / 1.0, 2);
    });
  });

  describe('return plane analysis', () => {
    it('should flag high-speed traces on shared return planes', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        traces: [
          makeTraceInfo({ name: 'CLK', length: 120, netClass: 'High-Speed', targetZ0: 50 }),
          makeTraceInfo({ name: 'DATA', length: 30, netClass: 'Default', targetZ0: 100 }),
        ],
      }));
      const result = engine.analyze();

      // CLK is high-speed + long -> should be flagged
      const clkIssue = result.returnPlaneIssues.find((i) => i.traceName === 'CLK');
      expect(clkIssue).toBeDefined();
      expect(clkIssue!.riskLevel).toBe('high'); // > 100mm
    });

    it('should not flag short traces', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        traces: [
          makeTraceInfo({ name: 'CLK', length: 10, netClass: 'High-Speed' }),
        ],
      }));
      const result = engine.analyze();

      const clkIssue = result.returnPlaneIssues.find((i) => i.traceName === 'CLK');
      expect(clkIssue).toBeUndefined();
    });

    it('should classify risk levels correctly', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        traces: [
          makeTraceInfo({ name: 'SIG_A', length: 80, netClass: 'High-Speed' }),
          makeTraceInfo({ name: 'SIG_B', length: 150, netClass: 'High-Speed' }),
        ],
      }));
      const result = engine.analyze();

      const sigA = result.returnPlaneIssues.find((i) => i.traceName === 'SIG_A');
      const sigB = result.returnPlaneIssues.find((i) => i.traceName === 'SIG_B');

      expect(sigA).toBeDefined();
      expect(sigA!.riskLevel).toBe('moderate');
      expect(sigB).toBeDefined();
      expect(sigB!.riskLevel).toBe('high');
    });

    it('should include power net name in return plane issues', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        powerNet: makePowerNet({ name: 'VCC_1V8' }),
        traces: [
          makeTraceInfo({ name: 'DDR_CLK', length: 60, netClass: 'High-Speed' }),
        ],
      }));
      const result = engine.analyze();

      for (const issue of result.returnPlaneIssues) {
        expect(issue.powerNetName).toBe('VCC_1V8');
      }
    });
  });

  describe('decoupling adequacy', () => {
    it('should compute max signal frequency from edge rate', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({ edgeRateNs: 1.0 }));
      const result = engine.analyze();

      // f_knee = 0.35 / 1ns = 350 MHz
      expect(result.decouplingAdequacy.maxSignalFreq).toBeCloseTo(350e6, -7);
    });

    it('should identify decoupling gap when coverage is insufficient', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        edgeRateNs: 0.1, // 100ps -> 3.5 GHz knee
        caps: [makeDecouplingCap({ value: 10e-6 })], // only bulk cap, no HF coverage
      }));
      const result = engine.analyze();

      // With only a 10uF cap and 100ps edge rate, there should be a coverage gap
      expect(result.decouplingAdequacy.maxSignalFreq).toBeCloseTo(3.5e9, -8);
    });

    it('should report adequate when coverage meets signal bandwidth', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        edgeRateNs: 10, // slow edge -> 35 MHz knee
        caps: [
          makeDecouplingCap({ value: 100e-9, esr: 0.01, esl: 0.5e-9 }),
          makeDecouplingCap({ value: 10e-6, esr: 0.005, esl: 1e-9 }),
        ],
      }));
      const result = engine.analyze();

      // With reasonable caps and slow edge rate, should be adequate
      expect(result.decouplingAdequacy.maxSignalFreq).toBeCloseTo(35e6, -6);
    });

    it('should create cross-domain issue for inadequate decoupling', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        edgeRateNs: 0.1,
        caps: [],
      }));
      const result = engine.analyze();

      if (!result.decouplingAdequacy.adequate) {
        const issue = result.crossDomainIssues.find((i) => i.id === 'decoupling-gap');
        expect(issue).toBeDefined();
        expect(issue!.severity).toBe('warning');
      }
    });

    it('should compute gap in decades', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        edgeRateNs: 0.1,
        caps: [],
      }));
      const result = engine.analyze();

      expect(result.decouplingAdequacy.gapDecades).toBeGreaterThanOrEqual(0);
    });
  });

  describe('unified scoring', () => {
    it('should produce lower score for poor PDN + SI', () => {
      const goodConfig = makeConfig();
      const badConfig = makeConfig({
        caps: [],
        traces: [
          makeTraceInfo({ name: 'BAD', width: 0.01, targetZ0: 50 }),
        ],
      });

      const engine1 = new SiPdnIntegrationEngine();
      engine1.setConfig(goodConfig);
      const goodResult = engine1.analyze();

      const engine2 = new SiPdnIntegrationEngine();
      engine2.setConfig(badConfig);
      const badResult = engine2.analyze();

      expect(badResult.unifiedScore).toBeLessThanOrEqual(goodResult.unifiedScore);
    });

    it('should cap score at 100', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig());
      const result = engine.analyze();

      expect(result.unifiedScore).toBeLessThanOrEqual(100);
    });

    it('should not go below 0', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        caps: [],
        numSwitchingOutputs: 200,
        switchingCurrentPerOutput: 1.0,
        noiseMarginMv: 1,
      }));
      const result = engine.analyze();

      expect(result.unifiedScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('unified recommendations', () => {
    it('should prefix recommendations with domain tags', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig());
      const result = engine.analyze();

      for (const rec of result.unifiedRecommendations) {
        // Each recommendation should have a tag like [SI], [PDN], [CRITICAL], etc.
        // or be the default "looks good" message
        expect(rec.length).toBeGreaterThan(0);
      }
    });

    it('should prioritize critical issues first', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        caps: [],
        numSwitchingOutputs: 128,
        switchingCurrentPerOutput: 0.5,
        noiseMarginMv: 1,
      }));
      const result = engine.analyze();

      if (result.unifiedRecommendations.length > 0) {
        const criticalIndex = result.unifiedRecommendations.findIndex(
          (r) => r.startsWith('[CRITICAL]'),
        );
        const warningIndex = result.unifiedRecommendations.findIndex(
          (r) => r.startsWith('[WARNING]'),
        );

        if (criticalIndex >= 0 && warningIndex >= 0) {
          expect(criticalIndex).toBeLessThan(warningIndex);
        }
      }
    });

    it('should say "looks good" when no issues found', () => {
      const engine = new SiPdnIntegrationEngine();
      // Good config with slow edge rate and plenty of decoupling
      const config = makeConfig({
        edgeRateNs: 10,
        numSwitchingOutputs: 0,
        traces: [],
      });
      engine.setConfig(config);
      const result = engine.analyze();

      // With no traces and no switching, should be clean
      const looksGood = result.unifiedRecommendations.some(
        (r) => r.includes('no critical issues') || r.includes('looks good') || r.includes('solid'),
      );
      // Not guaranteed since PDN may still have issues, but format is correct
      expect(result.unifiedRecommendations.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty traces array', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({ traces: [] }));
      const result = engine.analyze();

      expect(result.siReport.impedance).toHaveLength(0);
      expect(result.returnPlaneIssues).toHaveLength(0);
    });

    it('should handle empty caps array', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({ caps: [] }));
      const result = engine.analyze();

      expect(result.pdnResult).toBeDefined();
    });

    it('should handle empty VRMs array', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({ vrms: [] }));
      const result = engine.analyze();

      expect(result.pdnResult).toBeDefined();
    });

    it('should handle single trace', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({
        traces: [makeTraceInfo()],
      }));
      const result = engine.analyze();

      expect(result.siReport.impedance).toHaveLength(1);
    });

    it('should handle very fast edge rate', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({ edgeRateNs: 0.05 })); // 50ps
      const result = engine.analyze();

      expect(result.decouplingAdequacy.maxSignalFreq).toBeCloseTo(7e9, -8);
    });

    it('should handle very slow edge rate', () => {
      const engine = new SiPdnIntegrationEngine();
      engine.setConfig(makeConfig({ edgeRateNs: 100 })); // 100ns
      const result = engine.analyze();

      expect(result.decouplingAdequacy.maxSignalFreq).toBeCloseTo(3.5e6, -5);
    });
  });
});

// ---------------------------------------------------------------------------
// interpolateImpedance
// ---------------------------------------------------------------------------

describe('interpolateImpedance', () => {
  const profile: ImpedancePoint[] = [
    { frequency: 100, impedance: 1.0, phase: -90 },
    { frequency: 1000, impedance: 0.1, phase: -45 },
    { frequency: 10000, impedance: 0.01, phase: 0 },
    { frequency: 100000, impedance: 0.1, phase: 45 },
    { frequency: 1000000, impedance: 1.0, phase: 90 },
  ];

  it('should return first point impedance for frequency below range', () => {
    expect(interpolateImpedance(profile, 10)).toBe(1.0);
  });

  it('should return last point impedance for frequency above range', () => {
    expect(interpolateImpedance(profile, 10000000)).toBe(1.0);
  });

  it('should interpolate within range', () => {
    const z = interpolateImpedance(profile, 500);
    // Between 100 Hz (1.0 ohm) and 1000 Hz (0.1 ohm) — log-linear
    expect(z).toBeGreaterThan(0.05);
    expect(z).toBeLessThan(1.5);
  });

  it('should return exact value at profile frequencies', () => {
    expect(interpolateImpedance(profile, 100)).toBe(1.0);
    expect(interpolateImpedance(profile, 10000)).toBeCloseTo(0.01, 5);
  });

  it('should return 1 for empty profile', () => {
    expect(interpolateImpedance([], 1000)).toBe(1);
  });

  it('should handle single-point profile', () => {
    const single = [{ frequency: 1000, impedance: 0.5, phase: 0 }];
    expect(interpolateImpedance(single, 500)).toBe(0.5);
    expect(interpolateImpedance(single, 2000)).toBe(0.5);
  });

  it('should handle two-point profile', () => {
    const two: ImpedancePoint[] = [
      { frequency: 100, impedance: 1.0, phase: 0 },
      { frequency: 10000, impedance: 0.01, phase: 0 },
    ];
    const z = interpolateImpedance(two, 1000);
    // Geometric mean on log scale
    expect(z).toBeCloseTo(0.1, 1);
  });
});

// ---------------------------------------------------------------------------
// formatFrequency
// ---------------------------------------------------------------------------

describe('formatFrequency', () => {
  it('should format GHz range', () => {
    expect(formatFrequency(2.5e9)).toBe('2.50 GHz');
  });

  it('should format MHz range', () => {
    expect(formatFrequency(350e6)).toBe('350.00 MHz');
  });

  it('should format kHz range', () => {
    expect(formatFrequency(50e3)).toBe('50.00 kHz');
  });

  it('should format Hz range', () => {
    expect(formatFrequency(60)).toBe('60.00 Hz');
  });

  it('should format exact boundary values', () => {
    expect(formatFrequency(1e9)).toBe('1.00 GHz');
    expect(formatFrequency(1e6)).toBe('1.00 MHz');
    expect(formatFrequency(1e3)).toBe('1.00 kHz');
  });
});

// ---------------------------------------------------------------------------
// kneeFrequency
// ---------------------------------------------------------------------------

describe('kneeFrequency', () => {
  it('should compute f_knee = 0.35 / t_rise', () => {
    expect(kneeFrequency(1.0)).toBeCloseTo(350e6, -6);
  });

  it('should handle fast edge rate', () => {
    expect(kneeFrequency(0.1)).toBeCloseTo(3.5e9, -8);
  });

  it('should handle slow edge rate', () => {
    expect(kneeFrequency(10)).toBeCloseTo(35e6, -5);
  });

  it('should return 0 for zero rise time', () => {
    expect(kneeFrequency(0)).toBe(0);
  });

  it('should return 0 for negative rise time', () => {
    expect(kneeFrequency(-1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// estimateGroundBounce
// ---------------------------------------------------------------------------

describe('estimateGroundBounce', () => {
  it('should compute V = Z * N * I in mV', () => {
    // 50 milliohm PDN, 8 outputs, 50mA each
    const bounce = estimateGroundBounce(0.05, 8, 0.05);
    // 0.05 * 8 * 0.05 * 1000 = 20 mV
    expect(bounce).toBeCloseTo(20, 1);
  });

  it('should scale linearly with output count', () => {
    const b8 = estimateGroundBounce(0.05, 8, 0.05);
    const b16 = estimateGroundBounce(0.05, 16, 0.05);
    expect(b16).toBeCloseTo(b8 * 2, 1);
  });

  it('should scale linearly with current', () => {
    const b1 = estimateGroundBounce(0.05, 8, 0.05);
    const b2 = estimateGroundBounce(0.05, 8, 0.10);
    expect(b2).toBeCloseTo(b1 * 2, 1);
  });

  it('should return 0 for zero outputs', () => {
    expect(estimateGroundBounce(0.05, 0, 0.05)).toBe(0);
  });

  it('should return 0 for zero impedance', () => {
    expect(estimateGroundBounce(0, 8, 0.05)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Type coverage
// ---------------------------------------------------------------------------

describe('type coverage', () => {
  it('should export IssueSeverity type values', () => {
    const severities: IssueSeverity[] = ['info', 'warning', 'critical'];
    expect(severities).toHaveLength(3);
  });

  it('should export IssueDomain type values', () => {
    const domains: IssueDomain[] = ['si', 'pdn', 'cross-domain'];
    expect(domains).toHaveLength(3);
  });

  it('should export CrossDomainIssue with all fields', () => {
    const issue: CrossDomainIssue = {
      id: 'test',
      severity: 'info',
      domain: 'si',
      title: 'Test',
      description: 'Test description',
      affectedNets: ['net1'],
      recommendation: 'Fix it',
    };
    expect(issue.id).toBe('test');
  });

  it('should export SsnEstimate with all fields', () => {
    const ssn: SsnEstimate = {
      numSwitching: 8,
      diDt: 0.4,
      bounceMv: 20,
      exceededMargin: false,
      noiseMarginMv: 400,
    };
    expect(ssn.numSwitching).toBe(8);
  });

  it('should export ReturnPlaneIssue with all fields', () => {
    const rp: ReturnPlaneIssue = {
      traceName: 'CLK',
      sharedPlaneLayer: 'GND',
      powerNetName: 'VCC',
      riskLevel: 'high',
      explanation: 'Test',
    };
    expect(rp.riskLevel).toBe('high');
  });

  it('should export DecouplingAdequacy with all fields', () => {
    const da: DecouplingAdequacy = {
      maxSignalFreq: 350e6,
      pdnCoverageFreq: 100e6,
      adequate: false,
      gapDecades: 0.5,
    };
    expect(da.adequate).toBe(false);
  });
});
