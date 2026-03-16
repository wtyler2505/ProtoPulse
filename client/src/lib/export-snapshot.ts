// ---------------------------------------------------------------------------
// Export Snapshot — Auto-create design snapshots on manufacturing exports
// ---------------------------------------------------------------------------

/**
 * Manufacturing export formats that warrant an automatic design snapshot.
 * These are the formats sent to PCB fabrication houses — capturing state
 * at export time provides an audit trail of exactly what was sent to fab.
 */
const MANUFACTURING_FORMATS = new Set([
  'gerber',
  'pick-place',
  'odb-plus-plus',
  'ipc2581',
  'etchable-pcb',
  'step',
]);

/** Metadata for an auto-created export snapshot. */
export interface ExportSnapshot {
  /** The export format ID that triggered the snapshot (e.g. 'gerber'). */
  exportFormat: string;
  /** ISO-8601 timestamp of when the export occurred. */
  timestamp: string;
  /** Server-assigned snapshot ID (populated after creation). */
  snapshotId: number | null;
  /** Human-readable label for the snapshot. */
  label: string;
}

/**
 * Determine whether an export format should trigger an automatic design snapshot.
 *
 * Returns `true` for manufacturing formats (Gerber, ODB++, IPC-2581) — these
 * represent files sent to a fabrication house, so capturing the exact design
 * state at that moment is critical for traceability.
 */
export function shouldAutoSnapshot(format: string): boolean {
  return MANUFACTURING_FORMATS.has(format);
}

/**
 * Format a human-readable snapshot label for a manufacturing export.
 *
 * @param format - The export format ID (e.g. 'gerber', 'odb-plus-plus', 'ipc2581')
 * @param date   - Optional date to use (defaults to `new Date()`)
 * @returns A label like "Sent to fab — Gerber — 2026-03-15"
 */
export function formatSnapshotLabel(format: string, date?: Date): string {
  const d = date ?? new Date();
  const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD

  const formatLabels: Record<string, string> = {
    'gerber': 'Gerber',
    'pick-place': 'Pick & Place',
    'odb-plus-plus': 'ODB++',
    'ipc2581': 'IPC-2581',
    'etchable-pcb': 'Etchable PCB',
    'step': 'STEP 3D',
  };

  const formatName = formatLabels[format] ?? format;
  return `Sent to fab \u2014 ${formatName} \u2014 ${dateStr}`;
}

/**
 * Build an {@link ExportSnapshot} descriptor for a given export format.
 *
 * This does NOT persist the snapshot — it only creates the metadata object.
 * The caller is responsible for POSTing to the snapshots API.
 *
 * @param format - The export format ID
 * @param date   - Optional date override (defaults to `new Date()`)
 * @returns An `ExportSnapshot` with `snapshotId` set to `null` (not yet persisted)
 */
export function createExportSnapshot(format: string, date?: Date): ExportSnapshot {
  const d = date ?? new Date();
  return {
    exportFormat: format,
    timestamp: d.toISOString(),
    snapshotId: null,
    label: formatSnapshotLabel(format, d),
  };
}
