/**
 * Tauri desktop build-output contract (Phase 1 Task 1.1).
 *
 * Validates the desktop runtime's production build contract per
 * `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md` (Path C).
 *
 * Contract:
 *   1. The frontend builds successfully → `dist/public/index.html` exists.
 *   2. The Tauri production runtime does NOT hard-require `dist/index.cjs`.
 *      Either:
 *        (a) `dist/index.cjs` exists (Express sidecar present), OR
 *        (b) `src-tauri/src/lib.rs` gates `start_express_server` on the file's
 *            existence so the runtime no-ops gracefully when the sidecar is
 *            absent (no `expect()` panic).
 *
 * This test enforces the contract by inspecting build artifacts and the Rust
 * source. We do NOT run `npm run build` inside the test (too slow for a unit
 * test) — that's the preflight gate's job. We DO assert the lib.rs guard exists
 * so future edits can't silently reintroduce the panic.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");

describe("Tauri desktop build-output contract (Phase 1 Task 1.1)", () => {
  it("produces dist/public/index.html after npm run build", () => {
    const frontendEntry = resolve(repoRoot, "dist", "public", "index.html");
    expect(existsSync(frontendEntry), `expected ${frontendEntry} to exist after npm run build; if missing, run 'npm run build' first`).toBe(true);
  });

  it("does not hard-require dist/index.cjs at desktop runtime", () => {
    const cjsEntry = resolve(repoRoot, "dist", "index.cjs");
    const libRsPath = resolve(repoRoot, "src-tauri", "src", "lib.rs");
    const libRs = readFileSync(libRsPath, "utf8");

    // Contract option (a): dist/index.cjs is produced and runtime expects it.
    const sidecarPresent = existsSync(cjsEntry);

    // Contract option (b): lib.rs gates the spawn on the file's existence.
    // We look for an `if server_entry.exists()` (or similar `.exists()` guard
    // anywhere in the start_express_server function) AND the absence of the
    // hard `.expect("Failed to start Express server")` panic.
    const hasExistenceGuard = /server_entry\.exists\(\)/.test(libRs);
    const hasHardPanic = /\.expect\(\"Failed to start Express server\"\)/.test(libRs);

    // The ratified contract is met when EITHER option (a) holds, OR
    // option (b) holds (guard present and panic removed).
    const optionA = sidecarPresent;
    const optionB = hasExistenceGuard && !hasHardPanic;

    expect(
      optionA || optionB,
      [
        "Desktop runtime contract violated.",
        `  option (a) sidecar present (${cjsEntry} exists): ${optionA}`,
        `  option (b) lib.rs gates the spawn on .exists() AND removes the hard panic: ${optionB}`,
        "    has existence guard: " + hasExistenceGuard,
        "    has hard panic:      " + hasHardPanic,
        "",
        "Fix: either run 'npm run build' to produce dist/index.cjs (option a),",
        "or update src-tauri/src/lib.rs start_express_server() to skip when",
        "server_entry.exists() is false and replace .expect() with graceful logging",
        "(option b — Path C topology, no hard sidecar dep).",
      ].join("\n"),
    ).toBe(true);
  });

  it("does not panic in production when dist/index.cjs is absent (static check)", () => {
    // Even if option (a) holds today, the runtime should never panic on a missing
    // sidecar binary — that breaks the desktop boot guarantee. The hard
    // .expect("Failed to start Express server") panic must not exist in lib.rs.
    const libRsPath = resolve(repoRoot, "src-tauri", "src", "lib.rs");
    const libRs = readFileSync(libRsPath, "utf8");
    expect(
      /\.expect\(\"Failed to start Express server\"\)/.test(libRs),
      "src-tauri/src/lib.rs must not panic with .expect() when the Express sidecar fails to spawn. Use graceful warning logging instead.",
    ).toBe(false);
  });
});
