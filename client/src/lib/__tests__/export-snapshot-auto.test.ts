import { describe, it, expect } from 'vitest';
import {
  shouldAutoSnapshot,
  formatSnapshotLabel,
  createExportSnapshot,
} from '../export-snapshot';
import type { ExportSnapshot } from '../export-snapshot';

// ---------------------------------------------------------------------------
// All 6 manufacturing format IDs (Gerber, Pick & Place, ODB++, IPC-2581,
// Etchable PCB, STEP 3D) — the formats sent to fabrication/assembly houses.
// ---------------------------------------------------------------------------

const MANUFACTURING_FORMAT_IDS = [
  'gerber',
  'pick-place',
  'odb-plus-plus',
  'ipc2581',
  'etchable-pcb',
  'step',
] as const;

const NON_MANUFACTURING_FORMAT_IDS = [
  'kicad',
  'eagle',
  'spice',
  'netlist-csv',
  'netlist-kicad',
  'bom-csv',
  'fzz',
  'pdf',
  'fmea',
  'firmware',
] as const;

const fixedDate = new Date('2026-03-16T08:00:00Z');

// ---------------------------------------------------------------------------
// shouldAutoSnapshot — manufacturing formats
// ---------------------------------------------------------------------------

describe('shouldAutoSnapshot — manufacturing formats', () => {
  it.each(MANUFACTURING_FORMAT_IDS)(
    'returns true for manufacturing format "%s"',
    (format) => {
      expect(shouldAutoSnapshot(format)).toBe(true);
    },
  );

  it('returns true for all 6 manufacturing formats collectively', () => {
    const results = MANUFACTURING_FORMAT_IDS.map(shouldAutoSnapshot);
    expect(results).toEqual([true, true, true, true, true, true]);
  });
});

// ---------------------------------------------------------------------------
// shouldAutoSnapshot — non-manufacturing formats
// ---------------------------------------------------------------------------

describe('shouldAutoSnapshot — non-manufacturing formats', () => {
  it.each(NON_MANUFACTURING_FORMAT_IDS)(
    'returns false for non-manufacturing format "%s"',
    (format) => {
      expect(shouldAutoSnapshot(format)).toBe(false);
    },
  );

  it('returns false for empty string', () => {
    expect(shouldAutoSnapshot('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(shouldAutoSnapshot('  ')).toBe(false);
  });

  it('returns false for unknown format identifier', () => {
    expect(shouldAutoSnapshot('my-custom-format')).toBe(false);
  });

  it('is case-sensitive — uppercase variant is rejected', () => {
    expect(shouldAutoSnapshot('GERBER')).toBe(false);
    expect(shouldAutoSnapshot('Gerber')).toBe(false);
    expect(shouldAutoSnapshot('IPC2581')).toBe(false);
  });

  it('rejects format ids with leading/trailing whitespace', () => {
    expect(shouldAutoSnapshot(' gerber')).toBe(false);
    expect(shouldAutoSnapshot('gerber ')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatSnapshotLabel — new manufacturing formats
// ---------------------------------------------------------------------------

describe('formatSnapshotLabel — new manufacturing format labels', () => {
  it('formats pick-place as "Pick & Place"', () => {
    expect(formatSnapshotLabel('pick-place', fixedDate)).toBe(
      'Sent to fab \u2014 Pick & Place \u2014 2026-03-16',
    );
  });

  it('formats etchable-pcb as "Etchable PCB"', () => {
    expect(formatSnapshotLabel('etchable-pcb', fixedDate)).toBe(
      'Sent to fab \u2014 Etchable PCB \u2014 2026-03-16',
    );
  });

  it('formats step as "STEP 3D"', () => {
    expect(formatSnapshotLabel('step', fixedDate)).toBe(
      'Sent to fab \u2014 STEP 3D \u2014 2026-03-16',
    );
  });

  it('every manufacturing format has a human-readable label (not raw id)', () => {
    for (const format of MANUFACTURING_FORMAT_IDS) {
      const label = formatSnapshotLabel(format, fixedDate);
      // The label should NOT contain the raw kebab-case id literally
      // (unless the human-readable form happens to match, which none do).
      expect(label).not.toContain(format);
    }
  });

  it('all labels follow "Sent to fab — {Name} — {date}" pattern', () => {
    for (const format of MANUFACTURING_FORMAT_IDS) {
      const label = formatSnapshotLabel(format, fixedDate);
      expect(label).toMatch(/^Sent to fab \u2014 .+ \u2014 \d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// createExportSnapshot — new manufacturing formats
// ---------------------------------------------------------------------------

describe('createExportSnapshot — new manufacturing formats', () => {
  it('creates a valid snapshot for pick-place', () => {
    const snap = createExportSnapshot('pick-place', fixedDate);
    expect(snap.exportFormat).toBe('pick-place');
    expect(snap.label).toContain('Pick & Place');
    expect(snap.snapshotId).toBeNull();
    expect(snap.timestamp).toBe('2026-03-16T08:00:00.000Z');
  });

  it('creates a valid snapshot for etchable-pcb', () => {
    const snap = createExportSnapshot('etchable-pcb', fixedDate);
    expect(snap.exportFormat).toBe('etchable-pcb');
    expect(snap.label).toContain('Etchable PCB');
    expect(snap.snapshotId).toBeNull();
  });

  it('creates a valid snapshot for step', () => {
    const snap = createExportSnapshot('step', fixedDate);
    expect(snap.exportFormat).toBe('step');
    expect(snap.label).toContain('STEP 3D');
    expect(snap.snapshotId).toBeNull();
  });

  it('all 6 manufacturing formats produce distinct labels', () => {
    const labels = MANUFACTURING_FORMAT_IDS.map(
      (f) => createExportSnapshot(f, fixedDate).label,
    );
    const unique = new Set(labels);
    expect(unique.size).toBe(MANUFACTURING_FORMAT_IDS.length);
  });

  it('all 6 manufacturing format snapshots have the same timestamp for same date', () => {
    const timestamps = MANUFACTURING_FORMAT_IDS.map(
      (f) => createExportSnapshot(f, fixedDate).timestamp,
    );
    const unique = new Set(timestamps);
    expect(unique.size).toBe(1);
    expect(timestamps[0]).toBe('2026-03-16T08:00:00.000Z');
  });

  it('snapshot for non-manufacturing format still works (not filtered here)', () => {
    const snap = createExportSnapshot('bom-csv', fixedDate);
    expect(snap.exportFormat).toBe('bom-csv');
    expect(snap.label).toContain('bom-csv'); // fallback — raw id used
    expect(snap.snapshotId).toBeNull();
  });

  it('satisfies ExportSnapshot interface for every manufacturing format', () => {
    for (const format of MANUFACTURING_FORMAT_IDS) {
      const snap: ExportSnapshot = createExportSnapshot(format, fixedDate);
      expect(snap).toHaveProperty('exportFormat');
      expect(snap).toHaveProperty('timestamp');
      expect(snap).toHaveProperty('snapshotId');
      expect(snap).toHaveProperty('label');
    }
  });

  it('snapshot label date matches timestamp date', () => {
    for (const format of MANUFACTURING_FORMAT_IDS) {
      const snap = createExportSnapshot(format, fixedDate);
      const dateFromTimestamp = snap.timestamp.slice(0, 10);
      expect(snap.label).toContain(dateFromTimestamp);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration — shouldAutoSnapshot + createExportSnapshot workflow
// ---------------------------------------------------------------------------

describe('export auto-snapshot integration', () => {
  it('exactly 6 formats from the full ExportPanel list trigger snapshots', () => {
    const allExportPanelFormats = [
      'kicad', 'eagle', 'spice', 'netlist-csv', 'netlist-kicad',
      'gerber', 'pick-place', 'odb-plus-plus', 'ipc2581', 'etchable-pcb',
      'bom-csv', 'fzz', 'pdf', 'fmea', 'step', 'firmware',
    ];
    const triggered = allExportPanelFormats.filter(shouldAutoSnapshot);
    expect(triggered).toHaveLength(6);
    expect(triggered).toEqual([
      'gerber', 'pick-place', 'odb-plus-plus', 'ipc2581', 'etchable-pcb', 'step',
    ]);
  });

  it('simulates export workflow: check → create → verify for each mfg format', () => {
    const exportDate = new Date('2026-07-04T14:00:00Z');

    for (const format of MANUFACTURING_FORMAT_IDS) {
      // Step 1: ExportPanel checks if snapshot needed
      expect(shouldAutoSnapshot(format)).toBe(true);

      // Step 2: create snapshot metadata
      const snap = createExportSnapshot(format, exportDate);

      // Step 3: verify metadata is suitable for POST /api/projects/:id/snapshots
      expect(snap.label.length).toBeGreaterThan(0);
      expect(snap.label.length).toBeLessThan(200);
      expect(snap.timestamp).toBe('2026-07-04T14:00:00.000Z');
      expect(snap.snapshotId).toBeNull(); // not yet persisted
      expect(snap.exportFormat).toBe(format);
    }
  });

  it('non-manufacturing exports skip snapshot creation', () => {
    for (const format of NON_MANUFACTURING_FORMAT_IDS) {
      expect(shouldAutoSnapshot(format)).toBe(false);
      // Caller should NOT call createExportSnapshot for these
    }
  });

  it('snapshot description can be derived from metadata', () => {
    const snap = createExportSnapshot('gerber', fixedDate);
    const description = `Auto-snapshot on Gerber export at ${snap.timestamp}`;
    expect(description).toContain('Auto-snapshot');
    expect(description).toContain(snap.timestamp);
  });

  it('different dates produce different labels and timestamps', () => {
    const date1 = new Date('2026-01-15T10:00:00Z');
    const date2 = new Date('2026-06-20T15:00:00Z');
    const snap1 = createExportSnapshot('gerber', date1);
    const snap2 = createExportSnapshot('gerber', date2);

    expect(snap1.timestamp).not.toBe(snap2.timestamp);
    expect(snap1.label).not.toBe(snap2.label);
    expect(snap1.label).toContain('2026-01-15');
    expect(snap2.label).toContain('2026-06-20');
  });

  it('same format + same date produces identical snapshots (deterministic)', () => {
    const snap1 = createExportSnapshot('step', fixedDate);
    const snap2 = createExportSnapshot('step', fixedDate);

    expect(snap1).toEqual(snap2);
  });
});
