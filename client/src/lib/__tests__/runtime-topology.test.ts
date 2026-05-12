/**
 * Hybrid runtime topology contract (Phase 3 Task 3.1).
 *
 * Per docs/decisions/2026-05-10-adr-tauri-runtime-topology.md (Path C),
 * every desktop-touching workflow must declare ONE routing target so we
 * can reason about which calls hit Express, which hit Rust, and which
 * stay browser-native.
 *
 * Targets:
 *   - `browser`      — web-only behavior (DOM, fetch, no native deps)
 *   - `desktop-rust` — typed Rust command via DesktopAPI / generated bindings
 *   - `remote-server`— stays on Express for now (cloud-class business logic, AI, supplier APIs)
 *   - `compat-local` — Express runs locally as a non-privileged sidecar (transitional)
 *
 * The registry is the source of truth for "what is this workflow's routing
 * decision?" and is consumed by per-feature adapters and audit tooling.
 */
import { describe, it, expect } from "vitest";
import {
  resolveWorkflowTarget,
  WORKFLOW_TOPOLOGY,
  REMOTE_SERVER_WORKFLOWS,
  COMPAT_LOCAL_WORKFLOWS,
  DESKTOP_RUST_WORKFLOWS,
  type ResolutionWave,
  type RoutingDecision,
  type RuntimeTarget,
  type WorkflowKey,
} from "@/lib/desktop/runtime-topology";

describe("Runtime topology registry (Phase 3 Task 3.1)", () => {
  it("declares every workflow's routing target as one of the four allowed values", () => {
    const allowed: RuntimeTarget[] = [
      "browser",
      "desktop-rust",
      "remote-server",
      "compat-local",
    ];
    const entries = Object.entries(WORKFLOW_TOPOLOGY) as Array<
      [WorkflowKey, RoutingDecision]
    >;
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, decision] of entries) {
      expect(
        allowed.includes(decision.tauri),
        `${key}.tauri must be one of ${JSON.stringify(allowed)}, got ${decision.tauri}`,
      ).toBe(true);
      expect(
        allowed.includes(decision.browser),
        `${key}.browser must be one of ${JSON.stringify(allowed)}, got ${decision.browser}`,
      ).toBe(true);
    }
  });

  it("`browser` mode never routes to desktop-rust", () => {
    for (const [key, decision] of Object.entries(WORKFLOW_TOPOLOGY)) {
      expect(
        decision.browser,
        `workflow '${key}' must not route to desktop-rust in browser mode`,
      ).not.toBe("desktop-rust");
    }
  });

  it("resolveWorkflowTarget picks the tauri-mode target when isTauri is true", () => {
    expect(resolveWorkflowTarget("save-csv", { isTauri: true })).toBe("desktop-rust");
  });

  it("resolveWorkflowTarget picks the browser-mode target when isTauri is false", () => {
    expect(resolveWorkflowTarget("save-csv", { isTauri: false })).toBe("browser");
  });

  it("ai-chat is remote-server in both modes (cloud-class)", () => {
    expect(resolveWorkflowTarget("ai-chat", { isTauri: true })).toBe("remote-server");
    expect(resolveWorkflowTarget("ai-chat", { isTauri: false })).toBe("remote-server");
  });

  it("supplier-quote is remote-server in both modes (external API)", () => {
    expect(resolveWorkflowTarget("supplier-quote", { isTauri: true })).toBe("remote-server");
    expect(resolveWorkflowTarget("supplier-quote", { isTauri: false })).toBe("remote-server");
  });

  it("includes the audited workflows from Phase 1 (save-csv, project export/import, AI chat, supplier, Arduino, RAG)", () => {
    // Per docs/audits/2026-05-10-tauri-v2-express-route-path-c-classification.md
    const expectedWorkflows: WorkflowKey[] = [
      "save-csv",
      "project-export",
      "project-import",
      "ai-chat",
      "supplier-quote",
      "arduino-compile",
      "rag-query",
    ];
    for (const w of expectedWorkflows) {
      expect(WORKFLOW_TOPOLOGY[w], `workflow '${w}' missing from registry`).toBeDefined();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// R4 retro Wave 4: contract tests for resolutionWave + inventory exports.
// ───────────────────────────────────────────────────────────────────────────

describe("R4 retro Wave 4 — resolutionWave + inventory exports", () => {
  it("every remote-server / compat-local Tauri workflow declares a resolutionWave", () => {
    const allowedWaves: ResolutionWave[] = [
      "r4",
      "r4.5",
      "r5-hardware",
      "r5-storage",
      "external-service",
      "compat-local-permanent",
    ];
    for (const key of [...REMOTE_SERVER_WORKFLOWS, ...COMPAT_LOCAL_WORKFLOWS]) {
      const d = WORKFLOW_TOPOLOGY[key];
      expect(d.resolutionWave, `${key}.resolutionWave is required`).toBeDefined();
      expect(allowedWaves).toContain(d.resolutionWave!);
    }
  });

  it("REMOTE_SERVER_WORKFLOWS / COMPAT_LOCAL_WORKFLOWS / DESKTOP_RUST_WORKFLOWS partition the registry", () => {
    const partitioned = new Set([
      ...REMOTE_SERVER_WORKFLOWS,
      ...COMPAT_LOCAL_WORKFLOWS,
      ...DESKTOP_RUST_WORKFLOWS,
    ]);
    const all = new Set(Object.keys(WORKFLOW_TOPOLOGY) as WorkflowKey[]);
    expect(partitioned).toEqual(all);
  });

  it("arduino-* workflows are compat-local (typed Rust commands land in R5 hardware wave)", () => {
    expect(resolveWorkflowTarget("arduino-compile", { isTauri: true })).toBe("compat-local");
    expect(resolveWorkflowTarget("arduino-upload", { isTauri: true })).toBe("compat-local");
    expect(resolveWorkflowTarget("arduino-serial", { isTauri: true })).toBe("compat-local");
    expect(WORKFLOW_TOPOLOGY["arduino-compile"].resolutionWave).toBe("r5-hardware");
    expect(WORKFLOW_TOPOLOGY["arduino-upload"].resolutionWave).toBe("r5-hardware");
    expect(WORKFLOW_TOPOLOGY["arduino-serial"].resolutionWave).toBe("r5-hardware");
  });

  it("storage workflows (user-settings/kanban-state/design-variables) are desktop-rust in R5 #2 (Codex R3 ratified land)", () => {
    expect(resolveWorkflowTarget("user-settings", { isTauri: true })).toBe("desktop-rust");
    expect(resolveWorkflowTarget("kanban-state", { isTauri: true })).toBe("desktop-rust");
    expect(resolveWorkflowTarget("design-variables", { isTauri: true })).toBe("desktop-rust");
    // resolutionWave should NOT be set anymore for these terminal targets
    expect(WORKFLOW_TOPOLOGY["user-settings"].resolutionWave).toBeUndefined();
    expect(WORKFLOW_TOPOLOGY["kanban-state"].resolutionWave).toBeUndefined();
    expect(WORKFLOW_TOPOLOGY["design-variables"].resolutionWave).toBeUndefined();
  });

  it("every DESKTOP_RUST_WORKFLOWS entry has at least one registered Rust command", () => {
    // Source-of-truth list mirrors src-tauri/src/lib.rs collect_commands![] macro.
    // Hand-maintained — future R5.5+ wave auto-derives from cargo-metadata.
    const REGISTERED_RUST_COMMANDS = new Set([
      "show_save_dialog",
      "show_open_dialog",
      "read_file",
      "write_file",
      "get_version",
      "get_platform",
      "frontend_ready_for_project_open_requests",
      // R5 #2 (commit 0559467a) — tauri-plugin-store wrappers
      "read_user_setting",
      "write_user_setting",
      "read_kanban_state",
      "write_kanban_state",
      "read_project_design_variables",
      "write_project_design_variables",
    ]);
    const WORKFLOW_TO_COMMAND: Partial<Record<WorkflowKey, string[]>> = {
      "save-csv": ["show_save_dialog", "write_file"],
      "save-svg": ["show_save_dialog", "write_file"],
      "save-json": ["show_save_dialog", "write_file"],
      "project-export": ["show_save_dialog", "write_file"],
      "project-import": ["show_open_dialog", "read_file"],
      // R5 #2 (Codex R3 ratified):
      "user-settings": ["read_user_setting", "write_user_setting"],
      "kanban-state": ["read_kanban_state", "write_kanban_state"],
      "design-variables": [
        "read_project_design_variables",
        "write_project_design_variables",
      ],
    };
    for (const key of DESKTOP_RUST_WORKFLOWS) {
      const expected = WORKFLOW_TO_COMMAND[key] ?? [];
      expect(
        expected.length,
        `desktop-rust workflow '${key}' must declare backing Rust commands`,
      ).toBeGreaterThan(0);
      for (const cmd of expected) {
        expect(
          REGISTERED_RUST_COMMANDS.has(cmd),
          `command '${cmd}' (used by '${key}') must be in collect_commands! macro`,
        ).toBe(true);
      }
    }
  });
});
