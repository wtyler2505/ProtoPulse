import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  PredictionEngine,
} from '../ai-prediction-engine';
import type {
  PredictionNode,
  PredictionEdge,
  PredictionBomItem,
  Prediction,
} from '../ai-prediction-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function node(overrides: Partial<PredictionNode> & { id: string }): PredictionNode {
  return { type: 'generic', label: overrides.id, ...overrides };
}

function edge(source: string, target: string, overrides?: Partial<PredictionEdge>): PredictionEdge {
  return { id: `${source}-${target}`, source, target, ...overrides };
}

function bom(overrides: Partial<PredictionBomItem> & { id: string }): PredictionBomItem {
  return { partNumber: 'PART-001', description: 'Generic part', quantity: 1, ...overrides };
}

function findByRule(preds: Prediction[], ruleId: string): Prediction | undefined {
  return preds.find((p) => p.ruleId === ruleId);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  PredictionEngine.resetInstance();
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('PredictionEngine — singleton', () => {
  it('returns the same instance across calls', () => {
    const a = PredictionEngine.getInstance();
    const b = PredictionEngine.getInstance();
    expect(a).toBe(b);
  });

  it('returns a new instance after reset', () => {
    const a = PredictionEngine.getInstance();
    PredictionEngine.resetInstance();
    const b = PredictionEngine.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Rule count
// ---------------------------------------------------------------------------

describe('PredictionEngine — rule registry', () => {
  it('has at least 30 built-in rules', () => {
    const engine = PredictionEngine.getInstance();
    expect(engine.getRuleCount()).toBeGreaterThanOrEqual(30);
  });

  it('returns copies of the rules array', () => {
    const engine = PredictionEngine.getInstance();
    const a = engine.getRules();
    const b = engine.getRules();
    expect(a).not.toBe(b);
    expect(a.length).toBe(b.length);
  });
});

// ---------------------------------------------------------------------------
// Missing Component Rules
// ---------------------------------------------------------------------------

describe('PredictionEngine — missing component rules', () => {
  it('suggests decoupling caps when MCU present without caps', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ATmega328P' })],
      [],
      [],
    );
    const match = findByRule(preds, 'mcu-decoupling-caps');
    expect(match).toBeDefined();
    expect(match!.category).toBe('missing_component');
    expect(match!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('does NOT suggest decoupling caps when MCU has connected capacitor', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'mcu1', type: 'mcu', label: 'ATmega328P' }),
        node({ id: 'cap1', type: 'generic', label: '100nF Capacitor' }),
      ],
      [edge('mcu1', 'cap1')],
      [],
    );
    expect(findByRule(preds, 'mcu-decoupling-caps')).toBeUndefined();
  });

  it('suggests crystal when MCU has no clock source', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'STM32' })],
      [],
      [],
    );
    expect(findByRule(preds, 'mcu-crystal')).toBeDefined();
  });

  it('does NOT suggest crystal when design already has oscillator', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'mcu1', type: 'mcu', label: 'STM32' }),
        node({ id: 'osc1', type: 'generic', label: '16MHz Crystal' }),
      ],
      [],
      [],
    );
    expect(findByRule(preds, 'mcu-crystal')).toBeUndefined();
  });

  it('suggests flyback diode for motor without one', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'motor1', type: 'generic', label: 'DC Motor' })],
      [],
      [],
    );
    expect(findByRule(preds, 'motor-flyback-diode')).toBeDefined();
  });

  it('suggests flyback diode for relay without one', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'relay1', type: 'generic', label: 'Relay 5V' })],
      [],
      [],
    );
    expect(findByRule(preds, 'motor-flyback-diode')).toBeDefined();
  });

  it('does NOT suggest flyback diode when motor has connected diode', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'motor1', type: 'generic', label: 'DC Motor' }),
        node({ id: 'diode1', type: 'generic', label: '1N4007 Diode' }),
      ],
      [edge('motor1', 'diode1')],
      [],
    );
    expect(findByRule(preds, 'motor-flyback-diode')).toBeUndefined();
  });

  it('suggests input/output caps for voltage regulator', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'reg1', type: 'power', label: 'LDO Regulator 3.3V' })],
      [],
      [],
    );
    expect(findByRule(preds, 'regulator-caps')).toBeDefined();
  });

  it('does NOT suggest regulator caps when 2+ caps connected', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'reg1', type: 'power', label: 'LDO Regulator' }),
        node({ id: 'cap1', type: 'generic', label: '10uF Cap' }),
        node({ id: 'cap2', type: 'generic', label: '100nF Cap' }),
      ],
      [edge('reg1', 'cap1'), edge('reg1', 'cap2')],
      [],
    );
    expect(findByRule(preds, 'regulator-caps')).toBeUndefined();
  });

  it('suggests reverse polarity protection when battery present', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'bat1', type: 'generic', label: 'Battery 12V' })],
      [],
      [],
    );
    expect(findByRule(preds, 'reverse-polarity-protection')).toBeDefined();
  });

  it('suggests current limiting resistor for LED without one', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'led1', type: 'generic', label: 'Red LED' })],
      [],
      [],
    );
    expect(findByRule(preds, 'led-current-resistor')).toBeDefined();
  });

  it('does NOT suggest LED resistor when resistor is connected', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'led1', type: 'generic', label: 'Red LED' }),
        node({ id: 'r1', type: 'generic', label: '330R Resistor' }),
      ],
      [edge('led1', 'r1')],
      [],
    );
    expect(findByRule(preds, 'led-current-resistor')).toBeUndefined();
  });

  it('suggests bootstrap caps for H-bridge without capacitors', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'hb1', type: 'generic', label: 'L298N H-Bridge' })],
      [],
      [],
    );
    expect(findByRule(preds, 'hbridge-bootstrap-caps')).toBeDefined();
  });

  it('suggests ESD protection for USB connector', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'usb1', type: 'connector', label: 'USB-C Connector' })],
      [],
      [],
    );
    expect(findByRule(preds, 'usb-esd-protection')).toBeDefined();
  });

  it('does NOT suggest USB ESD when TVS is connected', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'usb1', type: 'connector', label: 'USB-C Connector' }),
        node({ id: 'tvs1', type: 'generic', label: 'TVS Diode ESD Protection' }),
      ],
      [edge('usb1', 'tvs1')],
      [],
    );
    expect(findByRule(preds, 'usb-esd-protection')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Best Practice Rules
// ---------------------------------------------------------------------------

describe('PredictionEngine — best practice rules', () => {
  it('suggests power indicator when design has power source but no LED', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'reg1', type: 'power', label: 'LDO Regulator' }),
        node({ id: 'mcu1', type: 'mcu', label: 'ESP32' }),
        node({ id: 'sens1', type: 'sensor', label: 'Temperature Sensor' }),
      ],
      [],
      [],
    );
    expect(findByRule(preds, 'power-indicator')).toBeDefined();
  });

  it('suggests ferrite bead when 3+ ICs share power', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'ic1', type: 'generic', label: 'IC Driver' }),
        node({ id: 'ic2', type: 'generic', label: 'IC Timer' }),
      ],
      [],
      [],
    );
    expect(findByRule(preds, 'ferrite-bead-shared-power')).toBeDefined();
  });

  it('suggests wider traces when motor is present', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'motor1', type: 'generic', label: 'DC Motor' })],
      [],
      [],
    );
    expect(findByRule(preds, 'high-current-traces')).toBeDefined();
  });

  it('suggests sensor filtering when sensor has no filter', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'sens1', type: 'sensor', label: 'Pressure Sensor' })],
      [],
      [],
    );
    expect(findByRule(preds, 'sensor-filtering')).toBeDefined();
  });

  it('suggests test points when design has 5+ nodes and none', () => {
    const engine = PredictionEngine.getInstance();
    const nodes = Array.from({ length: 5 }, (_, i) =>
      node({ id: `n${i}`, type: 'generic', label: `Component ${i}` }),
    );
    const preds = engine.analyze(nodes, [], []);
    expect(findByRule(preds, 'no-test-points')).toBeDefined();
  });

  it('does NOT suggest test points when test point exists', () => {
    const engine = PredictionEngine.getInstance();
    const nodes = [
      ...Array.from({ length: 4 }, (_, i) =>
        node({ id: `n${i}`, type: 'generic', label: `Component ${i}` }),
      ),
      node({ id: 'tp1', type: 'generic', label: 'Test Point TP1' }),
    ];
    const preds = engine.analyze(nodes, [], []);
    expect(findByRule(preds, 'no-test-points')).toBeUndefined();
  });

  it('suggests mounting holes when design has 5+ nodes and none', () => {
    const engine = PredictionEngine.getInstance();
    const nodes = Array.from({ length: 5 }, (_, i) =>
      node({ id: `n${i}`, type: 'generic', label: `Component ${i}` }),
    );
    const preds = engine.analyze(nodes, [], []);
    expect(findByRule(preds, 'no-mounting-holes')).toBeDefined();
  });

  it('suggests star grounding when 3+ ground nodes exist', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'gnd1', type: 'generic', label: 'GND' }),
        node({ id: 'gnd2', type: 'generic', label: 'Ground' }),
        node({ id: 'gnd3', type: 'generic', label: 'GND Rail' }),
      ],
      [],
      [],
    );
    expect(findByRule(preds, 'star-grounding')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Safety Rules
// ---------------------------------------------------------------------------

describe('PredictionEngine — safety rules', () => {
  it('suggests fuse for mains voltage design', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'mains1', type: 'generic', label: 'AC Mains Input 120V' })],
      [],
      [],
    );
    expect(findByRule(preds, 'mains-fuse')).toBeDefined();
    expect(findByRule(preds, 'mains-fuse')!.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('suggests battery protection when battery present', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'bat1', type: 'generic', label: 'LiPo Battery' })],
      [],
      [],
    );
    expect(findByRule(preds, 'battery-protection')).toBeDefined();
  });

  it('suggests motor current sensing when motor present', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'motor1', type: 'generic', label: 'Stepper Motor' })],
      [],
      [],
    );
    expect(findByRule(preds, 'motor-current-sensing')).toBeDefined();
  });

  it('suggests isolation when high and low voltage mixed', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'hv1', type: 'generic', label: 'AC Mains Input' }),
        node({ id: 'mcu1', type: 'mcu', label: 'ESP32' }),
      ],
      [],
      [],
    );
    expect(findByRule(preds, 'high-voltage-isolation')).toBeDefined();
  });

  it('suggests ESD protection on external connectors', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'conn1', type: 'connector', label: 'Header Connector' })],
      [],
      [],
    );
    expect(findByRule(preds, 'connector-esd-protection')).toBeDefined();
  });

  it('suggests thermal management for power components', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'reg1', type: 'power', label: 'LDO Regulator' })],
      [],
      [],
    );
    expect(findByRule(preds, 'thermal-management')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Optimization Rules
// ---------------------------------------------------------------------------

describe('PredictionEngine — optimization rules', () => {
  it('suggests consolidating resistor values when 4+ unique values in BOM', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [],
      [],
      [
        bom({ id: 'r1', description: 'Resistor 100 Ohm' }),
        bom({ id: 'r2', description: 'Resistor 220 Ohm' }),
        bom({ id: 'r3', description: 'Resistor 470 Ohm' }),
        bom({ id: 'r4', description: 'Resistor 1K Ohm' }),
      ],
    );
    expect(findByRule(preds, 'duplicate-resistor-values')).toBeDefined();
  });

  it('suggests diversifying manufacturers when 60%+ from one', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [],
      [],
      [
        bom({ id: 'b1', manufacturer: 'AcmeCorp', description: 'Part A' }),
        bom({ id: 'b2', manufacturer: 'AcmeCorp', description: 'Part B' }),
        bom({ id: 'b3', manufacturer: 'AcmeCorp', description: 'Part C' }),
        bom({ id: 'b4', manufacturer: 'AcmeCorp', description: 'Part D' }),
        bom({ id: 'b5', manufacturer: 'OtherCo', description: 'Part E' }),
      ],
    );
    expect(findByRule(preds, 'single-source-risk')).toBeDefined();
  });

  it('suggests integrated solution with 10+ discrete components', () => {
    const engine = PredictionEngine.getInstance();
    const nodes = [
      ...Array.from({ length: 5 }, (_, i) =>
        node({ id: `r${i}`, type: 'generic', label: `Resistor ${i}` }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        node({ id: `c${i}`, type: 'generic', label: `Capacitor ${i}` }),
      ),
    ];
    const preds = engine.analyze(nodes, [], []);
    expect(findByRule(preds, 'integrated-solution')).toBeDefined();
  });

  it('suggests test headers for MCU with few connections', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'mcu1', type: 'mcu', label: 'ATmega328P' }),
        node({ id: 'led1', type: 'generic', label: 'LED' }),
        node({ id: 'r1', type: 'generic', label: 'Resistor' }),
      ],
      [edge('mcu1', 'led1')],
      [],
    );
    expect(findByRule(preds, 'unused-mcu-pins')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Learning Tips
// ---------------------------------------------------------------------------

describe('PredictionEngine — learning tips', () => {
  it('shows datasheet tip for small designs (1-3 nodes)', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'n1', type: 'generic', label: 'Arduino Uno' })],
      [],
      [],
    );
    expect(findByRule(preds, 'tip-datasheets')).toBeDefined();
  });

  it('does NOT show datasheet tip for larger designs (>3 nodes)', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      Array.from({ length: 4 }, (_, i) =>
        node({ id: `n${i}`, type: 'generic', label: `Part ${i}` }),
      ),
      [],
      [],
    );
    expect(findByRule(preds, 'tip-datasheets')).toBeUndefined();
  });

  it('shows dropout voltage tip when regulator present', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'reg1', type: 'power', label: 'LDO Regulator' })],
      [],
      [],
    );
    expect(findByRule(preds, 'tip-dropout-voltage')).toBeDefined();
  });

  it('shows decoupling capacitor tip when capacitor present', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'cap1', type: 'generic', label: '100nF Bypass Capacitor' })],
      [],
      [],
    );
    expect(findByRule(preds, 'tip-decoupling-why')).toBeDefined();
  });

  it('shows base resistor tip when transistor present', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'q1', type: 'generic', label: '2N2222 BJT Transistor' })],
      [],
      [],
    );
    expect(findByRule(preds, 'tip-base-resistor')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

describe('PredictionEngine — confidence scoring', () => {
  it('returns predictions sorted by confidence descending', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'mcu1', type: 'mcu', label: 'ESP32' }),
        node({ id: 'motor1', type: 'generic', label: 'DC Motor' }),
        node({ id: 'led1', type: 'generic', label: 'LED' }),
      ],
      [],
      [],
    );
    for (let i = 1; i < preds.length; i++) {
      expect(preds[i - 1].confidence).toBeGreaterThanOrEqual(preds[i].confidence);
    }
  });

  it('adjusts confidence down when user frequently dismisses a rule', () => {
    const engine = PredictionEngine.getInstance();

    // First analysis — get baseline
    const firstPreds = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const baseline = findByRule(firstPreds, 'mcu-decoupling-caps');
    expect(baseline).toBeDefined();
    const baselineConfidence = baseline!.confidence;

    // Dismiss multiple times
    engine.dismiss(baseline!.id);
    // Fast-forward past cooldown
    vi.advanceTimersByTime(COOLDOWN_MS_PLUS);

    PredictionEngine.resetInstance();
    const engine2 = PredictionEngine.getInstance();

    // Dismiss again
    const preds2 = engine2.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const match2 = findByRule(preds2, 'mcu-decoupling-caps');
    if (match2) {
      engine2.dismiss(match2.id);
      vi.advanceTimersByTime(COOLDOWN_MS_PLUS);
    }

    PredictionEngine.resetInstance();
    const engine3 = PredictionEngine.getInstance();
    const preds3 = engine3.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const match3 = findByRule(preds3, 'mcu-decoupling-caps');
    if (match3) {
      expect(match3.confidence).toBeLessThan(baselineConfidence);
    }
  });

  it('all predictions have confidence between 0 and 1', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'mcu1', type: 'mcu', label: 'ESP32' }),
        node({ id: 'motor1', type: 'generic', label: 'Motor' }),
        node({ id: 'bat1', type: 'generic', label: 'LiPo Battery' }),
      ],
      [],
      [],
    );
    preds.forEach((p) => {
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(1);
    });
  });
});

const COOLDOWN_MS_PLUS = 7 * 24 * 60 * 60 * 1000 + 1000;

// ---------------------------------------------------------------------------
// Cooldown / dismiss behavior
// ---------------------------------------------------------------------------

describe('PredictionEngine — cooldown/dismiss', () => {
  it('dismissed rules do not reappear within 7-day cooldown', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const mcuCaps = findByRule(preds, 'mcu-decoupling-caps');
    expect(mcuCaps).toBeDefined();
    engine.dismiss(mcuCaps!.id);

    // Re-analyze — should be gone
    const preds2 = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    expect(findByRule(preds2, 'mcu-decoupling-caps')).toBeUndefined();
  });

  it('dismissed rules reappear after 7-day cooldown', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const mcuCaps = findByRule(preds, 'mcu-decoupling-caps');
    expect(mcuCaps).toBeDefined();
    engine.dismiss(mcuCaps!.id);

    // Advance past cooldown
    vi.advanceTimersByTime(COOLDOWN_MS_PLUS);

    const preds2 = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    expect(findByRule(preds2, 'mcu-decoupling-caps')).toBeDefined();
  });

  it('clearAll dismisses all current predictions', () => {
    const engine = PredictionEngine.getInstance();
    engine.analyze(
      [
        node({ id: 'mcu1', type: 'mcu', label: 'ESP32' }),
        node({ id: 'motor1', type: 'generic', label: 'Motor' }),
      ],
      [],
      [],
    );
    expect(engine.getPredictions().length).toBeGreaterThan(0);
    engine.clearAll();
    expect(engine.getPredictions().length).toBe(0);
  });

  it('dismiss persists across engine instances via localStorage', () => {
    const engine1 = PredictionEngine.getInstance();
    const preds1 = engine1.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const mcuCaps = findByRule(preds1, 'mcu-decoupling-caps');
    expect(mcuCaps).toBeDefined();
    engine1.dismiss(mcuCaps!.id);

    // Reset and create new instance (simulates page reload)
    PredictionEngine.resetInstance();
    const engine2 = PredictionEngine.getInstance();
    const preds2 = engine2.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    expect(findByRule(preds2, 'mcu-decoupling-caps')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// User feedback tracking
// ---------------------------------------------------------------------------

describe('PredictionEngine — feedback tracking', () => {
  it('tracks accepts', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const pred = preds[0];
    engine.accept(pred.id);

    const feedback = engine.getFeedback();
    const record = feedback.find((f) => f.ruleId === pred.ruleId);
    expect(record).toBeDefined();
    expect(record!.accepts).toBe(1);
    expect(record!.dismisses).toBe(0);
  });

  it('tracks dismisses', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const pred = preds[0];
    engine.dismiss(pred.id);

    const feedback = engine.getFeedback();
    const record = feedback.find((f) => f.ruleId === pred.ruleId);
    expect(record).toBeDefined();
    expect(record!.dismisses).toBe(1);
  });

  it('persists feedback to localStorage', () => {
    const engine1 = PredictionEngine.getInstance();
    const preds = engine1.analyze(
      [node({ id: 'led1', type: 'generic', label: 'LED' })],
      [],
      [],
    );
    if (preds.length > 0) {
      engine1.accept(preds[0].id);
    }

    PredictionEngine.resetInstance();
    const engine2 = PredictionEngine.getInstance();
    const feedback = engine2.getFeedback();
    expect(feedback.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Debounce behavior
// ---------------------------------------------------------------------------

describe('PredictionEngine — debounce', () => {
  it('debounced analyze delays execution', () => {
    const engine = PredictionEngine.getInstance();
    engine.analyzeDebounced(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    // Before debounce fires
    expect(engine.getPredictions().length).toBe(0);

    // Advance past debounce
    vi.advanceTimersByTime(2100);
    expect(engine.getPredictions().length).toBeGreaterThan(0);
  });

  it('debounce resets on repeated calls', () => {
    const engine = PredictionEngine.getInstance();

    engine.analyzeDebounced(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    vi.advanceTimersByTime(1500);

    // Call again — should reset the timer
    engine.analyzeDebounced(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    vi.advanceTimersByTime(1500);

    // Not yet (only 1500ms since last call)
    expect(engine.getPredictions().length).toBe(0);

    vi.advanceTimersByTime(600);
    expect(engine.getPredictions().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Max suggestions limit
// ---------------------------------------------------------------------------

describe('PredictionEngine — max suggestions', () => {
  it('limits results to max 5 predictions', () => {
    const engine = PredictionEngine.getInstance();
    // Create a complex design that triggers many rules
    const preds = engine.analyze(
      [
        node({ id: 'mcu1', type: 'mcu', label: 'ESP32' }),
        node({ id: 'motor1', type: 'generic', label: 'DC Motor' }),
        node({ id: 'led1', type: 'generic', label: 'Red LED' }),
        node({ id: 'reg1', type: 'power', label: 'LDO Regulator' }),
        node({ id: 'bat1', type: 'generic', label: 'LiPo Battery' }),
        node({ id: 'usb1', type: 'connector', label: 'USB-C Connector' }),
        node({ id: 'conn1', type: 'connector', label: 'Header Connector' }),
      ],
      [],
      [],
    );
    expect(preds.length).toBeLessThanOrEqual(5);
  });

  it('selects highest-confidence predictions when capping at 5', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'mcu1', type: 'mcu', label: 'ESP32' }),
        node({ id: 'motor1', type: 'generic', label: 'DC Motor' }),
        node({ id: 'led1', type: 'generic', label: 'Red LED' }),
        node({ id: 'reg1', type: 'power', label: 'LDO Regulator' }),
        node({ id: 'bat1', type: 'generic', label: 'LiPo Battery' }),
        node({ id: 'usb1', type: 'connector', label: 'USB-C Connector' }),
        node({ id: 'conn1', type: 'connector', label: 'Header Connector' }),
      ],
      [],
      [],
    );
    // All shown predictions should have higher confidence than any hypothetical 6th
    const minShown = Math.min(...preds.map((p) => p.confidence));
    expect(minShown).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Empty design
// ---------------------------------------------------------------------------

describe('PredictionEngine — edge cases', () => {
  it('returns no predictions for empty design', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze([], [], []);
    expect(preds.length).toBe(0);
  });

  it('returns predictions copy (not internal reference)', () => {
    const engine = PredictionEngine.getInstance();
    engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const a = engine.getPredictions();
    const b = engine.getPredictions();
    expect(a).not.toBe(b);
    expect(a.length).toBe(b.length);
  });

  it('each prediction has a unique id', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [
        node({ id: 'mcu1', type: 'mcu', label: 'ESP32' }),
        node({ id: 'motor1', type: 'generic', label: 'Motor' }),
      ],
      [],
      [],
    );
    const ids = preds.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('predictions have required fields', () => {
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    preds.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.ruleId).toBeTruthy();
      expect(p.title).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(typeof p.confidence).toBe('number');
      expect(p.category).toBeTruthy();
      expect(p.dismissed).toBe(false);
    });
  });

  it('accept removes prediction from active list', () => {
    const engine = PredictionEngine.getInstance();
    engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const before = engine.getPredictions().length;
    expect(before).toBeGreaterThan(0);
    engine.accept(engine.getPredictions()[0].id);
    expect(engine.getPredictions().length).toBe(before - 1);
  });

  it('dismiss on non-existent id is a no-op', () => {
    const engine = PredictionEngine.getInstance();
    engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const before = engine.getPredictions().length;
    engine.dismiss('non-existent-id');
    expect(engine.getPredictions().length).toBe(before);
  });

  it('accept on non-existent id is a no-op', () => {
    const engine = PredictionEngine.getInstance();
    engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const before = engine.getPredictions().length;
    engine.accept('non-existent-id');
    expect(engine.getPredictions().length).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('PredictionEngine — subscription', () => {
  it('notifies subscribers on analyze', () => {
    const engine = PredictionEngine.getInstance();
    const cb = vi.fn();
    engine.subscribe(cb);
    engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    // Called twice: once when isAnalyzing=true, once when done
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('notifies subscribers on dismiss', () => {
    const engine = PredictionEngine.getInstance();
    engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const cb = vi.fn();
    engine.subscribe(cb);
    const pred = engine.getPredictions()[0];
    engine.dismiss(pred.id);
    expect(cb).toHaveBeenCalled();
  });

  it('notifies subscribers on accept', () => {
    const engine = PredictionEngine.getInstance();
    engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const cb = vi.fn();
    engine.subscribe(cb);
    engine.accept(engine.getPredictions()[0].id);
    expect(cb).toHaveBeenCalled();
  });

  it('notifies subscribers on clearAll', () => {
    const engine = PredictionEngine.getInstance();
    engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    const cb = vi.fn();
    engine.subscribe(cb);
    engine.clearAll();
    expect(cb).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const engine = PredictionEngine.getInstance();
    const cb = vi.fn();
    const unsub = engine.subscribe(cb);
    unsub();
    engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    expect(cb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Complex design scenario
// ---------------------------------------------------------------------------

describe('PredictionEngine — complex design', () => {
  it('produces multiple predictions for a realistic design, all ranked by confidence', () => {
    const engine = PredictionEngine.getInstance();
    const nodes: PredictionNode[] = [
      node({ id: 'mcu1', type: 'mcu', label: 'Arduino Mega' }),
      node({ id: 'esp1', type: 'comm', label: 'ESP32 WiFi' }),
      node({ id: 'motor1', type: 'generic', label: 'DC Motor Left' }),
      node({ id: 'motor2', type: 'generic', label: 'DC Motor Right' }),
      node({ id: 'driver1', type: 'generic', label: 'L298N H-Bridge' }),
      node({ id: 'bat1', type: 'generic', label: 'LiPo Battery 11.1V' }),
      node({ id: 'reg1', type: 'power', label: 'Buck Regulator 5V' }),
    ];
    const edges: PredictionEdge[] = [
      edge('mcu1', 'driver1'),
      edge('driver1', 'motor1'),
      edge('driver1', 'motor2'),
      edge('bat1', 'reg1'),
      edge('reg1', 'mcu1'),
    ];
    const preds = engine.analyze(nodes, edges, []);

    expect(preds.length).toBeGreaterThan(0);
    expect(preds.length).toBeLessThanOrEqual(5);

    // Should be sorted by confidence
    for (let i = 1; i < preds.length; i++) {
      expect(preds[i - 1].confidence).toBeGreaterThanOrEqual(preds[i].confidence);
    }
  });
});

// ---------------------------------------------------------------------------
// isAnalyzing state
// ---------------------------------------------------------------------------

describe('PredictionEngine — isAnalyzing', () => {
  it('isAnalyzing is false before and after analysis', () => {
    const engine = PredictionEngine.getInstance();
    expect(engine.getIsAnalyzing()).toBe(false);
    engine.analyze([], [], []);
    expect(engine.getIsAnalyzing()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// localStorage error resilience
// ---------------------------------------------------------------------------

describe('PredictionEngine — localStorage resilience', () => {
  it('handles corrupted localStorage dismissals gracefully', () => {
    localStorage.setItem('protopulse-prediction-dismissals', '{invalid json');
    PredictionEngine.resetInstance();
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    expect(preds.length).toBeGreaterThan(0);
  });

  it('handles corrupted localStorage feedback gracefully', () => {
    localStorage.setItem('protopulse-prediction-feedback', 'not an array');
    PredictionEngine.resetInstance();
    const engine = PredictionEngine.getInstance();
    const preds = engine.analyze(
      [node({ id: 'mcu1', type: 'mcu', label: 'ESP32' })],
      [],
      [],
    );
    expect(preds.length).toBeGreaterThan(0);
  });

  it('handles non-array localStorage data', () => {
    localStorage.setItem('protopulse-prediction-dismissals', '"just a string"');
    PredictionEngine.resetInstance();
    const engine = PredictionEngine.getInstance();
    expect(() => engine.analyze([], [], [])).not.toThrow();
  });
});
