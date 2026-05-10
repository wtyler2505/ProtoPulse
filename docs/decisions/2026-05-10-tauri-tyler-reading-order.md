# Tauri v2 Migration — Tyler Reading Order

**Date:** 2026-05-10
**Purpose:** 5 rounds of bidirectional iteration between Claude and Codex landed 14 docs (3 ADRs, 6 audits, 1 plan-doc, 3 critique/response docs, 1 preflight script + Phase 1 prompt pack). This doc tells Tyler what to read first, second, third — and what 3 decisions unblock the most work.

## TL;DR

- **The plan exists.** `docs/plans/2026-05-10-tauri-v2-desktop-migration.md` (39 KB) — 12 phases, TDD task breakdowns, file-ownership matrices, source URLs.
- **The plan is ready to execute** as soon as Tyler ratifies 3 decisions: **Q3 (project container), Q5 (Windows signing), Q6 (macOS distribution)**.
- **Defaults exist for all 9 questions.** Tyler can ratify-as-proposed and Phase 1 starts immediately. The defaults are documented with reversibility per question.
- **Phase 1 is wired**: `scripts/tauri-preflight.sh` validates the environment, `docs/plans/2026-05-10-tauri-v2-phase1-prompt-pack.md` is the ready-to-paste agent-teams dispatch.

## Read in this order

### Tier 1 — Decisions only (reading time: ~10 min)

1. **`docs/decisions/2026-05-10-tauri-tyler-decisions-needed.md`** — 9 questions, each with proposed default + reversibility + blocking? + blast-radius (where flagged). **This is the action doc.** Ratify each question (accept default OR propose alternative).

That's enough to unblock execution. Everything below is "if you want to verify the rationale."

### Tier 2 — The 3 ADRs (reading time: ~20 min)

2. **`docs/decisions/2026-05-10-adr-tauri-runtime-topology.md`** — why Path C (hybrid). Cites server endpoint count, scaffold drift, capability docs.
3. **`docs/decisions/2026-05-10-adr-release-trust-model.md`** — Azure Artifact Signing > EV (2024 SmartScreen behavior change), Developer ID + notarization for macOS, no-updater-yet, deb+AppImage initial Linux.
4. **`docs/decisions/2026-05-10-tauri-ipc-contract.md`** — current IPC mismatches table (3 broken commands + 2 dead Rust commands + spawn_process RCE) + drift-test spec. **Has a supersession note at top** because the plan-doc replaced manual rename with `tauri-specta` auto-binding generation.

### Tier 3 — The plan-doc (reading time: ~30 min)

5. **`docs/plans/2026-05-10-tauri-v2-desktop-migration.md`** — 12-phase implementation plan. Read Tech Stack section + Phase 1 + Phase 2; skim Phases 3-12 (each phase is independently scoped).

### Tier 4 — Audit evidence (reading time: ~30 min, optional)

6. **`docs/audits/2026-05-09-tauri-v2-migration-phase0-findings.md`** — initial drift inventory (Claude).
7. **`docs/audits/2026-05-09-tauri-v2-migration-phase0-codex-verify.md`** — Codex Round 1 verification + critique.
8. **`docs/audits/2026-05-09-tauri-v2-migration-phase1-claude-verify.md`** — Claude independent verification of Codex findings + Context7 fills.
9. **`docs/audits/2026-05-09-tauri-v2-migration-phase1-storage-and-runtime-audit.md`** — 8-bucket localStorage classification + dist/index.cjs missing finding.
10. **`docs/audits/2026-05-09-tauri-v2-migration-r2-deep-research.md`** — 12 NLM deep-research topics (auto-updater, Win/macOS signing, Node sidecar, CI matrix, file associations, multi-window, deep-link, telemetry, capability scoping, Linux distribution, supply chain).
11. **`docs/audits/2026-05-09-tauri-v2-migration-r2-revised-phasing.md`** — Codex Round 2 revised 12-phase order.
12. **`docs/audits/2026-05-10-tauri-v2-claude-context7-research-feed.md`** — Claude's Context7 research feed (tauri-specta, fs:scope patterns, log + process plugin setup).
13. **`docs/audits/2026-05-10-tauri-v2-express-route-path-c-classification.md`** — Claude's bucket classification of all 211 Express endpoints by Path C migration intent.
14. **`CODEX_RESPONSE_TAURI_R4_SELFCRITIQUE.md`** — Codex's adversarial pass on its own plan-doc (file-ownership collisions, TDD reality, rollback per phase).

### Tier 5 — Execution-ready artifacts

15. **`scripts/tauri-preflight.sh`** — fail-fast environment validator (run before Phase 1).
16. **`docs/plans/2026-05-10-tauri-v2-phase1-prompt-pack.md`** — 5 ready-to-paste `/agent-teams` prompts for Phase 1 (build-contract, bridge-routing, ipc-bindings + frontend refactor + drift test).

## The 3 Highest-Impact Decisions (rank-ordered by blast radius)

If Tyler reads only one doc, it's Tier 1 (the decision-needed list). Within that doc, three questions unblock the most:

### Q3 — Project Container (61% of endpoints blocked)

What durable shape do project files take?

- **Proposed default:** mixed project-folder layout (manifest + versioned data + artifacts under a folder).
- **Affects:** 23 route modules / 129 endpoints (Bucket 3 in the Path C classification audit).
- **Why it matters:** every Bucket 3 endpoint migrates to native FS / SQLite / mixed based on this answer. If the answer differs from the proposed default, every Phase 3 sub-task reshape.
- **Quick alternatives:** single `.protopulse` archive (opaque but portable), SQLite (queryable, less inspectable), keep on Express (no migration, web-app-with-shell).

### Q5 — Windows Signing Path

How do we sign Windows binaries?

- **Proposed default:** dev-preview-only until Azure Artifact Signing eligibility confirmed; OV+HSM as fallback; never EV (Microsoft's 2024 change removed instant SmartScreen bypass).
- **Affects:** Phase 7 public Windows distribution (releases blocked).
- **Why it matters:** Windows users hit SmartScreen warnings on unsigned binaries; choice changes CI secrets architecture, signing latency, and cost.
- **Quick alternatives:** DigiCert/Sectigo OV cert ($200-500/yr, slower SmartScreen reputation), Azure Artifact Signing (cloud, eligibility-gated), unsigned forever (acceptable for hobbyist/dev distribution but blocks broader trust).

### Q6 — macOS Distribution Path

How do we ship macOS binaries?

- **Proposed default:** dev-preview-only (ad-hoc signed) until paid Apple Developer account confirmed; Developer ID + notarization required for public preview.
- **Affects:** Phase 7 public macOS distribution.
- **Why it matters:** macOS Gatekeeper blocks unsigned apps by default; Apple Developer Program is $99/yr + setup.
- **Quick alternatives:** Mac App Store (different sandbox rules, store policy), homebrew cask (community-maintained, no Apple cost but no notarization either).

## What happens after Tyler ratifies

If Tyler accepts all 9 defaults:

1. Phase 1 fires: 3 agents on `/agent-teams` (build-contract, bridge-routing, ipc-bindings) using the prompt pack. ~2-4 days work.
2. After Phase 1 closes, Phase 2 (native authority — `spawn_process` removal, capability narrowing, CSP hardening). ~1-2 days.
3. Phase 3 begins (storage migration per Q3 default). Largest single phase — likely 2-4 weeks given the 23-module scope.

If Tyler differs on any decision:
- For Q1, Q2, Q4, Q7, Q8, Q9: planning-time impact only. Plan-doc updates, no Phase 1 stall.
- For Q3: Phase 3 task breakdowns get re-shaped. Phase 1 still proceeds.
- For Q5, Q6: Phase 7 architecture changes. Phase 1-6 unaffected.

## What ISN'T in scope (deferred to future rounds)

- Implementation. No `src-tauri/` code edits in any of the 5 rounds — all docs/decisions/audits.
- Backlog wiring. The Tauri migration isn't yet a `BL-XXXX` line in `docs/MASTER_BACKLOG.md`. R6 candidate: add it as an epic.
- Notebook integration. Plan-doc not yet added as a pp-core source. Future round.
- Phases 2-12 prompt packs. Only Phase 1 has the agent-teams ready-pack.

## Round count summary

| Round | Output | Wall-clock |
|---|---|---|
| Phase 0 (Claude) | Initial drift inventory | ~30 min |
| Round 1 (Codex) | Adversarial verification + critique | ~25 min |
| Round 2 (Codex) | Self-critique + 12 NLM deep researches + revised phasing | ~100 min |
| Round 3 (Codex) | 3 ADRs (topology, IPC, trust) + plan-doc | ~22 min |
| Round 4 (Codex) | Plan-doc integration (tauri-specta + fs:scope + log/process/updater) + self-critique | ~22 min |
| Round 5 (Codex) | Preflight script + Phase 1 prompt pack + decision-list + supersession note | ~18 min |
| Claude parallel | Phase 1 verification audits + storage classification + Context7 research feed + Path C route classification + reading-order doc | ongoing |

Total: 14 documents, 1 executable script, ~3 hours of agent wall-clock + parallel Claude work.

## Source URL Index (for verification)

All ADR/audit/plan source URLs are catalogued in their respective docs. Key Tauri v2 references used:

- https://v2.tauri.app/security/capabilities/
- https://v2.tauri.app/develop/sidecar/
- https://v2.tauri.app/plugin/updater/
- https://v2.tauri.app/plugin/file-system/
- https://v2.tauri.app/security/scope/
- https://v2.tauri.app/plugin/process/
- https://v2.tauri.app/plugin/logging/
- https://v2.tauri.app/distribute/sign/windows/
- https://v2.tauri.app/distribute/sign/macos/
- https://v2.tauri.app/distribute/pipelines/github/
- https://github.com/specta-rs/tauri-specta
