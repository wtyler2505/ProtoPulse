/**
 * Tauri-specta generated bindings freshness contract (Phase 1 Task 1.3).
 *
 * The Rust side owns command schemas via `tauri-specta`; bindings are
 * exported to `client/src/lib/bindings.ts` by running:
 *
 *     cargo run --bin export_bindings --manifest-path src-tauri/Cargo.toml
 *
 * This test asserts that:
 *   1. `client/src/lib/bindings.ts` exists.
 *   2. The generated file exports a `commands` object.
 *   3. Every Rust command currently registered (per src-tauri/src/lib.rs)
 *      has a corresponding TypeScript binding by name.
 *
 * If this test fails, regenerate the bindings:
 *   cd src-tauri && cargo run --bin export_bindings
 *
 * Then commit the resulting bindings.ts diff.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..", "..");
const bindingsPath = resolve(repoRoot, "client", "src", "lib", "bindings.ts");
const libRsPath = resolve(repoRoot, "src-tauri", "src", "lib.rs");

/**
 * Extract Rust command names from src-tauri/src/lib.rs.
 * Matches `#[tauri::command]` (optionally followed by attribute lines like
 * `#[specta::specta]`) then either `fn name` or `async fn name`.
 */
function rustCommandNames(): string[] {
  const libRs = readFileSync(libRsPath, "utf8");
  // Find each #[tauri::command] occurrence and scan forward for the next fn name.
  const names: string[] = [];
  const re = /#\[tauri::command\][\s\S]*?(?:async\s+)?fn\s+([a-z_][a-z_0-9]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(libRs)) !== null) {
    names.push(m[1]);
  }
  return names;
}

describe("Tauri-specta bindings freshness (Phase 1 Task 1.3)", () => {
  it("exports client/src/lib/bindings.ts", () => {
    expect(
      existsSync(bindingsPath),
      `Generated bindings file missing at ${bindingsPath}. Regenerate with: cargo run --bin export_bindings --manifest-path src-tauri/Cargo.toml`,
    ).toBe(true);
  });

  it("exports a typed commands object", () => {
    if (!existsSync(bindingsPath)) return; // first test will fail with the actionable message
    const contents = readFileSync(bindingsPath, "utf8");
    expect(
      /export\s+const\s+commands\s*=/.test(contents) ||
        /export\s+default\s*{[\s\S]*commands/.test(contents),
      `bindings.ts must export a 'commands' object (tauri-specta default). Got: ${contents.slice(0, 200)}`,
    ).toBe(true);
  });

  it("covers every Rust #[tauri::command] in the bindings", () => {
    if (!existsSync(bindingsPath)) return;
    const contents = readFileSync(bindingsPath, "utf8");
    const rustCommands = rustCommandNames();
    expect(rustCommands.length, "no Rust commands discovered — regex broken").toBeGreaterThan(0);

    const missing: string[] = [];
    for (const name of rustCommands) {
      // tauri-specta camelCases command names by default in the generated TS.
      // Match either snake_case or camelCase appearances near the `commands` object.
      const camel = name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const snakeRe = new RegExp(`\\b${name}\\b`);
      const camelRe = new RegExp(`\\b${camel}\\b`);
      if (!snakeRe.test(contents) && !camelRe.test(contents)) {
        missing.push(name);
      }
    }
    expect(
      missing,
      `bindings.ts is missing commands: ${missing.join(", ")}. Regenerate with: cargo run --bin export_bindings --manifest-path src-tauri/Cargo.toml`,
    ).toEqual([]);
  });
});
