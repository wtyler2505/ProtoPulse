import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KeyboardShortcutManager,
  DEFAULT_SHORTCUTS,
  useKeyboardShortcuts,
} from '../keyboard-shortcuts';
import type { KeyCombo } from '../keyboard-shortcuts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a minimal KeyboardEvent-like object for testing matchesEvent. */
function makeKeyboardEvent(overrides: {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}): KeyboardEvent {
  return {
    key: overrides.key,
    ctrlKey: overrides.ctrlKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    altKey: overrides.altKey ?? false,
    metaKey: overrides.metaKey ?? false,
  } as KeyboardEvent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KeyboardShortcutManager', () => {
  let manager: KeyboardShortcutManager;

  beforeEach(() => {
    localStorage.clear();
    KeyboardShortcutManager.resetInstance();
    manager = new KeyboardShortcutManager();
  });

  afterEach(() => {
    KeyboardShortcutManager.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Default shortcuts
  // -----------------------------------------------------------------------

  describe('getDefaultShortcuts', () => {
    it('returns all default shortcut definitions', () => {
      const defaults = manager.getDefaultShortcuts();
      expect(defaults.length).toBe(DEFAULT_SHORTCUTS.length);
      expect(defaults.length).toBeGreaterThanOrEqual(19);
    });

    it('contains the undo shortcut', () => {
      const defaults = manager.getDefaultShortcuts();
      const undo = defaults.find((s) => s.id === 'undo');
      expect(undo).toBeDefined();
      expect(undo?.label).toBe('Undo');
      expect(undo?.category).toBe('edit');
      expect(undo?.defaultCombo).toEqual({ key: 'z', ctrl: true });
    });

    it('contains shortcuts from all categories', () => {
      const defaults = manager.getDefaultShortcuts();
      const categories = new Set(defaults.map((s) => s.category));
      expect(categories).toContain('edit');
      expect(categories).toContain('view');
      expect(categories).toContain('tools');
      expect(categories).toContain('navigation');
    });

    it('returns a copy, not the internal array', () => {
      const a = manager.getDefaultShortcuts();
      const b = manager.getDefaultShortcuts();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  // -----------------------------------------------------------------------
  // comboToString
  // -----------------------------------------------------------------------

  describe('comboToString', () => {
    it('formats Ctrl+Z', () => {
      expect(manager.comboToString({ key: 'z', ctrl: true })).toBe('Ctrl+Z');
    });

    it('formats Ctrl+Shift+S', () => {
      expect(manager.comboToString({ key: 's', ctrl: true, shift: true })).toBe('Ctrl+Shift+S');
    });

    it('formats a single key (Delete)', () => {
      expect(manager.comboToString({ key: 'Delete' })).toBe('Delete');
    });

    it('formats Space key', () => {
      expect(manager.comboToString({ key: ' ' })).toBe('Space');
    });

    it('formats Alt+F4', () => {
      expect(manager.comboToString({ key: 'F4', alt: true })).toBe('Alt+F4');
    });

    it('formats Meta+key', () => {
      expect(manager.comboToString({ key: 'k', meta: true })).toBe('Meta+K');
    });

    it('formats all modifiers combined', () => {
      expect(
        manager.comboToString({ key: 'a', ctrl: true, shift: true, alt: true, meta: true }),
      ).toBe('Ctrl+Shift+Alt+Meta+A');
    });

    it('uppercases single-character keys', () => {
      expect(manager.comboToString({ key: 'a' })).toBe('A');
      expect(manager.comboToString({ key: '=' })).toBe('=');
    });
  });

  // -----------------------------------------------------------------------
  // matchesEvent
  // -----------------------------------------------------------------------

  describe('matchesEvent', () => {
    it('matches Ctrl+Z event to Ctrl+Z combo', () => {
      const combo: KeyCombo = { key: 'z', ctrl: true };
      const event = makeKeyboardEvent({ key: 'z', ctrlKey: true });
      expect(manager.matchesEvent(event, combo)).toBe(true);
    });

    it('rejects Z without Ctrl when combo requires Ctrl', () => {
      const combo: KeyCombo = { key: 'z', ctrl: true };
      const event = makeKeyboardEvent({ key: 'z' });
      expect(manager.matchesEvent(event, combo)).toBe(false);
    });

    it('rejects different key', () => {
      const combo: KeyCombo = { key: 'z', ctrl: true };
      const event = makeKeyboardEvent({ key: 'a', ctrlKey: true });
      expect(manager.matchesEvent(event, combo)).toBe(false);
    });

    it('matches shift combo correctly', () => {
      const combo: KeyCombo = { key: 'z', ctrl: true, shift: true };
      const event = makeKeyboardEvent({ key: 'z', ctrlKey: true, shiftKey: true });
      expect(manager.matchesEvent(event, combo)).toBe(true);
    });

    it('rejects when shift is extra', () => {
      const combo: KeyCombo = { key: 'z', ctrl: true };
      const event = makeKeyboardEvent({ key: 'z', ctrlKey: true, shiftKey: true });
      expect(manager.matchesEvent(event, combo)).toBe(false);
    });

    it('matches plain key (no modifiers)', () => {
      const combo: KeyCombo = { key: 'Delete' };
      const event = makeKeyboardEvent({ key: 'Delete' });
      expect(manager.matchesEvent(event, combo)).toBe(true);
    });

    it('is case-insensitive for key', () => {
      const combo: KeyCombo = { key: 'z', ctrl: true };
      const event = makeKeyboardEvent({ key: 'Z', ctrlKey: true });
      expect(manager.matchesEvent(event, combo)).toBe(true);
    });

    it('rejects when alt is extra', () => {
      const combo: KeyCombo = { key: 'z', ctrl: true };
      const event = makeKeyboardEvent({ key: 'z', ctrlKey: true, altKey: true });
      expect(manager.matchesEvent(event, combo)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Custom overrides
  // -----------------------------------------------------------------------

  describe('custom overrides', () => {
    it('overrides default combo', () => {
      manager.setCustomCombo('undo', { key: 'z', meta: true });
      const active = manager.getActiveShortcuts();
      expect(active.get('undo')).toEqual({ key: 'z', meta: true });
    });

    it('getCombo returns override when set', () => {
      manager.setCustomCombo('save', { key: 's', meta: true });
      expect(manager.getCombo('save')).toEqual({ key: 's', meta: true });
    });

    it('getCombo returns default when no override', () => {
      expect(manager.getCombo('undo')).toEqual({ key: 'z', ctrl: true });
    });

    it('getCombo returns undefined for unknown action', () => {
      expect(manager.getCombo('nonexistent')).toBeUndefined();
    });

    it('resetToDefault removes override', () => {
      manager.setCustomCombo('undo', { key: 'z', meta: true });
      manager.resetToDefault('undo');
      const active = manager.getActiveShortcuts();
      expect(active.get('undo')).toEqual({ key: 'z', ctrl: true });
    });

    it('resetAllToDefault removes all overrides', () => {
      manager.setCustomCombo('undo', { key: 'z', meta: true });
      manager.setCustomCombo('save', { key: 's', meta: true });
      manager.resetAllToDefault();
      const active = manager.getActiveShortcuts();
      expect(active.get('undo')).toEqual({ key: 'z', ctrl: true });
      expect(active.get('save')).toEqual({ key: 's', ctrl: true });
    });
  });

  // -----------------------------------------------------------------------
  // Conflict detection
  // -----------------------------------------------------------------------

  describe('detectConflicts', () => {
    it('finds no conflicts in the default set', () => {
      const conflicts = manager.detectConflicts();
      expect(conflicts.length).toBe(0);
    });

    it('detects conflict when two actions share the same combo', () => {
      // Override 'save' to use Ctrl+Z (same as 'undo')
      manager.setCustomCombo('save', { key: 'z', ctrl: true });
      const conflicts = manager.detectConflicts();
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      const ctrlZ = conflicts.find((c) => c.comboString === 'Ctrl+Z');
      expect(ctrlZ).toBeDefined();
      expect(ctrlZ?.actions).toContain('undo');
      expect(ctrlZ?.actions).toContain('save');
    });

    it('does not report resolved conflicts after override removed', () => {
      manager.setCustomCombo('save', { key: 'z', ctrl: true });
      manager.resetToDefault('save');
      const conflicts = manager.detectConflicts();
      expect(conflicts.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('persists overrides via save and load', () => {
      manager.setCustomCombo('undo', { key: 'z', meta: true });
      manager.setCustomCombo('save', { key: 's', meta: true });

      // Create a new manager instance that loads from localStorage
      const manager2 = new KeyboardShortcutManager();
      expect(manager2.getCombo('undo')).toEqual({ key: 'z', meta: true });
      expect(manager2.getCombo('save')).toEqual({ key: 's', meta: true });
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('protopulse-keyboard-shortcuts', 'not-json');
      const manager2 = new KeyboardShortcutManager();
      // Should fall back to defaults
      expect(manager2.getCombo('undo')).toEqual({ key: 'z', ctrl: true });
    });

    it('handles empty localStorage', () => {
      localStorage.removeItem('protopulse-keyboard-shortcuts');
      const manager2 = new KeyboardShortcutManager();
      expect(manager2.getCombo('undo')).toEqual({ key: 'z', ctrl: true });
    });

    it('ignores invalid entries in stored data', () => {
      localStorage.setItem(
        'protopulse-keyboard-shortcuts',
        JSON.stringify({ undo: { key: 'a', ctrl: true }, bad: 'not-a-combo', nokey: {} }),
      );
      const manager2 = new KeyboardShortcutManager();
      expect(manager2.getCombo('undo')).toEqual({ key: 'a', ctrl: true });
    });
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = KeyboardShortcutManager.getInstance();
      const b = KeyboardShortcutManager.getInstance();
      expect(a).toBe(b);
    });

    it('resetInstance creates a new instance', () => {
      const a = KeyboardShortcutManager.getInstance();
      KeyboardShortcutManager.resetInstance();
      const b = KeyboardShortcutManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Platform detection
  // -----------------------------------------------------------------------

  describe('isPlatformMac', () => {
    it('returns false when navigator is unavailable', () => {
      const origNavigator = globalThis.navigator;
      // @ts-expect-error -- testing unavailable navigator
      delete globalThis.navigator;
      const m = new KeyboardShortcutManager();
      expect(m.isPlatformMac()).toBe(false);
      globalThis.navigator = origNavigator;
    });

    it('detects Mac from navigator.platform', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
      const m = new KeyboardShortcutManager();
      expect(m.isPlatformMac()).toBe(true);
      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      } else {
        Object.defineProperty(navigator, 'platform', { value: '', configurable: true });
      }
    });
  });

  // -----------------------------------------------------------------------
  // getActiveShortcuts
  // -----------------------------------------------------------------------

  describe('getActiveShortcuts', () => {
    it('returns all shortcuts with defaults', () => {
      const active = manager.getActiveShortcuts();
      expect(active.size).toBe(DEFAULT_SHORTCUTS.length);
    });

    it('applies overrides over defaults', () => {
      const customCombo: KeyCombo = { key: 'q', alt: true };
      manager.setCustomCombo('undo', customCombo);
      const active = manager.getActiveShortcuts();
      expect(active.get('undo')).toEqual(customCombo);
      // Other shortcuts should still be defaults
      expect(active.get('save')).toEqual({ key: 's', ctrl: true });
    });
  });
});

// ---------------------------------------------------------------------------
// useKeyboardShortcuts hook tests
// ---------------------------------------------------------------------------

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    localStorage.clear();
    KeyboardShortcutManager.resetInstance();
  });

  afterEach(() => {
    KeyboardShortcutManager.resetInstance();
  });

  it('is a function', () => {
    expect(typeof useKeyboardShortcuts).toBe('function');
  });
});
