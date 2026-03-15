/**
 * PCB Tutorial — "Your First PCB" Guided Walkthrough
 *
 * A 10-step interactive tutorial that guides makers through the complete
 * journey from creating a circuit to exporting Gerber files for manufacturing.
 *
 * Each step has:
 *  - targetView: which ViewMode to navigate to
 *  - instruction: user-facing guidance text
 *  - validationFn: function that checks whether the step is complete
 *  - tips: contextual help for beginners
 *
 * The tutorial integrates with the existing TutorialSystem for progress
 * persistence and the TutorialContext for view navigation.
 */

import type { ViewMode } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PcbTutorialStepStatus = 'locked' | 'active' | 'completed' | 'skipped';

/**
 * Validation context passed to each step's validation function.
 * Mirrors real project state so steps can check actual progress.
 */
export interface PcbValidationContext {
  /** Number of circuit designs in the project */
  circuitDesignCount: number;
  /** Number of component instances placed on the schematic */
  schematicInstanceCount: number;
  /** Number of wires drawn on the schematic */
  wireCount: number;
  /** Number of component instances with a footprint/package assigned */
  footprintAssignedCount: number;
  /** Number of components placed on the PCB board */
  pcbPlacedCount: number;
  /** Number of routed traces on the PCB */
  routedTraceCount: number;
  /** Number of DRC violations (0 = clean) */
  drcViolationCount: number;
  /** Whether DRC has been run at least once */
  drcHasRun: boolean;
  /** Whether a Gerber export has been triggered */
  gerberExported: boolean;
  /** Number of nets defined */
  netCount: number;
}

export interface PcbTutorialStep {
  /** Unique step identifier */
  id: string;
  /** Step number (1-based, for display) */
  stepNumber: number;
  /** Human-readable step title */
  title: string;
  /** Detailed instruction text shown to the user */
  instruction: string;
  /** Which view this step operates in */
  targetView: ViewMode;
  /** CSS selector for the element to highlight (optional) */
  targetSelector?: string;
  /** data-testid value for the element to highlight (optional) */
  targetTestId?: string;
  /** Tooltip position relative to target */
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Whether the user can skip this step */
  canSkip: boolean;
  /** Validation function — returns true when the step is considered complete */
  validationFn: (ctx: PcbValidationContext) => boolean;
  /** Helpful tips for beginners */
  tips: string[];
  /** Short summary shown in the progress sidebar */
  summary: string;
}

export interface PcbTutorialState {
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** Status of each step by step id */
  stepStatuses: Record<string, PcbTutorialStepStatus>;
  /** When the tutorial was started (epoch ms) */
  startedAt: number | null;
  /** When the tutorial was completed (epoch ms) */
  completedAt: number | null;
  /** Whether the tutorial is currently active */
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-pcb-tutorial-state';

export const PCB_TUTORIAL_ID = 'first-pcb';
export const PCB_TUTORIAL_TITLE = 'Your First PCB';
export const PCB_TUTORIAL_DESCRIPTION =
  'A step-by-step walkthrough from empty canvas to manufacturing-ready Gerber files. ' +
  'Learn how to create a circuit, place components, wire them up, assign footprints, ' +
  'lay out the PCB, route traces, run DRC, and export for fabrication.';
export const PCB_TUTORIAL_ESTIMATED_MINUTES = 15;

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export const PCB_TUTORIAL_STEPS: PcbTutorialStep[] = [
  {
    id: 'pcb-create-circuit',
    stepNumber: 1,
    title: 'Create a Circuit Design',
    instruction:
      'Every PCB starts with a schematic. Switch to the Schematic view and create a new circuit design. ' +
      'This is where you will define the electrical connections between your components.',
    targetView: 'schematic',
    targetTestId: 'tab-schematic',
    position: 'bottom',
    canSkip: false,
    validationFn: (ctx) => ctx.circuitDesignCount > 0,
    tips: [
      'A circuit design is the electrical blueprint for your PCB.',
      'You can have multiple circuit designs in a single project.',
    ],
    summary: 'Create a new circuit design',
  },
  {
    id: 'pcb-add-components',
    stepNumber: 2,
    title: 'Add Components to the Schematic',
    instruction:
      'Browse the component library in the sidebar and add at least 2 components to your schematic. ' +
      'Start with basics like resistors, capacitors, or an LED. Each component represents a real ' +
      'physical part that will go on your PCB.',
    targetView: 'schematic',
    targetTestId: 'sidebar-component-library',
    position: 'right',
    canSkip: false,
    validationFn: (ctx) => ctx.schematicInstanceCount >= 2,
    tips: [
      'Click a component in the library to place it on the canvas.',
      'Common starter circuits: LED + resistor, voltage divider, RC filter.',
      'You can also ask the AI to add components for you.',
    ],
    summary: 'Place 2+ components on schematic',
  },
  {
    id: 'pcb-wire-schematic',
    stepNumber: 3,
    title: 'Wire the Schematic',
    instruction:
      'Connect your components with wires. Press W to activate the wire tool, then click on a ' +
      'component pin to start a wire and click on another pin to complete the connection. ' +
      'Make sure you have at least one complete connection.',
    targetView: 'schematic',
    targetTestId: 'schematic-canvas',
    position: 'top',
    canSkip: false,
    validationFn: (ctx) => ctx.wireCount >= 1,
    tips: [
      'Press W to toggle the wire tool on and off.',
      'Wires define the electrical connections (nets) between components.',
      'Every pin should be connected to something — floating pins cause DRC errors.',
    ],
    summary: 'Draw wires between components',
  },
  {
    id: 'pcb-assign-nets',
    stepNumber: 4,
    title: 'Name Your Nets',
    instruction:
      'Give meaningful names to your nets like VCC, GND, or SIG_OUT. Named nets make the schematic ' +
      'easier to read and help during PCB layout. Open the net panel to see and rename your nets.',
    targetView: 'schematic',
    targetTestId: 'net-panel',
    position: 'left',
    canSkip: true,
    validationFn: (ctx) => ctx.netCount >= 1,
    tips: [
      'Common net names: VCC (power), GND (ground), SDA/SCL (I2C), MOSI/MISO/SCK (SPI).',
      'Net names carry over to the PCB layout — good names save time later.',
    ],
    summary: 'Name nets (VCC, GND, etc.)',
  },
  {
    id: 'pcb-assign-footprints',
    stepNumber: 5,
    title: 'Assign Footprints',
    instruction:
      'Each schematic symbol needs a physical footprint — the pad pattern that gets manufactured on ' +
      'the PCB. Select a component and assign a footprint package (e.g., 0805 for a resistor, ' +
      'SOT-23 for a transistor). At least one component needs a footprint to proceed.',
    targetView: 'schematic',
    position: 'center',
    canSkip: false,
    validationFn: (ctx) => ctx.footprintAssignedCount >= 1,
    tips: [
      'Common SMD sizes: 0402 (tiny), 0603, 0805 (good for hand soldering), 1206 (large).',
      'Through-hole (THT) parts use DIP, TO-220, or axial/radial packages.',
      'When in doubt, use 0805 for passives — it is the easiest to hand-solder.',
    ],
    summary: 'Assign physical footprints',
  },
  {
    id: 'pcb-switch-to-layout',
    stepNumber: 6,
    title: 'Switch to PCB Layout',
    instruction:
      'Now switch to the PCB Layout view. Your components should appear as footprints ready to be ' +
      'placed on the board. The thin lines connecting pads are ratsnest lines — they show which ' +
      'pads need to be connected by traces.',
    targetView: 'pcb',
    targetTestId: 'tab-pcb',
    position: 'bottom',
    canSkip: false,
    validationFn: (_ctx) => true, // Just viewing the PCB is enough
    tips: [
      'Ratsnest lines (thin blue/white lines) show unrouted connections.',
      'The board outline (yellow) defines the physical shape of your PCB.',
      'You can resize the board by dragging its corners.',
    ],
    summary: 'Open the PCB layout view',
  },
  {
    id: 'pcb-place-components',
    stepNumber: 7,
    title: 'Place Components on the Board',
    instruction:
      'Arrange your components on the PCB board. Drag them to position, press R to rotate 90 degrees. ' +
      'Keep related components close together and leave room for traces. Place at least one component ' +
      'inside the board outline.',
    targetView: 'pcb',
    targetTestId: 'pcb-canvas',
    position: 'top',
    canSkip: false,
    validationFn: (ctx) => ctx.pcbPlacedCount >= 1,
    tips: [
      'Place decoupling capacitors close to IC power pins.',
      'Keep high-frequency components close together to minimize trace length.',
      'Press R to rotate a selected component by 90 degrees.',
      'Leave at least 1mm clearance from the board edge.',
    ],
    summary: 'Arrange components on the board',
  },
  {
    id: 'pcb-route-traces',
    stepNumber: 8,
    title: 'Route Traces',
    instruction:
      'Route copper traces to connect the pads. Click a pad to start routing, follow the ratsnest ' +
      'lines, and click the destination pad to finish. Try to keep traces short and avoid sharp angles. ' +
      'Route at least one trace.',
    targetView: 'pcb',
    targetTestId: 'pcb-canvas',
    position: 'top',
    canSkip: false,
    validationFn: (ctx) => ctx.routedTraceCount >= 1,
    tips: [
      'Use 45-degree angles instead of 90-degree corners — better for signal integrity.',
      'Power traces (VCC, GND) should be wider than signal traces.',
      'You can use the autorouter for simple boards.',
      'Press Escape to cancel an in-progress trace.',
    ],
    summary: 'Route copper traces',
  },
  {
    id: 'pcb-run-drc',
    stepNumber: 9,
    title: 'Run Design Rule Check (DRC)',
    instruction:
      'Run a DRC to catch manufacturing issues: clearance violations, unconnected nets, trace width ' +
      'problems, and more. Fix any violations before exporting. A clean DRC is essential for a ' +
      'successful PCB.',
    targetView: 'validation',
    targetTestId: 'tab-validation',
    position: 'bottom',
    canSkip: false,
    validationFn: (ctx) => ctx.drcHasRun && ctx.drcViolationCount === 0,
    tips: [
      'Common DRC errors: clearance too small, unrouted nets, trace too narrow.',
      'Most PCB fabs require minimum 6mil (0.15mm) clearance and 6mil trace width.',
      'Fix violations by moving components or rerouting traces.',
      'A clean DRC (0 violations) means your board is ready for manufacturing.',
    ],
    summary: 'Pass DRC with zero violations',
  },
  {
    id: 'pcb-export-gerber',
    stepNumber: 10,
    title: 'Export Gerber Files',
    instruction:
      'Congratulations — your PCB design is ready! Export Gerber files, which are the industry-standard ' +
      'format that PCB fabrication houses (JLCPCB, PCBWay, OSHPark) use to manufacture your board. ' +
      'Go to the Output view and click the Gerber export button.',
    targetView: 'output',
    targetTestId: 'tab-output',
    position: 'bottom',
    canSkip: false,
    validationFn: (ctx) => ctx.gerberExported,
    tips: [
      'Gerber files define each copper layer, solder mask, silkscreen, and drill pattern.',
      'Most fabs accept a ZIP file containing all Gerber layers.',
      'Upload your Gerbers to a fab house website to get a price quote.',
      'You can also export to KiCad format for further editing in KiCad.',
    ],
    summary: 'Export Gerber manufacturing files',
  },
];

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

function createInitialStepStatuses(): Record<string, PcbTutorialStepStatus> {
  const statuses: Record<string, PcbTutorialStepStatus> = {};
  for (const step of PCB_TUTORIAL_STEPS) {
    statuses[step.id] = step.stepNumber === 1 ? 'active' : 'locked';
  }
  return statuses;
}

export function createInitialState(): PcbTutorialState {
  return {
    currentStepIndex: 0,
    stepStatuses: createInitialStepStatuses(),
    startedAt: null,
    completedAt: null,
    isActive: false,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function loadPcbTutorialState(): PcbTutorialState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && 'currentStepIndex' in parsed) {
        return parsed as PcbTutorialState;
      }
    }
  } catch {
    // Corrupted — start fresh
  }
  return createInitialState();
}

export function savePcbTutorialState(state: PcbTutorialState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable
  }
}

export function clearPcbTutorialState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// State Transitions
// ---------------------------------------------------------------------------

export type PcbTutorialAction =
  | { type: 'START' }
  | { type: 'COMPLETE_STEP'; stepId: string }
  | { type: 'SKIP_STEP'; stepId: string }
  | { type: 'GO_TO_STEP'; stepIndex: number }
  | { type: 'VALIDATE_STEP'; stepId: string; ctx: PcbValidationContext }
  | { type: 'QUIT' }
  | { type: 'RESET' };

export function pcbTutorialReducer(state: PcbTutorialState, action: PcbTutorialAction): PcbTutorialState {
  switch (action.type) {
    case 'START': {
      const initial = createInitialState();
      return {
        ...initial,
        isActive: true,
        startedAt: Date.now(),
      };
    }

    case 'COMPLETE_STEP': {
      const stepIndex = PCB_TUTORIAL_STEPS.findIndex((s) => s.id === action.stepId);
      if (stepIndex === -1) {
        return state;
      }

      const newStatuses = { ...state.stepStatuses, [action.stepId]: 'completed' as const };

      // Unlock next step if it exists
      const nextStep = PCB_TUTORIAL_STEPS[stepIndex + 1];
      if (nextStep && newStatuses[nextStep.id] === 'locked') {
        newStatuses[nextStep.id] = 'active';
      }

      const allCompleted = PCB_TUTORIAL_STEPS.every((s) => newStatuses[s.id] === 'completed' || newStatuses[s.id] === 'skipped');
      const newIndex = nextStep ? stepIndex + 1 : state.currentStepIndex;

      return {
        ...state,
        currentStepIndex: newIndex,
        stepStatuses: newStatuses,
        completedAt: allCompleted ? Date.now() : null,
        isActive: !allCompleted,
      };
    }

    case 'SKIP_STEP': {
      const step = PCB_TUTORIAL_STEPS.find((s) => s.id === action.stepId);
      if (!step || !step.canSkip) {
        return state;
      }

      const stepIndex = PCB_TUTORIAL_STEPS.indexOf(step);
      const newStatuses = { ...state.stepStatuses, [action.stepId]: 'skipped' as const };

      const nextStep = PCB_TUTORIAL_STEPS[stepIndex + 1];
      if (nextStep && newStatuses[nextStep.id] === 'locked') {
        newStatuses[nextStep.id] = 'active';
      }

      const allDone = PCB_TUTORIAL_STEPS.every((s) => newStatuses[s.id] === 'completed' || newStatuses[s.id] === 'skipped');
      const newIndex = nextStep ? stepIndex + 1 : state.currentStepIndex;

      return {
        ...state,
        currentStepIndex: newIndex,
        stepStatuses: newStatuses,
        completedAt: allDone ? Date.now() : null,
        isActive: !allDone,
      };
    }

    case 'GO_TO_STEP': {
      if (action.stepIndex < 0 || action.stepIndex >= PCB_TUTORIAL_STEPS.length) {
        return state;
      }
      const targetStep = PCB_TUTORIAL_STEPS[action.stepIndex];
      const status = state.stepStatuses[targetStep.id];
      // Can only go to active, completed, or skipped steps (not locked)
      if (status === 'locked') {
        return state;
      }
      return { ...state, currentStepIndex: action.stepIndex };
    }

    case 'VALIDATE_STEP': {
      const step = PCB_TUTORIAL_STEPS.find((s) => s.id === action.stepId);
      if (!step) {
        return state;
      }
      if (step.validationFn(action.ctx)) {
        return pcbTutorialReducer(state, { type: 'COMPLETE_STEP', stepId: action.stepId });
      }
      return state;
    }

    case 'QUIT': {
      return { ...state, isActive: false };
    }

    case 'RESET': {
      clearPcbTutorialState();
      return createInitialState();
    }

    default: {
      return state;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the current step definition (or null if index is out of range). */
export function getCurrentStep(state: PcbTutorialState): PcbTutorialStep | null {
  return PCB_TUTORIAL_STEPS[state.currentStepIndex] ?? null;
}

/** Count how many steps have been completed. */
export function getCompletedCount(state: PcbTutorialState): number {
  return PCB_TUTORIAL_STEPS.filter((s) => state.stepStatuses[s.id] === 'completed').length;
}

/** Count how many steps have been completed or skipped. */
export function getProgressCount(state: PcbTutorialState): number {
  return PCB_TUTORIAL_STEPS.filter(
    (s) => state.stepStatuses[s.id] === 'completed' || state.stepStatuses[s.id] === 'skipped',
  ).length;
}

/** Get progress as a percentage (0-100). */
export function getProgressPercent(state: PcbTutorialState): number {
  if (PCB_TUTORIAL_STEPS.length === 0) {
    return 0;
  }
  return Math.round((getProgressCount(state) / PCB_TUTORIAL_STEPS.length) * 100);
}

/** Check if the tutorial is fully complete. */
export function isTutorialComplete(state: PcbTutorialState): boolean {
  return PCB_TUTORIAL_STEPS.every(
    (s) => state.stepStatuses[s.id] === 'completed' || state.stepStatuses[s.id] === 'skipped',
  );
}

/** Get the step status for a given step ID. */
export function getStepStatus(state: PcbTutorialState, stepId: string): PcbTutorialStepStatus {
  return state.stepStatuses[stepId] ?? 'locked';
}

/**
 * Build a validation context from raw project data.
 * This is a convenience factory for components that want to call VALIDATE_STEP.
 */
export function buildValidationContext(data: Partial<PcbValidationContext>): PcbValidationContext {
  return {
    circuitDesignCount: data.circuitDesignCount ?? 0,
    schematicInstanceCount: data.schematicInstanceCount ?? 0,
    wireCount: data.wireCount ?? 0,
    footprintAssignedCount: data.footprintAssignedCount ?? 0,
    pcbPlacedCount: data.pcbPlacedCount ?? 0,
    routedTraceCount: data.routedTraceCount ?? 0,
    drcViolationCount: data.drcViolationCount ?? 0,
    drcHasRun: data.drcHasRun ?? false,
    gerberExported: data.gerberExported ?? false,
    netCount: data.netCount ?? 0,
  };
}
