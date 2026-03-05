/**
 * Tests for SPICE Netlist Parser (IN-04)
 *
 * Covers: element parsing, directive parsing, value multipliers,
 * model definitions, error handling, and runParsedNetlist integration.
 */

import { describe, it, expect } from 'vitest';
import {
  parseSpiceNetlist,
  parseSpiceValue,
  runParsedNetlist,
} from '../spice-netlist-parser';
import type { ParsedNetlist } from '../spice-netlist-parser';

// ---------------------------------------------------------------------------
// Value parser tests
// ---------------------------------------------------------------------------

describe('parseSpiceValue', () => {
  it('parses plain integers', () => {
    expect(parseSpiceValue('100')).toBe(100);
    expect(parseSpiceValue('0')).toBe(0);
    expect(parseSpiceValue('-5')).toBe(-5);
  });

  it('parses floating-point numbers', () => {
    expect(parseSpiceValue('3.14')).toBeCloseTo(3.14);
    expect(parseSpiceValue('0.001')).toBeCloseTo(0.001);
  });

  it('parses scientific notation', () => {
    expect(parseSpiceValue('1e3')).toBe(1000);
    expect(parseSpiceValue('2.2e-6')).toBeCloseTo(2.2e-6);
    expect(parseSpiceValue('1E3')).toBe(1000);
    expect(parseSpiceValue('5.5E+2')).toBeCloseTo(550);
  });

  it('parses k (kilo) suffix', () => {
    expect(parseSpiceValue('1k')).toBe(1e3);
    expect(parseSpiceValue('1K')).toBe(1e3);
    expect(parseSpiceValue('4.7k')).toBeCloseTo(4700);
    expect(parseSpiceValue('10K')).toBe(10e3);
  });

  it('parses M (milli) suffix — SPICE convention', () => {
    expect(parseSpiceValue('1m')).toBeCloseTo(1e-3);
    expect(parseSpiceValue('10m')).toBeCloseTo(10e-3);
    expect(parseSpiceValue('100M')).toBeCloseTo(100e-3);
  });

  it('parses MEG (mega) suffix', () => {
    expect(parseSpiceValue('1meg')).toBeCloseTo(1e6);
    expect(parseSpiceValue('1MEG')).toBeCloseTo(1e6);
    expect(parseSpiceValue('2.2Meg')).toBeCloseTo(2.2e6);
  });

  it('parses u / \u00B5 (micro) suffix', () => {
    expect(parseSpiceValue('1u')).toBeCloseTo(1e-6);
    expect(parseSpiceValue('4.7u')).toBeCloseTo(4.7e-6);
    expect(parseSpiceValue('100U')).toBeCloseTo(100e-6);
    expect(parseSpiceValue('1\u00B5')).toBeCloseTo(1e-6);
  });

  it('parses n (nano) suffix', () => {
    expect(parseSpiceValue('100n')).toBeCloseTo(100e-9);
    expect(parseSpiceValue('1N')).toBeCloseTo(1e-9);
    expect(parseSpiceValue('47n')).toBeCloseTo(47e-9);
  });

  it('parses p (pico) suffix', () => {
    expect(parseSpiceValue('10p')).toBeCloseTo(10e-12);
    expect(parseSpiceValue('22P')).toBeCloseTo(22e-12);
  });

  it('parses G (giga) suffix', () => {
    expect(parseSpiceValue('1G')).toBeCloseTo(1e9);
    expect(parseSpiceValue('2.5G')).toBeCloseTo(2.5e9);
  });

  it('parses T (tera) suffix', () => {
    expect(parseSpiceValue('1T')).toBeCloseTo(1e12);
  });

  it('parses f (femto) suffix', () => {
    expect(parseSpiceValue('1f')).toBeCloseTo(1e-15);
  });

  it('strips trailing unit letters after multiplier', () => {
    expect(parseSpiceValue('10kOhm')).toBe(10e3);
    expect(parseSpiceValue('100nF')).toBeCloseTo(100e-9);
    expect(parseSpiceValue('4.7uH')).toBeCloseTo(4.7e-6);
    expect(parseSpiceValue('1MegHz')).toBeCloseTo(1e6);
  });

  it('returns NaN for empty or invalid strings', () => {
    expect(parseSpiceValue('')).toBeNaN();
    expect(parseSpiceValue('   ')).toBeNaN();
    expect(parseSpiceValue('abc')).toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// Resistor parsing
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — resistors', () => {
  it('parses R1 N1 N2 1k', () => {
    const netlist = parseSpiceNetlist('Test\nR1 N1 N2 1k\n.END');
    expect(netlist.errors).toHaveLength(0);
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.elements[0].type).toBe('R');
    expect(netlist.elements[0].name).toBe('R1');
    expect(netlist.elements[0].nodes).toEqual(['n1', 'n2']);
    expect(netlist.elements[0].value).toBe(1e3);
  });

  it('parses resistor with 1K (uppercase)', () => {
    const netlist = parseSpiceNetlist('Test\nR1 a b 1K\n.END');
    expect(netlist.elements[0].value).toBe(1e3);
  });

  it('parses resistor with scientific notation 1e3', () => {
    const netlist = parseSpiceNetlist('Test\nR1 a b 1e3\n.END');
    expect(netlist.elements[0].value).toBe(1e3);
  });

  it('reports error for missing value', () => {
    const netlist = parseSpiceNetlist('Test\nR1 a b\n.END');
    expect(netlist.errors.length).toBeGreaterThan(0);
    expect(netlist.errors[0].message).toContain('R element');
  });
});

// ---------------------------------------------------------------------------
// Capacitor / inductor parsing
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — capacitors and inductors', () => {
  it('parses capacitor with nF value', () => {
    const netlist = parseSpiceNetlist('Test\nC1 in out 100n\n.END');
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.elements[0].type).toBe('C');
    expect(netlist.elements[0].value).toBeCloseTo(100e-9);
  });

  it('parses capacitor with pF value', () => {
    const netlist = parseSpiceNetlist('Test\nC2 a 0 22p\n.END');
    expect(netlist.elements[0].value).toBeCloseTo(22e-12);
  });

  it('parses inductor', () => {
    const netlist = parseSpiceNetlist('Test\nL1 in out 10u\n.END');
    expect(netlist.elements[0].type).toBe('L');
    expect(netlist.elements[0].value).toBeCloseTo(10e-6);
  });
});

// ---------------------------------------------------------------------------
// Voltage / current source parsing
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — sources', () => {
  it('parses DC voltage source with plain value', () => {
    const netlist = parseSpiceNetlist('Test\nV1 vcc 0 5\n.END');
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.elements[0].type).toBe('V');
    expect(netlist.elements[0].value).toBe(5);
  });

  it('parses DC voltage source with DC keyword', () => {
    const netlist = parseSpiceNetlist('Test\nV1 vcc 0 DC 3.3\n.END');
    expect(netlist.elements[0].value).toBe(3.3);
  });

  it('parses voltage source with AC spec as string', () => {
    const netlist = parseSpiceNetlist('Test\nV1 in 0 DC 0 AC 1\n.END');
    expect(typeof netlist.elements[0].value).toBe('string');
    expect(String(netlist.elements[0].value)).toContain('AC');
  });

  it('parses current source', () => {
    const netlist = parseSpiceNetlist('Test\nI1 a b 1m\n.END');
    expect(netlist.elements[0].type).toBe('I');
    expect(netlist.elements[0].value).toBeCloseTo(1e-3);
  });

  it('parses voltage source with PULSE spec', () => {
    const netlist = parseSpiceNetlist('Test\nV1 in 0 PULSE(0 5 0 1n 1n 5u 10u)\n.END');
    expect(typeof netlist.elements[0].value).toBe('string');
    expect(String(netlist.elements[0].value)).toContain('PULSE');
  });

  it('parses voltage source with SIN spec', () => {
    const netlist = parseSpiceNetlist('Test\nV1 in 0 SIN(0 1 1k)\n.END');
    expect(typeof netlist.elements[0].value).toBe('string');
    expect(String(netlist.elements[0].value)).toContain('SIN');
  });

  it('handles source with no value (defaults to 0)', () => {
    const netlist = parseSpiceNetlist('Test\nV1 a b\n.END');
    expect(netlist.elements[0].value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Diode parsing
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — diodes', () => {
  it('parses diode with model reference', () => {
    const netlist = parseSpiceNetlist('Test\nD1 anode cathode D1N4148\n.END');
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.elements[0].type).toBe('D');
    expect(netlist.elements[0].nodes).toEqual(['anode', 'cathode']);
    expect(netlist.elements[0].model).toBe('D1N4148');
  });

  it('reports error for diode with missing model', () => {
    const netlist = parseSpiceNetlist('Test\nD1 a b\n.END');
    expect(netlist.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// BJT parsing
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — BJTs', () => {
  it('parses NPN BJT', () => {
    const netlist = parseSpiceNetlist('Test\nQ1 collector base emitter 2N2222\n.END');
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.elements[0].type).toBe('Q');
    expect(netlist.elements[0].nodes).toEqual(['collector', 'base', 'emitter']);
    expect(netlist.elements[0].model).toBe('2N2222');
  });

  it('reports error for BJT with missing nodes', () => {
    const netlist = parseSpiceNetlist('Test\nQ1 c b\n.END');
    expect(netlist.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// MOSFET parsing
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — MOSFETs', () => {
  it('parses MOSFET with W and L params', () => {
    const netlist = parseSpiceNetlist('Test\nM1 drain gate source bulk NMOS1 W=10u L=1u\n.END');
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.elements[0].type).toBe('M');
    expect(netlist.elements[0].nodes).toEqual(['drain', 'gate', 'source', 'bulk']);
    expect(netlist.elements[0].model).toBe('NMOS1');
    expect(netlist.elements[0].params?.['W']).toBeCloseTo(10e-6);
    expect(netlist.elements[0].params?.['L']).toBeCloseTo(1e-6);
  });

  it('reports error for MOSFET with too few tokens', () => {
    const netlist = parseSpiceNetlist('Test\nM1 d g s\n.END');
    expect(netlist.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Analysis directive parsing
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — .OP directive', () => {
  it('parses .OP', () => {
    const netlist = parseSpiceNetlist('Test\n.OP\n.END');
    expect(netlist.analyses).toHaveLength(1);
    expect(netlist.analyses[0].type).toBe('op');
  });
});

describe('parseSpiceNetlist — .DC directive', () => {
  it('parses .DC V1 0 5 0.1', () => {
    const netlist = parseSpiceNetlist('Test\n.DC V1 0 5 0.1\n.END');
    expect(netlist.analyses).toHaveLength(1);
    expect(netlist.analyses[0].type).toBe('dc');
    expect(netlist.analyses[0].params['source']).toBe('V1');
    expect(netlist.analyses[0].params['start']).toBe(0);
    expect(netlist.analyses[0].params['stop']).toBe(5);
    expect(netlist.analyses[0].params['step']).toBe(0.1);
  });

  it('reports error for incomplete .DC', () => {
    const netlist = parseSpiceNetlist('Test\n.DC V1 0\n.END');
    expect(netlist.errors.length).toBeGreaterThan(0);
  });
});

describe('parseSpiceNetlist — .AC directive', () => {
  it('parses .AC DEC 100 1 1MEG', () => {
    const netlist = parseSpiceNetlist('Test\n.AC DEC 100 1 1MEG\n.END');
    expect(netlist.analyses).toHaveLength(1);
    expect(netlist.analyses[0].type).toBe('ac');
    expect(netlist.analyses[0].params['sweepType']).toBe('DEC');
    expect(netlist.analyses[0].params['numPoints']).toBe(100);
    expect(netlist.analyses[0].params['fStart']).toBe(1);
    expect(netlist.analyses[0].params['fStop']).toBeCloseTo(1e6);
  });

  it('parses .AC LIN 50 100 10k', () => {
    const netlist = parseSpiceNetlist('Test\n.AC LIN 50 100 10k\n.END');
    expect(netlist.analyses[0].params['sweepType']).toBe('LIN');
    expect(netlist.analyses[0].params['numPoints']).toBe(50);
  });

  it('reports error for incomplete .AC', () => {
    const netlist = parseSpiceNetlist('Test\n.AC DEC\n.END');
    expect(netlist.errors.length).toBeGreaterThan(0);
  });
});

describe('parseSpiceNetlist — .TRAN directive', () => {
  it('parses .TRAN 1u 1m', () => {
    const netlist = parseSpiceNetlist('Test\n.TRAN 1u 1m\n.END');
    expect(netlist.analyses).toHaveLength(1);
    expect(netlist.analyses[0].type).toBe('tran');
    expect(netlist.analyses[0].params['tStep']).toBeCloseTo(1e-6);
    expect(netlist.analyses[0].params['tStop']).toBeCloseTo(1e-3);
  });

  it('parses .TRAN with tstart and tmax', () => {
    const netlist = parseSpiceNetlist('Test\n.TRAN 10n 100u 0 5n\n.END');
    expect(netlist.analyses[0].params['tStep']).toBeCloseTo(10e-9);
    expect(netlist.analyses[0].params['tStop']).toBeCloseTo(100e-6);
    expect(netlist.analyses[0].params['tStart']).toBe(0);
    expect(netlist.analyses[0].params['tMax']).toBeCloseTo(5e-9);
  });

  it('reports error for incomplete .TRAN', () => {
    const netlist = parseSpiceNetlist('Test\n.TRAN\n.END');
    expect(netlist.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// .MODEL parsing
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — .MODEL definitions', () => {
  it('parses diode model', () => {
    const netlist = parseSpiceNetlist('Test\n.MODEL D1N4148 D(IS=2.52e-9 N=1.752)\n.END');
    expect(netlist.models['D1N4148']).toBeDefined();
    expect(netlist.models['D1N4148'].type).toBe('D');
    expect(netlist.models['D1N4148'].params['IS']).toBeCloseTo(2.52e-9);
    expect(netlist.models['D1N4148'].params['N']).toBeCloseTo(1.752);
  });

  it('parses BJT model', () => {
    const netlist = parseSpiceNetlist('Test\n.MODEL 2N2222 NPN(BF=100 IS=1e-14 VAF=100)\n.END');
    expect(netlist.models['2N2222']).toBeDefined();
    expect(netlist.models['2N2222'].type).toBe('NPN');
    expect(netlist.models['2N2222'].params['BF']).toBe(100);
  });

  it('parses MOSFET model', () => {
    const netlist = parseSpiceNetlist('Test\n.MODEL NMOS1 NMOS(KP=2e-5 VTO=0.7 LAMBDA=0.01)\n.END');
    expect(netlist.models['NMOS1']).toBeDefined();
    expect(netlist.models['NMOS1'].type).toBe('NMOS');
    expect(netlist.models['NMOS1'].params['VTO']).toBeCloseTo(0.7);
  });

  it('parses model without parentheses', () => {
    const netlist = parseSpiceNetlist('Test\n.MODEL D1 D IS=1e-14 N=1\n.END');
    expect(netlist.models['D1']).toBeDefined();
    expect(netlist.models['D1'].params['IS']).toBeCloseTo(1e-14);
  });
});

// ---------------------------------------------------------------------------
// Comment handling
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — comments', () => {
  it('skips * comment lines', () => {
    const netlist = parseSpiceNetlist('Title\n* This is a comment\nR1 a b 1k\n.END');
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.errors).toHaveLength(0);
  });

  it('strips inline ; comments', () => {
    const netlist = parseSpiceNetlist('Title\nR1 a b 1k ; feedback resistor\n.END');
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.elements[0].value).toBe(1e3);
  });

  it('handles multiple comment lines', () => {
    const text = [
      'Title',
      '* Comment 1',
      '* Comment 2',
      'R1 a b 1k',
      '* Comment 3',
      '.END',
    ].join('\n');
    const netlist = parseSpiceNetlist(text);
    expect(netlist.elements).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Case insensitivity
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — case insensitivity', () => {
  it('handles uppercase element names', () => {
    const netlist = parseSpiceNetlist('TEST\nR1 A B 1K\n.END');
    expect(netlist.elements[0].nodes).toEqual(['a', 'b']);
    expect(netlist.elements[0].value).toBe(1e3);
  });

  it('handles mixed-case directives', () => {
    const netlist = parseSpiceNetlist('Test\n.Op\n.end');
    expect(netlist.analyses).toHaveLength(1);
    expect(netlist.analyses[0].type).toBe('op');
  });

  it('handles lowercase element prefixes', () => {
    const netlist = parseSpiceNetlist('Test\nr1 a b 1k\nc1 a b 100n\n.END');
    expect(netlist.elements).toHaveLength(2);
    expect(netlist.elements[0].type).toBe('R');
    expect(netlist.elements[1].type).toBe('C');
  });
});

// ---------------------------------------------------------------------------
// Line continuation
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — line continuation', () => {
  it('joins continuation lines with +', () => {
    const text = 'Title\nR1 a\n+ b 1k\n.END';
    const netlist = parseSpiceNetlist(text);
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.elements[0].nodes).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// Title parsing
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — title', () => {
  it('extracts the first line as title', () => {
    const netlist = parseSpiceNetlist('My Circuit Design\nR1 a b 1k\n.END');
    expect(netlist.title).toBe('My Circuit Design');
  });

  it('handles empty netlist', () => {
    const netlist = parseSpiceNetlist('');
    expect(netlist.title).toBe('');
    expect(netlist.elements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Error reporting
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — error reporting', () => {
  it('reports line number in errors', () => {
    const netlist = parseSpiceNetlist('Title\nR1 a\n.END');
    expect(netlist.errors.length).toBeGreaterThan(0);
    expect(netlist.errors[0].line).toBe(2);
  });

  it('reports unknown element type', () => {
    const netlist = parseSpiceNetlist('Title\nZ1 a b 100\n.END');
    expect(netlist.errors.length).toBeGreaterThan(0);
    expect(netlist.errors[0].message).toContain('Unknown element');
  });

  it('reports invalid resistor value', () => {
    const netlist = parseSpiceNetlist('Title\nR1 a b xyz\n.END');
    expect(netlist.errors.length).toBeGreaterThan(0);
    expect(netlist.errors[0].message).toContain('invalid value');
  });

  it('collects multiple errors', () => {
    const netlist = parseSpiceNetlist('Title\nR1 a\nR2 c d xyz\nZ1 e f 1\n.END');
    expect(netlist.errors.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// .SUBCKT parsing (basic)
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — .SUBCKT', () => {
  it('parses a basic subcircuit definition', () => {
    const text = [
      'Title',
      '.SUBCKT myopamp inp inn out vdd vss',
      'R1 inp inn 1Meg',
      'V1 out 0 0',
      '.ENDS myopamp',
      '.END',
    ].join('\n');
    const netlist = parseSpiceNetlist(text);
    expect(netlist.subckts['myopamp']).toBeDefined();
    expect(netlist.subckts['myopamp'].ports).toEqual(['inp', 'inn', 'out', 'vdd', 'vss']);
    expect(netlist.subckts['myopamp'].body).toHaveLength(2);
    // Elements inside SUBCKT are NOT added to the top-level elements
    expect(netlist.elements).toHaveLength(0);
  });

  it('parses subcircuit instance (X element)', () => {
    const text = 'Title\nX1 in out vdd vss myopamp\n.END';
    const netlist = parseSpiceNetlist(text);
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.elements[0].type).toBe('X');
    expect(netlist.elements[0].model).toBe('myopamp');
    expect(netlist.elements[0].nodes).toEqual(['in', 'out', 'vdd', 'vss']);
  });
});

// ---------------------------------------------------------------------------
// .CONTROL / .ENDC blocks (skipped)
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — control blocks', () => {
  it('skips .CONTROL / .ENDC blocks', () => {
    const text = [
      'Title',
      'R1 a b 1k',
      '.CONTROL',
      'run',
      'print all',
      '.ENDC',
      '.END',
    ].join('\n');
    const netlist = parseSpiceNetlist(text);
    expect(netlist.elements).toHaveLength(1);
    expect(netlist.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Complete circuit examples
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — complete RC circuit', () => {
  const RC_CIRCUIT = [
    'RC Low-Pass Filter',
    'V1 in 0 DC 5',
    'R1 in out 1k',
    'C1 out 0 100n',
    '.TRAN 1u 1m',
    '.END',
  ].join('\n');

  it('parses all elements and analysis', () => {
    const netlist = parseSpiceNetlist(RC_CIRCUIT);
    expect(netlist.errors).toHaveLength(0);
    expect(netlist.title).toBe('RC Low-Pass Filter');
    expect(netlist.elements).toHaveLength(3);
    expect(netlist.analyses).toHaveLength(1);
    expect(netlist.analyses[0].type).toBe('tran');
  });

  it('identifies all element types', () => {
    const netlist = parseSpiceNetlist(RC_CIRCUIT);
    const types = netlist.elements.map((e) => e.type);
    expect(types).toContain('V');
    expect(types).toContain('R');
    expect(types).toContain('C');
  });
});

describe('parseSpiceNetlist — voltage divider', () => {
  const DIVIDER = [
    'Voltage Divider',
    'V1 vcc 0 DC 10',
    'R1 vcc out 10k',
    'R2 out 0 10k',
    '.OP',
    '.END',
  ].join('\n');

  it('parses voltage divider correctly', () => {
    const netlist = parseSpiceNetlist(DIVIDER);
    expect(netlist.errors).toHaveLength(0);
    expect(netlist.elements).toHaveLength(3);
    expect(netlist.analyses[0].type).toBe('op');
  });
});

describe('parseSpiceNetlist — diode circuit', () => {
  const DIODE_CIRCUIT = [
    'Diode Rectifier',
    'V1 in 0 SIN(0 10 60)',
    'D1 in out D1N4148',
    'R1 out 0 1k',
    '.MODEL D1N4148 D(IS=2.52e-9 N=1.752)',
    '.TRAN 100u 50m',
    '.END',
  ].join('\n');

  it('parses diode circuit with model', () => {
    const netlist = parseSpiceNetlist(DIODE_CIRCUIT);
    expect(netlist.errors).toHaveLength(0);
    expect(netlist.elements).toHaveLength(3);
    expect(netlist.models['D1N4148']).toBeDefined();
    expect(netlist.models['D1N4148'].params['IS']).toBeCloseTo(2.52e-9);
  });
});

// ---------------------------------------------------------------------------
// rawLines
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — rawLines', () => {
  it('preserves all raw lines from input', () => {
    const text = 'Title\nR1 a b 1k\n.END';
    const netlist = parseSpiceNetlist(text);
    expect(netlist.rawLines).toEqual(['Title', 'R1 a b 1k', '.END']);
  });
});

// ---------------------------------------------------------------------------
// runParsedNetlist — integration tests
// ---------------------------------------------------------------------------

describe('runParsedNetlist', () => {
  it('runs DC operating point on a voltage divider', async () => {
    const netlist = parseSpiceNetlist([
      'Voltage Divider',
      'V1 vcc 0 10',
      'R1 vcc out 10k',
      'R2 out 0 10k',
      '.OP',
      '.END',
    ].join('\n'));

    expect(netlist.errors).toHaveLength(0);

    const result = await runParsedNetlist(netlist);
    expect(result.converged).toBe(true);
    expect(result.analysisType).toBe('op');
    expect(result.dcResult).toBeDefined();

    // Voltage divider: Vout = 10 * 10k/(10k+10k) = 5V
    const outNode = result.nodeMap['out'];
    expect(outNode).toBeDefined();
    expect(result.dcResult!.nodeVoltages[outNode]).toBeCloseTo(5, 1);
  });

  it('runs DC operating point with single resistor + voltage source', async () => {
    const netlist = parseSpiceNetlist([
      'Simple Resistor',
      'V1 a 0 5',
      'R1 a 0 1k',
      '.OP',
      '.END',
    ].join('\n'));

    const result = await runParsedNetlist(netlist);
    expect(result.converged).toBe(true);

    // Current through 1k with 5V = 5mA
    const current = result.dcResult!.branchCurrents['R1'];
    expect(current).toBeCloseTo(5e-3, 4);
  });

  it('defaults to .OP when no analysis directive is present', async () => {
    const netlist = parseSpiceNetlist([
      'No Analysis Specified',
      'V1 a 0 3.3',
      'R1 a 0 330',
      '.END',
    ].join('\n'));

    const result = await runParsedNetlist(netlist);
    expect(result.analysisType).toBe('op');
    expect(result.converged).toBe(true);
  });

  it('runs DC sweep', async () => {
    const netlist = parseSpiceNetlist([
      'DC Sweep Test',
      'V1 a 0 0',
      'R1 a 0 1k',
      '.DC V1 0 5 1',
      '.END',
    ].join('\n'));

    const result = await runParsedNetlist(netlist);
    expect(result.analysisType).toBe('dc');
    expect(result.dcSweepResult).toBeDefined();
    expect(result.dcSweepResult!.sweepValues.length).toBeGreaterThan(0);
  });

  it('runs transient analysis', async () => {
    const netlist = parseSpiceNetlist([
      'Transient Test',
      'V1 in 0 5',
      'R1 in out 1k',
      'C1 out 0 1u',
      '.TRAN 10u 5m',
      '.END',
    ].join('\n'));

    const result = await runParsedNetlist(netlist);
    expect(result.analysisType).toBe('tran');
    expect(result.transientResult).toBeDefined();
    expect(result.transientResult!.timePoints.length).toBeGreaterThan(0);
    expect(result.converged).toBe(true);
  });

  it('warns about nonlinear devices', async () => {
    const netlist = parseSpiceNetlist([
      'Diode Circuit',
      'V1 in 0 5',
      'D1 in out DMOD',
      'R1 out 0 1k',
      '.MODEL DMOD D(IS=1e-14)',
      '.OP',
      '.END',
    ].join('\n'));

    const result = await runParsedNetlist(netlist);
    expect(result.warnings.some((w) => w.includes('nonlinear'))).toBe(true);
  });

  it('handles parse errors gracefully', async () => {
    const netlist = parseSpiceNetlist([
      'Bad Netlist',
      'R1 a',
      '.OP',
      '.END',
    ].join('\n'));

    expect(netlist.errors.length).toBeGreaterThan(0);

    const result = await runParsedNetlist(netlist);
    expect(result.warnings.some((w) => w.includes('parse error'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('parseSpiceNetlist — edge cases', () => {
  it('handles Windows line endings (\\r\\n)', () => {
    const netlist = parseSpiceNetlist('Title\r\nR1 a b 1k\r\n.END\r\n');
    expect(netlist.elements).toHaveLength(1);
  });

  it('handles trailing whitespace', () => {
    const netlist = parseSpiceNetlist('Title   \nR1 a b 1k   \n.END   ');
    expect(netlist.elements).toHaveLength(1);
  });

  it('handles multiple blank lines', () => {
    const netlist = parseSpiceNetlist('Title\n\n\nR1 a b 1k\n\n\n.END');
    expect(netlist.elements).toHaveLength(1);
  });

  it('handles netlist with only title and .END', () => {
    const netlist = parseSpiceNetlist('Title\n.END');
    expect(netlist.elements).toHaveLength(0);
    expect(netlist.analyses).toHaveLength(0);
    expect(netlist.errors).toHaveLength(0);
  });

  it('handles multiple analysis directives (uses first)', async () => {
    const netlist = parseSpiceNetlist([
      'Multi-Analysis',
      'V1 a 0 5',
      'R1 a 0 1k',
      '.OP',
      '.TRAN 1u 1m',
      '.END',
    ].join('\n'));

    expect(netlist.analyses).toHaveLength(2);

    const result = await runParsedNetlist(netlist);
    // Should use the first analysis (.OP)
    expect(result.analysisType).toBe('op');
  });

  it('handles ground node aliases (0, gnd, GND)', () => {
    const netlist = parseSpiceNetlist([
      'Ground Aliases',
      'V1 a 0 5',
      'R1 a gnd 1k',
      'R2 a GND 2k',
      '.END',
    ].join('\n'));

    expect(netlist.errors).toHaveLength(0);
    // All ground nodes should resolve to node 0
    expect(netlist.elements[0].nodes[1]).toBe('0');
    expect(netlist.elements[1].nodes[1]).toBe('gnd');
    expect(netlist.elements[2].nodes[1]).toBe('gnd');
  });
});
