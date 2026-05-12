/**
 * 8-bucket storage migration planner (Phase 3 Task 3.2 — dry-run).
 *
 * The Phase 1 audit
 * (docs/audits/2026-05-09-tauri-v2-migration-phase1-storage-and-runtime-audit.md)
 * classified 269 localStorage-touching files into 8 buckets:
 *
 *   1. session-auth      → OS keychain (Stronghold) — NEVER plaintext app-data
 *   2. project-data      → native FS project files / SQLite
 *   3. user-prefs        → tauri-plugin-store
 *   4. history-cache     → tauri-plugin-store (bounded retention)
 *   5. catalog-shared    → server source-of-truth + offline cache
 *   6. hardware-presets  → tauri-plugin-store
 *   7. ux-flags          → tauri-plugin-store (one-time dismisses)
 *   8. migration-markers → read once, complete migration, delete
 *
 * This module is the DRY-RUN PLANNER. It classifies an input snapshot of
 * localStorage entries into the 8 buckets WITHOUT writing anything. Phase
 * 3.2.1 (later) will use this plan to perform the mutating migration.
 *
 * Per Codex R4 self-critique: split "dry-run classifier" from "mutating
 * migration" so user data is never touched until the dry-run output is
 * reviewed.
 */
import { describe, it, expect } from "vitest";
import {
  classifyStorageKey,
  planStorageMigration,
  STORAGE_BUCKETS,
  isSensitiveKey,
  SENSITIVE_KEY_ORACLE,
  type StorageBucket,
} from "@/lib/desktop/storage-migration";
import inventory from "@/lib/desktop/storage-key-inventory.json";

describe("Storage bucket classifier (Phase 3 Task 3.2 — R4 retro Wave 3)", () => {
  it("declares all 9 buckets including event-name-not-storage", () => {
    const expected: StorageBucket[] = [
      "session-auth",
      "project-data",
      "user-prefs",
      "history-cache",
      "catalog-shared",
      "hardware-presets",
      "ux-flags",
      "migration-markers",
      "event-name-not-storage",
    ];
    for (const b of expected) {
      expect(STORAGE_BUCKETS[b], `bucket '${b}' missing from STORAGE_BUCKETS`).toBeDefined();
    }
  });

  it("classifies session/auth keys from real inventory", () => {
    expect(classifyStorageKey("protopulse-session-id")).toBe("session-auth");
    expect(classifyStorageKey("protopulse-ai-api-key")).toBe("session-auth");
    expect(classifyStorageKey("protopulse-ai-api-key-gemini")).toBe("session-auth");
    expect(classifyStorageKey("protopulse-google-workspace-token")).toBe("session-auth");
    expect(classifyStorageKey("protopulse:public-api:keys")).toBe("session-auth");
    expect(classifyStorageKey("protopulse:public-api:webhooks")).toBe("session-auth");
  });

  it("classifies project data keys from real inventory", () => {
    expect(classifyStorageKey("protopulse-board-settings")).toBe("project-data");
    expect(classifyStorageKey("protopulse-circuit-selection")).toBe("project-data");
    expect(classifyStorageKey("protopulse-sim-scenarios")).toBe("project-data");
    expect(classifyStorageKey("protopulse:design-variables")).toBe("project-data");
  });

  it("classifies user preference keys from real inventory", () => {
    expect(classifyStorageKey("protopulse-beginner-mode")).toBe("user-prefs");
    expect(classifyStorageKey("protopulse-gpu-blur-override")).toBe("user-prefs");
    expect(classifyStorageKey("protopulse-ai-safety-mode")).toBe("user-prefs");
    expect(classifyStorageKey("protopulse-compact-mode")).toBe("user-prefs");
    expect(classifyStorageKey("protopulse_ai_model")).toBe("user-prefs");
    expect(classifyStorageKey("protopulse_routing_strategy")).toBe("user-prefs");
  });

  it("classifies parameterized keys via PARAMETERIZED_PATTERNS fallback", () => {
    expect(classifyStorageKey("protopulse-panel-layout:session-a:1")).toBe("project-data");
    expect(classifyStorageKey("protopulse-panel-layout:session-a:42")).toBe("project-data");
    expect(classifyStorageKey("protopulse:design-variables:project:abc-uuid")).toBe("project-data");
    expect(classifyStorageKey("protopulse-activity-feed-2026-05")).toBe("history-cache");
    expect(classifyStorageKey("protopulse-component-links-xyz")).toBe("project-data");
    expect(classifyStorageKey("protopulse:plugin-data:plugin-id")).toBe("project-data");
  });

  it("classifies unprefixed legacy asset keys", () => {
    expect(classifyStorageKey("asset-favorites")).toBe("project-data");
    expect(classifyStorageKey("asset-recent")).toBe("project-data");
    expect(classifyStorageKey("asset-custom")).toBe("project-data");
  });

  it("classifies history/cache keys", () => {
    expect(classifyStorageKey("protopulse-memory-history")).toBe("history-cache");
    expect(classifyStorageKey("protopulse-import-history")).toBe("history-cache");
    expect(classifyStorageKey("protopulse-command-history")).toBe("history-cache");
    expect(classifyStorageKey("protopulse:interaction-history")).toBe("history-cache");
  });

  it("classifies UX-flag keys", () => {
    expect(classifyStorageKey("protopulse-ai-safety-dismissed")).toBe("ux-flags");
    expect(classifyStorageKey("protopulse-dismissed-reminders")).toBe("ux-flags");
    expect(classifyStorageKey("protopulse-milestone-unlocks")).toBe("ux-flags");
    expect(classifyStorageKey("protopulse-onboarding-dismissed")).toBe("ux-flags");
  });

  it("classifies unknown keys as null", () => {
    expect(classifyStorageKey("some-third-party-cookie-thing")).toBeNull();
    expect(classifyStorageKey("totally-unknown-key")).toBeNull();
  });

  it("classifies window-event names as 'event-name-not-storage' (NOT a localStorage bucket)", () => {
    expect(classifyStorageKey("protopulse:chat-send")).toBe("event-name-not-storage");
    expect(classifyStorageKey("protopulse:run-drc")).toBe("event-name-not-storage");
  });
});

describe("Sensitive-key oracle (R4 retro Wave 3 closure of C3 corpus gap)", () => {
  it("every inventory entry marked sensitive classifies as session-auth", () => {
    for (const entry of inventory as Array<{ key: string; classifiedAs: StorageBucket; sensitive: boolean }>) {
      if (entry.sensitive) {
        expect(entry.classifiedAs, `sensitive key "${entry.key}" must be session-auth`).toBe(
          "session-auth",
        );
      }
    }
  });

  it("ORACLE regex matches credential-bearing key name patterns", () => {
    const positiveCases = [
      "protopulse-session-id",
      "sessionId",
      "protopulse-ai-api-key",
      "protopulse:public-api:keys",
      "protopulse:public-api:webhooks",
      "some-jwt-bearer",
      "user-oauth-token",
      "private-key-store",
      "access-key-id",
      "user-credential-hash",
      "user-password-hash",
    ];
    for (const key of positiveCases) {
      expect(SENSITIVE_KEY_ORACLE.test(key), `oracle should match "${key}"`).toBe(true);
    }
  });

  it("ORACLE regex does NOT match non-credential keys", () => {
    const negativeCases = [
      "protopulse-board-settings",
      "protopulse-theme",
      "asset-favorites",
      "protopulse:run-drc",
    ];
    for (const key of negativeCases) {
      expect(SENSITIVE_KEY_ORACLE.test(key), `oracle should NOT match "${key}"`).toBe(false);
    }
  });

  it("isSensitiveKey covers both inventory-flagged AND oracle-matched keys", () => {
    expect(isSensitiveKey("protopulse-session-id")).toBe(true);  // inventory + oracle
    expect(isSensitiveKey("totally-unknown-jwt-token")).toBe(true);  // oracle only
    expect(isSensitiveKey("protopulse-theme")).toBe(false);  // neither
  });
});

describe("Storage migration planner (dry-run, no mutations)", () => {
  it("produces a plan with each bucket's keys, target, and entry count", () => {
    const snapshot = new Map<string, string>([
      ["protopulse-session-id", "sess_abc"],
      ["protopulse-board-settings", "{}"],
      ["protopulse-beginner-mode", "true"],
      ["protopulse-marketplace", "[]"],
      ["unknown-key", "x"],
    ]);
    const plan = planStorageMigration(snapshot);

    expect(plan.buckets["session-auth"].keys).toContain("protopulse-session-id");
    expect(plan.buckets["project-data"].keys).toContain("protopulse-board-settings");
    expect(plan.buckets["user-prefs"].keys).toContain("protopulse-beginner-mode");
    expect(plan.buckets["catalog-shared"].keys).toContain("protopulse-marketplace");

    // Unknown keys are surfaced in `unclassified` for human review.
    expect(plan.unclassified).toContain("unknown-key");

    // Plan should report total entries seen.
    expect(plan.totalEntries).toBe(5);
  });

  it("plan is idempotent — running twice on the same snapshot produces identical output", () => {
    const snapshot = new Map<string, string>([
      ["protopulse-session-id", "abc"],
      ["protopulse-board-settings", "{}"],
    ]);
    const plan1 = planStorageMigration(snapshot);
    const plan2 = planStorageMigration(snapshot);
    expect(plan1).toEqual(plan2);
  });

  it("plan declares NO actual mutations (status: 'dry-run')", () => {
    const plan = planStorageMigration(new Map([["protopulse-session-id", "x"]]));
    expect(plan.status).toBe("dry-run");
    expect(plan.mutationsApplied).toBe(0);
  });

  it("buckets declare their migration target (Stronghold / FS / Store / server-cache / delete)", () => {
    expect(STORAGE_BUCKETS["session-auth"].target).toBe("os-keychain");
    expect(STORAGE_BUCKETS["project-data"].target).toBe("native-fs");
    expect(STORAGE_BUCKETS["user-prefs"].target).toBe("tauri-plugin-store");
    expect(STORAGE_BUCKETS["history-cache"].target).toBe("tauri-plugin-store");
    expect(STORAGE_BUCKETS["catalog-shared"].target).toBe("server-with-cache");
    expect(STORAGE_BUCKETS["hardware-presets"].target).toBe("tauri-plugin-store");
    expect(STORAGE_BUCKETS["ux-flags"].target).toBe("tauri-plugin-store");
    expect(STORAGE_BUCKETS["migration-markers"].target).toBe("delete-after-migration");
  });
});
