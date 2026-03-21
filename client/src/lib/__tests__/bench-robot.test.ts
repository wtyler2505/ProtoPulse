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

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${uuidCounter++}`),
});

import {
  BenchRobotManager,
  useBenchRobot,
} from '../bench-robot';
import type {
  RobotCommand,
  MoveCommand,
  ProbeCommand,
  PressCommand,
  MeasureCommand,
  WaitCommand,
  PhotoCommand,
  PowerCycleCommand,
  SchematicNet,
  ConnectionStatus,
  SequenceStatus,
  TestSequence,
  StepResult,
  ExportFormat,
} from '../bench-robot';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStore(): void {
  for (const k of Object.keys(store)) {
    delete store[k];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BenchRobotManager', () => {
  let mgr: BenchRobotManager;

  beforeEach(() => {
    uuidCounter = 0;
    clearStore();
    BenchRobotManager.resetForTesting();
    mgr = BenchRobotManager.getInstance();
  });

  afterEach(() => {
    BenchRobotManager.resetForTesting();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = BenchRobotManager.getInstance();
      const b = BenchRobotManager.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetForTesting', () => {
      const a = BenchRobotManager.getInstance();
      BenchRobotManager.resetForTesting();
      const b = BenchRobotManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('calls listener on state changes', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.createSequence('test');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes correctly', () => {
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.createSequence('test');
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      mgr.subscribe(l1);
      mgr.subscribe(l2);
      mgr.createSequence('test');
      expect(l1).toHaveBeenCalled();
      expect(l2).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Connection
  // -----------------------------------------------------------------------

  describe('connection', () => {
    it('starts disconnected', () => {
      expect(mgr.getConnectionStatus()).toBe('disconnected');
    });

    it('updates connection status', () => {
      mgr.setConnectionStatus('connected');
      expect(mgr.getConnectionStatus()).toBe('connected');
    });

    it('notifies on connection change', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.setConnectionStatus('connecting');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns capabilities', () => {
      const caps = mgr.getCapabilities();
      expect(caps.maxX).toBe(300);
      expect(caps.hasMultimeter).toBe(true);
      expect(caps.hasCamera).toBe(true);
    });

    it('updates capabilities', () => {
      mgr.setCapabilities({ maxX: 500, hasCamera: false });
      const caps = mgr.getCapabilities();
      expect(caps.maxX).toBe(500);
      expect(caps.hasCamera).toBe(false);
      expect(caps.hasMultimeter).toBe(true); // unchanged
    });

    it('returns current position', () => {
      const pos = mgr.getCurrentPosition();
      expect(pos).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  // -----------------------------------------------------------------------
  // Sequence CRUD
  // -----------------------------------------------------------------------

  describe('createSequence', () => {
    it('creates a sequence with defaults', () => {
      const id = mgr.createSequence('My Test');
      const seq = mgr.getSequence(id);
      expect(seq).not.toBeNull();
      expect(seq!.name).toBe('My Test');
      expect(seq!.status).toBe('idle');
      expect(seq!.steps).toHaveLength(0);
      expect(seq!.tags).toEqual([]);
    });

    it('creates a sequence with description and tags', () => {
      const id = mgr.createSequence('Test', 'A description', ['power', 'signal']);
      const seq = mgr.getSequence(id);
      expect(seq!.description).toBe('A description');
      expect(seq!.tags).toEqual(['power', 'signal']);
    });

    it('persists to localStorage', () => {
      mgr.createSequence('Persistent');
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('getSequence', () => {
    it('returns null for unknown id', () => {
      expect(mgr.getSequence('nonexistent')).toBeNull();
    });
  });

  describe('getAllSequences', () => {
    it('returns all sequences', () => {
      mgr.createSequence('A');
      mgr.createSequence('B');
      expect(mgr.getAllSequences()).toHaveLength(2);
    });

    it('returns copies (not references)', () => {
      mgr.createSequence('A');
      const all = mgr.getAllSequences();
      all[0].name = 'modified';
      expect(mgr.getAllSequences()[0].name).toBe('A');
    });
  });

  describe('deleteSequence', () => {
    it('deletes an existing sequence', () => {
      const id = mgr.createSequence('Delete me');
      expect(mgr.deleteSequence(id)).toBe(true);
      expect(mgr.getSequence(id)).toBeNull();
    });

    it('returns false for unknown id', () => {
      expect(mgr.deleteSequence('nope')).toBe(false);
    });
  });

  describe('renameSequence', () => {
    it('renames an existing sequence', () => {
      const id = mgr.createSequence('Old Name');
      expect(mgr.renameSequence(id, 'New Name')).toBe(true);
      expect(mgr.getSequence(id)!.name).toBe('New Name');
    });

    it('returns false for unknown id', () => {
      expect(mgr.renameSequence('nope', 'test')).toBe(false);
    });
  });

  describe('duplicateSequence', () => {
    it('duplicates a sequence with fresh IDs', () => {
      const id = mgr.createSequence('Original');
      mgr.addCommand(id, { type: 'wait', durationMs: 100 });
      const copyId = mgr.duplicateSequence(id);
      expect(copyId).not.toBeNull();
      const copy = mgr.getSequence(copyId!);
      expect(copy!.name).toBe('Original (copy)');
      expect(copy!.steps).toHaveLength(1);
      expect(copy!.status).toBe('idle');
      expect(copy!.id).not.toBe(id);
      expect(copy!.steps[0].id).not.toBe(mgr.getSequence(id)!.steps[0].id);
    });

    it('returns null for unknown id', () => {
      expect(mgr.duplicateSequence('nope')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Step Management
  // -----------------------------------------------------------------------

  describe('addCommand', () => {
    it('adds a step with auto-generated label', () => {
      const seqId = mgr.createSequence('Test');
      const stepId = mgr.addCommand(seqId, { type: 'move', x: 10, y: 20, z: 5 });
      expect(stepId).not.toBeNull();
      const seq = mgr.getSequence(seqId)!;
      expect(seq.steps).toHaveLength(1);
      expect(seq.steps[0].label).toBe('Move to (10, 20, 5)');
    });

    it('adds a step with custom label', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 500 }, 'Custom Wait');
      expect(mgr.getSequence(seqId)!.steps[0].label).toBe('Custom Wait');
    });

    it('returns null for unknown sequence', () => {
      expect(mgr.addCommand('nope', { type: 'wait', durationMs: 100 })).toBeNull();
    });

    it('returns null when sequence is running', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.runSequence(seqId);
      expect(mgr.addCommand(seqId, { type: 'wait', durationMs: 200 })).toBeNull();
    });

    it('generates labels for all command types', () => {
      const seqId = mgr.createSequence('Label test');
      mgr.addCommand(seqId, { type: 'move', x: 1, y: 2, z: 3 });
      mgr.addCommand(seqId, { type: 'probe', target: 'VCC' });
      mgr.addCommand(seqId, { type: 'press', target: 'SW1', durationMs: 200 });
      mgr.addCommand(seqId, { type: 'measure', measureType: 'voltage', probeA: 'VCC', probeB: 'GND' });
      mgr.addCommand(seqId, { type: 'wait', durationMs: 500, reason: 'settling' });
      mgr.addCommand(seqId, { type: 'photo', label: 'Board top' });
      mgr.addCommand(seqId, { type: 'power_cycle', offDurationMs: 1000, rail: '5V' });
      const steps = mgr.getSequence(seqId)!.steps;
      expect(steps[0].label).toBe('Move to (1, 2, 3)');
      expect(steps[1].label).toBe('Probe VCC');
      expect(steps[2].label).toBe('Press SW1 for 200ms');
      expect(steps[3].label).toContain('voltage');
      expect(steps[4].label).toContain('settling');
      expect(steps[5].label).toBe('Photo: Board top');
      expect(steps[6].label).toContain('5V');
    });
  });

  describe('removeStep', () => {
    it('removes a step from a sequence', () => {
      const seqId = mgr.createSequence('Test');
      const stepId = mgr.addCommand(seqId, { type: 'wait', durationMs: 100 })!;
      expect(mgr.removeStep(seqId, stepId)).toBe(true);
      expect(mgr.getSequence(seqId)!.steps).toHaveLength(0);
    });

    it('returns false for unknown step', () => {
      const seqId = mgr.createSequence('Test');
      expect(mgr.removeStep(seqId, 'nope')).toBe(false);
    });

    it('returns false for unknown sequence', () => {
      expect(mgr.removeStep('nope', 'nope')).toBe(false);
    });

    it('returns false when running', () => {
      const seqId = mgr.createSequence('Test');
      const stepId = mgr.addCommand(seqId, { type: 'wait', durationMs: 100 })!;
      mgr.runSequence(seqId);
      expect(mgr.removeStep(seqId, stepId)).toBe(false);
    });
  });

  describe('reorderSteps', () => {
    it('reorders steps', () => {
      const seqId = mgr.createSequence('Test');
      const s1 = mgr.addCommand(seqId, { type: 'wait', durationMs: 100 }, 'First')!;
      const s2 = mgr.addCommand(seqId, { type: 'wait', durationMs: 200 }, 'Second')!;
      expect(mgr.reorderSteps(seqId, [s2, s1])).toBe(true);
      const steps = mgr.getSequence(seqId)!.steps;
      expect(steps[0].label).toBe('Second');
      expect(steps[1].label).toBe('First');
    });

    it('returns false for wrong step count', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      expect(mgr.reorderSteps(seqId, [])).toBe(false);
    });

    it('returns false for unknown step IDs', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      expect(mgr.reorderSteps(seqId, ['bad-id'])).toBe(false);
    });

    it('returns false when running', () => {
      const seqId = mgr.createSequence('Test');
      const s1 = mgr.addCommand(seqId, { type: 'wait', durationMs: 100 })!;
      mgr.runSequence(seqId);
      expect(mgr.reorderSteps(seqId, [s1])).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Execution
  // -----------------------------------------------------------------------

  describe('runSequence', () => {
    it('starts a sequence', () => {
      const seqId = mgr.createSequence('Run test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      expect(mgr.runSequence(seqId)).toBe(true);
      expect(mgr.getSequence(seqId)!.status).toBe('running');
    });

    it('resets steps on fresh run', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId);
      // Sequence should be completed
      mgr.runSequence(seqId); // re-run
      const seq = mgr.getSequence(seqId)!;
      expect(seq.status).toBe('running');
      expect(seq.steps[0].status).toBe('pending');
    });

    it('returns false for empty sequence', () => {
      const seqId = mgr.createSequence('Empty');
      expect(mgr.runSequence(seqId)).toBe(false);
    });

    it('returns false for already running sequence', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.runSequence(seqId);
      expect(mgr.runSequence(seqId)).toBe(false);
    });

    it('returns false for unknown id', () => {
      expect(mgr.runSequence('nope')).toBe(false);
    });
  });

  describe('pauseSequence', () => {
    it('pauses a running sequence', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.addCommand(seqId, { type: 'wait', durationMs: 200 });
      mgr.runSequence(seqId);
      expect(mgr.pauseSequence(seqId)).toBe(true);
      expect(mgr.getSequence(seqId)!.status).toBe('paused');
    });

    it('returns false for non-running sequence', () => {
      const seqId = mgr.createSequence('Test');
      expect(mgr.pauseSequence(seqId)).toBe(false);
    });
  });

  describe('resuming from paused', () => {
    it('resumes without resetting steps', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.addCommand(seqId, { type: 'wait', durationMs: 200 });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId); // completes step 0
      mgr.pauseSequence(seqId);
      mgr.runSequence(seqId); // resume
      const seq = mgr.getSequence(seqId)!;
      expect(seq.status).toBe('running');
      expect(seq.currentStepIndex).toBe(1);
      expect(seq.steps[0].status).toBe('passed'); // not reset
    });
  });

  describe('resetSequence', () => {
    it('resets a sequence to idle', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId);
      expect(mgr.resetSequence(seqId)).toBe(true);
      const seq = mgr.getSequence(seqId)!;
      expect(seq.status).toBe('idle');
      expect(seq.currentStepIndex).toBe(0);
      expect(seq.steps[0].status).toBe('pending');
    });

    it('returns false for unknown id', () => {
      expect(mgr.resetSequence('nope')).toBe(false);
    });
  });

  describe('executeCurrentStep', () => {
    it('executes and advances to next step', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.addCommand(seqId, { type: 'wait', durationMs: 200 });
      mgr.runSequence(seqId);
      expect(mgr.executeCurrentStep(seqId)).toBe(true);
      const seq = mgr.getSequence(seqId)!;
      expect(seq.currentStepIndex).toBe(1);
      expect(seq.steps[0].status).toBe('passed');
      expect(seq.steps[0].result).toBeDefined();
    });

    it('completes sequence when all steps done', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId);
      expect(mgr.getSequence(seqId)!.status).toBe('completed');
    });

    it('marks sequence failed when a step fails', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId, { passed: false, message: 'Timeout', durationMs: 5000 });
      expect(mgr.getSequence(seqId)!.status).toBe('failed');
    });

    it('returns false when not running', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      expect(mgr.executeCurrentStep(seqId)).toBe(false);
    });

    it('returns false for unknown id', () => {
      expect(mgr.executeCurrentStep('nope')).toBe(false);
    });

    it('updates position on move commands', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'move', x: 50, y: 60, z: 10 });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId);
      expect(mgr.getCurrentPosition()).toEqual({ x: 50, y: 60, z: 10 });
    });

    it('returns false when past last step', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId);
      // Sequence is now completed, can't execute more
      expect(mgr.executeCurrentStep(seqId)).toBe(false);
    });

    it('simulates measure results with expected values', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, {
        type: 'measure',
        measureType: 'voltage',
        probeA: 'VCC',
        probeB: 'GND',
        expectedValue: 3.3,
      });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId);
      const step = mgr.getSequence(seqId)!.steps[0];
      expect(step.result!.measuredValue).toBe(3.3);
      expect(step.result!.unit).toBe('V');
    });

    it('simulates photo results', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'photo', label: 'Board top' });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId);
      const step = mgr.getSequence(seqId)!.steps[0];
      expect(step.result!.photoData).toBeDefined();
    });
  });

  describe('skipCurrentStep', () => {
    it('skips the current step', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.addCommand(seqId, { type: 'wait', durationMs: 200 });
      mgr.runSequence(seqId);
      expect(mgr.skipCurrentStep(seqId)).toBe(true);
      const seq = mgr.getSequence(seqId)!;
      expect(seq.steps[0].status).toBe('skipped');
      expect(seq.currentStepIndex).toBe(1);
    });

    it('completes sequence after skipping last step', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.runSequence(seqId);
      mgr.skipCurrentStep(seqId);
      expect(mgr.getSequence(seqId)!.status).toBe('completed');
    });

    it('returns false when not running', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      expect(mgr.skipCurrentStep(seqId)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Auto-generate from schematic
  // -----------------------------------------------------------------------

  describe('generateFromSchematic', () => {
    it('generates a test sequence from schematic nets', () => {
      const nets: SchematicNet[] = [
        {
          id: 'n1',
          name: 'VCC',
          expectedVoltage: 5,
          connectedPins: [
            { componentId: 'U1', pinName: 'VCC', x: 0, y: 0 },
            { componentId: 'C1', pinName: '1', x: 10, y: 0 },
          ],
        },
        {
          id: 'n2',
          name: 'SIG',
          connectedPins: [
            { componentId: 'U1', pinName: 'OUT', x: 0, y: 10 },
            { componentId: 'R1', pinName: '1', x: 20, y: 10 },
          ],
        },
      ];
      const seqId = mgr.generateFromSchematic(nets);
      const seq = mgr.getSequence(seqId)!;
      // VCC has expectedVoltage: voltage measure + continuity
      // SIG has no expectedVoltage: just continuity
      expect(seq.steps.length).toBe(3);
      expect(seq.tags).toContain('auto-generated');
    });

    it('uses custom sequence name', () => {
      const nets: SchematicNet[] = [
        {
          id: 'n1',
          name: 'NET1',
          connectedPins: [
            { componentId: 'U1', pinName: 'A', x: 0, y: 0 },
            { componentId: 'U2', pinName: 'B', x: 10, y: 0 },
          ],
        },
      ];
      const seqId = mgr.generateFromSchematic(nets, 'Power Rail Tests');
      expect(mgr.getSequence(seqId)!.name).toBe('Power Rail Tests');
    });

    it('skips nets with fewer than 2 pins', () => {
      const nets: SchematicNet[] = [
        {
          id: 'n1',
          name: 'SINGLE',
          connectedPins: [{ componentId: 'U1', pinName: 'A', x: 0, y: 0 }],
        },
      ];
      const seqId = mgr.generateFromSchematic(nets);
      expect(mgr.getSequence(seqId)!.steps).toHaveLength(0);
    });

    it('sorts power nets first', () => {
      const nets: SchematicNet[] = [
        {
          id: 'n1',
          name: 'SIG',
          connectedPins: [
            { componentId: 'U1', pinName: 'A', x: 0, y: 0 },
            { componentId: 'U2', pinName: 'B', x: 10, y: 0 },
          ],
        },
        {
          id: 'n2',
          name: 'VCC',
          expectedVoltage: 3.3,
          connectedPins: [
            { componentId: 'U1', pinName: 'VCC', x: 0, y: 0 },
            { componentId: 'C1', pinName: '1', x: 10, y: 0 },
          ],
        },
      ];
      const seqId = mgr.generateFromSchematic(nets);
      const seq = mgr.getSequence(seqId)!;
      // VCC should come first despite being listed second
      expect(seq.steps[0].label).toContain('VCC');
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  describe('validateCommand', () => {
    it('validates move command — in range', () => {
      const errors = mgr.validateCommand({ type: 'move', x: 100, y: 100, z: 25 });
      expect(errors).toHaveLength(0);
    });

    it('validates move command — out of range', () => {
      const errors = mgr.validateCommand({ type: 'move', x: -1, y: 250, z: 60 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('validates move speed', () => {
      const errors = mgr.validateCommand({ type: 'move', x: 10, y: 10, z: 10, speed: -5 });
      expect(errors).toContain('Speed must be positive');
    });

    it('validates probe — empty target', () => {
      const errors = mgr.validateCommand({ type: 'probe', target: '  ' });
      expect(errors).toContain('Probe target cannot be empty');
    });

    it('validates probe — invalid tolerance', () => {
      const errors = mgr.validateCommand({ type: 'probe', target: 'VCC', tolerancePercent: 150 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('validates press — empty target', () => {
      const errors = mgr.validateCommand({ type: 'press', target: '', durationMs: 100 });
      expect(errors).toContain('Press target cannot be empty');
    });

    it('validates press — zero duration', () => {
      const errors = mgr.validateCommand({ type: 'press', target: 'SW1', durationMs: 0 });
      expect(errors).toContain('Duration must be positive');
    });

    it('validates press — negative force', () => {
      const errors = mgr.validateCommand({ type: 'press', target: 'SW1', durationMs: 100, forceGrams: -10 });
      expect(errors).toContain('Force must be positive');
    });

    it('validates measure — same probes', () => {
      const errors = mgr.validateCommand({
        type: 'measure',
        measureType: 'voltage',
        probeA: 'VCC',
        probeB: 'VCC',
      });
      expect(errors).toContain('Probe points must be different');
    });

    it('validates measure — empty probes', () => {
      const errors = mgr.validateCommand({
        type: 'measure',
        measureType: 'voltage',
        probeA: '',
        probeB: 'GND',
      });
      expect(errors).toContain('Both probe points must be specified');
    });

    it('validates measure — unsupported type', () => {
      mgr.setCapabilities({ supportedMeasurements: ['voltage'] });
      const errors = mgr.validateCommand({
        type: 'measure',
        measureType: 'capacitance',
        probeA: 'A',
        probeB: 'B',
      });
      expect(errors.some((e) => e.includes('not supported'))).toBe(true);
    });

    it('validates measure — no multimeter', () => {
      mgr.setCapabilities({ hasMultimeter: false });
      const errors = mgr.validateCommand({
        type: 'measure',
        measureType: 'voltage',
        probeA: 'A',
        probeB: 'B',
      });
      expect(errors).toContain('Robot does not have a multimeter');
    });

    it('validates wait — zero duration', () => {
      const errors = mgr.validateCommand({ type: 'wait', durationMs: 0 });
      expect(errors).toContain('Wait duration must be positive');
    });

    it('validates photo — empty label', () => {
      const errors = mgr.validateCommand({ type: 'photo', label: '' });
      expect(errors).toContain('Photo label cannot be empty');
    });

    it('validates photo — no camera', () => {
      mgr.setCapabilities({ hasCamera: false });
      const errors = mgr.validateCommand({ type: 'photo', label: 'test' });
      expect(errors).toContain('Robot does not have a camera');
    });

    it('validates photo — zoom out of range', () => {
      const errors = mgr.validateCommand({ type: 'photo', label: 'test', zoom: 15 });
      expect(errors).toContain('Zoom must be between 1 and 10');
    });

    it('validates power_cycle — zero duration', () => {
      const errors = mgr.validateCommand({ type: 'power_cycle', offDurationMs: 0 });
      expect(errors).toContain('Off duration must be positive');
    });

    it('validates power_cycle — no power control', () => {
      mgr.setCapabilities({ hasPowerControl: false });
      const errors = mgr.validateCommand({ type: 'power_cycle', offDurationMs: 1000 });
      expect(errors).toContain('Robot does not have power control');
    });
  });

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  describe('getSequenceStats', () => {
    it('returns stats for a sequence', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.addCommand(seqId, { type: 'wait', durationMs: 200 });
      mgr.addCommand(seqId, { type: 'wait', durationMs: 300 });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId); // passed
      mgr.executeCurrentStep(seqId, { passed: false, message: 'fail', durationMs: 100 }); // failed
      mgr.skipCurrentStep(seqId); // skipped
      const stats = mgr.getSequenceStats(seqId)!;
      expect(stats.total).toBe(3);
      expect(stats.passed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.skipped).toBe(1);
      expect(stats.passRate).toBe(50);
    });

    it('returns 0 pass rate for no executed steps', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      const stats = mgr.getSequenceStats(seqId)!;
      expect(stats.passRate).toBe(0);
      expect(stats.pending).toBe(1);
    });

    it('returns null for unknown id', () => {
      expect(mgr.getSequenceStats('nope')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------

  describe('exportResults', () => {
    it('exports as JSON', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId);
      const json = mgr.exportResults(seqId, { type: 'json' });
      expect(json).not.toBeNull();
      const parsed = JSON.parse(json!);
      expect(parsed.sequenceName).toBe('Test');
      expect(parsed.steps).toHaveLength(1);
      expect(parsed.stats).toBeDefined();
    });

    it('exports as CSV', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'measure', measureType: 'voltage', probeA: 'VCC', probeB: 'GND', expectedValue: 5 });
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId);
      const csv = mgr.exportResults(seqId, { type: 'csv' });
      expect(csv).not.toBeNull();
      const lines = csv!.split('\n');
      expect(lines[0]).toContain('Step');
      expect(lines[0]).toContain('Command');
      expect(lines.length).toBe(2); // header + 1 row
    });

    it('returns null for unknown id', () => {
      expect(mgr.exportResults('nope', { type: 'json' })).toBeNull();
    });

    it('handles CSV escaping with commas and quotes', () => {
      const seqId = mgr.createSequence('Test');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 }, 'Wait, then "check"');
      mgr.runSequence(seqId);
      mgr.executeCurrentStep(seqId);
      const csv = mgr.exportResults(seqId, { type: 'csv' })!;
      expect(csv).toContain('""check""'); // double-escaped quotes
    });
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('loads sequences from localStorage on init', () => {
      const seqId = mgr.createSequence('Saved');
      mgr.addCommand(seqId, { type: 'wait', durationMs: 100 });

      BenchRobotManager.resetForTesting();
      const mgr2 = BenchRobotManager.getInstance();
      const all = mgr2.getAllSequences();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('Saved');
    });

    it('handles corrupt localStorage gracefully', () => {
      store['protopulse-bench-robot'] = 'not json';
      BenchRobotManager.resetForTesting();
      const mgr2 = BenchRobotManager.getInstance();
      expect(mgr2.getAllSequences()).toHaveLength(0);
    });

    it('handles non-array localStorage gracefully', () => {
      store['protopulse-bench-robot'] = '"a string"';
      BenchRobotManager.resetForTesting();
      const mgr2 = BenchRobotManager.getInstance();
      expect(mgr2.getAllSequences()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // useBenchRobot hook (type-check only in happy-dom)
  // -----------------------------------------------------------------------

  describe('useBenchRobot', () => {
    it('is exported as a function', () => {
      expect(typeof useBenchRobot).toBe('function');
    });
  });
});
