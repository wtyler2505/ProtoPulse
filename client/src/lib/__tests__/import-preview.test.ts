import { describe, it, expect } from 'vitest';
import {
  generateImportPreview,
  formatPreviewSummary,
} from '@/lib/import-preview';
import type { ImportPreview, ProjectData } from '@/lib/import-preview';
import type { ImportedDesign } from '@/lib/design-import';

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

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    nodes: [],
    edges: [],
    bomItems: [],
    ...overrides,
  };
}

function makeComponent(
  refDes: string,
  name: string,
  pkg = 'DIP-8',
  props: Record<string, string> = {},
) {
  return {
    refDes,
    name,
    value: '',
    package: pkg,
    library: '',
    properties: props,
    pins: [],
  };
}

// ---------------------------------------------------------------------------
// generateImportPreview
// ---------------------------------------------------------------------------

describe('generateImportPreview', () => {
  // --- addedNodes ---

  it('counts all components as added nodes when project is empty', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor'), makeComponent('C1', 'Capacitor')],
    });
    const preview = generateImportPreview(design, makeProject());
    expect(preview.addedNodes).toBe(2);
    expect(preview.modifiedNodes).toBe(0);
  });

  it('detects modified nodes when labels match existing nodes', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor')],
    });
    const project = makeProject({
      nodes: [{ id: '1', data: { label: 'R1 - Resistor' } }],
    });
    const preview = generateImportPreview(design, project);
    expect(preview.modifiedNodes).toBe(1);
    expect(preview.addedNodes).toBe(0);
  });

  it('performs case-insensitive label matching', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'resistor')],
    });
    const project = makeProject({
      nodes: [{ id: '1', data: { label: 'R1 - Resistor' } }],
    });
    const preview = generateImportPreview(design, project);
    expect(preview.modifiedNodes).toBe(1);
  });

  it('counts orphaned nodes (existing but not in import)', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor')],
    });
    const project = makeProject({
      nodes: [
        { id: '1', data: { label: 'R1 - Resistor' } },
        { id: '2', data: { label: 'U1 - MCU' } },
      ],
    });
    const preview = generateImportPreview(design, project);
    expect(preview.removedNodes).toBe(1);
  });

  // --- addedEdges ---

  it('counts edges from nets with 2+ pins', () => {
    const design = makeDesign({
      nets: [
        { name: 'VCC', pins: [{ componentRef: 'R1', pinNumber: '1' }, { componentRef: 'C1', pinNumber: '1' }] },
        { name: 'GND', pins: [{ componentRef: 'R1', pinNumber: '2' }, { componentRef: 'C1', pinNumber: '2' }, { componentRef: 'U1', pinNumber: '3' }] },
      ],
    });
    const preview = generateImportPreview(design, makeProject());
    // VCC: 1 edge, GND: 2 edges
    expect(preview.addedEdges).toBe(3);
  });

  it('ignores nets with fewer than 2 pins', () => {
    const design = makeDesign({
      nets: [{ name: 'NC', pins: [{ componentRef: 'R1', pinNumber: '1' }] }],
    });
    const preview = generateImportPreview(design, makeProject());
    expect(preview.addedEdges).toBe(0);
  });

  // --- addedComponents (BOM) ---

  it('aggregates BOM items by name|package', () => {
    const design = makeDesign({
      components: [
        makeComponent('R1', 'Resistor', '0603'),
        makeComponent('R2', 'Resistor', '0603'),
        makeComponent('C1', 'Capacitor', '0402'),
      ],
    });
    const preview = generateImportPreview(design, makeProject());
    // 2 unique name|package combos
    expect(preview.addedComponents).toBe(2);
  });

  // --- addedNets & addedWires ---

  it('counts nets and wires', () => {
    const design = makeDesign({
      nets: [
        { name: 'VCC', pins: [] },
        { name: 'GND', pins: [] },
      ],
      wires: [
        { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      ],
    });
    const preview = generateImportPreview(design, makeProject());
    expect(preview.addedNets).toBe(2);
    expect(preview.addedWires).toBe(1);
  });

  // --- Warnings ---

  it('includes design warnings in preview warnings', () => {
    const design = makeDesign({
      warnings: ['Unsupported symbol type: power_flag'],
    });
    const preview = generateImportPreview(design, makeProject());
    expect(preview.warnings).toContain('Unsupported symbol type: power_flag');
  });

  it('warns when import has no components', () => {
    const design = makeDesign({ components: [] });
    const preview = generateImportPreview(design, makeProject());
    expect(preview.warnings).toContain('Import contains no components');
  });

  it('warns when components exist but no nets', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor')],
      nets: [],
    });
    const preview = generateImportPreview(design, makeProject());
    expect(preview.warnings).toContain('No nets found — components will be unconnected');
  });

  it('warns about unsupported features from metadata', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor')],
      metadata: { unsupported_features: 'hierarchical sheets' },
    });
    const preview = generateImportPreview(design, makeProject());
    expect(preview.warnings).toContain('Unsupported features: hierarchical sheets');
  });

  // --- Conflicts ---

  it('includes design errors in preview conflicts', () => {
    const design = makeDesign({
      errors: ['Parse error on line 42'],
    });
    const preview = generateImportPreview(design, makeProject());
    expect(preview.conflicts).toContain('Parse error on line 42');
  });

  it('detects duplicate ref designators within the import', () => {
    const design = makeDesign({
      components: [
        makeComponent('R1', 'Resistor'),
        makeComponent('R1', 'Resistor 2'),
      ],
    });
    const preview = generateImportPreview(design, makeProject());
    expect(preview.conflicts).toContain('Duplicate reference designator in import: R1');
  });

  it('detects part number collisions with existing BOM', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor', '0603', { MPN: 'RC0603FR-07100KL' })],
    });
    const project = makeProject({
      bomItems: [{ partNumber: 'RC0603FR-07100KL', description: 'Existing resistor' }],
    });
    const preview = generateImportPreview(design, project);
    expect(preview.conflicts).toContain('Part number already in BOM: RC0603FR-07100KL');
  });

  it('detects part number collisions case-insensitively', () => {
    const design = makeDesign({
      components: [makeComponent('U1', 'MCU', 'QFP', { MPN: 'atmega328p' })],
    });
    const project = makeProject({
      bomItems: [{ partNumber: 'ATMEGA328P' }],
    });
    const preview = generateImportPreview(design, project);
    expect(preview.conflicts.some((c) => c.includes('atmega328p'))).toBe(true);
  });

  it('reports label collision conflict when modified nodes > 0', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor')],
    });
    const project = makeProject({
      nodes: [{ id: '1', data: { label: 'R1 - Resistor' } }],
    });
    const preview = generateImportPreview(design, project);
    expect(preview.conflicts).toContain('1 node(s) share a label with existing nodes');
  });

  // --- Edge cases ---

  it('handles empty import and empty project', () => {
    const preview = generateImportPreview(makeDesign(), makeProject());
    expect(preview.addedNodes).toBe(0);
    expect(preview.modifiedNodes).toBe(0);
    expect(preview.removedNodes).toBe(0);
    expect(preview.addedEdges).toBe(0);
    expect(preview.addedComponents).toBe(0);
    expect(preview.addedNets).toBe(0);
    expect(preview.addedWires).toBe(0);
  });

  it('handles components without refDes (uses name only for label)', () => {
    const design = makeDesign({
      components: [makeComponent('', 'GenericPart')],
    });
    const project = makeProject({
      nodes: [{ id: '1', data: { label: 'GenericPart' } }],
    });
    const preview = generateImportPreview(design, project);
    expect(preview.modifiedNodes).toBe(1);
    expect(preview.addedNodes).toBe(0);
  });

  it('handles nodes without data or label', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor')],
    });
    const project = makeProject({
      nodes: [{ id: '1' }, { id: '2', data: {} }],
    });
    const preview = generateImportPreview(design, project);
    expect(preview.addedNodes).toBe(1);
    expect(preview.removedNodes).toBe(0);
  });

  it('uses PartNumber property as fallback for MPN', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor', '0603', { PartNumber: 'ABC123' })],
    });
    const project = makeProject({
      bomItems: [{ partNumber: 'abc123' }],
    });
    const preview = generateImportPreview(design, project);
    expect(preview.conflicts.some((c) => c.includes('ABC123'))).toBe(true);
  });

  it('uses refDes as part number fallback when no MPN/PartNumber', () => {
    const design = makeDesign({
      components: [makeComponent('U1', 'MCU')],
    });
    const project = makeProject({
      bomItems: [{ partNumber: 'U1' }],
    });
    const preview = generateImportPreview(design, project);
    expect(preview.conflicts.some((c) => c.includes('U1'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatPreviewSummary
// ---------------------------------------------------------------------------

describe('formatPreviewSummary', () => {
  const emptyPreview: ImportPreview = {
    addedNodes: 0,
    modifiedNodes: 0,
    removedNodes: 0,
    addedEdges: 0,
    addedComponents: 0,
    addedNets: 0,
    addedWires: 0,
    warnings: [],
    conflicts: [],
  };

  it('returns "No changes detected." for empty preview', () => {
    expect(formatPreviewSummary(emptyPreview)).toBe('No changes detected.');
  });

  it('formats added nodes', () => {
    const summary = formatPreviewSummary({ ...emptyPreview, addedNodes: 5 });
    expect(summary).toContain('+5 node(s)');
  });

  it('formats modified nodes', () => {
    const summary = formatPreviewSummary({ ...emptyPreview, modifiedNodes: 2 });
    expect(summary).toContain('~2 modified node(s)');
  });

  it('formats removed (orphaned) nodes', () => {
    const summary = formatPreviewSummary({ ...emptyPreview, removedNodes: 3 });
    expect(summary).toContain('-3 orphaned node(s)');
  });

  it('formats edges', () => {
    const summary = formatPreviewSummary({ ...emptyPreview, addedEdges: 7 });
    expect(summary).toContain('+7 edge(s)');
  });

  it('formats BOM items', () => {
    const summary = formatPreviewSummary({ ...emptyPreview, addedComponents: 4 });
    expect(summary).toContain('+4 BOM item(s)');
  });

  it('formats nets', () => {
    const summary = formatPreviewSummary({ ...emptyPreview, addedNets: 10 });
    expect(summary).toContain('+10 net(s)');
  });

  it('formats wires', () => {
    const summary = formatPreviewSummary({ ...emptyPreview, addedWires: 6 });
    expect(summary).toContain('+6 wire(s)');
  });

  it('appends warning count', () => {
    const summary = formatPreviewSummary({
      ...emptyPreview,
      addedNodes: 1,
      warnings: ['w1', 'w2'],
    });
    expect(summary).toContain('2 warning(s)');
  });

  it('appends conflict count', () => {
    const summary = formatPreviewSummary({
      ...emptyPreview,
      addedNodes: 1,
      conflicts: ['c1'],
    });
    expect(summary).toContain('1 conflict(s)');
  });

  it('combines multiple entity types', () => {
    const summary = formatPreviewSummary({
      ...emptyPreview,
      addedNodes: 3,
      addedEdges: 2,
      addedComponents: 1,
    });
    expect(summary).toBe('+3 node(s), +2 edge(s), +1 BOM item(s)');
  });
});
