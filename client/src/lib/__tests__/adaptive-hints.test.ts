import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdaptiveHintAdvisor, HINT_CATALOG } from '../adaptive-hints';

// Mock localStorage
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  AdaptiveHintAdvisor.resetInstance();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (_i: number) => null,
  });
});

describe('AdaptiveHintAdvisor', () => {
  it('returns hints for a specific view', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const hints = advisor.getHintsForView('architecture', 'beginner');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.every(h => h.view === 'architecture')).toBe(true);
  });

  it('filters by skill level — beginner sees beginner-only hints', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const hints = advisor.getHintsForView('schematic', 'beginner');
    // Should include beginner hints, not advanced-only
    const advancedOnly = hints.filter(h => h.minLevel === 'advanced');
    expect(advancedOnly).toHaveLength(0);
  });

  it('filters by skill level — advanced user sees advanced hints', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const hints = advisor.getHintsForView('schematic', 'advanced');
    // Should include hints with maxLevel=advanced
    const hasAdvanced = hints.some(h => h.maxLevel === 'advanced');
    expect(hasAdvanced).toBe(true);
  });

  it('beginner does not see intermediate-to-advanced only hints', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const hints = advisor.getHintsForView('schematic', 'beginner');
    const intermOnly = hints.filter(h => h.minLevel === 'intermediate');
    expect(intermOnly).toHaveLength(0);
  });

  it('intermediate user sees beginner+intermediate hints but not advanced-only', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    // Get all architecture hints for intermediate
    const hints = advisor.getAllHints('intermediate');
    // Should not include hints where minLevel='advanced'
    const advancedMin = hints.filter(h => h.minLevel === 'advanced');
    expect(advancedMin).toHaveLength(0);
  });

  it('dismisses a hint', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const hintsBefore = advisor.getHintsForView('architecture', 'beginner');
    const firstHint = hintsBefore[0];
    expect(firstHint).toBeDefined();

    advisor.dismissHint(firstHint.id);
    const hintsAfter = advisor.getHintsForView('architecture', 'beginner');
    expect(hintsAfter.find(h => h.id === firstHint.id)).toBeUndefined();
  });

  it('persists dismissed hints to localStorage', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const hints = advisor.getHintsForView('architecture', 'beginner');
    advisor.dismissHint(hints[0].id);

    // Reset singleton and recreate
    AdaptiveHintAdvisor.resetInstance();
    const advisor2 = AdaptiveHintAdvisor.getInstance();
    expect(advisor2.isDismissed(hints[0].id)).toBe(true);
  });

  it('resets all dismissals', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const hints = advisor.getHintsForView('architecture', 'beginner');
    advisor.dismissHint(hints[0].id);
    expect(advisor.getDismissedCount()).toBe(1);

    advisor.resetDismissals();
    expect(advisor.getDismissedCount()).toBe(0);
    expect(advisor.isDismissed(hints[0].id)).toBe(false);
  });

  it('returns hints sorted by priority', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const hints = advisor.getHintsForView('schematic', 'beginner');
    for (let i = 1; i < hints.length; i++) {
      expect(hints[i].priority).toBeGreaterThanOrEqual(hints[i - 1].priority);
    }
  });

  it('notifies subscribers on dismiss', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const listener = vi.fn();
    advisor.subscribe(listener);

    const hints = advisor.getHintsForView('architecture', 'beginner');
    advisor.dismissHint(hints[0].id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes cleanly', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const listener = vi.fn();
    const unsub = advisor.subscribe(listener);
    unsub();

    const hints = advisor.getHintsForView('architecture', 'beginner');
    advisor.dismissHint(hints[0].id);
    expect(listener).not.toHaveBeenCalled();
  });

  it('duplicate dismiss is a no-op', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const listener = vi.fn();
    advisor.subscribe(listener);

    advisor.dismissHint('arch-start-with-blocks');
    advisor.dismissHint('arch-start-with-blocks');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('has hints for at least 8 different views', () => {
    const views = new Set(HINT_CATALOG.map(h => h.view));
    expect(views.size).toBeGreaterThanOrEqual(8);
  });

  it('all hints have valid category and priority', () => {
    for (const hint of HINT_CATALOG) {
      expect(['tip', 'safety', 'workflow', 'shortcut', 'concept']).toContain(hint.category);
      expect(hint.priority).toBeGreaterThan(0);
    }
  });

  it('no duplicate hint IDs', () => {
    const ids = HINT_CATALOG.map(h => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getAllHints returns hints across all views', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const all = advisor.getAllHints('beginner');
    const views = new Set(all.map(h => h.view));
    expect(views.size).toBeGreaterThan(1);
  });

  it('returns empty array for views with no hints', () => {
    const advisor = AdaptiveHintAdvisor.getInstance();
    const hints = advisor.getHintsForView('nonexistent-view', 'beginner');
    expect(hints).toHaveLength(0);
  });

  it('some hints include action labels', () => {
    const withActions = HINT_CATALOG.filter(h => h.actionLabel);
    expect(withActions.length).toBeGreaterThan(0);
    for (const h of withActions) {
      expect(h.actionView).toBeDefined();
    }
  });
});
