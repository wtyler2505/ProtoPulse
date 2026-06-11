# Right Sidebar Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Right Sidebar work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Right Sidebar behavior.

## Pending Proposals

- Add screenshots for the main Right Sidebar states.
- Add more specific gotchas after the next real Right Sidebar implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

## Fast Workflow Execution Report — 2026-05-23 (pp-view-right-sidebar Full Audit Pass)

**User Command:** `/pp-view-right-sidebar`

**Inspector (entry + final exit):**
- Status: **ok** both times.
- Tracked tests: 7 (WorkspaceHeader.test.tsx + panels tests)
- Primary sources per auto-sync:
  - ChatPanel.tsx (1242 lines / 1,094 code / 202 CCN — the heavy Eve AI chat surface)
  - ActivityFeedPanel.tsx (382 lines / 341 code / 36 CCN — activity timeline slide-over)
  - ProjectWorkspace.tsx (920 lines / 791 code / 175 CCN — the central orchestrator with layout, reducer, resize, peek, mobile, overlays)
- Full surface: 3 files / 2,226 code LOC / **413 CCN** (substantial Tier 1 surface)
- References and test globs all present and valid. Re-run after discovery remained clean.

**Exact Fast Workflow Sequence Followed (non-negotiable contract):**
1. `node .agents/skills/pp-view-right-sidebar/scripts/inspect-right-sidebar.mjs` → ok
2. Read `references/page-map.md` (28 lines)
3. Read `references/ux-contract.md` (24 lines) — before any layout/density synthesis
4. Read `references/testing.md` (28 lines)
5. Read `references/gotchas.md` (17 lines) — before any sync/persistence/trust analysis
6. Read `SKILL.md` (Tier 1, three globs, 7 tests)
7. Deep source inspection (ProjectWorkspace + ChatPanel + ActivityFeedPanel + workspace-reducer + HoverPeekDock usage) + mandatory ast-grep + scc
8. Cross-campaign synthesis: Left Sidebar symmetry, AI Chat (previously audited), Activity Feed as history, provenance visibility in the generative action column, UI Container Rule for dense right-side overlays, workspace layout persistence/resize/peek/mobile
9. Durable appends to this log + master report (section 32)
10. Final inspector re-run (ok)

**Quantitative Snapshot (scc on the three core files):**
- ChatPanel: 1,094 code / 202 CCN (dense AI chat with streaming, action executor, multimodal, intent parsing, many sub-hooks and chat/ subdir)
- ProjectWorkspace: 791 code / 175 CCN (orchestrator: reducer-driven layout for left + right sidebars, HoverPeekDock + ResizeHandle for both, media-query auto-collapse, persistence, mobile nav, many ErrorBoundary + Suspense overlays)
- ActivityFeedPanel: 341 code / 36 CCN (timeline of project actions: created/updated/deleted/commented/exported/imported/validated)
- Total **413 CCN** — heavy Tier 1 (comparable to other dense workspace surfaces)

**Source Ownership & Architecture:**
- `ProjectWorkspace.tsx` is the single source of truth for the three-column workspace (left nav + main canvas + right "chat" column).
- Right sidebar is implemented as the **"chat"** column in the reducer (`chatCollapsed`, `chatWidth`, `chatOpen`, `SET_CHAT_*` actions).
- Resizable via `ResizeHandle` (right side), hover-peek via `HoverPeekDock` (symmetric with left sidebar), persisted per-project in localStorage via `workspace-reducer`.
- Auto-collapse rules: chat at <=1280px (RS-04), sidebar at <=1024px.
- `ChatPanel` is the permanent resident of the right resizable column (Eve AI assistant).
- `ActivityFeedPanel` is rendered as a **slide-over overlay** (`ws.activityFeedOpen`, absolute right-0, w-[19rem]) — not a second permanent panel.
- Many other panels (PredictionPanel, PcbTutorialPanel, HardwareInspectionPanel, various chat sub-panels, ExportPrecheck, etc.) can appear as absolute or fixed overlays competing for right-side real estate.

**Deep Analysis vs. UX Contract (Page Behavior / Layout / Tests / Workflow Clarity):**

- **Layout (mature but high density risk — Tier 1 classic):**
  - Excellent symmetric treatment of left (Sidebar) and right (Chat) columns: same HoverPeekDock + ResizeHandle + collapse + peek + keyboard resize + persistence pattern.
  - Media queries + explicit RS-03/RS-04 rules protect against cramped 3-panel layouts on smaller desktops.
  - Skip links exist for main content and #chat-panel (good a11y).
  - However, the right side is extremely crowded: permanent ChatPanel (long threads, streaming indicators, action previews, settings, voice) + ActivityFeed slide-over + PredictionPanel badge/dock + PcbTutorial + HardwareInspection + SmartHint + many chat sub-dialogs. This is the exact "piling up" and "nested overflow / scroll trap" risk called out in gotchas and the global UI Container Rule.
  - ChatPanel itself (previously audited) is dense; when the right column is narrow or the thread is long, reachability of input, history, and action reviews becomes critical.

- **Page Behavior & Workflow Clarity (strong coordination, provenance gap remains):**
  - The right sidebar is the primary place the user interacts with the AI (Eve) and sees the immediate history of what the AI (or user) just did via the Activity Feed slide-over.
  - `useActionExecutor`, intent handlers, and chat actions that mutate the project (nodes, bom, exports, validation) are triggered from here — this is the generative "action surface."
  - Activity Feed (useActivityFeed) gives a clear timeline of created/updated/deleted/commented/exported/imported/validated — excellent for "what just happened?"
  - **Provenance / trust visibility gap persists**: ast-grep across ProjectWorkspace + ChatPanel + ActivityFeedPanel found **zero** direct references to TrustReceiptCard, ReleaseConfidence, generatedFrom, verificationLevel, VaultHover, etc. Even though the user is taking real generative actions from the chat on the right, the right column itself does not surface the verification status or trust receipts of the artifacts being created or modified.

- **Tests (light but present for the orchestrator):**
  - 7 tests in WorkspaceHeader.test.tsx + panels/**/*.test.tsx.
  - ChatPanel has 1 test file (ChatPanel.test.tsx in its __tests__).
  - The heavy layout/orchestration logic (reducer, resize, peek, persistence, overlay stacking) has some coverage via workspace-reducer.test.ts and useHoverPeekPanel.test.ts (in the workspace/ __tests__ dir), but the full right-column visual + interaction behavior on realistic laptop viewports with long chat threads + open activity feed is still primarily validated by the browser checks in the skill's testing.md.

**Cross-References to Prior Campaign Work:**
- Left Sidebar (pp-view-left-sidebar) — symmetric layout machinery, shared reducer, same UI Container risks.
- AI Chat (pp-view-ai-chat) — ChatPanel is the same heavy surface; this audit focuses on its hosting as the right sidebar column + coordination with ActivityFeed slide-over.
- Provenance campaign (Generative, Component Editor verification gates, 3D, Exports precheck + TrustReceiptCard, Procurement last money gate, breadboard-lab) — the right sidebar is where many of those generative actions are initiated via chat, yet the right column surfaces almost none of the resulting trust/provenance signals.
- Workspace header + command palette + mobile nav (all part of the same ProjectWorkspace orchestrator).
- UI Container Rule enforcement across all dense panels.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Surface provenance / verification / generative-origin signals inside the right sidebar (especially in ChatPanel action results and Activity Feed entries)**
- When the AI creates nodes, BOM items, exports, or validation results from chat, the right column (or the Activity Feed slide-over) should show at minimum a small verification badge or link to the TrustReceipt so the user sees immediately whether the thing they just asked the AI to do is "trusted" or "uncertain/AI-generated."
- This is the missing "last interaction surface" for the safety story.

**P1 — Enforce UI Container Rule on the right column + all competing overlays (Chat thread scroll, input reachability, slide-over + prediction panel + tutorial stacking on laptop viewports)**
- The layout machinery is sophisticated (resize, peek, collapse, persistence, breakpoints). The visual and reachability behavior when Chat is long + ActivityFeed is open + PredictionPanel is visible must be explicitly validated on realistic laptop sizes (not just wide desktop).

**P2 — Increase test coverage for the right-column orchestration (chat collapse/resize/peek flows, activity feed slide-over stacking, mobile bottom nav chat toggle, persistence round-trip)**
- The existing 7 tests + reducer tests are a start; the Tier 1 nature and the fact that the right sidebar is the primary generative action + history surface justify more interaction + visual regression coverage.

**P2 — Continue the tracked a11y / InteractiveCard migration** (multiple eslint-disable blocks in ProjectWorkspace and ChatPanel for div-as-button patterns).

**Strengths (relative to peers):**
- One of the most sophisticated workspace layout systems audited: true resizable + collapsible + peek-hover + persistent + breakpoint-aware left + right sidebars with symmetric code.
- Activity Feed as a dedicated, toggleable slide-over is excellent workflow clarity ("what did the AI just do?").
- Skip links, keyboard resize, and mobile-specific chat toggle show real attention to reachability.
- The reducer + persistence + HoverPeekDock abstraction is reusable and clean.

**Durable Lessons for Future Agents:**
- The right sidebar is not "just the chat panel." It is the primary generative action surface + immediate history surface for the entire project. Every provenance and trust investment upstream must eventually be visible here, or the user has no way to know whether the thing the AI just created is safe to use.
- Symmetric left/right sidebar treatment is powerful but doubles the surface area that must obey the UI Container Rule (scroll, resize, collapse, laptop viewports, focus management).
- Activity Feed as a slide-over (instead of a second permanent column) is a good density decision, but it still competes for the same right-edge real estate as the chat column and all other overlays.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 7 tests).
- Mandatory ast-grep for provenance/trust signals returned zero matches in the three core files.
- Full scc report (413 CCN, heavy Tier 1) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).
- All findings cross-referenced to the Left Sidebar audit, the prior AI Chat audit, the full provenance campaign, the workspace layout machinery, and the global UI Container Rule.
- Detailed Fast Workflow Execution Report appended here; master report section 32 written.

---

*Right Sidebar analysis complete. This is the Tier 1 right "chat" column (resizable, collapsible, peek-hover, persistent) that hosts the heavy ChatPanel (Eve AI) as its permanent resident and the ActivityFeedPanel as a toggleable slide-over. The layout orchestration in ProjectWorkspace is mature and symmetric with the left sidebar. The critical remaining gap is that the primary generative action surface in the app still surfaces almost none of the provenance/trust/verification signals built elsewhere in the campaign. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Right Sidebar section (2026-05-23).*
