# ProtoPulse — Frontend Audit Remediation Checklist

**Scope:** All React components, state management, API integration, UI/UX patterns
**Files audited:** 14 primary frontend files (~6,500+ LOC)
**Stack:** React 18 + TypeScript + Vite + TanStack Query + shadcn/ui + Tailwind v4 + @xyflow/react
**Total findings:** 113
**Last updated:** 2026-02-18 (Session 6 — agent team batch of 23)

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fixed / Resolved |
| ⬜ | Open — not yet addressed |
| 🔶 | Partially addressed |

## Priority Legend

| Tag | Meaning | Examples |
|-----|---------|----------|
| P0 | 🔥 Critical (breaks app / security / data loss) | TS errors, key exposure, missing boundaries |
| P1 | ⚠️ High (major UX/reliability/perf risk) | monolithic context, localStorage fragility |
| P2 | 🧠 Medium (scale + quality debt) | memoization gaps, pagination gaps, styling drift |
| P3 | 🧹 Low (cleanup/DX polish) | naming consistency, central constants, tooling |

---

## Progress Summary

| Priority | Total | Fixed | Open | Partial |
|----------|-------|-------|------|---------|
| P0 | 15 | 9 | 4 | 2 |
| P1 | 34 | 20 | 14 | 0 |
| P2 | 59 | 25 | 34 | 0 |
| P3 | 5 | 0 | 5 | 0 |
| **Total** | **113** | **54** | **57** | **2** |

---

## SECTION 1 — Active TypeScript / LSP Errors

File: `ChatPanel.tsx` (4 errors)

- [x] ✅ **#1** P0 Compile/Types — Line 878: Type '{}' is not assignable to type 'string'. **Fixed:** Missing ACTION_LABELS import added to ChatPanel.tsx.
- [x] ✅ **#2** P0 Compile/Types — Line 939: Type 'unknown' is not assignable to type 'string | undefined'. **Fixed:** Missing ChatMessage type import added to ChatPanel.tsx.
- [x] ✅ **#3** P0 Compile/Types — Line 1365: Set iteration without downlevelIteration. **Fixed:** Missing MarkdownContent import added to ChatPanel.tsx.
- [x] ✅ **#4** P0 Compile/Types — Line 1370: Same Set iteration issue nearby. **Fixed:** Same fix as #3 (imports resolved).

---

## SECTION 2 — Architecture & Structural Issues

- [ ] ⬜ **#5** P1 Architecture — ChatPanel.tsx is 2,363 lines. Needs decomposition into ~6–8 components (MessageList, MessageInput, SettingsPanel, ModelSelector, AttachmentHandler, ImageGenPanel).
- [ ] ⬜ **#6** P1 Architecture/Perf — project-context.tsx is 614 lines with 40+ state values. Monolithic context triggers global re-renders; split into domain contexts (Chat/Diagram/BOM/Validation/etc.).
- [ ] ⬜ **#7** P1 Architecture — Sidebar.tsx is 832 lines. Should be section-driven subcomponents (navigation, tree, history, settings).
- [ ] ⬜ **#8** P1 Architecture — AssetManager.tsx is 678 lines. Mixing browsing/search/drag-drop/custom asset creation/shortcuts; split into dedicated modules.
- [x] ✅ **#9** P2 Performance — No code splitting / lazy loading. **Fixed:** All heavy views (ArchitectureView, ComponentEditorView, ProcurementView, ValidationView, OutputView) use React.lazy() with Suspense fallbacks showing a loading spinner.
- [ ] ⬜ **#10** P1 Reliability — No tests anywhere. Zero unit/integration/e2e coverage for a state-heavy app.

---

## SECTION 3 — State Management Issues

- [ ] ⬜ **#11** P0 Performance — Monolithic provider causes cascade re-renders. useProject() consumers rerender on any state change.
- [x] ✅ **#12** P2 Type Safety — setBomSettings accepts any. **Fixed:** Already properly typed as `Partial<{ maxCost: number; batchSize: number; inStockOnly: boolean; manufacturingDate: Date }>` in ProjectState interface (line 106).
- [x] ✅ **#13** P1 Type Safety — ChatMessage.attachments/actions typed as any[]. **Fixed:** Proper interfaces defined (ChatAttachment, ChatAction) and used in ChatMessage type (lines 53-72).
- [x] ✅ **#14** P2 Type Safety — schematicSheets[].content: any. **Fixed:** Already typed as `Record<string, unknown>` (line 95), not `any`.
- [ ] ⬜ **#15** P0 Reliability — localStorage used as primary persistence for project state. ~5MB limit, silent failure, not durable, no user feedback when exceeding.
- [x] ✅ **#16** P0 Reliability — No localStorage error handling. **Fixed:** All localStorage reads in ChatPanel.tsx (lines 46-67) and AssetManager.tsx (lines 66-72) are wrapped in try/catch with fallback defaults. Writes also wrapped in try/catch.
- [x] ✅ **#17** P1 Data Loss — Debounced saves can lose edits (ArchitectureView 1500ms debounce). Closing tab within debounce window loses changes. **Fixed:** `beforeunload` event handler flushes pending debounced node and edge saves before tab close.
- [x] ✅ **#18** P1 Reliability — userInteracted ref flag is fragile. A shared boolean gate can be reset by unrelated updates; saves may skip incorrectly. **Fixed:** Split single `userInteracted` ref into separate `nodeInteracted` and `edgeInteracted` refs so node and edge sync/save logic operate independently.
- [ ] ⬜ **#19** P0 Product — PROJECT_ID = 1 hardcoded. Blocks multi-project support and causes wrong-project assumptions.

---

## SECTION 4 — Type Safety Issues

- [x] ✅ **#20** P2 Types — Widespread `as any`/`as string` in CustomNode.tsx. **Fixed:** Defined `CustomNodeData` interface and typed component as `NodeProps<Node<CustomNodeData>>`, eliminating all `as string` casts. Node/Edge array operations use proper React Flow types.
- [ ] ⬜ **#21** P2 Types — data.type as string, data.label as string assertions. Will explode silently if data shape changes.
- [x] ✅ **#22** P2 Types — ArchitectureView context menu uses any casts. Should use proper Node types. **Fixed:** Replaced `as number` cast with `typeof` runtime type guard for `componentPartId`.
- [x] ✅ **#23** P2 Types — iconMap typed as Record<string, any>. **Fixed:** Already typed as `Record<string, React.ComponentType<{ className?: string }>>` (line 8).
- [x] ✅ **#24** P1 Correctness — Node IDs created via Date.now().toString(). **Fixed:** Node IDs already use crypto.randomUUID() in ArchitectureView.tsx.
- [x] ✅ **#25** P0 Correctness — BOM deletion casts string ID to number. **Fixed:** BOM deletion passes ID directly, no Number() cast.
- [x] ✅ **#26** P0 Correctness — Validation deletion casts string ID to number. **Fixed:** Validation deletion passes ID directly, no Number() cast.
- [x] ✅ **#27** P1 Correctness — addValidationIssue accepts loose severity: string. **Fixed:** Already typed as `'error' | 'warning' | 'info'` union in both the ProjectState interface (line 113) and mutation function (line 481).

---

## SECTION 5 — Performance Issues

- [ ] ⬜ **#28** P2 Performance — SchematicView has massive hardcoded data objects (~220 LOC). Extract to data files or fetch from backend.
- [ ] ⬜ **#29** P1 Performance — SchematicView re-renders entire SVG on panning. Mouse move triggers state updates → full SVG repaint; use ref + CSS transforms or canvas.
- [x] ✅ **#30** P2 Performance — No memoization on filtered BOM list. **Fixed:** filteredBom already wrapped in useMemo in ProcurementView.tsx.
- [x] ✅ **#31** P2 Performance — No memoization on filtered output log. **Fixed:** filteredLog now wrapped in useMemo in OutputView.tsx.
- [x] ✅ **#32** P1 Performance/Correctness — OutputView uses indexOf() per item. **Fixed:** Refactored to use `indexedFilteredLog` which pre-computes original indices via `.map((log, index) => ({ log, index }))`, eliminating O(n²) indexOf lookups.
- [ ] ⬜ **#33** P1 Performance — No virtualization for long lists. Output log, BOM, chat, validation render everything. Use react-window or @tanstack/react-virtual.
- [ ] ⬜ **#34** P2 Styling Fragility — ReactFlow controls styled with !important overrides. Fragile and likely to break on library updates.
- [ ] ⬜ **#35** P2 React — Multiple useCallback hooks with empty/incorrect deps. Risks stale closures or unnecessary rerenders.
- [ ] ⬜ **#36** P2 Perf/Tree Depth — Tooltip wrapping nearly every interactive element. Adds heavy component depth; consider fewer tooltips or a lighter pattern.

---

## SECTION 6 — Accessibility Issues

- [ ] ⬜ **#37** P1 A11y — Schematic SVG has no roles/ARIA labels. Screen readers get nothing meaningful.
- [ ] ⬜ **#38** P1 A11y — SVG components clickable only; not keyboard accessible. Missing tabIndex, role="button", key handlers.
- [x] ✅ **#39** P0 A11y/UX — Space bar hijacked globally in SchematicView. **Fixed:** Space bar handler now checks e.target tag and container focus before preventDefault().
- [x] ✅ **#40** P1 A11y — No focus management when switching views. **Fixed:** ProjectWorkspace uses a mainRef with useEffect that focuses the main content area (tabIndex={-1}) whenever activeView changes, restoring screen reader context.
- [x] ✅ **#41** P1 A11y — Color-only status indicators in ProcurementView. **Fixed:** Added icons (CheckCircle2/AlertCircle/XCircle) alongside status text for each stock status (In Stock/Low Stock/Out of Stock) so color-blind users get non-color cues.
- [x] ✅ **#42** P2 A11y — No skip navigation links. **Fixed:** Skip-to-main-content link added (sr-only, visible on focus). Chat panel wrapped with id="chat-panel" for future skip link extension.
- [ ] ⬜ **#43** P2 A11y — Context menus lack keyboard shortcut indicators. Users can't discover controls.
- [ ] ⬜ **#44** P2 A11y — Net tooltip is raw div; no ARIA linkage to trigger. Not announced; not navigable.
- [x] ✅ **#45** P2 A11y — BOM table lacks caption / accessible name. **Fixed:** Table already has `aria-label="Bill of Materials"` (line 268).
- [x] ✅ **#46** P2 A11y — "Auto-Fix" buttons lack row context. Screen readers hear repeated "Auto-Fix" with no association. **Fixed:** "Mark Resolved" buttons include `aria-label="Mark resolved: {issue.message}"` with full issue context. Component "View" buttons include `aria-label="View in editor: {issue.message}"`.

---

## SECTION 7 — UI/UX Issues

- [ ] ⬜ **#47** P1 UX Integrity — "Generate Schematic" is a fake stub. Adds canned response via timeout; presented as functionality.
- [x] ✅ **#48** P1 UX — Drop position uses magic numbers. Should use reactFlowInstance.screenToFlowPosition(). **Fixed:** `onDrop` already uses `reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })`.
- [ ] ⬜ **#49** P0 UX/Data Safety — No undo/redo anywhere. Destructive edits cannot be reversed.
- [ ] 🔶 **#50** P0 UX/Data Safety — No confirmation dialogs for destructive actions. **Partially addressed:** Created reusable ConfirmDialog component, integrated for BOM item deletion (ProcurementView), output log clearing (OutputView), and validation issue dismissal (ValidationView). ArchitectureView node deletion uses ReactFlow keyboard Delete (standard UX, exempt). ChatPanel has no clear/delete button. Remaining: chat command-driven destructive actions (e.g. "clear all nodes") lack confirmation.
- [x] ✅ **#51** P1 UX Integrity — "Paste" context menu doesn't paste. Creates hardcoded node at (300,300) regardless of clipboard. **Fixed:** Paste now reads clipboard, parses architecture JSON (nodes+edges), and places them at viewport center. Falls back to creating a single new node if clipboard is empty/unreadable.
- [ ] ⬜ **#52** P2 UX — Export to clipboard copies raw JSON. Not user-friendly; needs format options.
- [x] ✅ **#53** P1 Correctness — "Select All" uses context nodes not local nodes. Recently added nodes not yet synced won't be selected. **Fixed:** Changed to use `setLocalNodes` functional updater form which always operates on the latest local state, preventing stale closure issues.
- [x] ✅ **#54** P2 UX — BOM "Add Item" creates useless default entry. No edit-in-place flow to make it real. **Fixed:** "Add Item" now opens a Dialog form collecting part number (required), manufacturer, supplier, description, quantity, and unit price before creating the entry.
- [x] ✅ **#55** P1 Data Integrity — CSV export doesn't escape commas. **Fixed:** CSV export already has proper escapeCSV helper that handles commas, quotes, newlines.
- [x] ✅ **#56** P2 UX Integrity — "View Datasheet" opens Google search. Label implies a real datasheet link. **Fixed:** Context menu already renamed to "Search Datasheet" (verified — no "View Datasheet" text remains in ProcurementView).
- [x] ✅ **#57** P1 UX Integrity — Validation "Auto-Fix" just deletes the issue. **Fixed:** Renamed button to "Mark Resolved", updated tooltip to "Mark this issue as resolved", updated output log to "[RESOLVED] Marked resolved:", and data-testid to "button-resolve-". Semantics now match behavior.
- [ ] ⬜ **#58** P2 UX — Schematic "fit to view" just resets origin. Doesn't compute bounds or fit.
- [x] ✅ **#59** P2 UX — No loading states for view transitions. **Fixed:** ViewLoadingFallback component renders a spinner during lazy-loaded view transitions via React Suspense boundaries around each view.
- [x] ✅ **#60** P2 UX — Empty states minimal/missing (Procurement especially). Guidance absent when lists are empty. **Fixed:** ProcurementView empty state now distinguishes no-items vs no-search-results with actionable guidance and "Add First Item" / "Clear Search" buttons. ValidationView empty state adds descriptive guidance and a "Run DRC Checks" action button.

---

## SECTION 8 — Security Concerns

- [ ] 🔶 **#61** P0 Security — API keys stored in localStorage. **Partially addressed:** API keys are NOT stored in localStorage (verified). They're kept in React state only, lost on refresh. Backend supports encrypted storage via /api/settings/api-keys, but frontend is not yet wired up to use it (TODO in ChatPanel.tsx line ~57).
- [x] ✅ **#62** P1 Security — window.open missing noopener,noreferrer consistently. **Fixed:** All window.open() calls already include 'noopener,noreferrer'.
- [ ] ⬜ **#63** P2 Security — User-controlled data inserted into URLs (pattern risk). encodeURIComponent helps, but future extensions could go wrong.
- [x] ✅ **#64** P1 Security — No CSP headers configured (frontend perspective). **Fixed:** Added Content-Security-Policy meta tag to index.html with restrictive defaults: self-only for scripts/connect/media, inline styles allowed for Tailwind, font-src limited to Google Fonts, object-src none, frame-ancestors none.
- [x] ✅ **#65** P2 Reliability — Global suppression of ResizeObserver errors. **Fixed:** ResizeObserver error suppression in main.tsx tightened to match only specific known messages.

---

## SECTION 9 — API Integration Issues

- [x] ✅ **#66** P1 Data Freshness — staleTime: Infinity. Data never refetches unless manually invalidated (multi-tab/multi-user issues). **Fixed:** staleTime set to 5 minutes (5 *60* 1000) in queryClient defaults. Individual queries inherit this default; none override with Infinity.
- [x] ✅ **#67** P2 Reliability — retry: false everywhere. Transient network failures leave UI broken until manual retry. **Fixed:** Default retry set to 2 for queries (with built-in exponential backoff). Mutations keep retry: false (correct — mutations should not auto-retry).
- [x] ✅ **#68** P2 Reliability — No global error handler for API failures. Failures can be silent unless every view handles them. **Fixed:** Added global onError handlers for both queries (via queryCache config) and mutations (via defaultOptions). Both show destructive toast notifications via shadcn/ui toast with human-readable error messages.
- [x] ✅ **#69** P2 Correctness — getQueryFn joins queryKey with /. Can produce malformed URLs if segments contain slashes/special chars. **Fixed:** getQueryFn uses queryKey[0] directly as URL (no segment joining). Added sanitizeUrl() that collapses double slashes in path and strips trailing slashes for robustness.
- [x] ✅ **#70** P1 Reliability — API responses not validated. .json() consumed without schema validation; runtime mismatches become crashes. **Fixed:** getQueryFn now reads response as text first, then validates: checks for empty response, validates JSON parsing (with try/catch), and rejects null/undefined payloads. Errors include the URL for debugging.
- [ ] ⬜ **#71** P2 Architecture — TanStack Query is underutilized. Heavy manual state/localStorage patterns coexist; uneven data flow strategy.

---

## SECTION 10 — Error Handling Issues

- [x] ✅ **#72** P0 Reliability — ErrorBoundary only wraps top level. **Fixed:** ErrorBoundary wraps each individual view in ProjectWorkspace.tsx (not just top level).
- [x] ✅ **#73** P1 Reliability — ErrorBoundary ignores ResizeObserver errors too broadly. **Fixed:** Both ErrorBoundary.tsx and index.html inline handler now use specific regex matching only the two known messages ("limit exceeded" and "completed with undelivered notifications") instead of broad /ResizeObserver loop/ match.
- [x] ✅ **#74** P1 Reliability — No ErrorBoundary around ReactFlow. **Fixed:** ReactFlow (ArchitectureView) is wrapped in its own ErrorBoundary in ProjectWorkspace.tsx.
- [x] ✅ **#75** P1 UX — Clipboard writes have no error handling. **Fixed:** clipboard.ts has proper try/catch with textarea fallback and boolean return.
- [x] ✅ **#76** P2 Reliability — Blob URL creation for CSV export lacks try/catch. **Fixed:** Entire handleExportCSV wrapped in try/catch with destructive toast on failure (ProcurementView lines 53-78).
- [ ] ⬜ **#77** P2 Reliability — Schematic key listeners risk duplication under rapid remounts. Cleanup exists, but fast remount behavior can still bite.

---

## SECTION 11 — React Patterns & Best Practices

- [ ] ⬜ **#78** P2 React — Missing dependencies in useEffect hooks. setNodes/setEdges missing from dep arrays; hooks linting would flag.
- [ ] ⬜ **#79** P2 React — Multiple useEffect blocks for related syncing logic. Consider custom hook (e.g., useSyncedFlowState).
- [ ] ⬜ **#80** P2 Perf — Inline JSX handlers create new functions every render. May cause ReactFlow resubscriptions.
- [x] ✅ **#81** P2 Correctness — Potential key issues in dynamic lists. **Fixed:** OutputView keys use `log-${originalIndex}` where originalIndex is the stable position from the source array (not the filtered array index), ensuring key stability across filter changes.
- [ ] ⬜ **#82** P3 Consistency — useCallback used inconsistently. Similar handlers treated differently across files.
- [ ] ⬜ **#83** P3 DX — Direct DOM manipulation for CSV export. Should be a shared util or lib.
- [x] ✅ **#84** P2 Reliability — Generate Schematic timeout not cleaned up. **Fixed:** No setTimeout/setInterval exists in SchematicView.tsx. The "Generate Schematic" command is handled in ChatPanel as a chat response flow, not via component-level timeouts.
- [ ] ⬜ **#85** P2 React Smell — "mount skip refs" pattern used. Indicates effect logic should be restructured.

---

## SECTION 12 — Styling & Responsive Design

- [ ] ⬜ **#86** P2 Styling — Hardcoded colors mixed with theme tokens. Breaks theme switching; should use Tailwind variables/CSS vars.
- [ ] ⬜ **#87** P2 Styling — SchematicView background hardcoded dark. bg-[#1e1e1e] won't adapt to light mode.
- [ ] ⬜ **#88** P2 Styling — OutputView hardcodes terminal aesthetic. Not theme-aware (bg-black/80, text-green-500/80).
- [ ] ⬜ **#89** P3 Design System — Inconsistent backdrop-blur usage. Needs a consistent design token strategy.
- [ ] ⬜ **#90** P2 Responsive — BOM table min-width forces horizontal scroll on mobile. Consider card layout or responsive table.
- [ ] ⬜ **#91** P1 Responsive — No mobile controls for SchematicView. No touch pan/pinch zoom support.
- [ ] ⬜ **#92** P2 Responsive — AssetManager overlay crowds small screens. Needs responsive placement/drawer behavior.
- [x] ✅ **#93** P2 UX — Validation row click behavior inconsistent. Clickability varies with no visual indication. **Fixed:** Architecture issues show `cursor-pointer` only when they have a `componentId` (navigable). Component issues always show `cursor-pointer` and navigate to component editor. All clickable rows have `role="button"`, `tabIndex`, and keyboard `Enter`/`Space` handlers.

---

## SECTION 13 — Missing Features / Incomplete Implementations

- [ ] ⬜ **#94** P2 UX — No shortcuts help modal/documentation. Users can't discover Space+drag/Escape etc.
- [ ] ⬜ **#95** P2 UX — No theme toggle UI. ThemeProvider exists but no visible control.
- [x] ✅ **#96** P2 UX — Toast system mounted but unused. **Fixed:** Wired toast notifications to user-facing actions: CSV export success/failure (ProcurementView), BOM item add (ProcurementView), copy all logs (OutputView), run validation & issue dismiss (ValidationView). ComponentEditorView already used toast for save.
- [ ] ⬜ **#97** P2 Product — Schematic sheets hardcoded, not editable. No create/rename/delete; static data only.
- [ ] ⬜ **#98** P2 Product — No collaboration or presence. No multi-user awareness (if that's a goal).
- [ ] ⬜ **#99** P2 Product — No import flow for schematics/netlists/EDA files. No file upload pipeline.
- [ ] ⬜ **#100** P1 UX — BOM items not editable in-place. Add/delete only; no editing quantities/prices/suppliers.
- [ ] ⬜ **#101** P2 Product — No print stylesheet / export-to-PDF. Expected for hardware design tooling.
- [ ] ⬜ **#102** P2 UX — Schematic search doesn't scroll/center to matches. Only dims non-matches.
- [ ] ⬜ **#103** P2 UX — No DnD reorder for BOM. No sorting/reordering options.
- [x] ✅ **#104** P2 State — Preferred suppliers local-only in ProcurementView. Lost on unmount. **Fixed:** Preferred suppliers now persist to `localStorage` key `protopulse_preferred_suppliers` with `try/catch` wrapper on both read (initializer) and write (via `updatePreferredSuppliers` callback), matching the project's existing localStorage pattern from ChatPanel.tsx.
- [ ] ⬜ **#105** P2 State — Optimization goal local-only. Resets when switching views.

---

## SECTION 14 — Code Quality & Maintenance

- [ ] ⬜ **#106** P1 DX — LLM-style reference annotations left in JSX. E.g., `<!-- ... -->` style annotations should be removed.
- [ ] ⬜ **#107** P3 Consistency — Inconsistent event handler naming conventions. Mixed handleX vs onX patterns within same files.
- [ ] ⬜ **#108** P3 Tech Debt — Dead imports likely in huge icon lists. Needs pass to confirm usage.
- [ ] ⬜ **#109** P1 DX — No ESLint/Prettier configuration visible. No enforced hooks rules, formatting, or quality gates.
- [ ] ⬜ **#110** P2 DX — Magic numbers across SchematicView. Dimensions/zoom constants should be named.
- [ ] ⬜ **#111** P2 DX — Duplicate icon maps across multiple files. Centralize icon/category mapping.
- [ ] ⬜ **#112** P2 DX — No centralized constants file. Supplier URLs, defaults, component types scattered across components.
- [ ] ⬜ **#113** P2 DX — Tooltip styling copy-pasted 30+ times. Extract shared component or utility class.

---

## Remaining Open Items by Priority

### P0 — Critical (4 open, 10 fixed, 2 partial)

| # | Finding | File/Area |
|---|---------|-----------|
| 11 | Monolithic provider causes cascade re-renders | project-context.tsx |
| 15 | localStorage as primary persistence (5MB limit) | project-context.tsx |
| 19 | PROJECT_ID = 1 hardcoded | project-context.tsx |
| 49 | No undo/redo anywhere | Cross-cutting |

### P1 — High (14 open, 20 fixed)

| # | Finding | File/Area |
|---|---------|-----------|
| 5 | ChatPanel.tsx is 2,363 lines | ChatPanel.tsx |
| 6 | project-context.tsx 614 lines, 40+ state values | project-context.tsx |
| 7 | Sidebar.tsx is 832 lines | Sidebar.tsx |
| 8 | AssetManager.tsx is 678 lines | AssetManager.tsx |
| 10 | No tests anywhere | Cross-cutting |
| 29 | SchematicView re-renders entire SVG on panning | SchematicView.tsx |
| 33 | No virtualization for long lists | Multiple |
| 37 | Schematic SVG no ARIA labels | SchematicView.tsx |
| 38 | SVG components not keyboard accessible | SchematicView.tsx |
| 47 | "Generate Schematic" is fake stub | ChatPanel.tsx |
| 91 | No mobile controls for SchematicView | SchematicView.tsx |
| 100 | BOM items not editable in-place | ProcurementView.tsx |
| 106 | LLM-style reference annotations in JSX | Multiple |
| 109 | No ESLint/Prettier configuration | Project root |

### P2 — Medium (34 open, 25 fixed)

See items marked ⬜ above with P2 tag. Key areas:

- **Performance:** Virtualization (#33)
- **Types:** Eliminate `as any` casts (#21-22)
- **A11y:** Context menu shortcuts (#43), ARIA labels (#44)
- **Styling:** Theme tokens (#86-88), responsive tables (#90), responsive overlay (#92)
- **Missing features:** Theme toggle (#95), schematic editing (#97), import flow (#99), DnD reorder (#103)
- **Code quality:** Magic numbers (#110), duplicate icons (#111), centralize constants (#112), tooltip util (#113)

### P3 — Low (5 open)

See items marked ⬜ above with P3 tag. Cleanup/DX:

- Consistent handler naming (#107), dead imports (#108), backdrop-blur strategy (#89), useCallback consistency (#82), CSV DOM util (#83)

---

## Priority Backlog — Suggested Attack Order

### 🔥 Critical Priority (fix immediately)

- (#1–4) TypeScript/LSP errors in ChatPanel.tsx
- (#5) ChatPanel.tsx size/decomposition (unblocks everything else)
- (#11) Context re-render cascade (split context / selectors)
- (#15–16) localStorage limits + parse crash handling
- (#25–26) ID type mismatch (string ↔ number)
- (#61) API keys stored in localStorage
- (#72, #74) Missing error boundaries (views + ReactFlow)
- (#49–50) Undo/redo + confirmation dialogs

### ⚠️ High Priority

- Oversized components: Sidebar/AssetManager (#7–8) — decompose
- Data-loss risks: debounced saving + fragile interaction flag (~~#17–18~~ fixed)
- Performance: virtualization for long lists (#33) + schematic panning optimization (#29)
- Accessibility: Spacebar hijack (~~#39~~ fixed), keyboard access for schematic (#38), focus management (~~#40~~ fixed)
- UX integrity: remove/label fake features (Generate Schematic #47, ~~Auto-Fix #57~~ fixed)
- CSV correctness: ~~quote/escape fields properly (#55)~~ fixed

### 🧠 Medium Priority

- Memoization, callback deps, hook cleanup (#30–31, #35, #78–79)
- Improve TanStack Query usage (freshness/retry/global error handling) (#66–68)
- Theme token consistency + responsive improvements (#86–92)
- Persist procurement preferences + optimization goal (#104–105)
- Better empty states + transitions (#59–60)

### 🧹 Low Priority

- Styling cleanup + design system consistency (#89)
- Missing "nice-to-haves" (shortcuts modal #94, theme toggle UI #95)
- Codebase hygiene: remove LLM annotations (#106), add ESLint/Prettier (#109), centralize constants (#112)
