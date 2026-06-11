# Codex R4.5 Review - Tauri Retro Closure

## 1. Inputs Read

- `/tmp/r4-5-cumulative.diff` - 367-line cumulative diff for commits `ffa2e8a1`, `620ee85d`, `761ea71f`, `b32c7ef0`.
- `COLLAB_TAURI_R4_LAND_REVIEW.md` - original seven R4 land findings.
- Live HEAD files: `src-tauri/capabilities/default.json`, `src-tauri/src/path_validation.rs`, `client/src/lib/desktop/handle-project-open-outcome.ts`, `client/src/lib/desktop/project-open-contract.ts`, `client/src/lib/desktop/storage-key-inventory.json`, `client/src/lib/desktop/storage-migration.ts`, `scripts/dev/generate-storage-key-inventory.ts`, `scripts/dev/check-storage-key-inventory.ts`, `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`, `.github/workflows/tauri-build.yml`.
- External docs via WebSearch/WebFetch only, per instruction: Tauri deep-link guide `https://v2.tauri.app/plugin/deep-linking/` and JS reference `https://v2.tauri.app/reference/javascript/deep-link/`.
- Verification probes run:
  - `npx tsx scripts/dev/check-storage-key-inventory.ts`
  - `npx tsx -e "import { classifyStorageKey } from './client/src/lib/desktop/storage-migration.ts'; ..."`
  - `file client/src/lib/desktop/project-open-contract.ts`
  - `git diff --check -- client/src/lib/desktop/project-open-contract.ts src-tauri/capabilities/default.json src-tauri/tauri.conf.json client/src/lib/desktop/storage-key-inventory.json client/src/lib/desktop/handle-project-open-outcome.ts`
  - `rustc --version`
  - `cargo check --manifest-path src-tauri/Cargo.toml`

Repo-state note: the working tree was already dirty before this review. I made no target edits and wrote only this review file.

## 2. Per-finding Verification

### Blocker #1 - capability deny family across all 6 scopes + Rust constant

Verdict: ratified

Evidence:
- `src-tauri/capabilities/default.json:194-234` now has broad deny globs for `api-key`, `oauth`, `private-key`, `access-key`, `secret`, and `password` across all six reviewed scopes: `$APPDATA/protopulse`, `$APPLOCALDATA/protopulse`, `$HOME/Documents/ProtoPulse`, `$DESKTOP`, `$DOCUMENT`, and `$DOWNLOAD`.
- `src-tauri/src/path_validation.rs:126-142` now defines `DENIED_SUBSTRINGS`, including the requested family plus underscore/passwd variants.
- `src-tauri/src/path_validation.rs:225-234` applies the substring deny after name/prefix/extension checks.
- `src-tauri/src/path_validation.rs:489-511` adds regression coverage for representative credential-bearing basenames.

### Blocker #2 - storage inventory generator/classifier drift

Verdict: needs-revision

What is closed:
- `scripts/dev/generate-storage-key-inventory.ts:48-64` recognizes `protopulse:project-open-prompt-replace` and `protopulse:open-project-from-file` as window event names.
- `scripts/dev/generate-storage-key-inventory.ts:257-260` and `client/src/lib/desktop/storage-migration.ts:76-86` include the `protopulse-order-history(?::|$)` parameterized pattern.
- Probe result: `classifyStorageKey('protopulse:project-open-prompt-replace')` returns `event-name-not-storage`.
- Probe result: `classifyStorageKey('protopulse-order-history:1')` returns `history-cache`.

Still broken:
- `npx tsx scripts/dev/check-storage-key-inventory.ts` exits `4` with inventory drift. The regenerated temp inventory adds `protopulse:open-project-from-file` and updates the prompt-replace callsite line from 49 to 60.
- Committed `client/src/lib/desktop/storage-key-inventory.json:1807-1815` still has only `protopulse:project-open-prompt-replace` at stale line 49.
- The regenerated temp inventory has `protopulse:open-project-from-file` at `client/src/lib/desktop/handle-project-open-outcome.ts:44` and prompt-replace at line 60.
- Probe result: `classifyStorageKey('protopulse:open-project-from-file')` returns `null` because the committed inventory was not regenerated after adding the new event.

### Blocker #3 - committed tauri.conf.json lifecycle/build config

Verdict: ratified

Evidence:
- `src-tauri/tauri.conf.json:22-24` has the tightened CSP without `http://localhost:*`.
- `src-tauri/tauri.conf.json:26-30` has explicit bundle targets plus `externalBin`.
- `src-tauri/tauri.conf.json:36-48` has the `.protopulse` file association and `exportedType`.
- `src-tauri/tauri.conf.json:55-61` has `plugins.deep-link.desktop.schemes`.
- Tauri's deep-link guide confirms desktop schemes live under `tauri.conf.json > plugins > deep-link` and shows the `desktop.schemes` shape: `https://v2.tauri.app/plugin/deep-linking/`.

### Blocker #4 - load-new dispatcher emits event instead of broken route navigation

Verdict: ratified

Evidence:
- `client/src/lib/desktop/handle-project-open-outcome.ts:25-48` now returns early server-side and dispatches `CustomEvent('protopulse:open-project-from-file', { detail: { projectPath, reason } })` for `load-new`.
- The broken `/projects/${encodeURIComponent(path)}` navigation is gone.

Note: this event introduced the Blocker #2 inventory drift above.

### Should-fix #5 - Rust get_current drain + JS getCurrent fallback

Verdict: needs-revision

What is closed:
- `src-tauri/src/lib.rs:558-577` calls `app.deep_link().get_current()` during setup and queues the startup URLs.
- `client/src/lib/desktop/project-open-contract.ts:210` imports `getCurrent`.
- `client/src/lib/desktop/project-open-contract.ts:274-292` calls `getCurrent()` as a JS-side fallback in `installProjectOpenListener`.
- Tauri docs say to use `getCurrent` / `get_current` on app start for startup deep links: `https://v2.tauri.app/plugin/deep-linking/` and `https://v2.tauri.app/reference/javascript/deep-link/`.

Still broken:
- The JS fallback is not capability-enabled. Tauri's deep-link docs say plugin commands/scopes must be enabled in capabilities and show `deep-link:default`; the same page says the default permission allows reading the opened deep link via `get_current`.
- Local generated schema confirms `deep-link:default` and `deep-link:allow-get-current` are the permissions for that command at `src-tauri/gen/schemas/desktop-schema.json:4433-4443`.
- `rg -n "deep-link:default|deep-link:allow-get-current|core:event:default" src-tauri/capabilities src-tauri/permissions src-tauri/tauri.conf.json src-tauri/src/lib.rs client/src/lib/desktop/project-open-contract.ts` finds no deep-link permission in the active capability file. `core:default` covers event listening, but it does not grant the deep-link plugin's `get_current` command.

Impact: the Rust setup drain exists, but the new JS fallback can warn and fail at runtime instead of serving as a working backstop.

### Should-fix #6 - CONTROL_CHAR_RE is text-diffable escaped source

Verdict: ratified

Evidence:
- `client/src/lib/desktop/project-open-contract.ts:73` is `const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/;`.
- `file client/src/lib/desktop/project-open-contract.ts` reports `JavaScript source, Unicode text, UTF-8 text`.
- `git diff --check -- ...` returned clean for the reviewed files.

### Should-fix #7 - rustc 1.90 vs pinned 1.93 local toolchain issue

Verdict: ratified as non-committable local/toolchain skew, with residual local failure documented

Evidence:
- `.github/workflows/tauri-build.yml:57-62` pins CI to Rust `1.93.0`.
- Local `rustc --version` still reports `rustc 1.90.0`.
- `cargo check --manifest-path src-tauri/Cargo.toml` still fails in `specta-2.0.0-rc.25` with `E0658: use of unstable library feature debug_closure_helpers`, matching the original local-toolchain failure.
- `src-tauri/rust-toolchain.toml` exists on disk but is untracked; `git show HEAD:src-tauri/rust-toolchain.toml` reports it is not in HEAD. Per the R4.5 instruction, I do not treat this as a committable R4 closure blocker.

## 3. New Issues Introduced By R4.5

1. `protopulse:open-project-from-file` was added as a new CustomEvent but the committed inventory was not regenerated. The drift check fails, and `classifyStorageKey('protopulse:open-project-from-file')` returns `null`.

2. The new JS `getCurrent()` fallback lacks the required deep-link capability permission. Add `deep-link:default` or the narrower `deep-link:allow-get-current` to the active capability set, then re-check that `onOpenUrl` still has event listen coverage via `core:default`/`core:event:default`.

## 4. Convergence

---
ROUND_STATUS: needs-revision
OPEN_CRITIQUES: [Blocker #2 still fails because committed storage-key-inventory.json drifts from the regenerated inventory after the new protopulse:open-project-from-file event and stale prompt-replace line number; Should-fix #5 is not functionally closed because the JS getCurrent fallback lacks deep-link:default or deep-link:allow-get-current in src-tauri/capabilities/default.json]
SIGNOFF: Codex
OWNERSHIP: Claude leads R4.6
NEXT_ROUND: R4.6 fixes
---
