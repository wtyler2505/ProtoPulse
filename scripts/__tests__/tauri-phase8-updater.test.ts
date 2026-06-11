/**
 * Phase 8 — Updater And Release Channels.
 *
 * Per docs/decisions/2026-05-10-adr-release-trust-model.md Q7 ratified default:
 *   "no updater for the first developer preview."
 *
 * Phase 8 deliverables in dev-preview-only mode:
 *   - docs/release/tauri-updater-policy.md — Tyler-readable channel + rollback
 *     + key-custody policy. The policy must name stable/beta/nightly channels,
 *     rollback rules, prompt UX, endpoint owner, and key owner.
 *   - tauri.conf.json deliberately has NO `plugins.updater` block — updater
 *     wiring is gated on Q7 ratification + signing infrastructure (Phase 7).
 *   - lib.rs has a placeholder comment naming the deferred-until-Q7-credentials
 *     state.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const policyPath = resolve(repoRoot, "docs", "release", "tauri-updater-policy.md");
const tauriConfPath = resolve(repoRoot, "src-tauri", "tauri.conf.json");

describe("Phase 8.1 — updater policy doc", () => {
  it("docs/release/tauri-updater-policy.md exists", () => {
    expect(existsSync(policyPath)).toBe(true);
  });

  it("policy names stable/beta/nightly channels (or 'no channels yet' explicitly)", () => {
    if (!existsSync(policyPath)) return;
    const md = readFileSync(policyPath, "utf8");
    expect(/stable.*beta.*nightly|nightly.*beta.*stable/is.test(md)).toBe(true);
  });

  it("policy covers rollback rules + prompt UX + endpoint owner + key owner", () => {
    if (!existsSync(policyPath)) return;
    const md = readFileSync(policyPath, "utf8");
    expect(/rollback/i.test(md)).toBe(true);
    expect(/prompt|consent|UX/i.test(md)).toBe(true);
    expect(/endpoint/i.test(md)).toBe(true);
    expect(/key.*custody|private key|key owner/i.test(md)).toBe(true);
  });

  it("policy explicitly states the dev-preview-no-updater default", () => {
    if (!existsSync(policyPath)) return;
    const md = readFileSync(policyPath, "utf8");
    expect(/no updater|dev[- ]preview/i.test(md)).toBe(true);
  });
});

describe("Phase 8.2 — updater config (deferred per Q7)", () => {
  it("tauri.conf.json does NOT have a live plugins.updater config (dev-preview default)", () => {
    const conf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
    const updater = conf.plugins?.updater;
    expect(
      updater === undefined,
      "Q7 ratified 'no updater for first developer preview'. plugins.updater must remain absent until Tyler provides updater key custody.",
    ).toBe(true);
  });
});
