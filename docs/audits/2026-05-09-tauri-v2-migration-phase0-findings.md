# Tauri v2 Desktop Migration — Phase 0 Findings (Tyler-requested deep plan)

**Date:** 2026-05-09
**Scope:** Inventory current Tauri v2 scaffold vs documented plan in `pp-core` notebook. Surface drift, gaps, and stale debt notes. Hand off to Phase 1 (verification pass) + Codex collaboration.
**Status:** Phase 0 complete. Phases 1-6 deferred to next session due to context capacity.

## What Tyler Asked For

Deep, no-time-pressure migration plan for ProtoPulse → Tauri v2 desktop. Use all NLM tools (CLI + MCP), don't take existing notebook content at face value, use NLM `research_start` deep research for gaps, document every detail, add findings back to the notebook, talk to the notebook AI in chat, **collaborate adversarially with Codex** as a peer reviewer in multiple rounds.

## Current Tauri Scaffold State (drift from `pp-core` plan)

### What's already in `src-tauri/`
- `tauri.conf.json` — present, productName ProtoPulse, identifier `com.protopulse.app`
- `Cargo.toml` — tauri 2 + plugin-shell + plugin-dialog + plugin-fs + plugin-opener + tokio[process]
- `src/lib.rs` + `src/main.rs` — present (need full read in next session)
- `capabilities/default.json` — present (need full read in next session)
- `build.rs`, `Cargo.lock`, `gen/`, `icons/`, `target/` — full scaffold
- `package.json`: `@tauri-apps/api ^2.10.1`, plugin-dialog/fs/opener/shell, `@tauri-apps/cli ^2.10.1`. Scripts: `tauri`, `tauri:dev`, `tauri:build`.

### Critical drift between knowledge debt notes and current config

The two knowledge debt notes are **PARTIALLY STALE** vs current `tauri.conf.json`:

| Knowledge note claim (debt) | Current `tauri.conf.json` reality | Status |
|---|---|---|
| `"csp": null` | `"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://localhost:* https://*.googleapis.com https://*.anthropic.com; font-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:"` | **STALE — CSP is now set** (but allows `style-src 'unsafe-inline'` and broad localhost connect-src) |
| `"withGlobalTauri": true` | `"withGlobalTauri": false` | **STALE — fixed** |
| Express spawned via global `node` | `lib.rs` not yet re-read this session | **UNCONFIRMED — must verify in next session** |
| `spawn_process` exposed without allowlist | `capabilities/default.json` not yet re-read | **UNCONFIRMED — must verify in next session** |

**Action item for Phase 1:** Re-read `src-tauri/src/lib.rs` + `capabilities/default.json` + update both debt notes' frontmatter `confidence` fields based on what's actually true today. Don't delete notes — they have valuable historical context — but mark fields as resolved/partial/still-true accordingly.

### What's MISSING from current scaffold (vs `pp-core` master roadmap [760ae62f])

| Roadmap requirement | Current state | Priority |
|---|---|---|
| `tauri-plugin-serialplugin` for native serial | NOT INSTALLED | P0 — blocks hardware integration |
| `tauri-plugin-hid` for HID devices | NOT INSTALLED | P1 — depends on hardware needs |
| Tauri updater plugin | NOT INSTALLED | P1 — blocks production distribution |
| System tray + global shortcuts | NOT INSTALLED | P2 — UX polish |
| `vite.config.ts` `base: './'` for WebView2 | NOT SET | P0 — Windows blank-screen bug waiting |
| Cargo `[profile.release]` with `lto="fat"`, `codegen-units=1`, `opt-level="z"`, `strip=true`, `panic="abort"` | NOT SET | P1 — bundle bloat |
| Sidecar bundling for Node.js (`bundle > externalBin` with target-triple naming) | NOT CONFIGURED | P0 — debt note (still applicable until verified otherwise) |
| Sidecar bundling for `arduino-cli` | NOT CONFIGURED | P0 — required for self-contained firmware toolchain |
| `tauri-action` GitHub Action for cross-platform builds | NOT VERIFIED | P1 — required for releases |
| Code signing (Win + macOS notarization) | NOT VERIFIED | P1 — required for distribution trust |
| Multi-arch sidecar binaries (x86_64-pc-windows-msvc, x86_64-apple-darwin, aarch64-apple-darwin, x86_64-unknown-linux-gnu) | NOT VERIFIED | P1 — required for cross-platform |
| `@tauri-apps/plugin-process` (relaunch / app-state) | NOT INSTALLED | P2 |
| Window state persistence (size/position) plugin | NOT INSTALLED | P2 |
| File associations for `.protopulse` extension | NOT VERIFIED | P2 — UX |

### CSP tightening needed

Current CSP allows:
- `style-src 'self' 'unsafe-inline'` — `'unsafe-inline'` is exploitable via injected stylesheets. Move all inline styles to nonce-based or remove `'unsafe-inline'`.
- `connect-src 'self' http://localhost:* https://*.googleapis.com https://*.anthropic.com` — `http://localhost:*` is broad; in production desktop builds this should be removed (only dev mode needs it, and dev/prod CSP should split).

## Codex Coordination Status

- **Codex's most recent completed work** (`CODEX_DONE.md` 2026-05-09 19:37): DevLab mirror sync infrastructure — built `scripts/pp-nlm/devlab_mirror_sync.py`, autosync request system, longer DevLab source-count timeout, hardened DevLab chat prompt, mirror-manifest tracking. PP-NLM territory.
- **Codex is currently idle** — last work shipped, no in-progress markers.
- **Codex's stale handoff** (`CODEX_HANDOFF.md` 2026-05-09 12:55) is BL-0875 a11y fixes, marked done in CODEX_DONE.md.
- **Lane reset for this task:** Tyler explicitly said me + Codex collaborate on Tauri migration plan. PP-NLM lane rule still applies (Codex owns infra), but for THIS plan: shared scope, adversarial review cycles per [feedback_codex_bidirectional_iteration.md](feedback_codex_bidirectional_iteration.md). New `CODEX_HANDOFF.md` written this session proposing the collaboration model.

## pp-core Tauri Source Inventory (full list pulled from query [conversation_id 5533eddd])

| Source ID | Title | Role | Read in full? |
|---|---|---|---|
| 760ae62f-32a6-4273-9bdd-175dbb09086f | Architectural Integration of the ProtoPulse Desktop Shell: A Technical Realization of the Tauri v2 Path | Master roadmap | YES (25,283 chars, 45 cited URLs) |
| 3dae82c8-318a-466d-9237-ee45264c7621 | Architectural Integration of Native Serial Communication in the Tauri v2 Ecosystem | Web Serial → tauri-plugin-serialplugin migration | NO — Phase 1 read |
| 47e4baf2-41f1-4991-97e4-d378aff8a065 | Tauri vs Electron 2026: Performance, Bundle Size & Security | Comparison source | NO — Phase 1 read |
| 7d5b21d2-76fb-4069-b51f-595d16dbc963 | (additional Tauri/Electron comparison detail) | Comparison source | NO — Phase 1 read |
| 2c203d75-39b8-4e5a-99b2-91b9f0138d2a | browser-based-eda-hits-a-platform-boundary-at-firmware-execution.md | Why-pivot rationale | NO — Phase 1 read |
| 6e77c3d3-25af-441e-94ed-d5e40eb7a89b | five-architecture-decisions-block-over-30-downstream-features-each.md | ADR with 5 decisions | NO — Phase 1 read |
| eb9437be (full ID TBD) | the-hybrid-runtime-architecture-for-firmware-is-the-only-viable-path...md | Historical (overridden) | NO — Phase 1 read |
| 0f2fc19f-6f51-4dc4-8840-ac924134be9e | Web Serial API mocking double-cast pattern | Test pattern | NO — Phase 1 read |
| 62a2e851-c9dd-476f-b4c0-79994643c06a | localStorage features audit (persistence debt) | Phase 4 driver | NO — Phase 1 read |
| 6fd61a6f-fff0-483d-a270-abf650b51738 | Agent team OOM gotcha | Operational | already covered |
| 376dfceb-9553-4a51-98a2-fd7313ef84be | Agent team teammate death gotcha | Operational | already covered |
| 258b47ac-7f02-4317-8e8a-ee041d3e7935 | CLAUDE.md context tax gotcha | Operational | already covered |

## DevLab Mirror Tauri Sources

| Source ID | Title | Notes |
|---|---|---|
| a4db3323-e7f3-4eed-90d5-3f7e14c6d933 | Core Mirror :: …Tauri v2 Path | Mirror of 760ae62f |
| e6f1fa24-71ba-49f8-ac5e-5e6a1a0398cb | Core Mirror :: Native Serial Communication | Mirror of 3dae82c8 |
| 8386f196-6a01-4bde-bb48-af63af0abc22 | Hardware Mirror :: architecture-decisions v1 — 2026-05-09 | Confirms 3 C5 unblocked |
| 6e7241a9 (full ID TBD) | Hardware Mirror :: competitive-landscape v1 — 2026-05-09 | Confirms desktop pivot value |
| b12169d6-eaa1-4efc-90ad-16dfaacb1575 | (Hardware Mirror with sidecar debt note) | DevLab debt log |
| 28226b2a-b8f8-440f-b67c-ff6866f4d38a | Core Mirror :: hybrid-runtime…viable-path | Historical |

## Phase Plan (Phases 1-6 for next session)

### Phase 1 — Full source read + claim verification (3-5 hours wall, low risk)
1. `mcp__notebooklm-mcp__source_get_content` for each remaining pp-core source (8 sources). Save full text to `/tmp/tauri-source-*.md` for offline reasoning.
2. Read `src-tauri/src/lib.rs` and `src-tauri/capabilities/default.json` — verify the two debt notes' claims about node spawn + spawn_process command.
3. Read current `vite.config.ts` to confirm `base: './'` is/isn't set.
4. Run `npm run tauri:dev` (timed) to confirm scaffold actually compiles cleanly — record any errors as Phase 1 findings.
5. For every claim in the master roadmap [760ae62f] that cites a URL: WebFetch (or WebSearch May 2026) to verify the cited URL still resolves and the documented behavior matches current upstream.
6. Context7: `resolve-library-id` for "Tauri", "tauri-plugin-serialplugin", "tauri-plugin-shell", "tauri-plugin-fs", "tauri-plugin-updater", "@tauri-apps/api"; `query-docs` for current v2 setup, capabilities, sidecar bundling, updater config.
7. **Update knowledge notes** — both stale debt notes get frontmatter updates (don't delete, mark `status: partially-resolved` or `status: resolved-2026-05-09` with the verification commit reference).

### Phase 2 — Codex bidirectional review (4-6 rounds)
1. After Phase 1, write `CODEX_REVIEW_REQUEST_TAURI.md` with the verified findings.
2. Codex returns adversarial critique → revise → next round.
3. Continue until both Claude + Codex agree no open holes.
4. Per [feedback_codex_bidirectional_iteration.md](feedback_codex_bidirectional_iteration.md): never one-shot; multiple rounds.

### Phase 3 — Gap analysis with NLM deep research
1. `mcp__notebooklm-mcp__research_start` (mode=deep, ~5min, ~40 sources) for each gap topic:
   - "Tauri v2 auto-updater best practices 2026"
   - "Windows code signing EV certificate vs OV for Tauri 2026"
   - "macOS notarization Apple Developer Program Tauri 2026"
   - "Tauri sidecar bundling for Node.js cross-platform 2026"
   - "tauri-action GitHub Actions cross-platform builds matrix 2026"
   - "Tauri v2 file associations registration cross-platform 2026"
   - "Tauri window state persistence plugin 2026"
   - "Tauri v2 multi-window coordination patterns 2026"
   - "Tauri v2 telemetry / Sentry crash reporting 2026"
   - "Tauri v2 capability scoping production hardening checklist 2026"
2. Poll each via `research_status` (5 min each, parallel).
3. `research_import` selected sources back into pp-core (or new dedicated notebook).
4. Cross-reference each new source against existing notebook content.

### Phase 4 — NotebookLM AI extended chat
1. `mcp__notebooklm-mcp__notebook_query` against pp-core with multi-turn `conversation_id`:
   - Round 1: "Summarize what could break in the migration based on all sources."
   - Round 2: "What's missing from the plan that's standard practice for Tauri 2026?"
   - Round 3: Press on weak points found in Round 2.
   - Round 4: Synthesis ask — "If you were writing the plan, what would you change?"
2. Capture insights → feed into Phase 5 plan doc.

### Phase 5 — Write the implementation plan
File: `docs/plans/2026-05-09-tauri-v2-desktop-migration.md`. Follow [the plan template](docs/plans/2026-03-05-pcb-layout-engine.md):
- Goal/Architecture/Tech Stack header
- Existing Infrastructure table (the drift table from this Phase 0 doc)
- Phased TDD tasks (failing test → implement → run → commit)
- `/agent-teams` prompts per phase with file ownership matrix
- Mandatory Context7 + WebSearch research citations per phase
- Team Execution Checklist
- Decisions Log with Codex consensus signatures

Phases inside the plan (proposed):
1. **CSP + capability hardening** — fix CSP `unsafe-inline`, narrow `connect-src` for production, audit `capabilities/default.json` allowlist, verify `withGlobalTauri:false` enforced.
2. **Vite production fix** — set `base: './'`, verify Windows WebView2 build doesn't blank-screen.
3. **Cargo release profile** — add `[profile.release]` with lto/codegen-units/opt-level/strip/panic.
4. **Sidecar bundling for Node** — bundle Node binary per target-triple, remove dependency on global `node`.
5. **Sidecar bundling for arduino-cli** — same pattern.
6. **Native serial migration** — install `tauri-plugin-serialplugin`, replace browser Web Serial calls + tests.
7. **Updater plugin** — install + configure manifest signing.
8. **Tauri action CI/CD** — `.github/workflows/tauri-release.yml` with cross-platform matrix.
9. **Code signing + notarization** — Win cert + Apple Developer Program setup.
10. **localStorage → native FS migration** — migrate all 6+ localStorage-only features per pp-core source [62a2e851].
11. **System tray + global shortcuts** — optional UX polish.
12. **Window state persistence + file associations** — UX polish.

### Phase 6 — Add findings back to notebook
1. Add this Phase 0 findings doc as a source to pp-core via `source_add` (file or text).
2. Add the final implementation plan as a source.
3. Add any new research-imported sources to pp-core.
4. DevLab mirror auto-syncs (Codex's autosync handles this).

## Carry-Forward State

When the next session resumes (after Tyler's `/clear` or fresh start):

1. **Read this doc first** — `docs/audits/2026-05-09-tauri-v2-migration-phase0-findings.md`.
2. Read `CODEX_HANDOFF.md` (Tauri collab handoff) for collaboration model with Codex.
3. Skip Phase 0 (done). Start at Phase 1 — full source reads + claim verification.
4. The 12 pp-core source IDs + 6 DevLab source IDs are listed above.
5. The drift table is the prioritized work surface.

## Key Memory Rules in Play

- **DO REAL RESEARCH ALWAYS** — Context7 + WebSearch + cite source URLs every claim ([feedback_real_research_always.md])
- **RESEARCH BEFORE EVERY PHASE** — every phase, even within an approved plan ([feedback_research_before_each_phase.md])
- **PERFECTION OVER SPEED** — no time pressure, every detail right ([feedback_perfection_over_speed.md])
- **NO BULK SCRIPTS FOR CRAFT WORK** — each migration phase hand-crafted ([feedback_no_bulk_scripts_for_craft_work.md])
- **HARD RULE: Bidirectional iteration with Codex** — never one-shot RPC; multiple adversarial review cycles ([feedback_codex_bidirectional_iteration.md])
- **Plan template** — must follow `docs/plans/2026-03-05-pcb-layout-engine.md` shape

## Known Risk: Stale Knowledge Notes

The two extracted Tauri debt notes in `knowledge/` were extracted from an audit (`conductor/comprehensive-audit.md`) that pre-dates the current `tauri.conf.json`. CSP is now set and `withGlobalTauri:false` is correct. Don't trust audit-derived notes without re-verifying against current code state — this is a recurring failure mode.
