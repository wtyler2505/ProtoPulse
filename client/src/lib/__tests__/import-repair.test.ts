import { describe, it, expect, beforeEach } from 'vitest';
import {
  repairImportedDesign,
  diagnoseDesign,
  recoverTruncatedJson,
  formatRepairSummary,
  getCategoryLabel,
  getCategoryDescription,
} from '@/lib/import-repair';
import type { RepairResult } from '@/lib/import-repair';
import type {
  ImportedDesign,
  ImportedComponent,
  ImportedNet,
  ImportedWire,
} from '@/lib/design-import';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDesign(overrides: Partial<ImportedDesign> = {}): ImportedDesign {
  return {
    format: 'kicad-schematic',
    fileName: 'test.kicad_sch',
    components: [],
    nets: [],
    wires: [],
    metadata: {},
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function makeComponent(
  refDes: string,
  name: string,
  overrides: Partial<ImportedComponent> = {},
): ImportedComponent {
  return {
    refDes,
    name,
    value: '10k',
    package: 'DIP-8',
    library: 'default',
    properties: {},
    pins: [],
    ...overrides,
  };
}

function makeNet(name: string, overrides: Partial<ImportedNet> = {}): ImportedNet {
  return {
    name,
    pins: [],
    ...overrides,
  };
}

function makeWire(overrides: Partial<ImportedWire> = {}): ImportedWire {
  return {
    start: { x: 0, y: 0 },
    end: { x: 100, y: 100 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// repairImportedDesign
// ---------------------------------------------------------------------------

describe('repairImportedDesign', () => {
  describe('missing IDs', () => {
    it('assigns generated refDes when empty', () => {
      const design = makeDesign({
        components: [makeComponent('', 'Resistor')],
      });
      const result = repairImportedDesign(design);
      expect(result.success).toBe(true);
      expect(result.design).not.toBeNull();
      expect(result.design!.components[0].refDes).toBeTruthy();
      expect(result.design!.components[0].refDes.length).toBeGreaterThan(0);
      expect(result.summary['missing-id']).toBe(1);
    });

    it('assigns generated refDes when only whitespace', () => {
      const design = makeDesign({
        components: [makeComponent('  ', 'Capacitor')],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].refDes.trim().length).toBeGreaterThan(0);
      expect(result.actions.some((a) => a.category === 'missing-id')).toBe(true);
    });

    it('assigns generated name to nets without names', () => {
      const design = makeDesign({
        nets: [makeNet('')],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.nets[0].name.length).toBeGreaterThan(0);
      expect(result.summary['missing-id']).toBe(1);
    });
  });

  describe('invalid coordinates', () => {
    it('clamps component position exceeding MAX_COORD', () => {
      const design = makeDesign({
        components: [makeComponent('R1', 'Resistor', {
          position: { x: 999999, y: -999999 },
        })],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].position!.x).toBe(100_000);
      expect(result.design!.components[0].position!.y).toBe(-100_000);
      expect(result.summary['invalid-coords']).toBe(1);
    });

    it('handles NaN coordinates', () => {
      const design = makeDesign({
        components: [makeComponent('R1', 'Resistor', {
          position: { x: NaN, y: Infinity },
        })],
      });
      const result = repairImportedDesign(design);
      expect(Number.isFinite(result.design!.components[0].position!.x)).toBe(true);
      expect(Number.isFinite(result.design!.components[0].position!.y)).toBe(true);
    });

    it('clamps wire coordinates', () => {
      const design = makeDesign({
        wires: [makeWire({
          start: { x: Infinity, y: 0 },
          end: { x: 0, y: -200_000 },
        })],
      });
      const result = repairImportedDesign(design);
      expect(Number.isFinite(result.design!.wires[0].start.x)).toBe(true);
      expect(result.design!.wires[0].end.y).toBe(-100_000);
      expect(result.summary['invalid-coords']).toBeGreaterThanOrEqual(1);
    });

    it('assigns default position when component has no position', () => {
      const design = makeDesign({
        components: [makeComponent('R1', 'Resistor', {
          position: undefined,
        })],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].position).toEqual({ x: 0, y: 0 });
      expect(result.actions.some((a) => a.category === 'missing-field' && a.problem.includes('position'))).toBe(true);
    });
  });

  describe('duplicate reference designators', () => {
    it('renames duplicate refDes with suffix', () => {
      const design = makeDesign({
        components: [
          makeComponent('R1', 'Resistor A'),
          makeComponent('R1', 'Resistor B'),
        ],
      });
      const result = repairImportedDesign(design);
      const refDes = result.design!.components.map((c) => c.refDes);
      expect(refDes[0]).toBe('R1');
      expect(refDes[1]).toBe('R1_2');
      expect(result.summary['duplicate-refdes']).toBe(1);
    });

    it('handles case-insensitive duplicates', () => {
      const design = makeDesign({
        components: [
          makeComponent('r1', 'A'),
          makeComponent('R1', 'B'),
        ],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[1].refDes).toBe('R1_2');
    });

    it('renames multiple duplicates incrementally', () => {
      const design = makeDesign({
        components: [
          makeComponent('U1', 'IC1'),
          makeComponent('U1', 'IC2'),
          makeComponent('U1', 'IC3'),
        ],
      });
      const result = repairImportedDesign(design);
      const refs = result.design!.components.map((c) => c.refDes);
      expect(refs).toEqual(['U1', 'U1_2', 'U1_3']);
      expect(result.summary['duplicate-refdes']).toBe(2);
    });

    it('renames duplicate net names', () => {
      const design = makeDesign({
        nets: [makeNet('VCC'), makeNet('VCC')],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.nets[0].name).toBe('VCC');
      expect(result.design!.nets[1].name).toBe('VCC_2');
    });
  });

  describe('missing required fields', () => {
    it('sets name to refDes when name is empty', () => {
      const design = makeDesign({
        components: [makeComponent('R1', '')],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].name).toBe('R1');
      expect(result.summary['missing-field']).toBeGreaterThanOrEqual(1);
    });

    it('sets package to Unknown when missing', () => {
      const design = makeDesign({
        components: [makeComponent('R1', 'Resistor', { package: '' })],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].package).toBe('Unknown');
    });

    it('assigns pin numbers when missing', () => {
      const design = makeDesign({
        components: [makeComponent('U1', 'IC', {
          pins: [
            { number: '', name: 'A', type: 'input' },
            { number: '', name: 'B', type: 'output' },
          ],
        })],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].pins[0].number).toBe('1');
      expect(result.design!.components[0].pins[1].number).toBe('2');
    });

    it('assigns pin names when missing', () => {
      const design = makeDesign({
        components: [makeComponent('U1', 'IC', {
          pins: [
            { number: '1', name: '', type: 'input' },
          ],
        })],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].pins[0].name).toBe('Pin_1');
    });

    it('sets pin type to unspecified when missing', () => {
      const design = makeDesign({
        components: [makeComponent('U1', 'IC', {
          pins: [
            { number: '1', name: 'A', type: undefined as unknown as 'input' },
          ],
        })],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].pins[0].type).toBe('unspecified');
    });

    it('removes orphan pin references from nets', () => {
      const design = makeDesign({
        components: [makeComponent('R1', 'Resistor')],
        nets: [makeNet('N1', {
          pins: [
            { componentRef: 'R1', pinNumber: '1' },
            { componentRef: 'NONEXISTENT', pinNumber: '1' },
          ],
        })],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.nets[0].pins).toHaveLength(1);
      expect(result.design!.nets[0].pins[0].componentRef).toBe('R1');
    });

    it('resets invalid wire width', () => {
      const design = makeDesign({
        wires: [makeWire({ width: -5 })],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.wires[0].width).toBeUndefined();
    });

    it('resets NaN wire width', () => {
      const design = makeDesign({
        wires: [makeWire({ width: NaN })],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.wires[0].width).toBeUndefined();
    });
  });

  describe('encoding issues', () => {
    it('strips control characters from refDes', () => {
      const design = makeDesign({
        components: [makeComponent('R1\x00\x01', 'Resistor')],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].refDes).toBe('R1');
      expect(result.summary['encoding']).toBeGreaterThanOrEqual(1);
    });

    it('strips control characters from component name', () => {
      const design = makeDesign({
        components: [makeComponent('R1', 'Res\x07istor')],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].name).toBe('Resistor');
    });

    it('strips control characters from net name', () => {
      const design = makeDesign({
        nets: [makeNet('VCC\x00')],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.nets[0].name).toBe('VCC');
    });

    it('replaces unicode replacement characters', () => {
      const design = makeDesign({
        components: [makeComponent('R1', 'Widerstand\uFFFD')],
      });
      const result = repairImportedDesign(design);
      expect(result.design!.components[0].name).toBe('Widerstand?');
    });

    it('cleans design title', () => {
      const design = makeDesign({
        title: 'My\x00Design',
      });
      const result = repairImportedDesign(design);
      expect(result.design!.title).toBe('MyDesign');
    });
  });

  describe('clean designs', () => {
    it('returns unchanged design when no issues', () => {
      const design = makeDesign({
        components: [makeComponent('R1', 'Resistor', { position: { x: 100, y: 200 } })],
        nets: [makeNet('N1', { pins: [{ componentRef: 'R1', pinNumber: '1' }] })],
        wires: [makeWire()],
      });
      const result = repairImportedDesign(design);
      expect(result.actions).toHaveLength(0);
      expect(result.success).toBe(true);
    });
  });

  describe('summary', () => {
    it('counts categories correctly', () => {
      const design = makeDesign({
        components: [
          makeComponent('', 'A'),          // missing-id
          makeComponent('R1', 'B', { position: { x: Infinity, y: 0 } }), // invalid-coords
          makeComponent('R1', 'C'),        // duplicate-refdes (R1 appears twice)
        ],
      });
      const result = repairImportedDesign(design);
      expect(result.summary['missing-id']).toBe(1);
      expect(result.summary['invalid-coords']).toBe(1);
      expect(result.summary['duplicate-refdes']).toBe(1);
    });
  });

  describe('immutability', () => {
    it('does not mutate the original design', () => {
      const comp = makeComponent('R1', 'Resistor', { position: { x: 999999, y: 0 } });
      const design = makeDesign({ components: [comp] });
      const originalX = comp.position!.x;
      repairImportedDesign(design);
      expect(comp.position!.x).toBe(originalX);
    });
  });
});

// ---------------------------------------------------------------------------
// diagnoseDesign
// ---------------------------------------------------------------------------

describe('diagnoseDesign', () => {
  it('detects missing refDes', () => {
    const design = makeDesign({
      components: [makeComponent('', 'Resistor')],
    });
    const issues = diagnoseDesign(design);
    expect(issues.some((i) => i.category === 'missing-id')).toBe(true);
  });

  it('detects duplicate refDes', () => {
    const design = makeDesign({
      components: [
        makeComponent('R1', 'A'),
        makeComponent('R1', 'B'),
      ],
    });
    const issues = diagnoseDesign(design);
    expect(issues.some((i) => i.category === 'duplicate-refdes')).toBe(true);
  });

  it('detects invalid coordinates', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor', {
        position: { x: NaN, y: 200_000 },
      })],
    });
    const issues = diagnoseDesign(design);
    expect(issues.filter((i) => i.category === 'invalid-coords').length).toBeGreaterThanOrEqual(2);
  });

  it('detects missing component name', () => {
    const design = makeDesign({
      components: [makeComponent('R1', '')],
    });
    const issues = diagnoseDesign(design);
    expect(issues.some((i) => i.category === 'missing-field')).toBe(true);
  });

  it('detects missing package', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor', { package: '' })],
    });
    const issues = diagnoseDesign(design);
    expect(issues.some((i) => i.category === 'missing-field' && i.problem.includes('package'))).toBe(true);
  });

  it('detects encoding issues', () => {
    const design = makeDesign({
      components: [makeComponent('R1\x00', 'Resistor')],
    });
    const issues = diagnoseDesign(design);
    expect(issues.some((i) => i.category === 'encoding')).toBe(true);
  });

  it('detects missing net name', () => {
    const design = makeDesign({
      nets: [makeNet('')],
    });
    const issues = diagnoseDesign(design);
    expect(issues.some((i) => i.category === 'missing-id')).toBe(true);
  });

  it('detects duplicate net names', () => {
    const design = makeDesign({
      nets: [makeNet('VCC'), makeNet('VCC')],
    });
    const issues = diagnoseDesign(design);
    expect(issues.some((i) => i.category === 'duplicate-refdes')).toBe(true);
  });

  it('detects invalid wire coordinates', () => {
    const design = makeDesign({
      wires: [makeWire({ start: { x: NaN, y: 0 }, end: { x: 0, y: 0 } })],
    });
    const issues = diagnoseDesign(design);
    expect(issues.some((i) => i.category === 'invalid-coords')).toBe(true);
  });

  it('returns empty array for clean design', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor', { position: { x: 0, y: 0 } })],
      nets: [makeNet('VCC')],
      wires: [makeWire()],
    });
    const issues = diagnoseDesign(design);
    expect(issues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// recoverTruncatedJson
// ---------------------------------------------------------------------------

describe('recoverTruncatedJson', () => {
  it('returns unchanged valid JSON', () => {
    const input = '{"key": "value"}';
    const result = recoverTruncatedJson(input);
    expect(result.wasRepaired).toBe(false);
    expect(result.recovered).toBe(input);
  });

  it('closes unclosed braces', () => {
    const input = '{"key": "value"';
    const result = recoverTruncatedJson(input);
    expect(result.wasRepaired).toBe(true);
    expect(() => JSON.parse(result.recovered)).not.toThrow();
  });

  it('closes unclosed brackets', () => {
    const input = '["a", "b"';
    const result = recoverTruncatedJson(input);
    expect(result.wasRepaired).toBe(true);
    const parsed = JSON.parse(result.recovered) as string[];
    expect(parsed).toEqual(['a', 'b']);
  });

  it('closes nested structures', () => {
    const input = '{"components": [{"name": "R1"';
    const result = recoverTruncatedJson(input);
    expect(result.wasRepaired).toBe(true);
    expect(() => JSON.parse(result.recovered)).not.toThrow();
  });

  it('strips trailing comma', () => {
    const input = '{"a": 1, "b": 2,';
    const result = recoverTruncatedJson(input);
    expect(result.wasRepaired).toBe(true);
    const parsed = JSON.parse(result.recovered) as Record<string, number>;
    expect(parsed).toEqual({ a: 1, b: 2 });
  });

  it('strips incomplete key-value pair', () => {
    const input = '{"a": 1, "b":';
    const result = recoverTruncatedJson(input);
    expect(result.wasRepaired).toBe(true);
    const parsed = JSON.parse(result.recovered) as Record<string, number>;
    expect(parsed.a).toBe(1);
  });

  it('handles empty string', () => {
    const result = recoverTruncatedJson('');
    expect(result.wasRepaired).toBe(false);
    expect(result.recovered).toBe('');
  });

  it('handles already-valid array', () => {
    const input = '[1, 2, 3]';
    const result = recoverTruncatedJson(input);
    expect(result.wasRepaired).toBe(false);
  });

  it('closes unclosed string at EOF', () => {
    const input = '{"name": "partial';
    const result = recoverTruncatedJson(input);
    expect(result.wasRepaired).toBe(true);
    expect(() => JSON.parse(result.recovered)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// formatRepairSummary
// ---------------------------------------------------------------------------

describe('formatRepairSummary', () => {
  it('returns clean message when no actions', () => {
    const result: RepairResult = {
      design: makeDesign(),
      actions: [],
      success: true,
      summary: {
        'missing-id': 0,
        'invalid-coords': 0,
        'duplicate-refdes': 0,
        'missing-field': 0,
        'encoding': 0,
        'truncated-json': 0,
      },
    };
    expect(formatRepairSummary(result)).toContain('No issues found');
  });

  it('lists categories with counts', () => {
    const result: RepairResult = {
      design: makeDesign(),
      actions: [
        { category: 'missing-id', severity: 'warning', entity: 'R1', problem: 'x', fix: 'y' },
        { category: 'missing-id', severity: 'warning', entity: 'R2', problem: 'x', fix: 'y' },
        { category: 'encoding', severity: 'info', entity: 'C1', problem: 'x', fix: 'y' },
      ],
      success: true,
      summary: {
        'missing-id': 2,
        'invalid-coords': 0,
        'duplicate-refdes': 0,
        'missing-field': 0,
        'encoding': 1,
        'truncated-json': 0,
      },
    };
    const text = formatRepairSummary(result);
    expect(text).toContain('3 issue(s)');
    expect(text).toContain('2 missing ids');
    expect(text).toContain('1 encoding issues');
  });
});

// ---------------------------------------------------------------------------
// getCategoryLabel / getCategoryDescription
// ---------------------------------------------------------------------------

describe('getCategoryLabel', () => {
  it('returns label for each category', () => {
    expect(getCategoryLabel('missing-id')).toBe('Missing IDs');
    expect(getCategoryLabel('invalid-coords')).toBe('Invalid Coordinates');
    expect(getCategoryLabel('duplicate-refdes')).toBe('Duplicate References');
    expect(getCategoryLabel('missing-field')).toBe('Missing Fields');
    expect(getCategoryLabel('encoding')).toBe('Encoding Issues');
    expect(getCategoryLabel('truncated-json')).toBe('Truncated Data');
  });
});

describe('getCategoryDescription', () => {
  it('returns description for each category', () => {
    expect(getCategoryDescription('missing-id').length).toBeGreaterThan(0);
    expect(getCategoryDescription('invalid-coords').length).toBeGreaterThan(0);
    expect(getCategoryDescription('duplicate-refdes').length).toBeGreaterThan(0);
    expect(getCategoryDescription('missing-field').length).toBeGreaterThan(0);
    expect(getCategoryDescription('encoding').length).toBeGreaterThan(0);
    expect(getCategoryDescription('truncated-json').length).toBeGreaterThan(0);
  });
});
