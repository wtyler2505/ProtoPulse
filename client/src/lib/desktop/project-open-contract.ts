/**
 * Project-open contract (Phase 4 Task 4.1).
 *
 * Pure-TypeScript validation + event routing for "open a ProtoPulse project"
 * events arriving from native lifecycle hooks (file associations, deep links,
 * single-instance forwarding) in Task 4.2.
 *
 * Defined before native code wires in so the contract is testable in
 * isolation. Native side (Rust) will hand requests to this validator and
 * dispatch based on the classified outcome.
 */

/** Where the project-open event came from. */
export type ProjectOpenSource =
  | "cold-start"  // App launched with argv project path / openFile (macOS)
  | "warm-start"  // Single-instance plugin forwarded argv from a second launch
  | "deep-link"   // protopulse:// URL opened
  | "menu"        // User triggered File → Open Project from the in-app menu
  | "drop";       // User dropped a .protopulse file/folder onto the window

export interface ProjectOpenRequest {
  source: ProjectOpenSource;
  /**
   * Path or URL string. For `deep-link`, this is the full URL
   * (e.g., `protopulse://open?project=/path/to/file.protopulse`).
   * For other sources, this is the local filesystem path.
   */
  path: string;
}

/** Result of validating a request — discriminated union. */
export type ValidationResult =
  | { ok: true; request: ProjectOpenRequest; extractedPath: string }
  | { ok: false; reason: string };

/** Outcome the runtime should act on. */
export type ProjectOpenAction =
  | "load-new"           // No active project, or active is different — load
  | "focus-existing"     // Requested project IS the active project — focus window
  | "prompt-replace"     // Active project differs — ask before replacing
  | "ignore-invalid";    // Validation failed; no-op or surface error toast

export interface ProjectOpenOutcome {
  action: ProjectOpenAction;
  /** Resolved local project path (after extracting from URL if needed). */
  projectPath: string | null;
  reason?: string;
}

/**
 * Accept either `.protopulse` file paths or `protopulse://` URLs.
 * Reject empty, path-traversal, shell-meta, or unsupported schemes.
 */
const PROJECT_PATH_EXT = /\.protopulse(?:\/.*)?$/i;
const PATH_TRAVERSAL_RE = /(^|\/)\.\.(\/|$)/;
const SHELL_META_RE = /[;&|`$<>(){}*?]/;
const DEEP_LINK_RE = /^protopulse:\/\/open\?project=(.+)$/i;
const UNSUPPORTED_SCHEMES = /^(javascript|data|file|http|https):/i;

export function validateProjectOpenRequest(
  req: ProjectOpenRequest,
): ValidationResult {
  const path = req.path.trim();
  if (!path) {
    return { ok: false, reason: "empty path — missing project path/URL" };
  }

  // Deep-link path: extract the inner project path before further checks.
  let extractedPath = path;
  if (req.source === "deep-link") {
    const m = path.match(DEEP_LINK_RE);
    if (!m) {
      return {
        ok: false,
        reason: `unsupported URL scheme or shape for deep-link: ${path.slice(0, 40)}`,
      };
    }
    extractedPath = decodeURIComponent(m[1]);
  } else if (UNSUPPORTED_SCHEMES.test(path)) {
    // Non-deep-link sources should not carry URL schemes at all.
    return { ok: false, reason: `unsupported URL scheme in path: ${path.slice(0, 40)}` };
  }

  if (PATH_TRAVERSAL_RE.test(extractedPath)) {
    return { ok: false, reason: "path traversal segment '..' is not allowed" };
  }

  if (SHELL_META_RE.test(extractedPath)) {
    return { ok: false, reason: "shell metacharacters are not allowed in project path" };
  }

  if (!PROJECT_PATH_EXT.test(extractedPath)) {
    return {
      ok: false,
      reason: `path does not end in .protopulse — not a ProtoPulse project: ${extractedPath.slice(0, 60)}`,
    };
  }

  return { ok: true, request: req, extractedPath };
}

export interface ClassifyInput {
  validated: ProjectOpenRequest;
  /** The currently-loaded project path, or null if none. */
  activeProjectPath: string | null;
}

export function classifyProjectOpenEvent(input: ClassifyInput): ProjectOpenOutcome {
  const result = validateProjectOpenRequest(input.validated);
  if (!result.ok) {
    return { action: "ignore-invalid", projectPath: null, reason: result.reason };
  }

  const requested = result.extractedPath;
  const active = input.activeProjectPath;

  if (active === requested) {
    return { action: "focus-existing", projectPath: requested };
  }

  // Warm-start with a DIFFERENT active project requires user confirmation
  // (don't blow away unsaved work). cold-start / deep-link / menu / drop with
  // no active project loads directly; cold-start replaces (the app just
  // booted, nothing to lose).
  if (input.validated.source === "warm-start" && active !== null) {
    return { action: "prompt-replace", projectPath: requested };
  }

  return { action: "load-new", projectPath: requested };
}

// ───────────────────────────────────────────────────────────────────────────
// R4 retro Wave 5: native-to-frontend bridge.
//
// Three native sources feed `classifyProjectOpenEvent`:
//   1. Cold-start argv (Rust captures std::env::args() at app startup, queues
//      requests until the frontend signals readiness, then drains via the
//      `frontend_ready_for_project_open_requests` Tauri command).
//   2. Single-instance forwarded argv (when a second launch happens — Rust
//      calls `enqueue_or_emit` from the single-instance handler, emits the
//      'project-open-request' event to the running window).
//   3. Deep-link URLs while the app runs (Tauri's `@tauri-apps/plugin-deep-link`
//      `onOpenUrl` callback).
//
// All three feed the same TS validator + dispatcher. The lifecycle bridge
// component (`desktop-lifecycle-bridge.tsx`) mounts at the App.tsx level
// so listener installation + readiness signaling lives outside any per-route
// component that might unmount.
// ───────────────────────────────────────────────────────────────────────────

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { commands } from "../bindings";

/**
 * Install all native-to-frontend project-open paths.
 *
 * Returns an unlisten function for cleanup. Callers MUST invoke this on
 * mount AFTER they're ready to handle events; the function calls
 * `frontend_ready_for_project_open_requests` which flips the Rust state
 * machine + drains pending requests.
 *
 * @param onClassified callback that handles each classified outcome
 * @param activeProjectPath getter returning the currently-loaded project path
 */
export async function installProjectOpenListener(
  onClassified: (outcome: ProjectOpenOutcome) => void,
  activeProjectPath: () => string | null,
): Promise<() => void> {
  const unlisteners: UnlistenFn[] = [];

  // (1) Listen for future single-instance forwarded events FIRST so anything
  // emitted DURING the frontend_ready call doesn't get lost.
  const offSingleInstance = await listen<{ source: string; path: string }>(
    "project-open-request",
    (event) => {
      const source = event.payload.source as ProjectOpenSource;
      const outcome = classifyProjectOpenEvent({
        validated: { source, path: event.payload.path },
        activeProjectPath: activeProjectPath(),
      });
      onClassified(outcome);
    },
  );
  unlisteners.push(offSingleInstance);

  // (2) Future deep-link URLs via official plugin API.
  const offDeepLink = await onOpenUrl((urls: string[]) => {
    for (const url of urls) {
      const outcome = classifyProjectOpenEvent({
        validated: { source: "deep-link", path: url },
        activeProjectPath: activeProjectPath(),
      });
      onClassified(outcome);
    }
  });
  unlisteners.push(offDeepLink);

  // (3) Drain pending queue (cold-start argv that fired before mount).
  try {
    const pending = await commands.frontendReadyForProjectOpenRequests();
    for (const req of pending) {
      const source = req.source as ProjectOpenSource;
      const outcome = classifyProjectOpenEvent({
        validated: { source, path: req.path },
        activeProjectPath: activeProjectPath(),
      });
      onClassified(outcome);
    }
  } catch (e) {
    console.warn("[lifecycle] frontendReadyForProjectOpenRequests failed:", e);
  }

  return () => {
    for (const u of unlisteners) u();
  };
}
