# ProtoPulse — Developer Documentation

> **Last updated:** 2026-03-03
> **Codebase:** ~30,000+ lines of TypeScript
> **Stack:** React 19 · TypeScript 5.6 · Vite 7 · Express 5 · PostgreSQL · Drizzle ORM · TanStack React Query · shadcn/ui · @xyflow/react · Tailwind CSS v4

**ProtoPulse** is an all-in-one browser-based EDA platform built for makers and learners who want a single tool from "I don't know electronics" to "here are my Gerbers." Think TinkerCad + Fritzing + KiCad unified with AI. See `docs/future-features-and-ideas-list.md` for the full feature vision.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Architecture Overview](#2-architecture-overview)
3. [Directory Structure](#3-directory-structure)
4. [Database Schema](#4-database-schema)
5. [Complete API Reference](#5-complete-api-reference)
6. [AI System Deep Dive](#6-ai-system-deep-dive)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Backend Architecture](#8-backend-architecture)
9. [Component Editor System](#9-component-editor-system)
10. [Security Model](#10-security-model)
11. [Development Workflow](#11-development-workflow)
12. [Code Conventions & Patterns](#12-code-conventions--patterns)
13. [Known Issues & Technical Debt](#13-known-issues--technical-debt)
14. [Roadmap / Phase Plan](#14-roadmap--phase-plan)

---

## 1. Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+

### Setup

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`.

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `API_KEY_ENCRYPTION_KEY` | Prod only | Random per-boot | 32-byte hex string for AES-256-GCM encryption of stored API keys |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |
| `NODE_ENV` | No | `development` | `development` \| `production` |
| `PORT` | No | `5000` | Server listen port |
| `ADMIN_API_KEY` | No | — | Required to access `/api/admin/*` endpoints |
| `STREAM_TIMEOUT_MS` | No | `120000` | Activity-based SSE stream timeout in ms |

### NPM Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `NODE_ENV=development tsx server/index.ts` | Start dev server with Vite HMR |
| `npm run dev:client` | Vite only | Vite dev server on port 5000 |
| `npm run build` | `tsx scripts/build.ts` | Production build (esbuild backend + Vite frontend) |
| `npm run start` | `NODE_ENV=production node dist/index.cjs` | Run production server |
| `npm run check` | `tsc` | TypeScript type checking — must pass with zero errors |
| `npm run db:push` | `drizzle-kit push` | Sync Drizzle schema to PostgreSQL |
| `npm test` | `vitest run` | Run all tests (server + client projects) |
| `npm run test:watch` | `vitest` | Interactive watch mode |
| `npm run test:coverage` | `vitest run --coverage` | Coverage report (v8 provider) |

---

## 2. Architecture Overview

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                   │
│                                                                     │
│  ┌──────────┐  ┌────────────────────────────────────┐  ┌─────────┐ │
│  │ Sidebar  │  │       Main Views (tabbed)           │  │ Chat    │ │
│  │          │  │                                    │  │ Panel   │ │
│  │ • Nav    │  │  Architecture (React Flow)         │  │         │ │
│  │ • Tree   │  │  Component Editor (SVG canvas)     │  │ • AI    │ │
│  │ • History│  │  Procurement (BOM + BomDiff)       │  │ • SSE   │ │
│  │          │  │  Validation (DRC/ERC results)      │  │ • Tools │ │
│  │          │  │  Output (Logs)                     │  │         │ │
│  │          │  │  Schematic (circuit editor)        │  │         │ │
│  │          │  │  Dashboard                         │  │         │ │
│  └──────────┘  └────────────────────────────────────┘  └─────────┘ │
│       │                    │                               │        │
│       └────────────────────┼───────────────────────────────┘        │
│                            │                                        │
│                    ProjectProvider Context                          │
│                    (React Query + 40+ state values)                 │
└────────────────────────────┼────────────────────────────────────────┘
                             │ HTTP / SSE
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Express 5 Server (:5000)                       │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────────┐ │
│  │ Helmet   │ │Compress  │ │Rate Limit│ │  Session Auth          │ │
│  │ (CSP)    │ │(gzip)    │ │(300/15m) │ │  (X-Session-Id header) │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────┬─────────────┘ │
│       └────────────┴────────────┴──────────────────┘               │
│                             │                                       │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │  routes.ts (barrel — 21 domain routers)                      │  │
│   │  circuit-routes.ts (barrel — 13 circuit routers)             │  │
│   │  circuit-ai.ts                                               │  │
│   └──────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│   ┌──────────────────────────┼───────────────────────────────────┐  │
│   │          AI Engine        │    Storage Layer                  │  │
│   │  ┌────────────────────┐  │  ┌──────────────────────────────┐ │  │
│   │  │ Google Genkit    │  │  │  IStorage / DatabaseStorage  │ │  │
│   │  │ SSE streaming      │  │  │  LRU cache (evicts least     │ │  │
│   │  │ 80+ AI tools       │  │  │  recently used, prefix-based │ │  │
│   │  │ multi-model routing│  │  │  invalidation)               │ │  │
│   │  └────────────────────┘  │  └──────────────┬───────────────┘ │  │
│   └──────────────────────────┼──────────────────┼────────────────┘  │
│                              │                  │                   │
└──────────────────────────────┼──────────────────┼───────────────────┘
                               │                  ▼
                               │       ┌──────────────────┐
                               │       │   PostgreSQL      │
                               │       │   27 tables       │
                               │       └──────────────────┘
                               │
                          Auth (scrypt / AES-256-GCM)
```

### Request Lifecycle

```
Client Request
  │
  ├─ Helmet (security headers: CSP, HSTS, etc.)
  ├─ Compression (gzip)
  ├─ Request ID (UUID → X-Request-Id header)
  ├─ API Version Header (X-API-Version: 1)
  ├─ Rate Limiter (300 req / 15 min window)
  ├─ JSON Body Parser (1MB default limit, per-route overrides)
  ├─ CSRF Check (Origin vs Host validation)
  ├─ Request Timeout (30s)
  ├─ Session Auth Middleware (validates X-Session-Id, populates req.userId)
  ├─ Request Logger + Metrics (Winston + in-memory metrics)
  ├─ Route Handler (Zod validation → IStorage → Response)
  └─ Error Handler (HttpError status-aware, sanitized messages in prod)
```

---

## 3. Directory Structure

```
ProtoPulse/
├── client/                              # Frontend (React + Vite)
│   ├── index.html                       # SPA entry, OG meta tags
│   ├── public/assets/                   # Static assets
│   └── src/
│       ├── main.tsx                     # ReactDOM.createRoot entry
│       ├── App.tsx                      # Root: ThemeProvider > QueryClientProvider > Router
│       ├── index.css                    # Tailwind v4 imports, CSS variables, theme tokens
│       ├── pages/
│       │   ├── ProjectWorkspace.tsx     # Main 3-panel layout, lazy views, ErrorBoundary per view
│       │   ├── AuthPage.tsx             # Login/register page
│       │   └── not-found.tsx            # 404 page
│       ├── components/
│       │   ├── ErrorBoundary.tsx        # React error boundary with fallback UI
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx          # Project nav, component library tree, history panel
│       │   │   ├── WorkflowBreadcrumb.tsx # Phase/workflow progress breadcrumb
│       │   │   └── sidebar/             # ComponentTree, HistoryList, ProjectExplorer,
│       │   │                            # ProjectSettingsPanel, SidebarHeader, sidebar-constants
│       │   ├── panels/
│       │   │   ├── ChatPanel.tsx        # AI chat, settings, streaming, action parsing/execution
│       │   │   ├── ExportPanel.tsx      # Multi-format export UI (KiCad, Eagle, Gerber, etc.)
│       │   │   ├── AssetManager.tsx     # Asset management panel
│       │   │   ├── chat/                # ChatHeader, MessageBubble, MessageInput,
│       │   │   │                        # QuickActionsBar, SettingsPanel,
│       │   │   │                        # hooks/useActionExecutor, parseLocalIntent,
│       │   │   │                        # intent-handlers/, action-handlers/
│       │   │   └── asset-manager/       # AssetGrid, AssetSearch, hooks/useDragGhost
│       │   ├── views/
│       │   │   ├── ArchitectureView.tsx # React Flow canvas for block diagrams
│       │   │   ├── CustomNode.tsx       # Custom React Flow node renderer
│       │   │   ├── ProcurementView.tsx  # BOM management tabs + BomDiffPanel
│       │   │   ├── BomDiffPanel.tsx     # BOM snapshot comparison view
│       │   │   ├── ValidationView.tsx   # DRC/ERC results with "Mark Resolved" actions
│       │   │   ├── OutputView.tsx       # System log viewer with filters (memoized)
│       │   │   ├── DashboardView.tsx    # Project overview dashboard
│       │   │   ├── WelcomeOverlay.tsx   # First-run welcome overlay
│       │   │   └── component-editor/   # GeneratorModal, ShapeCanvas, PinTable
│       │   ├── circuit-editor/
│       │   │   ├── SchematicCanvas.tsx  # Main circuit schematic canvas (@xyflow/react)
│       │   │   ├── BreadboardView.tsx   # Breadboard layout view
│       │   │   ├── PCBLayoutView.tsx    # PCB layout view
│       │   │   ├── ERCPanel.tsx         # Electrical Rules Check panel
│       │   │   ├── NetClassPanel.tsx    # Net class configuration panel
│       │   │   ├── HierarchicalSheetPanel.tsx # Hierarchical sheet navigation
│       │   │   ├── SchematicToolbar.tsx # Circuit editor toolbar
│       │   │   ├── NetDrawingTool.tsx   # Interactive net/wire drawing tool
│       │   │   ├── SchematicInstanceNode.tsx # Component instance node renderer
│       │   │   ├── SchematicNetEdge.tsx # Net edge renderer
│       │   │   ├── PartSymbolRenderer.tsx # Part symbol SVG renderer
│       │   │   └── ToolButton.tsx       # Toolbar button component
│       │   ├── simulation/
│       │   │   ├── BodePlot.tsx         # Bode plot visualization (AC analysis)
│       │   │   └── FrequencyAnalysisPanel.tsx # Frequency analysis UI
│       │   └── ui/                      # 40+ shadcn/ui primitives (button, dialog, table, etc.)
│       │       └── command-palette.tsx  # Command palette (Cmd+K)
│       ├── hooks/
│       │   ├── use-toast.ts             # Toast notification hook (sonner)
│       │   ├── use-mobile.tsx           # Mobile breakpoint detection
│       │   └── useHighContrast.ts       # High-contrast accessibility mode
│       └── lib/
│           ├── project-context.tsx      # ProjectProvider: 40+ state values, React Query mutations
│           ├── queryClient.ts           # TanStack Query config, apiRequest() helper
│           ├── auth-context.tsx         # Auth state context (session, user)
│           ├── dnd-context.tsx          # Drag-and-drop context
│           ├── error-messages.ts        # User-facing error message mapping
│           ├── circuit-editor/          # Wire router, ERC engine, view-sync, hooks
│           │   └── __tests__/           # wire-router.test.ts
│           ├── simulation/              # SPICE generator, circuit solver, frequency analysis,
│           │   └── useSpiceModels.ts    # SPICE model hook
│           ├── component-editor/        # ComponentEditorProvider, constraint solver,
│           │   │                        # diff engine, snap engine
│           │   └── __tests__/           # constraint solver, diff engine, snap engine tests
│           └── contexts/
│               ├── architecture-context.tsx
│               ├── bom-context.tsx
│               ├── chat-context.tsx
│               ├── history-context.tsx
│               ├── output-context.tsx
│               ├── validation-context.tsx
│               └── __tests__/           # Context unit tests
│
├── server/                              # Backend (Express 5)
│   ├── index.ts                         # App bootstrap, middleware stack, graceful shutdown
│   ├── routes.ts                        # Barrel (57 lines) — registers 21 domain routers
│   ├── circuit-routes.ts                # Barrel — re-exports registerCircuitRoutes
│   ├── ai.ts                            # AI engine: Genkit + Google AI,
│   │                                    # streaming SSE, action parser, multi-model routing
│   ├── ai-tools.ts                      # Barrel — 11 AI tool modules
│   ├── circuit-ai.ts                    # Circuit-specific AI endpoints
│   ├── auth.ts                          # Session auth: scrypt hashing, AES-256-GCM key encryption
│   ├── storage.ts                       # 1,598 lines — IStorage interface + DatabaseStorage,
│   │                                    # LRU cache with prefix-based invalidation
│   ├── cache.ts                         # LRU cache implementation
│   ├── logger.ts                        # Structured JSON logger (Winston, 4 levels)
│   ├── metrics.ts                       # Route-level request metrics
│   ├── db.ts                            # PostgreSQL connection pool (Drizzle + pg)
│   ├── env.ts                           # Environment variable validation
│   ├── component-export.ts              # FZPZ import/export
│   ├── component-ai.ts                  # Gemini AI for component generation/modification
│   ├── batch-analysis.ts                # Genkit Queue mocking for async analysis
│   ├── audit-log.ts                     # Audit event logging
│   ├── circuit-breaker.ts               # Circuit breaker pattern for external calls
│   ├── simulation.ts                    # SPICE simulation runner
│   ├── svg-parser.ts                    # SVG to shape primitives parser
│   ├── routes/                          # 21 domain routers + utils.ts
│   │   ├── utils.ts                     # HttpError, asyncHandler, parseIdParam,
│   │   │                                # payloadLimit, paginationSchema
│   │   ├── auth.ts                      # POST /api/auth/register, login, logout, GET me
│   │   ├── settings.ts                  # GET/POST /api/settings/api-keys, GET/PATCH chat
│   │   ├── projects.ts                  # CRUD /api/projects
│   │   ├── architecture.ts              # CRUD /api/projects/:id/nodes|edges
│   │   ├── bom.ts                       # CRUD /api/projects/:id/bom
│   │   ├── validation.ts                # CRUD /api/projects/:id/validation
│   │   ├── chat.ts                      # CRUD /api/projects/:id/chat, AI endpoints
│   │   ├── history.ts                   # CRUD /api/projects/:id/history
│   │   ├── components.ts                # CRUD component-parts, library, DRC, AI ops
│   │   ├── seed.ts                      # POST /api/seed (dev only)
│   │   ├── admin.ts                     # GET /api/admin/metrics, DELETE /api/admin/purge
│   │   ├── batch.ts                     # POST/GET /api/batch/* (Async batch analysis)
│   │   ├── project-io.ts                # GET /api/projects/:id/export, POST /api/projects/import
│   │   ├── chat-branches.ts             # POST/GET /api/projects/:id/chat/branches
│   │   ├── spice-models.ts              # CRUD /api/spice-models + seed endpoint
│   │   ├── bom-snapshots.ts             # POST/GET/DELETE /api/projects/:id/bom-snapshots,
│   │   │                                # POST /api/projects/:id/bom-diff
│   │   ├── design-preferences.ts        # CRUD /api/projects/:id/preferences
│   │   └── component-lifecycle.ts       # CRUD /api/projects/:id/lifecycle
│   ├── circuit-routes/                  # 13 circuit routers + utils.ts
│   │   ├── utils.ts                     # Circuit route helpers, gatherCircuitData
│   │   ├── index.ts                     # Barrel — registers all circuit routers
│   │   ├── designs.ts                   # CRUD /api/projects/:projectId/circuits
│   │   ├── instances.ts                 # CRUD /api/circuits/:circuitId/instances
│   │   ├── nets.ts                      # CRUD /api/circuits/:circuitId/nets
│   │   ├── wires.ts                     # CRUD /api/circuits/:circuitId/wires
│   │   ├── netlist.ts                   # GET /api/circuits/:circuitId/netlist
│   │   ├── hierarchy.ts                 # Hierarchical ports endpoints
│   │   ├── autoroute.ts                 # POST autoroute
│   │   ├── expansion.ts                 # Circuit expansion endpoints
│   │   ├── exports.ts                   # Export endpoints (BOM, netlist, Gerber, KiCad, Eagle,
│   │   │                                # SPICE, pick-place, PDF, FMEA, FZZ, firmware)
│   │   ├── imports.ts                   # Circuit import endpoints
│   │   └── simulations.ts               # Simulation run/list/get + power/signal analysis
│   ├── ai-tools/                        # 11 AI tool modules
│   │   ├── types.ts                     # Shared tool types
│   │   ├── registry.ts                  # Tool registration and lookup
│   │   ├── navigation.ts                # View navigation tools
│   │   ├── architecture.ts              # Architecture node/edge tools
│   │   ├── circuit.ts                   # Circuit design tools
│   │   ├── component.ts                 # Component part tools
│   │   ├── bom.ts                       # BOM management tools
│   │   ├── validation.ts                # Validation issue tools
│   │   ├── export.ts                    # Export trigger tools
│   │   ├── project.ts                   # Project management tools
│   │   └── index.ts                     # Barrel
│   └── export/                          # 16 export modules
│       ├── types.ts                     # Shared export types
│       ├── bom-exporter.ts              # BOM CSV (generic, JLCPCB, Mouser, DigiKey)
│       ├── kicad-exporter.ts            # KiCad .kicad_sch / .kicad_pcb / .kicad_pro
│       ├── eagle-exporter.ts            # Eagle .sch / .brd XML
│       ├── spice-exporter.ts            # SPICE netlist (.cir)
│       ├── netlist-generator.ts         # Netlist (SPICE, KiCad, CSV formats)
│       ├── gerber-generator.ts          # Gerber RS-274X layers
│       ├── drill-generator.ts           # Excellon drill file
│       ├── pick-place-generator.ts      # Pick-and-place CSV
│       ├── drc-gate.ts                  # Pre-export DRC validation gate
│       ├── fzz-handler.ts               # Fritzing .fzz project export
│       ├── pdf-generator.ts             # SVG/PDF view export
│       ├── pdf-report-generator.ts      # Full PDF design report
│       ├── design-report.ts             # Design report data aggregation
│       ├── fmea-generator.ts            # FMEA analysis CSV
│       └── firmware-scaffold-generator.ts # Arduino/PlatformIO scaffold code
│
├── shared/                              # Shared between client and server
│   ├── schema.ts                        # 504 lines — Drizzle ORM schema (27 tables),
│   │                                    # Zod insert schemas, TypeScript types
│   ├── component-types.ts               # Component editor type system
│   │                                    # (shapes, connectors, buses, DRC rules)
│   ├── drc-engine.ts                    # Design Rule Check engine
│   ├── drc-templates.ts                 # Standard DRC rule templates
│   ├── bom-diff.ts                      # BOM snapshot comparison engine
│   ├── netlist-diff.ts                  # Netlist comparison / ECO engine
│   └── api-types.generated.ts           # Generated API type definitions
│
├── docs/                                # Project documentation
├── migrations/                          # Database migration files
├── script/
│   ├── build.ts                         # Production build script (esbuild + Vite)
│   ├── generate-api-types.ts            # API type generation script
│   └── generate_assets.py               # Asset generation script
├── drizzle.config.ts                    # Drizzle Kit configuration
├── vite.config.ts                       # Vite configuration
├── vitest.config.ts                     # Vitest workspace config (server + client projects)
├── tsconfig.json                        # TypeScript configuration
├── eslint.config.js                     # ESLint flat config (strictTypeChecked)
├── components.json                      # shadcn/ui configuration
└── package.json                         # Dependencies and scripts
```

---

## 4. Database Schema

### Overview

`shared/schema.ts` (504 lines) defines all 24 Drizzle ORM tables with Zod insert schemas and TypeScript types inferred from the schema.

### Entity Relationship Diagram

```
┌──────────────┐
│    users     │
│──────────────│
│ id (PK)      │──┬──────────────────┐
│ username (UQ)│  │                  │
│ passwordHash │  │ 1:N              │ 1:1
│ createdAt    │  │                  │
└──────────────┘  │                  │
                  ▼                  ▼
         ┌─────────────┐  ┌──────────────────┐  ┌───────────┐
         │  sessions   │  │    api_keys      │  │user_chat_ │
         │─────────────│  │──────────────────│  │_settings  │
         │ id (PK,UUID)│  │ id (PK)          │  │───────────│
         │ userId (FK) │  │ userId (FK)      │  │ id (PK)   │
         │ expiresAt   │  │ provider         │  │ userId(FK)│
         │ createdAt   │  │ encryptedKey     │  │ aiProvider│
         └─────────────┘  │ iv               │  │ aiModel   │
                          │ createdAt        │  │ ...       │
                          └──────────────────┘  └───────────┘

┌─────────────────┐
│    projects     │
│─────────────────│
│ id (PK)         │──────────────────────────────────────────────────────┐
│ name            │                                                      │
│ description     │  1:N (all cascade)                                  │
│ createdAt       │                                                      │
│ updatedAt       │  ┌────────┬──────────┬──────────┬──────────┬────────┤
│ deletedAt(soft) │  │        │          │          │          │        │
└─────────────────┘  │        │          │          │          │        │
                     ▼        ▼          ▼          ▼          ▼        │
             ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐   │
             │arch_nodes│ │arch_   │ │bom_    │ │valid_  │ │comp_  │   │
             │          │ │edges   │ │items   │ │issues  │ │parts  │   │
             │(soft del)│ │(s.del) │ │(s.del) │ │        │ │       │   │
             └──────────┘ └────────┘ └────────┘ └────────┘ └───────┘   │
                                                                        │
             ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
             │chat_     │ │history │ │circuit │ │design_ │◄────────────┘
             │messages  │ │_items  │ │_designs│ │prefs   │
             │          │ │        │ │        │ │        │
             └──────────┘ └────────┘ └──┬─────┘ └────────┘
                                        │
                   ┌────────────────────┼───────────────────────┐
                   │                    │                       │
                   ▼                    ▼                       ▼
           ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
           │circuit_      │  │ circuit_nets     │  │ hierarchical_    │
           │instances     │  │──────────────────│  │ ports            │
           │──────────────│  │ id (PK)          │  │──────────────────│
           │ id (PK)      │  │ circuitId (FK)   │  │ id (PK)          │
           │ circuitId(FK)│  │ name             │  │ designId (FK)    │
           │ partId (FK)  │  │ netType          │  │ portName         │
           │ refDesig...  │  │ voltage          │  │ direction        │
           │ schematicX/Y │  │ busWidth         │  │ netName          │
           │ breadboardX/Y│  │ segments (jsonb) │  │ positionX/Y      │
           │ pcbX/Y/Side  │  │ labels (jsonb)   │  └──────────────────┘
           └──────────────┘  │ style (jsonb)    │
                             └──────┬───────────┘
                                    │ 1:N
                                    ▼
                          ┌──────────────────┐
                          │ circuit_wires    │
                          │──────────────────│
                          │ id (PK)          │
                          │ circuitId (FK)   │
                          │ netId (FK)       │
                          │ view             │
                          │ points (jsonb)   │
                          │ layer            │
                          │ width            │
                          └──────────────────┘

Additional tables (also under projects.id cascade):
  ai_actions · bom_snapshots · component_lifecycle
  spice_models (global, not project-scoped)
  simulation_results (under circuit_designs.id)
```

### Table Details

#### `projects`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | Auto-increment |
| `name` | `text` | NOT NULL | Project display name |
| `description` | `text` | DEFAULT `''` | |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `deleted_at` | `timestamp` | NULLABLE | Soft delete marker |

#### `architecture_nodes`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `node_id` | `text` | NOT NULL, UNIQUE(project_id, node_id) | Client-generated UUID |
| `node_type` | `text` | NOT NULL, 1-100 chars | `mcu`, `sensor`, `power`, `comm`, `connector`, etc. |
| `label` | `text` | NOT NULL | Display name |
| `position_x` | `real` | NOT NULL | Canvas X coordinate |
| `position_y` | `real` | NOT NULL | Canvas Y coordinate |
| `data` | `jsonb` | NULLABLE | Arbitrary metadata (e.g., `{ description, componentPartId }`) |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `deleted_at` | `timestamp` | NULLABLE | Soft delete |

**Indexes:** `idx_arch_nodes_project`, `idx_arch_nodes_project_deleted`, unique `uq_arch_nodes_project_node`.

#### `architecture_edges`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `edge_id` | `text` | NOT NULL, UNIQUE(project_id, edge_id) | Client-generated UUID |
| `source` | `text` | NOT NULL | Source node_id |
| `target` | `text` | NOT NULL | Target node_id |
| `label` | `text` | NULLABLE | Edge label (e.g., "SPI Bus") |
| `animated` | `boolean` | DEFAULT false | React Flow animation |
| `style` | `jsonb` | NULLABLE | `{ stroke?: string }` |
| `signal_type` | `text` | NULLABLE | SPI, I2C, UART, analog, etc. |
| `voltage` | `text` | NULLABLE | e.g., "3.3V" |
| `bus_width` | `text` | NULLABLE | e.g., "4-bit" |
| `net_name` | `text` | NULLABLE | Named net reference |
| `deleted_at` | `timestamp` | NULLABLE | Soft delete |

**Indexes:** `idx_arch_edges_project`, `idx_arch_edges_project_deleted`, unique `uq_arch_edges_project_edge`.

#### `bom_items`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `part_number` | `text` | NOT NULL | |
| `manufacturer` | `text` | NOT NULL | |
| `description` | `text` | NOT NULL | |
| `quantity` | `integer` | NOT NULL, DEFAULT 1 | |
| `unit_price` | `numeric(10,4)` | NOT NULL | |
| `total_price` | `numeric(10,4)` | NOT NULL | Computed server-side: qty × unit_price |
| `supplier` | `text` | NOT NULL | |
| `stock` | `integer` | NOT NULL, DEFAULT 0 | |
| `status` | `text` | NOT NULL, DEFAULT "In Stock" | Enum: `In Stock`, `Low Stock`, `Out of Stock`, `On Order` |
| `lead_time` | `text` | NULLABLE | |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `deleted_at` | `timestamp` | NULLABLE | Soft delete |

#### `validation_issues`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `severity` | `text` | NOT NULL | Enum: `error`, `warning`, `info` |
| `message` | `text` | NOT NULL | |
| `component_id` | `text` | NULLABLE | References node label |
| `suggestion` | `text` | NULLABLE | Suggested fix |

#### `chat_messages`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `role` | `text` | NOT NULL | `user`, `assistant`, `system` |
| `content` | `text` | NOT NULL | |
| `timestamp` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `mode` | `text` | DEFAULT `chat` | |
| `branch_id` | `text` | NULLABLE | Conversation branch ID |
| `parent_message_id` | `integer` | NULLABLE | For branching |

**Indexes:** `idx_chat_messages_project`, `idx_chat_messages_project_ts`, `idx_chat_messages_branch`.

#### `history_items`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `action` | `text` | NOT NULL | Description of action |
| `user` | `text` | NOT NULL | `User` or `AI` |
| `timestamp` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `users`
| Column | Type | Constraints |
|---|---|---|
| `id` | `serial` | PK |
| `username` | `text` | NOT NULL, UNIQUE |
| `password_hash` | `text` | NOT NULL |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW |

#### `sessions`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `text` | PK | UUID |
| `user_id` | `integer` | FK → users.id CASCADE | |
| `expires_at` | `timestamp` | NOT NULL | 7-day TTL |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `api_keys`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `user_id` | `integer` | FK → users.id CASCADE | |
| `provider` | `text` | NOT NULL | `gemini` |
| `encrypted_key` | `text` | NOT NULL | AES-256-GCM encrypted |
| `iv` | `text` | NOT NULL | Initialization vector (hex) |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `user_chat_settings`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `user_id` | `integer` | FK → users.id CASCADE | |
| `ai_provider` | `text` | NOT NULL, DEFAULT `gemini` | |
| `ai_model` | `text` | NOT NULL, DEFAULT `claude-sonnet-4-5-20250514` | |
| `ai_temperature` | `real` | NOT NULL, DEFAULT 0.7 | |
| `custom_system_prompt` | `text` | DEFAULT `''` | |
| `routing_strategy` | `text` | NOT NULL, DEFAULT `user` | `user`, `auto`, `quality`, `speed`, `cost` |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

**Unique index:** `uq_user_chat_settings_user` on `user_id`.

#### `component_parts`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `node_id` | `text` | NULLABLE | Links to architecture node |
| `meta` | `jsonb` | NOT NULL, DEFAULT `{}` | `PartMeta` — title, family, manufacturer, tags, etc. |
| `connectors` | `jsonb` | NOT NULL, DEFAULT `[]` | Array of `Connector` objects |
| `buses` | `jsonb` | NOT NULL, DEFAULT `[]` | Array of `Bus` objects |
| `views` | `jsonb` | NOT NULL, DEFAULT `{}` | `PartViews` — breadboard, schematic, pcb shapes |
| `constraints` | `jsonb` | NOT NULL, DEFAULT `[]` | Array of `Constraint` objects |
| `version` | `integer` | NOT NULL, DEFAULT 1 | Auto-incremented on update |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `component_library`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `title` | `text` | NOT NULL | |
| `description` | `text` | NULLABLE | |
| `meta` | `jsonb` | NOT NULL, DEFAULT `{}` | |
| `connectors` | `jsonb` | NOT NULL, DEFAULT `[]` | |
| `buses` | `jsonb` | NOT NULL, DEFAULT `[]` | |
| `views` | `jsonb` | NOT NULL, DEFAULT `{}` | |
| `constraints` | `jsonb` | NOT NULL, DEFAULT `[]` | |
| `tags` | `text[]` | NOT NULL, DEFAULT `[]` | |
| `category` | `text` | NULLABLE | |
| `is_public` | `boolean` | NOT NULL, DEFAULT false | |
| `author_id` | `text` | NULLABLE | |
| `forked_from_id` | `integer` | NULLABLE | |
| `download_count` | `integer` | NOT NULL, DEFAULT 0 | |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `circuit_designs`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `parent_design_id` | `integer` | NULLABLE | For hierarchical sheets |
| `name` | `text` | NOT NULL, DEFAULT `Main Circuit` | |
| `description` | `text` | NULLABLE | |
| `settings` | `jsonb` | NOT NULL, DEFAULT `{}` | |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `hierarchical_ports`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `design_id` | `integer` | FK → circuit_designs.id CASCADE | |
| `port_name` | `text` | NOT NULL | |
| `direction` | `text` | NOT NULL, DEFAULT `bidirectional` | `input`, `output`, `bidirectional` |
| `net_name` | `text` | NULLABLE | |
| `position_x` | `real` | NOT NULL, DEFAULT 0 | |
| `position_y` | `real` | NOT NULL, DEFAULT 0 | |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `circuit_instances`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `circuit_id` | `integer` | FK → circuit_designs.id CASCADE | |
| `part_id` | `integer` | FK → component_parts.id SET NULL | |
| `reference_designator` | `text` | NOT NULL | e.g., `R1`, `U2` |
| `schematic_x/y` | `real` | NOT NULL, DEFAULT 0 | |
| `schematic_rotation` | `real` | NOT NULL, DEFAULT 0 | |
| `breadboard_x/y` | `real` | NULLABLE | |
| `breadboard_rotation` | `real` | NULLABLE, DEFAULT 0 | |
| `pcb_x/y` | `real` | NULLABLE | |
| `pcb_rotation` | `real` | NULLABLE, DEFAULT 0 | |
| `pcb_side` | `text` | NULLABLE, DEFAULT `front` | |
| `properties` | `jsonb` | NOT NULL, DEFAULT `{}` | |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `circuit_nets`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `circuit_id` | `integer` | FK → circuit_designs.id CASCADE | |
| `name` | `text` | NOT NULL | |
| `net_type` | `text` | NOT NULL, DEFAULT `signal` | `signal`, `power`, `ground`, `bus` |
| `voltage` | `text` | NULLABLE | |
| `bus_width` | `integer` | NULLABLE | |
| `segments` | `jsonb` | NOT NULL, DEFAULT `[]` | Connection segments (instance+pin pairs) |
| `labels` | `jsonb` | NOT NULL, DEFAULT `[]` | Net labels with positions |
| `style` | `jsonb` | NOT NULL, DEFAULT `{}` | Visual style |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `circuit_wires`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `circuit_id` | `integer` | FK → circuit_designs.id CASCADE | |
| `net_id` | `integer` | FK → circuit_nets.id CASCADE | |
| `view` | `text` | NOT NULL | `schematic`, `breadboard`, or `pcb` |
| `points` | `jsonb` | NOT NULL, DEFAULT `[]` | Array of `{x, y}` points |
| `layer` | `text` | NULLABLE, DEFAULT `front` | |
| `width` | `real` | NOT NULL, DEFAULT 1.0 | |
| `color` | `text` | NULLABLE | |
| `wire_type` | `text` | NULLABLE, DEFAULT `wire` | |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `simulation_results`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `circuit_id` | `integer` | FK → circuit_designs.id CASCADE | |
| `analysis_type` | `text` | NOT NULL | `op`, `tran`, `ac`, `dc` |
| `config` | `jsonb` | NOT NULL, DEFAULT `{}` | Simulation parameters |
| `results` | `jsonb` | NOT NULL, DEFAULT `{}` | Node voltages, currents, traces |
| `status` | `text` | NOT NULL, DEFAULT `completed` | `completed`, `failed` |
| `engine_used` | `text` | NULLABLE | Simulator engine name |
| `elapsed_ms` | `integer` | NULLABLE | |
| `size_bytes` | `integer` | NULLABLE | Result payload size |
| `error` | `text` | NULLABLE | Error message if failed |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `ai_actions`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `chat_message_id` | `text` | NULLABLE | Links to chat message |
| `tool_name` | `text` | NOT NULL | AI tool function name |
| `parameters` | `jsonb` | NOT NULL, DEFAULT `{}` | Tool call parameters |
| `result` | `jsonb` | NOT NULL, DEFAULT `{}` | Tool call result |
| `status` | `text` | NOT NULL, DEFAULT `completed` | |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `design_preferences`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `category` | `text` | NOT NULL | Preference category |
| `key` | `text` | NOT NULL | Preference key |
| `value` | `text` | NOT NULL | Preference value |
| `source` | `text` | NOT NULL, DEFAULT `ai` | `ai` or `user` |
| `confidence` | `real` | NOT NULL, DEFAULT 0.8 | AI confidence score |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

**Unique index:** `uq_design_prefs_project_cat_key` on `(project_id, category, key)`.

#### `bom_snapshots`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `label` | `text` | NOT NULL | Human-readable snapshot name |
| `snapshot_data` | `jsonb` | NOT NULL | Serialized `BomItem[]` at capture time |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

#### `spice_models`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `name` | `text` | NOT NULL | Model name (e.g., `2N2222`) |
| `model_type` | `text` | NOT NULL | Enum: NPN, PNP, DIODE, ZENER, SCHOTTKY, LED, NMOS, PMOS, MOSFET_N, MOSFET_P, JFET_N, JFET_P, OPAMP, COMPARATOR, VOLTAGE_REG, TIMER, RESISTOR, CAPACITOR, INDUCTOR |
| `spice_directive` | `text` | NOT NULL | Full `.MODEL` or `.SUBCKT` directive |
| `parameters` | `jsonb` | NOT NULL, DEFAULT `{}` | Key model parameters |
| `description` | `text` | NULLABLE | |
| `category` | `text` | NOT NULL | Enum: transistor, diode, opamp, passive, ic, voltage_regulator, mosfet, jfet |
| `datasheet` | `text` | NULLABLE | Datasheet URL |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

**Note:** `spice_models` is global (not project-scoped). Seeded with ~20 standard models.

#### `component_lifecycle`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `bom_item_id` | `integer` | NULLABLE | Links to bom_items |
| `part_number` | `varchar(100)` | NOT NULL | |
| `manufacturer` | `varchar(200)` | NULLABLE | |
| `lifecycle_status` | `varchar(50)` | NOT NULL, DEFAULT `active` | `active`, `nrnd`, `eol`, `discontinued`, etc. |
| `last_checked_at` | `timestamp` | NULLABLE | |
| `alternate_part_numbers` | `text` | NULLABLE | Comma-separated alternates |
| `data_source` | `varchar(100)` | NULLABLE | |
| `notes` | `text` | NULLABLE | |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

### Soft Delete Strategy

`projects`, `architecture_nodes`, `architecture_edges`, and `bom_items` use soft deletes via a `deleted_at` timestamp. All read queries filter with `WHERE deleted_at IS NULL`.

`chat_messages`, `history_items`, `validation_issues`, and circuit tables use hard deletes.

---

## 5. Complete API Reference

### Authentication

All `/api/` endpoints require the `X-Session-Id` header (optional in `NODE_ENV=development`), except:
- `/api/auth/*` — Auth endpoints
- `/api/health` — Health check
- `/api/seed` — Demo seed (dev only, 404 in production)
- `/api/admin/metrics` — Requires `X-Admin-Key` header instead

### Pagination

All list endpoints support:

| Parameter | Type | Default | Range |
|---|---|---|---|
| `limit` | integer | 50 | 1–100 |
| `offset` | integer | 0 | 0+ |
| `sort` | string | `desc` | `asc` \| `desc` |

Response envelope:
```json
{ "data": [...], "total": 42 }
```

### Error Responses

```json
{ "message": "Human-readable description" }
```

| Status | Meaning |
|---|---|
| 400 | Validation error (Zod) or bad request |
| 401 | Missing or invalid session |
| 403 | CSRF origin mismatch or admin key required |
| 404 | Resource not found |
| 408 | Request timeout (30s) |
| 409 | Conflict (e.g., username taken) |
| 413 | Payload too large |
| 422 | Unprocessable entity (e.g., DRC gate failed before export) |
| 429 | Rate limited |
| 500 | Internal server error (sanitized in production) |

---

### Auth Endpoints (`server/routes/auth.ts`)

All auth endpoints have a rate limit of 10 requests per 15-minute window per IP.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Register new user. Body: `{ username, password }`. Returns `{ sessionId, user }` (201). |
| `POST` | `/api/auth/login` | No | Authenticate. Body: `{ username, password }`. Returns `{ sessionId, user }`. |
| `POST` | `/api/auth/logout` | Optional | Invalidate session. Returns 204. |
| `GET` | `/api/auth/me` | Yes | Get current user. Returns `{ id, username }`. |

---

### Settings Endpoints (`server/routes/settings.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/settings/api-keys` | Yes | List providers with stored API keys. |
| `POST` | `/api/settings/api-keys` | Yes | Store API key. Body: `{ provider, apiKey }`. |
| `DELETE` | `/api/settings/api-keys/:provider` | Yes | Delete stored API key. |
| `GET` | `/api/settings/chat` | Optional | Get chat settings (returns defaults if not authenticated). |
| `PATCH` | `/api/settings/chat` | Yes | Update chat settings. Body: `{ aiProvider?, aiModel?, aiTemperature?, customSystemPrompt?, routingStrategy? }`. |

---

### Project Endpoints (`server/routes/projects.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects` | Yes | List all non-deleted projects. Paginated. |
| `GET` | `/api/projects/:id` | Yes | Get single project. |
| `POST` | `/api/projects` | Yes | Create project. Body: `{ name, description? }`. Returns 201. |
| `PATCH` | `/api/projects/:id` | Yes | Update project. Body: partial `{ name?, description? }`. |
| `DELETE` | `/api/projects/:id` | Yes | Soft-delete project (cascades to nodes, edges, BOM). Returns 204. |

---

### Architecture Endpoints (`server/routes/architecture.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:id/nodes` | Yes | List non-deleted nodes. Paginated. |
| `POST` | `/api/projects/:id/nodes` | Yes | Create node. Body: `{ nodeId, nodeType, label, positionX, positionY, data? }`. Returns 201. |
| `PATCH` | `/api/projects/:id/nodes/:nodeId` | Yes | Update node. Partial update. |
| `PUT` | `/api/projects/:id/nodes` | Yes | Replace ALL nodes atomically (512KB limit). |
| `GET` | `/api/projects/:id/edges` | Yes | List non-deleted edges. Paginated. |
| `POST` | `/api/projects/:id/edges` | Yes | Create edge. Returns 201. |
| `PATCH` | `/api/projects/:id/edges/:edgeId` | Yes | Update edge. |
| `PUT` | `/api/projects/:id/edges` | Yes | Replace ALL edges atomically (512KB limit). |

---

### BOM Endpoints (`server/routes/bom.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:id/bom` | Yes | List BOM items. Paginated. |
| `GET` | `/api/projects/:id/bom/:bomId` | Yes | Get single BOM item. |
| `POST` | `/api/projects/:id/bom` | Yes | Create BOM item. Returns 201. `totalPrice` computed server-side. |
| `PATCH` | `/api/projects/:id/bom/:bomId` | Yes | Update BOM item. |
| `DELETE` | `/api/projects/:id/bom/:bomId` | Yes | Soft-delete BOM item. Returns 204. |

---

### BOM Snapshot Endpoints (`server/routes/bom-snapshots.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/projects/:id/bom-snapshots` | Yes | Create snapshot of current BOM. Body: `{ label }`. Returns 201. |
| `GET` | `/api/projects/:id/bom-snapshots` | Yes | List all snapshots. |
| `DELETE` | `/api/projects/:id/bom-snapshots/:snapshotId` | Yes | Delete a snapshot. Returns 204. |
| `POST` | `/api/projects/:id/bom-diff` | Yes | Compute diff between snapshot and current BOM. Body: `{ snapshotId }`. |

---

### Validation Endpoints (`server/routes/validation.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:id/validation` | Yes | List validation issues. Paginated. |
| `POST` | `/api/projects/:id/validation` | Yes | Create issue. Body: `{ severity, message, componentId?, suggestion? }`. |
| `DELETE` | `/api/projects/:id/validation/:issueId` | Yes | Delete issue. Returns 204. |
| `PUT` | `/api/projects/:id/validation` | Yes | Replace ALL validation issues atomically (512KB limit). |

---

### Chat & AI Endpoints (`server/routes/chat.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:id/chat` | Yes | List chat messages. Supports `?branchId=` filter. |
| `POST` | `/api/projects/:id/chat` | Yes | Save a chat message. Returns 201. |
| `DELETE` | `/api/projects/:id/chat` | Yes | Delete all messages for a project. Returns 204. |
| `DELETE` | `/api/projects/:id/chat/:msgId` | Yes | Delete a single message. Returns 204. |
| `POST` | `/api/chat/ai` | Yes | Send message to AI (non-streaming). Supports vision via `imageBase64`/`imageMimeType`. |
| `POST` | `/api/chat/ai/stream` | Yes | Send message to AI (SSE streaming). Enforces 1 concurrent stream/session, 20 req/min rate limit, 5-min absolute timeout. |
| `GET` | `/api/projects/:id/ai-actions` | Yes | List AI action history. |
| `GET` | `/api/ai-actions/by-message/:messageId` | Yes | Get AI actions for a specific message. |

**AI request body** (`POST /api/chat/ai` and `POST /api/chat/ai/stream`):
```json
{
  "message": string,
  "provider": "gemini",
  "model": string,
  "apiKey"?: string,
  "projectId": number,
  "activeView"?: string,
  "schematicSheets"?: [{ "id": string, "name": string }],
  "activeSheetId"?: string,
  "temperature"?: number,
  "maxTokens"?: number,
  "customSystemPrompt"?: string,
  "selectedNodeId"?: string | null,
  "changeDiff"?: string,
  "routingStrategy"?: "user" | "auto" | "quality" | "speed" | "cost",
  "imageBase64"?: string,
  "imageMimeType"?: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
}
```

---

### Chat Branch Endpoints (`server/routes/chat-branches.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/projects/:id/chat/branches` | Yes | Create a new conversation branch. Body: `{ parentMessageId }`. |
| `GET` | `/api/projects/:id/chat/branches` | Yes | List all branches for a project. |

---

### History Endpoints (`server/routes/history.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:id/history` | Yes | List history items. Paginated. |
| `POST` | `/api/projects/:id/history` | Yes | Create history item. Body: `{ action, user }`. |
| `DELETE` | `/api/projects/:id/history` | Yes | Delete all history for a project. Returns 204. |
| `DELETE` | `/api/projects/:id/history/:itemId` | Yes | Delete a single history item. Returns 204. |

---

### Component Endpoints (`server/routes/components.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:projectId/component-parts` | Yes | List component parts. |
| `GET` | `/api/projects/:projectId/component-parts/by-node/:nodeId` | Yes | Get part by architecture node ID. |
| `GET` | `/api/projects/:projectId/component-parts/:id` | Yes | Get single part. |
| `POST` | `/api/projects/:projectId/component-parts` | Yes | Create component part. Returns 201. |
| `PATCH` | `/api/projects/:projectId/component-parts/:id` | Yes | Update component part. |
| `DELETE` | `/api/projects/:projectId/component-parts/:id` | Yes | Delete component part. Returns 204. |
| `GET` | `/api/projects/:projectId/component-parts/:id/export/fzpz` | Yes | Export part as Fritzing FZPZ archive. |
| `POST` | `/api/projects/:projectId/component-parts/import/fzpz` | Yes | Import part from FZPZ archive (5MB limit). |
| `POST` | `/api/projects/:projectId/component-parts/:id/import/svg` | Yes | Parse SVG into shape primitives (2MB limit). |
| `POST` | `/api/projects/:projectId/component-parts/:id/drc` | Yes | Run Design Rule Check on a component. |
| `POST` | `/api/projects/:projectId/component-parts/ai/generate` | Yes | AI-generate a component from description (Gemini). |
| `POST` | `/api/projects/:projectId/component-parts/:id/ai/modify` | Yes | AI-modify an existing component. |
| `POST` | `/api/projects/:projectId/component-parts/:id/ai/extract` | Yes | Extract metadata from datasheet image. |
| `POST` | `/api/projects/:projectId/component-parts/:id/ai/suggest` | Yes | AI-suggest a description for a component. |
| `POST` | `/api/projects/:projectId/component-parts/:id/ai/extract-pins` | Yes | Extract pin definitions from a photo. |
| `GET` | `/api/component-library` | Yes | List library entries. Supports `?search=&category=&page=&limit=`. |
| `GET` | `/api/component-library/:id` | Yes | Get single library entry. |
| `POST` | `/api/component-library` | Yes | Create library entry. Returns 201. |
| `DELETE` | `/api/component-library/:id` | Yes | Delete library entry. Returns 204. |
| `POST` | `/api/component-library/:id/fork` | Yes | Fork library entry into a project. Body: `{ projectId }`. |

---

### Design Preference Endpoints (`server/routes/design-preferences.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:id/preferences` | Yes | List all design preferences. |
| `POST` | `/api/projects/:id/preferences` | Yes | Upsert a preference. Body: `{ category, key, value, source?, confidence? }`. |
| `PUT` | `/api/projects/:id/preferences` | Yes | Bulk upsert preferences (array). |
| `DELETE` | `/api/projects/:id/preferences/:prefId` | Yes | Delete a preference. Returns 204. |

---

### Component Lifecycle Endpoints (`server/routes/component-lifecycle.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:id/lifecycle` | Yes | List lifecycle entries. |
| `POST` | `/api/projects/:id/lifecycle` | Yes | Create/upsert lifecycle entry. |
| `PATCH` | `/api/projects/:id/lifecycle/:entryId` | Yes | Update lifecycle entry. |
| `DELETE` | `/api/projects/:id/lifecycle/:entryId` | Yes | Delete lifecycle entry. Returns 204. |

---

### SPICE Model Endpoints (`server/routes/spice-models.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/spice-models` | Yes | List SPICE models. Supports `?category=&search=&limit=&offset=`. |
| `GET` | `/api/spice-models/:id` | Yes | Get single SPICE model. |
| `POST` | `/api/spice-models` | Yes | Create SPICE model. |
| `POST` | `/api/spice-models/seed` | Yes | Seed ~20 standard models (2N2222, LM741, etc.). |

---

### Project I/O Endpoints (`server/routes/project-io.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:id/export` | Yes | Export full project as JSON. Includes all nodes, edges, BOM, circuit designs, simulation results, AI actions. |
| `POST` | `/api/projects/import` | Yes | Import a project from JSON (10MB limit). Creates a new project transactionally. |

---

### Batch Analysis Endpoints (`server/routes/batch.ts`)

Requires `X-Gemini-Key` header (not X-Session-Id).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/batch/catalog` | No | List available analysis types. |
| `POST` | `/api/batch/submit` | Key | Submit batch analysis. Body: `{ projectId, analyses[], model? }`. Returns 202 with batchId. |
| `GET` | `/api/batch/:batchId/status` | Key | Check batch status. |
| `GET` | `/api/batch/:batchId/results` | Key | Retrieve batch results. |
| `POST` | `/api/batch/:batchId/cancel` | Key | Cancel a batch. |
| `GET` | `/api/projects/:projectId/batches` | Yes | List in-memory batch records for a project. |

---

### Admin Endpoints (`server/routes/admin.ts`)

Requires `X-Admin-Key` header matching `ADMIN_API_KEY` env var.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/metrics` | Admin Key | Get server metrics (request counts, latencies, error rates). |
| `DELETE` | `/api/admin/purge` | Admin Key | Hard-purge soft-deleted records older than 30 days. Supports `?dryRun=true`. |

---

### Circuit Design Endpoints (`server/circuit-routes/designs.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:projectId/circuits` | Yes | List circuit designs for a project. |
| `GET` | `/api/projects/:projectId/circuits/:id` | Yes | Get single circuit design. |
| `POST` | `/api/projects/:projectId/circuits` | Yes | Create circuit design. Returns 201. |
| `PATCH` | `/api/projects/:projectId/circuits/:id` | Yes | Update circuit design. |
| `DELETE` | `/api/projects/:projectId/circuits/:id` | Yes | Delete circuit design. Returns 204. |

---

### Circuit Instance Endpoints (`server/circuit-routes/instances.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/circuits/:circuitId/instances` | Yes | List instances. Paginated. |
| `GET` | `/api/circuits/:circuitId/instances/:id` | Yes | Get single instance. |
| `POST` | `/api/circuits/:circuitId/instances` | Yes | Create instance. Body: `{ partId, referenceDesignator, schematicX?, schematicY?, ... }`. |
| `PATCH` | `/api/circuits/:circuitId/instances/:id` | Yes | Update instance position/rotation. |
| `DELETE` | `/api/circuits/:circuitId/instances/:id` | Yes | Delete instance. Returns 204. |

---

### Circuit Net Endpoints (`server/circuit-routes/nets.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/circuits/:circuitId/nets` | Yes | List nets. Paginated. |
| `GET` | `/api/circuits/:circuitId/nets/:id` | Yes | Get single net. |
| `POST` | `/api/circuits/:circuitId/nets` | Yes | Create net. Body: `{ name, netType?, voltage?, busWidth?, segments?, labels?, style? }`. |
| `PATCH` | `/api/circuits/:circuitId/nets/:id` | Yes | Update net. |
| `DELETE` | `/api/circuits/:circuitId/nets/:id` | Yes | Delete net. Returns 204. |

---

### Circuit Wire Endpoints (`server/circuit-routes/wires.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/circuits/:circuitId/wires` | Yes | List wires. |
| `GET` | `/api/circuits/:circuitId/wires/:id` | Yes | Get single wire. |
| `POST` | `/api/circuits/:circuitId/wires` | Yes | Create wire. Body: `{ netId, view, points, layer?, width?, color?, wireType? }`. |
| `PATCH` | `/api/circuits/:circuitId/wires/:id` | Yes | Update wire. |
| `DELETE` | `/api/circuits/:circuitId/wires/:id` | Yes | Delete wire. Returns 204. |

---

### Circuit Simulation Endpoints (`server/circuit-routes/simulations.ts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/projects/:projectId/circuits/:circuitId/simulate` | Yes | Run simulation. Body: `{ analysisType, transient?, ac?, dcSweep?, temperature? }`. Auto-cleanup: keeps max 5 results. |
| `GET` | `/api/projects/:projectId/circuits/:circuitId/simulations` | Yes | List simulation result summaries. |
| `GET` | `/api/projects/:projectId/circuits/:circuitId/simulations/:simId` | Yes | Get full simulation result (with traces). |
| `DELETE` | `/api/projects/:projectId/circuits/:circuitId/simulations/:simId` | Yes | Delete simulation result. Returns 204. |
| `GET` | `/api/projects/:projectId/circuits/:circuitId/simulation/capabilities` | Yes | Get simulation engine capabilities. |
| `POST` | `/api/projects/:projectId/export/spice` | Yes | Export SPICE netlist (.cir file). Body: `{ analysisType?, transient?, ac?, ... }`. |
| `POST` | `/api/projects/:projectId/circuits/:circuitId/analyze/power` | Yes | Run DC OP + estimate power consumption per component. |
| `POST` | `/api/projects/:projectId/circuits/:circuitId/analyze/signal-integrity` | Yes | Analyze signal integrity (high-fanout, bus termination, thin power traces, missing bypass caps). |

---

### Export Endpoints (`server/circuit-routes/exports.ts`)

All export endpoints respond with appropriate `Content-Type` and `Content-Disposition` headers.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/projects/:projectId/export/bom` | Yes | Export BOM as CSV. Body: `{ bomFormat? }` (`generic`, `jlcpcb`, `mouser`, `digikey`). |
| `POST` | `/api/projects/:projectId/export/netlist` | Yes | Export netlist. Body: `{ netlistFormat? }` (`spice`, `kicad`, `csv`). |
| `POST` | `/api/projects/:projectId/export/gerber` | Yes | Generate Gerber + drill files. Runs DRC gate first; returns 422 if violations found. Body: `{ boardWidth?, boardHeight? }`. |
| `POST` | `/api/projects/:projectId/export/pick-place` | Yes | Generate pick-and-place CSV. |
| `POST` | `/api/projects/:projectId/export/kicad` | Yes | Generate KiCad project (.kicad_sch, .kicad_pcb, .kicad_pro). |
| `POST` | `/api/projects/:projectId/export/eagle` | Yes | Generate Eagle project (.sch, .brd). |
| `POST` | `/api/projects/:projectId/export/pdf` | Yes | Export view as SVG/PDF. Body: `{ viewData, paperSize?, scale?, titleBlock? }`. |
| `POST` | `/api/projects/:projectId/export/report-pdf` | Yes | Generate full design report PDF. |
| `POST` | `/api/projects/:projectId/export/fmea` | Yes | Generate FMEA analysis CSV. |
| `POST` | `/api/projects/:projectId/export/fzz` | Yes | Export as Fritzing .fzz project. |
| `POST` | `/api/projects/:projectId/export/firmware` | Yes | Generate firmware scaffold (Arduino/PlatformIO). |

---

### Other Circuit Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/circuits/:circuitId/netlist` | Yes | Generate netlist for a circuit (inline). |
| `POST` | `/api/projects/:projectId/circuits/:id/autoroute` | Yes | Auto-route PCB traces. |
| `GET/POST` | `/api/circuits/:circuitId/hierarchy` | Yes | Hierarchical port management. |
| `POST` | `/api/circuits/:circuitId/expand` | Yes | Expand circuit with AI suggestions. |
| `POST` | `/api/circuits/:circuitId/import` | Yes | Import circuit data. |

---

### Misc Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/seed` | No | Seed demo data (development only, 404 in production). |
| `GET` | `/api/health` | No | Health check. |
| `GET` | `/api/projects/:projectId/batches` | Yes | List in-memory batch records. |

---

## 6. AI System Deep Dive

### Overview

`server/ai.ts` (1,368 lines) orchestrates all AI interactions. It builds a full project state snapshot on every request (O(N) sequential queries — known performance debt GA-DB-01), calls Google Genkit, and parses structured tool call responses.

### Multi-Model Routing

The `routeToModel()` function applies a routing strategy:

| Strategy | Behavior |
|---|---|
| `user` | Use the model specified by the user |
| `auto` | Route based on message length and complexity |
| `quality` | Always route to highest-capability model |
| `speed` | Route to fastest model |
| `cost` | Route to most cost-effective model |

### AI Tools System

`server/ai-tools.ts` is a barrel importing 11 tool modules from `server/ai-tools/`. The registry exposes 80+ tools across domains:

- **Navigation**: `navigate_to_view`, `select_node`, etc.
- **Architecture**: `create_node`, `delete_node`, `update_node`, `create_edge`, `delete_edge`, `generate_architecture`, `replace_all_nodes`, `replace_all_edges`, etc.
- **Circuit**: `create_circuit_design`, `add_circuit_instance`, `create_net`, `place_component`, etc.
- **Component**: `generate_component`, `modify_component`, `run_drc`, etc.
- **BOM**: `add_bom_item`, `update_bom_item`, `delete_bom_item`, `create_bom_snapshot`, etc.
- **Validation**: `add_validation_issue`, `clear_validation_issues`, `replace_validation`, etc.
- **Export**: `trigger_export`, `generate_gerber`, `generate_kicad`, etc.
- **Project**: `update_project_name`, `record_history`, `set_design_preference`, etc.

### Streaming (SSE)

`POST /api/chat/ai/stream` emits Server-Sent Events:

```
data: {"type":"text","content":"Hello"}
data: {"type":"tool_start","toolName":"create_node","params":{...}}
data: {"type":"tool_result","toolName":"create_node","result":{...}}
data: {"type":"done"}
```

Stream protection measures:
- 1 concurrent stream per session (enforced via `activeStreams` set)
- 20 stream requests per minute per IP (sliding window)
- 32KB message content limit
- Activity-based timeout (default 120s, configurable via `STREAM_TIMEOUT_MS`)
- Absolute 5-minute hard cap
- 15-second SSE heartbeat for proxy keep-alive
- Origin header validation in production
- Backpressure handling (30s drain timeout)

### Error Categorization

`categorizeError()` maps provider error codes to user-facing messages and severity levels, distinguishing between auth failures, rate limits, content policy blocks, and network errors.

---

## 7. Frontend Architecture

### State Management

All state flows through `client/src/lib/project-context.tsx` (`ProjectProvider`) backed by TanStack React Query:

- **Server state**: React Query `useQuery`/`useMutation` hooks
- **Client state**: React context (no Redux/Zustand)
- **40+ state values** including nodes, edges, BOM, validation issues, chat, circuit designs, component parts

**Known debt**: `ProjectProvider` is monolithic — needs splitting by domain.

### View System

`client/src/pages/ProjectWorkspace.tsx` provides a 3-panel layout:
1. **Left**: Sidebar (navigation, component tree, history)
2. **Center**: Tabbed views (lazy-loaded, each wrapped in `ErrorBoundary`)
3. **Right**: ChatPanel (AI chat + settings) + ExportPanel

Implemented views:
- `ArchitectureView` — React Flow block diagram canvas
- `ComponentEditorView` — Multi-view SVG component editor (breadboard/schematic/PCB)
- `ProcurementView` — BOM management with tabs: BOM Management + BOM Comparison (BomDiffPanel)
- `ValidationView` — DRC/ERC results with "Mark Resolved"
- `OutputView` — System log viewer
- `SchematicCanvas` — Full circuit schematic editor (@xyflow/react)
- `BreadboardView` — Breadboard layout
- `PCBLayoutView` — PCB layout
- `DashboardView` — Project overview dashboard

### Component Editor

The `ComponentEditorView` provides 5 sub-views (breadboard, schematic, PCB, connectors, properties) with an interactive SVG canvas (`ShapeCanvas`). Supports shape primitives (rect, circle, path, text), connector placement, bus definition, and DRC rule configuration.

### Circuit Editor

The circuit schematic editor lives in `client/src/components/circuit-editor/`. Key features:
- `SchematicCanvas` — @xyflow/react canvas with custom node/edge renderers
- `NetDrawingTool` — Interactive wire routing (click-drag to draw nets)
- `ERCPanel` — Electrical Rules Check results
- `NetClassPanel` — Net class configuration (impedance, clearance, width)
- `HierarchicalSheetPanel` — Multi-sheet navigation
- `BreadboardView` / `PCBLayoutView` — Alternative views for the same circuit

Wire routing uses `client/src/lib/circuit-editor/` (wire router with 90-degree routing).

### Simulation UI

- `FrequencyAnalysisPanel` — AC analysis configuration + results
- `BodePlot` — Magnitude/phase Bode plot visualization (recharts)

---

## 8. Backend Architecture

### Key Files

| File | Lines | Description |
|---|---|---|
| `server/storage.ts` | 1,598 | `IStorage` interface + `DatabaseStorage`. All data access goes through this layer. LRU cache with prefix-based key invalidation. Never bypass via direct DB queries. |
| `server/ai.ts` | 1,368 | AI engine: prompt construction, tool call parsing, streaming, multi-model routing. |
| `server/routes.ts` | 57 | Barrel file — registers 21 domain routers + circuit routes. |
| `server/auth.ts` | ~200 | scrypt password hashing, UUID sessions (7-day TTL), AES-256-GCM API key encryption. |
| `server/cache.ts` | ~100 | LRU cache implementation. Evicts least-recently-used. Prefix-based invalidation (invalidating `"nodes:1"` clears all keys starting with `"nodes:1"`). |
| `server/metrics.ts` | ~100 | In-memory per-route metrics (request count, total latency, error count). |
| `server/circuit-breaker.ts` | ~150 | Circuit breaker for external API calls (half-open, open, closed states). |
| `server/audit-log.ts` | ~100 | Structured audit event logging. |
| `server/batch-analysis.ts` | ~300 | Genkit queue mocking for async background analysis. |

### Storage Layer

`IStorage` defines the full interface. `DatabaseStorage` implements it with:
- Drizzle ORM queries against PostgreSQL
- LRU cache for read-heavy endpoints (nodes, edges, BOM items)
- Soft delete support (`isNull(deletedAt)` filters)
- Pagination (limit/offset/sort)
- Prefix-based cache invalidation

All route handlers and AI tools access storage exclusively through `IStorage`. This enables test isolation via mock implementations.

### Middleware Stack

```
helmet (CSP, HSTS, X-Frame-Options, etc.)
compression (gzip)
requestId (UUID → X-Request-Id)
apiVersion (X-API-Version: 1)
globalRateLimit (300 req / 15 min)
json() body parser (1MB default, per-route overrides)
csrfGuard (origin/host validation in production)
requestTimeout (30s)
sessionAuth (X-Session-Id → req.userId)
requestLogger + metricsMiddleware
routes
errorHandler
```

---

## 9. Component Editor System

### Type System (`shared/component-types.ts`)

The component editor uses a hierarchical type system:

```
PartState
  ├── meta: PartMeta       (title, family, manufacturer, mpn, package, tags, etc.)
  ├── connectors: Connector[]  (pins/pads with terminal positions per view)
  ├── buses: Bus[]          (bus definitions with member pins)
  ├── views: PartViews      (breadboard, schematic, pcb)
  │   └── [view]: { shapes: Shape[] }
  └── constraints: Constraint[]
```

**Shape variants** (all extend `BaseShape: { id, x, y, width, height, rotation, style }`):
- `RectShape` — filled/stroked rectangle
- `CircleShape` — circle with `cx, cy`
- `EllipseShape` — ellipse with `cx, cy, rx, ry`
- `PathShape` — SVG path data
- `TextShape` — text with `text, fontSize, fontFamily, textAnchor`
- `LineShape` — line segment
- `PolygonShape` — closed polygon
- `ArcShape` — arc segment

**Connector types**: `pad`, `pin`, `hole`, `smd`, `npth`

### DRC Engine (`shared/drc-engine.ts`)

The `runDRC(partState, rules, view)` function checks:
- `min-clearance` — Minimum spacing between pads
- `min-trace-width` — Minimum trace width
- `courtyard-overlap` — Courtyard keepout violations
- `pin-spacing` — Minimum pin pitch
- `pad-size` — Pad dimension constraints
- `silk-overlap` — Silkscreen overlap with pads

Standard rule templates are in `shared/drc-templates.ts`.

### DRC Templates (`shared/drc-templates.ts`)

Pre-built rule sets for common fabrication processes (e.g., JLCPCB standard, OSH Park, etc.).

### FZPZ Import/Export (`server/component-export.ts`)

Reads/writes Fritzing FZPZ archives (ZIP containing `*.fzp` XML + SVG view files). Translates between Fritzing's part format and ProtoPulse's `PartState` representation.

---

## 10. Security Model

### Authentication Flow

1. Client registers/logs in → receives `sessionId` (UUID)
2. All subsequent requests include `X-Session-Id: <sessionId>` header
3. Session middleware validates UUID against `sessions` table, checks `expiresAt`, populates `req.userId`
4. Sessions expire after 7 days

### Password Hashing

scrypt with salt (Node.js `crypto.scrypt`). Stored as `<salt>:<hash>` in `password_hash` column.

### API Key Encryption

Stored API keys (Gemini) are encrypted with AES-256-GCM using `API_KEY_ENCRYPTION_KEY` env var. The encrypted key and IV are stored separately in `api_keys`. Keys are decrypted in-memory only when needed for AI requests.

**Critical**: If `API_KEY_ENCRYPTION_KEY` is not set in production, a random key is generated per boot, making previously stored API keys unrecoverable after restart.

### Known Security Findings (P0 — see `docs/product-analysis-checklist.md`)

- **CAPX-SEC-01**: CORS dynamic origin reflection — needs allowlist
- **CAPX-SEC-02**: XSS via `javascript:` URIs in AI markdown — needs protocol validation
- **CAPX-SEC-03**: ZIP bomb vulnerability in FZPZ import — needs decompressed size check
- **CAPX-SEC-04**: Missing `process.on('uncaughtException')` handler

### Rate Limiting

- **Global**: 300 requests per 15-minute window (express-rate-limit)
- **Auth endpoints**: 10 requests per 15-minute window
- **SSE stream**: 20 requests per minute per IP (custom sliding window)

### Content Security Policy

Helmet sets a strict CSP via middleware. XSS-unsafe patterns in AI-rendered markdown should use sanitized renderers.

---

## 11. Development Workflow

### Type Checking

```bash
npm run check          # Must pass with zero errors after every change
```

TypeScript strict mode (`strict: true`, no exceptions). Errors are errors — never dismiss as pre-existing.

### Testing

**Framework**: Vitest 4 with workspace projects (`vitest.config.ts`).

```bash
npm test               # All 54 test files, ~1553 tests
npm run test:watch     # Interactive watch mode
npm run test:coverage  # v8 coverage report → coverage/
npx vitest run --project server   # Server tests (node env)
npx vitest run --project client   # Client tests (happy-dom env)
npx vitest run path/to/file.test.ts  # Single file
npx vitest run -t "test name"        # By test name pattern
```

**Test locations**:
- `server/__tests__/` — 28 files: API, auth, storage, exporters (Eagle, KiCad, SPICE, Gerber), generators, DRC gate, LRU cache, metrics, audit-log, circuit-breaker, stream-abuse, admin-purge, etc.
- `client/src/lib/__tests__/` — Utility tests
- `client/src/lib/contexts/__tests__/` — Context tests (architecture, BOM, chat, history)
- `client/src/lib/circuit-editor/__tests__/` — Wire router, ERC engine
- `client/src/lib/simulation/__tests__/` — SPICE generator, circuit solver
- `client/src/lib/component-editor/__tests__/` — Constraint solver, diff engine, snap engine
- `client/src/components/panels/__tests__/` — ChatPanel tests
- `client/src/components/layout/__tests__/` — Sidebar tests
- `client/src/components/views/__tests__/` — View tests
- `shared/__tests__/` — Schema validation, DRC engine, BOM diff, netlist diff

**Note**: `server/__tests__/api.test.ts` uses Node.js `node:test` runner (not Vitest) and is excluded from `npm test`.

**Testing Philosophy**: When tests fail, fix the code, not the test. Tests reveal bugs.

### Linting and Formatting

```bash
npx eslint .           # ESLint strict (no errors expected)
npx prettier --write . # Prettier formatting
```

ESLint uses flat config (`eslint.config.js`) with `strictTypeChecked` + `stylisticTypeChecked`. `@typescript-eslint/no-explicit-any` is an error. Consistent type imports enforced.

---

## 12. Code Conventions & Patterns

### Vertical Slice Development

Always implement top-to-bottom:
1. Types/schema in `shared/schema.ts`
2. Storage methods in `server/storage.ts` (implement `IStorage`)
3. API routes in `server/routes/` (Zod validation, asyncHandler)
4. React Query hooks in `client/src/lib/project-context.tsx`
5. UI components in `client/src/components/`
6. Add `data-testid` to every interactive and display element

### Error Handling

**Server:**
```typescript
// asyncHandler wraps route handlers, catching thrown errors
app.get('/path', asyncHandler(async (req, res) => {
  throw new HttpError('Not found', 404);
}));
```

**Client:**
- React Query global `onError` with `toast.error()` (sonner)
- `ErrorBoundary` around each view in `ProjectWorkspace`
- `fromZodError()` for user-friendly Zod messages

### Node IDs

Always use `crypto.randomUUID()`, never `Date.now()`.

### Response Envelopes

- `GET` list endpoints: `{ data: T[], total: number }`
- `POST` create: `201` with created object
- `PATCH/PUT` update: `200` with updated object
- `DELETE`: `204 No Content` (routes.ts) — Note: circuit-routes.ts inconsistently returns `{ success: true }` in some places (known debt GA-API-03)

### Import Order (ESLint enforced)

1. React/framework
2. Third-party libraries
3. Internal path aliases (`@/`, `@shared/`)
4. Relative imports
5. Type-only imports (via `import type`)

### TypeScript Patterns

- **No `as any`** — Use proper type narrowing, generics, or discriminated unions
- **Exhaustive switches** — On discriminated unions, extract shared base properties before the switch to avoid `never` type issues in the default case (see `BaseShape` pattern)
- **Zod for API boundaries** — `schema.safeParse(req.body)` on all route handlers
- **`import type`** — Required for type-only imports (ESLint enforced)

---

## 13. Known Issues & Technical Debt

### Architecture Debt

| ID | Description | Impact |
|---|---|---|
| GA-DB-01 | AI system prompt rebuilds full project state on every request (O(N) sequential queries) | High latency on large projects |
| GA-CTX-01 | `ProjectProvider` is monolithic (40+ state values) — needs domain splitting | Unnecessary re-renders |
| GA-PRJ-01 | `PROJECT_ID = 1` hardcoded in `project-context.tsx` — blocks multi-project support | No multi-project |
| GA-API-03 | Response envelope inconsistency: DELETEs return 204 in routes.ts but `{ success: true }` in circuit-routes.ts | Client confusion |
| GA-API-04 | No API versioning — all routes at `/api/*` with no version prefix | Breaking change risk |
| GA-DEP-01 | Deprecated endpoints `/api/bom/:id` and `/api/validation/:id` still exist | Client must use `/api/projects/:id/bom/:bomId` |

### Security Findings (P0)

See `docs/product-analysis-checklist.md` for full list. Key items:
- CORS dynamic origin reflection
- XSS via `javascript:` URIs in AI-rendered markdown
- ZIP bomb risk in FZPZ import (no decompressed size check)
- Missing global uncaught exception handler

### Performance Notes

- LRU cache: evicts least-recently-used. Prefix-based invalidation (`"nodes:1"` clears all `"nodes:1*"` keys).
- Simulation results: auto-cleanup keeps max 5 per circuit.
- Stream responses: backpressure-aware (`drain` event handling), 30s drain timeout.

---

## 14. Roadmap / Phase Plan

All phases shipped as of 2026-03-02:

| Phase | Description | Status |
|---|---|---|
| 1 | Architecture block diagram editor (React Flow, BOM, validation) | Shipped |
| 2 | Component editor (SVG canvas, multi-view, DRC) | Shipped |
| 3 | Auth system (sessions, API key management) | Shipped |
| 4 | AI chat with vision, multi-model routing, action parser | Shipped |
| 5 | AI action history, Phase 5 tools (50+ action types) | Shipped |
| 6 | Export expansion (KiCad, Eagle, SPICE, Gerber, pick-place, BOM, netlist) | Shipped |
| 7 | SPICE model library, BOM snapshots, design preferences | Shipped |
| 8 | Component lifecycle tracking, chat branches, project I/O | Shipped |
| 9 | Batch analysis (Genkit Queues), metrics, admin | Shipped |
| 10 | Circuit schematic editor (canvas, instances, nets, wires) | Shipped |
| 11 | Breadboard + PCB views, ERC engine, net classes | Shipped |
| 12 | Simulation (SPICE netlist generation + solver, power analysis, signal integrity) | Shipped |
| 13 | Firmware scaffold generator, PDF design report, FMEA, FZZ export | Shipped |
| Future | Multi-project support, `ProjectProvider` splitting, CORS allowlist, real-time collaboration | Planned |
