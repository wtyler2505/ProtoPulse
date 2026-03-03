# ProtoPulse Performance Audit

**Date:** 2026-02-27
**Auditor:** Claude Code (Opus 4.6)
**Scope:** React 19 + Vite + TypeScript client-side codebase
**Build tool:** Vite 7 with `@vitejs/plugin-react`

---

## 1. Lazy Loading

- [x] [OK] `client/src/pages/ProjectWorkspace.tsx`:1-17 — All 9 route-level view components use `React.lazy()` with dynamic imports: `ArchitectureView`, `ComponentEditorView`, `ProcurementView`, `ValidationView`, `OutputView`, `SchematicView`, `BreadboardView`, `PCBLayoutView`, `SimulationView`. Each is wrapped in `<Suspense fallback={<ViewLoadingFallback />}>` and `<ErrorBoundary>`.
- [x] [OK] `client/src/components/simulation/SimulationPanel.tsx`:28 — `WaveformViewer` is also lazy-loaded within the simulation panel itself.
- [ ] [LOW] `client/src/App.tsx`:7-8 — `ProjectWorkspace` and `NotFound` are statically imported rather than lazy-loaded at the route level. Since Wouter's `<Route>` already mounts/unmounts components, lazy-loading `ProjectWorkspace` would avoid pulling the entire workspace (including all providers, sidebar, and chat panel) into the initial bundle for users on the landing/404 routes.
- [ ] [LOW] `client/src/pages/ProjectWorkspace.tsx`:5-6 — `Sidebar` and `ChatPanel` are statically imported. These are always mounted in the workspace layout so lazy-loading is less impactful, but `ChatPanel` in particular (829 lines, markdown rendering, virtualizer) could benefit from deferral until first open on mobile.

---

## 2. Memoization

- [ ] [MEDIUM] `client/src/pages/ProjectWorkspace.tsx`:124-134 — The `tabs` array is re-created on every render of `WorkspaceContent`. Since it is a static constant, it should be hoisted outside the component or wrapped in `useMemo` with an empty dependency array.
- [ ] [MEDIUM] `client/src/pages/ProjectWorkspace.tsx`:136 — `visibleTabs` (derived from `tabs.filter()`) is also re-computed on every render. Should be memoized alongside `tabs`.
- [ ] [HIGH] `client/src/lib/contexts/architecture-context.tsx`:307-328 — The `ArchitectureContext.Provider` `value` is a new object literal on every render. This means every consumer of `useArchitecture()` re-renders whenever **any** state in `ArchitectureProvider` changes, even if the specific field they consume did not change. The value object should be stabilized with `useMemo`.
- [ ] [HIGH] `client/src/lib/contexts/chat-context.tsx`:51-56 — Same issue: `ChatContext.Provider` value is a new object on every render. Any state change (e.g., `isGenerating` toggling) forces re-renders on all consumers, even those that only read `messages`.
- [ ] [HIGH] `client/src/lib/contexts/bom-context.tsx`:79-86 — Same issue: `BomContext.Provider` value is a new object on every render.
- [ ] [HIGH] `client/src/lib/contexts/validation-context.tsx`:72-78 — Same issue: `ValidationContext.Provider` value is not memoized.
- [ ] [HIGH] `client/src/lib/contexts/history-context.tsx`:54-57 — Same issue: `HistoryContext.Provider` value is not memoized.
- [ ] [HIGH] `client/src/lib/contexts/output-context.tsx`:27-29 — Same issue: `OutputContext.Provider` value is not memoized.
- [ ] [HIGH] `client/src/lib/contexts/project-meta-context.tsx`:79-91 — Same issue: `ProjectMetaContext.Provider` value is not memoized.
- [ ] [MEDIUM] `client/src/components/panels/ChatPanel.tsx`:127-368 — `processLocalCommand` is wrapped in `useCallback` but has 14 dependencies including `nodes`, `edges`, `bom`, and `issues`. Any change to architecture nodes, edges, BOM items, or validation issues recreates this entire 240-line function, which also affects `handleSend` downstream.
- [ ] [MEDIUM] `client/src/components/views/ProcurementView.tsx`:117 — `totalCost` is computed via `filteredBom.reduce()` on every render without `useMemo`. For large BOM lists, this is wasteful.
- [ ] [LOW] `client/src/components/layout/sidebar/HistoryList.tsx`:101-104 — `sortedHistory`, `filteredHistory`, `visibleHistory`, and `groupedVisibleHistory` are all computed on every render without `useMemo`. The sort operation creates `new Date()` objects for every item in the history array on each render.
- [ ] [LOW] `client/src/components/layout/sidebar/HistoryList.tsx`:106-109 — `hasRecentActivity` iterates the full history array and creates `new Date()` for each item on every render without memoization.
- [ ] [LOW] `client/src/components/panels/chat/MessageBubble.tsx`:14-36 — `MarkdownContent` component creates new `components` and `remarkPlugins` objects on every render of every message bubble. These should be hoisted to module scope or memoized.
- [ ] [LOW] `client/src/components/views/ArchitectureView.tsx`:150-155 — The `tools` array is re-created on every render. It references callbacks that are already memoized, but the array itself creates new objects each time.

### React.memo Usage

- [ ] [MEDIUM] Only 2 components in the entire codebase use `React.memo`: `Hole` and `BreadboardGrid` in `client/src/components/circuit-editor/BreadboardGrid.tsx`. High-frequency child components like `SortableBomRow`, `MessageBubble`, `CustomNode`, and sidebar tree items would benefit from `React.memo` to prevent unnecessary re-renders when parent state changes.

---

## 3. Bundle Size

Build output from `npx vite build --mode production`:

| Chunk | Size (raw) | Size (gzip) | Status |
|-------|-----------|-------------|--------|
| `index-g__ACnWS.js` | **696.20 KB** | 218.31 KB | **CRITICAL: Over 500KB limit** |
| `style-t6DGZ1pA.js` | 176.58 KB | 57.87 KB | OK but large |
| `ComponentEditorView-BjNmAjci.js` | 159.68 KB | 42.34 KB | OK |
| `ProcurementView-Cc2ZuEqD.js` | 86.24 KB | 26.20 KB | OK |
| `index-BHBjk5iJ.css` | 110.81 KB | 18.90 KB | OK |
| `SchematicView--zP0hl-1.js` | 47.92 KB | 13.55 KB | OK |
| `ArchitectureView-CMfcXdQS.js` | 36.39 KB | 11.41 KB | OK |

- [ ] [CRITICAL] `index-g__ACnWS.js` at **696.20 KB** (218 KB gzipped) — The main bundle exceeds 500KB. This is the entry chunk containing React, React DOM, @xyflow/react, @tanstack/react-query, Radix UI primitives, shadcn/ui, lucide-react icons, and all context providers. Vite itself warns about this. Mitigation: configure `build.rollupOptions.output.manualChunks` to split out vendor libraries (e.g., `react-vendor`, `xyflow-vendor`, `radix-vendor`, `tanstack-vendor`).
- [ ] [LOW] `client/src/components/views/ProcurementView.tsx`:22 — `import { format } from 'date-fns'` is imported but **never used** anywhere in the file. While Vite tree-shakes unused exports, the import itself can prevent optimal tree-shaking if the module has side effects, and it creates dead code confusion.
- [ ] [LOW] `vite.config.ts` — No `manualChunks` configuration present. Adding explicit chunk splitting strategy would improve caching and reduce initial load for repeat visits.

---

## 4. Re-render Patterns

- [ ] [HIGH] `client/src/lib/contexts/architecture-context.tsx`:307-328 — Every context provider creates a fresh `value` object on every render. Since React uses referential equality for context value comparison, ALL consumers re-render whenever the provider re-renders, even if the specific values they consume have not changed. This is the single most impactful performance issue in the codebase. **All 7 domain contexts** (`ArchitectureContext`, `ChatContext`, `BomContext`, `ValidationContext`, `HistoryContext`, `OutputContext`, `ProjectMetaContext`) share this pattern.
- [ ] [HIGH] `client/src/lib/project-context.tsx`:169-242 — The deprecated `useProject()` hook composes ALL 7 domain hooks. Any component still using `useProject()` subscribes to changes in every single domain context simultaneously, causing re-renders on any state change anywhere. While no consumers were found currently using `useProject()`, it remains exported and available as an API.
- [ ] [MEDIUM] `client/src/lib/contexts/output-context.tsx`:19 — `addOutputLog` creates a new array via `[...prev, log]` on every log entry. Since `outputLog` is in the context value (which is not memoized), every new log line triggers re-renders for all `useOutput()` consumers. In a session with heavy AI chat usage, this could produce hundreds of log entries and frequent re-renders.
- [ ] [MEDIUM] `client/src/lib/contexts/bom-context.tsx`:31-32 — `bomSettings` initial state includes `manufacturingDate: new Date()`. Since `new Date()` creates a new object on every `BomProvider` mount, this is benign for single-mount scenarios but creates unnecessary work if the provider is ever remounted.
- [ ] [MEDIUM] `client/src/components/panels/ChatPanel.tsx`:38-66 — `ChatPanel` has **22 individual `useState` hooks**. Any one of these changing triggers a re-render of the entire 829-line component, which includes the virtualizer setup, all callbacks, and the full JSX tree. Consider extracting logically grouped state into sub-components or a reducer.

---

## 5. Network Efficiency

- [x] [OK] `client/src/lib/queryClient.ts`:90-111 — Global query client has sensible defaults: `staleTime: 5 * 60 * 1000` (5 minutes), `refetchOnWindowFocus: false`, `refetchInterval: false`, `retry: 2`.
- [ ] [MEDIUM] `client/src/lib/contexts/chat-context.tsx`:37-39 — `addChatMutation.onSuccess` calls `invalidateQueries` for the entire chat query. This means every single message sent triggers a full refetch of ALL chat messages from the server, rather than using optimistic updates. For a chat with hundreds of messages, this is wasteful.
- [ ] [MEDIUM] `client/src/lib/contexts/history-context.tsx`:44-46 — Same pattern: every `addToHistory` call invalidates and refetches the entire history list. During AI interactions, multiple history entries are added in rapid succession (e.g., "Switched to Architecture view" + "Added node" + ...), each triggering a full refetch.
- [ ] [MEDIUM] `client/src/lib/contexts/validation-context.tsx`:42-44 — Same pattern for validation mutations. Each add/delete triggers a full refetch.
- [ ] [LOW] `client/src/lib/contexts/architecture-context.tsx`:125-130 — Node mutations invalidate queries on **both** success and error. The error path re-invalidation is correct (to revert optimistic updates), but the success path could use the response data directly instead of refetching.
- [ ] [LOW] `client/src/lib/contexts/architecture-context.tsx`:160-176 — `setNodes` both sets optimistic cache data AND fires a mutation that invalidates and refetches on success. This creates a redundant refetch: the cache is already correct from the optimistic update. The `onSuccess` handler should skip invalidation if the optimistic update matches.
- [ ] [LOW] `client/src/lib/component-editor/hooks.ts`:58-59 — `useUpdateComponentPart` invalidates BOTH `['component-parts']` and `['component-part']` query keys on success. If these overlap, this triggers two refetches.
- [ ] [LOW] `client/src/components/views/ComponentEditorView.tsx`:311-317 — Auto-save fires every 2 seconds while dirty (`state.ui.isDirty`). Since `state.present` is in the dependency array and changes on every shape edit (mouse move), this can fire very frequently during active drawing.

---

## 6. Image Optimization

- [x] [OK] No static image assets (PNG, JPG, GIF, WebP) were found in `client/src/`. The app uses SVG icons from `lucide-react` and procedurally generated SVG shapes in the component editor.
- [ ] [LOW] `client/src/components/views/component-editor/ShapeCanvas.tsx`:1145 — Reference image upload accepts `.png,.jpg,.jpeg,.gif,.bmp,.webp` but there is no client-side compression or resizing before embedding. Large images uploaded as reference images could bloat memory.

---

## 7. CSS Efficiency

- [x] [OK] Tailwind v4 with `@tailwindcss/vite` plugin is used. Unused classes are automatically purged at build time.
- [x] [OK] CSS output is 110.81 KB raw / 18.90 KB gzipped — reasonable for an app of this complexity.
- [ ] [LOW] Multiple components use `backdrop-blur-xl` and `backdrop-blur` classes (found in `ProjectWorkspace.tsx`, `ChatPanel.tsx`, `ProcurementView.tsx`, `Sidebar.tsx`, `ValidationView.tsx`). `backdrop-filter` is a GPU-intensive CSS property. On lower-end devices, stacking multiple elements with `backdrop-blur-xl` can cause jank during scrolling and panel transitions.
- [ ] [LOW] Inline `style` objects are used in 50+ locations. Most are necessary for dynamic positioning (virtualizer rows, SVG elements, DnD transforms). However, some are static and could be moved to Tailwind classes: e.g., `style={{ writingMode: 'vertical-rl' }}` in `ChatPanel.tsx`:658 and `Sidebar.tsx` collapsed state.

---

## 8. Event Listener Cleanup

- [x] [OK] `client/src/pages/ProjectWorkspace.tsx`:103-114 — Global `keydown` listener for `?` shortcut properly cleaned up.
- [x] [OK] `client/src/components/views/ArchitectureView.tsx`:69-82 — Keyboard shortcut listener for undo/redo properly cleaned up.
- [x] [OK] `client/src/components/views/ComponentEditorView.tsx`:290-309 — Keyboard shortcut listener properly cleaned up.
- [x] [OK] `client/src/components/views/component-editor/ShapeCanvas.tsx`:815-818 — `keydown` and `keyup` listeners properly cleaned up.
- [x] [OK] `client/src/components/panels/ChatPanel.tsx`:91-100 — Scroll listener properly cleaned up.
- [x] [OK] `client/src/components/panels/ChatPanel.tsx`:102-109 — Escape key listener properly cleaned up.
- [x] [OK] `client/src/hooks/useSyncedFlowState.ts`:102-115 — `beforeunload` listener properly cleaned up.
- [x] [OK] `client/src/components/panels/asset-manager/hooks/useAssetKeyboardShortcuts.ts`:36-75 — Keyboard listener properly cleaned up.
- [x] [OK] `client/src/pages/ProjectWorkspace.tsx`:36-64 — `ResizeHandle` mousemove/mouseup listeners attached inside mousedown and cleaned up in mouseup.
- [x] [OK] All checked `useEffect` hooks that add event listeners have corresponding cleanup functions.

---

## 9. Memory Leaks

- [ ] [MEDIUM] `client/src/components/panels/ChatPanel.tsx`:436-447 — Inside `handleSend`, when no API key is set, a `setTimeout` fires after `LOCAL_COMMAND_DELAY` to add a response message. If the component unmounts before the timeout fires (e.g., user collapses chat panel), the timeout callback calls `addMessage` and `setIsGenerating` on an unmounted component. The timeout is not stored in a ref and not cleared on unmount.
- [ ] [MEDIUM] `client/src/components/panels/chat/hooks/useActionExecutor.ts`:1091-1092 — Tutorial step timeouts are created in a loop (`setTimeout(() => addOutputLog(...), i * 500)`) without storing references. If the component unmounts, these orphaned timeouts will fire and attempt to update state on an unmounted component. For a tutorial with 10 steps, that is 10 orphaned timeouts.
- [ ] [LOW] `client/src/lib/contexts/architecture-context.tsx`:208 — `setTimeout(() => setFocusNodeId(null), 500)` in `focusNode` is not tracked or cleaned up. If `ArchitectureProvider` unmounts within 500ms of a focus call, this will attempt to set state on an unmounted component.
- [ ] [LOW] `client/src/components/views/OutputView.tsx`:46 — `setTimeout(() => setCopiedIndex(null), COPY_FEEDBACK_DURATION)` is not cleaned up on unmount. Same pattern at line 52 for `setCopiedAll`.
- [ ] [LOW] `client/src/components/panels/ChatPanel.tsx`:124 — `setTimeout(() => setCopiedId(null), COPY_FEEDBACK_DURATION)` is not cleaned up on unmount.
- [ ] [LOW] `client/src/components/layout/sidebar/ProjectSettingsPanel.tsx`:50 — `setTimeout(() => setSettingsSaved(false), SETTINGS_SAVE_FEEDBACK_DURATION)` is not cleaned up on unmount.
- [ ] [LOW] `client/src/components/circuit-editor/ExportPanel.tsx`:271,276 — Two `setTimeout` calls to reset status to `'idle'` are not cleaned up on unmount.
- [ ] [LOW] `client/src/components/panels/ChatPanel.tsx`:449-473 — SSE streaming via `fetch()` with a `reader.read()` loop. If the component unmounts during streaming, the `AbortController` is stored in `abortRef` and set to `null` in the `finally` block, but there is no `useEffect` cleanup that calls `abortRef.current?.abort()` on unmount. If the user closes the chat panel while streaming, the fetch continues in the background.

---

## 10. Virtualization

- [x] [OK] `client/src/components/panels/ChatPanel.tsx`:75-81 — Chat messages use `@tanstack/react-virtual` with `overscan: 5` and dynamic measurement via `measureElement`.
- [x] [OK] `client/src/components/views/ValidationView.tsx`:254-262 — Validation issues use `@tanstack/react-virtual` with `overscan: 10`.
- [x] [OK] `client/src/components/views/OutputView.tsx`:28-33 — Output log uses `@tanstack/react-virtual` with `overscan: 20`.
- [ ] [MEDIUM] `client/src/components/views/ProcurementView.tsx`:434-437 — BOM table rows are **not virtualized**. The entire `filteredBom` array is rendered as `<SortableBomRow>` components inside a `<SortableContext>`. For large BOMs (100+ components), this renders all rows at once. The DnD integration (`@dnd-kit/sortable`) complicates adding virtualization, but a windowed approach should be considered for scale.
- [ ] [LOW] `client/src/components/views/ProcurementView.tsx`:347-411 — The mobile card layout (`md:hidden`) also renders all BOM items without virtualization.
- [ ] [LOW] `client/src/components/layout/sidebar/HistoryList.tsx`:164-256 — The history timeline renders all visible items without virtualization. While capped at `TIMELINE_LIMIT = 5` when collapsed, expanding shows the full history list without windowing.
- [ ] [LOW] `client/src/components/views/component-editor/ComponentEditorView.tsx`:823-839 — The parts list in the sidebar renders all parts without virtualization. For projects with many component parts, this could become slow.

---

## Summary by Severity

### CRITICAL (1)
| Finding | File | Line |
|---------|------|------|
| Main bundle exceeds 500KB (696KB raw / 218KB gzip) | `index-g__ACnWS.js` | build output |

### HIGH (8)
| Finding | File | Line |
|---------|------|------|
| ArchitectureContext.Provider value not memoized | `architecture-context.tsx` | 307-328 |
| ChatContext.Provider value not memoized | `chat-context.tsx` | 51-56 |
| BomContext.Provider value not memoized | `bom-context.tsx` | 79-86 |
| ValidationContext.Provider value not memoized | `validation-context.tsx` | 72-78 |
| HistoryContext.Provider value not memoized | `history-context.tsx` | 54-57 |
| OutputContext.Provider value not memoized | `output-context.tsx` | 27-29 |
| ProjectMetaContext.Provider value not memoized | `project-meta-context.tsx` | 79-91 |
| Deprecated useProject() subscribes to all contexts | `project-context.tsx` | 169-242 |

### MEDIUM (10)
| Finding | File | Line |
|---------|------|------|
| `tabs` array recreated every render | `ProjectWorkspace.tsx` | 124-134 |
| Only 2 components use React.memo in entire codebase | various | — |
| processLocalCommand has 14 deps, recreated frequently | `ChatPanel.tsx` | 127-368 |
| totalCost not memoized | `ProcurementView.tsx` | 117 |
| Chat addMessage invalidates + refetches all messages | `chat-context.tsx` | 37-39 |
| History addToHistory invalidates + refetches all | `history-context.tsx` | 44-46 |
| Validation mutations invalidate + refetch all | `validation-context.tsx` | 42-44 |
| ChatPanel has 22 useState hooks causing full re-renders | `ChatPanel.tsx` | 38-66 |
| BOM table not virtualized | `ProcurementView.tsx` | 434-437 |
| Orphaned setTimeout in handleSend (no API key path) | `ChatPanel.tsx` | 436-447 |

### LOW (19)
| Finding | File | Line |
|---------|------|------|
| ProjectWorkspace not lazy-loaded in App.tsx | `App.tsx` | 7-8 |
| Sidebar/ChatPanel statically imported | `ProjectWorkspace.tsx` | 5-6 |
| History list computations not memoized | `HistoryList.tsx` | 101-109 |
| MarkdownContent creates objects per render | `MessageBubble.tsx` | 14-36 |
| tools array recreated in ArchitectureView | `ArchitectureView.tsx` | 150-155 |
| Unused import: `format` from `date-fns` | `ProcurementView.tsx` | 22 |
| No manualChunks in vite config | `vite.config.ts` | — |
| Architecture setNodes double-refetch | `architecture-context.tsx` | 160-176 |
| Component parts double invalidation | `hooks.ts` | 58-59 |
| Auto-save fires frequently during drawing | `ComponentEditorView.tsx` | 311-317 |
| No client-side image compression for references | `ShapeCanvas.tsx` | 1145 |
| backdrop-blur-xl on many stacked elements | various | — |
| Static inline styles could use Tailwind | `ChatPanel.tsx`, `Sidebar.tsx` | — |
| focusNode setTimeout not cleaned up | `architecture-context.tsx` | 208 |
| Copy feedback setTimeout not cleaned up (multiple) | `OutputView.tsx`, `ChatPanel.tsx` | various |
| Export panel setTimeout not cleaned up | `ExportPanel.tsx` | 271, 276 |
| Tutorial timeouts orphaned on unmount | `useActionExecutor.ts` | 1091-1092 |
| SSE streaming not aborted on unmount | `ChatPanel.tsx` | 449-473 |
| Mobile BOM cards not virtualized | `ProcurementView.tsx` | 347-411 |

---

## Recommended Priority Order

1. **Memoize all context provider values** (HIGH, 7 items) — Single highest-impact fix. Wrap each provider's `value` prop in `useMemo`. This alone will dramatically reduce unnecessary re-renders across the entire application.
2. **Split the main bundle** (CRITICAL) — Add `manualChunks` to `vite.config.ts` to separate React, @xyflow/react, Radix UI, and TanStack Query into dedicated vendor chunks.
3. **Add optimistic updates to chat/history/validation mutations** (MEDIUM, 3 items) — Replace invalidate-and-refetch with optimistic cache updates for high-frequency mutations.
4. **Add React.memo to frequently-rendered child components** (MEDIUM) — Start with `MessageBubble`, `SortableBomRow`, and sidebar tree items.
5. **Virtualize the BOM table** (MEDIUM) — Use `@tanstack/react-virtual` for the desktop table and mobile card layouts.
6. **Clean up orphaned timeouts** (LOW-MEDIUM, 7 items) — Store timeout IDs in refs and clear them in `useEffect` cleanup functions.
7. **Abort SSE streaming on unmount** (LOW) — Add a `useEffect` cleanup that calls `abortRef.current?.abort()`.
