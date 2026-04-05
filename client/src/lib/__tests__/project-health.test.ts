import { describe, expect, it } from 'vitest';

import { buildProjectHealthSummary } from '@/lib/project-health';

describe('buildProjectHealthSummary', () => {
  it('reports saving state while writes are in flight', () => {
    const result = buildProjectHealthSummary({
      isSaving: true,
      lastSavedAt: new Date('2026-04-01T10:15:00.000Z'),
      manufacturingCheckpointCount: 1,
      restorePointCount: 2,
      restoreStatus: 'ready',
    });

    expect(result.actionLabel).toBe('Review restore points');
    expect(result.actionMode).toBe('openDesignHistory');
    expect(result.badgeLabel).toBe('Saving');
    expect(result.summary).toBe('Saving project changes');
    expect(result.facts.some((fact) => fact.label.includes('2 restore points'))).toBe(true);
  });

  it('surfaces saved restore points when available', () => {
    const result = buildProjectHealthSummary({
      isSaving: false,
      lastSavedAt: new Date('2026-04-01T10:15:00.000Z'),
      manufacturingCheckpointCount: 1,
      restorePointCount: 3,
      restoreStatus: 'ready',
    });

    expect(result.actionLabel).toBe('Review snapshots');
    expect(result.actionMode).toBe('openDesignHistory');
    expect(result.badgeLabel).toBe('Saved + restore');
    expect(result.summary).toBe('Saved with 3 restore points');
    expect(result.facts.some((fact) => fact.label === '1 fab checkpoint')).toBe(true);
  });

  it('warns when restore status is unavailable', () => {
    const result = buildProjectHealthSummary({
      isSaving: false,
      lastSavedAt: null,
      manufacturingCheckpointCount: 0,
      restorePointCount: 0,
      restoreStatus: 'unavailable',
    });

    expect(result.actionLabel).toBe('Check restore points');
    expect(result.actionMode).toBe('openDesignHistory');
    expect(result.badgeLabel).toBe('Restore unknown');
    expect(result.tone).toBe('warning');
    expect(result.detail).toContain('could not verify design restore points');
  });

  it('encourages a first restore point when none exist', () => {
    const result = buildProjectHealthSummary({
      isSaving: false,
      lastSavedAt: null,
      manufacturingCheckpointCount: 0,
      restorePointCount: 0,
      restoreStatus: 'ready',
    });

    expect(result.actionLabel).toBe('Create restore point');
    expect(result.actionMode).toBe('createSnapshot');
    expect(result.badgeLabel).toBe('Saved');
    expect(result.facts.some((fact) => fact.label === 'No restore point yet')).toBe(true);
    expect(result.detail).toContain('Capture a snapshot before a risky refactor or export');
  });
});
