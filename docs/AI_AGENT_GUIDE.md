# ProtoPulse — AI Agent Guide

> **Audience:** AI coding agents (Replit Agent, Cursor, Copilot, Cody, etc.)
> **Purpose:** The definitive reference for any AI agent picking up this codebase cold.
> **Last updated:** 2026-02-17

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

**ProtoPulse** is an AI-assisted Electronic Design Automation (EDA) platform built for the browser. It combines features inspired by Fritzing and KiCad, enhanced with AI capabilities for electronics design.

### Current State

| Feature | Status |
|---------|--------|
| Architecture block diagram editor (@xyflow/react) | ✅ Shipped |
| Component Editor (SVG canvas, connectors, buses, DRC) | ✅ Phase 2 complete |
| Bill of Materials (BOM) management | ✅ Shipped |
| Design validation with categorized issues | ✅ Shipped |
| AI chat with 53 action types (Anthropic + Gemini) | ✅ Shipped |
| Session-based auth with encrypted API key storage | ✅ Shipped |
| Circuit schematic capture | ❌ Phase 3 (future) |
| Breadboard/PCB layout | ❌ Phase 4 (future) |
| Manufacturing output (Gerber, KiCad export) | ❌ Phase 4 (future) |
| Circuit simulation (SPICE) | ❌ Phase 5 (future) |

### Target Users

- Electronics engineers
- Embedded developers
- Hardware startups
- Hobbyist makers transitioning from breadboard to PCB

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS v4 |
| Routing | Wouter |
| Server state | TanStack React Query |
| UI components | shadcn/ui (New York theme, Radix primitives) |
| Diagram editor | @xyflow/react (React Flow) |
| Backend | Node.js, Express 5, TypeScript (tsx) |
| Database | PostgreSQL (Neon-backed on Replit) |
| ORM | Drizzle ORM |
| AI providers | Anthropic SDK, Google Generative AI (Gemini) |
| Build | Vite (client), esbuild (server) |

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

6. **Never edit replit.md** unless explicitly asked by the user
7. **Never ship "Big Swing" changes** without explicit user approval — propose first, implement after
8. **Never expose or log secrets/API keys** — redact in error messages, never console.log
9. **Never use virtual environments or Docker** — this is a Nix environment on Replit
10. **Never skip Phase 0 prerequisites** for later phases — dependencies must be complete first
11. **Always keep the app in a working state** — small, incremental changes only; verify after each change

### Data Rules

12. **Never hard-delete** records from tables that use soft deletes (projects, nodes, edges, BOM items) — set `deletedAt` timestamp instead
13. **Never bypass the IStorage interface** — all data access goes through `server/storage.ts`
14. **Never insert raw SQL** for CRUD operations — use Drizzle ORM queries

---

## 3. Development Conventions

### Vertical Slice Development

Every feature follows this order, top to bottom:

```
1. shared/schema.ts        → Define table + Zod insert schema + TypeScript types
2. server/storage.ts       → Add method to IStorage interface + implement in DatabaseStorage
3. server/routes.ts        → Add API endpoint with Zod validation + asyncHandler
4. client/src/lib/         → Add React Query hook or context method
5. client/src/components/  → Build UI component
6. client/src/pages/       → Wire into navigation/routing if needed
7. Testing                 → Smoke test all views, verify no TypeScript errors
```

### TypeScript

- Strict types everywhere — avoid `any` unless absolutely necessary (document why)
- Use `as` casts only when Drizzle/React Flow types don't align (tag with `// TODO: fix type`)
- Export types from `shared/schema.ts` for database entities
- Export types from `shared/component-types.ts` for component editor entities
- Use Zod schemas for runtime validation, infer TypeScript types from them

### Zod Validation

- All API request bodies are validated with Zod schemas before processing
- Use `fromZodError()` from `zod-validation-error` for user-friendly error messages
- Insert schemas are created with `createInsertSchema()` from `drizzle-zod`, using `.omit()` for auto-generated fields

### Drizzle ORM

- Schema lives in `shared/schema.ts` — single source of truth
- Use `drizzle-kit push` (`npm run db:push`) for schema sync — no versioned migrations yet
- Always filter soft-deleted records: `.where(isNull(table.deletedAt))`
- Use transactions (`db.transaction()`) for multi-table atomic operations
- Array columns use `.array()` method syntax: `text().array()` NOT `array(text())`

### React Query

- Server state management for all API data
- Configuration in `client/src/lib/queryClient.ts`
- Query keys use API path strings: `['/api/projects/1/nodes']`
- Mutations invalidate related query keys on success
- Global staleTime is `5 * 60 * 1000` (5 minutes) in `queryClient.ts`. However, some per-query overrides in `project-context.tsx` set `staleTime: Infinity` (known issue #66 — those queries never auto-refetch)

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
- `component_parts`

### Error Boundaries

Each view in `ProjectWorkspace.tsx` is individually wrapped in `<ErrorBoundary>` + `<Suspense>`. This prevents one view's crash from taking down the whole app.

### Toast Notifications

Use the `useToast` hook from `client/src/hooks/use-toast.ts` for user-facing action feedback. Already wired to: CSV export, BOM add, log copy, validation actions, component save.

### API Patterns

- **asyncHandler:** Wraps async route handlers to catch Promise rejections
- **payloadLimit:** Middleware that checks `Content-Length` before parsing
- **parseIdParam:** Converts URL params to numbers with validation
- **HttpError:** Custom error class with HTTP status codes
- RESTful patterns: GET (list/read), POST (create), PATCH (partial update), PUT (replace), DELETE (remove)

---

## 4. File Organization Rules

| What You're Adding | Where It Goes |
|--------------------|--------------|
| New database table | `shared/schema.ts` — table definition + `createInsertSchema` + `InsertType` + `SelectType` |
| New shared types | `shared/schema.ts` (DB entities) or `shared/component-types.ts` (component editor) |
| New storage method | `server/storage.ts` — add to `IStorage` interface AND implement in `DatabaseStorage` |
| New API endpoint | `server/routes.ts` — with Zod validation, asyncHandler, payloadLimit |
| New React component | `client/src/components/` with subdirectories: |
| | `views/` — full-page views (ArchitectureView, ProcurementView, etc.) |
| | `ui/` — reusable primitives (shadcn components) |
| | `panels/` — side panels (ChatPanel, AssetManager) |
| | `layout/` — layout components (Sidebar, navigation) |
| New React hook | `client/src/hooks/` |
| New utility function | `client/src/lib/` |
| New page/route | `client/src/pages/` — register in `client/src/App.tsx` router |
| New documentation | `docs/` directory |

### Directory Structure

```
├── client/
│   ├── index.html
│   ├── public/                          # Static assets (favicon, OG images)
│   └── src/
│       ├── App.tsx                      # Router + providers
│       ├── main.tsx                     # Entry point
│       ├── index.css                    # Global styles + Tailwind
│       ├── components/
│       │   ├── ErrorBoundary.tsx
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx          # Main navigation sidebar (832 lines)
│       │   │   └── sidebar/            # Sidebar sub-components
│       │   ├── panels/
│       │   │   ├── ChatPanel.tsx        # AI chat panel (2363 lines)
│       │   │   ├── AssetManager.tsx     # Component library browser
│       │   │   ├── chat/               # Chat sub-components
│       │   │   └── asset-manager/      # Asset manager sub-components
│       │   ├── ui/                      # shadcn/ui components (~60 files)
│       │   └── views/
│       │       ├── ArchitectureView.tsx  # @xyflow/react canvas
│       │       ├── ComponentEditorView.tsx
│       │       ├── CustomNode.tsx       # React Flow custom node
│       │       ├── OutputView.tsx
│       │       ├── ProcurementView.tsx  # BOM table
│       │       ├── SchematicView.tsx    # Stub (to be replaced)
│       │       ├── ValidationView.tsx
│       │       ├── component-editor/   # Component editor sub-components
│       │       └── schematic/          # Schematic data
│       ├── hooks/
│       │   ├── use-mobile.tsx
│       │   └── use-toast.ts
│       ├── lib/
│       │   ├── clipboard.ts
│       │   ├── context-selectors.ts
│       │   ├── project-context.tsx      # ProjectProvider (635 lines)
│       │   ├── queryClient.ts          # React Query config
│       │   ├── types.ts
│       │   ├── utils.ts                # cn() and utilities
│       │   └── component-editor/       # ComponentEditorProvider + hooks
│       └── pages/
│           ├── ProjectWorkspace.tsx     # Main workspace (313 lines)
│           └── not-found.tsx
├── server/
│   ├── index.ts                         # Server entry point
│   ├── routes.ts                        # ALL API routes (765 lines)
│   ├── storage.ts                       # IStorage + DatabaseStorage (560 lines)
│   ├── ai.ts                           # AI system prompt + streaming (700+ lines)
│   ├── auth.ts                         # Session auth + encryption (123 lines)
│   ├── db.ts                           # Database connection
│   ├── cache.ts                        # In-memory cache
│   ├── logger.ts                       # Structured logging
│   ├── metrics.ts                      # Route metrics
│   ├── env.ts                          # Environment validation
│   ├── static.ts                       # Static file serving
│   ├── vite.ts                         # Vite dev server integration
│   ├── api-docs.ts                     # API documentation endpoint
│   └── __tests__/
│       └── api.test.ts                 # API tests
├── shared/
│   ├── schema.ts                       # Drizzle schema (200 lines)
│   └── component-types.ts              # Component editor types (178 lines)
├── docs/
│   ├── AI_AGENT_GUIDE.md              # This file
│   ├── DEVELOPER.md                   # Developer guide
│   ├── USER_GUIDE.md                  # User guide
│   ├── frontend-audit-checklist.md    # 113 audit findings
│   ├── backend-audit-checklist.md     # Backend audit
│   └── fzpz-integration-plan.md      # Fritzing part integration
├── script/
│   └── build.ts                        # Production build script
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
├── replit.md                           # Project overview (DO NOT EDIT)
└── components.json                     # shadcn/ui config
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
  │   ├─ GET  /api/docs
  │   ├─ GET  /api/metrics
  │   └─ POST /api/seed
  │
  ├─ Protected endpoints (requires X-Session-Id header):
  │   ├─ /api/projects/*
  │   ├─ /api/settings/api-keys/*
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
                  ├─ / → ProjectWorkspace
                  └─ * → NotFound
              └─ Toaster (toast notifications)

ProjectWorkspace
  └─ ProjectProvider (context — 40+ state values)
      └─ WorkspaceContent
          ├─ Sidebar (navigation, component tree, history)
          │   └─ ResizeHandle (left)
          ├─ Main area
          │   ├─ Tab bar (Output | Architecture | Component Editor | Procurement | Validation)
          │   └─ Active view (lazy-loaded, ErrorBoundary + Suspense wrapped):
          │       ├─ ArchitectureView (@xyflow/react canvas)
          │       ├─ ComponentEditorView (SVG canvas + pin table)
          │       ├─ ProcurementView (BOM table)
          │       ├─ ValidationView (issue list)
          │       └─ OutputView (system log)
          ├─ ResizeHandle (right)
          └─ ChatPanel (AI chat, settings, streaming)
```

### Data Flow

```
Database (PostgreSQL)
    ↕ Drizzle ORM queries
server/storage.ts (DatabaseStorage + in-memory cache)
    ↕ IStorage interface
server/routes.ts (Express API endpoints + Zod validation)
    ↕ HTTP JSON / SSE
client/src/lib/project-context.tsx (React Query + context state)
    ↕ useProject() hook
client/src/components/* (React UI)
```

### Authentication Flow

```
1. Client sends POST /api/auth/register or /api/auth/login
2. Server creates session, returns sessionId
3. Client stores sessionId (in React state)
4. All subsequent API calls include X-Session-Id header
5. Server middleware validates session on protected routes
6. Sessions expire after 7 days
```

---

## 6. Key Files Quick Reference

| File | ~Lines | What It Does |
|------|--------|-------------|
| `shared/schema.ts` | 200 | ALL database tables (10 tables), Zod insert schemas, TypeScript types |
| `shared/component-types.ts` | 178 | Component editor type system: shapes, connectors, buses, views, DRC |
| `server/routes.ts` | 765 | ALL API endpoints, Zod request validation, seed data, pagination |
| `server/ai.ts` | 700+ | AI system prompt builder, 53 action types, SSE streaming, error categorization, LRU client cache |
| `server/storage.ts` | 560 | `IStorage` interface (30+ methods) + `DatabaseStorage` class with in-memory cache, soft deletes, pagination, chunked inserts |
| `server/auth.ts` | 123 | Session auth (7-day expiry), password hashing (scrypt), AES-256-GCM API key encryption |
| `server/cache.ts` | ~50 | Simple in-memory key-value cache with TTL and prefix-based invalidation |
| `server/db.ts` | ~15 | PostgreSQL connection via `pg` + Drizzle initialization |
| `server/logger.ts` | ~80 | Structured JSON logging with levels |
| `server/metrics.ts` | ~50 | Route-level request counting and timing |
| `server/index.ts` | ~80 | Server bootstrap: middleware chain, route registration, port binding |
| `client/src/lib/project-context.tsx` | 635 | `ProjectProvider` context: 40+ state values, 7 React Query hooks, 8 mutations, undo/redo, change diff tracking |
| `client/src/lib/queryClient.ts` | ~30 | React Query client config, `apiRequest()` helper, `getQueryFn()` factory |
| `client/src/pages/ProjectWorkspace.tsx` | 313 | 3-panel layout (sidebar + main + chat), tab switching, resize handles, lazy loading |
| `client/src/components/panels/ChatPanel.tsx` | 2363 | AI chat UI, model settings, SSE streaming, action parsing/execution, markdown rendering |
| `client/src/components/layout/Sidebar.tsx` | 832 | Navigation menu, component tree, history list, project settings |
| `client/src/components/panels/AssetManager.tsx` | 678 | Component library browser, search, drag-and-drop, custom asset creation |
| `client/src/components/views/ArchitectureView.tsx` | ~600 | @xyflow/react canvas, context menu, node CRUD, edge CRUD, auto-layout |
| `client/src/components/views/ComponentEditorView.tsx` | ~400 | SVG shape canvas, pin table, metadata editor, DRC runner |
| `client/src/components/views/ProcurementView.tsx` | ~300 | BOM table with sorting, filtering, CSV export, add/delete items |
| `client/src/components/views/ValidationView.tsx` | ~200 | Validation issue list, severity filtering, resolve actions |
| `client/src/components/views/OutputView.tsx` | ~200 | System log viewer with filtering and copy |
| `client/src/App.tsx` | ~50 | Wouter router, provider wrappers |

---

## 7. Database Schema Overview

### Tables

| Table | PK Type | Soft Delete | Parent FK | Purpose |
|-------|---------|-------------|-----------|---------|
| `projects` | serial | ✅ `deletedAt` | — | Top-level project container |
| `architecture_nodes` | serial | ✅ `deletedAt` | `projects.id` CASCADE | Block diagram nodes |
| `architecture_edges` | serial | ✅ `deletedAt` | `projects.id` CASCADE | Block diagram connections |
| `bom_items` | serial | ✅ `deletedAt` | `projects.id` CASCADE | Bill of Materials entries |
| `validation_issues` | serial | ❌ | `projects.id` CASCADE | Design rule check results |
| `chat_messages` | serial | ❌ | `projects.id` CASCADE | AI chat history |
| `history_items` | serial | ❌ | `projects.id` CASCADE | User/AI action log |
| `component_parts` | serial | ❌ | `projects.id` CASCADE | Component editor parts (JSONB heavy) |
| `users` | serial | ❌ | — | User accounts |
| `sessions` | text | ❌ | `users.id` CASCADE | Auth sessions (UUID PK) |
| `api_keys` | serial | ❌ | `users.id` CASCADE | Encrypted AI provider keys |

### Key Relationships

- All project-related tables FK to `projects.id` with `onDelete: cascade`
- `architecture_nodes` has unique index on `(projectId, nodeId)` — `nodeId` is the React Flow UUID
- `architecture_edges` has unique index on `(projectId, edgeId)`
- `bom_items.totalPrice` is computed server-side: `quantity * unitPrice`
- `component_parts` uses JSONB columns for `meta`, `connectors`, `buses`, `views`, `constraints`

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
| ~~PATCH~~ | ~~`/api/bom/:id?projectId=N`~~ | — | **DEPRECATED** — use project-scoped version |
| ~~DELETE~~ | ~~`/api/bom/:id?projectId=N`~~ | — | **DEPRECATED** — use project-scoped version |

### Validation Issues (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:id/validation` | query: pagination | `ValidationIssue[]` |
| POST | `/api/projects/:id/validation` | issue data | `ValidationIssue` (201) |
| DELETE | `/api/projects/:id/validation/:issueId` | — | 204 (hard delete) |
| PUT | `/api/projects/:id/validation` | `ValidationIssue[]` | `ValidationIssue[]` (replace all) |
| ~~DELETE~~ | ~~`/api/validation/:id?projectId=N`~~ | — | **DEPRECATED** |

### Chat Messages (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/projects/:id/chat` | query: pagination | `ChatMessage[]` |
| POST | `/api/projects/:id/chat` | `{ role, content, mode? }` | `ChatMessage` (201) |
| DELETE | `/api/projects/:id/chat` | — | 204 (delete all for project) |
| DELETE | `/api/projects/:id/chat/:msgId` | — | 204 |

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

### AI Chat (Protected)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/chat/ai` | AI request schema | `{ message, actions }` |
| POST | `/api/chat/ai/stream` | AI request schema | SSE stream |

### Utility (Public)

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/health` | `{ status: "ok" }` |
| GET | `/api/docs` | API documentation JSON |
| GET | `/api/metrics` | Route metrics |
| POST | `/api/seed` | Seeds default project if none exists |

### Pagination

All list endpoints support these query parameters:
- `limit` (1–100, default 50)
- `offset` (0+, default 0)
- `sort` ("asc" | "desc", default "desc")

---

## 9. Current Technical Debt / Audit Status

Full details: `docs/frontend-audit-checklist.md`

### Summary

| Priority | Total | Fixed | Open | Partial |
|----------|-------|-------|------|---------|
| P0 Critical | 16 | 10 | 4 | 2 |
| P1 High | 31 | 11 | 20 | 0 |
| P2 Medium | 56 | 10 | 46 | 0 |
| P3 Low | 10 | 0 | 10 | 0 |
| **Total** | **113** | **31** | **80** | **2** |

### P0 Critical Open Items (Fix These First)

| # | Issue | File/Area |
|---|-------|-----------|
| 11 | Monolithic `ProjectProvider` causes cascade re-renders on any state change | `project-context.tsx` |
| 15 | localStorage used as primary persistence (5MB limit, silent failure) | `project-context.tsx` |
| 19 | `PROJECT_ID = 1` hardcoded — blocks multi-project support | `project-context.tsx` |
| 49 | No undo/redo anywhere (destructive edits can't be reversed) | Cross-cutting |

### P1 High Open Items (20 total, key ones)

| # | Issue | File/Area |
|---|-------|-----------|
| 5 | ChatPanel.tsx is 2,363 lines — needs decomposition into ~6-8 components | `ChatPanel.tsx` |
| 6 | project-context.tsx is 614 lines, 40+ state values — split into domain contexts | `project-context.tsx` |
| 7 | Sidebar.tsx is 832 lines — split into sub-components | `Sidebar.tsx` |
| 8 | AssetManager.tsx is 678 lines — split into modules | `AssetManager.tsx` |
| 10 | No tests anywhere — zero unit/integration/e2e coverage | Cross-cutting |
| 33 | No virtualization for long lists (BOM, chat, validation) | Multiple |
| 66 | Per-query staleTime: Infinity overrides in project-context.tsx — those queries never auto-refetch | `project-context.tsx` |
| 100 | BOM items not editable in-place (add/delete only) | `ProcurementView.tsx` |

### Known Partially Addressed

| # | Issue | Status |
|---|-------|--------|
| 50 | No confirmation dialogs for destructive actions | Partial: BOM delete, output clear, validation dismiss have it; AI chat destructive actions don't |
| 61 | API keys in localStorage | Partial: NOT in localStorage (React state only), but frontend not wired to backend encrypted storage |

---

## 10. Phase Roadmap

### Phase 0 — Current: Audit Remediation

- Fix P0/P1 audit findings from `docs/frontend-audit-checklist.md`
- Code quality improvements
- Must be substantially complete before Phase 1

### Phase 1 — Multi-Project & Core Infrastructure

- Remove `PROJECT_ID = 1` hardcoding
- Split monolithic `ProjectProvider` into domain contexts
- Implement proper undo/redo system
- Add basic test coverage
- Route-based project selection

### Phase 2 — Component Editor ✅ COMPLETE

- Interactive SVG canvas for part design
- Connectors (pins) with terminal positions and pad specs
- Buses (groups of connectors)
- Multi-view support: breadboard, schematic, PCB, metadata, pin-table
- Design Rule Check (DRC) validation
- Persistence via `component_parts` table (JSONB)

### Phase 3 — Circuit Schematic Capture

- Reuse @xyflow/react for schematic canvas
- Schematic symbol library
- Net list generation
- Multi-sheet support (already stubbed)
- Replace SchematicView stub with real implementation

### Phase 4 — Breadboard/PCB Layout

- Breadboard placement view
- PCB layout editor
- Manufacturing output: Gerber files, KiCad export
- Design for Manufacturing (DFM) validation

### Phase 5 — Circuit Simulation

- SPICE netlist generation
- Integration with simulation engine
- Waveform viewer
- Parameter sweep

---

## 11. AI Action System Reference

The AI chat system (`server/ai.ts`) supports 53 action types. Actions are returned as a JSON array at the end of the AI's text response, parsed by `parseActionsFromResponse()`.

### Action Type Union

The `AIAction` type is a discriminated union defined in `server/ai.ts`. Each action has a `type` field.

### Categories

#### View Navigation (2 actions)
| Action | Key Fields | Notes |
|--------|-----------|-------|
| `switch_view` | `view: "architecture" \| "schematic" \| "procurement" \| "validation" \| "output" \| "project_explorer"` | Changes active tab |
| `switch_schematic_sheet` | `sheetId: string` | Switches schematic sheet |

#### Architecture Nodes (4 actions)
| Action | Key Fields | Notes |
|--------|-----------|-------|
| `add_node` | `nodeType, label, description?, positionX?, positionY?` | nodeType: "mcu", "sensor", "power", "comm", "connector", etc. |
| `remove_node` | `nodeLabel: string` | Removes by label, not ID |
| `update_node` | `nodeLabel, newLabel?, newType?, newDescription?` | Partial update by label |
| `clear_canvas` | — | Removes ALL nodes and edges |

#### Architecture Edges (2 actions)
| Action | Key Fields | Notes |
|--------|-----------|-------|
| `connect_nodes` | `sourceLabel, targetLabel, edgeLabel?, busType?, signalType?, voltage?, busWidth?, netName?` | Creates connection between nodes |
| `remove_edge` | `sourceLabel, targetLabel` | Removes connection by node labels |

#### Full Generation (1 action)
| Action | Key Fields | Notes |
|--------|-----------|-------|
| `generate_architecture` | `components: [{label, nodeType, description, positionX, positionY}], connections: [{sourceLabel, targetLabel, label, busType?}]` | Replaces entire diagram |

#### BOM Management (3 actions)
| Action | Key Fields | Notes |
|--------|-----------|-------|
| `add_bom_item` | `partNumber, manufacturer, description, quantity?, unitPrice?, supplier?, status?` | Adds to BOM |
| `remove_bom_item` | `partNumber: string` | Removes by part number |
| `update_bom_item` | `partNumber, updates: Record<string, any>` | Partial update |

#### Validation (3 actions)
| Action | Key Fields | Notes |
|--------|-----------|-------|
| `run_validation` | — | Triggers DRC |
| `clear_validation` | — | Clears all issues |
| `add_validation_issue` | `severity, message, componentId?, suggestion?` | Adds finding |

#### Project Settings (3 actions)
| Action | Key Fields | Notes |
|--------|-----------|-------|
| `rename_project` | `name: string` | |
| `update_description` | `description: string` | |
| `set_project_type` | `projectType: string` | "iot", "wearable", "industrial", etc. |

#### Export & Output (5 actions)
| Action | Notes |
|--------|-------|
| `export_bom_csv` | Triggers CSV download |
| `export_kicad` | Generate KiCad schematic |
| `export_spice` | Generate SPICE netlist |
| `preview_gerber` | PCB layout preview |
| `export_design_report` | Comprehensive report |

#### Layout & Organization (7 actions)
| Action | Key Fields |
|--------|-----------|
| `auto_layout` | `layout: "hierarchical" \| "grid" \| "circular" \| "force"` |
| `add_subcircuit` | `template: string, positionX?, positionY?` |
| `assign_net_name` | `sourceLabel, targetLabel, netName` |
| `create_sheet` | `name: string` |
| `rename_sheet` | `sheetId, newName` |
| `move_to_sheet` | `nodeLabel, sheetId` |
| `undo` / `redo` | — |

#### Pin Management (2 actions)
| Action | Key Fields |
|--------|-----------|
| `set_pin_map` | `nodeLabel, pins: Record<string, string>` |
| `auto_assign_pins` | `nodeLabel` |

#### Analysis (5 actions)
| Action | Notes |
|--------|-------|
| `power_budget_analysis` | Tallies current draw |
| `voltage_domain_check` | Flags voltage mismatches |
| `thermal_analysis` | Estimates dissipation |
| `dfm_check` | Manufacturing checks |
| `auto_fix_validation` | Auto-resolve issues |

#### BOM Intelligence (5 actions)
| Action | Key Fields |
|--------|-----------|
| `pricing_lookup` | `partNumber` |
| `suggest_alternatives` | `partNumber, reason?` |
| `optimize_bom` | — |
| `check_lead_times` | — |
| `parametric_search` | `category, specs: Record<string, string>` |

#### Documentation (4 actions)
| Action | Key Fields |
|--------|-----------|
| `analyze_image` | `description` |
| `save_design_decision` | `decision, rationale` |
| `add_annotation` | `nodeLabel, note, color?` |
| `start_tutorial` | `topic` |
| `add_datasheet_link` | `partNumber, url` |

### How Actions Flow

1. User sends message via ChatPanel
2. ChatPanel calls `POST /api/chat/ai/stream` with message + project state
3. Server builds system prompt with full project state (nodes, edges, BOM, validation, chat history)
4. AI provider (Anthropic/Gemini) streams response via SSE
5. ChatPanel receives SSE chunks, accumulates response text
6. On stream end, `parseActionsFromResponse()` extracts JSON action array from response
7. ChatPanel executes each action by calling the appropriate context method or API

---

## 12. Testing Expectations

### Current State

**No test suite exists** (audit item #10). This is a known gap.

### When Adding Features

1. **Add `data-testid` attributes** to all interactive and display elements (see convention in Section 3)
2. **Smoke test** by switching through all tabs after changes
3. **API endpoints** can be manually tested with curl:
   ```bash
   # Register
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test123"}'

   # Use returned sessionId for protected endpoints
   curl http://localhost:5000/api/projects/1/nodes \
     -H "X-Session-Id: <sessionId>"
   ```
4. **TypeScript check:** `npm run check` (or `tsc`)
5. **E2E tests** can use Playwright for UI verification
6. **All views must remain functional** after changes — switch through every tab

### Test File Location

When tests are added, they should go in:
- Backend: `server/__tests__/` (one test file exists: `api.test.ts`)
- Frontend: `client/src/__tests__/` (to be created)

---

## 13. Common Gotchas

### Database

| Gotcha | Details |
|--------|---------|
| **Soft deletes** | Projects, nodes, edges, BOM items use `deletedAt`. Always filter with `isNull(table.deletedAt)` in queries. `DatabaseStorage` handles this, but raw queries must include it. |
| **BOM totalPrice** | Computed server-side in `DatabaseStorage.createBomItem()` and `updateBomItem()` as `quantity * unitPrice`. Never set it from the client. |
| **Cache invalidation** | Uses prefix matching. Invalidating `"nodes:1"` clears `"nodes:1:50:0:desc"`, `"nodes:1:100:0:asc"`, etc. Be careful with cache key naming. |
| **PROJECT_ID = 1** | Hardcoded in `project-context.tsx`. The seed endpoint creates project ID 1 on first run. Multi-project support is blocked by this (audit #19). |
| **replace* methods** | `replaceNodes`, `replaceEdges`, `replaceValidationIssues` do a hard DELETE + INSERT inside a transaction. They don't use soft deletes. |

### Authentication

| Gotcha | Details |
|--------|---------|
| **Session header** | Uses `X-Session-Id` header, NOT cookies. Frontend must include this on every protected request. |
| **API key encryption** | AES-256-GCM. Uses `API_KEY_ENCRYPTION_KEY` env var. In dev, falls back to random key (keys don't survive restart). |
| **Session expiry** | 7 days (`SESSION_DURATION_MS`). Expired sessions are cleaned up on next validation attempt. |

### Frontend

| Gotcha | Details |
|--------|---------|
| **Component editor context** | Uses a separate `ComponentEditorProvider` (`client/src/lib/component-editor/`), not the main `ProjectProvider`. |
| **React Flow node IDs** | Use `crypto.randomUUID()`, NOT `Date.now()`. This is a fixed audit item (#24). |
| **Deprecated BOM/validation endpoints** | `PATCH /api/bom/:id` and `DELETE /api/bom/:id` still exist but are deprecated. The frontend currently uses them (via `project-context.tsx`). Prefer `/api/projects/:id/bom/:bomId`. |
| **schematicSheets** | Currently hardcoded in `ProjectProvider` state, not editable by users. Static data only (audit #97). |
| **AI system prompt** | Rebuilds full project state (all nodes, edges, BOM, validation, chat history) on EVERY request. Can be expensive for large projects. |
| **staleTime overrides** | Global staleTime is 5 min (`queryClient.ts`), but per-query overrides in `project-context.tsx` set `staleTime: Infinity`. Those queries never auto-refetch — only manual invalidation triggers refetch. Known issue #66. |
| **OutputView** | Uses local React state (`outputLog`), not persisted to database. Lost on page refresh. |
| **Node dirty tracking** | `project-context.tsx` uses `nodesDirtyRef`/`edgesDirtyRef` to skip saving on initial hydration. First `setNodes`/`setEdges` call marks dirty; second call actually saves. |

### AI System

| Gotcha | Details |
|--------|---------|
| **Action parsing** | `parseActionsFromResponse()` looks for the LAST ` ```json ``` ` block in the response. Falls back to bare JSON array at end of text. |
| **Node references** | AI actions reference nodes by LABEL, not by internal ID. Resolution happens in the frontend. |
| **Deduplication** | `activeRequests` map prevents duplicate in-flight requests to the same provider+project+message prefix. |
| **Client caching** | LRU cache (size 10) for Anthropic/Gemini client instances, keyed by API key. |
| **System prompt caching** | Prompt is cached and only rebuilt when project state hash changes. |

---

## 14. Working With This Codebase Checklist

### Before Making Changes

- [ ] Read `replit.md` for current project state and user preferences
- [ ] Check `docs/frontend-audit-checklist.md` for related open audit items
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

### After Making Changes

- [ ] Verify the app still runs (restart the "Start application" workflow)
- [ ] Switch through ALL tabs to smoke test (Output, Architecture, Component Editor, Procurement, Validation)
- [ ] Check for TypeScript errors (`npm run check`)
- [ ] Update `docs/frontend-audit-checklist.md` if fixing an audit item (change ⬜ to ✅, add note)
- [ ] Update `replit.md` if making a significant architectural change (only when explicitly asked)
- [ ] Test API changes with curl
- [ ] Check the browser console for runtime errors
- [ ] Verify no secrets or API keys are logged or exposed

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
   └─ Add cache invalidation on writes
   └─ Filter by isNull(deletedAt) if soft-delete table

4. server/routes.ts
   └─ Add endpoints with asyncHandler
   └─ Add Zod validation for request bodies
   └─ Add payloadLimit middleware
   └─ Use parseIdParam for URL params

5. client/src/lib/project-context.tsx (or new context)
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

8. Smoke test
   └─ Switch through all tabs
   └─ Verify no console errors
   └─ Check TypeScript compiles
```

---

## Appendix: Environment & Tooling

### NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `NODE_ENV=development tsx server/index.ts` | Start dev server with HMR |
| `npm run build` | `tsx script/build.ts` | Production build |
| `npm start` | `NODE_ENV=production node dist/index.cjs` | Start production server |
| `npm run check` | `tsc` | TypeScript type checking |
| `npm run db:push` | `drizzle-kit push` | Sync Drizzle schema to database |

### Key Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-provided by Replit) |
| `API_KEY_ENCRYPTION_KEY` | Production only | 32-byte hex key for AES-256-GCM API key encryption |
| `NODE_ENV` | No | "development" or "production" |

### Port Binding

- The application binds to **port 5000** on `0.0.0.0`
- In development, Vite dev server runs as middleware inside Express
- In production, Express serves static files from `dist/`

### Replit Workflow

The application runs via a single workflow:
- **Name:** "Start application"
- **Command:** `npm run dev`
- Restart this workflow after server-side changes to verify they work
