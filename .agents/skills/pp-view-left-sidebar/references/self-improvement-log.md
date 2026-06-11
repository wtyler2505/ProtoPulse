# Left Sidebar Skill Self-Improvement Log

## Accepted Learnings

- Sidebar sizing is a repeated pain point and should be checked before calling UI work done.
- Project settings must stay compact.
- More menus and flyouts need scroll behavior.
- Screenshots are important for this area because tests can pass while the layout still feels wrong.

## Pending Proposals

- Add a screenshot checklist for expanded, collapsed, settings-open, and short-height states.
- Add a browser smoke test that checks the sidebar remains usable at laptop height.

## Rejected Or Deferred

- Do not add more navigation bars to solve sidebar clutter.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-left-sidebar)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-left-sidebar/scripts/inspect-left-sidebar.mjs` → **Status: ok** (19 tracked tests; main shell `Sidebar.tsx` 707 lines + sub-panels: HistoryList 330/72 CCN, ProjectExplorer 252/48, ComponentTree 285/41, CoachPanel 318/38, ProjectSettingsPanel 273, constants 162).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Deep quantitative + structural analysis:
   - scc on full surface: 10 files, 2321 code LOC, 296 complexity (HistoryList and ProjectExplorer are the densest panels).
   - Full read of `Sidebar.tsx` (controlled component with collapse/width props, flex-1 overflow-y-auto main content area, navigation groups from sidebar-groups lib, composition of ProjectExplorer + CoachPanel + HistoryList inside the scroll container, ProjectSettingsPanel rendered as compact h-6 footer button that opens a bounded Dialog).
   - Read key sub-panels (ProjectSettingsPanel renders compact trigger + Dialog with max-h + overflow; CoachPanel, HistoryList, ProjectExplorer, ComponentTree expected to manage internal heights/scroll per contract).
   - Cross-referenced entire campaign (UI Container Rule, breadboard god-file, 3D/Breadboard/Generative/Labs/Inventory/Dashboard/History/Exports/Learn provenance and health surfaces, Architecture extraction, a11y InteractiveCard migration E2E-552).
4. Grepped for flex/overflow/ScrollArea/height strategy, project settings placement, collapsed state, focus order, mobile nav.
5. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (sizing, scrolling, project settings, noise, collapsed state, flyouts):**

- **Layout strategy is largely aligned with the contract (positive):** Main content uses `flex-1 overflow-y-auto`; ProjectSettingsPanel is intentionally a compact h-6 footer button that opens a Dialog with `max-h-[min(68dvh,24rem)] overflow-y-auto` (bounded, good). This directly addresses the historical regression watch "project settings box previously felt too large." Navigation groups + sub-panels (Explorer, Coach, History) live inside the outer scroll container.

- **Internal scrolling discipline in sub-panels is critical and must be verified (P1 risk):** The contract and gotchas repeatedly demand "bounded panel heights + internal scrolling" so the sidebar does not become one giant scroll or push navigation out of reach on laptop-height viewports. HistoryList (72 CCN) and ProjectExplorer (48 CCN) are the densest; any fixed heights or "cards inside cards" inside them on short screens will violate the contract. CoachPanel and ComponentTree must also respect this.

- **Collapsed state and icon-only navigation need clear tooltips + focus order (P1 a11y + usability):** The contract requires collapsed state to remain "understandable." Icon-only controls need tooltips. The a11y eslint disables (InteractiveCard migration) are still present in Sidebar.tsx and ProjectSettingsPanel — focus order when using icon buttons / group toggles / More menus must be correct.

- **"Too loud" / density risk from many indicators:** The sidebar pulls hardware workspace status, project health, feature maturity badges, navigation groups, search, explorer, coach, history, and a settings footer. Per the contract ("the app has felt too loud from too many icons and bars"), any new indicators must be grouped or removed rather than added. The "Back to Projects" link + search + active view highlights + health tones can accumulate visual noise.

- **Mobile navigation is a separate surface (good that it is called out):** The skill explicitly lists `MobileNav.tsx` as related. Desktop sidebar changes do not automatically validate mobile.

- **No new top bars (contract discipline followed so far):** The code avoids adding extra bars, consistent with the "do not add another top bar" rule.

- **0 new tests added in this pass; 19 existing is a solid base:** The inspector shows good test coverage on the shell and CoachPanel/constants. Browser screenshots for short-height + settings-open + collapsed + flyout states remain the gold standard per the skill's own guidance.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Enforce bounded heights + internal scrolling in the dense sub-panels (HistoryList, ProjectExplorer, CoachPanel, ComponentTree) on laptop viewports**
- Audit each for fixed heights, "cards inside cards," or content that can push the outer scroll in a way that hides navigation on short screens.
- Ensure ProjectExplorer search + tree, HistoryList timeline, CoachPanel content, and any group sections have internal ScrollArea or flex-1 + overflow when needed.

**P1 — Finish InteractiveCard a11y migration (remove eslint disables) and verify focus order**
- Convert remaining `role="button"` divs (Sidebar, ProjectSettingsPanel) to real buttons or proper InteractiveCard usage.
- Verify logical focus order through navigation groups, search, explorer, coach, history, and the settings footer button, especially in collapsed state.

**P1 — Reduce visual noise / "loudness" (group or hide secondary indicators)**
- Review hardware status, project health tones, feature maturity badges, and any new icons against the "remove or group before adding" rule.
- Consider progressive disclosure or a "more" group for lower-priority status indicators.

**P2 — Validate collapsed state usability + tooltips on all icon-only controls**
- Ensure every icon-only button or nav item has a clear, always-available tooltip (or aria-label + visible label on hover/focus) and remains reachable.

**P2 — Add or update browser smoke checklist in the skill for laptop-height + settings-open + flyout states**
- The pending proposal in the log is still relevant; make it part of the standard post-edit verification.

**Strengths (relative to peers):**
- Intentional compact treatment of ProjectSettingsPanel (h-6 trigger + bounded Dialog) directly solves a historical pain point called out in the contract.
- Clear separation of concerns (shell vs sub-panels vs constants vs groups lib).
- Good test coverage on the shell and key panels (19 tests).
- Uses modern primitives (InteractiveCard) and respects the "no cards inside cards" rule in the main composition.
- Explicit awareness of mobile as a separate check.

**Cross-Cutting Value (very high — Tier 1 surface):**
- The left sidebar is the primary discoverability and navigation surface for every view audited in this campaign (3D, Breadboard, Component Editor, Generative, Learn, Labs, History, Inventory, Exports, Digital Twin, etc.).
- Any violation of bounded heights, internal scrolling, or "settings taking over" directly impacts the usability of the entire provenance, health, 3D, and maker workflow the user has built.
- It is also a major consumer of contexts (ProjectMeta, Architecture, BOM, History, Validation, hardware status, project health) — changes here ripple into Dashboard, Exports preflight, Coach, etc.

**Durable Lesson:**
A sidebar that uses `flex-1 overflow-y-auto` on the main content and renders ProjectSettings as a compact footer button has done the right structural work to satisfy the "project settings must not take over" and "bounded heights + internal scrolling" rules. The remaining risk lives inside the dense sub-panels (HistoryList, ProjectExplorer, etc.) and in focus/a11y behavior for collapsed/icon-only states. Screenshots on short (laptop) viewports + settings-open + flyouts remain the only reliable way to catch violations that unit tests miss.

**Recommended for Codex (immediate high-ROI tasks after handoff):**
1. Perform a targeted height/scroll audit of HistoryList, ProjectExplorer, CoachPanel, and ComponentTree for laptop-height viewports; ensure every long section has internal scrolling or bounded flex.
2. Finish the InteractiveCard a11y migration in Sidebar.tsx and ProjectSettingsPanel; verify focus order through all interactive elements in both expanded and collapsed states.
3. Review all status/health/maturity indicators for visual noise; group or hide lower-priority ones per the "remove or group before adding" rule.
4. Add or formalize a browser smoke checklist (expanded, collapsed, settings dialog open, short viewport, major flyouts) as part of the skill's verification process.
5. Validate mobile navigation (`MobileNav.tsx`) after any desktop sidebar structural change.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc hotspots, exact layout strategy (flex-1 outer + compact settings footer + Dialog), sub-panel density risks, a11y migration status, and cross-references to UI Container Rule, breadboard/3D/generative surfaces, provenance/health indicators, and prior a11y plan (E2E-552 / Plan 03).
- No production code mutated during this discovery-only pass.
- All findings tied directly to the UI Container Rule, provenance/health, and navigation discoverability work from the same handoff campaign.

---

*Left Sidebar analysis complete. The shell follows the right structural patterns (compact settings, outer scrolling), but the dense sub-panels and collapsed/focus behavior need explicit laptop-height + a11y verification. This is the primary discoverability surface for the entire app — any container or noise violation hurts every other view. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Left Sidebar section (2026-05-23).*
