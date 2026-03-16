import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExportResultsManager,
  formatFileSize,
} from '../export-results';
import type { ExportResult } from '../export-results';

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe('formatFileSize', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('returns "0 B" for negative values', () => {
    expect(formatFileSize(-100)).toBe('0 B');
  });

  it('formats bytes below 1 KB', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats exactly 1 byte', () => {
    expect(formatFileSize(1)).toBe('1 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB');
  });

  it('formats kilobytes with decimals', () => {
    expect(formatFileSize(1536)).toBe('1.50 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.00 MB');
  });

  it('formats megabytes with decimals', () => {
    expect(formatFileSize(2621440)).toBe('2.50 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1.00 GB');
  });

  it('formats gigabytes with decimals', () => {
    expect(formatFileSize(1610612736)).toBe('1.50 GB');
  });

  it('formats values just under 1 KB', () => {
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('handles NaN gracefully', () => {
    expect(formatFileSize(NaN)).toBe('0 B');
  });

  it('handles Infinity gracefully', () => {
    // Infinity is > 0 and will hit the GB branch
    expect(formatFileSize(Infinity)).toBe('Infinity GB');
  });
});

// ---------------------------------------------------------------------------
// ExportResultsManager
// ---------------------------------------------------------------------------

function makeResult(overrides?: Partial<ExportResult>): ExportResult {
  return {
    formatId: 'kicad',
    formatLabel: 'KiCad Project',
    files: [
      { name: 'project.kicad_sch', sizeBytes: 4096 },
      { name: 'project.kicad_pcb', sizeBytes: 8192 },
    ],
    timestamp: Date.now(),
    success: true,
    ...overrides,
  };
}

describe('ExportResultsManager', () => {
  beforeEach(() => {
    ExportResultsManager.resetForTesting();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = ExportResultsManager.getInstance();
    const b = ExportResultsManager.getInstance();
    expect(a).toBe(b);
  });

  it('returns a new instance after resetForTesting', () => {
    const a = ExportResultsManager.getInstance();
    ExportResultsManager.resetForTesting();
    const b = ExportResultsManager.getInstance();
    expect(a).not.toBe(b);
  });

  // -------------------------------------------------------------------------
  // addResult / getResults
  // -------------------------------------------------------------------------

  it('starts with an empty results array', () => {
    const mgr = ExportResultsManager.getInstance();
    expect(mgr.getResults()).toEqual([]);
  });

  it('adds a result and retrieves it', () => {
    const mgr = ExportResultsManager.getInstance();
    const result = makeResult();
    mgr.addResult(result);
    const results = mgr.getResults();
    expect(results).toHaveLength(1);
    expect(results[0].formatId).toBe('kicad');
  });

  it('adds multiple results', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult({ formatId: 'kicad' }));
    mgr.addResult(makeResult({ formatId: 'eagle' }));
    mgr.addResult(makeResult({ formatId: 'spice' }));
    expect(mgr.getResults()).toHaveLength(3);
  });

  it('preserves insertion order (newest last)', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult({ formatId: 'first', timestamp: 1000 }));
    mgr.addResult(makeResult({ formatId: 'second', timestamp: 2000 }));
    const results = mgr.getResults();
    expect(results[0].formatId).toBe('first');
    expect(results[1].formatId).toBe('second');
  });

  it('returns defensive copies from getResults', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult());
    const a = mgr.getResults();
    const b = mgr.getResults();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  // -------------------------------------------------------------------------
  // clearResults
  // -------------------------------------------------------------------------

  it('clears all results', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult());
    mgr.addResult(makeResult());
    mgr.clearResults();
    expect(mgr.getResults()).toEqual([]);
  });

  it('clearResults on empty is a no-op', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.clearResults();
    expect(mgr.getResults()).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // FIFO eviction
  // -------------------------------------------------------------------------

  it('evicts oldest results when exceeding max (50)', () => {
    const mgr = ExportResultsManager.getInstance();
    for (let i = 0; i < 55; i++) {
      mgr.addResult(makeResult({ formatId: `format-${String(i)}`, timestamp: i }));
    }
    const results = mgr.getResults();
    expect(results).toHaveLength(50);
    // First entry should be format-5 (oldest 5 evicted)
    expect(results[0].formatId).toBe('format-5');
    // Last entry should be format-54
    expect(results[49].formatId).toBe('format-54');
  });

  it('evicts exactly one when going from 50 to 51', () => {
    const mgr = ExportResultsManager.getInstance();
    for (let i = 0; i < 50; i++) {
      mgr.addResult(makeResult({ formatId: `format-${String(i)}` }));
    }
    expect(mgr.getResults()).toHaveLength(50);
    mgr.addResult(makeResult({ formatId: 'overflow' }));
    const results = mgr.getResults();
    expect(results).toHaveLength(50);
    expect(results[0].formatId).toBe('format-1');
    expect(results[49].formatId).toBe('overflow');
  });

  // -------------------------------------------------------------------------
  // subscribe / unsubscribe
  // -------------------------------------------------------------------------

  it('notifies subscribers on addResult', () => {
    const mgr = ExportResultsManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.addResult(makeResult());
    expect(listener).toHaveBeenCalledOnce();
  });

  it('notifies subscribers on clearResults', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult());
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.clearResults();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('unsubscribe stops notifications', () => {
    const mgr = ExportResultsManager.getInstance();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.addResult(makeResult());
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple simultaneous subscribers', () => {
    const mgr = ExportResultsManager.getInstance();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    mgr.subscribe(listener1);
    mgr.subscribe(listener2);
    mgr.addResult(makeResult());
    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it('unsubscribing one does not affect the other', () => {
    const mgr = ExportResultsManager.getInstance();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const unsub1 = mgr.subscribe(listener1);
    mgr.subscribe(listener2);
    unsub1();
    mgr.addResult(makeResult());
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // getResultCount / getTotalFileCount / getTotalSize
  // -------------------------------------------------------------------------

  it('getResultCount returns number of results', () => {
    const mgr = ExportResultsManager.getInstance();
    expect(mgr.getResultCount()).toBe(0);
    mgr.addResult(makeResult());
    expect(mgr.getResultCount()).toBe(1);
    mgr.addResult(makeResult());
    expect(mgr.getResultCount()).toBe(2);
  });

  it('getTotalFileCount sums files across all results', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult({ files: [{ name: 'a.txt', sizeBytes: 100 }] }));
    mgr.addResult(makeResult({ files: [{ name: 'b.txt', sizeBytes: 200 }, { name: 'c.txt', sizeBytes: 300 }] }));
    expect(mgr.getTotalFileCount()).toBe(3);
  });

  it('getTotalSize sums all file sizes', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult({ files: [{ name: 'a.txt', sizeBytes: 100 }] }));
    mgr.addResult(makeResult({ files: [{ name: 'b.txt', sizeBytes: 200 }, { name: 'c.txt', sizeBytes: 300 }] }));
    expect(mgr.getTotalSize()).toBe(600);
  });

  it('getTotalSize returns 0 for empty results', () => {
    const mgr = ExportResultsManager.getInstance();
    expect(mgr.getTotalSize()).toBe(0);
  });

  it('getTotalFileCount returns 0 for empty results', () => {
    const mgr = ExportResultsManager.getInstance();
    expect(mgr.getTotalFileCount()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // getLatestResult
  // -------------------------------------------------------------------------

  it('getLatestResult returns undefined when empty', () => {
    const mgr = ExportResultsManager.getInstance();
    expect(mgr.getLatestResult()).toBeUndefined();
  });

  it('getLatestResult returns the most recently added result', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult({ formatId: 'first' }));
    mgr.addResult(makeResult({ formatId: 'second' }));
    expect(mgr.getLatestResult()?.formatId).toBe('second');
  });

  // -------------------------------------------------------------------------
  // failed results
  // -------------------------------------------------------------------------

  it('tracks failed export results', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult({ success: false, files: [] }));
    const results = mgr.getResults();
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });

  it('mixed success and failure results', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult({ formatId: 'ok', success: true }));
    mgr.addResult(makeResult({ formatId: 'fail', success: false, files: [] }));
    const results = mgr.getResults();
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });

  // -------------------------------------------------------------------------
  // ExportResult type shape
  // -------------------------------------------------------------------------

  it('preserves all ExportResult fields', () => {
    const mgr = ExportResultsManager.getInstance();
    const result: ExportResult = {
      formatId: 'gerber',
      formatLabel: 'Gerber + Drill',
      files: [
        { name: 'top-copper.gbr', sizeBytes: 12345 },
        { name: 'bottom-copper.gbr', sizeBytes: 6789 },
        { name: 'drill.drl', sizeBytes: 2048 },
      ],
      timestamp: 1710000000000,
      success: true,
    };
    mgr.addResult(result);
    const retrieved = mgr.getResults()[0];
    expect(retrieved.formatId).toBe('gerber');
    expect(retrieved.formatLabel).toBe('Gerber + Drill');
    expect(retrieved.files).toHaveLength(3);
    expect(retrieved.files[0].name).toBe('top-copper.gbr');
    expect(retrieved.files[0].sizeBytes).toBe(12345);
    expect(retrieved.files[2].name).toBe('drill.drl');
    expect(retrieved.timestamp).toBe(1710000000000);
    expect(retrieved.success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // removeResult
  // -------------------------------------------------------------------------

  it('removes a result by index', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult({ formatId: 'a' }));
    mgr.addResult(makeResult({ formatId: 'b' }));
    mgr.addResult(makeResult({ formatId: 'c' }));
    mgr.removeResult(1);
    const results = mgr.getResults();
    expect(results).toHaveLength(2);
    expect(results[0].formatId).toBe('a');
    expect(results[1].formatId).toBe('c');
  });

  it('removeResult with out-of-range index is a no-op', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult({ formatId: 'a' }));
    mgr.removeResult(-1);
    mgr.removeResult(5);
    expect(mgr.getResults()).toHaveLength(1);
  });

  it('removeResult notifies subscribers', () => {
    const mgr = ExportResultsManager.getInstance();
    mgr.addResult(makeResult());
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.removeResult(0);
    expect(listener).toHaveBeenCalledOnce();
  });
});
