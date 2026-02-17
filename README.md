<div align="center">

<br>

```
 ██████╗ ██████╗  ██████╗ ████████╗ ██████╗ ██████╗ ██╗   ██╗██╗     ███████╗███████╗
 ██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗██╔══██╗██║   ██║██║     ██╔════╝██╔════╝
 ██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║██████╔╝██║   ██║██║     ███████╗█████╗
 ██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝
 ██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝██║     ╚██████╔╝███████╗███████║███████╗
 ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝
```

<br>

### **From Concept to Circuit — AI-Powered Electronics Design**

<br>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle_ORM-0.39-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![License](https://img.shields.io/badge/License-MIT-00F0FF?style=for-the-badge)](LICENSE)

<br>

[**Features**](#-features) **·** [**Quick Start**](#-quick-start) **·** [**Architecture**](#-architecture) **·** [**AI Engine**](#-ai-engine) **·** [**Docs**](#-documentation) **·** [**Roadmap**](#-roadmap)

<br>

---

<br>

*Design system architectures. Generate BOMs. Validate designs.*
*Let AI do the heavy lifting.*

<br>

</div>

## The Vision

ProtoPulse is a browser-based **Electronic Design Automation** platform that brings together everything an electronics engineer needs in one workspace — interactive block diagrams, component management, bill of materials, design validation, and an AI assistant that doesn't just talk about circuits, it *builds* them.

> **Think Fritzing meets KiCad, rebuilt for the browser, supercharged with AI.**

Whether you're prototyping an IoT sensor node, architecting a product for your hardware startup, or learning system design as a student — ProtoPulse takes you from napkin sketch to validated design without switching tools.

<br>

## ✦ Features

<table>
<tr>
<td width="50%">

### Architecture Editor
Interactive block diagram canvas. Drag components from a categorized library — **MCU, Sensor, Power, Communication, Connector, Memory, Actuator** — connect them with typed signal edges *(SPI, I2C, UART, USB, Power, GPIO)*, and see your entire system at a glance. Powered by React Flow.

</td>
<td width="50%">

### AI Design Assistant
Chat with an AI that **acts**, not just answers. Generate complete architectures from a sentence. Add components, wire connections, populate your BOM, run validation, export designs — **53 distinct action types**. Supports **Anthropic Claude** and **Google Gemini** with real-time streaming.

</td>
</tr>
<tr>
<td width="50%">

### Component Editor
Design individual parts with a multi-view editor: **breadboard** representation, **schematic** symbol, **PCB** footprint, **metadata** (manufacturer, MPN, package, datasheet), and **pin table** with pad specifications. Interactive SVG canvas with shape tools for custom part creation.

</td>
<td width="50%">

### Bill of Materials
Full BOM management — part numbers, manufacturers, pricing, suppliers, stock status with accessibility-first indicators, lead times, and **one-click CSV export**. The AI can suggest alternatives, look up pricing, optimize your BOM, and check lead times automatically.

</td>
</tr>
<tr>
<td width="50%">

### Design Validation
Automated **Design Rule Checks** that catch errors, warnings, and info-level issues across your design. Each issue shows the affected component, a human-readable message, and a suggested fix. Mark issues as resolved to track your progress toward a clean design.

</td>
<td width="50%">

### Dark-First Design
Carefully crafted dark theme with **neon cyan** (`#00F0FF`) and **purple** accents, purpose-built for long design sessions. Light theme available. Engineering-grade typography: **Rajdhani** for display, **JetBrains Mono** for technical data, **Inter** for body text.

</td>
</tr>
</table>

<br>

## ✦ Quick Start

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Launch development server
npm run dev
```

Open **`http://localhost:5000`** and start designing.

#### Seed a demo project

```bash
curl -X POST http://localhost:5000/api/seed
```

This populates a sample project with architecture nodes, edges, BOM items, and validation issues — perfect for exploring the platform.

<details>
<summary><strong>Environment Variables</strong></summary>

<br>

| Variable | Description | Required |
|----------|-------------|:--------:|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `API_KEY_ENCRYPTION_KEY` | 32-byte hex for AES-256-GCM encryption | Production |
| `LOG_LEVEL` | `debug` · `info` · `warn` · `error` | No |
| `NODE_ENV` | `development` · `production` | No |

</details>

<details>
<summary><strong>All Scripts</strong></summary>

<br>

```bash
npm run dev        # Development server with hot reload
npm run build      # Production build (Vite + esbuild)
npm run start      # Production server
npm run check      # TypeScript type checking
npm run db:push    # Sync Drizzle schema to database
```

</details>

<br>

## ✦ Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              B R O W S E R              │
                    │                                         │
                    │   ┌─────────┐ ┌────────┐ ┌──────────┐  │
                    │   │Sidebar  │ │ Views  │ │Chat Panel│  │
                    │   │         │ │        │ │          │  │
                    │   │ Nav     │ │ Arch.  │ │ AI Chat  │  │
                    │   │ Assets  │ │ Comp.  │ │ Settings │  │
                    │   │ History │ │ BOM    │ │ Actions  │  │
                    │   │         │ │ Valid. │ │ Stream   │  │
                    │   │         │ │ Output │ │          │  │
                    │   │         │ │ Schem. │ │          │  │
                    │   └─────────┘ └────────┘ └──────────┘  │
                    └──────────────────┬──────────────────────┘
                                      │
                               REST API + SSE
                                      │
                    ┌──────────────────┴──────────────────────┐
                    │          E X P R E S S   v5             │
                    │                                         │
                    │  helmet → compress → rate-limit → auth  │
                    │                                         │
                    │  ┌─────────┐ ┌────────┐ ┌───────────┐  │
                    │  │ Routes  │ │Storage │ │ AI Service│  │
                    │  │  (Zod)  │ │(Drizzle│ │ (Claude / │  │
                    │  │         │ │  ORM)  │ │  Gemini)  │  │
                    │  └────┬────┘ └───┬────┘ └───────────┘  │
                    │       └─────┬────┘                      │
                    │        ┌────┴─────┐                     │
                    │        │PostgreSQL│                     │
                    │        │(11 tables│                     │
                    │        └──────────┘                     │
                    └─────────────────────────────────────────┘
```

<br>

<details>
<summary><strong>Tech Stack Breakdown</strong></summary>

<br>

| Layer | Technology |
|:------|:-----------|
| **Frontend** | React 19 · TypeScript · Vite · Tailwind CSS v4 |
| **State** | TanStack React Query |
| **UI Library** | shadcn/ui (40+ components) · Radix UI |
| **Diagrams** | @xyflow/react (React Flow) |
| **Backend** | Node.js · Express 5 · TypeScript (tsx) |
| **Database** | PostgreSQL · Drizzle ORM |
| **AI** | Anthropic Claude SDK · Google Generative AI SDK |
| **Auth** | Session-based · scrypt · AES-256-GCM |
| **Routing** | Wouter (client) · Express (server) |

</details>

<details>
<summary><strong>Database Schema</strong></summary>

<br>

**11 tables:** `projects` · `architecture_nodes` · `architecture_edges` · `bom_items` · `validation_issues` · `chat_messages` · `history_items` · `users` · `sessions` · `api_keys` · `component_parts`

Design patterns:
- **Soft deletes** on critical tables via `deletedAt` timestamp
- **Cascade deletes** from projects to all child tables
- **In-memory caching** with TTL and pattern-based invalidation
- **Chunked inserts** for bulk operations (100/chunk)

</details>

<details>
<summary><strong>Project Structure</strong></summary>

<br>

```
client/
  src/
    pages/              Route pages (ProjectWorkspace)
    components/
      views/            Architecture, ComponentEditor, Procurement,
                        Validation, Output, Schematic
      panels/           ChatPanel — AI interface
      layout/           Sidebar, navigation
      ui/               40+ shadcn/ui primitives
    lib/                Context providers, React Query config, utils
    hooks/              Custom hooks (toast, mobile detection)

server/
    index.ts            Express app, middleware stack
    routes.ts           All API endpoints
    ai.ts               AI integration (Anthropic + Gemini)
    auth.ts             Session auth, password hashing, key encryption
    storage.ts          Database operations (IStorage interface)
    cache.ts            In-memory TTL cache

shared/
    schema.ts           Drizzle schema, Zod validators, TypeScript types
    component-types.ts  Component editor type system
```

</details>

<br>

## ✦ AI Engine

The AI assistant executes **53 action types** — it doesn't just describe what to do, it does it:

| Category | What It Can Do |
|:---------|:---------------|
| **Architecture** | Add / remove / update nodes and edges · generate complete architectures from text · auto-layout · clear canvas |
| **BOM** | Add / remove / update items · export CSV · pricing lookup · suggest alternatives · optimize BOM · parametric search |
| **Validation** | Run DRC · add / clear issues · voltage domain check · thermal analysis · DFM check |
| **Navigation** | Switch views · switch schematic sheets |
| **Project** | Rename project · update description · set project type |
| **Export** | KiCad export · SPICE export · Gerber preview · design report |
| **Analysis** | Power budget · signal integrity · thermal analysis · impedance matching |

> Every action is **typed**, **validated**, and **idempotent**.
> Destructive actions require explicit user confirmation.

<br>

## ✦ Documentation

| Document | For | Lines |
|:---------|:----|------:|
| **[DEVELOPER.md](docs/DEVELOPER.md)** | Engineers | ~2,000 |
| **[USER_GUIDE.md](docs/USER_GUIDE.md)** | End Users | ~730 |
| **[AI_AGENT_GUIDE.md](docs/AI_AGENT_GUIDE.md)** | AI Agents | ~1,000 |

Full architecture deep dives, complete API reference (50+ endpoints), database schema, AI action catalog, keyboard shortcuts, troubleshooting, glossary, and operational checklists for autonomous development.

<br>

## ✦ Roadmap

```
  Phase 0  ████████████░░░░░░░░  In Progress   Audit remediation, code quality
  Phase 1  ░░░░░░░░░░░░░░░░░░░░  Planned       Multi-project, context splitting, undo/redo
  Phase 2  ████████████████████  Complete      Component Editor (SVG, connectors, buses)
  Phase 3  ░░░░░░░░░░░░░░░░░░░░  Planned       Circuit schematic capture
  Phase 4  ░░░░░░░░░░░░░░░░░░░░  Planned       Breadboard / PCB layout, Gerber & KiCad
  Phase 5  ░░░░░░░░░░░░░░░░░░░░  Planned       Circuit simulation, SPICE integration
```

<br>

## ✦ Contributing

ProtoPulse follows **vertical slice development** — every feature is built top-to-bottom:

```
Schema  ──►  Storage  ──►  API Route  ──►  React Query  ──►  UI Component  ──►  Test
```

Key conventions: `data-testid` on all interactive elements · Zod validation on every request body · soft deletes for data retention · toast notifications for user feedback · ErrorBoundary per view.

See **[AI_AGENT_GUIDE.md](docs/AI_AGENT_GUIDE.md)** for the complete rules and conventions.

<br>

---

<div align="center">

<br>

```
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │   Built with caffeine, curiosity,                │
  │   and way too many datasheets.                   │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

<br>

**MIT License**

<br>

</div>
