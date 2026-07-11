---
title: Omni-Evaluation — ProtoPulse
date: 2026-07-01
mode: systematic multi-lens discovery + adversarial triage (read-only)
trigger: Tyler — "an all encompassing, super deep, super expansive, systematic evaluation... anything and everything"
---

# Omni-Evaluation: ProtoPulse

> Read-only discovery + verification campaign. Modifies no application code — its sole output is
> **BL-0909→BL-1092** (184 backlog items) in `docs/MASTER_BACKLOG.md` and this report. Companion
> finding to **BL-0908** (the campaign's `/bl recount` tooling exposed a months-old Quick Stats
> drift on the *pre-existing* ledger — see that item; unrelated to this wave's own integrity).

## Method

A 4-phase campaign, engineered for **evidence over volume** and **dedup before ship**:

1. **Discovery — 13 independent lenses, parallel.** Each lens searched the codebase a genuinely
   different way so coverage didn't collapse into repeats: competitive gaps vs. core EDA tools
   (KiCad/Altium/EasyEDA) and vs. web/maker tools (Wokwi/Flux/Falstad/Tinkercad/EveryCircuit),
   code health (legacy and engine separately), vision-vs-ROADMAP drift, EDA domain correctness,
   AI-crew capability gaps, security/robustness, hardware/parts breadth, static accessibility,
   docs/onboarding, moonshots/differentiators, and meta-layer (dev tooling/CI). A **completeness
   critic** then read all 13 lenses' output and named 5 genuinely missed angles — offline/PWA,
   backup/disaster-recovery, large-design performance, licensing/legal, and `.ppx`
   schema-versioning — which ran as a second round. **168 + 23 = 191 raw findings.**
2. **Dedup — clustering + adjudication.** A document-frequency-weighted keyword-overlap heuristic
   (generic EDA vocabulary like "engine"/"view"/"board" excluded from the match signal, a
   clique-check preventing transitive chain-merging into false blobs) proposed 15 candidate
   near-duplicate clusters. A dedicated adjudication pass read each cluster and decided
   MERGE/SPLIT/PARTIAL on its own judgment — 6 genuine merges (independent lenses converging on
   the same real gap, evidence combined), 9 correctly rejected as superficial keyword coincidences
   (e.g. "hardcoded"/"dead" pairing an Express trust-proxy bug with an unrelated breadboard wire
   field). **191 → 185 canonical findings.**
3. **Adversarial triage — 8 parallel batches.** Every canonical finding went through: (a) a
   backlog-duplicate check — self-flagged candidates verified against the real
   `docs/MASTER_BACKLOG.md` row, unflagged findings sanity-grepped anyway; (b) an evidence
   spot-check — the primary file:line citation read/grepped to confirm it exists and isn't
   fabricated; (c) a value judgment — reject anything not concretely actionable. **184 confirmed,
   1 rejected** (a WCAG finding whose own evidence conceded it wasn't actually a violation).
4. **Synthesis.** Confirmed findings assigned sequential `BL-09xx`/`BL-10xx` ids, grouped by
   priority then theme, formatted to house table style, spliced into `MASTER_BACKLOG.md`, and
   Quick Stats regenerated via `.claude/skills/bl/scripts/recount.py` (not hand-arithmetic).

**What this is not:** a live-UX driving pass (Phase 1b, deferred — the app wasn't run in a
browser this wave; findings here are static-analysis + doc-cross-reference only) or an
implementation pass — per standing policy, findings are *documented*, not auto-built.

## Headline numbers

| | Count |
|---|---|
| Raw findings (13 lenses + 5 gap-round) | 191 |
| After merge-dedup | 185 |
| Confirmed (evidence-checked, valuable, non-duplicate) | **184** |
| Rejected | 1 |
| New backlog items | **BL-0909 → BL-1092** |
| — P1 (High) | 30 |
| — P2 (Medium) | 121 |
| — P3 (Low) | 33 |
| — P0 (Critical) | **0** — no security/crash/data-loss finding survived triage at that bar |

## What the campaign actually found (by theme, most consequential first)

**The engine's "board fab set" isn't fab-ready.** `@protopulse/export`'s Gerber emits copper +
edge + drill only — no soldermask, paste, or silkscreen layers, and the footprint schema can't
even derive them (BL-0909). Combined with a hard 2-copper-layer ceiling with an unused `span`
field already in the op schema (BL-0910-adjacent), any real 4-layer or professionally-fabbed
board hits a wall the moment it leaves the schematic.

**The AI crew is additive-only.** No persona can remove a component, disconnect a wire, change a
value, or delete a bus/sheet (BL-0914) — every op exists in `@protopulse/graph`, but Draftsman's
8 tools are all creation/append-only. "Change R7 to 2.2k" — probably the single most common
real editing request — is structurally impossible for the crew today.

**Two of the vision's four canonical views don't exist in the engine.** Breadboard and
Architecture have zero `packages/app` presence and zero ROADMAP entry (BL-0910) — including
ProtoPulse's own flagship differentiator, Breadboard Lab. The migration milestone's own
retirement criteria can't be met while this gap stands.

**Dead code is large enough to matter operationally, not just aesthetically.** ~99k of 226,904
legacy `client/src/lib` lines (44%) have zero runtime importers, including a complete 9,612-line
advanced PCB-routing subsystem (maze router, push-shove engine, panelization) that nothing in the
live app calls. Their companion test suites are part of why `npm test` needs ~8GB and gets
SIGKILLed by `earlyoom` on this box (BL-0917-class) — this is the rare debt finding that's also a
DX fix.

**`packages/relay` (the sync/collab substrate) has no per-room authorization and no memory
ceiling** — a single optional global token gates every room, and nothing bounds total rooms or
per-room op-log growth on a box already known for OOM kills. Currently dev/localhost-scoped, but
the roadmap is actively building toward non-localhost deployment.

**The `.ppx` format has a version field with zero migration code behind it.** `PPX_FORMAT_VERSION`
is stamped on every write and read by nothing; the op-body schema is a fully closed
discriminated union with no unknown-kind passthrough. The moment the op vocabulary changes,
every existing save file becomes unparseable with no bridge — and browser autosave already
silently discards on any bundle-shape mismatch today, independent of any future version bump.

**Competitive-differentiator work is 90% built and 0% shipped in three places:** `Graph.diff()` +
`Review.diffReports()` exist but nothing wires them into a "request review" flow (the
GitHub-for-hardware pitch); the emulation campaign's own test infrastructure has no CLI wrapper
(`protopulse run-firmware`) despite Wokwi selling exactly that as a paid tier; and the from-scratch
open-source ESP32-S3 core — genuinely rare, no open TS equivalent exists on npm — ships
`"private": true`.

**CI has real, unwired safety machinery.** An npm-audit policy script exists and isn't in any
workflow (BL-0907 has no automated backstop for its own allowlist expiry); 15 Playwright e2e/a11y
spec files exist and never run in CI; a vault-architecture-conformance guard script exists and
isn't wired; `check:packages` is a single flat 16-package `tsc` invocation that is the
*documented* root cause of the box's chronic false-negative typecheck OOM trap.

**Two independent, non-interoperating "offline sync" systems coexist** in the legacy client — one
a real IndexedDB queue nothing calls, one a fake `pwa-manager.ts` implementation that literally
comments "in a real implementation this would POST to the server." Whoever picks up offline work
next needs this documented before touching either.

## Confirmed real gaps in the audit itself (own the caveats)

- **Phase 1b (live UX driving pass) deferred.** Every finding here is static analysis + doc
  cross-reference; nothing in this wave clicked through the running app. That's a distinct,
  still-valuable follow-up campaign.
- **P0 = 0 is a real signal, not a miss.** Triage agents were explicitly instructed not to
  inflate priority, and none did — the genuinely severe items (relay auth, `/api/admin/restore`
  SQL execution, trust-proxy hardcoding) landed at P1, correctly reflecting that they're
  exploitable-in-principle but not yet live-crash/live-breach conditions on the current
  dev/localhost-scoped deployment topology.
- **Theme grouping is the synthesis script's judgment call, not a re-verification.** Individual
  item priority/complexity/evidence was set by the triage batch that confirmed it; the thematic
  section headers are organizational only.

## Next

- **BL-0908** (pre-existing ledger reconciliation) is unrelated to this wave and remains open —
  do not conflate the two while working the backlog.
- A natural Phase 1b (live app driving, browser-based UX hunt) and Phase 3 (a second campaign
  pass once the highest-leverage P1 items land, to catch what changed) are both reasonable
  follow-ups but out of scope for this report.
