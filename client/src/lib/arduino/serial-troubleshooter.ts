// ---------------------------------------------------------------------------
// Serial Troubleshooter — "No Data" Diagnostic Wizard Engine
// ---------------------------------------------------------------------------
// Context-aware step-by-step diagnostic engine for when no serial data
// is received after connecting. Guides the user through common issues
// from physical (USB cable) to firmware (Serial.begin / loop blocking).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Category of diagnostic step for grouping / iconography. */
export type DiagnosticCategory =
  | 'physical'
  | 'software'
  | 'firmware'
  | 'configuration';

/** Severity of a diagnostic step — determines ordering priority. */
export type DiagnosticSeverity = 'critical' | 'likely' | 'possible';

/** Result of a diagnostic step selected by the user. */
export type StepResult = 'pass' | 'fail' | 'skip';

/** A single diagnostic step. */
export interface DiagnosticStep {
  /** Unique identifier for this step. */
  readonly id: string;
  /** Short title shown in the wizard. */
  readonly title: string;
  /** Detailed instruction / question for the user. */
  readonly description: string;
  /** Category for grouping. */
  readonly category: DiagnosticCategory;
  /** How likely this is the root cause. */
  readonly severity: DiagnosticSeverity;
  /** Actionable fix suggestion shown when the user marks "fail". */
  readonly fixSuggestion: string;
  /** IDs of steps that, if they passed, make this step skippable. */
  readonly skipWhenPassed?: readonly string[];
  /** IDs of steps that must be resolved first. */
  readonly requiresBefore?: readonly string[];
}

/** Snapshot of a completed step in the wizard history. */
export interface StepOutcome {
  readonly stepId: string;
  readonly result: StepResult;
  readonly timestamp: number;
}

/** Context from the serial monitor state — used for smart skipping. */
export interface SerialContext {
  /** Whether the port is currently connected. */
  isConnected: boolean;
  /** Currently configured baud rate. */
  baudRate: number;
  /** Whether a baud mismatch was already detected & dismissed. */
  baudMismatchDismissed: boolean;
  /** Number of RX bytes received so far. */
  bytesReceived: number;
  /** Whether garbled (non-printable) data was received. */
  hasGarbledData: boolean;
  /** Board profile label selected in the serial monitor, if any. */
  selectedBoard?: string;
}

/** Summary diagnosis returned after completing all steps. */
export interface DiagnosisSummary {
  /** Steps that the user marked as failing — these are the likely causes. */
  readonly failedSteps: readonly DiagnosticStep[];
  /** Steps that passed. */
  readonly passedSteps: readonly DiagnosticStep[];
  /** Steps that were skipped. */
  readonly skippedSteps: readonly DiagnosticStep[];
  /** A single human-readable conclusion. */
  readonly conclusion: string;
  /** Whether we found at least one actionable failure. */
  readonly hasActionableFailure: boolean;
}

// ---------------------------------------------------------------------------
// Step Definitions (ordered by diagnostic priority)
// ---------------------------------------------------------------------------

export const DIAGNOSTIC_STEPS: readonly DiagnosticStep[] = [
  // --- Physical ---
  {
    id: 'usb-cable',
    title: 'USB Cable Check',
    description:
      'Is the USB cable firmly plugged in on both ends? Some USB cables are charge-only and cannot carry data. Try a different cable if you have one.',
    category: 'physical',
    severity: 'critical',
    fixSuggestion:
      'Try a different USB cable. Many cheap micro-USB cables are charge-only (no data wires). Look for a cable marked "data" or one that came with your board.',
  },
  {
    id: 'power-check',
    title: 'Board Power',
    description:
      'Is the board powered on? Look for a power LED (usually red or green) on the board.',
    category: 'physical',
    severity: 'critical',
    fixSuggestion:
      'If no LED is on, the board may not be receiving power. Try a different USB port (preferably directly on the computer, not through a hub). Check if the board needs external power.',
    requiresBefore: ['usb-cable'],
  },
  {
    id: 'cable-swap',
    title: 'Try Another Cable / Port',
    description:
      'Have you tried a different USB cable AND a different USB port on your computer? USB ports can fail silently, and many cables lack data lines.',
    category: 'physical',
    severity: 'likely',
    fixSuggestion:
      'Swap the cable for a known-good data cable and try a USB port directly on the motherboard (back panel on desktop, or a different port on laptop). Avoid USB hubs.',
    skipWhenPassed: ['usb-cable'],
  },

  // --- Software / Configuration ---
  {
    id: 'port-selection',
    title: 'Correct Port Selected',
    description:
      'When you clicked "Connect," did the browser show your board in the port picker dialog? On some systems, the board may appear as a different name (e.g., "USB Serial Device" or "CP2102").',
    category: 'software',
    severity: 'critical',
    fixSuggestion:
      'Disconnect, then click Connect again. Look for a port that appears/disappears when you plug/unplug the board. If no ports appear, you may need to install USB-to-serial drivers (CH340, CP210x, or FTDI depending on your board).',
    requiresBefore: ['usb-cable'],
  },
  {
    id: 'baud-rate',
    title: 'Baud Rate Match',
    description:
      'Does the baud rate in the Serial Monitor match what your sketch uses in Serial.begin()? The most common values are 9600 and 115200. If you see garbled characters, the baud rate is almost certainly wrong.',
    category: 'configuration',
    severity: 'critical',
    fixSuggestion:
      'Check your Arduino sketch for the Serial.begin() call and set the Serial Monitor to the same baud rate. For example, if your code says Serial.begin(9600), set the monitor to 9600.',
  },
  {
    id: 'board-selection',
    title: 'Board Profile',
    description:
      'Is the correct board type selected in the board profile dropdown? Selecting the wrong board can cause upload and communication failures.',
    category: 'configuration',
    severity: 'possible',
    fixSuggestion:
      'Select the board profile that matches your physical board, or use "Any device" if unsure. Common boards: Arduino Uno (ATmega16U2), ESP32 (CP2102 or Silicon Labs), etc.',
  },
  {
    id: 'drivers',
    title: 'USB Drivers Installed',
    description:
      'Does your operating system recognize the board? Check Device Manager (Windows), System Information (macOS), or `lsusb` (Linux) for the board. Common chips that need drivers: CH340/CH341, CP2102/CP2104, FTDI FT232.',
    category: 'software',
    severity: 'likely',
    fixSuggestion:
      'Install the correct driver for your board\'s USB chip. Search for "CH340 driver" (Chinese clone boards), "CP210x driver" (Silicon Labs / ESP32), or "FTDI driver" (some Arduinos). Restart after installing.',
    requiresBefore: ['port-selection'],
  },

  // --- Firmware ---
  {
    id: 'serial-begin',
    title: 'Serial.begin() in setup()',
    description:
      'Does your sketch call Serial.begin() in the setup() function? Without it, the serial port is never initialized and no data will be sent. Example: Serial.begin(115200);',
    category: 'firmware',
    severity: 'critical',
    fixSuggestion:
      'Add Serial.begin(115200); (or your desired baud rate) as the first line inside void setup() { }. Then re-upload your sketch.',
  },
  {
    id: 'serial-print',
    title: 'Serial.print() / println() Used',
    description:
      'Does your sketch actually call Serial.print(), Serial.println(), or Serial.write() somewhere? The board will not send data unless your code explicitly writes to the serial port.',
    category: 'firmware',
    severity: 'critical',
    fixSuggestion:
      'Add a Serial.println("Hello!"); inside your loop() function to confirm data is being sent. Re-upload the sketch after adding it.',
    requiresBefore: ['serial-begin'],
  },
  {
    id: 'infinite-loop',
    title: 'No Blocking Loop / Delay',
    description:
      'Is your code stuck in an infinite while-loop or an extremely long delay() before the Serial.print() call? A while(true){} or delay(999999) before your print statement will prevent output.',
    category: 'firmware',
    severity: 'likely',
    fixSuggestion:
      'Check for while loops that never exit, very long delay() calls, or blocking operations (like waiting for a sensor that is not connected) that happen before your Serial.print(). Try uploading a minimal "Hello World" sketch to confirm the board can communicate.',
    requiresBefore: ['serial-begin'],
  },
  {
    id: 'sketch-uploaded',
    title: 'Sketch Successfully Uploaded',
    description:
      'Was the sketch uploaded successfully? Did you see "Done uploading" in the Arduino IDE (or ProtoPulse compile output) without errors? A failed upload means the old sketch (or a blank one) is still running.',
    category: 'firmware',
    severity: 'likely',
    fixSuggestion:
      'Re-upload your sketch and watch for upload errors. Make sure you close the Serial Monitor before uploading (some boards cannot upload while the serial port is open). After uploading, re-open the Serial Monitor.',
  },

  // --- Last resort ---
  {
    id: 'arduino-ide-test',
    title: 'Test With Arduino IDE',
    description:
      'Can you receive data using the Arduino IDE\'s built-in Serial Monitor? This isolates whether the issue is with the board/firmware or with ProtoPulse\'s serial connection.',
    category: 'software',
    severity: 'possible',
    fixSuggestion:
      'Open the Arduino IDE, select your board and port, open Tools > Serial Monitor, and set the same baud rate. If data appears there but not here, please report a bug in ProtoPulse. If no data there either, the issue is with your board or sketch.',
  },
  {
    id: 'board-reset',
    title: 'Manual Board Reset',
    description:
      'Try pressing the physical reset button on your board (small button near the USB connector). Some boards need a manual reset after the serial port is opened.',
    category: 'physical',
    severity: 'possible',
    fixSuggestion:
      'Press the reset button on the board while the Serial Monitor is open. You should see the board restart and any setup() messages should appear. If your board has no reset button, briefly unplug and re-plug the USB cable.',
  },
] as const;

// ---------------------------------------------------------------------------
// Wizard State Machine
// ---------------------------------------------------------------------------

export type WizardPhase = 'idle' | 'running' | 'complete';

export interface WizardState {
  /** Current phase of the wizard. */
  readonly phase: WizardPhase;
  /** Index of the current step in the filtered step list. */
  readonly currentStepIndex: number;
  /** Ordered list of step IDs to present (after context-aware filtering). */
  readonly stepOrder: readonly string[];
  /** Results for each completed step. */
  readonly outcomes: readonly StepOutcome[];
}

/**
 * Create the initial wizard state, filtering and ordering steps
 * based on the current serial context.
 */
export function createWizardState(context: SerialContext): WizardState {
  const stepOrder = buildStepOrder(context);
  return {
    phase: 'idle',
    currentStepIndex: 0,
    stepOrder,
    outcomes: [],
  };
}

/**
 * Start the wizard (transition from idle to running).
 */
export function startWizard(state: WizardState): WizardState {
  if (state.phase !== 'idle') {
    return state;
  }
  return { ...state, phase: 'running' };
}

/**
 * Record the result for the current step and advance to the next.
 * Automatically skips subsequent steps whose `skipWhenPassed` conditions
 * are now met.
 */
export function advanceStep(
  state: WizardState,
  result: StepResult,
): WizardState {
  if (state.phase !== 'running') {
    return state;
  }

  const currentStepId = state.stepOrder[state.currentStepIndex];
  if (!currentStepId) {
    return { ...state, phase: 'complete' };
  }

  const outcome: StepOutcome = {
    stepId: currentStepId,
    result,
    timestamp: Date.now(),
  };
  const outcomes = [...state.outcomes, outcome];

  // Find the next non-skippable step
  let nextIndex = state.currentStepIndex + 1;
  const passedIds = new Set(
    outcomes.filter((o) => o.result === 'pass').map((o) => o.stepId),
  );

  while (nextIndex < state.stepOrder.length) {
    const nextStepId = state.stepOrder[nextIndex];
    const nextStep = getStepById(nextStepId);
    if (nextStep && shouldAutoSkip(nextStep, passedIds)) {
      outcomes.push({
        stepId: nextStepId,
        result: 'skip',
        timestamp: Date.now(),
      });
      nextIndex++;
    } else {
      break;
    }
  }

  const phase: WizardPhase =
    nextIndex >= state.stepOrder.length ? 'complete' : 'running';

  return {
    ...state,
    phase,
    currentStepIndex: nextIndex,
    outcomes,
  };
}

/**
 * Reset the wizard back to idle with a fresh step order.
 */
export function resetWizard(context: SerialContext): WizardState {
  return createWizardState(context);
}

// ---------------------------------------------------------------------------
// Step Lookup
// ---------------------------------------------------------------------------

const STEP_MAP = new Map<string, DiagnosticStep>(
  DIAGNOSTIC_STEPS.map((s) => [s.id, s]),
);

/**
 * Look up a diagnostic step by its ID.
 */
export function getStepById(id: string): DiagnosticStep | undefined {
  return STEP_MAP.get(id);
}

/**
 * Get the current step for the wizard state.
 */
export function getCurrentStep(state: WizardState): DiagnosticStep | undefined {
  const id = state.stepOrder[state.currentStepIndex];
  if (!id) {
    return undefined;
  }
  return getStepById(id);
}

// ---------------------------------------------------------------------------
// Diagnosis Summary
// ---------------------------------------------------------------------------

/**
 * Build a summary of the wizard results after completion.
 */
export function buildDiagnosisSummary(state: WizardState): DiagnosisSummary {
  const failedSteps: DiagnosticStep[] = [];
  const passedSteps: DiagnosticStep[] = [];
  const skippedSteps: DiagnosticStep[] = [];

  for (const outcome of state.outcomes) {
    const step = getStepById(outcome.stepId);
    if (!step) {
      continue;
    }
    switch (outcome.result) {
      case 'fail':
        failedSteps.push(step);
        break;
      case 'pass':
        passedSteps.push(step);
        break;
      case 'skip':
        skippedSteps.push(step);
        break;
    }
  }

  let conclusion: string;
  if (failedSteps.length === 0) {
    conclusion =
      'All checks passed or were skipped. The issue may be intermittent or related to timing. Try resetting the board and reconnecting.';
  } else if (failedSteps.length === 1) {
    const step = failedSteps[0];
    conclusion = `Most likely cause: ${step.title}. ${step.fixSuggestion}`;
  } else {
    const titles = failedSteps.map((s) => s.title).join(', ');
    conclusion = `Multiple issues found: ${titles}. Start by fixing the first failure and re-test.`;
  }

  return {
    failedSteps,
    passedSteps,
    skippedSteps,
    conclusion,
    hasActionableFailure: failedSteps.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Context-Aware Step Ordering & Filtering
// ---------------------------------------------------------------------------

/**
 * Build the ordered list of step IDs based on the serial context.
 * Steps are filtered (some are auto-skipped if context provides the answer)
 * and ordered by severity (critical first, then likely, then possible).
 */
export function buildStepOrder(context: SerialContext): string[] {
  const steps = [...DIAGNOSTIC_STEPS];

  // Filter out steps that are irrelevant given the context
  const filtered = steps.filter((step) => {
    // If we already received bytes, USB cable & power are obviously fine
    if (
      context.bytesReceived > 0 &&
      (step.id === 'usb-cable' || step.id === 'power-check' || step.id === 'cable-swap')
    ) {
      return false;
    }

    // If garbled data was received, baud rate is the #1 suspect —
    // skip physical checks and focus on configuration
    if (
      context.hasGarbledData &&
      (step.id === 'usb-cable' ||
        step.id === 'power-check' ||
        step.id === 'cable-swap' ||
        step.id === 'drivers' ||
        step.id === 'port-selection')
    ) {
      return false;
    }

    // If baud mismatch was already detected & dismissed, skip baud-rate step
    if (context.baudMismatchDismissed && step.id === 'baud-rate') {
      return false;
    }

    // If a board profile is selected, skip the board-selection step
    if (context.selectedBoard && step.id === 'board-selection') {
      return false;
    }

    return true;
  });

  // Sort by severity: critical > likely > possible
  const severityOrder: Record<DiagnosticSeverity, number> = {
    critical: 0,
    likely: 1,
    possible: 2,
  };

  // Stable sort: within the same severity, preserve original definition order
  filtered.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return filtered.map((s) => s.id);
}

/**
 * Determine if a step should be auto-skipped based on which
 * previous steps have passed.
 */
function shouldAutoSkip(
  step: DiagnosticStep,
  passedStepIds: Set<string>,
): boolean {
  if (!step.skipWhenPassed || step.skipWhenPassed.length === 0) {
    return false;
  }
  return step.skipWhenPassed.every((id) => passedStepIds.has(id));
}

// ---------------------------------------------------------------------------
// Progress Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the wizard's progress as a fraction (0.0 – 1.0).
 */
export function getProgress(state: WizardState): number {
  if (state.stepOrder.length === 0) {
    return 1;
  }
  return state.outcomes.length / state.stepOrder.length;
}

/**
 * Get the count of steps remaining (not yet answered).
 */
export function getStepsRemaining(state: WizardState): number {
  return state.stepOrder.length - state.outcomes.length;
}
