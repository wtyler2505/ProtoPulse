/**
 * Adapter selection + round-trip tests for the R5 #2 desktop-store adapter.
 *
 * Covers:
 * - Browser backend uses localStorage with JSON.stringify/parse transparency.
 * - Singleton + per-project APIs return null when key absent.
 * - Round-trip preserves JS types (objects, arrays, primitives).
 *
 * Tauri-backend branch tests would require mocking @/lib/bindings's
 * `commands` object; left to integration tests since vitest setup mocks
 * Tauri APIs at a different layer.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock isTauri = false so we hit the browser branch in this test file.
vi.mock('@/lib/tauri-api', () => ({
  isTauri: false,
}));

import {
  getUserSettingStore,
  getKanbanStateStore,
  getDesignVariablesStore,
  __resetStoresForTesting,
} from '@/lib/desktop/desktop-store-adapter';

beforeEach(() => {
  localStorage.clear();
  __resetStoresForTesting();
});

describe('desktop-store-adapter — browser backend', () => {
  it('UserSettingStore: get returns null for missing key', async () => {
    const store = getUserSettingStore();
    expect(await store.get('nonexistent')).toBeNull();
  });

  it('UserSettingStore: set then get round-trips JSON-serializable values', async () => {
    const store = getUserSettingStore();
    await store.set('theme', 'dark');
    await store.set('flags', { reduced: true, count: 3 });
    await store.set('list', [1, 2, 3]);
    expect(await store.get<string>('theme')).toBe('dark');
    expect(await store.get<{ reduced: boolean; count: number }>('flags')).toEqual({
      reduced: true,
      count: 3,
    });
    expect(await store.get<number[]>('list')).toEqual([1, 2, 3]);
  });

  it('UserSettingStore: writes JSON-stringified to localStorage', async () => {
    const store = getUserSettingStore();
    await store.set('theme', 'system');
    // Direct localStorage probe confirms the value is stringified JSON, not
    // a bare string — so JSON.parse on read produces the same JS value.
    expect(localStorage.getItem('theme')).toBe('"system"');
  });

  it('UserSettingStore: tolerates legacy non-JSON localStorage values', async () => {
    // Pre-R5 #2 entries that weren't JSON-stringified should NOT crash get().
    localStorage.setItem('legacy-key', 'bareValue');
    const store = getUserSettingStore();
    expect(await store.get<string>('legacy-key')).toBe('bareValue');
  });

  it('KanbanStateStore: singleton API — get/set with NO project_id', async () => {
    const store = getKanbanStateStore();
    expect(await store.get()).toBeNull();
    await store.set({ columns: ['todo', 'in-progress', 'done'] });
    expect(await store.get<{ columns: string[] }>()).toEqual({
      columns: ['todo', 'in-progress', 'done'],
    });
    // Stores under the existing protopulse-kanban-board localStorage key.
    expect(JSON.parse(localStorage.getItem('protopulse-kanban-board')!)).toEqual({
      columns: ['todo', 'in-progress', 'done'],
    });
  });

  it('DesignVariablesStore: per-project API — separate values per projectId', async () => {
    const store = getDesignVariablesStore();
    expect(await store.get('p1')).toBeNull();
    expect(await store.get('p2')).toBeNull();
    await store.set('p1', { Vcc: '5V', Vdd: '3.3V' });
    await store.set('p2', { resistance: 100 });
    expect(await store.get<{ Vcc: string }>('p1')).toEqual({ Vcc: '5V', Vdd: '3.3V' });
    expect(await store.get<{ resistance: number }>('p2')).toEqual({ resistance: 100 });
    // Stored under prefixed keys.
    expect(localStorage.getItem('protopulse:design-variables:project:p1')).toBeTruthy();
    expect(localStorage.getItem('protopulse:design-variables:project:p2')).toBeTruthy();
  });

  it('stores are singletons — getXxx() returns the same instance across calls', () => {
    expect(getUserSettingStore()).toBe(getUserSettingStore());
    expect(getKanbanStateStore()).toBe(getKanbanStateStore());
    expect(getDesignVariablesStore()).toBe(getDesignVariablesStore());
  });

  it('__resetStoresForTesting clears the singleton cache', () => {
    const before = getUserSettingStore();
    __resetStoresForTesting();
    const after = getUserSettingStore();
    expect(before).not.toBe(after);
  });
});
