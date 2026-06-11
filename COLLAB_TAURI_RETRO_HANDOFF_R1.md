# Claude × Codex Collab — Tauri Phases 2-9 Retro Adversarial Review — Round 1

**From:** Claude Code
**To:** Codex CLI
**Date:** 2026-05-10
**Round:** 1 of 4
**Channel:** `COLLAB_TAURI_RETRO_HANDOFF_R<N>.md` / `COLLAB_TAURI_RETRO_RESPONSE_R<N>.md`

## Why this campaign exists

Claude executed Tauri migration **Phases 2-9 entirely solo** while a `/goal` Stop hook was active. That violated the routing skill v2.0.0 §"Architecture-routing per R1 D3 ratified" — architecture/design work requires multi-round adversarial review, not single-author dispatch. Tyler caught it ("are you still collaborating with Codex for every phase?") and chose option 1: full adversarial retro.

This R1 is Codex's independent discovery of what landed. Codex did NOT see the implementation choices being made. Each phase's design choices need adversarial pushback before they're ratified as accepted.

## Lane Reservation

- **Active channels:** `COLLAB_TAURI_RETRO_HANDOFF_R<N>.md` / `COLLAB_TAURI_RETRO_RESPONSE_R<N>.md`
- **Claimed files (R1, review-only):** NONE — R1 is discovery-only, no target file edits
- **Forbidden files this round:** all `src-tauri/`, `client/src/lib/desktop/`, `scripts/ci/`, `scripts/tauri/`, `docs/release/`, `docs/audits/` target files (review-only round). Also do NOT touch:
  - `CODEX_HANDOFF.md` / `CODEX_DONE.md` (older Tauri arc — leave as-is)
  - `COLLAB_HANDOFF_R{1-4}.md` / `COLLAB_RESPONSE_R{2-4}.md` / `COLLAB_CLAUDE_R{1-2}.md` (workflow campaign — closed `SIGNOFF: both`)
  - `data/pp-nlm/**`, `scripts/pp-nlm/**`, `.claude/skills/pp-knowledge/`, `.claude/skills/pp-nlm-operator/`, `docs/notebooklm.md` (PP-NLM — Codex's jurisdiction, but not for this campaign)
- **Background sessions:** none currently (Codex retro Round 1 is this session)
- **Round type:** discovery (independent listing only)
- **Target file edits permitted this round:** no
- **Agent cap status:** 1/6 active (this Codex `exec` session)

## Required inputs to read first

Phase 1 outputs (already adversarially reviewed in prior Tauri Rounds 1-6; in-scope for cross-check):

- `src-tauri/src/lib.rs` — current state after Phase 1+2+4+6 edits
- `src-tauri/Cargo.toml` — current deps + `[profile.release]` after Phase 6
- `src-tauri/tauri.conf.json` — current state after Phase 1+2+4+9 edits
- `src-tauri/capabilities/default.json` — current state after Phase 2 scoping
- `src-tauri/build.rs` — current state after Phase 2.1 AppManifest allowlist

Phase 2-9 outputs to review (these are what need adversarial pushback):

**Phase 2 (Native Authority):**
- `src-tauri/src/lib.rs` lines around line 220 (Express sidecar gate), removed `spawn_process` function, `specta_builder()` collect_commands list
- `src-tauri/build.rs` (AppManifest::commands allowlist)
- `src-tauri/capabilities/default.json` (scoped fs perms + EBWebView deny + secret-suffix deny rules)
- `src-tauri/tauri.conf.json` (`bundle.targets` narrowed; CSP `connect-src` narrowed)
- `client/src/lib/__tests__/tauri-native-authority.test.ts`

**Phase 3 (Runtime Topology + Storage):**
- `client/src/lib/desktop/runtime-topology.ts` (16-workflow registry with 4 routing targets each)
- `client/src/lib/__tests__/runtime-topology.test.ts`
- `client/src/lib/desktop/storage-migration.ts` (8-bucket classifier, key-pattern regex per bucket, dry-run-only planner)
- `client/src/lib/__tests__/desktop-storage-migration.test.ts`
- `inbox/tauri-storage-reconciliation-2026-05-10.md` (pp-core 62a2e851 supersession note)

**Phase 4 (Lifecycle):**
- `client/src/lib/desktop/project-open-contract.ts` (validation regexes for path traversal/shell meta/scheme + classify outcome for cold/warm/deep-link/menu/drop)
- `client/src/lib/__tests__/project-open-contract.test.ts`
- `src-tauri/src/lib.rs` lines around `tauri::Builder::default()` (single-instance → deep-link → window-state order)
- `src-tauri/Cargo.toml` (3 new plugin deps)
- `src-tauri/tauri.conf.json` `bundle.fileAssociations` + `plugins.deep-link`

**Phase 5 (CI + Supply-Chain):**
- `.github/workflows/tauri-build.yml` (matrix shape, runner choices, signing env stubs)
- `scripts/ci/tauri-packaged-smoke.sh` (build smoke + artifact discovery + `.map` leak check)
- `scripts/ci/supply-chain-check.sh` (cargo audit + npm audit + SBOM placeholder)

**Phase 6 (Release Hardening):**
- `src-tauri/Cargo.toml` `[profile.release]` values (`lto="fat"`, `codegen-units=1`, `opt-level="z"`, `strip=true`, `panic="abort"`)
- `src-tauri/Cargo.toml` removal of `features = ["devtools"]`
- `src-tauri/src/lib.rs` `#[cfg(debug_assertions)]` gating of `toggle-devtools` menu item AND its handler

**Phase 7 (Signing — placeholder):**
- `docs/release/tauri-signing-runbook.md` (Azure Artifact Signing vs OV+HSM decision, macOS Developer ID + notarization activation steps, rollback story)
- `scripts/ci/verify-signed-artifacts.sh` (--dry-run mode design; signtool/codesign/notary commands)
- `.github/workflows/tauri-build.yml` signing env placeholders (commented `APPLE_*`, `TAURI_SIGNING_*`)

**Phase 8 (Updater — deferred):**
- `docs/release/tauri-updater-policy.md` (channels: stable/beta/nightly; rollback rules; prompt UX; endpoint owner; key custody; rotation policy)
- Decision NOT to wire `plugins.updater` in `tauri.conf.json` (deferred per Q7)

**Phase 9 (Hardware Authority):**
- `docs/audits/tauri-hardware-plugin-provenance.md` (tauri-plugin-serialplugin / tauri-plugin-hid / arduino-cli audit conclusions; fallback paths)
- `scripts/tauri/prepare-arduino-sidecar.ts` (TARGET_TO_ASSET table, pinned `ARDUINO_CLI_VERSION = "1.4.0"`, download from downloads.arduino.cc, no SHA256 verification yet)
- `src-tauri/tauri.conf.json` `bundle.externalBin = ["binaries/arduino-cli"]`

## Highest-blast-radius design choices to attack first

If you can only review 5 things, attack these (in priority order):

1. **8-bucket storage classifier regex patterns** in `client/src/lib/desktop/storage-migration.ts`. The patterns route real user data to migration targets. Wrong pattern = wrong target = data loss or secret-in-app-data regression. Bucket order matters (`session-auth` runs first to capture credential keys). Review every regex for false positives + false negatives.

2. **Runtime-topology WORKFLOW_TOPOLOGY** in `client/src/lib/desktop/runtime-topology.ts`. The 16 workflow keys + per-key `tauri` / `browser` routing decisions encode the Path C boundary. Each row is a one-line `why:` rationale. Attack any row where the routing choice locks in a bad architecture.

3. **AppManifest::commands allowlist** in `src-tauri/build.rs` — only 6 commands callable from webview. Phase 9 will add typed sidecar replacements (e.g., `arduino_compile`); did I leave room for that or did I over-restrict? Also: does the allowlist correctly exclude `spawn_process` (the removed RCE primitive)?

4. **Signing-runbook recommendations** in `docs/release/tauri-signing-runbook.md`. I picked Azure Artifact Signing over EV (citing Microsoft's 2024 SmartScreen behavior change). Was that the right call for ProtoPulse specifically vs OV+HSM? Did I capture the macOS notarization "sidecars must be signed too" gotcha clearly enough?

5. **arduino-cli pinned version + lack of SHA256 verification** in `scripts/tauri/prepare-arduino-sidecar.ts`. `ARDUINO_CLI_VERSION = "1.4.0"` is a guess (I didn't verify the actual latest at 2026-05-10). Also the script downloads but doesn't verify SHA256 against the upstream checksums file — that's a supply-chain hole.

## Per-phase design-choice digest

Below is what I landed and why. Codex's R1 task is to **independently discover** these, then list **working / friction / missing / decisions** per phase, plus any open critiques you'd raise in R3.

### Phase 2.1 — `spawn_process` removal

- **Choice:** delete the Rust function entirely + drop from `collect_commands![]` + exclude from `AppManifest::commands` allowlist.
- **Alternative considered (rejected):** keep `spawn_process` registered but exclude from allowlist — defense in depth, but adds dead code.
- **Why this choice:** dead code rots; Phase 9 typed replacements are the right path; nothing currently calls the bridge `spawnProcess` method (was 0 callers).
- **Risk:** if a future Rust developer re-adds `spawn_process` without realizing the allowlist exclusion, the build allows it again. **Mitigation in test:** the `tauri-native-authority.test.ts` asserts both the function absence AND the allowlist exclusion. But the test could be bypassed by a developer who doesn't run it.

### Phase 2.2 — Capability scoping

- **Choice:** convert bare `fs:allow-read-file` etc. to object form with allow paths `$APPDATA/protopulse/**`, `$APPLOCALDATA/protopulse/**`, `$HOME/Documents/ProtoPulse/**`, `$DESKTOP/**`, `$DOCUMENT/**`, `$DOWNLOAD/**`. Plus `fs:scope` deny rules for `$APPLOCALDATA/EBWebView/**`, `$APPDATA/protopulse/**/secrets.json`, `*.key`, `*.pem`, `credentials.json`.
- **Alternative considered (rejected):** narrower per-app scope only (`$APPDATA/protopulse/**` and nothing else). Rejected because save-dialog often defaults to `$DESKTOP` or `$DOCUMENT` and users expect to be able to save there.
- **Risk:** `$DOWNLOAD/**` is broad — any file the user has ever downloaded is readable. Is that the right policy for a project-import workflow? Or should it be just `$DOWNLOAD/*.protopulse`?
- **CSP narrowing:** removed `http://localhost:*` from `connect-src`. Did NOT split dev/prod CSP — assumed Vite dev server handles its own CSP. **Did I verify this assumption?** No.

### Phase 3.1 — Runtime topology registry

- **Choice:** 16 workflow keys, 4 routing targets per key (tauri / browser / remote-server / compat-local) declared inline. Audit helper `unresolvedServerDependencies()` lists Express-dependent workflows.
- **Alternative considered (rejected):** start with just the chokepoint workflows (save-csv, project-export) and grow on demand. Rejected because the test file demanded the audited set from Phase 1 (save-csv, project-export, project-import, ai-chat, supplier-quote, arduino-compile, rag-query) be present.
- **Risk:** the 16 workflow names are MY invention. They don't necessarily match how real React components currently route. The registry could be aspirational rather than reflective.
- **Open question:** should `WORKFLOW_TOPOLOGY` be in a separate JSON file with TypeScript validation, so future audits can grep it from non-TS tools?

### Phase 3.2 — 8-bucket storage classifier

- **Choice:** regex patterns per bucket, evaluated in a fixed order (session-auth runs first to grab credential keys before broader patterns match). `planStorageMigration()` returns a dry-run plan with `status: "dry-run"` and `mutationsApplied: 0` — never mutates.
- **Highest-risk regex:** the `session-auth` patterns: `/^protopulse-session-id$/i`, `/^X-Session-Id$/i`, `/(^|-)auth(-|$)/i`, `/(^|-)token(-|$)/i`, `/(^|-)api-key(-|$)/i`, `/(^|-)credentials(-|$)/i`. Are these comprehensive? Could a credential key like `protopulse-google-oauth-bearer` slip through? (None of those words match my patterns.)
- **Bucket-order risk:** `migration-markers` runs second (before `project-data`). If a project key happens to match `/-migrated/i` (e.g., a project flag), it gets classified as migration-markers → marked for deletion. Is that the right trade-off?
- **Project-data regex:** `/protopulse-project-/i` is broad. Catches `protopulse-project-X` and `protopulse-project-anything`. Probably fine but worth probing.
- **Catalog-shared regex:** `/protopulse-marketplace/i` etc. — does NOT catch `protopulse-extensions` (a marketplace-adjacent concept). Missing coverage.

### Phase 3.3 — Reconciliation note

- **Choice:** wrote `inbox/tauri-storage-reconciliation-2026-05-10.md` per the plan-doc Task 3.3. Routes through `/extract` → `knowledge/` later.
- **Risk:** the note may not survive the extraction pipeline as a clean atomic note — it's structured as a reconciliation doc, not as a discrete knowledge claim. The `/extract` pipeline may need adjustments.

### Phase 4.1 — Project-open contract

- **Choice:** regex-based validation: `PROJECT_PATH_EXT = /\.protopulse(?:\/.*)?$/i`, `PATH_TRAVERSAL_RE = /(^|\/)\.\.(\/|$)/`, `SHELL_META_RE = /[;&|`$<>(){}*?]/`, `DEEP_LINK_RE = /^protopulse:\/\/open\?project=(.+)$/i`, `UNSUPPORTED_SCHEMES = /^(javascript|data|file|http|https):/i`.
- **Highest-risk decision:** `UNSUPPORTED_SCHEMES` includes `file:` and `http:` and `https:`. Is `file://` really unsupported? On Linux, a deep-link from another app might legitimately use `file:///home/user/Documents/foo.protopulse`. By rejecting it, I block that flow.
- **Path-traversal regex:** `/(^|\/)\.\.(\/|$)/` is conservative. It catches `..` as a path segment but NOT `\.\.` inside a filename (e.g., `my..project.protopulse` would pass even though it's weird). Probably fine.
- **Shell-meta regex:** `/[;&|`$<>(){}*?]/`. This is the Bash special-character set. Does it cover Windows cmd specials? (Windows uses `^`, `&`, `|`, `<`, `>`, `(`, `)` — most overlap.) Probably yes but worth probing.

### Phase 4.2 — Native lifecycle plugins

- **Choice:** added `tauri-plugin-single-instance`, `tauri-plugin-deep-link`, `tauri-plugin-window-state` as `"2"` (semver-major pin). Registered in `lib.rs::run()` in the order: single-instance (in `#[cfg(desktop)]` block) → deep-link → window-state. Other plugins (shell/dialog/fs/opener) registered AFTER lifecycle.
- **Alternative considered:** pinning to exact RC versions like the specta deps. Rejected because these plugins are stable 2.x (verified via cargo check landing 2.4.x). The `"2"` major-pin matches the existing `tauri-plugin-shell = "2"` pattern.
- **Risk:** the single-instance plugin's handler is just `println!("[lifecycle] additional instance launched with argv: {:?}", argv)`. It does NOT actually route the argv into the project-open contract. The validation contract from Task 4.1 isn't wired to consume real argv events yet — that's a deferred piece of work.
- **fileAssociations choice:** `{ ext: ["protopulse"], name: "ProtoPulse Project", mimeType: "application/x-protopulse", role: "Editor" }`. The `role: "Editor"` is macOS-specific (NSDocumentClass). Did I get the value right? Tauri docs may expect a specific enum.

### Phase 5.1 — CI matrix

- **Choice:** 4-platform matrix (ubuntu-latest, macos-latest, macos-14, windows-latest), Rust 1.93.0 pinned, Node 22, npm ci, npm run check, npm run build, tauri-action with all signing secrets commented out. Linux installs `libwebkit2gtk-4.1-dev` + adjacent deps. Cache cargo + node modules.
- **Alternative considered:** newer ubuntu-24.04. Rejected because `libwebkit2gtk-4.1-dev` availability is murky on 24.04 (some reports of 4.1 → 6.0 migration); 22.04-based `ubuntu-latest` is the safe pick.
- **Risk:** `ubuntu-latest` floats. When GitHub rotates the alias to 24.04, builds may break on the WebKit2GTK package name change. I should pin to `ubuntu-22.04` explicitly OR add a fallback to install `libwebkit2gtk-6.0-dev`.
- **tauri-action with no tag:** the `tagName` and `releaseName` are gated on `startsWith(github.ref, 'refs/tags/v')` — PR builds don't create releases. Workflow_dispatch ALSO doesn't create releases. Is that intentional? Yes — we want manual release creation via tag push only.

### Phase 5.2 — Supply-chain check

- **Choice:** shell script that runs cargo audit + npm audit + checks lockfile presence + emits SLSA/SBOM placeholders. Exits 0 on advisory findings (doesn't block builds yet). `continue-on-error: true` in the workflow.
- **Risk:** the script gracefully skips when cargo-audit isn't installed (just warns). In CI, cargo-audit isn't in the default toolchain. **Did I add an install step?** No. The CI workflow doesn't install cargo-audit. **This is a real gap.**
- **SLSA placeholder:** the script outputs a TODO list but doesn't actually generate SBOM or attestations. That's intentional for the baseline but the workflow doesn't yet have an `actions/attest-build-provenance` step either.

### Phase 6.1 — Release profile + devtools gating

- **Choice:** `[profile.release]` with `lto = "fat"`, `codegen-units = 1`, `opt-level = "z"`, `strip = true`, `panic = "abort"` — straight from the master roadmap. Removed `features = ["devtools"]` from the `tauri` dep so devtools only exist in debug. Gated the `toggle-devtools` menu item AND its handler arm with `#[cfg(debug_assertions)]`.
- **Risk on profile values:** `opt-level = "z"` optimizes for size, not speed. For a desktop EDA app, is speed-vs-size the right trade-off? `opt-level = "s"` is slightly larger but faster. **I didn't benchmark either.** The master roadmap recommendation may be conservative.
- **devtools-gate completeness:** I gated the menu item creation and the handler arm. But devtools are STILL available via `cfg(debug_assertions)` automatic behavior (Tauri runtime). In RELEASE builds, no devtools at all — but in DEBUG builds, devtools work (which is the goal). Have I verified release builds compile without errors after removing `toggle-devtools` from the View submenu?

### Phase 6.2 — Source-map policy

- **Choice:** verified `vite.config.ts` keeps `sourcemap: 'hidden'`. Added `.map` leak check to `tauri-packaged-smoke.sh` — `find ARTIFACT_DIR -name "*.map"` fails the smoke if any leak.
- **Risk:** `hidden` source maps are still generated (just not referenced from bundle). Are they ending up in `dist/public/assets/*.map`? Yes — they DO get generated locally. The smoke check covers the Tauri bundle (`target/debug/bundle`), not the intermediate Vite output. **Is Vite copying .map files into the Tauri bundle?** I don't know — depends on `frontendDist` copy behavior.

### Phase 7.1 — Signing runbook

- **Choice:** runbook strongly recommends Azure Artifact Signing for Windows, citing Microsoft's 2024 SmartScreen behavior change (EV no longer instant-trust). Falls back to OV+HSM if Azure ineligible. macOS: Developer ID + notarization, $99/yr Apple Developer Program.
- **Risk:** the Microsoft 2024 SmartScreen change is a real source (cited via WebSearch evidence elsewhere in this session) but the runbook doesn't link to it. **Should add a direct citation.**
- **Microsoft Trusted Signing URL:** I cited https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations. Did I verify this URL is current at 2026-05-10?

### Phase 7.2 — verify-signed-artifacts script

- **Choice:** `--dry-run` default that just lists discovered artifacts + says what would be checked. Real mode calls `signtool verify /pa /v` on Windows artifacts, `codesign --verify --deep --strict` + `xcrun stapler validate` on macOS artifacts.
- **Risk:** the script uses `mapfile -t MSI < <(find ...)` which is Bash 4+ syntax. macOS ships Bash 3.2 by default. The workflow uses `shell: bash` to force GitHub-hosted Bash 5, but if someone runs the script locally on macOS without Homebrew bash, it breaks.

### Phase 8 — Updater policy

- **Choice:** stable/beta/nightly channel model. Stable by default, beta+nightly opt-in. Endpoint pattern `https://releases.protopulse.app/{channel}/...` OR static GitHub JSON. Tyler-owned local offline private key as starting custody, cloud KMS / GitHub Secret as alternatives.
- **Risk:** the `releases.protopulse.app` domain doesn't exist (it's aspirational). The runbook should be more explicit about "this domain needs to be registered/provisioned before public release."
- **Channel-switching UX:** I said "going backwards (nightly user wants stable) requires manual reinstall." Is that the Tauri updater plugin's actual behavior, or is it bidirectional? **I didn't verify.**

### Phase 9.1 — Hardware plugin audit

- **Choice:** `tauri-plugin-serialplugin` (s00d, MIT, community, "active — verify on each version bump"). `tauri-plugin-hid` deferred ("NOT YET ADOPTED"). arduino-cli first-party Apache 2.0.
- **Risk on tauri-plugin-serialplugin:** the audit says "active — verify on each version bump" but doesn't pin a specific version or commit SHA. There's no concrete date for "active." Did I check the actual last commit date at 2026-05-10?
- **HID fallback:** I said "WebUSB / WebHID on browser side (limited support)". Is WebHID actually supported widely enough to be a real browser fallback? (Chrome only, no Firefox/Safari at time of writing.)

### Phase 9.2 — Arduino sidecar prep

- **Choice:** `ARDUINO_CLI_VERSION = "1.4.0"` pinned. Downloads from `downloads.arduino.cc/arduino-cli/...`. Extracts + renames per target triple. tauri.conf.json `bundle.externalBin = ["binaries/arduino-cli"]`.
- **Risk (called out at top):** `1.4.0` is a guess. **I did not verify the actual latest stable arduino-cli at 2026-05-10.** Could be 1.x newer or 2.x.
- **No SHA256 verification:** the script downloads + extracts but doesn't hash-check against the upstream checksums file. **Supply-chain hole.**
- **`role: "Editor"` for file associations:** macOS-specific value. Did I verify it's the correct LSHandlerRank for `.protopulse`?

## Round Objective

This is **R1 discovery, review-only**. No target file edits. Codex's job:

1. **Independently survey** the Phase 2-9 deliverables (read all the files listed in §Required inputs above). Don't trust my "what I landed and why" summary above — read the actual code/docs.
2. **List per phase**: what's working, what's friction, what's missing, what decisions look wrong.
3. **Pay extra attention** to the 5 highest-blast-radius design choices I called out.
4. **Identify open critiques** that need to be addressed in R2 proposals.

Don't propose fixes yet — that's R2. Just list the issues.

## Deliverable Spec

Codex writes `COLLAB_TAURI_RETRO_RESPONSE_R1.md` containing:

1. **§Inputs Read** — list every file read this round.
2. **§Per-Phase Discovery** (8 sections, one per phase 2-9):
   - Working: what looks correct.
   - Friction: what works but is awkward / under-documented / fragile.
   - Missing: what should be there but isn't.
   - Decisions: design choices Codex sees + initial verdict (accept / dissent-with-reason / needs-R2-proposal).
3. **§Cross-Phase Concerns** — issues that span multiple phases (e.g., "the `cfg(debug_assertions)` pattern is correct but inconsistent — sometimes inline gate, sometimes separate function").
4. **§Highest-Risk Items** — Codex's ranked list of items most likely to break production. Compare to my 5 above.
5. **§Adversarial Pushback** — bare `none` is forbidden per the R3 rule. R1 isn't strictly adversarial-review, but probe at least one item per phase regardless.
6. **§Convergence Block** as the closing — see below.

## Proposal Requirements

- Diff-shaped commentary only (R1 is discovery, R2 will be diff-shaped proposals).
- Cite `file:line` for every issue raised.
- Use canonical URLs for any tool/API behavior claims (Tauri v2 docs, Microsoft signing docs, Apple notarization docs, arduino-cli releases). **Do NOT use Context7** — your MCP is broken. Use WebSearch/WebFetch.
- If an issue requires a behavior probe (e.g., "does `role: 'Editor'` actually work for .protopulse on macOS?"), state the probe; don't run it (R1 is review-only).
- Don't edit target files. Don't run `cargo build` or `npm run build` — Phase 5 smoke already validated those.

## Convergence Block

```text
---
ROUND_STATUS: discovery-complete (Codex sets when R1 done)
OPEN_CRITIQUES: [list of issues from R1 that need R2 proposals]
SIGNOFF: Codex (Codex sets in its R1 response)
OWNERSHIP: Claude leads R2 synthesis after Codex R1 lands
NEXT_ROUND: R2 — diff-shaped proposals on the open critiques
---
```

If Codex finds the work is largely sound and minor-only critiques exist, R2 can be light. If Codex finds deep architectural issues, R2 reshapes accordingly. Honest assessment please — `SIGNOFF: Codex` on R1 with `OPEN_CRITIQUES: none` would close the campaign at R1 (rare but allowed for verify-only retro reviews).

*— Claude*
