/**
 * Tests for RatsnestFilter — per-net ratsnest visibility manager.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to test the class in isolation, not the singleton.
// Import the module and reset state between tests.

// Mock localStorage before module import
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
  removeItem: vi.fn((key: string) => { store.delete(key); }),
  clear: vi.fn(() => { store.clear(); }),
});

import type { RatsnestNet } from '@/components/circuit-editor/RatsnestOverlay';

// ---------------------------------------------------------------------------
// Helper to create a fresh manager instance for each test
// ---------------------------------------------------------------------------

// We import the module to get the class shape, but since the class is not
// exported (only the singleton is), we'll work with the singleton and
// reset it by calling showAll() + clearing localStorage.
import { ratsnestFilter } from '../ratsnest-filter';

function makeNet(netId: number, name: string, pinCount = 2): RatsnestNet {
  const pins = Array.from({ length: pinCount }, (_, i) => ({
    instanceId: i + 1,
    pinId: String(i + 1),
    x: i * 10,
    y: 0,
  }));
  return { netId, name, color: '#06b6d4', pins, routedPairs: new Set() };
}

describe('RatsnestFilter', () => {
  beforeEach(() => {
    store.clear();
    // Reset the singleton state
    ratsnestFilter.showAll();
  });

  // ---- Initial state ----

  it('starts with all nets visible by default', () => {
    expect(ratsnestFilter.isNetVisible(1)).toBe(true);
    expect(ratsnestFilter.isNetVisible(999)).toBe(true);
  });

  it('getVisibleNets returns all nets when nothing is hidden', () => {
    const allIds = [1, 2, 3, 4, 5];
    expect(ratsnestFilter.getVisibleNets(allIds)).toEqual(allIds);
  });

  // ---- Toggle individual net visibility ----

  it('setNetVisibility hides a net', () => {
    ratsnestFilter.setNetVisibility(3, false);
    expect(ratsnestFilter.isNetVisible(3)).toBe(false);
    expect(ratsnestFilter.isNetVisible(1)).toBe(true);
  });

  it('setNetVisibility shows a previously hidden net', () => {
    ratsnestFilter.setNetVisibility(3, false);
    ratsnestFilter.setNetVisibility(3, true);
    expect(ratsnestFilter.isNetVisible(3)).toBe(true);
  });

  it('toggleNet toggles visibility', () => {
    // Default is visible
    ratsnestFilter.toggleNet(5);
    expect(ratsnestFilter.isNetVisible(5)).toBe(false);

    ratsnestFilter.toggleNet(5);
    expect(ratsnestFilter.isNetVisible(5)).toBe(true);
  });

  // ---- Show all / hide all ----

  it('showAll makes all nets visible again', () => {
    ratsnestFilter.setNetVisibility(1, false);
    ratsnestFilter.setNetVisibility(2, false);
    ratsnestFilter.showAll();
    expect(ratsnestFilter.isNetVisible(1)).toBe(true);
    expect(ratsnestFilter.isNetVisible(2)).toBe(true);
  });

  it('hideAll hides all provided net IDs', () => {
    const allIds = [10, 20, 30];
    ratsnestFilter.hideAll(allIds);
    expect(ratsnestFilter.isNetVisible(10)).toBe(false);
    expect(ratsnestFilter.isNetVisible(20)).toBe(false);
    expect(ratsnestFilter.isNetVisible(30)).toBe(false);
    // Unknown net is still visible by default
    expect(ratsnestFilter.isNetVisible(99)).toBe(true);
  });

  // ---- Show only specific nets ----

  it('showOnly shows specified nets and hides the rest', () => {
    const allIds = [1, 2, 3, 4, 5];
    ratsnestFilter.showOnly([2, 4], allIds);

    expect(ratsnestFilter.isNetVisible(2)).toBe(true);
    expect(ratsnestFilter.isNetVisible(4)).toBe(true);
    expect(ratsnestFilter.isNetVisible(1)).toBe(false);
    expect(ratsnestFilter.isNetVisible(3)).toBe(false);
    expect(ratsnestFilter.isNetVisible(5)).toBe(false);
  });

  it('showOnly with empty array hides all provided nets', () => {
    const allIds = [1, 2, 3];
    ratsnestFilter.showOnly([], allIds);
    expect(ratsnestFilter.isNetVisible(1)).toBe(false);
    expect(ratsnestFilter.isNetVisible(2)).toBe(false);
    expect(ratsnestFilter.isNetVisible(3)).toBe(false);
  });

  // ---- Filter ratsnest lines based on visibility ----

  it('filterRatsnest returns all nets when nothing is hidden', () => {
    const nets = [makeNet(1, 'VCC'), makeNet(2, 'GND'), makeNet(3, 'SIG')];
    expect(ratsnestFilter.filterRatsnest(nets)).toHaveLength(3);
  });

  it('filterRatsnest excludes hidden nets', () => {
    ratsnestFilter.setNetVisibility(2, false);
    const nets = [makeNet(1, 'VCC'), makeNet(2, 'GND'), makeNet(3, 'SIG')];
    const filtered = ratsnestFilter.filterRatsnest(nets);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((n) => n.netId)).toEqual([1, 3]);
  });

  it('filterRatsnest returns empty array when all nets hidden', () => {
    const nets = [makeNet(1, 'VCC'), makeNet(2, 'GND')];
    ratsnestFilter.hideAll([1, 2]);
    expect(ratsnestFilter.filterRatsnest(nets)).toHaveLength(0);
  });

  // ---- Persistence to/from localStorage ----

  it('persists filter state to localStorage on change', () => {
    ratsnestFilter.setNetVisibility(7, false);
    expect(store.has('protopulse-ratsnest-filter')).toBe(true);
    const saved = JSON.parse(store.get('protopulse-ratsnest-filter')!) as Array<[number, { visible: boolean }]>;
    const entry = saved.find(([id]) => id === 7);
    expect(entry).toBeDefined();
    expect(entry![1].visible).toBe(false);
  });

  it('showAll clears localStorage state', () => {
    ratsnestFilter.setNetVisibility(1, false);
    ratsnestFilter.showAll();
    const saved = JSON.parse(store.get('protopulse-ratsnest-filter')!) as unknown[];
    expect(saved).toHaveLength(0);
  });

  // ---- Edge cases ----

  it('handles empty net list in filterRatsnest', () => {
    expect(ratsnestFilter.filterRatsnest([])).toHaveLength(0);
  });

  it('handles single net', () => {
    const nets = [makeNet(42, 'SOLO')];
    expect(ratsnestFilter.filterRatsnest(nets)).toHaveLength(1);

    ratsnestFilter.toggleNet(42);
    expect(ratsnestFilter.filterRatsnest(nets)).toHaveLength(0);
  });

  it('handles unknown net ID gracefully (defaults to visible)', () => {
    expect(ratsnestFilter.isNetVisible(99999)).toBe(true);
  });

  it('getVisibleNets with empty list returns empty', () => {
    expect(ratsnestFilter.getVisibleNets([])).toEqual([]);
  });

  // ---- Subscribe pattern ----

  it('notifies subscribers on state change', () => {
    const listener = vi.fn();
    const unsub = ratsnestFilter.subscribe(listener);

    ratsnestFilter.setNetVisibility(1, false);
    expect(listener).toHaveBeenCalledTimes(1);

    ratsnestFilter.toggleNet(1);
    expect(listener).toHaveBeenCalledTimes(2);

    ratsnestFilter.showAll();
    expect(listener).toHaveBeenCalledTimes(3);

    unsub();
    ratsnestFilter.setNetVisibility(1, false);
    expect(listener).toHaveBeenCalledTimes(3); // No more calls after unsub
  });

  it('version increments on every mutation', () => {
    const v0 = ratsnestFilter.version;
    ratsnestFilter.setNetVisibility(1, false);
    expect(ratsnestFilter.version).toBe(v0 + 1);
    ratsnestFilter.toggleNet(1);
    expect(ratsnestFilter.version).toBe(v0 + 2);
    ratsnestFilter.showAll();
    expect(ratsnestFilter.version).toBe(v0 + 3);
  });

  it('hideAll increments version once', () => {
    const v0 = ratsnestFilter.version;
    ratsnestFilter.hideAll([1, 2, 3]);
    expect(ratsnestFilter.version).toBe(v0 + 1);
  });

  it('showOnly increments version once', () => {
    const v0 = ratsnestFilter.version;
    ratsnestFilter.showOnly([1], [1, 2, 3]);
    expect(ratsnestFilter.version).toBe(v0 + 1);
  });
});
