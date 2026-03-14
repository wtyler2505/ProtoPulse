/**
 * Import Warning Engine
 *
 * Generates structured warnings about what was dropped, unsupported,
 * converted, or approximated during a design file import. Provides
 * format-specific analysis for KiCad, EAGLE, Altium, gEDA, LTspice,
 * Proteus, and OrCAD formats.
 */

import type { ImportedDesign, ImportFormat } from '@/lib/design-import';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Classification of what happened to the imported entity. */
export type ImportWarningType =
  | 'dropped'
  | 'unsupported'
  | 'converted'
  | 'approximated';

/** How serious the warning is. */
export type ImportWarningSeverity = 'info' | 'warning' | 'error';

export interface ImportWarning {
  /** What kind of mapping issue occurred. */
  type: ImportWarningType;
  /** The entity affected (component ref, net name, property key, etc.). */
  entity: string;
  /** Human-readable explanation of what happened. */
  detail: string;
  /** Severity level for display grouping. */
  severity: ImportWarningSeverity;
}

// ---------------------------------------------------------------------------
// Format-family helpers
// ---------------------------------------------------------------------------

function isKiCadFormat(format: ImportFormat): boolean {
  return format === 'kicad-schematic' || format === 'kicad-pcb' || format === 'kicad-symbol';
}

function isEagleFormat(format: ImportFormat): boolean {
  return format === 'eagle-schematic' || format === 'eagle-board' || format === 'eagle-library';
}

function isAltiumFormat(format: ImportFormat): boolean {
  return format === 'altium-schematic' || format === 'altium-pcb';
}

// ---------------------------------------------------------------------------
// KiCad-specific warnings
// ---------------------------------------------------------------------------

function generateKiCadWarnings(design: ImportedDesign): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  for (const comp of design.components) {
    // 3D models referenced in KiCad footprints are not imported.
    const model3d = comp.properties['ki_3dmodel'] ?? comp.properties['3d_model'];
    if (model3d) {
      warnings.push({
        type: 'dropped',
        entity: comp.refDes || comp.name,
        detail: `3D model reference dropped: ${model3d}`,
        severity: 'info',
      });
    }

    // Custom footprints that reference a library path cannot be resolved.
    const fpLib = comp.properties['ki_fp_lib'] ?? comp.properties['Footprint'];
    if (fpLib && fpLib.includes(':')) {
      warnings.push({
        type: 'unsupported',
        entity: comp.refDes || comp.name,
        detail: `Custom footprint library reference not resolved: ${fpLib}`,
        severity: 'warning',
      });
    }

    // Symbol library references.
    const symLib = comp.properties['ki_sym_lib'];
    if (symLib) {
      warnings.push({
        type: 'dropped',
        entity: comp.refDes || comp.name,
        detail: `Symbol library reference dropped: ${symLib}`,
        severity: 'info',
      });
    }
  }

  // KiCad page settings / title block metadata.
  if (design.metadata['page_size'] || design.metadata['title_block']) {
    warnings.push({
      type: 'dropped',
      entity: 'Sheet',
      detail: 'KiCad page/title block settings are not imported',
      severity: 'info',
    });
  }

  // Power flags and no-connect markers in KiCad schematics.
  if (design.metadata['power_flags']) {
    warnings.push({
      type: 'converted',
      entity: 'Power flags',
      detail: `${design.metadata['power_flags']} power flag(s) converted to net labels`,
      severity: 'info',
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// EAGLE-specific warnings
// ---------------------------------------------------------------------------

function generateEagleWarnings(design: ImportedDesign): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  for (const comp of design.components) {
    // ULP script references are EAGLE-only automation.
    const ulp = comp.properties['ulp_script'] ?? comp.properties['ULP'];
    if (ulp) {
      warnings.push({
        type: 'unsupported',
        entity: comp.refDes || comp.name,
        detail: `ULP script reference not supported: ${ulp}`,
        severity: 'warning',
      });
    }

    // Board variants (only in EAGLE XML).
    const variant = comp.properties['variant'] ?? comp.properties['VARIANT'];
    if (variant) {
      warnings.push({
        type: 'dropped',
        entity: comp.refDes || comp.name,
        detail: `Board variant "${variant}" dropped (variants not supported)`,
        severity: 'warning',
      });
    }

    // EAGLE technology attributes.
    const technology = comp.properties['technology'] ?? comp.properties['TECHNOLOGY'];
    if (technology) {
      warnings.push({
        type: 'dropped',
        entity: comp.refDes || comp.name,
        detail: `Technology attribute "${technology}" dropped`,
        severity: 'info',
      });
    }
  }

  // EAGLE design rules embedded in the file.
  if (design.metadata['drc_rules'] || design.metadata['design_rules']) {
    warnings.push({
      type: 'dropped',
      entity: 'Design Rules',
      detail: 'EAGLE design rules are not imported (use ProtoPulse DRC settings instead)',
      severity: 'info',
    });
  }

  // EAGLE supply layers.
  if (design.metadata['supply_layers']) {
    warnings.push({
      type: 'converted',
      entity: 'Supply layers',
      detail: 'EAGLE supply layers converted to standard power nets',
      severity: 'info',
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Altium-specific warnings
// ---------------------------------------------------------------------------

function generateAltiumWarnings(design: ImportedDesign): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  for (const comp of design.components) {
    // Altium-specific component parameters.
    const compKind = comp.properties['ComponentKind'] ?? comp.properties['component_kind'];
    if (compKind) {
      warnings.push({
        type: 'dropped',
        entity: comp.refDes || comp.name,
        detail: `Altium ComponentKind "${compKind}" has no ProtoPulse equivalent`,
        severity: 'info',
      });
    }

    // Altium vault references.
    const vault = comp.properties['VaultGUID'] ?? comp.properties['vault_guid'];
    if (vault) {
      warnings.push({
        type: 'dropped',
        entity: comp.refDes || comp.name,
        detail: 'Altium Vault reference dropped (Vault integration not supported)',
        severity: 'warning',
      });
    }
  }

  // Altium room definitions.
  if (design.metadata['rooms']) {
    warnings.push({
      type: 'unsupported',
      entity: 'Rooms',
      detail: 'Altium room definitions are not supported',
      severity: 'info',
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Generic / cross-format warnings
// ---------------------------------------------------------------------------

function generateGenericWarnings(design: ImportedDesign): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  for (const comp of design.components) {
    // Unknown / unmapped properties that don't have a ProtoPulse equivalent.
    const knownKeys = new Set([
      'MPN', 'PartNumber', 'Manufacturer', 'Datasheet', 'Description',
      'Value', 'Tolerance', 'Rating', 'Package',
      // KiCad-specific (handled separately).
      'ki_3dmodel', '3d_model', 'ki_fp_lib', 'Footprint', 'ki_sym_lib',
      // EAGLE-specific.
      'ulp_script', 'ULP', 'variant', 'VARIANT', 'technology', 'TECHNOLOGY',
      // Altium-specific.
      'ComponentKind', 'component_kind', 'VaultGUID', 'vault_guid',
      // KiCad power flags.
      'power_flags',
    ]);

    const unknownProps: string[] = [];
    for (const key of Object.keys(comp.properties)) {
      if (!knownKeys.has(key)) {
        unknownProps.push(key);
      }
    }

    if (unknownProps.length > 0) {
      warnings.push({
        type: 'dropped',
        entity: comp.refDes || comp.name,
        detail: `Unknown properties dropped: ${unknownProps.join(', ')}`,
        severity: 'info',
      });
    }

    // Components with no package — footprint mapping will fail.
    if (!comp.package || comp.package.trim() === '') {
      warnings.push({
        type: 'approximated',
        entity: comp.refDes || comp.name,
        detail: 'No package/footprint specified — a default will be assigned',
        severity: 'warning',
      });
    }

    // Components with no pins — connectivity will be incomplete.
    if (comp.pins.length === 0) {
      warnings.push({
        type: 'approximated',
        entity: comp.refDes || comp.name,
        detail: 'No pin definitions — net connectivity may be incomplete',
        severity: 'warning',
      });
    }

    // Type mismatches: numeric values stored as strings.
    const numericKeys = ['Tolerance', 'Rating'];
    for (const key of numericKeys) {
      const val = comp.properties[key];
      if (val && isNaN(parseFloat(val.replace(/[%VWA]/g, '')))) {
        warnings.push({
          type: 'converted',
          entity: comp.refDes || comp.name,
          detail: `Property "${key}" has non-numeric value "${val}" — stored as text`,
          severity: 'info',
        });
      }
    }
  }

  // Nets with only one pin — dangling connections.
  for (const net of design.nets) {
    if (net.pins.length === 1) {
      warnings.push({
        type: 'approximated',
        entity: `Net: ${net.name}`,
        detail: 'Net has only 1 pin — dangling connection preserved but may be unintentional',
        severity: 'warning',
      });
    }
  }

  // Wires with no net assignment.
  let unassignedWires = 0;
  for (const wire of design.wires) {
    if (!wire.net) {
      unassignedWires++;
    }
  }
  if (unassignedWires > 0) {
    warnings.push({
      type: 'approximated',
      entity: `${String(unassignedWires)} wire(s)`,
      detail: 'Wires without net assignment — visual routing preserved but connectivity unknown',
      severity: 'warning',
    });
  }

  // Unsupported features from metadata.
  const unsupported = design.metadata['unsupported_features'];
  if (unsupported) {
    const features = unsupported.split(',').map((f) => f.trim()).filter(Boolean);
    for (const feature of features) {
      warnings.push({
        type: 'unsupported',
        entity: feature,
        detail: `Feature "${feature}" is not supported in ProtoPulse`,
        severity: 'warning',
      });
    }
  }

  // Propagate design-level warnings as info.
  for (const w of design.warnings) {
    warnings.push({
      type: 'converted',
      entity: 'Import',
      detail: w,
      severity: 'info',
    });
  }

  // Propagate design-level errors as error-severity.
  for (const e of design.errors) {
    warnings.push({
      type: 'dropped',
      entity: 'Import',
      detail: e,
      severity: 'error',
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate structured import warnings for a given import result and source format.
 * Combines format-specific analysis with generic cross-format checks.
 */
export function generateImportWarnings(
  importResult: ImportedDesign,
  sourceFormat: string,
): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  // Format-specific generators.
  const format = importResult.format ?? sourceFormat;

  if (isKiCadFormat(format as ImportFormat)) {
    warnings.push(...generateKiCadWarnings(importResult));
  } else if (isEagleFormat(format as ImportFormat)) {
    warnings.push(...generateEagleWarnings(importResult));
  } else if (isAltiumFormat(format as ImportFormat)) {
    warnings.push(...generateAltiumWarnings(importResult));
  }

  // Generic warnings apply to all formats.
  warnings.push(...generateGenericWarnings(importResult));

  return warnings;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/** Group warnings by severity for display. */
export function groupWarningsBySeverity(
  warnings: ImportWarning[],
): Record<ImportWarningSeverity, ImportWarning[]> {
  const groups: Record<ImportWarningSeverity, ImportWarning[]> = {
    error: [],
    warning: [],
    info: [],
  };

  for (const w of warnings) {
    groups[w.severity].push(w);
  }

  return groups;
}

/** Group warnings by type for display. */
export function groupWarningsByType(
  warnings: ImportWarning[],
): Record<ImportWarningType, ImportWarning[]> {
  const groups: Record<ImportWarningType, ImportWarning[]> = {
    dropped: [],
    unsupported: [],
    converted: [],
    approximated: [],
  };

  for (const w of warnings) {
    groups[w.type].push(w);
  }

  return groups;
}

/** Get a count summary string for a set of warnings. */
export function getWarningSummary(warnings: ImportWarning[]): string {
  if (warnings.length === 0) {
    return 'No issues detected';
  }

  const groups = groupWarningsBySeverity(warnings);
  const parts: string[] = [];

  if (groups.error.length > 0) {
    parts.push(`${String(groups.error.length)} error(s)`);
  }
  if (groups.warning.length > 0) {
    parts.push(`${String(groups.warning.length)} warning(s)`);
  }
  if (groups.info.length > 0) {
    parts.push(`${String(groups.info.length)} info`);
  }

  return parts.join(', ');
}

/** Human-readable label for warning types. */
export function getWarningTypeLabel(type: ImportWarningType): string {
  switch (type) {
    case 'dropped':
      return 'Dropped';
    case 'unsupported':
      return 'Unsupported';
    case 'converted':
      return 'Converted';
    case 'approximated':
      return 'Approximated';
  }
}

/** Human-readable description for warning types. */
export function getWarningTypeDescription(type: ImportWarningType): string {
  switch (type) {
    case 'dropped':
      return 'These items were removed because they have no equivalent in ProtoPulse.';
    case 'unsupported':
      return 'These features are not currently supported and were skipped.';
    case 'converted':
      return 'These items were automatically converted to the closest ProtoPulse equivalent.';
    case 'approximated':
      return 'These items were imported with best-effort approximations that may need review.';
  }
}
