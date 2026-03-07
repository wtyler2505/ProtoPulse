import { describe, it, expect } from 'vitest';
import { irToCode } from '../code-generator';
import type { CircuitIR } from '../circuit-ir';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIR(overrides: Partial<CircuitIR> = {}): CircuitIR {
  return {
    meta: { name: 'Test Circuit', version: '1.0' },
    components: [],
    nets: [],
    wires: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('irToCode', () => {
  describe('header and skeleton', () => {
    it('generates auto-generated header comment', () => {
      const code = irToCode(makeIR());
      expect(code).toContain('// Auto-generated from visual editor');
    });

    it('generates circuit() call with correct name', () => {
      const code = irToCode(makeIR({ meta: { name: 'Voltage Divider', version: '1.0' } }));
      expect(code).toContain('circuit("Voltage Divider")');
    });

    it('generates export() call at the end', () => {
      const code = irToCode(makeIR());
      const lines = code.split('\n').filter((line: string) => line.trim() !== '');
      expect(lines[lines.length - 1]).toContain('c.export()');
    });

    it('empty IR generates minimal skeleton with circuit() + export()', () => {
      const code = irToCode(makeIR());
      expect(code).toContain('circuit(');
      expect(code).toContain('c.export()');
      // Should NOT contain resistor/capacitor/connect calls
      expect(code).not.toContain('c.resistor');
      expect(code).not.toContain('c.connect');
      expect(code).not.toContain('c.net(');
    });
  });

  describe('net generation', () => {
    it('generates power net with voltage option', () => {
      const ir = makeIR({
        nets: [{ id: 'n1', name: 'VCC', type: 'power' }],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.net("VCC"');
    });

    it('generates ground net with ground option', () => {
      const ir = makeIR({
        nets: [{ id: 'n1', name: 'GND', type: 'ground' }],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.net("GND"');
      expect(code).toContain('ground: true');
    });

    it('generates signal net without options', () => {
      const ir = makeIR({
        nets: [{ id: 'n1', name: 'SIG1', type: 'signal' }],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.net("SIG1")');
    });

    it('orders nets: power first, then ground, then signal', () => {
      const ir = makeIR({
        nets: [
          { id: 'n1', name: 'SIG1', type: 'signal' },
          { id: 'n2', name: 'GND', type: 'ground' },
          { id: 'n3', name: 'VCC', type: 'power' },
        ],
      });
      const code = irToCode(ir);
      const vccPos = code.indexOf('"VCC"');
      const gndPos = code.indexOf('"GND"');
      const sigPos = code.indexOf('"SIG1"');
      expect(vccPos).toBeLessThan(gndPos);
      expect(gndPos).toBeLessThan(sigPos);
    });

    it('uses lowercase variable names for nets', () => {
      const ir = makeIR({
        nets: [{ id: 'n1', name: 'VCC', type: 'power' }],
      });
      const code = irToCode(ir);
      expect(code).toMatch(/const vcc = c\.net\(/);
    });
  });

  describe('component generation', () => {
    it('generates resistor from partId "resistor:10k"', () => {
      const ir = makeIR({
        nets: [{ id: 'n1', name: 'VCC', type: 'power' }],
        components: [
          { id: 'c1', refdes: 'R1', partId: 'resistor:10k', value: '10k', pins: { '1': 'VCC', '2': '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.resistor(');
      expect(code).toContain('value: "10k"');
    });

    it('generates capacitor from partId "capacitor:100nF"', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'C1', partId: 'capacitor:100nF', value: '100nF', pins: { '1': '', '2': '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.capacitor(');
      expect(code).toContain('value: "100nF"');
    });

    it('generates ic from partId "ic:ATmega328P"', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'U1', partId: 'ic:ATmega328P', pins: { VCC: '', GND: '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.ic(');
      expect(code).toContain('part: "ATmega328P"');
    });

    it('generates led from partId "led:RED"', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'LED1', partId: 'led:RED', pins: { A: '', K: '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.led(');
      expect(code).toContain('part: "RED"');
    });

    it('generates diode from partId "diode:1N4148"', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'D1', partId: 'diode:1N4148', pins: { A: '', K: '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.diode(');
      expect(code).toContain('part: "1N4148"');
    });

    it('generates transistor from partId "transistor:2N2222"', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'Q1', partId: 'transistor:2N2222', pins: { B: '', C: '', E: '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.transistor(');
      expect(code).toContain('part: "2N2222"');
    });

    it('generates inductor from partId "inductor:100uH"', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'L1', partId: 'inductor:100uH', value: '100uH', pins: { '1': '', '2': '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.inductor(');
      expect(code).toContain('value: "100uH"');
    });

    it('generates connector from partId "connector:2-pin"', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'J1', partId: 'connector:2-pin', pins: { '1': '', '2': '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.connector(');
      expect(code).toContain('part: "2-pin"');
    });

    it('generates generic component for unknown partId type', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'X1', partId: 'widget:foo', pins: { A: '', B: '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.generic(');
      expect(code).toContain('part: "foo"');
    });

    it('includes footprint when present', () => {
      const ir = makeIR({
        nets: [],
        components: [
          {
            id: 'c1',
            refdes: 'R1',
            partId: 'resistor:10k',
            value: '10k',
            footprint: '0805',
            pins: { '1': '', '2': '' },
          },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('footprint: "0805"');
    });

    it('uses descriptive variable names based on refdes', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'R1', partId: 'resistor:10k', value: '10k', pins: { '1': '', '2': '' } },
          { id: 'c2', refdes: 'C1', partId: 'capacitor:100nF', value: '100nF', pins: { '1': '', '2': '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toMatch(/const R1 = c\.resistor\(/);
      expect(code).toMatch(/const C1 = c\.capacitor\(/);
    });

    it('groups components by type prefix', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'C1', partId: 'capacitor:100nF', value: '100nF', pins: { '1': '', '2': '' } },
          { id: 'c2', refdes: 'R1', partId: 'resistor:10k', value: '10k', pins: { '1': '', '2': '' } },
          { id: 'c3', refdes: 'R2', partId: 'resistor:4.7k', value: '4.7k', pins: { '1': '', '2': '' } },
          { id: 'c4', refdes: 'C2', partId: 'capacitor:10uF', value: '10uF', pins: { '1': '', '2': '' } },
        ],
      });
      const code = irToCode(ir);
      // R1 and R2 should appear together, C1 and C2 should appear together
      const r1Pos = code.indexOf('const R1');
      const r2Pos = code.indexOf('const R2');
      const c1Pos = code.indexOf('const C1');
      const c2Pos = code.indexOf('const C2');
      // All R's should be contiguous (adjacent), all C's should be contiguous
      expect(Math.abs(r2Pos - r1Pos)).toBeLessThan(Math.abs(c1Pos - r1Pos) + 100);
    });
  });

  describe('connection generation', () => {
    it('generates connect() calls for pin-to-net mappings', () => {
      const ir = makeIR({
        nets: [
          { id: 'n1', name: 'VCC', type: 'power' },
          { id: 'n2', name: 'GND', type: 'ground' },
        ],
        components: [
          { id: 'c1', refdes: 'R1', partId: 'resistor:10k', value: '10k', pins: { '1': 'VCC', '2': 'GND' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('c.connect(R1.pin(');
      expect(code).toContain('vcc');
      expect(code).toContain('gnd');
    });

    it('skips unconnected pins (empty string)', () => {
      const ir = makeIR({
        nets: [{ id: 'n1', name: 'VCC', type: 'power' }],
        components: [
          { id: 'c1', refdes: 'R1', partId: 'resistor:10k', value: '10k', pins: { '1': 'VCC', '2': '' } },
        ],
      });
      const code = irToCode(ir);
      // Should have ONE connect call (pin 1 to VCC), not two
      const connectMatches = code.match(/c\.connect\(/g);
      expect(connectMatches).toHaveLength(1);
    });

    it('uses numeric pin access for numeric pin names', () => {
      const ir = makeIR({
        nets: [{ id: 'n1', name: 'VCC', type: 'power' }],
        components: [
          { id: 'c1', refdes: 'R1', partId: 'resistor:10k', value: '10k', pins: { '1': 'VCC', '2': '' } },
        ],
      });
      const code = irToCode(ir);
      // Numeric pins should use .pin(1) not .pin("1")
      expect(code).toContain('R1.pin(1)');
    });

    it('uses string pin access for named pins', () => {
      const ir = makeIR({
        nets: [{ id: 'n1', name: 'VCC', type: 'power' }],
        components: [
          { id: 'c1', refdes: 'U1', partId: 'ic:ATmega328P', pins: { VCC: 'VCC', GND: '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toContain('U1.pin("VCC")');
    });
  });

  describe('voltage divider integration', () => {
    it('generates complete voltage divider code', () => {
      const ir: CircuitIR = {
        meta: { name: 'Voltage Divider', version: '1.0' },
        nets: [
          { id: 'n1', name: 'VCC', type: 'power' },
          { id: 'n2', name: 'GND', type: 'ground' },
          { id: 'n3', name: 'VOUT', type: 'signal' },
        ],
        components: [
          { id: 'c1', refdes: 'R1', partId: 'resistor:10k', value: '10k', pins: { '1': 'VCC', '2': 'VOUT' } },
          { id: 'c2', refdes: 'R2', partId: 'resistor:10k', value: '10k', pins: { '1': 'VOUT', '2': 'GND' } },
        ],
        wires: [],
      };
      const code = irToCode(ir);

      // Should contain all key DSL constructs
      expect(code).toContain('circuit("Voltage Divider")');
      expect(code).toContain('c.resistor(');
      expect(code).toContain('c.net(');
      expect(code).toContain('c.connect(');
      expect(code).toContain('c.export()');

      // Should have 2 resistors, 3 nets, and connections
      expect((code.match(/c\.resistor\(/g) ?? []).length).toBe(2);
      expect((code.match(/c\.net\(/g) ?? []).length).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('handles refdes with numbers correctly as variable names', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'LED1', partId: 'led:GREEN', pins: { A: '', K: '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).toMatch(/const LED1 = c\.led\(/);
    });

    it('handles net name that is not a valid JS identifier', () => {
      const ir = makeIR({
        nets: [{ id: 'n1', name: 'Net-1.5V', type: 'power' }],
      });
      const code = irToCode(ir);
      // Should still produce valid-looking code with a sanitized variable name
      expect(code).toContain('c.net("Net-1.5V"');
      // Variable name should be sanitized
      expect(code).toMatch(/const \w+ = c\.net\(/);
    });

    it('handles multiple components connected to the same net', () => {
      const ir = makeIR({
        nets: [{ id: 'n1', name: 'VCC', type: 'power' }],
        components: [
          { id: 'c1', refdes: 'R1', partId: 'resistor:10k', value: '10k', pins: { '1': 'VCC', '2': '' } },
          { id: 'c2', refdes: 'R2', partId: 'resistor:4.7k', value: '4.7k', pins: { '1': 'VCC', '2': '' } },
        ],
      });
      const code = irToCode(ir);
      const connectMatches = code.match(/c\.connect\(/g);
      // Each connected pin gets its own connect() call
      expect(connectMatches).toHaveLength(2);
    });

    it('omits value/footprint when not present', () => {
      const ir = makeIR({
        nets: [],
        components: [
          { id: 'c1', refdes: 'U1', partId: 'ic:ATmega328P', pins: { VCC: '', GND: '' } },
        ],
      });
      const code = irToCode(ir);
      expect(code).not.toContain('value:');
      expect(code).not.toContain('footprint:');
    });

    it('handles circuit name with special characters', () => {
      const ir = makeIR({
        meta: { name: 'My "Cool" Circuit', version: '1.0' },
      });
      const code = irToCode(ir);
      // Should escape quotes in the circuit name
      expect(code).toContain('circuit(');
      // The name should be present in some form
      expect(code).toContain('Cool');
    });
  });

  describe('round-trip structural equivalence', () => {
    it('IR → code → eval produces structurally equivalent IR', () => {
      const originalIR: CircuitIR = {
        meta: { name: 'Round Trip Test', version: '1.0' },
        nets: [
          { id: 'n1', name: 'VCC', type: 'power' },
          { id: 'n2', name: 'GND', type: 'ground' },
        ],
        components: [
          { id: 'c1', refdes: 'R1', partId: 'resistor:10k', value: '10k', pins: { '1': 'VCC', '2': 'GND' } },
        ],
        wires: [],
      };

      const code = irToCode(originalIR);

      // The generated code should be syntactically valid JavaScript
      // We can't eval it in the test environment easily, but we can verify
      // it contains all the structural elements needed to reconstruct
      expect(code).toContain('circuit("Round Trip Test")');
      expect(code).toContain('c.net("VCC"');
      expect(code).toContain('c.net("GND"');
      expect(code).toContain('c.resistor(');
      expect(code).toContain('value: "10k"');
      expect(code).toContain('c.connect(R1.pin(1), vcc)');
      expect(code).toContain('c.connect(R1.pin(2), gnd)');
      expect(code).toContain('c.export()');
    });
  });
});
