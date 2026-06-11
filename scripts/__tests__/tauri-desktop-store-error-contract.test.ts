import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const desktopStorePath = resolve(repoRoot, "src-tauri", "src", "desktop_store.rs");
const src = readFileSync(desktopStorePath, "utf8");

describe("desktop_store error-contract coverage", () => {
  it("keeps explicit credential-bearing rejection message for write/read paths", () => {
    expect(src.includes("credential-bearing")).toBe(true);
    expect(src.includes("user-setting key '{}' rejected (credential-bearing)")).toBe(true);
  });

  it("keeps payload-size contract wording with size + max bytes", () => {
    expect(src.includes("payload too large")).toBe(true);
    expect(src.includes("max {} bytes")).toBe(true);
  });

  it("has narrow unit tests for invalid JSON and payload-size errors", () => {
    expect(src.includes("parse_json_string_returns_labeled_error_for_invalid_payload")).toBe(true);
    expect(src.includes("check_payload_size_error_contract_includes_label_and_limits")).toBe(true);
  });
});
