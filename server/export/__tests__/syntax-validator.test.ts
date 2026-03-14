import { describe, it, expect } from 'vitest';
import {
  validateGerberSyntax,
  validateDrillSyntax,
  validateIpc2581Syntax,
  validateOdbSyntax,
} from '../syntax-validator';

// ---------------------------------------------------------------------------
// Helpers — minimal valid file content for each format
// ---------------------------------------------------------------------------

function minimalGerber(): string {
  return [
    'G04 ProtoPulse EDA - Test Layer*',
    '%FSLAX36Y36*%',
    '%MOMM*%',
    '%TF.GenerationSoftware,ProtoPulse,EDA,1.0*%',
    '%TF.FileFunction,Copper,L1,Top*%',
    '%TF.FilePolarity,Positive*%',
    '%ADD10C,0.250000*%',
    '%ADD11R,1.600000X1.600000*%',
    'X5000000Y3000000D02*',
    'X10000000Y3000000D01*',
    'X7000000Y5000000D03*',
    'M02*',
  ].join('\n');
}

function minimalDrill(): string {
  return [
    'M48',
    'FMAT,2',
    'METRIC,TZ',
    'T1C0.800',
    '%',
    'T1',
    'X5000Y3000',
    'X7000Y5000',
    'M30',
  ].join('\n');
}

function minimalIpc2581(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<IPC-2581 revision="B" xmlns="http://webstds.ipc.org/2581">',
    '',
    '  <Ecad name="TestProject">',
    '    <CadHeader units="MILLIMETER"/>',
    '    <CadData>',
    '      <Step name="pcb"/>',
    '    </CadData>',
    '  </Ecad>',
    '',
    '  <Content>',
    '    <FunctionMode mode="FABRICATION"/>',
    '  </Content>',
    '',
    '  <LogicalNet>',
    '    <Net name="VCC" type="power">',
    '      <PinRef componentRef="U1" pin="1"/>',
    '    </Net>',
    '  </LogicalNet>',
    '',
    '  <PhysicalNet>',
    '    <Component refDes="U1" packageRef="DIP-8" layerRef="TOP">',
    '      <Location x="10.0000" y="20.0000" rotation="0.0"/>',
    '    </Component>',
    '  </PhysicalNet>',
    '',
    '  <Bom>',
    '    <BomItem>',
    '      <PartNumber>ATmega328P</PartNumber>',
    '    </BomItem>',
    '  </Bom>',
    '',
    '</IPC-2581>',
    '',
  ].join('\n');
}

function minimalOdbFilePaths(): string[] {
  return [
    'matrix/matrix',
    'misc/info',
    'steps/pcb/layers/comp_+_top/features',
    'steps/pcb/layers/comp_+_bot/features',
    'steps/pcb/layers/solder_mask_top/features',
    'steps/pcb/layers/solder_mask_bot/features',
    'steps/pcb/layers/silk_screen_top/features',
    'steps/pcb/layers/silk_screen_bot/features',
    'steps/pcb/layers/drill/features',
    'steps/pcb/eda/data',
  ];
}

function minimalOdbMatrix(): string {
  return [
    'UNITS=MM',
    '',
    'STEP {',
    '   COL=1',
    '   NAME=comp_+_top',
    '   TYPE=SIGNAL',
    '   POLARITY=POSITIVE',
    '   CONTEXT=BOARD',
    '}',
    '',
    'STEP {',
    '   COL=2',
    '   NAME=comp_+_bot',
    '   TYPE=SIGNAL',
    '   POLARITY=POSITIVE',
    '   CONTEXT=BOARD',
    '}',
    '',
  ].join('\n');
}

// ===========================================================================
// validateGerberSyntax
// ===========================================================================

describe('validateGerberSyntax', () => {
  it('passes for a valid minimal Gerber file', () => {
    const result = validateGerberSyntax(minimalGerber());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error for empty content', () => {
    const result = validateGerberSyntax('');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/empty/i);
  });

  it('returns error for whitespace-only content', () => {
    const result = validateGerberSyntax('   \n  \n  ');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/empty/i);
  });

  it('returns error when %FSLAX header is missing', () => {
    const content = minimalGerber().replace('%FSLAX36Y36*%', '');
    const result = validateGerberSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('%FSLAX'))).toBe(true);
  });

  it('returns error when %MOMM header is missing', () => {
    const content = minimalGerber().replace('%MOMM*%', '');
    const result = validateGerberSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('unit mode'))).toBe(true);
  });

  it('accepts %MOIN*% as valid unit mode', () => {
    const content = minimalGerber().replace('%MOMM*%', '%MOIN*%');
    const result = validateGerberSyntax(content);
    expect(result.errors.some((e) => e.message.includes('unit mode'))).toBe(false);
  });

  it('returns error when no aperture definitions exist', () => {
    const content = minimalGerber()
      .replace('%ADD10C,0.250000*%', '')
      .replace('%ADD11R,1.600000X1.600000*%', '');
    const result = validateGerberSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('aperture'))).toBe(true);
  });

  it('returns error when no D-code operations exist', () => {
    const content = [
      'G04 Test*',
      '%FSLAX36Y36*%',
      '%MOMM*%',
      '%ADD10C,0.250000*%',
      'M02*',
    ].join('\n');
    const result = validateGerberSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('D01/D02/D03'))).toBe(true);
  });

  it('returns error when M02* end marker is missing', () => {
    const content = minimalGerber().replace('M02*', '');
    const result = validateGerberSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('M02*'))).toBe(true);
  });

  it('returns error for unmatched % delimiters', () => {
    const content = minimalGerber() + '\n%BROKEN';
    const result = validateGerberSyntax(content);
    // The extra % makes count odd
    expect(result.errors.some((e) => e.message.includes('Unmatched %'))).toBe(true);
  });

  it('warns when G04 comment is missing', () => {
    const content = minimalGerber().replace('G04 ProtoPulse EDA - Test Layer*', '');
    const result = validateGerberSyntax(content);
    expect(result.warnings.some((w) => w.message.includes('G04'))).toBe(true);
  });

  it('warns when TF attributes are missing', () => {
    let content = minimalGerber();
    content = content.replace('%TF.GenerationSoftware,ProtoPulse,EDA,1.0*%', '');
    content = content.replace('%TF.FileFunction,Copper,L1,Top*%', '');
    content = content.replace('%TF.FilePolarity,Positive*%', '');
    const result = validateGerberSyntax(content);
    expect(result.warnings.some((w) => w.message.includes('TF'))).toBe(true);
  });

  it('warns on extremely large coordinate values', () => {
    const content = [
      'G04 Test*',
      '%FSLAX36Y36*%',
      '%MOMM*%',
      '%ADD10C,0.250000*%',
      'X9999999999Y9999999999D03*',
      'M02*',
    ].join('\n');
    const result = validateGerberSyntax(content);
    expect(result.warnings.some((w) => w.message.includes('extremely large'))).toBe(true);
  });

  it('does not warn on normal coordinate values', () => {
    const result = validateGerberSyntax(minimalGerber());
    expect(result.warnings.some((w) => w.message.includes('extremely large'))).toBe(false);
  });

  it('reports multiple errors simultaneously', () => {
    const content = 'just some text\nwithout any gerber structure\n';
    const result = validateGerberSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('treats D1* the same as D01*', () => {
    const content = [
      'G04 Test*',
      '%FSLAX36Y36*%',
      '%MOMM*%',
      '%ADD10C,0.250000*%',
      'X5000000Y3000000D2*',
      'X10000000Y3000000D1*',
      'M02*',
    ].join('\n');
    const result = validateGerberSyntax(content);
    expect(result.errors.some((e) => e.message.includes('D01/D02/D03'))).toBe(false);
  });
});

// ===========================================================================
// validateDrillSyntax
// ===========================================================================

describe('validateDrillSyntax', () => {
  it('passes for a valid minimal drill file', () => {
    const result = validateDrillSyntax(minimalDrill());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error for empty content', () => {
    const result = validateDrillSyntax('');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/empty/i);
  });

  it('returns error when M48 header is missing', () => {
    const content = minimalDrill().replace('M48', 'SOMETHING');
    const result = validateDrillSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('M48'))).toBe(true);
  });

  it('returns error when % end-of-header is missing', () => {
    const content = minimalDrill().replace('%', '');
    const result = validateDrillSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('end-of-header'))).toBe(true);
  });

  it('returns error when no tool definitions exist', () => {
    const content = [
      'M48',
      'FMAT,2',
      'METRIC,TZ',
      '%',
      'M30',
    ].join('\n');
    const result = validateDrillSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('tool definitions'))).toBe(true);
  });

  it('returns error for tool with zero diameter', () => {
    const content = minimalDrill().replace('T1C0.800', 'T1C0.000');
    const result = validateDrillSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('invalid diameter'))).toBe(true);
  });

  it('warns for tool with unusually large diameter', () => {
    const content = minimalDrill().replace('T1C0.800', 'T1C15.000');
    const result = validateDrillSyntax(content);
    expect(result.warnings.some((w) => w.message.includes('unusually large'))).toBe(true);
  });

  it('returns error when M30 end marker is missing', () => {
    const content = minimalDrill().replace('M30', '');
    const result = validateDrillSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('M30'))).toBe(true);
  });

  it('returns error when selected tool is not defined', () => {
    const content = [
      'M48',
      'FMAT,2',
      'METRIC,TZ',
      'T1C0.800',
      '%',
      'T2',
      'X5000Y3000',
      'M30',
    ].join('\n');
    const result = validateDrillSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('T2') && e.message.includes('not defined'))).toBe(true);
  });

  it('warns when a defined tool is never selected', () => {
    const content = [
      'M48',
      'FMAT,2',
      'METRIC,TZ',
      'T1C0.800',
      'T2C1.000',
      '%',
      'T1',
      'X5000Y3000',
      'M30',
    ].join('\n');
    const result = validateDrillSyntax(content);
    expect(result.warnings.some((w) => w.message.includes('T2') && w.message.includes('never selected'))).toBe(true);
  });

  it('warns when FMAT is missing', () => {
    const content = minimalDrill().replace('FMAT,2', '');
    const result = validateDrillSyntax(content);
    expect(result.warnings.some((w) => w.message.includes('FMAT'))).toBe(true);
  });

  it('warns when METRIC/INCH is missing', () => {
    const content = minimalDrill().replace('METRIC,TZ', '');
    const result = validateDrillSyntax(content);
    expect(result.warnings.some((w) => w.message.includes('METRIC') || w.message.includes('INCH'))).toBe(true);
  });

  it('warns when file has tools but no coordinates', () => {
    const content = [
      'M48',
      'FMAT,2',
      'METRIC,TZ',
      'T1C0.800',
      '%',
      'T1',
      'M30',
    ].join('\n');
    const result = validateDrillSyntax(content);
    expect(result.warnings.some((w) => w.message.includes('no drill hits'))).toBe(true);
  });

  it('handles multiple tool definitions correctly', () => {
    const content = [
      'M48',
      'FMAT,2',
      'METRIC,TZ',
      'T1C0.800',
      'T2C1.000',
      'T3C1.200',
      '%',
      'T1',
      'X5000Y3000',
      'T2',
      'X7000Y5000',
      'T3',
      'X9000Y7000',
      'M30',
    ].join('\n');
    const result = validateDrillSyntax(content);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports multiple errors simultaneously', () => {
    const content = 'random text\nwith no drill structure\n';
    const result = validateDrillSyntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('accepts INCH as valid unit', () => {
    const content = minimalDrill().replace('METRIC,TZ', 'INCH,TZ');
    const result = validateDrillSyntax(content);
    expect(result.warnings.some((w) => w.message.includes('METRIC') && w.message.includes('INCH'))).toBe(false);
  });
});

// ===========================================================================
// validateIpc2581Syntax
// ===========================================================================

describe('validateIpc2581Syntax', () => {
  it('passes for a valid minimal IPC-2581 file', () => {
    const result = validateIpc2581Syntax(minimalIpc2581());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error for empty content', () => {
    const result = validateIpc2581Syntax('');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/empty/i);
  });

  it('returns error when XML declaration is missing', () => {
    const content = minimalIpc2581().replace('<?xml version="1.0" encoding="UTF-8"?>', '');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('XML declaration'))).toBe(true);
  });

  it('returns error when root <IPC-2581> element is missing', () => {
    const content = minimalIpc2581()
      .replace('<IPC-2581 revision="B" xmlns="http://webstds.ipc.org/2581">', '<Root>')
      .replace('</IPC-2581>', '</Root>');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('<IPC-2581>'))).toBe(true);
  });

  it('returns error when closing </IPC-2581> tag is missing', () => {
    const content = minimalIpc2581().replace('</IPC-2581>', '');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('</IPC-2581>'))).toBe(true);
  });

  it('returns error when revision attribute is missing', () => {
    const content = minimalIpc2581().replace(' revision="B"', '');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('revision'))).toBe(true);
  });

  it('returns error when Content section is missing', () => {
    const content = minimalIpc2581()
      .replace('  <Content>', '')
      .replace('    <FunctionMode mode="FABRICATION"/>', '')
      .replace('  </Content>', '');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('<Content>'))).toBe(true);
  });

  it('returns error when LogicalNet section is missing', () => {
    const content = minimalIpc2581()
      .replace(/<LogicalNet>[\s\S]*?<\/LogicalNet>/m, '');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('<LogicalNet>'))).toBe(true);
  });

  it('returns error when PhysicalNet section is missing', () => {
    const content = minimalIpc2581()
      .replace(/<PhysicalNet>[\s\S]*?<\/PhysicalNet>/m, '');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('<PhysicalNet>'))).toBe(true);
  });

  it('returns error when Bom section is missing', () => {
    const content = minimalIpc2581()
      .replace(/<Bom>[\s\S]*?<\/Bom>/m, '');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('<Bom>'))).toBe(true);
  });

  it('returns error when Ecad section is missing', () => {
    const content = minimalIpc2581()
      .replace(/<Ecad[\s\S]*?<\/Ecad>/m, '');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('<Ecad>'))).toBe(true);
  });

  it('returns error for unclosed section tag', () => {
    const content = minimalIpc2581().replace('</Bom>', '');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('<Bom>') && e.message.includes('never closed'))).toBe(true);
  });

  it('returns error for unbalanced angle brackets', () => {
    const content = minimalIpc2581() + '<unclosed';
    const result = validateIpc2581Syntax(content);
    expect(result.errors.some((e) => e.message.includes('Unbalanced angle brackets'))).toBe(true);
  });

  it('warns when xmlns namespace is missing', () => {
    const content = minimalIpc2581().replace(' xmlns="http://webstds.ipc.org/2581"', '');
    const result = validateIpc2581Syntax(content);
    expect(result.warnings.some((w) => w.message.includes('xmlns'))).toBe(true);
  });

  it('warns on empty sections', () => {
    const content = minimalIpc2581()
      .replace(/<Bom>[\s\S]*?<\/Bom>/m, '<Bom>\n  </Bom>');
    const result = validateIpc2581Syntax(content);
    expect(result.warnings.some((w) => w.message.includes('<Bom>') && w.message.includes('empty'))).toBe(true);
  });

  it('does not warn on sections with comments only as empty', () => {
    // Comments inside a section should still trigger the empty warning
    // since there's no real content
    const content = minimalIpc2581()
      .replace(/<Bom>[\s\S]*?<\/Bom>/m, '<Bom>\n  <!-- No BOM items -->\n  </Bom>');
    const result = validateIpc2581Syntax(content);
    expect(result.warnings.some((w) => w.message.includes('<Bom>') && w.message.includes('empty'))).toBe(true);
  });

  it('reports multiple missing sections', () => {
    const content = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<IPC-2581 revision="B" xmlns="http://webstds.ipc.org/2581">',
      '</IPC-2581>',
    ].join('\n');
    const result = validateIpc2581Syntax(content);
    expect(result.valid).toBe(false);
    // All 5 required sections should be flagged
    expect(result.errors.filter((e) => e.message.includes('Missing required')).length).toBe(5);
  });
});

// ===========================================================================
// validateOdbSyntax
// ===========================================================================

describe('validateOdbSyntax', () => {
  it('passes for valid file paths', () => {
    const result = validateOdbSyntax(minimalOdbFilePaths());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes for valid file paths with matrix content', () => {
    const result = validateOdbSyntax(minimalOdbFilePaths(), minimalOdbMatrix());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error for empty file list', () => {
    const result = validateOdbSyntax([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/no files/i);
  });

  it('returns error when matrix/matrix is missing', () => {
    const paths = minimalOdbFilePaths().filter((p) => p !== 'matrix/matrix');
    const result = validateOdbSyntax(paths);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('matrix/matrix'))).toBe(true);
  });

  it('returns error when misc/info is missing', () => {
    const paths = minimalOdbFilePaths().filter((p) => p !== 'misc/info');
    const result = validateOdbSyntax(paths);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('misc/info'))).toBe(true);
  });

  it('returns error when steps/pcb/eda/data is missing', () => {
    const paths = minimalOdbFilePaths().filter((p) => p !== 'steps/pcb/eda/data');
    const result = validateOdbSyntax(paths);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('steps/pcb/eda/data'))).toBe(true);
  });

  it('returns error when no layer files exist', () => {
    const paths = minimalOdbFilePaths().filter((p) => !p.startsWith('steps/pcb/layers/'));
    const result = validateOdbSyntax(paths);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('No layer feature files'))).toBe(true);
  });

  it('warns on missing standard layers', () => {
    const paths = [
      'matrix/matrix',
      'misc/info',
      'steps/pcb/layers/comp_+_top/features',
      'steps/pcb/eda/data',
    ];
    const result = validateOdbSyntax(paths);
    expect(result.valid).toBe(true); // Still valid, just warnings
    expect(result.warnings.some((w) => w.message.includes('comp_+_bot'))).toBe(true);
    expect(result.warnings.some((w) => w.message.includes('drill'))).toBe(true);
  });

  it('returns error when matrix content has no UNITS', () => {
    const matrix = minimalOdbMatrix().replace('UNITS=MM', '');
    const result = validateOdbSyntax(minimalOdbFilePaths(), matrix);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('UNITS'))).toBe(true);
  });

  it('returns error when matrix content has no STEP blocks', () => {
    const matrix = 'UNITS=MM\n\n';
    const result = validateOdbSyntax(minimalOdbFilePaths(), matrix);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('STEP blocks'))).toBe(true);
  });

  it('warns when STEP block is missing NAME field', () => {
    const matrix = [
      'UNITS=MM',
      '',
      'STEP {',
      '   COL=1',
      '   TYPE=SIGNAL',
      '}',
    ].join('\n');
    const result = validateOdbSyntax(minimalOdbFilePaths(), matrix);
    expect(result.warnings.some((w) => w.message.includes('NAME'))).toBe(true);
  });

  it('warns when STEP block is missing TYPE field', () => {
    const matrix = [
      'UNITS=MM',
      '',
      'STEP {',
      '   COL=1',
      '   NAME=comp_+_top',
      '}',
    ].join('\n');
    const result = validateOdbSyntax(minimalOdbFilePaths(), matrix);
    expect(result.warnings.some((w) => w.message.includes('TYPE'))).toBe(true);
  });

  it('returns error for unclosed STEP block', () => {
    const matrix = [
      'UNITS=MM',
      '',
      'STEP {',
      '   COL=1',
      '   NAME=comp_+_top',
      '   TYPE=SIGNAL',
    ].join('\n');
    const result = validateOdbSyntax(minimalOdbFilePaths(), matrix);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Unclosed STEP block'))).toBe(true);
  });

  it('handles extra layer files beyond standard set without warnings', () => {
    const paths = [
      ...minimalOdbFilePaths(),
      'steps/pcb/layers/inner_layer_1/features',
      'steps/pcb/layers/inner_layer_2/features',
    ];
    const result = validateOdbSyntax(paths);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates multiple STEP blocks correctly', () => {
    const result = validateOdbSyntax(minimalOdbFilePaths(), minimalOdbMatrix());
    expect(result.valid).toBe(true);
    expect(result.warnings.filter((w) => w.message.includes('NAME') || w.message.includes('TYPE'))).toHaveLength(0);
  });
});

// ===========================================================================
// ValidationResult shape
// ===========================================================================

describe('ValidationResult shape', () => {
  it('always returns valid, errors, and warnings arrays', () => {
    const gerber = validateGerberSyntax(minimalGerber());
    expect(gerber).toHaveProperty('valid');
    expect(gerber).toHaveProperty('errors');
    expect(gerber).toHaveProperty('warnings');
    expect(Array.isArray(gerber.errors)).toBe(true);
    expect(Array.isArray(gerber.warnings)).toBe(true);

    const drill = validateDrillSyntax(minimalDrill());
    expect(drill).toHaveProperty('valid');
    expect(Array.isArray(drill.errors)).toBe(true);
    expect(Array.isArray(drill.warnings)).toBe(true);

    const ipc = validateIpc2581Syntax(minimalIpc2581());
    expect(ipc).toHaveProperty('valid');
    expect(Array.isArray(ipc.errors)).toBe(true);
    expect(Array.isArray(ipc.warnings)).toBe(true);

    const odb = validateOdbSyntax(minimalOdbFilePaths());
    expect(odb).toHaveProperty('valid');
    expect(Array.isArray(odb.errors)).toBe(true);
    expect(Array.isArray(odb.warnings)).toBe(true);
  });

  it('valid is true only when errors is empty', () => {
    const valid = validateGerberSyntax(minimalGerber());
    expect(valid.valid).toBe(true);
    expect(valid.errors).toHaveLength(0);

    const invalid = validateGerberSyntax('');
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });

  it('each error has line, message, and severity fields', () => {
    const result = validateGerberSyntax('garbage');
    for (const error of result.errors) {
      expect(error).toHaveProperty('line');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('severity');
      expect(typeof error.message).toBe('string');
      expect(error.severity).toBe('error');
    }
    for (const warning of result.warnings) {
      expect(warning).toHaveProperty('line');
      expect(warning).toHaveProperty('message');
      expect(warning.severity).toBe('warning');
    }
  });
});
