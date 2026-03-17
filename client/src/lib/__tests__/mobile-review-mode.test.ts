import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  MobileReviewManager,
  useReviewMode,
  getReviewableItems,
  getReviewProgress,
} from '../mobile-review-mode';
import type {
  ReviewModeConfig,
  ReviewItem,
  ReviewableProject,
  ProjectComment,
  ProjectValidationIssue,
  ProjectDrcViolation,
} from '../mobile-review-mode';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeComment(overrides: Partial<ProjectComment> = {}): ProjectComment {
  return {
    id: 1,
    content: 'Review this connection',
    status: 'open',
    createdAt: '2026-03-10T12:00:00Z',
    ...overrides,
  };
}

function makeValidation(overrides: Partial<ProjectValidationIssue> = {}): ProjectValidationIssue {
  return {
    id: 100,
    severity: 'warning',
    message: 'Missing decoupling capacitor',
    componentId: 'node-1',
    suggestion: 'Add a 100nF cap near VCC',
    ...overrides,
  };
}

function makeDrc(overrides: Partial<ProjectDrcViolation> = {}): ProjectDrcViolation {
  return {
    id: 'drc-001',
    ruleType: 'min-clearance',
    severity: 'error',
    message: 'Clearance violation between U1 pad 3 and R2 pad 1',
    shapeIds: ['shape-a', 'shape-b'],
    suggestion: 'Increase spacing to at least 0.2mm',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MobileReviewManager
// ---------------------------------------------------------------------------

describe('MobileReviewManager', () => {
  let manager: MobileReviewManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    MobileReviewManager.resetInstance();
    manager = MobileReviewManager.getInstance();
  });

  afterEach(() => {
    MobileReviewManager.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = MobileReviewManager.getInstance();
    const b = MobileReviewManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    manager.updateConfig({ compactLayout: true });
    MobileReviewManager.resetInstance();
    const fresh = MobileReviewManager.getInstance();
    // Fresh instance loads from localStorage, so it should retain the config
    expect(fresh.getConfig().compactLayout).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Default config
  // -----------------------------------------------------------------------

  it('starts with default config when localStorage is empty', () => {
    const config = manager.getConfig();
    expect(config).toEqual({
      showComments: true,
      showValidation: true,
      showDrc: true,
      compactLayout: false,
    });
  });

  // -----------------------------------------------------------------------
  // getConfig returns a copy
  // -----------------------------------------------------------------------

  it('returns a defensive copy from getConfig', () => {
    const a = manager.getConfig();
    const b = manager.getConfig();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  // -----------------------------------------------------------------------
  // updateConfig
  // -----------------------------------------------------------------------

  it('merges partial config', () => {
    manager.updateConfig({ showComments: false, compactLayout: true });
    const config = manager.getConfig();
    expect(config.showComments).toBe(false);
    expect(config.compactLayout).toBe(true);
    // Unchanged fields remain at defaults
    expect(config.showValidation).toBe(true);
    expect(config.showDrc).toBe(true);
  });

  it('does not notify when updating with same values', () => {
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.updateConfig({ showComments: true }); // same as default
    expect(spy).not.toHaveBeenCalled();
  });

  it('persists config to localStorage on update', () => {
    manager.updateConfig({ showDrc: false });
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse-mobile-review-config',
      expect.any(String),
    );
    const stored = JSON.parse(
      (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1] as string,
    ) as ReviewModeConfig;
    expect(stored.showDrc).toBe(false);
  });

  // -----------------------------------------------------------------------
  // toggleConfig
  // -----------------------------------------------------------------------

  it('toggles a boolean config field', () => {
    expect(manager.isEnabled('compactLayout')).toBe(false);
    manager.toggleConfig('compactLayout');
    expect(manager.isEnabled('compactLayout')).toBe(true);
    manager.toggleConfig('compactLayout');
    expect(manager.isEnabled('compactLayout')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // resetConfig
  // -----------------------------------------------------------------------

  it('resets all fields to defaults', () => {
    manager.updateConfig({ showComments: false, showValidation: false, showDrc: false, compactLayout: true });
    manager.resetConfig();
    expect(manager.getConfig()).toEqual({
      showComments: true,
      showValidation: true,
      showDrc: true,
      compactLayout: false,
    });
  });

  it('does not notify when already at defaults', () => {
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.resetConfig();
    expect(spy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  it('notifies subscribers on updateConfig', () => {
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.updateConfig({ showComments: false });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on toggleConfig', () => {
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.toggleConfig('compactLayout');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on resetConfig', () => {
    manager.updateConfig({ compactLayout: true });
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.resetConfig();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes correctly', () => {
    const spy = vi.fn();
    const unsub = manager.subscribe(spy);
    unsub();
    manager.toggleConfig('showDrc');
    expect(spy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Persistence — load
  // -----------------------------------------------------------------------

  it('loads config from localStorage on init', () => {
    const saved: ReviewModeConfig = {
      showComments: false,
      showValidation: true,
      showDrc: false,
      compactLayout: true,
    };
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(saved));
    MobileReviewManager.resetInstance();
    const fresh = MobileReviewManager.getInstance();
    expect(fresh.getConfig()).toEqual(saved);
  });

  it('ignores corrupt localStorage data gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-json!!{{{');
    MobileReviewManager.resetInstance();
    const fresh = MobileReviewManager.getInstance();
    // Should fall back to defaults
    expect(fresh.getConfig().showComments).toBe(true);
  });

  it('ignores non-object localStorage data', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('"a string"');
    MobileReviewManager.resetInstance();
    const fresh = MobileReviewManager.getInstance();
    expect(fresh.getConfig().showComments).toBe(true);
  });

  it('ignores array localStorage data', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('[1, 2, 3]');
    MobileReviewManager.resetInstance();
    const fresh = MobileReviewManager.getInstance();
    expect(fresh.getConfig().showComments).toBe(true);
  });

  it('ignores non-boolean fields in stored config', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({ showComments: 'yes', showDrc: false }),
    );
    MobileReviewManager.resetInstance();
    const fresh = MobileReviewManager.getInstance();
    // 'yes' is not boolean, should keep default true
    expect(fresh.getConfig().showComments).toBe(true);
    // false is boolean, should be applied
    expect(fresh.getConfig().showDrc).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getReviewableItems
// ---------------------------------------------------------------------------

describe('getReviewableItems', () => {
  it('returns empty array for empty project', () => {
    const items = getReviewableItems({});
    expect(items).toEqual([]);
  });

  it('converts comments to review items', () => {
    const project: ReviewableProject = {
      comments: [makeComment({ id: 5, content: 'Check R1 value' })],
    };
    const items = getReviewableItems(project);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('comment-5');
    expect(items[0].source).toBe('comment');
    expect(items[0].severity).toBe('info');
    expect(items[0].title).toBe('Check R1 value');
    expect(items[0].resolved).toBe(false);
  });

  it('converts validation issues to review items', () => {
    const project: ReviewableProject = {
      validationIssues: [
        makeValidation({ id: 42, severity: 'error', message: 'Missing GND', suggestion: 'Add ground plane' }),
      ],
    };
    const items = getReviewableItems(project);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('validation-42');
    expect(items[0].source).toBe('validation');
    expect(items[0].severity).toBe('error');
    expect(items[0].description).toContain('Missing GND');
    expect(items[0].description).toContain('Add ground plane');
  });

  it('converts DRC violations to review items', () => {
    const project: ReviewableProject = {
      drcViolations: [makeDrc({ id: 'v1', ruleType: 'pad-size', severity: 'warning', message: 'Pad too small' })],
    };
    const items = getReviewableItems(project);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('drc-v1');
    expect(items[0].source).toBe('drc');
    expect(items[0].severity).toBe('warning');
    expect(items[0].title).toContain('[pad-size]');
  });

  it('sorts by severity: error > warning > info', () => {
    const project: ReviewableProject = {
      comments: [makeComment({ id: 1, content: 'Nice work' })],
      validationIssues: [makeValidation({ id: 2, severity: 'warning', message: 'Missing cap' })],
      drcViolations: [makeDrc({ id: 'd1', severity: 'error', message: 'Short circuit' })],
    };
    const items = getReviewableItems(project);
    expect(items[0].severity).toBe('error');
    expect(items[1].severity).toBe('warning');
    expect(items[2].severity).toBe('info');
  });

  it('sorts by timestamp within same severity (newest first)', () => {
    const project: ReviewableProject = {
      comments: [
        makeComment({ id: 1, content: 'Older', createdAt: '2026-01-01T00:00:00Z' }),
        makeComment({ id: 2, content: 'Newer', createdAt: '2026-03-15T00:00:00Z' }),
      ],
    };
    const items = getReviewableItems(project);
    expect(items[0].id).toBe('comment-2'); // newer first
    expect(items[1].id).toBe('comment-1');
  });

  it('uses stable ID sort as tiebreaker', () => {
    const project: ReviewableProject = {
      validationIssues: [
        makeValidation({ id: 2, severity: 'warning', message: 'B issue' }),
        makeValidation({ id: 1, severity: 'warning', message: 'A issue' }),
      ],
    };
    const items = getReviewableItems(project);
    // Both have same severity and timestamp=0, so sort by id string
    expect(items[0].id).toBe('validation-1');
    expect(items[1].id).toBe('validation-2');
  });

  it('filters sources based on config', () => {
    const project: ReviewableProject = {
      comments: [makeComment()],
      validationIssues: [makeValidation()],
      drcViolations: [makeDrc()],
    };
    const config: ReviewModeConfig = {
      showComments: false,
      showValidation: true,
      showDrc: false,
      compactLayout: false,
    };
    const items = getReviewableItems(project, config);
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('validation');
  });

  it('includes all sources when config is not provided', () => {
    const project: ReviewableProject = {
      comments: [makeComment()],
      validationIssues: [makeValidation()],
      drcViolations: [makeDrc()],
    };
    const items = getReviewableItems(project);
    expect(items).toHaveLength(3);
    const sources = items.map((i) => i.source);
    expect(sources).toContain('comment');
    expect(sources).toContain('validation');
    expect(sources).toContain('drc');
  });

  it('normalizes unknown severity to info', () => {
    const project: ReviewableProject = {
      validationIssues: [makeValidation({ severity: 'critical' })],
    };
    const items = getReviewableItems(project);
    expect(items[0].severity).toBe('info');
  });

  it('truncates long titles', () => {
    const longMessage = 'A'.repeat(200);
    const project: ReviewableProject = {
      validationIssues: [makeValidation({ message: longMessage })],
    };
    const items = getReviewableItems(project);
    expect(items[0].title.length).toBeLessThanOrEqual(80);
    expect(items[0].title.endsWith('\u2026')).toBe(true);
  });

  it('handles resolved comments', () => {
    const project: ReviewableProject = {
      comments: [makeComment({ status: 'resolved' })],
    };
    const items = getReviewableItems(project);
    expect(items[0].resolved).toBe(true);
  });

  it('handles validation without suggestion', () => {
    const project: ReviewableProject = {
      validationIssues: [makeValidation({ suggestion: null })],
    };
    const items = getReviewableItems(project);
    expect(items[0].description).toBe('Missing decoupling capacitor');
  });

  it('handles DRC without ruleType', () => {
    const project: ReviewableProject = {
      drcViolations: [makeDrc({ ruleType: undefined, message: 'Generic violation' })],
    };
    const items = getReviewableItems(project);
    expect(items[0].title).not.toContain('[');
  });

  it('uses nodeIds as fallback targetId when shapeIds absent', () => {
    const project: ReviewableProject = {
      drcViolations: [makeDrc({ shapeIds: undefined, nodeIds: ['n1', 'n2'] })],
    };
    const items = getReviewableItems(project);
    expect(items[0].targetId).toBe('n1');
  });

  it('handles null/undefined createdAt on comments', () => {
    const project: ReviewableProject = {
      comments: [makeComment({ createdAt: null }), makeComment({ id: 2, createdAt: undefined })],
    };
    const items = getReviewableItems(project);
    expect(items).toHaveLength(2);
    // Both should have timestamp 0
    expect(items.every((i) => i.timestamp === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getReviewProgress
// ---------------------------------------------------------------------------

describe('getReviewProgress', () => {
  it('returns 100% for empty items', () => {
    const progress = getReviewProgress([]);
    expect(progress.total).toBe(0);
    expect(progress.resolved).toBe(0);
    expect(progress.pending).toBe(0);
    expect(progress.percentComplete).toBe(100);
  });

  it('computes totals correctly', () => {
    const items: ReviewItem[] = [
      { id: '1', source: 'comment', severity: 'info', title: 'A', description: 'A', resolved: true, timestamp: 0 },
      { id: '2', source: 'validation', severity: 'warning', title: 'B', description: 'B', resolved: false, timestamp: 0 },
      { id: '3', source: 'drc', severity: 'error', title: 'C', description: 'C', resolved: false, timestamp: 0 },
    ];
    const progress = getReviewProgress(items);
    expect(progress.total).toBe(3);
    expect(progress.resolved).toBe(1);
    expect(progress.pending).toBe(2);
    expect(progress.percentComplete).toBe(33); // Math.round(1/3 * 100)
  });

  it('breaks down by severity', () => {
    const items: ReviewItem[] = [
      { id: '1', source: 'drc', severity: 'error', title: '', description: '', resolved: true, timestamp: 0 },
      { id: '2', source: 'drc', severity: 'error', title: '', description: '', resolved: false, timestamp: 0 },
      { id: '3', source: 'validation', severity: 'warning', title: '', description: '', resolved: true, timestamp: 0 },
    ];
    const progress = getReviewProgress(items);
    expect(progress.bySeverity.error).toEqual({ total: 2, resolved: 1 });
    expect(progress.bySeverity.warning).toEqual({ total: 1, resolved: 1 });
    expect(progress.bySeverity.info).toEqual({ total: 0, resolved: 0 });
  });

  it('breaks down by source', () => {
    const items: ReviewItem[] = [
      { id: '1', source: 'comment', severity: 'info', title: '', description: '', resolved: true, timestamp: 0 },
      { id: '2', source: 'comment', severity: 'info', title: '', description: '', resolved: false, timestamp: 0 },
      { id: '3', source: 'drc', severity: 'error', title: '', description: '', resolved: false, timestamp: 0 },
    ];
    const progress = getReviewProgress(items);
    expect(progress.bySource.comment).toEqual({ total: 2, resolved: 1 });
    expect(progress.bySource.validation).toEqual({ total: 0, resolved: 0 });
    expect(progress.bySource.drc).toEqual({ total: 1, resolved: 0 });
  });

  it('computes 100% when all resolved', () => {
    const items: ReviewItem[] = [
      { id: '1', source: 'comment', severity: 'info', title: '', description: '', resolved: true, timestamp: 0 },
      { id: '2', source: 'validation', severity: 'warning', title: '', description: '', resolved: true, timestamp: 0 },
    ];
    const progress = getReviewProgress(items);
    expect(progress.percentComplete).toBe(100);
    expect(progress.pending).toBe(0);
  });

  it('computes 0% when none resolved', () => {
    const items: ReviewItem[] = [
      { id: '1', source: 'drc', severity: 'error', title: '', description: '', resolved: false, timestamp: 0 },
      { id: '2', source: 'drc', severity: 'error', title: '', description: '', resolved: false, timestamp: 0 },
    ];
    const progress = getReviewProgress(items);
    expect(progress.percentComplete).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useReviewMode hook
// ---------------------------------------------------------------------------

describe('useReviewMode', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    MobileReviewManager.resetInstance();
  });

  afterEach(() => {
    MobileReviewManager.resetInstance();
  });

  it('returns default config on first render', () => {
    const { result } = renderHook(() => useReviewMode());
    expect(result.current.config).toEqual({
      showComments: true,
      showValidation: true,
      showDrc: true,
      compactLayout: false,
    });
  });

  it('updates config via hook', () => {
    const { result } = renderHook(() => useReviewMode());
    act(() => {
      result.current.updateConfig({ showComments: false });
    });
    expect(result.current.config.showComments).toBe(false);
  });

  it('toggles config via hook', () => {
    const { result } = renderHook(() => useReviewMode());
    act(() => {
      result.current.toggleConfig('compactLayout');
    });
    expect(result.current.config.compactLayout).toBe(true);
    act(() => {
      result.current.toggleConfig('compactLayout');
    });
    expect(result.current.config.compactLayout).toBe(false);
  });

  it('resets config via hook', () => {
    const { result } = renderHook(() => useReviewMode());
    act(() => {
      result.current.updateConfig({ showComments: false, compactLayout: true });
    });
    act(() => {
      result.current.resetConfig();
    });
    expect(result.current.config).toEqual({
      showComments: true,
      showValidation: true,
      showDrc: true,
      compactLayout: false,
    });
  });

  it('isEnabled reflects current config state', () => {
    const { result } = renderHook(() => useReviewMode());
    expect(result.current.isEnabled('showDrc')).toBe(true);
    act(() => {
      result.current.toggleConfig('showDrc');
    });
    expect(result.current.isEnabled('showDrc')).toBe(false);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useReviewMode());
    unmount();
    // Should not throw when manager notifies after unmount
    expect(() => {
      MobileReviewManager.getInstance().toggleConfig('compactLayout');
    }).not.toThrow();
  });
});
