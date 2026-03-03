# ProtoPulse — Developer Documentation

> **Last updated:** 2026-02-17  
> **Codebase:** ~18,300 lines of TypeScript  
> **Stack:** React 19 · TypeScript · Vite 7 · Express 5 · PostgreSQL · Drizzle ORM · TanStack React Query · shadcn/ui · @xyflow/react · Tailwind CSS v4

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
- PostgreSQL (auto-provisioned on Replit)

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
| `DATABASE_URL` | Yes | *(auto on Replit)* | PostgreSQL connection string |
| `API_KEY_ENCRYPTION_KEY` | Prod only | Random per-boot | 32-byte hex string for AES-256-GCM encryption of stored API keys |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |
| `NODE_ENV` | No | `development` | `development` \| `production` |
| `PORT` | No | `5000` | Server listen port |

### NPM Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `NODE_ENV=development tsx server/index.ts` | Start dev server with Vite HMR |
| `npm run build` | `tsx script/build.ts` | Production build (esbuild backend + Vite frontend) |
| `npm run start` | `NODE_ENV=production node dist/index.cjs` | Run production server |
| `npm run check` | `tsc` | TypeScript type checking |
| `npm run db:push` | `drizzle-kit push` | Sync Drizzle schema to PostgreSQL |

---

## 2. Architecture Overview

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                   │
│                                                                     │
│  ┌──────────┐  ┌────────────────────────────┐  ┌────────────────┐  │
│  │ Sidebar  │  │       Main Views           │  │   ChatPanel    │  │
│  │          │  │                            │  │                │  │
│  │ • Nav    │  │  Architecture (React Flow) │  │  • AI Chat     │  │
│  │ • Tree   │  │  Component Editor (SVG)    │  │  • Settings    │  │
│  │ • History│  │  Procurement (BOM Table)   │  │  • Streaming   │  │
│  │          │  │  Validation (DRC)          │  │  • Actions     │  │
│  │          │  │  Output (Logs)             │  │                │  │
│  └──────────┘  └────────────────────────────┘  └────────────────┘  │
│       │                    │                          │             │
│       └────────────────────┼──────────────────────────┘             │
│                            │                                        │
│                    ProjectProvider Context                           │
│                    (React Query + State)                             │
└────────────────────────────┼────────────────────────────────────────┘
                             │ HTTP / SSE
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Express 5 Server (:5000)                       │
│                                                                     │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │ Helmet  │  │Compress  │  │Rate Limit│  │  Session Auth       │ │
│  │ (CSP)   │  │(gzip)    │  │(300/15m) │  │  (X-Session-Id)     │ │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └────────┬────────────┘ │
│       └─────────────┴─────────────┴─────────────────┘              │
│                             │                                       │
│       ┌─────────────────────┼─────────────────────────┐            │
│       │                     │                         │            │
│       ▼                     ▼                         ▼            │
│  ┌─────────┐         ┌──────────┐              ┌──────────┐       │
│  │ Routes  │         │ AI Engine│              │  Auth    │       │
│  │ (REST)  │         │ Anthropic│              │ scrypt   │       │
│  │ Zod     │         │ Gemini   │              │ AES-GCM  │       │
│  └────┬────┘         │ SSE      │              └──────────┘       │
│       │              └──────────┘                                  │
│       ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Storage Layer (IStorage interface)              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │   │
│  │  │   Drizzle   │  │ SimpleCache │  │ Chunked Inserts  │  │   │
│  │  │   ORM       │  │ (200/60s)   │  │ (100 per batch)  │  │   │
│  │  └──────┬──────┘  └─────────────┘  └───────────────────┘  │   │
│  └─────────┼──────────────────────────────────────────────────┘   │
│            │                                                       │
└────────────┼───────────────────────────────────────────────────────┘
             ▼
      ┌──────────────┐
      │  PostgreSQL   │
      │  (Neon)       │
      │  11 tables    │
      └──────────────┘
```

### Request Lifecycle

```
Client Request
  │
  ├─ Helmet (security headers)
  ├─ Compression (gzip)
  ├─ Request ID (UUID → X-Request-Id)
  ├─ API Version Header (X-API-Version: 1)
  ├─ Rate Limiter (300 req / 15 min window)
  ├─ JSON Body Parser (1MB limit)
  ├─ CSRF Check (Origin vs Host)
  ├─ Request Timeout (30s)
  ├─ Session Auth Middleware (validates X-Session-Id header)
  ├─ Request Logger + Metrics
  ├─ Route Handler (Zod validation → Storage → Response)
  └─ Error Handler (status-aware, sanitized messages)
```

---

## 3. Directory Structure

```
.
├── client/                          # Frontend (React + Vite)
│   ├── index.html                   # SPA entry, OG meta tags
│   ├── public/                      # Static assets (favicon, OG images)
│   └── src/
│       ├── main.tsx                 # ReactDOM.createRoot entry
│       ├── App.tsx                  # Root: ThemeProvider > QueryClientProvider > TooltipProvider > Router > Toaster
│       ├── index.css                # Tailwind v4 imports, CSS variables, theme tokens
│       ├── pages/
│       │   ├── ProjectWorkspace.tsx # Main workspace: 3-panel layout with resizable dividers
│       │   └── not-found.tsx        # 404 page
│       ├── components/
│       │   ├── ErrorBoundary.tsx    # React error boundary with fallback UI
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx      # 832 lines — project nav, component library tree, history panel
│       │   │   └── sidebar/         # Sidebar sub-components (ComponentTree, HistoryList, SheetList)
│       │   ├── panels/
│       │   │   ├── ChatPanel.tsx    # 2363 lines — AI chat, settings, streaming, action parsing/execution
│       │   │   ├── AssetManager.tsx # Asset management panel
│       │   │   ├── chat/           # Chat sub-components (MessageBubble, SettingsPanel, constants)
│       │   │   └── asset-manager/  # Asset manager sub-components
│       │   ├── views/
│       │   │   ├── ArchitectureView.tsx     # React Flow canvas for block diagrams
│       │   │   ├── ComponentEditorView.tsx  # Phase 2: SVG component editor with 5 sub-views
│       │   │   ├── CustomNode.tsx           # Custom React Flow node renderer
│       │   │   ├── ProcurementView.tsx      # BOM table with filtering, export, stock status
│       │   │   ├── ValidationView.tsx       # DRC results with "Mark Resolved" actions
│       │   │   ├── OutputView.tsx           # System log viewer with filters (memoized)
│       │   │   ├── SchematicView.tsx        # Schematic viewer with pan/zoom SVG
│       │   │   ├── component-editor/       # ShapeCanvas (interactive SVG), PinTable
│       │   │   └── schematic/              # Schematic demo data
│       │   └── ui/                  # 50+ shadcn/ui components (button, dialog, table, etc.)
│       ├── lib/
│       │   ├── project-context.tsx  # 635 lines — ProjectProvider with 40+ state values, React Query mutations
│       │   ├── queryClient.ts       # TanStack Query config, apiRequest() helper, 5min staleTime
│       │   ├── clipboard.ts         # Clipboard utility with textarea fallback
│       │   ├── context-selectors.ts # Context optimization helpers
│       │   ├── types.ts             # Shared frontend type definitions
│       │   ├── utils.ts             # cn() utility (clsx + tailwind-merge)
│       │   └── component-editor/   # ComponentEditorProvider, hooks, types
│       └── hooks/
│           ├── use-toast.ts         # Toast notification hook
│           └── use-mobile.tsx       # Mobile breakpoint detection hook
│
├── server/                          # Backend (Express 5)
│   ├── index.ts                     # App bootstrap, middleware stack, graceful shutdown
│   ├── routes.ts                    # ~765 lines — all REST endpoints, Zod validation, seed data
│   ├── ai.ts                        # AI engine: Anthropic + Gemini, streaming, action parser, error categorization
│   ├── auth.ts                      # Session auth: scrypt hashing, UUID sessions, AES-256-GCM key encryption
│   ├── storage.ts                   # 560 lines — IStorage interface + DatabaseStorage, pagination, soft deletes, cache
│   ├── cache.ts                     # SimpleCache: in-memory TTL cache (200 entries, 60s TTL)
│   ├── logger.ts                    # Structured JSON logger (4 levels)
│   ├── metrics.ts                   # Route-level request metrics (count, avg latency, errors)
│   ├── api-docs.ts                  # Self-documenting API endpoint definitions
│   ├── db.ts                        # PostgreSQL connection pool (pg)
│   ├── env.ts                       # Environment variable validation
│   ├── static.ts                    # Production static file serving
│   ├── vite.ts                      # Vite dev server integration
│   └── __tests__/
│       └── api.test.ts              # API endpoint tests
│
├── shared/                          # Shared between client and server
│   ├── schema.ts                    # 200 lines — Drizzle ORM schema (11 tables), Zod insert schemas, TypeScript types
│   └── component-types.ts          # 178 lines — Component editor types (shapes, connectors, buses, DRC)
│
├── docs/                            # Documentation
├── script/
│   └── build.ts                     # Production build script (esbuild + Vite)
├── drizzle.config.ts                # Drizzle Kit configuration
├── vite.config.ts                   # Vite configuration with plugins
├── tsconfig.json                    # TypeScript configuration
├── components.json                  # shadcn/ui configuration
├── postcss.config.js                # PostCSS configuration
└── package.json                     # Dependencies and scripts
```

---

## 4. Database Schema

### Entity Relationship Diagram

```
┌───────────────┐
│    users       │
│───────────────│
│ id (PK)       │──┐
│ username (UQ) │  │
│ passwordHash  │  │
│ createdAt     │  │
└───────────────┘  │
                   │ 1:N
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
┌───────────────┐  ┌───────────────┐
│   sessions    │  │   api_keys    │
│───────────────│  │───────────────│
│ id (PK, UUID) │  │ id (PK)       │
│ userId (FK)   │  │ userId (FK)   │
│ expiresAt     │  │ provider      │
│ createdAt     │  │ encryptedKey  │
└───────────────┘  │ iv            │
                   │ createdAt     │
                   └───────────────┘

┌──────────────────┐
│     projects      │
│──────────────────│
│ id (PK)          │──────────────────────────────────────┐
│ name             │                                       │
│ description      │           1:N (all cascade)           │
│ createdAt        │                                       │
│ updatedAt        │    ┌──────────┬──────────┬───────┬───┤
│ deletedAt (soft) │    │          │          │       │   │
└──────────────────┘    │          │          │       │   │
                        ▼          ▼          ▼       │   │
          ┌────────────────┐ ┌──────────┐ ┌────────┐  │   │
          │ architecture   │ │ bom      │ │validate│  │   │
          │ _nodes         │ │ _items   │ │_issues │  │   │
          │────────────────│ │──────────│ │────────│  │   │
          │ id (PK)        │ │ id (PK)  │ │ id(PK) │  │   │
          │ projectId (FK) │ │ projId   │ │ projId │  │   │
          │ nodeId (UQ/pr) │ │ partNum  │ │severity│  │   │
          │ nodeType       │ │ mfr      │ │message │  │   │
          │ label          │ │ desc     │ │compId  │  │   │
          │ positionX/Y    │ │ qty      │ │suggest │  │   │
          │ data (jsonb)   │ │ price    │ └────────┘  │   │
          │ updatedAt      │ │ supplier │             │   │
          │ deletedAt      │ │ stock    │             │   │
          └────────────────┘ │ status   │             │   │
                             │ leadTime │             │   │
          ┌────────────────┐ │ deleteAt │             │   │
          │ architecture   │ └──────────┘             │   │
          │ _edges         │                          │   │
          │────────────────│    ┌───────────────┐     │   │
          │ id (PK)        │    │ chat_messages  │◄────┘   │
          │ projectId (FK) │    │───────────────│         │
          │ edgeId (UQ/pr) │    │ id (PK)       │         │
          │ source         │    │ projectId (FK)│         │
          │ target         │    │ role          │         │
          │ label          │    │ content       │         │
          │ animated       │    │ timestamp     │         │
          │ style (jsonb)  │    │ mode          │         │
          │ signalType     │    └───────────────┘         │
          │ voltage        │                              │
          │ busWidth       │    ┌───────────────┐         │
          │ netName        │    │ history_items  │◄────────┤
          │ deletedAt      │    │───────────────│         │
          └────────────────┘    │ id (PK)       │         │
                                │ projectId (FK)│         │
                                │ action        │         │
                                │ user          │         │
                                │ timestamp     │         │
                                └───────────────┘         │
                                                          │
                                ┌───────────────┐         │
                                │component_parts│◄────────┘
                                │───────────────│
                                │ id (PK)       │
                                │ projectId (FK)│
                                │ nodeId        │
                                │ meta (jsonb)  │
                                │ connectors    │
                                │ buses (jsonb) │
                                │ views (jsonb) │
                                │ constraints   │
                                │ version       │
                                │ createdAt     │
                                │ updatedAt     │
                                └───────────────┘
```

### Table Details

#### `projects`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | Auto-increment |
| `name` | `text` | NOT NULL | Project display name |
| `description` | `text` | DEFAULT `''` | |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | Updated on mutation |
| `deleted_at` | `timestamp` | NULLABLE | Soft delete marker |

#### `architecture_nodes`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `node_id` | `text` | NOT NULL, UNIQUE(project_id, node_id) | Client-generated ID |
| `node_type` | `text` | NOT NULL | `mcu`, `sensor`, `power`, `comm`, `connector`, `memory`, `actuator`, `ic`, `passive`, `module`, or custom |
| `label` | `text` | NOT NULL | Display name |
| `position_x` | `real` | NOT NULL | Canvas X coordinate |
| `position_y` | `real` | NOT NULL | Canvas Y coordinate |
| `data` | `jsonb` | NULLABLE | Arbitrary metadata (e.g., `{ description: "..." }`) |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW | |
| `deleted_at` | `timestamp` | NULLABLE | Soft delete |

**Indexes:** `idx_arch_nodes_project` on `project_id`, unique `uq_arch_nodes_project_node` on `(project_id, node_id)`.

#### `architecture_edges`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `edge_id` | `text` | NOT NULL, UNIQUE(project_id, edge_id) | Client-generated ID |
| `source` | `text` | NOT NULL | Source node_id |
| `target` | `text` | NOT NULL | Target node_id |
| `label` | `text` | NULLABLE | Edge label (e.g., "SPI Bus") |
| `animated` | `boolean` | DEFAULT false | React Flow animation |
| `style` | `jsonb` | NULLABLE | `{ stroke?: string }` |
| `signal_type` | `text` | NULLABLE | SPI, I2C, UART, analog, etc. |
| `voltage` | `text` | NULLABLE | e.g., "3.3V" |
| `bus_width` | `text` | NULLABLE | e.g., "4-bit" |
| `net_name` | `text` | NULLABLE | Named net |
| `deleted_at` | `timestamp` | NULLABLE | Soft delete |

**Indexes:** `idx_arch_edges_project`, unique `uq_arch_edges_project_edge`.

#### `bom_items`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | |
| `project_id` | `integer` | FK → projects.id CASCADE | |
| `part_number` | `text` | NOT NULL | e.g., "ESP32-S3-WROOM-1" |
| `manufacturer` | `text` | NOT NULL | |
| `description` | `text` | NOT NULL | |
| `quantity` | `integer` | NOT NULL, DEFAULT 1 | |
| `unit_price` | `numeric(10,4)` | NOT NULL | |
| `total_price` | `numeric(10,4)` | NOT NULL | Auto-computed: qty × unit_price |
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

**Indexes:** `idx_chat_messages_project`, `idx_chat_messages_project_ts` (project_id, timestamp).

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
| `provider` | `text` | NOT NULL | `anthropic` or `gemini` |
| `encrypted_key` | `text` | NOT NULL | AES-256-GCM encrypted |
| `iv` | `text` | NOT NULL | Initialization vector (hex) |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW | |

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

**Indexes:** `idx_component_parts_project`, `idx_component_parts_node`.

### Soft Delete Strategy

Projects, architecture nodes, architecture edges, and BOM items use soft deletes via a `deleted_at` timestamp column. All read queries filter with `WHERE deleted_at IS NULL`. When a project is deleted, its child nodes, edges, and BOM items are also soft-deleted in cascade.

Chat messages, history items, and validation issues use hard deletes.

---

## 5. Complete API Reference

### Authentication

All endpoints under `/api/` require authentication via the `X-Session-Id` header, except:
- `/api/auth/*` — Auth endpoints
- `/api/health` — Health check
- `/api/docs` — API documentation
- `/api/metrics` — Server metrics
- `/api/seed` — Demo seed (dev only)

In development mode (`NODE_ENV=development`), auth is relaxed and requests without a session are allowed through.

### Pagination

All list endpoints support these query parameters:

| Parameter | Type | Default | Range |
|---|---|---|---|
| `limit` | integer | 50 | 1–100 |
| `offset` | integer | 0 | 0+ |
| `sort` | string | `desc` | `asc` \| `desc` |

### Error Responses

All error responses follow this shape:
```json
{ "message": "Human-readable error description" }
```

| Status | Meaning |
|---|---|
| 400 | Validation error (Zod) or bad request |
| 401 | Missing or invalid session |
| 403 | CSRF origin mismatch |
| 404 | Resource not found |
| 408 | Request timeout (30s) |
| 409 | Conflict (e.g., username taken) |
| 413 | Payload too large |
| 429 | Rate limited |
| 500 | Internal server error (message sanitized) |

---

### Auth Endpoints

#### `POST /api/auth/register`
Register a new user account.

- **Payload limit:** 4KB
- **Auth required:** No

```
Request:
{
  "username": string,  // 3-50 chars, /^[a-zA-Z0-9_-]+$/
  "password": string   // 6-128 chars
}

Response (201):
{
  "sessionId": "uuid-string",
  "user": { "id": 1, "username": "alice" }
}

Errors:
  409 — Username already taken
  400 — Validation error
```

#### `POST /api/auth/login`
Authenticate with credentials.

- **Payload limit:** 4KB
- **Auth required:** No

```
Request:
{
  "username": string,
  "password": string
}

Response (200):
{
  "sessionId": "uuid-string",
  "user": { "id": 1, "username": "alice" }
}

Errors:
  401 — Invalid credentials
```

#### `POST /api/auth/logout`
Invalidate the current session.

- **Auth required:** No (best-effort with X-Session-Id)

```
Response: 204 No Content
```

#### `GET /api/auth/me`
Get the current authenticated user.

- **Auth required:** Yes (X-Session-Id)

```
Response (200):
{ "id": 1, "username": "alice" }

Errors:
  401 — Not authenticated / Invalid session
```

---

### API Key Management

#### `GET /api/settings/api-keys`
List which AI providers have stored API keys.

- **Auth required:** Yes

```
Response (200):
{ "providers": ["anthropic", "gemini"] }
```

#### `POST /api/settings/api-keys`
Store an API key for an AI provider.

- **Payload limit:** 4KB
- **Auth required:** Yes

```
Request:
{
  "provider": "anthropic" | "gemini",
  "apiKey": string  // 1-500 chars
}

Response (200):
{ "message": "API key stored" }
```

#### `DELETE /api/settings/api-keys/:provider`
Delete a stored API key.

- **Auth required:** Yes
- **Params:** `provider` — `anthropic` or `gemini`

```
Response: 204 No Content
Errors:
  404 — No API key found for this provider
```

---

### Project Endpoints

#### `GET /api/projects`
List all projects (non-deleted).

- **Auth required:** Yes
- **Pagination:** Yes

```
Response (200): Project[]
[
  {
    "id": 1,
    "name": "Smart_Agro_Node_v1",
    "description": "IoT Agriculture Sensor Node",
    "createdAt": "2026-01-15T...",
    "updatedAt": "2026-01-15T...",
    "deletedAt": null
  }
]
```

#### `GET /api/projects/:id`
Get a single project by ID.

```
Response (200): Project
Errors:
  404 — Project not found
```

#### `POST /api/projects`
Create a new project.

- **Payload limit:** 32KB

```
Request:
{
  "name": string,        // required
  "description"?: string
}

Response (201): Project
```

#### `PATCH /api/projects/:id`
Update a project.

- **Payload limit:** 32KB

```
Request: Partial<{ name: string, description: string }>

Response (200): Project
Errors:
  400 — Empty name
  404 — Project not found
```

#### `DELETE /api/projects/:id`
Soft-delete a project and cascade to nodes, edges, BOM items.

```
Response: 204 No Content
Errors:
  404 — Project not found
```

---

### Architecture Node Endpoints

#### `GET /api/projects/:id/nodes`
List all non-deleted nodes for a project.

- **Pagination:** Yes

```
Response (200): ArchitectureNode[]
[
  {
    "id": 1,
    "projectId": 1,
    "nodeId": "1",
    "nodeType": "mcu",
    "label": "ESP32-S3-WROOM-1",
    "positionX": 400,
    "positionY": 100,
    "data": { "description": "Dual-core MCU, Wi-Fi/BLE" },
    "updatedAt": "...",
    "deletedAt": null
  }
]
```

#### `POST /api/projects/:id/nodes`
Create a single node.

- **Payload limit:** 32KB

```
Request:
{
  "nodeId": string,
  "nodeType": string,   // 1-100 chars
  "label": string,
  "positionX": number,
  "positionY": number,
  "data"?: { description?: string, ... } | null
}

Response (201): ArchitectureNode
```

#### `PUT /api/projects/:id/nodes`
Replace ALL nodes for a project (atomic). Deletes existing nodes first.

- **Payload limit:** 512KB

```
Request: Array of node objects (same shape as POST, without projectId)
Response (200): ArchitectureNode[]
```

#### `PATCH /api/projects/:id/nodes/:nodeId`
Update a specific node.

- **Payload limit:** 32KB
- **Params:** `nodeId` is the database `id` (integer), not the `node_id` text field

```
Request: Partial node fields
Response (200): ArchitectureNode
Errors:
  404 — Node not found
```

---

### Architecture Edge Endpoints

#### `GET /api/projects/:id/edges`
List all non-deleted edges for a project.

- **Pagination:** Yes

```
Response (200): ArchitectureEdge[]
```

#### `POST /api/projects/:id/edges`
Create a single edge.

- **Payload limit:** 32KB

```
Request:
{
  "edgeId": string,
  "source": string,     // source node_id
  "target": string,     // target node_id
  "label"?: string,
  "animated"?: boolean,
  "style"?: { stroke?: string },
  "signalType"?: string,
  "voltage"?: string,
  "busWidth"?: string,
  "netName"?: string
}

Response (201): ArchitectureEdge
```

#### `PUT /api/projects/:id/edges`
Replace ALL edges for a project (atomic).

- **Payload limit:** 512KB

```
Request: Array of edge objects
Response (200): ArchitectureEdge[]
```

#### `PATCH /api/projects/:id/edges/:edgeId`
Update a specific edge.

- **Payload limit:** 32KB

```
Request: Partial edge fields
Response (200): ArchitectureEdge
```

---

### BOM Item Endpoints

#### `GET /api/projects/:id/bom`
List all BOM items for a project.

- **Pagination:** Yes

#### `GET /api/projects/:id/bom/:bomId`
Get a single BOM item.

#### `POST /api/projects/:id/bom`
Create a BOM item. `totalPrice` is auto-computed from `quantity × unitPrice`.

- **Payload limit:** 32KB

```
Request:
{
  "partNumber": string,
  "manufacturer": string,
  "description": string,
  "quantity"?: number,        // default: 1
  "unitPrice": string,       // numeric string
  "supplier": string,
  "stock"?: number,           // default: 0
  "status"?: "In Stock" | "Low Stock" | "Out of Stock" | "On Order",
  "leadTime"?: string
}

Response (201): BomItem
```

#### `PATCH /api/projects/:id/bom/:bomId`
Update a BOM item. Recalculates `totalPrice` if quantity or unitPrice changes.

#### `DELETE /api/projects/:id/bom/:bomId`
Soft-delete a BOM item.

---

### Validation Issue Endpoints

#### `GET /api/projects/:id/validation`
List validation issues.

- **Pagination:** Yes

#### `POST /api/projects/:id/validation`
Create a validation issue.

- **Payload limit:** 32KB

```
Request:
{
  "severity": "error" | "warning" | "info",
  "message": string,
  "componentId"?: string,
  "suggestion"?: string
}

Response (201): ValidationIssue
```

#### `PUT /api/projects/:id/validation`
Replace ALL validation issues for a project (atomic).

- **Payload limit:** 512KB

```
Request: Array of validation issue objects
Response (200): ValidationIssue[]
```

#### `DELETE /api/projects/:id/validation/:issueId`
Hard-delete a specific validation issue.

---

### Chat Message Endpoints

#### `GET /api/projects/:id/chat`
List chat messages, ordered by timestamp.

- **Pagination:** Yes

#### `POST /api/projects/:id/chat`
Save a chat message.

- **Payload limit:** 32KB

```
Request:
{
  "role": "user" | "assistant" | "system",
  "content": string,
  "mode"?: string   // default: "chat"
}

Response (201): ChatMessage
```

#### `DELETE /api/projects/:id/chat`
Delete ALL chat messages for a project.

#### `DELETE /api/projects/:id/chat/:msgId`
Delete a specific chat message.

---

### History Item Endpoints

#### `GET /api/projects/:id/history`
List project history items.

- **Pagination:** Yes

#### `POST /api/projects/:id/history`
Create a history entry.

- **Payload limit:** 32KB

```
Request:
{
  "action": string,
  "user": string    // "User" or "AI"
}

Response (201): HistoryItem
```

#### `DELETE /api/projects/:id/history`
Delete all history for a project.

#### `DELETE /api/projects/:id/history/:itemId`
Delete a specific history item.

---

### Component Parts Endpoints

#### `GET /api/projects/:projectId/component-parts`
List all component parts for a project.

#### `GET /api/projects/:projectId/component-parts/by-node/:nodeId`
Get a component part by its linked architecture node ID.

#### `GET /api/projects/:projectId/component-parts/:id`
Get a specific component part by database ID.

#### `POST /api/projects/:projectId/component-parts`
Create a new component part.

```
Request:
{
  "projectId": number,
  "nodeId"?: string,
  "meta"?: PartMeta,           // jsonb
  "connectors"?: Connector[],  // jsonb
  "buses"?: Bus[],             // jsonb
  "views"?: PartViews,         // jsonb
  "constraints"?: Constraint[] // jsonb
}

Response (201): ComponentPart
```

#### `PATCH /api/projects/:projectId/component-parts/:id`
Update a component part. Auto-increments `version`.

#### `DELETE /api/projects/:projectId/component-parts/:id`
Hard-delete a component part.

---

### AI Chat Endpoints

#### `POST /api/chat/ai`
Send a message to the AI and receive a complete response.

- **Payload limit:** 32KB

```
Request:
{
  "message": string,         // 1-32000 chars
  "provider": "anthropic" | "gemini",
  "model": string,           // e.g., "claude-sonnet-4-20250514"
  "apiKey"?: string,         // optional, uses stored key if omitted
  "projectId": number,
  "activeView"?: string,
  "schematicSheets"?: Array<{ id: string, name: string }>,
  "activeSheetId"?: string,
  "temperature"?: number,    // 0-2
  "maxTokens"?: number,      // 256-16384
  "customSystemPrompt"?: string,  // max 10000 chars
  "selectedNodeId"?: string | null,
  "changeDiff"?: string      // max 50000 chars
}

Response (200):
{
  "message": "AI response text...",
  "actions": [
    { "type": "add_node", "nodeType": "mcu", "label": "STM32", ... },
    ...
  ]
}
```

#### `POST /api/chat/ai/stream`
Send a message and receive streaming SSE response.

- **Payload limit:** 32KB
- **Exempt from:** Rate limiting, request timeout, CSRF check
- **Content-Type:** `text/event-stream`

```
SSE Events:
  data: {"token": "partial text..."}
  data: {"token": "more text..."}
  data: [DONE]

The complete response is accumulated client-side and parsed for actions.
```

---

### System Endpoints

#### `GET /api/health`
Health check with database connectivity test.

- **Auth required:** No

```
Response (200): { "status": "ok", "timestamp": "..." }
Response (503): { "status": "unhealthy", "timestamp": "..." }
```

#### `GET /api/metrics`
Server request metrics.

- **Auth required:** No

```
Response (200):
{
  "uptimeSeconds": 3600,
  "routes": {
    "GET /api/projects": { "count": 150, "avgMs": 12, "errors": 0 },
    ...
  }
}
```

#### `GET /api/docs`
Self-documenting API endpoint list.

- **Auth required:** No

```
Response (200):
{
  "version": 1,
  "routes": [
    { "method": "POST", "path": "/api/auth/register", "description": "...", ... },
    ...
  ]
}
```

#### `POST /api/seed`
Seed a demo project with nodes, edges, BOM items, and validation issues. Idempotent — skips if project ID 1 already exists.

- **Auth required:** No
- **Environment:** Called automatically by the frontend on mount

---

## 6. AI System Deep Dive

### Overview

The AI system (`server/ai.ts`) provides an intelligent electronics design assistant that understands the current project state and can execute actions to modify the design. It supports two providers (Anthropic Claude, Google Gemini) with both synchronous and streaming interfaces.

### Provider Support

| Provider | SDK | Streaming | Models |
|---|---|---|---|
| Anthropic | `@anthropic-ai/sdk` | Yes (SSE chunks) | claude-sonnet-4-20250514, etc. |
| Google Gemini | `@google/genai` | Yes (sendMessageStream) | gemini-2.5-flash, etc. |

### LRU Client Cache

API clients are cached in an LRU cache (max 10 entries) keyed by API key to avoid re-instantiation:

```typescript
const anthropicClients = new LRUClientCache<Anthropic>(10);
const geminiClients = new LRUClientCache<GoogleGenerativeAI>(10);
```

### System Prompt Architecture

The system prompt is dynamically built from the current project state via `buildSystemPrompt(appState)`:

1. **Role definition** — Expert electronics engineer with 12+ domains of expertise
2. **Application capabilities** — Describes all 6 views
3. **Current project state** — Injected dynamically:
   - Project name and description
   - Active view and selected component
   - Recent change diff (since last AI turn)
   - All architecture nodes with positions and descriptions
   - All architecture edges with signal metadata
   - Full BOM listing
   - All validation issues
   - Schematic sheet listing
4. **Action schema reference** — Complete documentation of all 53 action types
5. **Response format rules** — When to include actions vs. text-only responses
6. **Custom user instructions** — Optional user-defined system prompt extension

The prompt is cached by a hash of the app state to avoid regeneration for identical states.

### Action Types (53 Total)

#### View Navigation (2)
| Action | Parameters |
|---|---|
| `switch_view` | `view`: architecture \| schematic \| procurement \| validation \| output \| project_explorer |
| `switch_schematic_sheet` | `sheetId`: string |

#### Architecture — Nodes (4)
| Action | Parameters |
|---|---|
| `add_node` | `nodeType`, `label`, `description?`, `positionX?`, `positionY?` |
| `remove_node` | `nodeLabel` |
| `update_node` | `nodeLabel`, `newLabel?`, `newType?`, `newDescription?` |
| `clear_canvas` | *(none)* |

#### Architecture — Edges (2)
| Action | Parameters |
|---|---|
| `connect_nodes` | `sourceLabel`, `targetLabel`, `edgeLabel?`, `busType?`, `signalType?`, `voltage?`, `busWidth?`, `netName?` |
| `remove_edge` | `sourceLabel`, `targetLabel` |

#### Architecture — Generation (1)
| Action | Parameters |
|---|---|
| `generate_architecture` | `components[]`: { label, nodeType, description, positionX, positionY }, `connections[]`: { sourceLabel, targetLabel, label, busType? } |

#### BOM Management (3)
| Action | Parameters |
|---|---|
| `add_bom_item` | `partNumber`, `manufacturer`, `description`, `quantity?`, `unitPrice?`, `supplier?`, `status?` |
| `remove_bom_item` | `partNumber` |
| `update_bom_item` | `partNumber`, `updates`: Record<string, any> |

#### Validation (3)
| Action | Parameters |
|---|---|
| `run_validation` | *(none)* |
| `clear_validation` | *(none)* |
| `add_validation_issue` | `severity`, `message`, `componentId?`, `suggestion?` |

#### Project Settings (2)
| Action | Parameters |
|---|---|
| `rename_project` | `name` |
| `update_description` | `description` |

#### Undo/Redo (2)
| Action | Parameters |
|---|---|
| `undo` | *(none)* |
| `redo` | *(none)* |

#### Layout (2)
| Action | Parameters |
|---|---|
| `auto_layout` | `layout`: hierarchical \| grid \| circular \| force |
| `add_subcircuit` | `template`: power_supply_ldo \| usb_interface \| spi_flash \| ... , `positionX?`, `positionY?` |

#### Net & Sheet Management (4)
| Action | Parameters |
|---|---|
| `assign_net_name` | `sourceLabel`, `targetLabel`, `netName` |
| `create_sheet` | `name` |
| `rename_sheet` | `sheetId`, `newName` |
| `move_to_sheet` | `nodeLabel`, `sheetId` |

#### Pin Management (2)
| Action | Parameters |
|---|---|
| `set_pin_map` | `nodeLabel`, `pins`: Record<string, string> |
| `auto_assign_pins` | `nodeLabel` |

#### Advanced Validation (5)
| Action | Parameters |
|---|---|
| `power_budget_analysis` | *(none)* |
| `voltage_domain_check` | *(none)* |
| `auto_fix_validation` | *(none)* |
| `dfm_check` | *(none)* |
| `thermal_analysis` | *(none)* |

#### BOM Intelligence (5)
| Action | Parameters |
|---|---|
| `pricing_lookup` | `partNumber` |
| `suggest_alternatives` | `partNumber`, `reason?` |
| `optimize_bom` | *(none)* |
| `check_lead_times` | *(none)* |
| `parametric_search` | `category`, `specs`: Record<string, string> |

#### Documentation (3)
| Action | Parameters |
|---|---|
| `analyze_image` | `description` |
| `save_design_decision` | `decision`, `rationale` |
| `add_annotation` | `nodeLabel`, `note`, `color?` |

#### Tutorials (1)
| Action | Parameters |
|---|---|
| `start_tutorial` | `topic`: getting_started \| power_design \| pcb_layout \| bom_management \| validation |

#### Export & Output (5)
| Action | Parameters |
|---|---|
| `export_bom_csv` | *(none)* |
| `export_kicad` | *(none)* |
| `export_spice` | *(none)* |
| `preview_gerber` | *(none)* |
| `export_design_report` | *(none)* |

#### Misc (2)
| Action | Parameters |
|---|---|
| `add_datasheet_link` | `partNumber`, `url` |
| `set_project_type` | `projectType`: iot \| wearable \| industrial \| automotive \| consumer \| medical \| rf \| power |

### Action Parsing

The AI response is parsed by `parseActionsFromResponse(text)`:

1. Searches for the **last** ` ```json ... ``` ` code block
2. Falls back to detecting bare JSON arrays at the end of the response
3. Validates each action has a `type` field and a recognized action type
4. Returns `{ message: string, actions: AIAction[] }`

### Request Deduplication

Concurrent identical requests (same provider + project + message prefix) are deduplicated via an `activeRequests` Map. The second caller receives the same Promise as the first.

### Error Categorization

```typescript
type AIErrorCode = 'AUTH_FAILED' | 'RATE_LIMITED' | 'TIMEOUT' | 'MODEL_ERROR' | 'PROVIDER_ERROR' | 'UNKNOWN';
```

Each error code maps to a user-friendly message. API keys are redacted from error messages using regex patterns.

### Streaming Flow

```
Client                    Server                     AI Provider
  │                         │                            │
  │  POST /api/chat/ai/stream                            │
  │ ─────────────────────►  │                            │
  │                         │  Build system prompt       │
  │                         │  + app state               │
  │                         │                            │
  │                         │  createStream()            │
  │                         │ ──────────────────────►    │
  │                         │                            │
  │  SSE: data: {"token":   │  ◄── stream chunk ──      │
  │   "I'll add..."}        │                            │
  │ ◄─────────────────────  │                            │
  │                         │                            │
  │  SSE: data: {"token":   │  ◄── stream chunk ──      │
  │   " an MCU node"}       │                            │
  │ ◄─────────────────────  │                            │
  │                         │                            │
  │  SSE: data: [DONE]      │  ◄── stream end ──        │
  │ ◄─────────────────────  │                            │
  │                         │                            │
  │  Client-side action     │                            │
  │  parsing & execution    │                            │
```

---

## 7. Frontend Architecture

### Component Hierarchy

```
App
├── ThemeProvider (next-themes)
│   └── QueryClientProvider (TanStack React Query)
│       └── TooltipProvider (Radix)
│           ├── Router (wouter)
│           │   └── Switch
│           │       ├── "/" → ProjectWorkspace
│           │       │         └── ProjectProvider (context)
│           │       │             └── WorkspaceContent
│           │       │                 ├── Sidebar (resizable, collapsible)
│           │       │                 │   ├── ComponentTree
│           │       │                 │   ├── SheetList
│           │       │                 │   └── HistoryList
│           │       │                 ├── ResizeHandle (left)
│           │       │                 ├── Main Content Area
│           │       │                 │   ├── Tab Bar (view switcher)
│           │       │                 │   └── Active View (lazy-loaded)
│           │       │                 │       ├── ErrorBoundary
│           │       │                 │       │   └── Suspense
│           │       │                 │       │       └── ArchitectureView
│           │       │                 │       ├── ErrorBoundary
│           │       │                 │       │   └── Suspense
│           │       │                 │       │       └── ComponentEditorView
│           │       │                 │       ├── ErrorBoundary
│           │       │                 │       │   └── Suspense
│           │       │                 │       │       └── ProcurementView
│           │       │                 │       ├── ErrorBoundary
│           │       │                 │       │   └── Suspense
│           │       │                 │       │       └── ValidationView
│           │       │                 │       └── ErrorBoundary
│           │       │                 │           └── Suspense
│           │       │                 │               └── OutputView
│           │       │                 ├── ResizeHandle (right)
│           │       │                 └── ErrorBoundary
│           │       │                     └── ChatPanel (resizable, collapsible)
│           │       │                         ├── MessageBubble(s)
│           │       │                         └── SettingsPanel
│           │       └── "*" → NotFound
│           └── Toaster
```

### State Management

#### ProjectProvider Context

The `ProjectProvider` in `client/src/lib/project-context.tsx` is the central state manager. It:

1. **Seeds** the demo project on mount via `POST /api/seed`
2. **Fetches** all project data via TanStack React Query (7 parallel queries)
3. **Exposes 40+ state values** via `useProject()` hook
4. **Provides mutations** that sync changes to the backend

Key state categories:

| Category | State | Source |
|---|---|---|
| View | `activeView`, `setActiveView` | Local useState |
| Architecture | `nodes`, `edges`, `setNodes`, `setEdges` | React Query → PUT sync |
| BOM | `bom`, `addBomItem`, `deleteBomItem`, `updateBomItem` | React Query → POST/PATCH/DELETE |
| Validation | `issues`, `runValidation`, `addValidationIssue`, `deleteValidationIssue` | React Query |
| Chat | `messages`, `addMessage`, `isGenerating` | React Query |
| History | `history`, `addToHistory` | React Query |
| Output Log | `outputLog`, `addOutputLog`, `clearOutputLog` | Local useState |
| Project Meta | `projectName`, `projectDescription` | React Query + local |
| Selection | `selectedNodeId`, `focusNodeId`, `focusNode` | Local useState |
| Undo/Redo | `undoStack`, `redoStack`, `pushUndoState`, `undo`, `redo` | Local useState → PUT |
| Snapshots | `lastAITurnSnapshot`, `captureSnapshot`, `getChangeDiff` | useRef |

#### Dirty-Tracking for Nodes/Edges

To prevent unnecessary saves on initial hydration, `setNodes`/`setEdges` use a dirty flag ref:

```typescript
const nodesDirtyRef = useRef(false);
const setNodes = (nodes: Node[]) => {
  if (nodesDirtyRef.current) {
    saveNodesMutation.mutate(nodes);  // PUT /api/projects/:id/nodes
  } else {
    nodesDirtyRef.current = true;     // Skip first call (hydration)
  }
};
```

### React Query Configuration

```typescript
// client/src/lib/queryClient.ts
{
  queries: {
    queryFn: getQueryFn({ on401: "throw" }),  // URL from queryKey[0]
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,  // 5 minutes
    retry: 2,
  },
  mutations: {
    retry: false,
    onError: console.error,
  },
}
```

**Pattern:** Query keys are the API URL strings (e.g., `['/api/projects/1/nodes']`). The default `queryFn` extracts the URL from `queryKey[0]`, makes a `fetch()` call, and returns the JSON response.

**`apiRequest` helper:**
```typescript
export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response>
```
Used for mutations. Automatically sets `Content-Type: application/json` and throws on non-2xx responses.

### Routing

Uses `wouter` (lightweight router, ~1.5KB):

| Path | Component |
|---|---|
| `/` | `ProjectWorkspace` |
| `*` | `NotFound` |

### Code Splitting

Views are lazy-loaded with `React.lazy()` + `Suspense`:

```typescript
const ArchitectureView = lazy(() => import('@/components/views/ArchitectureView'));
const ComponentEditorView = lazy(() => import('@/components/views/ComponentEditorView'));
const ProcurementView = lazy(() => import('@/components/views/ProcurementView'));
const ValidationView = lazy(() => import('@/components/views/ValidationView'));
const OutputView = lazy(() => import('@/components/views/OutputView'));
```

Each view is wrapped in its own `ErrorBoundary` so a crash in one view doesn't take down the entire app.

### View Descriptions

| View | Component | Features |
|---|---|---|
| **Architecture** | `ArchitectureView.tsx` | React Flow canvas, custom nodes, context menus, drag/drop, edge creation, keyboard shortcuts |
| **Component Editor** | `ComponentEditorView.tsx` | SVG shape canvas, 5 sub-views (breadboard, schematic, PCB, metadata, pin-table), DRC |
| **Procurement** | `ProcurementView.tsx` | BOM data table, filtering, CSV export, stock status indicators |
| **Validation** | `ValidationView.tsx` | DRC results grouped by severity, "Mark Resolved" actions |
| **Output** | `OutputView.tsx` | System log viewer with level filtering, memoized rendering |
| **Schematic** | `SchematicView.tsx` | Pan/zoom SVG viewer (demo data) |

### Responsive Design

- **Desktop (md+):** 3-panel layout with resizable dividers
- **Mobile:** Bottom tab navigation, slide-out sidebar/chat panels
- Panels are collapsible via toggle buttons
- Sidebar width: 180–480px, Chat width: 280–600px
- Custom `ResizeHandle` component with mouse event tracking

---

## 8. Backend Architecture

### Middleware Stack (in order)

```
1. helmet           — Security headers (CSP in production, disabled in dev)
2. compression      — gzip response compression
3. CORS             — Dev-only Access-Control headers
4. Request ID       — crypto.randomUUID() → req.id, X-Request-Id header
5. API Version      — X-API-Version: 1
6. Rate Limiter     — 300 req / 15 min (skips /api/chat/ai/stream)
7. JSON Parser      — express.json({ limit: "1mb" })
8. URL Parser       — express.urlencoded({ extended: false, limit: "1mb" })
9. CSRF Check       — Validates Origin header matches Host (dev bypass, SSE bypass)
10. Request Timeout  — 30s timeout (skips SSE stream)
11. Session Auth     — Validates X-Session-Id header (dev bypass for unauthenticated)
12. Request Logger   — Logs method, path, status, duration, truncated response body
13. Metrics          — Records route-level request count, avg latency, error count
```

### Storage Layer

The storage layer follows the Repository pattern with the `IStorage` interface:

```typescript
export interface IStorage {
  // Projects
  getProjects(opts?: PaginationOptions): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  // Nodes
  getNodes(projectId: number, opts?: PaginationOptions): Promise<ArchitectureNode[]>;
  createNode(node: InsertArchitectureNode): Promise<ArchitectureNode>;
  updateNode(id: number, projectId: number, data: Partial<InsertArchitectureNode>): Promise<ArchitectureNode | undefined>;
  replaceNodes(projectId: number, nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]>;
  bulkCreateNodes(nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]>;
  deleteNodesByProject(projectId: number): Promise<void>;

  // Edges, BOM, Validation, Chat, History, ComponentParts...
  // (similar CRUD patterns)
}
```

**`DatabaseStorage`** implements this interface using Drizzle ORM queries with:

- **Pagination** — limit/offset/sort on all list operations
- **Soft deletes** — `deletedAt` filtering with `isNull(table.deletedAt)`
- **Cache integration** — get/set/invalidate via `SimpleCache`
- **Chunked inserts** — Bulk operations split into chunks of 100
- **Transactions** — `replaceNodes`, `replaceEdges`, `replaceValidationIssues` use DB transactions
- **Error wrapping** — All operations wrapped in `StorageError` for consistent error handling

### Caching Layer

```typescript
// server/cache.ts
class SimpleCache {
  maxSize = 200;        // Max entries
  defaultTTLMs = 60000; // 60 seconds

  get<T>(key: string): T | undefined;
  set<T>(key: string, data: T, ttlMs?: number): void;
  invalidate(pattern: string): void;  // Prefix-based invalidation
  clear(): void;
}
```

Cache key patterns:
- `project:{id}` — Single project
- `nodes:{projectId}:{limit}:{offset}:{sort}` — Node listings
- `edges:{projectId}:{limit}:{offset}:{sort}` — Edge listings
- `bom:{projectId}:{limit}:{offset}:{sort}` — BOM listings
- `parts:{projectId}` — Component parts

Invalidation is prefix-based: `cache.invalidate('nodes:1')` clears all entries starting with `nodes:1`.

### Logging

```typescript
// server/logger.ts
export const logger = {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
};
```

Output format: JSON lines to stdout (info/debug/warn) or stderr (error):
```json
{"level":"info","time":"2026-02-17T10:00:00.000Z","msg":"GET /api/projects 200 in 12ms","source":"express"}
```

Level filtering via `LOG_LEVEL` env var (default: `info`).

### Metrics

```typescript
// server/metrics.ts
function recordRequest(method: string, path: string, statusCode: number, durationMs: number): void;
function getMetrics(): { uptimeSeconds: number, routes: Record<string, { count, avgMs, errors }> };
```

Recorded automatically by the request logger middleware. Exposed via `GET /api/metrics`.

### Error Handling

The global error handler in `server/index.ts`:
- Returns the error message directly for 4xx errors
- Returns `"Internal server error"` for 5xx errors (message sanitization)
- Logs the full stack trace via `logger.error`

Route handlers use `asyncHandler()` to catch Promise rejections and forward to the error handler.

### Graceful Shutdown

```
SIGTERM / SIGINT received
  → httpServer.close()
  → pool.end() (close DB connections)
  → process.exit(0)
  → 10s forced exit fallback
```

---

## 9. Component Editor System

### Overview

The Component Editor (Phase 2) allows designing individual electronic components with visual representations across three views (breadboard, schematic, PCB), plus metadata and pin-table management.

### Type System (`shared/component-types.ts`)

#### Shapes

All visual elements are represented as shapes with a common `BaseShape` interface:

```typescript
interface BaseShape {
  id: string;
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  style?: ShapeStyle;
  layer?: string;
}
```

Five shape variants:

| Type | Extra Fields | Use Case |
|---|---|---|
| `RectShape` | `rx?` (corner radius) | IC bodies, resistors, pads |
| `CircleShape` | `cx`, `cy` (center) | Through-hole pads, pin dots |
| `PathShape` | `d` (SVG path data) | Complex symbols, traces |
| `TextShape` | `text` | Labels, reference designators |
| `GroupShape` | `children: Shape[]` | Composite elements |

#### Connectors

```typescript
interface Connector {
  id: string;
  name: string;               // e.g., "VCC", "GND", "D0"
  description?: string;
  connectorType: 'male' | 'female' | 'pad';
  shapeIds: Record<string, string[]>;  // viewName → shape IDs
  terminalPositions: Record<string, TerminalPosition>;  // viewName → {x, y}
  padSpec?: PadSpec;           // PCB pad specification
}
```

#### Pad Specifications

```typescript
interface PadSpec {
  type: 'tht' | 'smd';
  shape: 'circle' | 'rect' | 'oblong' | 'square';
  diameter?: number;  // for THT
  drill?: number;     // for THT
  width?: number;     // for SMD
  height?: number;    // for SMD
}
```

#### Buses

```typescript
interface Bus {
  id: string;
  name: string;           // e.g., "SPI", "I2C"
  connectorIds: string[]; // References to connector IDs
}
```

#### Part Metadata

```typescript
interface PartMeta {
  title: string;
  family?: string;           // e.g., "Microcontroller"
  manufacturer?: string;
  mpn?: string;              // Manufacturer Part Number
  description?: string;
  tags: string[];
  mountingType: 'tht' | 'smd' | 'other' | '';
  packageType?: string;      // e.g., "QFP-48"
  properties: PartProperty[];
  datasheetUrl?: string;
  version?: string;
}
```

#### Part Views

Each component has three visual representations:

```typescript
interface PartViews {
  breadboard: ViewData;  // Physical appearance
  schematic: ViewData;   // Schematic symbol
  pcb: ViewData;         // PCB footprint
}

interface ViewData {
  shapes: Shape[];
  layerConfig?: Record<string, { visible: boolean; locked: boolean }>;
}
```

### Editor Sub-Views

| Sub-View | Purpose |
|---|---|
| **Breadboard** | Visual/physical appearance design |
| **Schematic** | Electrical symbol design |
| **PCB** | Footprint/pad layout design |
| **Metadata** | Part info, properties, tags |
| **Pin Table** | Connector/pin editing in table format |

### Design Rule Checks (DRC)

```typescript
interface DRCRule {
  id: string;
  name: string;
  severity: 'error' | 'warning' | 'info';
  check: string;
}

interface DRCViolation {
  ruleId: string;
  message: string;
  shapeIds?: string[];
  connectorIds?: string[];
  view?: string;
}
```

### State Management

The Component Editor has its own provider (`ComponentEditorProvider`) separate from the main `ProjectProvider`, managing:

- Active sub-view (breadboard/schematic/pcb/metadata/pin-table)
- Current part state (`PartState`)
- Shape selection
- Edit history

---

## 10. Security Model

### Authentication Flow

```
Registration:
  1. Client sends { username, password }
  2. Server validates (3-50 chars alphanumeric, 6-128 char password)
  3. Password hashed: scrypt(password, random_16_byte_salt, keylen=64)
  4. User stored in DB with hash format: "salt_hex:key_hex"
  5. Session created: UUID, 7-day expiry
  6. Session ID returned to client

Login:
  1. Client sends { username, password }
  2. Server retrieves user by username
  3. Verifies: scrypt(password, stored_salt, 64) === stored_key
  4. New session created and returned

Session Validation:
  1. Client sends X-Session-Id header
  2. Middleware looks up session in DB
  3. Checks expiration (7 days)
  4. Sets req.userId on success
  5. Expired sessions are deleted on access
```

### API Key Encryption

User-provided AI API keys are encrypted at rest using AES-256-GCM:

```
Encryption:
  1. Generate random 12-byte IV
  2. AES-256-GCM encrypt(key, IV, plaintext_api_key)
  3. Store: encrypted_hex + ":" + auth_tag_hex, IV_hex

Decryption:
  1. Retrieve encrypted_key and IV from DB
  2. Split encrypted_key into ciphertext and auth_tag
  3. AES-256-GCM decrypt(key, IV, ciphertext, auth_tag)

Key source:
  - Production: API_KEY_ENCRYPTION_KEY env var (required)
  - Development: Random 32-byte key per boot (warning logged)
```

### Rate Limiting

```typescript
rateLimit({
  windowMs: 15 * 60 * 1000,  // 15-minute window
  limit: 300,                  // 300 requests per window
  standardHeaders: true,       // RateLimit-* headers
  legacyHeaders: false,
  skip: (req) => req.path === '/api/chat/ai/stream',  // SSE exempt
});
```

### CSRF Protection

Mutating requests (POST, PUT, PATCH, DELETE) are checked for Origin/Referer header:
- Extract host from `Origin` or `Referer` header
- Compare against `X-Forwarded-Host` or `Host` header
- Mismatch returns `403 Forbidden`
- Development mode bypasses when no Origin present
- SSE streaming endpoint is exempt

### Content Security Policy (Production Only)

```
default-src: 'self'
script-src: 'self'
style-src: 'self', 'unsafe-inline', fonts.googleapis.com
img-src: 'self', data:, blob:
font-src: 'self', fonts.gstatic.com
connect-src: 'self'
frame-src: 'none'
object-src: 'none'
base-uri: 'self'
```

CSP is disabled in development for Vite HMR compatibility.

### Additional Security

- **Helmet** — Sets various security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- **Trust proxy** — `app.set("trust proxy", 1)` for correct IP detection behind Replit's proxy
- **Payload limits** — Per-route limits (4KB for auth, 32KB for single entities, 512KB for bulk operations)
- **Request timeout** — 30-second timeout for all non-streaming requests
- **Error sanitization** — 5xx errors return generic message, API keys redacted from error messages

---

## 11. Development Workflow

### Initial Setup

```bash
# 1. Clone/open the project
# 2. Install dependencies
npm install

# 3. Ensure PostgreSQL is available (auto on Replit)
# DATABASE_URL is auto-set

# 4. Push database schema
npm run db:push

# 5. Start development server
npm run dev
# → Server starts on port 5000
# → Vite HMR enabled
# → Demo project auto-seeded
```

### Database Commands

```bash
# Sync schema changes to database
npm run db:push

# Open Drizzle Studio (DB GUI) — if drizzle-kit studio is available
npx drizzle-kit studio
```

### Schema Changes

1. Edit `shared/schema.ts`
2. Run `npm run db:push` to sync
3. Update `IStorage` interface in `server/storage.ts` if needed
4. Implement new methods in `DatabaseStorage`
5. Add routes in `server/routes.ts`
6. Update frontend queries/mutations

### Adding a New API Endpoint

1. Add Zod schema in `server/routes.ts` (or import from `shared/schema.ts`)
2. Add route in `registerRoutes()` using `asyncHandler()`:
   ```typescript
   app.post("/api/new-endpoint", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
     const parsed = mySchema.safeParse(req.body);
     if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
     const result = await storage.myMethod(parsed.data);
     res.status(201).json(result);
   }));
   ```
3. Add to `server/api-docs.ts`
4. Add React Query hook in frontend

### Adding a New View

1. Create component in `client/src/components/views/MyView.tsx`
2. Add lazy import in `client/src/pages/ProjectWorkspace.tsx`:
   ```typescript
   const MyView = lazy(() => import('@/components/views/MyView'));
   ```
3. Add to `ViewMode` type in `client/src/lib/project-context.tsx`
4. Add tab entry in `WorkspaceContent`
5. Add `ErrorBoundary` + `Suspense` wrapper in the render

### Build & Deploy

```bash
# Production build
npm run build
# → Vite builds frontend to client/dist/
# → esbuild bundles server to dist/index.cjs

# Run production server
npm run start
# → Serves from dist/

# Type check (no emit)
npm run check
```

---

## 12. Code Conventions & Patterns

### TypeScript

- Strict mode enabled
- Path aliases: `@/` → `client/src/`, `@shared/` → `shared/`
- Shared types in `shared/schema.ts` (Drizzle + Zod) and `shared/component-types.ts`
- `z.infer<typeof schema>` for insert types
- `typeof table.$inferSelect` for select types

### Frontend Patterns

- **Components:** Function components with hooks, no class components
- **Styling:** Tailwind CSS v4 with `cn()` utility (`clsx` + `tailwind-merge`)
- **UI Library:** shadcn/ui components in `client/src/components/ui/`
- **Icons:** Lucide React
- **Theme:** `next-themes` with `ThemeProvider`, supports light/dark/system
- **Test IDs:** `data-testid` on all interactive and meaningful elements:
  - Interactive: `{action}-{target}` (e.g., `button-submit`, `tab-architecture`)
  - Display: `{type}-{content}` (e.g., `text-username`)
  - Dynamic: `{type}-{description}-{id}` (e.g., `card-product-${id}`)

### Backend Patterns

- **Route handlers:** Thin — validate with Zod, delegate to storage, return response
- **Error handling:** `asyncHandler()` wrapper for async route handlers
- **Validation:** Zod schemas with `fromZodError()` for user-friendly messages
- **HTTP errors:** `HttpError` class with status code
- **Payload limits:** `payloadLimit()` middleware per-route

### Naming Conventions

| Context | Convention | Example |
|---|---|---|
| Files | kebab-case | `project-context.tsx` |
| Components | PascalCase | `ArchitectureView` |
| Functions/hooks | camelCase | `useProject`, `addBomItem` |
| Types/interfaces | PascalCase | `BlockNode`, `BomItem` |
| Constants | UPPER_SNAKE | `PROJECT_ID`, `MAX_CHAT_HISTORY` |
| DB columns | snake_case | `project_id`, `created_at` |
| API paths | kebab-case | `/api/component-parts` |
| CSS classes | Tailwind utilities | `bg-card/60 backdrop-blur-xl` |

### Import Organization

1. External libraries
2. Internal modules (`@/`, `@shared/`)
3. Types (if separate)

---

## 13. Known Issues & Technical Debt

### Critical

| Issue | Location | Impact |
|---|---|---|
| **Hardcoded PROJECT_ID = 1** | `client/src/lib/project-context.tsx:11` | Blocks multi-project support entirely. All queries, mutations, and AI requests use this constant. |
| **No test suite** | Project-wide | No unit tests, integration tests, or E2E tests (one test file exists at `server/__tests__/api.test.ts` but coverage is minimal) |

### High Priority

| Issue | Location | Impact |
|---|---|---|
| **Monolithic ProjectProvider** | `project-context.tsx` (635 lines, 40+ state values) | Hard to maintain, causes unnecessary re-renders. Should be split into domain-specific providers (ArchitectureProvider, BomProvider, ChatProvider, etc.) |
| **Monolithic ChatPanel** | `ChatPanel.tsx` (2363 lines) | Contains AI chat, settings, streaming, action parsing/execution all in one file. Needs decomposition into sub-components. |
| **Monolithic Sidebar** | `Sidebar.tsx` (832 lines) | Should be split into more sub-components |

### Medium Priority

| Issue | Location | Impact |
|---|---|---|
| **localStorage alongside DB** | Various components | Some state is duplicated between localStorage and database, leading to potential inconsistencies |
| **staleTime: Infinity per-query overrides** | `project-context.tsx` | Global staleTime is 5 min (`queryClient.ts`), but some per-query overrides in `project-context.tsx` use `staleTime: Infinity`, preventing auto-refetch |
| **Deprecated API endpoints** | `routes.ts` lines 400-417, 444-451 | Old BOM/validation endpoints (`/api/bom/:id`, `/api/validation/:id`) still exist alongside proper nested routes |
| **No pagination UI** | Frontend | Endpoints support pagination but the frontend doesn't paginate — all data fetched with defaults |
| **Hardcoded validation checks** | `project-context.tsx` lines 167-174 | `runValidation()` cycles through a static array of 6 pre-defined checks |

### Low Priority

| Issue | Location | Impact |
|---|---|---|
| **Hardcoded schematic sheets** | `project-context.tsx` lines 192-196 | Sheets are defined as local state, not fetched from DB |
| **Demo seed on every mount** | `project-context.tsx` lines 182-188 | `POST /api/seed` called on every page load (idempotent, but unnecessary) |
| **No WebSocket for real-time** | Architecture | Collaborative editing would require WebSocket/SSE for state sync |
| **BOM totalPrice computed on write** | `storage.ts` | Total price calculated server-side but could become stale if quantity/price updated separately |

---

## 14. Roadmap / Phase Plan

### Phase 1 — Core Platform (Current)

- [x] Architecture view with React Flow
- [x] BOM management with CRUD
- [x] Validation/DRC system
- [x] AI chat with Anthropic + Gemini
- [x] 53 AI action types
- [x] Session-based authentication
- [x] API key management (encrypted)
- [x] Undo/redo for architecture
- [x] Change diff tracking
- [x] Demo project seeding
- [x] Structured logging and metrics

### Phase 2 — Component Editor (In Progress)

- [x] Shape type system (rect, circle, path, text, group)
- [x] Multi-view editor (breadboard, schematic, PCB)
- [x] Connector and bus definitions
- [x] Pin table management
- [x] Part metadata
- [x] DRC rule system
- [ ] Interactive shape manipulation (in SVG canvas)
- [ ] Component library management
- [ ] Import/export component definitions

### Phase 3 — Multi-Project & Collaboration (Planned)

- [ ] Dynamic project routing (replace hardcoded PROJECT_ID)
- [ ] Project listing/creation UI
- [ ] Project duplication
- [ ] User project ownership
- [ ] Sharing and permissions

### Phase 4 — Advanced Features (Planned)

- [ ] Real schematic editor (replace demo data)
- [ ] PCB layout viewer/editor
- [ ] Netlist generation
- [ ] SPICE simulation integration
- [ ] KiCad export (real implementation behind `export_kicad` action)
- [ ] Gerber preview
- [ ] Design report generation

### Phase 5 — Production Hardening (Planned)

- [ ] Comprehensive test suite (unit, integration, E2E)
- [ ] Split ProjectProvider into domain-specific providers
- [ ] Decompose ChatPanel, Sidebar into smaller components
- [ ] Add pagination UI for all list views
- [ ] WebSocket for real-time collaboration
- [ ] Remove deprecated API endpoints
- [ ] Performance profiling and optimization
- [ ] CI/CD pipeline

---

*This documentation is auto-generated from codebase analysis. Keep it updated as the architecture evolves.*
