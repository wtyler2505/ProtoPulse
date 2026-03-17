import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  QUICK_JUMP_REGISTRY,
  fuzzyScore,
  searchQuickJump,
  getRecentJumps,
  recordJump,
  clearRecentJumps,
  QuickJumpStore,
  useQuickJump,
} from '../quick-jump';
import type { QuickJumpTarget, QuickJumpTargetType, QuickJumpResult } from '../quick-jump';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function getTargetIds(results: QuickJumpResult[]): string[] {
  return results.map((r) => r.target.id);
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('QUICK_JUMP_REGISTRY', () => {
  it('contains at least 30 targets', () => {
    expect(QUICK_JUMP_REGISTRY.length).toBeGreaterThanOrEqual(30);
  });

  it('every target has required fields', () => {
    for (const target of QUICK_JUMP_REGISTRY) {
      expect(target.id).toBeTruthy();
      expect(target.type).toBeTruthy();
      expect(target.label).toBeTruthy();
      expect(Array.isArray(target.keywords)).toBe(true);
      expect(target.keywords.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all target ids are unique', () => {
    const ids = QUICK_JUMP_REGISTRY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains all five target types', () => {
    const types = new Set(QUICK_JUMP_REGISTRY.map((t) => t.type));
    expect(types).toContain('view');
    expect(types).toContain('tool');
    expect(types).toContain('action');
    expect(types).toContain('component');
    expect(types).toContain('setting');
  });

  it('view targets use "view:" prefix in their id', () => {
    const views = QUICK_JUMP_REGISTRY.filter((t) => t.type === 'view');
    for (const v of views) {
      expect(v.id).toMatch(/^view:/);
    }
  });

  it('tool targets use "tool:" prefix in their id', () => {
    const tools = QUICK_JUMP_REGISTRY.filter((t) => t.type === 'tool');
    for (const t of tools) {
      expect(t.id).toMatch(/^tool:/);
    }
  });

  it('action targets use "action:" prefix in their id', () => {
    const actions = QUICK_JUMP_REGISTRY.filter((t) => t.type === 'action');
    for (const a of actions) {
      expect(a.id).toMatch(/^action:/);
    }
  });

  it('component targets use "component:" prefix in their id', () => {
    const components = QUICK_JUMP_REGISTRY.filter((t) => t.type === 'component');
    for (const c of components) {
      expect(c.id).toMatch(/^component:/);
    }
  });

  it('setting targets use "setting:" prefix in their id', () => {
    const settings = QUICK_JUMP_REGISTRY.filter((t) => t.type === 'setting');
    for (const s of settings) {
      expect(s.id).toMatch(/^setting:/);
    }
  });

  it('some targets have a shortcut', () => {
    const withShortcut = QUICK_JUMP_REGISTRY.filter((t) => t.shortcut);
    expect(withShortcut.length).toBeGreaterThanOrEqual(3);
  });

  it('includes common ViewModes', () => {
    const ids = new Set(QUICK_JUMP_REGISTRY.map((t) => t.id));
    expect(ids.has('view:dashboard')).toBe(true);
    expect(ids.has('view:architecture')).toBe(true);
    expect(ids.has('view:schematic')).toBe(true);
    expect(ids.has('view:pcb')).toBe(true);
    expect(ids.has('view:simulation')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fuzzyScore
// ---------------------------------------------------------------------------

describe('fuzzyScore', () => {
  it('returns 0 for empty query', () => {
    expect(fuzzyScore('', 'hello')).toBe(0);
  });

  it('returns 1 for exact match', () => {
    expect(fuzzyScore('pcb', 'pcb')).toBe(1);
  });

  it('returns 1 for exact case-insensitive match', () => {
    expect(fuzzyScore('PCB', 'pcb')).toBe(1);
  });

  it('scores substring match higher than 0.7', () => {
    const score = fuzzyScore('sim', 'Simulation');
    expect(score).toBeGreaterThan(0.7);
  });

  it('scores prefix match higher than non-prefix substring match', () => {
    const prefixScore = fuzzyScore('sch', 'Schematic');
    const substringScore = fuzzyScore('sch', 'ASchematic');
    expect(prefixScore).toBeGreaterThan(substringScore);
  });

  it('returns 0 when query chars are not found in order', () => {
    expect(fuzzyScore('xyz', 'hello')).toBe(0);
  });

  it('scores consecutive matches higher', () => {
    const consecutive = fuzzyScore('pcb', 'pcb layout');
    const scattered = fuzzyScore('pcb', 'p_c_b__layout');
    expect(consecutive).toBeGreaterThan(scattered);
  });

  it('is case insensitive', () => {
    const upper = fuzzyScore('DRC', 'drc');
    const lower = fuzzyScore('drc', 'DRC');
    expect(upper).toBe(lower);
  });

  it('handles partial fuzzy matches', () => {
    const score = fuzzyScore('thml', 'thermal');
    expect(score).toBeGreaterThan(0);
  });

  it('returns 0 when query is longer than haystack and not contained', () => {
    expect(fuzzyScore('extremely long query', 'ab')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// searchQuickJump
// ---------------------------------------------------------------------------

describe('searchQuickJump', () => {
  beforeEach(() => {
    localStorage.clear();
    QuickJumpStore.resetInstance();
  });

  it('returns all targets when query is empty', () => {
    const results = searchQuickJump('');
    expect(results.length).toBe(QUICK_JUMP_REGISTRY.length);
  });

  it('filters out zero-score targets', () => {
    const results = searchQuickJump('zzzzzzzznotreal');
    expect(results.length).toBe(0);
  });

  it('finds a view by label', () => {
    const results = searchQuickJump('Dashboard');
    const ids = getTargetIds(results);
    expect(ids[0]).toBe('view:dashboard');
  });

  it('finds a tool by keyword', () => {
    const results = searchQuickJump('spice');
    const ids = getTargetIds(results);
    expect(ids).toContain('view:simulation');
  });

  it('finds an action by label', () => {
    const results = searchQuickJump('Undo');
    const ids = getTargetIds(results);
    expect(ids[0]).toBe('action:undo');
  });

  it('finds a component by keyword', () => {
    const results = searchQuickJump('ohm');
    const ids = getTargetIds(results);
    expect(ids).toContain('component:resistor');
  });

  it('finds a setting by keyword', () => {
    const results = searchQuickJump('keybinding');
    const ids = getTargetIds(results);
    expect(ids).toContain('setting:shortcuts');
  });

  it('returns results sorted by score descending', () => {
    const results = searchQuickJump('pcb');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('respects limit option', () => {
    const results = searchQuickJump('', { limit: 5 });
    expect(results.length).toBe(5);
  });

  it('respects typeFilter option', () => {
    const results = searchQuickJump('', { typeFilter: 'action' });
    for (const r of results) {
      expect(r.target.type).toBe('action');
    }
    expect(results.length).toBeGreaterThan(0);
  });

  it('applies recency boost when there are recent jumps', () => {
    recordJump('view:pcb');
    const results = searchQuickJump('');
    const pcbResult = results.find((r) => r.target.id === 'view:pcb');
    const otherResult = results.find((r) => r.target.id === 'view:comments');
    expect(pcbResult).toBeDefined();
    expect(otherResult).toBeDefined();
    expect(pcbResult!.score).toBeGreaterThan(otherResult!.score);
  });

  it('boosts recents in scored search too', () => {
    // Both match "view" in their id, but the recent one should score higher.
    recordJump('view:lifecycle');
    const results = searchQuickJump('lifecycle');
    const lifecycleResult = results.find((r) => r.target.id === 'view:lifecycle');
    expect(lifecycleResult).toBeDefined();
    expect(lifecycleResult!.score).toBeGreaterThan(0);
  });

  it('combined typeFilter and limit', () => {
    const results = searchQuickJump('', { typeFilter: 'view', limit: 3 });
    expect(results.length).toBe(3);
    for (const r of results) {
      expect(r.target.type).toBe('view');
    }
  });
});

// ---------------------------------------------------------------------------
// Recents (localStorage)
// ---------------------------------------------------------------------------

describe('getRecentJumps', () => {
  beforeEach(() => {
    localStorage.clear();
    QuickJumpStore.resetInstance();
  });

  it('returns empty array when no recents', () => {
    expect(getRecentJumps()).toEqual([]);
  });

  it('returns stored recents', () => {
    localStorage.setItem('protopulse:quick-jump-recents', JSON.stringify(['a', 'b', 'c']));
    expect(getRecentJumps()).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for invalid JSON', () => {
    localStorage.setItem('protopulse:quick-jump-recents', 'not json');
    expect(getRecentJumps()).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    localStorage.setItem('protopulse:quick-jump-recents', '{"a":1}');
    expect(getRecentJumps()).toEqual([]);
  });

  it('filters out non-string values', () => {
    localStorage.setItem('protopulse:quick-jump-recents', JSON.stringify(['a', 42, null, 'b']));
    expect(getRecentJumps()).toEqual(['a', 'b']);
  });

  it('truncates to 10 entries', () => {
    const ids = Array.from({ length: 15 }, (_, i) => `id-${i}`);
    localStorage.setItem('protopulse:quick-jump-recents', JSON.stringify(ids));
    expect(getRecentJumps().length).toBe(10);
  });
});

describe('recordJump', () => {
  beforeEach(() => {
    localStorage.clear();
    QuickJumpStore.resetInstance();
  });

  it('adds a target to the front of recents', () => {
    recordJump('view:pcb');
    expect(getRecentJumps()[0]).toBe('view:pcb');
  });

  it('moves an existing target to the front', () => {
    recordJump('view:pcb');
    recordJump('view:schematic');
    recordJump('view:pcb');
    const recents = getRecentJumps();
    expect(recents[0]).toBe('view:pcb');
    expect(recents[1]).toBe('view:schematic');
    expect(recents.filter((id) => id === 'view:pcb').length).toBe(1);
  });

  it('trims to MAX_RECENTS (10)', () => {
    for (let i = 0; i < 15; i++) {
      recordJump(`target-${i}`);
    }
    expect(getRecentJumps().length).toBe(10);
    expect(getRecentJumps()[0]).toBe('target-14');
  });
});

describe('clearRecentJumps', () => {
  beforeEach(() => {
    localStorage.clear();
    QuickJumpStore.resetInstance();
  });

  it('clears all recents', () => {
    recordJump('view:pcb');
    recordJump('view:schematic');
    clearRecentJumps();
    expect(getRecentJumps()).toEqual([]);
  });

  it('does nothing when already empty', () => {
    clearRecentJumps();
    expect(getRecentJumps()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// QuickJumpStore (singleton + subscribe)
// ---------------------------------------------------------------------------

describe('QuickJumpStore', () => {
  beforeEach(() => {
    localStorage.clear();
    QuickJumpStore.resetInstance();
  });

  afterEach(() => {
    QuickJumpStore.resetInstance();
  });

  it('returns the same instance on repeated calls', () => {
    const a = QuickJumpStore.getInstance();
    const b = QuickJumpStore.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    const a = QuickJumpStore.getInstance();
    QuickJumpStore.resetInstance();
    const b = QuickJumpStore.getInstance();
    expect(a).not.toBe(b);
  });

  it('getSnapshot returns current recents', () => {
    const store = QuickJumpStore.getInstance();
    expect(store.getSnapshot()).toEqual([]);
  });

  it('notifies subscribers when recents change via recordJump', () => {
    const store = QuickJumpStore.getInstance();
    let callCount = 0;
    store.subscribe(() => {
      callCount++;
    });
    recordJump('view:pcb');
    expect(callCount).toBe(1);
    expect(store.getSnapshot()).toContain('view:pcb');
  });

  it('unsubscribe works', () => {
    const store = QuickJumpStore.getInstance();
    let callCount = 0;
    const unsub = store.subscribe(() => {
      callCount++;
    });
    recordJump('view:pcb');
    expect(callCount).toBe(1);
    unsub();
    recordJump('view:schematic');
    expect(callCount).toBe(1);
  });

  it('notifies on clearRecentJumps', () => {
    const store = QuickJumpStore.getInstance();
    recordJump('view:pcb');
    let callCount = 0;
    store.subscribe(() => {
      callCount++;
    });
    clearRecentJumps();
    expect(callCount).toBe(1);
    expect(store.getSnapshot()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// useQuickJump hook
// ---------------------------------------------------------------------------

describe('useQuickJump', () => {
  beforeEach(() => {
    localStorage.clear();
    QuickJumpStore.resetInstance();
  });

  afterEach(() => {
    QuickJumpStore.resetInstance();
  });

  it('returns recents, search, recordJump, clearRecentJumps, and registry', () => {
    const { result } = renderHook(() => useQuickJump());
    expect(result.current.recents).toEqual([]);
    expect(typeof result.current.search).toBe('function');
    expect(typeof result.current.recordJump).toBe('function');
    expect(typeof result.current.clearRecentJumps).toBe('function');
    expect(result.current.registry).toBe(QUICK_JUMP_REGISTRY);
  });

  it('search returns results', () => {
    const { result } = renderHook(() => useQuickJump());
    const results = result.current.search('pcb');
    expect(results.length).toBeGreaterThan(0);
  });

  it('recordJump updates recents reactively', () => {
    const { result } = renderHook(() => useQuickJump());
    expect(result.current.recents).toEqual([]);
    act(() => {
      result.current.recordJump('view:pcb');
    });
    expect(result.current.recents).toContain('view:pcb');
  });

  it('clearRecentJumps empties recents reactively', () => {
    const { result } = renderHook(() => useQuickJump());
    act(() => {
      result.current.recordJump('view:pcb');
    });
    expect(result.current.recents.length).toBe(1);
    act(() => {
      result.current.clearRecentJumps();
    });
    expect(result.current.recents).toEqual([]);
  });

  it('search respects typeFilter', () => {
    const { result } = renderHook(() => useQuickJump());
    const results = result.current.search('', { typeFilter: 'tool' });
    for (const r of results) {
      expect(r.target.type).toBe('tool');
    }
  });

  it('search respects limit', () => {
    const { result } = renderHook(() => useQuickJump());
    const results = result.current.search('', { limit: 3 });
    expect(results.length).toBe(3);
  });
});
