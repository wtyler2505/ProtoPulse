# AUDX-03: Data Integrity, State Consistency, and Recovery Audit

Date: 2026-03-30  
Author: Codex  
Wave: Deep Systems Expansion  
Purpose: Determine whether ProtoPulse keeps project truth coherent across UI state, cache state, storage state, and recovery flows, then define how to make the platform resilient instead of haunted.

## Current Integrity Posture
- `State coherence across app layers`: inconsistent
- `Recovery confidence after partial failures`: low to moderate
- `Protection against stale or cross-context state bleed`: insufficient

ProtoPulse’s current integrity story is held back less by one catastrophic corruption bug than by too many places where state can drift, stale data can masquerade as truth, and recovery behavior is under-specified.

## What Was Reviewed
- Prior state, cache, storage, and schema audits:
  - `docs/audits_and_evaluations_by_codex/07_FE-07_global_state_contexts_audit.md`
  - `docs/audits_and_evaluations_by_codex/08_FE-08_data_fetch_cache_audit.md`
  - `docs/audits_and_evaluations_by_codex/21_BE-07_storage_layer_interface_integrity_audit.md`
  - `docs/audits_and_evaluations_by_codex/22_BE-08_database_shared_schema_contracts_audit.md`
  - `docs/audits_and_evaluations_by_codex/28_BE-14_errors_logging_circuit_breakers_audit.md`
- Runtime-facing UX rollup:
  - `docs/audits_and_evaluations_by_codex/33_UIUX-00_master_rollup.md`

## What Was Verified
- Reconfirmed that state drift exists at multiple layers:
  - React Query cache boundaries
  - project-context/provider reset behavior
  - storage API safety defaults
  - schema/migration parity
  - persistence and mutation acknowledgment behavior
- Reconfirmed that several prior findings can yield misleading empty states, stale states, or success states even when durable persistence has not truly succeeded.
- No fresh backup/restore chaos test or multi-step branch/recovery walkthrough was executed in this pass.

## Findings By Severity

### 1) `P0` Cross-account and cross-project stale-state bleed is still possible at the cache/UI layer
Evidence:
- `07_FE-07_global_state_contexts_audit.md`
- `08_FE-08_data_fetch_cache_audit.md`
- Prior FE audits already confirmed that auth changes do not reliably clear cache boundaries and that project switching can preserve local state beyond the correct project scope.

Why this matters:
- This is not only a privacy problem; it is a data-trust problem.
- If the app can show the wrong user’s or wrong project’s state after a context change, every downstream action becomes suspect.

Recommended direction:
- Make user identity and project identity first-class cache boundaries.
- Reset provider trees or local state on project changes deterministically.

### 2) `P0` Storage contracts are still unsafe by default for project-owned records
Evidence:
- `21_BE-07_storage_layer_interface_integrity_audit.md`
- Prior backend audit already documented many ID-only storage methods for project-owned entities and route patterns that trust those methods without enough project scoping.

Why this matters:
- Unsafe-by-default data APIs mean correctness depends on every caller remembering every scope rule every time.
- That is the wrong shape for a system this large.

Recommended direction:
- Replace raw ID-only project-owned methods with project-scoped variants.
- Add repair/test tooling around entity-to-project mismatches.

### 3) `P1` Schema and migration drift still make state truth environment-dependent
Evidence:
- `22_BE-08_database_shared_schema_contracts_audit.md`
- Prior schema audit already found substantial drift between runtime schema and committed migrations.

Why this matters:
- If a clean environment produces a different data contract than the one runtime code expects, integrity breaks before the user even touches the app.

Recommended direction:
- Make schema parity a release gate.
- Collapse setup guidance onto one deterministic path.

### 4) `P1` Mutation acknowledgment and error presentation are still misleading in places
Evidence:
- `07_FE-07_global_state_contexts_audit.md`
- Prior FE audit showed project metadata success states can appear before real persistence is confirmed.
- Same audit corpus also shows multiple contexts collapsing load failures into empty states.
- `28_BE-14_errors_logging_circuit_breakers_audit.md`
- Backend error normalization remains inconsistent.

Why this matters:
- “Looks saved” and “looks empty” are among the most dangerous lies an engineering app can tell.

Recommended direction:
- Require confirmed persistence before success messaging.
- Distinguish `empty`, `loading`, `error`, and `stale-recovering` states everywhere.

### 5) `P1` Soft-delete, concurrency, and partial-write policies remain inconsistent
Evidence:
- `21_BE-07_storage_layer_interface_integrity_audit.md`
- Prior storage audit already documented:
  - incomplete project-delete cascade behavior
  - narrow optimistic-concurrency coverage
  - non-atomic chunked insert behavior

Why this matters:
- These inconsistencies are how apps end up with half-deleted projects, lost updates, and “why did this disappear here but not there?” debugging spirals.

Recommended direction:
- Standardize lifecycle policy per entity family:
  - hard delete
  - soft delete
  - versioned update
  - chunked import transactionality

### 6) `P2` Query keys and invalidation strategy are still inconsistent enough to create stale truth
Evidence:
- `08_FE-08_data_fetch_cache_audit.md`
- Prior FE audit already documented inconsistent key shapes, invalidation misses, and broad invalidation blast radius.

Why this matters:
- A system can “save correctly” in the backend and still feel broken if the UI keeps showing stale caches or unrelated refetch storms.

Recommended direction:
- Replace stringly query keys with one key-factory system.
- Align mutation invalidation with domain ownership instead of global cache flushes.

### 7) `P2` Recovery tooling is weaker than the complexity of the product now demands
Evidence:
- Recovery and backup capabilities exist in the product surface and route set, but current audit evidence does not show a cohesive integrity dashboard, repair wizard, or operator/user-facing recovery flow.
- `33_UIUX-00_master_rollup.md`
- Runtime observations already showed shell state persistence producing “haunted” outcomes.

Why this matters:
- A product with exports, simulations, AI changes, history, comments, and hardware flows needs visible recovery confidence, not just hidden persistence mechanisms.

Recommended direction:
- Add integrity health views, restore checkpoints, and explicit repair suggestions.

## Why It Matters
Data integrity is not just about whether rows are written correctly. In ProtoPulse it is about whether the app tells one consistent story across browser state, local persistence, React Query cache, backend storage, exported artifacts, and recovery flows. Right now that story is too fragmented. The user experience consequence is subtle but serious: the app can feel haunted, ambiguous, or oddly untrustworthy even when no single catastrophic bug is visible.

## Improvement Directions
1. Make user and project boundaries explicit in all caches, providers, and storage APIs.
2. Build one canonical integrity model for entity lifecycle, versioning, and delete policy.
3. Add an app-wide distinction between `empty`, `error`, `pending save`, `stale`, and `recovered`.
4. Turn schema parity and high-risk mutation correctness into release gates.
5. Add visible recovery tooling instead of relying on invisible persistence magic.

## Enhancement / Addition / Integration Ideas
- Add a `Project Health` panel that shows unsaved changes, pending writes, stale queries, backup age, and recovery checkpoints.
- Add restore points tied to important actions like import, AI apply, export prep, and batch edits.
- Add a `repair inconsistent project` tool that scans for orphaned rows, mismatched project ownership, and stale derived artifacts.
- Add conflict-aware branch/merge previews for high-value entities.
- Add per-project shell-state isolation with explicit `reset workspace layout` controls.
- Add a `truth timeline` that records what changed, whether it persisted, and whether dependent artifacts were invalidated.
- Add a post-import and post-restore consistency checker.

## Quick Wins
1. Clear or partition cache on auth identity changes.
2. Key provider trees by `projectId` or add explicit reset logic on project change.
3. Replace ambiguous empty states with explicit error and stale-data states.
4. Stop showing success toasts before durable mutation confirmation.
5. Introduce structured query key factories for BOM, comments, settings, simulation models, and other drift-prone domains.

## Medium Lifts
1. Replace ID-only storage methods for project-owned entities with project-scoped APIs.
2. Add broader optimistic-concurrency coverage for high-write entities.
3. Normalize delete policy and cascade behavior across all project-owned tables.
4. Add an integrity-check endpoint or local audit utility for orphaned/mismatched records.
5. Build a visible checkpoint/restore UI around existing history and backup capabilities.

## Big Swings
1. Build a full `Integrity and Recovery Center` with health scoring, repair suggestions, and restore workflows.
2. Move toward event-sourced or snapshot-backed project state for higher-confidence replay and recovery.
3. Add a trust-grade system that scores every project on freshness, persistence health, backup health, and export/simulation consistency.

## Residual Unknowns
- No fresh backup/restore execution pass was run in this wave.
- Branch/merge behavior for complex concurrent edit scenarios still needs a dedicated live exercise.
- The current corpus does not yet prove how well AI-applied changes and export snapshots stay synchronized over long-lived projects.

## Related Prior Audits
- `07_FE-07_global_state_contexts_audit.md` — confirmed
- `08_FE-08_data_fetch_cache_audit.md` — confirmed
- `21_BE-07_storage_layer_interface_integrity_audit.md` — confirmed
- `22_BE-08_database_shared_schema_contracts_audit.md` — confirmed
- `28_BE-14_errors_logging_circuit_breakers_audit.md` — extended
