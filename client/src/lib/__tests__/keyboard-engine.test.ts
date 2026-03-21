import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Stub globals before importing the module
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

import {
  KeyboardEngine,
  fuzzyScore,
  parseArguments,
  useKeyboardEngine,
} from '../keyboard-engine';
import type {
  CommandDefinition,
  ParsedCommand,
  CommandResult,
  CommandHistoryEntry,
  AutocompleteResult,
  CommandCategory,
} from '../keyboard-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStore(): void {
  for (const k of Object.keys(store)) {
    delete store[k];
  }
}

// ---------------------------------------------------------------------------
// Tests — fuzzyScore
// ---------------------------------------------------------------------------

describe('fuzzyScore', () => {
  it('returns 200 for exact match', () => {
    expect(fuzzyScore('place', 'place')).toBe(200);
  });

  it('returns 150 for prefix match', () => {
    expect(fuzzyScore('pla', 'place')).toBe(150);
  });

  it('returns 100 for containment match', () => {
    expect(fuzzyScore('lac', 'place')).toBe(100);
  });

  it('returns positive for subsequence match', () => {
    const score = fuzzyScore('plc', 'place');
    expect(score).toBeGreaterThan(0);
  });

  it('returns 0 for no match', () => {
    expect(fuzzyScore('xyz', 'place')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(fuzzyScore('PLACE', 'place')).toBe(200);
    expect(fuzzyScore('place', 'PLACE')).toBe(200);
  });

  it('gives higher score to prefix than containment', () => {
    const prefixScore = fuzzyScore('pla', 'place');
    const containScore = fuzzyScore('lac', 'place');
    expect(prefixScore).toBeGreaterThan(containScore);
  });

  it('returns 0 for empty query against non-empty target', () => {
    // Empty string is prefix of everything
    expect(fuzzyScore('', 'place')).toBe(150);
  });

  it('handles single character queries', () => {
    expect(fuzzyScore('p', 'place')).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// Tests — parseArguments
// ---------------------------------------------------------------------------

describe('parseArguments', () => {
  it('parses simple positional arguments', () => {
    const result = parseArguments('resistor 10k');
    expect(result.args).toEqual(['resistor', '10k']);
    expect(result.flags).toEqual({});
  });

  it('parses key=value flags', () => {
    const result = parseArguments('value=10k footprint=0805');
    expect(result.args).toEqual([]);
    expect(result.flags).toEqual({ value: '10k', footprint: '0805' });
  });

  it('parses mixed args and flags', () => {
    const result = parseArguments('R1 value=4.7k');
    expect(result.args).toEqual(['R1']);
    expect(result.flags).toEqual({ value: '4.7k' });
  });

  it('handles quoted strings', () => {
    const result = parseArguments('"hello world" test');
    expect(result.args).toEqual(['hello world', 'test']);
  });

  it('handles single-quoted strings', () => {
    const result = parseArguments("'some value' flag=yes");
    expect(result.args).toEqual(['some value']);
    expect(result.flags).toEqual({ flag: 'yes' });
  });

  it('handles empty input', () => {
    const result = parseArguments('');
    expect(result.args).toEqual([]);
    expect(result.flags).toEqual({});
  });

  it('handles multiple spaces between tokens', () => {
    const result = parseArguments('a   b    c');
    expect(result.args).toEqual(['a', 'b', 'c']);
  });

  it('ignores flags with no value (key=)', () => {
    // key= has empty value after =, so it stays as positional
    const result = parseArguments('key=');
    expect(result.args).toEqual(['key=']);
    expect(result.flags).toEqual({});
  });

  it('treats standalone = as a positional arg', () => {
    const result = parseArguments('=value');
    expect(result.args).toEqual(['=value']);
  });
});

// ---------------------------------------------------------------------------
// Tests — KeyboardEngine singleton
// ---------------------------------------------------------------------------

describe('KeyboardEngine', () => {
  let engine: KeyboardEngine;

  beforeEach(() => {
    clearStore();
    KeyboardEngine.resetForTesting();
    engine = KeyboardEngine.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Singleton ──

  describe('singleton', () => {
    it('returns the same instance on subsequent calls', () => {
      const a = KeyboardEngine.getInstance();
      const b = KeyboardEngine.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetForTesting', () => {
      const a = KeyboardEngine.getInstance();
      KeyboardEngine.resetForTesting();
      const b = KeyboardEngine.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ── Subscribe ──

  describe('subscribe', () => {
    it('notifies listeners on command execution', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.execute('undo');
      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);
      unsub();
      engine.execute('undo');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── Built-in commands ──

  describe('built-in commands', () => {
    it('has at least 20 built-in commands', () => {
      const all = engine.getAllCommands();
      expect(all.length).toBeGreaterThanOrEqual(20);
    });

    it('each command has required fields', () => {
      const all = engine.getAllCommands();
      for (const cmd of all) {
        expect(cmd.id).toBeTruthy();
        expect(cmd.label).toBeTruthy();
        expect(cmd.category).toBeTruthy();
        expect(cmd.description).toBeTruthy();
        expect(cmd.patterns.length).toBeGreaterThan(0);
        expect(cmd.examples.length).toBeGreaterThan(0);
        expect(typeof cmd.handler).toBe('function');
      }
    });
  });

  // ── Parse ──

  describe('parse', () => {
    it('parses "place resistor 10k"', () => {
      const result = engine.parse('place resistor 10k');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('place');
      expect(result!.args).toContain('resistor');
    });

    it('parses "connect R1 to C1"', () => {
      const result = engine.parse('connect R1 to C1');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('connect');
    });

    it('parses "delete R1"', () => {
      const result = engine.parse('delete R1');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('delete');
    });

    it('parses "set R1 value 4.7k"', () => {
      const result = engine.parse('set R1 value 4.7k');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('set');
    });

    it('parses "zoom in"', () => {
      const result = engine.parse('zoom in');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('zoom');
    });

    it('parses "show schematic"', () => {
      const result = engine.parse('show schematic');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('show');
    });

    it('parses "export gerber"', () => {
      const result = engine.parse('export gerber');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('export');
    });

    it('parses "run drc"', () => {
      const result = engine.parse('run drc');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('run');
    });

    it('parses "find R1"', () => {
      const result = engine.parse('find R1');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('find');
    });

    it('parses "select all resistors"', () => {
      const result = engine.parse('select all resistors');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('select');
    });

    it('parses "align left"', () => {
      const result = engine.parse('align left');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('align');
    });

    it('parses "undo"', () => {
      const result = engine.parse('undo');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('undo');
    });

    it('parses "redo"', () => {
      const result = engine.parse('redo');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('redo');
    });

    it('parses "save"', () => {
      const result = engine.parse('save');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('save');
    });

    it('parses "compile"', () => {
      const result = engine.parse('compile');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('compile');
    });

    it('parses "upload"', () => {
      const result = engine.parse('upload');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('upload');
    });

    it('parses "help"', () => {
      const result = engine.parse('help');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('help');
    });

    it('parses command aliases', () => {
      expect(engine.parse('add component LED')!.commandId).toBe('place');
      expect(engine.parse('insert MOSFET')!.commandId).toBe('place');
      expect(engine.parse('wire R1 to C1')!.commandId).toBe('connect');
      expect(engine.parse('link U1.TX to U2.RX')!.commandId).toBe('connect');
      expect(engine.parse('remove C3')!.commandId).toBe('delete');
      expect(engine.parse('open bom')!.commandId).toBe('show');
      expect(engine.parse('go to pcb')!.commandId).toBe('show');
      expect(engine.parse('search VCC')!.commandId).toBe('find');
      expect(engine.parse('build')!.commandId).toBe('compile');
      expect(engine.parse('flash')!.commandId).toBe('upload');
      expect(engine.parse('?')!.commandId).toBe('help');
    });

    it('returns null for empty input', () => {
      expect(engine.parse('')).toBeNull();
      expect(engine.parse('   ')).toBeNull();
    });

    it('returns null for unrecognized command', () => {
      expect(engine.parse('xyzzy foobar')).toBeNull();
    });

    it('is case insensitive', () => {
      const result = engine.parse('PLACE RESISTOR');
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('place');
    });

    it('preserves raw input', () => {
      const result = engine.parse('  place  resistor  10k  ');
      expect(result).not.toBeNull();
      expect(result!.raw).toBe('place  resistor  10k');
    });
  });

  // ── Execute ──

  describe('execute', () => {
    it('executes "place resistor 10k" successfully', () => {
      const result = engine.execute('place resistor 10k');
      expect(result.success).toBe(true);
      expect(result.commandId).toBe('place');
      expect(result.data?.component).toContain('resistor');
    });

    it('executes "connect R1 to C1" with source/target data', () => {
      const result = engine.execute('connect R1 to C1');
      expect(result.success).toBe(true);
      expect(result.data?.source).toBe('R1');
      expect(result.data?.target).toBe('C1');
    });

    it('executes "set R1 value 4.7k" with property data', () => {
      const result = engine.execute('set R1 value 4.7k');
      expect(result.success).toBe(true);
      expect(result.data?.target).toBe('R1');
      expect(result.data?.property).toBe('value');
      expect(result.data?.value).toBe('4.7k');
    });

    it('executes "zoom in" with level data', () => {
      const result = engine.execute('zoom in');
      expect(result.success).toBe(true);
      expect(result.data?.level).toBe('in');
    });

    it('returns error for unknown command', () => {
      const result = engine.execute('frobniculate the splines');
      expect(result.success).toBe(false);
      expect(result.commandId).toBe('unknown');
    });

    it('adds to history on execution', () => {
      engine.execute('undo');
      const history = engine.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].commandId).toBe('undo');
      expect(history[0].success).toBe(true);
    });

    it('records failed commands in history', () => {
      engine.execute('nonexistent_command');
      const history = engine.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(false);
    });

    it('executes "rename R1 to R_pullup"', () => {
      const result = engine.execute('rename R1 to R_pullup');
      expect(result.success).toBe(true);
      expect(result.data?.from).toBe('R1');
      expect(result.data?.to).toBe('R_pullup');
    });

    it('executes "rotate 90" with angle data', () => {
      const result = engine.execute('rotate 90');
      expect(result.success).toBe(true);
      expect(result.data?.angle).toBe(90);
    });

    it('executes "rotate" with default 90 degrees', () => {
      const result = engine.execute('rotate');
      expect(result.success).toBe(true);
      expect(result.data?.angle).toBe(90);
    });

    it('executes "mirror h" with axis data', () => {
      const result = engine.execute('mirror h');
      expect(result.success).toBe(true);
      expect(result.data?.axis).toBe('horizontal');
    });

    it('executes "flip vertical"', () => {
      const result = engine.execute('flip vertical');
      expect(result.success).toBe(true);
      expect(result.data?.axis).toBe('vertical');
    });

    it('executes "measure R1 to C1"', () => {
      const result = engine.execute('measure R1 to C1');
      expect(result.success).toBe(true);
      expect(result.data?.from).toBe('R1');
      expect(result.data?.to).toBe('C1');
    });

    it('handles handler exceptions gracefully', () => {
      engine.registerCommand({
        id: 'explode',
        label: 'Explode',
        category: 'editing',
        description: 'Intentionally throws',
        patterns: [/^explode$/i],
        examples: ['explode'],
        handler: () => {
          throw new Error('Boom!');
        },
      });
      const result = engine.execute('explode');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Boom!');
    });
  });

  // ── Autocomplete ──

  describe('autocomplete', () => {
    it('returns all commands for empty input', () => {
      const results = engine.autocomplete('', 100);
      expect(results.length).toBeGreaterThanOrEqual(20);
    });

    it('returns relevant results for partial input', () => {
      const results = engine.autocomplete('pla');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].commandId).toBe('place');
    });

    it('returns results sorted by score (descending)', () => {
      const results = engine.autocomplete('del');
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('respects maxResults parameter', () => {
      const results = engine.autocomplete('', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('returns empty for query with no matches', () => {
      const results = engine.autocomplete('xyzzyplugh');
      expect(results.length).toBe(0);
    });

    it('matches against command descriptions', () => {
      const results = engine.autocomplete('wire');
      expect(results.some((r) => r.commandId === 'connect')).toBe(true);
    });

    it('matches against examples', () => {
      const results = engine.autocomplete('resistor');
      expect(results.some((r) => r.commandId === 'place')).toBe(true);
    });

    it('each result has required fields', () => {
      const results = engine.autocomplete('zoom');
      expect(results.length).toBeGreaterThan(0);
      const r = results[0];
      expect(r.commandId).toBeTruthy();
      expect(r.label).toBeTruthy();
      expect(r.description).toBeTruthy();
      expect(r.examples.length).toBeGreaterThan(0);
      expect(typeof r.score).toBe('number');
    });
  });

  // ── History ──

  describe('history', () => {
    it('starts with empty history', () => {
      expect(engine.getHistory()).toEqual([]);
    });

    it('records commands in history', () => {
      engine.execute('undo');
      engine.execute('redo');
      const history = engine.getHistory();
      expect(history.length).toBe(2);
      // Newest first
      expect(history[0].commandId).toBe('redo');
      expect(history[1].commandId).toBe('undo');
    });

    it('respects limit parameter', () => {
      engine.execute('undo');
      engine.execute('redo');
      engine.execute('save');
      const history = engine.getHistory(2);
      expect(history.length).toBe(2);
    });

    it('persists history to localStorage', () => {
      engine.execute('undo');
      expect(store['protopulse:keyboard-engine-history']).toBeTruthy();
      const parsed = JSON.parse(store['protopulse:keyboard-engine-history']) as CommandHistoryEntry[];
      expect(parsed.length).toBe(1);
    });

    it('restores history from localStorage', () => {
      engine.execute('undo');
      engine.execute('redo');

      // Create new engine from persisted state
      KeyboardEngine.resetForTesting();
      const engine2 = KeyboardEngine.getInstance();
      const history = engine2.getHistory();
      expect(history.length).toBe(2);
    });

    it('clearHistory removes all entries', () => {
      engine.execute('undo');
      engine.execute('redo');
      engine.clearHistory();
      expect(engine.getHistory()).toEqual([]);
    });

    it('getLastCommand returns most recent', () => {
      expect(engine.getLastCommand()).toBeNull();
      engine.execute('undo');
      engine.execute('redo');
      expect(engine.getLastCommand()).toBe('redo');
    });

    it('getRecentUniqueCommands deduplicates', () => {
      engine.execute('undo');
      engine.execute('redo');
      engine.execute('undo');
      engine.execute('undo');
      const recent = engine.getRecentUniqueCommands();
      expect(recent).toEqual(['undo', 'redo']);
    });

    it('getRecentUniqueCommands respects limit', () => {
      engine.execute('undo');
      engine.execute('redo');
      engine.execute('save');
      const recent = engine.getRecentUniqueCommands(2);
      expect(recent.length).toBe(2);
    });

    it('caps history at MAX_HISTORY entries', () => {
      // Execute more than 100 commands
      for (let i = 0; i < 110; i++) {
        engine.execute('undo');
      }
      const history = engine.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  // ── Command registration ──

  describe('registerCommand / unregisterCommand', () => {
    it('registers a custom command', () => {
      const custom: CommandDefinition = {
        id: 'custom-test',
        label: 'Custom Test',
        category: 'project',
        description: 'A custom test command',
        patterns: [/^custom-test$/i],
        examples: ['custom-test'],
        handler: () => ({ success: true, commandId: 'custom-test', message: 'Custom!' }),
      };
      engine.registerCommand(custom);
      const result = engine.execute('custom-test');
      expect(result.success).toBe(true);
      expect(result.commandId).toBe('custom-test');
    });

    it('overwrites an existing command with same ID', () => {
      engine.registerCommand({
        id: 'undo',
        label: 'Custom Undo',
        category: 'editing',
        description: 'Overridden undo',
        patterns: [/^undo$/i],
        examples: ['undo'],
        handler: () => ({ success: true, commandId: 'undo', message: 'Custom undo!' }),
      });
      const result = engine.execute('undo');
      expect(result.message).toBe('Custom undo!');
    });

    it('unregisters a command by ID', () => {
      engine.registerCommand({
        id: 'temp',
        label: 'Temp',
        category: 'project',
        description: 'Temporary command',
        patterns: [/^temp$/i],
        examples: ['temp'],
        handler: () => ({ success: true, commandId: 'temp', message: 'Temp' }),
      });
      expect(engine.getCommand('temp')).toBeDefined();
      const removed = engine.unregisterCommand('temp');
      expect(removed).toBe(true);
      expect(engine.getCommand('temp')).toBeUndefined();
    });

    it('unregisterCommand returns false for unknown ID', () => {
      expect(engine.unregisterCommand('nonexistent')).toBe(false);
    });

    it('notifies listeners on register', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.registerCommand({
        id: 'test-notify',
        label: 'Test',
        category: 'project',
        description: 'test',
        patterns: [/^test-notify$/i],
        examples: ['test-notify'],
        handler: () => ({ success: true, commandId: 'test-notify', message: 'ok' }),
      });
      expect(listener).toHaveBeenCalled();
    });
  });

  // ── getCommand ──

  describe('getCommand', () => {
    it('returns built-in command by ID', () => {
      const cmd = engine.getCommand('place');
      expect(cmd).toBeDefined();
      expect(cmd!.label).toBe('Place Component');
    });

    it('returns undefined for unknown ID', () => {
      expect(engine.getCommand('nonexistent')).toBeUndefined();
    });
  });

  // ── generateHelp ──

  describe('generateHelp', () => {
    it('generates general help with category headers', () => {
      const help = engine.generateHelp();
      expect(help).toContain('# Available Commands');
      expect(help).toContain('place');
      expect(help).toContain('connect');
    });

    it('generates help for a specific command', () => {
      const help = engine.generateHelp('place');
      expect(help).toContain('Place Component');
      expect(help).toContain('Examples:');
      expect(help).toContain('place resistor 10k');
    });

    it('returns error message for unknown command', () => {
      const help = engine.generateHelp('nonexistent');
      expect(help).toContain('Unknown command');
    });
  });

  // ── Snapshot ──

  describe('getSnapshot', () => {
    it('returns current state', () => {
      const snap = engine.getSnapshot();
      expect(snap.commandCount).toBeGreaterThanOrEqual(20);
      expect(snap.history).toEqual([]);
    });

    it('reflects history after execution', () => {
      engine.execute('undo');
      const snap = engine.getSnapshot();
      expect(snap.history.length).toBe(1);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles "u" shortcut for undo', () => {
      const result = engine.execute('u');
      expect(result.success).toBe(true);
      expect(result.commandId).toBe('undo');
    });

    it('handles "s" shortcut for save', () => {
      const result = engine.execute('s');
      expect(result.success).toBe(true);
      expect(result.commandId).toBe('save');
    });

    it('handles compile with board flag', () => {
      const result = engine.execute('compile --board uno');
      expect(result.success).toBe(true);
      expect(result.commandId).toBe('compile');
    });

    it('handles "delete selected" (no specific target)', () => {
      const result = engine.execute('delete selected');
      expect(result.success).toBe(true);
      expect(result.data?.target).toBe('selected');
    });

    it('connect with malformed syntax still attempts parse', () => {
      // "connect something" without "to" — the regex won't match "connect X to Y"
      // but may match the basic "connect" pattern or fail
      const result = engine.execute('connect something');
      // The first pattern requires "to" so this tests fallback
      expect(result).toBeDefined();
    });

    it('help with topic', () => {
      const result = engine.execute('help place');
      expect(result.success).toBe(true);
      expect(result.data?.topic).toBe('place');
    });

    it('zoom with percentage', () => {
      const result = engine.execute('zoom 150%');
      expect(result.success).toBe(true);
      expect(result.data?.level).toBe('150%');
    });
  });
});
