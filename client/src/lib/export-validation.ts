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
  canExport: boolean;
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

  /** Number of active circuit instances created by an AI/generative flow. */
  readonly aiGeneratedCircuitInstanceCount?: number;
  /** Number of AI-generated instances still lacking exact-part trust. */
  readonly unverifiedAiGeneratedCircuitInstanceCount?: number;
  /** Number of active PCB-placed instances with linked component parts. */
  readonly placedPartCount?: number;
  /** Number of placed parts whose component metadata is exact-part verified. */
  readonly verifiedExactPartCount?: number;
  /** Number of placed parts with verified mechanical/breadboard model metadata. */
  readonly verifiedMechanicalModelCount?: number;
  /** Number of red breadboard-health findings from the current workspace. */
  readonly redBreadboardHealthCount?: number;
  /** Number of placed/BOM parts marked end-of-life. */
  readonly eolPartCount?: number;
  /** Number of placed/BOM parts marked obsolete. */
  readonly obsoletePartCount?: number;
  /** Number of placed/BOM parts marked not recommended for new designs. */
  readonly nrndPartCount?: number;
  /** Number of EOL or obsolete parts without a known alternate. */
  readonly lifecycleNoAlternateCount?: number;
  /** Number of inventory/BOM lines backed by estimated or unknown inventory confidence. */
  readonly estimatedInventoryLineCount?: number;

  /**
   * BL-0150 — total units short across all BOM lines for this project.
   * Sum of `max(0, quantityNeeded - quantityOnHand)` across `part_stock`.
   * Optional: callers that haven't wired inventory data pass `undefined`
   * and the export precheck treats the signal as unknown (no warning).
   */
  readonly bomShortfallUnits?: number;
  /** BL-0150 — number of distinct BOM lines with a shortfall. */
  readonly bomShortfallLineCount?: number;
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

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function addAiGeneratedCircuitChecks(result: ExportPreflightResult, data: ProjectExportData): void {
  const unverified = data.unverifiedAiGeneratedCircuitInstanceCount ?? 0;
  if (unverified <= 0) {
    return;
  }

  result.errors.push(
    `${plural(unverified, 'AI-generated circuit instance')} ${unverified === 1 ? 'still needs' : 'still need'} exact-part verification before fabrication export.`,
  );
  result.suggestions.push('Complete exact-part verification in Component Editor before using this export for fabrication or ordering.');
}

function addExactPartWarnings(result: ExportPreflightResult, data: ProjectExportData): void {
  const placed = data.placedPartCount;
  const verified = data.verifiedExactPartCount;
  if (placed === undefined || verified === undefined || placed <= 0 || verified >= placed) {
    return;
  }

  const missing = placed - verified;
  result.warnings.push(
    `${plural(missing, 'placed part')} ${missing === 1 ? 'is' : 'are'} not exact-part verified, so manufacturing handoff still carries part-identity risk.`,
  );
  result.suggestions.push('Verify placed component parts in Component Editor before release.');
}

function addMechanicalModelWarnings(result: ExportPreflightResult, data: ProjectExportData): void {
  const placed = data.placedPartCount;
  const verifiedModels = data.verifiedMechanicalModelCount;
  if (placed === undefined || verifiedModels === undefined || placed <= 0 || verifiedModels >= placed) {
    return;
  }

  const missing = placed - verifiedModels;
  result.warnings.push(
    `${plural(missing, 'placed part')} ${missing === 1 ? 'is' : 'are'} missing verified mechanical model data, so STEP fit checks are incomplete.`,
  );
  result.suggestions.push('Add or verify mechanical/breadboard model metadata before relying on the STEP export.');
}

function addBreadboardHealthChecks(result: ExportPreflightResult, data: ProjectExportData): void {
  const redCount = data.redBreadboardHealthCount ?? 0;
  if (redCount <= 0) {
    return;
  }

  result.errors.push(
    `${plural(redCount, 'red breadboard-health finding')} ${redCount === 1 ? 'is' : 'are'} unresolved, so this design is not ready for fabrication handoff.`,
  );
  result.suggestions.push('Resolve red breadboard health findings before releasing fabrication or assembly files.');
}

function addLifecycleRiskChecks(result: ExportPreflightResult, data: ProjectExportData): void {
  const obsolete = data.obsoletePartCount ?? 0;
  const eol = data.eolPartCount ?? 0;
  const nrnd = data.nrndPartCount ?? 0;
  const noAlternate = data.lifecycleNoAlternateCount ?? 0;

  if (obsolete > 0 || noAlternate > 0) {
    const blockers = [
      obsolete > 0 ? plural(obsolete, 'obsolete part') : null,
      noAlternate > 0 ? `${plural(noAlternate, 'lifecycle-risk part')} without a known alternate` : null,
    ].filter(Boolean).join(' and ');
    result.errors.push(`${blockers} ${obsolete + noAlternate === 1 ? 'blocks' : 'block'} fabrication release.`);
    result.suggestions.push('Replace obsolete/EOL parts or assign verified alternates before fabrication or ordering.');
  }

  if (eol > 0) {
    result.warnings.push(`${plural(eol, 'end-of-life part')} should be replaced or explicitly accepted before procurement.`);
  }

  if (nrnd > 0) {
    result.warnings.push(`${plural(nrnd, 'NRND part')} may create supply risk for future builds.`);
  }
}

function addInventoryConfidenceWarnings(result: ExportPreflightResult, data: ProjectExportData): void {
  const estimated = data.estimatedInventoryLineCount ?? 0;
  if (estimated <= 0) {
    return;
  }

  result.warnings.push(
    `${plural(estimated, 'inventory line')} ${estimated === 1 ? 'uses' : 'use'} estimated or unknown confidence, so purchasing quantities may need review.`,
  );
  result.suggestions.push('Refresh inventory confidence before ordering, kitting, or exporting procurement files.');
}

function addFabricationTrustChecks(result: ExportPreflightResult, data: ProjectExportData): void {
  addAiGeneratedCircuitChecks(result, data);
  addExactPartWarnings(result, data);
  addBreadboardHealthChecks(result, data);
  addLifecycleRiskChecks(result, data);
  addInventoryConfidenceWarnings(result, data);
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
  addFabricationTrustChecks(result, data);

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

function validateTscircuitGerber(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('tscircuit-gerber');
  commonChecks(result, data);
  addFabricationTrustChecks(result, data);

  if (!data.hasPcbLayout) {
    result.errors.push('No PCB layout data — tscircuit Gerber requires board placement data.');
    result.suggestions.push('Place components on the PCB before using the tscircuit Gerber export.');
  }

  if (!data.hasCircuitInstances) {
    result.errors.push('No circuit instances — tscircuit Gerber needs placed components and nets.');
    result.suggestions.push('Create or select a circuit design with components before exporting Gerbers.');
  }

  result.warnings.push(
    'This v3 export maps supported project components and net segments through tscircuit; unsupported component families or endpoints are skipped with warnings.',
  );
  result.suggestions.push('Use the standard Gerber export for full manufacturing handoff until all footprints and component families are mapped.');

  result.canExport = result.errors.length === 0;
  return result;
}

function validateFabPackage(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('fab-package');
  commonChecks(result, data);
  addFabricationTrustChecks(result, data);

  if (!data.hasPcbLayout) {
    result.errors.push('No PCB layout data — a fabrication bundle needs placed board data.');
    result.suggestions.push('Place components on the PCB in the PCB Layout view.');
  }

  if (!data.hasCircuitInstances) {
    result.errors.push('No circuit instances — the fabrication bundle needs a placed circuit design.');
    result.suggestions.push('Create a circuit design with components first.');
  }

  if (data.bomItemCount === 0) {
    result.warnings.push('No BOM items found — the bundle can export, but assembly handoff will be incomplete.');
    result.suggestions.push('Populate the BOM before handing the package to a fab or assembler.');
  } else if (data.bomItemsWithPartNumber < data.bomItemCount) {
    result.warnings.push('Some BOM items are missing part numbers — assembly documentation may be incomplete.');
    result.suggestions.push('Add part numbers to BOM items for a cleaner manufacturing handoff.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateDrill(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('drill');
  commonChecks(result, data);
  addFabricationTrustChecks(result, data);

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
  addFabricationTrustChecks(result, data);

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
  addLifecycleRiskChecks(result, data);
  addInventoryConfidenceWarnings(result, data);

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
  addFabricationTrustChecks(result, data);

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
  addFabricationTrustChecks(result, data);

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
  addAiGeneratedCircuitChecks(result, data);
  addExactPartWarnings(result, data);
  addMechanicalModelWarnings(result, data);

  if (!data.hasPcbLayout) {
    result.errors.push('No PCB layout data — STEP 3D model requires board design.');
    result.suggestions.push('Place components on the PCB in the PCB Layout view.');
  }

  result.canExport = result.errors.length === 0;
  return result;
}

function validateEtchablePcb(data: ProjectExportData): ExportPreflightResult {
  const result = makeResult('etchable-pcb');
  commonChecks(result, data);
  addFabricationTrustChecks(result, data);

  if (!data.hasPcbLayout) {
    result.errors.push('No PCB layout data — etchable PCB export requires board design.');
    result.suggestions.push('Place and route the PCB before exporting a DIY etching mask.');
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
  'fab-package': validateFabPackage,
  gerber: validateGerber,
  'tscircuit-gerber': validateTscircuitGerber,
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
  'etchable-pcb': validateEtchablePcb,
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
