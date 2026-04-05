import { describe, it, expect } from 'vitest';
import {
  shouldAutoSnapshot,
  formatSnapshotLabel,
  createExportSnapshot,
} from '../export-snapshot';
import type { ExportSnapshot } from '../export-snapshot';

// ---------------------------------------------------------------------------
// shouldAutoSnapshot
// ---------------------------------------------------------------------------

describe('shouldAutoSnapshot', () => {
  it('returns true for fab-package format', () => {
    expect(shouldAutoSnapshot('fab-package')).toBe(true);
  });

  it('returns true for gerber format', () => {
    expect(shouldAutoSnapshot('gerber')).toBe(true);
  });

  it('returns true for ODB++ format', () => {
    expect(shouldAutoSnapshot('odb-plus-plus')).toBe(true);
  });

  it('returns true for IPC-2581 format', () => {
    expect(shouldAutoSnapshot('ipc2581')).toBe(true);
  });

  it('returns false for kicad schematic format', () => {
    expect(shouldAutoSnapshot('kicad')).toBe(false);
  });

  it('returns false for eagle format', () => {
    expect(shouldAutoSnapshot('eagle')).toBe(false);
  });

  it('returns false for spice netlist format', () => {
    expect(shouldAutoSnapshot('spice')).toBe(false);
  });

  it('returns false for bom-csv format', () => {
    expect(shouldAutoSnapshot('bom-csv')).toBe(false);
  });

  it('returns false for pdf format', () => {
    expect(shouldAutoSnapshot('pdf')).toBe(false);
  });

  it('returns false for firmware format', () => {
    expect(shouldAutoSnapshot('firmware')).toBe(false);
  });

  it('returns true for pick-place format', () => {
    expect(shouldAutoSnapshot('pick-place')).toBe(true);
  });

  it('returns true for etchable-pcb format', () => {
    expect(shouldAutoSnapshot('etchable-pcb')).toBe(true);
  });

  it('returns true for step format', () => {
    expect(shouldAutoSnapshot('step')).toBe(true);
  });

  it('returns false for unknown format', () => {
    expect(shouldAutoSnapshot('unknown-format')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(shouldAutoSnapshot('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatSnapshotLabel
// ---------------------------------------------------------------------------

describe('formatSnapshotLabel', () => {
  const fixedDate = new Date('2026-03-15T10:30:00Z');

  it('formats gerber label with date', () => {
    expect(formatSnapshotLabel('gerber', fixedDate)).toBe(
      'Sent to fab \u2014 Gerber \u2014 2026-03-15',
    );
  });

  it('formats fab-package label with date', () => {
    expect(formatSnapshotLabel('fab-package', fixedDate)).toBe(
      'Sent to fab \u2014 Fab Package \u2014 2026-03-15',
    );
  });

  it('formats ODB++ label with date', () => {
    expect(formatSnapshotLabel('odb-plus-plus', fixedDate)).toBe(
      'Sent to fab \u2014 ODB++ \u2014 2026-03-15',
    );
  });

  it('formats IPC-2581 label with date', () => {
    expect(formatSnapshotLabel('ipc2581', fixedDate)).toBe(
      'Sent to fab \u2014 IPC-2581 \u2014 2026-03-15',
    );
  });

  it('uses format id as fallback for unknown formats', () => {
    expect(formatSnapshotLabel('my-custom-format', fixedDate)).toBe(
      'Sent to fab \u2014 my-custom-format \u2014 2026-03-15',
    );
  });

  it('uses current date when no date is provided', () => {
    const label = formatSnapshotLabel('gerber');
    const today = new Date().toISOString().slice(0, 10);
    expect(label).toBe(`Sent to fab \u2014 Gerber \u2014 ${today}`);
  });

  it('handles midnight UTC date correctly', () => {
    const midnight = new Date('2026-01-01T00:00:00Z');
    expect(formatSnapshotLabel('gerber', midnight)).toBe(
      'Sent to fab \u2014 Gerber \u2014 2026-01-01',
    );
  });

  it('handles end-of-year date correctly', () => {
    const endOfYear = new Date('2026-12-31T23:59:59Z');
    expect(formatSnapshotLabel('ipc2581', endOfYear)).toBe(
      'Sent to fab \u2014 IPC-2581 \u2014 2026-12-31',
    );
  });
});

// ---------------------------------------------------------------------------
// createExportSnapshot
// ---------------------------------------------------------------------------

describe('createExportSnapshot', () => {
  const fixedDate = new Date('2026-03-15T14:30:00Z');

  it('creates a snapshot with correct exportFormat', () => {
    const snap = createExportSnapshot('gerber', fixedDate);
    expect(snap.exportFormat).toBe('gerber');
  });

  it('creates a snapshot with ISO timestamp', () => {
    const snap = createExportSnapshot('gerber', fixedDate);
    expect(snap.timestamp).toBe('2026-03-15T14:30:00.000Z');
  });

  it('creates a snapshot with null snapshotId (not yet persisted)', () => {
    const snap = createExportSnapshot('gerber', fixedDate);
    expect(snap.snapshotId).toBeNull();
  });

  it('creates a snapshot with formatted label', () => {
    const snap = createExportSnapshot('gerber', fixedDate);
    expect(snap.label).toBe('Sent to fab \u2014 Gerber \u2014 2026-03-15');
  });

  it('uses current date when no date is provided', () => {
    const snap = createExportSnapshot('odb-plus-plus');
    const today = new Date().toISOString().slice(0, 10);
    expect(snap.label).toContain(today);
    expect(snap.timestamp).toBeTruthy();
  });

  it('returns all required ExportSnapshot fields', () => {
    const snap = createExportSnapshot('ipc2581', fixedDate);
    const keys = Object.keys(snap).sort();
    expect(keys).toEqual(['exportFormat', 'label', 'snapshotId', 'timestamp']);
  });

  it('snapshot satisfies ExportSnapshot interface', () => {
    const snap: ExportSnapshot = createExportSnapshot('gerber', fixedDate);
    expect(snap.exportFormat).toBe('gerber');
    expect(snap.timestamp).toBe('2026-03-15T14:30:00.000Z');
    expect(snap.snapshotId).toBeNull();
    expect(snap.label).toContain('Gerber');
  });

  it('creates distinct snapshots for different formats', () => {
    const gerber = createExportSnapshot('gerber', fixedDate);
    const odb = createExportSnapshot('odb-plus-plus', fixedDate);
    const ipc = createExportSnapshot('ipc2581', fixedDate);

    expect(gerber.exportFormat).not.toBe(odb.exportFormat);
    expect(odb.exportFormat).not.toBe(ipc.exportFormat);
    expect(gerber.label).not.toBe(odb.label);
    expect(odb.label).not.toBe(ipc.label);
  });

  it('creates snapshots with matching timestamp and label date', () => {
    const snap = createExportSnapshot('gerber', fixedDate);
    const timestampDate = snap.timestamp.slice(0, 10);
    expect(snap.label).toContain(timestampDate);
  });
});

// ---------------------------------------------------------------------------
// Integration — shouldAutoSnapshot + createExportSnapshot together
// ---------------------------------------------------------------------------

describe('export snapshot integration', () => {
  it('only creates snapshots for manufacturing formats', () => {
    const allFormats = [
      'kicad', 'eagle', 'spice', 'netlist-csv', 'netlist-kicad',
      'fab-package', 'gerber', 'pick-place', 'odb-plus-plus', 'ipc2581', 'etchable-pcb',
      'bom-csv', 'fzz', 'pdf', 'fmea', 'step', 'firmware',
    ];
    const snapshotFormats = allFormats.filter(shouldAutoSnapshot);
    expect(snapshotFormats).toEqual(['fab-package', 'gerber', 'pick-place', 'odb-plus-plus', 'ipc2581', 'etchable-pcb', 'step']);
  });

  it('every manufacturing format produces a valid snapshot', () => {
    const fixedDate = new Date('2026-06-01T12:00:00Z');
    const mfgFormats = ['fab-package', 'gerber', 'pick-place', 'odb-plus-plus', 'ipc2581', 'etchable-pcb', 'step'];

    for (const format of mfgFormats) {
      expect(shouldAutoSnapshot(format)).toBe(true);
      const snap = createExportSnapshot(format, fixedDate);
      expect(snap.exportFormat).toBe(format);
      expect(snap.snapshotId).toBeNull();
      expect(snap.label).toContain('Sent to fab');
      expect(snap.label).toContain('2026-06-01');
      expect(snap.timestamp).toBe('2026-06-01T12:00:00.000Z');
    }
  });

  it('non-manufacturing formats are correctly excluded', () => {
    const nonMfg = ['kicad', 'eagle', 'spice', 'bom-csv', 'pdf', 'firmware', 'fzz'];
    for (const format of nonMfg) {
      expect(shouldAutoSnapshot(format)).toBe(false);
    }
  });
});
