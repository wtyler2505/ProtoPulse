# Codex Round 2 Handoff — Tauri v2 Migration Deep Research + Self-Critique

**From:** Claude Code
**Date:** 2026-05-09
**Round:** 2 of N (per HARD RULE: bidirectional iteration, multiple adversarial cycles)
**Replaces:** Round 1 handoff (Codex completed — see `CODEX_RESPONSE_TAURI.md` and `docs/audits/2026-05-09-tauri-v2-migration-phase0-codex-verify.md`)

## Round 1 Outcome (Codex's own summary, accepted)

- **Confirmed:** production Express still spawns global `node` — debt note remains valid.
- **Confirmed:** `spawn_process` is arbitrary command execution with no real allowlist — security debt confirmed.
- **NEW high-risk:** frontend invokes Tauri command names that Rust does not register — broken IPC contract.
- **NEW scope correction:** `localStorage`/`sessionStorage` touches **271 client files** — this is a major workstream, not late polish.
- Context7 MCP cancelled its calls in your run; you fell back to official Tauri docs (capabilities, sidecars, updater, CSP). Caveat documented.

Round 1 critique is accepted. Round 2 builds on it.

## Round 2 ask

Three deliverables, all in this round:

### Deliverable A — Self-critique of Round 1
Read your own `CODEX_RESPONSE_TAURI.md` and `docs/audits/2026-05-09-tauri-v2-migration-phase0-codex-verify.md` as if you were Claude reviewing them adversarially. Produce a **counter-critique** that:
1. Lists every claim you made in Round 1 and rates confidence (verified vs inferred vs assumed).
2. Identifies any place where your Round 1 leaned on training data or a single source — flag for re-verification.
3. Lists 5+ scenarios where the Round 1 plan would still fail (operational, security, distribution, user trust, supply chain).
4. Names the 3 highest-risk unknowns that Round 3 must close before any code edits begin.

Write to `CODEX_RESPONSE_TAURI_R2_SELFCRITIQUE.md`.

### Deliverable B — Deep research gap fill (use NotebookLM `research_start`)
Run **NotebookLM deep research** (`mcp__notebooklm-mcp__research_start` with `mode=deep`) for each of these gap topics. Each `research_start` returns a task_id; poll with `research_status` until complete, then `research_import` selected sources back into the **pp-core** notebook. Coordinate with the existing pp-core / pp-hardware / pp-devlab topology — don't create stray notebooks. Use the May 2026 timeframe.

Mandatory gap topics (run all):
1. "Tauri v2 auto-updater best practices and signing key management 2026"
2. "Windows code signing for Tauri desktop apps — EV vs OV certificates, SmartScreen reputation 2026"
3. "macOS notarization for Tauri 2 — Apple Developer Program, hardened runtime, entitlements 2026"
4. "Tauri sidecar bundling for Node.js cross-platform — pkg vs bun-compile vs nexe 2026"
5. "tauri-action GitHub Actions cross-platform release matrix 2026"
6. "Tauri v2 file association registration cross-platform (Win registry, macOS UTI, Linux .desktop MIME) 2026"
7. "Tauri v2 multi-window coordination and IPC patterns 2026"
8. "Tauri v2 deep linking — `tauri-plugin-deep-link` 2026"
9. "Tauri v2 telemetry and crash reporting — Sentry/Crashpad/Bugsnag integration patterns 2026"
10. "Tauri v2 production capability scoping checklist — least-privilege patterns 2026"
11. "Tauri v2 Linux distribution: AppImage vs deb vs Flatpak vs Snap — tradeoffs 2026"
12. "Tauri v2 supply chain security — Cargo audit, npm audit, dependency provenance 2026"

For each topic: append the imported source IDs + 2-sentence summary to a new audit doc `docs/audits/2026-05-09-tauri-v2-migration-r2-deep-research.md`. If a `research_start` fails or returns thin results, document the failure mode and proceed to the next topic — don't stall on any single query.

### Deliverable C — Updated drift table + revised phase plan
Re-emit the drift table from Phase 0 findings + your Round 1 verifications + the Round 2 deep-research insights. Then revise the proposed phase ordering in the original Phase 0 doc (Phases 1-12 of the plan-doc-to-be), reordering based on hard dependencies you've now confirmed. Output to `docs/audits/2026-05-09-tauri-v2-migration-r2-revised-phasing.md`.

## Constraints (still in force)

- **No code edits to `src-tauri/`** — Round 2 is still planning + research.
- **No deletions** of stale knowledge notes — frontmatter updates only, with `verified-2026-05-09` markers.
- **Cite source URLs** for every external claim. Tauri v2 docs are at `v2.tauri.app/*`.
- If Context7 MCP is still flaky, fall back to WebSearch + WebFetch on official Tauri docs and primary plugin repos.
- **Don't ship a one-shot "looks good"** — the self-critique deliverable A is mandatory.

## Output checklist (Codex marks done in CODEX_DONE.md)

- [ ] `CODEX_RESPONSE_TAURI_R2_SELFCRITIQUE.md` written
- [ ] `docs/audits/2026-05-09-tauri-v2-migration-r2-deep-research.md` written with ≥10 of 12 deep-research topics covered
- [ ] `docs/audits/2026-05-09-tauri-v2-migration-r2-revised-phasing.md` written
- [ ] CODEX_DONE.md updated with Round 2 status, blockers, and proposed Round 3 focus
- [ ] No `src-tauri/` files touched
- [ ] `git diff --check` passes (trailing whitespace etc.)
- [ ] No commits — leave artifacts uncommitted for Tyler review
