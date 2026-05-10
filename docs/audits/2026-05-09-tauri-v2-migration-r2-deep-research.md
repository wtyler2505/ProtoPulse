# Tauri v2 Migration Round 2 Deep Research

**Date:** 2026-05-10
**Notebook target:** `pp-core` / `7565a078-8051-43ea-8512-c54c3b4d363e`
**Scope:** Twelve NotebookLM deep-research gap topics for the Tauri v2 desktop migration plan.
**Status:** All 12 topics completed and selected sources were imported into `pp-core`.

## Tooling Notes

- The lazy-loaded MCP tool `mcp__notebooklm_mcp__.research_start` was attempted once for topic 1 and returned `user cancelled MCP tool call`. This is the same failure family recorded in Round 1.
- A direct `nlm login --check` against the home profile failed under Codex sandboxing because the CLI tried to refresh metadata in `~/.notebooklm-mcp-cli/profiles/default`, which is read-only from this sandbox: `OSError: [Errno 30] Read-only file system`.
- Workaround used: copied the existing NotebookLM profile to `/tmp/protopulse-nlm-profile`, set `NOTEBOOKLM_MCP_CLI_PATH=/tmp/protopulse-nlm-profile`, verified auth, then ran `nlm research start --mode deep` and `nlm research import` against `pp-core`.
- NotebookLM deep research sometimes changes task IDs between start and completed status. The table records the completed task ID where available.
- The CLI import output does not print source IDs. Source IDs below were resolved after import with `nlm source list --json`; pp-core already had some duplicate URLs, so duplicate IDs are possible.

## Topic Results

### 1. Tauri v2 auto-updater best practices and signing key management 2026

**Completed task:** `45600b99-d6ed-432a-9c1f-a4d1a0ead6dd`
**Imported source IDs:** `09c80f8f-fca1-4790-888f-c04c818fe1db` (Updater - Tauri), `514f1e4f-2a8a-4f36-8e3b-6834a8370c50` / `ce169bd9-3707-45c2-8344-2256b547b748` (CrabNebula auto-updates), `d9432ce6-6a0e-440e-a248-dffccfd308c2` (Oflight updater guide), `fdaf71f5-5af3-4ea4-b8ec-865442162a40` (Tauri GitHub pipeline), `380174a5-c665-4dda-b7a5-ee5b5a5327d4` (Tauri Ecosystem Security), `a175eb03-e9eb-4669-ad83-25965caab17e` (Azure Trusted Signing example), `f89aa942-f7f3-4bca-a87f-0f2461b190a2` (Microsoft Artifact Signing GA).
**Source URLs:** https://v2.tauri.app/plugin/updater/ ; https://docs.crabnebula.dev/cloud/guides/auto-updates-tauri/ ; https://v2.tauri.app/distribute/pipelines/github/ ; https://v2.tauri.app/security/ecosystem/

**Summary:** Tauri updater is inseparable from signing, release artifacts, endpoint design, and key custody; the public key is config-safe, but the private updater key is an operational trust anchor. Round 3 should move updater after CI/signing design and require a key-rotation/backup decision before implementation.

### 2. Windows code signing for Tauri desktop apps - EV vs OV, SmartScreen reputation 2026

**Completed task:** `b5bd0a3f-3862-4196-ba14-93d43a029b35`
**Imported source IDs:** `407df037-c76c-4da4-b250-2bd59595e7d4` / `cc89147d-7f50-4250-a862-cc766e24fb47` (Microsoft Windows code signing options), `91573637-5535-4a64-8e31-03993af8e76c` (Microsoft Artifact Signing integrations), `66b8ebb3-151e-4723-9ccd-f719295a368b` (Azure Artifact Signing), `b352201e-6752-45b5-8445-77826af96ae9` (SSL.com EV/OV), `bb0357e2-f643-4296-8bde-3695d7905af9` (DigiCert private-key storage requirement), `367fae95-e8cd-43bc-b45c-c115f680e468` (DigiCert private-key timeline), `2bd881b9-642f-4cdf-8b70-d13da2fcbab0` (DigiCert EV order).
**Source URLs:** https://v2.tauri.app/distribute/sign/windows/ ; https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options ; https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations

**Summary:** Tauri's Windows docs still distinguish OV and EV trust impact, with EV carrying immediate SmartScreen reputation while OV can require reputation-building or manual submission. The practical 2026 plan should prefer cloud/HSM-backed signing or Tyler-held certificate custody, not local PFX files committed to CI folklore.

### 3. macOS notarization for Tauri 2 - Apple Developer Program, hardened runtime, entitlements 2026

**Completed task:** `7a64b88a-2b48-418b-8917-b432c68ccbd0`
**Imported source IDs:** `820e18bb-1721-40cf-b172-b45316dc76e8` / `d72b5469-8eb7-4c2e-b56d-28874cd0b353` (macOS Code Signing - Tauri), `a19dc99f-64d4-4479-a98d-903dbb065b67` / `ce343a28-02c6-4615-af30-4ae608750495` (Apple Hardened Runtime), `dc37edbd-a4b9-4720-8852-876e3e698e74` / `f393113b-5869-46ee-ad30-84b16a06afc7` (Configuring hardened runtime), `9212b490-63aa-473e-9aa5-fea707ad8d88` / `e6f860fd-f315-4ebb-b3d0-8faf9629eea7` (Apple notarization issues), `0d074f3d-adc6-4e91-9379-7767efb1b773` / `2c4fed3c-dcf3-4bba-9fff-bc6aa0ecb566` (Notary API).
**Source URLs:** https://v2.tauri.app/distribute/sign/macos/ ; https://developer.apple.com/documentation/security/hardened-runtime ; https://developer.apple.com/documentation/xcode/configuring-the-hardened-runtime ; https://developer.apple.com/documentation/security/resolving-common-notarization-issues

**Summary:** macOS distribution is not just "sign the app"; sidecars, hardened runtime, entitlements, Developer ID identity, and notarization must be validated as one bundle. If Node/Arduino sidecars remain, notarization needs a dedicated embedded-binary signing check before release automation.

### 4. Tauri sidecar bundling for Node.js cross-platform - pkg vs bun-compile vs nexe 2026

**Completed task:** `0d359f2c-90ad-4bfa-8275-5227dd3e7169`
**Imported source IDs:** `00366b6b-d1cd-498e-ab9d-36d76373bc8c` (Embedding External Binaries - Tauri), `cc4f7b89-ecb2-4856-beaf-bedf5be72050` (Node single executable applications), `43f1ab5c-5559-4213-9a49-44c5321b0e76` (vercel/pkg), `0a859f13-0486-4e55-b0d6-6f479461ce91` (nexe issues), `946f9aff-dc67-4472-b2f3-807a37d7c760` (nexe Node 24 issue), `24f75279-476a-49e7-8c9e-4f70f2d6e4a1` / `4334c0ae-abe4-44b5-a254-df63ab829a6a` / `f52ee825-f46e-46a0-8d48-b8198e56581b` (Bun compile regressions), `c72f8dbb-9b10-4c7d-abf8-b6fcdf9229a8` (Node releases).
**Source URLs:** https://v2.tauri.app/develop/sidecar/ ; https://nodejs.org/api/single-executable-applications.html ; https://github.com/vercel/pkg ; https://github.com/nexe/nexe/issues

**Summary:** Tauri sidecars require target-triple binary naming and bundle config, so the current global Node dependency cannot be treated as production-ready. Node SEA, pkg, nexe, and Bun compile all need a prototype with signing/notarization and native dependency checks before Phase 2 locks in Express as a sidecar.

### 5. tauri-action GitHub Actions cross-platform release matrix 2026

**Completed task:** `10d0a690-f702-45c6-9852-faa91a06d189`
**Imported source IDs:** `11a33b8f-0eb7-438d-b29a-a14b2c5094c4` / `da6d2fb6-a51d-4410-bc61-e83e2e1c3635` (Tauri GitHub pipeline), `a581bcee-46ea-48e5-a265-ea0b4b7f5fbb` / `af1580e2-61b4-49cd-833e-c35fe3a301d4` (tauri-action releases), `4f75b8f0-83b5-4f01-8cd2-500a1afcb6b3` / `67faf1c2-130f-4f29-b420-3035f09d1ef7` (GitHub-hosted runners), `09366a6c-42b2-4158-a479-4338c1924964` / `9751a464-f4b8-4ccd-83ae-9dbc92b630d1` (runner reference), `5c60610c-07d1-4937-be6d-d75c3e98b3a3` (macOS 26 runner issue), `59858cde-18a3-48bd-bdf3-b38add9fe4f3` (tauri-build marketplace).
**Source URLs:** https://v2.tauri.app/distribute/pipelines/github/ ; https://github.com/tauri-apps/tauri-action ; https://docs.github.com/actions/using-github-hosted-runners/about-github-hosted-runners

**Summary:** The release matrix must build on native OS runners and include target-specific dependencies, artifact naming, updater signatures, and packaged smoke outputs. CI should move before updater polish, because updater/signing failures are invisible until artifacts exist.

### 6. Tauri v2 file association registration cross-platform 2026

**Completed task:** `3b0e3bff-cfc1-4bb9-9c49-535ef88fddc9` (pre-existing completed, unimported task found and preserved)
**Imported source IDs:** `2002d404-f0f6-4a30-beb7-ec9c2236ede9` / `ebb61d9c-2ab1-46a5-a556-8674d09a47ea` (File Associations on Mobile), `75f0d007-fd8b-400f-b9ad-77898532d86e` (Tauri issue 13844), `6cc5bc27-0ab2-43f7-8af4-565604228768` / `de3e890d-5429-465f-8e55-bea329a2850d` (macOS application bundle), `4b743b38-31c0-4392-bb8c-d75f873175fe` / `b25f7542-6b7c-49c4-9970-dc8eca2fb5c1` (Windows Installer), `84719346-0db7-4102-b625-e16d6098ce74` / `8a46521f-66ec-425e-bc60-76dc11bfa374` (Single Instance), `28e1ec49-9096-482b-80eb-e2b9140ae970` / `8e053809-1b21-467c-b01d-4f4d558868e6` (file association/deep-link issue), `1dc91fc7-a90e-4264-9194-71acdba67889` / `b2aa3eb0-8bf7-43fe-b7be-dd83c81a40a9` (Tauri config schema).
**Source URLs:** https://tauri.app/learn/mobile-file-associations/ ; https://v2.tauri.app/distribute/windows-installer/ ; https://v2.tauri.app/distribute/macos-application-bundle/ ; https://v2.tauri.app/plugin/single-instance/

**Summary:** File associations are build-time metadata plus runtime open-event handling, not cosmetic polish. ProtoPulse should decide `.protopulse` project-open semantics alongside single-instance, deep-link, and storage migration rather than waiting for the final UX phase.

### 7. Tauri v2 multi-window coordination and IPC patterns 2026

**Completed task:** `5ca02f87-c9f8-413f-bc2e-60fe3b5e3272`
**Imported source IDs:** `acbbd78b-c42e-491f-bc71-dca9e04be16e` (Inter-Process Communication), `212eaa3e-a2f3-4e20-8dea-4087904f7006` / `4324169c-760c-4711-8c71-19ea4ff6e268` (Calling frontend from Rust), `18ef303d-93ab-4109-8a46-8813c4e111d1` / `d1690190-296f-469c-8c8d-bab0151e2c83` (Calling Rust from frontend), `d8f1e17f-40e8-4d53-9c05-df558cb88757` (Window State), `65a90f6c-f7b4-42a9-947c-57abd1a3217f` / `7cd53b23-dcff-4c93-b0bb-39280314d758` (capabilities for windows/platforms), `3fc5b17f-9ad0-4ded-b82b-3407fac87bcf` (event API), `f5c20a1b-2f6b-4699-be07-0acd7328edb6` (Store).
**Source URLs:** https://v2.tauri.app/concept/inter-process-communication/ ; https://v2.tauri.app/develop/calling-frontend/ ; https://v2.tauri.app/develop/calling-rust/ ; https://v2.tauri.app/plugin/window-state/

**Summary:** Multi-window and IPC design reinforces Round 1's IPC-contract finding: command/event names, payloads, per-window capabilities, and state transfer must be enumerated before plugin work. Window state and Store are not just UX niceties when project-open and multi-window state synchronization are in play.

### 8. Tauri v2 deep linking - `tauri-plugin-deep-link` 2026

**Completed task:** `41bba10b-42b3-4a20-9829-1b19a32ed1fe`
**Imported source IDs:** `7fb468b5-35c7-41da-b769-4323685f530e` / `cd4277aa-2bc3-4e64-aff6-b3e23e833320` (Deep Linking - Tauri), `9ee7cfca-2172-4901-8d5a-b8f0894f30ad` (configuration), `b40f2aa8-ea31-4e63-a3d2-19e79b63d141` (usage), `1890c2ae-8471-465e-9b87-7513c00d370a` / `52d259ee-7013-4b0f-927d-90378750f83e` (crates.io), `2c7f0634-7837-4aec-a032-b1c69a5089e6` (plugins-workspace releases), `054fdd45-631c-4c3f-bed0-8e19a15805d9` (Tauri issue reference).
**Source URLs:** https://v2.tauri.app/plugin/deep-linking/ ; https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/deep-link ; https://crates.io/crates/tauri-plugin-deep-link

**Summary:** Deep links share the same cold-start/warm-start and single-instance problems as file associations, especially on Windows/Linux where arguments are forwarded to an existing process. ProtoPulse should design project-open, auth callback, and diagnostic/deep-link validation together.

### 9. Tauri v2 telemetry and crash reporting - Sentry/Crashpad/Bugsnag integration patterns 2026

**Completed task:** `b5aa3a92-3bdd-419b-8f7e-5fee538fd685`
**Imported source IDs:** `fe9c39ff-55d5-4fa1-8c1c-8a959d677e62` (timfish/sentry-tauri), `9673f9f1-6f26-481e-845e-bf0bef052f55` (tauri-plugin-log), `0dac2f3c-dd08-4263-9d0c-3949fc4e6b74` (Tauri Process Model), `71ec107c-d584-4f1b-84b0-220e4828ee84` (Crash reporting in Rust), `3c82b5fc-bf42-45f9-a042-774732bfd1c2` (Bugsnag crate), `a93d747c-a905-4f62-b4cf-59ab81657654` / `dc891042-6595-41ba-bc60-7727006cf17c` (Bugsnag docs.rs), `b61d4fd1-204f-4833-b9da-8792bc91388c` / `468b0164-2160-4796-8bc6-460b3654f417` (Tauri IPC origin-confusion advisory).
**Source URLs:** https://github.com/timfish/sentry-tauri ; https://crates.io/crates/tauri-plugin-log/2.2.1 ; https://v2.tauri.app/concept/process-model/ ; https://github.com/advisories/GHSA-7gmj-67g7-phm9

**Summary:** The first import skewed thin, so a targeted second import added Sentry, logging, Rust crash-reporting, Bugsnag, and advisory evidence. Observability should wait until consent/redaction/diagnostic-export policy exists, but crash/log design should be considered before release hardening so symbols and source maps are planned.

### 10. Tauri v2 production capability scoping checklist - least-privilege patterns 2026

**Completed task:** `dd391357-33b5-4e1c-9f8d-99bc9d6913d4`
**Imported source IDs:** `1dbdd93a-85a5-466d-8210-f5e781e52b9a` / `f1c7f0f9-358f-4c2b-b88b-85e1771759da` (Command Scopes), `31cd67b1-5ffe-403b-9c8a-6b1d630dd470` / `5bdac98d-7789-45c2-9fd1-8e4af11b97d0` (Permissions), `54eeda78-2d17-42e5-8a2a-5ed9d7d6dbe0` / `82e77bf5-a2ad-4b24-ab48-abf2d10a7b3e` (Using Plugin Permissions), `5c885cde-b1f1-44bb-ada3-1011c47332bc` (CSP), `2964ce01-4f5a-4dd5-a3ed-2d438c08db17` / `df0ec29b-a342-4cd2-bfab-aff0016d12c9` (Writing Plugin Permissions), `d3a8038e-a21d-4b0f-8723-9f9d80749b70` (Security Advisories), `198d7b2a-44c4-4883-b5ca-b25ed71b2589` (Tauri v2 audit PDF).
**Source URLs:** https://v2.tauri.app/security/capabilities/ ; https://v2.tauri.app/security/permissions/ ; https://v2.tauri.app/security/scope/ ; https://v2.tauri.app/security/csp/

**Summary:** Capability scoping must start from the actual command/plugin caller graph, not from a static permission cleanup. Round 3 should produce a per-command authority table, then narrow custom commands, plugin permissions, CSP, and path/command scopes together.

### 11. Tauri v2 Linux distribution: AppImage vs deb vs Flatpak vs Snap - tradeoffs 2026

**Completed task:** `9b9d5918-d807-4214-93c7-6bb8c9aa9c1e`
**Imported source IDs:** `ab650bd6-067c-4323-88e6-7ca9eba3903a` (AppImage - Tauri), `4ee7e342-661a-4589-9672-c914c35c38b5` / `90afe33a-42c5-4a02-b7dc-192bb10a653e` (Debian - Tauri), `2395bb9e-58d9-481d-89a3-41240a3daa6b` (Flathub - Tauri), `e61411e3-6ca3-449f-821d-5394875f7a2f` (Snapcraft - Tauri), `cb220df0-1072-426a-8ae9-2551c0421a80` (Snap performance), `5bdf18eb-5153-41d1-be62-c4ac6ed5823c` / `6356704f-b378-477b-8853-661d596c03e1` (Awesome Tauri).
**Source URLs:** https://v2.tauri.app/distribute/appimage/ ; https://v2.tauri.app/distribute/debian/ ; https://v2.tauri.app/distribute/flatpak/ ; https://v2.tauri.app/distribute/snapcraft/

**Summary:** Linux packaging is a product/distribution decision, not a postscript; sandboxed formats can alter filesystem, DBus, single-instance, and hardware access behavior. ProtoPulse should first support deb/AppImage for direct distribution and treat Flatpak/Snap as later, explicit compatibility lanes.

### 12. Tauri v2 supply chain security - Cargo audit, npm audit, dependency provenance 2026

**Completed task:** `8814581a-4370-4953-a179-80227445ba12`
**Imported source IDs:** `cdf8dd16-eea6-4f99-8c52-930fe62eb2bd` (Application Lifecycle Threats - Tauri), `226d6d63-eedf-4d77-b82d-8b0e8114c4ae` / `862392fb-7cf1-4fbd-9747-85c846a25212` (Security - Tauri), `a52b7bfc-a368-4447-b329-5125f97cf6c2` / `b872f5a2-6e49-4bcc-846d-5c3643866d9b` (Tauri releases), `bb086634-7bfa-4cc0-b338-7c5b89676c04` (npm security best-practices collection), `6919834d-9858-40df-a776-796b2ecafc06` / `fdaf71f5-5af3-4ea4-b8ec-865442162a40` (Tauri GitHub pipeline), `f0881caa-a1c4-407f-bfa7-592c023a2ddf` (SLSA guide), `b4873caa-0d9d-4e7a-95f7-9e4843b2c598` (SBOM/SLSA/actions), `1ad31de0-4fa0-4bc3-bbc3-3c3f03906a2e` (npm supply-chain attacks).
**Source URLs:** https://v2.tauri.app/security/lifecycle/ ; https://v2.tauri.app/security/ ; https://docs.npmjs.com/about-audit-reports/ ; https://docs.npmjs.com/generating-provenance-statements/ ; https://rustsec.org/ ; https://slsa.dev/spec/v1.1/levels ; https://docs.github.com/en/code-security/tutorials/implement-supply-chain-best-practices/securing-builds

**Summary:** The first import under-selected RustSec/npm/SLSA material, so a second import added npm and SLSA-adjacent sources; official RustSec/npm/SLSA/GitHub docs should still be explicitly imported or cited in Round 3 before implementation. Supply-chain work belongs before release automation is trusted: `cargo audit`/policy checks, npm audit/provenance, SBOM generation, signed artifacts, and isolated CI runners must be part of the release gate.

## Cross-Topic Synthesis

- **Updater comes late, not early.** It depends on artifact naming, signatures, endpoints, release channels, and key custody.
- **Runtime topology is the central blocker.** Express as a sidecar, Rust-native backend, and hybrid all imply different signing, CSP, storage, observability, and CI work.
- **Lifecycle is earlier than Phase 0 implied.** File associations, deep links, single instance, project-open semantics, window state, and storage are one design cluster.
- **Release trust is multi-layered.** Windows SmartScreen, macOS notarization, updater signing, npm/Rust provenance, and CI runner isolation all need explicit ownership.
- **NotebookLM was useful but not authoritative.** It found and imported many sources, but thin or noisy topics still need primary-source verification before code edits.

## Raw Evidence

Local run logs are in `/tmp/protopulse-tauri-r2-research/` and `/tmp/protopulse-nlm-topic01-status.txt`. Source-ID resolution was generated from `/tmp/protopulse-tauri-r2-source-list.json`.
