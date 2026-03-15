import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SIDEBAR_GROUPS,
  getGroupForView,
  getNavItemsForGroup,
  getUngroupedNavItems,
  getOrphanedGroupViews,
  loadCollapsedGroups,
  saveCollapsedGroups,
} from '@/lib/sidebar-groups';
import { navItems } from '@/components/layout/sidebar/sidebar-constants';
import type { ViewMode } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Group structure integrity
// ---------------------------------------------------------------------------

describe('SIDEBAR_GROUPS', () => {
  it('has at least 5 groups', () => {
    expect(SIDEBAR_GROUPS.length).toBeGreaterThanOrEqual(5);
  });

  it('every group has a unique id', () => {
    const ids = SIDEBAR_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every group has a non-empty label', () => {
    for (const group of SIDEBAR_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0);
    }
  });

  it('every group has an icon', () => {
    for (const group of SIDEBAR_GROUPS) {
      // lucide-react icons are forwardRef objects with a render function
      expect(group.icon).toBeDefined();
      expect(group.icon).not.toBeNull();
    }
  });

  it('every group has at least one view', () => {
    for (const group of SIDEBAR_GROUPS) {
      expect(group.views.length).toBeGreaterThan(0);
    }
  });

  it('no ViewMode appears in more than one group', () => {
    const seen = new Map<ViewMode, string>();
    for (const group of SIDEBAR_GROUPS) {
      for (const view of group.views) {
        const prev = seen.get(view);
        if (prev) {
          throw new Error(`ViewMode "${view}" is in both "${prev}" and "${group.id}"`);
        }
        seen.set(view, group.id);
      }
    }
  });

  it('every navItem ViewMode is assigned to exactly one group (no ungrouped)', () => {
    const ungrouped = getUngroupedNavItems();
    expect(ungrouped).toEqual([]);
  });

  it('no group contains views missing from navItems (no orphans)', () => {
    const orphaned = getOrphanedGroupViews();
    expect(orphaned).toEqual([]);
  });

  it('groups cover all navItems', () => {
    const groupedViews = new Set(SIDEBAR_GROUPS.flatMap((g) => g.views));
    for (const item of navItems) {
      expect(groupedViews.has(item.view)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getGroupForView
// ---------------------------------------------------------------------------

describe('getGroupForView', () => {
  it('returns correct group id for a known view', () => {
    expect(getGroupForView('architecture')).toBe('design');
    expect(getGroupForView('simulation')).toBe('analysis');
    expect(getGroupForView('arduino')).toBe('hardware');
    expect(getGroupForView('procurement')).toBe('manufacturing');
    expect(getGroupForView('knowledge')).toBe('documentation');
  });

  it('returns undefined for an unknown view', () => {
    // Cast a bogus string to ViewMode to test the fallback
    expect(getGroupForView('nonexistent_view' as ViewMode)).toBeUndefined();
  });

  it('returns a value for every view in navItems', () => {
    for (const item of navItems) {
      expect(getGroupForView(item.view)).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// getNavItemsForGroup
// ---------------------------------------------------------------------------

describe('getNavItemsForGroup', () => {
  it('returns NavItems for the Design group in declared order', () => {
    const designGroup = SIDEBAR_GROUPS.find((g) => g.id === 'design')!;
    const items = getNavItemsForGroup(designGroup);
    expect(items.length).toBe(designGroup.views.length);
    expect(items.map((i) => i.view)).toEqual(designGroup.views);
  });

  it('each returned item has icon, view, and label', () => {
    for (const group of SIDEBAR_GROUPS) {
      const items = getNavItemsForGroup(group);
      for (const item of items) {
        expect(item.icon).toBeDefined();
        expect(typeof item.view).toBe('string');
        expect(typeof item.label).toBe('string');
      }
    }
  });

  it('returns items only for views that exist in navItems', () => {
    for (const group of SIDEBAR_GROUPS) {
      const items = getNavItemsForGroup(group);
      const navViewSet = new Set(navItems.map((n) => n.view));
      for (const item of items) {
        expect(navViewSet.has(item.view)).toBe(true);
      }
    }
  });

  it('total items across all groups equals navItems length', () => {
    let total = 0;
    for (const group of SIDEBAR_GROUPS) {
      total += getNavItemsForGroup(group).length;
    }
    expect(total).toBe(navItems.length);
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

describe('loadCollapsedGroups / saveCollapsedGroups', () => {
  const STORAGE_KEY = 'protopulse:sidebar-group-collapsed';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns empty object when nothing is stored', () => {
    expect(loadCollapsedGroups()).toEqual({});
  });

  it('round-trips collapsed state', () => {
    const state = { design: true, analysis: false };
    saveCollapsedGroups(state);
    expect(loadCollapsedGroups()).toEqual(state);
  });

  it('returns empty object for corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{bad json');
    expect(loadCollapsedGroups()).toEqual({});
  });

  it('returns empty object for non-object JSON (array)', () => {
    localStorage.setItem(STORAGE_KEY, '[1,2,3]');
    expect(loadCollapsedGroups()).toEqual({});
  });

  it('returns empty object for non-object JSON (string)', () => {
    localStorage.setItem(STORAGE_KEY, '"hello"');
    expect(loadCollapsedGroups()).toEqual({});
  });

  it('overwrites previous state on save', () => {
    saveCollapsedGroups({ design: true });
    saveCollapsedGroups({ analysis: true, hardware: true });
    expect(loadCollapsedGroups()).toEqual({ analysis: true, hardware: true });
  });

  it('handles localStorage.setItem throwing (storage full)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    // Should not throw
    expect(() => saveCollapsedGroups({ design: true })).not.toThrow();
    spy.mockRestore();
  });

  it('handles localStorage.getItem throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(loadCollapsedGroups()).toEqual({});
    spy.mockRestore();
  });
});
