<div align="center">

# ProtoPulse

### From Concept to Circuit — AI-Powered Electronics Design

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle_ORM-0.39-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![License: MIT](https://img.shields.io/badge/License-MIT-00F0FF.svg)](LICENSE)

**Design system architectures. Generate BOMs. Validate designs. Let AI do the heavy lifting.**

[Getting Started](#-getting-started) · [Features](#-features) · [Architecture](#-architecture) · [Documentation](#-documentation) · [Roadmap](#-roadmap)

</div>

---

## What is ProtoPulse?

ProtoPulse is a browser-based Electronic Design Automation (EDA) platform that combines interactive block diagram editing, bill of materials management, design validation, and an AI assistant that actually understands electronics — all in one place.

Think **Fritzing meets KiCad**, rebuilt for the browser, supercharged with AI.

Whether you're an embedded engineer prototyping an IoT sensor node, a hardware startup architecting your first product, or a student learning system design — ProtoPulse gives you a unified workspace to go from idea to validated design.

---

## Key Features

### Architecture Editor
Interactive block diagram canvas powered by React Flow. Drag components from a categorized library (MCU, Sensor, Power, Communication, Connector, Memory, Actuator), connect them with typed signal edges (SPI, I2C, UART, USB, Power, GPIO), and visualize your entire system at a glance.

### AI Design Assistant
Chat with an AI that doesn't just answer questions — it **acts**. Ask it to generate a complete architecture, add components, wire connections, populate your BOM, run validation, or export your design. 53 distinct action types across architecture, BOM, validation, analysis, and export categories. Supports both **Anthropic Claude** and **Google Gemini** with streaming responses.

### Component Editor
Design individual electronic components with a multi-view editor: breadboard representation, schematic symbol, PCB footprint, metadata (manufacturer, MPN, package, datasheet), and pin table with pad specifications. Interactive SVG canvas with shape tools for custom part creation.

### Bill of Materials
Full BOM management with part numbers, manufacturers, pricing, suppliers, stock status tracking (with accessibility-first status indicators), lead times, and one-click CSV export. The AI can suggest alternatives, look up pricing, optimize your BOM, and check lead times.

### Design Validation
Automated Design Rule Checks (DRC) that catch errors, warnings, and informational issues across your design. Each issue includes the affected component, a human-readable message, and a suggested fix. Mark issues as resolved to track your progress.

### Dark-First Design
A carefully crafted dark theme with neon cyan (`#00F0FF`) and purple accents, purpose-built for long design sessions. Light theme available. Engineering-grade typography with Rajdhani, JetBrains Mono, and Inter.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 |
| **State** | TanStack React Query |
| **UI Components** | shadcn/ui (40+ components), Radix UI primitives |
| **Diagrams** | @xyflow/react (React Flow) |
| **Backend** | Node.js, Express 5, TypeScript (tsx) |
| **Database** | PostgreSQL, Drizzle ORM |
| **AI** | Anthropic Claude SDK, Google Generative AI SDK |
| **Auth** | Session-based (scrypt + AES-256-GCM key encryption) |
| **Routing** | Wouter (client), Express (server) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (provided automatically on Replit)

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

### Seed Demo Data

Hit the seed endpoint to populate a sample project with architecture nodes, edges, BOM items, and validation issues:

```bash
curl -X POST http://localhost:5000/api/seed
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `API_KEY_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM encryption | Production |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` | No (default: `info`) |
| `NODE_ENV` | `development` \| `production` | No |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ Sidebar  │  │    Main Views    │  │  Chat Panel  │  │
│  │          │  │                  │  │              │  │
│  │ - Nav    │  │ - Architecture   │  │ - AI Chat    │  │
│  │ - Assets │  │ - Component Ed.  │  │ - Settings   │  │
│  │ - History│  │ - Procurement    │  │ - Streaming  │  │
│  │          │  │ - Validation     │  │ - Actions    │  │
│  │          │  │ - Output         │  │              │  │
│  │          │  │ - Schematic      │  │              │  │
│  └──────────┘  └──────────────────┘  └──────────────┘  │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │ REST API + SSE
┌─────────────────────────┼───────────────────────────────┐
│                    Express Server                       │
│                                                         │
│  Helmet → Compression → Rate Limit → Auth → Metrics    │
│                                                         │
│  ┌────────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │  Routes    │  │ Storage  │  │    AI Service       │  │
│  │  (Zod)    │  │ (Drizzle)│  │ (Claude / Gemini)   │  │
│  └─────┬──────┘  └────┬─────┘  └────────────────────┘  │
│        │              │                                  │
│        └──────┬───────┘                                  │
│               │                                          │
│        ┌──────┴──────┐                                   │
│        │  PostgreSQL │                                   │
│        │  (11 tables)│                                   │
│        └─────────────┘                                   │
└──────────────────────────────────────────────────────────┘
```

### Database Schema

11 tables: `projects`, `architecture_nodes`, `architecture_edges`, `bom_items`, `validation_issues`, `chat_messages`, `history_items`, `users`, `sessions`, `api_keys`, `component_parts`

Key patterns:
- **Soft deletes** on critical tables (`deletedAt` timestamp)
- **Cascade deletes** from projects to child tables
- **In-memory caching** with TTL and pattern-based invalidation
- **Chunked inserts** for bulk operations (100/chunk)

### API

50+ RESTful endpoints under `/api/`. Full Zod validation, pagination support (`?limit=&offset=&sort=`), semantic HTTP status codes, and structured error responses. Protected by session auth (`X-Session-Id` header).

See [docs/DEVELOPER.md](docs/DEVELOPER.md) for the complete API reference.

---

## AI Capabilities

The AI assistant can execute **53 action types** across these categories:

| Category | Examples |
|----------|---------|
| **Architecture** | Add/remove/update nodes and edges, generate complete architectures, auto-layout, clear canvas |
| **BOM** | Add/remove/update items, export CSV, pricing lookup, suggest alternatives, optimize BOM, parametric search |
| **Validation** | Run DRC, add/clear issues, voltage domain check, thermal analysis, DFM check |
| **Navigation** | Switch views, switch schematic sheets |
| **Project** | Rename project, update description, set project type |
| **Export** | KiCad export, SPICE export, Gerber preview, design report |
| **Analysis** | Power budget, signal integrity, thermal analysis, impedance matching |

Every action is typed, validated, and idempotent. Destructive actions require user confirmation.

---

## Scripts

```bash
npm run dev        # Development server with hot reload
npm run build      # Production build (Vite + esbuild)
npm run start      # Production server
npm run check      # TypeScript type checking
npm run db:push    # Sync Drizzle schema to database
```

---

## Project Structure

```
client/
  src/
    pages/             # Route pages (ProjectWorkspace)
    components/
      views/           # Architecture, Component Editor, Procurement, Validation, Output, Schematic
      panels/          # ChatPanel (AI interface)
      layout/          # Sidebar, navigation
      ui/              # 40+ shadcn/ui components
    lib/               # Context providers, React Query config, utilities
    hooks/             # Custom hooks (toast, mobile detection)

server/
    index.ts           # Express app, middleware stack
    routes.ts          # All API endpoints
    ai.ts              # AI integration (Anthropic + Gemini)
    auth.ts            # Session auth, password hashing, key encryption
    storage.ts         # Database operations (IStorage interface)
    cache.ts           # In-memory TTL cache

shared/
    schema.ts          # Drizzle schema, Zod validators, TypeScript types
    component-types.ts # Component editor type system
```

---

## Documentation

| Document | Audience | Description |
|----------|----------|-------------|
| [DEVELOPER.md](docs/DEVELOPER.md) | Engineers | Full architecture, API reference, data model, AI system, security, conventions (~2,000 lines) |
| [USER_GUIDE.md](docs/USER_GUIDE.md) | End Users | Feature walkthroughs, tips, shortcuts, troubleshooting, glossary (~730 lines) |
| [AI_AGENT_GUIDE.md](docs/AI_AGENT_GUIDE.md) | AI Agents | Codebase rules, conventions, gotchas, checklists for autonomous development (~1,000 lines) |

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | In Progress | Audit remediation, code quality, technical debt |
| **Phase 1** | Planned | Multi-project support, context splitting, undo/redo |
| **Phase 2** | Complete | Component Editor (SVG canvas, connectors, buses, DRC) |
| **Phase 3** | Planned | Circuit schematic capture (reusing React Flow) |
| **Phase 4** | Planned | Breadboard/PCB layout, manufacturing output (Gerber, KiCad) |
| **Phase 5** | Planned | Circuit simulation, SPICE integration |

---

## Contributing

ProtoPulse follows **vertical slice development**: for any new feature, implement the full stack top-to-bottom:

```
Schema → Storage → API Route → React Query Hook → UI Component → Testing
```

Key conventions:
- `data-testid` on every interactive and display element
- Zod validation on all API request bodies
- Soft deletes for data retention
- Toast notifications for user-facing feedback
- ErrorBoundary wrapping each view independently

See [AI_AGENT_GUIDE.md](docs/AI_AGENT_GUIDE.md) for the complete list of rules and conventions.

---

<div align="center">

**Built with caffeine, curiosity, and way too many datasheets.**

MIT License

</div>
