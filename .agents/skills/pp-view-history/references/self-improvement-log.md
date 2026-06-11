# History Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so History work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real History behavior.

## Pending Proposals

- Add screenshots for the main History states.
- Add more specific gotchas after the next real History implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-history)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-history/scripts/inspect-history.mjs` → **Status: ok** (DesignHistoryView.tsx 491 lines / 83 CCN, 0 tracked tests).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep analysis:
   - scc: 449 code / 83 CCN (moderate — timeline + detailed ArchDiff rendering).
   - Full read of `DesignHistoryView.tsx` (Architecture snapshot list, manual "Save Snapshot" with name/desc, Compare to Current via `/snapshots/:id/diff`, detailed `DiffDisplay` with node/edge tables + field-level changes using `@shared/arch-diff`, delete with confirm).
   - No obvious one-click Restore; diffs are for audit/comparison only.
   - Cross-referenced entire campaign (Architecture extraction, Generative `generatedFrom` stamping on adopt, Component Editor verification, breadboard-lab provenance, Exports trust receipts, Audit Trail, Digital Twin, 3D placements).
4. Grepped for restore, provenance awareness in diffs, snapshot triggers.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Version History / Diffs / Restore Flow / Auditability):**

- **Solid Architecture snapshot + detailed diff viewer (strength):** Clean list of named/described snapshots, "Compare to Current" producing rich `ArchDiffResult` (nodes/edges added/removed/modified with field-level changes). Good visual badges and scrollable tables. Supports the "Auditability" and "Diffs" pillars for the Architecture canvas.

- **"Restore Flow" is not visible (P1 gap vs contract):** The UX contract explicitly requires Restore Flow to be "visible enough." The current implementation has no obvious one-click "Restore to this snapshot" or "Revert changes" action. Users can only compare and manually recreate. This is a direct violation of the contract for a History surface.

- **Architecture-only scope (major P1 gap relative to the campaign):** Snapshots and diffs are limited to Architecture nodes/edges (`ArchDiffResult`). They capture **none** of the rich state built elsewhere:
  - Breadboard placements, wiring, health, coach data, exact-part provenance.
  - 3D positions/rotations/side, airwire state, mechanical envelopes.
  - Component Editor exact parts, verification status, 3D models.
  - Digital Twin shadows/channels.
  - Generative `generatedFrom` markers (even though adoption stamps them).
  - Export trust receipts, validation issues, etc.
  - The "single source of truth for project version history" the campaign needs does not exist.

- **No automatic / event-driven snapshots (P1 gap):** Snapshots are purely manual ("Save Snapshot" button). There are no hooks on significant provenance events (generative adoption, exact-part verification, breadboard placement, 3D export, etc.) that would create auditable history entries automatically.

- **No provenance-aware diffing:** Diffs do not highlight nodes that came from generative design, unverified exact parts, or low-trust sources — even though the data (`generatedFrom`, verificationLevel) now exists in the system.

- **0 tests recorded in the skill (notable gap):** For an auditability surface, lack of recorded tests (even if lib tests exist elsewhere) is a risk per the gotchas.

- **Layout is reasonable but must watch scroll on large diffs:** Uses ScrollArea on the diff tables (max-h-[500px]). The contract requires laptop-height checks for any future density.

**P0 / P1 / P2 Backlog Items for Codex (added to master report):**

**P1 — Implement visible Restore Flow (direct contract violation)**
- Add clear "Restore to this snapshot" / "Revert to snapshot" actions (with preview diff + confirmation) that actually restore the Architecture state (and ideally warn about or snapshot current state first).

**P1 — Expand scope beyond Architecture or make it the true project history surface**
- Either (a) make History the aggregator for Architecture + breadboard + 3D placements + component verification state + generative provenance, or (b) document that it is intentionally Architecture-only and ensure other surfaces (Audit Trail, Dashboard, Exports) provide the missing history/provenance views.
- At minimum, when adopting a generative candidate or verifying an exact part, the change should be visible in History with its provenance label.

**P1 — Automatic / event-driven snapshots on high-value provenance events**
- Hook snapshot creation (or lightweight audit entries) on: generative adoption, exact-part verification status change, breadboard major placement/wiring changes, 3D model import/verification, etc.
- This turns History from a manual tool into the living audit record the campaign has been building toward.

**P2 — Provenance-aware diff highlighting**
- In node/edge diffs, surface badges or filters for "AI-generated", "unverified exact part", "low-trust source", "from breadboard", etc.

**P2 — Test coverage**
- Record test globs in the skill and add basic coverage for snapshot CRUD, diff rendering, and (once implemented) restore.

**Strengths (relative to peers):**
- Clean, focused Architecture diff experience with good visual design (badges, field-level change lists, scrollable tables).
- Manual snapshots with description support intentional audit points.
- Uses shared `@shared/arch-diff` types (consistent with Architecture extraction work).

**Cross-Cutting Value (very high for the provenance/trust story):**
- This should be (or feed) the "single source of truth" for what changed when, why, and with what trust level — directly powering Dashboard health, Exports trust receipts, Audit Trail, and safe restore.
- Currently it only sees Architecture changes; the rich generative, exact-part, breadboard, 3D, and digital twin state the rest of the campaign built is invisible to history.

**Durable Lesson:**
A well-implemented Architecture snapshot + diff viewer satisfies the narrow "Version History of the canvas" use case, but when the system has spent serious effort stamping provenance on generative adoption, exact-part verification, breadboard placements, and 3D models, a History surface that only diffs nodes/edges and has no restore or automatic capture of those events fails the broader "Auditability" and "Restore Flow" contract and leaves the safety story incomplete. History must either expand or be explicitly scoped while other surfaces carry the full provenance timeline.

**Recommended for Codex (immediate high-ROI tasks):**
1. Add visible Restore Flow (with safety snapshot of current state + confirmation).
2. Either expand snapshot/diff scope to include breadboard/3D/component verification state or create a clear integration story so the full project history is auditable.
3. Add automatic snapshot or audit entry creation on generative adoption, exact-part verification, and other high-provenance events.
4. Make diffs provenance-aware (highlight AI-generated or unverified items).
5. Record tests in the skill and add coverage for the core flows (especially once restore exists).

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc, exact scope of snapshots (Architecture-only), missing restore, lack of automatic/provenance-aware behavior, and cross-references to Generative stamping, Component Editor, breadboard-lab, 3D, Exports, Audit Trail, and Dashboard.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust and auditability work from the same handoff campaign.

---

*History analysis complete. Solid Architecture diff viewer, but missing Restore Flow, automatic provenance capture, and visibility into the richer state (generative, exact parts, breadboard, 3D) built elsewhere. This is the surface that must make the entire safety story auditable and restorable. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended History section (2026-05-23).*
