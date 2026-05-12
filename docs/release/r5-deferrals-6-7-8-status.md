# R5 Deferrals #6 / #7 / #8 — Status

**Posture (per memory rule `feedback_dont_compile_decision_packets_for_tyler.md`):** these three deferrals require Tyler-owned credentials/infrastructure to activate. Until Tyler provides them, all three sit in **dev-preview-default** mode — documented, scaffolded, and ready to flip with a one-PR change. No further architecture review is needed; the decisions are recorded in `docs/decisions/2026-05-10-adr-release-trust-model.md` Decisions 1+2+3 (Codex R6 ratified retro).

---

## #6 — Apple Developer ID + notarization activation

**Documentation:** `docs/release/tauri-signing-runbook.md` §2.

**Required from Tyler:**
- Paid Apple Developer Program account ($99/year)
- Developer ID Application certificate (created via Xcode → Settings → Accounts)
- Notarytool app-specific password (https://appleid.apple.com/account/manage)

**Activation steps (already documented at `tauri-signing-runbook.md:62-78`):**
1. Enroll in Apple Developer Program.
2. Generate Developer ID Application certificate.
3. Generate Notarytool app-specific password.
4. Export cert to `.p12`, base64-encode for GitHub Secrets.
5. Add 6 GitHub secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`.
6. Uncomment the `env:` block under `tauri-action` in `.github/workflows/tauri-build.yml:88-101` (already named correctly; just uncomment).
7. Tag a release → tauri-action signs + notarizes automatically.
8. Test Gatekeeper on a clean macOS install.

**Dev-preview-default behavior today:** macOS builds are ad-hoc signed via `codesign --sign -` (Tauri default when no cert provided). Users see "unidentified developer" prompts on first launch — clearly labelled "non-production / dev preview" in release notes.

**Status:** ✓ documentation complete. Pending Tyler credentials.

---

## #7 — Azure Artifact Signing (Windows) activation

**Documentation:** `docs/release/tauri-signing-runbook.md` §1 (with OV+HSM fallback at §1B).

**Required from Tyler:**
- Azure subscription with Trusted Signing eligibility (verify at https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations)
- OR fallback: OV code-signing certificate from DigiCert / Sectigo / SSL.com with HSM (DigiCert KeyLocker, AzureKeyVault, AWS CloudHSM).

**Activation steps (already documented at `tauri-signing-runbook.md:24-37`):**
1. Verify Azure Artifact Signing eligibility.
2. Create Trusted Signing account + Identity Validation in Azure portal.
3. Generate service principal with `Trusted Signing Certificate Profile Signer` role.
4. Add GitHub secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` (or OIDC), `AZURE_TRUSTED_SIGNING_ENDPOINT`, `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`, `AZURE_TRUSTED_SIGNING_CERT_PROFILE_NAME`.
5. Add the `azure/trusted-signing-action@v0.x` step to `.github/workflows/tauri-build.yml` after the tauri-action build step.
6. Tag a release → CI signs `.msi` / `.exe` automatically.
7. Test SmartScreen on a clean Windows 10/11 install.

**Why Azure over EV:** per ADR Decision 1 (2026-05-10 ratified, verified during R4 retro), Microsoft's 2024 SmartScreen behavior change removed the instant-trust EV bypass. Azure Artifact Signing is the cost-effective non-Store path; EV no longer justifies its premium.

**Dev-preview-default behavior today:** Windows builds are produced UNSIGNED. SmartScreen users see "Windows protected your PC" prompt on launch — clearly labelled "non-production" in release notes.

**Status:** ✓ documentation complete. Pending Tyler credentials.

---

## #8 — Updater domain provisioning (`releases.protopulse.app`)

**Documentation:** `docs/release/tauri-updater-policy.md`.

**Required from Tyler:**
- DNS provisioning for `releases.protopulse.app` (CNAME or A record pointing to chosen update-manifest host)
- Hosting choice: dynamic server (staged rollouts, A/B-testing capability) OR static GitHub-release JSON (`https://github.com/wtyler2505/ProtoPulse/releases/latest/download/latest.json` — simpler, free).
- Tauri updater keypair (`npm run tauri signer generate -- -w ~/.tauri/protopulse.key`) generated + stored per signing-runbook §3.
- Decision on key custody: local offline (default), cloud KMS (better DR), or GitHub Secret (NOT recommended for long-lived public-distribution key).

**Activation steps (documented at `tauri-updater-policy.md:82-84` + signing-runbook §3):**
1. Generate updater keypair locally.
2. Choose hosting (static GitHub-release JSON is the simpler default).
3. Provision `releases.protopulse.app` DNS record + serve the signed update manifest.
4. Add `tauri-plugin-updater = "2"` to `src-tauri/Cargo.toml`.
5. Add `@tauri-apps/plugin-updater = "^2"` to `package.json` (frontend-driven update flow) OR skip (Rust-only update flow).
6. Add `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to GitHub Secrets.
7. Add `plugins.updater.pubkey` + `bundle.createUpdaterArtifacts: true` to `tauri.conf.json`.
8. Register the updater plugin in `lib.rs::run()`.
9. Use runtime endpoint selection per channel: `app.updater_builder().endpoints(vec![url_for(channel)])?.build()?.check().await?` (NOT `{channel}` URL interpolation — per Codex R6 retro C11 ratification).
10. Add a settings UI for channel switching (stable / beta / nightly opt-in).
11. E2E test the update flow before tagging the first public release.

**Channel design (per ADR Q7 + `tauri-updater-policy.md` §Channels):**
- `stable` (tagged `v*`) — default, public users.
- `beta` (tagged `v*-beta.*`) — opt-in early adopters.
- `nightly` (every main push) — core team only.

**Endpoint format (verified per Codex R4.6 retro C11):**
- Tauri updater supports `{{current_version}}`, `{{target}}`, `{{arch}}` interpolation only.
- Channel selection is RUNTIME via `app.updater_builder().endpoints(vec![concrete_url])`, NOT via `{channel}` template literals (those don't interpolate).
- Each channel has its own concrete endpoint string, chosen at app init based on the user's channel preference.

**Rollback policy (documented at `tauri-updater-policy.md` §Rollback rules):**
- Within 24h of tag: delete the GitHub release; updater clients see no new version.
- Within 7 days: publish `*.fix-N` patch on the same channel.
- After 7 days / security issues: same-channel version bump + backport.
- Compromised updater signature = key rotation + already-installed clients must reinstall (the worst case; rotate every 3-5 years OR immediately on suspected compromise).

**Status:** ✓ documentation complete. Pending Tyler DNS provisioning + key custody decision.

---

## Tracking these against R5 deferral goal

Per Codex R6 retro-closed + R4.6-ratified land plan, these three deferrals were always pending Tyler-owned credentials. The Tauri retro adversarial review process correctly identified them as "dev-preview-only-until-credentials" defaults so AIs proceed without waiting.

**R5 deferral goal accounting:**
- #1 Linux ARM64 CI matrix — DONE (commit `7063f3fc`).
- #2 tauri-plugin-store migration — DONE (commits `0559467a`, `dab6fcf5`, `c563b473`, `a715fbd6`, `700243b5`).
- #3 typed Arduino commands — PENDING (architecture-class, requires Codex review + UI use case decision).
- #4 Stronghold / OS keychain for session-auth — PENDING (architecture-class, requires Codex review).
- #5 SLSA attestations + npm provenance — PENDING (architecture-class, ADR-required).
- **#6 Apple Developer ID activation — DOCUMENTED, pending Tyler credentials.**
- **#7 Azure Artifact Signing activation — DOCUMENTED, pending Tyler credentials.**
- **#8 Updater domain provisioning — DOCUMENTED, pending Tyler DNS + key custody.**

#6/#7/#8 are documentation-complete as of this commit. Activation requires Tyler action (credentials or infrastructure) — no further code/doc work blocks them.
