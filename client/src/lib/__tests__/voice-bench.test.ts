import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  VoiceBenchManager,
  BUILT_IN_COMMANDS,
  parseSafetyCondition,
} from '../voice-bench';
import type {
  VoiceBenchCommand,
  SafetyOverride,
} from '../voice-bench';

describe('VoiceBenchManager', () => {
  let manager: VoiceBenchManager;

  beforeEach(() => {
    VoiceBenchManager.resetInstance();
    manager = VoiceBenchManager.getInstance();
  });

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = VoiceBenchManager.getInstance();
      const b = VoiceBenchManager.getInstance();
      expect(a).toBe(b);
    });

    it('resetInstance creates fresh instance', () => {
      const a = VoiceBenchManager.getInstance();
      VoiceBenchManager.resetInstance();
      const b = VoiceBenchManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // Subscribe / snapshot
  // ---------------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on session start', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.startSession();
      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      unsub();
      manager.startSession();
      expect(listener).not.toHaveBeenCalled();
    });

    it('snapshot reflects state', () => {
      const snap1 = manager.getSnapshot();
      expect(snap1.sessionActive).toBe(false);
      expect(snap1.commandsExecuted).toBe(0);

      manager.startSession();
      const snap2 = manager.getSnapshot();
      expect(snap2.sessionActive).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  describe('session', () => {
    it('startSession creates active session', () => {
      const session = manager.startSession();
      expect(session.active).toBe(true);
      expect(session.commandsExecuted).toBe(0);
    });

    it('startSession is idempotent when active', () => {
      const s1 = manager.startSession();
      const s2 = manager.startSession();
      expect(s1.id).toBe(s2.id);
    });

    it('endSession deactivates', () => {
      manager.startSession();
      manager.endSession();
      const session = manager.getSession();
      expect(session?.active).toBe(false);
      expect(session?.endedAt).toBeDefined();
    });

    it('endSession clears pending confirmation', () => {
      manager.startSession();
      manager.processCommand('upload firmware');
      expect(manager.getSnapshot().pendingConfirmation).toBe(true);
      manager.endSession();
      expect(manager.getSnapshot().pendingConfirmation).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Command processing
  // ---------------------------------------------------------------------------

  describe('processCommand', () => {
    beforeEach(() => {
      manager.startSession();
    });

    it('rejects when no session', () => {
      manager.endSession();
      const result = manager.processCommand('compile code');
      expect(result.matched).toBe(false);
      expect(result.result).toContain('No active session');
    });

    it('matches exact phrase', () => {
      const result = manager.processCommand('compile code');
      expect(result.matched).toBe(true);
      expect(result.command?.action).toBe('compile');
    });

    it('matches fuzzy input', () => {
      const result = manager.processCommand('compile');
      expect(result.matched).toBe(true);
      expect(result.command?.action).toBe('compile');
    });

    it('returns not matched for garbage', () => {
      const result = manager.processCommand('xyzzy foobar baz');
      expect(result.matched).toBe(false);
    });

    it('increments command count', () => {
      manager.processCommand('compile code');
      expect(manager.getSession()?.commandsExecuted).toBe(1);
      manager.processCommand('save');
      expect(manager.getSession()?.commandsExecuted).toBe(2);
    });

    it('records last command', () => {
      manager.processCommand('compile code');
      expect(manager.getSession()?.lastCommand).toBe('compile code');
    });

    it('requires confirmation for dangerous-ish commands', () => {
      const result = manager.processCommand('upload firmware');
      expect(result.matched).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(manager.getSnapshot().pendingConfirmation).toBe(true);
    });

    it('kill power does NOT require confirmation (emergency)', () => {
      const result = manager.processCommand('kill power');
      expect(result.matched).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Parameter extraction
  // ---------------------------------------------------------------------------

  describe('parameter extraction', () => {
    beforeEach(() => {
      manager.startSession();
    });

    it('extracts baud rate', () => {
      const result = manager.processCommand('set baud rate to 115200');
      expect(result.parameters.baudRate).toBe('115200');
    });

    it('extracts view name', () => {
      const result = manager.processCommand('switch to schematic');
      expect(result.parameters.view).toBe('schematic');
    });

    it('extracts component for zoom', () => {
      const result = manager.processCommand('zoom to U1');
      expect(result.parameters.component).toBe('u1');
    });

    it('extracts sensor name', () => {
      const result = manager.processCommand('read temperature');
      expect(result.parameters.sensor).toBe('temperature');
    });

    it('extracts export format', () => {
      const result = manager.processCommand('export gerber');
      expect(result.parameters.format).toBe('gerber');
    });
  });

  // ---------------------------------------------------------------------------
  // Confirmation flow
  // ---------------------------------------------------------------------------

  describe('confirmAction', () => {
    beforeEach(() => {
      manager.startSession();
    });

    it('confirms and executes', () => {
      manager.processCommand('upload firmware');
      const result = manager.confirmAction(true);
      expect(result).toContain('Executing');
      expect(manager.getSnapshot().pendingConfirmation).toBe(false);
    });

    it('cancels action', () => {
      manager.processCommand('upload firmware');
      const result = manager.confirmAction(false);
      expect(result).toContain('Cancelled');
    });

    it('returns message when nothing pending', () => {
      const result = manager.confirmAction(true);
      expect(result).toContain('No pending action');
    });
  });

  // ---------------------------------------------------------------------------
  // Safety overrides
  // ---------------------------------------------------------------------------

  describe('safety overrides', () => {
    it('adds override', () => {
      const override = manager.addSafetyOverride({
        condition: 'temperature',
        operator: '>',
        threshold: 60,
        unit: 'C',
        action: 'kill_power',
      });
      expect(override.id).toBeDefined();
      expect(override.active).toBe(true);
      expect(manager.getSafetyOverrides()).toHaveLength(1);
    });

    it('removes override', () => {
      const override = manager.addSafetyOverride({
        condition: 'temperature',
        operator: '>',
        threshold: 60,
        unit: 'C',
        action: 'kill_power',
      });
      manager.removeSafetyOverride(override.id);
      expect(manager.getSafetyOverrides()).toHaveLength(0);
    });

    it('checks conditions — triggered', () => {
      manager.addSafetyOverride({
        condition: 'temperature',
        operator: '>',
        threshold: 60,
        unit: 'C',
        action: 'kill_power',
      });
      const results = manager.checkSafetyConditions({ temperature: 75 });
      expect(results).toHaveLength(1);
      expect(results[0].triggered).toBe(true);
      expect(results[0].message).toContain('SAFETY');
    });

    it('checks conditions — not triggered', () => {
      manager.addSafetyOverride({
        condition: 'temperature',
        operator: '>',
        threshold: 60,
        unit: 'C',
        action: 'kill_power',
      });
      const results = manager.checkSafetyConditions({ temperature: 45 });
      expect(results).toHaveLength(1);
      expect(results[0].triggered).toBe(false);
      expect(results[0].message).toContain('OK');
    });

    it('skips conditions without matching telemetry', () => {
      manager.addSafetyOverride({
        condition: 'temperature',
        operator: '>',
        threshold: 60,
        unit: 'C',
        action: 'kill_power',
      });
      const results = manager.checkSafetyConditions({ voltage: 3.3 });
      expect(results).toHaveLength(0);
    });

    it('supports all operators', () => {
      const operators: Array<{ op: '>' | '<' | '>=' | '<=' | '==' | '!='; value: number; expected: boolean }> = [
        { op: '>', value: 61, expected: true },
        { op: '>', value: 59, expected: false },
        { op: '<', value: 59, expected: true },
        { op: '<', value: 61, expected: false },
        { op: '>=', value: 60, expected: true },
        { op: '<=', value: 60, expected: true },
        { op: '==', value: 60, expected: true },
        { op: '!=', value: 61, expected: true },
      ];

      for (const { op, value, expected } of operators) {
        manager.reset();
        manager.addSafetyOverride({ condition: 'temp', operator: op, threshold: 60, unit: 'C', action: 'alert' });
        const results = manager.checkSafetyConditions({ temp: value });
        expect(results[0].triggered).toBe(expected);
      }
    });

    it('increments trigger count', () => {
      manager.startSession();
      manager.addSafetyOverride({ condition: 'temp', operator: '>', threshold: 50, unit: 'C', action: 'alert' });
      manager.checkSafetyConditions({ temp: 60 });
      manager.checkSafetyConditions({ temp: 70 });
      const overrides = manager.getSafetyOverrides();
      expect(overrides[0].triggeredCount).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Safety condition parsing (voice)
  // ---------------------------------------------------------------------------

  describe('parseSafetyCondition', () => {
    it('parses "if temp spikes above 60C, kill power"', () => {
      const result = parseSafetyCondition('if temp spikes above 60C, kill power');
      expect(result).not.toBeNull();
      expect(result?.condition).toBe('temperature');
      expect(result?.operator).toBe('>');
      expect(result?.threshold).toBe(60);
      expect(result?.unit).toBe('C');
      expect(result?.action).toBe('kill_power');
    });

    it('parses "when voltage drops below 3.3V, alert"', () => {
      const result = parseSafetyCondition('when voltage drops below 3.3V, alert');
      expect(result).not.toBeNull();
      expect(result?.condition).toBe('voltage');
      expect(result?.operator).toBe('<');
      expect(result?.threshold).toBe(3.3);
      expect(result?.action).toBe('alert');
    });

    it('parses "if current exceeds 2A, disconnect"', () => {
      const result = parseSafetyCondition('if current exceeds 2A, disconnect');
      expect(result).not.toBeNull();
      expect(result?.condition).toBe('current');
      expect(result?.operator).toBe('>');
      expect(result?.threshold).toBe(2);
      expect(result?.action).toBe('disconnect');
    });

    it('parses with "then" instead of comma', () => {
      const result = parseSafetyCondition('if temp goes above 80C then kill power');
      expect(result).not.toBeNull();
      expect(result?.threshold).toBe(80);
      expect(result?.action).toBe('kill_power');
    });

    it('returns null for unparseable input', () => {
      expect(parseSafetyCondition('hello world')).toBeNull();
      expect(parseSafetyCondition('if')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Voice command creates safety override
  // ---------------------------------------------------------------------------

  describe('voice safety creation', () => {
    beforeEach(() => {
      manager.startSession();
    });

    it('creates override from voice command', () => {
      const result = manager.processCommand('if temperature spikes above 60C, kill power');
      expect(result.matched).toBe(true);
      expect(result.result).toContain('Safety override added');
      expect(manager.getSafetyOverrides()).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Macros
  // ---------------------------------------------------------------------------

  describe('macros', () => {
    beforeEach(() => {
      manager.startSession();
    });

    it('creates macro', () => {
      const macro = manager.createMacro('deploy', 'deploy', [
        { command: 'compile code', delayMs: 0 },
        { command: 'upload firmware', delayMs: 1000 },
      ], 'Compile and upload');
      expect(macro.id).toBeDefined();
      expect(macro.steps).toHaveLength(2);
    });

    it('executes macro', () => {
      const macro = manager.createMacro('test', 'test macro', [
        { command: 'compile code', delayMs: 0 },
        { command: 'save', delayMs: 0 },
      ]);
      const results = manager.executeMacro(macro.id);
      expect(results).toHaveLength(2);
      expect(results[0]).toContain('Executing');
    });

    it('returns error for unknown macro', () => {
      const results = manager.executeMacro('nonexistent');
      expect(results[0]).toContain('not found');
    });

    it('deletes macro', () => {
      const macro = manager.createMacro('test', 'test', [{ command: 'save', delayMs: 0 }]);
      manager.deleteMacro(macro.id);
      expect(manager.getMacros()).toHaveLength(0);
    });

    it('finds macro by trigger', () => {
      manager.createMacro('deploy', 'deploy all', [{ command: 'save', delayMs: 0 }]);
      const found = manager.findMacroByTrigger('please deploy all now');
      expect(found).toBeDefined();
      expect(found?.name).toBe('deploy');
    });
  });

  // ---------------------------------------------------------------------------
  // Command history
  // ---------------------------------------------------------------------------

  describe('history', () => {
    beforeEach(() => {
      manager.startSession();
    });

    it('records commands', () => {
      manager.processCommand('compile code');
      manager.processCommand('save');
      const history = manager.getHistory();
      expect(history).toHaveLength(2);
    });

    it('limits history', () => {
      manager.processCommand('compile code');
      manager.processCommand('save');
      const limited = manager.getHistory(1);
      expect(limited).toHaveLength(1);
      expect(limited[0].transcript).toBe('save');
    });

    it('clears history', () => {
      manager.processCommand('compile code');
      manager.clearHistory();
      expect(manager.getHistory()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Custom commands
  // ---------------------------------------------------------------------------

  describe('custom commands', () => {
    it('registers custom command', () => {
      const cmd: VoiceBenchCommand = {
        id: 'custom_test',
        phrases: ['run my test'],
        action: 'custom_test',
        category: 'control',
        description: 'Run custom test',
        requiresConfirmation: false,
        dangerous: false,
      };
      manager.registerCommand(cmd);
      expect(manager.getCommands().some(c => c.id === 'custom_test')).toBe(true);
    });

    it('does not duplicate commands', () => {
      const cmd: VoiceBenchCommand = {
        id: 'compile',
        phrases: ['compile'],
        action: 'compile',
        category: 'compile',
        description: 'Compile',
        requiresConfirmation: false,
        dangerous: false,
      };
      const before = manager.getCommands().length;
      manager.registerCommand(cmd);
      expect(manager.getCommands().length).toBe(before);
    });

    it('filters by category', () => {
      const monitors = manager.getCommandsByCategory('monitor');
      expect(monitors.length).toBeGreaterThan(0);
      expect(monitors.every(c => c.category === 'monitor')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Session stats
  // ---------------------------------------------------------------------------

  describe('stats', () => {
    it('returns zeros when no session', () => {
      const stats = manager.getSessionStats();
      expect(stats.duration).toBe(0);
      expect(stats.commandsExecuted).toBe(0);
    });

    it('tracks stats during session', () => {
      manager.startSession();
      manager.processCommand('compile code');
      manager.processCommand('save');
      const stats = manager.getSessionStats();
      expect(stats.commandsExecuted).toBe(2);
      expect(stats.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Built-in commands
  // ---------------------------------------------------------------------------

  describe('built-in commands', () => {
    it('has 20+ built-in commands', () => {
      expect(BUILT_IN_COMMANDS.length).toBeGreaterThanOrEqual(20);
    });

    it('all have unique IDs', () => {
      const ids = BUILT_IN_COMMANDS.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all have at least one phrase', () => {
      for (const cmd of BUILT_IN_COMMANDS) {
        expect(cmd.phrases.length).toBeGreaterThan(0);
      }
    });

    it('dangerous commands are marked', () => {
      const dangerous = BUILT_IN_COMMANDS.filter(c => c.dangerous);
      expect(dangerous.length).toBeGreaterThan(0);
      expect(dangerous.some(c => c.action === 'kill_power')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('clears all state', () => {
      manager.startSession();
      manager.processCommand('compile code');
      manager.addSafetyOverride({ condition: 'temp', operator: '>', threshold: 60, unit: 'C', action: 'alert' });
      manager.createMacro('test', 'test', [{ command: 'save', delayMs: 0 }]);

      manager.reset();

      expect(manager.getSession()).toBeNull();
      expect(manager.getSafetyOverrides()).toHaveLength(0);
      expect(manager.getMacros()).toHaveLength(0);
      expect(manager.getHistory()).toHaveLength(0);
    });
  });
});
