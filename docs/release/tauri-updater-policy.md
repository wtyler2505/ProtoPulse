# Tauri Updater Policy

**Status:** policy doc, no implementation. Updater wiring is **deferred** per `docs/decisions/2026-05-10-adr-release-trust-model.md` Q7 ratified default: *"no updater for the first developer preview."*

When Tyler decides to ship an updater, this doc is the activation contract — channels, rollback, prompt UX, endpoint shape, key custody, and the rotation policy.

---

## Why deferred

1. **Signing isn't ready.** Updater artifacts ship signed; signing is gated on Q5+Q6 ratification (Windows: Azure Artifact Signing OR OV+HSM; macOS: Developer ID + notarization). See `docs/release/tauri-signing-runbook.md`.
2. **Key custody requires Tyler's decision.** The Tauri updater private key is a long-lived trust anchor — leak/loss means already-installed apps can't accept updates. No agent should own that decision.
3. **Channel design is a product decision.** Stable/beta/nightly split affects release cadence, support expectations, and roll-forward strategy. Tyler decides cadence.

Until updater is on, distribution is **manual download from GitHub releases**. The "non-production / dev preview" label on the release notes is the user-facing signal.

---

## Channels (proposed when updater activates)

| Channel  | Cadence       | Audience                 | Endpoint pattern |
|----------|---------------|--------------------------|------------------|
| stable   | tagged `v*`   | public users             | `https://releases.protopulse.app/stable/{{target}}/{{arch}}/{{current_version}}` |
| beta     | tagged `v*-beta.*` | opt-in early adopters | `https://releases.protopulse.app/beta/...` |
| nightly  | every main push | core team               | `https://releases.protopulse.app/nightly/...` |

**Default channel:** stable. Beta + nightly require user opt-in via a setting that flips the runtime updater endpoint.

**Cross-channel switching:** stable → beta → nightly is monotonically increasing in expected breakage. Going backwards (nightly user wants stable) requires a manual reinstall, NOT an "update". Document this in the in-app channel-switcher UI.

---

## Rollback rules

If a release ships with a critical bug:

1. **Within 24 hours of tag:** delete the GitHub release + draft. Updater clients see no new version.
2. **Within 7 days:** publish a `*.fix-N` patch release on the same channel. Updater promotes to the patch.
3. **After 7 days, or for security issues:** publish to the same channel with version bumped; **also publish a backport** to the previous minor if applicable.
4. **For corrupted updater signatures:** there's no recovery path on the client side. The compromised key must be rotated AND already-installed clients must reinstall. This is the worst case — see §Key Custody.

The updater plugin supports `createUpdaterArtifacts: true` which generates `.sig` files alongside each artifact. Rollback NEVER republishes the same version with a different signature — bump the patch number.

---

## Prompt UX (when an update is available)

When the updater detects a new version:

1. Notify in-app with a non-modal banner: *"Update available: v1.2.3"*. Include a "What's new" link to the release notes.
2. User decides: **Install now** / **Install on next launch** / **Remind me later** / **Skip this version**.
3. On *Install now*, download in background, prompt user when ready to relaunch. Confirm before quitting (don't lose unsaved project state).
4. Use `tauri-plugin-process::relaunch()` to restart after install.

**Consent rules:**
- Updater MUST be on by default for users on the stable channel. Opt-out lives in Settings → Updates.
- Beta/nightly opt-in users get auto-update unless they disable it.
- NEVER force-update without consent (no "install in 60 seconds whether you like it or not").

---

## Endpoint owner

Tyler-owned. Default endpoint pattern: `https://releases.protopulse.app/{channel}/{target}/{arch}/{current_version}`. Alternative: static JSON manifest from GitHub releases (`https://github.com/wtyler2505/ProtoPulse/releases/latest/download/latest.json`) — lower cost, GitHub-hosted.

**Decision needed when activating updater:** dynamic server vs static GitHub JSON. Static is simpler and free; dynamic enables staged rollouts (return new version to N% of clients).

---

## Key custody

Per Q7 ratified default: **Tyler-owned local offline private key** is the starting point. Alternatives:
- **Cloud KMS** (AWS KMS, Azure Key Vault, Google Cloud KMS): higher operational cost, better disaster recovery.
- **GitHub Secret with strict environment controls**: simplest, but requires trusting GitHub's secret storage for a long-lived signing key. Not recommended for a public-distribution updater key.

**Whichever path:** the public key MUST be committed to `tauri.conf.json` `plugins.updater.pubkey` BEFORE the first signed release. Public-key rotation requires re-distributing a new app version (already-installed apps can't pick up a new public key).

**Rotation policy:** rotate every 3–5 years OR immediately on suspected compromise. Plan + test rotation BEFORE shipping updater publicly.

---

## Wiring activation (the implementation step, deferred)

When Tyler green-lights the updater, follow `docs/release/tauri-signing-runbook.md` §3 and the Tauri updater docs to wire `plugins.updater` config, add the Cargo+npm plugin deps, register the plugin in `lib.rs::run()`, generate the keypair, and add the secrets to GitHub.

---

## References

- Tauri updater: https://v2.tauri.app/plugin/updater/
- Tauri process: https://v2.tauri.app/plugin/process/
- CrabNebula updater patterns: https://docs.crabnebula.dev/cloud/guides/auto-updates-tauri/
- Signing runbook: `docs/release/tauri-signing-runbook.md`
- Release-trust ADR: `docs/decisions/2026-05-10-adr-release-trust-model.md`
