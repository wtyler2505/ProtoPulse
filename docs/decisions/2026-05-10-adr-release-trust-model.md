# ADR: Tauri Release Trust Model

**Status:** Proposed for Tyler ratification  
**Date:** 2026-05-10  
**Deciders:** Tyler, Claude Code, Codex  
**Related:** `docs/audits/2026-05-09-tauri-v2-migration-r2-deep-research.md`, `docs/audits/2026-05-09-tauri-v2-migration-r2-revised-phasing.md`

## Decision 1: Windows Signing Path

Use **Azure Artifact Signing** as the target path for public non-Store Windows distribution, if Tyler is eligible for the service. Use **no signing yet** only for internal developer previews, and fall back to an HSM-backed OV certificate only if Azure Artifact Signing eligibility or account setup blocks the path. Do not buy an EV certificate solely for SmartScreen: Round 2 imported Tauri Windows signing evidence (`407df037-c76c-4da4-b250-2bd59595e7d4`, `cc89147d-7f50-4250-a862-cc766e24fb47`) plus Microsoft signing options (`91573637-5535-4a64-8e31-03993af8e76c`, `66b8ebb3-151e-4723-9ccd-f719295a368b`), and the current Microsoft docs say Azure Artifact Signing is recommended for non-Store distribution while EV no longer provides an instant SmartScreen bypass as of the 2024 behavior change ([Microsoft code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [Artifact Signing integrations](https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations)). Tyler question: are you eligible and willing to use Azure Artifact Signing under your Microsoft account/region; if not, should Round 4 plan an OV/HSM vendor path or keep Windows artifacts dev-preview-only?

## Decision 2: macOS Distribution Path

Use **Developer ID Application + notarization** for full macOS distribution outside the Mac App Store. Use ad-hoc signing only for local/developer previews. Round 2 source IDs `820e18bb-1721-40cf-b172-b45316dc76e8`, `d72b5469-8eb7-4c2e-b56d-28874cd0b353`, `a19dc99f-64d4-4479-a98d-903dbb065b67`, and `9212b490-63aa-473e-9aa5-fea707ad8d88` establish that signing, hardened runtime, entitlements, sidecars, and notarization must be validated as one bundle. Tauri's current macOS signing guide says Developer ID is the certificate type for shipping outside the App Store and notarization is required when using a Developer ID Application certificate ([Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/)). Tyler question: do you already have a paid Apple Developer account, and should the first public preview be notarized immediately or macOS-dev-preview-only until the signing account is ready?

## Decision 3: Updater Pubkey Custody

Choose **no updater yet** for the first developer preview; manual download/install remains the update path until CI, signing, artifact naming, and key custody are settled. The target for a later updater phase is a Tyler-owned updater private key or a Tyler-approved KMS, never an agent-owned trust anchor. Round 2 source IDs `09c80f8f-fca1-4790-888f-c04c818fe1db`, `514f1e4f-2a8a-4f36-8e3b-6834a8370c50`, `fdaf71f5-5af3-4ea4-b8ec-865442162a40`, and `380174a5-c665-4dda-b7a5-ee5b5a5327d4` support moving updater after release trust. Tauri updater configuration includes a public key in config plus generated updater artifacts/signatures, so private-key custody must be decided before implementation ([Tauri updater](https://v2.tauri.app/plugin/updater/)). Tyler question for Phase 8: local offline private key, cloud KMS, or GitHub Secret with strict environment controls?

## Decision 4: Initial CI Matrix And Linux Formats

Initial release CI targets **Win-x64, macOS x64, macOS arm64, and Linux x64**. Initial Linux formats are **deb + AppImage** for direct distribution; Flatpak/Snap remain later compatibility lanes because sandboxing and store policy can change filesystem, DBus, hardware, update, and single-instance behavior. Round 2 source IDs `11a33b8f-0eb7-438d-b29a-a14b2c5094c4`, `a581bcee-46ea-48e5-a265-ea0b4b7f5fbb`, `4f75b8f0-83b5-4f01-8cd2-500a1afcb6b3`, `ab650bd6-067c-4323-88e6-7ca9eba3903a`, and `4ee7e342-661a-4589-9672-c914c35c38b5` support this scope. Tauri's GitHub pipeline example builds Windows, Linux, and both macOS architectures via `tauri-apps/tauri-action`, and its Debian docs call out the native Linux dependency/base-system constraints that must be tested ([Tauri GitHub pipeline](https://v2.tauri.app/distribute/pipelines/github/), [Tauri Debian](https://v2.tauri.app/distribute/debian/), [Tauri AppImage](https://v2.tauri.app/distribute/appimage/)). Tyler question: should Linux ARM/Raspberry Pi be a Phase 12 target, or a separate embedded-device program?

## Decision 5: Source Map And Debug Artifact Policy

Use **hidden + local-only source maps** for developer previews; do not ship source maps inside public Tauri bundles. Keep crash-service upload as a Phase 10 decision after diagnostics consent, redaction, retention, and symbol/source-map access controls are approved. `vite.config.ts:76` already sets `sourcemap: 'hidden'`, and Vite documents that hidden source maps generate separate map files without source-map comments in bundled files ([Vite build.sourcemap](https://vite.dev/config/build-options.html#build-sourcemap)). Round 2 source IDs `fe9c39ff-55d5-4fa1-8c1c-8a959d677e62`, `9673f9f1-6f26-481e-845e-bf0bef052f55`, and `0dac2f3c-dd08-4263-9c05-df558cb88757` show observability should wait for consent/redaction policy. Tyler question: when crash reporting is introduced, should maps be uploaded to a service like Sentry or kept as local release artifacts only?

## Cross-Cutting Trust Rules

- Agents can document and wire placeholders, but Tyler owns certificates, updater private keys, Apple credentials, Microsoft signing accounts, and production release secrets.
- No updater implementation before signed reproducible artifacts exist.
- No public release pipeline is trusted until packaged artifacts launch on each target and exercise the desktop bridge.
- CI release jobs must be code-owned and permission-minimized before secrets are attached.
