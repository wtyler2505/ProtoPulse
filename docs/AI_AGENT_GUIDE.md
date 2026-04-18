# ProtoPulse — AI Agent Guide

> **Audience:** AI coding agents (Claude Code, Cursor, Copilot, Cody, etc.)
> **Purpose:** The definitive reference for any AI agent picking up this codebase cold.
> **Last updated:** 2026-03-02

---

## Table of Contents

1. [Project Identity & Vision](#1-project-identity--vision)
2. [Absolute Rules (NEVER DO)](#2-absolute-rules-never-do)
3. [Development Conventions](#3-development-conventions)
4. [File Organization Rules](#4-file-organization-rules)
5. [Architecture Cheat Sheet](#5-architecture-cheat-sheet)
6. [Key Files Quick Reference](#6-key-files-quick-reference)
7. [Database Schema Overview](#7-database-schema-overview)
8. [API Endpoint Reference](#8-api-endpoint-reference)
9. [Current Technical Debt / Audit Status](#9-current-technical-debt--audit-status)
10. [Phase Roadmap](#10-phase-roadmap)
11. [AI Action System Reference](#11-ai-action-system-reference)
12. [Testing Expectations](#12-testing-expectations)
13. [Common Gotchas](#13-common-gotchas)
14. [Working With This Codebase Checklist](#14-working-with-this-codebase-checklist)

---

## 1. Project Identity & Vision

**ProtoPulse** is an all-in-one browser-based EDA platform built for makers, learners, and hobbyists who want a single tool that does everything — from learning basic circuits to designing, wiring, simulating, and programming real hardware. The vision is TinkerCad + Fritzing + KiCad + Wokwi unified into a single AI-powered experience.

**Origin:** Built by a maker working on a rover (Arduino Mega, ESP32, RioRand motor controllers, salvaged hoverboard wheels) who couldn't find one tool that covered the full journey. Every feature is evaluated through the lens of: "Would this help someone learning electronics while building real hardware projects?"

**Heading toward:** Interactive live simulation (EveryCircuit-style), Fritzing-style breadboard wiring view, Web Serial hardware communication, camera-based component ID, engineering calculators, Arduino code generation. See `docs/future-features-and-ideas-list.md`.

### Current State

| Feature | Status |
|---------|--------|
| Architecture block diagram editor (@xyflow/react) | ✅ Shipped |
| Component Editor (SVG canvas, connectors, buses, DRC) | ✅ Shipped |
| Bill of Materials (BOM) management | ✅ Shipped |
| Design validation with categorized issues | ✅ Shipped |
| AI chat with 88 tool actions (Google Genkit) | ✅ Shipped |
| Session-based auth with encrypted API key storage | ✅ Shipped |
| Circuit schematic capture | ✅ Shipped |
| Breadboard / PCB layout views | ✅ Shipped |
| Manufacturing output (Gerber, KiCad, Eagle, pick-and-place, netlist) | ✅ Shipped |
| Circuit simulation (SPICE, frequency analysis) | ✅ Shipped |
| BOM snapshot diff engine | ✅ Shipped |
| Netlist diff / ECO engine | ✅ Shipped |
| Multi-format export (PDF report, FMEA, firmware scaffold) | ✅ Shipped |
| Component lifecycle / obsolescence tracking | ✅ Shipped |
| SPICE model library | ✅ Shipped |
| Design preferences (AI-learned per-project) | ✅ Shipped |
| Chat branches | ✅ Shipped |
| Audit log | ✅ Shipped |

### Target Users

- Electronics engineers
- Embedded developers
- Hardware startups
- Hobbyist makers transitioning from breadboard to PCB

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.6, Vite 7, Tailwind CSS v4 |
| Routing | Wouter |
| Server state | TanStack React Query |
| UI components | shadcn/ui (New York dark theme, Radix primitives) |
| Diagram editor | @xyflow/react (React Flow) |
| Backend | Node.js, Express 5, TypeScript (tsx) |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| AI providers | Google Genkit |
| Build | Vite (client), esbuild (server via `tsx scripts/build.ts`) |
| Testing | Vitest 4, happy-dom, @testing-library/react, @vitest/coverage-v8 |

---

## 2. Absolute Rules (NEVER DO)

These are non-negotiable. Violating any of these will break the project or contradict explicit user decisions.

### Library & Architecture Rules

1. **Never swap core libraries:** Wouter, Drizzle, shadcn/ui, @xyflow/react, TanStack React Query
2. **Never add Redux/Zustand/MobX/Jotai** or any global state manager — React Query + context is the pattern
3. **Never silently change API response shapes** — existing clients depend on them
4. **Never delete routes/endpoints/tables** without updating ALL callers (frontend hooks, context, AI action handlers)
5. **Never change primary key ID column types** (serial ↔ varchar) — cascading breakage across storage, routes, and frontend

### Process Rules

6. **Never ship "Big Swing" changes** without explicit user approval — propose first, implement after
7. **Never expose or log secrets/API keys** — redact in error messages, never console.log
8. **Always keep the app in a working state** — small, incremental changes only; verify after each change
9. **`npm run check` must pass with zero TypeScript errors** after every change — fix ALL errors immediately
10. **`npm test` should pass** — verify no regressions after changes

### Data Rules

11. **Never hard-delete** records from tables that use soft deletes (projects, nodes, edges, BOM items) — set `deletedAt` timestamp instead
12. **Never bypass the IStorage interface** — all data access goes through `server/storage.ts`
13. **Never insert raw SQL** for CRUD operations — use Drizzle ORM queries

---

## 3. Development Conventions

### Vertical Slice Development

Every feature follows this order, top to bottom:

```
1. shared/schema.ts          → Define table + Zod insert schema + TypeScript types
2. server/storage.ts         → Add method to IStorage interface + implement in DatabaseStorage
3. server/routes/<domain>.ts → Add API endpoint with Zod validation + asyncHandler
4. client/src/lib/           → Add React Query hook or context method
5. client/src/components/    → Build UI component
6. client/src/pages/         → Wire into navigation/routing if needed
7. Testing                   → Run npm run check + npm test, verify no regressions
```

### TypeScript

- Strict types everywhere — `@typescript-eslint/no-explicit-any` is an **error** (not a warning)
- Use `import type { ... }` for type-only imports (ESLint enforced)
- Export types from `shared/schema.ts` for database entities
- Export types from `shared/component-types.ts` for component editor entities
- Use Zod schemas for runtime validation on all API boundaries, infer TypeScript types from them
- Exhaustive switches on discriminated unions — extract shared base properties before the switch to avoid `never` type issues in the `default` case

### Zod Validation

- All API request bodies are validated with Zod schemas before processing
- Use `fromZodError()` from `zod-validation-error` for user-friendly error messages
- Insert schemas are created with `createInsertSchema()` from `drizzle-zod`, using `.omit()` for auto-generated fields

### Drizzle ORM

- Schema lives in `shared/schema.ts` — single source of truth
- Use `drizzle-kit push` (`npm run db:push`) for schema sync — no versioned migrations
- Always filter soft-deleted records: `.where(isNull(table.deletedAt))`
- Use transactions (`db.transaction()`) for multi-table atomic operations
- Array columns use `.array()` method syntax: `text().array()` NOT `array(text())`

### React Query

- Server state management for all API data
- Configuration in `client/src/lib/queryClient.ts`
- Query keys use API path strings: `['/api/projects/1/nodes']`
- Mutations invalidate related query keys on success
- Global staleTime is `5 * 60 * 1000` (5 minutes) in `queryClient.ts`. Some per-query overrides in `project-context.tsx` set `staleTime: Infinity` (known issue #66 — those queries never auto-refetch)

### shadcn/ui

- **Theme:** New York variant
- **Default mode:** Dark theme
- **Accent color:** Neon cyan `#00F0FF`
- **Fonts:** Rajdhani (display), JetBrains Mono (code), Inter (body)
- Components live in `client/src/components/ui/`
- Use `cn()` utility from `client/src/lib/utils.ts` for conditional class merging

### data-testid Convention

Every interactive and meaningful display element needs a `data-testid`:

| Element Type | Pattern | Example |
|-------------|---------|---------|
| Buttons | `{action}-{target}` | `button-submit`, `button-delete-bom` |
| Inputs | `input-{field}` | `input-email`, `input-part-number` |
| Links | `link-{destination}` | `link-profile`, `link-datasheet` |
| Display text | `{type}-{content}` | `text-username`, `status-payment` |
| Dynamic lists | `{type}-{desc}-{id}` | `card-product-${id}`, `row-bom-${itemId}` |
| Tabs | `tab-{id}` | `tab-architecture`, `tab-procurement` |
| Panels | `{panel-name}` | `mobile-header`, `mobile-bottom-nav` |

### Soft Deletes

These tables use `deletedAt` timestamp for soft deletes:
- `projects`
- `architecture_nodes`
- `architecture_edges`
- `bom_items`

When querying, always include `.where(isNull(table.deletedAt))`. The `DatabaseStorage` class handles this for you.

Tables that use **hard deletes** (no `deletedAt` column):
- `validation_issues`
- `chat_messages`
- `history_items`
- `users`, `sessions`, `api_keys`
- `component_parts`, `component_library`
- All circuit tables (`circuit_designs`, `circuit_instances`, `circuit_nets`, `circuit_wires`, etc.)

### Error Boundaries

Each view in `ProjectWorkspace.tsx` is individually wrapped in `<ErrorBoundary>` + `<Suspense>`. This prevents one view's crash from taking down the whole app.

### Toast Notifications

Use the `useToast` hook from `client/src/hooks/use-toast.ts` for user-facing action feedback.

### API Patterns

- **asyncHandler:** Wraps async route handlers to catch Promise rejections
- **payloadLimit:** Middleware that checks `Content-Length` before parsing
- **parseIdParam:** Converts URL params to numbers with validation
- **HttpError:** Custom error class with HTTP status codes
- **StorageError:** Storage-layer error class
- RESTful patterns: GET (list/read), POST (create), PATCH (partial update), PUT (replace), DELETE (remove)
- All utilities exported from `server/routes/utils.ts` for re-use in circuit routes

---

## 4. File Organization Rules

| What You're Adding | Where It Goes |
|--------------------|--------------|
| New database table | `shared/schema.ts` — table definition + `createInsertSchema` + `InsertType` + `SelectType` |
| New shared types | `shared/schema.ts` (DB entities) or `shared/component-types.ts` (component editor) |
| New storage method | `server/storage.ts` — add to `IStorage` interface AND implement in `DatabaseStorage` |
| New API endpoint (domain) | New or existing file in `server/routes/` — register in `server/routes.ts` barrel |
| New circuit API endpoint | New or existing file in `server/circuit-routes/` — register in `server/circuit-routes/index.ts` |
| New AI tool | New or existing file in `server/ai-tools/` — register in `server/ai-tools/index.ts` |
| New exporter/generator | `server/export/` — import in relevant circuit route or export route |
| New React component | `client/src/components/` with subdirectories: |
| | `views/` — full-page views (ArchitectureView, ProcurementView, etc.) |
| | `ui/` — reusable primitives (shadcn components) |
| | `panels/` — side panels (ChatPanel, AssetManager, ExportPanel) |
| | `layout/` — layout components (Sidebar, navigation) |
| | `circuit-editor/` — circuit schematic canvas components |
| New React hook | `client/src/hooks/` |
| New utility function | `client/src/lib/` |
| New page/route | `client/src/pages/` — register in `client/src/App.tsx` router |
| New documentation | `docs/` directory |

### Directory Structure

```
├── client/
│   ├── index.html
│   ├── public/                          # Static assets
│   └── src/
│       ├── App.tsx                      # Router + providers
│       ├── main.tsx                     # Entry point
│       ├── index.css                    # Global styles + Tailwind
│       ├── components/
│       │   ├── ErrorBoundary.tsx
│       │   ├── circuit-editor/          # Schematic canvas, breadboard, PCB, ERC, net tools (~22 files)
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── WorkflowBreadcrumb.tsx
│       │   │   └── sidebar/             # Sidebar sub-components
│       │   ├── panels/
│       │   │   ├── ChatPanel.tsx        # AI chat panel
│       │   │   ├── ExportPanel.tsx      # Multi-format export UI
│       │   │   ├── AssetManager.tsx     # Component library browser
│       │   │   ├── chat/                # Chat sub-components + intent handlers
│       │   │   └── asset-manager/       # Asset manager sub-components
│       │   ├── simulation/              # BodePlot, FrequencyAnalysisPanel
│       │   ├── ui/                      # shadcn/ui components (~40+ files)
│       │   └── views/
│       │       ├── ArchitectureView.tsx  # @xyflow/react canvas
│       │       ├── BomDiffPanel.tsx      # BOM snapshot comparison
│       │       ├── ComponentEditorView.tsx
│       │       ├── CustomNode.tsx        # React Flow custom node
│       │       ├── DashboardView.tsx
│       │       ├── OutputView.tsx
│       │       ├── ProcurementView.tsx   # BOM table
│       │       ├── SchematicView.tsx     # Circuit schematic (uses circuit-editor/)
│       │       ├── ValidationView.tsx
│       │       ├── WelcomeOverlay.tsx
│       │       └── component-editor/    # Component editor sub-components
│       ├── hooks/
│       │   ├── use-mobile.tsx
│       │   ├── use-toast.ts
│       │   └── useHighContrast.ts
│       ├── lib/
│       │   ├── auth-context.tsx
│       │   ├── circuit-editor/          # Wire router, breadboard model, ERC engine, hooks, view-sync
│       │   ├── component-editor/        # ComponentEditorProvider, constraint solver, diff engine, snap engine
│       │   ├── contexts/                # Split domain contexts (architecture, bom, chat, history, output, validation)
│       │   ├── dnd-context.tsx
│       │   ├── error-messages.ts
│       │   ├── project-context.tsx      # ProjectProvider (monolithic, known debt)
│       │   ├── queryClient.ts           # React Query config
│       │   ├── simulation/              # frequency-analysis, useSpiceModels
│       │   └── utils.ts                 # cn() and utilities
│       └── pages/
│           ├── AuthPage.tsx
│           ├── ProjectWorkspace.tsx     # Main workspace layout
│           └── not-found.tsx
├── server/
│   ├── index.ts                         # Server entry point
│   ├── routes.ts                        # Barrel — 21 domain routers from server/routes/ (57 lines)
│   ├── routes/                          # Domain route modules:
│   │   ├── auth.ts, settings.ts, projects.ts, architecture.ts
│   │   ├── bom.ts, validation.ts, chat.ts, history.ts
│   │   ├── components.ts, seed.ts, admin.ts, batch.ts
│   │   ├── project-io.ts, chat-branches.ts, spice-models.ts
│   │   ├── bom-snapshots.ts, design-preferences.ts, component-lifecycle.ts
│   │   └── utils.ts                     # Shared route utilities (HttpError, asyncHandler, etc.)
│   ├── circuit-routes.ts                # Barrel — re-exports from circuit-routes/index.ts (1 line)
│   ├── circuit-routes/                  # Circuit route modules:
│   │   ├── index.ts                     # Registers 13 circuit routers
│   │   ├── designs.ts, instances.ts, nets.ts, wires.ts
│   │   ├── netlist.ts, autoroute.ts, exports.ts, imports.ts
│   │   ├── simulations.ts, hierarchy.ts, expansion.ts
│   │   └── utils.ts
│   ├── circuit-ai.ts                    # Circuit AI action routes
│   ├── storage.ts                       # IStorage interface + DatabaseStorage (1,598 lines, LRU cache)
│   ├── ai.ts                            # AI system prompt, tool dispatch, SSE streaming (1,368 lines)
│   ├── ai-tools.ts                      # Barrel — 11 tool modules from server/ai-tools/
│   ├── ai-tools/                        # AI tool modules:
│   │   ├── types.ts, registry.ts, index.ts
│   │   ├── architecture.ts, bom.ts, circuit.ts
│   │   ├── component.ts, export.ts, navigation.ts
│   │   ├── project.ts, validation.ts
│   ├── export/                          # Exporters and generators (16 files):
│   │   ├── types.ts
│   │   ├── bom-exporter.ts, kicad-exporter.ts, eagle-exporter.ts, spice-exporter.ts
│   │   ├── gerber-generator.ts, drill-generator.ts, pick-place-generator.ts, netlist-generator.ts
│   │   ├── fzz-handler.ts, drc-gate.ts
│   │   ├── design-report.ts, pdf-generator.ts, pdf-report-generator.ts
│   │   ├── fmea-generator.ts, firmware-scaffold-generator.ts
│   ├── auth.ts                          # Session auth + AES-256-GCM encryption
│   ├── cache.ts                         # LRU cache implementation
│   ├── db.ts                            # PostgreSQL connection via pg + Drizzle
│   ├── env.ts                           # Environment variable validation
│   ├── metrics.ts                       # Route-level request metrics
│   ├── audit-log.ts                     # Audit log for sensitive operations
│   ├── batch-analysis.ts                # Batch AI analysis jobs
│   ├── circuit-breaker.ts               # Circuit breaker for external calls
│   ├── component-export.ts              # FZPZ import/export
│   ├── export-generators.ts             # Barrel for export modules
│   └── __tests__/                       # 28 test files (see Testing section)
├── shared/
│   ├── schema.ts                        # 24 Drizzle tables + Zod insert schemas (504 lines)
│   ├── component-types.ts               # Component editor type system (shapes, connectors, buses, DRC)
│   ├── drc-engine.ts                    # Design Rule Check engine (shared server + client)
│   ├── drc-templates.ts                 # DRC rule templates
│   ├── bom-diff.ts                      # BOM snapshot comparison engine
│   ├── netlist-diff.ts                  # Netlist comparison / ECO engine
│   ├── circuit-types.ts                 # Circuit-specific shared types
│   ├── api-types.generated.ts           # Generated API type definitions
│   └── __tests__/                       # Schema + DRC engine tests
├── docs/
│   ├── AI_AGENT_GUIDE.md               # This file
│   ├── DEVELOPER.md                    # Full API reference, auth flow, DB schema
│   ├── CHANGELOG.md                    # Version changelog
│   ├── adr/                            # Architecture Decision Records (5 ADRs)
│   └── plans/                          # Feature planning documents
├── script/
│   ├── build.ts                         # Production build script
│   └── generate-api-types.ts            # API type generation script
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts                     # Vitest workspace config (server + client projects)
├── drizzle.config.ts
└── components.json                      # shadcn/ui config
```

---

## 5. Architecture Cheat Sheet

### Request Flow

```
Browser → Express (port 5000)
  ├─ Middleware chain:
  │   helmet → compression → rate-limit → JSON parser → session auth → route metrics
  │
  ├─ Public endpoints (no auth required):
  │   ├─ POST /api/auth/register
  │   ├─ POST /api/auth/login
  │   ├─ POST /api/auth/logout
  │   ├─ GET  /api/auth/me
  │   ├─ GET  /api/health
  │   ├─ GET  /api/metrics
  │   └─ POST /api/seed
  │
  ├─ Protected endpoints (requires X-Session-Id header):
  │   ├─ /api/projects/*
  │   ├─ /api/settings/api-keys/*
  │   ├─ /api/circuits/*
  │   └─ /api/chat/ai/stream (SSE streaming)
  │
  └─ Static files:
      ├─ Dev: Vite dev server (HMR)
      └─ Prod: dist/ directory
```

### React Component Tree

```
App.tsx
  └─ ThemeProvider (next-themes)
      └─ QueryClientProvider (TanStack)
          └─ TooltipProvider (Radix)
              └─ Router (Wouter)
                  ├─ /auth → AuthPage
                  ├─ / → ProjectWorkspace
                  └─ * → NotFound
              └─ Toaster (sonner)

ProjectWorkspace
  └─ ProjectProvider (context — 40+ state values)
      └─ WorkspaceContent
          ├─ Sidebar (navigation, component tree, history)
          ├─ Main area
          │   ├─ WorkflowBreadcrumb
          │   ├─ Tab bar (Dashboard | Output | Architecture | Component Editor |
          │   │           Schematic | Procurement | Validation)
          │   └─ Active view (lazy-loaded, ErrorBoundary + Suspense wrapped):
          │       ├─ DashboardView
          │       ├─ ArchitectureView (@xyflow/react canvas)
          │       ├─ ComponentEditorView (SVG canvas + pin table)
          │       ├─ SchematicView (circuit schematic editor)
          │       ├─ ProcurementView (BOM table)
          │       ├─ ValidationView (issue list)
          │       └─ OutputView (system log)
          └─ ChatPanel (AI chat, settings, streaming)
```

### Data Flow

```
Database (PostgreSQL)
    ↕ Drizzle ORM queries
server/storage.ts (DatabaseStorage + LRU cache)
    ↕ IStorage interface
server/routes/ + server/circuit-routes/ (Express endpoints + Zod validation)
    ↕ HTTP JSON / SSE
client/src/lib/project-context.tsx (React Query + context state)
    ↕ useProject() hook
client/src/components/* (React UI)
```

### Authentication Flow

```
1. Client sends POST /api/auth/register or /api/auth/login
2. Server creates session, returns sessionId
3. Client stores sessionId (in React state via auth-context.tsx)
4. All subsequent API calls include X-Session-Id header
5. Server middleware validates session on protected routes
6. Sessions expire after 7 days
```

---

## 6. Key Files Quick Reference

| File | ~Lines | What It Does |
|------|--------|-------------|
| `shared/schema.ts` | 504 | ALL 24 database tables, Zod insert schemas, TypeScript types |
| `shared/component-types.ts` | — | Component editor type system: shapes, connectors, buses, views, DRC |
| `shared/drc-engine.ts` | — | Design rule checking engine (shared between server + client) |
| `shared/bom-diff.ts` | — | BOM snapshot comparison engine |
| `shared/netlist-diff.ts` | — | Netlist comparison / ECO engine |
| `server/routes.ts` | 57 | Barrel — 21 domain routers from `server/routes/` |
| `server/circuit-routes.ts` | 1 | Barrel — re-exports `registerCircuitRoutes` from `server/circuit-routes/index.ts` |
| `server/ai.ts` | 1,368 | AI system prompt builder, tool dispatch, SSE streaming, multi-model routing |
| `server/storage.ts` | 1,598 | `IStorage` interface (60+ methods) + `DatabaseStorage` with LRU cache, soft deletes, pagination |
| `server/auth.ts` | — | Session auth (7-day expiry), password hashing (scrypt), AES-256-GCM API key encryption |
| `server/cache.ts` | — | LRU cache implementation (evicts least-recently-used on capacity overflow) |
| `server/audit-log.ts` | — | Structured audit log for sensitive operations |
| `server/circuit-breaker.ts` | — | Circuit breaker for external service calls |
| `server/export/` | 16 files | KiCad, Eagle, SPICE, BOM exporters; Gerber, drill, pick-and-place, netlist generators; PDF, FMEA, firmware scaffold |
| `client/src/lib/project-context.tsx` | — | `ProjectProvider` context: 40+ state values, React Query mutations (known monolith debt) |
| `client/src/lib/queryClient.ts` | — | React Query client config, `apiRequest()` helper, `getQueryFn()` factory |
| `client/src/pages/ProjectWorkspace.tsx` | — | 3-panel layout (sidebar + main + chat), tab switching, resize handles, lazy loading |
| `client/src/components/panels/ChatPanel.tsx` | — | AI chat UI, model settings, SSE streaming, action parsing/execution, markdown rendering |
| `client/src/components/layout/Sidebar.tsx` | — | Navigation menu, component tree, history list, project settings |
| `client/src/components/views/ArchitectureView.tsx` | — | @xyflow/react canvas, context menu, node CRUD, edge CRUD, auto-layout |
| `client/src/components/views/SchematicView.tsx` | — | Circuit schematic editor (delegates to circuit-editor/ components) |
| `client/src/components/panels/ExportPanel.tsx` | — | Multi-format export UI |
| `client/src/App.tsx` | — | Wouter router, provider wrappers |

---

## 7. Database Schema Overview

### Tables (24 total)

| Table | PK Type | Soft Delete | Parent FK | Purpose |
|-------|---------|-------------|-----------|---------|
| `projects` | serial | ✅ `deletedAt` | — | Top-level project container |
| `architecture_nodes` | serial | ✅ `deletedAt` | `projects.id` CASCADE | Block diagram nodes |
| `architecture_edges` | serial | ✅ `deletedAt` | `projects.id` CASCADE | Block diagram connections |
| `bom_items` | serial | ✅ `deletedAt` | `projects.id` CASCADE | Bill of Materials entries |
| `validation_issues` | serial | ❌ | `projects.id` CASCADE | Design rule check results |
| `chat_messages` | serial | ❌ | `projects.id` CASCADE | AI chat history (supports branches) |
| `history_items` | serial | ❌ | `projects.id` CASCADE | User/AI action log |
| `users` | serial | ❌ | — | User accounts |
| `sessions` | text | ❌ | `users.id` CASCADE | Auth sessions (UUID PK, 7-day expiry) |
| `api_keys` | serial | ❌ | `users.id` CASCADE | Encrypted AI provider keys (AES-256-GCM) |
| `user_chat_settings` | serial | ❌ | `users.id` CASCADE | Per-user AI provider, model, temperature, routing strategy |
| `component_parts` | serial | ❌ | `projects.id` CASCADE | Component editor parts (JSONB heavy) |
| `component_library` | serial | ❌ | — | Shared component library (public/private, forkable) |
| `circuit_designs` | serial | ❌ | `projects.id` CASCADE | Circuit schematic designs (supports hierarchy) |
| `hierarchical_ports` | serial | ❌ | `circuit_designs.id` CASCADE | Inter-sheet port connections |
| `circuit_instances` | serial | ❌ | `circuit_designs.id` CASCADE | Component instances in schematic + breadboard + PCB positions |
| `circuit_nets` | serial | ❌ | `circuit_designs.id` CASCADE | Electrical nets (segments, labels, style) |
| `circuit_wires` | serial | ❌ | `circuit_designs.id` CASCADE | Wire segments per view (schematic/breadboard/PCB) |
| `simulation_results` | serial | ❌ | `circuit_designs.id` CASCADE | SPICE simulation output |
| `ai_actions` | serial | ❌ | `projects.id` CASCADE | AI tool execution log (audit/replay) |
| `design_preferences` | serial | ❌ | `projects.id` CASCADE | AI-learned per-project preferences (category + key + value) |
| `bom_snapshots` | serial | ❌ | `projects.id` CASCADE | Point-in-time BOM captures for diffing |
| `spice_models` | serial | ❌ | — | Standard SPICE component model definitions |
| `component_lifecycle` | serial | ❌ | `projects.id` CASCADE | Component obsolescence and lifecycle tracking |

### Key Columns by Table

**`circuit_instances`** — stores positions in all three views:
- `schematicX/Y/Rotation` — schematic canvas position
- `breadboardX/Y/Rotation` — breadboard view position
- `pcbX/Y/Rotation/Side` — PCB layout position

**`circuit_wires`** — `view` column discriminates which canvas the wire belongs to (`schematic`, `breadboard`, `pcb`)

**`chat_messages`** — `branchId` + `parentMessageId` columns support chat branching

**`user_chat_settings`** — `routingStrategy` controls multi-model routing (`user`, `auto`, `always_claude`, `always_gemini`)

**`spice_models`** — `modelType` enum: NPN, PNP, DIODE, ZENER, SCHOTTKY, LED, NMOS, PMOS, OPAMP, COMPARATOR, VOLTAGE_REG, TIMER, RESISTOR, CAPACITOR, INDUCTOR, and JFET variants

### Key Relationships

- All project-related tables FK to `projects.id` with `onDelete: cascade`
- `architecture_nodes` has unique index on `(projectId, nodeId)` — `nodeId` is the React Flow UUID
- `architecture_edges` has unique index on `(projectId, edgeId)`
- `bom_items.totalPrice` is computed server-side: `quantity * unitPrice`
- `component_parts` uses JSONB columns for `meta`, `connectors`, `buses`, `views`, `constraints`
- `circuit_designs` supports hierarchy via `parentDesignId` self-reference
- `hierarchical_ports` links sheets together via `designId` FK + net names

### Schema Conventions

```typescript
// Pattern for every table:
export const myTable = pgTable("my_table", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  // ... columns ...
  deletedAt: timestamp("deleted_at"),  // Only if soft-delete
}, (table) => [
  index("idx_my_table_project").on(table.projectId),
]);

export const insertMyTableSchema = createInsertSchema(myTable).omit({ id: true, deletedAt: true });
export type InsertMyTable = z.infer<typeof insertMyTableSchema>;
export type MyTable = typeof myTable.$inferSelect;
```

---

## 8. API Endpoint Reference

### Authentication (Public)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/register` | `{ username, password }` | `{ sessionId, user: { id, username } }` |
| POST | `/api/auth/login` | `{ username, password }` | `{ sessionId, user: { id, username } }` |
| POST | `/api/auth/logout` | — | 204 |
| GET | `/api/auth/me` | — | `{ id, username }` |

### API Key Management (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/settings/api-keys` | — | `{ providers: string[] }` |
| POST | `/api/settings/api-keys` | `{ provider, apiKey }` | `{ message }` |
| DELETE | `/api/settings/api-keys/:provider` | — | 204 |
| GET | `/api/settings/chat` | — | `UserChatSettings` |
| PATCH | `/api/settings/chat` | partial settings | `UserChatSettings` |

### Projects (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects` | query: `limit, offset, sort` | `Project[]` |
| GET | `/api/projects/:id` | — | `Project` |
| POST | `/api/projects` | `{ name, description? }` | `Project` (201) |
| PATCH | `/api/projects/:id` | `{ name?, description? }` | `Project` |
| DELETE | `/api/projects/:id` | — | 204 (soft delete) |

### Architecture Nodes (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:id/nodes` | query: pagination | `ArchitectureNode[]` |
| POST | `/api/projects/:id/nodes` | node data | `ArchitectureNode` (201) |
| PATCH | `/api/projects/:id/nodes/:nodeId` | partial node | `ArchitectureNode` |
| PUT | `/api/projects/:id/nodes` | `ArchitectureNode[]` | `ArchitectureNode[]` (replace all) |

### Architecture Edges (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:id/edges` | query: pagination | `ArchitectureEdge[]` |
| POST | `/api/projects/:id/edges` | edge data | `ArchitectureEdge` (201) |
| PATCH | `/api/projects/:id/edges/:edgeId` | partial edge | `ArchitectureEdge` |
| PUT | `/api/projects/:id/edges` | `ArchitectureEdge[]` | `ArchitectureEdge[]` (replace all) |

### BOM Items (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:id/bom` | query: pagination | `BomItem[]` |
| GET | `/api/projects/:id/bom/:bomId` | — | `BomItem` |
| POST | `/api/projects/:id/bom` | item data | `BomItem` (201) |
| PATCH | `/api/projects/:id/bom/:bomId` | partial item | `BomItem` |
| DELETE | `/api/projects/:id/bom/:bomId` | — | 204 (soft delete) |

### BOM Snapshots (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/projects/:id/bom-snapshots` | `{ label }` | `BomSnapshot` (201) |
| GET | `/api/projects/:id/bom-snapshots` | — | `BomSnapshot[]` |
| DELETE | `/api/projects/:id/bom-snapshots/:snapshotId` | — | 204 |
| POST | `/api/projects/:id/bom-diff` | `{ snapshotId }` | BOM diff result |

### Validation Issues (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:id/validation` | query: pagination | `ValidationIssue[]` |
| POST | `/api/projects/:id/validation` | issue data | `ValidationIssue` (201) |
| DELETE | `/api/projects/:id/validation/:issueId` | — | 204 (hard delete) |
| PUT | `/api/projects/:id/validation` | `ValidationIssue[]` | `ValidationIssue[]` (replace all) |

### Chat Messages (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:id/chat` | query: pagination | `ChatMessage[]` |
| POST | `/api/projects/:id/chat` | `{ role, content, mode?, branchId? }` | `ChatMessage` (201) |
| DELETE | `/api/projects/:id/chat` | — | 204 (delete all for project) |
| DELETE | `/api/projects/:id/chat/:msgId` | — | 204 |
| POST | `/api/chat/ai` | AI request schema | `{ message, actions }` |
| POST | `/api/chat/ai/stream` | AI request schema | SSE stream |
| GET | `/api/projects/:id/ai-actions` | — | `AiActionRow[]` |
| GET | `/api/ai-actions/by-message/:messageId` | — | `AiActionRow[]` |

### Chat Branches (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/projects/:id/chat/branches` | `{ parentMessageId, label? }` | branch info |
| GET | `/api/projects/:id/chat/branches` | — | branch list |

### History (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:id/history` | query: pagination | `HistoryItem[]` |
| POST | `/api/projects/:id/history` | `{ action, user }` | `HistoryItem` (201) |
| DELETE | `/api/projects/:id/history` | — | 204 (delete all) |
| DELETE | `/api/projects/:id/history/:itemId` | — | 204 |

### Component Parts (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:projectId/component-parts` | — | `ComponentPart[]` |
| GET | `/api/projects/:projectId/component-parts/by-node/:nodeId` | — | `ComponentPart` |
| GET | `/api/projects/:projectId/component-parts/:id` | — | `ComponentPart` |
| POST | `/api/projects/:projectId/component-parts` | part data | `ComponentPart` (201) |
| PATCH | `/api/projects/:projectId/component-parts/:id` | partial part | `ComponentPart` |
| DELETE | `/api/projects/:projectId/component-parts/:id` | — | 204 |
| POST | `/api/projects/:projectId/component-parts/:id/export/fzpz` | — | FZPZ binary |
| POST | `/api/projects/:projectId/component-parts/import/fzpz` | multipart | `ComponentPart` |
| POST | `/api/projects/:projectId/component-parts/:id/import/svg` | `{ svg }` | updated part |
| GET | `/api/projects/:projectId/component-parts/:id/drc` | — | DRC results |
| POST | `/api/projects/:projectId/component-parts/ai/generate` | `{ description }` | `ComponentPart` |
| POST | `/api/projects/:projectId/component-parts/:id/ai/modify` | `{ instruction }` | `ComponentPart` |
| POST | `/api/projects/:projectId/component-parts/:id/ai/extract` | — | extracted data |
| POST | `/api/projects/:projectId/component-parts/:id/ai/suggest` | — | suggestions |
| POST | `/api/projects/:projectId/component-parts/:id/ai/extract-pins` | — | pin data |

### Component Library (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/component-library` | — | `ComponentLibraryEntry[]` |
| GET | `/api/component-library/:id` | — | `ComponentLibraryEntry` |
| POST | `/api/component-library` | library entry data | `ComponentLibraryEntry` (201) |
| PATCH | `/api/component-library/:id` | partial entry | `ComponentLibraryEntry` |
| POST | `/api/component-library/:id/fork` | — | forked entry |

### Circuit Designs (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:projectId/circuits` | — | `CircuitDesignRow[]` |
| GET | `/api/projects/:projectId/circuits/:id` | — | `CircuitDesignRow` |
| POST | `/api/projects/:projectId/circuits` | design data | `CircuitDesignRow` (201) |
| PATCH | `/api/projects/:projectId/circuits/:id` | partial design | `CircuitDesignRow` |
| DELETE | `/api/projects/:projectId/circuits/:id` | — | `{ success: true }` |
| GET | `/api/projects/:projectId/circuits/roots` | — | root designs |
| GET | `/api/projects/:projectId/circuits/:designId/children` | — | child designs |
| POST | `/api/projects/:projectId/circuits/expand-architecture` | `{ nodeIds? }` | expansion result |

### Hierarchical Ports (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:projectId/circuits/:designId/ports` | — | `HierarchicalPortRow[]` |
| POST | `/api/projects/:projectId/circuits/:designId/ports` | port data | `HierarchicalPortRow` (201) |
| PATCH | `/api/projects/:projectId/circuits/:designId/ports/:portId` | partial port | `HierarchicalPortRow` |
| DELETE | `/api/projects/:projectId/circuits/:designId/ports/:portId` | — | `{ success: true }` |

### Circuit Instances (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/circuits/:circuitId/instances` | — | `CircuitInstanceRow[]` |
| GET | `/api/circuits/:circuitId/instances/:id` | — | `CircuitInstanceRow` |
| POST | `/api/circuits/:circuitId/instances` | instance data | `CircuitInstanceRow` (201) |
| PATCH | `/api/circuits/:circuitId/instances/:id` | partial instance | `CircuitInstanceRow` |
| DELETE | `/api/circuits/:circuitId/instances/:id` | — | `{ success: true }` |

### Circuit Nets (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/circuits/:circuitId/nets` | — | `CircuitNetRow[]` |
| GET | `/api/circuits/:circuitId/nets/:id` | — | `CircuitNetRow` |
| POST | `/api/circuits/:circuitId/nets` | net data | `CircuitNetRow` (201) |
| PATCH | `/api/circuits/:circuitId/nets/:id` | partial net | `CircuitNetRow` |
| DELETE | `/api/circuits/:circuitId/nets/:id` | — | `{ success: true }` |

### Circuit Wires (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/circuits/:circuitId/wires` | — | `CircuitWireRow[]` |
| POST | `/api/circuits/:circuitId/wires` | wire data | `CircuitWireRow` (201) |
| PATCH | `/api/wires/:id` | partial wire | `CircuitWireRow` |
| DELETE | `/api/wires/:id` | — | `{ success: true }` |

### Netlist (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/circuits/:circuitId/netlist` | options | netlist JSON |
| POST | `/api/circuits/:circuitId/netlist-diff` | `{ referenceNetlist }` | diff result |

### Autoroute (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/circuits/:circuitId/autoroute` | options | autoroute result |
| POST | `/api/circuits/:circuitId/suggest-layout` | options | layout suggestion |

### Simulation (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/projects/:projectId/circuits/:circuitId/simulate` | simulation config | `SimulationResultRow` |
| GET | `/api/projects/:projectId/circuits/:circuitId/simulations` | — | `SimulationResultRow[]` |
| GET | `/api/projects/:projectId/circuits/:circuitId/simulations/:simId` | — | `SimulationResultRow` |
| DELETE | `/api/projects/:projectId/circuits/:circuitId/simulations/:simId` | — | `{ success: true }` |
| GET | `/api/projects/:projectId/circuits/:circuitId/simulation/capabilities` | — | capabilities |
| POST | `/api/projects/:projectId/circuits/:circuitId/analyze/power` | — | power analysis |
| POST | `/api/projects/:projectId/circuits/:circuitId/analyze/signal-integrity` | — | SI analysis |

### Export (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/projects/:projectId/export/bom` | options | BOM CSV/JSON |
| POST | `/api/projects/:projectId/export/netlist` | options | netlist |
| POST | `/api/projects/:projectId/export/gerber` | options | Gerber ZIP |
| POST | `/api/projects/:projectId/export/pick-place` | options | pick-and-place CSV |
| POST | `/api/projects/:projectId/export/kicad` | options | KiCad file |
| POST | `/api/projects/:projectId/export/eagle` | options | Eagle file |
| POST | `/api/projects/:projectId/export/spice` | options | SPICE netlist |
| POST | `/api/projects/:projectId/export/pdf` | options | PDF schematic |
| POST | `/api/projects/:projectId/export/report-pdf` | options | PDF design report |
| POST | `/api/projects/:projectId/export/fmea` | options | FMEA report |
| POST | `/api/projects/:projectId/export/fzz` | options | Fritzing project |
| POST | `/api/projects/:projectId/export/firmware` | options | firmware scaffold |
| GET | `/api/projects/:id/export` | query: `format` | project export JSON |
| POST | `/api/projects/import` | project data | imported `Project` |

### Import (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/projects/:projectId/import/fzz` | multipart Fritzing file | import result |
| POST | `/api/projects/:projectId/import/kicad` | multipart KiCad file | import result |

### Design Preferences (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:id/preferences` | — | `DesignPreference[]` |
| POST | `/api/projects/:id/preferences` | `{ category, key, value, source?, confidence? }` | `DesignPreference` (201) |
| PUT | `/api/projects/:id/preferences` | preference data | upserted `DesignPreference` |
| DELETE | `/api/projects/:id/preferences/:prefId` | — | 204 |

### Component Lifecycle (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:id/lifecycle` | — | `ComponentLifecycle[]` |
| POST | `/api/projects/:id/lifecycle` | lifecycle data | `ComponentLifecycle` (201) |
| PATCH | `/api/projects/:id/lifecycle/:entryId` | partial data | `ComponentLifecycle` |
| DELETE | `/api/projects/:id/lifecycle/:entryId` | — | 204 |

### SPICE Models (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/spice-models` | query: `category?, modelType?` | `SpiceModelRow[]` |
| GET | `/api/spice-models/:id` | — | `SpiceModelRow` |
| POST | `/api/spice-models` | model data | `SpiceModelRow` (201) |
| POST | `/api/spice-models/seed` | — | seeded count |

### Batch Analysis (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/batch/catalog` | — | available batch jobs |
| POST | `/api/batch/submit` | `{ jobType, projectId, params }` | `{ batchId }` |
| GET | `/api/batch/:batchId/status` | — | job status |
| GET | `/api/batch/:batchId/results` | — | job results |
| POST | `/api/batch/:batchId/cancel` | — | `{ success: true }` |
| GET | `/api/projects/:projectId/batches` | — | project batch history |

### Admin (Protected)

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/admin/metrics` | server metrics |
| DELETE | `/api/admin/purge` | purge result |

### Utility (Public)

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/health` | `{ status: "ok" }` |
| GET | `/api/metrics` | route metrics |
| POST | `/api/seed` | seeds default project if none exists |

### Pagination

All list endpoints support these query parameters:
- `limit` (1–100, default 50)
- `offset` (0+, default 0)
- `sort` ("asc" | "desc", default "desc")

### Response Envelope Note

DELETE endpoints in `server/routes/` return **204 No Content**.
DELETE endpoints in `server/circuit-routes/` return **`{ success: true }`** (JSON body).
This inconsistency is known debt (GA-API-03).

---

## 9. Current Technical Debt / Audit Status

Full details: `docs/product-analysis-checklist.md` and `docs/app-audit-checklist.md`

### Summary

- 240+ tracked items across product analysis report and gap analysis
- 9 P0 items identified (security, performance, reliability)
- See `docs/product-analysis-report.md` for comprehensive 5-phase analysis

### P0 Security Items (Fix These First)

| Issue | Area |
|-------|------|
| CORS dynamic origin reflection — needs allowlist | `server/index.ts` |
| XSS via `javascript:` URIs in AI markdown — needs protocol validation | `ChatPanel.tsx` |
| ZIP bomb vulnerability in FZPZ import — needs decompressed size check | `server/export/fzz-handler.ts` |
| Missing `process.on('uncaughtException')` handler | `server/index.ts` |

### Key Architectural Debt

| # | Issue | File/Area |
|---|-------|-----------|
| — | Monolithic `ProjectProvider` causes cascade re-renders on any state change | `project-context.tsx` |
| — | `PROJECT_ID = 1` hardcoded — blocks multi-project support | `project-context.tsx` |
| — | AI system prompt rebuilds full project state on every request — O(N) sequential queries | `server/ai.ts` |
| — | No API versioning — all routes at `/api/*` with no version prefix | All routes |
| — | Per-query `staleTime: Infinity` overrides — those queries never auto-refetch | `project-context.tsx` |
| — | DELETEs return 204 in routes.ts but `{ success: true }` in circuit-routes.ts | API layer |

---

## 10. Phase Roadmap

### Phase 0 — Audit Remediation (Ongoing)

- Fix P0/P1 security and reliability findings
- Code quality and TypeScript strictness improvements
- Expand test coverage

### Phase 1 — Multi-Project & Core Infrastructure

- Remove `PROJECT_ID = 1` hardcoding
- Split monolithic `ProjectProvider` into domain contexts
- Implement proper undo/redo system
- Route-based project selection

### Phase 2 — Component Editor ✅ COMPLETE

- Interactive SVG canvas for part design
- Connectors (pins) with terminal positions and pad specs
- Buses (groups of connectors)
- Multi-view support: breadboard, schematic, PCB, metadata, pin-table
- Design Rule Check (DRC) validation
- Persistence via `component_parts` table (JSONB)

### Phase 3 — Circuit Schematic Capture ✅ COMPLETE

- Full schematic canvas using circuit-editor/ components
- Schematic symbol library via component_parts
- Wire routing (A* algorithm)
- Multi-sheet support via hierarchical_ports + circuit_designs hierarchy
- Net drawing tool, ERC panel, net class panel
- Breadboard and PCB layout views

### Phase 4 — Breadboard / PCB Layout ✅ COMPLETE

- Breadboard placement view (`BreadboardView.tsx`)
- PCB layout editor (`PCBLayoutView.tsx`)
- Autoroute endpoint (`/api/circuits/:circuitId/autoroute`)
- Ratsnest overlay, component placer, breadboard grid

### Phase 5 — Manufacturing Output ✅ COMPLETE

- Gerber file generation (RS-274X)
- Drill file generation (Excellon)
- Pick-and-place CSV
- KiCad schematic export
- Eagle schematic export
- BOM export (CSV/JSON)
- Netlist export (multiple formats)
- SPICE netlist
- PDF schematic + design report
- FMEA report
- Firmware scaffold generator

### Phase 6 — Circuit Simulation ✅ COMPLETE

- SPICE simulation engine (`circuit-solver.ts`)
- Frequency analysis (`frequency-analysis.ts`)
- Bode plot viewer (`BodePlot.tsx`, `FrequencyAnalysisPanel.tsx`)
- Power budget analysis
- Signal integrity analysis
- Simulation results persistence (`simulation_results` table)

### Future / Planned

- Remove `PROJECT_ID = 1` hardcoding (multi-project)
- Split `ProjectProvider` monolith
- API versioning
- Virtualization for long lists (BOM, chat)

---

## 11. AI Action System Reference

The AI system (`server/ai.ts` + `server/ai-tools/`) exposes **88 tool actions** via the Google Genkit API. Tools are organized in 11 modules under `server/ai-tools/`.

### Tool Modules

| Module | File | Responsibility |
|--------|------|---------------|
| Registry | `registry.ts` | Tool registration and lookup |
| Navigation | `navigation.ts` | View switching, sheet navigation, undo/redo |
| Architecture | `architecture.ts` | Node/edge CRUD, canvas generation, layout |
| BOM | `bom.ts` | BOM item management, pricing, optimization |
| Circuit | `circuit.ts` | Schematic instance/net/wire CRUD, ERC |
| Component | `component.ts` | Component part creation, fork, DRC |
| Export | `export.ts` | All export format triggers |
| Validation | `validation.ts` | DRC, ERC, validation issue management |
| Project | `project.ts` | Rename, description, preferences, decisions |
| Navigation | `navigation.ts` | Focus, tutorials, UI state |
| Index | `index.ts` | Barrel — registers all modules |

### Tool Categories

#### View Navigation
`switch_view`, `switch_schematic_sheet`, `focus_node_in_view`, `start_tutorial`

#### Architecture Nodes & Edges
`add_node`, `remove_node`, `update_node`, `clear_canvas`, `connect_nodes`, `remove_edge`, `generate_architecture`, `auto_layout`, `select_node`

#### BOM Management
`add_bom_item`, `remove_bom_item`, `update_bom_item`, `optimize_bom`, `pricing_lookup`, `suggest_alternatives`, `check_lead_times`, `parametric_search`, `copy_architecture_json`, `copy_architecture_summary`

#### Validation & DRC
`run_validation`, `clear_validation`, `add_validation_issue`, `auto_fix_validation`, `run_erc`, `dfm_check`, `voltage_domain_check`, `power_budget_analysis`, `thermal_analysis`, `validate_component`

#### Circuit Schematic
`create_circuit`, `place_component`, `remove_component_instance`, `draw_net`, `remove_net`, `remove_wire`, `place_no_connect`, `place_power_symbol`, `place_breadboard_wire`, `draw_pcb_trace`, `assign_net_name`, `add_net_label`, `set_pin_map`, `auto_assign_pins`, `auto_route`, `add_subcircuit`

#### Hierarchical Sheets
`create_sheet`, `rename_sheet`, `move_to_sheet`, `expand_architecture_to_circuit`

#### Component Editor
`create_component_part`, `modify_component`, `delete_component_part`, `fork_library_component`, `compare_components`, `search_datasheet`, `add_datasheet_link`

#### Export & Output
`export_bom_csv`, `export_kicad`, `export_kicad_netlist`, `export_csv_netlist`, `export_eagle`, `export_spice`, `export_gerber`, `export_pick_and_place`, `export_fritzing_project`, `export_design_report`, `preview_gerber`

#### Project Settings
`rename_project`, `update_description`, `set_project_type`, `save_design_decision`

#### Analysis
`analyze_image`, `generate_test_plan`

#### History
`undo`, `redo`

### How Actions Flow

1. User sends message via ChatPanel
2. ChatPanel calls `POST /api/chat/ai/stream` with message + project state
3. Server builds system prompt with full project state (nodes, edges, BOM, validation, chat history)
4. AI provider (Genkit) streams response via SSE using function-calling API
5. ChatPanel receives SSE chunks, accumulates response text
6. On stream end, the tool call results are parsed and returned as a structured action list
7. ChatPanel dispatches each action through intent handlers in `client/src/components/panels/chat/intent-handlers/`
8. Actions call the appropriate context methods, API endpoints, or local state updates

### Multi-Model Routing

The `routingStrategy` in `user_chat_settings` controls which AI provider handles requests:
- `user` — uses the provider the user has configured
- `auto` — the server decides based on request complexity
- `always_gemini` — force Google Gemini

---

## 12. Testing Expectations

### Current State

54 test files, ~1,553 tests, using Vitest 4.

### Test Infrastructure

- **Framework:** Vitest 4 with workspace projects
- **Client tests:** `happy-dom` environment, `@testing-library/react`, setup file `client/src/test-setup.ts`
- **Server tests:** `node` environment (no DOM)
- **Coverage:** `@vitest/coverage-v8` — reports to `coverage/` directory
- **Legacy:** `server/__tests__/api.test.ts` uses `node:test` runner — excluded from Vitest config

### Test File Locations

```
server/__tests__/           # 28 files
  ai.test.ts, ai-tools-architecture.test.ts, ai-tools-bom.test.ts
  ai-tools-navigation.test.ts, ai-tools-validation.test.ts
  auth.test.ts, auth-session.test.ts, admin-purge.test.ts
  audit-log.test.ts, batch-analysis.test.ts (excluded: api.test.ts)
  circuit-breaker.test.ts, db-constraints.test.ts
  lru-cache.test.ts, metrics.test.ts, routes-utils.test.ts
  storage.test.ts, storage-integration.test.ts, stream-abuse.test.ts
  # Exporters:
  bom-exporter.test.ts, eagle-exporter.test.ts, gerber-generator.test.ts
  kicad-exporter.test.ts, spice-exporter.test.ts, netlist-generator.test.ts
  drill-generator.test.ts, pick-place-generator.test.ts
  drc-gate.test.ts, export-snapshot.test.ts

client/src/lib/circuit-editor/__tests__/
  wire-router.test.ts, erc-engine.test.ts, breadboard-model.test.ts

client/src/lib/component-editor/__tests__/
  constraint-solver.test.ts, diff-engine.test.ts, snap-engine.test.ts

client/src/lib/simulation/__tests__/
  circuit-solver.test.ts, spice-generator.test.ts

client/src/lib/contexts/__tests__/
  architecture-context.test.tsx, bom-context.test.tsx
  chat-context.test.tsx, history-context.test.tsx

client/src/lib/__tests__/
  utils.test.ts

client/src/components/panels/__tests__/
  ChatPanel.test.tsx

client/src/components/panels/chat/hooks/__tests__/
  useActionExecutor.test.tsx

client/src/components/layout/__tests__/
  Sidebar.test.tsx

client/src/components/views/__tests__/
  ArchitectureView.test.tsx, ProcurementView.test.tsx, ValidationView.test.tsx

shared/__tests__/
  schema.test.ts, drc-engine.test.ts
```

### Running Tests

```bash
npm test                                    # All tests (server + client)
npm run test:watch                          # Interactive watch mode
npm run test:coverage                       # With v8 coverage report
npx vitest run --project server             # Server tests only
npx vitest run --project client             # Client tests only
npx vitest run path/to/file.test.ts         # Single file
npx vitest run -t "test name"               # By test name
```

### Testing Philosophy

**When tests fail, fix the code, not the test.**
- Tests should be meaningful — avoid tests that always pass regardless of behavior
- Test actual functionality — call the functions being tested
- Fix the root cause — when a test fails, fix the underlying issue
- Test edge cases — tests that reveal limitations help improve the code

---

## 13. Common Gotchas

### Database

| Gotcha | Details |
|--------|---------|
| **Soft deletes** | Projects, nodes, edges, BOM items use `deletedAt`. Always filter with `isNull(table.deletedAt)` in queries. `DatabaseStorage` handles this, but raw queries must include it. |
| **BOM totalPrice** | Computed server-side in `DatabaseStorage.createBomItem()` and `updateBomItem()` as `quantity * unitPrice`. Never set it from the client. |
| **LRU cache invalidation** | Uses prefix matching. Invalidating `"nodes:1"` clears `"nodes:1:50:0:desc"`, `"nodes:1:100:0:asc"`, etc. Be careful with cache key naming. |
| **PROJECT_ID = 1** | Hardcoded in `project-context.tsx`. The seed endpoint creates project ID 1 on first run. Multi-project support is blocked by this. |
| **replace* methods** | `replaceNodes`, `replaceEdges`, `replaceValidationIssues` do a hard DELETE + INSERT inside a transaction. They don't use soft deletes. |
| **Circuit tables** | Circuit tables (`circuit_designs`, `circuit_instances`, etc.) do NOT use soft deletes — DELETE is immediate and permanent. |

### Authentication

| Gotcha | Details |
|--------|---------|
| **Session header** | Uses `X-Session-Id` header, NOT cookies. Frontend must include this on every protected request. |
| **API key encryption** | AES-256-GCM. Uses `API_KEY_ENCRYPTION_KEY` env var. In dev, falls back to random key (keys don't survive restart). |
| **Session expiry** | 7 days (`SESSION_DURATION_MS`). Expired sessions are cleaned up on next validation attempt. |
| **Auth context** | Client stores session in `auth-context.tsx` (React state), not localStorage. |

### Frontend

| Gotcha | Details |
|--------|---------|
| **Component editor context** | Uses a separate `ComponentEditorProvider` (`client/src/lib/component-editor/`), not the main `ProjectProvider`. |
| **React Flow node IDs** | Use `crypto.randomUUID()`, NOT `Date.now()`. |
| **AI system prompt** | Rebuilds full project state (all nodes, edges, BOM, validation, chat history) on EVERY request. Can be expensive for large projects. |
| **staleTime overrides** | Global staleTime is 5 min (`queryClient.ts`), but per-query overrides in `project-context.tsx` set `staleTime: Infinity`. Those queries never auto-refetch — only manual invalidation triggers refetch. |
| **OutputView** | Uses local React state (`outputLog`), not persisted to database. Lost on page refresh. |
| **Circuit routes DELETE response** | Returns `{ success: true }` JSON (not 204), unlike domain routes which return 204. |
| **Exhaustive switch on discriminated unions** | The `Shape` type and other discriminated unions require extracting shared base properties BEFORE the switch statement to avoid `never` type issues in the `default` case. |

### AI System

| Gotcha | Details |
|--------|---------|
| **Tool dispatch** | Tools are dispatched via the function-calling API, not via JSON parsing a text response. The old `parseActionsFromResponse()` pattern is replaced by structured function calls. |
| **Node references** | AI tools reference architecture nodes by LABEL, not by internal database ID. Resolution happens in the frontend. |
| **Client caching** | LRU cache (size 10) for Genkit client instances, keyed by API key. |
| **Multi-model routing** | `routingStrategy` in `user_chat_settings` controls whether Claude or Gemini handles each request. |

### Exports

| Gotcha | Details |
|--------|---------|
| **DRC gate** | `server/export/drc-gate.ts` can block exports if critical DRC violations are present. Check DRC before attempting export. |
| **FZPZ import** | ZIP bomb vulnerability exists — decompressed size check is a known P0 security item (not yet fixed). |
| **Gerber output** | Generates RS-274X format. The drill file is separate (Excellon format), generated by `drill-generator.ts`. |

---

## 14. Working With This Codebase Checklist

### Before Making Changes

- [ ] Read `AGENTS.md` (or the AI config symlinks) for current project state and user preferences
- [ ] Check `docs/product-analysis-checklist.md` for related open audit items
- [ ] Understand the vertical slice path: `schema → storage → routes → hooks → UI`
- [ ] Check neighboring files for existing patterns before writing new code
- [ ] Verify the library/framework is already in `package.json` before importing it
- [ ] Check if there's an existing utility/helper for what you need in `client/src/lib/`
- [ ] Review the `IStorage` interface if adding data operations
- [ ] Look at how similar features were implemented (follow existing patterns)

### While Making Changes

- [ ] Follow the vertical slice order for new features
- [ ] Add `data-testid` to all interactive and display elements
- [ ] Use Zod validation for all API request bodies
- [ ] Use `asyncHandler` wrapper for async route handlers
- [ ] Use `isNull(table.deletedAt)` for soft-delete tables
- [ ] Keep changes small and incremental — one feature at a time
- [ ] Use TypeScript strict types — avoid `any`
- [ ] Use the existing `cn()` utility for conditional Tailwind classes
- [ ] Use `useToast` for user-facing feedback messages
- [ ] Wrap new views in `<ErrorBoundary>` + `<Suspense>`
- [ ] Use `import type { ... }` for type-only imports

### After Making Changes

- [ ] Run `npm run check` — must pass with **zero TypeScript errors**
- [ ] Run `npm test` — verify no regressions
- [ ] Switch through ALL tabs to smoke test
- [ ] Check the browser console for runtime errors
- [ ] Verify no secrets or API keys are logged or exposed
- [ ] Update checklist docs if fixing an audit item

### When Adding a New Feature (Full Vertical Slice)

```
1. shared/schema.ts
   └─ Add table definition with pgTable()
   └─ Add createInsertSchema with .omit() for auto fields
   └─ Export InsertType and SelectType

2. npm run db:push
   └─ Sync schema to database

3. server/storage.ts
   └─ Add methods to IStorage interface
   └─ Implement in DatabaseStorage class
   └─ Add LRU cache invalidation on writes
   └─ Filter by isNull(deletedAt) if soft-delete table

4. server/routes/<domain>.ts (or circuit-routes/<domain>.ts)
   └─ Add endpoints with asyncHandler
   └─ Add Zod validation for request bodies
   └─ Add payloadLimit middleware
   └─ Use parseIdParam for URL params
   └─ Register in server/routes.ts or server/circuit-routes/index.ts

5. client/src/lib/project-context.tsx (or domain context)
   └─ Add React Query hook for data fetching
   └─ Add mutation for data writing
   └─ Invalidate query keys on mutation success

6. client/src/components/
   └─ Build UI component with data-testid
   └─ Use useProject() to access data
   └─ Add toast notifications for actions
   └─ Wrap in ErrorBoundary if it's a view

7. client/src/pages/ProjectWorkspace.tsx
   └─ Add tab entry if new view
   └─ Add lazy import + Suspense + ErrorBoundary

8. Tests
   └─ Add server test in server/__tests__/
   └─ Add client test in appropriate __tests__/ directory

9. Verify
   └─ npm run check (zero errors)
   └─ npm test (no regressions)
   └─ Switch through all tabs
```

---

## Appendix: Environment & Tooling

### NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `NODE_ENV=development tsx server/index.ts` | Start dev server with HMR (port 5000) |
| `npm run dev:client` | Vite dev server | Client only (port 5000) |
| `npm run build` | `tsx scripts/build.ts` | Production build |
| `npm start` | `NODE_ENV=production node dist/index.cjs` | Start production server |
| `npm run check` | `tsc` | TypeScript type checking (must pass clean) |
| `npm test` | `vitest run` | Run all tests (server + client) |
| `npm run test:watch` | `vitest` | Interactive watch mode |
| `npm run test:coverage` | `vitest run --coverage` | Coverage report (v8 provider) |
| `npm run db:push` | `drizzle-kit push` | Sync Drizzle schema to database |
| `npx eslint .` | — | Lint all files |
| `npx prettier --write .` | — | Format all files |

### Key Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `API_KEY_ENCRYPTION_KEY` | Yes | 32-byte hex key for AES-256-GCM API key encryption |
| `PORT` | No | Server port (default 5000) |
| `LOG_LEVEL` | No | Winston logger level |
| `NODE_ENV` | No | "development" or "production" |

### Port Binding

- The application binds to **port 5000** on `0.0.0.0`
- In development, Vite dev server runs as middleware inside Express
- In production, Express serves static files from `dist/`
