import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ScriptableCommandManager,
  parseShortcut,
  normalizeShortcut,
  matchesShortcut,
  type Command,
  type CommandCategory,
  type CommandMeta,
} from '../scriptable-commands';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommand(
  id: string,
  label: string,
  opts?: Partial<Command>,
): Command {
  return {
    id,
    label,
    category: 'custom' as CommandCategory,
    isCustom: true,
    enabled: true,
    tags: [],
    execute: vi.fn(),
    ...opts,
  };
}

function makeKeyboardEvent(key: string, mods?: {
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}): KeyboardEvent {
  return {
    key,
    ctrlKey: mods?.ctrlKey ?? false,
    shiftKey: mods?.shiftKey ?? false,
    altKey: mods?.altKey ?? false,
    metaKey: mods?.metaKey ?? false,
  } as unknown as KeyboardEvent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScriptableCommandManager', () => {
  let manager: ScriptableCommandManager;

  beforeEach(() => {
    ScriptableCommandManager.resetInstance();
    manager = ScriptableCommandManager.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = ScriptableCommandManager.getInstance();
      const b = ScriptableCommandManager.getInstance();
      expect(a).toBe(b);
    });

    it('resets to a fresh instance', () => {
      const first = ScriptableCommandManager.getInstance();
      ScriptableCommandManager.resetInstance();
      const second = ScriptableCommandManager.getInstance();
      expect(first).not.toBe(second);
    });
  });

  // -----------------------------------------------------------------------
  // Built-in commands
  // -----------------------------------------------------------------------

  describe('built-in commands', () => {
    it('registers 12 built-in commands on construction', () => {
      const builtIns = manager.getBuiltInCommands();
      expect(builtIns.length).toBe(12);
    });

    it('includes navigation commands', () => {
      expect(manager.has('navigate:architecture')).toBe(true);
      expect(manager.has('navigate:schematic')).toBe(true);
      expect(manager.has('navigate:bom')).toBe(true);
    });

    it('includes edit commands', () => {
      expect(manager.has('edit:undo')).toBe(true);
      expect(manager.has('edit:redo')).toBe(true);
    });

    it('includes export commands', () => {
      expect(manager.has('export:kicad')).toBe(true);
      expect(manager.has('export:gerber')).toBe(true);
    });

    it('includes project and tool commands', () => {
      expect(manager.has('project:save')).toBe(true);
      expect(manager.has('tools:drc')).toBe(true);
    });

    it('built-in commands cannot be unregistered', () => {
      expect(manager.unregister('navigate:architecture')).toBe(false);
      expect(manager.has('navigate:architecture')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  describe('registration', () => {
    it('registers a custom command', () => {
      const cmd = makeCommand('custom:test', 'Test Command');
      manager.register(cmd);
      expect(manager.has('custom:test')).toBe(true);
      expect(manager.getCommand('custom:test')).toBeDefined();
    });

    it('registerCustom creates and registers with defaults', () => {
      const executeFn = vi.fn();
      const cmd = manager.registerCustom('my-cmd', 'My Command', executeFn);
      expect(cmd.isCustom).toBe(true);
      expect(cmd.enabled).toBe(true);
      expect(cmd.category).toBe('custom');
      expect(manager.has('my-cmd')).toBe(true);
    });

    it('registerCustom accepts options', () => {
      const cmd = manager.registerCustom('my-cmd', 'My Command', vi.fn(), {
        category: 'tools',
        description: 'A test command',
        shortcut: 'Ctrl+T',
        tags: ['test'],
      });
      expect(cmd.category).toBe('tools');
      expect(cmd.description).toBe('A test command');
      expect(cmd.shortcut).toBe('Ctrl+T');
      expect(cmd.tags).toEqual(['test']);
    });

    it('overwrites existing command with same ID', () => {
      manager.register(makeCommand('x', 'First'));
      manager.register(makeCommand('x', 'Second'));
      expect(manager.getCommand('x')!.label).toBe('Second');
    });

    it('unregister removes custom commands', () => {
      manager.register(makeCommand('custom:rm', 'Remove Me'));
      expect(manager.unregister('custom:rm')).toBe(true);
      expect(manager.has('custom:rm')).toBe(false);
    });

    it('unregister returns false for non-existent commands', () => {
      expect(manager.unregister('does-not-exist')).toBe(false);
    });

    it('getCount includes both built-in and custom', () => {
      const baseline = manager.getCount();
      manager.register(makeCommand('extra', 'Extra'));
      expect(manager.getCount()).toBe(baseline + 1);
    });
  });

  // -----------------------------------------------------------------------
  // Execution
  // -----------------------------------------------------------------------

  describe('execution', () => {
    it('executes a command by ID', () => {
      const executeFn = vi.fn();
      manager.register(makeCommand('run-me', 'Run', { execute: executeFn }));
      const result = manager.execute('run-me');
      expect(result).toBe(true);
      expect(executeFn).toHaveBeenCalledOnce();
    });

    it('returns false for non-existent command', () => {
      expect(manager.execute('no-such-cmd')).toBe(false);
    });

    it('returns false for disabled command', () => {
      const executeFn = vi.fn();
      manager.register(makeCommand('disabled', 'Disabled', { execute: executeFn, enabled: false }));
      expect(manager.execute('disabled')).toBe(false);
      expect(executeFn).not.toHaveBeenCalled();
    });

    it('setEnabled toggles command availability', () => {
      manager.register(makeCommand('toggle', 'Toggle'));
      manager.setEnabled('toggle', false);
      expect(manager.getCommand('toggle')!.enabled).toBe(false);
      manager.setEnabled('toggle', true);
      expect(manager.getCommand('toggle')!.enabled).toBe(true);
    });

    it('bindExecute replaces the execute function', () => {
      const newFn = vi.fn();
      manager.bindExecute('project:save', newFn);
      manager.execute('project:save');
      expect(newFn).toHaveBeenCalledOnce();
    });

    it('bindExecute returns false for non-existent command', () => {
      expect(manager.bindExecute('nope', vi.fn())).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  describe('queries', () => {
    it('getCommand returns undefined for non-existent ID', () => {
      expect(manager.getCommand('nope')).toBeUndefined();
    });

    it('getAllCommands returns all registered commands', () => {
      const all = manager.getAllCommands();
      expect(all.length).toBeGreaterThanOrEqual(12); // At least built-ins
    });

    it('getByCategory filters correctly', () => {
      const navCmds = manager.getByCategory('navigation');
      expect(navCmds.every((c) => c.category === 'navigation')).toBe(true);
      expect(navCmds.length).toBeGreaterThan(0);
    });

    it('getCustomCommands returns only custom', () => {
      manager.register(makeCommand('custom:a', 'Custom A'));
      const customs = manager.getCustomCommands();
      expect(customs.every((c) => c.isCustom)).toBe(true);
      expect(customs.some((c) => c.id === 'custom:a')).toBe(true);
    });

    it('getBuiltInCommands returns only built-ins', () => {
      manager.register(makeCommand('custom:a', 'Custom A'));
      const builtIns = manager.getBuiltInCommands();
      expect(builtIns.every((c) => !c.isCustom)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  describe('search', () => {
    it('returns all enabled commands for empty query', () => {
      const results = manager.search('');
      expect(results.length).toBeGreaterThanOrEqual(12);
    });

    it('finds commands by label', () => {
      const results = manager.search('Undo');
      expect(results.some((r) => r.command.id === 'edit:undo')).toBe(true);
    });

    it('finds commands by partial label', () => {
      const results = manager.search('Arch');
      expect(results.some((r) => r.command.id === 'navigate:architecture')).toBe(true);
    });

    it('finds commands by ID', () => {
      const results = manager.search('navigate:bom');
      expect(results.some((r) => r.command.id === 'navigate:bom')).toBe(true);
    });

    it('finds commands by tag', () => {
      const results = manager.search('pcb');
      expect(results.some((r) => r.command.id === 'export:gerber')).toBe(true);
    });

    it('finds commands by description', () => {
      const results = manager.search('manufacturing');
      expect(results.some((r) => r.command.id === 'export:gerber')).toBe(true);
    });

    it('finds commands by category', () => {
      const results = manager.search('export');
      expect(results.some((r) => r.command.category === 'export')).toBe(true);
    });

    it('ranks exact label match highest', () => {
      manager.register(makeCommand('test:exact', 'Undo Something'));
      const results = manager.search('Undo');
      // edit:undo should rank higher (exact match) than test:exact (contains)
      const undoIdx = results.findIndex((r) => r.command.id === 'edit:undo');
      const testIdx = results.findIndex((r) => r.command.id === 'test:exact');
      expect(undoIdx).toBeLessThan(testIdx);
    });

    it('excludes disabled commands', () => {
      manager.setEnabled('edit:undo', false);
      const results = manager.search('Undo');
      expect(results.some((r) => r.command.id === 'edit:undo')).toBe(false);
    });

    it('returns empty array when no matches', () => {
      const results = manager.search('xyznonexistent');
      expect(results).toHaveLength(0);
    });

    it('findByShortcut returns matching command', () => {
      const cmd = manager.findByShortcut('Ctrl+S');
      expect(cmd).toBeDefined();
      expect(cmd!.id).toBe('project:save');
    });

    it('findByShortcut normalizes before comparing', () => {
      const cmd = manager.findByShortcut('ctrl+s');
      expect(cmd).toBeDefined();
      expect(cmd!.id).toBe('project:save');
    });

    it('findByShortcut returns undefined for no match', () => {
      expect(manager.findByShortcut('Ctrl+Alt+F12')).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Execution history
  // -----------------------------------------------------------------------

  describe('execution history', () => {
    it('records executions', () => {
      const executeFn = vi.fn();
      manager.register(makeCommand('hist:a', 'A', { execute: executeFn }));
      manager.execute('hist:a');
      manager.execute('hist:a');

      const recent = manager.getRecentCommands();
      expect(recent.length).toBe(2);
      expect(recent[0].commandId).toBe('hist:a');
    });

    it('getRecentCommands returns most recent first', () => {
      manager.register(makeCommand('hist:a', 'A', { execute: vi.fn() }));
      manager.register(makeCommand('hist:b', 'B', { execute: vi.fn() }));
      manager.execute('hist:a');
      manager.execute('hist:b');

      const recent = manager.getRecentCommands(2);
      expect(recent[0].commandId).toBe('hist:b');
      expect(recent[1].commandId).toBe('hist:a');
    });

    it('getRecentCommands respects limit', () => {
      manager.register(makeCommand('hist:a', 'A', { execute: vi.fn() }));
      for (let i = 0; i < 5; i++) {
        manager.execute('hist:a');
      }
      const recent = manager.getRecentCommands(3);
      expect(recent.length).toBe(3);
    });

    it('getFrequentCommands returns sorted by count', () => {
      manager.register(makeCommand('freq:a', 'A', { execute: vi.fn() }));
      manager.register(makeCommand('freq:b', 'B', { execute: vi.fn() }));
      manager.execute('freq:a');
      manager.execute('freq:b');
      manager.execute('freq:b');
      manager.execute('freq:b');

      const freq = manager.getFrequentCommands();
      expect(freq[0].commandId).toBe('freq:b');
      expect(freq[0].count).toBe(3);
      expect(freq[1].commandId).toBe('freq:a');
      expect(freq[1].count).toBe(1);
    });

    it('clearHistory empties the history', () => {
      manager.register(makeCommand('hist:a', 'A', { execute: vi.fn() }));
      manager.execute('hist:a');
      manager.clearHistory();
      expect(manager.getRecentCommands()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  describe('import / export', () => {
    it('exportCustomCommands returns only custom command metadata', () => {
      manager.register(makeCommand('custom:x', 'Custom X', {
        description: 'Test',
        shortcut: 'Ctrl+X',
        tags: ['test'],
      }));

      const exported = manager.exportCustomCommands();
      expect(exported.length).toBeGreaterThanOrEqual(1);
      const found = exported.find((m) => m.id === 'custom:x');
      expect(found).toBeDefined();
      expect(found!.label).toBe('Custom X');
      expect(found!.isCustom).toBe(true);
      // Should not have execute function
      expect((found! as unknown as Record<string, unknown>).execute).toBeUndefined();
    });

    it('exportCustomCommands excludes built-in commands', () => {
      const exported = manager.exportCustomCommands();
      expect(exported.every((m) => m.isCustom)).toBe(true);
    });

    it('importCommands adds new commands', () => {
      const metas: CommandMeta[] = [
        { id: 'imp:a', label: 'Imported A', category: 'custom', isCustom: true, tags: [] },
        { id: 'imp:b', label: 'Imported B', category: 'tools', isCustom: true, tags: ['x'] },
      ];

      const count = manager.importCommands(metas);
      expect(count).toBe(2);
      expect(manager.has('imp:a')).toBe(true);
      expect(manager.has('imp:b')).toBe(true);
    });

    it('importCommands skips entries without id or label', () => {
      const metas = [
        { id: '', label: 'No ID', category: 'custom', isCustom: true, tags: [] },
        { id: 'ok', label: '', category: 'custom', isCustom: true, tags: [] },
        { id: 'valid', label: 'Valid', category: 'custom', isCustom: true, tags: [] },
      ] as CommandMeta[];

      const count = manager.importCommands(metas);
      expect(count).toBe(1);
      expect(manager.has('valid')).toBe(true);
    });

    it('round-trips custom commands through export/import', () => {
      manager.registerCustom('rt:test', 'Round Trip', vi.fn(), {
        description: 'Desc',
        shortcut: 'Alt+R',
        tags: ['round', 'trip'],
      });

      const exported = manager.exportCustomCommands();

      ScriptableCommandManager.resetInstance();
      const fresh = ScriptableCommandManager.getInstance();
      const count = fresh.importCommands(exported);
      expect(count).toBeGreaterThanOrEqual(1);

      const cmd = fresh.getCommand('rt:test');
      expect(cmd).toBeDefined();
      expect(cmd!.label).toBe('Round Trip');
      expect(cmd!.shortcut).toBe('Alt+R');
      expect(cmd!.tags).toEqual(['round', 'trip']);
    });
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('save and load do not throw when localStorage is unavailable', () => {
      // The constructor calls load() which catches localStorage errors gracefully
      expect(() => {
        manager.registerCustom('persist:test', 'Persist', vi.fn());
      }).not.toThrow();
    });

    it('export/import round-trip preserves commands without localStorage', () => {
      manager.registerCustom('persist:rt', 'Persist RT', vi.fn(), {
        description: 'Test',
        tags: ['persist'],
      });

      const exported = manager.exportCustomCommands();
      expect(exported.some((m) => m.id === 'persist:rt')).toBe(true);

      ScriptableCommandManager.resetInstance();
      const fresh = ScriptableCommandManager.getInstance();
      const count = fresh.importCommands(exported);
      expect(count).toBeGreaterThanOrEqual(1);
      expect(fresh.has('persist:rt')).toBe(true);
    });

    it('execution history survives through in-memory operations', () => {
      manager.register(makeCommand('hist:persist', 'HP', { execute: vi.fn() }));
      manager.execute('hist:persist');
      expect(manager.getRecentCommands().length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on register', () => {
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.register(makeCommand('sub:a', 'A'));
      expect(called).toBe(1);
    });

    it('notifies on unregister', () => {
      manager.register(makeCommand('sub:rm', 'RM'));
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.unregister('sub:rm');
      expect(called).toBe(1);
    });

    it('notifies on execute', () => {
      manager.register(makeCommand('sub:exec', 'Exec', { execute: vi.fn() }));
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.execute('sub:exec');
      expect(called).toBe(1);
    });

    it('notifies on setEnabled', () => {
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.setEnabled('project:save', false);
      expect(called).toBe(1);
    });

    it('notifies on clearHistory', () => {
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.clearHistory();
      expect(called).toBe(1);
    });

    it('unsubscribe stops notifications', () => {
      let called = 0;
      const unsub = manager.subscribe(() => { called++; });
      unsub();
      manager.register(makeCommand('sub:x', 'X'));
      expect(called).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Shortcut parsing (standalone functions)
// ---------------------------------------------------------------------------

describe('shortcut parsing', () => {
  describe('parseShortcut', () => {
    it('parses simple key', () => {
      const result = parseShortcut('A');
      expect(result.key).toBe('a');
      expect(result.ctrl).toBe(false);
      expect(result.shift).toBe(false);
    });

    it('parses Ctrl+Key', () => {
      const result = parseShortcut('Ctrl+S');
      expect(result.key).toBe('s');
      expect(result.ctrl).toBe(true);
    });

    it('parses Ctrl+Shift+Key', () => {
      const result = parseShortcut('Ctrl+Shift+Z');
      expect(result.key).toBe('z');
      expect(result.ctrl).toBe(true);
      expect(result.shift).toBe(true);
    });

    it('parses Alt+Key', () => {
      const result = parseShortcut('Alt+R');
      expect(result.key).toBe('r');
      expect(result.alt).toBe(true);
    });

    it('parses Meta/Cmd/Command/Super as meta', () => {
      expect(parseShortcut('Meta+K').meta).toBe(true);
      expect(parseShortcut('Cmd+K').meta).toBe(true);
      expect(parseShortcut('Command+K').meta).toBe(true);
      expect(parseShortcut('Super+K').meta).toBe(true);
    });

    it('parses Control as ctrl', () => {
      expect(parseShortcut('Control+A').ctrl).toBe(true);
    });

    it('parses Option as alt', () => {
      expect(parseShortcut('Option+A').alt).toBe(true);
    });

    it('handles case insensitivity', () => {
      const result = parseShortcut('ctrl+shift+p');
      expect(result.ctrl).toBe(true);
      expect(result.shift).toBe(true);
      expect(result.key).toBe('p');
    });
  });

  describe('normalizeShortcut', () => {
    it('normalizes to canonical order', () => {
      expect(normalizeShortcut('Shift+Ctrl+A')).toBe('Ctrl+Shift+A');
    });

    it('uppercases single-character keys', () => {
      expect(normalizeShortcut('Ctrl+s')).toBe('Ctrl+S');
    });

    it('preserves multi-character keys as-is', () => {
      expect(normalizeShortcut('Ctrl+escape')).toBe('Ctrl+escape');
    });

    it('normalizes different modifier names', () => {
      expect(normalizeShortcut('cmd+k')).toBe('Meta+K');
    });
  });

  describe('matchesShortcut', () => {
    it('matches simple key', () => {
      const event = makeKeyboardEvent('a');
      expect(matchesShortcut(event, 'A')).toBe(true);
    });

    it('matches Ctrl+Key', () => {
      const event = makeKeyboardEvent('s', { ctrlKey: true });
      expect(matchesShortcut(event, 'Ctrl+S')).toBe(true);
    });

    it('rejects mismatched modifiers', () => {
      const event = makeKeyboardEvent('s', { ctrlKey: false });
      expect(matchesShortcut(event, 'Ctrl+S')).toBe(false);
    });

    it('rejects when event has extra modifier', () => {
      const event = makeKeyboardEvent('s', { ctrlKey: true, shiftKey: true });
      expect(matchesShortcut(event, 'Ctrl+S')).toBe(false);
    });

    it('matches all four modifiers', () => {
      const event = makeKeyboardEvent('z', {
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: true,
      });
      expect(matchesShortcut(event, 'Ctrl+Shift+Alt+Meta+Z')).toBe(true);
    });

    it('rejects wrong key', () => {
      const event = makeKeyboardEvent('x', { ctrlKey: true });
      expect(matchesShortcut(event, 'Ctrl+S')).toBe(false);
    });
  });
});
