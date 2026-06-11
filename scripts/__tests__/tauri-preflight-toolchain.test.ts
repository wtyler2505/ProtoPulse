import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const preflightPath = resolve(repoRoot, "scripts", "tauri-preflight.sh");
const toolchainPath = resolve(repoRoot, "src-tauri", "rust-toolchain.toml");

describe("Tauri preflight toolchain guards", () => {
  it("requires src-tauri/rust-toolchain.toml as a hard gate", () => {
    expect(existsSync(preflightPath)).toBe(true);
    const sh = readFileSync(preflightPath, "utf8");
    expect(sh.includes("Missing required $RUST_TOOLCHAIN_FILE")).toBe(true);
  });

  it("parses expected channel from rust-toolchain.toml and rejects CARGO_TOOLCHAIN mismatch", () => {
    const sh = readFileSync(preflightPath, "utf8");
    expect(sh.includes("RUST_TOOLCHAIN_EXPECTED")).toBe(true);
    expect(sh.includes("CARGO_TOOLCHAIN=$CARGO_TOOLCHAIN mismatches expected")).toBe(true);
  });

  it("runs rust-check through cargo_exec (toolchain-aware), not plain cargo", () => {
    const sh = readFileSync(preflightPath, "utf8");
    expect(sh.includes("run_required \"rust-check\" cargo_exec check")).toBe(true);
    expect(sh.includes("run_required \"rust-check\" cargo check")).toBe(false);
  });

  it("rust-toolchain.toml declares an explicit channel pin", () => {
    expect(existsSync(toolchainPath)).toBe(true);
    const toml = readFileSync(toolchainPath, "utf8");
    expect(/^\s*channel\s*=\s*"[^"]+"/m.test(toml)).toBe(true);
  });

  it("contains guardrail text for invalid .app bundle identifiers", () => {
    const sh = readFileSync(preflightPath, "utf8");
    expect(sh.includes("ends with .app")).toBe(true);
    expect(sh.includes("io.github.wtyler2505.protopulse")).toBe(true);
  });
});
