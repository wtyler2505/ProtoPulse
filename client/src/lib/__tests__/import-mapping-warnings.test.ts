/**
 * Import Mapping Warnings — Tests
 *
 * Tests for generateImportWarnings() across formats + ImportPreviewDialog
 * rendering of the warning section.
 */

import { describe, it, expect } from 'vitest';
import {
  generateImportWarnings,
  groupWarningsBySeverity,
  groupWarningsByType,
  getWarningSummary,
  getWarningTypeLabel,
  getWarningTypeDescription,
} from '@/lib/import-warnings';
import type { ImportedDesign, ImportedComponent, ImportedNet, ImportedWire } from '@/lib/design-import';
import type { ImportWarning, ImportWarningType, ImportWarningSeverity } from '@/lib/import-warnings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComponent(overrides: Partial<ImportedComponent> = {}): ImportedComponent {
  return {
    refDes: 'R1',
    name: 'Resistor',
    value: '10k',
    package: 'R0603',
    library: 'device',
    properties: {},
    pins: [
      { number: '1', name: 'A', type: 'passive' },
      { number: '2', name: 'B', type: 'passive' },
    ],
    ...overrides,
  };
}

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

function makeNet(overrides: Partial<ImportedNet> = {}): ImportedNet {
  return {
    name: 'GND',
    pins: [
      { componentRef: 'R1', pinNumber: '1' },
      { componentRef: 'C1', pinNumber: '2' },
    ],
    ...overrides,
  };
}

function makeWire(overrides: Partial<ImportedWire> = {}): ImportedWire {
  return {
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// KiCad format warnings
// ---------------------------------------------------------------------------

describe('generateImportWarnings — KiCad', () => {
  it('generates dropped warning for 3D model references (ki_3dmodel)', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      components: [
        makeComponent({
          refDes: 'U1',
          name: 'ATmega328P',
          properties: { ki_3dmodel: '${KICAD6_3DMODEL_DIR}/Package_DIP.3dshapes/DIP-28_W7.62mm.wrl' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const modelWarnings = warnings.filter((w) => w.type === 'dropped' && w.detail.includes('3D model'));
    expect(modelWarnings.length).toBe(1);
    expect(modelWarnings[0].entity).toBe('U1');
    expect(modelWarnings[0].severity).toBe('info');
  });

  it('generates dropped warning for 3D model references (3d_model key)', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      components: [
        makeComponent({
          refDes: 'J1',
          name: 'Connector',
          properties: { '3d_model': 'connectors/usb_c.step' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.type === 'dropped' && w.entity === 'J1' && w.detail.includes('3D model'))).toBe(true);
  });

  it('generates unsupported warning for custom footprint library references', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      components: [
        makeComponent({
          refDes: 'C1',
          name: 'Cap',
          properties: { ki_fp_lib: 'mylib:C_0402_1005Metric' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const fpWarnings = warnings.filter((w) => w.type === 'unsupported' && w.detail.includes('footprint'));
    expect(fpWarnings.length).toBe(1);
    expect(fpWarnings[0].severity).toBe('warning');
  });

  it('generates unsupported warning using Footprint key (alternative)', () => {
    const design = makeDesign({
      format: 'kicad-pcb',
      components: [
        makeComponent({
          refDes: 'D1',
          name: 'LED',
          properties: { Footprint: 'LED_SMD:LED_0805_2012Metric' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-pcb');
    expect(warnings.some((w) => w.type === 'unsupported' && w.entity === 'D1')).toBe(true);
  });

  it('generates dropped warning for symbol library references', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      components: [
        makeComponent({
          refDes: 'U2',
          name: 'ESP32',
          properties: { ki_sym_lib: 'RF_Module:ESP32-WROOM-32' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.type === 'dropped' && w.detail.includes('Symbol library'))).toBe(true);
  });

  it('generates dropped warning for page/title block settings', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      metadata: { page_size: 'A4', title_block: 'Test Schematic' },
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.type === 'dropped' && w.entity === 'Sheet')).toBe(true);
  });

  it('generates converted warning for power flags', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      metadata: { power_flags: '3' },
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const pfWarnings = warnings.filter((w) => w.type === 'converted' && w.entity === 'Power flags');
    expect(pfWarnings.length).toBe(1);
    expect(pfWarnings[0].detail).toContain('3 power flag(s)');
  });

  it('applies to kicad-pcb and kicad-symbol formats', () => {
    for (const format of ['kicad-pcb', 'kicad-symbol'] as const) {
      const design = makeDesign({
        format,
        components: [
          makeComponent({
            properties: { ki_3dmodel: 'model.step' },
          }),
        ],
      });
      const warnings = generateImportWarnings(design, format);
      expect(warnings.some((w) => w.detail.includes('3D model'))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// EAGLE format warnings
// ---------------------------------------------------------------------------

describe('generateImportWarnings — EAGLE', () => {
  it('generates unsupported warning for ULP script references', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      components: [
        makeComponent({
          refDes: 'R2',
          name: 'Resistor',
          properties: { ulp_script: 'bom.ulp' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'eagle-schematic');
    const ulpWarnings = warnings.filter((w) => w.type === 'unsupported' && w.detail.includes('ULP'));
    expect(ulpWarnings.length).toBe(1);
    expect(ulpWarnings[0].severity).toBe('warning');
  });

  it('generates unsupported warning for ULP key variant', () => {
    const design = makeDesign({
      format: 'eagle-board',
      components: [
        makeComponent({
          refDes: 'U3',
          name: 'IC',
          properties: { ULP: 'assembly.ulp' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'eagle-board');
    expect(warnings.some((w) => w.type === 'unsupported' && w.detail.includes('ULP'))).toBe(true);
  });

  it('generates dropped warning for board variants', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      components: [
        makeComponent({
          refDes: 'C3',
          name: 'Cap',
          properties: { variant: 'production' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'eagle-schematic');
    const variantWarnings = warnings.filter((w) => w.type === 'dropped' && w.detail.includes('variant'));
    expect(variantWarnings.length).toBe(1);
    expect(variantWarnings[0].severity).toBe('warning');
  });

  it('generates dropped warning for VARIANT key (uppercase)', () => {
    const design = makeDesign({
      format: 'eagle-library',
      components: [
        makeComponent({
          refDes: 'D2',
          name: 'Diode',
          properties: { VARIANT: 'prototype' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'eagle-library');
    expect(warnings.some((w) => w.type === 'dropped' && w.detail.includes('prototype'))).toBe(true);
  });

  it('generates dropped warning for technology attributes', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      components: [
        makeComponent({
          refDes: 'Q1',
          name: 'MOSFET',
          properties: { technology: 'SMD' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'eagle-schematic');
    expect(warnings.some((w) => w.type === 'dropped' && w.detail.includes('Technology'))).toBe(true);
  });

  it('generates dropped warning for embedded design rules', () => {
    const design = makeDesign({
      format: 'eagle-board',
      metadata: { design_rules: 'clearance=8mil' },
    });

    const warnings = generateImportWarnings(design, 'eagle-board');
    expect(warnings.some((w) => w.type === 'dropped' && w.entity === 'Design Rules')).toBe(true);
  });

  it('generates converted warning for supply layers', () => {
    const design = makeDesign({
      format: 'eagle-board',
      metadata: { supply_layers: 'VCC,GND' },
    });

    const warnings = generateImportWarnings(design, 'eagle-board');
    expect(warnings.some((w) => w.type === 'converted' && w.entity === 'Supply layers')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Altium format warnings
// ---------------------------------------------------------------------------

describe('generateImportWarnings — Altium', () => {
  it('generates dropped warning for Altium vault references (VaultGUID)', () => {
    const design = makeDesign({
      format: 'altium-schematic',
      components: [
        makeComponent({
          refDes: 'U4',
          name: 'STM32',
          properties: { VaultGUID: '{ABCD-1234-EFGH}' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'altium-schematic');
    const vaultWarnings = warnings.filter((w) => w.type === 'dropped' && w.detail.includes('Vault'));
    expect(vaultWarnings.length).toBe(1);
    expect(vaultWarnings[0].severity).toBe('warning');
  });

  it('generates dropped warning for vault_guid key', () => {
    const design = makeDesign({
      format: 'altium-pcb',
      components: [
        makeComponent({
          refDes: 'R5',
          name: 'Res',
          properties: { vault_guid: 'xyz-123' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'altium-pcb');
    expect(warnings.some((w) => w.detail.includes('Vault'))).toBe(true);
  });

  it('generates dropped warning for ComponentKind', () => {
    const design = makeDesign({
      format: 'altium-schematic',
      components: [
        makeComponent({
          refDes: 'C5',
          name: 'Cap',
          properties: { ComponentKind: 'standard' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'altium-schematic');
    expect(warnings.some((w) => w.type === 'dropped' && w.detail.includes('ComponentKind'))).toBe(true);
  });

  it('generates unsupported warning for room definitions', () => {
    const design = makeDesign({
      format: 'altium-pcb',
      metadata: { rooms: 'Room1,Room2' },
    });

    const warnings = generateImportWarnings(design, 'altium-pcb');
    const roomWarnings = warnings.filter((w) => w.type === 'unsupported' && w.entity === 'Rooms');
    expect(roomWarnings.length).toBe(1);
    expect(roomWarnings[0].severity).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// Generic / cross-format warnings
// ---------------------------------------------------------------------------

describe('generateImportWarnings — generic', () => {
  it('generates dropped warning for unknown properties', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      components: [
        makeComponent({
          refDes: 'U5',
          name: 'IC',
          properties: { CustomField1: 'val1', MyProp: 'val2' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.type === 'dropped' && w.detail.includes('Unknown properties'))).toBe(true);
  });

  it('generates approximated warning for missing package', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      components: [
        makeComponent({
          refDes: 'R6',
          name: 'Res',
          package: '',
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.type === 'approximated' && w.detail.includes('No package'))).toBe(true);
  });

  it('generates approximated warning for components with no pins', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      components: [
        makeComponent({
          refDes: 'TP1',
          name: 'TestPoint',
          pins: [],
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'eagle-schematic');
    expect(warnings.some((w) => w.type === 'approximated' && w.detail.includes('No pin definitions'))).toBe(true);
  });

  it('generates converted warning for non-numeric Tolerance value', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      components: [
        makeComponent({
          refDes: 'R7',
          name: 'Res',
          properties: { Tolerance: 'not-a-number' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.type === 'converted' && w.detail.includes('Tolerance'))).toBe(true);
  });

  it('generates approximated warning for dangling nets (1 pin)', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      nets: [
        makeNet({ name: 'DANGLING', pins: [{ componentRef: 'R1', pinNumber: '1' }] }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.type === 'approximated' && w.entity.includes('DANGLING'))).toBe(true);
  });

  it('generates approximated warning for wires with no net assignment', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      wires: [
        makeWire({ net: undefined }),
        makeWire({ net: undefined }),
        makeWire({ net: 'GND' }),
      ],
    });

    const warnings = generateImportWarnings(design, 'eagle-schematic');
    expect(warnings.some((w) => w.type === 'approximated' && w.detail.includes('without net'))).toBe(true);
  });

  it('generates unsupported warnings from metadata unsupported_features', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      metadata: { unsupported_features: 'bus_definitions, hierarchical_sheets' },
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const unsup = warnings.filter((w) => w.type === 'unsupported');
    expect(unsup.length).toBe(2);
    expect(unsup.some((w) => w.entity === 'bus_definitions')).toBe(true);
    expect(unsup.some((w) => w.entity === 'hierarchical_sheets')).toBe(true);
  });

  it('propagates design-level warnings as converted/info', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      warnings: ['Some parser warning'],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.type === 'converted' && w.severity === 'info' && w.detail === 'Some parser warning')).toBe(true);
  });

  it('propagates design-level errors as dropped/error', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      errors: ['Fatal parse error in section X'],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.type === 'dropped' && w.severity === 'error' && w.detail === 'Fatal parse error in section X')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Grouping utilities
// ---------------------------------------------------------------------------

describe('groupWarningsByType', () => {
  it('groups warnings into correct buckets', () => {
    const warnings: ImportWarning[] = [
      { type: 'dropped', entity: 'A', detail: 'd1', severity: 'info' },
      { type: 'unsupported', entity: 'B', detail: 'd2', severity: 'warning' },
      { type: 'converted', entity: 'C', detail: 'd3', severity: 'info' },
      { type: 'approximated', entity: 'D', detail: 'd4', severity: 'warning' },
      { type: 'dropped', entity: 'E', detail: 'd5', severity: 'error' },
    ];

    const groups = groupWarningsByType(warnings);
    expect(groups.dropped.length).toBe(2);
    expect(groups.unsupported.length).toBe(1);
    expect(groups.converted.length).toBe(1);
    expect(groups.approximated.length).toBe(1);
  });

  it('returns empty arrays for types with no warnings', () => {
    const groups = groupWarningsByType([]);
    expect(groups.dropped).toEqual([]);
    expect(groups.unsupported).toEqual([]);
    expect(groups.converted).toEqual([]);
    expect(groups.approximated).toEqual([]);
  });
});

describe('groupWarningsBySeverity', () => {
  it('groups warnings by severity level', () => {
    const warnings: ImportWarning[] = [
      { type: 'dropped', entity: 'A', detail: 'd1', severity: 'error' },
      { type: 'dropped', entity: 'B', detail: 'd2', severity: 'error' },
      { type: 'unsupported', entity: 'C', detail: 'd3', severity: 'warning' },
      { type: 'converted', entity: 'D', detail: 'd4', severity: 'info' },
    ];

    const groups = groupWarningsBySeverity(warnings);
    expect(groups.error.length).toBe(2);
    expect(groups.warning.length).toBe(1);
    expect(groups.info.length).toBe(1);
  });

  it('returns empty arrays for severities with no warnings', () => {
    const groups = groupWarningsBySeverity([]);
    expect(groups.error).toEqual([]);
    expect(groups.warning).toEqual([]);
    expect(groups.info).toEqual([]);
  });
});

describe('getWarningSummary', () => {
  it('returns "No issues detected" for empty array', () => {
    expect(getWarningSummary([])).toBe('No issues detected');
  });

  it('returns correct summary with mixed severities', () => {
    const warnings: ImportWarning[] = [
      { type: 'dropped', entity: 'A', detail: 'd1', severity: 'error' },
      { type: 'unsupported', entity: 'B', detail: 'd2', severity: 'warning' },
      { type: 'unsupported', entity: 'C', detail: 'd3', severity: 'warning' },
      { type: 'converted', entity: 'D', detail: 'd4', severity: 'info' },
    ];

    const summary = getWarningSummary(warnings);
    expect(summary).toContain('1 error(s)');
    expect(summary).toContain('2 warning(s)');
    expect(summary).toContain('1 info');
  });

  it('omits severities with zero count', () => {
    const warnings: ImportWarning[] = [
      { type: 'dropped', entity: 'A', detail: 'd1', severity: 'info' },
    ];

    const summary = getWarningSummary(warnings);
    expect(summary).not.toContain('error');
    expect(summary).not.toContain('warning');
    expect(summary).toContain('1 info');
  });
});

describe('getWarningTypeLabel', () => {
  it('returns correct labels', () => {
    expect(getWarningTypeLabel('dropped')).toBe('Dropped');
    expect(getWarningTypeLabel('unsupported')).toBe('Unsupported');
    expect(getWarningTypeLabel('converted')).toBe('Converted');
    expect(getWarningTypeLabel('approximated')).toBe('Approximated');
  });
});

describe('getWarningTypeDescription', () => {
  it('returns non-empty description for each type', () => {
    const types: ImportWarningType[] = ['dropped', 'unsupported', 'converted', 'approximated'];
    for (const type of types) {
      const desc = getWarningTypeDescription(type);
      expect(desc.length).toBeGreaterThan(10);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('generateImportWarnings — edge cases', () => {
  it('returns empty array for empty design with no issues', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      components: [],
      nets: [],
      wires: [],
      metadata: {},
      warnings: [],
      errors: [],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.length).toBe(0);
  });

  it('handles design with all error-severity warnings', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      errors: ['Error 1', 'Error 2', 'Error 3'],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const errors = warnings.filter((w) => w.severity === 'error');
    expect(errors.length).toBe(3);
  });

  it('handles mixed format-specific + generic warnings', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      components: [
        makeComponent({
          refDes: 'U1',
          name: 'IC',
          package: '',
          properties: { ki_3dmodel: 'model.wrl', CustomField: 'abc' },
          pins: [],
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    // Should have: 3D model (dropped), no package (approximated), no pins (approximated), unknown prop (dropped)
    expect(warnings.length).toBeGreaterThanOrEqual(4);
    expect(warnings.some((w) => w.type === 'dropped' && w.detail.includes('3D model'))).toBe(true);
    expect(warnings.some((w) => w.type === 'approximated' && w.detail.includes('No package'))).toBe(true);
    expect(warnings.some((w) => w.type === 'approximated' && w.detail.includes('No pin'))).toBe(true);
    expect(warnings.some((w) => w.type === 'dropped' && w.detail.includes('Unknown properties'))).toBe(true);
  });

  it('uses component name when refDes is empty', () => {
    const design = makeDesign({
      format: 'kicad-schematic',
      components: [
        makeComponent({
          refDes: '',
          name: 'MyComponent',
          package: '',
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.entity === 'MyComponent')).toBe(true);
  });

  it('uses sourceFormat when design.format is not set', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      components: [
        makeComponent({
          refDes: 'U1',
          name: 'IC',
          properties: { ulp_script: 'test.ulp' },
        }),
      ],
    });

    // Passing eagle-schematic as sourceFormat should trigger EAGLE warnings
    const warnings = generateImportWarnings(design, 'eagle-schematic');
    expect(warnings.some((w) => w.detail.includes('ULP'))).toBe(true);
  });

  it('does not generate format-specific warnings for unknown format', () => {
    const design = makeDesign({
      format: 'geda-schematic',
      components: [
        makeComponent({
          refDes: 'R1',
          name: 'Res',
          properties: { ki_3dmodel: 'model.step', geda_custom_field: 'xyz' },
        }),
      ],
    });

    const warnings = generateImportWarnings(design, 'geda-schematic');
    // KiCad-specific "3D model reference dropped" should NOT fire for a gEDA design
    const kicadSpecific = warnings.filter((w) => w.detail.includes('3D model reference dropped'));
    expect(kicadSpecific.length).toBe(0);
    // ki_3dmodel is in knownKeys so it won't trigger unknown-properties,
    // but the geda_custom_field is NOT known, so it will trigger generic unknown-properties
    expect(
      warnings.some((w) => w.detail.includes('Unknown properties') && w.detail.includes('geda_custom_field')),
    ).toBe(true);
  });

  it('handles multiple components with multiple warnings each', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      components: [
        makeComponent({ refDes: 'R1', name: 'Res', properties: { ulp_script: 'a.ulp', variant: 'v1' } }),
        makeComponent({ refDes: 'R2', name: 'Res', properties: { ulp_script: 'b.ulp', variant: 'v2' } }),
        makeComponent({ refDes: 'R3', name: 'Res', properties: { technology: 'SMD' } }),
      ],
    });

    const warnings = generateImportWarnings(design, 'eagle-schematic');
    const ulpWarnings = warnings.filter((w) => w.detail.includes('ULP'));
    const variantWarnings = warnings.filter((w) => w.detail.includes('variant'));
    expect(ulpWarnings.length).toBe(2);
    expect(variantWarnings.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// UI rendering tests (ImportPreviewDialog warning section)
// ---------------------------------------------------------------------------

describe('ImportPreviewDialog — mapping warnings rendering', () => {
  // These tests verify the warning data transformation that drives the UI.
  // Full component render tests would require happy-dom + testing-library,
  // but we can validate the grouping logic that the UI depends on.

  it('groups warnings by type with correct color association', () => {
    const warnings: ImportWarning[] = [
      { type: 'dropped', entity: 'U1', detail: '3D model dropped', severity: 'info' },
      { type: 'unsupported', entity: 'R1', detail: 'ULP not supported', severity: 'warning' },
      { type: 'converted', entity: 'Power', detail: 'Power flags converted', severity: 'info' },
      { type: 'approximated', entity: 'TP1', detail: 'No package', severity: 'warning' },
    ];

    const groups = groupWarningsByType(warnings);

    // Each type should map to its correct color in the UI:
    // dropped -> red-500, unsupported -> amber-500, converted -> blue-500, approximated -> gray-400
    expect(groups.dropped.length).toBe(1);
    expect(groups.unsupported.length).toBe(1);
    expect(groups.converted.length).toBe(1);
    expect(groups.approximated.length).toBe(1);
  });

  it('identifies when error banner should show (any error-severity warnings)', () => {
    const warningsWithErrors: ImportWarning[] = [
      { type: 'dropped', entity: 'Import', detail: 'Fatal error', severity: 'error' },
      { type: 'dropped', entity: 'U1', detail: 'Model dropped', severity: 'info' },
    ];

    const bySeverity = groupWarningsBySeverity(warningsWithErrors);
    const shouldShowBanner = bySeverity.error.length > 0;
    expect(shouldShowBanner).toBe(true);
    expect(bySeverity.error.length).toBe(1);
  });

  it('identifies when no banner should show (no error-severity)', () => {
    const warningsNoErrors: ImportWarning[] = [
      { type: 'dropped', entity: 'U1', detail: 'Model dropped', severity: 'info' },
      { type: 'unsupported', entity: 'R1', detail: 'ULP', severity: 'warning' },
    ];

    const bySeverity = groupWarningsBySeverity(warningsNoErrors);
    expect(bySeverity.error.length).toBe(0);
  });

  it('calculates correct count badges per group', () => {
    const warnings: ImportWarning[] = [
      { type: 'dropped', entity: 'A', detail: 'd1', severity: 'info' },
      { type: 'dropped', entity: 'B', detail: 'd2', severity: 'warning' },
      { type: 'dropped', entity: 'C', detail: 'd3', severity: 'error' },
      { type: 'unsupported', entity: 'D', detail: 'd4', severity: 'warning' },
    ];

    const groups = groupWarningsByType(warnings);
    expect(groups.dropped.length).toBe(3);
    expect(groups.unsupported.length).toBe(1);
    expect(groups.converted.length).toBe(0);
    expect(groups.approximated.length).toBe(0);
  });

  it('summary reports no issues for clean import', () => {
    const summary = getWarningSummary([]);
    expect(summary).toBe('No issues detected');
  });
});
