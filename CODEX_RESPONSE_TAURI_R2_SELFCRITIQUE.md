# Codex Response: Tauri v2 Migration Round 2 Self-Critique

**Review date:** 2026-05-10
**Scope:** Counter-critique of `CODEX_RESPONSE_TAURI.md` and `docs/audits/2026-05-09-tauri-v2-migration-phase0-codex-verify.md`.
**Status:** Planning/audit only. No `src-tauri/` files were edited.

## Executive Counter-Critique

Round 1 caught real drift, especially the global Node launch, generic `spawn_process`, broad plugin authority, command-name mismatch, and the 271-file storage footprint. The weakness is that Round 1 mixed three evidence grades in one voice: direct local verification, source-backed Tauri documentation, and architectural inference from partial inspection.

The plan should treat direct code findings as durable until the code changes, but it should not treat my phase-order proposal as proven. The next round must close the runtime topology, command authorization, and package/distribution unknowns before any `src-tauri/` implementation begins.

## Claim Register

| Round 1 claim | Confidence | Evidence grade | Reverification need |
|---|---|---|---|
| CSP is no longer null, but still allows `style-src 'unsafe-inline'` and broad localhost connections. | Verified | Local `src-tauri/tauri.conf.json` read in Round 1. | Re-read before edit because config can drift. |
| `withGlobalTauri` is false. | Verified | Local `src-tauri/tauri.conf.json` read in Round 1 plus Tauri config docs. | Low; re-read before final plan. |
| Production Express still uses global `node`. | Verified | Local `src-tauri/src/lib.rs` read in Round 1. | High before code edits; this is central to runtime topology. |
| `tauri.conf.json` lacks `bundle.externalBin` for Node. | Verified | Local `src-tauri/tauri.conf.json` read in Round 1. | High before choosing sidecar approach. |
| `spawn_process` accepts arbitrary command and args. | Verified | Local `src-tauri/src/lib.rs` read in Round 1. | High; this blocks security hardening. |
| `capabilities/default.json` does not constrain custom Rust commands. | Source-backed inference | Local capability file plus Tauri capabilities docs. | Reverify against current Tauri app-manifest restriction docs before implementation. |
| Broad shell/fs plugin permissions are granted. | Verified | Local capability file read in Round 1. | Re-read after any capability edits. |
| Vite lacks `base: './'`. | Verified | Local `vite.config.ts` read in Round 1. | Re-read before build smoke. |
| Missing `[profile.release]`. | Verified | Local `src-tauri/Cargo.toml` read in Round 1. | Re-read before release-profile work. |
| Local Tauri CLI was behind npm latest. | Verified at time | Local CLI and npm view at review time. | High drift; re-run immediately before dependency pinning. |
| Frontend invokes `read_file_contents`, `write_file_contents`, `get_app_version`, but Rust registers `read_file`, `write_file`, `get_version`. | Verified | Local frontend and Rust code read in Round 1. | High; must become an automated IPC contract test. |
| Desktop bridge seemed mostly self-contained. | Inferred | Shallow search from Round 1. | High; requires full caller graph and runtime smoke. |
| `localStorage`/`sessionStorage` touches 271 client files. | Verified count | `rg -l "localStorage|sessionStorage" client/src | wc -l`. | Re-run with excludes/classification; count alone is not design insight. |
| Devtools are exposed in the production surface. | Verified + inferred risk | Local Cargo feature and menu code read in Round 1. | Re-read and decide intended release behavior. |
| Capability hardening before command inventory is unsafe. | Inferred | Derived from custom command and capability docs. | Needs threat model, not just agreement. |
| Node sidecar should not be assumed inevitable. | Inferred | Derived from ADR tension and current global Node debt. | Highest-priority Round 3 unknown. |
| Updater should follow signing/CI/release-channel design. | Source-backed inference | Tauri updater docs plus Round 2 research now strengthens it. | Reverify exact updater artifact semantics before wiring. |
| Storage migration should move earlier. | Inferred from verified count | Count plus examples from quick code search. | Needs bucketed storage inventory. |
| Desktop lifecycle should move earlier. | Inferred, now source-backed | Round 1 Tauri deep-link/single-instance docs; Round 2 file association/deep-link research strengthens it. | Needs ProtoPulse project-open decision. |
| Proposed Phase 0.5 through Phase 8 shape is preferable to Phase 0 order. | Assumed/inferred | Engineering judgment from findings. | Must be revised with Round 2 research and agreed in Round 3. |
| IPC contract and generated tests are needed. | Inferred from verified mismatch | One real mismatch proves risk, not full coverage. | Needs actual test design. |
| Third-party serial/HID plugin provenance must be audited. | Inferred | Round 1 did not research these plugins deeply. | Still open. |
| Do not assume official Tauri i18n plugin. | Source-backed negative inference | Based on official plugin index observed in docs. | Reverify if i18n enters scope. |
| WebView2 strategy should be reframed as Windows runtime/installer policy. | Inferred | Not deeply verified in Round 1. | Needs Microsoft/Tauri installer research if Windows release path starts. |
| Linux packaging can affect single-instance/hardware access. | Source-backed inference | Tauri single-instance docs and Round 2 Linux distribution research. | Needs distro-specific test matrix. |
| Secrets/key custody needs Tyler ownership. | Assumed security governance | General release/security principle, not code evidence. | Must become an explicit decision record. |
| Context7 failure should be retried. | Verified tooling caveat | Round 1 tool calls returned `user cancelled MCP tool call`. | Still true; Round 2 MCP research_start also returned that once. |

## Places Round 1 Leaned Too Hard

- I treated the Tauri documentation snapshot as if it were enough for implementation. It is enough for planning, not enough for exact config edits, especially updater/signing and app-manifest command restrictions.
- I used a single `rg` count for storage scope. It proved under-scoping, but it did not prove which files are real production data, tests, mock caches, secret scratchpads, or harmless UI preferences.
- I inferred desktop bridge isolation from quick search. That could miss dynamic imports, wrapper re-exports, feature flags, and dead code.
- I framed `devtools` as production risk without running a packaged release or checking whether the feature is gated by build profile elsewhere.
- I called Tauri CLI drift "minor" based on npm latest at one moment. Dependency drift is time-sensitive and must be checked live during the dependency phase.
- I assumed the updater phase should move later from docs and experience. Round 2 now supports that, but Round 1 alone did not include Windows/macOS signing, tauri-action, or key-custody depth.

## Failure Scenarios Round 1 Did Not Fully Absorb

1. **Operational:** A Node sidecar works in dev but fails in packaged Windows/macOS builds because target-triple binaries, working directories, environment variables, or code signing are wrong.
2. **Security:** A compromised frontend still reaches arbitrary native authority through a custom command even after plugin capabilities are narrowed.
3. **Distribution:** Windows users see SmartScreen warnings because OV reputation is not established, or signing moves to a cloud/HSM workflow that the CI plan cannot access.
4. **macOS trust:** Notarization fails or stalls because hardened runtime, entitlements, embedded sidecars, and Developer ID signing are not treated as one bundle-level problem.
5. **User trust:** Updater prompts or telemetry/crash capture are added before consent, rollback, diagnostics export, and privacy redaction are designed.
6. **Supply chain:** Rust/npm dependencies pass local tests but lack provenance, audit policy, SBOM traceability, or isolated release runner guarantees.
7. **Linux:** AppImage, deb, Flatpak, and Snap differ enough that single instance, deep links, hardware access, and auto-update behavior diverge by package format.
8. **Architecture:** Express remains as permanent privileged backend by inertia, so the team signs and updates a runtime topology that should have been reduced or retired.
9. **Data integrity:** The storage migration turns into scattered `localStorage` replacements without a project file/database/secret boundary, causing data loss or plaintext-at-rest regression.
10. **CI credibility:** A release pipeline builds artifacts but never launches packaged apps, so WebView path bugs, missing sidecars, and blank screens escape.

## Highest-Risk Unknowns For Round 3

1. **Runtime topology:** Is ProtoPulse choosing a temporary Express/Node sidecar, a permanent hybrid sidecar, or a Rust-native privileged backend? Every sidecar, CSP, updater, CI, and signing decision depends on this.
2. **Native authority contract:** What exact Rust commands/plugins are allowed, which frontend paths call them, what schemas/timeouts/scopes apply, and how will tests prevent command-name drift?
3. **Distribution trust model:** Which Windows signing path, macOS notarization path, updater key custody, release channel, and CI runner model will Tyler actually use?

## Round 3 Gate

No `src-tauri/` edits should start until Round 3 produces a short decision record for those three unknowns and converts the verified Round 1 findings into an executable IPC/security/storage/release checklist.
