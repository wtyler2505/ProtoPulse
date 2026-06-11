# AI Chat Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so AI Chat work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real AI Chat behavior.

## Pending Proposals

- Add screenshots for the main AI Chat states.
- Add more specific gotchas after the next real AI Chat implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05 Deep Methodical Analysis (user directive: "start with /pp-view-ai-chat" + full app backlog)

**Process followed (per skill Fast Workflow):**
1. `node .agents/skills/pp-view-ai-chat/scripts/inspect-ai-chat.mjs` → Status: ok (ChatPanel 1241 LOC / 202 complexity, useChatSettings).
2. Read page-map.md (ownership, globs, neighbors).
3. Read ux-contract.md (must-hold for behavior/layout/tests/workflow clarity, AI data marking, scroll rules, focus on next action).
4. Read testing.md (recorded handles, browser checklist, skill checks).
5. Read gotchas.md (tests don't prove layout, scroll traps, mocked tests hiding warnings, view changes affecting navigation).
6. This log entry + creation of master `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md`.

**Key Findings from Tool-Driven Analysis (inspector + scc + rg + file reads + structure search):**
- **Complexity Hotspot**: ChatPanel.tsx is one of the largest and most complex files in the entire app (1241 LOC, 202 complexity). Sub-files like MessageBubble (317 LOC/100 CC), various action-handlers (some >40 CCN/line), and hooks (useChatPanelUI 51) show concentrated debt.
- **Perf Work Already Present but Incomplete**: CAPX-PERF-01/10/11 comments for memoization, static styles, virtualizer (useVirtualizer with good overscan/measure). However, the orchestrator still subscribes to many project contexts, risking re-renders.
- **Strengths**: Excellent use of virtualized message list, reducer for messaging state, domain action handlers (architecture/bom/validation/export/arduino/navigation), local intent parsing, multimodal/voice, safety/review queue, trust receipts, streaming helpers.
- **Risk Areas**:
  - Streaming + pendingActions + tool execution synchronization (multiple hooks + reducer + SSE).
  - Safety mode + review queue + destructive actions — state can desync.
  - Local intent discoverability (powerful but hidden).
  - Inconsistent "AI uncertain data" marking across sources/bubbles.
  - Empty state suggestions are static/hard-coded.
  - Test coverage thin on integration/streaming/safety paths (mocks hide warnings).
  - A11y disables in header (click on divs) — tracked but pending InteractiveCard migration.
- **Cross-View Opportunity**: The new "View in 3D" button we added in BreadboardPartInspector has no corresponding action or suggestion in AI Chat yet. Perfect integration point.

**Backlog Items Captured (see master report for full categorized list):**
- P0: Streaming/action race conditions, SSE recovery, safety queue sync.
- P1: Local intent UX/discoverability, MessageBubble extraction, settings/key flow consistency, empty state dynamism.
- P2: Branching UI, better token/cost transparency, command palette for intents.
- Tech Debt: High-CCN action handlers and hooks; more aggressive memoization on orchestrator.
- Test Gaps: End-to-end streaming + tool call + 3D handoff flows.
- Integration: AI Chat actions for 3D view, tighter link to the breadboard 3D bridge.

**Durable Lesson for this skill and future agents:**
The AI Chat is the "nervous system" of ProtoPulse — it touches every domain via action handlers and local intents. Any change here has massive blast radius. Always run the inspector + read the full ref set, and treat the chat sub-system as high-risk for state races and trust/uncertainty UX. The previous perf work (virtualizer + memo) is a model for other complex views.

This analysis seeds the full-app backlog report. Codex should continue the same inspector + refs + deep tool dive for every other pp-view-* (starting with the largest: Breadboard canvas, PCB, ComponentEditor, 3D).

**Next immediate action in this session:** Expand the master report with deep dives on 2-3 more high-traffic views (PCB + Breadboard) using the same rigorous method.
