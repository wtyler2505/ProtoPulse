# BOM Templates Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so BOM Templates work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real BOM Templates behavior.

## Pending Proposals

- Add screenshots for the main BOM Templates states.
- Add more specific gotchas after the next real BOM Templates implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05 Deep Analysis Pass (user: "/pp-view-bom-templates" in the systematic full-app views backlog campaign)

**Workflow followed exactly per skill contract:**
1. Inspector run → ok (BomTemplatesPanel 215 LOC, clean small Tier 3 surface).
2. page-map.md read (single file, embedded + lazy standalone).
3. ux-contract.md read (focus on visibility of Templates, Reuse, Editing, Apply Flow).
4. testing.md read (no dedicated tests recorded).
5. gotchas.md read.
6. This entry + contribution to master backlog report.

**Deep Findings from Tool-Driven Exploration (scc, code review, usage search, backend inspection):**

**What It Is:**
- Simple but functional panel for saving current BOM as reusable template + applying templates to projects.
- "Save BOM as Template" (name + optional description/tags from current procurement BOM).
- List with Apply (merges into project stock via ingress) and Delete.
- Used both embedded in ProcurementView (with live BOM) and as a standalone lazy view.

**Strengths:**
- Clean TanStack Query hooks with proper invalidation.
- Backend is more complete than the UI (supports PATCH for editing name/desc/tags, detail endpoint, user-scoped).
- Good integration with procurement flow (can save current BOM state).
- Apply result reports created/skipped counts.

**Identified Gaps / Backlog Items:**

**P1 — Missing "Template Editing" (explicit UX contract item)**
- Backend has PATCH /:id for name, description, tags.
- UI has zero editing capability (no edit modal, no inline rename, no tag management on existing templates).
- "Template Editing" is called out in the contract but not present.

**P1 — Apply Flow Visibility & Safety**
- Apply is a blind "merge" — no preview of what will be created vs. skipped, no conflict resolution UI.
- No "dry run" or diff view before applying (important for procurement trust).
- When used standalone (no current BOM), the "Save" section is useless or confusing.

**P2 — Polish & Discoverability**
- No rich search/filtering on the template list (name, tags, description).
- No preview of template contents (items) before applying (the detail hook exists but isn't used in the panel).
- Limited AI integration (AI could suggest templates, generate from description, or recommend based on current design).
- Empty state is basic; no guidance on best practices for templates (e.g., "create for common sub-assemblies").

**P2 — Test & Integration Gaps**
- No tests for the panel.
- Weak cross-feature integration: no link from Inventory/Validation/3D to "save this configuration as template".
- Templates are user-scoped but there's no sharing/organization-wide templates (common need in teams).

**Cross-Cutting Opportunities (tying to previous work in this campaign):**
- Natural synergy with Procurement (already embedded), Inventory (stock from templates), Validation (validate template against design rules).
- Could feed the Audit Trail (template create/apply/delete are high-value traceable events).
- Strong candidate for AI/Chat actions ("save this BOM as template 'IoT Sensor Kit'", "apply 'Power Supply' template", "suggest templates for my current design").
- Ties to 3D/Breadboard (templates for common sub-assemblies that have known 3D enclosures or breadboard layouts).

**Durable Lesson:**
BOM Templates is a classic "reuse accelerator" feature. The data layer and basic CRUD are in place, but the experience is still "create from current state + blind apply." The highest-leverage next steps are (1) full editing, (2) rich preview + safe apply flow with diffs, and (3) better AI + cross-view discovery. Because it's Tier 3 and small, it's low-risk to enhance but high-value for procurement velocity.

**Recommended for Codex:**
- Add template editing UI (leverage the existing PATCH backend).
- Build a proper Apply preview / diff view before mutation (use the detail endpoint).
- Surface templates more proactively in Procurement, Inventory, and AI suggestions.
- Add tests for the panel + mutation flows.
- Consider template organization (folders, sharing) if team usage grows.

This analysis is now part of the living master backlog report. The BOM Templates surface is functional and well-integrated where it exists, but incomplete relative to its own UX contract and the maturity of the backend.

---

## 2026-05-24 R6 Safety Gate Implementation

**Implemented pattern:**
- BOM Templates now runs the shared export/trust precheck before template save/apply actions.
- Hard blockers disable Save and Apply.
- Warning-only states change Apply into a review step with a visible preview before mutation.
- Focused tests cover lifecycle blockers and warning-only preview/confirm behavior.

**Durable lesson:**
Treat BOM template apply like a procurement-adjacent mutation, not a harmless list action. It can carry unverified generated parts, lifecycle risk, red breadboard health, and estimated inventory confidence into a project, so the panel should show the same trust gate used by money/release surfaces before it mutates stock lines.

---

## 2026-05-24 R11 Apply Diff Implementation

**Implemented pattern:**
- BOM Templates now loads template detail before apply confirmation.
- The preview shows an item-level created/skipped diff using template item `partId` against the current project BOM item `id`.
- Confirm apply stays disabled until the detail/diff data is available.
- Focused tests cover hard blockers plus warning-only review with created/skipped item rows.

**Durable lesson:**
A confirmation banner is not enough for template apply. Users need to see the actual stock-line consequences before mutation, especially in procurement-adjacent flows. Use the existing detail endpoint to make created vs. skipped rows explicit before calling the apply mutation.

---

## 2026-05-26 R62 Runtime Hardening

**Implemented pattern:**
- Apply confirmation remains disabled while template-detail diff data is loading or errored.
- The standalone BOM Templates browser route was checked directly because it is not in the shared route/a11y/keyboard specs.
- Browser verification exposed that `GET /api/bom-templates` was using `validateSession` as Express middleware even though the real helper accepts a session token string.
- The route now has a narrow `requireAuth` middleware that reads `X-Session-Id`, calls `validateSession(sessionId)`, and attaches `req.session`.
- Route tests now use the real session-header shape instead of mocking `validateSession` as middleware.

**Durable lesson:**
Do not trust mocked route tests when they replace auth helpers with a different call shape than production. For standalone money-gate views, run at least one live browser pass with network failures captured, because an API 500 can masquerade as a UI/a11y issue through the global error toast.
