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
  ];
}

function odbPlusPlusChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
  ];
}

function ipc2581Checks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
  ];
}

function stepChecks(data: ProjectExportData): PrecheckResult[] {
  return [
    sessionCheck(data),
    projectNameCheck(data, false),
    pcbLayoutCheck(data),
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
  ];
}

// ---------------------------------------------------------------------------
// Format registry
// ---------------------------------------------------------------------------

const FORMAT_PRECHECK_RUNNERS: Record<string, FormatPrecheckRunner> = {
  kicad: kicadChecks,
  eagle: eagleChecks,
  spice: spiceChecks,
  gerber: gerberChecks,
  'pick-place': pickPlaceChecks,
  'bom-csv': bomCsvChecks,
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
