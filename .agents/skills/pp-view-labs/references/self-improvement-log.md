# Labs Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Labs work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Labs behavior.

## Pending Proposals

- Add screenshots for the main Labs states.
- Add more specific gotchas after the next real Labs implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-labs)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-labs/scripts/inspect-labs.mjs` → **Status: ok** (LabTemplatePanel.tsx 726 lines / 92 CCN, 0 tracked tests).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep analysis:
   - scc: 646 code / 92 CCN (moderate — lab browser + stepper + grading rubric UI).
   - Full read of `LabTemplatePanel.tsx` (lab cards with difficulty/category/time/progress, filters/search, LabDetailView with prerequisites, step-by-step checklist, grading criteria (binary/rubric), localStorage sessions via useLabTemplates).
   - Core lib: `client/src/lib/lab-templates.ts` (LabTemplate with steps, gradingCriteria, prerequisites; LabSession with status/progress/grades; no live breadboard/3D/component state).
   - Cross-referenced entire campaign (breadboard-lab provenance + coach + exact parts, 3D View mechanical/airwires, Component Editor verification, Generative output, Digital Twin, History/Audit Trail, Inventory health, Exports trust, Dashboard).
4. Grepped for integration points (breadboard state, 3D, exact parts, provenance on results, result capture beyond grades).
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Lab Templates / Experiment Setup / Guided Workflow / Result Capture):**

- **Clean educational UX for structured labs (strength):** Good browser with difficulty badges, category filters, search, time estimates, progress bars. Stepper with prerequisites (completion status), hints, expected outcomes, and a grading rubric (binary or points-based) with "grade lab" flow. Progress persists via localStorage. This satisfies "Lab Templates," "Experiment Setup," and "Guided Workflow" for abstract instructional content.

- **"Result Capture" is shallow — only grades, no real maker evidence (P1 gap):** The only captured output is `GradeResult[]` (criterionId + awarded points + optional notes). There is **no capture of**:
  - Actual breadboard wiring / placements / health / coach data
  - 3D models or mechanical fit evidence
  - Verified exact parts used
  - Digital Twin shadow / comparison results
  - Photos, measurements, or exported artifacts
  - Provenance of the components used (generative vs manual vs community)
  The contract requires Result Capture to be "visible enough"; currently it is just a numeric grade detached from the physical/ digital work the user actually did on the breadboard/3D surfaces.

- **No integration with the real maker surfaces the campaign built (P1 gap):** Labs are parallel instructional content. Completing a lab does not:
  - Drive or validate actions in the hardened BoardViewer3DView or BreadboardView
  - Create or reference exact parts in Component Editor with verification status
  - Record provenance artifacts that appear in History, Audit Trail, Dashboard health, or Exports
  - Use the Inventory health or stock data
  "Guided Workflow" is static text instructions, not live orchestration of the tools the user has spent so much effort hardening.

- **Prerequisites are only other lab IDs (limited):** Prerequisites are strings (other lab IDs) with simple "met / missing" status. They do not check real project state (e.g., "you must have a verified exact part for the LED driver" or "breadboard must have < 5 wiring issues").

- **0 tests recorded in the skill (notable gap for a guided workflow surface):** The lib has a test file, but the skill records none. Per the gotchas, this increases risk for UI flows around grading, prerequisites, and session persistence.

- **Panel is 726 lines of mostly list + stepper UI:** Reasonable density; collapsible sections and clear navigation. Still subject to laptop viewport and scroll checks when many labs or long step instructions are present.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Make Result Capture real and provenance-linked (highest leverage for the breadboard-lab + provenance identity)**
- When a user completes/grades a lab, offer to attach or create artifacts: breadboard snapshot + health report, 3D view screenshot or model refs, list of exact parts used (with verification status), digital twin comparison, exported fab package or report, photos/measurements.
- Store these as first-class evidence with provenance ("lab-result:<labId>:<grade>") so they appear in History, Audit Trail, Dashboard, and can be referenced in Exports trust receipts.

**P1 — Turn Labs into a guided orchestrator of the real surfaces (not just parallel instructions)**
- Lab steps should be able to reference or drive real actions: "Place this exact part on breadboard at coordinates X/Y", "Verify the 3D fit in the 3D View", "Run digital twin comparison and capture result".
- On step completion, optionally auto-open the relevant view (Breadboard, 3D, Component Editor) with the right objects pre-selected and the coach or verification UI ready.

**P1 — Make prerequisites check real project state**
- Extend prerequisites beyond lab IDs to include checks like "has verified exact part for <part>", "breadboard health score > X", "3D model present for all placed components", "inventory shortfall = 0 for this lab's BOM".

**P2 — Enrich grading with evidence**
- Allow graders (or self-graders) to attach the real artifacts above and have the rubric items auto-suggest scores based on captured data (e.g., "all parts verified exact → +full points on 'correct components' criterion").

**P2 — Test coverage**
- Record test globs in the skill and add coverage for the grading flow, prerequisite evaluation, session persistence, and (once implemented) artifact capture + provenance stamping.

**Strengths (relative to peers):**
- Clean, educator-friendly lab browser + stepper + rubric grading with prerequisites and progress.
- Good difficulty/category/time metadata and search/filter UX.
- Explicit "expected outcome" per step + hints — thoughtful for self-learners.
- LocalStorage persistence is practical.

**Cross-Cutting Value (very high for the breadboard-lab + education + provenance story):**
- This should be the "structured learning + evidence capture" layer that turns the powerful breadboard/3D/component tools into guided, auditable educational experiences.
- Completed labs with real captured artifacts (breadboard health, verified parts, 3D fit, digital twin results) become the highest-quality provenance evidence in the entire system — perfect for portfolio, certification, or fab handoff justification.

**Durable Lesson:**
A beautiful guided lab system with rubrics and prerequisites can still be "parallel content" rather than "the way you do real work with provenance" if it never touches the actual breadboard state, 3D models, exact-part verification, or digital twin data the user has built. The contract requires Result Capture and Guided Workflow to be visible and useful — after the breadboard-lab + 3D + provenance campaigns, labs must produce (and be produced by) real, auditable maker artifacts.

**Recommended for Codex (immediate high-ROI tasks):**
1. Extend LabSession / GradeResult to support attached real artifacts (breadboard snapshot ref, 3D view state, exact parts used with verification status, digital twin comparison, exported report, photos).
2. On lab completion/grading, offer to stamp provenance and surface the lab result in History, Audit Trail, Dashboard, and Exports trust receipts.
3. Make lab steps actionable: "Open breadboard and place exact part X", "Verify in 3D View", with deep links and auto-preselection.
4. Upgrade prerequisites to real project-state checks (exact parts verified, breadboard health, inventory coverage, 3D models present).
5. Record tests in the skill and add coverage for the new artifact capture + provenance flows.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc, exact abstract vs real-state gap, provenance/artifact capture missing, and cross-references to breadboard-lab, 3D View, Component Editor, Generative, Digital Twin, History, Audit Trail, Inventory, Exports, and Dashboard.
- No production code mutated during discovery.
- All findings tied directly to the breadboard-lab provenance, 3D mechanical, exact-part verification, and auditability work from the same handoff campaign.

---

*Labs analysis complete. Clean guided lab UX with good educational features, but Result Capture is only grades (no real breadboard/3D/exact-part/digital twin evidence) and there is zero integration with the hardened maker surfaces. This should be the "structured evidence" layer on top of the provenance story — currently it is parallel content. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Labs section (2026-05-23).*
