/**
 * Keyboard Shortcut Customization Engine
 *
 * Provides a centralized, customizable keyboard shortcut system.
 * Shortcuts are defined with defaults and can be overridden by users.
 * Custom overrides persist in localStorage.
 *
 * Usage:
 *   const manager = KeyboardShortcutManager.getInstance();
 *   manager.getActiveShortcuts(); // Map of action ID -> KeyCombo
 *   manager.setCustomCombo('undo', { key: 'z', meta: true }); // override
 *   manager.detectConflicts(); // find duplicate combos
 */

import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A key combination (e.g., Ctrl+Shift+Z). */
export interface KeyCombo {
  /** The key value (e.g., 'z', 's', 'Delete', 'Escape', ' '). */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Cmd on macOS. */
  meta?: boolean;
}

/** A shortcut action definition with its default key combo. */
export interface ShortcutAction {
  /** Unique identifier (e.g., 'undo', 'save', 'delete-selected'). */
  id: string;
  /** Human-readable label (e.g., "Undo"). */
  label: string;
  /** Grouping category: 'edit', 'view', 'tools', 'navigation'. */
  category: string;
  /** The default key combo for this action. */
  defaultCombo: KeyCombo;
  /** Optional description for tooltips / help text. */
  description?: string;
}

/** Describes a conflict where multiple actions share the same combo string. */
export interface ShortcutConflict {
  /** The string representation of the conflicting combo (e.g., "Ctrl+Z"). */
  comboString: string;
  /** The action IDs that share this combo. */
  actions: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-keyboard-shortcuts';

const EDITABLE_ROLES = new Set(['combobox', 'searchbox', 'textbox']);

/** Default shortcut definitions. */
export const DEFAULT_SHORTCUTS: ShortcutAction[] = [
  { id: 'undo', label: 'Undo', category: 'edit', defaultCombo: { key: 'z', ctrl: true } },
  { id: 'redo', label: 'Redo', category: 'edit', defaultCombo: { key: 'y', ctrl: true } },
  { id: 'redo-alt', label: 'Redo (Alt)', category: 'edit', defaultCombo: { key: 'z', ctrl: true, shift: true } },
  { id: 'save', label: 'Save', category: 'edit', defaultCombo: { key: 's', ctrl: true } },
  { id: 'delete', label: 'Delete Selected', category: 'edit', defaultCombo: { key: 'Delete' } },
  { id: 'delete-alt', label: 'Delete (Alt)', category: 'edit', defaultCombo: { key: 'Backspace' } },
  { id: 'select-all', label: 'Select All', category: 'edit', defaultCombo: { key: 'a', ctrl: true } },
  { id: 'deselect', label: 'Deselect / Close', category: 'edit', defaultCombo: { key: 'Escape' } },
  { id: 'copy', label: 'Copy', category: 'edit', defaultCombo: { key: 'c', ctrl: true } },
  { id: 'paste', label: 'Paste', category: 'edit', defaultCombo: { key: 'v', ctrl: true } },
  { id: 'cut', label: 'Cut', category: 'edit', defaultCombo: { key: 'x', ctrl: true } },
  { id: 'zoom-in', label: 'Zoom In', category: 'view', defaultCombo: { key: '=', ctrl: true } },
  { id: 'zoom-out', label: 'Zoom Out', category: 'view', defaultCombo: { key: '-', ctrl: true } },
  { id: 'zoom-fit', label: 'Zoom to Fit', category: 'view', defaultCombo: { key: '0', ctrl: true } },
  { id: 'tool-select', label: 'Select Tool', category: 'tools', defaultCombo: { key: '1' } },
  { id: 'tool-wire', label: 'Wire Tool', category: 'tools', defaultCombo: { key: '2' } },
  { id: 'tool-delete', label: 'Delete Tool', category: 'tools', defaultCombo: { key: '3' } },
  { id: 'pan', label: 'Pan Mode', category: 'navigation', defaultCombo: { key: ' ' } },
  { id: 'find', label: 'Find', category: 'navigation', defaultCombo: { key: 'f', ctrl: true } },
];

// ---------------------------------------------------------------------------
// KeyboardShortcutManager
// ---------------------------------------------------------------------------

/**
 * Centralized manager for keyboard shortcuts.
 * Maintains default shortcuts, user overrides, conflict detection,
 * and localStorage persistence. Singleton per application.
 */
export class KeyboardShortcutManager {
  private static instance: KeyboardShortcutManager | null = null;

  private defaults: ShortcutAction[];
  private overrides: Map<string, KeyCombo>;

  constructor() {
    this.defaults = [...DEFAULT_SHORTCUTS];
    this.overrides = new Map();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): KeyboardShortcutManager {
    if (!KeyboardShortcutManager.instance) {
      KeyboardShortcutManager.instance = new KeyboardShortcutManager();
    }
    return KeyboardShortcutManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    KeyboardShortcutManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Returns a copy of all default shortcut definitions. */
  getDefaultShortcuts(): ShortcutAction[] {
    return [...this.defaults];
  }

  /**
   * Returns the active shortcut map: action ID -> KeyCombo.
   * User overrides take precedence over defaults.
   */
  getActiveShortcuts(): Map<string, KeyCombo> {
    const result = new Map<string, KeyCombo>();
    for (const action of this.defaults) {
      const override = this.overrides.get(action.id);
      result.set(action.id, override ?? action.defaultCombo);
    }
    return result;
  }

  /**
   * Get the active combo for a single action.
   * Returns the override if set, otherwise the default.
   */
  getCombo(actionId: string): KeyCombo | undefined {
    const override = this.overrides.get(actionId);
    if (override) {
      return override;
    }
    const action = this.defaults.find((a) => a.id === actionId);
    return action?.defaultCombo;
  }

  /**
   * Detect conflicts: two or more actions mapped to the same combo string.
   * Only considers active (overridden or default) combos.
   */
  detectConflicts(): ShortcutConflict[] {
    const active = this.getActiveShortcuts();
    const comboMap = new Map<string, string[]>();

    active.forEach((combo, actionId) => {
      const str = this.comboToString(combo);
      const existing = comboMap.get(str);
      if (existing) {
        existing.push(actionId);
      } else {
        comboMap.set(str, [actionId]);
      }
    });

    const conflicts: ShortcutConflict[] = [];
    comboMap.forEach((actions, comboString) => {
      if (actions.length > 1) {
        conflicts.push({ comboString, actions });
      }
    });
    return conflicts;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /** Override a shortcut's key combo. Persists to localStorage. */
  setCustomCombo(actionId: string, combo: KeyCombo): void {
    this.overrides.set(actionId, combo);
    this.save();
  }

  /** Remove a custom override for one action, reverting to default. */
  resetToDefault(actionId: string): void {
    this.overrides.delete(actionId);
    this.save();
  }

  /** Remove all custom overrides, reverting everything to defaults. */
  resetAllToDefault(): void {
    this.overrides.clear();
    this.save();
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  /**
   * Convert a KeyCombo to a human-readable string (e.g., "Ctrl+Shift+Z").
   * Modifier order: Ctrl > Shift > Alt > Meta > key.
   */
  comboToString(combo: KeyCombo): string {
    const parts: string[] = [];
    if (combo.ctrl) {
      parts.push('Ctrl');
    }
    if (combo.shift) {
      parts.push('Shift');
    }
    if (combo.alt) {
      parts.push('Alt');
    }
    if (combo.meta) {
      parts.push('Meta');
    }
    // Normalize display key
    const displayKey = this.normalizeKeyForDisplay(combo.key);
    parts.push(displayKey);
    return parts.join('+');
  }

  /**
   * Check if a KeyboardEvent matches a KeyCombo.
   * Compares key (case-insensitive) and all modifier flags.
   */
  matchesEvent(event: KeyboardEvent, combo: KeyCombo): boolean {
    const eventKey = event.key.toLowerCase();
    const comboKey = combo.key.toLowerCase();

    // Key must match (case-insensitive for letters, exact for special keys)
    if (eventKey !== comboKey) {
      return false;
    }

    // Modifier flags must match exactly
    if (Boolean(combo.ctrl) !== (event.ctrlKey || event.metaKey && this.isPlatformMac())) {
      // On Mac, treat metaKey as ctrlKey for ctrl combos
      if (!this.isPlatformMac()) {
        return false;
      }
      // On Mac: combo.ctrl matches either event.ctrlKey or event.metaKey
      if (Boolean(combo.ctrl) !== (event.ctrlKey || event.metaKey)) {
        return false;
      }
    }
    if (Boolean(combo.shift) !== event.shiftKey) {
      return false;
    }
    if (Boolean(combo.alt) !== event.altKey) {
      return false;
    }
    // meta check: only on non-Mac or when combo explicitly uses meta
    if (!this.isPlatformMac()) {
      if (Boolean(combo.meta) !== event.metaKey) {
        return false;
      }
    }

    return true;
  }

  /** Detect whether the platform is macOS. */
  isPlatformMac(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }
    return /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent);
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist overrides to localStorage. */
  save(): void {
    try {
      const data: Record<string, KeyCombo> = {};
      this.overrides.forEach((combo, id) => {
        data[id] = combo;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable (SSR, incognito quota exceeded)
    }
  }

  /** Load overrides from localStorage. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const data = JSON.parse(raw) as Record<string, KeyCombo>;
      this.overrides.clear();
      for (const [id, combo] of Object.entries(data)) {
        if (combo && typeof combo.key === 'string') {
          this.overrides.set(id, combo);
        }
      }
    } catch {
      // Corrupt data or localStorage unavailable — start fresh
      this.overrides.clear();
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Normalize a key value for display in the combo string. */
  private normalizeKeyForDisplay(key: string): string {
    if (key === ' ') {
      return 'Space';
    }
    if (key.length === 1) {
      return key.toUpperCase();
    }
    // Already a named key like 'Delete', 'Escape', 'Backspace'
    return key;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

function isEditableElement(element: HTMLElement | null): boolean {
  let current = element;
  while (current) {
    const tagName = current.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
      return true;
    }
    if (current.isContentEditable) {
      return true;
    }
    const role = current.getAttribute('role');
    if (role && EDITABLE_ROLES.has(role)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement ? isEditableElement(target) : false;
}

export function shouldIgnoreKeyboardShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) {
    return true;
  }
  if (isEditableShortcutTarget(event.target)) {
    return true;
  }
  return isEditableShortcutTarget(document.activeElement);
}

/**
 * Hook that registers a global keydown listener and dispatches to handlers
 * based on the active keyboard shortcuts.
 *
 * Skips events when focus is in an input, textarea, or contenteditable element.
 *
 * @param handlers - Map of action ID to callback (e.g., { undo: () => ... })
 */
export function useKeyboardShortcuts(handlers: Record<string, () => void>): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const manager = KeyboardShortcutManager.getInstance();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardShortcut(event)) {
        return;
      }

      const active = manager.getActiveShortcuts();
      let handled = false;
      active.forEach((combo, actionId) => {
        if (!handled && manager.matchesEvent(event, combo) && handlersRef.current[actionId]) {
          event.preventDefault();
          handlersRef.current[actionId]();
          handled = true;
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
