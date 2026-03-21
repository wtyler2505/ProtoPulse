import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { ProactiveHealingEngine } from '../proactive-healing';
import type {
  HealingNode,
  HealingEdge,
  DesignAction,
  DesignState,
  HealingProposal,
  HealingConfig,
  DangerRule,
  InterruptLevel,
} from '../proactive-healing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function node(overrides: Partial<HealingNode> & { id: string }): HealingNode {
  return { type: 'generic', label: overrides.id, ...overrides };
}

function edge(source: string, target: string, overrides?: Partial<HealingEdge>): HealingEdge {
  return { id: `${source}-${target}`, source, target, ...overrides };
}

function addEdgeAction(source: string, target: string, extra?: Record<string, unknown>): DesignAction {
  return { type: 'add_edge', data: { source, target, ...extra } };
}

function addNodeAction(nodeId: string, type: string, label: string, extra?: Record<string, unknown>): DesignAction {
  return { type: 'add_node', nodeId, data: { type, label, ...extra } };
}

function emptyState(): DesignState {
  return { nodes: [], edges: [] };
}

function findByRule(proposals: HealingProposal[], ruleId: string): HealingProposal | undefined {
  return proposals.find((p) => p.ruleId === ruleId);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  ProactiveHealingEngine.resetInstance();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('ProactiveHealingEngine — singleton', () => {
  it('returns the same instance across calls', () => {
    const a = ProactiveHealingEngine.getInstance();
    const b = ProactiveHealingEngine.getInstance();
    expect(a).toBe(b);
  });

  it('returns a new instance after reset', () => {
    const a = ProactiveHealingEngine.getInstance();
    ProactiveHealingEngine.resetInstance();
    const b = ProactiveHealingEngine.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

describe('ProactiveHealingEngine — subscribe', () => {
  it('notifies subscribers when proposals change', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const fn = vi.fn();
    engine.subscribe(fn);

    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino Mega' }),
        node({ id: 'led1', type: 'led', label: 'Status LED' }),
      ],
      edges: [],
    };

    engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    expect(fn).toHaveBeenCalled();
  });

  it('unsubscribes correctly', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const fn = vi.fn();
    const unsub = engine.subscribe(fn);
    unsub();

    engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'Arduino'),
      emptyState(),
    );
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rule: voltage-mismatch
// ---------------------------------------------------------------------------

describe('voltage-mismatch rule', () => {
  it('flags voltage mismatch between nodes', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'n1', type: 'mcu', label: 'ESP32 3.3V', properties: { voltage: 3.3 } }),
        node({ id: 'n2', type: 'sensor', label: '5V Sensor', properties: { voltage: 5 } }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('n1', 'n2'), state);
    const p = findByRule(proposals, 'voltage-mismatch');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('critical');
    expect(p!.title).toContain('3.3V');
    expect(p!.title).toContain('5V');
  });

  it('does not flag when voltages match', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'n1', type: 'mcu', label: 'ESP32', properties: { voltage: 3.3 } }),
        node({ id: 'n2', type: 'sensor', label: 'BME280', properties: { voltage: 3.3 } }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('n1', 'n2'), state);
    expect(findByRule(proposals, 'voltage-mismatch')).toBeUndefined();
  });

  it('parses voltage from label string', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'n1', type: 'mcu', label: '3.3V ESP32' }),
        node({ id: 'n2', type: 'sensor', label: '5V Sensor' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('n1', 'n2'), state);
    expect(findByRule(proposals, 'voltage-mismatch')).toBeDefined();
  });

  it('does nothing for non-edge actions', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('n1', 'mcu', 'ESP32'),
      emptyState(),
    );
    expect(findByRule(proposals, 'voltage-mismatch')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: missing-current-limit-resistor
// ---------------------------------------------------------------------------

describe('missing-current-limit-resistor rule', () => {
  it('flags LED connected directly to MCU without resistor', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino Uno' }),
        node({ id: 'led1', type: 'led', label: 'Red LED' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    const p = findByRule(proposals, 'missing-current-limit-resistor');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('critical');
    expect(p!.fix.type).toBe('add_component');
  });

  it('does not flag LED with resistor in path', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino Uno' }),
        node({ id: 'r1', type: 'resistor', label: '330Ω Resistor' }),
        node({ id: 'led1', type: 'led', label: 'Red LED' }),
      ],
      edges: [edge('r1', 'led1')],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    expect(findByRule(proposals, 'missing-current-limit-resistor')).toBeUndefined();
  });

  it('does not flag non-LED connections', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 's1', type: 'sensor', label: 'Temp Sensor' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 's1'), state);
    expect(findByRule(proposals, 'missing-current-limit-resistor')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: direct-motor-drive
// ---------------------------------------------------------------------------

describe('direct-motor-drive rule', () => {
  it('flags motor connected directly to MCU GPIO', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino Mega' }),
        node({ id: 'm1', type: 'motor', label: 'DC Motor' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'm1'), state);
    const p = findByRule(proposals, 'direct-motor-drive');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('critical');
  });

  it('does not flag motor with H-bridge driver', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino Mega' }),
        node({ id: 'hb1', type: 'h-bridge', label: 'L298N Driver' }),
        node({ id: 'm1', type: 'motor', label: 'DC Motor' }),
      ],
      edges: [edge('hb1', 'm1')],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'm1'), state);
    expect(findByRule(proposals, 'direct-motor-drive')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: reverse-polarity
// ---------------------------------------------------------------------------

describe('reverse-polarity rule', () => {
  it('flags regulator without reverse polarity protection', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('reg1', 'regulator', 'LM7805 Voltage Regulator'),
      emptyState(),
    );

    const p = findByRule(proposals, 'reverse-polarity');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('warning');
    expect(p!.category).toBe('protection');
  });

  it('does not flag non-regulator nodes', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('r1', 'resistor', '10kΩ Resistor'),
      emptyState(),
    );
    expect(findByRule(proposals, 'reverse-polarity')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: missing-decoupling
// ---------------------------------------------------------------------------

describe('missing-decoupling rule', () => {
  it('flags MCU added without decoupling caps in design', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('mcu1', 'microcontroller', 'STM32'),
      emptyState(),
    );

    const p = findByRule(proposals, 'missing-decoupling');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('warning');
    expect(p!.description).toContain('100nF');
  });

  it('does not flag MCU when caps already exist', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [node({ id: 'c1', type: 'capacitor', label: '100nF Cap' })],
      edges: [],
    };

    const proposals = engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'Arduino'),
      state,
    );
    expect(findByRule(proposals, 'missing-decoupling')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: gpio-overcurrent
// ---------------------------------------------------------------------------

describe('gpio-overcurrent rule', () => {
  it('flags relay connected directly to MCU', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'relay1', type: 'relay', label: '5V Relay' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'relay1'), state);
    const p = findByRule(proposals, 'gpio-overcurrent');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('critical');
    expect(p!.description).toContain('transistor');
  });
});

// ---------------------------------------------------------------------------
// Rule: missing-i2c-pullups
// ---------------------------------------------------------------------------

describe('missing-i2c-pullups rule', () => {
  it('flags I2C connection without pull-ups', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'sensor1', type: 'i2c-sensor', label: 'BME280 I2C' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'sensor1'), state);
    const p = findByRule(proposals, 'missing-i2c-pullups');
    expect(p).toBeDefined();
    expect(p!.fix.payload['value']).toBe('4.7kΩ');
  });

  it('does not flag I2C with pull-ups present', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'sensor1', type: 'i2c-sensor', label: 'BME280' }),
        node({ id: 'r1', type: 'resistor', label: '4.7k Pull-up' }),
      ],
      edges: [edge('sensor1', 'r1')],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'sensor1'), state);
    expect(findByRule(proposals, 'missing-i2c-pullups')).toBeUndefined();
  });

  it('detects I2C from signalType in action data', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'n1', type: 'generic', label: 'Device A' }),
        node({ id: 'n2', type: 'generic', label: 'Device B' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(
      addEdgeAction('n1', 'n2', { signalType: 'I2C' }),
      state,
    );
    const p = findByRule(proposals, 'missing-i2c-pullups');
    expect(p).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: adc-reference
// ---------------------------------------------------------------------------

describe('adc-reference rule', () => {
  it('suggests voltage reference for ADC', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('adc1', 'adc', 'ADS1115 ADC'),
      emptyState(),
    );

    const p = findByRule(proposals, 'adc-reference');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('suggestion');
  });

  it('does not suggest when vref exists', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [node({ id: 'vr1', type: 'voltage-reference', label: 'REF3030' })],
      edges: [],
    };

    const proposals = engine.checkAction(
      addNodeAction('adc1', 'adc', 'ADS1115'),
      state,
    );
    expect(findByRule(proposals, 'adc-reference')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: flyback-diode
// ---------------------------------------------------------------------------

describe('flyback-diode rule', () => {
  it('flags relay without flyback diode', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'drv1', type: 'transistor', label: 'NPN Driver' }),
        node({ id: 'relay1', type: 'relay', label: '12V Relay' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('drv1', 'relay1'), state);
    const p = findByRule(proposals, 'flyback-diode');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('critical');
  });

  it('does not flag when diode exists', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'drv1', type: 'transistor', label: 'NPN' }),
        node({ id: 'relay1', type: 'relay', label: 'Relay' }),
        node({ id: 'd1', type: 'diode', label: '1N4007 Flyback' }),
      ],
      edges: [edge('relay1', 'd1')],
    };

    const proposals = engine.checkAction(addEdgeAction('drv1', 'relay1'), state);
    expect(findByRule(proposals, 'flyback-diode')).toBeUndefined();
  });

  it('flags motor without flyback diode', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'drv1', type: 'generic', label: 'MOSFET' }),
        node({ id: 'motor1', type: 'dc-motor', label: 'Fan Motor' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('drv1', 'motor1'), state);
    expect(findByRule(proposals, 'flyback-diode')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: reset-resistor
// ---------------------------------------------------------------------------

describe('reset-resistor rule', () => {
  it('suggests reset pull-up for MCU', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'ATmega328P'),
      emptyState(),
    );

    const p = findByRule(proposals, 'reset-resistor');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('suggestion');
  });

  it('does not suggest when reset resistor exists', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [node({ id: 'r1', type: 'resistor', label: '10k Reset Pull-up' })],
      edges: [],
    };

    const proposals = engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'ATmega328P'),
      state,
    );
    expect(findByRule(proposals, 'reset-resistor')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: esd-protection
// ---------------------------------------------------------------------------

describe('esd-protection rule', () => {
  it('flags USB connector without ESD protection', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('usb1', 'usb-c', 'USB-C Connector'),
      emptyState(),
    );

    const p = findByRule(proposals, 'esd-protection');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('warning');
  });

  it('does not flag when ESD protection exists', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [node({ id: 'esd1', type: 'tvs', label: 'USBLC6-2 ESD' })],
      edges: [],
    };

    const proposals = engine.checkAction(
      addNodeAction('usb1', 'usb', 'USB-A Port'),
      state,
    );
    expect(findByRule(proposals, 'esd-protection')).toBeUndefined();
  });

  it('does not flag non-USB nodes', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('r1', 'resistor', '10kΩ'),
      emptyState(),
    );
    expect(findByRule(proposals, 'esd-protection')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: thin-power-trace
// ---------------------------------------------------------------------------

describe('thin-power-trace rule', () => {
  it('flags thin power traces', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      { type: 'add_edge', data: { source: 'a', target: 'b', signalType: 'power', width: 0.2 } },
      emptyState(),
    );

    const p = findByRule(proposals, 'thin-power-trace');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('warning');
    expect(p!.category).toBe('thermal');
  });

  it('does not flag adequate power trace width', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      { type: 'add_edge', data: { source: 'a', target: 'b', signalType: 'power', width: 1.0 } },
      emptyState(),
    );
    expect(findByRule(proposals, 'thin-power-trace')).toBeUndefined();
  });

  it('does not flag signal traces', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      { type: 'add_edge', data: { source: 'a', target: 'b', signalType: 'data', width: 0.1 } },
      emptyState(),
    );
    expect(findByRule(proposals, 'thin-power-trace')).toBeUndefined();
  });

  it('detects power from label', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      { type: 'add_edge', data: { source: 'a', target: 'b', label: 'VCC Rail', width: 0.3 } },
      emptyState(),
    );
    expect(findByRule(proposals, 'thin-power-trace')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: missing-level-shifter
// ---------------------------------------------------------------------------

describe('missing-level-shifter rule', () => {
  it('flags connection between different voltage MCUs', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: '3.3V ESP32', properties: { voltage: 3.3 } }),
        node({ id: 'mcu2', type: 'mcu', label: '5V Arduino', properties: { voltage: 5 } }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'mcu2'), state);
    const p = findByRule(proposals, 'missing-level-shifter');
    expect(p).toBeDefined();
    expect(p!.description).toContain('level shifter');
  });

  it('does not flag when level shifter exists', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'ESP32', properties: { voltage: 3.3 } }),
        node({ id: 'mcu2', type: 'mcu', label: 'Arduino', properties: { voltage: 5 } }),
        node({ id: 'ls1', type: 'level-shifter', label: 'TXB0108' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'mcu2'), state);
    expect(findByRule(proposals, 'missing-level-shifter')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule: ungrounded-shield
// ---------------------------------------------------------------------------

describe('ungrounded-shield rule', () => {
  it('flags ungrounded EMI shield', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('sh1', 'emi-shield', 'RF Shield'),
      emptyState(),
    );

    const p = findByRule(proposals, 'ungrounded-shield');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('suggestion');
    expect(p!.description).toContain('ground');
  });

  it('does not flag non-shield nodes', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('r1', 'resistor', '10kΩ'),
      emptyState(),
    );
    expect(findByRule(proposals, 'ungrounded-shield')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

describe('config management', () => {
  it('starts with default config', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const cfg = engine.getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.minInterruptLevel).toBe('info');
    expect(cfg.autoApplySeverity).toBeNull();
  });

  it('updates and persists config', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.updateConfig({ minInterruptLevel: 'warn' });

    const cfg = engine.getConfig();
    expect(cfg.minInterruptLevel).toBe('warn');

    // Persisted — verify by creating new instance
    ProactiveHealingEngine.resetInstance();
    const engine2 = ProactiveHealingEngine.getInstance();
    expect(engine2.getConfig().minInterruptLevel).toBe('warn');
  });

  it('disables engine via config', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.updateConfig({ enabled: false });

    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'led1', type: 'led', label: 'LED' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    expect(proposals).toHaveLength(0);
  });

  it('respects minimum interrupt level', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.updateConfig({ minInterruptLevel: 'block' });

    // ADC reference is 'info' level — should be filtered
    const proposals = engine.checkAction(
      addNodeAction('adc1', 'adc', 'ADS1115'),
      emptyState(),
    );
    expect(findByRule(proposals, 'adc-reference')).toBeUndefined();
  });

  it('auto-applies fixes at configured severity', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.updateConfig({ autoApplySeverity: 'suggestion' });

    const proposals = engine.checkAction(
      addNodeAction('adc1', 'adc', 'ADS1115'),
      emptyState(),
    );
    const p = findByRule(proposals, 'adc-reference');
    expect(p).toBeDefined();
    expect(p!.status).toBe('auto_applied');
  });
});

// ---------------------------------------------------------------------------
// Rule management
// ---------------------------------------------------------------------------

describe('rule management', () => {
  it('has 14 built-in rules', () => {
    const engine = ProactiveHealingEngine.getInstance();
    expect(engine.getRuleCount()).toBe(14);
  });

  it('can disable individual rules', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.disableRule('voltage-mismatch');
    expect(engine.isRuleEnabled('voltage-mismatch')).toBe(false);
    expect(engine.getEnabledRuleCount()).toBe(13);
  });

  it('can re-enable rules', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.disableRule('voltage-mismatch');
    engine.enableRule('voltage-mismatch');
    expect(engine.isRuleEnabled('voltage-mismatch')).toBe(true);
  });

  it('disabled rules do not fire', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.disableRule('missing-current-limit-resistor');

    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'led1', type: 'led', label: 'LED' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    expect(findByRule(proposals, 'missing-current-limit-resistor')).toBeUndefined();
  });

  it('can add custom rules', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const customRule: DangerRule = {
      id: 'custom-rule',
      name: 'Custom test rule',
      severity: 'warning',
      category: 'best_practice',
      interruptLevel: 'info',
      check(_action, _state) {
        return [{
          id: 'custom-1',
          ruleId: 'custom-rule',
          title: 'Custom warning',
          description: 'Test',
          severity: 'warning',
          category: 'best_practice',
          triggerAction: _action,
          fix: { type: 'add_component', description: 'Add something', payload: {} },
          status: 'pending',
          createdAt: Date.now(),
        }];
      },
    };

    engine.addRule(customRule);
    expect(engine.getRuleCount()).toBe(15);
  });

  it('can remove rules', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const removed = engine.removeRule('reset-resistor');
    expect(removed).toBe(true);
    expect(engine.getRuleCount()).toBe(13);
  });

  it('removeRule returns false for unknown rule', () => {
    const engine = ProactiveHealingEngine.getInstance();
    expect(engine.removeRule('nonexistent')).toBe(false);
  });

  it('addRule deduplicates by id', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const count = engine.getRuleCount();
    engine.addRule({
      id: 'voltage-mismatch',
      name: 'Duplicate',
      severity: 'critical',
      category: 'voltage',
      interruptLevel: 'block',
      check() { return []; },
    });
    expect(engine.getRuleCount()).toBe(count);
  });
});

// ---------------------------------------------------------------------------
// Proposal management
// ---------------------------------------------------------------------------

describe('proposal management', () => {
  it('approves proposals', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'led1', type: 'led', label: 'LED' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    expect(proposals.length).toBeGreaterThan(0);

    const result = engine.approve(proposals[0].id);
    expect(result).toBe(true);

    const all = engine.getProposals();
    const approved = all.find((p) => p.id === proposals[0].id);
    expect(approved?.status).toBe('approved');
  });

  it('dismisses proposals', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'relay1', type: 'relay', label: 'Relay' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'relay1'), state);
    expect(proposals.length).toBeGreaterThan(0);

    const result = engine.dismiss(proposals[0].id);
    expect(result).toBe(true);

    const p = engine.getProposals().find((x) => x.id === proposals[0].id);
    expect(p?.status).toBe('dismissed');
  });

  it('approve returns false for non-pending proposal', () => {
    const engine = ProactiveHealingEngine.getInstance();
    expect(engine.approve('nonexistent')).toBe(false);
  });

  it('dismiss returns false for non-pending proposal', () => {
    const engine = ProactiveHealingEngine.getInstance();
    expect(engine.dismiss('nonexistent')).toBe(false);
  });

  it('dismissAll dismisses all pending proposals', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'led1', type: 'led', label: 'LED' }),
      ],
      edges: [],
    };

    engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    const count = engine.dismissAll();
    expect(count).toBeGreaterThan(0);
    expect(engine.getPendingProposals()).toHaveLength(0);
  });

  it('clearProposals removes all proposals', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'Arduino'),
      emptyState(),
    );

    engine.clearProposals();
    expect(engine.getProposals()).toHaveLength(0);
  });

  it('filters proposals by category', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'led1', type: 'led', label: 'LED' }),
      ],
      edges: [],
    };

    engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    const currentProposals = engine.getProposalsByCategory('current');
    currentProposals.forEach((p) => {
      expect(p.category).toBe('current');
    });
  });

  it('filters proposals by severity', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'ATmega328P'),
      emptyState(),
    );

    const suggestions = engine.getProposalsBySeverity('suggestion');
    suggestions.forEach((p) => {
      expect(p.severity).toBe('suggestion');
    });
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe('history', () => {
  it('tracks proposals in history', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'Arduino'),
      emptyState(),
    );

    const history = engine.getHistory();
    expect(history.length).toBeGreaterThan(0);
  });

  it('persists history to localStorage', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'Arduino'),
      emptyState(),
    );

    ProactiveHealingEngine.resetInstance();
    const engine2 = ProactiveHealingEngine.getInstance();
    expect(engine2.getHistory().length).toBeGreaterThan(0);
  });

  it('clears history', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'Arduino'),
      emptyState(),
    );

    engine.clearHistory();
    expect(engine.getHistory()).toHaveLength(0);
  });

  it('updates history status on approve', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'led1', type: 'led', label: 'LED' }),
      ],
      edges: [],
    };

    const proposals = engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    const proposalId = proposals[0].id;
    engine.approve(proposalId);

    const historyEntry = engine.getHistory().find((h) => h.id === proposalId);
    expect(historyEntry?.status).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

describe('statistics', () => {
  it('returns correct stats', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'led1', type: 'led', label: 'LED' }),
        node({ id: 'relay1', type: 'relay', label: 'Relay' }),
      ],
      edges: [],
    };

    engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    engine.checkAction(addEdgeAction('mcu1', 'relay1'), state);

    const stats = engine.getStats();
    expect(stats.totalProposals).toBeGreaterThan(0);
    expect(stats.pending + stats.approved + stats.dismissed + stats.autoApplied).toBe(stats.totalProposals);
  });

  it('tracks severity breakdown', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'Arduino'),
      emptyState(),
    );

    const stats = engine.getStats();
    const severityTotal = stats.bySeverity.critical + stats.bySeverity.warning + stats.bySeverity.suggestion;
    expect(severityTotal).toBe(stats.totalProposals);
  });

  it('tracks category breakdown', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.checkAction(
      addNodeAction('mcu1', 'mcu', 'Arduino'),
      emptyState(),
    );

    const stats = engine.getStats();
    const categoryTotal = Object.values(stats.byCategory).reduce((sum, v) => sum + v, 0);
    expect(categoryTotal).toBe(stats.totalProposals);
  });
});

// ---------------------------------------------------------------------------
// Bulk analysis
// ---------------------------------------------------------------------------

describe('analyzeDesign', () => {
  it('checks all nodes and edges', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino Mega' }),
        node({ id: 'led1', type: 'led', label: 'Status LED' }),
        node({ id: 'motor1', type: 'dc-motor', label: 'Drive Motor' }),
      ],
      edges: [
        edge('mcu1', 'led1'),
        edge('mcu1', 'motor1'),
      ],
    };

    const proposals = engine.analyzeDesign(state);
    expect(proposals.length).toBeGreaterThan(0);
    // Should find at least MCU-related suggestions from node analysis
    // and LED/motor issues from edge analysis
  });

  it('returns empty when disabled', () => {
    const engine = ProactiveHealingEngine.getInstance();
    engine.updateConfig({ enabled: false });

    const state: DesignState = {
      nodes: [node({ id: 'mcu1', type: 'mcu', label: 'Arduino' })],
      edges: [],
    };

    expect(engine.analyzeDesign(state)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('deduplication', () => {
  it('does not duplicate proposals for the same rule', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const state: DesignState = {
      nodes: [
        node({ id: 'mcu1', type: 'mcu', label: 'Arduino' }),
        node({ id: 'led1', type: 'led', label: 'LED' }),
      ],
      edges: [],
    };

    engine.checkAction(addEdgeAction('mcu1', 'led1'), state);
    engine.checkAction(addEdgeAction('mcu1', 'led1'), state);

    const proposals = engine.getProposals();
    const currentLimitProposals = proposals.filter((p) => p.ruleId === 'missing-current-limit-resistor');
    // Should only have 1 due to deduplication
    expect(currentLimitProposals.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty design state', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addNodeAction('r1', 'resistor', '10kΩ'),
      emptyState(),
    );
    expect(proposals).toEqual([]);
  });

  it('handles missing node references in edge actions', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      addEdgeAction('nonexistent1', 'nonexistent2'),
      emptyState(),
    );
    expect(proposals).toEqual([]);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('protopulse-healing-config', '{invalid json');
    localStorage.setItem('protopulse-healing-history', '{also invalid');

    const engine = ProactiveHealingEngine.getInstance();
    expect(engine.getConfig().enabled).toBe(true);
    expect(engine.getHistory()).toHaveLength(0);
  });

  it('handles modify_edge action for thin-power-trace', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      { type: 'modify_edge', edgeId: 'e1', data: { signalType: 'VCC', width: 0.1 } },
      emptyState(),
    );
    expect(findByRule(proposals, 'thin-power-trace')).toBeDefined();
  });

  it('set_property action does not crash', () => {
    const engine = ProactiveHealingEngine.getInstance();
    const proposals = engine.checkAction(
      { type: 'set_property', data: { key: 'value' } },
      emptyState(),
    );
    expect(proposals).toEqual([]);
  });
});
