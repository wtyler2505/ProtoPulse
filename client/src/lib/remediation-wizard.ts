/**
 * Remediation Wizard — step-by-step guided fixes for DRC/ERC violations.
 *
 * Each recipe maps a violation rule type to a sequence of human-readable steps,
 * an explanation of why the violation matters, and metadata about difficulty
 * and the view where the fix should be applied.
 *
 * BL-0253
 */

import type { DRCRuleType, PcbDrcRuleType } from '@shared/component-types';
import type { ERCRuleType } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RemediationDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type RemediationCategory = 'drc' | 'erc' | 'arch';

export interface RemediationStep {
  /** One-indexed step number (for display). */
  number: number;
  /** Short imperative instruction (e.g. "Select the two overlapping pads"). */
  instruction: string;
  /** Optional longer explanation for learners. */
  detail?: string;
  /** If true, this step is a verification / check — not an editing action. */
  isVerification?: boolean;
}

export interface RemediationRecipe {
  /** Stable identifier — matches the DRC/ERC rule type or a custom key. */
  id: string;
  /** Human-friendly title shown in the wizard header. */
  title: string;
  /** Plain-English explanation of why this violation matters. */
  whyItMatters: string;
  /** Ordered steps to resolve the violation. */
  steps: RemediationStep[];
  /** Estimated difficulty for the maker. */
  difficulty: RemediationDifficulty;
  /** Which editor view the user should navigate to. */
  targetView: 'component_editor' | 'schematic' | 'pcb' | 'architecture' | 'breadboard';
  /** Category of the violation. */
  category: RemediationCategory;
  /** Optional: keywords for searching recipes. */
  tags?: string[];
}

export interface WizardState {
  /** The recipe being followed. */
  recipe: RemediationRecipe;
  /** Index of the current step (0-based). */
  currentStep: number;
  /** IDs of steps the user has manually marked as done. */
  completedSteps: Set<number>;
  /** Original violation message (for context). */
  violationMessage: string;
  /** Original violation ID. */
  violationId: string;
}

// ---------------------------------------------------------------------------
// Recipe registry
// ---------------------------------------------------------------------------

const RECIPES: RemediationRecipe[] = [
  // ---- DRC recipes ----
  {
    id: 'min-clearance',
    title: 'Fix Minimum Clearance Violation',
    whyItMatters:
      'Components or copper features are too close together. This can cause solder bridges, short circuits, or manufacturing defects. Increasing the gap ensures reliable fabrication and safe operation.',
    steps: [
      { number: 1, instruction: 'Identify the two shapes flagged in the violation.', detail: 'Look at the violation message — it names the overlapping elements and their current distance.' },
      { number: 2, instruction: 'Select one of the offending shapes in the editor.' },
      { number: 3, instruction: 'Move it away from the other shape until the distance meets the minimum clearance rule.', detail: 'The required clearance is shown in the DRC rule settings. A typical minimum is 0.2 mm (8 mil) for standard PCB fabs.' },
      { number: 4, instruction: 'Re-run DRC to confirm the violation is resolved.', isVerification: true },
    ],
    difficulty: 'beginner',
    targetView: 'component_editor',
    category: 'drc',
    tags: ['clearance', 'spacing', 'short'],
  },
  {
    id: 'courtyard-overlap',
    title: 'Fix Courtyard Overlap',
    whyItMatters:
      'Two component outlines overlap, meaning they would physically collide on the real board. Components need enough room for their bodies and for soldering tools to reach their pads.',
    steps: [
      { number: 1, instruction: 'Identify the two components whose courtyards overlap.', detail: 'The violation message names both components. Courtyards represent the full physical footprint including clearance around the body.' },
      { number: 2, instruction: 'Select one component and check its courtyard dimensions.' },
      { number: 3, instruction: 'Move the component to a position where its courtyard does not intersect the other.', detail: 'If space is very tight, consider switching to a smaller package variant (e.g. 0402 instead of 0603).' },
      { number: 4, instruction: 'Verify neither component overlaps any other courtyard.', isVerification: true },
      { number: 5, instruction: 'Re-run DRC to confirm the violation is cleared.', isVerification: true },
    ],
    difficulty: 'beginner',
    targetView: 'component_editor',
    category: 'drc',
    tags: ['overlap', 'courtyard', 'placement'],
  },
  {
    id: 'min-trace-width',
    title: 'Fix Trace Width Violation',
    whyItMatters:
      'A trace is thinner than the manufacturing minimum or the width required for the current it carries. Thin traces can overheat, burn out, or be impossible for the factory to etch.',
    steps: [
      { number: 1, instruction: 'Locate the flagged trace in the PCB or schematic view.' },
      { number: 2, instruction: 'Check the required minimum width for this net class.', detail: 'Power nets typically need wider traces than signal nets. Check your net class rules in the DRC settings.' },
      { number: 3, instruction: 'Select the trace and increase its width to meet or exceed the minimum.', detail: 'Use a trace width calculator if the trace carries significant current (> 100 mA). A wider trace has lower resistance and dissipates less heat.' },
      { number: 4, instruction: 'Re-run DRC to confirm the violation is resolved.', isVerification: true },
    ],
    difficulty: 'intermediate',
    targetView: 'pcb',
    category: 'drc',
    tags: ['trace', 'width', 'current', 'manufacturing'],
  },
  {
    id: 'annular-ring',
    title: 'Fix Annular Ring Violation',
    whyItMatters:
      'The copper ring around a drill hole is too narrow. Manufacturing drill bits can drift slightly, and a thin ring may break the electrical connection entirely.',
    steps: [
      { number: 1, instruction: 'Identify the via or through-hole pad flagged in the violation.' },
      { number: 2, instruction: 'Select the pad and check its outer diameter and drill size.' },
      { number: 3, instruction: 'Increase the pad outer diameter to widen the annular ring.', detail: 'Annular ring = (pad diameter - drill diameter) / 2. Most fabs require at least 0.15 mm (6 mil). A safe default is 0.25 mm.' },
      { number: 4, instruction: 'If using a via, consider switching to a larger via size in your DRC rules.' },
      { number: 5, instruction: 'Re-run DRC to confirm.', isVerification: true },
    ],
    difficulty: 'intermediate',
    targetView: 'pcb',
    category: 'drc',
    tags: ['annular', 'ring', 'drill', 'pad', 'via'],
  },
  {
    id: 'silk-overlap',
    title: 'Fix Silkscreen Overlap',
    whyItMatters:
      'Silkscreen labels overlap each other or cover solder pads. Overlapping text is unreadable and ink on pads can prevent proper solder wetting.',
    steps: [
      { number: 1, instruction: 'Locate the overlapping silkscreen elements on the board.' },
      { number: 2, instruction: 'Select one of the overlapping labels and reposition it.', detail: 'Keep silkscreen text at least 0.15 mm away from exposed copper.' },
      { number: 3, instruction: 'If the text does not fit, reduce the font size or abbreviate the label.' },
      { number: 4, instruction: 'Ensure no silkscreen element covers a solder pad.', isVerification: true },
      { number: 5, instruction: 'Re-run DRC to confirm.', isVerification: true },
    ],
    difficulty: 'beginner',
    targetView: 'component_editor',
    category: 'drc',
    tags: ['silkscreen', 'label', 'overlap', 'readability'],
  },
  {
    id: 'via-in-pad',
    title: 'Fix Via-in-Pad Violation',
    whyItMatters:
      'A via placed directly in a solder pad lets solder wick down through the hole during reflow, creating an unreliable joint with insufficient solder on the surface.',
    steps: [
      { number: 1, instruction: 'Identify the via that sits inside a pad.', detail: 'The violation will reference the pad and the via by their IDs or coordinates.' },
      { number: 2, instruction: 'Move the via off the pad — connect it with a short trace instead.', detail: 'Even 0.5 mm of trace between the pad and via is enough to prevent solder wicking.' },
      { number: 3, instruction: 'If the via must stay in the pad (e.g. for thermal vias on QFN), mark it as "filled and capped" in your fab notes.', detail: 'Filled vias are plugged with epoxy and plated over — this is a premium fab service.' },
      { number: 4, instruction: 'Re-run DRC to confirm.', isVerification: true },
    ],
    difficulty: 'intermediate',
    targetView: 'pcb',
    category: 'drc',
    tags: ['via', 'pad', 'solder', 'wicking'],
  },
  {
    id: 'thermal-relief',
    title: 'Fix Missing Thermal Relief',
    whyItMatters:
      'Without thermal relief spokes, a pad connected to a large copper plane acts as a heat sink, making hand-soldering nearly impossible and machine soldering unreliable.',
    steps: [
      { number: 1, instruction: 'Find the pad flagged as missing thermal relief.' },
      { number: 2, instruction: 'Open the copper pour / zone settings for the plane connected to this pad.' },
      { number: 3, instruction: 'Enable thermal relief for the pad connection.', detail: 'Thermal reliefs add narrow spoke connections instead of a solid fill. Standard spoke width is 0.25 mm with 4 spokes.' },
      { number: 4, instruction: 'Re-run DRC to confirm.', isVerification: true },
    ],
    difficulty: 'intermediate',
    targetView: 'pcb',
    category: 'drc',
    tags: ['thermal', 'relief', 'soldering', 'ground plane'],
  },
  {
    id: 'pad-size',
    title: 'Fix Undersized Pad',
    whyItMatters:
      'A solder pad smaller than the IPC recommendation makes the solder joint weak, especially under vibration or thermal cycling. The component may fail in the field.',
    steps: [
      { number: 1, instruction: 'Identify the flagged pad and its associated component.' },
      { number: 2, instruction: 'Check the component datasheet for recommended pad dimensions.' },
      { number: 3, instruction: 'Increase the pad size to at least the IPC-7351 recommended footprint.', detail: 'IPC-7351 defines three density levels: Most (largest pads), Nominal, and Least. Choose "Most" for hand assembly or prototyping.' },
      { number: 4, instruction: 'Make sure the enlarged pad does not violate any clearance rules.', isVerification: true },
      { number: 5, instruction: 'Re-run DRC to confirm.', isVerification: true },
    ],
    difficulty: 'intermediate',
    targetView: 'component_editor',
    category: 'drc',
    tags: ['pad', 'size', 'footprint', 'IPC'],
  },

  // ---- ERC recipes ----
  {
    id: 'unconnected-pin',
    title: 'Fix Unconnected Pin',
    whyItMatters:
      'A pin that should be wired to a signal or power rail is left floating. The circuit will not function correctly because the signal path is broken.',
    steps: [
      { number: 1, instruction: 'Open the schematic view and locate the unconnected pin.', detail: 'The ERC message identifies the component instance and pin name.' },
      { number: 2, instruction: 'Determine where this pin should connect.', detail: 'Check the component datasheet for pin function. Power pins go to the appropriate rail; signal pins go to the corresponding net.' },
      { number: 3, instruction: 'Draw a wire from the pin to its destination net.' },
      { number: 4, instruction: 'If the pin is intentionally unused, add a "no-connect" marker.', detail: 'No-connect markers tell the ERC that the floating pin is deliberate.' },
      { number: 5, instruction: 'Re-run ERC to confirm the violation is cleared.', isVerification: true },
    ],
    difficulty: 'beginner',
    targetView: 'schematic',
    category: 'erc',
    tags: ['unconnected', 'pin', 'wire', 'floating'],
  },
  {
    id: 'floating-input',
    title: 'Fix Floating Input',
    whyItMatters:
      'An input pin without a defined voltage picks up electrical noise and causes unpredictable behavior — random oscillation, overheating, or garbage output.',
    steps: [
      { number: 1, instruction: 'Locate the floating input pin in the schematic.' },
      { number: 2, instruction: 'Decide whether this input should be driven by a signal or tied to a fixed voltage.' },
      { number: 3, instruction: 'If it needs a signal, wire it to the appropriate output or bus.' },
      { number: 4, instruction: 'If unused, tie it to VCC through a pull-up resistor, or to GND through a pull-down.', detail: 'Check the datasheet for the recommended idle state. CMOS inputs must never float — even momentarily.' },
      { number: 5, instruction: 'Re-run ERC to confirm.', isVerification: true },
    ],
    difficulty: 'beginner',
    targetView: 'schematic',
    category: 'erc',
    tags: ['floating', 'input', 'pull-up', 'pull-down', 'CMOS'],
  },
  {
    id: 'missing-bypass-cap',
    title: 'Add Missing Bypass Capacitor',
    whyItMatters:
      'Bypass (decoupling) capacitors filter high-frequency noise on the power supply. Without one, the IC may malfunction, reset randomly, or radiate electromagnetic interference.',
    steps: [
      { number: 1, instruction: 'Identify which IC is missing a bypass capacitor.', detail: 'The ERC message names the component. Every IC with a VCC/VDD pin needs at least one bypass cap.' },
      { number: 2, instruction: 'Add a 100 nF (0.1 uF) ceramic capacitor to the BOM.', detail: '100 nF is the standard bypass value for most digital ICs. Use an 0402 or 0603 package.' },
      { number: 3, instruction: 'Place the capacitor as close as possible to the IC power pin in the schematic and PCB.', detail: 'The shorter the trace between the cap and the pin, the more effective the bypassing. Ideally under 5 mm.' },
      { number: 4, instruction: 'Connect one side to VCC and the other to GND.' },
      { number: 5, instruction: 'For high-speed or sensitive ICs, add a second 10 uF cap nearby for bulk decoupling.', detail: 'The 100 nF handles high-frequency noise; the 10 uF handles lower-frequency transients.' },
      { number: 6, instruction: 'Re-run ERC to confirm.', isVerification: true },
    ],
    difficulty: 'beginner',
    targetView: 'schematic',
    category: 'erc',
    tags: ['bypass', 'decoupling', 'capacitor', 'noise'],
  },
  {
    id: 'driver-conflict',
    title: 'Fix Driver Conflict',
    whyItMatters:
      'Two or more outputs are driving the same net simultaneously. When one pushes high while the other pushes low, excessive current flows through both, potentially destroying the output stages.',
    steps: [
      { number: 1, instruction: 'Identify the conflicting output pins on the net.', detail: 'The ERC message identifies the net and the two (or more) driver pins.' },
      { number: 2, instruction: 'Decide which output should drive this net.' },
      { number: 3, instruction: 'Disconnect the other output(s) from the net.' },
      { number: 4, instruction: 'If both outputs must share the net, use tri-state buffers or an open-drain/open-collector configuration with a pull-up resistor.', detail: 'Open-drain outputs can safely share a net — only one actively pulls low, and the pull-up provides the high state.' },
      { number: 5, instruction: 'Re-run ERC to confirm.', isVerification: true },
    ],
    difficulty: 'advanced',
    targetView: 'schematic',
    category: 'erc',
    tags: ['driver', 'conflict', 'output', 'contention', 'tri-state'],
  },
  {
    id: 'shorted-power',
    title: 'Fix Shorted Power Rails',
    whyItMatters:
      'Two power rails with different voltages are connected. This creates a direct short circuit that will damage components or blow fuses the instant you power on.',
    steps: [
      { number: 1, instruction: 'Identify the two power nets that are incorrectly connected.', detail: 'The ERC message names both nets (e.g. 3V3 shorted to 5V).' },
      { number: 2, instruction: 'Trace the wiring to find where the nets merge.', detail: 'This is often a single misplaced wire or an incorrect pin assignment.' },
      { number: 3, instruction: 'Delete or reroute the offending wire so each power rail is independent.' },
      { number: 4, instruction: 'Verify each IC power pin connects only to its correct voltage rail.', isVerification: true },
      { number: 5, instruction: 'Re-run ERC to confirm.', isVerification: true },
    ],
    difficulty: 'intermediate',
    targetView: 'schematic',
    category: 'erc',
    tags: ['short', 'power', 'voltage', 'rail'],
  },

  // ---- PCB-level DRC recipes ----
  {
    id: 'trace_clearance',
    title: 'Fix Trace Clearance Violation',
    whyItMatters:
      'Two traces on different nets are too close. At small gaps, voltage differences can cause arcing, crosstalk, or signal integrity problems that are very hard to debug.',
    steps: [
      { number: 1, instruction: 'Locate the two traces flagged in the PCB view.' },
      { number: 2, instruction: 'Select one trace and re-route it to increase spacing.', detail: 'Check the net class clearance setting. Standard signal clearance is typically 0.15-0.2 mm (6-8 mil).' },
      { number: 3, instruction: 'If routing space is tight, consider moving nearby components to open up room.' },
      { number: 4, instruction: 'Re-run DRC to confirm.', isVerification: true },
    ],
    difficulty: 'intermediate',
    targetView: 'pcb',
    category: 'drc',
    tags: ['trace', 'clearance', 'spacing', 'crosstalk'],
  },
  {
    id: 'board_edge_clearance',
    title: 'Fix Board Edge Clearance',
    whyItMatters:
      'Copper features are too close to the board outline. Board edges are cut with routers or V-scores that can nick nearby copper, breaking traces or creating shorts.',
    steps: [
      { number: 1, instruction: 'Identify the trace or pad that is too close to the board edge.' },
      { number: 2, instruction: 'Move the component or re-route the trace at least 0.25 mm (10 mil) from the edge.', detail: 'Some fabs require even more — check your manufacturer\'s design rules for board edge clearance.' },
      { number: 3, instruction: 'If the board outline itself is wrong, adjust the board shape instead.' },
      { number: 4, instruction: 'Re-run DRC to confirm.', isVerification: true },
    ],
    difficulty: 'beginner',
    targetView: 'pcb',
    category: 'drc',
    tags: ['edge', 'board', 'outline', 'routing'],
  },
  {
    id: 'diff_pair_spacing',
    title: 'Fix Differential Pair Spacing',
    whyItMatters:
      'Differential pairs (USB, HDMI, Ethernet) rely on precise trace spacing to maintain controlled impedance. Incorrect spacing degrades signal quality and causes communication errors.',
    steps: [
      { number: 1, instruction: 'Identify the differential pair flagged in the violation.' },
      { number: 2, instruction: 'Check the required spacing for the signal protocol.', detail: 'USB 2.0 typically requires 90 ohm differential impedance. Your stackup and trace geometry determine the correct spacing — use an impedance calculator.' },
      { number: 3, instruction: 'Select both traces and adjust their spacing to match the required value.' },
      { number: 4, instruction: 'Ensure the spacing is consistent along the entire length — avoid pinch points.', isVerification: true },
      { number: 5, instruction: 'Match the trace lengths within the pair to avoid skew.', detail: 'Length mismatch should typically be under 5 mil for high-speed signals.' },
      { number: 6, instruction: 'Re-run DRC to confirm.', isVerification: true },
    ],
    difficulty: 'advanced',
    targetView: 'pcb',
    category: 'drc',
    tags: ['differential', 'pair', 'impedance', 'USB', 'HDMI'],
  },
];

// Index by rule type for O(1) lookup
const RECIPE_INDEX = new Map<string, RemediationRecipe>(RECIPES.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Look up a remediation recipe by its rule type ID. Returns undefined if no recipe exists. */
export function getRecipe(ruleType: string): RemediationRecipe | undefined {
  return RECIPE_INDEX.get(ruleType);
}

/** Check whether a remediation recipe exists for a given rule type. */
export function hasRecipe(ruleType: string): boolean {
  return RECIPE_INDEX.has(ruleType);
}

/** Get all available recipes (for browsing / learning mode). */
export function getAllRecipes(): readonly RemediationRecipe[] {
  return RECIPES;
}

/** Get recipes filtered by category. */
export function getRecipesByCategory(category: RemediationCategory): readonly RemediationRecipe[] {
  return RECIPES.filter((r) => r.category === category);
}

/** Get recipes filtered by difficulty. */
export function getRecipesByDifficulty(difficulty: RemediationDifficulty): readonly RemediationRecipe[] {
  return RECIPES.filter((r) => r.difficulty === difficulty);
}

/** Search recipes by keyword (matches title, tags, and whyItMatters). */
export function searchRecipes(query: string): readonly RemediationRecipe[] {
  const q = query.toLowerCase().trim();
  if (!q) { return RECIPES; }
  return RECIPES.filter((r) =>
    r.title.toLowerCase().includes(q) ||
    r.whyItMatters.toLowerCase().includes(q) ||
    r.tags?.some((t) => t.includes(q)),
  );
}

// ---------------------------------------------------------------------------
// Wizard state helpers
// ---------------------------------------------------------------------------

/** Create initial wizard state for a violation. */
export function createWizardState(recipe: RemediationRecipe, violationMessage: string, violationId: string): WizardState {
  return {
    recipe,
    currentStep: 0,
    completedSteps: new Set(),
    violationMessage,
    violationId,
  };
}

/** Advance to the next step. Returns null if already at the last step. */
export function nextStep(state: WizardState): WizardState | null {
  if (state.currentStep >= state.recipe.steps.length - 1) { return null; }
  const completedSteps = new Set(state.completedSteps);
  completedSteps.add(state.currentStep);
  return { ...state, currentStep: state.currentStep + 1, completedSteps };
}

/** Go back to the previous step. Returns null if already at step 0. */
export function prevStep(state: WizardState): WizardState | null {
  if (state.currentStep <= 0) { return null; }
  return { ...state, currentStep: state.currentStep - 1 };
}

/** Toggle a specific step's completion status. */
export function toggleStepComplete(state: WizardState, stepIndex: number): WizardState {
  const completedSteps = new Set(state.completedSteps);
  if (completedSteps.has(stepIndex)) {
    completedSteps.delete(stepIndex);
  } else {
    completedSteps.add(stepIndex);
  }
  return { ...state, completedSteps };
}

/** Jump to a specific step. */
export function goToStep(state: WizardState, stepIndex: number): WizardState | null {
  if (stepIndex < 0 || stepIndex >= state.recipe.steps.length) { return null; }
  return { ...state, currentStep: stepIndex };
}

/** Check whether all steps have been completed. */
export function isComplete(state: WizardState): boolean {
  return state.recipe.steps.every((_, i) => state.completedSteps.has(i));
}

/** Get a progress ratio (0 to 1). */
export function getProgress(state: WizardState): number {
  if (state.recipe.steps.length === 0) { return 1; }
  return state.completedSteps.size / state.recipe.steps.length;
}

/** Get the count of DRC rule types (not PCB) that have recipes. */
export function getDrcRecipeCount(): number {
  return RECIPES.filter((r) => r.category === 'drc').length;
}

/** Get the count of ERC rule types that have recipes. */
export function getErcRecipeCount(): number {
  return RECIPES.filter((r) => r.category === 'erc').length;
}
