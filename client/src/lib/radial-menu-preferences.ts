import { useSyncExternalStore } from 'react';
import {
  radialSlotMeta,
  type MenuContext,
  type RadialMenuItem,
  type RadialSlot,
  type TargetKind,
} from '@/lib/radial-menu-actions';

const STORAGE_KEY = 'protopulse-radial-preferences-v1';
const PREFERENCE_VERSION = 1;
export const RADIAL_LAYOUT_PRESET_VERSION = 1;
export const RADIAL_NAMED_PRESET_LIMIT = 8;
export const RADIAL_SUPPRESSED_SUGGESTION_LIMIT = 32;

export interface RadialLayoutPreference {
  slots: Partial<Record<string, RadialSlot>>;
}

export interface RadialLayoutPreset {
  version: typeof RADIAL_LAYOUT_PRESET_VERSION;
  layoutKey: string;
  exportedAt: string;
  slots: Partial<Record<string, RadialSlot>>;
}

export interface RadialNamedLayoutPreset extends RadialLayoutPreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type RadialLayoutPresetParseResult =
  | {
      ok: true;
      preset: RadialLayoutPreset;
      slots: Partial<Record<string, RadialSlot>>;
    }
  | {
      ok: false;
      reason: string;
    };

export interface RadialPreferences {
  version: typeof PREFERENCE_VERSION;
  layouts: Record<string, RadialLayoutPreference>;
  presetShelves?: Record<string, RadialNamedLayoutPreset[]>;
  suppressedSuggestions?: Record<string, string[]>;
  pinnedPresets?: Record<string, string>;
}

const EMPTY_PREFERENCES: RadialPreferences = Object.freeze({
  version: PREFERENCE_VERSION,
  layouts: {},
  presetShelves: {},
});

const VALID_SLOTS = new Set<RadialSlot>([0, 1, 2, 3, 4, 5, 6, 7]);
const listeners = new Set<() => void>();
let cachedSnapshot: RadialPreferences = readStoredPreferences();

function normalizeTarget(view: MenuContext['view'], target: TargetKind): string {
  switch (view) {
    case 'architecture':
    case 'schematic':
      return target === 'node' ? 'node' : 'canvas';
    case 'pcb':
      return target === 'node' || target === 'pad' || target === 'via' || target === 'trace' ? 'object' : 'canvas';
    case 'breadboard':
      return target === 'node' || target === 'wire' ? 'part' : 'canvas';
    case 'bom':
      return target === 'bom_row' ? 'row' : 'canvas';
    case 'validation':
      return target === 'issue' ? 'issue' : 'view';
    case 'simulation':
      return target === 'probe' ? 'probe' : 'view';
    case 'starter_circuits':
      return target === 'starter_circuit' ? 'starter' : 'view';
    case 'model_3d':
      return target === 'model' ? 'model' : 'view';
    case 'serial':
      return target === 'log_line' ? 'log' : 'view';
    case 'exports':
    case 'firmware':
      return target === 'file' ? 'file' : 'view';
    case 'inventory':
      return target === 'part' ? 'part' : 'view';
  }
}

function isRadialSlot(value: unknown): value is RadialSlot {
  return typeof value === 'number' && VALID_SLOTS.has(value as RadialSlot);
}

function commandLabelById(items: RadialMenuItem[], commandId: string): string {
  return items.find((item) => item.id === commandId)?.label ?? commandId;
}

function sanitizePresetName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed.slice(0, 40) : 'Wheel preset';
}

function createPresetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `radial-${Math.random().toString(36).slice(2, 10)}`;
}

function hasPreferencesContent(preferences: RadialPreferences): boolean {
  return (
    Object.keys(preferences.layouts).length > 0 ||
    Object.values(preferences.presetShelves ?? {}).some((shelf) => shelf.length > 0) ||
    Object.values(preferences.suppressedSuggestions ?? {}).some((suggestions) => suggestions.length > 0) ||
    Object.keys(preferences.pinnedPresets ?? {}).length > 0
  );
}

function createPreferencesSnapshot(fields: {
  layouts: Record<string, RadialLayoutPreference>;
  presetShelves?: Record<string, RadialNamedLayoutPreset[]>;
  suppressedSuggestions?: Record<string, string[]>;
  pinnedPresets?: Record<string, string>;
}): RadialPreferences {
  const next: RadialPreferences = {
    version: PREFERENCE_VERSION,
    layouts: fields.layouts,
  };

  if (fields.presetShelves && Object.keys(fields.presetShelves).length > 0) {
    next.presetShelves = fields.presetShelves;
  }
  if (fields.suppressedSuggestions && Object.keys(fields.suppressedSuggestions).length > 0) {
    next.suppressedSuggestions = fields.suppressedSuggestions;
  }
  if (fields.pinnedPresets && Object.keys(fields.pinnedPresets).length > 0) {
    next.pinnedPresets = fields.pinnedPresets;
  }

  return next;
}

function sanitizePresetSlots(value: unknown): Partial<Record<string, RadialSlot>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const slots: Partial<Record<string, RadialSlot>> = {};
  for (const [commandId, slot] of Object.entries(value as Record<string, unknown>)) {
    if (isRadialSlot(slot)) {
      slots[commandId] = slot;
    }
  }

  return Object.keys(slots).length > 0 ? slots : null;
}

function sanitizeSuppressedSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value)]
    .filter((key): key is string => typeof key === 'string' && key.length > 0 && key.length <= 120)
    .slice(0, RADIAL_SUPPRESSED_SUGGESTION_LIMIT);
}

function sanitizeNamedPreset(layoutKey: string, value: unknown): RadialNamedLayoutPreset | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    id?: unknown;
    name?: unknown;
    version?: unknown;
    layoutKey?: unknown;
    exportedAt?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    slots?: unknown;
  };

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    candidate.version !== RADIAL_LAYOUT_PRESET_VERSION ||
    candidate.layoutKey !== layoutKey ||
    typeof candidate.exportedAt !== 'string' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null;
  }

  const slots = sanitizePresetSlots(candidate.slots);
  if (!slots) {
    return null;
  }

  return {
    id: candidate.id,
    name: sanitizePresetName(candidate.name),
    version: RADIAL_LAYOUT_PRESET_VERSION,
    layoutKey,
    exportedAt: candidate.exportedAt,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    slots,
  };
}

function sanitizePreferences(value: unknown): RadialPreferences {
  if (!value || typeof value !== 'object') {
    return EMPTY_PREFERENCES;
  }

  const candidate = value as {
    version?: unknown;
    layouts?: unknown;
    presetShelves?: unknown;
    suppressedSuggestions?: unknown;
    pinnedPresets?: unknown;
  };
  if (candidate.version !== PREFERENCE_VERSION || !candidate.layouts || typeof candidate.layouts !== 'object') {
    return EMPTY_PREFERENCES;
  }

  const layouts: Record<string, RadialLayoutPreference> = {};
  for (const [layoutKey, rawLayout] of Object.entries(candidate.layouts as Record<string, unknown>)) {
    if (!rawLayout || typeof rawLayout !== 'object') {
      continue;
    }
    const rawSlots = (rawLayout as { slots?: unknown }).slots;
    if (!rawSlots || typeof rawSlots !== 'object') {
      continue;
    }

    const slots: Partial<Record<string, RadialSlot>> = {};
    for (const [commandId, slot] of Object.entries(rawSlots as Record<string, unknown>)) {
      if (isRadialSlot(slot)) {
        slots[commandId] = slot;
      }
    }
    if (Object.keys(slots).length > 0) {
      layouts[layoutKey] = { slots };
    }
  }

  const presetShelves: Record<string, RadialNamedLayoutPreset[]> = {};
  if (
    candidate.presetShelves &&
    typeof candidate.presetShelves === 'object' &&
    !Array.isArray(candidate.presetShelves)
  ) {
    for (const [layoutKey, rawShelf] of Object.entries(candidate.presetShelves as Record<string, unknown>)) {
      if (!Array.isArray(rawShelf)) {
        continue;
      }
      const shelf = rawShelf
        .map((preset) => sanitizeNamedPreset(layoutKey, preset))
        .filter((preset): preset is RadialNamedLayoutPreset => Boolean(preset))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, RADIAL_NAMED_PRESET_LIMIT);
      if (shelf.length > 0) {
        presetShelves[layoutKey] = shelf;
      }
    }
  }

  const suppressedSuggestions: Record<string, string[]> = {};
  if (
    candidate.suppressedSuggestions &&
    typeof candidate.suppressedSuggestions === 'object' &&
    !Array.isArray(candidate.suppressedSuggestions)
  ) {
    for (const [layoutKey, rawSuggestions] of Object.entries(
      candidate.suppressedSuggestions as Record<string, unknown>,
    )) {
      const suggestions = sanitizeSuppressedSuggestions(rawSuggestions);
      if (suggestions.length > 0) {
        suppressedSuggestions[layoutKey] = suggestions;
      }
    }
  }

  const pinnedPresets: Record<string, string> = {};
  if (
    candidate.pinnedPresets &&
    typeof candidate.pinnedPresets === 'object' &&
    !Array.isArray(candidate.pinnedPresets)
  ) {
    for (const [layoutKey, presetId] of Object.entries(candidate.pinnedPresets as Record<string, unknown>)) {
      if (
        typeof presetId === 'string' &&
        presetId.length > 0 &&
        presetId.length <= 120 &&
        presetShelves[layoutKey]?.some((preset) => preset.id === presetId)
      ) {
        pinnedPresets[layoutKey] = presetId;
      }
    }
  }

  return createPreferencesSnapshot({
    layouts,
    presetShelves,
    suppressedSuggestions,
    pinnedPresets,
  });
}

function readStoredPreferences(): RadialPreferences {
  if (typeof window === 'undefined') {
    return EMPTY_PREFERENCES;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizePreferences(JSON.parse(raw)) : EMPTY_PREFERENCES;
  } catch {
    return EMPTY_PREFERENCES;
  }
}

function persistPreferences(next: RadialPreferences): void {
  cachedSnapshot = next;
  if (typeof window !== 'undefined') {
    try {
      if (!hasPreferencesContent(next)) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      // Storage can be unavailable in private contexts. Keep the in-memory
      // snapshot so the current session still behaves predictably.
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

function findNextFreeSlot(used: Set<RadialSlot>, preferred: RadialSlot): RadialSlot {
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = ((preferred + offset) % 8) as RadialSlot;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return preferred;
}

export function getRadialPreferenceKey(context: Pick<MenuContext, 'view' | 'target'>): string {
  return `${context.view}:${normalizeTarget(context.view, context.target)}`;
}

export function getRadialSuggestionSuppressionKey(commandId: string, slot: RadialSlot): string {
  return `${commandId}:${String(slot)}`;
}

export function applyRadialPreferences(
  items: RadialMenuItem[],
  layoutKey: string,
  preferences: RadialPreferences = radialPreferencesStore.getSnapshot(),
): RadialMenuItem[] {
  const pinnedPreset = getRadialPinnedPreset(preferences, layoutKey);
  const layout = pinnedPreset ? { slots: pinnedPreset.slots } : preferences.layouts[layoutKey];
  if (!layout) {
    return items;
  }

  const used = new Set<RadialSlot>();
  const assigned = items.map((item) => {
    const preferred = item.customizable === false ? undefined : layout.slots[item.id];
    const desiredSlot = preferred ?? item.slot;
    const nextSlot = used.has(desiredSlot) ? findNextFreeSlot(used, item.slot) : desiredSlot;
    used.add(nextSlot);
    return {
      ...item,
      slot: nextSlot,
      hint: radialSlotMeta[nextSlot].direction,
    };
  });

  return assigned.sort((a, b) => a.slot - b.slot);
}

export function createRadialLayoutPreset(
  layoutKey: string,
  items: RadialMenuItem[],
  exportedAt = new Date().toISOString(),
): RadialLayoutPreset {
  const slots: Partial<Record<string, RadialSlot>> = {};
  for (const item of items) {
    if (item.customizable !== false) {
      slots[item.id] = item.slot;
    }
  }

  return {
    version: RADIAL_LAYOUT_PRESET_VERSION,
    layoutKey,
    exportedAt,
    slots,
  };
}

export function serializeRadialLayoutPreset(layoutKey: string, items: RadialMenuItem[], exportedAt?: string): string {
  return JSON.stringify(createRadialLayoutPreset(layoutKey, items, exportedAt), null, 2);
}

export function parseRadialLayoutPreset(
  rawPreset: string,
  layoutKey: string,
  currentItems: RadialMenuItem[],
): RadialLayoutPresetParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPreset);
  } catch {
    return { ok: false, reason: 'Preset is not valid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'Preset must be a JSON object.' };
  }

  const candidate = parsed as {
    version?: unknown;
    layoutKey?: unknown;
    exportedAt?: unknown;
    slots?: unknown;
  };

  if (candidate.version !== RADIAL_LAYOUT_PRESET_VERSION) {
    return { ok: false, reason: 'Preset version is not supported.' };
  }
  if (candidate.layoutKey !== layoutKey) {
    return { ok: false, reason: `Preset belongs to ${String(candidate.layoutKey || 'another layout')}.` };
  }
  if (typeof candidate.exportedAt !== 'string') {
    return { ok: false, reason: 'Preset is missing an export timestamp.' };
  }
  if (!candidate.slots || typeof candidate.slots !== 'object' || Array.isArray(candidate.slots)) {
    return { ok: false, reason: 'Preset slots are missing.' };
  }

  const knownItems = new Map(currentItems.map((item) => [item.id, item]));
  const nextSlots = new Map(currentItems.map((item) => [item.id, item.slot]));
  const slots: Partial<Record<string, RadialSlot>> = {};

  for (const [commandId, rawSlot] of Object.entries(candidate.slots as Record<string, unknown>)) {
    const item = knownItems.get(commandId);
    if (!item) {
      return { ok: false, reason: `Preset references unknown command: ${commandId}.` };
    }
    if (item.customizable === false) {
      return { ok: false, reason: `${item.label} cannot be moved.` };
    }
    if (!isRadialSlot(rawSlot)) {
      return { ok: false, reason: `${item.label} has an invalid slot.` };
    }

    slots[commandId] = rawSlot;
    nextSlots.set(commandId, rawSlot);
  }

  if (Object.keys(slots).length === 0) {
    return { ok: false, reason: 'Preset has no command slots.' };
  }

  const occupied = new Map<RadialSlot, string>();
  for (const [commandId, slot] of nextSlots.entries()) {
    const existingCommandId = occupied.get(slot);
    if (existingCommandId) {
      return {
        ok: false,
        reason: `${commandLabelById(currentItems, commandId)} overlaps ${commandLabelById(currentItems, existingCommandId)}.`,
      };
    }
    occupied.set(slot, commandId);
  }

  return {
    ok: true,
    preset: {
      version: RADIAL_LAYOUT_PRESET_VERSION,
      layoutKey,
      exportedAt: candidate.exportedAt,
      slots,
    },
    slots,
  };
}

export function applyRadialLayoutPreset(
  items: RadialMenuItem[],
  slots: Partial<Record<string, RadialSlot>>,
): RadialMenuItem[] {
  return items
    .map((item) => {
      const slot = item.customizable === false ? undefined : slots[item.id];
      if (slot === undefined) {
        return item;
      }
      return {
        ...item,
        slot,
        hint: radialSlotMeta[slot].direction,
      };
    })
    .sort((a, b) => a.slot - b.slot);
}

export function getRadialNamedPresets(preferences: RadialPreferences, layoutKey: string): RadialNamedLayoutPreset[] {
  return preferences.presetShelves?.[layoutKey] ?? [];
}

export function getRadialPinnedPresetId(preferences: RadialPreferences, layoutKey: string): string | null {
  const presetId = preferences.pinnedPresets?.[layoutKey];
  return presetId && getRadialNamedPresets(preferences, layoutKey).some((preset) => preset.id === presetId)
    ? presetId
    : null;
}

export function getRadialPinnedPreset(
  preferences: RadialPreferences,
  layoutKey: string,
): RadialNamedLayoutPreset | null {
  const presetId = getRadialPinnedPresetId(preferences, layoutKey);
  return presetId
    ? (getRadialNamedPresets(preferences, layoutKey).find((preset) => preset.id === presetId) ?? null)
    : null;
}

export function getRadialSuppressedSuggestions(preferences: RadialPreferences, layoutKey: string): string[] {
  return preferences.suppressedSuggestions?.[layoutKey] ?? [];
}

export function saveRadialNamedPreset(
  preferences: RadialPreferences,
  layoutKey: string,
  name: string,
  currentItems: RadialMenuItem[],
  options: { id?: string; now?: string } = {},
): RadialPreferences {
  const now = options.now ?? new Date().toISOString();
  const presetName = sanitizePresetName(name);
  const shelf = getRadialNamedPresets(preferences, layoutKey);
  const existing = shelf.find((preset) => preset.name.toLocaleLowerCase() === presetName.toLocaleLowerCase());
  const id = existing?.id ?? options.id ?? createPresetId();
  const createdAt = existing?.createdAt ?? now;
  const preset = createRadialLayoutPreset(layoutKey, currentItems, now);
  const namedPreset: RadialNamedLayoutPreset = {
    ...preset,
    id,
    name: presetName,
    createdAt,
    updatedAt: now,
  };
  const nextShelf = [namedPreset, ...shelf.filter((item) => item.id !== id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RADIAL_NAMED_PRESET_LIMIT);

  return createPreferencesSnapshot({
    layouts: preferences.layouts,
    presetShelves: {
      ...(preferences.presetShelves ?? {}),
      [layoutKey]: nextShelf,
    },
    suppressedSuggestions: preferences.suppressedSuggestions,
    pinnedPresets: preferences.pinnedPresets,
  });
}

export function deleteRadialNamedPreset(
  preferences: RadialPreferences,
  layoutKey: string,
  presetId: string,
): RadialPreferences {
  const shelf = getRadialNamedPresets(preferences, layoutKey);
  const nextShelf = shelf.filter((preset) => preset.id !== presetId);
  if (nextShelf.length === shelf.length) {
    return preferences;
  }

  const nextShelves = { ...(preferences.presetShelves ?? {}) };
  if (nextShelf.length > 0) {
    nextShelves[layoutKey] = nextShelf;
  } else {
    delete nextShelves[layoutKey];
  }

  const nextPinnedPresets = { ...(preferences.pinnedPresets ?? {}) };
  if (nextPinnedPresets[layoutKey] === presetId) {
    delete nextPinnedPresets[layoutKey];
  }

  return createPreferencesSnapshot({
    layouts: preferences.layouts,
    presetShelves: nextShelves,
    suppressedSuggestions: preferences.suppressedSuggestions,
    pinnedPresets: nextPinnedPresets,
  });
}

export function pinRadialNamedPreset(
  preferences: RadialPreferences,
  layoutKey: string,
  presetId: string,
): RadialPreferences {
  if (!getRadialNamedPresets(preferences, layoutKey).some((preset) => preset.id === presetId)) {
    return preferences;
  }
  if (preferences.pinnedPresets?.[layoutKey] === presetId) {
    return preferences;
  }

  return createPreferencesSnapshot({
    layouts: preferences.layouts,
    presetShelves: preferences.presetShelves,
    suppressedSuggestions: preferences.suppressedSuggestions,
    pinnedPresets: {
      ...(preferences.pinnedPresets ?? {}),
      [layoutKey]: presetId,
    },
  });
}

export function unpinRadialNamedPreset(preferences: RadialPreferences, layoutKey: string): RadialPreferences {
  if (!preferences.pinnedPresets?.[layoutKey]) {
    return preferences;
  }

  const nextPinnedPresets = { ...preferences.pinnedPresets };
  delete nextPinnedPresets[layoutKey];

  return createPreferencesSnapshot({
    layouts: preferences.layouts,
    presetShelves: preferences.presetShelves,
    suppressedSuggestions: preferences.suppressedSuggestions,
    pinnedPresets: nextPinnedPresets,
  });
}

export function suppressRadialSuggestion(
  preferences: RadialPreferences,
  layoutKey: string,
  suggestionKey: string,
): RadialPreferences {
  const current = getRadialSuppressedSuggestions(preferences, layoutKey);
  if (current.includes(suggestionKey)) {
    return preferences;
  }

  const nextSuggestions = [suggestionKey, ...current].slice(0, RADIAL_SUPPRESSED_SUGGESTION_LIMIT);
  return createPreferencesSnapshot({
    layouts: preferences.layouts,
    presetShelves: preferences.presetShelves,
    suppressedSuggestions: {
      ...(preferences.suppressedSuggestions ?? {}),
      [layoutKey]: nextSuggestions,
    },
    pinnedPresets: preferences.pinnedPresets,
  });
}

export function moveRadialCommandSlot(
  preferences: RadialPreferences,
  layoutKey: string,
  commandId: string,
  slot: RadialSlot,
  currentItems: RadialMenuItem[],
): RadialPreferences {
  const current = applyRadialPreferences(currentItems, layoutKey, preferences);
  const moving = current.find((item) => item.id === commandId);
  if (!moving || moving.customizable === false) {
    return preferences;
  }

  const existing = current.find((item) => item.id !== commandId && item.slot === slot && item.customizable !== false);
  const pinnedPresetId = getRadialPinnedPresetId(preferences, layoutKey);
  const currentSlots: Partial<Record<string, RadialSlot>> = {};
  if (pinnedPresetId) {
    for (const item of current) {
      if (item.customizable !== false) {
        currentSlots[item.id] = item.slot;
      }
    }
  }
  const layout = pinnedPresetId ? { slots: currentSlots } : (preferences.layouts[layoutKey] ?? { slots: {} });
  const nextSlots: Partial<Record<string, RadialSlot>> = { ...layout.slots, [commandId]: slot };
  if (existing) {
    nextSlots[existing.id] = moving.slot;
  }

  const nextPinnedPresets = { ...(preferences.pinnedPresets ?? {}) };
  if (pinnedPresetId) {
    delete nextPinnedPresets[layoutKey];
  }

  return createPreferencesSnapshot({
    layouts: {
      ...preferences.layouts,
      [layoutKey]: { slots: nextSlots },
    },
    presetShelves: preferences.presetShelves,
    suppressedSuggestions: preferences.suppressedSuggestions,
    pinnedPresets: nextPinnedPresets,
  });
}

export function resetRadialLayout(preferences: RadialPreferences, layoutKey: string): RadialPreferences {
  if (
    !preferences.layouts[layoutKey] &&
    !preferences.suppressedSuggestions?.[layoutKey] &&
    !preferences.pinnedPresets?.[layoutKey]
  ) {
    return preferences;
  }

  const { [layoutKey]: _removed, ...layouts } = preferences.layouts;
  const { [layoutKey]: _removedSuggestions, ...suppressedSuggestions } = preferences.suppressedSuggestions ?? {};
  const { [layoutKey]: _removedPinnedPreset, ...pinnedPresets } = preferences.pinnedPresets ?? {};
  return createPreferencesSnapshot({
    layouts,
    presetShelves: preferences.presetShelves,
    suppressedSuggestions,
    pinnedPresets,
  });
}

export const radialPreferencesStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const storageListener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        cachedSnapshot = readStoredPreferences();
        listener();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', storageListener);
    }
    return () => {
      listeners.delete(listener);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', storageListener);
      }
    };
  },
  getSnapshot(): RadialPreferences {
    return cachedSnapshot;
  },
  getServerSnapshot(): RadialPreferences {
    return EMPTY_PREFERENCES;
  },
  setCommandSlot(layoutKey: string, commandId: string, slot: RadialSlot, currentItems: RadialMenuItem[]): void {
    persistPreferences(moveRadialCommandSlot(cachedSnapshot, layoutKey, commandId, slot, currentItems));
  },
  saveNamedPreset(layoutKey: string, name: string, currentItems: RadialMenuItem[]): void {
    persistPreferences(saveRadialNamedPreset(cachedSnapshot, layoutKey, name, currentItems));
  },
  deleteNamedPreset(layoutKey: string, presetId: string): void {
    persistPreferences(deleteRadialNamedPreset(cachedSnapshot, layoutKey, presetId));
  },
  pinNamedPreset(layoutKey: string, presetId: string): void {
    persistPreferences(pinRadialNamedPreset(cachedSnapshot, layoutKey, presetId));
  },
  unpinNamedPreset(layoutKey: string): void {
    persistPreferences(unpinRadialNamedPreset(cachedSnapshot, layoutKey));
  },
  suppressSuggestion(layoutKey: string, suggestionKey: string): void {
    persistPreferences(suppressRadialSuggestion(cachedSnapshot, layoutKey, suggestionKey));
  },
  resetLayout(layoutKey: string): void {
    persistPreferences(resetRadialLayout(cachedSnapshot, layoutKey));
  },
  resetAll(): void {
    persistPreferences(EMPTY_PREFERENCES);
  },
};

export function useRadialPreferences(): RadialPreferences {
  return useSyncExternalStore(
    radialPreferencesStore.subscribe,
    radialPreferencesStore.getSnapshot,
    radialPreferencesStore.getServerSnapshot,
  );
}
