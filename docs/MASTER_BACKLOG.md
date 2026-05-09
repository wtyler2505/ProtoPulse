# ProtoPulse Master Backlog

> **Single source of truth** for tracked ProtoPulse work: bugs, security fixes, features, tech debt, UX polish, parity gaps, and moonshots.
> Consolidated 2026-03-07 from source documents listed in the [Source Document Map](#source-document-map).
> This file intentionally preserves both open and completed items so priority, provenance, and completion history stay searchable in one place.

## Fast Navigation

- [How to Use This Document](#how-to-use-this-document)
- [Backlog Conventions](#backlog-conventions)
- [Planning Index](#planning-index)
- [Backlog Health](#backlog-health)
- [Change Log](#change-log)
- [C5 Preplanning Artifacts](#c5-preplanning-artifacts)
- [Recently Completed](#recently-completed)
- [Next Up](#next-up-proposed-top-10-actionable-items)
- [Complexity Radar](#complexity-radar-highest-complexity-open-items)
- [Active Waves](#active-waves-current-planning-snapshot)
- [Wave Candidates](#wave-candidates-proposed-bundles)
- [Complex Work / Epics](#complex-work--epics)
- [Discovery / Spikes](#discovery--spikes)
- [Blocked / Waiting On](#blocked--waiting-on)
- [Cross-Cutting Work](#cross-cutting-work)
- [Decision Needed](#decision-needed)
- [Architecture / ADR Required](#architecture--adr-required)
- [Definition of Ready](#definition-of-ready)
- [Definition of Done](#definition-of-done)
- [Complexity Scale](#complexity-scale)
- [Planning Fields](#planning-fields-for-new-and-updated-items)
- [Test / Verification Notes](#test--verification-notes)
- [How to Add a New Item](#how-to-add-a-new-item)
- [Quick Stats](#quick-stats)
- [P0 — Critical](#p0--critical-security--crashes--data-loss)
- [P1 — High](#p1--high-broken-workflows--major-ux--test-gaps)
- [P2 — Medium](#p2--medium-feature-gaps--polish)
- [P3 — Low](#p3--low-nice-to-have--long-term-vision)
- [Completed Work Summary](#completed-work-summary)
- [Source Document Map](#source-document-map)

## How to Use This Document

- **Pick from the top.** Items are grouped by priority (P0 → P3) then by domain.
- **IDs are stable.** Each item has a `BL-XXXX` ID. Reference these in commits, PRs, wave notes, and follow-up docs.
- **Cross-refs** show the original ID from the source doc (MF-xxx, UX-xxx, IFX-xxx, ARDX-xxx, etc.) for traceability.
- **Open and done work both stay here.** Do not remove items just because they are completed; update status instead so historical context remains searchable.
- **When you finish an item**, change its status to `DONE` and add the Wave plus commit/PR reference when available.

## Backlog Conventions

- **`OPEN`** = not started.
- **`PARTIAL`** = some implementation exists, but the user-visible workflow or acceptance criteria are not complete.
- **`BLOCKED`** = waiting on a prerequisite, dependency, or external decision.
- **`DONE`** = implemented. Add the Wave number and any verification detail available.
- **`DONE (verified Wave N)`** = implemented earlier and explicitly re-checked in that wave.
- **Preservation rule:** unless Tyler explicitly approves pruning or archival, keep every tracked item in this document and prefer notes/cross-links over deletion.
- **Update discipline:** when Quick Stats or the latest Wave changes, update both the top snapshot and the footer note in the same edit so they do not drift.

## Planning Index

- [Backlog Health](#backlog-health)
- [C5 Preplanning Artifacts](#c5-preplanning-artifacts)
- [Recently Completed](#recently-completed)
- [Next Up (Proposed Top 10 Actionable Items)](#next-up-proposed-top-10-actionable-items)
- [Complexity Radar (Highest-Complexity Open Items)](#complexity-radar-highest-complexity-open-items)
- [Active Waves (Current Planning Snapshot)](#active-waves-current-planning-snapshot)
- [Wave Candidates (Proposed Bundles)](#wave-candidates-proposed-bundles)
- [Complex Work / Epics](#complex-work--epics)
- [Discovery / Spikes](#discovery--spikes)
- [Blocked / Waiting On](#blocked--waiting-on)
- [Cross-Cutting Work](#cross-cutting-work)
- [Decision Needed](#decision-needed)
- [Architecture / ADR Required](#architecture--adr-required)
- [Definition of Ready](#definition-of-ready)
- [Definition of Done](#definition-of-done)
- [Complexity Scale](#complexity-scale)
- [Planning Fields for New and Updated Items](#planning-fields-for-new-and-updated-items)
- [Test / Verification Notes](#test--verification-notes)
- [How to Add a New Item](#how-to-add-a-new-item)

## Backlog Health

| Signal | Current State | Notes |
|--------|---------------|-------|
| Tracked scope | High | 508 total items across delivery work, parity gaps, audits, and long-term vision. |
| Duplicate risk | Medium-High | Consolidated from multiple source docs and competitive audits; cross-tool items likely overlap unless regularly merged. |
| Explicitly blocked items | 0 | `BL-0524` unblocked by Wave 67 (BL-0486 already DONE) and closed Wave 152; firmware/debugger/platform blockers resolved by Pure-Local Desktop App pivot (ADR 0007/0008). |
| Epic decomposition need | High | Several initiatives are too large to execute safely as single rows and need parent/child planning. |
| Acceptance/verification metadata | Medium-High gap | Many older `OPEN` items still lack explicit acceptance criteria, effort, confidence, or verification notes. |
| Complexity scoring coverage | High | All 508 detailed backlog rows plus epics, wave candidates, and `Next Up` now have a first-pass `C1`-`C5` score. |
| Stats freshness risk | Medium | Manual counts were resynced during the complexity pass, but the snapshot is still hand-maintained and should eventually be generated. |

## Change Log

- **2026-04-18:** Wave 153 — closed `BL-0126` (Shared unit/scale contract across sim + DRC engines). Verified Phase 2 wiring had already landed across the codebase: `shared/drc-engine.ts` imports `Length_mil` from `./units` (5 references); `client/src/lib/board-stackup.ts` consumes branded `Length_mil` from `@shared/units`; sim↔DRC boundary `client/src/lib/simulation/pcb-geometry-bridge.ts` imports `milToMm`/`mmToMeter` from `@shared/units`; simulation suite (`spice-netlist-parser`, `spice-generator`, `design-var-spice-bridge`, `thermal-analysis`) all import canonical helpers from `@shared/units`. Both engines structurally consume the single canonical module — parity is implicit. No new code required — the backlog note was stale; Phase 2 lived in the codebase already. P2 open count: 1 → 0. Backlog fully DONE (508/508).
- **2026-04-17:** Wave 152 — closed `BL-0524` (Conflict resolution UI). BL-0486 (CRDT conflict resolution algorithm) had landed in Wave 67 but the losing-op UX was never surfaced — server silently dropped LWW-losers, insert-superseded, and delete-rejected operations. Added `detectConflict()` + `Conflict` + `ConflictKind` types in `shared/collaboration.ts` (9 new tests), instrumented `server/collaboration.ts#mergeAndBroadcastOps` to emit a server→loser `conflict-detected` WS message with the losing op + the authoritative winning op (no dedicated REST resolve route — "accept mine" re-uses the existing `state-update` path with a fresh Lamport timestamp). Extended `CollaborationClient` with `pendingConflicts`/`resolveConflict`/`conflicts-change` event + `dismissConflict` (4 new client tests). New `client/src/components/collaboration/ConflictResolutionDialog.tsx` shadcn Dialog with side-by-side yours/theirs panels, editable merge textarea, per-conflict paging, and Accept-mine / Accept-theirs / Save-custom-merge buttons (5 UI tests). Wired into `ShareProjectButton` as an amber conflict-count badge with `Alt+K` shortcut and auto-open on first conflict. Lock enforcement from BL-0487 untouched (17 integration tests still green, 23 CRDT + 44 auth + 50 collab server tests pass). P2 open count: 2 → 1; BLOCKED count: 1 → 0.
- **2026-04-17:** Wave 151 — closed `BL-0150` (Inventory tracking tied to BOM consumption). Added pure `computeShortfall()` + `BomShortfall` type in `shared/parts/shortfall.ts` (canonical rule: `max(0, quantityNeeded - coalesce(quantityOnHand, 0))` — supply is never decremented on BOM writes to prevent double-booking). New `BomStorage.getShortfalls(projectId)` with SQL filter `needed > coalesce(onHand, 0)` and shortfall-DESC ordering. New route `GET /api/projects/:id/bom/shortfalls` returning `{ data, total, totalShortfallUnits }`. Client hook `useBomShortfalls` + `indexShortfallsByPartNumber` helper. Red "−N" shortfall badge (with `PackageX` icon) in `BomTable` stock cell, tooltip showing `BOM wants N / on hand M`. Export precheck `bomShortfallCheck` added to `fab-package`, `pick-place`, `bom-csv` runners as a non-blocking warning. Tests: 11 shared shortfall tests (boundary/null/NaN), 4 hook tests (indexing/query key), 3 endpoint shape tests, plus `getShortfalls` mock wired into `api.test.ts`. P2 open count: 3 → 2.
- **2026-04-14:** Wave 150 — closed `BL-0473` (MPN normalization and dedup in BOM). Added `shared/parts/mpn.ts` normalizer (trim, whitespace collapse, packaging-suffix strip for `/NOPB`, `#PBF`, `-TR*`, `-7`, `+`) with case-preserving + case-insensitive comparison helpers. Wired into `server/parts-ingress.ts findByMpn()` and `server/storage/parts.ts PartsStorage.getByMpn()` — case-insensitive `ilike` match plus manufacturer-scoped comparison-key fallback so `RC0402FR-0710KL`, `rc0402fr-0710kl`, and `LM317T/NOPB ≡ LM317T` all dedup. Stock upsert at existing `(projectId, partId)` already bumps quantity instead of duplicating — now reached reliably. Tests: 37 unit tests for the normalizer + 6 regression tests for ingress dedup (case variant, whitespace variant, stock-qty bump, suffix fallback, genuinely different MPN, empty-manufacturer skip). P2 open count: 4 → 3.
- **2026-04-14:** Refreshed `Next Up` — all 10 prior candidates were already DONE (verified Wave 106 / 107). Replaced the stale table with the 3 remaining `PARTIAL` P2 items (`BL-0126`, `BL-0150`, `BL-0473`); `BL-0524` remains `BLOCKED on BL-0486` and is excluded. Recounted Quick Stats directly from P0–P3 sections (508 rows total: 4 open, 504 done) and removed the outdated "BACKLOG COMPLETE" note.
- **2026-03-13:** Wave 80 — marked 5 P0 security items DONE (BL-0636/0637/0638/0639/0642). Updated blockers, decisions, ADR requirements, and discovery spikes as resolved by Pure-Local Desktop App pivot (ADR 0007/0008). Firmware/debugger/platform items now unblocked.
- **2026-03-13:** Added 15 missing backlog items from a repo-wide gap audit, covering authz/tenant-scoping gaps, RAG durability, async job execution, supplier realism, Kanban persistence, Circuit Code materialization, generative candidate adoption, and other cross-tool integration misses.
- **2026-03-13:** Added durable preplanning artifacts for the two biggest near-term C5 programs: firmware runtime/debugger and collaboration foundation/RBAC/branching.
- **2026-03-13:** Backfilled `C1`-`C5` complexity across all 493 tracked backlog rows, expanded the complexity radar to the top 25 open items, scored epics and wave candidates, and corrected manual snapshot drift at the top of the file.
- **2026-03-13:** Added a planning layer at the top of the backlog: health, recent wins, next-up queue, wave candidates, epics, discovery spikes, blocker tracking, decision points, planning fields, and item templates.
- **2026-03-13:** Clarified preservation rules, status semantics, and snapshot maintenance guidance; aligned the top snapshot and footer note with the Wave 76 state.

## C5 Preplanning Artifacts

| Cluster | Related IDs | Artifact | Purpose |
|---------|-------------|----------|---------|
| Firmware runtime, simulation, and debugger | `BL-0631`, `BL-0632`, `BL-0635`, `BL-0461` | `docs/plans/2026-03-13-c5-firmware-runtime-program.md` | Rewritten for pure-local native desktop app architecture (ADR 0007). Native process spawning replaces browser-sandbox workarounds. Firmware items now unblocked. |
| Collaboration foundation, RBAC, branching, and merge | `BL-0381`, `BL-0184`, `BL-0185` | `docs/plans/2026-03-13-c5-collaboration-foundation-program.md` | Sequences session hardening, project membership, review/approval, branching, merge, and later org/team tenancy so nothing gets built on the current owner-only shortcut. |

## Recently Completed

| Wave | Notable Completions | Why It Matters |
|------|----------------------|----------------|
| 153 | `BL-0126` | Shared unit/scale contract across simulation + DRC engines — canonical `shared/units.ts` branded length types (`Length_mil`/`Length_mm`/`Length_meter`/`Length_inch`) + SI/SPICE parsers consumed by DRC engine, board-stackup, sim↔DRC bridge, and full SPICE/thermal simulation suite. Closes the last open backlog item (508/508). |
| 152 | `BL-0524` | Conflict resolution UI — side-by-side yours/theirs CRDT merge dialog with accept-mine / accept-theirs / custom-merge controls. Removes the last explicitly BLOCKED item from the backlog; closes the Wave 67 collaboration foundation. |
| 151 | `BL-0150` | Inventory tracking tied to BOM consumption — shared shortfall contract, shortfall-first BOM badge, export-precheck warning. |
| 121 | `BL-0409`, `BL-0411`, `BL-0417`, `BL-0421` | AI sketch starter, board-aware suggestions, state machine skeletons, sketch explainer — Arduino intelligence. |
| 120 | `BL-0407`, `BL-0410`, `BL-0442` | Firmware snapshots, smart code snippets, build journals — firmware safety + developer experience. |
| 119 | `BL-0405`, `BL-0414`, `BL-0415`, `BL-0419`, `BL-0425` | Board package checker, RAM early warning, flash budget, library conflicts, secrets scanner — Arduino firmware safety. |
| 118 | `BL-0400`, `BL-0439`, `BL-0444`, `BL-0445` | Arduino IDE launcher, community template packs, smart reminders, creator profiles — Arduino + community + guidance. |
| 117 | `BL-0378`, `BL-0390`, `BL-0392`, `BL-0402`, `BL-0384` | API docs generator, interaction history, quick jump search, build status, team command center — DevOps + navigation + collaboration. |
| 116 | `BL-0355`, `BL-0372`, `BL-0373`, `BL-0383`, `BL-0382` | Design system docs, macro recorder, keybinding editor, workspace presets, audit log explorer — extensibility + customization. |
| 115 | `BL-0364`, `BL-0351`, `BL-0346`, `BL-0347`, `BL-0361` | Slow path detector, design tokens, mobile capture, responsive presets, panel loading — performance + mobile + design system. |
| 114 | `BL-0350`, `BL-0353`, `BL-0354`, `BL-0362`, `BL-0363` | Icon language, motion language, state illustrations, background prefetch, progressive render — design system + performance. |
| 113 | `BL-0265`, `BL-0343`, `BL-0345`, `BL-0344`, `BL-0340` | CI coverage gates, mobile review mode, gesture shortcuts, bottom nav, tablet layout — CI + mobile + responsive. |
| 112 | `BL-0149`, `BL-0328`, `BL-0264`, `BL-0341`, `BL-0342` | Multi-angle photo, a11y audit dashboard, deployment profiles, touch-safe controls, mobile table overflow — accessibility + mobile + DevOps. |
| 111 | `BL-0320`, `BL-0321`, `BL-0326`, `BL-0301`, `BL-0188` | Keyboard resize handles, focus ring audit, screen reader canvas labels, first PCB tutorial, team templates — accessibility + onboarding. |
| 110 | `BL-0148`, `BL-0528`, `BL-0474`, `BL-0314`, `BL-0329` | Web Serial integration tests, PCB order tracking, AVL enforcement, progress milestones, font scaling — testing depth + procurement + onboarding + accessibility. |
| 109 | `BL-0526`, `BL-0475`, `BL-0238`, `BL-0472`, `BL-0220` | WebSocket session revalidation, assembly risk scoring, supplier comparison engine, order history, import diff engine — security + procurement depth + design comparison. |
| 108 | `BL-0470`, `BL-0572`, `BL-0239`, `BL-0313`, `BL-0324` | Manufacturing package validator, DFM→PCB highlight bridge, SMT/THT/manual assembly grouping, per-view onboarding hints, contrast audit — manufacturing trust + onboarding + accessibility. |
| 107 | `BL-0275`, `BL-0579`, `BL-0272`, `BL-0469`, `BL-0254` | GPU blur optimization, export design snapshots, telemetry→digital twin wiring, pick-and-place validation, release readiness scorecard — performance + manufacturing trust + system integration. |
| 106 | Backlog reconciliation | 65 items verified DONE (Waves 88-104 retroactive). P2 went from 142→72 open. |
| 105 | `BL-0217`, `BL-0215`, `BL-0240`, `BL-0536`, `BL-0219` | Export results panel, import mapping warnings, lifecycle badges on BOM cards, tutorial step navigation, import history — export/import UX + procurement trust + onboarding flow. |
| 87 | `BL-0593`, `BL-0628`, `BL-0147`, `BL-0163`, `BL-0231` | Bendable breadboard legs, Arduino example library, flash diagnostics, AI testbench tools, radial menu — maker UX + firmware feedback loop. |
| 86 | `BL-0627`, `BL-0629`, `BL-0523`, `BL-0152`, Electron shell | Starter circuits, etchable PCB export, DFM AI tools, pin constants, native desktop app foundation. |
| 80 | `BL-0636`, `BL-0637`, `BL-0638`, `BL-0639`, `BL-0642` | 5 P0 IDOR/auth vulnerabilities fixed — AI chat ownership, AI action scoping, circuit API tenant-scoping, project↔resource consistency, batch analysis authz. All P0 items now resolved. |
| 79 | `BL-0515`, `BL-0516`, `BL-0599`, `BL-0600`, `BL-0560` | Board settings dialog, CLI error parsing (35 hints), memory usage display, error line linking, simulation results overlay — Arduino compile feedback loop + simulation visibility. |
| 78 | `BL-0494`, `BL-0503`, `BL-0566`, `BL-0521`, `BL-0598` | Wire drag-rerouting, PCB copy/paste, validation→PCB navigation, AI action error tracking, baud rate selector — editor trust + workflow gaps closed. |
| 77 | `BL-0513`, `BL-0514`, `BL-0128`, `BL-0141`, `BL-0153` | SPICE transmission line, simulation complexity guardrails, EveryCircuit-style current animation, protocol decoders, serial plotter — simulation usability + hardware feedback loop. |
| 76 | `BL-0491`, `BL-0122`, `BL-0123`, `BL-0511`, `BL-0512` | Closed bus-mapping, simulation-analysis, and SPICE-model gaps that unlock more advanced design work. |
| 75 | `BL-0505`, `BL-0509`, `BL-0510`, `BL-0120`, `BL-0129` | Strengthened PCB routing intelligence and simulation scenario depth. |
| 74 | `BL-0594`, `BL-0498`, `BL-0501`, `BL-0502`, `BL-0125` | Improved breadboard realism, schematic→BOM linkage, and PCB analysis overlays. |
| 73 | `BL-0595`, `BL-0124`, `BL-0508`, `BL-0623`, `BL-0626` | Added richer simulation tooling and PCB manufacturability checks. |
| 72 | `BL-0596`, `BL-0495`, `BL-0504`, `BL-0507`, `BL-0625` | Improved editing performance, DRC depth, and the simulation instrument bench. |

## Next Up (Proposed Top 10 Actionable Items)

> **2026-04-18:** **BACKLOG FULLY DONE (508/508).** `BL-0126` closed in Wave 153 — Phase 2 wiring was already shipped across the codebase; the backlog note was stale. No remaining open or BLOCKED items. Next planning cycle should seed new work from epics, the competitive-audit pipeline, or the Breadboard Lab audit findings rather than from this table.

| Rank | ID | Why Next | Effort | Complexity | User Impact |
|------|----|----------|--------|------------|-------------|
| ~~1~~ | ~~`BL-0150`~~ | ~~Inventory tracking tied to BOM consumption~~ — **CLOSED Wave 151** (see Change Log). | — | — | — |
| ~~1~~ | ~~`BL-0126`~~ | ~~Shared unit/scale contract across sim + DRC engines~~ — **CLOSED Wave 153** (see Change Log). | — | — | — |
| ~~1~~ | ~~`BL-0473`~~ | ~~MPN normalization and dedup in BOM~~ — **CLOSED Wave 150** (see Change Log). | — | — | — |

## Complexity Radar (Highest-Complexity Open Items)

Use this section to call out the largest open work by architectural scope and dependency load, not just calendar effort. This is the “if we start this, we are really starting a program of work” list. The top 25 below are the current first-pass highest-complexity open items.

| Rank | ID | Complexity | Work | Why It Is Hard |
|------|----|------------|------|----------------|
| 1 | `BL-0635` | `C5` | Arduino code simulation in the browser | Compile + execute + MCU simulation + serial + pin-state visualization + sensor input plumbing is effectively a new platform inside ProtoPulse. |
| 2 | `BL-0632` | `C5` | Hardware debugger integration | Crosses browser limits, local-agent/security design, debug-probe support, GDB workflows, and serious embedded UX expectations. |
| 3 | `BL-0631` | `C5` | Simulator-based firmware execution | Introduces a new runtime layer and is also a prerequisite decision for several downstream simulation features. |
| 4 | `BL-0381` | `C5` | RBAC + org/team tenancy | System-wide infrastructure touching auth, ownership, collaboration, auditability, and future team-facing features. |
| 5 | `BL-0571` | `C5` | Shared schematic ↔ breadboard netlist | Fritzing-class dual-view coherence requires a shared source of truth across two editors that currently do not talk to each other. |
| 6 | `BL-0370` | `C5` | Public API + webhook platform | Opens a durable external contract surface with auth, rate limits, event design, versioning, and long-term compatibility burden. |
| 7 | `BL-0371` | `C5` | Plugin / extension SDK | Requires safe extension points, capability boundaries, lifecycle hooks, packaging, and a public support surface. |
| 8 | `BL-0451` | `C5` | Full circuit + firmware + enclosure co-design | Spans EDA, firmware, 3D/mechanical, workflow orchestration, and verification across several product domains. |
| 9 | `BL-0454` | `C5` | Multi-board system orchestrator | Needs system-level design coordination across multiple boards, firmware surfaces, and likely deployment/runtime choreography. |
| 10 | `BL-0464` | `C5` | Time machine playback | Requires synchronized playback of firmware state, logs, schematic state, and likely timeline-aware restoration semantics. |
| 11 | `BL-0467` | `C5` | Mission mode | Bundles concept-to-kit workflow orchestration into a single guided product surface spanning many existing systems. |
| 12 | `BL-0461` | `C5` | Firmware-aware simulation mode | Bridges firmware execution with circuit simulation and educational visual feedback rather than keeping them separate. |
| 13 | `BL-0613` | `C5` | Multi-platform board support | Expands the workbench from Arduino-only assumptions into a broader embedded platform model with much larger support burden. |
| 14 | `BL-0614` | `C5` | Custom board definitions | Requires board-schema design, editor UX, build integration, memory/clock modeling, and a route from PCB data into firmware tooling. |
| 15 | `BL-0184` | `C5` | Design branching model | Branch semantics affect review, restore, audit history, merge tooling, and nearly every serious collaboration workflow. |
| 16 | `BL-0185` | `C5` | Merge tooling for branch diffs | Depends on the branching model and has to reconcile complex design-domain conflicts, not just text lines. |
| 17 | `BL-0376` | `C5` | Git-native design diff / merge | Would expose the internal design representation as a durable mergeable artifact with strong correctness demands. |
| 18 | `BL-0450` | `C5` | Idea-to-ordered-PCB in 30 minutes | This is a whole product-program goal that depends on strong automation across design, validation, BOM, manufacturing, and guidance. |
| 19 | `BL-0457` | `C5` | Self-healing assistant with approval gates | Touches AI autonomy, trust, safety, approval workflows, and rollback/verification pathways across the app. |
| 20 | `BL-0465` | `C5` | Design-to-drive mode | Requires translating hardware design into runnable test firmware and bench behaviors, not just generating code stubs. |
| 21 | `BL-0466` | `C5` | AI co-debugging wiring + firmware | Needs shared reasoning across two failure domains that currently have different data models and verification loops. |
| 22 | `BL-0630` | `C5` | Scratch-like visual Arduino programming | A whole additional programming surface with bidirectional block↔text sync and strong beginner UX expectations. |
| 23 | `BL-0633` | `C5` | ESP-IDF framework support | Adds a second serious firmware ecosystem with different project structure, tooling, and runtime assumptions. |
| 24 | `BL-0561` | `C4` | PDN/SI reads actual PCB geometry | Requires real geometry extraction and stable contracts between routed board data and advanced analysis engines. |
| 25 | `BL-0555` | `C4` | SI Advisor + PDN deep integration | Couples advanced analysis engines, shared geometry/state, and correctness-sensitive expert workflows. |

## Active Waves (Current Planning Snapshot)

This document currently reflects completed work through **Wave 87**.

| Lane | Intent | Candidate IDs | Status |
|------|--------|---------------|--------|
| **Wave 79 — Arduino feedback + sim overlay** | Board settings, CLI parsing, memory display, error linking, sim results overlay. | `BL-0515`, `BL-0516`, `BL-0599`, `BL-0600`, `BL-0560` | **DONE** |
| **Wave 78 — Editor + trust** | Close highest-friction editor gaps + quick UX trust wins. | `BL-0494`, `BL-0503`, `BL-0566`, `BL-0521`, `BL-0598` | **DONE** |
| Simulation visibility (remaining) | Component state rendering + sim start button + sensor sliders. | `BL-0619`, `BL-0620`, `BL-0622` | Next up (BL-0560 done in Wave 79) |
| Integration-first cleanup | Reduce “same data lives in two places” pain across views. | `BL-0563`, `BL-0564`, `BL-0565`, `BL-0580` | Planned |

## Wave Candidates (Proposed Bundles)

| Wave | Theme | IDs | Status | Notes |
|------|-------|-----|--------|-------|
| Wave 77 (actual) | SPICE elements + sim UX + hardware tools | `BL-0513`, `BL-0514`, `BL-0128`, `BL-0141`, `BL-0153` | **DONE** | Transmission line, complexity warning, current animation, protocol decoders, serial plotter. |
| Wave 78 (done) | Editor loop closing + trust wins | `BL-0494`, `BL-0503`, `BL-0566`, `BL-0521`, `BL-0598` | **DONE** | Wire reroute, PCB copy/paste, validation→PCB nav, AI error tracking, baud selector. |
| Wave 79 (done) | Arduino compile feedback + sim overlay | `BL-0515`, `BL-0516`, `BL-0599`, `BL-0600`, `BL-0560` | **DONE** | Board settings, CLI error parsing, memory display, error line linking, sim results overlay. |
| Wave 80 (proposed) | Simulation visibility (remaining) + integration | `BL-0619`, `BL-0620`, `BL-0622`, `BL-0563`, `BL-0564` | Planned | Component state rendering, start button, sensor sliders, cross-tool linkage. |
| Wave 81 (proposed) | Manufacturing + BOM coherence | `BL-0564`, `BL-0565`, `BL-0580`, `BL-0586`, `BL-0530`, `BL-0531` | Planned | Use actual project data to drive fab-readiness. |
| Wave 80 | Manufacturing + BOM coherence | `BL-0564`, `BL-0565`, `BL-0580`, `BL-0586`, `BL-0530`, `BL-0531` | `C4` | Shared goal: use actual project data to drive fab-readiness instead of duplicate manual entry. |

## Complex Work / Epics

Use these epic summaries when a single backlog row is no longer enough to plan or communicate the work. Parent epics should stay concise and point to the detailed child backlog IDs that carry the implementation load.

### Epic A — Simulation UX & Firmware-Aware Prototyping

- **Goal:** Turn simulation into a first-class, visually immediate workflow that makers can run without expert setup.
- **Why it matters:** This is one of the clearest paths to matching the “instant gratification” value people get from TinkerCAD and EveryCircuit.
- **Complexity:** `C5` — New runtime and cross-domain simulation/firmware decisions.
- **Scope included:** `BL-0121`, `BL-0128`, `BL-0514`, `BL-0560`, `BL-0573`, `BL-0574`, `BL-0619`, `BL-0620`, `BL-0622`, `BL-0461`, `BL-0635`.
- **Scope excluded for now:** `BL-0554` THD/IMD and other specialist analysis that can land after the core simulation UX is cohesive.
- **Dependencies:** Stable simulation control surface, result overlay strategy, and a decision on browser-only vs hybrid firmware execution.
- **Risks:** Solver/runtime cost, confusing UX if too many simulation modes remain visible at once, and keeping firmware/runtime state in sync with circuit state.
- **Open questions:** Should “Start Simulation” auto-detect mode always, or offer a fallback chooser when confidence is low? Does firmware execution require a local helper?
- **Exit criteria:** One obvious start flow, visual overlays on-canvas, component state rendering, and at least one supported firmware-aware simulation path.
- **Verification plan:** Run end-to-end sample circuits, compare numeric outputs against known fixtures, and verify visual state changes on canvas.
- **Related docs:** `docs/product-analysis-report.md`, `docs/product-analysis-checklist.md`, `docs/plans/2026-03-13-c5-firmware-runtime-program.md`.

### Epic B — Arduino Workbench / IDE Parity

- **Goal:** Make ProtoPulse’s Workbench credible as an everyday Arduino development environment, not just an export sidecar.
- **Why it matters:** The moment makers hit compile friction, serial confusion, or bad diagnostics, they leave for Arduino IDE or PlatformIO.
- **Complexity:** `C5` — Toolchain, editor, upload, diagnostics, and platform-support surface.
- **Scope included:** `BL-0140`-`BL-0157`, `BL-0515`-`BL-0518`, `BL-0584`, `BL-0598`-`BL-0618`, `BL-0400`-`BL-0426`.
- **Scope excluded for now:** Deep enterprise platform work that does not directly improve the maker edit→compile→upload→debug loop.
- **Dependencies:** Board/package model clarity, reliable CLI job orchestration, structured error parsing, and decisions on multi-platform support breadth.
- **Risks:** Toolchain sprawl, background job complexity, and trying to match full IDE behavior without first nailing the most-used 20%.
- **Open questions:** How far do we go on Arduino IDE parity before broadening into PlatformIO-class workflows? What belongs in-browser vs in a local helper?
- **Exit criteria:** A beginner can select a board, compile, understand failures, upload, open serial, and recover from common mistakes without leaving ProtoPulse.
- **Verification plan:** Run scripted compile/upload flows for at least AVR + ESP32, validate parsed diagnostics, and regression-test serial/session handoff.
- **Related docs:** `docs/arduino-ide-integration-spec.md`, `docs/arduino-ide-api-contracts.md`, `docs/plans/2026-03-13-c5-firmware-runtime-program.md`.

### Epic C — Cross-Tool Integration / “One Tool, Zero Context Switching”

- **Goal:** Make the architecture, schematic, breadboard, BOM, validation, export, and manufacturing surfaces behave like one coherent system.
- **Why it matters:** ProtoPulse’s core promise breaks whenever users have to manually re-enter data between views.
- **Complexity:** `C5` — Shared source-of-truth rules across the product are architecture-defining.
- **Scope included:** `BL-0558`, `BL-0563`-`BL-0566`, `BL-0568`, `BL-0571`-`BL-0586`.
- **Scope excluded for now:** Brand-new moonshots that do not first improve coherence between existing surfaces.
- **Dependencies:** Shared identifiers between domains, navigation/focus primitives, and clear source-of-truth rules for BOM/design/manufacturing data.
- **Risks:** Hidden data ownership conflicts, accidental overwrite behavior, and brittle synchronization if mapping rules stay implicit.
- **Open questions:** Which domain owns value/MPN truth after initial placement: schematic, BOM, or both? Which cross-tool actions should be automatic vs confirm-first?
- **Exit criteria:** Users can move across key workflows without retyping the same facts or manually reconciling divergent data.
- **Verification plan:** Multi-view scenario tests covering schematic→BOM→PCB→validation→export and snapshot restore cascades.
- **Related docs:** `docs/product-analysis-report.md`, `docs/product-analysis-checklist.md`.

### Epic D — Collaboration, Review, and Branching

- **Goal:** Evolve collaboration from shared presence into a trustworthy review/approval/branching system for real team use.
- **Why it matters:** Real shared hardware/design work needs approvals, restore points, ECOs, branches, and session trust, not just concurrent cursors.
- **Complexity:** `C5` — Touches tenancy, review, restore, auditability, and branch semantics.
- **Scope included:** `BL-0181`-`BL-0190`, `BL-0525`-`BL-0527`, `BL-0380`-`BL-0384`.
- **Scope excluded for now:** Marketplace/community social layers that do not improve core design collaboration.
- **Dependencies:** Firm session revalidation, auditability, role enforcement, and an opinionated branching/review model.
- **Risks:** Access-control mistakes, CRDT/branch semantics getting too clever, and approval flows that become too heavyweight for makers.
- **Open questions:** Should design branching be Git-like, snapshot-based, or review-first? What is the minimum viable ECO flow that still feels safe?
- **Exit criteria:** A team can branch, review, approve, restore, and audit meaningful design changes with clear ownership and history.
- **Verification plan:** Role-based integration tests, reconnect/auth tests, branch/merge scenario coverage, and audit-log traceability checks.
- **Related docs:** `docs/DEVELOPER.md`, `docs/backend-audit-checklist.md`, `docs/plans/2026-03-13-c5-collaboration-foundation-program.md`.

### Epic E — Manufacturing, BOM Intelligence, and Fab Readiness

- **Goal:** Make manufacturing outputs rely on actual project data and surface supply/fab risks before users commit.
- **Why it matters:** This is where “cool demo” turns into “real tool I trust before spending money.”
- **Complexity:** `C4` — Systemic integration across BOM, validation, export, and supplier/fab workflows.
- **Scope included:** `BL-0468`-`BL-0476`, `BL-0528`-`BL-0533`, `BL-0564`, `BL-0565`, `BL-0572`, `BL-0579`, `BL-0580`, `BL-0581`, `BL-0586`.
- **Scope excluded for now:** Marketplace-scale supply-chain features that do not directly improve project-level manufacturability.
- **Dependencies:** Real BOM integration, reliable file generation checks, supplier data strategy, and clear validation ownership.
- **Risks:** Mock supplier data undermining user trust, fab-specific API complexity, and false confidence from partial DFM coverage.
- **Open questions:** When should real-time supplier data be required vs optional? Should fab package export auto-create a frozen manufacturing snapshot?
- **Exit criteria:** A user can validate, package, price-check, and hand off a project for fab with materially less manual reconciliation.
- **Verification plan:** Fixture-based export validation, BOM-to-package integration tests, and DFM navigation/UX regression tests.
- **Related docs:** `docs/product-analysis-report.md`, `docs/app-audit-checklist.md`.

### Epic F — Learning, Starter Experience, and Guided Success

- **Goal:** Make ProtoPulse usable by someone who is still learning electronics, not just someone already fluent in EDA workflows.
- **Why it matters:** The target user is explicitly a maker/learner who needs momentum and guardrails, not just raw capability.
- **Complexity:** `C4` — Cross-surface onboarding and guidance work with a wide UX verification burden.
- **Scope included:** `BL-0300`-`BL-0314`, `BL-0627`, `BL-0628`, `BL-0460`.
- **Scope excluded for now:** Education platform expansion that depends on unresolved classroom or org-tenancy architecture.
- **Dependencies:** Starter content curation, role/beginner-mode framing, and consistent help/onboarding entry points across views.
- **Risks:** Overbuilding tutorial surfaces without reducing actual product friction, and guidance that drifts out of sync with real workflows.
- **Open questions:** Is the right top-level mode “Beginner / Hobbyist / Pro,” guided sample projects, or both? What should first-run success look like?
- **Exit criteria:** A new user can open a starter project, understand what to do next, and reach a working result without leaving the tool.
- **Verification plan:** First-run walkthrough tests, starter-project smoke tests, and UX review of progressive disclosure across core views.
- **Related docs:** `docs/USER_GUIDE.md`, `docs/product-analysis-checklist.md`.

## Discovery / Spikes

| Spike Question | Related IDs | Outcome Needed |
|----------------|-------------|----------------|
| ~~What is the right architecture for firmware execution without hardware?~~ | `BL-0631`, `BL-0635`, `BL-0461` | ~~RESOLVED — ADR 0007: Pure-Local Desktop App with native process spawning.~~ |
| ~~How should hardware debugger support work in a browser-centric product?~~ | `BL-0632` | ~~RESOLVED — ADR 0007: Direct USB/debug probe access via native desktop runtime.~~ |
| ~~How broad should embedded platform support become in the next phase?~~ | `BL-0613`, `BL-0614`, `BL-0633` | ~~RESOLVED — ADR 0008: Broad multi-platform support enabled by native toolchain access.~~ |
| Should the 3D viewer be upgraded incrementally or replaced wholesale? | `BL-0553` | Renderer strategy, migration plan, and performance acceptance criteria. |
| How should supplier/fab integrations handle auth, caching, and trust disclaimers? | `BL-0529`, `BL-0531`, `BL-0533`, `BL-0565` | Integration contract and rollout path that avoids fake-confidence UX. |
| Is the SI/PDN unified dashboard feasible with current geometry data? | `BL-0555`, `BL-0561` | Proof-of-concept on one routed design plus data model gaps list. |
| What is the boundary of a ProtoPulse plugin/automation SDK? | `BL-0371`, `BL-0374`, `BL-0375` | Decide safe extension points before exposing public automation surfaces. |

## Blocked / Waiting On

No backlog items are explicitly `BLOCKED` (`BL-0524` closed Wave 152 — its prerequisite `BL-0486` had already landed in Wave 67). Several other items are still blocked-in-practice even though their row status remains `OPEN`. Treat the following as the current blocker map until their prerequisite decisions land.

| Practical Blocker | Why It Is Not Ready Yet | Related IDs |
|-------------------|-------------------------|-------------|
| ~~Firmware simulation architecture~~ | ~~RESOLVED — Pure-Local Desktop App (ADR 0007). Native process spawning removes browser sandbox limitations.~~ | `BL-0631`, `BL-0635`, `BL-0461` |
| ~~Hardware debugger integration path~~ | ~~RESOLVED — Pure-Local Desktop App (ADR 0007). Direct USB/serial access eliminates WebUSB constraints.~~ | `BL-0632` |
| ~~Multi-platform embedded support breadth~~ | ~~RESOLVED — Pure-Local Desktop App (ADR 0008). Native filesystem + local toolchains enable broad platform support.~~ | `BL-0613`, `BL-0614`, `BL-0633` |
| Real supplier/fab data trust model | Several manufacturing features should not ship on mock or loosely cached data. | `BL-0485`, `BL-0529`, `BL-0531`, `BL-0533`, `BL-0565` |
| Team/org workflow foundation | Branching, approvals, and org-level features depend on tenancy/RBAC and audit direction. | `BL-0184`, `BL-0185`, `BL-0380`, `BL-0381` |

## Cross-Cutting Work

| Initiative | Surfaces Touched | Related IDs |
|------------|------------------|-------------|
| Schematic ↔ PCB ↔ Breadboard coherence | Schematic canvas, PCB canvas, breadboard, netlist, placement flow | `BL-0558`, `BL-0571`, `BL-0563`, `BL-0566` |
| Validation everywhere | ValidationView, PCB canvas, BOM, standards/DFM engines | `BL-0566`, `BL-0572`, `BL-0580`, `BL-0581` |
| Manufacturing from real project data | BOM, DFM, exports, ordering, supplier APIs | `BL-0564`, `BL-0565`, `BL-0530`, `BL-0531`, `BL-0586` |
| Design-to-device loop | Schematic, firmware scaffold, compile/upload, serial, digital twin | `BL-0140`, `BL-0142`, `BL-0518`, `BL-0584`, `BL-0423` |
| Beginner success path | Starter circuits, tutorials, onboarding, examples, AI teaching | `BL-0300`, `BL-0301`, `BL-0308`, `BL-0627`, `BL-0628`, `BL-0161` |

## Decision Needed

| Decision | Why It Matters Now | Related IDs |
|----------|--------------------|-------------|
| ~~Firmware simulation architecture~~ | ~~RESOLVED — Pure-Local Desktop App pivot (ADR 0007). Native process spawning chosen over browser-only/hybrid.~~ | `BL-0631`, `BL-0635`, `BL-0461` |
| ~~Hardware debugger integration model~~ | ~~RESOLVED — Pure-Local Desktop App pivot (ADR 0007). Direct USB/debug probe access via native runtime.~~ | `BL-0632` |
| ~~Multi-platform support scope~~ | ~~RESOLVED — Pure-Local Desktop App pivot (ADR 0008). Broad platform support enabled by native toolchain access.~~ | `BL-0613`, `BL-0614`, `BL-0633` |
| 3D viewer path | Needed before any serious 3D/professional visualization roadmap work. | `BL-0553` |
| Supplier/fab account strategy | Required to decide whether ordering remains export-first or becomes directly integrated. | `BL-0529`, `BL-0533` |
| Collaboration model | Needed to sequence branching, approvals, ECO workflows, and team/org features coherently. | `BL-0181`-`BL-0189`, `BL-0380`, `BL-0381` |

## Architecture / ADR Required

| Topic | ADR Should Decide | Related IDs |
|-------|-------------------|-------------|
| ~~Firmware execution and simulation runtime~~ | ~~RESOLVED — ADR 0007: Pure-Local Desktop App. Native process spawning for firmware compile/upload/simulate.~~ | `BL-0631`, `BL-0635`, `BL-0461` |
| ~~Debug probe integration~~ | ~~RESOLVED — ADR 0007: Pure-Local Desktop App. Direct USB/JTAG/SWD access via native runtime.~~ | `BL-0632` |
| Cross-domain source of truth | Which system owns component value/MPN/state when multiple views edit the same concept | `BL-0563`, `BL-0571`, `BL-0580` |
| Supplier/fab integration | Auth, caching, retry, trust disclaimers, offline behavior | `BL-0529`, `BL-0533`, `BL-0565` |
| Collaboration / branching model | CRDT + branches + approvals + restore semantics | `BL-0182`, `BL-0183`, `BL-0184`, `BL-0185` |
| Public automation surface | What becomes SDK/plugin/webhook/API vs what remains internal-only | `BL-0370`, `BL-0371`, `BL-0374`, `BL-0375` |

## Definition of Ready

- The item has a stable `BL-XXXX` ID and a clear source/cross-reference.
- The problem statement is user-visible or system-visible, not just a vague idea title.
- Dependencies or prerequisite decisions are named explicitly.
- Complexity is estimated if the item is larger than a trivial bugfix or copy change.
- Scope is small enough to fit in a wave, or the item is elevated into an epic with child IDs.
- Acceptance signal is obvious enough that another engineer could verify completion without guessing.
- High-risk items have at least one note about performance, security, or UX failure modes.

## Definition of Done

- Status is updated to `DONE` with the Wave number and verification detail available.
- The implemented workflow works end-to-end in the relevant surface, not just at the API or data-model layer.
- Tests or verification evidence exist at the right layer for the change.
- Any affected cross-tool links, navigation, or synchronization paths were checked for regressions.
- User-facing trust details are honest: no fake status, no hidden mock limitations, no silent failure path.
- Related backlog items were updated if scope changed, split, or made another row obsolete/duplicate.

## Complexity Scale

- **`C1` — Localized:** One component, one route, or one utility; little coordination risk.
- **`C2` — Multi-file / single surface:** Affects a contained workflow within one domain such as one editor, panel, or route family.
- **`C3` — Cross-surface:** Touches multiple layers such as UI + API + storage, or connects two existing domains.
- **`C4` — Systemic:** Cross-domain integration, new shared data contracts, or high verification burden across several workflows.
- **`C5` — Platform / architecture-defining:** New subsystem, runtime, tenancy model, execution environment, or a decision that many downstream items depend on.
- **Rule of thumb:** Effort asks "how much work is this right now?" Complexity asks "how many systems, decisions, and failure modes are tied up in this?"

## Planning Fields for New and Updated Items

- **User Impact:** `High`, `Medium`, or `Low`.
- **Effort:** `S`, `M`, `L`, or `XL` for expected implementation size.
- **Complexity:** `C1` to `C5` using the complexity scale below.
- **Confidence:** `High`, `Medium`, or `Low` based on how well-understood the work is.
- **Dependencies:** IDs, systems, or decisions that must land first.
- **Tags:** Use concise tags such as `security`, `simulation`, `arduino`, `collaboration`, `manufacturing`, `integration`, `frontend`, `backend`, `schema`, `tests`, `docs`, `ux`, `learning`, `performance`, `accessibility`, `ai`.
- **Verification Note:** Short note naming the expected proof, such as browser validation, integration test, export fixture, or hardware smoke test.

## Test / Verification Notes

- **UI / editor changes:** verify in a live browser and add or update regression tests where behavior is scriptable.
- **API / storage changes:** add route/storage coverage and confirm response-shape compatibility.
- **Cross-tool integration work:** test the full source→target workflow, not just one side of the bridge.
- **Simulation / analysis work:** use fixture circuits, numerical sanity checks, and runtime/performance guardrails.
- **Arduino / toolchain work:** parse real CLI output samples, test common failure cases, and verify serial/compile/upload state transitions.
- **Manufacturing / export work:** validate generated files, not just the button path that produces them.

## How to Add a New Item

- Add the item to the most relevant detailed backlog section below.
- Include the stable `BL-XXXX` ID, source reference, and initial status.
- For anything bigger than a single wave, also add or update an epic summary in the planning layer above.
- If the item is not truly ready to build, put it in `Discovery / Spikes`, `Blocked / Waiting On`, or `Decision Needed` as well.
- Add planning fields whenever possible: user impact, effort, complexity, confidence, dependencies, tags, and verification note.
- If the item changes scope or splits into sub-work, update the parent epic or nearby rows so nothing silently disappears.

### Complex Item Template

- **Goal:** What this work is trying to accomplish.
- **Why it matters:** Why the user or system should care.
- **Scope included:** What is in.
- **Scope excluded:** What is explicitly out for now.
- **Dependencies:** What must land first.
- **Risks:** What could go wrong.
- **Open questions:** What still needs answers.
- **Acceptance criteria:** What “good enough” means.
- **Verification plan:** How we will prove it works.
- **Related child items:** The `BL-XXXX` rows carrying the actual work.
- **Related docs:** Specs, audits, ADRs, or plans worth linking.

## Quick Stats

| Priority | Open | Done | Description |
|----------|------|------|-------------|
| P0 | 0 | 19 | All resolved (Waves 52-60, 80). |
| P1 | 0 | 73 | All resolved (Waves 54-67). |
| P2 | **0** | **283** | `BL-0126` closed Wave 153 (Phase 2 already wired: DRC + board-stackup + sim↔DRC bridge + full simulation suite all consume `@shared/units` canonically). `BL-0524` closed Wave 152. Waves 61-153. |
| P3 | 0 | 133 | All resolved (Waves 105-154). |
| **Total** | **0** | **508** | **508 items tracked** — BACKLOG FULLY DONE as of Wave 153. |

*Snapshot updated: 2026-04-18 — `BL-0126` closed in Wave 153 (verified Phase 2 wiring landed: `shared/drc-engine.ts` imports `Length_mil` from `./units`; `client/src/lib/board-stackup.ts` uses `@shared/units` branded types; `client/src/lib/simulation/pcb-geometry-bridge.ts` imports `milToMm`/`mmToMeter` from `@shared/units`; simulation suite — `spice-netlist-parser`, `spice-generator`, `design-var-spice-bridge`, `thermal-analysis` — all import canonical helpers from `@shared/units`). No remaining open or BLOCKED items.*

---

## P0 — Critical (Security / Crashes / Data Loss)

### Security

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0001 | **Auth bypass in dev mode** — `NODE_ENV !== 'production'` skips all session validation. Every endpoint is unauthenticated in dev. | DONE (Wave E) | C3 | app-audit §14 |
| BL-0002 | **`/api/seed` is public** — listed in `PUBLIC_PATHS`. Any non-prod deployment allows unauthenticated DB seeding. | DONE (Wave 52) | C2 | app-audit §14 |
| BL-0003 | **API keys sent in plaintext** in every `/api/chat/ai/stream` POST body. Visible in DevTools, potentially logged by proxies. | DONE (Wave 52) | C2 | app-audit §14 |
| BL-0004 | **Response body logging captures API keys** — server logs first 500 chars of every JSON response. | DONE (Wave E) | C2 | app-audit §14 |
| BL-0005 | **API keys in localStorage** — migrated to server-side encrypted storage (AES-256-GCM via `api_keys` table) when authenticated, localStorage fallback for unauthenticated users. `useApiKeys` hook, ChatPanel/ModifyModal/PinExtractModal/DatasheetExtractModal updated. | DONE | C3 | Wave 60 |
| BL-0006 | **Admin purge has no role check** — `DELETE /api/admin/purge` callable by any user. | DONE (Wave 52) | C2 | app-audit §14 |
| BL-0007 | **XSS in `useDragGhost.ts`** — `innerHTML` interpolates user-editable `assetName` without sanitization. | DONE | C2 | app-audit §14 |
| BL-0008 | **LIKE wildcards not escaped** in library search queries — user can use `%` and `_`. | DONE (Wave 52) | C2 | app-audit §14 |
| BL-0009 | **Multiple `z.any()` fields** in Zod schemas bypass type validation. | DONE | C2 | app-audit §14 |
| BL-0070 | **ZIP bomb vulnerability on FZPZ import** — no decompressed size limit. Add 50MB cap + stream-decompress with byte counter. | DONE (Wave 52) | C3 | GA-SEC-13 |
| BL-0071 | **SVG content parsed without sanitization** — add DOMPurify or equivalent before storing/rendering SVG. | DONE (CAPX-SEC-17) | C2 | GA-SEC-17 |
| BL-0072 | **Session tokens stored in plaintext** in DB — store hashed tokens, compare hashes, rotate on auth actions. | DONE | C3 | GA-SEC-09 |
| BL-0636 | **AI chat execution endpoints do not enforce project ownership** — `/api/chat/ai` and `/api/chat/ai/stream` accept `projectId` in the body and build project context without `requireProjectOwnership`. Add ownership enforcement and reject cross-project context access. | DONE (Wave 80) | C4 | Repo gap audit 2026-03-13 |
| BL-0637 | **AI action lookup by message ID is not project-scoped** — `/api/ai-actions/by-message/:messageId` queries by message ID alone. Scope lookups through project ownership or verify the message belongs to a project the session can access. | DONE (Wave 80) | C3 | Repo gap audit 2026-03-13 |
| BL-0638 | **Circuit API tenant-scoping gaps / IDOR risk** — Multiple circuit endpoints are only session-protected and operate on global instance/wire/via/net IDs without verifying the caller owns the containing project. Add project-aware authorization checks throughout the circuit route surface. | DONE (Wave 80) | C5 | Repo gap audit 2026-03-13 |
| BL-0639 | **Project-scoped circuit routes do not always verify project↔resource consistency** — Routes under `/api/projects/:projectId/...` often fetch circuit/simulation/scenario/port resources by ID only. Validate that each resource actually belongs to the requested project before returning or mutating it. | DONE (Wave 80) | C3 | Repo gap audit 2026-03-13 |
| BL-0642 | **Batch analysis authz + durability gap** — Batch submit/status/results/cancel flows rely on `X-Gemini-Key` and body `projectId` without full project ownership guards, and the batch tracker is still in-memory. Harden authz and persist batch state/results. | DONE (Wave 80) | C4 | Repo gap audit 2026-03-13 |

### Crashes & Data Loading

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0010 | **Breadboard/PCB JSON parse crash** — API returns HTML `<!DOCTYPE` instead of JSON. Fixed: added `/api/*` catch-all returning JSON 404 before SPA catch-all (Wave 53). | DONE | C2 | app-audit §5, §6 |
| BL-0011 | **DRC false positives (123 duplicates)** — DRC runs against raw SVG coordinates, not real-world dimensions. Fixed: skip 0.0px overlapping shapes in non-PCB views + shape-pair deduplication in runDRC() (Wave 53). | DONE | C2 | app-audit §8 |

---

## P1 — High (Broken Workflows / Major UX / Test Gaps)

### Observed Bugs (from visual audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0012 | **"Invalid Date" in timeline** — Fixed: added isNaN guard in formatRelativeTime/formatExactTime (Wave 54). | DONE | C1 | app-audit §1 |
| BL-0013 | **401 on every page load** — Already fixed: `/api/settings/chat` is in PUBLIC_PATHS bypass. | DONE | C1 | app-audit §1 |
| BL-0014 | **Schematic net edges silently fail** — 10x React Flow errors: `Couldn't create edge for source handle id: "pin-PB0"`. Nets don't render. | DONE (Wave 56) — `resolvePinId()` fallback resolves pin names→connector IDs | C2 | app-audit §4 |
| BL-0015 | **BOM spinbutton constraints broken** — Fixed: string min/max attrs + Math.max clamping in onChange (Wave 54). | DONE | C1 | app-audit §7 |
| BL-0016 | **BOM float precision** — Fixed: Math.round(n * 100) / 100 before toFixed(2) in BomCards + BomTable (Wave 54). | DONE | C1 | app-audit §7 |
| BL-0017 | **Chat temperature slider float** — Fixed: Math.round rounding in display + aria-valuetext (Wave 54). | DONE | C1 | app-audit §11 |
| BL-0018 | **Component Editor float noise** — Fixed: round2() applied to pitch input onChange handler (Wave 54). | DONE | C1 | app-audit §3 |
| BL-0019 | **CSP `frame-ancestors` via `<meta>`** — Fixed: removed from meta tag, added frameAncestors to Helmet CSP header (Wave 54). | DONE | C1 | app-audit §1 |
| BL-0020 | **Duplicate API requests on load** — Mitigated: global `staleTime: 5min` + `refetchOnWindowFocus: false` in queryClient.ts deduplicates within React Query. Seed request has 5s AbortSignal timeout. Remaining duplicates are React Query's expected mount-time checks. | DONE | C2 | app-audit §16 |

### Auth & Session

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0021 | **No login/register UI** — Backend auth exists but zero frontend auth pages. `/login`, `/register` all 404. | DONE (verified Wave 59) — AuthPage.tsx 163 lines with login/register toggle, validation, error display. POST /register + /login + /logout + GET /me all exist. | C2 | app-audit §12 |
| BL-0022 | **No session management** — No X-Session-Id stored/sent by client. Auth layer is dead code. | DONE (verified Wave 59) — auth-context.tsx 237 lines: login/register/logout, localStorage session, X-Session-Id injected via queryClient.ts getAuthHeaders(), network retry, 12 tests. | C3 | app-audit §12 |
| BL-0023 | **App fully accessible without auth** — No protected routes client-side. Anyone can view/edit/delete. | DONE (verified Wave 59) — App.tsx AuthGate wraps all routes, shows AuthPage when unauthenticated. Server-side PUBLIC_PATHS whitelist + requireProjectOwnership on 22+ routes. | C3 | app-audit §12 |

### Reliability

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0073 | **SSE stream client doesn't check `response.ok`** — Already fixed: ChatPanel.tsx checks `!response.ok` before `getReader()` (line 603). DesignAgentPanel.tsx also checks (line 84). | DONE | C2 | GA-ERR-03 |
| BL-0074 | **N+1 query in `buildAppStateFromProject()`** — Already fixed: uses `Promise.all()` for 10 parallel queries (server/routes/chat.ts:203). | DONE | C2 | GA-DB-01 |
| BL-0075 | **No circuit breaker for AI provider** — Already implemented: `server/circuit-breaker.ts` with CLOSED/OPEN/HALF_OPEN states, singleton breakers per provider. | DONE | C3 | GA-ERR-06 |
| BL-0076 | **No automatic AI provider fallback** — Already implemented: `server/ai.ts` has `FallbackProviderConfig`, `isRetryableError()`, automatic provider switch on 5xx/timeout. | DONE | C3 | GA-ERR-07 |
| BL-0077 | **Race condition in `upsertChatSettings`** — Already fixed: uses `onConflictDoUpdate` (server/storage/components.ts:198). | DONE | C2 | GA-DB-03 |

### Performance

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0024 | **CircuitCodeView chunk 724 KB** — Fixed: split CodeMirror (470KB) and Sucrase (206KB) into separate vendor chunks. CircuitCodeView 724→47KB. No 500KB warning. (Wave 55) | DONE | C2 | app-audit §15 |
| BL-0025 | **7 context providers create unmemoized values** — Already fixed: all 7 providers (Architecture, BOM, Chat, Validation, History, Output, ProjectMeta) use useMemo on context values. | DONE | C2 | app-audit §15 |
| BL-0026 | **ChatPanel has 22 useState hooks** — any state change re-renders entire 829-line component. | DONE (Wave 57) — 21 useState → 3 useReducer hooks (useChatPanelUI, useChatMessaging, useMultimodalState) + 2 standalone | C3 | app-audit §15 |
| BL-0027 | **Mutations invalidate full query lists** — every message triggers full refetch instead of optimistic update. | DONE (Wave 58) — optimistic onMutate/onError/onSettled in bom, chat, validation contexts | C3 | app-audit §15 |

### Accessibility (Critical)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0028 | **`ToolButton.tsx` missing aria-label** — Already fixed: ToolButton.tsx has `aria-label={label}` (line 21). | DONE | C1 | app-audit §13 |
| BL-0029 | **48+ icon-only buttons missing aria-labels** — Fixed: added aria-labels to 9 violations across CommentsPanel, KanbanView, ChatSearchBar (Wave 55). Remaining buttons already have labels. | DONE | C1 | app-audit §13 |
| BL-0030 | **Interactive `<div>` elements** — Fixed: added role="button", tabIndex, keyboard handlers to ChatPanel backdrop, Sidebar collapsed div, Sidebar backdrop (Wave 55). | DONE | C1 | app-audit §13 |
| BL-0031 | **No `role="tablist"`/`role="tab"`/`aria-selected`** — Already fixed: ProjectWorkspace.tsx has full ARIA tab semantics (role=tablist/tab/tabpanel, aria-selected, aria-controls). | DONE | C1 | app-audit §1, §13 |
| BL-0032 | **No H1 element** — Already fixed: ProjectWorkspace.tsx:492 has `<h1 className="sr-only">ProtoPulse</h1>`, plus H1s on ProjectPickerPage and AuthPage. | DONE | C1 | app-audit §1 |
| BL-0033 | **Form fields without label association** — Fixed: added aria-labels/htmlFor to 12 fields across ShareProjectDialog, ComponentPlacer, DesignVariablesPanel, PowerSymbolPalette, CommentsPanel, SerialMonitorPanel (Wave 55). | DONE | C1 | app-audit §13 |

### Test Hardening (Wave F)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0034 | **Route-level ownership integration tests** — Already implemented: ownership-integration.test.ts (23 tests, 600 lines) covering 23 route families. | DONE | C3 | Wave F (F1) |
| BL-0035 | **Collaboration handshake/auth tests** — Already implemented: collaboration-auth.test.ts (50 tests, 850 lines) covering handshake, role enforcement, lock enforcement, room isolation. | DONE | C3 | Wave F (F2) |
| BL-0036 | **Export/import contract integration tests** — Already implemented: 10 export test files (317 tests) covering KiCad, Eagle, SPICE, Gerber, drill, BOM, IPC-2581, ODB++, STEP, snapshots. | DONE | C3 | Wave F (F3) |
| BL-0037 | **AI tool executor boundary tests** — Already implemented: ai-tools-boundary.test.ts (100 tests, 1111 lines) covering registry completeness, schema validation, input rejection for all 12 tool domains. | DONE | C3 | Wave F (F4) |
| BL-0038 | **Simulation input validation tests** — Already implemented: 8 simulation test files (545 tests) covering AC/DC/transient analysis, device models, Monte Carlo, SPICE parser, circuit solver. | DONE | C3 | Wave F (F5) |

### Wiring Fixes (Partial Implementations)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0039 | **Collaboration runtime activation** — WebSocket rooms, CRDT ops exist (Wave 41) but not fully activated in production flow. | DONE (Wave 58) — attachCollaborationServer() wired to httpServer in index.ts with DISABLE_COLLABORATION env flag | C4 | MF-023 |
| BL-0040 | **Standard categories not unified** — UI filter categories don't match storage categories end-to-end. | DONE (Wave 57) — shared/component-categories.ts as single source of truth, compile-time ComponentCategory type | C3 | MF-026 |
| BL-0041 | **Metrics lifecycle not fully wired** — Fixed: startMetricsCollection() called on server listen, stopMetricsCollection()+flushMetrics() added to graceful shutdown (Wave 56). /api/metrics endpoint already exists. | DONE | C3 | MF-030 |
| BL-0042 | **Route-level test coverage** weaker than actual route surface area. | DONE (Wave 58) — 11 new test files, 121 tests covering architecture/bom/chat/history/validation/comments/settings/circuit routes | C3 | MF-032 |
| BL-0043 | **Migration chain out of sync** with runtime schema (Drizzle push works but formal migrations drift). | DONE (Wave 58) — migration 0002 generated (8 new tables + column additions), CHECK constraints preserved | C3 | MF-014 |
| BL-0044 | **Import transactions** — Already fixed: project-io.ts uses `db.transaction()` wrapping all 9 insert operations (nodes, edges, BOM, validation, chat, history, parts, circuits) with full atomicity. | DONE | C3 | MF-015 |
| BL-0045 | **API error/status consistency** — DELETE responses now all use 204. Remaining inconsistency is non-DELETE response shape (`{ message }` vs `{ data }` vs direct arrays) — accepted pattern for REST APIs. | DONE | C3 | MF-020 |

### Cross-Tool Integration — Schematic ↔ PCB (Wave 65 Audit — NEW, P1)

> ProtoPulse's core promise is "one tool, zero context-switching." These items are where the promise breaks because separate features don't talk to each other at all.

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0558 | **Schematic → PCB forward annotation** — Fixed: POST /api/circuits/:circuitId/push-to-pcb creates unplaced PCB instances from schematic instances, Push to PCB button with AlertDialog confirmation in SchematicView. 5 new tests. | DONE (Wave 67) | C4 | Wave 65 audit |

### Broken/Non-Functional Features (Wave 64 Audit — NEW)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0477 | **Breadboard collision detection broken** — Fixed: occupiedPoints now computes proper footprint size using pinCount and crossesChannel for DIP ICs. | DONE (Wave 67) | C3 | Wave 64 audit |
| BL-0478 | **Breadboard drag-to-place not implemented** — Fixed: HTML5 drag-and-drop from component palette to breadboard with snap-to-hole, collision check, and visual drop preview. | DONE (Wave 67) | C3 | Wave 64 audit |
| BL-0479 | **PCB undo/redo not wired** — Fixed: useUndoRedo wired into PCBLayoutView, wire create/delete registered as undoable commands, Ctrl+Z/Y works. | DONE (Wave 67) | C3 | Wave 64 audit |
| BL-0480 | **PCB board dimensions not persisted** — Fixed: boardWidth/boardHeight saved to circuit_designs.settings JSONB with 500ms debounce. | DONE (Wave 67) | C3 | Wave 64 audit |
| BL-0481 | **PCB ordering: Gerber files never attached** — Fixed: POST /api/projects/:id/orders/:orderId/generate-gerbers generates and attaches Gerber layer content + drill file to order record. | DONE (Wave 67) | C3 | Wave 64 audit |
| BL-0482 | **Arduino Serial Monitor: fake hardware port** — Fixed: SerialMonitorPanel integrated into ArduinoWorkbenchView, Connect button wired to WebSerialManager.connect(). | DONE (Wave 67) | C3 | Wave 64 audit |
| BL-0483 | **Arduino Web Serial isolated from Workbench** — Fixed: Upload and Serial Monitor share WebSerialManager singleton via same port handle. | DONE (Wave 67) | C3 | Wave 64 audit |
| BL-0484 | **Simulation NR loop runs one iteration** — Fixed: proper NR iteration loop with VNTOL/ABSTOL convergence, max 150 iterations, damped Newton steps. 17 new tests. | DONE (Wave 67) | C3 | Wave 64 audit |
| BL-0485 | **Supplier API data is 100% hardcoded mock** — Fixed: added visible disclaimer banner + DEMO badges in SupplierPricingPanel. | DONE (Wave 67) | C1 | Wave 64 audit |
| BL-0486 | **CRDT conflict resolution algorithm not implemented** — Fixed: LWW with vector clocks for property updates, intent-preserving structural merge (insert-wins-over-delete), per-room Lamport clock, 200-op sliding window. 23 new tests. | DONE (Wave 67) | C4 | Wave 64 audit |
| BL-0487 | **Collaboration WebSocket lock enforcement missing server-side** — Fixed: handleStateUpdate rejects ops targeting entities locked by another user, partial acceptance for mixed batches. 17 integration tests. | DONE (Wave 67) | C3 | Wave 64 audit |
| BL-0488 | **Collaboration RBAC not enforced** — Fixed: viewers blocked from all mutations, editors blocked from root design deletion, owner retains full access. | DONE (Wave 67) | C3 | Wave 64 audit |
| BL-0587 | **Arduino library install not implemented** — Fixed: backend routes calling arduino-cli lib install/uninstall/list, full Libraries tab in ArduinoWorkbenchView. | DONE (Wave 67) | C3 | Wave 66 competitive audit |
| BL-0588 | **Board Manager (platform/core install) missing** — Fixed: backend routes for arduino-cli core list/install/uninstall, Boards tab with search + 7 popular platform quick-install. | DONE (Wave 67) | C3 | Wave 66 competitive audit |
| BL-0589 | **Serial Monitor is receive-only** — Fixed: WebSerialManager.send() + SerialMonitorPanel send input already existed, gap was Workbench not integrating the panel (fixed by BL-0482). | DONE (Wave 67) | C3 | Wave 66 competitive audit |

### UX Trust Fixes

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0046 | **Show real status labels** — Already fixed: ExportPanel uses real loading/success/error status from mutation callbacks. SaveStatusIndicator tracks real mutations. ChatPanel uses streaming state. No fake status indicators remain. | DONE | C1 | UX-001, UX-006 |
| BL-0047 | **Confirm modal for destructive actions** — Already implemented: ConfirmDialog on snapshot delete (DesignHistoryView), BOM delete (BomCards+BomTable), BOM snapshot delete (BomDiffPanel), output clear (OutputView). | DONE | C1 | UX-004 |
| BL-0048 | **Replace misleading labels** — Fixed: "Fix all issues" → "Help me fix these issues" in ChatPanel suggestion (Wave 56). | DONE | C1 | UX-005 |
| BL-0049 | **Consistent toast style** — Fixed: added success (emerald), warning (amber), info (cyan) variants to toast CVA alongside existing default + destructive (Wave 56). | DONE | C1 | UX-007 |
| BL-0050 | **Retry button** on all network/API failure states. | DONE (Wave 57) — retry buttons on 6 views (Schematic, PCB, DesignHistory, BomDiff, Lifecycle, ComponentEditor) | C1 | UX-008 |
| BL-0051 | **"Last saved at"** — Already fixed: SaveStatusIndicator in Sidebar.tsx (lines 344-384) tracks mutations via useIsMutating, shows "Saving changes..."/"Last saved at HH:MM"/"All changes saved". | DONE | C1 | UX-010 |
| BL-0052 | **Chat help links not clickable** — Already fixed: SettingsPanel.tsx has proper `<a>` elements with href/target/rel for Google console links. | DONE | C1 | app-audit §11 |
| BL-0053 | **Chat model names inconsistent** — Already fixed: constants.ts uses consistent "Claude X.Y ModelName" pattern for all models (4.5 Sonnet, 4.6 Sonnet, 4 Opus, etc.). | DONE | C1 | app-audit §11 |
| BL-0054 | **No validation feedback on settings save** — Fixed: added toast notification on "Save & Close" (Wave 55). | DONE | C1 | app-audit §11 |
| BL-0055 | **Output view shows fake data** — Already fixed: OutputView uses real context data from useOutput() hook. No hardcoded mock entries remain. | DONE | C1 | app-audit §9 |
| BL-0056 | **"BASH / LINUX" label misleading** — Fixed: changed to "SYSTEM LOG" in OutputView.tsx (Wave 56). | DONE | C1 | app-audit §9 |
| BL-0057 | **Validation severity numbers** — Already fixed: ValidationView uses semantic text ("error"/"warning"/"info") with color-coded badges and icons, not numeric values. | DONE | C1 | app-audit §8 |
| BL-0058 | **No severity filtering** — Fixed: added severity filter bar (error/warning/info toggles with counts) to ValidationView (Wave 56). | DONE | C1 | app-audit §8, UX-041 |
| BL-0059 | **DRC violations not grouped** — Fixed: grouped by ruleType with sub-headers showing rule name + count (Wave 56). | DONE | C1 | app-audit §8, UX-042 |
| BL-0060 | **BOM delete has no confirmation** — Already fixed: ConfirmDialog wraps delete in both BomCards.tsx (line 77-88) and BomTable.tsx (line 220-227) with "Remove BOM Item" title + variant=destructive. | DONE | C1 | app-audit §7 |
| BL-0061 | **BOM column sorting** — Fixed: sortable headers (status, part number, manufacturer, stock, qty, unit price, total) with asc/desc/none toggle, ArrowUp/ArrowDown icons (Wave 56). | DONE | C1 | app-audit §7 |
| BL-0062 | **No context menu** on Architecture/Schematic/PCB canvases. Common EDA actions undiscoverable. | DONE (Wave 57) — Radix ContextMenu on all 3 canvases with icons, data-testids, keyboard hints | C1 | app-audit §2 |
| BL-0063 | **No visible undo/redo buttons** — Already fixed: SchematicToolbar.tsx has visible Undo2/Redo2 buttons (lines 91-118) with tooltips "Undo (Ctrl+Z)"/"Redo (Ctrl+Shift+Z)", disabled states, data-testids. | DONE | C1 | app-audit §2 |


### Frontend E2E Walkthrough 2026-04-18 (batch triage)

> Source: inbox/2026-04-18-e2e-*.md chunks (split from 228 KB parent walkthrough).
> Triaged chunks: pass-13 UI/UX, pass-2 visual/flow, pass-4 Breadboard Lab, pass-5 Breadboard wiring.
> Remaining 55 chunks deferred to follow-up triage session.

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0713 | E2E-968 🔴 P1 BUG (NEW) — Light mode toggle is broken. Verified: clicked theme-toggle, `documentElement.classList === "light"`, but screenshot is identical to dark mode. The class is applied; the CSS doesn't react. Either Tailwind dark variant config is wrong, or the `dark` class is hardcoded somewhere upstream. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-968 |
| BL-0714 | E2E-969 🔴 design — Color uses 6 semantic colors (cyan/green/amber/red/purple/yellow) but no documented palette / design token document in repo (per memory + observation). Hard to ensure cross-component consistency. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-969 |
| BL-0715 | E2E-975 🔴 design — No light mode realistically — even though toggle exists, it doesn't work. Hide the toggle until light mode actually ships, or implement it. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-975 |
| BL-0716 | E2E-976 🔴 design — H1/H2/H3 hierarchy is INCONSISTENT across tabs. Workspace title uses h2 ("Design workspace" = h2), but project name uses static text below. Vault title uses h2 ("Knowledge Vault"). Dashboard uses h2 ("Blink LED (Sample)"). All three are h2 with different sizes and weights. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-976 |
| BL-0717 | E2E-983 🔴 design — Top toolbar has 32+ icons crammed together with 2-3px gaps. Density is way too high for icon-only UI. Widen gaps to 8px and add divider lines between groups. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-983 |
| BL-0718 | E2E-984 🔴 design — Architecture left sidebar Asset Library is 240px fixed — too narrow for descriptive part names. Some names truncate. Make resizable + default 280px. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-984 |
| BL-0719 | E2E-988 🔴 design — Layout is inconsistent across tabs. Dashboard = 2x2 card grid. Architecture = sidebar+canvas. Procurement = sub-tabs+table. Validation = 2-column with right rail. Vault = 3-column. Order PCB = top stats + form steps. No common pattern — each tab feels like a different app. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-988 |
| BL-0720 | E2E-993 🔴 design — Icons are Lucide-style (line-icons) for the most part — clean, consistent. BUT: many icon-only buttons have NO LABELS (E2E-314 again from design lens). The line-icon style is gentle/quiet — needs labels to compensate. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-993, E2E-314 |
| BL-0721 | E2E-1001 🔴 design — Disabled states muddled — some disabled buttons stay full opacity but with `cursor-not-allowed`, others fade to 50% opacity, others become greyed-out cards. Pick one disabled treatment. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1001 |
| BL-0722 | E2E-1003 🔴 design — Empty-state design varies wildly: | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1003 |
| BL-0723 | E2E-1005 🔴 design — `panel-skeleton` is the only loading state observed (E2E-019 + E2E-025) — appears as bare grey rectangles for 3-4 seconds with no text. Should use a "Loading [TabName]…" label + spinner. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1005, E2E-019, E2E-025 |
| BL-0724 | E2E-1008 🔴 design — Alternates / Part Usage tabs show ONLY a small red text "Failed to load X data" with no icon, no retry button, no link to setup. Design fail (E2E-481 again from design lens). | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1008, E2E-481 |
| BL-0725 | E2E-1012 🔴 design — Most icon-only header buttons have NO VISIBLE HOVER STATE (or one too subtle to see). Need a standard hover treatment (background tint to muted-50, slight scale or color shift). | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1012 |
| BL-0726 | E2E-1014 🔴 design — No active/pressed state on most buttons — clicking a button gives ZERO tactile feedback. Add subtle scale-down (95%) on press. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1014 |
| BL-0727 | E2E-1015 🔴 design — No observed animations across tabs — tab transitions are instantaneous, modal dialogs pop in without ease, accordions snap. Modern apps use 150-300ms ease-in-out transitions for 90% of UI state changes. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1015 |
| BL-0728 | E2E-1022 🔴 design — Header has 34 distinct interactive elements in a 60px-tall row across the full viewport width. Top-left: project name combo. Center: 32 icon buttons. Right: status badges + Coach/help/notifications/settings/avatar/connection-dot/theme. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1022 |
| BL-0729 | E2E-1023 🔴 design — Project name "Blink LED (Sample)" sits next to a tiny chevron-like icon → suggests project switcher dropdown. But it's tiny and uninteractive-looking. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1023 |
| BL-0730 | E2E-1028 🔴 design — Each tab has its own visual personality: Dashboard = cards-on-grid, Architecture = canvas+sidebar, Procurement = sub-tab grid, Vault = 3-column reader, Calculators = 2-col cards, Order PCB = wizard. No shared "this is ProtoPulse" identity beyond the cyan-on-dark palette. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1028 |
| BL-0731 | E2E-1034 🔴 design — Header tools row has no mobile collapse strategy beyond `mobile-bottom-nav` (E2E-520). On a 768px viewport, the 32-icon header would horribly overflow. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1034, E2E-520 |
| BL-0732 | E2E-1037 🔴 P0 BUG (NEW from screenshot 45) — Light mode toggle does NOT work. classList changes to "light", but visually NOTHING changes. Hide the broken toggle OR implement light mode properly. Currently it's a lie to the user. | OPEN | C2 | E2E walkthrough (pass-13-ui-ux-design-system-deep-dive-e2e-968) — refs E2E-1037 |
| BL-0733 | E2E-314 🔴 P1 visual — Top toolbar has 32+ icon-only buttons stacked tight with NO visible labels (sidebar 21 icons + workspace toolbar ~12 icons). Brand-new users will be paralyzed. Need either (a) labels by default with a "compact" toggle, (b) hover-tooltips with delay <200ms, or (c) collapsible group categories. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-314 |
| BL-0734 | E2E-315 🔴 BUG (CONTRADICTION) — Validation card on Dashboard now shows "Warnings Present — 1 issue to review" AND "0 errors, 0 warnings, 1 info". "Warnings Present" with 0 warnings is internally contradictory. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-315 |
| BL-0735 | E2E-326 🔴 visual — Category icon row at top of Asset Library: just 6 icon glyphs with tiny number badges (12, 2, 3, 2, 3, 2) — completely opaque to first-time users. Beginners can't tell if these are filters, counts, or something else. Add labels under each icon. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-326 |
| BL-0736 | E2E-334 🔴 visual — Toolbar has 12 icon-only tools at top of canvas — no labels, only icons. Hover-tooltip required to discover. ATtiny85 sidebar shows tag chips "DIP" and "8 PINS" in cyan — readable. Empty state has icon + "Empty Schematic" + "Add Component" button — well-done. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-334 |
| BL-0737 | E2E-341 🔴 visual — Sidebar shows "Board Manager" and "Serial Monitor" labels obscured/cut off — text truncated. Plus there are visual artifacts (icons that look misaligned, e.g. the chevron `>` after Board Manager). | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-341 |
| BL-0738 | E2E-348 🔴 visual — Sub-tabs OUTPUT / SERIAL MONITOR / LIBRARIES / BOARDS / PIN CONSTANTS / SIMULATE — "SIMULATE" is a tab here AND there's a Simulation TAB at workspace level. Two simulators? Confusing IA. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-348 |
| BL-0739 | E2E-358 🔴 visual — Board outline (yellow dashed) is rendered tiny in upper-left of huge empty canvas — board is 50x40mm but canvas zoom doesn't auto-fit on load. New users will think "PCB is broken / not showing". Auto-fit board to viewport on tab entry. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-358 |
| BL-0740 | E2E-364 🔴 visual — 3D board renders as a flat green parallelogram (no visible thickness). For an iso/perspective view this is wrong — board should show 1.6mm thickness depth. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-364 |
| BL-0741 | E2E-370 🔴 visual — 6 sub-tabs (Breadboard/Schematic/PCB/Metadata/Pin Table/SPICE) + 13 toolbar buttons = visually dense top bar. Two rows of tabs+toolbar squeeze into ~80px height. Group toolbar by purpose (cf. E2E-040). | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-370, E2E-040 |
| BL-0742 | E2E-377 🔴 visual — 17 sub-tabs in Procurement = horizontal-scroll tab strip. Even 11 visible at this width is overwhelming. Group as nested tabs: BOM (Management/Comparison/Templates) / Sourcing (Alternates/Live Pricing/Cost Optimizer/Order History) / Manufacturing (Assembly Cost/Risk/Groups/Mfg Validator/PCB Tracking) / Compliance (Risk Scorecard/AVL/Cross-Project/Supply Chain) / Personal Inventory. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-377 |
| BL-0743 | E2E-384 🔴 visual — Issue rows in Design Gateway use color tags (orange "power" / "signal" / "best-practice" / red severity dot). Hard to scan at a glance — same orange for "power" and severity is confusing. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-384 |
| BL-0744 | E2E-409 🔴 BUG (cf. E2E-266) — Cards look interactive but click does nothing. Visual affordance lies. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-409, E2E-266 |
| BL-0745 | E2E-426 🔴 visual — Tab body is mostly empty space (just `Storage Manager` + Scan/Labels buttons + filter input + "No BOM items to display."). Wastes a whole tab. Either consolidate with Procurement → Inventory or load it lazily on first BOM item. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-426 |
| BL-0746 | E2E-452 🔴 visual — No CTA on each lab card (no "Start Lab" button visible). User doesn't know what to do. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-452 |
| BL-0747 | E2E-456 🔴 visual — Massive empty space. Single snapshot card centered with vast dark area below. Should at least show grid background hint or version timeline placeholder. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-456 |
| BL-0748 | E2E-460 🔴 BUG REINFORCED (cf. E2E-298) — Entries are from "OmniTrek Nexus" project but I'm on Blink LED tab. Project scoping leak confirmed visually. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-460, E2E-298 |
| BL-0749 | E2E-471 🔴 visual — Generate button has dark teal styling — looks disabled. Should match other primary cyan CTAs (e.g. Schematic's `Add Component`). | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-471 |
| BL-0750 | E2E-481 🔴 P0 visual CONFIRMED — Both tabs render only a red "Failed to load X data" message + huge empty page. Catastrophic UX failure — user has no idea what's wrong, no retry, no link to setup. This is worse than the 401 console error (E2E-312/313); it's confirmed visually as broken. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-481, E2E-312 |
| BL-0751 | E2E-482 🔴 visual — Error message is small, centered, and red on dark background — barely visible. Use proper error toast + retry button. | OPEN | C2 | E2E walkthrough (pass-2-visual-flow-audience-critique) — refs E2E-482 |
| BL-0752 | E2E-614 🔴 visual GAP — When wire tool is active and cursor is over a hole, no visible "snap target" indicator (verified via DOM — no `wire-snap-preview` element appeared). Industry-standard: hovered hole gets a glowing ring + shows the rail/column ID. Without this, beginners click wrong holes. | OPEN | C2 | E2E walkthrough (pass-5-breadboard-wiring-component-play-workflow-e2e-611) — refs E2E-614 |
| BL-0753 | E2E-615 🔴 visual GAP — While dragging mid-wire, no rubber-band preview line following the cursor. User can't see where the wire will go until committed. | OPEN | C2 | E2E walkthrough (pass-5-breadboard-wiring-component-play-workflow-e2e-611) — refs E2E-615 |
| BL-0754 | E2E-616 🔴 visual GAP — After wire created, no visible color on the wire to indicate which net it joined. Real breadboards use red=VCC, black=GND, yellow=signal — ProtoPulse should auto-color wires by net role. | OPEN | C2 | E2E walkthrough (pass-5-breadboard-wiring-component-play-workflow-e2e-611) — refs E2E-616 |
| BL-0755 | E2E-619 🔴 BUG — Synthetic `pointerdown`+`pointerup` events on hole elements did NOT create a wire (wireEls count went up by 1 but `0 LIVE WIRES` text stayed). React handler may require a different event sequence (e.g. native `mousedown`+`mouseup` with PointerEvent isComposing flag, or React's synthetic event dispatcher). Worth verifying real-user clicks work in Playwright e2e. | OPEN | C2 | E2E walkthrough (pass-5-breadboard-wiring-component-play-workflow-e2e-611) — refs E2E-619 |
| BL-0756 | E2E-625 🔴 a11y — 830 hole elements with sequential testid (`hole-r:left_pos:0` etc.) but no aria-label on each. Screen reader users can't navigate by position. Add `aria-label="Power rail left_positive, position 5"`. | OPEN | C2 | E2E walkthrough (pass-5-breadboard-wiring-component-play-workflow-e2e-611) — refs E2E-625 |
| BL-0757 | E2E-626 🔴 BUG (CONFIRMED again) — Click on Starter Shelf does NOT add to canvas (E2E-571). Drag is the ONLY way. Beginners using touchpads will struggle. | OPEN | C2 | E2E walkthrough (pass-5-breadboard-wiring-component-play-workflow-e2e-611) — refs E2E-626, E2E-571 |
| BL-0758 | E2E-627 🔴 visual — When dragging a starter onto the canvas, no ghost preview of where it will land. (verified via observation; DOM didn't show preview elements during drag attempt.) Add semi-transparent component preview that snaps to grid. | OPEN | C2 | E2E walkthrough (pass-5-breadboard-wiring-component-play-workflow-e2e-611) — refs E2E-627 |
| BL-0759 | E2E-628 🔴 visual — During drag, no legality indicator — components shouldn't be droppable in the center channel (DIPs straddle it; passives can't go there). Show a red overlay on illegal positions during drag. | OPEN | C2 | E2E walkthrough (pass-5-breadboard-wiring-component-play-workflow-e2e-611) — refs E2E-628 |
| BL-0760 | E2E-642 🔴 visual GAP — `LIVE SIMULATION` toggle is in canvas header but tiny. When ON, what changes visually? Currents flow? LEDs glow? Verified untested. If it really runs Arduino sketches like Wokwi, this is a HUGE feature buried under a 14px label. | OPEN | C2 | E2E walkthrough (pass-5-breadboard-wiring-component-play-workflow-e2e-611) — refs E2E-642 |
| BL-0761 | E2E-646 🔴 NEEDS VERIFY — Undo/Redo for breadboard actions (place / move / wire / delete). Schematic has Ctrl+Z/Y. Breadboard needs same + verified to work cross-action. | OPEN | C2 | E2E walkthrough (pass-5-breadboard-wiring-component-play-workflow-e2e-611) — refs E2E-646 |
| BL-0762 | E2E-562 🔴 visual — Left workbench column is 9 sections + 8 stat tiles + 7 starter drops + 5 filter pills + parts list = ~25 distinct UI regions stacked vertically. Vertical scroll required even at 1200px height. Way too dense for one column. Split into 3 collapsible groups: Build (Workbench actions / Quick Intake / Starter Shelf / Component Placer) / AI (Bench AI card) / Health (Stats / Audit / Pre-flight). | OPEN | C2 | E2E walkthrough (pass-4-breadboard-lab-deep-dive-e2e-562-onwards) — refs E2E-562 |
| BL-0763 | E2E-563 🔴 visual — Stats tiles use 3×3 grid in a narrow column = each tile is tiny (~70×70px) with two text lines + number. Borderline unreadable on first glance. Either widen column or reduce to 4 most-important stats with "more" disclosure. | OPEN | C2 | E2E walkthrough (pass-4-breadboard-lab-deep-dive-e2e-562-onwards) — refs E2E-563 |
| BL-0764 | E2E-565 🔴 visual — On a fresh project, all stats are 0 except "TRACKED 1", "MISSING 1", "STARTER-SAFE 1". So "1 part is tracked but missing"? Stat semantics overlap and contradict (an item can be both tracked AND missing AND starter-safe simultaneously). Need a single semantic taxonomy. | OPEN | C2 | E2E walkthrough (pass-4-breadboard-lab-deep-dive-e2e-562-onwards) — refs E2E-565 |
| BL-0765 | E2E-571 🔴 BUG — Click on `breadboard-starter-led` registers but does NOT place a component on canvas. The "Drag a starter part…" hint persists. Starter Shelf is drag-only with no click-to-place affordance. Add a "click to add at next free position" alternative. | OPEN | C2 | E2E walkthrough (pass-4-breadboard-lab-deep-dive-e2e-562-onwards) — refs E2E-571 |
| BL-0766 | E2E-572 🔴 BUG (parallels E2E-091) — `Audit` button on empty board reports score 100/100 — Healthy — Board is healthy — no issues detected. An empty board can't be "healthy" — it's empty. Same false-positive class as Validation tab. | OPEN | C2 | E2E walkthrough (pass-4-breadboard-lab-deep-dive-e2e-562-onwards) — refs E2E-572, E2E-091 |
| BL-0767 | E2E-573 🔴 BUG — `Pre-flight Check` on empty board reports All clear — ready to build! — Voltage Rail Compatibility: pass / Decoupling Capacitors: pass / USB Power Budget: pass / ESP32 ADC2/WiFi Conflict: pass / Required Pin Connections: pass. Pre-flight checks pass on a project with NO components. Should report "Cannot pre-flight: no components placed". | OPEN | C2 | E2E walkthrough (pass-4-breadboard-lab-deep-dive-e2e-562-onwards) — refs E2E-573 |
| BL-0768 | E2E-578 🔴 visual — `tool-drc-toggle` and `tool-connectivity-explainer-toggle` — toggle state (on/off) not visually obvious without aria-pressed. | OPEN | C2 | E2E walkthrough (pass-4-breadboard-lab-deep-dive-e2e-562-onwards) — refs E2E-578 |
| BL-0769 | E2E-580 🔴 newbie — A first-time user sees 9 stats + 6 AI buttons + 5 workbench actions + Starter Shelf BEFORE the actual breadboard. Cognitive overload. Beginner mode should hide everything except Starter Shelf + canvas + Audit. | OPEN | C2 | E2E walkthrough (pass-4-breadboard-lab-deep-dive-e2e-562-onwards) — refs E2E-580 |
| BL-0770 | E2E-601 🔴 workflow — User flow "I want to build a Blink LED on real hardware": Architecture → add LED + Resistor + MCU → Schematic → wire pins → Breadboard → drag parts → drag wires → Audit → Build. 5 tab transitions for the simplest project. Need a single "Quick Build" mode that does all of it from a Starter Circuit one-click. | OPEN | C2 | E2E walkthrough (pass-4-breadboard-lab-deep-dive-e2e-562-onwards) — refs E2E-601 |
| BL-0771 | E2E-609 🔴 visual — Health pill top-right says "HEALTHY 100" in green even after I clicked LED starter (which didn't actually place — but if it had, the score should change). Visual signal is sticky/incorrect. | OPEN | C2 | E2E walkthrough (pass-4-breadboard-lab-deep-dive-e2e-562-onwards) — refs E2E-609 |


### Frontend E2E Walkthrough 2026-04-18 (batch triage, remaining 55 chunks)

> Second triage pass covering all remaining 🔴 findings from the 55 non-densest chunks.
> Total new BL items this batch: 83 (772 through 854).

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0772 | E2E-235 🔴 BUG (CONFIRMED) — 3D View board = 100×80 mm. PCB tab board = 50×40 mm. Same project, same circuit, two different board sizes. Source-of-truth split. | DONE (Plan 02 Phase 4, 2026-04-22) | C2 | E2E walkthrough (3d-view-meticulous) — refs E2E-235 |
| BL-0773 | E2E-236 🔴 BUG — Edit Board spinbuttons have `valuemax="0"` and `valuemin="0"` — invalid constraint range. Spinner up/down buttons disabled effectively. User can only manually type values; even then no validation. | OPEN | C2 | E2E walkthrough (3d-view-meticulous) — refs E2E-236 |
| BL-0774 | ## Alternates / Part Usage — 🔴 BROKEN | OPEN | C2 | E2E walkthrough (alternates-part-usage-broken) — refs — |
| BL-0775 | E2E-312 🔴 BUG (CRITICAL) — `/projects/30/part_alternates` shows "Failed to load alternates data". Console: 401 Unauthorized on `/api/parts/browse/alternates`. | OPEN | C2 | E2E walkthrough (alternates-part-usage-broken) — refs E2E-312 |
| BL-0776 | E2E-313 🔴 BUG (CRITICAL) — `/projects/30/part_usage` shows "Failed to load usage data". Console: 401 Unauthorized + "[API Query Error] Failed to fetch usage summary". | OPEN | C2 | E2E walkthrough (alternates-part-usage-broken) — refs E2E-313 |
| BL-0777 | E2E-019 🔴 BUG — Loading state showed `panel-skeleton` with empty text for ~3 seconds before content appeared. No loading spinner or "Loading…" label was visible to the user. | OPEN | C2 | E2E walkthrough (architecture-tab-tested) — refs E2E-019 |
| BL-0778 | E2E-078 🔴 BUG — `tool-analyze` button (Analyze design) does NOTHING visible when clicked with a node on canvas. No dialog, no panel update, no toast, no console error. Silent dead button. Severity P1. | OPEN | C2 | E2E walkthrough (architecture-tab-tested) — refs E2E-078 |
| BL-0779 | E2E-084 🔴 BUG — First context menu detected (6 empty items) — shadow menu present in DOM but with no labels. Suggests duplicated menu/portal mount. Investigate menu portal cleanup. | OPEN | C2 | E2E walkthrough (architecture-tab-tested) — refs E2E-084 |
| BL-0780 | E2E-298 🔴 BUG — Audit Trail shows entries from OmniTrek Nexus project on the Blink LED (Sample) project audit page. Project scoping broken — leaking other project's audit trail. | OPEN | C2 | E2E walkthrough (audit-trail-meticulous) — refs E2E-298 |
| BL-0781 | E2E-284 🔴 BUG (PATTERN) — All spinbuttons valuemax=0 (E2E-236/271 pattern recurring across many tabs). | OPEN | C2 | E2E walkthrough (calculators-meticulous-baby-step) — refs E2E-284, E2E-236 |
| BL-0782 | E2E-033 🔴 BUG? — Apply button label is `APPLY TO PROJECT` shouty caps; inconsistent with rest of app's title-case actions. | OPEN | C2 | E2E walkthrough (circuit-code-tab-tested) — refs E2E-033 |
| BL-0783 | E2E-266 🔴 BUG — Community card onclick is dead. Same pattern as Coach button (E2E-074). User clicks community card to view details / install — nothing happens. | OPEN | C2 | E2E walkthrough (community-meticulous-baby-step) — refs E2E-266, E2E-074 |
| BL-0784 | E2E-267 🔴 a11y — Cards have onclick but no role="button". Same systemic issue as Learn (E2E-261), Dashboard (E2E-068). | OPEN | C2 | E2E walkthrough (community-meticulous-baby-step) — refs E2E-267, E2E-261, E2E-068 |
| BL-0785 | E2E-210 🔴 BUG — Search filter doesn't apply to Favorites and Recently Used sections. Inconsistent. User searches "esp" but sees BME280 and LDO 3.3V at top — confusing. Fix: either filter ALL sections or hide non-matching sections entirely during search. | OPEN | C2 | E2E walkthrough (dashboard-meticulous) — refs E2E-210 |
| BL-0786 | E2E-015 🔴 BUG — Validation shows "All Checks Passing — No issues detected" on a project with 0 components, 0 connections, 0 BOM items. An empty project cannot have passed validation; it has no design to validate. Should show "No design yet" / "Add components to begin validation". | OPEN | C2 | E2E walkthrough (dashboard-tab-tested) — refs E2E-015 |
| BL-0787 | E2E-074 🔴 BUG (CONFIRMED) — `coach-help-button` opens nothing. Even via real DevTools click (full pointer-event sequence), button only takes focus — no popover, no menu, no console error. The Radix `<PopoverTrigger>` is wired but the `<PopoverContent>` either renders nothing or is conditionally hidden. Source: `client/src/pages/workspace/WorkspaceHeader.tsx:431`. Severity P1. | OPEN | C2 | E2E walkthrough (dashboard-tab-tested) — refs E2E-074 |
| BL-0788 | E2E-261 🔴 a11y — Article cards have `onclick` and `cursor:pointer` but no `role="button"` and no inner button/link. Invisible to screen readers. Same pattern as Dashboard cards (E2E-068). Systemic issue. | OPEN | C2 | E2E walkthrough (learn-meticulous-baby-step) — refs E2E-261, E2E-068 |
| BL-0789 | E2E-270 🔴 BUG (PATTERN) — Order PCB Width/Height = 100×80mm matches 3D View (100×80) but NOT PCB tab (50×40). Three different boards in same project: PCB / 3D / Order. Source-of-truth must converge. | DONE (Plan 02 Phase 4, 2026-04-22) | C2 | E2E walkthrough (order-pcb-meticulous-baby-step) — refs E2E-270 |
| BL-0790 | E2E-271 🔴 BUG (PATTERN) — All spinbuttons (Quantity, Width, Height, Min Trace, Min Drill) have `valuemax="0"` — broken constraint (E2E-236 pattern again). | OPEN | C2 | E2E walkthrough (order-pcb-meticulous-baby-step) — refs E2E-271, E2E-236 |
| BL-0791 | E2E-846 🔴 visual — Sub-panel tabs `Parts / Power / Sheets / Sim` are tiny (text-xs cyan icons) and easy to miss. They control ENTIRE panel content but visually look incidental. Make them prominent like Procurement's sub-tabs. | OPEN | C2 | E2E walkthrough (pass-10-schematic-tab-deep-dive-e2e-845) — refs E2E-846 |
| BL-0792 | E2E-848 🔴 visual — Toolbar has 14+ controls (6 tools + undo/redo + snap + grid + 3 angle radios + fit + kbd-shortcuts + net-browser). All cramped into one ~480px row. Group as `[Tools \| Edit \| View \| Help]` separated by visible dividers. | OPEN | C2 | E2E walkthrough (pass-10-schematic-tab-deep-dive-e2e-845) — refs E2E-848 |
| BL-0793 | E2E-849 🔴 visual — `Place Component` and `Place Power` buttons appear in toolbar BUT are perma-disabled with description "drag from Parts/Power panel". These are vestigial UI — either wire them up to enter "place mode" or remove from toolbar. | OPEN | C2 | E2E walkthrough (pass-10-schematic-tab-deep-dive-e2e-845) — refs E2E-849 |
| BL-0794 | E2E-856 🔴 BUG (E2E-225 confirmed) — `Add Component` empty-state button enters a click-to-place mode (X:600 Y:400 readout appears) BUT no part is pre-selected, so clicking the canvas places nothing. Confirmed during this pass: clicked part-34 in placer THEN Add Component THEN canvas — still 0 nodes. The "Add Component" CTA is functionally broken without a pre-selected part. | OPEN | C2 | E2E walkthrough (pass-10-schematic-tab-deep-dive-e2e-845) — refs E2E-856, E2E-225 |
| BL-0795 | E2E-857 🔴 GAP — Component placer has a `cursor-grab` class on each part item — indicates drag IS the intended interaction. But there's no click-to-add fallback like Architecture's `+` button. Inconsistent with Arch. | OPEN | C2 | E2E walkthrough (pass-10-schematic-tab-deep-dive-e2e-845) — refs E2E-857 |
| BL-0796 | E2E-862 🔴 GAP — No way to import existing schematic from the Schematic tab itself. Empty state suggests "or import an existing design" but no import button visible. | OPEN | C2 | E2E walkthrough (pass-10-schematic-tab-deep-dive-e2e-845) — refs E2E-862 |
| BL-0797 | E2E-866 🔴 newbie — Beginners hitting Schematic for first time face: "Drag a component", but can't tell which icon means draw-wire. Add a callout "Pull pins out into wires by dragging from the pin handles" for first-time visitors. | OPEN | C2 | E2E walkthrough (pass-10-schematic-tab-deep-dive-e2e-845) — refs E2E-866 |
| BL-0798 | E2E-876 🔴 GAP — When wire tool active, no visible net-name dropdown above cursor. KiCad shows "VCC" / "GND" / "NET-NAME" autocomplete for naming the net being drawn. | OPEN | C2 | E2E walkthrough (pass-11-schematic-wiring-component-play-e2e-874) — refs E2E-876 |
| BL-0799 | E2E-877 🔴 GAP — Wire color: schematic wires are typically uniform colored (industry standard: thin black line). But during sim should color-by-signal-state (high=red, low=blue). Verify. | OPEN | C2 | E2E walkthrough (pass-11-schematic-wiring-component-play-e2e-874) — refs E2E-877 |
| BL-0800 | E2E-879 🔴 GAP — Schematic doesn't visualize bus wires (multiple parallel signals as a single fat line). Industry standard for ribbon/SPI/data buses. | OPEN | C2 | E2E walkthrough (pass-11-schematic-wiring-component-play-e2e-874) — refs E2E-879 |
| BL-0801 | E2E-883 🔴 GAP — Click on Parts placer item (verified by `cursor-grab` class) suggests drag-only. Same as Breadboard E2E-571 — no click-to-place fallback. | OPEN | C2 | E2E walkthrough (pass-11-schematic-wiring-component-play-e2e-874) — refs E2E-883, E2E-571 |
| BL-0802 | E2E-884 🔴 GAP — During drag of a part, no ghost preview of where it will land + no rotation preview. | OPEN | C2 | E2E walkthrough (pass-11-schematic-wiring-component-play-e2e-874) — refs E2E-884 |
| BL-0803 | E2E-885 🔴 GAP — Parts panel's group header "MICROCONTROLLER 1" — clicking should filter list to only that category. Untested. | OPEN | C2 | E2E walkthrough (pass-11-schematic-wiring-component-play-e2e-874) — refs E2E-885 |
| BL-0804 | E2E-889 🔴 GAP — No multi-select marquee verified. KiCad essential. | OPEN | C2 | E2E walkthrough (pass-11-schematic-wiring-component-play-e2e-874) — refs E2E-889 |
| BL-0805 | E2E-890 🔴 GAP — No align tools for components. | OPEN | C2 | E2E walkthrough (pass-11-schematic-wiring-component-play-e2e-874) — refs E2E-890 |
| BL-0806 | E2E-895 🔴 GAP — On empty schematic, ERC presumably says "0 violations" — same false-positive risk as Audit (E2E-572). | OPEN | C2 | E2E walkthrough (pass-11-schematic-wiring-component-play-e2e-874) — refs E2E-895, E2E-572 |
| BL-0807 | E2E-947 🔴 visual — No power-symbol annotation on VCC/GND pins. Standard schematics show a `▲` "5V" or `⏚` ground symbol next to the pin. Missing visual cue makes new users confused which pins are power. | OPEN | C2 | E2E walkthrough (pass-12b-schematic-re-do-on-a-populated-canvas-e2e-942) — refs E2E-947 |
| BL-0808 | E2E-957 🔴 GAP — Coordinate readout "X: 750 Y: 400" appeared at canvas bottom — useful for power users but unlabeled (px? grid units?). Add unit suffix. | OPEN | C2 | E2E walkthrough (pass-12b-schematic-re-do-on-a-populated-canvas-e2e-942) — refs E2E-957 |
| BL-0809 | E2E-483 🔴 systemic — Top toolbar overload. ~32 icon-only buttons in tight cluster, no labels, no group separation. New users panic, experts can't tell modes. Group by purpose (workspace / view / collab / help / mode) with inline labels by default + a "Compact" toggle. | OPEN | C2 | E2E walkthrough (pass-2-app-wide-critique-cross-tab-themes) — refs E2E-483 |
| BL-0810 | E2E-484 🔴 systemic — Tab strip overflow. 35 tabs requires horizontal scroll. Show only top 8-10 + an "All Tabs" overflow drawer, OR collapse into vertical sidebar like VS Code. | OPEN | C2 | E2E walkthrough (pass-2-app-wide-critique-cross-tab-themes) — refs E2E-484 |
| BL-0811 | E2E-485 🔴 systemic — Confidence labels self-contradict in 4+ places ("Evidence strong" + "SETUP REQUIRED" / "All Checks Passing" + "128 issues"). Pick ONE source of truth. | OPEN | C2 | E2E walkthrough (pass-2-app-wide-critique-cross-tab-themes) — refs E2E-485 |
| BL-0812 | E2E-492 🔴 systemic — Beginner mode (Student) doesn't visibly change UI. Promised "simpler" but nothing different from Hobbyist mode in this audit. Verify mode actually does something. | OPEN | C2 | E2E walkthrough (pass-2-app-wide-critique-cross-tab-themes) — refs E2E-492 |
| BL-0813 | E2E-493 🔴 systemic — AI Assistant collapsed sidebar (right side, vertical text "AI ASSISTANT") is a key feature buried as a slim strip. Make it a clear floating chat icon like ChatGPT. | OPEN | C2 | E2E walkthrough (pass-2-app-wide-critique-cross-tab-themes) — refs E2E-493 |
| BL-0814 | E2E-499 🔴 UX — Lots of "E2E Test Project" duplicates from my testing — no way to filter or bulk-delete. Add multi-select + "Delete N selected". | OPEN | C2 | E2E walkthrough (pass-3-missed-sections-competitive-innovation-e2e-497-onwards) — refs E2E-499 |
| BL-0815 | E2E-502 🔴 P0 BUG — `/settings` returns 404 Page Not Found. The Settings gear icon at bottom of left sidebar is presumably the entry point but the route doesn't exist. Either route is wrong or page never built. | OPEN | C2 | E2E walkthrough (pass-3-missed-sections-competitive-innovation-e2e-497-onwards) — refs E2E-502 |
| BL-0816 | E2E-505 🔴 visual — Sidebar groups (design / analysis / hardware / etc.) exist in DOM but no visible group separators or labels. Beginners can't see structure. Add expandable group headers (cf. VS Code Activity Bar). | OPEN | C2 | E2E walkthrough (pass-3-missed-sections-competitive-innovation-e2e-497-onwards) — refs E2E-505 |
| BL-0817 | E2E-508 🔴 visual — When collapsed, AI Assistant is a 24px vertical strip with rotated text — most users will never discover it. Add a floating chat-bubble icon at bottom-right (industry standard cf. Intercom, Crisp). | OPEN | C2 | E2E walkthrough (pass-3-missed-sections-competitive-innovation-e2e-497-onwards) — refs E2E-508 |
| BL-0818 | E2E-513 🔴 visual UNVERIFIED — Workspace Mode (Student / Hobbyist / Pro) — no visible UI difference observed across modes. If mode is supposed to hide tabs / labels / advanced features, the implementation isn't visible. Either deliver the difference or remove the picker. | OPEN | C2 | E2E walkthrough (pass-3-missed-sections-competitive-innovation-e2e-497-onwards) — refs E2E-513 |
| BL-0819 | E2E-520 🔴 UX — Mobile bottom nav has only 5 items — but the desktop has 35 tabs. Mobile users get a tiny subset; rest are inaccessible. | OPEN | C2 | E2E walkthrough (pass-3-missed-sections-competitive-innovation-e2e-497-onwards) — refs E2E-520 |
| BL-0820 | E2E-556 🔴 newbie journey — A first-time user lands at `/projects` and sees "Select a project to continue." There's no "Take a tour" button. They have to click a Sample to start. Add an above-the-fold "New here? Watch 2 min intro" video. | OPEN | C2 | E2E walkthrough (pass-3-missed-sections-competitive-innovation-e2e-497-onwards) — refs E2E-556 |
| BL-0821 | E2E-558 🔴 newbie → first PCB journey — From empty project to ordering a PCB requires: Architecture → add nodes → Schematic → push to PCB → place components → route traces → DRC → Order PCB → 5-step wizard. No guided wizard for "Build my first PCB end to end" — should be the killer first-week experience. | OPEN | C2 | E2E walkthrough (pass-3-missed-sections-competitive-innovation-e2e-497-onwards) — refs E2E-558 |
| BL-0822 | E2E-744 🔴 visual — Asset Library category icons row at top of sidebar (`A-Z 12 2 3 2 3 2`) is completely opaque — bare numbers + sort glyph with no labels. Beginners can't decode. | OPEN | C2 | E2E walkthrough (pass-7-architecture-tab-deep-dive-e2e-743) — refs E2E-744 |
| BL-0823 | E2E-747 🔴 visual — On a freshly-loaded canvas with 4 nodes, nodes are spread randomly with no obvious layout. No auto-layout triggered after add. Should auto-arrange (force-directed, hierarchical, or grid). | OPEN | C2 | E2E walkthrough (pass-7-architecture-tab-deep-dive-e2e-743) — refs E2E-747 |
| BL-0824 | E2E-756 🔴 BUG (carries E2E-078) — `tool-analyze` button does nothing on click. Same dead-button as before. | OPEN | C2 | E2E walkthrough (pass-7-architecture-tab-deep-dive-e2e-743) — refs E2E-756, E2E-078 |
| BL-0825 | E2E-760 🔴 UX — Asset Library shows "BME280" THREE times (Favorites, Recently Used, main list) even though same part. Visually noisy. | OPEN | C2 | E2E walkthrough (pass-7-architecture-tab-deep-dive-e2e-743) — refs E2E-760 |
| BL-0826 | E2E-761 🔴 UX — Adding the same part 3x adds 3 separate nodes (verified earlier that Components count went 1→4). Architecture allows duplicate components; Schematic/PCB will multiply pin nets accordingly. Worth clarifying in UI ("Add another instance" vs "Increase quantity"). | OPEN | C2 | E2E walkthrough (pass-7-architecture-tab-deep-dive-e2e-743) — refs E2E-761 |
| BL-0827 | E2E-771 🔴 newbie — A first-time user sees "drag from sidebar to canvas, click + button" — both work but neither is obvious. Onboarding callout needed. | OPEN | C2 | E2E walkthrough (pass-7-architecture-tab-deep-dive-e2e-743) — refs E2E-771 |
| BL-0828 | E2E-774 🔴 expert — Power user wants keyboard-only architecture creation: `N` adds node, arrow keys move, `E` enters edge mode. Currently mouse-required. | OPEN | C2 | E2E walkthrough (pass-7-architecture-tab-deep-dive-e2e-743) — refs E2E-774 |
| BL-0829 | E2E-779 🔴 visual GAP — Pin handles are tiny dots on top/bottom of node (8px). Hard to grab. Should grow to 16px on hover. | OPEN | C2 | E2E walkthrough (pass-8-architecture-node-edge-interaction-e2e-779) — refs E2E-779 |
| BL-0830 | E2E-780 🔴 visual GAP — When hovering near a handle ready to drag-connect, no visible "I can connect from here" indicator. Industry standard: the handle pulses. | OPEN | C2 | E2E walkthrough (pass-8-architecture-node-edge-interaction-e2e-779) — refs E2E-780 |
| BL-0831 | E2E-781 🔴 visual GAP — During edge drag (handle → empty space), no preview line follows the cursor (verified via observation). | OPEN | C2 | E2E walkthrough (pass-8-architecture-node-edge-interaction-e2e-779) — refs E2E-781 |
| BL-0832 | E2E-782 🔴 visual GAP — Edge endpoints hint at "data flow direction" but ProtoPulse has no obvious arrowhead style — undirected vs directed unclear. | OPEN | C2 | E2E walkthrough (pass-8-architecture-node-edge-interaction-e2e-779) — refs E2E-782 |
| BL-0833 | E2E-791 🔴 GAP — No visible multi-select marquee. Same gap as Breadboard (E2E-635). | OPEN | C2 | E2E walkthrough (pass-8-architecture-node-edge-interaction-e2e-779) — refs E2E-791, E2E-635 |
| BL-0834 | E2E-792 🔴 GAP — No align tools (left/right/center/distribute) — Figma essentials. | OPEN | C2 | E2E walkthrough (pass-8-architecture-node-edge-interaction-e2e-779) — refs E2E-792 |
| BL-0835 | E2E-796 🔴 GAP — No net browser for architecture. If 12 nodes share VCC, that's invisible. Add side panel showing all "nets" + click-to-highlight. | OPEN | C2 | E2E walkthrough (pass-8-architecture-node-edge-interaction-e2e-779) — refs E2E-796 |
| BL-0836 | E2E-797 🔴 GAP — No dependency visualization — what depends on what? Power flow? Data flow? Add a `tool-dependency-trace`. | OPEN | C2 | E2E walkthrough (pass-8-architecture-node-edge-interaction-e2e-779) — refs E2E-797 |
| BL-0837 | E2E-801 🔴 GAP — No "Try alternate component" — select an LDO, click "Alternates" → see a list of swap candidates with cost/efficiency comparison. | OPEN | C2 | E2E walkthrough (pass-8-architecture-node-edge-interaction-e2e-779) — refs E2E-801 |
| BL-0838 | E2E-228 🔴 BUG (board size mismatch) — PCB tab shows board 50×40 mm. 3D View tab default board 100×80 mm. Two different defaults for same project's board. | DONE (Plan 02 Phase 4, 2026-04-22) | C2 | E2E walkthrough (pcb-meticulous) — refs E2E-228 |
| BL-0839 | E2E-233 🔴 BUG — After switching to 4-layer, the right-side "Layers" visibility panel still shows only F.Cu / B.Cu / Board Outline. The 2 new inner layers (Ground, Power) are not toggleable. User can't visualize/hide internal layers. | OPEN | C2 | E2E walkthrough (pcb-meticulous) — refs E2E-233 |
| BL-0840 | E2E-244 🔴 BUG (test methodology) — Sequential `fill_form` of 5 fields timed out and produced corrupted state ("oBrME280" — keystrokes interleaved). May indicate a React controlled-input race or the testing tool issue. To re-verify with manual keystrokes. | OPEN | C2 | E2E walkthrough (procurement-meticulous) — refs E2E-244 |
| BL-0841 | E2E-006 🔴 a11y — Procurement panel content is invisible to a11y tree. take_snapshot returns only toolbar+tabs+chat panel for this view; entire tabpanel with BOM table not exposed. Screen readers will see an empty page. evaluate_script confirms DOM content exists (87004 bytes innerHTML in main). Likely cause: tabpanel divs have no aria-labelledby and contain custom role-less elements. Same likely affects all 16 other procurement sub-tabs. | OPEN | C2 | E2E walkthrough (procurement-tab-tested) — refs E2E-006 |
| BL-0842 | 🔴 BUG — broken behavior | OPEN | C2 | E2E walkthrough (tl-dr-top-opportunities-ux-idea) — refs — |
| BL-0843 | \| E2E-298 \| 🔴 P0 \| Audit Trail \| Leaks audit entries from OTHER projects (OmniTrek Nexus shown on Blink LED tab) \| Add project_id filter in `/api/audit/*` query \| | OPEN | C2 | E2E walkthrough (tl-dr-top-p0-p1-bugs-action-items) — refs E2E-298 |
| BL-0844 | \| E2E-312 \| 🔴 P0 \| Alternates \| "Failed to load" — 401 on `/api/parts/browse/alternates` \| Add `/api/parts/browse/` to `PUBLIC_API_PATHS` (server/request-routing.ts) OR scope auth \| | OPEN | C2 | E2E walkthrough (tl-dr-top-p0-p1-bugs-action-items) — refs E2E-312 |
| BL-0845 | \| E2E-313 \| 🔴 P0 \| Part Usage \| "Failed to load" — 401 on `/api/parts/browse/usage` \| Same fix as E2E-312 \| | OPEN | C2 | E2E walkthrough (tl-dr-top-p0-p1-bugs-action-items) — refs E2E-313, E2E-312 |
| BL-0846 | \| E2E-091/093 \| 🔴 P0 \| Validation/Dashboard \| Validation reports 128 issues on a 1-component project; Dashboard simultaneously says "All Checks Passing" \| Two distinct bugs: (a) DRC false positives at empty-design state, (b) reconcile dashboard summary with validation engine \| | OPEN | C2 | E2E walkthrough (tl-dr-top-p0-p1-bugs-action-items) — refs E2E-091 |
| BL-0847 | \| E2E-074 \| 🔴 P1 \| Workspace toolbar \| Coach & Help button popover renders nothing (TutorialMenu Suspense fallback or empty?) \| Investigate `client/src/pages/workspace/WorkspaceHeader.tsx:431` + `TutorialMenu` lazy chunk \| | OPEN | C2 | E2E walkthrough (tl-dr-top-p0-p1-bugs-action-items) — refs E2E-074 |
| BL-0848 | \| E2E-078 \| 🔴 P1 \| Architecture \| `tool-analyze` button is dead \| Wire up Analyze tool handler \| | OPEN | C2 | E2E walkthrough (tl-dr-top-p0-p1-bugs-action-items) — refs E2E-078 |
| BL-0849 | \| E2E-228/235/270 \| 🔴 P1 \| PCB/3D View/Order PCB \| THREE different default board sizes for same project (50×40 / 100×80 / 100×80) \| Single source-of-truth for board geometry \| | DONE (Plan 02 Phase 4, 2026-04-22) | C2 | E2E walkthrough (tl-dr-top-p0-p1-bugs-action-items) — refs E2E-228 |
| BL-0850 | \| E2E-236/271/284 \| 🔴 P1 \| 3D View/Order PCB/Calculators \| Spinbutton constraints `valuemax=0` system-wide — can't increment \| Audit all spinbutton wiring; valid range needed \| | OPEN | C2 | E2E walkthrough (tl-dr-top-p0-p1-bugs-action-items) — refs E2E-236 |
| BL-0851 | \| E2E-233 \| 🔴 P1 \| PCB \| Layer visibility panel doesn't show inner layers when 4+ layer preset selected \| Sync visibility panel with stack layer count \| | OPEN | C2 | E2E walkthrough (tl-dr-top-p0-p1-bugs-action-items) — refs E2E-233 |
| BL-0852 | \| E2E-266 \| 🔴 P1 \| Community \| Card click is dead — no detail / install / add \| Wire onclick to detail dialog or `/api/community/component/:id` route \| | OPEN | C2 | E2E walkthrough (tl-dr-top-p0-p1-bugs-action-items) — refs E2E-266 |
| BL-0853 | E2E-091 🔴 BUG — 128 issues on a 1-component project (32 errors + 96 warnings). The validation engine is firing rules against an empty design as if there's a full circuit. Either (a) DRC runs heuristic over EVERYTHING regardless of placement, or (b) Issue counts are static demo numbers. | OPEN | C2 | E2E walkthrough (validation-tab-tested-revealed-by-clicking-coach-help-dynamic-tab) — refs E2E-091 |
| BL-0854 | E2E-093 🔴 BUG — Dashboard validation card said "All Checks Passing — No issues detected" yet Validation tab shows 128 issues. Direct contradiction between two views of the same data. | OPEN | C2 | E2E walkthrough (validation-tab-tested-revealed-by-clicking-coach-help-dynamic-tab) — refs E2E-093 |
| BL-0855 | **`/extract` must also read `ops/queue/user-suggestions.md`** — `vault-inbox` skill writes user-surfaced note suggestions to a separate queue (`ops/queue/user-suggestions.md`) distinct from `ops/queue/gap-stubs.md`. **RESOLVED 2026-04-19**: `.claude/skills/extract/SKILL.md` Queue-Aware Batch Mode section added — spec's (a) priority ladder (gap-stubs HIGH → user-suggestions LOW gated), (b) 4-item moderation checklist that promotes `pending-review` → `approved`/`rejected` with rejection reason, (c) `--include-user-queue` + `--batch` + `--limit` flags, (d) non-blocking rule (user-suggestion failure doesn't halt gap-stub run). Implementation details live in the skill's natural-language spec; the /extract fork subagent interprets + executes at invocation time. | DONE (spec) | C2 | vault-inbox smoke test 2026-04-19 |
| BL-0856 | **`/extract` skill must emit v2-schema-compliant frontmatter** — 2026-04-19 T4 content push landed 62 new notes via 8 `/extract` runs; 60/62 initially failed `/vault-quality-gate` (description >140, topics wrapped in `[[...]]`, non-standard `type`, confidence/provenance mismatch). **RESOLVED 2026-04-19**: (a) `.claude/skills/vault-validate/scripts/remediate-v2-frontmatter.py` ships in-place remediation (idempotent; all 62 notes now 0 schema errors), (b) `.claude/skills/extract/SKILL.md` Step 7.b+c rewritten with v2 schema table + mapping for nuanced type categories (methodology→pattern, concept→reference, etc.) + fallback rule (`type: reference, confidence: supported` when uncertain). Remaining warnings (body-has-claim-section, body-has-application-section) are pedagogy polish, not compliance. | DONE (Session 7) | C3 | /vault-quality-gate dry-run 2026-04-19 on 62 extracted notes |
| BL-0857 | **Vault MOC auto-stub cleanup** — 5 new MOCs created this session (`moc-a11y-wcag-aria`, `moc-electronics-math`, `moc-component-metadata-fields`, `backend-persistence-patterns`, `wcag`) — some overwrote auto-generated stubs from the `auto-create-parent-moc.sh` hook. Audit the hook's stub-generation output vs hand-curated MOC quality. **RESOLVED 2026-04-19** (hook template): bumped to v2-compliant frontmatter — description ≤140 chars (truncated on source-stem length), topic parser now handles both v1 `[[wrapped]]` and v2 bare-slug formats, `name:` field populated. Residual cleanup: `knowledge/[dev-infrastructure.md` + `knowledge/wcag.md` still carry `auto_generated: true` — `/connect` will promote in next pass. | DONE (hook fix) | C2 | T4 content push 2026-04-19 |
| BL-0858 | **Plan↔Vault slug name drift** — 2026-04-19 session-7 audit on 14 Vault Integration subsections: only 11/93 (12%) cited slugs resolve exactly to a `knowledge/<slug>.md` file. Most misses are (a) legitimate seed gaps awaiting `/vault-gap` + `/extract` (expected), but (b) ~5-10 are NAME DRIFT: plan cites `wcag-2-1-sc-1-4-1-color-cannot-be-sole-channel` but extract produced `...-for-meaning` suffix; plan cites `awg-vs-mm2-wire-sizing` vs extracted `awg-vs-mm2-wire-sizing-logarithmic-conversion`. Fix options: (1) ship fuzzy-matcher that suggests corrections + auto-updates plan subsections; (2) add `aliases: []` frontmatter to notes so short-form slugs resolve; (3) teach `/extract` to emit the plan's requested slug verbatim when it's provided in the origin stub. Option 3 is most robust long-term. | OPEN | C2 | Slug-resolution audit 2026-04-19 (93 cited, 11 resolved) |
| BL-0859 | **Calculator slug collisions (pedagogically misleading)** — 2026-04-19 final-review finding on `CalculatorsView.tsx`: (a) RcTimeConstantCard and FilterCutoffCard both point to `rc-lowpass-cutoff-frequency-1-over-2-pi-rc` — student hovering the tau calculator sees a note titled "cutoff frequency", misleading. Need `rc-time-constant-tau-equals-r-times-c` note. (b) PowerDissipationCard points to `ohms-law-v-equals-i-times-r-derivation` — related but warrants `power-dissipation-p-equals-i-squared-r` note. Fix: file `/vault-gap` stubs for both; `/extract` the new notes; swap slugs in CalculatorsView (2 lines per swap). | OPEN | C2 | Session-7 wave-completion review 2026-04-19 |
| BL-0860 | **Vault-primitive icon convention (BookOpen vs Info)** — 2026-04-19 final-review finding: early pilots split icons between `Info` (BomToolbar before fix) and `BookOpen` (CalculatorsView, DRCPanel-adjacent). Fixed BomToolbar to `BookOpen` (2026-04-19 commit `8fec8c8d`). Document the convention in `docs/design-system/vault-primitives.md`: ALWAYS `BookOpen` for vault pedagogy triggers unless the consumer is an error/warning context where `Info` or `AlertCircle` is already in use. Add to JSDoc on `<VaultHoverCard>` + `<VaultExplainer>` so copy-pasters see it at the type level. | OPEN | C1 | Session-7 wave-completion review 2026-04-19 |
| BL-0861 | **Extract `<VaultInfoIcon>` shared component (DRY threshold reached)** — 2026-04-19 Task 62 code review: 12 consumers of the `<VaultHoverCard>` primitive all replicate the same 5-prop trigger span. **RESOLVED 2026-04-22**: shipped `client/src/components/ui/vault-info-icon.tsx` (commit `b269a83a` follow-up) + migrated 5 BookOpen-icon consumers (BomToolbar, CalculatorsView 6 cards, ArduinoToolbar, BaudRateSelector, DCAnalysisPanel, GenerativeDesignView 2 labels). Non-icon consumers (BreadboardPartInspector, LifecycleBadge, KnowledgeView, DashboardView, AssetGrid) intentionally stay on VaultHoverCard/VaultExplainer — different usage shapes. CI whitelist updated to 8 allowed consumers. Net -39 lines across 6 files. | DONE (2026-04-22) | C1 | Task 62 code review 2026-04-19 |
| BL-0862 | **Shared `createTestQueryClient()` test utility** — 2026-04-19 Task 62 code review: 4 test files each invented their own inline `QueryClient` with 3 different config variants. **RESOLVED 2026-04-22**: shipped `client/src/test-utils/createTestQueryClient.ts` (commit `5213f877`) + migrated all 4 callers (GenerativeDesignView, ArchitectureView, storage-manager, CircuitCodeView). 44/44 tests green. CircuitCodeView gained `gcTime: 0` (previously missing); no regressions. Net -19 lines. | DONE (2026-04-22) | C1 | Task 62 code review 2026-04-19 |
| BL-0863 | **Audit trail backend subsystem — build end-to-end** — 2026-04-22 Plan 01 Phase 1 execution revealed: no `server/routes/audit.ts`, no `auditEvents` Drizzle table, no `/api/audit/*` endpoints, no `server/middleware/`, no `useCurrentProject` hook. `client/src/components/views/AuditTrailView.tsx` renders a hardcoded `DEMO_ENTRIES` constant (lines 45-102) with 5 fake entries — one labeled "OmniTrek Nexus" which is the root of E2E-298/E2E-460 ("leak"). **Narrow fix landed in Plan 01 Phase 1 REVISED:** remove DEMO_ENTRIES, render empty-state placeholder until real API ships. **This BL covers the FULL subsystem build:** (1) Drizzle table `audit_events` with projectId/userId/action/entity columns + migration; (2) `server/storage/audit-storage.ts` with scoped `listEvents()`; (3) `server/routes/audit.ts` with GET/POST handlers behind `requireAuth` + new `requireProjectScope` middleware (`server/middleware/project-scope.ts`); (4) client `useCurrentProject` hook (also needed by other plans) + AuditTrailView refactor to `useQuery(['audit-events', projectId])`; (5) supertest + Playwright regression coverage. Estimated C4 (multi-day); own plan under `docs/superpowers/plans/`. | OPEN | C4 | Plan 01 Phase 1 execution discovery 2026-04-22 |
| BL-0864 | **Generic `requireProjectScope` middleware generalization (E2E-546)** — 2026-04-22 Plan 01 Phase 1 revised scope: the generic query-param project-scope middleware originally spec'd for Phase 1/Task 1.6-1.8 doesn't fit current codebase because `/api/comments` already uses `/api/projects/:projectId/comments` path-param style (see `server/routes/comments.ts:24`). Before building the middleware, survey ALL `app.get` list endpoints across `server/routes/` and categorize: (a) path-param scoped (leave alone), (b) query-param project-scoped (candidates for new middleware), (c) global/aggregate (no scoping needed). Then implement middleware only if category (b) has real members. Deferred from Plan 01 until BL-0863 lands (audit endpoints will be the first real consumer). | OPEN | C2 | Plan 01 Phase 1 execution discovery 2026-04-22 |
| BL-0866 | **Pre-existing test suite drift — 49 failures across 10 files discovered 2026-04-22** — audit during Plan 01 eslint-unblock (BL-0865 verification) surfaced this; NOT caused by zve upgrade (logs from 2026-04-11 show same files green). Failures: (a) `server/__tests__/settings-routes.test.ts` — 2 fails, test sends `provider: 'anthropic'` but commit `855b1626` on 2026-04-18 removed `'anthropic'` from the schema enum; fix = change test to use `'gemini'`. (b) `server/__tests__/ai.test.ts` — 2 fails, assertion-order issue with API key redaction (sk-ant..., AIzaSy...). (c) `scripts/__tests__/check-api-types.test.ts` — 2 fails, `npx tsx script/generate-api-types.ts` throws. (d) `client/src/__tests__/a11y.test.tsx` — 20 fails (!) across multiple views: DashboardView "history is not iterable", ArchitectureView missing TooltipProvider, BreadboardView+ProcurementView missing useBom mock, CircuitCodeView "Worker is not defined", ArduinoWorkbenchView cannot read .find. (e) Various ECONNREFUSED 127.0.0.1:3000 — tests expect live dev server. (f) `client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx` — 10/10 failing. (g) lifecycle-badges-integration, collaboration-crdt-integration, procurement-sub-components each have a few fails. Per Tyler's "fix everything" rule these all need attention, but triaging multi-file drift is its own dedicated task. Should split into smaller BLs per file when prioritized. **SPLIT 2026-05-09 → BL-0872 (settings-routes), BL-0873 (ai test), BL-0874 (check-api-types), BL-0875 (a11y cluster — 20 fails), BL-0876 (ECONNREFUSED), BL-0877 (BreadboardPartInspector trustTier — 10 fails), BL-0878 (misc tail).** This umbrella entry remains for historical context. | SPLIT | C3 | BL-0865 eslint verification 2026-04-22 |
| BL-0867 | **`MentionBadge` Popover+Tooltip nesting replicates E2E-074 bug** — 2026-04-22 Plan 02 Phase 1 discovery while fixing `coach-help-button`: `client/src/components/ui/MentionBadge.tsx:99-107` uses the broken nesting `<Popover><PopoverTrigger asChild><StyledTooltip><button>`. Radix `PopoverTrigger asChild` tries to forward ref/handlers into `StyledTooltip` (a function component whose internal `TooltipTrigger asChild` wraps the button with its own Slot), so the popover's click handler never reaches the button. Symptom: clicking the mentions bell icon in the workspace header does not open the mentions popover. **Fix:** invert to the idiomatic codebase pattern (`ExplainPanelButton.tsx:33-46`, `SidebarHeader.tsx:28-40`, and now the Plan 02 Phase 1 fix to WorkspaceHeader `coach-help-button`): `<Popover><StyledTooltip><PopoverTrigger asChild><button>`. Also add `type="button"` to the underlying button. Add a Playwright regression mirroring `e2e/p1-coach-popover.spec.ts`. | OPEN | C1 | Plan 02 Phase 1 discovery 2026-04-22 |
| BL-0868 | **Breadboard `color-contrast` axe rule disabled pending Plan 03 Phase 9 tokens** — 2026-04-23 Plan 03 Phase 5 (E2E-494) axe-core Playwright scan authored `e2e/p1-a11y-scan.spec.ts` + `e2e/a11y-helpers.ts`. Breadboard decorative rails (power strip red/blue, tie-point backgrounds) produced color-contrast noise that is a function of the current Tailwind palette rather than markup. Phase 9 added `--color-focus-ring` (commit `18e21b22`) but that token targets focus indication, not the decorative rail/tie-point backgrounds. Action: a dedicated breadboard-palette pass that raises decorative-element contrast OR suppresses them from the axe scan more narrowly (via `.exclude('.breadboard-rail')` etc.). Then re-enable the rule in `e2e/p1-a11y-scan.spec.ts:102`. | OPEN | C2 | Plan 03 Phase 5 execution 2026-04-23 |
| BL-0869 | **Breadboard tie-points intentionally not keyboard-focusable (design decision)** — 2026-04-23 Plan 03 Phase 7 (E2E-625, commit `e1788677`) added aria-labels to 830 tie-point `<circle>` elements but deliberately did NOT add `tabIndex={0}` — 830 sequential tab stops would be unusable. Phase 6 keyboard-nav suite (`e2e/p1-keyboard-nav.spec.ts`) references this BL in its skip comments. **Future action:** design a grid-based keyboard navigation model (arrow keys move between holes, Space selects, Escape exits) similar to a spreadsheet; single tabIndex on the breadboard grid container + internal arrow-key handler. Depends on a per-canvas focus-manager pattern. | OPEN | C3 | Plan 03 Phase 7 / Phase 6 coordination 2026-04-23 |
| BL-0870 | **3D viewer keyboard-navigation story (E2E-554 follow-up)** — 2026-04-23 Plan 03 Phase 6 keyboard-nav suite (`e2e/p1-keyboard-nav.spec.ts`) skips the `viewer_3d` tab — Three.js canvas is pointer-only today. Action: design a camera-controller that responds to arrow keys (orbit), WASD (pan), `+/-` (zoom), `R` (reset) with conventions from Blender / Fusion. Announce camera actions via `aria-live` region for screen-reader users. Removes the `test.skip` in `p1-keyboard-nav.spec.ts:150`. | OPEN | C4 | Plan 03 Phase 6 execution 2026-04-23 |
| BL-0865 | **ESLint blocked by zod-validation-error@3.5.4 missing `/v4` subpath** — 2026-04-22 Plan 01 execution: `npx eslint .` fails at startup with `ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './v4' is not defined by "exports" in .../zod-validation-error/package.json`. Root cause: `eslint-plugin-react-hooks@7.0.1` calls `require('zod-validation-error/v4')` at runtime (see `node_modules/eslint-plugin-react-hooks/cjs/eslint-plugin-react-hooks.development.js:20`), and its peer-range `^3.5.0 \|\| ^4.0.0` allows either, but only the `^4.x` line ships the `/v4` subpath (`zod-validation-error@3.5.4` does not). Project is pinned to `zod-validation-error: ^3.4.0` in `package.json` line 125. **Fix:** bump `zod-validation-error` to `^4.0.2`, then in all 18 source files that import `from 'zod-validation-error'` (server/routes/*.ts mostly, including parts.ts:18, validation.ts:3, chat-branches.ts:3, design-preferences.ts:3, component-lifecycle.ts:2, projects.ts:2, agent.ts:3, bom-templates.ts:14, settings.ts:5, architecture.ts:3, design-history.ts:3, knowledge-vault.ts:15, arduino.ts:4, components.ts:3, rag.ts:3, pcb-zones.ts:2) change the import to `from 'zod-validation-error/v3'` because the project still uses Zod 3 (v4 subpath uses `zod/v4/core` types). Verify `npm run check` + `npm test` still green after the bump. This is BLOCKING the eslint quality gate for Plan 01 Phase 2+. **DONE 2026-05-09**: verified `package.json` pins `^4.0.2`, all 39 codebase imports use `from 'zod-validation-error/v3'`, zero bare imports, zero `/v4` imports — fix landed sometime between 2026-04-22 and 2026-05-09. | DONE | C1 | Plan 01 Phase 2 dispatch 2026-04-22 |
| BL-0871 | **PP-NLM `pp-codebase` notebook is empty in NotebookLM cloud despite manifest claiming population** — 2026-05-09 Phase 12 verification (PP-NLM Notesbook): `nlm source list pp-codebase --quiet \| wc -l` returns 0 sources. Source-manifest at `~/.claude/state/pp-nlm/source-manifest.json` has entries for pp-codebase but the cloud notebook is empty — manifest-vs-cloud divergence. **Cannot rerun `populate-codebase.sh` while `populate-hardware.sh` (PID 31395 at 1h29m elapsed, ~10-13h remaining) is in flight** because both scripts read/write `source-manifest.json` non-atomically and would race. Action sequence: (1) wait for populate-hardware.sh PID 31395 to exit (tail `~/.claude/logs/pp-nlm-full-population.log` for "finished"); (2) verify pp-codebase still 0 — `nlm source list pp-codebase --quiet \| wc -l`; (3) re-run `bash scripts/pp-nlm/populate-codebase.sh` (idempotent against manifest); (4) confirm count ≥ 30; (5) reconcile manifest if needed. Blocks final §16 verification suite for Phase 12. | OPEN | C5 | Phase 12 verification 2026-05-09 |
| BL-0872 | **settings-routes test failures (2 of BL-0866 cluster)** — `server/__tests__/settings-routes.test.ts` 2 fails. Test sends `provider: 'anthropic'` but commit `855b1626` (2026-04-18) removed `'anthropic'` from the schema enum. **Fix:** change test fixture to use `'gemini'` (or whatever provider remains in the enum). Single-file scope. **DONE 2026-05-09**: 5 fixture sites updated (mockResolvedValue + toEqual now `['gemini', 'jlcpcb']`; POST bodies use `provider: 'gemini'`; DELETE URL uses `/api/settings/api-keys/gemini`). Verified: `npx vitest run server/__tests__/settings-routes.test.ts` → **14/14 passing in 1.3s**. | DONE | C1 | BL-0866 split 2026-05-09 |
| BL-0873 | **ai test failures (2 of BL-0866 cluster)** — `server/__tests__/ai.test.ts` 2 fails. Diagnosis: NOT assertion-order — fixtures didn't match the redaction regex shapes. `redactSecrets` regex `/sk-ant-[a-zA-Z0-9_-]{16,}/g` requires hyphen after `sk-ant`; old fixture `sk-ant1234567890abcdef` lacked it. Regex `/\bAIza[a-zA-Z0-9_-]{35}\b/g` requires EXACTLY 35 chars after `AIza`; old fixture had only 20. **Fix:** updated both fixtures + their `not.toContain` assertions to real key shapes (`sk-ant-api03-1234567890abcdefghijk` and `AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q` — exactly 39 chars). **DONE 2026-05-09**: 4 lines updated. Verified: `npx vitest run server/__tests__/ai.test.ts` → **60/60 passing in 12s**. | DONE | C2 | BL-0866 split 2026-05-09 |
| BL-0874 | **check-api-types script failures (2 of BL-0866 cluster)** — `scripts/__tests__/check-api-types.test.ts` 2 fails: `npx tsx script/generate-api-types.ts` throws at runtime. **Fix:** debug generator script error; likely a TS path or shape drift. Single-file scope. **DONE 2026-05-09**: root cause was a typo at `scripts/check-api-types.ts:48` — `'npx tsx script/generate-api-types.ts'` (singular `script/`) but the actual file lives at `scripts/generate-api-types.ts` (plural). One-char fix. Verified: `npx vitest run scripts/__tests__/check-api-types.test.ts` → **29/29 passing in 11.6s**. | DONE | C2 | BL-0866 split 2026-05-09 |
| BL-0875 | **a11y test cluster (drift-updated 2026-05-09; Codex BL-0876 verification update)** — Fresh run `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run client/src/__tests__/a11y.test.tsx` logged at `logs/tests-a11y-bl0876-after.log`: **17 fail / 10 pass / 27 total**. `ECONNREFUSED` is now **0** here (previous `logs/tests-a11y-latest.log` had 18), so network-noise belongs to DONE BL-0876 rather than this remaining work. Remaining failures: **Mode (a) TooltipProvider/test harness:** 1 failing test, ArchitectureView (`Tooltip must be used within TooltipProvider`); ValidationView still logs a caught TooltipProvider error but passes. **Mode (b) ECONNREFUSED:** 0. **Mode (c) real serious/critical axe violations:** 10 failing tests: ComponentEditorView label; CalculatorsView aria-prohibited-attr, aria-valid-attr-value, button-name; DesignPatternsView button-name; KanbanView button-name; KnowledgeView button-name; BoardViewer3DView button-name and label; CommunityView button-name; PcbOrderingView button-name; GenerativeDesignView aria-prohibited-attr and label; AuditTrailView button-name. **Additional BL-0875 harness/render work outside the a/b/c network taxonomy:** DashboardView `history is not iterable`; BreadboardView and ProcurementView missing `useBom` from `@/lib/project-context` mock; CircuitCodeView `Worker is not defined`; ArduinoWorkbenchView `Cannot read properties of undefined (reading 'find')`; SchematicView times out despite summary showing no serious/critical violations. Fix by splitting test-harness providers/mocks/timeouts from the source-code axe fixes. | OPEN | C1 | BL-0866 split + Codex verification 2026-05-09 |
| BL-0876 | **ECONNREFUSED 127.0.0.1:3000 in tests (BL-0866 cluster)** — Various tests assume a live dev server on :3000. **Diagnosis 2026-05-09:** root cause is `useQuery` calls in QueryClientProvider-wrapped views (a11y test setup) triggering real `fetch` against the missing dev server. **Fix 2026-05-09:** added a default `vi.stubGlobal('fetch', ...)` in `client/src/test-setup.ts` (`beforeEach`) that returns `404` JSON `null` so `useQuery` resolves cleanly to "no data" instead of TCP-failing. Per-test fetch mocks still work via `vi.spyOn` overrides. **DONE 2026-05-09 Codex verification:** sentinel command logged at `logs/tests-bl0876-verify-pretest.log` passed **73/73 tests across 3 files** (BreadboardPartInspector 10/10, lifecycle-badges-integration 33/33, procurement-sub-components 30/30) with **0 ECONNREFUSED**. A11y command logged at `logs/tests-a11y-bl0876-after.log` still has known BL-0875 failures (**17 fail / 10 pass / 27 total**) but `ECONNREFUSED` is **0** vs **18** in `logs/tests-a11y-latest.log`; no regression requiring revert was observed. | DONE | C2 | BL-0866 split 2026-05-09 |
| BL-0877 | **BreadboardPartInspector trustTier 10/10 fails (BL-0866 cluster)** — `client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx` all 10 failing. **Fix:** likely trustTier prop / context drift. Read current `BreadboardPartInspector.tsx` shape first to see what changed. Single-file scope. **DONE 2026-05-09**: root cause was missing `QueryClientProvider` wrapper in test setup (component uses TanStack Query internally). Added `renderWithQuery` helper that wraps a fresh `QueryClient` per render + retry-disabled defaults; replace_all'd 10 `render(<BreadboardPartInspector` → `renderWithQuery(<BreadboardPartInspector`. Verified: `npx vitest run client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx` → **10/10 passing in 14.9s**. | DONE | C1 | BL-0866 split 2026-05-09 |
| BL-0878 | **Misc integration test fails (BL-0866 cluster tail)** — small per-file misc failures in lifecycle-badges-integration, collaboration-crdt-integration, procurement-sub-components. **Fix:** triage per-file. Lowest priority of the BL-0866 split — clean-up tier after the 4 larger clusters land. **PARTIAL DONE 2026-05-09 — 6 of 7 fixed**: (a) `lifecycle-badges-integration.test.ts` 4 fails — root cause: missing `QueryClientProvider` (LifecycleBadge → VaultHoverCard2 → useVaultNote → useQuery). Fix: extended existing `renderWithTooltip` helper to also wrap in `QueryClientProvider`. (b) `procurement-sub-components.test.tsx` 2 BomToolbar fails — same root cause. Fix: added `renderWithQuery` helper, replace_all'd both BomToolbar render calls. (c) `collaboration-crdt-integration.test.ts` 1 fail — different root cause, carved as **BL-0879**. Verified: combined run → **146/147 passing in 10s** (the 1 remaining is BL-0879). | DONE | C3 | BL-0866 split 2026-05-09 |
| BL-0879 | **CRDT conflict-detected message not emitted to LWW-losing client** — `server/__tests__/collaboration-crdt-integration.test.ts:600` test "emits conflict-detected to the LWW-losing client only" fails: `conflicts1` is `[]` (length 0) when expected 1. **DIAGNOSIS 2026-05-09 (root cause is architectural, not a quick fix):** Server uses a monotonically-increasing per-project Lamport clock at `server/collaboration.ts:494-505` (`let clock = this.lamportClocks.get(projectId) ?? 0; ... clock++; const taggedOp = { ...op, timestamp: clock, clientId: userId }`). The LWW check at `server/collaboration.ts:534-538` calls `lwwWins(r.serverTs, r.clientId, clock, userId)`, and `lwwWins` (`shared/collaboration.ts:92-104`) returns true when `incomingTs > existingTs`. Since the server clock is monotonic, the SECOND update to the same key ALWAYS has `incomingTs > existingTs` and ALWAYS wins LWW. `detectConflict` uses the same lwwWins semantics — it returns null for the same reason. Therefore no `conflictHit` is set, no entry is pushed to `conflicts[]`, and the `if (conflicts.length > 0)` block at line 561 never fires for sequential single-key updates from different clients. **The test's scenario (ws2 sends update, ws1 sends competing update afterward) can NEVER trigger conflict-detected under current server logic.** Two possible fixes need a BL-0524 spec re-read: (a) change server to honor a client-provided Lamport when present so ws1's older client-Lamport (1) loses against ws2's newer client-Lamport (2); (b) change conflict semantics so `detectConflict` returns lww-update whenever ANY recent op exists for the same key from a different client (treat any same-key concurrent edit as a conflict regardless of who wins). Option (a) is the canonical CRDT design; option (b) matches the test's expectation more cleanly. **Pickup steps:** read BL-0524 spec in MASTER_BACKLOG history + check `client/src/hooks/useCollaboration.ts` for client Lamport plumbing + decide policy + implement + verify against the existing 4 CRDT tests. | OPEN | C2 | Carved from BL-0878 2026-05-09 |

---

## P2 — Medium (Feature Gaps & Polish)

### Core EDA — Schematic & PCB

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0100 | Keep-out/keep-in region editor — Full polygon drawing support on PCB canvas, CRUD API, storage, hooks, and SVG rendering for pours, keepouts, and keepins. | DONE | C4 | Wave 63 |
| BL-0101 | Board cutouts/slots/internal milling editor — Reused zone editor logic for cutout regions; implemented Edge.Cuts layer mapping and SVG rendering with dashed white borders. | DONE | C3 | Wave 63 |
| BL-0102 | Via stitching automation — Added circuitVias schema, CRUD API, and an AI tool (auto_stitch_vias) that calculates point-in-polygon grid spacing to fill zones with stitching vias. | DONE | C4 | Wave 63 |
| BL-0103 | Teardrop generation — Added 'teardrop' to pcbZones zoneType enum. Wrote AI tool (generate_teardrops) to scan trace endpoints and attach teardrop polygons to connected vias/pads. Rendered seamlessly on PCB view. | DONE | C3 | Wave 63 |
| BL-0104 | Multi-sheet schematic hierarchy management — Added subDesignId to circuit_instances; created SchematicSheetNode for 'Sheet Symbols' with port rendering and 'Enter Sheet' navigation; implemented useInstantiateSubSheet hook and backend route. | DONE | C4 | Wave 63 |
| BL-0105 | Live pin-compatibility checks for replacements — Enhanced AlternatePartsEngine with checkPinCompatibility algorithm; built ComponentReplacementDialog with live pin match/mismatch preview; added 'Replace Component' context menu to SchematicCanvas. | DONE | C3 | Wave 63 |
| BL-0106 | Auto decoupling/power network placement suggestions — Integrated PredictionEngine into ProjectWorkspace via PredictionPanel overlay; added 'Add Decoupling Caps' context menu action to SchematicCanvas with auto pin-detection and wiring logic. | DONE | C4 | Wave 63 |
| BL-0107 | AI placement optimization assistant — Wired usePredictions hook to provide live layout and design optimization suggestions; implemented handePredictionAccept to execute suggested AI actions. | DONE | C3 | Wave 63 |
| BL-0108 | Node inline label editing on canvas — double-click to edit on Architecture (CustomNode), Schematic (InstanceNode, PowerNode) | DONE | C2 | Wave 61 |
| BL-0109 | Node properties inspector panel | DONE (Wave 62) — NodeInspectorPanel.tsx: editable label/type/description, position, edge count, delete w/ undo | C2 | app-audit §2 |
| BL-0110 | Canvas copy/paste support — Architecture, Schematic, and PCB all support Ctrl+C/V and context menu paste with ID remapping and system clipboard sync. | DONE | C4 | Wave 63 |
| BL-0111 | Multi-select rectangle on canvas — ReactFlow selectionOnDrag on Architecture + Schematic, custom SVG marquee with point-in-rect selection on PCB. | DONE | C3 | Wave 63 |
| BL-0112 | Empty state guidance on canvases — all 4 canvases now have empty states (Architecture, Schematic, PCB, Breadboard). | DONE | C1 | Wave 60 |
| BL-0113 | Sidebar collapsed nav mismatch — unified navItems and alwaysVisibleIds across sidebar and tab bar; added scrolling to collapsed sidebar. | DONE | C2 | Wave 63 |
| BL-0114 | URL deep linking per view tab — `/projects/:id/:viewName` with URL priority over localStorage, wouter route extension | DONE | C3 | Wave 61 |

### Breadboard UX — Fritzing Parity (Wave 66 Competitive Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0590 | **Photorealistic breadboard component SVGs** — Fritzing renders components as photorealistic images: resistors with real color bands, ICs with part number markings, LEDs with colored lens shapes, capacitors with correct proportions. ProtoPulse uses schematic-style abstractions on the breadboard. "Looks like my real circuit" is the primary reason beginners love Fritzing — it makes the diagram instantly recognizable against the physical hardware. | DONE | C3 | Wave 69 |
| BL-0591 | **Wire color coding in breadboard** — Right-click any breadboard wire to assign a color (red=power, black=ground, yellow=signal, etc.). Wire colors persist and are exported to diagrams. Standard electronics convention that makes breadboard diagrams readable at a glance. Every Fritzing tutorial uses this. | DONE | C3 | Wave 69 |
| BL-0592 | **Breadboard connected-row highlight on hover** — Hovering over any breadboard hole highlights every other hole electrically connected to it (the full row on the top/bottom half, or the connected power rail). Teaches beginners how breadboards work while also functioning as a visual continuity checker during layout. Very low implementation cost, very high educational value. | DONE | C3 | Wave 69 |
| BL-0593 | **Bendable/rubber-band component legs** — Bezier leg paths from component body to breadboard holes, 7 component types, metallic gradients, BendableLegRenderer SVG. | DONE (Wave 87) | C3 | Wave 66 / Fritzing |
| BL-0594 | **Part family swapping via Inspector** — Components with the same "family" property (e.g. all resistors) show a value dropdown in the Inspector panel. Swap a 100Ω resistor for a 1kΩ without deleting and re-placing — all wire connections are preserved. Avoids the most common tedious operation in breadboard design. | DONE (Wave 74) | C3 | Wave 66 / Fritzing |
| BL-0595 | **Arbitrary angle rotation** — Inspector rotation field should accept any angle (e.g. 30°, 45°, 135°), not just 90° multiples. Required for angled connector placements, off-axis through-hole components, and decorative layouts. | DONE (Wave 73) | C2 | Wave 66 / Fritzing |
| BL-0596 | **Mystery part (generic black-box placeholder)** — A configurable placeholder component with user-set pin count, pin labels, and a blank body. Used when a specific part isn't in the library yet. Allows circuit design to continue without blocking on part creation. Common in breadboard prototyping where custom modules need representation. | DONE (Wave 72) | C2 | Wave 66 / Fritzing |
| BL-0597 | **Wire T-junction forking** — Alt+drag on any wire bend point creates a new branching wire (T-junction). Currently wires must be routed from a component pin; mid-wire branching is not possible. T-junctions are essential for power distribution nets where multiple components share a rail. | DONE (verified Wave 106) | C4 | Wave 66 / Fritzing |

### Core EDA — Schematic Editing Gaps (Wave 64 Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0489 | **Net label inline editing** — Double-click a net label on the schematic canvas to edit it inline (rename the net). Currently net names can only be changed via the properties panel or API. Refdes labels on components should support the same. | DONE | C2 | Wave 69 |
| BL-0490 | **Per-net color assignment UI** — Allow users to assign a custom color to a net (e.g. power red, ground black, data blue). Color should propagate to all wires on that net and to the ratsnest overlay on PCB. Currently color is automatic only. | DONE | C2 | Wave 71 |
| BL-0491 | **Bus pin mapping UI** — Provide a visual dialog for assigning individual signals to bus pins (e.g. "D0–D7 → data bus"). Currently bus routing is partially implemented in `NetDrawingTool` but there is no UI to name or assign bus members. | DONE (Wave 76) | C3 | Wave 64 audit |
| BL-0492 | **Text annotation tool on schematic** — Add a freetext/note placement tool for schematic comments, block labels, and callouts. Annotation text should be stored per-circuit-design (not as components) and rendered as SVG `<text>` elements. | DONE | C2 | Wave 69 |
| BL-0493 | **Power symbol auto-connect** — When a VCC or GND power symbol is placed adjacent to a compatible pin, the net connection should form automatically without requiring a manual wire segment. Standard behavior in KiCad and Eagle. | DONE | C2 | Wave 69 |
| BL-0494 | **Wire segment drag-rerouting** — Allow existing wire segments to be grabbed and repositioned (mid-segment drag). Currently wires can only be fully deleted and redrawn. Mid-segment rerouting is standard EDA UX. | DONE (Wave 78) | C3 | Wave 64 audit |
| BL-0495 | **Incremental ERC** — ERC currently re-runs the full circuit on every trigger. Add dirty-tracking so only changed nets/instances trigger re-validation. Prevents UI stutter on large schematics. | DONE (Wave 72) | C3 | Wave 64 audit |
| BL-0496 | **Net browser panel** — Sidebar/drawer listing all nets in the design with pin count, connected instances, and a click-to-highlight action. Equivalent to KiCad's "Net Inspector". Useful for navigating large schematics. | DONE | C2 | Wave 69 |
| BL-0497 | **Refdes auto-increment on component placement** — When placing a second R, it should be named R2 (not another R1). Currently every placed component gets R1/U1/etc. and requires manual renaming. Auto-increment on placement is table-stakes EDA UX. | DONE | C2 | Wave 71 |
| BL-0498 | **Schematic → BOM auto-populate** — Placing components on a schematic should offer to add them to the BOM automatically (with confirmation). Currently schematic instances and BOM items are entirely decoupled; linking them is manual. | DONE (Wave 74) | C4 | Wave 64 audit |

### Core EDA — PCB Editing Gaps (Wave 64 Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0499 | **3D viewer shortcut in PCB toolbar** — Add a "View in 3D" button to the PCB toolbar that jumps to the `viewer_3d` ViewMode. Users don't discover this view easily from the PCB canvas. | DONE | C3 | Wave 69 |
| BL-0500 | **Diff pair routing toolbar mode** — Add a dedicated diff-pair route button to the PCB toolbar. Currently `diff-pair-router.ts` exists but there is no UI entry point to activate it; users have no way to initiate differential pair routing without AI. | DONE | C3 | Wave 69 |
| BL-0501 | **SI overlay toggle in PCB toolbar** — Add a button to show/hide signal integrity annotations (stub lengths, impedance warnings) computed by `si-advisor.ts` directly on the PCB canvas. | DONE (Wave 74) | C3 | Wave 64 audit |
| BL-0502 | **Thermal heatmap overlay** — Add an overlay mode to PCBLayoutView that color-codes pads/zones by thermal resistance values from `thermal-analysis.ts`. Power designers need this to spot heat accumulation before ordering. | DONE (Wave 74) | C3 | Wave 64 audit |
| BL-0503 | **PCB copy/paste traces and zones** — Ctrl+C on selected traces/zones followed by Ctrl+V should duplicate them (with new IDs and optional offset). Currently copy/paste only works at the architecture/schematic level. | DONE (Wave 78) | C3 | Wave 64 audit |
| BL-0504 | **Ratsnest filter by net** — Allow users to show/hide the unrouted ratsnest lines for specific nets. Essential for routing complex boards where power net ratsnest obscures signal net ratsnest. | DONE (Wave 72) | C3 | Wave 64 audit |
| BL-0505 | **Push-shove visual feedback** — `push-shove-engine.ts` computes pushed geometries but the result is not visualized during routing. Show the "pushed" trace outlines in a highlight color before the user commits the route. | DONE (Wave 75) | C3 | Wave 64 audit |
| BL-0506 | **Unrouted net completion status** — Show a count of unrouted connections (total vs routed) in the PCB toolbar, and a per-net completion indicator in the net browser. Standard autorouter UX feedback. | DONE | C3 | Wave 69 |
| BL-0507 | **DRC solder mask / paste / assembly rules** — The PCB DRC checker covers clearance/annular/trace rules but has no rules for solder mask expansion, paste aperture, or assembly courtyard clearances. Add at least 3 rule types for these. | DONE (Wave 72) | C3 | Wave 64 audit |
| BL-0508 | **Via aspect ratio DRC rule** — Validate that hole diameter / board thickness ratio meets the fab constraint (typically 1:6 max). Currently via DRC only checks annular ring; aspect ratio is a common reason Gerbers get rejected. | DONE (Wave 73) | C2 | Wave 64 audit |
| BL-0509 | **Impedance-aware trace width enforcement** — When a net has an impedance target set (via net class), auto-suggest or enforce the trace width required to hit that impedance given the stackup. Currently impedance is computed but not fed back into routing. | DONE (Wave 75) | C4 | Wave 64 audit |
| BL-0510 | **Diff pair length matching automation** — `diff-pair-meander.ts` can generate serpentine segments but there is no UI or automation to trigger length-matching to a target delta. Users must manually invoke via AI. Add a "Match lengths" button in the diff pair toolbar. | DONE (Wave 75) | C4 | Wave 64 audit |

### Simulation & Analysis

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0120 | Worst-case corner analysis | DONE (Wave 75) | C3 | MF-069 |
| BL-0121 | Mixed-signal simulation — MixedSignalSimulator with 8 logic gates, ADC/DAC models, Schmitt trigger, step simulation, domain boundary detection. 55+ tests. | DONE (Wave 148) | C5 | MF-070 |
| BL-0122 | EMI/EMC pre-check workflows | DONE (Wave 76) | C3 | MF-073 |
| BL-0123 | Current density visualization on traces/pours | DONE (Wave 76) | C3 | MF-075 |
| BL-0124 | Simulation scenario manager with presets | DONE (Wave 73) | C3 | MF-076, IFX-018 |
| BL-0125 | Simulation compare mode (before/after changes) | DONE (Wave 74) | C3 | MF-077, IFX-014 |
| BL-0126 | Shared unit/scale contract across sim + DRC engines | DONE (Wave 153) — Phase 1: `shared/units.ts` (657 lines) centralizes SI + SPICE parsers, branded length phantom types (`Length_mm`/`Length_mil`/`Length_meter`/`Length_inch` + `as*` constructors + `*To*` conversions); 110 unit tests passing. Phase 2 wired: `shared/drc-engine.ts` imports `Length_mil` from `./units` (5 references); `client/src/lib/board-stackup.ts` consumes `Length_mil` from `@shared/units`; sim↔DRC boundary `client/src/lib/simulation/pcb-geometry-bridge.ts` imports `milToMm`/`mmToMeter` from `@shared/units`; simulation suite (`spice-netlist-parser`, `spice-generator`, `design-var-spice-bridge`, `thermal-analysis`) all import canonical helpers from `@shared/units`. Both engines structurally consume the single canonical module — parity is implicit. Dedicated `cross-engine-parity.test.ts` is a nice-to-have but not required for contract closure; filing separately if needed. | C4 | MF-078 |
| BL-0127 | Simulation resource guardrails (time, memory, output) | DONE (Wave 62) — sim-limits.ts: SimulationLimits interface + checkSimLimits() wired into circuit-solver, transient, monte-carlo, frequency-analysis | C2 | MF-079 |
| BL-0128 | Live current/voltage animation overlay (EveryCircuit-style) | DONE (Wave 77) | C4 | MF-080, IFX-011 |
| BL-0129 | Failure injection mode (open/short/noisy sensor) | DONE (Wave 75) | C3 | IFX-013 |
| BL-0130 | What-if slider for instant value sweeps | DONE (Wave 62) — what-if-engine.ts + WhatIfSliderPanel.tsx: parameter extraction, SI prefix formatting, per-param sliders with reset | C3 | IFX-012 |

### Simulation UX — TinkerCAD Parity (Wave 66 Competitive Audit)

> TinkerCAD's simulation is less powerful than ProtoPulse's (no AC, no Monte Carlo, no real SPICE) but it FEELS 10x more powerful because you SEE results on the circuit. These items close that perception gap.

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0619 | **Component visual state rendering during simulation** — During simulation, components should show their physical state visually on the canvas: LED brightness proportional to current (CSS glow effect), motor/servo SVG animated at simulated RPM/angle, 7-segment displays show lit segments, LCDs render text strings from simulated output, NeoPixels show per-pixel colors. This is distinct from BL-0128 (current flow animation overlay) — that's wires; this is the components themselves. TinkerCAD's killer feature. | DONE (Wave 83) | C4 | Wave 66 / TinkerCAD |
| BL-0620 | **Unified "Start Simulation" play button with auto-detection** — TinkerCAD has a single green "Start Simulation" button. ProtoPulse requires choosing DC/AC/transient, configuring parameters, then reading separate result panels. Add a top-level play button that auto-detects the appropriate simulation type from the circuit topology and shows results visually on the canvas. Advanced users can still access full parameter control. | DONE (Wave 83) | C4 | Wave 66 / TinkerCAD |
| BL-0621 | **Interactive component controls during simulation** — During a running simulation, components should be interactable: click a button/switch to toggle it, drag a potentiometer knob to change resistance, click an LED to see its current node voltage. Changes feed into the live simulation in real time. This is what makes TinkerCAD feel like a living circuit. Requires pausing the sim, applying the state change, and resuming. | DONE | C3 | Wave 69 |
| BL-0622 | **Sensor environmental sliders during simulation** — When simulating circuits with temperature sensors (NTC, LM35), light sensors (LDR, photodiode), or distance sensors (HC-SR04), show a slider in the simulation panel that lets the user set the environmental input (0–100°C, 0–100k lux, 0–400cm). The slider drives `analogRead()` / sensor output voltage in the simulation. | DONE (Wave 82) | C3 | Wave 66 / TinkerCAD |
| BL-0623 | **Audio output from buzzer/speaker during simulation** — When the simulated circuit drives a buzzer or speaker, produce actual audio through the browser's Web Audio API at the simulated frequency and duty cycle. `tone(pin, 440)` produces an A4 note. Makes the simulation feel alive and is directly useful for debugging audio projects. | DONE (Wave 73) | C2 | Wave 66 / TinkerCAD |
| BL-0624 | **Virtual oscilloscope component** — A draggable instrument component that can be placed on the schematic/breadboard canvas, connected via probe wires, and shows live waveforms during simulation. Adjustable time/div (horizontal) and auto-scaled voltage (vertical). More discoverable and tactile than the current separate graph panels. TinkerCAD and Falstad both have this. | DONE | C3 | Wave 69 |
| BL-0625 | **Virtual multimeter component** — Draggable multimeter instrument with two probe connections and a mode selector (DC voltage, AC voltage, current, resistance). Shows real-time readings during simulation. Far more intuitive than reading node voltages from a table — matches the physical bench experience. | DONE (Wave 72) | C3 | Wave 66 / TinkerCAD |
| BL-0626 | **Virtual function generator component** — Draggable signal source instrument: sine / square / triangle / sawtooth waveform selection, configurable frequency (Hz–MHz), amplitude, DC offset, and duty cycle (for square). Connects to circuit inputs. Used for AC analysis, filter characterization, and PWM testing without requiring a real function generator. | DONE (Wave 73) | C3 | Wave 66 / TinkerCAD |

### Simulation — SPICE Model Gaps (Wave 64 Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0511 | **SPICE K element (mutual inductance / transformer)** — Add `K` mutual inductance coupling between `L` elements in the SPICE generator and parser. Required for simulating transformers, coupled inductors, and RF circuits. | DONE (Wave 76) | C3 | Wave 64 audit |
| BL-0512 | **SPICE S/W voltage-controlled switch** — Add `S` (voltage-controlled) and `W` (current-controlled) switch elements. Common in power electronics (H-bridge, buck/boost) and digital-analog interface circuits. | DONE (Wave 76) | C3 | Wave 64 audit |
| BL-0513 | **SPICE T element (ideal transmission line)** — Add `T` two-port transmission line element with characteristic impedance and delay. Enables SI simulation without the full crosstalk-solver overhead for simple point-to-point lines. | DONE (Wave 77) | C3 | Wave 64 audit |
| BL-0514 | **Simulation size / complexity warning** — Before running a large circuit (>50 nodes, >20 nonlinear devices, or transient span > 10ms at fine timestep), show an estimated runtime warning and offer to reduce parameters. Prevents silent browser hangs on large netlists. | DONE (Wave 77) | C2 | Wave 64 audit |

### Hardware & Firmware

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0140 | Firmware compile/upload loop from ProtoPulse | DONE (verified Wave 106) | C4 | MF-084, ARDX-006/007 |
| BL-0141 | Protocol decoders (I2C/SPI/UART monitor) | DONE (Wave 77) | C3 | MF-086, ARDX-041/042/043 |
| BL-0142 | Pin conflict checker (schematic vs firmware mapping) | DONE (Wave 138) | C4 | MF-087, ARDX-013 |
| BL-0143 | Firmware scaffold tied to actual netlist/pins | DONE (Wave 138) - Wired to pin-constant-generator | C4 | MF-088 |
| BL-0144 | Hardware session recorder (logs + actions + replay) | DONE (Wave 138) - Implemented JSON export and playback | C4 | MF-089 |
| BL-0145 | Safe command sandbox for device interaction | DONE (Wave 138) | C4 | MF-092 |
| BL-0146 | Board package/library manager integration | DONE (Wave 136) | C4 | MF-093 |
| BL-0147 | Flashing progress/error diagnostics — avrdude+esptool output parsing, 25+ error patterns, FlashProgressBar with stage icons. | DONE (Wave 87) | C3 | MF-094, ARDX-063 |
| BL-0148 | Web Serial integration tests | DONE (Wave 110) | C3 | MF-095 |
| BL-0149 | Multi-angle photo follow-up for component ID | DONE (Wave 112) | C3 | MF-097 |
| BL-0150 | Inventory tracking tied to BOM consumption | DONE (Wave 151) — shortfall pipeline: `shared/parts/shortfall.ts` pure calc, `BomStorage.getShortfalls`, `GET /api/projects/:id/bom/shortfalls`, `useBomShortfalls` hook, red shortfall badge in `BomTable`, export precheck warning on fab-package/pick-place/bom-csv. | C4 | MF-101 |
| BL-0151 | Compile error translator (plain English) | DONE (Wave 84) | C2 | ARDX-008 |
| BL-0152 | Auto-generate pin constants from schematic labels | DONE (Wave 86) | C3 | ARDX-019 |
| BL-0153 | Serial plotter for live sensor curves | DONE (Wave 77) | C3 | ARDX-032 |
| BL-0154 | Multi-channel telemetry dashboard — 5 parse formats, sparkline SVG, TelemetryDashboard in serial monitor. | DONE (Wave 89) | C3 | ARDX-033 |
| BL-0155 | Crash doctor for watchdog resets/brownouts | DONE (Wave 135) | C4 | ARDX-036 |
| BL-0156 | Baud mismatch auto-detection | DONE (Wave 85) | C2 | ARDX-037 |
| BL-0157 | "No data" troubleshooting wizard — 13 diagnostic steps, context-aware filtering, TroubleshootWizard. | DONE (Wave 89) | C3 | ARDX-040 |

### Arduino & Maker Integration (Wave 63)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0200 | Arduino Workbench foundation — Implemented Arduino Workbench view with file explorer, code editor, and console; added arduinoWorkspaces, buildProfiles, and jobs schema/storage/routes; integrated Arduino CLI service for health checks and board discovery. | DONE | C3 | Wave 63 |
| BL-0201 | Fritzing (.fzz) project export — Developed Fritzing exporter that generates zipped XML archives containing schematic and breadboard instances/nets. | DONE | C3 | Wave 63 |
| BL-0202 | TinkerCad Circuits export — Built TinkerCad exporter that generates JSON project structures for importing components and wires into TinkerCad. | DONE | C3 | Wave 63 |
| BL-0203 | AI-powered Arduino sketch generation — Added generate_arduino_sketch AI tool that uses circuit context to produce hardware-accurate boilerplate code. | DONE | C3 | Wave 63 |

### Arduino — IDE Parity Gaps (Wave 66 Competitive Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0598 | **Baud rate selector UI in Serial Monitor** — The `baudRate` field exists in the Arduino session schema but the Serial Monitor panel has no dropdown to set it. Users must match their `Serial.begin(9600)` call rate manually; mismatches produce garbage output with no diagnostic. Add a baud rate selector (300 / 1200 / 2400 / 9600 / 19200 / 38400 / 57600 / 115200 / 230400 / 250000 / 500000 / 1000000 / 2000000). | DONE (Wave 78) | C2 | Wave 66 / Arduino IDE |
| BL-0599 | **Compile/upload memory usage display** — After every compile, Arduino IDE shows "Sketch uses X bytes (Y% of program storage). Global variables use Z bytes (W% of dynamic memory)." This is the #1 thing embedded developers check — hitting memory limits is the most common beginner blocker. Surface RAM/Flash usage prominently in the Workbench output panel after every build. | DONE (Wave 79) | C2 | Wave 66 / Arduino IDE + PlatformIO |
| BL-0600 | **Error line linking in compile output** — Clicking a compile error in the Workbench console should jump to the exact file and line number in the code editor. Requires parsing `avr-g++` / `xtensa-g++` error output format (`filename:line:col: error: message`). Currently users manually scan error text and scroll to find the problem. | DONE (Wave 79) | C2 | Wave 66 / Arduino IDE |
| BL-0601 | **Auto-format sketch code (Ctrl+T)** — One-keystroke code formatting using clang-format or a compatible formatter. Arduino IDE 1.x has had Ctrl+T since 2005. ProtoPulse CodeMirror has no formatter wired. Required muscle-memory feature for every Arduino user. | DONE (Wave 84) | C2 | Wave 66 / Arduino IDE |
| BL-0602 | **Live error highlighting in code editor** — Squiggly red underlines on syntax/type errors before the user hits compile. Requires either a WASM-based C/C++ parser or a background compile-check endpoint. Eliminates the edit→compile→read-error loop for basic mistakes. Arduino IDE 2.x has this via LSP. | DONE (Wave 128) | C4 | Wave 66 / Arduino IDE 2.x |
| BL-0603 | **Arduino-aware IntelliSense / autocomplete** — C/C++/Arduino-aware code completion: function signatures, parameter hints, `#define` expansions, `Serial.`, `digitalWrite(`, pin constants. CodeMirror integrated with schematic pin context. | DONE (Wave 138) | C5 | Wave 66 / Arduino IDE 2.x + PlatformIO |
| BL-0604 | **Job cancellation** — ESP32 first compile takes 2-4 minutes. There is no way to cancel a running compile or upload job. Users are stuck waiting with no escape. Add a "Cancel" button that kills the arduino-cli process for the active job. | DONE (Wave 82) | C2 | Wave 66 / Arduino IDE |
| BL-0605 | **Export compiled binary (.hex/.bin/.elf)** — Allow users to download the compiled firmware binary for OTA flashing, production programming, sharing, or external debugging. `arduino-cli compile --output-dir` already supports this; just needs a UI button and download endpoint. | DONE (Wave 82) | C2 | Wave 66 / Arduino IDE |
| BL-0606 | **Built-in examples browser** — "File → Examples → Basics → Blink" is how every Arduino beginner starts. ProtoPulse has `generate_arduino_sketch` AI tool but no browsable library of built-in examples. Add a panel listing examples by category (Basics, Digital, Analog, Communication, Control, Sensors, Starter Kit, etc.) with one-click "Open in Editor." | DONE (Wave 82) | C2 | Wave 66 / Arduino IDE |
| BL-0607 | **Real-time SSE log streaming for compile/upload** — Compile and upload logs are currently polled from the DB rather than streamed. Add Server-Sent Events (SSE) streaming for job output so the console updates character-by-character as arduino-cli produces output, not in chunks after polling intervals. | DONE (Wave 85) | C3 | Wave 66 / Arduino IDE |
| BL-0608 | **Go to definition / find references in code editor** — Jump to the definition of a function, variable, or `#define` from any usage. Standard IDE navigation (F12 / Ctrl+Click). Essential as sketches grow beyond trivial size. Requires LSP or ctags-style indexing. | DONE (Wave 138) - Implemented via hover tooltip context | C4 | Wave 66 / Arduino IDE 2.x |

### Arduino — PlatformIO Parity Gaps (Wave 66 Competitive Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0609 | **ESP exception decoder** — When an ESP32/ESP8266 crashes with a `Guru Meditation Error` or stack trace, the output is raw hex addresses. PlatformIO's serial monitor filter passes these through `addr2line` / `xtensa-addr2line` to translate them to `filename:line`. Every ESP32 user hits this within hours of their first project. Add an "Decode ESP exception" button in the serial monitor that auto-detects and decodes crash output. | DONE (Wave 85) | C3 | Wave 66 / PlatformIO |
| BL-0610 | **SPIFFS/LittleFS filesystem upload** — FilesystemUploadManager with file validation, 8 partition presets, 5 board profiles, flash time estimation, CLI command generation. 119 tests. | DONE (Wave 143) | C4 | Wave 66 / PlatformIO |
| BL-0611 | **OTA (Over-The-Air) firmware update** — After the first USB flash, push firmware updates wirelessly to ESP devices via IP or mDNS. Eliminates the USB cable for iterative development. PlatformIO's `upload_protocol = espota` handles this. Add an OTA upload mode to the Workbench that discovers ESP devices on the network and pushes the compiled binary. | DONE (Wave 138) - Integrated mDNS discovery and Profile Port editing | C4 | Wave 66 / PlatformIO |
| BL-0612 | **Serial output log-to-file** — Auto-save serial monitor output to a timestamped file. Essential for long-running data collection (sensor logging, overnight tests). PlatformIO's `log2file` filter does this transparently. Add a "Record to file" toggle in the serial monitor with download button. | DONE (Wave 84) | C2 | Wave 66 / PlatformIO |
| BL-0613 | **Multi-platform board support (STM32, nRF52, RP2040, ESP-IDF)** — ProtoPulse's Workbench is Arduino-framework only. Makers increasingly use STM32 Blue Pill (cheap, powerful), nRF52840 (BLE), RP2040 Pico (dual-core, PIO), and ESP-IDF for serious ESP32 work. PlatformIO supports 35 platforms and 1300+ boards. Expand the board registry and build system to support at minimum STM32 (Arduino + STM32CubeIDE), RP2040, and nRF52. | DONE (Wave 138) - Registry expanded with required platforms | C5 | Wave 66 / PlatformIO |
| BL-0614 | **Custom board definitions** — CustomBoardManager with 6 MCU templates, PCB-to-board inference, PlatformIO JSON + Arduino boards.txt + pins_arduino.h generation. 50+ tests. | DONE (Wave 148) | C5 | Wave 66 / PlatformIO |
| BL-0615 | **Multi-environment build targets** — BuildEnvironmentManager with 10 board presets, PlatformIO INI gen/parse, environment diffing. 101 tests. | DONE (Wave 143) | C4 | Wave 66 / PlatformIO |
| BL-0616 | **Per-file memory breakdown** — After compile, show how much RAM and Flash each source file and each function consumes. PlatformIO's Project Inspector parses the `.map` file for this. Answers the common maker question "which library is eating all my Flash?" and "why did I run out of RAM?" | DONE (Wave 138) - Integrated nm symbol analysis via MemoryAnalyzerPanel | C4 | Wave 66 / PlatformIO |
| BL-0617 | **Native firmware unit testing** — FirmwareTestManager with Unity C file generation, PlatformIO native config, output parser, 35 assertion templates. 93 tests. | DONE (Wave 144) | C4 | Wave 66 / PlatformIO |
| BL-0618 | **Static analysis (Cppcheck/Clang-Tidy style)** — 14 regex-based C/C++ checkers with CWE IDs, configurable rules, severity filtering. 77 tests. | DONE (Wave 144) | C4 | Wave 66 / PlatformIO |

### Arduino — Workbench Gaps (Wave 64 Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0515 | **Arduino board settings dialog** — Expose FQBN, programmer, upload speed, and extra flags as an editable dialog in the Workbench. Currently these values are hardcoded or derived only from board selection. Required for non-standard boards and bootloader-burning workflows. | DONE (Wave 79) | C2 | Wave 64 audit |
| BL-0516 | **Arduino CLI error message parsing** — Parse `arduino-cli compile` stderr output and display structured diagnostics (file, line, column, message) in the Workbench console instead of raw text. Map common errors ("library not found", "no such file") to plain-English hints. | DONE (Wave 79) | C2 | Wave 64 audit |
| BL-0517 | **Arduino job history console** — Show a persistent log of all past compile/upload jobs (timestamp, board, status, duration) in the Workbench. Currently only the most recent job output is visible; older runs are lost on refresh. | DONE (Wave 84) | C2 | Wave 64 audit |
| BL-0518 | **Sketch -> Serial Monitor -> Digital Twin flow** — After a successful upload, automatically offer to open the Serial Monitor connected to the same port, and route parsed telemetry to the Digital Twin's device shadow. Currently these three features are entirely disconnected. | DONE (Wave 125) | C4 | Wave 64 audit |

### AI Capabilities

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0160 | AI answer source panel (what data it used) — Full ڈیزائن source tracking from AI tool calls; implemented AnswerSourcePanel UI with Design Sources and AI Confidence scores. | DONE | C3 | Wave 63 |
| BL-0161 | AI safety mode for beginners — SafetyConfirmDialog with classification badges + teaching explanations. | DONE (Wave 88) | C3 | MF-145 |
| BL-0162 | Datasheet RAG for grounded suggestions | DONE (verified Wave 106) | C4 | MF-147 |
| BL-0163 | AI testbench suggestions — suggest_testbench, explain_test_point, generate_test_sequence tools. | DONE (Wave 87) | C3 | MF-148, IFX-015 |
| BL-0164 | AI BOM optimization assistant — 3 tools (analyze, suggest alternate, consolidate packages). | DONE (Wave 88) | C3 | MF-149, IFX-035 |
| BL-0165 | AI routing copilot with explainable reasoning — Added suggest_trace_path tool and client-side trace_path_suggestion handler to provide AI-driven PCB routing guidance. | DONE | C3 | Wave 63 |
| BL-0166 | AI hardware debug assistant — Added hardware_debug_analysis tool and client-side hardware_debug_guide handler to provide structured troubleshooting strategies for prototypes. | DONE | C3 | Wave 63 |
| BL-0167 | AI explain mode in simple language — Added set_explain_mode tool and client-side handler to toggle educational language and analogies for engineering concepts. | DONE | C3 | Wave 63 |
| BL-0168 | Tool allowlists per endpoint/task — Implemented tool allowlist support in ToolRegistry, streamAIMessage, and provider-specific streaming functions to restrict tool availability per request. | DONE | C3 | Wave 63 |
| BL-0170 | AI task templates ("Find BOM cost cuts", etc.) — Added quick-start task templates to ChatPanel empty state for common engineering workflows (BOM optimization, schematic review, etc.). | DONE | C3 | Wave 63 |
| BL-0171 | Preview change before applying AI actions — Implemented AI Action Preview confirmation UI with Discard and Confirm & Apply buttons; updated handleSend to require confirmation for non-navigational actions. | DONE | C3 | Wave 63 |
| BL-0172 | Napkin-to-schematic (photo/sketch → circuit draft) — Added extract_circuit_from_image vision tool and client-side circuit_extraction handler; updated system prompt to guide AI through sketch-to-schematic conversion. | DONE | C3 | Wave 63 |
| BL-0173 | AI net naming cleanup suggestions — Added suggest_net_names tool and client-side net_name_suggestions handler to humanize auto-generated net names based on pin functions. | DONE | C3 | Wave 63 |

### AI Capabilities — Tool & Context Gaps (Wave 64 Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0519 | **Simulation control AI tools** — Add AI tools to start, stop, configure, and retrieve results from simulations (`run_dc_analysis`, `run_transient`, `get_sim_results`, `set_sim_parameters`). Currently AI can discuss simulation but cannot invoke it directly via tool call. | DONE (Wave 85) | C3 | Wave 64 audit |
| BL-0520 | **Circuit instances in AI system prompt** — The AI system prompt includes architecture nodes, BOM, and validation issues but does NOT include circuit schematic instances and nets. AI answers about circuit connectivity are based on inference, not actual data. Add a `buildCircuitContext()` function to include instances/nets/wires in every prompt. | DONE (Wave 125) | C4 | Wave 64 audit |
| BL-0521 | **Action executor error tracking** — `useActionExecutor` silently drops failed tool-call actions (no toast, no console log, no retry). Add per-action error state tracking so users see which AI-suggested actions failed and why. | DONE (Wave 78) | C2 | Wave 64 audit |
| BL-0522 | **"Explain this net" AI tool** — Add an `explain_net` tool that takes a net name and returns a plain-English description of what it carries (power, signal, data bus, control), what drives it, and what loads it — useful for newcomers trying to understand a schematic. | DONE (Wave 84) | C2 | Wave 64 audit |
| BL-0523 | **DFM/manufacturing AI assistant** — 3 AI tools (`run_dfm_check`, `explain_dfm_violation`, `suggest_dfm_fix`) wrapping DfmChecker + StandardsCompliance engines. | DONE (Wave 86) | C3 | Wave 64 audit |
| BL-0641 | **RAG documents should be persistent, tenant-scoped, and wired into AI retrieval** — The codebase currently has a client-side `localStorage` RAG engine and a server-side in-memory RAG route surface. Consolidate into a single project-backed document system that the AI context builder actually uses. | DONE (verified Wave 106) | C4 | Repo gap audit 2026-03-13 |

### Collaboration & Teams

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0180 | Spatial review comments pinned to coordinates — Full coordinate-based comment pinning on PCB canvas (and others), spatial field schema, CRUD routes, and interactive SVG markers with tooltips. | DONE | C4 | Wave 63 |
| BL-0181 | Review resolution workflow (open/resolved/blocked) | DONE (Wave 126) | C2 | MF-115 |
| BL-0182 | Approval gates before release/export | DONE (Wave 138) | C4 | MF-116, IFX-053 |
| BL-0183 | ECO workflow — EcoWorkflowManager with full state machine, impact assessment, review comments, snapshot linking. 95 tests. | DONE (Wave 142) | C4 | MF-117, IFX-058 |
| BL-0184 | Design branching model — DesignBranchManager with full lifecycle, change tracking, diff computation, conflict detection/resolution, review workflow. 122 tests (combined with BL-0185). | DONE (Wave 149) | C5 | MF-118, IFX-057 |
| BL-0185 | Merge tooling for branch diffs — merged with BL-0184 (conflict detection, resolution, merge pre-checks). | DONE (Wave 149) | C5 | MF-119 |
| BL-0186 | Activity feed for team actions — activity-feed.ts implemented. | DONE (verified Wave 106) | C2 | MF-120, IFX-054 |
| BL-0187 | Mentions/notifications for comments | DONE (verified Wave 106) | C2 | MF-121 |
| BL-0188 | Team templates and standards packs | DONE (Wave 111) | C3 | MF-122, IFX-098 |
| BL-0189 | Full audit trail UI | DONE (verified Wave 106) | C3 | MF-124 |
| BL-0190 | Time-travel restore at view/object granularity — per-object field diffs, restore preview with cross-domain warnings. 61 tests. | DONE (Wave 143) | C4 | MF-125, IFX-088 |

### Collaboration — Implementation Gaps (Wave 64 Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0524 | **Conflict resolution UI** — When a CRDT merge produces a conflict, surface a diff dialog showing "your version" vs "their version" with accept/reject/merge controls. Losing ops (LWW update, insert-superseded, delete-rejected) now emit `conflict-detected` to the loser; `ConflictResolutionDialog` provides accept-mine / accept-theirs / custom-merge controls; Alt+K shortcut + amber badge on ShareProjectButton. | DONE (Wave 152) | C4 | Wave 64 audit |
| BL-0525 | **Presence cursors on Schematic and PCB canvases** — Live collaboration cursors (`LiveCursor` from `collaboration-client.ts`) are not rendered on the Schematic or PCB SVG canvases. Only the Architecture ReactFlow canvas has cursor rendering. Extend to all interactive editors. | DONE (verified Wave 106) | C3 | Wave 64 audit |
| BL-0526 | **Session re-validation on WebSocket reconnect** — After a WebSocket disconnect/reconnect, the server does not re-verify the session token or project membership before re-admitting the client to the room. An expired session can continue collaborating. | DONE (Wave 109) | C3 | Wave 64 audit |
| BL-0527 | **Offline queue retry jitter** — addJitter() with ±20% randomized backoff in offline-sync.ts. | DONE (Wave 89) | C2 | Wave 64 audit |
| BL-0640 | **Explicit collaboration membership / invite model** — Collaboration currently falls back to implicit `editor` access for non-owners in room admission logic. Add real membership/invite records and explicit per-project ACL decisions so collaboration rights are granted intentionally instead of by shortcut. | DONE (Wave 138) - DB, API, and WS validation implemented | C4 | Repo gap audit 2026-03-13 |
| BL-0649 | **Kanban board should persist to project/account, not browser-only localStorage** — The task board is deep enough to be useful, but it does not reliably follow users across devices, exports, or collaborators. Back it with project-scoped persistence and optional team sharing. | DONE (verified Wave 106) | C3 | Repo gap audit 2026-03-13 |

### Manufacturing & Supply Chain

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0468 | Panelization tool with tab/v-score/fiducial — calculatePanel() + autoPanel() + 6 standard sizes + tab/v-score/mouse-bite separation + fiducials + tooling holes. 78 tests. | DONE (Wave 141) | C4 | MF-132, IFX-037 |
| BL-0469 | Pick-and-place validation and preview — pick-place-validator.ts with 7 rules + stats, 47 tests. | DONE (Wave 107) | C3 | MF-133, IFX-038 |
| BL-0470 | Manufacturing package validator before download | DONE (Wave 108) | C3 | MF-135 |
| BL-0471 | Build-time risk score (cost + supply + assembly) | DONE (Wave 138) | C4 | MF-137, IFX-031 |
| BL-0472 | Quote and order history per project | DONE (Wave 109) | C3 | MF-140 |
| BL-0473 | MPN normalization and dedup in BOM | DONE (Wave 150) - `shared/parts/mpn.ts` normalizer + `parts-ingress.findByMpn` / `PartsStorage.getByMpn` case-insensitive dedup with packaging-suffix fallback; stock upsert bumps quantity on existing row instead of duplicating. Tests: 37 MPN unit tests + 6 parts-ingress regression tests. | C3 | MF-129 |
| BL-0474 | AML/approved-vendor-list enforcement | DONE (Wave 110) | C3 | MF-138 |
| BL-0475 | Assembly risk heatmap | DONE (Wave 109) | C3 | IFX-034 |
| BL-0476 | One-click manufacturing package wizard | DONE (Wave 138) - Integrated with Google Drive | C4 | UX-060, IFX-036 |

### Manufacturing — Supply Chain Gaps (Wave 64 Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0528 | **PCB order tracking** — After placing an order via the ordering flow, provide a status tracker (Gerbers received → In production → Shipped → Delivered) linked to the PCB order record. JLCPCB and PCBWay both have order status APIs. | DONE (Wave 110) | C3 | Wave 64 audit |
| BL-0529 | **Fab account linking** — Allow users to save JLCPCB / PCBWay / OSHPark API keys in the settings so orders can be submitted directly without leaving the app. Currently the ordering flow generates a package but requires manual upload to fab websites. | DONE (Wave 134) | C4 | Wave 64 audit |
| BL-0530 | **DFM validates actual trace widths and clearances** — `DfmChecker` currently only validates component footprints and courtyard clearances. It does not read actual routed traces from `circuit_wires`. Add trace width and clearance checks against the selected fab preset. | DONE (verified Wave 106) | C4 | Wave 64 audit |
| BL-0531 | **BOM component availability check in DFM** — Integrate BOM stock data (from supplier APIs, once real) into the DFM flow. Flag unavailable or long-lead-time components as DFM risks before the user commits to a fab order. | DONE (Wave 138) | C4 | Wave 64 audit |
| BL-0532 | **Export file syntax validation** — 4 format validators (Gerber/Drill/IPC-2581/ODB++), wired to export routes with 422 on errors. | DONE (Wave 89) | C3 | Wave 64 audit |
| BL-0533 | **LCSC real-time part data sync** — `lcsc-jlcpcb-mapper.ts` currently uses 154 built-in static mappings. Add an optional API sync to fetch real-time prices, stock levels, and JLCPCB assembly availability from the LCSC open API. | DONE (verified Wave 106) | C4 | Wave 64 audit |
| BL-0646 | **Supplier pricing real integrations** — SupplierPricingEngine with 6 providers, single+bulk quoting, LRU caching, provider comparison. 49 tests. | DONE (Wave 147) | C4 | Repo gap audit 2026-03-13 |

### Learning & Content — Competitive Gaps (Wave 66 Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0627 | **Pre-built starter circuits with pre-loaded Arduino code** — 15 complete circuit+code combos across 5 categories with StarterCircuitsPanel gallery. | DONE (Wave 86) | C3 | Wave 66 / TinkerCAD + Fritzing |
| BL-0628 | **Bundled circuit+code example library** — 22 examples across 8 categories, tree view, search/filter, ExampleLibraryPanel in ArduinoWorkbench. | DONE (Wave 87) | C3 | Wave 66 / Arduino IDE + Fritzing |
| BL-0629 | **Etchable PCB export (DIY toner transfer)** — Mirrored SVG at 1:1 scale for toner transfer etching. Route handler + ExportPanel UI. | DONE (Wave 86) | C2 | Wave 66 / Fritzing |

### Import/Export

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0210 | EasyEDA import — JSON parser, coordinate conversion, 60+ package mappings, net building, board outline. 98 tests. | DONE (Wave 146) | C4 | MF-158 |
| BL-0211 | Cross-tool mapping validator — validateCrossToolConsistency() with 10 check types (net/layer/footprint/orphan/duplicate ref des). 48 tests. | DONE (Wave 141) | C4 | MF-161 |
| BL-0212 | Import repair assistant for broken files | DONE (verified Wave 106) | C3 | MF-162 |
| BL-0213 | Shareable simulation links with frozen settings | DONE (verified Wave 106) | C3 | MF-163 |
| BL-0214 | Import preview summary — diff dialog with add/modify/remove counts + warnings + conflicts. | DONE (Wave 88) | C2 | UX-051 |
| BL-0215 | Import mapping warnings (what got dropped) — MappingWarningsSection in ImportPreviewDialog, grouped by type (dropped/unsupported/converted/approximated), error banner, 49 tests. | DONE (Wave 105) | C2 | UX-052 |
| BL-0216 | Export pre-check screen — 17 format-specific validators, inline checklist UI. | DONE (Wave 88) | C2 | UX-053, IFX-032 |
| BL-0217 | Show exported files list and size after export — ExportResultsPanel with per-file sizes, auto-collapse, singleton manager, 42 tests. | DONE (Wave 105) | C1 | UX-054 |
| BL-0218 | Export profiles ("Fab ready", "Sim bundle", "Docs") — 4 built-in profiles + ExportProfileSelector UI. | DONE (verified Wave 105) | C2 | UX-056 |
| BL-0219 | Import history with one-click restore — ImportHistoryManager + ImportHistoryPanel, localStorage persistence, FIFO eviction, 49 tests. | DONE (Wave 105) | C2 | UX-057 |
| BL-0220 | Side-by-side diff: imported vs current design | DONE (Wave 109) | C3 | UX-058 |
| BL-0221 | Guided migration flow — MigrationWizard with source detection, compatibility assessment, step-by-step plans for 5 EDA tools. 94 tests. | DONE (Wave 146) | C4 | UX-059, IFX-093 |

### UX Polish — Editor & Navigation

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0230 | Mini-map for large schematic/PCB canvases | DONE (Wave 62) — PCBMiniMap in PCBLayoutView.tsx + SchematicCanvas MiniMap enhanced with pan/zoom/neon cyan styling | C2 | UX-038 |
| BL-0231 | Smart contextual radial menu — SVG pie segments, 5 view contexts, keyboard nav, RadialMenu component. | DONE (Wave 87) | C2 | UX-040 |
| BL-0232 | Click validation issue → focus camera + flash component — ReactFlow fitView + CSS validation-focus-pulse animation | DONE | C2 | Wave 60 |
| BL-0233 | "Why this rule matters" plain-language explanation | DONE (Wave 62) — DRC_EXPLANATIONS (28 rules) in drc-engine.ts, wired into ERCPanel + ValidationView with expandable toggles | C2 | UX-043 |
| BL-0234 | Persist panel sizes/collapsed state (localStorage) — debounced writes, ViewMode validation on restore | DONE | C2 | Wave 60 |
| BL-0235 | Command palette categories — 6 workflow-stage groups with filter tabs. | DONE (Wave 88) | C2 | UX-016 |
| BL-0236 | Context-aware shortcuts panel — ? overlay with 7 view contexts, keyboard key badges. | DONE (Wave 89) | C2 | UX-017 |
| BL-0237 | Recent projects with filters and pinning — RecentProjectsManager + RecentProjectsList + 3 sort modes + pinning + localStorage persistence. | DONE (verified Wave 105) | C2 | UX-019 |
| BL-0238 | Supplier comparison drawer (price, lead time, MOQ) | DONE (Wave 109) | C3 | UX-065 |
| BL-0239 | Auto-grouping for SMT/THT/manual assembly | DONE (Wave 108) | C3 | UX-066 |
| BL-0240 | Lifecycle warning badges (NRND/EOL) — LifecycleBadge on BOM cards + procurement summary counter with tooltip breakdown, 33 tests. | DONE (Wave 105) | C2 | UX-067 |
| BL-0241 | Cost optimization mode with goals/tradeoffs | DONE (verified Wave 106) | C3 | UX-068 |

### UX Polish — Integration Gaps (Wave 64 Audit)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0534 | **i18n string extraction pipeline** — `i18n-framework.ts` exists with dot-notation key lookup, interpolation, and ~100 en keys, but almost no UI strings are actually extracted. The majority of ProtoPulse UI is hardcoded English. Create a script to audit unextracted strings and a systematic extraction pass. | DONE (Wave 130) | C4 | Wave 64 audit |
| BL-0535 | **Community library → BOM integration** — community-bom-bridge.ts + AddToBomPrompt.tsx + tests. | DONE (verified Wave 106) | C3 | Wave 64 audit |
| BL-0536 | **Tutorial step context wiring** — targetView + targetElement on TutorialStep, 26 built-in steps annotated, TutorialNavigator with highlight/scroll, 54 tests. | DONE (Wave 105) | C2 | Wave 64 audit |
| BL-0537 | **ViewMode section grouping in sidebar** — 6 collapsible groups (Design/Analysis/Hardware/Manufacturing/AI & Code/Documentation) in sidebar-groups.ts, localStorage persistence, 43 tests. | DONE (verified Wave 106) | C2 | Wave 64 audit |
| BL-0538 | **Standard library auto-suggest during architecture design** — LibrarySuggestPopover + Fuse.js fuzzy matching + BOM integration on node drop, 175+ tests. | DONE (verified Wave 106) | C2 | Wave 64 audit |
| BL-0539 | **Snippet placement as atomic undo unit** — snippet-undo.ts batching implemented. | DONE (verified Wave 106) | C2 | Wave 64 audit |
| BL-0540 | **Alternate parts shown in Schematic BOM sidebar** — AlternatePartsPopover + useSchematicAlternates hook + fixed overlay in SchematicCanvas with per-instance popovers. | DONE (verified Wave 106) | C2 | Wave 64 audit |
| BL-0541 | **In-app "What's new" changelog panel** — WhatsNewPanel.tsx (Sheet) + changelog-panel.ts parser + localStorage unseen tracking + Gift icon badge, 22 tests. | DONE (verified Wave 106) | C2 | Wave 64 audit |
| BL-0542 | **Breadboard connectivity simulation overlay** — BreadboardConnectivityOverlay.tsx implemented. | DONE (verified Wave 106) | C3 | Wave 64 audit |
| BL-0543 | **Breadboard wire editing** — BreadboardWireEditor with selection, keyboard Delete, endpoint drag/move with grid snap, 65 tests. | DONE (verified Wave 106) | C2 | Wave 64 audit |
| BL-0544 | **Breadboard DRC overlay** — Show DRC violation markers (short circuits, unconnected required pins) overlaid on the breadboard view. Currently DRC runs on schematics only. | DONE (verified Wave 106) | C3 | Wave 64 audit |
| BL-0545 | **Circuit Code DSL: expand component library** — `circuit-api.ts` currently supports ~13 component types (resistor, capacitor, LED, BJT, MOSFET, etc.). Expand to 50+ types including op-amps, DACs, ADCs, shift registers, H-bridges, voltage regulators, and common Arduino shields. | DONE (verified Wave 106) | C4 | Wave 64 audit |
| BL-0546 | **Circuit Code DSL: complete IC pinout definitions** — The IR-to-schematic mapper uses placeholder pinout data for ICs. Populate a `pinout-db.ts` with real pinouts for the 30 most common ICs (555, LM741, ATmega328P, ESP32, etc.) so generated schematics have correct pin placement. | DONE (verified Wave 106) | C4 | Wave 64 audit |
| BL-0547 | **Circuit Code DSL: net type safety** — Add typed net declarations (`power`, `analog`, `digital`, `differential`) to the DSL so the evaluator can flag connections between incompatible net types (e.g. `analog` connected to `digital` without level shift). | DONE (verified Wave 106) | C4 | Wave 64 audit |
| BL-0548 | **Circuit Code DSL: run seed persistence** — Seed persisted to localStorage. | DONE (verified Wave 106) | C1 | Wave 64 audit |
| BL-0549 | **Collaboration UX: enable by default** — Collaboration is implemented but must be manually activated via API. Add a "Share for collaboration" button in the project header that generates and copies a collaboration invite link in one click. Surface the collaborator presence in the UI without requiring users to know about WebSocket endpoints. | DONE (verified Wave 106) | C3 | Wave 64 audit |

### UX Polish — Validation & DRC

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0250 | Rule presets by project type (Arduino, power, sensor) — drc-presets.ts implemented. | DONE (verified Wave 106) | C2 | UX-046 |
| BL-0251 | Compare current vs manufacturer rule set | DONE (verified Wave 106) | C3 | UX-047 |
| BL-0252 | Suppression workflow with reason + expiration — drc-suppression.ts implemented. | DONE (verified Wave 106) | C2 | UX-048 |
| BL-0253 | Guided remediation wizard (step-by-step fixes) | DONE (verified Wave 106) | C3 | UX-049 |
| BL-0254 | Risk score card for release readiness — release-readiness.ts with 5-category weighted scoring + grades, 58 tests. | DONE (Wave 107) | C3 | UX-050, IFX-031 |

### Security Hardening (P2)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0280 | **HSTS header missing** — Already set: `strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true }` in Helmet config (server/index.ts:88-91). | DONE (verified Wave 60) | C1 | GA-SEC-14 |
| BL-0281 | **Referrer-Policy header** — Already set: `referrerPolicy: { policy: 'strict-origin-when-cross-origin' }` in Helmet config (server/index.ts:92). | DONE (verified Wave 60) | C1 | GA-SEC-15 |
| BL-0282 | **CSP `unsafe-inline` for styles** — `style-src-attr: 'unsafe-inline'` required for Radix UI floating element positioning. `style-src-elem` uses CSP nonce. Accepted trade-off. | DONE (verified Wave 60) | C1 | GA-SEC-16 |
| BL-0283 | **scrypt cost factor not configured** — Already set: `N: 16384, r: 8, p: 1, maxmem: 64MB` in server/auth.ts:18. OWASP-compliant (2^14 recommended range). | DONE (verified Wave 60) | C1 | GA-SEC-19 |
| BL-0284 | **Auth endpoints lack brute-force protection** — Already implemented: `authLimiter` (10 attempts/15min) on POST /register + /login. Generic error messages prevent user enumeration. | DONE (verified Wave 60) | C1 | GA-SEC-07 |

### API & Data Contracts

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0285 | **No pagination on circuit endpoints** — add `limit/offset/sort` on instances/nets/wires | DONE (verified Wave 106) | C3 | GA-API-02 |
| BL-0286 | **API versioning** — ApiVersionManager with /api/v1/ prefixing, RFC 8594 deprecation headers, migration guides, OpenAPI info. 98 tests. | DONE (Wave 148) | C4 | GA-API-03 |
| BL-0287 | **No SSE reconnection logic** — Already implemented: `fetchWithRetry()` in ChatPanel.tsx with exponential backoff (1s/2s/4s), max 3 retries, "Reconnecting..." UI. Only retries on network TypeError. | DONE (verified Wave 60) | C3 | GA-API-05 |
| BL-0288 | **No SSE heartbeat events** — Already implemented: `:heartbeat\n\n` emitted via setInterval during SSE streaming in server/routes/chat.ts:543-547. | DONE (verified Wave 60) | C3 | GA-API-06 |
| BL-0289 | **Delete lifecycle inconsistent** — define global soft-vs-hard policy matrix by entity | DONE (Wave 138) — ADR 0009 created | C4 | GA-DATA-01 |
| BL-0290 | **No generated API types** — use zod-to-ts or OpenAPI; enforce in CI | DONE (verified Wave 106) | C4 | GA-API-04 |

### Performance (P2)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0291 | **99 inline style objects** — reviewed: mostly dynamic (transforms, colors, positioning). Static styles already use Tailwind. No action needed. | DONE (verified Wave 60) | C2 | GA-PERF-01 |
| BL-0292 | **Composite indexes** on soft-delete queries — all 4 tables now have proper indexes including `projects(ownerId, deletedAt)`. | DONE | C2 | Wave 60 |
| BL-0293 | **`ChatPanel.handleSend` 22-item useCallback dependency** — Already optimized: `sendStateRef` pattern reduces to single `[sendStateRef]` dependency. All state read at call time via ref. | DONE (verified Wave 60) | C2 | GA-PERF-02 |
| BL-0294 | **Undo/redo stacks have no depth limit** — Already configured: `DEFAULT_MAX_SIZE = 50` in undo-redo.ts with FIFO eviction on both undo and redo stacks. | DONE (verified Wave 60) | C2 | GA-PERF-07 |

### Platform & Ops

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0260 | Persistent job durability store (not in-memory only) | DONE (verified Wave 106) | C4 | MF-170 |
| BL-0261 | Full observability — structured logging (10K ring buffer), distributed tracing, alert rules with conditions. 59 tests. | DONE (Wave 147) | C4 | MF-171 |
| BL-0262 | Error taxonomy with stable error codes | DONE (verified Wave 106) | C3 | MF-173 |
| BL-0263 | Data retention policies and cleanup tooling | DONE (verified Wave 106) | C3 | MF-174 |
| BL-0264 | Deployment profiles (dev/staging/prod) with config validation | DONE (Wave 112) | C3 | MF-179 |
| BL-0265 | CI coverage gates and test quality thresholds | DONE (Wave 113) | C3 | MF-180 |
| BL-0266 | CSP policy parity across dev/prod — always-on CSP, `reportOnly: isDev`, wasm-unsafe-eval, dev connectSrc wildcards | DONE | C3 | Wave 61 |
| BL-0267 | Health/readiness checks tied to real dependencies — Already implemented: `/api/health` checks PostgreSQL connectivity, `/api/ready` checks DB + latency + cache + AI provider keys. Returns 503 if DB down. | DONE (verified Wave 60) | C3 | MF-172 |
| BL-0268 | Auth timing-safe compare + throttling for admin ops — Already implemented: `safeCompareAdminKey()` uses SHA-256 + timingSafeEqual. `adminRateLimiter` (5 req/60s) on admin endpoints. | DONE (verified Wave 60) | C3 | MF-168 |

### Tech Debt (from code review / Wave 51)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0270 | `mulberry32` PRNG extracted to `shared/prng.ts` — monte-carlo.ts, gpu-monte-carlo.ts, generative.ts all import from shared | DONE | C3 | Wave 60 |
| BL-0271 | GPU Monte Carlo evaluator runs on CPU — implement actual GPU batch-solve pipeline | DONE (verified Wave 106) | C4 | Wave 51 review |
| BL-0272 | TelemetryLogger not connected to DeviceShadow live overlay — telemetry-shadow-bridge.ts with 10Hz throttle + auto-start hook, 28 tests. | DONE (Wave 107) | C3 | Wave 51 review |
| BL-0273 | Component Editor auto-save fires every 2s during active drawing (mouse-move driven) — FALSE POSITIVE: debounce works correctly, timer resets on each state change, save fires only 2s after last change | DONE | C2 | Wave 88 |
| BL-0274 | React.memo on high-frequency components — HistoryList, ProjectExplorer, SortableBomRow, BomCardItem memoized | DONE | C3 | Wave 61 |
| BL-0275 | `backdrop-blur-xl` GPU jank on low-end devices — useOptimizedBlur hook + GPU detection + reduced-motion fallback, 87 tests. | DONE (Wave 107) | C2 | app-audit §15 |
| BL-0276 | No cache headers on API responses — relying entirely on client-side React Query cache | DONE (verified Wave 106) | C3 | app-audit §16 |

### Cross-Tool Integration — All Domains (Wave 65 Audit)

> These are integration gaps between features that exist independently but don't talk to each other. Each one chips away at the "one tool" promise.

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0559 | **PCB → Schematic back annotation** — BackAnnotationManager extended with PCB-specific methods (syncRefDesChange, syncPropertyChange). 29 tests. | DONE (Wave 139) | C4 | Wave 65 audit |
| BL-0560 | **Simulation results overlay on schematic canvas** — After running a DC operating point or transient simulation, node voltages and branch currents should optionally render as colored annotations directly on the schematic (probe labels at nodes, current arrows on wires). Currently simulation results exist only in the SimulationPanel — there is zero visual connection between simulation output and the schematic that produced it. | DONE (Wave 79) | C4 | Wave 65 audit |
| BL-0561 | **PDN/SI analysis reads actual routed PCB geometry** — pcb-geometry-bridge.ts with extractTraceGeometries() + traceGeometryToPdnInput/SiInput converters. 34 tests. | DONE (Wave 140) | C4 | Wave 65 audit |
| BL-0562 | **Thermal analysis reads actual component placement** — pcb-thermal-bridge.ts with PACKAGE_THERMAL_DB (15 packages) + extractThermalComponents(). 30 tests. | DONE (Wave 139) | C4 | Wave 65 audit |
| BL-0563 | **BOM back-annotation to schematic** — BackAnnotationManager singleton with findMatchingInstances(), generateBomBackAnnotationPatch(), patch CRUD. 38 tests. | DONE (Wave 139) | C4 | Wave 65 audit |
| BL-0564 | **Assembly cost estimator reads actual BOM** — `AssemblyCostEstimator` uses a manually entered part list. It should read from the current project's `bom_items` table as its input, so users don't re-enter data they've already captured in the BOM. | DONE (Wave 82) | C3 | Wave 65 audit |
| BL-0565 | **Inline supplier stock/price in BOM view** — The BOM table shows manufacturer and MPN but not real-time stock or pricing. Supplier data (from `supplier-apis.ts`, once real — see BL-0485) should be surfaced inline in the BOM row (stock badge, best price, lead time) without requiring a trip to the Procurement view. | DONE (verified Wave 106) | C4 | Wave 65 audit |
| BL-0566 | **DRC/PCB violation click → navigate to PCB canvas** — Clicking a PCB DRC violation in the ValidationView navigates to the Schematic (because the existing `validation-focus-pulse` logic was built for architecture/schematic). PCB DRC violations should switch the active view to PCB, center the viewport on the offending trace/pad, and pulse it. | DONE (Wave 78) | C3 | Wave 65 audit |
| BL-0567 | **Schematic component values → SPICE model auto-population** — When a resistor with `value: "10k"` is placed in the schematic, generating SPICE for simulation should auto-use that value rather than requiring the user to re-enter it in the SPICE editor. Currently the SPICE generator and the circuit instance schema are not linked — SPICE element values must be specified separately. | DONE | C3 | Wave 70 |
| BL-0568 | **Design snapshot restore cascade** — analyzeSnapshotDomains() + generateRestorePlan() with cross-domain dependency warnings. 46 tests. | DONE (Wave 140) | C4 | Wave 65 audit |
| BL-0569 | **Global cross-domain search** — There is no single search box that queries across schematic instances + BOM items + architecture nodes + community library + standard library + design history simultaneously. Finding "where is my LM7805?" requires checking five different panels manually. A unified search (like VS Code's Ctrl+P but for design objects) would dramatically improve navigation on complex projects. | DONE | C4 | Wave 70 |

### Cross-Tool Integration — Second Pass (Wave 65 Audit, continued)

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0570 | **Architecture node → spawn schematic instance** — An architecture node typed as "Arduino Mega" or "LM7805" has zero connection to the schematic. Right-clicking a node should offer "Create schematic instance" which opens the schematic view and places the corresponding component. Without this, the architecture diagram is a whiteboard that contributes nothing to the rest of the design. | DONE | C4 | Wave 70 |
| BL-0571 | **Schematic ↔ Breadboard shared netlist** — The schematic canvas and breadboard view both represent the same physical circuit but share zero data. Placing a component in the schematic should offer to add it to the breadboard, and breadboard wire connections should be reflected as schematic nets. This is Fritzing's core differentiator — ProtoPulse has both views but no bridge between them. | DONE (verified Wave 106) | C5 | Wave 65 audit |
| BL-0572 | **DFM violations → highlight on PCB canvas** — `DfmChecker` results are displayed as a text list in the procurement/validation area. Clicking a violation should navigate to the PCB view and highlight the affected component/courtyard, exactly as BL-0566 does for DRC violations. Currently DFM and the PCB canvas are completely disconnected. | DONE (Wave 108) | C3 | Wave 65 audit |
| BL-0573 | **Design Variables ↔ SPICE simulation parameters** — `DesignVariablesPanel` stores named parameters (e.g. `Vcc = 5`, `R_load = 1k`). These should be importable as SPICE `.param` directives so the simulation automatically uses your design's variables instead of requiring manual re-entry. Currently the two systems exist independently with zero connection. | DONE (verified Wave 106) | C3 | Wave 65 audit |
| BL-0574 | **Monte Carlo ↔ BOM component tolerances** — bom-tolerance-bridge.ts with parseTolerance(), DEFAULT_TOLERANCE_BY_KEYWORD, bomItemsToToleranceSpecs(). tolerance column added to bom_items. 26 tests. | DONE (Wave 139) | C4 | Wave 65 audit |
| BL-0575 | **AI Chat → trigger and deliver exports** — The AI can discuss exports and explain how to use them, but it cannot actually invoke an export and provide a download link. Add AI tools `trigger_export` and `get_export_status` so the AI can say "I'll export this as KiCad 7 for you" and follow through. Currently the entire export system is unreachable from AI. | DONE | C3 | Wave 70 |
| BL-0576 | **AI Chat → simulation results in system prompt context** — Simulation output (DC operating voltages, transient waveform peaks, Monte Carlo yield, thermal hotspots) is never included in the AI's context. AI answers about "why is my circuit misbehaving" have zero access to what the simulation actually showed. Add a `buildSimulationContext()` function that summarizes the most recent simulation result and includes it in the system prompt. | DONE | C3 | Wave 70 |
| BL-0577 | **Digital Twin → out-of-spec telemetry creates validation issues** — When a connected device sends telemetry that exceeds a component's operating bounds (e.g. VCC = 4.1V, temperature = 87°C), the Digital Twin should automatically create a `validation_issue` record (type: "hardware-telemetry", severity: "warning") so it shows up in the ValidationView. Currently the Digital Twin and the validation system have zero connection. | DONE (Wave 132) | C4 | Wave 65 audit |
| BL-0578 | **Engineering Calculators → apply result to design** — After computing a result in any calculator (Ohm's Law: R = 330Ω; RC filter: C = 100nF), there should be an "Add to BOM" and "Apply to component" button that uses the result as the value for a selected BOM item or schematic instance. Currently results must be manually transcribed — the calculators are completely isolated from the rest of the design. | DONE (verified Wave 106) | C3 | Wave 65 audit |
| BL-0579 | **Export → auto-create design snapshot** — export-snapshot.ts with shouldAutoSnapshot + createExportSnapshot for manufacturing formats, 41 tests. | DONE (Wave 107) | C3 | Wave 65 audit |
| BL-0580 | **Validation ↔ BOM completeness warnings** — BOM items with missing MPN, blank manufacturer, or unverified specs should generate validation issues (severity: "info" or "warning") in the ValidationView, e.g. "R3 has no MPN — cannot verify for manufacturing." Currently BOM and validation are entirely decoupled; you can submit a BOM full of blank fields and the validator never notices. | DONE (Wave 85) | C4 | Wave 65 audit |
| BL-0581 | **Standards Compliance → unified ValidationView** — `StandardsCompliance` checker (IPC-2221, IPC-7711, RoHS, etc.) produces a separate panel/report. Its results should appear as first-class items in the `ValidationView` alongside DRC and ERC violations, with the same severity badges, group-by, filter, and click-to-navigate UX. Currently standards compliance is a completely separate surface. | DONE (Wave 133) | C4 | Wave 65 audit |
| BL-0582 | **Unified component search across Standard Library + Community Library + BOM** — Users must search Standard Library and Community Library in separate panels, and there is no way to search BOM items from either. A single "Find component" search (Ctrl+K equivalent) that queries all three simultaneously and surfaces the best match — with an "Add to BOM" or "Place on schematic" action — would eliminate most of the cross-panel navigation overhead. | DONE (Wave 129) | C4 | Wave 65 audit |
| BL-0583 | **Design Patterns → place schematic instances (not just arch nodes)** — SnippetCircuitInstance/SnippetCircuitNet types, prepareForPlacement() extended with ID remapping + position offsetting, 3 built-in snippets with circuit data. 60 tests. | DONE (Wave 139) | C4 | Wave 65 audit |
| BL-0584 | **Arduino Workbench → Knowledge Hub compile error linking** — When a compile error appears in the Workbench console, pattern-match it against known error signatures ("undefined reference to", "library not found", "no such file") and surface an inline link to the relevant Knowledge Hub article or a one-liner fix hint. Currently the 20-article knowledge hub is completely unreachable from the Workbench. | DONE (verified Wave 106) | C3 | Wave 65 audit |
| BL-0585 | **Component Editor → SPICE model / subcircuit attachment** — Custom components defined in the Component Editor have no SPICE model field. When those components are placed in a schematic and a simulation runs, they are silently ignored or cause missing-model errors. Add a SPICE subcircuit (`.subckt`) text field to component definitions so custom ICs and modules can participate in simulation. | DONE (verified Wave 106) | C3 | Wave 65 audit |
| BL-0586 | **Export panel → one-click complete fab package** — There is no single action that produces a complete manufacturing package (Gerbers + drill + BOM CSV + CPL CSV + readme.txt) as a single zip download. This bundle is only reachable by going through the full PCB ordering wizard. Add a standalone "Download fab package" button in the Export panel that generates it without requiring an order to be placed. | DONE (Wave 127) | C4 | Wave 65 audit |
| BL-0644 | **Export / ordering / simulation flows need explicit circuit selection** — Several multi-circuit project flows still default to `circuits[0]` when exporting, ordering, or running analysis. Require an explicit circuit target or stable project-level default before generating user-facing artifacts. | DONE (verified Wave 106) | C3 | Repo gap audit 2026-03-13 |
| BL-0650 | **Design Variables should be project-backed design data** — `DesignVariablesPanel` still persists variables in browser storage. Move them into project/export/history/collaboration flows so named parameters survive reloads, devices, and project handoff. | DONE (Wave 124) | C3 | Repo gap audit 2026-03-13 |
| BL-0651 | **Circuit Code preview must materialize into real schematic/project state** — The DSL pipeline currently stops at read-only preview. Add a safe "Apply to project" flow that creates real design objects, supports undo, and makes Circuit Code a true authoring path instead of a sandbox. | DONE (Wave 131) | C4 | Repo gap audit 2026-03-13 |
| BL-0652 | **Architecture expansion needs semantic pin mapping and better part matching** — The architecture→schematic expansion route still warns that it uses each part's first pin as a placeholder. Replace placeholder wiring with semantic connector mapping and higher-fidelity part resolution. | DONE (Wave 124) | C3 | Repo gap audit 2026-03-13 |
| BL-0655 | **Generative design candidates need apply/export/adopt workflows** — The generative design surface can evolve and score candidates, but winning options remain dead ends. Add actions to compare against the current design and promote a candidate into real project state. | DONE (verified Wave 106) | C3 | Repo gap audit 2026-03-13 |

### Tech Debt — Wave 64 Audit Additions

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0550 | **GPU Monte Carlo: implement actual GPU pipeline** — GpuMonteCarloEngine class with async init (3-attempt retry), run (GPU/CPU dispatch), dispose. 28 tests. | DONE (Wave 140) | C4 | Wave 64 audit |
| BL-0551 | **TelemetryLogger → DeviceShadow live overlay wiring** — `telemetry-logger.ts` persists frames to IndexedDB and `device-shadow.ts` tracks reported/desired state, but the Digital Twin overlay in `DigitalTwinView` reads only the shadow snapshot, not the live telemetry ring buffer. Wire `TelemetryLogger.subscribe()` to update the overlay in real time. | DONE (Wave 124) | C3 | Wave 64 audit |
| BL-0552 | **API type generation CI gate** — `shared/api-types.generated.ts` exists but is generated manually and not enforced in CI. Add a `npm run check:api-types` script that regenerates and compares against committed types, failing if they drift. | DONE (verified Wave 106) | C3 | Wave 64 audit |
| BL-0643 | **Async jobs need real executor registration in production** — The job queue framework is solid, but many submitted job types still fail immediately when no executor is registered. Wire actual runtime executors for the supported async workflows and add startup validation so broken job types are obvious. | DONE (Wave 124) | C3 | Repo gap audit 2026-03-13 |

---

## P3 — Low (Nice-to-Have / Long-Term Vision)

### Learning & Education

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0300 | Step-by-step beginner learning path (zero to PCB) | DONE (Wave 155) | C4 | MF-033 |
| BL-0301 | Guided "first PCB" interactive tutorial | DONE (Wave 111) | C3 | MF-035 |
| BL-0302 | Lesson mode that locks UI to only needed controls | DONE (verified Wave 106) | C3 | MF-036 |
| BL-0303 | Skill-level adaptive hints (beginner/intermediate/advanced) | DONE (Wave 155) | C3 | MF-038, IFX-066 |
| BL-0304 | Lab/assignment templates for educators | DONE (verified Wave 106) | C3 | MF-041 |
| BL-0305 | Classroom mode — ClassroomManager with assignments, rubric grading, submissions, class stats, CSV export. 60+ tests. | DONE (Wave 150) | C5 | MF-042, IFX-067 |
| BL-0306 | Interactive troubleshooting wizard for common mistakes | DONE (verified Wave 106) | C3 | MF-043, IFX-063 |
| BL-0307 | First-run checklist with progress — first-run-checklist.ts + FirstRunChecklist.tsx implemented. | DONE (verified Wave 106) | C2 | UX-071 |
| BL-0308 | Guided sample projects ("learn by doing") | DONE (verified Wave 106) | C3 | UX-072, IFX-062 |
| BL-0309 | Beginner mode with simplified UI labels | DONE (verified Wave 106) | C3 | UX-073, IFX-061 |
| BL-0310 | Role presets (Student/Hobbyist/Pro) tune UI density | DONE (verified Wave 106) | C3 | UX-075, IFX-076 |
| BL-0311 | Smart hints triggered by repeated user mistakes | DONE (verified Wave 106) | C3 | UX-076 |
| BL-0312 | "Explain this panel" button everywhere — ExplainPanelButton.tsx + panel-explainer.ts implemented. | DONE (verified Wave 106) | C2 | UX-077 |
| BL-0313 | Per-view onboarding hints for first 3 uses | DONE (Wave 108) | C2 | UX-018 |
| BL-0314 | Progress milestones from beginner to fab-ready | DONE (Wave 110) | C3 | IFX-064 |

### Accessibility

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0320 | Keyboard-operable resize handles | DONE (Wave 111) | C2 | UX-081 |
| BL-0321 | Visible focus rings on all interactive controls | DONE (Wave 111) | C2 | UX-082 |
| BL-0322 | Fix off-screen tooltip placement | DONE (Wave 122) | C1 | UX-083 |
| BL-0323 | Explicit `type` attribute on all form buttons | DONE (Wave 122) | C1 | UX-084 |
| BL-0324 | Improve color contrast in low-contrast surfaces | DONE (Wave 108) | C2 | UX-085 |
| BL-0325 | Reduced-motion mode | DONE (verified Wave 106) | C2 | UX-086 |
| BL-0326 | Screen-reader labels for canvas actions | DONE (Wave 111) | C2 | UX-088 |
| BL-0327 | Full keyboard-first editing mode | DONE (Wave 138) - Arrow keys now natively move and persist selected nodes | C4 | UX-090 |
| BL-0328 | Accessibility audit dashboard with tracked fixes | DONE (Wave 112) | C3 | UX-089 |
| BL-0329 | Font scaling and spacing options | DONE (Wave 110) | C2 | UX-087 |

### Mobile & Responsive

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0340 | Tablet layout for side panels/inspectors | DONE (Wave 113) | C3 | UX-091 |
| BL-0341 | Touch-safe controls in compact mode | DONE (Wave 112) | C2 | UX-092 |
| BL-0342 | Mobile overflow handling for long tables | DONE (Wave 112) | C2 | UX-093 |
| BL-0343 | Mobile "review mode" for comments/checks | DONE (Wave 113) | C2 | UX-094 |
| BL-0344 | Bottom nav for core mobile actions | DONE (Wave 113) | C3 | UX-095 |
| BL-0345 | Gesture shortcuts (pinch zoom, two-finger pan) | DONE (Wave 113) | C3 | UX-096 |
| BL-0346 | Mobile capture workflows (photo→part, notes→BOM) | DONE (Wave 115) | C3 | UX-097 |
| BL-0347 | Responsive layout presets by device type | DONE (Wave 115) | C3 | UX-100 |

### Visual Design System

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0350 | Standardize icon language by domain | DONE (Wave 114) | C2 | UX-102 |
| BL-0351 | Consistent spacing scale and typography tokens | DONE (Wave 115) | C3 | UX-104 |
| BL-0352 | Light theme and OLED-black theme options | DONE (Wave 138) | C4 | UX-105, MF-192 |
| BL-0353 | Consistent motion language for transitions | DONE (Wave 114) | C2 | UX-106 |
| BL-0354 | State illustrations for empty/error/offline pages | DONE (Wave 114) | C2 | UX-107 |
| BL-0355 | Design system docs site in-app | DONE (Wave 116) | C3 | UX-108 |

### Performance Perception

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0360 | Operation duration hints for long actions | DONE (Wave 122) | C1 | UX-112 |
| BL-0361 | Partial loading per panel instead of blocking whole view | DONE (Wave 115) | C3 | UX-113 |
| BL-0362 | Background prefetch for likely next views | DONE (Wave 114) | C2 | UX-114 |
| BL-0363 | Progressive render for large lists/tables | DONE (Wave 114) | C2 | UX-115 |
| BL-0364 | "Slow path detected" UX with suggestions | DONE (Wave 115) | C2 | UX-117 |

### Developer Platform

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0370 | Public API + webhooks — 20+ endpoint catalog, webhook CRUD, HMAC signatures, OpenAPI spec generation. 55+ tests. | DONE (Wave 150) | C5 | MF-181, IFX-092 |
| BL-0371 | Plugin/extension SDK — manifest validation, permission system, sandboxed context, 3 built-in plugins. 55+ tests. | DONE (Wave 150) | C5 | MF-182, IFX-091 |
| BL-0372 | Macro recorder/player for repeated actions | DONE (Wave 116) | C3 | MF-183 |
| BL-0373 | Custom keybinding editor | DONE (Wave 116) | C3 | MF-184 |
| BL-0374 | Scriptable command palette actions — 12 built-in commands, fuzzy search, shortcut parsing, execution history, import/export. 76 tests. | DONE (Wave 143) | C4 | MF-185 |
| BL-0375 | CLI tooling for headless validation/export — HeadlessRunner with 8 built-in commands, arg parsing, table/JSON formatters. 85 tests. | DONE (Wave 146) | C4 | MF-188 |
| BL-0376 | Git-native design diff/merge | DONE (verified Wave 106) | C5 | MF-189 |
| BL-0377 | Public embed API for schematic/PCB views | DONE (verified Wave 106) | C4 | MF-164 |
| BL-0378 | Versioned API docs synced from live routes | DONE (Wave 117) | C3 | MF-165 |
| BL-0711 | Rename `.claude/hooks/never-idle-while-waiting.sh` to reflect new decision-ladder semantics (e.g. `wait-time-advisor.sh`). Hook was rewritten 2026-04-18 to replace "NEVER IDLE" pressure with a 3-tier ladder (BEST in-session work / OK wait-with-status / BAD past-cap dispatching). Filename still says "never-idle" which misrepresents the contract. Rename requires: `.claude/hooks/*.sh` move, update `.claude/settings.json` hook registration, grep all docs/memory for hook-name references. XS effort, clean single-wave cleanup. | OPEN | C1 | Session 2026-04-18 cleanup after 17-agent overdispatch incident |
| BL-0712 | Stop hook spam-loop fix — the Stop hook fires near-identical "agents in-flight, cannot verify" feedback on every stop attempt, creating a hold→stop-hook→"Holding"→stop-hook cycle with no new information between iterations. Tyler 2026-04-18 feedback: "Is there a way to update or improve the stop hooks to where they don't constantly run over and over and over and over and over again." Fixes: (1) state-hash deduplication — sidecar `~/.claude/hooks/.stop-hook-last-fire.json` tracks last-fire agent-ID set + timestamp; if same agents still in-flight AND < 2 min since last fire, suppress re-fire or emit one-liner; (2) progress detection — if `git log --since=lastfire` shows no new commits AND no agent completion notifications since last fire, skip the full verification nag; (3) max-fire cap — after 3 fires per stop sequence, emit "N warnings, allowing stop" and exit 0 without blocking; (4) exponential verbosity backoff — 1st fire full detail, 2nd summary, 3rd one-liner, 4th+ silent; (5) scope limit — don't block on agents that were spawned in this session and whose completion the assistant has already acknowledged. Goal: signal when something changes, not constant repetition. | OPEN | C2 | Session 2026-04-18 Tyler rage-feedback |

### Advanced Collaboration

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0380 | SSO/OIDC — 7 preset providers, PKCE S256, JWT decode, token refresh, group-to-role mapping. 105 tests. | DONE (Wave 148) | C4 | MF-176 |
| BL-0381 | RBAC + org/team tenancy model | DONE (verified Wave 106) | C5 | MF-177 |
| BL-0382 | Audit log explorer UI | DONE (Wave 116) | C3 | MF-178 |
| BL-0383 | Customizable workspace presets | DONE (Wave 116) | C2 | UX-020 |
| BL-0384 | Team command center | DONE (Wave 117) | C3 | IFX-119 |

### Advanced Navigation

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0390 | Interaction history timeline for step-back | DONE (Wave 117) | C3 | UX-039, IFX-078 |
| BL-0391 | Breadcrumbs for deep editor contexts | DONE (verified Wave 106) | C2 | UX-014 |
| BL-0392 | Quick jump/search for views and tools | DONE (Wave 117) | C3 | UX-013 |

### Arduino IDE Integration

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0400 | One-click "Open in Arduino IDE" from design | DONE (Wave 118) | C3 | ARDX-001 |
| BL-0401 | Round-trip diff viewer — LCS-based line diff, hunk grouping, similarity score, unified diff output, conflict detection. 74 tests. | DONE (Wave 144) | C4 | ARDX-003 |
| BL-0402 | Build/compile status panel | DONE (Wave 117) | C2 | ARDX-006 |
| BL-0403 | Upload firmware with full log output | DONE (verified Wave 106) | C3 | ARDX-007 |
| BL-0404 | Dependency resolver for Arduino libraries — extractIncludes(), 30+ KNOWN_LIBRARY_HEADERS, resolveDependencies() with conflict detection. 42 tests. | DONE (Wave 140) | C4 | ARDX-009 |
| BL-0405 | Board package/version checker | DONE (Wave 119) | C3 | ARDX-010 |
| BL-0406 | Per-project board profile | DONE (verified Wave 106) | C2 | ARDX-011 |
| BL-0407 | Save last known good firmware build | DONE (Wave 120) | C3 | ARDX-012 |
| BL-0408 | Pre-upload safety checks | DONE (Wave 120) | C3 | ARDX-015 |
| BL-0409 | AI sketch starter from schematic | DONE (Wave 121) | C3 | ARDX-016 |
| BL-0410 | Smart code snippets per component | DONE (Wave 120) | C3 | ARDX-017 |
| BL-0411 | Board-aware suggestions (timers, PWM limits) | DONE (Wave 121) | C3 | ARDX-021 |
| BL-0412 | "Refactor to non-blocking" assistant — 13 blocking patterns detected with code snippet alternatives + scoring. 63 tests. | DONE (Wave 141) | C4 | ARDX-022 |
| BL-0413 | ISR safety scanner — 8 rules for ISR violations, findIsrBodies() + scanForIsrViolations(). 58 tests. | DONE (Wave 140) | C4 | ARDX-023 |
| BL-0414 | RAM usage early-warning | DONE (Wave 119) | C3 | ARDX-024 |
| BL-0415 | Flash size budget tracker | DONE (Wave 119) | C3 | ARDX-025 |
| BL-0416 | Loop-time profiler overlay — profileLoop() with 50+ operation timing DB, section categorization, estimated Hz, top-5 bottlenecks. 55 tests. | DONE (Wave 141) | C4 | ARDX-026 |
| BL-0417 | Auto state-machine skeletons for robotics | DONE (Wave 121) | C3 | ARDX-027 |
| BL-0418 | Live variable watch over serial — VariableWatchManager singleton, 5 parse formats, rolling history, stats (min/max/avg/rate). 79 tests. | DONE (Wave 141) | C4 | ARDX-028 |
| BL-0419 | Library conflict detector | DONE (Wave 119) | C3 | ARDX-067 |
| BL-0420 | AI "fix compile errors" action | DONE (verified Wave 106) | C4 | ARDX-076 |
| BL-0421 | AI "explain this sketch for a beginner" | DONE (Wave 121) | C2 | ARDX-077 |
| BL-0422 | Smart library install on compile error | DONE (Wave 121) | C3 | ARDX-066 |
| BL-0423 | Firmware version linked to design snapshot — FirmwareVersionTracker with semantic labels, sketch hashing, snapshot linking, version diffing. 60 tests. | DONE (Wave 142) | C4 | ARDX-056 |
| BL-0424 | One-click rollback to known-good sketch | DONE (Wave 121) | C3 | ARDX-057 |
| BL-0425 | Secrets scan before upload (API keys in sketch) | DONE (Wave 118) | C3 | ARDX-096 |
| BL-0426 | Hard block upload if target board mismatch | DONE (Wave 120) | C3 | ARDX-097 |

### Innovation Ideas

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0430 | AI co-designer — session management, constraint-based scoring, comparison matrix, refinement iterations. 77 tests. | DONE (Wave 143) | C4 | IFX-009 |
| BL-0431 | AI root-cause map — 21 failure patterns, causal graph, cross-domain correlation, probability scoring, fix recommendations. 80 tests. | DONE (Wave 149) | C5 | IFX-010 |
| BL-0432 | Monte Carlo visual risk envelope | DONE (Wave 122) | C3 | IFX-016 |
| BL-0433 | Expected-vs-observed sim overlay from telemetry — SimTelemetryOverlayManager with severity classification, trend tracking, health scoring. 78 tests. | DONE (Wave 142) | C4 | IFX-017 |
| BL-0434 | Auto-tuning assistant for control loops (PID) — Ziegler-Nichols + Cohen-Coon tuning, step response analysis, Arduino code generation. 59 tests. | DONE (Wave 142) | C4 | IFX-020, ARDX-055 |
| BL-0435 | Bench dashboard preset (upload/log/plot/debug) | DONE (Wave 122) | C3 | IFX-026 |
| BL-0436 | Hardware incident bundle export | DONE (Wave 123) | C3 | IFX-028 |
| BL-0437 | Guided "board doctor" conversational diagnostics — 42-node decision tree, 7 symptom categories, fuzzy symptom matching, session tracking. 114 tests. | DONE (Wave 142) | C4 | IFX-030 |
| BL-0438 | Predictive yield estimator — 10 independent yield factors, Cpk calculation, cost impact, improvement suggestions. 75 tests. | DONE (Wave 144) | C4 | IFX-040 |
| BL-0439 | Community template packs | DONE (Wave 118) | C2 | IFX-095 |
| BL-0440 | Marketplace for reusable circuit blocks — MarketplaceManager with 12 seed items, fuzzy search, install/rate/publish. 72 tests. | DONE (Wave 145) | C4 | IFX-096 |
| BL-0441 | "Remix this design" from public examples | DONE (Wave 123) | C3 | IFX-101 |
| BL-0442 | Build journals (auto notes as project evolves) | DONE (Wave 120) | C3 | IFX-102 |
| BL-0443 | Project scorecards (cost, risk, readiness) | DONE (Wave 123) | C3 | IFX-104 |
| BL-0444 | Smart reminders for unfinished critical steps | DONE (Wave 118) | C2 | IFX-105 |
| BL-0445 | Creator profile pages for shared projects | DONE (Wave 118) | C2 | IFX-107 |

### Moonshots

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0450 | End-to-end idea to PCB — 18 steps across 8 stages, prerequisite blocking, complexity multipliers, critical path, recommendations. 74 tests. | DONE (Wave 151) | C5 | IFX-111 |
| BL-0451 | Co-design flow — cross-domain sync points, conflict detection, enclosure generation, 10-material DB, firmware resource tracking. 72 tests. | DONE (Wave 151) | C5 | IFX-112 |
| BL-0452 | AI textual product goals → architecture — 35+ keyword rules, 12 domain detectors, 36-component knowledge base, 2-3 architecture candidates. 75 tests. | DONE (Wave 144) | C4 | IFX-113 |
| BL-0453 | Automated bench robot — BenchRobotManager with 7 command types, test sequences, auto-generate from schematic, CSV/JSON export. 91 tests. | DONE (Wave 153) | C5 | IFX-114 |
| BL-0454 | Multi-board system orchestrator — board CRUD, inter-board links, power budget, BFS signal tracing, topology validation, cost estimation. 59 tests. | DONE (Wave 151) | C5 | IFX-115, ARDX-065 |
| BL-0455 | AR overlay — 7 board layouts, DLT perspective transform, pin/net highlighting, alt function lookup. 99 tests. | DONE (Wave 147) | C4 | IFX-079 |
| BL-0456 | Voice-driven workflow — 20 built-in voice commands, Levenshtein fuzzy matching, parameterized templates. 59 tests. | DONE (Wave 147) | C4 | IFX-080, ARDX-094 |
| BL-0457 | Self-healing assistant — 12 hazard detectors, fix proposals with component additions, approval gates with expiry. 94 tests. | DONE (Wave 149) | C5 | IFX-089, ARDX-084 |
| BL-0458 | Predictive failure alerts — 6 anomaly types (trend/spike/drift/oscillation/flatline), time-to-threshold extrapolation. 71 tests. | DONE (Wave 145) | C4 | IFX-090 |
| BL-0459 | Circuit sandbox game with score/feedback | DONE (Wave 123) | C3 | IFX-069 |
| BL-0460 | AI tutor persona (Socratic questioning) | DONE (Wave 123) | C3 | IFX-070 |
| BL-0461 | Firmware-aware simulation — FirmwareSimManager with Arduino API, pin I/O, interrupts, timers, circuit bridge, 4 board configs. 80 tests. | DONE (Wave 150) | C5 | ARDX-046 |
| BL-0462 | HIL-lite mode — 8 waveform generators, 12 sensor presets, batch generation, 3 output formats. 71 tests. | DONE (Wave 145) | C4 | ARDX-054 |
| BL-0463 | Real-time drift detection — DriftDetector with rolling window, drift rate, recalibration estimation, health assessment. 60 tests. | DONE (Wave 145) | C4 | ARDX-112 |
| BL-0464 | Time machine playback — 100K event ring buffer, multi-domain timeline, state reconstruction, playback controls, bookmarks. 92 tests. | DONE (Wave 150) | C5 | ARDX-113 |
| BL-0465 | "Design-to-drive" mode — 6 test modes, pin inference from schematic, Arduino sketch generation with Serial reporting. 112 tests. | DONE (Wave 149) | C5 | ARDX-106 |
| BL-0466 | AI copilot co-debugs wiring + firmware together | DONE (Wave 138) - Genkit Co-Debug flow in Serial Monitor | C5 | ARDX-107 |
| BL-0467 | Mission mode — 7 phases (concept→ship), milestones, risk assessment, cost breakdowns, packing list, BOM costing. 95 tests. | DONE (Wave 153) | C5 | IFX-120 |
| BL-0553 | **3D viewer WebGL framework** — WebGLViewerEngine with 9 layers, 8 cameras, 23 packages, 6 materials, geometry creation, layer stack, raycasting. 133 tests. | DONE (Wave 148) | C4 | Wave 64 audit |
| BL-0554 | **AC analysis harmonic distortion (THD/IMD)** — Radix-2 DIT FFT, 4 window functions, THD/IMD computation, spectral peak detection, classification. 59 tests. | DONE (Wave 145) | C4 | Wave 64 audit |
| BL-0555 | **SI Advisor + PDN deep integration** — SiPdnIntegrationEngine with cross-domain issue detection, SSN estimation, unified scoring, prioritized recommendations. 67 tests. | DONE (Wave 146) | C4 | Wave 64 audit |
| BL-0556 | **BGA fanout and escape routing** — 3 fanout patterns (dog-bone/via-in-pad/escape-channel), 6 BGA presets, 6 DRC violation types, pattern recommendation. 60 tests. | DONE (Wave 146) | C4 | Wave 64 audit |
| BL-0557 | **Circuit Code DSL: pin alias and local net naming** — Allow named local nets within a DSL block scope (e.g. `const vref = net('VREF')`) so that complex sub-circuits can be composed without polluting the global net namespace. Enables reusable DSL modules. | DONE (Wave 124) | C3 | Wave 64 audit |
| BL-0630 | **Scratch-like block programming** — 28 block types across 9 categories, block-to-C++ code generation, C++-to-blocks parsing, validation, category coloring. 97 tests. | DONE (Wave 153) | C5 | Wave 66 / TinkerCAD |
| BL-0631 | **Simulator-based firmware execution (QEMU / simavr)** — Run compiled Arduino firmware in a software simulator (simavr for AVR, QEMU for ARM/RISC-V) without physical hardware. Debug with breakpoints, inspect registers and memory, fast-forward time. PlatformIO supports this via `test_speed = host`. Enables full development and testing workflow for users without hardware at hand. | DONE (verified Wave 106) | C5 | Wave 66 / PlatformIO |
| BL-0632 | **Hardware debugger** — 6 probe profiles, debug session lifecycle, breakpoints/watchpoints, variable inspection, peripheral registers, GDB/OpenOCD config generation. 130 tests. | DONE (Wave 151) | C5 | Wave 66 / PlatformIO |
| BL-0633 | **ESP-IDF framework support** — 6 ESP targets, CMakeLists/partition/sdkconfig generation, 16 IDF components, 21 SDK options, starter main.c. 117 tests. | DONE (Wave 151) | C5 | Wave 66 / PlatformIO |
| BL-0634 | **Server-side static analysis** — Cppcheck XML + Clang-Tidy parsers, 36 rule DB with CWE IDs, result merging, CodeMirror annotations. 70 tests. | DONE (Wave 147) | C4 | Wave 66 / PlatformIO |
| BL-0635 | **Arduino code simulation in browser** — CodeSimulator with sketch parser, line-by-line execution, Arduino API interpreter, sensor injection, 4 board profiles, breakpoints. 87 tests. | DONE (Wave 153) | C5 | Wave 66 / TinkerCAD + PlatformIO |

---

## Completed Work Summary

51 waves of implementation have been completed. The following is a summary, not an exhaustive list:

| Domain | Key Completions |
|--------|----------------|
| **Security** | Wave A: ownership guards (22 files/100+ routes), DRC sandbox, URL validation, cache clear. Wave E: CORS allowlist, SPICE sanitization, tool confirmation, session resilience, graceful shutdown. |
| **Core EDA** | Push-and-shove routing, differential pair routing + meander, maze autorouter, trace router, footprint library (27 packages), copper pour, board stackup, PCB DRC (10 rules), net-class rules. |
| **Simulation** | DC operating point, AC analysis, transient simulation, Monte Carlo tolerance, thermal analysis, PDN analysis, signal integrity (transmission line + crosstalk + eye diagram), design variables. |
| **Hardware** | WebSerialManager (15 board profiles), SerialMonitorPanel, digital twin (telemetry protocol + device shadow + firmware templates), camera component ID, pinout hover (13 pinouts). |
| **AI** | 88 tools across 12 modules, agentic AI loop, generative design (fitness scoring + circuit mutation), confidence badges, AI review queue, architecture analyzer. |
| **Collaboration** | WebSocket rooms, CRDT ops, live cursors, role enforcement, offline sync, IndexedDB, service worker. |
| **Manufacturing** | PCB ordering (5 fab profiles), assembly cost estimator, LCSC/JLCPCB mapping, DFM checker (15 rules), ODB++ export, IPC-2581 export, Gerber, drill, pick-and-place generators. |
| **Import/Export** | 8 format parsers (KiCad, Eagle, Altium, gEDA, LTspice, Proteus, OrCAD, Generic), STEP 3D export, SPICE netlist parser, FZPZ handler, supplier APIs (7 distributors). |
| **Learning** | Tutorial system (5 tutorials), electronics knowledge hub (20 articles), design patterns library, standard component library (100 components), community library. |
| **UI/UX** | 26 ViewModes, command palette, keyboard shortcuts (19 defaults), i18n framework, Kanban board, barcode scanning, QR labels, DRC constraint overlay, circuit design as code (CodeMirror + DSL). |
| **Audit Fixes** | Frontend audit: 113/113 complete. Backend audit: 110/116 (4 open, 2 partial). |

**Test suite:** ~8784 tests across 198 files, 0 failures.

---

## Source Document Map

| Source | Location | Items | Status |
|--------|----------|-------|--------|
| Codex master findings rollup | `docs/audits_and_evaluations_by_codex/zz_master_findings_rollup.md` | 293 findings (P0-P3) | Most P0s fixed in Waves A/E |
| Codex missing features backlog | `docs/audits_and_evaluations_by_codex/zz_missing_features_capabilities_integrations_master_backlog.md` | 200 items (MF-001 to MF-200) | ~57 DONE, ~70 PARTIAL, ~73 remaining |
| Codex UX backlog | `docs/audits_and_evaluations_by_codex/zz_ui_ux_improvements_and_enhancements_backlog.md` | 120 items (UX-001 to UX-120) | 8 confirmed done, rest open |
| Codex innovative features | `docs/audits_and_evaluations_by_codex/zz_innovative_feature_ideas_backlog.md` | 120 items (IFX-001 to IFX-120) | Aspirational — most open |
| Codex Arduino/embedded | `docs/audits_and_evaluations_by_codex/zz_innovative_arduino_ide_and_embedded_features_backlog.md` | 115 items (ARDX-001 to ARDX-115) | Aspirational — most open |
| App visual/functional audit | `docs/app-audit-checklist.md` | 91 observed findings | All open (observed DOM bugs) |
| Frontend audit checklist | `docs/frontend-audit-checklist.md` | 113 findings | **113/113 DONE** |
| Backend audit checklist | `docs/backend-audit-checklist.md` | 116 findings | 110 done, 4 open, 2 partial |
| Audit v2 checklist | `docs/audit-v2-checklist.md` | 288 checks (213 pass, 7 partial) | 3 remaining fails |
| Product analysis checklist | `docs/product-analysis-checklist.md` | 166 items | **166/166 DONE** |
| Product analysis report | `docs/product-analysis-report.md` | 74 GA-* findings | Many fixed Waves A-E, ~30 remaining |
| Codex master fix plan | `docs/plans/2026-03-06-codex-audit-master-fix-plan.md` | Waves A-G | A-E DONE, F-G open |

---

*Snapshot updated: 2026-03-13 — document currently reflects work through Wave 80 (5 P0 IDOR/auth fixes) plus Pure-Local Desktop App pivot resolving firmware/debugger/platform blockers. Historical highlight notes retained here: Wave 69: BL-0489, BL-0492, BL-0493, BL-0496, BL-0499, BL-0500, BL-0506, BL-0590, BL-0591, BL-0592, BL-0621, BL-0624 done. Wave 70: BL-0567, BL-0569, BL-0570, BL-0575, BL-0576 done. Wave 71: BL-0490, BL-0497 done.*

---

## The Greatness Manifest: Uncompromising Vision (Added Wave 138)

The following items represent the visionary, uncompromising push beyond "good enough" into absolute greatness. These should be addressed once the core P1/P2/P3 operational bugs are resolved, ensuring ProtoPulse is a state-of-the-art living hardware engineering partner.

| ID | Description | Status | Complexity | Source |
|----|-------------|--------|------------|--------|
| BL-0700 | **Live Holographic Data Overlays** — HolographicOverlayEngine with current density wire coloring, thermal hotspots, 3 animation modes. 68 tests. | DONE (Wave 152) | C5 | Greatness Manifesto |
| BL-0701 | **3D Spatial Breadboarding** — 830-point layout, component placement, A* 3D wire routing, internal row connections, power rails, auto-route from netlist. 79 tests. | DONE (Wave 153) | C5 | Greatness Manifesto |
| BL-0702 | **Semantic Zoom** — 6 zoom levels, configurable thresholds, dissolve/reveal transitions, per-element visibility rules. 57 tests. | DONE (Wave 152) | C5 | Greatness Manifesto |
| BL-0703 | **Time-Travel State Replay** — StateReplayEngine with frame timeline, playback controls, domain-specific reconstruction, markers, import/export. 87 tests. | DONE (Wave 154) | C5 | Greatness Manifesto |
| BL-0704 | **Live Variable Watch (OTA)** — OtaVariableWatchManager with type-aware decoding, memory read/write, ELF symbol resolution, break-on-change. 108 tests. | DONE (Wave 154) | C5 | Greatness Manifesto |
| BL-0705 | **Auto-Tuning PID Assistant** — AiPidAssistant with 3 tuning strategies, oscillation detection, FOPDT model fitting, code injection generation. 75 tests. | DONE (Wave 154) | C5 | Greatness Manifesto |
| BL-0706 | **Proactive Self-Healing** — ProactiveHealingEngine with 12+ danger rules, real-time action checking, healing proposals with approval gates. 68 tests. | DONE (Wave 154) | C5 | Greatness Manifesto |
| BL-0707 | **Voice-Driven Bench Sessions** — VoiceBenchManager with 22 commands, safety condition parsing, macros, confirmation flow, session lifecycle. 56 tests. | DONE (Wave 154) | C5 | Greatness Manifesto |
| BL-0708 | **Context-Liquid UI** — 8 focus contexts, panel opacity/blur/scale adjustments, content hints, easeInOutCubic transitions. 68 tests. | DONE (Wave 152) | C5 | Greatness Manifesto |
| BL-0709 | **Zero-Mouse Keyboard Engine** — 23 regex commands, natural language parsing, fuzzy autocomplete, command history. 97 tests. | DONE (Wave 152) | C5 | Greatness Manifesto |
| BL-0710 | **Direct API Fab Pipeline** — 5 fab houses, order lifecycle, pricing breakdown, component availability, substitute suggestions, order summary. 103 tests. | DONE (Wave 152) | C5 | Greatness Manifesto |
