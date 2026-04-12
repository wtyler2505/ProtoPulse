---
description: "Phase 2 parts ingress pipeline mirrors legacy writes into canonical parts catalog via best-effort dual-write with audit log for Phase 4 reconciliation"
type: pattern
source: "docs/plans/2026-04-10-parts-catalog-consolidation.md, server/parts-ingress.ts"
confidence: proven
topics: ["[[architecture-decisions]]", "[[dev-infrastructure]]"]
related_components: ["server/parts-ingress.ts", "server/routes/parts.ts", "server/routes/bom.ts", "server/routes/components.ts", "server/circuit-routes/instances.ts", "server/ai-tools/bom.ts", "server/ai-tools/component.ts", "shared/schema.ts:partsIngressFailures"]
---

# Parts ingress runs as best-effort dual-write with audit log so legacy routes never fail when the canonical catalog mirror breaks

Phase 2 of the unified parts catalog (ADR 0010) needed to move every parts importer from the legacy `componentLibrary`/`componentParts`/`bomItems` tables into the canonical `parts` + `part_stock` + `part_placements` trio — but without risking legacy stability during the transition. The pattern that emerged: **every importer writes to legacy FIRST (authoritative), then fires a best-effort mirror to canonical via `mirrorIngressBestEffort()`, and any mirror failure logs a row to `parts_ingress_failures` for Phase 4 reconciliation.** The HTTP client never sees the mirror failure — they see success because legacy succeeded. The legacy write commits before the mirror runs; the mirror runs asynchronously via `void mirrorIngressBestEffort(...)` so the response returns immediately. Flag-gated behind `PARTS_CATALOG_V2=false` in Phase 2 so mirror writes can be toggled without code changes.

The dedup logic inside `ingressPart()` follows a deterministic priority: **(1) exact `(manufacturer, mpn)` match via the partial unique index, (2) exact `slug` match via the deterministic slug generator, (3) create a new row with a collision-suffixed slug if the base slug is taken.** The slug generator is pure — `generateSlug({ canonicalCategory, value, packageType, tolerance, mpn })` always produces the same output for the same input, so the same physical part arriving through different importer paths deduplicates to the same row. The `partial unique index (manufacturer, mpn) WHERE mpn IS NOT NULL AND manufacturer IS NOT NULL` on the `parts` table enforces at the database level that two parts with identical MPN can never coexist — the ingress pipeline's find-first-then-create pattern makes this a graceful reuse instead of a constraint violation. Collision handling iterates `-2`, `-3`, `-4`, … until finding an unused suffix, capped at 100 to surface pathological cases.

The audit table `parts_ingress_failures` captures `(source, projectId, legacyTable, legacyId, payload, errorMessage, errorStack, reconciled)` per failed mirror. Phase 4's backfill script (`scripts/migrations/reconcile-parts-drift.ts`) scans this table alongside the full legacy row set to reconcile any misses — so even catastrophic mirror failures in Phase 2 don't block Phase 5 cutover. The audit table gets dropped in Phase 6 cleanup. This architecture means Phase 2 can be rolled back by setting the feature flag to false and the legacy tables continue working exactly as before; no data loss, no partial-state corruption, no user-visible regression. The 50 unit tests covering dedup priority, stock upsert, placement creation, and best-effort failure isolation (including the secondary-audit-log-failure edge case) prove the pipeline is safe to leave running shadowed.

---

Relevant Notes:
- [[parts-catalog-consolidation]] -- the overall consolidation plan this pipeline implements
- [[god-files-create-feature-paralysis-through-complexity]] -- the parts domain was a drift surface because of the same "many places to write, no single source of truth" pattern this fixes
- [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] -- the insert schemas + Zod round-trips that make dual-write type-safe

Topics:
- [[architecture-decisions]]
- [[dev-infrastructure]]
