# Community Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Community work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Community behavior.

## Pending Proposals

- Add screenshots for the main Community states.
- Add more specific gotchas after the next real Community implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-community)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-community/scripts/inspect-community.mjs` → **Status: ok** (no missing files, all references present, main source `CommunityView.tsx` 704 lines).
2. Read SKILL.md + references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep code exploration:
   - `client/src/components/views/CommunityView.tsx` (705 lines total, 618 code / 39 CCN via scc — deliberately thin UI shell).
   - `client/src/lib/community-library.ts` (1254 lines, 979 code / 317 CCN — the real state machine + seeded data + collections).
   - `client/src/lib/community-bom-bridge.ts` (the only "apply to design" surface today).
   - Cross-referenced `server/routes/components.ts` (the *real* mature community provenance system for parts: FZPZ ingress, `community-fzpz` evidence, `origin: 'community'`, `verificationLevel`, `PartTrustCarrier`).
   - View mounting: `ViewRenderer.tsx`, lazy-imports, no special sidebar wiring.
4. scc + structural analysis (ast-grep patterns for handlers, useMemo, Dialog usage, Card grid).
5. Re-inspector run planned at close (must stay green per contract).

**Key Technical Findings vs. UX Contract & ProtoPulse Identity:**
- The view implements a clean, low-complexity browser (tabs: Browse / Featured / Collections; search + type filter + 5 sort modes; Card grid + Radix Dialog detail; StarRating interactive; VaultHoverCard on every license badge for plain-English teaching).
- **Critical gap**: `downloadComponent` only increments count + returns a JSON blob (client-side `Blob` + `<a download>`). There is **zero bridge** from a `CommunityComponent` (even when `type === '3d-model'`) into:
  - `CircuitDesign` / `CircuitInstance` (pcbX/Y/Rotation/Side, referenceDesignator)
  - Breadboard placement (exact-part vs starter vs project)
  - The hardened BoardViewer3DView (R3F airwires + CSS substrate)
  - Schematic symbol / footprint library ingestion
- The `data: Record<string, unknown>` field is a black box; no preview/diff/ "import safety" surface (contrast with the Alternates "Replace" flow or the parts catalog trust receipts).
- **Two parallel community universes**: 
  - This asset library (client-only seeds, local collections, reputation numbers only).
  - The production parts system (server/components.ts + ingress + AI generation + `communitySourceUrl` + evidence arrays + breadboard-lab provenance/audit).
- Positive signals that align with breadboard-lab + 3D work:
  - Already using `VaultHoverCard` for license teaching (exactly the "source trust" pattern the provenance identity wants).
  - Existing small `AddToBomPrompt` + `mapCommunityPartToBom` bridge (the only current "consequence" of downloading).
  - Explicit `'3d-model'` type in TYPE_LABELS + ComponentType union — screaming for the post-3D-hardening integration.

**P0/P1 Gaps Called Out for Codex (added to master report):**
- No "Use in Current Design / Place on Breadboard / View in 3D / Import Symbol" actions in ComponentDetail or card context menu.
- No source-trust / verification badge surface inside the detail dialog (author reputation exists but is not visually or filterable like parts evidence).
- Collections are purely local; no publish/sync or "community collection" concept.
- The entire library is demo data; contribution, moderation, and real sharing flows do not exist (while the parts side has full ingress + AI pipeline).

**Durable Lesson:**
A polished browser UI with zero downstream consequence for the canonical EDA model (Project → Design → Instance + 3D + Breadboard) is the definition of "feature that looks real but isn't wired." The recent 3D + breadboard-lab work makes this gap more painful and more valuable to close.

**Evidence of Contract Compliance:**
- Inspector clean on entry and (planned) exit.
- No edits to production code during this analysis pass (pure discovery + documentation).
- All findings cross-referenced to the 3D rescue campaign and the breadboard god-file + provenance identity.
- Self-improvement entry written before moving on.

**Next Physical Action (if continuing the sweep):** User will issue the next `/pp-view-xxx`. The Community section below was appended to `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md`.

---

*This entry closes the analysis phase for Community. The skill now has a durable record of the exact state of the "community assets" surface at the Codex handoff moment.*

---

**R17 Community -> 3D bridge**

**Date:** 2026-05-24.

Community detail dialogs for `3d-model` assets now expose `View in 3D`. The action publishes the selected asset id, title, description, author trust tier, model format, and ready state through `viewer-3d-bridge.ts`, then switches to `viewer_3d`. This turns the previous demo-only 3D model category into a real downstream workflow entrypoint.

---

**R36 Community 3D source provenance**

**Date:** 2026-05-25.

Community 3D handoffs now publish the author name and reputation as structured bridge fields (`sourceName`, `sourceTrustScore`) instead of leaving that trust signal only inside the Community dialog. The 3D viewer card renders those values as visible source and reputation badges, and the browser route proof checks them alongside verification level and model format.

Durable lesson: Community assets should not arrive in the 3D viewer as anonymous files. Author identity and reputation are part of the provenance payload and must cross the route boundary with the model.
