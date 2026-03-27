/**
 * Learning Path — structured beginner-to-PCB progression
 *
 * Sequences the existing tutorials, labs, and onboarding steps into a
 * single coherent "zero to PCB" curriculum. Each milestone represents
 * a real accomplishment that builds on the previous one.
 *
 * Persists progress to localStorage per user. Pure TypeScript + React hook.
 *
 * Usage:
 *   const path = LearningPathManager.getInstance();
 *   path.completeStep('architecture-basics');
 *   path.getProgress(); // { currentPhase, completedSteps, nextStep, ... }
 *
 * React hook:
 *   const { progress, completeStep, resetProgress } = useLearningPath();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export type LearningPhase =
  | 'welcome'
  | 'architecture'
  | 'schematic'
  | 'simulation'
  | 'pcb'
  | 'export'
  | 'advanced'
  | 'complete';

export interface LearningStep {
  id: string;
  phase: LearningPhase;
  title: string;
  description: string;
  /** View that should be active for this step. */
  targetView?: string;
  /** Tutorial ID from tutorials.ts that covers this step. */
  tutorialId?: string;
  /** Lab template ID from lab-templates.ts that covers this step. */
  labId?: string;
  /** Prerequisites — step IDs that must be completed first. */
  prerequisites: string[];
  /** Estimated minutes to complete this step. */
  estimatedMinutes: number;
}

export interface LearningProgress {
  currentPhase: LearningPhase;
  completedSteps: Set<string>;
  nextStep: LearningStep | null;
  phaseProgress: Record<LearningPhase, { completed: number; total: number }>;
  overallPercent: number;
  skillLevel: SkillLevel;
  startedAt: number;
  lastActivityAt: number;
}

// ---------------------------------------------------------------------------
// Curriculum definition
// ---------------------------------------------------------------------------

export const LEARNING_STEPS: LearningStep[] = [
  // Phase 1: Welcome
  {
    id: 'explore-workspace',
    phase: 'welcome',
    title: 'Explore the Workspace',
    description: 'Get familiar with the sidebar, views, and AI chat panel.',
    targetView: 'architecture',
    tutorialId: 'getting-started',
    prerequisites: [],
    estimatedMinutes: 3,
  },
  {
    id: 'meet-the-ai',
    phase: 'welcome',
    title: 'Meet Your AI Assistant',
    description: 'Send your first message to the AI and learn how it can help with design.',
    targetView: 'architecture',
    prerequisites: ['explore-workspace'],
    estimatedMinutes: 2,
  },

  // Phase 2: Architecture
  {
    id: 'architecture-basics',
    phase: 'architecture',
    title: 'Design a Block Diagram',
    description: 'Add components to the architecture canvas and connect them with edges.',
    targetView: 'architecture',
    prerequisites: ['explore-workspace'],
    estimatedMinutes: 5,
  },
  {
    id: 'add-mcu',
    phase: 'architecture',
    title: 'Add a Microcontroller',
    description: 'Add an MCU node (like ESP32 or Arduino) as the brain of your design.',
    targetView: 'architecture',
    prerequisites: ['architecture-basics'],
    estimatedMinutes: 3,
  },
  {
    id: 'connect-peripherals',
    phase: 'architecture',
    title: 'Connect Peripherals',
    description: 'Add sensors, actuators, or LEDs and connect them to your MCU.',
    targetView: 'architecture',
    prerequisites: ['add-mcu'],
    estimatedMinutes: 5,
  },

  // Phase 3: Schematic
  {
    id: 'schematic-basics',
    phase: 'schematic',
    title: 'Place Your First Component',
    description: 'Open the schematic editor and place a component from the parts library.',
    targetView: 'schematic',
    prerequisites: ['architecture-basics'],
    estimatedMinutes: 5,
  },
  {
    id: 'wire-connections',
    phase: 'schematic',
    title: 'Wire Components Together',
    description: 'Use the wire tool to connect component pins and create nets.',
    targetView: 'schematic',
    prerequisites: ['schematic-basics'],
    estimatedMinutes: 8,
  },
  {
    id: 'add-power',
    phase: 'schematic',
    title: 'Add Power and Ground',
    description: 'Connect VCC and GND symbols to power your circuit.',
    targetView: 'schematic',
    prerequisites: ['wire-connections'],
    estimatedMinutes: 3,
  },

  // Phase 4: Simulation
  {
    id: 'run-drc',
    phase: 'simulation',
    title: 'Run Design Rule Check',
    description: 'Validate your design with DRC to find wiring errors before simulation.',
    targetView: 'validation',
    prerequisites: ['wire-connections'],
    estimatedMinutes: 3,
  },
  {
    id: 'dc-simulation',
    phase: 'simulation',
    title: 'Run Your First Simulation',
    description: 'Run a DC operating point analysis to see voltages and currents.',
    targetView: 'simulation',
    prerequisites: ['add-power', 'run-drc'],
    estimatedMinutes: 5,
  },

  // Phase 5: PCB
  {
    id: 'push-to-pcb',
    phase: 'pcb',
    title: 'Push to PCB',
    description: 'Transfer your schematic to the PCB layout editor.',
    targetView: 'pcb',
    prerequisites: ['wire-connections'],
    estimatedMinutes: 2,
  },
  {
    id: 'place-components-pcb',
    phase: 'pcb',
    title: 'Place Components on the Board',
    description: 'Arrange components on the PCB and set board dimensions.',
    targetView: 'pcb',
    prerequisites: ['push-to-pcb'],
    estimatedMinutes: 10,
  },
  {
    id: 'route-traces',
    phase: 'pcb',
    title: 'Route Traces',
    description: 'Connect pads with copper traces — manually or with the autorouter.',
    targetView: 'pcb',
    prerequisites: ['place-components-pcb'],
    estimatedMinutes: 15,
  },

  // Phase 6: Export
  {
    id: 'export-gerbers',
    phase: 'export',
    title: 'Generate Gerber Files',
    description: 'Export manufacturing files ready for PCB fabrication.',
    targetView: 'output',
    prerequisites: ['route-traces'],
    estimatedMinutes: 3,
  },
  {
    id: 'order-pcb',
    phase: 'export',
    title: 'Order Your PCB',
    description: 'Use the ordering wizard to get quotes and place a fab order.',
    targetView: 'ordering',
    prerequisites: ['export-gerbers'],
    estimatedMinutes: 5,
  },

  // Phase 7: Advanced
  {
    id: 'bom-management',
    phase: 'advanced',
    title: 'Manage Your Bill of Materials',
    description: 'Add parts, compare suppliers, and track inventory.',
    targetView: 'procurement',
    prerequisites: ['schematic-basics'],
    estimatedMinutes: 5,
  },
  {
    id: 'circuit-code',
    phase: 'advanced',
    title: 'Design with Code',
    description: 'Write circuit definitions as code using the Circuit DSL.',
    targetView: 'circuit_code',
    prerequisites: ['schematic-basics'],
    estimatedMinutes: 10,
  },
  {
    id: 'firmware-scaffold',
    phase: 'advanced',
    title: 'Generate Firmware',
    description: 'Auto-generate Arduino/ESP firmware from your circuit design.',
    targetView: 'arduino',
    prerequisites: ['schematic-basics'],
    estimatedMinutes: 8,
  },
];

const PHASE_ORDER: LearningPhase[] = [
  'welcome', 'architecture', 'schematic', 'simulation', 'pcb', 'export', 'advanced', 'complete',
];

const STORAGE_KEY = 'protopulse-learning-path';

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

interface PersistedState {
  completedSteps: string[];
  startedAt: number;
  lastActivityAt: number;
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { completedSteps: [], startedAt: Date.now(), lastActivityAt: Date.now() };
    }
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [],
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : Date.now(),
      lastActivityAt: typeof parsed.lastActivityAt === 'number' ? parsed.lastActivityAt : Date.now(),
    };
  } catch {
    return { completedSteps: [], startedAt: Date.now(), lastActivityAt: Date.now() };
  }
}

function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be full or unavailable
  }
}

// ---------------------------------------------------------------------------
// Manager (singleton+subscribe)
// ---------------------------------------------------------------------------

type Listener = () => void;

export class LearningPathManager {
  private static instance: LearningPathManager | null = null;
  private listeners = new Set<Listener>();
  private completed: Set<string>;
  private startedAt: number;
  private lastActivityAt: number;

  private constructor() {
    const state = loadState();
    this.completed = new Set(state.completedSteps);
    this.startedAt = state.startedAt;
    this.lastActivityAt = state.lastActivityAt;
  }

  static getInstance(): LearningPathManager {
    if (!LearningPathManager.instance) {
      LearningPathManager.instance = new LearningPathManager();
    }
    return LearningPathManager.instance;
  }

  /** For testing — reset the singleton. */
  static resetInstance(): void {
    LearningPathManager.instance = null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private persist(): void {
    saveState({
      completedSteps: Array.from(this.completed),
      startedAt: this.startedAt,
      lastActivityAt: this.lastActivityAt,
    });
  }

  completeStep(stepId: string): void {
    if (this.completed.has(stepId)) return;
    const step = LEARNING_STEPS.find((s) => s.id === stepId);
    if (!step) return;

    // Check prerequisites
    for (const prereq of step.prerequisites) {
      if (!this.completed.has(prereq)) return;
    }

    this.completed.add(stepId);
    this.lastActivityAt = Date.now();
    this.persist();
    this.notify();
  }

  isStepCompleted(stepId: string): boolean {
    return this.completed.has(stepId);
  }

  isStepAvailable(stepId: string): boolean {
    const step = LEARNING_STEPS.find((s) => s.id === stepId);
    if (!step) return false;
    return step.prerequisites.every((p) => this.completed.has(p));
  }

  getProgress(): LearningProgress {
    const phaseProgress: Record<string, { completed: number; total: number }> = {};
    for (const phase of PHASE_ORDER) {
      phaseProgress[phase] = { completed: 0, total: 0 };
    }

    for (const step of LEARNING_STEPS) {
      phaseProgress[step.phase].total++;
      if (this.completed.has(step.id)) {
        phaseProgress[step.phase].completed++;
      }
    }

    const totalSteps = LEARNING_STEPS.length;
    const completedCount = this.completed.size;
    const overallPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

    // Determine current phase (first incomplete phase)
    let currentPhase: LearningPhase = 'complete';
    for (const phase of PHASE_ORDER) {
      if (phase === 'complete') continue;
      const pp = phaseProgress[phase];
      if (pp.total > 0 && pp.completed < pp.total) {
        currentPhase = phase;
        break;
      }
    }

    // Find next available step
    let nextStep: LearningStep | null = null;
    for (const step of LEARNING_STEPS) {
      if (this.completed.has(step.id)) continue;
      if (step.prerequisites.every((p) => this.completed.has(p))) {
        nextStep = step;
        break;
      }
    }

    // Derive skill level from progress
    let skillLevel: SkillLevel = 'beginner';
    if (overallPercent >= 70) {
      skillLevel = 'advanced';
    } else if (overallPercent >= 35) {
      skillLevel = 'intermediate';
    }

    return {
      currentPhase,
      completedSteps: new Set(this.completed),
      nextStep,
      phaseProgress: phaseProgress as Record<LearningPhase, { completed: number; total: number }>,
      overallPercent,
      skillLevel,
      startedAt: this.startedAt,
      lastActivityAt: this.lastActivityAt,
    };
  }

  getStepsForPhase(phase: LearningPhase): LearningStep[] {
    return LEARNING_STEPS.filter((s) => s.phase === phase);
  }

  resetProgress(): void {
    this.completed.clear();
    this.startedAt = Date.now();
    this.lastActivityAt = Date.now();
    this.persist();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useLearningPath() {
  const manager = LearningPathManager.getInstance();
  const [progress, setProgress] = useState<LearningProgress>(manager.getProgress());

  useEffect(() => {
    const update = () => setProgress(manager.getProgress());
    return manager.subscribe(update);
  }, [manager]);

  const completeStep = useCallback(
    (stepId: string) => manager.completeStep(stepId),
    [manager],
  );

  const resetProgress = useCallback(
    () => manager.resetProgress(),
    [manager],
  );

  return { progress, completeStep, resetProgress, steps: LEARNING_STEPS, manager };
}
