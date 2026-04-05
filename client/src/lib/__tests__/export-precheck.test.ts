import { describe, it, expect } from 'vitest';
import { runExportPrecheck, getSupportedPrecheckFormats } from '../export-precheck';
import type { ExportPrecheck, PrecheckResult } from '../export-precheck';
import type { ProjectExportData } from '../export-validation';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeData(overrides: Partial<ProjectExportData> = {}): ProjectExportData {
  return {
    projectName: 'Test Project',
    hasSession: true,
    architectureNodeCount: 3,
    hasCircuitInstances: true,
    hasPcbLayout: true,
    bomItemCount: 5,
    bomItemsWithPartNumber: 5,
    hasCircuitSource: true,
    hasCircuitComponent: true,
    hasBoardProfile: true,
    bomItemsWithFailureData: 3,
    ...overrides,
  };
}

function findCheck(result: ExportPrecheck, name: string): PrecheckResult | undefined {
  return result.checks.find((c) => c.name === name);
}

function hasCheckWithStatus(result: ExportPrecheck, name: string, status: 'pass' | 'warn' | 'fail'): boolean {
  const c = findCheck(result, name);
  return c?.status === status;
}

// ---------------------------------------------------------------------------
// getSupportedPrecheckFormats
// ---------------------------------------------------------------------------

describe('getSupportedPrecheckFormats', () => {
  it('returns an array of format ids', () => {
    const formats = getSupportedPrecheckFormats();
    expect(formats.length).toBeGreaterThan(0);
    expect(formats).toContain('kicad');
    expect(formats).toContain('gerber');
    expect(formats).toContain('bom-csv');
    expect(formats).toContain('pdf');
    expect(formats).toContain('firmware');
  });

  it('includes all 18 registered formats', () => {
    const formats = getSupportedPrecheckFormats();
    expect(formats).toHaveLength(18);
    expect(formats).toContain('fab-package');
  });
});

// ---------------------------------------------------------------------------
// Common checks (auth, project name)
// ---------------------------------------------------------------------------

describe('common checks', () => {
  it('all formats include an authentication check', () => {
    const formats = getSupportedPrecheckFormats();
    for (const fmt of formats) {
      const result = runExportPrecheck(fmt, makeData());
      expect(findCheck(result, 'Authentication')).toBeDefined();
    }
  });

  it('fails authentication check when session is missing', () => {
    const result = runExportPrecheck('kicad', makeData({ hasSession: false }));
    expect(hasCheckWithStatus(result, 'Authentication', 'fail')).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.blockers).toContain('Not authenticated — export requires an active session.');
  });

  it('passes authentication check when session exists', () => {
    const result = runExportPrecheck('kicad', makeData());
    expect(hasCheckWithStatus(result, 'Authentication', 'pass')).toBe(true);
  });

  it('warns when project name is missing for most formats', () => {
    const result = runExportPrecheck('kicad', makeData({ projectName: null }));
    expect(hasCheckWithStatus(result, 'Project Name', 'warn')).toBe(true);
    expect(result.warnings).toContain('No project name set — files may have generic filenames.');
  });

  it('passes project name check when name is set', () => {
    const result = runExportPrecheck('kicad', makeData());
    expect(hasCheckWithStatus(result, 'Project Name', 'pass')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ExportPrecheck structure
// ---------------------------------------------------------------------------

describe('ExportPrecheck structure', () => {
  it('returns format id in result', () => {
    const result = runExportPrecheck('gerber', makeData());
    expect(result.format).toBe('gerber');
  });

  it('passed=true when no fail checks', () => {
    const result = runExportPrecheck('kicad', makeData());
    expect(result.passed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('passed=false when any fail check exists', () => {
    const result = runExportPrecheck('kicad', makeData({ hasSession: false }));
    expect(result.passed).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('warnings array matches warn-status checks', () => {
    const result = runExportPrecheck('firmware', makeData({ hasBoardProfile: false, architectureNodeCount: 0 }));
    expect(result.warnings.length).toBeGreaterThan(0);
    const warnMessages = result.checks
      .filter((c) => c.status === 'warn')
      .map((c) => c.message);
    expect(result.warnings).toEqual(warnMessages);
  });

  it('blockers array matches fail-status checks', () => {
    const result = runExportPrecheck('gerber', makeData({ hasPcbLayout: false, hasCircuitInstances: false }));
    const failMessages = result.checks
      .filter((c) => c.status === 'fail')
      .map((c) => c.message);
    expect(result.blockers).toEqual(failMessages);
  });
});

// ---------------------------------------------------------------------------
// Gerber format
// ---------------------------------------------------------------------------

describe('gerber precheck', () => {
  it('passes with full data', () => {
    const result = runExportPrecheck('gerber', makeData());
    expect(result.passed).toBe(true);
    expect(result.checks.every((c) => c.status === 'pass')).toBe(true);
  });

  it('fails when no PCB layout', () => {
    const result = runExportPrecheck('gerber', makeData({ hasPcbLayout: false }));
    expect(result.passed).toBe(false);
    expect(hasCheckWithStatus(result, 'PCB Layout', 'fail')).toBe(true);
  });

  it('fails when no circuit instances', () => {
    const result = runExportPrecheck('gerber', makeData({ hasCircuitInstances: false }));
    expect(result.passed).toBe(false);
    expect(hasCheckWithStatus(result, 'Circuit Instances', 'fail')).toBe(true);
  });

  it('includes 4 checks', () => {
    const result = runExportPrecheck('gerber', makeData());
    expect(result.checks).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Fab package format
// ---------------------------------------------------------------------------

describe('fab-package precheck', () => {
  it('passes with full data', () => {
    const result = runExportPrecheck('fab-package', makeData());
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'PCB Layout', 'pass')).toBe(true);
    expect(hasCheckWithStatus(result, 'BOM Items', 'pass')).toBe(true);
  });

  it('fails without PCB layout', () => {
    const result = runExportPrecheck('fab-package', makeData({ hasPcbLayout: false }));
    expect(result.passed).toBe(false);
    expect(hasCheckWithStatus(result, 'PCB Layout', 'fail')).toBe(true);
  });

  it('warns when part numbers are missing', () => {
    const result = runExportPrecheck('fab-package', makeData({ bomItemsWithPartNumber: 2 }));
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'Part Numbers', 'warn')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KiCad format
// ---------------------------------------------------------------------------

describe('kicad precheck', () => {
  it('passes with full data', () => {
    const result = runExportPrecheck('kicad', makeData());
    expect(result.passed).toBe(true);
  });

  it('fails when no circuit instances', () => {
    const result = runExportPrecheck('kicad', makeData({ hasCircuitInstances: false }));
    expect(result.passed).toBe(false);
    expect(hasCheckWithStatus(result, 'Circuit Instances', 'fail')).toBe(true);
  });

  it('warns when no architecture nodes', () => {
    const result = runExportPrecheck('kicad', makeData({ architectureNodeCount: 0 }));
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'Architecture Nodes', 'warn')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Eagle format
// ---------------------------------------------------------------------------

describe('eagle precheck', () => {
  it('passes with full data', () => {
    const result = runExportPrecheck('eagle', makeData());
    expect(result.passed).toBe(true);
  });

  it('fails without circuit instances', () => {
    const result = runExportPrecheck('eagle', makeData({ hasCircuitInstances: false }));
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SPICE format
// ---------------------------------------------------------------------------

describe('spice precheck', () => {
  it('passes with full data', () => {
    const result = runExportPrecheck('spice', makeData());
    expect(result.passed).toBe(true);
  });

  it('fails without circuit components', () => {
    const result = runExportPrecheck('spice', makeData({ hasCircuitComponent: false }));
    expect(result.passed).toBe(false);
    expect(hasCheckWithStatus(result, 'Circuit Components', 'fail')).toBe(true);
  });

  it('warns when no circuit source', () => {
    const result = runExportPrecheck('spice', makeData({ hasCircuitSource: false }));
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'Circuit Source', 'warn')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BOM CSV format
// ---------------------------------------------------------------------------

describe('bom-csv precheck', () => {
  it('passes with full data', () => {
    const result = runExportPrecheck('bom-csv', makeData());
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'Part Numbers', 'pass')).toBe(true);
  });

  it('fails with no BOM items', () => {
    const result = runExportPrecheck('bom-csv', makeData({ bomItemCount: 0, bomItemsWithPartNumber: 0 }));
    expect(result.passed).toBe(false);
    expect(hasCheckWithStatus(result, 'BOM Items', 'fail')).toBe(true);
  });

  it('warns when some part numbers missing', () => {
    const result = runExportPrecheck('bom-csv', makeData({ bomItemsWithPartNumber: 3 }));
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'Part Numbers', 'warn')).toBe(true);
    expect(findCheck(result, 'Part Numbers')?.message).toContain('2 of 5');
  });

  it('warns when zero part numbers but BOM exists', () => {
    const result = runExportPrecheck('bom-csv', makeData({ bomItemsWithPartNumber: 0 }));
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'Part Numbers', 'warn')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PDF format
// ---------------------------------------------------------------------------

describe('pdf precheck', () => {
  it('passes with any content', () => {
    const result = runExportPrecheck('pdf', makeData());
    expect(result.passed).toBe(true);
  });

  it('fails with no content', () => {
    const result = runExportPrecheck('pdf', makeData({
      architectureNodeCount: 0,
      bomItemCount: 0,
      hasCircuitInstances: false,
    }));
    expect(result.passed).toBe(false);
    expect(hasCheckWithStatus(result, 'Project Content', 'fail')).toBe(true);
  });

  it('passes with only architecture nodes', () => {
    const result = runExportPrecheck('pdf', makeData({
      bomItemCount: 0,
      bomItemsWithPartNumber: 0,
      hasCircuitInstances: false,
    }));
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Design Report (stricter than PDF)
// ---------------------------------------------------------------------------

describe('design-report precheck', () => {
  it('fails without project name', () => {
    const result = runExportPrecheck('design-report', makeData({ projectName: null }));
    expect(result.passed).toBe(false);
    expect(hasCheckWithStatus(result, 'Project Name', 'fail')).toBe(true);
  });

  it('fails without any content', () => {
    const result = runExportPrecheck('design-report', makeData({
      architectureNodeCount: 0,
      bomItemCount: 0,
      hasCircuitInstances: false,
    }));
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FMEA format
// ---------------------------------------------------------------------------

describe('fmea precheck', () => {
  it('passes with BOM and failure data', () => {
    const result = runExportPrecheck('fmea', makeData());
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'Failure Mode Data', 'pass')).toBe(true);
  });

  it('fails with no BOM items', () => {
    const result = runExportPrecheck('fmea', makeData({ bomItemCount: 0, bomItemsWithFailureData: 0, bomItemsWithPartNumber: 0 }));
    expect(result.passed).toBe(false);
    expect(hasCheckWithStatus(result, 'BOM Items', 'fail')).toBe(true);
  });

  it('warns when no failure mode data', () => {
    const result = runExportPrecheck('fmea', makeData({ bomItemsWithFailureData: 0 }));
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'Failure Mode Data', 'warn')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Firmware format
// ---------------------------------------------------------------------------

describe('firmware precheck', () => {
  it('passes with full data', () => {
    const result = runExportPrecheck('firmware', makeData());
    expect(result.passed).toBe(true);
  });

  it('warns without board profile', () => {
    const result = runExportPrecheck('firmware', makeData({ hasBoardProfile: false }));
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'Board Profile', 'warn')).toBe(true);
  });

  it('warns without architecture nodes', () => {
    const result = runExportPrecheck('firmware', makeData({ architectureNodeCount: 0 }));
    expect(result.passed).toBe(true);
    expect(hasCheckWithStatus(result, 'Architecture Nodes', 'warn')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Netlist formats
// ---------------------------------------------------------------------------

describe('netlist precheck', () => {
  it('csv and kicad formats pass with instances', () => {
    const csv = runExportPrecheck('netlist-csv', makeData());
    const kicad = runExportPrecheck('netlist-kicad', makeData());
    expect(csv.passed).toBe(true);
    expect(kicad.passed).toBe(true);
  });

  it('fails without circuit instances', () => {
    const result = runExportPrecheck('netlist-csv', makeData({ hasCircuitInstances: false }));
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PCB fabrication formats (pick-place, ODB++, IPC-2581, etchable-pcb)
// ---------------------------------------------------------------------------

describe('pcb fabrication formats', () => {
  const formats = ['pick-place', 'odb-plus-plus', 'ipc2581', 'etchable-pcb'];

  for (const fmt of formats) {
    it(`${fmt} passes with PCB layout`, () => {
      const result = runExportPrecheck(fmt, makeData());
      expect(result.passed).toBe(true);
    });

    it(`${fmt} fails without PCB layout`, () => {
      const result = runExportPrecheck(fmt, makeData({ hasPcbLayout: false }));
      expect(result.passed).toBe(false);
      expect(hasCheckWithStatus(result, 'PCB Layout', 'fail')).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// STEP 3D format
// ---------------------------------------------------------------------------

describe('step precheck', () => {
  it('passes with PCB layout', () => {
    const result = runExportPrecheck('step', makeData());
    expect(result.passed).toBe(true);
  });

  it('fails without PCB layout', () => {
    const result = runExportPrecheck('step', makeData({ hasPcbLayout: false }));
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FZZ (Fritzing) format
// ---------------------------------------------------------------------------

describe('fzz precheck', () => {
  it('passes with circuit instances', () => {
    const result = runExportPrecheck('fzz', makeData());
    expect(result.passed).toBe(true);
  });

  it('passes with only architecture nodes', () => {
    const result = runExportPrecheck('fzz', makeData({ hasCircuitInstances: false }));
    expect(result.passed).toBe(true);
  });

  it('fails with no circuit or architecture data', () => {
    const result = runExportPrecheck('fzz', makeData({ hasCircuitInstances: false, architectureNodeCount: 0 }));
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unknown format
// ---------------------------------------------------------------------------

describe('unknown format', () => {
  it('returns a result with a warning for unknown format', () => {
    const result = runExportPrecheck('nonexistent-format', makeData());
    expect(result.passed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('Unknown export format'))).toBe(true);
  });

  it('still checks auth for unknown format', () => {
    const result = runExportPrecheck('unknown', makeData({ hasSession: false }));
    expect(result.passed).toBe(false);
    expect(hasCheckWithStatus(result, 'Authentication', 'fail')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('single architecture node uses singular grammar', () => {
    const result = runExportPrecheck('kicad', makeData({ architectureNodeCount: 1 }));
    const archCheck = findCheck(result, 'Architecture Nodes');
    expect(archCheck?.message).toContain('1 architecture node found.');
  });

  it('single BOM item uses singular grammar', () => {
    const result = runExportPrecheck('bom-csv', makeData({ bomItemCount: 1, bomItemsWithPartNumber: 1 }));
    const bomCheck = findCheck(result, 'BOM Items');
    expect(bomCheck?.message).toContain('1 BOM item found.');
  });

  it('single missing part number uses singular grammar', () => {
    const result = runExportPrecheck('bom-csv', makeData({ bomItemCount: 2, bomItemsWithPartNumber: 1 }));
    const pnCheck = findCheck(result, 'Part Numbers');
    expect(pnCheck?.message).toContain('1 of 2 BOM item is missing');
  });

  it('multiple missing part numbers use plural grammar', () => {
    const result = runExportPrecheck('bom-csv', makeData({ bomItemCount: 5, bomItemsWithPartNumber: 2 }));
    const pnCheck = findCheck(result, 'Part Numbers');
    expect(pnCheck?.message).toContain('3 of 5 BOM items are missing');
  });

  it('empty project name as empty string treated same as null', () => {
    const result = runExportPrecheck('kicad', makeData({ projectName: '' }));
    expect(hasCheckWithStatus(result, 'Project Name', 'warn')).toBe(true);
  });

  it('project name as undefined treated same as null', () => {
    const result = runExportPrecheck('kicad', makeData({ projectName: undefined }));
    expect(hasCheckWithStatus(result, 'Project Name', 'warn')).toBe(true);
  });

  it('multiple failures accumulate in blockers', () => {
    const result = runExportPrecheck('gerber', makeData({
      hasSession: false,
      hasPcbLayout: false,
      hasCircuitInstances: false,
    }));
    expect(result.passed).toBe(false);
    expect(result.blockers).toHaveLength(3);
  });
});
