import { describe, it, expect, beforeEach } from 'vitest';
import {
  VoiceWorkflowManager,
  fuzzyMatchScore,
  extractParameters,
  BUILT_IN_VOICE_COMMANDS,
} from '../voice-workflow';

describe('VoiceWorkflowManager', () => {
  let mgr: VoiceWorkflowManager;

  beforeEach(() => {
    VoiceWorkflowManager.resetInstance();
    mgr = VoiceWorkflowManager.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      expect(VoiceWorkflowManager.getInstance()).toBe(mgr);
    });

    it('returns a new instance after reset', () => {
      VoiceWorkflowManager.resetInstance();
      expect(VoiceWorkflowManager.getInstance()).not.toBe(mgr);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on processTranscript', () => {
      let called = 0;
      mgr.subscribe(() => { called += 1; });
      mgr.processTranscript('zoom in');
      expect(called).toBeGreaterThan(0);
    });

    it('can unsubscribe', () => {
      let called = 0;
      const unsub = mgr.subscribe(() => { called += 1; });
      unsub();
      mgr.processTranscript('zoom in');
      expect(called).toBe(0);
    });

    it('notifies on registerCommand', () => {
      let called = 0;
      mgr.subscribe(() => { called += 1; });
      mgr.registerCommand({ phrases: ['test'], action: 'test', category: 'test', description: 'test', requiresConfirmation: false });
      expect(called).toBe(1);
    });

    it('notifies on clearHistory', () => {
      let called = 0;
      mgr.processTranscript('zoom in');
      mgr.subscribe(() => { called += 1; });
      mgr.clearHistory();
      expect(called).toBe(1);
    });

    it('notifies on setListening', () => {
      let called = 0;
      mgr.subscribe(() => { called += 1; });
      mgr.setListening(true);
      expect(called).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Built-in commands
  // -----------------------------------------------------------------------

  describe('built-in commands', () => {
    it('has 20 built-in command definitions', () => {
      expect(BUILT_IN_VOICE_COMMANDS.length).toBe(20);
    });

    it('registers all built-ins on init', () => {
      const commands = mgr.getCommands();
      expect(commands.length).toBe(20);
    });

    it('has navigation category', () => {
      const nav = mgr.getCommandsByCategory('navigation');
      expect(nav.length).toBe(4);
    });

    it('has actions category', () => {
      const actions = mgr.getCommandsByCategory('actions');
      expect(actions.length).toBe(4);
    });

    it('has controls category', () => {
      const controls = mgr.getCommandsByCategory('controls');
      expect(controls.length).toBe(5);
    });

    it('has queries category', () => {
      const queries = mgr.getCommandsByCategory('queries');
      expect(queries.length).toBe(3);
    });

    it('has bench category', () => {
      const bench = mgr.getCommandsByCategory('bench');
      expect(bench.length).toBe(4);
    });

    it('each command has an id', () => {
      const commands = mgr.getCommands();
      for (const cmd of commands) {
        expect(cmd.id).toBeDefined();
        expect(cmd.id.length).toBeGreaterThan(0);
      }
    });

    it('each command has at least one phrase', () => {
      const commands = mgr.getCommands();
      for (const cmd of commands) {
        expect(cmd.phrases.length).toBeGreaterThan(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Command registration
  // -----------------------------------------------------------------------

  describe('registerCommand / unregisterCommand', () => {
    it('registers a custom command', () => {
      const cmd = mgr.registerCommand({
        phrases: ['deploy project'],
        action: 'deploy',
        category: 'custom',
        description: 'Deploy the project',
        requiresConfirmation: true,
      });
      expect(cmd.id).toBeDefined();
      expect(mgr.getCommands().length).toBe(21);
    });

    it('unregisters a command', () => {
      const cmd = mgr.registerCommand({
        phrases: ['remove me'],
        action: 'remove',
        category: 'custom',
        description: 'Remove',
        requiresConfirmation: false,
      });
      const before = mgr.getCommands().length;
      mgr.unregisterCommand(cmd.id);
      expect(mgr.getCommands().length).toBe(before - 1);
    });

    it('unregister unknown id is no-op', () => {
      const before = mgr.getCommands().length;
      mgr.unregisterCommand('fake-id');
      expect(mgr.getCommands().length).toBe(before);
    });

    it('getCommandsByCategory returns empty for unknown category', () => {
      expect(mgr.getCommandsByCategory('nonexistent')).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // fuzzyMatchScore
  // -----------------------------------------------------------------------

  describe('fuzzyMatchScore', () => {
    it('returns 1 for exact match', () => {
      expect(fuzzyMatchScore('zoom in', 'zoom in')).toBe(1);
    });

    it('returns 1 for case-insensitive exact match', () => {
      expect(fuzzyMatchScore('Zoom In', 'zoom in')).toBe(1);
    });

    it('returns high score for substring', () => {
      const score = fuzzyMatchScore('zoom', 'zoom in');
      expect(score).toBeGreaterThan(0.8);
    });

    it('returns 0 for empty input', () => {
      expect(fuzzyMatchScore('', 'zoom in')).toBe(0);
    });

    it('returns 0 for empty target', () => {
      expect(fuzzyMatchScore('zoom in', '')).toBe(0);
    });

    it('returns low score for very different strings', () => {
      expect(fuzzyMatchScore('abcdef', 'zyxwvu')).toBeLessThan(0.3);
    });

    it('handles whitespace trimming', () => {
      expect(fuzzyMatchScore('  zoom in  ', 'zoom in')).toBe(1);
    });

    it('scores close misspelling higher than random', () => {
      const typo = fuzzyMatchScore('zom in', 'zoom in');
      const random = fuzzyMatchScore('banana', 'zoom in');
      expect(typo).toBeGreaterThan(random);
    });
  });

  // -----------------------------------------------------------------------
  // extractParameters
  // -----------------------------------------------------------------------

  describe('extractParameters', () => {
    it('extracts single parameter', () => {
      const params = extractParameters('set baud rate to 115200', 'set baud rate to {baudRate}');
      expect(params).toEqual({ baudRate: '115200' });
    });

    it('extracts multiple parameters', () => {
      const params = extractParameters('move to 100 200', 'move to {x} {y}');
      expect(params).toEqual({ x: '100', y: '200' });
    });

    it('returns null when no params in template', () => {
      expect(extractParameters('zoom in', 'zoom in')).toBeNull();
    });

    it('returns null when transcript does not match template', () => {
      expect(extractParameters('zoom in', 'set baud rate to {baudRate}')).toBeNull();
    });

    it('is case-insensitive', () => {
      const params = extractParameters('SET BAUD RATE TO 9600', 'set baud rate to {baudRate}');
      expect(params).toEqual({ baudRate: '9600' });
    });

    it('trims parameter values', () => {
      const params = extractParameters('set baud rate to  9600 ', 'set baud rate to {baudRate}');
      expect(params).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // matchCommand
  // -----------------------------------------------------------------------

  describe('matchCommand', () => {
    it('matches exact phrase', () => {
      const result = mgr.matchCommand('zoom in');
      expect(result.matchedCommand).toBeDefined();
      expect(result.matchedCommand!.action).toBe('zoom');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('matches case-insensitively', () => {
      const result = mgr.matchCommand('ZOOM IN');
      expect(result.matchedCommand).toBeDefined();
      expect(result.matchedCommand!.action).toBe('zoom');
    });

    it('matches close misspelling', () => {
      const result = mgr.matchCommand('zom in');
      expect(result.matchedCommand).toBeDefined();
      expect(result.matchedCommand!.action).toBe('zoom');
    });

    it('returns no match for gibberish', () => {
      const result = mgr.matchCommand('xyzzy foobar baz quux');
      expect(result.matchedCommand).toBeUndefined();
      expect(result.confidence).toBeLessThan(0.55);
    });

    it('matches navigation commands', () => {
      const result = mgr.matchCommand('go to schematic');
      expect(result.matchedCommand).toBeDefined();
      expect(result.matchedCommand!.action).toBe('navigate');
      expect(result.parameters?.view).toBe('schematic');
    });

    it('matches action commands', () => {
      const result = mgr.matchCommand('compile code');
      expect(result.matchedCommand).toBeDefined();
      expect(result.matchedCommand!.action).toBe('compile');
      expect(result.matchedCommand!.requiresConfirmation).toBe(true);
    });

    it('matches parameterized command', () => {
      const result = mgr.matchCommand('set baud rate to 115200');
      expect(result.matchedCommand).toBeDefined();
      expect(result.matchedCommand!.action).toBe('setBaudRate');
      expect(result.parameters?.baudRate).toBe('115200');
    });

    it('matches alternate phrase', () => {
      const result = mgr.matchCommand('magnify');
      expect(result.matchedCommand).toBeDefined();
      expect(result.matchedCommand!.action).toBe('zoom');
    });

    it('includes timestamp', () => {
      const before = Date.now();
      const result = mgr.matchCommand('undo');
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
    });

    it('returns transcript in result', () => {
      const result = mgr.matchCommand('show errors');
      expect(result.transcript).toBe('show errors');
    });
  });

  // -----------------------------------------------------------------------
  // processTranscript
  // -----------------------------------------------------------------------

  describe('processTranscript', () => {
    it('adds to history', () => {
      mgr.processTranscript('zoom in');
      expect(mgr.getHistory()).toHaveLength(1);
    });

    it('returns match result', () => {
      const result = mgr.processTranscript('undo');
      expect(result.matchedCommand).toBeDefined();
      expect(result.matchedCommand!.action).toBe('undo');
    });

    it('increments errorCount for unmatched', () => {
      mgr.processTranscript('xyzzy nonsense');
      const state = mgr.getState();
      expect(state.errorCount).toBe(1);
    });

    it('does not increment errorCount for matched', () => {
      mgr.processTranscript('zoom in');
      const state = mgr.getState();
      expect(state.errorCount).toBe(0);
    });

    it('caps history at 500', () => {
      for (let i = 0; i < 510; i++) {
        mgr.processTranscript(`cmd ${i}`);
      }
      expect(mgr.getHistory().length).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  describe('history', () => {
    it('getHistory returns all entries', () => {
      mgr.processTranscript('zoom in');
      mgr.processTranscript('zoom out');
      mgr.processTranscript('undo');
      expect(mgr.getHistory()).toHaveLength(3);
    });

    it('getHistory with limit returns most recent', () => {
      mgr.processTranscript('zoom in');
      mgr.processTranscript('zoom out');
      mgr.processTranscript('undo');
      const recent = mgr.getHistory(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].transcript).toBe('zoom out');
      expect(recent[1].transcript).toBe('undo');
    });

    it('clearHistory empties history', () => {
      mgr.processTranscript('zoom in');
      mgr.clearHistory();
      expect(mgr.getHistory()).toHaveLength(0);
    });

    it('clearHistory resets errorCount', () => {
      mgr.processTranscript('nonsense');
      mgr.clearHistory();
      expect(mgr.getState().errorCount).toBe(0);
    });

    it('getHistory returns a copy', () => {
      mgr.processTranscript('zoom in');
      const a = mgr.getHistory();
      const b = mgr.getHistory();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  describe('state', () => {
    it('initially not listening', () => {
      expect(mgr.isListening()).toBe(false);
      expect(mgr.getState().listening).toBe(false);
    });

    it('setListening toggles listening', () => {
      mgr.setListening(true);
      expect(mgr.isListening()).toBe(true);
      mgr.setListening(false);
      expect(mgr.isListening()).toBe(false);
    });

    it('getState includes lastResult', () => {
      mgr.processTranscript('undo');
      const state = mgr.getState();
      expect(state.lastResult).toBeDefined();
      expect(state.lastResult!.transcript).toBe('undo');
    });

    it('getState lastResult is undefined initially', () => {
      expect(mgr.getState().lastResult).toBeUndefined();
    });

    it('getState includes commandHistory', () => {
      mgr.processTranscript('zoom in');
      mgr.processTranscript('zoom out');
      const state = mgr.getState();
      expect(state.commandHistory).toHaveLength(2);
    });
  });
});
