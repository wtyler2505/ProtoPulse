# Alternates Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Alternates work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Alternates behavior.

## Pending Proposals

- Add screenshots for the main Alternates states.
- Add more specific gotchas after the next real Alternates implementation pass.
- Keep the browser-level Alternates Playwright smoke fixture honest: direct `/projects/1/part_alternates` checks can fail before the view mounts if `auth.setup.ts` creates a fresh user without project id 1.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05 Deep Analysis Pass (user: "/pp-view-alternates <--Analyze this one now" as part of full-app backlog campaign)

**Workflow followed exactly:**
1. Inspector run → ok (PartAlternatesBrowserView.tsx 135 LOC — very small Tier 3 surface).
2. page-map.md read.
3. ux-contract.md read.
4. testing.md read (no tests recorded).
5. gotchas.md read.
6. This entry + contribution to master `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md`.

**Code Analysis Summary:**

**UI Surface (BrowserView + Panel):**
- Browser (`PartAlternatesBrowserView`): Clean collapsible list of "parts that have alternates". Lazy loads details on expand. Good use of Collapsible + ScrollArea. Simple loading/error/empty states.
- Panel (`PartAlternatesPanel`, used in Procurement "Alternates" tab): More actionable — shows alternates for one specific part + "Replace" buttons wired to `useSubstitutePart` mutation with toasts and loading state on button.
- Both follow basic card/collapsible patterns.

**Data Layer:**
- `useAlternatesBrowse` → GET /api/parts/browse/alternates (calls `partsStorage.listPartsWithAlternates()` — simple join + groupBy + count + cache).
- `usePartAlternates` → lazy GET /api/parts/:id/alternates.
- `useSubstitutePart` mutation → POST /api/parts/:id/substitute (updates placements/stock?).
- Backend in `server/storage/parts.ts` + `server/routes/parts.ts`.
- AI tools: `get_alternates` + `suggest_substitute` (ranks by `trustLevel` — good).

**Findings & Backlog Items (categorized for the master report):**

**P1 — High Value / Friction**
- **No visible "why this alternate is good" (Substitution Safety / Tradeoffs)**: The panel has a raw "Replace" button. No matchScore, trustLevel badge on the alternate rows, no side-by-side comparison (specs, price, stock, lead time). The `suggest_substitute` AI tool ranks by trust, but the UI does not surface the ranking or reasons.
- **Weak Comparison / Tradeoffs UI**: Browser just lists titles + counts. No table or diff view for key attributes between original and alternates.
- **Discoverability of the Browser**: The standalone `PartAlternatesBrowserView` exists but may be under-linked from Inventory/Procurement/Part Usage.

**P2 — Polish / Consistency**
- Loading state inside the CollapsibleContent is basic ("Loading alternates..."). Could be skeleton or per-row.
- No optimistic update or immediate feedback on successful substitute beyond toast.
- Empty state in browser mentions "ingress pipeline or AI tools" — good, but no direct link/button to populate it.
- The panel is used inside Procurement tabs; the browser is a top-level view — slight duplication of alternate rendering logic.

**Tech Debt / Architecture**
- Very small dedicated view (good for Tier 3), but the real power is in the data model (`part_alternates` table with matchScore) and AI tooling. The UI is mostly a thin viewer.
- No tests recorded for the browser view (only panel has some).
- Cache in `listPartsWithAlternates` is naive in-memory (no invalidation on createAlternate?).

**Integration Opportunities (tying to previous work)**
- The new "View in 3D" button in Breadboard and the hardened 3D View could surface alternates for mechanical fit review.
- AI Chat `suggest_substitute` tool results could link directly to this browser or panel.
- Validation/DRC could flag "using non-preferred alternate" and link here.

**Durable Lesson:**
Alternates is a high-trust, safety-critical feature (substitution can affect manufacturability, reliability, cost). The data + AI side is reasonably advanced (trust ranking, graph), but the UI surfaces almost none of the reasoning. This is a classic "powerful backend, thin frontend" gap. Future work here should focus heavily on comparison tables, trust badges, and "why this substitute" explanations before making the Replace action too prominent.

**Next in campaign:** User can say the next view (e.g. /pp-view-procurement, /pp-view-inventory, etc.). The master backlog report is being updated with this analysis.

---

## 2026-05 R1 Part Alternates Pilot Implementation

**Implementation lesson:**
- The alternates graph already sorted candidates by `part_alternates.matchScore`, but `getAlternates()` returned only the joined part row. Surface the edge score in the API payload before trying to build trust UI; otherwise the frontend has to invent confidence.
- Replacement UX should be preview-first. A raw Replace button is too aggressive for a trust-sensitive part substitution path because it can mutate project placements and stock.
- The closest Playwright route smoke currently assumes `/projects/1/...` exists for the fresh authenticated E2E user. When it does not, the browser lands on the project picker and never reaches `workspace-main`, so use focused component tests as the reliable Alternates proof until the route fixture is repaired.
- Fixture repair: `auth.setup.ts` now creates a project for the fresh E2E user and stores its id in `protopulse-e2e-project-id`; route smokes should read that id instead of hard-coding `/projects/1`.
- Keep trust/match wording in `client/src/lib/parts/alternate-trust.ts` instead of duplicating local helpers between the standalone browser and action panel.
