# ProtoPulse

## Overview

ProtoPulse is an AI-assisted electronics and system design platform. It provides a workspace for designing hardware architectures with features including block diagram editing (using a node/edge graph), bill of materials (BOM) management, design validation, schematic viewing, and an AI chat assistant. The application is built as a full-stack TypeScript project with a React frontend and Express backend, backed by PostgreSQL.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router) — single main route (`/`) renders the `ProjectWorkspace`
- **State Management**: React Context (`ProjectProvider` in `client/src/lib/project-context.tsx`) combined with TanStack React Query for server state
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS v4
- **Graph/Diagram Editor**: `@xyflow/react` (React Flow) for the architecture block diagram with draggable nodes and edges
- **Styling**: Tailwind CSS with a custom dark theme (neon cyan/purple color scheme), custom fonts (Rajdhani, JetBrains Mono, Inter)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend

- **Runtime**: Node.js with Express, written in TypeScript (executed via `tsx` in development)
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **Key Resources**: Projects, Architecture Nodes, Architecture Edges, BOM Items, Validation Issues, Chat Messages, History Items
- **Development Server**: Vite dev server middleware is integrated into Express for HMR during development
- **Production Build**: Vite builds the client to `dist/public`; esbuild bundles the server to `dist/index.cjs`
- **Static Serving**: In production, Express serves the built client files and falls back to `index.html` for SPA routing

### Data Storage

- **Database**: PostgreSQL via `node-postgres` (`pg` package)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema Location**: `shared/schema.ts` — shared between frontend and backend
- **Schema Push**: `drizzle-kit push` (no migration files needed for development)
- **Tables**:
  - `projects` — top-level project entity (name, description)
  - `architecture_nodes` — graph nodes with position, type, label, and JSON data
  - `architecture_edges` — graph edges with source/target, label, animation, and style
  - `bom_items` — bill of materials entries (part number, manufacturer, quantity, pricing, stock status)
  - `validation_issues` — design validation results (severity, message, suggestions)
  - `chat_messages` — AI chat history per project
  - `history_items` — project activity/change history
- **Foreign Keys**: All child tables reference `projects.id` with `onDelete: cascade`
- **Storage Layer**: `server/storage.ts` implements `IStorage` interface using `DatabaseStorage` class with Drizzle queries

### API Structure

All endpoints are prefixed with `/api/`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get single project |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id/nodes` | Get architecture nodes |
| POST | `/api/projects/:id/nodes` | Create architecture node |
| GET | `/api/projects/:id/edges` | Get architecture edges |
| POST | `/api/projects/:id/edges` | Create architecture edge |
| GET/POST/PUT/DELETE | `/api/projects/:id/bom` | BOM item CRUD |
| GET/POST | `/api/projects/:id/validation` | Validation issues |
| GET/POST | `/api/projects/:id/chat` | Chat messages |
| GET/POST | `/api/projects/:id/history` | History items |

Request validation uses Zod schemas generated from Drizzle table definitions via `drizzle-zod`.

### Key Design Decisions

1. **Shared Schema**: The `shared/` directory contains the database schema that's imported by both client and server, ensuring type safety across the full stack.
2. **Single Project Focus**: The current UI defaults to `PROJECT_ID = 1`, suggesting a single-project-at-a-time workflow (though the API supports multiple projects).
3. **AI Command System**: The chat panel uses a `processAICommand()` function that detects user intent via keyword matching and executes actions across the entire app (view switching, node/edge CRUD, BOM management, validation, project renaming, CSV export, etc.). Responses are prefixed with `[ACTION]` when an action is performed. The build script includes `@google/generative-ai` and `openai` in the bundle allowlist for future real AI integration.
4. **Component Library**: Heavy use of shadcn/ui components provides a consistent, accessible UI foundation without external component library lock-in.

## External Dependencies

### Required Services
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable (required)

### AI Integration (Active)
- **Anthropic Claude**: Server-side integration via `@anthropic-ai/sdk` — models: Claude Sonnet 4.5, Claude 4.6 Sonnet, Claude Sonnet 4, Claude Opus 4, Claude 4.6 Opus, Claude Haiku 4.5
- **Google Gemini**: Server-side integration via `@google/generative-ai` — models: Gemini 2.5 Flash, 2.5 Pro, Gemini 3 Flash, Gemini 3 Pro
- **AI Endpoint**: `POST /api/chat/ai/stream` receives user message + full app state context, streams response via SSE, returns structured response with action commands
- **Action System**: AI can control all app features via 18 action types (node/edge CRUD, BOM management, validation, view switching, project settings, exports)
- **API Keys**: User-provided via ChatPanel settings UI, stored in localStorage (client-side), sent per-request to server
- **Custom System Prompt**: User can provide custom instructions appended to the AI system prompt
- **Streaming**: Server-side SSE streaming with client-side incremental rendering and cancel support (AbortController)
- **Fallback**: When no API key is configured, local keyword-matching command system is used

### AI Chat Features
- **Markdown rendering**: react-markdown + remark-gfm for rich AI response formatting
- **Auto-expanding textarea**: Shift+Enter for newlines, Enter to send
- **Message actions**: Copy to clipboard, regenerate last response, retry on error
- **Action status chips**: Inline badges showing executed actions in message bubbles
- **Destructive action confirmation**: Accept/reject UI for dangerous operations (clear canvas, remove nodes)
- **Follow-up suggestions**: Context-aware suggestion chips after AI responses
- **Chat search & export**: Search through chat history, export as text file
- **Temperature slider**: 0-2 range (precise to creative), stored in localStorage
- **API key validation**: Format checks for Anthropic (sk-ant-*) and Gemini (20+ chars)
- **Keyboard shortcuts**: Escape to close chat panel

### Error Handling
- **ResizeObserver suppression**: Global error handlers suppress harmless ResizeObserver loop errors during panel resize
- **React ErrorBoundary**: Wraps main content area and ChatPanel to prevent full-page crashes, with "Try Again" recovery UI

### Planned/Partially Integrated
- **Stripe**: Listed in build allowlist, suggesting planned payment integration

### Key NPM Packages
- **@xyflow/react**: Interactive node-based diagram editor
- **drizzle-orm** + **drizzle-kit**: Database ORM and migration tooling
- **@tanstack/react-query**: Server state management and caching
- **express** + **express-session**: HTTP server and session management
- **connect-pg-simple**: PostgreSQL-backed session store
- **zod** + **drizzle-zod**: Runtime validation
- **wouter**: Lightweight client-side routing
- **recharts**: Charting library (available via shadcn chart component)