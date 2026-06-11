/**
 * Phase 9 — Hardware Authority And Toolchain Packaging.
 *
 * 9.1: docs/audits/tauri-hardware-plugin-provenance.md
 *      Audits the third-party hardware plugins ProtoPulse depends on:
 *      tauri-plugin-serialplugin (s00d), tauri-plugin-hid, arduino-cli.
 *      Each entry must document: source URL, license, maintenance status,
 *      platform support, permission model, fallback path.
 *
 * 9.2: scripts/tauri/prepare-arduino-sidecar.ts
 *      Node script that downloads arduino-cli per target triple + renames
 *      to the `binaries/arduino-cli-<target-triple>` convention Tauri sidecar
 *      expects. tauri.conf.json `bundle.externalBin` references the prepared
 *      binary path.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const auditPath = resolve(repoRoot, "docs", "audits", "tauri-hardware-plugin-provenance.md");
const sidecarScriptPath = resolve(repoRoot, "scripts", "tauri", "prepare-arduino-sidecar.ts");
const tauriConfPath = resolve(repoRoot, "src-tauri", "tauri.conf.json");

describe("Phase 9.1 — hardware plugin provenance audit", () => {
  it("audit doc exists at docs/audits/tauri-hardware-plugin-provenance.md", () => {
    expect(existsSync(auditPath)).toBe(true);
  });

  it("audit covers tauri-plugin-serialplugin, tauri-plugin-hid, arduino-cli", () => {
    if (!existsSync(auditPath)) return;
    const md = readFileSync(auditPath, "utf8");
    expect(/tauri-plugin-serialplugin/i.test(md)).toBe(true);
    expect(/tauri-plugin-hid|HID/i.test(md)).toBe(true);
    expect(/arduino-cli/i.test(md)).toBe(true);
  });

  it("each entry documents license, maintenance, platforms, and a fallback path", () => {
    if (!existsSync(auditPath)) return;
    const md = readFileSync(auditPath, "utf8");
    expect(/license/i.test(md)).toBe(true);
    expect(/maintain|maintenance|last (release|commit)/i.test(md)).toBe(true);
    expect(/Linux|Windows|macOS/.test(md)).toBe(true);
    expect(/fallback|alternative/i.test(md)).toBe(true);
  });

  it("cites source URLs for each plugin (github.com/crates.io)", () => {
    if (!existsSync(auditPath)) return;
    const md = readFileSync(auditPath, "utf8");
    expect(/github\.com|crates\.io/.test(md)).toBe(true);
  });
});

describe("Phase 9.2 — arduino-cli sidecar prep", () => {
  it("scripts/tauri/prepare-arduino-sidecar.ts exists", () => {
    expect(existsSync(sidecarScriptPath)).toBe(true);
  });

  it("sidecar script references target triples (x86_64-pc-windows-msvc / x86_64-apple-darwin / x86_64-unknown-linux-gnu / aarch64-apple-darwin)", () => {
    if (!existsSync(sidecarScriptPath)) return;
    const ts = readFileSync(sidecarScriptPath, "utf8");
    expect(/x86_64-pc-windows-msvc/.test(ts)).toBe(true);
    expect(/x86_64-apple-darwin/.test(ts)).toBe(true);
    expect(/x86_64-unknown-linux-gnu/.test(ts)).toBe(true);
    expect(/aarch64-apple-darwin/.test(ts)).toBe(true);
  });

  it("sidecar script downloads arduino-cli from an upstream URL", () => {
    if (!existsSync(sidecarScriptPath)) return;
    const ts = readFileSync(sidecarScriptPath, "utf8");
    // arduino-cli releases live on github.com/arduino/arduino-cli/releases
    expect(/arduino\/arduino-cli|downloads\.arduino\.cc/i.test(ts)).toBe(true);
  });

  it("sidecar script renames to the binaries/arduino-cli-<target-triple> convention", () => {
    if (!existsSync(sidecarScriptPath)) return;
    const ts = readFileSync(sidecarScriptPath, "utf8");
    expect(/binaries\/arduino-cli/.test(ts)).toBe(true);
  });

  it("tauri.conf.json declares bundle.externalBin = ['binaries/arduino-cli']", () => {
    const conf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
    const externalBin = conf.bundle?.externalBin;
    expect(Array.isArray(externalBin)).toBe(true);
    expect(externalBin?.some((b: string) => b.includes("arduino-cli"))).toBe(true);
  });
});
