/**
 * Native lifecycle wiring contract (Phase 4 Task 4.2).
 *
 * Static parse of Cargo.toml + lib.rs + tauri.conf.json to assert the
 * lifecycle plugins are wired correctly:
 *
 *   - tauri-plugin-single-instance  (MUST be registered BEFORE deep-link per
 *     https://v2.tauri.app/plugin/deep-linking — deep-link uses single-instance
 *     to receive argv on Linux/Windows)
 *   - tauri-plugin-deep-link        (protopulse:// URL scheme)
 *   - tauri-plugin-window-state     (remember window position/size across launches)
 *
 * Plus tauri.conf.json declarations:
 *   - bundle.fileAssociations declares the .protopulse extension
 *   - plugins.deep-link.desktop.schemes includes "protopulse"
 *
 * The actual runtime behavior (cold-start argv → project-open-contract,
 * warm-start single-instance forwarding, deep-link routing) is exercised by
 * the project-open-contract.test.ts pure-TS contract.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const cargoTomlPath = resolve(repoRoot, "src-tauri", "Cargo.toml");
const libRsPath = resolve(repoRoot, "src-tauri", "src", "lib.rs");
const tauriConfPath = resolve(repoRoot, "src-tauri", "tauri.conf.json");

const cargoToml = readFileSync(cargoTomlPath, "utf8");
const libRs = readFileSync(libRsPath, "utf8");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));

describe("Phase 4.2 — Cargo plugin dependencies", () => {
  it("Cargo.toml declares tauri-plugin-single-instance", () => {
    expect(/tauri-plugin-single-instance\s*=/.test(cargoToml)).toBe(true);
  });

  it("Cargo.toml declares tauri-plugin-deep-link", () => {
    expect(/tauri-plugin-deep-link\s*=/.test(cargoToml)).toBe(true);
  });

  it("Cargo.toml declares tauri-plugin-window-state", () => {
    expect(/tauri-plugin-window-state\s*=/.test(cargoToml)).toBe(true);
  });
});

describe("Phase 4.2 — lib.rs plugin registration order", () => {
  it("lib.rs registers tauri_plugin_single_instance", () => {
    expect(/tauri_plugin_single_instance::init/.test(libRs)).toBe(true);
  });

  it("lib.rs registers tauri_plugin_deep_link", () => {
    expect(/tauri_plugin_deep_link::init/.test(libRs)).toBe(true);
  });

  it("lib.rs registers tauri_plugin_window_state", () => {
    expect(/tauri_plugin_window_state::/.test(libRs)).toBe(true);
  });

  it("single-instance is registered BEFORE deep-link (hard rule)", () => {
    // Find index of each plugin's first `::init` reference.
    const singleIdx = libRs.indexOf("tauri_plugin_single_instance::init");
    const deepLinkIdx = libRs.indexOf("tauri_plugin_deep_link::init");
    expect(singleIdx, "single-instance must appear in lib.rs").toBeGreaterThan(-1);
    expect(deepLinkIdx, "deep-link must appear in lib.rs").toBeGreaterThan(-1);
    expect(
      singleIdx < deepLinkIdx,
      "single-instance plugin MUST be registered before deep-link per https://v2.tauri.app/plugin/deep-linking",
    ).toBe(true);
  });
});

describe("Phase 4.2 — tauri.conf.json declarations", () => {
  it("declares the .protopulse file association", () => {
    const assocs = tauriConf.bundle?.fileAssociations ?? [];
    expect(Array.isArray(assocs) && assocs.length > 0, "bundle.fileAssociations must be a non-empty array").toBe(true);
    const protopulse = assocs.find((a: { ext?: string[] }) =>
      Array.isArray(a.ext) && a.ext.includes("protopulse"),
    );
    expect(protopulse, "must include a fileAssociations entry with ext: ['protopulse']").toBeDefined();
  });

  it("declares the protopulse:// deep-link scheme", () => {
    const schemes = tauriConf.plugins?.["deep-link"]?.desktop?.schemes ?? [];
    expect(
      Array.isArray(schemes) && schemes.includes("protopulse"),
      "plugins.deep-link.desktop.schemes must include 'protopulse'",
    ).toBe(true);
  });
});
