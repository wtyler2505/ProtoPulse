import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  BOTTOM_NAV_ITEMS,
  DEFAULT_BREAKPOINT,
  shouldShowBottomNav,
  getNavItemForView,
  getNavItemById,
  getViewModesForNavItem,
  useBottomNav,
} from '@/lib/mobile-bottom-nav';
import type { BottomNavItem, BottomNavConfig } from '@/lib/mobile-bottom-nav';
import type { ViewMode } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// BOTTOM_NAV_ITEMS structural integrity
// ---------------------------------------------------------------------------

describe('BOTTOM_NAV_ITEMS', () => {
  it('has exactly 5 items', () => {
    expect(BOTTOM_NAV_ITEMS).toHaveLength(5);
  });

  it('every item has a unique id', () => {
    const ids = BOTTOM_NAV_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every item has a non-empty label', () => {
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it('every item has a non-empty icon name', () => {
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });

  it('every item has a valid viewMode string', () => {
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(typeof item.viewMode).toBe('string');
      expect(item.viewMode.length).toBeGreaterThan(0);
    }
  });

  it('every item has a unique viewMode', () => {
    const viewModes = BOTTOM_NAV_ITEMS.map((item) => item.viewMode);
    expect(new Set(viewModes).size).toBe(viewModes.length);
  });

  it('contains Design, Validate, Build, Chat, More in that order', () => {
    const labels = BOTTOM_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(['Design', 'Validate', 'Build', 'Chat', 'More']);
  });

  it('items are read-only (frozen)', () => {
    // The `as const` + readonly should prevent mutations; verify the array identity
    expect(Object.isFrozen(BOTTOM_NAV_ITEMS)).toBe(true);
  });

  it('badge defaults to undefined', () => {
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(item.badge).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_BREAKPOINT
// ---------------------------------------------------------------------------

describe('DEFAULT_BREAKPOINT', () => {
  it('equals 768 (matching useMobile breakpoint)', () => {
    expect(DEFAULT_BREAKPOINT).toBe(768);
  });
});

// ---------------------------------------------------------------------------
// shouldShowBottomNav
// ---------------------------------------------------------------------------

describe('shouldShowBottomNav', () => {
  it('returns true when screenWidth is below the default breakpoint', () => {
    expect(shouldShowBottomNav(320)).toBe(true);
    expect(shouldShowBottomNav(767)).toBe(true);
  });

  it('returns false when screenWidth equals the default breakpoint', () => {
    expect(shouldShowBottomNav(768)).toBe(false);
  });

  it('returns false when screenWidth exceeds the default breakpoint', () => {
    expect(shouldShowBottomNav(1024)).toBe(false);
    expect(shouldShowBottomNav(1920)).toBe(false);
  });

  it('returns true at screenWidth 0', () => {
    expect(shouldShowBottomNav(0)).toBe(true);
  });

  it('accepts a custom breakpoint', () => {
    expect(shouldShowBottomNav(500, 600)).toBe(true);
    expect(shouldShowBottomNav(600, 600)).toBe(false);
    expect(shouldShowBottomNav(700, 600)).toBe(false);
  });

  it('returns false for negative screenWidth', () => {
    expect(shouldShowBottomNav(-1)).toBe(false);
  });

  it('returns false for NaN screenWidth', () => {
    expect(shouldShowBottomNav(NaN)).toBe(false);
  });

  it('returns false for Infinity screenWidth', () => {
    expect(shouldShowBottomNav(Infinity)).toBe(false);
  });

  it('returns false for negative breakpoint', () => {
    expect(shouldShowBottomNav(100, -10)).toBe(false);
  });

  it('returns false for NaN breakpoint', () => {
    expect(shouldShowBottomNav(100, NaN)).toBe(false);
  });

  it('handles breakpoint of 0 (always hidden)', () => {
    expect(shouldShowBottomNav(0, 0)).toBe(false);
  });

  it('handles very large breakpoint', () => {
    expect(shouldShowBottomNav(9999, 10000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getNavItemForView
// ---------------------------------------------------------------------------

describe('getNavItemForView', () => {
  it('returns the Design item for architecture', () => {
    const item = getNavItemForView('architecture');
    expect(item).toBeDefined();
    expect(item!.id).toBe('design');
  });

  it('returns the Validate item for validation', () => {
    const item = getNavItemForView('validation');
    expect(item).toBeDefined();
    expect(item!.id).toBe('validate');
  });

  it('returns the Build item for pcb', () => {
    const item = getNavItemForView('pcb');
    expect(item).toBeDefined();
    expect(item!.id).toBe('build');
  });

  it('returns the Chat item for dashboard', () => {
    const item = getNavItemForView('dashboard');
    expect(item).toBeDefined();
    expect(item!.id).toBe('chat');
  });

  it('returns the More item for project_explorer', () => {
    const item = getNavItemForView('project_explorer');
    expect(item).toBeDefined();
    expect(item!.id).toBe('more');
  });

  it('maps schematic to the Design bucket', () => {
    const item = getNavItemForView('schematic');
    expect(item?.id).toBe('design');
  });

  it('maps breadboard to the Design bucket', () => {
    const item = getNavItemForView('breadboard');
    expect(item?.id).toBe('design');
  });

  it('maps component_editor to the Design bucket', () => {
    const item = getNavItemForView('component_editor');
    expect(item?.id).toBe('design');
  });

  it('maps simulation to the Validate bucket', () => {
    const item = getNavItemForView('simulation');
    expect(item?.id).toBe('validate');
  });

  it('maps calculators to the Validate bucket', () => {
    const item = getNavItemForView('calculators');
    expect(item?.id).toBe('validate');
  });

  it('maps procurement to the Build bucket', () => {
    const item = getNavItemForView('procurement');
    expect(item?.id).toBe('build');
  });

  it('maps ordering to the Build bucket', () => {
    const item = getNavItemForView('ordering');
    expect(item?.id).toBe('build');
  });

  it('maps serial_monitor to the Build bucket', () => {
    const item = getNavItemForView('serial_monitor');
    expect(item?.id).toBe('build');
  });

  it('maps arduino to the Build bucket', () => {
    const item = getNavItemForView('arduino');
    expect(item?.id).toBe('build');
  });

  it('maps comments to the Chat bucket', () => {
    const item = getNavItemForView('comments');
    expect(item?.id).toBe('chat');
  });

  it('maps design_history to the More bucket', () => {
    const item = getNavItemForView('design_history');
    expect(item?.id).toBe('more');
  });

  it('maps kanban to the More bucket', () => {
    const item = getNavItemForView('kanban');
    expect(item?.id).toBe('more');
  });

  it('maps knowledge to the More bucket', () => {
    const item = getNavItemForView('knowledge');
    expect(item?.id).toBe('more');
  });

  it('maps community to the More bucket', () => {
    const item = getNavItemForView('community');
    expect(item?.id).toBe('more');
  });

  it('maps viewer_3d to the Design bucket', () => {
    const item = getNavItemForView('viewer_3d');
    expect(item?.id).toBe('design');
  });

  it('maps circuit_code to the Design bucket', () => {
    const item = getNavItemForView('circuit_code');
    expect(item?.id).toBe('design');
  });

  it('maps generative_design to the Design bucket', () => {
    const item = getNavItemForView('generative_design');
    expect(item?.id).toBe('design');
  });

  it('maps digital_twin to the Build bucket', () => {
    const item = getNavItemForView('digital_twin');
    expect(item?.id).toBe('build');
  });

  it('maps storage to the Build bucket', () => {
    const item = getNavItemForView('storage');
    expect(item?.id).toBe('build');
  });

  it('maps lifecycle to the Build bucket', () => {
    const item = getNavItemForView('lifecycle');
    expect(item?.id).toBe('build');
  });

  it('maps output to the Build bucket', () => {
    const item = getNavItemForView('output');
    expect(item?.id).toBe('build');
  });

  it('maps audit_trail to the More bucket', () => {
    const item = getNavItemForView('audit_trail');
    expect(item?.id).toBe('more');
  });

  it('maps labs to the More bucket', () => {
    const item = getNavItemForView('labs');
    expect(item?.id).toBe('more');
  });

  it('maps starter_circuits to the Design bucket', () => {
    const item = getNavItemForView('starter_circuits');
    expect(item?.id).toBe('design');
  });

  it('maps design_patterns to the Design bucket', () => {
    const item = getNavItemForView('design_patterns');
    expect(item?.id).toBe('design');
  });

  it('returns undefined for an unknown ViewMode', () => {
    const item = getNavItemForView('nonexistent_thing' as ViewMode);
    expect(item).toBeUndefined();
  });

  it('returned item has all required fields', () => {
    const item = getNavItemForView('architecture');
    expect(item).toBeDefined();
    const typed = item as BottomNavItem;
    expect(typed.id).toBeTruthy();
    expect(typed.icon).toBeTruthy();
    expect(typed.label).toBeTruthy();
    expect(typed.viewMode).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// getNavItemById
// ---------------------------------------------------------------------------

describe('getNavItemById', () => {
  it('returns the correct item for each known id', () => {
    for (const item of BOTTOM_NAV_ITEMS) {
      const found = getNavItemById(item.id);
      expect(found).toBe(item);
    }
  });

  it('returns undefined for an unknown id', () => {
    expect(getNavItemById('nonexistent')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getNavItemById('')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getViewModesForNavItem
// ---------------------------------------------------------------------------

describe('getViewModesForNavItem', () => {
  it('returns multiple ViewModes for the design item', () => {
    const views = getViewModesForNavItem('design');
    expect(views.length).toBeGreaterThan(1);
    expect(views).toContain('architecture');
    expect(views).toContain('schematic');
  });

  it('returns multiple ViewModes for the build item', () => {
    const views = getViewModesForNavItem('build');
    expect(views.length).toBeGreaterThan(1);
    expect(views).toContain('pcb');
    expect(views).toContain('procurement');
  });

  it('returns views for the validate item', () => {
    const views = getViewModesForNavItem('validate');
    expect(views).toContain('validation');
    expect(views).toContain('simulation');
  });

  it('returns views for the chat item', () => {
    const views = getViewModesForNavItem('chat');
    expect(views).toContain('dashboard');
    expect(views).toContain('comments');
  });

  it('returns views for the more item', () => {
    const views = getViewModesForNavItem('more');
    expect(views).toContain('project_explorer');
    expect(views).toContain('design_history');
  });

  it('returns empty array for unknown id', () => {
    expect(getViewModesForNavItem('nonexistent')).toEqual([]);
  });

  it('every returned ViewMode maps back to the same nav item', () => {
    for (const item of BOTTOM_NAV_ITEMS) {
      const views = getViewModesForNavItem(item.id);
      for (const view of views) {
        const resolved = getNavItemForView(view);
        expect(resolved?.id).toBe(item.id);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// useBottomNav hook
// ---------------------------------------------------------------------------

describe('useBottomNav', () => {
  it('returns a BottomNavConfig object', () => {
    const { result } = renderHook(() => useBottomNav('architecture'));
    const config: BottomNavConfig = result.current;
    expect(config).toHaveProperty('visible');
    expect(config).toHaveProperty('activeItem');
    expect(config).toHaveProperty('badgeCounts');
  });

  it('visible is always true (gating is the consumers responsibility)', () => {
    const { result } = renderHook(() => useBottomNav('architecture'));
    expect(result.current.visible).toBe(true);
  });

  it('activeItem is "design" for architecture view', () => {
    const { result } = renderHook(() => useBottomNav('architecture'));
    expect(result.current.activeItem).toBe('design');
  });

  it('activeItem is "validate" for validation view', () => {
    const { result } = renderHook(() => useBottomNav('validation'));
    expect(result.current.activeItem).toBe('validate');
  });

  it('activeItem is "build" for pcb view', () => {
    const { result } = renderHook(() => useBottomNav('pcb'));
    expect(result.current.activeItem).toBe('build');
  });

  it('activeItem is "chat" for dashboard view', () => {
    const { result } = renderHook(() => useBottomNav('dashboard'));
    expect(result.current.activeItem).toBe('chat');
  });

  it('activeItem is "more" for project_explorer view', () => {
    const { result } = renderHook(() => useBottomNav('project_explorer'));
    expect(result.current.activeItem).toBe('more');
  });

  it('activeItem is null for unknown ViewMode', () => {
    const { result } = renderHook(() => useBottomNav('fake_view' as ViewMode));
    expect(result.current.activeItem).toBeNull();
  });

  it('badgeCounts defaults all items to 0 when no counts provided', () => {
    const { result } = renderHook(() => useBottomNav('architecture'));
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(result.current.badgeCounts[item.id]).toBe(0);
    }
  });

  it('merges external badge counts', () => {
    const badges = { validate: 5, chat: 3 };
    const { result } = renderHook(() => useBottomNav('architecture', badges));
    expect(result.current.badgeCounts['validate']).toBe(5);
    expect(result.current.badgeCounts['chat']).toBe(3);
    expect(result.current.badgeCounts['design']).toBe(0);
  });

  it('floors fractional badge counts', () => {
    const badges = { validate: 2.7 };
    const { result } = renderHook(() => useBottomNav('architecture', badges));
    expect(result.current.badgeCounts['validate']).toBe(2);
  });

  it('ignores negative badge counts (treats as 0)', () => {
    const badges = { validate: -3 };
    const { result } = renderHook(() => useBottomNav('architecture', badges));
    expect(result.current.badgeCounts['validate']).toBe(0);
  });

  it('ignores zero badge counts', () => {
    const badges = { validate: 0 };
    const { result } = renderHook(() => useBottomNav('architecture', badges));
    expect(result.current.badgeCounts['validate']).toBe(0);
  });

  it('ignores unknown keys in badge counts', () => {
    const badges = { nonexistent: 99 };
    const { result } = renderHook(() => useBottomNav('architecture', badges));
    expect(result.current.badgeCounts['nonexistent']).toBeUndefined();
  });

  it('updates activeItem when activeView changes', () => {
    const { result, rerender } = renderHook(
      ({ view }: { view: ViewMode }) => useBottomNav(view),
      { initialProps: { view: 'architecture' as ViewMode } },
    );
    expect(result.current.activeItem).toBe('design');

    rerender({ view: 'validation' as ViewMode });
    expect(result.current.activeItem).toBe('validate');
  });

  it('returns stable reference when inputs are the same', () => {
    const badges = { validate: 2 };
    const { result, rerender } = renderHook(
      ({ view, b }: { view: ViewMode; b: Record<string, number> }) => useBottomNav(view, b),
      { initialProps: { view: 'architecture' as ViewMode, b: badges } },
    );
    const first = result.current;
    rerender({ view: 'architecture' as ViewMode, b: badges });
    // Same object reference since useMemo deps haven't changed
    expect(result.current).toBe(first);
  });
});
