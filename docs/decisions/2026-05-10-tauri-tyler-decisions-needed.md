# Tauri Migration Decisions Needed From Tyler

**Status:** Round 5 ratification packet
**Date:** 2026-05-10
**Purpose:** Compile the nine open Tyler questions raised by the Round 3 ADR set before agents begin mutating Phase 1 and later release/runtime paths.

Scope note: the Round 5 handoff enumerates these nine ratification questions from the runtime-topology and release-trust ADRs. The IPC contract ADR contributes the separate supersession note in `docs/decisions/2026-05-10-tauri-ipc-contract.md`.

## 1. Express-less Offline Mode

**Source ADR + line reference:** `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md:41`

**Question (verbatim):** Should desktop eventually support an **Express-less offline mode** for embedded/field devices, or is a hybrid local/web split acceptable long term?

**Proposed default:** Treat the hybrid local/web split as acceptable for the migration, and defer Express-less offline mode to a later embedded/field program. This keeps Phase 1 focused on the desktop boundary and avoids forcing a full backend rewrite before the scaffold is testable.

**Reversibility:** The `DesktopAPI` boundary keeps this reversible. Individual workflows can later move from Express compatibility to Rust/native modules without changing every frontend caller.

**Blocking?** Not blocking Phase 1. Blocks only a future Express-less embedded/offline roadmap decision.

## 2. Temporary Local Express Compatibility Sidecar

**Source ADR + line reference:** `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md:42`

**Question (verbatim):** Is a temporary local Express compatibility sidecar acceptable for business logic that is expensive to port, if it has no privileged hardware/file/process authority?

**Proposed default:** Yes, temporarily, but only as a non-privileged compatibility service with loopback auth, health checks, bounded logs, explicit shutdown, target-triple packaging, and signing/notarization coverage before distribution.

**Reversibility:** A sidecar can be removed method by method behind `DesktopAPI`; privileged work must not depend on it, so retiring it should not reopen hardware/file/process authority.

**Blocking?** Not blocking Phase 1. Phase 3 should not finalize runtime topology without either Tyler ratification or this default.

## 3. Project Container Source Of Truth

**Source ADR + line reference:** `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md:43`

**Question (verbatim):** What project container should become the durable source of truth: single `.protopulse` file, project folder bundle, SQLite database, or a mixed project-folder layout?

**Proposed default:** Use a mixed project-folder layout: a manifest plus versioned project data, generated artifacts, attachments, and optional local database files under a project folder. It fits maker workflows, is inspectable, and avoids packing every artifact into one opaque file too early.

**Reversibility:** The manifest can gain export/import adapters for a single `.protopulse` archive or a SQLite-backed package later. Migration markers should be written before any mutating storage phase.

**Blocking?** Not blocking Phase 1. Phase 3 storage migration should use this default unless Tyler chooses a different container.

## 4. First Desktop Preview Hardware Paths

**Source ADR + line reference:** `docs/decisions/2026-05-10-adr-tauri-runtime-topology.md:44`

**Question (verbatim):** Which hardware paths are mandatory for the first desktop preview: serial monitor, Arduino CLI compile/upload, HID, or read-only project file workflows?

**Proposed default:** Make read-only project file workflows mandatory for the first desktop preview. Keep serial monitor, Arduino CLI compile/upload, and HID behind Phase 9 authority and device-validation gates.

**Reversibility:** Hardware paths can be promoted one by one after typed Rust commands, scoped sidecars, no-device tests, mock-device tests, and real-device acceptance are available.

**Blocking?** Not blocking Phase 1. Blocks Phase 9 acceptance criteria and the definition of "desktop preview" if Tyler wants hardware earlier.

## 5. Windows Signing Path

**Source ADR + line reference:** `docs/decisions/2026-05-10-adr-release-trust-model.md:10`

**Question (verbatim):** Tyler question: are you eligible and willing to use Azure Artifact Signing under your Microsoft account/region; if not, should Round 4 plan an OV/HSM vendor path or keep Windows artifacts dev-preview-only?

**Proposed default:** Keep Windows artifacts dev-preview-only until Tyler confirms Azure Artifact Signing eligibility. Azure Artifact Signing remains the target public path; OV/HSM is the fallback only if eligibility or account setup blocks Azure.

**Reversibility:** CI can add Azure, OV/HSM, or dev-preview-only lanes later. Already-published unsigned artifacts must stay clearly labeled non-production.

**Blocking?** Not blocking Phase 1. Blocks Phase 7 public Windows distribution.

## 6. macOS Distribution Path

**Source ADR + line reference:** `docs/decisions/2026-05-10-adr-release-trust-model.md:14`

**Question (verbatim):** Tyler question: do you already have a paid Apple Developer account, and should the first public preview be notarized immediately or macOS-dev-preview-only until the signing account is ready?

**Proposed default:** Keep macOS dev-preview-only until a paid Apple Developer account is confirmed. Require Developer ID Application signing plus notarization for the first public macOS preview.

**Reversibility:** The build can remain ad-hoc signed for local previews, then switch to Developer ID and notarization once credentials are ready. Public macOS artifacts should not be retroactively treated as trusted.

**Blocking?** Not blocking Phase 1. Blocks Phase 7 public macOS distribution.

## 7. Updater Private-Key Custody

**Source ADR + line reference:** `docs/decisions/2026-05-10-adr-release-trust-model.md:18`

**Question (verbatim):** Tyler question for Phase 8: local offline private key, cloud KMS, or GitHub Secret with strict environment controls?

**Proposed default:** No updater for the first developer preview. When updater work begins, default to a Tyler-owned local offline private key for the first signing rehearsal unless Tyler ratifies a cloud KMS. Do not use an agent-owned trust anchor.

**Reversibility:** Updater config can move from local offline signing to KMS or a tightly scoped GitHub Secret later. After an updater-capable public build ships, rollback is harder and needs a tested channel-disable story.

**Blocking?** Not blocking Phase 1. Blocks Phase 8 updater implementation.

## 8. Linux ARM / Raspberry Pi Scope

**Source ADR + line reference:** `docs/decisions/2026-05-10-adr-release-trust-model.md:22`

**Question (verbatim):** Tyler question: should Linux ARM/Raspberry Pi be a Phase 12 target, or a separate embedded-device program?

**Proposed default:** Treat Linux ARM/Raspberry Pi as a separate embedded-device program. Keep Phase 12 focused on direct desktop Linux distribution after x64 deb/AppImage confidence exists.

**Reversibility:** ARM can be added later as a dedicated lane with device-specific dependencies, WebView runtime checks, hardware permissions, and packaged smoke tests.

**Blocking?** Not blocking Phase 1. Blocks only Phase 12 scope if Tyler wants ARM in the desktop release matrix.

## 9. Crash Reporting Source-Map Custody

**Source ADR + line reference:** `docs/decisions/2026-05-10-adr-release-trust-model.md:26`

**Question (verbatim):** Tyler question: when crash reporting is introduced, should maps be uploaded to a service like Sentry or kept as local release artifacts only?

**Proposed default:** Keep hidden source maps as local release artifacts only for developer previews. Do not upload maps to Sentry-style services until diagnostics consent, redaction, retention, and access-control policy are ratified.

**Reversibility:** Source-map upload can be added later in CI after consent and access controls exist. Removing already-uploaded maps requires service-side cleanup and audit confirmation.

**Blocking?** Not blocking Phase 1. Blocks Phase 10 remote crash-reporting design, but local diagnostics can proceed.
