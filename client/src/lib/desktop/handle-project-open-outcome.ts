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
  if (typeof window === 'undefined') return;

  switch (outcome.action) {
    case 'load-new': {
      if (!outcome.projectPath) break;
      // R4.5 fix #4 (Codex R4 land review blocker): the previous version
      // navigated to `/projects/${encodeURIComponent(path)}` which broke
      // because ProjectWorkspace expects a numeric DB project ID and
      // redirects non-numeric IDs to /projects/1. A .protopulse FILE PATH
      // is not a DB ID — file-backed loading is a separate code path that
      // doesn't exist in the consumer layer yet.
      //
      // Honest fix: emit a CustomEvent that consumers can listen for. The
      // actual file-loading wiring (parse .protopulse, create a session-
      // scoped project record, navigate to its workspace route) is R5+
      // work. R4.5 ensures the lifecycle bridge DELIVERS the event without
      // mis-navigating; R5 wires the consumer.
      window.dispatchEvent(
        new CustomEvent('protopulse:open-project-from-file', {
          detail: { projectPath: outcome.projectPath, reason: outcome.reason },
        }),
      );
      break;
    }
    case 'focus-existing': {
      // The window-state plugin re-focuses the existing window. The
      // workspace is already loaded with the project.
      break;
    }
    case 'prompt-replace': {
      // Dispatch a UI event the active workspace listens for to show the
      // "Replace current project?" confirm dialog. R5 wave wires the UI.
      if (!outcome.projectPath) break;
      window.dispatchEvent(
        new CustomEvent('protopulse:project-open-prompt-replace', {
          detail: { projectPath: outcome.projectPath, reason: outcome.reason },
        }),
      );
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
