/**
 * BL-0453 — Automated Bench Robot Integration
 *
 * Manages communication with bench test robots that can physically probe,
 * measure, and manipulate circuit boards. Supports command sequencing,
 * test sequence lifecycle (idle → running → paused → completed/failed),
 * auto-generation from schematic nets, result collection, and CSV/JSON export.
 *
 * Singleton + Subscribe pattern. Persists command history to localStorage.
 *
 * Usage:
 *   const robot = BenchRobotManager.getInstance();
 *   robot.setConnectionStatus('connected');
 *   const seq = robot.createSequence('Power rail test');
 *   robot.addCommand(seq, { type: 'move', x: 10, y: 20, z: 5 });
 *   robot.addCommand(seq, { type: 'measure', measureType: 'voltage', probeA: 'VCC', probeB: 'GND' });
 *   robot.runSequence(seq);
 *
 * React hook:
 *   const { sequences, activeSequence, runSequence, pauseSequence, ... } = useBenchRobot();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type SequenceStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export type RobotCommandType = 'move' | 'probe' | 'press' | 'measure' | 'wait' | 'photo' | 'power_cycle';

export type MeasurementType = 'voltage' | 'current' | 'resistance' | 'continuity' | 'capacitance' | 'frequency';

export interface RobotPosition {
  x: number;
  y: number;
  z: number;
}

export interface MoveCommand {
  type: 'move';
  x: number;
  y: number;
  z: number;
  /** Speed in mm/s. Default 50. */
  speed?: number;
}

export interface ProbeCommand {
  type: 'probe';
  /** Net or pad name to probe. */
  target: string;
  /** Expected value (e.g., "3.3V"). */
  expectedValue?: string;
  /** Tolerance percentage (0..100). */
  tolerancePercent?: number;
}

export interface PressCommand {
  type: 'press';
  /** Target button/switch name. */
  target: string;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Force in grams. */
  forceGrams?: number;
}

export interface MeasureCommand {
  type: 'measure';
  measureType: MeasurementType;
  probeA: string;
  probeB: string;
  /** Expected value (unit depends on measureType). */
  expectedValue?: number;
  /** Tolerance percentage (0..100). Default 10. */
  tolerancePercent?: number;
  /** Measurement range override. */
  range?: string;
}

export interface WaitCommand {
  type: 'wait';
  /** Duration in milliseconds. */
  durationMs: number;
  /** Optional reason for the wait. */
  reason?: string;
}

export interface PhotoCommand {
  type: 'photo';
  /** Label for the captured image. */
  label: string;
  /** Optional zoom level 1..10. */
  zoom?: number;
}

export interface PowerCycleCommand {
  type: 'power_cycle';
  /** Off duration in milliseconds. */
  offDurationMs: number;
  /** Optional target power rail. */
  rail?: string;
}

export type RobotCommand =
  | MoveCommand
  | ProbeCommand
  | PressCommand
  | MeasureCommand
  | WaitCommand
  | PhotoCommand
  | PowerCycleCommand;

export interface SequenceStep {
  id: string;
  command: RobotCommand;
  /** Step label for display. */
  label: string;
  /** Step status. */
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  /** Result data (populated after execution). */
  result?: StepResult;
  /** Timestamp when step completed. */
  completedAt?: number;
}

export interface StepResult {
  /** Measured value (if applicable). */
  measuredValue?: number;
  /** Unit string. */
  unit?: string;
  /** Whether the step passed its expectations. */
  passed: boolean;
  /** Error or info message. */
  message: string;
  /** Photo URL/data (for photo commands). */
  photoData?: string;
  /** Duration in ms. */
  durationMs: number;
}

export interface TestSequence {
  id: string;
  name: string;
  description: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  /** Current step index (when running). */
  currentStepIndex: number;
  /** Tags for filtering. */
  tags: string[];
}

export interface RobotCapabilities {
  maxX: number;
  maxY: number;
  maxZ: number;
  hasMultimeter: boolean;
  hasCamera: boolean;
  hasPowerControl: boolean;
  supportedMeasurements: MeasurementType[];
}

export interface SchematicNet {
  id: string;
  name: string;
  expectedVoltage?: number;
  connectedPins: Array<{ componentId: string; pinName: string; x: number; y: number }>;
}

export interface ExportFormat {
  type: 'csv' | 'json';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-bench-robot';

const DEFAULT_CAPABILITIES: RobotCapabilities = {
  maxX: 300,
  maxY: 200,
  maxZ: 50,
  hasMultimeter: true,
  hasCamera: true,
  hasPowerControl: true,
  supportedMeasurements: ['voltage', 'current', 'resistance', 'continuity', 'capacitance', 'frequency'],
};

const MEASUREMENT_UNITS: Record<MeasurementType, string> = {
  voltage: 'V',
  current: 'A',
  resistance: 'Ω',
  continuity: 'Ω',
  capacitance: 'F',
  frequency: 'Hz',
};

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// BenchRobotManager
// ---------------------------------------------------------------------------

export class BenchRobotManager {
  private static instance: BenchRobotManager | null = null;

  private sequences: TestSequence[] = [];
  private connectionStatus: ConnectionStatus = 'disconnected';
  private capabilities: RobotCapabilities = { ...DEFAULT_CAPABILITIES };
  private currentPosition: RobotPosition = { x: 0, y: 0, z: 0 };
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  static getInstance(): BenchRobotManager {
    if (!BenchRobotManager.instance) {
      BenchRobotManager.instance = new BenchRobotManager();
    }
    return BenchRobotManager.instance;
  }

  static resetForTesting(): void {
    BenchRobotManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Connection
  // -----------------------------------------------------------------------

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.notify();
  }

  getCapabilities(): RobotCapabilities {
    return { ...this.capabilities };
  }

  setCapabilities(caps: Partial<RobotCapabilities>): void {
    this.capabilities = { ...this.capabilities, ...caps };
    this.notify();
  }

  getCurrentPosition(): RobotPosition {
    return { ...this.currentPosition };
  }

  // -----------------------------------------------------------------------
  // Sequence CRUD
  // -----------------------------------------------------------------------

  createSequence(name: string, description = '', tags: string[] = []): string {
    const id = crypto.randomUUID();
    const now = Date.now();
    const seq: TestSequence = {
      id,
      name,
      description,
      status: 'idle',
      steps: [],
      createdAt: now,
      updatedAt: now,
      currentStepIndex: 0,
      tags,
    };
    this.sequences.push(seq);
    this.save();
    this.notify();
    return id;
  }

  getSequence(id: string): TestSequence | null {
    return this.sequences.find((s) => s.id === id) ?? null;
  }

  getAllSequences(): TestSequence[] {
    return this.sequences.map((s) => ({ ...s, steps: s.steps.map((st) => ({ ...st })) }));
  }

  deleteSequence(id: string): boolean {
    const idx = this.sequences.findIndex((s) => s.id === id);
    if (idx === -1) {
      return false;
    }
    this.sequences.splice(idx, 1);
    this.save();
    this.notify();
    return true;
  }

  renameSequence(id: string, name: string): boolean {
    const seq = this.sequences.find((s) => s.id === id);
    if (!seq) {
      return false;
    }
    seq.name = name;
    seq.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  duplicateSequence(id: string): string | null {
    const original = this.sequences.find((s) => s.id === id);
    if (!original) {
      return null;
    }
    const newId = crypto.randomUUID();
    const now = Date.now();
    const copy: TestSequence = {
      id: newId,
      name: `${original.name} (copy)`,
      description: original.description,
      status: 'idle',
      steps: original.steps.map((st) => ({
        ...st,
        id: crypto.randomUUID(),
        status: 'pending' as const,
        result: undefined,
        completedAt: undefined,
      })),
      createdAt: now,
      updatedAt: now,
      currentStepIndex: 0,
      tags: [...original.tags],
    };
    this.sequences.push(copy);
    this.save();
    this.notify();
    return newId;
  }

  // -----------------------------------------------------------------------
  // Step Management
  // -----------------------------------------------------------------------

  addCommand(sequenceId: string, command: RobotCommand, label?: string): string | null {
    const seq = this.sequences.find((s) => s.id === sequenceId);
    if (!seq || seq.status === 'running') {
      return null;
    }
    const stepId = crypto.randomUUID();
    const step: SequenceStep = {
      id: stepId,
      command,
      label: label ?? this.generateStepLabel(command),
      status: 'pending',
    };
    seq.steps.push(step);
    seq.updatedAt = Date.now();
    this.save();
    this.notify();
    return stepId;
  }

  removeStep(sequenceId: string, stepId: string): boolean {
    const seq = this.sequences.find((s) => s.id === sequenceId);
    if (!seq || seq.status === 'running') {
      return false;
    }
    const idx = seq.steps.findIndex((st) => st.id === stepId);
    if (idx === -1) {
      return false;
    }
    seq.steps.splice(idx, 1);
    seq.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  reorderSteps(sequenceId: string, stepIds: string[]): boolean {
    const seq = this.sequences.find((s) => s.id === sequenceId);
    if (!seq || seq.status === 'running') {
      return false;
    }
    if (stepIds.length !== seq.steps.length) {
      return false;
    }
    const stepMap = new Map<string, SequenceStep>();
    seq.steps.forEach((st) => {
      stepMap.set(st.id, st);
    });
    const reordered: SequenceStep[] = [];
    for (const id of stepIds) {
      const st = stepMap.get(id);
      if (!st) {
        return false;
      }
      reordered.push(st);
    }
    seq.steps = reordered;
    seq.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Execution
  // -----------------------------------------------------------------------

  runSequence(id: string): boolean {
    const seq = this.sequences.find((s) => s.id === id);
    if (!seq) {
      return false;
    }
    if (seq.steps.length === 0) {
      return false;
    }
    if (seq.status === 'running') {
      return false;
    }
    if (seq.status !== 'paused') {
      // Reset all steps for a fresh run
      seq.steps.forEach((st) => {
        st.status = 'pending';
        st.result = undefined;
        st.completedAt = undefined;
      });
      seq.currentStepIndex = 0;
    }
    seq.status = 'running';
    seq.startedAt = seq.startedAt ?? Date.now();
    seq.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  pauseSequence(id: string): boolean {
    const seq = this.sequences.find((s) => s.id === id);
    if (!seq || seq.status !== 'running') {
      return false;
    }
    seq.status = 'paused';
    seq.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  resetSequence(id: string): boolean {
    const seq = this.sequences.find((s) => s.id === id);
    if (!seq) {
      return false;
    }
    seq.status = 'idle';
    seq.currentStepIndex = 0;
    seq.startedAt = undefined;
    seq.completedAt = undefined;
    seq.steps.forEach((st) => {
      st.status = 'pending';
      st.result = undefined;
      st.completedAt = undefined;
    });
    seq.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  /**
   * Simulate executing the current step. In real usage, this would send
   * commands to hardware. Here we simulate with deterministic results.
   */
  executeCurrentStep(id: string, result?: StepResult): boolean {
    const seq = this.sequences.find((s) => s.id === id);
    if (!seq || seq.status !== 'running') {
      return false;
    }
    if (seq.currentStepIndex >= seq.steps.length) {
      return false;
    }

    const step = seq.steps[seq.currentStepIndex];
    const stepResult = result ?? this.simulateStepResult(step.command);
    step.status = stepResult.passed ? 'passed' : 'failed';
    step.result = stepResult;
    step.completedAt = Date.now();

    // Update position for move commands
    if (step.command.type === 'move') {
      this.currentPosition = { x: step.command.x, y: step.command.y, z: step.command.z };
    }

    seq.currentStepIndex++;
    seq.updatedAt = Date.now();

    // Check if sequence is complete
    if (seq.currentStepIndex >= seq.steps.length) {
      const anyFailed = seq.steps.some((st) => st.status === 'failed');
      seq.status = anyFailed ? 'failed' : 'completed';
      seq.completedAt = Date.now();
    }

    this.save();
    this.notify();
    return true;
  }

  /**
   * Skip the current step.
   */
  skipCurrentStep(id: string): boolean {
    const seq = this.sequences.find((s) => s.id === id);
    if (!seq || seq.status !== 'running') {
      return false;
    }
    if (seq.currentStepIndex >= seq.steps.length) {
      return false;
    }

    const step = seq.steps[seq.currentStepIndex];
    step.status = 'skipped';
    step.completedAt = Date.now();
    seq.currentStepIndex++;
    seq.updatedAt = Date.now();

    if (seq.currentStepIndex >= seq.steps.length) {
      const anyFailed = seq.steps.some((st) => st.status === 'failed');
      seq.status = anyFailed ? 'failed' : 'completed';
      seq.completedAt = Date.now();
    }

    this.save();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Auto-generate from schematic
  // -----------------------------------------------------------------------

  /**
   * Generate a test sequence from schematic nets.
   * Creates probe/measure steps for each net with expected voltages,
   * and continuity checks between connected pins.
   */
  generateFromSchematic(nets: SchematicNet[], sequenceName?: string): string {
    const seqId = this.createSequence(
      sequenceName ?? 'Auto-generated test sequence',
      `Generated from ${nets.length} schematic nets`,
      ['auto-generated'],
    );

    // Sort nets: power nets first (have expectedVoltage), then signal nets
    const sortedNets = [...nets].sort((a, b) => {
      const aHasV = a.expectedVoltage !== undefined ? 0 : 1;
      const bHasV = b.expectedVoltage !== undefined ? 0 : 1;
      return aHasV - bHasV;
    });

    for (const net of sortedNets) {
      if (net.connectedPins.length < 2) {
        continue;
      }

      // Add voltage measurement for power nets
      if (net.expectedVoltage !== undefined) {
        this.addCommand(seqId, {
          type: 'measure',
          measureType: 'voltage',
          probeA: net.name,
          probeB: 'GND',
          expectedValue: net.expectedVoltage,
          tolerancePercent: 5,
        }, `Measure ${net.name} voltage`);
      }

      // Add continuity check between first and last pin
      const firstPin = net.connectedPins[0];
      const lastPin = net.connectedPins[net.connectedPins.length - 1];
      this.addCommand(seqId, {
        type: 'measure',
        measureType: 'continuity',
        probeA: `${firstPin.componentId}.${firstPin.pinName}`,
        probeB: `${lastPin.componentId}.${lastPin.pinName}`,
        expectedValue: 0,
        tolerancePercent: 100,
      }, `Continuity: ${net.name} (${firstPin.pinName} ↔ ${lastPin.pinName})`);
    }

    return seqId;
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  validateCommand(command: RobotCommand): string[] {
    const errors: string[] = [];

    switch (command.type) {
      case 'move': {
        if (command.x < 0 || command.x > this.capabilities.maxX) {
          errors.push(`X position ${command.x} out of range (0..${this.capabilities.maxX})`);
        }
        if (command.y < 0 || command.y > this.capabilities.maxY) {
          errors.push(`Y position ${command.y} out of range (0..${this.capabilities.maxY})`);
        }
        if (command.z < 0 || command.z > this.capabilities.maxZ) {
          errors.push(`Z position ${command.z} out of range (0..${this.capabilities.maxZ})`);
        }
        if (command.speed !== undefined && command.speed <= 0) {
          errors.push('Speed must be positive');
        }
        break;
      }
      case 'probe': {
        if (!command.target.trim()) {
          errors.push('Probe target cannot be empty');
        }
        if (command.tolerancePercent !== undefined && (command.tolerancePercent < 0 || command.tolerancePercent > 100)) {
          errors.push('Tolerance must be between 0 and 100');
        }
        break;
      }
      case 'press': {
        if (!command.target.trim()) {
          errors.push('Press target cannot be empty');
        }
        if (command.durationMs <= 0) {
          errors.push('Duration must be positive');
        }
        if (command.forceGrams !== undefined && command.forceGrams <= 0) {
          errors.push('Force must be positive');
        }
        break;
      }
      case 'measure': {
        if (!command.probeA.trim() || !command.probeB.trim()) {
          errors.push('Both probe points must be specified');
        }
        if (command.probeA === command.probeB) {
          errors.push('Probe points must be different');
        }
        if (!this.capabilities.hasMultimeter) {
          errors.push('Robot does not have a multimeter');
        }
        if (!this.capabilities.supportedMeasurements.includes(command.measureType)) {
          errors.push(`Measurement type "${command.measureType}" not supported`);
        }
        if (command.tolerancePercent !== undefined && (command.tolerancePercent < 0 || command.tolerancePercent > 100)) {
          errors.push('Tolerance must be between 0 and 100');
        }
        break;
      }
      case 'wait': {
        if (command.durationMs <= 0) {
          errors.push('Wait duration must be positive');
        }
        break;
      }
      case 'photo': {
        if (!command.label.trim()) {
          errors.push('Photo label cannot be empty');
        }
        if (!this.capabilities.hasCamera) {
          errors.push('Robot does not have a camera');
        }
        if (command.zoom !== undefined && (command.zoom < 1 || command.zoom > 10)) {
          errors.push('Zoom must be between 1 and 10');
        }
        break;
      }
      case 'power_cycle': {
        if (command.offDurationMs <= 0) {
          errors.push('Off duration must be positive');
        }
        if (!this.capabilities.hasPowerControl) {
          errors.push('Robot does not have power control');
        }
        break;
      }
    }

    return errors;
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  getSequenceStats(id: string): { total: number; passed: number; failed: number; skipped: number; pending: number; passRate: number } | null {
    const seq = this.sequences.find((s) => s.id === id);
    if (!seq) {
      return null;
    }
    const total = seq.steps.length;
    const passed = seq.steps.filter((s) => s.status === 'passed').length;
    const failed = seq.steps.filter((s) => s.status === 'failed').length;
    const skipped = seq.steps.filter((s) => s.status === 'skipped').length;
    const pending = seq.steps.filter((s) => s.status === 'pending' || s.status === 'running').length;
    const executed = passed + failed;
    const passRate = executed > 0 ? (passed / executed) * 100 : 0;
    return { total, passed, failed, skipped, pending, passRate };
  }

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------

  exportResults(id: string, format: ExportFormat): string | null {
    const seq = this.sequences.find((s) => s.id === id);
    if (!seq) {
      return null;
    }

    if (format.type === 'json') {
      return JSON.stringify({
        sequenceName: seq.name,
        status: seq.status,
        startedAt: seq.startedAt,
        completedAt: seq.completedAt,
        stats: this.getSequenceStats(id),
        steps: seq.steps.map((st) => ({
          label: st.label,
          commandType: st.command.type,
          status: st.status,
          measuredValue: st.result?.measuredValue,
          unit: st.result?.unit,
          passed: st.result?.passed,
          message: st.result?.message,
          durationMs: st.result?.durationMs,
        })),
      }, null, 2);
    }

    // CSV format
    const headers = ['Step', 'Command', 'Status', 'Measured Value', 'Unit', 'Pass/Fail', 'Message', 'Duration (ms)'];
    const rows = seq.steps.map((st) => [
      st.label,
      st.command.type,
      st.status,
      st.result?.measuredValue?.toString() ?? '',
      st.result?.unit ?? '',
      st.result?.passed !== undefined ? (st.result.passed ? 'PASS' : 'FAIL') : '',
      st.result?.message ?? '',
      st.result?.durationMs?.toString() ?? '',
    ]);

    const csvLines = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))];
    return csvLines.join('\n');
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private generateStepLabel(command: RobotCommand): string {
    switch (command.type) {
      case 'move':
        return `Move to (${command.x}, ${command.y}, ${command.z})`;
      case 'probe':
        return `Probe ${command.target}`;
      case 'press':
        return `Press ${command.target} for ${command.durationMs}ms`;
      case 'measure':
        return `Measure ${command.measureType}: ${command.probeA} ↔ ${command.probeB}`;
      case 'wait':
        return `Wait ${command.durationMs}ms${command.reason ? ` (${command.reason})` : ''}`;
      case 'photo':
        return `Photo: ${command.label}`;
      case 'power_cycle':
        return `Power cycle (${command.offDurationMs}ms off)${command.rail ? ` on ${command.rail}` : ''}`;
    }
  }

  private simulateStepResult(command: RobotCommand): StepResult {
    switch (command.type) {
      case 'move':
        return { passed: true, message: `Moved to (${command.x}, ${command.y}, ${command.z})`, durationMs: 500 };
      case 'probe':
        return { passed: true, message: `Probed ${command.target}`, durationMs: 200 };
      case 'press':
        return { passed: true, message: `Pressed ${command.target}`, durationMs: command.durationMs };
      case 'measure': {
        const unit = MEASUREMENT_UNITS[command.measureType];
        const measuredValue = command.expectedValue ?? 0;
        return {
          passed: true,
          message: `Measured ${measuredValue}${unit}`,
          measuredValue,
          unit,
          durationMs: 300,
        };
      }
      case 'wait':
        return { passed: true, message: `Waited ${command.durationMs}ms`, durationMs: command.durationMs };
      case 'photo':
        return { passed: true, message: `Captured photo: ${command.label}`, photoData: 'data:image/png;base64,', durationMs: 1000 };
      case 'power_cycle':
        return { passed: true, message: `Power cycled (${command.offDurationMs}ms off)`, durationMs: command.offDurationMs + 500 };
    }
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sequences));
    } catch {
      // localStorage might be full or unavailable
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TestSequence[];
        if (Array.isArray(parsed)) {
          this.sequences = parsed;
        }
      }
    } catch {
      this.sequences = [];
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useBenchRobot(): {
  sequences: TestSequence[];
  connectionStatus: ConnectionStatus;
  capabilities: RobotCapabilities;
  currentPosition: RobotPosition;
  createSequence: (name: string, description?: string, tags?: string[]) => string;
  deleteSequence: (id: string) => boolean;
  renameSequence: (id: string, name: string) => boolean;
  duplicateSequence: (id: string) => string | null;
  addCommand: (sequenceId: string, command: RobotCommand, label?: string) => string | null;
  removeStep: (sequenceId: string, stepId: string) => boolean;
  runSequence: (id: string) => boolean;
  pauseSequence: (id: string) => boolean;
  resetSequence: (id: string) => boolean;
  executeCurrentStep: (id: string, result?: StepResult) => boolean;
  skipCurrentStep: (id: string) => boolean;
  generateFromSchematic: (nets: SchematicNet[], name?: string) => string;
  validateCommand: (command: RobotCommand) => string[];
  getSequenceStats: (id: string) => ReturnType<BenchRobotManager['getSequenceStats']>;
  exportResults: (id: string, format: ExportFormat) => string | null;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setCapabilities: (caps: Partial<RobotCapabilities>) => void;
} {
  const mgr = BenchRobotManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return mgr.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, [mgr]);

  return {
    sequences: mgr.getAllSequences(),
    connectionStatus: mgr.getConnectionStatus(),
    capabilities: mgr.getCapabilities(),
    currentPosition: mgr.getCurrentPosition(),
    createSequence: useCallback((name: string, description?: string, tags?: string[]) => mgr.createSequence(name, description, tags), [mgr]),
    deleteSequence: useCallback((id: string) => mgr.deleteSequence(id), [mgr]),
    renameSequence: useCallback((id: string, name: string) => mgr.renameSequence(id, name), [mgr]),
    duplicateSequence: useCallback((id: string) => mgr.duplicateSequence(id), [mgr]),
    addCommand: useCallback((seqId: string, cmd: RobotCommand, label?: string) => mgr.addCommand(seqId, cmd, label), [mgr]),
    removeStep: useCallback((seqId: string, stepId: string) => mgr.removeStep(seqId, stepId), [mgr]),
    runSequence: useCallback((id: string) => mgr.runSequence(id), [mgr]),
    pauseSequence: useCallback((id: string) => mgr.pauseSequence(id), [mgr]),
    resetSequence: useCallback((id: string) => mgr.resetSequence(id), [mgr]),
    executeCurrentStep: useCallback((id: string, result?: StepResult) => mgr.executeCurrentStep(id, result), [mgr]),
    skipCurrentStep: useCallback((id: string) => mgr.skipCurrentStep(id), [mgr]),
    generateFromSchematic: useCallback((nets: SchematicNet[], name?: string) => mgr.generateFromSchematic(nets, name), [mgr]),
    validateCommand: useCallback((cmd: RobotCommand) => mgr.validateCommand(cmd), [mgr]),
    getSequenceStats: useCallback((id: string) => mgr.getSequenceStats(id), [mgr]),
    exportResults: useCallback((id: string, fmt: ExportFormat) => mgr.exportResults(id, fmt), [mgr]),
    setConnectionStatus: useCallback((status: ConnectionStatus) => mgr.setConnectionStatus(status), [mgr]),
    setCapabilities: useCallback((caps: Partial<RobotCapabilities>) => mgr.setCapabilities(caps), [mgr]),
  };
}
