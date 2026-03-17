/**
 * Keybinding Editor
 *
 * A higher-level keybinding management layer that sits on top of
 * KeyboardShortcutManager. Provides a string-based key representation
 * (e.g. "Ctrl+Shift+Z"), singleton+subscribe reactivity, conflict
 * detection that identifies the specific conflicting binding, and a
 * React hook for component integration.
 *
 * Storage key: 'protopulse:custom-keybindings' (distinct from the
 * lower-level 'protopulse-keyboard-shortcuts' used by the shortcut
 * manager, so the two layers can coexist during migration).
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical category for grouping keybindings in a settings UI. */
export type KeybindingCategory = 'edit' | 'view' | 'tools' | 'navigation' | 'circuit' | 'simulation';

/** A single keybinding definition. */
export interface Keybinding {
  /** Unique identifier (e.g. 'undo', 'zoom-in', 'tool-wire'). */
  id: string;
  /** Human-readable action name (e.g. "Undo"). */
  action: string;
  /**
   * Normalized key-combo string.
   * Modifier order: Ctrl+Shift+Alt+Meta+<Key>.
   * Single-char keys are uppercased; special keys use their KeyboardEvent.key name.
   * Space is represented as "Space".
   */
  keys: string;
  /** Grouping category for the settings UI. */
  category: KeybindingCategory;
  /** Short description of what the action does. */
  description: string;
  /** Whether this binding is still at its factory default. */
  isDefault: boolean;
}

/** Returned by `detectConflict` when a proposed key-combo clashes. */
export interface KeybindingConflict {
  /** The `id` of the existing binding that already uses these keys. */
  existingId: string;
  /** The key-combo string that conflicts. */
  newKeys: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:custom-keybindings';

/** Factory-default bindings. IDs intentionally align with KeyboardShortcutManager. */
const DEFAULT_BINDINGS: ReadonlyArray<Omit<Keybinding, 'isDefault'>> = [
  { id: 'undo', action: 'Undo', keys: 'Ctrl+Z', category: 'edit', description: 'Undo the last action' },
  { id: 'redo', action: 'Redo', keys: 'Ctrl+Y', category: 'edit', description: 'Redo the last undone action' },
  {
    id: 'redo-alt',
    action: 'Redo (Alt)',
    keys: 'Ctrl+Shift+Z',
    category: 'edit',
    description: 'Alternative redo shortcut',
  },
  { id: 'save', action: 'Save', keys: 'Ctrl+S', category: 'edit', description: 'Save the current project' },
  { id: 'delete', action: 'Delete Selected', keys: 'Delete', category: 'edit', description: 'Delete selected items' },
  {
    id: 'delete-alt',
    action: 'Delete (Alt)',
    keys: 'Backspace',
    category: 'edit',
    description: 'Alternative delete shortcut',
  },
  { id: 'select-all', action: 'Select All', keys: 'Ctrl+A', category: 'edit', description: 'Select all items' },
  {
    id: 'deselect',
    action: 'Deselect / Close',
    keys: 'Escape',
    category: 'edit',
    description: 'Deselect all or close current panel',
  },
  { id: 'copy', action: 'Copy', keys: 'Ctrl+C', category: 'edit', description: 'Copy selected items to clipboard' },
  {
    id: 'paste',
    action: 'Paste',
    keys: 'Ctrl+V',
    category: 'edit',
    description: 'Paste items from clipboard',
  },
  { id: 'cut', action: 'Cut', keys: 'Ctrl+X', category: 'edit', description: 'Cut selected items to clipboard' },
  { id: 'zoom-in', action: 'Zoom In', keys: 'Ctrl+=', category: 'view', description: 'Zoom into the canvas' },
  { id: 'zoom-out', action: 'Zoom Out', keys: 'Ctrl+-', category: 'view', description: 'Zoom out of the canvas' },
  {
    id: 'zoom-fit',
    action: 'Zoom to Fit',
    keys: 'Ctrl+0',
    category: 'view',
    description: 'Fit the entire design in view',
  },
  { id: 'tool-select', action: 'Select Tool', keys: '1', category: 'tools', description: 'Switch to selection tool' },
  { id: 'tool-wire', action: 'Wire Tool', keys: '2', category: 'tools', description: 'Switch to wire drawing tool' },
  {
    id: 'tool-delete',
    action: 'Delete Tool',
    keys: '3',
    category: 'tools',
    description: 'Switch to delete/erase tool',
  },
  { id: 'pan', action: 'Pan Mode', keys: 'Space', category: 'navigation', description: 'Hold to pan the canvas' },
  {
    id: 'find',
    action: 'Find',
    keys: 'Ctrl+F',
    category: 'navigation',
    description: 'Open the search / find dialog',
  },
];

// ---------------------------------------------------------------------------
// KeybindingEditor (singleton + subscribe)
// ---------------------------------------------------------------------------

type Listener = () => void;

/**
 * Singleton keybinding editor.
 *
 * Manages the full set of bindings, persists user customizations to
 * localStorage, and exposes a subscribe/getSnapshot API compatible
 * with React's `useSyncExternalStore`.
 */
export class KeybindingEditor {
  // -- Singleton ------------------------------------------------------------
  private static instance: KeybindingEditor | null = null;

  static getInstance(): KeybindingEditor {
    if (!KeybindingEditor.instance) {
      KeybindingEditor.instance = new KeybindingEditor();
    }
    return KeybindingEditor.instance;
  }

  /** Reset the singleton (for testing). */
  static resetInstance(): void {
    KeybindingEditor.instance = null;
  }

  // -- Internal state -------------------------------------------------------
  /** Overrides stored as id -> keys string. Only non-default bindings are stored. */
  private overrides: Map<string, string>;
  private listeners: Set<Listener> = new Set();
  /** Snapshot reference bumped on every mutation to trigger React re-renders. */
  private snapshot: ReadonlyArray<Keybinding>;

  constructor() {
    this.overrides = new Map();
    this.loadFromStorage();
    this.snapshot = this.buildSnapshot();
  }

  // -- Subscribe pattern (useSyncExternalStore) -----------------------------

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ReadonlyArray<Keybinding> => {
    return this.snapshot;
  };

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  // -- Queries --------------------------------------------------------------

  /** Return all bindings (defaults + overrides merged). */
  getBindings(): ReadonlyArray<Keybinding> {
    return this.snapshot;
  }

  /** Get a single binding by id, or undefined if the id is unknown. */
  getBinding(id: string): Keybinding | undefined {
    return this.snapshot.find((b) => b.id === id);
  }

  /** Return bindings filtered by category. */
  getBindingsByCategory(category: KeybindingCategory): ReadonlyArray<Keybinding> {
    return this.snapshot.filter((b) => b.category === category);
  }

  // -- Mutations ------------------------------------------------------------

  /**
   * Set a custom key-combo for a binding.
   * The keys string is normalized before storing.
   *
   * @returns A `KeybindingConflict` if the new keys clash with another binding, or `null`.
   *          The binding IS updated even when a conflict exists — the caller decides
   *          whether to revert.
   */
  setBinding(id: string, keys: string): KeybindingConflict | null {
    const defaultDef = DEFAULT_BINDINGS.find((d) => d.id === id);
    if (!defaultDef) {
      return null; // Unknown id — no-op.
    }

    const normalized = normalizeKeysString(keys);
    const conflict = this.detectConflict(normalized, id);

    // If the new keys match the default, remove the override instead of storing a redundant entry.
    if (normalized === defaultDef.keys) {
      this.overrides.delete(id);
    } else {
      this.overrides.set(id, normalized);
    }

    this.persistToStorage();
    this.emit();
    return conflict;
  }

  /** Reset a single binding to its factory default. */
  resetBinding(id: string): void {
    if (!this.overrides.has(id)) {
      return; // Already at default.
    }
    this.overrides.delete(id);
    this.persistToStorage();
    this.emit();
  }

  /** Reset every binding to factory defaults. */
  resetAll(): void {
    if (this.overrides.size === 0) {
      return; // Nothing to reset.
    }
    this.overrides.clear();
    this.persistToStorage();
    this.emit();
  }

  // -- Conflict detection ---------------------------------------------------

  /**
   * Check whether `keys` would conflict with any existing binding.
   *
   * @param keys - The normalized key-combo string to test.
   * @param excludeId - Optionally exclude a binding id from the check
   *                     (useful when reassigning a binding's own keys).
   * @returns The conflict descriptor, or `null` if no conflict.
   */
  detectConflict(keys: string, excludeId?: string): KeybindingConflict | null {
    const normalized = normalizeKeysString(keys);
    for (const binding of this.snapshot) {
      if (binding.id === excludeId) {
        continue;
      }
      if (binding.keys === normalized) {
        return { existingId: binding.id, newKeys: normalized };
      }
    }
    return null;
  }

  // -- Formatting utilities -------------------------------------------------

  /**
   * Format a keys string for human display.
   * Essentially a no-op when the string is already normalized, but handles
   * edge cases like lowercase single-char keys and platform-specific labels.
   */
  formatKeys(keys: string): string {
    return normalizeKeysString(keys);
  }

  /**
   * Convert a KeyboardEvent into a normalized keys string.
   *
   * Useful for "press a key" capture UIs — the user presses a combo and
   * the editor records it.
   */
  parseKeyCombo(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.ctrlKey) {
      parts.push('Ctrl');
    }
    if (event.shiftKey) {
      parts.push('Shift');
    }
    if (event.altKey) {
      parts.push('Alt');
    }
    if (event.metaKey) {
      parts.push('Meta');
    }

    // Ignore standalone modifier presses.
    const ignoredKeys = new Set(['Control', 'Shift', 'Alt', 'Meta']);
    if (ignoredKeys.has(event.key)) {
      return parts.join('+');
    }

    parts.push(normalizeDisplayKey(event.key));
    return parts.join('+');
  }

  // -- Persistence ----------------------------------------------------------

  private persistToStorage(): void {
    try {
      const data: Record<string, string> = {};
      this.overrides.forEach((keys, id) => {
        data[id] = keys;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage unavailable (SSR, quota exceeded) — silent.
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const data: unknown = JSON.parse(raw);
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return;
      }
      const record = data as Record<string, unknown>;
      this.overrides.clear();
      for (const [id, keys] of Object.entries(record)) {
        if (typeof keys === 'string' && keys.length > 0 && DEFAULT_BINDINGS.some((d) => d.id === id)) {
          this.overrides.set(id, normalizeKeysString(keys));
        }
      }
    } catch {
      this.overrides.clear();
    }
  }

  // -- Internal helpers -----------------------------------------------------

  private buildSnapshot(): ReadonlyArray<Keybinding> {
    return DEFAULT_BINDINGS.map((def) => {
      const override = this.overrides.get(def.id);
      return {
        ...def,
        keys: override ?? def.keys,
        isDefault: !override,
      };
    });
  }
}

// ---------------------------------------------------------------------------
// Pure utility functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Normalize a key name for display.
 * - Space (' ') -> 'Space'
 * - Single characters -> uppercased
 * - Named keys (Delete, Escape, ...) -> as-is
 */
export function normalizeDisplayKey(key: string): string {
  if (key === ' ') {
    return 'Space';
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
}

/**
 * Normalize a full keys string.
 * Ensures canonical modifier order (Ctrl+Shift+Alt+Meta) and proper key casing.
 */
export function normalizeKeysString(keys: string): string {
  const parts = keys.split('+').map((p) => p.trim()).filter(Boolean);

  const modifiers: string[] = [];
  let mainKey = '';

  const modOrder = ['Ctrl', 'Shift', 'Alt', 'Meta'] as const;
  const modLower = new Map<string, (typeof modOrder)[number]>([
    ['ctrl', 'Ctrl'],
    ['shift', 'Shift'],
    ['alt', 'Alt'],
    ['meta', 'Meta'],
    ['cmd', 'Meta'],
    ['command', 'Meta'],
    ['win', 'Meta'],
    ['windows', 'Meta'],
    ['control', 'Ctrl'],
  ]);

  for (const part of parts) {
    const lower = part.toLowerCase();
    const mapped = modLower.get(lower);
    if (mapped) {
      if (!modifiers.includes(mapped)) {
        modifiers.push(mapped);
      }
    } else {
      // It's the main key.
      mainKey = normalizeDisplayKey(part.length === 1 ? part : part);
    }
  }

  // Sort modifiers into canonical order.
  modifiers.sort((a, b) => modOrder.indexOf(a as (typeof modOrder)[number]) - modOrder.indexOf(b as (typeof modOrder)[number]));

  if (mainKey) {
    return [...modifiers, mainKey].join('+');
  }
  return modifiers.join('+');
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook that provides the current keybinding state and mutation methods.
 *
 * Uses `useSyncExternalStore` for tear-free reads that re-render only when
 * the snapshot reference changes.
 */
export function useKeybindingEditor(): {
  bindings: ReadonlyArray<Keybinding>;
  setBinding: (id: string, keys: string) => KeybindingConflict | null;
  resetBinding: (id: string) => void;
  resetAll: () => void;
  detectConflict: (keys: string, excludeId?: string) => KeybindingConflict | null;
  formatKeys: (keys: string) => string;
  parseKeyCombo: (event: KeyboardEvent) => string;
} {
  const editorRef = useRef(KeybindingEditor.getInstance());
  const editor = editorRef.current;

  const bindings = useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot);

  const setBinding = useCallback(
    (id: string, keys: string) => editor.setBinding(id, keys),
    [editor],
  );

  const resetBinding = useCallback(
    (id: string) => editor.resetBinding(id),
    [editor],
  );

  const resetAll = useCallback(
    () => editor.resetAll(),
    [editor],
  );

  const detectConflict = useCallback(
    (keys: string, excludeId?: string) => editor.detectConflict(keys, excludeId),
    [editor],
  );

  const formatKeys = useCallback(
    (keys: string) => editor.formatKeys(keys),
    [editor],
  );

  const parseKeyCombo = useCallback(
    (event: KeyboardEvent) => editor.parseKeyCombo(event),
    [editor],
  );

  return { bindings, setBinding, resetBinding, resetAll, detectConflict, formatKeys, parseKeyCombo };
}
