/**
 * Phase 5 — CI matrix + supply-chain baseline + packaged smoke.
 *
 * Static contract checks on:
 *   - `.github/workflows/tauri-build.yml` — cross-platform matrix
 *     (Win-x64, macOS x64+arm64, Linux x64 per release-trust ADR Decision 4)
 *   - `scripts/ci/tauri-packaged-smoke.sh` — packaged-build smoke runner
 *   - `scripts/ci/supply-chain-check.sh` — cargo audit + npm audit + lockfile + SBOM placeholders
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const workflowPath = resolve(repoRoot, ".github", "workflows", "tauri-build.yml");
const smokeScriptPath = resolve(repoRoot, "scripts", "ci", "tauri-packaged-smoke.sh");
const supplyChainPath = resolve(repoRoot, "scripts", "ci", "supply-chain-check.sh");
const tauriConfPath = resolve(repoRoot, "src-tauri", "tauri.conf.json");

describe("Phase 5.1 — tauri-build.yml CI matrix", () => {
  it("workflow file exists", () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  it("declares the release-trust matrix (Win-x64, macOS x64+arm64, Linux x64)", () => {
    if (!existsSync(workflowPath)) return;
    const yml = readFileSync(workflowPath, "utf8");
    expect(yml).toMatch(/ubuntu-latest|ubuntu-22|ubuntu-24/);
    expect(yml).toMatch(/macos-latest|macos-13/);
    expect(yml).toMatch(/macos-14|macos-15|macos-arm/);
    expect(yml).toMatch(/windows-latest|windows-2022/);
  });

  it("invokes tauri-apps/tauri-action and uploads artifacts", () => {
    if (!existsSync(workflowPath)) return;
    const yml = readFileSync(workflowPath, "utf8");
    expect(yml.includes("tauri-apps/tauri-action")).toBe(true);
    expect(/upload-artifact|uploadArtifact/i.test(yml)).toBe(true);
  });

  it("installs Linux WebKit2GTK system deps for Tauri builds", () => {
    if (!existsSync(workflowPath)) return;
    const yml = readFileSync(workflowPath, "utf8");
    expect(/libwebkit2gtk|webkit2gtk/.test(yml)).toBe(true);
  });

  it("runs npm run check and npm run build before tauri build", () => {
    if (!existsSync(workflowPath)) return;
    const yml = readFileSync(workflowPath, "utf8");
    expect(/npm run check/.test(yml)).toBe(true);
    expect(/npm run build|npm ci/.test(yml)).toBe(true);
  });
});

describe("Phase 5.1 — packaged-smoke runner", () => {
  it("scripts/ci/tauri-packaged-smoke.sh exists and is executable", () => {
    expect(existsSync(smokeScriptPath)).toBe(true);
    if (existsSync(smokeScriptPath)) {
      const mode = statSync(smokeScriptPath).mode;
      // 0o111 = executable bits (any of user/group/other)
      expect((mode & 0o111) !== 0).toBe(true);
    }
  });

  it("packaged-smoke runs `tauri build --debug` and reports artifact paths", () => {
    if (!existsSync(smokeScriptPath)) return;
    const sh = readFileSync(smokeScriptPath, "utf8");
    expect(/tauri\s+build/.test(sh)).toBe(true);
    expect(/target\/debug\/bundle/.test(sh)).toBe(true);
    expect(/EXPECTED_DEB_PATH/.test(sh)).toBe(true);
    expect(/protopulse_\$\{APP_VERSION\}_\$\{DEB_ARCH\}\.deb/.test(sh)).toBe(true);
  });
});

describe("Phase 5.2 — supply-chain baseline", () => {
  it("scripts/ci/supply-chain-check.sh exists and is executable", () => {
    expect(existsSync(supplyChainPath)).toBe(true);
    if (existsSync(supplyChainPath)) {
      const mode = statSync(supplyChainPath).mode;
      expect((mode & 0o111) !== 0).toBe(true);
    }
  });

  it("runs cargo audit and npm audit", () => {
    if (!existsSync(supplyChainPath)) return;
    const sh = readFileSync(supplyChainPath, "utf8");
    expect(/cargo\s+audit/.test(sh)).toBe(true);
    expect(/npm\s+audit/.test(sh)).toBe(true);
  });

  it("checks for committed lockfiles (Cargo.lock, package-lock.json)", () => {
    if (!existsSync(supplyChainPath)) return;
    const sh = readFileSync(supplyChainPath, "utf8");
    expect(/Cargo\.lock/.test(sh)).toBe(true);
    expect(/package-lock\.json/.test(sh)).toBe(true);
  });

  it("references SLSA/SBOM provenance placeholders for the public-release gate", () => {
    if (!existsSync(supplyChainPath)) return;
    const sh = readFileSync(supplyChainPath, "utf8");
    expect(/SLSA|SBOM|provenance|attestation/i.test(sh)).toBe(true);
  });
});

describe("Bundle identifier policy", () => {
  it("tauri identifier is reverse-DNS and does not end with .app", () => {
    const conf = JSON.parse(readFileSync(tauriConfPath, "utf8")) as { identifier?: string };
    const identifier = conf.identifier ?? "";
    expect(identifier.length).toBeGreaterThan(0);
    expect(identifier.endsWith(".app")).toBe(false);
    expect(identifier).toMatch(/^[a-z0-9]+(\.[a-z0-9-]+)+$/);
  });
});
