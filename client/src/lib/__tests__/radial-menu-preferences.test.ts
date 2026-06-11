import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Edit, Plus, Trash2 } from 'lucide-react';
import {
  applyRadialLayoutPreset,
  applyRadialPreferences,
  createRadialLayoutPreset,
  deleteRadialNamedPreset,
  getRadialNamedPresets,
  getRadialPinnedPreset,
  getRadialPinnedPresetId,
  getRadialPreferenceKey,
  getRadialSuggestionSuppressionKey,
  getRadialSuppressedSuggestions,
  moveRadialCommandSlot,
  parseRadialLayoutPreset,
  pinRadialNamedPreset,
  radialPreferencesStore,
  resetRadialLayout,
  saveRadialNamedPreset,
  serializeRadialLayoutPreset,
  suppressRadialSuggestion,
  unpinRadialNamedPreset,
  type RadialPreferences,
} from '@/lib/radial-menu-preferences';
import type { MenuContext, RadialMenuItem } from '@/lib/radial-menu-actions';

function makeItems(): RadialMenuItem[] {
  return [
    {
      id: 'add_node',
      label: 'Add Node',
      description: 'Add a node.',
      icon: Plus,
      slot: 0,
      group: 'create',
      hint: 'N',
    },
    {
      id: 'delete',
      label: 'Delete',
      description: 'Delete a node.',
      icon: Trash2,
      slot: 5,
      group: 'delete',
      hint: 'SW',
      destructive: true,
    },
    {
      id: 'edit',
      label: 'Edit',
      description: 'Edit a node.',
      icon: Edit,
      slot: 6,
      group: 'edit',
      hint: 'W',
    },
  ];
}

const emptyPreferences: RadialPreferences = { version: 1, layouts: {} };

describe('radial menu preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
    radialPreferencesStore.resetAll();
  });

  it('normalizes preference keys by target family', () => {
    expect(getRadialPreferenceKey({ view: 'architecture', target: 'node' })).toBe('architecture:node');
    expect(getRadialPreferenceKey({ view: 'architecture', target: 'wire' })).toBe('architecture:canvas');
    expect(getRadialPreferenceKey({ view: 'pcb', target: 'pad' })).toBe('pcb:object');
    expect(getRadialPreferenceKey({ view: 'breadboard', target: 'wire' })).toBe('breadboard:part');
    expect(getRadialPreferenceKey({ view: 'bom', target: 'bom_row' })).toBe('bom:row');
    expect(getRadialPreferenceKey({ view: 'starter_circuits', target: 'starter_circuit' })).toBe(
      'starter_circuits:starter',
    );
  });

  it('applies saved slots and updates hints', () => {
    const layoutKey = 'architecture:canvas';
    const preferences: RadialPreferences = {
      version: 1,
      layouts: {
        [layoutKey]: { slots: { add_node: 2 } },
      },
    };

    const applied = applyRadialPreferences(makeItems(), layoutKey, preferences);
    expect(applied.find((item) => item.id === 'add_node')).toMatchObject({ slot: 2, hint: 'E' });
  });

  it('swaps an occupied slot when moving a command', () => {
    const layoutKey = 'architecture:canvas';
    const next = moveRadialCommandSlot(emptyPreferences, layoutKey, 'add_node', 5, makeItems());

    const applied = applyRadialPreferences(makeItems(), layoutKey, next);
    expect(applied.find((item) => item.id === 'add_node')).toMatchObject({ slot: 5, hint: 'SW' });
    expect(applied.find((item) => item.id === 'delete')).toMatchObject({ slot: 0, hint: 'N' });
  });

  it('exports, parses, and applies portable layout presets', () => {
    const layoutKey = 'architecture:canvas';
    const items = applyRadialPreferences(makeItems(), layoutKey, {
      version: 1,
      layouts: {
        [layoutKey]: { slots: { add_node: 2, delete: 4, edit: 6 } },
      },
    });

    const preset = createRadialLayoutPreset(layoutKey, items, '2026-06-03T12:00:00.000Z');
    expect(preset).toEqual({
      version: 1,
      layoutKey,
      exportedAt: '2026-06-03T12:00:00.000Z',
      slots: {
        add_node: 2,
        delete: 4,
        edit: 6,
      },
    });

    const parsed = parseRadialLayoutPreset(
      serializeRadialLayoutPreset(layoutKey, items, '2026-06-03T12:00:00.000Z'),
      layoutKey,
      makeItems(),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }

    const applied = applyRadialLayoutPreset(makeItems(), parsed.slots);
    expect(applied.find((item) => item.id === 'add_node')).toMatchObject({ slot: 2, hint: 'E' });
    expect(applied.find((item) => item.id === 'delete')).toMatchObject({ slot: 4, hint: 'S' });
  });

  it('rejects presets for another layout', () => {
    const parsed = parseRadialLayoutPreset(
      JSON.stringify({
        version: 1,
        layoutKey: 'pcb:object',
        exportedAt: '2026-06-03T12:00:00.000Z',
        slots: { add_node: 2 },
      }),
      'architecture:canvas',
      makeItems(),
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toContain('pcb:object');
    }
  });

  it('rejects presets that reference unknown commands or overlapping slots', () => {
    const unknown = parseRadialLayoutPreset(
      JSON.stringify({
        version: 1,
        layoutKey: 'architecture:canvas',
        exportedAt: '2026-06-03T12:00:00.000Z',
        slots: { ghost: 2 },
      }),
      'architecture:canvas',
      makeItems(),
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.reason).toContain('unknown command');
    }

    const overlapping = parseRadialLayoutPreset(
      JSON.stringify({
        version: 1,
        layoutKey: 'architecture:canvas',
        exportedAt: '2026-06-03T12:00:00.000Z',
        slots: { add_node: 5 },
      }),
      'architecture:canvas',
      makeItems(),
    );
    expect(overlapping.ok).toBe(false);
    if (!overlapping.ok) {
      expect(overlapping.reason).toContain('overlaps');
    }
  });

  it('saves and updates named presets per layout', () => {
    const layoutKey = 'architecture:canvas';
    const saved = saveRadialNamedPreset(emptyPreferences, layoutKey, ' Fast build ', makeItems(), {
      id: 'preset-fast',
      now: '2026-06-03T12:00:00.000Z',
    });

    expect(getRadialNamedPresets(saved, layoutKey)).toEqual([
      expect.objectContaining({
        id: 'preset-fast',
        name: 'Fast build',
        layoutKey,
        slots: {
          add_node: 0,
          delete: 5,
          edit: 6,
        },
      }),
    ]);

    const updated = saveRadialNamedPreset(
      saved,
      layoutKey,
      'fast build',
      applyRadialLayoutPreset(makeItems(), { add_node: 2, delete: 5, edit: 6 }),
      { id: 'ignored-id', now: '2026-06-03T13:00:00.000Z' },
    );

    expect(getRadialNamedPresets(updated, layoutKey)).toEqual([
      expect.objectContaining({
        id: 'preset-fast',
        name: 'fast build',
        createdAt: '2026-06-03T12:00:00.000Z',
        updatedAt: '2026-06-03T13:00:00.000Z',
        slots: expect.objectContaining({ add_node: 2 }),
      }),
    ]);
  });

  it('deletes named presets without touching saved layout slots', () => {
    const layoutKey = 'architecture:canvas';
    const preferences = saveRadialNamedPreset(
      {
        version: 1,
        layouts: {
          [layoutKey]: { slots: { add_node: 2 } },
        },
      },
      layoutKey,
      'Fast build',
      makeItems(),
      { id: 'preset-fast', now: '2026-06-03T12:00:00.000Z' },
    );

    const next = deleteRadialNamedPreset(preferences, layoutKey, 'preset-fast');
    expect(getRadialNamedPresets(next, layoutKey)).toEqual([]);
    expect(next.layouts[layoutKey]).toEqual({ slots: { add_node: 2 } });
  });

  it('pins a named preset so it overrides the active layout for that context', () => {
    const layoutKey = 'architecture:canvas';
    const saved = saveRadialNamedPreset(
      {
        version: 1,
        layouts: {
          [layoutKey]: { slots: { add_node: 6 } },
        },
      },
      layoutKey,
      'Fast build',
      applyRadialLayoutPreset(makeItems(), { add_node: 2, delete: 5, edit: 6 }),
      { id: 'preset-fast', now: '2026-06-03T12:00:00.000Z' },
    );

    const pinned = pinRadialNamedPreset(saved, layoutKey, 'preset-fast');
    expect(getRadialPinnedPresetId(pinned, layoutKey)).toBe('preset-fast');
    expect(getRadialPinnedPreset(pinned, layoutKey)?.name).toBe('Fast build');
    expect(applyRadialPreferences(makeItems(), layoutKey, pinned).find((item) => item.id === 'add_node')).toMatchObject(
      {
        slot: 2,
        hint: 'E',
      },
    );

    const unpinned = unpinRadialNamedPreset(pinned, layoutKey);
    expect(getRadialPinnedPresetId(unpinned, layoutKey)).toBeNull();
    expect(
      applyRadialPreferences(makeItems(), layoutKey, unpinned).find((item) => item.id === 'add_node'),
    ).toMatchObject({
      slot: 6,
      hint: 'W',
    });
  });

  it('manual slot moves break a pinned preset while preserving current pinned slots', () => {
    const layoutKey = 'architecture:canvas';
    const saved = saveRadialNamedPreset(
      emptyPreferences,
      layoutKey,
      'Fast build',
      applyRadialLayoutPreset(makeItems(), { add_node: 2, delete: 5, edit: 6 }),
      { id: 'preset-fast', now: '2026-06-03T12:00:00.000Z' },
    );
    const withSuggestion = suppressRadialSuggestion(
      pinRadialNamedPreset(saved, layoutKey, 'preset-fast'),
      layoutKey,
      getRadialSuggestionSuppressionKey('add_node', 5),
    );

    const moved = moveRadialCommandSlot(withSuggestion, layoutKey, 'add_node', 4, makeItems());
    expect(getRadialPinnedPresetId(moved, layoutKey)).toBeNull();
    expect(moved.layouts[layoutKey]?.slots).toMatchObject({
      add_node: 4,
      delete: 5,
      edit: 6,
    });
    expect(getRadialSuppressedSuggestions(moved, layoutKey)).toEqual([
      getRadialSuggestionSuppressionKey('add_node', 5),
    ]);
  });

  it('deleting a pinned preset clears only that context pin', () => {
    const layoutKey = 'architecture:canvas';
    const saved = saveRadialNamedPreset(emptyPreferences, layoutKey, 'Fast build', makeItems(), {
      id: 'preset-fast',
      now: '2026-06-03T12:00:00.000Z',
    });

    const pinned = pinRadialNamedPreset(saved, layoutKey, 'preset-fast');
    const deleted = deleteRadialNamedPreset(pinned, layoutKey, 'preset-fast');
    expect(getRadialNamedPresets(deleted, layoutKey)).toEqual([]);
    expect(getRadialPinnedPresetId(deleted, layoutKey)).toBeNull();
  });

  it('does not move non-customizable commands', () => {
    const layoutKey = 'architecture:canvas';
    const items = makeItems();
    items[0] = { ...items[0], customizable: false };

    const next = moveRadialCommandSlot(emptyPreferences, layoutKey, 'add_node', 5, items);
    expect(next).toBe(emptyPreferences);
  });

  it('resets a single layout without touching others', () => {
    const preferences: RadialPreferences = {
      version: 1,
      layouts: {
        'architecture:canvas': { slots: { add_node: 2 } },
        'architecture:node': { slots: { edit: 0 } },
      },
      suppressedSuggestions: {
        'architecture:canvas': [getRadialSuggestionSuppressionKey('add_node', 5)],
        'architecture:node': [getRadialSuggestionSuppressionKey('edit', 0)],
      },
    };

    expect(resetRadialLayout(preferences, 'architecture:canvas')).toEqual({
      version: 1,
      layouts: {
        'architecture:node': { slots: { edit: 0 } },
      },
      suppressedSuggestions: {
        'architecture:node': [getRadialSuggestionSuppressionKey('edit', 0)],
      },
    });
  });

  it('persists suppressed suggestion keys per layout', () => {
    const layoutKey = 'architecture:canvas';
    const key = getRadialSuggestionSuppressionKey('add_node', 5);
    const next = suppressRadialSuggestion(emptyPreferences, layoutKey, key);

    expect(getRadialSuppressedSuggestions(next, layoutKey)).toEqual([key]);
    expect(getRadialSuppressedSuggestions(next, 'architecture:node')).toEqual([]);

    const duplicate = suppressRadialSuggestion(next, layoutKey, key);
    expect(duplicate).toBe(next);
  });

  it('persists changes and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = radialPreferencesStore.subscribe(listener);

    radialPreferencesStore.setCommandSlot('architecture:canvas', 'add_node', 2, makeItems());
    radialPreferencesStore.suppressSuggestion('architecture:canvas', getRadialSuggestionSuppressionKey('add_node', 5));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem('protopulse-radial-preferences-v1')).toContain('add_node');
    expect(radialPreferencesStore.getSnapshot().layouts['architecture:canvas']?.slots.add_node).toBe(2);
    expect(getRadialSuppressedSuggestions(radialPreferencesStore.getSnapshot(), 'architecture:canvas')).toEqual([
      getRadialSuggestionSuppressionKey('add_node', 5),
    ]);

    unsubscribe();
  });

  it('recovers from malformed localStorage by using an empty snapshot', () => {
    window.localStorage.setItem('protopulse-radial-preferences-v1', '{nope');
    radialPreferencesStore.resetAll();

    const context: MenuContext = { view: 'architecture', target: 'canvas' };
    expect(applyRadialPreferences(makeItems(), getRadialPreferenceKey(context))).toEqual(makeItems());
  });
});
