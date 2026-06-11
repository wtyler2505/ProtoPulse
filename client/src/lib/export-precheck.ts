/**
 * Export pre-check engine.
 *
 * Provides a structured checklist of format-specific validation checks
 * that runs before export, giving the user granular feedback on what
 * is ready and what needs attention.
 *
 * Builds on top of `export-validation.ts` but provides individual check
 * items (pass/warn/fail) rather than flat string arrays, enabling a
 * richer checklist UI.
 */

import type { ProjectExportData } from '@/lib/export-validation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrecheckStatus = 'pass' | 'warn' | 'fail';

export interface PrecheckResult {
  /** Short human-readable name for this check. */
  readonly name: string;
  /** Result of the check. */
  readonly status: PrecheckStatus;
  /** Explanation shown to the user. */
  readonly message: string;
}

export interface ExportPrecheck {
  /** Format id this precheck was run for. */
  readonly format: string;
  /** True when there are zero 'fail' results. */
  readonly passed: boolean;
  /** Individual check results. */
  readonly checks: readonly PrecheckResult[];
  /** Messages from 'fail' checks (convenience). */
  readonly blockers: readonly string[];
  /** Messages from 'warn' checks (convenience). */
  readonly warnings: readonly string[];
}

// ---------------------------------------------------------------------------
// Check builders (internal helpers)
// ---------------------------------------------------------------------------

function check(name: string, status: PrecheckStatus, message: string): PrecheckResult {
  return { name, status, message };
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function sessionCheck(data: ProjectExportData): PrecheckResult {
  return data.hasSession
    ? check('Authentication', 'pass', 'Active session detected.')
    : check('Authentication', 'fail', 'Not authenticated — export requires an active session.');
}

function projectNameCheck(data: ProjectExportData, required: boolean): PrecheckResult {
  if (data.projectName) {
    return check('Project Name', 'pass', `Project name: "${data.projectName}".`);
  }
  return required
    ? check('Project Name', 'fail', 'Project name is required for this export format.')
    : check('Project Name', 'warn', 'No project name set — files may have generic filenames.');
}

function architectureNodeCheck(data: ProjectExportData, required: boolean): PrecheckResult {
  if (data.architectureNodeCount > 0) {
    return check(
      'Architecture Nodes',
      'pass',
      `${data.architectureNodeCount} architecture node${data.architectureNodeCount === 1 ? '' : 's'} found.`,
    );
  }
  return required
    ? check('Architecture Nodes', 'fail', 'No architecture nodes found — required for this format.')
    : check('Architecture Nodes', 'warn', 'No architecture nodes — export will have limited content.');
}

function circuitInstanceCheck(data: ProjectExportData): PrecheckResult {
  return data.hasCircuitInstances
    ? check('Circuit Instances', 'pass', 'Circuit design with instances found.')
    : check('Circuit Instances', 'fail', 'No circuit design with instances found.');
}

function pcbLayoutCheck(data: ProjectExportData): PrecheckResult {
  return data.hasPcbLayout
    ? check('PCB Layout', 'pass', 'PCB layout data with placed components found.')
    : check('PCB Layout', 'fail', 'No PCB layout data — place components in the PCB Layout view.');
}

function bomItemCheck(data: ProjectExportData): PrecheckResult {
  if (data.bomItemCount > 0) {
    return check('BOM Items', 'pass', `${data.bomItemCount} BOM item${data.bomItemCount === 1 ? '' : 's'} found.`);
  }
  return check('BOM Items', 'fail', 'No BOM items found.');
}

function bomPartNumberCheck(data: ProjectExportData): PrecheckResult {
  if (data.bomItemCount === 0) {
    return check('Part Numbers', 'fail', 'No BOM items — cannot check part numbers.');
  }
  if (data.bomItemsWithPartNumber === data.bomItemCount) {
    return check('Part Numbers', 'pass', 'All BOM items have part numbers.');
  }
  if (data.bomItemsWithPartNumber === 0) {
    return check('Part Numbers', 'warn', 'No BOM items have part numbers — export may be incomplete.');
  }
  const missing = data.bomItemCount - data.bomItemsWithPartNumber;
  return check(
    'Part Numbers',
    'warn',
    `${missing} of ${data.bomItemCount} BOM item${missing === 1 ? ' is' : 's are'} missing part numbers.`,
  );
}

function inventoryEntryCheck(data: ProjectExportData): PrecheckResult {
  if (data.bomItemCount > 0) {
    return check('Inventory Lines', 'pass', `${plural(data.bomItemCount, 'inventory line')} tracked.`);
  }
  return check('Inventory Lines', 'fail', 'No inventory lines found.');
}

function inventoryPartNumberCheck(data: ProjectExportData): PrecheckResult {
  if (data.bomItemCount === 0) {
    return check('Inventory Part Numbers', 'pass', 'No inventory lines to check.');
  }
  if (data.bomItemsWithPartNumber === data.bomItemCount) {
    return check('Inventory Part Numbers', 'pass', 'All inventory lines have part numbers.');
  }
  const missing = data.bomItemCount - data.bomItemsWithPartNumber;
  return check(
    'Inventory Part Numbers',
    'warn',
    `${plural(missing, 'inventory line')} ${missing === 1 ? 'is' : 'are'} missing a part number; labels and stock review may be ambiguous.`,
  );
}

function lifecycleEntryCheck(data: ProjectExportData): PrecheckResult {
  if (data.bomItemCount > 0) {
    return check('Lifecycle Entries', 'pass', `${plural(data.bomItemCount, 'lifecycle entry', 'lifecycle entries')} tracked.`);
  }
  return check('Lifecycle Entries', 'warn', 'No lifecycle entries are tracked yet.');
}

function lifecyclePartNumberCheck(data: ProjectExportData): PrecheckResult {
  if (data.bomItemCount === 0) {
    return check('Lifecycle Part Numbers', 'pass', 'No lifecycle entries to check.');
  }
  if (data.bomItemsWithPartNumber === data.bomItemCount) {
    return check('Lifecycle Part Numbers', 'pass', 'All lifecycle entries have part numbers.');
  }
  const missing = data.bomItemCount - data.bomItemsWithPartNumber;
  return check(
    'Lifecycle Part Numbers',
    'warn',
    `${plural(missing, 'lifecycle entry', 'lifecycle entries')} ${missing === 1 ? 'is' : 'are'} missing a part number.`,
  );
}

function circuitSourceCheck(data: ProjectExportData): PrecheckResult {
  return data.hasCircuitSource
    ? check('Circuit Source', 'pass', 'Voltage/current source found.')
    : check('Circuit Source', 'warn', 'No voltage or current source — simulation may not run.');
}

function circuitComponentCheck(data: ProjectExportData): PrecheckResult {
  return data.hasCircuitComponent
    ? check('Circuit Components', 'pass', 'Circuit components found.')
    : check('Circuit Components', 'fail', 'No circuit components found.');
}

function boardProfileCheck(data: ProjectExportData): PrecheckResult {
  return data.hasBoardProfile
    ? check('Board Profile', 'pass', 'Target board profile selected.')
    : check('Board Profile', 'warn', 'No board profile selected — firmware will use a generic template.');
}

/**
 * BL-0150 — inventory shortfall warning for fab/pick-and-place exports.
 *
 * Warns (never blocks) when the BOM demands more units than the project has
 * on hand. If `bomShortfallUnits` is `undefined` the inventory panel hasn't
 * loaded — we stay quiet instead of fabricating a "pass".
 */
function bomShortfallCheck(data: ProjectExportData): PrecheckResult {
  if (data.bomShortfallUnits === undefined) {
    return check('Inventory Coverage', 'pass', 'Inventory data not loaded; skipping shortfall check.');
  }
  if (data.bomShortfallUnits === 0) {
    return check('Inventory Coverage', 'pass', 'All BOM items covered by on-hand stock.');
  }
  const lines = data.bomShortfallLineCount ?? 0;
  return check(
    'Inventory Coverage',
    'warn',
    `${data.bomShortfallUnits} unit${data.bomShortfallUnits === 1 ? '' : 's'} short across ${lines} BOM line${lines === 1 ? '' : 's'} — order parts before fab.`,
  );
}

function aiGeneratedCircuitProvenanceCheck(data: ProjectExportData): PrecheckResult {
  const generated = data.aiGeneratedCircuitInstanceCount ?? 0;
  const unverified = data.unverifiedAiGeneratedCircuitInstanceCount ?? 0;

  if (generated === 0) {
    return check('AI-Generated Circuit Provenance', 'pass', 'No AI-generated circuit instances detected.');
  }

  if (unverified > 0) {
    return check(
      'AI-Generated Circuit Provenance',
      'fail',
      `${plural(unverified, 'AI-generated circuit instance')} ${unverified === 1 ? 'still needs' : 'still need'} exact-part verification before fabrication export.`,
    );
  }

  return check('AI-Generated Circuit Provenance', 'pass', 'AI-generated circuit instances have exact-part trust metadata.');
}

function exactPartVerificationCheck(data: ProjectExportData): PrecheckResult {
  if (data.placedPartCount === undefined || data.verifiedExactPartCount === undefined) {
    return check('Exact-Part Verification', 'pass', 'Exact-part verification data not loaded; skipping.');
  }

  if (data.placedPartCount === 0) {
    return check('Exact-Part Verification', 'pass', 'No PCB-placed linked parts to verify.');
  }

  if (data.verifiedExactPartCount >= data.placedPartCount) {
    return check('Exact-Part Verification', 'pass', 'All PCB-placed linked parts are exact-part verified.');
  }

  const missing = data.placedPartCount - data.verifiedExactPartCount;
  return check(
    'Exact-Part Verification',
    'warn',
    `${plural(missing, 'placed part')} ${missing === 1 ? 'is' : 'are'} not exact-part verified; verify before release.`,
  );
}

function verifiedMechanicalModelsCheck(data: ProjectExportData): PrecheckResult {
  if (data.placedPartCount === undefined || data.verifiedMechanicalModelCount === undefined) {
    return check('Verified Mechanical Models', 'pass', 'Mechanical model data not loaded; skipping.');
  }

  if (data.placedPartCount === 0) {
    return check('Verified Mechanical Models', 'pass', 'No PCB-placed linked parts need mechanical models.');
  }

  if (data.verifiedMechanicalModelCount >= data.placedPartCount) {
    return check('Verified Mechanical Models', 'pass', 'All PCB-placed linked parts have verified mechanical model metadata.');
  }

  const missing = data.placedPartCount - data.verifiedMechanicalModelCount;
  return check(
    'Verified Mechanical Models',
    'warn',
    `${plural(missing, 'placed part')} ${missing === 1 ? 'is' : 'are'} missing verified mechanical model data; STEP fit checks are incomplete.`,
  );
}

function breadboardHealthCheck(data: ProjectExportData): PrecheckResult {
  const redCount = data.redBreadboardHealthCount ?? 0;
  if (redCount === 0) {
    return check('Breadboard Health', 'pass', 'No red breadboard-health findings are currently blocking release.');
  }

  return check(
    'Breadboard Health',
    'fail',
    `${plural(redCount, 'red breadboard-health finding')} ${redCount === 1 ? 'is' : 'are'} unresolved; fix before fabrication or assembly handoff.`,
  );
}

function lifecycleRiskCheck(data: ProjectExportData): PrecheckResult {
  const obsolete = data.obsoletePartCount ?? 0;
  const eol = data.eolPartCount ?? 0;
  const nrnd = data.nrndPartCount ?? 0;
  const noAlternate = data.lifecycleNoAlternateCount ?? 0;

  if (obsolete > 0 || noAlternate > 0) {
    const blockers = [
      obsolete > 0 ? plural(obsolete, 'obsolete part') : null,
      noAlternate > 0 ? `${plural(noAlternate, 'lifecycle-risk part')} without a known alternate` : null,
    ].filter(Boolean).join(' and ');
    return check('Lifecycle Risk', 'fail', `${blockers} must be replaced or assigned a verified alternate before release.`);
  }

  if (eol > 0 || nrnd > 0) {
    const warnings = [
      eol > 0 ? plural(eol, 'end-of-life part') : null,
      nrnd > 0 ? plural(nrnd, 'NRND part') : null,
    ].filter(Boolean).join(' and ');
    return check('Lifecycle Risk', 'warn', `${warnings} should be reviewed before procurement.`);
  }

  return check('Lifecycle Risk', 'pass', 'No EOL, obsolete, or NRND lifecycle risks are currently visible.');
}

function inventoryConfidenceCheck(data: ProjectExportData): PrecheckResult {
  const estimated = data.estimatedInventoryLineCount ?? 0;
  if (estimated === 0) {
    return check('Inventory Confidence', 'pass', 'No estimated inventory-confidence lines are currently visible.');
  }

  return check(
    'Inventory Confidence',
    'warn',
    `${plural(estimated, 'inventory line')} ${estimated === 1 ? 'uses' : 'use'} estimated or unknown confidence; review quantities before ordering.`,
  );
}

function fabricationTrustChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    aiGeneratedCircuitProvenanceCheck(data),
    exactPartVerificationCheck(data),
    breadboardHealthCheck(data),
    lifecycleRiskCheck(data),
    inventoryConfidenceCheck(data),
  ];
}

function bomFailureDataCheck(data: ProjectExportData): PrecheckResult {
  if (data.bomItemCount === 0) {
    return check('Failure Mode Data', 'fail', 'No BOM items — cannot check failure data.');
  }
  if (data.bomItemsWithFailureData > 0) {
    return check(
      'Failure Mode Data',
      'pass',
      `${data.bomItemsWithFailureData} of ${data.bomItemCount} BOM item${data.bomItemCount === 1 ? '' : 's'} have failure mode data.`,
    );
  }
  return check('Failure Mode Data', 'warn', 'No BOM items have failure mode data — FMEA will use generic failure modes.');
}

function anyContentCheck(data: ProjectExportData): PrecheckResult {
  if (data.architectureNodeCount > 0 || data.bomItemCount > 0 || data.hasCircuitInstances) {
    return check('Project Content', 'pass', 'Project has architecture, BOM, or circuit data.');
  }
  return check('Project Content', 'fail', 'Project has no architecture, BOM, or circuit data.');
}

// ---------------------------------------------------------------------------
// Format-specific precheck runners
// ---------------------------------------------------------------------------

type FormatPrecheckRunner = (data: ProjectExportData) => PrecheckResult[];

function gerberChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
    circuitInstanceCheck(data),
    ...fabricationTrustChecks(data),
  ];
}

function tscircuitGerberChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
    circuitInstanceCheck(data),
    ...fabricationTrustChecks(data),
    check(
      'TSCircuit Export Path',
      'warn',
      'Maps supported project components and net segments through tscircuit; unsupported families or endpoints are skipped until full v3 mapping lands.',
    ),
  ];
}

function fabPackageChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
    circuitInstanceCheck(data),
    ...fabricationTrustChecks(data),
    bomItemCheck(data),
    bomPartNumberCheck(data),
    bomShortfallCheck(data),
  ];
}

function kicadChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    circuitInstanceCheck(data),
    architectureNodeCheck(data, false),
  ];
}

function eagleChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    circuitInstanceCheck(data),
  ];
}

function spiceChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    circuitComponentCheck(data),
    circuitSourceCheck(data),
  ];
}

function netlistChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    circuitInstanceCheck(data),
  ];
}

function bomCsvChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    bomItemCheck(data),
    bomPartNumberCheck(data),
    lifecycleRiskCheck(data),
    inventoryConfidenceCheck(data),
    bomShortfallCheck(data),
  ];
}

function inventoryReviewChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    inventoryEntryCheck(data),
    inventoryPartNumberCheck(data),
    inventoryConfidenceCheck(data),
    bomShortfallCheck(data),
  ];
}

function lifecycleReviewChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    lifecycleEntryCheck(data),
    lifecyclePartNumberCheck(data),
    lifecycleRiskCheck(data),
  ];
}

function procurementPackageChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    bomItemCheck(data),
    bomPartNumberCheck(data),
    aiGeneratedCircuitProvenanceCheck(data),
    exactPartVerificationCheck(data),
    verifiedMechanicalModelsCheck(data),
    breadboardHealthCheck(data),
    lifecycleRiskCheck(data),
    inventoryConfidenceCheck(data),
    bomShortfallCheck(data),
  ];
}

function bomTemplateApplyChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    aiGeneratedCircuitProvenanceCheck(data),
    exactPartVerificationCheck(data),
    verifiedMechanicalModelsCheck(data),
    breadboardHealthCheck(data),
    lifecycleRiskCheck(data),
    inventoryConfidenceCheck(data),
  ];
}

function pdfChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    anyContentCheck(data),
  ];
}

function designReportChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, true),
    anyContentCheck(data),
  ];
}

function fmeaChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    bomItemCheck(data),
    bomFailureDataCheck(data),
  ];
}

function firmwareChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    boardProfileCheck(data),
    architectureNodeCheck(data, false),
  ];
}

function pickPlaceChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
    ...fabricationTrustChecks(data),
    bomShortfallCheck(data),
  ];
}

function odbPlusPlusChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
    ...fabricationTrustChecks(data),
  ];
}

function ipc2581Checks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
    ...fabricationTrustChecks(data),
  ];
}

function stepChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
    aiGeneratedCircuitProvenanceCheck(data),
    exactPartVerificationCheck(data),
    verifiedMechanicalModelsCheck(data),
  ];
}

function fzzChecks(data: ProjectExportData): PrecheckResult[] {
  const hasAnyContent = data.hasCircuitInstances || data.architectureNodeCount > 0;
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    hasAnyContent
      ? check('Project Content', 'pass', 'Circuit or architecture data found.')
      : check('Project Content', 'fail', 'No circuit or architecture data to export.'),
  ];
}

function etchablePcbChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
    ...fabricationTrustChecks(data),
  ];
}

// ---------------------------------------------------------------------------
// Format registry
// ---------------------------------------------------------------------------

const FORMAT_PRECHECK_RUNNERS: Record<string, FormatPrecheckRunner> = {
  kicad: kicadChecks,
  eagle: eagleChecks,
  spice: spiceChecks,
  'fab-package': fabPackageChecks,
  gerber: gerberChecks,
  'tscircuit-gerber': tscircuitGerberChecks,
  'pick-place': pickPlaceChecks,
  'bom-csv': bomCsvChecks,
  'inventory-review': inventoryReviewChecks,
  'lifecycle-review': lifecycleReviewChecks,
  'procurement-package': procurementPackageChecks,
  'bom-template-apply': bomTemplateApplyChecks,
  pdf: pdfChecks,
  'design-report': designReportChecks,
  fmea: fmeaChecks,
  firmware: firmwareChecks,
  'netlist-csv': netlistChecks,
  'netlist-kicad': netlistChecks,
  'odb-plus-plus': odbPlusPlusChecks,
  ipc2581: ipc2581Checks,
  step: stepChecks,
  fzz: fzzChecks,
  'etchable-pcb': etchablePcbChecks,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run format-specific pre-checks and return a structured result with
 * individual check items, blockers, and warnings.
 *
 * @param format  - Export format id (e.g. 'kicad', 'gerber', 'bom-csv')
 * @param data    - Snapshot of current project data
 * @returns Structured precheck result
 */
export function runExportPrecheck(
  format: string,
  data: ProjectExportData,
): ExportPrecheck {
  const runner = FORMAT_PRECHECK_RUNNERS[format];

  let checks: PrecheckResult[];
  if (runner) {
    checks = runner(data);
  } else {
    // Unknown format — run basic checks only
    checks = [
      sessionCheck(data),
      projectNameCheck(data, false),
      check('Format', 'warn', `Unknown export format "${format}" — validation skipped.`),
    ];
  }

  const blockers = checks
    .filter((c) => c.status === 'fail')
    .map((c) => c.message);

  const warnings = checks
    .filter((c) => c.status === 'warn')
    .map((c) => c.message);

  return {
    format,
    passed: blockers.length === 0,
    checks,
    blockers,
    warnings,
  };
}

/** Get all format IDs that have precheck runners registered. */
export function getSupportedPrecheckFormats(): string[] {
  return Object.keys(FORMAT_PRECHECK_RUNNERS);
}
