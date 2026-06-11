# Tauri Signing Runbook — Dev Preview → Signed Distribution

**Status:** placeholder runbook. Activation requires Tyler-owned credentials per `docs/decisions/2026-05-10-adr-release-trust-model.md` Decisions 1 + 2.

**Default state (today):** dev-preview-only. CI produces unsigned `.deb`, `.AppImage`, `.msi`, `.exe`, `.dmg`, `.app` artifacts marked clearly as non-production. SmartScreen/Gatekeeper users will see warnings. This is intentional until signing credentials land.

This runbook is what Tyler reads when he's ready to flip from dev preview to signed distribution. No code changes happen until Tyler confirms eligibility/credentials and explicitly green-lights the switch.

---

## 1. Windows signing — Azure Artifact Signing (target path)

Per ADR Decision 1 (verified 2026-05-10), **Azure Artifact Signing is the target Windows path**, not EV certificates. Microsoft's 2024 SmartScreen behavior change removed the instant-trust EV bypass, so EV no longer justifies its higher cost. OV certs (DigiCert/Sectigo) are the fallback if Azure isn't eligible. NO-signing-yet is the current default.

### Tyler-decides

- [ ] **Azure Artifact Signing eligibility?** Check at https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations
- [ ] If yes → continue with **§1A Azure path**.
- [ ] If no (account/region blocked) → continue with **§1B OV+HSM fallback**.
- [ ] If neither is desired today → **leave dev-preview-only**.

### §1A Azure Artifact Signing activation

When Tyler confirms eligibility:

1. In Azure portal, create a Trusted Signing account + Identity Validation request.
2. Once approved (typically 1–3 days), generate a service principal with the `Trusted Signing Certificate Profile Signer` role.
3. Add GitHub secrets:
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_CLIENT_SECRET` (or use OIDC for keyless — recommended)
   - `AZURE_TRUSTED_SIGNING_ENDPOINT` (e.g., `https://eus.codesigning.azure.net/`)
   - `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`
   - `AZURE_TRUSTED_SIGNING_CERT_PROFILE_NAME`
4. In `.github/workflows/tauri-build.yml`, uncomment the Azure Artifact Signing step (currently absent — add per Microsoft action `azure/trusted-signing-action@v0.x`).
5. Tag a release → CI signs `.msi` / `.exe` automatically.
6. Test SmartScreen behavior on a clean Windows 10/11 install.

### §1B OV cert + HSM fallback

If Azure path isn't an option:

1. Purchase an OV code-signing certificate from DigiCert / Sectigo / SSL.com (HSM-required per 2023 baseline requirements).
2. Configure the HSM-backed signing in CI (e.g., DigiCert KeyLocker, AzureKeyVault, or AWS CloudHSM).
3. Add the relevant secrets per the vendor's docs.
4. Update the workflow with `signtool` invocation that pulls keys from the HSM.

OV certs require building reputation (a few weeks of distribution) before SmartScreen stops warning. Document this in release notes.

---

## 2. macOS — Developer ID + notarization

Per ADR Decision 2 (verified 2026-05-10), **Developer ID Application certificate + notarization** is the macOS distribution path. Dev preview = ad-hoc signed (Tauri default), public preview = full Developer ID + notarized.

### Tyler-decides

- [ ] **Paid Apple Developer Program account ($99/yr)?**
- [ ] If yes → continue with **§2A**.
- [ ] If no → **leave macOS dev-preview-only** (ad-hoc signed via `codesign --sign -`).

### §2A Developer ID activation

1. Enroll in Apple Developer Program at https://developer.apple.com/programs/.
2. In Xcode → Settings → Accounts, create a Developer ID Application certificate.
3. Generate a Notary tool app-specific password at https://appleid.apple.com/account/manage.
4. Export the cert to .p12, base64-encode it for GitHub Secrets.
5. Add GitHub secrets:
   - `APPLE_CERTIFICATE` (base64 of .p12)
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_SIGNING_IDENTITY` (e.g., `Developer ID Application: Your Name (TEAMID)`)
   - `APPLE_ID` (your Apple ID email)
   - `APPLE_PASSWORD` (the app-specific password, NOT your Apple ID password)
   - `APPLE_TEAM_ID`
6. In `.github/workflows/tauri-build.yml`, uncomment the `env:` block under the `tauri-action` step (the secrets are already named correctly).
7. Verify hardened runtime + entitlements are correct (Tauri sets these by default; check `src-tauri/Info.plist` if customizing).
8. Tag a release → tauri-action signs + notarizes automatically.
9. Test Gatekeeper behavior on a clean macOS install: download from GitHub release, run, verify no "unidentified developer" prompt.

### Notarization gotchas

- Embedded binaries (the Express sidecar, arduino-cli sidecar in Phase 9) MUST also be signed AND have the hardened runtime + entitlements.
- Notarization can take 5–30 minutes; tauri-action polls.
- If notarization fails, the error is in `xcrun notarytool log <submission-id>` — re-run with `--keychain-profile` to retrieve.

---

## 3. Updater signing (Phase 8 — deferred)

Per ADR Decision 3 (verified 2026-05-10), **no updater is wired for the dev preview**. When Tyler decides to ship updater (Phase 8):

1. Generate Tauri updater keypair: `npm run tauri signer generate -- -w ~/.tauri/protopulse.key`
2. Choose key custody: **local offline private key** (default), cloud KMS, or GitHub Secret with strict environment controls.
3. Add `TAURI_SIGNING_PRIVATE_KEY` (the .key file contents) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to GitHub Secrets.
4. Update `tauri.conf.json` with the public key + endpoint URL.
5. Test the updater flow end-to-end on a packaged build before tagging the first public release.

See `docs/release/tauri-updater-policy.md` for channel + rollback policy.

---

## 4. Rollback story

If signing certs/identities are compromised or rotated:

- **Azure**: revoke the certificate profile, generate a new one, update secrets.
- **macOS Developer ID**: revoke the cert in Apple Developer portal, generate a new one, update secrets. **Notarization re-uses the same Developer ID Team**, so notarization continues working — but already-distributed builds need to be re-issued.
- **Updater key**: this is the worst case. Already-installed apps cannot install updates signed by a NEW key. Document the planned-rotation policy (e.g., 5-year rotation) BEFORE shipping updater publicly.

---

## 5. References

- Tauri Windows signing: https://v2.tauri.app/distribute/sign/windows/
- Tauri macOS signing: https://v2.tauri.app/distribute/sign/macos/
- Microsoft Code Signing Options: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- Microsoft Trusted Signing: https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations
- Apple Notary API: https://developer.apple.com/documentation/security/resolving-common-notarization-issues
- Tauri updater: https://v2.tauri.app/plugin/updater/
- Release-trust ADR: `docs/decisions/2026-05-10-adr-release-trust-model.md`
