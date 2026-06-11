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

    it('blocks when AI-generated instances are still unverified', () => {
      const result = validateExportPreflight('gerber', makeProjectData({
        aiGeneratedCircuitInstanceCount: 2,
        unverifiedAiGeneratedCircuitInstanceCount: 1,
      }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('AI-generated'))).toBe(true);
    });
  });

  describe('tscircuit-gerber', () => {
    it('is available with an explicit partial-mapping warning', () => {
      const result = validateExportPreflight('tscircuit-gerber', makeProjectData());
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('supported project components and net segments'))).toBe(true);
    });

    it('blocks without PCB layout or circuit instances', () => {
      const result = validateExportPreflight('tscircuit-gerber', makeProjectData({
        hasPcbLayout: false,
        hasCircuitInstances: false,
      }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('tscircuit Gerber requires board placement'))).toBe(true);
      expect(result.errors.some((e) => e.includes('needs placed components and nets'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Fab Package
  // -------------------------------------------------------------------------

  describe('fab-package', () => {
    it('errors when no PCB layout', () => {
      const result = validateExportPreflight('fab-package', makeProjectData({ hasPcbLayout: false }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('fabrication bundle'))).toBe(true);
    });

    it('warns when BOM part numbers are incomplete', () => {
      const result = validateExportPreflight('fab-package', makeProjectData({ bomItemsWithPartNumber: 1 }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('part numbers'))).toBe(true);
    });

    it('passes with valid data', () => {
      const result = validateExportPreflight('fab-package', makeProjectData());
      expect(result.canExport).toBe(true);
    });

    it('blocks fabrication package export when AI-generated instances are still unverified', () => {
      const result = validateExportPreflight('fab-package', makeProjectData({
        aiGeneratedCircuitInstanceCount: 2,
        unverifiedAiGeneratedCircuitInstanceCount: 1,
      }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('AI-generated'))).toBe(true);
      expect(result.suggestions.some((s) => s.includes('exact-part'))).toBe(true);
    });

    it('warns when placed parts are not all exact-part verified', () => {
      const result = validateExportPreflight('fab-package', makeProjectData({
        placedPartCount: 4,
        verifiedExactPartCount: 2,
      }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('exact-part verified'))).toBe(true);
    });

    it('blocks fabrication package export when red breadboard health is unresolved', () => {
      const result = validateExportPreflight('fab-package', makeProjectData({
        redBreadboardHealthCount: 1,
      }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('breadboard-health'))).toBe(true);
    });

    it('blocks fabrication package export for lifecycle risk without alternates', () => {
      const result = validateExportPreflight('fab-package', makeProjectData({
        eolPartCount: 1,
        lifecycleNoAlternateCount: 1,
      }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('without a known alternate'))).toBe(true);
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

    it('warns when inventory confidence is estimated', () => {
      const result = validateExportPreflight('pick-place', makeProjectData({
        estimatedInventoryLineCount: 2,
      }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('estimated or unknown confidence'))).toBe(true);
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

    it('blocks unresolved breadboard health before fabrication exchange export', () => {
      const result = validateExportPreflight('odb-plus-plus', makeProjectData({ redBreadboardHealthCount: 1 }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('breadboard-health'))).toBe(true);
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

    it('warns when upstream inventory confidence is estimated', () => {
      const result = validateExportPreflight('ipc2581', makeProjectData({ estimatedInventoryLineCount: 1 }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('estimated or unknown confidence'))).toBe(true);
    });
  });

  describe('etchable-pcb', () => {
    it('errors when no PCB layout', () => {
      const result = validateExportPreflight('etchable-pcb', makeProjectData({ hasPcbLayout: false }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('etchable PCB'))).toBe(true);
    });

    it('blocks lifecycle risk without alternates', () => {
      const result = validateExportPreflight('etchable-pcb', makeProjectData({
        obsoletePartCount: 1,
      }));
      expect(result.canExport).toBe(false);
      expect(result.errors.some((e) => e.includes('obsolete part'))).toBe(true);
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

    it('warns when verified mechanical models are missing from placed parts', () => {
      const result = validateExportPreflight('step', makeProjectData({
        placedPartCount: 3,
        verifiedExactPartCount: 3,
        verifiedMechanicalModelCount: 1,
      }));
      expect(result.canExport).toBe(true);
      expect(result.warnings.some((w) => w.includes('verified mechanical'))).toBe(true);
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
      expect(formats).toContain('fab-package');
      expect(formats).toContain('gerber');
      expect(formats).toContain('tscircuit-gerber');
      expect(formats).toContain('bom-csv');
      expect(formats).toContain('pdf');
      expect(formats).toContain('fmea');
      expect(formats).toContain('firmware');
      expect(formats).toContain('step');
      expect(formats.length).toBeGreaterThanOrEqual(15);
    });
  });
});
