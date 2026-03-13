/**
 * Tests for the SPICE netlist generator.
 *
 * Source: client/src/lib/simulation/spice-generator.ts
 * Environment: happy-dom (Vitest client project)
 */

import { describe, it, expect } from 'vitest';
import {
  parseSpiceValue,
  formatSpiceValue,
  generateSpiceNetlist,
  generateDCOpNetlist,
  type CircuitComponent,
  type CircuitNetInfo,
  type SpiceGeneratorInput,
} from '../spice-generator';

// ---------------------------------------------------------------------------
// Helpers — minimal valid objects
// ---------------------------------------------------------------------------

function makeNet(id: number, name: string, netType = 'signal'): CircuitNetInfo {
  return { id, name, netType };
}

function makeGndNet(id: number, name = 'GND'): CircuitNetInfo {
  return { id, name, netType: 'ground' };
}

function makeResistor(
  instanceId: number,
  ref: string,
  value: string,
  net1Id: number | null,
  net2Id: number | null,
): CircuitComponent {
  return {
    instanceId,
    referenceDesignator: ref,
    family: 'Resistor',
    properties: { value },
    connectors: [
      { id: 'pin1', name: 'pin1', netId: net1Id },
      { id: 'pin2', name: 'pin2', netId: net2Id },
    ],
  };
}

function makeVoltageSource(
  instanceId: number,
  ref: string,
  voltage: string,
  posNetId: number | null,
  negNetId: number | null,
): CircuitComponent {
  return {
    instanceId,
    referenceDesignator: ref,
    family: 'Voltage Source',
    properties: { value: voltage },
    connectors: [
      { id: 'pin1', name: 'pin1', netId: posNetId },
      { id: 'pin2', name: 'pin2', netId: negNetId },
    ],
  };
}

// ---------------------------------------------------------------------------
// parseSpiceValue
// ---------------------------------------------------------------------------

describe('parseSpiceValue', () => {
  it('parses "10k" as 10000', () => {
    expect(parseSpiceValue('10k')).toBe(10000);
  });

  it('parses "4.7u" as 4.7e-6', () => {
    expect(parseSpiceValue('4.7u')).toBeCloseTo(4.7e-6, 20);
  });

  it('parses "100n" as 1e-7', () => {
    expect(parseSpiceValue('100n')).toBeCloseTo(1e-7, 20);
  });

  it('parses "1Meg" as 1e6', () => {
    expect(parseSpiceValue('1Meg')).toBe(1e6);
  });

  it('parses "2.2p" as 2.2e-12', () => {
    expect(parseSpiceValue('2.2p')).toBeCloseTo(2.2e-12, 20);
  });

  it('parses "100m" as 0.1 (milli, not mega)', () => {
    expect(parseSpiceValue('100m')).toBeCloseTo(0.1, 10);
  });

  it('parses plain integer "47" as 47', () => {
    expect(parseSpiceValue('47')).toBe(47);
  });

  it('parses plain float "1.5" as 1.5', () => {
    expect(parseSpiceValue('1.5')).toBe(1.5);
  });

  it('parses "10kOhm" as 10000 (strips unit suffix)', () => {
    expect(parseSpiceValue('10kOhm')).toBe(10000);
  });

  it('parses "4.7uF" as 4.7e-6 (strips unit suffix)', () => {
    expect(parseSpiceValue('4.7uF')).toBeCloseTo(4.7e-6, 20);
  });

  it('parses "2.2uH" as 2.2e-6 (strips unit suffix)', () => {
    expect(parseSpiceValue('2.2uH')).toBeCloseTo(2.2e-6, 20);
  });

  it('returns 0 for empty string', () => {
    expect(parseSpiceValue('')).toBe(0);
  });

  it('returns 0 for "0"', () => {
    expect(parseSpiceValue('0')).toBe(0);
  });

  it('returns 0 or NaN for purely alphabetic input "abc"', () => {
    const result = parseSpiceValue('abc');
    // The function returns parseFloat("ABC") || 0 → 0 (NaN is falsy)
    expect(result === 0 || isNaN(result)).toBe(true);
  });

  it('handles whitespace around the value', () => {
    expect(parseSpiceValue('  10k  ')).toBe(10000);
  });

  it('parses "1G" as 1e9 (giga)', () => {
    expect(parseSpiceValue('1G')).toBe(1e9);
  });

  it('parses "1T" as 1e12 (tera)', () => {
    expect(parseSpiceValue('1T')).toBe(1e12);
  });
});

// ---------------------------------------------------------------------------
// formatSpiceValue
// ---------------------------------------------------------------------------

describe('formatSpiceValue', () => {
  it('formats 0 as "0"', () => {
    expect(formatSpiceValue(0)).toBe('0');
  });

  it('formats 47 without suffix', () => {
    // toPrecision(4) on 47 → "47.00"
    expect(formatSpiceValue(47)).toBe('47.00');
  });

  it('formats 10000 with K suffix', () => {
    // 10000 / 1e3 = 10.00, toPrecision(4) → "10.00K"
    expect(formatSpiceValue(10000)).toBe('10.00K');
  });

  it('formats 0.001 with M (milli) suffix', () => {
    // 0.001 / 1e-3 = 1.000, toPrecision(4) → "1.000M"
    expect(formatSpiceValue(0.001)).toBe('1.000M');
  });

  it('formats 1e-6 with U suffix', () => {
    // 1e-6 / 1e-6 = 1.000, toPrecision(4) → "1.000U"
    expect(formatSpiceValue(1e-6)).toBe('1.000U');
  });

  it('formats 1e-9 with N suffix', () => {
    expect(formatSpiceValue(1e-9)).toBe('1.000N');
  });

  it('formats 1e-12 with P suffix', () => {
    expect(formatSpiceValue(1e-12)).toBe('1.000P');
  });

  it('formats 1e6 with MEG suffix', () => {
    // 1e6 / 1e6 = 1.000, toPrecision(4) → "1.000MEG"
    expect(formatSpiceValue(1e6)).toBe('1.000MEG');
  });

  it('formats negative values with leading minus', () => {
    expect(formatSpiceValue(-10000)).toBe('-10.00K');
  });

  it('formats 4.7e-6 with U suffix', () => {
    // 4.7e-6 / 1e-6 = 4.700, toPrecision(4) → "4.700U"
    expect(formatSpiceValue(4.7e-6)).toBe('4.700U');
  });

  it('formats values >= 1e12 with T suffix', () => {
    // 1e12 / 1e12 = 1.000, toPrecision(4) → "1.000T"
    expect(formatSpiceValue(1e12)).toBe('1.000T');
  });

  it('formats values >= 1e9 with G suffix', () => {
    expect(formatSpiceValue(1e9)).toBe('1.000G');
  });
});

// ---------------------------------------------------------------------------
// Round-trip property: parseSpiceValue(formatSpiceValue(x)) ≈ x
// ---------------------------------------------------------------------------

describe('parseSpiceValue / formatSpiceValue round-trip', () => {
  it('round-trips 10000 (10K)', () => {
    const formatted = formatSpiceValue(10000);
    expect(parseSpiceValue(formatted)).toBeCloseTo(10000, 5);
  });

  it('round-trips 4.7e-6', () => {
    const formatted = formatSpiceValue(4.7e-6);
    expect(parseSpiceValue(formatted)).toBeCloseTo(4.7e-6, 18);
  });

  it('round-trips 1e6', () => {
    const formatted = formatSpiceValue(1e6);
    expect(parseSpiceValue(formatted)).toBeCloseTo(1e6, 5);
  });

  it('round-trips 100n (1e-7)', () => {
    const formatted = formatSpiceValue(1e-7);
    expect(parseSpiceValue(formatted)).toBeCloseTo(1e-7, 18);
  });

  it('round-trips 0', () => {
    const formatted = formatSpiceValue(0);
    expect(parseSpiceValue(formatted)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateSpiceNetlist — structural tests
// ---------------------------------------------------------------------------

describe('generateSpiceNetlist', () => {
  // --- Shared fixture: simple V + R circuit with ground ---
  function makeSimpleVRCircuit(): SpiceGeneratorInput {
    const nets: CircuitNetInfo[] = [
      makeGndNet(1, 'GND'),
      makeNet(2, 'VCC'),
      makeNet(3, 'OUT'),
    ];
    const components: CircuitComponent[] = [
      makeVoltageSource(1, 'V1', '5', 2, 1),   // VCC → GND
      makeResistor(2, 'R1', '1k', 2, 3),        // VCC → OUT
    ];
    return {
      title: 'Simple VR Circuit',
      components,
      nets,
      config: { analysis: 'op' },
    };
  }

  it('contains the title on the first line', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    const firstLine = netlist.split('\n')[0];
    expect(firstLine).toMatch(/Simple VR Circuit/);
  });

  it('first line starts with "* " (SPICE comment = title)', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    const firstLine = netlist.split('\n')[0];
    expect(firstLine.startsWith('* ')).toBe(true);
  });

  it('last non-empty line is ".END"', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    const lines = netlist.split('\n').filter(l => l.trim() !== '');
    expect(lines[lines.length - 1]).toBe('.END');
  });

  it('contains a V1 instance line', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(netlist).toMatch(/^V1\s/m);
  });

  it('contains an R1 instance line', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(netlist).toMatch(/^R1\s/m);
  });

  it('ground net maps to SPICE node 0', () => {
    const { nodeMap } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(nodeMap['GND']).toBe(0);
  });

  it('non-ground nets get node numbers >= 1', () => {
    const { nodeMap } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(nodeMap['VCC']).toBeGreaterThanOrEqual(1);
    expect(nodeMap['OUT']).toBeGreaterThanOrEqual(1);
  });

  it('non-ground node numbers are unique', () => {
    const { nodeMap } = generateSpiceNetlist(makeSimpleVRCircuit());
    const nonZero = Object.values(nodeMap).filter(n => n !== 0);
    const unique = new Set(nonZero);
    expect(unique.size).toBe(nonZero.length);
  });

  it('contains a .CONTROL block', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(netlist).toContain('.CONTROL');
    expect(netlist).toContain('.ENDC');
  });

  it('contains "run" inside the .CONTROL block', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(netlist).toContain('run');
  });

  // --- .OP analysis ---

  it('includes .OP card for DC operating point analysis', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(netlist).toMatch(/^\.OP$/m);
  });

  it('.OP analysis uses "print all" in control block', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(netlist).toContain('print all');
  });

  // --- .TRAN analysis ---

  it('includes .TRAN card for transient analysis (no config → defaults)', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: { analysis: 'tran' },
    };
    const { netlist } = generateSpiceNetlist(input);
    expect(netlist).toMatch(/^\.TRAN\s/m);
  });

  it('includes .TRAN card with correct step and stop from transient config', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: {
        analysis: 'tran',
        transient: { timeStep: 1e-6, stopTime: 1e-3, startTime: 0 },
      },
    };
    const { netlist } = generateSpiceNetlist(input);
    // timeStep 1e-6 → "1.000U", stopTime 1e-3 → "1.000M"
    expect(netlist).toMatch(/^\.TRAN\s+1\.000U\s+1\.000M/m);
  });

  it('includes start time in .TRAN when startTime > 0', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: {
        analysis: 'tran',
        transient: { timeStep: 1e-6, stopTime: 1e-3, startTime: 1e-4 },
      },
    };
    const { netlist } = generateSpiceNetlist(input);
    // Should have 3 values on the .TRAN line
    const tranLine = netlist.split('\n').find(l => l.startsWith('.TRAN'));
    expect(tranLine).toBeDefined();
    const parts = tranLine!.trim().split(/\s+/);
    expect(parts.length).toBeGreaterThanOrEqual(4);
  });

  // --- .AC analysis ---

  it('includes .AC card for AC analysis (no config → defaults)', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: { analysis: 'ac' },
    };
    const { netlist } = generateSpiceNetlist(input);
    expect(netlist).toMatch(/^\.AC\s/m);
  });

  it('includes .AC card with correct sweep type and points from AC config', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: {
        analysis: 'ac',
        ac: { sweepType: 'dec', numPoints: 10, startFreq: 1, stopFreq: 1e6 },
      },
    };
    const { netlist } = generateSpiceNetlist(input);
    expect(netlist).toMatch(/^\.AC\s+DEC\s+10\s/m);
  });

  it('respects "lin" sweep type in .AC card', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: {
        analysis: 'ac',
        ac: { sweepType: 'lin', numPoints: 100, startFreq: 100, stopFreq: 10000 },
      },
    };
    const { netlist } = generateSpiceNetlist(input);
    expect(netlist).toMatch(/^\.AC\s+LIN\s/m);
  });

  // --- .DC analysis ---

  it('includes .DC card for DC sweep analysis (no config → defaults)', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: { analysis: 'dc' },
    };
    const { netlist } = generateSpiceNetlist(input);
    expect(netlist).toMatch(/^\.DC\s/m);
  });

  it('includes .DC card with correct source name from DC sweep config', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: {
        analysis: 'dc',
        dcSweep: { sourceName: 'VIN', startValue: 0, stopValue: 5, stepValue: 0.1 },
      },
    };
    const { netlist } = generateSpiceNetlist(input);
    expect(netlist).toMatch(/^\.DC\s+VIN\s/m);
  });

  // --- Ground warning ---

  it('produces no ground warning when a ground net is present', () => {
    const { warnings } = generateSpiceNetlist(makeSimpleVRCircuit());
    const gndWarning = warnings.find(w => w.includes('ground'));
    expect(gndWarning).toBeUndefined();
  });

  it('warns when no ground net is found and components exist', () => {
    const input: SpiceGeneratorInput = {
      title: 'No Ground',
      components: [makeResistor(1, 'R1', '1k', 1, 2)],
      nets: [makeNet(1, 'NET1'), makeNet(2, 'NET2')],
      config: { analysis: 'op' },
    };
    const { warnings } = generateSpiceNetlist(input);
    expect(warnings.some(w => w.toLowerCase().includes('ground'))).toBe(true);
  });

  it('does not warn about ground when there are no components', () => {
    const input: SpiceGeneratorInput = {
      title: 'Empty',
      components: [],
      nets: [makeNet(1, 'NET1')],
      config: { analysis: 'op' },
    };
    const { warnings } = generateSpiceNetlist(input);
    const gndWarning = warnings.find(w => w.toLowerCase().includes('ground'));
    expect(gndWarning).toBeUndefined();
  });

  // --- Temperature ---

  it('includes .TEMP card when temperature is not the default 27°C', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: { analysis: 'op', temperature: 85 },
    };
    const { netlist } = generateSpiceNetlist(input);
    expect(netlist).toMatch(/^\.TEMP\s+85/m);
  });

  it('omits .TEMP card when temperature is 27°C (default)', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: { analysis: 'op', temperature: 27 },
    };
    const { netlist } = generateSpiceNetlist(input);
    expect(netlist).not.toContain('.TEMP');
  });

  // --- Node map comments ---

  it('includes node mapping comments in the netlist', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(netlist).toContain('* Node mapping:');
  });

  it('shows ground node as 0 in node mapping comment', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(netlist).toMatch(/\*\s+0\s*=\s*GND/);
  });

  // --- Component with no connectors is skipped ---

  it('warns and skips a component with no connectors', () => {
    const input: SpiceGeneratorInput = {
      title: 'Floating',
      components: [
        {
          instanceId: 1,
          referenceDesignator: 'R99',
          family: 'Resistor',
          properties: { value: '1k' },
          connectors: [],
        },
      ],
      nets: [makeGndNet(1)],
      config: { analysis: 'op' },
    };
    const { warnings, netlist } = generateSpiceNetlist(input);
    expect(warnings.some(w => w.includes('R99'))).toBe(true);
    expect(netlist).not.toMatch(/^R99\s/m);
  });

  // --- Unknown family falls back to subcircuit ---

  it('generates an X-prefixed subcircuit line for unknown component families', () => {
    const input: SpiceGeneratorInput = {
      title: 'Unknown',
      components: [
        {
          instanceId: 1,
          referenceDesignator: 'U1',
          family: 'OpAmp',
          properties: {},
          connectors: [
            { id: 'in+', name: 'in+', netId: 2 },
            { id: 'in-', name: 'in-', netId: 1 },
            { id: 'out', name: 'out', netId: 3 },
          ],
        },
      ],
      nets: [makeGndNet(1), makeNet(2, 'INP'), makeNet(3, 'OUT')],
      config: { analysis: 'op' },
    };
    const { netlist, warnings } = generateSpiceNetlist(input);
    // Unknown family → subcircuit generator → X-prefixed
    expect(netlist).toMatch(/^X/m);
    expect(warnings.some(w => w.includes('U1'))).toBe(true);
  });

  // --- Voltage source formatting ---

  it('voltage source line starts with "V"', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    expect(netlist).toMatch(/^V\S+\s/m);
  });

  it('voltage source line contains "DC"', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    const vLine = netlist.split('\n').find(l => /^V\S+/.test(l));
    expect(vLine).toBeDefined();
    expect(vLine).toContain('DC');
  });

  // --- Resistor value is normalized to SPICE engineering notation ---

  it('resistor line contains normalized SPICE value', () => {
    const { netlist } = generateSpiceNetlist(makeSimpleVRCircuit());
    // R1 is "1k" → normalized to "1.000K" (SPICE engineering notation)
    const rLine = netlist.split('\n').find(l => /^R1\s/.test(l));
    expect(rLine).toBeDefined();
    expect(rLine).toContain('1.000K');
  });

  // --- 'oct' sweep type ---

  it('respects "oct" sweep type in .AC card', () => {
    const input: SpiceGeneratorInput = {
      ...makeSimpleVRCircuit(),
      config: {
        analysis: 'ac',
        ac: { sweepType: 'oct', numPoints: 5, startFreq: 1, stopFreq: 1e5 },
      },
    };
    const { netlist } = generateSpiceNetlist(input);
    expect(netlist).toMatch(/^\.AC\s+OCT\s/m);
  });
});

// ---------------------------------------------------------------------------
// generateDCOpNetlist
// ---------------------------------------------------------------------------

describe('generateDCOpNetlist', () => {
  it('produces a valid netlist with .OP analysis', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeVoltageSource(1, 'V1', '3.3', 2, 1)];
    const { netlist } = generateDCOpNetlist('DC Op Test', components, nets);
    expect(netlist).toMatch(/^\.OP$/m);
  });

  it('title appears in the output', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeVoltageSource(1, 'V1', '3.3', 2, 1)];
    const { netlist } = generateDCOpNetlist('My DC Test', components, nets);
    expect(netlist).toContain('My DC Test');
  });

  it('output ends with .END', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeVoltageSource(1, 'V1', '5', 2, 1)];
    const { netlist } = generateDCOpNetlist('End Check', components, nets);
    const lines = netlist.split('\n').filter(l => l.trim() !== '');
    expect(lines[lines.length - 1]).toBe('.END');
  });

  it('returns a nodeMap with ground at 0', () => {
    const nets = [makeGndNet(1, 'GND'), makeNet(2, 'VCC')];
    const components = [makeVoltageSource(1, 'V1', '5', 2, 1)];
    const { nodeMap } = generateDCOpNetlist('Node Map Test', components, nets);
    expect(nodeMap['GND']).toBe(0);
  });

  it('returns an empty warnings array for a well-formed circuit', () => {
    const nets = [makeGndNet(1, 'GND'), makeNet(2, 'VCC')];
    const components = [makeVoltageSource(1, 'V1', '5', 2, 1)];
    const { warnings } = generateDCOpNetlist('Clean Circuit', components, nets);
    expect(warnings).toHaveLength(0);
  });

  it('generates .CONTROL block with "print all" for .OP', () => {
    const nets = [makeGndNet(1, 'GND'), makeNet(2, 'VCC')];
    const components = [makeVoltageSource(1, 'V1', '5', 2, 1)];
    const { netlist } = generateDCOpNetlist('Control Test', components, nets);
    expect(netlist).toContain('.CONTROL');
    expect(netlist).toContain('print all');
    expect(netlist).toContain('.ENDC');
  });
});

// ---------------------------------------------------------------------------
// BL-0567: Value auto-population from schematic component properties
// ---------------------------------------------------------------------------

describe('BL-0567: SPICE value auto-population', () => {
  function makeCapacitor(
    instanceId: number,
    ref: string,
    value: string,
    net1Id: number | null,
    net2Id: number | null,
  ): CircuitComponent {
    return {
      instanceId,
      referenceDesignator: ref,
      family: 'Capacitor',
      properties: { value },
      connectors: [
        { id: 'pin1', name: 'pin1', netId: net1Id },
        { id: 'pin2', name: 'pin2', netId: net2Id },
      ],
    };
  }

  function makeInductor(
    instanceId: number,
    ref: string,
    value: string,
    net1Id: number | null,
    net2Id: number | null,
  ): CircuitComponent {
    return {
      instanceId,
      referenceDesignator: ref,
      family: 'Inductor',
      properties: { value },
      connectors: [
        { id: 'pin1', name: 'pin1', netId: net1Id },
        { id: 'pin2', name: 'pin2', netId: net2Id },
      ],
    };
  }

  it('resistor with "10k" value produces normalized SPICE notation', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeResistor(1, 'R1', '10k', 2, 1)];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const rLine = netlist.split('\n').find(l => /^R1\s/.test(l));
    expect(rLine).toBeDefined();
    expect(rLine).toContain('10.00K');
  });

  it('resistor with "4.7kOhm" strips unit suffix and normalizes', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeResistor(1, 'R1', '4.7kOhm', 2, 1)];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const rLine = netlist.split('\n').find(l => /^R1\s/.test(l));
    expect(rLine).toBeDefined();
    expect(rLine).toContain('4.700K');
  });

  it('capacitor with "100nF" produces normalized SPICE value', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeCapacitor(1, 'C1', '100nF', 2, 1)];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const cLine = netlist.split('\n').find(l => /^C1\s/.test(l));
    expect(cLine).toBeDefined();
    expect(cLine).toContain('100.0N');
  });

  it('capacitor with "4.7uF" produces normalized SPICE value', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeCapacitor(1, 'C1', '4.7uF', 2, 1)];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const cLine = netlist.split('\n').find(l => /^C1\s/.test(l));
    expect(cLine).toBeDefined();
    expect(cLine).toContain('4.700U');
  });

  it('inductor with "10uH" produces normalized SPICE value', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeInductor(1, 'L1', '10uH', 2, 1)];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const lLine = netlist.split('\n').find(l => /^L1\s/.test(l));
    expect(lLine).toBeDefined();
    expect(lLine).toContain('10.00U');
  });

  it('inductor with "2.2mH" produces normalized SPICE value', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeInductor(1, 'L1', '2.2mH', 2, 1)];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const lLine = netlist.split('\n').find(l => /^L1\s/.test(l));
    expect(lLine).toBeDefined();
    expect(lLine).toContain('2.200M');
  });

  it('resistor uses "resistance" property as fallback', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components: CircuitComponent[] = [{
      instanceId: 1,
      referenceDesignator: 'R1',
      family: 'Resistor',
      properties: { resistance: '47k' },
      connectors: [
        { id: 'pin1', name: 'pin1', netId: 2 },
        { id: 'pin2', name: 'pin2', netId: 1 },
      ],
    }];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const rLine = netlist.split('\n').find(l => /^R1\s/.test(l));
    expect(rLine).toBeDefined();
    expect(rLine).toContain('47.00K');
  });

  it('capacitor uses "capacitance" property as fallback', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components: CircuitComponent[] = [{
      instanceId: 1,
      referenceDesignator: 'C1',
      family: 'Capacitor',
      properties: { capacitance: '22pF' },
      connectors: [
        { id: 'pin1', name: 'pin1', netId: 2 },
        { id: 'pin2', name: 'pin2', netId: 1 },
      ],
    }];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const cLine = netlist.split('\n').find(l => /^C1\s/.test(l));
    expect(cLine).toBeDefined();
    expect(cLine).toContain('22.00P');
  });

  it('uses default when no value or type-specific property is set', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components: CircuitComponent[] = [{
      instanceId: 1,
      referenceDesignator: 'R1',
      family: 'Resistor',
      properties: {},
      connectors: [
        { id: 'pin1', name: 'pin1', netId: 2 },
        { id: 'pin2', name: 'pin2', netId: 1 },
      ],
    }];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const rLine = netlist.split('\n').find(l => /^R1\s/.test(l));
    expect(rLine).toBeDefined();
    // Default "1k" → normalized to "1.000K"
    expect(rLine).toContain('1.000K');
  });

  it('handles "1Meg" resistor value (mega prefix)', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeResistor(1, 'R1', '1Meg', 2, 1)];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const rLine = netlist.split('\n').find(l => /^R1\s/.test(l));
    expect(rLine).toBeDefined();
    expect(rLine).toContain('1.000MEG');
  });

  it('handles plain numeric values ("47" → "47.00")', () => {
    const nets = [makeGndNet(1), makeNet(2, 'VCC')];
    const components = [makeResistor(1, 'R1', '47', 2, 1)];
    const input: SpiceGeneratorInput = {
      title: 'Test', components, nets, config: { analysis: 'op' },
    };
    const { netlist } = generateSpiceNetlist(input);
    const rLine = netlist.split('\n').find(l => /^R1\s/.test(l));
    expect(rLine).toBeDefined();
    expect(rLine).toContain('47.00');
  });
});
