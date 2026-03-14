import { describe, it, expect } from 'vitest';
import { validateExportPreflight, getSupportedExportFormats } from '../export-validation';
import type { ProjectExportData } from '../export-validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProjectData(overrides: Partial<ProjectExportData> = {}): ProjectExportData {
  return {
    projectName: 'Test Project',
    hasSession: true,
    architectureNodeCount: 5,
    hasCircuitInstances: true,
    hasPcbLayout: true,
    bomItemCount: 3,
    bomItemsWithPartNumber: 3,
    hasCircuitSource: true,
    hasCircuitComponent: true,
    hasBoardProfile: true,
    bomItemsWithFailureData: 2,
    ...overrides,
  };
}

function emptyProject(): ProjectExportData {
  return {
    projectName: null,
    hasSession: true,
    architectureNodeCount: 0,
    hasCircuitInstances: false,
    hasPcbLayout: false,
    bomItemCount: 0,
    bomItemsWithPartNumber: 0,
    hasCircuitSource: false,
    hasCircuitComponent: false,
    hasBoardProfile: false,
    bomItemsWithFailureData: 0,
  };
}

// ---------------------------------------------------------------------------
// Common checks
// ---------------------------------------------------------------------------

describe('validateExportPreflight', () => {
  describe('common checks', () => {
    it('warns when project has no name', () => {
      const result = validateExportPreflight('firmware', makeProjectData({ projectName: null }));
      expect(result.warnings.some((w) => w.includes('no name'))).toBe(true);
    });

    it('errors when not authenticated', () => {
      const result = validateExportPreflight('kicad', makeProjectData({ hasSession: false }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('authenticated'))).toBe(true);
    });

    it('passes when project is fully populated', () => {
      const result = validateExportPreflight('kicad', makeProjectData());
      expect(result.canExport).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // KiCad
  // -------------------------------------------------------------------------

  describe('kicad', () => {
    it('errors when no circuit instances', () => {
      const result = validateExportPreflight('kicad', makeProjectData({ hasCircuitInstances: false }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('circuit design'))).toBe(true);
    });

    it('warns when no architecture nodes', () => {
      const result = validateExportPreflight('kicad', makeProjectData({ architectureNodeCount: 0 }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('architecture'))).toBe(true);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('kicad', makeProjectData());
      expect(result.canExport).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Eagle
  // -------------------------------------------------------------------------

  describe('eagle', () => {
    it('errors when no circuit instances', () => {
      const result = validateExportPreflight('eagle', makeProjectData({ hasCircuitInstances: false }));
      expect(result.canExport).toBe(false);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('eagle', makeProjectData());
      expect(result.canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // SPICE
  // -------------------------------------------------------------------------

  describe('spice', () => {
    it('errors when no circuit components', () => {
      const result = validateExportPreflight('spice', makeProjectData({ hasCircuitComponent: false }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('component'))).toBe(true);
    });

    it('warns when no source', () => {
      const result = validateExportPreflight('spice', makeProjectData({ hasCircuitSource: false }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('source'))).toBe(true);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('spice', makeProjectData());
      expect(result.canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Gerber
  // -------------------------------------------------------------------------

  describe('gerber', () => {
    it('errors when no PCB layout', () => {
      const result = validateExportPreflight('gerber', makeProjectData({ hasPcbLayout: false }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('PCB'))).toBe(true);
    });

    it('errors when no circuit instances', () => {
      const result = validateExportPreflight('gerber', makeProjectData({ hasCircuitInstances: false }));
      expect(result.canExport).toBe(false);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('gerber', makeProjectData());
      expect(result.canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Pick-and-Place
  // -------------------------------------------------------------------------

  describe('pick-place', () => {
    it('errors when no PCB layout', () => {
      const result = validateExportPreflight('pick-place', makeProjectData({ hasPcbLayout: false }));
      expect(result.canExport).toBe(false);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('pick-place', makeProjectData());
      expect(result.canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // BOM CSV
  // -------------------------------------------------------------------------

  describe('bom-csv', () => {
    it('errors when no BOM items', () => {
      const result = validateExportPreflight('bom-csv', makeProjectData({ bomItemCount: 0, bomItemsWithPartNumber: 0 }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('BOM'))).toBe(true);
    });

    it('warns when no items have part numbers', () => {
      const result = validateExportPreflight('bom-csv', makeProjectData({ bomItemCount: 3, bomItemsWithPartNumber: 0 }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('part number'))).toBe(true);
    });

    it('warns when some items missing part numbers', () => {
      const result = validateExportPreflight('bom-csv', makeProjectData({ bomItemCount: 5, bomItemsWithPartNumber: 3 }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('missing part numbers'))).toBe(true);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('bom-csv', makeProjectData());
      expect(result.canExport).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Design Report
  // -------------------------------------------------------------------------

  describe('design-report', () => {
    it('errors when no project name', () => {
      const result = validateExportPreflight('design-report', makeProjectData({ projectName: null }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    });

    it('errors when project is empty', () => {
      const result = validateExportPreflight('design-report', emptyProject());
      expect(result.canExport).toBe(false);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('design-report', makeProjectData());
      expect(result.canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // PDF
  // -------------------------------------------------------------------------

  describe('pdf', () => {
    it('warns when project is mostly empty', () => {
      const data = makeProjectData({
        architectureNodeCount: 0,
        bomItemCount: 0,
        bomItemsWithPartNumber: 0,
        hasCircuitInstances: false,
      });
      const result = validateExportPreflight('pdf', data);
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('empty'))).toBe(true);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('pdf', makeProjectData());
      expect(result.canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // FMEA
  // -------------------------------------------------------------------------

  describe('fmea', () => {
    it('errors when no BOM items', () => {
      const result = validateExportPreflight('fmea', makeProjectData({ bomItemCount: 0, bomItemsWithPartNumber: 0 }));
      expect(result.canExport).toBe(false);
    });

    it('warns when no failure mode data', () => {
      const result = validateExportPreflight('fmea', makeProjectData({ bomItemsWithFailureData: 0 }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('failure mode'))).toBe(true);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('fmea', makeProjectData());
      expect(result.canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Firmware
  // -------------------------------------------------------------------------

  describe('firmware', () => {
    it('warns when no board profile', () => {
      const result = validateExportPreflight('firmware', makeProjectData({ hasBoardProfile: false }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('board profile'))).toBe(true);
    });

    it('warns when no architecture nodes', () => {
      const result = validateExportPreflight('firmware', makeProjectData({ architectureNodeCount: 0 }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('architecture'))).toBe(true);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('firmware', makeProjectData());
      expect(result.canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Netlist
  // -------------------------------------------------------------------------

  describe('netlist-csv / netlist-kicad', () => {
    it('errors when no circuit instances (csv)', () => {
      const result = validateExportPreflight('netlist-csv', makeProjectData({ hasCircuitInstances: false }));
      expect(result.canExport).toBe(false);
    });

    it('errors when no circuit instances (kicad)', () => {
      const result = validateExportPreflight('netlist-kicad', makeProjectData({ hasCircuitInstances: false }));
      expect(result.canExport).toBe(false);
    });

    it('passes with valid data', () => {
      expect(validateExportPreflight('netlist-csv', makeProjectData()).canExport).toBe(true);
      expect(validateExportPreflight('netlist-kicad', makeProjectData()).canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // ODB++
  // -------------------------------------------------------------------------

  describe('odb-plus-plus', () => {
    it('errors when no PCB layout', () => {
      const result = validateExportPreflight('odb-plus-plus', makeProjectData({ hasPcbLayout: false }));
      expect(result.canExport).toBe(false);
    });

    it('passes with valid data', () => {
      expect(validateExportPreflight('odb-plus-plus', makeProjectData()).canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // IPC-2581
  // -------------------------------------------------------------------------

  describe('ipc2581', () => {
    it('errors when no PCB layout', () => {
      const result = validateExportPreflight('ipc2581', makeProjectData({ hasPcbLayout: false }));
      expect(result.canExport).toBe(false);
    });

    it('passes with valid data', () => {
      expect(validateExportPreflight('ipc2581', makeProjectData()).canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // STEP
  // -------------------------------------------------------------------------

  describe('step', () => {
    it('errors when no PCB layout', () => {
      const result = validateExportPreflight('step', makeProjectData({ hasPcbLayout: false }));
      expect(result.canExport).toBe(false);
    });

    it('passes with valid data', () => {
      expect(validateExportPreflight('step', makeProjectData()).canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // FZZ
  // -------------------------------------------------------------------------

  describe('fzz', () => {
    it('errors when no circuit or architecture data', () => {
      const result = validateExportPreflight('fzz', makeProjectData({
        hasCircuitInstances: false,
        architectureNodeCount: 0,
      }));
      expect(result.canExport).toBe(false);
    });

    it('passes with just architecture nodes', () => {
      const result = validateExportPreflight('fzz', makeProjectData({ hasCircuitInstances: false }));
      expect(result.canExport).toBe(true);
    });

    it('passes with valid data', () => {
      expect(validateExportPreflight('fzz', makeProjectData()).canExport).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Unknown format
  // -------------------------------------------------------------------------

  describe('unknown format', () => {
    it('warns for unknown format but allows export', () => {
      const result = validateExportPreflight('unknown-format', makeProjectData());
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('Unknown'))).toBe(true);
    });

    it('still blocks on auth errors for unknown format', () => {
      const result = validateExportPreflight('unknown-format', makeProjectData({ hasSession: false }));
      expect(result.canExport).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('empty project fails most formats', () => {
      const data = emptyProject();
      const formats = getSupportedExportFormats();
      const results = formats.map((f) => validateExportPreflight(f, data));

      // Most formats should fail on empty project (no session is still true)
      const failCount = results.filter((r) => !r.canExport).length;
      expect(failCount).toBeGreaterThan(0);
    });

    it('full project passes all formats', () => {
      const data = makeProjectData();
      const formats = getSupportedExportFormats();
      const results = formats.map((f) => validateExportPreflight(f, data));

      for (const result of results) {
        expect(result.canExport).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('suggestions are provided alongside errors', () => {
      const result = validateExportPreflight('kicad', makeProjectData({ hasCircuitInstances: false }));
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // getSupportedExportFormats
  // -------------------------------------------------------------------------

  describe('getSupportedExportFormats', () => {
    it('returns all registered format IDs', () => {
      const formats = getSupportedExportFormats();
      expect(formats).toContain('kicad');
      expect(formats).toContain('eagle');
      expect(formats).toContain('spice');
      expect(formats).toContain('gerber');
      expect(formats).toContain('bom-csv');
      expect(formats).toContain('pdf');
      expect(formats).toContain('fmea');
      expect(formats).toContain('firmware');
      expect(formats).toContain('step');
      expect(formats.length).toBeGreaterThanOrEqual(15);
    });
  });
});
