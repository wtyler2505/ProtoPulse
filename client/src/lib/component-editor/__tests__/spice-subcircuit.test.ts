import { describe, it, expect } from 'vitest';
import type { Connector } from '@shared/component-types';
import {
  parseSubcircuit,
  validateSubcircuit,
  autoMapPorts,
  generateSubcircuitTemplate,
  generateInstanceLine,
  summarizeBody,
  countInternalNodes,
  MAX_SUBCIRCUIT_LENGTH,
  MAX_PORTS,
  MAX_BODY_LINES,
} from '../spice-subcircuit';
import type { SubcircuitPort, PortMapping } from '../spice-subcircuit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConnector(id: string, name: string): Connector {
  return {
    id,
    name,
    connectorType: 'male',
    shapeIds: {},
    terminalPositions: {},
  };
}

const SIMPLE_SUBCKT = `.SUBCKT OPAMP INP INN OUT VCC VEE
R1 INP INN 1MEG
R2 OUT 0 100
.ENDS OPAMP`;

const RESISTOR_SUBCKT = `.SUBCKT MYRES A B
R1 A B 1k
.ENDS MYRES`;

const PARAMETERIZED_SUBCKT = `.SUBCKT PRES A B PARAMS: RVAL=1k TNOM=27
R1 A B {RVAL}
.ENDS PRES`;

// ---------------------------------------------------------------------------
// parseSubcircuit
// ---------------------------------------------------------------------------

describe('parseSubcircuit', () => {
  it('returns null for empty input', () => {
    expect(parseSubcircuit('')).toBeNull();
    expect(parseSubcircuit('   ')).toBeNull();
  });

  it('returns null when no .SUBCKT is present', () => {
    expect(parseSubcircuit('R1 A B 1k\n')).toBeNull();
  });

  it('returns null when .ENDS is missing', () => {
    expect(parseSubcircuit('.SUBCKT FOO A B\nR1 A B 1k\n')).toBeNull();
  });

  it('parses a simple 2-port subcircuit', () => {
    const result = parseSubcircuit(RESISTOR_SUBCKT);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('MYRES');
    expect(result!.ports).toHaveLength(2);
    expect(result!.ports[0]).toEqual({ name: 'A', index: 0 });
    expect(result!.ports[1]).toEqual({ name: 'B', index: 1 });
    expect(result!.bodyLines).toEqual(['R1 A B 1k']);
    expect(Object.keys(result!.params)).toHaveLength(0);
  });

  it('parses a multi-port op-amp subcircuit', () => {
    const result = parseSubcircuit(SIMPLE_SUBCKT);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('OPAMP');
    expect(result!.ports).toHaveLength(5);
    expect(result!.ports.map((p) => p.name)).toEqual(['INP', 'INN', 'OUT', 'VCC', 'VEE']);
    expect(result!.bodyLines).toHaveLength(2);
  });

  it('parses PARAMS: key=value pairs', () => {
    const result = parseSubcircuit(PARAMETERIZED_SUBCKT);
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ RVAL: '1k', TNOM: '27' });
    expect(result!.ports).toHaveLength(2);
  });

  it('handles continuation lines (+ prefix)', () => {
    const text = `.SUBCKT BIG A B C
+ D E
R1 A B 1k
.ENDS BIG`;
    const result = parseSubcircuit(text);
    expect(result).not.toBeNull();
    expect(result!.ports).toHaveLength(5);
    expect(result!.ports.map((p) => p.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('handles comment lines inside body', () => {
    const text = `.SUBCKT FOO A B
* This is a comment
R1 A B 1k
; Another comment
.ENDS FOO`;
    const result = parseSubcircuit(text);
    expect(result).not.toBeNull();
    // Comments are filtered by preprocessLines, so only R1 appears
    expect(result!.bodyLines).toEqual(['R1 A B 1k']);
  });

  it('handles case-insensitive .subckt/.ends', () => {
    const text = `.subckt lower a b
r1 a b 1k
.ends lower`;
    const result = parseSubcircuit(text);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('lower');
  });

  it('handles carriage returns (Windows line endings)', () => {
    const text = '.SUBCKT WIN A B\r\nR1 A B 1k\r\n.ENDS WIN\r\n';
    const result = parseSubcircuit(text);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('WIN');
  });

  it('ignores lines before .SUBCKT', () => {
    const text = `* Title line
* Some comments
.SUBCKT AFTER_HEADER A B
R1 A B 1k
.ENDS AFTER_HEADER`;
    const result = parseSubcircuit(text);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('AFTER_HEADER');
  });
});

// ---------------------------------------------------------------------------
// validateSubcircuit
// ---------------------------------------------------------------------------

describe('validateSubcircuit', () => {
  it('rejects empty input', () => {
    const result = validateSubcircuit('');
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].severity).toBe('error');
  });

  it('rejects input exceeding max length', () => {
    const text = 'x'.repeat(MAX_SUBCIRCUIT_LENGTH + 1);
    const result = validateSubcircuit(text);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('maximum length'))).toBe(true);
  });

  it('rejects missing .SUBCKT', () => {
    const result = validateSubcircuit('R1 A B 1k\n.ENDS');
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('No .SUBCKT'))).toBe(true);
  });

  it('rejects missing .ENDS', () => {
    const result = validateSubcircuit('.SUBCKT FOO A B\nR1 A B 1k');
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('.ENDS'))).toBe(true);
  });

  it('rejects zero ports', () => {
    const text = `.SUBCKT EMPTY
R1 A B 1k
.ENDS EMPTY`;
    const result = validateSubcircuit(text);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('at least one port'))).toBe(true);
  });

  it('detects duplicate port names', () => {
    const text = `.SUBCKT DUP A A B
R1 A B 1k
.ENDS DUP`;
    const result = validateSubcircuit(text);
    expect(result.diagnostics.some((d) => d.message.includes('Duplicate port'))).toBe(true);
  });

  it('warns on empty body', () => {
    const text = `.SUBCKT EMPTYBODY A B
.ENDS EMPTYBODY`;
    const result = validateSubcircuit(text);
    expect(result.valid).toBe(true);
    expect(result.diagnostics.some((d) => d.severity === 'warning' && d.message.includes('empty'))).toBe(true);
  });

  it('warns on unrecognized element prefix', () => {
    const text = `.SUBCKT FOO A B
Z1 A B 1k
.ENDS FOO`;
    const result = validateSubcircuit(text);
    expect(result.diagnostics.some((d) => d.message.includes('Unrecognized element prefix'))).toBe(true);
  });

  it('accepts a valid subcircuit', () => {
    const result = validateSubcircuit(SIMPLE_SUBCKT);
    expect(result.valid).toBe(true);
    expect(result.parsed).not.toBeNull();
    expect(result.parsed!.name).toBe('OPAMP');
  });

  it('warns on nested .SUBCKT definitions', () => {
    const text = `.SUBCKT OUTER A B
.SUBCKT INNER C D
R1 C D 1k
.ENDS INNER
R2 A B 2k
.ENDS OUTER`;
    const result = validateSubcircuit(text);
    expect(result.diagnostics.some((d) => d.message.includes('nested'))).toBe(true);
  });

  it('validates known SPICE directives in body', () => {
    const text = `.SUBCKT WITHMODEL A B
R1 A B 1k
.MODEL DMOD D IS=1E-14
.ENDS WITHMODEL`;
    const result = validateSubcircuit(text);
    expect(result.valid).toBe(true);
    // .MODEL should not produce warnings
    expect(result.diagnostics.filter((d) => d.message.includes('Unknown directive'))).toHaveLength(0);
  });

  it('warns on unknown directives in body', () => {
    const text = `.SUBCKT FOO A B
.BOGUS stuff
R1 A B 1k
.ENDS FOO`;
    const result = validateSubcircuit(text);
    expect(result.diagnostics.some((d) => d.message.includes('.BOGUS'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// autoMapPorts
// ---------------------------------------------------------------------------

describe('autoMapPorts', () => {
  it('maps by exact name match (case-insensitive)', () => {
    const ports: SubcircuitPort[] = [
      { name: 'VCC', index: 0 },
      { name: 'GND', index: 1 },
    ];
    const connectors = [makeConnector('c1', 'vcc'), makeConnector('c2', 'gnd')];
    const result = autoMapPorts(ports, connectors);
    expect(result.mappings).toHaveLength(2);
    expect(result.unmappedPorts).toHaveLength(0);
    expect(result.unmappedConnectors).toHaveLength(0);
  });

  it('maps by numeric pin-number match', () => {
    const ports: SubcircuitPort[] = [
      { name: '1', index: 0 },
      { name: '2', index: 1 },
    ];
    const connectors = [makeConnector('c1', 'PIN1'), makeConnector('c2', 'PIN2')];
    const result = autoMapPorts(ports, connectors);
    expect(result.mappings).toHaveLength(2);
    expect(result.mappings[0].connectorName).toBe('PIN1');
    expect(result.mappings[1].connectorName).toBe('PIN2');
  });

  it('maps by alias (VCC ↔ VDD)', () => {
    const ports: SubcircuitPort[] = [{ name: 'VCC', index: 0 }];
    const connectors = [makeConnector('c1', 'VDD')];
    const result = autoMapPorts(ports, connectors);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].portName).toBe('VCC');
    expect(result.mappings[0].connectorName).toBe('VDD');
  });

  it('maps by alias (GND ↔ VSS)', () => {
    const ports: SubcircuitPort[] = [{ name: 'GND', index: 0 }];
    const connectors = [makeConnector('c1', 'VSS')];
    const result = autoMapPorts(ports, connectors);
    expect(result.mappings).toHaveLength(1);
  });

  it('maps by substring match', () => {
    const ports: SubcircuitPort[] = [{ name: 'OUTPUT', index: 0 }];
    const connectors = [makeConnector('c1', 'MAIN_OUTPUT_PIN')];
    const result = autoMapPorts(ports, connectors);
    expect(result.mappings).toHaveLength(1);
  });

  it('reports unmapped ports and connectors', () => {
    const ports: SubcircuitPort[] = [
      { name: 'A', index: 0 },
      { name: 'B', index: 1 },
      { name: 'SPECIAL', index: 2 },
    ];
    const connectors = [
      makeConnector('c1', 'A'),
      makeConnector('c2', 'B'),
      makeConnector('c3', 'EXTRA'),
    ];
    const result = autoMapPorts(ports, connectors);
    expect(result.mappings).toHaveLength(2);
    expect(result.unmappedPorts).toEqual(['SPECIAL']);
    expect(result.unmappedConnectors).toEqual(['EXTRA']);
  });

  it('handles empty connectors list', () => {
    const ports: SubcircuitPort[] = [{ name: 'A', index: 0 }];
    const result = autoMapPorts(ports, []);
    expect(result.mappings).toHaveLength(0);
    expect(result.unmappedPorts).toEqual(['A']);
  });

  it('handles empty ports list', () => {
    const connectors = [makeConnector('c1', 'A')];
    const result = autoMapPorts([], connectors);
    expect(result.mappings).toHaveLength(0);
    expect(result.unmappedConnectors).toEqual(['A']);
  });

  it('does not double-map connectors', () => {
    const ports: SubcircuitPort[] = [
      { name: 'VCC', index: 0 },
      { name: 'VDD', index: 1 },
    ];
    // Only one connector named VCC — should map to the first port, not both
    const connectors = [makeConnector('c1', 'VCC')];
    const result = autoMapPorts(ports, connectors);
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].portName).toBe('VCC');
    expect(result.unmappedPorts).toContain('VDD');
  });
});

// ---------------------------------------------------------------------------
// generateSubcircuitTemplate
// ---------------------------------------------------------------------------

describe('generateSubcircuitTemplate', () => {
  it('generates a template with port names from connectors', () => {
    const connectors = [makeConnector('c1', 'IN'), makeConnector('c2', 'OUT'), makeConnector('c3', 'GND')];
    const template = generateSubcircuitTemplate('MyOpAmp', connectors);
    expect(template).toContain('.SUBCKT MYOPAMP IN OUT GND');
    expect(template).toContain('.ENDS MYOPAMP');
    expect(template).toContain('Ports: IN, OUT, GND');
  });

  it('sanitizes component name for SPICE', () => {
    const template = generateSubcircuitTemplate('My Op-Amp (v2)', [makeConnector('c1', 'A')]);
    expect(template).toContain('.SUBCKT MY_OP_AMP__V2_');
  });

  it('handles empty connectors gracefully', () => {
    const template = generateSubcircuitTemplate('Empty', []);
    expect(template).toContain('Add pins');
    expect(template).not.toContain('.SUBCKT');
  });

  it('replaces spaces in pin names with underscores', () => {
    const connectors = [makeConnector('c1', 'Pin 1')];
    const template = generateSubcircuitTemplate('Test', connectors);
    expect(template).toContain('Pin_1');
    expect(template).not.toContain('Pin 1');
  });

  it('uses UNNAMED for empty component name', () => {
    const template = generateSubcircuitTemplate('', [makeConnector('c1', 'A')]);
    expect(template).toContain('.SUBCKT UNNAMED');
  });
});

// ---------------------------------------------------------------------------
// generateInstanceLine
// ---------------------------------------------------------------------------

describe('generateInstanceLine', () => {
  it('generates correct X-element line', () => {
    const mappings: PortMapping[] = [
      { connectorId: 'c1', connectorName: 'IN', portName: 'INP', portIndex: 0 },
      { connectorId: 'c2', connectorName: 'OUT', portName: 'OUTP', portIndex: 1 },
    ];
    const netNames: Record<string, string> = { c1: 'net1', c2: 'net2' };
    const line = generateInstanceLine('X1', 'OPAMP', mappings, netNames);
    expect(line).toBe('X1 net1 net2 OPAMP');
  });

  it('sorts by port index', () => {
    const mappings: PortMapping[] = [
      { connectorId: 'c2', connectorName: 'OUT', portName: 'B', portIndex: 1 },
      { connectorId: 'c1', connectorName: 'IN', portName: 'A', portIndex: 0 },
    ];
    const netNames: Record<string, string> = { c1: 'net_a', c2: 'net_b' };
    const line = generateInstanceLine('X3', 'MYCOMP', mappings, netNames);
    expect(line).toBe('X3 net_a net_b MYCOMP');
  });

  it('uses fallback net names for unmapped connectors', () => {
    const mappings: PortMapping[] = [
      { connectorId: 'c1', connectorName: 'IN', portName: 'A', portIndex: 0 },
    ];
    const line = generateInstanceLine('X1', 'FOO', mappings, {});
    expect(line).toBe('X1 N_IN FOO');
  });
});

// ---------------------------------------------------------------------------
// summarizeBody
// ---------------------------------------------------------------------------

describe('summarizeBody', () => {
  it('counts element types in body', () => {
    const parsed = parseSubcircuit(SIMPLE_SUBCKT)!;
    const summary = summarizeBody(parsed);
    expect(summary['Resistor']).toBe(2);
  });

  it('ignores comments and directives', () => {
    const text = `.SUBCKT TEST A B
* comment
R1 A B 1k
.MODEL DMOD D
C1 A B 10n
.ENDS TEST`;
    const parsed = parseSubcircuit(text)!;
    const summary = summarizeBody(parsed);
    expect(summary['Resistor']).toBe(1);
    expect(summary['Capacitor']).toBe(1);
    expect(Object.keys(summary)).toHaveLength(2); // No .MODEL entry
  });

  it('returns empty record for empty body', () => {
    const text = `.SUBCKT EMPTY A B
.ENDS EMPTY`;
    const parsed = parseSubcircuit(text)!;
    const summary = summarizeBody(parsed);
    expect(Object.keys(summary)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// countInternalNodes
// ---------------------------------------------------------------------------

describe('countInternalNodes', () => {
  it('counts nodes not in port list', () => {
    const text = `.SUBCKT TEST A B
R1 A MID 500
R2 MID B 500
.ENDS TEST`;
    const parsed = parseSubcircuit(text)!;
    expect(countInternalNodes(parsed)).toBe(1); // MID
  });

  it('returns 0 when all nodes are ports', () => {
    const parsed = parseSubcircuit(RESISTOR_SUBCKT)!;
    expect(countInternalNodes(parsed)).toBe(0);
  });

  it('handles transistor elements with more nodes', () => {
    const text = `.SUBCKT AMP IN OUT VCC GND
Q1 OUT IN MID QNPN
R1 MID GND 1k
R2 VCC OUT 2k
.ENDS AMP`;
    const parsed = parseSubcircuit(text)!;
    // MID is internal, QNPN is a model name (4th token of Q), not a node
    // Q has 3 nodes: OUT, IN, MID — all recognized
    // Actually Q1 OUT IN MID QNPN → tokens are Q1 OUT IN MID QNPN
    // Q prefix → nodeCount=3, so nodes are OUT, IN, MID
    // R1 MID GND → MID, GND (port)
    // R2 VCC OUT → VCC (port), OUT (port)
    // Internal: MID
    expect(countInternalNodes(parsed)).toBe(1);
  });

  it('handles subcircuit instances (X elements)', () => {
    const text = `.SUBCKT TOP A B
X1 A MID INNER
R1 MID B 1k
.ENDS TOP`;
    const parsed = parseSubcircuit(text)!;
    // X1: nodes are A, MID (last token INNER is subckt name)
    // R1: nodes are MID, B
    // Internal: MID
    expect(countInternalNodes(parsed)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Constants exported
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('exports expected limits', () => {
    expect(MAX_SUBCIRCUIT_LENGTH).toBe(64_000);
    expect(MAX_PORTS).toBe(256);
    expect(MAX_BODY_LINES).toBe(2000);
  });
});
