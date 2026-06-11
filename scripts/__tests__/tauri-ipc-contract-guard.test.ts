import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const pkgPath = resolve(repoRoot, "package.json");
const guardPath = resolve(repoRoot, "scripts", "ci", "guard-legacy-ipc-names.sh");

describe("IPC contract guard", () => {
  it("ships executable guard script for legacy invoke names", () => {
    expect(existsSync(guardPath)).toBe(true);
    if (existsSync(guardPath)) {
      const mode = statSync(guardPath).mode;
      expect((mode & 0o111) !== 0).toBe(true);
    }
  });

  it("guard checks for known legacy invoke command names", () => {
    if (!existsSync(guardPath)) return;
    const sh = readFileSync(guardPath, "utf8");
    expect(sh.includes("read_file_contents")).toBe(true);
    expect(sh.includes("write_file_contents")).toBe(true);
    expect(sh.includes("get_app_version")).toBe(true);
    expect(sh.includes("client/src/lib/tauri-api.ts")).toBe(true);
  });

  it("package.json exposes lint:ipc-contract and bindings sync-check scripts", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["lint:ipc-contract"]).toBe("bash scripts/ci/guard-legacy-ipc-names.sh");
    expect(pkg.scripts?.["tauri:bindings:sync-check"]).toBe(
      "npm run tauri:bindings:export && npm run tauri:bindings:verify",
    );
  });
});
