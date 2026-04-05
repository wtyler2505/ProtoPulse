/**
 * Export profiles — pre-configured bundles of export formats for common workflows.
 *
 * Each profile groups a set of format IDs (matching ExportPanel's EXPORT_CATEGORIES)
 * with metadata for display. Profiles are immutable built-ins; user-defined profiles
 * may be layered on top in the future via localStorage.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportProfile {
  /** Unique stable identifier. */
  readonly id: string;
  /** Human-readable profile name. */
  readonly label: string;
  /** Short description shown under the label. */
  readonly description: string;
  /** Lucide icon name hint (consumed by the UI). */
  readonly iconHint: 'cpu' | 'file-text' | 'package' | 'layers';
  /** Ordered list of export format IDs included in this profile. */
  readonly formatIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Built-in profiles
// ---------------------------------------------------------------------------

const FAB_READY: ExportProfile = {
  id: 'fab-ready',
  label: 'Fab Ready',
  description: 'Manufacturing output: complete fab package plus Gerber, BOM, and pick-and-place files.',
  iconHint: 'cpu',
  formatIds: ['fab-package', 'gerber', 'pick-place', 'bom-csv'] as const,
};

const SIM_BUNDLE: ExportProfile = {
  id: 'sim-bundle',
  label: 'Sim Bundle',
  description: 'Simulation files: SPICE netlist and connectivity netlist.',
  iconHint: 'layers',
  formatIds: ['spice', 'netlist-csv'] as const,
};

const DOCUMENTATION: ExportProfile = {
  id: 'documentation',
  label: 'Documentation',
  description: 'Reports and BOM: PDF design report, FMEA, and BOM CSV.',
  iconHint: 'file-text',
  formatIds: ['pdf', 'fmea', 'bom-csv'] as const,
};

const FULL_PACKAGE: ExportProfile = {
  id: 'full-package',
  label: 'Full Package',
  description: 'Everything at once: all available export formats.',
  iconHint: 'package',
  formatIds: [
    'kicad',
    'eagle',
    'spice',
    'netlist-csv',
    'netlist-kicad',
    'fab-package',
    'gerber',
    'pick-place',
    'odb-plus-plus',
    'ipc2581',
    'etchable-pcb',
    'bom-csv',
    'fzz',
    'pdf',
    'fmea',
    'step',
    'firmware',
  ] as const,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All built-in export profiles, in display order. */
export const BUILT_IN_PROFILES: readonly ExportProfile[] = [
  FAB_READY,
  SIM_BUNDLE,
  DOCUMENTATION,
  FULL_PACKAGE,
] as const;

/**
 * Look up a profile by ID.
 * Returns `undefined` when the ID doesn't match any built-in profile.
 */
export function getProfileById(id: string): ExportProfile | undefined {
  return BUILT_IN_PROFILES.find((p) => p.id === id);
}

/**
 * Return the set of format IDs that belong to a profile.
 * Returns an empty set for unknown profile IDs.
 */
export function getProfileFormatIds(profileId: string): ReadonlySet<string> {
  const profile = getProfileById(profileId);
  if (!profile) {
    return new Set<string>();
  }
  return new Set(profile.formatIds);
}
