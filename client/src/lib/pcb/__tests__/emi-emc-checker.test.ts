import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EmiEmcChecker,
  type EmcDesignData,
  type EmcReport,
  type EmcTrace,
  type EmcComponent,
  type EmcPlane,
  type EmcStackupLayer,
} from '../emi-emc-checker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStackup(): EmcStackupLayer[] {
  return [
    { name: 'Top', type: 'signal', thickness: 0.035 },
    { name: 'GND', type: 'plane', thickness: 1.0 },
    { name: 'PWR', type: 'plane', thickness: 1.0 },
    { name: 'Bot', type: 'signal', thickness: 0.035 },
  ];
}

function makeGndPlane(): EmcPlane {
  return {
    id: 'gnd-plane',
    netId: 'GND',
    layer: 'GND',
    boundary: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
  };
}

function makeEmptyDesign(): EmcDesignData {
  return {
    traces: [],
    components: [],
    planes: [],
    stackup: makeStackup(),
  };
}

function makeMinimalDesign(): EmcDesignData {
  return {
    traces: [
      {
        id: 't1',
        netId: 'CLK',
        layer: 'Top',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        width: 0.2,
        signalType: 'clock',
      },
    ],
    components: [],
    planes: [makeGndPlane()],
    stackup: makeStackup(),
  };
}

// ---------------------------------------------------------------------------
// Singleton & Subscribe
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — singleton & subscribe', () => {
  beforeEach(() => {
    EmiEmcChecker.resetInstance();
  });

  it('returns the same instance on repeated calls', () => {
    const a = EmiEmcChecker.getInstance();
    const b = EmiEmcChecker.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a fresh instance', () => {
    const a = EmiEmcChecker.getInstance();
    EmiEmcChecker.resetInstance();
    const b = EmiEmcChecker.getInstance();
    expect(a).not.toBe(b);
  });

  it('subscribe returns an unsubscribe function', () => {
    const checker = EmiEmcChecker.getInstance();
    const fn = vi.fn();
    const unsub = checker.subscribe(fn);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('notifies listeners on runCheck', () => {
    const checker = EmiEmcChecker.getInstance();
    const fn = vi.fn();
    checker.subscribe(fn);
    checker.runCheck(makeEmptyDesign());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('notifies listeners on setRuleEnabled', () => {
    const checker = EmiEmcChecker.getInstance();
    const fn = vi.fn();
    checker.subscribe(fn);
    checker.setRuleEnabled('loop-area', false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not notify after unsubscribe', () => {
    const checker = EmiEmcChecker.getInstance();
    const fn = vi.fn();
    const unsub = checker.subscribe(fn);
    unsub();
    checker.runCheck(makeEmptyDesign());
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rule management
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — rule management', () => {
  beforeEach(() => {
    EmiEmcChecker.resetInstance();
  });

  it('getRuleSet returns all 12 default rules', () => {
    const checker = EmiEmcChecker.getInstance();
    const rules = checker.getRuleSet();
    expect(rules.length).toBe(12);
  });

  it('all rules are enabled by default', () => {
    const checker = EmiEmcChecker.getInstance();
    const rules = checker.getRuleSet();
    expect(rules.every((r) => r.enabled)).toBe(true);
  });

  it('getRuleSet returns copies (not references)', () => {
    const checker = EmiEmcChecker.getInstance();
    const rules = checker.getRuleSet();
    rules[0].enabled = false;
    const fresh = checker.getRuleSet();
    expect(fresh[0].enabled).toBe(true);
  });

  it('setRuleEnabled disables a rule', () => {
    const checker = EmiEmcChecker.getInstance();
    checker.setRuleEnabled('loop-area', false);
    const rules = checker.getRuleSet();
    const rule = rules.find((r) => r.id === 'loop-area');
    expect(rule?.enabled).toBe(false);
  });

  it('setRuleEnabled re-enables a rule', () => {
    const checker = EmiEmcChecker.getInstance();
    checker.setRuleEnabled('loop-area', false);
    checker.setRuleEnabled('loop-area', true);
    const rules = checker.getRuleSet();
    const rule = rules.find((r) => r.id === 'loop-area');
    expect(rule?.enabled).toBe(true);
  });

  it('setRuleEnabled throws for unknown rule', () => {
    const checker = EmiEmcChecker.getInstance();
    expect(() => checker.setRuleEnabled('nonexistent', false)).toThrow('Unknown EMC rule');
  });

  it('setRuleSeverity changes severity', () => {
    const checker = EmiEmcChecker.getInstance();
    checker.setRuleSeverity('loop-area', 'info');
    const rules = checker.getRuleSet();
    const rule = rules.find((r) => r.id === 'loop-area');
    expect(rule?.severity).toBe('info');
  });

  it('setRuleSeverity throws for unknown rule', () => {
    const checker = EmiEmcChecker.getInstance();
    expect(() => checker.setRuleSeverity('nonexistent', 'warning')).toThrow('Unknown EMC rule');
  });
});

// ---------------------------------------------------------------------------
// Report basics
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — report basics', () => {
  beforeEach(() => {
    EmiEmcChecker.resetInstance();
  });

  it('empty design with all rules => all pass', () => {
    const checker = EmiEmcChecker.getInstance();
    const report = checker.runCheck(makeEmptyDesign());
    expect(report.violations.length).toBe(0);
    expect(report.score).toBe(100);
    expect(report.failCount).toBe(0);
  });

  it('score is 0-100', () => {
    const checker = EmiEmcChecker.getInstance();
    const report = checker.runCheck(makeMinimalDesign());
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it('getLastReport returns null before first run', () => {
    const checker = EmiEmcChecker.getInstance();
    expect(checker.getLastReport()).toBeNull();
  });

  it('getLastReport returns the last report after run', () => {
    const checker = EmiEmcChecker.getInstance();
    const report = checker.runCheck(makeEmptyDesign());
    const last = checker.getLastReport();
    expect(last).toEqual(report);
  });

  it('getLastReport returns a copy', () => {
    const checker = EmiEmcChecker.getInstance();
    checker.runCheck(makeEmptyDesign());
    const a = checker.getLastReport();
    const b = checker.getLastReport();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('all rules disabled => score 100, 0 pass, 0 fail', () => {
    const checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, false);
    }
    const report = checker.runCheck(makeMinimalDesign());
    expect(report.score).toBe(100);
    expect(report.passCount).toBe(0);
    expect(report.failCount).toBe(0);
    expect(report.violations.length).toBe(0);
  });

  it('report violations have required fields', () => {
    const checker = EmiEmcChecker.getInstance();
    // Create a design that will produce violations
    const design: EmcDesignData = {
      traces: [
        {
          id: 't-long-clock',
          netId: 'CLK_LONG',
          layer: 'Top',
          points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
          width: 0.2,
          signalType: 'clock',
        },
      ],
      components: [],
      planes: [makeGndPlane()],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    for (const v of report.violations) {
      expect(v.ruleId).toBeDefined();
      expect(v.severity).toBeDefined();
      expect(v.message).toBeDefined();
      expect(v.recommendation).toBeDefined();
      expect(['info', 'warning', 'error']).toContain(v.severity);
    }
  });
});

// ---------------------------------------------------------------------------
// Rule: loop-area
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — loop-area rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    // Disable all rules except loop-area
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'loop-area');
    }
  });

  it('short trace with adjacent plane passes', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'SIG', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], width: 0.2 },
      ],
      components: [],
      planes: [makeGndPlane()],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
    expect(report.passCount).toBe(1);
  });

  it('long trace without plane fails', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'SIG', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], width: 0.2 },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    // 200mm * 1.6mm default = 320 mm^2 > 100 mm^2
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0].ruleId).toBe('loop-area');
  });

  it('skips traces with < 2 points', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'SIG', layer: 'Top', points: [{ x: 0, y: 0 }], width: 0.2 },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: decoupling-cap-placement
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — decoupling-cap-placement rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'decoupling-cap-placement');
    }
  });

  it('cap within 5mm of IC power pin passes', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        {
          id: 'ic1', name: 'MCU', type: 'ic', position: { x: 50, y: 50 }, layer: 'Top',
          pins: [{ id: 'p1', position: { x: 50, y: 50 }, name: 'VCC', isPower: true }],
        },
        {
          id: 'c1', name: 'C1', type: 'capacitor', position: { x: 52, y: 50 }, layer: 'Top',
        },
      ],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });

  it('cap too far from IC power pin fails', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        {
          id: 'ic1', name: 'MCU', type: 'ic', position: { x: 50, y: 50 }, layer: 'Top',
          pins: [{ id: 'p1', position: { x: 50, y: 50 }, name: 'VCC', isPower: true }],
        },
        {
          id: 'c1', name: 'C1', type: 'capacitor', position: { x: 80, y: 50 }, layer: 'Top',
        },
      ],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(1);
    expect(report.violations[0].ruleId).toBe('decoupling-cap-placement');
  });

  it('IC with no power pins produces no violations', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        {
          id: 'ic1', name: 'Buffer', type: 'ic', position: { x: 50, y: 50 }, layer: 'Top',
          pins: [{ id: 'p1', position: { x: 50, y: 50 }, name: 'IN' }],
        },
      ],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });

  it('IC with no caps at all fails', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        {
          id: 'ic1', name: 'MCU', type: 'ic', position: { x: 50, y: 50 }, layer: 'Top',
          pins: [{ id: 'p1', position: { x: 50, y: 50 }, name: 'VDD', isPower: true }],
        },
      ],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(1);
    expect(report.violations[0].message).toContain('none');
  });
});

// ---------------------------------------------------------------------------
// Rule: clock-trace-length
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — clock-trace-length rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'clock-trace-length');
    }
  });

  it('short clock trace passes', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], width: 0.15, signalType: 'clock' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });

  it('long clock trace fails', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], width: 0.15, signalType: 'clock' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(1);
    expect(report.violations[0].ruleId).toBe('clock-trace-length');
  });

  it('non-clock traces are ignored', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'DATA', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], width: 0.15, signalType: 'data' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: ground-plane-continuity
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — ground-plane-continuity rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'ground-plane-continuity');
    }
  });

  it('trace near plane slot fails', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK', layer: 'Top', points: [{ x: 10, y: 10 }, { x: 20, y: 10 }], width: 0.2, signalType: 'clock' },
      ],
      components: [],
      planes: [{
        id: 'gnd', netId: 'GND', layer: 'GND',
        boundary: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        slots: [{ start: { x: 5, y: 10 }, end: { x: 25, y: 10 }, width: 1 }],
      }],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0].ruleId).toBe('ground-plane-continuity');
  });

  it('trace far from slot passes', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK', layer: 'Top', points: [{ x: 10, y: 10 }, { x: 20, y: 10 }], width: 0.2, signalType: 'clock' },
      ],
      components: [],
      planes: [{
        id: 'gnd', netId: 'GND', layer: 'GND',
        boundary: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        slots: [{ start: { x: 50, y: 80 }, end: { x: 60, y: 80 }, width: 0.5 }],
      }],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });

  it('plane with no slots passes', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'DATA', layer: 'Top', points: [{ x: 10, y: 10 }, { x: 20, y: 10 }], width: 0.2, signalType: 'data' },
      ],
      components: [],
      planes: [makeGndPlane()],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: split-plane-detection
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — split-plane-detection rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'split-plane-detection');
    }
  });

  it('split planes with adjacent high-speed trace warns', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], width: 0.15, signalType: 'clock' },
      ],
      components: [],
      planes: [
        { id: 'p1', netId: 'VCC', layer: 'GND', boundary: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }] },
        { id: 'p2', netId: '3V3', layer: 'GND', boundary: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }] },
      ],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0].ruleId).toBe('split-plane-detection');
  });

  it('single plane layer produces no violation', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], width: 0.15, signalType: 'clock' },
      ],
      components: [],
      planes: [makeGndPlane()],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: guard-trace
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — guard-trace rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'guard-trace');
    }
  });

  it('analog trace close to digital trace produces info', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'ADC_IN', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], width: 0.2, signalType: 'analog' },
        { id: 't2', netId: 'GPIO', layer: 'Top', points: [{ x: 0, y: 0.3 }, { x: 30, y: 0.3 }], width: 0.15, signalType: 'general' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0].ruleId).toBe('guard-trace');
  });

  it('analog trace far from other traces passes', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'ADC_IN', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], width: 0.2, signalType: 'analog' },
        { id: 't2', netId: 'GPIO', layer: 'Top', points: [{ x: 0, y: 50 }, { x: 30, y: 50 }], width: 0.15, signalType: 'general' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });

  it('analog traces on different layers are ignored', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'ADC_IN', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], width: 0.2, signalType: 'analog' },
        { id: 't2', netId: 'GPIO', layer: 'Bot', points: [{ x: 0, y: 0.3 }, { x: 30, y: 0.3 }], width: 0.15, signalType: 'general' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: connector-grounding
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — connector-grounding rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'connector-grounding');
    }
  });

  it('connector with no ground pins warns', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        {
          id: 'j1', name: 'USB', type: 'connector', position: { x: 0, y: 0 }, layer: 'Top',
          pins: [{ id: 'dp', position: { x: 0, y: 0 }, name: 'D+' }],
        },
      ],
      planes: [makeGndPlane()],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(1);
    expect(report.violations[0].ruleId).toBe('connector-grounding');
  });

  it('connector with ground pin close to plane passes', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        {
          id: 'j1', name: 'USB', type: 'connector', position: { x: 1, y: 1 }, layer: 'Top',
          pins: [
            { id: 'dp', position: { x: 1, y: 1 }, name: 'D+' },
            { id: 'gnd', position: { x: 1, y: 1 }, name: 'GND' },
          ],
        },
      ],
      planes: [makeGndPlane()],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: trace-spacing-emi
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — trace-spacing-emi rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'trace-spacing-emi');
    }
  });

  it('closely spaced high-speed traces warn', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK1', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], width: 0.2, signalType: 'clock' },
        { id: 't2', netId: 'CLK2', layer: 'Top', points: [{ x: 0, y: 0.3 }, { x: 30, y: 0.3 }], width: 0.2, signalType: 'clock' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0].ruleId).toBe('trace-spacing-emi');
  });

  it('well-spaced high-speed traces pass', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK1', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], width: 0.2, signalType: 'clock' },
        { id: 't2', netId: 'CLK2', layer: 'Top', points: [{ x: 0, y: 5 }, { x: 30, y: 5 }], width: 0.2, signalType: 'clock' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });

  it('high-speed traces on different layers are ignored', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK1', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], width: 0.2, signalType: 'clock' },
        { id: 't2', netId: 'CLK2', layer: 'Bot', points: [{ x: 0, y: 0.3 }, { x: 30, y: 0.3 }], width: 0.2, signalType: 'clock' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: edge-rate-trace-length
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — edge-rate-trace-length rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'edge-rate-trace-length');
    }
  });

  it('short data trace passes', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'DATA', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 0.15, signalType: 'data' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });

  it('long data trace fails', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'DATA', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], width: 0.15, signalType: 'data' },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(1);
    expect(report.violations[0].ruleId).toBe('edge-rate-trace-length');
  });
});

// ---------------------------------------------------------------------------
// Rule: power-plane-decoupling
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — power-plane-decoupling rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'power-plane-decoupling');
    }
  });

  it('power plane with enough caps passes', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        { id: 'c1', name: 'C1', type: 'capacitor', position: { x: 10, y: 10 }, layer: 'Top' },
        { id: 'c2', name: 'C2', type: 'capacitor', position: { x: 50, y: 50 }, layer: 'Top' },
      ],
      planes: [
        { id: 'pwr', netId: 'VCC', layer: 'PWR', boundary: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }] },
      ],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });

  it('power plane with too few caps produces info', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        { id: 'c1', name: 'C1', type: 'capacitor', position: { x: 10, y: 10 }, layer: 'Top' },
      ],
      planes: [
        { id: 'pwr', netId: 'VCC', layer: 'PWR', boundary: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }] },
      ],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(1);
    expect(report.violations[0].ruleId).toBe('power-plane-decoupling');
  });

  it('ground planes are excluded', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [],
      planes: [makeGndPlane()],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: return-path-proximity
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — return-path-proximity rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'return-path-proximity');
    }
  });

  it('trace with adjacent plane passes', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'SIG', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 0.2 },
      ],
      components: [],
      planes: [makeGndPlane()],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });

  it('trace with no adjacent plane fails', () => {
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'SIG', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 0.2 },
      ],
      components: [],
      planes: [
        // Plane on a non-adjacent layer (Bot is index 3, Top is index 0 — 3 layers apart)
        { id: 'gnd', netId: 'GND', layer: 'Bot', boundary: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] },
      ],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(1);
    expect(report.violations[0].ruleId).toBe('return-path-proximity');
  });
});

// ---------------------------------------------------------------------------
// Rule: esd-protection-connector
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — esd-protection-connector rule', () => {
  let checker: EmiEmcChecker;

  beforeEach(() => {
    EmiEmcChecker.resetInstance();
    checker = EmiEmcChecker.getInstance();
    for (const rule of checker.getRuleSet()) {
      checker.setRuleEnabled(rule.id, rule.id === 'esd-protection-connector');
    }
  });

  it('connector with nearby TVS passes', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        { id: 'j1', name: 'USB', type: 'connector', position: { x: 5, y: 5 }, layer: 'Top' },
        { id: 'd1', name: 'TVS-USB', type: 'other', position: { x: 8, y: 5 }, layer: 'Top' },
      ],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(0);
  });

  it('connector with no ESD protection warns', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        { id: 'j1', name: 'USB', type: 'connector', position: { x: 5, y: 5 }, layer: 'Top' },
      ],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(1);
    expect(report.violations[0].ruleId).toBe('esd-protection-connector');
  });

  it('connector with far ESD protection warns', () => {
    const design: EmcDesignData = {
      traces: [],
      components: [
        { id: 'j1', name: 'USB', type: 'connector', position: { x: 5, y: 5 }, layer: 'Top' },
        { id: 'd1', name: 'TVS-1', type: 'other', position: { x: 50, y: 50 }, layer: 'Top' },
      ],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.violations.length).toBe(1);
    expect(report.violations[0].ruleId).toBe('esd-protection-connector');
  });
});

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — score calculation', () => {
  beforeEach(() => {
    EmiEmcChecker.resetInstance();
  });

  it('all pass => 100', () => {
    const checker = EmiEmcChecker.getInstance();
    const report = checker.runCheck(makeEmptyDesign());
    expect(report.score).toBe(100);
  });

  it('mixed pass/fail produces intermediate score', () => {
    const checker = EmiEmcChecker.getInstance();
    // Design that will fail some rules and pass others
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], width: 0.15, signalType: 'clock' },
      ],
      components: [],
      planes: [makeGndPlane()],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(100);
    expect(report.passCount + report.failCount).toBeGreaterThan(0);
  });

  it('severity override applies', () => {
    const checker = EmiEmcChecker.getInstance();
    checker.setRuleSeverity('clock-trace-length', 'info');
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'CLK', layer: 'Top', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], width: 0.15, signalType: 'clock' },
      ],
      components: [],
      planes: [makeGndPlane()],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    const clockViolations = report.violations.filter((v) => v.ruleId === 'clock-trace-length');
    for (const v of clockViolations) {
      expect(v.severity).toBe('info');
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('EmiEmcChecker — edge cases', () => {
  beforeEach(() => {
    EmiEmcChecker.resetInstance();
  });

  it('empty design with empty stackup', () => {
    const checker = EmiEmcChecker.getInstance();
    const design: EmcDesignData = {
      traces: [],
      components: [],
      planes: [],
      stackup: [],
    };
    const report = checker.runCheck(design);
    expect(report.score).toBe(100);
  });

  it('handles traces with empty points array', () => {
    const checker = EmiEmcChecker.getInstance();
    const design: EmcDesignData = {
      traces: [
        { id: 't1', netId: 'SIG', layer: 'Top', points: [], width: 0.2 },
      ],
      components: [],
      planes: [],
      stackup: makeStackup(),
    };
    // Should not throw
    const report = checker.runCheck(design);
    expect(report).toBeDefined();
  });

  it('handles components with no pins', () => {
    const checker = EmiEmcChecker.getInstance();
    const design: EmcDesignData = {
      traces: [],
      components: [
        { id: 'ic1', name: 'MCU', type: 'ic', position: { x: 50, y: 50 }, layer: 'Top' },
      ],
      planes: [],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report).toBeDefined();
  });

  it('handles planes with empty boundary', () => {
    const checker = EmiEmcChecker.getInstance();
    const design: EmcDesignData = {
      traces: [],
      components: [],
      planes: [{ id: 'p1', netId: 'GND', layer: 'GND', boundary: [] }],
      stackup: makeStackup(),
    };
    const report = checker.runCheck(design);
    expect(report).toBeDefined();
  });
});
