import { describe, it, expect } from 'vitest';
import {
  generateImportWarnings,
  groupWarningsBySeverity,
  groupWarningsByType,
  getWarningSummary,
  getWarningTypeLabel,
  getWarningTypeDescription,
} from '@/lib/import-warnings';
import type {
  ImportWarning,
  ImportWarningType,
  ImportWarningSeverity,
} from '@/lib/import-warnings';
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
    pins: [] as ImportedDesign['components'][0]['pins'],
  };
}

function makeNet(name: string, pinCount: number) {
  const pins: Array<{ componentRef: string; pinNumber: string }> = [];
  for (let i = 0; i < pinCount; i++) {
    pins.push({ componentRef: `U${String(i + 1)}`, pinNumber: String(i + 1) });
  }
  return { name, pins };
}

function makeWire(net?: string) {
  return {
    start: { x: 0, y: 0 },
    end: { x: 100, y: 100 },
    net,
  };
}

// ---------------------------------------------------------------------------
// KiCad-specific warnings
// ---------------------------------------------------------------------------

describe('generateImportWarnings — KiCad', () => {
  it('warns about 3D model references', () => {
    const design = makeDesign({
      components: [makeComponent('U1', 'ATmega328P', 'DIP-28', { ki_3dmodel: 'Housings_DIP/DIP-28.wrl' })],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const model3d = warnings.find((w) => w.detail.includes('3D model'));
    expect(model3d).toBeDefined();
    expect(model3d!.type).toBe('dropped');
    expect(model3d!.entity).toBe('U1');
    expect(model3d!.severity).toBe('info');
  });

  it('warns about 3D model references using 3d_model key', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor', 'R0805', { '3d_model': 'R_0805.step' })],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('3D model') && w.entity === 'R1')).toBe(true);
  });

  it('warns about custom footprint library references', () => {
    const design = makeDesign({
      components: [makeComponent('U1', 'ESP32', 'QFN-48', { Footprint: 'MyLib:ESP32-QFN48' })],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const fpWarning = warnings.find((w) => w.detail.includes('footprint library'));
    expect(fpWarning).toBeDefined();
    expect(fpWarning!.type).toBe('unsupported');
    expect(fpWarning!.severity).toBe('warning');
  });

  it('warns about ki_fp_lib references', () => {
    const design = makeDesign({
      components: [makeComponent('C1', 'Cap', 'C0402', { ki_fp_lib: 'custom:C_0402' })],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('footprint library'))).toBe(true);
  });

  it('warns about symbol library references', () => {
    const design = makeDesign({
      components: [makeComponent('U1', 'LM7805', 'TO-220', { ki_sym_lib: 'Regulator_Linear' })],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('Symbol library'))).toBe(true);
  });

  it('warns about page/title block settings', () => {
    const design = makeDesign({ metadata: { page_size: 'A4' } });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('page/title block'))).toBe(true);
  });

  it('warns about power flags', () => {
    const design = makeDesign({ metadata: { power_flags: '3' } });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('power flag') && w.type === 'converted')).toBe(true);
  });

  it('does not generate KiCad warnings for non-KiCad formats', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      components: [makeComponent('U1', 'IC', 'DIP-8', { ki_3dmodel: 'test.wrl' })],
    });
    const warnings = generateImportWarnings(design, 'eagle-schematic');
    // Should NOT have KiCad 3D model warning (but may have generic unknown-property warning).
    expect(warnings.some((w) => w.detail.includes('3D model reference dropped'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EAGLE-specific warnings
// ---------------------------------------------------------------------------

describe('generateImportWarnings — EAGLE', () => {
  it('warns about ULP script references', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      components: [makeComponent('U1', 'IC', 'DIP-8', { ulp_script: 'bom.ulp' })],
    });
    const warnings = generateImportWarnings(design, 'eagle-schematic');
    const ulpWarning = warnings.find((w) => w.detail.includes('ULP script'));
    expect(ulpWarning).toBeDefined();
    expect(ulpWarning!.type).toBe('unsupported');
    expect(ulpWarning!.severity).toBe('warning');
  });

  it('warns about ULP references using uppercase key', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      components: [makeComponent('U1', 'IC', 'DIP-8', { ULP: 'autoroute.ulp' })],
    });
    const warnings = generateImportWarnings(design, 'eagle-schematic');
    expect(warnings.some((w) => w.detail.includes('ULP script'))).toBe(true);
  });

  it('warns about board variants', () => {
    const design = makeDesign({
      format: 'eagle-board',
      components: [makeComponent('R1', 'Resistor', 'R0805', { variant: 'production' })],
    });
    const warnings = generateImportWarnings(design, 'eagle-board');
    const variantWarning = warnings.find((w) => w.detail.includes('variant'));
    expect(variantWarning).toBeDefined();
    expect(variantWarning!.type).toBe('dropped');
    expect(variantWarning!.severity).toBe('warning');
  });

  it('warns about technology attributes', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      components: [makeComponent('U1', 'IC', 'DIP-8', { technology: 'CMOS' })],
    });
    const warnings = generateImportWarnings(design, 'eagle-schematic');
    expect(warnings.some((w) => w.detail.includes('Technology attribute'))).toBe(true);
  });

  it('warns about EAGLE design rules', () => {
    const design = makeDesign({
      format: 'eagle-board',
      metadata: { drc_rules: 'embedded' },
    });
    const warnings = generateImportWarnings(design, 'eagle-board');
    expect(warnings.some((w) => w.detail.includes('design rules'))).toBe(true);
  });

  it('warns about supply layers', () => {
    const design = makeDesign({
      format: 'eagle-schematic',
      metadata: { supply_layers: 'VCC,GND' },
    });
    const warnings = generateImportWarnings(design, 'eagle-schematic');
    expect(warnings.some((w) => w.detail.includes('supply layers') && w.type === 'converted')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Altium-specific warnings
// ---------------------------------------------------------------------------

describe('generateImportWarnings — Altium', () => {
  it('warns about ComponentKind', () => {
    const design = makeDesign({
      format: 'altium-schematic',
      components: [makeComponent('U1', 'STM32', 'QFP-48', { ComponentKind: 'Standard' })],
    });
    const warnings = generateImportWarnings(design, 'altium-schematic');
    expect(warnings.some((w) => w.detail.includes('ComponentKind'))).toBe(true);
  });

  it('warns about Vault references', () => {
    const design = makeDesign({
      format: 'altium-pcb',
      components: [makeComponent('C1', 'Cap', 'C0402', { VaultGUID: 'abc-123' })],
    });
    const warnings = generateImportWarnings(design, 'altium-pcb');
    const vaultWarning = warnings.find((w) => w.detail.includes('Vault'));
    expect(vaultWarning).toBeDefined();
    expect(vaultWarning!.type).toBe('dropped');
    expect(vaultWarning!.severity).toBe('warning');
  });

  it('warns about room definitions', () => {
    const design = makeDesign({
      format: 'altium-schematic',
      metadata: { rooms: 'Room1,Room2' },
    });
    const warnings = generateImportWarnings(design, 'altium-schematic');
    expect(warnings.some((w) => w.detail.includes('room definitions'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Generic / cross-format warnings
// ---------------------------------------------------------------------------

describe('generateImportWarnings — Generic', () => {
  it('warns about unknown properties', () => {
    const design = makeDesign({
      components: [makeComponent('U1', 'IC', 'DIP-8', { CustomAttr: 'hello', FancyParam: '42' })],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const unknownWarning = warnings.find((w) => w.detail.includes('Unknown properties'));
    expect(unknownWarning).toBeDefined();
    expect(unknownWarning!.type).toBe('dropped');
    expect(unknownWarning!.detail).toContain('CustomAttr');
    expect(unknownWarning!.detail).toContain('FancyParam');
  });

  it('warns about components with no package', () => {
    const design = makeDesign({
      components: [makeComponent('U1', 'IC', '')],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('No package/footprint'))).toBe(true);
  });

  it('warns about components with no pins', () => {
    const design = makeDesign({
      components: [makeComponent('U1', 'IC', 'DIP-8')],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('No pin definitions'))).toBe(true);
  });

  it('warns about non-numeric property values in numeric fields', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor', 'R0805', { Tolerance: 'high' })],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('non-numeric'))).toBe(true);
  });

  it('does not warn about valid numeric Tolerance', () => {
    const design = makeDesign({
      components: [makeComponent('R1', 'Resistor', 'R0805', { Tolerance: '5%' })],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('non-numeric') && w.detail.includes('Tolerance'))).toBe(false);
  });

  it('warns about dangling nets (single pin)', () => {
    const design = makeDesign({
      nets: [makeNet('DANGLING', 1)],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('1 pin') && w.entity === 'Net: DANGLING')).toBe(true);
  });

  it('does not warn about nets with 2+ pins', () => {
    const design = makeDesign({
      nets: [makeNet('VCC', 3)],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.entity === 'Net: VCC')).toBe(false);
  });

  it('warns about wires without net assignment', () => {
    const design = makeDesign({
      wires: [makeWire(), makeWire(), makeWire('GND')],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const wireWarning = warnings.find((w) => w.detail.includes('without net assignment'));
    expect(wireWarning).toBeDefined();
    expect(wireWarning!.entity).toBe('2 wire(s)');
    expect(wireWarning!.type).toBe('approximated');
  });

  it('does not warn when all wires have net assignments', () => {
    const design = makeDesign({
      wires: [makeWire('GND'), makeWire('VCC')],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail.includes('without net assignment'))).toBe(false);
  });

  it('warns about unsupported features from metadata', () => {
    const design = makeDesign({
      metadata: { unsupported_features: 'hierarchical sheets, bus aliases' },
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.entity === 'hierarchical sheets' && w.type === 'unsupported')).toBe(true);
    expect(warnings.some((w) => w.entity === 'bus aliases' && w.type === 'unsupported')).toBe(true);
  });

  it('propagates design-level warnings as info', () => {
    const design = makeDesign({
      warnings: ['Minor parse issue in line 42'],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail === 'Minor parse issue in line 42' && w.severity === 'info')).toBe(true);
  });

  it('propagates design-level errors as error severity', () => {
    const design = makeDesign({
      errors: ['Failed to parse symbol definition'],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings.some((w) => w.detail === 'Failed to parse symbol definition' && w.severity === 'error')).toBe(true);
  });

  it('returns empty array for a clean design with no issues', () => {
    const design = makeDesign({
      components: [{
        refDes: 'R1',
        name: 'Resistor',
        value: '10k',
        package: 'R0805',
        library: '',
        properties: { MPN: 'RC0805JR-0710KL' },
        pins: [
          { number: '1', name: 'A', type: 'passive' as const },
          { number: '2', name: 'B', type: 'passive' as const },
        ],
      }],
      nets: [makeNet('Net1', 2)],
      wires: [makeWire('Net1')],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    expect(warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// groupWarningsBySeverity
// ---------------------------------------------------------------------------

describe('groupWarningsBySeverity', () => {
  it('groups warnings correctly', () => {
    const warnings: ImportWarning[] = [
      { type: 'dropped', entity: 'A', detail: 'a', severity: 'error' },
      { type: 'dropped', entity: 'B', detail: 'b', severity: 'warning' },
      { type: 'dropped', entity: 'C', detail: 'c', severity: 'info' },
      { type: 'dropped', entity: 'D', detail: 'd', severity: 'info' },
    ];
    const groups = groupWarningsBySeverity(warnings);
    expect(groups.error).toHaveLength(1);
    expect(groups.warning).toHaveLength(1);
    expect(groups.info).toHaveLength(2);
  });

  it('returns empty arrays when no warnings', () => {
    const groups = groupWarningsBySeverity([]);
    expect(groups.error).toHaveLength(0);
    expect(groups.warning).toHaveLength(0);
    expect(groups.info).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// groupWarningsByType
// ---------------------------------------------------------------------------

describe('groupWarningsByType', () => {
  it('groups warnings correctly', () => {
    const warnings: ImportWarning[] = [
      { type: 'dropped', entity: 'A', detail: 'a', severity: 'info' },
      { type: 'unsupported', entity: 'B', detail: 'b', severity: 'warning' },
      { type: 'converted', entity: 'C', detail: 'c', severity: 'info' },
      { type: 'approximated', entity: 'D', detail: 'd', severity: 'warning' },
      { type: 'dropped', entity: 'E', detail: 'e', severity: 'error' },
    ];
    const groups = groupWarningsByType(warnings);
    expect(groups.dropped).toHaveLength(2);
    expect(groups.unsupported).toHaveLength(1);
    expect(groups.converted).toHaveLength(1);
    expect(groups.approximated).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getWarningSummary
// ---------------------------------------------------------------------------

describe('getWarningSummary', () => {
  it('returns "No issues detected" for empty array', () => {
    expect(getWarningSummary([])).toBe('No issues detected');
  });

  it('summarizes counts by severity', () => {
    const warnings: ImportWarning[] = [
      { type: 'dropped', entity: 'A', detail: 'a', severity: 'error' },
      { type: 'dropped', entity: 'B', detail: 'b', severity: 'error' },
      { type: 'dropped', entity: 'C', detail: 'c', severity: 'warning' },
      { type: 'dropped', entity: 'D', detail: 'd', severity: 'info' },
    ];
    const summary = getWarningSummary(warnings);
    expect(summary).toContain('2 error(s)');
    expect(summary).toContain('1 warning(s)');
    expect(summary).toContain('1 info');
  });

  it('omits zero-count severities', () => {
    const warnings: ImportWarning[] = [
      { type: 'dropped', entity: 'A', detail: 'a', severity: 'info' },
    ];
    const summary = getWarningSummary(warnings);
    expect(summary).not.toContain('error');
    expect(summary).not.toContain('warning');
    expect(summary).toBe('1 info');
  });
});

// ---------------------------------------------------------------------------
// getWarningTypeLabel / getWarningTypeDescription
// ---------------------------------------------------------------------------

describe('getWarningTypeLabel', () => {
  it('returns correct labels for all types', () => {
    expect(getWarningTypeLabel('dropped')).toBe('Dropped');
    expect(getWarningTypeLabel('unsupported')).toBe('Unsupported');
    expect(getWarningTypeLabel('converted')).toBe('Converted');
    expect(getWarningTypeLabel('approximated')).toBe('Approximated');
  });
});

describe('getWarningTypeDescription', () => {
  const types: ImportWarningType[] = ['dropped', 'unsupported', 'converted', 'approximated'];

  it('returns non-empty description for all types', () => {
    for (const t of types) {
      expect(getWarningTypeDescription(t).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Format routing
// ---------------------------------------------------------------------------

describe('generateImportWarnings — format routing', () => {
  it('applies KiCad-specific warnings for kicad-pcb', () => {
    const design = makeDesign({
      format: 'kicad-pcb',
      components: [makeComponent('U1', 'IC', 'DIP-8', { ki_3dmodel: 'model.wrl' })],
    });
    const warnings = generateImportWarnings(design, 'kicad-pcb');
    expect(warnings.some((w) => w.detail.includes('3D model reference dropped'))).toBe(true);
  });

  it('applies EAGLE-specific warnings for eagle-library', () => {
    const design = makeDesign({
      format: 'eagle-library',
      metadata: { design_rules: 'yes' },
    });
    const warnings = generateImportWarnings(design, 'eagle-library');
    expect(warnings.some((w) => w.detail.includes('design rules'))).toBe(true);
  });

  it('applies Altium-specific warnings for altium-pcb', () => {
    const design = makeDesign({
      format: 'altium-pcb',
      components: [makeComponent('U1', 'IC', 'DIP-8', { vault_guid: 'guid-xyz' })],
    });
    const warnings = generateImportWarnings(design, 'altium-pcb');
    expect(warnings.some((w) => w.detail.includes('Vault'))).toBe(true);
  });

  it('applies only generic warnings for gEDA', () => {
    const design = makeDesign({
      format: 'geda-schematic',
      components: [makeComponent('U1', 'IC', '')],
    });
    const warnings = generateImportWarnings(design, 'geda-schematic');
    // Generic: no package warning, no KiCad/EAGLE/Altium specific.
    expect(warnings.some((w) => w.detail.includes('No package/footprint'))).toBe(true);
  });

  it('applies only generic warnings for LTspice', () => {
    const design = makeDesign({
      format: 'ltspice-schematic',
      components: [makeComponent('R1', 'Resistor', '')],
    });
    const warnings = generateImportWarnings(design, 'ltspice-schematic');
    expect(warnings.some((w) => w.detail.includes('No package/footprint'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('generateImportWarnings — edge cases', () => {
  it('uses component name when refDes is empty', () => {
    const design = makeDesign({
      components: [makeComponent('', 'MyChip', 'DIP-8', { ki_3dmodel: 'model.wrl' })],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const model3d = warnings.find((w) => w.detail.includes('3D model'));
    expect(model3d!.entity).toBe('MyChip');
  });

  it('handles design with no components, nets, or wires', () => {
    const design = makeDesign();
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    // Should produce no warnings for a completely empty design.
    expect(warnings).toHaveLength(0);
  });

  it('handles multiple warning types on the same component', () => {
    const design = makeDesign({
      components: [makeComponent('U1', 'IC', '', {
        ki_3dmodel: 'model.wrl',
        ki_fp_lib: 'MyLib:Custom',
        WeirdProp: 'x',
      })],
    });
    const warnings = generateImportWarnings(design, 'kicad-schematic');
    const u1Warnings = warnings.filter((w) => w.entity === 'U1');
    // Should have: 3D model dropped, footprint unsupported, no package, no pins, unknown prop.
    expect(u1Warnings.length).toBeGreaterThanOrEqual(4);
  });
});
