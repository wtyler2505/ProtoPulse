import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DesignGateway,
  useDesignGateway,
} from '../design-gateway';
import type {
  DesignState,
  DesignNode,
  DesignEdge,
  DesignBomItem,
  GatewayViolation,
} from '../design-gateway';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function node(overrides: Partial<DesignNode> & { id: string }): DesignNode {
  return { label: overrides.id, type: 'generic', ...overrides };
}

function edge(source: string, target: string, overrides?: Partial<DesignEdge>): DesignEdge {
  return { id: `${source}-${target}`, source, target, ...overrides };
}

function bom(overrides: Partial<DesignBomItem> & { id: string }): DesignBomItem {
  return { partNumber: 'PART-001', description: 'Generic part', quantity: 1, ...overrides };
}

function state(
  nodes: DesignNode[] = [],
  edges: DesignEdge[] = [],
  bomItems: DesignBomItem[] = [],
): DesignState {
  return { nodes, edges, bomItems };
}

// ---------------------------------------------------------------------------
// Singleton lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  DesignGateway.resetInstance();
});

// ---------------------------------------------------------------------------
// DesignGateway class
// ---------------------------------------------------------------------------

describe('DesignGateway', () => {
  describe('singleton', () => {
    it('returns the same instance across calls', () => {
      const a = DesignGateway.getInstance();
      const b = DesignGateway.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after reset', () => {
      const a = DesignGateway.getInstance();
      DesignGateway.resetInstance();
      const b = DesignGateway.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('getRules / getEnabledRules', () => {
    it('ships with at least 10 built-in rules', () => {
      const gw = DesignGateway.getInstance();
      expect(gw.getRules().length).toBeGreaterThanOrEqual(10);
    });

    it('all rules are enabled by default', () => {
      const gw = DesignGateway.getInstance();
      expect(gw.getEnabledRules().length).toBe(gw.getRules().length);
    });
  });

  describe('enableRule / disableRule', () => {
    it('disables a rule by id', () => {
      const gw = DesignGateway.getInstance();
      const before = gw.getEnabledRules().length;
      gw.disableRule('no-test-points');
      expect(gw.getEnabledRules().length).toBe(before - 1);
    });

    it('re-enables a disabled rule', () => {
      const gw = DesignGateway.getInstance();
      gw.disableRule('no-test-points');
      gw.enableRule('no-test-points');
      const rule = gw.getRules().find((r) => r.id === 'no-test-points');
      expect(rule?.enabled).toBe(true);
    });

    it('is a no-op for unknown rule id', () => {
      const gw = DesignGateway.getInstance();
      const before = gw.getEnabledRules().length;
      gw.disableRule('nonexistent-rule-xyz');
      expect(gw.getEnabledRules().length).toBe(before);
    });
  });

  describe('subscribe', () => {
    it('calls subscriber on enableRule', () => {
      const gw = DesignGateway.getInstance();
      const cb = vi.fn();
      gw.subscribe(cb);
      gw.enableRule('no-test-points');
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('calls subscriber on disableRule', () => {
      const gw = DesignGateway.getInstance();
      const cb = vi.fn();
      gw.subscribe(cb);
      gw.disableRule('no-test-points');
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const gw = DesignGateway.getInstance();
      const cb = vi.fn();
      const unsub = gw.subscribe(cb);
      unsub();
      gw.disableRule('no-test-points');
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('returns empty array for empty design', () => {
      const gw = DesignGateway.getInstance();
      expect(gw.validate(state())).toEqual([]);
    });

    it('skips disabled rules', () => {
      const gw = DesignGateway.getInstance();
      // Create a design that triggers no-test-points
      const nodes = Array.from({ length: 12 }, (_, i) =>
        node({ id: `n${i}`, label: `Component ${i}`, type: 'generic' }),
      );
      const withTP = gw.validate(state(nodes));
      const hasNoTP = withTP.some((v) => v.ruleId === 'no-test-points');
      expect(hasNoTP).toBe(true);

      gw.disableRule('no-test-points');
      const without = gw.validate(state(nodes));
      expect(without.some((v) => v.ruleId === 'no-test-points')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Individual rules
// ---------------------------------------------------------------------------

describe('Rule: missing-decoupling-cap', () => {
  it('flags an IC with no capacitor connected', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'u1', label: 'ATmega328', type: 'mcu' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-decoupling-cap');
    expect(v).toHaveLength(1);
    expect(v[0].affectedNodes).toContain('u1');
  });

  it('does not flag IC with nearby capacitor', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'u1', label: 'ATmega328', type: 'mcu' }),
        node({ id: 'c1', label: '100nF Capacitor', type: 'capacitor' }),
      ],
      [edge('u1', 'c1')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-decoupling-cap');
    expect(v).toHaveLength(0);
  });

  it('flags only ICs, not passives', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'r1', label: '10k Resistor', type: 'resistor' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-decoupling-cap');
    expect(v).toHaveLength(0);
  });

  it('recognises ESP32 as an IC', () => {
    const gw = DesignGateway.getInstance();
    const s = state([node({ id: 'u1', label: 'ESP32-S3', type: 'module' })]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-decoupling-cap');
    expect(v).toHaveLength(1);
  });
});

describe('Rule: floating-input', () => {
  it('flags input pin with no connection', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'p1', label: 'RESET', type: 'pin', properties: { pinType: 'input' } }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'floating-input');
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('error');
  });

  it('does not flag connected input pin', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'p1', label: 'RESET', type: 'pin', properties: { pinType: 'input' } }),
        node({ id: 'r1', label: 'Pull-up', type: 'resistor' }),
      ],
      [edge('p1', 'r1')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'floating-input');
    expect(v).toHaveLength(0);
  });

  it('does not flag output pins', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'p1', label: 'TX', type: 'pin', properties: { pinType: 'output' } }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'floating-input');
    expect(v).toHaveLength(0);
  });

  it('supports direction property as alternative', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'p1', label: 'SDA', type: 'pin', properties: { direction: 'input' } }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'floating-input');
    expect(v).toHaveLength(1);
  });
});

describe('Rule: unconnected-power', () => {
  it('flags unconnected power pin', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'vcc', label: 'VCC', type: 'pin', properties: { pinType: 'power' } }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'unconnected-power');
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('error');
  });

  it('does not flag connected power pin', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'vcc', label: 'VCC', type: 'pin', properties: { pinType: 'power' } }),
        node({ id: 'reg', label: 'LM7805', type: 'regulator' }),
      ],
      [edge('reg', 'vcc')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'unconnected-power');
    expect(v).toHaveLength(0);
  });
});

describe('Rule: missing-pull-resistor', () => {
  it('flags I2C component without pull resistor', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 's1', label: 'BME280 I2C Sensor', type: 'sensor' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-pull-resistor');
    expect(v).toHaveLength(1);
  });

  it('does not flag I2C component with resistor connected', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 's1', label: 'BME280 I2C Sensor', type: 'sensor' }),
        node({ id: 'r1', label: '4.7k Pull-up Resistor', type: 'resistor' }),
      ],
      [edge('s1', 'r1')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-pull-resistor');
    expect(v).toHaveLength(0);
  });

  it('recognises SPI bus via properties', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 's1', label: 'SD Card Module', type: 'module', properties: { protocol: 'SPI' } }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-pull-resistor');
    expect(v).toHaveLength(1);
  });

  it('does not flag non-bus component', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'led', label: 'Red LED', type: 'led' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-pull-resistor');
    expect(v).toHaveLength(0);
  });
});

describe('Rule: high-current-no-heatsink', () => {
  it('flags high-power component without heatsink', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'vreg', label: 'LM7805 Regulator', type: 'regulator', properties: { power: '2.5W' } }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'high-current-no-heatsink');
    expect(v).toHaveLength(1);
    expect(v[0].message).toContain('2.5');
  });

  it('does not flag low-power component', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'vreg', label: 'LDO Regulator', type: 'regulator', properties: { power: '0.5W' } }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'high-current-no-heatsink');
    expect(v).toHaveLength(0);
  });

  it('does not flag component with heatsink connected', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'vreg', label: 'LM7805 Regulator', type: 'regulator', properties: { power: '3W' } }),
        node({ id: 'hs', label: 'Heatsink TO-220', type: 'heatsink' }),
      ],
      [edge('vreg', 'hs')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'high-current-no-heatsink');
    expect(v).toHaveLength(0);
  });

  it('does not flag component with heatsink property', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'vreg', label: 'LM7805 Regulator', type: 'regulator', properties: { power: '3W', heatsink: 'heatsink attached' } }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'high-current-no-heatsink');
    expect(v).toHaveLength(0);
  });

  it('does not flag power component without power property', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'vreg', label: 'LM7805 Regulator', type: 'regulator' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'high-current-no-heatsink');
    expect(v).toHaveLength(0);
  });
});

describe('Rule: crystal-missing-load-caps', () => {
  it('flags crystal with fewer than 2 capacitors', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'x1', label: '16MHz Crystal', type: 'crystal' }),
        node({ id: 'c1', label: '22pF Cap', type: 'capacitor' }),
      ],
      [edge('x1', 'c1')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'crystal-missing-load-caps');
    expect(v).toHaveLength(1);
    expect(v[0].message).toContain('1 load capacitor');
  });

  it('does not flag crystal with 2 capacitors', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'x1', label: '16MHz Crystal', type: 'crystal' }),
        node({ id: 'c1', label: '22pF Cap', type: 'capacitor' }),
        node({ id: 'c2', label: '22pF Cap', type: 'capacitor' }),
      ],
      [edge('x1', 'c1'), edge('x1', 'c2')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'crystal-missing-load-caps');
    expect(v).toHaveLength(0);
  });

  it('flags crystal with no capacitors at all', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'x1', label: '8MHz Oscillator', type: 'oscillator' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'crystal-missing-load-caps');
    expect(v).toHaveLength(1);
    expect(v[0].message).toContain('0 load capacitor');
  });
});

describe('Rule: voltage-mismatch', () => {
  it('flags direct connection between mismatched voltages', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'n1', label: 'MCU 3.3V', type: 'mcu', properties: { voltage: '3.3V' } }),
        node({ id: 'n2', label: 'Sensor 5V', type: 'sensor', properties: { voltage: '5V' } }),
      ],
      [edge('n1', 'n2')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'voltage-mismatch');
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('error');
    expect(v[0].affectedNodes).toContain('n1');
    expect(v[0].affectedNodes).toContain('n2');
  });

  it('does not flag same-voltage connection', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'n1', label: 'MCU', type: 'mcu', properties: { voltage: '3.3V' } }),
        node({ id: 'n2', label: 'Sensor', type: 'sensor', properties: { voltage: '3.3V' } }),
      ],
      [edge('n1', 'n2')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'voltage-mismatch');
    expect(v).toHaveLength(0);
  });

  it('does not flag when nodes lack voltage info', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'n1', label: 'MCU', type: 'mcu' }),
        node({ id: 'n2', label: 'Sensor', type: 'sensor' }),
      ],
      [edge('n1', 'n2')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'voltage-mismatch');
    expect(v).toHaveLength(0);
  });

  it('skips connections through level shifters', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'n1', label: 'MCU 3.3V Level Shifter', type: 'level-shifter', properties: { voltage: '3.3V' } }),
        node({ id: 'n2', label: 'Sensor 5V', type: 'sensor', properties: { voltage: '5V' } }),
      ],
      [edge('n1', 'n2')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'voltage-mismatch');
    expect(v).toHaveLength(0);
  });
});

describe('Rule: redundant-component', () => {
  it('flags duplicate non-passive components', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'u1', label: 'Arduino Mega', type: 'mcu' }),
      node({ id: 'u2', label: 'Arduino Mega', type: 'mcu' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'redundant-component');
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('info');
    expect(v[0].affectedNodes).toContain('u1');
    expect(v[0].affectedNodes).toContain('u2');
  });

  it('does not flag duplicate capacitors (passives are expected)', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'c1', label: '100nF Capacitor', type: 'capacitor' }),
      node({ id: 'c2', label: '100nF Capacitor', type: 'capacitor' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'redundant-component');
    expect(v).toHaveLength(0);
  });

  it('does not flag duplicate resistors', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'r1', label: '10k Resistor', type: 'resistor' }),
      node({ id: 'r2', label: '10k Resistor', type: 'resistor' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'redundant-component');
    expect(v).toHaveLength(0);
  });

  it('does not flag unique components', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'u1', label: 'Arduino Mega', type: 'mcu' }),
      node({ id: 'u2', label: 'ESP32', type: 'mcu' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'redundant-component');
    expect(v).toHaveLength(0);
  });
});

describe('Rule: missing-protection', () => {
  it('flags design with power source but no protection', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'bat', label: '12V Battery', type: 'battery' }),
      node({ id: 'u1', label: 'MCU', type: 'mcu' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-protection');
    expect(v).toHaveLength(1);
    expect(v[0].affectedNodes).toContain('bat');
  });

  it('does not flag design with protection diode', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'bat', label: '12V Battery', type: 'battery' }),
        node({ id: 'd1', label: 'Schottky Diode', type: 'diode' }),
      ],
      [edge('bat', 'd1')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-protection');
    expect(v).toHaveLength(0);
  });

  it('does not flag design without power source', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'u1', label: 'MCU', type: 'mcu' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-protection');
    expect(v).toHaveLength(0);
  });

  it('recognises USB as power source', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'usb', label: 'USB Connector', type: 'usb' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-protection');
    expect(v).toHaveLength(1);
  });
});

describe('Rule: no-test-points', () => {
  it('flags design with >10 nodes and no test points', () => {
    const gw = DesignGateway.getInstance();
    const nodes = Array.from({ length: 12 }, (_, i) =>
      node({ id: `n${i}`, label: `Part ${i}`, type: 'generic' }),
    );
    const v = gw.validate(state(nodes)).filter((x) => x.ruleId === 'no-test-points');
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('info');
  });

  it('does not flag small design (<=10 nodes)', () => {
    const gw = DesignGateway.getInstance();
    const nodes = Array.from({ length: 8 }, (_, i) =>
      node({ id: `n${i}`, label: `Part ${i}`, type: 'generic' }),
    );
    const v = gw.validate(state(nodes)).filter((x) => x.ruleId === 'no-test-points');
    expect(v).toHaveLength(0);
  });

  it('does not flag design with test points', () => {
    const gw = DesignGateway.getInstance();
    const nodes: DesignNode[] = [
      ...Array.from({ length: 12 }, (_, i) =>
        node({ id: `n${i}`, label: `Part ${i}`, type: 'generic' }),
      ),
      node({ id: 'tp1', label: 'Test Point VCC', type: 'test-point' }),
    ];
    const v = gw.validate(state(nodes)).filter((x) => x.ruleId === 'no-test-points');
    expect(v).toHaveLength(0);
  });
});

describe('Rule: missing-ground-connection', () => {
  it('flags IC without ground', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'u1', label: 'ATmega328', type: 'mcu' }),
      node({ id: 'gnd', label: 'GND', type: 'ground' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-ground-connection');
    expect(v).toHaveLength(1);
    expect(v[0].affectedNodes).toContain('u1');
  });

  it('does not flag IC connected to ground', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [
        node({ id: 'u1', label: 'ATmega328', type: 'mcu' }),
        node({ id: 'gnd', label: 'GND', type: 'ground' }),
      ],
      [edge('u1', 'gnd')],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-ground-connection');
    expect(v).toHaveLength(0);
  });

  it('does not fire when design has no ground node', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'u1', label: 'ATmega328', type: 'mcu' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-ground-connection');
    expect(v).toHaveLength(0);
  });

  it('recognises VSS as ground', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'u1', label: 'ATmega328', type: 'mcu' }),
      node({ id: 'vss', label: 'VSS', type: 'pin' }),
    ]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'missing-ground-connection');
    expect(v).toHaveLength(1);
  });
});

describe('Rule: unused-bom-item', () => {
  it('flags BOM item not matching any node', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [node({ id: 'u1', label: 'ATmega328', type: 'mcu' })],
      [],
      [bom({ id: 'b1', partNumber: 'XYZ-999', description: 'Unique Widget' })],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'unused-bom-item');
    expect(v).toHaveLength(1);
    expect(v[0].message).toContain('Unique Widget');
  });

  it('does not flag BOM item matching a placed node', () => {
    const gw = DesignGateway.getInstance();
    const s = state(
      [node({ id: 'u1', label: 'ATmega328 MCU', type: 'mcu' })],
      [],
      [bom({ id: 'b1', partNumber: 'ATMEGA328', description: 'ATmega328 Microcontroller' })],
    );
    const v = gw.validate(s).filter((x) => x.ruleId === 'unused-bom-item');
    expect(v).toHaveLength(0);
  });

  it('returns nothing when BOM is empty', () => {
    const gw = DesignGateway.getInstance();
    const s = state([node({ id: 'u1', label: 'MCU', type: 'mcu' })]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'unused-bom-item');
    expect(v).toHaveLength(0);
  });

  it('returns nothing when design has no nodes', () => {
    const gw = DesignGateway.getInstance();
    const s = state([], [], [bom({ id: 'b1', partNumber: 'X', description: 'Y' })]);
    const v = gw.validate(s).filter((x) => x.ruleId === 'unused-bom-item');
    expect(v).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Violation shape contract
// ---------------------------------------------------------------------------

describe('GatewayViolation shape', () => {
  it('all violations have required fields', () => {
    const gw = DesignGateway.getInstance();
    const s = state([
      node({ id: 'u1', label: 'ATmega328', type: 'mcu' }),
      node({ id: 'bat', label: 'Battery', type: 'battery' }),
      node({ id: 'p1', label: 'VCC', type: 'pin', properties: { pinType: 'power' } }),
    ]);
    const violations = gw.validate(s);
    violations.forEach((v) => {
      expect(typeof v.ruleId).toBe('string');
      expect(['error', 'warning', 'info']).toContain(v.severity);
      expect(typeof v.message).toBe('string');
      expect(Array.isArray(v.affectedNodes)).toBe(true);
      expect(typeof v.suggestion).toBe('string');
      expect(v.suggestion.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// useDesignGateway hook
// ---------------------------------------------------------------------------

describe('useDesignGateway hook', () => {
  it('returns rules list', () => {
    const { result } = renderHook(() => useDesignGateway());
    expect(result.current.rules.length).toBeGreaterThanOrEqual(10);
  });

  it('validate returns violations and updates state', () => {
    const { result } = renderHook(() => useDesignGateway());
    const s = state([
      node({ id: 'u1', label: 'ATmega328', type: 'mcu' }),
    ]);

    let violations: GatewayViolation[] = [];
    act(() => {
      violations = result.current.validate(s);
    });

    expect(violations.length).toBeGreaterThan(0);
    expect(result.current.violations.length).toBeGreaterThan(0);
  });

  it('disableRule updates rules list', () => {
    const { result } = renderHook(() => useDesignGateway());
    const initialEnabled = result.current.rules.filter((r) => r.enabled).length;

    act(() => {
      result.current.disableRule('no-test-points');
    });

    const nowEnabled = result.current.rules.filter((r) => r.enabled).length;
    expect(nowEnabled).toBe(initialEnabled - 1);
  });

  it('enableRule restores a disabled rule', () => {
    const { result } = renderHook(() => useDesignGateway());

    act(() => {
      result.current.disableRule('no-test-points');
    });

    act(() => {
      result.current.enableRule('no-test-points');
    });

    const rule = result.current.rules.find((r) => r.id === 'no-test-points');
    expect(rule?.enabled).toBe(true);
  });

  it('violations start empty', () => {
    const { result } = renderHook(() => useDesignGateway());
    expect(result.current.violations).toEqual([]);
  });
});
