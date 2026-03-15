/**
 * Tutorial Navigation Helpers
 *
 * Maps tutorial steps to their target ViewMode and CSS selector,
 * provides element highlighting with automatic cleanup,
 * and derives navigation targets from tutorial step metadata.
 */

import type { ViewMode } from '@/lib/project-context';
import type { TutorialStep } from '@/lib/tutorials';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TutorialTarget {
  view: ViewMode;
  elementSelector?: string;
  highlightDuration?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIGHLIGHT_CLASS = 'tutorial-highlight';
const DEFAULT_HIGHLIGHT_DURATION = 3000;

/**
 * Map from `viewRequired` string values used in tutorial steps
 * to the actual ViewMode union values. These are identical for
 * the existing tutorials, but having an explicit map ensures we
 * only produce valid ViewMode values.
 */
const VIEW_REQUIRED_TO_VIEW_MODE: Record<string, ViewMode> = {
  architecture: 'architecture',
  schematic: 'schematic',
  breadboard: 'breadboard',
  pcb: 'pcb',
  simulation: 'simulation',
  validation: 'validation',
  output: 'output',
  procurement: 'procurement',
  dashboard: 'dashboard',
  component_editor: 'component_editor',
  design_history: 'design_history',
  calculators: 'calculators',
  design_patterns: 'design_patterns',
  storage: 'storage',
  kanban: 'kanban',
  knowledge: 'knowledge',
  viewer_3d: 'viewer_3d',
  community: 'community',
  ordering: 'ordering',
  serial_monitor: 'serial_monitor',
  circuit_code: 'circuit_code',
  generative_design: 'generative_design',
  digital_twin: 'digital_twin',
  arduino: 'arduino',
  starter_circuits: 'starter_circuits',
  audit_trail: 'audit_trail',
  project_explorer: 'project_explorer',
  lifecycle: 'lifecycle',
  comments: 'comments',
};

/**
 * Fallback view inference from tab-related targetSelectors.
 * When a step doesn't have an explicit `viewRequired`, we try to infer the
 * target view from the tab selector it references.
 */
const TAB_SELECTOR_TO_VIEW: Record<string, ViewMode> = {
  '[data-testid="tab-architecture"]': 'architecture',
  '[data-testid="tab-schematic"]': 'schematic',
  '[data-testid="tab-breadboard"]': 'breadboard',
  '[data-testid="tab-pcb"]': 'pcb',
  '[data-testid="tab-validation"]': 'validation',
  '[data-testid="tab-output"]': 'output',
  '[data-testid="tab-procurement"]': 'procurement',
  '[data-testid="tab-simulation"]': 'simulation',
  '[data-testid="tab-dashboard"]': 'dashboard',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derives a TutorialTarget from a TutorialStep.
 *
 * Resolution order:
 * 1. If the step has `viewRequired`, map it to ViewMode
 * 2. If the step has a tab targetSelector, infer the view from it
 * 3. Return null if no view can be determined
 */
export function getTutorialTarget(step: TutorialStep): TutorialTarget | null {
  let view: ViewMode | undefined;

  // 1. Explicit viewRequired
  if (step.viewRequired) {
    view = VIEW_REQUIRED_TO_VIEW_MODE[step.viewRequired];
  }

  // 2. Fallback: infer from tab selector
  if (!view && step.targetSelector) {
    view = TAB_SELECTOR_TO_VIEW[step.targetSelector];
  }

  if (!view) {
    return null;
  }

  return {
    view,
    elementSelector: step.targetSelector,
    highlightDuration: DEFAULT_HIGHLIGHT_DURATION,
  };
}

/**
 * Adds a pulsing highlight CSS class to the first element matching `selector`.
 * Returns a cleanup function that removes the class.
 *
 * If no element matches, the returned cleanup is a no-op.
 * If `duration` is provided, the highlight is automatically removed after
 * that many milliseconds (cleanup still works if called earlier).
 */
export function highlightElement(
  selector: string,
  duration: number = DEFAULT_HIGHLIGHT_DURATION,
): () => void {
  const element = document.querySelector(selector);
  if (!element) {
    return () => {
      /* no-op — element not found */
    };
  }

  element.classList.add(HIGHLIGHT_CLASS);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    element.classList.remove(HIGHLIGHT_CLASS);
  };

  if (duration > 0) {
    const timer = window.setTimeout(cleanup, duration);
    const originalCleanup = cleanup;
    return () => {
      window.clearTimeout(timer);
      originalCleanup();
    };
  }

  return cleanup;
}

/**
 * CSS class name added to highlighted elements.
 * Exported for use in stylesheets and tests.
 */
export const TUTORIAL_HIGHLIGHT_CLASS = HIGHLIGHT_CLASS;

/**
 * Default duration for element highlights, in milliseconds.
 */
export const DEFAULT_TUTORIAL_HIGHLIGHT_DURATION = DEFAULT_HIGHLIGHT_DURATION;
