import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  KeybindingEditor,
  normalizeDisplayKey,
  normalizeKeysString,
  useKeybindingEditor,
} from '../keybinding-editor';
import type { Keybinding, KeybindingConflict, KeybindingCategory } from '../keybinding-editor';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

describe('KeybindingEditor', () => {
  let editor: KeybindingEditor;

  beforeEach(() => {
    localStorage.clear();
    KeybindingEditor.resetInstance();
    editor = new KeybindingEditor();
  });

  afterEach(() => {
    KeybindingEditor.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = KeybindingEditor.getInstance();
      const b = KeybindingEditor.getInstance();
      expect(a).toBe(b);
    });

    it('creates a fresh instance after resetInstance', () => {
      const a = KeybindingEditor.getInstance();
      KeybindingEditor.resetInstance();
      const b = KeybindingEditor.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // getBindings
  // -----------------------------------------------------------------------

  describe('getBindings', () => {
    it('returns all default bindings', () => {
      const bindings = editor.getBindings();
      expect(bindings.length).toBeGreaterThanOrEqual(19);
    });

    it('every binding has required fields', () => {
      const bindings = editor.getBindings();
      for (const b of bindings) {
        expect(b.id).toBeTruthy();
        expect(b.action).toBeTruthy();
        expect(b.keys).toBeTruthy();
        expect(b.category).toBeTruthy();
        expect(b.description).toBeTruthy();
        expect(typeof b.isDefault).toBe('boolean');
      }
    });

    it('all default bindings have isDefault true', () => {
      const bindings = editor.getBindings();
      for (const b of bindings) {
        expect(b.isDefault).toBe(true);
      }
    });

    it('contains expected categories', () => {
      const bindings = editor.getBindings();
      const categories = new Set(bindings.map((b) => b.category));
      expect(categories).toContain('edit');
      expect(categories).toContain('view');
      expect(categories).toContain('tools');
      expect(categories).toContain('navigation');
    });

    it('contains the undo binding with Ctrl+Z', () => {
      const undo = editor.getBindings().find((b) => b.id === 'undo');
      expect(undo).toBeDefined();
      expect(undo?.keys).toBe('Ctrl+Z');
      expect(undo?.action).toBe('Undo');
      expect(undo?.category).toBe('edit');
    });

    it('returns the same reference when nothing changes', () => {
      const a = editor.getBindings();
      const b = editor.getBindings();
      expect(a).toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // getBinding (single)
  // -----------------------------------------------------------------------

  describe('getBinding', () => {
    it('returns a binding by id', () => {
      const b = editor.getBinding('save');
      expect(b).toBeDefined();
      expect(b?.keys).toBe('Ctrl+S');
    });

    it('returns undefined for unknown id', () => {
      expect(editor.getBinding('nonexistent')).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // getBindingsByCategory
  // -----------------------------------------------------------------------

  describe('getBindingsByCategory', () => {
    it('returns only edit bindings', () => {
      const edits = editor.getBindingsByCategory('edit');
      expect(edits.length).toBeGreaterThan(0);
      for (const b of edits) {
        expect(b.category).toBe('edit');
      }
    });

    it('returns empty array for unused category', () => {
      const sims = editor.getBindingsByCategory('simulation');
      expect(sims).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // setBinding
  // -----------------------------------------------------------------------

  describe('setBinding', () => {
    it('overrides a binding and marks isDefault false', () => {
      editor.setBinding('undo', 'Meta+Z');
      const undo = editor.getBinding('undo');
      expect(undo?.keys).toBe('Meta+Z');
      expect(undo?.isDefault).toBe(false);
    });

    it('normalizes the keys string', () => {
      editor.setBinding('undo', 'ctrl+shift+z');
      const undo = editor.getBinding('undo');
      expect(undo?.keys).toBe('Ctrl+Shift+Z');
    });

    it('returns null when there is no conflict', () => {
      const conflict = editor.setBinding('undo', 'Meta+Z');
      expect(conflict).toBeNull();
    });

    it('returns a conflict when keys clash with another binding', () => {
      const conflict = editor.setBinding('save', 'Ctrl+Z');
      expect(conflict).not.toBeNull();
      expect(conflict?.existingId).toBe('undo');
      expect(conflict?.newKeys).toBe('Ctrl+Z');
    });

    it('does not report self-conflict when reassigning the same keys', () => {
      const conflict = editor.setBinding('undo', 'Ctrl+Z');
      expect(conflict).toBeNull();
    });

    it('reverts to default storage when setting back to default keys', () => {
      editor.setBinding('undo', 'Meta+Z');
      expect(editor.getBinding('undo')?.isDefault).toBe(false);
      editor.setBinding('undo', 'Ctrl+Z');
      expect(editor.getBinding('undo')?.isDefault).toBe(true);
    });

    it('ignores unknown binding ids', () => {
      const result = editor.setBinding('totally-fake', 'Ctrl+X');
      expect(result).toBeNull();
      expect(editor.getBinding('totally-fake')).toBeUndefined();
    });

    it('persists to localStorage', () => {
      editor.setBinding('undo', 'Alt+Z');
      const raw = localStorage.getItem('protopulse:custom-keybindings');
      expect(raw).toBeTruthy();
      const data = JSON.parse(raw!) as Record<string, string>;
      expect(data['undo']).toBe('Alt+Z');
    });
  });

  // -----------------------------------------------------------------------
  // resetBinding
  // -----------------------------------------------------------------------

  describe('resetBinding', () => {
    it('restores a binding to its default', () => {
      editor.setBinding('undo', 'Meta+Z');
      editor.resetBinding('undo');
      const undo = editor.getBinding('undo');
      expect(undo?.keys).toBe('Ctrl+Z');
      expect(undo?.isDefault).toBe(true);
    });

    it('is a no-op for already-default bindings', () => {
      const snapshotBefore = editor.getBindings();
      editor.resetBinding('undo');
      const snapshotAfter = editor.getBindings();
      // Snapshot reference should be unchanged since nothing mutated.
      expect(snapshotBefore).toBe(snapshotAfter);
    });

    it('removes the override from localStorage', () => {
      editor.setBinding('undo', 'Alt+Z');
      editor.resetBinding('undo');
      const raw = localStorage.getItem('protopulse:custom-keybindings');
      const data = JSON.parse(raw!) as Record<string, string>;
      expect(data['undo']).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // resetAll
  // -----------------------------------------------------------------------

  describe('resetAll', () => {
    it('restores every binding to defaults', () => {
      editor.setBinding('undo', 'Meta+Z');
      editor.setBinding('save', 'Meta+S');
      editor.setBinding('copy', 'Meta+C');
      editor.resetAll();
      for (const b of editor.getBindings()) {
        expect(b.isDefault).toBe(true);
      }
    });

    it('is a no-op when no overrides exist', () => {
      const snapshotBefore = editor.getBindings();
      editor.resetAll();
      const snapshotAfter = editor.getBindings();
      expect(snapshotBefore).toBe(snapshotAfter);
    });

    it('clears localStorage overrides', () => {
      editor.setBinding('undo', 'Alt+Z');
      editor.resetAll();
      const raw = localStorage.getItem('protopulse:custom-keybindings');
      const data = JSON.parse(raw!) as Record<string, string>;
      expect(Object.keys(data).length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // detectConflict
  // -----------------------------------------------------------------------

  describe('detectConflict', () => {
    it('returns null when no conflict exists', () => {
      const result = editor.detectConflict('F12');
      expect(result).toBeNull();
    });

    it('detects conflict with existing default binding', () => {
      const result = editor.detectConflict('Ctrl+Z');
      expect(result).not.toBeNull();
      expect(result?.existingId).toBe('undo');
      expect(result?.newKeys).toBe('Ctrl+Z');
    });

    it('excludes a specific id from conflict check', () => {
      const result = editor.detectConflict('Ctrl+Z', 'undo');
      expect(result).toBeNull();
    });

    it('detects conflict with overridden binding', () => {
      editor.setBinding('save', 'F5');
      const result = editor.detectConflict('F5');
      expect(result?.existingId).toBe('save');
    });

    it('normalizes keys before checking', () => {
      const result = editor.detectConflict('ctrl+z');
      expect(result?.existingId).toBe('undo');
    });
  });

  // -----------------------------------------------------------------------
  // formatKeys
  // -----------------------------------------------------------------------

  describe('formatKeys', () => {
    it('normalizes lowercase to proper case', () => {
      expect(editor.formatKeys('ctrl+z')).toBe('Ctrl+Z');
    });

    it('normalizes modifier order', () => {
      expect(editor.formatKeys('Shift+Ctrl+A')).toBe('Ctrl+Shift+A');
    });

    it('handles Space key', () => {
      expect(editor.formatKeys(' ')).toBe('Space');
    });

    it('passes through already-normalized strings', () => {
      expect(editor.formatKeys('Ctrl+Shift+Z')).toBe('Ctrl+Shift+Z');
    });

    it('normalizes cmd/command/win aliases to Meta', () => {
      expect(editor.formatKeys('Cmd+S')).toBe('Meta+S');
      expect(editor.formatKeys('Command+S')).toBe('Meta+S');
      expect(editor.formatKeys('Win+S')).toBe('Meta+S');
    });

    it('deduplicates repeated modifiers', () => {
      expect(editor.formatKeys('Ctrl+Ctrl+Z')).toBe('Ctrl+Z');
    });
  });

  // -----------------------------------------------------------------------
  // parseKeyCombo
  // -----------------------------------------------------------------------

  describe('parseKeyCombo', () => {
    it('parses Ctrl+Z', () => {
      const event = makeKeyboardEvent({ key: 'z', ctrlKey: true });
      expect(editor.parseKeyCombo(event)).toBe('Ctrl+Z');
    });

    it('parses Ctrl+Shift+S', () => {
      const event = makeKeyboardEvent({ key: 's', ctrlKey: true, shiftKey: true });
      expect(editor.parseKeyCombo(event)).toBe('Ctrl+Shift+S');
    });

    it('parses plain Delete key', () => {
      const event = makeKeyboardEvent({ key: 'Delete' });
      expect(editor.parseKeyCombo(event)).toBe('Delete');
    });

    it('parses Space key', () => {
      const event = makeKeyboardEvent({ key: ' ' });
      expect(editor.parseKeyCombo(event)).toBe('Space');
    });

    it('parses Alt+F4', () => {
      const event = makeKeyboardEvent({ key: 'F4', altKey: true });
      expect(editor.parseKeyCombo(event)).toBe('Alt+F4');
    });

    it('parses Meta+key', () => {
      const event = makeKeyboardEvent({ key: 'k', metaKey: true });
      expect(editor.parseKeyCombo(event)).toBe('Meta+K');
    });

    it('parses all modifiers combined', () => {
      const event = makeKeyboardEvent({
        key: 'a',
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: true,
      });
      expect(editor.parseKeyCombo(event)).toBe('Ctrl+Shift+Alt+Meta+A');
    });

    it('returns just modifiers for standalone modifier press', () => {
      const event = makeKeyboardEvent({ key: 'Control', ctrlKey: true });
      expect(editor.parseKeyCombo(event)).toBe('Ctrl');
    });

    it('returns just modifiers for Shift press', () => {
      const event = makeKeyboardEvent({ key: 'Shift', shiftKey: true });
      expect(editor.parseKeyCombo(event)).toBe('Shift');
    });
  });

  // -----------------------------------------------------------------------
  // subscribe pattern
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('calls listener on setBinding', () => {
      const listener = vi.fn();
      editor.subscribe(listener);
      editor.setBinding('undo', 'Meta+Z');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('calls listener on resetBinding', () => {
      editor.setBinding('undo', 'Meta+Z');
      const listener = vi.fn();
      editor.subscribe(listener);
      editor.resetBinding('undo');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('calls listener on resetAll', () => {
      editor.setBinding('undo', 'Meta+Z');
      const listener = vi.fn();
      editor.subscribe(listener);
      editor.resetAll();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not call listener after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = editor.subscribe(listener);
      unsubscribe();
      editor.setBinding('undo', 'Meta+Z');
      expect(listener).not.toHaveBeenCalled();
    });

    it('getSnapshot returns a new reference after mutation', () => {
      const snap1 = editor.getSnapshot();
      editor.setBinding('undo', 'Meta+Z');
      const snap2 = editor.getSnapshot();
      expect(snap1).not.toBe(snap2);
    });

    it('getSnapshot returns same reference without mutation', () => {
      const snap1 = editor.getSnapshot();
      const snap2 = editor.getSnapshot();
      expect(snap1).toBe(snap2);
    });
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('persists and reloads overrides', () => {
      editor.setBinding('undo', 'Alt+Z');
      editor.setBinding('save', 'Alt+S');

      const editor2 = new KeybindingEditor();
      expect(editor2.getBinding('undo')?.keys).toBe('Alt+Z');
      expect(editor2.getBinding('save')?.keys).toBe('Alt+S');
      expect(editor2.getBinding('undo')?.isDefault).toBe(false);
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('protopulse:custom-keybindings', 'not-json');
      const editor2 = new KeybindingEditor();
      expect(editor2.getBinding('undo')?.keys).toBe('Ctrl+Z');
      expect(editor2.getBinding('undo')?.isDefault).toBe(true);
    });

    it('handles empty localStorage', () => {
      localStorage.removeItem('protopulse:custom-keybindings');
      const editor2 = new KeybindingEditor();
      expect(editor2.getBinding('undo')?.keys).toBe('Ctrl+Z');
    });

    it('ignores stored overrides for unknown ids', () => {
      localStorage.setItem(
        'protopulse:custom-keybindings',
        JSON.stringify({ unknown_action: 'Ctrl+Q' }),
      );
      const editor2 = new KeybindingEditor();
      expect(editor2.getBinding('unknown_action')).toBeUndefined();
    });

    it('ignores non-string values in stored data', () => {
      localStorage.setItem(
        'protopulse:custom-keybindings',
        JSON.stringify({ undo: 123, save: null, copy: '' }),
      );
      const editor2 = new KeybindingEditor();
      expect(editor2.getBinding('undo')?.isDefault).toBe(true);
      expect(editor2.getBinding('save')?.isDefault).toBe(true);
      expect(editor2.getBinding('copy')?.isDefault).toBe(true);
    });

    it('handles array stored data gracefully', () => {
      localStorage.setItem('protopulse:custom-keybindings', JSON.stringify([1, 2, 3]));
      const editor2 = new KeybindingEditor();
      expect(editor2.getBindings().length).toBeGreaterThanOrEqual(19);
      expect(editor2.getBinding('undo')?.isDefault).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// normalizeDisplayKey
// ---------------------------------------------------------------------------

describe('normalizeDisplayKey', () => {
  it('converts space to "Space"', () => {
    expect(normalizeDisplayKey(' ')).toBe('Space');
  });

  it('uppercases single characters', () => {
    expect(normalizeDisplayKey('a')).toBe('A');
    expect(normalizeDisplayKey('z')).toBe('Z');
  });

  it('leaves named keys as-is', () => {
    expect(normalizeDisplayKey('Delete')).toBe('Delete');
    expect(normalizeDisplayKey('Escape')).toBe('Escape');
    expect(normalizeDisplayKey('Backspace')).toBe('Backspace');
    expect(normalizeDisplayKey('F1')).toBe('F1');
  });

  it('leaves symbols as-is', () => {
    expect(normalizeDisplayKey('=')).toBe('=');
    expect(normalizeDisplayKey('-')).toBe('-');
  });
});

// ---------------------------------------------------------------------------
// normalizeKeysString
// ---------------------------------------------------------------------------

describe('normalizeKeysString', () => {
  it('normalizes simple combo', () => {
    expect(normalizeKeysString('Ctrl+Z')).toBe('Ctrl+Z');
  });

  it('enforces canonical modifier order', () => {
    expect(normalizeKeysString('Alt+Shift+Ctrl+A')).toBe('Ctrl+Shift+Alt+A');
    expect(normalizeKeysString('Meta+Ctrl+B')).toBe('Ctrl+Meta+B');
  });

  it('normalizes case', () => {
    expect(normalizeKeysString('ctrl+shift+z')).toBe('Ctrl+Shift+Z');
  });

  it('maps Cmd to Meta', () => {
    expect(normalizeKeysString('Cmd+S')).toBe('Meta+S');
  });

  it('maps Command to Meta', () => {
    expect(normalizeKeysString('Command+C')).toBe('Meta+C');
  });

  it('maps Win to Meta', () => {
    expect(normalizeKeysString('Win+E')).toBe('Meta+E');
  });

  it('maps Windows to Meta', () => {
    expect(normalizeKeysString('Windows+L')).toBe('Meta+L');
  });

  it('maps Control to Ctrl', () => {
    expect(normalizeKeysString('Control+Z')).toBe('Ctrl+Z');
  });

  it('deduplicates modifiers', () => {
    expect(normalizeKeysString('Ctrl+Ctrl+Z')).toBe('Ctrl+Z');
  });

  it('handles single key with no modifiers', () => {
    expect(normalizeKeysString('Delete')).toBe('Delete');
    expect(normalizeKeysString('Escape')).toBe('Escape');
  });

  it('handles space character', () => {
    expect(normalizeKeysString(' ')).toBe('Space');
  });

  it('handles modifiers-only string', () => {
    expect(normalizeKeysString('Ctrl+Shift')).toBe('Ctrl+Shift');
  });

  it('trims whitespace around parts', () => {
    expect(normalizeKeysString('Ctrl + Z')).toBe('Ctrl+Z');
  });
});

// ---------------------------------------------------------------------------
// useKeybindingEditor hook
// ---------------------------------------------------------------------------

describe('useKeybindingEditor', () => {
  beforeEach(() => {
    localStorage.clear();
    KeybindingEditor.resetInstance();
  });

  afterEach(() => {
    KeybindingEditor.resetInstance();
  });

  it('returns bindings array', () => {
    const { result } = renderHook(() => useKeybindingEditor());
    expect(result.current.bindings.length).toBeGreaterThanOrEqual(19);
  });

  it('exposes all expected methods', () => {
    const { result } = renderHook(() => useKeybindingEditor());
    expect(typeof result.current.setBinding).toBe('function');
    expect(typeof result.current.resetBinding).toBe('function');
    expect(typeof result.current.resetAll).toBe('function');
    expect(typeof result.current.detectConflict).toBe('function');
    expect(typeof result.current.formatKeys).toBe('function');
    expect(typeof result.current.parseKeyCombo).toBe('function');
  });

  it('updates bindings reactively on setBinding', () => {
    const { result } = renderHook(() => useKeybindingEditor());
    act(() => {
      result.current.setBinding('undo', 'Meta+Z');
    });
    const undo = result.current.bindings.find((b) => b.id === 'undo');
    expect(undo?.keys).toBe('Meta+Z');
    expect(undo?.isDefault).toBe(false);
  });

  it('updates bindings reactively on resetBinding', () => {
    const { result } = renderHook(() => useKeybindingEditor());
    act(() => {
      result.current.setBinding('undo', 'Meta+Z');
    });
    act(() => {
      result.current.resetBinding('undo');
    });
    const undo = result.current.bindings.find((b) => b.id === 'undo');
    expect(undo?.keys).toBe('Ctrl+Z');
    expect(undo?.isDefault).toBe(true);
  });

  it('updates bindings reactively on resetAll', () => {
    const { result } = renderHook(() => useKeybindingEditor());
    act(() => {
      result.current.setBinding('undo', 'Meta+Z');
      result.current.setBinding('save', 'Meta+S');
    });
    act(() => {
      result.current.resetAll();
    });
    for (const b of result.current.bindings) {
      expect(b.isDefault).toBe(true);
    }
  });

  it('detectConflict works through the hook', () => {
    const { result } = renderHook(() => useKeybindingEditor());
    const conflict = result.current.detectConflict('Ctrl+Z');
    expect(conflict?.existingId).toBe('undo');
  });

  it('formatKeys works through the hook', () => {
    const { result } = renderHook(() => useKeybindingEditor());
    expect(result.current.formatKeys('ctrl+shift+a')).toBe('Ctrl+Shift+A');
  });

  it('parseKeyCombo works through the hook', () => {
    const { result } = renderHook(() => useKeybindingEditor());
    const event = makeKeyboardEvent({ key: 'z', ctrlKey: true });
    expect(result.current.parseKeyCombo(event)).toBe('Ctrl+Z');
  });
});
