import { describe, it, expect } from 'vitest';
import {
  generateSpiceNetlist,
  generateKicadNetlist,
  generateCsvNetlist,
  generateNetlist,
  type NetlistInput,
  type NetlistFormat,
} from '../export/netlist-generator';

// =============================================================================
// Fixtures
// =============================================================================

function makeResistorInput(): NetlistInput {
  return {
    circuit: { id: 1, name: 'Test Circuit' },
    instances: [
      { id: 1, partId: 101, referenceDesignator: 'R1' },
      { id: 2, partId: 102, referenceDesignator: 'R2' },
    ],
    nets: [
      {
        id: 10,
        name: 'net1',
        netType: 'signal',
        voltage: null,
        busWidth: null,
        segments: [
          { fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p1' },
        ],
      },
      {
        id: 11,
        name: 'GND',
        netType: 'ground',
        voltage: null,
        busWidth: null,
        segments: [
          { fromInstanceId: 1, fromPin: 'p2', toInstanceId: 2, toPin: 'p2' },
        ],
      },
    ],
    parts: new Map([
      [
        101,
        {
          id: 101,
          meta: { value: '10k' },
          connectors: [
            { id: 'p1', name: 'Pin1' },
            { id: 'p2', name: 'Pin2' },
          ],
        },
      ],
      [
        102,
        {
          id: 102,
          meta: { value: '4.7k' },
          connectors: [
            { id: 'p1', name: 'Pin1' },
            { id: 'p2', name: 'Pin2' },
          ],
        },
      ],
    ]),
  };
}

function makeIcInput(): NetlistInput {
  return {
    circuit: { id: 2, name: 'IC Circuit' },
    instances: [
      { id: 1, partId: 201, referenceDesignator: 'U1' },
    ],
    nets: [
      {
        id: 20,
        name: 'VCC',
        netType: 'power',
        voltage: '3.3V',
        busWidth: null,
        segments: [
          { fromInstanceId: 1, fromPin: 'vdd', toInstanceId: 1, toPin: 'vdd' },
        ],
      },
    ],
    parts: new Map([
      [
        201,
        {
          id: 201,
          meta: { title: 'STM32F103', packageType: 'LQFP-48' },
          connectors: [
            { id: 'vdd', name: 'VDD' },
            { id: 'gnd', name: 'GND' },
          ],
        },
      ],
    ]),
  };
}

function makeEmptyInput(): NetlistInput {
  return {
    circuit: { id: 99, name: 'Empty' },
    instances: [],
    nets: [],
    parts: new Map(),
  };
}

function makeCsvInput(): NetlistInput {
  return {
    circuit: { id: 3, name: 'CSV Circuit' },
    instances: [
      { id: 1, partId: 301, referenceDesignator: 'C1' },
      { id: 2, partId: 302, referenceDesignator: 'L1' },
    ],
    nets: [
      {
        id: 30,
        name: 'Net,With,Commas',
        netType: 'signal',
        voltage: null,
        busWidth: null,
        segments: [
          { fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p1' },
        ],
      },
    ],
    parts: new Map([
      [
        301,
        {
          id: 301,
          meta: { value: '100nF' },
          connectors: [
            { id: 'p1', name: 'Anode' },
            { id: 'p2', name: 'Cathode' },
          ],
        },
      ],
      [
        302,
        {
          id: 302,
          meta: { value: '10uH' },
          connectors: [
            { id: 'p1', name: 'In' },
            { id: 'p2', name: 'Out' },
          ],
        },
      ],
    ]),
  };
}

// =============================================================================
// generateSpiceNetlist
// =============================================================================

describe('generateSpiceNetlist', () => {
  it('starts with a SPICE header comment', () => {
    const result = generateSpiceNetlist(makeResistorInput());
    expect(result.startsWith('* SPICE Netlist')).toBe(true);
  });

  it('ends with .end', () => {
    const result = generateSpiceNetlist(makeResistorInput());
    expect(result.trimEnd().endsWith('.end')).toBe(true);
  });

  it('emits correct two-terminal resistor line format: R1 node1 node2 value', () => {
    const result = generateSpiceNetlist(makeResistorInput());
    // R1 connects pin p1 (net1) and pin p2 (GND -> node 0)
    expect(result).toContain('R1 net1 0 10k');
  });

  it('second resistor line has correct format', () => {
    const result = generateSpiceNetlist(makeResistorInput());
    expect(result).toContain('R2 net1 0 4.7k');
  });

  it('ground net type maps to SPICE node 0', () => {
    const result = generateSpiceNetlist(makeResistorInput());
    // Both resistors have their p2 on the GND ground net → node 0
    const lines = result.split('\n').filter((l) => l.startsWith('R'));
    lines.forEach((line) => {
      const parts = line.split(' ');
      // node2 (index 2) should be '0'
      expect(parts[2]).toBe('0');
    });
  });

  it('unconnected pin maps to SPICE node "0"', () => {
    // IC U1 has gnd connector which is not in any net segment
    const result = generateSpiceNetlist(makeIcInput());
    // Should contain 0 for the unconnected gnd pin
    expect(result).toContain('0');
  });

  it('IC (non-two-terminal) uses subcircuit X prefix', () => {
    const result = generateSpiceNetlist(makeIcInput());
    // U1 -> spicePrefix is 'X', referenceDesignator doesn't start with X → XU1
    expect(result).toContain('XU1');
  });

  it('handles missing part gracefully with WARNING comment', () => {
    const input = makeResistorInput();
    input.instances.push({ id: 99, partId: 999, referenceDesignator: 'R99' });
    const result = generateSpiceNetlist(input);
    expect(result).toContain('* WARNING: R99');
  });

  it('empty circuit produces header and .end only', () => {
    const result = generateSpiceNetlist(makeEmptyInput());
    expect(result).toContain('* SPICE Netlist');
    expect(result).toContain('.end');
    const lines = result.split('\n').filter((l) => !l.startsWith('*') && l.trim() !== '' && l !== '.end');
    expect(lines).toHaveLength(0);
  });

  it('special characters in net names are replaced with underscores', () => {
    const input = makeResistorInput();
    // Change net name to include special chars
    input.nets[0].name = 'net-A+B';
    const result = generateSpiceNetlist(input);
    expect(result).toContain('net_A_B');
    expect(result).not.toContain('net-A+B');
  });

  it('capacitor C prefix produces two-terminal line', () => {
    const input: NetlistInput = {
      circuit: { id: 5, name: 'Cap' },
      instances: [{ id: 1, partId: 501, referenceDesignator: 'C1' }],
      nets: [],
      parts: new Map([
        [501, { id: 501, meta: { value: '10nF' }, connectors: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }],
      ]),
    };
    const result = generateSpiceNetlist(input);
    // Both pins unconnected → both nodes 0
    expect(result).toContain('C1 0 0 10nF');
  });

  it('inductor L prefix produces two-terminal line', () => {
    const input: NetlistInput = {
      circuit: { id: 6, name: 'Ind' },
      instances: [{ id: 1, partId: 601, referenceDesignator: 'L1' }],
      nets: [],
      parts: new Map([
        [601, { id: 601, meta: { value: '100uH' }, connectors: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }],
      ]),
    };
    const result = generateSpiceNetlist(input);
    expect(result).toContain('L1 0 0 100uH');
  });
});

// =============================================================================
// generateKicadNetlist
// =============================================================================

describe('generateKicadNetlist', () => {
  it('output starts with (export (version "E")', () => {
    const result = generateKicadNetlist(makeResistorInput());
    expect(result.startsWith('(export (version "E")')).toBe(true);
  });

  it('output ends with a closing paren', () => {
    const result = generateKicadNetlist(makeResistorInput());
    expect(result.trimEnd().endsWith(')')).toBe(true);
  });

  it('contains a (components ...) section', () => {
    const result = generateKicadNetlist(makeResistorInput());
    expect(result).toContain('(components');
  });

  it('contains a (nets ...) section', () => {
    const result = generateKicadNetlist(makeResistorInput());
    expect(result).toContain('(nets');
  });

  it('net code 0 represents unconnected', () => {
    const result = generateKicadNetlist(makeResistorInput());
    expect(result).toContain('(net (code "0") (name ""))');
  });

  it('numbered nets start at code 1', () => {
    const result = generateKicadNetlist(makeResistorInput());
    expect(result).toContain('(net (code "1")');
  });

  it('component ref designators appear in output', () => {
    const result = generateKicadNetlist(makeResistorInput());
    expect(result).toContain('"R1"');
    expect(result).toContain('"R2"');
  });

  it('circuit name appears in design source', () => {
    const result = generateKicadNetlist(makeResistorInput());
    expect(result).toContain('"Test Circuit"');
  });

  it('includes ProtoPulse as tool', () => {
    const result = generateKicadNetlist(makeResistorInput());
    expect(result).toContain('"ProtoPulse EDA"');
  });

  it('footprint field is emitted when packageType is present', () => {
    const result = generateKicadNetlist(makeIcInput());
    expect(result).toContain('(footprint "LQFP-48")');
  });

  it('net name appears in S-expression', () => {
    const result = generateKicadNetlist(makeResistorInput());
    expect(result).toContain('"net1"');
  });

  it('double-quotes in circuit name are escaped', () => {
    const input = makeResistorInput();
    input.circuit.name = 'My "Circuit"';
    const result = generateKicadNetlist(input);
    expect(result).toContain('\\"Circuit\\"');
  });

  it('empty input produces valid minimal structure', () => {
    const result = generateKicadNetlist(makeEmptyInput());
    expect(result).toContain('(export (version "E")');
    expect(result).toContain('(components');
    expect(result).toContain('(nets');
    // Only unconnected net code 0
    expect(result).toContain('(net (code "0") (name ""))');
  });
});

// =============================================================================
// generateCsvNetlist
// =============================================================================

describe('generateCsvNetlist', () => {
  it('first line is the header row', () => {
    const result = generateCsvNetlist(makeResistorInput());
    const firstLine = result.split('\n')[0];
    expect(firstLine).toBe('Net Name,Net Type,From RefDes,From Pin,To RefDes,To Pin');
  });

  it('each data row has 6 columns', () => {
    const result = generateCsvNetlist(makeResistorInput());
    const lines = result.split('\n').slice(1).filter((l) => l.trim() !== '');
    lines.forEach((line) => {
      // Count fields: naive split on comma but check enough fields
      // The CSV may quote fields — just check field count roughly
      // Use a simple approach: count unquoted commas is unreliable; check columns count by
      // parsing the raw line structure with the expectation of exactly 5 commas at top-level
      let inQuote = false;
      let commas = 0;
      for (const ch of line) {
        if (ch === '"') inQuote = !inQuote;
        else if (ch === ',' && !inQuote) commas++;
      }
      expect(commas).toBe(5);
    });
  });

  it('net name appears in output rows', () => {
    const result = generateCsvNetlist(makeResistorInput());
    expect(result).toContain('net1');
  });

  it('reference designators appear in output', () => {
    const result = generateCsvNetlist(makeResistorInput());
    expect(result).toContain('R1');
    expect(result).toContain('R2');
  });

  it('net type appears in output rows', () => {
    const result = generateCsvNetlist(makeResistorInput());
    expect(result).toContain('signal');
  });

  it('field containing commas is quoted', () => {
    const result = generateCsvNetlist(makeCsvInput());
    expect(result).toContain('"Net,With,Commas"');
  });

  it('pin names are resolved to connector name (not id) when available', () => {
    const result = generateCsvNetlist(makeCsvInput());
    // p1 should be resolved to connector name 'Anode' for C1
    expect(result).toContain('Anode');
  });

  it('empty input returns only header line', () => {
    const result = generateCsvNetlist(makeEmptyInput());
    const lines = result.split('\n').filter((l) => l.trim() !== '');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Net Name,Net Type,From RefDes,From Pin,To RefDes,To Pin');
  });
});

// =============================================================================
// generateNetlist — unified dispatcher
// =============================================================================

describe('generateNetlist', () => {
  it('dispatches "spice" to SPICE generator', () => {
    const result = generateNetlist(makeResistorInput(), 'spice');
    expect(result).toContain('* SPICE Netlist');
    expect(result).toContain('.end');
  });

  it('dispatches "kicad" to KiCad generator', () => {
    const result = generateNetlist(makeResistorInput(), 'kicad');
    expect(result).toContain('(export (version "E")');
  });

  it('dispatches "csv" to CSV generator', () => {
    const result = generateNetlist(makeResistorInput(), 'csv');
    expect(result.split('\n')[0]).toBe('Net Name,Net Type,From RefDes,From Pin,To RefDes,To Pin');
  });

  it('SPICE output for same input matches direct call', () => {
    const input = makeResistorInput();
    expect(generateNetlist(input, 'spice')).toBe(generateSpiceNetlist(input));
  });

  it('KiCad output for same input matches direct call', () => {
    const input = makeResistorInput();
    expect(generateNetlist(input, 'kicad')).toBe(generateKicadNetlist(input));
  });

  it('CSV output for same input matches direct call', () => {
    const input = makeResistorInput();
    expect(generateNetlist(input, 'csv')).toBe(generateCsvNetlist(input));
  });
});
