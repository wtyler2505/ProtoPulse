# Widget System — Architecture & Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build ProtoPulse's widget system — ONE widget core serving four surfaces (dashboard tiles, floating/dockable windows, external embeds, plugin-loaded widgets) with cross-view persistence: floating widgets stay mounted while the user switches between the 41 view modes. This plan distills the completed feasibility research (`~/.claude/plans/codex-is-already-doing-tingly-rivest.md`, June 2026) into a phased TDD build. Phase 1 (this plan's executable scope) lands the core contract + registry + persistence hook + self-contained floating portal, shipped dark with zero edits to `ProjectWorkspace`/`ViewRenderer` (Codex-owned lanes).

**Architecture:** A `WidgetDefinition` contract + `WidgetRegistry` (Map-backed, register/list/remove/serialize/hydrate) is the single core. Widget *instances* (`WidgetInstance`: instanceId, defId, surface, scope, rect/grid, config) are persisted state, decoupled from definitions. Surfaces are hosts that render the same definitions: the floating surface is a `WidgetPortal` mounted via `createPortal` above the view tree, so view switches re-render `ViewRenderer` but never unmount the widget layer. Persistence uses the existing project-scoped localStorage pattern (`lib/client-state-scope.ts` → `getProjectScopedStorageKey`), matching `workspace-reducer.ts`; the feasibility doc's end-state is to fold `widgets[]` INTO `workspace-reducer` — Phase 1 uses a standalone `useWidgets` hook on the same storage pattern so it can later migrate without storage-format changes.

**Tech Stack:** React 19 + TypeScript 5.6 + shadcn/ui (`Card`), existing `ErrorBoundary`, `lib/client-state-scope.ts`, Vitest (happy-dom project) + Testing Library.

**Research basis:** Feasibility doc verdict: clearly doable, ~80% substrate ships already (`@dnd-kit`, `react-resizable-panels`, Card/InteractiveCard, `PredictionPanel`/`ActivityFeedPanel` floating precedent, project-scoped localStorage, TanStack Query data hooks, `/embed/*` route, `lazyWithRetry`). External citations therein: react-grid-layout vs gridstack.js (grids), react-rnd (floating drag/resize), Module Federation (trusted plugins), sandboxed iframes + CSP + postMessage (untrusted plugins) — web.dev/MDN/freeCodeCamp links in the feasibility doc.

---

## Existing Infrastructure Summary

| Need | Reuse | Status |
|------|-------|--------|
| Tile/window chrome | `client/src/components/ui/card.tsx`, `InteractiveCard` | Complete |
| Error isolation | `client/src/components/ErrorBoundary.tsx` | Complete |
| Persistence keys | `client/src/lib/client-state-scope.ts` (`getProjectScopedStorageKey`) | Complete |
| Persistence precedent | `client/src/pages/workspace/workspace-reducer.ts` (debounced localStorage) | Complete — migration target, not touched in Phase 1 |
| Floating precedent | `components/ui/PredictionPanel.tsx`, `components/panels/ActivityFeedPanel.tsx` | Complete |
| Drag/drop | `@dnd-kit/*`, `lib/dnd-context.tsx` | Present — used in later phases |
| Resize | `components/ui/resizable.tsx`, `ResizeHandle` | Present — used in later phases |
| Live data | `lib/project-context.tsx` hooks, TanStack Query | Present — `dataSources` resolution is Phase 2+ |
| Embed host | `/embed/*` + `EmbedViewerPage` | Present — Phase 5 |
| Registry refactor target | `pages/workspace/ViewRenderer.tsx` (switch → registry) | NOT touched in Phase 1 (Codex lane) |

## Phase Overview

| Phase | Description | Scope |
|-------|-------------|-------|
| **Phase 1 (this plan)** | Widget core (types, registry, persistence hook) + self-contained floating portal + demo widget | `client/src/components/widget-system/**` only |
| Phase 2 | Wire portal into `ProjectWorkspace` (sibling of tabpanel), dashboard tile grid (react-grid-layout vs gridstack — open), `useWidgetData` data-source resolution, migrate state into `workspace-reducer` | Needs Codex lane coordination |
| Phase 3 | User-composed widgets: "Add widget" picker + `configSchema`-driven instances | |
| Phase 4 | Embed surface: single widget on `/embed`, scoped read-only token API | |
| Phase 5 | Plugin framework: two-tier trust (Module Federation trusted / sandboxed iframe + CSP + postMessage untrusted), Web Worker compute | Security-critical, last |

---

## Phase 1: Widget Core + Floating Portal (TDD)

All files live in `client/src/components/widget-system/`. Tests in `__tests__/` per repo convention (`*.test.ts[x]`, happy-dom, Testing Library). Each task: write failing test → run (background per repo rule) → implement → run green → commit.

### Task 1: Core types — `widget.types.ts`
`WidgetSurface` (`'dashboard' | 'floating' | 'embed'`), `DataSourceKey` (extensible string union per feasibility A1), `WidgetDefinition<Config>` (id, title, category?, dataSources, defaultSize, minSize?, surfaces?, configSchema?, trust, render), `WidgetRenderContext<Config>` (config, data, size, surface, actions), `WidgetInstance` (instanceId, defId, surface, scope: `'global' | 'pinned' | { views: string[] }`, rect?/grid?, config?), `SerializedRegistry`. Types-only; verified by compile + use in registry tests.

### Task 2: `WidgetRegistry.ts`
Class with `register(def)` (rejects duplicate ids), `get(id)`, `list(filter?: { surface?; category? })`, `remove(id)`, `serialize(): SerializedRegistryEntry[]` (metadata only — `render` is code, never serialized), `hydrate(entries, resolvers)` (re-binds metadata to registered render functions; unknown defs reported, not thrown). Module-level singleton `widgetRegistry` + class export for isolated tests.
**Tests:** register/get/list/remove CRUD, duplicate rejection, surface+category filtering, serialize→hydrate round-trip preserves metadata, hydrate with missing resolver surfaces the miss.

### Task 3: `useWidgets.ts` — instance persistence
Hook owning `WidgetInstance[]`: `addWidget`, `removeWidget`, `updateWidget` (rect/config/scope), `instancesFor(surface, activeView?)` (scope filtering). Persists to localStorage under `getProjectScopedStorageKey('protopulse-widgets', projectId)` — same pattern as `workspace-reducer.ts`, format chosen to migrate into it in Phase 2 unchanged. Versioned payload (`{ version: 1, instances }`), corrupt/missing payload → empty state, never throws.
**Tests:** add/remove/update, persistence round-trip across hook remounts, scope filtering (global / pinned / view-list), corrupt-payload recovery, project-key isolation.

### Task 4: `WidgetPortal.tsx` — floating surface
Self-contained: creates its own host `<div data-widget-layer>` appended to `document.body` via `createPortal` (no `ProjectWorkspace` edits this phase — wiring is Phase 2). Renders each floating instance in a `WidgetFrame` (Card chrome: title header, close button, absolute-positioned by `rect`), each wrapped in the existing `ErrorBoundary` so a broken widget never takes down the layer. Unknown `defId` → skipped with dev warning. Owned z-scale base (`Z_WIDGET_LAYER = 60`) per feasibility risk note.
**Tests (happy-dom + Testing Library):** renders registered widget content into the body-level layer, close button calls remove, unknown defId doesn't crash, throwing widget render is contained by ErrorBoundary while siblings survive, layer persists across re-renders of arbitrary sibling content (cross-view proxy test — the real e2e is Phase 2).

### Task 5: Demo definition — `definitions/NotesWidget.tsx`
A self-contained sticky-notes widget (`trust: 'builtin'`, no dataSources, config = `{ text }`) registered against the singleton. Proves the contract end-to-end without touching files other agents own.
**Tests:** registers on import, renders config text, edits propagate through `onConfigChange`.

### Task 6: Barrel + verification
`index.ts` barrel (repo convention). Run the full client test project in background; `npm run check` clean.

---

## Open decisions flagged for Tyler (left open by the feasibility doc — NOT invented here)

1. **Grid library** (Phase 2): react-grid-layout vs gridstack.js vs bespoke @dnd-kit grid — feasibility leans react-grid-layout, not decided.
2. **Floating drag/resize library** (Phase 2): react-rnd vs extending existing `ResizeHandle` + `@dnd-kit`.
3. **Server-side persistence timing**: when to add the `useChatSettings`-style server prefs backing (feasibility says "later").
4. **Tauri store backing** for desktop persistence — interface is compatible, timing open.
5. **`ViewRenderer` switch→registry refactor**: prerequisite for Phase 2+ declarative registration; must be sequenced with Codex's in-flight work.
6. **z-index scale ownership**: Phase 1 claims base 60 locally; a repo-wide owned z-scale is still an open design item.
7. **Curated widget list** for the Phase 2 dashboard (feasibility suggests ~8–12: BOM cost, validation, readiness, sourcing risk, event feed, power budget, thermal, notes…).

## Team Execution Checklist
- [ ] Phase 1 tasks 1–6 (this plan; single lane, `client/src/components/widget-system/**` only)
- [ ] Pre-Phase-2 research pass (grid lib bake-off via Context7 + WebSearch, per pre-phase research rule)
- [ ] Phase 2 lane coordination with Codex (`ProjectWorkspace.tsx`, `ViewRenderer.tsx`)
- [ ] Cross-view Playwright e2e once portal is wired into the shell (Phase 2)
