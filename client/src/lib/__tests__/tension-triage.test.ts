import { describe, expect, it } from 'vitest';
import { getTopTension, rankTensions } from '@/lib/tension-triage';

describe('tension-triage', () => {
  it('prioritizes session-speed errors over slower warnings', () => {
    const ranked = rankTensions([
      { id: 'a', title: 'sync mismatch', sourceType: 'sync_conflict', severity: 'warning' },
      { id: 'b', title: 'branch conflict', sourceType: 'branch_merge', severity: 'error' },
      { id: 'c', title: 'minor note', sourceType: 'other', severity: 'warning' },
    ]);

    expect(ranked[0]?.conflict.id).toBe('b');
    expect(ranked[0]?.consequenceSpeed).toBe('session');
  });

  it('returns null for empty queue', () => {
    expect(getTopTension([])).toBeNull();
  });
});

