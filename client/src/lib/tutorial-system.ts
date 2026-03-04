/**
 * Interactive Tutorial System
 *
 * Provides step-by-step guided walkthroughs for each view in ProtoPulse.
 * Tracks progress, supports prerequisites, and persists state to localStorage.
 *
 * Usage:
 *   const system = TutorialSystem.getInstance();
 *   system.startTutorial('welcome');
 *   system.completeStep('welcome', 'step-1');
 *
 * React hook:
 *   const { tutorials, activeTutorial, currentStep, startTutorial } = useTutorialSystem();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TutorialCategory =
  | 'getting-started'
  | 'architecture'
  | 'schematic'
  | 'bom'
  | 'simulation'
  | 'export'
  | 'pcb'
  | 'advanced';

export type StepType = 'highlight' | 'click' | 'input' | 'info' | 'checkpoint';

export type TutorialStatus = 'not-started' | 'in-progress' | 'completed' | 'skipped';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  type: StepType;
  targetSelector?: string;
  targetTestId?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  requiredAction?: string;
  validationFn?: string;
  tips?: string[];
  canSkip: boolean;
  order: number;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: TutorialCategory;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  steps: TutorialStep[];
  prerequisites: string[];
  tags: string[];
  version: number;
}

export interface TutorialProgress {
  tutorialId: string;
  status: TutorialStatus;
  currentStepIndex: number;
  completedSteps: string[];
  startedAt: number;
  completedAt?: number;
  timeSpentMs: number;
}

export interface TutorialEvent {
  type:
    | 'step-complete'
    | 'step-skip'
    | 'tutorial-start'
    | 'tutorial-complete'
    | 'tutorial-skip'
    | 'tutorial-reset';
  tutorialId: string;
  stepId?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-tutorials';

type Listener = () => void;

// ---------------------------------------------------------------------------
// Built-in Tutorials
// ---------------------------------------------------------------------------

function createBuiltInTutorials(): Tutorial[] {
  return [
    {
      id: 'welcome',
      title: 'Welcome to ProtoPulse',
      description: 'Get acquainted with the ProtoPulse interface and core navigation.',
      category: 'getting-started',
      difficulty: 'beginner',
      estimatedMinutes: 5,
      prerequisites: [],
      tags: ['beginner', 'overview', 'navigation'],
      version: 1,
      steps: [
        {
          id: 'welcome-overview',
          title: 'Welcome!',
          description: 'ProtoPulse is your all-in-one EDA tool. Let us show you around.',
          type: 'info',
          position: 'center',
          canSkip: true,
          order: 0,
        },
        {
          id: 'welcome-sidebar',
          title: 'The Sidebar',
          description: 'Use the sidebar to navigate between views, manage components, and access history.',
          type: 'highlight',
          targetTestId: 'sidebar',
          position: 'right',
          canSkip: true,
          order: 1,
        },
        {
          id: 'welcome-create-node',
          title: 'Create a Node',
          description: 'Click the "Add Node" button to create your first architecture block.',
          type: 'click',
          targetTestId: 'button-add-node',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: true,
          order: 2,
        },
        {
          id: 'welcome-connect',
          title: 'Connect Nodes',
          description: 'Drag from one node handle to another to create a connection.',
          type: 'info',
          position: 'center',
          canSkip: true,
          order: 3,
        },
        {
          id: 'welcome-chat',
          title: 'AI Chat',
          description: 'Use the chat panel to ask questions and let AI help you design.',
          type: 'highlight',
          targetTestId: 'chat-panel',
          position: 'left',
          canSkip: true,
          order: 4,
        },
        {
          id: 'welcome-save',
          title: 'Saving Your Work',
          description: 'Your project saves automatically. You can also export to various formats.',
          type: 'info',
          position: 'center',
          canSkip: true,
          order: 5,
        },
      ],
    },
    {
      id: 'first-architecture',
      title: 'Building Your First Architecture',
      description: 'Learn to create an architecture diagram with MCUs, sensors, and connections.',
      category: 'architecture',
      difficulty: 'beginner',
      estimatedMinutes: 10,
      prerequisites: ['welcome'],
      tags: ['architecture', 'blocks', 'connections', 'validation'],
      version: 1,
      steps: [
        {
          id: 'arch-add-mcu',
          title: 'Add a Microcontroller',
          description: 'Start by adding an MCU block to your architecture.',
          type: 'click',
          targetTestId: 'button-add-node',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: false,
          order: 0,
        },
        {
          id: 'arch-add-sensors',
          title: 'Add Sensors',
          description: 'Add sensor blocks that will connect to your MCU.',
          type: 'click',
          targetTestId: 'button-add-node',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: true,
          order: 1,
        },
        {
          id: 'arch-connect-blocks',
          title: 'Connect Blocks',
          description: 'Draw edges between your MCU and sensor blocks.',
          type: 'info',
          position: 'center',
          canSkip: true,
          order: 2,
        },
        {
          id: 'arch-name-nets',
          title: 'Name Your Nets',
          description: 'Give meaningful names to your connections (e.g., I2C_SDA, SPI_MOSI).',
          type: 'input',
          position: 'right',
          requiredAction: 'type:net-name',
          canSkip: true,
          order: 3,
        },
        {
          id: 'arch-add-power',
          title: 'Add Power Supply',
          description: 'Every circuit needs power. Add a power supply block.',
          type: 'click',
          targetTestId: 'button-add-node',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: true,
          order: 4,
        },
        {
          id: 'arch-run-validation',
          title: 'Run Validation',
          description: 'Check your design for issues using the validation panel.',
          type: 'click',
          targetTestId: 'validation-view',
          position: 'right',
          requiredAction: 'click',
          canSkip: false,
          order: 5,
        },
        {
          id: 'arch-review-results',
          title: 'Review Results',
          description: 'Examine the validation results and fix any issues found.',
          type: 'info',
          position: 'center',
          canSkip: true,
          order: 6,
        },
        {
          id: 'arch-checkpoint',
          title: 'Architecture Complete!',
          description: 'Congratulations! You have built your first architecture diagram.',
          type: 'checkpoint',
          position: 'center',
          canSkip: false,
          order: 7,
        },
      ],
    },
    {
      id: 'managing-bom',
      title: 'Managing Your BOM',
      description: 'Learn to manage your Bill of Materials — add components, set prices, and export.',
      category: 'bom',
      difficulty: 'beginner',
      estimatedMinutes: 8,
      prerequisites: ['welcome'],
      tags: ['bom', 'components', 'cost', 'procurement'],
      version: 1,
      steps: [
        {
          id: 'bom-add-component',
          title: 'Add a Component',
          description: 'Add your first component to the Bill of Materials.',
          type: 'click',
          targetTestId: 'button-add-bom-item',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: false,
          order: 0,
        },
        {
          id: 'bom-set-quantity',
          title: 'Set Quantity',
          description: 'Specify how many of this component you need.',
          type: 'input',
          targetTestId: 'input-quantity',
          position: 'right',
          requiredAction: 'type:quantity',
          canSkip: true,
          order: 1,
        },
        {
          id: 'bom-set-price',
          title: 'Set Unit Price',
          description: 'Enter the cost per unit for accurate total calculations.',
          type: 'input',
          targetTestId: 'input-unit-price',
          position: 'right',
          requiredAction: 'type:price',
          canSkip: true,
          order: 2,
        },
        {
          id: 'bom-set-supplier',
          title: 'Set Supplier',
          description: 'Specify where to source this component (DigiKey, Mouser, etc.).',
          type: 'input',
          targetTestId: 'input-supplier',
          position: 'right',
          requiredAction: 'type:supplier',
          canSkip: true,
          order: 3,
        },
        {
          id: 'bom-export',
          title: 'Export BOM',
          description: 'Export your BOM as CSV for purchasing or record-keeping.',
          type: 'click',
          targetTestId: 'button-export-bom',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: true,
          order: 4,
        },
        {
          id: 'bom-import',
          title: 'Import BOM',
          description: 'You can also import an existing BOM from a CSV file.',
          type: 'info',
          position: 'center',
          canSkip: true,
          order: 5,
        },
        {
          id: 'bom-cost-analysis',
          title: 'Cost Analysis',
          description: 'Review total costs, unit breakdown, and identify expensive components.',
          type: 'info',
          position: 'center',
          canSkip: true,
          order: 6,
        },
      ],
    },
    {
      id: 'running-simulations',
      title: 'Running Simulations',
      description: 'Create circuits and run DC/AC analysis to verify your design.',
      category: 'simulation',
      difficulty: 'intermediate',
      estimatedMinutes: 12,
      prerequisites: ['welcome', 'first-architecture'],
      tags: ['simulation', 'spice', 'dc-analysis', 'ac-analysis', 'bode-plot'],
      version: 1,
      steps: [
        {
          id: 'sim-create-circuit',
          title: 'Create a Circuit',
          description: 'Switch to the schematic view and create a new circuit design.',
          type: 'click',
          targetTestId: 'schematic-view',
          position: 'right',
          requiredAction: 'click',
          canSkip: false,
          order: 0,
        },
        {
          id: 'sim-add-components',
          title: 'Add Components',
          description: 'Place resistors, capacitors, and other components on the schematic.',
          type: 'click',
          targetTestId: 'button-add-component',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: true,
          order: 1,
        },
        {
          id: 'sim-set-parameters',
          title: 'Set Component Parameters',
          description: 'Configure values like resistance, capacitance, and voltage.',
          type: 'input',
          position: 'right',
          requiredAction: 'type:value',
          canSkip: true,
          order: 2,
        },
        {
          id: 'sim-run-dc',
          title: 'Run DC Analysis',
          description: 'Run a DC operating point analysis to see voltages and currents.',
          type: 'click',
          targetTestId: 'button-run-dc-analysis',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: false,
          order: 3,
        },
        {
          id: 'sim-read-dc-results',
          title: 'Read DC Results',
          description: 'Examine the node voltages and branch currents from the analysis.',
          type: 'info',
          position: 'center',
          canSkip: true,
          order: 4,
        },
        {
          id: 'sim-ac-sweep',
          title: 'Run AC Sweep',
          description: 'Set up a frequency sweep to see how your circuit responds across frequencies.',
          type: 'click',
          targetTestId: 'button-run-ac-analysis',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: true,
          order: 5,
        },
        {
          id: 'sim-bode-plots',
          title: 'Interpret Bode Plots',
          description: 'Read the magnitude and phase Bode plots to understand frequency response.',
          type: 'info',
          position: 'center',
          tips: ['Look for the -3dB point to find the cutoff frequency', 'A steeper rolloff means a sharper filter'],
          canSkip: true,
          order: 6,
        },
        {
          id: 'sim-checkpoint',
          title: 'Simulation Complete!',
          description: 'You have learned to simulate circuits in ProtoPulse.',
          type: 'checkpoint',
          position: 'center',
          canSkip: false,
          order: 7,
        },
      ],
    },
    {
      id: 'exporting-design',
      title: 'Exporting Your Design',
      description: 'Export your design to KiCad, Gerber, and other formats for manufacturing.',
      category: 'export',
      difficulty: 'beginner',
      estimatedMinutes: 6,
      prerequisites: ['welcome'],
      tags: ['export', 'kicad', 'gerber', 'manufacturing', 'report'],
      version: 1,
      steps: [
        {
          id: 'export-choose-format',
          title: 'Choose Export Format',
          description: 'Open the export panel and browse available formats.',
          type: 'click',
          targetTestId: 'export-panel',
          position: 'right',
          requiredAction: 'click',
          canSkip: false,
          order: 0,
        },
        {
          id: 'export-kicad',
          title: 'KiCad Export',
          description: 'Export your schematic to KiCad format for PCB layout.',
          type: 'click',
          targetTestId: 'button-export-kicad',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: true,
          order: 1,
        },
        {
          id: 'export-gerber',
          title: 'Gerber Generation',
          description: 'Generate Gerber files ready for PCB manufacturing.',
          type: 'click',
          targetTestId: 'button-export-gerber',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: true,
          order: 2,
        },
        {
          id: 'export-design-report',
          title: 'Design Report',
          description: 'Generate a comprehensive design report with specifications and analysis.',
          type: 'click',
          targetTestId: 'button-export-report',
          position: 'bottom',
          requiredAction: 'click',
          canSkip: true,
          order: 3,
        },
        {
          id: 'export-fmea',
          title: 'FMEA Report',
          description: 'Generate a Failure Mode and Effects Analysis report for reliability.',
          type: 'info',
          position: 'center',
          canSkip: true,
          order: 4,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// TutorialSystem
// ---------------------------------------------------------------------------

/**
 * Manages interactive tutorials with step-by-step progress tracking.
 * Singleton per application. Notifies subscribers on state changes.
 * Persists progress to localStorage.
 */
export class TutorialSystem {
  private static instance: TutorialSystem | null = null;

  private tutorials = new Map<string, Tutorial>();
  private progress = new Map<string, TutorialProgress>();
  private events: TutorialEvent[] = [];
  private listeners = new Set<Listener>();
  private activeTutorialId: string | null = null;

  constructor() {
    this.loadBuiltInTutorials();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): TutorialSystem {
    if (!TutorialSystem.instance) {
      TutorialSystem.instance = new TutorialSystem();
    }
    return TutorialSystem.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    TutorialSystem.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
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
  // Tutorial Management
  // -----------------------------------------------------------------------

  /** Register a new tutorial. Returns the tutorial with a generated ID. */
  registerTutorial(input: Omit<Tutorial, 'id'>): Tutorial {
    const id = crypto.randomUUID();
    const tutorial: Tutorial = { ...input, id };
    this.tutorials.set(id, tutorial);
    this.save();
    this.notify();
    return tutorial;
  }

  /** Remove a tutorial by ID. Returns false if not found. */
  removeTutorial(id: string): boolean {
    if (!this.tutorials.has(id)) {
      return false;
    }
    this.tutorials.delete(id);
    this.progress.delete(id);
    if (this.activeTutorialId === id) {
      this.activeTutorialId = null;
    }
    this.save();
    this.notify();
    return true;
  }

  /** Get a tutorial by ID. Returns null if not found. */
  getTutorial(id: string): Tutorial | null {
    return this.tutorials.get(id) ?? null;
  }

  /** Get all registered tutorials. */
  getAllTutorials(): Tutorial[] {
    const result: Tutorial[] = [];
    this.tutorials.forEach((t) => {
      result.push(t);
    });
    return result;
  }

  /** Get tutorials by category. */
  getByCategory(category: TutorialCategory): Tutorial[] {
    const result: Tutorial[] = [];
    this.tutorials.forEach((t) => {
      if (t.category === category) {
        result.push(t);
      }
    });
    return result;
  }

  /** Get tutorials by difficulty. */
  getByDifficulty(difficulty: Tutorial['difficulty']): Tutorial[] {
    const result: Tutorial[] = [];
    this.tutorials.forEach((t) => {
      if (t.difficulty === difficulty) {
        result.push(t);
      }
    });
    return result;
  }

  /** Search tutorials by query (matches title, description, tags). */
  searchTutorials(query: string): Tutorial[] {
    const q = query.toLowerCase().trim();
    if (!q) {
      return this.getAllTutorials();
    }
    const result: Tutorial[] = [];
    this.tutorials.forEach((t) => {
      const matchesTitle = t.title.toLowerCase().includes(q);
      const matchesDescription = t.description.toLowerCase().includes(q);
      const matchesTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
      if (matchesTitle || matchesDescription || matchesTags) {
        result.push(t);
      }
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Progress Management
  // -----------------------------------------------------------------------

  /** Start a tutorial. Returns the progress object. */
  startTutorial(tutorialId: string): TutorialProgress {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) {
      throw new Error(`Tutorial "${tutorialId}" not found`);
    }

    // If already in progress, return existing progress
    const existing = this.progress.get(tutorialId);
    if (existing && existing.status === 'in-progress') {
      return { ...existing };
    }

    const now = Date.now();
    const progress: TutorialProgress = {
      tutorialId,
      status: 'in-progress',
      currentStepIndex: 0,
      completedSteps: [],
      startedAt: now,
      timeSpentMs: 0,
    };

    this.progress.set(tutorialId, progress);
    this.activeTutorialId = tutorialId;

    this.addEvent({
      type: 'tutorial-start',
      tutorialId,
      timestamp: now,
    });

    this.save();
    this.notify();
    return { ...progress };
  }

  /** Get the current step for a tutorial. Returns null if no active step. */
  getCurrentStep(tutorialId: string): TutorialStep | null {
    const tutorial = this.tutorials.get(tutorialId);
    const progress = this.progress.get(tutorialId);
    if (!tutorial || !progress || progress.status !== 'in-progress') {
      return null;
    }

    const sortedSteps = [...tutorial.steps].sort((a, b) => a.order - b.order);
    if (progress.currentStepIndex < 0 || progress.currentStepIndex >= sortedSteps.length) {
      return null;
    }

    return sortedSteps[progress.currentStepIndex];
  }

  /** Complete a step in a tutorial. Returns updated progress. */
  completeStep(tutorialId: string, stepId: string): TutorialProgress {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) {
      throw new Error(`Tutorial "${tutorialId}" not found`);
    }

    const progress = this.progress.get(tutorialId);
    if (!progress || progress.status !== 'in-progress') {
      throw new Error(`Tutorial "${tutorialId}" is not in progress`);
    }

    const step = tutorial.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step "${stepId}" not found in tutorial "${tutorialId}"`);
    }

    if (!progress.completedSteps.includes(stepId)) {
      progress.completedSteps.push(stepId);
    }

    const now = Date.now();
    progress.timeSpentMs = now - progress.startedAt;

    this.addEvent({
      type: 'step-complete',
      tutorialId,
      stepId,
      timestamp: now,
    });

    // Auto-advance to next step
    const sortedSteps = [...tutorial.steps].sort((a, b) => a.order - b.order);
    const currentStepIdx = sortedSteps.findIndex((s) => s.id === stepId);
    if (currentStepIdx >= 0 && currentStepIdx + 1 < sortedSteps.length) {
      progress.currentStepIndex = currentStepIdx + 1;
    }

    // Check if all steps are completed
    if (progress.completedSteps.length >= tutorial.steps.length) {
      progress.status = 'completed';
      progress.completedAt = now;
      if (this.activeTutorialId === tutorialId) {
        this.activeTutorialId = null;
      }
      this.addEvent({
        type: 'tutorial-complete',
        tutorialId,
        timestamp: now,
      });
    }

    this.save();
    this.notify();
    return { ...progress };
  }

  /** Skip a step in a tutorial. Returns updated progress. */
  skipStep(tutorialId: string, stepId: string): TutorialProgress {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) {
      throw new Error(`Tutorial "${tutorialId}" not found`);
    }

    const progress = this.progress.get(tutorialId);
    if (!progress || progress.status !== 'in-progress') {
      throw new Error(`Tutorial "${tutorialId}" is not in progress`);
    }

    const step = tutorial.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step "${stepId}" not found in tutorial "${tutorialId}"`);
    }

    if (!step.canSkip) {
      throw new Error(`Step "${stepId}" cannot be skipped`);
    }

    // Mark as completed (skipped steps count as completed for progress)
    if (!progress.completedSteps.includes(stepId)) {
      progress.completedSteps.push(stepId);
    }

    const now = Date.now();
    progress.timeSpentMs = now - progress.startedAt;

    this.addEvent({
      type: 'step-skip',
      tutorialId,
      stepId,
      timestamp: now,
    });

    // Auto-advance to next step
    const sortedSteps = [...tutorial.steps].sort((a, b) => a.order - b.order);
    const currentStepIdx = sortedSteps.findIndex((s) => s.id === stepId);
    if (currentStepIdx >= 0 && currentStepIdx + 1 < sortedSteps.length) {
      progress.currentStepIndex = currentStepIdx + 1;
    }

    // Check if all steps are completed
    if (progress.completedSteps.length >= tutorial.steps.length) {
      progress.status = 'completed';
      progress.completedAt = now;
      if (this.activeTutorialId === tutorialId) {
        this.activeTutorialId = null;
      }
      this.addEvent({
        type: 'tutorial-complete',
        tutorialId,
        timestamp: now,
      });
    }

    this.save();
    this.notify();
    return { ...progress };
  }

  /** Advance to the next step. Returns the next step or null if at the end. */
  nextStep(tutorialId: string): TutorialStep | null {
    const tutorial = this.tutorials.get(tutorialId);
    const progress = this.progress.get(tutorialId);
    if (!tutorial || !progress || progress.status !== 'in-progress') {
      return null;
    }

    const sortedSteps = [...tutorial.steps].sort((a, b) => a.order - b.order);
    const nextIndex = progress.currentStepIndex + 1;
    if (nextIndex >= sortedSteps.length) {
      return null;
    }

    progress.currentStepIndex = nextIndex;
    progress.timeSpentMs = Date.now() - progress.startedAt;
    this.save();
    this.notify();
    return sortedSteps[nextIndex];
  }

  /** Go back to the previous step. Returns the previous step or null if at the beginning. */
  previousStep(tutorialId: string): TutorialStep | null {
    const tutorial = this.tutorials.get(tutorialId);
    const progress = this.progress.get(tutorialId);
    if (!tutorial || !progress || progress.status !== 'in-progress') {
      return null;
    }

    const prevIndex = progress.currentStepIndex - 1;
    if (prevIndex < 0) {
      return null;
    }

    const sortedSteps = [...tutorial.steps].sort((a, b) => a.order - b.order);
    progress.currentStepIndex = prevIndex;
    progress.timeSpentMs = Date.now() - progress.startedAt;
    this.save();
    this.notify();
    return sortedSteps[prevIndex];
  }

  /** Skip an entire tutorial. */
  skipTutorial(tutorialId: string): void {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) {
      throw new Error(`Tutorial "${tutorialId}" not found`);
    }

    const now = Date.now();
    const existing = this.progress.get(tutorialId);

    const progress: TutorialProgress = {
      tutorialId,
      status: 'skipped',
      currentStepIndex: existing?.currentStepIndex ?? 0,
      completedSteps: existing?.completedSteps ?? [],
      startedAt: existing?.startedAt ?? now,
      completedAt: now,
      timeSpentMs: existing ? now - existing.startedAt : 0,
    };

    this.progress.set(tutorialId, progress);
    if (this.activeTutorialId === tutorialId) {
      this.activeTutorialId = null;
    }

    this.addEvent({
      type: 'tutorial-skip',
      tutorialId,
      timestamp: now,
    });

    this.save();
    this.notify();
  }

  /** Reset progress for a single tutorial. */
  resetTutorial(tutorialId: string): void {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) {
      throw new Error(`Tutorial "${tutorialId}" not found`);
    }

    this.progress.delete(tutorialId);
    if (this.activeTutorialId === tutorialId) {
      this.activeTutorialId = null;
    }

    this.addEvent({
      type: 'tutorial-reset',
      tutorialId,
      timestamp: Date.now(),
    });

    this.save();
    this.notify();
  }

  /** Reset all progress. */
  resetAllProgress(): void {
    this.progress.clear();
    this.activeTutorialId = null;
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Status Queries
  // -----------------------------------------------------------------------

  /** Get progress for a specific tutorial. Returns null if not started. */
  getProgress(tutorialId: string): TutorialProgress | null {
    const p = this.progress.get(tutorialId);
    return p ? { ...p } : null;
  }

  /** Get all progress entries. */
  getAllProgress(): TutorialProgress[] {
    const result: TutorialProgress[] = [];
    this.progress.forEach((p) => {
      result.push({ ...p });
    });
    return result;
  }

  /** Get all completed tutorials. */
  getCompletedTutorials(): Tutorial[] {
    const result: Tutorial[] = [];
    this.progress.forEach((p, id) => {
      if (p.status === 'completed') {
        const tutorial = this.tutorials.get(id);
        if (tutorial) {
          result.push(tutorial);
        }
      }
    });
    return result;
  }

  /** Get overall completion percentage across all tutorials (0-100). */
  getCompletionPercentage(): number {
    const total = this.tutorials.size;
    if (total === 0) {
      return 0;
    }

    let completed = 0;
    this.progress.forEach((p) => {
      if (p.status === 'completed') {
        completed++;
      }
    });

    return Math.round((completed / total) * 100);
  }

  /** Get completion percentage for a specific tutorial (0-100). */
  getTutorialCompletion(tutorialId: string): number {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial || tutorial.steps.length === 0) {
      return 0;
    }

    const progress = this.progress.get(tutorialId);
    if (!progress) {
      return 0;
    }

    if (progress.status === 'completed') {
      return 100;
    }

    return Math.round((progress.completedSteps.length / tutorial.steps.length) * 100);
  }

  /** Get the currently active tutorial ID. */
  getActiveTutorialId(): string | null {
    return this.activeTutorialId;
  }

  // -----------------------------------------------------------------------
  // Prerequisites
  // -----------------------------------------------------------------------

  /** Check if a tutorial can be started (all prerequisites completed). */
  canStart(tutorialId: string): boolean {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) {
      return false;
    }

    if (tutorial.prerequisites.length === 0) {
      return true;
    }

    return tutorial.prerequisites.every((prereqId) => {
      const progress = this.progress.get(prereqId);
      return progress?.status === 'completed';
    });
  }

  // -----------------------------------------------------------------------
  // Recommendations
  // -----------------------------------------------------------------------

  /** Get recommended tutorials based on current progress. */
  getRecommended(): Tutorial[] {
    const result: Tutorial[] = [];

    this.tutorials.forEach((tutorial) => {
      const progress = this.progress.get(tutorial.id);

      // Skip completed or skipped tutorials
      if (progress && (progress.status === 'completed' || progress.status === 'skipped')) {
        return;
      }

      // Only recommend tutorials whose prerequisites are met
      if (!this.canStart(tutorial.id)) {
        return;
      }

      result.push(tutorial);
    });

    // Sort: in-progress first, then by difficulty (beginner → advanced), then by estimatedMinutes
    const difficultyOrder: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
    result.sort((a, b) => {
      const aProgress = this.progress.get(a.id);
      const bProgress = this.progress.get(b.id);
      const aInProgress = aProgress?.status === 'in-progress' ? 0 : 1;
      const bInProgress = bProgress?.status === 'in-progress' ? 0 : 1;

      if (aInProgress !== bInProgress) {
        return aInProgress - bInProgress;
      }

      const aDiff = difficultyOrder[a.difficulty] ?? 0;
      const bDiff = difficultyOrder[b.difficulty] ?? 0;
      if (aDiff !== bDiff) {
        return aDiff - bDiff;
      }

      return a.estimatedMinutes - b.estimatedMinutes;
    });

    return result;
  }

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  /** Get event history, optionally filtered by tutorial ID. */
  getEventHistory(tutorialId?: string): TutorialEvent[] {
    if (tutorialId) {
      return this.events.filter((e) => e.tutorialId === tutorialId);
    }
    return [...this.events];
  }

  /** Clear all event history. */
  clearEventHistory(): void {
    this.events = [];
    this.save();
    this.notify();
  }

  private addEvent(event: TutorialEvent): void {
    this.events.push(event);
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export all progress as a JSON string. */
  exportProgress(): string {
    const progressEntries: TutorialProgress[] = [];
    this.progress.forEach((p) => {
      progressEntries.push({ ...p });
    });

    return JSON.stringify({
      version: 1,
      progress: progressEntries,
      events: [...this.events],
      exportedAt: Date.now(),
    });
  }

  /** Import progress from a JSON string. Returns import results. */
  importProgress(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { imported: 0, errors: ['Invalid JSON'] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { imported: 0, errors: ['Invalid data format'] };
    }

    const data = parsed as Record<string, unknown>;

    if (!Array.isArray(data.progress)) {
      return { imported: 0, errors: ['Missing progress array'] };
    }

    for (const entry of data.progress as unknown[]) {
      if (typeof entry !== 'object' || entry === null) {
        errors.push('Invalid progress entry');
        continue;
      }

      const p = entry as Record<string, unknown>;
      if (typeof p.tutorialId !== 'string' || typeof p.status !== 'string') {
        errors.push('Progress entry missing tutorialId or status');
        continue;
      }

      const validStatuses: TutorialStatus[] = ['not-started', 'in-progress', 'completed', 'skipped'];
      if (!validStatuses.includes(p.status as TutorialStatus)) {
        errors.push(`Invalid status "${String(p.status)}" for tutorial "${p.tutorialId}"`);
        continue;
      }

      const progress: TutorialProgress = {
        tutorialId: p.tutorialId,
        status: p.status as TutorialStatus,
        currentStepIndex: typeof p.currentStepIndex === 'number' ? p.currentStepIndex : 0,
        completedSteps: Array.isArray(p.completedSteps) ? (p.completedSteps as string[]) : [],
        startedAt: typeof p.startedAt === 'number' ? p.startedAt : Date.now(),
        completedAt: typeof p.completedAt === 'number' ? p.completedAt : undefined,
        timeSpentMs: typeof p.timeSpentMs === 'number' ? p.timeSpentMs : 0,
      };

      this.progress.set(progress.tutorialId, progress);
      imported++;
    }

    if (imported > 0) {
      this.save();
      this.notify();
    }

    return { imported, errors };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      const progressEntries: TutorialProgress[] = [];
      this.progress.forEach((p) => {
        progressEntries.push(p);
      });

      const data = {
        progress: progressEntries,
        events: this.events,
        activeTutorialId: this.activeTutorialId,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      // Load progress
      if (Array.isArray(data.progress)) {
        for (const entry of data.progress as unknown[]) {
          if (typeof entry !== 'object' || entry === null) {
            continue;
          }
          const p = entry as Record<string, unknown>;
          if (typeof p.tutorialId === 'string' && typeof p.status === 'string') {
            this.progress.set(p.tutorialId, {
              tutorialId: p.tutorialId,
              status: p.status as TutorialStatus,
              currentStepIndex: typeof p.currentStepIndex === 'number' ? p.currentStepIndex : 0,
              completedSteps: Array.isArray(p.completedSteps) ? (p.completedSteps as string[]) : [],
              startedAt: typeof p.startedAt === 'number' ? p.startedAt : 0,
              completedAt: typeof p.completedAt === 'number' ? p.completedAt : undefined,
              timeSpentMs: typeof p.timeSpentMs === 'number' ? p.timeSpentMs : 0,
            });
          }
        }
      }

      // Load events
      if (Array.isArray(data.events)) {
        this.events = (data.events as unknown[]).filter(
          (e: unknown): e is TutorialEvent =>
            typeof e === 'object' &&
            e !== null &&
            typeof (e as TutorialEvent).type === 'string' &&
            typeof (e as TutorialEvent).tutorialId === 'string' &&
            typeof (e as TutorialEvent).timestamp === 'number',
        );
      }

      // Load active tutorial
      if (typeof data.activeTutorialId === 'string') {
        this.activeTutorialId = data.activeTutorialId;
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }

  private loadBuiltInTutorials(): void {
    const builtIn = createBuiltInTutorials();
    for (const tutorial of builtIn) {
      this.tutorials.set(tutorial.id, tutorial);
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the tutorial system in React components.
 * Subscribes to the TutorialSystem singleton and triggers re-renders on state changes.
 */
export function useTutorialSystem(): {
  tutorials: Tutorial[];
  activeTutorial: Tutorial | null;
  currentStep: TutorialStep | null;
  startTutorial: (tutorialId: string) => TutorialProgress;
  completeStep: (tutorialId: string, stepId: string) => TutorialProgress;
  skipStep: (tutorialId: string, stepId: string) => TutorialProgress;
  nextStep: (tutorialId: string) => TutorialStep | null;
  previousStep: (tutorialId: string) => TutorialStep | null;
  progress: TutorialProgress[];
  completionPercentage: number;
  recommended: Tutorial[];
  canStart: (tutorialId: string) => boolean;
  resetTutorial: (tutorialId: string) => void;
  searchTutorials: (query: string) => Tutorial[];
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const system = TutorialSystem.getInstance();
    const unsubscribe = system.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const startTutorial = useCallback((tutorialId: string) => {
    return TutorialSystem.getInstance().startTutorial(tutorialId);
  }, []);

  const completeStep = useCallback((tutorialId: string, stepId: string) => {
    return TutorialSystem.getInstance().completeStep(tutorialId, stepId);
  }, []);

  const skipStep = useCallback((tutorialId: string, stepId: string) => {
    return TutorialSystem.getInstance().skipStep(tutorialId, stepId);
  }, []);

  const nextStep = useCallback((tutorialId: string) => {
    return TutorialSystem.getInstance().nextStep(tutorialId);
  }, []);

  const previousStep = useCallback((tutorialId: string) => {
    return TutorialSystem.getInstance().previousStep(tutorialId);
  }, []);

  const canStart = useCallback((tutorialId: string) => {
    return TutorialSystem.getInstance().canStart(tutorialId);
  }, []);

  const resetTutorial = useCallback((tutorialId: string) => {
    TutorialSystem.getInstance().resetTutorial(tutorialId);
  }, []);

  const searchTutorials = useCallback((query: string) => {
    return TutorialSystem.getInstance().searchTutorials(query);
  }, []);

  const system = typeof window !== 'undefined' ? TutorialSystem.getInstance() : null;
  const activeId = system?.getActiveTutorialId() ?? null;
  const activeTutorial = activeId ? (system?.getTutorial(activeId) ?? null) : null;
  const currentStep = activeId ? (system?.getCurrentStep(activeId) ?? null) : null;

  return {
    tutorials: system?.getAllTutorials() ?? [],
    activeTutorial,
    currentStep,
    startTutorial,
    completeStep,
    skipStep,
    nextStep,
    previousStep,
    progress: system?.getAllProgress() ?? [],
    completionPercentage: system?.getCompletionPercentage() ?? 0,
    recommended: system?.getRecommended() ?? [],
    canStart,
    resetTutorial,
    searchTutorials,
  };
}
