# Tauri Migration Peer Consensus: 9 Round 6 Decisions

**Status:** Peer-ratified
**Date:** 2026-05-10
**Participants:** Claude Code and Codex
**Inputs:** `docs/decisions/2026-05-10-tauri-tyler-decisions-needed.md`, `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md`, `docs/decisions/2026-05-10-adr-release-trust-model.md`, and `docs/decisions/2026-05-10-tauri-ipc-contract.md`

## 1. Express-less Offline Mode

**Claude position:** Accept the proposed default: hybrid local/web split is acceptable for this migration; Express-less offline mode is deferred to a later embedded/field program.

**Codex position:** Accept the proposed default.

**Consensus:** RATIFIED — proceed.

**Rationale:** Path C already creates the reversible `DesktopAPI` boundary. Forcing Express-less operation before the desktop bridge, IPC parity, storage boundaries, and packaged smoke are proven would expand the migration beyond its current reviewable scope.

**Dissents:** None.

## 2. Temporary Local Express Compatibility Sidecar

**Claude position:** Accept the proposed default: a temporary non-privileged Express compatibility sidecar is acceptable only with loopback auth, health checks, bounded logs, explicit shutdown, target-triple packaging, and signing/notarization coverage before distribution.

**Codex position:** Accept the proposed default.

**Consensus:** RATIFIED — proceed.

**Rationale:** The ADR correctly rejects hardening the current global-`node` launch path by inertia. A sidecar remains available as a compatibility adapter, but it cannot own privileged hardware, file, process, updater, or release-sensitive authority.

**Dissents:** None.

## 3. Project Container Source Of Truth

**Claude position:** Accept the proposed default: use a mixed project-folder layout with a manifest, versioned project data, generated artifacts, attachments, and optional local database files.

**Codex position:** Accept the proposed default.

**Consensus:** RATIFIED — proceed.

**Rationale:** This is the highest-blast-radius decision because the route classification audit ties it to 23 of 35 active route modules and 129 of 211 Express endpoints. The mixed folder layout is the lowest-regret default because it is inspectable for makers, compatible with attachments/generated artifacts, and still leaves room for `.protopulse` archive and SQLite adapters.

**Dissents:** None.

## 4. First Desktop Preview Hardware Paths

**Claude position:** Accept the proposed default: first desktop preview requires read-only project file workflows; serial monitor, Arduino CLI compile/upload, and HID remain behind Phase 9 authority and device-validation gates.

**Codex position:** Accept the proposed default.

**Consensus:** RATIFIED — proceed.

**Rationale:** The current Tauri bridge is latent and the generic `spawn_process` command remains unsafe authority. Promoting hardware workflows before typed commands, scoped capabilities, no-device tests, mock-device tests, and real-device acceptance would put the preview on the least stable surface.

**Dissents:** None.

## 5. Windows Signing Path

**Claude position:** Accept the proposed default: keep Windows artifacts dev-preview-only until Azure Artifact Signing eligibility is confirmed; Azure remains the target public path, with OV/HSM as fallback only if eligibility or setup blocks Azure.

**Codex position:** Accept the proposed default.

**Consensus:** RATIFIED — proceed.

**Rationale:** Signing is a release-trust input, not an implementation shortcut. Developer previews can remain clearly labeled while CI, artifact reproducibility, and account eligibility are established.

**Dissents:** None.

## 6. macOS Distribution Path

**Claude position:** Accept the proposed default: keep macOS dev-preview-only until a paid Apple Developer account is confirmed; require Developer ID Application signing plus notarization for public macOS preview.

**Codex position:** Accept the proposed default.

**Consensus:** RATIFIED — proceed.

**Rationale:** The release ADR correctly couples macOS signing, hardened runtime, entitlements, sidecars, and notarization as one bundle-level trust story. Local preview builds can stay ad-hoc signed until public distribution is real.

**Dissents:** None.

## 7. Updater Private-Key Custody

**Claude position:** Accept the proposed default: no updater for the first developer preview; when updater work begins, default to a Tyler-owned local offline private key unless a cloud KMS is explicitly selected.

**Codex position:** Accept the proposed default.

**Consensus:** RATIFIED — proceed.

**Rationale:** Updaters amplify trust mistakes. The public key can be wired later, but private-key custody must remain outside agent ownership and should follow signed, reproducible artifacts rather than precede them.

**Dissents:** None.

## 8. Linux ARM / Raspberry Pi Scope

**Claude position:** Accept the proposed default: treat Linux ARM/Raspberry Pi as a separate embedded-device program and keep Phase 12 focused on direct desktop Linux distribution after x64 deb/AppImage confidence exists.

**Codex position:** Accept the proposed default.

**Consensus:** RATIFIED — proceed.

**Rationale:** ARM/Pi adds different WebView runtime assumptions, packaging dependencies, device permissions, hardware validation, and smoke-test requirements. It should not dilute the first desktop release matrix.

**Dissents:** None.

## 9. Crash Reporting Source-Map Custody

**Claude position:** Accept the proposed default: keep hidden source maps as local-only developer-preview artifacts; do not upload maps to crash-reporting services until diagnostics consent, redaction, retention, and access-control policy are ratified.

**Codex position:** Accept the proposed default.

**Consensus:** RATIFIED — proceed.

**Rationale:** The current Vite config already uses hidden source maps, which supports local diagnostics without exposing maps through public bundles. Remote upload can wait until observability policy and access controls exist.

**Dissents:** None.

## Consensus Summary

Claude and Codex ratify all nine proposed defaults. Phase 1 can proceed under Path C: Express remains web/cloud compatibility by default, any desktop compatibility sidecar is non-privileged and conditional, desktop authority moves through typed Rust/Tauri boundaries, and public release trust work remains separate from developer-preview scaffolding.
