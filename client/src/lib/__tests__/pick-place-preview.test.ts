import { describe, it, expect } from 'vitest';
import {
  validatePlacements,
  groupBySide,
  computePlacementStats,
  parsePlacementCsv,
} from '../pick-place-preview';
import type { PlacementEntry, PlacementIssue } from '../pick-place-preview';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlacement(overrides: Partial<PlacementEntry> = {}): PlacementEntry {
  return {
    refDes: 'R1',
    partNumber: 'RC0402',
    x: 10,
    y: 20,
    rotation: 0,
    side: 'front',
    packageName: '0402',
    value: '10k',
    ...overrides,
  };
}

function issueTypes(issues: PlacementIssue[]): string[] {
  return issues.map((i) => i.type);
}

// ---------------------------------------------------------------------------
// validatePlacements
// ---------------------------------------------------------------------------

describe('validatePlacements', () => {
  it('returns no issues for valid placements', () => {
    const entries = [
      makePlacement({ refDes: 'R1', x: 5, y: 5 }),
      makePlacement({ refDes: 'C1', x: 15, y: 15 }),
    ];
    expect(validatePlacements(entries)).toEqual([]);
  });

  it('detects missing x coordinate (NaN)', () => {
    const entries = [makePlacement({ refDes: 'R1', x: NaN, y: 5 })];
    const issues = validatePlacements(entries);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issueTypes(issues)).toContain('missing-coordinates');
    expect(issues[0].severity).toBe('error');
  });

  it('detects missing y coordinate (NaN)', () => {
    const entries = [makePlacement({ refDes: 'R1', x: 5, y: NaN })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).toContain('missing-coordinates');
  });

  it('detects both coordinates missing', () => {
    const entries = [makePlacement({ refDes: 'U1', x: NaN, y: NaN })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).toContain('missing-coordinates');
  });

  it('detects Infinity as missing coordinate', () => {
    const entries = [makePlacement({ refDes: 'R2', x: Infinity, y: 5 })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).toContain('missing-coordinates');
  });

  it('detects negative rotation as invalid', () => {
    const entries = [makePlacement({ refDes: 'R1', rotation: -45 })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).toContain('invalid-rotation');
    expect(issues.find((i) => i.type === 'invalid-rotation')?.severity).toBe('warning');
  });

  it('detects rotation >= 360 as invalid', () => {
    const entries = [makePlacement({ refDes: 'R1', rotation: 360 })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).toContain('invalid-rotation');
  });

  it('accepts rotation at 0', () => {
    const entries = [makePlacement({ refDes: 'R1', rotation: 0 })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).not.toContain('invalid-rotation');
  });

  it('accepts rotation at 359.9', () => {
    const entries = [makePlacement({ refDes: 'R1', rotation: 359.9 })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).not.toContain('invalid-rotation');
  });

  it('detects NaN rotation as invalid', () => {
    const entries = [makePlacement({ refDes: 'R1', rotation: NaN })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).toContain('invalid-rotation');
  });

  it('detects empty refDes', () => {
    const entries = [makePlacement({ refDes: '' })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).toContain('unresolved-ref-des');
    expect(issues.find((i) => i.type === 'unresolved-ref-des')?.severity).toBe('error');
  });

  it('detects whitespace-only refDes', () => {
    const entries = [makePlacement({ refDes: '   ' })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).toContain('unresolved-ref-des');
  });

  it('warns on non-standard refDes pattern', () => {
    const entries = [makePlacement({ refDes: 'MyPart' })];
    const issues = validatePlacements(entries);
    const refIssue = issues.find((i) => i.type === 'unresolved-ref-des');
    expect(refIssue).toBeDefined();
    expect(refIssue?.severity).toBe('warning');
  });

  it('accepts standard refDes patterns', () => {
    const entries = [
      makePlacement({ refDes: 'R1', x: 0, y: 0 }),
      makePlacement({ refDes: 'C12', x: 5, y: 5 }),
      makePlacement({ refDes: 'U100', x: 10, y: 10 }),
    ];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).not.toContain('unresolved-ref-des');
  });

  it('detects overlapping parts on the same side', () => {
    const entries = [
      makePlacement({ refDes: 'R1', x: 10, y: 10, side: 'front' }),
      makePlacement({ refDes: 'R2', x: 10.1, y: 10.1, side: 'front' }),
    ];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).toContain('overlapping');
    const overlap = issues.find((i) => i.type === 'overlapping');
    expect(overlap?.severity).toBe('error');
    expect(overlap?.relatedRefDes).toBe('R2');
  });

  it('does not flag overlap across different sides', () => {
    const entries = [
      makePlacement({ refDes: 'R1', x: 10, y: 10, side: 'front' }),
      makePlacement({ refDes: 'R2', x: 10, y: 10, side: 'back' }),
    ];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).not.toContain('overlapping');
  });

  it('does not flag parts far enough apart', () => {
    const entries = [
      makePlacement({ refDes: 'R1', x: 0, y: 0, side: 'front' }),
      makePlacement({ refDes: 'R2', x: 5, y: 5, side: 'front' }),
    ];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).not.toContain('overlapping');
  });

  it('detects negative coordinates (off-board)', () => {
    const entries = [makePlacement({ refDes: 'R1', x: -1, y: 5 })];
    const issues = validatePlacements(entries);
    expect(issueTypes(issues)).toContain('off-board');
  });

  it('detects off-board when exceeding board dimensions', () => {
    const entries = [makePlacement({ refDes: 'R1', x: 110, y: 50 })];
    const issues = validatePlacements(entries, 100, 100);
    expect(issueTypes(issues)).toContain('off-board');
  });

  it('does not flag off-board when no board dimensions provided', () => {
    const entries = [makePlacement({ refDes: 'R1', x: 500, y: 500 })];
    const issues = validatePlacements(entries);
    // Only checks negative without board dims
    expect(issues.filter((i) => i.type === 'off-board')).toHaveLength(0);
  });

  it('handles empty entries array', () => {
    expect(validatePlacements([])).toEqual([]);
  });

  it('accumulates multiple issues for one entry', () => {
    const entries = [makePlacement({ refDes: '', x: NaN, y: NaN, rotation: -10 })];
    const issues = validatePlacements(entries);
    expect(issues.length).toBeGreaterThanOrEqual(3);
    expect(issueTypes(issues)).toContain('missing-coordinates');
    expect(issueTypes(issues)).toContain('invalid-rotation');
    expect(issueTypes(issues)).toContain('unresolved-ref-des');
  });
});

// ---------------------------------------------------------------------------
// groupBySide
// ---------------------------------------------------------------------------

describe('groupBySide', () => {
  it('separates front and back entries', () => {
    const entries = [
      makePlacement({ refDes: 'R1', side: 'front' }),
      makePlacement({ refDes: 'C1', side: 'back' }),
      makePlacement({ refDes: 'U1', side: 'front' }),
      makePlacement({ refDes: 'R2', side: 'back' }),
    ];
    const result = groupBySide(entries);
    expect(result.front).toHaveLength(2);
    expect(result.back).toHaveLength(2);
    expect(result.front.map((e) => e.refDes)).toEqual(['R1', 'U1']);
    expect(result.back.map((e) => e.refDes)).toEqual(['C1', 'R2']);
  });

  it('handles all-front entries', () => {
    const entries = [
      makePlacement({ refDes: 'R1', side: 'front' }),
      makePlacement({ refDes: 'R2', side: 'front' }),
    ];
    const result = groupBySide(entries);
    expect(result.front).toHaveLength(2);
    expect(result.back).toHaveLength(0);
  });

  it('handles all-back entries', () => {
    const entries = [
      makePlacement({ refDes: 'R1', side: 'back' }),
      makePlacement({ refDes: 'R2', side: 'back' }),
    ];
    const result = groupBySide(entries);
    expect(result.front).toHaveLength(0);
    expect(result.back).toHaveLength(2);
  });

  it('handles empty entries', () => {
    const result = groupBySide([]);
    expect(result.front).toHaveLength(0);
    expect(result.back).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computePlacementStats
// ---------------------------------------------------------------------------

describe('computePlacementStats', () => {
  it('computes stats correctly', () => {
    const entries = [
      makePlacement({ refDes: 'R1', side: 'front', packageName: '0402' }),
      makePlacement({ refDes: 'C1', side: 'back', packageName: '0603' }),
      makePlacement({ refDes: 'U1', side: 'front', packageName: 'TQFP-32' }),
    ];
    const issues: PlacementIssue[] = [
      { type: 'overlapping', severity: 'error', message: 'test', refDes: 'R1', relatedRefDes: 'C1' },
      { type: 'invalid-rotation', severity: 'warning', message: 'test', refDes: 'U1' },
      { type: 'missing-coordinates', severity: 'error', message: 'test', refDes: 'C1' },
    ];
    const stats = computePlacementStats(entries, issues);
    expect(stats.total).toBe(3);
    expect(stats.frontCount).toBe(2);
    expect(stats.backCount).toBe(1);
    expect(stats.errorCount).toBe(2);
    expect(stats.warningCount).toBe(1);
    expect(stats.uniquePackages).toBe(3);
  });

  it('handles empty inputs', () => {
    const stats = computePlacementStats([], []);
    expect(stats.total).toBe(0);
    expect(stats.frontCount).toBe(0);
    expect(stats.backCount).toBe(0);
    expect(stats.errorCount).toBe(0);
    expect(stats.warningCount).toBe(0);
    expect(stats.uniquePackages).toBe(0);
  });

  it('deduplicates packages', () => {
    const entries = [
      makePlacement({ refDes: 'R1', packageName: '0402' }),
      makePlacement({ refDes: 'R2', packageName: '0402' }),
      makePlacement({ refDes: 'R3', packageName: '0603' }),
    ];
    const stats = computePlacementStats(entries, []);
    expect(stats.uniquePackages).toBe(2);
  });

  it('excludes empty package names from uniquePackages count', () => {
    const entries = [
      makePlacement({ refDes: 'R1', packageName: '' }),
      makePlacement({ refDes: 'R2', packageName: '0402' }),
    ];
    const stats = computePlacementStats(entries, []);
    expect(stats.uniquePackages).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// parsePlacementCsv
// ---------------------------------------------------------------------------

describe('parsePlacementCsv', () => {
  it('parses a standard pick-and-place CSV', () => {
    const csv = [
      '# Pick and Place file',
      '# Board: 100.0mm x 80.0mm',
      'Designator,Val,Package,PosX,PosY,Rot,Side',
      'R1,10k,0402,5.000,10.000,0.0,top',
      'C1,100nF,0603,20.000,30.000,90.0,bottom',
    ].join('\n');

    const entries = parsePlacementCsv(csv);
    expect(entries).toHaveLength(2);
    expect(entries[0].refDes).toBe('R1');
    expect(entries[0].value).toBe('10k');
    expect(entries[0].packageName).toBe('0402');
    expect(entries[0].x).toBe(5);
    expect(entries[0].y).toBe(10);
    expect(entries[0].rotation).toBe(0);
    expect(entries[0].side).toBe('front');
    expect(entries[1].refDes).toBe('C1');
    expect(entries[1].side).toBe('back');
    expect(entries[1].rotation).toBe(90);
  });

  it('skips comment lines', () => {
    const csv = [
      '# comment 1',
      '# comment 2',
      'Designator,Val,Package,PosX,PosY,Rot,Side',
      'R1,10k,0402,5.000,10.000,0.0,top',
    ].join('\n');
    const entries = parsePlacementCsv(csv);
    expect(entries).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(parsePlacementCsv('')).toEqual([]);
  });

  it('handles CSV with only header and comments', () => {
    const csv = [
      '# comment',
      'Designator,Val,Package,PosX,PosY,Rot,Side',
    ].join('\n');
    expect(parsePlacementCsv(csv)).toEqual([]);
  });

  it('skips lines with too few columns', () => {
    const csv = [
      'Designator,Val,Package,PosX,PosY,Rot,Side',
      'R1,10k,0402,5.000',
      'C1,100nF,0603,20.000,30.000,90.0,top',
    ].join('\n');
    const entries = parsePlacementCsv(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].refDes).toBe('C1');
  });

  it('maps "bottom" side to "back"', () => {
    const csv = [
      'Designator,Val,Package,PosX,PosY,Rot,Side',
      'R1,10k,0402,5.000,10.000,0.0,bottom',
    ].join('\n');
    const entries = parsePlacementCsv(csv);
    expect(entries[0].side).toBe('back');
  });

  it('maps "back" side to "back"', () => {
    const csv = [
      'Designator,Val,Package,PosX,PosY,Rot,Side',
      'R1,10k,0402,5.000,10.000,0.0,back',
    ].join('\n');
    const entries = parsePlacementCsv(csv);
    expect(entries[0].side).toBe('back');
  });

  it('defaults unknown side values to "front"', () => {
    const csv = [
      'Designator,Val,Package,PosX,PosY,Rot,Side',
      'R1,10k,0402,5.000,10.000,0.0,middle',
    ].join('\n');
    const entries = parsePlacementCsv(csv);
    expect(entries[0].side).toBe('front');
  });

  it('sets partNumber to empty string', () => {
    const csv = [
      'Designator,Val,Package,PosX,PosY,Rot,Side',
      'R1,10k,0402,5.000,10.000,0.0,top',
    ].join('\n');
    const entries = parsePlacementCsv(csv);
    expect(entries[0].partNumber).toBe('');
  });

  it('handles blank lines', () => {
    const csv = [
      'Designator,Val,Package,PosX,PosY,Rot,Side',
      '',
      'R1,10k,0402,5.000,10.000,0.0,top',
      '',
      'C1,100nF,0603,20.000,30.000,90.0,bottom',
      '',
    ].join('\n');
    const entries = parsePlacementCsv(csv);
    expect(entries).toHaveLength(2);
  });
});
