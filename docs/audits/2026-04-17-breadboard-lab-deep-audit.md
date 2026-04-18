# Breadboard Lab Deep Audit — 2026-04-17

**Scope:** Every file in the Breadboard Lab surface (~40 files, ~4,000 LOC) plus e2e specs. Six parallel Explore agents produced independent findings which are consolidated here verbatim.

**Methodology:** Deep read of source + grep for smells (TODO/FIXME/HACK/any/eslint-disable) + coverage cross-reference + vault-claim reconciliation. Severities: `critical` > `high` > `medium` > `low` > `trivial`.

**Total findings: 399** across 6 sections.

**Sections:**
1. BreadboardView.tsx orchestration shell — 120 findings
2. Sidebar / dialogs / panels (8 components) — 64 findings
3. Canvas editing components (Grid, Renderer, Bench, Wire, DRC, Connectivity, Coach, Cursor, animations) — 54 findings
4. Trust / readiness / audit pure-lib (bench, part-inspector, layout-quality, board-audit, preflight) — 55 findings
5. Test coverage gaps (all Breadboard test files + e2e) — 53 findings
6. Model / sync / coach / 3D pure-lib — 53 findings

---

## How to read this

Each row: `#` | `file:line` | `category` | `severity` | `observation` | `suggested fix`.

Findings are the agents' output verbatim. Duplicate observations across sections are intentional — different agents saw the same symptom through different lenses, and each framing suggests a slightly different fix. Resolve duplicates when converting to backlog items.

---

## Section 1 — BreadboardView.tsx orchestration (120 findings)

**Agent scope:** `client/src/components/circuit-editor/BreadboardView.tsx` (2,284 lines). Default export + BreadboardToolbar + BreadboardCanvas + helpers.

1. BreadboardView.tsx:940 | code-debt | low | eslint-disable-next-line react-hooks/exhaustive-deps on centerOnBoardPixel useEffect — intentional but lacks documentation of WHY dependency is omitted. Improve comment.
2. BreadboardView.tsx:153-166 | code-debt | medium | buildAutoPlacementTemplate has repeated rowSpan calculation (Math.max(2, Math.ceil()) vs Math.max(1, Math.ceil())) for DIP vs non-DIP. Extract to helper.
3. BreadboardView.tsx:170-182 | code-debt | low | findAutoPlacement uses for-loop with return instead of Array.find() — inconsistent with codebase's higher-order style.
4. BreadboardView.tsx:197-212 | perf | low | buildPlacementForDrop duplicates rowSpan logic from buildAutoPlacementTemplate. Centralize to computeRowSpan().
5. BreadboardView.tsx:219-221 | code-debt | trivial | WIRE_COLORS palette has 10 hardcoded hex values with no metadata about sRGB/ColorSpace or WCAG contrast.
6. BreadboardView.tsx:225 | code-debt | trivial | WIRE_COLOR_PRESETS imported as MODEL_WIRE_COLOR_PRESETS then reassigned — unnecessary aliasing.
7. BreadboardView.tsx:231 | code-debt | high | BreadboardView default export is 2,284-line God component — orchestrates 20+ state vars, 50+ handlers, multiple render concerns. Extract Toolbar, Canvas, OverlaysWrapper.
8. BreadboardView.tsx:242-247 | code-debt | medium | Modal state scattered across 5 useState calls. Unify into openDialog enum-keyed map.
9. BreadboardView.tsx:254 | code-debt | low | boardAuditEnabled state set but never directly toggled — only via setBoardAuditEnabled(true) in handleRunBoardAudit. Derived state candidate.
10. BreadboardView.tsx:290-326 | code-debt | high | shoppingListItems memo has 23-line nested ternary chain with optional chaining at every step — silent null-coalescing hides failures.

11. BreadboardView.tsx:328-330 | a11y | low | useEffect to clear focusAuditIssue on circuit change doesn't announce focus reset to screen readers.
12. BreadboardView.tsx:332-334 | code-debt | low | openChatPanel callback dispatches CustomEvent — tight coupling to global event system. Use context or props.
13. BreadboardView.tsx:332-334 | code-debt | medium | Multiple window.dispatchEvent() calls throughout — anti-pattern. No error handling if listener missing.
14. BreadboardView.tsx:336-346 | code-debt | low | handleOpenBenchChat builds prompt but no memo — rebuilds every render if benchSummary.insights changes.
15. BreadboardView.tsx:348-361 | code-debt | medium | handleOpenBenchPlanner toast "Gemini ER planner primed" — 'Gemini' hardcoded. Should be i18n/configurable. No dispatchEvent fallback.
16. BreadboardView.tsx:364-407 | code-debt | high | handleTrackBenchPart is 44 lines with nested conditionals — too much responsibility. Split into validation hook + mutation handler.
17. BreadboardView.tsx:372-379 | code-debt | low | Silent error handling in handleTrackBenchPart — toast but no log or re-throw.
18. BreadboardView.tsx:383 | code-debt | trivial | Fallback part number `PART-${String(partId)}` inconsistent with refDesPrefix logic.
19. BreadboardView.tsx:409-431 | code-debt | low | handleQuickIntake duplicates BOM item structure from handleTrackBenchPart. Shared factory function needed.
20. BreadboardView.tsx:468-487 | code-debt | medium | handleCreateCircuit doesn't abort on unmount — setActiveCircuitId on unmounted component triggers memory leak warning.
21. BreadboardView.tsx:479 | code-debt | low | "Try again in a moment" error gives no context (network? validation? server?).
22. BreadboardView.tsx:538-558 | code-debt | high | handleRunPreflight computes filter counts inline in toast builder — pre-compute and reuse.
23. BreadboardView.tsx:568 | code-debt | low | handleLaunchExactDraft only closes exactPartDialogOpen; other modals left open. Clarify mutual exclusivity.
24. BreadboardView.tsx:571 | code-debt | high | handleStageExactPartOnBench uses `??` operator on async result — doesn't await properly.
25. BreadboardView.tsx:608-614 | UX | low | Loading state has no aria-label or aria-busy announcement.
26. BreadboardView.tsx:616-767 | code-debt | high | Main render has 150+ lines of conditional JSX — toolbar, canvas, empty state, 5 dialogs in one return. Extract sub-components.
27. BreadboardView.tsx:719-763 | UX | medium | Empty state is 5 lines of prose + 3 buttons. 5-second rule violated. Show visual hint or demo GIF.
28. BreadboardView.tsx:729-761 | UX | medium | "Expand from architecture" button has no hover tooltip explaining import source.
29. BreadboardView.tsx:774-844 | code-debt | medium | BreadboardToolbar is 71 lines embedded as local function — extract to separate file.
30. BreadboardView.tsx:803 | code-debt | low | Select onValueChange casts to Number without validation — NaN risk.

31. BreadboardView.tsx:820-836 | UX | low | Simulation toggle buttons show labels but no keyboard shortcut hint. Add "(S)" or register in handleKeyDown.
32. BreadboardView.tsx:850-2520 | code-debt | critical | BreadboardCanvas is 1,671 lines nested inside default export — vastly exceeds 500-line guide. Extract to separate module.
33. BreadboardView.tsx:909-912 | perf | medium | partsMap memo re-created on every parts change — no stable identity. Downstream memos thrash. Use WeakMap.
34. BreadboardView.tsx:927-941 | code-debt | low | BB-01 centering behavior not replicated on window resize — user resize leaves board in original position.
35. BreadboardView.tsx:950-953 | code-debt | low | benchInstances filter verbose. Simplify with explicit type guard.
36. BreadboardView.tsx:977-1015 | code-debt | high | resolveInteractiveWireTarget linear search with hardcoded 12px snap — magic number. O(n) scan; use spatial indexing for large parts.
37. BreadboardView.tsx:986 | code-debt | trivial | closestBenchDistance = Number.POSITIVE_INFINITY — use Infinity.
38. BreadboardView.tsx:1017-1032 | code-debt | medium | buildEndpointMeta returns null on falsy endpoints — silent failures. Log/warn instead.
39. BreadboardView.tsx:1035-1063 | code-debt | medium | instancePlacements memo recalculates for every instance even when most unchanged — no per-instance memoization.
40. BreadboardView.tsx:1040-1058 | code-debt | low | pixelToCoord used twice inline without null-check — snapped?.type checked only after assignment.
41. BreadboardView.tsx:1104-1118 | code-debt | medium | useEffect cleans autoPlacementRequests.current across two effects — no ordering guarantee, race possible.
42. BreadboardView.tsx:1144-1170 | code-debt | high | Wire sync uses wireSyncVersion.current string key — fragile. Use content hash for change detection.
43. BreadboardView.tsx:1158 | code-debt | low | syncSchematicToBreadboard result.wiresToCreate not validated — empty array silently proceeds.
44. BreadboardView.tsx:1172-1185 | code-debt | high | selectedValueEditor memo chains detectFamily / getFamilyValues / getCurrentValueLabel called from 3 separate memos. Consolidate.
45. BreadboardView.tsx:1178 | code-debt | medium | Double type cast `(part?.meta as Record<string,unknown>)?.type as string | undefined` hides type errors.
46. BreadboardView.tsx:1187-1200 | code-debt | medium | selectedInstanceModel memo depends on benchInsights[part.id] — thrashes on benchInsights recompute even if instance unchanged.
47. BreadboardView.tsx:1210-1241 | code-debt | high | focusAuditIssue effect searches by affectedInstanceIds[0] with no safety check — silently consumes focus if missing.
48. BreadboardView.tsx:1244-1263 | code-debt | medium | useBreadboardCoachPlan hook imported with 9 destructured values — facade for complex domain. Document relationships.
49. BreadboardView.tsx:1265-1268 | code-debt | low | useEffect clears coachPlanVisible / hoveredInspectorPinId on selectedInstanceId change — reactive; should be proactive in selection handler.
50. BreadboardView.tsx:1271-1290 | code-debt | high | handleValueChange mutates newProps without validating that inst.properties is an object — crash risk.

51. BreadboardView.tsx:1276-1278 | code-debt | trivial | Loop over existingProps just to convert to string. Object.assign overrides single key.
52. BreadboardView.tsx:1292-1350 | code-debt | high | handleSelectionAiAction builds 40-parameter object inline with no type definition or validation. Extract typed DTO factory.
53. BreadboardView.tsx:1307-1313 | code-debt | trivial | benchLayoutQuality fallback messages hardcoded strings.
54. BreadboardView.tsx:1352-1405 | code-debt | high | handleApplyCoachRemediation is 54 lines with nested conditionals — extract suggestion validation, refDes generation, instance creation.
55. BreadboardView.tsx:1367-1373 | code-debt | low | Toast "Coach action not implemented yet" — feature incomplete shipped behind flag.
56. BreadboardView.tsx:1375 | code-debt | trivial | reservedRefdes array built but never used for collision checking.
57. BreadboardView.tsx:1407-1516 | code-debt | critical | handleApplyCoachPlan is 110 lines of nested loops and mutations — no batch op. Silently fails if any mutation errors. Use Promise.all + transaction pattern.
58. BreadboardView.tsx:1495-1501 | code-debt | high | console.error in catch block for bench coach plan — use proper logger.
59. BreadboardView.tsx:1519-1565 | code-debt | high | ratsnestNets memo recalculates every time nets/instances change — no per-net caching.
60. BreadboardView.tsx:1526-1555 | code-debt | medium | Nested find calls inside map — O(n²) to build ratsnest pins. Pre-build instance map.
61. BreadboardView.tsx:1560 | code-debt | low | Ratsnest color assignment via modulo — net 1 and net 51 same color. Document or hash.
62. BreadboardView.tsx:1569-1604 | code-debt | low | handleTiePointClick has two branches building same WireInProgress — extract advanceWire() helper.
63. BreadboardView.tsx:1584 | code-debt | medium | getDefaultColorForNet(firstNet.name) called inline — firstNet could be undefined after nets?.[0].
64. BreadboardView.tsx:1606-1645 | code-debt | low | handleBenchConnectorClick duplicates wire init logic from handleTiePointClick.
65. BreadboardView.tsx:1659 | a11y | medium | handleTiePointHover highlights points but doesn't announce to screen reader.
66. BreadboardView.tsx:1697-1724 | code-debt | high | handleMoveEndpoint is 28 lines of coord/meta recalc — should be unit-tested, embedded in component makes it hard.
67. BreadboardView.tsx:1708 | code-debt | low | Explicit `?? null` coalescing — verbose.
68. BreadboardView.tsx:1711 | code-debt | medium | buildEndpointMeta called twice inside handleMoveEndpoint — reuse result.
69. BreadboardView.tsx:1754 | code-debt | low | Pan trigger `tool === 'select' && !hoveredCoord` — wire mode blocks pan with no affordance.
70. BreadboardView.tsx:1805 | code-debt | trivial | Zoom step 0.3 on wheel, 0.5 on button — inconsistent. Use ZOOM_STEP.
71. BreadboardView.tsx:1800-1809 | code-debt | high | Wheel listener (passive:false) never cleaned up — memory leak on remount.
72. BreadboardView.tsx:1811-1829 | code-debt | high | handleKeyDown has 7 ifs without event.preventDefault for non-Escape/Delete/z — steals shortcuts from other contexts.
73. BreadboardView.tsx:1814-1816 | UX | medium | Tool selection via 1/2/3 undocumented anywhere.
74. BreadboardView.tsx:1825-1828 | code-debt | low | handleCursorKeyDown result not announced — screen reader users get no feedback on arrow moves.
75. BreadboardView.tsx:1834-1842 | code-debt | low | clientToBoardPixel doesn't validate svgRef.current — silent null.
76. BreadboardView.tsx:1849-1873 | code-debt | high | handleDragOver uses hardcoded 'resistor' 2-pin placement for collision check — misleading preview.
77. BreadboardView.tsx:1862 | code-debt | trivial | Comment "Browser security" without link to dataTransfer spec.
78. BreadboardView.tsx:1879-2005 | code-debt | high | handleDrop is 127 lines with two main branches — extract or state machine.
79. BreadboardView.tsx:1891-1895 | code-debt | medium | JSON.parse with empty catch — silent parse failures. Log or toast.
80. BreadboardView.tsx:1905-1910 | code-debt | low | determinePlacementMode opaque — caller doesn't know benchPos threshold or fit derivation. Add link to surface model.

81. BreadboardView.tsx:1926 | code-debt | trivial | Toast "This board is too wide" — should say "This component is too wide".
82. BreadboardView.tsx:1979 | code-debt | medium | Starter shelf refDes uses charAt().toUpperCase() — doesn't handle multi-char type names like "crystal".
83. BreadboardView.tsx:1986 | code-debt | trivial | Hardcoded pin count 8 for IC/MCU fallback.
84. BreadboardView.tsx:2027-2067 | code-debt | medium | Toolbar has 8 buttons — exceeds 7-button cognitive load rule. Group into dropdown.
85. BreadboardView.tsx:2028-2037 | UX | low | Tool buttons show keyboard shortcut on touch devices.
86. BreadboardView.tsx:2036 | UX | medium | "DRC Check" label with no tooltip explaining DRC.
87. BreadboardView.tsx:2038-2051 | UX | low | Audit button shows live score with no scale explanation.
88. BreadboardView.tsx:2054-2061 | UX | low | Coordinate readout lacks grid size / snap distance indication.
89. BreadboardView.tsx:2062-2066 | UX | medium | "Drawing wire (N pts)" lacks instruction — add "Right-click color, double-click finish, Esc cancel".
90. BreadboardView.tsx:2072-2084 | a11y | high | SVG container tabIndex={0} but no role or aria-label — ARIA tree silent.
91. BreadboardView.tsx:2082 | a11y | medium | Container onKeyDown not scoped — input keys bubble through.
92. BreadboardView.tsx:2084-2090 | a11y | low | SVG has no aria-label/describedby.
93. BreadboardView.tsx:2093-2100 | code-debt | low | BreadboardGrid receives dropPreview as `?? undefined` — pass null directly.
94. BreadboardView.tsx:2106-2128 | code-debt | low | Keyboard cursor indicator is inline IIFE — extract component.
95. BreadboardView.tsx:2115-2116 | code-debt | trivial | Hardcoded #facc15 for keyboard cursor — use CSS var.
96. BreadboardView.tsx:2136-2143 | code-debt | medium | BreadboardComponentOverlay receives 4 props — context could clean up data flow.
97. BreadboardView.tsx:2145-2158 | code-debt | low | benchInstances.map key `bench-${String(inst.id)}` — inconsistent naming.
98. BreadboardView.tsx:2181-2272 | code-debt | high | Wire rendering loop is 92 lines of nested conditionals — extract WireRenderer.
99. BreadboardView.tsx:2185-2187 | code-debt | low | Wire provenance (isJumper/isSynced/isCoach) checked inline — build single enum wireStyle.
100. BreadboardView.tsx:2194 | code-debt | low | animDuration = Math.max(0.05, 16 / wireState.animationSpeed) — 16 magic. Use ANIMATION_FRAME_BUDGET.
101. BreadboardView.tsx:2237-2238 | code-debt | low | Jumper connector circles hardcoded r={3} fill="#f59e0b" — theme var / wire style object.
102. BreadboardView.tsx:2369 | code-debt | trivial | Magic 0.0001 for current threshold — const MIN_CURRENT_THRESHOLD.
103. BreadboardView.tsx:2355-2360 | code-debt | high | LED color mapping 6-branch ternary chain — use colorMap object.
104. BreadboardView.tsx:2372-2379 | code-debt | low | Simulation labels positioned at x+8, y+4 — hardcoded. Tie to component size.
105. BreadboardView.tsx:2388-2398 | code-debt | low | Switch state "ON"/"OFF" not i18n.
106. BreadboardView.tsx:2403-2437 | code-debt | low | Pin highlight inline IIFE — extract PinHighlightOverlay.
107. BreadboardView.tsx:2454-2475 | code-debt | medium | Wire color picker context menu absolute without boundary checks — overflow on mobile.
108. BreadboardView.tsx:2461 | UX | low | "Wire Color" label not tied to buttons via fieldset/aria-labelledby.
109. BreadboardView.tsx:2463-2472 | code-debt | low | Color button grid hardcoded 4 columns.
110. BreadboardView.tsx:2477-2500 | code-debt | medium | BreadboardPartInspector receives 9 props — heavy drilling. Context or compound pattern.

111. BreadboardView.tsx:2502-2516 | UX | low | Empty state guidance at canvas bottom — off-screen when zoomed.
112. BreadboardView.tsx:2512 | UX | medium | "Wire tool (2)... real pin rows" — confusing breadboard terminology for newcomers.
113. BreadboardView.tsx:2520 | test-gap | critical | No unit tests — 2,284 lines of placement/collision/drag/wire/undo logic untested.
114. BreadboardView.tsx:153-212 | audit-scoring | low | Placement helpers need edge-case tests — pinCount=0? rowSpan > BB.ROWS?
115. BreadboardView.tsx:1035-1091 | code-debt | medium | Memoization cache keys rely on partsMap reference — recreated on every render. Downstream memos thrash.
116. BreadboardView.tsx:1144-1170 | audit-scoring | high | Wire sync version key uses sorted-ID string — fragile. Use content hash.
117. BreadboardView.tsx:1812-1829 | sync | high | handleKeyDown tool/undo changes not synced to parent state or history log.
118. BreadboardView.tsx:1144-1170 | DRC | low | Synced wires not marked auditable — audit can't distinguish manual vs synced.
119. BreadboardView.tsx:2024-2519 | coach | high | Coach plan overlay conditional on coachPlanVisible && coachPlan — if plan becomes null while visible, no graceful degrade.
120. BreadboardView.tsx:1407-1516 | vault-integration | low | Coach remediation doesn't cite vault notes — user can't learn why suggestion was made.

---

## Section 2 — Sidebar / Dialogs / Panels (64 findings)

**Agent scope:** BreadboardWorkbenchSidebar, StarterShelf, InventoryDialog, ExactPartRequestDialog, QuickIntake, ReconciliationPanel, ShoppingList, BoardAuditPanel, PartInspector.

121. BreadboardWorkbenchSidebar.tsx:49-56 | UX | medium | StatChip label + value no visual hierarchy. Add font-weight/mono emphasis.
122. BreadboardWorkbenchSidebar.tsx:85-87 | a11y | high | `<aside>` has no aria-label.
123. BreadboardWorkbenchSidebar.tsx:106-116 | UX | low | Nine stat chips in 3×3 grid overwhelm. Group by section; collapse advanced.
124. BreadboardWorkbenchSidebar.tsx:119-150 | UX | medium | "No wiring canvas yet" below fold. Move above stat chips or highlight.
125. BreadboardWorkbenchSidebar.tsx:218 | UX | medium | Quick Intake inline but no purpose label. Add Zap icon.
126. BreadboardWorkbenchSidebar.tsx:329-344 | UX | medium | "Bench Shelf" title redundant after StarterShelf above. Rename to "Project Parts Shelf".
127. BreadboardStarterShelf.tsx:19-76 | copy | low | STARTER_PARTS hardcoded. Extract to lib/breadboard-starter-parts.ts.
128. BreadboardStarterShelf.tsx:82-110 | a11y | medium | Draggable button lacks aria-pressed / aria-grabbed.
129. BreadboardStarterShelf.tsx:92-97 | a11y | high | Focus-visible:ring-offset-2 may be invisible on dark bg. Add explicit shadow ring.
130. BreadboardStarterShelf.tsx:105 | copy | low | "Starter drop" label in every card — redundant.
131. BreadboardInventoryDialog.tsx:147-434 | UX | medium | Five filter states, no count indication. Add "12 parts" badge per filter.
132. BreadboardInventoryDialog.tsx:264-270 | UX | low | Summary chips don't update live as user edits drafts.
133. BreadboardInventoryDialog.tsx:313-322 | UX | medium | Empty state mentions "Gemini ER" but no action button.
134. BreadboardInventoryDialog.tsx:336-357 | UX | medium | FitBadge / QualityBadge color-only differentiation — ensure text label always visible.
135. BreadboardInventoryDialog.tsx:360-394 | UX | high | Three input fields no validation feedback; negative numbers accepted. Add inputMode=numeric + min=0.
136. BreadboardInventoryDialog.tsx:397-424 | UX | medium | Button labels inconsistent based on isTracked. Standardize to "Save" / "Mark ready".
137. BreadboardInventoryDialog.tsx:419-423 | UX | low | Missing quantity feedback in small text — move to prominent inline badge.
138. BreadboardInventoryDialog.tsx:45-53 | code-debt | low | sanitizeInteger hardcoded fallbacks; no bounds validation. Use useInventoryDraft hook.
139. BreadboardExactPartRequestDialog.tsx:28-32 | copy | low | EXAMPLE_REQUESTS hardcoded. Extract to lib module.
140. BreadboardExactPartRequestDialog.tsx:99-319 | a11y | medium | No role="tabpanel" or semantic grouping. Use <section> with aria-labelledby.

141. BreadboardExactPartRequestDialog.tsx:113-119 | UX | medium | Status badge only indicator; no explanatory text below title.
142. BreadboardExactPartRequestDialog.tsx:190-195 | UX | low | "Awaiting request" empty state has no examples inline.
143. BreadboardExactPartRequestDialog.tsx:199-251 | progressive-disclosure | medium | All matches shown at once; paginate or show top 3 initially.
144. BreadboardExactPartRequestDialog.tsx:207-235 | UX | medium | Match cards high text density. Collapse matchReasons into toggle.
145. BreadboardExactPartRequestDialog.tsx:210-217 | copy | low | "Verified exact" / "Candidate exact" vs dialog title "Exact Part Resolver" — inconsistency.
146. BreadboardExactPartRequestDialog.tsx:253-308 | UX | medium | Playbook section has checklist but no guidance if user closes without creating draft.
147. BreadboardQuickIntake.tsx:1-107 | UX | low | No `required` attributes or asterisk indicators.
148. BreadboardQuickIntake.tsx:61-77 | UX | medium | Part name + Scan squashed on small displays. Test iPhone SE (375px).
149. BreadboardQuickIntake.tsx:61-66 | a11y | medium | Input placeholder "Part name" but no <label htmlFor>.
150. BreadboardQuickIntake.tsx:38-52 | code-debt | low | handleSubmit trims name but not quantity/storage consistently.
151. BreadboardQuickIntake.tsx:68-77 | UX | medium | Scan button enabled even when onScan undefined — silent failure.
152. BreadboardQuickIntake.tsx:79-104 | a11y | low | Quantity input type=number but no aria-label.
153. BreadboardReconciliationPanel.tsx:16-93 | UX | high | Reconciliation delta "3 / 5" no visual shortfall indicator. Replace with "3 / 5 (need +2)" + color.
154. BreadboardReconciliationPanel.tsx:21-39 | UX | medium | Summary lacks severity breakdown ("Critical: 2, Low stock: 1").
155. BreadboardReconciliationPanel.tsx:42-47 | UX | medium | "All parts in stock" CheckCircle2 — no pulse/celebration.
156. BreadboardReconciliationPanel.tsx:66-88 | a11y | low | Insight rows no role="row" or table semantics.
157. BreadboardShoppingList.tsx:49-116 | UX | medium | CSV filename hardcoded — no customization. Add Export as... dropdown.
158. BreadboardShoppingList.tsx:59-64 | UX | low | Total cost omits null-price parts — displayed total misleading.
159. BreadboardShoppingList.tsx:86-112 | UX | medium | key={part.mpn} not unique across quantities — React reconciliation bug risk.
160. BreadboardShoppingList.tsx:100-109 | UX | medium | "No price found" in amber but row no visual distinction. Add badge.
161. BreadboardShoppingList.tsx:27-37 | code-debt | medium | CSV hardcodes column order; no enum.
162. BreadboardBoardAuditPanel.tsx:29-53 | UX | high | Score (1-100) no narrative explanation. Add tooltip legend + band label.
163. BreadboardBoardAuditPanel.tsx:255-293 | UX | medium | Score badge and severity counts separated by gap. Move counts adjacent.
164. BreadboardBoardAuditPanel.tsx:138-199 | UX | medium | IssueRow no inline "Focus this issue" quick action on hover.
165. BreadboardBoardAuditPanel.tsx:179-193 | UX | high | "Focus part" only shown if affectedInstanceIds > 0 — info-level issues have no action.
166. BreadboardBoardAuditPanel.tsx:169-177 | UX | low | Affected pin IDs as small badges — no hover tooltip with role.
167. BreadboardBoardAuditPanel.tsx:318-326 | UX | medium | max-h-[340px] scroll with no "Show X more" indicator.
168. BreadboardBoardAuditPanel.tsx:340-422 | UX | medium | Preflight below audit — off-screen if list long. Sticky or move above.
169. BreadboardBoardAuditPanel.tsx:386-408 | UX | medium | Preflight check status but no inline "fix this" action.
170. BreadboardBoardAuditPanel.tsx:414-422 | UX | medium | Stash Reconciliation after preflight — no header or visual separation.

171. BreadboardPartInspector.tsx:256-779 | UX | high | Inspector 330px wide `absolute right-3 top-3`; no collision detection. Switch to modal on <768px or bottom drawer.
172. BreadboardPartInspector.tsx:299-323 | UX | medium | Five badges stacked — wrap badly on small widths. Limit to 3; move pinCount to stat row.
173. BreadboardPartInspector.tsx:313-319 | trust-tier | high | Status badge uses "Verified exact"/"Candidate exact" — doesn't match 4-tier design (verified-exact, connector-defined, heuristic, stash-absent). Map to full scheme.
174. BreadboardPartInspector.tsx:335-353 | UX | medium | "Bench trust" text-only description — no visual trust-tier badge/icon.
175. BreadboardPartInspector.tsx:346-350 | UX | medium | authoritativeWiringAllowed warning static; no remediation action.
176. BreadboardPartInspector.tsx:366-389 | UX | low | Safety warnings unordered text — no severity badges.
177. BreadboardPartInspector.tsx:417-427 | UX | medium | Coach stats 2×2 grid with no legend for exact vs heuristic meaning.
178. BreadboardPartInspector.tsx:496-538 | UX | medium | Bench plan actions status badges but no animation/pulse on apply.
179. BreadboardPartInspector.tsx:540-555 | UX | low | Support parts as plain badges — no placement hint or add-to-stash tooltip.
180. BreadboardPartInspector.tsx:610-659 | UX | medium | Value editor options no explanation — add label, show tolerance.
181. BreadboardPartInspector.tsx:661-727 | UX | medium | Pin map shows all pins in scroll (max-h-36) — 40+ pins overwhelming. Filter/sort; limit to 10 initial.
182. BreadboardPartInspector.tsx:673-724 | a11y | medium | Pin rows use mouse-only hover; no onFocus/onBlur for keyboard users.
183. BreadboardPartInspector.tsx:719-721 | UX | low | Pin coord "J5" label no layout legend.
184. BreadboardPartInspector.tsx:728-775 | UX | medium | AI action buttons no disabled state indication.

---

## Section 3 — Canvas Editing Components (54 findings)

**Agent scope:** BreadboardGrid, ComponentRenderer, BenchPartRenderer, WireEditor, DrcOverlay, ConnectivityOverlay, ConnectivityExplainer, CoachOverlay, useBreadboardCursor, breadboard-animations.css.

185. BreadboardGrid.tsx:58-61 | svg-correctness | medium | HOLE_RADIUS (2.8), HOLE_RADIUS_RAIL (2.4) hardcoded px without justification. Breadboard pitch 2.54mm = 10px; 2.8 ≈ 7mm, undersized. Define as BB.PITCH * 0.28.
186. BreadboardGrid.tsx:112 | svg-correctness | low | ROW_LABELS [1,5,10,15,...,63] skips rows 2-4, 6-9 — uneven visual density.
187. BreadboardGrid.tsx:268-284 | snap-behavior | low | Center channel rect uses magic offsets (HOLE_RADIUS+1, channelW=fPos.x-ePos.x-2*(HOLE_RADIUS+1)). Explicit formula needed.
188. BreadboardGrid.tsx:305 | z-order | low | Rail lane backgrounds opacity:0.6 before holes — opacity creates false depth.
189. BreadboardGrid.tsx:372 | hit-testing | medium | Hole radius +1 on hover — inconsistent hit-zone (rail 3.4 vs terminal 3.8). Define HOVER_RADIUS_DELTA.
190. BreadboardGrid.tsx:408-572 | svg-correctness | low | SVG root missing role="img" + <title>/<desc>.
191. BreadboardGrid.tsx:158 | snap-behavior | medium | onClick uses raw SVG coords — no snapping enforced on callback.
192. BreadboardComponentRenderer.tsx:58-68 | photorealism-vs-correctness | low | No comparable hole-rendering across layers; inconsistent hole sizes.
193. BreadboardComponentRenderer.tsx:160-177 | photorealism-vs-correctness | medium | Exact-view transform origin (pos.x, pos.y) off-center for breadboardRotation — rotation bug.
194. BreadboardComponentRenderer.tsx:226 | perf | low | IcSvg pinCount = (part?.connectors).length || 8 — no memoization.
195. BreadboardComponentRenderer.tsx:383-395 | a11y | medium | Value label fontSize=4 with no aria — simulation data no semantic structure.
196. BreadboardBenchPartRenderer.tsx:72-76 | hit-testing | medium | Anchor visible r=3.1 + invisible r=6 hit area — 2x hit zone.
197. BreadboardBenchPartRenderer.tsx:128-141 | photorealism-vs-correctness | low | Fallback rect hardcoded (x:-34, width:68); Mega overflows.
198. BreadboardBenchPartRenderer.tsx:142-168 | svg-correctness | low | Fallback renders only first 8 anchors (slice(0,8)) — silent truncation for larger parts.
199. BreadboardWireEditor.tsx:57 | cursor-state | low | HANDLE_RADIUS_PX=5 scaled by zoom; at zoom=3 → 1.67 board px. Too small for touch. Use max(handleR, 3).
200. BreadboardWireEditor.tsx:104-118 | snap-behavior | medium | createSVGPoint + getScreenCTM assumes transform group at specific nesting — undocumented.

201. BreadboardWireEditor.tsx:122-129 | snap-behavior | medium | Alt+click wire split — no visual preview before split.
202. BreadboardWireEditor.tsx:155-157 | cursor-state | medium | Window listeners without preventDefault — competing drags possible.
203. BreadboardWireEditor.tsx:258 | hit-testing | medium | strokeWidth = max(8/zoom, wire.width + 4/zoom) — huge at zoom=0.5 (16px). Cap max hit-width.
204. BreadboardWireEditor.tsx:298-310 | visual-hierarchy | low | Endpoint handles no start/end distinction. Color start=green, end=red.
205. BreadboardDrcOverlay.tsx:2-7 | accessibility | medium | No accessible summary. Add role="region" aria-label="DRC Violations" + accessible list.
206. BreadboardDrcOverlay.tsx:159 | drop-preview | low | Tooltip width = min(message.length * 3.5 + 8, 180) — character-based fragile with variable fonts.
207. BreadboardDrcOverlay.tsx:174 | accessibility | low | Truncated tooltip (len > 50 → '...') without title attr for full message.
208. BreadboardConnectivityOverlay.tsx:36-37 | perf | medium | HOLE_OVERLAY_RADIUS=3.2 fixed — huge at high zoom. Scale with zoom.
209. BreadboardConnectivityOverlay.tsx:113-119 | perf | medium | <animate> on every hole (600+) indefinite — layout recalc. Use CSS or rAF; cap to ≤100.
210. BreadboardConnectivityExplainer.tsx:45-81 | snap-behavior | low | 126 row-group rects pre-computed even if explainer hidden. Wrap in useMemo with visible flag.
211. BreadboardConnectivityExplainer.tsx:94-97 | svg-correctness | low | Channel rect magic padding (±4, -8) hardcoded.
212. BreadboardCoachOverlay.tsx:31-51 | visual-hierarchy | low | Default signal color #e2e8f0 light gray — hard to see on white. Use #5b9aff.
213. BreadboardCoachOverlay.tsx:67-75 | visual-hierarchy | low | pending vs staged differ in opacity/stroke — no tooltip/legend explaining.
214. BreadboardCoachOverlay.tsx:290-298 | hit-testing | low | Apply button position (pixel.x+10, pixel.y+6) — clamp to board bounds.
215. useBreadboardCursor.ts:47-75 | keyboard-nav | medium | moveCursor clamps col [0, ALL_COLS-1] — no wrap. Tab wraps but arrows don't. Add wrap mode option.
216. useBreadboardCursor.ts:127 | keyboard-nav | low | Enter while cursor.active — no check if Enter meant for text input. Accidental wire start.
217. breadboard-animations.css:12-25 | perf | low | snap-pulse uses transform:scale + filter:brightness — filter expensive. Drop filter.
218. breadboard-animations.css:39-47 | perf | low | cursor-blink indefinite opacity cycle — pause after inactivity.
219. breadboard-animations.css:89-96 | a11y | medium | prefers-reduced-motion disables ALL animations; no fallback snap-feedback.
220. breadboard-model.ts:37 | svg-correctness | low | PITCH=10 ≈ 2.54mm @96dpi rounded. Not documented; no DPI scaling.
221. breadboard-model.ts:40-41 | svg-correctness | low | ORIGIN_X=30, ORIGIN_Y=50 hardcoded. If labels widen (row "1-63"), overlap.
222. breadboard-model.ts:101-136 | snap-behavior | medium | "top" rails on LEFT, "bottom" rails on RIGHT — confusing physical vs circuit naming.
223. breadboard-model.ts:142 | hit-testing | low | pixelToCoord snapRadius default BB.PITCH*0.6=6px — assumes pitch=10. Make dynamic.
224. breadboard-model.ts:407-446 | snap-behavior | medium | getOccupiedPoints for startCol='a' assumes only col 'a' — multi-col resistor wrong. Add colSpan iteration.
225. BreadboardView.tsx:219-222 | visual-hierarchy | low | WIRE_COLORS modulo — 11+ nets collide. Use deterministic hash(netId).
226. BreadboardView.tsx:256-259 | perf | low | breadboardWires useMemo [wires] dep — if wires recreated every render, memo wasted.
227. BreadboardView.tsx:890 | perf | medium | Zoom default=3; on 50px board → 3000px SVG. Cap [1,10] or tile-render.
228. BreadboardView.tsx:914-925 | snap-behavior | medium | centerOnBoardPixel without SVG-mount null check — getBoundingClientRect may be 0.
229. BreadboardView.tsx:1569-1599 | keyboard-nav | low | Click + Enter both can start wire — race condition.
230. BreadboardView.tsx:2213-2232 | visual-hierarchy | low | Wire color logic tangled — explicit color-code by net type.

231. BreadboardView.tsx:2275-2290 | drop-preview | low | resolveEndpointTarget snap distance 12px hardcoded — scale by 1/zoom.
232. BreadboardView.tsx:1035-1063 | collision | medium | Duplicate coord snaps silently both added — no collision check in instancePlacements loop.
233. BreadboardView.tsx:1047-1049 | photorealism-vs-correctness | low | DIP detection assumes type in {ic,mcu} with rowSpan=ceil(pinCount/2) — SMD wrong.
234. BreadboardView.tsx:2106-2127 | accessibility | low | Keyboard cursor <circle> no aria/role. Add role="status" with position.
235. BreadboardDrcOverlay.tsx:109-112 | connectivity-graph | low | DRC useMemo deps (nets, wires, instances, parts) — no content-hash cache; always recomputes.
236. BreadboardGrid.tsx:450-470 | z-order | low | Highlight-overlay correct but fragile — add comment documenting z-order contract.
237. BreadboardBenchPartRenderer.tsx:38-40 | snap-behavior | low | innerTransform undefined if exactBounds null — fallback rect not centered.
238. BreadboardConnectivityOverlay.tsx:87-100 | perf | low | Array.from(netGroups.entries()) creates array every render — use .entries() directly.

---

## Section 4 — Trust / Readiness / Audit Pure-Lib (55 findings)

**Agent scope:** breadboard-bench.ts, breadboard-part-inspector.ts, breadboard-layout-quality.ts, breadboard-board-audit.ts, breadboard-preflight.ts.

239. breadboard-bench.ts:86 | audit-rule-coverage | critical | inferBreadboardFit() lacks ESP32 GPIO6-11 flash pin detection — no vault-aware hard error. Add checkRestrictedPins step.
240. breadboard-part-inspector.ts:142-154 | audit-rule-coverage | critical | resolveVerifiedBoard() only matches 'board-module'/'driver' — misses ESP32/ESP8266 classified as 'mcu' but needing strapping rules.
241. breadboard-board-audit.ts:305-341 | audit-rule-coverage | high | checkRestrictedPinUsage() only fires when verified board found. For heuristic parts no fallback. Add ESP32 pattern detection.
242. breadboard-board-audit.ts:396-448 | audit-rule-coverage | high | checkAdcWifiConflict() lacks dynamic thresholding — doesn't check if WiFi actually enabled in project.
243. breadboard-bench.ts:49-62 | pure-function-cleanliness | medium | normalizeToken returns empty string; includesNormalized has confusing double-negation. Refactor to null sentinel.
244. breadboard-board-audit.ts:451-512 | readiness-math | high | checkMissingGroundReturn too strict — doesn't account for multi-pin ground or rail implicit ground.
245. breadboard-layout-quality.ts:84 | severity-calibration | medium | Pin trust -10 per critical heuristic pin — drops to 24 floor with 3+. Unrealistically pessimistic. Use -5 or raise floor to 30.
246. breadboard-layout-quality.ts:117-125 | scoring-invariant | medium | Overall score weights + stash modifier ±5 — non-monotonic when stash flips. Clamp modifier to ±3.
247. breadboard-part-inspector.ts:220-228 | trust-tier-derivation | medium | normalizePartMeta doesn't validate instance.properties.type matches part.meta.type — trust divergence. Add edit-distance warn.
248. breadboard-part-inspector.ts:289-297 | pure-function-cleanliness | low | buildSyntheticConnectors hardcodes connectorType='pad' with empty shapeIds — no way to distinguish synthetic. Add synthetic:true flag.
249. breadboard-board-audit.ts:79-95 | pure-function-cleanliness | low | buildPartIndex / buildInstanceIndex silently overwrite duplicate IDs. Add assertion.
250. breadboard-preflight.ts:116-120 | type-safety | medium | isPlaced() unsafe property access — benchX undefined still passes because undefined != null is false. Explicit pair check needed.
251. breadboard-preflight.ts:155-193 | pure-function-cleanliness | medium | hasDecouplingCapOnNet walks all nets/segments per call — no caching. O(n*k) for 100+ nets.
252. breadboard-board-audit.ts:14 | vault-integration | critical | Import inferTraps from heuristic-trap-inference — no visibility into trap-rule coverage vs vault hazards (BLDC, Hall, I2C, decoupling). Create manifest constant.
253. breadboard-bench.ts:155-177 | audit-rule-coverage | medium | inferBenchCategory hardcodes family→category strings; no vault cross-reference.
254. breadboard-layout-quality.ts:48-60 | scoring-invariant | medium | bandLabel default case unreachable (switch exhaustive) — dead code.
255. breadboard-part-inspector.ts:429-450 | pure-function-cleanliness | low | buildCoachHeadline / buildOrientationSummary repeat toLowerCase/family-check 4+ times.
256. breadboard-board-audit.ts:305-341 | audit-rule-false-negative | high | checkRestrictedPinUsage only flags vbPin?.restricted===true; misses verifiedPin.warnings with "Flash pin"/"Strapping pin".
257. breadboard-board-audit.ts:646-726 | audit-rule-coverage | critical | checkMotorDriverTraps detects by title pattern alone — no vault motor-family confirmation. False positives on LED drivers.
258. breadboard-preflight.ts:302-350 | severity-calibration | high | checkPowerBudget WARNING 400mA, FAIL 500mA USB — no separate check for breadboard power module 700mA external. USB+external combo may exceed.
259. breadboard-board-audit.ts:236-303 | audit-rule-coverage | high | checkMissingDecoupling proximity-only (within 2 rows) — doesn't verify cap on same net or adjacent rail.
260. breadboard-part-inspector.ts:156-165 | pure-function-cleanliness | low | buildVerifiedPinIndex iterates pins twice (name + id). Single loop.

261. breadboard-board-audit.ts:133-136 | type-safety | medium | parseNetSegments casts raw JSONB without validation. Add segment shape check.
262. breadboard-preflight.ts:210-259 | audit-rule-coverage | medium | checkVoltageMismatch (>0.5V spread) but no I2C pull-up voltage mismatch check.
263. breadboard-bench.ts:179-195 | audit-rule-coverage | medium | isStarterFriendly uses hardModeFamilies set — no part-specific exceptions.
264. breadboard-part-inspector.ts:599-679 | pure-function-cleanliness | medium | buildBreadboardSelectedPartModel 140+ lines with deeply nested ternaries. Extract.
265. breadboard-board-audit.ts:514-593 | audit-rule-coverage | medium | checkWireDensityHotspots counts all endpoints per row — false positives on power rails.
266. breadboard-board-audit.ts:596-644 | audit-rule-false-positive | medium | checkUnconnectedPowerPins flags ANY identifiable power/ground pin — some NC/bypass optional pins falsely flagged.
267. breadboard-layout-quality.ts:66-125 | readiness-math | medium | pinTrustScore doesn't weight power/ground pin coverage specifically. Add power-pin-trust factor.
268. breadboard-part-inspector.ts:346-423 | pure-function-cleanliness | medium | classifyPinRole inline regex library (60+ lines) — no extension path. Extract ROLE_PATTERNS.
269. breadboard-board-audit.ts:138-158 | audit-rule-coverage | high | isPowerConnector / isGroundConnector regex — no i18n silkscreen, no aliases (PWR/VCC, VSS/GND). Call vault normalizer.
270. breadboard-preflight.ts:195-204 | audit-rule-coverage | critical | ESP32 ADC2 GPIO list hardcoded — no vault link or runtime fetch. Stale if new ESP32 variant ships.
271. breadboard-board-audit.ts:780-793 | severity-calibration | high | SEVERITY_WEIGHT critical=15, warning=8, info=3 — 3 critical = 55pt deduction (score 45 "Risky"). 3 restricted-pin violations should be worse. Recalibrate critical=20.
272. breadboard-layout-quality.ts:38-46 | type-safety | low | metricTone thresholds ≥85 vs ≥65 hardcoded. Define GOOD_THRESHOLD / WATCH_THRESHOLD.
273. breadboard-bench.ts:215-278 | pure-function-cleanliness | low | buildBreadboardBenchSummary totals via multiple filter+length — O(n*k). Single reduce.
274. breadboard-part-inspector.ts:543-556 | audit-rule-false-negative | medium | buildCoachCautions max 4 (slice 554) — all slots filled before board warnings. User misses board warnings.
275. breadboard-board-audit.ts:753-754 | audit-rule-coverage | medium | Heuristic trap skip doesn't distinguish exact verified vs partial match. Only skip if status==='verified' AND board found.
276. breadboard-preflight.ts:261-300 | audit-rule-coverage | high | checkMissingDecoupling only checks presence — not cap value (should be 100nF ceramic) or type. 1uF electrolytic falsely "present".
277. breadboard-board-audit.ts:165-171 | pure-function-cleanliness | low | getBreadboardRow does Math.round on integer — redundant. Document or remove.
278. breadboard-part-inspector.ts:644-680 | type-safety | medium | Spread syntax `...(vbPin?.warnings ? {...} : {})` — TypeScript can't narrow verifiedWarnings presence. Use explicit optional.
279. breadboard-layout-quality.ts:86-95 | readiness-math | medium | railScore +6 hookup complete / +4 bridge complete AFTER pct calc — bonuses wasted when at 100% (clamped).
280. breadboard-board-audit.ts:197-210 | pure-function-cleanliness | low | getSegmentsForInstance re-scans net list every call — no cache.
281. breadboard-preflight.ts:37-42 | type-safety | medium | PreflightInput wires: unknown[] — never referenced in runPreflight. Remove or document.
282. breadboard-part-inspector.ts:231-252 | pure-function-cleanliness | medium | inferLegComponentType series of lowercase-checks — cache lowered string.
283. breadboard-board-audit.ts:342-394 | audit-rule-false-positive | high | checkStrappingPinConflicts flags ANY non-power net on boot pin — pull-ups tolerated. Query verified board metadata for acceptable types.
284. breadboard-bench.ts:197-213 | pure-function-cleanliness | low | findBomMatch normalized substring only — no fuzzy match. "2N222" doesn't match "2N2222".
285. breadboard-layout-quality.ts:72-84 | scoring-invariant | medium | pinTrustBase (96, 80, 62) and modelQualityModifier (4,2,0,-4) hardcoded — no derivation comments.
286. breadboard-board-audit.ts:812-836 | pure-function-cleanliness | low | auditBreadboard filters instances twice (function + per-check).
287. breadboard-part-inspector.ts:105-115 | type-safety | medium | CoachContext insight optional — no compile-time presence guarantee. Strict null checks or guard.
288. breadboard-preflight.ts:102-105 | pure-function-cleanliness | low | isPowerNet only netType==='power'; inconsistent with board-audit isPowerOrGroundNet which also checks name.
289. breadboard-board-audit.ts:464-512 | audit-rule-coverage | critical | checkMissingGroundReturn issue message shows connector names only, not IDs. User confusion which pin missing. Include both.
290. breadboard-layout-quality.ts:126-129 | readiness-math | medium | Band thresholds (85,68,48) hardcoded — no vault link for semantic mapping.

291. breadboard-part-inspector.ts:72-75 | audit-rule-coverage | low | hasPreciseBreadboardArtwork only checks shapes.length > 0 — doesn't validate completeness per-pin.
292. breadboard-board-audit.ts:1-14 | remediation-copy | medium | All 9 checks return detail text but no vault doc link. Add remediationLink field.
293. breadboard-preflight.ts:485-523 | pure-function-cleanliness | medium | runPreflight sequential 5 checks — independent, could be Promise.all parallel for large part lists.

---

## Section 5 — Test Coverage Gaps (53 findings)

**Agent scope:** all Breadboard test files under `__tests__/` and `e2e/`.

294. BreadboardComponentRenderer.test.tsx:40 | missing-test-case | high | Only 2 test cases for critical renderer. Missing: rotation, Z-order, selection, hover.
295. BreadboardConnectivityExplainer.test.tsx:6 | assertion-weakness | medium | Tests only check presence — no opacity, label, position validation.
296. BreadboardExactPartRequestDialog.test.tsx:35 | no-happy-path | high | "Shows a verified match" doesn't simulate full flow (input → resolve → place).
297. BreadboardExactPartRequestDialog.test.tsx:35 | missing-test-case | high | No verified board registry lookup, fallback to draft, or playbook routing tests.
298. BreadboardGridDropPreview.test.tsx:32 | assertion-weakness | medium | Stroke presence checked but not color value. Assert exact RGB/hex.
299. BreadboardGridFitZone.test.tsx:43 | no-edge-case | medium | Missing: zones beyond board bounds, overlapping zones, DIP-specific crossing.
300. BreadboardQuickIntake.test.tsx:8 | no-happy-path | medium | No scan-to-submit workflow end-to-end test.
301. BreadboardQuickIntake.test.tsx:51 | no-edge-case | medium | Boundary: negative qty, NaN, >999, unicode in part name.
302. BreadboardReconciliationPanel.test.tsx:71 | missing-test-case | medium | "Shows have/need" doesn't validate exact ratio format ("3 / 5").
303. BreadboardReconciliationPanel.test.tsx:71 | missing-test-case | high | No tests for all-clear animations, ready-to-build state, progress.
304. BreadboardShoppingList.test.tsx:30 | no-happy-path | high | Only renders table; no distributor filter, price sort, multi-supplier compare.
305. BreadboardShoppingList.test.tsx:67 | flaky-pattern | medium | CSV export mocks URL.createObjectURL but doesn't validate CSV format. Parse Blob.
306. BreadboardView.test.tsx:499 | assertion-weakness | medium | "Renders container" no canvas sizing, viewBox, responsive layout checks.
307. BreadboardView.test.tsx:578 | no-edge-case | high | Keyboard tests hardcode '1','2','3' — no modifiers, repeated, simultaneous.
308. BreadboardView.test.tsx:622 | missing-test-case | high | AI features: no prompt-content validation, context threading, API-failure fallback.
309. BreadboardView.test.tsx:873 | no-edge-case | high | Jumper wire creation: no path-around-obstacle, snap-to-grid, multi-waypoint tests.
310. BreadboardWireEditor.test.tsx:29 | assertion-weakness | medium | "Previews and commits snapped endpoint targets" no intermediate drag-preview assertion.
311. breadboard-connectivity.test.ts:108 | missing-test-case | medium | classifyNet edge cases: "VCC " trailing space, empty string.
312. breadboard-connectivity.test.ts:242 | no-edge-case | high | buildConnectivityMap: NaN coords, long wires spanning board, duplicate endpoints untested.
313. breadboard-connectivity.test.ts:280 | missing-test-case | medium | Rail expansion boundary (0 vs 62), color consistency across rails.
314. breadboard-drag-move.test.ts:15 | no-regression-test-for-known-bug | high | No regression test for Mega (off-board-only) rejection.
315. breadboard-drc.test.ts:137 | missing-test-case | high | Missing: trust-tier-collapse when exact→candidate fallback.
316. breadboard-drc.test.ts:197 | no-edge-case | medium | Short-circuit: floating nets (no wires), single-endpoint nets untested.
317. breadboard-model.test.ts:50 | no-edge-case | medium | areConnected: rail boundary (62), column boundary (e→f), wrapping.
318. breadboard-model.test.ts:105 | no-edge-case | medium | coordToPixel: floating-point precision, reverse round-trip tolerance.
319. breadboard-model.test.ts:314 | missing-test-case | high | checkCollision: partial overlaps, DIP misaligned starts.
320. breadboard-model.test.ts:575 | missing-test-case | medium | WireColorManager persistence (serialize round-trip) + listener timing.

321. breadboard-undo.test.ts:15 | assertion-weakness | medium | PlaceComponentCommand test doesn't validate description format ("Place R1 at [x,y]").
322. breadboard-wire-editor.test.ts:83 | no-happy-path | high | selectWireAtPoint no overlapping-wire test (which wins?), no stress with 100+ wires.
323. breadboard-wire-editor.test.ts:141 | missing-test-case | medium | Multi-segment wire: doesn't verify segmentIndex is the correct hit segment.
324. breadboard-3d.test.ts:42 | no-happy-path | high | No place→wire→export→verify-3D-coords integration test.
325. breadboard-3d.test.ts:276 | no-edge-case | medium | Missing: tall components, overlapping 3D pins, obstacle avoidance in complex layouts.
326. breadboard-ai-prompts.test.ts:5 | assertion-weakness | low | buildBreadboardSelectionPrompt only checks keyword presence — no structure/grammar/token count.
327. breadboard-bench.test.ts:87 | missing-test-case | high | Bench summary: no BOM reconciliation on quantity change, no filter consistency, no empty BOM test.
328. breadboard-board-audit.test.ts:162 | missing-test-case | high | Missing: sync-preserves-trust after collapse, preflight-gates-on-shortfall.
329. breadboard-board-audit.test.ts:222 | no-edge-case | high | Missing decoupling: shared cap across ICs, non-adjacent with same cap, variant-specific rules.
330. breadboard-board-audit.test.ts:346 | missing-test-case | high | Restricted pin only ESP32; missing STM32 SWDIO/SWCLK, nRF52 xtal, custom board.
331. e2e/breadboard-fit.spec.ts:33 | missing-e2e-flow | high | Off-board-only E2E incomplete — no actual drop + toast verification.
332. e2e/breadboard-fit.spec.ts:1 | missing-e2e-flow | high | E2E only covers fit; missing full workflows (place→wire→inspect→DRC→reconcile→shop→build).
333. client/src/components/circuit-editor | missing-test-file | high | BreadboardWorkbenchSidebar.tsx no test file.
334. client/src/components/circuit-editor | missing-test-file | high | BreadboardStarterShelf.tsx no test file.
335. client/src/components/circuit-editor | missing-test-file | high | BreadboardInventoryDialog.tsx no test file.
336. client/src/components/circuit-editor | missing-test-file | high | BreadboardBoardAuditPanel.tsx no test file.
337. client/src/components/circuit-editor | missing-test-file | high | BreadboardPartInspector.tsx no test file.
338. client/src/components/circuit-editor | missing-test-file | medium | BreadboardBenchPartRenderer.tsx no test file.
339. client/src/components/circuit-editor | missing-test-file | medium | BreadboardDrcOverlay.tsx no test file.
340. client/src/components/circuit-editor | missing-test-file | medium | BreadboardConnectivityOverlay.tsx no test file.
341. client/src/components/circuit-editor | missing-test-file | medium | BreadboardCoachOverlay.tsx no test file.
342. client/src/lib/circuit-editor | missing-test-file | high | breadboard-bench-connectors.ts no test file.
343. client/src | no-a11y-test | high | No a11y tests across Breadboard: keyboard nav, ARIA labels, focus management, color contrast.
344. client/src | no-visual-regression | high | No visual regression (trust-tier badges, DRC markers, coach overlay).
345. BreadboardView.test.tsx:1150 | no-edge-case | medium | Drag-to-place: no rapid multi-drop, invalid location, invalid partId, concurrent drops.
346. breadboard-model.test.ts:853 | no-edge-case | medium | getAvailableZones: no single-row fits, 75%+ occupied board, gaps < rowSpan.

---

## Section 6 — Model / Sync / Coach / 3D Pure-Lib (53 findings)

**Agent scope:** breadboard-model.ts, breadboard-bench-connectors.ts, breadboard-connectivity.ts, breadboard-drag-move.ts, breadboard-drc.ts, breadboard-undo.ts, breadboard-wire-editor.ts, view-sync.ts, breadboard-coach-plan.ts, breadboard-ai-prompts.ts, breadboard-3d.ts, useBreadboardCoachPlan.ts.

347. breadboard-model.ts:51 | model-correctness | high | TOTAL_TIE_POINTS = 2*5*63 + 4*63 = 882 exceeds real breadboard (830 points). Comment says "≈830" but code uses 882 for net graph ops.
348. breadboard-model.ts:113 | model-correctness | high | Rail polarity: "top" on left, "bottom" on right — inverted from standard breadboard convention where top-pos/top-neg align vertically on left.
349. breadboard-model.ts:125-129 | model-correctness | medium | Left rails: pos at (ORIGIN_X - MARGIN), neg at (ORIGIN_X - MARGIN + PITCH) — off-by-one risk if PITCH/MARGIN change.
350. breadboard-model.ts:142 | model-correctness | medium | pixelToCoord snapRadius = PITCH * 0.6 = 6px hardcoded — conflicts with 15px PIN_SNAP_TOLERANCE in view-sync.ts. Unify.

351. breadboard-model.ts:438-439 | model-correctness | high | getOccupiedPoints non-DIP: loop condition `colIndex[col] >= startCol && colIndex[col] < startCol + 1` matches exactly one column — multi-pin non-DIP placements incorrect.
352. breadboard-model.ts:495-500 | model-correctness | medium | placementToBodyBounds uses baseBounds.width for Y extent (`y: footprintCenterY - baseBounds.width / 2`). Should be baseBounds.height.
353. breadboard-connectivity.ts:145 | occupancy-collision | medium | Phase 1 seed-hole iterates wire points without row/column bounds validation — out-of-bounds pixels create invalid BreadboardCoord keys.
354. breadboard-connectivity.ts:159-183 | net-graph | medium | Phase 2 instance→hole mapping assumes breadboardX/Y snap-aligned — floating-point mismatch → missed assignments.
355. breadboard-connectivity.ts:188 | type-safety | medium | netMap.get(seed.netId) returns undefined for orphaned netId — silently drops wires.
356. breadboard-drc.ts:74-81 | drc-rule | high | classifyNetName missing: VCCIO, VREF, VDD_IO, 1V8, 1.8V, VCC_ANA, AVCC. Vendor rails misclassified as signal.
357. breadboard-drc.ts:92-98 | net-graph | medium | connectivityGroupKey uses left/right inference on col index — breaks silently if ALL_COLS reorders or channel gap moves.
358. breadboard-drc.ts:175-195 | drc-rule | high | Short-circuit counts 2+ nets in same group as error — doesn't distinguish intentional bussing from fault. No severity gradient.
359. breadboard-drc.ts:197-216 | drc-rule | medium | Bus conflict (3+ nets) duplicates short_circuit detection — both fire, duplicate messages.
360. breadboard-drc.ts:229-254 | drc-rule | medium | Rail polarity check uses hardcoded endsWith('pos'/'neg') — custom rail IDs bypass. Use RailId enum.
361. breadboard-drc.ts:273 | model-correctness | high | DIP pin computation assumes col 'e' and 'f' hardcoded — non-standard DIP (dual-row, quad-row) wrong.
362. breadboard-drc.ts:298 | drc-rule | medium | Floating component check only connectedPinCount === 0 — doesn't detect open-circuit nodes (isolated islands on multi-pin).
363. breadboard-undo.ts:1-117 | undo-invariant | medium | Place/delete commands capture only refDes, not full ComponentPart snapshot. Redo after modification loses original type.
364. breadboard-undo.ts:94-96 | undo-invariant | medium | MoveComponentCommand stores only 2D position — no validation of move still valid post-circuit change.
365. breadboard-wire-editor.ts:44 | perf | low | MIN_HIT_RADIUS=3 hardcoded. Not zoom-aware or wire-width-aware.
366. breadboard-wire-editor.ts:107 | type-safety | medium | getWireHitBox returns degenerate {0,0,0,0} when points empty — no error. Return null or assert pts.length ≥ 2.
367. breadboard-wire-editor.ts:151 | perf | medium | hitRadius recomputed per segment. Cache once per wire.
368. breadboard-wire-editor.ts:324 | perf | medium | nextSplitId uses Date.now() — collisions if 100 splits in <1ms. Use atomic counter or UUID.
369. view-sync.ts:48-59 | sync-provenance | medium | extractSegments/extractPoints cast raw JSONB without validation.
370. view-sync.ts:201 | sync-coherence | medium | PIN_SNAP_TOLERANCE=15px vs pixelToCoord snapRadius=6px — bread-board wires at 15px snap may not resolve within 6px threshold.
371. view-sync.ts:264 | sync-coherence | high | `if (!from.pinId || !to.pinId) continue;` — empty string pinId silently drops valid wires. Use null/undefined guards + log dropped.
372. view-sync.ts:342-369 | sync-coherence | medium | syncSchematicToBreadboard uses straight-line routing — no obstacle avoidance. Wires cross component bodies.
373. view-sync.ts:395-405 | sync-provenance | medium | Orphaned-wire conflict report doesn't include wire.id or endpoint coords — hard to debug.
374. view-sync.ts:461-473 | sync-coherence | medium | syncBreadboardToSchematic resolveWireEndpoints returns null if user routes to gap between pins — silent failure.
375. breadboard-coach-plan.ts:9-17 | coach-plan-coverage | medium | isPinSafeForHookup checks verifiedRestricted + strapping but not pin occupancy — may suggest hookup to already-used pin.
376. breadboard-coach-plan.ts:118-124 | coach-plan-coverage | medium | buildPreferredColumns hardcodes (right:h,i,j; left:b,a,c). Channel-column (e/f) placement never suggested. Data-driven preferences needed.
377. breadboard-coach-plan.ts:198 | model-correctness | medium | clampRow rail hookup: `index: clampRow(pin.coord.row) - 1` assumes 1-based. If row=0, index negative.
378. breadboard-coach-plan.ts:226-231 | coach-plan-coverage | medium | buildRailBridge assumes symmetric rails (top/bottom, pos/neg). Split 3.3V/5V rails produce wrong recs.
379. breadboard-coach-plan.ts:317 | coach-plan-coverage | medium | Control pin pull resistor targets first safe pin — no role-based priority (prefer RESET over GPIO).
380. breadboard-coach-plan.ts:349-377 | coach-plan-coverage | medium | Verified board caution strings hardcoded; ADC2-WiFi mentioned but missing GPIO34/35 input-only, etc.

381. breadboard-ai-prompts.ts:69 | prompt-template | medium | Prompt context has exactPinCount/heuristicPinCount but no trust_tier field. AI can't condition advice.
382. breadboard-ai-prompts.ts:160-161 | prompt-template | high | Verified board intel injected only if context.verifiedBoard=true — binary trust model. Expand: trustTier, trustSource, trustScore, requiresUserValidation.
383. breadboard-ai-prompts.ts:162 | prompt-template | medium | Prompt says "from verified datasheet research. Treat as authoritative" but doesn't clarify board-variant/revision. Add boardVariant, datasheetRevision, verificationDate.
384. breadboard-ai-prompts.ts:172 | prompt-template | medium | Prompt says "do not present as authoritative" when requiresVerification=true but coach plan UI renders pending/staged — mismatch.
385. breadboard-3d.ts:129 | model-correctness | medium | COL_INDEX gap at index 5 (DIP channel): f=6, g=7 — but toPoint3D(terminal('f', row)) returns x=6*PITCH_MM while left-group 0-4. Relative positioning off.
386. breadboard-3d.ts:162-168 | 3d-realism | medium | BOARD_DIMS.width=(10+2)*PITCH_MM≈30.5mm — actual 830-point breadboard is ~83mm wide. Off by 2.7x.
387. breadboard-3d.ts:186-199 | 3d-realism | medium | toPoint3D terminals use COL_INDEX without offset correction for DIP gap — 3D wire paths clip through channel.
388. breadboard-3d.ts:257-370 | perf | medium | A* pathfinder allows 8-directional (including diagonal at cost 1.414) — excessive grid points for long wires. Limit to Manhattan.
389. breadboard-3d.ts:293 | perf | medium | Pathfinder maxIterations=5000 with no timeout per wire — dense obstacles iterate max for every wire.
390. breadboard-3d.ts:368-369 | sync-coherence | medium | Fallback (direct line) condition abs(from.x-to.x) < 0.01 && abs(from.y-to.y) < 0.01 — tight; floating-point rounding could trigger unexpectedly.
391. useBreadboardCoachPlan.ts:197 | model-correctness | medium | clampBreadboardRow uses BB.ROWS (63) as max but max array index is 62 — off-by-one in coach placement.
392. useBreadboardCoachPlan.ts:225-257 | coach-plan-coverage | medium | resolveCoachSuggestionPlacement tries row offsets [0,1,-1,2,-2,...] but gives up silently — return error descriptor instead.
393. useBreadboardCoachPlan.ts:328-348 | perf | medium | resolvedCoachSuggestions useMemo mutates placements during iteration — stale data risk if deps change mid-memo. Immutable rebuild per iteration.
394. useBreadboardCoachPlan.ts:410-424 | sync-coherence | medium | wireMatchesCoachConnection allows match if endpoints are in same connectivity group — two wires on same row "match" even if different pins. Match exact pin IDs.
395. useBreadboardCoachPlan.ts:551-587 | coach-plan-coverage | medium | coachActionItems sorts by statusRank only — critical decoupler ranked after ground rail bridge. Sort by (priority, status, label).
396. breadboard-connectivity.ts:46-48 | test-gap | high | No fixtures for: empty board, single wire, two disconnected nets on same row, rail-terminal mixing.
397. breadboard-model.ts:579-633 | test-gap | high | getAvailableZones only trivial case tested. Missing overlapping DIP + single-side, boundary rows.
398. view-sync.ts:572-720 | test-gap | high | detectConflicts has 4 independent checks but no isolation tests per scenario.
399. breadboard-coach-plan.ts:256-393 | test-gap | high | buildBreadboardCoachPlan merges 4 subsystems (hookups, bridges, suggestions, cautions) with no isolation tests.

---

## Supplementary Grep Signals

- **15 `any`/`unknown` usages** across 9 breadboard files — feeds task #29.
- **1 eslint-disable** at BreadboardView.tsx:940 (react-hooks/exhaustive-deps).
- **Vault breadboard corpus:** 36 relevant notes in `knowledge/` (ESP32 GPIO rules, Mega fit, BLDC polarity, Hall order, L293D, NodeMCU spacing, breadboard power module, I2C-on-boot-pins). Findings #252, #269, #270, #283, #356 call out specific hardcoded-rule → vault-citation conversions.
- **Verified boards shipped:** 11 profiles in `shared/verified-boards/` (Arduino Uno/Nano/Mega, NodeMCU ESP32-S, RPi Pico, Teensy 4.0, STM32 Nucleo, Adafruit Feather, SparkFun Thing Plus, RioRand KJL-01, L298N, HC-SR04, SSD1306).
- **E2E specs:** 7 total; only 1 dedicated to breadboard (`breadboard-fit.spec.ts`) + 1 touches tabs. Gap: no place/wire/inspect/DRC/reconcile e2e flow.
- **Recent momentum:** 35+ breadboard-related commits in last 30 days; highest activity in workbench/stash/preflight layer. Engineering velocity is real.

---

## Cross-Cutting Themes

Patterns that appeared in multiple sections — fix one, fix many.

**Theme A — Hardcoded magic numbers that should cite vault or be derived:**
Findings #2, #4, #5, #70, #82, #83, #95, #100-102, #115, #185-187, #199, #208, #217-221, #223-224, #227, #270, #276, #347, #360-361, #365, #377, #386. Root cause: lack of a `breadboard-constants.ts` module + no vault-lookup helper in runtime path.

**Theme B — Trust-tier model not consistently applied:**
Findings #173, #240, #247, #274, #381-384. Root cause: verificationStatus enum ≠ 4-tier trust model; AI prompts don't carry trust_tier; prompt templates don't condition on confidence spectrum.

**Theme C — Coordinate/snap inconsistency across layers:**
Findings #187-188, #199, #203, #220, #223, #231, #349, #352, #370, #385-387, #391. Root cause: no single source of truth for PITCH/MARGIN/SNAP_RADIUS — each file defines its own constants.

**Theme D — Missing actionability on audit/DRC/coach output:**
Findings #120, #162, #164-166, #169-170, #175, #289, #292. Root cause: issue-generation pipeline doesn't attach vault link or `action: () => void` callback; UI renders text-only.

**Theme E — Tests validate presence, not behavior:**
Findings #294-295, #298, #302, #306, #310, #321, #326. Root cause: Testing Library usage default is `toBeInTheDocument`; no assertion-strength review at PR time.

**Theme F — God-component + embedded helpers kill testability:**
Findings #7, #16, #26, #29, #32, #50, #52, #54, #57, #66, #78, #94, #98, #103, #106, #113. Root cause: BreadboardView.tsx and BreadboardCanvas are 2,284 and 1,671 lines respectively. Already tracked as task #24 but that split hasn't shipped.

**Theme G — Silent failure paths:**
Findings #17, #21, #38, #40, #43, #47, #50, #58, #75, #79, #126 (sidebar), #138, #151, #355, #366, #371, #374, #389. Root cause: optional chaining + empty catches + null returns swallow errors. No structured logger in breadboard stack.

**Theme H — a11y absent or token:**
Findings #11, #25, #65, #74, #90-92, #122, #128-129, #140, #149, #152, #156, #182, #190, #195, #205, #207, #219, #234, #343. Root cause: component-level a11y reviews skipped; SVG canvas has no accessible tree; keyboard handlers don't announce state.

**Theme I — Perf cliffs on large boards:**
Findings #33, #39, #41, #59-60, #115, #194, #208-209, #226-227, #235, #238, #367-368, #388-389, #393. Root cause: no instance-granular memoization; animations hammer indefinite SMIL; A* unbounded.

---

## Suggested Triage Order

Priority ladder for execution waves — earliest items unlock the most downstream value.

**Wave 1 — Correctness blockers (do first):**
- #32, #24 (BreadboardCanvas extraction) unblocks #113, #66, #78 testability
- #239, #241, #256, #270, #283, #361 — ESP32/DIP restricted-pin + DIP detection correctness (safety-critical)
- #347, #351, #352, #385-387 — model coordinate correctness (geometry foundation)
- #252 — heuristic-trap-inference manifest visibility
- #289, #371 — silent failure bugs (ground-return, empty pinId)
- #173 — 4-canonical-tier rendering
- #113 — zero unit tests on 2,284-line God component

**Wave 2 — Vault integration (unifies hardcoded rules):**
- #252, #253, #263, #269, #270, #276, #284, #356 — scattered constants → vault citations
- #120, #292 — coach/audit remediation links to vault notes
- Theme A & B work

**Wave 3 — Test coverage floor (before more feature work):**
- #333-342 — 10 missing component test files
- #314, #328, #330 — missing regression tests (Mega off-board, trust-tier-collapse, STM32/nRF52 pins)
- #343 — a11y test suite (composes with task #31)
- #344 — visual regression (Percy)
- #396-399 — per-subsystem isolation tests (connectivity, zones, conflicts, coach plan)

**Wave 4 — UX depth (high-leverage beginner onboarding):**
- #27, #171, #172, #181 — empty state + inspector density
- #162, #163, #165, #167 — audit panel actionability
- #153, #154, #160 — reconciliation delta clarity
- #166, #182 — pin-info discoverability

**Wave 5 — Performance + a11y polish:**
- #43, #59, #33, #367, #393 — memoization tightening
- #209, #227, #235, #388-389 — animation/pathfinder caps
- #90, #91, #92, #122, #129 — SVG and keyboard a11y

**Wave 6 — Sync + coach depth:**
- #371, #372, #374 — view-sync correctness (empty pinId, routing, endpoint gaps)
- #375-380, #392, #394-395 — coach-plan coverage + priority ranking
- #381-384 — AI prompt trust-tier enrichment

---

## Severity Distribution

| Severity | Count |
|----------|------:|
| critical |    11 |
| high     |    98 |
| medium   |   188 |
| low      |    96 |
| trivial  |     6 |

---

*Audit compiled 2026-04-17. Six parallel Explore agents produced findings verbatim. Next: convert highest-priority items to BL-XXXX MASTER_BACKLOG entries. See task #83 for tracking.*
