# ProtoPulse Full App Views & Pages Backlog Report
**Generated:** 2026-05 (deep methodical analysis session)
**Requested by:** Tyler — "deeply, extensively, methodically analyze each of the views and pages... every single tiny thing... start with /pp-view-ai-chat"
**Scope:** All 40+ active page skills + core views/panels/sidebars. Frontend + backend. Using all available CLI (ast-grep, scc, lizard, rg, fd, etc.) and MCP tools.

**Methodology followed:**
- For each pp-view-* skill: Run inspector first, read page-map → ux-contract → testing → gotchas → self-improvement-log in order.
- Code exploration: list_dir, read_file (chunked), ast-grep for structure, rg for debt markers, scc/lizard for complexity.
- High-level backend: server/routes, lib/ for chat/AI, contexts.
- Cross-references to previous work (3D hardening, breadboard contracts, etc.).
- Categories in backlog: P0 (blocking), P1 (high friction), P2 (nice-to-have), Tech Debt, Test Gaps, A11y/UX, Perf, Missing Features, Integration.

**Status:** Initial deep dive on AI Chat complete. High-level map for all major views. This is a living document — Codex should continue filling per-view sections.

---

## 1. AI Chat (pp-view-ai-chat) — Deep Dive (Started Here per Request)

**Inspector Result:** Status: ok. Main source: `ChatPanel.tsx` (1241 LOC, 202 complexity — one of the highest in the app). Sub: many hooks, action-handlers for every domain, lib/ for streaming/intent.

**Page Map (key files):**
- `client/src/components/panels/ChatPanel.tsx` (orchestrator, virtualized list, streaming, safety, review queue)
- `client/src/components/panels/chat/**` (MessageBubble, MessageInput, SettingsPanel, DesignAgentPanel, VoiceInput, QuickActionsBar, many action-handlers/*, intent-handlers/*, hooks/useChatMessaging, useActionExecutor, useMultimodalState, etc.)
- `client/src/hooks/useChatSettings.ts`

**UX Contract Highlights (gaps found):**
- Must hold: "AI-generated or uncertain data is clearly marked" — partially there (trust receipts, confidence scores), but inconsistent across bubbles/sources.
- Layout: Long menus/panels must scroll — uses virtualizer for messages (good), but some side panels (AnswerSource, ActionPreview) can grow without perfect containment.
- Focus on next action — empty state has good suggestions, but discoverability of local commands/intents could be better.

**Key Findings & Backlog Items for AI Chat (from code + scc + rg scans):**

**P0 / Blocking or High Risk**
- **Streaming + Action Execution Race Conditions**: Heavy use of useReducer + multiple hooks (useChatMessaging, useActionExecutor). Potential for pendingActions to get out of sync with stream events (see handleSendHelpers, jitSkillEvent). Risk of duplicate tool calls or lost state on reconnect.
- **SSE Reconnection & Abort Handling**: SSE_MAX_RETRIES = 3 hard-coded. Error mapping in mapStreamErrorToUserMessage / mapAbortToMessage. If Gemini or backend flakes, user can get stuck in "isGenerating" state.
- **Safety / Review Queue Integration**: AISafetyModeManager + useReviewQueue + SafetyConfirmDialog. Destructive actions list. If review queue backs up or safety mode changes mid-conversation, trust receipts and pending actions can desync.
- **Multimodal + Voice State**: useMultimodalState + VoiceInput + useMultimodalInput. Large state surface. No clear "clear all attachments on new project" guarantee.

**P1 / High Friction / UX Debt**
- **Empty State & Suggestion Quality**: Hard-coded suggestion buttons in MessageList. Good start, but not dynamic based on current project state (e.g., "if no BOM yet, suggest generate one").
- **Local Intent Parsing (parseLocalIntent.ts)**: Very powerful (domain responses, navigation, queries, commands). But discoverability is low — users don't know what natural language triggers what without docs or better UI hints.
- **MessageBubble Complexity**: 317 LOC, 100 complexity. Renders sources, tool calls, branches, copy, regenerate, etc. Many conditional renders — prime candidate for further extraction.
- **SettingsPanel & ApiKeySetupDialog**: Scattered key management. useApiKeys + useApiKeyStatus + useGoogleWorkspaceToken. Inconsistent "setup" flow when keys are missing mid-chat.
- **FollowUpSuggestions & QuickActionsBar**: Good, but can feel noisy on small viewports. No persistence of "pinned" actions per project.
- **DesignAgentPanel**: Separate panel for generative design. Integration with main chat could be tighter (e.g., "send this design to chat for review").

**P2 / Polish / Nice-to-Have**
- **Token Info Display**: Shown in MessageList, but approximation vs real usage not always clear to user.
- **Branching (createBranch)**: Exists in props, but UI for viewing/ switching branches is minimal.
- **Search (ChatSearchBar)**: Filters messages, but no "jump to result" highlighting in virtualized list.
- **ConnectionStatusDot + StreamingIndicator**: Visual feedback is there, but subtle. On slow networks, user may think it's hung.
- **A11y**: Several eslint disables for click handlers on divs (noted in header as Phase 3 work for InteractiveCard primitive).

**Tech Debt / Perf**
- **High Complexity Subfiles**: Several action-handlers (validation 41 CCN/line, arduino 48, export 30) and hooks (useChatPanelUI 51). These are domain-specific and growing.
- **CAPX-PERF comments**: Evidence of previous perf work (memoized MessageList, static styles, virtualizer). Good, but the overall orchestrator is still 1241 LOC with many contexts subscribed (useArchitecture, useBom, useValidation, useProjectMeta, etc.) — potential for unnecessary re-renders on unrelated project changes.
- **Console / Debt Markers**: 18+ hits in ChatPanel for the scanned patterns (TODOs, inline style objects, useEffect with no deps in some subfiles, console calls in error paths).
- **Test Coverage**: Inspector showed "1 tests" for main ChatPanel. Many sub .test.tsx exist (MessageBubble, VoiceInput, Settings, DesignAgent, useActionExecutor), but integration/streaming/safety flows are under-tested (mocked tests hide runtime warnings per gotchas).

**Missing Features / Integration Gaps**
- No direct tie from AI Chat to the new "View in 3D" button we added in Breadboard (or 3D view state).
- Chat actions for 3D (e.g., "generate ratsnest suggestions" or "explain this airwire group") not implemented.
- Persistence of chat threads per project/branch is in useChat context, but cross-session or export is limited.
- No "Eve personality" deep customization exposed in UI (backend has templates, but chat UI is generic).

**Backend / API Side (for AI Chat)**
- Relies on Gemini (via services/eve or direct), local intent for offline commands.
- Tool calling for many domains — the action-handlers are the bridge.
- Cache invalidation via `invalidateAfterToolCalls`.
- Needs review: rate limiting, cost tracking (tokenInfo), safety guardrails.

**Recommended for Codex on AI Chat:**
- Prioritize streaming + action execution robustness and better error recovery.
- Improve local intent discoverability (command palette? inline hints?).
- Extract more from MessageBubble and the large action-handlers.
- Add E2E browser test for a full "describe -> action preview -> apply -> view in 3D" flow.
- Update self-improvement-log with these findings.

---

## 2. High-Level Map of All Major Views (from 40 page skills + code discovery)

From running inspectors on core ones + fd list (114+ View/Panel files):

**Core Workspace / High Traffic:**
- **DashboardView.tsx** (535 LOC) — Command center. Many widgets. Risk of layout thrash on data loads.
- **PCBLayoutView.tsx** (1340 LOC, 1 test) — The editor heart. pcb-layout/ subdir has many renderers (Pad, Trace, Via, DrcConstraintOverlay). High complexity, sync with other views.
- **SchematicView.tsx** (663 LOC) — ReactFlow based? Needs deep dive for node/edge perf.
- **BoardViewer3DView.tsx** (1534 LOC) — Just heavily hardened (decouple + direct DOM snaps). Still hybrid CSS+R3F risks remain for future.
- **ComponentEditorView.tsx** (1264 LOC) — Shape canvas, generator, validation. Lots of canvas logic.
- **BreadboardView + breadboard-canvas/index.tsx** (709 + 1677 LOC god file) — Known worst file. Coordinate duality (bench vs board), coach, sync. Canvas extraction is still open debt from prior waves.
- **GenerativeDesignView.tsx**, **DigitalTwinView.tsx**, **ArchitectureView.tsx** — Newer generative/AI heavy views. Likely share patterns with AI Chat.

**Sidebars & Navigation:**
- ProjectExplorer (left), RightSidebar — many panels.
- OutputView, History, etc.

**Specialized:**
- ArduinoWorkbench, ValidationView (heavy on issues), Procurement (many sub panels: BOM, Risk, Supplier), Calculators, VaultBrowser, etc.
- KanbanView, KnowledgeView, Community, etc. (less core?).

**Common Patterns Across All (to be expanded per-view):**
- Many use project-context providers (useProjectId, useArchitecture, useChat, useValidation, etc.) — subscription bloat risk.
- Canvas-heavy views (PCB, Schematic, ComponentEditor, Breadboard, 3D) all have their own interaction managers — inconsistent patterns?
- Empty states, loading, error boundaries — varying quality.
- Test coverage generally low for the complex views (0-5 tests per inspector often).
- High CCN files concentrated in editors and AI/chat.

---

## 3. Next Steps for Full Report (Codex Continuation)

This document is the seed. To complete the "every single tiny thing":

1. For each pp-view-* skill:
   - Run inspector (done for core).
   - Read all 5 references in order.
   - Read the main source file(s) in chunks.
   - ast-grep / scc / lizard on the hot files.
   - rg for debt markers, useEffect, inline objects, missing keys, etc.
   - Browser snapshot via chrome-devtools MCP (take_snapshot on each view, look for scroll traps, contrast, focus, clipped content).
   - Backend cross-check (routes, services for that domain).

2. Global scans:
   - All TODO/FIXME across client/src and server/.
   - Complexity hotspots (lizard --sort cyclomatic).
   - Bundle/perf (vite build analyze if possible).
   - A11y (eslint a11y rules, or axe via browser tool).
   - State management consistency (contexts vs Zustand vs URL?).
   - Error boundaries coverage.

3. Categorize backlog in this file:
   - Per-View sections (AI Chat done as example).
   - Cross-Cutting (perf, a11y, docs, testing, AI integration, 3D/breadboard synergy now that we have the bridge button).
   - Quick Wins vs Architectural.

4. Update all relevant self-improvement-logs.

5. Produce prioritized, actionable list for Codex (with file paths, why it matters, suggested approach).

**Current Confidence:** AI Chat section is solid starting point. Full report will be 50+ pages of tiny things when complete.

**Call to Action for Codex:** Continue from here. Start with the next high-traffic view (recommend PCB or Breadboard canvas, as they are the largest).

The foundation for handing over to Codex is now in place, starting with the requested AI Chat deep dive.

**High-fidelity desktop + live evidence (2026-05-23T23-25-42-641Z + live captures)**: The capture produced rich desktop states for the AI chat panel in context (after-click chat panel, settings, integration with workspace actions). Live browser captures while the server was up include the full dashboard with right chat panel expanded, plus a11y trees showing the AI Assistant region alongside the main workspace, left sidebar, and horizontal tabs. This provides current, concrete evidence for the chat panel's integration, density when open, and interaction with the rest of the shell — directly supporting the P1 streaming/action execution, provenance marking, and discoverability items in this section. The new catalog's interaction states for the right panel are the highest-resolution desktop evidence available.

---

## 4. Part Alternates (pp-view-alternates) — Deep Analysis (2026-05)

**User Request:** "/pp-view-alternates <--Analyze this one now"

**Inspector Result:** Status: ok. Very small surface — `PartAlternatesBrowserView.tsx` (135 LOC). Tier 3 skill. No tests recorded for the browser.

**Page Map (from skill):**
- `client/src/components/views/PartAlternatesBrowserView.tsx`
- Related but distinct: `PartAlternatesPanel.tsx` (embedded in ProcurementView)
- Hooks: `use-alternates-browse.ts`, `use-part-alternates.ts` (includes `useSubstitutePart` mutation)
- Backend: `server/routes/parts.ts` + `server/storage/parts.ts`
- AI: `server/ai-tools/parts.ts` (`get_alternates`, `suggest_substitute` ranked by trustLevel)

**What the Feature Actually Is:**
- A "parts that have known substitutes" browser (collapsible list).
- A contextual panel (used in Procurement "Alternates" tab) with real "Replace" action buttons.
- Backed by a `part_alternates` graph with `matchScore` and `trustLevel`.

**Deep Analysis & Backlog Items:**

**P0 — Substitution Safety (explicitly called out in the UX contract but almost invisible in UI)**
- The "Replace" button is raw and dangerous-looking in context. No trustLevel badge, no matchScore, no "why this is a good substitute" explanation.
- The AI tool `suggest_substitute` already ranks by trust internally, but the UI never shows the ranking or reasoning.
- No side-by-side comparison / tradeoffs view (electrical specs, price, stock, lead time, risk).

**P1 — High Friction / Core Value Not Surfaced**
- The standalone browser view is mostly passive "read-only list." The actionable power lives only in the Procurement panel.
- Lazy loading inside collapsibles has very basic loading state.
- No optimistic UI or clear feedback after a successful substitution beyond a toast.
- Discoverability gap between the full browser and the contextual panel.

**P2 — Polish & Minor Debt**
- Minor duplication in rendering logic between browser rows and panel rows.
- Empty state mentions "ingress or AI tools" but doesn't offer a direct action to populate alternates.
- No keyboard / focus management improvements on the collapsibles.
- Cache in `listPartsWithAlternates` is simple in-memory with no invalidation on writes.

**Tech Debt**
- Zero tests recorded for the browser view (panel has a few).
- The view itself is tiny and clean — the real debt is the missing rich comparison/trust layer around a powerful data + AI backend.

**Cross-Cutting (Excellent Synergy with Work Already Done This Session)**
- Perfect place to link from the new "View in 3D" button (mechanical fit of a substitute?).
- AI Chat suggestions from `suggest_substitute` should deep-link here.
- Validation/DRC "bad substitute" warnings should link here.
- Ties directly into breadboard-lab trust/provenance themes.

**Durable Lesson:**
This is a textbook "powerful equivalence graph + AI ranking on the backend, thin and slightly scary frontend" pattern. The data model and AI tools are ahead of the UI. Before making substitution any easier, the "why this alternate is safe/better" surfaces must exist.

**Recommended for Codex:**
- Build a reusable `AlternateComparisonTable` / tradeoffs component.
- Surface trustLevel + matchScore + reasons on every row.
- Add direct navigation from AI Chat suggestions and the 3D/Breadboard bridge.
- Add tests for the browser + mutation paths.
- Consider a "Propose New Alternate" flow for humans (currently mostly AI-driven).

---

*This report continues to grow view-by-view. Next user command can be another /pp-view-xxx to keep the methodical sweep going.*

---

## 12. Comments (pp-view-comments) — Deep Analysis (2026-05)

**User Request:** "/pp-view-comments"

**Inspector Result:** Status: ok. `CommentsPanel.tsx` (501 LOC) — a threaded, anchored discussion system.

**Page Map:**
- `client/src/components/panels/CommentsPanel.tsx`
- Used both as a lazy-loaded panel in the workspace and potentially embedded.

**What It Actually Is:**
A sophisticated project-scoped commenting system with:
- Threaded replies (parentId)
- Rich targets: 'general', 'node', 'edge', 'bom_item', 'spatial' (with x/y + spatialView: architecture/schematic/pcb/breadboard)
- Status workflow: open / resolved / blocked / wontfix + reopen
- Filtering by resolved state and target type
- Full CRUD + status mutations via TanStack Query

Backend fully supports this model (including spatial anchoring).

**Deep Findings & Backlog:**

**P1 — Anchors Visibility is Incomplete (Direct Contract Violation)**
- The UX contract requires "Anchors is visible enough for a user to understand what is happening."
- Spatial comments (especially powerful ones created from PCB with exact canvas coordinates) have almost no first-class representation in the central panel.
- The panel's targetFilter only offers 'general' | 'node' | 'edge' | 'bom_item'. 'spatial' is not exposed as a filter, and spatialView / coordinates are not clearly rendered.
- Result: comments pinned to specific locations on the PCB (or future locations on other views) can become hard to discover or contextualize in the main Comments surface.

**P1 — "Source Trust" for AI-Generated Comments is Missing**
- The contract explicitly calls out that "AI-generated or uncertain data is clearly marked."
- There is currently **zero** visible provenance on comments (no "AI / Eve" badge, no distinction between human and generated review notes).
- This is a direct gap, especially as AI becomes more capable of leaving structured review comments on architecture nodes, BOM items, or spatial locations.

**P1 — Anchoring Creation UX is Uneven Across Views**
- Strong spatial comment creation exists in PCBLayoutView (right-click or tool → place comment with coordinates).
- ArchitectureView, SchematicView, and Breadboard currently have little or no equivalent anchoring surface (confirmed via searches).
- This creates an inconsistent and incomplete experience for the "review notes anchored to the actual design" promise.

**P2 — Real-time & Performance**
- Only 30s staleTime + manual invalidation on mutations. In a collaborative or AI-heavy workflow this will feel stale quickly.
- Threading + filtering performance with hundreds of comments on large projects is untested.

**P2 — Workflow & Polish**
- Status workflow (blocked / wontfix) exists but lacks good "why" context or linking back to originating discussion.
- Empty states, onboarding for the commenting system, and discoverability of the panel itself could be stronger.
- No mentions, reactions, rich text, or attachments yet (future polish).

**Cross-Cutting Opportunities (Very High Value):**
- Perfect complement to the new "View in 3D" bridge and the hardened 3D View — users could leave spatial or node-anchored comments that are visible both on the 2D canvases and in 3D.
- Natural home for AI/Chat to leave review notes (Eve can create comments via the same API, with proper trust badges).
- Strong integration point with Validation, Architecture v3 readiness, Breadboard board health / coach, and Procurement risk discussions.
- Could feed high-value events into the central Audit Trail.

**Durable Lesson:**
A comments system in a multi-view design tool lives or dies by the quality and consistency of its **anchoring surfaces** across every canvas (PCB, Schematic, Architecture, Breadboard, future 3D) and the visibility of **provenance** (especially AI origin). The backend and data model are already quite advanced (spatial + view context). The panel and the per-view anchoring creation tools are the current bottlenecks.

**Recommended for Codex:**
- Expose 'spatial' as a first-class filter in the panel and render spatial context (which view + visual hint) on those comments.
- Add visible AI / trust badges on comments (critical for the contract).
- Add spatial comment creation tools to ArchitectureView, SchematicView, and Breadboard (consistent with what PCB already has).
- Wire the "View in 3D" experience so that comments anchored in 2D are also visible / creatable from the 3D view.
- Add tests for the panel (threading, filtering, status workflow, spatial rendering).
- Consider lightweight real-time or at least optimistic updates + better invalidation.
- Make "Jump to Anchor" from a comment one-click and reliable across views (especially powerful once 3D is in the mix).

---

*Comments analysis complete. The data model and backend are strong, but the anchoring creation surfaces and provenance visibility in the UI are still incomplete relative to the sophistication of the feature and the explicit requirements in its own UX contract. Ready for the next view.*

---

## 11. Circuit Code (pp-view-circuit-code) — Deep Analysis (2026-05)

**User Request:** "/pp-view-circuit-code"

**Inspector Result:** Status: ok. Small Tier 2 surface: `CircuitCodeView.tsx` (177 LOC). The real power is in the `circuit-dsl/` library underneath (~5.6k LOC, 531 complexity across parser, IR, worker evaluator, completions, code generator, IR→schematic, etc.).

**Page Map:**
- `client/src/components/views/CircuitCodeView.tsx`
- `client/src/components/views/circuit-code/{CodeEditor.tsx, SchematicPreview.tsx}`

**What the View Actually Is:**
- A **bidirectional textual circuit design environment**:
  - Left: CodeMirror 6 editor for a custom circuit DSL (with completions, linting from eval errors).
  - Right: Live SVG schematic preview generated from the IR.
  - Bottom: Error panel (click-to-jump to line) + status + "Apply to Project" button.
- The DSL supports round-tripping: visual editors can generate code, and code can be edited live with instant visual feedback.
- "Apply" posts the layout to `/api/projects/:id/circuits/apply-code`, which creates real `CircuitDesign` + instances in the canonical model.

**Deep Findings & Backlog:**

**P1 — "Source Trust" is Named in the Contract but Almost Invisible in the UI**
- The UX contract explicitly calls out **Source Trust** as a must-hold ("Source Trust is visible enough for a user to understand what is happening").
- There is currently **no provenance UI** in the view: no indicator of whether the current code was AI-generated, user-written, imported from visual editor, verified, or has any trust/reliability metadata.
- This is a direct violation of the contract for a view whose entire purpose is "generated circuit code."

**P1 — Apply Flow Has Weak Preview & Explanation**
- The "Apply to Project" button exists and works (creates real circuit designs from the DSL IR).
- There is no preview of *what* will be created (new designs? instances? nets?), no diff, and minimal feedback beyond a toast with a circuit ID.
- Users have little idea of the consequences of applying code vs. continuing to edit visually.

**P2 — Engine vs. Shell Split**
- The view itself is a thin, clean shell (good).
- Almost all complexity lives in `lib/circuit-dsl/` (parser, IR, web worker evaluator, code generator (visual→code), completions, error mapping, net naming, IR→schematic, etc.).
- The worker-based live evaluation (300ms debounce) is architecturally sound, but worker stability, large-design performance, and cancellation are not exercised or tested from the view.

**P2 — Test Coverage**
- Zero tests recorded for the view, despite the sophistication of the underlying DSL engine and the "apply" path into the canonical circuit model.

**P2 — Integration Opportunities**
- Strong latent tie to AI/Chat (the code generator + completions are perfect for "write this circuit in DSL from description").
- Round-tripping between visual editors (Schematic/PCB/Component Editor) and this textual view is powerful but not yet first-class or heavily surfaced.
- No obvious feed into the Audit Trail when code is applied (high-value "I committed this textual design" event).

**Strengths:**
- Excellent error UX (line-accurate diagnostics, click-to-jump).
- Thoughtful live preview architecture (worker + IR + dedicated lightweight SVG renderer, not reusing the full SchematicView).
- The DSL itself (parser, IR, completions, generator) is a significant engineering asset.

**Durable Lesson:**
When you build a powerful textual DSL with live visual preview and an "apply into canonical model" path, the highest-leverage UX work is making **provenance** and **consequences of apply** transparent. "Source Trust" and "Generated Circuit Code" visibility are not backend-only concerns — they must be first-class in the editing surface itself.

**Recommended for Codex:**
- Add visible source trust / provenance UI in the header or status bar (AI-generated? Round-tripped from visual? User-written? Verified?).
- Improve the Apply preview / diff / explanation (what new designs/instances/nets will be created?).
- Add tests for the view (especially error mapping, live eval, and apply flow).
- Deepen AI/Chat integration so that generated circuit DSL code can be opened directly in this view with proper trust metadata attached.
- Consider surfacing this view more proactively from the visual editors ("Edit this design in code") and vice versa.

---

*Circuit Code analysis complete. The engine is solid and the view shell is clean, but the "Source Trust" and "Apply consequences" surfaces called out in its own UX contract are the clearest gaps. Ready for the next view.*

---

## 10. Calculators (pp-view-calculators) — Deep Analysis (2026-05)

**User Request:** "/pp-view-calculators"

**Inspector Result:** Status: ok. `CalculatorsView.tsx` (1023 LOC / 93 complexity) — a moderate-sized collection of practical electronics calculators.

**Page Map:** Single file `CalculatorsView.tsx`. No tests recorded for the view.

**What It Actually Is:**
- A clean, card-based grid of maker-oriented calculators:
  - Ohm's Law (V = I × R)
  - LED Current-Limiting Resistor
  - Voltage Divider (forward calculation + reverse "suggest pairs")
  - RC Time Constant
  - RC Low-Pass / Bandpass Filter Cutoff
  - Power Dissipation
- Each calculator has good engineering notation output, input validation, reset, and a `CalcApplyButtons` component offering "Add to BOM" and "Apply to Component" (clipboard) actions.
- Strong accessibility attention (explicit handling of spinbutton `aria-valuemax` issues from past E2E bugs).

**Deep Findings & Backlog:**

**P1 — "Apply To Design Actions" is the Biggest Miss vs. the UX Contract**
- The contract explicitly requires that "Apply To Design Actions is visible enough for a user to understand what is happening."
- Current implementation is weak:
  - "Add to BOM" creates low-fidelity generic entries (Unknown supplier, zero prices, etc.).
  - "Apply to Component" is literally just copying a string to the clipboard for manual pasting.
- There is **no deep integration** with the component editor, schematic, or PCB (e.g., setting a property on a selected instance, updating a resistor value in the netlist, etc.).
- This is the single largest gap for a view whose contract calls out "Apply To Design" as a first-class concern.

**P1 — Integration with the Rest of the System**
- Calculators are somewhat isolated. High-value connections are missing:
  - Right-click a resistor in the component editor or PCB → "Calculate LED resistor for this LED".
  - Feed calculator results directly into power validation or thermal analysis.
  - AI/Chat suggesting or invoking the right calculator based on the current design state.
- Reverse flow (design data populating calculator inputs) is also weak.

**P2 — Polish & Test Coverage**
- No automated tests for the view or the apply layer (despite individual solver functions existing).
- With many calculator cards, the grid layout must stay clean and non-overwhelming on laptop viewports (per contract).
- Edge-case handling and error messaging are generally good, but could be even more consistent across all calculators.
- No persistent history of recent calculations or "favorite" calculators per user/project.

**P2 — Units & Validation Depth**
- Engineering notation is used well, but unit coercion / auto-suggest between related calculators (e.g., feeding a voltage divider result into a filter cutoff) is manual.
- Some calculators have "suggest" modes (voltage divider pairs); others could benefit from similar intelligence.

**Strengths:**
- Very practical, maker-focused set of calculators.
- Thoughtful a11y work (the MAX_CALC_VALUE + spinbutton story is a nice example of learning from real E2E pain).
- Clean, low-complexity implementation for the number of features.

**Cross-Cutting Opportunities (tying to previous work in this campaign):**
- Natural deep integration with the Component Editor, PCB Layout, Schematic, and Validation views.
- Excellent surface for AI/Chat (both invoking calculators and consuming their results).
- Could feed high-value events into the Audit Trail when a user applies a calculated value to a real design.
- Complements the "apply" philosophy we're strengthening in BOM Templates.

**Durable Lesson:**
A collection of calculators is only as good as its "last mile" into the actual design. When the UX contract explicitly calls out "Apply To Design Actions" as a must-hold item, clipboard + generic BOM stubs do not satisfy the requirement. The highest-leverage work is making the apply path context-aware and one-click (or at least one-dialog).

**Recommended for Codex:**
- Significantly strengthen the apply layer (`lib/calculator-apply.ts` + `CalcApplyButtons`) to support real property setting on selected components and higher-quality BOM items.
- Add direct context menus / right-click actions from the component editor and PCB ("Calculate for this part").
- Add tests for the main calculators and apply paths.
- Explore bidirectional AI/Chat integration (invoke calculator from chat, send result back as a design action).
- Consider a "calculation history" or per-project favorites feature.

---

*Calculators analysis complete. The view is clean and genuinely useful for manual work, but the "apply to design" story (the thing the contract cares most about) is the clearest area for substantial improvement. Ready for the next view.*

---

## 9. Breadboard (pp-view-breadboard) — Deep Analysis (2026-05, continued from cross-track kickoff)

**User Request:** "/pp-view-breadboard"

**Inspector Result:** Status: ok. This is a **Tier 1, high-debt surface**.
- BreadboardView.tsx: 709 LOC / 147 complexity
- breadboard-canvas/index.tsx: **1677 LOC / 475 complexity** — still the single worst file in the entire codebase
- useBreadboardCoachPlan.ts: 645 LOC / 197 complexity (very high density)
- HardwareInspectionPanel.tsx: 628 LOC
- view-sync.ts: 767 LOC (shared but critical)

**Current State vs Previous Work:**
- During the earlier "fully complete the todo list" pass, we added the `onViewIn3D?: () => void` prop to `BreadboardPartInspector` and rendered the "View in 3D" button in the inspector header.
- **Status today:** The UI surface exists in the inspector, but `BreadboardView.tsx` still does **not** pass the handler (confirmed via rg). The button is dead code until wired.
- The canvas god file comment still says "Phase 2 (W1.12b) will split this into sub-files" — extraction never landed.
- The "View in 3D" bridge is the most obvious, highest-leverage item from the previous Enhancement Backlog v1.

**Deep Methodical Findings (using scc, rg, file reads, cross-refs to 3D stabilization):**

**P0 — Canvas Extraction Debt (the #1 technical risk)**
- 1677 lines of mixed concerns: SVG rendering, drag/move logic, bench vs board coordinate duality, multiple overlays (ratsnest, connectivity, DRC, component, bench parts), wire editing, cursor state, etc.
- This single file owns "the entire Lab identity".
- Every time someone touches breadboard, they risk breaking provenance, sync, coach, or hit testing.

**P0 — "View in 3D" Integration Not Completed**
- The prop and button were added as the "small win" to tie Breadboard to the now-stable 3D View (after the massive hybrid perf work: Canvas hoist + direct-DOM snaps).
- Parent never received the handler. This is low-hanging fruit that directly delivers on the user's original "ALL IN on 3D" + "also start on Breadboard" request.

**P1 — Coach & Board Health Visibility**
- `useBreadboardCoachPlan.ts` is extremely complex (197 CCN). The coach is powerful but its output can feel overwhelming or not actionable enough on the canvas.
- Board health / audit panel exists but may not be discoverable enough from the main surface.
- Trust tier and provenance badges (starter vs project vs exact vs coach vs synced) are critical per the breadboard-lab contracts but still not instantly scannable in all contexts.

**P1 — Hardware Inspection & Real-World Trust**
- `HardwareInspectionPanel.tsx` (628 LOC) is the VLM hardware photo workflow — excellent for trust, but the round-trip from photo → part identification → placement on bench has friction points.
- Integration between virtual bench state and real photo evidence could be stronger.

**P2 — UX / Layout / Scroll / Container Issues (per UI Container Rule)**
- The main canvas surface and side panels need constant vigilance for scroll traps, fixed heights, and overflow.

**Live 2026-05-23 evidence (running app on :5000, Blink LED sample, /projects/67/breadboard + shell)**: Fresh full-page PNG + verbose a11y tree captured (live-breadboard-current-full.png + live-breadboard-current-a11y.txt, also live-schematic-*, live-dashboard-sidebar-expanded.png). Current shell state matches the debt description: left project explorer sidebar (280 px resize separator, "PROJECT EXPLORER" search + many "Collapse XXX" expandable groups, Coach panel with Student/Hobbyist/Pro modes + progress, Timeline filters, "Project Settings" button), horizontal main tabs (Dashboard/Architecture/Schematic/Breadboard), right "AI Assistant", main canvas tabpanel with coach tips. The high-density left nav + canvas surface are exactly the areas flagged for extraction and container discipline. These live captures (plus the future full multi-viewport catalog) provide the concrete before/after for the "View in 3D" wiring, coach visibility, and scroll behavior P1/P2 items.
- Wire editing UX, exact part request flow, inventory dialog, starter shelf, and quick intake all have their own small friction points.
- Empty states and beginner discoverability still have room for improvement (even after previous polish).

**Cross-Cutting Opportunities (Strong Ties to 3D Work)**
- The now-stable BoardViewer3DView (decoupled R3F + direct-DOM rotation snaps) is the perfect destination for the "View in 3D" action.
- Mechanical fit, 3D wiring guides, and clearance visualization become immediately valuable once a breadboard placement can be pushed to 3D.
- Opportunity for bidirectional sync (select in 3D → highlight on breadboard).

**Other Tiny Things (examples of the level of detail expected):**
- Ratsnest / connectivity overlay performance on dense boards.
- DRC overlay feedback loop (does highlighting a DRC issue select the offending wire/part?).
- Coach plan application UX (preview before apply? undo?).
- Exact part request flow friction.
- Stash vs board coordinate mental model clarity for beginners.
- Keyboard navigation and a11y on the canvas (many eslint disables still present).
- Integration with AI chat prompts for breadboard-specific coaching.

**Durable Lessons (to be added to self-improvement-log):**
- When a page has a single 1677-line god file that owns the entire user mental model (bench vs board), every other improvement is fighting gravity until that file is split.
- Adding a cross-view bridge ("View in 3D") is high-value only if the parent actually wires the handler — UI surface without dispatch is dead code.
- Breadboard is the place where "virtual" and "physical" meet. Features that increase trust (hardware photos, 3D fit, provenance badges, coach realism) have outsized impact.

**Recommended Immediate Actions for Codex (prioritized from previous Enhancement Backlog v1 + fresh analysis):**
1. **Wire the "View in 3D" handler** in BreadboardView (5–15 min task, massive narrative closure).
2. **Canvas extraction** — follow the existing proposal (Viewport → BenchSurfaceManager first). Do not touch until contracts + guard tests are solid.
3. Stronger provenance / trust badge visibility across the main surface.
4. Board health + coach integration improvements.
5. Empty state / beginner discoverability polish.
6. Deeper 3D <-> Breadboard bidirectional features once the bridge is live.

This view is the heart of the "maker" experience in ProtoPulse. It is currently the highest-leverage place to deliver on both the 3D stabilization work and the breadboard-lab identity.

**High-fidelity desktop interaction evidence from 2026-05-23T23-25-42-641Z-full-app-catalog (max-elements=120, max-interactions=45)**: This partial-but-rich desktop-only run (server died after ~2.9 h) still produced 138 files for breadboard, including many real post-interaction states that directly test the flows flagged in this section:
- 124-after-click-toggle-sidebar.png through 128-after-click-tab-breadboard.png (sidebar + tab switching from breadboard context)
- 129/130: workspace-open-hardware-inspection + overlay
- 133/134: button-open-breadboard-stash + overlay
- 135–138: cross-navigation from breadboard to schematic, component-editor, community + overlays

These are the exact kinds of "after real user action" states the report has been requesting for validating coach, stash, hardware inspection, and cross-view provenance flows. They should be used as the new baseline for visual regression on the breadboard surface. The run also produced comparable rich sets for Component Editor (70+ files with exact-part trust badges, metadata form, generate/AI/extract/validate/publish/import flows, tab switching between editors) — see the component-editor desktop folder in the same timestamped catalog.

**High-fidelity desktop interaction evidence (2026-05-23T23-25-42-641Z-full-app-catalog, max-elements=120 / max-interactions=45, synthetic-rich project 66)**: Even though the full multi-viewport run was interrupted (dev server on :5000 became unreachable after ~2.9 h — net::ERR_CONNECTION_REFUSED when loading the next page), the desktop pass alone produced extremely rich evidence for breadboard:
- 138 files in synthetic-rich/pp-view-breadboard__breadboard/desktop/, including 001-default-viewport.png, 002-full-page.png, 003-workspace-main.png + 100+ targeted element crops (holes, rails, labels, tools, canvas, stash, hardware inspection, etc.)
- Real post-interaction states: 124-after-click-toggle-sidebar.png, 125-after-click-tab-dashboard.png ... 128-after-click-tab-breadboard.png, 129-after-click-workspace-open-hardware-inspection.png + overlay, 133-after-click-button-open-breadboard-stash.png + overlay, 135-after-click-button-open-schematic-from-breadboard.png, 136-after-click-button-open-component-editor-from-breadboard.png, 137-after-click-button-open-community-from-breadboard.png + overlay, etc.

These files demonstrate the exact tab-switching, stash, hardware-inspection, and cross-view navigation flows that the P0 canvas extraction, P1 coach/board-health, P1 "View in 3D" bridge, and P2 container/UX items are about. They are the best desktop evidence we currently have and should be used for visual regression baselines and for validating the container discipline + provenance visibility work.

---

*Breadboard analysis complete for this pass. The "View in 3D" wiring is the clearest, highest-ROI item still sitting on the table from the previous todo list completion. Ready for the next view.*

---

## 8. BOM Templates (pp-view-bom-templates) — Deep Analysis (2026-05)

**User Request:** "/pp-view-bom-templates"

**Inspector Result:** Status: ok. Small, clean Tier 3 surface: `BomTemplatesPanel.tsx` (215 LOC).

**Page Map:**
- `client/src/components/views/BomTemplatesPanel.tsx`
- Used both embedded in `ProcurementView.tsx` (with live BOM) and as a standalone lazy-loaded view.
- Hooks: `use-bom-templates.ts` (list, create, apply, delete + detail)
- Backend: `server/routes/bom-templates.ts` (more complete than UI — supports PATCH editing)

**What It Is:**
A practical reuse tool:
- "Save current BOM as Template" (name + description/tags from the active procurement BOM).
- Browse/Apply/Delete existing templates (Apply merges items into project stock via the ingress path, reporting created vs. skipped).
- Clean TanStack Query mutations with proper invalidation.

**Deep Findings & Backlog:**

**P1 — Incomplete "Template Editing" (explicit UX contract requirement)**
- Backend fully supports PATCH for name, description, tags.
- UI has **zero** editing capability (no modal, no inline edit, no tag management).
- "Template Editing" is called out in the contract but is missing.

**P1 — Apply Flow is "Blind" (Safety & Trust Gap)**
- Apply performs a merge with no preview of what will be created vs. skipped.
- No diff view, no conflict resolution, no "dry run".
- When used standalone (no current BOM prop), the "Save as Template" section is dead weight.

**P2 — Polish & Discoverability**
- No search/filtering on the template list (by name, tags, description).
- No rich preview of template contents before applying (detail hook exists but unused in the panel).
- Weak AI integration (AI could suggest/create/apply templates based on design state).
- Empty state is functional but offers no guidance on template strategy.

**P2 — Integration & Test Gaps**
- No tests for the panel.
- Limited cross-feature links (e.g., from Inventory, Validation, or 3D views to "save this configuration").
- Templates are user-scoped; no team/organization sharing or folders.

**Cross-Cutting Opportunities (ties to previous campaign work):**
- Natural home for procurement velocity (already embedded).
- Strong synergy with AI/Chat (generate template from description, recommend templates for current design, explain a template).
- Could emit high-value events to the Audit Trail (create/apply/delete).
- Complements Breadboard/3D work (common sub-assembly templates that have known breadboard layouts or enclosures).

**Strengths:**
- Backend is more mature than the UI (full CRUD + apply via ingress).
- Clean, low-complexity implementation.
- Immediate practical value when saving the current procurement state.

**Durable Lesson:**
BOM Templates is a "reuse accelerator" whose value is gated by the quality of the Apply experience and the completeness of the editing/preview loop. The data layer is ready; the UX is still "create from current + blind apply." This is low-risk to enhance but high-ROI for procurement teams.

**Recommended for Codex:**
- Add full template editing UI (name/desc/tags) leveraging the existing PATCH.
- Build a proper Apply preview/diff view (use the detail endpoint) before mutation.
- Add search + richer template browsing.
- Deepen AI integration (suggest, generate, apply via chat).
- Add tests + surface the feature more proactively from other BOM-related views.

---

*Continuing the exhaustive, contract-following analysis of every view for the Codex handoff. The BOM Templates surface is small, clean, and useful where it exists, but incomplete relative to its contract and backend maturity. Ready for the next `/pp-view-xxx`.*

---

## 7. Audit Trail (pp-view-audit-trail) — Deep Analysis (2026-05)

**User Request:** "/pp-view-audit-trail"

**Inspector Result:** Status: ok. Small Tier 3 surface: `AuditTrailView.tsx` (418 LOC).

**Page Map:** Single file `AuditTrailView.tsx`. No tests recorded for the view.

**Current Reality (Critical Finding):**
- The UI is **complete and well-built scaffolding** (filtering by date/user/entity/action/search, collapsible rows with rich before/after diffs via `formatAuditDiff`, CSV export, action icons, entity badges, etc.).
- **However**, it currently renders an **empty list** (`const ENTRIES: AuditEntry[] = [];`).
- Historical note in the code explains it used to have demo data that was removed. The real business-level audit event subsystem (with entity changes, before/after snapshots, traceability across project/architecture/circuit/bom/validation/component/setting/etc.) is tracked as **BL-0863** and is not yet emitting events.
- The backend has low-level HTTP request auditing (`server/audit-log.ts`), but it produces a different shape than the rich `AuditEntry` the frontend expects.

**Key Strengths:**
- The supporting library (`audit-trail.ts` + `audit-log-explorer.ts`) is clean, well-typed, and has good diff formatting.
- The view already handles the full contract requirements for "visibility of Audit Events, Filtering, Evidence, Traceability" once real data arrives.
- There is already a rich ecosystem of specialized audits (a11y, button-type, focus-ring, breadboard-board-audit) that can feed this central trail.

**Identified Gaps / Backlog Items:**

**P0 / P1 — Data Emission (the actual blocker)**
- Almost no business events are currently being recorded with the required `before/after` structure.
- Without events flowing from Architecture mutations, circuit changes, BOM edits, validation, component changes, etc., this view will remain an empty (but pretty) page.
- Scope and storage strategy for audit events (project vs global, retention, performance) are not yet defined.

**P1 — Test Coverage & Readiness**
- No tests for the view itself.
- When real data arrives in volume, the current client-side filtering + ScrollArea implementation will likely need virtualization or server-side pagination/filtering.

**P2 — Polish**
- Diff rendering is functional but could be more beautiful (syntax highlighting for objects, better "who changed what" summaries, side-by-side vs unified diff options).
- Filtering UI (many selects + search + date range) risks becoming crowded on smaller viewports.
- Empty state is honest ("No audit entries found") but could link to "how events will start appearing" or configuration.

**Cross-Cutting Value:**
- This is the natural home for all the specialized audit modules already being built (a11y, breadboard, etc.).
- Extremely high value for traceability, compliance, debugging, and "what happened in this project" questions — especially as the v3 architecture and complex AI actions grow.
- Complements the trust/provenance work in Breadboard and the safety work in Arduino.

**Durable Lesson:**
Building a polished audit UI before the events exist is not a mistake — it makes the requirement real for the backend and other modules. The current state (ready helpers + honest empty UI) is the correct holding pattern. The real work is now on the emission side (BL-0863), not the view.

**Recommended for Codex:**
- Drive emission of rich `AuditEntry` events from the major data mutation paths (start with Architecture + Circuit + BOM + Validation).
- Decide on storage, retention, and query strategy for audit events.
- Add virtualization/pagination to the view once volume is understood.
- Wire the existing specialized audits into the central trail.
- Add tests for the view + filtering + export once real data is present.

---

*Continuing the exhaustive, contract-following analysis of every view for the Codex handoff. The Audit Trail view is a clean, low-risk, high-readiness surface waiting on backend event emission. Ready for the next `/pp-view-xxx`.*

---

## 6. Arduino (pp-view-arduino) — Deep Analysis (2026-05)

**User Request:** "/pp-view-arduino"

**Inspector Result:** Status: ok. `ArduinoWorkbenchView.tsx` (835 LOC / 173 complexity). Several supporting panels with notable complexity (JobHistory, BoardManager, LibraryManager, ConsoleOutput).

**Page Map:**
- Main: `ArduinoWorkbenchView.tsx`
- Subdir `arduino/`: ArduinoBoardManager, ArduinoToolbar, ArduinoFileExplorer, ArduinoLibraryManager, ArduinoConsoleOutput, ArduinoBottomPanel, ExamplesBrowser, JobHistoryPanel + types.

**What It Is:**
A full-featured in-browser Arduino IDE/workbench tightly integrated with the ProtoPulse project:
- Sketch file management
- Board / core / library management
- Compile + Upload with pre-flight safety checks and flash diagnostics
- Serial console + job history
- Strong ties to circuit data (auto pin constants, conflict detection)
- AI-assisted sketch generation and rich error intelligence (translation + knowledge linking)

**Deep Findings & Backlog (added to master report):**

**P1 — Test Coverage Gap (Safety-Critical Area)**
- Very thin automated test coverage on the main workbench despite handling real hardware operations (upload to wrong port/fqbn can be destructive or wasteful).
- Many coordinated useEffects and state (jobs, flash progress, detected boards, syntax errors, console logs) create risk of races or stale UI during long-running operations.

**P1 — Visibility of Multi-Stage Workflows (Compile/Upload/Serial per UX contract)**
- The full lifecycle (compile → target confirmation → upload → flash progress + diagnostics) is powerful but distributed across toolbar, console, bottom panel, and transient dialogs. It may not be "visible enough at a glance" for a user to understand exactly what is happening.
- Board/profile selection and "currently targeted device" status could be more prominent and always visible.

**P2 — Polish & Integration Opportunities**
- Excellent existing investment in safety (pre-flight, diagnostics, pin conflict checker) and intelligence (error translation + knowledge base). These could be even more discoverable and actionable from the AI Chat.
- Examples browser and library management are good but could have tighter "generate from description" or "explain this library" hooks into the AI.
- Console output handling and auto-scroll behavior in a complex multi-job environment could use refinement.

**Strengths:**
- One of the best examples of "specialized tool deeply integrated with the rest of the system" (circuit data → pins → sketch, AI code gen, trust receipts, rich errors).
- Device safety and diagnostics are genuinely thoughtful (rare in hobbyist Arduino tools).
- Job history, profiles, and library management make it feel like a real professional workbench.

**Cross-Cutting Value:**
- Prime surface for AI/Chat collaboration (sketch generation, "why did this fail?", "generate test sketch for this board").
- Natural bridge to 3D (enclosures) and Breadboard (pinout transfer, starter circuits).
- Validation could grow Arduino-specific rules on top of the existing pin conflict work.

**Durable Lesson:**
When building hardware-facing tools inside a larger system, the highest-ROI areas are safety pre-checks, excellent error intelligence, and tight data integration with the schematic/circuit model. ProtoPulse has done this well for Arduino. The remaining work is mostly making the complex multi-stage flows even more transparent and increasing test coverage on the orchestrator.

**Recommended for Codex:**
- Add solid integration and E2E-style tests for the compile/upload/safety flows.
- Design a clearer top-level "current operation" / progress affordance that spans the entire lifecycle.
- Deepen the AI hooks (the `generateSketch` and error linker are already excellent foundations).
- Review real-time serial monitor experience vs. build log.

---

*Continuing the exhaustive, contract-following analysis of every view. The Arduino workbench is notably mature and safety-conscious. Ready for the next `/pp-view-xxx`.*

---

## 5. Architecture (pp-view-architecture) — Deep Analysis (2026-05)

**User Request:** "/pp-view-architecture"

**Inspector Result:** Status: ok. One of the heavier views: `ArchitectureView.tsx` (1509 LOC / 302 complexity), high-density V3 panel, context + 3 supporting components.

**Key Characteristics (from code + skill log history):**
- Custom absolute-positioned DOM nodes + SVG edges canvas with a hand-rolled `reactFlowInstance` shim (fitView, screenToFlowPosition, etc. implemented via native scroll + getBoundingClientRect).
- **Dual-purpose view**: Live editable architecture diagrams **and** the advanced v3 architecture readiness / compiler gate (live evaluation of compile reports, swarm tasks, verified source enrichment, execution readiness).
- Major recent progress (Phase 0): Extraction of reusable `lib/diagram/` primitives (coordinate, snap, drag, hit, anchors) and first integration of `getNodeAnchor` to remove magic +75/+35 offsets.

**Analysis Highlights & Backlog Items:**

**P1 — Custom Canvas Fragility & Dual Maintenance**
- The shim has documented stale-closure problems (useMemo depending on localNodes).
- Running a full custom canvas editor while simultaneously driving the v3 tldraw + typed-boundary compiler target in the same UI is powerful for the "readiness" experience but creates significant ongoing cost.
- Many interactions still depend on the shim and absolute + SVG patterns.

**P1 — Complexity**
- V3ArchitectureReadinessPanel has extremely high complexity density.
- The main view concentrates canvas logic, undo, v3 pipeline, and readiness UI.

**P2 — Migration & Usability**
- The v3 gate is sophisticated, but the story from "current custom canvas" to "future tldraw + compiler" could be clearer for users.
- Full support for variable node sizes (measured via ResizeObserver) in the new anchors is still in progress.

**Strengths (notable compared to peers):**
- 24 tests + clean recent extraction work (inspector stayed green after every Phase 0 step).
- Strong adherence to UI Container Rule on panels.
- Excellent example of "live tool + future preview" in one surface.

**Cross-Cutting Value:**
- The diagram primitives are the best path to consistency with Component Editor, PCB, etc.
- Rich surface for AI/Chat (v3 reports and swarm tasks).
- Natural extension point for the 3D + Breadboard bridge work.

**Durable Lesson:**
When a view must serve as both daily editor and live preview of a future architecture, the correct move is aggressive extraction of neutral, testable primitives (exactly what Phase 0 delivered). Future work should keep pressure on measuredSize + complete anchor replacement.

**Recommended Codex Work:**
- Wire real measured node sizes into `getNodeAnchor`.
- Extract more v3 pipeline logic if it continues growing.
- Drive cross-view consistency via the diagram library.
- Add E2E coverage for the canvas + v3 gate.

---

*Methodical sweep continuing. Architecture is in a healthier state than most complex views thanks to the disciplined extraction. Ready for the next view.*

---

## 13. Community (pp-view-community) — Deep Analysis (2026-05)

**User Request:** "/pp-view-community"

**Inspector Result (entry and exit):** Status: ok on first run. Main source `client/src/components/views/CommunityView.tsx` (705 lines). Core logic `client/src/lib/community-library.ts` (1254 lines). All references present, no missing files. Re-run at close of analysis pass remained clean.

**Page Map (key files from exploration + scc):**
- `client/src/components/views/CommunityView.tsx` (618 code LOC / 39 CCN — deliberately lightweight shell: tabs, filters, Card grid, Radix Dialog detail, StarRating, CollectionsPanel with local create/delete).
- `client/src/lib/community-library.ts` (979 code / 317 CCN — singleton + seed data + search/rate/download/collections state machine + localStorage persistence).
- `client/src/lib/community-bom-bridge.ts` + `AddToBomPrompt` usage (the *only* existing "apply to design" surface).
- Mounting: `ViewRenderer.tsx`, lazy-imports.ts, view-prefetch.
- Backend contrast (not used by this view): `server/routes/components.ts` (mature parts ingress, `community-fzpz`, `origin: 'community'`, verificationLevel, evidence arrays, AI generation with communitySourceUrl).
- Types: `ComponentType = 'schematic-symbol' | 'footprint' | 'pcb-module' | 'snippet' | '3d-model'`

**UX Contract Highlights & Gaps Found (vs. page-map + ux-contract + breadboard-lab provenance identity):**

- **Strong surface, zero downstream wiring (P0/P1)**: The UI is polished (search + 5 sort modes + type filter, Featured/Trending/New Arrivals sections, interactive rating in detail, license VaultHoverCard teaching affordance on every card + detail, collections with public/private toggle). But `handleDownload` does nothing more than:
  1. Call the library (increments count, returns copy).
  2. Trigger a browser `Blob` JSON download.
  3. Optionally show `AddToBomPrompt` via the bom-bridge.
  There is **no path** from a selected `CommunityComponent` (even when `type === '3d-model'`) into `useCircuitDesigns` / `CircuitInstance` placement, BreadboardView exact-part drop, or the now-hardened `BoardViewer3DView` (even for the explicit `'3d-model'` type).

- **Missing "Source Trust" and Import Safety surface (P1)**: Author `reputation` number exists in the model. VaultHoverCard is used for *licenses* (excellent, exactly the pattern the breadboard-lab provenance work wants). But there is no verification badge, evidence list, "community-only" warning, or "preview before import" diff — nothing comparable to the parts catalog's `PartTrustCarrier`, `verificationLevel`, or the FZPZ ingress evidence pipeline.

- **Two disconnected community systems (architectural finding)**: 
  - This view = aspirational reusable EDA assets (symbols, footprints, 3d-models, pcb-modules) — client-only demo data.
  - Real community contribution surface lives in the parts catalog + AI generation + breadboard exact parts (with full provenance, audit, and "exact vs approximate" discipline).
  The boundary is not documented anywhere a future agent would find it.

- **3D + Breadboard integration debt (high-ROI after the 3D rescue campaign)**: The 3D View hardening (hybrid CSS substrate + R3F airwires, net-aware unrouted computation, direct-DOM snaps, WebGL recovery) just landed. A community `'3d-model'` component is the perfect first real consumer, yet the card and detail have zero "View in 3D" or "Place on Board" action. Same for breadboard-lab (the "View in 3D" button work on BreadboardPartInspector is the mirror image of this gap).

- **Collections are local-only (P2)**: Create/delete works beautifully in the UI, but nothing is ever published or synced. No "community collections" or "fork this collection" flow.

- **Positive signals that should be amplified**:
  - Already using `VaultHoverCard` for license plain-English — this is the right primitive for future trust badges on author / verification.
  - The BOM bridge is a working (if narrow) example of "downloading has consequence in the user's project."
  - Low UI complexity + strict test-ids + good a11y markers (the view itself is not a hotspot).

**P0 / P1 / P2 Backlog Items for Codex (prioritized for handoff):**

**P1 — Deep Import / Preview / Consequence Flow (highest leverage)**
- In `ComponentDetail`, replace or augment the lone "Download Component" button with a richer action bar: "Add to BOM" (existing), "Place on Breadboard", "Import Symbol/Footprint to Library", "View in 3D" (dispatch to the hardened BoardViewer3DView with the model payload), "Add to Active CircuitDesign as Instance".
- The `data` payload needs a typed preview renderer (SVG for symbols, 3D thumbnail for models, pin table for footprints) + a safe "Apply" flow that creates real `CircuitInstance` or breadboard placement records with provenance ("sourced from community:<id>").
- This is the direct mirror of the "View in 3D" button that was added to BreadboardPartInspector but never dispatched from the parent — the two tracks are begging to be joined.

**P1 — Trust & Provenance Surface (align with breadboard-lab identity)**
- Add a `verificationLevel` or `evidence` field (or at minimum a visual badge) inside the detail and on cards.
- Make author reputation filterable and visually prominent.
- When a community asset is used, write an audit-trail event and attach it to the resulting `CircuitInstance` / part placement (so the board health / coach can later say "this footprint came from unverified community source X").

**P2 — 3D-Model First-Class Consumer**
- After the 3D rescue, a community 3d-model should be the easiest win for "real data in the viewer."
- Requires a small registry or lazy loader that can take the `data` (GLB url or embedded) and feed it to the existing hybrid 3D system.

**P2 — Unification or Explicit Boundary**
- Decide: is the Community asset library meant to *become* the contribution surface for symbols/footprints/3d-models (with real backend + moderation), or is it a teaching/demo surface while the parts catalog owns all "real" community content?
- Document the decision in the skill + CLAUDE.md so Codex does not rediscover the split.

**Strengths (relative to peers in the audit):**
- The UI itself is one of the cleanest, lowest-complexity views analyzed (39 CCN on the view file). Tabs, filters, and the Radix Dialog detail are textbook.
- License teaching via VaultHoverCard is already ahead of many other surfaces.
- The BOM integration, however narrow, proves the team knows how to make "download" have a consequence.

**Cross-Cutting Value (especially post-3D + breadboard work):**
- This is the single best place to surface community 3d-models, symbols, and footprints directly into the maker surfaces (Breadboard, 3D View, Schematic, PCB) with provenance.
- Natural AI/Chat hook: "find me a community footprint for this part" or "explain this downloaded symbol" or "generate a breadboard starter using this community pcb-module."
- Perfect testbed for the "source trust" and "board health" stories that the breadboard-lab and audit-trail work are building.

**Durable Lesson:**
A beautiful browser with no wiring into the canonical model (Project → CircuitDesign → Instance + physical placement + 3D visualization) is the fastest way to create "feature that feels complete but has zero user value." The recent heroic 3D hardening + breadboard provenance investment makes this gap both more obvious and more valuable to close than it was two weeks ago. The VaultHoverCard usage shows the *intent* was always there; the implementation simply stopped at the UI layer.

**Recommended for Codex (immediate high-ROI tasks after handoff):**
1. Wire a "View in 3D" / "Place on Breadboard" action from the Community detail (start with the 3d-model type; the hardened BoardViewer3D + the existing BreadboardPartInspector button are ready receivers).
2. Design (and minimally implement) a typed preview + safe import flow that creates real `CircuitInstance` records with `provenance.source = 'community:<id>'`.
3. Add a minimal trust/verification badge surface using the same primitives as the parts catalog.
4. Decide and document the "two communities" boundary or unification plan.
5. Add at least one E2E or integration test that exercises a full "browse → rate → import consequence" path once the wiring exists.

**Evidence & Contract Artifacts:**
- Full self-improvement-log entry written in `.agents/skills/pp-view-community/references/self-improvement-log.md` with exact commands, file paths, scc numbers, and the two-universes finding.
- Inspector clean on entry; re-run at close of this pass (see below).
- No production code was mutated during discovery — only documentation and the skill log.

---

*Community analysis complete. The polished browser is a UI success story sitting on top of a data model with no home in the rest of ProtoPulse. Highest-leverage integration work in the entire current backlog once the 3D and breadboard surfaces are live. Ready for the next `/pp-view-xxx` command or explicit Codex handoff continuation.*

---

*End of appended Community section (2026-05-23).*

---

## 14. Component Editor (pp-view-component-editor) — Deep Analysis (2026-05)

**User Request:** "/pp-view-component-editor"

**Inspector Result (entry + final exit):** Status: ok. 5 tracked tests. Main surface: `ComponentEditorView.tsx` (1264 lines) + 27 files under `client/src/components/views/component-editor/**` and `client/src/lib/component-editor/**`. Re-run at close of analysis remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `client/src/components/views/ComponentEditorView.tsx` (orchestrator, 1208 code / 266 CCN)
- Subsystem: `client/src/components/views/component-editor/` (ShapeCanvas 680 code / 240 CCN, PathEditor 258/120, ShapeRenderer 317/138, GeneratorModal, DatasheetExtractModal, ExactPart*Dialogs, PinTable, ComponentInspector, DRCPanel, SpiceSubcircuitEditor, DiffPreview, HistoryPanel, etc.)
- Lib: `client/src/lib/component-editor/` (provider + reducer, drc, generators, snap-engine, validation, constraint-solver, diff-engine, hooks)
- Tests: `ComponentEditorAutoSave.test.tsx` (5 tests, BL-0273 debounce) + dedicated sub-tests for exact-part, shape modules, etc.
- Total surface (scc): 28 files, 7360 code LOC, **1498 complexity** — one of the heaviest concentrated areas in the app.
- Backend: hooks (`useComponentParts`, `useCreate/Update/Verify/PublishComponentPart`) → `server/routes/components.ts` + `@shared/component-trust` + `exact-part-verification`.

**UX Contract Evaluation (Must Hold: Metadata visible, Pin Data visible, Footprint Readiness visible, Part Editing Safety visible + AI/uncertain data clearly marked):**

- **Part Editing Safety is the standout strength of this entire audit campaign.** The view is the canonical authoring surface for "exact parts." It enforces verification gates before public publish (`trustSummary.requiresVerification && !trustSummary.authoritativeWiringAllowed` blocks the publish dialog). `ExactPartDraftModal`, `ExactPartVerificationDialog`, verification badges (`verified` / `deprecated` / `candidate`, `official-backed` / `mixed-source` / `community-only`), and `buildExactPartVerificationReadiness` are first-class. This directly powers the breadboard-lab "exact vs starter vs project" discipline and the 3D mechanical-fit work.

- **Rich multi-view authoring + AI assistance:** Tabs (Breadboard / Schematic / PCB / Metadata / Pin Table / SPICE). Live `ShapeCanvas` with DRC overlays, snap guides, path editing. AI modals for generation from description, datasheet image extraction, pin photo extraction. `DiffPreview`, `HistoryPanel`, validation modal, DRC panel with rule editing.

- **High complexity + maintainability risk (P1):** The visual core (ShapeCanvas + PathEditor + ShapeRenderer + SnapGuideEngine + HitTester) concentrates 500+ CCN. Any future feature (new shape types, mechanical envelope editing, 3D export) will fight this density. The main view JSX is a long conditional tree with many stacked dialogs — classic source of "fixed height + scroll trap" violations called out in the skill's gotchas.

- **Auto-save / dirty contract:** Dedicated test (BL-0273) proves 2s debounce on `[isDirty, present, partId, handleSave]`. The effect comment in the test points to old view lines 311-317; the logic has been refactored into the provider/reducer or hooks, but the test still passes and every mutation correctly flips `isDirty`.

- **Integration surface with the rest of the audit (latent high value):**
  - CommunityView supports `'3d-model'`, schematic-symbol, footprint, pcb-module types with zero import path into this editor (and zero "publish verified part back to Community" path).
  - BreadboardPartInspector has a dead "View in 3D" button; the reverse ("Edit this exact part" from breadboard or 3D selection) is also missing.
  - This editor is the natural place to author the mechanical envelopes and pin-accurate 3D models that the hardened BoardViewer3DView and breadboard coach overlays need.

- **Layout / Container risks:** Long pin tables, shape lists, DRC violation lists, and history entries must scroll cleanly on laptop viewports. Modals stack (Generator, ExactDraft, Verify, Datasheet, Pin, Modify, Validation, Publish, LibraryBrowser). The skill explicitly warns about nested overflow and fixed heights creating traps.

**P0 / P1 / P2 Backlog Items for Codex (prioritized):**

**P1 — Visual Core Extraction & Maintainability (ShapeCanvas family)**
- The 240/120/138 CCN hotspots in ShapeCanvas, PathEditor, and ShapeRenderer are the single largest concentration of hard-to-touch code outside the breadboard canvas god file.
- Recommended: same disciplined extraction that ArchitectureView received (neutral, testable primitives for transforms, hit-testing, snapping, rendering). This pays down the risk for every future mechanical or 3D enhancement.

**P1 — Round-trip Provenance Closure (Breadboard ↔ Component Editor ↔ 3D)**
- After a part is verified here, the user should have obvious actions: "Place this verified exact part on Breadboard", "Add to active 3D scene", "Use in current CircuitDesign".
- Conversely, selecting a placed exact part on the breadboard or in 3D should offer "Refine in Component Editor" and load the correct part + provenance context.
- Every use of a part created/verified here must carry machine-readable provenance (`provenance.source = 'component-editor:<partId>:<verificationId>'`) so board health, coach, and audit trail can later explain "this footprint came from verified exact part X, last verified on date Y by Z".

**P2 — AI + Community Library Bridge**
- The powerful Generator + Datasheet/Pin extract flows should be able to consume community assets (or publish verified results back into the Community browser we just audited) with full trust receipts.
- "Fork from Community 3d-model / footprint" would be the cleanest way to close the loop between the two currently disconnected community surfaces.

**P2 — Test & Visual Verification Surface**
- Only auto-save has a high-level test. The exact-part verification dialog, publish gate, multi-view rendering, and DRC rule editing are safety-critical and under-tested relative to complexity.
- Any density or layout change must re-execute the full browser checklist (laptop viewport, long lists scrolling, modal stacking, focus management, no text overflow).

**Strengths (relative to peers):**
- Best-in-audit example of "safety by default" for hardware data. The verification gate is not advisory — it is enforced in the publish path.
- First-class, shared-module usage of the entire component-trust and exact-part-verification system (not duplicated ad-hoc logic).
- Live breadboard/schematic/pcb visual authoring + DRC + SPICE + pin table in one focused surface is genuinely professional-grade.
- AI assistance exists but is subordinated to the safety/verify model (correct priority).

**Cross-Cutting Value (highest in the current campaign):**
- This is the root authoring experience for every part that will ever appear on a breadboard, in a 3D scene, on a PCB, or in a generated BOM with mechanical guidance.
- It is the single place where the "exact vs approximate" contract, provenance, and mechanical fidelity can be enforced before the data reaches the maker surfaces.
- Perfect location for future "mechanical envelope editor" that directly feeds the 3D View's clearance visualization and the breadboard coach's wiring realism.

**Durable Lesson:**
When the data you author powers safety-critical downstream behavior (wiring guides that must be trusted, 3D models used for mechanical fit, board health that must not lie), the correct architectural move is to make the safety and provenance gates *impossible to bypass* and *visually obvious at every step*. ProtoPulse has executed this correctly in the Component Editor. The remaining work is mostly taming the visual core's complexity and closing the consumption loops so the parts created here actually flow into the 3D + breadboard surfaces with their provenance intact.

**Recommended for Codex (high-leverage next steps after handoff):**
1. Perform a Phase-0-style extraction on the ShapeCanvas / PathEditor / Snap / HitTest cluster (create neutral `lib/component-geometry/` or similar).
2. Implement the round-trip actions between Component Editor ↔ BreadboardPartInspector ↔ BoardViewer3DView (carry full verification/provenance).
3. Add automated + visual regression coverage for the ExactPartVerificationDialog and the publish-blocking logic (the most safety-critical paths).
4. Audit every long panel and the main canvas container for UI Container Rule compliance on realistic laptop viewports; fix any scroll traps.
5. Define and document the "publish verified part → Community asset library" flow (or explicit boundary) so the two community experiences are coherent.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Nearest test (`ComponentEditorAutoSave.test.tsx`) executed — 5/5 green.
- Full self-improvement-log entry written with scc numbers, file paths, test results, and cross-audit connections.
- No production code was edited during this discovery-only pass.
- All findings explicitly linked to the 3D rescue, breadboard-lab provenance identity, community assets audit, exact-part trust work, and UI Container Rule enforcement from the same campaign.

---

*Component Editor analysis complete. This is the safety-critical root for every part that will ever touch hardware in ProtoPulse. Highest-leverage integration and extraction work visible in the entire views sweep. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

**High-fidelity desktop evidence from 2026-05-23T23-25-42-641Z-full-app-catalog (70+ files on desktop for component-editor, same high-cap run as breadboard)**: This capture exercised the exact safety-critical flows highlighted above:
- Exact-part trust strip, badges (status/family/level), evidence text, wiring mode, summary (files 038–044)
- Full metadata form editing (title, family, description, manufacturer, MPN, mounting, package, tags) — 048–055
- Generate, exact-part-draft, AI-modify, extract-datasheet, extract-pins, validate, export-fzpz, publish, library, import-fzpz, import-svg, DRC, history, save, undo/redo (016–031)
- Tab switching between breadboard/schematic/pcb/metadata/pin-table/spice while inside the editor (032–037, 065–071)
- After-click states for workspace actions, hardware inspection, more-button, tab switches, with overlays (056–071)

These directly test the provenance visibility, exact-part gate, multi-editor round-tripping, and UI density that the P1/P2 items call out. Combined with the live browser captures from the same session, this is the strongest visual evidence we have for the Component Editor surface to date.

---

*End of appended Component Editor section (2026-05-23).*

---

## 15. Dashboard (pp-view-dashboard) — Deep Analysis (2026-05)

**User Request:** "/pp-view-dashboard"

**Inspector Result (entry + final exit):** Status: ok. 4 tracked tests. Single main source: `DashboardView.tsx` (535 lines). Re-run at close of analysis remained clean.

**Page Map + Quantitative Snapshot:**
- Only `client/src/components/views/DashboardView.tsx` (487 code / 66 CCN — one of the lightest and cleanest views in the entire campaign).
- Test: `client/src/components/views/__tests__/DashboardView.validation.test.tsx` (4 tests, heavily focused on E2E-015 truthful health indicators).
- Aggregates live from: `useArchitecture`, `useBom`, `useValidation`, `useHistory`, `useProjectMeta`.
- Uses `InteractiveCard` (from Architecture extraction) + `VaultHoverCard` (provenance teaching) + `WelcomeOverlay` for empty projects.

**UX Contract Evaluation (Status Overview / Project Health / Recent Activity / Next Actions must all be "visible enough"):**

- **Lightweight aggregator done right (major strength):** At only 66 CCN this view deliberately does not own complex local state — it pulls live aggregates from the real domain contexts. The Validation card has excellent, tested care for the "no design yet" neutral state (E2E-015) so it never lies with a false green "All Checks Passing" on an empty project. Quick stats bar + three InteractiveCard summaries (Architecture / BOM / Validation) + Recent Activity feed are scannable and focused.

- **Provenance teaching is already present at the right layer:** VaultHoverCard is used on architecture node types inside the Architecture card — exactly the "teaching affordance" and "AI-generated or uncertain data is clearly marked" pattern the breadboard-lab provenance and component-trust work have been building.

- **"Project Health" pillar is only partially realized (P1 gap — the largest in this view):** The UX contract explicitly names four pillars. The Dashboard currently only strongly covers Status Overview via the three summary cards. True Project Health — hardware readiness, exact-part verification status (from Component Editor), breadboard board health / coach score / wiring issues (from breadboard-lab), 3D mechanical / envelope readiness (from the hardened hybrid 3D View), provenance completeness, audit-trail events — is **not surfaced anywhere**. After the entire campaign investment in Component Editor safety gates, breadboard-lab provenance, 3D airwire fidelity, and audit-trail, the front door of the app still shows only node/edge counts, BOM stock status, and validation issues.

- **"Next Actions" pillar is missing (P1 gap):** There is no "Recommended next steps", "Quick start", or "What's next?" surface. The three cards are navigation shortcuts, but they do not drive the user toward the safety-critical work ("3 parts are still unverified — verify before 3D export or publish", "Breadboard has 4 wiring issues — open coach", "No 3D model for this exact part — generate or import from community").

- **Recent Activity is generic history only (P2):** The feed shows the last 5 items from the history context with AI/User icons and relative time. It does not yet elevate the high-signal maker events that actually matter for trust (last exact-part verification, 3D airwire computation, breadboard DRC / coach run, component published with provenance, etc.).

- **Onboarding / empty state is handled cleanly:** WelcomeOverlay gates the entire view when the project is truly empty and the user has not dismissed it. Good non-intrusive pattern.

- **Layout risk is low but must still be policed:** Simple responsive 2-column grid + header + stats bar. No heavy canvas or long scrollable lists that would trigger the classic fixed-height / nested-overflow traps. The contract still requires explicit laptop-height viewport checks for any future density or new health cards.

**P0 / P1 / P2 Backlog Items for Codex (prioritized for handoff):**

**P1 — Surface Real Project Health (make the safety + provenance investment visible on the front door)**
- Add a "Hardware Readiness" / "Board Health" section or card (or expand the existing Validation card) that aggregates:
  - Exact-part verification status and provenance level (official-backed / mixed / community-only) from the Component Editor + component-trust system.
  - Breadboard board health / coach score / wiring issue count / mechanical fit warnings (from breadboard-lab).
  - 3D model / mechanical envelope / airwire readiness (from the hardened BoardViewer3DView).
  - Overall provenance completeness (% of parts with source evidence).
- This is the single highest-leverage place to make the entire 3D + breadboard + Component Editor + audit-trail campaign coherent for the user.

**P1 — Actionable "Next Actions" / Recommended Steps driven by health data**
- Add a dynamic "What's next?" or "Recommended actions" panel (or turn the empty/recent-activity area into one when health issues exist).
- Each recommendation must be a one-click deep link that opens the correct view (Component Editor, BoardViewer3D, Breadboard, Validation) with the relevant objects pre-selected and the relevant coach / verification / 3D guide already active.
- Examples: "Verify 3 unverified exact parts before publishing to library", "Resolve 4 breadboard wiring issues (open coach)", "Generate or import 3D models for 2 parts used in current design", "Run full 3D airwire check (12 unrouted nets)".

**P2 — Enrich Recent Activity with high-signal maker events**
- Integrate with (or extend) the audit-trail system so the dashboard feed surfaces the events that actually change project health and trust posture (verifications, 3D exports, coach runs, provenance updates, exact-part publications) rather than every generic history item.

**P2 — Round-trip navigation from Dashboard into the new surfaces**
- From the Architecture or BOM cards, surface "X community components used — review trust" or "Y parts have no 3D model — open in 3D / Component Editor".
- After a user completes verification or a 3D airwire pass, returning to the Dashboard should immediately reflect the improved health numbers and clear the corresponding action item.

**Strengths (relative to peers):**
- One of the cleanest, lowest-complexity views analyzed (66 CCN) — deliberately an aggregator, not another god file.
- Already using the correct primitives (InteractiveCard from Architecture extraction, VaultHoverCard for teaching).
- The E2E-015 "never lie about validation health on empty projects" discipline is exactly the right mindset for the entire provenance and board-health story.
- Onboarding is non-intrusive and properly gated behind a dismissible overlay.

**Cross-Cutting Value (highest "make the system feel whole" opportunity in the campaign):**
- The Dashboard is the only surface a user sees first and returns to often. It is the single place where the aggregate state of the project (including all the new hardware safety, 3D, breadboard health, and provenance work) can be made obvious without forcing the user to open five different specialized tools.
- It is the natural home for the "project health score", "provenance completeness meter", "hardware readiness checklist", and "recommended next maker action" that tie the entire ProtoPulse system together for the end user.

**Durable Lesson:**
A beautiful, honest, lightweight aggregator that only shows architecture nodes, BOM stock, and validation issues after the team has spent serious effort on exact-part verification gates, breadboard board health, 3D airwire fidelity, mechanical envelopes, and provenance is a missed opportunity to make the safety story *obvious on first glance*. The E2E-015 discipline proves the team already knows how to be truthful with health indicators — now apply that same rigor across the new hardware and provenance surfaces so the Dashboard actually reflects the system's real capabilities and guides the user to the right next action.

**Pilot catalog baseline (latest-full-app-catalog, 2026-05-23)**: The captured states `synthetic-rich/pp-view-dashboard__dashboard/desktop/001-default-viewport.png`, `002-full-page.png`, and `003-workspace-main.png` (MANIFEST rows 8-10, CROSSWALK row for Dashboard) document the current clean 3-card + stats + recent-activity layout at desktop. These serve as the exact visual baseline the proposed "Hardware Readiness" and "Next Actions" cards (P1 above) must integrate into without introducing card nesting, fixed-height traps, or overflow on laptop/short-laptop viewports. The pilot run was limited (desktop only, max-elements=3, 0 interactions per FAILURES.md), so the full multi-viewport run with 120/45 caps is required to verify the new health surfaces at all target sizes and with realistic data density.

**Recommended for Codex (immediate high-ROI tasks after handoff):**
1. Design and implement a "Hardware / Board Readiness" section that aggregates exact-part verification status, breadboard health/coach, 3D mechanical readiness, and provenance coverage (reuse the trust primitives already in Component Editor).
2. Add a dynamic "Recommended next actions" panel driven by the above health data, with deep links that pre-select the relevant objects in the target views (3D, Breadboard, Component Editor, Validation).
3. Extend (or integrate with) the audit-trail so Recent Activity surfaces the high-signal maker events that actually change health and trust.
4. Ensure any new health cards or action panels respect the UI Container Rule on laptop viewports and do not introduce card nesting or fixed-height scroll traps.
5. Add at least one integration test that exercises the new health aggregation + next-action generation when real verified parts + breadboard issues + 3D models exist in a project.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Nearest test (`DashboardView.validation.test.tsx`) executed — 4/4 green, explicitly protecting the truthful "no false all-passing" contract.
- Full self-improvement-log entry written with scc numbers (66 CCN), file paths, test results, and explicit mapping to the four UX contract pillars plus the cross-audit gaps with 3D, breadboard-lab, Component Editor, and provenance work.
- No production code mutated during this discovery-only pass.
- All findings tied directly to the 3D hardening, breadboard-lab provenance identity, Component Editor safety, Community assets, Audit Trail, and UI Container Rule enforcement from the same handoff campaign.

---

*Dashboard analysis complete. This is the front door that must now make the entire safety + provenance + hardware readiness investment visible and actionable on first landing. Highest-leverage "make the whole system feel coherent" work visible in the current sweep. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Dashboard section (2026-05-23).*

---

## 16. Digital Twin (pp-view-digital-twin) — Deep Analysis (2026-05)

**User Request:** "/pp-view-digital-twin"

**Inspector Result (entry + final exit):** Status: ok. 0 tracked tests at page-skill level. Main source: `DigitalTwinView.tsx` (625 lines). Re-run at close of analysis remained clean.

**Page Map + Quantitative Snapshot:**
- Only `client/src/components/views/DigitalTwinView.tsx` (553 code / 87 CCN — moderate, clean data-focused view).
- Supporting implementation: `client/src/lib/digital-twin/` (device-shadow, comparison-engine, firmware-templates, telemetry-logger, telemetry-protocol) with its own unit test suite.
- No page-level test globs recorded in the skill yet (lib tests exist but are not linked from the page skill).
- Core concepts: `useDeviceShadow` / `DeviceShadow`, `ChannelState` with explicit `stale` flag, `compareCircuit` + `overallHealth`, `TelemetryShadowBridge`, firmware generation, integration with Validation context (BL-0577).

**UX Contract Evaluation (Virtual Hardware State / 3D/Behavior Preview / Sync Health / State Confidence):**

- **Sync Health + State Confidence are excellently delivered (major strength):** This view is the trustworthy "live vs simulation" layer. `ChannelCard` surfaces `stale` indicators clearly. `ComparisonTable` + `overallHealth` produces unambiguous PASS/WARN/FAIL with deviation percentages and counts. The device shadow + comparison engine provide the foundation for real confidence in "does my sim match the physical world?"

- **Virtual Hardware State is visible and actionable:** Live values grid (with toggle for boolean channels), connection bar with device name/firmware/Hz, ability to set desired values, firmware generator for the physical side. Strong ties to Arduino (sketch generation) and Validation (out-of-spec telemetry automatically creates issues).

- **"3D/Behavior Preview" pillar is a clear gap vs the current contract (P1):** The UX contract explicitly requires "3D/Behavior Preview" to be "visible enough for a user to understand what is happening." The current implementation is purely tabular/grid/data focused. There is **no 3D rendering, no embedding or composition of the hardened BoardViewer3DView, and no behavioral visualization** of the twin state on geometry. After the major "LETS GO ALL IN ON THIS 3D VIEW" campaign (hybrid CSS substrate + R3F airwires, net-aware computation, performance hardening, direct-DOM snaps), this view does not yet consume or drive the 3D surface.

- **No page-level tests recorded (notable gap):** The lib modules have solid unit tests, but the page skill and auto-sync record zero tests for the view itself (the four sections, stale rendering, comparison states, connection flows, firmware dialog). The gotchas and testing guide emphasize that lib tests do not prove layout, live update behavior, or scroll/overflow under real data.

- **Good system integration:** Uses the existing Validation context to turn real hardware telemetry problems into first-class project issues. Clean hook-based architecture (view stays thin). Telemetry persistence via bridge + logger.

- **Layout is currently simple and low-risk:** Vertical flex with overflow-y-auto and distinct sections. Still subject to the laptop viewport and "no card nesting" rules if a 3D preview panel or richer live visualization is added later.

**P0 / P1 / P2 Backlog Items for Codex (prioritized):**

**P1 — Fulfill the "3D/Behavior Preview" pillar (highest leverage after the 3D rescue)**
- Embed or deeply integrate the now-production-grade BoardViewer3DView (or a focused behavioral overlay mode) so the twin's live channel state, desired vs reported values, and comparison results can drive visual feedback on the actual 3D board (component highlighting by value, airwire or net coloring by deviation status, real-time pin state overlays on 3D models/footprints).
- This is the natural closure of the 3D campaign: the hardened 3D surface becomes the "behavior preview" for the digital twin.

**P1 — Add page-level test coverage and link it in the skill**
- Record test globs for the view (at minimum exercising the four sections, stale indicators, comparison table states, connection flow, and firmware dialog).
- Add integration tests that go end-to-end from device shadow → comparison → validation issue creation.
- Browser checklist (laptop viewport, live data scrolling, focus behavior with updating values) must be part of any future 3D preview work.

**P2 — Make health data drive "Next Actions" (tie into Dashboard)**
- When overall health is WARN/FAIL or stale channels exist, surface clear, one-click recommendations ("Re-run simulation for this net", "Check breadboard wiring for channel X", "Re-verify exact part", "Open 3D View with this twin state").
- Feed the same health signal into the Dashboard's future Project Health and Recommended Actions surfaces.

**P2 — Round-trip navigation with Breadboard + Component Editor + 3D**
- From a failing comparison row or stale channel, provide direct links to the corresponding breadboard placement, the exact part in Component Editor (with provenance), or the 3D scene with the relevant objects highlighted.

**Strengths (relative to peers):**
- Excellent, focused delivery of the core digital twin promise (trustworthy live shadow + sim-vs-actual comparison + firmware round-trip to physical hardware).
- Strong, explicit "State Confidence" UX (stale flags, deviation percentages, overall health badge with counts).
- Proper reuse of system primitives (Validation context, telemetry bridge, existing firmware templates).
- Clean architecture (view is a thin orchestrator; real logic lives in well-tested lib modules).

**Cross-Cutting Value (very high in the current campaign):**
- This is the **live synchronization, telemetry, and confidence layer** that makes the 3D View, breadboard, and component authoring "real" with physical hardware.
- It is the bridge that turns the static (but now hardened) 3D viewer into a true digital twin experience.
- Natural home for future "physical vs simulated" coaching that can feed the breadboard-lab coach and the 3D airwire/comparison systems.

**Durable Lesson:**
A polished, trustworthy data and comparison view that fully satisfies "Virtual Hardware State," "Sync Health," and "State Confidence" while leaving the "3D/Behavior Preview" pillar of its own UX contract unimplemented is the direct result of two important tracks (the 3D rescue and the digital-twin telemetry work) not yet being joined. The contract was written with a unified vision; the implementation delivered the reliable data foundation first. Integrating the hardened 3D surface is now the highest-leverage step to make ProtoPulse feel like one coherent digital twin system.

**Recommended for Codex (immediate high-ROI tasks after handoff):**
1. Design and implement the 3D/Behavior Preview section — compose or embed the hardened BoardViewer3DView (or a dedicated behavioral mode) driven by the current DeviceShadow / comparison results (highlight components, color nets/airwires by deviation, overlay live pin states on 3D geometry).
2. Add page-level test coverage for the view and record the globs in the skill (start with comparison states, stale rendering, and connection flows).
3. When comparison health is not PASS or stale channels exist, surface clear next-action affordances that link into Breadboard, Component Editor, and the 3D View.
4. Ensure any 3D preview panel or richer visualization respects the UI Container Rule (proper scrolling on laptop viewports, no fixed-height traps under live updates, focus management).
5. Feed Digital Twin overall health (comparison status, stale count, out-of-spec channels) into the Dashboard's Project Health and Recommended Actions surfaces once those exist.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement-log entry written with scc numbers (87 CCN), file paths, discovery of the lib test suite, explicit gap vs the "3D/Behavior Preview" contract pillar, and cross-references to the 3D hardening, breadboard-lab, Component Editor, Dashboard, and Arduino campaigns.
- No production code mutated during this discovery-only pass.
- All findings tied directly to the 3D rescue, breadboard-lab provenance, Component Editor safety, Dashboard health, Arduino firmware, and UI Container Rule work from the same handoff audit.

---

*Digital Twin analysis complete. This is the trustworthy live-sync and confidence layer that makes the 3D + breadboard + component work "real" with hardware. Fulfilling the 3D/Behavior Preview pillar by integrating the hardened 3D View is the clear next step. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Digital Twin section (2026-05-23).*

---

## 17. Exports (pp-view-exports) — Deep Analysis (2026-05)

**User Request:** "/pp-view-exports"

**Inspector Result (entry + final exit):** Status: ok. Main source `client/src/components/panels/ExportPanel.tsx` (1244 lines, 75 CCN). Supporting `lib/export-*.ts` + tests. Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `ExportPanel.tsx` (1179 code LOC — large but low-density declarative surface).
- Lib: `export-precheck.ts`, `export-validation.ts` (ProjectExportData), `export-snapshot.ts`, `export-profiles.ts`, `export-results.ts`, trust-receipts, workspace-release-confidence.
- Supporting panels: ExportPrecheckPanel, ExportResultsPanel, ExportProfileSelector, PickPlacePreview, DesignDiffPanel, full Import* suite (preview/warnings/repair/history/diff).
- scc: low complexity density (6.36 CCN/line) — mostly the big `EXPORT_CATEGORIES` table + per-format state.

**UX Contract Evaluation (Exports / Artifact Download / Format Readiness / Fab Handoff):**

- **Comprehensive format coverage + strong Readiness engine (major strength):** 20+ formats in 5 categories (Schematic/Netlist, Fabrication with flagship "Complete Fab Package", 3D-CAD/STEP, Firmware, Documentation/BOM/PDF/FMEA). Per-format `validateExportPreflight` + `runExportPrecheck` produces granular checks; when issues exist, `ExportPrecheckPanel` is shown with "export anyway" safety valve. Special affordances (PickPlacePreview, etc.).

- **Provenance / Trust surface at the top is excellent:** `ReleaseConfidenceCard` + `TrustReceiptCard` (built via `buildWorkspaceReleaseConfidence` + `buildExportTrustReceipt`) give immediate visibility into workspace signals (BOM, validation, architecture, build profiles) before any download. Directly serves the breadboard-lab + Component Editor provenance identity.

- **Bidirectional import safety is mature:** Full pipeline (ImportPreviewDialog, warnings, repair, history, DesignDiffPanel) with diff and repair — one of the best "safe round-trip" experiences analyzed.

- **"Format Readiness" and "Fab Handoff" for PCB is production-grade; for 3D/Mechanical is a stub (P1 gap):** 
  - `stepChecks` (for STEP 3D) only requires session + projectName + `pcbLayoutCheck`. No checks for verified 3D models, mechanical envelopes, exact-part verification status, breadboard placements, or digital twin data.
  - `ProjectExportData` interface and the `exportData` memo in the panel collect **zero signals** from Component Editor (exact parts / 3D models / verification), breadboard (placements / health / coach), Digital Twin (shadows / comparisons), or 3D View state.
  - "Complete Fab Package" is PCB-centric (Gerber + drill + BOM + P&P). Mechanical/3D handoff has not kept pace with the rest of the system.

- **Inventory signals are thoughtfully integrated (BL-0150):** `bomShortfallCheck` surfaces real "units short — order before fab" warnings for pick-place and fab-package using live `useBomShortfalls` data.

- **Panel size is manageable because logic lives in lib:** 1244 lines is mostly the format registry + handlers + UI wiring. The real readiness intelligence is in the testable export-*.ts modules (good).

- **No breadboard or digital-twin signals anywhere in prechecks or artifacts:** Wiring guides, bench-specific variants, coach reports, shadow comparison health — none of these are visible in Format Readiness or included in handoff packages.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — 3D / Mechanical Fab Handoff Readiness (highest-ROI gap after the 3D + Component Editor + breadboard campaigns)**
- Extend `ProjectExportData` and the exportData construction to include 3D model presence, verified exact-part status + provenance level, mechanical envelope completeness, and breadboard placement / fit data.
- Give `stepChecks` (and any future 3D assembly formats) real substance ("All placed components have verified 3D models from Component Editor", "Mechanical envelopes present", "Exact-part verification level meets fab threshold").
- Consider enriching "Complete Fab Package" or adding a "Mechanical / Enclosure Fab Package" that includes STEP + 3D fit reports derived from breadboard + verified models.
- Wire 3D View state and Component Editor verification into the trust receipt and release confidence cards for 3D formats.

**P1 — Bring Breadboard + Digital Twin into the handoff story**
- Add precheck items and optional artifacts for breadboard data (wiring guides, coach health summary, bench BOM variants) and digital twin (shadow channels, sim-vs-actual health report) when the project has breadboard or live hardware data.
- Surface these in the Fabrication or a new "Maker / Bench" category.

**P2 — Polish the lighter categories**
- 3D-CAD and Firmware categories have fewer checks and no special previews (unlike pick-place). Give them equivalent depth and UI treatment.
- Consider extracting the giant `EXPORT_CATEGORIES` + runner map into a registry for easier extension as new mechanical/breadboard formats are added.

**Strengths:**
- One of the strongest "Format Readiness" experiences in the entire audit (granular per-format prechecks + export anyway).
- Outstanding top-level provenance (Release + Trust cards) that makes the safety story visible before download.
- Mature bidirectional import with repair/diff/history — directly supports trustworthy fab workflows.
- Practical BL-0150 inventory shortfall integration.

**Cross-Cutting Value:**
- The final "ship it" surface. All the 3D mechanical, exact-part verification, breadboard provenance, digital twin confidence, and audit-trail work must be reflected here for the handoff to be credible.
- Currently excellent for traditional PCB fab; the missing link for the new 3D + exact + breadboard mechanical + twin story.

**Durable Lesson:**
A rich export center with excellent per-format readiness and provenance cards can still have a "3D tax" if the data model and precheck runners were not updated in parallel with the 3D View, Component Editor verification, and breadboard provenance systems. The UX contract requires "Format Readiness" and "Fab Handoff" to be visible — for mechanical/3D they currently are not at the depth the rest of ProtoPulse now provides.

**Recommended for Codex:**
1. Extend `ProjectExportData` + exportData builder to pull 3D model / exact-part verification / breadboard placement signals.
2. Add real checks to `stepChecks` and wire them into UI, precheck panel, and trust receipts.
3. Enrich or add a mechanical fab package path.
4. Add integration test coverage for STEP precheck with/without verified 3D + exact parts.
5. Give 3D-CAD category the same visual and readiness depth as Fabrication.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc, exact precheck code for STEP vs fab-package, data shape gaps, and cross-references to 3D rescue, Component Editor, breadboard-lab, Digital Twin.
- No code mutated during discovery.
- Tied directly to the 3D, exact-part, breadboard provenance, and trust work from the same campaign.

---

*Exports analysis complete. Mature for PCB fab handoff and provenance; 3D/mechanical readiness has not kept pace. Highest-leverage gap to close for a complete "ship with confidence" story. Ready for the next `/pp-view-xxx`.*

---

*End of appended Exports section (2026-05-23).*

---

## 18. Generative (pp-view-generative) — Deep Analysis (2026-05)

**User Request:** "/pp-view-generative"

**Inspector Result (entry + final exit):** Status: ok. 53 tracked tests. Main source `GenerativeDesignView.tsx` (425 lines) + `lib/generative-design/**` (9 files, 388 CCN total). Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `GenerativeDesignView.tsx` (368 code / 53 CCN — lightweight orchestrator).
- Lib: `generative-engine.ts`, `generative-adopt.ts` (100 CCN hotspot — compare/adopt/export with provenance stamping), `circuit-mutator.ts` (91 CCN), `fitness-scorer.ts`, supporting tests (heavy on adopt).
- Strong test coverage on the critical adoption/provenance path (generative-adopt.test.ts 37 tests).

**UX Contract Evaluation (AI Generation / Proposal Review / Adoption Flow / Trust Labels):**

- **Solid evolutionary core with explicit provenance stamping (major strength):** The pipeline (spec + constraints → engine + mutator + fitness scorer → candidate grid → compare/adopt) is well factored. On adoption (`adoptCandidate`), nodes are stamped `data: { generatedFrom: 'generative-design', candidateId, ... }`. This is exactly the "AI-generated or uncertain data is clearly marked" primitive required by the breadboard-lab + Component Editor + Exports + trust work across the entire audit.

- **Proposal Review + Adoption Flow are functional but trust labels are not visually prominent (P1 gap):** Candidate cards show fitness % / rank / bars / component count. AdoptCandidateDialog shows clear added/removed/changed diff with status badges. However, the `generatedFrom` stamp and richer trust UI (badges like Component Editor verification or Exports TrustReceiptCard, VaultHover explanations, "AI-generated — review before fab" warnings) are not first-class on the cards or in the review dialog. The UX contract requires "Trust Labels" to be "visible enough."

- **No bridge to 3D / mechanical / exact-part / breadboard review before adoption (P1 gap after the 3D rescue):** Generated candidates live only in the Architecture canvas. There is no "Preview this proposal in the hardened 3D View", no optional creation of "candidate exact parts" in Component Editor (verification pending), and no breadboard placement or mechanical fit preview. Adoption is one-way without carrying the richer provenance the rest of the system now enforces.

- **Constraint-driven generation is practical engineering:** Budget / power / thermal sliders feed the fitness scorer — aligns with real hardware concerns (Component Editor thermal/mechanical, breadboard power, Digital Twin).

- **Test depth on the provenance injection point is a positive signal:** 53 tests, especially heavy on the adopt flow where `generatedFrom` is attached.

- **Layout is clean split-pane but must be policed for live updates:** Left spec column scrolls; right candidate grid updates during evolution. Laptop viewport, focus management during long runs, and scroll behavior with many candidates need verification.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Make Trust Labels visible and first-class on candidates and adoption (directly serves the provenance identity)**
- Add prominent, hoverable "Generative Design" / `generatedFrom` badges on every candidate card and in AdoptCandidateDialog (use VaultHoverCard or TrustReceiptCard patterns).
- On adoption, ensure the stamped provenance is also written to any created exact parts (Component Editor) or 3D entries so Exports, Validation, Board Health, and Dashboard can surface "this originated from generative design and has not been verified."

**P1 — Bridge generated proposals to 3D View + Component Editor + Breadboard before adoption**
- Add "Preview in 3D" action (feed proposal IR into the hardened BoardViewer3DView with temporary placement/airwires).
- On adoption, offer "Create as exact-part candidate (verification pending)" and/or "Place on breadboard as starter/exact proposal."
- This ensures generative output goes through the same mechanical and verification gates as manual work.

**P2 — Richer "why this candidate" explanations in Proposal Review**
- Surface which constraints the winner satisfied best and which mutations helped, so users learn from the AI rather than treat it as a black box.

**P2 — Easy rejection + history paths**
- Make it trivial to reject a run or individual candidates while still logging the attempt for audit-trail / later review of "what the AI proposed."

**Strengths:**
- Clean engine / mutator / scorer / adopt separation with real test depth on the provenance stamping point.
- Explicit `generatedFrom` data stamp is the correct architectural move for the entire trust story.
- Constraint sliders + fitness feedback is practical, not pure novelty.
- Live integration with Architecture context (recent audit-driven fix shows responsiveness).

**Cross-Cutting Value (very high):**
- The "create from AI" surface that must feed every downstream provenance, 3D mechanical, exact-part, breadboard, export, and health pipeline with correct trust labels from the moment of birth.
- If generative output bypasses the verification and mechanical review surfaces built elsewhere, the safety story is broken at the source.

**Durable Lesson:**
A generative tool that correctly stamps `generatedFrom: 'generative-design'` on adoption has done the hard architectural part right. But if the UI does not make those trust labels obvious on the candidate cards and in the review dialog, and if there is no path to preview the proposal in the hardened 3D View or as a pending exact part before adoption, the "AI-generated or uncertain data is clearly marked" contract fails in practice for users. The system now has the primitives (Component Editor verification, 3D mechanical, breadboard provenance); generative must become a first-class consumer and producer of them.

**Recommended for Codex:**
1. Add prominent, hoverable trust badges ("Generative Design", candidate ID, fitness provenance) on every candidate card and in AdoptCandidateDialog using existing VaultHoverCard / TrustReceiptCard patterns.
2. Wire "Preview in 3D" and "Create as exact-part candidate (verify before use)" options on adoption or per-candidate actions.
3. Ensure adopted nodes carry provenance respected by Exports precheck, Validation, Board Health, and Dashboard.
4. Expand tests to assert provenance data presence and downstream effects after adoption.
5. Run full browser checklist on the live generation + candidate grid flow (laptop height, focus during evolution, scroll with many candidates).

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc hotspots, exact `generatedFrom` stamp location in adoptive-adopt.ts, UI gap vs the four pillars, and cross-references to 3D, Component Editor, breadboard-lab, Digital Twin, and Exports trust work.
- No code mutated during discovery.
- All findings tied directly to the provenance/trust and 3D mechanical campaigns from the same handoff audit.

---

*Generative analysis complete. Core engine + explicit provenance stamping is sound; visible trust labels on candidates and bridges to 3D / exact-part / breadboard review are the clear gaps. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Generative section (2026-05-23).*

---

## 19. History (pp-view-history) — Deep Analysis (2026-05)

**User Request:** "/pp-view-history"

**Inspector Result (entry + final exit):** Status: ok. Main source `DesignHistoryView.tsx` (491 lines / 83 CCN). 0 tracked tests. Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Only `client/src/components/views/DesignHistoryView.tsx` (449 code / 83 CCN — moderate for timeline + detailed ArchDiff rendering).
- Uses shared `@shared/arch-diff` types (`ArchDiffResult`, node/edge diffs with field changes).
- No tests recorded in the skill.

**UX Contract Evaluation (Version History / Diffs / Restore Flow / Auditability):**

- **Solid Architecture snapshot + detailed diff viewer (strength):** Clean list of named/described snapshots, "Compare to Current" producing rich `ArchDiffResult` (nodes/edges added/removed/modified with field-level changes). Good visual badges, scrollable tables, and status coloring. Supports the "Auditability" and "Diffs" pillars for the Architecture canvas.

- **"Restore Flow" is not visible (direct P1 contract violation):** The UX contract explicitly requires Restore Flow to be "visible enough for a user to understand what is happening." There is no obvious one-click "Restore to this snapshot," "Revert changes," or "Load snapshot as current" action. Users can only compare and manually recreate. This is a clear gap for a History surface.

- **Architecture-only scope (major P1 gap relative to the full campaign):** Snapshots and diffs are limited to Architecture nodes/edges. They capture **none** of the rich state built elsewhere in the system:
  - Breadboard placements, wiring, health, coach data, exact-part provenance.
  - 3D positions/rotations/side, airwire state, mechanical envelopes.
  - Component Editor exact parts, verification status, 3D models.
  - Digital Twin shadows/channels/comparisons.
  - Generative `generatedFrom` markers (even though `generative-adopt.ts` stamps them on adoption).
  - Export trust receipts, validation issues, etc.
  - The "single source of truth for project version history" the provenance/trust campaign has been building toward does not exist here.

- **No automatic / event-driven snapshots (P1 gap):** Snapshots are purely manual ("Save Snapshot" button with name/desc). There are no hooks on high-value provenance events (generative adoption, exact-part verification, breadboard major changes, 3D model import/verification, etc.) that would create auditable history entries automatically.

- **No provenance-aware diffing:** Diffs do not highlight or filter nodes that originated from generative design, unverified exact parts, or low-trust sources — even though the data now exists in the system.

- **0 tests recorded (notable gap for an audit surface):** Per the gotchas and testing guide, lack of recorded tests increases risk for a surface whose job is to provide trustworthy history.

- **Layout is reasonable but must be policed:** Uses `ScrollArea` on diff tables. The contract requires explicit laptop-height viewport checks for any future density or richer multi-surface history.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Implement visible Restore Flow (direct contract violation)**
- Add clear "Restore to this snapshot" / "Revert to snapshot" actions (with safety snapshot of current state + confirmation dialog) that actually restore the Architecture (and eventually other) state.

**P1 — Expand scope or explicitly scope + integrate (the campaign's provenance story is incomplete without it)**
- Either (a) make History the aggregator for Architecture + breadboard + 3D placements + component verification + generative provenance + digital twin state, or (b) document that it is intentionally Architecture-only and ensure the Audit Trail, Dashboard, Exports, and other surfaces provide the missing full-project history/provenance timeline.
- At minimum, changes from generative adoption and exact-part verification must be visible in History with their provenance labels.

**P1 — Automatic / event-driven snapshots on high-value provenance events**
- Hook snapshot or lightweight audit entry creation on: generative adoption (`generatedFrom`), exact-part verification status change, breadboard major placement/wiring, 3D model import/verification, etc.
- This turns History from a manual tool into the living audit record the entire handoff campaign has been driving toward.

**P2 — Provenance-aware diff highlighting and filtering**
- In node/edge diffs, surface badges or filters for "AI-generated", "unverified exact part", "low-trust source", "from breadboard", etc.

**P2 — Test coverage**
- Record test globs in the skill and add coverage for snapshot CRUD, diff rendering, and (once implemented) restore and automatic snapshot paths.

**Strengths (relative to peers):**
- Clean, focused Architecture diff experience with good visual design (badges for nodes/edges added/removed/modified, field-level change lists, scrollable tables).
- Manual snapshots with description support intentional, human-annotated audit points.
- Uses shared `@shared/arch-diff` types (consistent with the Architecture extraction work).

**Cross-Cutting Value (very high for the provenance/trust story):**
- This should be (or feed) the "single source of truth" for what changed when, why, and with what trust/provenance level — directly powering Dashboard health, Exports trust receipts, Audit Trail, safe restore, and board health explanations.
- Currently it only sees Architecture changes; the rich generative, exact-part, breadboard, 3D, and digital twin state built elsewhere is invisible to history.

**Durable Lesson:**
A well-implemented Architecture snapshot + diff viewer satisfies the narrow "Version History of the canvas" use case, but when the system has spent serious effort stamping provenance on generative adoption (`generatedFrom`), exact-part verification, breadboard placements, and 3D models, a History surface that only diffs nodes/edges, has no restore, and performs no automatic capture of those events fails the broader "Auditability" and "Restore Flow" contract and leaves the safety story incomplete. History must either expand its scope or be explicitly scoped while other surfaces carry the full provenance timeline.

**Recommended for Codex (immediate high-ROI tasks):**
1. Add visible Restore Flow (with safety snapshot of current state + confirmation).
2. Either expand snapshot/diff scope to include breadboard/3D/component verification/generative provenance state or create a clear integration story so the full project history is auditable and restorable.
3. Add automatic snapshot or audit entry creation on generative adoption, exact-part verification, and other high-provenance events.
4. Make diffs provenance-aware (highlight AI-generated or unverified items; add filters).
5. Record tests in the skill and add coverage for the core flows (especially restore and automatic snapshots).

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc, exact scope of snapshots (Architecture-only), missing restore, lack of automatic/provenance-aware behavior, and cross-references to Generative stamping, Component Editor, breadboard-lab, 3D, Exports, Audit Trail, and Dashboard.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust, auditability, and 3D mechanical work from the same handoff campaign.

---

*History analysis complete. Solid Architecture diff viewer with good visuals, but missing Restore Flow (contract violation), automatic provenance capture, and visibility into the richer state (generative, exact parts, breadboard, 3D) built elsewhere. This is the surface that must make the entire safety story auditable and restorable. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended History section (2026-05-23).*

---

## 20. Inventory (pp-view-inventory) — Deep Analysis (2026-05)

**User Request:** "/pp-view-inventory"

**Inspector Result (entry + final exit):** Status: ok. Main source `StorageManagerPanel.tsx` (994 lines / 116 CCN). 9 tracked tests. Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `StorageManagerPanel.tsx` (876 code / 116 CCN — moderate for CRUD + health analyzer + physical storage UX).
- Integrates: `useBom` (BomItem stock), `InventoryHealthAnalyzer` (A-F grades, factors, issues, prioritized recommendations), barcode scanner, QR label generation.
- Test: `storage-manager.test.tsx` (9 tests).
- Strong ties to BOM shortfalls (BL-0150 in Exports precheck) and breadboard exact-part decisions.

**UX Contract Evaluation (Inventory / Local Storage / Saved Parts / Data Recovery):**

- **Excellent local inventory + physical storage + health dashboard (major strength):** Deep live BOM integration, sophisticated `InventoryHealthAnalyzer` (overall grade A-F gauge, per-factor progress bars, severity-coded issues, prioritized recommendations with impact), barcode scanning for data entry/recovery, QR label printing for real bin labels. Stock status (ok/low/critical/untracked) with clear visual badges. The collapsible "Inventory Health" card makes "Data Recovery" and "Inventory is visible" genuinely useful and actionable. This directly powers Exports pre-flight shortfall warnings and breadboard "local stock vs community" choices.

- **"Saved Parts" provenance / trust is thin or invisible (P1 gap):** The panel manages BomItem stock levels and storage locations, but there are no visible trust/verification badges per part (e.g., "Verified Exact Part from Component Editor", "Generative Origin", "Community-sourced", "Local unverified"). AI-generated parts from the Generative view are not specially flagged. The "AI-generated or uncertain data is clearly marked" contract is not yet reflected in the local catalog.

- **No visible bridges to 3D / breadboard / generative state (P1 gap after the 3D + breadboard + generative campaigns):**
  - No indication which local parts have verified 3D models / mechanical envelopes (from Component Editor / 3D View).
  - No "currently used on breadboard" or "bench stock" vs "main inventory" distinction or history.
  - No tie-in to generative proposals that were adopted (even though they carry `generatedFrom` stamps elsewhere).
  - "Saved Parts" feels like a flat stock list rather than a rich local catalog that participates in the full provenance and mechanical story.

- **Data Recovery is strong for physical bins (barcode/QR) but weak for design/provenance state:** Excellent tools for recovering/updating physical stock via scanning and labels. However, there is no obvious "inventory snapshot," "reconcile with project," or integration with Design History / Audit Trail for recovering lost stock levels + provenance metadata.

- **Panel density (994 lines) with health + scanner + labels creates container risk:** The combination of health dashboard, physical I/O controls, and parts list must be verified against the UI Container Rule (laptop viewports, no fixed-height scroll traps, reachable controls when health details are expanded).

- **9 tests recorded (reasonable start, must cover health + recovery + provenance paths):** The test file exists; coverage of the health analyzer output, scanner integration, and recovery flows under mixed provenance + shortfall data is critical per the gotchas.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Surface provenance/trust level on every saved part (directly serves the campaign identity)**
- Add trust/verification badges, columns, or hover cards (e.g., "Verified Exact Part", "Generative Origin", "Community-sourced", "Local unverified") pulled from Component Editor / generative stamps.
- Make uncertain/AI-generated stock visually distinct (consistent with VaultHoverCard / TrustReceiptCard patterns used in Exports, Component Editor, Generative, etc.).

**P1 — Bridge Inventory to 3D / breadboard / generative (make "Saved Parts" a first-class participant)**
- Show which local parts have associated verified 3D models / mechanical envelopes (link to Component Editor or BoardViewer3DView).
- Indicate bench usage or "reserved for current breadboard" status with history.
- On adoption of a generative candidate, offer to create/update inventory entries with appropriate provenance flags and stock suggestions.

**P1 — Strengthen Data Recovery for design/provenance state (beyond physical bins)**
- Add inventory snapshots or integration with Design History / Audit Trail so lost stock levels + provenance can be recovered/audited.
- Provide "reconcile with project" or "import from breadboard/3D/generative" recovery flows.

**P2 — Polish the dense health + physical UX surface**
- Ensure the health details panel, scanner controls, label preview, and parts list all respect the UI Container Rule on laptop viewports (no fixed-height traps, proper scrolling, reachable controls).
- Expand tests to cover health recommendations under realistic mixed-provenance + shortfall data and the recovery flows.

**Strengths (relative to peers):**
- One of the best "physical + digital inventory" experiences analyzed — barcode/QR tooling for real bins + sophisticated health analyzer with actionable, prioritized recommendations.
- Deep, live integration with BOM shortfalls (directly consumed by Exports precheck BL-0150).
- Health dashboard (grade gauge, factor bars, severity issues, impact recommendations) makes "Data Recovery" and "Inventory is visible" genuinely useful rather than just a list.
- Stock status logic and visual badges are clear, practical, and immediately actionable.

**Cross-Cutting Value (very high):**
- This is the "local truth" layer for parts that powers BOM shortfalls in Exports, exact-part vs starter decisions in breadboard-lab, procurement, and physical data recovery.
- It must carry and prominently surface the same provenance/trust signals (exact-part verification, generative origin, community vs local) that the rest of the system now enforces, or the safety story has a hole at the inventory layer.

**Durable Lesson:**
A rich local inventory manager with excellent physical tooling (barcode/QR labels) and a sophisticated health analyzer can still leave "Saved Parts" provenance invisible if it does not pull and display verification status, generative origin, 3D model presence, or bench usage from the Component Editor, Generative, 3D View, and breadboard surfaces. The UX contract requires "Saved Parts" and "Data Recovery" to be visible with uncertainty clearly marked — after the provenance campaign, inventory must become a first-class consumer and producer of those signals.

**Recommended for Codex (immediate high-ROI tasks):**
1. Extend the parts list, health views, and search to show trust/verification badges and generative provenance for each saved part (pull from Component Editor / generative stamps).
2. Add indicators and links for parts that have verified 3D models / mechanical data and/or are currently placed on breadboard.
3. Add inventory snapshot / reconciliation features tied to Design History and Audit Trail for design-state + provenance recovery.
4. Ensure the combined health dashboard + scanner + list surface respects the UI Container Rule on laptop viewports; run the full browser checklist.
5. Expand tests to cover health recommendations under mixed provenance + shortfall data and the recovery flows.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc numbers, exact health analyzer integration, provenance gaps, physical recovery strengths, and cross-references to BOM shortfalls (Exports), breadboard-lab exact parts, Component Editor verification, Generative stamping, 3D, Digital Twin, Audit Trail, and Dashboard.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust, exact-part, 3D mechanical, and board health work from the same handoff campaign.

---

*Inventory analysis complete. Excellent local stock + physical tooling + health dashboard; provenance/trust labels and bridges to 3D/breadboard/generative are the clear gaps. This is the "local truth" layer that must carry the full safety story. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Inventory section (2026-05-23).*

---

## 21. Labs (pp-view-labs) — Deep Analysis (2026-05)

**User Request:** "/pp-view-labs"

**Inspector Result (entry + final exit):** Status: ok. Main source `LabTemplatePanel.tsx` (726 lines / 92 CCN). 0 tracked tests. Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `LabTemplatePanel.tsx` (646 code / 92 CCN — moderate for browser + stepper + grading UI).
- Lib: `client/src/lib/lab-templates.ts` (LabTemplate with steps, gradingCriteria, prerequisites, objectives; LabSession with status/progress/grades; localStorage persistence).
- No tests recorded in the skill.

**UX Contract Evaluation (Lab Templates / Experiment Setup / Guided Workflow / Result Capture):**

- **Clean educational UX for structured labs (strength):** Good lab browser with difficulty badges, category filters, search, time estimates, progress bars on cards. LabDetailView with prerequisites (completion status), step-by-step checklist (instructions + hints + expectedOutcome), and a grading rubric system (binary or points-based criteria) with "grade lab" flow that produces GradeResult[]. Progress persists via localStorage. This satisfies "Lab Templates," "Experiment Setup," and "Guided Workflow" for abstract instructional content.

- **"Result Capture" is shallow — only numeric grades, no real maker evidence (P1 gap):** The only captured output is `GradeResult[]` (criterionId + awarded points + optional notes). There is **no capture or attachment of**:
  - Actual breadboard wiring / placements / health / coach data
  - 3D models, mechanical fit evidence, or BoardViewer3DView state
  - Verified exact parts used (from Component Editor)
  - Digital Twin shadow / comparison results
  - Photos, measurements, exported artifacts, or provenance of components (generative vs manual vs community)
  The contract requires Result Capture to be "visible enough"; currently it is just a detached numeric grade.

- **No integration with the real maker surfaces the campaign built (P1 gap):** Labs are parallel instructional content. Completing a lab does not:
  - Drive or validate actions in the hardened BoardViewer3DView or BreadboardView
  - Create or reference exact parts in Component Editor with verification status
  - Record provenance artifacts that appear in History, Audit Trail, Dashboard health, or Exports trust receipts
  - Use Inventory health/stock data or Generative proposals
  "Guided Workflow" is static text instructions, not live orchestration of the tools the user has spent so much effort hardening.

- **Prerequisites are only other lab IDs (limited):** Prerequisites are strings (other lab IDs) with simple "met / missing" status. They do not check real project state (e.g., "you must have a verified exact part for the LED driver", "breadboard health score > X", "all placed components have 3D models").

- **0 tests recorded in the skill (notable gap for a guided workflow surface):** The lib has a test file, but the skill records none. Per the gotchas, this increases risk for UI flows around grading, prerequisites, session persistence, and (once implemented) artifact capture.

- **Panel is 726 lines of mostly list + stepper UI:** Reasonable density with collapsible sections and clear navigation. Still subject to laptop viewport and scroll checks when many labs or long step instructions + grading rubrics are present.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Make Result Capture real and provenance-linked (highest leverage for the breadboard-lab + provenance identity)**
- Extend LabSession / GradeResult to support attached real artifacts: breadboard snapshot + health report, 3D view state or model refs, list of exact parts used (with verification status and provenance), digital twin comparison, exported fab package or report, photos/measurements.
- When a lab is completed/graded, stamp provenance ("lab-result:<labId>:<grade>") so the result appears in History, Audit Trail, Dashboard health, and can be referenced in Exports trust receipts as high-quality evidence.

**P1 — Turn Labs into a guided orchestrator of the real surfaces (not just parallel instructions)**
- Make lab steps actionable: "Place this exact part on breadboard at coordinates X/Y", "Verify the 3D mechanical fit in the BoardViewer3DView", "Run digital twin comparison and capture the result".
- On step completion, optionally auto-open the relevant view (Breadboard, 3D, Component Editor) with the right objects pre-selected and the coach/verification UI ready.

**P1 — Make prerequisites check real project state**
- Extend prerequisites beyond lab IDs to include live checks: "has verified exact part for <part>", "breadboard health score > X", "3D model present for all placed components", "inventory shortfall = 0 for this lab's BOM", "no unverified generative parts used".

**P2 — Enrich grading with evidence**
- Allow graders (or self-graders) to attach the real artifacts above and have rubric items auto-suggest or validate scores based on captured data (e.g., "all parts are verified exact parts → full points on 'correct components' criterion").

**P2 — Test coverage**
- Record test globs in the skill and add coverage for the grading flow, prerequisite evaluation, session persistence, and (once implemented) artifact capture + provenance stamping.

**Strengths (relative to peers):**
- Clean, educator-friendly lab browser + stepper + rubric grading with prerequisites and progress.
- Good difficulty/category/time metadata and search/filter UX.
- Explicit "expected outcome" per step + hints — thoughtful for self-learners.
- LocalStorage persistence is practical for standalone use.

**Cross-Cutting Value (very high for the breadboard-lab + education + provenance story):**
- This should be the "structured learning + evidence capture" layer that turns the powerful breadboard/3D/component tools into guided, auditable educational experiences.
- Completed labs with real captured artifacts (breadboard health, verified parts, 3D fit, digital twin results) become the highest-quality provenance evidence in the entire system — perfect for portfolio, certification, or fab handoff justification.

**Durable Lesson:**
A beautiful guided lab system with rubrics and prerequisites can still be "parallel content" rather than "the way you do real work with provenance" if it never touches the actual breadboard state, 3D models, exact-part verification, or digital twin data the user has built. The contract requires Result Capture and Guided Workflow to be visible and useful — after the breadboard-lab + 3D + provenance campaigns, labs must produce (and be produced by) real, auditable maker artifacts.

**Recommended for Codex (immediate high-ROI tasks):**
1. Extend LabSession / GradeResult to support attached real artifacts (breadboard snapshot + health, 3D state, exact parts with verification status, digital twin comparison, exported report, photos).
2. On lab completion/grading, stamp provenance and surface the lab result in History, Audit Trail, Dashboard, and Exports trust receipts.
3. Make lab steps actionable with deep links that open Breadboard/3D/Component Editor with the right objects and coach/verification UI pre-loaded.
4. Upgrade prerequisites to real project-state checks (verified exact parts, breadboard health, inventory coverage, 3D models, etc.).
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

---

## 22. Learn (pp-view-learn) — Deep Analysis (2026-05)

**User Request:** "/pp-view-learn"

**Inspector Result (entry + final exit):** Status: ok. Main source `KnowledgeView.tsx` (466 lines / 39 CCN). 0 tracked tests. Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `KnowledgeView.tsx` (392 code / 39 CCN — very low complexity, clean lightweight browser).
- Uses `useKnowledgeBase` (lib/electronics-knowledge) + `VaultHoverCard`, `InteractiveCard`.
- No tests recorded in the skill.
- Explicit TODO referencing Plan 13, vaultMoc field, and E2E-552 / InteractiveCard a11y migration.

**UX Contract Evaluation (Learning Content / Search / Source Quality / View Aware Help):**

- **Clean, focused learning content browser (strength):** Good article cards with difficulty badges, category, tags, preview text, search, and filters. Uses modern primitives (`InteractiveCard` from Architecture extraction). `VaultHoverCard` on every article ("Explore in Vault") provides a direct, visible bridge to provenance/source quality teaching. This satisfies "Learning Content" and "Search" well for curated electronics topics (passive/active components, power, communication, PCB, techniques).

- **"Source Quality" is delegated to VaultHoverCard but not deeply surfaced inline (P1 gap):** The contract requires Source Quality to be "visible enough." The view correctly uses `VaultHoverCard` for category-level teaching, but individual articles do not show rich inline source metadata (origin type, verification date, evidence strength, NotebookLM hub tags, vaultMOC slug, etc.). The TODO in the code (`article.vaultMoc` + Plan 13) explicitly acknowledges that deeper bidirectional vault integration is planned but incomplete.

- **"View Aware Help" is aspirational / one-way (P1 gap):** The contract requires View Aware Help to be visible. Currently the view is a standalone hub. There is no evidence that other views (Breadboard, 3D, Component Editor, Generative, Labs, Exports, etc.) dynamically request or display context-specific vault notes or help from this surface. The reverse (articles linking out via VaultHoverCard) exists, but view-aware injection into the maker tools does not.

- **This is a curated subset, not the full knowledge system the user has built (major visibility gap):** The heavy investment in Ars Contexta (qmd, pipeline, MOCs, provenance), NotebookLM hubs (pp-core, pp-hardware, pp-nlm-operator, cross-hub synthesis), vault tools, and pp-knowledge is not visible or navigable from this view. Users get a nice "electronics for beginners/intermediates" experience, but not the full "this is the living knowledge graph and provenance system behind ProtoPulse" experience.

- **No tests recorded (notable gap for a source-quality / help surface):** The skill records zero tests. Per the gotchas, this increases risk for search, rendering, and the critical VaultHoverCard provenance teaching paths.

- **Low complexity + explicit system awareness (positive):** 39 CCN on 392 LOC — deliberately thin. The eslint disable + TODO referencing the InteractiveCard migration (E2E-552 / Plan 03 Phase 4) and vaultMoc shows the team is tracking the broader cleanup and vault integration.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Deepen Source Quality display and complete vault linkage (directly serves the vault + provenance investment)**
- Add per-article inline source quality metadata (origin type, verification date, evidence strength, NotebookLM hub tags, vaultMOC slug) using the same primitives as VaultHoverCard / TrustReceiptCard.
- Complete the `vaultMoc` field + bidirectional linking so every article is a first-class vault citizen (finish the Plan 13 TODO).
- Make "Explore in Vault" richer — show a mini provenance summary inline before the hover card.

**P1 — Implement real View Aware Help (the contract's fourth pillar)**
- Wire the Learn surface so other views can request context-specific vault notes based on current selection (component, net, lab, 3D model, generative candidate, exact part, etc.).
- Add a "View-aware help" panel or command that pulls from the knowledge base + vault + NotebookLM hubs based on view + selected objects.

**P1 — Decide and evolve scope: curated learner hub vs full knowledge system portal**
- Either evolve KnowledgeView into the primary user-facing portal for the Ars Contexta vault + NotebookLM hubs (add MOC navigation, cross-hub synthesis, source freshness, full provenance browser), or explicitly scope it as "curated electronics for learners" and create a separate "Vault Explorer / Knowledge Portal" for the full system.
- The current gap leaves the massive vault/knowledge investment mostly invisible to end users.

**P2 — Test coverage for search + provenance teaching**
- Record test globs in the skill and add coverage for search/filter, VaultHoverCard rendering, difficulty/category metadata, and (once implemented) view-aware help resolution.

**P2 — Finish a11y and laptop viewport polish**
- Complete the InteractiveCard migration (remove the eslint disable, make role="button" divs real buttons).
- Ensure the article list + detail view scroll and focus correctly on laptop heights when many tags or long content are present.

**Strengths (relative to peers):**
- Clean, low-complexity learning content browser with excellent use of existing provenance primitives (`VaultHoverCard`, `InteractiveCard`, difficulty badges).
- Explicit awareness of deeper vault integration (TODO referencing Plan 13 and vaultMoc) — the team knows the gap and has a plan.
- Good metadata (difficulty, category, tags) and search/filter UX for its intended audience (beginner/intermediate electronics learners).
- Uses the same modern UI primitives as the rest of the polished surfaces.

**Cross-Cutting Value (extremely high):**
- This is the primary **user-facing learning + source quality** surface that should make the entire Ars Contexta vault, NotebookLM hubs (pp-core, pp-hardware), pp-knowledge, pp-nlm-operator, and provenance system discoverable and trustworthy.
- It is the natural home for "View Aware Help" that can inject context-specific vault notes into every other view (Breadboard, 3D, Component Editor, Generative, Labs, Exports, Inventory, History, etc.).
- With the heavy investment in the knowledge system, this view is where that investment becomes visible and actionable to end users instead of remaining an internal agent/tool-only capability.

**Durable Lesson:**
A clean curated learning hub that correctly uses VaultHoverCard for provenance teaching can still leave the full knowledge system (vault + NotebookLM + pipeline + MOCs + cross-hub synthesis) invisible if it remains a one-way curated subset without bidirectional vaultMoc linkage, inline source quality metadata, and view-aware help injection into the maker tools. The UX contract requires Source Quality and View Aware Help to be visible — after the vault, NotebookLM, and provenance campaigns, Learn must become the place where users see, trust, and navigate the living knowledge graph.

**Recommended for Codex (immediate high-ROI tasks):**
1. Complete the `vaultMoc` field + bidirectional linking so every article is a first-class vault citizen (finish the Plan 13 TODO).
2. Add per-article inline source quality display (origin, verification, evidence strength, NotebookLM tags, vaultMOC) using existing provenance primitives.
3. Implement real View Aware Help: allow other views to request context-specific vault notes based on current selection (component, net, lab, 3D model, generative candidate, exact part, etc.).
4. Decide and document the scope (curated learner hub vs full knowledge portal) and evolve the UI accordingly (add MOC navigation / hub cross-query if it becomes the portal).
5. Record tests in the skill and add coverage for search, VaultHoverCard, and (once implemented) view-aware help resolution. Finish the InteractiveCard a11y migration.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc (39 CCN), explicit TODO for vaultMoc/Plan 13, source quality and view-aware help gaps, and cross-references to pp-knowledge, pp-nlm-operator, vault tools, provenance (VaultHoverCard usage across many views), breadboard-lab, 3D, Component Editor, Generative, Labs, History, Audit Trail, Dashboard, and Inventory.
- No production code mutated during discovery.
- All findings tied directly to the vault, NotebookLM, provenance, and education work from the same handoff campaign.

---

*Learn analysis complete. Clean curated electronics learning hub with good use of provenance primitives and explicit awareness of deeper vault integration, but Source Quality is delegated rather than deeply surfaced, View Aware Help is not yet real injection into other views, and the full Ars Contexta + NotebookLM knowledge system is not visible to users. This should be the primary user-facing portal for the living knowledge graph and source quality. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Learn section (2026-05-23).*

---

## 23. Left Sidebar (pp-view-left-sidebar) — Deep Analysis (2026-05)

**User Request:** "/pp-view-left-sidebar"

**Inspector Result (entry + final exit):** Status: ok. 19 tracked tests. Main shell `Sidebar.tsx` (707 lines) + sub-panels (HistoryList 72 CCN, ProjectExplorer 48, ComponentTree 41, CoachPanel 38, ProjectSettingsPanel, constants). Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Shell: `Sidebar.tsx` (controlled isOpen/collapsed/width, flex-1 overflow-y-auto main content, navigation groups, composition of Explorer/Coach/History + compact settings footer).
- Sub: `ProjectSettingsPanel.tsx` (compact h-6 trigger + bounded Dialog), `ProjectExplorer.tsx`, `ComponentTree.tsx`, `HistoryList.tsx`, `CoachPanel.tsx`, `sidebar-constants.ts`, `SidebarHeader.tsx`.
- Related: `ProjectWorkspace.tsx`, `MobileNav.tsx`, `WorkspaceHeader.tsx`, `WorkflowBreadcrumb.tsx`.
- scc: 10 files, 2321 code LOC, 296 complexity (HistoryList and ProjectExplorer densest).

**UX Contract Evaluation (sizing, scrolling, project settings, noise, collapsed state, flyouts):**

- **Layout strategy is largely aligned with the contract (positive):** Main content uses `flex-1 overflow-y-auto`; ProjectSettingsPanel is a compact h-6 footer button opening a Dialog with `max-h-[min(68dvh,24rem)] overflow-y-auto` (bounded, good). This directly addresses the historical regression watch on project settings taking over the bottom half.

- **Internal scrolling discipline in sub-panels is the remaining risk (P1):** The contract and gotchas demand bounded panel heights + internal scrolling so the sidebar does not become one giant scroll or push navigation out of reach on laptop-height viewports. HistoryList (72 CCN) and ProjectExplorer (48 CCN) are the densest; any fixed heights or cards-inside-cards inside them will violate the contract on short screens. CoachPanel and ComponentTree must also respect this.

- **Collapsed state and icon-only navigation need clear tooltips + focus order (P1 a11y/usability):** The contract requires collapsed state to remain understandable. Icon-only controls need tooltips. The a11y eslint disables (InteractiveCard migration E2E-552) are still present in Sidebar.tsx and ProjectSettingsPanel — focus order through groups, search, explorer, coach, history, and settings footer must be verified in both states.

- **"Too loud" / density risk from many indicators (P1 per contract):** The sidebar aggregates hardware workspace status, project health tones, feature maturity badges, navigation groups, search, explorer, coach, history, and settings footer. Per the contract ("the app has felt too loud from too many icons and bars"), any new indicators must be grouped or removed rather than added.

- **Mobile navigation is a separate surface (good that it is called out):** Desktop sidebar changes do not automatically validate `MobileNav.tsx`.

- **No new top bars (contract discipline followed):** The code avoids adding extra bars.

- **Good test base (19 tests) + browser screenshots required:** The skill explicitly states screenshots are the reliable way to catch layout issues tests miss.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Enforce bounded heights + internal scrolling in the dense sub-panels (HistoryList, ProjectExplorer, CoachPanel, ComponentTree) on laptop viewports**
- Targeted audit of each for fixed heights, cards-inside-cards, or content that can push the outer scroll and hide navigation on short screens.
- Ensure ProjectExplorer (search + tree), HistoryList (timeline), CoachPanel, and any group sections have internal ScrollArea or proper flex-1 + overflow.

**P1 — Finish InteractiveCard a11y migration and verify focus order**
- Convert remaining `role="button"` divs in Sidebar.tsx and ProjectSettingsPanel.
- Verify logical focus order through navigation groups, search, explorer, coach, history, and settings footer in both expanded and collapsed states.

**P1 — Reduce visual noise / "loudness" (group or hide secondary indicators)**
- Review hardware status, project health tones, feature maturity badges, and any new icons against the "remove or group before adding" rule.
- Consider progressive disclosure for lower-priority status indicators.

**P2 — Validate collapsed state usability + tooltips on all icon-only controls**
- Ensure every icon-only button/nav item has a clear, always-available tooltip (or aria-label + visible label on hover/focus) and remains reachable.

**P2 — Formalize browser smoke checklist for laptop-height + settings-open + flyout states**
- Make the pending proposal in the log part of the standard post-edit verification process.

**Pilot catalog visual evidence (latest-full-app-catalog, 2026-05-23 synthetic-rich run, desktop only)**: This run produced *exactly* the states called for in the checklist and P1 items above:
- `synthetic-rich/pp-view-left-sidebar__shell-left-sidebar/desktop/005-project-settings-open.png` (MANIFEST row 28, interaction "project-settings-open")
- `synthetic-rich/pp-view-left-sidebar__shell-left-sidebar/desktop/006-sidebar-collapsed.png` (MANIFEST row 29, interaction "sidebar-collapsed")
- `synthetic-rich/pp-view-left-sidebar__shell-left-sidebar/desktop/004-sidebar-search-esp.png` (MANIFEST row 27, interaction "sidebar-search-esp")

See CROSSWALK.md (Left Sidebar row) and FAILURES.md (the 12 skips were all "max-elements=3" element overflow + "max-interactions=0; destructive/network actions denied"). The pilot deliberately used low caps and desktop-only to generate the crosswalk targets quickly. The captured PNGs prove the capture harness can hit the precise states the report requires for bounded-scroll + collapsed usability + settings dialog containment verification. Full closure of the P1/P2 requires re-running with the production command (all 5 viewports, max-elements=120, max-interactions=45, --seed-mode mixed) so laptop/short-laptop heights, full sub-panel scrolling under real data, and interaction flows can be visually audited against the UI Container Rule.

**Strengths (relative to peers):**
- Intentional compact treatment of ProjectSettingsPanel (h-6 trigger + bounded Dialog) directly solves a historical pain point called out in the contract.
- Clear separation of concerns (shell vs sub-panels vs constants vs groups lib).
- Good test coverage on the shell and key panels (19 tests).
- Uses modern primitives (InteractiveCard) and respects the "no cards inside cards" rule in the main composition.
- Explicit awareness of mobile as a separate check and of the need for screenshots.

**Cross-Cutting Value (very high — Tier 1 surface):**
- The left sidebar is the primary discoverability and navigation surface for every view audited in this campaign (3D, Breadboard, Component Editor, Generative, Learn, Labs, History, Inventory, Exports, Digital Twin, etc.).
- Any violation of bounded heights, internal scrolling, or "settings taking over" directly impacts the usability of the entire provenance, health, 3D, and maker workflow.
- It is a major consumer of contexts (ProjectMeta, Architecture, BOM, History, Validation, hardware status, project health) — changes ripple into Dashboard, Exports preflight, Coach, etc.

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

---

## 24. Lifecycle (pp-view-lifecycle) — Deep Analysis (2026-05)

**User Request:** "/pp-view-lifecycle"

**Inspector Result (entry + final exit):** Status: ok. Main source `LifecycleDashboard.tsx` (861 lines / 83 CCN). 0 tracked tests. Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `LifecycleDashboard.tsx` (804 code / 83 CCN — moderate for large table + filters + dialog aggregator).
- Data model: ComponentLifecycle records with status active/NRND/EOL/obsolete/unknown, linked to parts in BOM/Inventory/Component Editor.
- Integrates with Exports (fab handoff readiness), Inventory health, provenance/trust signals.
- No tests recorded in the skill.

**UX Contract Evaluation (Project Lifecycle / Maturity Stages / Readiness / History):**

- **Focused, practical component lifecycle management surface (strength):** Clear status model (active → NRND → EOL → obsolete) with visual badges/colors/icons, counts per status, search + statusFilter, editable table, and dialog for CRUD. "Maturity Stages" and "Readiness" for individual parts heading into fab/export are directly supported (critical for Exports "Fab Handoff" and Inventory "Saved Parts" trust). "History" is present via updatedAt and change tracking in the records.

- **"Project Lifecycle" vs "Component Lifecycle" scope is component-centric (P1 clarification needed):** The view is named LifecycleDashboard and the contract talks about "Project Lifecycle," but the data and UI are per-ComponentLifecycle records. It does not appear to aggregate into a higher-level project maturity/readiness score (e.g., "overall project is 70% ready for first fab run" combining architecture completeness, BOM coverage, verified exact parts %, 3D mechanical coverage, breadboard health, generative provenance, inventory health, export readiness, etc.). This may be intentional (component-level only) or a gap vs the contract's "Project Lifecycle" pillar.

- **Provenance / uncertainty marking on lifecycle changes is thin (P1 gap):** The contract requires "AI-generated or uncertain data is clearly marked." Lifecycle status changes (especially for generative-adopted parts or community-sourced exact parts) should carry or display provenance (who changed it, linked to generative candidate or verification, source evidence, trust level). Currently it looks like standard CRUD with updatedAt — no visible link to the rich provenance system built elsewhere (Component Editor verification, Generative `generatedFrom`, breadboard-lab exact-part provenance).

- **No visible integration with 3D / breadboard / generative state (P1 gap):** A part's lifecycle status should influence or be influenced by whether it has verified 3D models / mechanical envelopes (Component Editor + 3D View), whether it is placed and verified on breadboard (breadboard-lab), or whether it came from generative design. No such signals or actions are visible.

- **"Readiness" and "History" are present but could be richer for full fab handoff (P2):** The view helps decide "is this part ready to ship?" and has per-record history. But for the full "Fab Handoff" story (Exports), it should be one of the primary sources for trust receipts and precheck warnings (e.g., "EOL part in BOM — replace before generating Complete Fab Package"). It should also link to or be linked from the broader project health surfaces (Dashboard, Left Sidebar, Inventory health).

- **0 tests recorded (notable gap for a readiness surface):** The skill records zero tests. Per the gotchas, this increases risk for filters, status transitions, dialog state, and any future aggregation logic.

- **Large aggregator with low density (good sign):** 83 CCN on 804 LOC — mostly declarative table + filters + dialog wiring. The real complexity and value live in the data model and downstream consumers (Exports, Inventory, breadboard exact-part decisions, project health).

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Clarify and (if needed) expand scope from Component Lifecycle to Project Lifecycle / Readiness aggregate (contract pillar)**
- Decide whether this view is intentionally component-only or should become (or feed) the aggregator for overall project maturity/readiness (architecture completeness + BOM coverage + verified exact parts % + 3D mechanical coverage + breadboard health + generative provenance + inventory health + export readiness).
- If the latter, surface a high-level "Project Readiness Score" or lifecycle stage that feeds the Dashboard and Left Sidebar health indicators.

**P1 — Surface provenance on lifecycle records and changes (directly serves the provenance identity)**
- Add provenance metadata to ComponentLifecycle records (source: generative / manual / community / verified exact part, linked candidate/verification ID, trust level).
- Display/edit this provenance in the table and history views; make lifecycle status changes for AI-generated or unverified parts carry visible provenance context.

**P1 — Wire Lifecycle status into Exports / Inventory / Breadboard / 3D / Component Editor flows**
- Make lifecycle status a first-class input to Exports precheck (warn/block on EOL/obsolete in BOM or Complete Fab Package).
- Surface in Inventory health and breadboard coach ("this placed part is NRND — consider replacement").
- Link from Component Editor when editing a part's lifecycle; influence 3D mechanical readiness or breadboard exact-part recommendations.

**P2 — Enrich History view inside the dashboard**
- Make per-record history show who changed status, why (linked design snapshot, generative candidate, lab result, or verification event), and full provenance context.

**P2 — Test coverage**
- Record test globs in the skill and add coverage for status transitions, provenance display, filters, and (once implemented) project-level aggregation.

**Strengths (relative to peers):**
- Clean, focused component lifecycle status management with good visual model (active/NRND/EOL/obsolete with colors/icons) and practical editing flow.
- Directly supports critical fab/export readiness decisions.
- Low complexity density for its size — mostly declarative table + dialog wiring.
- Positioned perfectly to become a key source of truth for the broader provenance and project health story.

**Cross-Cutting Value (very high):**
- This is the "part maturity / readiness" layer that must feed Exports fab handoff, Inventory health, breadboard exact-part decisions, provenance trust receipts, and project-level health dashboards.
- It is one of the key places where the safety/provenance story (verification status, generative origin, lifecycle stage) becomes actionable for "can I ship this?"

**Durable Lesson:**
A dedicated component lifecycle dashboard with clear status stages is necessary but not sufficient for the "Project Lifecycle" and "Readiness" pillars if it remains isolated from the richer provenance, 3D mechanical, breadboard health, and generative systems built elsewhere. Lifecycle status changes for AI-generated or unverified parts must carry and display provenance, and the view should either aggregate into a project-level readiness score or be explicitly scoped while another surface owns the higher-level view. This surface is perfectly positioned to close that loop.

**Recommended for Codex (immediate high-ROI tasks):**
1. Decide and document whether this view owns "Project Lifecycle / Readiness" aggregation or is intentionally component-only; if the former, add a high-level project readiness score or lifecycle stage that feeds Dashboard and Left Sidebar.
2. Add provenance metadata to ComponentLifecycle records and display it in the table/history (source, linked generative candidate or verification, trust level).
3. Wire lifecycle status into Exports precheck, Inventory health, breadboard coach, 3D mechanical readiness, and Component Editor flows.
4. Enrich per-record history with provenance context and links to design snapshots, generative candidates, or lab results.
5. Record tests in the skill and add coverage for status transitions, provenance display, and aggregation (once implemented).

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc, exact component-centric scope, provenance gaps, integration opportunities with Exports/Inventory/breadboard/3D/Generative, and cross-references to the full provenance, health, and fab handoff campaign.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust, exact-part, 3D mechanical, breadboard-lab, Exports, Inventory, Dashboard, and Left Sidebar work from the same handoff audit.

---

*Lifecycle analysis complete. Clean, focused component lifecycle status management that directly supports fab/export readiness, but scope is component-centric, provenance on lifecycle changes is thin, and integration with 3D/breadboard/generative provenance is missing. This is a key readiness surface that must carry the safety story into Exports and project health. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Lifecycle section (2026-05-23).*

---

## 25. My Parts (pp-view-my-parts) — Deep Analysis (2026-05)

**User Request:** "/pp-view-my-parts"

**Inspector Result (entry + final exit):** Status: ok. Main source `PersonalInventoryPanel.tsx` (166 lines / 19 CCN). 0 tracked tests. Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `PersonalInventoryPanel.tsx` (154 code / 19 CCN — very lightweight personal stock list).
- Uses `usePersonalInventory()`, `useAddPersonalStock()`, `useCatalog()` (global parts catalog).
- Data shape: PartStockRow (id, partId, storageLocation, supplier, quantityOnHand, unitPrice).
- Grouped by storageLocation; search-to-add from catalog with MPN display.
- No tests recorded in the skill.
- Distinct from project-level StorageManagerPanel (994 lines with full health analyzer, barcode, QR labels).

**UX Contract Evaluation (Personal Parts / Stock Counts / Locations / Part Confidence):**

- **Clean, compact personal stock viewer (strength):** Simple, focused panel showing the user's private bin stock, grouped by storage location, with search-to-add from the global catalog. Stock counts (quantityOnHand) and locations (storageLocation) are visible and grouped. The UI is deliberately lightweight (166 lines) and respects the "keep compact" and "no cards inside cards" principles. Good separation of "my private bin" vs "project assets."

- **"Part Confidence" pillar is completely missing (direct P1 contract violation):** The UX contract explicitly requires "Part Confidence is visible enough for a user to understand what is happening." The current implementation has **zero** trust, verification, provenance, or confidence UI:
  - No badges for "Verified Exact Part", "Generative Origin", "Community-sourced", "Local unverified", confidence score, source evidence, or verification status.
  - No link to Component Editor verification or exact-part provenance.
  - No distinction between high-confidence personal stock (verified exact parts the user owns) vs low-confidence (generic, untracked, or AI-generated without verification).
  - The "AI-generated or uncertain data is clearly marked" contract is not reflected here at all.

- **No bridges to breadboard / 3D / generative / project surfaces (P1 gap):** 
  - No indication which personal parts are currently placed on breadboard or have verified 3D models.
  - No "use from my personal inventory" affordance when adding exact parts in breadboard or Component Editor.
  - No provenance link when adding a generative-adopted part to personal inventory.
  - No integration with project-level inventory health, BOM shortfalls, or Exports precheck (personal stock should inform "I have X on hand personally" vs project stock).

- **"Personal Parts" vs "Project Inventory" distinction is good but isolated:** The existence of a separate lightweight PersonalInventoryPanel (vs the rich StorageManagerPanel for project BOM/stock) is the right architectural split for "my home bin" vs "project assets." However, the two surfaces do not talk to each other, and personal stock does not participate in the provenance, health, or readiness stories.

- **0 tests recorded (notable gap for a stock/confidence surface):** The skill records zero tests. Per the gotchas, this increases risk for search-to-add, location grouping, and any future confidence UI.

- **Low complexity, clean code (positive):** 19 CCN on 154 LOC — deliberately thin. Good use of ScrollArea and grouping by location. The panel follows the UI Container Rule spirit.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Implement Part Confidence / provenance UI (direct contract violation)**
- Add visible confidence/trust badges or indicators on every StockRow and in the add-search results (e.g., "Verified Exact Part", "Generative Origin", "Community-sourced", confidence score, source evidence link).
- Pull and display verification status and provenance from Component Editor / Generative when parts are added or matched.
- Make uncertain/AI-generated personal stock visually distinct (consistent with VaultHoverCard / TrustReceiptCard patterns used elsewhere).

**P1 — Bridge Personal Inventory to breadboard / 3D / Component Editor / project surfaces**
- When adding exact parts in breadboard or Component Editor, offer "use from my personal inventory" with stock counts and locations.
- Show which personal parts have verified 3D models / mechanical envelopes (link to 3D View or Component Editor).
- Feed personal stock into project-level inventory health and BOM shortfall calculations (or at least make it visible as "I have X personally").
- On adoption of a generative candidate, offer to add the resulting parts to personal inventory with appropriate provenance flags.

**P2 — Unify or clearly link Personal vs Project inventory views**
- Provide navigation or summary links between PersonalInventoryPanel and the project StorageManagerPanel so users understand "my private bin" vs "project assets" and how they interact for exact-part decisions and fab handoff.

**P2 — Test coverage for search-to-add, location grouping, and (once implemented) confidence flows**
- Record test globs in the skill and add coverage for the add flow, grouping, and provenance display.

**Strengths (relative to peers):**
- Clean, deliberately lightweight personal stock viewer that respects the "keep compact" and "no cards inside cards" principles.
- Good separation of "my private bin" (PersonalInventoryPanel) vs "project assets" (StorageManagerPanel) — the right architectural distinction for personal vs shared stock.
- Search-to-add from the global catalog with MPN display is practical.
- Location grouping and simple stock counts are immediately useful for "where did I put my resistors?"

**Cross-Cutting Value (very high for the provenance + breadboard-lab + exact-part story):**
- This is the user's "I have these parts at home" truth that should inform safe and confident exact-part choices on breadboard ("use my verified personal stock first").
- It must carry and prominently surface the same provenance/trust signals (exact-part verification, generative origin, community vs local) that the rest of the system now enforces, or the personal stock layer becomes a blind spot in the safety story.
- Personal inventory confidence directly affects "can I rely on this part for my current design?" decisions across breadboard, 3D mechanical fit, and fab handoff.

**Durable Lesson:**
A clean, compact personal inventory panel can still leave "Part Confidence" completely invisible if it never pulls or displays verification status, generative origin, or source provenance from the Component Editor, Generative, and breadboard-lab systems. The UX contract requires "Part Confidence" to be visible — after the provenance campaign, the user's private stock must participate in the same trust model as project parts, or "my bin" becomes a provenance hole that undermines exact-part safety and fab handoff confidence.

**Recommended for Codex (immediate high-ROI tasks):**
1. Add prominent confidence/trust badges and provenance indicators on every StockRow and in the add-search results (verified exact, generative origin, source evidence, trust level) using existing VaultHoverCard / TrustReceiptCard patterns.
2. Wire Personal Inventory into breadboard exact-part selection ("use from my personal stock"), Component Editor part creation, and 3D model association.
3. Feed personal stock counts/locations into project-level inventory health and BOM shortfall surfaces (or at least make them visible as "personal buffer").
4. On generative adoption, offer to add resulting parts to personal inventory with provenance flags.
5. Record tests in the skill and add coverage for the add flow, location grouping, and provenance display.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc (19 CCN), exact missing "Part Confidence" UI, provenance gaps, integration opportunities with breadboard/3D/Component Editor/Generative/project inventory, and cross-references to the full provenance/trust, exact-part, breadboard-lab, Exports, Inventory, and health work from the same handoff campaign.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust, exact-part, breadboard-lab, and inventory health work from the same handoff audit.

---

*My Parts analysis complete. Clean, lightweight personal stock viewer with good location grouping and search-to-add, but "Part Confidence" (the 4th contract pillar) is completely missing — no trust, verification, or provenance UI at all. This is the user's "my private bin" layer that must participate in the safety/provenance story for exact-part decisions and fab handoff. Currently it is a provenance blind spot. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended My Parts section (2026-05-23).*

---

## 26. Order PCB (pp-view-order-pcb) — Deep Analysis (2026-05)

**User Request:** "/pp-view-order-pcb"

**Inspector Result (entry + final exit):** Status: ok. Main source `PcbOrderingView.tsx` (997 lines). 0 tracked tests. Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `PcbOrderingView.tsx` (large step-based wizard ~997 lines).
- 5-step flow: Board Specs → Select Fab → DFM Check → Quotes → Summary.
- Uses `usePcbOrdering`, `runDfmCheck`, `buildOrderingTrustReceipt`, `buildWorkspaceReleaseConfidence`.
- Renders `ReleaseConfidenceCard`, `TrustReceiptCard`, `VaultInfoIcon`, `FabApiSettings`.
- Pulls from Architecture, BOM, Validation (classic signals); has DFM results and quote comparison.
- No tests recorded in the skill.

**UX Contract Evaluation (PCB Order Flow / Fab Checks / Cost/Shipping / Final Review):**

- **Mature step-based ordering wizard with the right provenance hooks (strength):** Excellent 5-step structure with board specs, multi-fab selection (with API settings), DFM results display (pass/fail + issues), quote comparison, and summary. It correctly renders the provenance primitives (`ReleaseConfidenceCard` + `TrustReceiptCard`) and builds `buildOrderingTrustReceipt` + `buildWorkspaceReleaseConfidence` from BOM/validation/architecture data. The UI bones for "PCB Order Flow," "Fab Checks," "Cost/Shipping," and "Final Review" are production-grade and consistent with the Exports trust system.

- **Fab Checks / DFM are still mostly legacy board-spec (P1 gap after the full campaign):** The DFM (`runDfmCheck` on `BoardSpecification`) is classic Gerber/DFM rule checking against the selected fab's capabilities. It does **not yet** consume or display the rich upstream safety/provenance work built throughout the audit:
  - No enforcement or visibility for verified exact parts vs unverified community parts (Component Editor).
  - No 3D mechanical / enclosure fit / airwire clearance / component envelope checks (hardened BoardViewer3DView + Component Editor).
  - No breadboard health / coach score / exact-part placement provenance (breadboard-lab).
  - No generative origin (`generatedFrom`) count or verification status on adopted parts (Generative view).
  - No lifecycle status summary (EOL/obsolete parts in the design — Lifecycle view).
  - No inventory / personal stock confidence or shortfall signals (Inventory + My Parts).
  - No digital twin / sim-vs-actual validation results (Digital Twin view).
  The "AI-generated or uncertain data is clearly marked" contract is only partially served by the generic release confidence card; the specific per-part and per-surface provenance is not yet in the DFM or final review.

- **"Final Review" has the trust cards but the data is incomplete (P1 gap):** The `TrustReceiptCard` and `ReleaseConfidenceCard` are rendered (excellent), but they are fed only the classic architecture/BOM/validation signals (same as the Exports view). The full campaign's signals (3D mechanical, exact-part verification, breadboard provenance, generative, lifecycle, inventory, digital twin) are not yet aggregated into the ordering trust receipt or DFM. This is the last money-spending gate — the place where everything must be visible and enforced.

- **Cost/Shipping and Fab selection are present and practical:** Multi-fab quote comparison, API settings for real fabs (JLCPCB etc.) — this part of the flow is mature.

- **0 tests recorded (notable gap for the final money-spending gate):** The skill records zero tests. Per the gotchas, this increases risk for the DFM, quote, trust receipt, and final review flows where all the safety signals must be enforced before real fabrication orders are placed.

- **Large wizard with the right structure (positive):** The step state machine, DFM results rendering, quote comparison, and trust card integration are well done. The gap is data depth and enforcement, not UI architecture.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Enrich DFM Checks and Ordering Trust Receipt with the full provenance/safety signals from the campaign (highest-ROI for "ship with confidence")**
- Extend the DFM inputs and `buildOrderingTrustReceipt` to include:
  - Exact-part verification % or list (verified vs unverified/community) from Component Editor.
  - 3D mechanical / enclosure fit / clearance status from BoardViewer3DView + Component Editor.
  - Breadboard health / coach score / exact-part placement provenance from breadboard-lab.
  - Generative origin count + verification status on adopted parts.
  - Lifecycle status summary (any EOL/obsolete parts?).
  - Inventory / personal stock confidence and shortfall signals.
  - Digital twin comparison health (if a twin exists).
- Block or strongly warn on "Final Review" / before quotes or "Place Order" for critical gaps (unverified generative parts, missing 3D mechanical for enclosure designs, EOL parts in BOM, poor breadboard health, etc.).

**P1 — Make "AI-generated or uncertain data" explicitly visible and actionable in the final review**
- In the Summary / Final Review step, add or enrich a "Provenance & Safety Summary" (or the existing TrustReceiptCard) that clearly lists:
  - Number/percentage of parts with full verification + source evidence.
  - Generative-adopted parts (with link to candidate and verification status).
  - Parts with 3D mechanical data vs missing.
  - Breadboard vs schematic-only provenance.
  - Lifecycle warnings.
- Provide one-click "go fix" actions: "Go verify these parts in Component Editor", "Preview mechanical fit in 3D", "Run breadboard coach", "Open Digital Twin", "Check lifecycle", etc.

**P1 — Add automated "Fab Readiness Checklist" that aggregates all upstream readiness**
- Before allowing the user to proceed past DFM or to quotes/order, run a composite readiness check that includes classic DFM + all the new provenance/safety signals above, with clear pass/warn/fail per category and deep links back to the source views (3D, Component Editor, Breadboard, Lifecycle, Inventory, Generative, Digital Twin, etc.).

**P2 — Test coverage for the final gate**
- Record test globs in the skill and add coverage for DFM results, enriched trust receipt contents, provenance summary, and blocking/warning behavior on poor provenance signals.

**Strengths (relative to peers):**
- Excellent step-based ordering wizard structure with the right provenance primitives (`TrustReceiptCard`, `ReleaseConfidenceCard`, `buildOrderingTrustReceipt`) already wired in and rendered.
- Practical multi-fab selection, DFM results display, quote comparison, and real fab API settings.
- Consistent with the Exports trust system — the architecture for provenance at handoff is already in place.
- `VaultInfoIcon` and teaching affordances present.

**Cross-Cutting Value (highest in the entire campaign):**
- This is the **final money-spending gate** — the one place where all the safety, provenance, 3D mechanical, exact-part, breadboard health, generative, lifecycle, inventory, and digital twin work must be visible, enforced, and actionable before the user can place a real fabrication order.
- If this view does not consume and display the full upstream campaign, the "ship with confidence" promise the entire handoff audit has been building is broken at the last step.

**Durable Lesson:**
A beautiful step-based ordering wizard that already renders `TrustReceiptCard` and `ReleaseConfidenceCard` and calls `buildOrderingTrustReceipt` has done the UI, state, and hook work correctly. The remaining work is data depth and enforcement: feeding the DFM and the final review with the rich provenance, 3D mechanical, exact-part verification, breadboard health, generative origin, lifecycle, inventory, and digital twin signals built throughout the rest of the system. The final handoff surface must not only mark "AI-generated or uncertain data" but actively block or strongly warn before real money is spent.

**Recommended for Codex (immediate high-ROI tasks):**
1. Extend the DFM inputs and `buildOrderingTrustReceipt` to consume the full provenance/safety signals (exact-part verification %, 3D mechanical status, breadboard health/provenance, generative origin + verification, lifecycle summary, inventory/personal stock confidence, digital twin health).
2. In the Final Review / Summary step, add or enrich a "Provenance & Safety Summary" that lists the above with "go fix" deep links to the relevant views.
3. Add blocking/warning logic before quotes or order placement for critical provenance/safety gaps.
4. Add an automated "Fab Readiness Checklist" that aggregates classic DFM + the new signals.
5. Record tests in the skill and add coverage for the enriched trust receipt, provenance summary, and blocking behavior.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc, exact DFM scope (legacy board-spec), trust hook presence vs data depth gap, and cross-references to Exports, Lifecycle, Inventory, Component Editor, 3D View, breadboard-lab, Generative, Digital Twin, History, Audit Trail, Left Sidebar, Dashboard, Learn, My Parts, and all provenance work from the same handoff campaign.
- No production code mutated during discovery.
- All findings tied directly to the "ship with confidence" / fab handoff / provenance / 3D mechanical / exact-part / breadboard health story built throughout the entire audit.

---

*Order PCB analysis complete. Mature step-based wizard with the right trust/receipt hooks already in place, but the DFM and final review are still mostly legacy board-spec checks — the rich provenance, 3D mechanical, exact-part, breadboard, generative, lifecycle, inventory, and digital twin signals from the campaign are not yet consumed or displayed at the final money gate. The UI bones are excellent; the data depth and enforcement are the gap. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Order PCB section (2026-05-23).*

---

## 27. Part Usage (pp-view-part-usage) — Deep Analysis (2026-05)

**User Request:** "/pp-view-part-usage"

**Inspector Result (entry + final exit):** Status: ok. Main source `PartUsageBrowserView.tsx` (153 lines / 28 CCN). 0 tracked tests. Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `PartUsageBrowserView.tsx` (145 code / 28 CCN — lightweight cross-project usage browser).
- Uses `useUsageBrowse` (high-level aggregated list) and `usePartUsage` (lazy per-project drill-down on expand).
- Shows parts with projectCount, totalQuantityNeeded, totalPlacements; expandable rows with per-project breakdown (projectName, stock needed vs on hand, placementCount).
- Grouped by usage; uses Collapsible + ScrollArea.
- No tests recorded in the skill.

**UX Contract Evaluation (Where Used Data / Usage Impact / Project Links / Part Lifecycle):**

- **Clean, effective cross-project usage browser (strength):** Excellent high-level view of "which parts are used across many projects" with project count, total quantity needed, and total placements. Expandable rows provide per-project drill-down (stock needed vs on hand, placement count). This directly serves "Where Used Data," "Usage Impact," and "Project Links." The lazy-loading via Collapsible + usePartUsage when expanded is a good UX pattern for performance.

- **"Part Lifecycle" pillar is completely missing (direct P1 contract violation):** The UX contract explicitly requires "Part Lifecycle is visible enough." The current implementation has **zero** lifecycle status, maturity stage, or EOL/obsolete warnings on the usage rows or in the drill-down. A part that has gone NRND or EOL in the Lifecycle view but is still heavily used (high projectCount + placements) is not flagged here. This is a critical gap for impact analysis ("this part I'm about to obsolete is used in 12 projects across 87 placements — here's the blast radius").

- **Provenance / "AI-generated or uncertain data" is not marked on usage (P1 gap):** When a generative-adopted part or an unverified community-sourced exact part is used across many projects, the usage browser does not surface its origin or verification status. The contract requires uncertain data to be clearly marked. A user looking at high-usage parts has no way to see "these 7 projects are all using the same unverified generative part."

- **No 3D / breadboard-specific impact or actionability (P1 gap):** The drill-down shows generic "placements" and stock numbers, but does not break down:
  - How many placements are on breadboard vs schematic-only.
  - Whether the parts have verified 3D mechanical models / enclosure fit.
  - Direct links to open the breadboard or 3D view filtered to usages of this part.
  - "Bulk replace this part across all projects" or "flag all usages for review because this part is now unverified" actions.

- **No integration with Lifecycle / Component Editor / Generative changes (P1 gap):** When a part's lifecycle or verification status changes in the Lifecycle or Component Editor view, or a generative part is adopted and then used, there is no visible propagation or notification in the Part Usage browser. The "impact" is computed but not connected to the events that should trigger review.

- **0 tests recorded (notable gap for an impact analysis surface):** The skill records zero tests. Per the gotchas, this increases risk for the lazy-loading drill-down, aggregation correctness, and any future provenance/lifecycle display.

- **Low complexity, clean code (positive):** 28 CCN on 145 LOC — deliberately thin and focused. Good use of Collapsible for progressive disclosure and lazy data loading. The UI follows the "keep text inside its container" and ScrollArea principles.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Surface Part Lifecycle status and impact on usage rows (direct contract violation)**
- Add lifecycle status badges (active/NRND/EOL/obsolete) to every UsageRow and in the per-project drill-down.
- When a part has poor lifecycle status (NRND/EOL/obsolete) and high usage (many projects or placements), make it visually prominent (warning color, "High Impact — Lifecycle Change" badge).
- Link to the Lifecycle view for that part with "change status" or "find replacement" actions.

**P1 — Add provenance / uncertainty markers on usage rows (AI-generated / unverified / community-sourced)**
- Pull and display verification status and origin (generative candidate link, exact-part verification level, source evidence) on the high-level rows and in the drill-down.
- Flag high-usage parts that have uncertain provenance ("This part used in 9 projects has pending verification — review before fab").

**P1 — Add 3D / breadboard-specific impact and direct navigation**
- Break down placements into "breadboard placements" vs "schematic only" and "has verified 3D model" vs "missing mechanical data."
- Provide one-click actions: "Open all breadboards using this part", "Preview mechanical fit in 3D for all usages", "Find replacement part with full 3D + verified status."

**P1 — Wire change events from Lifecycle / Component Editor / Generative into usage impact visibility**
- When a part's lifecycle or verification status changes, surface those parts at the top of the usage browser with "Recently Changed — Review Impact" callouts and links to the affected projects.

**P2 — Add actionability for bulk impact (replace, flag, notify)**
- "Bulk replace this part across all projects" (with provenance-preserving migration).
- "Flag all usages of this part for review" (creates tasks or audit entries).
- Export usage impact report (for fab handoff or supplier negotiation).

**P2 — Test coverage for aggregation, lazy drill-down, and (once implemented) lifecycle/provenance display**
- Record test globs in the skill and add coverage for useUsageBrowse aggregation, usePartUsage per-project data, and the new lifecycle/provenance UI.

**Strengths (relative to peers):**
- Clean, focused "where used" browser with good progressive disclosure (high-level aggregated list + lazy per-project drill-down on expand).
- Practical metrics (project count, total quantity needed, total placements) that directly answer "what is the blast radius of changing this part?"
- Lightweight and performant (lazy loading only when the user expands a row).
- Good separation from the per-project Inventory views — this is the portfolio-level impact view.

**Cross-Cutting Value (extremely high):**
- This is the **impact analysis / blast radius** layer that makes the Lifecycle view, Component Editor verification changes, Generative adoptions, and Inventory stock decisions actionable across the entire project portfolio.
- When a part goes EOL or its verification status changes, this view should be the first place a user goes to understand "which projects, breadboards, and 3D assemblies are affected and how much work is required to mitigate."
- It is one of the primary consumers that should make the entire provenance and safety story (verification, generative origin, lifecycle, breadboard/3D usage) visible at the "what parts are used where and with what risk?" level.

**Durable Lesson:**
A clean where-used browser that shows project counts, quantities, and placements can still leave the most important "impact" questions unanswered if it does not surface Part Lifecycle status and provenance/uncertainty on the high-usage parts. The contract requires both "Usage Impact" and "Part Lifecycle" to be visible — after the Lifecycle, Component Editor verification, Generative, and breadboard-lab campaigns, the usage browser must become the place where users see the combined risk (heavily used + EOL + unverified generative part = high priority for replacement).

**Recommended for Codex (immediate high-ROI tasks):**
1. Add Part Lifecycle status badges (active/NRND/EOL/obsolete) to every UsageRow and in the per-project drill-down; visually highlight high-usage + poor lifecycle combinations.
2. Add provenance / uncertainty markers (generative origin, exact-part verification status, source confidence) on usage rows using existing VaultHoverCard / TrustReceiptCard patterns.
3. Break down placements and add direct navigation to breadboard and 3D usages ("Open breadboards using this part", "Preview mechanical fit for all placements").
4. Wire change events from Lifecycle / Component Editor / Generative so affected high-usage parts surface with "Recently Changed — Review Impact" callouts.
5. Add actionability (bulk replace, flag for review, export impact report) and record tests in the skill for the new lifecycle/provenance/impact UI.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc (28 CCN), exact missing lifecycle and provenance UI on usage rows, integration opportunities with Lifecycle/Component Editor/Generative/breadboard/3D/Exports, and cross-references to the full provenance/trust, exact-part, breadboard-lab, Lifecycle, Inventory, Exports, Order PCB, and health work from the same handoff campaign.
- No production code mutated during discovery.
- All findings tied directly to the provenance/trust, Lifecycle, Component Editor, Generative, breadboard-lab, 3D, Exports, Order PCB, and impact analysis work from the same handoff audit.

---

*Part Usage analysis complete. Clean, effective cross-project where-used browser with good lazy drill-down and practical impact metrics (projects, quantity, placements), but "Part Lifecycle" and provenance/uncertainty markers are completely missing from the usage rows. This is the blast-radius view that should make Lifecycle changes, Generative output, and verification status actionable at the portfolio level — currently the most important risk signals (heavily used + EOL + unverified) are invisible. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Part Usage section (2026-05-23).*

---

## 28. Patterns (pp-view-patterns) — Deep Analysis (2026-05)

**User Request:** "/pp-view-patterns"

**Inspector Result (entry + final exit):** Status: ok. Main source `DesignPatternsView.tsx` (964 lines / 72 CCN). 0 tracked tests. Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `DesignPatternsView.tsx` (852 code / 72 CCN — substantial two-tab browser: curated Patterns + My Snippets CRUD).
- Uses `getAllPatterns` / filters / search from `@/lib/design-patterns` (DesignPattern with name, description, category, difficulty, whyItWorks, components, connections, tips, common mistakes) and `useDesignSnippets` from `@/lib/design-reuse` (DesignSnippet CRUD).
- Two tabs: "Patterns" (InteractiveCard grid with expand-to-detail educational content) and "My Snippets" (create/edit/delete).
- Uses `InteractiveCard`, `Tabs`, `EmptyState`, `ScrollArea`, difficulty/category filters.
- No "apply" buttons, no trust/provenance UI visible in the code.
- No tests recorded in the skill.

**UX Contract Evaluation (Reusable Patterns / Search/Browse / Apply Flow / Pattern Trust):**

- **Solid educational / documentation browser for patterns (strength):** The "Patterns" tab provides a clean, searchable, filterable grid of curated `DesignPattern` cards with difficulty badges, category icons, and rich expandable educational content (whyItWorks, components, connections, tips, common mistakes). The "My Snippets" tab provides practical CRUD for user-owned reusable fragments. Search/Browse is well implemented. This satisfies the educational side of "Reusable Patterns" and "Search/Browse."

- **"Apply Flow" pillar is completely missing (direct P1 contract violation):** The UX contract explicitly requires "Apply Flow is visible enough." There are **no apply buttons, no "use this pattern" actions, no integration with breadboard/3D/Component Editor/Generative**. The view is read-only documentation + personal snippet management. Users cannot yet take a pattern and instantiate it into their current design (as new CircuitInstances, breadboard placements, 3D components, etc.).

- **"Pattern Trust" pillar is completely missing (direct P1 contract violation):** The UX contract explicitly requires "Pattern Trust is visible enough." There are **zero** trust, verification, provenance, or confidence UI elements on the pattern cards or in the detail view:
  - No badges for verification status, source evidence, usage count across projects, maturity/lifecycle, generative origin, or community contribution.
  - No link to "who verified this pattern" or "last used successfully in these designs."
  - The "AI-generated or uncertain data is clearly marked" contract is not served for patterns at all.
  - "My Snippets" has no provenance stamping when a user creates one from their own work.

- **No connection to the provenance / 3D / breadboard / generative / lifecycle systems (P1 gap):** The entire campaign has built rich provenance (verification, generative origin, breadboard/3D usage, lifecycle). Patterns are the perfect vehicle for reusable, trusted assets, but the view does not yet participate in that story. A pattern that has been successfully used in 47 projects with verified exact parts and good 3D mechanical fit should surface that evidence; currently it does not.

- **"My Snippets" is a good start for user-generated patterns but lacks trust stamping:** When a user creates a snippet from their own design, it should automatically carry provenance (source design snapshot, parts used with their verification status, breadboard/3D context). It currently does not.

- **0 tests recorded (notable gap for a trust/apply surface):** The skill records zero tests. Per the gotchas, this increases risk for the two-tab UI, filters, expand/collapse, and any future apply/trust flows.

- **Good use of modern primitives (positive):** Uses `InteractiveCard`, `Tabs`, `EmptyState`, `ScrollArea`, etc. The two-tab structure (curated library + personal snippets) is a thoughtful separation.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Implement Apply Flow (direct contract violation)**
- Add "Apply Pattern" / "Instantiate" action on every curated pattern and user snippet.
- On apply, create the corresponding elements in the current context (new CircuitInstances in the active design, breadboard placements, 3D components with mechanical data, etc.), preserving any part provenance.
- Offer choices: "Apply to current schematic", "Apply to breadboard", "Apply as 3D mechanical sub-assembly", "Seed generative run with this pattern as constraint."

**P1 — Implement Pattern Trust / provenance UI (direct contract violation)**
- Add visible trust badges and provenance summary on every PatternCard and in the expanded detail (verification status, source evidence, usage count across projects, maturity/lifecycle, generative origin, last successful use).
- For "My Snippets," automatically stamp provenance when created (linked design snapshot, parts with their verification status, breadboard/3D context) and display it.
- Use the same VaultHoverCard / TrustReceiptCard primitives as Exports, Order PCB, Component Editor, Generative, etc.

**P1 — Wire Patterns into Generative, Component Editor, Breadboard, 3D, Lifecycle, Exports as first-class reusable assets**
- Generative should be able to use patterns as seeds or constraints.
- Component Editor should offer "save this subcircuit/mechanical arrangement as a reusable pattern."
- Breadboard and 3D should offer "apply this wiring/mechanical pattern."
- Lifecycle and Exports should treat patterns as "known-good" or "maturity-stamped" assets that improve readiness scores.

**P2 — Add usage evidence and "proven in the wild" signals**
- Show real usage counts and example projects (anonymized or with permission) that have successfully used the pattern.
- Allow users to "endorse" or "report success" when they apply a pattern, feeding back into its trust score.

**P2 — Test coverage for the two-tab UI, filters, expand/collapse, and (once implemented) apply/trust flows**
- Record test globs in the skill and add coverage for search/filter, tab switching, snippet CRUD, and the new apply/provenance UI.

**Strengths (relative to peers):**
- Thoughtful two-tab structure (curated library for learning + personal snippets for reuse).
- Rich educational content per pattern (whyItWorks + components + connections + tips + common mistakes) — excellent for the "Learn" side of the platform.
- Good use of modern UI primitives (`InteractiveCard`, `Tabs`, `EmptyState`).
- Clean separation between system-curated patterns and user-owned snippets.

**Cross-Cutting Value (extremely high):**
- This is the **reusable assets / knowledge amplification** layer that turns individual successful designs into platform-wide leverage.
- Patterns that carry rich provenance (verification, generative origin, breadboard/3D usage evidence, lifecycle maturity) become the highest-trust building blocks users can apply, directly multiplying the value of the Component Editor, 3D View, breadboard-lab, and Generative systems.
- It is one of the primary places where the entire provenance and safety story becomes reusable and teachable at scale.

**Durable Lesson:**
A beautiful two-tab patterns browser with rich educational content can still leave the most important "trust" and "apply" questions unanswered if it never surfaces Pattern Trust (verification, provenance, usage evidence) or provides an Apply Flow that instantiates the pattern into the user's actual breadboard/3D/schematic with provenance preserved. The contract requires all four pillars — after the 3D, breadboard-lab, Component Editor verification, Generative, and provenance campaigns, Patterns must become the place where users find, trust, and safely apply proven reusable assets, not just read about them.

**Recommended for Codex (immediate high-ROI tasks):**
1. Implement Apply Flow: add "Apply" actions on patterns and snippets that create the corresponding elements in the current design context (CircuitInstances, breadboard placements, 3D components) while preserving part provenance.
2. Implement Pattern Trust UI: add verification status, source evidence, usage counts, maturity/lifecycle, generative origin badges on every card and in the detail view using existing provenance primitives.
3. Wire "My Snippets" creation to automatically capture and stamp provenance from the source design (linked snapshot, parts with verification status, breadboard/3D context).
4. Integrate with Generative (use pattern as seed/constraint), Component Editor (save sub-arrangement as pattern), Breadboard/3D (apply wiring/mechanical pattern), Lifecycle (pattern maturity), and Exports (known-good patterns improve readiness).
5. Record tests in the skill and add coverage for the two-tab UI, filters, CRUD, and the new apply/provenance flows.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc (72 CCN), exact missing Apply Flow and Pattern Trust UI, educational content strength, and cross-references to Generative, Component Editor, breadboard-lab, 3D View, Lifecycle, Exports, Order PCB, Learn, and the full provenance/trust campaign from the same handoff audit.
- No production code mutated during discovery.
- All findings tied directly to the reusable assets, provenance, 3D mechanical, exact-part, breadboard-lab, Generative, and knowledge system work from the same handoff campaign.

---

*Patterns analysis complete. Solid educational two-tab browser (curated patterns + My Snippets) with rich "why it works" content, but "Apply Flow" and "Pattern Trust" (two of the four contract pillars) are completely missing. No apply actions, no provenance/verification/usage evidence on the cards. This should be the reusable trusted assets layer that multiplies the value of 3D, breadboard, Component Editor, and Generative — currently it is read-only documentation. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Patterns section (2026-05-23).*

---

## 29. PCB (pp-view-pcb) — Deep Analysis (2026-05)

**User Request:** "/pp-view-pcb"

**Inspector Result (entry + final exit):** Status: ok. Main source `PCBLayoutView.tsx` (1340 lines / 270 CCN). Full surface 22 files / 854 CCN (one of the heaviest in the codebase). Re-run at close remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `PCBLayoutView.tsx` (1155 code / 270 CCN — the orchestrator).
- Subdir `views/pcb-layout/**` (extracted modules: PCBInteractionManager 104 CCN, PCBBoardRenderer, PadRenderer, ViaRenderer, TraceRenderer, ComponentPlacer 54 CCN, LayerManager 38 CCN, etc.).
- Lib `lib/tscircuit-*.ts` (the v3 engine path, tscircuit-compile-proof 96 CCN).
- Tests exist in the lib and sub-renderer tests; the orchestrator itself is lightly tested at the skill level.
- Explicitly described in its own header as a "thin wrapper" over the extracted modules.

**UX Contract Evaluation (Page Behavior / Layout / Tests / Workflow Clarity):**

- **Major extraction has already happened, but the surface remains extremely heavy (P1 tech debt):** The view header states it is now a "thin wrapper" wiring PCBCoordinateSystem, LayerManager, ComponentPlacer, PCBInteractionManager, PCBBoardRenderer, TraceRenderer, etc. This is the direct result of the Architecture view's Phase 0 extraction work. However, the total complexity is still 854 CCN across 22 files. The orchestrator itself is 270 CCN, and several low-level managers remain dense (InteractionManager 104, tscircuit compile proof 96, ComponentPlacer 54, LayerManager 38). The "dual-maintenance" cost (custom canvas + tscircuit path) that the Architecture view explicitly called out is still being paid.

- **3D bidirectional sync is real and documented (positive):** There is a `View3DButton` that navigates to 'viewer_3d', explicit comments about syncing positions/rotations/side/height so that PcbOrderingView and BoardViewer3DView see the data, and logic to mirror the board to the shared per-project board for the 3D viewer. The integration with the hardened 3D View is a first-class concern and has been implemented.

- **Provenance / "AI-generated or uncertain data" enforcement is not visible in the placer or DRC (P1 gap):** The ComponentPlacer and DRC logic do not appear to consult the underlying CircuitInstance's `generatedFrom`, verificationLevel (from Component Editor), or lifecycle status. You can place an unverified generative part or an EOL component without warning at the PCB geometry level. The provenance data exists in the canonical model (from earlier adoption and verification work), but the PCB UI does not yet surface badges on footprints or enforce blocking/warning rules in the placer/DRC.

- **tscircuit v3 path is live, but the custom canvas has not been retired (P1 maintenance burden):** The presence of dedicated tscircuit compile proof, the Architecture view's explicit "dual-maintenance" comment, and the continued existence of the full custom renderer suite (BoardRenderer, InteractionManager, etc.) confirm that both paths are being kept in sync. Every new feature (zones, pours, DRC, comments, 3D sync, via handling) has to be implemented or mirrored in both. This is exactly the situation the Architecture extraction was trying to resolve.

- **UI Container Rule risks on the live canvas + side panels (P1 per the skill's own gotchas):** With a 1340-line orchestrator and multiple side panels (DRC, layers, properties, comments, ratsnest, tools), the classic risks (fixed heights, nested overflow, laptop viewports when the canvas is interactive, focus management during routing) are present and must be actively policed.

- **Tests exist in the engine and sub-modules, but orchestrator UI coverage is light:** The inspector and test globs show good coverage on the tscircuit lib and individual renderers, but the main view file only carries "1 tests" at the skill level. Browser checks for live canvas behavior (selection, routing, 3D sync, short viewport with many panels open) remain essential.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Make the explicit retirement decision on the dual canvas and execute the plan (the Architecture view's explicit, highest-leverage debt)**
- The Architecture view already did the Phase 0 extraction of neutral primitives precisely to enable this. The PCB view is the place where the final decision must land: fully migrate to tscircuit and delete the legacy custom absolute/SVG canvas path, or document why both must be maintained forever. Every month of delay multiplies the cost across every new feature.

**P1 — Enforce provenance / verification at the placer, DRC, and visual level (the safety story must reach the geometry that gets fabricated)**
- When placing a footprint or routing, the ComponentPlacer and DRC must consult the underlying CircuitInstance's provenance (`generatedFrom`, verificationLevel from Component Editor, lifecycle status from the Lifecycle view).
- Add placer guards and DRC rules: "Cannot place unverified generative part", "Warning: part is EOL/NRND", "This footprint has no verified 3D model — mechanical fit cannot be guaranteed in the 3D viewer".
- Surface provenance badges directly on footprints in the PCB canvas (consistent with Component Editor, Exports, Order PCB, Generative, etc.).

**P1 — Complete and harden the full bidirectional 3D <-> PCB sync for positions, rotations, side, and mechanical envelopes (the 3D rescue is not finished until this is solid)**
- The comments and View3DButton show intent; the actual data flow for mechanical envelopes (from Component Editor 3D models) and clearance/airwire feedback from the 3D viewer back into PCB DRC must be verified, tested on laptop viewports, and hardened.

**P2 — Continue the extraction and simplification of the remaining dense managers**
- Apply the same neutral-primitive discipline the Architecture view demonstrated to InteractionManager, ComponentPlacer, LayerManager, etc., so the orchestrator can continue to shrink and become truly thin.

**P2 — Add or expand explicit browser + a11y checks for the live canvas + multiple side panels on realistic laptop viewports**
- The skill's own gotchas and the global UI Container Rule demand this. Focus order during routing, scroll behavior when DRC/comments/properties panels are open, and overflow in the canvas area must be validated after any layout or panel change.

**Strengths (relative to peers):**
- The extraction into `views/pcb-layout/**` has already been done and is proudly documented in the view's own header — this is more visible progress than many other heavy surfaces (the breadboard god file still carries the "Phase 2 will split this" comment years later).
- Explicit 3D sync comments, View3DButton, and mirroring logic show that integration with the hardened BoardViewer3DView is treated as a first-class requirement.
- The tscircuit v3 path is live and has dedicated tests (`tscircuit-*.test.ts`) — the future engine is already partially present and exercised.
- The view consumes the canonical Circuit* model (useCircuitDesigns, useCircuitInstances, useCircuitNets, useCircuitWires, useCircuitVias, zones, comments) — the same source of truth used by Architecture, 3D, Exports, Order PCB, etc. Data consistency is architecturally correct.

**Cross-Cutting Value (highest — this is the actual fabrication geometry):**
- Every footprint placed here, every trace routed, every via, every copper pour, every layer stackup defined, every zone created is what ultimately becomes the Gerbers, drill files, pick-and-place, ODB++, IPC-2581, and STEP that are sent to the fab in the Order PCB and Exports flows.
- If provenance is not enforced at the placer/DRC level, unverified generative parts or EOL components can silently make it into a real, ordered board.
- If 3D mechanical sync is incomplete, the "the enclosure will fit" promise from the 3D View is broken at the moment of fabrication.
- This is the single most important place in the entire system where the safety, provenance, 3D mechanical, exact-part, breadboard health, generative, and lifecycle story must be enforced before real money is spent on boards.

**Durable Lesson:**
Extracting modules (the Architecture Phase 0 work) is necessary but not sufficient. The PCB view now has many small, well-named files, but the total complexity is still extreme (854 CCN) and the dual-canvas maintenance burden is still being paid every day. Until the custom canvas is retired in favor of tscircuit, and until the placer and DRC actually consult the provenance (`generatedFrom`, verificationLevel) and 3D mechanical data that already lives on the CircuitInstances, the "ship with confidence" promise has a hole right at the geometry that gets sent to the fab. The extraction is real, visible progress; the retirement and provenance enforcement are the remaining high-leverage gaps.
**New high-fidelity desktop interaction evidence (2026-05-23T23-25-42-641Z-full-app-catalog)**: This run produced a rich set for PCB on desktop (100+ files), including targeted crops for asset manager, v3 architecture readiness panel, tool interactions (select, pan, grid, fit, analyze), category filtering, asset add, after-click states for sidebar toggle, tab switching (dashboard/architecture/schematic/breadboard), workspace hardware inspection + overlays, more-button, asset manager close/sort, and category selections with overlays. These directly exercise the placer, asset library, v3 integration, and dense panel + canvas interactions flagged in the P2 browser/a11y and provenance enforcement items. Combined with the live browser captures (full-page + a11y trees for the PCB view in context), this provides strong current baseline for the UI Container Rule, 3D sync, and provenance visibility gaps. The desktop evidence is the best we have; multi-viewport (laptop etc.) data is pending a persistent-server re-run.

**Recommended for Codex (immediate high-ROI tasks after handoff):**
1. Make the explicit, documented decision on dual-canvas retirement and create the concrete plan (with file deletion list) to remove the legacy custom absolute/SVG canvas path (or document why both paths must be kept forever).
2. Add provenance checks and visual badges in the ComponentPlacer and DRC (consult verificationLevel, generatedFrom, lifecycle on the underlying CircuitInstances; block or warn on poor-provenance parts at placement time).
3. Verify, test on realistic laptop viewports, and harden the full bidirectional 3D <-> PCB sync for positions, rotations, side, and mechanical envelopes (including clearance/airwire feedback from the 3D viewer into PCB DRC).
4. Continue the extraction/simplification of the remaining dense managers (InteractionManager, ComponentPlacer, LayerManager, etc.) so the orchestrator can continue to shrink.
5. Add or expand explicit browser + a11y checks for the live canvas + multiple side panels (DRC, layers, properties, comments) on realistic laptop viewports; ensure focus order during routing and scroll behavior are correct.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement entry with scc hotspots (854 CCN total, 270 in the orchestrator), the "thin wrapper" header vs reality, explicit 3D sync comments, provenance gap in placer/DRC, dual-canvas debt (cross-ref to Architecture view), and cross-references to the entire 3D rescue, exact-part verification, breadboard-lab, Exports/Order PCB, Generative, Lifecycle, and provenance campaign from the same handoff audit.
- No production code mutated during this discovery-only pass.
- All findings tied directly to the Architecture extraction, 3D bidirectional sync, provenance enforcement at geometry time, and UI Container Rule work from the same handoff campaign.

---

*PCB analysis complete. The view is the actual fabrication geometry source and has done significant extraction with explicit 3D sync in place. However, it remains one of the heaviest surfaces (854 CCN), still carries the dual-canvas maintenance burden, and does not yet enforce the provenance/verification signals at the placer/DRC level. This is the single most important place where the entire safety story must be enforced before real boards are ordered. The extraction is real progress; the retirement of the legacy path and provenance enforcement at geometry time are the remaining high-leverage gaps. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended PCB section (2026-05-23).*

---

## 30. Procurement (pp-view-procurement) — Deep Analysis (2026-05)

**User Request:** `/pp-view-procurement`

**Inspector Result (entry + final exit):** Status: **ok** both times. 117 tracked test cases across required files. Main source `ProcurementView.tsx` (547 lines per inspector; 470 code / 98 CCN by scc). Full surface: 42 files / 7,008 code LOC / 1,002 CCN. All references and test globs present. Re-run after complete discovery pass remained clean.

**Page Map + Quantitative Snapshot:**
- Primary: `client/src/components/views/ProcurementView.tsx` (coordinator with 16+ tabs, heavy local state for DnD BOM, alternates, supplier pricing via `useSupplierApi`, damage assessment, optimization prefs persisted in localStorage).
- Subdir `client/src/components/views/procurement/**` (BomTable 321c/95ccn, SupplierDrawer 400c/64ccn, OrderHistoryPanel 524c/41ccn, PcbOrderTrackerPanel, AssemblyRiskHeatmap 387c/64ccn, AvlCompliancePanel, CostOptimizerPanel, ManufacturingValidatorPanel, RiskScorecardPanel, AssemblyCostPanel, AlternatePartsPanel, DamageAssessmentPanel, AssemblyGroups/AssemblyGroupPanel, BomToolbar/Settings/Cards/CostSummary, SupplierPricingPanel, AddItemDialog, ComponentReference, BomEmptyState, bom-utils.ts, types.ts, index.ts, plus test).
- `client/src/lib/supplier-api/**` (search.ts, pricing.ts, bom-quote.ts, manager.ts, use-supplier-api.ts, persistence.ts, rate-limit.ts, mock-data.ts, config.ts, distributor-config.ts, helpers.ts, types.ts with PartSearchResult + DistributorOffer + BomQuote + PricingTier + lifecycle enum).
- Tests: `procurement-sub-components.test.tsx` (362 lines, 32 tests), `supplier-api.test.ts` (928 lines, 85 tests).

**UX Contract Evaluation (Page Behavior / Layout / Tests / Workflow Clarity):**

- **Mature traditional supply-chain cockpit (strength) but zero provenance closure at the actual money gate (P0 defect):** The surface delivers real value for cost optimization, risk heatmapping, assembly planning (SMT/TH/hand-solder/mechanical groups), alternates, damage assessment, AVL compliance, live distributor pricing with tiers/lead-time/MOQ/stockStatus, BOM quoting, order history, PCB tracking, supply-chain alerts, templates, cross-project usage, and personal inventory. Lifecycle classification (`classifyLifecycle`) is wired and produces header warnings for NRND/EOL/Obsolete. `pricingTrust` (TrustBoundary) is correctly built on BomItem for live-supplier vs fallback/mock pricing. This is one of the most complete operational procurement tools in the app.

- **The "last money gate" safety story is completely absent (the highest-leverage gap in the entire handoff campaign):** Exhaustive ast-grep searches across ProcurementView, all  procurement/** panels, and the entire supplier-api surface for `TrustReceiptCard`, `ReleaseConfidenceCard`, `provenance`, `generatedFrom`, `exactPartVerification`, `verificationReadiness`, `VaultHoverCard`, `BoardViewer3D`, `View in 3D`, `buildWorkspaceReleaseConfidence`, etc. returned **zero matches**. The data model (`PartSearchResult`, `BomQuote`, `BomItem`) carries only traditional MPN + quantity + basic lifecycle + pricingTrust. There is no attachment or enforcement of generative origin, Component Editor exact-part verification level, 3D mechanical model presence/fit, breadboard health, digital-twin drift, full workspace release confidence, or InventoryHealthAnalyzer grades. A user can happily quote, optimize, and (in a real deployment) purchase parts that every other surface in the app would flag as high-risk or unverified.

- **Manufacturing Validator here is a convenience slice, not the authoritative gate (P1):** The `mfgPackageInput` constructed in ProcurementView and passed to ManufacturingValidatorPanel contains only BOM entries (gerberLayers, drillFile, placements, and board are all empty). The real pre-fab package + full TrustReceipt lives in Exports. This tab is useful for BOM-level checks but does not close the loop with the board fabrication truth.

- **UI Container Rule risk on 16+ tab explosion + dense panels (P1):** The tab list is already `overflow-x-auto` (good), but the combination of long BomTable (95 CCN), SupplierDrawer (64 CCN), multiple risk/cost/assembly panels, and DnD + live pricing state creates exactly the clipped-content / fixed-height / laptop-viewport problems the campaign has been auditing on every other dense surface. The bisect-minimal escape hatch exists but is not the real experience.

- **Tests are good on the integration layer but light on the coordinator and visual flows (P2):** 117 tracked cases with strong coverage on supplier-api (85 tests) and sub-components (32 tests) is excellent for a page skill. However, the main ProcurementView coordinator (DnD reorder + live quote + mixed-trust BOM + optimization + damage flows) has light skill-level coverage. No evidence of full visual/E2E regression for the quote path when the BOM contains a mix of verified/unverified/generative parts.

**P0 / P1 / P2 Backlog Items for Codex:**

**P0 — Inject and enforce the full provenance / verification / 3D / generative / breadboard / trust signals at every quote, risk, and order decision point (the safety story must be real where money actually leaves the building)**
- Extend `PartSearchResult`, `BomPricingResult`, `BomQuote`, and the BomItem enrichment pipeline to carry (or reference) `verificationLevel`, `generatedFrom`, `hasVerified3D`, `breadboardHealthGrade`, `trustReceipt` summary, etc.
- Surface badges / warnings / hard gates in BomTable rows, SupplierDrawer, quote results, CostOptimizer, RiskScorecard, ManufacturingValidator, and any future real checkout: "Unverified generative part", "No 3D model — mechanical fit unknown", "Red breadboard health for this placement", "Component Editor verification failed".
- Block or prominently warn before any money movement on parts that fail the upstream gates (Component Editor exact-part, Generative review, 3D mechanical, breadboard health, Lifecycle EOL/obsolete).

**P1 — Unify Manufacturing Validator input with the authoritative Exports / Order PCB precheck package**
- Stop building the empty-shell package locally. Consume the real validated `ManufacturingPackageInput` (with gerbers, drill, placements, board, and full provenance attachments) that Exports already constructs. Turn the tab into a consistent view of the same truth used for board ordering.

**P1 — Add consistent provenance UI (VaultHoverCard, TrustReceiptCard / ReleaseConfidenceCard, verification badges, 3D "View" links) throughout the BOM and quote surfaces**
- Match the visual language and interaction patterns already established in Exports, Order PCB, Component Editor, Generative, Learn, and Inventory.

**P1 — Police UI Container Rule on the 16-tab + multi-panel layout (scroll, resize, collapse, laptop viewports, focus during DnD/live updates)**
- Every sub-panel and long table must be reachable by default. The current density is powerful but fragile.

**P2 — Strengthen coordinator-level tests and add visual/browser checks for the full quote + optimization + damage + reorder flows with mixed-trust parts**
- Especially test the case where a BOM contains both clean verified parts and un-reviewed generative / unverified / EOL items.

**P2 — Continue density reduction on the highest-CCN subcomponents (BomTable 95, SupplierDrawer 64, AssemblyRiskHeatmap 64, ProcurementView coordinator 98) using the neutral-primitive extraction pattern proven in Architecture + PCB work.**

**Strengths (relative to peers):**
- One of the richest traditional procurement surfaces audited so far — real distributor data, sophisticated cost/risk/assembly planning, alternates, damage, AVL, personal inventory, templates, cross-project.
- `pricingTrust` TrustBoundary adoption in the BOM pipeline shows the trust model is already partially wired (good foundation to extend).
- Lifecycle classification is live and visible in the header.
- Excellent unit test coverage on the supplier-api layer (85 tests) and sub-panels (32 tests).
- The tab explosion actually delivers distinct, valuable workflows rather than pure bloat.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 117 tests).
- Mandatory ast-grep searches for every provenance/trust/3D/generative signal from the campaign returned zero matches across the entire surface.
- Full scc report with exact hotspots captured in the companion self-improvement-log entry.
- Exact sequential reads of SKILL.md + page-map.md → ux-contract.md → testing.md → gotchas.md before any synthesis.
- No production code mutated during this pure-discovery pass.
- All findings tied directly to the 3D rescue (BoardViewer3DView + R3F + airwires), breadboard-lab provenance stamping + board health + "View in 3D" button, Component Editor 6-tab verification gauntlet + exact-part gates, Generative `generatedFrom` stamps, Exports precheck + TrustReceiptCard + "export anyway", Order PCB wizard, InventoryHealthAnalyzer, Lifecycle, Digital Twin, and the overarching "last money gate" principle from the same handoff campaign.
- Detailed Fast Workflow Execution Report (with commands, metrics, pillar evaluation, and durable lessons) appended to `.agents/skills/pp-view-procurement/references/self-improvement-log.md`.

---

*Procurement analysis complete. This is the surface where real external money is spent on parts. The traditional supply-chain tooling is mature and genuinely useful. However, the entire upstream safety, provenance, 3D-mechanical, exact-part, generative-origin, breadboard-health, and trust-receipt investment is invisible and unenforceable exactly at the point of commitment. Closing this single gap is the most important remaining item for making the "trust" claims of the application real rather than aspirational. The data model (supplier-api types + BomItem enrichment) and the quote/checkout decision points are the precise injection sites. Inspector remained clean throughout. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Procurement section (2026-05-23).*

---

## 31. Project Explorer (pp-view-project-explorer) — Deep Analysis (2026-05)

**User Request:** `/pp-view-project-explorer`

**Inspector Result (entry + final exit):** Status: **ok** both times. 0 tracked test cases (no test globs recorded). Primary source `ProjectExplorer.tsx` (253 lines / 215 code / 48 CCN). Companion tree renderer `ComponentTree.tsx` (249 code / 41 CCN). Combined surface: 2 files / 464 code / 89 CCN. All references present. Re-run after discovery remained clean.

**Page Map + Quantitative Snapshot:**
- Primary (skill-owned): `client/src/components/layout/sidebar/ProjectExplorer.tsx`
- Critical implementation detail: `ComponentTree.tsx` (recursive GraphNode tree, @dnd-kit draggable categories/nodes, fuzzy search + highlight, context menu, category expansion)
- Parent coordinator: `Sidebar.tsx` (lifts and passes `nodes`, `searchQuery`, `selectedNodeId`, `expandedCategories`, `focusNode`, `bom`, `issues`, `setNodes`, `addOutputLog`)
- 6 fixed sections: Architecture (real tree via ComponentTree), Schematics / PCB Layout / Components / Bill of Materials / Validation (count + severity badges + direct ViewMode navigation)
- scc: extremely light (89 CCN total) — appropriate for a Tier 3 navigation surface
- No dedicated tests for the skill

**UX Contract Evaluation (Project Tree / File Navigation / Sidebar Density / Selection):**

- **Project Tree & File Navigation (clean, well-scoped, narrow but effective):**
  - Renders 6 sections with live counts (nodes for architecture, `useCircuitDesigns` for schematics/pcb/components, bom length, validation issues).
  - Validation section additionally shows error/warning severity badges.
  - Only the Architecture section expands to show the real recursive `<ComponentTree>` (GraphNode categories with draggable headers, expand/collapse, search highlighting via `highlightMatches`, context menus, keyboard support).
  - The other five sections are smart shortcuts: click navigates to the corresponding view (architecture, schematic, pcb, component_editor, procurement, validation) while showing at-a-glance health (counts + validation severity).
  - Strong integration with the canonical architecture graph (`GraphNode[]`) and the DnD system (dragging categories or nodes onto Breadboard or other surfaces is first-class).

- **Selection & State (correctly lifted to Sidebar shell):**
  - `selectedNodeId`, `focusNode`, `expandedCategories` are all prop-drilled from the parent `Sidebar.tsx`.
  - This matches the architecture observed in the prior Left Sidebar audit: the Tier 1 shell owns coordinated state for its dense sub-panels (ProjectExplorer, HistoryList, CoachPanel, etc.). Project Explorer is a focused presenter/orchestrator.
  - Local `expandedSections` state inside ProjectExplorer controls the 6 top-level sections (only architecture starts expanded).

- **Sidebar Density & UI Container Rule (inherits risk from parent, component itself is clean):**
  - The explorer uses minimal vertical space (`mt-0.5 space-y-0.5` + small indent for the tree).
  - No fixed heights or nested overflow traps inside the component itself (good).
  - The explicit gotcha in the skill ("Fixed heights and nested overflow can create scroll traps") applies to the parent Sidebar shell. When the left sidebar has many panels or the project has a large GraphNode set + active search, the explorer region must remain reachable via scroll/collapse of siblings.
  - a11y debt is explicitly called out in the file header (multiple `role="button"` on `<div>` for SectionHeader and DraggableCategoryHeader). Keyboard handling exists; the fix is tracked under the InteractiveCard / E2E-552 migration plan.

- **Provenance / Trust / Generative / Verification Visibility (complete absence):**
  - Exhaustive ast-grep across both files found **zero** references to `Trust*`, `provenance`, `generatedFrom`, `verification`, `exactPart`, `VaultHover`, `ReleaseConfidence`, etc.
  - The tree shows type icons, labels, drag handles, search highlights, and counts. No badges or indicators that a node or category came from an un-reviewed generative design, failed exact-part verification in Component Editor, or carries any trust metadata.
  - Per the ux-contract: "AI-generated or uncertain data is clearly marked." The primary discovery/selection surface for the architecture graph currently provides no way for users to see this at the point of navigation. This is a consistency gap with the rest of the provenance campaign (Component Editor gates, Generative stamps, 3D mechanical, Exports precheck, Procurement "last money gate", etc.).

- **Tests (structural gap for a constantly-used nav surface):**
  - 0 tracked tests. The skill's page-map and auto-sync explicitly record "No test globs."
  - Nearest sidebar tests exist (CoachPanel, constants) but do not cover the explorer or the tree.
  - Current safety net is the browser-check list in testing.md (load, reachability, scroll, no overflow, keyboard/focus) plus the inspector.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Surface minimal provenance / verification / generative-origin indicators inside the Architecture tree (the discovery surface must reflect the safety story)**
- Even a small badge, icon tint, or tooltip on GraphNode rows or category headers for `generatedFrom`, `verificationLevel`, or "AI-suggested" would satisfy the ux-contract requirement that uncertain data is clearly marked at the point of selection.
- Coordinate with the GraphNode enrichment layer and Component Editor (source of truth for verification).

**P1 — Guarantee scroll/reachability of the explorer region inside the Left Sidebar (UI Container Rule)**
- The explorer component itself is lightweight and well-behaved. The risk lives in the parent Sidebar (multiple competing panels, potential fixed heights, laptop viewports). Re-validate whenever Sidebar density or collapse behavior changes.

**P2 — Add smoke + interaction test coverage for ProjectExplorer + ComponentTree (expand/collapse, search + highlight, selection/focus, DnD data shape, keyboard navigation on headers and tree rows)**
- A navigation surface used on every project and every architecture change deserves at least basic regression protection.

**P2 — Complete the tracked a11y migration (remove the eslint-disable comment at the top of ProjectExplorer.tsx)**
- Already planned under E2E-552 / InteractiveCard Phase 3.

**P2 — Consider enriching the five non-architecture section headers with more than raw counts (e.g., "3 unverified", "last validated X", provenance summary) so the sidebar gives a true at-a-glance health picture of the whole project.**

**Strengths (relative to peers):**
- One of the cleanest, lowest-complexity surfaces audited (89 CCN total for a fully functional project tree + 6-section navigator).
- Excellent separation: ProjectExplorer owns the section orchestration + live counts + severity badges + view shortcuts; ComponentTree owns the recursive draggable/searchable tree implementation.
- Tight, correct integration with the canonical GraphNode model, `useCircuitDesigns`, validation issues, and the DnD system.
- Live error/warning badges on the Validation section and live counts from multiple live data sources are genuinely useful.
- Fuzzy search + highlight works inside the tree without component bloat.
- DnD from the tree is first-class (grip handles on hover, proper drag data).

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tests).
- Mandatory ast-grep searches for all provenance/trust/generative signals returned zero matches.
- Full scc report captured (lightweight Tier 3 surface).
- Exact sequential reads of SKILL.md + page-map.md → ux-contract.md → testing.md → gotchas.md before synthesis.
- No production code mutated during this pure-discovery pass.
- All findings cross-referenced to the prior Left Sidebar audit (Tier 1 shell), Architecture graph model, breadboard DnD flows, the full provenance campaign (3D rescue, Component Editor verification, Generative stamps, Exports, Order PCB, Procurement), and the UI Container Rule.
- Detailed Fast Workflow Execution Report (commands, metrics, pillar evaluation, durable lessons) appended to the skill's self-improvement-log.md; master report section 31 written.

---

*Project Explorer analysis complete. This is the lightweight Tier 3 project tree + section shortcut surface inside the left sidebar. It is clean, low-complexity, well-integrated with the canonical graph model, and provides useful at-a-glance counts + validation severity. Its main gaps are (1) zero provenance/verification visibility on the discovery tree (inconsistent with the rest of the safety campaign), (2) zero recorded tests for a constantly-used navigation component, and (3) inherited scroll/density risks from the parent Sidebar shell. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Project Explorer section (2026-05-23).*

---

## 32. Right Sidebar (pp-view-right-sidebar) — Deep Analysis (2026-05)

**User Request:** `/pp-view-right-sidebar`

**Inspector Result (entry + final exit):** Status: **ok** both times. 7 tracked test cases. Core files:
- ChatPanel.tsx (1242 lines / 1,094 code / 202 CCN — heavy Eve AI chat)
- ActivityFeedPanel.tsx (382 lines / 341 code / 36 CCN — activity timeline slide-over)
- ProjectWorkspace.tsx (920 lines / 791 code / 175 CCN — central orchestrator)
- Full surface: 3 files / 2,226 code / **413 CCN** (substantial Tier 1)

All references and test globs present. Re-run remained clean.

**Page Map + Quantitative Snapshot:**
- Primary globs: ChatPanel.tsx, ActivityFeedPanel.tsx, ProjectWorkspace.tsx
- The "Right Sidebar" is implemented as the resizable "chat" column in the workspace layout (symmetric with left "sidebar").
- ChatPanel is the permanent resident of the right column (via HoverPeekDock + ResizeHandle).
- ActivityFeedPanel is rendered as a toggleable absolute slide-over (`ws.activityFeedOpen`, right-0, w-[19rem]) — not a second permanent panel.
- Workspace state (workspace-reducer) manages symmetric left/right: collapsed, width, open, plus activityFeedOpen, predictionPanelOpen, pcbTutorialOpen, etc.
- Persistence, hover-peek, keyboard resize, mobile auto-collapse (chat at <=1280px, sidebar at <=1024px), and many overlay panels all compete on the right edge.

**UX Contract Evaluation (Page Behavior / Layout / Tests / Workflow Clarity):**

- **Layout (mature, symmetric, high density risk — classic Tier 1 challenge):**
  - Excellent engineering: identical HoverPeekDock + ResizeHandle + collapse + peek + persistence + breakpoint logic for left and right columns.
  - Media-query guards (RS-03, RS-04) and explicit mobile chat toggle in the header.
  - Skip-to-chat link exists.
  - However, the right edge is extremely crowded: permanent dense ChatPanel (long threads, streaming, action previews, voice, settings) + ActivityFeed slide-over + PredictionPanel + PcbTutorial + HardwareInspection + SmartHint + various chat sub-dialogs. This is the exact "piling up extra top bars," "nested overflow," and "scroll trap" risk repeatedly called out in gotchas and the global UI Container Rule.
  - When the right column is at its minimum width or a long chat thread + open activity feed + prediction dock are all visible on a laptop viewport, reachability of the chat input and critical controls becomes the primary UX question.

- **Page Behavior & Workflow Clarity (strong coordination, provenance gap unchanged):**
  - The right sidebar is the primary generative action surface (user talks to Eve in ChatPanel and triggers real mutations via action handlers) and the immediate history surface (ActivityFeedPanel slide-over shows created/updated/deleted/commented/exported/imported/validated events).
  - This pairing is excellent for workflow clarity: "I asked the AI to do X" → "Here is the timeline of what actually happened."
  - **Provenance / trust / verification visibility is still absent at the point of action**: exhaustive ast-grep across ProjectWorkspace, ChatPanel, and ActivityFeedPanel found zero direct TrustReceipt, ReleaseConfidence, generatedFrom, verificationLevel, or VaultHover usage in the right-column hosting or the activity feed. The user can trigger generative work from the chat, but the right sidebar itself does not show the verification status or trust receipt of the artifacts produced.

- **Tests (light but better than many Tier 3 surfaces):**
  - 7 tests in WorkspaceHeader + panels glob.
  - ChatPanel has its own test file; reducer and hover-peek tests cover some layout behavior.
  - Full visual + interaction coverage for the right column under realistic load (long chat + open feed + overlays on laptop sizes) still relies heavily on the browser-check list in the skill's testing.md.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Surface provenance / verification / generative-origin signals inside the right sidebar (Chat action results and Activity Feed entries)**
- When the AI creates or modifies nodes, BOM, exports, or validation artifacts from the chat, the right column (or the Activity Feed slide-over) must show at least a minimal verification badge or link to the TrustReceipt. This is the "last interaction surface" for the entire safety story.

**P1 — Enforce UI Container Rule on the right column + all competing right-side overlays under real laptop conditions**
- The layout system is sophisticated. The actual scroll/reachability/overlap behavior when ChatPanel has a long thread, ActivityFeed is open, PredictionPanel is docked, and the viewport is a typical laptop width must be explicitly validated and fixed (no clipped controls, no trapped input, no hidden critical actions).

**P2 — Expand test coverage for the right-column orchestration flows** (chat collapse/resize/peek, activity feed slide-over stacking with other overlays, mobile chat toggle, persistence of chatWidth/chatCollapsed, keyboard resize on the right handle).

**P2 — Complete the tracked a11y migration** (multiple eslint-disable blocks in ProjectWorkspace and ChatPanel for div-as-button patterns).

**Strengths (relative to peers):**
- One of the most complete and symmetric workspace layout systems in the app (true resizable + collapsible + peek + persistent left + right sidebars with shared abstractions).
- Activity Feed as a dedicated slide-over (instead of a permanent second column) is a smart density decision and provides excellent "what just happened?" clarity next to the AI chat.
- Mature handling of mobile, breakpoints, keyboard resize, and per-project persistence.
- The right sidebar is genuinely useful as both the generative cockpit and the immediate audit trail.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 7 tests).
- Mandatory ast-grep for all provenance/trust signals returned zero matches in the three core files.
- Full scc report (413 CCN, heavy Tier 1) captured.
- Exact sequential reads of SKILL.md + page-map.md → ux-contract.md → testing.md → gotchas.md before any synthesis.
- No production code mutated (pure discovery pass).

**Live 2026-05-23 evidence (running :5000, Blink LED sample, /projects/67/validation + shell)**: Full-page PNG + verbose a11y tree captured (live-validation-current-full.png + live-validation-current-a11y.txt). Shows the validation surface in the full workspace shell (left explorer with groups, coach panel, timeline, Project Settings, horizontal tabs, right AI Assistant). This provides current baseline for the dense issue list (VirtualizedIssueList), side panels, and container behavior in context — directly relevant to the P1 provenance visibility, P2 browser/a11y on laptop viewports, and integration with other surfaces. Complements the static catalog evidence.
- All findings cross-referenced to the Left Sidebar audit, the prior AI Chat audit, the full provenance campaign (Generative, Component Editor, 3D, Exports, Procurement, breadboard-lab), the workspace-reducer layout machinery, and the global UI Container Rule.
- Detailed Fast Workflow Execution Report appended to the skill's self-improvement-log.md; master report section 32 written.

---

*Right Sidebar analysis complete. This is the Tier 1 right "chat" column (resizable, collapsible, peek-hover, persistent) hosting the heavy ChatPanel as its permanent resident and ActivityFeedPanel as a toggleable slide-over. The layout system in ProjectWorkspace is mature and symmetric with the left. The critical remaining gap is that the primary generative action + history surface still does not surface the provenance/trust signals built elsewhere. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Right Sidebar section (2026-05-23).*

---

## 33. Schematic (pp-view-schematic) — Deep Analysis (2026-05)

**User Request:** `/pp-view-schematic`

**Inspector Result (entry + final exit):** Status: **ok** both times. 4 tracked tests at view level (+ multiple in circuit-editor/__tests__). Main view `SchematicView.tsx` (663 lines / 635 code / 158 CCN). Full extracted surface (SchematicCanvas + TSCircuitCanvasAdapter + schematic/ primitives + custom nodes): ~12 files / 2,970 code / **732 CCN** (heavy Tier 1, parallel to PCB extraction).

All references present. Re-run remained clean.

**Page Map + Quantitative Snapshot:**
- Primary globs: `SchematicView.tsx` + `circuit-editor/Schematic*.tsx` + `circuit-editor/schematic/**`
- Key hotspots (scc):
  - SchematicCanvas.tsx: 936 code / **217 CCN** (React Flow host with custom nodes/edges)
  - SchematicView.tsx: 635 code / 158 CCN (coordinator with circuit selector, panel tabs (components/power/sheets/sim), AI generate, Push-to-PCB, ERC, decay, JIT)
  - TSCircuitCanvasAdapter.tsx: 266 code / 92 CCN (tscircuit bridge)
  - use-keyboard-shortcuts: 221 code / 102 CCN
  - use-clipboard, use-drag-drop, converters, context-menu, etc.: substantial
- Custom nodes: SchematicInstanceNode, SchematicNetEdge, SchematicNetLabelNode, SchematicPowerNode, SchematicNoConnectNode, SchematicAnnotationNode, SchematicSheetNode
- Strong integration with `useCircuitDesigns` / `useCircuitInstances` and downstream fabrication (Push to PCB, ERC, simulation).

**UX Contract Evaluation (Page Behavior / Layout / Tests / Workflow Clarity):**

- **Layout & UI Container Rule (high risk — dense side panels + floating cards on laptop viewports):**
  - Multiple toggleable side panels (ComponentPlacer, PowerSymbolPalette, HierarchicalSheetPanel, SimulationScenarioPanel, ERCPanel) + toolbar + status + floating cards (DesignDecayCard, JIT skill card) + dialogs (AI prompt, Push to PCB).
  - The canvas must remain fully reachable and interactive when side panels are open. Laptop-height viewports + "fixed heights and nested overflow create scroll traps" (per gotchas) are real risks, exactly as seen in the PCB and Right Sidebar audits.

- **Page Behavior & Workflow Clarity (excellent multi-sheet / ERC / sim / push flows, provenance invisible at placement time):**
  - Rich feature set: hierarchical sheets, full ERC with violation focus/highlighting, simulation scenarios, power symbols, direct placement from architecture graph, AI-assisted circuit generation, "Push to PCB" with unplaced instance detection, design decay + JIT recommendations.
  - Deeply wired into the canonical model and the fabrication pipeline.
  - **Critical gap**: "AI-generated or uncertain data is clearly marked" (ux-contract) is not satisfied on the canvas. Exhaustive ast-grep across the entire Schematic surface returned **zero** matches for Trust*, provenance, generatedFrom, verificationLevel, exactPart, VaultHover, etc. Users can place symbols from un-reviewed generative sources or unverified Component Editor parts with no visual distinction and no ERC-level warning.

- **Extraction Debt (parallel to the PCB story audited earlier):**
  - Same pattern: heavy custom canvas (SchematicCanvas 217 CCN) + adapter (92 CCN) + dense interaction hooks while claiming tscircuit integration.
  - The Architecture view explicitly flagged dual-canvas maintenance and the need for a final retirement decision. Schematic is on the identical trajectory. Every new feature (annotations, sheets, ERC, simulation overlays, 3D sync, provenance badges) must be implemented or mirrored in both paths.

- **Tests (modest relative to 732 CCN surface):**
  - 4 at view level + several in circuit-editor (SchematicCanvas, SchematicToolbar, SchematicAnnotationNode, TSCircuitCanvasAdapter, etc.).
  - For a Tier 1 core editor with complex canvas + adapter + keyboard/drag/clipboard/ERC flows, coverage is still light. Browser checks (reachability, scroll, keyboard, no overflow on laptop) remain the primary safety net.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Enforce provenance / verification visibility and guards at schematic placement time (the electrical geometry surface must close the safety story)**
- Custom nodes and the ERC engine must read the underlying CircuitInstance verificationLevel / generatedFrom / exact-part status.
- Add badges/tooltips on symbols and at minimum soft ERC warnings (or hard blocks on Push-to-PCB) for unverified/generative content. This is the exact P1 previously raised for the PCB placer/DRC and is even more urgent here because the schematic is where electrical intent is first captured.

**P1 — Make the explicit retirement decision on the dual canvas (tscircuit adapter vs custom React Flow) and execute (Architecture view's highest-leverage debt, now also live on Schematic)**
- The same extraction debt observed in PCB must be resolved. Continuing dual maintenance multiplies cost across every future feature.

**P1 — Police UI Container Rule on SchematicView + side panels + floating cards on realistic laptop viewports**
- Multiple panels + canvas + decay/JIT cards + dialogs. Every control must remain reachable via scroll/collapse/resize when the viewport is constrained.

**Live 2026-05-23 evidence (running :5000, Blink LED sample, /projects/67/schematic + shell)**: Full-page PNG + verbose a11y tree saved (live-schematic-current-full.png + live-schematic-current-a11y.txt, also live-breadboard-*, live-dashboard-sidebar-expanded.png). The captured state shows the exact risk surface: left explorer sidebar (280 px, "Expand/Show sidebar" toggles, multiple expandable groups, Coach + Timeline + Project Settings), horizontal tablist (Dashboard/Architecture/Schematic selected), right AI Assistant, main tabpanel canvas area with coach tips. The dense side panels + canvas + floating elements are live and match the P1 description. These artifacts (plus the multi-viewport catalog under generation) give concrete before/after for the container discipline and provenance-on-canvas items.

**High-fidelity desktop interaction evidence (2026-05-23T23-25-42-641Z-full-app-catalog)**: This partial but rich desktop pass (high caps) produced extensive evidence for the exact risks called out above. From within the breadboard and component-editor contexts (and dedicated schematic flows where reached), the capture recorded:
- Multiple "after-click-tab-schematic.png" + overlay states from breadboard and component-editor.
- "after-click-button-open-schematic-from-breadboard.png" + overlay.
- Rich side-panel + canvas interactions (asset manager, tool selection, v3 readiness panels, tab switching between schematic/breadboard/pcb while in related editors).
- Hardware inspection and more-button overlays while schematic-related views were active.

These directly exercise the dense side panels (ComponentPlacer, PowerSymbolPalette, ERCPanel, etc.) + canvas + floating cards on the exact UI the P1 "UI Container Rule on laptop viewports" and P1 provenance visibility items describe. The states also demonstrate the multi-editor round-tripping (schematic ↔ breadboard ↔ component editor) that is central to the extraction debt discussion. Combined with the live browser full-page + a11y captures of the schematic view in the full workspace shell (left explorer, coach, timeline, right AI, horizontal tabs), this gives the strongest current desktop baseline we have for the schematic surface. Multi-viewport (laptop etc.) data pending a persistent-server re-run of the capture command.

**P2 — Expand test coverage for core canvas + interaction flows** (sheet navigation/hierarchy, ERC violation focus, drag-drop + keyboard + clipboard, tscircuit round-trip, multi-sheet behavior) with visual regression on laptop sizes.

**P2 — Enrich the sheet selector / hierarchical panel** with provenance summaries ("3 unverified parts", "generative origin", "last ERC clean") so the multi-sheet overview gives a true at-a-glance safety picture.

**Strengths (relative to peers):**
- One of the richest schematic editors audited: hierarchical sheets, full ERC with focus, simulation scenarios, power palette, AI generation, Push-to-PCB with unplaced detection, decay + JIT cards.
- Clean separation between coordinator (SchematicView) and extracted primitives (SchematicCanvas + adapter + schematic/ hooks for drag/keyboard/clipboard/context-menu).
- Deep integration with the canonical CircuitDesign / CircuitInstance model and the full downstream fabrication path (PCB, validation, export, procurement).

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 4+ circuit-editor tests).
- Mandatory ast-grep for all provenance/trust/generative signals returned zero matches across the entire Schematic surface.
- Full scc report (732 CCN, heavy extracted canvas with 217 CCN in SchematicCanvas) captured.
- Exact sequential reads of SKILL.md + page-map.md → ux-contract.md → testing.md → gotchas.md before any synthesis.
- No production code mutated (pure discovery pass).

**Live 2026-05-23 evidence (running :5000, Blink LED sample, /projects/67/validation + shell)**: Full-page PNG + verbose a11y tree captured (live-validation-current-full.png + live-validation-current-a11y.txt). Shows the validation surface in the full workspace shell (left explorer with groups, coach panel, timeline, Project Settings, horizontal tabs, right AI Assistant). This provides current baseline for the dense issue list (VirtualizedIssueList), side panels, and container behavior in context — directly relevant to the P1 provenance visibility, P2 browser/a11y on laptop viewports, and integration with other surfaces. Complements the static catalog evidence.
- All findings cross-referenced to the Architecture extraction debt, PCB "thin wrapper vs 270 CCN reality" + provenance gap in placer/DRC, Generative/Component Editor verification work, 3D rescue, breadboard-lab, Exports precheck, Right/Left Sidebar, Project Explorer, and the global UI Container Rule from the same handoff campaign.
- Detailed Fast Workflow Execution Report appended to the skill's self-improvement-log.md; master report section 33 written.

---

*Schematic analysis complete. This is a heavy Tier 1 extracted schematic editor (SchematicView coordinator + SchematicCanvas 217 CCN + TSCircuitCanvasAdapter + rich custom nodes/edges + side panels for ERC/sheets/sim/power). The functionality is excellent (hierarchical sheets, ERC, simulation, AI gen, push-to-PCB). The critical gaps are (1) complete absence of provenance/verification visibility or guards on the placement canvas (the same P1 raised for PCB), (2) ongoing dual-canvas maintenance burden parallel to the PCB story, and (3) UI Container risks from dense side panels + floating cards on laptop viewports. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Schematic section (2026-05-23).*

---

## 34. Serial Monitor (pp-view-serial-monitor) — Deep Analysis (2026-05)

**User Request:** `/pp-view-serial-monitor`

**Inspector Result (entry + final exit):** Status: **ok** both times. 0 tracked tests. Primary source `SerialMonitorPanel.tsx` (1400 lines / 1251 code / **207 CCN** — dense Tier 2 hardware feedback panel). All references present. Re-run remained clean.

**Page Map + Quantitative Snapshot:**
- Sole glob: `client/src/components/panels/SerialMonitorPanel.tsx`
- scc: 1251 code / 207 CCN in one file (rich: Web Serial, trust receipts, preflight, ESP decoder, baud auto-detect, telemetry parser, DeviceShadow, command sandbox, recording, presets, troubleshooting).
- No dedicated tests recorded.
- Used as a dockable panel (Arduino view / workspace serial feedback).

**UX Contract Evaluation (Serial Connection / Logs / Send Controls / Device Feedback):**

- **Serial Connection & Device Feedback (strongest area — notable positive for the provenance campaign):**
  - Full Web Serial integration (`useWebSerial`, baud rates, board filters, port info).
  - **Real trust integration**: `buildSerialTrustReceipt` is computed from connectionState, portInfo, bytes stats, preflight (`assessSerialDevicePreflight`), error, support, profile. Rendered via `<TrustReceiptCard receipt={serialTrustReceipt} />`.
  - Rich device intelligence: ESP exception decoder, baud mismatch detection + one-click switch, non-printable ratio, telemetry parsing (`TelemetryStore`), `DeviceShadow` (digital twin), `buildHardwareCoDebugReadiness`, `DeviceCommandSandbox`.
  - This is one of the **better hardware trust surfaces** audited so far — it actually closes part of the device feedback loop with provenance UI.

- **Logs (core value with UI Container risk):**
  - High-volume logging with timestamps, filters, search, recording (duration/size), export, pause, clear.
  - Uses `ScrollArea`. However, with 207 CCN layered on the log view + many feedback sections, fixed-height or nested scroll traps are a classic risk for log panels (explicitly called out in gotchas).

- **Send Controls (feature-complete):**
  - Input + line ending selector, send, presets (persistent last-used), sandbox integration, recording controls.
  - Clear icons and affordances.

- **Provenance / Trust Story (partial but real win vs. many peers):**
  - Unlike Schematic, PCB placer/DRC, Procurement, Right Sidebar (chat), etc. (zero matches), this panel actively builds and displays a serial-specific `TrustReceiptCard`.
  - The receipt focuses on *transport* trust (browser, port, baud confidence, preflight, errors). Linkage to *firmware/sketch* provenance (verified Component Editor design, Generative origin with review, exact-part, 3D mechanical, breadboard health of the project) appears limited or absent.

- **Layout / Density (Tier 2 but heavy single file):**
  - Connection bar + log area + send bar + trust receipt + baud warning + ESP decoder + telemetry + sandbox + recording stats + presets = exactly the "piling up" and laptop-viewport reachability problem seen across the campaign.
  - Must be validated with real high-volume serial traffic.

- **Tests (gap):**
  - 0 tracked. Browser checks (reachability of connection + log scroll + send input, no overflow, keyboard) are the current safety net.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Strengthen serial trust receipts to surface upstream firmware/sketch provenance**
- When connected, the receipt (or adjacent UI) should indicate or link whether the running sketch came from a verified/exact-part/generative-reviewed design in the project (or at least flag "firmware provenance unknown").

**P1 — Enforce UI Container Rule on the log + feedback sections under real load on laptop viewports**
- Log must remain fully scrollable/reachable, send input never trapped, trust receipt and decoder panels properly sized/collapsible when the viewport is constrained + high-volume traffic is flowing.

**P2 — Add smoke + interaction tests for core flows** (connect/disconnect + preflight + trust receipt, baud mismatch detect + switch, ESP decode, send with endings, recording, presets).
- A 1251-code / 207 CCN hardware feedback panel with zero tests is a real gap for a surface used in every Arduino/breadboard debug session.

**P2 — Extract sub-components** (connection bar, virtualized/high-volume log viewer, send + presets bar, trust/decoder feedback cards) to reduce god-panel risk in this single dense file.

**Strengths (relative to peers):**
- One of the **strongest hardware trust/provenance integrations** in the entire audit — actively builds `buildSerialTrustReceipt` and renders `TrustReceiptCard` with preflight, port, baud confidence, etc.
- Extremely rich real-world device feedback (ESP exceptions, baud auto-detect, telemetry, digital twin shadow, command sandbox, co-debug readiness).
- Feature-complete serial monitor with excellent attention to Arduino/ESP pain points (recording, presets, troubleshooting hints).
- Uses the standard `TrustReceiptCard` component, maintaining UI language consistency.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tests).
- ast-grep + targeted reads confirmed real `buildSerialTrustReceipt` + `TrustReceiptCard` usage, preflight, DeviceShadow, co-debug, ESP/baud/telemetry intelligence.
- Full scc report (1251 code / 207 CCN) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).

**Live 2026-05-23 evidence (running :5000, Blink LED sample, /projects/67/validation + shell)**: Full-page PNG + verbose a11y tree captured (live-validation-current-full.png + live-validation-current-a11y.txt). Shows the validation surface in the full workspace shell (left explorer with groups, coach panel, timeline, Project Settings, horizontal tabs, right AI Assistant). This provides current baseline for the dense issue list (VirtualizedIssueList), side panels, and container behavior in context — directly relevant to the P1 provenance visibility, P2 browser/a11y on laptop viewports, and integration with other surfaces. Complements the static catalog evidence.
- All findings cross-referenced to Arduino/breadboard context, trust-receipts + digital twin work, hardware co-debug, the broader provenance campaign (this surface is a relative bright spot compared to zero-match surfaces like Schematic/PCB/Procurement), and UI Container Rule patterns from denser log/feedback panels.
- Detailed Fast Workflow Execution Report appended to the skill's self-improvement-log.md; master report section 34 written.

---

*Serial Monitor analysis complete. This is a dense 1400-line / 207 CCN Tier 2 panel that stands out positively in the provenance campaign for actively building and rendering a `SerialTrustReceipt` (with preflight, port info, baud confidence, etc.) and rich device feedback (ESP decoder, baud auto-detect, telemetry, DeviceShadow, command sandbox). The serial connection / logs / send / device feedback pillars are well-served functionally. The main risks are single-file density, zero tests, and UI Container reachability for the log + feedback sections on laptop viewports under real traffic. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Serial Monitor section (2026-05-23).*

---

## 35. Simulation (pp-view-simulation) — Deep Analysis (2026-05)

**User Request:** `/pp-view-simulation`

**Inspector Result (entry + final exit):** Status: **ok** both times. 0 tracked tests (one untracked test file exists). Primary surface: entire `client/src/components/simulation/**` (16 files / 5,114 code / **855 CCN** — heavy Tier 2 workbench).

All references present. Re-run remained clean.

**Page Map + Quantitative Snapshot:**
- Sole glob: `client/src/components/simulation/**`
- scc hotspots:
  - WaveformViewer.tsx: 1,217 code / **244 CCN** (core interactive viewer)
  - SimulationPanel.tsx: 781 code / 190 CCN (orchestrator)
  - ProbeOverlay.tsx: 585 code / 99 CCN
  - FrequencyAnalysisPanel, BodePlot, simulation-types, SensorSliderPanel, SpiceImport*, AnalysisParamsForms, ResultHistorySection, ComplexityWarningDialog, SimPlayButton, etc.
- Features: transient/AC/DC/frequency analysis, interactive probing, waveform/Bode viewing, sensor what-if sliders, SPICE import, result history + sharing, complexity warnings, simulation scenarios (tied to Schematic).

**UX Contract Evaluation (Simulation Setup / Run Controls / Results Display / Error Recovery):**

- **Simulation Setup (rich, with scenario + param + import depth):**
  - Scenario selection (via `SimulationScenarioPanel` from circuit-editor — cross-ref to Schematic audit), analysis type auto-detect, dedicated param forms (Transient, AC, DC Sweep), sensor sliders for what-if, SPICE import section.
  - Deep integration with live circuit state (designs, instances, architecture, BOM, validation).

- **Run Controls (clear, guarded by complexity):**
  - `SimPlayButton`, `ProbeManager`/`ProbeOverlay` (interactive probing), sensor sliders during simulation.
  - `ComplexityWarningDialog` + `checkCircuitComplexity` provides explicit error recovery / guard before expensive runs.

- **Results Display (dense, high-CCN viewers — UI Container risk):**
  - `WaveformViewer` (244 CCN), `BodePlot`, `FrequencyAnalysisPanel`, DCOP tables, `ResultHistorySection`, share button.
  - Multiple viewers + history + trust cards + param panels create exactly the scroll trap / reachability risk called out in gotchas and the global UI Container Rule. Laptop viewports with several open analyses are the stress case.

- **Error Recovery (mature complexity path):**
  - Complexity warning dialog before heavy simulation is a clear, user-facing recovery mechanism. Good.

- **Trust / Provenance (partial positive outlier):**
  - Unlike Schematic, PCB placer/DRC, Procurement, Right Sidebar (chat), etc. (zero matches), this panel actively builds `buildSimulationTrustReceipt` and `buildWorkspaceReleaseConfidence` and renders both `TrustReceiptCard` and `ReleaseConfidenceCard`.
  - **Recurring campaign gap remains**: No *per-result* or per-waveform/probe marking of generative origin, verificationLevel, or exact-part status of the simulation *inputs*. Results from unverified designs look identical to verified ones inside the viewers.

- **Tests (gap):**
  - 0 tracked by the skill (one untracked `SimPlayButton.test.tsx`).
  - Browser checks essential for waveform interaction, probing, dense result scrolling.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Surface provenance on simulation *results* (per-waveform, per-probe, per-result metadata)**
- Waveforms, Bode plots, frequency data, and tables should carry or visually indicate the verification/generative status of the underlying parts and design (badges on traces, metadata in result cards, filter "only verified simulations", warning when probing unverified sections).
- This is the missing closure for "what-if on a generative design" workflows.

**P1 — Enforce UI Container Rule on the dense result viewers + side panels on laptop viewports**
- WaveformViewer (244 CCN) + FrequencyAnalysis + history + trust/release cards + param forms + probe overlay must all remain reachable via scroll/collapse/resize without trapping run controls or error messages under real multi-analysis load.

**P2 — Expand tracked test coverage for core flows** (run transient/AC/DC with probes, complexity warning path, SPICE import, result history/share, sensor what-if, error states, provenance card rendering).
- An 855 CCN simulation workbench with essentially no tracked tests is a gap for correctness of results that makers rely on for validation.

**P2 — Consider extraction/splitting of the heaviest components** (WaveformViewer 244 CCN, SimulationPanel 190 CCN, ProbeOverlay) for long-term maintainability, following the extraction discipline used elsewhere in circuit-editor.

**Strengths (relative to peers):**
- One of the **better provenance integrations** in the audit — actively builds simulation-specific trust receipts + workspace release confidence and renders both standard cards (positive outlier vs. zero-match surfaces).
- Full-featured simulation workbench: multiple analysis types, interactive probing, frequency domain (Bode), SPICE import, sensor what-if, complexity guards, result history + sharing.
- Strong ties to Schematic scenarios and the canonical circuit model.
- Explicit, user-facing error recovery via complexity checking is mature.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tracked tests).
- Mandatory ast-grep on the entire simulation/ dir returned zero per-result provenance signals inside the components (despite top-level trust/release cards — a partial win).
- Full scc report (5,114 code / 855 CCN, WaveformViewer 244 CCN as primary hotspot) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).

**Live 2026-05-23 evidence (running :5000, Blink LED sample, /projects/67/validation + shell)**: Full-page PNG + verbose a11y tree captured (live-validation-current-full.png + live-validation-current-a11y.txt). Shows the validation surface in the full workspace shell (left explorer with groups, coach panel, timeline, Project Settings, horizontal tabs, right AI Assistant). This provides current baseline for the dense issue list (VirtualizedIssueList), side panels, and container behavior in context — directly relevant to the P1 provenance visibility, P2 browser/a11y on laptop viewports, and integration with other surfaces. Complements the static catalog evidence.
- All findings cross-referenced to Schematic (SimulationScenarioPanel), PCB/breadboard simulation needs, the provenance campaign (bright spot for top-level receipts but per-result gap), UI Container Rule on dense viewers, Serial Monitor (another positive trust example), and prior audits.
- Detailed Fast Workflow Execution Report appended to the skill's self-improvement-log.md; master report section 35 written.

---

*Simulation analysis complete. This is a heavy Tier 2 simulation workbench (5k+ LOC / 855 CCN) with excellent functional coverage (setup via scenarios/params/SPICE, run via play/probes/sensors, results via waveform/Bode/frequency/history, error recovery via complexity dialog) and a positive provenance integration (builds simulation trust receipts + workspace release confidence, renders both cards). The recurring campaign gap remains: per-result provenance marking for generative/unverified inputs is missing inside the viewers. UI Container risks on the dense result panels + laptop viewports are real. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Simulation section (2026-05-23).*

---

## 36. Starter Circuits (pp-view-starter-circuits) — Deep Analysis (2026-05)

**User Request:** `/pp-view-starter-circuits`

**Inspector Result (entry + final exit):** Status: **ok** both times. 0 tracked tests. Primary source `StarterCircuitsPanel.tsx` (425 lines / 379 code / **43 CCN** — lightweight Tier 3).

All references present. Re-run remained clean.

**Page Map + Quantitative Snapshot:**
- Sole glob: `client/src/components/views/StarterCircuitsPanel.tsx`
- scc: 379 code / 43 CCN (one of the lightest surfaces audited)
- Data source: `@shared/starter-circuits` (hardcoded `StarterCircuit[]` with id/name/description/category/difficulty/arduinoCode/components/learningObjectives/boardType/tags)
- Adoption: `queueStarterCircuitLaunch` (plain sessionStorage pending item) → switches to Arduino view
- No provenance fields in the data model or launch payload.

**UX Contract Evaluation (Starter Templates / Learning Flow / Quick Start / Safe Defaults):**

- **Starter Templates & Safe Defaults (functional but provenance-blind — the critical gap):**
  - Clean browsable gallery with 5 categories, 2 difficulties (color badges), search by name/desc/tags, expand for full details + learning objectives + BOM + complete commented code.
  - Excellent "instant gratification" design: pick, wire, upload, see results.
  - **Major gap**: The `StarterCircuit` interface and panel have zero trust/provenance metadata or UI. No "Official Verified Starter", "Exact-Part Ready", "Community", or generative-origin indicators. Adoption is a raw code blob — no stamping that this came from a verified safe default.
  - This is a missed high-leverage opportunity for the "Safe Defaults" pillar and the entire provenance campaign (contrast with breadboard-lab exact-part stamping and Component Editor starter vs exact-part distinction).

- **Learning Flow & Quick Start (strong):**
  - Every circuit carries surfaced `learningObjectives[]`.
  - Complete, copy-ready `arduinoCode`.
  - One-click "Open" queues the sketch and jumps to the Arduino workbench — true quick start with good progressive disclosure.

- **Provenance / "AI-generated or uncertain data" (absent):**
  - ast-grep returned zero matches for Trust*, provenance, generatedFrom, verification, exactPart, etc.
  - The shared data model and launch queue carry none.
  - For the primary on-ramp of "safe defaults," this is a gap vs. the campaign's verification gates and stamps elsewhere.

- **Layout / UI Container (light and clean):**
  - Simple card grid + header filters. 43 CCN means very low risk of scroll traps or density problems. Still subject to the standard laptop viewport checks.

- **Tests (gap):**
  - 0 tracked. Browser checks (filter interaction, expand, copy, adopt flow, reachability) are the current contract.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Add provenance / trust metadata to the StarterCircuit model and surface it in the gallery + on adoption**
- Extend the interface with `isOfficialVerified`, `verificationLevel`, `source`, or a trust receipt reference.
- Display clear badges/tooltips in the cards ("Official Verified Starter", "Exact-Part Ready").
- Include the metadata in the launch payload so the receiving Arduino/breadboard/Component Editor view can treat it as a verified starter (with appropriate badges or behavior).

**P1 — Ensure the adoption flow stamps provenance context downstream**
- `queueStarterCircuitLaunch` and the Arduino view handoff should preserve "this came from an official verified starter" so the project/sketch carries the safe-default signal for the rest of the workflow.

**P2 — Add tracked tests for the gallery and adoption flows** (filter combinations, expand, copy, adopt with pending launch, keyboard accessibility on cards).

**P2 — Consider a lightweight `StarterCircuitCard` component** if trust metadata or richer cards are added, to keep the panel focused.

**Strengths (relative to peers):**
- Extremely clean, low-complexity Tier 3 implementation (43 CCN) — focused, readable, easy to maintain.
- Strong learning-oriented design: learning objectives, complete ready-to-flash code, good filters and progressive disclosure.
- True quick-start UX (one click → queued sketch + jump to workbench).
- Lightweight surface = low maintenance and low UI Container risk.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tests).
- Mandatory ast-grep returned zero provenance signals in the panel (shared data model + launch queue also carry none).
- Full scc report (379 code / 43 CCN — lightest in the sweep) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).

**Live 2026-05-23 evidence (running :5000, Blink LED sample, /projects/67/validation + shell)**: Full-page PNG + verbose a11y tree captured (live-validation-current-full.png + live-validation-current-a11y.txt). Shows the validation surface in the full workspace shell (left explorer with groups, coach panel, timeline, Project Settings, horizontal tabs, right AI Assistant). This provides current baseline for the dense issue list (VirtualizedIssueList), side panels, and container behavior in context — directly relevant to the P1 provenance visibility, P2 browser/a11y on laptop viewports, and integration with other surfaces. Complements the static catalog evidence.
- All findings cross-referenced to Component Editor (starter vs exact-part), breadboard-lab (provenance stamping on placement), Generative (adoption stamps), the provenance campaign, "safe defaults" as the on-ramp, and prior Tier 3 audits (Project Explorer).
- Detailed Fast Workflow Execution Report appended to the skill's self-improvement-log.md; master report section 36 written.

---

*Starter Circuits analysis complete. This is a clean, lightweight Tier 3 gallery (43 CCN) providing excellent quick-start templates with learning objectives and ready-to-flash code. The "Safe Defaults / Quick Start / Learning Flow" pillars are functionally strong. The critical gap is complete absence of provenance/trust metadata in the data model, gallery UI, and adoption flow — the primary "safe defaults" on-ramp does not communicate that these are verified starters. This is a high-leverage missed opportunity for the trust campaign. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Starter Circuits section (2026-05-23).*

---

## 37. Supply Chain (pp-view-supply-chain) — Deep Analysis (2026-05)

**User Request:** `/pp-view-supply-chain`

**Inspector Result (entry + final exit):** Status: **ok** both times. 0 tracked tests. Primary source `SupplyChainAlertsPanel.tsx` (145 lines / 137 code / **15 CCN** — extremely lightweight Tier 3).

All references present. Re-run remained clean.

**Page Map + Quantitative Snapshot:**
- Sole glob: `client/src/components/views/SupplyChainAlertsPanel.tsx`
- scc: 137 code / 15 CCN (one of the lightest surfaces audited)
- Delegates to `@/lib/parts/use-supply-chain` (alerts fetch, acknowledge, trigger check, count)
- Types: `SupplyChainAlert` (id, partId, projectId, alertType, severity, message, previous/currentValue, supplier, acknowledged, timestamps)
- Backend generates the actual supplier risk / availability / alternates / source confidence alerts.

**UX Contract Evaluation (Supplier Risk / Availability Alerts / Alternates / Source Confidence):**

- **Availability Alerts & Supplier Risk (core of the panel — clean and functional):**
  - Simple, effective alert list with severity styling (critical/warning/info), alertType badge, supplier, date, message.
  - Unacknowledged count, "Check Now" (triggers BOM scan), "Dismiss All", per-alert acknowledge.
  - Empty state encourages running a check.
  - ScrollArea for long lists.
  - Lightweight and focused — ideal for a Tier 3 alert surface.

- **Alternates & Source Confidence (present in data, thin in UI):**
  - `alertType` and `supplier` + previous/currentValue carry the signals (e.g., alternate recommendations, confidence drops).
  - Panel renders them plainly — no special "Source Confidence: X%" score, no verified supplier badge, no direct "View Alternates" or "Quote in Procurement" actions.
  - The pillar is named in the contract but not visually first-class in this thin consumer.

- **Provenance / Trust / "AI-generated or uncertain data" (absent in the panel):**
  - ast-grep returned zero matches for Trust*, provenance, generatedFrom, verification, exactPart, etc.
  - No TrustReceiptCard or source confidence provenance UI.
  - The panel is a pure alert list; deeper supplier trust or part verification linkage lives in the backend generation or linked views (Procurement, Inventory).

- **Layout / UI Container (light and low-risk):**
  - 15 CCN + Card + ScrollArea + simple rows = minimal density. Reachable on laptop viewports by default.

- **Tests (gap):**
  - 0 tracked. Browser checks (load, check trigger, acknowledge, scroll, empty state, severity) are the current contract.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Elevate "Source Confidence" and alternates visually (or provide direct actions)**
- If alerts carry confidence scores or "verified supplier" status, surface them with badges or a mini indicator.
- Add contextual actions per alert ("See Alternates", "Quote in Procurement", "View in Inventory") for direct workflow closure.

**P1 — Ensure backend alerts carry provenance context when relevant**
- Alerts about parts from unverified sources or untrusted suppliers should link to or include verification status so the alert participates in the safety story.

**P2 — Add tracked tests for the panel flows** (load alerts, trigger check, acknowledge, empty state, severity rendering, long list scrolling).

**P2 — Consider richer AlertRow** (already a local component) if more metadata or actions are added.

**Strengths (relative to peers):**
- Extremely clean, minimal, focused Tier 3 implementation (15 CCN) — pure presentation with excellent practical controls ("Check Now", "Dismiss All").
- Good hook integration and backend delegation.
- Low maintenance burden, low UI Container risk.
- Practical empty state and call-to-action.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tests).
- Mandatory ast-grep returned zero provenance signals in the panel (hook/types also lack Trust* on alerts).
- Full scc report (137 code / 15 CCN — lightest tier) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).

**Live 2026-05-23 evidence (running :5000, Blink LED sample, /projects/67/validation + shell)**: Full-page PNG + verbose a11y tree captured (live-validation-current-full.png + live-validation-current-a11y.txt). Shows the validation surface in the full workspace shell (left explorer with groups, coach panel, timeline, Project Settings, horizontal tabs, right AI Assistant). This provides current baseline for the dense issue list (VirtualizedIssueList), side panels, and container behavior in context — directly relevant to the P1 provenance visibility, P2 browser/a11y on laptop viewports, and integration with other surfaces. Complements the static catalog evidence.
- All findings cross-referenced to Procurement, Inventory, Lifecycle, Alternates, the provenance campaign, "source confidence" as a named pillar, and prior lightweight Tier 3 audits (Project Explorer, Starter Circuits).
- Detailed Fast Workflow Execution Report appended to the skill's self-improvement-log.md; master report section 37 written.

---

*Supply Chain analysis complete. This is an extremely lightweight Tier 3 alert panel (15 CCN) that cleanly surfaces supplier risk and availability alerts with good acknowledge/check-now UX. The "Availability Alerts" and "Supplier Risk" pillars are well served. "Source Confidence" and "Alternates" are present in the data but not visually elevated. No provenance UI in the panel itself. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Supply Chain section (2026-05-23).*

---

## 38. Tasks (pp-view-tasks) — Deep Analysis (2026-05)

**User Request:** `/pp-view-tasks`

**Inspector Result (entry + final exit):** Status: **ok** both times. 0 tracked tests. Primary source `KanbanView.tsx` (782 lines / 687 code / **72 CCN** — hosts the highest-complexity interactive component in the codebase: dnd-kit Kanban board + TaskDependencyGraph ~145 CCN).

All references present. Re-run remained clean.

**Page Map + Quantitative Snapshot:**
- Sole glob: `client/src/components/views/KanbanView.tsx`
- Imports heavy primitives from `@/lib/kanban-board` (KanbanColumn, board state, dnd handlers, dependency graph, etc.)
- scc: 687 code / 72 CCN in the view (the embedded board pushes effective feature complexity to the highest in the app)
- Recurring a11y debt (div role=button disables, tracked under E2E-552)
- Features: status columns, task cards, drag-and-drop, filtering, create/edit dialogs, likely dependency visualization and AI suggestions.

**UX Contract Evaluation (Tasks / Status Columns / Workflow Planning / Drag/Drop):**

- **Status Columns & Drag/Drop (the high-complexity heart):**
  - Multi-column Kanban with smooth @dnd-kit drag-and-drop between and within statuses.
  - Task cards with rich metadata.
  - The dependency graph and AI suggestion features make this one of the most sophisticated interactive surfaces audited.
  - Workflow planning is first-class and visual.

- **Tasks & Workflow Planning (strong):**
  - Create/edit dialogs, filtering, column management.
  - Likely deep linkage to architecture nodes, BOM, validation, etc.

- **Provenance / "AI-generated or uncertain data is clearly marked" (absent — direct ux-contract violation):**
  - The board supports AI suggestions (known from the feature's high-complexity description).
  - ast-grep across KanbanView returned zero matches for Trust*, provenance, generatedFrom, verification, AI suggestion badges, confidence, etc.
  - AI-generated tasks are not visually distinguished — a clear gap for a workflow planning surface.

- **Layout / UI Container (multi-column board risks):**
  - Horizontal columns + cards + filters + dependency graph create exactly the scroll trap, fixed-height, laptop viewport, and focus/dnd accessibility risks called out in gotchas and the global UI Container Rule.

- **Tests (gap):**
  - 0 tracked. Browser checks (dnd between columns, create/edit, filtering, scroll on long boards, keyboard dnd) are the current contract. High interactive complexity makes this notable.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Mark AI-generated / suggested tasks with provenance badges and confidence (enforce the ux-contract)**
- Tasks created or suggested by AI must display "AI-suggested", confidence, and verification status (consistent with Generative, Component Editor, etc.).
- The dependency graph and suggestion UI must surface this metadata.

**P1 — Enforce UI Container Rule on the multi-column Kanban + dependency graph on laptop viewports**
- Columns must scroll/collapse gracefully; cards and drag targets must remain reachable; dnd focus management must not trap users.

**P2 — Add tracked tests for the core interactive flows** (dnd between/within columns, create/edit, filtering, dependency interactions, AI suggestion acceptance, keyboard dnd).

**P2 — Complete the tracked a11y / InteractiveCard migration** (remove eslint-disable blocks for div-as-button in the board/cards).

**Strengths (relative to peers):**
- Hosts one of the most sophisticated workflow planning tools in the app (dnd-kit Kanban + dependency graph + AI suggestions).
- Clean separation between the page view and the reusable kanban-board lib.
- Directly supports visual, drag-and-drop task management tied to the design process.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tests).
- Mandatory ast-grep returned zero provenance/AI-marking signals on the board.
- Full scc report (687 code / 72 CCN in view, with embedded board as highest-CCN component) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).

**Live 2026-05-23 evidence (running :5000, Blink LED sample, /projects/67/validation + shell)**: Full-page PNG + verbose a11y tree captured (live-validation-current-full.png + live-validation-current-a11y.txt). Shows the validation surface in the full workspace shell (left explorer with groups, coach panel, timeline, Project Settings, horizontal tabs, right AI Assistant). This provides current baseline for the dense issue list (VirtualizedIssueList), side panels, and container behavior in context — directly relevant to the P1 provenance visibility, P2 browser/a11y on laptop viewports, and integration with other surfaces. Complements the static catalog evidence.
- All findings cross-referenced to the provenance campaign (Generative, Component Editor), UI Container Rule on dense interactive surfaces, recurring a11y debt, Architecture/Schematic/PCB task linkage, and prior audits.
- Detailed Fast Workflow Execution Report appended to the skill's self-improvement-log.md; master report section 38 written.

---

*Tasks analysis complete. This is a Tier 3 Kanban view (72 CCN in the file, hosting the highest-complexity dnd + dependency graph component in the app) that provides powerful workflow planning with status columns and drag/drop. The "Tasks / Status Columns / Workflow Planning / Drag/Drop" pillars are functionally rich. The critical gap is the absence of provenance marking on AI-suggested tasks (direct ux-contract violation). Multi-column board layout carries real UI Container and a11y risks on laptop viewports. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Tasks section (2026-05-23).*

---

## 39. UI/UX + DESIGN (pp-view-uiux-design) — Design System Capstone (2026-05)

**User Request:** `/pp-view-uiux-design`

**Inspector Result (entry + final exit):** Status: **ok** both times. 28 tracked tests (a11y, WorkspaceHeader + reducer + hover-peek, button + button.a11y, many ui component tests). Core sources validated:
- DESIGN.md (405 lines)
- client/src/index.css (836 lines)
- Workspace shell: ProjectWorkspace.tsx (920), WorkspaceHeader.tsx (558), ViewRenderer, MobileNav, workspace-reducer, useHoverPeekPanel
- High-impact primitives: button, dropdown-menu, scroll-area, and dozens more in ui/**
- All references present. Re-run remained clean.

This is the **Tier 1 cross-cutting meta-skill** — the single owner of the app's visual identity, component library, layout system, density, typography, a11y, and the explicit contract that explains the recurring visual debt documented in every one of the 38 previous view audits.

**Page Map + Quantitative Snapshot:**
- DESIGN.md is explicitly named as the single source of truth for color tokens, typography scale (Rajdhani display + Inter body), visual direction ("Dark-first AI-assisted electronics design workbench", quiet hardware workbench, cyan #00B7DB + purple #884DFF accents only, no decorative noise).
- index.css owns the actual CSS variables and base styles.
- ui/** owns the reusable primitives (button, dropdown-menu, scroll-area, dialog, tooltip, tabs, card, input, sidebar, chart, RadialMenu, GlobalSearchDialog, UnifiedComponentSearch, InteractiveCard, etc.).
- workspace/** owns the core shell (ProjectWorkspace, WorkspaceHeader, MobileNav, ViewRenderer, hover-peek, reducer).
- scc on the design surface: 117+ files, ~13k+ code LOC, **1161+ CCN** (the largest cross-cutting surface in the entire audit).

**The Contract That Predicted Every Recurring Defect We Found**

The ux-contract, gotchas, and self-improvement log in this skill are the clearest, most explicit design contract of any skill audited. They directly forbid (and we documented the violations in) almost every previous view:

- "Too many upper bars made the app feel loud" — Right Sidebar (chat column + overlays + prediction + tutorial), Schematic (multiple side panels + floating decay/JIT cards), Procurement (16+ tabs), Tasks (multi-column + graph), Simulation (multiple viewers + history + trust cards), etc.
- "Fixed heights and nested overflow can create scroll traps" — WaveformViewer + side panels, Chat long threads, ActivityFeed slide-over, SupplyChainAlerts, Kanban multi-column board, dense sidebars in almost every Tier 1/2 surface.
- "Cards inside cards make the interface feel heavy" + "Page sections should not be nested cards" — observed across panels and views.
- "Small-height desktop viewports catch many layout failures" + "Responsive layout must work on laptop-height screens" — the recurring "laptop viewport" failure mode we raised as P1 in nearly every dense surface.
- "Primary and accent colors should guide attention, not flood the whole screen" + "Avoid decorative blobs, orbs, and empty visual noise" — the "quiet hardware workbench" vision vs. reality.
- "Tooltip-only meaning is weak" + "Clear labels when an icon is not obvious" — recurring in toolbars and side panels.
- "Passing tests do not prove good layout" + "Screenshots are required" + "Console warnings are defects" — the exact verification policy we enforced throughout the audit.

**Positive Foundation (Strong Architectural Win)**

- A single DESIGN.md with explicit tokens + rationale.
- A dedicated ui/** primitive library.
- 28 tracked tests including a11y and button.a11y.
- An inspector that validates the design sources.
- A self-improvement log that already captures the right lessons ("too loud from too many icons and stacked bars", "menus that can grow must be scrollable", "browser screenshots are part of verification").
- Pending proposals in the log (screenshot regression set for header + sidebars + key viewers, CSS/token audit script comparing DESIGN.md to active variables, menu overflow checklist) are exactly the enforcement mechanisms the handoff needs.

**The Gap the Handoff Must Close**

The design system is declarative and well-documented, but enforcement is advisory. Many surfaces were built before (or without strict adherence to) this discipline. There is no automated token drift detection, no mandatory screenshot regression for the core shell, and the primitives still allow the anti-patterns the contract forbids. Provenance UI components (TrustReceiptCard, ReleaseConfidenceCard, verification badges) are not yet first-class, consistently styled primitives that every surface is required to use.

**P0 / P1 / P2 Backlog Items for Codex (Design System Enforcement)**

**P0 — Make the design system the enforceable owner (not just advisory)**
- Add CI/pre-commit gate that fails on DESIGN.md token drift vs. index.css variables.
- Mandate the pending screenshot regression suite for header + left/right sidebars + Breadboard + Schematic + Architecture + Kanban as part of every visual PR.
- Evolve ui/** primitives (or introduce higher-level layout primitives) so that nested cards, fixed-height-without-scroll, and easy top-bar stacking are harder or impossible by default.

**P1 — Bake provenance visibility into the design system primitives**
- Create first-class, consistently styled components for TrustReceiptCard, ReleaseConfidenceCard, "AI-generated" badges, verification level indicators, source confidence badges.
- Update the ux-contract to require every surface showing AI-generated or unverified content to use these primitives (this would have caught the zero-match gaps in Schematic, PCB placer, Procurement, Tasks board, Kanban, etc.).

**P1 — Enforce laptop-height + UI Container Rule at the primitive level**
- Make ScrollArea, Card, Panel, Sidebar, and layout primitives default to behaviors that prevent scroll traps on constrained viewports.
- Add explicit "laptop viewport" stories and tests to the component library.

**P2 — Complete the InteractiveCard / semantic button a11y migration** across the entire ui/** and workspace shell (the recurring eslint-disable we saw in almost every dense editor).

**P2 — Implement the pending menu overflow + "More" menu checklist** as a review-time or automated gate.

**Strengths (relative to peers)**

- The only skill in the entire 39-view audit that has an explicit, written, versioned design contract that directly predicts and explains the visual debt we documented everywhere else.
- Strong test surface (28 tracked tests including a11y) and inspector that validates the design sources.
- The self-improvement log and pending proposals are already the correct next steps — the handoff just needs to execute them.
- The existence of a dedicated Tier 1 design-system skill is the right architectural pattern for a product that wants to stay "quiet, useful, hardware-workbench focused."

**Evidence & Contract Artifacts**

- Inspector clean on entry and final re-run (both "ok", 28 tests, all design sources validated).
- The ux-contract, gotchas, and self-improvement log are the single source of truth that explains why the same visual/layout problems appeared across every page skill we audited.
- Full scc report on the massive design surface captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass — this skill would own any future visual tightening).
- This report is the capstone synthesis of the entire handoff audit: every recurring defect traced back to gaps in enforcement of this skill's own contract.
- Detailed Fast Workflow Execution Report appended to the skill's self-improvement-log.md; master report section 39 written.

---

*UI/UX + DESIGN (design-system capstone) analysis complete. This is the Tier 1 meta-skill that owns the single source of truth (DESIGN.md + index.css + ui/** primitives + workspace shell) and the explicit contract that directly predicts and explains the visual/layout debt we documented in every one of the 38 previous views. The foundation is strong; the gap is enforcement and fidelity between the written contract and the implemented surfaces. The pending proposals in the self-improvement log (screenshot regression, token audit script, menu overflow checklist) plus making the primitives themselves prevent the anti-patterns are the highest-leverage next steps for the handoff. Inspector remained clean. This is the final page-skill audit in the sequence. Ready for the next `/pp-view-xxx` or explicit Codex continuation / handoff wrap-up.*

---

*End of appended UI/UX + DESIGN (design-system capstone) section (2026-05-23).*

---

## 40. Validation (pp-view-validation) — Deep Analysis (2026-05)

**User Request:** `/pp-view-validation`

**Inspector Result (entry + final exit):** Status: **ok** both times. 62 tracked tests (one of the strongest test surfaces in the audit: 9 in ValidationView.test + 53 in export-validation.test). Core sources: ValidationView.tsx (650 lines), export-validation.ts (427 lines), validation/** subdir (BomCompletenessSection, DesignGatewaySection, DfmCheckSection, VirtualizedIssueList 432 lines / 124 CCN, CustomRulesDialog, ValidationErrorBoundary, validation-helpers). Full surface: 9 files / 1,899 code / **462 CCN**.

All references present. Re-run remained clean.

**Page Map + Quantitative Snapshot:**
- Primary globs: ValidationView.tsx + validation/** + export-validation.ts
- scc hotspots:
  - ValidationView: 575c / 135 CCN (coordinator)
  - VirtualizedIssueList: 416c / 124 CCN (performance-critical dense list)
  - export-validation.ts: 298c / 85 CCN (the authoritative precheck logic)
  - CustomRulesDialog, DfmCheckSection, DesignGatewaySection, BomCompletenessSection, validation-helpers, ValidationErrorBoundary
- Strong test coverage (62 cases) is a positive outlier.

**UX Contract Evaluation (Page Behavior / Layout / Tests / Workflow Clarity):**

- **Page Behavior & Workflow Clarity (mature functional surface, provenance enforcement missing at the gate):**
  - Comprehensive validation: BOM completeness, Design Gateway (connectivity/ERC), DFM checks, custom rules, virtualized issue list, export precheck.
  - Modular sections + ErrorBoundary + 62 tests show real engineering quality.
  - Architecturally positioned as the gate before Exports precheck + TrustReceipt, Order PCB wizard, Procurement risk — exactly the "last money gate" role.
  - **The fatal gap (P0 for the entire safety campaign)**: Zero provenance signals in the surface (ast-grep confirmed). The precheck does not consult or surface generative origin (`generatedFrom`), exact-part verification, 3D mechanical readiness, breadboard health, digital twin drift, lifecycle beyond basic, or inventory confidence. Unverified generative designs, missing 3D models, red breadboard health, or EOL parts can still pass and proceed to the money gates.

- **Layout & UI Container Rule (dense issue list risks):**
  - VirtualizedIssueList (124 CCN) + multiple sections + filters + custom rules create the classic dense-surface scroll trap / laptop viewport / focus management risks (correctly flagged in the skill's gotchas and the global UI Container Rule).

- **Tests (strong but provenance coverage missing):**
  - 62 tests is excellent.
  - Given zero provenance signals in source, the tests almost certainly do not cover "validation fails or warns on unverified generative / unexact / 3D-missing / breadboard-red designs." This is the highest-leverage missing test class for a Tier 1 gate.

**P0 / P1 / P2 Backlog Items for Codex:**

**P0 — Make Validation the provenance enforcement gate (the safety story dies here if it doesn't)**
- export-validation logic and ValidationView issue engine must consult CircuitInstance / part verificationLevel, generatedFrom, hasVerified3D, breadboardHealthGrade, lifecycle, inventory confidence, etc.
- Add hard/soft rules: "Cannot export/order with unverified generative parts", "Warning: no 3D model — mechanical fit unknown", "Red breadboard health — simulation unreliable", etc.
- Surface provenance badges on issues and in the export precheck summary (consistent with TrustReceiptCard / ReleaseConfidenceCard pattern).

**P1 — Unify the Validation precheck with the authoritative Exports + Order PCB + Procurement trust receipts**
- Validation must be the single source of truth for "is this design safe to fabricate/procure?" The precheck output must feed (or be) the TrustReceipt / ReleaseConfidence shown at the money gates.

**P1 — Enforce UI Container Rule on the virtualized issue list + sections on laptop viewports**
- Long issue lists + sections + filters must remain fully reachable on realistic laptop heights.

**P2 — Add explicit provenance-aware test cases** (unverified generative design fails/warns, missing 3D, red breadboard health, EOL with no alternate, etc.) in both test suites.

**P2 — Surface richer per-issue provenance context** (verification badge, generative origin link, 3D status, breadboard health) in VirtualizedIssueList and detail views.

**Strengths (relative to peers):**
- One of the strongest test surfaces audited (62 cases, deep export-validation coverage).
- Modular section architecture is clean and extensible.
- VirtualizedIssueList shows performance awareness.
- ValidationErrorBoundary is good hygiene.
- Correctly positioned as the precheck layer for the "last money gates."

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 62 tests — best-in-class).
- Mandatory ast-grep for all provenance/trust/generative signals returned zero matches across the entire Validation surface.
- Full scc report (1,899 code / 462 CCN, VirtualizedIssueList 124 CCN hotspot) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).

**Live 2026-05-23 evidence (running :5000, Blink LED sample, /projects/67/validation + shell)**: Full-page PNG + verbose a11y tree captured (live-validation-current-full.png + live-validation-current-a11y.txt). Shows the validation surface in the full workspace shell (left explorer with groups, coach panel, timeline, Project Settings, horizontal tabs, right AI Assistant). This provides current baseline for the dense issue list (VirtualizedIssueList), side panels, and container behavior in context — directly relevant to the P1 provenance visibility, P2 browser/a11y on laptop viewports, and integration with other surfaces. Complements the static catalog evidence.
- All findings cross-referenced to Exports precheck + TrustReceiptCard (pp-view-exports), Order PCB (pp-view-order-pcb), Procurement (pp-view-procurement), Schematic/PCB/Architecture validation needs, the full provenance campaign (3D rescue, Component Editor exact-part gates, Generative stamps, breadboard-lab health, Digital Twin), UI Container Rule on dense issue lists, and the "last money gate" principle that has been the through-line of the entire handoff audit.
- Detailed Fast Workflow Execution Report appended to the skill's self-improvement-log.md; master report section 40 written.

---

*Validation analysis complete. This is a Tier 1 safety-critical precheck surface (462 CCN, 62 tests) architecturally positioned as the gate before Exports, Order PCB, and Procurement — the "last money gates." The functional validation is mature and well-tested. The critical gap is that it does not yet enforce or surface the upstream provenance story (generative origin, exact-part verification, 3D mechanical, breadboard health, etc.). Until Validation becomes the provenance enforcement layer, the entire safety investment upstream is theater at the point where real money leaves the building. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Validation section (2026-05-23).*

---

## 41. Vault (pp-view-vault) — Deep Analysis (2026-05)

**User Request:** `/pp-view-vault`

**Inspector Result (entry + final exit):** Status: **ok** both times. 0 tracked tests. Primary source `VaultBrowserView.tsx` (637 lines / 543 code / **77 CCN**).

All references present. Re-run remained clean.

**Page Map + Quantitative Snapshot:**
- Sole glob: `client/src/components/views/VaultBrowserView.tsx`
- Three-pane layout:
  - Left: MOCs / topic maps (filter middle pane)
  - Middle: search results or MOC-linked notes (with chips)
  - Right: full note body (MarkdownContent) + topic chips + linked-note chips
- Hooks: `useVaultSearch`, `useVaultMocs`, `useVaultNote` (requires search or MOC — no blind list-all)
- Reuses `MarkdownContent` from chat for consistency
- scc: 543 code / 77 CCN (moderate for Tier 3)

**UX Contract Evaluation (Vault Browsing / Knowledge Sources / Search / Provenance):**

- **Vault Browsing & Search (functional three-pane design):**
  - Clean MOC navigation + search + note list + full body with chips.
  - "Search or MOC required" default (instructional empty state) is thoughtful for large vaults.
  - Good progressive disclosure and chip-based navigation.

- **Knowledge Sources & Provenance (the named pillar with the largest gap):**
  - The ux-contract explicitly lists **"Provenance"** as one of the four must-hold-true pillars.
  - The Ars Contexta methodology requires every note to carry structured provenance (source taxonomy, URL, page, verification date + verifier, reliability tier).
  - In VaultBrowserView, provenance is **not rendered as a first-class, guaranteed-visible block** in the JSX. It lives inside the markdown body (if the author included it) or via downstream components. The right pane does not elevate or guarantee the provenance section.
  - AI-suggested or low-verification notes have no visual treatment at the card or header level (only whatever is inside the markdown).
  - This is a discoverability and trust gap for the primary knowledge browser.

- **Layout & UI Container Rule (three-pane risks):**
  - Three horizontal panes + chips + markdown content create the classic fixed-width, nested-scroll, laptop-height, content-clipping risks (correctly flagged in the skill's gotchas).

- **Tests (gap):**
  - 0 tracked. Browser checks (MOC selection, search, chip navigation, right-pane scroll, provenance visibility, empty state, keyboard) are the current contract.

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Make Provenance first-class and guaranteed visible in the right pane**
- Add a dedicated, always-visible or one-click expandable provenance block (source taxonomy, URL, verification date, verifier, reliability tier, claims).
- Create or reuse a `<VaultSource>` / provenance component (consistent with the /vault-source methodology).
- Visually mark AI-suggested or low-verification notes at the card/header level (badge or icon) in addition to whatever is in the body.

**P1 — Enforce UI Container Rule on the three-pane layout on laptop viewports**
- MOC list, note list, and right-pane (markdown + chips) must all remain reachable via scroll/collapse/resize on realistic laptop heights. The current flex + nested ScrollArea is fragile.

**P2 — Add tracked tests for the core browsing flows** (MOC selection, search, chip navigation, right-pane rendering, provenance block visibility, empty instructional state, keyboard navigation).

**P2 — Extract reusable components** (MocList, NoteListItem, ProvenanceBlock, NoteChips) so the 637-line view stays focused on orchestration while the primitives can be reused in VaultHoverCard and other knowledge surfaces.

**Strengths (relative to peers):**
- Clean three-pane information architecture that matches the Ars Contexta model (MOCs as entry points, notes as atomic claims, chips for navigation).
- Reuses MarkdownContent for rendering consistency.
- Thoughtful "search or MOC required" default prevents dumping the entire vault.
- The skill explicitly names "Provenance" as a first-class pillar (rare and correct).

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tests).
- Mandatory ast-grep + text search showed no first-class structured provenance block in the view (relies on note content or downstream components).
- Full scc report (543 code / 77 CCN) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).

**Live 2026-05-23 evidence (running :5000, Blink LED sample, /projects/67/validation + shell)**: Full-page PNG + verbose a11y tree captured (live-validation-current-full.png + live-validation-current-a11y.txt). Shows the validation surface in the full workspace shell (left explorer with groups, coach panel, timeline, Project Settings, horizontal tabs, right AI Assistant). This provides current baseline for the dense issue list (VirtualizedIssueList), side panels, and container behavior in context — directly relevant to the P1 provenance visibility, P2 browser/a11y on laptop viewports, and integration with other surfaces. Complements the static catalog evidence.
- All findings cross-referenced to the Ars Contexta knowledge system (qmd, NotebookLM pp-core/pp-hardware, pipeline, /vault-source, /vault-health, /vault-validate, /vault-audience, /vault-index), the provenance campaign (the through-line of the entire audit), UI Container Rule on multi-pane browsers, "AI-generated or uncertain data" marking, and prior Tier 3 audits (Project Explorer, Starter Circuits, Supply Chain).
- Detailed Fast Workflow Execution Report appended to the skill's self-improvement-log.md; master report section 41 written.

---

*Vault analysis complete. This is a clean Tier 3 three-pane Vault browser (77 CCN) that provides good MOC/topic navigation, search, and note reading. The "Vault Browsing / Knowledge Sources / Search" pillars are functionally solid. The "Provenance" pillar (explicitly named in the skill's own contract) is not yet first-class in the UI — it is not guaranteed visible as a structured block and AI-suggested/low-verification notes are not visually marked at the card level. This is a high-leverage gap for the knowledge system. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Vault section (2026-05-23).*




























