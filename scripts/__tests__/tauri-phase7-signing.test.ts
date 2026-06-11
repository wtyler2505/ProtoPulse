/**
 * Phase 7 — Signing, Notarization, And Key Custody (dev-preview placeholders).
 *
 * Per docs/decisions/2026-05-10-adr-release-trust-model.md ratified defaults:
 *   - Q5 Windows signing: dev-preview-only until Tyler confirms Azure Artifact Signing
 *   - Q6 macOS distribution: dev-preview-only until paid Apple Developer account
 *
 * Phase 7 ships:
 *   - tauri-build.yml signing env placeholders (commented references to APPLE_*,
 *     TAURI_SIGNING_*, no hardcoded certs)
 *   - docs/release/tauri-signing-runbook.md — Tyler-readable activation guide
 *   - scripts/ci/verify-signed-artifacts.sh — dry-run signature verification
 *
 * Tests are static: contracts exist, no real signing happens until credentials land.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const workflowPath = resolve(repoRoot, ".github", "workflows", "tauri-build.yml");
const runbookPath = resolve(repoRoot, "docs", "release", "tauri-signing-runbook.md");
const verifyPath = resolve(repoRoot, "scripts", "ci", "verify-signed-artifacts.sh");

describe("Phase 7.1 — signing placeholders (no secrets)", () => {
  it("tauri-build.yml references APPLE_* and TAURI_SIGNING_* secrets (placeholder lines)", () => {
    const yml = readFileSync(workflowPath, "utf8");
    expect(/APPLE_(CERTIFICATE|SIGNING_IDENTITY|ID|PASSWORD|TEAM_ID)/.test(yml)).toBe(true);
    expect(/TAURI_SIGNING_PRIVATE_KEY/.test(yml)).toBe(true);
  });

  it("tauri-build.yml does NOT contain hardcoded certs / private keys", () => {
    const yml = readFileSync(workflowPath, "utf8");
    // Heuristic: no base64-armoured key blocks or PEM headers committed inline.
    expect(/-----BEGIN (CERTIFICATE|PRIVATE KEY|RSA PRIVATE KEY|ENCRYPTED PRIVATE KEY)/.test(yml)).toBe(false);
  });

  it("runbook exists at docs/release/tauri-signing-runbook.md", () => {
    expect(existsSync(runbookPath)).toBe(true);
  });

  it("runbook documents both Win + macOS activation paths and Q5/Q6 defaults", () => {
    if (!existsSync(runbookPath)) return;
    const md = readFileSync(runbookPath, "utf8");
    expect(/Windows/i.test(md)).toBe(true);
    expect(/macOS|Apple/i.test(md)).toBe(true);
    expect(/Azure Artifact Signing|Developer ID|notariz/i.test(md)).toBe(true);
    expect(/dev[- ]preview/i.test(md)).toBe(true);
  });
});

describe("Phase 7.2 — verify-signed-artifacts dry-run", () => {
  it("scripts/ci/verify-signed-artifacts.sh exists and is executable", () => {
    expect(existsSync(verifyPath)).toBe(true);
    if (existsSync(verifyPath)) {
      const mode = statSync(verifyPath).mode;
      expect((mode & 0o111) !== 0).toBe(true);
    }
  });

  it("verify script supports --dry-run mode (works without real secrets)", () => {
    if (!existsSync(verifyPath)) return;
    const sh = readFileSync(verifyPath, "utf8");
    expect(/--dry-run|DRY_RUN/.test(sh)).toBe(true);
  });

  it("verify script references signtool/codesign/Authenticode/notary commands", () => {
    if (!existsSync(verifyPath)) return;
    const sh = readFileSync(verifyPath, "utf8");
    expect(/signtool|codesign|Authenticode|notarytool|notary/.test(sh)).toBe(true);
  });
});
