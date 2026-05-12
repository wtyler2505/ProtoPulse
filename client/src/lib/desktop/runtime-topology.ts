/**
 * Hybrid runtime topology registry (Phase 3 Task 3.1).
 *
 * Per docs/decisions/2026-05-10-adr-tauri-runtime-topology.md (Path C),
 * ProtoPulse splits workflows across four routing targets. This module is
 * the single source of truth: which workflow runs where in browser mode
 * vs desktop mode.
 *
 * Routing targets:
 *   - `browser`       — Web-native (DOM, fetch, no native deps).
 *   - `desktop-rust`  — Typed Rust command via DesktopAPI / generated bindings.
 *   - `remote-server` — Stays on Express for now (cloud-class: AI chat,
 *                       supplier APIs, server-side validation).
 *   - `compat-local`  — Express running locally as a non-privileged sidecar
 *                       (transitional bridge while routes migrate to Rust).
 *
 * Per-feature adapters consult `resolveWorkflowTarget(key, { isTauri })` to
 * decide which path to take. Audit tooling reads `WORKFLOW_TOPOLOGY` directly
 * to enumerate unresolved-server-dependency surface.
 */

export type RuntimeTarget =
  | "browser"
  | "desktop-rust"
  | "remote-server"
  | "compat-local";

/**
 * Wave in which a workflow's `remote-server` / `compat-local` Tauri target
 * resolves into something narrower (typically `desktop-rust`). Required for
 * any workflow that is NOT `desktop-rust` or `browser`; null/undefined for
 * workflows whose Tauri target is already final.
 *
 * Per R4 retro: `resolutionWave` is typed so audit tooling can categorize
 * unresolved dependencies by their planned wave instead of free strings.
 */
export type ResolutionWave =
  | "r4"
  | "r4.5"
  | "r5-hardware"
  | "r5-storage"
  | "external-service"
  | "compat-local-permanent";

/**
 * Per-workflow decision: which target applies when running inside Tauri
 * (`tauri`) vs in the browser (`browser`). Both are declared explicitly so a
 * future audit can fail-loud if any workflow leaves one slot undefined.
 */
export interface RoutingDecision {
  tauri: RuntimeTarget;
  browser: RuntimeTarget;
  /** Short rationale or memory-note pointer; helps `/audit` tooling explain choices. */
  why: string;
  /**
   * When the `tauri` target is `remote-server` or `compat-local`, this
   * names the wave that resolves it. Required for those targets; ignored
   * for `desktop-rust` and `browser` (both terminal).
   */
  resolutionWave?: ResolutionWave;
}

/**
 * Workflow keys are stable identifiers used by per-feature adapters. They are
 * domain-named ("save-csv", "ai-chat") rather than file-path-named so callers
 * don't break when refactors move code. Keep this list small and curated —
 * not every export from `client/src/lib` belongs here.
 */
export type WorkflowKey =
  | "save-csv"
  | "save-svg"
  | "save-json"
  | "project-export"
  | "project-import"
  | "ai-chat"
  | "supplier-quote"
  | "arduino-compile"
  | "arduino-upload"
  | "arduino-serial"
  | "rag-query"
  | "knowledge-search"
  | "auth-session"
  | "user-settings"
  | "kanban-state"
  | "design-variables";

export const WORKFLOW_TOPOLOGY: Record<WorkflowKey, RoutingDecision> = {
  "save-csv": {
    tauri: "desktop-rust",
    browser: "browser",
    why: "Native save dialog + writeFile in Tauri; anchor-click download in browser. Phase 1 Task 1.2 first chokepoint.",
  },
  "save-svg": {
    tauri: "desktop-rust",
    browser: "browser",
    why: "Same downloadBlob() path as CSV (svg-export.ts).",
  },
  "save-json": {
    tauri: "desktop-rust",
    browser: "browser",
    why: "Project export, board settings, design variables — all flow through downloadBlob().",
  },
  "project-export": {
    tauri: "desktop-rust",
    browser: "browser",
    why: "Tauri: native save dialog + writeFile. Browser: zip + download.",
  },
  "project-import": {
    tauri: "desktop-rust",
    browser: "browser",
    why: "Tauri: native open dialog + readFile. Browser: file-input picker.",
  },
  "ai-chat": {
    tauri: "remote-server",
    browser: "remote-server",
    why: "LLM streams via Express /api/chat regardless of runtime — keys + auth stay server-side. Upstream Anthropic/OpenAI APIs.",
    resolutionWave: "external-service",
  },
  "supplier-quote": {
    tauri: "remote-server",
    browser: "remote-server",
    why: "External supplier APIs (Octopart/DigiKey) require server-side credentials + caching. /api/ordering, /api/supply-chain.",
    resolutionWave: "external-service",
  },
  // R4 retro: arduino-* claim `desktop-rust` was aspirational. No typed
  // arduino_compile / arduino_upload / arduino_serial_open commands exist
  // in src-tauri/src/lib.rs yet. Re-classified to compat-local with
  // resolutionWave so the contract test passes cleanly + the wave that
  // adds the typed commands is named explicitly.
  "arduino-compile": {
    tauri: "compat-local",
    browser: "compat-local",
    why: "Tauri: arduino-cli sidecar via Express bridge today; R5 hardware wave moves to typed Rust command arduino_compile().",
    resolutionWave: "r5-hardware",
  },
  "arduino-upload": {
    tauri: "compat-local",
    browser: "compat-local",
    why: "Tauri: arduino-cli sidecar via Express bridge; R5 wave → typed arduino_upload().",
    resolutionWave: "r5-hardware",
  },
  "arduino-serial": {
    tauri: "compat-local",
    browser: "browser",
    why: "Tauri: Express bridge for serial today (R5 wave: tauri-plugin-serialplugin + typed arduino_serial_open command). Browser: navigator.serial (Web Serial API) terminal.",
    resolutionWave: "r5-hardware",
  },
  "rag-query": {
    tauri: "remote-server",
    browser: "remote-server",
    why: "Server-side embedding + retrieval. /api/rag.",
    resolutionWave: "external-service",
  },
  "knowledge-search": {
    tauri: "remote-server",
    browser: "remote-server",
    why: "/api/knowledge-vault — server holds the corpus.",
    resolutionWave: "external-service",
  },
  "auth-session": {
    tauri: "remote-server",
    browser: "remote-server",
    why: "Session cookies / hashed tokens stay server-side per BL-0072. R5 storage wave routes Tauri auth state through OS keychain (Stronghold) for the session-auth bucket.",
    resolutionWave: "r5-storage",
  },
  // R5 Deferral #2 (Codex R3 ratified): tauri-plugin-store + typed wrappers
  // landed. resolutionWave dropped because tauri target is now terminal
  // (`desktop-rust`). Browser mode still falls back to localStorage via the
  // desktop-store-adapter; isTauri=false uses the browser branch directly.
  "user-settings": {
    tauri: "desktop-rust",
    browser: "browser",
    why: "Cross-project preferences. Tauri: read_user_setting / write_user_setting via tauri-plugin-store (backend-only plugin use, key-namespaced). Browser: localStorage. NOTE: 3 bootstrap-read keys (high-contrast, gpu-blur-override, theme) excluded from R5 #2 — pending Bootstrap-Storage Restructure.",
  },
  "kanban-state": {
    tauri: "desktop-rust",
    browser: "browser",
    why: "Singleton Kanban board state. Tauri: read_kanban_state() / write_kanban_state(value) via tauri-plugin-store (no project_id; current shape is one localStorage key 'protopulse-kanban-board'). Browser: localStorage. R5.5+ wave introduces per-project Kanban with project_id.",
  },
  "design-variables": {
    tauri: "desktop-rust",
    browser: "browser",
    why: "Per-project design variables. Tauri: read_project_design_variables(project_id) / write_project_design_variables(project_id, value) via tauri-plugin-store. Browser: localStorage keyed by protopulse:design-variables:project:<id>.",
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Audit-derived inventories (R4 retro C4 exports).
// ───────────────────────────────────────────────────────────────────────────

/** Workflows where Tauri still routes through Express today. */
export const REMOTE_SERVER_WORKFLOWS: WorkflowKey[] = (
  Object.keys(WORKFLOW_TOPOLOGY) as WorkflowKey[]
).filter((k) => WORKFLOW_TOPOLOGY[k].tauri === "remote-server");

/** Workflows where Tauri still depends on local Express (transitional). */
export const COMPAT_LOCAL_WORKFLOWS: WorkflowKey[] = (
  Object.keys(WORKFLOW_TOPOLOGY) as WorkflowKey[]
).filter((k) => WORKFLOW_TOPOLOGY[k].tauri === "compat-local");

/** Workflows where Tauri uses typed Rust commands today. */
export const DESKTOP_RUST_WORKFLOWS: WorkflowKey[] = (
  Object.keys(WORKFLOW_TOPOLOGY) as WorkflowKey[]
).filter((k) => WORKFLOW_TOPOLOGY[k].tauri === "desktop-rust");

/**
 * Resolve a single workflow's routing target.
 * Returns the appropriate target based on the current environment.
 *
 * @param key The workflow identifier.
 * @param env Environment context — `isTauri: true` when running inside the
 *            Tauri webview, `false` in a browser session.
 */
export function resolveWorkflowTarget(
  key: WorkflowKey,
  env: { isTauri: boolean },
): RuntimeTarget {
  const decision = WORKFLOW_TOPOLOGY[key];
  if (!decision) {
    throw new Error(
      `Unknown workflow '${key}'. Add it to WORKFLOW_TOPOLOGY in client/src/lib/desktop/runtime-topology.ts before routing.`,
    );
  }
  return env.isTauri ? decision.tauri : decision.browser;
}

/**
 * Return the list of workflows whose `tauri` target is still
 * `remote-server` or `compat-local` — i.e., they still depend on Express.
 * Audit tooling uses this to track progress toward "fully Rust-native"
 * desktop authority. Phase 9+ tasks should shrink this list.
 */
export function unresolvedServerDependencies(): WorkflowKey[] {
  return (Object.keys(WORKFLOW_TOPOLOGY) as WorkflowKey[]).filter((k) => {
    const t = WORKFLOW_TOPOLOGY[k].tauri;
    return t === "remote-server" || t === "compat-local";
  });
}
