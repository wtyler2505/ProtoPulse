/**
 * Frontend refactor contract (Phase 1 Task 1.4).
 *
 * After Task 1.3 generated `client/src/lib/bindings.ts`, the bridge in
 * `client/src/lib/tauri-api.ts` MUST consume those typed `commands.X()`
 * calls instead of raw `invoke('<snake_case>', ...)` for app-defined Rust
 * commands. The raw command-name strings that drifted in pre-Task-1.3 were:
 *
 *   - `read_file_contents`   ↔  Rust `read_file`
 *   - `write_file_contents`  ↔  Rust `write_file`
 *   - `get_app_version`      ↔  Rust `get_version`
 *
 * tauri-specta camelCases the generated TS names (`readFile`, `writeFile`,
 * `getVersion`) and routes payload key normalization automatically, so the
 * drift is impossible once `tauri-api.ts` imports from `./bindings`.
 *
 * Plugin calls (dialog, opener, fs) stay as plugin imports — those don't
 * route through `commands`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tauriApiSrc = readFileSync(
  resolve(__dirname, "..", "tauri-api.ts"),
  "utf8",
);

describe("tauri-api.ts consumes generated commands (Phase 1 Task 1.4)", () => {
  it("imports from ./bindings", () => {
    expect(
      /from\s+["']\.\/bindings["']/.test(tauriApiSrc),
      "tauri-api.ts must import from './bindings' to consume the generated tauri-specta surface",
    ).toBe(true);
  });

  it("does not call raw invoke('read_file_contents')", () => {
    expect(/invoke[^(]*\(\s*["']read_file_contents["']/.test(tauriApiSrc)).toBe(false);
  });

  it("does not call raw invoke('write_file_contents')", () => {
    expect(/invoke[^(]*\(\s*["']write_file_contents["']/.test(tauriApiSrc)).toBe(false);
  });

  it("does not call raw invoke('get_app_version')", () => {
    expect(/invoke[^(]*\(\s*["']get_app_version["']/.test(tauriApiSrc)).toBe(false);
  });

  it("calls commands.readFile / commands.writeFile / commands.getVersion / commands.getPlatform", () => {
    expect(/commands\.readFile\s*\(/.test(tauriApiSrc)).toBe(true);
    expect(/commands\.writeFile\s*\(/.test(tauriApiSrc)).toBe(true);
    expect(/commands\.getVersion\s*\(/.test(tauriApiSrc)).toBe(true);
    expect(/commands\.getPlatform\s*\(/.test(tauriApiSrc)).toBe(true);
  });
});
