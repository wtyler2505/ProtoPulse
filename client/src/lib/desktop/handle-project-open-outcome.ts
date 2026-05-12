/**
 * Dispatcher for `ProjectOpenOutcome` events emitted by the native lifecycle
 * bridge. Routes outcomes to wouter navigation + emits an existing
 * project-load action.
 *
 * Phase 4.3 (R4 retro Wave 5): wire-up surface between
 * `installProjectOpenListener` and the rest of the app. Kept as a separate
 * module so the bridge component stays small + the dispatcher can be
 * mocked in tests.
 */

import type { ProjectOpenOutcome } from './project-open-contract';

/**
 * Handle a single classified project-open outcome.
 *
 * - `load-new` → navigate to the project's workspace route
 * - `focus-existing` → focus the current window (no-op for now; window-state plugin handles re-focus)
 * - `prompt-replace` → emit a UI event the workspace listens for to show a confirm dialog
 * - `ignore-invalid` → console.warn for diagnostic visibility
 *
 * Real navigation/UI dispatch lives in the implementing components — this
 * module is a thin policy layer.
 */
export function handleProjectOpenOutcome(outcome: ProjectOpenOutcome): void {
  switch (outcome.action) {
    case 'load-new': {
      if (outcome.projectPath) {
        // Navigation hand-off to wouter via the global location.pathname.
        // The workspace components observe URL changes and load the project.
        const target = `/projects/${encodeURIComponent(outcome.projectPath)}`;
        if (typeof window !== 'undefined' && window.location.pathname !== target) {
          window.history.pushState({}, '', target);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
      break;
    }
    case 'focus-existing': {
      // The window-state plugin re-focuses the existing window. No additional
      // action needed here; the workspace is already loaded with the project.
      break;
    }
    case 'prompt-replace': {
      // Dispatch a UI event the active workspace listens for to show the
      // "Replace current project?" confirm dialog. R5 wave wires the UI.
      if (typeof window !== 'undefined' && outcome.projectPath) {
        window.dispatchEvent(
          new CustomEvent('protopulse:project-open-prompt-replace', {
            detail: { projectPath: outcome.projectPath, reason: outcome.reason },
          }),
        );
      }
      break;
    }
    case 'ignore-invalid': {
      console.warn(
        `[lifecycle] project-open request rejected as invalid:`,
        outcome.reason ?? 'unknown reason',
      );
      break;
    }
  }
}
