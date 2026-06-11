/**
 * Phase 6 — Release Hardening Without Public Distribution.
 *
 * 6.1 Cargo release profile + devtools gating:
 *     - `src-tauri/Cargo.toml` has `[profile.release]` with the master-roadmap
 *       size-optimization settings: lto = "fat", codegen-units = 1,
 *       opt-level = "z", strip = true, panic = "abort".
 *     - `tauri` crate feature `devtools` is debug-only (gated via cfg or feature flag).
 *     - `src-tauri/src/lib.rs` gates the "Toggle Developer Tools" menu item
 *       and handler behind `cfg(debug_assertions)` so release builds don't ship it.
 *
 * 6.2 Debug artifact policy:
 *     - `vite.config.ts` keeps `sourcemap: 'hidden'` (maps generated locally,
 *       not referenced from JS bundles, never published).
 *     - `scripts/ci/tauri-packaged-smoke.sh` asserts no `.map` files appear
 *       in the produced bundle.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const cargoTomlPath = resolve(repoRoot, "src-tauri", "Cargo.toml");
const libRsPath = resolve(repoRoot, "src-tauri", "src", "lib.rs");
const viteConfPath = resolve(repoRoot, "vite.config.ts");
const smokePath = resolve(repoRoot, "scripts", "ci", "tauri-packaged-smoke.sh");

describe("Phase 6.1 — Cargo release profile", () => {
  it("Cargo.toml declares [profile.release] with size-optimization settings", () => {
    const cargo = readFileSync(cargoTomlPath, "utf8");
    expect(/\[profile\.release\]/.test(cargo)).toBe(true);
    expect(/lto\s*=\s*"fat"/.test(cargo)).toBe(true);
    expect(/codegen-units\s*=\s*1/.test(cargo)).toBe(true);
    expect(/opt-level\s*=\s*"z"/.test(cargo)).toBe(true);
    expect(/strip\s*=\s*true/.test(cargo)).toBe(true);
    expect(/panic\s*=\s*"abort"/.test(cargo)).toBe(true);
  });

  it("tauri `devtools` feature is gated to debug builds (not unconditional)", () => {
    const cargo = readFileSync(cargoTomlPath, "utf8");
    // Either feature-flagged with `tauri/devtools` under [features], or the
    // unconditional `features = ["devtools"]` on the bare `tauri` dep is gone.
    const unconditionalDevtools = /tauri\s*=\s*\{[^}]*features\s*=\s*\[[^\]]*"devtools"[^\]]*\][^}]*\}/s.test(cargo);
    expect(
      unconditionalDevtools,
      "tauri dep must NOT unconditionally enable the devtools feature in [dependencies]. Move it to a debug-only feature flag.",
    ).toBe(false);
  });
});

describe("Phase 6.1 — devtools gating in lib.rs", () => {
  it("`toggle-devtools` menu item is wrapped in cfg(debug_assertions)", () => {
    const lib = readFileSync(libRsPath, "utf8");
    // The MenuItem creation for "toggle-devtools" should be inside a
    // #[cfg(debug_assertions)] block (or otherwise compile-out in release).
    const togglePattern = /#\[cfg\(debug_assertions\)\][\s\S]{0,400}toggle-devtools/;
    expect(
      togglePattern.test(lib),
      "the 'toggle-devtools' MenuItem must live inside a #[cfg(debug_assertions)] block so release builds ship without the dev menu",
    ).toBe(true);
  });

  it("the menu handler for 'toggle-devtools' is also debug-gated", () => {
    const lib = readFileSync(libRsPath, "utf8");
    // The handler arm "toggle-devtools" => { window.open_devtools() ... } must be cfg-gated.
    // Match either #[cfg(...)] on the arm or surrounding the handler call.
    const guard = /#\[cfg\(debug_assertions\)\][\s\S]{0,200}"toggle-devtools"/;
    const inverseFree = /"toggle-devtools"\s*=>\s*\{[\s\S]*?open_devtools\(\)[\s\S]*?\}/;
    // At least one of: explicit cfg-gate, OR the handler arm body is empty/no-op outside debug.
    const arm = inverseFree.test(lib);
    const gated = guard.test(lib);
    expect(
      gated || !arm,
      "the toggle-devtools menu handler must be #[cfg(debug_assertions)] (or the arm body must be empty in release)",
    ).toBe(true);
  });
});

describe("Phase 6.2 — debug artifact policy", () => {
  it("vite.config.ts keeps sourcemap: 'hidden' (no map URL referenced in bundles)", () => {
    const conf = readFileSync(viteConfPath, "utf8");
    expect(/sourcemap\s*:\s*['"]hidden['"]/.test(conf)).toBe(true);
  });

  it("packaged-smoke script asserts no .map files in the produced bundle", () => {
    expect(existsSync(smokePath)).toBe(true);
    if (!existsSync(smokePath)) return;
    const sh = readFileSync(smokePath, "utf8");
    expect(
      /\.map/.test(sh),
      "packaged-smoke must reference .map files (asserting they're absent from the public bundle)",
    ).toBe(true);
  });
});
