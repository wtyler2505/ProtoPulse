/**
 * Native authority boundary contract (Phase 2 Tasks 2.1 + 2.2).
 *
 * Two enforcement layers, both checked here as static-parse contracts:
 *
 *   1. `src-tauri/build.rs` MUST call `tauri_build::AppManifest::new().commands(&[...])`
 *      with an explicit allowlist of accessible custom commands. The
 *      allowlist MUST NOT include `spawn_process` (the historical generic
 *      RCE primitive). Phase 9 will add typed sidecar replacements; Phase 2
 *      removes the unrestricted authority.
 *
 *   2. `src-tauri/capabilities/default.json` MUST scope filesystem permissions
 *      to specific paths (no global `fs:allow-*` without scope), MUST hard-deny
 *      `$APPLOCALDATA/EBWebView/**` (Windows WebView2 cookie/token store), and
 *      production CSP in `tauri.conf.json` MUST NOT widen `connect-src` to
 *      `http://localhost:*` (dev-only).
 *
 * Source URLs:
 *   - Custom command restriction: https://v2.tauri.app/security/capabilities
 *   - fs:scope patterns:           https://v2.tauri.app/security/scope
 *   - $APPLOCALDATA/EBWebView risk: https://v2.tauri.app/security/scope (canonical example)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..", "..");
const buildRsPath = resolve(repoRoot, "src-tauri", "build.rs");
const capabilitiesPath = resolve(repoRoot, "src-tauri", "capabilities", "default.json");
const tauriConfPath = resolve(repoRoot, "src-tauri", "tauri.conf.json");
const libRsPath = resolve(repoRoot, "src-tauri", "src", "lib.rs");

const buildRs = readFileSync(buildRsPath, "utf8");
const capabilities = JSON.parse(readFileSync(capabilitiesPath, "utf8"));
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
const libRs = readFileSync(libRsPath, "utf8");

describe("Phase 2.1 — generic process authority removed", () => {
  it("build.rs calls AppManifest::new().commands(&[...])", () => {
    expect(
      /AppManifest::new\(\)\s*\.commands/.test(buildRs),
      "build.rs must restrict registered commands via AppManifest::commands(&[...]). Source: https://v2.tauri.app/security/capabilities",
    ).toBe(true);
  });

  it("the AppManifest allowlist does NOT include spawn_process", () => {
    // Match `.commands(&["a", "b", "c"])` and verify spawn_process is absent.
    const match = buildRs.match(/\.commands\(\s*&?\s*\[([^\]]*)\]/);
    expect(match, "could not find .commands(&[...]) call in build.rs").not.toBeNull();
    const allowlist = match![1];
    expect(allowlist.includes("spawn_process")).toBe(false);
  });

  it("lib.rs does not register spawn_process in specta_builder()", () => {
    // The collect_commands![...] macro lives inside specta_builder().
    const match = libRs.match(/collect_commands!\s*\[([^\]]*)\]/s);
    expect(match, "could not find collect_commands![...] in lib.rs").not.toBeNull();
    expect(match![1].includes("spawn_process")).toBe(false);
  });

  it("lib.rs no longer defines the spawn_process function", () => {
    expect(
      /async\s+fn\s+spawn_process\s*\(/.test(libRs),
      "the spawn_process Rust function must be deleted (replaced with typed commands in Phase 9)",
    ).toBe(false);
  });
});

describe("Phase 2.2 — capability scope + CSP hardening", () => {
  it("capabilities deny $APPLOCALDATA/EBWebView/** (WebView2 token store)", () => {
    const perms = capabilities.permissions ?? [];
    // Either as part of an fs:scope deny entry or an explicit deny-rule.
    const hasDeny = perms.some((p: unknown) => {
      if (!p || typeof p !== "object") return false;
      const obj = p as { deny?: Array<unknown> };
      if (!Array.isArray(obj.deny)) return false;
      return obj.deny.some((d) => {
        if (typeof d === "string") return d.includes("EBWebView");
        if (d && typeof d === "object" && "path" in d) {
          return String((d as { path: unknown }).path).includes("EBWebView");
        }
        return false;
      });
    });
    expect(
      hasDeny,
      "capabilities must include a deny rule for $APPLOCALDATA/EBWebView/** to protect Windows WebView2 cookie/token storage",
    ).toBe(true);
  });

  it("capabilities scope fs:allow-* with allow paths instead of unscoped grants", () => {
    const perms = capabilities.permissions ?? [];
    // Find unscoped string-form fs:allow- grants (e.g., "fs:allow-read-file" alone).
    const unscopedFsGrants = perms.filter(
      (p: unknown) => typeof p === "string" && /^fs:allow-/.test(p),
    );
    expect(
      unscopedFsGrants,
      "fs:allow-* permissions must be scoped via { identifier: 'fs:allow-...', allow: [{path: '$APPDATA/...'}] } objects, not bare strings. Source: https://v2.tauri.app/security/scope",
    ).toEqual([]);
  });

  it("tauri.conf.json production CSP does not allow http://localhost:*", () => {
    const csp = tauriConf.app?.security?.csp ?? "";
    expect(
      /connect-src[^;]*http:\/\/localhost:\*/.test(csp),
      "production CSP must not include http://localhost:* in connect-src (dev-only). Split dev/prod CSP if local backend is needed in development.",
    ).toBe(false);
  });

  it("tauri.conf.json keeps withGlobalTauri: false", () => {
    expect(tauriConf.app?.withGlobalTauri).toBe(false);
  });
});
