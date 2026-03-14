/**
 * Export validation pre-flight checks.
 *
 * Validates that a project has enough data to produce a valid export
 * for each supported format before the user initiates the download.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportPreflightResult {
  readonly format: string;
  readonly canExport: boolean;
  readonly warnings: string[];
  readonly errors: string[];
  readonly suggestions: string[];
}

/** Minimal project data shape needed for validation. */
export interface ProjectExportData {
  readonly projectName: string | null | undefined;
  readonly hasSession: boolean;

  /** Number of architecture nodes. */
  readonly architectureNodeCount: number;

  /** Whether at least one circuit design with instances exists. */
  readonly hasCircuitInstances: boolean;

  /** Whether PCB layout data (placed components) exists. */
  readonly hasPcbLayout: boolean;

  /** Number of BOM items. */
  readonly bomItemCount: number;
  /** Number of BOM items that have a non-empty partNumber. */
  readonly bomItemsWithPartNumber: number;

  /** Whether at least one circuit source (voltage/current) exists. */
  readonly hasCircuitSource: boolean;
  /** Whether at least one passive/active component exists in the circuit. */
  readonly hasCircuitComponent: boolean;

  /** Whether a board profile has been selected for firmware scaffold. */
  readonly hasBoardProfile: boolean;

  /** Whether BOM items have failure-mode data for FMEA. */
  readonly bomItemsWithFailureData: number;
}

// ---------------------------------------------------------------------------
// Format-specific validators
// ---------------------------------------------------------------------------

type FormatValidator = (data: ProjectExportData) => ExportPreflightResult;

function makeResult(format: string): ExportPreflightResult {
  return { format, canExport: true, warnings: [], errors: [], suggestions: [] };
}

function commonChecks(result: ExportPreflightResult, data: ProjectExportData): void {
  if (!data.projectName) {
    result.warnings.push('Project has no name — exported files may have generic filenames.');
    result.suggestions.push('Set a project name in Project Settings.');
  }
  if (!data.hasSession) {
    result.errors.push('Not authenticated — export requires an active session.');
  }
}

function validateKiCad(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('kicad');
  commonChecks(result, data);

  if (!data.hasCircuitInstances) {
    result.errors.push('No circuit design with instances found.');
    result.suggestions.push('Add components to a circuit design in the Schematic view.');
  }

  if (data.architectureNodeCount === 0) {
    result.warnings.push('No architecture nodes — KiCad project will contain only the schematic.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateEagle(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('eagle');
  commonChecks(result, data);

  if (!data.hasCircuitInstances) {
    result.errors.push('No circuit design with instances found.');
    result.suggestions.push('Add components to a circuit design in the Schematic view.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateSpice(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('spice');
  commonChecks(result, data);

  if (!data.hasCircuitComponent) {
    result.errors.push('No circuit components found.');
    result.suggestions.push('Add at least one component (resistor, capacitor, etc.) to the circuit.');
  }

  if (!data.hasCircuitSource) {
    result.warnings.push('No voltage or current source found — simulation may not run.');
    result.suggestions.push('Add a voltage or current source to the circuit.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateGerber(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('gerber');
  commonChecks(result, data);

  if (!data.hasPcbLayout) {
    result.errors.push('No PCB layout data found.');
    result.suggestions.push('Place components on the PCB in the PCB Layout view.');
  }

  if (!data.hasCircuitInstances) {
    result.errors.push('No circuit instances — Gerber requires placed components.');
    result.suggestions.push('Create a circuit design with components first.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateDrill(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('drill');
  commonChecks(result, data);

  if (!data.hasPcbLayout) {
    result.errors.push('No PCB layout data found.');
    result.suggestions.push('Place components on the PCB in the PCB Layout view.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validatePickPlace(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('pick-place');
  commonChecks(result, data);

  if (!data.hasPcbLayout) {
    result.errors.push('No PCB layout data — pick-and-place requires placed components.');
    result.suggestions.push('Place components on the PCB in the PCB Layout view.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateBomCsv(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('bom-csv');
  commonChecks(result, data);

  if (data.bomItemCount === 0) {
    result.errors.push('No BOM items found.');
    result.suggestions.push('Add components to the Bill of Materials in the Procurement view.');
  } else if (data.bomItemsWithPartNumber === 0) {
    result.warnings.push('No BOM items have a part number — exported BOM may be incomplete.');
    result.suggestions.push('Add part numbers to BOM items for a complete export.');
  } else if (data.bomItemsWithPartNumber < data.bomItemCount) {
    result.warnings.push(
      `${data.bomItemCount - data.bomItemsWithPartNumber} of ${data.bomItemCount} BOM items are missing part numbers.`,
    );
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateDesignReport(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('design-report');
  commonChecks(result, data);

  if (!data.projectName) {
    // Upgrade the common-checks warning to an error for reports
    result.errors.push('Project name is required for design reports.');
    // Remove the duplicate warning
    const idx = result.warnings.indexOf('Project has no name — exported files may have generic filenames.');
    if (idx >= 0) {
      result.warnings.splice(idx, 1);
    }
    result.suggestions.push('Set a project name in Project Settings.');
  }

  if (data.architectureNodeCount === 0 && data.bomItemCount === 0 && !data.hasCircuitInstances) {
    result.errors.push('Project has no architecture, BOM, or circuit data to include in the report.');
    result.suggestions.push('Add architecture blocks, BOM items, or circuit components.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validatePdf(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('pdf');
  commonChecks(result, data);

  if (data.architectureNodeCount === 0 && data.bomItemCount === 0 && !data.hasCircuitInstances) {
    result.warnings.push('Project is mostly empty — PDF report will have minimal content.');
    result.suggestions.push('Add architecture blocks, BOM items, or circuit components for a richer report.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateFmea(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('fmea');
  commonChecks(result, data);

  if (data.bomItemCount === 0) {
    result.errors.push('No BOM items found — FMEA requires component data.');
    result.suggestions.push('Add components to the Bill of Materials.');
  }

  if (data.bomItemsWithFailureData === 0 && data.bomItemCount > 0) {
    result.warnings.push('No BOM items have failure mode data — FMEA will use generic failure modes.');
    result.suggestions.push('Add failure mode data to BOM items for more accurate analysis.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateFirmware(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('firmware');
  commonChecks(result, data);

  if (!data.hasBoardProfile) {
    result.warnings.push('No board profile selected — firmware will use a generic template.');
    result.suggestions.push('Select a target board (Arduino Uno, ESP32, etc.) in Board Settings.');
  }

  if (data.architectureNodeCount === 0) {
    result.warnings.push('No architecture nodes — firmware scaffold will be minimal.');
    result.suggestions.push('Add architecture blocks to generate more complete firmware.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateNetlist(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('netlist');
  commonChecks(result, data);

  if (!data.hasCircuitInstances) {
    result.errors.push('No circuit instances found — netlist requires placed components.');
    result.suggestions.push('Add components to a circuit design in the Schematic view.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateOdbPlusPlus(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('odb-plus-plus');
  commonChecks(result, data);

  if (!data.hasPcbLayout) {
    result.errors.push('No PCB layout data — ODB++ requires board design.');
    result.suggestions.push('Place components on the PCB in the PCB Layout view.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateIpc2581(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('ipc2581');
  commonChecks(result, data);

  if (!data.hasPcbLayout) {
    result.errors.push('No PCB layout data — IPC-2581 requires board design.');
    result.suggestions.push('Place components on the PCB in the PCB Layout view.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateStep(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('step');
  commonChecks(result, data);

  if (!data.hasPcbLayout) {
    result.errors.push('No PCB layout data — STEP 3D model requires board design.');
    result.suggestions.push('Place components on the PCB in the PCB Layout view.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateFzz(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('fzz');
  commonChecks(result, data);

  if (!data.hasCircuitInstances && data.architectureNodeCount === 0) {
    result.errors.push('No circuit or architecture data to export.');
    result.suggestions.push('Add architecture blocks or circuit components.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

// ---------------------------------------------------------------------------
// Format registry
// ---------------------------------------------------------------------------

const FORMAT_VALIDATORS: Record<string, FormatValidator> = {
  kicad: validateKiCad,
  eagle: validateEagle,
  spice: validateSpice,
  gerber: validateGerber,
  drill: validateDrill,
  'pick-place': validatePickPlace,
  'bom-csv': validateBomCsv,
  'design-report': validateDesignReport,
  pdf: validatePdf,
  fmea: validateFmea,
  firmware: validateFirmware,
  'netlist-csv': validateNetlist,
  'netlist-kicad': validateNetlist,
  'odb-plus-plus': validateOdbPlusPlus,
  ipc2581: validateIpc2581,
  step: validateStep,
  fzz: validateFzz,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate whether a project has sufficient data to export in the given format.
 *
 * @param format - The export format id (e.g. 'kicad', 'gerber', 'bom-csv')
 * @param data   - Snapshot of the project's current data for validation
 * @returns Validation result with errors, warnings, and suggestions
 */
export function validateExportPreflight(
  format: string,
  data: ProjectExportData,
): ExportPreflightResult {
  const validator = FORMAT_VALIDATORS[format];
  if (!validator) {
    // Unknown format — allow export but warn
    const result = makeResult(format);
    commonChecks(result, data);
    result.warnings.push(`Unknown export format "${format}" — validation skipped.`);
    result.canExport = result.errors.length === 0;
    return result;
  }
  return validator(data);
}

/** Get all supported format IDs. */
export function getSupportedExportFormats(): string[] {
  return Object.keys(FORMAT_VALIDATORS);
}
